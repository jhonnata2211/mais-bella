import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { products as demoProducts } from '../src/db/seed-products.mjs';
const require = createRequire(import.meta.url);
const { openDatabase, migrate } = require('../src/db/database');
const { seedDemo } = require('../src/db/seed');
const { CatalogRepository } = require('../src/repositories/catalog-repository');
const { CatalogService } = require('../src/services/catalog-service');
const { ValidationError, toCents, validateProduct, validateCategory } = require('../src/services/validation');
const { createApp } = require('../src/app');
const { getConfig } = require('../src/config');

async function fixture(t, { seed = true, service: injectedService } = {}) {
  // Nunca consulta DB_PATH/.env. Cada teste cria seu próprio diretório no tmp do Termux.
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maisbella-005-test-'));
  const filename = path.join(directory, 'catalog.sqlite');
  const db = openDatabase(filename);
  t.after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  if (seed) await seedDemo(db);
  const repository = new CatalogRepository(db);
  const service = new CatalogService(repository);
  let server;
  async function api() {
    const app = createApp({ db, service: injectedService || service });
    server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    return `http://127.0.0.1:${server.address().port}`;
  }
  return { db, filename, service, repository, api };
}
function input(overrides = {}) {
  return { ...structuredClone(demoProducts[0]), categoryId: 'vestidos', priceCents: 22990, promotionalPriceCents: 18990, demo: true, ...overrides };
}
function counts(db) {
  return Object.fromEntries(['categories', 'products', 'product_images', 'product_variations', 'seed_runs', 'schema_migrations']
    .map(table => [table, db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count]));
}

test('SQLite: inicializa seis tabelas e reabre o arquivo sem perder dados', async t => {
  const { db, filename, service } = await fixture(t, { seed: false });
  assert.deepEqual(counts(db), { categories: 0, products: 0, product_images: 0, product_variations: 0, seed_runs: 0, schema_migrations: 1 });
  service.createCategory({ id: 'categoria-local', slug: 'categoria-local', name: 'Categoria local' });
  const second = openDatabase(filename);
  try {
    assert.equal(second.prepare('SELECT name FROM categories').get().name, 'Categoria local');
    migrate(second);
    assert.equal(second.prepare('SELECT count(*) AS n FROM schema_migrations').get().n, 1);
    assert.equal(second.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  } finally { second.close(); }
});

test('seed duas vezes é idempotente e preserva edições, estoque, inativos e produtos do usuário', async t => {
  const { db, service } = await fixture(t, { seed: false });
  assert.deepEqual(await seedDemo(db), { applied: true, inserted: 12 });
  service.createProduct(input({ id: 'custom', slug: 'peca-customizada', name: 'Peça do usuário' }));
  db.prepare('UPDATE products SET name = ?, active = 0 WHERE id = ?').run('Peça editada', 'vestido');
  db.prepare('UPDATE product_variations SET stock = 99 WHERE product_id = ?').run('vestido');
  const before = counts(db);
  assert.deepEqual(await seedDemo(db), { applied: false, inserted: 0 });
  assert.deepEqual(counts(db), before);
  assert.equal(db.prepare('SELECT name FROM products WHERE id = ?').get('vestido').name, 'Peça editada');
  assert.equal(db.prepare('SELECT stock FROM product_variations WHERE product_id = ? LIMIT 1').get('vestido').stock, 99);
  assert.equal(db.prepare('SELECT name FROM products WHERE id = ?').get('custom').name, 'Peça do usuário');
  assert.equal(db.prepare('SELECT active FROM products WHERE id = ?').get('vestido').active, 0);
});

test('seed inicial não sobrescreve produto preexistente com mesmo ID/slug', async t => {
  const { db, service } = await fixture(t, { seed: false });
  service.createCategory({ id: 'vestidos', slug: 'vestidos', name: 'Vestidos' });
  service.createProduct(input({ name: 'Edição anterior da loja' }));
  assert.equal((await seedDemo(db)).inserted, 11);
  assert.equal(db.prepare('SELECT name FROM products WHERE id = ?').get('vestido').name, 'Edição anterior da loja');
  assert.equal(counts(db).products, 12);
});

test('listagem e busca por slug devolvem o modelo compatível com a vitrine', async t => {
  const { service } = await fixture(t);
  const list = service.listProducts({});
  assert.equal(list.length, 12);
  const product = service.findProduct('vestido-midi-essencia');
  assert.equal(product.id, 'vestido');
  assert.equal(product.price, 229.90);
  assert.equal(product.promotionalPrice, 189.90);
  assert.equal(product.priceCents, 22990);
  assert.equal(product.category, 'Vestidos');
  assert.deepEqual(product.colors, ['Rosa queimado', 'Nude']);
  assert.deepEqual(product.sizes, ['P', 'M', 'G']);
  assert.equal(product.demo, true);
  assert.ok(product.createdAt && product.updatedAt);
  assert.equal(service.findProduct('nao-existe'), null);
});

test('filtros da API: categoria, acentos, busca nas descrições e flags', async t => {
  const { service } = await fixture(t);
  assert.equal(service.listProducts({ category: 'vestidos' }).length, 2);
  assert.equal(service.listProducts({ categoria: 'vestidos' }).length, 2);
  assert.equal(service.listProducts({ search: 'AMELIA' })[0].id, 'calca');
  assert.equal(service.listProducts({ busca: 'entardecer' })[0].id, 'vestido-luna');
  assert.equal(service.listProducts({ featured: 'true' }).length, 4);
  assert.equal(service.listProducts({ novidade: 'true' }).length, 5);
  assert.equal(service.listProducts({ bestSeller: '1' }).length, 4);
  assert.equal(service.listProducts({ featured: 'false' }).length, 8);
  assert.equal(service.listProducts({ search: "x' OR 1=1--" }).length, 0);
});

test('produtos/categorias inativos não são expostos e continuam no banco', async t => {
  const { db, service } = await fixture(t);
  db.prepare('UPDATE products SET active=0 WHERE id=?').run('vestido');
  assert.equal(service.findProduct('vestido-midi-essencia'), null);
  assert.equal(service.listProducts({}).length, 11);
  db.prepare('UPDATE categories SET active=0 WHERE slug=?').run('vestidos');
  assert.equal(service.findProduct('vestido-longo-luna'), null);
  assert.equal(service.listCategories().length, 4);
  assert.equal(counts(db).products, 12);
});

test('categorias persistidas, inclusive novas categorias sem produto', async t => {
  const { service } = await fixture(t);
  assert.deepEqual(service.listCategories().map(category => category.name), ['Vestidos', 'Conjuntos', 'Blusas', 'Calças', 'Saias & Shorts']);
  service.createCategory({ id: 'acessorios', slug: 'acessorios', name: 'Acessórios', sortOrder: 5 });
  assert.equal(service.listCategories()[5].name, 'Acessórios');
});

test('variações preservam estoque zero e excluem opções inativas', async t => {
  const { db, service } = await fixture(t);
  const before = service.findProduct('vestido-midi-essencia');
  assert.equal(before.variations.find(v => v.color === 'Rosa queimado' && v.size === 'P').stock, 0);
  assert.equal(before.variations.find(v => v.color === 'Rosa queimado' && v.size === 'M').stock, 5);
  db.prepare('UPDATE product_variations SET active=0 WHERE product_id=? AND color=?').run('vestido', 'Nude');
  const after = service.findProduct('vestido-midi-essencia');
  assert.equal(after.variations.length, 3);
  assert.deepEqual(after.colors, ['Rosa queimado']);
  assert.throws(() => db.prepare('UPDATE product_variations SET stock=-1 WHERE product_id=?').run('vestido'), /CHECK/);
});

test('slug único e chave estrangeira são impostos pelo SQLite', async t => {
  const { db, service } = await fixture(t);
  assert.throws(() => service.createProduct(input({ id: 'duplicado' })), /UNIQUE/);
  assert.equal(db.prepare('SELECT id FROM products WHERE id=?').get('duplicado'), undefined);
  assert.throws(() => db.prepare('UPDATE products SET category_id=? WHERE id=?').run('inexistente', 'vestido'), /FOREIGN KEY/);
});

test('combinação produto/cor/tamanho não duplica no banco nem na validação', async t => {
  const { db } = await fixture(t);
  assert.throws(() => db.prepare(`INSERT INTO product_variations (id,product_id,color,size,stock) VALUES (?,?,?,?,?)`).run('dup', 'vestido', 'Nude', 'M', 1), /UNIQUE/);
  const bad = input();
  bad.variations.push({ ...bad.variations[0] });
  assert.throws(() => validateProduct(bad), ValidationError);
});

test('preços em centavos inteiros, promoção coerente e rejeição de frações', async t => {
  const { db } = await fixture(t);
  const row = db.prepare('SELECT price_cents, promotional_price_cents, typeof(price_cents) AS kind FROM products WHERE id=?').get('vestido');
  assert.equal(row.price_cents, 22990);
  assert.equal(row.promotional_price_cents, 18990);
  assert.equal(row.kind, 'integer');
  assert.equal(toCents(0.29), 29);
  assert.throws(() => toCents(1.234), ValidationError);
  assert.throws(() => validateProduct(input({ priceCents: '22990' })), ValidationError);
  assert.throws(() => validateProduct(input({ promotionalPriceCents: 22990 })), ValidationError);
  assert.throws(() => db.prepare('UPDATE products SET price_cents=12.5 WHERE id=?').run('vestido'), /cannot store|datatype/i);
  assert.throws(() => db.prepare('UPDATE products SET promotional_price_cents=price_cents WHERE id=?').run('vestido'), /CHECK/);
});

test('imagens possuem referência, alt, ordem e somente uma principal', async t => {
  const { db, service } = await fixture(t);
  const images = service.findProduct('vestido-midi-essencia').images;
  assert.equal(images.length, 2);
  assert.equal(images[0].primary, true);
  assert.equal(images[1].primary, false);
  assert.ok(images.every(image => image.id && image.productId && image.alt && image.reference.startsWith('illustration:')));
  assert.throws(() => db.prepare('UPDATE product_images SET is_primary=1 WHERE product_id=?').run('vestido'), /UNIQUE/);
  assert.throws(() => validateProduct(input({ images: [{ type: 'image', src: 'https://externo/imagem.jpg', alt: 'Exemplo' }] })), ValidationError);
});

test('criação interna é transacional: falha de imagem não deixa produto parcial', async t => {
  const { db, service } = await fixture(t);
  const originalId = db.prepare('SELECT id FROM product_images LIMIT 1').get().id;
  const custom = input({ id: 'partial', slug: 'partial' });
  custom.images[1].id = originalId;
  assert.throws(() => service.createProduct(custom), /UNIQUE/);
  assert.equal(db.prepare('SELECT id FROM products WHERE id=?').get('partial'), undefined);
  assert.equal(db.prepare('SELECT id FROM product_images WHERE product_id=?').get('partial'), undefined);
});

test('migrations aplicadas não são repetidas e checksum divergente é recusado', async t => {
  const { db, filename } = await fixture(t);
  migrate(db);
  assert.equal(counts(db).schema_migrations, 1);
  db.prepare('UPDATE schema_migrations SET checksum=?').run('alterado');
  assert.throws(() => openDatabase(filename), /modificada/);
  assert.equal(counts(db).products, 12);
});

test('API real retorna JSON de produtos, slug e categorias; inexistente retorna 404', async t => {
  const { api } = await fixture(t);
  const base = await api();
  const response = await fetch(base + '/api/products');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal((await response.json()).products.length, 12);
  assert.equal((await (await fetch(base + '/api/products/vestido-midi-essencia')).json()).product.id, 'vestido');
  assert.equal((await (await fetch(base + '/api/categories')).json()).categories.length, 5);
  const missing = await fetch(base + '/api/products/inexistente');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Produto não encontrado' });
});

test('API filtra resultados e não expõe produtos inativos por slug ou listagem', async t => {
  const { api, db } = await fixture(t);
  const base = await api();
  assert.equal((await (await fetch(base + '/api/products?category=vestidos&new=true')).json()).products.length, 1);
  assert.equal((await (await fetch(base + '/api/products?search=AMELIA')).json()).products[0].id, 'calca');
  db.prepare('UPDATE products SET active=0 WHERE id=?').run('vestido');
  assert.equal((await fetch(base + '/api/products/vestido-midi-essencia')).status, 404);
  assert.equal((await (await fetch(base + '/api/products')).json()).products.length, 11);
});

test('API valida parâmetros, recusa escrita e não serve arquivos internos', async t => {
  const { api } = await fixture(t);
  const base = await api();
  for (const suffix of ['?new=maybe', '?search=a&search=b', '?active=false', '?category=Vestidos', '/' + 'x'.repeat(121), '/bad%2Fslug', '/%E0%A4%A']) {
    assert.equal((await fetch(base + '/api/products' + suffix)).status, 400, suffix);
  }
  assert.equal((await fetch(base + '/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 404);
  for (const route of ['/.env', '/.env.example', '/data/maisbella.sqlite', '/src/config.js', '/package.json', '/api/inexistente']) assert.equal((await fetch(base + route)).status, 404, route);
});

test('API trata JSON inválido/body grande e envia headers compatíveis com a loja', async t => {
  const { api } = await fixture(t);
  const base = await api();
  const post = body => fetch(base + '/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  assert.equal((await post('{')).status, 400);
  assert.equal((await post(JSON.stringify({ text: 'x'.repeat(17000) }))).status, 413);
  const response = await fetch(base + '/');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const csp = response.headers.get('content-security-policy');
  assert.ok(csp.includes("script-src 'self'") && csp.includes('fonts.googleapis.com'));
  assert.ok(!csp.includes('upgrade-insecure-requests'));
  assert.equal(response.headers.get('strict-transport-security'), null);
});

test('erro 500 não revela stack, caminho ou detalhes internos', async t => {
  const { api } = await fixture(t, { service: { listProducts() { throw Error('/private/secret.sqlite SQL trace segredo'); } } });
  const response = await fetch(await api() + '/api/products');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Não foi possível concluir a solicitação' });
});

test('configuração proíbe banco dentro de public e respeita o modo de seed', () => {
  assert.throws(() => getConfig({ DB_PATH: 'public/catalog.sqlite' }), /public/);
  assert.throws(() => getConfig({ PORT: 'invalid' }), /PORT/);
  assert.throws(() => getConfig({ SEED_DEMO: 'yes' }), /SEED_DEMO/);
  assert.throws(() => getConfig({ NODE_ENV: 'production' }), /ADMIN/);
  assert.equal(getConfig({ NODE_ENV: 'development' }).seedDemo, true);
  assert.equal(getConfig({ SEED_DEMO: 'false' }).seedDemo, false);
});
