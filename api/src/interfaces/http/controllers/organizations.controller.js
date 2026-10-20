'use strict';

const { handle, created } = require('../handler');

module.exports = function organizationsController(router, { services }) {
  const { organizations } = services;

  router.get('/organizations', handle((req) => organizations.listMyOrganizations(req.actor)));
  router.get('/organizations/current', handle((req) => organizations.getCurrent(req.actor)));
  router.post('/organizations', handle(async (req, res) => created(res, await organizations.create(req.actor, req.body || {}))));
  router.post('/organizations/switch', handle((req) => organizations.switch(req.actor, req.body?.orgId)));

  router.get('/organizations/:orgId/members', handle((req) => organizations.listMembers(req.actor, req.params.orgId)));
  router.post('/organizations/:orgId/members', handle(async (req, res) => created(res, await organizations.addMember(req.actor, req.params.orgId, req.body || {}))));

  router.get('/organizations/:orgId/workspaces', handle((req) => organizations.listWorkspaces(req.actor, req.params.orgId)));
  router.post('/organizations/:orgId/workspaces', handle(async (req, res) => created(res, await organizations.createWorkspace(req.actor, req.params.orgId, req.body || {}))));
};
