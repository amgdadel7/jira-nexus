'use strict';

const { formatDuration } = require('../../../domain/duration');

const { LINK_TYPES } = require('../../../domain/issue');

/** issue_view row → API work item (shape kept compatible with the original API). */
function issue(r, customValues = null) {
  if (!r) return null;
  const out = {
    id: r.id, key: r.key, project: r.project_key, type: r.type, summary: r.summary, description: r.description,
    status: r.status, statusCategory: r.status_category, priority: r.priority, resolution: r.resolution || null,
    assigneeId: r.assignee_id, reporterId: r.reporter_id,
    parent: r.parent_key ? { key: r.parent_key, summary: r.parent_summary, type: r.parent_type } : null,
    labels: r.labels || [], dueDate: r.due_date, startDate: r.start_date, storyPoints: r.story_points,
    sprint: r.sprint || null, fixVersion: r.fix_version || null, rank: r.rank, components: r.components || [], teamId: r.team_id ?? null,
    created: r.created_at, updated: r.updated_at, resolved: r.resolved_at,
    commentCount: r.comment_count, childCount: r.child_count, childDone: r.child_done_count,
    attachmentCount: r.attachment_count, linkCount: r.link_count, votes: r.vote_count ?? 0,
    originalEstimate: r.original_estimate ?? null, remainingEstimate: r.remaining_estimate ?? null, timeSpent: r.time_spent || 0,
  };
  if (customValues) out.customFields = customValues.get(r.id) || {};
  if (r.last_activity) out.lastActivity = r.last_activity;
  return out;
}

const comment = (c) => ({ id: c.id, authorId: c.author_id, body: c.body, created: c.created_at, updated: c.updated_at });
const history = (h) => ({ id: h.id, authorId: h.author_id, field: h.field, from: h.from_value, to: h.to_value, created: h.created_at });
const attachment = (a) => ({ id: a.id, filename: a.filename, mime: a.mime, size: a.size, uploaderId: a.uploader_id, created: a.created_at });
const development = (d) => ({ id: d.id, kind: d.kind, repo: d.repo, name: d.name, ref: d.ref, status: d.status, authorId: d.author_id, created: d.created_at });
const developmentWithIssue = (d) => ({ ...development(d), issue: d.key ? { key: d.key, summary: d.summary, type: d.issue_type, status: d.issue_status } : null });
const worklog = (w) => ({
  id: w.id, issueKey: w.issue_key, authorId: w.author_id, started: w.started_at, timeSpent: w.time_spent,
  timeSpentText: formatDuration(w.time_spent), comment: w.comment, created: w.created_at, updated: w.updated_at,
});
const link = (l) => ({
  id: l.id, type: l.type, direction: l.direction, key: l.key, summary: l.summary, status: l.status, statusCategory: l.status_category,
  issueType: l.issue_type, priority: l.priority, assigneeId: l.assignee_id, label: LINK_TYPES[l.type]?.[l.direction] || l.type,
});

function detail(d) {
  return {
    ...issue(d.record),
    children: d.children.map((c) => issue(c)),
    comments: d.comments.map(comment),
    history: d.history.map(history),
    watchers: d.watchers,
    watching: d.watchers.includes(d.viewerId),
    links: d.links.map(link),
    permissions: d.permissions,
    attachments: d.attachments.map(attachment),
    development: d.development.map(development),
    goals: d.goals,
    worklogs: d.worklogs.map(worklog),
    voters: d.voters,
    voted: d.voters.includes(d.viewerId),
    customFields: d.customFields,
  };
}

const search = (r) => ({ jql: r.jql, startAt: r.startAt, maxResults: r.maxResults, total: r.total, sort: r.sort, issues: r.rows.map((row) => issue(row, r.customValues)) });

module.exports = { issue, comment, history, attachment, development, developmentWithIssue, worklog, link, detail, search };
