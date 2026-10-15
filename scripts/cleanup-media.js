const { loadEnvironment, getConfig } = require('../src/config');
const { openDatabase } = require('../src/db/database');
const { MediaService } = require('../src/services/media-service');
try {
  if (process.argv.slice(2).some(arg => arg !== '--apply')) throw Error('Argumento inválido');
  loadEnvironment(); const config = getConfig(); const db = openDatabase(config.databasePath);
  try { console.log(JSON.stringify(new MediaService(config.uploadsPath).cleanup(db, process.argv.includes('--apply')))); }
  finally { db.close(); }
} catch { console.error('Não foi possível verificar as fotos. Confira a configuração e as permissões.'); process.exitCode = 1; }
