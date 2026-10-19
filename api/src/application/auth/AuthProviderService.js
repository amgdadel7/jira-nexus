'use strict';

const { bad, notFound } = require('../../shared/errors');

const SECRET_FIELDS = ['clientSecret', 'privateKey'];
const SETTINGS_KEY = 'oauth';

/**
 * Which social-login providers are enabled and with which credentials.
 * Credentials saved in Settings → Authentication win over environment variables.
 */
class AuthProviderService {
  constructor({ settingsRepo, identityRepo, oauthGateway, audit, config }) {
    Object.assign(this, { settings: settingsRepo, identities: identityRepo, gateway: oauthGateway, audit, env: config.oauthEnv || {} });
  }

  info(key) {
    const p = this.gateway.info(key);
    if (!p) throw notFound('Unknown sign-in provider.');
    return p;
  }

  async saved() {
    return (await this.settings.get(SETTINGS_KEY, {})) || {};
  }

  /** Effective credentials of one provider + { configured, enabled, source }. */
  async credentials(key, saved = null) {
    const p = this.info(key);
    const stored = (saved || (await this.saved()))[key] || {};
    const env = Object.fromEntries(Object.entries(this.env[key] || {}).filter(([, v]) => v));
    const c = { ...env, ...Object.fromEntries(Object.entries(stored).filter(([, v]) => v !== '' && v != null)) };
    const configured = p.fields.filter((f) => f !== 'tenant').every((f) => c[f]);
    return {
      ...c,
      configured,
      enabled: configured && (stored.enabled !== undefined ? Boolean(stored.enabled) : Object.keys(env).length > 0),
      source: p.fields.some((f) => stored[f]) ? 'settings' : Object.keys(env).length ? 'environment' : null,
    };
  }

  /** For the public login screen. */
  async publicList() {
    const saved = await this.saved();
    const out = {};
    for (const key of this.gateway.keys) out[key] = { name: this.info(key).name, enabled: (await this.credentials(key, saved)).enabled };
    return out;
  }

  async describe(key, redirectUri) {
    const p = this.info(key);
    const c = await this.credentials(key);
    const out = {
      key, name: p.name, enabled: c.enabled, configured: c.configured, source: c.source, console: p.console, fields: p.fields, redirectUri,
      clientId: c.clientId || '', users: await this.identities.countByProvider(key),
    };
    if (p.fields.includes('clientSecret')) out.hasClientSecret = Boolean(c.clientSecret);
    if (p.fields.includes('tenant')) out.tenant = c.tenant || 'common';
    if (p.fields.includes('teamId')) Object.assign(out, { teamId: c.teamId || '', keyId: c.keyId || '', hasPrivateKey: Boolean(c.privateKey) });
    return out;
  }

  async list(redirectUriFor) {
    const out = [];
    for (const key of this.gateway.keys) out.push(await this.describe(key, redirectUriFor(key)));
    return out;
  }

  async update(actor, key, body, redirectUri) {
    const p = this.info(key);
    const all = await this.saved();
    const next = { ...(all[key] || {}) };
    for (const field of [...p.fields, ...this.gateway.overridableFields]) {
      if (body[field] === undefined) continue;
      if (SECRET_FIELDS.includes(field) && body[field] === '') continue; // blank = keep the stored secret
      next[field] = body[field] === null ? '' : String(body[field]).trim();
    }
    if (body.clearSecret) SECRET_FIELDS.forEach((f) => delete next[f]);
    if (next.privateKey && !/BEGIN PRIVATE KEY/.test(next.privateKey)) throw bad('Paste the full contents of the Apple .p8 key file, including the BEGIN/END lines.');
    if (body.enabled !== undefined) next.enabled = Boolean(body.enabled);
    const merged = { ...all, [key]: next };
    if (next.enabled && !(await this.credentials(key, merged)).configured) {
      throw bad(`Fill in ${p.fields.filter((f) => f !== 'tenant').join(', ')} before enabling ${p.name}.`);
    }
    await this.settings.set(SETTINGS_KEY, merged);
    const out = await this.describe(key, redirectUri);
    await this.audit.record(actor, 'site.auth_provider_changed', { target: p.name, details: { enabled: out.enabled } });
    return out;
  }
}

module.exports = { AuthProviderService };
