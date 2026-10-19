'use strict';

const crypto = require('crypto');
const { bad, notFound } = require('../../shared/errors');

const KINDS = ['branch', 'commit', 'pr'];
const PR_STATUSES = ['open', 'merged', 'declined'];
const ISSUE_KEY_RE = /\b[A-Z][A-Z0-9]+-\d+\b/g;

/** Development panel: branches, commits and pull requests linked to work items. */
class DevelopmentService {
  constructor({ db, access, guard, developmentRepo, issueRepo, userRepo, issueService }) {
    Object.assign(this, { db, access, guard, dev: developmentRepo, issues: issueRepo, users: userRepo, issueService });
  }

  async add(actor, key, { kind, repo, name, ref, status } = {}) {
    const issue = await this.guard.load(actor, key, 'EDIT_ISSUES');
    if (!KINDS.includes(kind)) throw bad('kind must be branch, commit or pr.');
    if (!repo || !name) throw bad('repo and name are required.');
    const repoName = String(repo).slice(0, 100);
    let itemRef = ref ? String(ref).slice(0, 100) : null;
    if (kind === 'pr' && !itemRef) itemRef = await this.dev.nextPullRequestNumber(repoName);
    if (kind === 'commit' && !itemRef) itemRef = crypto.randomBytes(4).toString('hex').slice(0, 7);
    const itemStatus = kind === 'pr' ? (PR_STATUSES.includes(status) ? status : 'open') : kind === 'branch' ? 'active' : null;
    return this.dev.insert({ issue_id: issue.id, kind, repo: repoName, name: String(name).slice(0, 255), ref: itemRef, status: itemStatus, author_id: actor.id });
  }

  async list(actor, filters) {
    const rows = await this.dev.listAll(filters);
    const visible = [];
    for (const row of rows) if (!row.key || (await this.access.can(actor, row.project_key, 'BROWSE_PROJECT'))) visible.push(row);
    return visible;
  }

  /** PATCH /dev/:id { status, transition } – merging a PR can move the work item to its done status. */
  async setStatus(actor, id, { status, transition } = {}) {
    const item = await this.dev.find(id);
    if (!item) throw notFound('Item not found.');
    if (item.key) await this.guard.load(actor, item.key, 'EDIT_ISSUES');
    if (item.key && transition) await this.guard.load(actor, item.key, 'TRANSITION_ISSUES');
    if (item.kind !== 'pr') throw bad('Only pull requests have a status.');
    if (!PR_STATUSES.includes(status)) throw bad('Status must be open, merged or declined.');
    await this.db.tx(async () => {
      await this.dev.setStatus(item.id, status);
      if (status === 'merged' && item.key && transition) {
        const { transitions } = await this.issueService.transitions(actor, item.key);
        const done = transitions.find((t) => t.to.category === 'done');
        if (done) await this.issueService.update(actor, item.key, { status: done.to.name });
      }
    });
    return this.dev.find(item.id);
  }

  async remove(actor, id) {
    const item = await this.dev.find(id);
    if (!item) throw notFound('Item not found.');
    if (item.key) await this.guard.load(actor, item.key, 'EDIT_ISSUES');
    await this.dev.delete(item.id);
    return { ok: true };
  }

  /** CI webhook: { repo, commits: [{ id, message, authorEmail }] } – every issue key in a message links the commit. */
  async ingestCommits(actor, { repo, commits } = {}) {
    if (!repo || !Array.isArray(commits)) throw bad('repo and commits[] are required.');
    let linked = 0;
    await this.db.tx(async () => {
      for (const commit of commits.slice(0, 200)) {
        const message = String(commit.message || '').split('\n')[0].slice(0, 255);
        const author = commit.authorEmail ? (await this.users.findByEmail(commit.authorEmail))?.id ?? null : actor.id;
        for (const key of new Set(message.match(ISSUE_KEY_RE) || [])) {
          const issue = await this.issues.findByKey(key);
          if (!issue || !(await this.access.can(actor, issue.project_key, 'EDIT_ISSUES'))) continue;
          await this.dev.insert({ issue_id: issue.id, kind: 'commit', repo: String(repo).slice(0, 100), name: message, ref: String(commit.id || '').slice(0, 40) || null, status: null, author_id: author });
          linked += 1;
        }
      }
    });
    return { ok: true, linked };
  }
}

module.exports = { DevelopmentService };
