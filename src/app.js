const express = require('express');
const helmet = require('helmet');
const path = require('node:path');
const { catalogRoutes } = require('./routes/catalog-routes');
const { errorHandler } = require('./middleware/error-handler');
const { CatalogRepository } = require('./repositories/catalog-repository');
const { CatalogService } = require('./services/catalog-service');

function createApp({ db, service = new CatalogService(new CatalogRepository(db)) }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(helmet({
    // Acesso local HTTP no Termux; HTTPS/HSTS deve ser configurado no deploy.
    strictTransportSecurity: false,
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"],
      formAction: ["'self'"], upgradeInsecureRequests: null
    } }
  }));
  app.use(express.json({ limit: '16kb', strict: true }));
  app.use('/api', catalogRoutes(service));
  // Somente arquivos públicos; bloqueia dotfiles e diretórios internos mesmo em URLs diretas.
  app.use(express.static(path.join(__dirname, '..', 'public'), { dotfiles: 'deny' }));
  app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
