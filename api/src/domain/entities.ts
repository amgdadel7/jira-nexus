export type Role =
  | 'super_admin'
  | 'org_admin'
  | 'project_manager'
  | 'scrum_master'
  | 'team_lead'
  | 'developer'
  | 'qa'
  | 'viewer'

export type IssueType = 'epic' | 'story' | 'task' | 'bug' | 'subtask'
export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'testing' | 'done'
export type Priority = 'lowest' | 'low' | 'medium' | 'high' | 'critical'

export interface User {
  id: string
  organizationId: string
  email: string
  name: string
  role: Role
  title: string
  department: string
  skills: string[]
  capacity: number
  workload: number
  presence: 'active' | 'away' | 'offline'
  color: string
  joinedAt: string
  emailVerified: boolean
  googleSub?: string
  microsoftSub?: string
}

export interface Project {
  id: string
  organizationId: string
  name: string
  key: string
  description: string
  status: 'active' | 'on_hold' | 'archived'
  startDate: string
  endDate: string
  progress: number
  leadId: string
  memberIds: string[]
  category: string
  color: string
}

export interface Sprint {
  id: string
  projectId: string
  name: string
  goal: string
  startDate: string
  endDate: string
  status: 'planned' | 'active' | 'completed'
  committedPoints: number
  completedPoints: number
}

export interface Issue {
  id: string
  key: string
  projectId: string
  sprintId?: string
  type: IssueType
  title: string
  description: string
  status: IssueStatus
  priority: Priority
  assigneeId?: string
  reporterId: string
  labels: string[]
  storyPoints?: number
  dueDate?: string
  createdAt: string
  updatedAt: string
  rank: number
}

export interface Comment {
  id: string
  issueId: string
  authorId: string
  body: string
  createdAt: string
}

export interface ActivityItem {
  id: string
  userId: string
  action: string
  issueKey?: string
  projectId?: string
  timestamp: string
}

export interface NotificationItem {
  id: string
  userId: string
  title: string
  body: string
  read: boolean
  createdAt: string
  type: string
}

export interface MailMessage {
  id: string
  to: string
  subject: string
  text: string
  html: string
  createdAt: string
}
