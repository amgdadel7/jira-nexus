import React, { useEffect, useState } from 'react'
import { api, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon, PriorityIcon } from '../icons.jsx'
import { Avatar, Lozenge, todayStr, timeAgo } from '../components/ui.jsx'

const STATUS_COLORS = { 'To Do': '#8590A2', 'In Progress': '#1D7AFC', 'In Review': '#6CC3E0', Done: '#22A06B' }

export default function SummaryView({ onViewList }) {
  const { meta, refreshKey, userById, openIssue } = useApp()
  const [issues, setIssues] = useState(null)
  const [activity, setActivity] = useState(null)
  useEffect(() => { api.activity(25).then(setActivity).catch(() => setActivity([])) }, [refreshKey])
  useEffect(() => { api.search(`project = ${getProject()} ORDER BY updated DESC`).then((d) => setIssues(d.issues)) }, [refreshKey])
  if (!issues) return <div className="center-pad"><div className="spinner" /></div>

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString()
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
  const stats = [
    { icon: 'check', n: issues.filter((i) => i.resolved && i.resolved >= weekAgo).length, label: 'completed', sub: 'in the last 7 days', jql: `project = ${getProject()} AND resolved >= -7d ORDER BY resolved DESC` },
    { icon: 'edit', n: issues.filter((i) => i.updated >= weekAgo).length, label: 'updated', sub: 'in the last 7 days', jql: `project = ${getProject()} AND updated >= -7d ORDER BY updated DESC` },
    { icon: 'plus', n: issues.filter((i) => i.created >= weekAgo).length, label: 'created', sub: 'in the last 7 days', jql: `project = ${getProject()} AND created >= -7d ORDER BY created DESC` },
    { icon: 'calendar', n: issues.filter((i) => i.dueDate && i.status !== 'Done' && i.dueDate >= todayStr() && i.dueDate <= in7).length, label: 'due soon', sub: 'in the next 7 days', jql: `project = ${getProject()} AND status != Done AND duedate >= startOfDay() AND duedate <= 7d ORDER BY duedate ASC` },
  ]
  const byStatus = meta.statuses.map((s) => ({ s, n: issues.filter((i) => i.status === s).length }))
  const total = issues.length
  let acc = 0
  const R = 60; const C = 2 * Math.PI * R

  return (
    <div className="summary-view">
      <div className="stat-row">
        {stats.map((s) => (
          <button key={s.label} className="stat-card" onClick={() => onViewList(s.jql)}>
            <span className="stat-icon"><Icon name={s.icon} size={18} /></span>
            <span><b>{s.n} {s.label}</b><span className="muted">{s.sub}</span></span>
          </button>
        ))}
      </div>
      <div className="summary-grid">
        <section className="panel">
          <h3>Status overview</h3>
          <p className="muted">Get a snapshot of the status of your work items.</p>
          <div className="donut-wrap">
            <svg width="170" height="170" viewBox="0 0 170 170">
              <g transform="rotate(-90 85 85)">
                {byStatus.map(({ s, n }) => {
                  const len = total ? (n / total) * C : 0
                  const el = <circle key={s} cx="85" cy="85" r={R} fill="none" stroke={STATUS_COLORS[s]} strokeWidth="22" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />
                  acc += len
                  return el
                })}
              </g>
              <text x="85" y="82" textAnchor="middle" className="donut-n">{total}</text>
              <text x="85" y="102" textAnchor="middle" className="donut-l">Total work items</text>
            </svg>
            <ul className="legend">
              {byStatus.map(({ s, n }) => (
                <li key={s}><button className="link-plain" onClick={() => onViewList(`project = ${getProject()} AND status = "${s}" ORDER BY cf[10019] ASC`)}><span className="dot" style={{ background: STATUS_COLORS[s] }} />{s}: {n}</button></li>
              ))}
            </ul>
          </div>
        </section>
        <section className="panel">
          <h3>Priority breakdown</h3>
          <p className="muted">Get a holistic view of how work is being prioritized.</p>
          <div className="bars">
            {meta.priorities.map((p) => {
              const n = issues.filter((i) => i.priority === p).length
              const max = Math.max(...meta.priorities.map((x) => issues.filter((i) => i.priority === x).length), 1)
              return (
                <button key={p} className="bar-col" onClick={() => onViewList(`project = ${getProject()} AND priority = ${p} ORDER BY cf[10019] ASC`)} title={`${p}: ${n}`}>
                  <span className="bar-n">{n}</span>
                  <span className="bar" style={{ height: `${(n / max) * 120}px` }} />
                  <span className="bar-label"><PriorityIcon priority={p} />{p}</span>
                </button>
              )
            })}
          </div>
        </section>
        <section className="panel">
          <h3>Types of work</h3>
          <p className="muted">Get a breakdown of work items by their types.</p>
          <table className="dist">
            <tbody>
              {meta.types.map((t) => {
                const n = issues.filter((i) => i.type === t).length
                return (
                  <tr key={t} onClick={() => onViewList(`project = ${getProject()} AND type = ${t} ORDER BY cf[10019] ASC`)}>
                    <td className="dist-label"><TypeIcon type={t} />{t}</td>
                    <td className="dist-bar"><span style={{ width: `${total ? (n / total) * 100 : 0}%` }}><b>{total ? Math.round((n / total) * 100) : 0}%</b></span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h3>Team workload</h3>
          <p className="muted">Monitor the capacity of your team.</p>
          <table className="dist">
            <tbody>
              {[...meta.users.filter((u) => u.active).map((u) => u.id), null].map((id) => {
                const n = issues.filter((i) => (i.assigneeId ?? null) === id).length
                const u = userById[id]
                return (
                  <tr key={id ?? 'none'} onClick={() => onViewList(`project = ${getProject()} AND assignee ${id ? `= "${u.name}"` : 'IS EMPTY'} ORDER BY cf[10019] ASC`)}>
                    <td className="dist-label"><Avatar user={u} size={22} />{u ? u.name : 'Unassigned'}</td>
                    <td className="dist-bar"><span style={{ width: `${total ? (n / total) * 100 : 0}%` }}><b>{total ? Math.round((n / total) * 100) : 0}%</b></span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
        <section className="panel activity-panel">
          <h3>Recent activity</h3>
          <p className="muted">Stay up to date with what’s happening across the project.</p>
          {!activity ? <div className="spinner" /> : !activity.length ? <p className="muted">No activity yet.</p> : (
            <ul className="activity-feed">
              {activity.map((a) => (
                <li key={`${a.kind}-${a.id}`}>
                  <Avatar user={userById[a.authorId]} size={28} />
                  <div className="activity-body">
                    <div>
                      <b>{userById[a.authorId]?.name || 'Someone'}</b>{' '}
                      {a.kind === 'comment' ? 'commented on' : describe(a)}{' '}
                      <button className="link activity-issue" onClick={() => openIssue(a.key)}><TypeIcon type={a.type} size={14} />{a.key}: {a.summary}</button>
                      {a.kind === 'history' && a.field === 'status' && a.to && <> <Lozenge status={a.to} /></>}
                    </div>
                    {a.kind === 'comment' && <div className="activity-quote">{a.body.length > 160 ? `${a.body.slice(0, 160)}…` : a.body}</div>}
                    <div className="muted small">{timeAgo(a.created)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

const FIELD_LABEL = { status: 'status', assignee: 'assignee', priority: 'priority', summary: 'summary', description: 'description', labels: 'labels', duedate: 'due date', dueDate: 'due date', startDate: 'start date', parent: 'parent', type: 'work type', storyPoints: 'story points', sprint: 'sprint', reporter: 'reporter', attachment: 'attachment', link: 'link' }
function describe(a) {
  if (a.field === 'created') return 'created'
  if (a.field === 'status') return 'changed the status of'
  if (a.field === 'attachment') return a.to ? 'attached a file to' : 'removed an attachment from'
  if (a.field === 'link') return a.to ? 'linked' : 'removed a link from'
  return `updated the ${FIELD_LABEL[a.field] || a.field} of`
}
