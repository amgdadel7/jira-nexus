import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon, PriorityIcon } from '../icons.jsx'
import { Avatar, Confirm, Dropdown, LabelsEditor, MenuItem, Modal, UserPicker, fmtDate } from '../components/ui.jsx'

const FIELD_DEFS = {
  summary: { label: 'Summary', required: true },
  description: { label: 'Description' },
  priority: { label: 'Priority' },
  dueDate: { label: 'Due date' },
  labels: { label: 'Labels' },
  storyPoints: { label: 'Story point estimate' },
}

export default function FormsView() {
  const { toast, refreshKey, userById, openIssue, bump } = useApp()
  const [forms, setForms] = useState(null)
  const [editing, setEditing] = useState(null) // form or {} for new
  const [filling, setFilling] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const load = useCallback(() => api.forms().then(setForms).catch((e) => toast({ title: 'Failed to load forms', description: e.message, error: true })), [toast])
  useEffect(() => { load() }, [load, refreshKey])

  if (!forms) return <div className="center-pad"><div className="spinner" /></div>
  return (
    <div className="page-pad">
      <div className="page-head">
        <div>
          <h2>Forms</h2>
          <p className="muted">Collect requests with forms. Each submission creates a work item in this project.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" size={16} />Create form</button>
      </div>
      {!forms.length && <div className="empty-state"><h3>No forms yet</h3><p>Create a form to start collecting requests.</p></div>}
      <div className="card-grid">
        {forms.map((f) => (
          <div key={f.id} className={`form-card ${f.active ? '' : 'inactive'}`}>
            <div className="form-card-top">
              <span className="form-icon"><Icon name="forms" size={20} /></span>
              <div className="form-card-title">
                <h3>{f.name}</h3>
                <span className="muted small">{f.active ? 'Accepting submissions' : 'Closed'} · {f.submissions} submission{f.submissions === 1 ? '' : 's'}</span>
              </div>
              <Dropdown align="end" trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn small" onClick={toggle}><Icon name="more" size={16} /></button>}>
                {(close) => (
                  <div className="menu">
                    <MenuItem onClick={() => { close(); setEditing(f) }}>Edit form</MenuItem>
                    <MenuItem onClick={async () => { close(); await api.updateForm(f.id, { active: !f.active }); load() }}>{f.active ? 'Close form' : 'Reopen form'}</MenuItem>
                    <MenuItem onClick={async () => { close(); await api.createForm({ name: `${f.name} (copy)`, description: f.description, issueType: f.issueType, fields: f.fields, defaultLabels: f.defaultLabels, defaultAssigneeId: f.defaultAssigneeId }); load() }}>Duplicate</MenuItem>
                    <div className="menu-sep" />
                    <MenuItem danger onClick={() => { close(); setConfirm(f) }}>Delete</MenuItem>
                  </div>
                )}
              </Dropdown>
            </div>
            <p className="form-desc">{f.description || <span className="muted">No description</span>}</p>
            <div className="form-meta">
              <span><TypeIcon type={f.issueType} size={14} /> Creates a {f.issueType}</span>
              <span>{f.fields.length} field{f.fields.length === 1 ? '' : 's'}</span>
              {f.defaultAssigneeId && <span className="inline-flex"><Avatar user={userById[f.defaultAssigneeId]} size={18} /> {userById[f.defaultAssigneeId]?.name.split(' ')[0]}</span>}
            </div>
            <div className="form-card-actions">
              <button className="btn" disabled={!f.active} onClick={() => setFilling(f)}>Open form</button>
              <button className="btn subtle" onClick={() => setEditing(f)}><Icon name="edit" size={14} />Edit</button>
              <span className="spacer" />
              <span className="muted small">Updated {fmtDate(f.updated)}</span>
            </div>
          </div>
        ))}
      </div>
      {editing && <FormEditor form={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {filling && <FormFill form={filling} onClose={() => setFilling(null)} onSubmitted={(issue) => { setFilling(null); load(); bump(); toast({ title: `Thanks! ${issue.key} was created`, action: { label: 'View work item', onClick: () => openIssue(issue.key) } }) }} />}
      {confirm && <Confirm title={`Delete “${confirm.name}”?`} body="The form will be removed. Work items already created from it are kept." onConfirm={async () => { await api.deleteForm(confirm.id); load() }} onClose={() => setConfirm(null)} />}
    </div>
  )
}

function FormEditor({ form, onClose, onSaved }) {
  const { meta, activeUsers, userById } = useApp()
  const isNew = !form.id
  const [f, setF] = useState({
    name: form.name || '', description: form.description || '', issueType: form.issueType || 'Task',
    fields: form.fields || ['summary', 'description'], defaultLabels: form.defaultLabels || ['form'],
    defaultAssigneeId: form.defaultAssigneeId || null, active: form.active ?? true,
  })
  const [err, setErr] = useState(null)
  const toggleField = (k) => setF((s) => ({ ...s, fields: s.fields.includes(k) ? s.fields.filter((x) => x !== k) : [...s.fields, k] }))
  const save = async (e) => {
    e.preventDefault()
    try { if (isNew) await api.createForm(f); else await api.updateForm(form.id, f); onSaved() } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={720}>
      <form onSubmit={save} className="create-form">
        <div className="modal-header"><h2>{isNew ? 'Create form' : 'Edit form'}</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body scroll form-editor">
          <div className="form-editor-cols">
            <div>
              <div className="field"><label className="field-title">Form name <span className="req">*</span></label><input className="text-input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
              <div className="field"><label className="field-title">Description</label><textarea className="text-input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
              <div className="field"><label className="field-title">Submissions create</label>
                <div className="type-choices">{meta.types.filter((t) => t !== 'Subtask').map((t) => (
                  <button type="button" key={t} className={`type-choice ${f.issueType === t ? 'on' : ''}`} onClick={() => setF({ ...f, issueType: t })}><TypeIcon type={t} />{t}</button>
                ))}</div>
              </div>
              <div className="field"><label className="field-title">Fields on the form</label>
                {Object.entries(FIELD_DEFS).map(([k, d]) => (
                  <label key={k} className={`menu-item check ${d.required ? 'disabled' : ''}`}><input type="checkbox" checked={f.fields.includes(k)} disabled={d.required} onChange={() => toggleField(k)} /><span className="menu-item-label">{d.label}{d.required && <span className="menu-sub inline"> (always required)</span>}</span></label>
                ))}
              </div>
              <div className="field"><label className="field-title">Automatically assign to</label>
                <UserPicker users={activeUsers} value={f.defaultAssigneeId} onChange={(id) => setF({ ...f, defaultAssigneeId: id })} trigger={({ ref, toggle }) => (
                  <button type="button" ref={ref} className="fake-select" onClick={toggle}><Avatar user={userById[f.defaultAssigneeId]} size={22} />{userById[f.defaultAssigneeId]?.name || 'Unassigned'}<Icon name="chevronDown" size={16} className="chev" /></button>
                )} />
              </div>
              <div className="field"><label className="field-title">Labels added to every submission</label>
                <Dropdown minWidth={300} trigger={({ ref, toggle }) => (
                  <button type="button" ref={ref} className="fake-select" onClick={toggle}>{f.defaultLabels.length ? f.defaultLabels.map((l) => <span key={l} className="label-chip">{l}</span>) : <span className="muted">None</span>}<Icon name="chevronDown" size={16} className="chev" /></button>
                )}>
                  {(close) => <LabelsEditor value={f.defaultLabels} allLabels={meta.labels} onChange={(defaultLabels) => setF((s) => ({ ...s, defaultLabels }))} onDone={close} />}
                </Dropdown>
              </div>
              <label className="check-label" style={{ marginTop: 16 }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Accepting submissions</label>
            </div>
            <div className="form-preview">
              <div className="muted small preview-tag">Preview</div>
              <h3>{f.name || 'Untitled form'}</h3>
              {f.description && <p className="muted">{f.description}</p>}
              {f.fields.map((k) => <div key={k} className="preview-field"><span>{FIELD_DEFS[k].label}{k === 'summary' && <span className="req"> *</span>}</span><div className={`preview-input ${k === 'description' ? 'tall' : ''}`} /></div>)}
              <div className="btn primary small" style={{ width: 'fit-content', marginTop: 8 }}>Submit</div>
            </div>
          </div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary">{isNew ? 'Create form' : 'Save changes'}</button></div>
      </form>
    </Modal>
  )
}

function FormFill({ form, onClose, onSubmitted }) {
  const { meta } = useApp()
  const [v, setV] = useState({ summary: '', description: '', priority: 'Medium', dueDate: '', labels: [], storyPoints: '' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { const issue = await api.submitForm(form.id, { ...v, storyPoints: v.storyPoints === '' ? undefined : v.storyPoints }); onSubmitted(issue) } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <Modal onClose={onClose} width={600}>
      <form onSubmit={submit} className="create-form">
        <div className="modal-header"><h2>{form.name}</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body scroll">
          {form.description && <p className="muted">{form.description}</p>}
          {form.fields.includes('summary') && <div className="field"><label className="field-title">Summary <span className="req">*</span></label><input className="text-input" autoFocus required maxLength={255} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} /></div>}
          {form.fields.includes('description') && <div className="field"><label className="field-title">Description</label><textarea className="text-input" rows={5} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>}
          {form.fields.includes('priority') && (
            <div className="field"><label className="field-title">Priority</label>
              <div className="type-choices">{meta.priorities.map((p) => <button type="button" key={p} className={`type-choice ${v.priority === p ? 'on' : ''}`} onClick={() => setV({ ...v, priority: p })}><PriorityIcon priority={p} />{p}</button>)}</div>
            </div>
          )}
          <div className="field-row">
            {form.fields.includes('dueDate') && <div className="field"><label className="field-title">Due date</label><input type="date" className="text-input narrow" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} /></div>}
            {form.fields.includes('storyPoints') && <div className="field"><label className="field-title">Story point estimate</label><input type="number" min="0" className="text-input narrow" value={v.storyPoints} onChange={(e) => setV({ ...v, storyPoints: e.target.value })} /></div>}
          </div>
          {form.fields.includes('labels') && (
            <div className="field"><label className="field-title">Labels</label>
              <Dropdown minWidth={300} trigger={({ ref, toggle }) => (
                <button type="button" ref={ref} className="fake-select" onClick={toggle}>{v.labels.length ? v.labels.map((l) => <span key={l} className="label-chip">{l}</span>) : <span className="muted">Select label</span>}<Icon name="chevronDown" size={16} className="chev" /></button>
              )}>
                {(close) => <LabelsEditor value={v.labels} allLabels={meta.labels} onChange={(labels) => setV((s) => ({ ...s, labels }))} onDone={close} />}
              </Dropdown>
            </div>
          )}
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><span className="muted small">Creates a {form.issueType} in {form.projectKey || 'KAN'}</span><span className="spacer" /><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit'}</button></div>
      </form>
    </Modal>
  )
}
