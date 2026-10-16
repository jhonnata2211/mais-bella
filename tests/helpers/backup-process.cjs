// Exclusivamente fixtures temporárias passadas pelo teste; sem .env ou dados reais.
const fs=require('node:fs');
process.once('message',async input=>{
 try {
  if(input.mode==='server') {
   const db=require('../../src/db/database').openDatabase(input.config.databasePath);
   const app=require('../../src/app').createApp({db,config:input.config});
   const server=app.listen(0,'127.0.0.1',()=>process.send({phase:'ready',port:server.address().port}));
   process.once('disconnect',()=>{server.closeAllConnections();server.close(()=>{db.close();process.exit()})});
  } else if(input.mode==='backup') {
   if(input.holdCopy) {
    const original=fs.promises.copyFile;
    fs.promises.copyFile=async(...args)=>{process.send({phase:'copy'});await new Promise(resolve=>process.once('message',resolve));return original(...args)};
   }
   const result=await require('../../src/services/production-maintenance').createBackup(input.config,input.target,{online:true,snapshotTimeoutMs:input.timeout || 5000});
   process.send({phase:'done',result});process.disconnect();
  } else if(input.mode==='writer') {
   const db=new(require('node:sqlite').DatabaseSync)(input.filename,{timeout:0});
   try {
    db.exec("BEGIN IMMEDIATE; UPDATE products SET name='Alteração concorrente confirmada' WHERE id='vestido'");
    process.send({phase:'writing'});await new Promise(resolve=>process.once('message',resolve));db.exec('COMMIT');process.send({phase:'committed'});
   } finally {db.close();process.disconnect()}
  } else if(input.mode==='sql') {
   const db=new(require('node:sqlite').DatabaseSync)(input.filename,{timeout:0});
   try {db.exec("UPDATE products SET name='Não pode gravar durante backup' WHERE id='vestido'");process.send({phase:'written'})}
   catch {process.send({phase:'blocked'})}finally{db.close();process.disconnect()}
  } else if(input.mode==='lock') {
   require('../../src/services/operation-lock').operationLock(input.filename).acquire('backup');process.send({phase:'locked'});
  }
 } catch(error) {process.send({phase:'error',code:error.code || 'capture_failed'});process.disconnect()}
});
