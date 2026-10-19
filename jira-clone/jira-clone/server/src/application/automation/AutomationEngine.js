'use strict';

const AU = require('../../domain/automation');
const { Actor } = require('../Actor');

const snippet = (text) => (text.length > 80 ? `${text.slice(0, 80)}…` : text);

/**
 * Executes automation rules. Subscribes to domain events (issue created /
 * updated, comment created) and runs matching enabled rules of the project as
 * the automation bot. Every execution is recorded in automation_runs; the plan's
 * monthly limit throttles executions. Changes made by the bot never trigger
 * rules, so rules cannot loop.
 */
class AutomationEngine {
  constructor({ db, bus, billing, catalog, automationRepo, issueRepo, userRepo, projectRepo, commentRepo, resolver, issueService, issueQuery, notifications, logger = console }) {
    Object.assign(this, {
      db, bus, billing, catalog, resolver, issueService, issueQuery, notifications, logger,
      repo: automationRepo, issues: issueRepo, users: userRepo, projects: projectRepo, comments: commentRepo,
    });
    this.botActor = null;
  }

  start() {
    this.bus.subscribe((event, data) => this.onEvent(event, data));
    return this;
  }

  async bot() {
    if (!this.botActor) this.botActor = new Actor(await this.users.findById(AU.BOT_ID));
    return this.botActor;
  }

  async onEvent(event, data) {
    if (!['issue_created', 'issue_updated', 'comment_created'].includes(event)) return;
    if (data.actorId === AU.BOT_ID) return; // automation never triggers automation
    const issue = await this.issues.findByKey(data.key);
    if (!issue) return;
    const payload = { ...data, after: issue };
    for (const rule of await this.repo.enabledRules(issue.project_key)) {
      if (AU.triggerMatches(rule.trigger, event, payload)) await this.execute(rule, issue.key, data.actorId);
    }
  }

  /** Monthly usage against the plan limit. */
  async usage() {
    const plan = await this.billing.plan();
    const used = await this.repo.countRunsSince(AU.monthStart(), AU.BILLABLE_STATUSES);
    const reset = new Date(AU.monthStart());
    reset.setUTCMonth(reset.getUTCMonth() + 1);
    return { used, limit: plan.automationRuns ?? null, plan: plan.key, resetsAt: reset.toISOString() };
  }

  async conditionMatches(rule, issue, initiatorId) {
    if (!rule.condition) return true;
    const { where } = await this.issueQuery.compile({ id: initiatorId }, rule.condition);
    return this.issues.matches(issue.id, where);
  }

  /** Runs one rule for one work item and records the run. Never throws. */
  async execute(rule, key, initiatorId) {
    const started = Date.now();
    const record = async (status, message, results = []) => {
      await this.repo.recordRun({ ruleId: rule.id, issueKey: key, status, message, actions: results, durationMs: Date.now() - started });
      return { status, message, results };
    };
    const issue = await this.issues.findByKey(key);
    if (!issue) return record('failure', 'The work item no longer exists.');
    try {
      if (!(await this.conditionMatches(rule, issue, initiatorId))) return record('no_actions', 'The work item didn’t match the rule’s condition.');
    } catch (err) {
      return record('failure', `Condition error: ${err.message}`);
    }
    const usage = await this.usage();
    if (usage.limit !== null && usage.used >= usage.limit) return record('throttled', `Monthly limit of ${usage.limit} rule runs reached on the ${usage.plan} plan.`);

    const results = [];
    for (const action of rule.actions) {
      try {
        const detail = await this.db.tx(() => this.perform(action, key, initiatorId));
        results.push({ type: action.type, ok: true, detail });
      } catch (err) {
        results.push({ type: action.type, ok: false, detail: err.message });
      }
    }
    return record(AU.runStatus(results), AU.runMessage(results), results);
  }

  /** Applies a field change as the bot; returns true when something changed. */
  async apply(record, body) {
    const project = await this.projects.findByKey(record.project_key);
    const resolved = await this.resolver.resolve(body, { existing: record, project });
    const changed = await this.issueService.applyChanges(await this.bot(), record, resolved);
    return changed.length > 0;
  }

  async assigneeFor(target, record, initiatorId) {
    switch (target) {
      case 'unassigned': return null;
      case 'reporter': return record.reporter_id;
      case 'initiator': return initiatorId === AU.BOT_ID ? null : initiatorId;
      case 'lead': return (await this.projects.findByKey(record.project_key))?.lead_id || null;
      case 'balanced': return this.repo.balancedAssignee(record.project_key);
      default: return target;
    }
  }

  async perform(action, key, initiatorId) {
    const record = await this.issues.findByKey(key);
    if (!record) throw new Error('The work item no longer exists.');
    switch (action.type) {
      case 'assign': {
        const to = await this.assigneeFor(action.to, record, initiatorId);
        if (to && !(await this.users.isActive(to))) throw new Error('That person is no longer active.');
        const changed = await this.apply(record, { assigneeId: to });
        return `${changed ? 'Assigned to' : 'Already assigned to'} ${to ? await this.users.nameOf(to) : 'nobody'}`;
      }
      case 'transition':
        return (await this.apply(record, { status: action.status })) ? `Transitioned to ${action.status}` : `Already in ${action.status}`;
      case 'set_priority':
        return (await this.apply(record, { priority: action.priority })) ? `Priority set to ${action.priority}` : `Priority already ${action.priority}`;
      case 'set_story_points':
        return (await this.apply(record, { storyPoints: action.value })) ? `Story points set to ${action.value ?? 'none'}` : 'Story points unchanged';
      case 'add_label': {
        if (record.labels.includes(action.label)) return `Label ${action.label} already present`;
        await this.apply(record, { labels: [...record.labels, action.label] });
        return `Added label ${action.label}`;
      }
      case 'add_watcher': {
        const userId = { reporter: record.reporter_id, assignee: record.assignee_id, initiator: initiatorId }[action.userId] ?? action.userId;
        if (!userId || userId === AU.BOT_ID) return 'Nobody to add';
        await this.issues.watch(record.id, userId);
        return `Added ${(await this.users.nameOf(userId)) || userId} as a watcher`;
      }
      case 'comment': {
        const names = await this.users.namesByIds([record.assignee_id, record.reporter_id, initiatorId].filter(Boolean));
        const body = AU.renderSmartValues(action.body, {
          issue: record,
          names: { assignee: names[record.assignee_id], reporter: names[record.reporter_id] },
          initiatorName: names[initiatorId] || '',
        });
        const comment = await this.comments.insert({ issueId: record.id, authorId: AU.BOT_ID, body });
        await this.issues.touch(record.id);
        await this.notifications.notify({ issue: record, actorId: AU.BOT_ID, type: 'comment', message: `commented on ${record.key}: “${snippet(body)}”` });
        await this.bus.publish('comment_created', { key: record.key, commentId: comment.id, body, actorId: AU.BOT_ID });
        return 'Comment added';
      }
      default:
        throw new Error('Unknown action.');
    }
  }
}

module.exports = { AutomationEngine };
