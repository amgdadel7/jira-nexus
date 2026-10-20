'use strict';

const crypto = require('crypto');

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_CHARS.indexOf(clean[i]);
    if (idx === -1) throw new Error(`Invalid Base32 character: ${clean[i]}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

function generateTOTP(secret, { timestamp = Date.now(), step = 30, digits = 6 } = {}) {
  const key = typeof secret === 'string' ? base32Decode(secret) : secret;
  const counter = Math.floor(timestamp / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  return String(codeInt % mod).padStart(digits, '0');
}

function verifyTOTP(token, secret, { timestamp = Date.now(), step = 30, window = 1, digits = 6 } = {}) {
  const cleanToken = String(token || '').replace(/\s+/g, '');
  if (!cleanToken || cleanToken.length !== digits || !/^\d+$/.test(cleanToken)) return false;

  for (let error = -window; error <= window; error++) {
    const candidate = generateTOTP(secret, { timestamp: timestamp + error * step * 1000, step, digits });
    if (candidate.length === cleanToken.length && crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(cleanToken))) {
      return true;
    }
  }
  return false;
}

function generateOtpAuthUri({ secret, accountName, issuer = 'Masar' }) {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const p1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const p2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const p3 = crypto.randomBytes(2).toString('hex').toUpperCase();
    codes.push(`${p1}-${p2}-${p3}`);
  }
  return codes;
}

function encryptSecret(plaintext, keyHex) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(String(keyHex || 'masar_default_secure_secret')).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(ciphertext, keyHex) {
  if (!ciphertext || !ciphertext.includes(':')) return ciphertext;
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext;
  const [ivHex, tagHex, dataHex] = parts;
  try {
    const key = crypto.createHash('sha256').update(String(keyHex || 'masar_default_secure_secret')).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

module.exports = {
  base32Encode,
  base32Decode,
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateOtpAuthUri,
  generateBackupCodes,
  encryptSecret,
  decryptSecret,
};
