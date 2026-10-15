const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrate(db) {
  transaction(db, () => {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL
    ) STRICT`);
    const directory = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(directory).filter(name => /^\d+_[a-z_]+\.sql$/.test(name)).sort();
    const existing = db.prepare('SELECT name, checksum FROM schema_migrations').all();
    for (const row of existing) if (!files.includes(row.name)) throw new Error('Migration aplicada ausente no código.');
    for (const name of files) {
      const sql = fs.readFileSync(path.join(directory, name), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const applied = existing.find(row => row.name === name);
      if (applied) {
        if (applied.checksum !== checksum) throw new Error('Migration aplicada foi modificada. Crie uma nova migration.');
        continue;
      }
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations VALUES (?,?,?)').run(name, checksum, new Date().toISOString());
    }
  });
}

function openDatabase(filename) {
  if (!filename || typeof filename !== 'string') throw new Error('Informe explicitamente o arquivo SQLite.');
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    db.function('normalize_text', { deterministic: true }, value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    // WAL permite leitura enquanto outro processo executa o seed em transação.
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    migrate(db);
    return db;
  } catch (error) { db.close(); throw error; }
}

module.exports = { openDatabase, migrate, transaction };
