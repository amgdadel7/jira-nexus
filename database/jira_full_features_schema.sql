-- ============================================================
-- Nexus PM (Jira Parity Upgrade) — Full Database Schema Extension
-- Project: Supabase PostgreSQL (fxyotyjqzddlcmqxemkz)
-- Supports: Subtasks, Issue Links, Time Tracking, Custom Fields, 
--           Project Views, Forms, Automations, DORA Git Metrics, Docs
-- ============================================================

-- 1. Extend Issues Table for Timeline, Estimation & Resolution
alter table issues add column if not exists start_date timestamptz;
alter table issues add column if not exists estimated_seconds int default 0;
alter table issues add column if not exists remaining_seconds int default 0;
alter table issues add column if not exists resolution text default 'unresolved' 
  check (resolution in ('unresolved', 'done', 'wont_do', 'duplicate', 'cannot_reproduce'));
alter table issues add column if not exists resolved_at timestamptz;

-- 2. Issue Links & Dependency Relationships (Blocks, Relates to, Duplicates)
create table if not exists issue_links (
  id              uuid primary key default gen_random_uuid(),
  source_issue_id uuid not null references issues(id) on delete cascade,
  target_issue_id uuid not null references issues(id) on delete cascade,
  link_type       text not null check (link_type in ('blocks', 'is_blocked_by', 'relates_to', 'duplicates', 'clones')),
  created_at      timestamptz not null default now(),
  check (source_issue_id != target_issue_id),
  unique (source_issue_id, target_issue_id, link_type)
);

create index if not exists ix_issue_links_source on issue_links(source_issue_id);
create index if not exists ix_issue_links_target on issue_links(target_issue_id);

-- 3. Issue Watchers (Watch 👁 1 Counter & Notification Dispatch)
create table if not exists issue_watchers (
  issue_id   uuid not null references issues(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (issue_id, user_id)
);

create index if not exists ix_issue_watchers_user on issue_watchers(user_id);

-- 4. Worklogs & Time Tracking
create table if not exists worklogs (
  id                 uuid primary key default gen_random_uuid(),
  issue_id           uuid not null references issues(id) on delete cascade,
  author_id          uuid not null references users(id) on delete cascade,
  time_spent_seconds int not null check (time_spent_seconds > 0),
  started_at         timestamptz not null default now(),
  description        text,
  created_at         timestamptz not null default now()
);

create index if not exists ix_worklogs_issue on worklogs(issue_id, started_at desc);
create index if not exists ix_worklogs_author on worklogs(author_id);

-- 5. Custom Fields Definition & Values (Supports 49 Columns & Dynamic Metadata)
create table if not exists custom_fields (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id      uuid references projects(id) on delete cascade,
  name            text not null,
  field_key       text not null,
  field_type      text not null check (field_type in ('text', 'number', 'date', 'select', 'multiselect', 'user', 'url', 'checkbox')),
  options         jsonb default '[]'::jsonb,
  is_required     boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (organization_id, field_key)
);

create index if not exists ix_custom_fields_org on custom_fields(organization_id);
create index if not exists ix_custom_fields_project on custom_fields(project_id);

create table if not exists issue_custom_field_values (
  id              uuid primary key default gen_random_uuid(),
  issue_id        uuid not null references issues(id) on delete cascade,
  field_id        uuid not null references custom_fields(id) on delete cascade,
  value_text      text,
  value_number    numeric,
  value_date      timestamptz,
  value_json      jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (issue_id, field_id)
);

create index if not exists ix_issue_cfv_issue on issue_custom_field_values(issue_id);
create index if not exists ix_issue_cfv_field on issue_custom_field_values(field_id);

-- 6. Project Saved Views (List, Board, Timeline, Calendar, Forms)
create table if not exists project_views (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid references users(id) on delete cascade,
  name        text not null,
  view_type   text not null check (view_type in ('list', 'board', 'calendar', 'timeline', 'summary', 'forms', 'development', 'docs')),
  is_default  boolean not null default false,
  position    int not null default 0,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ix_project_views_proj on project_views(project_id, position);

-- 7. User Navigation & Sidebar Preferences (Customize Sidebar)
create table if not exists user_sidebar_preferences (
  user_id         uuid not null references users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  nav_items       jsonb not null default '{"for_you":true,"recent":true,"starred":true,"apps":true,"plans":true,"spaces":true,"filters":true,"dashboards":true}'::jsonb,
  app_shortcuts   jsonb not null default '{"confluence":true,"loom":true,"assets":true,"teams":true,"goals":true,"projects":true}'::jsonb,
  starred_spaces  jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now(),
  primary key (user_id, organization_id)
);

-- 8. Intake Forms & Submissions (Collect requests)
create table if not exists intake_forms (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  created_by      uuid not null references users(id) on delete cascade,
  title           text not null,
  description     text,
  slug            citext not null unique,
  default_issue_type text not null default 'task',
  is_public       boolean not null default true,
  is_active       boolean not null default true,
  fields_schema   jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ix_intake_forms_project on intake_forms(project_id);

create table if not exists form_submissions (
  id               uuid primary key default gen_random_uuid(),
  form_id          uuid not null references intake_forms(id) on delete cascade,
  issue_id         uuid references issues(id) on delete set null,
  submitter_email  citext,
  submitter_name   text,
  answers_payload  jsonb not null,
  created_at       timestamptz not null default now()
);

create index if not exists ix_form_submissions_form on form_submissions(form_id, created_at desc);

-- 9. Automation Rules & Execution Auditing (⚡ Automation Engine)
create table if not exists automation_rules (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  created_by      uuid not null references users(id),
  name            text not null,
  description     text,
  is_active       boolean not null default true,
  trigger_type    text not null check (trigger_type in ('issue_created', 'issue_updated', 'status_changed', 'assignee_changed', 'due_date_approaching', 'manual')),
  condition_json  jsonb not null default '{}'::jsonb,
  action_json     jsonb not null default '{}'::jsonb,
  execution_count int not null default 0,
  last_executed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ix_automation_rules_proj on automation_rules(project_id, is_active);

create table if not exists automation_executions (
  id              uuid primary key default gen_random_uuid(),
  rule_id         uuid not null references automation_rules(id) on delete cascade,
  issue_id        uuid references issues(id) on delete cascade,
  status          text not null check (status in ('success', 'failed', 'skipped')),
  duration_ms     int not null default 0,
  error_message   text,
  execution_log   jsonb,
  executed_at     timestamptz not null default now()
);

create index if not exists ix_automation_exec_rule on automation_executions(rule_id, executed_at desc);
create index if not exists ix_automation_exec_issue on automation_executions(issue_id);

-- 10. Development & DORA Metrics (GitHub, GitLab, Bitbucket)
create table if not exists git_repositories (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  provider        text not null check (provider in ('github', 'gitlab', 'bitbucket')),
  repo_name       text not null,
  repo_url        text not null,
  is_connected    boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists ix_git_repos_project on git_repositories(project_id);

create table if not exists git_pull_requests (
  id                 uuid primary key default gen_random_uuid(),
  repository_id      uuid not null references git_repositories(id) on delete cascade,
  issue_id           uuid references issues(id) on delete set null,
  pr_number          int not null,
  title              text not null,
  url                text not null,
  author             text not null,
  status             text not null check (status in ('open', 'merged', 'declined')),
  cycle_time_seconds int,
  created_at         timestamptz not null default now(),
  merged_at          timestamptz,
  unique (repository_id, pr_number)
);

create index if not exists ix_git_prs_issue on git_pull_requests(issue_id);

create table if not exists git_deployments (
  id              uuid primary key default gen_random_uuid(),
  repository_id   uuid not null references git_repositories(id) on delete cascade,
  environment     text not null check (environment in ('development', 'staging', 'production')),
  version         text not null,
  status          text not null check (status in ('successful', 'failed', 'in_progress')),
  deployed_at     timestamptz not null default now()
);

create index if not exists ix_git_deploy_repo on git_deployments(repository_id, deployed_at desc);

-- 11. Documents & Confluence Wiki Integration
create table if not exists project_documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  parent_id       uuid references project_documents(id) on delete cascade,
  author_id       uuid not null references users(id),
  title           text not null,
  content         text not null default '',
  doc_type        text not null default 'page' check (doc_type in ('page', 'meeting_notes', 'product_spec', 'retro')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ix_project_docs_proj on project_documents(project_id);

-- 12. Enable Row-Level Security (RLS) on all new tables
alter table issue_links enable row level security;
alter table issue_watchers enable row level security;
alter table worklogs enable row level security;
alter table custom_fields enable row level security;
alter table issue_custom_field_values enable row level security;
alter table project_views enable row level security;
alter table user_sidebar_preferences enable row level security;
alter table intake_forms enable row level security;
alter table form_submissions enable row level security;
alter table automation_rules enable row level security;
alter table automation_executions enable row level security;
alter table git_repositories enable row level security;
alter table git_pull_requests enable row level security;
alter table git_deployments enable row level security;
alter table project_documents enable row level security;
