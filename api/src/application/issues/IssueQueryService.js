'use strict';

const { clampInt } = require('../../shared/validation');

const DEFAULT_JQL = 'project = KAN ORDER BY cf[10019] ASC';
const MAX_RESULTS = 1000;

/** Read-side use cases: JQL search and the full issue detail view. */
class IssueQueryService {
  constructor({ jql, access, guard, issueRepo, commentRepo, linkRepo, attachmentRepo, developmentRepo, worklogRepo, voteRepo, goalRepo, customFields }) {
    Object.assign(this, {
      jql, access, guard, customFields,
      issues: issueRepo, comments: commentRepo, links: linkRepo, attachments: attachmentRepo,
      development: developmentRepo, worklogs: worklogRepo, votes: voteRepo, goals: goalRepo,
    });
  }

  /** Compiles JQL for an actor (currentUser(), custom fields). */
  async compile(actor, jql) {
    return this.jql.compile(jql, { currentUserId: actor.id, customFields: await this.customFields.definitions() });
  }

  async search(actor, { jql, startAt, maxResults, withCustomFields = false } = {}) {
    const query = jql ?? DEFAULT_JQL;
    const offset = clampInt(startAt, 0, 0, Number.MAX_SAFE_INTEGER);
    const limit = clampInt(maxResults, MAX_RESULTS, 1, MAX_RESULTS);
    const { where, orderBy, sort } = await this.compile(actor, query);
    const projectKeys = await this.access.browsableKeys(actor);
    const { total, rows } = await this.issues.search({ where, orderBy, projectKeys, limit, offset });
    const customValues = withCustomFields ? await this.customFields.valuesFor(rows.map((r) => r.id)) : null;
    return { jql: query, startAt: offset, maxResults: limit, total, sort, rows, customValues };
  }

  /** All issues matching JQL that the actor can see (no paging) – used by reports, exports and gadgets. */
  async all(actor, jql) {
    const { where, orderBy } = await this.compile(actor, jql);
    const projectKeys = await this.access.browsableKeys(actor);
    return (await this.issues.search({ where, orderBy, projectKeys, limit: 100000, offset: 0 })).rows;
  }

  async detail(actor, key) {
    const record = await this.guard.load(actor, key);
    const id = record.id;
    const [children, comments, history, watchers, links, attachments, development, goals, worklogs, voters, customFields, permissions] = await Promise.all([
      this.issues.children(id), this.comments.list(id), this.issues.history(id), this.issues.watcherIds(id),
      this.links.forIssue(id), this.attachments.list(id), this.development.list(id), this.goals.forIssue(id),
      this.worklogs.list(id), this.votes.voterIds(id), this.customFields.valuesOf(record),
      this.access.describe(actor, record.project_key),
    ]);
    const visibleLinks = [];
    for (const link of links) if (await this.access.can(actor, link.project_key, 'BROWSE_PROJECT')) visibleLinks.push(link);
    return {
      record, children, comments, history, watchers, links: visibleLinks, attachments, development, goals, worklogs, voters, customFields,
      permissions: permissions.permissions, viewerId: actor.id,
    };
  }
}

module.exports = { IssueQueryService, DEFAULT_JQL };
