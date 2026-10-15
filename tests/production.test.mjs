import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { emptyCollectionMessage, hasDemoProducts } from '../public/js/commerce.mjs';
import { queryProducts } from '../public/js/catalog.mjs';
import { replaceCatalog, products, categories } from '../public/js/data/products.mjs';
import { cartContent } from '../public/js/cart-panel.mjs';
const require = createRequire(import.meta.url);
const { getConfig } = require('../src/config');
const { openDatabase } = require('../src/db/database');
const { seedDemo } = require('../src/db/seed');
const { createApp } = require('../src/app');
const { hashPassword, verifyPassword } = require('../src/services/password');
const { CredentialRepository } = require('../src/repositories/credential-repository');
const { cleanupDemo, existingDatabase, createBackup } = require('../src/services/production-maintenance');
const password = 'Senha inicial exclusiva para testes 010!';
const newPassword = 'Nova senha exclusiva para testes 010!';
const initialHash = await hashPassword(password);
function command(script, args, environment) {
  // Isola os comandos do .env real; mantém o parser/validação da configuração.
  const source = "require('./src/config').loadEnvironment=()=>{};process.argv=" + JSON.stringify([process.execPath, script, ...args]) + ";require('./" + script + "')";
  return spawnSync(process.execPath, ['-e', source], { env: environment, encoding: 'utf8' });
}
const env = { NODE_ENV: 'test', ADMIN_USER: 'admin-test', ADMIN_PASSWORD_HASH: initialHash, SESSION_SECRET: 'ab'.repeat(32), APP_ORIGIN: 'http://localhost:3000', SEED_DEMO: 'false' };
function database(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maisbella-production-'));
  const filename = path.join(directory, 'catalog.sqlite'); const db = openDatabase(filename);
  t.after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { directory, filename, db };
}
async function http(t, db, config = getConfig(env)) {
  const server = await new Promise(resolve => { const s = createApp({ db, config }).listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  let cookie = '', csrf = '';
  const request = (route, method = 'GET', body, headers = {}) => fetch(base + '/api/admin' + route, { method, headers: { origin: config.admin.origin, cookie, 'x-csrf-token': csrf, 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  async function login(value = password) {
    const r = await request('/login', 'POST', { username: env.ADMIN_USER, password: value });
    if (r.ok) { cookie = r.headers.get('set-cookie').split(';')[0]; csrf = (await r.json()).csrfToken; }
    return r;
  }
  return { base, request, login, cookie: () => cookie, csrf: () => csrf };
}

test('ambientes explícitos e seed opt-in; produção recusa demonstração e configuração insegura', () => {
  for (const NODE_ENV of ['development', 'test']) {
    assert.equal(getConfig({ NODE_ENV }).seedDemo, false);
    assert.equal(getConfig({ NODE_ENV, SEED_DEMO: 'true' }).seedDemo, true);
  }
  assert.throws(() => getConfig({ NODE_ENV: 'producao' }), /NODE_ENV/);
  const production = { ...env, NODE_ENV: 'production', APP_ORIGIN: 'https://loja.example' };
  assert.equal(getConfig(production).seedDemo, false);
  assert.throws(() => getConfig({ ...production, SEED_DEMO: 'true' }));
  assert.throws(() => getConfig({ ...production, TRUST_PROXY: 'true' }));
  assert.throws(() => getConfig({ ...production, APP_ORIGIN: 'http://loja.example' }));
});
test('seed explícito em desenvolvimento mantém IDs e é idempotente', async t => {
  const { db } = database(t); const config = getConfig({ NODE_ENV: 'development', SEED_DEMO: 'true' });
  if (config.seedDemo) assert.equal((await seedDemo(db)).inserted, 12);
  assert.equal((await seedDemo(db)).inserted, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM products WHERE demo=1').get().n, 12);
});
test('servidor em produção inicia com banco vazio sem criar demos e recusa seed por comando', async t => {
  const { directory, filename, db } = database(t);
  const childEnv = { ...process.env, ...env, NODE_ENV: 'production', APP_ORIGIN: 'https://loja.example', PORT: '0', DB_PATH: filename, UPLOAD_DIR: path.join(directory, 'uploads') };
  const result = spawnSync(process.execPath, ['-e', "require('./src/config').loadEnvironment=()=>{};require('./server').startServer().then(({server,db})=>server.close(()=>db.close()))"], { env: childEnv, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.ok(!result.stdout.includes('localhost'));
  assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n, 0);
  const seed = command('scripts/seed.js', [], childEnv);
  assert.equal(seed.status, 1); assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n, 0);
});
test('API vazia, produto inexistente e configuração pública de produção não vazam segredos', async t => {
  const { db } = database(t); const config = getConfig({ ...env, NODE_ENV: 'production', APP_ORIGIN: 'https://loja.example' });
  const f = await http(t, db, config);
  assert.deepEqual(await (await fetch(f.base + '/api/products')).json(), { products: [] });
  assert.deepEqual(await (await fetch(f.base + '/api/categories')).json(), { categories: [] });
  assert.equal((await fetch(f.base + '/api/products/inexistente')).status, 404);
  assert.deepEqual(await (await fetch(f.base + '/api/storefront-config')).json(), { developmentFeatures: false });
  for (const route of ['/.env', '/data/maisbella.sqlite', '/src/config.js', '/uploads/pending/foto.png', '/uploads/products/../../.env']) assert.equal((await fetch(f.base + route)).status, 404);
  const text = await (await f.request('/session')).text();
  assert.ok(!text.includes(initialHash)); assert.ok(!text.includes(env.SESSION_SECRET));
});
test('home e catálogo vazios têm mensagem amigável; filtros vazios e sacola vazia continuam seguros', () => {
  const before = [...products], beforeCategories = [...categories];
  try {
    replaceCatalog([], []);
    assert.deepEqual(queryProducts(products, { category: 'Inexistente', search: 'busca' }), []);
    assert.equal(emptyCollectionMessage(products, 'Sem resultados'), 'Novidades chegando em breve ♡');
    assert.equal(emptyCollectionMessage([{ active: true }], 'Sem resultados'), 'Sem resultados');
    assert.equal(hasDemoProducts(products), false);
    assert.ok(cartContent([]).includes('Sua sacola está esperando por você.'));
    for (const file of ['public/js/home.mjs', 'public/js/catalog-page.mjs']) assert.ok(fs.readFileSync(file, 'utf8').includes('emptyCollectionMessage(products,'));
    for (const file of ['public/index.html', 'public/catalogo.html']) assert.match(fs.readFileSync(file, 'utf8'), /class="newsletter" hidden/);
  } finally { replaceCatalog(before, beforeCategories); }
});
test('troca de senha exige sessão, CSRF, senha atual e confirmação; revoga sessões e persiste hash', async t => {
  const { db, filename } = database(t); const f = await http(t, db);
  const change = { currentPassword: password, newPassword, confirmation: newPassword };
  assert.equal((await f.request('/password', 'POST', change)).status, 401);
  await f.login();
  const anotherLogin = await f.request('/login', 'POST', { username: env.ADMIN_USER, password }, { cookie: '' });
  assert.equal(anotherLogin.status, 200); const otherCookie = anotherLogin.headers.get('set-cookie').split(';')[0];
  assert.equal((await f.request('/password', 'POST', change, { 'x-csrf-token': '' })).status, 403);
  assert.equal((await f.request('/password', 'POST', change, { origin: 'https://outro.example' })).status, 403);
  assert.equal((await f.request('/password', 'POST', { ...change, confirmation: 'diferente' })).status, 400);
  assert.equal((await f.request('/password', 'POST', { ...change, currentPassword: 'errada' })).status, 400);
  assert.equal((await f.request('/password', 'POST', { ...change, newPassword: 'curta', confirmation: 'curta' })).status, 400);
  const old = f.cookie(); const response = await f.request('/password', 'POST', change);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal((await f.request('/session')).status, 401);
  assert.equal((await f.request('/session', 'GET', undefined, { cookie: otherCookie })).status, 401);
  // Todas as sessões da única instância de produção são revogadas.
  assert.equal((await f.request('/session', 'GET', undefined, { cookie: old })).status, 401);
  const row = db.prepare('SELECT * FROM admin_credentials').get();
  assert.equal(await verifyPassword(newPassword, row.password_hash), true);
  assert.ok(!JSON.stringify(row).includes(newPassword));
  assert.equal((await f.login(password)).status, 401);
  const restarted = await http(t, db); assert.equal((await restarted.login(newPassword)).status, 200);
  const reopened = existingDatabase(filename);
  try { assert.equal(new CredentialRepository(reopened).hash(env.ADMIN_USER, initialHash), row.password_hash); } finally { reopened.close(); }
});
test('tentativas excessivas de senha atual incorreta são limitadas', async t => {
  const { db } = database(t); const f = await http(t, db); await f.login();
  for (let n=0;n<4;n++) assert.equal((await f.request('/password', 'POST', { currentPassword: 'errada', newPassword, confirmation: newPassword })).status, 400);
  assert.equal((await f.request('/password', 'POST', { currentPassword: password, newPassword, confirmation: newPassword })).status, 429);
});
test('cleanup dry-run não altera dados; aplicação só remove demo e preserva real, categoria e credencial', async t => {
  const { db } = database(t); await seedDemo(db);
  db.prepare("UPDATE products SET demo=0,name='Produto real preservado' WHERE id='vestido'").run();
  new CredentialRepository(db).save(env.ADMIN_USER, initialHash);
  const shared = db.prepare("SELECT reference FROM product_images WHERE product_id='vestido' LIMIT 1").get().reference;
  db.prepare("UPDATE product_images SET reference=? WHERE product_id='blusa'").run(shared);
  const report = cleanupDemo(db); assert.equal(report.products.length, 11); assert.equal(report.images.includes(shared), false);
  assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n, 12);
  for (const options of [{apply:true}, {apply:true,maintenance:true,confirmation:'REMOVE_DEMOS',seedDemo:true}, {apply:true,maintenance:true,confirmation:'errada'}]) assert.throws(() => cleanupDemo(db, options));
  const categories = db.prepare('SELECT count(*) AS n FROM categories').get().n;
  const result = cleanupDemo(db, { apply:true, maintenance:true, confirmation:'REMOVE_DEMOS' }); assert.equal(result.apply, true);
  assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n, 1);
  assert.equal(db.prepare('SELECT demo FROM products').get().demo, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM categories').get().n, categories);
  assert.equal(new CredentialRepository(db).hash(env.ADMIN_USER, ''), initialHash);
  assert.equal((await seedDemo(db)).inserted, 0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
test('comando de cleanup exige ação explícita e simulação não modifica o banco', async t => {
  const { db, filename, directory } = database(t); await seedDemo(db);
  const childEnv = { ...process.env, ...env, DB_PATH: filename, UPLOAD_DIR: path.join(directory, 'uploads') };
  for (const args of [[], ['--apply'], ['--dry-run','--apply'], ['--dry-run','--inválido']]) {
    const r = command('scripts/production-cleanup.js', args, childEnv); assert.equal(r.status, 1);
  }
  const r = command('scripts/production-cleanup.js', ['--dry-run'], childEnv);
  assert.equal(r.status,0,r.stderr); assert.equal(JSON.parse(r.stdout).products.length,12);
  assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n,12);
});
test('backup copia SQLite consistente e só uploads referenciados; recusa destino inseguro e sobrescrita', async t => {
  const { db, filename, directory } = database(t); await seedDemo(db);
  const uploadsPath = path.join(directory,'uploads'); fs.mkdirSync(path.join(uploadsPath,'products'),{recursive:true});
  const filenamePhoto = 'b'.repeat(32)+'.png'; const bytes = Buffer.from('fixture de arquivo, não é servido');
  fs.writeFileSync(path.join(uploadsPath,'products',filenamePhoto),bytes);
  fs.writeFileSync(path.join(uploadsPath,'products','orphan.png'),'não copiar');
  fs.writeFileSync(path.join(directory,'.env'),'não copiar');
  db.prepare("UPDATE product_images SET kind='image',reference=? WHERE id=(SELECT id FROM product_images LIMIT 1)").run('/uploads/products/'+filenamePhoto);
  const backupRoot=fs.mkdtempSync(path.join(os.tmpdir(),'maisbella-backup-'));
  t.after(()=>fs.rmSync(backupRoot,{recursive:true,force:true}));
  const target=path.join(backupRoot,'snapshot'); const config={databasePath:filename,uploadsPath};
  const previous=process.env.MAINTENANCE_MODE;
  try {
    delete process.env.MAINTENANCE_MODE; await assert.rejects(createBackup(config,target));
    process.env.MAINTENANCE_MODE='true';
    await assert.rejects(createBackup(config,path.join(directory,'unsafe')));
    const result=await createBackup(config,target); assert.equal(result.photos,1);
    assert.equal(fs.existsSync(path.join(target,'INCOMPLETO')),false);
    assert.deepEqual(fs.readdirSync(target).sort(),['catalog.sqlite','manifest.json','uploads']);
    assert.deepEqual(fs.readFileSync(path.join(target,'uploads','products',filenamePhoto)),bytes);
    assert.deepEqual(fs.readdirSync(path.join(target,'uploads','products')),[filenamePhoto]);
    const snapshot=existingDatabase(path.join(target,'catalog.sqlite'));
    try { assert.equal(snapshot.prepare('SELECT count(*) AS n FROM products').get().n,12); } finally {snapshot.close();}
    await assert.rejects(createBackup(config,target));
  } finally { if(previous===undefined) delete process.env.MAINTENANCE_MODE; else process.env.MAINTENANCE_MODE=previous; }
});

test('erro inesperado produz resposta e log úteis sem senha, hash, cookie, token ou dados pessoais', () => {
  const { errorHandler } = require('../src/middleware/error-handler');
  const secrets = [password, initialHash, env.SESSION_SECRET, 'cookie privado', 'token privado', 'Cliente privado'];
  const logs = [], original = console.error;
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    console.error = value => logs.push(value);
    errorHandler(new Error(secrets.join(' ') + ' /caminho/interno stack trace'), { method: 'POST', route: { path: '/products/:id' }, body: { password, name: secrets[5] }, headers: { cookie: secrets[3] } }, response, () => assert.fail('Não deve delegar'));
  } finally { console.error = original; }
  assert.equal(response.code, 500); assert.equal(logs.length, 1);
  assert.equal(JSON.parse(logs[0]).operation, '/products/:id');
  for (const secret of [...secrets, '/caminho/interno', 'stack trace']) assert.ok(!JSON.stringify([response.body, logs]).includes(secret));
});
test('login em andamento com hash anterior não cria acesso após troca de senha', async () => {
  const { AdminAuth } = require('../src/services/admin-auth');
  const config = { user: env.ADMIN_USER, passwordHash: initialHash, secret: env.SESSION_SECRET, sessionMs: 1000 };
  const replacement = await hashPassword(newPassword);
  const auth = new AdminAuth(config);
  const pending = auth.login('ip', env.ADMIN_USER, password);
  config.passwordHash = replacement;
  assert.equal(await pending, false);
});
