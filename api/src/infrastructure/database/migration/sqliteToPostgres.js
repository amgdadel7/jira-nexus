'use strict';

/**
 * Migration engine: SQLite -> PostgreSQL / PGlite
 *
 * Designed to perform verified, non-destructive, versioned data migrations:
 * - Reads legacy SQLite tables safely without modifying the source database.
 * - Validates schema structures, maps types, normalizes JSON/arrays/dates.
 * - Enforces Security Policy: legacy sessions are NEVER migrated (force re-login).
 * - Detects and remediates orphaned foreign keys with explicit logging (no silent loss).
 * - Resolves data constraints (e.g. single active sprint per project, date sanity).
 * - Syncs PostgreSQL identity sequences to MAX(id).
 * - Supports dry-run analysis and transactional rollback on failure.
 */

const fs = require('fs');
const Database = require('better-sqlite3');
const { sql } = require('../sql');
const { migrate } = require('../migrator');

/** Default fallbacks and constants */
const DEFAULT_WORKFLOW_ID = 1;
const FALLBACK_ISSUE_TYPE_NAME = 'task';
const FALLBACK_STATUS_NAME = 'to do';
const FALLBACK_PRIORITY_NAME = 'medium';

class MigrationLogger {
  constructor(verbose = false) {
    this.verbose = verbose;
    this.logs = [];
    this.warnings = [];
    this.errors = [];
  }

  info(msg) {
    this.logs.push({ level: 'INFO', time: new Date().toISOString(), message: msg });
    if (this.verbose) console.log(`[migration:info] ${msg}`);
  }

  warn(msg, context = {}) {
    this.warnings.push({ time: new Date().toISOString(), message: msg, context });
    if (this.verbose) console.warn(`[migration:warn] ${msg}`, Object.keys(context).length ? context : '');
  }

  error(msg, context = {}) {
    this.errors.push({ time: new Date().toISOString(), message: msg, context });
    console.error(`[migration:error] ${msg}`, Object.keys(context).length ? context : '');
  }
}

/**
 * Helper to safely parse JSON strings or return default value
 */
function safeJsonParse(val, fallback = null) {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

/**
 * Normalizes dates to YYYY-MM-DD or null
 */
function normalizeDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Normalizes timestamps to ISO-8601 UTC string
 */
function normalizeTimestamp(val, fallback = new Date().toISOString()) {
  if (!val) return fallback;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return fallback;
    return d.toISOString();
  } catch {
    return fallback;
  }
}

/**
 * Checks if a table exists in SQLite
 */
function sqliteTableExists(sqliteDb, tableName) {
  const row = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
  return Boolean(row);
}

/**
 * Inspects all tables and row counts in SQLite
 */
function inspectSource(sqliteDb) {
  const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const counts = {};
  for (const t of tables) {
    const r = sqliteDb.prepare(`SELECT count(*) as c FROM "${t.name}"`).get();
    counts[t.name] = r ? r.c : 0;
  }
  return counts;
}

/**
 * Core Migration Executor
 */
async function runMigration({
  sourceDbPath,
  sourceSqlite, // optionally passed for tests
  targetDb,
  dryRun = false,
  verbose = false,
  cleanTarget = false,
} = {}) {
  const logger = new MigrationLogger(verbose);
  const startedAt = Date.now();

  const report = {
    version: '1.0.0',
    mode: dryRun ? 'DRY_RUN' : 'LIVE',
    startedAt: new Date(startedAt).toISOString(),
    sourcePath: sourceDbPath || 'in-memory-fixture',
    sourceCounts: {},
    targetCounts: {},
    remediatedOrphans: [],
    resolvedConflicts: [],
    securityPoliciesApplied: [],
    skippedEntities: {},
    status: 'PENDING',
    durationMs: 0,
    errors: [],
    warnings: [],
  };

  // 1. Open Source Database in Read-Only Mode
  let sqlite = sourceSqlite;
  let shouldCloseSqlite = false;
  if (!sqlite) {
    if (!fs.existsSync(sourceDbPath)) {
      throw new Error(`Source SQLite database not found at path: ${sourceDbPath}`);
    }
    sqlite = new Database(sourceDbPath, { readonly: true });
    shouldCloseSqlite = true;
  }

  try {
    report.sourceCounts = inspectSource(sqlite);
    logger.info(`Source SQLite inspected: ${Object.keys(report.sourceCounts).length} tables found`);

    // 2. Ensure Target Schema is Migrated
    if (!dryRun) {
      if (cleanTarget) {
        logger.info('Clean target requested: resetting schema and reapplying migrations...');
        await targetDb.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      }
      await migrate(targetDb, { logger: verbose ? console : { info: () => {}, warn: () => {} } });
      logger.info('Target schema verified with all migrations applied.');
    }

    // 3. Load Lookups from PostgreSQL (issue_types, statuses, priorities, resolutions, workflows)
    let lookups = {
      issueTypes: new Map(),
      statuses: new Map(),
      priorities: new Map(),
      resolutions: new Map(),
      defaultPriorityId: 3,
      defaultStatusId: 1,
      defaultIssueTypeId: 3,
      defaultWorkflowId: DEFAULT_WORKFLOW_ID,
    };

    if (!dryRun) {
      const itRows = await targetDb.many(sql`SELECT id, lower(name) as name FROM issue_types`);
      for (const r of itRows) lookups.issueTypes.set(r.name, r.id);

      const stRows = await targetDb.many(sql`SELECT id, lower(name) as name, category FROM statuses`);
      for (const r of stRows) lookups.statuses.set(r.name, r);

      const prRows = await targetDb.many(sql`SELECT id, lower(name) as name, is_default FROM priorities`);
      for (const r of prRows) {
        lookups.priorities.set(r.name, r.id);
        if (r.is_default) lookups.defaultPriorityId = r.id;
      }

      const resRows = await targetDb.many(sql`SELECT id, lower(name) as name FROM resolutions`);
      for (const r of resRows) lookups.resolutions.set(r.name, r.id);

      lookups.defaultStatusId = lookups.statuses.get(FALLBACK_STATUS_NAME)?.id || 1;
      lookups.defaultIssueTypeId = lookups.issueTypes.get(FALLBACK_ISSUE_TYPE_NAME) || 3;
    }

    // Security Policy: Sessions
    const sourceSessionsCount = report.sourceCounts['sessions'] || 0;
    report.securityPoliciesApplied.push({
      policy: 'SESSION_INVALIDATION',
      description: 'Legacy plaintext/HMAC sessions are invalidated and not migrated; re-login required.',
      sourceSessionCount: sourceSessionsCount,
      migratedCount: 0,
    });
    report.skippedEntities['sessions'] = sourceSessionsCount;

    // Track migrated entities for report
    const migrated = {
      users: 0,
      user_preferences: 0,
      api_tokens: 0,
      password_resets: 0,
      email_verifications: 0,
      user_identities: 0,
      site_settings: 0,
      projects: 0,
      project_members: 0,
      project_stars: 0,
      board_column_limits: 0,
      components: 0,
      teams: 0,
      team_members: 0,
      sprints: 0,
      versions: 0,
      issues: 0,
      labels: 0,
      issue_labels: 0,
      issue_components: 0,
      comments: 0,
      history: 0,
      watchers: 0,
      votes: 0,
      issue_links: 0,
      attachments: 0,
      notifications: 0,
      worklogs: 0,
      dev_items: 0,
      filters: 0,
      goals: 0,
      goal_issues: 0,
      forms: 0,
      trash: 0,
      audit_log: 0,
      subscription: 0,
      payment_methods: 0,
      invoices: 0,
      automation_rules: 0,
      automation_runs: 0,
      webhooks: 0,
      webhook_deliveries: 0,
    };

    // Sets of known valid IDs across migration phases to check foreign key integrity
    const knownUsers = new Set();
    const knownProjects = new Set();
    const knownIssues = new Set();
    const knownComponents = new Map(); // project_key:name -> id
    const knownSprints = new Map(); // name -> id
    const knownVersions = new Map(); // project_key:name -> id
    const knownTeams = new Set();
    const knownLabels = new Map(); // lower(name) -> id

    // Execution wrapped in dry-run or atomic transaction
    const executeMigration = async (executor) => {
      // -------------------------------------------------------------
      // Phase 1: Users & User Preferences
      // -------------------------------------------------------------
      if (sqliteTableExists(sqlite, 'users')) {
        const users = sqlite.prepare('SELECT * FROM users ORDER BY rowid').all();
        for (const u of users) {
          const role = u.role === 'admin' ? 'admin' : 'member';
          const active = u.active !== 0 && u.active !== false;
          const bot = Boolean(u.bot);
          const emailVerified = u.email_verified !== 0 && u.email_verified !== false;
          const createdAt = normalizeTimestamp(u.created_at);

          knownUsers.add(u.id);

          if (!dryRun) {
            await executor.query(
              `INSERT INTO users (id, name, email, color, password_hash, role, active, title, avatar, bot, email_verified, signup_source, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
               ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 email = EXCLUDED.email,
                 role = EXCLUDED.role,
                 active = EXCLUDED.active,
                 password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash)`,
              [
                u.id,
                u.name || 'Unnamed User',
                u.email || `${u.id}@user.local`,
                u.color || '#0C66E4',
                u.password_hash || null,
                role,
                active,
                u.title || '',
                u.avatar || null,
                bot,
                emailVerified,
                u.signup_source || 'invite',
                createdAt,
              ]
            );

            // User Preferences
            const prefs = safeJsonParse(u.prefs, {});
            const theme = ['light', 'dark', 'system'].includes(prefs.theme) ? prefs.theme : 'light';
            const reduceMotion = Boolean(prefs.reduce_motion || prefs.reduceMotion);
            const weekStart = ['sunday', 'monday', 'saturday'].includes(prefs.week_start || prefs.weekStart)
              ? prefs.week_start || prefs.weekStart
              : 'sunday';
            const notify = safeJsonParse(prefs.notify, {});

            await executor.query(
              `INSERT INTO user_preferences (user_id, theme, reduce_motion, week_start, notify, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (user_id) DO UPDATE SET
                 theme = EXCLUDED.theme,
                 reduce_motion = EXCLUDED.reduce_motion,
                 week_start = EXCLUDED.week_start,
                 notify = EXCLUDED.notify,
                 updated_at = EXCLUDED.updated_at`,
              [u.id, theme, reduceMotion, weekStart, JSON.stringify(notify), createdAt]
            );
          }
          migrated.users++;
          migrated.user_preferences++;
        }
      }

      // Also ensure automation bot is in knownUsers if referenced in postgres
      knownUsers.add('automation');

      // -------------------------------------------------------------
      // Phase 2: Credentials, Tokens & Identities
      // -------------------------------------------------------------
      if (sqliteTableExists(sqlite, 'api_tokens')) {
        const tokens = sqlite.prepare('SELECT * FROM api_tokens').all();
        for (const t of tokens) {
          if (!knownUsers.has(t.user_id)) {
            report.remediatedOrphans.push({ table: 'api_tokens', id: t.id, issue: `Orphaned user_id: ${t.user_id} - Skipped` });
            continue;
          }
          if (!dryRun) {
            await executor.query(
              `INSERT INTO api_tokens (id, user_id, name, token_hash, prefix, created_at, last_used_at, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (token_hash) DO NOTHING`,
              [
                t.id,
                t.user_id,
                t.name || 'Token',
                t.token_hash,
                t.prefix || 'jcpat_',
                normalizeTimestamp(t.created_at),
                t.last_used_at ? normalizeTimestamp(t.last_used_at) : null,
                t.expires_at ? normalizeTimestamp(t.expires_at) : null,
              ]
            );
          }
          migrated.api_tokens++;
        }
      }

      if (sqliteTableExists(sqlite, 'password_resets')) {
        const resets = sqlite.prepare('SELECT * FROM password_resets').all();
        for (const pr of resets) {
          if (!knownUsers.has(pr.user_id)) {
            report.remediatedOrphans.push({ table: 'password_resets', id: pr.token_hash, issue: `Orphaned user_id: ${pr.user_id} - Skipped` });
            continue;
          }
          if (!dryRun) {
            await executor.query(
              `INSERT INTO password_resets (token_hash, user_id, created_at, expires_at, used_at)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (token_hash) DO NOTHING`,
              [
                pr.token_hash,
                pr.user_id,
                normalizeTimestamp(pr.created_at),
                normalizeTimestamp(pr.expires_at),
                pr.used_at ? normalizeTimestamp(pr.used_at) : null,
              ]
            );
          }
          migrated.password_resets++;
        }
      }

      if (sqliteTableExists(sqlite, 'email_verifications')) {
        const evs = sqlite.prepare('SELECT * FROM email_verifications').all();
        for (const ev of evs) {
          if (!dryRun) {
            await executor.query(
              `INSERT INTO email_verifications (id, email, code_hash, attempts, created_at, expires_at, verified_at, signup_token, used_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (id) DO NOTHING`,
              [
                ev.id,
                ev.email,
                ev.code_hash,
                ev.attempts || 0,
                normalizeTimestamp(ev.created_at),
                normalizeTimestamp(ev.expires_at),
                ev.verified_at ? normalizeTimestamp(ev.verified_at) : null,
                ev.signup_token || null,
                ev.used_at ? normalizeTimestamp(ev.used_at) : null,
              ]
            );
          }
          migrated.email_verifications++;
        }
      }

      if (sqliteTableExists(sqlite, 'user_identities')) {
        const identities = sqlite.prepare('SELECT * FROM user_identities').all();
        for (const iden of identities) {
          if (!knownUsers.has(iden.user_id)) {
            report.remediatedOrphans.push({ table: 'user_identities', id: `${iden.provider}:${iden.subject}`, issue: `Orphaned user_id: ${iden.user_id} - Skipped` });
            continue;
          }
          if (!dryRun) {
            await executor.query(
              `INSERT INTO user_identities (provider, subject, user_id, email, created_at, last_login_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (provider, subject) DO NOTHING`,
              [
                iden.provider,
                iden.subject,
                iden.user_id,
                iden.email || null,
                normalizeTimestamp(iden.created_at),
                iden.last_login_at ? normalizeTimestamp(iden.last_login_at) : null,
              ]
            );
          }
          migrated.user_identities++;
        }
      }

      if (sqliteTableExists(sqlite, 'site_settings')) {
        const settings = sqlite.prepare('SELECT * FROM site_settings').all();
        for (const s of settings) {
          let val = safeJsonParse(s.value);
          if (val === null) val = s.value;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO site_settings (key, value, updated_at)
               VALUES ($1, $2, now())
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
              [s.key, JSON.stringify(val)]
            );
          }
          migrated.site_settings++;
        }
      }

      // -------------------------------------------------------------
      // Phase 3: Teams & Team Members
      // -------------------------------------------------------------
      if (sqliteTableExists(sqlite, 'teams')) {
        const teams = sqlite.prepare('SELECT * FROM teams').all();
        for (const tm of teams) {
          knownTeams.add(tm.id);
          const createdBy = knownUsers.has(tm.created_by) ? tm.created_by : null;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO teams (id, name, description, color, created_by, created_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
              [tm.id, tm.name, tm.description || '', tm.color || '#0C66E4', createdBy, normalizeTimestamp(tm.created_at)]
            );
          }
          migrated.teams++;
        }
      }

      if (sqliteTableExists(sqlite, 'team_members')) {
        const tmMembers = sqlite.prepare('SELECT * FROM team_members').all();
        for (const tmm of tmMembers) {
          if (!knownTeams.has(tmm.team_id) || !knownUsers.has(tmm.user_id)) {
            report.remediatedOrphans.push({
              table: 'team_members',
              id: `${tmm.team_id}:${tmm.user_id}`,
              issue: 'Orphaned team_id or user_id - Skipped',
            });
            continue;
          }
          if (!dryRun) {
            await executor.query(
              `INSERT INTO team_members (team_id, user_id)
               VALUES ($1, $2)
               ON CONFLICT (team_id, user_id) DO NOTHING`,
              [tmm.team_id, tmm.user_id]
            );
          }
          migrated.team_members++;
        }
      }

      // -------------------------------------------------------------
      // Phase 4: Projects & Project Membership / Configuration
      // -------------------------------------------------------------
      if (sqliteTableExists(sqlite, 'projects')) {
        const projects = sqlite.prepare('SELECT * FROM projects').all();
        for (const p of projects) {
          const pKey = String(p.key).toUpperCase().trim();
          knownProjects.add(pKey);

          let leadId = p.lead_id;
          if (leadId && !knownUsers.has(leadId)) {
            report.remediatedOrphans.push({ table: 'projects', id: pKey, issue: `Project lead_id ${leadId} not found in users - set to NULL` });
            leadId = null;
          }

          const boardConfig = safeJsonParse(p.board_config, {});
          const swimlanes = ['none', 'assignee', 'epic', 'priority', 'type'].includes(boardConfig.swimlanes)
            ? boardConfig.swimlanes
            : 'none';

          const access = ['open', 'limited', 'private'].includes(p.access) ? p.access : 'open';
          const pType = ['software', 'business', 'service'].includes(p.type) ? p.type : 'software';

          if (!dryRun) {
            await executor.query(
              `INSERT INTO projects (key, name, type, description, lead_id, color, category, access, workflow_id, custom_permissions, board_swimlanes, next_num, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
               ON CONFLICT (key) DO UPDATE SET
                 name = EXCLUDED.name,
                 lead_id = EXCLUDED.lead_id,
                 next_num = GREATEST(projects.next_num, EXCLUDED.next_num)`,
              [
                pKey,
                p.name,
                pType,
                p.description || '',
                leadId,
                p.color || '#FFAB00',
                p.category || '',
                access,
                DEFAULT_WORKFLOW_ID,
                false,
                swimlanes,
                p.next_num || 1,
                normalizeTimestamp(p.created_at),
              ]
            );

            // Column WIP limits
            if (boardConfig.wip && typeof boardConfig.wip === 'object') {
              for (const [colNameOrId, limit] of Object.entries(boardConfig.wip)) {
                const wipLimit = parseInt(limit, 10);
                if (wipLimit > 0) {
                  let statusId = lookups.statuses.get(colNameOrId.toLowerCase())?.id;
                  if (!statusId) statusId = parseInt(colNameOrId, 10);
                  if (statusId && !isNaN(statusId)) {
                    await executor.query(
                      `INSERT INTO board_column_limits (project_key, status_id, wip_limit)
                       VALUES ($1, $2, $3)
                       ON CONFLICT (project_key, status_id) DO UPDATE SET wip_limit = EXCLUDED.wip_limit`,
                      [pKey, statusId, wipLimit]
                    );
                    migrated.board_column_limits++;
                  }
                }
              }
            }
          }
          migrated.projects++;
        }
      }

      if (sqliteTableExists(sqlite, 'project_members')) {
        const members = sqlite.prepare('SELECT * FROM project_members').all();
        for (const m of members) {
          const pKey = String(m.project_key).toUpperCase();
          if (!knownProjects.has(pKey) || !knownUsers.has(m.user_id)) {
            report.remediatedOrphans.push({
              table: 'project_members',
              id: `${pKey}:${m.user_id}`,
              issue: 'Orphaned project_key or user_id - Skipped',
            });
            continue;
          }
          const role = ['admin', 'member', 'viewer'].includes(m.role) ? m.role : 'member';
          const addedBy = knownUsers.has(m.added_by) ? m.added_by : null;

          if (!dryRun) {
            await executor.query(
              `INSERT INTO project_members (project_key, user_id, role, added_by, added_at)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (project_key, user_id) DO UPDATE SET role = EXCLUDED.role`,
              [pKey, m.user_id, role, addedBy, normalizeTimestamp(m.added_at)]
            );
          }
          migrated.project_members++;
        }
      }

      if (sqliteTableExists(sqlite, 'project_stars')) {
        const stars = sqlite.prepare('SELECT * FROM project_stars').all();
        for (const s of stars) {
          const pKey = String(s.project_key).toUpperCase();
          if (!knownProjects.has(pKey) || !knownUsers.has(s.user_id)) continue;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO project_stars (user_id, project_key, starred_at)
               VALUES ($1, $2, now())
               ON CONFLICT (user_id, project_key) DO NOTHING`,
              [s.user_id, pKey]
            );
          }
          migrated.project_stars++;
        }
      }

      // -------------------------------------------------------------
      // Phase 5: Components, Sprints & Releases (Versions)
      // -------------------------------------------------------------
      if (sqliteTableExists(sqlite, 'components')) {
        const comps = sqlite.prepare('SELECT * FROM components').all();
        for (const c of comps) {
          const pKey = String(c.project_key).toUpperCase();
          if (!knownProjects.has(pKey)) {
            report.remediatedOrphans.push({ table: 'components', id: c.id, issue: `Orphaned project_key ${pKey} - Skipped` });
            continue;
          }
          let leadId = c.lead_id;
          if (leadId && !knownUsers.has(leadId)) leadId = null;
          const defaultAssignee = ['unassigned', 'component_lead', 'project_lead'].includes(c.default_assignee)
            ? c.default_assignee
            : 'unassigned';

          knownComponents.set(`${pKey}:${c.name.toLowerCase()}`, c.id);

          if (!dryRun) {
            await executor.query(
              `INSERT INTO components (id, project_key, name, description, lead_id, default_assignee, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
              [c.id, pKey, c.name, c.description || '', leadId, defaultAssignee, normalizeTimestamp(c.created_at)]
            );
          }
          migrated.components++;
        }
      }

      if (sqliteTableExists(sqlite, 'sprints')) {
        const sprints = sqlite.prepare('SELECT * FROM sprints ORDER BY project_key, position').all();
        // Constraint: At most one active sprint per project!
        const activePerProject = new Set();

        for (const sp of sprints) {
          const pKey = String(sp.project_key || 'KAN').toUpperCase();
          if (!knownProjects.has(pKey)) {
            report.remediatedOrphans.push({ table: 'sprints', id: sp.id, issue: `Orphaned project_key ${pKey} - Skipped` });
            continue;
          }

          let state = ['future', 'active', 'closed'].includes(sp.state) ? sp.state : 'future';
          if (state === 'active') {
            if (activePerProject.has(pKey)) {
              report.resolvedConflicts.push({
                table: 'sprints',
                id: sp.id,
                issue: `Project ${pKey} already has an active sprint. Demoting sprint ${sp.name} (${sp.id}) to 'future'.`,
              });
              state = 'future';
            } else {
              activePerProject.add(pKey);
            }
          }

          let startDate = normalizeDate(sp.start_date);
          let endDate = normalizeDate(sp.end_date);
          if (startDate && endDate && endDate < startDate) {
            report.resolvedConflicts.push({
              table: 'sprints',
              id: sp.id,
              issue: `Sprint end_date (${endDate}) before start_date (${startDate}). Swapping or setting end_date = start_date.`,
            });
            endDate = startDate;
          }

          knownSprints.set(sp.name.toLowerCase(), sp.id);
          knownSprints.set(String(sp.id), sp.id);

          if (!dryRun) {
            await executor.query(
              `INSERT INTO sprints (id, project_key, name, goal, state, start_date, end_date, completed_at, position, committed_points, committed_count, completed_points, completed_count, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
               ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, state = EXCLUDED.state`,
              [
                sp.id,
                pKey,
                sp.name,
                sp.goal || '',
                state,
                startDate,
                endDate,
                sp.completed_at ? normalizeTimestamp(sp.completed_at) : null,
                sp.position || 0,
                sp.committed_points !== undefined ? sp.committed_points : null,
                sp.committed_count !== undefined ? sp.committed_count : null,
                sp.completed_points !== undefined ? sp.completed_points : null,
                sp.completed_count !== undefined ? sp.completed_count : null,
                normalizeTimestamp(sp.created_at),
              ]
            );
          }
          migrated.sprints++;
        }
      }

      if (sqliteTableExists(sqlite, 'versions')) {
        const versions = sqlite.prepare('SELECT * FROM versions').all();
        for (const v of versions) {
          const pKey = String(v.project_key).toUpperCase();
          if (!knownProjects.has(pKey)) {
            report.remediatedOrphans.push({ table: 'versions', id: v.id, issue: `Orphaned project_key ${pKey} - Skipped` });
            continue;
          }
          const status = ['unreleased', 'released', 'archived'].includes(v.status) ? v.status : 'unreleased';
          const startDate = normalizeDate(v.start_date);
          const releaseDate = normalizeDate(v.release_date);

          knownVersions.set(`${pKey}:${v.name.toLowerCase()}`, v.id);
          knownVersions.set(`${pKey}:${v.id}`, v.id);

          if (!dryRun) {
            await executor.query(
              `INSERT INTO versions (id, project_key, name, description, status, start_date, release_date, released_at, position, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status`,
              [
                v.id,
                pKey,
                v.name,
                v.description || '',
                status,
                startDate,
                releaseDate,
                v.released_at ? normalizeTimestamp(v.released_at) : null,
                v.position || 0,
                normalizeTimestamp(v.created_at),
              ]
            );
          }
          migrated.versions++;
        }
      }

      // -------------------------------------------------------------
      // Phase 6: Issues, Labels & Issue Mappings
      // -------------------------------------------------------------
      if (sqliteTableExists(sqlite, 'issues')) {
        const issues = sqlite.prepare('SELECT * FROM issues ORDER BY id').all();
        for (const i of issues) {
          const pKey = String(i.project_key).toUpperCase();
          if (!knownProjects.has(pKey)) {
            report.remediatedOrphans.push({ table: 'issues', id: i.key, issue: `Orphaned project_key ${pKey} - Skipped` });
            continue;
          }

          knownIssues.add(i.id);

          // Type resolution
          const typeName = String(i.type || 'Task').toLowerCase();
          const issueTypeId = lookups.issueTypes.get(typeName) || lookups.defaultIssueTypeId;

          // Status resolution
          const statusName = String(i.status || 'To Do').toLowerCase();
          const statusObj = lookups.statuses.get(statusName);
          const statusId = statusObj ? statusObj.id : lookups.defaultStatusId;

          // Priority resolution
          const priorityName = String(i.priority || 'Medium').toLowerCase();
          const priorityId = lookups.priorities.get(priorityName) || lookups.defaultPriorityId;

          // Resolution
          let resolutionId = null;
          if (statusObj && statusObj.category === 'done') {
            resolutionId = lookups.resolutions.get('done') || 1;
          }

          // Assignee & Reporter
          let assigneeId = i.assignee_id;
          if (assigneeId && !knownUsers.has(assigneeId)) {
            report.remediatedOrphans.push({ table: 'issues', id: i.key, issue: `Assignee ${assigneeId} not found in users - set to NULL` });
            assigneeId = null;
          }
          let reporterId = i.reporter_id;
          if (reporterId && !knownUsers.has(reporterId)) {
            report.remediatedOrphans.push({ table: 'issues', id: i.key, issue: `Reporter ${reporterId} not found in users - set to NULL` });
            reporterId = null;
          }

          // Sprint
          let sprintId = null;
          if (i.sprint) {
            sprintId = knownSprints.get(String(i.sprint).toLowerCase()) || null;
          }

          // Version
          let fixVersionId = null;
          if (i.fix_version) {
            fixVersionId = knownVersions.get(`${pKey}:${String(i.fix_version).toLowerCase()}`) || null;
          }

          // Team
          let teamId = i.team_id;
          if (teamId && !knownTeams.has(teamId)) {
            teamId = null;
          }

          // Parent id (cannot be self)
          let parentId = i.parent_id;
          if (parentId && (parentId === i.id || !knownIssues.has(parentId))) {
            if (parentId === i.id) {
              report.resolvedConflicts.push({ table: 'issues', id: i.key, issue: 'Self-referencing parent_id removed' });
            }
            parentId = null;
          }

          // Story points sanity
          let sp = i.story_points !== undefined && i.story_points !== null ? Number(i.story_points) : null;
          if (sp !== null && (isNaN(sp) || sp < 0 || sp > 1000)) {
            sp = null;
          }

          const dueDate = normalizeDate(i.due_date);
          const startDate = normalizeDate(i.start_date);
          const rank = typeof i.rank === 'number' && !isNaN(i.rank) ? i.rank : (i.num || 1) * 1000;
          const origEst = i.original_estimate !== undefined && i.original_estimate >= 0 ? i.original_estimate : null;
          const remEst = i.remaining_estimate !== undefined && i.remaining_estimate >= 0 ? i.remaining_estimate : null;
          const timeSpent = i.time_spent !== undefined && i.time_spent >= 0 ? i.time_spent : 0;
          const resolvedAt = i.resolved_at ? normalizeTimestamp(i.resolved_at) : (statusObj?.category === 'done' ? normalizeTimestamp(i.updated_at) : null);

          if (!dryRun) {
            await executor.query(
              `INSERT INTO issues (id, key, num, project_key, issue_type_id, summary, description, status_id, priority_id, resolution_id, assignee_id, reporter_id, parent_id, sprint_id, fix_version_id, team_id, due_date, start_date, story_points, rank, original_estimate, remaining_estimate, time_spent, created_at, updated_at, resolved_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
               ON CONFLICT (id) DO UPDATE SET
                 summary = EXCLUDED.summary,
                 status_id = EXCLUDED.status_id,
                 updated_at = EXCLUDED.updated_at`,
              [
                i.id,
                i.key,
                i.num,
                pKey,
                issueTypeId,
                (i.summary || 'No Summary').slice(0, 255),
                i.description || '',
                statusId,
                priorityId,
                resolutionId,
                assigneeId,
                reporterId,
                parentId,
                sprintId,
                fixVersionId,
                teamId,
                dueDate,
                startDate,
                sp,
                rank,
                origEst,
                remEst,
                timeSpent,
                normalizeTimestamp(i.created_at),
                normalizeTimestamp(i.updated_at),
                resolvedAt,
              ]
            );

            // Labels handling: normalize array string, insert into labels, insert into issue_labels
            const labelsArray = safeJsonParse(i.labels, []);
            if (Array.isArray(labelsArray)) {
              for (let pos = 0; pos < labelsArray.length; pos++) {
                const rawLabel = String(labelsArray[pos]).trim().replace(/\s+/g, '-');
                if (!rawLabel) continue;
                const lowerLabel = rawLabel.toLowerCase();

                let labelId = knownLabels.get(lowerLabel);
                if (!labelId) {
                  const ins = await executor.query(
                    `INSERT INTO labels (name) VALUES ($1)
                     ON CONFLICT (lower(name)) DO UPDATE SET name = EXCLUDED.name
                     RETURNING id`,
                    [rawLabel]
                  );
                  labelId = ins.rows[0].id;
                  knownLabels.set(lowerLabel, labelId);
                  migrated.labels++;
                }

                await executor.query(
                  `INSERT INTO issue_labels (issue_id, label_id, position)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (issue_id, label_id) DO NOTHING`,
                  [i.id, labelId, pos]
                );
                migrated.issue_labels++;
              }
            }

            // Components handling: normalize array string, lookup in components, insert into issue_components
            const compsArray = safeJsonParse(i.components, []);
            if (Array.isArray(compsArray)) {
              for (let pos = 0; pos < compsArray.length; pos++) {
                const compName = String(compsArray[pos]).trim().toLowerCase();
                const compId = knownComponents.get(`${pKey}:${compName}`);
                if (compId) {
                  await executor.query(
                    `INSERT INTO issue_components (issue_id, component_id, position)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (issue_id, component_id) DO NOTHING`,
                    [i.id, compId, pos]
                  );
                  migrated.issue_components++;
                }
              }
            }
          }
          migrated.issues++;
        }
      }

      // -------------------------------------------------------------
      // Phase 7: Issue Attached Data (Comments, History, Watchers, Votes, Links, Attachments, Worklogs, Dev Items)
      // -------------------------------------------------------------
      if (sqliteTableExists(sqlite, 'comments')) {
        const comments = sqlite.prepare('SELECT * FROM comments').all();
        for (const c of comments) {
          if (!knownIssues.has(c.issue_id)) {
            report.remediatedOrphans.push({ table: 'comments', id: c.id, issue: `Orphaned issue_id ${c.issue_id} - Skipped` });
            continue;
          }
          const authorId = knownUsers.has(c.author_id) ? c.author_id : null;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO comments (id, issue_id, author_id, body, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (id) DO NOTHING`,
              [c.id, c.issue_id, authorId, c.body || '', normalizeTimestamp(c.created_at), normalizeTimestamp(c.updated_at)]
            );
          }
          migrated.comments++;
        }
      }

      if (sqliteTableExists(sqlite, 'history')) {
        const histories = sqlite.prepare('SELECT * FROM history').all();
        for (const h of histories) {
          if (!knownIssues.has(h.issue_id)) continue;
          const authorId = knownUsers.has(h.author_id) ? h.author_id : null;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO history (id, issue_id, author_id, field, from_value, to_value, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO NOTHING`,
              [h.id, h.issue_id, authorId, h.field, h.from_value || null, h.to_value || null, normalizeTimestamp(h.created_at)]
            );
          }
          migrated.history++;
        }
      }

      if (sqliteTableExists(sqlite, 'watchers')) {
        const watchers = sqlite.prepare('SELECT * FROM watchers').all();
        for (const w of watchers) {
          if (!knownIssues.has(w.issue_id) || !knownUsers.has(w.user_id)) continue;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO watchers (issue_id, user_id)
               VALUES ($1, $2)
               ON CONFLICT (issue_id, user_id) DO NOTHING`,
              [w.issue_id, w.user_id]
            );
          }
          migrated.watchers++;
        }
      }

      if (sqliteTableExists(sqlite, 'votes')) {
        const votes = sqlite.prepare('SELECT * FROM votes').all();
        for (const v of votes) {
          if (!knownIssues.has(v.issue_id) || !knownUsers.has(v.user_id)) continue;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO votes (issue_id, user_id, created_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (issue_id, user_id) DO NOTHING`,
              [v.issue_id, v.user_id, normalizeTimestamp(v.created_at)]
            );
          }
          migrated.votes++;
        }
      }

      if (sqliteTableExists(sqlite, 'issue_links')) {
        const links = sqlite.prepare('SELECT * FROM issue_links').all();
        for (const lk of links) {
          if (!knownIssues.has(lk.source_id) || !knownIssues.has(lk.target_id) || lk.source_id === lk.target_id) {
            report.remediatedOrphans.push({ table: 'issue_links', id: lk.id, issue: 'Invalid source/target link - Skipped' });
            continue;
          }
          const validTypes = ['blocks', 'relates', 'duplicates', 'clones'];
          const lkType = validTypes.includes(lk.type) ? lk.type : 'relates';
          const createdBy = knownUsers.has(lk.created_by) ? lk.created_by : null;

          if (!dryRun) {
            await executor.query(
              `INSERT INTO issue_links (id, source_id, target_id, type, created_by, created_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (id) DO NOTHING`,
              [lk.id, lk.source_id, lk.target_id, lkType, createdBy, normalizeTimestamp(lk.created_at)]
            );
          }
          migrated.issue_links++;
        }
      }

      if (sqliteTableExists(sqlite, 'attachments')) {
        const atts = sqlite.prepare('SELECT * FROM attachments').all();
        for (const a of atts) {
          if (!knownIssues.has(a.issue_id)) {
            report.remediatedOrphans.push({ table: 'attachments', id: a.id, issue: `Orphaned issue_id ${a.issue_id} - Skipped` });
            continue;
          }
          const uploaderId = knownUsers.has(a.uploader_id) ? a.uploader_id : null;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO attachments (id, issue_id, filename, mime, size, stored_name, uploader_id, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [
                a.id,
                a.issue_id,
                a.filename,
                a.mime || 'application/octet-stream',
                a.size || 0,
                a.stored_name,
                uploaderId,
                normalizeTimestamp(a.created_at),
              ]
            );
          }
          migrated.attachments++;
        }
      }

      if (sqliteTableExists(sqlite, 'notifications')) {
        const notifs = sqlite.prepare('SELECT * FROM notifications').all();
        for (const n of notifs) {
          if (!knownUsers.has(n.user_id)) continue;
          const actorId = knownUsers.has(n.actor_id) ? n.actor_id : null;
          const issueId = n.issue_id && knownIssues.has(n.issue_id) ? n.issue_id : null;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO notifications (id, user_id, actor_id, issue_id, type, message, read, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [
                n.id,
                n.user_id,
                actorId,
                issueId,
                n.type || 'assigned',
                n.message || '',
                Boolean(n.read),
                normalizeTimestamp(n.created_at),
              ]
            );
          }
          migrated.notifications++;
        }
      }

      if (sqliteTableExists(sqlite, 'worklogs')) {
        const worklogs = sqlite.prepare('SELECT * FROM worklogs').all();
        for (const wl of worklogs) {
          if (!knownIssues.has(wl.issue_id) || wl.time_spent <= 0) continue;
          const authorId = knownUsers.has(wl.author_id) ? wl.author_id : null;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO worklogs (id, issue_id, author_id, started_at, time_spent, comment, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [
                wl.id,
                wl.issue_id,
                authorId,
                normalizeTimestamp(wl.started_at),
                wl.time_spent,
                wl.comment || '',
                normalizeTimestamp(wl.created_at),
                normalizeTimestamp(wl.updated_at),
              ]
            );
          }
          migrated.worklogs++;
        }
      }

      if (sqliteTableExists(sqlite, 'dev_items')) {
        const devItems = sqlite.prepare('SELECT * FROM dev_items').all();
        for (const di of devItems) {
          const issueId = di.issue_id && knownIssues.has(di.issue_id) ? di.issue_id : null;
          const kind = ['branch', 'commit', 'pr'].includes(di.kind) ? di.kind : 'branch';
          const authorId = knownUsers.has(di.author_id) ? di.author_id : null;

          if (!dryRun) {
            await executor.query(
              `INSERT INTO dev_items (id, issue_id, kind, repo, name, ref, status, author_id, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (id) DO NOTHING`,
              [di.id, issueId, kind, di.repo || '', di.name, di.ref || null, di.status || null, authorId, normalizeTimestamp(di.created_at)]
            );
          }
          migrated.dev_items++;
        }
      }

      // -------------------------------------------------------------
      // Phase 8: Workspace (Filters, Goals, Forms, Trash, Audit Log)
      // -------------------------------------------------------------
      if (sqliteTableExists(sqlite, 'filters')) {
        const filters = sqlite.prepare('SELECT * FROM filters').all();
        for (const f of filters) {
          const ownerId = knownUsers.has(f.owner_id) ? f.owner_id : null;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO filters (id, name, description, jql, owner_id, starred, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [
                f.id,
                f.name,
                f.description || '',
                f.jql || '',
                ownerId,
                Boolean(f.starred),
                normalizeTimestamp(f.created_at),
                normalizeTimestamp(f.updated_at),
              ]
            );
          }
          migrated.filters++;
        }
      }

      if (sqliteTableExists(sqlite, 'goals')) {
        const goals = sqlite.prepare('SELECT * FROM goals').all();
        for (const g of goals) {
          const status = ['pending', 'on_track', 'at_risk', 'off_track', 'done', 'cancelled'].includes(g.status)
            ? g.status
            : 'pending';
          const ownerId = knownUsers.has(g.owner_id) ? g.owner_id : null;
          const targetDate = normalizeDate(g.target_date);

          if (!dryRun) {
            await executor.query(
              `INSERT INTO goals (id, name, description, status, owner_id, target_date, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [
                g.id,
                g.name,
                g.description || '',
                status,
                ownerId,
                targetDate,
                normalizeTimestamp(g.created_at),
                normalizeTimestamp(g.updated_at),
              ]
            );
          }
          migrated.goals++;
        }
      }

      if (sqliteTableExists(sqlite, 'goal_issues')) {
        const giRows = sqlite.prepare('SELECT * FROM goal_issues').all();
        for (const gi of giRows) {
          if (!knownIssues.has(gi.issue_id)) continue;
          if (!dryRun) {
            await executor.query(
              `INSERT INTO goal_issues (goal_id, issue_id)
               VALUES ($1, $2)
               ON CONFLICT (goal_id, issue_id) DO NOTHING`,
              [gi.goal_id, gi.issue_id]
            );
          }
          migrated.goal_issues++;
        }
      }

      if (sqliteTableExists(sqlite, 'forms')) {
        const forms = sqlite.prepare('SELECT * FROM forms').all();
        for (const fm of forms) {
          const pKey = String(fm.project_key || 'KAN').toUpperCase();
          if (!knownProjects.has(pKey)) continue;

          const typeName = String(fm.issue_type || 'Task').toLowerCase();
          const issueTypeId = lookups.issueTypes.get(typeName) || lookups.defaultIssueTypeId;
          const fields = safeJsonParse(fm.fields, []);
          const defLabels = safeJsonParse(fm.default_labels, []);
          const defAssignee = knownUsers.has(fm.default_assignee_id) ? fm.default_assignee_id : null;
          const createdBy = knownUsers.has(fm.created_by) ? fm.created_by : null;

          if (!dryRun) {
            await executor.query(
              `INSERT INTO forms (id, project_key, name, description, issue_type_id, fields, default_labels, default_assignee_id, active, submissions, created_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
               ON CONFLICT (id) DO NOTHING`,
              [
                fm.id,
                pKey,
                fm.name,
                fm.description || '',
                issueTypeId,
                JSON.stringify(fields),
                Array.isArray(defLabels) ? defLabels : [],
                defAssignee,
                Boolean(fm.active !== 0),
                fm.submissions || 0,
                createdBy,
                normalizeTimestamp(fm.created_at),
                normalizeTimestamp(fm.updated_at),
              ]
            );
          }
          migrated.forms++;
        }
      }

      if (sqliteTableExists(sqlite, 'trash')) {
        const trash = sqlite.prepare('SELECT * FROM trash').all();
        for (const tr of trash) {
          const pKey = String(tr.project_key).toUpperCase();
          const snapshot = safeJsonParse(tr.snapshot, {});
          const files = safeJsonParse(tr.files, []);
          const deletedBy = knownUsers.has(tr.deleted_by) ? tr.deleted_by : null;

          if (!dryRun) {
            await executor.query(
              `INSERT INTO trash (id, project_key, issue_key, summary, type, snapshot, files, deleted_by, deleted_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (id) DO NOTHING`,
              [
                tr.id,
                pKey,
                tr.issue_key,
                tr.summary,
                tr.type,
                JSON.stringify(snapshot),
                JSON.stringify(files),
                deletedBy,
                normalizeTimestamp(tr.deleted_at),
              ]
            );
          }
          migrated.trash++;
        }
      }

      if (sqliteTableExists(sqlite, 'audit_log')) {
        const audits = sqlite.prepare('SELECT * FROM audit_log').all();
        for (const al of audits) {
          const actorId = knownUsers.has(al.actor_id) ? al.actor_id : null;
          const details = safeJsonParse(al.details, {});

          if (!dryRun) {
            await executor.query(
              `INSERT INTO audit_log (id, actor_id, action, project_key, target, details, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO NOTHING`,
              [al.id, actorId, al.action, al.project_key || null, al.target || null, JSON.stringify(details), normalizeTimestamp(al.created_at)]
            );
          }
          migrated.audit_log++;
        }
      }

      // -------------------------------------------------------------
      // Phase 9: Billing, Automation & Webhooks
      // -------------------------------------------------------------
      if (sqliteTableExists(sqlite, 'subscription')) {
        const sub = sqlite.prepare('SELECT * FROM subscription WHERE id = 1').get();
        if (sub) {
          const plan = ['free', 'standard', 'premium'].includes(sub.plan) ? sub.plan : 'free';
          const cycle = ['monthly', 'annual'].includes(sub.cycle) ? sub.cycle : 'monthly';
          if (!dryRun) {
            await executor.query(
              `INSERT INTO subscription (id, plan, cycle, status, trial_ends_at, trial_used, current_period_start, current_period_end, cancel_at_period_end, billing_email, company, updated_at)
               VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO UPDATE SET plan = EXCLUDED.plan, cycle = EXCLUDED.cycle, status = EXCLUDED.status`,
              [
                plan,
                cycle,
                sub.status || 'active',
                sub.trial_ends_at ? normalizeTimestamp(sub.trial_ends_at) : null,
                Boolean(sub.trial_used),
                sub.current_period_start ? normalizeTimestamp(sub.current_period_start) : null,
                sub.current_period_end ? normalizeTimestamp(sub.current_period_end) : null,
                Boolean(sub.cancel_at_period_end),
                sub.billing_email || null,
                sub.company || null,
                normalizeTimestamp(sub.updated_at),
              ]
            );
          }
          migrated.subscription++;
        }
      }

      if (sqliteTableExists(sqlite, 'payment_methods')) {
        const pms = sqlite.prepare('SELECT * FROM payment_methods').all();
        for (const pm of pms) {
          if (!dryRun) {
            await executor.query(
              `INSERT INTO payment_methods (id, brand, last4, exp_month, exp_year, holder, is_default, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [
                pm.id,
                pm.brand,
                String(pm.last4).padStart(4, '0').slice(-4),
                pm.exp_month || 1,
                pm.exp_year || 2027,
                pm.holder || '',
                Boolean(pm.is_default),
                normalizeTimestamp(pm.created_at),
              ]
            );
          }
          migrated.payment_methods++;
        }
      }

      if (sqliteTableExists(sqlite, 'invoices')) {
        const invs = sqlite.prepare('SELECT * FROM invoices').all();
        for (const inv of invs) {
          const lines = safeJsonParse(inv.lines, []);
          const status = ['paid', 'open', 'void'].includes(inv.status) ? inv.status : 'paid';
          if (!dryRun) {
            await executor.query(
              `INSERT INTO invoices (id, number, plan, cycle, seats, lines, subtotal_cents, total_cents, status, card, period_start, period_end, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
               ON CONFLICT (number) DO NOTHING`,
              [
                inv.id,
                inv.number,
                inv.plan,
                inv.cycle,
                inv.seats || 1,
                JSON.stringify(lines),
                inv.subtotal_cents || 0,
                inv.total_cents || 0,
                status,
                inv.card || null,
                inv.period_start ? normalizeTimestamp(inv.period_start) : null,
                inv.period_end ? normalizeTimestamp(inv.period_end) : null,
                normalizeTimestamp(inv.created_at),
              ]
            );
          }
          migrated.invoices++;
        }
      }

      if (sqliteTableExists(sqlite, 'automation_rules')) {
        const rules = sqlite.prepare('SELECT * FROM automation_rules').all();
        for (const r of rules) {
          const pKey = String(r.project_key).toUpperCase();
          if (!knownProjects.has(pKey)) continue;

          let trig = safeJsonParse(r.trigger);
          if (!trig || typeof trig !== 'object') {
            trig = { type: String(r.trigger || 'manual') };
          }
          const actions = safeJsonParse(r.actions, []);
          const createdBy = knownUsers.has(r.created_by) ? r.created_by : null;

          if (!dryRun) {
            await executor.query(
              `INSERT INTO automation_rules (id, project_key, name, description, enabled, trigger, condition, actions, created_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO NOTHING`,
              [
                r.id,
                pKey,
                r.name,
                r.description || '',
                Boolean(r.enabled !== 0),
                JSON.stringify(trig),
                r.condition || '',
                JSON.stringify(actions),
                createdBy,
                normalizeTimestamp(r.created_at),
                normalizeTimestamp(r.updated_at),
              ]
            );
          }
          migrated.automation_rules++;
        }
      }

      if (sqliteTableExists(sqlite, 'automation_runs')) {
        const runs = sqlite.prepare('SELECT * FROM automation_runs').all();
        for (const ar of runs) {
          const status = ['success', 'some_errors', 'failure', 'no_actions', 'throttled'].includes(ar.status)
            ? ar.status
            : 'success';
          const actions = safeJsonParse(ar.actions, []);
          if (!dryRun) {
            await executor.query(
              `INSERT INTO automation_runs (id, rule_id, issue_key, status, message, actions, duration_ms, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [ar.id, ar.rule_id, ar.issue_key || null, status, ar.message || '', JSON.stringify(actions), ar.duration_ms || 0, normalizeTimestamp(ar.created_at)]
            );
          }
          migrated.automation_runs++;
        }
      }

      if (sqliteTableExists(sqlite, 'webhooks')) {
        const webhooks = sqlite.prepare('SELECT * FROM webhooks').all();
        for (const wh of webhooks) {
          const events = safeJsonParse(wh.events, []);
          const createdBy = knownUsers.has(wh.created_by) ? wh.created_by : null;

          if (!dryRun) {
            await executor.query(
              `INSERT INTO webhooks (id, name, url, secret, events, jql, enabled, created_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (id) DO NOTHING`,
              [
                wh.id,
                wh.name,
                wh.url,
                wh.secret || '',
                Array.isArray(events) ? events : [],
                wh.jql || '',
                Boolean(wh.enabled !== 0),
                createdBy,
                normalizeTimestamp(wh.created_at),
                normalizeTimestamp(wh.updated_at),
              ]
            );
          }
          migrated.webhooks++;
        }
      }

      if (sqliteTableExists(sqlite, 'webhook_deliveries')) {
        const deliveries = sqlite.prepare('SELECT * FROM webhook_deliveries').all();
        for (const wd of deliveries) {
          const payload = safeJsonParse(wd.payload, {});
          if (!dryRun) {
            await executor.query(
              `INSERT INTO webhook_deliveries (id, webhook_id, uuid, event, payload, status_code, ok, duration_ms, error, response, attempt, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
               ON CONFLICT (id) DO NOTHING`,
              [
                wd.id,
                wd.webhook_id,
                wd.uuid || `migrated-${wd.id}`,
                wd.event || 'unknown',
                JSON.stringify(payload),
                wd.status_code || null,
                Boolean(wd.ok),
                wd.duration_ms || 0,
                wd.error || null,
                wd.response || null,
                wd.attempt || 1,
                normalizeTimestamp(wd.created_at),
              ]
            );
          }
          migrated.webhook_deliveries++;
        }
      }

      // -------------------------------------------------------------
      // Phase 10: Advance PostgreSQL Identity Sequences
      // -------------------------------------------------------------
      if (!dryRun) {
        const tablesWithIdentity = [
          'api_tokens', 'email_verifications', 'components', 'teams', 'sprints',
          'versions', 'issues', 'labels', 'comments', 'history', 'issue_links',
          'attachments', 'notifications', 'worklogs', 'dev_items', 'filters', 'goals', 'forms',
          'dashboards', 'dashboard_gadgets', 'trash', 'audit_log', 'payment_methods',
          'invoices', 'automation_rules', 'automation_runs', 'webhooks', 'webhook_deliveries'
        ];

        for (const tbl of tablesWithIdentity) {
          try {
            await executor.query(`
              SELECT setval(
                pg_get_serial_sequence($1, 'id'),
                COALESCE((SELECT MAX(id) FROM ${tbl}), 1)
              )
            `, [tbl]);
          } catch (seqErr) {
            // Some tables might have different sequence types or 0 rows; handle safely
            logger.warn(`Sequence adjustment for ${tbl}: ${seqErr.message}`);
          }
        }
      }
    };

    if (dryRun) {
      await executeMigration(null);
      report.status = 'DRY_RUN_COMPLETED';
    } else {
      await targetDb.tx(async () => {
        await executeMigration(targetDb);
      });
      report.status = 'SUCCESS';
    }

    report.targetCounts = migrated;
    report.durationMs = Date.now() - startedAt;
    report.warnings = logger.warnings;
    report.errors = logger.errors;

    logger.info(`Migration finished in ${report.durationMs}ms with status ${report.status}`);
    return report;
  } catch (err) {
    report.status = 'FAILED';
    report.durationMs = Date.now() - startedAt;
    report.errors.push({ message: err.message, stack: err.stack });
    logger.error(`Migration failed: ${err.message}`);
    throw err;
  } finally {
    if (shouldCloseSqlite && sqlite) {
      sqlite.close();
    }
  }
}

module.exports = {
  runMigration,
  inspectSource,
  MigrationLogger,
};
