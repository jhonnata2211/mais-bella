const { openDatabase } = require('../src/db/database');
const { seedDemo } = require('../src/db/seed');
const { loadEnvironment, getConfig } = require('../src/config');
async function main() {
  loadEnvironment();
  const config = getConfig();
  if (!config.seedDemo || config.environment === 'production') throw Error('Seed não autorizado.');
  // O seed pode criar um banco novo; o lock é usado quando já existe.
  const release = require('node:fs').existsSync(config.databasePath) ? require('../src/services/operation-lock').operationLock(config.databasePath).acquire('seed') : () => {};
  let db;
  try { db = openDatabase(config.databasePath); } catch(error) { release(); throw error; }
  try { console.log(JSON.stringify(await seedDemo(db))); } finally { try { db.close(); } finally { release(); } }
}
main().catch(() => { console.error('Não foi possível aplicar o seed. Verifique a configuração e as permissões do banco.'); process.exitCode = 1; });
