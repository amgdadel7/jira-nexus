'use strict';

const crypto = require('crypto');

/**
 * Talks to the real OAuth 2.0 / OpenID Connect providers (Google, Microsoft, Apple, Slack).
 * Knows only endpoints and wire formats — which provider is enabled and with which credentials
 * is decided by the application layer and passed in as `credentials`.
 * Redirect URI to register with each provider: <PUBLIC_URL>/api/auth/oauth/<provider>/callback
 */
const PROVIDERS = Object.freeze({
  google: {
    name: 'Google', console: 'https://console.cloud.google.com/apis/credentials', fields: ['clientId', 'clientSecret'],
    authUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    userinfoUrl: () => 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile', extraAuth: { prompt: 'select_account', access_type: 'online' },
  },
  microsoft: {
    name: 'Microsoft', console: 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade', fields: ['clientId', 'clientSecret', 'tenant'],
    authUrl: (c) => `https://login.microsoftonline.com/${encodeURIComponent(c.tenant || 'common')}/oauth2/v2.0/authorize`,
    tokenUrl: (c) => `https://login.microsoftonline.com/${encodeURIComponent(c.tenant || 'common')}/oauth2/v2.0/token`,
    userinfoUrl: () => 'https://graph.microsoft.com/oidc/userinfo',
    scope: 'openid email profile', extraAuth: { prompt: 'select_account', response_mode: 'query' },
  },
  apple: {
    name: 'Apple', console: 'https://developer.apple.com/account/resources/identifiers/list/serviceId', fields: ['clientId', 'teamId', 'keyId', 'privateKey'],
    authUrl: () => 'https://appleid.apple.com/auth/authorize',
    tokenUrl: () => 'https://appleid.apple.com/auth/token',
    userinfoUrl: () => null, // Apple only returns an id_token
    scope: 'name email', extraAuth: { response_mode: 'form_post' },
  },
  slack: {
    name: 'Slack', console: 'https://api.slack.com/apps', fields: ['clientId', 'clientSecret'],
    authUrl: () => 'https://slack.com/openid/connect/authorize',
    tokenUrl: () => 'https://slack.com/api/openid.connect.token',
    userinfoUrl: () => 'https://slack.com/api/openid.connect.userInfo',
    scope: 'openid email profile', extraAuth: {},
  },
});
const ENDPOINT_OVERRIDES = ['authUrl', 'tokenUrl', 'userinfoUrl'];
const TIMEOUT_MS = 15_000;

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const providerError = (message) => Object.assign(new Error(message), { status: 400 });

function decodeJwt(token) {
  try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')); } catch { return null; }
}

/** Apple wants a short-lived ES256 JWT signed with the .p8 key as the client secret. */
function appleClientSecret(c) {
  const iat = Math.floor(Date.now() / 1000);
  const input = `${b64url(JSON.stringify({ alg: 'ES256', kid: c.keyId, typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: c.teamId, iat, exp: iat + 300, aud: 'https://appleid.apple.com', sub: c.clientId }))}`;
  const signature = crypto.sign('sha256', Buffer.from(input), { key: c.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64url(signature)}`;
}

class OAuthGateway {
  /** @param {{ allowEndpointOverrides?: boolean, fetchImpl?: typeof fetch }} options – overrides let tests use a fake provider */
  constructor({ allowEndpointOverrides = false, fetchImpl = globalThis.fetch } = {}) {
    this.allowOverrides = allowEndpointOverrides;
    this.fetch = fetchImpl;
  }

  get keys() { return Object.keys(PROVIDERS); }
  get overridableFields() { return this.allowOverrides ? ENDPOINT_OVERRIDES : []; }
  info(key) { return PROVIDERS[key] || null; }

  endpoints(key, c) {
    const p = PROVIDERS[key];
    const o = this.allowOverrides ? c : {};
    return { authUrl: o.authUrl || p.authUrl(c), tokenUrl: o.tokenUrl || p.tokenUrl(c), userinfoUrl: o.userinfoUrl !== undefined ? o.userinfoUrl : p.userinfoUrl(c) };
  }

  authorizeUrl(key, credentials, { redirectUri, state, nonce }) {
    const p = PROVIDERS[key];
    const { authUrl } = this.endpoints(key, credentials);
    const params = new URLSearchParams({ client_id: credentials.clientId, redirect_uri: redirectUri, response_type: 'code', scope: p.scope, state, nonce, ...p.extraAuth });
    return `${authUrl}${authUrl.includes('?') ? '&' : '?'}${params}`;
  }

  /** Exchanges the authorization code → normalised profile { subject, email, emailVerified, name, picture }. */
  async exchange(key, credentials, { code, redirectUri, nonce, appleUser }) {
    const p = PROVIDERS[key];
    const e = this.endpoints(key, credentials);
    const body = new URLSearchParams({ grant_type: 'authorization_code', code: String(code), redirect_uri: redirectUri, client_id: credentials.clientId });
    body.set('client_secret', key === 'apple' ? appleClientSecret(credentials) : credentials.clientSecret);
    const tr = await this.fetch(e.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const tok = await tr.json().catch(() => ({}));
    if (!tr.ok || tok.error || tok.ok === false || (!tok.access_token && !tok.id_token)) {
      throw providerError(`${p.name} rejected the sign-in (${tok.error_description || tok.error || `HTTP ${tr.status}`}).`);
    }
    const claims = tok.id_token ? decodeJwt(tok.id_token) || {} : {};
    if (claims.nonce && nonce && claims.nonce !== nonce) throw providerError('The sign-in response could not be verified (nonce mismatch).');
    if (claims.aud && ![].concat(claims.aud).includes(credentials.clientId)) throw providerError('The sign-in response was issued for a different application.');
    let info = {};
    if (e.userinfoUrl && tok.access_token) {
      const ur = await this.fetch(e.userinfoUrl, { headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      info = await ur.json().catch(() => ({}));
      if (!ur.ok || info.ok === false) throw providerError(`Could not read your ${p.name} profile.`);
    }
    const profile = { ...claims, ...info };
    let name = profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ');
    if (!name && appleUser) {
      try { const u = JSON.parse(appleUser); name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' '); } catch { /* Apple sends `user` only on first sign-in */ }
    }
    const email = String(profile.email || (key === 'microsoft' ? profile.preferred_username : '') || '').toLowerCase();
    return {
      subject: String(profile.sub || profile.oid || profile['https://slack.com/user_id'] || ''),
      email,
      emailVerified: !(profile.email_verified === false || profile.email_verified === 'false'),
      name: name || email.split('@')[0],
      picture: profile.picture || null,
    };
  }
}

module.exports = { OAuthGateway, PROVIDERS, decodeJwt, appleClientSecret };
