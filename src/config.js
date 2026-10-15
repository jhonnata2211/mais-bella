const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
function loadEnvironment() {
  const file = path.join(root, '.env');
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

function getConfig(env = process.env) {
  const environment = env.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(environment)) throw new Error('NODE_ENV inválido.');
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT inválida.');
  const databasePath = path.resolve(root, env.DB_PATH || 'data/maisbella.sqlite');
  const publicPath = path.join(root, 'public');
  if (databasePath === publicPath || databasePath.startsWith(publicPath + path.sep)) throw new Error('O banco não pode ficar dentro de public.');
  if (env.SEED_DEMO !== undefined && !['true', 'false'].includes(env.SEED_DEMO)) throw new Error('SEED_DEMO deve ser true ou false.');
  const uploadsPath = path.resolve(root, env.UPLOAD_DIR || 'data/uploads');
  if (uploadsPath === publicPath || uploadsPath.startsWith(publicPath + path.sep)) throw new Error('UPLOAD_DIR deve ficar fora de public.');
  if (uploadsPath !== path.join(root, 'data', 'uploads') && (uploadsPath === root || uploadsPath.startsWith(root + path.sep))) throw new Error('Dentro do projeto, UPLOAD_DIR deve ser data/uploads. Use outro caminho somente fora do repositório.');
  if (databasePath === uploadsPath || databasePath.startsWith(uploadsPath + path.sep)) throw new Error('O banco deve ficar fora de UPLOAD_DIR.');
  const { validHash } = require('./services/password');
  const production = environment === 'production';
  const configured = Boolean(env.ADMIN_USER || env.ADMIN_PASSWORD_HASH || env.SESSION_SECRET);
  if ((configured || production) && (!env.ADMIN_USER || env.ADMIN_USER.length > 120 || !validHash(env.ADMIN_PASSWORD_HASH) || !/^[a-f0-9]{64,}$/.test(env.SESSION_SECRET || ''))) throw new Error('Configure ADMIN_USER, ADMIN_PASSWORD_HASH e SESSION_SECRET seguros.');
  let origin;
  try { origin = new URL(env.APP_ORIGIN || 'http://localhost:' + port).origin; } catch { throw new Error('APP_ORIGIN inválida.'); }
  if (env.APP_ORIGIN && origin !== env.APP_ORIGIN) throw new Error('APP_ORIGIN deve conter somente a origem.');
  if (production && (!env.APP_ORIGIN || !origin.startsWith('https://') || env.SEED_DEMO === 'true')) throw new Error('Produção exige HTTPS e seed desativado.');
  if (env.TRUST_PROXY && !['loopback', 'railway'].includes(env.TRUST_PROXY)) throw new Error('TRUST_PROXY deve ser loopback ou railway.');
  if (env.TRUST_PROXY === 'railway' && (!production || !env.RAILWAY_PROJECT_ID || !env.RAILWAY_SERVICE_ID)) throw new Error('O modo de proxy railway exige produção em um serviço Railway.');
  if (env.TRUST_PROXY === 'railway' && (env.RAILWAY_TCP_PROXY_DOMAIN || env.RAILWAY_TCP_APPLICATION_PORT || env.RAILWAY_TCP_PROXY_PORT)) throw new Error('Não exponha a porta HTTP por TCP Proxy no modo railway.');
  const admin = { enabled: configured, user: env.ADMIN_USER, passwordHash: env.ADMIN_PASSWORD_HASH, secret: env.SESSION_SECRET, origin, production, trustProxy: env.TRUST_PROXY || false, sessionMs: 30 * 60 * 1000 };
  return { port, databasePath, uploadsPath, environment, admin, seedDemo: env.SEED_DEMO === 'true' };
}
module.exports = { root, loadEnvironment, getConfig };
