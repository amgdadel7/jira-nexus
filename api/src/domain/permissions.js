'use strict';

/**
 * Permission model (Jira-style), pure rules:
 *  • Site administrators can do everything everywhere.
 *  • Project access level: open (everyone is a Member), limited (everyone is a Viewer),
 *    private (only people added to the project).
 *  • Project roles: Administrator, Member, Viewer. The project lead is always an Administrator.
 *  • A permission scheme maps each project permission to the roles holding it.
 *  • On plans without the 'permissions' feature everyone works as a Member and the default scheme applies.
 */

const ROLES = ['admin', 'member', 'viewer', 'guest'];
const ROLE_LABEL = { admin: 'Administrator', member: 'Member', viewer: 'Viewer', guest: 'Guest' };
const ACCESS = ['open', 'limited', 'private'];

const ORG_ROLES = ['owner', 'admin', 'member', 'guest'];
const ORG_PERMISSIONS = {
  ORG_MANAGE: ['owner', 'admin'],
  ORG_BILLING: ['owner'],
  ORG_MEMBERS_INVITE: ['owner', 'admin'],
  ORG_MEMBERS_MANAGE: ['owner', 'admin'],
  ORG_DELETE: ['owner'],
  ORG_CREATE_WORKSPACE: ['owner', 'admin', 'member'],
  ORG_CREATE_PROJECT: ['owner', 'admin', 'member'],
};

const WORKSPACE_ROLES = ['admin', 'member', 'viewer', 'guest'];
const WORKSPACE_PERMISSIONS = {
  WORKSPACE_ADMIN: ['admin'],
  WORKSPACE_CREATE_PROJECT: ['admin', 'member'],
  WORKSPACE_MANAGE_MEMBERS: ['admin'],
  WORKSPACE_VIEW: ['admin', 'member', 'viewer', 'guest'],
};

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
/** Roles that can never lose these permissions (prevents locking everyone out). */
const LOCKED = { BROWSE_PROJECT: ['admin'], ADMINISTER_PROJECT: ['admin'] };

const GLOBAL_PERMISSIONS = [
  { key: 'CREATE_PROJECTS', name: 'Create projects', description: 'Create new projects (the creator becomes the project lead).' },
  { key: 'MANAGE_GOALS', name: 'Manage goals', description: 'Create, edit and delete goals.' },
  { key: 'MANAGE_TEAMS', name: 'Manage teams', description: 'Create teams and change any team’s members.' },
  { key: 'BROWSE_USERS', name: 'Browse users', description: 'See the People directory and user profiles.' },
];
const GLOBAL_DEFAULT = { CREATE_PROJECTS: ['admin', 'member'], MANAGE_GOALS: ['admin', 'member'], MANAGE_TEAMS: ['admin', 'member'], BROWSE_USERS: ['admin', 'member'] };

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

const defaultScheme = () => Object.fromEntries(PERM_KEYS.map((k) => [k, [...DEFAULT_SCHEME[k]]]));

/** Builds a full scheme from stored overrides ({ PERM: [roles] }), always keeping LOCKED roles. */
function buildScheme(overrides) {
  const out = {};
  for (const k of PERM_KEYS) {
    const roles = overrides && Array.isArray(overrides[k]) ? overrides[k].filter((r) => ROLES.includes(r)) : DEFAULT_SCHEME[k];
    out[k] = [...new Set([...(LOCKED[k] || []), ...roles])];
  }
  return out;
}

/** Effective project role: 'admin' | 'member' | 'viewer' | 'guest' | null (no access - deny-by-default). */
function effectiveRole({ user, project, memberRole, permissionsFeature, orgRole }) {
  if (!user || !project) return null;
  if (user.role === 'admin' || project.lead_id === user.id) return 'admin';
  if (!permissionsFeature) return memberRole === 'admin' ? 'admin' : 'member';
  if (memberRole) return memberRole;
  // Deny-by-default: guests at the organization level never inherit open/limited project access without explicit assignment
  if (orgRole === 'guest') return null;
  if (project.access === 'open') return 'member';
  if (project.access === 'limited') return 'viewer';
  return null;
}

/** Set of permission keys a user holds in a project. */
function permissionSet({ user, role, scheme }) {
  if (user?.role === 'admin') return new Set(PERM_KEYS);
  if (!role) return new Set();
  const set = new Set(PERM_KEYS.filter((p) => (scheme[p] || []).includes(role)));
  return set.has('BROWSE_PROJECT') ? set : new Set();
}

/** Global scheme from stored settings ({ PERM: [roles] }). */
function buildGlobalScheme(saved) {
  return Object.fromEntries(GLOBAL_PERMISSIONS.map((p) => [
    p.key,
    saved && Array.isArray(saved[p.key]) ? saved[p.key].filter((r) => r === 'admin' || r === 'member') : GLOBAL_DEFAULT[p.key],
  ]));
}

module.exports = {
  ROLES, ROLE_LABEL, ACCESS, PERMISSIONS, PERM_KEYS, DEFAULT_SCHEME, LOCKED, GLOBAL_PERMISSIONS, GLOBAL_DEFAULT, MESSAGES,
  ORG_ROLES, ORG_PERMISSIONS, WORKSPACE_ROLES, WORKSPACE_PERMISSIONS,
  defaultScheme, buildScheme, effectiveRole, permissionSet, buildGlobalScheme,
};
