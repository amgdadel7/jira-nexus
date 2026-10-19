'use strict';

const { hashPassword, verifyPassword, sha256, randomHex } = require('../../shared/crypto');
const { bad, forbidden, notFound, AppError } = require('../../shared/errors');
const { isEmail, isHexColor } = require('../../shared/validation');
const { RateLimiter } = require('../../shared/rateLimiter');

const SESSION_DAYS = 14; // "Remember me"
const SHORT_SESSION_HOURS = 12; // browser session only
const RESET_MINUTES = 30;
const PAT_PREFIX = 'jcpat_';
const PAT_RE = /^jcpat_[a-f0-9]{48}$/;
const SESSION_RE = /^[a-f0-9]{64}$/;
const MAX_TOKENS = 20;

/**
 * Authentication use cases: password login, sessions, personal access tokens,
 * password reset and the signed-in user's own profile.
 */
class AuthService {
  constructor({ db, authRepo, userRepo, config, logger = console }) {
    Object.assign(this, { db, repo: authRepo, users: userRepo, config, logger });
    this.limiter = new RateLimiter();
  }

  /* ---------- request authentication ---------- */
  async authenticate({ bearer, header, query, cookie }) {
    const pat = [bearer, header, query].find((t) => t && t.startsWith(PAT_PREFIX));
    if (pat) {
      const found = await this.authenticateApiToken(pat);
      return found || { failure: 'invalid_token' };
    }
    const candidates = [header, bearer, query, cookie].filter((t, i, all) => typeof t === 'string' && SESSION_RE.test(t) && all.indexOf(t) === i);
    if (!candidates.length) return { failure: 'no_credentials' };
    let failure = null;
    for (const token of candidates) {
      const row = await this.repo.findSessionWithUser(token);
      if (row && row.session_expires_at > new Date().toISOString() && row.active) {
        if (!row.session_last_seen_at || Date.now() - new Date(row.session_last_seen_at) > 5 * 60e3) await this.repo.touchSession(token);
        return { user: row, sessionToken: token };
      }
      failure = !row ? 'unknown_session' : !row.active ? 'deactivated' : 'expired';
    }
    return { failure };
  }

  async authenticateApiToken(token) {
    if (!PAT_RE.test(token)) return null;
    const row = await this.repo.findApiTokenWithUser(sha256(token));
    if (!row || !row.active || (row.token_expires && row.token_expires <= new Date().toISOString())) return null;
    if (!row.token_used || Date.now() - new Date(row.token_used) > 60e3) await this.repo.touchApiToken(row.token_id);
    return { user: row, apiTokenId: row.token_id };
  }

  /* ---------- sessions ---------- */
  async createSession(userId, { remember = true, userAgent = '' } = {}) {
    const token = randomHex(32);
    const expires = new Date(Date.now() + (remember ? SESSION_DAYS * 864e5 : SHORT_SESSION_HOURS * 36e5));
    await this.repo.createSession({ token, userId, userAgent: String(userAgent || '').slice(0, 300), remember, expiresAt: expires.toISOString() });
    return { token, expires, remember };
  }

  async login({ email, password, remember, userAgent, ip }) {
    const mail = String(email || '').trim().toLowerCase();
    const pass = String(password || '');
    if (!mail || !pass) throw bad('Enter your email and password.');
    const key = `${mail}|${ip}`;
    this.limiter.check(key);
    const user = await this.users.findByEmail(mail);
    if (!user || !verifyPassword(pass, user.password_hash)) {
      this.limiter.fail(key);
      throw new AppError('Incorrect email address and / or password.', 401);
    }
    if (!user.active) throw forbidden('Your account has been deactivated. Contact an administrator.');
    this.limiter.reset(key);
    const session = await this.createSession(user.id, { remember: remember !== false, userAgent });
    await this.repo.deleteExpiredSessions();
    return { user, session };
  }

  async logout(sessionToken) {
    if (sessionToken) await this.repo.deleteSession(sessionToken);
  }

  listSessions(actor) {
    return this.repo.listSessions(actor.id);
  }

  revokeOtherSessions(actor) {
    return this.repo.deleteUserSessions(actor.id, actor.sessionToken);
  }

  async revokeSession(actor, id) {
    if (!/^[a-f0-9]{12}$/.test(String(id))) throw bad('Invalid session id.');
    if (!(await this.repo.deleteSessionByPrefix(actor.id, String(id), actor.sessionToken))) throw notFound('Session not found.');
  }

  /* ---------- personal access tokens ---------- */
  assertPasswordSession(actor) {
    if (actor.viaApiToken) throw forbidden('API tokens cannot manage tokens or sessions. Log in with a password.');
  }

  listApiTokens(actor) {
    this.assertPasswordSession(actor);
    return this.repo.listApiTokens(actor.id);
  }

  async createApiToken(actor, { name, expiresInDays }) {
    this.assertPasswordSession(actor);
    const label = String(name || '').trim();
    if (!label) throw bad('Give the token a name so you can recognise it later.');
    if (label.length > 60) throw bad('Token name must be 60 characters or less.');
    const days = expiresInDays == null || expiresInDays === '' ? null : Number(expiresInDays);
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) throw bad('Expiry must be between 1 and 365 days, or none.');
    if ((await this.repo.countApiTokens(actor.id)) >= MAX_TOKENS) throw bad('You can have at most 20 API tokens. Revoke one first.');
    const token = PAT_PREFIX + randomHex(24);
    const row = await this.repo.createApiToken({
      userId: actor.id, name: label, tokenHash: sha256(token), prefix: token.slice(0, 12),
      expiresAt: days ? new Date(Date.now() + days * 864e5).toISOString() : null,
    });
    return { row, token };
  }

  async revokeApiToken(actor, id) {
    this.assertPasswordSession(actor);
    if (!(await this.repo.deleteApiToken(Number(id) || 0, actor.id))) throw notFound('Token not found.');
  }

  /* ---------- password reset ---------- */
  async requestPasswordReset({ email, ip }) {
    const mail = String(email || '').trim().toLowerCase();
    if (!isEmail(mail)) throw bad('Enter a valid email address.');
    const key = `forgot:${mail}|${ip}`;
    this.limiter.check(key);
    this.limiter.fail(key); // at most 5 requests a minute per email
    const result = { ok: true, message: 'If an account exists for that email, we sent a link to reset the password.' };
    const user = await this.users.findByEmail(mail);
    if (user && user.active) {
      const token = randomHex(24);
      await this.repo.createPasswordReset({ tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_MINUTES * 60e3).toISOString() });
      const resetPath = `/reset-password?token=${token}`;
      this.logger.log(`[auth] password reset link for ${user.email}: ${resetPath}`);
      if (this.config.showDevSecrets) result.resetPath = resetPath;
    }
    return result;
  }

  async peekPasswordReset(token) {
    const row = await this.repo.findValidPasswordReset(sha256(String(token || '')));
    if (!row) throw bad('This reset link is invalid or has expired. Request a new one.');
    return (await this.users.findById(row.user_id)).email;
  }

  async resetPassword({ token, password }) {
    const pass = String(password || '');
    if (pass.length < 8) throw bad('The new password must be at least 8 characters.');
    const hash = sha256(String(token || ''));
    const row = await this.repo.findValidPasswordReset(hash);
    if (!row) throw bad('This reset link is invalid or has expired. Request a new one.');
    await this.db.tx(async () => {
      await this.repo.markPasswordResetUsed(hash);
      await this.users.update(row.user_id, { password_hash: hashPassword(pass) });
      await this.repo.deleteUserSessions(row.user_id); // sign out everywhere
    });
    return (await this.users.findById(row.user_id)).email;
  }

  /* ---------- own profile ---------- */
  async updateProfile(actor, { name, title, color, currentPassword, newPassword }) {
    const user = actor.user;
    const fields = {};
    if (name !== undefined) {
      if (!String(name).trim()) throw bad('Name is required.');
      fields.name = String(name).trim().slice(0, 80);
    }
    if (title !== undefined) fields.title = String(title).slice(0, 80);
    if (color !== undefined) {
      if (!isHexColor(color)) throw bad('Color must be a hex value like #0052CC.');
      fields.color = color;
    }
    if (newPassword !== undefined) {
      if (user.password_hash && !verifyPassword(currentPassword || '', user.password_hash)) throw bad('Your current password is incorrect.');
      if (String(newPassword).length < 8) throw bad('The new password must be at least 8 characters.');
      fields.password_hash = hashPassword(newPassword);
      await this.repo.deleteUserSessions(user.id, actor.sessionToken);
    }
    return this.users.update(user.id, fields);
  }
}

module.exports = { AuthService, PAT_PREFIX, SESSION_DAYS };
