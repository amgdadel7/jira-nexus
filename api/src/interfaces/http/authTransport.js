'use strict';

/**
 * How the session token travels between browser and server.
 *
 * The app is often embedded in an iframe on another site (a preview pane). Browsers do not send
 * SameSite=Lax cookies in cross-site iframes, so over HTTPS the cookie is SameSite=None; Secure;
 * Partitioned. Some preview proxies strip `Authorization`, so the client also sends `X-JC-Auth`
 * and, as a last resort, `?access_token=`.
 */
const COOKIE = 'jc_session';

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

function cookieAttributes(req) {
  const https = req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return https ? 'Path=/; HttpOnly; SameSite=None; Secure; Partitioned' : 'Path=/; HttpOnly; SameSite=Lax';
}

function setSessionCookie(req, res, { token, expires, remember }) {
  res.append('Set-Cookie', `${COOKIE}=${token}; ${cookieAttributes(req)}${remember ? `; Expires=${expires.toUTCString()}` : ''}`);
}

function clearSessionCookie(req, res) {
  res.append('Set-Cookie', `${COOKIE}=; ${cookieAttributes(req)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
}

/** Every credential the request carries, in the order they are tried. */
function readCredentials(req) {
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')?.[1] || null;
  const header = typeof req.headers['x-jc-auth'] === 'string' ? req.headers['x-jc-auth'].trim() : null;
  const query = typeof req.query?.access_token === 'string' ? req.query.access_token : null;
  const cookie = parseCookies(req.headers.cookie)[COOKIE] || null;
  return {
    bearer, header, query, cookie,
    seen: { authorization: !!req.headers.authorization, header: !!header, query: !!query, cookie: !!cookie },
  };
}

module.exports = { COOKIE, parseCookies, setSessionCookie, clearSessionCookie, readCredentials };
