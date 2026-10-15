const { loadEnvironment, getConfig } = require('../src/config');
const { createBackup } = require('../src/services/production-maintenance');
async function main() {
  if (process.argv.length !== 2) throw Error('Use BACKUP_DIR.');
  loadEnvironment(); const config = getConfig();
  if (!process.env.BACKUP_DIR || !process.env.DB_PATH) throw Error('Defina BACKUP_DIR e DB_PATH.');
  console.log(JSON.stringify(await createBackup(config, process.env.BACKUP_DIR)));
}
main().catch(() => { console.error('Backup não concluído. Pare o servidor, use MAINTENANCE_MODE=true, DB_PATH e BACKUP_DIR externo, novo e com diretório pai existente. Pastas com INCOMPLETO não devem ser restauradas.'); process.exitCode = 1; });
