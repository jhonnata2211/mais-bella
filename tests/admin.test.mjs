import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { hashPassword, verifyPassword } = require('../src/services/password');
const { getConfig } = require('../src/config');
const { openDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');
const { AdminAuth } = require('../src/services/admin-auth');
const password = 'Senha exclusiva dos testes 006!';
const hash = await hashPassword(password);
const env = { ADMIN_USER:'administradora', ADMIN_PASSWORD_HASH:hash, SESSION_SECRET:'a1'.repeat(32), APP_ORIGIN:'http://localhost:3000', SEED_DEMO:'false' };
async function fixture(t, config = getConfig(env)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'maisbella-admin-'));
  const filename = path.join(dir,'catalog.sqlite');
  const db = openDatabase(filename);
  const app = createApp({ db,config });
  const server = await new Promise(resolve => { const s = app.listen(0,'127.0.0.1',() => resolve(s)); });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(dir,{ recursive:true, force:true }); });
  const base = 'http://127.0.0.1:' + server.address().port;
  let cookie='', csrf='';
  async function request(route, method='GET', body, headers={}) {
    return fetch(base + '/api/admin' + route,{ method,headers:{ origin:config.admin.origin, cookie, 'x-csrf-token':csrf, 'content-type':'application/json', ...headers },...(body === undefined ? {} : { body:JSON.stringify(body) }) });
  }
  async function login() { const r = await request('/login','POST',{ username:env.ADMIN_USER,password }); assert.equal(r.status,200); cookie=r.headers.get('set-cookie').split(';')[0]; csrf=(await r.json()).csrfToken; return r; }
  return { db,filename,base,request,login, cookie:() => cookie, csrf:() => csrf };
}
const category = { id:'roupas',slug:'roupas',name:'Roupas',active:true };
function product() { return { id:'peca',slug:'peca',name:'Peça cadastrada pelo teste',shortDescription:'Descrição curta',description:'Descrição completa',categoryId:'roupas',priceCents:12590,promotionalPriceCents:11000,active:true,featured:false,isNew:false,bestSeller:false,images:[{type:'image',src:'/assets/peca.webp',alt:'Peça'}],variations:[{color:'Azul',size:'M',stock:3},{color:'Azul',size:'G',stock:0,active:false}] }; }

test('hash scrypt com sal aleatório e senha nunca armazenada em texto', async () => { assert.notEqual(hash,await hashPassword(password)); assert.ok(!hash.includes(password)); assert.equal(await verifyPassword(password,hash),true); assert.equal(await verifyPassword('incorreta',hash),false); assert.equal(await verifyPassword(password,'inválido'),false); await assert.rejects(hashPassword('curta')); });
test('login inválido, válido, sessão, fixação e logout invalidando token', async t => {
  const f=await fixture(t);
  assert.equal((await f.request('/session')).status,401);
  assert.equal((await f.request('/login','POST',{username:env.ADMIN_USER,password:'errada'})).status,401);
  assert.equal((await f.request('/login','POST',{username:'outro',password})).status,401);
  const login=await f.login(); const header=login.headers.get('set-cookie'); assert.match(header,/HttpOnly/); assert.match(header,/SameSite=Strict/); assert.match(header,/Max-Age=1800/);
  assert.equal((await f.request('/session')).status,200);
  const old=f.cookie(); await f.login(); assert.notEqual(f.cookie(),old);
  assert.equal((await f.request('/session','GET',undefined,{cookie:old})).status,401);
  const current=f.cookie(); assert.equal((await f.request('/logout','POST',{})).status,200);
  assert.equal((await f.request('/session','GET',undefined,{cookie:current})).status,401);
});
test('sessão expira no serviço e por HTTP sem renovação silenciosa', async t => {
  let now=1000; const auth=new AdminAuth(getConfig(env).admin,() => now); const s=auth.create(); now+=1800000; assert.equal(auth.session(s.token),undefined);
  const config=getConfig(env); config.admin.sessionMs=30;
  const f=await fixture(t,config); await f.login(); await new Promise(resolve => setTimeout(resolve,50)); assert.equal((await f.request('/session')).status,401);
});
test('todas as operações administrativas exigem sessão', async t => {
  const f=await fixture(t);
  for (const [route,method] of [['/products','GET'],['/products/id','GET'],['/products','POST'],['/products/id','PUT'],['/categories','GET'],['/categories','POST'],['/categories/id','PUT'],['/logout','POST']]) assert.equal((await f.request(route,method,method === 'GET' ? undefined : {})).status,401,method+route);
});
test('limite de login bloqueia inclusive senha correta e não confia em X-Forwarded-For', async t => {
  const f=await fixture(t);
  for (let i=0;i<5;i++) assert.equal((await f.request('/login','POST',{username:env.ADMIN_USER,password:'errada'},{'x-forwarded-for':'10.0.0.'+i})).status,401);
  const r=await f.request('/login','POST',{username:env.ADMIN_USER,password}); assert.equal(r.status,429); assert.equal(r.headers.get('retry-after'),'900');
  let now=0; const auth=new AdminAuth(getConfig(env).admin,()=>now); for(let i=0;i<5;i++) await auth.login('ip','x','errada'); assert.equal(await auth.login('ip',env.ADMIN_USER,password),'limited'); now=900001; assert.equal(await auth.login('ip',env.ADMIN_USER,password),true);
});
test('CSRF: origem, JSON e token obrigatórios; login cross-site recusado', async t => {
  const f=await fixture(t);
  for(const origin of ['https://malicioso.example','null','']) assert.equal((await f.request('/login','POST',{username:env.ADMIN_USER,password},{origin})).status,403);
  await f.login();
  for(const headers of [{'x-csrf-token':''},{'x-csrf-token':'forjado'},{origin:'https://outro.example'},{'content-type':'text/plain'}]) assert.equal((await f.request('/categories','POST',category,headers)).status,403);
  assert.equal((await f.request('/logout','POST',{}, {'x-csrf-token':''})).status,403);
  assert.equal((await f.request('/session')).status,200);
});
test('criar, consultar, editar, desativar e reabrir SQLite preserva dados e marca demo', async t => {
  const f=await fixture(t); await f.login();
  assert.equal((await f.request('/categories','POST',category)).status,201);
  let p=product(); assert.equal((await f.request('/products','POST',{...p,demo:true})).status,201);
  p=(await (await f.request('/products/peca')).json()).product; assert.equal(p.demo,false); assert.equal(p.variations.length,2); assert.equal(p.variations[1].active,false);
  const publicProduct=(await (await fetch(f.base+'/api/products/peca')).json()).product; assert.equal(publicProduct.variations.length,1);
  p={...p,name:'Nome editado',priceCents:13990,promotionalPriceCents:null,active:false,variations:[{...p.variations[0],stock:8}]};
  assert.equal((await f.request('/products/peca','PUT',p)).status,200);
  assert.equal((await fetch(f.base+'/api/products/peca')).status,404);
  const reopened=openDatabase(f.filename); try { const row=reopened.prepare('SELECT * FROM products WHERE id=?').get('peca'); assert.equal(row.price_cents,13990); assert.equal(row.name,'Nome editado'); assert.equal(reopened.prepare('SELECT stock FROM product_variations WHERE product_id=?').get('peca').stock,8); } finally {reopened.close();}
  p.active=true; assert.equal((await f.request('/products/peca','PUT',p)).status,200);
  assert.equal((await fetch(f.base+'/api/products/peca')).status,200);
  assert.equal((await f.request('/categories/roupas','PUT',{...category,name:'Categoria editada',active:false})).status,200);
  assert.equal((await fetch(f.base+'/api/products/peca')).status,404);
  assert.equal((await (await f.request('/products')).json()).products.length,1);
});
test('validação HTTP de categorias, preços, promoções, estoque e identidade', async t => {
  const f=await fixture(t); await f.login();
  for(const bad of [{...category,name:''},{...category,slug:'ERRO'},{...category,active:'true'},{...category,sortOrder:-1}]) assert.equal((await f.request('/categories','POST',bad)).status,400);
  await f.request('/categories','POST',category);
  for(const changes of [{priceCents:-1},{priceCents:1.5},{priceCents:'100'},{promotionalPriceCents:12590},{categoryId:'inexistente'},{active:1},{variations:[{color:'A',size:'M',stock:-1}]},{variations:[{color:'A',size:'M',stock:1.5}]},{variations:[{color:'A',size:'M',stock:1000001}]},{variations:[{color:'A',size:'M',stock:'2'}]}]) assert.equal((await f.request('/products','POST',{...product(),...changes})).status,400,JSON.stringify(changes));
  assert.equal((await f.request('/products','POST',product())).status,201);
  assert.equal((await f.request('/products','POST',product())).status,400);
  assert.equal((await f.request('/categories','POST',category)).status,400);
  assert.equal((await f.request('/products/peca','PUT',{...product(),id:'alterado'})).status,400);
  assert.equal((await f.request('/categories/roupas','PUT',{...category,id:'alterado'})).status,400);
  assert.equal((await f.request('/products/inexistente')).status,404);
});
test('edição é transacional: conflito de variação reverte produto e filhos', async t => {
  const f=await fixture(t); await f.login(); await f.request('/categories','POST',category); await f.request('/products','POST',product());
  await f.request('/products','POST',{...product(),id:'segunda',slug:'segunda',variations:[{id:'ocupado',color:'Preto',size:'P',stock:2}]});
  const r=await f.request('/products/peca','PUT',{...product(),name:'Não persistir',variations:[{id:'ocupado',color:'A',size:'M',stock:1}]}); assert.equal(r.status,400);
  const p=(await (await f.request('/products/peca')).json()).product; assert.equal(p.name,product().name); assert.equal(p.variations.length,2); assert.equal(p.priceCents,12590);
});
test('API pública recusa escrita de preço/estoque mesmo com sessão de admin', async t => {
  const f=await fixture(t); await f.login(); await f.request('/categories','POST',category); await f.request('/products','POST',product());
  for (const route of ['/api/products','/api/products/peca','/api/categories']) for(const method of ['POST','PUT','PATCH','DELETE']) assert.equal((await fetch(f.base+route,{method,headers:{'content-type':'application/json',cookie:f.cookie()},body:JSON.stringify({priceCents:1,stock:999})})).status,404);
  assert.equal(f.db.prepare('SELECT price_cents FROM products').get().price_cents,12590);
});
test('produção recusa configuração insegura e exige HTTPS; cookies seguros e HSTS', async t => {
  for(const changes of [{ADMIN_USER:''},{ADMIN_PASSWORD_HASH:'texto'},{SESSION_SECRET:'curto'},{APP_ORIGIN:'http://loja.example'},{APP_ORIGIN:''},{SEED_DEMO:'true'},{TRUST_PROXY:'true'}]) assert.throws(()=>getConfig({...env,NODE_ENV:'production',APP_ORIGIN:'https://loja.example',...changes}));
  const config=getConfig({...env,NODE_ENV:'production',APP_ORIGIN:'https://loja.example',TRUST_PROXY:'loopback'}); assert.equal(config.seedDemo,false);
  const f=await fixture(t,config); assert.equal((await f.request('/session')).status,403);
  const response=await f.request('/login','POST',{username:env.ADMIN_USER,password},{'x-forwarded-proto':'https'}); assert.equal(response.status,200);
  assert.match(response.headers.get('set-cookie'),/__Host-mb_admin=.*Secure.*SameSite=Strict/); assert.ok(response.headers.get('strict-transport-security')); assert.match(response.headers.get('content-security-policy'),/upgrade-insecure-requests/);
});
test('admin desativado sem credenciais; erros sem detalhes internos e arquivos privados inacessíveis', async t => {
  const f=await fixture(t,getConfig({SEED_DEMO:'false'})); assert.equal((await f.request('/session')).status,503);
  const r=await fetch(f.base+'/admin.html'); assert.equal(r.status,200);
  for(const route of ['/.env','/src/services/admin-auth.js','/data/catalog.sqlite']) assert.equal((await fetch(f.base+route)).status,404);
});
test('erros administrativos inesperados não expõem segredo, SQL, caminho ou stack', async t => {
  const f=await fixture(t); await f.login();
  f.db.exec("CREATE TRIGGER reject_category BEFORE INSERT ON categories BEGIN SELECT RAISE(ABORT, '/private/secret.db SQL stack SESSION_SECRET'); END");
  const response=await f.request('/categories','POST',category);
  assert.equal(response.status,500); assert.deepEqual(await response.json(),{error:'Não foi possível concluir a solicitação'});
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM categories').get().n,0);
});
test('renovação de login preserva proteção CSRF e marca demonstrativa não é removida na edição', async t => {
  const f=await fixture(t); await f.login(); await f.request('/categories','POST',category); await f.request('/products','POST',product());
  f.db.prepare('UPDATE products SET demo=1 WHERE id=?').run('peca');
  const oldCsrf=f.csrf(); await f.login();
  assert.equal((await f.request('/products/peca','PUT',product(),{'x-csrf-token':oldCsrf})).status,403);
  const r=await f.request('/products/peca','PUT',{...product(),demo:false}); assert.equal(r.status,200); assert.equal((await r.json()).product.demo,true);
});
