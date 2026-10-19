'use strict';

const { LINK_TYPES } = require('../../domain/issue');
const { bad, conflict, notFound } = require('../../shared/errors');

class LinkService {
  constructor({ db, access, guard, linkRepo, issueRepo }) {
    Object.assign(this, { db, access, guard, links: linkRepo, issues: issueRepo });
  }

  async create(actor, key, { type, targetKey, direction = 'outward' } = {}) {
    const issue = await this.guard.load(actor, key, 'LINK_ISSUES');
    if (!LINK_TYPES[type]) throw bad(`Link type must be one of: ${Object.keys(LINK_TYPES).join(', ')}.`);
    const target = await this.issues.findByKey(targetKey || '');
    if (!target || !(await this.access.can(actor, target.project_key, 'BROWSE_PROJECT'))) throw bad(`Work item ${targetKey} not found.`);
    if (target.id === issue.id) throw bad('A work item cannot be linked to itself.');
    const inward = direction === 'inward';
    const [source, destination] = inward ? [target, issue] : [issue, target];
    if (await this.links.exists(source.id, destination.id, type)) throw conflict('These work items are already linked that way.');
    return this.db.tx(async () => {
      const id = await this.links.insert({ sourceId: source.id, targetId: destination.id, type, createdBy: actor.id });
      await this.issues.addHistory({ issueId: issue.id, authorId: actor.id, field: 'link', to: `${LINK_TYPES[type][inward ? 'inward' : 'outward']} ${target.key}` });
      await this.issues.addHistory({ issueId: target.id, authorId: actor.id, field: 'link', to: `${LINK_TYPES[type][inward ? 'outward' : 'inward']} ${issue.key}` });
      return { id };
    });
  }

  async remove(actor, id) {
    const link = await this.links.find(id);
    if (!link) throw notFound('Link not found.');
    await this.guard.load(actor, link.source_key, 'LINK_ISSUES');
    await this.db.tx(async () => {
      await this.links.delete(link.id);
      await this.issues.addHistory({ issueId: link.source_id, authorId: actor.id, field: 'link', from: `${LINK_TYPES[link.type]?.outward || link.type} ${link.target_key}` });
      await this.issues.addHistory({ issueId: link.target_id, authorId: actor.id, field: 'link', from: `${LINK_TYPES[link.type]?.inward || link.type} ${link.source_key}` });
    });
    return { ok: true };
  }
}

module.exports = { LinkService };
