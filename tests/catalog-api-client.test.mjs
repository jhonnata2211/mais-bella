import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadCatalog, products, categories, replaceCatalog } from '../public/js/data/products.mjs';
import { queryProducts } from '../public/js/catalog.mjs';
import { findProduct } from '../public/js/product-model.mjs';
import { readCart, CART_KEY } from '../public/js/cart.mjs';
import { readFavorites, FAVORITES_KEY } from '../public/js/storefront.mjs';
import { prepareWhatsAppOrder } from '../public/js/whatsapp.mjs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../src/db/database');
const { seedDemo } = require('../src/db/seed');
const { CatalogService } = require('../src/services/catalog-service');
const { CatalogRepository } = require('../src/repositories/catalog-repository');

async function payload(t) {
  // Banco exclusivamente em memória; nenhuma variável de ambiente define este banco.
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  await seedDemo(db);
  const service = new CatalogService(new CatalogRepository(db));
  return { db, productData: service.listProducts({}), categoryData: service.listCategories() };
}

test('cliente carrega catálogo do SQLite/API antes dos módulos da vitrine, sem mudar referências', async t => {
  const data = await payload(t);
  const reference = products;
  const calls = [];
  await loadCatalog(async (url, options) => {
    calls.push(url);
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => url === '/api/products' ? { products: data.productData } : { categories: data.categoryData } };
  });
  assert.equal(products, reference);
  assert.equal(products.length, 12);
  assert.equal(categories.length, 5);
  assert.deepEqual(calls, ['/api/products', '/api/categories']);
  assert.equal(queryProducts(products, { category: 'Vestidos' }).length, 2);
  assert.equal(findProduct({ slug: 'vestido-midi-essencia' }).id, 'vestido');
});

test('IDs, sacola e favoritos anteriores sobrevivem à hidratação pela API; WhatsApp usa preços do banco', async t => {
  const data = await payload(t);
  replaceCatalog(data.productData, data.categoryData);
  const saved = new Map([
    [FAVORITES_KEY, JSON.stringify(['vestido', 'blusa'])],
    [CART_KEY, JSON.stringify([{ productId: 'vestido', color: 'Rosa queimado', size: 'M', quantity: 2, price: 189.90 }])]
  ]);
  const storage = { getItem: key => saved.get(key) };
  assert.deepEqual([...readFavorites(storage)], ['vestido', 'blusa']);
  const items = readCart(storage);
  assert.equal(items[0].quantity, 2);
  assert.equal(items[0].slug, 'vestido-midi-essencia');
  assert.equal(items[0].price, 189.90);
  const prepared = prepareWhatsAppOrder(items, { name: 'Cliente de teste', phone: '12345'.repeat(2) + '6', city: 'Cidade', neighborhood: 'Bairro', receiving: 'pickup' }, '1'.repeat(11));
  assert.equal(prepared.ok, true);
  assert.ok(prepared.message.includes('Quantidade: 2'));
  data.db.prepare('UPDATE products SET promotional_price_cents=? WHERE id=?').run(15990, 'vestido');
  const service = new CatalogService(new CatalogRepository(data.db));
  replaceCatalog(service.listProducts({}), data.categoryData);
  assert.equal(readCart(storage)[0].price, 159.90);
  assert.equal(saved.size, 2);
});

test('falha de API ou contrato inválido não troca catálogo existente nem aciona fallback estático', async t => {
  const data = await payload(t);
  replaceCatalog(data.productData, data.categoryData);
  const before = products.slice();
  await assert.rejects(loadCatalog(async () => ({ ok: false })), /indisponível/);
  assert.deepEqual(products, before);
  await assert.rejects(loadCatalog(async () => ({ ok: true, json: async () => ({ invalid: true }) })), /inválida/);
  assert.deepEqual(products, before);
  assert.throws(() => replaceCatalog([{ ...data.productData[0], active: false }], data.categoryData), /inválida/);
  assert.deepEqual(products, before);
});
