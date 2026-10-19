'use strict';

/**
 * In-process domain event bus. Events published inside a transaction are
 * delivered after it commits. Listeners run sequentially and are awaited, so
 * automation results are part of the same request (and its live-update
 * broadcast); a failing listener is logged and never breaks the publisher.
 *
 * Events: issue_created, issue_updated, issue_deleted, comment_created,
 *         worklog_created, worklog_updated, worklog_deleted, sprint_started, sprint_closed,
 *         version_released …
 */
class EventBus {
  constructor({ db, logger = console }) {
    this.db = db;
    this.logger = logger;
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  publish(event, data) {
    return this.db.afterCommit(() => this.dispatch(event, data));
  }

  async dispatch(event, data) {
    for (const listener of this.listeners) {
      try {
        await listener(event, data);
      } catch (err) {
        this.logger.error('event listener failed', event, err);
      }
    }
  }
}

module.exports = { EventBus };
