'use strict';

/**
 * Database drivers behind one minimal interface:
 *
 *   query(text, values) → { rows, rowCount }
 *   exec(text)          → runs several statements (migrations)
 *   transaction(fn)     → fn receives an executor with the same query/exec API
 *   close()
 *
 * Both drivers speak real PostgreSQL. Values are normalised the same way:
 * bigint/numeric → Number, timestamptz → ISO-8601 string, date → 'YYYY-MM-DD'.
 */

const fs = require('fs');

const OID = { INT8: 20, NUMERIC: 1700, TIMESTAMP: 1114, TIMESTAMPTZ: 1184, DATE: 1082 };

/** External PostgreSQL server through node-postgres. */
async function createPgAdapter({ url, poolSize = 10 }) {
  const { Pool, types } = require('pg');
  const parseTimestamptz = types.getTypeParser(OID.TIMESTAMPTZ);
  types.setTypeParser(OID.INT8, (v) => Number(v));
  types.setTypeParser(OID.NUMERIC, (v) => Number(v));
  types.setTypeParser(OID.TIMESTAMPTZ, (v) => parseTimestamptz(v).toISOString());
  types.setTypeParser(OID.TIMESTAMP, (v) => parseTimestamptz(`${v}Z`).toISOString());
  types.setTypeParser(OID.DATE, (v) => v);

  const pool = new Pool({ connectionString: url, max: poolSize, options: '-c timezone=UTC' });
  pool.on('error', (err) => console.error('[db] idle client error', err.message));
  await pool.query('SELECT 1');

  const executor = (client) => ({
    query: (text, values) => client.query(text, values),
    exec: (text) => client.query(text),
  });

  return {
    kind: 'postgres',
    ...executor(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(executor(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/** Embedded PostgreSQL (WASM build, no server needed). Ideal for local development and tests. */
async function createPgliteAdapter({ dataDir }) {
  const { PGlite } = await import('@electric-sql/pglite');
  const inMemory = !dataDir || dataDir.startsWith('memory://');
  if (!inMemory) fs.mkdirSync(dataDir, { recursive: true });
  const parsers = {
    [OID.INT8]: (v) => Number(v),
    [OID.NUMERIC]: (v) => Number(v),
    [OID.TIMESTAMPTZ]: (v) => new Date(v).toISOString(),
    [OID.TIMESTAMP]: (v) => new Date(`${v}Z`).toISOString(),
    [OID.DATE]: (v) => v,
  };
  const pg = new PGlite({ ...(inMemory ? {} : { dataDir }), parsers });
  await pg.waitReady;
  await pg.exec("SET TIME ZONE 'UTC'");

  const normalise = (res) => ({ rows: res.rows, rowCount: res.affectedRows ?? res.rows.length });
  const executor = (conn) => ({
    query: async (text, values) => normalise(await conn.query(text, values || [])),
    exec: (text) => conn.exec(text),
  });

  return {
    kind: 'pglite',
    ...executor(pg),
    transaction: (fn) => pg.transaction((tx) => fn(executor(tx))),
    close: () => pg.close(),
  };
}

async function createAdapter(config) {
  if (config.url) return createPgAdapter(config);
  return createPgliteAdapter({ dataDir: config.pgliteDir });
}

module.exports = { createAdapter, createPgAdapter, createPgliteAdapter };
