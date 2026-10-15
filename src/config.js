const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
function loadEnvironment() {
  const file = path.join(root, '.env');
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

function getConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT inválida.');
  const databasePath = path.resolve(root, env.DB_PATH || 'data/maisbella.sqlite');
  const publicPath = path.join(root, 'public');
  if (databasePath === publicPath || databasePath.startsWith(publicPath + path.sep)) throw new Error('O banco não pode ficar dentro de public.');
  if (env.SEED_DEMO !== undefined && !['true', 'false'].includes(env.SEED_DEMO)) throw new Error('SEED_DEMO deve ser true ou false.');
  return { port, databasePath, seedDemo: env.SEED_DEMO === undefined ? env.NODE_ENV !== 'production' : env.SEED_DEMO === 'true' };
}
module.exports = { root, loadEnvironment, getConfig };
