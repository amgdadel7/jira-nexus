import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon, PriorityIcon } from '../icons.jsx'
import {
  Avatar, Confirm, Dropdown, InlineText, MenuItem, Modal, StatusSelect, TypeSelect, UserPicker, PrioritySelect,
  Lozenge, fmtDate, statusCategory, SkeletonRows,
} from '../components/ui.jsx'
import { flashIssue } from '../motion.js'
import { TypeCell, UserCell, PriorityCell, DueCell, LabelsCell, ParentCell, NumberCell, SprintCell, VersionCell } from './cells.jsx'
import {
  defaultJql, EMPTY_BASIC, RANK_FIELD, SORT_FIELDS, basicFilterCount, buildJql, buildWhere, parseBasic, parseSort, splitJql, withSort,
} from '../jql.js'

const COLUMNS = [
  { id: 'type', label: 'Type', width: 76, min: 60 },
  { id: 'key', label: 'Key', width: 96, min: 72 },
  { id: 'summary', label: 'Summary', width: 380, min: 160, required: true },
  { id: 'status', label: 'Status', width: 140, min: 100 },
  { id: 'comments', label: 'Comments', width: 140, min: 100 },
  { id: 'assignee', label: 'Assignee', width: 190, min: 120 },
  { id: 'dueDate', label: 'Due date', width: 136, min: 100 },
  { id: 'priority', label: 'Priority', width: 120, min: 90 },
  { id: 'labels', label: 'Labels', width: 200, min: 100 },
  { id: 'parent', label: 'Parent', width: 220, min: 120 },
  { id: 'created', label: 'Created', width: 130, min: 100 },
  { id: 'updated', label: 'Updated', width: 130, min: 100 },
  { id: 'reporter', label: 'Reporter', width: 190, min: 120 },
  { id: 'storyPoints', label: 'Story point estimate', width: 150, min: 90 },
  { id: 'sprint', label: 'Sprint', width: 150, min: 100 },
  { id: 'fixVersion', label: 'Fix versions', width: 120, min: 90 },
]
const DEFAULT_VISIBLE = ['type', 'key', 'summary', 'status', 'comments', 'assignee', 'dueDate', 'priority', 'labels', 'created', 'updated', 'reporter']
const GROUPS = [
  { id: 'none', label: 'None' }, { id: 'status', label: 'Status' }, { id: 'assignee', label: 'Assignee' },
  { id: 'priority', label: 'Priority' }, { id: 'type', label: 'Work type' }, { id: 'parent', label: 'Parent' },
]

function useStored(key, initial) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial } catch { return initial } })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(v)) }, [key, v])
  return [v, setV]
}

export default function ListView({ jql, setJql }) {
  const { meta, users, userById, refreshKey, openIssue, toast, refreshMeta, bump, can, canIn } = useApp()
  const [data, setData] = useState({ issues: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mode, setMode] = useStored('jc.mode', 'basic')
  const [visible, setVisible] = useStored('jc.columns', DEFAULT_VISIBLE)
  const [widths, setWidths] = useStored('jc.widths', {})
  const [groupBy, setGroupBy] = useStored('jc.groupBy', 'none')
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [selected, setSelected] = useState(() => new Set())
  const [confirm, setConfirm] = useState(null)
  const [epics, setEpics] = useState([])

  const parsedBasic = useMemo(() => parseBasic(jql, users), [jql, users])
  const isCustom = parsedBasic === null || splitJql(jql).where !== buildWhere(parsedBasic, users)
  const basic = parsedBasic || EMPTY_BASIC
  const sort = parseSort(jql)
  const rankSorted = (sort.field.toLowerCase() === RANK_FIELD || sort.field.toLowerCase() === 'rank') && sort.dir === 'ASC'

  // ----- fetching -----
  const reqId = useRef(0)
  const load = useCallback(() => {
    const id = ++reqId.current
    setLoading(true)
    api.search(jql)
      .then((d) => { if (id === reqId.current) { setData(d); setError(null) } })
      .catch((e) => { if (id === reqId.current) { setError(e.message); setData({ issues: [], total: 0 }) } })
      .finally(() => { if (id === reqId.current) setLoading(false) })
  }, [jql])
  useEffect(() => { load() }, [load, refreshKey])
  useEffect(() => { api.search(`project = ${getProject()} AND type = Epic ORDER BY cf[10019] ASC`).then((d) => setEpics(d.issues)).catch(() => {}) }, [refreshKey])
  useEffect(() => { setSelected(new Set()) }, [jql])

  // ----- mutations -----
  const patchIssue = useCallback(async (key, fields) => {
    setData((d) => ({ ...d, issues: d.issues.map((i) => (i.key === key ? optimistic(i, fields, userById) : i)) }))
    try {
      const updated = await api.update(key, fields)
      setData((d) => ({ ...d, issues: d.issues.map((i) => (i.key === key ? updated : i)) }))
      if (fields.labels) refreshMeta()
      if (fields.type === 'Epic' || fields.summary) setEpics((e) => (fields.type === 'Epic' ? [...e, updated] : e.map((x) => (x.key === key ? updated : x))))
    } catch (e) {
      toast({ title: `Couldn’t update ${key}`, description: e.message, error: true })
      load()
    }
  }, [userById, toast, load, refreshMeta])

  const createIssue = useCallback(async (fields) => {
    try {
      const issue = await api.create(fields)
      setData((d) => ({ ...d, total: d.total + 1, issues: [...d.issues, issue] }))
      toast({ title: `${issue.key} has been created`, action: { label: 'View work item', onClick: () => openIssue(issue.key) } })
      flashIssue(issue.key)
      return issue
    } catch (e) {
      toast({ title: 'Couldn’t create work item', description: e.message, error: true })
      return null
    }
  }, [toast, openIssue])

  const removeIssues = useCallback(async (keys) => {
    try {
      if (keys.length === 1) await api.remove(keys[0]); else await api.bulk({ keys, action: 'delete' })
      setData((d) => ({ ...d, total: d.total - keys.length, issues: d.issues.filter((i) => !keys.includes(i.key)) }))
      setSelected(new Set())
      toast({ title: keys.length === 1 ? `${keys[0]} moved to the recycle bin` : `${keys.length} work items moved to the recycle bin`, description: 'Restore them from Project settings → Recycle bin within 30 days.',
        action: keys.length === 1 ? { label: 'Undo', onClick: async () => { const bin = await api.trash(keys[0].split('-')[0]).catch(() => null); const e = bin?.items.find((x) => x.key === keys[0]); if (e) { await api.restoreTrash(e.id); toast(`${keys[0]} restored`); bump() } } } : undefined })
      bump()
    } catch (e) { toast({ title: 'Delete failed', description: e.message, error: true }) }
  }, [toast, bump])

  const bulkUpdate = useCallback(async (changes) => {
    const keys = [...selected]
    setData((d) => ({ ...d, issues: d.issues.map((i) => (selected.has(i.key) ? optimistic(i, changes, userById) : i)) }))
    try { await api.bulk({ keys, changes }); toast(`${keys.length} work item${keys.length > 1 ? 's' : ''} updated`); load() } catch (e) { toast({ title: 'Bulk update failed', description: e.message, error: true }); load() }
  }, [selected, userById, toast, load])

  // ----- rank (drag & drop) -----
  const [drag, setDrag] = useState(null) // { key }
  const [drop, setDrop] = useState(null) // { key, pos: 'before'|'after', group }
  const doDrop = async (targetKey, pos, targetGroup) => {
    const key = drag?.key
    setDrag(null); setDrop(null)
    if (!key || key === targetKey) return
    setData((d) => {
      const list = d.issues.filter((i) => i.key !== key)
      const moved = d.issues.find((i) => i.key === key)
      const idx = list.findIndex((i) => i.key === targetKey)
      list.splice(pos === 'before' ? idx : idx + 1, 0, moved)
      return { ...d, issues: list }
    })
    try {
      await api.rank(key, pos === 'before' ? { beforeKey: targetKey } : { afterKey: targetKey })
      flashIssue(key)
      const src = data.issues.find((i) => i.key === key)
      if (targetGroup && src && groupValue(src, groupBy) !== targetGroup.id && targetGroup.defaults) await patchIssue(key, targetGroup.defaults)
    } catch (e) { toast({ title: 'Couldn’t move work item', description: e.message, error: true }); load() }
  }

  // ----- basic filters -----
  const updateBasic = (patch) => setJql(buildJql({ ...basic, ...patch }, users, jql), { replace: false })
  const [searchText, setSearchText] = useState(basic.search)
  useEffect(() => { setSearchText(basic.search) }, [basic.search])
  const searchTimer = useRef(null)
  const onSearchChange = (v) => {
    setSearchText(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setJql(buildJql({ ...basic, search: v }, users, jql), { replace: true }), 350)
  }
  const toggleIn = (field, value) => {
    const arr = basic[field]
    updateBasic({ [field]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] })
  }

  const onSort = (colId) => {
    const field = SORT_FIELDS[colId]
    if (!field) return
    const same = sort.field.toLowerCase() === field.toLowerCase()
    if (!same) setJql(withSort(jql, field, 'ASC'))
    else if (sort.dir === 'ASC') setJql(withSort(jql, field, 'DESC'))
    else setJql(withSort(jql, RANK_FIELD, 'ASC'))
  }

  // ----- groups -----
  const groups = useMemo(() => buildGroups(data.issues, groupBy, meta, userById, epics), [data.issues, groupBy, meta, userById, epics])
  const cols = COLUMNS.filter((c) => visible.includes(c.id))
  const colWidth = (c) => widths[c.id] || c.width
  const tableWidth = 48 + cols.reduce((s, c) => s + colWidth(c), 0)

  const allKeys = data.issues.map((i) => i.key)
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k))
  const toggleSel = (key) => setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  const exportCsv = () => {
    const header = cols.map((c) => c.label)
    const rows = data.issues.map((i) => cols.map((c) => csvValue(i, c.id, userById)))
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `Masar-${getProject()}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="list-view">
      <h1 className="sr-only">List - {meta.project.name}</h1>
      <Toolbar
        mode={mode} setMode={setMode} jql={jql} setJql={setJql} error={error} isCustom={isCustom}
        basic={basic} searchText={searchText} onSearchChange={onSearchChange} toggleIn={toggleIn}
        clearFilters={() => setJql(buildJql(EMPTY_BASIC, users, jql))}
        groupBy={groupBy} setGroupBy={setGroupBy} visible={visible} setVisible={setVisible}
        onExport={exportCsv} onResetColumns={() => { setVisible(DEFAULT_VISIBLE); setWidths({}) }}
      />

      <div className={`table-wrap ${loading ? 'is-loading' : ''}`}>
        {loading && <div className="loading-bar" />}
        <table className="issue-table" style={{ width: tableWidth }}>
          <colgroup>
            <col style={{ width: 48 }} />
            {cols.map((c) => <col key={c.id} style={{ width: colWidth(c) }} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="sel-col">
                <span className="sel-inner">
                  <input type="checkbox" aria-label="Select all" checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && selected.size > 0 }}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(allKeys))} />
                </span>
              </th>
              {cols.map((c) => {
                const sf = SORT_FIELDS[c.id]
                const active = sf && sort.field.toLowerCase() === sf.toLowerCase()
                return (
                  <th key={c.id} className={active ? 'sorted' : ''}>
                    <button className="th-btn" onClick={() => onSort(c.id)} title={`Sort by ${c.label}`}>
                      <span className="truncate">{c.label}</span>
                      {active ? <Icon name={sort.dir === 'ASC' ? 'arrowUp' : 'arrowDown'} size={14} strokeWidth={2.2} /> : <Icon name="sort" size={14} className="th-sort-hint" />}
                    </button>
                    <Resizer onResize={(w) => setWidths((ws) => ({ ...ws, [c.id]: Math.max(c.min, w) }))} start={colWidth(c)} />
                  </th>
                )
              })}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.id} className={drop?.group === g.id && !drop.key ? 'group-drop' : ''}>
              {groupBy !== 'none' && (
                <tr className="group-row" onClick={() => setCollapsed((s) => { const n = new Set(s); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })}
                  onDragOver={(e) => { if (drag) { e.preventDefault(); setDrop({ group: g.id }) } }}
                  onDrop={(e) => { e.preventDefault(); const last = g.issues[g.issues.length - 1] ?? data.issues[data.issues.length - 1]; if (last) doDrop(last.key, 'after', g) }}>
                  <td colSpan={cols.length + 1}>
                    <div className="group-header">
                      <span className={`lane-chevron ${collapsed.has(g.id) ? '' : 'open'}`}><Icon name="chevronRight" size={16} /></span>
                      {g.header}
                      <span className="group-count">{g.issues.length}</span>
                    </div>
                  </td>
                </tr>
              )}
              {!collapsed.has(g.id) && g.issues.map((issue) => (
                <Row
                  key={issue.key} issue={issue} cols={cols} selected={selected.has(issue.key)} onToggle={() => toggleSel(issue.key)}
                  onPatch={(f) => patchIssue(issue.key, f)} onOpen={openIssue} epics={epics}
                  canRank={rankSorted && canIn(issue.project, 'EDIT_ISSUES')} dragging={drag?.key === issue.key}
                  perm={(p) => canIn(issue.project, p)}
                  dropPos={drop?.key === issue.key ? drop.pos : null}
                  onDragStart={() => setDrag({ key: issue.key })}
                  onDragEnd={() => { setDrag(null); setDrop(null) }}
                  onDragOverRow={(pos) => drag && setDrop({ key: issue.key, pos, group: g.id })}
                  onDropRow={(pos) => doDrop(issue.key, pos, g)}
                  onDelete={() => setConfirm({ keys: [issue.key] })}
                />
              ))}
              {!collapsed.has(g.id) && !error && can('CREATE_ISSUES') && (
                <InlineCreate colSpan={cols.length + 1} defaults={g.defaults || {}} onCreate={createIssue} label={groupBy !== 'none' ? 'Create' : 'Create'} />
              )}
            </tbody>
          ))}
        </table>
        {loading && !error && data.issues.length === 0 && <SkeletonRows rows={10} cols={Math.min(cols.length + 1, 9)} />}
        {!loading && !error && data.issues.length === 0 && (
          <div className="empty-state">
            <EmptyArt />
            <h3>No work items match your search</h3>
            <p>Try changing your filters or search terms.</p>
            <button className="btn" onClick={() => setJql(defaultJql())}>Clear filters</button>
          </div>
        )}
        {error && (
          <div className="empty-state">
            <EmptyArt />
            <h3>We couldn’t run your search</h3>
            <p className="error-text">{error}</p>
            <button className="btn" onClick={() => setJql(defaultJql())}>Reset to default query</button>
          </div>
        )}
      </div>
      <div className="list-footer">
        <span>{data.issues.length ? `1–${data.issues.length} of ${data.total}` : '0 work items'}</span>
        {!rankSorted && <span className="muted">· Drag to rank is available when sorted by Rank <button className="link" onClick={() => setJql(withSort(jql, RANK_FIELD, 'ASC'))}>Sort by rank</button></span>}
        <span className="spacer" />
        <button className="link small" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      {selected.size > 0 && (
        <BulkBar count={selected.size} onClear={() => setSelected(new Set())} onUpdate={bulkUpdate} onDelete={() => setConfirm({ keys: [...selected] })}
          canDelete={[...selected].every((k) => canIn(k.split('-')[0], 'DELETE_ISSUES'))} canEdit={[...selected].every((k) => canIn(k.split('-')[0], 'EDIT_ISSUES'))} />
      )}
      {confirm && (
        <Confirm
          title={confirm.keys.length === 1 ? `Delete ${confirm.keys[0]}?` : `Delete ${confirm.keys.length} work items?`}
          body="The selected work item(s), their sub-tasks, comments and attachments move to the recycle bin. You can restore them for 30 days." confirmLabel="Move to recycle bin"
          onConfirm={() => removeIssues(confirm.keys)} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}

/* ================= toolbar ================= */
function Toolbar({ mode, setMode, jql, setJql, error, isCustom, basic, searchText, onSearchChange, toggleIn, clearFilters, groupBy, setGroupBy, visible, setVisible, onExport, onResetColumns }) {
  const { activeUsers: users, meta, toast, bump, isAdmin, refreshFilters, navigate } = useApp()
  const [draft, setDraft] = useState(jql)
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(jql), [jql])
  const filterCount = basicFilterCount(basic)
  const disabled = isCustom

  return (
    <div className="toolbar-wrap">
      <div className="toolbar">
        {mode === 'jql' ? (
          <form className={`jql-box ${error ? 'has-error' : ''}`} onSubmit={(e) => { e.preventDefault(); setJql(draft.trim() || defaultJql()) }}>
            <span className="jql-tag">JQL</span>
            <textarea
              value={draft} spellCheck={false} rows={1} aria-label="JQL query"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setJql(draft.trim() || defaultJql()) } }}
            />
            <JqlHelp />
            <button type="submit" className="btn primary small" title="Search (Enter)"><Icon name="search" size={14} strokeWidth={2.2} /></button>
          </form>
        ) : (
          <>
            <label className="list-search">
              <Icon name="search" size={16} />
              <input value={searchText} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search list" aria-label="Search list" disabled={disabled} />
              {searchText && <button type="button" className="clear-search" onClick={() => onSearchChange('')} aria-label="Clear search"><Icon name="close" size={12} strokeWidth={2.4} /></button>}
            </label>
            <div className={`avatar-filter ${disabled ? 'disabled' : ''}`}>
              {users.map((u) => (
                <button key={u.id} className={`avatar-toggle ${basic.assignees.includes(u.id) ? 'on' : ''}`} title={u.name} onClick={() => !disabled && toggleIn('assignees', u.id)}>
                  <Avatar user={u} size={32} title={u.name} />
                </button>
              ))}
              <button className={`avatar-toggle ${basic.assignees.includes(null) ? 'on' : ''}`} title="Unassigned" onClick={() => !disabled && toggleIn('assignees', null)}>
                <Avatar user={null} size={32} />
              </button>
            </div>
            <Dropdown minWidth={300} trigger={({ ref, toggle, open }) => (
              <button ref={ref} className={`btn ${open ? 'selected' : ''} ${filterCount ? 'has-count' : ''}`} onClick={toggle} disabled={disabled}>
                <Icon name="filter" size={16} />Filter{filterCount > 0 && <span className="count-badge">{filterCount}</span>}
              </button>
            )}>
              <FilterPanel basic={basic} toggleIn={toggleIn} meta={meta} />
            </Dropdown>
            {(filterCount > 0 || basic.assignees.length > 0 || basic.search) && !disabled && (
              <button className="btn subtle" onClick={clearFilters}>Clear filters</button>
            )}
          </>
        )}
        <span className="spacer" />
        {jql !== defaultJql() && <button className="btn subtle" onClick={() => setSaving(true)}><Icon name="star" size={16} />Save filter</button>}
        <div className="segmented" role="group" aria-label="Search mode">
          <button className={mode === 'basic' ? 'on' : ''} onClick={() => setMode('basic')}>Basic</button>
          <button className={mode === 'jql' ? 'on' : ''} onClick={() => setMode('jql')}>JQL</button>
        </div>
        <Dropdown align="end" minWidth={200} trigger={({ ref, toggle, open }) => (
          <button ref={ref} className={`btn ${open ? 'selected' : ''} ${groupBy !== 'none' ? 'has-count' : ''}`} onClick={toggle}>
            <Icon name="group" size={16} />Group{groupBy !== 'none' && `: ${GROUPS.find((g) => g.id === groupBy)?.label}`}
          </button>
        )}>
          {(close) => (
            <div className="menu">
              <div className="menu-heading">Group by</div>
              {GROUPS.map((g) => <MenuItem key={g.id} selected={groupBy === g.id} onClick={() => { setGroupBy(g.id); close() }}>{g.label}</MenuItem>)}
            </div>
          )}
        </Dropdown>
        <Dropdown align="end" minWidth={240} trigger={({ ref, toggle, open }) => (
          <button ref={ref} className={`icon-btn bordered ${open ? 'selected' : ''}`} onClick={toggle} title="Columns"><Icon name="columns" size={16} /></button>
        )}>
          <div className="menu scroll tall">
            <div className="menu-heading">Columns</div>
            {COLUMNS.map((c) => (
              <label key={c.id} className={`menu-item check ${c.required ? 'disabled' : ''}`}>
                <input type="checkbox" checked={visible.includes(c.id)} disabled={c.required}
                  onChange={() => setVisible((v) => (v.includes(c.id) ? v.filter((x) => x !== c.id) : COLUMNS.filter((x) => v.includes(x.id) || x.id === c.id).map((x) => x.id)))} />
                <span className="menu-item-label">{c.label}</span>
              </label>
            ))}
            <div className="menu-sep" />
            <button className="menu-item" onClick={onResetColumns}><span className="menu-item-label">Restore default columns</span></button>
          </div>
        </Dropdown>
        <Dropdown align="end" minWidth={220} trigger={({ ref, toggle, open }) => (
          <button ref={ref} className={`icon-btn bordered ${open ? 'selected' : ''}`} onClick={toggle} title="More actions"><Icon name="more" size={16} /></button>
        )}>
          {(close) => (
            <div className="menu">
              <MenuItem icon={<Icon name="download" size={16} />} onClick={() => { close(); onExport() }}>Export CSV (current fields)</MenuItem>
              <MenuItem icon={<Icon name="link" size={16} />} onClick={() => { close(); navigator.clipboard?.writeText(window.location.href); toast('Link copied to clipboard') }}>Copy link to this view</MenuItem>
              <MenuItem icon={<Icon name="filter" size={16} />} onClick={() => { close(); navigate({ page: 'filters' }) }}>Manage saved filters</MenuItem>
              {isAdmin && <div className="menu-sep" />}
              {isAdmin && <MenuItem icon={<Icon name="refresh" size={16} />} onClick={async () => { close(); if (!window.confirm('Reset all data to the demo state?')) return; await api.reset(); bump(); toast('Demo data has been reset') }}>Reset demo data</MenuItem>}
            </div>
          )}
        </Dropdown>
      </div>
      {saving && <SaveFilterModal jql={jql} onClose={() => setSaving(false)} onSaved={(f) => { refreshFilters(); toast({ title: `Filter “${f.name}” saved`, description: 'Find it under Filters in the sidebar.' }) }} />}
      {mode === 'jql' && error && <div className="jql-error"><Icon name="warning" size={14} strokeWidth={2.2} />{error}</div>}
      {mode === 'basic' && isCustom && (
        <div className="jql-note">
          <Icon name="info" size={14} strokeWidth={2.2} />
          <span>This list is filtered by a JQL query that can’t be shown in basic mode: <code>{splitJql(jql).where}</code></span>
          <button className="link" onClick={() => setMode('jql')}>Edit JQL</button>
          <button className="link" onClick={() => setJql(withSort(defaultJql(), ...Object.values(parseSort(jql))))}>Clear</button>
        </div>
      )}
    </div>
  )
}

function SaveFilterModal({ jql, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [starred, setStarred] = useState(true)
  const [err, setErr] = useState(null)
  const save = async (e) => {
    e.preventDefault()
    try { const f = await api.createFilter({ name, description, jql, starred }); onSaved(f); onClose() } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal onClose={onClose} width={520}>
      <form onSubmit={save}>
        <div className="modal-header"><h2>Save filter</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body">
          <div className="field"><label className="field-title">Name <span className="req">*</span></label><input className="text-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></div>
          <div className="field"><label className="field-title">Description</label><input className="text-input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="field"><label className="field-title">JQL</label><code className="jql-preview">{jql}</code></div>
          <label className="check-label" style={{ marginTop: 12 }}><input type="checkbox" checked={starred} onChange={(e) => setStarred(e.target.checked)} />Add to starred</label>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!name.trim()}>Save</button></div>
      </form>
    </Modal>
  )
}

function FilterPanel({ basic, toggleIn, meta }) {
  const sections = [
    { field: 'types', label: 'Work type', options: meta.types, icon: (t) => <TypeIcon type={t} /> },
    { field: 'statuses', label: 'Status', options: meta.statuses, icon: null, render: (s) => <Lozenge status={s} /> },
    { field: 'priorities', label: 'Priority', options: meta.priorities, icon: (p) => <PriorityIcon priority={p} /> },
    { field: 'labels', label: 'Labels', options: meta.labels, icon: null },
  ]
  const [tab, setTab] = useState('types')
  const sec = sections.find((s) => s.field === tab)
  return (
    <div className="filter-panel">
      <div className="filter-tabs">
        {sections.map((s) => (
          <button key={s.field} className={`filter-tab ${tab === s.field ? 'on' : ''}`} onClick={() => setTab(s.field)}>
            {s.label}{basic[s.field].length > 0 && <span className="count-badge">{basic[s.field].length}</span>}
          </button>
        ))}
      </div>
      <div className="filter-options">
        {sec.options.length === 0 && <div className="menu-empty">No options</div>}
        {sec.options.map((o) => (
          <label key={o} className="menu-item check">
            <input type="checkbox" checked={basic[sec.field].includes(o)} onChange={() => toggleIn(sec.field, o)} />
            {sec.icon?.(o)}
            <span className="menu-item-label">{sec.render ? sec.render(o) : o}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function JqlHelp() {
  return (
    <Dropdown align="end" minWidth={380} trigger={({ ref, toggle }) => (
      <button type="button" ref={ref} className="icon-btn small" title="JQL syntax help" onClick={toggle}><Icon name="help" size={16} /></button>
    )}>
      <div className="jql-help">
        <h4>JQL quick reference</h4>
        <p><b>Fields:</b> project, key, summary, description, text, status, type, priority, assignee, reporter, labels, parent, sprint, fixVersion, created, updated, duedate, resolved, "Story Points", comment, cf[10019] (Rank)</p>
        <p><b>Operators:</b> = != ~ !~ &gt; &gt;= &lt; &lt;= IN, NOT IN, IS EMPTY, IS NOT EMPTY, AND, OR, NOT, ( )</p>
        <p><b>Functions:</b> currentUser(), now(), startOfDay(), startOfWeek(), startOfMonth(); relative dates like -7d, -2w</p>
        <p className="muted">Examples:</p>
        <code>assignee = currentUser() AND status != Done</code>
        <code>labels in (payments, infra) ORDER BY priority DESC</code>
        <code>created &gt;= -7d OR duedate &lt; now() ORDER BY duedate ASC</code>
        <code>parent = KAN-1 AND assignee IS EMPTY</code>
      </div>
    </Dropdown>
  )
}

/* ================= rows ================= */
function Row({ issue, cols, selected, onToggle, onPatch, onOpen, epics, canRank, dragging, dropPos, onDragStart, onDragEnd, onDragOverRow, onDropRow, onDelete, perm = () => true }) {
  const [armed, setArmed] = useState(false)
  const posFromEvent = (e) => { const r = e.currentTarget.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 ? 'before' : 'after' }
  return (
    <tr
      data-issue-key={issue.key}
      className={`issue-row ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''} ${dropPos ? `drop-${dropPos}` : ''} ${issue.status === 'Done' ? 'is-done' : ''}`}
      draggable={armed}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', issue.key); onDragStart() }}
      onDragEnd={() => { setArmed(false); onDragEnd() }}
      onDragOver={(e) => { e.preventDefault(); onDragOverRow(posFromEvent(e)) }}
      onDrop={(e) => { e.preventDefault(); setArmed(false); onDropRow(posFromEvent(e)) }}
    >
      <td className="sel-col">
        <span className="sel-inner">
          {canRank && (
            <span className="drag-handle" title="Drag to rank" onMouseDown={() => setArmed(true)} onMouseUp={() => setArmed(false)}>
              <Icon name="drag" size={14} />
            </span>
          )}
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${issue.key}`} />
        </span>
      </td>
      {cols.map((c) => {
        const need = CELL_PERM[c.id]
        const cell = renderCell(c.id, issue, onPatch, onOpen, epics, perm('DELETE_ISSUES') ? onDelete : null, perm('EDIT_ISSUES'))
        return <td key={c.id} className={`col-${c.id}`}>{need && !perm(need) ? <fieldset className="plain-fieldset readonly-cell" disabled title="You don’t have permission to change this">{cell}</fieldset> : cell}</td>
      })}
    </tr>
  )
}

// which permission an inline cell edit needs (cells not listed are read-only or open the work item)
const CELL_PERM = { type: 'EDIT_ISSUES', status: 'TRANSITION_ISSUES', assignee: 'ASSIGN_ISSUES', reporter: 'EDIT_ISSUES', dueDate: 'EDIT_ISSUES', priority: 'EDIT_ISSUES', labels: 'EDIT_ISSUES', parent: 'EDIT_ISSUES', storyPoints: 'EDIT_ISSUES', sprint: 'EDIT_ISSUES', fixVersion: 'EDIT_ISSUES' }

function renderCell(id, issue, onPatch, onOpen, epics, onDelete, canEdit = true) {
  switch (id) {
    case 'type': return <TypeCell issue={issue} onChange={onPatch} />
    case 'key': return <a className={`issue-key ${issue.status === 'Done' ? 'done' : ''}`} href={`?selectedIssue=${issue.key}`} onClick={(e) => { e.preventDefault(); onOpen(issue.key) }}>{issue.key}</a>
    case 'summary': return <SummaryCell issue={issue} onPatch={onPatch} onOpen={onOpen} onDelete={onDelete} canEdit={canEdit} />
    case 'status': return <StatusCellWrap issue={issue} onPatch={onPatch} />
    case 'comments': return (
      <button className="cell-btn comments-btn" onClick={() => onOpen(issue.key)}>
        {issue.commentCount ? <><Icon name="comment" size={14} /><span>{issue.commentCount} comment{issue.commentCount > 1 ? 's' : ''}</span></> : <span className="muted hover-strong">Add comment</span>}
      </button>
    )
    case 'assignee': return <UserCell userId={issue.assigneeId} onChange={(assigneeId) => onPatch({ assigneeId })} />
    case 'reporter': return <UserCell userId={issue.reporterId} label="None" onChange={(reporterId) => onPatch({ reporterId })} />
    case 'dueDate': return <DueCell issue={issue} onChange={onPatch} />
    case 'priority': return <PriorityCell issue={issue} onChange={onPatch} />
    case 'labels': return <LabelsCell issue={issue} onChange={onPatch} />
    case 'parent': return <ParentCell issue={issue} candidates={epics} onChange={onPatch} onOpen={onOpen} />
    case 'created': return <span className="date-text" title={issue.created}>{fmtDate(issue.created)}</span>
    case 'updated': return <span className="date-text" title={issue.updated}>{fmtDate(issue.updated)}</span>
    case 'storyPoints': return <NumberCell value={issue.storyPoints} onChange={(storyPoints) => onPatch({ storyPoints })} />
    case 'sprint': return <SprintCell value={issue.sprint} onChange={(sprint) => onPatch({ sprint })} />
    case 'fixVersion': return <VersionCell value={issue.fixVersion} onChange={(fixVersion) => onPatch({ fixVersion })} />
    default: return null
  }
}

function StatusCellWrap({ issue, onPatch }) {
  const { meta } = useApp()
  return <StatusSelect value={issue.status} statuses={meta.statuses} onChange={(status) => onPatch({ status })} />
}

function SummaryCell({ issue, onPatch, onOpen, onDelete, canEdit = true }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="summary-cell">
      {editing ? (
        <EditSummary value={issue.summary} onDone={(v) => { setEditing(false); if (v && v !== issue.summary) onPatch({ summary: v }) }} />
      ) : (
        <>
          <button className="summary-text" onClick={() => onOpen(issue.key)} title={issue.summary}>{issue.summary}</button>
          {issue.childCount > 0 && <span className="child-chip" title={`${issue.childDone} of ${issue.childCount} child work items done`}>{issue.childDone}/{issue.childCount}</span>}
          <span className="row-actions">
            {canEdit && <button className="icon-btn small" title="Edit summary" onClick={() => setEditing(true)}><Icon name="edit" size={14} /></button>}
            <Dropdown align="end" minWidth={180} trigger={({ ref, toggle }) => (
              <button ref={ref} className="icon-btn small" title="More actions" onClick={toggle}><Icon name="more" size={14} /></button>
            )}>
              {(close) => (
                <div className="menu">
                  <MenuItem onClick={() => { close(); onOpen(issue.key) }}>Open work item</MenuItem>
                  <MenuItem onClick={() => { close(); navigator.clipboard?.writeText(`${window.location.origin}/browse/${issue.key}`) }}>Copy link</MenuItem>
                  <MenuItem onClick={() => { close(); navigator.clipboard?.writeText(issue.key) }}>Copy key</MenuItem>
                  {onDelete && <div className="menu-sep" />}
                  {onDelete && <MenuItem danger onClick={() => { close(); onDelete() }}>Delete</MenuItem>}
                </div>
              )}
            </Dropdown>
          </span>
        </>
      )}
    </div>
  )
}

function EditSummary({ value, onDone }) {
  const [v, setV] = useState(value)
  return (
    <input className="inline-input" autoFocus value={v} maxLength={255} onFocus={(e) => e.target.select()}
      onChange={(e) => setV(e.target.value)} onBlur={() => onDone(v.trim())}
      onKeyDown={(e) => { if (e.key === 'Enter') onDone(v.trim()); if (e.key === 'Escape') { e.stopPropagation(); onDone(null) } }} />
  )
}

function InlineCreate({ colSpan, defaults, onCreate }) {
  const { meta } = useApp()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState(defaults.type || 'Task')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const submit = async () => {
    if (!summary.trim() || busy) return
    setBusy(true)
    const ok = await onCreate({ ...defaults, type, summary: summary.trim() })
    setBusy(false)
    if (ok) { setSummary(''); inputRef.current?.focus() }
  }
  if (!open) {
    return (
      <tr className="create-row">
        <td colSpan={colSpan}>
          <button className="create-trigger" onClick={() => setOpen(true)}><Icon name="plus" size={16} />Create</button>
        </td>
      </tr>
    )
  }
  return (
    <tr className="create-row active">
      <td colSpan={colSpan}>
        <div className="inline-create">
          <TypeSelect value={type} types={meta.types} onChange={setType} trigger={({ ref, toggle }) => (
            <button ref={ref} className="cell-btn type-pick" onClick={toggle} title="Select work type"><TypeIcon type={type} /><Icon name="chevronDown" size={14} /></button>
          )} />
          <input ref={inputRef} autoFocus placeholder="What needs to be done?" value={summary} maxLength={255} disabled={busy}
            onChange={(e) => setSummary(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setOpen(false); setSummary('') } }}
            onBlur={(e) => { if (!summary.trim() && !e.relatedTarget?.closest?.('.inline-create')) setOpen(false) }} />
          <button className="btn primary small" disabled={!summary.trim() || busy} onClick={submit}>Create ↵</button>
        </div>
      </td>
    </tr>
  )
}

function BulkBar({ count, onClear, onUpdate, onDelete, canDelete = true, canEdit = true }) {
  const { meta, activeUsers: users } = useApp()
  return (
    <div className="bulk-bar" role="toolbar">
      <span className="bulk-count">{count} selected</span>
      <Dropdown minWidth={180} trigger={({ ref, toggle }) => <button ref={ref} className="btn dark" onClick={toggle}>Status<Icon name="chevronDown" size={14} /></button>}>
        {(close) => <div className="menu">{meta.statuses.map((s) => <MenuItem key={s} onClick={() => { close(); onUpdate({ status: s }) }}><Lozenge status={s} /></MenuItem>)}</div>}
      </Dropdown>
      <UserPicker users={users} value={undefined} currentUserId={meta.currentUserId} onChange={(assigneeId) => onUpdate({ assigneeId })}
        trigger={({ ref, toggle }) => <button ref={ref} className="btn dark" onClick={toggle}>Assignee<Icon name="chevronDown" size={14} /></button>} />
      <PrioritySelect value={undefined} priorities={meta.priorities} onChange={(priority) => onUpdate({ priority })}
        trigger={({ ref, toggle }) => <button ref={ref} className="btn dark" onClick={toggle}>Priority<Icon name="chevronDown" size={14} /></button>} />
      {!canEdit && <span className="bulk-note" title="Some selected work items are in projects where you can’t edit"><Icon name="lock" size={14} />Limited</span>}
      {canDelete && <button className="btn dark" onClick={onDelete}><Icon name="trash" size={14} />Delete</button>}
      <button className="icon-btn dark" onClick={onClear} title="Clear selection"><Icon name="close" size={16} /></button>
    </div>
  )
}

function Resizer({ onResize, start }) {
  const onMouseDown = (e) => {
    e.preventDefault(); e.stopPropagation()
    const x0 = e.clientX
    const move = (ev) => onResize(start + ev.clientX - x0)
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.body.classList.remove('resizing') }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
    document.body.classList.add('resizing')
  }
  return <span className="col-resizer" onMouseDown={onMouseDown} onClick={(e) => e.stopPropagation()} />
}

function EmptyArt() {
  return (
    <svg width="120" height="90" viewBox="0 0 120 90" aria-hidden="true">
      <rect x="18" y="14" width="70" height="60" rx="6" fill="#E9F2FF" />
      <rect x="28" y="28" width="40" height="5" rx="2.5" fill="#85B8FF" />
      <rect x="28" y="40" width="30" height="5" rx="2.5" fill="#CCE0FF" />
      <rect x="28" y="52" width="36" height="5" rx="2.5" fill="#CCE0FF" />
      <circle cx="82" cy="56" r="16" fill="none" stroke="#1868DB" strokeWidth="5" />
      <path d="m94 68 12 12" stroke="#1868DB" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

/* ================= helpers ================= */
function optimistic(issue, fields, userById) {
  const n = { ...issue }
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'parentKey') n.parent = v ? { key: v, summary: issue.parent?.key === v ? issue.parent.summary : v, type: 'Epic' } : null
    else n[k] = v
  }
  return n
}

function groupValue(issue, groupBy) {
  switch (groupBy) {
    case 'status': return issue.status
    case 'assignee': return issue.assigneeId || '__none'
    case 'priority': return issue.priority
    case 'type': return issue.type
    case 'parent': return issue.parent?.key || '__none'
    default: return 'all'
  }
}

function buildGroups(issues, groupBy, meta, userById, epics) {
  if (groupBy === 'none') return [{ id: 'all', issues, defaults: {} }]
  const map = new Map()
  issues.forEach((i) => { const k = groupValue(i, groupBy); if (!map.has(k)) map.set(k, []); map.get(k).push(i) })
  let order
  if (groupBy === 'status') order = meta.statuses
  else if (groupBy === 'priority') order = meta.priorities
  else if (groupBy === 'type') order = meta.types
  else if (groupBy === 'assignee') order = [...meta.users.map((u) => u.id), '__none']
  else order = [...epics.map((e) => e.key), ...[...map.keys()].filter((k) => k !== '__none' && !epics.some((e) => e.key === k)), '__none']
  return order.filter((k) => map.has(k)).map((k) => {
    let header; let defaults = {}
    if (groupBy === 'status') { header = <Lozenge status={k} />; defaults = { status: k } }
    else if (groupBy === 'priority') { header = <><PriorityIcon priority={k} /><span className="group-label">{k}</span></>; defaults = { priority: k } }
    else if (groupBy === 'type') { header = <><TypeIcon type={k} /><span className="group-label">{k}</span></>; defaults = { type: k } }
    else if (groupBy === 'assignee') {
      const u = userById[k]
      header = <><Avatar user={u} size={22} /><span className="group-label">{u ? u.name : 'Unassigned'}</span></>
      defaults = { assigneeId: u ? k : null }
    } else {
      const p = epics.find((e) => e.key === k) || map.get(k)?.[0]?.parent
      header = k === '__none' ? <span className="group-label muted">No parent</span> : <><TypeIcon type={p?.type || 'Epic'} /><span className="group-label"><span className="muted">{k}</span> {p?.summary}</span></>
      defaults = { parentKey: k === '__none' ? null : k }
    }
    return { id: k, header, issues: map.get(k), defaults }
  })
}

function csvValue(i, id, userById) {
  switch (id) {
    case 'assignee': return userById[i.assigneeId]?.name || ''
    case 'reporter': return userById[i.reporterId]?.name || ''
    case 'labels': return i.labels.join(' ')
    case 'parent': return i.parent?.key || ''
    case 'comments': return i.commentCount
    default: return i[id] ?? ''
  }
}
