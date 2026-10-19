const crypto = require('crypto');
const db = require('./db');

const SESSION_DAYS = 14;          // "Remember me"
const SHORT_SESSION_HOURS = 12;   // browser session only
const RESET_MINUTES = 30;
const COOKIE = 'jc_session';

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

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const p = part.trim();
    const i = p.indexOf('=');
    if (i < 1) continue;
    try { out[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1)); } catch { /* ignore malformed cookie */ }
  }
  return out;
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function createSession(userId, { remember = true, userAgent = '' } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + (remember ? SESSION_DAYS * 864e5 : SHORT_SESSION_HOURS * 36e5));
  db.prepare('INSERT INTO sessions (token,user_id,created_at,expires_at,user_agent,last_seen_at,remember) VALUES (?,?,?,?,?,?,?)')
    .run(token, userId, now.toISOString(), expires.toISOString(), String(userAgent).slice(0, 300), now.toISOString(), remember ? 1 : 0);
  return { token, expires, remember };
}

/**
 * The app is often embedded in an iframe on another site (e.g. a preview pane). Browsers do not send
 * SameSite=Lax cookies in cross-site iframes, so over HTTPS we use SameSite=None; Secure; Partitioned.
 * The client also sends the token as a Bearer header, so auth works even when cookies are blocked.
 */
function cookieAttrs(req) {
  const https = req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return https ? 'Path=/; HttpOnly; SameSite=None; Secure; Partitioned' : 'Path=/; HttpOnly; SameSite=Lax';
}
function setSessionCookie(req, res, { token, expires, remember }) {
  res.append('Set-Cookie', `${COOKIE}=${token}; ${cookieAttrs(req)}${remember ? `; Expires=${expires.toUTCString()}` : ''}`);
}
function clearSessionCookie(req, res) {
  res.append('Set-Cookie', `${COOKIE}=; ${cookieAttrs(req)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
}

const publicUser = (u) => u && ({ id: u.id, name: u.name, email: u.email, color: u.color, role: u.role, active: !!u.active, title: u.title || '',
  avatarUrl: u.avatar ? `/api/avatars/${u.avatar}` : null, ...(u.bot ? { bot: true } : {}) });

const touch = db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?');

/**
 * Express middleware: resolves req.user from `Authorization: Bearer <token>` or the session cookie.
 * `?access_token=` is accepted only for GET attachment downloads, because <img src> and download
 * links cannot send headers.
 */
function authenticate(req, res, next) {
  // The token can arrive four ways. Some preview proxies strip or replace `Authorization`, and
  // embedded iframes often block cookies, so the client also sends `X-JC-Auth` and, as a last resort,
  // `?access_token=`.
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')?.[1];
  const custom = typeof req.headers['x-jc-auth'] === 'string' ? req.headers['x-jc-auth'].trim() : null;
  const queryToken = typeof req.query?.access_token === 'string' ? req.query.access_token : null;
  const cookieToken = parseCookies(req.headers.cookie)[COOKIE];
  req.authSeen = { authorization: !!req.headers.authorization, header: !!custom, query: !!queryToken, cookie: !!cookieToken };
  const pat = [bearer, custom, queryToken].find((t) => t && t.startsWith(PAT_PREFIX));
  if (pat) { authenticateToken(req, pat); if (!req.user) req.authFailure = 'invalid_token'; return next(); }
  const candidates = [custom, bearer, queryToken, cookieToken].filter((t, i, a) => typeof t === 'string' && /^[a-f0-9]{64}$/.test(t) && a.indexOf(t) === i);
  const now = new Date();
  for (const token of candidates) {
    const row = db.prepare('SELECT u.*, s.expires_at, s.last_seen_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token);
    if (row && row.expires_at > now.toISOString() && row.active) {
      req.user = row;
      req.sessionToken = token;
      if (!row.last_seen_at || now - new Date(row.last_seen_at) > 5 * 60e3) touch.run(now.toISOString(), token);
      break;
    }
    req.authFailure = !row ? 'unknown_session' : !row.active ? 'deactivated' : 'expired';
  }
  if (!req.user && !candidates.length) req.authFailure = 'no_credentials';
  next();
}

// ---------- personal API tokens ----------
// Format: jcpat_<48 hex>. Only a SHA-256 hash is stored; the plain token is shown once at creation.
const PAT_PREFIX = 'jcpat_';
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
function createApiToken(userId, name, expiresInDays) {
  const token = PAT_PREFIX + crypto.randomBytes(24).toString('hex');
  const now = new Date();
  const expires = expiresInDays ? new Date(now.getTime() + expiresInDays * 864e5).toISOString() : null;
  const info = db.prepare('INSERT INTO api_tokens (user_id,name,token_hash,prefix,created_at,expires_at) VALUES (?,?,?,?,?,?)')
    .run(userId, name, hashToken(token), token.slice(0, 12), now.toISOString(), expires);
  return { id: info.lastInsertRowid, token };
}
function authenticateToken(req, token) {
  if (!/^jcpat_[a-f0-9]{48}$/.test(token)) return;
  const row = db.prepare('SELECT u.*, t.id AS token_id, t.expires_at AS token_expires, t.last_used_at AS token_used FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?').get(hashToken(token));
  const now = new Date();
  if (!row || !row.active || (row.token_expires && row.token_expires <= now.toISOString())) return;
  req.user = row;
  req.apiTokenId = row.token_id;
  if (!row.token_used || now - new Date(row.token_used) > 60e3) db.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?').run(now.toISOString(), row.token_id);
}
const apiTokenOut = (t) => ({ id: t.id, name: t.name, prefix: t.prefix, created: t.created_at, lastUsed: t.last_used_at, expires: t.expires_at, expired: !!t.expires_at && t.expires_at <= new Date().toISOString() });

/** 401 body with a machine-readable reason, so the client can tell "expired" from "token never arrived". */
function unauthorized(req, res) {
  const reason = req.authFailure || 'no_credentials';
  if (process.env.NODE_ENV !== 'test') console.warn(`[auth] 401 ${req.method} ${req.originalUrl.split('?')[0]} reason=${reason} seen=${JSON.stringify(req.authSeen || {})}`);
  const error = reason === 'no_credentials' ? 'You are not logged in.' : 'Your session has expired. Please log in again.';
  return res.status(401).json({ error, code: 'unauthenticated', reason, seen: req.authSeen || {} });
}
function requireAuth(req, res, next) {
  if (!req.user) return unauthorized(req, res);
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user) return unauthorized(req, res);
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only administrators can do that.' });
  next();
}

/** Password reset tokens: only a hash is stored, valid for 30 minutes, single use. */
function createResetToken(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  const now = new Date();
  db.prepare('DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?').run(userId, now.toISOString());
  db.prepare('INSERT INTO password_resets (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)')
    .run(sha256(token), userId, now.toISOString(), new Date(now.getTime() + RESET_MINUTES * 60e3).toISOString());
  return token;
}
function consumeResetToken(token) {
  const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(sha256(String(token || '')));
  if (!row || row.used_at || row.expires_at < new Date().toISOString()) return null;
  db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').run(new Date().toISOString(), row.token_hash);
  return row.user_id;
}
function peekResetToken(token) {
  const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(sha256(String(token || '')));
  return row && !row.used_at && row.expires_at >= new Date().toISOString() ? row.user_id : null;
}

module.exports = {
  createApiToken, apiTokenOut, PAT_PREFIX,
  hashPassword, verifyPassword, createSession, setSessionCookie, clearSessionCookie, authenticate, requireAuth, requireAdmin,
  publicUser, createResetToken, consumeResetToken, peekResetToken, COOKIE,
};
