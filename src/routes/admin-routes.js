const { Router, raw } = require('express');
const { MAX_IMAGE_BYTES, IMAGE_TYPES } = require('../services/image-validation');
const { ValidationError } = require('../services/validation');
const { AdminRepository } = require('../repositories/admin-repository');
const { AdminService } = require('../services/admin-service');
const { AdminAuth } = require('../services/admin-auth');
function adminRoutes(db, config, media) {
  config = { ...config };
  const credentials = new (require('../repositories/credential-repository').CredentialRepository)(db);
  if (config.enabled) config.passwordHash = credentials.hash(config.user, config.passwordHash);
  const router = Router();
  const auth = new AdminAuth(config);
  const repository = new AdminRepository(db);
  const service = new AdminService(repository, media);
  const customization = new (require('../services/customization-service').CustomizationService)(db, media);
  const lock = require('../services/operation-lock').databaseLock(db);
  // Segura o bloqueio até a conclusão REAL do handler, mesmo se o cliente desconectar.
  const write = handler => async (req,res,next) => {
    let release;
    try { release = lock.acquire('admin-write'); await handler(req,res,next); }
    catch (error) { next(error); }
    finally { release?.(); }
  };
  const cookieName = config.production ? '__Host-mb_admin' : 'mb_admin';
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: config.production, path: '/' };
  router.use((req,res,next) => {
    res.set('Cache-Control','no-store');
    if (!config.enabled) return res.status(503).json({ error: 'Administração não configurada' });
    // Express aceita o primeiro valor de X-Forwarded-Proto; listas ambíguas não comprovam TLS.
    if (config.production && (!req.secure || !req.socket.encrypted && req.get('x-forwarded-proto')?.trim() !== 'https')) return res.status(403).json({ error: 'HTTPS obrigatório' });
    // Origin obrigatório em todas as escritas, inclusive login (login CSRF).
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && (req.get('origin') !== config.origin || (!(req.method === 'POST' && req.path === '/images') && !req.is('application/json')))) return res.status(403).json({ error: 'Origem ou formato não autorizado' });
    const cookie = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(cookieName + '='));
    req.adminToken = cookie?.slice(cookieName.length + 1);
    req.adminSession = auth.session(req.adminToken);
    next();
  });
  router.post('/login', async (req,res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || username.length > 120 || typeof password !== 'string' || password.length > 256) return res.status(400).json({ error: 'Credenciais inválidas' });
    const revision = config.passwordHash;
    const result = await auth.login(req.ip, username, password);
    if (result === 'limited') return res.status(429).set('Retry-After','900').json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
    if (!result || revision !== config.passwordHash) return res.status(401).json({ error: 'Credenciais inválidas' });
    auth.invalidate(req.adminToken);
    const session = auth.create();
    res.cookie(cookieName,session.token,{ ...cookieOptions, maxAge: config.sessionMs });
    res.json({ authenticated: true, csrfToken: session.csrf, expiresAt: session.expires });
  });
  router.use((req,res,next) => {
    if (!req.adminSession) return res.status(401).json({ error: 'Sessão ausente ou expirada' });
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('x-csrf-token') !== req.adminSession.csrf) return res.status(403).json({ error: 'Token CSRF inválido' });
    next();
  });
  router.get('/session', (req,res) => res.json({ authenticated: true, csrfToken: req.adminSession.csrf, expiresAt: req.adminSession.expires }));
  router.post('/logout', (req,res) => { auth.invalidate(req.adminToken); res.clearCookie(cookieName,cookieOptions); res.json({ success: true }); });
  let changingPassword = false;
  router.post('/password', write(async (req,res) => {
    const { currentPassword, newPassword, confirmation } = req.body || {};
    if (typeof currentPassword !== 'string' || currentPassword.length > 256 || typeof newPassword !== 'string' || newPassword.length < 15 || newPassword.length > 256) return res.status(400).json({ error: 'Use uma nova senha entre 15 e 256 caracteres.' });
    if (newPassword !== confirmation) return res.status(400).json({ error: 'A confirmação da nova senha não coincide.' });
    if (changingPassword) return res.status(429).json({ error: 'Aguarde a alteração em andamento.' });
    changingPassword = true;
    try {
      const result = await auth.login(req.ip, config.user, currentPassword);
      if (result === 'limited') return res.status(429).set('Retry-After','900').json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
      if (!result) return res.status(400).json({ error: 'A senha atual não está correta.' });
      const hash = await require('../services/password').hashPassword(newPassword);
      if (!auth.session(req.adminToken)) return res.status(401).json({ error: 'Sessão ausente ou expirada' });
      credentials.save(config.user, hash);
      config.passwordHash = hash;
      auth.invalidateAll();
      res.clearCookie(cookieName,cookieOptions);
      res.json({ success: true });
    } finally { changingPassword = false; }
  }));
  let uploadsInFlight = 0;
  router.post('/images', (req,res,next) => {
    // A exceção ao formato JSON existe somente aqui, após sessão, origem e CSRF.
    req.imageUpload = true;
    const mime = (req.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!Object.hasOwn(IMAGE_TYPES, mime)) throw new ValidationError('Formato de imagem não permitido. Use JPEG, PNG ou WebP.');
    if (Object.keys(req.query).some(key => key !== 'productId') || req.query.productId !== undefined && typeof req.query.productId !== 'string') throw new ValidationError('Produto inválido.');
    if (req.query.productId !== undefined) service.product(req.query.productId);
    if (uploadsInFlight >= 2) return res.status(429).set('Retry-After','5').json({ error: 'Há fotos sendo enviadas. Aguarde um momento e tente novamente.' });
    uploadsInFlight++;
    let released = false;
    const release = () => { if (!released) { released = true; uploadsInFlight--; } };
    res.once('finish', release); res.once('close', release);
    req.imageMime = mime;
    next();
  }, raw({ type: () => true, limit: MAX_IMAGE_BYTES, inflate: false }), write((req,res) => {
    res.status(201).json({ image: media.stage(req.body, req.imageMime) });
  }));
  router.get('/customization', (req,res) => res.json(customization.get()));
  router.put('/customization', write((req,res) => res.json(customization.save(req.body))));
  router.post('/customization/reset', write((req,res) => res.json(customization.save(req.body, true))));
  router.get('/products', (req,res) => res.json({ products: repository.products() }));
  router.get('/products/:id', (req,res) => res.json({ product: service.product(req.params.id) }));
  router.post('/products', write((req,res) => res.status(201).json({ product: service.saveProduct(req.body) })));
  router.put('/products/:id', write((req,res) => res.json({ product: service.saveProduct(req.body,req.params.id) })));
  router.get('/categories', (req,res) => res.json({ categories: repository.categories() }));
  router.post('/categories', write((req,res) => res.status(201).json({ category: service.saveCategory(req.body) })));
  router.put('/categories/:id', write((req,res) => res.json({ category: service.saveCategory(req.body,req.params.id) })));
  router.use((req,res) => res.status(404).json({ error: 'Rota não encontrada' }));
  return router;
}
module.exports = { adminRoutes };
