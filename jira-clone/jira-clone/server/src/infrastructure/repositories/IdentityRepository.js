'use strict';

const { sql } = require('../database/sql');

/** Sign-up e-mail codes, linked social identities and pending OAuth states. */
class IdentityRepository {
  constructor({ db }) {
    this.db = db;
  }

  // ---- e-mail verification ----
  async createVerification({ email, codeHash, expiresAt }) {
    await this.db.query(sql`DELETE FROM email_verifications WHERE lower(email) = lower(${email}) AND used_at IS NULL`);
    return this.db.one(sql`INSERT INTO email_verifications (email, code_hash, expires_at) VALUES (${email}, ${codeHash}, ${expiresAt}) RETURNING *`);
  }

  latestVerification(email) {
    return this.db.one(sql`SELECT * FROM email_verifications WHERE lower(email) = lower(${email}) AND used_at IS NULL ORDER BY id DESC LIMIT 1`);
  }

  countFailedAttempt(id) {
    return this.db.query(sql`UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ${id}`);
  }

  markVerified(id, signupToken, expiresAt) {
    return this.db.query(sql`UPDATE email_verifications SET verified_at = now(), signup_token = ${signupToken}, expires_at = ${expiresAt} WHERE id = ${id}`);
  }

  findBySignupToken(token) {
    return this.db.one(sql`SELECT * FROM email_verifications WHERE signup_token = ${token} AND used_at IS NULL`);
  }

  markUsed(id) {
    return this.db.query(sql`UPDATE email_verifications SET used_at = now() WHERE id = ${id}`);
  }

  // ---- linked identities ----
  findIdentity(provider, subject) {
    return this.db.one(sql`SELECT * FROM user_identities WHERE provider = ${provider} AND subject = ${subject}`);
  }

  linkIdentity({ provider, subject, userId, email }) {
    return this.db.query(sql`
      INSERT INTO user_identities (provider, subject, user_id, email, last_login_at) VALUES (${provider}, ${subject}, ${userId}, ${email}, now())
      ON CONFLICT (provider, subject) DO UPDATE SET user_id = EXCLUDED.user_id, email = EXCLUDED.email, last_login_at = now()`);
  }

  touchIdentity(provider, subject) {
    return this.db.query(sql`UPDATE user_identities SET last_login_at = now() WHERE provider = ${provider} AND subject = ${subject}`);
  }

  identitiesOf(userId) {
    return this.db.many(sql`SELECT provider, email, created_at, last_login_at FROM user_identities WHERE user_id = ${userId} ORDER BY created_at`);
  }

  async unlink(userId, provider) {
    return (await this.db.query(sql`DELETE FROM user_identities WHERE user_id = ${userId} AND provider = ${provider}`)).rowCount;
  }

  countByProvider(provider) {
    return this.db.value(sql`SELECT count(*)::int FROM user_identities WHERE provider = ${provider}`);
  }

  // ---- OAuth state (CSRF + nonce) ----
  async createState({ state, provider, mode, popup, remember, nonce, ttlMinutes }) {
    await this.db.query(sql`DELETE FROM oauth_states WHERE created_at < now() - make_interval(mins => ${ttlMinutes})`);
    await this.db.query(sql`INSERT INTO oauth_states (state, provider, mode, popup, remember, nonce) VALUES (${state}, ${provider}, ${mode}, ${popup}, ${remember}, ${nonce})`);
  }

  /** One-shot: returns the state row (if still fresh) and deletes it. */
  takeState(state, provider, ttlMinutes) {
    return this.db.one(sql`
      DELETE FROM oauth_states WHERE state = ${String(state || '')}
      RETURNING *, (provider = ${provider} AND created_at > now() - make_interval(mins => ${ttlMinutes})) AS valid`);
  }
}

module.exports = { IdentityRepository };
