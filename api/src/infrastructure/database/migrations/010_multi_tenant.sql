-- 010 · Multi-tenant foundations: Organizations, Workspaces, and Resource Ownership Isolation.

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  slug         text NOT NULL UNIQUE,
  plan         text NOT NULL DEFAULT 'free',
  owner_id     text REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE organizations IS 'Customer tenants. All projects, items and settings are partitioned by organization.';

-- 2. Organization members
CREATE TABLE IF NOT EXISTS organization_members (
  org_id       text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'guest')),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS org_members_user_idx ON organization_members (user_id);
COMMENT ON TABLE organization_members IS 'User memberships within each organization tenant.';

-- 3. Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id           text PRIMARY KEY,
  org_id       text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name         text NOT NULL,
  slug         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);
CREATE INDEX IF NOT EXISTS workspaces_org_idx ON workspaces (org_id);
COMMENT ON TABLE workspaces IS 'Workspaces subdividing an organization.';

-- 4. Workspace members
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id text NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'guest')),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS ws_members_user_idx ON workspace_members (user_id);

-- 5. Seed default organization and workspace if absent
INSERT INTO organizations (id, name, slug, plan, owner_id)
VALUES ('default-org', 'Default Organization', 'default', 'enterprise', (SELECT id FROM users ORDER BY created_at ASC LIMIT 1))
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_members (org_id, user_id, role)
SELECT 'default-org', id, CASE WHEN role = 'admin' THEN 'owner' ELSE 'member' END
FROM users
ON CONFLICT (org_id, user_id) DO NOTHING;

INSERT INTO workspaces (id, org_id, name, slug)
VALUES ('default-ws', 'default-org', 'Main Workspace', 'main')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT 'default-ws', id, CASE WHEN role = 'admin' THEN 'admin' ELSE 'member' END
FROM users
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 6. Add org_id to core domain entities
ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default-org' REFERENCES organizations (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS projects_org_idx ON projects (org_id);

ALTER TABLE filters ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default-org' REFERENCES organizations (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS filters_org_idx ON filters (org_id);

ALTER TABLE goals ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default-org' REFERENCES organizations (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS goals_org_idx ON goals (org_id);

ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default-org' REFERENCES organizations (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS dashboards_org_idx ON dashboards (org_id);

ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default-org' REFERENCES organizations (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS custom_fields_org_idx ON custom_fields (org_id);

ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default-org' REFERENCES organizations (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS automation_rules_org_idx ON automation_rules (org_id);

ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default-org' REFERENCES organizations (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS webhooks_org_idx ON webhooks (org_id);

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default-org' REFERENCES organizations (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS audit_log_org_idx ON audit_log (org_id);

-- 7. Update issue_view to include org_id from joined project
DROP VIEW IF EXISTS issue_view CASCADE;

CREATE VIEW issue_view AS
SELECT
  i.id, i.key, i.num, i.project_key, p.org_id, i.summary, i.description,
  i.issue_type_id, it.name AS type, it.icon AS type_icon, it.hierarchy_level,
  i.status_id, st.name AS status, st.category AS status_category,
  COALESCE(ws.position, 99) AS status_order,
  i.priority_id, pr.name AS priority, pr.position AS priority_order,
  i.resolution_id, rs.name AS resolution,
  i.assignee_id, i.reporter_id,
  i.parent_id, par.key AS parent_key, par.summary AS parent_summary, pit.name AS parent_type,
  i.sprint_id, sp.name AS sprint, sp.state AS sprint_state,
  i.fix_version_id, v.name AS fix_version, v.status AS fix_version_status,
  i.team_id, tm.name AS team_name,
  i.due_date, i.start_date, i.story_points, i.rank,
  i.original_estimate, i.remaining_estimate, i.time_spent,
  i.created_at, i.updated_at, i.resolved_at,
  COALESCE((SELECT array_agg(l.name ORDER BY il.position, l.name)
              FROM issue_labels il JOIN labels l ON l.id = il.label_id
             WHERE il.issue_id = i.id), '{}'::text[]) AS labels,
  COALESCE((SELECT array_agg(c.name ORDER BY ic.position, c.name)
              FROM issue_components ic JOIN components c ON c.id = ic.component_id
             WHERE ic.issue_id = i.id), '{}'::text[]) AS components,
  (SELECT count(*) FROM votes vo WHERE vo.issue_id = i.id)::int AS vote_count,
  (SELECT count(*) FROM comments co WHERE co.issue_id = i.id)::int AS comment_count,
  (SELECT count(*) FROM attachments a WHERE a.issue_id = i.id)::int AS attachment_count,
  (SELECT count(*) FROM issue_links lk WHERE lk.source_id = i.id OR lk.target_id = i.id)::int AS link_count,
  (SELECT count(*) FROM issues ch WHERE ch.parent_id = i.id)::int AS child_count,
  (SELECT count(*) FROM issues ch JOIN statuses cs ON cs.id = ch.status_id
    WHERE ch.parent_id = i.id AND cs.category = 'done')::int AS child_done_count
FROM issues i
JOIN issue_types it  ON it.id = i.issue_type_id
JOIN statuses st     ON st.id = i.status_id
JOIN priorities pr   ON pr.id = i.priority_id
JOIN projects p      ON p.key = i.project_key
LEFT JOIN workflow_statuses ws ON ws.workflow_id = p.workflow_id AND ws.status_id = i.status_id
LEFT JOIN resolutions rs ON rs.id = i.resolution_id
LEFT JOIN issues par     ON par.id = i.parent_id
LEFT JOIN issue_types pit ON pit.id = par.issue_type_id
LEFT JOIN sprints sp     ON sp.id = i.sprint_id
LEFT JOIN versions v     ON v.id = i.fix_version_id
LEFT JOIN teams tm       ON tm.id = i.team_id;

COMMENT ON VIEW issue_view IS 'Work items joined with type, status, priority, resolution, parent, sprint, version, team, labels, components, counters and tenant org_id.';
