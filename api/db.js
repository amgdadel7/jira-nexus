const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || (process.env.VERCEL ? path.join('/tmp', 'jira.db') : path.join(__dirname, 'data', 'jira.db'));
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const UPLOAD_DIR = process.env.UPLOAD_DIR || (process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(path.dirname(DB_PATH), 'uploads'));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'software',
  description TEXT NOT NULL DEFAULT '',
  lead_id TEXT,
  next_num INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  active INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  num INTEGER NOT NULL,
  project_key TEXT NOT NULL REFERENCES projects(key),
  type TEXT NOT NULL DEFAULT 'Task',
  summary TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'To Do',
  priority TEXT NOT NULL DEFAULT 'Medium',
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  parent_id INTEGER REFERENCES issues(id) ON DELETE SET NULL,
  labels TEXT NOT NULL DEFAULT '[]',
  due_date TEXT,
  start_date TEXT,
  story_points REAL,
  sprint TEXT,
  rank REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  field TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS watchers (
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, user_id)
);
CREATE TABLE IF NOT EXISTS issue_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (source_id, target_id, type)
);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  stored_name TEXT NOT NULL,
  uploader_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  issue_id INTEGER REFERENCES issues(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  jql TEXT NOT NULL,
  owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  starred INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS goal_issues (
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  PRIMARY KEY (goal_id, issue_id)
);
CREATE TABLE IF NOT EXISTS forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  issue_type TEXT NOT NULL DEFAULT 'Task',
  fields TEXT NOT NULL DEFAULT '[]',
  default_labels TEXT NOT NULL DEFAULT '[]',
  default_assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  submissions INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dev_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER REFERENCES issues(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,           -- branch | commit | pr
  repo TEXT NOT NULL,
  name TEXT NOT NULL,           -- branch name, commit message or PR title
  ref TEXT,                     -- commit sha, PR number
  status TEXT,                  -- open | merged | declined (PR), active (branch)
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS sprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL DEFAULT 'KAN',
  name TEXT NOT NULL UNIQUE,
  goal TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'future',   -- future | active | closed
  start_date TEXT,
  end_date TEXT,
  completed_at TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unreleased',   -- unreleased | released | archived
  start_date TEXT,
  release_date TEXT,
  released_at TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (project_key, name)
);
CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  expires_at TEXT
);
CREATE TABLE IF NOT EXISTS project_stars (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  PRIMARY KEY (user_id, project_key)
);
CREATE INDEX IF NOT EXISTS idx_issues_rank ON issues(rank);
CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_key);
CREATE INDEX IF NOT EXISTS idx_issues_sprint ON issues(sprint);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_history_issue ON history(issue_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_dev_issue ON dev_items(issue_id);
`);

// --- lightweight migrations for databases created by v1 of the clone ---
function hasColumn(table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
}
const addCol = (table, col, def) => { if (!hasColumn(table, col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); };
addCol('users', 'password_hash', 'TEXT');
addCol('users', 'role', "TEXT NOT NULL DEFAULT 'member'");
addCol('users', 'active', 'INTEGER NOT NULL DEFAULT 1');
addCol('users', 'title', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'created_at', 'TEXT');
addCol('projects', 'description', "TEXT NOT NULL DEFAULT ''");
addCol('projects', 'lead_id', 'TEXT');
addCol('sessions', 'user_agent', "TEXT NOT NULL DEFAULT ''");
addCol('sessions', 'last_seen_at', 'TEXT');
addCol('sessions', 'remember', 'INTEGER NOT NULL DEFAULT 1');
addCol('projects', 'color', "TEXT NOT NULL DEFAULT '#FFAB00'");
addCol('projects', 'category', "TEXT NOT NULL DEFAULT ''");
addCol('projects', 'created_at', 'TEXT');
addCol('issues', 'fix_version', 'TEXT');
addCol('sprints', 'committed_points', 'REAL');
addCol('sprints', 'committed_count', 'INTEGER');
addCol('sprints', 'completed_points', 'REAL');
addCol('sprints', 'completed_count', 'INTEGER');
addCol('forms', 'project_key', "TEXT NOT NULL DEFAULT 'KAN'");
db.exec('CREATE INDEX IF NOT EXISTS idx_issues_fixversion ON issues(project_key, fix_version)');

// ---------- phase 5: permissions, audit log, components, recycle bin, teams, board config ----------
db.exec(`
CREATE TABLE IF NOT EXISTS project_members (
  project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','member','viewer')),
  added_by TEXT,
  added_at TEXT NOT NULL,
  PRIMARY KEY (project_key, user_id)
);
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT,
  action TEXT NOT NULL,
  project_key TEXT,
  target TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_log(project_key, created_at);
CREATE TABLE IF NOT EXISTS components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  lead_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  default_assignee TEXT NOT NULL DEFAULT 'unassigned',
  created_at TEXT NOT NULL,
  UNIQUE (project_key, name)
);
CREATE TABLE IF NOT EXISTS trash (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  type TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  files TEXT NOT NULL DEFAULT '[]',
  deleted_by TEXT,
  deleted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trash_project ON trash(project_key, deleted_at);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#0C66E4',
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_members (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);
`);
addCol('projects', 'access', "TEXT NOT NULL DEFAULT 'open'");       // open | limited | private
addCol('projects', 'permissions', 'TEXT');                           // JSON overrides of the default scheme
addCol('projects', 'board_config', "TEXT NOT NULL DEFAULT '{}'");    // { wip: {status: n}, swimlanes }
addCol('issues', 'components', "TEXT NOT NULL DEFAULT '[]'");
addCol('issues', 'team_id', 'INTEGER');

// ---------- phase 6: sign-up, social login (OAuth) and subscription billing ----------
db.exec(`
CREATE TABLE IF NOT EXISTS email_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  signup_token TEXT UNIQUE,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS user_identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  PRIMARY KEY (provider, subject)
);
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'login',
  popup INTEGER NOT NULL DEFAULT 0,
  remember INTEGER NOT NULL DEFAULT 1,
  nonce TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subscription (
  id INTEGER PRIMARY KEY CHECK (id = 1),
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
CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  last4 TEXT NOT NULL,
  exp_month INTEGER NOT NULL,
  exp_year INTEGER NOT NULL,
  holder TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  plan TEXT NOT NULL,
  cycle TEXT NOT NULL,
  seats INTEGER NOT NULL,
  lines TEXT NOT NULL DEFAULT '[]',
  subtotal_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  card TEXT
);
`);
addCol('users', 'email_verified', 'INTEGER NOT NULL DEFAULT 1');
addCol('users', 'signup_source', "TEXT NOT NULL DEFAULT 'invite'"); // invite | signup | google | microsoft | apple | slack | seed

// ---------- phase 7: time tracking, votes, automation, webhooks, preferences ----------
db.exec(`
CREATE TABLE IF NOT EXISTS worklogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  started_at TEXT NOT NULL,
  time_spent INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_worklogs_issue ON worklogs(issue_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_started ON worklogs(started_at);
CREATE TABLE IF NOT EXISTS votes (
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (issue_id, user_id)
);
CREATE TABLE IF NOT EXISTS automation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  trigger TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT '',
  actions TEXT NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  issue_key TEXT,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  actions TEXT NOT NULL DEFAULT '[]',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auto_runs_rule ON automation_runs(rule_id, created_at);
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT '',
  events TEXT NOT NULL DEFAULT '[]',
  jql TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  uuid TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  status_code INTEGER,
  ok INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  response TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wh_deliv ON webhook_deliveries(webhook_id, id);
`);
addCol('issues', 'original_estimate', 'INTEGER');
addCol('issues', 'remaining_estimate', 'INTEGER');
addCol('issues', 'time_spent', 'INTEGER NOT NULL DEFAULT 0');
addCol('users', 'prefs', "TEXT NOT NULL DEFAULT '{}'");
addCol('users', 'avatar', 'TEXT');
addCol('users', 'bot', 'INTEGER NOT NULL DEFAULT 0');
const BOT_ID = 'automation';
function ensureBot() {
  db.prepare(`INSERT OR IGNORE INTO users (id,name,email,color,role,active,title,created_at,bot,signup_source)
    VALUES (?, 'Automation for Masar', 'automation@masar.invalid', '#1D7AFC', 'member', 0, 'Automation', ?, 1, 'seed')`).run(BOT_ID, new Date().toISOString());
}
ensureBot();

// Sprints used to be free text on issues: make sure every referenced sprint has a row.
{
  const known = new Set(db.prepare('SELECT name FROM sprints').all().map((r) => r.name));
  const used = db.prepare('SELECT DISTINCT sprint FROM issues WHERE sprint IS NOT NULL').all().map((r) => r.sprint);
  const ins = db.prepare("INSERT INTO sprints (name,state,position,created_at) VALUES (?,?,?,?)");
  if (used.some((n) => !known.has(n))) used.filter((n) => !known.has(n)).sort().forEach((n, i) => ins.run(n, 'future', i, new Date().toISOString()));
}

module.exports = db;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
module.exports.DB_PATH = DB_PATH;
module.exports.BOT_ID = BOT_ID;
module.exports.ensureBot = ensureBot;
