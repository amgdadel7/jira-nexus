import React, { useEffect, useLayoutEffect, useRef, useState, createContext, useContext, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Icon, TypeIcon, PriorityIcon } from '../icons.jsx'
import { useExitGhost, useFlip, DUR } from '../motion.js'

/* ============ Popover / Dropdown ============ */
export function Popover({ anchor, open, onClose, children, align = 'start', width, minWidth = 200, className = '' }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    if (!open || !anchor) return
    const place = () => {
      const r = anchor.getBoundingClientRect()
      const el = ref.current
      const h = el ? el.offsetHeight : 300
      const w = el ? el.offsetWidth : (width || minWidth)
      let top = r.bottom + 4; let side = 'bottom'
      if (top + h > window.innerHeight - 8 && r.top - h - 4 > 8) { top = r.top - h - 4; side = 'top' }
      let left = align === 'end' ? r.right - w : r.left
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
      setPos((p) => (p && p.top === top && p.left === left && p.side === side ? p : { top, left, side }))
    }
    place()
    const id = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, anchor, align, width, minWidth])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return
      onClose?.()
    }
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true) }
  }, [open, anchor, onClose])

  if (!open) return null
  return createPortal(
    <PopoverPanel panelRef={ref} className={className} pos={pos} width={width} minWidth={minWidth}>{children}</PopoverPanel>,
    document.body,
  )
}

// Separate component so its unmount (popover closing) can play the ADS popup exit on a ghost copy.
function PopoverPanel({ panelRef, className, pos, width, minWidth, children }) {
  useExitGhost(panelRef, { className: 'popover-exit', duration: DUR.xshort })
  return (
    <div
      ref={panelRef}
      className={`popover ${className}`}
      data-placement={pos?.side || 'bottom'}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, minWidth, visibility: pos ? undefined : 'hidden' }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

/** Generic dropdown: renders trigger(button props) and a popover with children(close) */
export function Dropdown({ trigger, children, align, width, minWidth, className, onOpenChange }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const cbRef = useRef(onOpenChange)
  cbRef.current = onOpenChange
  const set = useCallback((v) => { setOpen(v); cbRef.current?.(v) }, [])
  const close = useCallback(() => set(false), [set])
  return (
    <>
      {trigger({ ref: anchorRef, open, toggle: () => set(!open), close })}
      <Popover anchor={anchorRef.current} open={open} onClose={close} align={align} width={width} minWidth={minWidth} className={className}>
        {typeof children === 'function' ? children(close) : children}
      </Popover>
    </>
  )
}

export function MenuItem({ children, onClick, selected, danger, icon, right, disabled }) {
  return (
    <button type="button" className={`menu-item ${selected ? 'selected' : ''} ${danger ? 'danger' : ''}`} onClick={onClick} disabled={disabled}>
      {icon}
      <span className="menu-item-label">{children}</span>
      {right}
    </button>
  )
}

/* ============ Avatar ============ */
export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}
export function Avatar({ user, size = 24, title }) {
  if (!user) {
    return (
      <span className="avatar unassigned" style={{ width: size, height: size }} title={title ?? 'Unassigned'}>
        <Icon name="user" size={size * 0.62} strokeWidth={2} />
      </span>
    )
  }
  if (user.bot) {
    return (
      <span className="avatar bot" style={{ width: size, height: size }} title={title ?? user.name}>
        <Icon name="robot" size={size * 0.66} strokeWidth={2} />
      </span>
    )
  }
  if (user.avatarUrl) {
    return (
      <span className="avatar photo" style={{ width: size, height: size }} title={title ?? user.name}>
        <img src={user.avatarUrl} alt="" draggable={false} />
      </span>
    )
  }
  return (
    <span className="avatar" style={{ width: size, height: size, background: user.color, fontSize: size * 0.4 }} title={title ?? user.name}>
      {initials(user.name)}
    </span>
  )
}

/* ============ Loading: ADS spinner + skeletons ============ */
export function Spinner({ size = 'medium', light = false, label = 'Loading' }) {
  return <div className={`spinner ${size === 'small' ? 'small' : size === 'large' ? 'large' : ''} ${light ? 'light' : ''}`} role="status" aria-label={label} />
}
export function Skeleton({ width = '100%', height = 12, radius = 3, style, circle = false }) {
  return <span className="skeleton" style={{ width: circle ? height : width, height, borderRadius: circle ? '50%' : radius, ...style }} />
}
/** List view placeholder rows (Jira shows shimmering rows while the table loads). */
export function SkeletonRows({ rows = 8, cols = 7 }) {
  const widths = [18, 64, 220, 90, 110, 80, 100, 70, 60]
  return (
    <div className="skeleton-table" aria-busy="true" aria-label="Loading work items">
      {Array.from({ length: rows }, (_, r) => (
        <div className="skeleton-row" key={r} style={{ animationDelay: `${r * 40}ms` }}>
          {Array.from({ length: cols }, (_, c) => (
            <span key={c} className="skeleton-cell" style={{ flex: c === 2 ? 1 : 'none' }}>
              {c === 4 ? <><Skeleton circle height={20} /> <Skeleton width={70} /></> : <Skeleton width={c === 2 ? `${60 + ((r * 13) % 30)}%` : widths[c]} />}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
export function SkeletonBoard({ columns = 4 }) {
  return (
    <div className="skeleton-board" aria-busy="true" aria-label="Loading board">
      {Array.from({ length: columns }, (_, c) => (
        <div className="skeleton-col" key={c}>
          <Skeleton width={90} height={10} style={{ margin: '6px 4px 12px' }} />
          {Array.from({ length: 3 - (c % 2) }, (_, i) => (
            <div className="skeleton-card" key={i}>
              <Skeleton width={`${70 + ((c + i) * 7) % 25}%`} />
              <Skeleton width="45%" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Skeleton width={56} height={10} /><Skeleton circle height={22} /></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
export function SkeletonIssue() {
  return (
    <div className="skeleton-issue" aria-busy="true" aria-label="Loading work item">
      <div className="skeleton-issue-main">
        <Skeleton width={140} height={12} />
        <Skeleton width="80%" height={24} style={{ marginTop: 18 }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}><Skeleton width={80} height={28} radius={4} /><Skeleton width={80} height={28} radius={4} /></div>
        <Skeleton width={90} height={12} style={{ marginTop: 28 }} />
        <Skeleton width="100%" height={12} style={{ marginTop: 10 }} /><Skeleton width="92%" height={12} style={{ marginTop: 8 }} /><Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
      </div>
      <div className="skeleton-issue-side">
        <Skeleton width={110} height={32} radius={4} />
        <div className="skeleton-panel">
          {Array.from({ length: 6 }, (_, i) => <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center' }}><Skeleton width={80} /><Skeleton width={i % 2 ? 90 : 120} /></div>)}
        </div>
      </div>
    </div>
  )
}

/* ============ Status ============ */
export const statusCategory = (s) => (s === 'Done' ? 'done' : s === 'To Do' ? 'todo' : 'inprogress')
export function Lozenge({ status }) {
  return <span className={`lozenge ${statusCategory(status)}`}>{status}</span>
}

export function StatusSelect({ value, statuses, onChange, variant = 'lozenge' }) {
  return (
    <Dropdown
      minWidth={180}
      trigger={({ ref, toggle, open }) => (
        variant === 'button' ? (
          <button ref={ref} type="button" className={`status-button ${statusCategory(value)} ${open ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); toggle() }}>
            {value}<Icon name="chevronDown" size={16} strokeWidth={2.2} />
          </button>
        ) : (
          <button ref={ref} type="button" className={`lozenge-btn ${open ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); toggle() }}>
            <span className={`lozenge ${statusCategory(value)}`}>{value}<Icon name="chevronDown" size={12} strokeWidth={2.6} /></span>
          </button>
        )
      )}
    >
      {(close) => (
        <div className="menu">
          {statuses.map((s) => (
            <MenuItem key={s} selected={s === value} onClick={() => { close(); if (s !== value) onChange(s) }}>
              <span className={`lozenge ${statusCategory(s)}`}>{s}</span>
            </MenuItem>
          ))}
        </div>
      )}
    </Dropdown>
  )
}

/* ============ Searchable option list ============ */
export function SearchList({ options, value, onSelect, placeholder = 'Search', renderOption, autoFocus = true, emptyText = 'No matches found', multi = false }) {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const filtered = options.filter((o) => (o.search ?? o.label).toLowerCase().includes(q.toLowerCase()))
  useEffect(() => setHi(0), [q])
  const isSel = (o) => (multi ? value?.includes(o.value) : value === o.value)
  return (
    <div className="search-list">
      <div className="search-list-input">
        <input
          autoFocus={autoFocus} value={q} placeholder={placeholder}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
            if (e.key === 'Enter' && filtered[hi]) { e.preventDefault(); onSelect(filtered[hi].value) }
          }}
        />
      </div>
      <div className="menu scroll">
        {filtered.length === 0 && <div className="menu-empty">{emptyText}</div>}
        {filtered.map((o, i) => (
          <button
            type="button" key={String(o.value)}
            className={`menu-item ${isSel(o) ? 'selected' : ''} ${i === hi ? 'hi' : ''}`}
            onMouseEnter={() => setHi(i)} onClick={() => onSelect(o.value)}
          >
            {multi && <span className={`checkbox ${isSel(o) ? 'checked' : ''}`}>{isSel(o) && <Icon name="check" size={12} strokeWidth={3} />}</span>}
            {renderOption ? renderOption(o) : <span className="menu-item-label">{o.label}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function UserPicker({ users, value, onChange, currentUserId, trigger, allowUnassigned = true }) {
  const options = [
    ...(allowUnassigned ? [{ value: null, label: 'Unassigned', search: 'unassigned' }] : []),
    ...(currentUserId ? [{ value: '__me', label: 'Assign to me', search: 'assign to me' }] : []),
    ...users.map((u) => ({ value: u.id, label: u.name, search: `${u.name} ${u.email}`, user: u })),
  ]
  return (
    <Dropdown minWidth={260} trigger={trigger}>
      {(close) => (
        <SearchList
          placeholder="Search users" options={options} value={value}
          onSelect={(v) => { close(); const id = v === '__me' ? currentUserId : v; if (id !== value) onChange(id) }}
          renderOption={(o) => (
            <>
              {o.value === '__me' ? <Avatar user={users.find((u) => u.id === currentUserId)} size={24} /> : <Avatar user={o.user} size={24} />}
              <span className="menu-item-label">{o.label}{o.user && <span className="menu-sub">{o.user.email}</span>}</span>
            </>
          )}
        />
      )}
    </Dropdown>
  )
}

export function PrioritySelect({ value, priorities, onChange, trigger }) {
  return (
    <Dropdown minWidth={180} trigger={trigger}>
      {(close) => (
        <div className="menu">
          {priorities.map((p) => (
            <MenuItem key={p} selected={p === value} icon={<PriorityIcon priority={p} />} onClick={() => { close(); if (p !== value) onChange(p) }}>{p}</MenuItem>
          ))}
        </div>
      )}
    </Dropdown>
  )
}

export function TypeSelect({ value, types, onChange, trigger, exclude = [] }) {
  return (
    <Dropdown minWidth={180} trigger={trigger}>
      {(close) => (
        <div className="menu">
          <div className="menu-heading">Change work type</div>
          {types.filter((t) => !exclude.includes(t)).map((t) => (
            <MenuItem key={t} selected={t === value} icon={<TypeIcon type={t} />} onClick={() => { close(); if (t !== value) onChange(t) }}>{t}</MenuItem>
          ))}
        </div>
      )}
    </Dropdown>
  )
}

/* ============ Labels editor ============ */
export function LabelsEditor({ value, allLabels, onChange, autoFocus = true, onDone }) {
  const [q, setQ] = useState('')
  const [labels, setLabels] = useState(value)
  const add = (l) => {
    const clean = l.trim().replace(/\s+/g, '_')
    if (!clean || labels.includes(clean)) { setQ(''); return }
    const next = [...labels, clean]; setLabels(next); onChange(next); setQ('')
  }
  const remove = (l) => { const next = labels.filter((x) => x !== l); setLabels(next); onChange(next) }
  const suggestions = allLabels.filter((l) => !labels.includes(l) && l.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="labels-editor">
      <div className="labels-input">
        {labels.map((l) => (
          <span key={l} className="label-chip removable">{l}<button type="button" onClick={() => remove(l)} aria-label={`Remove ${l}`}><Icon name="close" size={10} strokeWidth={3} /></button></span>
        ))}
        <input
          autoFocus={autoFocus} value={q} placeholder={labels.length ? '' : 'Select or create labels'}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); if (q.trim()) add(q); else onDone?.() }
            if (e.key === 'Backspace' && !q && labels.length) remove(labels[labels.length - 1])
          }}
        />
      </div>
      <div className="menu scroll">
        {q.trim() && !allLabels.includes(q.trim()) && (
          <button type="button" className="menu-item" onClick={() => add(q)}><Icon name="plus" size={14} /><span className="menu-item-label">{q.trim().replace(/\s+/g, '_')} <span className="menu-sub inline">(New label)</span></span></button>
        )}
        {suggestions.map((l) => (
          <button type="button" key={l} className="menu-item" onClick={() => add(l)}><span className="menu-item-label">{l}</span></button>
        ))}
        {!suggestions.length && !q.trim() && <div className="menu-empty">Type to create a label</div>}
      </div>
    </div>
  )
}

/* ============ Inline editable text ============ */
export function InlineText({ value, onSave, className = '', multiline = false, placeholder = '', inputClassName = '', readOnly = false }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value)
  useEffect(() => { if (!editing) setV(value) }, [value, editing])
  const save = () => { setEditing(false); const t = v.trim(); if (t && t !== value) onSave(t); else setV(value) }
  if (readOnly) return <div className={`inline-view readonly ${className}`}>{value || <span className="placeholder">{placeholder}</span>}</div>
  if (editing) {
    const props = {
      autoFocus: true, value: v, className: `inline-input ${inputClassName}`,
      onChange: (e) => setV(e.target.value),
      onBlur: save,
      onClick: (e) => e.stopPropagation(),
      onKeyDown: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
        if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); setV(value) }
      },
      onFocus: (e) => e.target.select(),
    }
    return multiline ? <textarea rows={2} {...props} /> : <input {...props} maxLength={255} />
  }
  return (
    <div className={`inline-view ${className}`} onClick={(e) => { e.stopPropagation(); setEditing(true) }} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true) }}>
      {value || <span className="placeholder">{placeholder}</span>}
    </div>
  )
}

/* ============ Toasts ============ */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((t, extra) => {
    const id = Math.random().toString(36).slice(2)
    const toast = { ...(typeof t === 'string' ? { title: t } : t), ...(extra || {}) }
    setToasts((ts) => {
      // the same message twice (e.g. a view's error toast + the global "upgrade" toast) → one toast
      const dup = ts.find((x) => x.title === toast.title)
      if (dup) { return ts.map((x) => (x === dup ? { ...x, ...toast, id: x.id, action: toast.action || x.action, description: toast.description || x.description } : x)) }
      return [...ts, { id, ...toast }]
    })
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), toast.error ? 7000 : 4500)
  }, [])
  const boxRef = useRef(null)
  useFlip(boxRef, [toasts.map((t) => t.id).join()])
  const dismiss = (id) => setToasts((ts) => ts.filter((x) => x.id !== id))
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="toasts" ref={boxRef}>
          {toasts.map((t) => <Flag key={t.id} t={t} onDismiss={() => dismiss(t.id)} />)}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}

// ADS flag: slides in from the left (motion.flag.enter), slides out on dismiss (motion.flag.exit).
function Flag({ t, onDismiss }) {
  const ref = useRef(null)
  useExitGhost(ref, { className: 'flag-exit', duration: DUR.medium, pin: true })
  return (
    <div ref={ref} data-flip-key={t.id} className={`toast ${t.error ? 'error' : ''}`} role={t.error ? 'alert' : 'status'}>
      <span className="toast-icon">{t.error ? <Icon name="warning" size={18} /> : <Icon name="check" size={18} strokeWidth={2.4} />}</span>
      <div className="toast-body">
        <div className="toast-title">{t.title}</div>
        {t.description && <div className="toast-desc">{t.description}</div>}
        {t.action && <button type="button" className="link" onClick={() => { t.action.onClick(); onDismiss() }}>{t.action.label}</button>}
      </div>
      <button type="button" className="icon-btn small" aria-label="Dismiss" onClick={onDismiss}><Icon name="close" size={14} /></button>
    </div>
  )
}

/* ============ Modal ============ */
export function Modal({ children, onClose, width = 600, className = '', labelledBy }) {
  const ref = useRef(null)
  useExitGhost(ref, { className: 'modal-exit', duration: DUR.medium })
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.popover')) onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return createPortal(
    <div ref={ref} className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${className}`} style={{ width }} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Confirm({ title, body, confirmLabel = 'Delete', onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} width={420} className="confirm">
      <div className="modal-header"><h2 className="danger-title"><Icon name="warning" size={22} /> {title}</h2></div>
      <div className="modal-body"><p>{body}</p></div>
      <div className="modal-footer">
        <button type="button" className="btn subtle" onClick={onClose}>Cancel</button>
        <button type="button" className="btn danger" autoFocus onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}

/* ============ Formatting helpers ============ */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function fmtDate(iso) {
  if (!iso) return ''
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
export function fmtDateTime(iso) {
  const d = new Date(iso)
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12
  return `${fmtDate(iso)} at ${h}:${m} ${ap}`
}
export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} minute${Math.floor(s / 60) === 1 ? '' : 's'} ago`
  if (s < 86400) return `${Math.floor(s / 3600)} hour${Math.floor(s / 3600) === 1 ? '' : 's'} ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} day${Math.floor(s / 86400) === 1 ? '' : 's'} ago`
  return fmtDate(iso)
}
export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const isOverdue = (issue) => issue.dueDate && issue.status !== 'Done' && issue.dueDate < todayStr()
