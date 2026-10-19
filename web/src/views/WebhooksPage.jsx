import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon } from '../icons.jsx'
import { Confirm, Dropdown, MenuItem, Modal, fmtDateTime, timeAgo } from '../components/ui.jsx'

/** Site admin: outgoing webhooks (Jira-compatible payloads, HMAC-signed), delivery log and redelivery. */
export default function WebhooksSection() {
  const { toast } = useApp()
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [log, setLog] = useState(null)
  const [testing, setTesting] = useState(null)
  const load = useCallback(() => api.webhooks().then(setData).catch((e) => setErr(e.message)), [])
  useEffect(() => { load() }, [load])
  if (err) return <div className="field-error"><Icon name="warning" size={14} />{err}</div>
  if (!data) return <div className="spinner" />

  const toggle = async (w) => {
    setData((d) => ({ ...d, webhooks: d.webhooks.map((x) => (x.id === w.id ? { ...x, enabled: !w.enabled } : x)) }))
    try { await api.updateWebhook(w.id, { enabled: !w.enabled }); toast(`Webhook ${w.enabled ? 'disabled' : 'enabled'}`) } catch (e) { toast({ title: 'Couldn’t update webhook', description: e.message, error: true }); load() }
  }
  const test = async (w) => {
    setTesting(w.id)
    try {
      const r = await api.testWebhook(w.id)
      toast(r.ok ? { title: `Test delivered: HTTP ${r.status}` } : { title: 'Test delivery failed', description: r.error || `HTTP ${r.status}`, error: true })
      load()
    } catch (e) { toast({ title: 'Test failed', description: e.message, error: true }) } finally { setTesting(null) }
  }

  return (
    <div className="auto-page" data-testid="webhooks">
      <div className="row-between">
        <div><h2 style={{ margin: 0 }}>Webhooks</h2><p className="muted" style={{ margin: '4px 0 0' }}>Notify other systems when work changes. Payloads follow the Jira webhook format and are signed with <code>X-Hub-Signature: sha256=…</code> when a secret is set.</p></div>
        <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" size={16} />Create a webhook</button>
      </div>
      {data.webhooks.length === 0 && <div className="empty-state"><Icon name="webhook" size={36} /><h3>No webhooks</h3><p>Create one to send work item events to a URL.</p></div>}
      {data.webhooks.map((w) => (
        <div key={w.id} className="wh-card" data-webhook={w.name}>
          <div className="wh-head">
            <span className={`dot ${!w.lastDelivery ? '' : w.lastDelivery.ok ? 'ok' : 'bad'}`} title={w.lastDelivery ? `Last delivery ${w.lastDelivery.ok ? 'succeeded' : 'failed'} (${w.lastDelivery.status ?? 'no response'})` : 'No deliveries yet'} />
            <span className="wh-name">{w.name}</span>
            {!w.enabled && <span className="rule-status no_actions">Disabled</span>}
            {w.hasSecret && <span className="muted small inline-flex" title="Payloads are signed"><Icon name="lock" size={12} />Signed</span>}
            <span className="spacer" style={{ flex: 1 }} />
            <span className="muted small">{w.deliveries ? `${w.succeeded}/${w.deliveries} delivered` : 'No deliveries'}{w.lastDelivery ? ` · last ${timeAgo(w.lastDelivery.at)}` : ''}</span>
            <label className="switch" title={w.enabled ? 'Disable webhook' : 'Enable webhook'}><input type="checkbox" aria-label={`Enable ${w.name}`} checked={w.enabled} onChange={() => toggle(w)} /><span /></label>
            <Dropdown align="end" minWidth={180} trigger={({ ref, toggle: t }) => <button ref={ref} className="icon-btn" title="Webhook actions" onClick={t}><Icon name="more" size={16} /></button>}>
              {(close) => <>
                <MenuItem onClick={() => { close(); setEditing(w) }}>Edit</MenuItem>
                <MenuItem disabled={testing === w.id} onClick={() => { close(); test(w) }}>Send test (ping)</MenuItem>
                <MenuItem onClick={() => { close(); setLog(w) }}>View deliveries</MenuItem>
                <MenuItem danger onClick={() => { close(); setDeleting(w) }}>Delete</MenuItem>
              </>}
            </Dropdown>
          </div>
          <div className="wh-url">POST {w.url}</div>
          <div className="wh-events">{w.events.map((e) => <span key={e} className="wh-event">{data.events[e] || e}</span>)}{w.jql && <span className="wh-event" title="Only work items matching this JQL">JQL: {w.jql}</span>}</div>
        </div>
      ))}
      {editing && <WebhookModal hook={editing.id ? editing : null} events={data.events} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {log && <DeliveriesModal hook={log} onClose={() => { setLog(null); load() }} />}
      {deleting && <Confirm title={`Delete “${deleting.name}”?`} body="Masar stops sending events to this URL and deletes its delivery log." confirmLabel="Delete webhook"
        onClose={() => setDeleting(null)} onConfirm={async () => { await api.deleteWebhook(deleting.id); toast('Webhook deleted'); setDeleting(null); load() }} />}
    </div>
  )
}

function WebhookModal({ hook, events, onClose, onSaved }) {
  const { toast } = useApp()
  const [f, setF] = useState(() => ({ name: hook?.name || '', url: hook?.url || 'https://', secret: '', events: hook?.events || ['jira:issue_created', 'jira:issue_updated'], jql: hook?.jql || '', enabled: hook ? hook.enabled : true }))
  const [err, setErr] = useState(null)
  const save = async (e) => {
    e.preventDefault(); setErr(null)
    const body = { ...f }
    if (hook && !body.secret) delete body.secret // keep the current secret
    try { if (hook) await api.updateWebhook(hook.id, body); else await api.createWebhook(body); toast(hook ? 'Webhook saved' : 'Webhook created'); onSaved() } catch (e2) { setErr(e2.message) }
  }
  const toggleEvent = (k) => setF((x) => ({ ...x, events: x.events.includes(k) ? x.events.filter((y) => y !== k) : [...x.events, k] }))
  return (
    <Modal onClose={onClose} width={600}>
      <form onSubmit={save}>
        <div className="modal-header"><h2>{hook ? 'Edit webhook' : 'Create a webhook'}</h2><button type="button" className="icon-btn" onClick={onClose} title="Close"><Icon name="close" size={18} /></button></div>
        <div className="modal-body scroll">
          <div className="field"><label className="field-title" htmlFor="wh-name">Name <span className="req">*</span></label><input id="wh-name" className="text-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></div>
          <div className="field"><label className="field-title" htmlFor="wh-url">URL <span className="req">*</span></label><input id="wh-url" className="text-input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></div>
          <div className="field"><label className="field-title" htmlFor="wh-secret">Secret</label><input id="wh-secret" className="text-input" type="password" autoComplete="new-password" value={f.secret} onChange={(e) => setF({ ...f, secret: e.target.value })} placeholder={hook?.hasSecret ? 'Leave empty to keep the current secret' : 'Optional: used to sign payloads (HMAC-SHA256)'} /></div>
          <div className="field"><label className="field-title">Events</label>
            <div className="event-checks">{Object.entries(events).map(([k, label]) => <label key={k}><input type="checkbox" checked={f.events.includes(k)} onChange={() => toggleEvent(k)} />{label}</label>)}</div>
          </div>
          <div className="field"><label className="field-title" htmlFor="wh-jql">JQL filter</label><input id="wh-jql" className="text-input" value={f.jql} onChange={(e) => setF({ ...f, jql: e.target.value })} placeholder="e.g. project = KAN AND type = Bug" /><div className="hint">Work item events are only sent for items matching this JQL. Leave empty for all.</div></div>
          <label className="row-gap"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />Enabled</label>
          {err && <div className="field-error"><Icon name="warning" size={14} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary">{hook ? 'Save' : 'Create'}</button></div>
      </form>
    </Modal>
  )
}

function DeliveriesModal({ hook, onClose }) {
  const { toast } = useApp()
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(null)
  const load = useCallback(() => api.webhookDeliveries(hook.id).then(setRows).catch(() => setRows([])), [hook.id])
  useEffect(() => { load() }, [load])
  const show = async (d) => { if (open?.id === d.id) { setOpen(null); return } setOpen(await api.webhookDelivery(d.id)) }
  const redeliver = async (d) => {
    try { const r = await api.redeliver(d.id); toast(r.ok ? `Redelivered: HTTP ${r.status}` : { title: 'Redelivery failed', description: r.error || `HTTP ${r.status}`, error: true }); load() } catch (e) { toast({ title: 'Redelivery failed', description: e.message, error: true }) }
  }
  return (
    <Modal onClose={onClose} width={860}>
      <div className="modal-header"><h2>Deliveries: {hook.name}</h2><button className="icon-btn" onClick={onClose} title="Close"><Icon name="close" size={18} /></button></div>
      <div className="modal-body scroll">
        {!rows ? <div className="spinner" /> : rows.length === 0 ? <div className="empty-state"><Icon name="webhook" size={32} /><p>No deliveries yet. Send a test to check the endpoint.</p></div> : (
          <table className="data-table">
            <thead><tr><th style={{ width: 24 }} /><th style={{ width: 150 }}>When</th><th>Event</th><th style={{ width: 80 }}>Response</th><th style={{ width: 60 }}>Try</th><th style={{ width: 80 }} className="right">Time</th><th style={{ width: 100 }} /></tr></thead>
            <tbody>
              {rows.map((d) => (
                <React.Fragment key={d.id}>
                  <tr className="delivery-row" onClick={() => show(d)} data-ok={d.ok ? '1' : '0'}>
                    <td><span className={`dot ${d.ok ? 'ok' : 'bad'}`} /></td>
                    <td title={fmtDateTime(d.created)}>{timeAgo(d.created)}</td>
                    <td><code>{d.event}</code>{d.error && <div className="danger-text small">{d.error}</div>}</td>
                    <td>{d.status ?? '—'}</td>
                    <td>{d.attempt}</td>
                    <td className="right muted small">{d.durationMs != null ? `${d.durationMs} ms` : ''}</td>
                    <td className="right"><button className="btn small" onClick={(e) => { e.stopPropagation(); redeliver(d) }}>Redeliver</button></td>
                  </tr>
                  {open?.id === d.id && (
                    <tr><td colSpan={7}>
                      <div className="motion-fade-in" style={{ display: 'grid', gap: 8 }}>
                        <div className="muted small">Delivery {open.uuid}</div>
                        <b className="small">Payload</b><pre className="payload">{JSON.stringify(open.payload, null, 2)}</pre>
                        {open.response && <><b className="small">Response</b><pre className="payload">{open.response}</pre></>}
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  )
}
