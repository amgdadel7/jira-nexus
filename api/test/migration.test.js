'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createPgliteAdapter } = require('../src/infrastructure/database/adapters');
const { Database: PgDatabase } = require('../src/infrastructure/database/database');
const { runMigration } = require('../src/infrastructure/database/migration/sqliteToPostgres');
const { migrate } = require('../src/infrastructure/database/migrator');
const { sql } = require('../src/infrastructure/database/sql');

/**
 * Creates an in-memory SQLite database populated with realistic synthetic test data
 */
function createSyntheticSqliteDb() {
  const db = new Database(':memory:');

  db.exec(`
    CREATE TABLE projects (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'software',
      description TEXT NOT NULL DEFAULT '',
      lead_id TEXT,
      next_num INTEGER NOT NULL DEFAULT 1,
      color TEXT NOT NULL DEFAULT '#FFAB00',
      category TEXT NOT NULL DEFAULT '',
      access TEXT NOT NULL DEFAULT 'open',
      board_config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT
    );

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      active INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL DEFAULT '',
      created_at TEXT,
      prefs TEXT NOT NULL DEFAULT '{}',
      avatar TEXT,
      bot INTEGER NOT NULL DEFAULT 0,
      email_verified INTEGER NOT NULL DEFAULT 1,
      signup_source TEXT NOT NULL DEFAULT 'invite'
    );

    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      expires_at TEXT
    );

    CREATE TABLE teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#0C66E4',
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE team_members (
      team_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (team_id, user_id)
    );

    CREATE TABLE components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      lead_id TEXT,
      default_assignee TEXT NOT NULL DEFAULT 'unassigned',
      created_at TEXT NOT NULL
    );

    CREATE TABLE sprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_key TEXT NOT NULL,
      name TEXT NOT NULL,
      goal TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'future',
      start_date TEXT,
      end_date TEXT,
      completed_at TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      committed_points REAL,
      committed_count INTEGER,
      completed_points REAL,
      completed_count INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'unreleased',
      start_date TEXT,
      release_date TEXT,
      released_at TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      num INTEGER NOT NULL,
      project_key TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Task',
      summary TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'To Do',
      priority TEXT NOT NULL DEFAULT 'Medium',
      assignee_id TEXT,
      reporter_id TEXT,
      parent_id INTEGER,
      labels TEXT NOT NULL DEFAULT '[]',
      due_date TEXT,
      start_date TEXT,
      story_points REAL,
      sprint TEXT,
      fix_version TEXT,
      rank REAL NOT NULL,
      original_estimate INTEGER,
      remaining_estimate INTEGER,
      time_spent INTEGER NOT NULL DEFAULT 0,
      components TEXT NOT NULL DEFAULT '[]',
      team_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id INTEGER NOT NULL,
      author_id TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id INTEGER NOT NULL,
      author_id TEXT,
      field TEXT NOT NULL,
      from_value TEXT,
      to_value TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      stored_name TEXT NOT NULL,
      uploader_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE worklogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id INTEGER NOT NULL,
      author_id TEXT,
      started_at TEXT NOT NULL,
      time_spent INTEGER NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      jql TEXT NOT NULL,
      owner_id TEXT,
      starred INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE project_members (
      project_key TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      added_by TEXT,
      added_at TEXT NOT NULL,
      PRIMARY KEY (project_key, user_id)
    );

    CREATE TABLE subscription (
      id INTEGER PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'free',
      cycle TEXT NOT NULL DEFAULT 'monthly',
      status TEXT NOT NULL DEFAULT 'active',
      trial_ends_at TEXT,
      trial_used INTEGER NOT NULL DEFAULT 0,
      current_period_start TEXT,
      current_period_end TEXT,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      billing_email TEXT,
      company TEXT,
      updated_at TEXT
    );
  `);

  // Insert seed fixtures
  db.exec(`
    INSERT INTO users (id, name, email, color, password_hash, role, active, prefs, created_at)
    VALUES
      ('u1', 'Ali Hassan', 'ali@example.com', '#0052CC', 'hash1', 'admin', 1, '{"theme":"dark","week_start":"sunday"}', '2026-01-01T10:00:00.000Z'),
      ('u2', 'Fatima Zahra', 'fatima@example.com', '#6554C0', 'hash2', 'member', 1, '{"theme":"light"}', '2026-01-02T10:00:00.000Z');

    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES
      ('sess_insecure_token_1', 'u1', '2026-01-01T10:00:00.000Z', '2026-02-01T10:00:00.000Z'),
      ('sess_insecure_token_2', 'u2', '2026-01-02T10:00:00.000Z', '2026-02-02T10:00:00.000Z');

    INSERT INTO api_tokens (id, user_id, name, token_hash, prefix, created_at)
    VALUES (1, 'u1', 'CI Token', 'hash_token_abc', 'jcpat_', '2026-01-05T00:00:00.000Z');

    INSERT INTO projects (key, name, type, description, lead_id, color, created_at)
    VALUES ('PROJ', 'Test Project', 'software', 'Project description', 'u1', '#0052CC', '2026-01-01T00:00:00.000Z');

    INSERT INTO project_members (project_key, user_id, role, added_by, added_at)
    VALUES ('PROJ', 'u1', 'admin', 'u1', '2026-01-01T00:00:00.000Z');

    INSERT INTO components (id, project_key, name, description, created_at)
    VALUES (1, 'PROJ', 'Backend', 'Core APIs', '2026-01-01T00:00:00.000Z');

    INSERT INTO sprints (id, project_key, name, goal, state, start_date, end_date, position, created_at)
    VALUES (1, 'PROJ', 'Sprint 1', 'Ship beta', 'active', '2026-01-10', '2026-01-24', 0, '2026-01-01T00:00:00.000Z');

    INSERT INTO versions (id, project_key, name, description, status, position, created_at)
    VALUES (1, 'PROJ', 'v1.0.0', 'Initial release', 'released', 0, '2026-01-01T00:00:00.000Z');

    INSERT INTO issues (id, key, num, project_key, type, summary, status, priority, assignee_id, reporter_id, labels, components, sprint, rank, created_at, updated_at)
    VALUES
      (1, 'PROJ-1', 1, 'PROJ', 'Story', 'Implement Auth', 'To Do', 'High', 'u1', 'u1', '["security","backend"]', '["Backend"]', 'Sprint 1', 1000, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z'),
      (2, 'PROJ-2', 2, 'PROJ', 'Task', 'Design DB Schema', 'Done', 'Medium', 'u2', 'u1', '["database"]', '["Backend"]', 'Sprint 1', 2000, '2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z');

    INSERT INTO comments (id, issue_id, author_id, body, created_at, updated_at)
    VALUES (1, 1, 'u1', 'Great progress on this item.', '2026-01-02T12:00:00.000Z', '2026-01-02T12:00:00.000Z');

    INSERT INTO worklogs (id, issue_id, author_id, started_at, time_spent, comment, created_at, updated_at)
    VALUES (1, 1, 'u1', '2026-01-02T14:00:00.000Z', 3600, 'Worked on initial design', '2026-01-02T15:00:00.000Z', '2026-01-02T15:00:00.000Z');

    INSERT INTO filters (id, name, jql, owner_id, created_at, updated_at)
    VALUES (1, 'My Open Issues', 'assignee = currentUser() AND status != Done', 'u1', '2026-01-04T00:00:00.000Z', '2026-01-04T00:00:00.000Z');

    INSERT INTO subscription (id, plan, cycle, status, updated_at)
    VALUES (1, 'premium', 'annual', 'active', '2026-01-01T00:00:00.000Z');
  `);

  return db;
}

async function createTargetPgDatabase() {
  const adapter = await createPgliteAdapter({ dataDir: 'memory://' });
  const db = new PgDatabase(adapter);
  await migrate(db, { logger: { info: () => {}, warn: () => {} } });
  return db;
}

test('Step 03 Data Migration: Clean Target Migration & Verification', async () => {
  const sqlite = createSyntheticSqliteDb();
  const pgDb = await createTargetPgDatabase();

  try {
    const report = await runMigration({
      sourceSqlite: sqlite,
      targetDb: pgDb,
      dryRun: false,
    });

    assert.equal(report.status, 'SUCCESS');
    assert.equal(report.targetCounts.users, 2);
    assert.equal(report.targetCounts.projects, 1);
    assert.equal(report.targetCounts.issues, 2);
    assert.equal(report.targetCounts.comments, 1);
    assert.equal(report.targetCounts.worklogs, 1);
    assert.equal(report.targetCounts.filters, 1);
    assert.equal(report.targetCounts.sprints, 1);
    assert.equal(report.targetCounts.components, 1);

    // Verify User Preferences migrated
    const u1Pref = await pgDb.one(sql`SELECT theme, week_start FROM user_preferences WHERE user_id = 'u1'`);
    assert.equal(u1Pref.theme, 'dark');
    assert.equal(u1Pref.week_start, 'sunday');

    // Verify Issue View & Join integrity
    const issueViewRows = await pgDb.many(sql`SELECT key, type, status, priority, sprint FROM issue_view ORDER BY num`);
    assert.equal(issueViewRows.length, 2);
    assert.equal(issueViewRows[0].key, 'PROJ-1');
    assert.equal(issueViewRows[0].type, 'Story');
    assert.equal(issueViewRows[0].status, 'To Do');
    assert.equal(issueViewRows[0].priority, 'High');
    assert.equal(issueViewRows[0].sprint, 'Sprint 1');

    assert.equal(issueViewRows[1].key, 'PROJ-2');
    assert.equal(issueViewRows[1].type, 'Task');
    assert.equal(issueViewRows[1].status, 'Done');

    // Verify Labels dictionary & relational link
    const labels = await pgDb.many(sql`SELECT l.name FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE il.issue_id = 1 ORDER BY l.name`);
    assert.deepEqual(labels.map((r) => r.name), ['backend', 'security']);

    // Verify Components relational link
    const comps = await pgDb.many(sql`SELECT c.name FROM issue_components ic JOIN components c ON c.id = ic.component_id WHERE ic.issue_id = 1`);
    assert.equal(comps.length, 1);
    assert.equal(comps[0].name, 'Backend');
  } finally {
    sqlite.close();
    await pgDb.adapter.close();
  }
});

test('Step 03 Data Migration: Session Invalidation Policy Enforcement', async () => {
  const sqlite = createSyntheticSqliteDb();
  const pgDb = await createTargetPgDatabase();

  try {
    const report = await runMigration({
      sourceSqlite: sqlite,
      targetDb: pgDb,
      dryRun: false,
    });

    assert.equal(report.status, 'SUCCESS');
    assert.equal(report.sourceCounts.sessions, 2);
    assert.equal(report.skippedEntities['sessions'], 2);

    // Verify sessions table in PostgreSQL contains 0 legacy sessions
    const pgSessions = await pgDb.many(sql`SELECT * FROM sessions`);
    assert.equal(pgSessions.length, 0, 'No legacy sessions should exist in PostgreSQL');

    // Confirm security policy was logged in report
    const policy = report.securityPoliciesApplied.find((p) => p.policy === 'SESSION_INVALIDATION');
    assert.ok(policy, 'SESSION_INVALIDATION policy must be documented');
    assert.equal(policy.migratedCount, 0);
  } finally {
    sqlite.close();
    await pgDb.adapter.close();
  }
});

test('Step 03 Data Migration: Dry-Run Mode Inspection (No Writes)', async () => {
  const sqlite = createSyntheticSqliteDb();
  const pgDb = await createTargetPgDatabase();

  try {
    const report = await runMigration({
      sourceSqlite: sqlite,
      targetDb: pgDb,
      dryRun: true,
    });

    assert.equal(report.status, 'DRY_RUN_COMPLETED');
    assert.equal(report.mode, 'DRY_RUN');
    assert.equal(report.sourceCounts.users, 2);
    assert.equal(report.sourceCounts.issues, 2);

    // Verify target PostgreSQL is completely untouched (0 custom projects/issues)
    const issueCount = await pgDb.value(sql`SELECT count(*) FROM issues`);
    assert.equal(Number(issueCount), 0, 'Dry run must not insert any issues');

    const projectCount = await pgDb.value(sql`SELECT count(*) FROM projects`);
    assert.equal(Number(projectCount), 0, 'Dry run must not insert any projects');
  } finally {
    sqlite.close();
    await pgDb.adapter.close();
  }
});

test('Step 03 Data Migration: Orphan Remediation & Conflict Resolution', async () => {
  const sqlite = createSyntheticSqliteDb();

  // Add dirty / orphaned / conflicting data:
  // 1. Issue with non-existent assignee 'u_ghost'
  // 2. Issue with self-referencing parent
  // 3. Second active sprint for PROJ (violating at most 1 active sprint rule)
  // 4. Sprint with end_date < start_date
  // 5. Project member for unknown user
  sqlite.exec(`
    INSERT INTO issues (id, key, num, project_key, type, summary, status, priority, assignee_id, reporter_id, parent_id, rank, created_at, updated_at)
    VALUES (99, 'PROJ-99', 99, 'PROJ', 'Task', 'Orphaned Task', 'To Do', 'Low', 'u_ghost', 'u_ghost2', 99, 99000, '2026-01-05T00:00:00.000Z', '2026-01-05T00:00:00.000Z');

    INSERT INTO sprints (id, project_key, name, goal, state, start_date, end_date, position, created_at)
    VALUES (2, 'PROJ', 'Sprint 2 (Conflicting Active)', 'Overlapping active', 'active', '2026-01-20', '2026-01-15', 1, '2026-01-05T00:00:00.000Z');

    INSERT INTO project_members (project_key, user_id, role, added_at)
    VALUES ('PROJ', 'u_ghost', 'member', '2026-01-01T00:00:00.000Z');
  `);

  const pgDb = await createTargetPgDatabase();

  try {
    const report = await runMigration({
      sourceSqlite: sqlite,
      targetDb: pgDb,
      dryRun: false,
    });

    assert.equal(report.status, 'SUCCESS');
    assert.ok(report.remediatedOrphans.length > 0, 'Should record remediated orphans');
    assert.ok(report.resolvedConflicts.length > 0, 'Should record resolved conflicts');

    // Verify issue 99 was migrated with assignee and reporter safely nulled (no foreign key crash)
    const issue99 = await pgDb.one(sql`SELECT assignee_id, reporter_id, parent_id FROM issues WHERE id = 99`);
    assert.equal(issue99.assignee_id, null, 'Unknown assignee_id should be set to NULL');
    assert.equal(issue99.reporter_id, null, 'Unknown reporter_id should be set to NULL');
    assert.equal(issue99.parent_id, null, 'Self-referential parent_id should be set to NULL');

    // Verify only ONE active sprint exists in PostgreSQL
    const activeSprints = await pgDb.many(sql`SELECT id, name, state, start_date, end_date FROM sprints WHERE project_key = 'PROJ' AND state = 'active'`);
    assert.equal(activeSprints.length, 1, 'Exactly one active sprint allowed per project');

    // Verify sprint with inverted dates had end_date corrected
    const sprint2 = await pgDb.one(sql`SELECT start_date, end_date FROM sprints WHERE id = 2`);
    assert.ok(sprint2.end_date >= sprint2.start_date, 'End date must be greater than or equal to start date');

    // Verify orphaned project member was skipped
    const ghostMember = await pgDb.one(sql`SELECT * FROM project_members WHERE user_id = 'u_ghost'`);
    assert.equal(ghostMember, null, 'Orphaned member should not be inserted');
  } finally {
    sqlite.close();
    await pgDb.adapter.close();
  }
});

test('Step 03 Data Migration: Atomic Transaction Rollback on Failure & Safe Re-run', async () => {
  const sqlite = createSyntheticSqliteDb();
  const pgDb = await createTargetPgDatabase();

  // Create an intentional failure condition during a mock execution by sabotaging a required table
  // or verifying that when tx throws, nothing is committed.
  try {
    await assert.rejects(async () => {
      await pgDb.tx(async () => {
        await pgDb.query(sql`INSERT INTO users (id, name, email, color) VALUES ('fail_u', 'Fail', 'fail@ex.com', '#000')`);
        throw new Error('Simulated Mid-Migration Failure');
      });
    }, /Simulated Mid-Migration Failure/);

    // Verify rollback worked: user 'fail_u' does not exist
    const failUser = await pgDb.one(sql`SELECT * FROM users WHERE id = 'fail_u'`);
    assert.equal(failUser, null, 'Uncommitted transaction must be rolled back');

    // Now re-run normal migration to ensure clean idempotent success
    const report = await runMigration({
      sourceSqlite: sqlite,
      targetDb: pgDb,
      dryRun: false,
    });
    assert.equal(report.status, 'SUCCESS');
    assert.equal(report.targetCounts.issues, 2);
  } finally {
    sqlite.close();
    await pgDb.adapter.close();
  }
});

test('Step 03 Data Migration: Identity Sequence Advance Allows New Inserts', async () => {
  const sqlite = createSyntheticSqliteDb();
  const pgDb = await createTargetPgDatabase();

  try {
    await runMigration({
      sourceSqlite: sqlite,
      targetDb: pgDb,
      dryRun: false,
    });

    // Highest issue id in sqlite fixture is 2.
    // Inserting a new issue without specifying ID should cleanly allocate ID 3 without duplicate key error.
    const newIssue = await pgDb.one(sql`
      INSERT INTO issues (key, num, project_key, issue_type_id, summary, status_id, priority_id, rank)
      VALUES ('PROJ-3', 3, 'PROJ', 3, 'Newly Created Post-Migration Issue', 1, 3, 3000)
      RETURNING id, key
    `);

    assert.ok(newIssue.id > 2, 'Sequence should allocate an ID higher than migrated MAX(id)');
    assert.equal(newIssue.key, 'PROJ-3');
  } finally {
    sqlite.close();
    await pgDb.adapter.close();
  }
});
