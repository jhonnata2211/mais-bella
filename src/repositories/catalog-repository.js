class CatalogRepository {
  constructor(db) { this.db = db; }
  listCategories() {
    return this.db.prepare('SELECT id, slug, name, sort_order FROM categories WHERE active = 1 ORDER BY sort_order, name').all()
      .map(row => ({ id: row.id, slug: row.slug, name: row.name, order: row.sort_order }));
  }
  insertCategory(category) {
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO categories (id,slug,name,sort_order,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(category.id, category.slug, category.name, category.sortOrder, Number(category.active), now, now);
  }
  insertProduct(product) {
    this.db.prepare(`INSERT INTO products (id,slug,name,short_description,description,category_id,price_cents,promotional_price_cents,active,featured,is_new,best_seller,demo,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(product.id, product.slug, product.name, product.shortDescription, product.description,
      product.categoryId, product.priceCents, product.promotionalPriceCents, Number(product.active), Number(product.featured), Number(product.isNew),
      Number(product.bestSeller), Number(product.demo), product.createdAt, new Date().toISOString());
    this.insertChildren(product);
  }
  insertChildren(product) {
    const imageInsert = this.db.prepare('INSERT INTO product_images (id,product_id,reference,alt,sort_order,is_primary,kind,tone,shape) VALUES (?,?,?,?,?,?,?,?,?)');
    for (const image of product.images) imageInsert.run(image.id, product.id, image.type === 'image' ? image.src : `illustration:${image.tone}:${image.shape}`,
      image.alt, image.order, Number(image.primary), image.type, image.tone || null, image.shape || null);
    const variationInsert = this.db.prepare('INSERT INTO product_variations (id,product_id,color,size,stock,active,sort_order) VALUES (?,?,?,?,?,?,?)');
    for (const variation of product.variations) variationInsert.run(variation.id, product.id, variation.color, variation.size, variation.stock, Number(variation.active), variation.order);
  }
  productExists(id, slug) { return Boolean(this.db.prepare('SELECT id FROM products WHERE id = ? OR slug = ?').get(id, slug)); }
  categoryByName(name) { return this.db.prepare('SELECT id FROM categories WHERE name = ?').get(name); }
  categoryById(id) { return this.db.prepare('SELECT id FROM categories WHERE id = ?').get(id); }
  listProducts(filters = {}) {
    const conditions = ['p.active = 1', 'c.active = 1'];
    const parameters = [];
    if (filters.slug) { conditions.push('p.slug = ?'); parameters.push(filters.slug); }
    if (filters.category) { conditions.push('c.slug = ?'); parameters.push(filters.category); }
    for (const [flag, column] of [['featured', 'featured'], ['new', 'is_new'], ['bestSeller', 'best_seller']]) {
      if (filters[flag] !== undefined) { conditions.push(`p.${column} = ?`); parameters.push(Number(filters[flag])); }
    }
    for (const term of (filters.search || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/).filter(Boolean)) {
      conditions.push("instr(normalize_text(p.name || ' ' || c.name || ' ' || p.short_description || ' ' || p.description), ?) > 0"); parameters.push(term);
    }
    const rows = this.db.prepare(`SELECT p.*, c.name AS category, c.slug AS category_slug FROM products p JOIN categories c ON p.category_id = c.id
      WHERE ${conditions.join(' AND ')} ORDER BY p.is_new DESC, p.created_at DESC, p.id`).all(...parameters);
    return rows.map(row => this.toPublicProduct(row));
  }
  findProduct(slug) { return this.listProducts({ slug })[0] || null; }
  toPublicProduct(row, admin = false) {
    const images = this.db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order, id').all(row.id).map(image => ({
      id: image.id, productId: row.id, reference: image.reference, alt: image.alt, order: image.sort_order, primary: Boolean(image.is_primary), type: image.kind,
      ...(image.kind === 'image' ? { src: image.reference } : { tone: image.tone, shape: image.shape })
    }));
    const variations = this.db.prepare('SELECT * FROM product_variations WHERE product_id = ? AND (active = 1 OR ? = 1) ORDER BY sort_order, id').all(row.id, Number(admin))
      .map(variation => ({ id: variation.id, productId: row.id, color: variation.color, size: variation.size, stock: variation.stock, active: Boolean(variation.active), order: variation.sort_order }));
    return {
      id: row.id, slug: row.slug, name: row.name, shortDescription: row.short_description, description: row.description,
      categoryId: row.category_id, categorySlug: row.category_slug, category: row.category,
      price: row.price_cents / 100, priceCents: row.price_cents,
      ...(row.promotional_price_cents === null ? {} : { promotionalPrice: row.promotional_price_cents / 100, promotionalPriceCents: row.promotional_price_cents }),
      active: Boolean(row.active), featured: Boolean(row.featured), isNew: Boolean(row.is_new), bestSeller: Boolean(row.best_seller), demo: Boolean(row.demo),
      createdAt: row.created_at, updatedAt: row.updated_at, images, variations,
      colors: [...new Set(variations.map(variation => variation.color))], sizes: [...new Set(variations.map(variation => variation.size))]
    };
  }
}
module.exports = { CatalogRepository };
