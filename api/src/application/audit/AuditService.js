'use strict';

const { forbidden } = require('../../shared/errors');
const { clampInt } = require('../../shared/validation');

/** Records administrative changes and serves the (Premium) audit log. */
class AuditService {
  constructor({ auditRepo }) {
    this.repo = auditRepo;
    this.access = null; // set by the container (circular: access control → billing → audit)
    this.billing = null;
  }

  record(actor, action, { project = null, target = null, details = {} } = {}) {
    return this.repo.insert({ actorId: actor?.user?.id || actor?.id || null, action, projectKey: project, target, details });
  }

  async list(actor, query) {
    const project = query.project ? String(query.project).toUpperCase() : null;
    if (project) await this.access.assert(actor, project, 'ADMINISTER_PROJECT');
    else if (!actor.isSiteAdmin) throw forbidden('Only site administrators can see the global audit log.');
    await this.billing.assertFeature('audit_log');
    return this.repo.list({
      projectKey: project,
      actionPrefix: query.action ? String(query.action) : null,
      actorId: query.actor ? String(query.actor) : null,
      limit: clampInt(query.limit, 100, 1, 500),
    });
  }
}

module.exports = { AuditService };
