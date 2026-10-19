'use strict';

const { bad, notFound, forbidden } = require('../../shared/errors');

class FilterService {
  constructor({ filterRepo, issueQuery }) {
    this.filters = filterRepo;
    this.issueQuery = issueQuery;
  }

  async validJql(actor, jql) {
    const text = String(jql || '').trim();
    if (!text) throw bad('JQL is required.');
    await this.issueQuery.compile(actor, text); // throws JqlError (400) when invalid
    return text;
  }

  list() {
    return this.filters.list();
  }

  async require(id) {
    const filter = await this.filters.find(id);
    if (!filter) throw notFound('Filter not found.');
    return filter;
  }

  async get(id) {
    return this.require(id);
  }

  assertOwner(actor, filter) {
    if (filter.owner_id !== actor.id && !actor.isSiteAdmin) throw forbidden('Only the owner can change this filter.');
  }

  async create(actor, body = {}) {
    const name = String(body.name || '').trim();
    if (!name) throw bad('Filter name is required.');
    const jql = await this.validJql(actor, body.jql);
    if (await this.filters.nameTaken(actor.id, name)) throw bad('You already have a filter with that name.');
    return this.filters.insert({ name: name.slice(0, 100), description: String(body.description || '').slice(0, 500), jql, owner_id: actor.id, starred: Boolean(body.starred) });
  }

  async update(actor, id, body = {}) {
    const filter = await this.require(id);
    const fields = {};
    if (body.starred !== undefined) fields.starred = Boolean(body.starred); // anyone can star
    if (body.name !== undefined || body.jql !== undefined || body.description !== undefined) {
      this.assertOwner(actor, filter);
      if (body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) throw bad('Filter name is required.');
        if (await this.filters.nameTaken(filter.owner_id, name, filter.id)) throw bad('You already have a filter with that name.');
        fields.name = name.slice(0, 100);
      }
      if (body.jql !== undefined) fields.jql = await this.validJql(actor, body.jql);
      if (body.description !== undefined) fields.description = String(body.description || '').slice(0, 500);
    }
    return Object.keys(fields).length ? this.filters.update(filter.id, fields) : filter;
  }

  async remove(actor, id) {
    const filter = await this.require(id);
    this.assertOwner(actor, filter);
    await this.filters.delete(filter.id);
    return { ok: true };
  }
}

module.exports = { FilterService };
