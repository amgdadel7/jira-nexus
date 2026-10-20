'use strict';

/**
 * Backup and Restore Utility for Masar Production Operations
 * Handles both database records and uploaded blob files (attachments/avatars).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sql } = require('../infrastructure/database/sql');

const TABLES_IN_ORDER = [
  'users',
  'user_preferences',
  'api_tokens',
  'password_resets',
  'organizations',
  'organization_members',
  'workspaces',
  'workspace_members',
  'projects',
  'project_members',
  'board_column_limits',
  'components',
  'sprints',
  'versions',
  'issues',
  'labels',
  'issue_labels',
  'issue_components',
  'comments',
  'history',
  'watchers',
  'votes',
  'attachments',
  'dev_items',
  'notifications',
  'worklogs',
  'issue_links',
  'filters',
  'goals',
  'forms',
  'dashboards',
  'dashboard_gadgets',
  'trash',
  'goal_issues',
  'custom_fields',
  'custom_field_values',
  'permission_schemes',
  'project_permission_schemes',
  'audit_log',
  'subscription',
  'invoices',
  'automation_rules',
  'automation_runs',
  'webhooks',
  'webhook_deliveries',
];

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

/**
 * Takes a full snapshot of the database and uploaded assets.
 */
async function createBackup({ db, uploadDir, outDir }) {
  const startedAt = Date.now();
  fs.mkdirSync(outDir, { recursive: true });
  const filesBackupDir = path.join(outDir, 'files');
  fs.mkdirSync(filesBackupDir, { recursive: true });

  const manifest = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    database: {
      adapter: db.adapter?.kind || 'postgres',
      tables: {},
      totalRecords: 0,
    },
    files: {
      count: 0,
      totalBytes: 0,
      items: [],
    },
    timings: {},
  };

  // 1. Snapshot database tables
  const dbData = {};
  for (const table of TABLES_IN_ORDER) {
    try {
      const rows = await db.many(`SELECT * FROM ${table}`);
      dbData[table] = rows;
      manifest.database.tables[table] = rows.length;
      manifest.database.totalRecords += rows.length;
    } catch {
      // Table might not exist or be empty in minimal schema
      dbData[table] = [];
      manifest.database.tables[table] = 0;
    }
  }

  fs.writeFileSync(path.join(outDir, 'database.json'), JSON.stringify(dbData, null, 2));

  // 2. Snapshot file storage (attachments & avatars)
  function copyDirRecursive(src, dest, relativePrefix = '') {
    if (!fs.existsSync(src)) return;
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyDirRecursive(srcPath, destPath, relPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
        const stat = fs.statSync(srcPath);
        manifest.files.count++;
        manifest.files.totalBytes += stat.size;
        manifest.files.items.push({
          path: relPath,
          size: stat.size,
          sha256: sha256File(srcPath),
        });
      }
    }
  }

  copyDirRecursive(uploadDir, filesBackupDir);

  const durationMs = Date.now() - startedAt;
  manifest.timings.backupDurationMs = durationMs;
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return manifest;
}

/**
 * Restores database records and files from a backup directory.
 */
async function restoreBackup({ db, uploadDir, backupDir }) {
  const startedAt = Date.now();
  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('manifest.json not found in backup directory');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const dbDataPath = path.join(backupDir, 'database.json');
  const dbData = JSON.parse(fs.readFileSync(dbDataPath, 'utf8'));

  // 1. Restore files with checksum validation
  const filesBackupDir = path.join(backupDir, 'files');
  fs.mkdirSync(uploadDir, { recursive: true });

  const fileReport = { restored: 0, verifiedSha256: 0 };
  for (const item of manifest.files.items) {
    const src = path.join(filesBackupDir, item.path);
    const dest = path.join(uploadDir, item.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    const hash = sha256File(dest);
    if (hash !== item.sha256) throw new Error(`Checksum mismatch restoring file ${item.path}`);
    fileReport.restored++;
    fileReport.verifiedSha256++;
  }

  // 2. Restore Database inside a transaction
  const dbReport = { restoredTables: 0, restoredRecords: 0 };
  const existingRows = await db.many(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  );
  const existingSet = new Set(existingRows.map((r) => r.table_name));
  const validTables = TABLES_IN_ORDER.filter((t) => existingSet.has(t));

  // Inspect column types for proper parameter formatting (JSON vs ARRAY)
  const colMetadata = await db.many(
    "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'"
  );
  const jsonCols = new Set();
  const arrayCols = new Set();
  for (const c of colMetadata) {
    if (c.data_type === 'json' || c.data_type === 'jsonb') {
      jsonCols.add(`${c.table_name}.${c.column_name}`);
    } else if (c.data_type === 'ARRAY') {
      arrayCols.add(`${c.table_name}.${c.column_name}`);
    }
  }

  function formatJsonValue(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'string') {
      try {
        JSON.parse(val);
        return val;
      } catch {
        return JSON.stringify(val);
      }
    }
    return JSON.stringify(val);
  }

  await db.tx(async () => {
    // Delete tables in reverse dependency order
    for (const table of [...validTables].reverse()) {
      if (table === 'issues') {
        try { await db.exec('UPDATE issues SET parent_id = NULL'); } catch { /* ignore */ }
      }
      await db.exec(`DELETE FROM "${table}"`);
    }

    // Insert records in forward order
    const pendingParentUpdates = [];

    for (const table of validTables) {
      const rows = dbData[table] || [];
      if (!rows.length) continue;

      for (const row of rows) {
        const rowCopy = { ...row };
        if (table === 'issues' && rowCopy.parent_id) {
          pendingParentUpdates.push({ id: rowCopy.id, parent_id: rowCopy.parent_id });
          rowCopy.parent_id = null;
        }

        const cols = Object.keys(rowCopy);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const values = cols.map((col) => {
          const val = rowCopy[col];
          const colKey = `${table}.${col}`;
          if (jsonCols.has(colKey)) {
            return formatJsonValue(val);
          }
          if (arrayCols.has(colKey)) {
            if (Array.isArray(val)) return val;
            if (val === null || val === undefined) return [];
            return [val];
          }
          if (val && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
            return JSON.stringify(val);
          }
          return val;
        });

        await db.query(
          `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
          values
        );
        dbReport.restoredRecords++;
      }
      dbReport.restoredTables++;
    }

    // Restore self-referencing parent_id references after all issues exist
    for (const item of pendingParentUpdates) {
      await db.query('UPDATE issues SET parent_id = $1 WHERE id = $2', [item.parent_id, item.id]);
    }
  });

  // Synchronize sequences after transaction commit for tables with auto-incrementing integer id
  for (const table of validTables) {
    try {
      const idCol = await db.oneOrNone(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id' AND data_type LIKE '%int%'",
        [table]
      );
      if (idCol) {
        const seq = await db.value("SELECT pg_get_serial_sequence($1, 'id')", [table]);
        if (seq) {
          await db.exec(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM "${table}"), 1))`);
        }
      }
    } catch {
      /* sequence sync is best-effort for serial tables */
    }
  }

  const durationMs = Date.now() - startedAt;
  return {
    success: true,
    manifest,
    fileReport,
    dbReport,
    restoreDurationMs: durationMs,
  };
}

module.exports = { createBackup, restoreBackup, TABLES_IN_ORDER };

if (require.main === module) {
  const { loadConfig } = require('../config');
  const { connectDatabase } = require('../infrastructure/database');

  async function main() {
    const config = loadConfig();
    const db = await connectDatabase(config);
    const args = process.argv.slice(2);
    const cmd = args[0] || 'create';

    try {
      if (cmd === 'create') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outDir = args[1] || path.join(process.cwd(), 'backups', `backup-${timestamp}`);
        console.log(`[Backup] Creating snapshot into: ${outDir}`);
        const manifest = await createBackup({ db, uploadDir: config.uploadDir, outDir });
        console.log(`✔ Backup complete! Records: ${manifest.database.totalRecords}, Files: ${manifest.files.count}, Duration: ${manifest.timings.backupDurationMs}ms`);
      } else if (cmd === 'restore') {
        const backupDir = args[1];
        if (!backupDir) {
          console.error('Usage: node src/cli/backup.js restore <path-to-backup-dir>');
          process.exit(1);
        }
        console.log(`[Restore] Restoring from: ${backupDir}`);
        const report = await restoreBackup({ db, uploadDir: config.uploadDir, backupDir });
        console.log(`✔ Restore complete! Restored ${report.dbReport.restoredRecords} records, ${report.fileReport.restored} files in ${report.restoreDurationMs}ms`);
      } else {
        console.error('Unknown command. Available: create [outDir], restore <backupDir>');
        process.exit(1);
      }
    } finally {
      await db.close();
    }
  }

  main().catch((err) => {
    console.error('Backup CLI error:', err);
    process.exit(1);
  });
}
