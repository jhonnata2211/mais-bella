const { openDatabase } = require('../src/db/database');
const { seedDemo } = require('../src/db/seed');
const { loadEnvironment, getConfig } = require('../src/config');
async function main() {
  loadEnvironment();
  const config = getConfig();
  if (!config.seedDemo || config.environment === 'production') throw Error('Seed não autorizado.');
  const db = openDatabase(config.databasePath);
  try { console.log(JSON.stringify(await seedDemo(db))); } finally { db.close(); }
}
main().catch(() => { console.error('Não foi possível aplicar o seed. Verifique a configuração e as permissões do banco.'); process.exitCode = 1; });
