'use strict';

const crypto = require('crypto');

/** scrypt password hash stored as "salt:hash". */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(password), salt, 32);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const randomHex = (bytes) => crypto.randomBytes(bytes).toString('hex');
const hmacSha256 = (secret, payload) => crypto.createHmac('sha256', secret).update(payload).digest('hex');
const uuid = () => crypto.randomUUID();
/** Uniformly random numeric code, zero-padded (e.g. 6-digit e-mail codes). */
const randomCode = (digits) => String(crypto.randomInt(0, 10 ** digits)).padStart(digits, '0');

module.exports = { hashPassword, verifyPassword, sha256, randomHex, hmacSha256, uuid, randomCode };
