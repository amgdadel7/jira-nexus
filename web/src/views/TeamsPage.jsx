import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon } from '../icons.jsx'
import { Avatar, Modal, Confirm } from '../components/ui.jsx'

const TEAM_COLORS = ['#0C66E4', '#E2483D', '#22A06B', '#6E5DC6', '#D97008', '#1D7AFC', '#943D73', '#FFAB00']

function TeamModal({ team, onClose, onSaved }) {
  const { activeUsers, currentUser } = useApp()
  const [f, setF] = useState({ name: team?.name || '', description: team?.description || '', color: team?.color || TEAM_COLORS[0], members: team?.members || [currentUser.id] })
  const [err, setErr] = useState(null)
  const toggle = (id) => setF((x) => ({ ...x, members: x.members.includes(id) ? x.members.filter((m) => m !== id) : [...x.members, id] }))
  const submit = async (e) => {
    e.preventDefault(); setErr(null)
    try { onSaved(team?.id ? await api.updateTeam(team.id, f) : await api.createTeam(f)) } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={520}>
      <form onSubmit={submit} className="create-form">
        <div className="modal-header"><h2>{team?.id ? 'Edit team' : 'Create team'}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body scroll">
          <div className="field"><label className="field-title" htmlFor="tm-name">Team name <span className="req">*</span></label><input id="tm-name" className="text-input" autoFocus maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label className="field-title" htmlFor="tm-desc">Description</label><textarea id="tm-desc" className="text-input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="field"><label className="field-title">Colour</label>
            <div className="color-row">{TEAM_COLORS.map((c) => <button type="button" key={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={`Colour ${c}`} />)}</div></div>
          <div className="field"><label className="field-title">Members ({f.members.length})</label>
            <div className="member-checklist">
              {activeUsers.map((u) => (
                <label key={u.id} className="check-label"><input type="checkbox" checked={f.members.includes(u.id)} onChange={() => toggle(u.id)} /><Avatar user={u} size={22} />{u.name}<span className="muted small">{u.title}</span></label>
              ))}
            </div></div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!f.name.trim()}>{team?.id ? 'Save' : 'Create team'}</button></div>
      </form>
    </Modal>
  )
}

export default function TeamsPage() {
  const { userById, toast, canGlobal, openList, refreshMeta, refreshKey } = useApp()
  const [teams, setTeams] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [q, setQ] = useState('')
  const load = useCallback(() => api.teams().then(setTeams).catch(() => setTeams([])), [])
  useEffect(() => { load() }, [load, refreshKey])
  if (!teams) return <div className="center-pad"><div className="spinner" /></div>
  const canCreate = canGlobal('MANAGE_TEAMS')
  const shown = teams.filter((t) => !q || `${t.name} ${t.description}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h2>Teams</h2><p className="muted">Teams group people who work together. Assign work items to a team and filter with <code>team = "Name"</code> in JQL.</p></div>
        {canCreate && <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" size={16} />Create team</button>}
      </div>
      <div className="toolbar"><label className="list-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams" aria-label="Search teams" /></label></div>
      {shown.length === 0 ? <div className="empty-state"><Icon name="team" size={32} /><p>No teams found.</p></div> : (
        <div className="team-grid">
          {shown.map((t) => (
            <div key={t.id} className="team-card" data-team={t.name}>
              <div className="team-card-head">
                <span className="team-dot" style={{ background: t.color }}><Icon name="team" size={18} /></span>
                <div className="grow"><b>{t.name}</b><div className="muted small">{t.members.length} member{t.members.length === 1 ? '' : 's'}</div></div>
                {t.canEdit && <><button className="icon-btn" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Icon name="edit" size={16} /></button><button className="icon-btn" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}><Icon name="trash" size={16} /></button></>}
              </div>
              <p className="muted small team-desc">{t.description || 'No description.'}</p>
              <div className="avatar-stack">{t.members.slice(0, 8).map((id) => <Avatar key={id} user={userById[id]} size={28} />)}{t.members.length > 8 && <span className="more-count">+{t.members.length - 8}</span>}</div>
              <button className="link small" onClick={() => openList(`team = "${t.name}" ORDER BY updated DESC`)}>{t.openCount} open of {t.issueCount} work items →</button>
            </div>
          ))}
        </div>
      )}
      {editing && <TeamModal team={editing} onClose={() => setEditing(null)} onSaved={(t) => { toast(editing.id ? 'Team updated' : `Team ${t.name} created`); setEditing(null); load(); refreshMeta() }} />}
      {deleting && <Confirm title={`Delete ${deleting.name}?`} body="Work items assigned to this team will no longer have a team. People aren’t affected." onClose={() => setDeleting(null)}
        onConfirm={async () => { await api.deleteTeam(deleting.id); toast(`Team ${deleting.name} deleted`); setDeleting(null); load(); refreshMeta() }} />}
    </div>
  )
}
