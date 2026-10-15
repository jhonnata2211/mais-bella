import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pngImage, jpegImage, webpImage } from './helpers/image-fixture.mjs';
import { productVisual, productCard } from '../public/js/products.mjs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');
const { getConfig } = require('../src/config');
const { hashPassword } = require('../src/services/password');
const { validateImage, MAX_IMAGE_BYTES } = require('../src/services/image-validation');
const { MediaService, PENDING_TTL } = require('../src/services/media-service');
const password = 'Senha temporária para testes de fotos!';
const hash = await hashPassword(password);
async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maisbella-media-'));
  const uploadsPath = path.join(dir, 'photos');
  const config = getConfig({ ADMIN_USER: 'teste', ADMIN_PASSWORD_HASH: hash, SESSION_SECRET: 'af'.repeat(32), APP_ORIGIN: 'http://localhost:3000', SEED_DEMO: 'false', UPLOAD_DIR: uploadsPath });
  const db = openDatabase(path.join(dir, 'catalog.sqlite'));
  const server = await new Promise(resolve => { const s = createApp({ db, config }).listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + server.address().port;
  let cookie = '', csrf = '';
  async function api(route, method = 'GET', body, headers = {}) {
    return fetch(base + '/api/admin' + route, { method, headers: { origin: config.admin.origin, cookie, 'x-csrf-token': csrf, ...(body === undefined ? {} : { 'content-type': Buffer.isBuffer(body) ? 'image/png' : 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }) });
  }
  async function login() { const r = await api('/login', 'POST', { username: 'teste', password }); assert.equal(r.status, 200); cookie = r.headers.get('set-cookie').split(';')[0]; csrf = (await r.json()).csrfToken; }
  const category = { id: 'roupas', name: 'Roupas', slug: 'roupas' };
  async function setup() { await login(); assert.equal((await api('/categories', 'POST', category)).status, 201); }
  async function upload(buffer = pngImage(), headers, query = '') { return api('/images' + query, 'POST', buffer, headers); }
  async function staged() { const r = await upload(); assert.equal(r.status, 201); return (await r.json()).image; }
  return { dir, uploadsPath, db, base, api, login, setup, upload, staged, media: new MediaService(uploadsPath) };
}
function product(images) {
  return { id: 'peca', slug: 'peca', name: 'Roupa do teste', shortDescription: 'Descrição curta', description: 'Descrição completa', categoryId: 'roupas', priceCents: 15990, active: true, featured: false, isNew: false, bestSeller: false, images, variations: [{ color: 'Azul', size: 'M', stock: 4 }] };
}
const gallery = images => images.map((image, index) => ({ ...image, primary: index === 0, order: index, alt: 'Foto da peça ' + (index + 1) }));
const pendingFiles = f => fs.existsSync(path.join(f.uploadsPath, 'pending')) ? fs.readdirSync(path.join(f.uploadsPath, 'pending')) : [];
const publishedFiles = f => fs.existsSync(path.join(f.uploadsPath, 'products')) ? fs.readdirSync(path.join(f.uploadsPath, 'products')) : [];

test('conteúdo: JPEG, PNG e WebP reconhecidos pelos bytes reais', () => {
  assert.equal(validateImage(pngImage(), 'image/png'), 'png'); assert.equal(validateImage(jpegImage, 'image/jpeg'), 'jpg'); assert.equal(validateImage(webpImage, 'image/webp'), 'webp');
});
test('conteúdo: extensão/MIME falso, assinatura isolada, corrupção, truncamento e arquivo arbitrário recusados', () => {
  for (const data of [Buffer.from('<html><script>evil()</script></html>'), Buffer.from('<svg onload="evil()"/>'), Buffer.from('console.log(1)'), pngImage().subarray(0, 33), Buffer.concat([pngImage(), Buffer.from('<script>evil()</script>')])]) assert.throws(() => validateImage(data, 'image/png'));
  const corrupt = pngImage(); corrupt[45] ^= 1; assert.throws(() => validateImage(corrupt, 'image/png'));
  assert.throws(() => validateImage(pngImage(), 'image/jpeg'));
  assert.throws(() => validateImage(webpImage.subarray(0, 20), 'image/webp'));
  assert.throws(() => validateImage(jpegImage.subarray(0, -2), 'image/jpeg'));
  assert.throws(() => validateImage(pngImage(10001, 1), 'image/png'), /resolução/);
  assert.throws(() => validateImage(pngImage(9000, 9000), 'image/png'), /resolução/);
});
test('upload sem autenticação, sem CSRF ou de origem externa não grava arquivos', async t => {
  const f = await fixture(t);
  assert.equal((await f.upload()).status, 401);
  await f.login();
  assert.equal((await f.upload(pngImage(), { 'x-csrf-token': '' })).status, 403);
  assert.equal((await f.upload(pngImage(), { origin: 'https://malicioso.example' })).status, 403);
  assert.deepEqual(pendingFiles(f), []); assert.deepEqual(publishedFiles(f), []);
});
test('upload limita bytes, recusa MIME proibido e mantém erros compreensíveis', async t => {
  const f = await fixture(t); await f.login();
  const huge = await f.upload(Buffer.alloc(MAX_IMAGE_BYTES + 1)); assert.equal(huge.status, 413); assert.match((await huge.json()).error, /muito grande/);
  for (const mime of ['text/html', 'image/svg+xml', 'application/javascript', 'application/octet-stream', 'multipart/form-data']) assert.equal((await f.upload(Buffer.from('abc'), { 'content-type': mime })).status, 400);
  assert.equal((await f.upload(Buffer.from('<html>malicioso</html>'))).status, 400);
  assert.equal((await f.upload(pngImage(), { 'content-type': 'image/webp' })).status, 400);
  assert.equal((await f.upload(Buffer.alloc(0))).status, 400);
  assert.deepEqual(pendingFiles(f), []);
});
test('upload válido fica temporário, com nomes aleatórios sem influência do nome original', async t => {
  const f = await fixture(t); await f.login();
  const r = await f.upload(pngImage(), { 'x-file-name': '../../server.js', 'content-disposition': 'attachment; filename="../../../.env"' });
  assert.equal(r.status, 201); const image = (await r.json()).image;
  assert.match(image.src, /^\/uploads\/products\/[a-f0-9]{32}\.png$/); assert.match(image.id, /^[a-f0-9]{32}$/);
  assert.notEqual(image.src, (await f.staged()).src);
  assert.equal((await fetch(f.base + image.src)).status, 404);
  assert.equal((await fetch(f.base + '/data/uploads/pending/' + path.basename(image.src))).status, 404);
  assert.equal(pendingFiles(f).length, 2); assert.deepEqual(publishedFiles(f), []);
});
test('consulta opcional do produto recusa inexistente antes de receber foto', async t => {
  const f = await fixture(t); await f.login();
  assert.equal((await f.upload(pngImage(), {}, '?productId=inexistente')).status, 404);
  assert.equal((await f.upload(pngImage(), {}, '?productId=a&productId=b')).status, 400);
  assert.deepEqual(pendingFiles(f), []);
});
test('criação associa múltiplas fotos com produto, alt, ordem e principal no SQLite', async t => {
  const f = await fixture(t); await f.setup();
  const first = await f.staged(); const secondResponse = await f.upload(webpImage, { 'content-type': 'image/webp' }); assert.equal(secondResponse.status, 201);
  const second = (await secondResponse.json()).image;
  const images = gallery([first, second]); const r = await f.api('/products', 'POST', product(images));
  assert.equal(r.status, 201); const p = (await r.json()).product;
  assert.equal(p.images.length, 2); assert.equal(p.images[0].src, first.src); assert.equal(p.images[0].primary, true); assert.equal(p.images[1].alt, 'Foto da peça 2'); assert.equal(p.images[1].order, 1);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM product_images WHERE product_id=?').get('peca').n, 2);
  assert.deepEqual(pendingFiles(f), []); assert.equal(publishedFiles(f).length, 2);
  for (const image of p.images) { const response = await fetch(f.base + image.src); assert.equal(response.status, 200); assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('content-type'), image.src.endsWith('.webp') ? 'image/webp' : 'image/png'); }
  const fromPublic = (await (await fetch(f.base + '/api/products/peca')).json()).product; assert.equal(fromPublic.images[0].src, first.src);
  assert.match(productVisual(fromPublic.images[0], fromPublic.name), /<img src="\/uploads\/products\//);
  assert.match(productCard(fromPublic), /<img src="\/uploads\/products\//);
});
test('edição preserva anteriores, adiciona foto, troca principal e remove sem alterar estoque/preço', async t => {
  const f = await fixture(t); await f.setup();
  const original = gallery([await f.staged(), await f.staged()]); assert.equal((await f.api('/products', 'POST', product(original))).status, 201);
  const next = (await (await f.upload(jpegImage, { 'content-type': 'image/jpeg' }, '?productId=peca')).json()).image;
  let images = gallery([...original, next]); images = images.map((image, index) => ({ ...image, primary: index === 2 }));
  let r = await f.api('/products/peca', 'PUT', product(images)); assert.equal(r.status, 200); let p = (await r.json()).product;
  assert.equal(p.images.length, 3); assert.equal(p.images[0].src, next.src); assert.equal(p.images.filter(image => image.primary).length, 1);
  assert.equal(p.priceCents, 15990); assert.equal(p.variations[0].stock, 4);
  images = p.images.filter(image => image.src !== original[0].src);
  r = await f.api('/products/peca', 'PUT', product(images)); assert.equal(r.status, 200); p = (await r.json()).product;
  assert.equal(p.images.length, 2); assert.equal((await fetch(f.base + original[0].src)).status, 404);
  assert.equal((await fetch(f.base + next.src)).status, 200);
});
test('limite de 20 imagens é validado no servidor antes de publicar arquivos', async t => {
  const f = await fixture(t); await f.setup(); const image = await f.staged();
  const images = Array.from({ length: 21 }, (_, i) => ({ ...image, id: 'foto-' + i, primary: i === 0, order: i }));
  assert.equal((await f.api('/products', 'POST', product(images))).status, 400); assert.deepEqual(publishedFiles(f), []); assert.equal(pendingFiles(f).length, 1);
  const twenty = Array.from({ length: 20 }, (_, i) => ({ type: 'image', src: '/assets/preparada.webp', alt: 'Foto preparada', id: 'foto-' + i, primary: i === 0, order: i }));
  assert.equal((await f.api('/products', 'POST', product(twenty))).status, 201);
});
test('referências falsas, traversal, ID duplicado e principal inválida são recusados sem publicação', async t => {
  const f = await fixture(t); await f.setup(); const image = await f.staged();
  for (const src of ['/uploads/products/../../server.js', '/uploads/products/arquivo.svg', '/uploads/pending/' + path.basename(image.src), '/uploads/products/' + 'b'.repeat(32) + '.png']) assert.equal((await f.api('/products', 'POST', product([{ ...image, src }]))).status, 400);
  assert.equal((await f.api('/products', 'POST', product([{ ...image, primary: false }]))).status, 400);
  assert.equal((await f.api('/products', 'POST', product([{ ...image, primary: true }, { ...image, primary: true }]))).status, 400);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM products').get().n, 0); assert.deepEqual(publishedFiles(f), []);
});
test('falha transacional reverte banco e publicação, mantendo temporário para tentar novamente', async t => {
  const f = await fixture(t); await f.setup();
  await f.api('/products', 'POST', product([{ type: 'image', src: '/assets/foto.webp', alt: 'Anterior' }]));
  const image = await f.staged();
  f.db.exec("CREATE TRIGGER reject_new_photo BEFORE INSERT ON product_images WHEN NEW.reference LIKE '/uploads/%' BEGIN SELECT RAISE(ABORT, '/private/secret.db SQL stack'); END");
  const response = await f.api('/products/peca', 'PUT', { ...product(gallery([image])), name: 'Não persistir' });
  assert.equal(response.status, 500); assert.deepEqual(await response.json(), { error: 'Não foi possível concluir a solicitação' });
  assert.equal(f.db.prepare('SELECT name FROM products').get().name, 'Roupa do teste'); assert.equal(f.db.prepare('SELECT reference FROM product_images').get().reference, '/assets/foto.webp');
  assert.deepEqual(publishedFiles(f), []); assert.equal(pendingFiles(f).length, 1);
  f.db.exec('DROP TRIGGER reject_new_photo'); assert.equal((await f.api('/products/peca', 'PUT', product(gallery([image])))).status, 200); assert.equal(publishedFiles(f).length, 1);
});
test('falha ao preparar a segunda imagem remove a primeira cópia sem perder temporários', async t => {
  const f = await fixture(t); await f.setup(); const first = await f.staged();
  const fake = { ...first, id: 'outra', src: '/uploads/products/' + 'c'.repeat(32) + '.png' };
  assert.equal((await f.api('/products', 'POST', product(gallery([first, fake])))).status, 400);
  assert.deepEqual(publishedFiles(f), []); assert.equal(pendingFiles(f).length, 1); assert.equal(f.db.prepare('SELECT count(*) AS n FROM products').get().n, 0);
});
test('imagens publicadas de outro produto não são reutilizadas por referência fabricada', async t => {
  const f = await fixture(t); await f.setup(); const image = await f.staged();
  await f.api('/products', 'POST', product(gallery([image])));
  assert.equal((await f.api('/products', 'POST', { ...product(gallery([image])), id: 'outra', slug: 'outra' })).status, 400);
  assert.equal((await fetch(f.base + image.src)).status, 200);
});
test('limpeza preserva fotos referenciadas/recentes e só remove órfãs antigas com aplicação explícita', async t => {
  const f = await fixture(t); await f.setup();
  const live = await f.staged(), removed = await f.staged(), abandoned = await f.staged();
  await f.api('/products', 'POST', product(gallery([live, removed])));
  await f.api('/products/peca', 'PUT', product(gallery([live])));
  const past = new Date(Date.now() - PENDING_TTL - 10000);
  for (const [directory, image] of [['products', live], ['products', removed], ['pending', abandoned]]) fs.utimesSync(path.join(f.uploadsPath, directory, path.basename(image.src)), past, past);
  await f.staged();
  assert.deepEqual(f.media.cleanup(f.db), { apply: false, count: 2 }); assert.equal(pendingFiles(f).length, 2);
  assert.deepEqual(f.media.cleanup(f.db, true), { apply: true, count: 2 }); assert.equal(pendingFiles(f).length, 1); assert.equal(publishedFiles(f).length, 1);
  assert.equal((await fetch(f.base + live.src)).status, 200);
});
test('upload e diretórios não abrem escrita pública nem expõem arquivos internos', async t => {
  const f = await fixture(t); await f.login();
  for (const route of ['/uploads/products/arquivo.html', '/uploads/pending/a.png', '/data/uploads/.gitkeep', '/uploads/products/%2e%2e%2fserver.js']) assert.equal((await fetch(f.base + route)).status, 404);
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await fetch(f.base + '/uploads/products/' + 'a'.repeat(32) + '.png', { method, body: pngImage(), headers: { 'content-type': 'image/png' } })).status, 404);
  assert.throws(() => getConfig({ UPLOAD_DIR: 'public/uploads' }), /fora de public/);
});
test('temporários expirados, repetição de foto e quota de pendentes são recusados', async t => {
  const f = await fixture(t); await f.setup(); const image = await f.staged();
  const repeated = gallery([image, { ...image, id: 'outra-id' }]);
  assert.equal((await f.api('/products', 'POST', product(repeated))).status, 400); assert.deepEqual(publishedFiles(f), []);
  const past = new Date(Date.now() - PENDING_TTL - 10000); fs.utimesSync(path.join(f.media.pending, path.basename(image.src)), past, past);
  const expired = await f.api('/products', 'POST', product(gallery([image]))); assert.equal(expired.status, 400); assert.match((await expired.json()).error, /expirou/);
  for (let i = 1; i <= 199; i++) fs.writeFileSync(path.join(f.media.pending, i.toString(16).padStart(32, '0') + '.png'), 'fixture');
  const limited = await f.upload(); assert.equal(limited.status, 400); assert.match((await limited.json()).error, /muitas fotos/); assert.equal(pendingFiles(f).length, 200);
});
