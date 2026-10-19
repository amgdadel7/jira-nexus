'use strict';

const { bad, forbidden, notFound } = require('../../shared/errors');
const { randomHex, sha256, randomCode, hashPassword } = require('../../shared/crypto');
const { isEmail } = require('../../shared/validation');
const { WindowLimiter } = require('../../shared/rateLimiter');

const CODE_MINUTES = 15;
const SIGNUP_TOKEN_MINUTES = 60;
const STATE_MINUTES = 15;
const MAX_CODE_ATTEMPTS = 5;
const POLICIES = ['open', 'domain', 'invite'];
const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;
const minutesFromNow = (m) => new Date(Date.now() + m * 60_000).toISOString();

/** Self-service sign-up (e-mail code or social login), linked identities and the site sign-up policy. */
class SignupService {
  constructor({ db, userRepo, identityRepo, settingsRepo, auth, authProviders, oauthGateway, billing, users, audit, config, logger = console }) {
    Object.assign(this, { db, identities: identityRepo, settings: settingsRepo, auth, providers: authProviders, gateway: oauthGateway, billing, audit, config, logger });
    this.userRepo = userRepo;
    this.userService = users;
    this.limiter = new WindowLimiter();
  }

  // ---------- policy ----------
  async policy() {
    const s = (await this.settings.get('site', {})) || {};
    return { signup: POLICIES.includes(s.signup) ? s.signup : 'open', allowedDomains: Array.isArray(s.allowedDomains) ? s.allowedDomains : [] };
  }

  async assertCanSignUp(email) {
    const p = await this.policy();
    if (p.signup === 'invite') throw forbidden('Sign-up is by invitation only on this site. Ask an administrator to invite you.', { code: 'invite_only' });
    if (p.signup === 'domain' && !p.allowedDomains.map((d) => d.toLowerCase()).includes(email.split('@')[1])) {
      throw forbidden(`Only people with an email address at ${p.allowedDomains.join(', ') || 'an approved domain'} can sign up.`, { code: 'domain_not_allowed' });
    }
  }

  async updatePolicy(actor, body = {}) {
    const current = await this.policy();
    const signup = body.signup ?? current.signup;
    if (!POLICIES.includes(signup)) throw bad('Sign-up must be open, domain or invite.');
    let domains = body.allowedDomains ?? current.allowedDomains;
    if (typeof domains === 'string') domains = domains.split(/[\s,]+/);
    domains = [...new Set(domains.map((d) => String(d).trim().toLowerCase().replace(/^@/, '')).filter(Boolean))];
    if (domains.some((d) => !DOMAIN_RE.test(d))) throw bad('Enter domains like example.com.');
    if (signup === 'domain' && !domains.length) throw bad('Add at least one allowed domain.');
    const next = { signup, allowedDomains: domains };
    await this.settings.set('site', next);
    await this.audit.record(actor, 'site.signup_policy_changed', { details: { from: current.signup, to: signup, domains } });
    return next;
  }

  /** Public settings for the login / sign-up screens. */
  async publicConfig() {
    const p = await this.policy();
    const plan = await this.billing.plan();
    return {
      siteName: 'Masar', signup: p.signup, allowedDomains: p.signup === 'domain' ? p.allowedDomains : [],
      providers: await this.providers.publicList(), devCodes: this.config.showDevSecrets, plan: { key: plan.key, name: plan.name },
    };
  }

  async createUser({ name, email, password, source }) {
    return this.userRepo.insert({
      id: `u${randomHex(4)}`, name: String(name).trim().slice(0, 80), email, color: await this.userService.nextColor(),
      password_hash: password ? hashPassword(password) : null, role: 'member', title: '', email_verified: true, signup_source: source,
    });
  }

  // ---------- e-mail sign-up: start → verify → complete ----------
  async start({ email: raw, ip }) {
    const email = String(raw || '').trim().toLowerCase();
    if (!isEmail(email)) throw bad('Enter a valid email address.');
    if (await this.userRepo.emailTaken(email)) return { exists: true, email, message: 'You already have an account. Log in instead.' };
    await this.assertCanSignUp(email);
    await this.billing.assertSeat(1);
    this.limiter.hit(`code:${email}|${ip}`, 5, 60_000);
    const code = randomCode(6);
    await this.identities.createVerification({ email, codeHash: sha256(`${email}:${code}`), expiresAt: minutesFromNow(CODE_MINUTES) });
    this.logger.info(`[auth] sign-up verification code for ${email}: ${code}`);
    return { ok: true, email, expiresInMinutes: CODE_MINUTES, message: `We sent a 6-digit code to ${email}.`, ...(this.config.showDevSecrets ? { devCode: code } : {}) };
  }

  async verify({ email: raw, code: rawCode, ip }) {
    const email = String(raw || '').trim().toLowerCase();
    const code = String(rawCode || '').replace(/\D/g, '');
    if (code.length !== 6) throw bad('Enter the 6-digit code from the email.');
    this.limiter.hit(`verify:${email}|${ip}`, 10, 60_000);
    const v = await this.identities.latestVerification(email);
    if (!v || new Date(v.expires_at) < new Date()) throw bad('This code has expired. Request a new one.');
    if (v.attempts >= MAX_CODE_ATTEMPTS) throw bad('Too many incorrect codes. Request a new one.');
    if (v.code_hash !== sha256(`${email}:${code}`)) {
      await this.identities.countFailedAttempt(v.id);
      const left = Math.max(0, MAX_CODE_ATTEMPTS - 1 - v.attempts);
      throw bad(`That code isn’t right. ${left} attempt${left === 1 ? '' : 's'} left.`);
    }
    const signupToken = randomHex(24);
    await this.identities.markVerified(v.id, signupToken, minutesFromNow(SIGNUP_TOKEN_MINUTES));
    return { ok: true, email, signupToken };
  }

  async complete({ signupToken, name, password, remember = true, userAgent }) {
    const v = await this.identities.findBySignupToken(String(signupToken || ''));
    if (!v || !v.verified_at || new Date(v.expires_at) < new Date()) throw bad('Your sign-up session has expired. Start again.');
    if (!String(name || '').trim()) throw bad('Enter your full name.');
    if (String(password || '').length < 8) throw bad('Password must be at least 8 characters.');
    if (await this.userRepo.emailTaken(v.email)) throw bad('An account with this email already exists. Log in instead.');
    await this.assertCanSignUp(v.email);
    await this.billing.assertSeat(1);
    const user = await this.db.tx(async () => {
      await this.identities.markUsed(v.id);
      return this.createUser({ name, email: v.email, password, source: 'signup' });
    });
    await this.audit.record({ id: user.id, name: user.name }, 'user.signed_up', { target: user.name, details: { userId: user.id, email: user.email, method: 'email' } });
    return { user, session: await this.auth.createSession(user.id, { remember: remember !== false, userAgent }) };
  }

  // ---------- social login ----------
  async oauthStart(key, { mode, popup, remember, redirectUri }) {
    const p = this.providers.info(key);
    const credentials = await this.providers.credentials(key);
    if (!credentials.enabled) {
      throw bad(`${p.name} sign-in isn’t set up on this site yet. An administrator can configure it in Settings → Authentication.`, { code: 'provider_not_configured' });
    }
    const state = randomHex(24);
    const nonce = randomHex(16);
    await this.identities.createState({ state, provider: key, mode: mode === 'signup' ? 'signup' : 'login', popup, remember, nonce, ttlMinutes: STATE_MINUTES });
    return this.gateway.authorizeUrl(key, credentials, { redirectUri, state, nonce });
  }

  /** Validates the callback, finds/creates/links the user and opens a session. Returns { popup, user, session, created }. */
  async oauthCallback(key, query, { redirectUri, userAgent }) {
    const row = await this.identities.takeState(query.state, key, STATE_MINUTES);
    const state = row?.valid ? row : null;
    const result = { popup: Boolean(state?.popup) };
    try {
      const p = this.providers.info(key);
      if (query.error) {
        throw bad(['access_denied', 'user_cancelled_authorize'].includes(query.error) ? 'Sign-in was cancelled.' : `${p.name} returned an error: ${query.error_description || query.error}`);
      }
      if (!state) throw bad('This sign-in link has expired. Please try again.');
      if (!query.code) throw bad('The provider did not return an authorization code.');
      const profile = await this.gateway.exchange(key, await this.providers.credentials(key), { code: query.code, redirectUri, nonce: state.nonce, appleUser: query.user });
      if (!profile.subject) throw bad('The provider did not return an account id.');
      const { user, created } = await this.findOrCreateUser(key, p, profile);
      if (!user.active) throw forbidden('Your account has been deactivated. Contact an administrator.');
      if (created) await this.audit.record({ id: user.id, name: user.name }, 'user.signed_up', { target: user.name, details: { userId: user.id, email: user.email, method: key } });
      return { ...result, user, created, session: await this.auth.createSession(user.id, { remember: state.remember, userAgent }) };
    } catch (err) {
      if (!err.status || err.status >= 500) this.logger.error('[oauth]', key, err);
      return { ...result, error: err.status && err.status < 500 ? err.message : 'Something went wrong while signing you in. Please try again.' };
    }
  }

  async findOrCreateUser(key, provider, profile) {
    const linked = await this.identities.findIdentity(key, profile.subject);
    if (linked) {
      await this.identities.touchIdentity(key, profile.subject);
      return { user: await this.userRepo.findById(linked.user_id), created: false };
    }
    if (!isEmail(profile.email)) throw bad(`Your ${provider.name} account did not share an email address.`);
    if (!profile.emailVerified) throw bad(`Your ${provider.name} email address isn’t verified.`);
    return this.db.tx(async () => {
      let user = await this.userRepo.findByEmail(profile.email);
      let created = false;
      if (!user) {
        await this.assertCanSignUp(profile.email);
        await this.billing.assertSeat(1);
        user = await this.createUser({ name: profile.name, email: profile.email, password: null, source: key });
        created = true;
      }
      await this.identities.linkIdentity({ provider: key, subject: profile.subject, userId: user.id, email: profile.email });
      return { user, created };
    });
  }

  // ---------- my linked identities ----------
  async identitiesOf(actor) {
    return (await this.identities.identitiesOf(actor.id)).map((i) => ({
      provider: i.provider, name: this.gateway.info(i.provider)?.name || i.provider, email: i.email, linked: i.created_at, lastUsed: i.last_login_at,
    }));
  }

  async unlink(actor, provider) {
    const user = await this.userRepo.findById(actor.id);
    if (!user.password_hash && (await this.identities.identitiesOf(actor.id)).length <= 1) throw bad('Set a password before unlinking your only sign-in method.');
    if (!(await this.identities.unlink(actor.id, provider))) throw notFound('That account isn’t linked.');
    return { ok: true };
  }
}

module.exports = { SignupService };
