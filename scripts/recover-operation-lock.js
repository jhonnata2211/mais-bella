// Só opera sobre DB_PATH explícito. Nunca carrega segredos ou remove por timeout/PID informado.
const { inspectLock,recoverLock,runtimeIdentity }=require('../src/services/operation-lock');
try {
  const args=process.argv.slice(2);
  if (!process.env.DB_PATH) throw Error('Defina DB_PATH.');
  if (args.length===1 && args[0]==='--inspect') {
    const {owner}=inspectLock(process.env.DB_PATH),runtime=runtimeIdentity();
    console.log(JSON.stringify({token:owner.token,pid:owner.pid,purpose:owner.purpose,createdAt:owner.createdAt,sameRuntime:Boolean(runtime && owner.runtime && runtime.bootId===owner.runtime.bootId && runtime.pidNamespace===owner.runtime.pidNamespace)}));
  } else if (args.length===2 && args[0]==='--recover' && args[1]==='--confirm=RECOVER_DEAD_OWNER') {
    console.log(JSON.stringify(recoverLock(process.env.DB_PATH,{token:process.env.LOCK_TOKEN,confirm:'RECOVER_DEAD_OWNER'})));
  } else throw Error('Argumentos inválidos.');
} catch {
  console.error('Recuperação não autorizada ou não verificável. Inspecione a trava; processo ativo, token diferente, outro runtime, permissão insuficiente ou metadados incompletos exigem revisão técnica. Não remova a trava com escritores ativos.');
  process.exitCode=1;
}
