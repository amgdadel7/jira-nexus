import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon } from '../icons.jsx'
import { Avatar, Dropdown, MenuItem, Modal, Confirm, Lozenge, fmtDate, todayStr } from '../components/ui.jsx'

const STATUS_FILTERS = [['unreleased', 'Unreleased'], ['released', 'Released'], ['archived', 'Archived'], ['', 'All']]

function VersionStatus({ v }) {
  if (v.status === 'released') return <span className="lozenge done">Released</span>
  if (v.status === 'archived') return <span className="lozenge todo">Archived</span>
  if (v.overdue) return <span className="lozenge removed">Overdue</span>
  return <span className="lozenge inprogress">Unreleased</span>
}

export function ProgressSegments({ stats, height = 8 }) {
  const t = stats.total || 1
  return (
    <div className="seg-progress" style={{ height }} title={`${stats.done} done · ${stats.inProgress} in progress · ${stats.todo} to do`}>
      {stats.total === 0 ? <div className="seg empty" style={{ width: '100%' }} /> : (
        <>
          <div className="seg done" style={{ width: `${(stats.done / t) * 100}%` }} />
          <div className="seg prog" style={{ width: `${(stats.inProgress / t) * 100}%` }} />
          <div className="seg todo" style={{ width: `${(stats.todo / t) * 100}%` }} />
        </>
      )}
    </div>
  )
}

export default function ReleasesView() {
  const { toast, refreshKey, refreshMeta, openList, can } = useApp()
  const canManage = can('MANAGE_VERSIONS')
  const [versions, setVersions] = useState(null)
  const [status, setStatus] = useState('unreleased')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // version | {} for new
  const [releasing, setReleasing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(() => api.versions().then(setVersions).catch((e) => toast({ title: 'Could not load releases', description: e.message, error: true })), [toast])
  useEffect(() => { load() }, [load, refreshKey])
  const changed = () => { load(); refreshMeta() }

  const rows = useMemo(() => (versions || []).filter((v) => (!status || v.status === status) && (!q.trim() || v.name.toLowerCase().includes(q.trim().toLowerCase()))), [versions, status, q])
  const selected = versions?.find((v) => v.id === selectedId)
  const setState = async (v, st) => {
    try { await api.updateVersion(v.id, { status: st }); toast(`${v.name} ${st === 'archived' ? 'archived' : st === 'unreleased' ? 'moved back to unreleased' : 'updated'}`); changed() } catch (e) { toast({ title: 'Could not update version', description: e.message, error: true }) }
  }

  return (
    <div className="releases">
      <div className="view-head">
        <div><h1>Releases</h1><p className="muted">Group work into versions, track progress and release when it ships. Set a work item’s <b>Fix version</b> to add it.</p></div>
        {canManage ? <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" size={16} />Create version</button> : <span className="readonly-chip" title="You need the Manage releases permission"><Icon name="lock" size={14} />View only</span>}
      </div>
      <div className="toolbar">
        <label className="list-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search versions" aria-label="Search versions" /></label>
        <div className="segmented">{STATUS_FILTERS.map(([id, label]) => <button key={id || 'all'} className={status === id ? 'on' : ''} onClick={() => setStatus(id)}>{label}</button>)}</div>
      </div>
      <div className={`releases-body ${selected ? 'with-detail' : ''}`}>
        <table className="data-table releases-table">
          <thead><tr><th>Version</th><th>Status</th><th style={{ width: '22%' }}>Progress</th><th>Start date</th><th>Release date</th><th>Description</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className={selectedId === v.id ? 'selected' : ''}>
                <td><button className="link-strong" onClick={() => setSelectedId(selectedId === v.id ? null : v.id)}>{v.name}</button></td>
                <td><VersionStatus v={v} /></td>
                <td><div className="progress-cell"><ProgressSegments stats={v.stats} /><span className="muted small">{v.stats.done}/{v.stats.total}</span></div></td>
                <td className="muted">{v.startDate ? fmtDate(v.startDate) : '—'}</td>
                <td className={v.overdue ? 'overdue' : 'muted'}>{v.releaseDate ? fmtDate(v.releaseDate) : '—'}</td>
                <td className="muted truncate-cell">{v.description}</td>
                <td>
                  <Dropdown align="end" trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn" onClick={toggle} aria-label={`Actions for ${v.name}`}><Icon name="more" size={16} /></button>}>
                    {(close) => (
                      <div className="menu">
                        {canManage && v.status === 'unreleased' && <MenuItem onClick={() => { close(); setReleasing(v) }}>Release</MenuItem>}
                        {canManage && <MenuItem onClick={() => { close(); setEditing(v) }}>Edit</MenuItem>}
                        {canManage && v.status === 'released' && <MenuItem onClick={() => { close(); setState(v, 'unreleased') }}>Unrelease</MenuItem>}
                        {!canManage ? null : v.status !== 'archived' ? <MenuItem onClick={() => { close(); setState(v, 'archived') }}>Archive</MenuItem> : <MenuItem onClick={() => { close(); setState(v, 'released') }}>Unarchive</MenuItem>}
                        <MenuItem onClick={() => { close(); openList(`project = ${getProject()} AND fixVersion = "${v.name}" ORDER BY cf[10019] ASC`) }}>View in list</MenuItem>
                        {canManage && <MenuItem danger onClick={() => { close(); setDeleting(v) }}>Delete</MenuItem>}
                      </div>
                    )}
                  </Dropdown>
                </td>
              </tr>
            ))}
            {versions && !rows.length && (
              <tr><td colSpan={7} className="empty-cell">
                {versions.length ? 'No versions match these filters.' : <>No versions yet. <button className="link" onClick={() => setEditing({})}>Create your first version</button></>}
              </td></tr>
            )}
          </tbody>
        </table>
        {selected && <VersionDetail version={selected} onClose={() => setSelectedId(null)} onRelease={canManage ? () => setReleasing(selected) : null} />}
      </div>
      {editing && <VersionModal version={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={(v) => { setEditing(null); toast(`${v.name} saved`); changed() }} />}
      {releasing && <ReleaseModal version={releasing} versions={versions || []} onClose={() => setReleasing(null)} onReleased={(r) => { setReleasing(null); toast({ title: `${r.version.name} released 🎉`, description: r.moved ? `${r.moved} unresolved work items moved.` : undefined }); changed() }} />}
      {deleting && (
        <Confirm title={`Delete ${deleting.name}?`} body={`${deleting.stats.total} work items will have their fix version cleared. This can’t be undone.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => { try { await api.deleteVersion(deleting.id); if (selectedId === deleting.id) setSelectedId(null); toast(`${deleting.name} deleted`); changed() } catch (e) { toast({ title: 'Could not delete', description: e.message, error: true }) } }} />
      )}
    </div>
  )
}

function VersionDetail({ version, onClose, onRelease }) {
  const { openIssue, userById, refreshKey } = useApp()
  const [data, setData] = useState(null)
  useEffect(() => { setData(null); api.version(version.id).then(setData).catch(() => setData({ issues: [] })) }, [version.id, version.stats.total, version.stats.done, refreshKey])
  const s = version.stats
  return (
    <aside className="version-detail">
      <div className="vd-head">
        <div><h3>{version.name}</h3><VersionStatus v={version} /></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
      </div>
      {version.description && <p className="muted">{version.description}</p>}
      <div className="vd-dates">
        <div><span className="muted small">Start</span><b>{version.startDate ? fmtDate(version.startDate) : '—'}</b></div>
        <div><span className="muted small">{version.status === 'released' ? 'Released' : 'Release'}</span><b className={version.overdue ? 'overdue' : ''}>{version.releaseDate ? fmtDate(version.releaseDate) : '—'}</b></div>
      </div>
      <div className="vd-stats">
        <div><b>{s.total}</b><span>work items</span></div>
        <div className="done"><b>{s.done}</b><span>done</span></div>
        <div className="prog"><b>{s.inProgress}</b><span>in progress</span></div>
        <div><b>{s.todo}</b><span>to do</span></div>
      </div>
      <ProgressSegments stats={s} height={10} />
      {version.status === 'unreleased' && onRelease && <button className="btn primary block" onClick={onRelease}>Release {version.name}</button>}
      <h4>Work items</h4>
      {!data ? <div className="spinner" /> : !data.issues.length ? <p className="muted small">No work items have this fix version yet.</p> : (
        <ul className="vd-issues">
          {data.issues.map((i) => (
            <li key={i.key}><button onClick={() => openIssue(i.key)}>
              <TypeIcon type={i.type} size={14} /><span className="issue-key small">{i.key}</span><span className="vd-sum">{i.summary}</span>
              <Lozenge status={i.status} />{i.assigneeId ? <Avatar user={userById[i.assigneeId]} size={20} /> : <span style={{ width: 20 }} />}
            </button></li>
          ))}
        </ul>
      )}
    </aside>
  )
}

function VersionModal({ version, onClose, onSaved }) {
  const [f, setF] = useState({ name: version?.name || '', startDate: version?.startDate || '', releaseDate: version?.releaseDate || '', description: version?.description || '' })
  const [err, setErr] = useState(null)
  const save = async (e) => {
    e.preventDefault(); setErr(null)
    try { onSaved(version ? await api.updateVersion(version.id, f) : await api.createVersion(f)) } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={520}>
      <form onSubmit={save} className="create-form">
        <div className="modal-header"><h2>{version ? `Edit ${version.name}` : 'Create version'}</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          <div className="field"><label className="field-title" htmlFor="vname">Name <span className="req">*</span></label><input id="vname" className="text-input" autoFocus required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. 1.5.0" /></div>
          <div className="field-row">
            <div className="field"><label className="field-title" htmlFor="vstart">Start date</label><input id="vstart" type="date" className="text-input narrow" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
            <div className="field"><label className="field-title" htmlFor="vrel">Release date</label><input id="vrel" type="date" className="text-input narrow" min={f.startDate || undefined} value={f.releaseDate} onChange={(e) => setF({ ...f, releaseDate: e.target.value })} /></div>
          </div>
          <div className="field"><label className="field-title" htmlFor="vdesc">Description</label><textarea id="vdesc" className="text-input" rows={3} maxLength={1000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary">{version ? 'Save' : 'Create'}</button></div>
      </form>
    </Modal>
  )
}

function ReleaseModal({ version, versions, onClose, onReleased }) {
  const open = version.stats.total - version.stats.done
  const targets = versions.filter((v) => v.status === 'unreleased' && v.id !== version.id)
  const [date, setDate] = useState(version.releaseDate && version.releaseDate <= todayStr() ? version.releaseDate : todayStr())
  const [mode, setMode] = useState(targets.length ? 'move' : 'ignore')
  const [target, setTarget] = useState(targets[0]?.id || '')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const go = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true)
    const body = { releaseDate: date }
    if (open && mode === 'move') body.moveUnresolvedTo = Number(target)
    try { onReleased(await api.releaseVersion(version.id, body)) } catch (e2) { setErr(e2.message); setBusy(false) }
  }
  return (
    <Modal onClose={onClose} width={500}>
      <form onSubmit={go} className="create-form">
        <div className="modal-header"><h2>Release {version.name}</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          <div className="field"><label className="field-title" htmlFor="reldate">Release date</label><input id="reldate" type="date" className="text-input narrow" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {open > 0 ? (
            <div className="release-warning">
              <p><Icon name="warning" size={16} /> This version still has <b>{open}</b> unresolved work item{open === 1 ? '' : 's'}.</p>
              <label className="radio-row"><input type="radio" name="mode" checked={mode === 'ignore'} onChange={() => setMode('ignore')} />Ignore and release anyway</label>
              <label className={`radio-row ${targets.length ? '' : 'disabled'}`}><input type="radio" name="mode" disabled={!targets.length} checked={mode === 'move'} onChange={() => setMode('move')} />Move them to
                <select className="text-input auto" disabled={mode !== 'move'} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target version">
                  {targets.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </label>
            </div>
          ) : <p className="muted">All {version.stats.total} work items are done. 🎉</p>}
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>Release</button></div>
      </form>
    </Modal>
  )
}
