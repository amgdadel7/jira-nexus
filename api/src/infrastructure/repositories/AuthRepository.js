'use strict';

const { sql } = require('../database/sql');

/** sessions, api_tokens and password_resets. */
class AuthRepository {
  constructor({ db }) {
    this.db = db;
  }

  /* ---------- sessions ---------- */
  createSession({ token, userId, userAgent, remember, expiresAt }) {
    return this.db.query(sql`
      INSERT INTO sessions (token, user_id, user_agent, remember, created_at, last_seen_at, expires_at)
      VALUES (${token}, ${userId}, ${userAgent}, ${remember}, now(), now(), ${expiresAt})`);
  }

  findSessionWithUser(token) {
    return this.db.one(sql`
      SELECT u.*, s.expires_at AS session_expires_at, s.last_seen_at AS session_last_seen_at
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ${token}`);
  }

  touchSession(token) {
    return this.db.query(sql`UPDATE sessions SET last_seen_at = now() WHERE token = ${token}`);
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
      SELECT token, created_at, last_seen_at, expires_at, user_agent, remember FROM sessions
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
}

module.exports = { AuthRepository };
