const { createApp } = require('./src/app');
const { openDatabase } = require('./src/db/database');
const { seedDemo } = require('./src/db/seed');
const { loadEnvironment, getConfig } = require('./src/config');

async function startServer() {
  process.umask(0o077);
  loadEnvironment();
  const config = getConfig();
  const release = require('node:fs').existsSync(config.databasePath) ? require('./src/services/operation-lock').operationLock(config.databasePath).acquire('startup') : () => {};
  let db, app;
  try {
    // Protege abertura/migrações, seed e preparação da aplicação.
    // Um único finally libera antes de abrir a porta HTTP, inclusive em erro.
    try {
      db = openDatabase(config.databasePath);
      if (config.seedDemo) await seedDemo(db);
      app = createApp({ db, config });
    } finally { release(); }
    const server = app.listen(config.port);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.once('listening', () => { server.off('error', reject); resolve(); });
    });
    console.log(config.admin.production ? 'Mais Bella iniciada em modo produção.' : `Mais Bella disponível em http://localhost:${server.address().port}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      server.close(() => { db.close(); process.exit(0); });
    });
    return { server, db };
  } catch (error) { if (db) db.close(); throw error; }
}
if (require.main === module) startServer().catch(() => {
  console.error('Não foi possível iniciar a aplicação. Verifique o Node.js, a configuração e as permissões do banco.');
  process.exitCode = 1;
});
module.exports = { startServer };
