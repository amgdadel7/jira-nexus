'use strict';

const { handle, created } = require('../handler');
const present = require('../presenters/workspace');
const { issue, developmentWithIssue } = require('../presenters/issues');
const { publicUser } = require('../presenters/users');
const { project: presentProject } = require('../presenters/projects');

/** Workspace bootstrap, search box, activity, notifications, saved filters, goals, forms and the code page. */
module.exports = function workspaceController(router, { services }) {
  const { workspace, projects, notifications, filters, goals, forms, development } = services;

  router.get('/meta', handle(async (req) => present.meta(await workspace.meta(req.actor, req.query.project))));
  // Legacy project settings endpoint (name, description, lead).
  router.patch('/project', handle(async (req) => {
    const { name, description, leadId } = req.body || {};
    const view = await projects.update(req.actor, req.query.project || req.body?.key || 'KAN', { name, description, leadId });
    const { stats, starred, members, myRole, ...out } = presentProject(view); // eslint-disable-line no-unused-vars
    return out;
  }));

  router.get('/quicksearch', handle(async (req) => {
    const r = await workspace.quickSearch(req.actor, req.query.q);
    return { issues: r.issues.map((i) => issue(i)), filters: r.filters, users: r.users.map(publicUser) };
  }));
  router.get('/activity', handle(async (req) => (await workspace.feed(req.actor, req.query)).map(present.activity)));
  router.get('/me/worked-on', handle(async (req) => ({ issues: (await workspace.workedOn(req.actor)).map((i) => issue(i)) })));

  router.get('/notifications', handle(async (req) => {
    const [items, unread] = await Promise.all([notifications.list(req.actor, 50), notifications.unreadCount(req.actor)]);
    return { unread, items: items.map(present.notification) };
  }));
  router.post('/notifications/read', handle(async (req) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (ids) for (const id of ids) await notifications.markRead(req.actor, Number(id));
    else await notifications.markRead(req.actor);
    return { ok: true };
  }));

  router.get('/filters', handle(async () => (await filters.list()).map(present.filter)));
  router.post('/filters', handle(async (req, res) => created(res, present.filter(await filters.create(req.actor, req.body || {})))));
  router.patch('/filters/:id', handle(async (req) => present.filter(await filters.update(req.actor, req.params.id, req.body || {}))));
  router.delete('/filters/:id', handle((req) => filters.remove(req.actor, req.params.id)));

  router.get('/goals', handle(async (req) => (await goals.list(req.actor)).map(present.goal)));
  router.get('/goals/:id', handle(async (req) => present.goal(await goals.get(req.actor, req.params.id))));
  router.post('/goals', handle(async (req, res) => created(res, present.goal(await goals.create(req.actor, req.body || {})))));
  router.patch('/goals/:id', handle(async (req) => present.goal(await goals.update(req.actor, req.params.id, req.body || {}))));
  router.delete('/goals/:id', handle((req) => goals.remove(req.actor, req.params.id)));
  router.post('/goals/:id/issues', handle(async (req, res) => created(res, present.goal(await goals.link(req.actor, req.params.id, req.body?.key)))));
  router.delete('/goals/:id/issues/:key', handle(async (req) => present.goal(await goals.unlink(req.actor, req.params.id, req.params.key))));

  router.get('/forms', handle(async (req) => (await forms.list(req.actor, req.query.project)).map(present.form)));
  router.get('/forms/:id', handle(async (req) => present.form(await forms.get(req.actor, req.params.id))));
  router.post('/forms', handle(async (req, res) => created(res, present.form(await forms.create(req.actor, req.body || {})))));
  router.patch('/forms/:id', handle(async (req) => present.form(await forms.update(req.actor, req.params.id, req.body || {}))));
  router.delete('/forms/:id', handle((req) => forms.remove(req.actor, req.params.id)));
  router.post('/forms/:id/submit', handle(async (req, res) => created(res, issue(await forms.submit(req.actor, req.params.id, req.body?.values || {})))));

  router.get('/dev', handle(async (req) => (await development.list(req.actor, { kind: req.query.kind, repo: req.query.repo, status: req.query.status })).map(developmentWithIssue)));
  router.patch('/dev/:id', handle(async (req) => developmentWithIssue(await development.setStatus(req.actor, req.params.id, req.body || {}))));
  router.delete('/dev/:id', handle((req) => development.remove(req.actor, req.params.id)));
  router.post('/webhooks/commits', handle((req) => development.ingestCommits(req.actor, req.body || {})));
};
