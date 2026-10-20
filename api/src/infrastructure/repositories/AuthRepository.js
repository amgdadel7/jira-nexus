'use strict';

const { sql } = require('../database/sql');

/** sessions, api_tokens and password_resets. */
class AuthRepository {
  constructor({ db }) {
    this.db = db;
  }

  /* ---------- sessions ---------- */
  createSession({ token, userId, userAgent, ipAddress = '', remember, expiresAt }) {
    return this.db.query(sql`
      INSERT INTO sessions (token, user_id, user_agent, ip_address, remember, created_at, last_seen_at, expires_at, sudo_confirmed_at)
      VALUES (${token}, ${userId}, ${userAgent}, ${ipAddress}, ${remember}, now(), now(), ${expiresAt}, now())`);
  }

  findSessionWithUser(token) {
    return this.db.one(sql`
      SELECT u.*, s.expires_at AS session_expires_at, s.last_seen_at AS session_last_seen_at,
             s.sudo_confirmed_at, s.ip_address AS session_ip, s.user_agent AS session_user_agent
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ${token}`);
  }

  touchSession(token) {
    return this.db.query(sql`UPDATE sessions SET last_seen_at = now() WHERE token = ${token}`);
  }

  confirmSudo(token) {
    return this.db.query(sql`UPDATE sessions SET sudo_confirmed_at = now() WHERE token = ${token}`);
  }

  deleteSession(token) {
    return this.db.query(sql`DELETE FROM sessions WHERE token = ${token}`);
  }

  deleteExpiredSessions() {
    return this.db.query(sql`DELETE FROM sessions WHERE expires_at < now()`);
  }

  async deleteUserSessions(userId, exceptToken = null) {
    const res = await this.db.query(sql`DELETE FROM sessions WHERE user_id = ${userId} AND token IS DISTINCT FROM ${exceptToken}`);
    return res.rowCount;
  }

  async deleteSessionByPrefix(userId, prefix, exceptToken) {
    const res = await this.db.query(sql`
      DELETE FROM sessions WHERE user_id = ${userId} AND left(token, 12) = ${prefix} AND token IS DISTINCT FROM ${exceptToken}`);
    return res.rowCount;
  }

  listSessions(userId) {
    return this.db.many(sql`
      SELECT token, created_at, last_seen_at, expires_at, user_agent, ip_address, sudo_confirmed_at, remember FROM sessions
      WHERE user_id = ${userId} AND expires_at > now() ORDER BY last_seen_at DESC NULLS LAST`);
  }

  /* ---------- personal API tokens ---------- */
  createApiToken({ userId, name, tokenHash, prefix, expiresAt }) {
    return this.db.one(sql`
      INSERT INTO api_tokens (user_id, name, token_hash, prefix, expires_at)
      VALUES (${userId}, ${name}, ${tokenHash}, ${prefix}, ${expiresAt}) RETURNING *`);
  }

  findApiTokenWithUser(tokenHash) {
    return this.db.one(sql`
      SELECT u.*, t.id AS token_id, t.expires_at AS token_expires, t.last_used_at AS token_used
      FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ${tokenHash}`);
  }

  touchApiToken(id) {
    return this.db.query(sql`UPDATE api_tokens SET last_used_at = now() WHERE id = ${id}`);
  }

  listApiTokens(userId) {
    return this.db.many(sql`SELECT * FROM api_tokens WHERE user_id = ${userId} ORDER BY created_at DESC`);
  }

  countApiTokens(userId) {
    return this.db.value(sql`SELECT count(*)::int FROM api_tokens WHERE user_id = ${userId}`);
  }

  async deleteApiToken(id, userId) {
    return (await this.db.query(sql`DELETE FROM api_tokens WHERE id = ${id} AND user_id = ${userId}`)).rowCount;
  }

  /* ---------- password resets ---------- */
  async createPasswordReset({ tokenHash, userId, expiresAt }) {
    await this.db.query(sql`DELETE FROM password_resets WHERE user_id = ${userId} OR expires_at < now()`);
    await this.db.query(sql`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (${tokenHash}, ${userId}, ${expiresAt})`);
  }

  findValidPasswordReset(tokenHash) {
    return this.db.one(sql`SELECT * FROM password_resets WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at >= now()`);
  }

  markPasswordResetUsed(tokenHash) {
    return this.db.query(sql`UPDATE password_resets SET used_at = now() WHERE token_hash = ${tokenHash}`);
  }

  /* ---------- MFA operations ---------- */
  enableMfa(userId, secretEncrypted) {
    return this.db.query(sql`
      UPDATE users SET mfa_enabled = true, mfa_secret = ${secretEncrypted}, mfa_enrolled_at = now()
      WHERE id = ${userId}`);
  }

  disableMfa(userId) {
    return this.db.query(sql`
      UPDATE users SET mfa_enabled = false, mfa_secret = NULL, mfa_enrolled_at = NULL
      WHERE id = ${userId}`);
  }

  async saveBackupCodes(userId, hashedCodes) {
    await this.db.query(sql`DELETE FROM mfa_backup_codes WHERE user_id = ${userId}`);
    for (const hash of hashedCodes) {
      await this.db.query(sql`
        INSERT INTO mfa_backup_codes (user_id, code_hash) VALUES (${userId}, ${hash})`);
    }
  }

  async useBackupCode(userId, codeHash) {
    const res = await this.db.query(sql`
      UPDATE mfa_backup_codes SET used_at = now()
      WHERE id = (
        SELECT id FROM mfa_backup_codes
        WHERE user_id = ${userId} AND code_hash = ${codeHash} AND used_at IS NULL
        LIMIT 1
      )`);
    return res.rowCount > 0;
  }

  deleteBackupCodes(userId) {
    return this.db.query(sql`DELETE FROM mfa_backup_codes WHERE user_id = ${userId}`);
  }

  countRemainingBackupCodes(userId) {
    return this.db.value(sql`
      SELECT count(*)::int FROM mfa_backup_codes WHERE user_id = ${userId} AND used_at IS NULL`);
  }

  /* ---------- MFA challenges ---------- */
  createMfaChallenge({ tokenHash, userId, remember, userAgent = '', ip = '', expiresAt }) {
    return this.db.query(sql`
      INSERT INTO mfa_challenges (token_hash, user_id, remember, user_agent, ip_address, expires_at)
      VALUES (${tokenHash}, ${userId}, ${remember}, ${userAgent}, ${ip}, ${expiresAt})`);
  }

  findMfaChallenge(tokenHash) {
    return this.db.one(sql`
      SELECT c.*, u.mfa_secret, u.email, u.name, u.active
      FROM mfa_challenges c
      JOIN users u ON u.id = c.user_id
      WHERE c.token_hash = ${tokenHash} AND c.expires_at > now()`);
  }

  incrementMfaChallengeAttempts(tokenHash) {
    return this.db.query(sql`
      UPDATE mfa_challenges SET attempts = attempts + 1 WHERE token_hash = ${tokenHash}`);
  }

  deleteMfaChallenge(tokenHash) {
    return this.db.query(sql`DELETE FROM mfa_challenges WHERE token_hash = ${tokenHash}`);
  }

  deleteUserMfaChallenges(userId) {
    return this.db.query(sql`DELETE FROM mfa_challenges WHERE user_id = ${userId}`);
  }
}

module.exports = { AuthRepository };
