const { loadEnvironment, getConfig } = require('../src/config');
const { createBackup } = require('../src/services/production-maintenance');
async function main() {
  if (process.argv.slice(2).some(arg => arg !== '--online') || process.argv.length > 3) throw Error('Use BACKUP_DIR.');
  loadEnvironment(); const config = getConfig();
  if (!process.env.BACKUP_DIR || !process.env.DB_PATH) throw Error('Defina BACKUP_DIR e DB_PATH.');
  console.log(JSON.stringify(await createBackup(config, process.env.BACKUP_DIR, { online: process.argv.includes('--online') })));
}
main().catch(() => { console.error('Backup não concluído. Use --online para captura protegida, DB_PATH e BACKUP_DIR novo com pai existente. BACKUP_ROOT permite pasta dedicada no volume. Aguarde escritas/backup em andamento antes de tentar novamente. Pastas com INCOMPLETO não devem ser restauradas.'); process.exitCode = 1; });
