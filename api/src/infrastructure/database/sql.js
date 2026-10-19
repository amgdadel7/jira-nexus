'use strict';

/**
 * Tiny composable SQL builder (tagged template). Interpolated values become
 * positional parameters ($1, $2 …); interpolated Sql fragments are inlined, so
 * queries can be assembled from pieces without string concatenation.
 *
 *   sql`SELECT * FROM users WHERE id = ${id}`
 *   sql`SELECT * FROM issues WHERE ${sql.join(conditions, ' AND ')}`
 *   sql`UPDATE issues SET ${sql.set({ summary, updated_at: now })} WHERE id = ${id}`
 */
class Sql {
  constructor(strings, values) {
    this.strings = strings;
    this.values = values;
  }

  /** Renders to { text, values } for the driver. */
  toQuery() {
    const out = { text: '', values: [] };
    this._render(out);
    return out;
  }

  _render(out) {
    this.strings.forEach((chunk, i) => {
      out.text += chunk;
      if (i >= this.values.length) return;
      const value = this.values[i];
      if (value instanceof Sql) value._render(out);
      else {
        out.values.push(value === undefined ? null : value);
        out.text += `$${out.values.length}`;
      }
    });
  }
}

function sql(strings, ...values) {
  return new Sql(strings, values);
}

const IDENT = /^[a-z_][a-z0-9_]*$/i;

/** Trusted SQL text (identifiers / keywords chosen by code, never user input). */
sql.raw = (text) => new Sql([String(text)], []);

/** A safely quoted identifier (column or table name). */
sql.ident = (name) => {
  if (!IDENT.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return sql.raw(`"${name}"`);
};

sql.empty = sql.raw('');

/** Joins fragments / values with a separator. Plain values become parameters. */
sql.join = (items, separator = ', ') => {
  const list = items.filter((x) => x !== undefined);
  if (!list.length) return sql.empty;
  const strings = [''];
  for (let i = 1; i < list.length; i += 1) strings.push(separator);
  strings.push('');
  return new Sql(strings, list);
};

/** `col1 = $1, col2 = $2` from an object (undefined values are skipped). */
sql.set = (fields) => sql.join(
  Object.entries(fields).filter(([, v]) => v !== undefined).map(([k, v]) => sql`${sql.ident(k)} = ${v}`),
);

/** `(col1, col2) VALUES ($1, $2)` from an object. */
sql.insertValues = (fields) => {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  return sql`(${sql.join(entries.map(([k]) => sql.ident(k)))}) VALUES (${sql.join(entries.map(([, v]) => sql`${v}`))})`;
};

/** WHERE clause from fragments (AND); empty when there are none. */
sql.where = (conditions) => {
  const list = conditions.filter(Boolean);
  return list.length ? sql`WHERE ${sql.join(list, ' AND ')}` : sql.empty;
};

sql.isSql = (value) => value instanceof Sql;

module.exports = { sql, Sql };
