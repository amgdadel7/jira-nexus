import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon } from '../icons.jsx'
import { Avatar, Confirm, Dropdown, MenuItem, Modal, timeAgo } from '../components/ui.jsx'
import { AuditTable } from './ProjectSettingsPage.jsx'

export default function PeoplePage() {
  const { isAdmin, canGlobal } = useApp()
  const [tab, setTab] = useState(() => new URL(window.location.href).searchParams.get('tab') || 'users')
  const go = (t) => { setTab(t); const u = new URL(window.location.href); if (t === 'users') u.searchParams.delete('tab'); else u.searchParams.set('tab', t); window.history.replaceState(null, '', u.pathname + u.search) }
  const tabs = [['users', 'People'], ['global', 'Global permissions'], ...(isAdmin ? [['audit', 'Audit log']] : [])]
  return (
    <div className="people-page">
      <div className="page-tabs" role="tablist">
        {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => go(id)}>{label}</button>)}
      </div>
      {tab === 'users' && (canGlobal('BROWSE_USERS') ? <UsersTab /> : <div className="page-pad"><div className="notice-inline"><Icon name="lock" size={14} />You don’t have the “Browse users” global permission.</div></div>)}
      {tab === 'global' && <GlobalPermissionsTab />}
      {tab === 'audit' && isAdmin && <div className="page-pad"><div className="page-head"><div><h2>Audit log</h2><p className="muted">Every change to people, roles, permissions, projects and deleted work across the site.</p></div></div><AuditTable /></div>}
    </div>
  )
}

function GlobalPermissionsTab() {
  const { toast, refreshMeta } = useApp()
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState(null)
  useEffect(() => { api.globalPermissions().then((d) => { setData(d); setDraft(d.scheme) }).catch((e) => toast({ title: 'Failed to load', description: e.message, error: true })) }, [toast])
  if (!data) return <div className="center-pad"><div className="spinner" /></div>
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.scheme)
  const save = async () => { try { const d = await api.saveGlobalPermissions(draft); setData({ ...data, scheme: d.scheme }); setDraft(d.scheme); toast('Global permissions saved'); refreshMeta() } catch (e) { toast({ title: 'Couldn’t save', description: e.message, error: true }) } }
  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h2>Global permissions</h2><p className="muted">Site-wide abilities that aren’t tied to a project. Project access is managed in each project’s settings.</p></div>
        {data.canManage && <button className="btn primary" disabled={!dirty} onClick={save}>Save changes</button>}
      </div>
      {!data.canManage && <div className="notice-inline"><Icon name="lock" size={14} />Only site administrators can change global permissions.</div>}
      <table className="data-table perm-table global-perm-table">
        <thead><tr><th>Permission</th>{data.roles.map((r) => <th key={r.id} className="center" style={{ width: 160 }}>{r.label}</th>)}<th className="center" style={{ width: 90 }}>You</th></tr></thead>
        <tbody>
          {data.permissions.map((p) => (
            <tr key={p.key} data-perm={p.key}>
              <td><b>{p.name}</b><div className="muted small">{p.description}</div></td>
              {data.roles.map((r) => (
                <td key={r.id} className="center"><input type="checkbox" aria-label={`${p.name} – ${r.label}`} checked={draft[p.key].includes(r.id)} disabled={!data.canManage || r.id === 'admin'}
                  onChange={() => setDraft((d) => ({ ...d, [p.key]: d[p.key].includes(r.id) ? d[p.key].filter((x) => x !== r.id) : [...d[p.key], r.id] }))} /></td>
              ))}
              <td className="center">{data.mine.includes(p.key) ? <Icon name="check" size={16} strokeWidth={2.6} style={{ color: '#22A06B' }} /> : <Icon name="close" size={14} style={{ color: '#AE2E24' }} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UsersTab() {
  const { isAdmin, currentUser, toast, refreshMeta, openList, bump } = useApp()
  const [users, setUsers] = useState(null)
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const load = useCallback(() => api.users().then(setUsers).catch((e) => toast({ title: 'Failed to load people', description: e.message, error: true })), [toast])
  useEffect(() => { load() }, [load])

  const run = async (fn, ok) => {
    try { await fn(); await load(); refreshMeta?.(); bump(); if (ok) toast(ok) } catch (e) { toast({ title: 'Something went wrong', description: e.message, error: true }) }
  }
  if (!users) return <div className="center-pad"><div className="spinner" /></div>
  const shown = users.filter((u) => (showInactive || u.active) && (!q || `${u.name} ${u.email} ${u.title || ''}`.toLowerCase().includes(q.toLowerCase())))
  const inactive = users.filter((u) => !u.active).length

  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h2>People</h2><p className="muted">{isAdmin ? 'Manage who can access this site and what they can do.' : 'Everyone who works in this site.'}</p></div>
        {isAdmin && <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" size={16} />Add people</button>}
      </div>
      <div className="toolbar">
        <label className="list-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" /></label>
        {inactive > 0 && <label className="check-label"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Show deactivated ({inactive})</label>}
      </div>
      <div className="table-wrap">
        <table className="simple-table people-table">
          <thead><tr><th>Name</th><th style={{ width: 240 }}>Email</th><th style={{ width: 120 }}>Role</th><th style={{ width: 110 }}>Open work</th><th style={{ width: 130 }}>Last active</th>{isAdmin && <th style={{ width: 48 }} />}</tr></thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'inactive'}>
                <td><span className="inline-flex"><Avatar user={u} size={32} /><span><b>{u.name}</b>{u.id === currentUser?.id && <span className="muted small"> (you)</span>}<div className="muted small">{u.title || '—'}</div></span></span></td>
                <td>{u.email}</td>
                <td>
                  {isAdmin && u.id !== currentUser?.id && u.active ? (
                    <Dropdown trigger={({ ref, toggle }) => <button ref={ref} className={`role-pill ${u.role}`} onClick={toggle}>{u.role === 'admin' ? 'Admin' : 'Member'}<Icon name="chevronDown" size={12} /></button>}>
                      {(close) => (
                        <div className="menu">
                          <MenuItem selected={u.role === 'admin'} onClick={() => { close(); if (u.role !== 'admin') run(() => api.updateUser(u.id, { role: 'admin' }), `${u.name} is now an admin`) }}>Admin<div className="menu-sub">Manage people, project settings and demo data</div></MenuItem>
                          <MenuItem selected={u.role === 'member'} onClick={() => { close(); if (u.role !== 'member') run(() => api.updateUser(u.id, { role: 'member' }), `${u.name} is now a member`) }}>Member<div className="menu-sub">Create and edit work items</div></MenuItem>
                        </div>
                      )}
                    </Dropdown>
                  ) : <span className={`role-pill ${u.role}`}>{u.active ? (u.role === 'admin' ? 'Admin' : 'Member') : 'Deactivated'}</span>}
                </td>
                <td>{u.openCount > 0 ? <button className="link" onClick={() => openList(`assignee = "${u.name}" AND statusCategory != Done ORDER BY cf[10019] ASC`)}>{u.openCount}</button> : <span className="muted">0</span>}</td>
                <td className="muted">{u.lastLogin ? timeAgo(u.lastLogin) : 'Never'}</td>
                {isAdmin && (
                  <td>
                    <Dropdown align="end" trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn small" onClick={toggle} aria-label={`Actions for ${u.name}`}><Icon name="more" size={16} /></button>}>
                      {(close) => (
                        <div className="menu">
                          <MenuItem onClick={() => { close(); setEditing(u) }}>Edit details</MenuItem>
                          {u.active
                            ? <MenuItem danger disabled={u.id === currentUser?.id} onClick={() => { close(); setConfirm(u) }}>Deactivate</MenuItem>
                            : <MenuItem onClick={() => { close(); run(() => api.updateUser(u.id, { active: true }), `${u.name} was reactivated`) }}>Reactivate</MenuItem>}
                        </div>
                      )}
                    </Dropdown>
                  </td>
                )}
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={6} className="empty-row">No people match.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <UserEditor user={editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); run(async () => {}, msg) }} />}
      {confirm && <Confirm title={`Deactivate ${confirm.name}?`} body="They’ll be signed out and won’t be able to log in. Their open work items will be unassigned. You can reactivate them later." confirmLabel="Deactivate" onConfirm={() => run(() => api.deleteUser(confirm.id), `${confirm.name} was deactivated`)} onClose={() => setConfirm(null)} />}
    </div>
  )
}

function UserEditor({ user, onClose, onSaved }) {
  const isNew = !user.id
  const { projects } = useApp()
  const [f, setF] = useState({ name: user.name || '', email: user.email || '', title: user.title || '', role: user.role || 'member', password: '' })
  const [projRoles, setProjRoles] = useState({})
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      if (isNew) { await api.createUser({ ...f, projects: Object.entries(projRoles).filter(([, r]) => r).map(([key, role]) => ({ key, role })) }); onSaved(`${f.name} was added`) } else {
        const body = { name: f.name, email: f.email, title: f.title }
        if (f.password) body.password = f.password
        await api.updateUser(user.id, body); onSaved('Changes saved')
      }
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  const genPassword = () => setF({ ...f, password: Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 55]).join('') })
  return (
    <Modal onClose={onClose} width={520}>
      <form onSubmit={save} className="create-form">
        <div className="modal-header"><h2>{isNew ? 'Add people' : `Edit ${user.name}`}</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          <div className="field"><label className="field-title">Full name <span className="req">*</span></label><input className="text-input" autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label className="field-title">Email <span className="req">*</span></label><input type="email" className="text-input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="field"><label className="field-title">Job title</label><input className="text-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          {isNew && (
            <div className="field"><label className="field-title">Role</label>
              <div className="type-choices">{['member', 'admin'].map((r) => <button type="button" key={r} className={`type-choice ${f.role === r ? 'on' : ''}`} onClick={() => setF({ ...f, role: r })}>{r === 'admin' ? 'Admin' : 'Member'}</button>)}</div>
            </div>
          )}
          {isNew && f.role !== 'admin' && (
            <div className="field"><label className="field-title">Project access</label>
              <div className="proj-role-list">
                {projects.map((p) => (
                  <label key={p.key} className="proj-role-row"><span><b>{p.name}</b> <span className="muted small">{p.key} · {p.access || 'open'}</span></span>
                    <select className="text-input auto" aria-label={`Role in ${p.key}`} value={projRoles[p.key] || ''} onChange={(e) => setProjRoles({ ...projRoles, [p.key]: e.target.value })}>
                      <option value="">{p.access === 'private' ? 'No access' : p.access === 'limited' ? 'Default (Viewer)' : 'Default (Member)'}</option>
                      <option value="viewer">Viewer</option><option value="member">Member</option><option value="admin">Administrator</option>
                    </select></label>
                ))}
              </div></div>
          )}
          <div className="field">
            <label className="field-title">{isNew ? <>Temporary password <span className="req">*</span></> : 'Reset password'}</label>
            <div className="row-gap"><input className="text-input mono" required={isNew} minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder={isNew ? 'At least 8 characters' : 'Leave blank to keep the current password'} /><button type="button" className="btn" onClick={genPassword}>Generate</button></div>
            <div className="field-help">Share this password with them securely. They can change it in their profile.</div>
          </div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{isNew ? 'Add' : 'Save'}</button></div>
      </form>
    </Modal>
  )
}
