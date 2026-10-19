'use strict';

/**
 * Compiles a JQL AST (domain/jql/parser) into parameterised PostgreSQL over
 * `issue_view i`. Returns { where: Sql, orderBy: Sql, sort }.
 */

const { sql } = require('../database/sql');
const { parse, JqlError } = require('../../domain/jql/parser');
const { relativeDate, evaluateFunction, LIST_FUNCTIONS } = require('../../domain/jql/functions');
const { parseDuration } = require('../../domain/duration');

const raw = sql.raw;
const COMPARISON = ['=', '!=', '>', '>=', '<', '<='];
const sqlOp = (op) => raw(op === '!=' ? '<>' : op);

/* Field catalogue. `col` is an SQL expression over issue_view i. */
const F = (kind, col, extra = {}) => ({ kind, col: col && raw(col), ...extra });
const FIELDS = {
  project: F('project', 'i.project_key'),
  key: F('key', 'i.num'), issuekey: F('key', 'i.num'), id: F('key', 'i.num'),
  summary: F('text', 'i.summary'),
  description: F('text', 'i.description'),
  text: F('text', "(i.summary || ' ' || i.description || ' ' || i.key)"),
  status: F('str', 'i.status'),
  statuscategory: F('str', "(CASE i.status_category WHEN 'todo' THEN 'To Do' WHEN 'done' THEN 'Done' ELSE 'In Progress' END)"),
  type: F('str', 'i.type'), issuetype: F('str', 'i.type'),
  priority: F('str', 'i.priority', { ordered: { position: 'i.priority_order', table: 'priorities' } }),
  resolution: F('str', 'i.resolution'),
  assignee: F('user', 'i.assignee_id'),
  reporter: F('user', 'i.reporter_id'),
  labels: F('labels', 'i.labels'), label: F('labels', 'i.labels'),
  created: F('timestamp', 'i.created_at'), createddate: F('timestamp', 'i.created_at'),
  updated: F('timestamp', 'i.updated_at'), updateddate: F('timestamp', 'i.updated_at'),
  resolved: F('timestamp', 'i.resolved_at'), resolutiondate: F('timestamp', 'i.resolved_at'),
  duedate: F('date', 'i.due_date'), due: F('date', 'i.due_date'),
  startdate: F('date', 'i.start_date'),
  parent: F('parent', 'i.parent_id'),
  sprint: F('str', 'i.sprint', { listFunctions: LIST_FUNCTIONS.sprint, stateCol: 'i.sprint_state' }),
  component: F('components', 'i.components'), components: F('components', 'i.components'),
  team: F('team', 'i.team_id'),
  fixversion: F('str', 'i.fix_version', { listFunctions: LIST_FUNCTIONS.fixversion, stateCol: 'i.fix_version_status' }),
  'fix version': F('str', 'i.fix_version', { listFunctions: LIST_FUNCTIONS.fixversion, stateCol: 'i.fix_version_status' }),
  fixversions: F('str', 'i.fix_version', { listFunctions: LIST_FUNCTIONS.fixversion, stateCol: 'i.fix_version_status' }),
  'story points': F('num', 'i.story_points'), storypoints: F('num', 'i.story_points'), 'cf[10016]': F('num', 'i.story_points'),
  rank: F('num', 'i.rank'), 'cf[10019]': F('num', 'i.rank'),
  comment: F('comment', null),
  watcher: F('watcher', 'i.id'),
  attachments: F('attachments', 'i.id'),
  originalestimate: F('duration', 'i.original_estimate'), timeoriginalestimate: F('duration', 'i.original_estimate'),
  remainingestimate: F('duration', 'i.remaining_estimate'), timeestimate: F('duration', 'i.remaining_estimate'),
  timespent: F('duration', 'NULLIF(i.time_spent, 0)'),
  votes: F('num', 'i.vote_count'),
  voter: F('voter', 'i.id'),
  worklogauthor: F('worklogauthor', 'i.id'),
  worklogdate: F('worklogdate', 'i.id'),
};

const SORT_EXPRESSIONS = {
  status: 'i.status_order',
  priority: '(100 - i.priority_order)',
  assignee: '(SELECT u.name FROM users u WHERE u.id = i.assignee_id)',
  reporter: '(SELECT u.name FROM users u WHERE u.id = i.reporter_id)',
  key: ['i.project_key', 'i.num'], issuekey: ['i.project_key', 'i.num'], id: ['i.project_key', 'i.num'],
  comments: 'i.comment_count', comment: 'i.comment_count',
  parent: '(SELECT p.num FROM issues p WHERE p.id = i.parent_id)',
  labels: "NULLIF(array_to_string(i.labels, ','), '')",
  components: "NULLIF(array_to_string(i.components, ','), '')",
  team: 'i.team_name',
};

const userMatch = (v) => sql`(SELECT u.id FROM users u WHERE u.id = ${v}::text OR lower(u.name) = lower(${v}::text) OR lower(u.email) = lower(${v}::text))`;
const likePattern = (v) => `%${String(v).replace(/\*/g, '').replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const dayOnly = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function onlyOps(ops, op, message) {
  if (!ops.includes(op)) throw new JqlError(message);
}

class Compiler {
  constructor({ currentUserId = null, customFields = [], now = new Date() } = {}) {
    this.ctx = { currentUserId, now };
    this.customById = new Map(customFields.map((f) => [Number(f.id), f]));
    this.customByName = new Map(customFields.map((f) => [f.name.toLowerCase(), f]));
  }

  field(name) {
    const lower = String(name).toLowerCase();
    if (FIELDS[lower]) return FIELDS[lower];
    const cf = /^cf\[(\d+)\]$/.exec(lower);
    const custom = cf ? this.customById.get(Number(cf[1])) : this.customByName.get(lower);
    if (custom) return { kind: 'custom', custom };
    throw new JqlError(`Field '${name}' does not exist or you do not have permission to view it.`);
  }

  scalar(value) {
    if (value.kind === 'function') return evaluateFunction(value.name, this.ctx);
    return value.value;
  }

  node(n) {
    switch (n.type) {
      case 'and': return sql`(${this.node(n.left)} AND ${this.node(n.right)})`;
      case 'or': return sql`(${this.node(n.left)} OR ${this.node(n.right)})`;
      case 'not': return sql`NOT (${this.node(n.expr)})`;
      default: return this.clause(n);
    }
  }

  clause({ field: name, op, value }) {
    const f = this.field(name);
    if (op === 'is empty') return this.empty(f, false);
    if (op === 'is not empty') return this.empty(f, true);
    if (op === 'in' || op === 'not in') return this.inList(f, op === 'not in', value);
    if (value.kind === 'empty') return this.empty(f, op === '!=');
    if (value.kind === 'list') throw new JqlError(`The operator '${op}' does not accept a list.`);
    return this.single(f, op, this.scalar(value));
  }

  inList(f, negated, value) {
    if (value.kind === 'function') {
      const states = f.listFunctions && f.listFunctions[value.name];
      if (!states) throw new JqlError(`Unable to find JQL function '${value.name}()'.`);
      const q = sql`${raw(f.stateCol)} = ANY(${states}::text[])`;
      return negated ? sql`(${f.col} IS NULL OR NOT (${q}))` : q;
    }
    if (value.kind !== 'list') throw new JqlError("Expecting a list after 'IN'.");
    const parts = value.items.map((item) => (item.kind === 'empty' ? this.empty(f, false) : this.single(f, '=', this.scalar(item))));
    const q = sql`(${sql.join(parts, ' OR ')})`;
    if (!negated) return q;
    return (f.kind === 'user' || f.kind === 'parent') ? sql`(NOT ${q} OR ${f.col} IS NULL)` : sql`(NOT ${q})`;
  }

  single(f, op, v) {
    switch (f.kind) {
      case 'text':
        onlyOps(['~', '!~'], op, `The operator '${op}' is not supported by text fields. Use '~' instead.`);
        return sql`${f.col} ${raw(op === '~' ? 'ILIKE' : 'NOT ILIKE')} ${likePattern(v)}`;
      case 'project': {
        onlyOps(['=', '!='], op, `The operator '${op}' is not supported by the 'project' field.`);
        const q = sql`${f.col} IN (SELECT p.key FROM projects p WHERE upper(p.key) = upper(${v}::text) OR lower(p.name) = lower(${v}::text))`;
        return op === '=' ? q : sql`NOT ${q}`;
      }
      case 'key': {
        const m = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/.exec(String(v));
        if (!m) throw new JqlError(`The issue key '${v}' for field 'key' is invalid.`);
        onlyOps(COMPARISON, op, `The operator '${op}' is not supported by the 'key' field.`);
        return sql`(i.project_key = ${m[1].toUpperCase()} AND ${f.col} ${sqlOp(op)} ${Number(m[2])})`;
      }
      case 'str': {
        if (op === '~' || op === '!~') return sql`${f.col} ${raw(op === '~' ? 'ILIKE' : 'NOT ILIKE')} ${likePattern(v)}`;
        if (f.ordered && ['<', '<=', '>', '>='].includes(op)) {
          // "priority >= High" = at least as important as High; position 0 is the most important.
          const inverted = { '<': '>', '<=': '>=', '>': '<', '>=': '<=' }[op];
          return sql`${raw(f.ordered.position)} ${raw(inverted)} (SELECT position FROM ${sql.ident(f.ordered.table)} WHERE lower(name) = lower(${v}::text))`;
        }
        onlyOps(['=', '!='], op, `The operator '${op}' is not supported here.`);
        return op === '=' ? sql`lower(${f.col}) = lower(${v}::text)` : sql`(${f.col} IS NULL OR lower(${f.col}) <> lower(${v}::text))`;
      }
      case 'user': {
        onlyOps(['=', '!='], op, `The operator '${op}' is not supported by user fields.`);
        const q = sql`${f.col} IN ${userMatch(v)}`;
        return op === '=' ? q : sql`(${f.col} IS NULL OR NOT ${q})`;
      }
      case 'labels':
      case 'components': {
        onlyOps(['=', '!='], op, `The operator '${op}' is not supported by the '${f.kind}' field.`);
        const q = f.kind === 'labels'
          ? sql`EXISTS (SELECT 1 FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE il.issue_id = i.id AND lower(l.name) = lower(${v}::text))`
          : sql`EXISTS (SELECT 1 FROM issue_components ic JOIN components c ON c.id = ic.component_id WHERE ic.issue_id = i.id AND lower(c.name) = lower(${v}::text))`;
        return op === '=' ? q : sql`NOT ${q}`;
      }
      case 'team': {
        onlyOps(['=', '!='], op, `The operator '${op}' is not supported by the 'team' field.`);
        const q = sql`${f.col} IN (SELECT t.id FROM teams t WHERE lower(t.name) = lower(${String(v)}::text) OR t.id::text = ${String(v)}::text)`;
        return op === '=' ? q : sql`(${f.col} IS NULL OR NOT ${q})`;
      }
      case 'parent': {
        onlyOps(['=', '!='], op, `The operator '${op}' is not supported by the 'parent' field.`);
        const q = sql`${f.col} IN (SELECT p.id FROM issues p WHERE p.key = ${String(v).toUpperCase()})`;
        return op === '=' ? q : sql`(${f.col} IS NULL OR NOT ${q})`;
      }
      case 'timestamp':
      case 'date': {
        const d = relativeDate(v, this.ctx.now) || String(v);
        if (!/^\d{4}-\d{2}-\d{2}/.test(d)) throw new JqlError(`Date value '${v}' for field is invalid. Use 'yyyy-MM-dd' or a relative period like '-7d'.`);
        onlyOps(COMPARISON, op, `The operator '${op}' is not supported by date fields.`);
        if (f.kind === 'date') return sql`${f.col} ${sqlOp(op)} ${d.slice(0, 10)}::date`;
        if (dayOnly(d)) return sql`(${f.col} AT TIME ZONE 'UTC')::date ${sqlOp(op)} ${d}::date`;
        return sql`${f.col} ${sqlOp(op)} ${d}::timestamptz`;
      }
      case 'num': {
        const n = Number(v);
        if (Number.isNaN(n)) throw new JqlError(`'${v}' is not a valid number.`);
        onlyOps(COMPARISON, op, `The operator '${op}' is not supported by number fields.`);
        return sql`${f.col} ${sqlOp(op)} ${n}`;
      }
      case 'duration': {
        let sec;
        try { sec = parseDuration(v); } catch (e) { throw new JqlError(e.message); }
        if (sec === null) throw new JqlError('Expecting a duration such as 2h or 1d 4h.');
        onlyOps(COMPARISON, op, `The operator '${op}' is not supported by time tracking fields.`);
        return sql`${f.col} ${sqlOp(op)} ${sec}`;
      }
      case 'watcher':
      case 'voter':
      case 'worklogauthor': {
        const label = { watcher: 'watcher', voter: 'voter', worklogauthor: 'worklogAuthor' }[f.kind];
        onlyOps(['=', '!='], op, `The '${label}' field only supports '=' and '!='.`);
        const inner = {
          watcher: sql`SELECT 1 FROM watchers x WHERE x.issue_id = i.id AND x.user_id IN ${userMatch(v)}`,
          voter: sql`SELECT 1 FROM votes x WHERE x.issue_id = i.id AND x.user_id IN ${userMatch(v)}`,
          worklogauthor: sql`SELECT 1 FROM worklogs x WHERE x.issue_id = i.id AND x.author_id IN ${userMatch(v)}`,
        }[f.kind];
        return op === '=' ? sql`EXISTS (${inner})` : sql`NOT EXISTS (${inner})`;
      }
      case 'worklogdate': {
        const d = (relativeDate(v, this.ctx.now) || String(v)).slice(0, 10);
        if (!dayOnly(d)) throw new JqlError(`Date value '${v}' for field 'worklogDate' is invalid.`);
        onlyOps(COMPARISON, op, `The operator '${op}' is not supported by 'worklogDate'.`);
        const q = sql`EXISTS (SELECT 1 FROM worklogs x WHERE x.issue_id = i.id AND (x.started_at AT TIME ZONE 'UTC')::date ${sqlOp(op === '!=' ? '=' : op)} ${d}::date)`;
        return op === '!=' ? sql`NOT ${q}` : q;
      }
      case 'attachments':
        throw new JqlError("The 'attachments' field only supports IS EMPTY and IS NOT EMPTY.");
      case 'comment': {
        onlyOps(['~', '!~'], op, "The 'comment' field only supports '~' and '!~'.");
        return sql`${raw(op === '~' ? '' : 'NOT ')}EXISTS (SELECT 1 FROM comments c WHERE c.issue_id = i.id AND c.body ILIKE ${likePattern(v)})`;
      }
      case 'custom':
        return this.custom(f.custom, op, v);
      default:
        throw new JqlError('Unsupported clause.');
    }
  }

  /* ---------- custom fields ---------- */
  custom(cf, op, v) {
    const base = (cond) => sql`EXISTS (SELECT 1 FROM custom_field_values x WHERE x.issue_id = i.id AND x.field_id = ${cf.id}::int AND ${cond})`;
    const text = raw("(x.value #>> '{}')");
    const negate = (q) => sql`NOT ${q}`;
    switch (cf.type) {
      case 'text': case 'paragraph': case 'url': {
        onlyOps(['~', '!~', '=', '!='], op, `The operator '${op}' is not supported by the '${cf.name}' field.`);
        const q = op === '~' || op === '!~' ? base(sql`${text} ILIKE ${likePattern(v)}`) : base(sql`lower(${text}) = lower(${v}::text)`);
        return op.startsWith('!') ? negate(q) : q;
      }
      case 'number': {
        const n = Number(v);
        if (Number.isNaN(n)) throw new JqlError(`'${v}' is not a valid number.`);
        onlyOps(COMPARISON, op, `The operator '${op}' is not supported by number fields.`);
        return op === '!=' ? negate(base(sql`${text}::numeric = ${n}`)) : base(sql`${text}::numeric ${sqlOp(op)} ${n}`);
      }
      case 'date': {
        const d = (relativeDate(v, this.ctx.now) || String(v)).slice(0, 10);
        if (!dayOnly(d)) throw new JqlError(`Date value '${v}' for field '${cf.name}' is invalid.`);
        onlyOps(COMPARISON, op, `The operator '${op}' is not supported by date fields.`);
        return op === '!=' ? negate(base(sql`${text}::date = ${d}::date`)) : base(sql`${text}::date ${sqlOp(op)} ${d}::date`);
      }
      case 'checkbox': {
        onlyOps(['=', '!='], op, `The '${cf.name}' field only supports '=' and '!='.`);
        const on = ['true', 'yes', 'checked', '1', 'on'].includes(String(v).toLowerCase());
        const q = base(sql`${text}::boolean = ${on}`);
        return op === '=' ? q : negate(q);
      }
      case 'select': case 'multiselect': {
        onlyOps(['=', '!=', '~', '!~'], op, `The operator '${op}' is not supported by the '${cf.name}' field.`);
        const ids = cf.type === 'select' ? raw("(SELECT (x.value #>> '{}')::int)") : raw('(SELECT e::int FROM jsonb_array_elements_text(x.value) e)');
        const match = op.includes('~') ? sql`o.value ILIKE ${likePattern(v)}` : sql`lower(o.value) = lower(${v}::text)`;
        const q = base(sql`EXISTS (SELECT 1 FROM custom_field_options o WHERE o.field_id = x.field_id AND o.id IN ${ids} AND ${match})`);
        return op.startsWith('!') ? negate(q) : q;
      }
      case 'user': {
        onlyOps(['=', '!='], op, `The '${cf.name}' field only supports '=' and '!='.`);
        const q = base(sql`${text} IN ${userMatch(v)}`);
        return op === '=' ? q : negate(q);
      }
      default:
        throw new JqlError(`The '${cf.name}' field cannot be searched.`);
    }
  }

  empty(f, negated) {
    let q;
    switch (f.kind) {
      case 'labels': q = raw('NOT EXISTS (SELECT 1 FROM issue_labels il WHERE il.issue_id = i.id)'); break;
      case 'components': q = raw('NOT EXISTS (SELECT 1 FROM issue_components ic WHERE ic.issue_id = i.id)'); break;
      case 'text': q = sql`(${f.col} IS NULL OR ${f.col} = '')`; break;
      case 'comment': q = raw('NOT EXISTS (SELECT 1 FROM comments c WHERE c.issue_id = i.id)'); break;
      case 'attachments': q = raw('NOT EXISTS (SELECT 1 FROM attachments a WHERE a.issue_id = i.id)'); break;
      case 'watcher': q = raw('NOT EXISTS (SELECT 1 FROM watchers w WHERE w.issue_id = i.id)'); break;
      case 'voter': q = raw('NOT EXISTS (SELECT 1 FROM votes x WHERE x.issue_id = i.id)'); break;
      case 'worklogauthor': case 'worklogdate': q = raw('NOT EXISTS (SELECT 1 FROM worklogs x WHERE x.issue_id = i.id)'); break;
      case 'custom': q = sql`NOT EXISTS (SELECT 1 FROM custom_field_values x WHERE x.issue_id = i.id AND x.field_id = ${f.custom.id}::int)`; break;
      default: q = sql`${f.col} IS NULL`;
    }
    return negated ? sql`NOT ${q}` : q;
  }

  sortExpressions(name) {
    const lower = String(name).toLowerCase();
    const known = SORT_EXPRESSIONS[lower];
    if (known) return (Array.isArray(known) ? known : [known]).map(raw);
    const f = this.field(name);
    if (f.kind === 'custom') {
      const cast = { number: '::numeric', date: '::date', checkbox: '::boolean' }[f.custom.type] || '';
      const expr = ['select'].includes(f.custom.type)
        ? sql`(SELECT o.value FROM custom_field_values x JOIN custom_field_options o ON o.id = (x.value #>> '{}')::int WHERE x.issue_id = i.id AND x.field_id = ${f.custom.id}::int)`
        : sql`(SELECT (x.value #>> '{}')${raw(cast)} FROM custom_field_values x WHERE x.issue_id = i.id AND x.field_id = ${f.custom.id}::int)`;
      return [expr];
    }
    if (!f.col) throw new JqlError(`Field '${name}' cannot be used for sorting.`);
    return [f.col];
  }

  compile(ast) {
    const where = ast.where ? this.node(ast.where) : raw('TRUE');
    const order = [];
    const sort = [];
    for (const { field, direction } of ast.orderBy) {
      // PostgreSQL defaults match Jira: empty values last in ASC, first in DESC.
      for (const expr of this.sortExpressions(field)) order.push(sql`${expr} ${raw(direction)}`);
      sort.push({ field, dir: direction });
    }
    order.push(raw('i.rank ASC'), raw('i.id ASC'));
    return { where, orderBy: sql.join(order), sort };
  }
}

/** compileJql('project = KAN ORDER BY rank', { currentUserId, customFields }) */
function compileJql(jql, context = {}) {
  return new Compiler(context).compile(parse(jql));
}

module.exports = { compileJql, JqlError, FIELDS };
