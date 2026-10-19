'use strict';

const { sql } = require('../database/sql');

const WITH_OPTIONS = sql.raw(`
  SELECT f.*,
         COALESCE((SELECT json_agg(json_build_object('id', o.id, 'value', o.value, 'position', o.position, 'disabled', o.disabled) ORDER BY o.position, o.id)
                     FROM custom_field_options o WHERE o.field_id = f.id), '[]'::json) AS options,
         (SELECT count(*) FROM custom_field_values v WHERE v.field_id = f.id)::int AS usage_count,
         COALESCE((SELECT array_agg(pcf.project_key ORDER BY pcf.project_key) FROM project_custom_fields pcf WHERE pcf.field_id = f.id), '{}') AS projects
    FROM custom_fields f`);

/** custom_fields, custom_field_options, project_custom_fields, custom_field_values. */
class CustomFieldRepository {
  constructor({ db }) {
    this.db = db;
  }

  list() {
    return this.db.many(sql`${WITH_OPTIONS} ORDER BY lower(f.name)`);
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`${WITH_OPTIONS} WHERE f.id = ${Number(id)}`);
  }

  async nameTaken(name, exceptId = 0) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM custom_fields WHERE lower(name) = lower(${name}) AND id <> ${exceptId}`));
  }

  async insert(fields) {
    return this.db.value(sql`INSERT INTO custom_fields ${sql.insertValues(fields)} RETURNING id`);
  }

  update(id, fields) {
    if (!Object.keys(fields).length) return Promise.resolve();
    return this.db.query(sql`UPDATE custom_fields SET ${sql.set(fields)} WHERE id = ${id}`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM custom_fields WHERE id = ${id}`);
  }

  /**
   * Replaces the option list. Options with an id are updated, new ones are
   * inserted, missing ones are deleted (values pointing at them are removed).
   */
  async replaceOptions(fieldId, options) {
    const keep = options.filter((o) => o.id).map((o) => Number(o.id));
    const removed = await this.db.many(sql`SELECT id FROM custom_field_options WHERE field_id = ${fieldId} AND NOT (id = ANY(${keep}::int[]))`);
    for (const { id } of removed) {
      await this.db.query(sql`DELETE FROM custom_field_values WHERE field_id = ${fieldId} AND value = to_jsonb(${id}::int)`);
      await this.db.query(sql`UPDATE custom_field_values SET value = (SELECT COALESCE(jsonb_agg(e), '[]') FROM jsonb_array_elements(value) e WHERE e <> to_jsonb(${id}::int))
         WHERE field_id = ${fieldId} AND jsonb_typeof(value) = 'array'`);
      await this.db.query(sql`DELETE FROM custom_field_options WHERE id = ${id}`);
    }
    // Two passes avoid transient (field, lower(value)) collisions when options are renamed/swapped.
    for (const option of options.filter((o) => o.id)) {
      await this.db.query(sql`UPDATE custom_field_options SET value = ${`__tmp_${option.id}`} WHERE id = ${option.id} AND field_id = ${fieldId}`);
    }
    for (const [position, option] of options.entries()) {
      if (option.id) {
        await this.db.query(sql`UPDATE custom_field_options SET value = ${option.value}, position = ${position}, disabled = ${Boolean(option.disabled)} WHERE id = ${option.id} AND field_id = ${fieldId}`);
      } else {
        await this.db.query(sql`INSERT INTO custom_field_options (field_id, value, position, disabled) VALUES (${fieldId}, ${option.value}, ${position}, ${Boolean(option.disabled)})`);
      }
    }
  }

  /* ---------- field contexts (per project) ---------- */
  projectFields(projectKey) {
    return this.db.many(sql`
      ${WITH_OPTIONS} JOIN project_custom_fields pf ON pf.field_id = f.id AND pf.project_key = ${projectKey}
      ORDER BY pf.position, f.id`);
  }

  projectSettings(projectKey) {
    return this.db.many(sql`SELECT * FROM project_custom_fields WHERE project_key = ${projectKey} ORDER BY position, field_id`);
  }

  async replaceProjectFields(projectKey, entries) {
    await this.db.query(sql`DELETE FROM project_custom_fields WHERE project_key = ${projectKey}`);
    for (const [position, e] of entries.entries()) {
      await this.db.query(sql`
        INSERT INTO project_custom_fields (project_key, field_id, position, required)
        VALUES (${projectKey}, ${e.fieldId}, ${position}, ${Boolean(e.required)})`);
    }
  }

  /* ---------- values ---------- */
  values(issueId) {
    return this.db.many(sql`SELECT field_id, value FROM custom_field_values WHERE issue_id = ${issueId}`);
  }

  /** Map issue id → { fieldId: value } for a page of search results. */
  async valuesFor(issueIds) {
    if (!issueIds.length) return new Map();
    const rows = await this.db.many(sql`SELECT issue_id, field_id, value FROM custom_field_values WHERE issue_id = ANY(${issueIds}::int[])`);
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.issue_id)) map.set(r.issue_id, {});
      map.get(r.issue_id)[r.field_id] = r.value;
    }
    return map;
  }

  setValue(issueId, fieldId, value) {
    return this.db.query(sql`
      INSERT INTO custom_field_values (issue_id, field_id, value, updated_at)
      VALUES (${issueId}, ${fieldId}, ${JSON.stringify(value)}::jsonb, now())
      ON CONFLICT (issue_id, field_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`);
  }

  deleteValue(issueId, fieldId) {
    return this.db.query(sql`DELETE FROM custom_field_values WHERE issue_id = ${issueId} AND field_id = ${fieldId}`);
  }
}

module.exports = { CustomFieldRepository };
