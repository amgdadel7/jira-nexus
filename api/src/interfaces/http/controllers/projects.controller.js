'use strict';

const { handle, created } = require('../handler');
const present = require('../presenters/projects');
const { publicUser } = require('../presenters/users');
const { customField } = require('../presenters/workspace');

const peopleOut = (m) => ({ ...m, people: m.people.map((p) => ({ ...p, user: publicUser(p.user) })) });

/** Projects, people & roles, permission schemes, board settings, components, fields, recycle bin, audit log, teams. */
module.exports = function projectsController(router, { services, guards }) {
  const { projects, projectAccess, components, trash, audit, teams, customFields } = services;

  router.get('/projects', handle(async (req) => (await projects.list(req.actor, req.query.q)).map(present.project)));
  router.post('/projects', handle(async (req, res) => created(res, present.project(await projects.create(req.actor, req.body || {})))));
  router.get('/projects/:key', handle(async (req) => present.project(await projects.get(req.actor, req.params.key))));
  router.patch('/projects/:key', handle(async (req) => present.project(await projects.update(req.actor, req.params.key, req.body || {}))));
  router.delete('/projects/:key', handle((req) => projects.remove(req.actor, req.params.key, { confirm: req.body?.confirm })));
  router.post('/projects/:key/star', handle((req) => projects.star(req.actor, req.params.key)));
  router.delete('/projects/:key/star', handle((req) => projects.unstar(req.actor, req.params.key)));

  router.get('/projects/:key/members', handle(async (req) => peopleOut(await projectAccess.members(req.actor, req.params.key))));
  router.post('/projects/:key/members', handle(async (req, res) => created(res, peopleOut(await projectAccess.addMembers(req.actor, req.params.key, req.body || {})))));
  router.patch('/projects/:key/members/:userId', handle(async (req) => peopleOut(await projectAccess.changeRole(req.actor, req.params.key, req.params.userId, req.body?.role))));
  router.delete('/projects/:key/members/:userId', handle(async (req) => peopleOut(await projectAccess.removeMember(req.actor, req.params.key, req.params.userId))));

  router.get('/projects/:key/permissions', handle((req) => projectAccess.scheme(req.actor, req.params.key)));
  router.put('/projects/:key/permissions', handle((req) => projectAccess.updateScheme(req.actor, req.params.key, req.body?.scheme)));
  router.post('/projects/:key/permissions/reset', handle((req) => projectAccess.resetScheme(req.actor, req.params.key)));
  router.get('/mypermissions', handle((req) => projectAccess.myPermissions(req.actor, req.query.project)));
  router.get('/permissions/global', handle((req) => projectAccess.globalPermissions(req.actor)));
  router.put('/permissions/global', guards.requireAdmin, handle((req) => projectAccess.updateGlobalPermissions(req.actor, req.body?.scheme || {})));

  router.patch('/projects/:key/board', handle((req) => projectAccess.updateBoard(req.actor, req.params.key, req.body || {})));

  router.get('/projects/:key/fields', handle(async (req) => {
    const r = await customFields.projectFields(req.actor, req.params.key);
    return { ...r, fields: r.fields.map(customField) };
  }));
  router.put('/projects/:key/fields', handle(async (req) => {
    const r = await customFields.setProjectFields(req.actor, req.params.key, req.body?.fields);
    return { ...r, fields: r.fields.map(customField) };
  }));

  router.get('/components', handle(async (req) => (await components.list(req.actor, req.query.project)).map(present.component)));
  router.post('/components', handle(async (req, res) => created(res, present.component(await components.create(req.actor, req.body || {})))));
  router.patch('/components/:id', handle(async (req) => present.component(await components.update(req.actor, req.params.id, req.body || {}))));
  router.delete('/components/:id', handle((req) => components.remove(req.actor, req.params.id, req.body?.moveTo ?? req.query.moveTo)));

  router.get('/trash', handle(async (req) => {
    const r = await trash.list(req.actor, req.query.project);
    return { retentionDays: r.retentionDays, canPurge: r.canPurge, items: r.items.map((e) => present.trashEntry(e, r.retentionDays)) };
  }));
  router.post('/trash/:id/restore', handle(async (req) => ({ ok: true, key: await trash.restore(req.actor, req.params.id) })));
  router.delete('/trash/:id', handle(async (req) => {
    await trash.purge(req.actor, req.params.id);
    return { ok: true };
  }));

  router.get('/audit', handle(async (req) => (await audit.list(req.actor, req.query)).map(present.audit)));

  router.get('/teams', handle(async (req) => (await teams.list(req.actor)).map((t) => present.team(t))));
  router.get('/teams/:id', handle(async (req) => present.team(await teams.get(req.actor, req.params.id), true)));
  router.post('/teams', handle(async (req, res) => created(res, present.team(await teams.create(req.actor, req.body || {}), true))));
  router.patch('/teams/:id', handle(async (req) => present.team(await teams.update(req.actor, req.params.id, req.body || {}), true)));
  router.delete('/teams/:id', handle((req) => teams.remove(req.actor, req.params.id)));

};
