'use strict';

const { handle, created } = require('../handler');
const present = require('../presenters/projects');
const { issue } = require('../presenters/issues');

/** Sprints and releases. */
module.exports = function planningController(router, { services }) {
  const { sprints, versions } = services;

  router.get('/sprints', handle(async (req) => (await sprints.list(req.actor, req.query)).map(present.sprint)));
  router.post('/sprints', handle(async (req, res) => created(res, present.sprint(await sprints.create(req.actor, req.body || {})))));
  router.post('/sprints/move', handle((req) => sprints.move(req.actor, req.body || {})));
  router.get('/sprints/:id', handle(async (req) => present.sprint(await sprints.get(req.actor, req.params.id))));
  router.patch('/sprints/:id', handle(async (req) => present.sprint(await sprints.update(req.actor, req.params.id, req.body || {}))));
  router.post('/sprints/:id/start', handle(async (req) => present.sprint(await sprints.start(req.actor, req.params.id, req.body || {}))));
  router.post('/sprints/:id/complete', handle(async (req) => {
    const r = await sprints.complete(req.actor, req.params.id, { moveTo: req.body?.moveTo ?? null });
    return { sprint: present.sprint(r.sprint), moved: r.moved, movedTo: r.movedTo, newSprint: r.newSprint && present.sprint(r.newSprint) };
  }));
  router.delete('/sprints/:id', handle((req) => sprints.remove(req.actor, req.params.id)));

  router.get('/versions', handle(async (req) => (await versions.list(req.actor, req.query)).map(present.version)));
  router.post('/versions', handle(async (req, res) => created(res, present.version(await versions.create(req.actor, req.body || {})))));
  router.get('/versions/:id', handle(async (req) => {
    const v = await versions.get(req.actor, req.params.id);
    return { ...present.version(v), issues: v.issues.map((i) => issue(i)) };
  }));
  router.patch('/versions/:id', handle(async (req) => present.version(await versions.update(req.actor, req.params.id, req.body || {}))));
  router.post('/versions/:id/release', handle(async (req) => {
    const r = await versions.release(req.actor, req.params.id, req.body || {});
    return { version: present.version(r.version), moved: r.moved };
  }));
  router.delete('/versions/:id', handle((req) => versions.remove(req.actor, req.params.id, req.body?.moveTo ?? req.query.moveTo)));
};
