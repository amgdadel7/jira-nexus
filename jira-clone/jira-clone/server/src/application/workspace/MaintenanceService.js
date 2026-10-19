'use strict';

const { forbidden } = require('../../shared/errors');

/** Site maintenance: reset the workspace to the demo data. The seeder is injected (infrastructure). */
class MaintenanceService {
  constructor({ demoSeeder, userRepo, auth, logger = console }) {
    Object.assign(this, { demoSeeder, users: userRepo, auth, logger });
  }

  /** Re-seeds everything and returns a fresh session so the caller stays logged in. */
  async reset(actor, { userAgent } = {}) {
    if (!actor.isSiteAdmin) throw forbidden('Only site administrators can reset the workspace.');
    if (!this.demoSeeder) throw forbidden('Resetting is not available on this server.');
    await this.demoSeeder();
    const userId = (await this.users.findById(actor.id)) ? actor.id : 'u1';
    this.logger.info(`[maintenance] workspace reset by ${actor.id}`);
    return this.auth.createSession(userId, { userAgent });
  }
}

module.exports = { MaintenanceService };
