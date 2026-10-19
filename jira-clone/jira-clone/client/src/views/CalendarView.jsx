import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon, PriorityIcon } from '../icons.jsx'
import { Avatar, statusCategory, todayStr } from '../components/ui.jsx'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function CalendarView() {
  const { refreshKey, openIssue, toast, userById, bump, activeUsers } = useApp()
  const [issues, setIssues] = useState(null)
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [dragKey, setDragKey] = useState(null)
  const [overDay, setOverDay] = useState(null)
  const [creatingDay, setCreatingDay] = useState(null)
  const [who, setWho] = useState(null)
  const [hideDone, setHideDone] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(() => api.search(`project = ${getProject()} ORDER BY cf[10019] ASC`).then((d) => setIssues(d.issues)).catch((e) => toast({ title: 'Failed to load calendar', description: e.message, error: true })), [toast])
  useEffect(() => { load() }, [load, refreshKey])

  const cells = useMemo(() => {
    const first = new Date(cursor)
    first.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(first); d.setDate(first.getDate() + i); return d })
  }, [cursor])

  const visible = (issues || []).filter((i) => (!who || i.assigneeId === who) && (!hideDone || i.status !== 'Done'))
  const byDay = useMemo(() => {
    const m = {}
    visible.forEach((i) => { if (i.dueDate) (m[i.dueDate] ||= []).push(i) })
    return m
  }, [visible])
  const unscheduled = visible.filter((i) => !i.dueDate && i.status !== 'Done')

  const move = async (key, day) => {
    setDragKey(null); setOverDay(null)
    const issue = issues.find((i) => i.key === key)
    if (!issue || issue.dueDate === day) return
    setIssues((l) => l.map((i) => (i.key === key ? { ...i, dueDate: day } : i)))
    try { await api.update(key, { dueDate: day }); bump() } catch (e) { toast({ title: 'Couldn’t change the due date', description: e.message, error: true }); load() }
  }

  const create = async (day, summary) => {
    try { const i = await api.create({ summary, dueDate: day }); setIssues((l) => [...l, i]); toast(`${i.key} has been created`); bump() } catch (e) { toast({ title: 'Couldn’t create', description: e.message, error: true }) }
  }

  if (!issues) return <div className="center-pad"><div className="spinner" /></div>
  const today = todayStr()
  const Chip = ({ i, side }) => (
    <div className={`cal-chip ${statusCategory(i.status)} ${dragKey === i.key ? 'dragging' : ''}`} draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', i.key); setDragKey(i.key) }} onDragEnd={() => { setDragKey(null); setOverDay(null) }}
      onClick={(e) => { e.stopPropagation(); openIssue(i.key) }} title={`${i.key} ${i.summary} · ${i.status}`}>
      <TypeIcon type={i.type} size={14} />
      <span className={`cal-chip-text ${i.status === 'Done' ? 'done' : ''}`}>{i.summary}</span>
      {side && <PriorityIcon priority={i.priority} size={14} />}
      {i.assigneeId && <Avatar user={userById[i.assigneeId]} size={16} />}
    </div>
  )

  return (
    <div className="calendar-view">
      <div className="toolbar cal-toolbar">
        <div className="cal-nav">
          <button className="btn" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }}>Today</button>
          <button className="icon-btn bordered" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month"><Icon name="chevronLeft" size={16} /></button>
          <button className="icon-btn bordered" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month"><Icon name="chevronRight" size={16} /></button>
          <h2>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h2>
        </div>
        <span className="spacer" />
        <div className="avatar-filter">
          {activeUsers.map((u) => <button key={u.id} className={`avatar-toggle ${who === u.id ? 'on' : ''}`} onClick={() => setWho(who === u.id ? null : u.id)}><Avatar user={u} size={28} /></button>)}
        </div>
        <label className="check-label"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />Hide done</label>
      </div>
      <div className="cal-layout">
        <div className="cal-grid">
          {WEEKDAYS.map((w) => <div key={w} className="cal-weekday">{w}</div>)}
          {cells.map((d) => {
            const day = ymd(d)
            const items = byDay[day] || []
            const out = d.getMonth() !== cursor.getMonth()
            const limit = expanded === day ? 99 : 3
            return (
              <div key={day} className={`cal-cell ${out ? 'out' : ''} ${day === today ? 'today' : ''} ${overDay === day ? 'over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); if (overDay !== day) setOverDay(day) }}
                onDrop={(e) => { e.preventDefault(); move(e.dataTransfer.getData('text/plain') || dragKey, day) }}
                onDoubleClick={() => setCreatingDay(day)}>
                <div className="cal-date">
                  <span className={day === today ? 'today-num' : ''}>{d.getDate() === 1 ? `${MONTHS[d.getMonth()].slice(0, 3)} 1` : d.getDate()}</span>
                  <button className="icon-btn small cal-add" title="Create" onClick={() => setCreatingDay(day)}><Icon name="plus" size={14} /></button>
                </div>
                <div className="cal-items">
                  {items.slice(0, limit).map((i) => <Chip key={i.key} i={i} />)}
                  {items.length > limit && <button className="link small cal-more" onClick={() => setExpanded(day)}>+{items.length - limit} more</button>}
                  {expanded === day && items.length > 3 && <button className="link small cal-more" onClick={() => setExpanded(null)}>Show less</button>}
                  {creatingDay === day && (
                    <form onSubmit={(e) => { e.preventDefault(); const v = e.target.s.value.trim(); if (v) create(day, v); setCreatingDay(null) }}>
                      <input name="s" className="inline-input cal-input" autoFocus placeholder="What needs to be done?" onBlur={(e) => { if (!e.target.value.trim()) setCreatingDay(null) }} onKeyDown={(e) => e.key === 'Escape' && setCreatingDay(null)} />
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <aside className="cal-side" onDragOver={(e) => e.preventDefault()}>
          <h3>Unscheduled work <span className="count-pill">{unscheduled.length}</span></h3>
          <p className="muted small">Drag a work item onto a day to set its due date.</p>
          <div className="cal-side-list">
            {unscheduled.map((i) => <Chip key={i.key} i={i} side />)}
            {!unscheduled.length && <div className="muted small">Everything has a due date 🎉</div>}
          </div>
        </aside>
      </div>
    </div>
  )
}
