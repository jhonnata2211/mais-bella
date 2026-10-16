const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { operationLock } = require('./operation-lock');
const { DatabaseSync } = require('node:sqlite');
const { transaction } = require('../db/database');
const { UPLOAD_REFERENCE } = require('./media-service');

function existingDatabase(filename, readOnly = true) {
  if (!fs.lstatSync(filename).isFile()) throw Error('Banco inexistente ou inválido.');
  const db = new DatabaseSync(filename, { readOnly, timeout: 5000 });
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  return db;
}
function cleanupPlan(db) {
  const products = db.prepare('SELECT id,name FROM products WHERE demo=1 ORDER BY id').all();
  const images = db.prepare(`SELECT DISTINCT i.reference FROM product_images i JOIN products p ON p.id=i.product_id
    WHERE p.demo=1 AND NOT EXISTS (SELECT 1 FROM product_images other JOIN products real ON real.id=other.product_id WHERE other.reference=i.reference AND real.demo=0)
    ORDER BY i.reference`).all().map(row => row.reference);
  const usedByHome = new Set(require('../repositories/image-references').customizationReferences(db));
  return { products, images: images.filter(reference => !usedByHome.has(reference)), categoriesPreserved: true, filesPreserved: true };
}
function cleanupDemo(db, { apply = false, maintenance = false, seedDemo = false, confirmation = '' } = {}) {
  if (apply && (!maintenance || seedDemo || confirmation !== 'REMOVE_DEMOS')) throw Error('Limpeza real não autorizada.');
  const action = () => {
    const plan = cleanupPlan(db);
    if (apply) db.prepare('DELETE FROM products WHERE demo=1').run();
    // Mantém seed_runs: reiniciar nunca recria os demos removidos.
    // Arquivos ficam órfãos até media:cleanup; não existe janela com referência quebrada.
    return { apply, ...plan };
  };
  return apply ? transaction(db, action) : action();
}
function regularFile(filename) {
  if (!fs.lstatSync(filename).isFile()) throw Error('Foto ausente ou inválida.');
}
async function createBackup(config, destination, { online = false, snapshotTimeoutMs = 120000 } = {}) {
  if (!online && process.env.MAINTENANCE_MODE !== 'true') throw Error('Pare o servidor e habilite manutenção.');
  const target = path.resolve(destination);
  const root = require('../config').root;
  const inside = (a,b) => a === b || a.startsWith(b + path.sep);
  // Destino externo ao código, uploads e diretório do banco. Nenhum segredo é copiado por árvore.
  const parent = fs.realpathSync(path.dirname(target));
  const uploadsRoot = fs.existsSync(config.uploadsPath) ? fs.realpathSync(config.uploadsPath) : path.resolve(config.uploadsPath);
  const databaseFile = fs.realpathSync(config.databasePath);
  if (inside(parent, root) || inside(parent, uploadsRoot)) throw Error('Use um destino externo de backup.');
  if (config.backupRoot) {
    const backupRoot = fs.realpathSync(config.backupRoot);
    if (parent !== backupRoot || inside(backupRoot, root) || inside(backupRoot, uploadsRoot) || inside(uploadsRoot, backupRoot) || inside(databaseFile, backupRoot) || backupRoot === path.dirname(databaseFile)) throw Error('Diretório dedicado de backup inválido.');
  } else if (inside(parent, path.dirname(databaseFile))) throw Error('Use BACKUP_ROOT para um diretório dedicado no volume.');
  const release = operationLock(databaseFile).acquire('backup');
  let writer;
  try {
    // Defesa adicional contra escritores SQLite externos: mantém leitores em WAL.
    writer = existingDatabase(databaseFile, false);
    writer.exec('PRAGMA busy_timeout=0;');
    if (online && writer.prepare('PRAGMA journal_mode').get().journal_mode !== 'wal') throw Error('Backup online exige WAL; use manutenção offline.');
    writer.exec('BEGIN IMMEDIATE;');
    fs.mkdirSync(target, { mode: 0o700 }); // exclusivo; nunca sobrescreve backup
    fs.writeFileSync(path.join(target, 'INCOMPLETO'), 'Backup ainda não concluído.\n', { mode: 0o600, flag: 'wx' });
    await require('./sqlite-snapshot').captureSnapshot(databaseFile,path.join(target,'catalog.sqlite'),snapshotTimeoutMs,pid=>release.addProcess(pid));
    fs.chmodSync(path.join(target, 'catalog.sqlite'), 0o600);
    const snapshot = existingDatabase(path.join(target, 'catalog.sqlite'), false);
    // O snapshot é exclusivo: consolida WAL e entrega um arquivo SQLite independente.
    let references;
    try {
      snapshot.exec('PRAGMA journal_mode=DELETE;');
      if (snapshot.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || snapshot.prepare('PRAGMA foreign_key_check').all().length) throw Error('Backup inconsistente.');
      references = require('../repositories/image-references').imageReferences(snapshot);
    } finally { snapshot.close(); }
    const directory = path.join(target, 'uploads', 'products');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    let photos = 0;
    for (const reference of references) {
      const match = UPLOAD_REFERENCE.exec(reference);
      if (!match) continue; // assets locais pertencem ao código versionado
      const source = path.join(config.uploadsPath, 'products', match[1]);
      const realDirectory = fs.realpathSync(path.join(config.uploadsPath, 'products'));
      if (realDirectory !== path.join(fs.realpathSync(config.uploadsPath), 'products')) throw Error('Diretório de fotos inválido.');
      regularFile(source);
      await fs.promises.copyFile(source, path.join(directory, match[1]), fs.constants.COPYFILE_EXCL);
      fs.chmodSync(path.join(directory, match[1]), 0o600); photos++;
    }
    const files = {};
    for (const relative of ['catalog.sqlite', ...fs.readdirSync(directory).sort().map(name => 'uploads/products/' + name)]) {
      const filename = path.join(target, relative);
      files[relative] = { bytes: fs.statSync(filename).size, sha256: await hashFile(filename) };
      const fd = fs.openSync(filename,'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
    let codeCommit = /^[a-f0-9]{40}$/i.test(process.env.RAILWAY_GIT_COMMIT_SHA || '') ? process.env.RAILWAY_GIT_COMMIT_SHA : null;
    try { if (!codeCommit) codeCommit = require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch {}
    fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify({ version: 2, createdAt: new Date().toISOString(), photos, database: 'catalog.sqlite', uploads: 'uploads/products', codeCommit, files }, null, 2), { mode: 0o600, flag: 'wx' });
    const manifestFd = fs.openSync(path.join(target,'manifest.json'),'r'); try { fs.fsyncSync(manifestFd); } finally { fs.closeSync(manifestFd); }
    await verifyBackup(target, { incomplete: true });
    // Sincroniza entradas antes de retirar o marcador; falha anterior continua incompleta.
    for (const folder of [directory,path.dirname(directory),target]) syncFile(folder);
    fs.unlinkSync(path.join(target, 'INCOMPLETO'));
    return { success: true, photos };
  } finally {
    try { if (writer) { if (writer.isTransaction) writer.exec('ROLLBACK'); writer.close(); } }
    finally { release(); }
  }
}
function syncFile(filename) {
  const fd = fs.openSync(filename,'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
async function hashFile(filename) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}
async function verifyBackup(directory, { incomplete = false } = {}) {
  if (!incomplete && fs.existsSync(path.join(directory,'INCOMPLETO'))) throw Error('Backup incompleto.');
  regularFile(path.join(directory,'manifest.json'));
  const manifest = JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
  if (manifest.version !== 2 || manifest.database !== 'catalog.sqlite' || manifest.uploads !== 'uploads/products' || !manifest.files || !Number.isSafeInteger(manifest.photos)) throw Error('Manifesto inválido.');
  const names = Object.keys(manifest.files);
  if (!names.includes('catalog.sqlite') || names.length !== manifest.photos + 1) throw Error('Inventário inválido.');
  const productDirectory = path.join(directory,'uploads','products');
  if (!fs.lstatSync(productDirectory).isDirectory() || fs.realpathSync(productDirectory) !== path.join(fs.realpathSync(directory),'uploads','products')) throw Error('Diretório inválido.');
  for (const relative of names) {
    if (relative !== 'catalog.sqlite' && !/^uploads\/products\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(relative)) throw Error('Arquivo não permitido.');
    const filename = path.join(directory,relative), expected = manifest.files[relative]; regularFile(filename);
    if (fs.statSync(filename).size !== expected.bytes || await hashFile(filename) !== expected.sha256) throw Error('Arquivo ausente ou alterado.');
  }
  const snapshot = existingDatabase(path.join(directory,'catalog.sqlite'));
  try {
    if (snapshot.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || snapshot.prepare('PRAGMA foreign_key_check').all().length) throw Error('Banco inconsistente.');
    const expected = require('../repositories/image-references').imageReferences(snapshot).filter(ref => UPLOAD_REFERENCE.test(ref)).map(ref => 'uploads/products/' + UPLOAD_REFERENCE.exec(ref)[1]).sort();
    if (JSON.stringify(expected) !== JSON.stringify(names.filter(name => name !== 'catalog.sqlite').sort()) || JSON.stringify(fs.readdirSync(productDirectory).sort()) !== JSON.stringify(expected.map(name => path.basename(name)).sort())) throw Error('Fotos inconsistentes.');
  } finally { snapshot.close(); }
  return { success: true, photos: manifest.photos };
}
// Só restaura para diretório NOVO; nunca substitui banco ou fotos em uso.
async function restoreBackup(source, destination) {
  await verifyBackup(source);
  const parent = fs.realpathSync(path.dirname(path.resolve(destination)));
  const root = require('../config').root;
  const sourceRoot = fs.realpathSync(source);
  if (parent === root || parent.startsWith(root + path.sep) || parent === sourceRoot || parent.startsWith(sourceRoot + path.sep)) throw Error('Restaure fora do projeto e do backup de origem.');
  const target = path.join(parent,path.basename(destination));
  fs.mkdirSync(target,{mode:0o700});
  fs.writeFileSync(path.join(target,'INCOMPLETO'),'Restauração ainda não concluída.\n',{flag:'wx',mode:0o600});
  fs.mkdirSync(path.join(target,'uploads','products'),{recursive:true,mode:0o700});
  const manifest = JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
  for (const relative of [...Object.keys(manifest.files),'manifest.json']) {
    await fs.promises.copyFile(path.join(source,relative),path.join(target,relative),fs.constants.COPYFILE_EXCL);
    fs.chmodSync(path.join(target,relative),0o600); syncFile(path.join(target,relative));
  }
  await verifyBackup(target,{incomplete:true});
  for (const folder of [path.join(target,'uploads','products'),path.join(target,'uploads'),target]) syncFile(folder);
  fs.unlinkSync(path.join(target,'INCOMPLETO'));
  return {success:true,photos:manifest.photos};
}
module.exports = { existingDatabase, cleanupPlan, cleanupDemo, createBackup, verifyBackup, restoreBackup };
