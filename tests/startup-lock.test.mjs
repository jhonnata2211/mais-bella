import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {openDatabase}=require('../src/db/database');
const {hashPassword}=require('../src/services/password');
const hash=await hashPassword('Senha exclusivamente sintética de startup 014A!');
function run(t,scenario) {
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'maisbella-startup-')),filename=path.join(directory,'catalog.sqlite');
 if(scenario!=='new')openDatabase(filename).close();
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 // Cada cenário usa processo, SQLite e variáveis sintéticas próprios. Nunca carrega .env.
 const source=`
 const assert=require('node:assert/strict'),fs=require('node:fs');
 const scenario=process.argv[1],filename=process.env.DB_PATH,lockPath=filename+'.operations-lock';
 require('./src/config').loadEnvironment=()=>{};
 const locking=require('./src/services/operation-lock'),originalLock=locking.operationLock;
 let releases=0,opens=0,closes=0,creates=0,seeds=0,foreignRelease;
 locking.operationLock=(...args)=>{const lock=originalLock(...args);return {...lock,acquire(...args){const release=lock.acquire(...args);return ()=>{releases++;release();if(scenario==='release-error')throw Error('release-fixture')}}}};
 const database=require('./src/db/database'),originalOpen=database.openDatabase;
 database.openDatabase=(...args)=>{
  opens++;if(scenario!=='new')assert.equal(fs.existsSync(lockPath),true);
  if(scenario==='open-error')throw Error('open-fixture');
  const db=originalOpen(...args),close=db.close.bind(db);db.close=()=>{closes++;close()};return db;
 };
 const seed=require('./src/db/seed');seed.seedDemo=async()=>{seeds++;assert.equal(fs.existsSync(lockPath),true);throw Error('seed-fixture')};
 const app=require('./src/app'),originalApp=app.createApp;
 app.createApp=(...args)=>{
  creates++;if(scenario!=='new')assert.equal(fs.existsSync(lockPath),true);
  if(scenario==='app-error')throw Error('app-fixture');
  const instance=originalApp(...args),listen=instance.listen.bind(instance);
  instance.listen=(...args)=>{assert.equal(fs.existsSync(lockPath),false);if(scenario==='listen-error'){const emitter=new(require('node:events').EventEmitter)();process.nextTick(()=>emitter.emit('error',Error('listen-fixture')));return emitter}return listen(...args)};
  return instance;
 };
 if(scenario==='conflict')foreignRelease=originalLock(filename).acquire('backup');
 (async()=>{
  try {
   const {startServer}=require('./server');
   if(['normal','new','railway'].includes(scenario)){
    const {server,db}=await startServer();assert.equal(fs.existsSync(lockPath),false);assert.equal(releases,scenario==='new'?0:1);
    const base='http://127.0.0.1:'+server.address().port;
    assert.equal((await fetch(base+'/api/products')).status,200);
    if(scenario==='railway')assert.equal((await fetch(base+'/api/admin/session',{headers:{'x-forwarded-proto':'https'}})).status,401);
    const release=originalLock(filename).acquire('proof-running-server-does-not-hold-startup');release();
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();assert.equal(closes,1);
   }else{
    await assert.rejects(startServer(),scenario==='conflict'?{status:503}:new RegExp(scenario.split('-')[0]+'-fixture'));
    assert.equal(releases,scenario==='conflict'?0:1);
    assert.equal(opens,scenario==='conflict'?0:1);
    assert.equal(closes,['open-error','conflict'].includes(scenario)?0:1);
    assert.equal(fs.existsSync(lockPath),scenario==='conflict');
    if(scenario==='seed-error'){assert.equal(seeds,1);assert.equal(creates,0)}
   }
   console.log('STARTUP_TEST_OK');
  }finally{foreignRelease?.()}
 })().catch(error=>{console.error(error);process.exitCode=1});`;
 const env={...process.env,NODE_ENV:scenario==='railway'?'production':'test',PORT:'0',DB_PATH:filename,UPLOAD_DIR:path.join(directory,'uploads'),SEED_DEMO:scenario==='seed-error'?'true':'false',APP_ORIGIN:scenario==='railway'?'https://boutique.example':'http://localhost:3000',ADMIN_USER:'admin-fixture',ADMIN_PASSWORD_HASH:hash,SESSION_SECRET:'fa'.repeat(32),TRUST_PROXY:scenario==='railway'?'railway':'',RAILWAY_PROJECT_ID:'fixture-project',RAILWAY_SERVICE_ID:'fixture-service',RAILWAY_TCP_PROXY_DOMAIN:'',RAILWAY_TCP_APPLICATION_PORT:'',RAILWAY_TCP_PROXY_PORT:''};
 const result=spawnSync(process.execPath,['-e',source,scenario],{encoding:'utf8',env,timeout:10000});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/STARTUP_TEST_OK/);
 if(scenario==='railway')assert.ok(!result.stdout.includes('localhost'));
}
for(const [scenario,label]of[
 ['normal','startup existente libera uma única vez antes de ouvir HTTP e continua atendendo'],
 ['new','primeira instalação inicia com SQLite novo sem liberação desnecessária'],
 ['open-error','erro ao abrir banco libera uma única vez e não fecha conexão inexistente'],
 ['seed-error','falha no seed protegido fecha banco e libera uma única vez'],
 ['app-error','falha ao preparar aplicação fecha banco e libera uma única vez'],
 ['listen-error','falha de listen após liberação fecha banco sem liberar novamente'],
 ['release-error','erro na liberação fecha banco sem repetir a tentativa'],
 ['conflict','conflito preserva trava do outro processo sem abrir ou modificar SQLite'],
 ['railway','startup em produção com proxy Railway atende catálogo e preserva sessão protegida']
])test(label,{timeout:15000},t=>run(t,scenario));
