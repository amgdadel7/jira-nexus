'use strict';

/**
 * JQL (Jira Query Language) tokenizer + recursive-descent parser.
 * Produces a database-independent AST; infrastructure/jql/compiler turns it into SQL.
 *
 *   Query   := [OrExpr] [ORDER BY SortKey {, SortKey}]
 *   OrExpr  := AndExpr {OR AndExpr}
 *   AndExpr := NotExpr {AND NotExpr}
 *   NotExpr := NOT NotExpr | '(' OrExpr ')' | Clause
 *   Clause  := Field (Op Value | [NOT] IN List | IS [NOT] EMPTY)
 *
 * AST nodes:
 *   { type: 'and' | 'or', left, right }   { type: 'not', expr }
 *   { type: 'clause', field, op, value }  op ∈ = != ~ !~ > >= < <= in "not in" "is empty" "is not empty"
 *   values: { kind: 'literal', value } | { kind: 'function', name, args } | { kind: 'list', items } | { kind: 'empty' }
 */

class JqlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'JqlError';
    this.status = 400;
  }
}

const KEYWORDS = new Set(['AND', 'OR', 'NOT', 'IN', 'IS', 'EMPTY', 'NULL', 'ORDER', 'BY', 'ASC', 'DESC']);
const TWO_CHAR_OPS = ['!=', '!~', '>=', '<='];
const ONE_CHAR_OPS = ['=', '~', '>', '<'];

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i += 1; continue; }
    if (c === '(' || c === ')' || c === ',') { tokens.push({ t: c, v: c, pos: i }); i += 1; continue; }
    const two = input.slice(i, i + 2);
    if (TWO_CHAR_OPS.includes(two)) { tokens.push({ t: 'op', v: two, pos: i }); i += 2; continue; }
    if (ONE_CHAR_OPS.includes(c)) { tokens.push({ t: 'op', v: c, pos: i }); i += 1; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = '';
      while (j < input.length && input[j] !== c) {
        if (input[j] === '\\' && j + 1 < input.length) { s += input[j + 1]; j += 2; } else { s += input[j]; j += 1; }
      }
      if (j >= input.length) throw new JqlError(`The quoted string starting at character ${i + 1} is not terminated.`);
      tokens.push({ t: 'str', v: s, pos: i });
      i = j + 1;
      continue;
    }
    const m = /^[^\s()",'=!~<>]+/.exec(input.slice(i));
    if (!m) throw new JqlError(`Unexpected character '${c}' at position ${i + 1}.`);
    const word = m[0];
    const upper = word.toUpperCase();
    tokens.push(KEYWORDS.has(upper) ? { t: 'kw', v: upper, pos: i } : { t: 'word', v: word, pos: i });
    i += word.length;
  }
  return tokens;
}

function parse(input) {
  const tokens = tokenize(String(input || ''));
  let p = 0;
  const peek = () => tokens[p];
  const next = () => tokens[p++]; // eslint-disable-line no-plusplus
  const isKw = (k) => peek() && peek().t === 'kw' && peek().v === k;
  const isType = (t) => peek() && peek().t === t;
  const expect = (t, v) => {
    const tok = next();
    if (!tok || tok.t !== t || (v && tok.v !== v)) throw new JqlError(`Expecting ${v || t} but got ${tok ? `'${tok.v}'` : 'end of query'}.`);
    return tok;
  };

  function value() {
    const tok = next();
    if (!tok) throw new JqlError('Expecting a value but reached the end of the query.');
    if (tok.t === 'str') return { kind: 'literal', value: tok.v };
    if (tok.t === 'word') {
      if (isType('(')) {
        next();
        const args = [];
        while (peek() && !isType(')')) {
          args.push(value().value);
          if (isType(',')) next();
        }
        expect(')');
        return { kind: 'function', name: tok.v.toLowerCase(), args };
      }
      return { kind: 'literal', value: tok.v };
    }
    if (tok.t === 'kw' && (tok.v === 'EMPTY' || tok.v === 'NULL')) return { kind: 'empty' };
    throw new JqlError(`Expecting a value but got '${tok.v}'.`);
  }

  function clause() {
    const tok = next();
    if (!tok || (tok.t !== 'word' && tok.t !== 'str')) {
      throw new JqlError(tok ? `Expecting a field name but got '${tok.v}'.` : 'Expecting a field name but reached the end of the query.');
    }
    const field = tok.v;
    if (isKw('IS')) {
      next();
      let negated = false;
      if (isKw('NOT')) { next(); negated = true; }
      const t = next();
      if (!t || t.t !== 'kw' || (t.v !== 'EMPTY' && t.v !== 'NULL')) throw new JqlError("Expecting 'EMPTY' after 'IS'.");
      return { type: 'clause', field, op: negated ? 'is not empty' : 'is empty', value: { kind: 'empty' } };
    }
    let notIn = false;
    if (isKw('NOT')) {
      next();
      notIn = true;
      if (!isKw('IN')) throw new JqlError("Expecting 'IN' after 'NOT'.");
    }
    if (isKw('IN')) {
      next();
      const op = notIn ? 'not in' : 'in';
      if (isType('word')) return { type: 'clause', field, op, value: value() }; // IN openSprints()
      expect('(');
      const items = [];
      while (peek() && !isType(')')) {
        items.push(value());
        if (isType(',')) next();
      }
      expect(')');
      if (!items.length) throw new JqlError("The list for 'IN' cannot be empty.");
      return { type: 'clause', field, op, value: { kind: 'list', items } };
    }
    const opTok = next();
    if (!opTok || opTok.t !== 'op') throw new JqlError(`Expecting an operator after '${field}' but got ${opTok ? `'${opTok.v}'` : 'end of query'}.`);
    return { type: 'clause', field, op: opTok.v, value: value() };
  }

  function primary() {
    if (isType('(')) {
      next();
      const e = orExpr(); // eslint-disable-line no-use-before-define
      expect(')');
      return e;
    }
    return clause();
  }
  function notExpr() {
    if (isKw('NOT')) { next(); return { type: 'not', expr: notExpr() }; }
    return primary();
  }
  function andExpr() {
    let left = notExpr();
    while (isKw('AND')) { next(); left = { type: 'and', left, right: notExpr() }; }
    return left;
  }
  function orExpr() {
    let left = andExpr();
    while (isKw('OR')) { next(); left = { type: 'or', left, right: andExpr() }; }
    return left;
  }

  const where = peek() && !isKw('ORDER') ? orExpr() : null;
  const orderBy = [];
  if (isKw('ORDER')) {
    next();
    expect('kw', 'BY');
    do {
      if (isType(',')) next();
      const tok = next();
      if (!tok || (tok.t !== 'word' && tok.t !== 'str')) throw new JqlError('Expecting a field name after ORDER BY.');
      let direction = 'ASC';
      if (isKw('ASC') || isKw('DESC')) direction = next().v;
      orderBy.push({ field: tok.v, direction });
    } while (isType(','));
  }
  if (p < tokens.length) throw new JqlError(`Error in the JQL query: unexpected '${tokens[p].v}' at character ${tokens[p].pos + 1}.`);
  return { where, orderBy };
}

module.exports = { parse, tokenize, JqlError };
