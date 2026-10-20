import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, ProjectAvatar } from '../icons.jsx'
import { Avatar, Dropdown, MenuItem, Modal, timeAgo } from '../components/ui.jsx'

const TYPE_LABEL = { software: 'Team-managed software', business: 'Team-managed business', service: 'Service management' }
const COLORS = ['#FFAB00', '#0C66E4', '#22A06B', '#E2483D', '#6E5DC6', '#1D7AFC', '#D97008', '#943D73']

/** Suggest a Jira-style key from a project name: initials, or the first letters of a single word. */
export function suggestKey(name) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  let k = words.length > 1 ? words.map((w) => w[0]).join('') : words[0].slice(0, 4)
  if (!/^[A-Z]/.test(k)) k = `P${k}`
  return k.slice(0, 6)
}

export function CreateProjectModal({ onClose, onCreated }) {
  const { activeUsers, currentUser } = useApp()
  const [f, setF] = useState({ name: '', key: '', type: 'software', leadId: currentUser.id, description: '', color: COLORS[1], access: 'open' })
  const [keyTouched, setKeyTouched] = useState(false)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const onName = (name) => set({ name, ...(keyTouched ? {} : { key: suggestKey(name) }) })
  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true)
    try { const p = await api.createProject(f); onCreated(p) } catch (e2) { setErr(e2.message); setBusy(false) }
  }
  return (
    <Modal onClose={onClose} width={620}>
      <form onSubmit={submit} className="create-form">
        <div className="modal-header"><h2>Create project</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          <div className="template-pick">
            {[['software', 'Scrum', 'Plan in sprints with a backlog, board, releases and reports.', 'backlog'], ['business', 'Business', 'Track tasks with a list, board, calendar and timeline. No sprints.', 'list']].map(([id, title, desc, icon]) => (
              <button type="button" key={id} className={`template ${f.type === id ? 'on' : ''}`} onClick={() => set({ type: id })} aria-pressed={f.type === id}>
                <span className="template-icon"><Icon name={icon} size={20} /></span>
                <span><b>{title}</b><span className="muted small">{desc}</span></span>
              </button>
            ))}
          </div>
          <div className="field"><label className="field-title" htmlFor="pname">Name <span className="req">*</span></label>
            <input id="pname" className="text-input" autoFocus required maxLength={80} value={f.name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Operations" /></div>
          <div className="field-row">
            <div className="field"><label className="field-title" htmlFor="pkey">Key <span className="req">*</span></label>
              <input id="pkey" className="text-input narrow mono" required maxLength={10} value={f.key}
                onChange={(e) => { setKeyTouched(true); set({ key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }) }} />
              <div className="field-help">Work items will be numbered {f.key || 'KEY'}-1, {f.key || 'KEY'}-2…</div></div>
            <div className="field"><label className="field-title" htmlFor="plead">Project lead</label>
              <select id="plead" className="text-input" value={f.leadId} onChange={(e) => set({ leadId: e.target.value })}>
                {activeUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select></div>
          </div>
          <div className="field"><label className="field-title">Icon colour</label>
            <div className="color-row">{COLORS.map((c) => <button type="button" key={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ color: c })} aria-label={`Colour ${c}`} />)}
              <span className="color-preview"><ProjectAvatar size={28} color={f.color} /></span></div></div>
          <div className="field"><label className="field-title">Access</label>
            <div className="access-levels compact" role="radiogroup" aria-label="Access">
              {[['open', 'globe', 'Open', 'Everyone on the site can view and edit'], ['limited', 'eye', 'Limited', 'Everyone can view; only members edit'], ['private', 'lock', 'Private', 'Only people you add']].map(([id, icon, label, text]) => (
                <label key={id} className={`access-card ${f.access === id ? 'on' : ''}`}><input type="radio" name="paccess" value={id} checked={f.access === id} onChange={() => set({ access: id })} /><Icon name={icon} size={18} /><span><b>{label}</b><span className="muted small">{text}</span></span></label>
              ))}
            </div></div>
          <div className="field"><label className="field-title" htmlFor="pdesc">Description</label>
            <textarea id="pdesc" className="text-input" rows={2} maxLength={2000} value={f.description} onChange={(e) => set({ description: e.target.value })} /></div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !f.name.trim() || f.key.length < 2}>{busy ? 'Creating…' : 'Create project'}</button></div>
      </form>
    </Modal>
  )
}

export default function ProjectsPage() {
  const { userById, openProject, toast, refreshMeta, refreshKey, isAdmin, currentUser, canGlobal, navigate } = useApp()
  const [projects, setProjects] = useState(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState({ by: 'name', dir: 1 })
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const load = useCallback(() => api.projects().then(setProjects).catch((e) => toast({ title: 'Could not load projects', description: e.message, error: true })), [toast])
  useEffect(() => { load() }, [load, refreshKey])

  const rows = useMemo(() => {
    const list = (projects || []).filter((p) => (!type || p.type === type) && (!q.trim() || `${p.name} ${p.key}`.toLowerCase().includes(q.trim().toLowerCase())))
    const val = (p) => ({ name: p.name.toLowerCase(), key: p.key, type: p.type, lead: userById[p.leadId]?.name || '', open: p.stats.open, activity: p.stats.lastActivity || '' }[sort.by])
    return [...list].sort((a, b) => (b.starred - a.starred) || (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir)
  }, [projects, q, type, sort, userById])

  const star = async (p) => { await api.starProject(p.key, !p.starred); load(); refreshMeta() }
  const head = (by, label) => (
    <th><button className="th-btn" onClick={() => setSort((s) => ({ by, dir: s.by === by ? -s.dir : 1 }))}>{label}{sort.by === by && <Icon name={sort.dir > 0 ? 'arrowUp' : 'arrowDown'} size={12} />}</button></th>
  )

  return (
    <div className="page-pad projects-page">
      <div className="page-head">
        <div><h1>Projects</h1><p className="muted">{projects ? `${projects.length} projects` : 'Loading…'}</p></div>
        {canGlobal('CREATE_PROJECTS') && <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} />Create project</button>}
      </div>
      <div className="toolbar">
        <label className="list-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" aria-label="Search projects" /></label>
        <select className="text-input auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="">All project types</option><option value="software">Software</option><option value="business">Business</option>
        </select>
      </div>
      <table className="data-table projects-table">
        <thead><tr><th style={{ width: 36 }} />{head('name', 'Name')}{head('key', 'Key')}{head('type', 'Type')}{head('lead', 'Lead')}<th>Access</th><th>Your role</th>{head('open', 'Open work')}{head('activity', 'Last activity')}<th style={{ width: 40 }} /></tr></thead>
        <tbody>
          {rows.map((p) => {
            const lead = userById[p.leadId]
            const pct = p.stats.total ? Math.round((p.stats.done / p.stats.total) * 100) : 0
            return (
              <tr key={p.key}>
                <td><button className={`star-btn ${p.starred ? 'on' : ''}`} onClick={() => star(p)} title={p.starred ? 'Unstar' : 'Star'} aria-label={`Star ${p.name}`}><Icon name="star" size={16} /></button></td>
                <td><button className="project-cell" onClick={() => openProject(p.key, 'summary')}><ProjectAvatar size={24} project={p} /><span><b>{p.name}</b>{p.description && <span className="muted small truncate">{p.description}</span>}</span></button></td>
                <td className="mono">{p.key}</td>
                <td className="muted">{TYPE_LABEL[p.type] || p.type}</td>
                <td>{lead ? <span className="user-cell"><Avatar user={lead} size={22} />{lead.name}</span> : <span className="muted">—</span>}</td>
                <td><span className={`access-pill ${p.access}`}><Icon name={{ open: 'globe', limited: 'eye', private: 'lock' }[p.access] || 'globe'} size={12} />{p.access ? p.access[0].toUpperCase() + p.access.slice(1) : 'Open'}</span></td>
                <td><span className={`role-badge ${p.myRole || 'none'}`}>{{ admin: 'Administrator', member: 'Member', viewer: 'Viewer' }[p.myRole] || '—'}</span></td>
                <td><div className="mini-progress" title={`${p.stats.done} of ${p.stats.total} done`}><span>{p.stats.open}</span><div className="bar-track"><div style={{ width: `${pct}%` }} /></div></div></td>
                <td className="muted">{p.stats.lastActivity ? timeAgo(p.stats.lastActivity) : '—'}</td>
                <td>
                  <Dropdown align="end" trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn" onClick={toggle} aria-label={`Actions for ${p.name}`}><Icon name="more" size={16} /></button>}>
                    {(close) => (
                      <div className="menu">
                        <MenuItem onClick={() => { close(); openProject(p.key, 'list') }}>Open list</MenuItem>
                        {p.type === 'software' && <MenuItem onClick={() => { close(); openProject(p.key, 'backlog') }}>Open backlog</MenuItem>}
                        <MenuItem onClick={() => { close(); navigate({ page: 'settings', project: p.key, section: 'access' }) }}>People and access</MenuItem>
                        <MenuItem onClick={() => { close(); star(p) }}>{p.starred ? 'Remove from starred' : 'Add to starred'}</MenuItem>
                        <MenuItem danger disabled={!isAdmin || projects.length <= 1} onClick={() => { close(); setDeleting(p) }}>Delete project</MenuItem>
                      </div>
                    )}
                  </Dropdown>
                </td>
              </tr>
            )
          })}
          {projects && !rows.length && <tr><td colSpan={8} className="empty-cell">No projects match your search.</td></tr>}
        </tbody>
      </table>
      {creating && <CreateProjectModal onClose={() => setCreating(false)} onCreated={(p) => { setCreating(false); toast(`Project ${p.name} created`); refreshMeta(); openProject(p.key, p.type === 'software' ? 'backlog' : 'list') }} />}
      {deleting && (
        <DeleteProjectModal project={deleting} onClose={() => setDeleting(null)} onDeleted={(n) => {
          toast(`${deleting.name} deleted${n ? ` with ${n} work items` : ''}`); setDeleting(null); load(); refreshMeta()
        }} />
      )}
      <p className="muted small page-foot">Signed in as {currentUser.name}. Project leads and admins can change a project's settings; only admins can delete projects.</p>
    </div>
  )
}

export function DeleteProjectModal({ project, onClose, onDeleted }) {
  const [typed, setTyped] = useState('')
  const [err, setErr] = useState(null)
  const go = async (e) => {
    e.preventDefault()
    try { const r = await api.deleteProject(project.key, typed); onDeleted(r.removedIssues) } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={460} className="confirm">
      <form onSubmit={go}>
        <div className="modal-header"><h2 className="danger-title"><Icon name="warning" size={22} /> Delete {project.name}?</h2></div>
        <div className="modal-body">
          <p>This permanently deletes the project and its <b>{project.stats.total}</b> work items, sprints, releases and forms. This can’t be undone.</p>
          <div className="field"><label className="field-title" htmlFor="confirm-key">Type <b className="mono">{project.key}</b> to confirm</label>
            <input id="confirm-key" className="text-input mono" autoFocus value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} /></div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn danger" disabled={typed !== project.key}>Delete project</button></div>
      </form>
    </Modal>
  )
}
