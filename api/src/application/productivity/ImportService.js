'use strict';

const { bad } = require('../../shared/errors');
const { parseCsv } = require('../../shared/csv');

const MAX_ROWS = 500;
/** CSV header (lower case) → create-issue body field. Jira export headers are accepted. */
const COLUMNS = {
  summary: 'summary', 'issue type': 'type', issuetype: 'type', type: 'type', 'work type': 'type', priority: 'priority', status: 'status',
  assignee: 'assignee', reporter: 'reporter', labels: 'labels', label: 'labels', 'story points': 'storyPoints', 'story point estimate': 'storyPoints',
  'due date': 'dueDate', duedate: 'dueDate', 'start date': 'startDate', description: 'description', sprint: 'sprint',
  'fix version': 'fixVersion', 'fix versions': 'fixVersion', 'fix version/s': 'fixVersion', component: 'components', components: 'components', 'component/s': 'components',
  'original estimate': 'originalEstimate', 'remaining estimate': 'remainingEstimate', parent: 'parentKey', 'parent key': 'parentKey', 'parent id': 'parentKey',
};
const TYPE_ALIASES = { 'sub-task': 'Subtask', subtask: 'Subtask' };

function normalDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`“${value}” isn’t a date (use yyyy-MM-dd).`);
  return d.toISOString().slice(0, 10);
}

/** CSV import of work items: dry run (validation + preview) or create everything in one transaction. */
class ImportService {
  constructor({ db, access, audit, catalog, resolver, userRepo, issueService }) {
    Object.assign(this, { db, access, audit, catalog, resolver, issueService, users: userRepo });
  }

  async userResolver() {
    const people = (await this.users.listAll()).filter((u) => u.active && !u.bot);
    return (value) => {
      const v = value.toLowerCase();
      const user = people.find((u) => u.email.toLowerCase() === v || u.name.toLowerCase() === v || u.id === value);
      if (!user) throw new Error(`No active user matches “${value}”.`);
      return user.id;
    };
  }

  async rowToBody(project, mapping, cells, findUser) {
    const body = { projectKey: project.key };
    const snapshot = await this.catalog.snapshot();
    for (const [i, field] of mapping.entries()) {
      const value = String(cells[i] ?? '').trim();
      if (!field || value === '') continue;
      switch (field) {
        case 'assignee': body.assigneeId = findUser(value); break;
        case 'reporter': body.reporterId = findUser(value); break;
        case 'labels': body.labels = value.split(/[\s,;]+/).filter(Boolean); break;
        case 'components': body.components = value.split(/[;,]/).map((x) => x.trim()).filter(Boolean); break;
        case 'dueDate':
        case 'startDate': body[field] = normalDate(value); break;
        case 'type': body.type = TYPE_ALIASES[value.toLowerCase()] || (snapshot.types.find((t) => t.name.toLowerCase() === value.toLowerCase())?.name ?? value); break;
        case 'priority':
        case 'status': {
          const list = field === 'priority' ? snapshot.priorities : snapshot.statuses;
          const hit = list.find((x) => x.name.toLowerCase() === value.toLowerCase());
          if (!hit) throw new Error(`Unknown ${field} “${value}”.`);
          body[field] = hit.name;
          break;
        }
        default: body[field] = value;
      }
    }
    return body;
  }

  async run(actor, projectKey, { csv, dryRun = false } = {}) {
    const project = await this.access.assert(actor, String(projectKey || '').toUpperCase(), 'CREATE_ISSUES');
    if (!csv || !String(csv).trim()) throw bad('Paste or upload a CSV file.');
    let rows;
    try { rows = parseCsv(csv); } catch (err) { throw bad(err.message); }
    if (rows.length < 2) throw bad('The CSV needs a header row and at least one work item.');
    if (rows.length > MAX_ROWS + 1) throw bad(`You can import at most ${MAX_ROWS} work items at once.`);
    const header = rows[0].map((h) => h.trim());
    const mapping = header.map((h) => COLUMNS[h.toLowerCase()] || null);
    if (!mapping.includes('summary')) throw bad('The CSV must have a “Summary” column.');
    const columns = header.map((h, i) => ({ header: h, field: mapping[i] }));

    const findUser = await this.userResolver();
    const items = [];
    const errors = [];
    for (const [idx, cells] of rows.slice(1).entries()) {
      const line = idx + 2;
      try {
        const body = await this.rowToBody(project, mapping, cells, findUser);
        await this.resolver.resolve({ type: 'Task', ...body }, { project }); // validates without writing
        items.push({ line, body });
      } catch (err) {
        errors.push({ line, error: err.message });
      }
    }
    if (dryRun) {
      const preview = items.slice(0, 20).map(({ line, body }) => ({
        line, summary: body.summary, type: body.type || 'Task', status: body.status || 'To Do', priority: body.priority || 'Medium', assigneeId: body.assigneeId || null, labels: body.labels || [],
      }));
      return { dryRun: true, total: rows.length - 1, valid: items.length, errors, columns, preview };
    }
    if (errors.length) throw bad(`Fix ${errors.length} row${errors.length > 1 ? 's' : ''} before importing.`, { errors, columns });
    const created = await this.db.tx(async () => {
      const keys = [];
      for (const { body } of items) keys.push((await this.issueService.createInProject(actor, project, body)).key);
      return keys;
    });
    await this.audit.record(actor, 'issues.imported', { project: project.key, target: `${created.length} work items`, details: { first: created[0], last: created[created.length - 1] } });
    return { created, count: created.length, columns };
  }
}

module.exports = { ImportService };
