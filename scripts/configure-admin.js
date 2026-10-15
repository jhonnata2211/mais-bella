// Execute interativamente. Senha nunca entra em argumentos, histórico ou saída.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const { hashPassword } = require('../src/services/password');
const { root } = require('../src/config');
async function configure() {
  if (!process.stdin.isTTY) throw Error('Use um terminal interativo.');
  const reset = process.argv.slice(2).includes('--reset');
  if (process.argv.slice(2).some(arg => arg !== '--reset')) throw Error('Argumento inválido.');
  let config;
  if (reset) {
    if (process.env.MAINTENANCE_MODE !== 'true') throw Error('Pare o servidor e habilite manutenção.');
    const settings = require('../src/config'); settings.loadEnvironment(); config = settings.getConfig();
    if (!config.admin.enabled || !fs.existsSync(config.databasePath)) throw Error('Administrador não configurado.');
  }
  const filename = path.join(root,'.env');
  const previous = fs.existsSync(filename) ? fs.readFileSync(filename,'utf8') : '';
  if (!reset && /^\s*(?:ADMIN_USER|ADMIN_PASSWORD_HASH|SESSION_SECRET)\s*=/m.test(previous)) throw Error('Credenciais já configuradas. Faça a rotação manual no arquivo privado.');
  let muted = false;
  const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk,encoding); callback(); } });
  const rl = readline.createInterface({ input:process.stdin, output, terminal:true, historySize:0 });
  try {
    const username = reset ? config.admin.user : (await rl.question('Usuário administrativo (letras, números, ponto, hífen): ')).trim();
    if (!/^[a-zA-Z0-9._-]{3,120}$/.test(username)) throw Error('Usuário inválido.');
    process.stdout.write('Senha (15–256 caracteres, entrada oculta): '); muted = true;
    const password = await rl.question(''); process.stdout.write('\nConfirme a senha: ');
    const confirmation = await rl.question(''); muted = false; process.stdout.write('\n');
    if (password !== confirmation) throw Error('As senhas não coincidem.');
    const hash = await hashPassword(password);
    if (reset) {
      const db = require('../src/db/database').openDatabase(config.databasePath);
      try { new (require('../src/repositories/credential-repository').CredentialRepository)(db).save(username, hash); } finally { db.close(); }
      console.log('Senha redefinida. Reinicie o servidor para invalidar os acessos anteriores.');
      return;
    }
    const content = previous + '\nADMIN_USER=' + username + "\nADMIN_PASSWORD_HASH='" + hash + "'\nSESSION_SECRET=" + crypto.randomBytes(32).toString('hex') + '\n';
    // Sem sobrescrever .env existente; somente acrescenta as credenciais solicitadas.
    const fd = fs.openSync(filename, 'a', 0o600);
    try { fs.fchmodSync(fd,0o600); fs.writeFileSync(fd,content.slice(previous.length)); } finally { fs.closeSync(fd); }
    console.log('Administrador configurado no .env privado. Configure APP_ORIGIN e reinicie o servidor.');
  } finally { rl.close(); }
}
configure().catch(() => { console.error('Não foi possível configurar. Use um terminal interativo, senha de 15–256 caracteres confirmada e um .env sem credenciais existentes; para redefinir, pare o servidor e use MAINTENANCE_MODE=true com --reset.'); process.exitCode = 1; });
