import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { defaultCustomization, validateCustomization, CATEGORY_SLOTS, categoryFilterName } from '../public/js/customization-model.mjs';
import { pngImage } from './helpers/image-fixture.mjs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../src/db/database');
const { seedDemo } = require('../src/db/seed');
const { getConfig } = require('../src/config');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/services/password');
const { MediaService } = require('../src/services/media-service');
const { CustomizationRepository } = require('../src/repositories/customization-repository');
const { imageReferences, customizationReferences } = require('../src/repositories/image-references');
const { createBackup, existingDatabase, cleanupPlan } = require('../src/services/production-maintenance');
const password = 'Senha sintética de personalização 013!';
const hash = await hashPassword(password);
const baseEnv = { NODE_ENV:'test', ADMIN_USER:'admin', ADMIN_PASSWORD_HASH:hash, SESSION_SECRET:'ac'.repeat(32), SEED_DEMO:'false', APP_ORIGIN:'http://localhost:3000' };
async function fixture(t, env = {}) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'maisbella-custom-')), filename=path.join(directory,'catalog.sqlite'), uploadsPath=path.join(directory,'uploads');
  const db=openDatabase(filename), config=getConfig({...baseEnv,DB_PATH:filename,UPLOAD_DIR:uploadsPath,...env});
  const media=new MediaService(uploadsPath);
  const server=await new Promise(resolve=>{const s=createApp({db,config}).listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(directory,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;let cookie='',csrf='';
  const request=(route,method='GET',body,headers={})=>fetch(base+route,{method,headers:{origin:config.admin.origin,cookie,'x-csrf-token':csrf,'content-type':Buffer.isBuffer(body)?'image/png':'application/json',...(config.admin.production?{'x-forwarded-proto':'https'}:{}),...headers},...(body===undefined?{}:{body:Buffer.isBuffer(body)?body:JSON.stringify(body)})});
  const api=(route,...args)=>request('/api/admin'+route,...args);
  async function login(){const response=await api('/login','POST',{username:'admin',password});assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];csrf=(await response.json()).csrfToken;}
  async function upload(){const response=await api('/images','POST',pngImage(),{'x-file-name':'../../server.js'});assert.equal(response.status,201);const {image}=await response.json();return{src:image.src,alt:'Imagem sintética da coleção'};}
  const save=(customization,revision=0)=>api('/customization','PUT',{revision,customization});
  return {directory,filename,uploadsPath,db,media,config,base,request,api,login,upload,save};
}
const imagePath = (f,image,folder='products') => path.join(f.uploadsPath,folder,path.basename(image.src));
const rows = db => Object.fromEntries(['categories','products','product_images','product_variations','admin_credentials'].map(table=>[table,db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));

test('sem cadastro, personalização devolve os padrões e não insere produtos nem configurações',async t=>{
  const f=await fixture(t);await f.login();
  const response=await f.api('/customization');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{customization:defaultCustomization(),revision:0});
  const publicResponse=await f.request('/api/store-customization');assert.equal(publicResponse.status,200);assert.equal(publicResponse.headers.get('cache-control'),'no-store');
  assert.deepEqual(await publicResponse.json(),{customization:defaultCustomization()});
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM products').get().n,0);assert.equal(f.db.prepare('SELECT count(*) AS n FROM store_customization').get().n,0);
  assert.equal(fs.existsSync(f.uploadsPath),false);
});
test('consultar, salvar, restaurar e enviar imagem exigem sessão; escritas exigem CSRF e Origin',async t=>{
  const f=await fixture(t),value=defaultCustomization();
  for(const [route,method,body]of[['/customization','GET'],['/customization','PUT',{revision:0,customization:value}],['/customization/reset','POST',{revision:0}],['/images','POST',pngImage()]])assert.equal((await f.api(route,method,body)).status,401);
  await f.login();
  for(const [route,method,body]of[['/customization','PUT',{revision:0,customization:value}],['/customization/reset','POST',{revision:0}],['/images','POST',pngImage()]]){
    for(const headers of [{'x-csrf-token':''},{origin:'https://malicioso.example'},{'x-csrf-token':'forjado'}])assert.equal((await f.api(route,method,body,headers)).status,403);
  }
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM store_customization').get().n,0);assert.equal(fs.existsSync(f.uploadsPath),false);
});
test('produção mantém exigência de HTTPS, cookie Secure, sessão e CSRF para personalização',async t=>{
  const f=await fixture(t,{NODE_ENV:'production',APP_ORIGIN:'https://loja.example',TRUST_PROXY:'loopback'});
  assert.equal((await f.api('/customization','GET',undefined,{'x-forwarded-proto':''})).status,403);
  await f.login();assert.equal((await f.api('/customization')).status,200);
  assert.equal((await f.save(defaultCustomization())).status,200);
  assert.equal((await f.api('/customization/reset','POST',{revision:1},{'x-csrf-token':''})).status,403);
});
test('textos persistem após reabrir SQLite sem modificar produtos, categorias, estoque ou credencial',async t=>{
  const f=await fixture(t);await seedDemo(f.db);await f.login();const before=rows(f.db);
  const value=defaultCustomization();value.hero.collection='Coleção Verão';value.hero.title='Leveza\npara cada dia';value.hero.description='Descrição real da coleção.';value.hero.buttonText='Ver peças';value.hero.buttonHref='/catalogo.html';value.categories.vestidos.label='Vestidos favoritos';
  const response=await f.save(value);assert.equal(response.status,200);assert.deepEqual(await response.json(),{customization:value,revision:1});assert.deepEqual(rows(f.db),before);
  const reopened=openDatabase(f.filename);try{assert.deepEqual(new CustomizationRepository(reopened).get(),{customization:value,revision:1});}finally{reopened.close();}
  const publicData=await(await f.request('/api/store-customization')).json();assert.deepEqual(Object.keys(publicData),['customization']);assert.deepEqual(publicData.customization,value);
  assert.ok(!JSON.stringify(publicData).includes(hash));assert.ok(!JSON.stringify(publicData).includes(baseEnv.SESSION_SECRET));
});
test('limites de texto, tipos, campos extras e identidade dos quatro espaços são validados no servidor',async t=>{
  const f=await fixture(t);await f.login();
  const mutations=[v=>v.hero.title='',v=>v.hero.collection='x'.repeat(61),v=>v.hero.title='x'.repeat(121),v=>v.hero.description='x'.repeat(401),v=>v.hero.buttonText='x'.repeat(41),v=>v.hero.title=7,v=>v.hero.title='segredo\u0000',v=>v.hero.collection='duas\nlinhas',v=>v.hero.extra=true,v=>v.categories.vestidos.label='x'.repeat(41),v=>v.categories.vestidos.categoryId='outro',v=>delete v.categories.calcas,v=>v.categories.outro={label:'Outro',image:null},v=>v.hero.image={src:'/assets/foto.png',alt:'Foto'},v=>v.hero.image={src:'/uploads/products/'+'a'.repeat(32)+'.png',alt:''},v=>v.hero.image={src:'/uploads/products/'+'a'.repeat(32)+'.png',alt:'a'.repeat(161)}];
  for(const mutate of mutations){const value=defaultCustomization();mutate(value);const response=await f.save(value);assert.equal(response.status,400);const body=await response.text();assert.ok(!/stack|node_modules|ERR_SQLITE/.test(body));}
  for(const body of [{},null,{revision:'0',customization:defaultCustomization()},{revision:-1,customization:defaultCustomization()},{revision:0,customization:defaultCustomization(),admin:true}])assert.equal((await f.api('/customization','PUT',body)).status,400);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM store_customization').get().n,0);
});
test('botão recusa URLs externas, caminhos administrativos, javascript, traversal e variações codificadas',async t=>{
  const f=await fixture(t);await f.login();
  for(const href of ['https://externo.example','//externo.example','javascript:alert(1)','/admin.html','/api/admin/session','/../admin.html','/%2f%2fexterno.example','/catalogo.html?redirect=https://externo.example','/catalogo.html\n','/produto.html?slug=inventado']){
    const value=defaultCustomization();value.hero.buttonHref=href;assert.equal((await f.save(value)).status,400,href);
  }
  let revision=0;for(const href of ['#novidades','#mais-vendidos','/catalogo.html','/catalogo.html?novidades=1#catalogo','/catalogo.html?promocoes=1#catalogo','/sacola.html']){const value=defaultCustomization();value.hero.buttonHref=href;assert.equal((await f.save(value,revision++)).status,200);}
});
test('publicação de cinco imagens usa nomes seguros, serve somente referências vivas e mantém o catálogo vazio',async t=>{
  const f=await fixture(t);await f.login();const value=defaultCustomization(),images=[];
  for(const section of [value.hero,...CATEGORY_SLOTS.map(slot=>value.categories[slot.id])]){section.image=await f.upload();images.push(section.image);assert.match(section.image.src,/^\/uploads\/products\/[a-f0-9]{32}\.png$/);assert.equal((await f.request(section.image.src)).status,404);}
  assert.equal((await f.save(value)).status,200);assert.equal(f.db.prepare('SELECT count(*) AS n FROM store_customization_images').get().n,5);assert.equal(fs.readdirSync(f.media.pending).length,0);
  for(const image of images){const response=await f.request(image.src);assert.equal(response.status,200);assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await response.arrayBuffer()),pngImage());}
  assert.deepEqual(await(await f.request('/api/products')).json(),{products:[]});
  assert.equal((await f.request('/uploads/products/'+ 'f'.repeat(32)+'.png')).status,404);
});
test('mesma imagem pode preencher dois espaços sem duplicação, e troca/restauração nunca apaga arquivos',async t=>{
  const f=await fixture(t);await f.login();const value=defaultCustomization();value.hero.image=await f.upload();value.categories.vestidos.image=value.hero.image;
  assert.equal((await f.save(value)).status,200);assert.equal(fs.readdirSync(f.media.published).length,1);assert.equal(customizationReferences(f.db).length,1);
  const first=value.hero.image;value.hero.image=await f.upload();value.categories.vestidos.image=null;
  assert.equal((await f.save(value,1)).status,200);assert.equal(fs.existsSync(imagePath(f,first)),true);
  const beforeFiles=fs.readdirSync(f.media.published);const reset=await f.api('/customization/reset','POST',{revision:2});assert.equal(reset.status,200);assert.deepEqual((await reset.json()).customization,defaultCustomization());
  assert.deepEqual(fs.readdirSync(f.media.published),beforeFiles);assert.deepEqual(customizationReferences(f.db),[]);
});
test('referências fabricadas, traversal e foto publicada de produto não podem ser apropriadas',async t=>{
  const f=await fixture(t);await f.login();
  for(const src of ['/uploads/products/'+'a'.repeat(32)+'.png','/uploads/products/../../server.js','/uploads/products/%2e%2e/file.png','/uploads/pending/foto.png','data:image/png;base64,abc','https://externo.example/foto.png']){const value=defaultCustomization();value.hero.image={src,alt:'Foto'};assert.equal((await f.save(value)).status,400);}
  const image=await f.upload();f.media.directories();fs.renameSync(imagePath(f,image,'pending'),imagePath(f,image)); // arquivo publicado alheio, sem pendente autorizado
  const value=defaultCustomization();value.hero.image=image;assert.equal((await f.save(value)).status,400);assert.equal(fs.existsSync(imagePath(f,image)),true);
});
test('imagem inválida/MIME proibido/grande não gera upload ou personalização',async t=>{
  const f=await fixture(t);await f.login();
  assert.equal((await f.api('/images','POST',Buffer.from('<svg onload="evil()"/>'))).status,400);
  assert.equal((await f.api('/images','POST',pngImage(),{'content-type':'text/html'})).status,400);
  assert.equal((await f.api('/images','POST',Buffer.alloc(5*1024*1024+1))).status,413);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM store_customization_images').get().n,0);assert.equal(fs.existsSync(f.uploadsPath),false);
});
test('revisão impede atualização e restauração concorrentes sem substituir mudanças recentes',async t=>{
  const f=await fixture(t);await f.login();const value=defaultCustomization();value.hero.title='Primeira versão';assert.equal((await f.save(value)).status,200);
  value.hero.title='Versão antiga';assert.equal((await f.save(value,0)).status,409);assert.equal((await f.api('/customization/reset','POST',{revision:0})).status,409);
  const current=await(await f.api('/customization')).json();assert.equal(current.customization.hero.title,'Primeira versão');assert.equal(current.revision,1);
});
test('falha relacionada reverte SQLite e novas cópias, preserva foto anterior e permite tentar novamente',async t=>{
  const f=await fixture(t);await f.login();const value=defaultCustomization();value.hero.image=await f.upload();assert.equal((await f.save(value)).status,200);const previous=value.hero.image;
  value.hero.image=await f.upload();f.db.exec("CREATE TRIGGER fail_customization BEFORE INSERT ON store_customization_images BEGIN SELECT RAISE(ABORT,'falha sintética'); END");
  const response=await f.save(value,1);assert.equal(response.status,500);assert.ok(!/falha sintética|stack|sqlite|\/data\//i.test(await response.text()));
  const current=new CustomizationRepository(f.db).get();assert.equal(current.revision,1);assert.deepEqual(current.customization.hero.image,previous);
  assert.equal(fs.existsSync(imagePath(f,previous)),true);assert.equal(fs.existsSync(imagePath(f,value.hero.image)),false);assert.equal(fs.existsSync(imagePath(f,value.hero.image,'pending')),true);
  f.db.exec('DROP TRIGGER fail_customization');assert.equal((await f.save(value,1)).status,200);
});
test('manutenção protege imagens da Home; cleanup demo não as classifica como descartáveis',async t=>{
  const f=await fixture(t);await f.login();await seedDemo(f.db);const value=defaultCustomization();value.hero.image=await f.upload();assert.equal((await f.save(value)).status,200);
  const target=imagePath(f,value.hero.image);const old=new Date(Date.now()-3*86400000);fs.utimesSync(target,old,old);
  assert.deepEqual(f.media.cleanup(f.db,true),{apply:true,count:0});assert.equal(fs.existsSync(target),true);
  f.db.prepare('UPDATE product_images SET reference=? WHERE id=(SELECT id FROM product_images LIMIT 1)').run(value.hero.image.src);
  assert.ok(!cleanupPlan(f.db).images.includes(value.hero.image.src));assert.ok(imageReferences(f.db).includes(value.hero.image.src));
});
test('backup inclui configuração e fotos da Home e pode reabrir o snapshot independentemente',async t=>{
  const f=await fixture(t);await f.login();const value=defaultCustomization();value.hero.image=await f.upload();assert.equal((await f.save(value)).status,200);
  const backupRoot=fs.mkdtempSync(path.join(os.tmpdir(),'maisbella-custom-backup-'));t.after(()=>fs.rmSync(backupRoot,{recursive:true,force:true}));const destination=path.join(backupRoot,'snapshot');
  const previous=process.env.MAINTENANCE_MODE;process.env.MAINTENANCE_MODE='true';
  try{assert.equal((await createBackup(f.config,destination)).photos,1);}finally{if(previous===undefined)delete process.env.MAINTENANCE_MODE;else process.env.MAINTENANCE_MODE=previous;}
  const snapshot=existingDatabase(path.join(destination,'catalog.sqlite'));try{assert.deepEqual(new CustomizationRepository(snapshot).get(),{customization:value,revision:1});}finally{snapshot.close();}
  assert.deepEqual(fs.readFileSync(path.join(destination,'uploads','products',path.basename(value.hero.image.src))),pngImage());
});
test('referências em bancos antigos continuam legíveis por manutenção e backup',()=>{
  const db=new DatabaseSync(':memory:');try{db.exec("CREATE TABLE product_images(reference TEXT,kind TEXT); INSERT INTO product_images VALUES('/assets/foto.png','image')");assert.deepEqual(customizationReferences(db),[]);assert.deepEqual(imageReferences(db),['/assets/foto.png']);}finally{db.close();}
});
test('API pública rejeita escrita mesmo com cookie administrativo válido',async t=>{
  const f=await fixture(t);await f.login();for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await f.request('/api/store-customization',method,{revision:0,customization:defaultCustomization()})).status,404);
  assert.deepEqual((await(await f.api('/customization')).json()).customization,defaultCustomization());
});
test('rótulo personalizado não muda o identificador nem a resolução do filtro da categoria',()=>{
  const value=defaultCustomization();value.categories.vestidos.label='Peças para celebrar';assert.equal(validateCustomization(value).categories.vestidos.label,'Peças para celebrar');
  assert.equal(categoryFilterName(CATEGORY_SLOTS[0],[{id:'vestidos',name:'Vestidos reais'}]),'Vestidos reais');
  assert.equal(categoryFilterName(CATEGORY_SLOTS[0],[{id:'aleatorio',slug:'vestidos',name:'Vestidos por slug'}]),'Vestidos por slug');
  assert.equal(categoryFilterName(CATEGORY_SLOTS[0],[]),'Vestidos');
});
