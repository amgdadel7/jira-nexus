import type {
  ActivityItem,
  Comment,
  Issue,
  MailMessage,
  NotificationItem,
  Project,
  Sprint,
  User,
} from './entities.ts'

export interface UserRepo {
  getById(id: string): User | undefined
  getByEmail(email: string): User | undefined
  getByGoogleSub(sub: string): User | undefined
  getByMicrosoftSub(sub: string): User | undefined
  list(): User[]
  save(user: User, passwordHash?: string): void
  passwordHash(id: string): string | undefined
}

export interface WorkspaceRepo {
  listProjects(): Project[]
  getProject(id: string): Project | undefined
  saveProject(p: Project): void
  listSprints(): Sprint[]
  saveSprint(s: Sprint): void
  listIssues(): Issue[]
  getIssue(id: string): Issue | undefined
  saveIssue(i: Issue): void
  deleteIssue(id: string): void
  listComments(issueId?: string): Comment[]
  addComment(c: Comment): void
  listActivities(): ActivityItem[]
  addActivity(a: ActivityItem): void
  listNotifications(userId: string): NotificationItem[]
  markNotificationRead(id: string, userId: string): void
}

export interface AuthRepo {
  saveOtp(email: string, codeHash: string, purpose: string, expiresAt: string): void
  consumeOtp(email: string, purpose: string): { codeHash: string; expiresAt: string } | undefined
  saveInvite(tokenHash: string, email: string, role: string, inviterId: string, expiresAt: string): void
  getInvite(tokenHash: string): { email: string; role: string; expiresAt: string } | undefined
  consumeInvite(tokenHash: string): void
}

export interface MailPort {
  send(to: string, subject: string, text: string, html: string): MailMessage
  list(to?: string): MailMessage[]
}

export interface TokenPort {
  sign(user: User): { accessToken: string; expiresIn: number }
  verify(token: string): { userId: string; orgId: string } | null
}
