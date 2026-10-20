import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AppCtx } from './ctx.js'
import { api, authEvents, setProject, connectEvents } from './api.js'
import { Icon, JiraLogo } from './icons.jsx'
import { ToastProvider, useToast } from './components/ui.jsx'
import { TopNav, Sidebar, SidebarFrame, ProjectHeader, TABS, tabsFor } from './components/Shell.jsx'
import { PreferencesModal } from './components/Preferences.jsx'
import { applyTheme, applyReduceMotion } from './motion.js'
import LoginPage from './components/LoginPage.jsx'
import ListView from './views/ListView.jsx'
import BoardView from './views/BoardView.jsx'
import SummaryView from './views/SummaryView.jsx'
import TimelineView from './views/TimelineView.jsx'
import CalendarView from './views/CalendarView.jsx'
import FormsView from './views/FormsView.jsx'
import GoalsView from './views/GoalsView.jsx'
import CodeView from './views/CodeView.jsx'
import BacklogView from './views/BacklogView.jsx'
import DashboardsPage from './views/DashboardsPage.jsx'
import ForYouView from './views/ForYouView.jsx'
import FiltersPage from './views/FiltersPage.jsx'
import PeoplePage from './views/PeoplePage.jsx'
import ProjectsPage, { CreateProjectModal } from './views/ProjectsPage.jsx'
import ReleasesView from './views/ReleasesView.jsx'
import ReportsView from './views/ReportsView.jsx'
import ProjectSettingsPage from './views/ProjectSettingsPage.jsx'
import TeamsPage from './views/TeamsPage.jsx'
import AdminSettingsPage, { PricingPage, ADMIN_SECTIONS } from './views/BillingPage.jsx'
import IssueModal from './components/IssueModal.jsx'
import CreateModal from './components/CreateModal.jsx'
import { ProfileModal } from './components/SettingsModals.jsx'
import { defaultJql } from './jql.js'

const lastProject = () => 'KAN'

function readLocation() {
  const url = new URL(window.location.href)
  const p = url.pathname
  let page = 'project'; let view = 'list'; let project = lastProject(); let section = 'details'
  const settings = /\/projects\/([A-Z][A-Z0-9]*)\/settings(?:\/([a-z]+))?/i.exec(p)
  const admin = /^\/jira\/settings(?:\/([a-z]+))?/.exec(p)
  if (settings) { page = 'settings'; project = settings[1].toUpperCase(); section = settings[2] || 'details' }
  else if (admin) { page = 'admin'; section = ADMIN_SECTIONS.some((s) => s.id === admin[1]) ? admin[1] : 'billing' }
  else if (/^\/jira\/projects\/?$/.test(p)) page = 'projects'
  else if (/^\/jira\/teams/.test(p)) page = 'teams'
  else if (/^\/jira\/for-you/.test(p)) page = 'foryou'
  else if (/^\/jira\/filters/.test(p)) page = 'filters'
  else if (/^\/jira\/people/.test(p)) page = 'people'
  else if (/^\/jira\/dashboards/.test(p)) page = 'dashboards'
  else {
    const m = /\/projects\/([A-Z][A-Z0-9]*)(?:\/([a-z]+))?/i.exec(p)
    if (m) { project = m[1].toUpperCase(); if (m[2] && TABS.some((t) => t.id === m[2])) view = m[2] }
  }
  let selected = url.searchParams.get('selectedIssue')
  const browse = /\/browse\/([A-Z]+-\d+)/i.exec(p)
  if (browse) { selected = browse[1].toUpperCase(); project = selected.split('-')[0] }
  return { page, view, project, section, jql: url.searchParams.get('jql') ?? defaultJql(project), selected }
}

function buildUrl({ page, view, project, jql, selected, section }) {
  const params = new URLSearchParams()
  if (page === 'project' && view === 'list') params.set('jql', jql)
  if (selected) params.set('selectedIssue', selected)
  const qs = params.toString()
  const path = page === 'foryou' ? '/jira/for-you' : page === 'filters' ? '/jira/filters' : page === 'people' ? '/jira/people' : page === 'dashboards' ? '/jira/dashboards' : page === 'projects' ? '/jira/projects' : page === 'teams' ? '/jira/teams' : page === 'admin' ? `/jira/settings/${section || 'billing'}` : page === 'settings' ? `/jira/software/projects/${project}/settings/${section || 'details'}` : `/jira/software/projects/${project}/${view}`
  return `${path}${qs ? `?${qs}` : ''}`
}

function Shell({ onLogout }) {
  const toast = useToast()
  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState(null)
  const [loc, setLoc] = useState(readLocation)
  const [refreshKey, setRefreshKey] = useState(0)
  const [createState, setCreateState] = useState(null)
  const [modal, setModal] = useState(null) // 'profile' | 'project'
  const [filters, setFilters] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('jc.sidebar') !== 'closed')

  const [online, setOnline] = useState([])
  const [prefs, setPrefs] = useState(null)
  useEffect(() => {
    api.preferences().then((p) => { setPrefs(p); applyTheme(p.theme); applyReduceMotion(p.reduceMotion) }).catch(() => {})
  }, [])
  useEffect(() => {
    if (prefs?.theme !== 'system' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme('system', { animate: true })
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [prefs?.theme])
  const savePrefs = useCallback(async (patch) => {
    // optimistic: apply immediately, then persist
    setPrefs((cur) => {
      const next = { ...(cur || {}), ...patch, notify: { ...(cur?.notify || {}), ...(patch.notify || {}) } }
      if ('theme' in patch) applyTheme(patch.theme, { animate: true })
      if ('reduceMotion' in patch) applyReduceMotion(patch.reduceMotion)
      return next
    })
    try { setPrefs(await api.savePreferences(patch)) } catch (e) { toast({ title: 'Couldn’t save your settings', description: e.message, error: true }) }
  }, [toast])
  const projectKey = loc.project
  setProject(projectKey) // api calls made while rendering this project default to it
  const loadMeta = useCallback(() => api.meta(projectKey).then((m) => {
    setMeta(m)
    if (m.noAccess) return
    if (m.denied) toast({ title: `You don’t have access to ${m.denied}`, description: `The project doesn’t exist or you haven’t been added to it. Showing ${m.project.name} instead.`, error: true })
    if (m.project.key !== projectKey) {
      setLoc((l) => {
        const next = { ...l, project: m.project.key, jql: defaultJql(m.project.key), selected: m.denied ? null : l.selected }
        window.history.replaceState(null, '', buildUrl(next)) // don't leave the denied project's URL in the address bar
        return next
      })
    }
    // Project state is driven purely by current route and Supabase metadata
  }).catch((e) => setMetaError(e.message)), [projectKey])
  const refreshFilters = useCallback(() => api.filters().then(setFilters).catch(() => {}), [])
  useEffect(() => { loadMeta() }, [loadMeta])
  useEffect(() => { refreshFilters() }, [refreshFilters])

  const navigate = useCallback((patch, { replace = false } = {}) => {
    setLoc((prev) => {
      const next = { ...prev, ...patch }
      if (patch.page && patch.page !== 'project' && !('view' in patch)) next.view = prev.view
      if (patch.page === 'settings' && !('section' in patch)) next.section = 'details'
      if (patch.page === 'admin' && !('section' in patch)) next.section = 'billing'
      if (patch.project && patch.project !== prev.project) {
        if (!('jql' in patch)) next.jql = defaultJql(patch.project)
        if (!('view' in patch)) next.view = 'summary'
        if (!('selected' in patch)) next.selected = null
      }
      const url = buildUrl(next)
      if (url !== window.location.pathname + window.location.search) window.history[replace ? 'replaceState' : 'pushState'](null, '', url)
      return next
    })
  }, [])
  useEffect(() => {
    window.history.replaceState(null, '', buildUrl(loc))
    const onPop = () => setLoc(readLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, []) // eslint-disable-line

  useEffect(() => {
    const label = loc.page === 'foryou' ? 'For you' : loc.page === 'filters' ? 'Filters' : loc.page === 'people' ? 'People' : loc.page === 'projects' ? 'Projects' : loc.page === 'dashboards' ? 'Dashboards' : loc.page === 'teams' ? 'Teams' : loc.page === 'settings' ? 'Project settings' : loc.page === 'admin' ? (ADMIN_SECTIONS.find((s) => s.id === loc.section)?.label || 'Settings') : TABS.find((t) => t.id === loc.view)?.label
    document.title = loc.page === 'admin' ? `${label} - Masar` : `${label || 'List'} - ${meta?.project?.name || 'Masar'} - Masar`
  }, [loc.page, loc.view, loc.section, meta])
  useEffect(() => { localStorage.setItem('jc.sidebar', sidebarOpen ? 'open' : 'closed') }, [sidebarOpen])

  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])
  const refreshMeta = useCallback(() => api.meta(projectKey).then(setMeta).catch(() => {}), [projectKey])

  // Live updates: when someone else changes something, refresh the current view (debounced).
  useEffect(() => {
    let timer = null; const topics = new Set()
    const flush = () => {
      bump()
      if (['sprints', 'versions', 'projects', 'project', 'users', 'reset', 'components', 'teams', 'permissions'].some((t) => topics.has(t))) refreshMeta()
      if (topics.has('filters')) refreshFilters()
      window.dispatchEvent(new CustomEvent('jc-live', { detail: [...topics] }))
      topics.clear()
    }
    return connectEvents({
      onChange: (d) => { topics.add(d.topic); clearTimeout(timer); timer = setTimeout(flush, 400) },
      onPresence: setOnline,
    })
  }, [bump, refreshMeta, refreshFilters])
  // 402 from any request → one toast with an upgrade shortcut
  useEffect(() => {
    const onLimit = (e) => {
      const d = e.detail || {}
      toast({ title: d.error || 'Your plan doesn’t include this.', error: true,
        description: d.upgradeTo ? `Available on the ${d.upgradeTo[0].toUpperCase()}${d.upgradeTo.slice(1)} plan.` : undefined,
        action: { label: 'View plans', onClick: () => navigate({ page: 'admin', section: 'plans' }) } })
    }
    authEvents.addEventListener('plan-limit', onLimit)
    return () => authEvents.removeEventListener('plan-limit', onLimit)
  }, [toast]) // eslint-disable-line react-hooks/exhaustive-deps
  const openIssue = useCallback((key) => navigate({ selected: key }), [navigate])
  const closeIssue = useCallback(() => navigate({ selected: null }), [navigate])
  const openCreate = useCallback((defaults = {}) => setCreateState(defaults), [])
  const openList = useCallback((jql) => navigate({ page: 'project', view: 'list', jql }), [navigate])

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return
      if (document.querySelector('.modal-backdrop, .popover')) return
      if (e.key === 'c') { e.preventDefault(); openCreate() }
      if (e.key === '/') { e.preventDefault(); document.querySelector('.global-search input')?.focus() }
      if (e.key === '[') setSidebarOpen((s) => !s)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openCreate])

  const openModal = useCallback((m) => {
    if (m === 'project') navigate({ page: 'settings', section: 'details' })
    else setModal(m)
  }, [navigate])
  const ctx = useMemo(() => {
    if (!meta || meta.noAccess) return null
    const userList = Array.isArray(meta.users) ? meta.users : []
    return {
      meta,
      users: userList,
      activeUsers: userList.filter((u) => u.active),
      userById: Object.fromEntries(userList.map((u) => [u.id, u])),
      currentUser: userList.find((u) => u.id === meta.currentUserId) || meta.currentUser,
    isAdmin: meta.currentUser?.role === 'admin',
    refreshKey, bump, refreshMeta, openIssue, openCreate, openList, navigate, toast, filters, refreshFilters, onLogout,
    // permissions for the current project (from /api/meta) and global ones
    myRole: meta.myRole, permissions: meta.permissions || [],
    can: (perm) => (meta.permissions || []).includes(perm),
    canIn: (projectKey, perm) => (projectKey === meta.project.key ? meta.permissions || [] : (meta.projects || []).find((p) => p.key === projectKey)?.permissions || []).includes(perm),
    canGlobal: (perm) => (meta.globalPermissions || []).includes(perm),
    components: meta.components || [], teams: meta.teams || [],
    openModal, projectKey: meta.project.key, project: meta.project, projects: meta.projects || [meta.project],
    online, isSoftware: meta.project.type === 'software', prefs, savePrefs,
    openProject: (key, view) => navigate({ page: 'project', project: key, ...(view ? { view } : {}) }),
  }
}, [meta, refreshKey, bump, refreshMeta, openIssue, openCreate, openList, navigate, toast, filters, refreshFilters, onLogout, online, openModal, prefs, savePrefs])

  if (metaError) return <div className="fatal"><Icon name="warning" size={28} /><h2>Can’t reach the server</h2><p>{metaError}</p><button className="btn primary" onClick={() => { setMetaError(null); loadMeta() }}>Try again</button></div>
  if (meta?.noAccess) {
    return (
      <div className="fatal"><Icon name="lock" size={28} /><h2>You don’t have access to any projects yet</h2>
        <p>Ask a project administrator to add you to a project, or ask a site administrator for access.</p>
        <button className="btn" onClick={onLogout}>Log out</button></div>
    )
  }
  if (!ctx) return <div className="app-loading"><JiraLogo size={40} /><div className="spinner" /></div>
  const switching = (loc.page === 'project' || loc.page === 'settings') && meta.project.key !== loc.project
  const tabs = tabsFor(meta.project)
  const view = tabs.some((t) => t.id === loc.view) ? loc.view : 'list'

  return (
    <AppCtx.Provider value={ctx}>
      <div className={`app ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        <TopNav onToggleSidebar={() => setSidebarOpen((s) => !s)} />
        <div className="app-body">
          <SidebarFrame open={sidebarOpen}><Sidebar loc={loc} /></SidebarFrame>
          <main className="main">
            {loc.page === 'project' && (
              <>
                <ProjectHeader view={view} onTab={(v) => navigate({ page: 'project', view: v })} />
                {switching ? <div className="view"><div className="spinner" /></div> : <div className="view motion-fade-in" key={`${meta.project.key}/${view}`}>
                  {view === 'list' && <ListView jql={loc.jql} setJql={(jql, opts) => navigate({ jql }, opts)} />}
                  {view === 'board' && <BoardView />}
                  {view === 'backlog' && <BacklogView />}
                  {view === 'summary' && <SummaryView onViewList={openList} />}
                  {view === 'timeline' && <TimelineView />}
                  {view === 'calendar' && <CalendarView />}
                  {view === 'forms' && <FormsView />}
                  {view === 'goals' && <GoalsView />}
                  {view === 'code' && <CodeView />}
                  {view === 'releases' && <ReleasesView />}
                  {view === 'reports' && <ReportsView />}
                </div>}
              </>
            )}
            {loc.page === 'settings' && (switching ? <div className="view"><div className="spinner" /></div>
              : <ProjectSettingsPage key={meta.project.key} section={loc.section} onSection={(section) => navigate({ page: 'settings', section })} />)}
            {loc.page === 'admin' && <AdminSettingsPage section={loc.section} onSection={(section) => navigate({ page: 'admin', section })} />}
            {loc.page === 'teams' && <TeamsPage />}
            {loc.page === 'foryou' && <ForYouView />}
            {loc.page === 'filters' && <FiltersPage />}
            {loc.page === 'people' && <PeoplePage />}
            {loc.page === 'dashboards' && <DashboardsPage />}
            {loc.page === 'projects' && <ProjectsPage />}
          </main>
        </div>
        {loc.selected && <IssueModal issueKey={loc.selected} onClose={closeIssue} onNavigate={openIssue} />}
        {createState && <CreateModal defaults={createState} onClose={() => setCreateState(null)} />}
        {modal === 'profile' && <ProfileModal onClose={() => setModal(null)} />}
        {modal === 'preferences' && <PreferencesModal onClose={() => setModal(null)} />}
        {modal === 'createProject' && <CreateProjectModal onClose={() => setModal(null)} onCreated={(p) => { setModal(null); toast(`Project ${p.name} created`); navigate({ page: 'project', project: p.key, view: p.type === 'software' ? 'backlog' : 'list' }) }} />}
      </div>
    </AppCtx.Provider>
  )
}

function resetTokenFromUrl() {
  const url = new URL(window.location.href)
  return url.pathname === '/reset-password' ? url.searchParams.get('token') || '' : null
}

function Root() {
  const [auth, setAuth] = useState({ state: 'loading', user: null })
  const [notice, setNotice] = useState(null) // { text, error }
  const [resetToken, setResetToken] = useState(resetTokenFromUrl)

  const check = useCallback(() => {
    setAuth({ state: 'loading', user: null })
    api.me()
      .then((d) => { setAuth({ state: 'in', user: d.user }); setNotice(null) })
      .catch((e) => { setAuth({ state: 'out', user: null }); if (e.network) setNotice({ text: e.message, error: true }) })
  }, [])

  useEffect(() => {
    if (resetToken === null) check(); else setAuth({ state: 'out', user: null })
    const onLogout = (e) => {
      setAuth({ state: 'out', user: null })
      if (e.detail?.expired) {
        const r = e.detail.reason
        setNotice(r === 'no_credentials'
          ? { text: 'You were signed out because your browser stopped sending the login token (third-party cookies or storage may be blocked). Please log in again.', error: true }
          : { text: 'Your session has expired. Please log in again.' })
      }
    }
    authEvents.addEventListener('logout', onLogout)
    return () => authEvents.removeEventListener('logout', onLogout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const logout = useCallback(async () => {
    await api.logout().catch(() => {})
    setNotice({ text: 'You have been logged out.' })
    setAuth({ state: 'out', user: null })
  }, [])
  const leaveReset = useCallback((text) => {
    window.history.replaceState(null, '', '/')
    setResetToken(null)
    if (text) setNotice({ text })
  }, [])

  if (window.location.pathname === '/pricing') return auth.state === 'loading' ? <div className="app-loading"><JiraLogo size={40} /><div className="spinner" /></div> : <PricingPage loggedIn={auth.state === 'in'} />
  if (auth.state === 'loading') return <div className="app-loading"><JiraLogo size={40} /><div className="spinner" /></div>
  if (auth.state === 'out') {
    return (
      <LoginPage
        notice={notice}
        resetToken={resetToken}
        initialMode={window.location.pathname === '/signup' ? 'signup' : 'login'}
        onLeaveReset={leaveReset}
        onLogin={(user) => {
          setNotice(null)
          if (['/reset-password', '/login', '/signup'].includes(window.location.pathname)) window.history.replaceState(null, '', '/')
          setAuth({ state: 'in', user })
        }}
      />
    )
  }
  return <Shell key={auth.user.id} onLogout={logout} />
}

export default function App() {
  return <ToastProvider><Root /></ToastProvider>
}
