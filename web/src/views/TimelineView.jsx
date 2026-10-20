import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon } from '../icons.jsx'
import { Avatar, Lozenge, fmtDate, statusCategory } from '../components/ui.jsx'

const DAY = 864e5
const ZOOMS = { weeks: { label: 'Weeks', px: 30 }, months: { label: 'Months', px: 10 }, quarters: { label: 'Quarters', px: 4 } }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const toDay = (s) => Math.floor(Date.parse(`${s.slice(0, 10)}T00:00:00Z`) / DAY)
const fromDay = (d) => new Date(d * DAY).toISOString().slice(0, 10)
const todayDay = () => { const n = new Date(); return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY) }

export default function TimelineView() {
  const { meta, refreshKey, openIssue, toast, userById, bump } = useApp()
  const [issues, setIssues] = useState(null)
  const [zoom, setZoom] = useState(() => localStorage.getItem('jc.tlZoom') || 'months')
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [q, setQ] = useState('')
  const [showDone, setShowDone] = useState(true)
  const [drag, setDrag] = useState(null)
  const [creating, setCreating] = useState(false)
  const gridRef = useRef(null)

  const load = useCallback(() => api.search(`project = ${getProject()} AND type != Subtask ORDER BY cf[10019] ASC`).then((d) => setIssues(d.issues)).catch((e) => toast({ title: 'Failed to load timeline', description: e.message, error: true })), [toast])
  useEffect(() => { load() }, [load, refreshKey])
  useEffect(() => { localStorage.setItem('jc.tlZoom', zoom) }, [zoom])

  const px = ZOOMS[zoom].px
  const today = todayDay()

  const rows = useMemo(() => {
    if (!issues) return []
    const match = (i) => (!q || `${i.key} ${i.summary}`.toLowerCase().includes(q.toLowerCase())) && (showDone || i.status !== 'Done')
    const epics = issues.filter((i) => i.type === 'Epic')
    const out = []
    epics.forEach((e) => {
      const kids = issues.filter((i) => i.parent?.key === e.key && match(i))
      if (!match(e) && !kids.length) return
      out.push({ issue: e, depth: 0, hasKids: kids.length > 0 })
      if (!collapsed.has(e.key)) kids.forEach((k) => out.push({ issue: k, depth: 1 }))
    })
    const loose = issues.filter((i) => i.type !== 'Epic' && !i.parent && match(i))
    if (loose.length) {
      out.push({ group: 'No epic', count: loose.length })
      if (!collapsed.has('__loose')) loose.forEach((k) => out.push({ issue: k, depth: 1 }))
    }
    return out
  }, [issues, collapsed, q, showDone])

  // visible date range
  const range = useMemo(() => {
    let lo = today - 45; let hi = today + 120
    ;(issues || []).forEach((i) => {
      if (i.startDate) lo = Math.min(lo, toDay(i.startDate) - 14)
      if (i.dueDate) hi = Math.max(hi, toDay(i.dueDate) + 30)
    })
    const s = new Date(lo * DAY); s.setUTCDate(1)
    return { start: Math.floor(s.getTime() / DAY), end: hi }
  }, [issues, today])
  const days = range.end - range.start
  const width = days * px

  useEffect(() => {
    if (gridRef.current && issues) gridRef.current.scrollLeft = Math.max(0, (today - range.start) * px - 200)
  }, [issues, zoom]) // eslint-disable-line

  const barFor = (i) => {
    if (drag?.key === i.key) return { s: drag.s, e: drag.e }
    const start = i.startDate ? toDay(i.startDate) : i.dueDate ? toDay(i.dueDate) - 7 : null
    const end = i.dueDate ? toDay(i.dueDate) : i.startDate ? toDay(i.startDate) + 7 : null
    return start == null ? null : { s: start, e: Math.max(end, start) }
  }

  const startDrag = (e, issue, mode) => {
    e.preventDefault(); e.stopPropagation()
    const b = barFor(issue)
    const x0 = e.clientX
    let cur = { key: issue.key, s: b.s, e: b.e, moved: false }
    setDrag(cur)
    const move = (ev) => {
      const dd = Math.round((ev.clientX - x0) / px)
      if (dd !== 0) cur = { ...cur, moved: true }
      if (mode === 'move') cur = { ...cur, s: b.s + dd, e: b.e + dd }
      if (mode === 'start') cur = { ...cur, s: Math.min(b.s + dd, b.e) }
      if (mode === 'end') cur = { ...cur, e: Math.max(b.e + dd, b.s) }
      setDrag(cur)
    }
    const up = async () => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up)
      document.body.classList.remove('dragging-x')
      setDrag(null)
      if (!cur.moved) { openIssue(issue.key); return }
      const fields = { startDate: fromDay(cur.s), dueDate: fromDay(cur.e) }
      setIssues((list) => list.map((x) => (x.key === issue.key ? { ...x, ...fields } : x)))
      try { await api.update(issue.key, fields); bump() } catch (err) { toast({ title: 'Couldn’t reschedule', description: err.message, error: true }); load() }
    }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up)
    document.body.classList.add('dragging-x')
  }

  const schedule = async (e, issue) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const d = range.start + Math.floor((e.clientX - rect.left) / px)
    const fields = { startDate: fromDay(d), dueDate: fromDay(d + (issue.type === 'Epic' ? 30 : 7)) }
    setIssues((list) => list.map((x) => (x.key === issue.key ? { ...x, ...fields } : x)))
    try { await api.update(issue.key, fields); bump() } catch (err) { toast({ title: 'Couldn’t schedule', description: err.message, error: true }); load() }
  }

  // header cells
  const months = []
  for (let d = range.start; d < range.end;) {
    const dt = new Date(d * DAY)
    const next = Math.floor(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1) / DAY)
    months.push({ d, w: (Math.min(next, range.end) - d) * px, label: `${MONTHS[dt.getUTCMonth()]} ${zoom === 'weeks' || dt.getUTCMonth() === 0 || d === range.start ? dt.getUTCFullYear() : ''}`.trim() })
    d = next
  }
  const ticks = []
  if (zoom === 'weeks') for (let d = range.start; d < range.end; d++) { const dt = new Date(d * DAY); if (dt.getUTCDay() === 1) ticks.push({ d, label: dt.getUTCDate() }) }

  if (!issues) return <div className="center-pad"><h1 className="sr-only">Timeline - {meta?.project?.name || 'Project'}</h1><div className="spinner" /></div>

  return (
    <div className="timeline-view">
      <h1 className="sr-only">Timeline - {meta?.project?.name || 'Project'}</h1>
      <div className="toolbar tl-toolbar">
        <label className="list-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search timeline" /></label>
        <label className="check-label"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />Show completed</label>
        <button className="btn subtle" onClick={() => setCollapsed(new Set())}>Expand all</button>
        <button className="btn subtle" onClick={() => setCollapsed(new Set([...(issues.filter((i) => i.type === 'Epic').map((i) => i.key)), '__loose']))}>Collapse all</button>
        <span className="spacer" />
        <button className="btn" onClick={() => { if (gridRef.current) gridRef.current.scrollLeft = Math.max(0, (today - range.start) * px - 200) }}>Today</button>
        <div className="segmented">
          {Object.entries(ZOOMS).map(([k, z]) => <button key={k} className={zoom === k ? 'on' : ''} onClick={() => setZoom(k)}>{z.label}</button>)}
        </div>
      </div>
      <div className="tl-wrap">
        <div className="tl-left">
          <div className="tl-left-head">Work</div>
          {rows.map((r) => r.group ? (
            <div key="g" className="tl-row tl-group" onClick={() => setCollapsed((s) => { const n = new Set(s); n.has('__loose') ? n.delete('__loose') : n.add('__loose'); return n })}>
              <Icon name={collapsed.has('__loose') ? 'chevronRight' : 'chevronDown'} size={14} /><span>{r.group}</span><span className="group-count">{r.count}</span>
            </div>
          ) : (
            <div key={r.issue.key} className={`tl-row depth-${r.depth}`} onClick={() => openIssue(r.issue.key)} title={`${r.issue.key} ${r.issue.summary}`}>
              {r.depth === 0 ? (
                <button className="tl-toggle" onClick={(e) => { e.stopPropagation(); setCollapsed((s) => { const n = new Set(s); n.has(r.issue.key) ? n.delete(r.issue.key) : n.add(r.issue.key); return n }) }} style={{ visibility: r.hasKids ? 'visible' : 'hidden' }}>
                  <Icon name={collapsed.has(r.issue.key) ? 'chevronRight' : 'chevronDown'} size={14} />
                </button>
              ) : <span className="tl-indent" />}
              <TypeIcon type={r.issue.type} />
              <span className={`issue-key small ${r.issue.status === 'Done' ? 'done' : ''}`}>{r.issue.key}</span>
              <span className="truncate">{r.issue.summary}</span>
            </div>
          ))}
          {creating ? (
            <form className="tl-row tl-create" onSubmit={async (e) => {
              e.preventDefault(); const v = e.target.s.value.trim(); if (!v) return
              try { await api.create({ type: 'Epic', summary: v, startDate: fromDay(today), dueDate: fromDay(today + 30) }); setCreating(false); load(); bump() } catch (err) { toast({ title: 'Failed', description: err.message, error: true }) }
            }}>
              <TypeIcon type="Epic" /><input name="s" autoFocus placeholder="What needs to be done?" onKeyDown={(e) => e.key === 'Escape' && setCreating(false)} onBlur={(e) => !e.target.value && setCreating(false)} />
            </form>
          ) : (
            <button className="create-trigger tl-create-btn" onClick={() => setCreating(true)}><Icon name="plus" size={16} />Create Epic</button>
          )}
        </div>
        <div className="tl-grid" ref={gridRef}>
          <div style={{ width, position: 'relative' }}>
            <div className="tl-head">
              <div className="tl-months">{months.map((m) => <div key={m.d} style={{ width: m.w }} className="tl-month">{m.label}</div>)}</div>
              {zoom === 'weeks' && <div className="tl-ticks">{ticks.map((t) => <span key={t.d} style={{ left: (t.d - range.start) * px }}>{t.label}</span>)}</div>}
            </div>
            <div className="tl-body" style={{ backgroundSize: zoom === 'weeks' ? `${px * 7}px 100%` : undefined }}>
              {months.map((m) => <div key={m.d} className="tl-vline" style={{ left: (m.d - range.start) * px }} />)}
              <div className="tl-today" style={{ left: (today - range.start) * px + px / 2 }}><span>Today</span></div>
              {rows.map((r) => {
                if (r.group) return <div key="g" className="tl-row tl-group" />
                const i = r.issue
                const b = barFor(i)
                const cat = i.type === 'Epic' ? 'epic' : statusCategory(i.status)
                const pct = i.type === 'Epic' && i.childCount ? Math.round((i.childDone / i.childCount) * 100) : null
                return (
                  <div key={i.key} className="tl-row" onDoubleClick={(e) => !b && schedule(e, i)} title={b ? '' : 'Double-click to schedule'}>
                    {b ? (
                      <div className={`tl-bar ${cat} ${drag?.key === i.key ? 'dragging' : ''}`}
                        style={{ left: (b.s - range.start) * px, width: Math.max(px, (b.e - b.s + 1) * px) }}
                        onPointerDown={(e) => startDrag(e, i, 'move')}
                        title={`${i.key} ${i.summary}\n${fmtDate(fromDay(b.s))} → ${fmtDate(fromDay(b.e))}`}>
                        {pct !== null && <span className="tl-progress" style={{ width: `${pct}%` }} />}
                        <span className="tl-handle l" onPointerDown={(e) => startDrag(e, i, 'start')} />
                        <span className="tl-bar-label">{(b.e - b.s + 1) * px > 90 ? i.summary : ''}</span>
                        <span className="tl-handle r" onPointerDown={(e) => startDrag(e, i, 'end')} />
                        {drag?.key === i.key && <span className="tl-drag-tip">{fmtDate(fromDay(b.s))} → {fmtDate(fromDay(b.e))}</span>}
                      </div>
                    ) : <span className="tl-unscheduled" style={{ left: (today - range.start) * px + 8 }}>Double-click to schedule</span>}
                    {b && i.assigneeId && (b.e - b.s + 1) * px > 40 && (
                      <span className="tl-avatar" style={{ left: (b.e - range.start + 1) * px + 6 }}><Avatar user={userById[i.assigneeId]} size={20} /></span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="list-footer"><span className="muted">Drag bars to move them, or drag their edges to change the start or due date. Click a bar to open the work item.</span><span className="spacer" /><Lozenge status="To Do" /><Lozenge status="In Progress" /><Lozenge status="Done" /></div>
    </div>
  )
}
