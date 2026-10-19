// Permissions: project roles + per-project permission schemes + global permissions (Jira-style).
//
//  • Site administrators (users.role = 'admin') can do everything everywhere.
//  • Every project has an access level:
//      open     – anyone signed in is treated as a Member unless given an explicit role
//      limited  – anyone signed in is treated as a Viewer unless given an explicit role
//      private  – only people added to the project (and site admins) can see it
//  • People can be added to a project as Administrator, Member or Viewer. The project lead is
//    always an Administrator of their project.
//  • A permission scheme maps each project permission to the roles that hold it. Projects start with
//    DEFAULT_SCHEME and project administrators can customise it.
const db = require('./db');

const ROLES = ['admin', 'member', 'viewer'];
const ROLE_LABEL = { admin: 'Administrator', member: 'Member', viewer: 'Viewer' };
const ACCESS = ['open', 'limited', 'private'];

const PERMISSIONS = [
  { key: 'BROWSE_PROJECT', group: 'Project', name: 'Browse project', description: 'See the project, its work items, boards, releases and reports.' },
  { key: 'ADMINISTER_PROJECT', group: 'Project', name: 'Administer project', description: 'Change project details, people and roles, permissions, components, board settings, and use the recycle bin.' },
  { key: 'CREATE_ISSUES', group: 'Work items', name: 'Create work items', description: 'Create work items, sub-tasks, and submit forms.' },
  { key: 'EDIT_ISSUES', group: 'Work items', name: 'Edit work items', description: 'Edit fields, rank work, and plan it into sprints.' },
  { key: 'TRANSITION_ISSUES', group: 'Work items', name: 'Transition work items', description: 'Change status, e.g. drag cards on the board.' },
  { key: 'ASSIGN_ISSUES', group: 'Work items', name: 'Assign work items', description: 'Change the assignee of work items.' },
  { key: 'LINK_ISSUES', group: 'Work items', name: 'Link work items', description: 'Add and remove links between work items.' },
  { key: 'DELETE_ISSUES', group: 'Work items', name: 'Delete work items', description: 'Move work items to the recycle bin and restore them.' },
  { key: 'ADD_COMMENTS', group: 'Comments', name: 'Add comments', description: 'Comment on work items and edit or delete their own comments.' },
  { key: 'DELETE_ALL_COMMENTS', group: 'Comments', name: 'Manage all comments', description: 'Edit or delete anyone’s comments.' },
  { key: 'CREATE_ATTACHMENTS', group: 'Attachments', name: 'Add attachments', description: 'Upload files and delete their own attachments.' },
  { key: 'DELETE_ALL_ATTACHMENTS', group: 'Attachments', name: 'Delete all attachments', description: 'Delete anyone’s attachments.' },
  { key: 'MANAGE_SPRINTS', group: 'Planning', name: 'Manage sprints', description: 'Create, edit, start, complete and delete sprints.' },
  { key: 'MANAGE_VERSIONS', group: 'Planning', name: 'Manage releases', description: 'Create, edit, release, archive and delete versions.' },
  { key: 'WORK_ON_ISSUES', group: 'Time tracking', name: 'Work on work items', description: 'Log work and edit or delete their own worklogs.' },
  { key: 'EDIT_ALL_WORKLOGS', group: 'Time tracking', name: 'Manage all worklogs', description: 'Edit or delete anyone’s worklogs.' },
];
const PERM_KEYS = PERMISSIONS.map((p) => p.key);

const DEFAULT_SCHEME = {
  BROWSE_PROJECT: ['admin', 'member', 'viewer'],
  ADMINISTER_PROJECT: ['admin'],
  CREATE_ISSUES: ['admin', 'member'],
  EDIT_ISSUES: ['admin', 'member'],
  TRANSITION_ISSUES: ['admin', 'member'],
  ASSIGN_ISSUES: ['admin', 'member'],
  LINK_ISSUES: ['admin', 'member'],
  DELETE_ISSUES: ['admin'],
  ADD_COMMENTS: ['admin', 'member', 'viewer'],
  DELETE_ALL_COMMENTS: ['admin'],
  CREATE_ATTACHMENTS: ['admin', 'member'],
  DELETE_ALL_ATTACHMENTS: ['admin'],
  MANAGE_SPRINTS: ['admin', 'member'],
  MANAGE_VERSIONS: ['admin'],
  WORK_ON_ISSUES: ['admin', 'member'],
  EDIT_ALL_WORKLOGS: ['admin'],
};
// Roles that can never lose these permissions (prevents locking everyone out of a project).
const LOCKED = { BROWSE_PROJECT: ['admin'], ADMINISTER_PROJECT: ['admin'] };

// ---------- global permissions ----------
const GLOBAL_PERMISSIONS = [
  { key: 'CREATE_PROJECTS', name: 'Create projects', description: 'Create new projects (the creator becomes the project lead).' },
  { key: 'MANAGE_GOALS', name: 'Manage goals', description: 'Create, edit and delete goals.' },
  { key: 'MANAGE_TEAMS', name: 'Manage teams', description: 'Create teams and change any team’s members.' },
  { key: 'BROWSE_USERS', name: 'Browse users', description: 'See the People directory and user profiles.' },
];
const GLOBAL_DEFAULT = { CREATE_PROJECTS: ['admin', 'member'], MANAGE_GOALS: ['admin', 'member'], MANAGE_TEAMS: ['admin', 'member'], BROWSE_USERS: ['admin', 'member'] };

const planHas = (f) => require('./billing').feature(f);
function globalScheme() {
  if (!planHas('permissions')) return { ...GLOBAL_DEFAULT };
  const row = db.prepare("SELECT value FROM site_settings WHERE key = 'global_permissions'").get();
  let saved = {};
  try { saved = row ? JSON.parse(row.value) : {}; } catch { saved = {}; }
  return Object.fromEntries(GLOBAL_PERMISSIONS.map((p) => [p.key, Array.isArray(saved[p.key]) ? saved[p.key].filter((r) => r === 'admin' || r === 'member') : GLOBAL_DEFAULT[p.key]]));
}
function canGlobal(user, key) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return (globalScheme()[key] || []).includes(user.role || 'member');
}

// ---------- project permissions ----------
function schemeFor(project, { stored = false } = {}) {
  let saved = {};
  if (!stored && !planHas('permissions')) return Object.fromEntries(PERM_KEYS.map((k) => [k, [...DEFAULT_SCHEME[k]]]));
  try { saved = project.permissions ? JSON.parse(project.permissions) : {}; } catch { saved = {}; }
  const out = {};
  for (const k of PERM_KEYS) {
    const roles = Array.isArray(saved[k]) ? saved[k].filter((r) => ROLES.includes(r)) : DEFAULT_SCHEME[k];
    out[k] = [...new Set([...(LOCKED[k] || []), ...roles])];
  }
  return out;
}

function getProject(key) {
  return db.prepare('SELECT * FROM projects WHERE key = ? COLLATE NOCASE').get(String(key || ''));
}

/** Effective project role for a user: 'admin' | 'member' | 'viewer' | null (no access). */
function roleFor(user, project) {
  if (!user || !project) return null;
  if (user.role === 'admin' || project.lead_id === user.id) return 'admin';
  const m = db.prepare('SELECT role FROM project_members WHERE project_key = ? AND user_id = ?').get(project.key, user.id);
  // Free plan: no access levels or viewer roles – everyone works as a member (data is kept for upgrades)
  if (!planHas('permissions')) return m?.role === 'admin' ? 'admin' : 'member';
  if (m) return m.role;
  if (project.access === 'open') return 'member';
  if (project.access === 'limited') return 'viewer';
  return null;
}

/** Per-request cache so a list of 500 items doesn't re-query the scheme for every row. */
function cache(req) {
  if (!req._perm) req._perm = new Map();
  return req._perm;
}
function permsFor(req, projectKey) {
  const c = cache(req);
  const k = String(projectKey || '').toUpperCase();
  if (c.has(k)) return c.get(k);
  const project = getProject(k);
  let val = { project, role: null, set: new Set() };
  if (project) {
    const role = roleFor(req.user, project);
    const scheme = schemeFor(project);
    const set = new Set(req.user?.role === 'admin' ? PERM_KEYS : role ? PERM_KEYS.filter((p) => scheme[p].includes(role)) : []);
    if (!set.has('BROWSE_PROJECT')) set.clear(); // nothing without browse
    val = { project, role, set };
  }
  c.set(k, val);
  return val;
}
function can(req, projectKey, perm) { return permsFor(req, projectKey).set.has(perm); }

const forbidden = (msg) => Object.assign(new Error(msg), { status: 403 });
const notFound = (msg) => Object.assign(new Error(msg), { status: 404 });
const MESSAGES = {
  BROWSE_PROJECT: 'You don’t have access to this project.',
  ADMINISTER_PROJECT: 'Only project administrators can do that.',
  CREATE_ISSUES: 'You don’t have permission to create work items in this project.',
  EDIT_ISSUES: 'You don’t have permission to edit work items in this project.',
  TRANSITION_ISSUES: 'You don’t have permission to change the status of work items in this project.',
  ASSIGN_ISSUES: 'You don’t have permission to assign work items in this project.',
  LINK_ISSUES: 'You don’t have permission to link work items in this project.',
  DELETE_ISSUES: 'You don’t have permission to delete work items in this project.',
  ADD_COMMENTS: 'You don’t have permission to comment in this project.',
  DELETE_ALL_COMMENTS: 'You can only change your own comments.',
  CREATE_ATTACHMENTS: 'You don’t have permission to add attachments in this project.',
  DELETE_ALL_ATTACHMENTS: 'You can only delete your own attachments.',
  MANAGE_SPRINTS: 'You don’t have permission to manage sprints in this project.',
  MANAGE_VERSIONS: 'You don’t have permission to manage releases in this project.',
};

/** Throws 404 when the user can't browse the project (don't leak private projects), 403 otherwise. */
function assert(req, projectKey, perm) {
  const { project, set } = permsFor(req, projectKey);
  if (!project) throw notFound(`Project '${projectKey}' does not exist.`);
  if (!set.has('BROWSE_PROJECT')) throw notFound(`Project '${project.key}' does not exist or you don’t have access to it.`);
  if (perm && !set.has(perm)) throw forbidden(MESSAGES[perm] || 'You don’t have permission to do that.');
  return project;
}
function assertGlobal(req, key) {
  if (!canGlobal(req.user, key)) throw forbidden(`You don’t have the “${GLOBAL_PERMISSIONS.find((p) => p.key === key)?.name || key}” permission.`);
}

/** Keys of every project the user can browse. */
function browsableKeys(req) {
  const c = cache(req);
  if (c.has('*keys')) return c.get('*keys');
  const keys = db.prepare('SELECT key FROM projects').all().map((p) => p.key).filter((k) => can(req, k, 'BROWSE_PROJECT'));
  c.set('*keys', keys);
  return keys;
}
/** SQL fragment restricting an issues alias to browsable projects. */
function issueFilter(req, alias = 'i') {
  const keys = browsableKeys(req);
  if (!keys.length) return { sql: '0', params: [] };
  return { sql: `${alias}.project_key IN (${keys.map(() => '?').join(',')})`, params: keys };
}

/** Summary for the client: what the current user may do in a project. */
function describe(req, projectKey) {
  const { project, role, set } = permsFor(req, projectKey);
  return { role, roleLabel: role ? ROLE_LABEL[role] : null, permissions: [...set], access: project?.access };
}

// ---------- audit log ----------
function audit(req, action, { project = null, target = null, details = {} } = {}) {
  db.prepare('INSERT INTO audit_log (actor_id,action,project_key,target,details,created_at) VALUES (?,?,?,?,?,?)')
    .run(req?.user?.id || null, action, project, target, JSON.stringify(details || {}), new Date().toISOString());
}

module.exports = {
  ROLES, ROLE_LABEL, ACCESS, PERMISSIONS, PERM_KEYS, DEFAULT_SCHEME, LOCKED, GLOBAL_PERMISSIONS, GLOBAL_DEFAULT,
  schemeFor, roleFor, permsFor, can, assert, assertGlobal, canGlobal, globalScheme, browsableKeys, issueFilter, describe, audit,
};
