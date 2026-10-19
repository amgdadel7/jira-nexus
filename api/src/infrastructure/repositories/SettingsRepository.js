'use strict';

const { sql } = require('../database/sql');

/** site_settings: JSON values by key. */
class SettingsRepository {
  constructor({ db }) {
    this.db = db;
  }

  async get(key, fallback = null) {
    const row = await this.db.one(sql`SELECT value FROM site_settings WHERE key = ${key}`);
    return row ? row.value : fallback;
  }

  set(key, value) {
    return this.db.query(sql`
      INSERT INTO site_settings (key, value, updated_at) VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`);
  }

  delete(key) {
    return this.db.query(sql`DELETE FROM site_settings WHERE key = ${key}`);
  }
}

module.exports = { SettingsRepository };
