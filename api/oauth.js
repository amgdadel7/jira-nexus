// Social login with real OAuth 2.0 / OpenID Connect providers: Google, Microsoft, Apple and Slack.
//
// Credentials come from Settings → Authentication (stored in site_settings) or environment variables:
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
//   MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_TENANT (default "common")
//   SLACK_CLIENT_ID / SLACK_CLIENT_SECRET
//   APPLE_CLIENT_ID (Services ID) / APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY (.p8 contents)
// Redirect URI to register with each provider:  <PUBLIC_URL>/api/auth/oauth/<provider>/callback
const crypto = require('crypto');
const db = require('./db');

const ALLOW_ENDPOINT_OVERRIDES = process.env.NODE_ENV !== 'production'; // lets tests use a fake provider

const PROVIDERS = {
  google: {
    name: 'Google', console: 'https://console.cloud.google.com/apis/credentials',
    fields: ['clientId', 'clientSecret'],
    authUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    userinfoUrl: () => 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile', extraAuth: { prompt: 'select_account', access_type: 'online' }, nonce: true,
  },
  microsoft: {
    name: 'Microsoft', console: 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    fields: ['clientId', 'clientSecret', 'tenant'],
    authUrl: (c) => `https://login.microsoftonline.com/${encodeURIComponent(c.tenant || 'common')}/oauth2/v2.0/authorize`,
    tokenUrl: (c) => `https://login.microsoftonline.com/${encodeURIComponent(c.tenant || 'common')}/oauth2/v2.0/token`,
    userinfoUrl: () => 'https://graph.microsoft.com/oidc/userinfo',
    scope: 'openid email profile', extraAuth: { prompt: 'select_account', response_mode: 'query' }, nonce: true,
  },
  apple: {
    name: 'Apple', console: 'https://developer.apple.com/account/resources/identifiers/list/serviceId',
    fields: ['clientId', 'teamId', 'keyId', 'privateKey'],
    authUrl: () => 'https://appleid.apple.com/auth/authorize',
    tokenUrl: () => 'https://appleid.apple.com/auth/token',
    userinfoUrl: () => null, // Apple only returns an id_token
    scope: 'name email', extraAuth: { response_mode: 'form_post' }, nonce: true,
  },
  slack: {
    name: 'Slack', console: 'https://api.slack.com/apps',
    fields: ['clientId', 'clientSecret'],
    authUrl: () => 'https://slack.com/openid/connect/authorize',
    tokenUrl: () => 'https://slack.com/api/openid.connect.token',
    userinfoUrl: () => 'https://slack.com/api/openid.connect.userInfo',
    scope: 'openid email profile', extraAuth: {}, nonce: true,
  },
};
const KEYS = Object.keys(PROVIDERS);

// ---------- settings ----------
function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}
function setSetting(key, value) {
  db.prepare('INSERT INTO site_settings (key,value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
}

const ENV = {
  google: { clientId: 'GOOGLE_CLIENT_ID', clientSecret: 'GOOGLE_CLIENT_SECRET' },
  microsoft: { clientId: 'MICROSOFT_CLIENT_ID', clientSecret: 'MICROSOFT_CLIENT_SECRET', tenant: 'MICROSOFT_TENANT' },
  slack: { clientId: 'SLACK_CLIENT_ID', clientSecret: 'SLACK_CLIENT_SECRET' },
  apple: { clientId: 'APPLE_CLIENT_ID', teamId: 'APPLE_TEAM_ID', keyId: 'APPLE_KEY_ID', privateKey: 'APPLE_PRIVATE_KEY' },
};

/** Effective config of one provider (settings win over environment variables). */
function config(provider) {
  const saved = (getSetting('oauth', {}) || {})[provider] || {};
  const env = {};
  for (const [f, v] of Object.entries(ENV[provider] || {})) if (process.env[v]) env[f] = f === 'privateKey' ? process.env[v].replace(/\\n/g, '\n') : process.env[v];
  const c = { ...env, ...Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== '' && v != null)) };
  const required = PROVIDERS[provider].fields.filter((f) => f !== 'tenant');
  c.configured = required.every((f) => c[f]);
  c.enabled = c.configured && (saved.enabled !== undefined ? !!saved.enabled : Object.keys(env).length > 0);
  c.source = Object.keys(saved).some((k) => PROVIDERS[provider].fields.includes(k) && saved[k]) ? 'settings' : Object.keys(env).length ? 'environment' : null;
  return c;
}
function endpoints(provider, c) {
  const p = PROVIDERS[provider];
  const o = ALLOW_ENDPOINT_OVERRIDES ? c : {};
  return { authUrl: o.authUrl || p.authUrl(c), tokenUrl: o.tokenUrl || p.tokenUrl(c), userinfoUrl: o.userinfoUrl !== undefined ? o.userinfoUrl : p.userinfoUrl(c) };
}

function publicBase(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}
const redirectUri = (req, provider) => `${publicBase(req)}/api/auth/oauth/${provider}/callback`;

// ---------- Apple client secret (ES256 JWT) ----------
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function appleClientSecret(c) {
  const header = { alg: 'ES256', kid: c.keyId, typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const payload = { iss: c.teamId, iat, exp: iat + 300, aud: 'https://appleid.apple.com', sub: c.clientId };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.sign('sha256', Buffer.from(input), { key: c.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64url(sig)}`;
}

// ---------- flow ----------
function startUrl(req, provider, { mode = 'login', popup = false, remember = true } = {}) {
  const p = PROVIDERS[provider];
  const c = config(provider);
  const e = endpoints(provider, c);
  const state = crypto.randomBytes(24).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  db.prepare('DELETE FROM oauth_states WHERE created_at < ?').run(new Date(Date.now() - 15 * 60_000).toISOString());
  db.prepare('INSERT INTO oauth_states (state,provider,mode,popup,remember,nonce,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(state, provider, mode === 'signup' ? 'signup' : 'login', popup ? 1 : 0, remember ? 1 : 0, nonce, new Date().toISOString());
  const params = new URLSearchParams({ client_id: c.clientId, redirect_uri: redirectUri(req, provider), response_type: 'code', scope: p.scope, state, ...p.extraAuth });
  if (p.nonce) params.set('nonce', nonce);
  return `${e.authUrl}${e.authUrl.includes('?') ? '&' : '?'}${params}`;
}

function takeState(state, provider) {
  const row = db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(String(state || ''));
  if (row) db.prepare('DELETE FROM oauth_states WHERE state = ?').run(row.state);
  if (!row || row.provider !== provider || Date.now() - new Date(row.created_at).getTime() > 15 * 60_000) return null;
  return row;
}

function decodeJwt(token) {
  try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')); } catch { return null; }
}

/** Exchanges the authorization code and returns a normalised profile { subject, email, emailVerified, name, picture }. */
async function exchange(req, provider, code, stateRow, extra = {}) {
  const c = config(provider);
  const e = endpoints(provider, c);
  const body = new URLSearchParams({ grant_type: 'authorization_code', code: String(code), redirect_uri: redirectUri(req, provider), client_id: c.clientId });
  body.set('client_secret', provider === 'apple' ? appleClientSecret(c) : c.clientSecret);
  const tr = await fetch(e.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body, signal: AbortSignal.timeout(15000) });
  const tok = await tr.json().catch(() => ({}));
  if (!tr.ok || tok.error || tok.ok === false || (!tok.access_token && !tok.id_token)) {
    throw Object.assign(new Error(`${PROVIDERS[provider].name} rejected the sign-in (${tok.error_description || tok.error || `HTTP ${tr.status}`}).`), { status: 400 });
  }
  const claims = tok.id_token ? decodeJwt(tok.id_token) || {} : {};
  if (claims.nonce && stateRow.nonce && claims.nonce !== stateRow.nonce) throw Object.assign(new Error('The sign-in response could not be verified (nonce mismatch).'), { status: 400 });
  if (claims.aud && ![].concat(claims.aud).includes(c.clientId)) throw Object.assign(new Error('The sign-in response was issued for a different application.'), { status: 400 });
  let info = {};
  if (e.userinfoUrl && tok.access_token) {
    const ur = await fetch(e.userinfoUrl, { headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    info = await ur.json().catch(() => ({}));
    if (!ur.ok || info.ok === false) throw Object.assign(new Error(`Could not read your ${PROVIDERS[provider].name} profile.`), { status: 400 });
  }
  const p = { ...claims, ...info };
  let name = p.name || [p.given_name, p.family_name].filter(Boolean).join(' ');
  if (!name && extra.appleUser) { try { const u = JSON.parse(extra.appleUser); name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' '); } catch { /* ignore */ } }
  const email = String(p.email || (provider === 'microsoft' ? p.preferred_username : '') || '').toLowerCase();
  const ev = p.email_verified;
  return {
    subject: String(p.sub || p.oid || p['https://slack.com/user_id'] || ''),
    email, emailVerified: !(ev === false || ev === 'false'),
    name: name || email.split('@')[0], picture: p.picture || null,
  };
}

module.exports = { PROVIDERS, KEYS, config, endpoints, redirectUri, startUrl, takeState, exchange, getSetting, setSetting, decodeJwt, appleClientSecret, ALLOW_ENDPOINT_OVERRIDES };
