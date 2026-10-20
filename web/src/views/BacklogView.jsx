import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon, PriorityIcon } from '../icons.jsx'
import { Avatar, Confirm, Dropdown, Lozenge, MenuItem, Modal, fmtDate, todayStr } from '../components/ui.jsx'

const backlogJql = () => `project = ${getProject()} AND type not in (Epic, Subtask) AND (sprint IS EMPTY OR sprint in openSprints() OR sprint in futureSprints()) ORDER BY cf[10019] ASC`
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
export const daysLeft = (end) => Math.ceil((Date.parse(`${end}T23:59:59Z`) - Date.now()) / 864e5)

export default function BacklogView() {
  const { refreshKey, bump, toast, openIssue, userById, activeUsers, refreshMeta, can } = useApp()
  const canSprints = can('MANAGE_SPRINTS'); const canMove = can('EDIT_ISSUES'); const canCreate = can('CREATE_ISSUES')
  const [sprints, setSprints] = useState(null)
  const [issues, setIssues] = useState(null)
  const [q, setQ] = useState('')
  const [who, setWho] = useState([])
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [drag, setDrag] = useState(null) // key being dragged
  const [over, setOver] = useState(null) // { section, beforeKey }
  const [creatingIn, setCreatingIn] = useState(null)
  const [modal, setModal] = useState(null) // { kind: 'edit'|'start'|'complete'|'delete', sprint }

  const load = useCallback(async () => {
    try {
      const [sp, res] = await Promise.all([api.sprints('active,future'), api.search(backlogJql())])
      setSprints(sp); setIssues(res.issues)
    } catch (e) { toast({ title: 'Failed to load the backlog', description: e.message, error: true }) }
  }, [toast])
  useEffect(() => { load() }, [load, refreshKey])
  const changed = () => { load(); refreshMeta?.(); bump() }

  const visible = useMemo(() => (issues || []).filter((i) =>
    (!q || `${i.key} ${i.summary}`.toLowerCase().includes(q.toLowerCase())) && (!who.length || who.includes(i.assigneeId ?? null))), [issues, q, who])

  if (!sprints || !issues) return <div className="center-pad"><div className="spinner" /></div>
  const active = sprints.find((s) => s.state === 'active')
  const sections = [...sprints.map((s) => ({ id: s.id, sprint: s, name: s.name })), { id: 'backlog', sprint: null, name: 'Backlog' }]
  const itemsOf = (sec) => visible.filter((i) => (sec.sprint ? i.sprint === sec.sprint.name : !i.sprint))

  const moveTo = async (key, sec, beforeKey) => {
    const issue = issues.find((i) => i.key === key)
    if (!issue) return
    const target = sec.sprint ? sec.sprint.name : null
    setIssues((list) => {
      const rest = list.filter((i) => i.key !== key)
      const moved = { ...issue, sprint: target }
      const idx = beforeKey ? rest.findIndex((i) => i.key === beforeKey) : -1
      if (idx === -1) rest.push(moved); else rest.splice(idx, 0, moved)
      return rest
    })
    try {
      if ((issue.sprint || null) !== target) await api.moveToSprint([key], sec.sprint ? sec.sprint.id : null)
      if (beforeKey && beforeKey !== key) await api.rank(key, { beforeKey })
      else if (!beforeKey) {
        const last = itemsOf(sec).filter((i) => i.key !== key).pop()
        if (last) await api.rank(key, { afterKey: last.key })
      }
      changed()
    } catch (e) { toast({ title: 'Couldn’t move the work item', description: e.message, error: true }); load() }
  }
  const onDrop = (e, sec, beforeKey) => {
    e.preventDefault(); e.stopPropagation()
    const key = e.dataTransfer.getData('text/plain') || drag
    setDrag(null); setOver(null)
    if (key) moveTo(key, sec, beforeKey)
  }
  const create = async (sec, summary) => {
    try {
      const issue = await api.create({ summary, type: 'Story', sprint: sec.sprint ? sec.sprint.name : null })
      setIssues((l) => [...l, issue]); toast(`${issue.key} has been created`); changed()
    } catch (e) { toast({ title: 'Couldn’t create', description: e.message, error: true }) }
  }
  const createSprint = async () => {
    try { const s = await api.createSprint(); toast(`${s.name} created`); changed() } catch (e) { toast({ title: 'Couldn’t create sprint', description: e.message, error: true }) }
  }

  return (
    <div className="backlog-view">
      <h1 className="sr-only">Backlog - {meta.project.name}</h1>
      <div className="toolbar backlog-toolbar">
        <label className="list-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search backlog" /></label>
        <div className="avatar-filter">
          {activeUsers.map((u) => <button key={u.id} className={`avatar-toggle ${who.includes(u.id) ? 'on' : ''}`} onClick={() => setWho((w) => (w.includes(u.id) ? w.filter((x) => x !== u.id) : [...w, u.id]))}><Avatar user={u} size={28} /></button>)}
          <button className={`avatar-toggle ${who.includes(null) ? 'on' : ''}`} title="Unassigned" onClick={() => setWho((w) => (w.includes(null) ? w.filter((x) => x !== null) : [...w, null]))}><Avatar user={null} size={28} /></button>
        </div>
        {(q || who.length > 0) && <button className="btn subtle" onClick={() => { setQ(''); setWho([]) }}>Clear filters</button>}
        <span className="spacer" />
        <span className="muted small">Drag work items between sprints and the backlog</span>
      </div>
      <div className="backlog-sections">
        {sections.map((sec) => {
          const items = itemsOf(sec)
          const all = sec.sprint ? issues.filter((i) => i.sprint === sec.sprint.name) : issues.filter((i) => !i.sprint)
          const pts = (st) => all.filter((i) => (st ? (st === 'done' ? i.status === 'Done' : st === 'todo' ? i.status === 'To Do' : i.status !== 'Done' && i.status !== 'To Do') : true)).reduce((n, i) => n + (i.storyPoints || 0), 0)
          const isCollapsed = collapsed.has(sec.id)
          const s = sec.sprint
          return (
            <section key={sec.id} className={`backlog-section ${s ? s.state : 'backlog'} ${over?.section === sec.id ? 'drop' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (over?.section !== sec.id || over?.beforeKey) setOver({ section: sec.id, beforeKey: null }) }}
              onDrop={(e) => onDrop(e, sec, null)}>
              <header className="backlog-head">
                <button className="tl-toggle" onClick={() => setCollapsed((c) => { const n = new Set(c); n.has(sec.id) ? n.delete(sec.id) : n.add(sec.id); return n })} aria-label="Toggle section">
                  <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={16} />
                </button>
                <div className="backlog-title">
                  <div className="row-gap">
                    <h3>{sec.name}</h3>
                    {s && (s.startDate || s.endDate) && <span className="muted small">{s.startDate ? fmtDate(s.startDate) : '—'} – {s.endDate ? fmtDate(s.endDate) : '—'}</span>}
                    <span className="muted small">({all.length} work item{all.length === 1 ? '' : 's'})</span>
                    {s?.state === 'active' && <span className="sprint-state active">Active{s.endDate ? ` · ${daysLeft(s.endDate) >= 0 ? `${daysLeft(s.endDate)} days left` : `${-daysLeft(s.endDate)} days overdue`}` : ''}</span>}
                  </div>
                  {s?.goal && <div className="sprint-goal"><Icon name="goals" size={12} /> {s.goal}</div>}
                </div>
                <div className="backlog-points" title="To Do · In progress · Done (story points)">
                  <span className="pt todo">{pts('todo')}</span><span className="pt inprogress">{pts('inprogress')}</span><span className="pt done">{pts('done')}</span>
                </div>
                {s?.state === 'future' && canSprints && (
                  <button className="btn" disabled={!!active || !all.length} title={active ? `Complete ${active.name} first` : !all.length ? 'Add work items to start this sprint' : ''} onClick={() => setModal({ kind: 'start', sprint: s })}>Start sprint</button>
                )}
                {s?.state === 'active' && canSprints && <button className="btn" onClick={() => setModal({ kind: 'complete', sprint: s })}>Complete sprint</button>}
                {!s && canSprints && <button className="btn" onClick={createSprint}>Create sprint</button>}
                {s && canSprints && (
                  <Dropdown align="end" trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn" onClick={toggle} aria-label="Sprint actions"><Icon name="more" size={16} /></button>}>
                    {(close) => (
                      <div className="menu">
                        <MenuItem onClick={() => { close(); setModal({ kind: 'edit', sprint: s }) }}>Edit sprint</MenuItem>
                        <MenuItem disabled={s.state !== 'future'} danger onClick={() => { close(); setModal({ kind: 'delete', sprint: s }) }}>Delete sprint</MenuItem>
                      </div>
                    )}
                  </Dropdown>
                )}
              </header>
              {!isCollapsed && (
                <div className="backlog-list">
                  {items.map((i) => (
                    <div key={i.key} className={`backlog-row ${drag === i.key ? 'dragging' : ''} ${over?.beforeKey === i.key ? 'drop-before' : ''}`} draggable={canMove}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', i.key); e.dataTransfer.effectAllowed = 'move'; setDrag(i.key) }}
                      onDragEnd={() => { setDrag(null); setOver(null) }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (over?.beforeKey !== i.key) setOver({ section: sec.id, beforeKey: i.key }) }}
                      onDrop={(e) => onDrop(e, sec, i.key)}
                      onClick={() => openIssue(i.key)}>
                      <Icon name="drag" size={14} className="drag-handle" />
                      <TypeIcon type={i.type} />
                      <span className={`issue-key small ${i.status === 'Done' ? 'done' : ''}`}>{i.key}</span>
                      <span className="backlog-summary truncate">{i.summary}</span>
                      {i.parent && <span className="epic-chip" title={`Parent: ${i.parent.key}`}>{i.parent.summary}</span>}
                      <Lozenge status={i.status} />
                      <span className="sp-pill" title="Story points">{i.storyPoints ?? '-'}</span>
                      <PriorityIcon priority={i.priority} />
                      <Avatar user={userById[i.assigneeId]} size={24} />
                      <span onClick={(e) => e.stopPropagation()}>
                        <Dropdown align="end" trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn small" onClick={toggle} aria-label={`Actions for ${i.key}`}><Icon name="more" size={14} /></button>}>
                          {(close) => (
                            <div className="menu">
                              <div className="menu-heading">Move to</div>
                              {sections.filter((x) => x.id !== sec.id).map((x) => <MenuItem key={x.id} onClick={() => { close(); moveTo(i.key, x, null) }}>{x.name}</MenuItem>)}
                              <div className="menu-sep" />
                              {items[0]?.key !== i.key && <MenuItem onClick={() => { close(); moveTo(i.key, sec, items[0].key) }}>Move to top</MenuItem>}
                              {items[items.length - 1]?.key !== i.key && <MenuItem onClick={() => { close(); moveTo(i.key, sec, null) }}>Move to bottom</MenuItem>}
                            </div>
                          )}
                        </Dropdown>
                      </span>
                    </div>
                  ))}
                  {!items.length && (
                    <div className="backlog-empty">
                      {all.length ? 'No work items match your filters.' : s ? 'Plan a sprint by dragging work items here, or create new ones.' : 'Your backlog is empty.'}
                    </div>
                  )}
                  {creatingIn === sec.id ? (
                    <form className="backlog-create" onSubmit={(e) => { e.preventDefault(); const v = e.target.s.value.trim(); if (v) { create(sec, v); e.target.reset() } }}>
                      <TypeIcon type="Story" />
                      <input name="s" autoFocus placeholder="What needs to be done?" maxLength={255} onKeyDown={(e) => e.key === 'Escape' && setCreatingIn(null)} onBlur={(e) => { if (!e.target.value.trim()) setCreatingIn(null) }} />
                    </form>
                  ) : canCreate ? (
                    <button className="create-trigger" onClick={() => setCreatingIn(sec.id)}><Icon name="plus" size={16} />Create</button>
                  ) : null}
                </div>
              )}
            </section>
          )
        })}
      </div>
      {modal?.kind === 'edit' && <SprintEditModal sprint={modal.sprint} onClose={() => setModal(null)} onSaved={() => { setModal(null); changed() }} />}
      {modal?.kind === 'start' && <StartSprintModal sprint={modal.sprint} count={issues.filter((i) => i.sprint === modal.sprint.name).length} onClose={() => setModal(null)} onStarted={(s) => { setModal(null); toast({ title: `${s.name} started`, description: 'Track progress on the board.' }); changed() }} />}
      {modal?.kind === 'complete' && <CompleteSprintModal sprint={modal.sprint} onClose={() => setModal(null)} onCompleted={() => { setModal(null); changed() }} />}
      {modal?.kind === 'delete' && (
        <Confirm title={`Delete ${modal.sprint.name}?`} body="Its work items will be moved to the backlog." onClose={() => setModal(null)}
          onConfirm={async () => { try { await api.deleteSprint(modal.sprint.id); toast('Sprint deleted'); changed() } catch (e) { toast({ title: 'Couldn’t delete sprint', description: e.message, error: true }) } }} />
      )}
    </div>
  )
}

export function SprintEditModal({ sprint, onClose, onSaved }) {
  const [f, setF] = useState({ name: sprint.name, goal: sprint.goal || '', startDate: sprint.startDate || '', endDate: sprint.endDate || '' })
  const [err, setErr] = useState(null)
  const save = async (e) => {
    e.preventDefault(); setErr(null)
    try { await api.updateSprint(sprint.id, f); onSaved() } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={520}>
      <form onSubmit={save} className="create-form">
        <div className="modal-header"><h2>Edit sprint: {sprint.name}</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          <div className="field"><label className="field-title">Sprint name <span className="req">*</span></label><input className="text-input" autoFocus required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field-row">
            <div className="field"><label className="field-title">Start date</label><input type="date" className="text-input narrow" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} required={sprint.state === 'active'} /></div>
            <div className="field"><label className="field-title">End date</label><input type="date" className="text-input narrow" value={f.endDate} min={f.startDate || undefined} onChange={(e) => setF({ ...f, endDate: e.target.value })} required={sprint.state === 'active'} /></div>
          </div>
          <div className="field"><label className="field-title">Sprint goal</label><textarea className="text-input" rows={3} maxLength={500} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} /></div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary">Update</button></div>
      </form>
    </Modal>
  )
}

function StartSprintModal({ sprint, count, onClose, onStarted }) {
  const [weeks, setWeeks] = useState('2')
  const [f, setF] = useState(() => { const start = sprint.startDate || todayStr(); return { name: sprint.name, goal: sprint.goal || '', startDate: start, endDate: sprint.endDate || addDays(start, 14) } })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const setDuration = (w) => { setWeeks(w); if (w !== 'custom') setF((x) => ({ ...x, endDate: addDays(x.startDate, Number(w) * 7) })) }
  const start = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true)
    try { onStarted(await api.startSprint(sprint.id, f)) } catch (e2) { setErr(e2.message); setBusy(false) }
  }
  return (
    <Modal onClose={onClose} width={560}>
      <form onSubmit={start} className="create-form">
        <div className="modal-header"><h2>Start sprint</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          <p className="muted"><b>{count}</b> work item{count === 1 ? '' : 's'} will be included in this sprint.</p>
          <div className="field"><label className="field-title">Sprint name <span className="req">*</span></label><input className="text-input" required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label className="field-title">Duration</label>
            <div className="segmented">{[['1', '1 week'], ['2', '2 weeks'], ['3', '3 weeks'], ['4', '4 weeks'], ['custom', 'Custom']].map(([v, l]) => <button type="button" key={v} className={weeks === v ? 'on' : ''} onClick={() => setDuration(v)}>{l}</button>)}</div>
          </div>
          <div className="field-row">
            <div className="field"><label className="field-title">Start date <span className="req">*</span></label><input type="date" required className="text-input narrow" value={f.startDate} onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, startDate: v, endDate: weeks !== 'custom' && v ? addDays(v, Number(weeks) * 7) : x.endDate })) }} /></div>
            <div className="field"><label className="field-title">End date <span className="req">*</span></label><input type="date" required className="text-input narrow" min={f.startDate} value={f.endDate} onChange={(e) => { setWeeks('custom'); setF({ ...f, endDate: e.target.value }) }} /></div>
          </div>
          <div className="field"><label className="field-title">Sprint goal</label><textarea className="text-input" rows={3} maxLength={500} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="What does the team want to achieve?" /></div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>Start</button></div>
      </form>
    </Modal>
  )
}

export function CompleteSprintModal({ sprint, onClose, onCompleted }) {
  const { toast } = useApp()
  const [future, setFuture] = useState(null)
  const [stats, setStats] = useState(sprint.stats)
  const [moveTo, setMoveTo] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api.sprints('future').then(setFuture).catch(() => setFuture([]))
    api.sprints('active').then((l) => { const s = l.find((x) => x.id === sprint.id); if (s) setStats(s.stats) }).catch(() => {})
  }, [sprint.id])
  const open = stats.total - stats.done
  const complete = async () => {
    setBusy(true)
    try {
      const r = await api.completeSprint(sprint.id, moveTo === '' ? null : moveTo === 'new' ? 'new' : Number(moveTo))
      toast({ title: `${sprint.name} completed`, description: r.moved ? `${r.moved} open work item${r.moved === 1 ? '' : 's'} moved to ${r.movedTo || 'the backlog'}.` : 'All work items were done. Nice!' })
      onCompleted(r)
    } catch (e) { toast({ title: 'Couldn’t complete sprint', description: e.message, error: true }); setBusy(false) }
  }
  return (
    <Modal onClose={onClose} width={520}>
      <div className="modal-header"><h2>Complete {sprint.name}</h2><button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
      <div className="modal-body">
        <div className="complete-stats">
          <div><b>{stats.done}</b><span>completed work item{stats.done === 1 ? '' : 's'}</span></div>
          <div><b>{open}</b><span>open work item{open === 1 ? '' : 's'}</span></div>
          <div><b>{stats.donePoints}/{stats.points}</b><span>story points done</span></div>
        </div>
        {open > 0 ? (
          <div className="field">
            <label className="field-title">Move open work items to</label>
            <select className="text-input select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} style={{ width: '100%' }}>
              <option value="">Backlog</option>
              {(future || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="new">New sprint</option>
            </select>
          </div>
        ) : <p className="muted">All work items in this sprint are done. 🎉</p>}
      </div>
      <div className="modal-footer"><button className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !future} onClick={complete}>Complete sprint</button></div>
    </Modal>
  )
}
