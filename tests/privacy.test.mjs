import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { clearStoredKey, clearShoppingData, clearPersonalData, confirmPrivacyAction, FAVORITES_KEY } from '../public/js/privacy.mjs';
import { createCartStore, CART_KEY } from '../public/js/cart.mjs';
import { replaceCatalog, products, categories } from '../public/js/data/products.mjs';
import { reviewWhatsAppOrder } from '../public/js/cart-checkout.mjs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');
const { getConfig } = require('../src/config');
const { hashPassword } = require('../src/services/password');
function storage() { const values=new Map();return { values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key) }; }
const product = { id:'privacy',slug:'privacy',name:'Peça sintética',active:true,demo:false,price:10,images:[],colors:['Azul'],sizes:['M'],variations:[{color:'Azul',size:'M',stock:4}] };
const details = { name:'Nome sintético',phone:'12345123456',city:'Cidade sintética',neighborhood:'Bairro sintético',receiving:'delivery',deliveryNote:'Observação sintética' };
function fixture(t) {
  const previous=[...products], previousCategories=[...categories];replaceCatalog([product],[]);t.after(()=>replaceCatalog(previous,previousCategories));
  const local=storage(),cart=createCartStore(local),favorites=new Set([product.id]);
  cart.add(product,{color:'Azul',size:'M'},2);local.setItem(FAVORITES_KEY,JSON.stringify([...favorites]));local.setItem('outra-chave','preservar');
  return { local,cart,favorites };
}
test('limpeza cancelada preserva sacola, favoritos, dados persistidos e outros storages', async t => {
  const {local,cart,favorites}=fixture(t);const before=[...local.values.entries()];
  const result=await clearShoppingData({cart,favorites,storage:local,confirm:async()=>false});
  assert.deepEqual(result,{cleared:false});assert.equal(cart.getItems()[0].quantity,2);assert.equal(favorites.size,1);assert.deepEqual([...local.values.entries()],before);
});
test('limpeza confirmada remove somente chaves da loja e atualiza memória, outras abas e assinantes', async t => {
  const {local,cart,favorites}=fixture(t);const anotherTab=createCartStore(local),anotherProfile=storage();anotherProfile.setItem(CART_KEY,'independente');let changed=0;cart.subscribe(()=>changed++);
  const result=await clearShoppingData({cart,favorites,storage:local,confirm:async()=>true});
  assert.deepEqual(result,{cleared:true,persistent:true});assert.equal(local.getItem(CART_KEY),null);assert.equal(local.getItem(FAVORITES_KEY),null);
  assert.equal(local.getItem('outra-chave'),'preservar');assert.equal(cart.getItems().length,0);assert.equal(favorites.size,0);assert.equal(changed,1);
  anotherTab.refresh();assert.equal(anotherTab.getItems().length,0);assert.equal(anotherProfile.getItem(CART_KEY),'independente');
  assert.equal(createCartStore(local).getItems().length,0);
});
test('armazenamento bloqueado limpa memória mas informa falha de persistência sem prometer remoção', async t => {
  const {cart,favorites}=fixture(t);
  const blocked={removeItem(){throw Error('bloqueado')}};
  assert.equal(clearStoredKey(blocked,FAVORITES_KEY),false);assert.equal(clearStoredKey(undefined,FAVORITES_KEY),false);
  const result=await clearShoppingData({cart:createCartStore(blocked),favorites,storage:blocked,confirm:async()=>true});
  assert.equal(result.cleared,true);assert.equal(result.persistent,false);assert.equal(favorites.size,0);
  assert.equal(cart.getItems().length,1); // outra instância não é apagada quando usa outro armazenamento
});
function personalForm() {
  const elements=Object.entries(details).map(([name,value])=>({name,value,checked:name==='receiving'}));
  elements.push({name:'unrelated',value:'preservar'});
  return {elements,reset(){this.resetCount=(this.resetCount||0)+1;}};
}
test('limpar dados pessoais exige confirmação e não interfere em sacola/favoritos', async t => {
  const {local,cart,favorites}=fixture(t),form=personalForm(),before=[...local.values.entries()];
  assert.equal(await clearPersonalData({form,confirm:async()=>false}),false);assert.equal(form.elements[0].value,details.name);
  assert.equal(await clearPersonalData({form,confirm:async()=>true}),true);assert.equal(form.resetCount,1);
  for(const control of form.elements) {
    if(control.name==='receiving') assert.equal(control.checked,false);
    else if(control.name!=='unrelated') assert.equal(control.value,'');
  }
  assert.equal(form.elements.at(-1).value,'preservar');assert.deepEqual([...local.values.entries()],before);assert.equal(cart.getItems().length,1);assert.equal(favorites.size,1);
});
test('preparar WhatsApp mantém sacola/favoritos e não persiste nome, telefone ou entrega', async t => {
  const {local,cart,favorites}=fixture(t),before=cart.getItems();
  const result=await reviewWhatsAppOrder(cart,details,{refreshCatalog:async()=>{},number:'1'.repeat(11)});
  assert.equal(result.ok,true);assert.deepEqual(cart.getItems(),before);assert.equal(favorites.size,1);
  const stored=JSON.stringify([...local.values.entries()]);for(const field of ['name','phone','city','neighborhood','deliveryNote']) assert.ok(!stored.includes(details[field]));
  assert.ok(new URL(result.url).searchParams.get('text').includes(details.phone)); // limitação documentada do link
});
function dialogEnvironment(t) {
  const previous=globalThis.document,body={children:[],append(node){this.children.push(node)}},trigger={isConnected:true,focused:false,focus(){this.focused=true}};
  function node(tag){return {tag,children:[],listeners:new Map(),attributes:new Map(),returnValue:'',append(...children){this.children.push(...children)},setAttribute(name,value){this.attributes.set(name,value)},addEventListener(name,handler){this.listeners.set(name,handler)},showModal(){this.open=true},focus(){this.focused=true},remove(){body.children=body.children.filter(node=>node!==this)}};}
  globalThis.document={activeElement:trigger,body,createElement:node};t.after(()=>{globalThis.document=previous});return {body,trigger};
}
test('confirmação usa texto seguro, nomes acessíveis, foco em Cancelar e só aceita confirmação explícita', async t => {
  const {body,trigger}=dialogEnvironment(t);
  const pending=confirmPrivacyAction('Limpar <dados>?','Descrição segura');const dialog=body.children[0];
  assert.equal(dialog.attributes.get('aria-labelledby'),'privacy-confirm-title');assert.equal(dialog.children[0].textContent,'Limpar <dados>?');assert.equal(dialog.children[2].children[0].focused,true);
  dialog.returnValue='clear';dialog.listeners.get('close')();assert.equal(await pending,true);assert.equal(body.children.length,0);assert.equal(trigger.focused,true);
  const canceled=confirmPrivacyAction('Limpar?','Descrição');body.children[0].listeners.get('close')();assert.equal(await canceled,false);assert.equal(body.children.length,0);
});
const password='Senha sintética de privacidade 012!',hash=await hashPassword(password);
test('HTML administrativo (inclusive URL codificada) e API usam no-store; logout revoga sessão no servidor', async t => {
  const db=openDatabase(':memory:');
  const config=getConfig({NODE_ENV:'test',SEED_DEMO:'false',ADMIN_USER:'privacy',ADMIN_PASSWORD_HASH:hash,SESSION_SECRET:'ab'.repeat(32),APP_ORIGIN:'http://localhost:3000'});
  const app=createApp({db,config});const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close()});
  const base='http://127.0.0.1:'+server.address().port;
  for(const route of ['/admin.html','/admin%2ehtml','/admin.html?origem=compartilhado']) {
    const response=await fetch(base+route);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  }
  const request=(route,method='GET',body,headers={})=>fetch(base+'/api/admin'+route,{method,headers:{origin:config.admin.origin,'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const malformed=await fetch(base+'/api/admin/login',{method:'POST',headers:{'content-type':'application/json',origin:config.admin.origin},body:'{'});
  assert.equal(malformed.status,400);assert.equal(malformed.headers.get('cache-control'),'no-store');
  const anonymous=await request('/session');assert.equal(anonymous.status,401);assert.equal(anonymous.headers.get('cache-control'),'no-store');
  const login=await request('/login','POST',{username:'privacy',password});assert.equal(login.status,200);assert.equal(login.headers.get('cache-control'),'no-store');
  const cookie=login.headers.get('set-cookie').split(';')[0],csrf=(await login.json()).csrfToken;
  const session=await request('/session','GET',undefined,{cookie});assert.equal(session.status,200);assert.equal(session.headers.get('cache-control'),'no-store');
  const blocked=await request('/logout','POST',{}, {cookie,'x-csrf-token':'incorreto'});assert.equal(blocked.status,403);
  assert.equal((await request('/session','GET',undefined,{cookie})).status,200); // falha não encerra a sessão
  const logout=await request('/logout','POST',{}, {cookie,'x-csrf-token':csrf});assert.equal(logout.status,200);assert.equal(logout.headers.get('cache-control'),'no-store');
  assert.match(logout.headers.get('set-cookie'),/Expires=Thu, 01 Jan 1970/);
  assert.equal((await request('/session','GET',undefined,{cookie})).status,401); // cookie copiado também é revogado
});
