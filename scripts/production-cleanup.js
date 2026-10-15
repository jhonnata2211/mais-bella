const { loadEnvironment, getConfig } = require('../src/config');
const { existingDatabase, cleanupDemo } = require('../src/services/production-maintenance');
try {
  const args = process.argv.slice(2);
  if (!args.length || args.some(arg => !['--dry-run', '--apply', '--confirm=REMOVE_DEMOS'].includes(arg)) || args.includes('--apply') === args.includes('--dry-run')) throw Error('Informe --dry-run ou --apply com confirmação.');
  loadEnvironment(); const config = getConfig(); const apply = args.includes('--apply');
  if (apply && (!process.env.DB_PATH || process.env.MAINTENANCE_MODE !== 'true' || config.seedDemo || !args.includes('--confirm=REMOVE_DEMOS'))) throw Error('Limpeza real não autorizada.');
  const db = existingDatabase(config.databasePath, !apply);
  try { console.log(JSON.stringify(cleanupDemo(db, { apply, maintenance: process.env.MAINTENANCE_MODE === 'true', seedDemo: config.seedDemo, confirmation: args.includes('--confirm=REMOVE_DEMOS') ? 'REMOVE_DEMOS' : '' }), null, 2)); }
  finally { db.close(); }
} catch { console.error('Limpeza não executada. Use --dry-run; para aplicar, pare o servidor, faça backup e configure DB_PATH, SEED_DEMO=false, MAINTENANCE_MODE=true e --apply --confirm=REMOVE_DEMOS.'); process.exitCode = 1; }
