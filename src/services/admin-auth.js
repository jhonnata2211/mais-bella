const crypto = require('node:crypto');
const { verifyPassword } = require('./password');
const random = () => crypto.randomBytes(32).toString('hex');
// Um processo: reiniciar invalida todas as sessões e os limites em memória.
class AdminAuth {
  constructor(config, now = Date.now) { this.config = config; this.now = now; this.sessions = new Map(); this.attempts = new Map(); this.inflight = 0; }
  key(token) { return crypto.createHmac('sha256', this.config.secret).update(token).digest('hex'); }
  cleanup() {
    const now = this.now();
    for (const [k,v] of this.sessions) if (v.expires <= now) this.sessions.delete(k);
    for (const [k,v] of this.attempts) if (v.until <= now) this.attempts.delete(k);
  }
  session(token) { this.cleanup(); return token ? this.sessions.get(this.key(token)) : null; }
  invalidate(token) { if (token) this.sessions.delete(this.key(token)); }
  invalidateAll() { this.sessions.clear(); }
  create() {
    this.cleanup();
    if (this.sessions.size >= 1000) this.sessions.delete(this.sessions.keys().next().value);
    const token = random();
    const session = { csrf: random(), expires: this.now() + this.config.sessionMs };
    this.sessions.set(this.key(token), session);
    return { token, ...session };
  }
  async login(ip, user, password) {
    this.cleanup();
    const entry = this.attempts.get(ip) || { count: 0, until: this.now() + 15 * 60 * 1000 };
    if (entry.count >= 5 || this.inflight >= 2 || this.attempts.size >= 10000 && !this.attempts.has(ip)) return 'limited';
    entry.count++; this.attempts.set(ip, entry); this.inflight++;
    try {
      const expectedHash = this.config.passwordHash;
      const valid = await verifyPassword(password, expectedHash);
      if (!valid || expectedHash !== this.config.passwordHash || user !== this.config.user) return false;
      return true;
    } finally { this.inflight--; }
  }
}
module.exports = { AdminAuth };
