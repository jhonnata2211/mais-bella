const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync, backup } = require('node:sqlite');
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
  return { products, images, categoriesPreserved: true, filesPreserved: true };
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
async function createBackup(config, destination) {
  if (process.env.MAINTENANCE_MODE !== 'true') throw Error('Pare o servidor e habilite manutenção.');
  const target = path.resolve(destination);
  const root = require('../config').root;
  const inside = (a,b) => a === b || a.startsWith(b + path.sep);
  // Destino externo ao código, uploads e diretório do banco. Nenhum segredo é copiado por árvore.
  const parent = fs.realpathSync(path.dirname(target));
  const uploadsRoot = fs.existsSync(config.uploadsPath) ? fs.realpathSync(config.uploadsPath) : path.resolve(config.uploadsPath);
  if (inside(parent, root) || inside(parent, fs.realpathSync(path.dirname(config.databasePath))) || inside(parent, uploadsRoot)) throw Error('Use um destino externo de backup.');
  fs.mkdirSync(target, { mode: 0o700 }); // exclusivo; nunca sobrescreve backup
  fs.writeFileSync(path.join(target, 'INCOMPLETO'), 'Backup ainda não concluído.\n', { mode: 0o600, flag: 'wx' });
  const db = existingDatabase(config.databasePath);
  try { await backup(db, path.join(target, 'catalog.sqlite')); } finally { db.close(); }
  fs.chmodSync(path.join(target, 'catalog.sqlite'), 0o600);
  const snapshot = existingDatabase(path.join(target, 'catalog.sqlite'), false);
  // O snapshot é exclusivo: consolida WAL e entrega um arquivo SQLite independente.
  let references;
  try {
    snapshot.exec('PRAGMA journal_mode=DELETE;');
    if (snapshot.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw Error('Backup inconsistente.');
    references = [...new Set(snapshot.prepare("SELECT reference FROM product_images WHERE kind='image'").all().map(row => row.reference))];
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
    fs.copyFileSync(source, path.join(directory, match[1]), fs.constants.COPYFILE_EXCL);
    fs.chmodSync(path.join(directory, match[1]), 0o600); photos++;
  }
  fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), photos, database: 'catalog.sqlite', uploads: 'uploads/products', codeCommit: 'Registre separadamente a versão do código usada.' }, null, 2), { mode: 0o600, flag: 'wx' });
  fs.unlinkSync(path.join(target, 'INCOMPLETO'));
  return { success: true, photos };
}
module.exports = { existingDatabase, cleanupPlan, cleanupDemo, createBackup };
