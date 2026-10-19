import React, { useState } from 'react'
import { api, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon } from '../icons.jsx'
import { Avatar, Confirm, Dropdown, MenuItem, Modal, timeAgo } from '../components/ui.jsx'

export default function FiltersPage() {
  const { filters, refreshFilters, openList, userById, currentUser, isAdmin, toast } = useApp()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const canEdit = (f) => isAdmin || f.ownerId === currentUser?.id
  const shown = filters.filter((f) => (tab === 'all' || (tab === 'starred' && f.starred) || (tab === 'mine' && f.ownerId === currentUser?.id))
    && (!q || `${f.name} ${f.jql} ${f.description || ''}`.toLowerCase().includes(q.toLowerCase())))
  const run = async (fn, ok) => { try { await fn(); await refreshFilters(); if (ok) toast(ok) } catch (e) { toast({ title: 'Something went wrong', description: e.message, error: true }) } }

  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h2>Filters</h2><p className="muted">Saved searches you can reuse. Starred filters appear in the sidebar.</p></div>
        <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" size={16} />Create filter</button>
      </div>
      <div className="toolbar">
        <label className="list-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search filters" /></label>
        <div className="segmented">
          {[['all', 'All filters'], ['starred', 'Starred'], ['mine', 'My filters']].map(([v, l]) => <button key={v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>)}
        </div>
      </div>
      <div className="table-wrap">
        <table className="simple-table filters-table">
          <thead><tr><th style={{ width: 40 }} /><th>Name</th><th>JQL</th><th style={{ width: 170 }}>Owner</th><th style={{ width: 120 }}>Updated</th><th style={{ width: 48 }} /></tr></thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f.id}>
                <td><button className={`star-btn ${f.starred ? 'on' : ''}`} title={f.starred ? 'Unstar' : 'Star'} onClick={() => run(() => api.updateFilter(f.id, { starred: !f.starred }))}><Icon name="star" size={16} /></button></td>
                <td><button className="link strong" onClick={() => openList(f.jql)}>{f.name}</button>{f.description && <div className="muted small">{f.description}</div>}</td>
                <td><code className="jql-chip" title={f.jql}>{f.jql}</code></td>
                <td>{f.ownerId ? <span className="inline-flex"><Avatar user={userById[f.ownerId]} size={22} />{userById[f.ownerId]?.name}</span> : '—'}</td>
                <td className="muted">{timeAgo(f.updated)}</td>
                <td>
                  <Dropdown align="end" trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn small" onClick={toggle} aria-label="Filter actions"><Icon name="more" size={16} /></button>}>
                    {(close) => (
                      <div className="menu">
                        <MenuItem onClick={() => { close(); openList(f.jql) }}>Open in list</MenuItem>
                        <MenuItem disabled={!canEdit(f)} onClick={() => { close(); setEditing(f) }}>Edit details</MenuItem>
                        <MenuItem onClick={() => { close(); run(() => api.createFilter({ name: `Copy of ${f.name}`, jql: f.jql, description: f.description }), 'Filter copied') }}>Copy filter</MenuItem>
                        <MenuItem onClick={() => { close(); navigator.clipboard?.writeText(`${window.location.origin}/jira/software/projects/${getProject()}/list?jql=${encodeURIComponent(f.jql)}`).then(() => toast('Link copied')) }}>Copy link</MenuItem>
                        <div className="menu-sep" />
                        <MenuItem danger disabled={!canEdit(f)} onClick={() => { close(); setConfirm(f) }}>Delete</MenuItem>
                      </div>
                    )}
                  </Dropdown>
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={6} className="empty-row">{filters.length ? 'No filters match your search.' : 'No saved filters yet. Run a search in the list and choose “Save filter”.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <FilterEditor filter={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await refreshFilters() }} />}
      {confirm && <Confirm title={`Delete “${confirm.name}”?`} body="This filter will be removed for everyone." onConfirm={() => run(() => api.deleteFilter(confirm.id), 'Filter deleted')} onClose={() => setConfirm(null)} />}
    </div>
  )
}

function FilterEditor({ filter, onClose, onSaved }) {
  const isNew = !filter.id
  const [f, setF] = useState({ name: filter.name || '', description: filter.description || '', jql: filter.jql || `project = ${getProject()} ORDER BY cf[10019] ASC` })
  const [err, setErr] = useState(null)
  const save = async (e) => {
    e.preventDefault()
    try { if (isNew) await api.createFilter(f); else await api.updateFilter(filter.id, f); onSaved() } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={560}>
      <form onSubmit={save} className="create-form">
        <div className="modal-header"><h2>{isNew ? 'Create filter' : 'Edit filter'}</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          <div className="field"><label className="field-title">Name <span className="req">*</span></label><input className="text-input" autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label className="field-title">Description</label><input className="text-input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="field"><label className="field-title">JQL <span className="req">*</span></label><textarea className="text-input mono" rows={3} required value={f.jql} onChange={(e) => { setF({ ...f, jql: e.target.value }); setErr(null) }} /></div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary">{isNew ? 'Create' : 'Save'}</button></div>
      </form>
    </Modal>
  )
}
