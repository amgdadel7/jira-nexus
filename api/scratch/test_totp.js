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
  const clean = str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
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
  if (!cleanToken || cleanToken.length !== digits) return false;

  for (let error = -window; error <= window; error++) {
    const candidate = generateTOTP(secret, { timestamp: timestamp + error * step * 1000, step, digits });
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(cleanToken))) {
      return true;
    }
  }
  return false;
}

// Test vectors from RFC 6238 for SHA1 with secret "12345678901234567890"
const rfcSecret = Buffer.from('12345678901234567890', 'ascii');
const b32Secret = base32Encode(rfcSecret);
console.log('Base32 secret:', b32Secret);

// At time 59s: count 1, TOTP = 287082
const t59 = generateTOTP(rfcSecret, { timestamp: 59000 });
console.log('T=59s expected 287082, got:', t59);

// At time 1111111109s: TOTP = 081804
const t111 = generateTOTP(rfcSecret, { timestamp: 1111111109000 });
console.log('T=1111111109s expected 081804, got:', t111);

// Test verification
console.log('Verify t59:', verifyTOTP(t59, b32Secret, { timestamp: 59000 }));
console.log('Verify t59 wrong:', verifyTOTP('000000', b32Secret, { timestamp: 59000 }));
console.log('Verify t59 drift +1:', verifyTOTP(t59, b32Secret, { timestamp: 65000, window: 1 }));
