const { createApp } = require('./src/app');
const { openDatabase } = require('./src/db/database');
const { seedDemo } = require('./src/db/seed');
const { loadEnvironment, getConfig } = require('./src/config');

async function startServer() {
  loadEnvironment();
  const config = getConfig();
  const db = openDatabase(config.databasePath);
  try {
    if (config.seedDemo) await seedDemo(db);
    const app = createApp({ db });
    const server = app.listen(config.port);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.once('listening', () => { server.off('error', reject); resolve(); });
    });
    console.log(`Mais Bella disponível em http://localhost:${server.address().port}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      server.close(() => { db.close(); process.exit(0); });
    });
    return { server, db };
  } catch (error) { db.close(); throw error; }
}
if (require.main === module) startServer().catch(() => {
  console.error('Não foi possível iniciar a aplicação. Verifique o Node.js, a configuração e as permissões do banco.');
  process.exitCode = 1;
});
module.exports = { startServer };
