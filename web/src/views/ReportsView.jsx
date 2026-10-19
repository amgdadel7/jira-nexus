import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon } from '../icons.jsx'
import { Avatar, Lozenge, fmtDate } from '../components/ui.jsx'
import { fmtDur } from '../components/TimeTracking.jsx'
import { getProject } from '../api.js'

const STATUS_COLORS = { 'To Do': '#8590A2', 'In Progress': '#1D7AFC', 'In Review': '#6CC3E0', Done: '#22A06B' }
const REPORTS = [
  { id: 'velocity', label: 'Velocity chart', desc: 'Committed vs. completed points per sprint', icon: 'reports' },
  { id: 'sprint', label: 'Sprint report', desc: 'Burndown and what was (not) completed', icon: 'backlog' },
  { id: 'cfd', label: 'Cumulative flow diagram', desc: 'Work in each status over time', icon: 'timeline' },
  { id: 'timesheet', label: 'Timesheet', desc: 'Time logged per person and work item', icon: 'timer' },
]
const short = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

export default function ReportsView() {
  const [report, setReport] = useState(() => localStorage.getItem('jc.report') || 'velocity')
  useEffect(() => { localStorage.setItem('jc.report', report) }, [report])
  return (
    <div className="reports">
      <aside className="reports-nav">
        <h3>Reports</h3>
        {REPORTS.map((r) => (
          <button key={r.id} className={`report-link ${report === r.id ? 'on' : ''}`} onClick={() => setReport(r.id)}>
            <Icon name={r.icon} size={18} /><span><b>{r.label}</b><span className="muted small">{r.desc}</span></span>
          </button>
        ))}
      </aside>
      <section className="report-body">
        {report === 'velocity' && <Velocity />}
        {report === 'sprint' && <SprintReport />}
        {report === 'cfd' && <Cfd />}
        {report === 'timesheet' && <Timesheet />}
      </section>
    </div>
  )
}

function Velocity() {
  const { refreshKey } = useApp()
  const [d, setD] = useState(null)
  useEffect(() => { api.velocity().then(setD).catch(() => setD({ sprints: [], averageVelocity: 0 })) }, [refreshKey])
  if (!d) return <div className="spinner" />
  const W = 720; const H = 280; const pad = { l: 40, r: 16, t: 16, b: 44 }
  const max = Math.max(10, ...d.sprints.flatMap((s) => [s.committed, s.completed]))
  const nice = Math.ceil(max / 5) * 5
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / nice)
  const band = (W - pad.l - pad.r) / Math.max(1, d.sprints.length)
  const bw = Math.min(28, band / 3)
  return (
    <div>
      <div className="report-head"><div><h2>Velocity chart</h2><p className="muted">Story points committed at sprint start vs. completed by the end, for the last {d.sprints.length || 'few'} sprints.</p></div>
        <div className="kpi"><b>{d.averageVelocity}</b><span>average velocity</span></div></div>
      {!d.sprints.length ? <div className="empty-state"><Icon name="reports" size={32} /><p>Complete a sprint to see your team’s velocity.</p></div> : (
        <>
          <svg className="report-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Velocity chart">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={pad.l} x2={W - pad.r} y1={y(nice * f)} y2={y(nice * f)} stroke="#DFE1E6" /><text x={pad.l - 8} y={y(nice * f) + 4} textAnchor="end" className="axis">{Math.round(nice * f)}</text></g>)}
            {d.averageVelocity > 0 && <g><line x1={pad.l} x2={W - pad.r} y1={y(d.averageVelocity)} y2={y(d.averageVelocity)} stroke="#22A06B" strokeDasharray="5 4" /><text x={W - pad.r} y={y(d.averageVelocity) - 6} textAnchor="end" className="axis" fill="#216E4E">avg {d.averageVelocity}</text></g>}
            {d.sprints.map((s, i) => {
              const cx = pad.l + band * i + band / 2
              return (
                <g key={s.id}>
                  <rect x={cx - bw - 2} y={y(s.committed)} width={bw} height={y(0) - y(s.committed)} fill="#B3B9C4" rx="2"><title>{`${s.name}: committed ${s.committed}`}</title></rect>
                  <rect x={cx + 2} y={y(s.completed)} width={bw} height={y(0) - y(s.completed)} fill="#22A06B" rx="2"><title>{`${s.name}: completed ${s.completed}`}</title></rect>
                  <text x={cx} y={H - pad.b + 18} textAnchor="middle" className="axis">{s.name.replace(/^.*Sprint /, 'Sprint ')}</text>
                </g>
              )
            })}
          </svg>
          <div className="legend"><span><i style={{ background: '#B3B9C4' }} />Commitment</span><span><i style={{ background: '#22A06B' }} />Completed</span></div>
          <table className="data-table compact"><thead><tr><th>Sprint</th><th>Dates</th><th>Commitment</th><th>Completed</th><th>Say/do</th></tr></thead>
            <tbody>{[...d.sprints].reverse().map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td className="muted">{s.startDate ? `${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}` : '—'}</td><td>{s.committed}</td><td>{s.completed}</td><td>{s.committed ? `${Math.round((s.completed / s.committed) * 100)}%` : '—'}</td></tr>)}</tbody></table>
        </>
      )}
    </div>
  )
}

function SprintReport() {
  const { refreshKey } = useApp()
  const [sprints, setSprints] = useState(null)
  const [id, setId] = useState('')
  const [d, setD] = useState(null)
  useEffect(() => {
    api.sprints('active,closed').then((list) => { setSprints(list); setId((cur) => cur || String(list[0]?.id || '')) }).catch(() => setSprints([]))
  }, [refreshKey])
  useEffect(() => { if (id) { setD(null); api.sprintReport(id).then(setD).catch(() => setD(null)) } }, [id, refreshKey])
  if (!sprints) return <div className="spinner" />
  if (!sprints.length) return <div><div className="report-head"><h2>Sprint report</h2></div><div className="empty-state"><Icon name="backlog" size={32} /><p>Start a sprint from the backlog to see its report.</p></div></div>
  return (
    <div>
      <div className="report-head">
        <div><h2>Sprint report</h2>{d && <p className="muted">{d.sprint.state === 'active' ? 'Active' : 'Closed'} · {d.sprint.startDate ? `${fmtDate(d.sprint.startDate)} – ${fmtDate(d.sprint.endDate)}` : ''}{d.sprint.goal ? ` · Goal: ${d.sprint.goal}` : ''}</p>}</div>
        <select className="text-input auto" value={id} onChange={(e) => setId(e.target.value)} aria-label="Sprint">
          {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}{s.state === 'active' ? ' (active)' : ''}</option>)}
        </select>
      </div>
      {!d ? <div className="spinner" /> : (
        <>
          <div className="kpi-row">
            <div className="kpi"><b>{d.summary.completed}</b><span>completed · {d.summary.completedPoints} pts</span></div>
            <div className="kpi"><b>{d.summary.notCompleted}</b><span>not completed · {d.summary.notCompletedPoints} pts</span></div>
            {d.summary.removed > 0 && <div className="kpi"><b>{d.summary.removed}</b><span>removed from sprint</span></div>}
          </div>
          {d.burndown && <Burndown b={d.burndown} />}
          <IssueTable title="Completed work items" issues={d.completed} />
          <IssueTable title={d.sprint.state === 'closed' ? 'Work items not completed (moved on at sprint end)' : 'Work items not completed yet'} issues={d.notCompleted} />
          {d.removed.length > 0 && <IssueTable title="Removed from sprint" issues={d.removed} />}
        </>
      )}
    </div>
  )
}

function Burndown({ b }) {
  const W = 720; const H = 240; const pad = { l: 40, r: 16, t: 14, b: 34 }
  const days = Math.max(1, Math.round((Date.parse(b.end) - Date.parse(b.start)) / 864e5))
  const max = Math.max(5, b.total)
  const x = (i) => pad.l + ((W - pad.l - pad.r) * i) / days
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const steps = b.points.map((p, i) => `${i ? 'H' : 'M'}${x(i)} ${i ? '' : y(p.remaining)}${i ? `V${y(p.remaining)}` : ''}`).join(' ')
  return (
    <div className="report-card">
      <h4>Burndown</h4>
      <svg className="report-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sprint burndown">
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="#DFE1E6" /><text x={pad.l - 8} y={y(max * f) + 4} textAnchor="end" className="axis">{Math.round(max * f)}</text></g>)}
        <line x1={x(0)} y1={y(b.total)} x2={x(days)} y2={y(0)} stroke="#8590A2" strokeDasharray="5 4" />
        <path d={steps} fill="none" stroke="#E2483D" strokeWidth="2.2" />
        {b.points.length > 0 && <circle cx={x(b.points.length - 1)} cy={y(b.points.at(-1).remaining)} r="4" fill="#E2483D" />}
        <text x={x(0)} y={H - 10} className="axis">{short(b.start)}</text>
        <text x={x(days)} y={H - 10} textAnchor="end" className="axis">{short(b.end)}</text>
      </svg>
      <div className="legend"><span><i style={{ background: '#8590A2' }} />Guideline</span><span><i style={{ background: '#E2483D' }} />Remaining points</span></div>
    </div>
  )
}

function IssueTable({ title, issues }) {
  const { openIssue, userById } = useApp()
  return (
    <div className="report-card">
      <h4>{title} <span className="count-pill">{issues.length}</span></h4>
      {!issues.length ? <p className="muted small">None.</p> : (
        <table className="data-table compact clickable"><tbody>
          {issues.map((i) => (
            <tr key={i.key} onClick={() => openIssue(i.key)}>
              <td style={{ width: 24 }}><TypeIcon type={i.type} size={14} /></td><td style={{ width: 80 }} className="issue-key small">{i.key}</td>
              <td>{i.summary}</td><td style={{ width: 110 }}><Lozenge status={i.status} /></td>
              <td style={{ width: 40 }} className="muted">{i.storyPoints ?? '–'}</td>
              <td style={{ width: 30 }}>{i.assigneeId && <Avatar user={userById[i.assigneeId]} size={20} />}</td>
            </tr>
          ))}
        </tbody></table>
      )}
    </div>
  )
}

function Cfd() {
  const { refreshKey } = useApp()
  const [days, setDays] = useState(30)
  const [d, setD] = useState(null)
  const [hidden, setHidden] = useState([])
  useEffect(() => { api.cfd(days).then(setD).catch(() => setD(null)) }, [days, refreshKey])
  const layers = useMemo(() => {
    if (!d) return []
    // Stack bottom-up: Done at the bottom, To Do on top (like Jira).
    const order = [...d.statuses].reverse().filter((s) => !hidden.includes(s))
    const acc = d.dates.map(() => 0)
    return order.map((s) => { const lo = [...acc]; d.series[s].forEach((v, i) => { acc[i] += v }); return { s, lo, hi: [...acc] } })
  }, [d, hidden])
  if (!d) return <div className="spinner" />
  const W = 720; const H = 300; const pad = { l: 40, r: 16, t: 14, b: 34 }
  const max = Math.max(5, ...(layers.at(-1)?.hi || [0]))
  const n = d.dates.length
  const x = (i) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, n - 1)
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const area = (l) => `M${l.hi.map((v, i) => `${x(i)} ${y(v)}`).join(' L')} L${l.lo.map((v, i) => `${x(i)} ${y(v)}`).reverse().join(' L')} Z`
  const last = d.statuses.map((s) => [s, d.series[s].at(-1)])
  return (
    <div>
      <div className="report-head">
        <div><h2>Cumulative flow diagram</h2><p className="muted">How many work items were in each status at the end of each day. Widening bands show where work piles up.</p></div>
        <div className="segmented">{[14, 30, 60, 90].map((n2) => <button key={n2} className={days === n2 ? 'on' : ''} onClick={() => setDays(n2)}>{n2}d</button>)}</div>
      </div>
      <svg className="report-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cumulative flow diagram">
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="#DFE1E6" /><text x={pad.l - 8} y={y(max * f) + 4} textAnchor="end" className="axis">{Math.round(max * f)}</text></g>)}
        {layers.map((l) => <path key={l.s} d={area(l)} fill={STATUS_COLORS[l.s] || '#ccc'} opacity=".85"><title>{l.s}</title></path>)}
        <text x={x(0)} y={H - 10} className="axis">{short(d.dates[0])}</text>
        <text x={x(n - 1)} y={H - 10} textAnchor="end" className="axis">Today</text>
      </svg>
      <div className="legend">
        {last.map(([s, v]) => (
          <button key={s} className={`legend-toggle ${hidden.includes(s) ? 'off' : ''}`} onClick={() => setHidden((h) => (h.includes(s) ? h.filter((x2) => x2 !== s) : [...h, s]))} aria-pressed={!hidden.includes(s)}>
            <i style={{ background: STATUS_COLORS[s] }} />{s} <b>{v}</b>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- timesheet */
const isoDay = (d) => d.toISOString().slice(0, 10)
const hrs = (sec) => (sec ? (Math.round((sec / 3600) * 10) / 10).toString() : '')
function weekStartOf(date, start) {
  const idx = { sunday: 0, monday: 1, saturday: 6 }[start] ?? 0
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - idx + 7) % 7))
  return d
}
function Timesheet() {
  const { refreshKey, userById, prefs, openIssue } = useApp()
  const [range, setRange] = useState('2weeks')
  const home = (r) => new Date(weekStartOf(new Date(), prefs?.weekStart).getTime() - (r === 'week' ? 0 : 7 * 864e5)) // current week, or last + current
  const [anchor, setAnchor] = useState(() => home('2weeks'))
  const [by, setBy] = useState('user')
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)
  const span = range === 'week' ? 7 : 14
  const from = isoDay(anchor)
  const to = isoDay(new Date(anchor.getTime() + (span - 1) * 864e5))
  useEffect(() => { setErr(null); api.timesheet(getProject(), from, to).then(setD).catch((e) => setErr(e.message)) }, [from, to, refreshKey])
  const shift = (n) => setAnchor((a) => new Date(a.getTime() + n * span * 864e5))
  const rows = !d ? [] : by === 'user' ? d.users.map((u) => ({ id: u.userId, label: <span className="inline-flex"><Avatar user={userById[u.userId]} size={22} />{userById[u.userId]?.name || u.userId}</span>, days: u.days, total: u.total }))
    : d.issues.map((i) => ({ id: i.key, label: <button className="link inline-flex" onClick={() => openIssue(i.key)}><TypeIcon type={i.type} /><span className="muted">{i.key}</span><span className="truncate" style={{ maxWidth: 260 }}>{i.summary}</span></button>, days: i.days, total: i.total }))
  const max = Math.max(1, ...rows.flatMap((r) => Object.values(r.days)))
  return (
    <div data-testid="timesheet">
      <div className="report-head"><div><h2>Timesheet</h2><p className="muted">Hours logged in {getProject()} between {short(from)} and {short(to)}. A working day is {d?.workingDay.hoursPerDay ?? 8}h.</p></div>
        <div className="kpi"><b>{d ? fmtDur(d.total) : '–'}</b><span>logged in range</span></div></div>
      <div className="toolbar">
        <button className="icon-btn" title="Previous" onClick={() => shift(-1)}><Icon name="chevronLeft" size={16} /></button>
        <button className="btn subtle" onClick={() => setAnchor(home(range))}>Today</button>
        <button className="icon-btn" title="Next" onClick={() => shift(1)}><Icon name="chevronRight" size={16} /></button>
        <select className="text-input auto" aria-label="Range" value={range} onChange={(e) => { setRange(e.target.value); setAnchor(home(e.target.value)) }}><option value="week">1 week</option><option value="2weeks">2 weeks</option></select>
        <div className="cycle-toggle" role="radiogroup" aria-label="Group by">
          {[['user', 'People'], ['issue', 'Work items']].map(([id, l]) => <button key={id} type="button" role="radio" aria-checked={by === id} className={by === id ? 'on' : ''} onClick={() => setBy(id)}>{l}</button>)}
        </div>
      </div>
      {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
      {!d ? <div className="spinner" /> : rows.length === 0 ? <div className="empty-state"><Icon name="timer" size={32} /><p>No time was logged in this period.</p></div> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table ts-table">
            <thead><tr><th style={{ minWidth: 220 }}>{by === 'user' ? 'Person' : 'Work item'}</th>{d.days.map((day) => { const dt = new Date(`${day}T00:00:00Z`); const we = [5, 6].includes(dt.getUTCDay()); return <th key={day} className={`num ${we ? 'muted' : ''}`} style={{ width: 56 }}>{dt.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}<div className="small muted">{dt.getUTCDate()}</div></th> })}<th className="num" style={{ width: 80 }}>Total</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  {d.days.map((day) => <td key={day} className={`num ${r.days[day] ? '' : 'zero'}`} title={r.days[day] ? fmtDur(r.days[day]) : undefined}>{hrs(r.days[day]) || '–'}{r.days[day] ? <span className="ts-cell-bar" style={{ width: `${Math.max(8, (r.days[day] / max) * 100)}%` }} /> : null}</td>)}
                  <td className="num"><b>{fmtDur(r.total)}</b></td>
                </tr>
              ))}
              <tr className="total"><td>Total</td>{d.days.map((day) => { const t = rows.reduce((a, r) => a + (r.days[day] || 0), 0); return <td key={day} className={`num ${t ? '' : 'zero'}`}>{hrs(t) || '–'}</td> })}<td className="num">{fmtDur(d.total)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {d && <div className="muted small" style={{ marginTop: 12 }}>Project estimates: {fmtDur(d.estimates.original) || '0m'} original · {fmtDur(d.estimates.spent) || '0m'} logged · {fmtDur(d.estimates.remaining) || '0m'} remaining ({d.estimates.estimatedItems} of {d.estimates.items} work items estimated)</div>}
    </div>
  )
}
