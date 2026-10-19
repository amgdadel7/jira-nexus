import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { WorkspaceService } from '../application/workspace.ts'
import { users, workspace } from '../infrastructure/sqlite.ts'
import { sendFailure, sendSuccess } from './http_response.ts'
import { asAuthed, requireUser } from './http_context.ts'

const work = new WorkspaceService(workspace, users)

export function createWorkRouter() {
  const router = Router()

  router.get('/projects', requireUser, (_req, res) => sendSuccess(res, workspace.listProjects()))

  router.post('/projects', requireUser, (req, res) => {
    const user = asAuthed(req).user
    const parsed = z
      .object({
        name: z.string().min(2),
        key: z.string().min(2),
        description: z.string().optional(),
        category: z.string().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    try {
      sendSuccess(
        res,
        work.createProject({
          ...parsed.data,
          leadId: user.id,
          organizationId: user.organizationId ?? 'org_acme',
        }),
      )
    } catch (e) {
      sendFailure(res, 400, 'PROJECT_CREATE_FAILED', (e as Error).message)
    }
  })

  router.patch('/projects/:id', requireUser, (req, res) => {
    try {
      sendSuccess(res, work.updateProject(String(req.params.id), req.body))
    } catch (e) {
      sendFailure(res, 404, 'PROJECT_NOT_FOUND', (e as Error).message)
    }
  })

  router.get('/sprints', requireUser, (_req, res) => sendSuccess(res, workspace.listSprints()))

  router.post('/sprints', requireUser, (req, res) => {
    const parsed = z
      .object({
        projectId: z.string(),
        name: z.string(),
        goal: z.string().optional(),
        startDate: z.string(),
        endDate: z.string(),
      })
      .safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    try {
      sendSuccess(res, work.createSprint(parsed.data))
    } catch (e) {
      sendFailure(res, 400, 'SPRINT_CREATE_FAILED', (e as Error).message)
    }
  })

  router.post('/sprints/:id/start', requireUser, (req, res) => {
    try {
      sendSuccess(res, work.startSprint(String(req.params.id)))
    } catch (e) {
      sendFailure(res, 404, 'SPRINT_NOT_FOUND', (e as Error).message)
    }
  })

  router.post('/sprints/:id/complete', requireUser, (req, res) => {
    try {
      sendSuccess(res, work.completeSprint(String(req.params.id)))
    } catch (e) {
      sendFailure(res, 404, 'SPRINT_NOT_FOUND', (e as Error).message)
    }
  })

  router.get('/issues', requireUser, (req, res) => {
    const projectId = req.query.projectId as string | undefined
    const q = String(req.query.q ?? '').toLowerCase()
    let list = workspace.listIssues()
    if (projectId) list = list.filter((i) => i.projectId === projectId)
    if (q) list = list.filter((i) => i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q))
    sendSuccess(res, list)
  })

  router.post('/issues', requireUser, (req, res) => {
    const parsed = z
      .object({
        projectId: z.string(),
        title: z.string().min(1),
        type: z.string().default('story'),
        priority: z.string().default('medium'),
        description: z.string().optional(),
        assigneeId: z.string().optional(),
        storyPoints: z.number().optional(),
        status: z.string().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    try {
      sendSuccess(res, work.createIssue({ ...parsed.data, reporterId: asAuthed(req).user.id }))
    } catch (e) {
      sendFailure(res, 400, 'ISSUE_CREATE_FAILED', (e as Error).message)
    }
  })

  router.patch('/issues/:id', requireUser, (req, res) => {
    try {
      sendSuccess(res, work.updateIssue(String(req.params.id), req.body, asAuthed(req).user.id))
    } catch (e) {
      sendFailure(res, 404, 'ISSUE_NOT_FOUND', (e as Error).message)
    }
  })

  router.delete('/issues/:id', requireUser, (req, res) => {
    workspace.deleteIssue(String(req.params.id))
    sendSuccess(res, { ok: true })
  })

  router.post('/issues/:id/comments', requireUser, (req, res) => {
    const body = z.object({ body: z.string().min(1) }).safeParse(req.body)
    if (!body.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    const comment = {
      id: crypto.randomUUID(),
      issueId: String(req.params.id),
      authorId: asAuthed(req).user.id,
      body: body.data.body,
      createdAt: new Date().toISOString(),
    }
    workspace.addComment(comment)
    sendSuccess(res, comment)
  })

  // Issue Links (Blocks / Relates to)
  router.get('/issues/:id/links', requireUser, (req, res) => {
    const issueId = String(req.params.id)
    sendSuccess(res, [
      { id: 'link_1', sourceIssueId: issueId, targetIssueId: 'target_1', linkType: 'relates_to', createdAt: new Date().toISOString() },
    ])
  })

  router.post('/issues/:id/links', requireUser, (req, res) => {
    const parsed = z.object({ targetIssueId: z.string(), linkType: z.enum(['blocks', 'is_blocked_by', 'relates_to', 'duplicates']) }).safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    sendSuccess(res, { id: crypto.randomUUID(), sourceIssueId: String(req.params.id), ...parsed.data, createdAt: new Date().toISOString() })
  })

  // Worklogs (Time Tracking)
  router.get('/issues/:id/worklogs', requireUser, (req, res) => {
    sendSuccess(res, [
      { id: 'wl_1', issueId: String(req.params.id), authorId: asAuthed(req).user.id, timeSpentSeconds: 7200, startedAt: new Date().toISOString(), description: 'Development work' },
    ])
  })

  router.post('/issues/:id/worklogs', requireUser, (req, res) => {
    const parsed = z.object({ timeSpentSeconds: z.number().positive(), description: z.string().optional() }).safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    sendSuccess(res, { id: crypto.randomUUID(), issueId: String(req.params.id), authorId: asAuthed(req).user.id, ...parsed.data, startedAt: new Date().toISOString() })
  })

  // Issue Watchers
  router.post('/issues/:id/watch', requireUser, (req, res) => {
    sendSuccess(res, { watching: true, issueId: String(req.params.id), userId: asAuthed(req).user.id })
  })

  router.delete('/issues/:id/watch', requireUser, (req, res) => {
    sendSuccess(res, { watching: false, issueId: String(req.params.id), userId: asAuthed(req).user.id })
  })

  // User Sidebar Preferences
  router.get('/preferences/sidebar', requireUser, (_req, res) => {
    sendSuccess(res, {
      navItems: { forYou: true, recent: true, starred: true, apps: true, plans: true, spaces: true, filters: true, dashboards: true },
      appShortcuts: { confluence: true, loom: true, assets: true, teams: true, goals: true, projects: true },
    })
  })

  // Work Types (Issue Types)
  router.get('/settings/work-types', requireUser, (_req, res) => {
    sendSuccess(res, [
      { id: 'wt_epic', name: 'Epic', description: 'A big goal or large body of work that can be broken down into stories, bugs, or tasks.', hierarchyLevel: 1, icon: '⚡', color: '#8777D9', isSubtask: false, schemesCount: 2 },
      { id: 'wt_story', name: 'Story', description: 'User-facing feature or functional increment.', hierarchyLevel: 0, icon: '🟢', color: '#36B37E', isSubtask: false, schemesCount: 2 },
      { id: 'wt_task', name: 'Task', description: 'Technical or operational task to be completed.', hierarchyLevel: 0, icon: '🔵', color: '#0052CC', isSubtask: false, schemesCount: 2 },
      { id: 'wt_bug', name: 'Bug', description: 'An error, defect, or unexpected behavior in the system.', hierarchyLevel: 0, icon: '🔴', color: '#FF5630', isSubtask: false, schemesCount: 2 },
      { id: 'wt_subtask', name: 'Sub-task', description: 'A small piece of work required to complete another work item.', hierarchyLevel: -1, icon: '↳', color: '#4BADE8', isSubtask: true, schemesCount: 2 },
    ])
  })

  router.post('/settings/work-types', requireUser, (req, res) => {
    const parsed = z.object({ name: z.string().min(2), description: z.string().optional(), hierarchyLevel: z.number().default(0), icon: z.string().default('🔵'), color: z.string().default('#0052CC') }).safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid payload')
    sendSuccess(res, { id: `wt_${Date.now()}`, ...parsed.data, schemesCount: 1, isSubtask: parsed.data.hierarchyLevel < 0 })
  })

  // Work Type Schemes
  router.get('/settings/work-type-schemes', requireUser, (_req, res) => {
    sendSuccess(res, [
      { id: 'wts_kan', name: 'KAN: Kanban Issue Type Scheme', description: 'Default issue type scheme for Kanban projects.', workTypes: ['Epic', 'Story', 'Task', 'Bug', 'Sub-task'], projects: ['My Team (KAN)'], isDefault: true },
      { id: 'wts_discovery', name: 'Product Discovery Scheme', description: 'Issue types tailored for problem validation and user research.', workTypes: ['Idea', 'Opportunity', 'Problem', 'Insight'], projects: ['My discovery project'], isDefault: false },
    ])
  })

  // Sub-task settings
  router.get('/settings/sub-tasks', requireUser, (_req, res) => {
    sendSuccess(res, {
      subTasksEnabled: true,
      subTaskTypes: [{ id: 'wt_subtask', name: 'Sub-task', icon: '↳', color: '#4BADE8' }],
      blockParentProgressionIfIncomplete: false,
    })
  })

  // Custom Fields
  router.get('/settings/custom-fields', requireUser, (_req, res) => {
    sendSuccess(res, [
      { id: 'cf_story_points', name: 'Story Points', type: 'number', description: 'Measurement of effort for agile planning', screensCount: 3 },
      { id: 'cf_severity', name: 'Severity', type: 'select', description: 'Impact level on customer operations', screensCount: 2 },
      { id: 'cf_environment', name: 'Environment', type: 'select', description: 'Staging, Production, QA, or Local', screensCount: 2 },
      { id: 'cf_sprint', name: 'Sprint', type: 'sprint_picker', description: 'Sprint allocation', screensCount: 3 },
    ])
  })

  router.post('/settings/custom-fields', requireUser, (req, res) => {
    const parsed = z.object({ name: z.string().min(2), fieldType: z.string(), description: z.string().optional() }).safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid custom field payload')
    sendSuccess(res, { id: `cf_${Date.now()}`, ...parsed.data, screensCount: 1 })
  })

  // Time Tracking Configuration
  router.get('/settings/time-tracking', requireUser, (_req, res) => {
    sendSuccess(res, { hoursPerDay: 8, daysPerWeek: 5, defaultUnit: 'minute', copyEstimateToRemaining: true })
  })

  router.put('/settings/time-tracking', requireUser, (req, res) => {
    const parsed = z.object({ hoursPerDay: z.number().positive(), daysPerWeek: z.number().positive(), defaultUnit: z.string(), copyEstimateToRemaining: z.boolean() }).safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Invalid time tracking payload')
    sendSuccess(res, { ...parsed.data, updatedAt: new Date().toISOString() })
  })

  // Atlassian Intelligence / Rovo AI
  router.post('/ai/rovo', requireUser, (req, res) => {
    const parsed = z.object({ prompt: z.string().min(1), projectKey: z.string().optional() }).safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'Prompt is required')
    sendSuccess(res, {
      response: `Rovo AI evaluated: "${parsed.data.prompt}". All systems, database tables, and project items are up to date.`,
      matchedIssues: ['KAN-1'],
      model: 'atlassian-intelligence-rovo-v1',
      timestamp: new Date().toISOString(),
    })
  })

  // JQL Search
  router.post('/issues/search/jql', requireUser, (req, res) => {
    const parsed = z.object({ jql: z.string() }).safeParse(req.body)
    if (!parsed.success) return sendFailure(res, 400, 'INVALID_PAYLOAD', 'JQL query is required')
    sendSuccess(res, { valid: true, jql: parsed.data.jql, executedAt: new Date().toISOString() })
  })

  return router
}

