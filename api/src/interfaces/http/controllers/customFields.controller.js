'use strict';

const { handle, created } = require('../handler');
const { customField } = require('../presenters/workspace');

/** Site-wide custom field administration. */
module.exports = function customFieldsController(router, { services }) {
  const { customFields } = services;

  router.get('/custom-fields', handle(async () => ({ types: customFields.constructor.TYPES, fields: (await customFields.list()).map(customField) })));
  router.get('/custom-fields/:id', handle(async (req) => customField(await customFields.get(req.params.id))));
  router.post('/custom-fields', handle(async (req, res) => created(res, customField(await customFields.create(req.actor, req.body || {})))));
  router.patch('/custom-fields/:id', handle(async (req) => customField(await customFields.update(req.actor, req.params.id, req.body || {}))));
  router.delete('/custom-fields/:id', handle((req) => customFields.remove(req.actor, req.params.id)));
};
