import React, { useEffect, useState } from 'react'
import { api, recent, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon, PriorityIcon, ProjectAvatar } from '../icons.jsx'
import { Avatar, Lozenge, fmtDate, timeAgo, isOverdue } from '../components/ui.jsx'

const TABS = [
  { id: 'assigned', label: 'Assigned to me' },
  { id: 'worked', label: 'Worked on' },
  { id: 'viewed', label: 'Viewed' },
  { id: 'starred', label: 'Starred' },
]

export default function ForYouView() {
  const { currentUser, openIssue, openList, navigate, filters, refreshKey, toast, userById, meta, projects, openProject } = useApp()
  const [tab, setTab] = useState('assigned')
  const [assigned, setAssigned] = useState(null)
  const [worked, setWorked] = useState(null)
  const [viewed, setViewed] = useState(() => recent.get())

  useEffect(() => {
    api.search('assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC').then((d) => setAssigned(d.issues)).catch((e) => toast({ title: 'Failed to load', description: e.message, error: true }))
    api.workedOn().then((d) => setWorked(d.issues)).catch(() => setWorked([]))
  }, [refreshKey, toast])
  useEffect(() => {
    const h = () => setViewed(recent.get())
    window.addEventListener('jc-recent', h); window.addEventListener('storage', h)
    return () => { window.removeEventListener('jc-recent', h); window.removeEventListener('storage', h) }
  }, [])

  const starred = (filters || []).filter((f) => f.starred)
  const count = { assigned: assigned?.length, worked: worked?.length, viewed: viewed.length, starred: starred.length }

  const Row = ({ i, right }) => (
    <button className="foryou-row" onClick={() => openIssue(i.key)}>
      <TypeIcon type={i.type} />
      <div className="foryou-main">
        <div className="truncate"><b className={i.status === 'Done' ? 'done' : ''}>{i.summary}</b></div>
        <div className="muted small">{i.key} · {meta.project?.name || 'KAN'}</div>
      </div>
      {i.priority && <PriorityIcon priority={i.priority} />}
      {i.status && <Lozenge status={i.status} />}
      <span className="foryou-right muted small">{right}</span>
      {i.assigneeId !== undefined && <Avatar user={userById[i.assigneeId]} size={24} />}
    </button>
  )

  return (
    <div className="page-pad foryou">
      <div className="foryou-hero">
        <Avatar user={currentUser} size={56} />
        <div><h1>Hi {currentUser?.name.split(' ')[0]} 👋</h1><p className="muted">Here’s the work that needs your attention.</p></div>
      </div>
      <section className="foryou-projects">
        <div className="sub-title"><h3>Recent projects</h3><button className="link" onClick={() => navigate({ page: 'projects' })}>View all projects</button></div>
        <div className="project-cards">
          {[...projects].sort((a, b) => (b.key === meta.project.key) - (a.key === meta.project.key) || b.starred - a.starred).slice(0, 4).map((p) => {
            const mine = (assigned || []).filter((i) => i.key.startsWith(`${p.key}-`)).length
            return (
              <div key={p.key} role="button" tabIndex={0} className="project-card" onClick={() => openProject(p.key, 'summary')} onKeyDown={(e) => { if (e.key === 'Enter') openProject(p.key, 'summary') }}>
                <span className="project-card-band" style={{ background: p.color }} />
                <ProjectAvatar size={32} project={p} />
                <div><b>{p.name}</b><div className="muted small">Team-managed {p.type === 'software' ? 'software' : 'business'}</div></div>
                <div className="project-card-links">
                  <span className="muted small">Quick links</span>
                  <span onClick={(e) => { e.stopPropagation(); navigate({ page: 'project', project: p.key, view: 'list', jql: `project = ${p.key} AND assignee = currentUser() AND statusCategory != Done ORDER BY cf[10019] ASC` }) }} className="pc-link">My open work items <span className="count-pill">{assigned ? mine : '…'}</span></span>
                  <span onClick={(e) => { e.stopPropagation(); openProject(p.key, 'board') }} className="pc-link">Board</span>
                  {p.type === 'software' && <span onClick={(e) => { e.stopPropagation(); openProject(p.key, 'backlog') }} className="pc-link">Backlog</span>}
                </div>
              </div>
            )
          })}
        </div>
      </section>
      <div className="code-tabs">
        {TABS.map((t) => <button key={t.id} className={`code-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>{t.label}{count[t.id] != null && <span className="count-pill">{count[t.id]}</span>}</button>)}
      </div>
      <div className="foryou-list">
        {tab === 'assigned' && (!assigned ? <div className="spinner" /> : assigned.length ? (
          <>
            {assigned.map((i) => <Row key={i.key} i={i} right={i.dueDate ? <span className={isOverdue(i) ? 'overdue' : ''}>Due {fmtDate(i.dueDate)}</span> : `Updated ${timeAgo(i.updated)}`} />)}
            <button className="link foryou-more" onClick={() => openList('assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC')}>View all in list <Icon name="chevronRight" size={14} /></button>
          </>
        ) : <Empty title="You’re all caught up" body="Nothing is assigned to you right now." />)}
        {tab === 'worked' && (!worked ? <div className="spinner" /> : worked.length ? worked.map((i) => <Row key={i.key} i={i} right={`You updated ${timeAgo(i.lastActivity)}`} />) : <Empty title="No activity yet" body="Work items you edit or comment on will show up here." />)}
        {tab === 'viewed' && (viewed.length ? (
          <>
            {viewed.map((i) => <Row key={i.key} i={i} right={i.viewed ? `Viewed ${timeAgo(i.viewed)}` : ''} />)}
            <button className="link foryou-more" onClick={() => { recent.clear(); setViewed([]) }}>Clear history</button>
          </>
        ) : <Empty title="Nothing viewed yet" body="Work items you open will show up here." />)}
        {tab === 'starred' && (starred.length ? starred.map((f) => (
          <button key={f.id} className="foryou-row" onClick={() => openList(f.jql)}>
            <Icon name="filter" size={18} />
            <div className="foryou-main"><div className="truncate"><b>{f.name}</b></div><div className="muted small mono truncate">{f.jql}</div></div>
            <Icon name="star" size={16} className="starred-icon" />
          </button>
        )) : <Empty title="No starred filters" body={<>Star a filter on the <button className="link" onClick={() => navigate({ page: 'filters' })}>Filters</button> page to pin it here.</>} />)}
      </div>
    </div>
  )
}

function Empty({ title, body }) {
  return <div className="empty-state small"><h3>{title}</h3><p>{body}</p></div>
}
