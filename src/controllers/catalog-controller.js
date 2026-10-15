function catalogController(service) {
  return {
    products(req, res) { res.json({ products: service.listProducts(req.query) }); },
    product(req, res) {
      const product = service.findProduct(req.params.slug);
      if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
      res.json({ product });
    },
    categories(req, res) { res.json({ categories: service.listCategories() }); }
  };
}
module.exports = { catalogController };
