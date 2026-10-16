const { verifyBackup } = require('../src/services/production-maintenance');
async function main() {
  if (process.argv.length !== 2 || !process.env.BACKUP_DIR) throw Error('Defina BACKUP_DIR.');
  console.log(JSON.stringify(await verifyBackup(process.env.BACKUP_DIR)));
}
main().catch(() => { console.error('Backup inválido ou incompleto. Confira arquivos, manifesto e permissões; não restaure esta cópia.'); process.exitCode = 1; });
