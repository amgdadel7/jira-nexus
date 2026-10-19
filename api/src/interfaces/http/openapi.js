'use strict';

// OpenAPI 3.0 description of the REST API, served at /api/openapi.json and rendered at /api/docs.
// test/openapi.test.js fails when a route is added without being documented here.
const E = (method, path, tag, summary, extra = {}) => ({ method, path, tag, summary, ...extra });
const q = (name, description, type = 'string') => ({ name, in: 'query', required: false, description, schema: { type } });

const ENDPOINTS = [
  E('post', '/auth/login', 'Auth', 'Log in with email and password', { public: true, body: { email: 'ahmed@ahdfinancial.com', password: 'password', remember: true } }),
  E('post', '/auth/logout', 'Auth', 'End the current session'),
  E('get', '/auth/me', 'Auth', 'Current user'),
  E('patch', '/auth/me', 'Auth', 'Update profile or password', { body: { name: 'Ahmed', currentPassword: 'password', newPassword: 'new-password-1' } }),
  E('post', '/auth/forgot', 'Auth', 'Request a password reset link', { public: true, body: { email: 'sara@ahdfinancial.com' } }),
  E('get', '/auth/reset/{token}', 'Auth', 'Check a password reset token (returns the account e-mail)', { public: true }),
  E('post', '/auth/reset', 'Auth', 'Set a new password with a reset token', { public: true, body: { token: '…', password: 'new-password-1' } }),
  E('get', '/auth/sessions', 'Auth', 'List your active sessions'),
  E('delete', '/auth/sessions', 'Auth', 'Log out of all other sessions'),
  E('delete', '/auth/sessions/{id}', 'Auth', 'Log out one session'),
  E('get', '/auth/tokens', 'API tokens', 'List your personal API tokens'),
  E('post', '/auth/tokens', 'API tokens', 'Create a token (the value is returned once)', { body: { name: 'CI pipeline', expiresInDays: 90 } }),
  E('delete', '/auth/tokens/{id}', 'API tokens', 'Revoke a token'),

  E('get', '/projects', 'Projects', 'List projects', { query: [q('q', 'Filter by name or key')] }),
  E('post', '/projects', 'Projects', 'Create a project', { body: { key: 'OPS', name: 'Operations', type: 'software', description: '' } }),
  E('get', '/projects/{key}', 'Projects', 'Get a project'),
  E('patch', '/projects/{key}', 'Projects', 'Update a project (lead or admin)', { body: { name: 'Operations', leadId: 'u1', color: '#0C66E4' } }),
  E('delete', '/projects/{key}', 'Projects', 'Delete a project and its work (admin)', { body: { confirm: 'OPS' } }),
  E('post', '/projects/{key}/star', 'Projects', 'Star a project'),
  E('delete', '/projects/{key}/star', 'Projects', 'Unstar a project'),
  E('get', '/meta', 'Projects', 'Workspace metadata for one project', { query: [q('project', 'Project key, default KAN')] }),

  E('get', '/search', 'Work items', 'Search with JQL', { query: [q('jql', 'e.g. project = KAN AND status != Done ORDER BY cf[10019] ASC'), q('startAt', 'Offset', 'integer'), q('maxResults', 'Page size', 'integer')] }),
  E('get', '/quicksearch', 'Work items', 'Top-bar quick search', { query: [q('q', 'Text')] }),
  E('post', '/issues', 'Work items', 'Create a work item', { body: { projectKey: 'KAN', type: 'Task', summary: 'Write release notes', priority: 'Medium', fixVersion: '1.4.0' } }),
  E('get', '/issues/{key}', 'Work items', 'Get a work item with comments, history and links'),
  E('patch', '/issues/{key}', 'Work items', 'Update fields', { body: { status: 'In Progress', assigneeId: 'u2', sprint: 'KAN Sprint 2', fixVersion: '1.4.0' } }),
  E('delete', '/issues/{key}', 'Work items', 'Delete a work item'),
  E('post', '/issues/{key}/clone', 'Work items', 'Clone a work item'),
  E('post', '/issues/{key}/rank', 'Work items', 'Rank before or after another item', { body: { beforeKey: 'KAN-3' } }),
  E('post', '/issues/bulk', 'Work items', 'Bulk edit or delete', { body: { keys: ['KAN-1', 'KAN-2'], changes: { priority: 'High' } } }),
  E('post', '/issues/{key}/comments', 'Work items', 'Add a comment', { body: { body: 'Looks good @sara' } }),
  E('post', '/issues/{key}/links', 'Work items', 'Link to another item', { body: { type: 'blocks', targetKey: 'KAN-5' } }),
  E('post', '/issues/{key}/watch', 'Work items', 'Watch'),
  E('post', '/issues/{key}/attachments', 'Work items', 'Upload an attachment (raw body, X-Filename header)'),

  E('get', '/sprints', 'Sprints', 'List sprints', { query: [q('project', 'Project key'), q('state', 'future,active,closed')] }),
  E('post', '/sprints', 'Sprints', 'Create a sprint', { body: { projectKey: 'KAN', name: 'KAN Sprint 4', goal: '' } }),
  E('patch', '/sprints/{id}', 'Sprints', 'Edit a sprint', { body: { goal: 'Ship onboarding' } }),
  E('post', '/sprints/{id}/start', 'Sprints', 'Start a sprint', { body: { startDate: '2026-10-20', endDate: '2026-11-03' } }),
  E('post', '/sprints/{id}/complete', 'Sprints', 'Complete a sprint', { body: { moveTo: 'new' } }),
  E('delete', '/sprints/{id}', 'Sprints', 'Delete a future sprint'),
  E('post', '/sprints/move', 'Sprints', 'Move work items to a sprint or the backlog', { body: { keys: ['KAN-8'], sprintId: 3 } }),

  E('get', '/versions', 'Releases', 'List versions', { query: [q('project', 'Project key'), q('status', 'unreleased,released,archived')] }),
  E('post', '/versions', 'Releases', 'Create a version', { body: { projectKey: 'KAN', name: '1.5.0', releaseDate: '2026-11-15' } }),
  E('get', '/versions/{id}', 'Releases', 'Get a version and its work items'),
  E('patch', '/versions/{id}', 'Releases', 'Edit, archive or unrelease', { body: { status: 'archived' } }),
  E('post', '/versions/{id}/release', 'Releases', 'Release a version', { body: { moveUnresolvedTo: 4 } }),
  E('delete', '/versions/{id}', 'Releases', 'Delete a version', { body: { moveTo: null } }),

  E('get', '/projects/{key}/members', 'Access', 'People and roles in a project'),
  E('post', '/projects/{key}/members', 'Access', 'Add a person with a role (project admin)', { body: { userId: 'u5', role: 'viewer' } }),
  E('patch', '/projects/{key}/members/{userId}', 'Access', 'Change a role', { body: { role: 'member' } }),
  E('delete', '/projects/{key}/members/{userId}', 'Access', 'Remove a person'),
  E('get', '/projects/{key}/permissions', 'Access', 'Permission scheme (roles × permissions)'),
  E('put', '/projects/{key}/permissions', 'Access', 'Save the permission scheme', { body: { scheme: { EDIT_ISSUES: ['admin'] } } }),
  E('post', '/projects/{key}/permissions/reset', 'Access', 'Reset the scheme to defaults'),
  E('get', '/mypermissions', 'Access', 'My role and permissions in a project', { query: [q('project', 'Project key')] }),
  E('get', '/permissions/global', 'Access', 'Global permissions'),
  E('put', '/permissions/global', 'Access', 'Save global permissions (site admin)', { body: { scheme: { CREATE_PROJECTS: ['admin'] } } }),
  E('patch', '/projects/{key}/board', 'Access', 'Board settings: WIP limits and swimlanes', { body: { wip: { 'In Progress': 5 }, swimlanes: 'assignee' } }),
  E('get', '/components', 'Components', 'List components', { query: [q('project', 'Project key')] }),
  E('post', '/components', 'Components', 'Create a component', { body: { project: 'KAN', name: 'Mobile', leadId: 'u2', defaultAssignee: 'component_lead' } }),
  E('patch', '/components/{id}', 'Components', 'Edit a component (renames propagate to work items)', { body: { name: 'Mobile app' } }),
  E('delete', '/components/{id}', 'Components', 'Delete a component', { body: { moveTo: null } }),
  E('get', '/trash', 'Recycle bin', 'Deleted work items (kept 30 days)', { query: [q('project', 'Project key')] }),
  E('post', '/trash/{id}/restore', 'Recycle bin', 'Restore a deleted work item'),
  E('delete', '/trash/{id}', 'Recycle bin', 'Permanently delete (project admin)'),
  E('get', '/audit', 'Audit', 'Audit log', { query: [q('project', 'Project key (omit for site-wide; site admin)'), q('action', 'Action prefix, e.g. member'), q('actor', 'User id'), q('limit', 'Max rows')] }),
  E('get', '/teams', 'Teams', 'List teams'),
  E('post', '/teams', 'Teams', 'Create a team', { body: { name: 'Mobile', members: ['u2', 'u4'] } }),
  E('get', '/teams/{id}', 'Teams', 'Get a team'),
  E('patch', '/teams/{id}', 'Teams', 'Edit a team / replace members', { body: { members: ['u2'] } }),
  E('delete', '/teams/{id}', 'Teams', 'Delete a team'),

  E('get', '/reports/velocity', 'Reports', 'Velocity: committed vs. completed points', { query: [q('project', 'Project key'), q('sprints', 'How many closed sprints', 'integer')] }),
  E('get', '/reports/cfd', 'Reports', 'Cumulative flow diagram data', { query: [q('project', 'Project key'), q('days', '7–90', 'integer')] }),
  E('get', '/reports/sprint/{id}', 'Reports', 'Sprint report with burndown'),

  E('get', '/filters', 'Filters', 'Saved filters'),
  E('post', '/filters', 'Filters', 'Save a filter', { body: { name: 'My bugs', jql: 'type = Bug AND assignee = currentUser()' } }),
  E('get', '/goals', 'Goals', 'List goals'),
  E('get', '/forms', 'Forms', 'List forms', { query: [q('project', 'Project key')] }),
  E('post', '/forms/{id}/submit', 'Forms', 'Submit a form', { body: { values: { summary: 'Access request' } } }),
  E('get', '/dev', 'Development', 'Branches, commits and pull requests'),
  E('post', '/webhooks/commits', 'Development', 'Commit webhook', { body: { repo: 'kan-web', commits: [{ id: 'a1b2c3d', message: 'KAN-12 fix', authorEmail: 'sara@ahdfinancial.com' }] } }),
  E('get', '/notifications', 'Workspace', 'Your notifications'),
  E('get', '/activity', 'Workspace', 'Activity stream', { query: [q('project', 'Project key'), q('limit', 'Max 100', 'integer')] }),
  E('get', '/auth/config', 'Sign up', 'Public config for the log in / sign up screens (sign-up policy, enabled social providers)', { public: true }),
  E('post', '/auth/signup/start', 'Sign up', 'Start sign-up: emails a 6-digit code (returns {exists:true} if the account exists)', { public: true, body: { email: 'new.person@example.com' } }),
  E('post', '/auth/signup/verify', 'Sign up', 'Verify the emailed code → signupToken', { public: true, body: { email: 'new.person@example.com', code: '123456' } }),
  E('post', '/auth/signup/complete', 'Sign up', 'Finish sign-up with name and password → session token', { public: true, body: { signupToken: '…', name: 'New Person', password: 'a-strong-password', remember: true } }),
  E('get', '/auth/oauth/{provider}/start', 'Social login', 'Redirect to Google / Microsoft / Apple / Slack (query: mode=login|signup, popup=1, remember=1)', { public: true }),
  E('get', '/auth/oauth/{provider}/callback', 'Social login', 'OAuth redirect URI (Apple uses POST form_post)', { public: true }),
  E('get', '/auth/identities', 'Social login', 'Social accounts linked to you'),
  E('delete', '/auth/identities/{provider}', 'Social login', 'Unlink a social account'),
  E('get', '/admin/site', 'Site admin', 'Sign-up policy (admin)'),
  E('put', '/admin/site', 'Site admin', 'Change who can sign up (admin)', { body: { signup: 'domain', allowedDomains: ['ahdfinancial.com'] } }),
  E('get', '/admin/auth-providers', 'Site admin', 'OAuth providers with redirect URIs; secrets masked (admin)'),
  E('put', '/admin/auth-providers/{provider}', 'Site admin', 'Configure a provider (blank secret = keep) (admin)', { body: { enabled: true, clientId: 'xxx.apps.googleusercontent.com', clientSecret: 'GOCSPX-…' } }),
  E('get', '/plans', 'Billing', 'Plan catalogue: Free, Standard, Premium (prices in cents per user)', { public: true }),
  E('get', '/billing', 'Billing', 'Subscription, usage, limits; card and next payment for admins'),
  E('get', '/billing/quote', 'Billing', 'Prorated price for switching plan (admin)', { query: [q('plan', 'standard | premium'), q('cycle', 'monthly | annual')] }),
  E('post', '/billing/checkout', 'Billing', 'Change plan with the saved card or a new card (simulated payment) (admin)', { body: { plan: 'standard', cycle: 'annual', card: { holder: 'Ahmed', number: '4242424242424242', exp: '12/30', cvc: '123' } } }),
  E('post', '/billing/trial', 'Billing', 'Start the one-time 14-day trial (admin)', { body: { plan: 'premium' } }),
  E('post', '/billing/cancel', 'Billing', 'Cancel at the end of the period → Free (admin)'),
  E('post', '/billing/resume', 'Billing', 'Undo a scheduled cancellation (admin)'),
  E('put', '/billing/payment-method', 'Billing', 'Replace the card; pays open invoices (admin)', { body: { holder: 'Ahmed', number: '5555555555554444', exp: '08/29', cvc: '123' } }),
  E('put', '/billing/details', 'Billing', 'Company and billing email (admin)', { body: { company: 'AHD Financial', billingEmail: 'billing@ahdfinancial.com' } }),
  E('get', '/billing/invoices', 'Billing', 'List invoices (admin)'),
  E('get', '/billing/invoices/{id}', 'Billing', 'Get an invoice (admin)'),
  E('get', '/billing/invoices/{id}/html', 'Billing', 'Printable invoice (admin)'),
  E('get', '/issues/{key}/worklogs', 'Time tracking', 'Work logged on a work item'),
  E('post', '/issues/{key}/worklogs', 'Time tracking', 'Log work. adjustEstimate: auto | leave | new (newEstimate) | manual (reduceBy)', { body: { timeSpent: '2h 30m', started: '2026-10-18T09:00:00Z', comment: 'Reconciliation', adjustEstimate: 'auto' } }),
  E('patch', '/worklogs/{id}', 'Time tracking', 'Edit a worklog (own, or EDIT_ALL_WORKLOGS)', { body: { timeSpent: '3h' } }),
  E('delete', '/worklogs/{id}', 'Time tracking', 'Delete a worklog; remaining estimate is increased back'),
  E('get', '/reports/timesheet', 'Time tracking', 'Hours per person / work item / day (max 62 days)', { query: [q('project', 'Project key'), q('from', 'yyyy-MM-dd'), q('to', 'yyyy-MM-dd'), q('user', 'Only this user')] }),
  E('get', '/issues/{key}/votes', 'Votes', 'Vote count, whether you voted, and voters'),
  E('post', '/issues/{key}/votes', 'Votes', 'Vote for a work item (not your own, not Done)'),
  E('delete', '/issues/{key}/votes', 'Votes', 'Remove your vote'),
  E('get', '/auth/me/preferences', 'Personal settings', 'Theme, reduce motion, week start, notification switches'),
  E('patch', '/auth/me/preferences', 'Personal settings', 'Update personal settings', { body: { theme: 'dark', reduceMotion: false, weekStart: 'saturday', notify: { comment: false } } }),
  E('post', '/auth/me/avatar', 'Personal settings', 'Upload a profile photo (raw PNG/JPG/GIF/WebP body, max 1 MB)'),
  E('delete', '/auth/me/avatar', 'Personal settings', 'Remove your profile photo'),
  E('get', '/avatars/{file}', 'Personal settings', 'Profile photo file', { public: true }),
  E('get', '/projects/{key}/automation', 'Automation', 'Rules, monthly usage, triggers, actions and templates (project admin)'),
  E('post', '/projects/{key}/automation', 'Automation', 'Create a rule (or pass templateId)', { body: { name: 'Label new bugs', trigger: { type: 'issue_created' }, condition: 'type = Bug', actions: [{ type: 'add_label', label: 'triage' }] } }),
  E('get', '/automation/{id}', 'Automation', 'Get a rule'),
  E('patch', '/automation/{id}', 'Automation', 'Update / enable / disable a rule', { body: { enabled: false } }),
  E('delete', '/automation/{id}', 'Automation', 'Delete a rule'),
  E('get', '/automation/{id}/runs', 'Automation', 'Execution history of a rule'),
  E('post', '/automation/{id}/run', 'Automation', 'Run a rule on one work item now', { body: { issueKey: 'KAN-4' } }),
  E('get', '/projects/{key}/automation/audit', 'Automation', 'Automation audit log for a project', { query: [q('status', 'success | no_actions | some_errors | failure | throttled'), q('limit', 'Max rows', 'integer')] }),
  E('post', '/projects/{key}/import', 'Import', 'Import work items from CSV (JSON {csv, dryRun} or text/csv body with ?dryRun=1)', { body: { csv: 'Summary,Issue Type,Priority\nReconcile ledgers,Task,High', dryRun: true } }),
  E('get', '/admin/webhooks', 'Webhooks', 'List webhooks and available events (admin)'),
  E('post', '/admin/webhooks', 'Webhooks', 'Create a webhook; payloads signed with X-Hub-Signature when a secret is set (admin)', { body: { name: 'Warehouse', url: 'https://example.com/hook', secret: 's3cret', events: ['jira:issue_created'], jql: 'project = KAN' } }),
  E('patch', '/admin/webhooks/{id}', 'Webhooks', 'Update a webhook (admin)', { body: { enabled: false } }),
  E('delete', '/admin/webhooks/{id}', 'Webhooks', 'Delete a webhook (admin)'),
  E('post', '/admin/webhooks/{id}/test', 'Webhooks', 'Send a ping delivery (admin)'),
  E('get', '/admin/webhooks/{id}/deliveries', 'Webhooks', 'Recent deliveries (admin)'),
  E('get', '/admin/webhook-deliveries/{id}', 'Webhooks', 'Delivery with payload and response (admin)'),
  E('post', '/admin/webhook-deliveries/{id}/redeliver', 'Webhooks', 'Redeliver (admin)'),
  E('get', '/users', 'Workspace', 'List users'),
  E('get', '/events', 'Workspace', 'Live updates (Server-Sent Events). Pass ?access_token= because EventSource cannot send headers.'),
  E('get', '/health', 'Workspace', 'Health check', { public: true }),
  // ---- users (site admin) ----
  E('post', '/users', 'Users', 'Invite a user (site admin)', { body: { name: 'Lina Haddad', email: 'lina@ahdfinancial.com', password: 'password', role: 'member', projects: [{ key: 'KAN', role: 'member' }] } }),
  E('patch', '/users/{id}', 'Users', 'Update a user: name, title, role, active, password (site admin)', { body: { role: 'admin', active: true } }),
  E('delete', '/users/{id}', 'Users', 'Delete a user; their work items become unassigned (site admin)'),
  // ---- issues: workflow, collaboration ----
  E('get', '/issues/{key}/transitions', 'Issues', 'Transitions available from the current status (project workflow)'),
  E('post', '/issues/{key}/transitions', 'Issues', 'Move the work item through a workflow transition', { body: { transitionId: 3, resolution: 'Done' } }),
  E('delete', '/issues/{key}/watch', 'Issues', 'Stop watching a work item'),
  E('patch', '/comments/{id}', 'Issues', 'Edit your comment', { body: { body: 'Updated text' } }),
  E('delete', '/comments/{id}', 'Issues', 'Delete a comment (author or project admin)'),
  E('delete', '/links/{id}', 'Issues', 'Remove a work item link'),
  E('get', '/attachments/{id}', 'Issues', 'Download an attachment'),
  E('delete', '/attachments/{id}', 'Issues', 'Delete an attachment'),
  E('post', '/issues/{key}/dev', 'Development', 'Add a branch, commit, pull request or build', { body: { kind: 'pull_request', title: 'KAN-7 Add ledger export', url: 'https://example.com/pr/12', status: 'open' } }),
  E('patch', '/dev/{id}', 'Development', 'Update a development item (e.g. merge a pull request)', { body: { status: 'merged' } }),
  E('delete', '/dev/{id}', 'Development', 'Delete a development item'),
  // ---- custom fields + field configuration ----
  E('get', '/custom-fields', 'Fields', 'List custom fields (ids start at 10100; use cf[id] in JQL)'),
  E('post', '/custom-fields', 'Fields', 'Create a custom field (site admin)', { body: { name: 'Risk level', type: 'select', options: ['Low', 'Medium', 'High'], projects: ['KAN'] } }),
  E('get', '/custom-fields/{id}', 'Fields', 'Get a custom field'),
  E('patch', '/custom-fields/{id}', 'Fields', 'Rename a custom field, change options or projects (site admin)', { body: { options: ['Low', 'Medium', 'High', 'Critical'] } }),
  E('delete', '/custom-fields/{id}', 'Fields', 'Delete a custom field and its values (site admin)'),
  E('get', '/projects/{key}/fields', 'Fields', 'Custom fields used by a project and whether each is required'),
  E('put', '/projects/{key}/fields', 'Fields', 'Choose the custom fields of a project (project admin)', { body: { fields: [{ id: 10100, required: true }, { id: 10101 }] } }),
  // ---- workspace ----
  E('patch', '/project', 'Workspace', 'Update the current project settings (project admin)', { body: { key: 'KAN', name: 'AHD Financial' } }),
  E('get', '/me/worked-on', 'Workspace', 'Work items you recently viewed, edited or commented on'),
  E('post', '/notifications/read', 'Workspace', 'Mark notifications as read', { body: { ids: [1, 2] } }),
  E('patch', '/filters/{id}', 'Workspace', 'Rename or change a saved filter', { body: { name: 'My open bugs', jql: 'assignee = currentUser() AND type = Bug' } }),
  E('delete', '/filters/{id}', 'Workspace', 'Delete a saved filter'),
  E('get', '/goals/{id}', 'Goals', 'Get a goal with its linked work items'),
  E('post', '/goals', 'Goals', 'Create a goal', { body: { name: 'Launch payments v2', status: 'on_track', targetDate: '2026-12-31' } }),
  E('patch', '/goals/{id}', 'Goals', 'Update a goal', { body: { status: 'at_risk' } }),
  E('delete', '/goals/{id}', 'Goals', 'Delete a goal'),
  E('post', '/goals/{id}/issues', 'Goals', 'Link work items to a goal', { body: { keys: ['KAN-3'] } }),
  E('delete', '/goals/{id}/issues/{key}', 'Goals', 'Unlink a work item from a goal'),
  E('get', '/forms/{id}', 'Forms', 'Get a form'),
  E('post', '/forms', 'Forms', 'Create a form that creates work items', { body: { projectKey: 'KAN', name: 'Bug report', fields: [{ field: 'summary', label: 'What happened?' }] } }),
  E('patch', '/forms/{id}', 'Forms', 'Update a form'),
  E('delete', '/forms/{id}', 'Forms', 'Delete a form'),
  E('get', '/sprints/{id}', 'Sprints', 'Get a sprint with its stats'),
  // ---- sign-in ----
  E('post', '/auth/oauth/{provider}/callback', 'Auth', 'OAuth callback for providers that use form_post (Apple)', { public: true }),
  // ---- this document ----
  E('get', '/openapi.json', 'Workspace', 'This OpenAPI document', { public: true }),
  E('get', '/docs', 'Workspace', 'Human-readable API reference', { public: true }),
];

function spec() {
  const paths = {};
  for (const e of ENDPOINTS) {
    const params = [...(e.path.match(/\{(\w+)\}/g) || []).map((m) => ({ name: m.slice(1, -1), in: 'path', required: true, schema: { type: 'string' } })), ...(e.query || [])];
    (paths[e.path] ||= {})[e.method] = {
      tags: [e.tag], summary: e.summary, parameters: params.length ? params : undefined,
      security: e.public ? [] : undefined,
      requestBody: e.body ? { content: { 'application/json': { example: e.body, schema: { type: 'object' } } } } : undefined,
      responses: { 200: { description: 'OK' }, 400: { description: 'Invalid request', content: { 'application/json': { example: { error: 'message' } } } }, 401: { description: 'Not logged in' }, 402: { description: 'Plan limit reached or feature not in plan', content: { 'application/json': { example: { error: 'message', code: 'plan_limit', upgradeTo: 'standard' } } } } },
    };
  }
  return {
    openapi: '3.0.3',
    info: { title: 'Masar API', version: '8.0.0', description: 'REST API for Masar. Authenticate with `Authorization: Bearer <session token or personal API token>`.' },
    servers: [{ url: '/api' }],
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', description: 'Session token from POST /auth/login, or a personal API token (jcpat_…)' } } },
    security: [{ bearer: [] }],
    paths,
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function docsHtml() {
  const tags = [...new Set(ENDPOINTS.map((e) => e.tag))];
  const color = { get: '#216E4E', post: '#0055CC', put: '#6E5DC6', patch: '#A54800', delete: '#AE2E24' };
  const sections = tags.map((t) => `<section id="${esc(t.replace(/\s/g, '-'))}"><h2>${esc(t)}</h2>${ENDPOINTS.filter((e) => e.tag === t).map((e) => {
    const curl = `curl -X ${e.method.toUpperCase()} "$BASE/api${e.path}"${e.public ? '' : ' \\\n  -H "Authorization: Bearer $TOKEN"'}${e.body ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(e.body)}'` : ''}`;
    return `<details class="ep"><summary><span class="m" style="background:${color[e.method]}">${e.method.toUpperCase()}</span><code>${esc(e.path)}</code><span class="s">${esc(e.summary)}</span>${e.public ? '<span class="pub">public</span>' : ''}</summary>
      ${(e.query || []).length ? `<table>${e.query.map((p) => `<tr><td><code>${esc(p.name)}</code></td><td>${esc(p.description)}</td></tr>`).join('')}</table>` : ''}
      <pre>${esc(curl)}</pre></details>`;
  }).join('')}</section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Masar API</title>
<style>body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#172B4D;display:flex}
nav{width:220px;flex:none;padding:24px 16px;border-right:1px solid #DFE1E6;position:sticky;top:0;height:100vh;box-sizing:border-box;overflow:auto;background:#F7F8F9}
nav a{display:block;padding:4px 8px;color:#44546F;text-decoration:none;border-radius:3px}nav a:hover{background:#EBECF0}
main{flex:1;max-width:980px;padding:24px 40px}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px;border-bottom:1px solid #DFE1E6;padding-bottom:6px}
.ep{border:1px solid #DFE1E6;border-radius:4px;margin:6px 0;background:#fff}.ep summary{cursor:pointer;padding:8px 10px;display:flex;gap:10px;align-items:center;list-style:none}
.m{color:#fff;font-weight:700;font-size:11px;border-radius:3px;padding:2px 0;width:58px;text-align:center}.s{color:#626F86}.pub{margin-left:auto;font-size:11px;background:#DCFFF1;color:#216E4E;border-radius:3px;padding:1px 6px}
pre{background:#091E420F;margin:0 10px 10px;padding:10px;border-radius:3px;overflow:auto;font-size:12px}table{margin:0 10px 8px;border-collapse:collapse}td{padding:2px 12px 2px 0;color:#44546F}
.box{background:#E9F2FF;border-radius:4px;padding:12px 16px;margin:16px 0}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}</style></head>
<body><nav><b style="display:block;margin:0 8px 8px">Masar API</b>${tags.map((t) => `<a href="#${esc(t.replace(/\s/g, '-'))}">${esc(t)}</a>`).join('')}<a href="/api/openapi.json">openapi.json ↗</a></nav>
<main><h1>REST API reference</h1><p>All endpoints are under <code>/api</code> and return JSON. Errors look like <code>{"error": "message"}</code>.</p>
<div class="box"><b>Authentication.</b> Send <code>Authorization: Bearer &lt;token&gt;</code>. Use the <code>token</code> returned by <code>POST /auth/login</code>, or create a personal API token
(<code>jcpat_…</code>) in <i>Profile → API tokens</i>. Personal tokens act as you but cannot manage sessions or other tokens.<br><br>
The examples below already use this server's address.</div>${sections}</main>
<script>document.querySelectorAll('pre').forEach(p=>p.textContent=p.textContent.replace('$BASE',location.origin))</script></body></html>`;
}

module.exports = { spec, docsHtml, ENDPOINTS };
