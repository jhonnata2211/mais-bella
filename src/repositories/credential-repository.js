const { validHash } = require('../services/password');
class CredentialRepository {
  constructor(db) { this.db = db; }
  hash(username, fallback) {
    const row = this.db.prepare('SELECT username,password_hash FROM admin_credentials WHERE id=1').get();
    if (!row) return fallback;
    if (row.username !== username || !validHash(row.password_hash)) throw Error('Configuração administrativa inconsistente.');
    return row.password_hash;
  }
  save(username, hash) {
    if (!validHash(hash)) throw Error('Hash inválido.');
    this.db.prepare(`INSERT INTO admin_credentials (id,username,password_hash,updated_at) VALUES (1,?,?,?)
      ON CONFLICT(id) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash,updated_at=excluded.updated_at`)
      .run(username, hash, new Date().toISOString());
  }
}
module.exports = { CredentialRepository };
