import React, { useEffect, useState } from 'react'
import { api, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon, PriorityIcon, ProjectAvatar } from '../icons.jsx'
import { Avatar, Dropdown, LabelsEditor, Modal, PrioritySelect, TypeSelect, UserPicker, statusCategory } from './ui.jsx'

export default function CreateModal({ defaults, onClose }) {
  const { meta, activeUsers: users, userById, bump, toast, openIssue, refreshMeta, projects: allProjects } = useApp()
  // only offer projects where the current user is allowed to create work items
  const projects = allProjects.filter((p) => p.canCreate !== false)
  const startKey = projects.some((p) => p.key === (defaults.projectKey || meta.project.key)) ? (defaults.projectKey || meta.project.key) : projects[0]?.key
  const [f, setF] = useState({
    type: 'Task', status: 'To Do', summary: '', description: '', assigneeId: null, reporterId: meta.currentUserId,
    priority: 'Medium', labels: [], dueDate: '', parentKey: null, storyPoints: '', fixVersion: null, components: [], teamId: null, ...defaults, projectKey: startKey,
  })
  const [another, setAnother] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [epics, setEpics] = useState([])
  const sameProject = f.projectKey === meta.project.key
  useEffect(() => { api.search(`project = ${f.projectKey || getProject()} AND type = Epic ORDER BY cf[10019] ASC`).then((d) => setEpics(d.issues)).catch(() => {}) }, [f.projectKey])
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  const submit = async (e) => {
    e?.preventDefault()
    if (!f.summary.trim()) { setErr('Summary is required'); return }
    setBusy(true)
    try {
      const issue = await api.create({ ...f, ...(sameProject ? {} : { sprint: undefined, fixVersion: null, components: [] }), summary: f.summary.trim(), dueDate: f.dueDate || null, storyPoints: f.storyPoints === '' ? null : f.storyPoints, parentKey: f.type === 'Epic' ? null : f.parentKey })
      bump(); if (f.labels.length) refreshMeta()
      toast({ title: `${issue.key} has been created`, description: issue.summary, action: { label: 'View work item', onClick: () => openIssue(issue.key) } })
      if (another) setF((s) => ({ ...s, summary: '', description: '' }))
      else onClose()
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  return (
    <Modal onClose={onClose} width={680} className="create-modal" labelledBy="create-title">
      <form onSubmit={submit} className="create-form">
        <div className="modal-header">
          <h2 id="create-title">Create</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body scroll">
          <p className="muted small">Required fields are marked with an asterisk <span className="req">*</span></p>
          {!projects.length && <div className="notice-inline"><Icon name="lock" size={14} />You don’t have permission to create work items in any project. Ask a project administrator to give you the Member role.</div>}

          <Field label="Space" required>
            <div className="select-with-icon">
              <ProjectAvatar size={20} project={projects.find((p) => p.key === f.projectKey)} />
              <select className="text-input" aria-label="Space" value={f.projectKey} onChange={(e) => setF((s) => ({ ...s, projectKey: e.target.value, parentKey: null, fixVersion: null }))}>
                {projects.map((p) => <option key={p.key} value={p.key}>{p.name} ({p.key})</option>)}
              </select>
            </div>
          </Field>
          <Field label="Work type" required>
            <TypeSelect value={f.type} types={meta.types} onChange={set('type')} trigger={({ ref, toggle }) => (
              <button type="button" ref={ref} className="fake-select" onClick={toggle}><TypeIcon type={f.type} />{f.type}<Icon name="chevronDown" size={16} className="chev" /></button>
            )} />
          </Field>
          <hr />
          <Field label="Status" help="This is the initial status upon creation">
            <Dropdown minWidth={200} trigger={({ ref, toggle }) => (
              <button type="button" ref={ref} className="fake-select narrow" onClick={toggle}><span className={`lozenge ${statusCategory(f.status)}`}>{f.status}</span><Icon name="chevronDown" size={16} className="chev" /></button>
            )}>
              {(close) => <div className="menu">{meta.statuses.map((s) => <button type="button" key={s} className={`menu-item ${s === f.status ? 'selected' : ''}`} onClick={() => { set('status')(s); close() }}><span className={`lozenge ${statusCategory(s)}`}>{s}</span></button>)}</div>}
            </Dropdown>
          </Field>
          <Field label="Summary" required error={err}>
            <input className="text-input" autoFocus value={f.summary} maxLength={255} onChange={(e) => { set('summary')(e.target.value); setErr(null) }} />
          </Field>
          <Field label="Description">
            <textarea className="text-input" rows={5} value={f.description} onChange={(e) => set('description')(e.target.value)} placeholder="Describe the work item…" />
          </Field>
          <Field label="Assignee">
            <UserPicker users={users} value={f.assigneeId} currentUserId={meta.currentUserId} onChange={set('assigneeId')} trigger={({ ref, toggle }) => (
              <button type="button" ref={ref} className="fake-select" onClick={toggle}><Avatar user={userById[f.assigneeId]} size={22} />{userById[f.assigneeId]?.name || 'Unassigned'}<Icon name="chevronDown" size={16} className="chev" /></button>
            )} />
            {f.assigneeId !== meta.currentUserId && <button type="button" className="link small" onClick={() => set('assigneeId')(meta.currentUserId)}>Assign to me</button>}
          </Field>
          {f.type !== 'Epic' && (
            <Field label="Parent">
              <Dropdown minWidth={360} trigger={({ ref, toggle }) => (
                <button type="button" ref={ref} className="fake-select" onClick={toggle}>
                  {f.parentKey ? <><TypeIcon type="Epic" />{f.parentKey} {epics.find((e) => e.key === f.parentKey)?.summary}</> : <span className="muted">Select parent</span>}
                  <Icon name="chevronDown" size={16} className="chev" />
                </button>
              )}>
                {(close) => (
                  <div className="menu scroll">
                    <button type="button" className="menu-item" onClick={() => { set('parentKey')(null); close() }}><span className="menu-item-label muted">None</span></button>
                    {epics.map((e) => <button type="button" key={e.key} className={`menu-item ${f.parentKey === e.key ? 'selected' : ''}`} onClick={() => { set('parentKey')(e.key); close() }}><TypeIcon type={e.type} /><span className="menu-item-label"><span className="muted">{e.key}</span> {e.summary}</span></button>)}
                  </div>
                )}
              </Dropdown>
            </Field>
          )}
          <Field label="Priority">
            <PrioritySelect value={f.priority} priorities={meta.priorities} onChange={set('priority')} trigger={({ ref, toggle }) => (
              <button type="button" ref={ref} className="fake-select narrow" onClick={toggle}><PriorityIcon priority={f.priority} />{f.priority}<Icon name="chevronDown" size={16} className="chev" /></button>
            )} />
          </Field>
          <Field label="Labels">
            <Dropdown minWidth={300} trigger={({ ref, toggle }) => (
              <button type="button" ref={ref} className="fake-select" onClick={toggle}>
                {f.labels.length ? f.labels.map((l) => <span key={l} className="label-chip">{l}</span>) : <span className="muted">Select label</span>}
                <Icon name="chevronDown" size={16} className="chev" />
              </button>
            )}>
              {(close) => <LabelsEditor value={f.labels} allLabels={meta.labels} onChange={set('labels')} onDone={close} />}
            </Dropdown>
          </Field>
          <div className="field-row">
            <Field label="Due date">
              <input type="date" className="text-input narrow" value={f.dueDate || ''} onChange={(e) => set('dueDate')(e.target.value)} />
            </Field>
            <Field label="Story point estimate">
              <input type="number" min="0" step="0.5" className="text-input narrow" value={f.storyPoints ?? ''} onChange={(e) => set('storyPoints')(e.target.value)} />
            </Field>
          </div>
          {sameProject && (meta.components || []).length > 0 && (
            <Field label="Components">
              <div className="chip-picker" role="group" aria-label="Components">
                {meta.components.map((c) => (
                  <button type="button" key={c.id} className={`chip-toggle ${f.components.includes(c.name) ? 'on' : ''}`} aria-pressed={f.components.includes(c.name)}
                    onClick={() => set('components')(f.components.includes(c.name) ? f.components.filter((x) => x !== c.name) : [...f.components, c.name])}>{c.name}</button>
                ))}
              </div>
              {!f.assigneeId && f.components.length > 0 && <div className="muted small">The component’s default assignee will be used if you leave Assignee empty.</div>}
            </Field>
          )}
          {(meta.teams || []).length > 0 && (
            <Field label="Team">
              <select className="text-input narrow" aria-label="Team" value={f.teamId || ''} onChange={(e) => set('teamId')(e.target.value ? Number(e.target.value) : null)}>
                <option value="">None</option>
                {meta.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          )}
          {sameProject && (meta.versions || []).length > 0 && (
            <Field label="Fix versions">
              <select className="text-input narrow" aria-label="Fix versions" value={f.fixVersion || ''} onChange={(e) => set('fixVersion')(e.target.value || null)}>
                <option value="">None</option>
                {meta.versions.filter((v) => v.status === 'unreleased').map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Reporter" required>
            <UserPicker users={users} value={f.reporterId} allowUnassigned={false} onChange={set('reporterId')} trigger={({ ref, toggle }) => (
              <button type="button" ref={ref} className="fake-select" onClick={toggle}><Avatar user={userById[f.reporterId]} size={22} />{userById[f.reporterId]?.name}<Icon name="chevronDown" size={16} className="chev" /></button>
            )} />
          </Field>
        </div>
        <div className="modal-footer">
          <label className="check-label"><input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} />Create another</label>
          <span className="spacer" />
          <button type="button" className="btn subtle" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || !projects.length}>{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, required, help, error, children }) {
  return (
    <div className="field">
      <label className="field-title">{label}{required && <span className="req"> *</span>}</label>
      <div className="field-control">{children}</div>
      {help && <div className="field-help">{help}</div>}
      {error && <div className="field-error"><Icon name="warning" size={14} />{error}</div>}
    </div>
  )
}
