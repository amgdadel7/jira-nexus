'use strict';

/**
 * In-app notifications. Recipients are the issue's watchers, assignee and
 * reporter (or an explicit list), minus the actor, bots, inactive users and
 * anyone who switched that notification type off in their preferences.
 */
class NotificationService {
  constructor({ notificationRepo, userRepo, issueRepo }) {
    Object.assign(this, { repo: notificationRepo, users: userRepo, issues: issueRepo });
  }

  async notify({ issue, actorId, type, message, only = null, extra = [] }) {
    const candidates = only || [...(await this.issues.watcherIds(issue.id)), issue.assignee_id, issue.reporter_id, ...extra];
    const ids = [...new Set(candidates)].filter((id) => id && id !== actorId);
    const recipients = await this.users.notifiableIds(ids, type);
    await this.repo.insertMany(recipients.map((userId) => ({ userId, actorId, issueId: issue.id, type, message })));
  }

  list(actor, limit) {
    return this.repo.list(actor.id, limit);
  }

  unreadCount(actor) {
    return this.repo.unreadCount(actor.id);
  }

  markRead(actor, id = null) {
    return this.repo.markRead(actor.id, id);
  }
}

module.exports = { NotificationService };
