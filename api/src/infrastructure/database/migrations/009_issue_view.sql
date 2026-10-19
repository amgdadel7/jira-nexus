-- 009 · issue_view: work items with every lookup resolved to its display value.
-- Used by the list/board/search queries and as the target of compiled JQL.
-- Columns that are not referenced by a query are pruned by the planner, so the
-- correlated sub-queries only run when they are actually needed.

CREATE VIEW issue_view AS
SELECT
  i.id, i.key, i.num, i.project_key, i.summary, i.description,
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

COMMENT ON VIEW issue_view IS 'Work items joined with type, status, priority, resolution, parent, sprint, version, team, labels, components and counters.';
