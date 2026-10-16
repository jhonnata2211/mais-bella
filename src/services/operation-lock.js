// Exclusão entre processos do MESMO banco/volume. Falha fechada: não expira por tempo.
const fs = require('node:fs');
const crypto = require('node:crypto');
const memory = new WeakMap();
function runtimeIdentity() {
  try {
    return { bootId: fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(), pidNamespace: fs.readlinkSync('/proc/self/ns/pid') };
  } catch { return null; } // Identidade indisponível: recuperação deve recusar, nunca adivinhar.
}
function processAlive(pid) {
  try { process.kill(pid,0); return true; }
  catch(error) { if(error.code === 'ESRCH') return false; throw Error('Não foi possível verificar o processo.'); }
}
function lockDirectory(filename) { return fs.realpathSync(filename) + '.operations-lock'; }
function inspectLock(filename) {
  const directory = lockDirectory(filename);
  if (!fs.lstatSync(directory).isDirectory()) throw Error('Bloqueio inválido.');
  const ownerPath=directory+'/owner.json';
  if (!fs.lstatSync(ownerPath).isFile()) throw Error('Metadados inválidos.');
  const owner=JSON.parse(fs.readFileSync(ownerPath,'utf8'));
  if (!/^[a-f0-9]{32}$/.test(owner.token) || !Number.isSafeInteger(owner.pid) || owner.pid<1) throw Error('Metadados inválidos.');
  return {directory,owner};
}
// Dependência identity só permite testar namespaces em plataformas sem /proc/self/ns/pid.
function recoverLock(filename, { token, confirm = '', identity = runtimeIdentity } = {}) {
  if (confirm !== 'RECOVER_DEAD_OWNER' || !/^[a-f0-9]{32}$/.test(token || '')) throw Error('Confirmação explícita necessária.');
  const directory=lockDirectory(filename), gate=directory+'.recovery';
  fs.mkdirSync(gate,{mode:0o700});
  try {
    const {owner}=inspectLock(filename),current=identity();
    if (owner.token!==token) throw Error('O bloqueio mudou. Inspecione novamente.');
    if (!current || !owner.runtime || owner.runtime.bootId!==current.bootId || owner.runtime.pidNamespace!==current.pidNamespace) throw Error('Outro runtime ou identidade desconhecida: use manutenção técnica.');
    if (owner.children !== undefined && (!Array.isArray(owner.children) || owner.children.some(pid=>!Number.isSafeInteger(pid)||pid<1))) throw Error('Participantes inválidos.');
    if ([owner.pid,...(owner.children || [])].some(processAlive)) throw Error('O processo ainda está ativo; recuperação recusada.');
    // Renomeia para arquivo privado de auditoria; não apaga metadados nem backups.
    const archive=directory+'.recovered-'+crypto.randomBytes(16).toString('hex');
    fs.mkdirSync(archive,{mode:0o700});
    fs.renameSync(directory,archive+'/lock');
    return {success:true,archived:true};
  } finally { fs.rmdirSync(gate); }
}
function busyError() { const error = Error('Uma operação de segurança está em andamento. Aguarde e tente novamente.'); error.status = 503; return error; }
function operationLock(filename, db) {
  if (!filename || filename === ':memory:') {
    if (!memory.has(db)) memory.set(db, { busy: false });
    const state = memory.get(db);
    return { acquire() { if (state.busy) throw busyError(); state.busy = true; return () => { state.busy = false; }; } };
  }
  const directory = lockDirectory(filename);
  return { directory, acquire(purpose = 'write') {
    if (fs.existsSync(directory+'.recovery')) throw busyError();
    try { fs.mkdirSync(directory, { mode: 0o700 }); }
    catch (error) { if (error.code === 'EEXIST') throw busyError(); throw error; }
    const token = crypto.randomBytes(16).toString('hex');
    try { fs.writeFileSync(directory + '/owner.json', JSON.stringify({ token, pid: process.pid, runtime: runtimeIdentity(), purpose, createdAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 }); }
    catch (error) { fs.rmdirSync(directory); throw error; }
    let released = false;
    const release = () => {
      if (released) return;
      if (JSON.parse(fs.readFileSync(directory + '/owner.json', 'utf8')).token !== token) throw Error('Bloqueio alterado; revisão técnica necessária.');
      fs.unlinkSync(directory + '/owner.json'); fs.rmdirSync(directory); released = true;
    };
    release.addProcess = pid => {
      if (released || !Number.isSafeInteger(pid) || pid<1) throw Error('Participante inválido.');
      const filename=directory+'/owner.json',owner=JSON.parse(fs.readFileSync(filename,'utf8'));
      if (owner.token!==token) throw Error('Bloqueio alterado.');
      owner.children=[...(owner.children || []),pid];
      const temporary=directory+'/owner-'+crypto.randomBytes(8).toString('hex')+'.json';
      fs.writeFileSync(temporary,JSON.stringify(owner),{flag:'wx',mode:0o600});fs.renameSync(temporary,filename);
    };
    return release;
  } };
}
function databaseLock(db) {
  return operationLock(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file, db);
}
module.exports = { operationLock, databaseLock, inspectLock, recoverLock, runtimeIdentity };
