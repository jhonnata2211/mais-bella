// Processo privado: nunca carrega .env, nunca recebe conexão de destino compartilhada.
const { DatabaseSync, backup } = require('node:sqlite');
process.once('disconnect',() => process.exit(1));
process.once('message', async ({ source, destination }) => {
  let db;
  try {
    db = new DatabaseSync(source,{readOnly:true,timeout:0});
    db.exec('PRAGMA busy_timeout=0;');
    await backup(db,destination);
    db.close(); db = null;
    process.send({success:true});
  } catch {
    if (db) db.close();
    process.exitCode = 1;
  } finally { process.removeAllListeners('disconnect'); process.disconnect(); }
});
