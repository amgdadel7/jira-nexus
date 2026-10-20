import React, { useEffect, useMemo, useState } from 'react'
import { api, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon, PriorityIcon } from '../icons.jsx'
import { Avatar, Dropdown, Lozenge, MenuItem, fmtDate, timeAgo, isOverdue, statusCategory } from '../components/ui.jsx'

const GADGETS = {
  assigned: { title: 'Assigned to me', desc: 'Your open work, highest priority first' },
  burndown: { title: 'Sprint burndown', desc: 'Remaining story points in the active sprint' },
  createdResolved: { title: 'Created vs. resolved', desc: 'Work items created and resolved over the last 30 days' },
  stats: { title: 'Work item statistics', desc: 'Breakdown of open work by a field' },
  filter: { title: 'Filter results', desc: 'Results of a saved filter' },
  activity: { title: 'Activity stream', desc: 'Latest changes across the project' },
}
const DEFAULT_LAYOUT = ['assigned', 'burndown', 'createdResolved', 'stats', 'filter', 'activity']
const LAYOUT_KEY = 'jc.dashboard.layout'
const DAY = 864e5
const dayStr = (t) => new Date(t).toISOString().slice(0, 10)

export default function DashboardsPage() {
  const { refreshKey, meta } = useApp()
  const [issues, setIssues] = useState(null)
  const [layout, setLayout] = useState(() => { try { const l = JSON.parse(localStorage.getItem(LAYOUT_KEY)); return Array.isArray(l) ? l.filter((g) => GADGETS[g]) : DEFAULT_LAYOUT } catch { return DEFAULT_LAYOUT } })
  const [editing, setEditing] = useState(false)
  useEffect(() => { api.search(`project = ${getProject()} ORDER BY cf[10019] ASC`).then((d) => setIssues(d.issues)).catch(() => setIssues([])) }, [refreshKey])
  useEffect(() => { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)) } catch { /* ignore */ } }, [layout])

  const move = (g, dir) => setLayout((l) => { const i = l.indexOf(g); const j = i + dir; if (j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n })
  const missing = Object.keys(GADGETS).filter((g) => !layout.includes(g))

  return (
    <div className="page-pad dashboard">
      <div className="page-head">
        <div><h1>Default dashboard</h1><p className="muted">An overview of {meta.project?.name || 'KAN'}. Gadgets update as work changes.</p></div>
        <div className="row-gap">
          {editing && missing.length > 0 && (
            <Dropdown align="end" trigger={({ ref, toggle }) => <button ref={ref} className="btn" onClick={toggle}><Icon name="plus" size={16} />Add gadget</button>}>
              {(close) => <div className="menu">{missing.map((g) => <MenuItem key={g} onClick={() => { close(); setLayout((l) => [...l, g]) }}>{GADGETS[g].title}<div className="menu-sub">{GADGETS[g].desc}</div></MenuItem>)}</div>}
            </Dropdown>
          )}
          {editing && <button className="btn subtle" onClick={() => setLayout(DEFAULT_LAYOUT)}>Reset layout</button>}
          <button className={`btn ${editing ? 'primary' : ''}`} onClick={() => setEditing((e) => !e)}><Icon name={editing ? 'check' : 'edit'} size={16} />{editing ? 'Done' : 'Edit'}</button>
        </div>
      </div>
      {!issues ? <div className="center-pad"><div className="spinner" /></div> : (
        <div className="gadget-grid">
          {layout.map((g, idx) => (
            <section key={g} className={`gadget ${editing ? 'editing' : ''}`}>
              <header className="gadget-head">
                <div><h3>{GADGETS[g].title}</h3></div>
                {editing && (
                  <div className="gadget-tools">
                    <button className="icon-btn small" disabled={idx === 0} onClick={() => move(g, -1)} title="Move up"><Icon name="arrowUp" size={14} /></button>
                    <button className="icon-btn small" disabled={idx === layout.length - 1} onClick={() => move(g, 1)} title="Move down"><Icon name="arrowDown" size={14} /></button>
                    <button className="icon-btn small" onClick={() => setLayout((l) => l.filter((x) => x !== g))} title="Remove gadget"><Icon name="close" size={14} /></button>
                  </div>
                )}
              </header>
              <div className="gadget-body">
                {g === 'assigned' && <AssignedGadget />}
                {g === 'burndown' && <BurndownGadget issues={issues} />}
                {g === 'createdResolved' && <CreatedResolvedGadget issues={issues} />}
                {g === 'stats' && <StatsGadget issues={issues} />}
                {g === 'filter' && <FilterGadget />}
                {g === 'activity' && <ActivityGadget />}
              </div>
            </section>
          ))}
          {!layout.length && <div className="empty-state small"><h3>This dashboard is empty</h3><p>Click Edit, then Add gadget.</p></div>}
        </div>
      )}
    </div>
  )
}

function IssueRows({ issues, empty, right }) {
  const { openIssue, userById } = useApp()
  if (!issues) return <div className="spinner small" />
  if (!issues.length) return <p className="muted">{empty}</p>
  return (
    <table className="gadget-table">
      <tbody>
        {issues.map((i) => (
          <tr key={i.key} onClick={() => openIssue(i.key)}>
            <td style={{ width: 22 }}><TypeIcon type={i.type} size={14} /></td>
            <td style={{ width: 66 }}><span className="issue-key small">{i.key}</span></td>
            <td className="truncate-cell">{i.summary}</td>
            <td style={{ width: 22 }}><PriorityIcon priority={i.priority} size={14} /></td>
            <td style={{ width: 104 }} className="gadget-right">{right ? right(i) : <Lozenge status={i.status} />}</td>
            <td style={{ width: 26 }}><Avatar user={userById[i.assigneeId]} size={20} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AssignedGadget() {
  const { refreshKey, openList } = useApp()
  const [list, setList] = useState(null)
  const jql = 'assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, duedate ASC'
  useEffect(() => { api.search(jql, { maxResults: 8 }).then((d) => setList(d)).catch(() => setList({ issues: [], total: 0 })) }, [refreshKey])
  return (
    <>
      <IssueRows issues={list?.issues} empty="Nothing is assigned to you. 🎉" right={(i) => (i.dueDate ? <span className={`small ${isOverdue(i) ? 'overdue' : 'muted'}`}>{fmtDate(i.dueDate)}</span> : <Lozenge status={i.status} />)} />
      {list?.total > 0 && <button className="link small gadget-more" onClick={() => openList(jql)}>View all {list.total} in list</button>}
    </>
  )
}

function BurndownGadget({ issues }) {
  const { meta, navigate } = useApp()
  const sprint = meta.activeSprint
  if (!sprint) return <p className="muted">No active sprint. <button className="link" onClick={() => navigate({ page: 'project', view: 'backlog' })}>Start one from the backlog.</button></p>
  const items = issues.filter((i) => i.sprint === sprint.name && i.type !== 'Epic')
  const total = items.reduce((n, i) => n + (i.storyPoints || 0), 0)
  const start = Date.parse(`${sprint.startDate}T00:00:00Z`); const end = Date.parse(`${sprint.endDate}T00:00:00Z`)
  const days = Math.max(1, Math.round((end - start) / DAY))
  const today = Math.min(days, Math.max(0, Math.floor((Date.now() - start) / DAY)))
  const remainingAt = (d) => total - items.filter((i) => i.status === 'Done' && i.resolved && Date.parse(i.resolved) < start + (d + 1) * DAY).reduce((n, i) => n + (i.storyPoints || 0), 0)
  const W = 420; const H = 170; const P = { l: 30, r: 10, t: 10, b: 24 }
  const x = (d) => P.l + (d / days) * (W - P.l - P.r)
  const y = (v) => P.t + (1 - v / Math.max(1, total)) * (H - P.t - P.b)
  const actual = Array.from({ length: today + 1 }, (_, d) => [x(d), y(remainingAt(d))])
  const path = actual.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join(' ')
  const remaining = remainingAt(today)
  return (
    <div>
      <div className="gadget-kpis"><div><b>{remaining}</b><span>points remaining</span></div><div><b>{total - remaining}</b><span>points done</span></div><div><b>{Math.max(0, days - today)}</b><span>days left</span></div></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Sprint burndown chart">
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={P.l} x2={W - P.r} y1={y(total * f)} y2={y(total * f)} className="grid" /><text x={P.l - 6} y={y(total * f) + 4} className="axis" textAnchor="end">{Math.round(total * f)}</text></g>)}
        <line x1={x(0)} y1={y(total)} x2={x(days)} y2={y(0)} className="ideal" />
        <path d={path} className="actual" />
        {actual.length > 0 && <circle cx={actual[actual.length - 1][0]} cy={actual[actual.length - 1][1]} r="3.5" className="actual-dot" />}
        <text x={x(0)} y={H - 6} className="axis">{fmtDate(sprint.startDate)}</text>
        <text x={x(days)} y={H - 6} className="axis" textAnchor="end">{fmtDate(sprint.endDate)}</text>
      </svg>
      <div className="chart-legend"><span><i className="lg ideal" />Guideline</span><span><i className="lg actual" />Remaining</span></div>
    </div>
  )
}

function CreatedResolvedGadget({ issues }) {
  const { openList } = useApp()
  const N = 30
  const data = useMemo(() => {
    const today = Date.parse(`${dayStr(Date.now())}T00:00:00Z`)
    return Array.from({ length: N }, (_, k) => {
      const d = dayStr(today - (N - 1 - k) * DAY)
      return { d, created: issues.filter((i) => i.created?.slice(0, 10) === d).length, resolved: issues.filter((i) => i.resolved?.slice(0, 10) === d).length }
    })
  }, [issues])
  const max = Math.max(1, ...data.map((x) => Math.max(x.created, x.resolved)))
  const W = 420; const H = 160; const P = { l: 22, r: 6, t: 8, b: 22 }
  const bw = (W - P.l - P.r) / N
  const h = (v) => (v / max) * (H - P.t - P.b)
  const sum = (k) => data.reduce((n, x) => n + x[k], 0)
  return (
    <div>
      <div className="gadget-kpis">
        <button onClick={() => openList(`project = ${getProject()} AND created >= -30d ORDER BY created DESC`)}><b>{sum('created')}</b><span>created</span></button>
        <button onClick={() => openList(`project = ${getProject()} AND resolved >= -30d ORDER BY resolved DESC`)}><b>{sum('resolved')}</b><span>resolved</span></button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Created vs resolved chart">
        {[0, max].map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={H - P.b - h(v)} y2={H - P.b - h(v)} className="grid" /><text x={P.l - 5} y={H - P.b - h(v) + 4} className="axis" textAnchor="end">{v}</text></g>)}
        {data.map((x, k) => (
          <g key={x.d}>
            <title>{`${fmtDate(x.d)}: ${x.created} created, ${x.resolved} resolved`}</title>
            <rect x={P.l + k * bw + 1} y={H - P.b - h(x.created)} width={bw / 2 - 1} height={h(x.created)} className="cr-created" />
            <rect x={P.l + k * bw + bw / 2} y={H - P.b - h(x.resolved)} width={bw / 2 - 1} height={h(x.resolved)} className="cr-resolved" />
          </g>
        ))}
        <text x={P.l} y={H - 5} className="axis">{fmtDate(data[0].d)}</text>
        <text x={W - P.r} y={H - 5} className="axis" textAnchor="end">Today</text>
      </svg>
      <div className="chart-legend"><span><i className="lg created" />Created</span><span><i className="lg resolved" />Resolved</span></div>
    </div>
  )
}

function StatsGadget({ issues }) {
  const { userById, openList, meta } = useApp()
  const [by, setBy] = useState('status')
  const open = by === 'status' ? issues : issues.filter((i) => i.status !== 'Done')
  const groups = useMemo(() => {
    const m = new Map()
    open.forEach((i) => { const k = by === 'assignee' ? i.assigneeId ?? null : i[by]; m.set(k, (m.get(k) || 0) + 1) })
    const order = by === 'status' ? meta.statuses : by === 'priority' ? meta.priorities : by === 'type' ? meta.types : null
    return [...m.entries()].sort((a, b) => (order ? order.indexOf(a[0]) - order.indexOf(b[0]) : b[1] - a[1]))
  }, [open, by, meta])
  const label = (k) => (by === 'assignee' ? (k ? userById[k]?.name : 'Unassigned') : k)
  const jqlFor = (k) => {
    const base = by === 'status' ? `project = ${getProject()}` : `project = ${getProject()} AND status != Done`
    if (by === 'assignee') return `${base} AND assignee ${k ? `= "${userById[k]?.name}"` : 'IS EMPTY'} ORDER BY cf[10019] ASC`
    return `${base} AND ${by} = "${k}" ORDER BY cf[10019] ASC`
  }
  return (
    <div>
      <div className="segmented small-seg">{[['status', 'Status'], ['priority', 'Priority'], ['assignee', 'Assignee'], ['type', 'Type']].map(([v, l]) => <button key={v} className={by === v ? 'on' : ''} onClick={() => setBy(v)}>{l}</button>)}</div>
      <table className="stat-table">
        <tbody>
          {groups.map(([k, n]) => (
            <tr key={String(k)} onClick={() => openList(jqlFor(k))}>
              <td className="stat-label">
                {by === 'assignee' && <Avatar user={userById[k]} size={18} />}
                {by === 'priority' && <PriorityIcon priority={k} size={14} />}
                {by === 'type' && <TypeIcon type={k} size={14} />}
                {by === 'status' ? <Lozenge status={k} /> : label(k)}
              </td>
              <td className="stat-n">{n}</td>
              <td className="stat-bar"><span className={by === 'status' ? statusCategory(k) : ''} style={{ width: `${(n / Math.max(1, open.length)) * 100}%` }} /></td>
              <td className="stat-pct muted">{Math.round((n / Math.max(1, open.length)) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted small">Total: {open.length}{by !== 'status' && ' open work items'}</div>
    </div>
  )
}

function FilterGadget() {
  const { filters, refreshKey, openList } = useApp()
  const [id, setId] = useState(() => localStorage.getItem('jc.dashboard.filter') || '')
  const [res, setRes] = useState(null)
  const filter = filters.find((f) => String(f.id) === String(id)) || filters.find((f) => f.starred) || filters[0]
  useEffect(() => {
    if (!filter) { setRes({ issues: [], total: 0 }); return }
    setRes(null)
    api.search(filter.jql, { maxResults: 8 }).then(setRes).catch((e) => setRes({ issues: [], total: 0, error: e.message }))
  }, [filter?.id, filter?.jql, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!filters.length) return <p className="muted">No saved filters yet.</p>
  return (
    <div>
      <select className="text-input select gadget-select" value={filter?.id || ''} onChange={(e) => { setId(e.target.value); try { localStorage.setItem('jc.dashboard.filter', e.target.value) } catch { /* ignore */ } }}>
        {filters.map((f) => <option key={f.id} value={f.id}>{f.starred ? '★ ' : ''}{f.name}</option>)}
      </select>
      {res?.error && <div className="field-error"><Icon name="warning" size={14} />{res.error}</div>}
      <IssueRows issues={res?.issues} empty="No work items match this filter." />
      {res?.total > 0 && <button className="link small gadget-more" onClick={() => openList(filter.jql)}>View all {res.total} in list</button>}
    </div>
  )
}

function ActivityGadget() {
  const { refreshKey, userById, openIssue } = useApp()
  const [items, setItems] = useState(null)
  useEffect(() => { api.activity(12).then(setItems).catch(() => setItems([])) }, [refreshKey])
  if (!items) return <div className="spinner small" />
  if (!items.length) return <p className="muted">No activity yet.</p>
  return (
    <ul className="activity-feed compact">
      {items.map((a) => (
        <li key={`${a.kind}-${a.id}`}>
          <Avatar user={userById[a.authorId]} size={24} />
          <div className="activity-body">
            <div><b>{userById[a.authorId]?.name || 'Someone'}</b> {a.kind === 'comment' ? 'commented on' : a.field === 'created' ? 'created' : a.field === 'status' ? <>moved to <Lozenge status={a.to} /></> : `updated ${a.field} of`}{' '}
              <button className="link activity-issue" onClick={() => openIssue(a.key)}>{a.key}</button></div>
            <div className="muted small">{timeAgo(a.created)}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}
