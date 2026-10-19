import type { ActivityItem, Comment, Issue, NotificationItem, Project, Sprint, User } from '../domain/entities.ts'

export function parseJsonStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (raw == null || raw === '') return []
  try {
    const parsed = JSON.parse(String(raw))
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as User['role'],
    title: String(row.title ?? ''),
    department: String(row.department ?? ''),
    skills: parseJsonStringArray(row.skills),
    capacity: Number(row.capacity ?? 40),
    workload: Number(row.workload ?? 0),
    presence: (row.presence as User['presence']) ?? 'offline',
    color: String(row.color ?? '#0E8F86'),
    joinedAt: String(row.joined_at ?? new Date().toISOString()),
    emailVerified: Boolean(row.email_verified),
    googleSub: row.google_sub ? String(row.google_sub) : undefined,
    microsoftSub: row.microsoft_sub ? String(row.microsoft_sub) : undefined,
  }
}

export function mapProjectRow(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    key: String(row.key),
    description: String(row.description ?? ''),
    status: row.status as Project['status'],
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    progress: Number(row.progress ?? 0),
    leadId: String(row.lead_id),
    memberIds: parseJsonStringArray(row.member_ids),
    category: String(row.category ?? ''),
    color: String(row.color ?? '#0E8F86'),
  }
}

export function mapSprintRow(row: Record<string, unknown>): Sprint {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    goal: String(row.goal ?? ''),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    status: row.status as Sprint['status'],
    committedPoints: Number(row.committed_points ?? 0),
    completedPoints: Number(row.completed_points ?? 0),
  }
}

export function mapIssueRow(row: Record<string, unknown>): Issue {
  return {
    id: String(row.id),
    key: String(row.key),
    projectId: String(row.project_id),
    sprintId: row.sprint_id ? String(row.sprint_id) : undefined,
    type: row.type as Issue['type'],
    title: String(row.title),
    description: String(row.description ?? ''),
    status: row.status as Issue['status'],
    priority: row.priority as Issue['priority'],
    assigneeId: row.assignee_id ? String(row.assignee_id) : undefined,
    reporterId: String(row.reporter_id),
    labels: parseJsonStringArray(row.labels),
    storyPoints: row.story_points == null ? undefined : Number(row.story_points),
    dueDate: row.due_date ? String(row.due_date) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    rank: Number(row.rank ?? 0),
  }
}

export function mapCommentRow(row: Record<string, unknown>): Comment {
  return {
    id: String(row.id),
    issueId: String(row.issue_id),
    authorId: String(row.author_id),
    body: String(row.body),
    createdAt: String(row.created_at),
  }
}

export function mapActivityRow(row: Record<string, unknown>): ActivityItem {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    action: String(row.action),
    issueKey: row.issue_key ? String(row.issue_key) : undefined,
    projectId: row.project_id ? String(row.project_id) : undefined,
    timestamp: String(row.timestamp),
  }
}

export function mapNotificationRow(row: Record<string, unknown>): NotificationItem {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    body: String(row.body),
    read: Boolean(row.read),
    createdAt: String(row.created_at),
    type: String(row.type),
  }
}

export const USER_COLUMNS =
  'id, organization_id, email, name, role, title, department, skills, capacity, workload, presence, color, joined_at, email_verified, google_sub, microsoft_sub'

export const PROJECT_COLUMNS =
  'id, organization_id, name, key, description, status, start_date, end_date, progress, lead_id, member_ids, category, color'

export const SPRINT_COLUMNS =
  'id, project_id, name, goal, start_date, end_date, status, committed_points, completed_points'

export const ISSUE_COLUMNS =
  'id, key, project_id, sprint_id, type, title, description, status, priority, assignee_id, reporter_id, labels, story_points, due_date, created_at, updated_at, rank'

export const COMMENT_COLUMNS = 'id, issue_id, author_id, body, created_at'
export const ACTIVITY_COLUMNS = 'id, user_id, action, issue_key, project_id, timestamp'
export const NOTIFICATION_COLUMNS = 'id, user_id, title, body, read, created_at, type'
