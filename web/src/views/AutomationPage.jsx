import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon } from '../icons.jsx'
import { Avatar, Confirm, Dropdown, MenuItem, Modal, fmtDateTime, timeAgo } from '../components/ui.jsx'

const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest']
const ASSIGN_TO = [['balanced', 'Balanced workload (fewest open items)'], ['reporter', 'Reporter'], ['initiator', 'User who triggered the event'], ['lead', 'Project lead'], ['unassigned', 'Unassigned']]
const WATCHER = [['reporter', 'Reporter'], ['assignee', 'Assignee'], ['initiator', 'User who triggered the event']]
const ACTION_LABELS = { assign: 'Assign', transition: 'Transition', set_priority: 'Priority', add_label: 'Label', comment: 'Comment', add_watcher: 'Watcher', set_story_points: 'Story points' }
const SMART = ['{{issue.key}}', '{{issue.summary}}', '{{issue.status}}', '{{issue.assignee.displayName}}', '{{issue.reporter.displayName}}', '{{initiator.displayName}}']

function triggerText(t, triggers) {
  const base = triggers?.[t.type]?.label || t.type
  if (t.type === 'issue_transitioned') return `${base}${t.from ? ` from ${t.from}` : ''}${t.to ? ` to ${t.to}` : ''}`
  if (t.type === 'field_changed') return `${base}: ${t.field}`
  return base
}
function actionText(a, userById) {
  const who = (id, list) => list.find(([k]) => k === id)?.[1] || userById[id]?.name || id
  switch (a.type) {
    case 'assign': return `Assign to ${who(a.to, ASSIGN_TO)}`
    case 'transition': return `Transition to ${a.status}`
    case 'set_priority': return `Set priority to ${a.priority}`
    case 'add_label': return `Add label “${a.label}”`
    case 'comment': return 'Add a comment'
    case 'add_watcher': return `Add ${who(a.userId, WATCHER)} as watcher`
    case 'set_story_points': return `Set story points to ${a.value ?? 'empty'}`
    default: return a.type
  }
}
const StatusChip = ({ status, label }) => (status ? <span className={`rule-status ${status}`}>{label || status.replace('_', ' ')}</span> : <span className="muted small">Never run</span>)

export function AutomationSection() {
  const { meta, can, toast, userById } = useApp()
  const pk = meta.project.key
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [tab, setTab] = useState('rules')
  const [editing, setEditing] = useState(null) // rule | {} for new
  const [deleting, setDeleting] = useState(null)
  const [running, setRunning] = useState(null)
  const [history, setHistory] = useState(null)
  const load = useCallback(() => api.automation(pk).then(setData).catch((e) => setErr(e.message)), [pk])
  useEffect(() => { if (can('ADMINISTER_PROJECT')) load() }, [load]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!can('ADMINISTER_PROJECT')) return <div><h2>Automation</h2><div className="notice-inline"><Icon name="lock" size={14} />Only project administrators can manage automation rules.</div></div>
  if (err) return <div className="field-error"><Icon name="warning" size={14} />{err}</div>
  if (!data) return <div className="spinner" />

  const toggle = async (r) => {
    setData((d) => ({ ...d, rules: d.rules.map((x) => (x.id === r.id ? { ...x, enabled: !r.enabled } : x)) }))
    try { await api.updateRule(r.id, { enabled: !r.enabled }); toast(`Rule ${r.enabled ? 'disabled' : 'enabled'}`) } catch (e) { toast({ title: 'Couldn’t update rule', description: e.message, error: true }); load() }
  }
  const fromTemplate = async (t) => {
    try { const r = await api.createRule(pk, { templateId: t.id, name: t.name, enabled: false }); toast({ title: 'Rule created from template', description: 'It’s disabled until you turn it on.' }); setTab('rules'); await load(); setEditing(r) } catch (e) { toast({ title: 'Couldn’t create rule', description: e.message, error: true }) }
  }
  const u = data.usage
  const pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0

  return (
    <div className="auto-page" data-testid="automation">
      <div className="row-between">
        <div><h2 style={{ margin: 0 }}>Automation</h2><p className="muted" style={{ margin: '4px 0 0' }}>Automate repetitive work with rules: <b>when</b> something happens, <b>if</b> conditions match, <b>then</b> do something.</p></div>
        <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" size={16} />Create rule</button>
      </div>
      <div className="auto-usage">
        <Icon name="lightning" size={18} />
        <div><b>{u.used}</b>{u.limit ? ` of ${u.limit.toLocaleString()}` : ''} rule runs this month <span className="muted small">· {u.plan[0].toUpperCase() + u.plan.slice(1)} plan · resets {fmtDateTime(u.resetsAt).split(',')[0]}</span></div>
        {u.limit ? <div className={`usage-bar ${pct > 90 ? 'danger' : pct > 70 ? 'warn' : ''}`}><span style={{ width: `${pct}%` }} /></div> : <span className="muted small">Unlimited</span>}
      </div>
      <div className="chip-tabs">
        {[['rules', `Rules (${data.rules.length})`], ['audit', 'Audit log'], ['templates', 'Templates']].map(([id, label]) => (
          <button key={id} className={`chip-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'rules' && (data.rules.length === 0 ? (
        <div className="empty-state"><Icon name="robot" size={36} /><h3>No rules yet</h3><p>Start from a template or create your own rule.</p><button className="btn" onClick={() => setTab('templates')}>Browse templates</button></div>
      ) : data.rules.map((r) => (
        <div key={r.id} className={`auto-rule ${r.enabled ? '' : 'disabled'}`} data-rule={r.name}>
          <span className="rule-icon"><Icon name="lightning" size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <button className="link rule-name" onClick={() => setEditing(r)}>{r.name}</button>
            <div className="rule-sub">{triggerText(r.trigger, data.triggers)}{r.condition ? ` · if ${r.condition}` : ''} · {r.actions.map((a) => actionText(a, userById)).join(', ')}</div>
            <div className="rule-sub">{r.runs} run{r.runs === 1 ? '' : 's'}{r.lastRun ? ` · last ${timeAgo(r.lastRun)}` : ''}{r.failed ? ` · ${r.failed} failed` : ''}</div>
          </div>
          <StatusChip status={r.lastStatus} />
          <label className="switch" title={r.enabled ? 'Disable rule' : 'Enable rule'}><input type="checkbox" aria-label={`Enable ${r.name}`} checked={r.enabled} onChange={() => toggle(r)} /><span /></label>
          <Dropdown align="end" minWidth={180} trigger={({ ref, toggle: t }) => <button ref={ref} className="icon-btn" title="Rule actions" onClick={t}><Icon name="more" size={16} /></button>}>
            {(close) => <>
              <MenuItem onClick={() => { close(); setEditing(r) }}>Edit rule</MenuItem>
              <MenuItem onClick={() => { close(); setRunning(r) }}>Run rule on a work item</MenuItem>
              <MenuItem onClick={() => { close(); setHistory(r) }}>View run history</MenuItem>
              <MenuItem danger onClick={() => { close(); setDeleting(r) }}>Delete</MenuItem>
            </>}
          </Dropdown>
        </div>
      )))}

      {tab === 'audit' && <AutomationAudit pk={pk} />}

      {tab === 'templates' && (
        <div className="template-grid">
          {data.templates.map((t) => (
            <button key={t.id} className="template-card" onClick={() => fromTemplate(t)}>
              <span className="rule-icon" style={{ width: 28, height: 28, borderRadius: 6, background: '#FFF5DB', color: '#B38600', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="lightning" size={16} /></span>
              <span><b>{t.name}</b><div className="muted small">{triggerText(t.trigger, data.triggers)}{t.condition ? ` · if ${t.condition}` : ''}</div></span>
            </button>
          ))}
        </div>
      )}

      {editing && <RuleEditor rule={editing.id ? editing : null} data={data} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {running && <RunRuleModal rule={running} onClose={() => setRunning(null)} onDone={load} />}
      {history && <RunHistoryModal rule={history} onClose={() => setHistory(null)} />}
      {deleting && <Confirm title={`Delete “${deleting.name}”?`} body="The rule and its run history are deleted. This can’t be undone." confirmLabel="Delete rule"
        onClose={() => setDeleting(null)} onConfirm={async () => { await api.deleteRule(deleting.id); toast('Rule deleted'); setDeleting(null); load() }} />}
    </div>
  )
}

function RunsTable({ runs, showRule }) {
  if (!runs) return <div className="spinner" />
  if (!runs.length) return <div className="empty-state"><Icon name="history" size={32} /><p>No rule executions yet.</p></div>
  return (
    <table className="data-table">
      <thead><tr><th style={{ width: 150 }}>When</th>{showRule && <th>Rule</th>}<th style={{ width: 90 }}>Work item</th><th style={{ width: 130 }}>Status</th><th>Details</th><th style={{ width: 70 }} className="right">Time</th></tr></thead>
      <tbody>
        {runs.map((x) => (
          <tr key={x.id} className="run-row" data-status={x.status}>
            <td title={fmtDateTime(x.created)}>{timeAgo(x.created)}</td>
            {showRule && <td>{x.ruleName}</td>}
            <td>{x.issueKey || '—'}</td>
            <td><StatusChip status={x.status} label={x.statusLabel} /></td>
            <td><div className="run-actions">{x.message && <div>{x.message}</div>}{x.actions.map((a, i) => <div key={i} className={a.ok === false ? 'bad' : ''}>{a.ok === false ? '✕' : '✓'} {ACTION_LABELS[a.type] || a.type}{a.detail ? `: ${a.detail}` : ''}</div>)}</div></td>
            <td className="right muted small">{x.durationMs != null ? `${x.durationMs} ms` : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AutomationAudit({ pk }) {
  const [status, setStatus] = useState('')
  const [runs, setRuns] = useState(null)
  useEffect(() => { setRuns(null); api.automationAudit(pk, status).then(setRuns).catch(() => setRuns([])) }, [pk, status])
  return (
    <div>
      <div className="toolbar">
        <select className="text-input auto" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="success">Success</option><option value="no_actions">No actions performed</option><option value="some_errors">Some errors</option><option value="failure">Failure</option><option value="throttled">Throttled</option>
        </select>
      </div>
      <RunsTable runs={runs} showRule />
    </div>
  )
}

function RunHistoryModal({ rule, onClose }) {
  const [runs, setRuns] = useState(null)
  useEffect(() => { api.ruleRuns(rule.id).then(setRuns).catch(() => setRuns([])) }, [rule.id])
  return (
    <Modal onClose={onClose} width={860}>
      <div className="modal-header"><h2>Run history: {rule.name}</h2><button className="icon-btn" onClick={onClose} title="Close"><Icon name="close" size={18} /></button></div>
      <div className="modal-body scroll"><RunsTable runs={runs} /></div>
    </Modal>
  )
}

function RunRuleModal({ rule, onClose, onDone }) {
  const { toast, bump } = useApp()
  const [key, setKey] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      const r = await api.runRule(rule.id, key.trim().toUpperCase())
      toast({ title: `Rule ran on ${key.trim().toUpperCase()}: ${r.statusLabel}`, description: r.message || undefined, error: r.status === 'failure' })
      bump(); onDone(); onClose()
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <Modal onClose={onClose} width={440}>
      <form onSubmit={run}>
        <div className="modal-header"><h2>Run rule</h2></div>
        <div className="modal-body">
          <p className="muted" style={{ marginTop: 0 }}>Runs “{rule.name}” on one work item now. The trigger is skipped but the condition is still checked.</p>
          <div className="field"><label className="field-title" htmlFor="run-key">Work item key</label><input id="run-key" className="text-input" autoFocus value={key} onChange={(e) => setKey(e.target.value)} placeholder={`${rule.project}-1`} /></div>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!key.trim() || busy}><Icon name="play" size={14} />Run</button></div>
      </form>
    </Modal>
  )
}

function ActionEditor({ a, onChange, data }) {
  const { activeUsers, meta } = useApp()
  const set = (patch) => onChange({ ...a, ...patch })
  const users = activeUsers.filter((x) => !x.bot)
  return (
    <div className="rb-row">
      <select className="text-input" aria-label="Action" value={a.type} onChange={(e) => onChange({ type: e.target.value })}>
        {Object.entries(data.actions).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      {a.type === 'assign' && <select className="text-input" aria-label="Assign to" value={a.to || ''} onChange={(e) => set({ to: e.target.value })}>
        <option value="" disabled>Choose…</option>{ASSIGN_TO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}<optgroup label="People">{users.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
      </select>}
      {a.type === 'transition' && <select className="text-input" aria-label="Status" value={a.status || ''} onChange={(e) => set({ status: e.target.value })}><option value="" disabled>Choose status…</option>{meta.statuses.map((s) => <option key={s}>{s}</option>)}</select>}
      {a.type === 'set_priority' && <select className="text-input" aria-label="Priority" value={a.priority || ''} onChange={(e) => set({ priority: e.target.value })}><option value="" disabled>Choose priority…</option>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select>}
      {a.type === 'add_label' && <input className="text-input" aria-label="Label" value={a.label || ''} onChange={(e) => set({ label: e.target.value })} placeholder="label" />}
      {a.type === 'add_watcher' && <select className="text-input" aria-label="Watcher" value={a.userId || ''} onChange={(e) => set({ userId: e.target.value })}>
        <option value="" disabled>Choose…</option>{WATCHER.map(([k, l]) => <option key={k} value={k}>{l}</option>)}<optgroup label="People">{users.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
      </select>}
      {a.type === 'set_story_points' && <input className="text-input" type="number" min={0} aria-label="Story points" value={a.value ?? ''} onChange={(e) => set({ value: e.target.value === '' ? null : Number(e.target.value) })} placeholder="e.g. 3" />}
      {a.type === 'comment' && <textarea className="text-input" rows={2} aria-label="Comment" value={a.body || ''} onChange={(e) => set({ body: e.target.value })} placeholder="Hi {{issue.reporter.displayName}}, …" />}
    </div>
  )
}

function RuleEditor({ rule, data, onClose, onSaved }) {
  const { meta, toast } = useApp()
  const [f, setF] = useState(() => (rule
    ? { name: rule.name, description: rule.description || '', enabled: rule.enabled, trigger: rule.trigger, condition: rule.condition || '', actions: rule.actions }
    : { name: '', description: '', enabled: true, trigger: { type: 'issue_created' }, condition: '', actions: [{ type: 'comment', body: '' }] }))
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const setTrig = (patch) => setF((x) => ({ ...x, trigger: { ...x.trigger, ...patch } }))
  const save = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      if (rule) await api.updateRule(rule.id, f); else await api.createRule(meta.project.key, f)
      toast(rule ? 'Rule saved' : 'Rule created'); onSaved()
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <Modal onClose={onClose} width={720} labelledBy="rule-title">
      <form onSubmit={save}>
        <div className="modal-header"><h2 id="rule-title">{rule ? 'Edit rule' : 'Create rule'}</h2><button type="button" className="icon-btn" onClick={onClose} title="Close"><Icon name="close" size={18} /></button></div>
        <div className="modal-body scroll">
          <div className="field"><label className="field-title" htmlFor="rule-name">Rule name <span className="req">*</span></label><input id="rule-name" className="text-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Assign new bugs to the reporter" autoFocus={!rule} /></div>
          <div className="rule-builder">
            <div className="rb-step">
              <span className="rb-badge when"><Icon name="lightning" size={16} /></span>
              <div className="rb-content"><span className="rb-label">When: trigger</span>
                <div className="rb-row">
                  <select className="text-input" aria-label="Trigger" value={f.trigger.type} onChange={(e) => setF({ ...f, trigger: { type: e.target.value } })}>
                    {Object.entries(data.triggers).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  {f.trigger.type === 'issue_transitioned' && <>
                    <select className="text-input" aria-label="From status" value={f.trigger.from || ''} onChange={(e) => setTrig({ from: e.target.value || undefined })}><option value="">From any status</option>{meta.statuses.map((s) => <option key={s} value={s}>From {s}</option>)}</select>
                    <select className="text-input" aria-label="To status" value={f.trigger.to || ''} onChange={(e) => setTrig({ to: e.target.value || undefined })}><option value="">To any status</option>{meta.statuses.map((s) => <option key={s} value={s}>To {s}</option>)}</select>
                  </>}
                  {f.trigger.type === 'field_changed' && <select className="text-input" aria-label="Field" value={f.trigger.field || ''} onChange={(e) => setTrig({ field: e.target.value })}><option value="" disabled>Choose field…</option>{data.fields.map((x) => <option key={x} value={x}>{x}</option>)}</select>}
                </div>
              </div>
            </div>
            <div className="rb-connector" />
            <div className="rb-step">
              <span className="rb-badge if"><Icon name="filter" size={16} /></span>
              <div className="rb-content"><span className="rb-label">If: JQL condition (optional)</span>
                <input className="text-input" aria-label="Condition" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} placeholder="e.g. type = Bug AND priority in (High, Highest)" />
                <span className="hint">The rule only acts when the work item matches this JQL. Leave empty to always run.</span>
              </div>
            </div>
            {f.actions.map((a, i) => (
              <React.Fragment key={i}>
                <div className="rb-connector" />
                <div className="rb-step" data-action-index={i}>
                  <span className="rb-badge then"><Icon name="check" size={16} /></span>
                  <div className="rb-content"><span className="rb-label">Then: action {f.actions.length > 1 ? i + 1 : ''}</span>
                    <ActionEditor a={a} data={data} onChange={(na) => setF((x) => ({ ...x, actions: x.actions.map((y, j) => (j === i ? na : y)) }))} />
                  </div>
                  {f.actions.length > 1 && <button type="button" className="icon-btn rb-remove" title="Remove action" onClick={() => setF((x) => ({ ...x, actions: x.actions.filter((_, j) => j !== i) }))}><Icon name="trash" size={14} /></button>}
                </div>
              </React.Fragment>
            ))}
            <div className="rb-connector" />
            <div><button type="button" className="btn subtle" disabled={f.actions.length >= 10} onClick={() => setF((x) => ({ ...x, actions: [...x.actions, { type: 'add_label', label: '' }] }))}><Icon name="plus" size={14} />Add action</button></div>
          </div>
          <div className="smart-hint hint" style={{ marginTop: 12 }}>Smart values you can use in comments: {SMART.map((s) => <code key={s} style={{ marginRight: 4 }}>{s}</code>)}</div>
          <label className="row-gap" style={{ marginTop: 12 }}><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />Rule is enabled</label>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{rule ? 'Save rule' : 'Turn it on'}</button></div>
      </form>
    </Modal>
  )
}

/* ---------------------------------------------------------------- CSV import */
const SAMPLE_CSV = `Summary,Issue Type,Priority,Status,Assignee,Labels,Story Points,Due Date,Original Estimate
Reconcile October card settlements,Task,High,To Do,sara@ahdfinancial.com,reconciliation,3,2026-10-30,1d
Investigate duplicate ledger postings,Bug,Highest,In Progress,omar@ahdfinancial.com,ledger urgent,5,,4h
Draft Q4 close checklist,Story,Medium,To Do,,close,2,2026-11-05,`

export function ImportSection() {
  const { meta, can, toast, bump, userById, openList } = useApp()
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  if (!can('CREATE_ISSUES')) return <div><h2>Import work items</h2><div className="notice-inline"><Icon name="lock" size={14} />You need the “Create work items” permission to import.</div></div>
  const readFile = (file) => { if (!file) return; const r = new FileReader(); r.onload = () => { setCsv(String(r.result)); setPreview(null); setDone(null) }; r.readAsText(file) }
  const check = async () => {
    setErr(null); setBusy(true)
    try { setPreview(await api.importCsv(meta.project.key, csv, true)) } catch (e) { setErr(e.message); setPreview(null) } finally { setBusy(false) }
  }
  const run = async () => {
    setErr(null); setBusy(true)
    try { const r = await api.importCsv(meta.project.key, csv, false); setDone(r); setPreview(null); setCsv(''); bump(); toast(`${r.count} work item${r.count === 1 ? '' : 's'} imported`) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="auto-page" data-testid="import">
      <div><h2 style={{ margin: 0 }}>Import work items from CSV</h2><p className="muted" style={{ margin: '4px 0 0' }}>Bring work from a spreadsheet or another tool into {meta.project.name}. Columns are matched by header name; you can preview before anything is created.</p></div>
      <div className={`import-drop ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); readFile(e.dataTransfer.files?.[0]) }}>
        <Icon name="upload" size={28} /><div><b>Drop a .csv file here</b> or <label className="link" style={{ cursor: 'pointer' }}>browse<input type="file" accept=".csv,text/csv" hidden onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = '' }} /></label></div>
        <div className="hint">Supported columns: Summary (required), Issue Type, Priority, Status, Assignee, Reporter, Labels, Story Points, Due Date, Start Date, Description, Sprint, Fix Version, Components, Original Estimate, Parent.</div>
      </div>
      <div className="field">
        <div className="row-between"><label className="field-title" htmlFor="csv-text">Or paste CSV</label><button type="button" className="link small" onClick={() => { setCsv(SAMPLE_CSV); setPreview(null); setDone(null) }}>Use a sample</button></div>
        <textarea id="csv-text" className="text-input" rows={7} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null) }} placeholder="Summary,Issue Type,Priority,…" />
      </div>
      {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
      <div className="row-gap">
        <button className="btn" disabled={!csv.trim() || busy} onClick={check}>Check CSV</button>
        <button className="btn primary" disabled={!preview || preview.errors.length > 0 || preview.valid === 0 || busy} onClick={run}>{preview ? `Import ${preview.valid} work item${preview.valid === 1 ? '' : 's'}` : 'Import'}</button>
      </div>
      {preview && (
        <div className="motion-fade-in" data-testid="import-preview">
          <h3 className="section-title">Column mapping</h3>
          <div className="wh-events">{preview.columns.map((c) => <span key={c.header} className={`map-chip ${c.field ? 'ok' : ''}`}>{c.header} → {c.field || 'ignored'}</span>)}</div>
          <p><b>{preview.valid}</b> of {preview.total} rows are ready to import{preview.errors.length ? <>; <span className="danger-text">{preview.errors.length} need fixing</span></> : ''}.</p>
          {preview.errors.length > 0 && <ul className="field-error" style={{ display: 'block' }}>{preview.errors.map((e) => <li key={e.line}>Row {e.line}: {e.error}</li>)}</ul>}
          {preview.preview.length > 0 && (
            <table className="data-table"><thead><tr><th style={{ width: 50 }}>Row</th><th>Summary</th><th>Type</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Labels</th></tr></thead>
              <tbody>{preview.preview.map((p) => <tr key={p.line}><td className="muted">{p.line}</td><td>{p.summary}</td><td>{p.type}</td><td>{p.status}</td><td>{p.priority}</td><td>{p.assigneeId ? <span className="inline-flex"><Avatar user={userById[p.assigneeId]} size={20} />{userById[p.assigneeId]?.name}</span> : <span className="muted">Unassigned</span>}</td><td>{p.labels.join(', ')}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
      {done && <div className="notice-inline success motion-fade-in"><Icon name="check" size={14} />Created {done.count} work items ({done.created[0]}{done.count > 1 ? ` – ${done.created[done.created.length - 1]}` : ''}). <button className="link" onClick={() => openList(`project = ${meta.project.key} ORDER BY created DESC`)}>View them</button></div>}
    </div>
  )
}
