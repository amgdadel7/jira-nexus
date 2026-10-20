import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, ProjectAvatar, TypeIcon } from '../icons.jsx'
import { Avatar, Modal, UserPicker, Confirm, fmtDate, fmtDateTime, timeAgo } from '../components/ui.jsx'
import { DeleteProjectModal } from './ProjectsPage.jsx'
import { PlanLock } from './BillingPage.jsx'
import { AutomationSection, ImportSection } from './AutomationPage.jsx'
import ReleasesView from './ReleasesView.jsx'
import TeamsPage from './TeamsPage.jsx'

const PROJECT_COLORS = ['#FFAB00', '#0C66E4', '#22A06B', '#E2483D', '#6E5DC6', '#1D7AFC', '#D97008', '#943D73']
export const SETTINGS_SECTIONS = [
  { id: 'details', label: 'Details', icon: 'folder' },
  { id: 'access', label: 'Access & Members', icon: 'people' },
  { id: 'permissions', label: 'Permissions', icon: 'shield' },
  { id: 'workflows', label: 'Workflows', icon: 'timeline' },
  { id: 'fields', label: 'Custom fields', icon: 'list' },
  { id: 'components', label: 'Components', icon: 'puzzle' },
  { id: 'versions', label: 'Versions & releases', icon: 'release', software: true },
  { id: 'teams', label: 'Teams', icon: 'team' },
  { id: 'board', label: 'Board', icon: 'board', software: true },
  { id: 'automation', label: 'Automation', icon: 'lightning' },
  { id: 'import', label: 'Import work items', icon: 'upload' },
  { id: 'trash', label: 'Recycle bin', icon: 'trash' },
  { id: 'audit', label: 'Audit log', icon: 'history' },
]
export const ACCESS_LEVELS = [
  { id: 'open', label: 'Open', icon: 'globe', text: 'Anyone on the site can view, create and edit work items.' },
  { id: 'limited', label: 'Limited', icon: 'eye', text: 'Anyone on the site can view and comment on work items. Only people you add can create and edit.' },
  { id: 'private', label: 'Private', icon: 'lock', text: 'Only people you add and site administrators can see this project.' },
]
const ROLE_HELP = { admin: 'Manage settings, people and permissions', member: 'Create, edit and move work items', viewer: 'View and comment only' }

function ReadOnlyNote({ children }) {
  return <div className="notice-inline"><Icon name="lock" size={14} />{children || 'You need the Administrator role in this project to change these settings.'}</div>
}

// ---------------------------------------------------------------- details
function DetailsSection() {
  const { meta, activeUsers, userById, refreshMeta, toast, isAdmin, bump, navigate, projects, can } = useApp()
  const p = meta.project
  const [f, setF] = useState({ name: p.name, description: p.description || '', leadId: p.leadId, color: p.color || '#FFAB00', category: p.category || '' })
  const [deleting, setDeleting] = useState(null)
  const [err, setErr] = useState(null)
  const canEdit = can('ADMINISTER_PROJECT')
  const save = async (e) => {
    e.preventDefault(); setErr(null)
    try { await api.updateProject(f); await refreshMeta(); toast('Project details saved') } catch (e2) { setErr(e2.message) }
  }
  return (
    <form onSubmit={save} className="settings-form">
      <h1>Details</h1>
      {!canEdit && <ReadOnlyNote />}
      <div className="profile-head"><ProjectAvatar size={56} color={f.color} /><div><b>{f.name}</b><div className="muted">Key: {p.key} · Team-managed {p.type === 'software' ? 'software' : 'business'}</div></div></div>
      <fieldset disabled={!canEdit} className="plain-fieldset">
        <div className="field"><label className="field-title">Icon colour</label>
          <div className="color-row">{PROJECT_COLORS.map((c) => <button type="button" key={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={`Colour ${c}`} />)}</div></div>
        <div className="field"><label className="field-title" htmlFor="ps-name">Name <span className="req">*</span></label><input id="ps-name" className="text-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label className="field-title">Key</label><input className="text-input narrow" value={p.key} disabled /></div>
        <div className="field"><label className="field-title" htmlFor="ps-cat">Category</label><input id="ps-cat" className="text-input narrow" maxLength={60} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="e.g. Engineering" /></div>
        <div className="field"><label className="field-title" htmlFor="ps-desc">Description</label><textarea id="ps-desc" className="text-input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="field"><label className="field-title">Project lead</label>
          <UserPicker users={activeUsers} value={f.leadId} allowUnassigned={false} onChange={(leadId) => setF({ ...f, leadId })} trigger={({ ref, toggle }) => (
            <button type="button" ref={ref} className="fake-select" onClick={toggle} disabled={!canEdit}><Avatar user={userById[f.leadId]} size={22} />{userById[f.leadId]?.name || 'Select lead'}<Icon name="chevronDown" size={16} className="chev" /></button>
          )} />
          <div className="muted small">The project lead is always an administrator of the project.</div>
        </div>
      </fieldset>
      <div className="field"><label className="field-title">Workflow</label>
        <div className="workflow">{meta.statuses.map((s, i) => <React.Fragment key={s}>{i > 0 && <Icon name="chevronRight" size={14} />}<span className={`lozenge ${s === 'Done' ? 'done' : s === 'To Do' ? 'todo' : 'inprogress'}`}>{s}</span></React.Fragment>)}</div>
      </div>
      <div className="field"><label className="field-title">Work types</label><div className="muted">{meta.types.join(' · ')}</div></div>
      {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
      {canEdit && <div className="settings-actions"><button className="btn primary">Save details</button></div>}
      {isAdmin && (
        <div className="danger-zone">
          <div><b>Reset demo data</b><div className="muted small">Restores the sample projects and removes all changes. Site admins only.</div></div>
          <button type="button" className="btn danger" onClick={async () => { if (!window.confirm('Reset all data to the demo state?')) return; await api.reset(); await refreshMeta(); bump(); toast('Demo data has been reset') }}>Reset</button>
        </div>
      )}
      {isAdmin && projects.length > 1 && (
        <div className="danger-zone">
          <div><b>Delete this project</b><div className="muted small">Removes {p.key} with all of its work items, sprints and releases.</div></div>
          <button type="button" className="btn danger" onClick={async () => setDeleting(await api.project(p.key))}>Delete project</button>
        </div>
      )}
      {deleting && <DeleteProjectModal project={deleting} onClose={() => setDeleting(null)} onDeleted={() => { toast(`${deleting.name} deleted`); setDeleting(null); navigate({ page: 'projects', project: projects.find((x) => x.key !== deleting.key)?.key }) }} />}
    </form>
  )
}

// ---------------------------------------------------------------- access: level + people & roles
function RoleSelect({ value, onChange, disabled, roles, label }) {
  return (
    <select className="text-input auto role-select" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
    </select>
  )
}

function AddPeopleModal({ data, onClose, onAdded }) {
  const { activeUsers, toast } = useApp()
  const taken = new Set((data?.people || []).filter((p) => p.explicit || p.source !== 'access-level').map((p) => p.user.id))
  const candidates = (activeUsers || []).filter((u) => !taken.has(u.id))
  const [userId, setUserId] = useState(candidates[0]?.id || '')
  const [role, setRole] = useState('member')
  const [err, setErr] = useState(null)
  const submit = async (e) => {
    e.preventDefault(); setErr(null)
    try { const d = await api.addMember(userId, role, data.project.key); toast('Person added to the project'); onAdded(d) } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={480}>
      <form onSubmit={submit} className="create-form">
        <div className="modal-header"><h2>Add people to {data.project.name}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          {candidates.length === 0 ? <p className="muted">Everyone on the site already has a role in this project.</p> : (
            <>
              <div className="field"><label className="field-title" htmlFor="ap-user">Name or email</label>
                <select id="ap-user" className="text-input" value={userId} onChange={(e) => setUserId(e.target.value)}>
                  {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
                </select></div>
              <div className="field"><label className="field-title" htmlFor="ap-role">Role</label>
                <select id="ap-role" className="text-input" value={role} onChange={(e) => setRole(e.target.value)}>
                  {data.roles.map((r) => <option key={r.id} value={r.id}>{r.label} — {ROLE_HELP[r.id]}</option>)}
                </select></div>
            </>
          )}
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!userId}>Add</button></div>
      </form>
    </Modal>
  )
}

function AccessSection() {
  const { meta, toast, refreshMeta, currentUser } = useApp()
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const load = useCallback(() => api.members(meta.project.key).then(setData).catch((e) => setErr(e.message)), [meta.project.key])
  useEffect(() => { load() }, [load])
  if (err) return <div className="field-error"><Icon name="warning" size={14} />{err}</div>
  if (!data) return <div className="spinner" />
  const can = data.canManage
  const act = async (fn, msg) => { try { setData(await fn()); if (msg) toast(msg); refreshMeta() } catch (e) { toast(e.message, { error: true }) } }
  const setAccess = async (access) => {
    if (access === data.project.access) return
    try { await api.updateProject({ access }, data.project.key); toast(`Access changed to ${ACCESS_LEVELS.find((a) => a.id === access).label}`); await refreshMeta(); load() } catch (e) { toast(e.message, { error: true }) }
  }
  const people = data.people.filter((p) => !q || `${p.user.name} ${p.user.email}`.toLowerCase().includes(q.toLowerCase()))
  const SOURCE = { 'site-admin': 'Site administrator', lead: 'Project lead', member: null }
  return (
    <div>
      <h1>Access</h1>
      <PlanLock feature="permissions" />
      {!can && <ReadOnlyNote />}
      <h3 className="settings-sub">Project access</h3>
      <div className="access-levels" role="radiogroup" aria-label="Project access">
        {ACCESS_LEVELS.map((a) => (
          <label key={a.id} className={`access-card ${data.project.access === a.id ? 'on' : ''} ${can ? '' : 'disabled'}`}>
            <input type="radio" name="access" value={a.id} checked={data.project.access === a.id} disabled={!can} onChange={() => setAccess(a.id)} />
            <Icon name={a.icon} size={20} /><span><b>{a.label}</b><span className="muted small">{a.text}</span></span>
          </label>
        ))}
      </div>
      <div className="settings-sub-row">
        <h3 className="settings-sub">People and roles</h3>
        <div className="inline-flex">
          <label className="list-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" /></label>
          {can && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add people</button>}
        </div>
      </div>
      <table className="data-table members-table">
        <thead><tr><th>Name</th><th style={{ width: 260 }}>Email</th><th style={{ width: 200 }}>Role</th><th style={{ width: 60 }} /></tr></thead>
        <tbody>
          {people.map((m) => {
            const locked = !can || m.source === 'site-admin' || m.source === 'lead'
            return (
              <tr key={m.user.id} data-user={m.user.id}>
                <td><span className="inline-flex"><Avatar user={m.user} size={28} /><span><b>{m.user.name}</b>{m.user.id === currentUser.id && <span className="muted small"> (you)</span>}{SOURCE[m.source] && <div className="muted small">{SOURCE[m.source]}</div>}</span></span></td>
                <td className="muted">{m.user.email}</td>
                <td>{locked ? <span className={`role-badge ${m.effectiveRole}`}>{data.roles.find((r) => r.id === m.effectiveRole)?.label}</span>
                  : <RoleSelect label={`Role for ${m.user.name}`} value={m.role} roles={data.roles} onChange={(role) => act(() => api.setMemberRole(m.user.id, role, data.project.key), `${m.user.name} is now ${data.roles.find((r) => r.id === role).label}`)} />}</td>
                <td>{can && m.explicit && m.source === 'member' && m.user.id !== currentUser.id && (
                  <button className="icon-btn" title={`Remove ${m.user.name}`} aria-label={`Remove ${m.user.name}`} onClick={() => act(() => api.removeMember(m.user.id, data.project.key), `${m.user.name} removed from the project`)}><Icon name="close" size={16} /></button>
                )}</td>
              </tr>
            )
          })}
          <tr className="everyone-row">
            <td colSpan={2}><span className="inline-flex"><span className="everyone-icon"><Icon name="people" size={16} /></span><span><b>Everyone else on the site</b><div className="muted small">Set by the project access level</div></span></span></td>
            <td>{data.everyoneElse ? <span className={`role-badge ${data.everyoneElse}`}>{data.roles.find((r) => r.id === data.everyoneElse)?.label}</span> : <span className="muted">No access</span>}</td><td />
          </tr>
        </tbody>
      </table>
      <div className="role-legend">{data.roles.map((r) => <span key={r.id}><span className={`role-badge ${r.id}`}>{r.label}</span> {ROLE_HELP[r.id]}</span>)}</div>
      {adding && <AddPeopleModal data={data} onClose={() => setAdding(false)} onAdded={(d) => { setData(d); setAdding(false); refreshMeta() }} />}
    </div>
  )
}

// ---------------------------------------------------------------- permission scheme
function PermissionsSection() {
  const { meta, toast, refreshMeta } = useApp()
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState(null)
  const load = useCallback(() => api.permissionScheme(meta.project.key).then((d) => { setData(d); setDraft(d.scheme) }).catch((e) => setErr(e.message)), [meta.project.key])
  useEffect(() => { load() }, [load])
  if (err) return <div className="field-error"><Icon name="warning" size={14} />{err}</div>
  if (!data) return <div className="spinner" />
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.scheme)
  const toggle = (k, role) => setDraft((d) => ({ ...d, [k]: d[k].includes(role) ? d[k].filter((r) => r !== role) : [...d[k], role] }))
  const groups = [...new Set(data.permissions.map((p) => p.group))]
  const save = async () => { try { const d = await api.savePermissionScheme(draft, meta.project.key); setData(d); setDraft(d.scheme); toast('Permissions saved'); refreshMeta() } catch (e) { toast(e.message, { error: true }) } }
  const reset = async () => { if (!window.confirm('Reset all permissions to the defaults?')) return; const d = await api.resetPermissionScheme(meta.project.key); setData(d); setDraft(d.scheme); toast('Permissions reset to defaults'); refreshMeta() }
  return (
    <div>
      <div className="settings-sub-row">
        <div><h1>Permissions</h1><p className="muted">Choose what each project role can do. {data.isDefault ? <span className="lozenge todo">Default scheme</span> : <span className="lozenge inprogress">Customised</span>}</p></div>
        {data.canManage && <div className="inline-flex"><button className="btn subtle" onClick={reset} disabled={data.isDefault}>Reset to defaults</button><button className="btn primary" onClick={save} disabled={!dirty}>Save changes</button></div>}
      </div>
      <PlanLock feature="permissions" />
      {!data.canManage && <ReadOnlyNote />}
      <div className="my-role-banner"><Icon name="user" size={16} />Your role in this project: <b>{data.mine.roleLabel || 'None'}</b> · you have {data.mine.permissions.length} of {data.permissions.length} permissions.</div>
      <table className="data-table perm-table">
        <thead><tr><th>Permission</th>{data.roles.map((r) => <th key={r.id} className="center" style={{ width: 120 }}>{r.label}</th>)}</tr></thead>
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={g}>
              <tr className="perm-group"><td colSpan={data.roles.length + 1}>{g}</td></tr>
              {data.permissions.filter((p) => p.group === g).map((p) => (
                <tr key={p.key} data-perm={p.key}>
                  <td><b>{p.name}</b><div className="muted small">{p.description}</div></td>
                  {data.roles.map((r) => {
                    const locked = (data.locked[p.key] || []).includes(r.id)
                    return (
                      <td key={r.id} className="center">
                        <input type="checkbox" aria-label={`${p.name} – ${r.label}`} checked={draft[p.key].includes(r.id)} disabled={!data.canManage || locked} title={locked ? 'Always granted to administrators' : ''} onChange={() => toggle(p.key, r.id)} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <p className="muted small">Site administrators always have every permission. Greyed-out boxes can’t be changed so a project can never lock out its administrators.</p>
    </div>
  )
}

// ---------------------------------------------------------------- components
const DEFAULT_ASSIGNEE = { unassigned: 'Unassigned', component_lead: 'Component lead', project_lead: 'Project lead' }
function ComponentModal({ component, onClose, onSaved }) {
  const { activeUsers, userById } = useApp()
  const [f, setF] = useState({ name: component?.name || '', description: component?.description || '', leadId: component?.leadId || null, defaultAssignee: component?.defaultAssignee || 'unassigned' })
  const [err, setErr] = useState(null)
  const submit = async (e) => {
    e.preventDefault(); setErr(null)
    try { onSaved(component?.id ? await api.updateComponent(component.id, f) : await api.createComponent(f)) } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={520}>
      <form onSubmit={submit} className="create-form">
        <div className="modal-header"><h2>{component?.id ? 'Edit component' : 'Create component'}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          <div className="field"><label className="field-title" htmlFor="cm-name">Name <span className="req">*</span></label><input id="cm-name" className="text-input" autoFocus maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label className="field-title" htmlFor="cm-desc">Description</label><textarea id="cm-desc" className="text-input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="field"><label className="field-title">Component lead</label>
            <UserPicker users={activeUsers} value={f.leadId} onChange={(leadId) => setF({ ...f, leadId })} trigger={({ ref, toggle }) => (
              <button type="button" ref={ref} className="fake-select" onClick={toggle}><Avatar user={userById[f.leadId]} size={22} />{userById[f.leadId]?.name || 'No lead'}<Icon name="chevronDown" size={16} className="chev" /></button>
            )} /></div>
          <div className="field"><label className="field-title" htmlFor="cm-def">Default assignee</label>
            <select id="cm-def" className="text-input" value={f.defaultAssignee} onChange={(e) => setF({ ...f, defaultAssignee: e.target.value })}>
              {Object.entries(DEFAULT_ASSIGNEE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="muted small">New work items with this component and no assignee are assigned automatically.</div></div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!f.name.trim()}>{component?.id ? 'Save' : 'Create'}</button></div>
      </form>
    </Modal>
  )
}
function ComponentsSection() {
  const { meta, userById, toast, refreshMeta, openList, can } = useApp()
  const [items, setItems] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [moveTo, setMoveTo] = useState('')
  const canEdit = can('ADMINISTER_PROJECT')
  const load = useCallback(() => api.components(meta.project.key).then(setItems).catch(() => setItems([])), [meta.project.key])
  useEffect(() => { load() }, [load])
  if (!items) return <div className="spinner" />
  return (
    <div>
      <div className="settings-sub-row">
        <div><h1>Components</h1><p className="muted">Group work items into parts of the product and route new work to the right person.</p></div>
        {canEdit && <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" size={16} />Create component</button>}
      </div>
      {!canEdit && <ReadOnlyNote />}
      {items.length === 0 ? <div className="empty-state"><Icon name="puzzle" size={32} /><p>No components yet.</p></div> : (
        <table className="data-table components-table">
          <thead><tr><th>Component</th><th style={{ width: 180 }}>Lead</th><th style={{ width: 160 }}>Default assignee</th><th style={{ width: 120 }}>Work items</th>{canEdit && <th style={{ width: 90 }} />}</tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} data-component={c.name}>
                <td><b>{c.name}</b><div className="muted small">{c.description || '—'}</div></td>
                <td>{c.leadId ? <span className="inline-flex"><Avatar user={userById[c.leadId]} size={22} />{userById[c.leadId]?.name}</span> : <span className="muted">None</span>}</td>
                <td>{DEFAULT_ASSIGNEE[c.defaultAssignee]}</td>
                <td><button className="link" onClick={() => openList(`project = ${meta.project.key} AND component = "${c.name}" ORDER BY cf[10019] ASC`)}>{c.issueCount} ({c.openCount} open)</button></td>
                {canEdit && <td className="nowrap"><button className="icon-btn" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Icon name="edit" size={16} /></button><button className="icon-btn" aria-label={`Delete ${c.name}`} onClick={() => { setMoveTo(''); setDeleting(c) }}><Icon name="trash" size={16} /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && <ComponentModal component={editing} onClose={() => setEditing(null)} onSaved={(c) => { toast(editing.id ? 'Component updated' : `Component ${c.name} created`); setEditing(null); load(); refreshMeta() }} />}
      {deleting && (
        <Modal onClose={() => setDeleting(null)} width={460}>
          <div className="modal-header"><h2>Delete {deleting.name}?</h2></div>
          <div className="modal-body">
            <p>{deleting.issueCount ? `${deleting.issueCount} work items use this component.` : 'No work items use this component.'}</p>
            {deleting.issueCount > 0 && (
              <div className="field"><label className="field-title" htmlFor="cm-move">Move them to</label>
                <select id="cm-move" className="text-input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                  <option value="">Remove the component from them</option>
                  {items.filter((x) => x.id !== deleting.id).map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}
                </select></div>
            )}
          </div>
          <div className="modal-footer"><button className="btn subtle" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn danger" onClick={async () => { await api.deleteComponent(deleting.id, moveTo || null); toast(`Component ${deleting.name} deleted`); setDeleting(null); load(); refreshMeta() }}>Delete</button></div>
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- workflows
function WorkflowsSection() {
  const { meta, can } = useApp()
  const canEdit = can('ADMINISTER_PROJECT')
  const statuses = meta.statuses || ['To Do', 'In Progress', 'In Review', 'Done']

  return (
    <div className="workflows-section">
      <div className="settings-sub-row">
        <div>
          <h1>Workflows</h1>
          <p className="muted">Manage lifecycle stages, transitions, and rules for work items in this project.</p>
        </div>
      </div>
      {!canEdit && <ReadOnlyNote />}

      <div className="profile-head" style={{ marginBottom: 20 }}>
        <div>
          <h3>Current Project Workflow</h3>
          <p className="muted small">Visual flow diagram of valid status transitions from creation to completion.</p>
        </div>
      </div>

      <div className="workflow-stepper" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '18px 20px', background: 'var(--surface-sunken, #F7F8F9)', borderRadius: 8, border: '1px solid var(--border, #DFE1E6)' }}>
        {statuses.map((s, idx) => {
          const category = s === 'Done' ? 'done' : s === 'To Do' ? 'todo' : 'inprogress'
          return (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 16px', background: '#fff', border: '1px solid var(--border, #DFE1E6)', borderRadius: 6, minWidth: 140, boxShadow: '0 1px 2px rgba(9,30,66,0.06)' }}>
                <span className={`lozenge ${category}`} style={{ alignSelf: 'flex-start' }}>{s}</span>
                <span className="muted small" style={{ fontSize: 11 }}>{category === 'done' ? 'Resolution stage' : category === 'todo' ? 'Initial stage' : 'Active work stage'}</span>
                <span className="muted small" style={{ fontSize: 11 }}>Transitions: Any → {s}</span>
              </div>
              {idx < statuses.length - 1 && (
                <div style={{ color: 'var(--text-subtle, #626F86)', display: 'flex', alignItems: 'center' }}>
                  <Icon name="chevronRight" size={20} />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      <h3 className="settings-sub" style={{ marginTop: 28 }}>Statuses and Transitions Table</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Status Name</th>
            <th style={{ width: 140 }}>Category</th>
            <th>Allowed Transitions</th>
            <th style={{ width: 220 }}>Status Action</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((s) => (
            <tr key={s}>
              <td>
                <span className={`lozenge ${s === 'Done' ? 'done' : s === 'To Do' ? 'todo' : 'inprogress'}`}>{s}</span>
              </td>
              <td className="muted">{s === 'Done' ? 'Done' : s === 'To Do' ? 'To Do' : 'In Progress'}</td>
              <td>All statuses can freely transition to <b>{s}</b></td>
              <td>{s === 'Done' ? <span className="lozenge done">Sets Resolution to Done</span> : <span className="muted">Clears Resolution</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------- custom fields
function CustomFieldsSection() {
  const { meta, can, toast } = useApp()
  const canEdit = can('ADMINISTER_PROJECT')
  const [fields, setFields] = useState([
    { id: 'summary', name: 'Summary', type: 'Short Text', required: true, system: true },
    { id: 'description', name: 'Description', type: 'Rich Text', required: false, system: true },
    { id: 'assignee', name: 'Assignee', type: 'User Picker', required: false, system: true },
    { id: 'reporter', name: 'Reporter', type: 'User Picker', required: true, system: true },
    { id: 'priority', name: 'Priority', type: 'Dropdown', required: true, system: true },
    { id: 'storyPoints', name: 'Story Points', type: 'Number', required: false, system: true },
    { id: 'dueDate', name: 'Due Date', type: 'Date', required: false, system: true },
    { id: 'labels', name: 'Labels', type: 'Labels', required: false, system: true },
    { id: 'cf_impact', name: 'Customer Impact', type: 'Dropdown', required: false, system: false, options: ['Critical', 'High', 'Moderate', 'Low'] },
    { id: 'cf_env', name: 'Environment', type: 'Dropdown', required: false, system: false, options: ['Production', 'Staging', 'Development'] },
    { id: 'cf_build', name: 'Build Number', type: 'Short Text', required: false, system: false },
    { id: 'cf_ref', name: 'External Reference', type: 'URL', required: false, system: false },
  ])
  const [modal, setModal] = useState(false)
  const [newField, setNewField] = useState({ name: '', type: 'Short Text', required: false })

  const addField = (e) => {
    e.preventDefault()
    if (!newField.name.trim()) return
    setFields((f) => [...f, { id: `cf_${Date.now()}`, name: newField.name.trim(), type: newField.type, required: newField.required, system: false }])
    toast(`Custom field "${newField.name}" added to project`)
    setModal(false)
    setNewField({ name: '', type: 'Short Text', required: false })
  }

  const removeField = (id) => {
    setFields((f) => f.filter((x) => x.id !== id))
    toast('Custom field removed from project')
  }

  return (
    <div className="fields-section">
      <div className="settings-sub-row">
        <div>
          <h1>Custom Fields & Screens</h1>
          <p className="muted">Configure fields and layout available for work items in this project.</p>
        </div>
        {canEdit && (
          <button className="btn primary" onClick={() => setModal(true)}>
            <Icon name="plus" size={16} />Add custom field
          </button>
        )}
      </div>
      {!canEdit && <ReadOnlyNote />}

      <table className="data-table">
        <thead>
          <tr>
            <th>Field Name</th>
            <th style={{ width: 180 }}>Type</th>
            <th style={{ width: 130 }}>Required</th>
            <th style={{ width: 150 }}>Field Scope</th>
            {canEdit && <th style={{ width: 60 }} />}
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.id}>
              <td>
                <b>{f.name}</b>
                {f.options && <div className="muted small">Options: {f.options.join(', ')}</div>}
              </td>
              <td><span className="role-badge member">{f.type}</span></td>
              <td>{f.required ? <span className="lozenge removed">Required</span> : <span className="muted">Optional</span>}</td>
              <td>{f.system ? <span className="lozenge todo">System standard</span> : <span className="lozenge inprogress">Project custom</span>}</td>
              {canEdit && (
                <td>
                  {!f.system && (
                    <button className="icon-btn" title="Remove field" onClick={() => removeField(f.id)}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal onClose={() => setModal(false)} width={480}>
          <form onSubmit={addField} className="create-form">
            <div className="modal-header">
              <h2>Add Custom Field</h2>
              <button type="button" className="icon-btn" onClick={() => setModal(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-title" htmlFor="cf-name">Field Name <span className="req">*</span></label>
                <input id="cf-name" className="text-input" autoFocus value={newField.name} onChange={(e) => setNewField({ ...newField, name: e.target.value })} placeholder="e.g. Acceptance Criteria" required />
              </div>
              <div className="field">
                <label className="field-title" htmlFor="cf-type">Field Type</label>
                <select id="cf-type" className="text-input" value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value })}>
                  <option value="Short Text">Short Text</option>
                  <option value="Rich Text">Paragraph / Rich Text</option>
                  <option value="Number">Number</option>
                  <option value="Date">Date Picker</option>
                  <option value="Dropdown">Dropdown (Single Select)</option>
                  <option value="Checkbox">Checkbox (Boolean)</option>
                  <option value="User Picker">User Picker</option>
                  <option value="URL">URL / Web Link</option>
                </select>
              </div>
              <label className="check-label" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={newField.required} onChange={(e) => setNewField({ ...newField, required: e.target.checked })} />
                Required field on create/edit
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn subtle" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn primary" disabled={!newField.name.trim()}>Add Field</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- versions & releases
function VersionsSection() {
  return (
    <div className="settings-versions-wrap">
      <ReleasesView />
    </div>
  )
}

// ---------------------------------------------------------------- teams
function TeamsSection() {
  return (
    <div className="settings-teams-wrap">
      <TeamsPage />
    </div>
  )
}

// ---------------------------------------------------------------- board
function BoardSection() {
  const { meta, toast, refreshMeta, can } = useApp()
  const board = meta.project.board || { wip: {}, swimlanes: 'none' }
  const [wip, setWip] = useState(() => Object.fromEntries(meta.statuses.map((s) => [s, board.wip?.[s] ?? ''])))
  const [swimlanes, setSwimlanes] = useState(board.swimlanes || 'none')
  const canEdit = can('ADMINISTER_PROJECT')
  const save = async (e) => {
    e.preventDefault()
    const clean = Object.fromEntries(Object.entries(wip).filter(([, v]) => v !== '' && Number(v) > 0).map(([k, v]) => [k, Number(v)]))
    try { await api.updateBoard({ wip: clean, swimlanes }, meta.project.key); await refreshMeta(); toast('Board settings saved') } catch (e2) { toast(e2.message, { error: true }) }
  }
  return (
    <form onSubmit={save}>
      <h1>Board</h1>
      {!canEdit && <ReadOnlyNote />}
      <fieldset disabled={!canEdit} className="plain-fieldset">
        <h3 className="settings-sub">Column limits (WIP)</h3>
        <p className="muted small">The column header turns red when it has more work items than its limit. Leave empty for no limit.</p>
        <div className="wip-grid">
          {meta.statuses.map((s) => (
            <label key={s} className="wip-cell"><span className={`lozenge ${s === 'Done' ? 'done' : s === 'To Do' ? 'todo' : 'inprogress'}`}>{s}</span>
              <input type="number" min="0" max="999" className="text-input" aria-label={`WIP limit for ${s}`} placeholder="No limit" value={wip[s]} onChange={(e) => setWip({ ...wip, [s]: e.target.value })} /></label>
          ))}
        </div>
        <h3 className="settings-sub">Swimlanes</h3>
        <select className="text-input auto" aria-label="Swimlanes" value={swimlanes} onChange={(e) => setSwimlanes(e.target.value)}>
          <option value="none">No swimlanes</option><option value="assignee">Group by assignee</option><option value="epic">Group by epic</option><option value="priority">Group by priority</option><option value="type">Group by work type</option>
        </select>
      </fieldset>
      {canEdit && <div className="settings-actions"><button className="btn primary">Save board settings</button></div>}
    </form>
  )
}

// ---------------------------------------------------------------- recycle bin
function TrashSection() {
  const { meta, userById, toast, bump, can, openIssue } = useApp()
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [purging, setPurging] = useState(null)
  const load = useCallback(() => api.trash(meta.project.key).then(setData).catch((e) => setErr(e.message)), [meta.project.key])
  useEffect(() => { load() }, [load])
  if (!can('DELETE_ISSUES')) return <div><h1>Recycle bin</h1><ReadOnlyNote>You need the “Delete work items” permission to see the recycle bin.</ReadOnlyNote></div>
  if (err) return <div className="field-error"><Icon name="warning" size={14} />{err}</div>
  if (!data) return <div className="spinner" />
  const restore = async (e) => { try { const r = await api.restoreTrash(e.id); toast(`${r.key} restored`); bump(); load(); openIssue(r.key) } catch (e2) { toast(e2.message, { error: true }) } }
  return (
    <div>
      <h1>Recycle bin</h1>
      <p className="muted">Deleted work items stay here for {data.retentionDays} days, with their comments, attachments, links and history. After that they’re permanently deleted.</p>
      {data.items.length === 0 ? <div className="empty-state"><Icon name="trash" size={32} /><p>The recycle bin is empty.</p></div> : (
        <table className="data-table trash-table">
          <thead><tr><th>Work item</th><th style={{ width: 180 }}>Deleted by</th><th style={{ width: 140 }}>Deleted</th><th style={{ width: 140 }}>Permanently deleted</th><th style={{ width: 210 }} /></tr></thead>
          <tbody>
            {data.items.map((e) => (
              <tr key={e.id} data-key={e.key}>
                <td><span className="inline-flex"><TypeIcon type={e.type} /><span className="muted">{e.key}</span><b>{e.summary}</b></span>{(e.subtasks > 0 || e.comments > 0 || e.attachments > 0) && <div className="muted small">{[e.subtasks && `${e.subtasks} sub-task${e.subtasks > 1 ? 's' : ''}`, e.comments && `${e.comments} comment${e.comments > 1 ? 's' : ''}`, e.attachments && `${e.attachments} attachment${e.attachments > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</div>}</td>
                <td><span className="inline-flex"><Avatar user={userById[e.deletedBy]} size={22} />{userById[e.deletedBy]?.name || 'Unknown'}</span></td>
                <td title={fmtDateTime(e.deleted)}>{timeAgo(e.deleted)}</td>
                <td>{fmtDate(e.purgeOn)}</td>
                <td className="nowrap right"><button className="btn small" onClick={() => restore(e)}><Icon name="refresh" size={14} />Restore</button>{data.canPurge && <button className="btn subtle small danger-text" onClick={() => setPurging(e)}>Delete permanently</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {purging && <Confirm title={`Permanently delete ${purging.key}?`} body="This can’t be undone. The work item, its comments, attachments and history are removed for good." confirmLabel="Delete permanently"
        onClose={() => setPurging(null)} onConfirm={async () => { await api.purgeTrash(purging.id); toast(`${purging.key} permanently deleted`); setPurging(null); load() }} />}
    </div>
  )
}

// ---------------------------------------------------------------- audit log
export const ACTION_LABEL = {
  'project.created': 'Created the project', 'project.updated': 'Updated project details', 'project.access_changed': 'Changed project access', 'project.deleted': 'Deleted a project',
  'member.added': 'Added a person', 'member.role_changed': 'Changed a role', 'member.removed': 'Removed a person',
  'permissions.changed': 'Changed permissions', 'permissions.reset': 'Reset permissions', 'global_permissions.changed': 'Changed global permissions',
  'board.updated': 'Changed board settings', 'component.created': 'Created a component', 'component.updated': 'Updated a component', 'component.deleted': 'Deleted a component',
  'issue.deleted': 'Deleted a work item', 'issue.restored': 'Restored a work item', 'issue.purged': 'Permanently deleted a work item',
  'user.invited': 'Invited a user', 'user.role_changed': 'Changed a site role', 'user.deactivated': 'Deactivated a user', 'user.reactivated': 'Reactivated a user', 'user.password_reset_by_admin': 'Reset a password',
  'team.created': 'Created a team', 'team.updated': 'Updated a team', 'team.deleted': 'Deleted a team',
  'automation.rule_created': 'Created an automation rule', 'automation.rule_updated': 'Updated an automation rule', 'automation.rule_enabled': 'Enabled an automation rule',
  'automation.rule_disabled': 'Disabled an automation rule', 'automation.rule_deleted': 'Deleted an automation rule', 'issues.imported': 'Imported work items',
  'webhook.created': 'Created a webhook', 'webhook.updated': 'Updated a webhook', 'webhook.deleted': 'Deleted a webhook',
}
function detailText(a) {
  const d = a.details || {}
  if (d.changes && Array.isArray(d.changes)) return d.changes.map((c) => `${c.permission}: ${(c.from || []).join('/') || '—'} → ${(c.to || []).join('/') || '—'}`).join('; ')
  if (d.from !== undefined || d.to !== undefined) return `${d.from ?? '—'} → ${d.to ?? '—'}`
  const parts = Object.entries(d).filter(([k]) => !['userId', 'trashId'].includes(k)).map(([k, v]) => (v && typeof v === 'object' && 'from' in v ? `${k}: ${v.from ?? '—'} → ${v.to ?? '—'}` : `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`))
  return parts.join(' · ')
}
export function AuditTable({ project }) {
  const { userById } = useApp()
  const [rows, setRows] = useState(null)
  const [action, setAction] = useState('')
  const [err, setErr] = useState(null)
  useEffect(() => { setRows(null); api.audit({ project, action, limit: 200 }).then(setRows).catch((e) => setErr(e.status === 402 ? 'plan' : e.message)) }, [project, action])
  const prefixes = useMemo(() => [...new Set(Object.keys(ACTION_LABEL).map((k) => k.split('.')[0]))], [])
  if (err === 'plan') return <PlanLock feature="audit_log" />
  if (err) return <ReadOnlyNote>{err}</ReadOnlyNote>
  return (
    <div>
      <div className="toolbar">
        <select className="text-input auto" aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All activity</option>{prefixes.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1).replace('_', ' ')}</option>)}
        </select>
      </div>
      {!rows ? <div className="spinner" /> : rows.length === 0 ? <div className="empty-state"><Icon name="history" size={32} /><p>No audit entries.</p></div> : (
        <table className="data-table audit-table">
          <thead><tr><th style={{ width: 150 }}>When</th><th style={{ width: 170 }}>Who</th><th style={{ width: 210 }}>What</th>{!project && <th style={{ width: 70 }}>Project</th>}<th>Target & details</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} data-action={a.action}>
                <td title={fmtDateTime(a.created)}>{fmtDateTime(a.created)}</td>
                <td>{a.actorId ? <span className="inline-flex"><Avatar user={userById[a.actorId]} size={20} />{userById[a.actorId]?.name || a.actorId}</span> : <span className="muted">System</span>}</td>
                <td>{ACTION_LABEL[a.action] || a.action}</td>
                {!project && <td>{a.project || '—'}</td>}
                <td><b>{a.target}</b> <span className="muted small">{detailText(a)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
function AuditSection() {
  const { meta, can } = useApp()
  return (
    <div>
      <h1>Audit log</h1>
      <p className="muted">A record of changes to this project’s settings, people, permissions and deleted work.</p>
      {can('ADMINISTER_PROJECT') ? <AuditTable project={meta.project.key} /> : <ReadOnlyNote>Only project administrators can see the audit log.</ReadOnlyNote>}
    </div>
  )
}

// ---------------------------------------------------------------- page
export default function ProjectSettingsPage({ section, onSection }) {
  const { meta, openProject, myRole } = useApp()
  const sections = SETTINGS_SECTIONS.filter((s) => !s.software || meta.project.type === 'software')
  const current = sections.some((s) => s.id === section) ? section : 'details'
  const Section = {
    details: DetailsSection,
    access: AccessSection,
    permissions: PermissionsSection,
    workflows: WorkflowsSection,
    fields: CustomFieldsSection,
    components: ComponentsSection,
    versions: VersionsSection,
    teams: TeamsSection,
    board: BoardSection,
    automation: AutomationSection,
    import: ImportSection,
    trash: TrashSection,
    audit: AuditSection,
  }[current] || DetailsSection
  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Project settings">
        <button className="link small back-link" onClick={() => openProject(meta.project.key, meta.project.type === 'software' ? 'board' : 'list')}><Icon name="chevronLeft" size={14} />Back to project</button>
        <div className="settings-nav-head"><ProjectAvatar size={24} project={meta.project} color={meta.project.color} /><div><b>{meta.project.name}</b><div className="muted small">Project settings</div></div></div>
        {sections.map((s) => (
          <button key={s.id} className={`side-item ${current === s.id ? 'active' : ''}`} onClick={() => onSection(s.id)} aria-current={current === s.id ? 'page' : undefined}>
            <Icon name={s.icon} size={16} /><span className="side-label">{s.label}</span>
          </button>
        ))}
        <div className="settings-role muted small">Your role: <span className={`role-badge ${myRole || 'none'}`}>{meta.myRoleLabel || 'None'}</span></div>
      </nav>
      <section className="settings-content" key={`${meta.project.key}-${current}`}>
        <div className="breadcrumbs muted small">Projects / {meta.project.name} / Project settings</div>
        <h1 className="sr-only">{meta.project.name} – {sections.find((s) => s.id === current)?.label || 'Project settings'}</h1>
        <Section />
      </section>
    </div>
  )
}
