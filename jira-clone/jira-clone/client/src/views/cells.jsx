// Inline-editable cells shared by list view & issue view
import React, { useState } from 'react'
import { Icon, TypeIcon, PriorityIcon } from '../icons.jsx'
import { Avatar, Dropdown, LabelsEditor, PrioritySelect, SearchList, TypeSelect, UserPicker, fmtDate, isOverdue } from '../components/ui.jsx'
import { useApp } from '../ctx.js'

export function TypeCell({ issue, onChange }) {
  const { meta } = useApp()
  return (
    <TypeSelect value={issue.type} types={meta.types} onChange={(type) => onChange({ type })}
      trigger={({ ref, toggle }) => (
        <button ref={ref} className="cell-btn type-btn" title={`${issue.type} — click to change`} onClick={(e) => { e.stopPropagation(); toggle() }}>
          <TypeIcon type={issue.type} />
        </button>
      )} />
  )
}

export function UserCell({ userId, onChange, allowUnassigned = true, label = 'Unassigned' }) {
  const { activeUsers, userById, meta } = useApp()
  const u = userById[userId]
  return (
    <UserPicker users={activeUsers} value={userId ?? null} currentUserId={meta.currentUserId} allowUnassigned={allowUnassigned} onChange={onChange}
      trigger={({ ref, toggle, open }) => (
        <button ref={ref} className={`cell-btn user-btn ${open ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); toggle() }}>
          <Avatar user={u} size={24} />
          <span className={`truncate ${u ? '' : 'muted'}`}>{u ? u.name : label}</span>
        </button>
      )} />
  )
}

export function PriorityCell({ issue, onChange }) {
  const { meta } = useApp()
  return (
    <PrioritySelect value={issue.priority} priorities={meta.priorities} onChange={(priority) => onChange({ priority })}
      trigger={({ ref, toggle, open }) => (
        <button ref={ref} className={`cell-btn ${open ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); toggle() }}>
          <PriorityIcon priority={issue.priority} /><span className="truncate">{issue.priority}</span>
        </button>
      )} />
  )
}

export function DateCell({ value, onChange, overdue, placeholder = 'None' }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <input type="date" className="inline-input date-input" autoFocus defaultValue={value || ''}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => { setEditing(false); if ((e.target.value || null) !== (value || null)) onChange(e.target.value || null) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur()
          if (e.key === 'Escape') { e.stopPropagation(); setEditing(false) }
        }} />
    )
  }
  return (
    <button className={`cell-btn ${overdue ? 'overdue' : ''}`} onClick={(e) => { e.stopPropagation(); setEditing(true) }} title={overdue ? 'Overdue' : undefined}>
      {value ? (<>{overdue && <Icon name="warning" size={14} strokeWidth={2.2} />}<span>{fmtDate(value)}</span></>) : <span className="muted hover-only">{placeholder}</span>}
    </button>
  )
}

export function DueCell({ issue, onChange }) {
  return <DateCell value={issue.dueDate} overdue={isOverdue(issue)} onChange={(dueDate) => onChange({ dueDate })} />
}

export function LabelsCell({ issue, onChange, max = 2 }) {
  const { meta, refreshMeta } = useApp()
  const [pending, setPending] = useState(null)
  return (
    <Dropdown minWidth={260} onOpenChange={(open) => {
      if (!open && pending) { onChange({ labels: pending }); setPending(null); if (pending.some((l) => !meta.labels.includes(l))) setTimeout(refreshMeta, 300) }
    }}
      trigger={({ ref, toggle, open }) => (
        <button ref={ref} className={`cell-btn labels-btn ${open ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); toggle() }}>
          {issue.labels.length ? (
            <>
              {issue.labels.slice(0, max).map((l) => <span key={l} className="label-chip">{l}</span>)}
              {issue.labels.length > max && <span className="label-more">+{issue.labels.length - max}</span>}
            </>
          ) : <span className="muted hover-only">None</span>}
        </button>
      )}>
      {(close) => <LabelsEditor value={issue.labels} allLabels={meta.labels} onChange={setPending} onDone={close} />}
    </Dropdown>
  )
}

export function ParentPicker({ issue, candidates, onChange, trigger }) {
  const options = [
    { value: null, label: 'None', search: 'none' },
    ...candidates.filter((c) => c.key !== issue.key).map((c) => ({ value: c.key, label: `${c.key} ${c.summary}`, issue: c })),
  ]
  return (
    <Dropdown minWidth={320} trigger={trigger}>
      {(close) => (
        <SearchList placeholder="Search parents" options={options} value={issue.parent?.key ?? null}
          onSelect={(v) => { close(); if (v !== (issue.parent?.key ?? null)) onChange({ parentKey: v }) }}
          renderOption={(o) => o.issue ? (<><TypeIcon type={o.issue.type} /><span className="menu-item-label"><span className="muted">{o.issue.key}</span> {o.issue.summary}</span></>) : <span className="menu-item-label muted">None</span>} />
      )}
    </Dropdown>
  )
}

export function ParentCell({ issue, candidates, onChange, onOpen }) {
  return (
    <ParentPicker issue={issue} candidates={candidates} onChange={onChange}
      trigger={({ ref, toggle, open }) => (
        <button ref={ref} className={`cell-btn ${open ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); toggle() }}>
          {issue.parent ? (
            <span className="parent-chip" onClick={(e) => { if (e.metaKey || e.ctrlKey) { e.stopPropagation(); onOpen(issue.parent.key) } }}>
              <TypeIcon type={issue.parent.type} size={14} /><span className="truncate">{issue.parent.summary}</span>
            </span>
          ) : <span className="muted hover-only">None</span>}
        </button>
      )} />
  )
}

export function NumberCell({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <input type="number" min="0" step="0.5" className="inline-input" autoFocus defaultValue={value ?? ''}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => { setEditing(false); const v = e.target.value === '' ? null : Number(e.target.value); if (v !== value) onChange(v) }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.stopPropagation(); setEditing(false) } }} />
    )
  }
  return <button className="cell-btn" onClick={(e) => { e.stopPropagation(); setEditing(true) }}>{value ?? <span className="muted hover-only">None</span>}</button>
}

export function VersionCell({ value, onChange }) {
  const { meta } = useApp()
  const versions = meta.versions || []
  const options = [{ value: null, label: 'None', search: 'none' }, ...versions.map((v) => ({ value: v.name, label: `${v.name}${v.status === 'released' ? ' (released)' : ''}`, search: v.name }))]
  return (
    <Dropdown minWidth={220} trigger={({ ref, toggle, open }) => (
      <button ref={ref} className={`cell-btn ${open ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); toggle() }}>
        {value ? <span className="version-chip">{value}</span> : <span className="muted hover-only">None</span>}
      </button>
    )}>
      {(close) => <SearchList placeholder="Search versions" emptyText="No versions. Create one in Releases." options={options} value={value ?? null} onSelect={(v) => { close(); if (v !== value) onChange(v) }} />}
    </Dropdown>
  )
}

export function SprintCell({ value, onChange }) {
  const { meta } = useApp()
  const options = [{ value: null, label: 'None', search: 'none' }, ...meta.sprints.map((s) => ({ value: s, label: s }))]
  return (
    <Dropdown minWidth={220} trigger={({ ref, toggle, open }) => (
      <button ref={ref} className={`cell-btn ${open ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); toggle() }}>
        {value ? <span className="truncate">{value}</span> : <span className="muted hover-only">None</span>}
      </button>
    )}>
      {(close) => <SearchList placeholder="Search sprints" options={options} value={value ?? null} onSelect={(v) => { close(); if (v !== value) onChange(v) }} />}
    </Dropdown>
  )
}
