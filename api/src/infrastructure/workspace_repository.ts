import type { Comment, NotificationItem, Project } from '../domain/entities.ts'
import type { WorkspaceRepo } from '../domain/ports.ts'
import { db } from './sqlite_database.ts'
import {
  ACTIVITY_COLUMNS,
  COMMENT_COLUMNS,
  ISSUE_COLUMNS,
  NOTIFICATION_COLUMNS,
  PROJECT_COLUMNS,
  SPRINT_COLUMNS,
  mapActivityRow,
  mapCommentRow,
  mapIssueRow,
  mapNotificationRow,
  mapProjectRow,
  mapSprintRow,
} from './sqlite_row_mappers.ts'

export function insertProject(project: Project) {
  db.prepare(
    `INSERT OR REPLACE INTO projects (id, organization_id, name, key, description, status, start_date, end_date, progress, lead_id, member_ids, category, color)
     VALUES (@id,@organization_id,@name,@key,@description,@status,@start_date,@end_date,@progress,@lead_id,@member_ids,@category,@color)`,
  ).run({
    id: project.id,
    organization_id: project.organizationId,
    name: project.name,
    key: project.key,
    description: project.description,
    status: project.status,
    start_date: project.startDate,
    end_date: project.endDate,
    progress: project.progress,
    lead_id: project.leadId,
    member_ids: JSON.stringify(project.memberIds),
    category: project.category,
    color: project.color,
  })
}

export function insertNotification(notification: NotificationItem) {
  db.prepare(
    `INSERT OR REPLACE INTO notifications (id, user_id, title, body, read, created_at, type) VALUES (?,?,?,?,?,?,?)`,
  ).run(
    notification.id,
    notification.userId,
    notification.title,
    notification.body,
    notification.read ? 1 : 0,
    notification.createdAt,
    notification.type,
  )
}

export const workspace: WorkspaceRepo = {
  listProjects() {
    return (db.prepare(`SELECT ${PROJECT_COLUMNS} FROM projects`).all() as Record<string, unknown>[]).map(mapProjectRow)
  },
  getProject(id) {
    const row = db.prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`).get(id) as Record<string, unknown> | undefined
    return row ? mapProjectRow(row) : undefined
  },
  saveProject(project) {
    insertProject(project)
  },
  listSprints() {
    return (db.prepare(`SELECT ${SPRINT_COLUMNS} FROM sprints`).all() as Record<string, unknown>[]).map(mapSprintRow)
  },
  saveSprint(sprint) {
    db.prepare(
      `INSERT INTO sprints (id, project_id, name, goal, start_date, end_date, status, committed_points, completed_points)
       VALUES (@id,@project_id,@name,@goal,@start_date,@end_date,@status,@committed_points,@completed_points)
       ON CONFLICT(id) DO UPDATE SET status=excluded.status, completed_points=excluded.completed_points, name=excluded.name, goal=excluded.goal`,
    ).run({
      id: sprint.id,
      project_id: sprint.projectId,
      name: sprint.name,
      goal: sprint.goal,
      start_date: sprint.startDate,
      end_date: sprint.endDate,
      status: sprint.status,
      committed_points: sprint.committedPoints,
      completed_points: sprint.completedPoints,
    })
  },
  listIssues() {
    return (db.prepare(`SELECT ${ISSUE_COLUMNS} FROM issues ORDER BY rank`).all() as Record<string, unknown>[]).map(mapIssueRow)
  },
  getIssue(id) {
    const row = db.prepare(`SELECT ${ISSUE_COLUMNS} FROM issues WHERE id = ?`).get(id) as Record<string, unknown> | undefined
    return row ? mapIssueRow(row) : undefined
  },
  saveIssue(issue) {
    db.prepare(
      `INSERT INTO issues (id, key, project_id, sprint_id, type, title, description, status, priority, assignee_id, reporter_id, labels, story_points, due_date, created_at, updated_at, rank)
       VALUES (@id,@key,@project_id,@sprint_id,@type,@title,@description,@status,@priority,@assignee_id,@reporter_id,@labels,@story_points,@due_date,@created_at,@updated_at,@rank)
       ON CONFLICT(id) DO UPDATE SET
         title=excluded.title, description=excluded.description, status=excluded.status, priority=excluded.priority,
         assignee_id=excluded.assignee_id, labels=excluded.labels, story_points=excluded.story_points,
         sprint_id=excluded.sprint_id, rank=excluded.rank, updated_at=excluded.updated_at, type=excluded.type`,
    ).run({
      id: issue.id,
      key: issue.key,
      project_id: issue.projectId,
      sprint_id: issue.sprintId ?? null,
      type: issue.type,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      assignee_id: issue.assigneeId ?? null,
      reporter_id: issue.reporterId,
      labels: JSON.stringify(issue.labels),
      story_points: issue.storyPoints ?? null,
      due_date: issue.dueDate ?? null,
      created_at: issue.createdAt,
      updated_at: issue.updatedAt,
      rank: issue.rank,
    })
  },
  deleteIssue(id) {
    db.prepare('DELETE FROM comments WHERE issue_id = ?').run(id)
    db.prepare('DELETE FROM issues WHERE id = ?').run(id)
  },
  listComments(issueId) {
    const rows = (
      issueId
        ? db.prepare(`SELECT ${COMMENT_COLUMNS} FROM comments WHERE issue_id = ? ORDER BY created_at DESC`).all(issueId)
        : db.prepare(`SELECT ${COMMENT_COLUMNS} FROM comments ORDER BY created_at DESC`).all()
    ) as Record<string, unknown>[]
    return rows.map(mapCommentRow)
  },
  addComment(comment: Comment) {
    db.prepare('INSERT INTO comments (id, issue_id, author_id, body, created_at) VALUES (?,?,?,?,?)').run(
      comment.id,
      comment.issueId,
      comment.authorId,
      comment.body,
      comment.createdAt,
    )
  },
  listActivities() {
    return (db.prepare(`SELECT ${ACTIVITY_COLUMNS} FROM activities ORDER BY timestamp DESC`).all() as Record<string, unknown>[]).map(
      mapActivityRow,
    )
  },
  addActivity(activity) {
    db.prepare('INSERT INTO activities (id, user_id, action, issue_key, project_id, timestamp) VALUES (?,?,?,?,?,?)').run(
      activity.id,
      activity.userId,
      activity.action,
      activity.issueKey ?? null,
      activity.projectId ?? null,
      activity.timestamp,
    )
  },
  listNotifications(userId) {
    return (
      db.prepare(`SELECT ${NOTIFICATION_COLUMNS} FROM notifications WHERE user_id = ? ORDER BY created_at DESC`).all(userId) as Record<
        string,
        unknown
      >[]
    ).map(mapNotificationRow)
  },
  markNotificationRead(id, userId) {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(id, userId)
  },
}
