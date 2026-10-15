import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getConfig } = require('../src/config');
const { openDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/services/password');
const password = 'Senha sintética para testes do proxy 011!';
const hash = await hashPassword(password);
const origin = 'https://mais-bella-production.up.railway.app';
const env = { NODE_ENV: 'production', SEED_DEMO: 'false', APP_ORIGIN: origin, ADMIN_USER: 'admin-test', ADMIN_PASSWORD_HASH: hash, SESSION_SECRET: 'cd'.repeat(32) };
const railway = { ...env, TRUST_PROXY: 'railway', RAILWAY_PROJECT_ID: 'project-test', RAILWAY_SERVICE_ID: 'service-test' };
async function listen(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { server, base: 'http://127.0.0.1:' + server.address().port };
}
async function application(t, settings, peer) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const app = createApp({ db, config: getConfig(settings) });
  const target = await listen(t, (req,res) => {
    // Somente o harness substitui o peer do socket para simular rede não loopback.
    // Headers não podem substituir esse endereço na aplicação real.
    if (peer) Object.defineProperty(req.socket, 'remoteAddress', { value: peer, configurable: true });
    app(req,res);
  });
  return { ...target, app };
}
async function ingress(t, target, { proto = 'https', realIP = '198.51.100.42' } = {}) {
  // Emula o contrato do ingresso HTTP Railway: TLS é terminado antes do Node,
  // protocolo e IP remoto são substituídos, mesmo se o cliente os falsificar.
  return listen(t, (req,res) => {
    const headers = { ...req.headers, 'x-forwarded-proto': proto };
    if (realIP === null) delete headers['x-real-ip']; else headers['x-real-ip'] = realIP;
    const upstream = http.request(target.base + req.url, { method: req.method, headers }, result => {
      res.writeHead(result.statusCode, result.headers); result.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
}
const request = (base, route, method = 'GET', body, headers = {}) => fetch(base + '/api/admin' + route, { method, headers: { origin, 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

test('proxy Railway é opt-in, exige runtime de produção e recusa TCP Proxy e confiança irrestrita', () => {
  assert.equal(getConfig(env).admin.trustProxy, false);
  assert.equal(getConfig({ ...env, TRUST_PROXY: 'loopback' }).admin.trustProxy, 'loopback');
  assert.equal(getConfig(railway).admin.trustProxy, 'railway');
  for (const TRUST_PROXY of ['true', '*', '1', '2', 'uniquelocal']) assert.throws(() => getConfig({ ...env, TRUST_PROXY }));
  for (const changes of [{ RAILWAY_PROJECT_ID: '' }, { RAILWAY_SERVICE_ID: '' }, { NODE_ENV: 'development' }, { RAILWAY_TCP_PROXY_DOMAIN: 'tcp.example' }, { RAILWAY_TCP_APPLICATION_PORT: '3000' }, { RAILWAY_TCP_PROXY_PORT: '10000' }]) assert.throws(() => getConfig({ ...railway, ...changes }));
});
test('cliente direto não habilita HTTPS com headers de protocolo, IP ou identificação Railway', async t => {
  const target = await application(t, env);
  const response = await request(target.base, '/session', 'GET', undefined, { 'x-forwarded-proto': 'https', 'x-forwarded-for': '127.0.0.1', 'x-real-ip': '127.0.0.1', 'x-railway-edge': 'iad1', forwarded: 'for=127.0.0.1;proto=https' });
  assert.equal(response.status,403); assert.deepEqual(await response.json(), { error:'HTTPS obrigatório' });
});
test('loopback não confia em socket externo nem em loopback forjado na cadeia de proxies', async t => {
  const target = await application(t, { ...env, TRUST_PROXY: 'loopback' }, '203.0.113.9');
  const response = await request(target.base, '/session', 'GET', undefined, { 'x-forwarded-proto': 'https', 'x-forwarded-for': '198.51.100.10, 127.0.0.1', 'x-real-ip': '127.0.0.1' });
  assert.equal(response.status,403);
});
test('Railway reconhece HTTPS sem loopback e preserva sessão, cookie Secure, CSRF, Origin e logout', async t => {
  const target = await application(t, railway, '100.64.0.10'); const edge = await ingress(t, target);
  assert.equal(target.app.get('trust proxy fn')('100.64.0.10',0),true);
  assert.equal(target.app.get('trust proxy fn')('100.64.0.11',1),false);
  assert.equal((await request(edge.base,'/session')).status,401);
  const login = await request(edge.base,'/login','POST',{ username:env.ADMIN_USER,password }, { 'x-forwarded-proto':'http', 'x-real-ip':'203.0.113.99', 'x-forwarded-for':'203.0.113.1, 10.0.0.1, 10.0.0.2' });
  assert.equal(login.status,200);
  const cookie = login.headers.get('set-cookie').split(';')[0], csrf = (await login.json()).csrfToken;
  assert.match(login.headers.get('set-cookie'), /__Host-mb_admin=.*HttpOnly.*Secure.*SameSite=Strict/);
  assert.ok(login.headers.get('strict-transport-security'));
  assert.equal((await request(edge.base,'/session','GET',undefined,{cookie})).status,200);
  const category = { id:'categoria',slug:'categoria',name:'Categoria',active:true };
  assert.equal((await request(edge.base,'/categories','POST',category,{cookie})).status,403);
  assert.equal((await request(edge.base,'/categories','POST',category,{cookie,'x-csrf-token':csrf,origin:'https://malicioso.example'})).status,403);
  assert.equal((await request(edge.base,'/categories','POST',category,{cookie,'x-csrf-token':csrf})).status,201);
  assert.equal((await request(edge.base,'/logout','POST',{}, {cookie,'x-csrf-token':csrf})).status,200);
  assert.equal((await request(edge.base,'/session','GET',undefined,{cookie})).status,401);
});
test('protocolo ausente, HTTP e listas ambíguas não satisfazem HTTPS mesmo em proxy confiável', async t => {
  const target = await application(t, railway, '100.64.0.10');
  for (const value of ['', 'http', 'https, http', 'http, https', 'https, https', 'HTTPS', 'wss']) {
    assert.equal((await request(target.base,'/session','GET',undefined, value ? {'x-forwarded-proto':value} : {})).status,403,value);
  }
  assert.equal((await request(target.base,'/session','GET',undefined,{'x-forwarded-proto':'https'})).status,401);
});
test('Railway rate limit ignora cadeias X-Forwarded-For e X-Real-IP falsificados pelo cliente', async t => {
  const target = await application(t, railway, '100.64.0.10'); const edge = await ingress(t,target);
  for (let n=0;n<5;n++) assert.equal((await request(edge.base,'/login','POST',{ username:env.ADMIN_USER,password:'incorreta' }, {'x-forwarded-for':`203.0.113.${n+1}, 10.0.0.${n+1}`, 'x-real-ip':`192.0.2.${n+1}`})).status,401);
  const blocked = await request(edge.base,'/login','POST',{ username:env.ADMIN_USER,password }, {'x-forwarded-for':'192.0.2.99', 'x-real-ip':'192.0.2.99'});
  assert.equal(blocked.status,429); assert.equal(blocked.headers.get('retry-after'),'900');
  // Outro IP atestado pelo ingresso possui sua própria janela, sem confiar no XFF.
  const other = await ingress(t,target,{ realIP:'198.51.100.43' });
  assert.equal((await request(other.base,'/login','POST',{ username:env.ADMIN_USER,password })).status,200);
});
test('IP ausente ou malformado no ingresso usa limite conservador pelo socket', async t => {
  const target = await application(t, railway, '100.64.0.10');
  let attempt = 0;
  for (const realIP of [null,'inválido','198.51.100.1, 198.51.100.2','198.51.100.1:80','outro']) {
    const edge = await ingress(t,target,{realIP});
    assert.equal((await request(edge.base,'/login','POST',{ username:env.ADMIN_USER,password:'incorreta' },{'x-forwarded-for':'192.0.2.' + (++attempt)})).status,401);
  }
  const edge=await ingress(t,target,{realIP:null});
  assert.equal((await request(edge.base,'/login','POST',{ username:env.ADMIN_USER,password })).status,429);
});
test('desenvolvimento local mantém HTTP sem depender de cabeçalhos de proxy', async t => {
  const target = await application(t, { ...env, NODE_ENV:'development', APP_ORIGIN:'http://localhost:3000' });
  assert.equal((await request(target.base,'/session')).status,401);
  assert.equal((await request(target.base,'/login','POST',{ username:env.ADMIN_USER,password },{origin:'http://localhost:3000'})).status,200);
});
