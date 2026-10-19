'use strict';

const { bad } = require('../../shared/errors');

/** Votes on work items (not by the reporter, not on done work). */
class VoteService {
  constructor({ guard, voteRepo }) {
    Object.assign(this, { guard, repo: voteRepo });
  }

  async summary(actorId, issueId) {
    const voters = await this.repo.voters(issueId);
    return { votes: voters.length, hasVoted: voters.some((v) => v.user_id === actorId), voters: voters.map((v) => ({ userId: v.user_id, at: v.created_at })) };
  }

  async get(actor, key) {
    const record = await this.guard.load(actor, key);
    return this.summary(actor.id, record.id);
  }

  async vote(actor, key) {
    const record = await this.guard.load(actor, key);
    if (record.reporter_id === actor.id) throw bad('You can’t vote for a work item you reported.');
    if (record.status_category === 'done') throw bad('You can’t vote for a work item that’s already done.');
    await this.repo.vote(record.id, actor.id);
    const { votes, hasVoted } = await this.summary(actor.id, record.id);
    return { votes, hasVoted };
  }

  async unvote(actor, key) {
    const record = await this.guard.load(actor, key);
    await this.repo.unvote(record.id, actor.id);
    const { votes, hasVoted } = await this.summary(actor.id, record.id);
    return { votes, hasVoted };
  }
}

module.exports = { VoteService };
