// Helpers for building / splitting JQL strings on the client.
import { getProject } from './api.js'

export const defaultJql = (key = getProject()) => `project = ${key} ORDER BY cf[10019] ASC`
export const RANK_FIELD = 'cf[10019]'

export const EMPTY_BASIC = { search: '', assignees: [], types: [], statuses: [], priorities: [], labels: [] }

const q = (v) => (/^[A-Za-z0-9_\-.]+$/.test(v) && !/^(and|or|not|in|is|empty|null|order|by)$/i.test(v) ? v : `"${String(v).replace(/(["\\])/g, '\\$1')}"`)

export function splitJql(jql) {
  const m = /\bORDER\s+BY\b([\s\S]*)$/i.exec(jql)
  if (!m) return { where: jql.trim(), order: '' }
  return { where: jql.slice(0, m.index).trim(), order: m[1].trim() }
}

export function parseSort(jql) {
  const { order } = splitJql(jql)
  if (!order) return { field: RANK_FIELD, dir: 'ASC' }
  const m = /^("([^"]+)"|[^\s,]+)\s*(ASC|DESC)?/i.exec(order)
  if (!m) return { field: RANK_FIELD, dir: 'ASC' }
  return { field: (m[2] || m[1]), dir: (m[3] || 'ASC').toUpperCase() }
}

export function withSort(jql, field, dir) {
  const { where } = splitJql(jql)
  return `${where}${where ? ' ' : ''}ORDER BY ${q(field)} ${dir}`
}

export function buildWhere(basic, users) {
  const parts = [`project = ${getProject()}`]
  if (basic.search.trim()) parts.push(`text ~ ${q(basic.search.trim())}`)
  const userName = (id) => (id === null ? 'EMPTY' : q(users.find((u) => u.id === id)?.name || id))
  if (basic.assignees.length) parts.push(`assignee in (${basic.assignees.map(userName).join(', ')})`)
  if (basic.types.length) parts.push(`type in (${basic.types.map(q).join(', ')})`)
  if (basic.statuses.length) parts.push(`status in (${basic.statuses.map(q).join(', ')})`)
  if (basic.priorities.length) parts.push(`priority in (${basic.priorities.map(q).join(', ')})`)
  if (basic.labels.length) parts.push(`labels in (${basic.labels.map(q).join(', ')})`)
  return parts.join(' AND ')
}

export function buildJql(basic, users, currentJql) {
  const { order } = splitJql(currentJql || defaultJql())
  return `${buildWhere(basic, users)} ORDER BY ${order || `${RANK_FIELD} ASC`}`
}

// Tries to turn a JQL "where" (as produced by buildWhere) back into basic filters.
export function parseBasic(jql, users) {
  const { where } = splitJql(jql)
  const basic = { ...EMPTY_BASIC, assignees: [], types: [], statuses: [], priorities: [], labels: [] }
  const tokenList = (s) => {
    const out = []; const re = /"((?:[^"\\]|\\.)*)"|([^,\s]+)/g; let m
    while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2])
    return out
  }
  const clauses = where.split(/\s+AND\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/i)
  for (const c of clauses) {
    let m
    if (/^project\s*=\s*[A-Z][A-Z0-9]*$/i.test(c)) continue
    if ((m = /^text\s*~\s*(?:"((?:[^"\\]|\\.)*)"|(\S+))$/i.exec(c))) { basic.search = (m[1] ?? m[2]).replace(/\\(.)/g, '$1'); continue }
    if ((m = /^(assignee|type|status|priority|labels)\s+in\s*\(([\s\S]*)\)$/i.exec(c))) {
      const vals = tokenList(m[2])
      const f = m[1].toLowerCase()
      if (f === 'assignee') basic.assignees = vals.map((v) => (v.toUpperCase() === 'EMPTY' ? null : users.find((u) => u.name === v)?.id ?? v))
      if (f === 'type') basic.types = vals
      if (f === 'status') basic.statuses = vals
      if (f === 'priority') basic.priorities = vals
      if (f === 'labels') basic.labels = vals
      continue
    }
    return null
  }
  return basic
}

export const basicFilterCount = (b) => b.types.length + b.statuses.length + b.priorities.length + b.labels.length

// Column id -> JQL sort field
export const SORT_FIELDS = {
  type: 'type', key: 'key', summary: 'summary', status: 'status', comments: 'comments',
  assignee: 'assignee', dueDate: 'duedate', priority: 'priority', labels: 'labels', parent: 'parent',
  created: 'created', updated: 'updated', reporter: 'reporter', storyPoints: 'Story Points', sprint: 'sprint', fixVersion: 'fixVersion',
}
