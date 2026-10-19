import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, ProjectAvatar } from '../icons.jsx'
import { Avatar, Modal, UserPicker, timeAgo, fmtDateTime, fmtDate } from './ui.jsx'
import { DeleteProjectModal } from '../views/ProjectsPage.jsx'

const PROJECT_COLORS = ['#FFAB00', '#0C66E4', '#22A06B', '#E2483D', '#6E5DC6', '#1D7AFC', '#D97008', '#943D73']

const COLORS = ['#0052CC', '#6554C0', '#00875A', '#FF5630', '#FF991F', '#00B8D9', '#8777D9', '#36B37E', '#DE350B', '#5243AA']

export function ProfileModal({ onClose }) {
  const { currentUser, refreshMeta, toast } = useApp()
  const [f, setF] = useState({ name: currentUser.name, title: currentUser.title || '', color: currentUser.color })
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [err, setErr] = useState(null)
  const [pwErr, setPwErr] = useState(null)
  const saveProfile = async (e) => {
    e.preventDefault(); setErr(null)
    try { await api.updateMe(f); await refreshMeta(); toast('Profile updated') } catch (e2) { setErr(e2.message) }
  }
  const savePw = async (e) => {
    e.preventDefault(); setPwErr(null)
    if (pw.newPassword !== pw.confirm) { setPwErr('The new passwords don’t match.'); return }
    try { await api.updateMe({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }); setPw({ currentPassword: '', newPassword: '', confirm: '' }); toast('Password changed. Other sessions were signed out.') } catch (e2) { setPwErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={560}>
      <div className="modal-header"><h2>Profile and visibility</h2><button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
      <div className="modal-body scroll">
        <form onSubmit={saveProfile}>
          <div className="profile-head"><Avatar user={{ ...currentUser, ...f }} size={64} /><div><b>{f.name}</b><div className="muted">{currentUser.email}</div></div></div>
          <div className="field"><label className="field-title">Full name</label><input className="text-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label className="field-title">Job title</label><input className="text-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Financial Controller" /></div>
          <div className="field"><label className="field-title">Avatar color</label>
            <div className="color-row">{COLORS.map((c) => <button type="button" key={c} className={`color-dot ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={c} />)}</div>
          </div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
          <div className="editor-actions"><button className="btn primary">Save profile</button></div>
        </form>
        <hr />
        <form onSubmit={savePw}>
          <h3 className="sub-title">Change password</h3>
          <div className="field"><label className="field-title">Current password</label><input type="password" className="text-input" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></div>
          <div className="field-row">
            <div className="field" style={{ flex: 1 }}><label className="field-title">New password</label><input type="password" className="text-input" autoComplete="new-password" minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required /></div>
            <div className="field" style={{ flex: 1 }}><label className="field-title">Confirm new password</label><input type="password" className="text-input" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></div>
          </div>
          <div className="field-help">At least 8 characters.</div>
          {pwErr && <div className="field-error"><Icon name="warning" size={14} />{pwErr}</div>}
          <div className="editor-actions"><button className="btn">Change password</button></div>
        </form>
        <hr />
        <SessionsSection />
        <ApiTokensSection />
      </div>
      <div className="modal-footer"><button className="btn subtle" onClick={onClose}>Close</button></div>
    </Modal>
  )
}

function describeAgent(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /curl|node|undici/i.test(ua) ? 'API client' : 'Unknown browser'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${browser} on ${os}` : browser
}

function SessionsSection() {
  const { toast } = useApp()
  const [list, setList] = useState(null)
  const load = useCallback(() => api.sessions().then(setList).catch((e) => toast({ title: 'Couldn’t load sessions', description: e.message, error: true })), [toast])
  useEffect(() => { load() }, [load])
  const others = (list || []).filter((s) => !s.current).length
  return (
    <div>
      <div className="sub-title"><h3>Where you’re logged in</h3>
        <button className="btn small" disabled={!others} onClick={async () => { const r = await api.revokeOtherSessions(); toast(`Signed out of ${r.removed} other session${r.removed === 1 ? '' : 's'}`); load() }}>Log out of all other sessions</button>
      </div>
      {!list ? <div className="spinner small" /> : (
        <div className="session-list">
          {list.map((s) => (
            <div key={s.id} className="session-row">
              <Icon name="user" size={18} />
              <div className="session-main">
                <b>{describeAgent(s.userAgent)}</b>{s.current && <span className="role-pill member">This device</span>}
                <div className="muted small" title={`Signed in ${fmtDateTime(s.created)} · expires ${fmtDateTime(s.expires)}`}>
                  Active {timeAgo(s.lastSeen)} · {s.remember ? 'Remembered' : 'Until the browser closes'}
                </div>
              </div>
              {!s.current && <button className="btn subtle small" onClick={async () => { await api.revokeSession(s.id); load() }}>Log out</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProjectSettingsModal({ onClose }) {
  const { meta, activeUsers, userById, refreshMeta, toast, isAdmin, bump, navigate, currentUser, projects } = useApp()
  const [f, setF] = useState({ name: meta.project.name, description: meta.project.description || '', leadId: meta.project.leadId, color: meta.project.color || '#FFAB00', category: meta.project.category || '' })
  const [deleting, setDeleting] = useState(null)
  const canEdit = isAdmin || meta.project.leadId === currentUser.id
  const [err, setErr] = useState(null)
  const save = async (e) => {
    e.preventDefault(); setErr(null)
    try { await api.updateProject(f); await refreshMeta(); toast('Project details saved'); onClose() } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={600}>
      <form onSubmit={save} className="create-form">
        <div className="modal-header"><h2>Project settings</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body scroll">
          <div className="profile-head"><ProjectAvatar size={56} color={f.color} /><div><b>{f.name}</b><div className="muted">Key: {meta.project.key} · Team-managed {meta.project.type === 'software' ? 'software' : 'business'}</div></div></div>
          {!canEdit && <div className="notice-inline"><Icon name="info" size={14} />Only the project lead or an administrator can change these settings.</div>}
          <div className="field"><label className="field-title">Icon colour</label>
            <div className="color-row">{PROJECT_COLORS.map((c) => <button type="button" key={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={`Colour ${c}`} />)}</div></div>
          <div className="field"><label className="field-title">Category</label><input className="text-input narrow" maxLength={60} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="e.g. Engineering" /></div>
          <div className="field"><label className="field-title">Name <span className="req">*</span></label><input className="text-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label className="field-title">Key</label><input className="text-input narrow" value={meta.project.key} disabled /></div>
          <div className="field"><label className="field-title">Description</label><textarea className="text-input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="field"><label className="field-title">Project lead</label>
            <UserPicker users={activeUsers} value={f.leadId} allowUnassigned={false} onChange={(leadId) => setF({ ...f, leadId })} trigger={({ ref, toggle }) => (
              <button type="button" ref={ref} className="fake-select" onClick={toggle}><Avatar user={userById[f.leadId]} size={22} />{userById[f.leadId]?.name || 'Select lead'}<Icon name="chevronDown" size={16} className="chev" /></button>
            )} />
          </div>
          <div className="field"><label className="field-title">Workflow</label>
            <div className="workflow">{meta.statuses.map((s, i) => <React.Fragment key={s}>{i > 0 && <Icon name="chevronRight" size={14} />}<span className={`lozenge ${s === 'Done' ? 'done' : s === 'To Do' ? 'todo' : 'inprogress'}`}>{s}</span></React.Fragment>)}</div>
          </div>
          <div className="field"><label className="field-title">Work types</label><div className="muted">{meta.types.join(' · ')}</div></div>
          {isAdmin && (
            <div className="danger-zone">
              <div><b>Reset demo data</b><div className="muted small">Restores the sample project and removes all changes. Admins only.</div></div>
              <button type="button" className="btn danger" onClick={async () => { if (!window.confirm('Reset all data to the demo state?')) return; await api.reset(); await refreshMeta(); bump(); toast('Demo data has been reset'); onClose() }}>Reset</button>
            </div>
          )}
          {isAdmin && projects.length > 1 && (
            <div className="danger-zone">
              <div><b>Delete this project</b><div className="muted small">Removes {meta.project.key} with all of its work items, sprints and releases.</div></div>
              <button type="button" className="btn danger" onClick={async () => setDeleting(await api.project(meta.project.key))}>Delete project</button>
            </div>
          )}
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!canEdit}>Save</button></div>
      </form>
      {deleting && <DeleteProjectModal project={deleting} onClose={() => setDeleting(null)} onDeleted={() => { toast(`${deleting.name} deleted`); setDeleting(null); onClose(); navigate({ page: 'projects', project: projects.find((p) => p.key !== deleting.key)?.key }) }} />}
    </Modal>
  )
}

function ApiTokensSection() {
  const { toast } = useApp()
  const [tokens, setTokens] = useState(null)
  const [name, setName] = useState('')
  const [days, setDays] = useState('90')
  const [created, setCreated] = useState(null)
  const [err, setErr] = useState(null)
  const load = useCallback(() => api.apiTokens().then(setTokens).catch((e) => { setTokens([]); setErr(e.message) }), [])
  useEffect(() => { load() }, [load])
  const create = async (e) => {
    e.preventDefault(); setErr(null)
    try { const t = await api.createApiToken(name.trim(), days ? Number(days) : null); setCreated(t); setName(''); load() } catch (e2) { setErr(e2.message) }
  }
  const copy = () => navigator.clipboard?.writeText(created.token).then(() => toast('Token copied to clipboard')).catch(() => {})
  return (
    <div className="sessions api-tokens">
      <div className="sessions-head"><div><h3>API tokens</h3><p className="muted small">Use a token instead of a password in scripts: <code>Authorization: Bearer &lt;token&gt;</code>. <a href="/api/docs" target="_blank" rel="noreferrer">API docs</a></p></div></div>
      {created && (
        <div className="token-created" role="status">
          <b>Copy your new token now. You won’t be able to see it again.</b>
          <div className="token-value"><code>{created.token}</code><button type="button" className="btn" onClick={copy}><Icon name="copy" size={14} />Copy</button></div>
          <button type="button" className="link small" onClick={() => setCreated(null)}>I’ve saved it</button>
        </div>
      )}
      <form className="token-form" onSubmit={create}>
        <input className="text-input" placeholder="Token name, e.g. CI pipeline" aria-label="Token name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <select className="text-input auto" aria-label="Expires" value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="30">Expires in 30 days</option><option value="90">Expires in 90 days</option><option value="365">Expires in 1 year</option><option value="">Never expires</option>
        </select>
        <button className="btn" disabled={!name.trim()}>Create token</button>
      </form>
      {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
      {tokens && tokens.length > 0 && (
        <ul className="session-list">
          {tokens.map((t) => (
            <li key={t.id} className="session-row">
              <Icon name="key" size={18} />
              <div className="session-info">
                <b>{t.name}</b> <code className="muted small">{t.prefix}…</code>{t.expired && <span className="lozenge removed">Expired</span>}
                <div className="muted small">Created {fmtDate(t.created)} · {t.lastUsed ? `Last used ${timeAgo(t.lastUsed)}` : 'Never used'} · {t.expires ? `${t.expired ? 'Expired' : 'Expires'} ${fmtDate(t.expires)}` : 'No expiry'}</div>
              </div>
              <button type="button" className="btn subtle small" onClick={async () => { await api.revokeApiToken(t.id); toast(`Token “${t.name}” revoked`); load() }}>Revoke</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
