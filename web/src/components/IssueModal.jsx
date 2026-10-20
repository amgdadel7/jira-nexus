import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api, recent, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon, PriorityIcon, ProjectAvatar } from '../icons.jsx'
import {
  Avatar, Confirm, Dropdown, InlineText, MenuItem, Modal, Popover, StatusSelect, TypeSelect, Lozenge, fmtDate, fmtDateTime, timeAgo, isOverdue, SkeletonIssue,
} from './ui.jsx'
import { TimeTrackingField, EstimateCell, LogWorkModal, WorklogList, VoteButton } from './TimeTracking.jsx'
import { flash } from '../motion.js'
import { UserCell, PriorityCell, DueCell, LabelsCell, ParentPicker, NumberCell, SprintCell, DateCell, VersionCell } from '../views/cells.jsx'

export default function IssueModal({ issueKey, onClose, onNavigate }) {
  const { meta, userById, currentUser, bump, toast, refreshMeta, navigate } = useApp()
  const [issue, setIssue] = useState(null)
  const [error, setError] = useState(null)
  const [epics, setEpics] = useState([])
  const [confirm, setConfirm] = useState(false)
  const [activityTab, setActivityTab] = useState('comments')
  const [logWork, setLogWork] = useState(null) // null | { worklog? }

  const load = useCallback(() => {
    api.issue(issueKey).then((d) => { setIssue(d); setError(null); recent.push(d) }).catch((e) => { setError(e.message); if (e.status === 404) recent.remove(issueKey) })
  }, [issueKey])
  useEffect(() => { setIssue(null); load() }, [load])
  useEffect(() => { api.search(`project = ${getProject()} AND type = Epic ORDER BY cf[10019] ASC`).then((d) => setEpics(d.issues)).catch(() => {}) }, [])

  const patch = async (fields) => {
    setIssue((i) => ({ ...i, ...fields }))
    try {
      await api.update(issueKey, fields)
      load(); bump()
      if (fields.status) flash('.issue-side .status-button')
      if (fields.labels) refreshMeta()
    } catch (e) { toast({ title: 'Update failed', description: e.message, error: true }); load() }
  }

  const del = async () => {
    try {
      const r = await api.remove(issueKey)
      bump(); onClose()
      toast({ title: `${issueKey} moved to the recycle bin`, description: 'You can restore it for 30 days from Project settings → Recycle bin.',
        action: { label: 'Undo', onClick: async () => { try { await api.restoreTrash(r.trashId); bump(); toast(`${issueKey} restored`) } catch (e) { toast({ title: 'Restore failed', description: e.message, error: true }) } } } })
    } catch (e) { toast({ title: 'Delete failed', description: e.message, error: true }) }
  }
  const perms = issue?.permissions || []
  const ican = (p) => perms.includes(p)
  const canEdit = ican('EDIT_ISSUES')
  const sameProject = issue && issue.project === meta.project.key

  if (error) {
    return (
      <Modal onClose={onClose} width={480}>
        <div className="modal-header"><h2>Work item not found</h2><button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body"><p>{error}</p></div>
        <div className="modal-footer"><button className="btn primary" onClick={onClose}>Close</button></div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} width={1100} className="issue-modal" labelledBy="issue-summary">
      <h1 className="sr-only" id="issue-summary">{issue ? `${issue.key}: ${issue.summary}` : `Work item ${issueKey}`}</h1>
      {!issue ? <SkeletonIssue /> : (
        <>
          <div className="issue-topbar">
            <div className="issue-breadcrumbs">
              <ProjectAvatar size={16} /><span className="muted">{meta.project.name}</span><span className="sep">/</span>
              {issue.parent && (<><button className="crumb" onClick={() => onNavigate(issue.parent.key)}><TypeIcon type={issue.parent.type} size={14} />{issue.parent.key}</button><span className="sep">/</span></>)}
              <TypeSelect value={issue.type} types={meta.types} onChange={(type) => patch({ type })} trigger={({ ref, toggle }) => (
                <button ref={ref} className="crumb type-crumb" onClick={toggle} disabled={!canEdit} title="Change work type"><TypeIcon type={issue.type} size={14} /></button>
              )} />
              <a className="crumb" href={`/browse/${issue.key}`} onClick={(e) => { e.preventDefault(); navigator.clipboard?.writeText(`${window.location.origin}/browse/${issue.key}`); toast('Link copied') }}>{issue.key}</a>
            </div>
            <div className="issue-top-actions">
              <VoteButton issue={issue} currentUserId={meta.currentUserId} onChanged={load} />
              <button className={`watch-btn ${issue.watching ? 'on' : ''}`} title={issue.watching ? 'Stop watching' : 'Start watching'} onClick={async () => {
                try { if (issue.watching) await api.unwatch(issue.key); else await api.watch(issue.key); load(); toast(issue.watching ? 'You stopped watching this work item' : 'You’re now watching this work item') } catch (e) { toast({ title: 'Failed', description: e.message, error: true }) }
              }}><Icon name="eye" size={18} /><span>{issue.watchers.length}</span></button>
              <button className="icon-btn" title="Share" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/browse/${issue.key}`); toast('Link copied to clipboard') }}><Icon name="share" size={18} /></button>
              <Dropdown align="end" minWidth={200} trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn" title="More actions" onClick={toggle}><Icon name="more" size={18} /></button>}>
                {(close) => (
                  <div className="menu">
                    <MenuItem onClick={() => { close(); navigator.clipboard?.writeText(issue.key); toast('Key copied') }}>Copy key</MenuItem>
                    <MenuItem disabled={!ican('ASSIGN_ISSUES')} onClick={() => { close(); patch({ assigneeId: meta.currentUserId }) }}>Assign to me</MenuItem>
                    <MenuItem disabled={!ican('CREATE_ISSUES')} onClick={async () => { close(); try { const c = await api.clone(issue.key); bump(); toast({ title: `${c.key} was created as a clone`, action: { label: 'View', onClick: () => onNavigate(c.key) } }) } catch (e) { toast({ title: 'Clone failed', description: e.message, error: true }) } }}>Clone</MenuItem>
                    <MenuItem disabled={!ican('LINK_ISSUES')} onClick={() => { close(); document.getElementById('link-add')?.click() }}>Link work item</MenuItem>
                    <MenuItem disabled={!ican('CREATE_ATTACHMENTS')} onClick={() => { close(); document.getElementById('attach-input')?.click() }}>Attach file</MenuItem>
                    <MenuItem disabled={!ican('WORK_ON_ISSUES')} onClick={() => { close(); setLogWork({}) }}>Log work</MenuItem>
                    <div className="menu-sep" />
                    <MenuItem danger disabled={!ican('DELETE_ISSUES')} onClick={() => { close(); setConfirm(true) }}>Delete</MenuItem>
                  </div>
                )}
              </Dropdown>
              <button className="icon-btn" title="Close (Esc)" onClick={onClose}><Icon name="close" size={18} /></button>
            </div>
          </div>

          <div className="issue-body">
            <div className="issue-main">
              {!canEdit && <div className="notice-inline readonly-banner" role="note"><Icon name="lock" size={14} />You have <b>&nbsp;{perms.includes('ADD_COMMENTS') ? 'view and comment' : 'view-only'}&nbsp;</b> access to this work item.</div>}
              <InlineText value={issue.summary} onSave={(summary) => patch({ summary })} className="issue-summary" inputClassName="issue-summary-input" multiline readOnly={!canEdit} />
              <div className="issue-quick">
                <button className="btn" disabled={!ican('ADD_COMMENTS')} onClick={() => document.getElementById('comment-box')?.focus()}><Icon name="comment" size={14} />Add comment</button>
                {issue.type !== 'Subtask' && ican('CREATE_ISSUES') && <AddChildButton issue={issue} onCreated={() => { load(); bump() }} />}
                <button className="btn" disabled={!ican('CREATE_ATTACHMENTS')} onClick={() => document.getElementById('attach-input')?.click()}><Icon name="attach" size={14} />Attach</button>
                <button className="btn" disabled={!ican('LINK_ISSUES')} onClick={() => document.getElementById('link-add')?.click()}><Icon name="link" size={14} />Link work item</button>
              </div>

              <h3 className="section-title">Description</h3>
              <Description value={issue.description} onSave={(description) => patch({ description })} readOnly={!canEdit} />

              <fieldset className="plain-fieldset" disabled={!canEdit && !ican('CREATE_ISSUES')}>
                {(issue.type !== 'Subtask') && (
                  <ChildIssues issue={issue} onOpen={onNavigate} onChanged={() => { load(); bump() }} />
                )}
              </fieldset>
              <Attachments issue={issue} reload={() => { load(); bump() }} canUpload={ican('CREATE_ATTACHMENTS')} canDeleteAll={ican('DELETE_ALL_ATTACHMENTS')} />
              <Links issue={issue} onOpen={onNavigate} reload={() => { load(); bump() }} canLink={ican('LINK_ISSUES')} />

              <h3 className="section-title">Activity</h3>
              <div className="activity-tabs">
                {[['all', 'All'], ['comments', 'Comments'], ['history', 'History'], ['worklog', 'Work log']].map(([t, label]) => (
                  <button key={t} className={`chip-tab ${activityTab === t ? 'on' : ''}`} onClick={() => setActivityTab(t)}>{label}</button>
                ))}
                {activityTab === 'worklog' && ican('WORK_ON_ISSUES') && <button className="btn small log-work-btn" style={{ marginLeft: 'auto' }} onClick={() => setLogWork({})}><Icon name="timer" size={14} />Log work</button>}
              </div>
              {activityTab === 'worklog' ? (
                <WorklogList issue={issue} userById={userById} currentUserId={meta.currentUserId} canManageAll={ican('EDIT_ALL_WORKLOGS')} onEdit={(w) => setLogWork({ worklog: w })} reload={() => { load(); bump() }} />
              ) : <>
              {activityTab !== 'history' && ican('ADD_COMMENTS') && (
                <CommentBox user={currentUser} onSubmit={async (body) => {
                  try { await api.addComment(issue.key, body); load(); bump() } catch (e) { toast({ title: 'Comment failed', description: e.message, error: true }) }
                }} />
              )}
              <Activity issue={issue} tab={activityTab} userById={userById} currentUserId={meta.currentUserId} reload={() => { load(); bump() }} />
              </>}
            </div>

            <aside className="issue-side">
              <div className="side-top">
                <fieldset className="plain-fieldset" disabled={!ican('TRANSITION_ISSUES')}><StatusSelect variant="button" value={issue.status} statuses={meta.statuses} onChange={(status) => patch({ status })} /></fieldset>
                {issue.status === 'Done' && <span className="resolved-pill"><Icon name="check" size={14} strokeWidth={2.6} />Done</span>}
              </div>
              <details className="details-box" open>
                <summary>Details<Icon name="chevronDown" size={16} /></summary>
                <fieldset className="plain-fieldset field-grid" disabled={!canEdit}>
                  <FieldLabel>Assignee</FieldLabel>
                  <fieldset className="plain-fieldset" disabled={!ican('ASSIGN_ISSUES')}>
                    <UserCell userId={issue.assigneeId} onChange={(assigneeId) => patch({ assigneeId })} />
                    {issue.assigneeId !== meta.currentUserId && ican('ASSIGN_ISSUES') && <button className="link small assign-me" onClick={() => patch({ assigneeId: meta.currentUserId })}>Assign to me</button>}
                  </fieldset>
                  <FieldLabel>Components</FieldLabel>
                  <div><ComponentsCell issue={issue} options={sameProject ? meta.components || [] : null} onChange={(components) => patch({ components })} /></div>
                  <FieldLabel>Team</FieldLabel>
                  <div><TeamCell value={issue.teamId} teams={meta.teams || []} onChange={(teamId) => patch({ teamId })} /></div>
                  <FieldLabel>Labels</FieldLabel>
                  <div><LabelsCell issue={issue} onChange={patch} max={10} /></div>
                  <FieldLabel>Parent</FieldLabel>
                  <div>
                    <ParentPicker issue={issue} candidates={epics} onChange={patch} trigger={({ ref, toggle, open }) => (
                      <button ref={ref} className={`cell-btn ${open ? 'open' : ''}`} onClick={toggle}>
                        {issue.parent ? <><TypeIcon type={issue.parent.type} size={14} /><span className="truncate">{issue.parent.key} {issue.parent.summary}</span></> : <span className="muted">None</span>}
                      </button>
                    )} />
                  </div>
                  <FieldLabel>Due date</FieldLabel>
                  <div><DueCell issue={issue} onChange={patch} /></div>
                  <FieldLabel>Start date</FieldLabel>
                  <div><DateCell value={issue.startDate} onChange={(startDate) => patch({ startDate })} /></div>
                  <FieldLabel>Priority</FieldLabel>
                  <div><PriorityCell issue={issue} onChange={patch} /></div>
                  <FieldLabel>Story point estimate</FieldLabel>
                  <div><NumberCell value={issue.storyPoints} onChange={(storyPoints) => patch({ storyPoints })} /></div>
                  <FieldLabel>Original estimate</FieldLabel>
                  <div><EstimateCell value={issue.originalEstimate} readOnly={!canEdit} onSave={(originalEstimate) => patch({ originalEstimate })} /></div>
                  <FieldLabel>Time tracking</FieldLabel>
                  <div><TimeTrackingField issue={issue} canLog={ican('WORK_ON_ISSUES')} onLog={() => setLogWork({})} /></div>
                  <FieldLabel>Sprint</FieldLabel>
                  <div><SprintCell value={issue.sprint} onChange={(sprint) => patch({ sprint })} /></div>
                  <FieldLabel>Fix versions</FieldLabel>
                  <div><VersionCell value={issue.fixVersion} onChange={(fixVersion) => patch({ fixVersion })} /></div>
                  <FieldLabel>Reporter</FieldLabel>
                  <div><UserCell userId={issue.reporterId} label="None" onChange={(reporterId) => patch({ reporterId })} /></div>
                </fieldset>
              </details>
              <Development issue={issue} reload={load} onOpenCode={() => { onClose(); navigate({ page: 'project', view: 'code' }) }} />
              {issue.goals.length > 0 && (
                <div className="side-panel">
                  <div className="side-panel-head">Goals</div>
                  {issue.goals.map((g) => <button key={g.id} className="goal-chip" onClick={() => { onClose(); navigate({ page: 'project', view: 'goals' }) }}><Icon name="goals" size={14} />{g.name}<GoalStatus status={g.status} /></button>)}
                </div>
              )}
              <div className="timestamps">
                <div>Created {fmtDateTime(issue.created)}</div>
                <div>Updated {timeAgo(issue.updated)}</div>
                {issue.resolved && <div>Resolved {fmtDateTime(issue.resolved)}</div>}
              </div>
            </aside>
          </div>
          {logWork && <LogWorkModal issue={issue} worklog={logWork.worklog} onClose={() => setLogWork(null)} onSaved={() => { load(); bump(); setActivityTab('worklog') }} />}
          {confirm && <Confirm title={`Delete ${issue.key}?`} body="The work item, its sub-tasks, comments and attachments move to the recycle bin. You can restore them for 30 days." confirmLabel="Move to recycle bin" onConfirm={del} onClose={() => setConfirm(false)} />}
        </>
      )}
    </Modal>
  )
}

const FieldLabel = ({ children }) => <div className="field-label">{children}</div>

function ComponentsCell({ issue, options, onChange }) {
  const value = issue.components || []
  const shown = value.length ? <span className="chip-list">{value.map((c) => <span key={c} className="component-chip">{c}</span>)}</span> : <span className="muted">None</span>
  if (!options) return <div className="cell-btn static">{shown}</div>
  return (
    <Dropdown minWidth={220} trigger={({ ref, toggle, open }) => <button ref={ref} type="button" className={`cell-btn ${open ? 'open' : ''}`} onClick={toggle} aria-label="Components">{shown}</button>}>
      {() => (
        <div className="menu">
          {options.length === 0 && <div className="menu-heading">No components in this project</div>}
          {options.map((c) => {
            const on = value.includes(c.name)
            return <MenuItem key={c.id} selected={on} icon={<input type="checkbox" readOnly checked={on} tabIndex={-1} />} onClick={() => onChange(on ? value.filter((x) => x !== c.name) : [...value, c.name])}>{c.name}</MenuItem>
          })}
        </div>
      )}
    </Dropdown>
  )
}

function TeamCell({ value, teams, onChange }) {
  const team = teams.find((t) => t.id === value)
  return (
    <Dropdown minWidth={200} trigger={({ ref, toggle, open }) => (
      <button ref={ref} type="button" className={`cell-btn ${open ? 'open' : ''}`} onClick={toggle} aria-label="Team">
        {team ? <span className="inline-flex"><span className="team-swatch" style={{ background: team.color }} />{team.name}</span> : <span className="muted">None</span>}
      </button>
    )}>
      {(close) => (
        <div className="menu">
          <MenuItem selected={!value} onClick={() => { close(); onChange(null) }}>None</MenuItem>
          {teams.map((t) => <MenuItem key={t.id} selected={t.id === value} icon={<span className="team-swatch" style={{ background: t.color }} />} onClick={() => { close(); onChange(t.id) }}>{t.name}</MenuItem>)}
        </div>
      )}
    </Dropdown>
  )
}

function Description({ value, onSave, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value)
  useEffect(() => { if (!editing) setV(value) }, [value, editing])
  if (readOnly) return <div className={`desc-view readonly ${value ? '' : 'empty'}`}>{value ? value.split('\n').map((line, i) => <p key={i}>{line || '\u00A0'}</p>) : 'No description'}</div>
  if (editing) {
    return (
      <div className="desc-editor">
        <textarea autoFocus value={v} onChange={(e) => setV(e.target.value)} rows={7} placeholder="Add a description…"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { onSave(v); setEditing(false) } if (e.key === 'Escape') { e.stopPropagation(); setEditing(false) } }} />
        <div className="editor-actions">
          <button className="btn primary" onClick={() => { onSave(v); setEditing(false) }}>Save</button>
          <button className="btn subtle" onClick={() => { setEditing(false); setV(value) }}>Cancel</button>
          <span className="muted small">Ctrl/⌘ + Enter to save</span>
        </div>
      </div>
    )
  }
  return (
    <div className={`desc-view ${value ? '' : 'empty'}`} onClick={() => setEditing(true)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}>
      {value ? value.split('\n').map((line, i) => <p key={i}>{line || '\u00A0'}</p>) : 'Add a description…'}
    </div>
  )
}

function AddChildButton({ issue, onCreated }) {
  return (
    <button className="btn" onClick={() => document.getElementById('child-create')?.click()}>
      <Icon name="plus" size={14} />{issue.type === 'Epic' ? 'Add child work item' : 'Add subtask'}
    </button>
  )
}

function ChildIssues({ issue, onOpen, onChanged }) {
  const { meta, userById, toast } = useApp()
  const [adding, setAdding] = useState(false)
  const [summary, setSummary] = useState('')
  const children = issue.children || []
  const done = children.filter((c) => c.status === 'Done').length
  const create = async () => {
    if (!summary.trim()) return
    try {
      await api.create({ summary: summary.trim(), type: issue.type === 'Epic' ? 'Task' : 'Subtask', parentKey: issue.key })
      setSummary(''); onChanged()
    } catch (e) { toast({ title: 'Couldn’t create', description: e.message, error: true }) }
  }
  const setStatus = async (key, status) => { try { await api.update(key, { status }); onChanged() } catch (e) { toast({ title: 'Update failed', description: e.message, error: true }) } }
  if (!children.length && !adding) return <button id="child-create" hidden onClick={() => setAdding(true)} />
  return (
    <div className="children">
      <div className="children-head">
        <h3 className="section-title">{issue.type === 'Epic' ? 'Child work items' : 'Subtasks'}</h3>
        <button id="child-create" className="icon-btn small" title="Add" onClick={() => setAdding(true)}><Icon name="plus" size={16} /></button>
      </div>
      {children.length > 0 && (
        <div className="progress">
          <div className="progress-bar"><span style={{ width: `${(done / children.length) * 100}%` }} /></div>
          <span className="muted small">{Math.round((done / children.length) * 100)}% Done</span>
        </div>
      )}
      <div className="child-list">
        {children.map((c) => (
          <div key={c.key} className="child-row" onClick={() => onOpen(c.key)}>
            <TypeIcon type={c.type} />
            <span className={`issue-key ${c.status === 'Done' ? 'done' : ''}`}>{c.key}</span>
            <span className="child-summary truncate">{c.summary}</span>
            <PriorityIcon priority={c.priority} />
            <Avatar user={userById[c.assigneeId]} size={22} />
            <span onClick={(e) => e.stopPropagation()}><StatusSelect value={c.status} statuses={meta.statuses} onChange={(s) => setStatus(c.key, s)} /></span>
          </div>
        ))}
        {adding && (
          <div className="child-row adding">
            <TypeIcon type={issue.type === 'Epic' ? 'Task' : 'Subtask'} />
            <input autoFocus placeholder="What needs to be done?" value={summary} onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') { e.stopPropagation(); setAdding(false) } }} />
            <button className="btn primary small" onClick={create} disabled={!summary.trim()}>Create</button>
            <button className="btn subtle small" onClick={() => { setAdding(false); setSummary('') }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

function CommentBox({ user, onSubmit, initial = '', onCancel, autoFocus = false, saveLabel = 'Save' }) {
  const [open, setOpen] = useState(autoFocus)
  const [v, setV] = useState(initial)
  const submit = async () => { if (!v.trim()) return; await onSubmit(v.trim()); setV(''); if (!onCancel) setOpen(false) }
  return (
    <div className="comment-box">
      {user && <Avatar user={user} size={32} />}
      <div className="comment-box-main">
        {open ? (
          <>
            <textarea id="comment-box" autoFocus value={v} onChange={(e) => setV(e.target.value)} rows={3} placeholder="Add a comment…"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); if (e.key === 'Escape') { e.stopPropagation(); onCancel ? onCancel() : setOpen(false) } }} />
            <div className="editor-actions">
              <button className="btn primary" disabled={!v.trim()} onClick={submit}>{saveLabel}</button>
              <button className="btn subtle" onClick={() => { onCancel ? onCancel() : (setOpen(false), setV('')) }}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <input id="comment-box" className="comment-placeholder" placeholder="Add a comment…" onFocus={() => setOpen(true)} readOnly />
            <div className="quick-replies">
              {['Looks good!', 'Need help?', 'This is blocked…', 'Can you clarify…?'].map((t) => (
                <button key={t} className="quick-reply" onClick={() => { setV(t); setOpen(true) }}>{t}</button>
              ))}
            </div>
            <div className="muted small tip"><b>Pro tip:</b> press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to save a comment</div>
          </>
        )}
      </div>
    </div>
  )
}

function Activity({ issue, tab, userById, currentUserId, reload }) {
  const { toast } = useApp()
  const [editing, setEditing] = useState(null)
  const seen = useRef(null)
  useEffect(() => { seen.current = new Set([...issue.comments.map((c) => `c${c.id}`), ...issue.history.map((h) => `h${h.id}`)]) })
  const isNew = (k) => !!seen.current && !seen.current.has(k)
  const items = [
    ...(tab !== 'history' ? issue.comments.map((c) => ({ kind: 'comment', ...c })) : []),
    ...(tab !== 'comments' ? issue.history.map((h) => ({ kind: 'history', ...h })) : []),
  ].sort((a, b) => (a.created < b.created ? 1 : -1))
  if (!items.length) return <div className="muted activity-empty">{tab === 'history' ? 'No history yet.' : 'No comments yet.'}</div>
  return (
    <div className="activity">
      {items.map((it) => {
        const u = userById[it.authorId]
        if (it.kind === 'comment') {
          return (
            <div key={`c${it.id}`} className={`activity-item ${isNew(`c${it.id}`) ? 'new' : ''}`}>
              <Avatar user={u} size={32} />
              <div className="activity-main">
                <div className="activity-head"><b>{u?.name || 'Former user'}</b><span className="muted" title={fmtDateTime(it.created)}>{timeAgo(it.created)}</span>{it.updated !== it.created && <span className="muted small">(edited)</span>}</div>
                {editing === it.id ? (
                  <CommentBox initial={it.body} autoFocus saveLabel="Save" onCancel={() => setEditing(null)}
                    onSubmit={async (body) => { try { await api.editComment(it.id, body); setEditing(null); reload() } catch (e) { toast({ title: 'Edit failed', description: e.message, error: true }) } }} />
                ) : (
                  <>
                    <div className="comment-body">{it.body.split('\n').map((l, i) => <p key={i}>{l || '\u00A0'}</p>)}</div>
                    {it.authorId === currentUserId && (
                      <div className="comment-actions">
                        <button className="link-plain" onClick={() => setEditing(it.id)}>Edit</button>
                        <span>·</span>
                        <button className="link-plain" onClick={async () => { await api.deleteComment(it.id); reload() }}>Delete</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        }
        return (
          <div key={`h${it.id}`} className={`activity-item history ${isNew(`h${it.id}`) ? 'new' : ''}`}>
            <Avatar user={u} size={32} />
            <div className="activity-main">
              <div className="activity-head">
                <b>{u?.name || 'Former user'}</b>
                <span>{it.field === 'created' ? 'created the Work item' : <>changed the <b>{it.field[0].toUpperCase() + it.field.slice(1)}</b></>}</span>
                <span className="muted" title={fmtDateTime(it.created)}>{timeAgo(it.created)}</span>
              </div>
              {it.field !== 'created' && (
                <div className="history-change">
                  {it.field === 'status' ? <>{it.from ? <Lozenge status={it.from} /> : <span className="muted">None</span>}<span className="arrow">→</span>{it.to ? <Lozenge status={it.to} /> : <span className="muted">None</span>}</>
                    : <><span className={it.from ? '' : 'muted'}>{it.from || 'None'}</span><span className="arrow">→</span><span className={it.to ? '' : 'muted'}>{it.to || 'None'}</span></>}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}


/* ================= Attachments ================= */
const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)

function Attachments({ issue, reload, canUpload = true, canDeleteAll = false }) {
  const { toast, userById, meta, isAdmin } = useApp()
  const [busy, setBusy] = useState(0)
  const [drag, setDrag] = useState(false)
  const [preview, setPreview] = useState(null)
  const upload = async (files) => {
    const list = [...files]
    if (!canUpload) { toast({ title: 'You can’t add attachments in this project', error: true }); return }
    for (const f of list) {
      if (f.size > 10 * 1024 * 1024) { toast({ title: `${f.name} is too large`, description: 'The maximum file size is 10 MB.', error: true }); continue }
      setBusy((b) => b + 1)
      try { await api.upload(issue.key, f) } catch (e) { toast({ title: `Couldn’t upload ${f.name}`, description: e.message, error: true }) }
      setBusy((b) => b - 1)
    }
    reload()
  }
  return (
    <div className={`attachments ${drag ? 'drag' : ''}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true) } }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files) } }}>
      <input id="attach-input" type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
      {(issue.attachments.length > 0 || busy > 0 || drag) && (
        <>
          <div className="children-head">
            <h3 className="section-title">Attachments <span className="count-pill">{issue.attachments.length}</span></h3>
            {canUpload && <button className="icon-btn small" title="Add attachment" onClick={() => document.getElementById('attach-input').click()}><Icon name="plus" size={16} /></button>}
          </div>
          <div className="attach-grid">
            {issue.attachments.map((a) => (
              <div key={a.id} className="attach-card">
                {a.mime.startsWith('image/') ? (
                  <button className="attach-thumb" onClick={() => setPreview(a)}><img src={api.attachmentUrl(a.id, true)} alt={a.filename} /></button>
                ) : (
                  <a className="attach-thumb file" href={api.attachmentUrl(a.id)} download><Icon name="forms" size={28} /><span>{(a.filename.split('.').pop() || '').toUpperCase().slice(0, 4)}</span></a>
                )}
                <div className="attach-meta">
                  <a className="truncate" href={api.attachmentUrl(a.id)} download title={a.filename}>{a.filename}</a>
                  <span className="muted small">{fmtSize(a.size)} · {fmtDate(a.created)}</span>
                </div>
                {((a.uploaderId === meta.currentUserId && canUpload) || canDeleteAll || isAdmin) && (
                  <button className="icon-btn small attach-del" title="Delete" onClick={async () => { if (!window.confirm(`Delete ${a.filename}?`)) return; await api.deleteAttachment(a.id); reload() }}><Icon name="trash" size={14} /></button>
                )}
              </div>
            ))}
            {busy > 0 && <div className="attach-card uploading"><div className="spinner small" /><span className="muted small">Uploading…</span></div>}
          </div>
          {drag && <div className="drop-hint">Drop files to attach them</div>}
        </>
      )}
      {preview && (
        <Modal onClose={() => setPreview(null)} width={900} className="preview-modal">
          <div className="modal-header"><h2 className="truncate">{preview.filename}</h2><div><a className="btn" href={api.attachmentUrl(preview.id)} download><Icon name="download" size={14} />Download</a><button className="icon-btn" onClick={() => setPreview(null)}><Icon name="close" size={18} /></button></div></div>
          <div className="preview-body"><img src={api.attachmentUrl(preview.id, true)} alt={preview.filename} /></div>
          <div className="modal-footer muted small">Uploaded by {userById[preview.uploaderId]?.name || 'someone'} · {fmtDateTime(preview.created)}</div>
        </Modal>
      )}
    </div>
  )
}

/* ================= Linked work items ================= */
function Links({ issue, onOpen, reload, canLink = true }) {
  const { meta, toast, userById } = useApp()
  const [adding, setAdding] = useState(false)
  const [type, setType] = useState('blocks:outward')
  const [target, setTarget] = useState(null)
  const groups = {}
  issue.links.forEach((l) => { (groups[l.label] ||= []).push(l) })
  const add = async () => {
    if (!target) return
    const [t, dir] = type.split(':')
    try { await api.addLink(issue.key, t, target.key, dir); setAdding(false); setTarget(null); reload() } catch (e) { toast({ title: 'Couldn’t link', description: e.message, error: true }) }
  }
  const options = meta.linkTypes.flatMap((lt) => (lt.outward === lt.inward ? [[`${lt.id}:outward`, lt.outward]] : [[`${lt.id}:outward`, lt.outward], [`${lt.id}:inward`, lt.inward]]))
  return (
    <div className="links">
      <button id="link-add" hidden onClick={() => canLink && setAdding(true)} />
      {(issue.links.length > 0 || adding) && (
        <div className="children-head">
          <h3 className="section-title">Linked work items</h3>
          {canLink && <button className="icon-btn small" title="Add link" onClick={() => setAdding(true)}><Icon name="plus" size={16} /></button>}
        </div>
      )}
      {adding && (
        <div className="link-form">
          <select className="text-input select" value={type} onChange={(e) => setType(e.target.value)}>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <IssueSearch exclude={[issue.key]} value={target} onChange={setTarget} />
          <button className="btn primary" disabled={!target} onClick={add}>Link</button>
          <button className="btn subtle" onClick={() => { setAdding(false); setTarget(null) }}>Cancel</button>
        </div>
      )}
      {Object.entries(groups).map(([label, items]) => (
        <div key={label} className="link-group">
          <div className="link-label">{label}</div>
          <div className="child-list">
            {items.map((l) => (
              <div key={`${l.id}${l.direction}`} className="child-row" onClick={() => onOpen(l.key)}>
                <TypeIcon type={l.issueType} />
                <span className={`issue-key ${l.status === 'Done' ? 'done' : ''}`}>{l.key}</span>
                <span className="child-summary truncate">{l.summary}</span>
                <PriorityIcon priority={l.priority} />
                <Avatar user={userById[l.assigneeId]} size={22} />
                <Lozenge status={l.status} />
                {canLink && <button className="icon-btn small" title="Remove link" onClick={async (e) => { e.stopPropagation(); await api.removeLink(l.id); reload() }}><Icon name="close" size={14} /></button>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function IssueSearch({ value, onChange, exclude = [], placeholder = 'Search for work items' }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [open, setOpen] = useState(false)
  const anchor = React.useRef(null)
  useEffect(() => {
    const t = setTimeout(() => {
      const p = q.trim() ? api.quicksearch(q.trim()).then((r) => r.issues) : api.search(`project = ${getProject()} ORDER BY updated DESC`, { maxResults: 8 }).then((r) => r.issues)
      p.then((list) => setRes(list.filter((i) => !exclude.includes(i.key)))).catch(() => {})
    }, 150)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line
  return (
    <div className="issue-search" ref={anchor}>
      {value ? (
        <button className="fake-select" onClick={() => { onChange(null); setOpen(true) }}><TypeIcon type={value.type} />{value.key} {value.summary}<Icon name="close" size={14} className="chev" /></button>
      ) : (
        <input className="text-input" autoFocus placeholder={placeholder} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} />
      )}
      <Popover anchor={anchor.current} open={open && !value} onClose={() => setOpen(false)} minWidth={360}>
        <div className="menu scroll">
          {!res.length && <div className="menu-empty">No work items found</div>}
          {res.map((i) => (
            <button key={i.key} className="menu-item" onClick={() => { onChange(i); setOpen(false); setQ('') }}>
              <TypeIcon type={i.type} /><span className="menu-item-label">{i.summary}<span className="menu-sub">{i.key} · {i.status}</span></span>
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
}

/* ================= Development ================= */
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

function Development({ issue, reload, onOpenCode }) {
  const { meta, toast } = useApp()
  const [mode, setMode] = useState(null) // 'branch' | 'pr'
  const [repo, setRepo] = useState(meta.repos[0] || 'client-portal')
  const [name, setName] = useState('')
  const branches = issue.development.filter((d) => d.kind === 'branch')
  const commits = issue.development.filter((d) => d.kind === 'commit')
  const prs = issue.development.filter((d) => d.kind === 'pr')
  const start = (m) => { setMode(m); setName(m === 'branch' ? `${issue.key}-${slug(issue.summary)}` : `${issue.key}: ${issue.summary}`) }
  const create = async (e) => {
    e.preventDefault()
    try {
      await api.addDev(issue.key, { kind: mode, repo, name })
      if (mode === 'branch') navigator.clipboard?.writeText(`git checkout -b ${name}`)
      toast(mode === 'branch' ? 'Branch created. The checkout command was copied to your clipboard.' : 'Pull request created')
      setMode(null); reload()
    } catch (e2) { toast({ title: 'Failed', description: e2.message, error: true }) }
  }
  return (
    <div className="side-panel">
      <div className="side-panel-head">Development</div>
      {issue.development.length === 0 && !mode && <div className="muted small dev-empty">No branches, commits or pull requests yet.</div>}
      {branches.length > 0 && <button className="dev-row" onClick={onOpenCode}><Icon name="branch" size={14} />{branches.length} branch{branches.length > 1 ? 'es' : ''}</button>}
      {commits.length > 0 && <button className="dev-row" onClick={onOpenCode}><Icon name="commit" size={14} />{commits.length} commit{commits.length > 1 ? 's' : ''}<span className="muted small">· latest {timeAgo(commits[0].created)}</span></button>}
      {prs.map((p) => (
        <button key={p.id} className="dev-row" onClick={onOpenCode}><Icon name="pr" size={14} /><span className="truncate">#{p.ref} {p.name}</span><span className={`pr-status ${p.status}`}>{p.status}</span></button>
      ))}
      {mode ? (
        <form className="dev-form" onSubmit={create}>
          <label className="field-title">Repository</label>
          <input className="text-input" list="repo-list" value={repo} onChange={(e) => setRepo(e.target.value)} required />
          <datalist id="repo-list">{meta.repos.map((r) => <option key={r} value={r} />)}</datalist>
          <label className="field-title">{mode === 'branch' ? 'Branch name' : 'Pull request title'}</label>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="editor-actions"><button className="btn primary small">Create</button><button type="button" className="btn subtle small" onClick={() => setMode(null)}>Cancel</button></div>
        </form>
      ) : (
        <div className="dev-actions">
          <button className="btn small" onClick={() => start('branch')}><Icon name="branch" size={14} />Create branch</button>
          <button className="btn small" onClick={() => start('pr')}><Icon name="pr" size={14} />Create PR</button>
        </div>
      )}
    </div>
  )
}

export const GOAL_STATUS_LABEL = { pending: 'Pending', on_track: 'On track', at_risk: 'At risk', off_track: 'Off track', done: 'Done', cancelled: 'Cancelled' }
export function GoalStatus({ status }) {
  return <span className={`goal-status ${status}`}>{GOAL_STATUS_LABEL[status] || status}</span>
}
