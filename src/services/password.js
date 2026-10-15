const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function validHash(value) { return typeof value === 'string' && /^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value); }
async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 15 || password.length > 256) throw Error('Use uma senha entre 15 e 256 caracteres.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, options);
  return ['scrypt',32768,8,3,salt,hash.toString('hex')].join('$');
}
async function verifyPassword(password, encoded) {
  if (!validHash(encoded) || typeof password !== 'string' || password.length > 256) return false;
  const parts = encoded.split('$');
  const hash = await scrypt(password, parts[4], 64, options);
  return crypto.timingSafeEqual(hash, Buffer.from(parts[5], 'hex'));
}
module.exports = { hashPassword, verifyPassword, validHash };
