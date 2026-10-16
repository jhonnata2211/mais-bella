import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {pngImage} from './helpers/image-fixture.mjs';
import {defaultCustomization} from '../public/js/customization-model.mjs';
const require=createRequire(import.meta.url);
const {getConfig}=require('../src/config');
const {openDatabase}=require('../src/db/database');
const {seedDemo}=require('../src/db/seed');
const {hashPassword}=require('../src/services/password');
const {verifyBackup,existingDatabase,createBackup}=require('../src/services/production-maintenance');
const {operationLock,inspectLock,recoverLock,runtimeIdentity}=require('../src/services/operation-lock');
const password='Senha sintética revisão concorrente 014A!';const hash=await hashPassword(password);
async function fixture(t) {
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'maisbella-concurrency-')),filename=path.join(directory,'catalog.sqlite'),backupRoot=path.join(directory,'backups');fs.mkdirSync(backupRoot);
 const db=openDatabase(filename);await seedDemo(db);db.close();
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const config=getConfig({NODE_ENV:'test',ADMIN_USER:'admin',ADMIN_PASSWORD_HASH:hash,SESSION_SECRET:'de'.repeat(32),APP_ORIGIN:'http://localhost:3000',DB_PATH:filename,UPLOAD_DIR:path.join(directory,'uploads'),BACKUP_ROOT:backupRoot});
 return {directory,filename,config,target:path.join(backupRoot,'capture')};
}
function child(t,input) {
 const process=fork(new URL('./helpers/backup-process.cjs',import.meta.url),[],{execArgv:[],stdio:['ignore','ignore','pipe','ipc']});
 const messages=[],waiters=[];let diagnostic='';process.stderr.on('data',data=>{diagnostic+=data});
 process.on('message',message=>{if(waiters.length)waiters.shift().resolve(message);else messages.push(message)});
 process.on('exit',(code,signal)=>{for(const waiter of waiters)waiter.reject(Error('Processo terminou: '+code+'/'+signal+' '+diagnostic))});
 const exit=once(process,'exit');
 t.after(async()=>{if(process.exitCode===null&&process.signalCode===null){process.kill('SIGKILL');await exit}});
 process.send(input);
 return {process,exit,next:()=>messages.length?Promise.resolve(messages.shift()):new Promise((resolve,reject)=>waiters.push({resolve,reject}))};
}
async function online(t,f) {
 const server=child(t,{mode:'server',config:f.config}),ready=await server.next();assert.equal(ready.phase,'ready');
 const base='http://127.0.0.1:'+ready.port;let cookie='',csrf='';
 const api=(route,method='GET',body)=>fetch(base+'/api/admin'+route,{method,headers:{origin:f.config.admin.origin,cookie,'x-csrf-token':csrf,'content-type':Buffer.isBuffer(body)?'image/png':'application/json'},...(body===undefined?{}:{body:Buffer.isBuffer(body)?body:JSON.stringify(body)})});
 const login=await api('/login','POST',{username:'admin',password});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];csrf=(await login.json()).csrfToken;
 return {server,base,api};
}
test('processos independentes: servidor lê, backup captura e escritores HTTP/SQL são bloqueados', {timeout:20000}, async t=>{
 const f=await fixture(t),s=await online(t,f);
 const uploaded=await s.api('/images','POST',pngImage());assert.equal(uploaded.status,201);const image=(await uploaded.json()).image,value=defaultCustomization();value.hero.image={src:image.src,alt:'Foto consistente'};
 assert.equal((await s.api('/customization','PUT',{revision:0,customization:value})).status,200);
 const b=child(t,{mode:'backup',config:f.config,target:f.target,holdCopy:true});assert.equal((await b.next()).phase,'copy');
 assert.equal((await fetch(s.base+'/api/products')).status,200);assert.equal((await fetch(s.base+image.src)).status,200);
 const product=(await(await s.api('/products/vestido')).json()).product;product.name='Não deve entrar no snapshot';
 assert.equal((await s.api('/products/vestido','PUT',product)).status,503);assert.equal((await s.api('/customization/reset','POST',{revision:1})).status,503);assert.equal((await s.api('/images','POST',pngImage())).status,503);
 const writer=child(t,{mode:'sql',filename:f.filename});assert.equal((await writer.next()).phase,'blocked');await writer.exit;
 b.process.send({resume:true});assert.equal((await b.next()).phase,'done');assert.equal((await b.exit)[0],0);
 assert.equal((await verifyBackup(f.target)).photos,1);
 assert.equal((await s.api('/products/vestido','PUT',product)).status,200);
 const snapshot=existingDatabase(path.join(f.target,'catalog.sqlite'));try {assert.notEqual(snapshot.prepare("SELECT name FROM products WHERE id='vestido'").get().name,product.name)}finally{snapshot.close()}
});
test('transação externa já ativa faz backup falhar sem espera indefinida; nova captura inclui commit',{timeout:15000},async t=>{
 const f=await fixture(t),writer=child(t,{mode:'writer',filename:f.filename});assert.equal((await writer.next()).phase,'writing');
 const b=child(t,{mode:'backup',config:f.config,target:f.target});assert.equal((await b.next()).phase,'error');await b.exit;assert.equal(fs.existsSync(f.target),false);
 assert.equal(fs.existsSync(operationLock(f.filename).directory),false);
 writer.process.send({commit:true});assert.equal((await writer.next()).phase,'committed');await writer.exit;
 const next=child(t,{mode:'backup',config:f.config,target:f.target});assert.equal((await next.next()).phase,'done');await next.exit;
 const snapshot=existingDatabase(path.join(f.target,'catalog.sqlite'));try{assert.equal(snapshot.prepare("SELECT name FROM products WHERE id='vestido'").get().name,'Alteração concorrente confirmada')}finally{snapshot.close()}
});
test('prazo encerra worker antes de liberar trava; backup incompleto não é restaurável',{timeout:10000},async t=>{
 const f=await fixture(t);await assert.rejects(createBackup(f.config,f.target,{online:true,snapshotTimeoutMs:1}),/Prazo/);
 assert.equal(fs.existsSync(path.join(f.target,'INCOMPLETO')),true);assert.equal(fs.existsSync(operationLock(f.filename).directory),false);await assert.rejects(verifyBackup(f.target));
 const db=new(require('node:sqlite').DatabaseSync)(f.filename,{timeout:0});try{db.exec("UPDATE products SET name='Após timeout' WHERE id='vestido'")}finally{db.close()}
});
test('SIGKILL real deixa backup incompleto e bloqueia escritas; recuperação nunca aceita dono ativo',{timeout:20000},async t=>{
 const f=await fixture(t),s=await online(t,f);const image=(await(await s.api('/images','POST',pngImage())).json()).image,value=defaultCustomization();value.hero.image={src:image.src,alt:'Foto de teste'};await s.api('/customization','PUT',{revision:0,customization:value});
 const b=child(t,{mode:'backup',config:f.config,target:f.target,holdCopy:true});assert.equal((await b.next()).phase,'copy');
 const {owner}=inspectLock(f.filename),identity=runtimeIdentity() || {bootId:'test-only',pidNamespace:'test-only'};
 // A fixture substitui só a identificação de namespace ausente no sandbox Termux.
 if(!owner.runtime){owner.runtime=identity;fs.writeFileSync(operationLock(f.filename).directory+'/owner.json',JSON.stringify(owner))}
 assert.throws(()=>recoverLock(f.filename,{token:owner.token,confirm:'RECOVER_DEAD_OWNER',identity:()=>identity}),/ativo/);
 b.process.kill('SIGKILL');await b.exit;assert.equal(fs.existsSync(path.join(f.target,'INCOMPLETO')),true);assert.equal((await s.api('/images','POST',pngImage())).status,503);
 assert.throws(()=>recoverLock(f.filename,{token:'a'.repeat(32),confirm:'RECOVER_DEAD_OWNER',identity:()=>identity}),/mudou/);
 assert.deepEqual(recoverLock(f.filename,{token:owner.token,confirm:'RECOVER_DEAD_OWNER',identity:()=>identity}),{success:true,archived:true});
 assert.equal((await s.api('/images','POST',pngImage())).status,201);assert.ok(fs.readdirSync(f.directory).some(name=>name.includes('.recovered-')));
});
test('identidade desconhecida, namespace diferente e filho ativo impedem recuperação',{timeout:10000},async t=>{
 const f=await fixture(t),p=child(t,{mode:'lock',filename:f.filename});assert.equal((await p.next()).phase,'locked');const {owner}=inspectLock(f.filename);p.process.kill('SIGKILL');await p.exit;
 assert.throws(()=>recoverLock(f.filename,{token:owner.token,confirm:'RECOVER_DEAD_OWNER',identity:()=>null}),/desconhecida/);
 const current={bootId:'runtime-teste',pidNamespace:'namespace-teste'};owner.runtime={...current,pidNamespace:'outra'};fs.writeFileSync(operationLock(f.filename).directory+'/owner.json',JSON.stringify(owner));
 assert.throws(()=>recoverLock(f.filename,{token:owner.token,confirm:'RECOVER_DEAD_OWNER',identity:()=>current}),/runtime/);
 owner.runtime=current;owner.children=[process.pid];fs.writeFileSync(operationLock(f.filename).directory+'/owner.json',JSON.stringify(owner));assert.throws(()=>recoverLock(f.filename,{token:owner.token,confirm:'RECOVER_DEAD_OWNER',identity:()=>current}),/ativo/);
});
test('destino SQLite ocupado em outro processo termina por erro/prazo e worker já está morto',{timeout:15000},async t=>{
 const source=await fixture(t),destination=await fixture(t),writer=child(t,{mode:'writer',filename:destination.filename});assert.equal((await writer.next()).phase,'writing');
 let workerPid;
 await assert.rejects(require('../src/services/sqlite-snapshot').captureSnapshot(source.filename,destination.filename,800,pid=>{workerPid=pid}),/Prazo|Captura/);
 assert.throws(()=>process.kill(workerPid,0),{code:'ESRCH'});
 writer.process.send({commit:true});assert.equal((await writer.next()).phase,'committed');await writer.exit;
});
test('online recusa journal diferente de WAL e orienta manutenção sem criar destino',{timeout:10000},async t=>{
 const f=await fixture(t),db=new(require('node:sqlite').DatabaseSync)(f.filename);db.exec('PRAGMA journal_mode=DELETE;');db.close();
 await assert.rejects(createBackup(f.config,f.target,{online:true}),/WAL.*manutenção/);assert.equal(fs.existsSync(f.target),false);assert.equal(fs.existsSync(operationLock(f.filename).directory),false);
});
