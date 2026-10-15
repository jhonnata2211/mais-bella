const { Router } = require('express');
const { catalogController } = require('../controllers/catalog-controller');
function catalogRoutes(service) {
  const router = Router();
  const controller = catalogController(service);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/products', controller.products);
  router.get('/products/:slug', controller.product);
  router.get('/categories', controller.categories);
  router.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
  return router;
}
module.exports = { catalogRoutes };
