const path = require('node:path');
const { fork } = require('node:child_process');
// O timeout não abandona uma Promise de backup ativa: mata o worker e aguarda exit.
function captureSnapshot(source,destination,timeoutMs = 120000,onWorker = () => {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600000) throw Error('Prazo de captura inválido.');
  return new Promise((resolve,reject) => {
    const worker = fork(path.join(__dirname,'sqlite-snapshot-worker.js'),[],{
      execArgv:[],stdio:['ignore','ignore','ignore','ipc'],env:{PATH:process.env.PATH || '',TMPDIR:process.env.TMPDIR || ''}
    });
    let success = false, timedOut = false;
    const timer = setTimeout(() => { timedOut=true; worker.kill('SIGKILL'); },timeoutMs);
    worker.on('message',message => { success=message?.success===true; });
    worker.once('error',() => {
      if (worker.pid) worker.kill('SIGKILL');
      else { clearTimeout(timer); reject(Error('Não foi possível iniciar a captura SQLite.')); }
    });
    worker.once('exit',code => {
      clearTimeout(timer);
      if (!timedOut && code===0 && success) resolve();
      else reject(Error(timedOut ? 'Prazo da captura SQLite excedido; processo encerrado.' : 'Captura SQLite não concluída.'));
    });
    try {
      onWorker(worker.pid); // Registra participante ANTES de autorizar qualquer acesso SQLite.
      worker.send({source,destination},error => { if(error) worker.kill('SIGKILL'); });
    } catch { worker.kill('SIGKILL'); }
  });
}
module.exports = { captureSnapshot };
