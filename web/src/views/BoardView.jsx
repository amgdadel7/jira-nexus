import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon, PriorityIcon } from '../icons.jsx'
import { Avatar, fmtDate, isOverdue, SkeletonBoard } from '../components/ui.jsx'
import { useFlip, flashIssue } from '../motion.js'
import { CompleteSprintModal, daysLeft } from './BacklogView.jsx'

export default function BoardView() {
  const { meta, activeUsers: users, refreshKey, openIssue, toast, userById, navigate, refreshMeta, bump, isSoftware, can } = useApp()
  const boardCfg = meta.project.board || { wip: {}, swimlanes: 'none' }
  const [swim, setSwim] = useState(() => localStorage.getItem(`jc.swim.${meta.project.key}`) || boardCfg.swimlanes || 'none')
  useEffect(() => { localStorage.setItem(`jc.swim.${meta.project.key}`, swim) }, [swim, meta.project.key])
  const [collapsedLanes, setCollapsedLanes] = useState(() => new Set())
  const canMove = can('TRANSITION_ISSUES') && can('EDIT_ISSUES')
  const canCreate = can('CREATE_ISSUES')
  const sprint = meta.activeSprint
  const [scope, setScope] = useState(sprint ? 'sprint' : 'all')
  const [completing, setCompleting] = useState(false)
  const inSprint = scope === 'sprint' && sprint
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [who, setWho] = useState([])
  const [dragKey, setDragKey] = useState(null)
  const [over, setOver] = useState(null) // { status, beforeKey }
  const [creating, setCreating] = useState(null)
  const boardRef = useRef(null)

  const load = useCallback(() => {
    setLoading(true)
    api.search(`project = ${getProject()} AND type != Epic${inSprint ? ' AND sprint in openSprints()' : ''} ORDER BY cf[10019] ASC`).then((d) => setIssues(d.issues)).catch((e) => toast({ title: 'Failed to load board', description: e.message, error: true })).finally(() => setLoading(false))
  }, [toast, inSprint]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load, refreshKey])
  useEffect(() => { if (!sprint && scope === 'sprint') setScope('all') }, [sprint, scope])

  useFlip(boardRef, [issues, swim, q, who])
  const filtered = useMemo(() => issues.filter((i) =>
    (!q || `${i.key} ${i.summary}`.toLowerCase().includes(q.toLowerCase())) &&
    (!who.length || who.includes(i.assigneeId ?? null))), [issues, q, who])

  const onDrop = async (status, beforeKey) => {
    const key = dragKey
    setDragKey(null); setOver(null)
    if (!key) return
    const src = issues.find((i) => i.key === key)
    if (!src || (beforeKey === key)) return
    setIssues((list) => {
      const rest = list.filter((i) => i.key !== key)
      const moved = { ...src, status }
      let idx = beforeKey ? rest.findIndex((i) => i.key === beforeKey) : -1
      if (idx === -1) {
        // put after the last card of this column
        const lastIdx = rest.map((i) => i.status).lastIndexOf(status)
        idx = lastIdx === -1 ? rest.length : lastIdx + 1
      }
      rest.splice(idx, 0, moved)
      return rest
    })
    try {
      if (beforeKey) await api.rank(key, { beforeKey })
      else {
        const col = filtered.filter((i) => i.status === status && i.key !== key)
        if (col.length) await api.rank(key, { afterKey: col[col.length - 1].key })
      }
      if (src.status !== status) await api.update(key, { status })
      flashIssue(key)
    } catch (e) { toast({ title: 'Couldn’t move card', description: e.message, error: true }); load() }
  }

  const create = async (status, summary) => {
    try {
      const issue = await api.create({ summary, status, type: 'Task', ...(inSprint ? { sprint: sprint.name } : {}) })
      setIssues((l) => [...l, issue])
      toast(`${issue.key} has been created`)
      flashIssue(issue.key)
    } catch (e) { toast({ title: 'Couldn’t create', description: e.message, error: true }) }
  }

  return (
    <div className="board-view">
      <h1 className="sr-only">Board - {meta.project.name}</h1>
      {sprint && (
        <div className="sprint-bar">
          <div className="sprint-bar-main">
            <b>{sprint.name}</b>
            {sprint.endDate && <span className={`sprint-days ${daysLeft(sprint.endDate) < 0 ? 'overdue' : ''}`}><Icon name="clock" size={14} />{daysLeft(sprint.endDate) >= 0 ? `${daysLeft(sprint.endDate)} days remaining` : `${-daysLeft(sprint.endDate)} days overdue`}</span>}
            {sprint.startDate && <span className="muted small">{fmtDate(sprint.startDate)} – {fmtDate(sprint.endDate)}</span>}
            {sprint.goal && <span className="sprint-goal truncate"><Icon name="goals" size={12} /> {sprint.goal}</span>}
          </div>
          <div className="segmented">
            <button className={scope === 'sprint' ? 'on' : ''} onClick={() => setScope('sprint')}>Active sprint</button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All work</button>
          </div>
          {can('MANAGE_SPRINTS') && <button className="btn" onClick={() => setCompleting(true)}>Complete sprint</button>}
        </div>
      )}
      {!sprint && isSoftware && (
        <div className="sprint-bar empty">
          <span className="muted">No active sprint. Showing all work.</span>
          <button className="btn" onClick={() => navigate({ page: 'project', view: 'backlog' })}>Go to backlog to start a sprint</button>
        </div>
      )}
      {completing && sprint && <CompleteSprintModal sprint={{ ...sprint, stats: { total: issues.length, done: issues.filter((i) => i.status === 'Done').length, points: 0, donePoints: 0 } }} onClose={() => setCompleting(false)} onCompleted={async () => { setCompleting(false); await refreshMeta(); bump() }} />}
      <div className="toolbar">
        <label className="list-search">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search board" />
        </label>
        <div className="avatar-filter">
          {users.map((u) => (
            <button key={u.id} className={`avatar-toggle ${who.includes(u.id) ? 'on' : ''}`} onClick={() => setWho((w) => (w.includes(u.id) ? w.filter((x) => x !== u.id) : [...w, u.id]))}>
              <Avatar user={u} size={32} />
            </button>
          ))}
          <button className={`avatar-toggle ${who.includes(null) ? 'on' : ''}`} onClick={() => setWho((w) => (w.includes(null) ? w.filter((x) => x !== null) : [...w, null]))}><Avatar user={null} size={32} /></button>
        </div>
        {(q || who.length > 0) && <button className="btn subtle" onClick={() => { setQ(''); setWho([]) }}>Clear filters</button>}
        <span className="spacer" />
        {loading && <div className="spinner small" />}
        {!canMove && <span className="readonly-chip" title="Your role can’t move cards on this board"><Icon name="lock" size={14} />Read-only</span>}
        <label className="inline-flex small muted">Group by
          <select className="text-input auto" aria-label="Swimlanes" value={swim} onChange={(e) => setSwim(e.target.value)}>
            <option value="none">None</option><option value="assignee">Assignee</option><option value="epic">Epic</option><option value="priority">Priority</option><option value="type">Work type</option>
          </select>
        </label>
        {can('ADMINISTER_PROJECT') && <button className="icon-btn" title="Board settings" aria-label="Board settings" onClick={() => navigate({ page: 'settings', section: 'board' })}><Icon name="settings" size={16} /></button>}
      </div>
      {swim !== 'none' && (
        <div className="board board-headers">
          {meta.statuses.map((status) => <ColumnHeader key={status} status={status} count={filtered.filter((i) => i.status === status).length} limit={boardCfg.wip?.[status]} />)}
        </div>
      )}
      {loading && !issues.length ? <SkeletonBoard columns={meta.statuses.length} /> : <div ref={boardRef} className="board-lanes">
      {buildLanes(filtered, swim, { meta, userById }).map((lane) => {
        const collapsed = collapsedLanes.has(lane.id)
        return (
          <div key={lane.id} className={`swimlane ${swim !== 'none' ? 'grouped' : ''}`} data-lane={lane.label}>
            {swim !== 'none' && (
              <button className="lane-head" aria-expanded={!collapsed} onClick={() => setCollapsedLanes((c) => { const n = new Set(c); if (n.has(lane.id)) n.delete(lane.id); else n.add(lane.id); return n })}>
                <span className={`lane-chevron ${collapsed ? '' : 'open'}`}><Icon name="chevronRight" size={14} /></span>{lane.icon}<b>{lane.label}</b><span className="muted small">{lane.cards.length} work item{lane.cards.length === 1 ? '' : 's'}</span>
              </button>
            )}
            {!collapsed && (
              <div className="board">
                {meta.statuses.map((status) => {
                  const cards = lane.cards.filter((i) => i.status === status)
                  const overKey = `${lane.id}|${status}`
                  return (
                    <div key={status} className={`board-col ${over?.col === overKey ? 'drag-over' : ''} ${swim === 'none' && boardCfg.wip?.[status] && filtered.filter((i) => i.status === status).length > boardCfg.wip[status] ? 'over-limit' : ''}`}
                      onDragOver={(e) => { if (!dragKey) return; e.preventDefault(); if (!over || over.col !== overKey || over.beforeKey) setOver({ status, col: overKey, beforeKey: null }) }}
                      onDrop={(e) => { e.preventDefault(); onDrop(status, over?.col === overKey ? over.beforeKey : null) }}>
                      {swim === 'none' && <ColumnHeader status={status} count={cards.length} limit={boardCfg.wip?.[status]} />}
                      <div className="board-cards">
                        {cards.map((i) => (
                          <div key={i.key} data-issue-key={i.key} data-flip-key={i.key}
                            className={`card ${dragKey === i.key ? 'dragging' : ''} ${over?.beforeKey === i.key ? 'drop-before' : ''} ${canMove ? '' : 'locked'}`}
                            draggable={canMove} onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', i.key); setDragKey(i.key) }}
                            onDragEnd={() => { setDragKey(null); setOver(null) }}
                            onDragOver={(e) => { if (!dragKey) return; e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const before = e.clientY < r.top + r.height / 2; const idx = cards.indexOf(i); const beforeKey = before ? i.key : cards[idx + 1]?.key ?? null; if (over?.beforeKey !== beforeKey || over?.col !== overKey) setOver({ status, col: overKey, beforeKey }) }}
                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(status, over?.beforeKey ?? null) }}
                            onClick={() => openIssue(i.key)}>
                            <div className="card-summary">{i.summary}</div>
                            {(i.parent || i.labels.length > 0 || (i.components || []).length > 0) && (
                              <div className="card-tags">
                                {i.parent && <span className="epic-tag">{i.parent.summary}</span>}
                                {(i.components || []).slice(0, 1).map((c) => <span key={c} className="component-chip">{c}</span>)}
                                {i.labels.slice(0, 2).map((l) => <span key={l} className="label-chip">{l}</span>)}
                              </div>
                            )}
                            {i.dueDate && <div className={`card-due ${isOverdue(i) ? 'overdue' : ''}`}><Icon name="calendar" size={12} />{fmtDate(i.dueDate)}</div>}
                            <div className="card-footer">
                              <TypeIcon type={i.type} />
                              <span className={`card-key ${i.status === 'Done' ? 'done' : ''}`}>{i.key}</span>
                              <span className="spacer" />
                              {i.storyPoints != null && <span className="points">{i.storyPoints}</span>}
                              <PriorityIcon priority={i.priority} />
                              <Avatar user={userById[i.assigneeId]} size={24} />
                            </div>
                          </div>
                        ))}
                        {over?.col === overKey && !over.beforeKey && dragKey && <div className="board-col-drop-end" />}
                        {canCreate && swim === 'none' && (creating === status ? (
                          <form className="card create-card" onSubmit={(e) => { e.preventDefault(); const v = e.target.summary.value.trim(); if (v) { create(status, v); e.target.reset() } }}>
                            <textarea name="summary" autoFocus placeholder="What needs to be done?" rows={2}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit() } if (e.key === 'Escape') setCreating(null) }}
                              onBlur={(e) => { if (!e.target.value.trim()) setCreating(null) }} />
                          </form>
                        ) : (
                          <button className="create-trigger board-create" onClick={() => setCreating(status)}><Icon name="plus" size={16} />Create</button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      </div>}
    </div>
  )
}

function ColumnHeader({ status, count, limit }) {
  const over = limit && count > limit
  return (
    <div className={`board-col-header ${over ? 'over-limit' : ''}`} title={limit ? `Limit: ${limit}${over ? ' (exceeded)' : ''}` : undefined}>
      <span>{status}</span><span className="board-count">{limit ? `${count} / ${limit}` : count}</span>
      {over && <span className="wip-flag">Max {limit}</span>}
      {status === 'Done' && <Icon name="check" size={14} strokeWidth={2.6} style={{ color: '#22A06B' }} />}
    </div>
  )
}

function buildLanes(issues, swim, { meta, userById }) {
  if (swim === 'none') return [{ id: 'all', label: 'All', cards: issues }]
  const map = new Map()
  const add = (id, label, icon, order, i) => { if (!map.has(id)) map.set(id, { id, label, icon, order, cards: [] }); map.get(id).cards.push(i) }
  for (const i of issues) {
    if (swim === 'assignee') { const u = userById[i.assigneeId]; add(i.assigneeId || 'none', u?.name || 'Unassigned', <Avatar user={u} size={20} />, u ? u.name : '\uffff', i) }
    else if (swim === 'epic') { const e = i.parent?.type === 'Epic' ? i.parent : null; add(e?.key || 'none', e ? `${e.key} ${e.summary}` : 'No epic', <TypeIcon type="Epic" size={14} />, e ? e.key : '\uffff', i) }
    else if (swim === 'priority') add(i.priority, i.priority, <PriorityIcon priority={i.priority} />, String(meta.priorities.indexOf(i.priority)).padStart(2, '0'), i)
    else if (swim === 'type') add(i.type, i.type, <TypeIcon type={i.type} size={14} />, String(meta.types.indexOf(i.type)).padStart(2, '0'), i)
  }
  return [...map.values()].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
}
