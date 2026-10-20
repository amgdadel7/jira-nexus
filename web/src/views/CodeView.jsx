import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, TypeIcon } from '../icons.jsx'
import { Avatar, Confirm, Dropdown, Lozenge, MenuItem, timeAgo } from '../components/ui.jsx'

const TABS = [
  { id: 'branch', label: 'Branches', icon: 'branch' },
  { id: 'commit', label: 'Commits', icon: 'commit' },
  { id: 'pr', label: 'Pull requests', icon: 'pr' },
]

export default function CodeView() {
  const { toast, refreshKey, userById, openIssue, bump } = useApp()
  const [items, setItems] = useState(null)
  const [tab, setTab] = useState('branch')
  const [repo, setRepo] = useState('')
  const [prStatus, setPrStatus] = useState('')
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [showHelp, setShowHelp] = useState(false)

  const load = useCallback(() => api.dev().then(setItems).catch((e) => toast({ title: 'Failed to load development data', description: e.message, error: true })), [toast])
  useEffect(() => { load() }, [load, refreshKey])

  const repos = useMemo(() => [...new Set((items || []).map((i) => i.repo))].sort(), [items])
  if (!items) return <div className="center-pad"><div className="spinner" /></div>

  const counts = Object.fromEntries(TABS.map((t) => [t.id, items.filter((i) => i.kind === t.id && (!repo || i.repo === repo)).length]))
  const shown = items.filter((i) => i.kind === tab && (!repo || i.repo === repo) && (tab !== 'pr' || !prStatus || i.status === prStatus)
    && (!q || `${i.name} ${i.ref || ''} ${i.issue?.key || ''} ${i.issue?.summary || ''}`.toLowerCase().includes(q.toLowerCase())))

  const setStatus = async (item, status, transition) => {
    try {
      const n = await api.updateDev(item.id, { status, transition })
      setItems((l) => l.map((x) => (x.id === n.id ? n : x)))
      if (transition && n.issue) { bump(); toast({ title: `Pull request merged`, description: `${n.issue.key} was moved to Done.` }) } else toast(`Pull request ${status}`)
    } catch (e) { toast({ title: 'Couldn’t update pull request', description: e.message, error: true }) }
  }
  const copy = (text, what) => { navigator.clipboard?.writeText(text).then(() => toast(`${what} copied to clipboard`), () => toast({ title: 'Copy failed', error: true })) }
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  const curl = `curl -X POST ${origin}/api/webhooks/commits \\
  -H "Authorization: Bearer <session-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"repo":"kan-web","commits":[{"id":"a1b2c3d","message":"KAN-12 Fix login redirect","authorEmail":"sara@ahdfinancial.com"}]}'`

  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h1>Code</h1><p className="muted">Branches, commits and pull requests that mention a work item key (like KAN-12) are linked automatically.</p></div>
        <button className="btn" onClick={() => setShowHelp((s) => !s)}><Icon name="info" size={16} />Connect a repository</button>
      </div>
      {showHelp && (
        <div className="info-box">
          <div className="info-box-head"><Icon name="info" size={18} /><b>Send commits from your CI or a git hook</b><span className="spacer" /><button className="icon-btn small" onClick={() => setShowHelp(false)}><Icon name="close" size={14} /></button></div>
          <p>POST commits to <code>/api/webhooks/commits</code>. Every work item key in a commit message links that commit to the item. Use the session token you get from <code>POST /api/auth/login</code>.</p>
          <pre className="code-block">{curl}</pre>
          <button className="btn small" onClick={() => copy(curl, 'Command')}><Icon name="copy" size={14} />Copy command</button>
        </div>
      )}
      <div className="code-tabs">
        {TABS.map((t) => <button key={t.id} className={`code-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}><Icon name={t.icon} size={16} />{t.label}<span className="count-pill">{counts[t.id]}</span></button>)}
      </div>
      <div className="toolbar">
        <label className="list-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${TABS.find((t) => t.id === tab).label.toLowerCase()}`} /></label>
        <Dropdown trigger={({ ref, toggle }) => <button ref={ref} className={`btn ${repo ? 'selected' : ''}`} onClick={toggle}><Icon name="folder" size={14} />{repo || 'All repositories'}<Icon name="chevronDown" size={14} /></button>}>
          {(close) => <div className="menu"><MenuItem selected={!repo} onClick={() => { close(); setRepo('') }}>All repositories</MenuItem>{repos.map((r) => <MenuItem key={r} selected={repo === r} onClick={() => { close(); setRepo(r) }}>{r}</MenuItem>)}</div>}
        </Dropdown>
        {tab === 'pr' && (
          <div className="segmented">
            {[['', 'All'], ['open', 'Open'], ['merged', 'Merged'], ['declined', 'Declined']].map(([v, l]) => <button key={v} className={prStatus === v ? 'on' : ''} onClick={() => setPrStatus(v)}>{l}</button>)}
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table className="simple-table code-table">
          <thead>
            <tr>
              <th>{tab === 'branch' ? 'Branch' : tab === 'commit' ? 'Commit message' : 'Pull request'}</th>
              {tab === 'commit' && <th style={{ width: 100 }}>Hash</th>}
              {tab === 'pr' && <th style={{ width: 110 }}>Status</th>}
              <th style={{ width: 130 }}>Repository</th>
              <th style={{ width: 300 }}>Work item</th>
              <th style={{ width: 150 }}>Author</th>
              <th style={{ width: 110 }}>Updated</th>
              <th style={{ width: 48 }} />
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.id}>
                <td><span className="code-name"><Icon name={TABS.find((t) => t.id === i.kind).icon} size={14} /><span className={i.kind === 'branch' ? 'mono' : ''}>{i.name}</span></span>{i.kind === 'pr' && i.ref && <div className="muted small mono">{i.ref}</div>}</td>
                {tab === 'commit' && <td className="mono">{(i.ref || '').slice(0, 7) || '—'}</td>}
                {tab === 'pr' && <td><span className={`pr-status ${i.status}`}>{i.status}</span></td>}
                <td>{i.repo}</td>
                <td>{i.issue ? <button className="code-issue" onClick={() => openIssue(i.issue.key)}><TypeIcon type={i.issue.type} size={14} /><span className="issue-key small">{i.issue.key}</span><span className="truncate">{i.issue.summary}</span><Lozenge status={i.issue.status} /></button> : <span className="muted">—</span>}</td>
                <td>{i.authorId ? <span className="inline-flex"><Avatar user={userById[i.authorId]} size={20} />{userById[i.authorId]?.name.split(' ')[0]}</span> : <span className="muted">—</span>}</td>
                <td className="muted">{timeAgo(i.created)}</td>
                <td>
                  <Dropdown align="end" trigger={({ ref, toggle }) => <button ref={ref} className="icon-btn small" onClick={toggle} aria-label="Actions"><Icon name="more" size={16} /></button>}>
                    {(close) => (
                      <div className="menu">
                        {i.kind === 'branch' && <MenuItem onClick={() => { close(); copy(`git checkout -b ${i.name}`, 'Command') }}>Copy checkout command</MenuItem>}
                        {i.kind === 'commit' && i.ref && <MenuItem onClick={() => { close(); copy(i.ref, 'Hash') }}>Copy commit hash</MenuItem>}
                        {i.kind === 'pr' && i.status !== 'merged' && <MenuItem onClick={() => { close(); setStatus(i, 'merged', true) }}>Merge and move item to Done</MenuItem>}
                        {i.kind === 'pr' && i.status !== 'merged' && <MenuItem onClick={() => { close(); setStatus(i, 'merged', false) }}>Merge</MenuItem>}
                        {i.kind === 'pr' && i.status === 'open' && <MenuItem onClick={() => { close(); setStatus(i, 'declined') }}>Decline</MenuItem>}
                        {i.kind === 'pr' && i.status !== 'open' && <MenuItem onClick={() => { close(); setStatus(i, 'open') }}>Reopen</MenuItem>}
                        <div className="menu-sep" />
                        <MenuItem danger onClick={() => { close(); setConfirm(i) }}>Remove link</MenuItem>
                      </div>
                    )}
                  </Dropdown>
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={8} className="empty-row">Nothing here yet. Create a branch from a work item’s Development panel.</td></tr>}
          </tbody>
        </table>
      </div>
      {confirm && <Confirm title="Remove this development link?" body={`“${confirm.name}” will no longer appear on ${confirm.issue?.key || 'the work item'}.`} confirmLabel="Remove" onConfirm={async () => { try { await api.deleteDev(confirm.id); load() } catch (e) { toast({ title: 'Failed', description: e.message, error: true }) } }} onClose={() => setConfirm(null)} />}
    </div>
  )
}
