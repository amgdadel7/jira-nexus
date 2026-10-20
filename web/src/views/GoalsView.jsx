import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon } from '../icons.jsx'
import { Avatar, Confirm, Dropdown, Lozenge, MenuItem, Modal, UserPicker, fmtDate, timeAgo, todayStr } from '../components/ui.jsx'
import { GoalStatus, GOAL_STATUS_LABEL, IssueSearch } from '../components/IssueModal.jsx'

const STATUSES = Object.keys(GOAL_STATUS_LABEL)

function Progress({ p }) {
  return (
    <div className="goal-progress" title={`${p.done} of ${p.total} work items done`}>
      <div className="bar"><span style={{ width: `${p.percent}%` }} /></div>
      <span className="pct">{p.percent}%</span>
    </div>
  )
}

function StatusPicker({ value, onChange }) {
  return (
    <Dropdown trigger={({ ref, toggle }) => <button ref={ref} type="button" className="status-trigger" onClick={(e) => { e.stopPropagation(); toggle() }}><GoalStatus status={value} /><Icon name="chevronDown" size={14} /></button>}>
      {(close) => <div className="menu">{STATUSES.map((s) => <MenuItem key={s} selected={s === value} onClick={() => { close(); if (s !== value) onChange(s) }}><GoalStatus status={s} /></MenuItem>)}</div>}
    </Dropdown>
  )
}

export default function GoalsView() {
  const { toast, refreshKey, userById, canGlobal } = useApp()
  const [goals, setGoals] = useState(null)
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const load = useCallback(() => api.goals().then(setGoals).catch((e) => toast({ title: 'Failed to load goals', description: e.message, error: true })), [toast])
  useEffect(() => { load() }, [load, refreshKey])

  const update = async (g, fields) => {
    try { const n = await api.updateGoal(g.id, fields); setGoals((l) => l.map((x) => (x.id === n.id ? n : x))) } catch (e) { toast({ title: 'Couldn’t update goal', description: e.message, error: true }) }
  }

  const shown = goals ? goals.filter((g) => (!q || g.name.toLowerCase().includes(q.toLowerCase())) && (!status || g.status === status)) : []
  const counts = goals ? STATUSES.map((s) => [s, goals.filter((g) => g.status === s).length]).filter(([, c]) => c) : []

  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h1>Goals</h1><p className="muted">Connect work to the outcomes that matter. Progress is calculated from linked work items and their children.</p></div>
        {canGlobal('MANAGE_GOALS') && <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} />Create goal</button>}
      </div>
      {!goals ? (
        <div className="center-pad"><div className="spinner" /></div>
      ) : (
        <>
          <div className="goal-summary">
            {counts.map(([s, c]) => <button key={s} className={`goal-summary-item ${status === s ? 'on' : ''}`} onClick={() => setStatus(status === s ? '' : s)}><GoalStatus status={s} /><b>{c}</b></button>)}
          </div>
          <div className="toolbar">
            <label className="list-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search goals" /></label>
            {status && <button className="btn subtle" onClick={() => setStatus('')}>Clear status filter</button>}
          </div>
          <div className="table-wrap">
            <table className="simple-table goals-table">
              <thead><tr><th>Goal</th><th style={{ width: 150 }}>Status</th><th style={{ width: 200 }}>Progress</th><th style={{ width: 90 }}>Work</th><th style={{ width: 170 }}>Owner</th><th style={{ width: 130 }}>Target date</th></tr></thead>
              <tbody>
                {shown.map((g) => (
                  <tr key={g.id} onClick={() => setOpenId(g.id)} className="clickable">
                    <td><div className="goal-name"><span className="goal-icon"><Icon name="goals" size={16} /></span><div><b>{g.name}</b>{g.description && <div className="muted small truncate" style={{ maxWidth: 420 }}>{g.description}</div>}</div></div></td>
                    <td onClick={(e) => e.stopPropagation()}><StatusPicker value={g.status} onChange={(s) => update(g, { status: s })} /></td>
                    <td><Progress p={g.progress} /></td>
                    <td><span className="count-pill">{g.issues.length}</span></td>
                    <td>{g.ownerId ? <span className="inline-flex"><Avatar user={userById[g.ownerId]} size={24} />{userById[g.ownerId]?.name}</span> : <span className="muted">No owner</span>}</td>
                    <td className={g.targetDate && g.targetDate < todayStr() && !['done', 'cancelled'].includes(g.status) ? 'overdue' : ''}>{g.targetDate ? fmtDate(g.targetDate) : <span className="muted">—</span>}</td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={6} className="empty-row">No goals match.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {creating && <GoalEditor onClose={() => setCreating(false)} onSaved={(g) => { setCreating(false); setGoals((l) => [...l, g]); setOpenId(g.id) }} />}
      {openId && <GoalDetail id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}

function GoalEditor({ goal, onClose, onSaved }) {
  const { activeUsers, userById, currentUser } = useApp()
  const [f, setF] = useState({ name: goal?.name || '', description: goal?.description || '', status: goal?.status || 'pending', ownerId: goal ? goal.ownerId : currentUser?.id, targetDate: goal?.targetDate || '' })
  const [err, setErr] = useState(null)
  const save = async (e) => {
    e.preventDefault()
    try { onSaved(goal ? await api.updateGoal(goal.id, f) : await api.createGoal(f)) } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={560}>
      <form onSubmit={save} className="create-form">
        <div className="modal-header"><h2>{goal ? 'Edit goal' : 'Create goal'}</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          <div className="field"><label className="field-title">Name <span className="req">*</span></label><input className="text-input" autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Launch mobile onboarding" /></div>
          <div className="field"><label className="field-title">Description</label><textarea className="text-input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="field-row">
            <div className="field"><label className="field-title">Status</label><StatusPicker value={f.status} onChange={(status) => setF({ ...f, status })} /></div>
            <div className="field"><label className="field-title">Target date</label><input type="date" className="text-input narrow" value={f.targetDate} onChange={(e) => setF({ ...f, targetDate: e.target.value })} /></div>
          </div>
          <div className="field"><label className="field-title">Owner</label>
            <UserPicker users={activeUsers} value={f.ownerId} onChange={(ownerId) => setF({ ...f, ownerId })} trigger={({ ref, toggle }) => (
              <button type="button" ref={ref} className="fake-select" onClick={toggle}><Avatar user={userById[f.ownerId]} size={22} />{userById[f.ownerId]?.name || 'No owner'}<Icon name="chevronDown" size={16} className="chev" /></button>
            )} />
          </div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary">{goal ? 'Save' : 'Create'}</button></div>
      </form>
    </Modal>
  )
}

function GoalDetail({ id, onClose, onChanged }) {
  const { toast, userById, openIssue } = useApp()
  const [g, setG] = useState(null)
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [adding, setAdding] = useState(false)
  useEffect(() => { api.goal(id).then(setG).catch((e) => { toast({ title: 'Goal not found', description: e.message, error: true }); onClose() }) }, [id]) // eslint-disable-line
  const apply = (n) => { setG(n); onChanged() }
  const run = async (fn) => { try { apply(await fn()) } catch (e) { toast({ title: 'Something went wrong', description: e.message, error: true }) } }

  if (!g) return <Modal onClose={onClose} width={760}><div className="center-pad"><div className="spinner" /></div></Modal>
  if (editing) return <GoalEditor goal={g} onClose={() => setEditing(false)} onSaved={(n) => { setEditing(false); apply(n) }} />
  return (
    <Modal onClose={onClose} width={760}>
      <div className="modal-header">
        <div className="goal-name"><span className="goal-icon big"><Icon name="goals" size={20} /></span><h2>{g.name}</h2></div>
        <div className="row-gap">
          <button className="btn subtle" onClick={() => setEditing(true)}><Icon name="edit" size={14} />Edit</button>
          <Dropdown align="end" trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn" onClick={toggle}><Icon name="more" size={18} /></button>}>
            {(close) => <div className="menu"><MenuItem danger onClick={() => { close(); setConfirm(true) }}>Delete goal</MenuItem></div>}
          </Dropdown>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
      </div>
      <div className="modal-body scroll">
        <div className="goal-detail-meta">
          <div><span className="field-title">Status</span><StatusPicker value={g.status} onChange={(status) => run(() => api.updateGoal(g.id, { status }))} /></div>
          <div><span className="field-title">Owner</span>{g.ownerId ? <span className="inline-flex"><Avatar user={userById[g.ownerId]} size={22} />{userById[g.ownerId]?.name}</span> : <span className="muted">No owner</span>}</div>
          <div><span className="field-title">Target date</span>{g.targetDate ? fmtDate(g.targetDate) : <span className="muted">None</span>}</div>
          <div><span className="field-title">Updated</span>{timeAgo(g.updated)}</div>
        </div>
        {g.description && <p className="goal-desc">{g.description}</p>}
        <div className="goal-progress-big"><Progress p={g.progress} /><span className="muted small">{g.progress.done} of {g.progress.total} work items done (including child items)</span></div>
        <div className="sub-title"><h3>Linked work <span className="count-pill">{g.issues.length}</span></h3><button className="icon-btn" title="Link work item" onClick={() => setAdding(true)}><Icon name="plus" size={16} /></button></div>
        {adding && (
          <div className="link-form">
            <IssueSearch value={null} exclude={g.issues.map((i) => i.key)} onChange={(i) => { if (i) { setAdding(false); run(() => api.linkGoalIssue(g.id, i.key)) } }} placeholder="Search for a work item to link" />
            <button className="btn subtle" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        )}
        <div className="child-list">
          {g.issues.map((i) => (
            <div key={i.key} className="child-row">
              <TypeIcon type={i.type} />
              <button className="issue-key link" onClick={() => { onClose(); openIssue(i.key) }}>{i.key}</button>
              <span className={`child-summary ${i.status === 'Done' ? 'done' : ''}`}>{i.summary}</span>
              {i.type === 'Epic' && i.childCount > 0 && <span className="muted small">{i.childDone}/{i.childCount}</span>}
              <Avatar user={userById[i.assigneeId]} size={22} />
              <Lozenge status={i.status} />
              <button className="icon-btn small" title="Unlink" onClick={() => run(() => api.unlinkGoalIssue(g.id, i.key))}><Icon name="close" size={14} /></button>
            </div>
          ))}
          {!g.issues.length && !adding && <div className="muted small dev-empty">No work linked yet. Link epics or work items to track progress toward this goal.</div>}
        </div>
      </div>
      {confirm && <Confirm title={`Delete goal “${g.name}”?`} body="Linked work items won’t be deleted." onConfirm={async () => { await api.deleteGoal(g.id); onChanged(); onClose() }} onClose={() => setConfirm(false)} />}
    </Modal>
  )
}
