import type { Issue, IssueStatus, Priority, Project, Sprint } from '../domain/entities.ts'
import type { UserRepo, WorkspaceRepo } from '../domain/ports.ts'

export class WorkspaceService {
  constructor(
    private workspace: WorkspaceRepo,
    private users: UserRepo,
  ) {}

  createIssue(input: {
    projectId: string
    title: string
    type?: string
    priority?: string
    description?: string
    assigneeId?: string
    storyPoints?: number
    status?: string
    reporterId: string
  }): Issue {
    const project = this.workspace.getProject(input.projectId)
    if (!project) throw new Error('Project not found')
    const existing = this.workspace.listIssues().filter((i) => i.projectId === project.id)
    const nextNum =
      existing.reduce((max, i) => {
        const n = Number(String(i.key).split('-').pop())
        return Number.isFinite(n) && n > max ? n : max
      }, 0) + 1
    const issue: Issue = {
      id: crypto.randomUUID(),
      key: `${project.key}-${nextNum}`,
      projectId: project.id,
      type: (input.type as Issue['type']) ?? 'story',
      title: input.title,
      description: input.description ?? '',
      status: (input.status as IssueStatus) ?? 'todo',
      priority: (input.priority as Priority) ?? 'medium',
      assigneeId: input.assigneeId,
      reporterId: input.reporterId,
      labels: ['new'],
      storyPoints: input.storyPoints,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rank: existing.length,
    }
    this.workspace.saveIssue(issue)
    this.workspace.addActivity({
      id: crypto.randomUUID(),
      userId: input.reporterId,
      action: `created ${issue.key}`,
      issueKey: issue.key,
      projectId: issue.projectId,
      timestamp: new Date().toISOString(),
    })
    return issue
  }

  updateIssue(id: string, patch: Partial<Issue>, actorId: string): Issue {
    const issue = this.workspace.getIssue(id)
    if (!issue) throw new Error('Not found')
    const next: Issue = {
      ...issue,
      ...patch,
      id: issue.id,
      key: issue.key,
      updatedAt: new Date().toISOString(),
    }
    this.workspace.saveIssue(next)
    this.workspace.addActivity({
      id: crypto.randomUUID(),
      userId: actorId,
      action: `updated ${issue.key}`,
      issueKey: issue.key,
      projectId: issue.projectId,
      timestamp: new Date().toISOString(),
    })
    return next
  }

  createProject(input: {
    name: string
    key: string
    description?: string
    category?: string
    leadId: string
    organizationId: string
  }): Project {
    const key = input.key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (key.length < 2) throw new Error('Project key must be 2–6 letters')
    if (this.workspace.listProjects().some((p) => p.key === key)) throw new Error('Key already in use')
    const project: Project = {
      id: `prj_${key.toLowerCase()}_${crypto.randomUUID().slice(0, 6)}`,
      organizationId: input.organizationId,
      name: input.name.trim(),
      key,
      description: input.description ?? '',
      status: 'active',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 90 * 86400000).toISOString(),
      progress: 0,
      leadId: input.leadId,
      memberIds: [input.leadId],
      category: input.category ?? 'Delivery',
      color: '#0E8F86',
    }
    this.workspace.saveProject(project)
    return project
  }

  updateProject(id: string, patch: Partial<Project>): Project {
    const project = this.workspace.getProject(id)
    if (!project) throw new Error('Not found')
    const next = { ...project, ...patch, id: project.id, key: project.key }
    this.workspace.saveProject(next)
    return next
  }

  createSprint(input: {
    projectId: string
    name: string
    goal?: string
    startDate: string
    endDate: string
  }): Sprint {
    const sprint: Sprint = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      name: input.name,
      goal: input.goal ?? '',
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'planned',
      committedPoints: 0,
      completedPoints: 0,
    }
    this.workspace.saveSprint(sprint)
    return sprint
  }

  startSprint(id: string): Sprint {
    const s = this.workspace.listSprints().find((x) => x.id === id)
    if (!s) throw new Error('Not found')
    const next = { ...s, status: 'active' as const }
    this.workspace.saveSprint(next)
    return next
  }

  completeSprint(id: string): Sprint {
    const s = this.workspace.listSprints().find((x) => x.id === id)
    if (!s) throw new Error('Not found')
    const next = { ...s, status: 'completed' as const, completedPoints: s.committedPoints }
    this.workspace.saveSprint(next)
    this.workspace.listIssues().forEach((issue) => {
      if (issue.sprintId === s.id && issue.status !== 'done') {
        this.workspace.saveIssue({
          ...issue,
          sprintId: undefined,
          status: 'backlog',
          updatedAt: new Date().toISOString(),
        })
      }
    })
    return next
  }

  velocity() {
    return this.workspace.listSprints().map((s) => ({
      sprint: s.name.replace(/Sprint /g, 'S'),
      committed: s.committedPoints,
      completed: s.completedPoints,
    }))
  }

  cycle() {
    const done = this.workspace.listIssues().filter((i) => i.status === 'done')
    const buckets = new Map<string, number[]>()
    for (const issue of done) {
      const created = new Date(issue.createdAt).getTime()
      const updated = new Date(issue.updatedAt).getTime()
      const days = Math.max(0.4, (updated - created) / 86400000)
      const week = isoWeek(issue.updatedAt)
      const list = buckets.get(week) ?? []
      list.push(days)
      buckets.set(week, list)
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([week, days]) => ({
        week,
        days: Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10,
      }))
  }

  search(q: string) {
    const query = q.trim().toLowerCase()
    if (!query) return { issues: [], users: [], projects: [] }
    const issues = this.workspace
      .listIssues()
      .filter((i) => i.title.toLowerCase().includes(query) || i.key.toLowerCase().includes(query))
      .slice(0, 12)
    const users = this.users
      .list()
      .filter((u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
      .slice(0, 8)
    const projects = this.workspace
      .listProjects()
      .filter((p) => p.name.toLowerCase().includes(query) || p.key.toLowerCase().includes(query))
      .slice(0, 8)
    return { issues, users, projects }
  }
}

function isoWeek(iso: string) {
  const d = new Date(iso)
  const oneJan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getUTCDay() + 1) / 7)
  return `W${String(week).padStart(2, '0')}`
}
