const { restoreBackup } = require('../src/services/production-maintenance');
async function main() {
  if (process.argv.length !== 2 || !process.env.BACKUP_DIR || !process.env.RESTORE_DIR) throw Error('Defina BACKUP_DIR e RESTORE_DIR.');
  console.log(JSON.stringify(await restoreBackup(process.env.BACKUP_DIR,process.env.RESTORE_DIR)));
}
main().catch(() => { console.error('Restauração não concluída. Use backup verificado e RESTORE_DIR novo, fora do código, com pai existente. Nunca use pasta marcada INCOMPLETO.'); process.exitCode = 1; });
