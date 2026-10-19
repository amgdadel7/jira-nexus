// A small JQL (Jira Query Language) -> SQLite compiler.
// Supports: AND / OR / NOT, parentheses, = != ~ !~ > >= < <=, IN / NOT IN,
// IS EMPTY / IS NOT EMPTY (NULL too), functions currentUser(), now(), startOfDay(),
// relative dates (-7d, 2w, -12h), ORDER BY field [ASC|DESC], ...

class JqlError extends Error {}

const STATUS_ORDER = ['To Do', 'In Progress', 'In Review', 'Done'];
const PRIORITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
const KEYWORDS = new Set(['AND', 'OR', 'NOT', 'IN', 'IS', 'EMPTY', 'NULL', 'ORDER', 'BY', 'ASC', 'DESC']);

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')' || c === ',') { tokens.push({ t: c, v: c, pos: i }); i++; continue; }
    const two = input.slice(i, i + 2);
    if (['!=', '!~', '>=', '<='].includes(two)) { tokens.push({ t: 'op', v: two, pos: i }); i += 2; continue; }
    if (['=', '~', '>', '<'].includes(c)) { tokens.push({ t: 'op', v: c, pos: i }); i++; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (j < input.length && input[j] !== c) {
        if (input[j] === '\\' && j + 1 < input.length) { s += input[j + 1]; j += 2; } else s += input[j++];
      }
      if (j >= input.length) throw new JqlError(`The quoted string starting at character ${i + 1} is not terminated.`);
      tokens.push({ t: 'str', v: s, pos: i });
      i = j + 1; continue;
    }
    const m = /^[^\s()",'=!~<>]+/.exec(input.slice(i));
    if (!m) throw new JqlError(`Unexpected character '${c}' at position ${i + 1}.`);
    const word = m[0];
    const up = word.toUpperCase();
    tokens.push({ t: KEYWORDS.has(up) ? 'kw' : 'word', v: KEYWORDS.has(up) ? up : word, pos: i });
    i += word.length;
  }
  return tokens;
}

function relDate(v) {
  const m = /^([+-]?)(\d+)([dwhm])$/i.exec(String(v).trim());
  if (!m) return null;
  const n = Number(m[2]) * (m[1] === '-' ? -1 : 1);
  const unit = { d: 864e5, w: 7 * 864e5, h: 36e5, m: 6e4 }[m[3].toLowerCase()];
  return new Date(Date.now() + n * unit).toISOString();
}

function compile(jql, ctx) {
  const tokens = tokenize(jql || '');
  let p = 0;
  const params = [];
  const peek = () => tokens[p];
  const next = () => tokens[p++];
  const isKw = (k) => peek() && peek().t === 'kw' && peek().v === k;
  const expect = (t, v) => {
    const tok = next();
    if (!tok || tok.t !== t || (v && tok.v !== v)) {
      throw new JqlError(`Expecting ${v || t} but got ${tok ? `'${tok.v}'` : 'end of query'}.`);
    }
    return tok;
  };

  function readValue() {
    const tok = next();
    if (!tok) throw new JqlError('Expecting a value but reached the end of the query.');
    if (tok.t === 'str') return { v: tok.v };
    if (tok.t === 'word') {
      if (peek() && peek().t === '(') {
        next();
        const args = [];
        while (peek() && peek().t !== ')') { args.push(readValue().v); if (peek() && peek().t === ',') next(); }
        expect(')');
        return { fn: tok.v.toLowerCase(), args };
      }
      return { v: tok.v };
    }
    if (tok.t === 'kw' && (tok.v === 'EMPTY' || tok.v === 'NULL')) return { empty: true };
    throw new JqlError(`Expecting a value but got '${tok.v}'.`);
  }

  function resolveFn(val, kind) {
    if (!val.fn) return val.v;
    switch (val.fn) {
      case 'currentuser': return ctx.currentUserId;
      case 'now': return new Date().toISOString();
      case 'startofday': { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); }
      case 'endofday': { const d = new Date(); d.setUTCHours(23, 59, 59, 999); return d.toISOString(); }
      case 'startofweek': { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString(); }
      case 'startofmonth': { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(1); return d.toISOString(); }
      default: throw new JqlError(`Unable to find JQL function '${val.fn}()'.`);
    }
  }

  const FIELDS = {
    project: { col: 'i.project_key', kind: 'project' },
    key: { col: 'i.num', kind: 'key' }, issuekey: { col: 'i.num', kind: 'key' }, id: { col: 'i.num', kind: 'key' },
    summary: { col: 'i.summary', kind: 'text' },
    description: { col: 'i.description', kind: 'text' },
    text: { col: "(i.summary || ' ' || i.description || ' ' || i.key)", kind: 'text' },
    status: { col: 'i.status', kind: 'str' },
    statuscategory: { col: "(CASE i.status WHEN 'Done' THEN 'Done' WHEN 'To Do' THEN 'To Do' ELSE 'In Progress' END)", kind: 'str' },
    type: { col: 'i.type', kind: 'str' }, issuetype: { col: 'i.type', kind: 'str' },
    priority: { col: 'i.priority', kind: 'str' },
    assignee: { col: 'i.assignee_id', kind: 'user' },
    reporter: { col: 'i.reporter_id', kind: 'user' },
    labels: { col: 'i.labels', kind: 'labels' }, label: { col: 'i.labels', kind: 'labels' },
    created: { col: 'i.created_at', kind: 'date' }, createddate: { col: 'i.created_at', kind: 'date' },
    updated: { col: 'i.updated_at', kind: 'date' }, updateddate: { col: 'i.updated_at', kind: 'date' },
    resolved: { col: 'i.resolved_at', kind: 'date' },
    duedate: { col: 'i.due_date', kind: 'date' }, due: { col: 'i.due_date', kind: 'date' },
    startdate: { col: 'i.start_date', kind: 'date' },
    parent: { col: 'i.parent_id', kind: 'parent' },
    sprint: { col: 'i.sprint', kind: 'str' },
    component: { col: 'i.components', kind: 'labels' }, components: { col: 'i.components', kind: 'labels' },
    team: { col: 'i.team_id', kind: 'team' },
    fixversion: { col: 'i.fix_version', kind: 'str' }, 'fix version': { col: 'i.fix_version', kind: 'str' }, fixversions: { col: 'i.fix_version', kind: 'str' },
    'story points': { col: 'i.story_points', kind: 'num' }, storypoints: { col: 'i.story_points', kind: 'num' }, 'cf[10016]': { col: 'i.story_points', kind: 'num' },
    rank: { col: 'i.rank', kind: 'num' }, 'cf[10019]': { col: 'i.rank', kind: 'num' },
    comment: { col: null, kind: 'comment' },
    watcher: { col: 'i.id', kind: 'watcher' },
    attachments: { col: 'i.id', kind: 'attachments' },
    originalestimate: { col: 'i.original_estimate', kind: 'duration' }, timeoriginalestimate: { col: 'i.original_estimate', kind: 'duration' },
    remainingestimate: { col: 'i.remaining_estimate', kind: 'duration' }, timeestimate: { col: 'i.remaining_estimate', kind: 'duration' },
    timespent: { col: 'NULLIF(i.time_spent, 0)', kind: 'duration' },
    votes: { col: '(SELECT COUNT(*) FROM votes v WHERE v.issue_id = i.id)', kind: 'num' },
    voter: { col: 'i.id', kind: 'voter' },
    worklogauthor: { col: 'i.id', kind: 'worklogauthor' },
    worklogdate: { col: 'i.id', kind: 'worklogdate' },
  };

  function field(name) {
    const f = FIELDS[name.toLowerCase()];
    if (!f) throw new JqlError(`Field '${name}' does not exist or you do not have permission to view it.`);
    return f;
  }

  function single(f, op, raw) {
    if (raw.empty) return emptyClause(f, op === '!=' );
    const v = resolveFn(raw, f.kind);
    switch (f.kind) {
      case 'text': {
        if (!['~', '!~'].includes(op)) throw new JqlError(`The operator '${op}' is not supported by text fields. Use '~' instead.`);
        params.push(`%${String(v).replace(/\*/g, '')}%`);
        return `${f.col} ${op === '~' ? '' : 'NOT '}LIKE ? COLLATE NOCASE`;
      }
      case 'project': {
        params.push(v, v);
        const q = `${f.col} IN (SELECT key FROM projects WHERE key = ? COLLATE NOCASE OR name = ? COLLATE NOCASE)`;
        if (op === '=') return q; if (op === '!=') return `NOT ${q}`;
        throw new JqlError(`The operator '${op}' is not supported by the 'project' field.`);
      }
      case 'key': {
        const m = /^([A-Za-z]+)-(\d+)$/.exec(String(v));
        if (!m) throw new JqlError(`The issue key '${v}' for field 'key' is invalid.`);
        if (!['=', '!=', '>', '>=', '<', '<='].includes(op)) throw new JqlError(`The operator '${op}' is not supported by the 'key' field.`);
        params.push(m[1].toUpperCase(), Number(m[2]));
        return `(i.project_key = ? AND ${f.col} ${op === '!=' ? '<>' : op} ?)`;
      }
      case 'str': {
        if (op === '~' || op === '!~') { params.push(`%${v}%`); return `${f.col} ${op === '~' ? '' : 'NOT '}LIKE ? COLLATE NOCASE`; }
        if (!['=', '!='].includes(op)) throw new JqlError(`The operator '${op}' is not supported here.`);
        params.push(v);
        return op === '=' ? `${f.col} = ? COLLATE NOCASE` : `(${f.col} IS NULL OR ${f.col} <> ? COLLATE NOCASE)`;
      }
      case 'user': {
        if (!['=', '!='].includes(op)) throw new JqlError(`The operator '${op}' is not supported by user fields.`);
        params.push(v, v, v);
        const q = `${f.col} IN (SELECT id FROM users WHERE id = ? OR name = ? COLLATE NOCASE OR email = ? COLLATE NOCASE)`;
        return op === '=' ? q : `(${f.col} IS NULL OR NOT ${q})`;
      }
      case 'labels': {
        if (!['=', '!='].includes(op)) throw new JqlError(`The operator '${op}' is not supported by the 'labels' field.`);
        params.push(v);
        const q = `EXISTS (SELECT 1 FROM json_each(${f.col}) WHERE value = ? COLLATE NOCASE)`;
        return op === '=' ? q : `NOT ${q}`;
      }
      case 'team': {
        if (!['=', '!='].includes(op)) throw new JqlError(`The operator '${op}' is not supported by the 'team' field.`);
        params.push(String(v), String(v));
        const q = `${f.col} IN (SELECT id FROM teams WHERE name = ? COLLATE NOCASE OR CAST(id AS TEXT) = ?)`;
        return op === '=' ? q : `(${f.col} IS NULL OR NOT ${q})`;
      }
      case 'parent': {
        if (!['=', '!='].includes(op)) throw new JqlError(`The operator '${op}' is not supported by the 'parent' field.`);
        params.push(String(v).toUpperCase());
        const q = `${f.col} IN (SELECT id FROM issues WHERE key = ?)`;
        return op === '=' ? q : `(${f.col} IS NULL OR NOT ${q})`;
      }
      case 'date': {
        let d = relDate(v) || v;
        if (!/^\d{4}-\d{2}-\d{2}/.test(d)) throw new JqlError(`Date value '${v}' for field is invalid. Use 'yyyy-MM-dd' or a relative period like '-7d'.`);
        if (!['=', '!=', '>', '>=', '<', '<='].includes(op)) throw new JqlError(`The operator '${op}' is not supported by date fields.`);
        const isDayOnly = f.col === 'i.due_date' || f.col === 'i.start_date';
        if (isDayOnly) d = d.slice(0, 10);
        else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          // whole-day comparisons for datetime fields
          if (op === '=') { params.push(d); return `substr(${f.col},1,10) = ?`; }
          if (op === '!=') { params.push(d); return `substr(${f.col},1,10) <> ?`; }
          if (op === '>') { params.push(d); return `substr(${f.col},1,10) > ?`; }
          if (op === '<=') { params.push(d); return `substr(${f.col},1,10) <= ?`; }
        }
        params.push(d);
        return `${f.col} ${op === '!=' ? '<>' : op} ?`;
      }
      case 'num': {
        const n = Number(v);
        if (Number.isNaN(n)) throw new JqlError(`'${v}' is not a valid number.`);
        params.push(n);
        return `${f.col} ${op === '!=' ? '<>' : op} ?`;
      }
      case 'watcher': {
        if (!['=', '!='].includes(op)) throw new JqlError("The 'watcher' field only supports '=' and '!='.");
        params.push(v, v, v);
        const q = 'EXISTS (SELECT 1 FROM watchers w WHERE w.issue_id = i.id AND w.user_id IN (SELECT id FROM users WHERE id = ? OR name = ? COLLATE NOCASE OR email = ? COLLATE NOCASE))';
        return op === '=' ? q : `NOT ${q}`;
      }
      case 'duration': {
        let sec;
        try { sec = require('./timefmt').parseDuration(v); } catch (e) { throw new JqlError(e.message); }
        if (sec === null) throw new JqlError('Expecting a duration such as 2h or 1d 4h.');
        if (!['=', '!=', '>', '>=', '<', '<='].includes(op)) throw new JqlError(`The operator '${op}' is not supported by time tracking fields.`);
        params.push(sec);
        return `${f.col} ${op === '!=' ? '<>' : op} ?`;
      }
      case 'voter':
      case 'worklogauthor': {
        if (!['=', '!='].includes(op)) throw new JqlError(`The '${f.kind === 'voter' ? 'voter' : 'worklogAuthor'}' field only supports '=' and '!='.`);
        params.push(v, v, v);
        const tbl = f.kind === 'voter' ? 'votes x WHERE x.issue_id = i.id AND x.user_id' : 'worklogs x WHERE x.issue_id = i.id AND x.author_id';
        const q = `EXISTS (SELECT 1 FROM ${tbl} IN (SELECT id FROM users WHERE id = ? OR name = ? COLLATE NOCASE OR email = ? COLLATE NOCASE))`;
        return op === '=' ? q : `NOT ${q}`;
      }
      case 'worklogdate': {
        const d = (relDate(v) || String(v)).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new JqlError(`Date value '${v}' for field 'worklogDate' is invalid.`);
        if (!['=', '!=', '>', '>=', '<', '<='].includes(op)) throw new JqlError(`The operator '${op}' is not supported by 'worklogDate'.`);
        params.push(d);
        const q = `EXISTS (SELECT 1 FROM worklogs x WHERE x.issue_id = i.id AND substr(x.started_at,1,10) ${op === '!=' ? '=' : op} ?)`;
        return op === '!=' ? `NOT ${q}` : q;
      }
      case 'attachments':
        throw new JqlError("The 'attachments' field only supports IS EMPTY and IS NOT EMPTY.");
      case 'comment': {
        if (!['~', '!~'].includes(op)) throw new JqlError("The 'comment' field only supports '~' and '!~'.");
        params.push(`%${v}%`);
        return `${op === '~' ? '' : 'NOT '}EXISTS (SELECT 1 FROM comments c WHERE c.issue_id = i.id AND c.body LIKE ? COLLATE NOCASE)`;
      }
    }
    throw new JqlError('Unsupported clause.');
  }

  function emptyClause(f, negate) {
    let q;
    if (f.kind === 'labels') q = `(${f.col} IS NULL OR ${f.col} = '[]')`;
    else if (f.kind === 'team') q = `${f.col} IS NULL`;
    else if (f.kind === 'text') q = `(${f.col} IS NULL OR ${f.col} = '')`;
    else if (f.kind === 'comment') q = 'NOT EXISTS (SELECT 1 FROM comments c WHERE c.issue_id = i.id)';
    else if (f.kind === 'attachments') q = 'NOT EXISTS (SELECT 1 FROM attachments a WHERE a.issue_id = i.id)';
    else if (f.kind === 'watcher') q = 'NOT EXISTS (SELECT 1 FROM watchers w WHERE w.issue_id = i.id)';
    else if (f.kind === 'voter') q = 'NOT EXISTS (SELECT 1 FROM votes x WHERE x.issue_id = i.id)';
    else if (f.kind === 'worklogauthor' || f.kind === 'worklogdate') q = 'NOT EXISTS (SELECT 1 FROM worklogs x WHERE x.issue_id = i.id)';
    else q = `${f.col} IS NULL`;
    return negate ? `NOT ${q}` : q;
  }

  function clause() {
    const tok = next();
    if (!tok || (tok.t !== 'word' && tok.t !== 'str')) {
      throw new JqlError(tok ? `Expecting a field name but got '${tok.v}'.` : 'Expecting a field name but reached the end of the query.');
    }
    const f = field(tok.v);
    if (isKw('IS')) {
      next();
      let neg = false;
      if (isKw('NOT')) { next(); neg = true; }
      const t = next();
      if (!t || t.t !== 'kw' || (t.v !== 'EMPTY' && t.v !== 'NULL')) throw new JqlError("Expecting 'EMPTY' after 'IS'.");
      return emptyClause(f, neg);
    }
    let notIn = false;
    if (isKw('NOT')) { next(); notIn = true; if (!isKw('IN')) throw new JqlError("Expecting 'IN' after 'NOT'."); }
    if (isKw('IN')) {
      next();
      // sprint IN openSprints() / closedSprints() / futureSprints()
      if (f.col === 'i.sprint' && peek() && peek().t === 'word') {
        const fn = readValue();
        const states = { opensprints: "'active'", closedsprints: "'closed'", futuresprints: "'future'" }[fn.fn];
        if (!states) throw new JqlError(`Unable to find JQL function '${fn.fn || fn.v}()'.`);
        const q = `${f.col} IN (SELECT name FROM sprints WHERE state IN (${states}))`;
        return notIn ? `(${f.col} IS NULL OR NOT ${q})` : q;
      }
      // fixVersion IN releasedVersions() / unreleasedVersions() / archivedVersions()
      if (f.col === 'i.fix_version' && peek() && peek().t === 'word') {
        const fn = readValue();
        const states = { releasedversions: "'released'", unreleasedversions: "'unreleased'", archivedversions: "'archived'" }[fn.fn];
        if (!states) throw new JqlError(`Unable to find JQL function '${fn.fn || fn.v}()'.`);
        const q = `EXISTS (SELECT 1 FROM versions v WHERE v.project_key = i.project_key AND v.name = i.fix_version AND v.status IN (${states}))`;
        return notIn ? `(${f.col} IS NULL OR NOT ${q})` : q;
      }
      expect('(');
      const parts = [];
      while (peek() && peek().t !== ')') {
        parts.push(single(f, '=', readValue()));
        if (peek() && peek().t === ',') next();
      }
      expect(')');
      if (!parts.length) throw new JqlError("The list for 'IN' cannot be empty.");
      const q = `(${parts.join(' OR ')})`;
      return notIn ? `(NOT ${q}${f.kind === 'user' || f.kind === 'parent' ? ` OR ${f.col} IS NULL` : ''})` : q;
    }
    const opTok = next();
    if (!opTok || opTok.t !== 'op') throw new JqlError(`Expecting an operator after '${tok.v}' but got ${opTok ? `'${opTok.v}'` : 'end of query'}.`);
    return single(f, opTok.v, readValue());
  }

  function primary() {
    if (peek() && peek().t === '(') { next(); const e = orExpr(); expect(')'); return `(${e})`; }
    return clause();
  }
  function notExpr() { if (isKw('NOT')) { next(); return `NOT (${notExpr()})`; } return primary(); }
  function andExpr() { let l = notExpr(); while (isKw('AND')) { next(); l = `(${l} AND ${notExpr()})`; } return l; }
  function orExpr() { let l = andExpr(); while (isKw('OR')) { next(); l = `(${l} OR ${andExpr()})`; } return l; }

  let where = '1=1';
  if (peek() && !isKw('ORDER')) where = orExpr();

  const orderBy = [];
  const sort = [];
  if (isKw('ORDER')) {
    next(); expect('kw', 'BY');
    do {
      if (peek() && peek().t === ',') next();
      const tok = next();
      if (!tok || (tok.t !== 'word' && tok.t !== 'str')) throw new JqlError('Expecting a field name after ORDER BY.');
      let dir = 'ASC';
      if (isKw('ASC') || isKw('DESC')) dir = next().v;
      const name = tok.v.toLowerCase();
      let expr;
      if (name === 'status') expr = `CASE i.status ${STATUS_ORDER.map((s, n) => `WHEN '${s}' THEN ${n}`).join(' ')} ELSE 99 END`;
      else if (name === 'priority') expr = `CASE i.priority ${PRIORITY_ORDER.map((s, n) => `WHEN '${s}' THEN ${PRIORITY_ORDER.length - n}`).join(' ')} ELSE 99 END`;
      else if (name === 'assignee') expr = '(SELECT name FROM users WHERE id = i.assignee_id)';
      else if (name === 'reporter') expr = '(SELECT name FROM users WHERE id = i.reporter_id)';
      else if (['key', 'issuekey', 'id'].includes(name)) expr = 'i.project_key, i.num';
      else if (name === 'comments' || name === 'comment') expr = '(SELECT COUNT(*) FROM comments c WHERE c.issue_id = i.id)';
      else if (name === 'parent') expr = '(SELECT num FROM issues p WHERE p.id = i.parent_id)';
      else if (name === 'labels') expr = 'i.labels';
      else expr = field(tok.v).col;
      if (!expr) throw new JqlError(`Field '${tok.v}' cannot be used for sorting.`);
      // empty values last in ASC, first in DESC (like Jira)
      const nullsLast = `CASE WHEN ${expr.split(',').pop()} IS NULL THEN 1 ELSE 0 END ${dir === 'ASC' ? 'ASC' : 'DESC'}`;
      orderBy.push(nullsLast, ...expr.split(',').map((e) => `${e.trim()} ${dir}`));
      sort.push({ field: tok.v, dir });
    } while (peek() && peek().t === ',');
  }
  if (p < tokens.length) throw new JqlError(`Error in the JQL query: unexpected '${tokens[p].v}' at character ${tokens[p].pos + 1}.`);
  orderBy.push('i.rank ASC', 'i.id ASC');
  return { where, params, orderBy: orderBy.join(', '), sort };
}

module.exports = { compile, JqlError, STATUS_ORDER, PRIORITY_ORDER };
