import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { pngImage } from './helpers/image-fixture.mjs';
import { defaultCustomization } from '../public/js/customization-model.mjs';
const require = createRequire(import.meta.url);
const { openDatabase }=require('../src/db/database');
const { createApp }=require('../src/app');
const { getConfig }=require('../src/config');
const { seedDemo }=require('../src/db/seed');
const { hashPassword }=require('../src/services/password');
const { operationLock }=require('../src/services/operation-lock');
const { createBackup,verifyBackup,restoreBackup }=require('../src/services/production-maintenance');
const password='Senha sintética somente para testes 014A!';
const hash=await hashPassword(password);
const env={NODE_ENV:'test',ADMIN_USER:'admin',ADMIN_PASSWORD_HASH:hash,SESSION_SECRET:'bf'.repeat(32),APP_ORIGIN:'http://localhost:3000',SEED_DEMO:'false'};
async function fixture(t) {
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'maisbella-online-backup-'));
 const databasePath=path.join(directory,'catalog.sqlite'),uploadsPath=path.join(directory,'uploads'),backupRoot=path.join(directory,'backups');fs.mkdirSync(backupRoot);
 const config=getConfig({...env,DB_PATH:databasePath,UPLOAD_DIR:uploadsPath,BACKUP_ROOT:backupRoot});
 const db=openDatabase(databasePath);await seedDemo(db);
 const server=await new Promise(resolve=>{const s=createApp({db,config}).listen(0,'127.0.0.1',()=>resolve(s))});
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(directory,{recursive:true,force:true})});
 const base='http://127.0.0.1:'+server.address().port;let cookie='',csrf='';
 const api=(route,method='GET',body,headers={},options={})=>fetch(base+'/api/admin'+route,{method,...options,headers:{origin:env.APP_ORIGIN,cookie,'x-csrf-token':csrf,'content-type':Buffer.isBuffer(body)?'image/png':'application/json',...headers},...(body===undefined?{}:{body:Buffer.isBuffer(body)?body:JSON.stringify(body)})});
 const login=await api('/login','POST',{username:'admin',password});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];csrf=(await login.json()).csrfToken;
 const upload=await api('/images','POST',pngImage());assert.equal(upload.status,201);const image=(await upload.json()).image;
 const value=defaultCustomization();value.hero.image={src:image.src,alt:'Foto sintética da Home'};assert.equal((await api('/customization','PUT',{revision:0,customization:value})).status,200);
 return {directory,config,db,base,api,image,target:path.join(backupRoot,'capture')};
}
function holdCopies(t,target) {
 const original=fs.promises.copyFile;let release,arrived;
 const entered=new Promise(resolve=>{arrived=resolve}),wait=new Promise(resolve=>{release=resolve});
 fs.promises.copyFile=async(...args)=>{if(args[1].startsWith(target+path.sep)){arrived();await wait}return original(...args)};
 t.after(()=>{release();fs.promises.copyFile=original});return {entered,release};
}
test('captura online bloqueia gravações e uploads, preserva leitura, autenticação, CSRF e logout',async t=>{
 const f=await fixture(t),hold=holdCopies(t,f.target);
 const pending=createBackup(f.config,f.target,{online:true});await hold.entered;
 assert.equal((await fetch(f.base+'/api/products')).status,200);
 assert.equal((await fetch(f.base+f.image.src)).status,200);
 assert.equal((await f.api('/session')).status,200);
 assert.equal((await f.api('/products','POST',{}, {'x-csrf-token':''})).status,403);
 assert.equal((await f.api('/products','POST',{}, {cookie:''})).status,401);
 for(const [route,method,body]of[['/products','POST',{}],['/products/vestido','PUT',{}],['/categories','POST',{}],['/categories/vestidos','PUT',{}],['/customization','PUT',{}],['/customization/reset','POST',{}],['/password','POST',{}],['/images','POST',pngImage()]]){
  const r=await f.api(route,method,body);assert.equal(r.status,503,route);assert.equal(r.headers.get('retry-after'),'5');assert.ok(!(await r.text()).includes(f.directory));
 }
 assert.equal((await f.api('/logout','POST',{})).status,200);
 assert.equal((await f.api('/session')).status,401);
 hold.release();assert.equal((await pending).success,true);assert.deepEqual(await verifyBackup(f.target),{success:true,photos:1});
});
test('bloqueio é compartilhado por processos e não é contornado por nova instância ou manutenção',async t=>{
 const f=await fixture(t);const release=operationLock(f.config.databasePath).acquire('backup');
 try {
  const result=spawnSync(process.execPath,['-e',"try{require('./src/services/operation-lock').operationLock(process.argv[1]).acquire();process.exit(2)}catch(e){process.exit(e.status===503?0:3)}",f.config.databasePath],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const source="require('./src/config').loadEnvironment=()=>{};process.argv=[process.execPath,'scripts/cleanup-media.js','--apply'];require('./scripts/cleanup-media.js')";
  const command=spawnSync(process.execPath,['-e',source],{encoding:'utf8',env:{...process.env,...env,DB_PATH:f.config.databasePath,UPLOAD_DIR:f.config.uploadsPath}});assert.equal(command.status,1);
  await assert.rejects(createBackup(f.config,f.target,{online:true}),{status:503});assert.equal(fs.existsSync(f.target),false);
 }finally{release()}
 assert.equal((await f.api('/categories','POST',{id:'categoria-apos-captura',name:'Categoria após captura',slug:'categoria-apos-captura',active:true})).status,201);
});
test('backup recusa escrita em andamento antes de criar destino e volta a funcionar ao liberar',async t=>{
 const f=await fixture(t),release=operationLock(f.config.databasePath).acquire('admin-write');
 await assert.rejects(createBackup(f.config,f.target,{online:true}),{status:503});release();assert.equal(fs.existsSync(f.target),false);
 assert.equal((await createBackup(f.config,f.target,{online:true})).success,true);
});
test('reserva SQLite impede escritor direto durante captura e não bloqueia leitores',async t=>{
 const f=await fixture(t),hold=holdCopies(t,f.target),pending=createBackup(f.config,f.target,{online:true});await hold.entered;
 const other=new DatabaseSync(f.config.databasePath,{timeout:0});
 try {assert.equal(other.prepare('SELECT count(*) AS n FROM products').get().n,12);assert.throws(()=>other.exec("UPDATE products SET name='Não deve gravar'"));}finally{other.close();hold.release()}
 await pending;assert.equal((await f.api('/categories','POST',{id:'categoria-liberada',name:'Categoria liberada',slug:'categoria-liberada',active:true})).status,201);
});
test('falha ao copiar mantém INCOMPLETO, não modifica origem e libera escritas',async t=>{
 const f=await fixture(t),original=fs.promises.copyFile;
 fs.promises.copyFile=async(...args)=>{if(args[1].startsWith(f.target+path.sep))throw Object.assign(Error('falha sintética'),{code:'ENOSPC'});return original(...args)};
 try {await assert.rejects(createBackup(f.config,f.target,{online:true}),{code:'ENOSPC'})}finally{fs.promises.copyFile=original}
 assert.equal(fs.existsSync(path.join(f.target,'INCOMPLETO')),true);await assert.rejects(verifyBackup(f.target));
 assert.equal((await fetch(f.base+f.image.src)).status,200);assert.equal((await f.api('/categories','POST',{id:'apos-falha',name:'Após falha',slug:'apos-falha',active:true})).status,201);
});
test('foto ausente recusa captura, não marca sucesso e libera bloqueio',async t=>{
 const f=await fixture(t);fs.renameSync(path.join(f.config.uploadsPath,'products',path.basename(f.image.src)),path.join(f.directory,'foto-reservada.png'));
 await assert.rejects(createBackup(f.config,f.target,{online:true}));assert.equal(fs.existsSync(path.join(f.target,'INCOMPLETO')),true);
 const release=operationLock(f.config.databasePath).acquire();release();
});
test('destino dedicado no mesmo volume é permitido; código, symlinks e sobreposição são recusados',async t=>{
 const f=await fixture(t);assert.equal((await createBackup(f.config,f.target,{online:true})).success,true);
 await assert.rejects(createBackup(f.config,f.target,{online:true}));
 for(const backupRoot of [f.directory,f.config.uploadsPath,path.join(f.config.uploadsPath,'products'),process.cwd()])await assert.rejects(createBackup({...f.config,backupRoot},path.join(backupRoot,'forbidden-new'),{online:true}));
 const link=path.join(f.config.backupRoot,'link');fs.symlinkSync(f.config.uploadsPath,link);await assert.rejects(createBackup(f.config,path.join(link,'forbidden'),{online:true}));
});
test('verificação rejeita foto ou banco adulterados, ausentes, symlinks e manifesto com traversal',async t=>{
 const f=await fixture(t);await createBackup(f.config,f.target,{online:true});
 const photo=path.join(f.target,'uploads','products',path.basename(f.image.src)),bytes=fs.readFileSync(photo);fs.writeFileSync(photo,'alterado');await assert.rejects(verifyBackup(f.target));fs.unlinkSync(photo);await assert.rejects(verifyBackup(f.target));
 fs.symlinkSync(path.join(f.config.uploadsPath,'products',path.basename(f.image.src)),photo);await assert.rejects(verifyBackup(f.target));fs.unlinkSync(photo);fs.writeFileSync(photo,bytes);
 const manifestPath=path.join(f.target,'manifest.json'),manifest=fs.readFileSync(manifestPath,'utf8'),value=JSON.parse(manifest);value.files['../../segredo']={bytes:1,sha256:'x'};value.photos++;fs.writeFileSync(manifestPath,JSON.stringify(value));await assert.rejects(verifyBackup(f.target));fs.writeFileSync(manifestPath,manifest);
 const database=path.join(f.target,'catalog.sqlite');fs.appendFileSync(database,'alteração');await assert.rejects(verifyBackup(f.target));
});
test('restauração completa usa pasta nova, preserva configuração/fotos e permite iniciar API isolada',async t=>{
 const f=await fixture(t);await createBackup(f.config,f.target,{online:true});const target=path.join(f.directory,'restored');
 assert.deepEqual(await restoreBackup(f.target,target),{success:true,photos:1});await assert.rejects(restoreBackup(f.target,target));
 const db=openDatabase(path.join(target,'catalog.sqlite')),server=createApp({db,config:{...f.config,databasePath:path.join(target,'catalog.sqlite'),uploadsPath:path.join(target,'uploads')}}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try {
  const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await(await fetch(base+'/api/products')).json()).products.length,12);
  assert.equal((await(await fetch(base+'/api/store-customization')).json()).customization.hero.image.src,f.image.src);
  assert.deepEqual(Buffer.from(await(await fetch(base+f.image.src)).arrayBuffer()),pngImage());
  assert.equal((await fetch(base+'/api/admin/session')).status,401);
  assert.equal((await fetch(base+'/api/admin/login',{method:'POST',headers:{origin:env.APP_ORIGIN,'content-type':'application/json'},body:JSON.stringify({username:'admin',password})})).status,200);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close()}
});
test('falha de restauração mantém marcador, preserva origem e recusa backup incompleto',async t=>{
 const f=await fixture(t);await createBackup(f.config,f.target,{online:true});const target=path.join(f.directory,'restore-failure'),original=fs.promises.copyFile;
 fs.promises.copyFile=async(...args)=>{if(args[1].startsWith(target+path.sep))throw Error('falha de cópia');return original(...args)};
 try{await assert.rejects(restoreBackup(f.target,target))}finally{fs.promises.copyFile=original}
 assert.equal(fs.existsSync(path.join(target,'INCOMPLETO')),true);assert.equal((await verifyBackup(f.target)).success,true);
 fs.writeFileSync(path.join(f.target,'INCOMPLETO'),'interrompido');await assert.rejects(restoreBackup(f.target,path.join(f.directory,'another')));assert.equal(fs.existsSync(path.join(f.directory,'another')),false);
});
test('bloqueio abandonado nunca expira automaticamente nem permite outro processo gravar',async t=>{
 const f=await fixture(t),lock=operationLock(f.config.databasePath),release=lock.acquire('backup');
 const owner=path.join(lock.directory,'owner.json');const data=JSON.parse(fs.readFileSync(owner));data.createdAt='2000-01-01T00:00:00.000Z';fs.writeFileSync(owner,JSON.stringify(data));
 assert.throws(()=>operationLock(f.config.databasePath).acquire(),{status:503});assert.equal((await f.api('/customization/reset','POST',{revision:1})).status,503);release();
});
test('handler assíncrono em andamento mantém bloqueio mesmo após desconexão do cliente',async t=>{
 const f=await fixture(t),passwords=require('../src/services/password'),original=passwords.hashPassword;
 let release,entered;const wait=new Promise(resolve=>{release=resolve}),arrived=new Promise(resolve=>{entered=resolve});
 passwords.hashPassword=async(...args)=>{entered();await wait;return original(...args)};
 const controller=new AbortController();
 const pending=f.api('/password','POST',{currentPassword:password,newPassword:'Outra senha sintética segura 014A!',confirmation:'Outra senha sintética segura 014A!'}, {},{signal:controller.signal}).catch(error=>error);
 try {
  await arrived;controller.abort();await pending;
  await assert.rejects(createBackup(f.config,f.target,{online:true}),{status:503});assert.equal(fs.existsSync(f.target),false);
 }finally{release();passwords.hashPassword=original}
 const lock=operationLock(f.config.databasePath);
 for(let count=0;fs.existsSync(lock.directory)&&count<200;count++)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(fs.existsSync(lock.directory),false);
});
test('comandos online, verificação e restauração funcionam sem manutenção global ou .env real',async t=>{
 const f=await fixture(t);
 const command=(script,extra={})=>spawnSync(process.execPath,['-e',"require('./src/config').loadEnvironment=()=>{};process.argv=[process.execPath,"+JSON.stringify(script)+",...(process.env.ONLINE_TEST==='true'?['--online']:[])];require('./"+script+"')"],{encoding:'utf8',env:{...process.env,...env,MAINTENANCE_MODE:'false',DB_PATH:f.config.databasePath,UPLOAD_DIR:f.config.uploadsPath,BACKUP_ROOT:f.config.backupRoot,BACKUP_DIR:f.target,...extra}});
 const captured=command('scripts/production-backup.js',{ONLINE_TEST:'true'});assert.equal(captured.status,0,captured.stderr);assert.deepEqual(JSON.parse(captured.stdout),{success:true,photos:1});
 assert.equal(command('scripts/verify-backup.js').status,0);
 const destination=path.join(f.directory,'cli-restore');assert.equal(command('scripts/restore-backup.js',{RESTORE_DIR:destination}).status,0);assert.equal((await verifyBackup(destination)).success,true);
 const repeated=command('scripts/restore-backup.js',{RESTORE_DIR:destination});assert.equal(repeated.status,1);assert.ok(!repeated.stderr.includes(f.directory));assert.ok(!repeated.stderr.includes(hash));
});
test('término abrupto de processo deixa trava fechada e preserva leituras',async t=>{
 const f=await fixture(t);
 const child=spawnSync(process.execPath,['-e',"require('./src/services/operation-lock').operationLock(process.argv[1]).acquire('backup');process.exit(9)",f.config.databasePath]);assert.equal(child.status,9);
 assert.equal((await fetch(f.base+'/api/products')).status,200);assert.equal((await f.api('/images','POST',pngImage())).status,503);
 await assert.rejects(createBackup(f.config,f.target,{online:true}),{status:503});assert.equal(fs.existsSync(f.target),false);
});
test('falha de sincronização não remove marcador e não deixa captura bloqueada',async t=>{
 const f=await fixture(t),original=fs.fsyncSync;
 fs.fsyncSync=()=>{throw Object.assign(Error('falha de sincronização'),{code:'EIO'})};
 try{await assert.rejects(createBackup(f.config,f.target,{online:true}),{code:'EIO'})}finally{fs.fsyncSync=original}
 assert.equal(fs.existsSync(path.join(f.target,'INCOMPLETO')),true);const release=operationLock(f.config.databasePath).acquire();release();
});
