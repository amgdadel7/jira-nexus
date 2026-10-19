import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon } from '../icons.jsx'
import { Avatar, Modal, fmtDateTime, timeAgo } from './ui.jsx'

// Jira working time: 1d = 8h, 1w = 5d
const UNITS = [['w', 5 * 8 * 3600], ['d', 8 * 3600], ['h', 3600], ['m', 60]]
export function fmtDur(sec) {
  if (sec === null || sec === undefined) return null
  let s = Math.max(0, Math.round(sec))
  if (!s) return '0m'
  const out = []
  for (const [u, n] of UNITS) { const k = Math.floor(s / n); if (k) { out.push(`${k}${u}`); s -= k * n } }
  return out.join(' ')
}
export function parseDur(text) {
  const t = String(text || '').trim().toLowerCase()
  if (!t) return null
  if (/^\d+$/.test(t)) return Number(t) * 60
  let rest = t; let total = 0; let m
  const re = /^\s*(\d+(?:\.\d+)?)\s*([wdhm])/
  while ((m = re.exec(rest))) { total += Number(m[1]) * UNITS.find((u) => u[0] === m[2])[1]; rest = rest.slice(m[0].length) }
  return rest.trim() ? NaN : Math.round(total)
}

/** Time tracking bar + legend (Jira: blue = logged, amber = over the original estimate). */
export function TimeBar({ spent = 0, remaining, original }) {
  const rem = remaining ?? (original != null ? Math.max(0, original - spent) : 0)
  const total = Math.max(spent + rem, original || 0, 1)
  const over = original != null && spent + rem > original ? spent + rem - original : 0
  const spentPct = Math.min(100, (Math.min(spent, total) / total) * 100)
  const overPct = over ? Math.min(100 - spentPct, (over / total) * 100) : 0
  return (
    <div className="tt-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={spent} aria-label="Time tracking">
      <span className="spent" style={{ width: `${spentPct}%` }} />
      {overPct > 0 && <span className="over" style={{ width: `${overPct}%` }} />}
    </div>
  )
}

export function TimeTrackingField({ issue, canLog, onLog }) {
  const spent = issue.timeSpent || 0
  const has = spent > 0 || issue.remainingEstimate != null || issue.originalEstimate != null
  return (
    <button type="button" className="tt-field" onClick={canLog ? onLog : undefined} disabled={!canLog} title={canLog ? 'Log work' : undefined} data-testid="time-tracking">
      <TimeBar spent={spent} remaining={issue.remainingEstimate} original={issue.originalEstimate} />
      {has ? (
        <div className="tt-legend"><span className="tt-logged">{fmtDur(spent)} logged</span><span className="tt-remaining">{issue.remainingEstimate != null ? `${fmtDur(issue.remainingEstimate)} remaining` : 'No estimate'}</span></div>
      ) : <div className="tt-legend empty"><span>No time logged</span></div>}
    </button>
  )
}

/** Inline editable estimate (e.g. "Original estimate: 2d 4h"). */
export function EstimateCell({ value, onSave, readOnly }) {
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState(fmtDur(value) || '')
  const [err, setErr] = useState(false)
  useEffect(() => { if (!edit) setV(fmtDur(value) || '') }, [value, edit])
  if (readOnly || !edit) {
    return <button type="button" className="cell-btn" onClick={() => !readOnly && setEdit(true)} disabled={readOnly}>{value != null ? fmtDur(value) : <span className="muted">None</span>}</button>
  }
  const save = () => {
    const s = parseDur(v)
    if (Number.isNaN(s)) { setErr(true); return }
    setEdit(false); setErr(false)
    if (s !== (value ?? null)) onSave(v.trim() ? v.trim() : null)
  }
  return (
    <input autoFocus className={`inline-input ${err ? 'invalid' : ''}`} value={v} placeholder="e.g. 2w 4d 6h 45m" aria-label="Estimate"
      onChange={(e) => { setV(e.target.value); setErr(false) }} onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); setEdit(false) } }} />
  )
}

const nowLocal = () => { const d = new Date(); d.setSeconds(0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

/** Jira's "Time tracking" dialog: time spent, remaining-estimate handling, date started, work description. */
export function LogWorkModal({ issue, worklog, onClose, onSaved }) {
  const { toast } = useApp()
  const editing = !!worklog
  const [spent, setSpent] = useState(worklog ? fmtDur(worklog.timeSpent) : '')
  const [mode, setMode] = useState('auto')
  const [newEst, setNewEst] = useState('')
  const [reduceBy, setReduceBy] = useState('')
  const [started, setStarted] = useState(() => (worklog ? new Date(new Date(worklog.started).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : nowLocal()))
  const [comment, setComment] = useState(worklog?.comment || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const sec = parseDur(spent)
  const valid = sec && !Number.isNaN(sec) && sec >= 60
  // live preview of the bar with the new numbers
  const delta = valid ? sec - (worklog?.timeSpent || 0) : 0
  const curRem = issue.remainingEstimate
  const previewRem = mode === 'leave' ? curRem : mode === 'new' ? (Number.isNaN(parseDur(newEst)) ? curRem : parseDur(newEst)) : mode === 'manual' ? (curRem == null ? null : Math.max(0, curRem - (parseDur(reduceBy) || 0))) : (curRem == null ? null : Math.max(0, curRem - delta))
  const submit = async (e) => {
    e.preventDefault()
    if (!valid) { setError('Enter time spent, like 2h 30m (at least 1m).'); return }
    setBusy(true); setError(null)
    const body = { timeSpent: spent, started: new Date(started).toISOString(), comment, adjustEstimate: mode, ...(mode === 'new' ? { newEstimate: newEst } : {}), ...(mode === 'manual' ? { reduceBy } : {}) }
    try {
      const r = editing ? await api.updateWorklog(worklog.id, body) : await api.logWork(issue.key, body)
      toast(editing ? 'Work log updated' : `${fmtDur(sec)} logged on ${issue.key}`)
      onSaved?.(r); onClose()
    } catch (err) { setError(err.message); setBusy(false) }
  }
  return (
    <Modal onClose={onClose} width={520} className="log-work-modal" labelledBy="log-work-title">
      <form onSubmit={submit}>
        <div className="modal-header"><h2 id="log-work-title">{editing ? 'Edit work log' : 'Time tracking'}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          <TimeBar spent={(issue.timeSpent || 0) + delta} remaining={previewRem} original={issue.originalEstimate} />
          <div className="tt-legend" style={{ marginTop: 4, marginBottom: 16 }}>
            <span>{fmtDur((issue.timeSpent || 0) + delta)} logged</span>
            <span>{previewRem != null ? `${fmtDur(previewRem)} remaining` : 'No estimate'}{issue.originalEstimate != null ? ` · ${fmtDur(issue.originalEstimate)} original` : ''}</span>
          </div>
          {error && <div className="login-error" role="alert"><Icon name="warning" size={16} />{error}</div>}
          <div className="log-work-grid">
            <label className="field"><span className="field-title">Time spent</span>
              <input className="text-input" name="timeSpent" autoFocus value={spent} onChange={(e) => setSpent(e.target.value)} placeholder="2h 30m" aria-invalid={!!spent && !valid} />
            </label>
            <label className="field"><span className="field-title">Date started</span>
              <input className="text-input" type="datetime-local" name="started" value={started} onChange={(e) => setStarted(e.target.value)} />
            </label>
            <div className="full hint">Use the format: 2w 4d 6h 45m — w = weeks (5d), d = days (8h), h = hours, m = minutes.</div>
            <div className="field full"><span className="field-title">Remaining estimate</span>
              <div className="radio-col" role="radiogroup">
                <label><input type="radio" name="adjust" checked={mode === 'auto'} onChange={() => setMode('auto')} />Adjust automatically</label>
                <label><input type="radio" name="adjust" checked={mode === 'leave'} onChange={() => setMode('leave')} />Leave the estimate unchanged{curRem != null ? ` (${fmtDur(curRem)})` : ''}</label>
                <label><input type="radio" name="adjust" checked={mode === 'new'} onChange={() => setMode('new')} />Set to<input className="text-input" value={newEst} onChange={(e) => { setNewEst(e.target.value); setMode('new') }} placeholder="3h" aria-label="New remaining estimate" /></label>
                {!editing && <label><input type="radio" name="adjust" checked={mode === 'manual'} onChange={() => setMode('manual')} />Reduce by<input className="text-input" value={reduceBy} onChange={(e) => { setReduceBy(e.target.value); setMode('manual') }} placeholder="1h" aria-label="Reduce remaining by" /></label>}
              </div>
            </div>
            <label className="field full"><span className="field-title">Work description</span>
              <textarea className="text-input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you work on?" />
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn subtle" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? <span className="spinner small light" /> : null}{editing ? 'Save' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

export function WorklogList({ issue, userById, currentUserId, canManageAll, onEdit, reload }) {
  const { toast } = useApp()
  const seen = useRef(null)
  const logs = issue.worklogs || []
  const ids = new Set(logs.map((w) => w.id))
  const fresh = seen.current ? logs.filter((w) => !seen.current.has(w.id)).map((w) => w.id) : []
  useEffect(() => { seen.current = ids })
  if (!logs.length) return <div className="muted activity-empty">No work has been logged on this work item yet.</div>
  return (
    <div className="activity worklogs">
      {logs.map((w) => {
        const u = userById[w.authorId]
        const mine = w.authorId === currentUserId
        return (
          <div key={w.id} className={`worklog-item ${fresh.includes(w.id) ? 'activity-item new' : ''}`} data-worklog-id={w.id}>
            <Avatar user={u} size={32} />
            <div className="activity-main">
              <div className="wl-head"><b>{u?.name || 'Former user'}</b><span>logged</span><span className="wl-time">{fmtDur(w.timeSpent)}</span><span className="muted" title={fmtDateTime(w.started)}>{timeAgo(w.started)}</span></div>
              {w.comment && <div className="comment-body"><p>{w.comment}</p></div>}
              {(mine || canManageAll) && (
                <div className="wl-actions comment-actions">
                  <button className="link-plain" onClick={() => onEdit(w)}>Edit</button><span>·</span>
                  <button className="link-plain" onClick={async () => { try { await api.deleteWorklog(w.id); toast('Work log deleted'); reload() } catch (e) { toast({ title: 'Delete failed', description: e.message, error: true }) } }}>Delete</button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Vote button with count (Jira: you can't vote on work you reported or that's done). */
export function VoteButton({ issue, currentUserId, onChanged }) {
  const { toast } = useApp()
  const [state, setState] = useState({ votes: issue.votes || 0, voted: !!issue.voted })
  const [bump, setBump] = useState(0)
  useEffect(() => { setState({ votes: issue.votes || 0, voted: !!issue.voted }) }, [issue.votes, issue.voted])
  const own = issue.reporterId === currentUserId
  const done = issue.status === 'Done'
  const blocked = own ? 'You can’t vote for work you reported' : done && !state.voted ? 'You can’t vote for work that’s done' : null
  const toggle = async () => {
    if (blocked) { toast({ title: blocked, error: true }); return }
    const next = !state.voted
    setState((s) => ({ votes: s.votes + (next ? 1 : -1), voted: next })); setBump((b) => b + 1)
    try { const r = next ? await api.vote(issue.key) : await api.unvote(issue.key); setState({ votes: r.votes, voted: r.hasVoted }); onChanged?.() } catch (e) { setState({ votes: issue.votes || 0, voted: !!issue.voted }); toast({ title: 'Vote failed', description: e.message, error: true }) }
  }
  return (
    <button type="button" className={`vote-btn ${state.voted ? 'on' : ''}`} onClick={toggle} aria-pressed={state.voted}
      title={blocked || (state.voted ? 'Remove vote' : 'Vote for this work item')}>
      <Icon name="thumbsUp" size={18} /><span key={bump} className={`vote-count ${bump ? 'bump' : ''}`}>{state.votes}</span>
    </button>
  )
}
