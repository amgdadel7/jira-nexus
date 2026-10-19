import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, recent, getProject } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, MasarLogo, ProjectAvatar, TypeIcon } from '../icons.jsx'
import { Avatar, Dropdown, MenuItem, Popover, timeAgo } from './ui.jsx'

export const TABS = [
  { id: 'summary', label: 'Summary', icon: 'summary' },
  { id: 'backlog', label: 'Backlog', icon: 'backlog' },
  { id: 'timeline', label: 'Timeline', icon: 'timeline' },
  { id: 'board', label: 'Board', icon: 'board' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'list', label: 'List', icon: 'list' },
  { id: 'forms', label: 'Forms', icon: 'forms' },
  { id: 'goals', label: 'Goals', icon: 'goals' },
  { id: 'code', label: 'Code', icon: 'code' },
  { id: 'releases', label: 'Releases', icon: 'release' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
]
// Business projects have no sprints, releases or code (like Jira work management).
const BUSINESS_TABS = ['summary', 'timeline', 'board', 'calendar', 'list', 'forms', 'goals']
export const tabsFor = (project) => (project?.type === 'software' ? TABS : TABS.filter((t) => BUSINESS_TABS.includes(t.id)))

/* ================= Top navigation ================= */
export function TopNav({ onToggleSidebar }) {
  const { meta, currentUser, toast, openCreate, isAdmin, navigate, onLogout, openModal, can } = useApp()
  const canCreate = can('CREATE_ISSUES')
  return (
    <header className="topnav">
      <div className="topnav-left">
        <button className="icon-btn" title="Toggle sidebar [" onClick={onToggleSidebar} onMouseEnter={() => window.dispatchEvent(new Event('masar-sidebar-peek'))}><Icon name="sidebar" size={18} /></button>
        <Dropdown minWidth={260} trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn" title="Switch apps" onClick={toggle}><Icon name="apps" size={18} /></button>}>
          {(close) => (
            <div className="menu">
              <div className="menu-heading">Your apps</div>
              <MenuItem icon={<MasarLogo size={20} />} selected onClick={close}>Masar</MenuItem>
              <MenuItem icon={<Icon name="team" size={18} />} onClick={() => { close(); navigate({ page: 'teams' }) }}>Teams</MenuItem>
              <MenuItem icon={<Icon name="goals" size={18} />} onClick={() => { close(); navigate({ page: 'project', view: 'goals' }) }}>Goals</MenuItem>
            </div>
          )}
        </Dropdown>
        <a className="brand" href={`/jira/software/projects/${meta?.project?.key || "KAN"}/list`} onClick={(e) => { e.preventDefault(); navigate({ page: 'project', view: 'list' }) }}><MasarLogo size={24} /><span>Masar</span></a>
        {meta?.plan && <button className={`plan-chip ${meta.plan.key}`} title={`${meta.plan.name} plan${meta.plan.status === 'trialing' ? ' (trial)' : ''}`} onClick={() => navigate({ page: 'admin', section: meta.plan.key === 'premium' ? 'billing' : 'plans' })}>{meta.plan.status === 'trialing' ? `${meta.plan.name} trial` : meta.plan.name}</button>}
      </div>
      <div className="topnav-center">
        <QuickSearch />
        <button className="btn primary create-btn" onClick={() => openCreate()} disabled={!canCreate} title={canCreate ? 'Create (c)' : `You can’t create work items in ${meta.project.name} (your role: ${meta.myRoleLabel || 'none'})`}><Icon name="plus" size={16} strokeWidth={2.4} />Create</button>
      </div>
      <div className="topnav-right">
        <Notifications />
        <Dropdown align="end" minWidth={300} trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn" title="Help" onClick={toggle}><Icon name="help" size={18} /></button>}>
          <div className="help-panel">
            <h4>Keyboard shortcuts</h4>
            {[['c', 'Create a work item'], ['/', 'Search'], ['[', 'Toggle sidebar'], ['Esc', 'Close dialogs'], ['Ctrl + Enter', 'Save comment / description']].map(([k, d]) => (
              <div key={k} className="shortcut"><kbd>{k}</kbd><span>{d}</span></div>
            ))}
            <h4>JQL tips</h4>
            <p className="muted small">Switch the List view to JQL mode and press the <b>?</b> icon for the full reference.</p>
            <h4>Developers</h4>
            <a className="help-link" href="/api/docs" target="_blank" rel="noreferrer"><Icon name="book" size={16} />REST API documentation</a>
            <button className="help-link" onClick={() => openModal('profile')}><Icon name="key" size={16} />Create a personal API token</button>
          </div>
        </Dropdown>
        <Dropdown align="end" minWidth={240} trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn" title="Settings" onClick={toggle}><Icon name="settings" size={18} /></button>}>
          {(close) => (
            <div className="menu">
              <div className="menu-heading">Masar settings</div>
              <MenuItem icon={<Icon name="folder" size={16} />} onClick={() => { close(); openModal('project') }}>Project settings</MenuItem>
              <MenuItem icon={<Icon name="people" size={16} />} onClick={() => { close(); navigate({ page: 'people' }) }}>{isAdmin ? 'User management' : 'People'}</MenuItem>
              <MenuItem icon={<Icon name="filter" size={16} />} onClick={() => { close(); navigate({ page: 'filters' }) }}>Filters</MenuItem>
              <MenuItem icon={<Icon name="star" size={16} />} onClick={() => { close(); navigate({ page: 'admin', section: 'billing' }) }}>Billing & plans</MenuItem>
              {isAdmin && <MenuItem icon={<Icon name="shield" size={16} />} onClick={() => { close(); navigate({ page: 'admin', section: 'security' }) }}>Security & sign-in</MenuItem>}
              {isAdmin && <MenuItem icon={<Icon name="webhook" size={16} />} onClick={() => { close(); navigate({ page: 'admin', section: 'webhooks' }) }}>Webhooks</MenuItem>}
              <MenuItem icon={<Icon name="lightning" size={16} />} onClick={() => { close(); navigate({ page: 'settings', section: 'automation' }) }}>Automation</MenuItem>
              <div className="menu-heading">Personal settings</div>
              <MenuItem icon={<Icon name="user" size={16} />} onClick={() => { close(); openModal('profile') }}>Profile & password</MenuItem>
              <MenuItem icon={<Icon name="palette" size={16} />} onClick={() => { close(); openModal('preferences') }}>Theme, notifications & photo</MenuItem>
            </div>
          )}
        </Dropdown>
        <Dropdown align="end" minWidth={260} trigger={({ ref, toggle }) => <button ref={ref} className="avatar-btn" title={currentUser?.name} onClick={toggle}><Avatar user={currentUser} size={26} /></button>}>
          {(close) => (
            <div className="menu">
              <div className="account-head">
                <Avatar user={currentUser} size={40} />
                <div><b>{currentUser?.name}</b><div className="muted small">{currentUser?.email}</div>{isAdmin && <span className="role-pill">Admin</span>}</div>
              </div>
              <div className="menu-sep" />
              <MenuItem icon={<Icon name="user" size={16} />} onClick={() => { close(); openModal('profile') }}>Profile</MenuItem>
              <MenuItem icon={<Icon name="clock" size={16} />} onClick={() => { close(); navigate({ page: 'foryou' }) }}>Your work</MenuItem>
              <MenuItem icon={<Icon name="settings" size={16} />} onClick={() => { close(); openModal('preferences') }}>Personal settings</MenuItem>
              <div className="menu-sep" />
              <div className="menu-heading">Theme</div>
              <ThemeItems close={close} />
              <div className="menu-sep" />
              <MenuItem icon={<Icon name="close" size={16} />} onClick={() => { close(); onLogout() }}>Log out</MenuItem>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  )
}

function QuickSearch() {
  const { openIssue, openList, navigate } = useApp()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [res, setRes] = useState(null)
  const [hi, setHi] = useState(0)
  const ref = useRef(null)
  const timer = useRef(null)
  useEffect(() => {
    clearTimeout(timer.current)
    if (!q.trim()) { setRes(null); return }
    timer.current = setTimeout(() => api.quicksearch(q.trim()).then((r) => { setRes(r); setHi(0) }).catch(() => {}), 200)
  }, [q])
  const items = res ? [
    ...res.issues.map((i) => ({ kind: 'issue', i, go: () => openIssue(i.key) })),
    ...res.filters.map((f) => ({ kind: 'filter', f, go: () => openList(f.jql) })),
    ...res.users.map((u) => ({ kind: 'user', u, go: () => openList(`project = ${getProject()} AND assignee = "${u.name}" ORDER BY cf[10019] ASC`) })),
  ] : recent.get().slice(0, 6).map((i) => ({ kind: 'recent', i, go: () => openIssue(i.key) }))
  const all = () => { openList(`project = ${getProject()} AND text ~ "${q.trim().replace(/"/g, '\\"')}" ORDER BY cf[10019] ASC`) }
  const finish = (fn) => { fn(); setOpen(false); setQ(''); ref.current?.querySelector('input')?.blur() }
  return (
    <>
      <form ref={ref} className="global-search" onSubmit={(e) => { e.preventDefault(); if (items[hi] && res) finish(items[hi].go); else if (q.trim()) finish(all) }}>
        <Icon name="search" size={16} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Search" aria-label="Search"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
            if (e.key === 'Escape') { setOpen(false); e.target.blur() }
          }} />
        <kbd className="search-kbd">/</kbd>
      </form>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={ref.current?.offsetWidth || 600}>
        <div className="menu quick-results">
          {!res && <div className="menu-heading">Recently viewed</div>}
          {!res && !items.length && <div className="menu-empty">Work items you view will show up here.</div>}
          {res && !items.length && <div className="menu-empty">No results for “{q}”.</div>}
          {items.map((it, idx) => (
            <button key={idx} className={`menu-item ${idx === hi ? 'hi' : ''}`} onMouseEnter={() => setHi(idx)} onClick={() => finish(it.go)}>
              {(it.kind === 'issue' || it.kind === 'recent') && <><TypeIcon type={it.i.type} /><span className="menu-item-label">{it.i.summary}<span className="menu-sub">{it.i.key}{it.i.status ? ` · ${it.i.status}` : ''}</span></span></>}
              {it.kind === 'filter' && <><Icon name="filter" size={16} /><span className="menu-item-label">{it.f.name}<span className="menu-sub">Filter</span></span></>}
              {it.kind === 'user' && <><Avatar user={it.u} size={22} /><span className="menu-item-label">{it.u.name}<span className="menu-sub">Work assigned to {it.u.name.split(' ')[0]}</span></span></>}
            </button>
          ))}
          {res && q.trim() && (
            <>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => finish(all)}><Icon name="search" size={16} /><span className="menu-item-label">View all work items matching “{q.trim()}”</span></button>
              <button className="menu-item" onClick={() => finish(() => navigate({ page: 'filters' }))}><Icon name="filter" size={16} /><span className="menu-item-label">Browse saved filters</span></button>
            </>
          )}
        </div>
      </Popover>
    </>
  )
}

function Notifications() {
  const { userById, openIssue, refreshKey } = useApp()
  const [data, setData] = useState({ unread: 0, items: [] })
  const [onlyUnread, setOnlyUnread] = useState(false)
  const load = useCallback(() => api.notifications().then(setData).catch(() => {}), [])
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id) }, [load, refreshKey])
  const items = onlyUnread ? data.items.filter((n) => !n.read) : data.items
  return (
    <Dropdown align="end" width={420} onOpenChange={(o) => o && load()} trigger={({ ref, toggle }) => (
      <button ref={ref} className="icon-btn notif-btn" title="Notifications" onClick={toggle}>
        <Icon name="bell" size={18} />{data.unread > 0 && <span key={data.unread} className="notif-badge">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
    )}>
      {(close) => (
        <div className="notif-panel">
          <div className="notif-head">
            <h3>Notifications</h3>
            <label className="check-label small"><input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />Only show unread</label>
          </div>
          <div className="notif-actions"><button className="link small" disabled={!data.unread} onClick={async () => { await api.markRead(); load() }}>Mark all as read</button></div>
          <div className="notif-list">
            {!items.length && <div className="menu-empty center">You’re all caught up 🎉</div>}
            {items.map((n) => (
              <button key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={async () => { close(); if (!n.read) { await api.markRead([n.id]); load() } if (n.key) openIssue(n.key) }}>
                <Avatar user={userById[n.actorId]} size={32} />
                <div className="notif-body">
                  <div><b>{userById[n.actorId]?.name || 'Someone'}</b> {n.message}</div>
                  {n.key && <div className="notif-issue"><TypeIcon type={n.issueType} size={14} />{n.key} · {n.summary}</div>}
                  <div className="muted small">{timeAgo(n.created)}</div>
                </div>
                {!n.read && <span className="unread-dot" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </Dropdown>
  )
}

/* ================= Sidebar ================= */
export function Sidebar({ loc }) {
  const { meta, navigate, filters, openList, openIssue, refreshFilters, projects, openProject, openModal, canGlobal } = useApp()
  const starredProjects = projects.filter((p) => p.starred)
  const otherProjects = projects.filter((p) => !p.starred)
  const [open, setOpen] = useState(() => { try { return JSON.parse(localStorage.getItem('jc.sideOpen')) || { projects: true } } catch { return { projects: true } } })
  const [recentItems, setRecentItems] = useState(recent.get)
  useEffect(() => { const f = () => setRecentItems(recent.get()); window.addEventListener('jc-recent', f); return () => window.removeEventListener('jc-recent', f) }, [])
  const toggle = (k) => setOpen((o) => { const n = { ...o, [k]: !o[k] }; localStorage.setItem('jc.sideOpen', JSON.stringify(n)); return n })
  const starred = filters.filter((f) => f.starred)
  return (
    <nav className="sidebar">
      <div className="sidebar-section">
        <SideItem icon="user" label="For you" active={loc.page === 'foryou'} onClick={() => navigate({ page: 'foryou' })} />
        <SideItem icon="clock" label="Recent" chevron open={open.recent} onClick={() => toggle('recent')} />
        {open.recent && (
          <div className="sidebar-sub">
            {!recentItems.length && <div className="side-empty">Nothing viewed yet</div>}
            {recentItems.slice(0, 6).map((i) => (
              <button key={i.key} className="side-item small" onClick={() => openIssue(i.key)} title={`${i.key} ${i.summary}`}><TypeIcon type={i.type} size={14} /><span className="side-label">{i.summary}</span></button>
            ))}
          </div>
        )}
        <SideItem icon="star" label="Starred" chevron open={open.starred} onClick={() => toggle('starred')} />
        {open.starred && (
          <div className="sidebar-sub">
            {!starred.length && <div className="side-empty">Star a filter to see it here</div>}
            {starred.map((f) => <button key={f.id} className="side-item small" onClick={() => openList(f.jql)}><Icon name="star" size={14} style={{ color: '#E2B203' }} /><span className="side-label">{f.name}</span></button>)}
          </div>
        )}
        <SideItem icon="apps" label="Apps" onClick={() => navigate({ page: 'project', view: 'forms' })} />
        <SideItem icon="plans" label="Plans" onClick={() => navigate({ page: 'project', view: 'timeline' })} />
        <SideItem icon="folder" label="Projects" chevron open={open.projects} onClick={() => toggle('projects')} />
        {open.projects && (
          <div className="sidebar-sub">
            {[['Starred', starredProjects], ['Recent', otherProjects]].filter(([, l]) => l.length).map(([h, list]) => (
              <React.Fragment key={h}>
                <div className="sidebar-subheading">{h}</div>
                {list.slice(0, 6).map((p) => (
                  <button key={p.key} className={`side-item ${loc.page === 'project' && meta.project.key === p.key ? 'active' : ''}`} onClick={() => openProject(p.key, 'summary')} title={`${p.name} (${p.key})`}>
                    <ProjectAvatar size={20} project={p} /><span className="side-label">{p.name}</span>
                  </button>
                ))}
              </React.Fragment>
            ))}
            <button className={`side-item small muted ${loc.page === 'projects' ? 'active' : ''}`} onClick={() => navigate({ page: 'projects' })}><span className="side-label">View all projects</span></button>
            {canGlobal('CREATE_PROJECTS') && <button className="side-item small muted" onClick={() => openModal('createProject')}><Icon name="plus" size={14} /><span className="side-label">Create project</span></button>}
          </div>
        )}
        <SideItem icon="filter" label="Filters" chevron open={open.filters} onClick={() => toggle('filters')} active={loc.page === 'filters'} />
        {open.filters && (
          <div className="sidebar-sub">
            {filters.slice(0, 6).map((f) => (
              <div key={f.id} className="side-row">
                <button className="side-item small" onClick={() => openList(f.jql)}><span className="side-label">{f.name}</span></button>
                <button className={`star-btn ${f.starred ? 'on' : ''}`} title={f.starred ? 'Unstar' : 'Star'} onClick={async () => { await api.updateFilter(f.id, { starred: !f.starred }); refreshFilters() }}><Icon name="star" size={14} /></button>
              </div>
            ))}
            <button className="side-item small muted" onClick={() => navigate({ page: 'filters' })}><span className="side-label">View all filters</span></button>
          </div>
        )}
        <SideItem icon="dashboard" label="Dashboards" active={loc.page === 'dashboards'} onClick={() => navigate({ page: 'dashboards' })} />
        <SideItem icon="team" label="Teams" active={loc.page === 'teams'} onClick={() => navigate({ page: 'teams' })} />
        <SideItem icon="people" label="People" active={loc.page === 'people'} onClick={() => navigate({ page: 'people' })} />
      </div>
    </nav>
  )
}

function SideItem({ icon, label, chevron, open, onClick, active }) {
  return (
    <button className={`side-item ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon name={icon} size={16} />
      <span className="side-label">{label}</span>
      {chevron && <span className={`side-chevron ${open ? 'open' : ''}`}><Icon name="chevronRight" size={14} /></span>}
    </button>
  )
}

/* ================= Project header ================= */
export function ProjectHeader({ view, onTab }) {
  const { meta, toast, refreshMeta, openModal, navigate, online, userById, can } = useApp()
  const canAdmin = can('ADMINISTER_PROJECT')
  const accessIcon = { open: 'globe', limited: 'eye', private: 'lock' }[meta.project.access] || 'globe'
  const name = meta.project.name
  const tabs = tabsFor(meta.project)
  const others = online.filter((id) => id !== meta.currentUserId).map((id) => userById[id]).filter(Boolean)
  const toggleStar = async () => { await api.starProject(meta.project.key, !meta.project.starred).catch(() => {}); refreshMeta() }
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(name)
  useEffect(() => setV(name), [name])
  const save = async () => {
    setEditing(false)
    if (!v.trim() || v.trim() === name) { setV(name); return }
    try { await api.updateProject({ name: v.trim() }); refreshMeta() } catch (e) { toast({ title: 'Could not rename project', description: e.message, error: true }) }
  }
  return (
    <div className="project-header">
      <div className="breadcrumbs"><button className="link-plain" onClick={() => navigate({ page: 'projects' })}>Projects</button><span>/</span><span>{name}</span></div>
      <div className="project-title-row">
        <div className="project-title">
          <ProjectAvatar size={24} project={meta.project} />
          {editing ? (
            <input autoFocus className="project-name-input" value={v} onChange={(e) => setV(e.target.value)} onBlur={save}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setV(name); setEditing(false) } }} />
          ) : (
            <h1 onClick={() => canAdmin && setEditing(true)} title={canAdmin ? 'Click to rename' : name}>{name}</h1>
          )}
          <button className={`icon-btn star-toggle ${meta.project.starred ? 'on' : ''}`} title={meta.project.starred ? 'Remove from starred' : 'Add to starred'} onClick={toggleStar}><Icon name="star" size={16} /></button>
          <button className="access-chip" title={`Access: ${meta.project.access} · Your role: ${meta.myRoleLabel || 'none'}`} onClick={() => navigate({ page: 'settings', section: 'access' })}>
            <Icon name={accessIcon} size={14} /><span className={`role-badge ${meta.myRole || 'none'}`}>{meta.myRoleLabel || 'No role'}</span>
          </button>
          <Dropdown trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn" onClick={toggle} title="More actions"><Icon name="more" size={16} /></button>}>
            {(close) => (
              <div className="menu">
                <MenuItem icon={<Icon name="edit" size={16} />} disabled={!canAdmin} onClick={() => { close(); setEditing(true) }}>Rename project</MenuItem>
                <MenuItem icon={<Icon name="settings" size={16} />} onClick={() => { close(); openModal('project') }}>Project settings</MenuItem>
                <MenuItem icon={<Icon name="people" size={16} />} onClick={() => { close(); navigate({ page: 'settings', section: 'access' }) }}>People and access</MenuItem>
                <MenuItem icon={<Icon name="trash" size={16} />} onClick={() => { close(); navigate({ page: 'settings', section: 'trash' }) }}>Recycle bin</MenuItem>
              </div>
            )}
          </Dropdown>
        </div>
        <div className="project-actions">
          {others.length > 0 && (
            <div className="presence" title={`Online now: ${others.map((u) => u.name).join(', ')}`}>
              <Icon name="live" size={14} /><span className="presence-label">Live</span>
              <div className="avatar-stack">{others.slice(0, 4).map((u) => <Avatar key={u.id} user={u} size={22} />)}</div>
            </div>
          )}
          <button className="icon-btn" title="Share" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast('Link copied to clipboard') }}><Icon name="share" size={16} /></button>
          <button className="icon-btn" title="Enter full screen" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}><Icon name="expand" size={16} /></button>
        </div>
      </div>
      <TabBar tabs={tabs} view={view} onTab={onTab} />
    </div>
  )
}

/* Tabs with the ADS sliding selection indicator (motion.tab.indicator.*). */
function TabBar({ tabs, view, onTab }) {
  const ref = useRef(null)
  const [ind, setInd] = useState(null)
  const first = useRef(true)
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelector('.tab.active')
      if (!el) { setInd(null); return }
      setInd({ x: el.offsetLeft, w: el.offsetWidth })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [view, tabs.length])
  useEffect(() => { if (ind) first.current = false }, [ind])
  return (
    <div className={`tabs ${ind ? 'has-indicator' : ''}`} role="tablist" ref={ref}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={view === t.id} className={`tab ${view === t.id ? 'active' : ''}`} onClick={() => onTab(t.id)}>
          <Icon name={t.icon} size={16} />{t.label}
        </button>
      ))}
      {ind && <span className={`tab-indicator ${first.current ? 'no-anim' : ''}`} style={{ width: ind.w, transform: `translateX(${ind.x}px)` }} />}
    </div>
  )
}

function ThemeItems({ close }) {
  const { prefs, savePrefs } = useApp()
  const cur = prefs?.theme || 'light'
  return [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'Match browser', 'monitor']].map(([id, label, icon]) => (
    <MenuItem key={id} selected={cur === id} icon={<Icon name={icon} size={16} />} onClick={() => { close(); savePrefs({ theme: id }) }}>{label}</MenuItem>
  ))
}

/* Sidebar frame: animated collapse, and a flyout when collapsed (hover the left edge or the toggle). */
export function SidebarFrame({ open, children }) {
  const [fly, setFly] = useState(false)
  const timer = useRef(null)
  useEffect(() => {
    const peek = () => { if (!open) { clearTimeout(timer.current); setFly(true) } }
    window.addEventListener('masar-sidebar-peek', peek)
    return () => window.removeEventListener('masar-sidebar-peek', peek)
  }, [open])
  useEffect(() => { if (open) setFly(false) }, [open])
  const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setFly(false), 300) }
  const enter = () => clearTimeout(timer.current)
  return (
    <div className={`sidebar-wrap ${open ? '' : 'collapsed'} ${fly && !open ? 'flyout' : ''}`} onMouseLeave={leave} onMouseEnter={enter}
      onClickCapture={(e) => { if (!open && e.target.closest('button, a')) setTimeout(() => setFly(false), 0) }}>
      <div className="sidebar-hotzone" onMouseEnter={() => { clearTimeout(timer.current); timer.current = setTimeout(() => setFly(true), 150) }} />
      {children}
    </div>
  )
}
