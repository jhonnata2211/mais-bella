const { CatalogRepository } = require('./catalog-repository');
class AdminRepository extends CatalogRepository {
  categories() {
    return this.db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all().map(r => ({ id: r.id, slug: r.slug, name: r.name, active: Boolean(r.active), sortOrder: r.sort_order }));
  }
  products() {
    return this.db.prepare('SELECT p.*, c.name AS category, c.slug AS category_slug FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.name').all().map(r => this.toPublicProduct(r, true));
  }
  product(id) {
    const row = this.db.prepare('SELECT p.*, c.name AS category, c.slug AS category_slug FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=?').get(id);
    return row ? this.toPublicProduct(row, true) : null;
  }
  updateCategory(c) {
    this.db.prepare('UPDATE categories SET slug=?,name=?,sort_order=?,active=?,updated_at=? WHERE id=?').run(c.slug,c.name,c.sortOrder,Number(c.active),new Date().toISOString(),c.id);
  }
  updateProduct(p) {
    this.db.prepare(`UPDATE products SET slug=?,name=?,short_description=?,description=?,category_id=?,price_cents=?,promotional_price_cents=?,active=?,featured=?,is_new=?,best_seller=?,updated_at=? WHERE id=?`).run(p.slug,p.name,p.shortDescription,p.description,p.categoryId,p.priceCents,p.promotionalPriceCents,Number(p.active),Number(p.featured),Number(p.isNew),Number(p.bestSeller),new Date().toISOString(),p.id);
    this.db.prepare('DELETE FROM product_images WHERE product_id=?').run(p.id);
    this.db.prepare('DELETE FROM product_variations WHERE product_id=?').run(p.id);
    this.insertChildren(p);
  }
}
module.exports = { AdminRepository };
