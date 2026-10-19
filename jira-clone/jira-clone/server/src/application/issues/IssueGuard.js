'use strict';

const { notFound } = require('../../shared/errors');

/** Loads a work item the actor can see (404 otherwise) and checks an optional project permission. */
class IssueGuard {
  constructor({ access, issueRepo }) {
    this.access = access;
    this.issues = issueRepo;
  }

  async load(actor, key, permission = null) {
    return this.check(actor, await this.issues.findByKey(key), key, permission);
  }

  async loadById(actor, id, permission = null) {
    return this.check(actor, await this.issues.findById(id), id, permission);
  }

  async check(actor, record, ref, permission) {
    if (!record || !(await this.access.can(actor, record.project_key, 'BROWSE_PROJECT'))) {
      throw notFound(`Work item ${ref} does not exist or you don’t have permission to see it.`);
    }
    if (permission) await this.access.assert(actor, record.project_key, permission);
    return record;
  }

  /** Which permissions a change needs: status/resolution → transition, assignee → assign, anything else → edit. */
  static permissionsFor(changes) {
    const needed = new Set();
    for (const key of Object.keys(changes || {})) {
      if (key === 'status' || key === 'resolution') needed.add('TRANSITION_ISSUES');
      else if (key === 'assigneeId') needed.add('ASSIGN_ISSUES');
      else needed.add('EDIT_ISSUES');
    }
    return [...needed];
  }
}

module.exports = { IssueGuard };
