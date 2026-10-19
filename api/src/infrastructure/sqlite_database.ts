import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const dir = path.dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.VERCEL ? '/tmp' : path.resolve(dir, '../../data')
fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(path.join(dataDir, 'nexus.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT,
  department TEXT,
  skills TEXT,
  capacity INTEGER,
  workload INTEGER,
  presence TEXT,
  color TEXT,
  joined_at TEXT,
  email_verified INTEGER DEFAULT 0,
  google_sub TEXT,
  microsoft_sub TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  description TEXT,
  status TEXT,
  start_date TEXT,
  end_date TEXT,
  progress INTEGER,
  lead_id TEXT,
  member_ids TEXT,
  category TEXT,
  color TEXT
);
CREATE TABLE IF NOT EXISTS sprints (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  goal TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT,
  committed_points INTEGER,
  completed_points INTEGER
);
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE,
  project_id TEXT NOT NULL,
  sprint_id TEXT,
  type TEXT,
  title TEXT,
  description TEXT,
  status TEXT,
  priority TEXT,
  assignee_id TEXT,
  reporter_id TEXT,
  labels TEXT,
  story_points INTEGER,
  due_date TEXT,
  created_at TEXT,
  updated_at TEXT,
  rank REAL
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT,
  issue_key TEXT,
  project_id TEXT,
  timestamp TEXT
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT,
  body TEXT,
  read INTEGER,
  created_at TEXT,
  type TEXT
);
CREATE TABLE IF NOT EXISTS otps (
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (email, purpose)
);
CREATE TABLE IF NOT EXISTS invites (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  inviter_id TEXT,
  expires_at TEXT NOT NULL,
  consumed INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS issue_links (
  id TEXT PRIMARY KEY,
  source_issue_id TEXT NOT NULL,
  target_issue_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS worklogs (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  time_spent_seconds INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS issue_watchers (
  issue_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (issue_id, user_id)
);
CREATE TABLE IF NOT EXISTS custom_fields (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  description TEXT,
  screens_count INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS user_sidebar_preferences (
  user_id TEXT PRIMARY KEY,
  preferences_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intake_forms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  title TEXT NOT NULL,
  submitter TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS git_repositories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  url TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS git_pull_requests (
  id TEXT PRIMARY KEY,
  issue_key TEXT NOT NULL,
  title TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  author TEXT NOT NULL,
  status TEXT NOT NULL,
  ci_status TEXT NOT NULL,
  reviews TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO custom_fields (id, name, field_type, description, screens_count) VALUES
('cf_story_points', 'Story Points', 'number', 'Estimation points for sprint velocity', 3),
('cf_severity', 'Severity', 'select', 'Impact level on customer operations', 2),
('cf_environment', 'Environment', 'select', 'Staging, Production, QA, or Local', 2);

INSERT OR IGNORE INTO intake_forms (id, name, description, icon, color, fields_json, created_at) VALUES
('form_bug', 'Bug Report', 'Report unexpected behavior or software defects', '🔴', '#FF5630', '[]', datetime('now')),
('form_feature', 'Feature Request', 'Propose new features and functionality', '🟢', '#36B37E', '[]', datetime('now'));

INSERT OR IGNORE INTO git_repositories (id, name, provider, url) VALUES
('repo_jira_nexus', 'nexus-org/jira-nexus-app', 'github', 'https://github.com/nexus-org/jira-nexus-app');
`)
