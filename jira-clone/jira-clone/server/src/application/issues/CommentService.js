'use strict';

const { mentionedUserIds, MAX_DESCRIPTION } = require('../../domain/issue');
const { bad, notFound } = require('../../shared/errors');

const snippet = (body) => (body.length > 80 ? `${body.slice(0, 80)}…` : body);

class CommentService {
  constructor({ db, bus, guard, commentRepo, issueRepo, userRepo, notifications }) {
    Object.assign(this, { db, bus, guard, comments: commentRepo, issues: issueRepo, users: userRepo, notifications });
  }

  static cleanBody(value) {
    const body = String(value || '').trim();
    if (!body) throw bad('Comment cannot be empty.');
    if (body.length > MAX_DESCRIPTION) throw bad('Comment is too long.');
    return body;
  }

  async add(actor, key, rawBody) {
    const issue = await this.guard.load(actor, key, 'ADD_COMMENTS');
    const body = CommentService.cleanBody(rawBody);
    return this.db.tx(async () => {
      const comment = await this.comments.insert({ issueId: issue.id, authorId: actor.id, body });
      await this.issues.touch(issue.id);
      await this.issues.watch(issue.id, actor.id);
      const mentions = mentionedUserIds(body, await this.users.activeNames());
      if (mentions.length) {
        await this.notifications.notify({ issue, actorId: actor.id, type: 'mention', message: `mentioned you on ${issue.key}: “${snippet(body)}”`, only: mentions });
      }
      const followers = [...(await this.issues.watcherIds(issue.id)), issue.assignee_id, issue.reporter_id].filter((id) => !mentions.includes(id));
      await this.notifications.notify({ issue, actorId: actor.id, type: 'comment', message: `commented on ${issue.key}: “${snippet(body)}”`, only: followers });
      await this.bus.publish('comment_created', { key: issue.key, commentId: comment.id, body, actorId: actor.id });
      return comment;
    });
  }

  /** Own comments need ADD_COMMENTS, other people's need DELETE_ALL_COMMENTS. */
  async editable(actor, id) {
    const comment = await this.comments.find(id);
    if (!comment) throw notFound('Comment not found.');
    await this.guard.loadById(actor, comment.issue_id, comment.author_id === actor.id ? 'ADD_COMMENTS' : 'DELETE_ALL_COMMENTS');
    return comment;
  }

  async update(actor, id, rawBody) {
    const comment = await this.editable(actor, id);
    return this.comments.update(comment.id, CommentService.cleanBody(rawBody));
  }

  async remove(actor, id) {
    const comment = await this.editable(actor, id);
    await this.comments.delete(comment.id);
    return { ok: true };
  }
}

module.exports = { CommentService };
