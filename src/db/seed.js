const { transaction } = require('./database');
const { CatalogRepository } = require('../repositories/catalog-repository');
const { validateProduct, validateCategory, toCents } = require('../services/validation');
const SEED_NAME = 'maisbella-demo-v1';

async function seedDemo(db) {
  const { products } = await import('./seed-products.mjs');
  const names = [...new Set(products.map(product => product.category))];
  const makeSlug = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const repository = new CatalogRepository(db);
  return transaction(db, () => {
    if (db.prepare('SELECT name FROM seed_runs WHERE name = ?').get(SEED_NAME)) return { applied: false, inserted: 0 };
    for (const [index, name] of names.entries()) {
      if (!repository.categoryByName(name)) {
        const category = validateCategory({ id: makeSlug(name), slug: makeSlug(name), name, sortOrder: index, active: true });
        // Não alterar categorias existentes com IDs/slugs já ocupados.
        if (!db.prepare('SELECT id FROM categories WHERE id = ? OR slug = ?').get(category.id, category.slug)) repository.insertCategory(category);
      }
    }
    let inserted = 0;
    for (const product of products) {
      if (repository.productExists(product.id, product.slug)) continue;
      const category = repository.categoryByName(product.category);
      if (!category) throw new Error('Categoria de demonstração em conflito. Seed não aplicado.');
      const normalized = validateProduct({ ...product, categoryId: category.id, priceCents: toCents(product.price),
        promotionalPriceCents: product.promotionalPrice === undefined ? null : toCents(product.promotionalPrice), demo: true });
      repository.insertProduct(normalized);
      inserted++;
    }
    db.prepare('INSERT INTO seed_runs (name,applied_at) VALUES (?,?)').run(SEED_NAME, new Date().toISOString());
    return { applied: true, inserted };
  });
}
module.exports = { seedDemo };
