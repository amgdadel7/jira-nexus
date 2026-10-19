import { authEvents } from './core/events/authEvents'
import { session, getProject, setProject, CLIENT_ID } from './core/api/sessionStore'
import { req, q, withToken, lastAuthProblem } from './core/api/httpClient'
import { authApi } from './features/auth/data/authApi'
import { projectsApi } from './features/projects/data/projectsApi'
import { issuesApi } from './features/issues/data/issuesApi'
import { planningApi } from './features/planning/data/planningApi'
import { workspaceApi } from './features/workspace/data/workspaceApi'

export { authEvents, session, getProject, setProject, CLIENT_ID, lastAuthProblem }

export const api = {
  // Domain Features
  ...authApi,
  ...projectsApi,
  ...issuesApi,
  ...planningApi,
  ...workspaceApi,

  // Additional Admin & Workspace modules
  adminSite: () => req('GET', '/api/admin/site'),
  saveAdminSite: (fields) => req('PUT', '/api/admin/site', fields),
  authProviders: () => req('GET', '/api/admin/auth-providers'),
  saveAuthProvider: (key, fields) => req('PUT', `/api/admin/auth-providers/${key}`, fields),
  oauthStartUrl: (provider, { mode = 'login', popup = true, remember = true } = {}) =>
    `/api/auth/oauth/${provider}/start?mode=${mode}&popup=${popup ? 1 : 0}&remember=${remember ? 1 : 0}`,
  identities: () => req('GET', '/api/auth/identities'),
  unlinkIdentity: (provider) => req('DELETE', `/api/auth/identities/${provider}`),

  // Billing
  billingQuote: (plan, cycle) => req('GET', `/api/billing/quote?plan=${plan}&cycle=${cycle}`),
  checkout: (fields) => req('POST', '/api/billing/checkout', fields),
  startTrial: (plan = 'premium') => req('POST', '/api/billing/trial', { plan }),
  cancelSubscription: () => req('POST', '/api/billing/cancel'),
  resumeSubscription: () => req('POST', '/api/billing/resume'),
  updateCard: (card) => req('PUT', '/api/billing/payment-method', card),
  saveBillingDetails: (fields) => req('PUT', '/api/billing/details', fields),
  invoices: () => req('GET', '/api/billing/invoices'),
  invoiceHtml: async (id) => {
    const token = session.get()
    const res = await fetch(token ? withToken(`/api/billing/invoices/${id}/html`, token) : `/api/billing/invoices/${id}/html`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error('Could not load the invoice.')
    return res.text()
  },

  // Reports
  velocity: (project = getProject()) => req('GET', `/api/reports/velocity${q({ project })}`),
  cfd: (days = 30, project = getProject()) => req('GET', `/api/reports/cfd${q({ project, days })}`),
  sprintReport: (id) => req('GET', `/api/reports/sprint/${id}`),

  // Personal API tokens
  apiTokens: () => req('GET', '/api/auth/tokens'),
  createApiToken: (name, expiresInDays) => req('POST', '/api/auth/tokens', { name, expiresInDays }),
  revokeApiToken: (id) => req('DELETE', `/api/auth/tokens/${id}`),

  // Time tracking & worklogs
  worklogs: (key) => req('GET', `/api/issues/${key}/worklogs`),
  logWork: (key, fields) => req('POST', `/api/issues/${key}/worklogs`, fields),
  updateWorklog: (id, fields) => req('PATCH', `/api/worklogs/${id}`, fields),
  deleteWorklog: (id, adjustEstimate = 'auto') => req('DELETE', `/api/worklogs/${id}?adjustEstimate=${adjustEstimate}`),
  timesheet: (project, from, to, user) => req('GET', `/api/reports/timesheet?project=${project}&from=${from}&to=${to}${user ? `&user=${user}` : ''}`),

  // Preferences & Avatar
  uploadAvatar: (file) => req('POST', '/api/auth/me/avatar', file, { raw: true, headers: { 'Content-Type': file.type || 'application/octet-stream' } }),
  deleteAvatar: () => req('DELETE', '/api/auth/me/avatar'),

  // Automation & Webhooks
  automation: (project = getProject()) => req('GET', `/api/projects/${project}/automation`),
  createRule: (project = getProject(), fields) => req('POST', `/api/projects/${project}/automation`, fields),
  updateRule: (id, fields) => req('PATCH', `/api/automation/${id}`, fields),
  deleteRule: (id) => req('DELETE', `/api/automation/${id}`),
  ruleRuns: (id) => req('GET', `/api/automation/${id}/runs`),
  runRule: (id, issueKey) => req('POST', `/api/automation/${id}/run`, { issueKey }),
  automationAudit: (project = getProject(), status) => req('GET', `/api/projects/${project}/automation/audit?limit=100${status ? `&status=${status}` : ''}`),
  webhooks: () => req('GET', '/api/admin/webhooks'),
  createWebhook: (fields) => req('POST', '/api/admin/webhooks', fields),
  updateWebhook: (id, fields) => req('PATCH', `/api/admin/webhooks/${id}`, fields),
  deleteWebhook: (id) => req('DELETE', `/api/admin/webhooks/${id}`),
  testWebhook: (id) => req('POST', `/api/admin/webhooks/${id}/test`),
  webhookDeliveries: (id) => req('GET', `/api/admin/webhooks/${id}/deliveries`),
  webhookDelivery: (id) => req('GET', `/api/admin/webhook-deliveries/${id}`),
  redeliver: (id) => req('POST', `/api/admin/webhook-deliveries/${id}/redeliver`),
  importCsv: (project = getProject(), csv, dryRun) => req('POST', `/api/projects/${project}/import`, { csv, dryRun }),

  // Attachments
  attachmentUrl: (id, inline) => {
    const p = new URLSearchParams()
    if (inline) p.set('inline', '1')
    const t = session.get()
    if (t) p.set('access_token', t)
    const qs = p.toString()
    return `/api/attachments/${id}${qs ? `?${qs}` : ''}`
  },
  addDev: (key, item) => req('POST', `/api/issues/${key}/dev`, item),

  // Activity & Notifications
  activity: (limit = 30, project = getProject()) => req('GET', `/api/activity${q({ limit, project })}`),
  workedOn: () => req('GET', '/api/me/worked-on'),
  notifications: () => req('GET', '/api/notifications'),
  markRead: (ids) => req('POST', '/api/notifications/read', ids ? { ids } : {}),

  // Filters
  filters: () => req('GET', '/api/filters'),
  createFilter: (fields) => req('POST', '/api/filters', fields),
  updateFilter: (id, fields) => req('PATCH', `/api/filters/${id}`, fields),
  deleteFilter: (id) => req('DELETE', `/api/filters/${id}`),

  // Goals
  goals: () => req('GET', '/api/goals'),
  goal: (id) => req('GET', `/api/goals/${id}`),
  createGoal: (fields) => req('POST', '/api/goals', fields),
  updateGoal: (id, fields) => req('PATCH', `/api/goals/${id}`, fields),
  deleteGoal: (id) => req('DELETE', `/api/goals/${id}`),
  linkGoalIssue: (id, key) => req('POST', `/api/goals/${id}/issues`, { key }),
  unlinkGoalIssue: (id, key) => req('DELETE', `/api/goals/${id}/issues/${key}`),

  // Forms
  forms: (project = getProject()) => req('GET', `/api/forms${q({ project })}`),
  createForm: (fields) => req('POST', '/api/forms', { projectKey: getProject(), ...fields }),
  updateForm: (id, fields) => req('PATCH', `/api/forms/${id}`, fields),
  deleteForm: (id) => req('DELETE', `/api/forms/${id}`),
  submitForm: (id, values) => req('POST', `/api/forms/${id}/submit`, { values }),

  // Dev & Git
  dev: (params = {}) => req('GET', `/api/dev${q(params)}`),
  updateDev: (id, fields) => req('PATCH', `/api/dev/${id}`, fields),
  deleteDev: (id) => req('DELETE', `/api/dev/${id}`),

  // Members & Permissions
  members: (key = getProject()) => req('GET', `/api/projects/${key}/members`),
  addMember: (userId, role, key = getProject()) => req('POST', `/api/projects/${key}/members`, { userId, role }),
  setMemberRole: (userId, role, key = getProject()) => req('PATCH', `/api/projects/${key}/members/${userId}`, { role }),
  removeMember: (userId, key = getProject()) => req('DELETE', `/api/projects/${key}/members/${userId}`),
  permissionScheme: (key = getProject()) => req('GET', `/api/projects/${key}/permissions`),
  savePermissionScheme: (scheme, key = getProject()) => req('PUT', `/api/projects/${key}/permissions`, { scheme }),
  resetPermissionScheme: (key = getProject()) => req('POST', `/api/projects/${key}/permissions/reset`),
  myPermissions: (project = getProject()) => req('GET', `/api/mypermissions${q({ project })}`),
  globalPermissions: () => req('GET', '/api/permissions/global'),
  saveGlobalPermissions: (scheme) => req('PUT', '/api/permissions/global', { scheme }),
  updateBoard: (fields, key = getProject()) => req('PATCH', `/api/projects/${key}/board`, fields),

  // Trash & Audit & Teams
  trash: (project = getProject()) => req('GET', `/api/trash${q({ project })}`),
  restoreTrash: (id) => req('POST', `/api/trash/${id}/restore`),
  purgeTrash: (id) => req('DELETE', `/api/trash/${id}`),
  audit: (params = {}) => req('GET', `/api/audit${q(params)}`),
  teams: () => req('GET', '/api/teams'),
  team: (id) => req('GET', `/api/teams/${id}`),
  createTeam: (fields) => req('POST', '/api/teams', fields),
  updateTeam: (id, fields) => req('PATCH', `/api/teams/${id}`, fields),
  deleteTeam: (id) => req('DELETE', `/api/teams/${id}`),
  reset: async () => {
    const d = await req('POST', '/api/reset')
    if (d.token) session.set(d.token, session.remembered())
    return d
  },
}

// ---- Recently viewed work items (client-side, per browser) ----
export const recent = {
  get: () => {
    try {
      return JSON.parse(localStorage.getItem('jc.recent') || '[]')
    } catch {
      return []
    }
  },
  push: (issue) => {
    const list = recent.get().filter((x) => x.key !== issue.key)
    list.unshift({ key: issue.key, summary: issue.summary, type: issue.type, viewed: new Date().toISOString() })
    localStorage.setItem('jc.recent', JSON.stringify(list.slice(0, 20)))
    window.dispatchEvent(new Event('jc-recent'))
  },
  clear: () => {
    localStorage.removeItem('jc.recent')
    window.dispatchEvent(new Event('jc-recent'))
  },
  remove: (key) => {
    localStorage.setItem('jc.recent', JSON.stringify(recent.get().filter((x) => x.key !== key)))
    window.dispatchEvent(new Event('jc-recent'))
  },
}

// ---- Live updates (Server-Sent Events) ----
export function connectEvents({ onChange, onPresence } = {}) {
  let es = null
  let stopped = false
  let timer = null
  const open = () => {
    if (stopped || typeof EventSource === 'undefined') return
    const token = session.get()
    es = new EventSource(`/api/events${q({ access_token: token, client: CLIENT_ID })}`, { withCredentials: true })
    es.addEventListener('change', (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.client !== CLIENT_ID) onChange?.(d)
      } catch {
        /* ignore */
      }
    })
    const pres = (e) => {
      try {
        onPresence?.(JSON.parse(e.data).users || [])
      } catch {
        /* ignore */
      }
    }
    es.addEventListener('presence', pres)
    es.addEventListener('hello', pres)
    es.onerror = () => {
      es.close()
      if (!stopped) timer = setTimeout(open, 5000)
    }
  }
  open()
  return () => {
    stopped = true
    clearTimeout(timer)
    es?.close()
  }
}
