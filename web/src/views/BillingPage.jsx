// Plans & billing (simulated payments), public pricing page, and site security settings
// (sign-up policy + OAuth providers for social login).
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { useApp } from '../ctx.js'
import { Icon, MasarLogo, MasarWordmark } from '../icons.jsx'
import { Modal } from '../components/ui.jsx'
import { CardBrandIcon, PROVIDER_ICONS } from '../components/BrandIcons.jsx'
import WebhooksSection from './WebhooksPage.jsx'

export const money = (cents, { free = false } = {}) => (free && !cents ? 'Free' : `$${(cents / 100).toFixed(2)}`)
export function fmtBytes(b) {
  if (b == null) return 'Unlimited'
  const GB = 1024 ** 3
  if (b >= GB) return `${+(b / GB).toFixed(b % GB ? 1 : 0)} GB`
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`
  if (b >= 1024) return `${Math.round(b / 1024)} KB`
  return `${b} B`
}
const day = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—')
const PLAN_COLORS = { free: '#626F86', standard: '#0C66E4', premium: '#6E5DC6' }
const ORDER = ['free', 'standard', 'premium']

export const ADMIN_SECTIONS = [
  { id: 'billing', label: 'Billing overview', icon: 'dashboard' },
  { id: 'plans', label: 'Plans', icon: 'star' },
  { id: 'invoices', label: 'Invoices', icon: 'book' },
  { id: 'security', label: 'Security & sign-in', icon: 'shield' },
  { id: 'webhooks', label: 'Webhooks', icon: 'webhook' },
]

/* ======================= plan cards (shared with the public pricing page) ======================= */
function CycleToggle({ cycle, setCycle }) {
  return (
    <div className="cycle-toggle" role="radiogroup" aria-label="Billing cycle">
      {[['monthly', 'Monthly'], ['annual', 'Annual']].map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={cycle === id} className={cycle === id ? 'on' : ''} onClick={() => setCycle(id)}>
          {label}{id === 'annual' && <span className="save-pill">Save ~17%</span>}
        </button>
      ))}
    </div>
  )
}

export function PlanCards({ plans, cycle, current, onChoose, chooseLabel, busy }) {
  return (
    <div className="plan-cards">
      {plans.map((p) => {
        const isCurrent = current && current.plan === p.key && (p.key === 'free' || current.cycle === cycle) && current.status !== 'trialing'
        const price = p.price[cycle]
        const perMonth = cycle === 'annual' ? price / 12 : price
        const rank = ORDER.indexOf(p.key) - ORDER.indexOf(current?.plan || 'free')
        return (
          <div key={p.key} className={`plan-card ${p.key === 'standard' ? 'popular' : ''} ${isCurrent ? 'current' : ''}`} data-plan={p.key}>
            {p.key === 'standard' && <div className="plan-ribbon">Most popular</div>}
            <div className="plan-name" style={{ color: PLAN_COLORS[p.key] }}>{p.name}</div>
            <div className="plan-tagline">{p.tagline}</div>
            <div className="plan-price">
              {price === 0 ? <><b>$0</b><span>free forever</span></> : <><b>{money(Math.round(perMonth))}</b><span>per user / month{cycle === 'annual' ? ', billed annually' : ''}</span></>}
            </div>
            {cycle === 'annual' && price > 0 && <div className="plan-annual muted small">{money(price)} per user / year</div>}
            <ul className="plan-features">
              {p.highlights.map((h) => <li key={h}><Icon name="check" size={14} strokeWidth={2.6} />{h}</li>)}
            </ul>
            {onChoose && (
              <button type="button" className={`btn ${p.key === 'free' ? '' : 'primary'} plan-cta`} disabled={isCurrent || busy}
                onClick={() => onChoose(p, rank)}>
                {isCurrent ? 'Current plan' : chooseLabel ? chooseLabel(p, rank) : rank > 0 ? `Upgrade to ${p.name}` : rank < 0 ? `Switch to ${p.name}` : `Switch to ${cycle}`}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

const COMPARE = [
  ['Users', (p) => (p.maxUsers == null ? 'Unlimited' : `Up to ${p.maxUsers}`)],
  ['Storage', (p) => fmtBytes(p.storageBytes)],
  ['Projects, boards, backlog & sprints', () => true],
  ['Timeline, calendar, reports & dashboards', () => true],
  ['Social login (Google, Microsoft, Apple, Slack)', () => true],
  ['Project roles & permission schemes', (p) => p.features.includes('permissions')],
  ['Limited & private projects', (p) => p.features.includes('permissions')],
  ['Global permissions', (p) => p.features.includes('permissions')],
  ['Audit log', (p) => p.features.includes('audit_log')],
  ['Recycle bin retention', (p) => `${p.trashDays} days`],
]
function CompareTable({ plans }) {
  return (
    <table className="data-table compare-table">
      <thead><tr><th>Features</th>{plans.map((p) => <th key={p.key} style={{ color: PLAN_COLORS[p.key] }}>{p.name}</th>)}</tr></thead>
      <tbody>
        {COMPARE.map(([label, fn]) => (
          <tr key={label}><td>{label}</td>{plans.map((p) => { const v = fn(p); return <td key={p.key}>{v === true ? <Icon name="check" size={16} strokeWidth={2.6} className="ok" /> : v === false ? <span className="muted">—</span> : v}</td> })}</tr>
        ))}
      </tbody>
    </table>
  )
}

/* ======================= public pricing page (/pricing) ======================= */
export function PricingPage({ loggedIn }) {
  const [data, setData] = useState(null)
  const [cycle, setCycle] = useState('monthly')
  const [err, setErr] = useState(null)
  useEffect(() => { document.title = 'Pricing - Masar'; api.plans().then(setData).catch((e) => setErr(e.message)) }, [])
  const go = (path) => { window.location.href = path }
  return (
    <div className="pricing-page">
      <header className="pricing-nav">
        <a href="/" className="pricing-brand"><MasarWordmark size={30} fontSize={24} /></a>
        <div className="grow" />
        {loggedIn ? <button className="btn primary" onClick={() => go('/jira/settings/plans')}>Manage your plan</button> : <>
          <button className="btn subtle" onClick={() => go('/login')}>Log in</button>
          <button className="btn primary" onClick={() => go('/signup')}>Get it free</button>
        </>}
      </header>
      <section className="pricing-hero">
        <h1>Plans that grow with your team</h1>
        <p>Start free for up to 10 users. Upgrade for permissions, private projects, audit logs and more.</p>
        <CycleToggle cycle={cycle} setCycle={setCycle} />
      </section>
      {err && <div className="login-error"><Icon name="warning" size={16} />{err}</div>}
      {!data ? <div className="center-pad"><div className="spinner" /></div> : (
        <div className="pricing-body">
          <PlanCards plans={data.plans} cycle={cycle} onChoose={(p) => go(loggedIn ? '/jira/settings/plans' : p.key === 'free' ? '/signup' : '/signup')}
            chooseLabel={(p) => (loggedIn ? `Choose ${p.name}` : p.key === 'free' ? 'Get it free' : `Try ${p.name} free`)} />
          <h2 className="pricing-h2">Compare plans</h2>
          <CompareTable plans={data.plans} />
          <p className="muted small center">Prices in USD, excluding taxes. Payments in this demo are simulated – no card is ever charged.</p>
        </div>
      )}
    </div>
  )
}

/* ======================= admin settings page (/jira/settings/:section) ======================= */
export default function AdminSettingsPage({ section, onSection }) {
  const { isAdmin, refreshMeta } = useApp()
  const [billing, setBilling] = useState(null)
  const [err, setErr] = useState(null)
  const load = useCallback(() => api.billing().then((b) => { setBilling(b); setErr(null) }).catch((e) => setErr(e.message)), [])
  useEffect(() => { load() }, [load])
  const reload = useCallback(() => { load(); refreshMeta() }, [load, refreshMeta])
  const sections = ADMIN_SECTIONS.filter((s) => isAdmin || s.id === 'billing' || s.id === 'plans')
  const sec = sections.some((s) => s.id === section) ? section : 'billing'
  return (
    <div className="settings-layout admin-settings">
      <nav className="settings-nav" aria-label="Site settings">
        <div className="settings-nav-head"><MasarLogo size={24} /><div><b>Masar settings</b><div className="muted small">Site administration</div></div></div>
        {sections.map((s) => (
          <button key={s.id} className={`side-item ${sec === s.id ? 'active' : ''}`} onClick={() => onSection(s.id)} aria-current={sec === s.id ? 'page' : undefined}><Icon name={s.icon} size={16} /><span className="side-label">{s.label}</span></button>
        ))}
      </nav>
      <div className="settings-content">
        {err && <div className="login-error"><Icon name="warning" size={16} />{err}</div>}
        {sec === 'security' ? <SecuritySettings /> : sec === 'webhooks' ? <WebhooksSection /> : !billing ? <div className="spinner" /> : (
          <>
            {sec === 'billing' && <BillingOverview b={billing} reload={reload} onPlans={() => onSection('plans')} onInvoices={() => onSection('invoices')} />}
            {sec === 'plans' && <PlansSection b={billing} reload={reload} />}
            {sec === 'invoices' && <InvoicesSection />}
          </>
        )}
      </div>
    </div>
  )
}

function UsageBar({ label, used, max, fmt = (x) => x }) {
  const pct = max == null ? Math.min(100, used ? 6 : 0) : Math.min(100, Math.round((used / max) * 100))
  const tone = max != null && pct >= 90 ? 'danger' : max != null && pct >= 75 ? 'warn' : ''
  return (
    <div className="usage-row">
      <div className="usage-head"><span>{label}</span><b>{fmt(used)} <span className="muted">of {max == null ? 'Unlimited' : fmt(max)}</span></b></div>
      <div className={`usage-bar ${tone}`}><span style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function StatusLozenge({ s }) {
  if (s.status === 'trialing') return <span className="lozenge new">Trial</span>
  if (s.status === 'past_due') return <span className="lozenge removed">Past due</span>
  if (s.cancelAtPeriodEnd) return <span className="lozenge moved">Cancels {day(s.currentPeriodEnd)}</span>
  return <span className="lozenge success">Active</span>
}

function BillingOverview({ b, reload, onPlans, onInvoices }) {
  const { toast } = useApp()
  const s = b.subscription
  const [busy, setBusy] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const act = async (fn, msg) => {
    setBusy(true)
    try { await fn(); toast(msg); reload() } catch (e) { toast({ title: e.message, error: true }) } finally { setBusy(false); setConfirmCancel(false) }
  }
  return (
    <div className="page-pad billing-page">
      <div className="page-head"><div><h2>Billing overview</h2><p className="muted">Your Masar subscription, usage and payment details.</p></div></div>
      <div className="billing-grid">
        <section className="billing-card plan-summary" data-plan={s.plan}>
          <div className="billing-card-head"><h3>Current plan</h3><StatusLozenge s={s} /></div>
          <div className="plan-summary-name" style={{ color: PLAN_COLORS[s.plan] }}>{s.planName}{s.plan !== 'free' && <span className="muted"> · {s.cycle}</span>}</div>
          {s.status === 'trialing' && <p className="muted">Free trial ends {day(s.trialEndsAt)}. Add a card and choose a plan to keep {s.planName} features.</p>}
          {s.plan !== 'free' && s.status !== 'trialing' && <p className="muted">{s.cancelAtPeriodEnd ? `Your site moves to Free on ${day(s.currentPeriodEnd)}.` : `Renews ${day(s.currentPeriodEnd)}.`}</p>}
          {s.plan === 'free' && <p className="muted">Up to 10 users and 2 GB storage. Upgrade for permissions, private projects and the audit log.</p>}
          <div className="row gap8 wrap">
            <button className="btn primary" onClick={onPlans}>{s.plan === 'premium' ? 'Change plan' : 'Upgrade plan'}</button>
            {b.canManage && s.plan === 'free' && !s.trialUsed && <button className="btn" disabled={busy} onClick={() => act(() => api.startTrial('premium'), 'Your 14-day Premium trial has started')}>Start 14-day Premium trial</button>}
            {b.canManage && s.plan !== 'free' && s.status !== 'trialing' && (s.cancelAtPeriodEnd
              ? <button className="btn" disabled={busy} onClick={() => act(api.resumeSubscription, 'Your subscription will renew')}>Resume subscription</button>
              : <button className="btn subtle danger-text" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel subscription</button>)}
          </div>
        </section>
        <section className="billing-card">
          <div className="billing-card-head"><h3>Usage</h3></div>
          <UsageBar label="Users" used={b.usage.users} max={s.limits.users} />
          <UsageBar label="Storage" used={b.usage.storageBytes} max={s.limits.storageBytes} fmt={fmtBytes} />
          <div className="usage-meta muted small">{b.usage.projects} projects · {b.usage.issues} work items · {s.limits.trashDays}-day recycle bin</div>
        </section>
        {b.canManage && (
          <section className="billing-card">
            <div className="billing-card-head"><h3>Next payment</h3></div>
            {b.upcoming ? (
              <>
                <div className="big-amount">{money(b.upcoming.total)}</div>
                <p className="muted">{b.upcoming.afterTrial ? 'After your trial, if you choose this plan' : `on ${day(b.upcoming.date)}`} · {b.upcoming.seats} users × {money(b.upcoming.unit)}</p>
              </>
            ) : <p className="muted">No upcoming payments.</p>}
            <button className="btn subtle" onClick={onInvoices}><Icon name="book" size={14} />View invoices</button>
          </section>
        )}
        {b.canManage && (
          <section className="billing-card">
            <div className="billing-card-head"><h3>Payment method</h3></div>
            {b.paymentMethod ? (
              <div className="card-line"><CardBrandIcon brand={b.paymentMethod.brand} /><div><b>{b.paymentMethod.brand} •••• {b.paymentMethod.last4}</b><div className="muted small">Expires {String(b.paymentMethod.expMonth).padStart(2, '0')}/{b.paymentMethod.expYear} · {b.paymentMethod.holder}</div></div></div>
            ) : <p className="muted">No card on file.</p>}
            <button className="btn" onClick={() => setCardOpen(true)}>{b.paymentMethod ? 'Update card' : 'Add card'}</button>
          </section>
        )}
        {b.canManage && <BillingDetails b={b} reload={reload} />}
        {!b.canManage && <section className="billing-card"><p className="muted"><Icon name="lock" size={14} /> Only site administrators can change the plan or see payment details.</p></section>}
      </div>
      {cardOpen && <CardModal onClose={() => setCardOpen(false)} onSaved={(r) => { setCardOpen(false); toast(r.paidInvoices ? `Card saved and ${r.paidInvoices} open invoice(s) paid` : 'Card saved'); reload() }} />}
      {confirmCancel && (
        <Modal onClose={() => setConfirmCancel(false)} width={460}>
          <div className="modal-header"><h2>Cancel your subscription?</h2></div>
          <div className="modal-body"><p>You’ll keep <b>{s.planName}</b> until <b>{day(s.currentPeriodEnd)}</b>. After that your site moves to the Free plan: permission schemes, limited/private access and the audit log will be switched off (your settings are kept if you upgrade again).</p></div>
          <div className="modal-footer"><button className="btn subtle" onClick={() => setConfirmCancel(false)}>Keep plan</button><button className="btn danger" disabled={busy} onClick={() => act(api.cancelSubscription, 'Subscription will cancel at the end of the period')}>Cancel subscription</button></div>
        </Modal>
      )}
    </div>
  )
}

function BillingDetails({ b, reload }) {
  const { toast } = useApp()
  const [f, setF] = useState({ company: b.company || '', billingEmail: b.billingEmail || '' })
  const dirty = f.company !== (b.company || '') || f.billingEmail !== (b.billingEmail || '')
  const save = async (e) => { e.preventDefault(); try { await api.saveBillingDetails(f); toast('Billing details saved'); reload() } catch (err) { toast({ title: err.message, error: true }) } }
  return (
    <section className="billing-card">
      <div className="billing-card-head"><h3>Billing details</h3></div>
      <form onSubmit={save}>
        <div className="field"><label className="field-title" htmlFor="bd-company">Company</label><input id="bd-company" className="text-input" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></div>
        <div className="field"><label className="field-title" htmlFor="bd-email">Billing email</label><input id="bd-email" className="text-input" type="email" value={f.billingEmail} onChange={(e) => setF({ ...f, billingEmail: e.target.value })} /></div>
        <button className="btn" disabled={!dirty}>Save</button>
      </form>
    </section>
  )
}

/* ---------------- card entry ---------------- */
const brandOf = (n) => (/^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'Amex' : /^(6011|65|64[4-9])/.test(n) ? 'Discover' : null)
const fmtCard = (v) => { const d = v.replace(/\D/g, '').slice(0, 19); return /^3[47]/.test(d) ? d.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (m, a, b, c) => [a, b, c].filter(Boolean).join(' ')) : d.replace(/(\d{4})(?=\d)/g, '$1 ') }
const fmtExp = (v) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }

function CardFields({ card, setCard, errField }) {
  const brand = brandOf(card.number.replace(/\s/g, ''))
  return (
    <div className="card-fields">
      <div className="field"><label className="field-title" htmlFor="cc-name">Name on card</label>
        <input id="cc-name" className={`text-input ${errField === 'holder' ? 'invalid' : ''}`} autoComplete="cc-name" value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} placeholder="Full name" /></div>
      <div className="field"><label className="field-title" htmlFor="cc-number">Card number</label>
        <div className="cc-number-wrap">
          <input id="cc-number" className={`text-input ${errField === 'number' ? 'invalid' : ''}`} inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(e) => setCard({ ...card, number: fmtCard(e.target.value) })} placeholder="1234 1234 1234 1234" />
          <span className="cc-brand"><CardBrandIcon brand={brand || 'card'} width={30} /></span>
        </div></div>
      <div className="row gap8">
        <div className="field grow"><label className="field-title" htmlFor="cc-exp">Expiry</label>
          <input id="cc-exp" className={`text-input ${errField === 'exp' ? 'invalid' : ''}`} inputMode="numeric" autoComplete="cc-exp" value={card.exp} onChange={(e) => setCard({ ...card, exp: fmtExp(e.target.value) })} placeholder="MM/YY" /></div>
        <div className="field grow"><label className="field-title" htmlFor="cc-cvc">Security code</label>
          <input id="cc-cvc" className={`text-input ${errField === 'cvc' ? 'invalid' : ''}`} inputMode="numeric" autoComplete="cc-csc" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder={brand === 'Amex' ? '4 digits' : 'CVC'} /></div>
      </div>
      <div className="test-cards muted small"><Icon name="info" size={12} /> Simulated payments. Test cards: <code>4242 4242 4242 4242</code> succeeds, <code>4000 0000 0000 0002</code> is declined, <code>4000 0000 0000 9995</code> has insufficient funds. Any future expiry and CVC.</div>
    </div>
  )
}
const EMPTY_CARD = { holder: '', number: '', exp: '', cvc: '' }

function CardModal({ onClose, onSaved }) {
  const [card, setCard] = useState(EMPTY_CARD)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { onSaved(await api.updateCard(card)) } catch (x) { setErr(x); setBusy(false) }
  }
  return (
    <Modal onClose={onClose} width={480}>
      <form onSubmit={save}>
        <div className="modal-header"><h2>Payment method</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body"><CardFields card={card} setCard={setCard} errField={err?.field} />{err && <div className="login-error"><Icon name="warning" size={16} />{err.message}</div>}</div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save card'}</button></div>
      </form>
    </Modal>
  )
}

/* ---------------- plans + checkout ---------------- */
function PlansSection({ b, reload }) {
  const { toast } = useApp()
  const s = b.subscription
  const [cycle, setCycle] = useState(s.plan === 'free' ? 'monthly' : s.cycle)
  const [checkout, setCheckout] = useState(null)
  const [confirmFree, setConfirmFree] = useState(false)
  const choose = (p) => {
    if (!b.canManage) { toast({ title: 'Only site administrators can change the plan.', error: true }); return }
    if (p.key === 'free') { setConfirmFree(true); return }
    setCheckout({ plan: p, cycle })
  }
  return (
    <div className="page-pad">
      <div className="page-head"><div><h2>Plans</h2><p className="muted">You’re on <b>{s.planName}</b>{s.status === 'trialing' ? ` (trial until ${day(s.trialEndsAt)})` : s.plan !== 'free' ? ` · ${s.cycle}` : ''}. Prices are per user; you have {b.usage.users} active users.</p></div>
        <CycleToggle cycle={cycle} setCycle={setCycle} /></div>
      <PlanCards plans={b.plans} cycle={cycle} current={s} onChoose={choose} />
      <h3 className="section-title">Compare plans</h3>
      <CompareTable plans={b.plans} />
      {checkout && <CheckoutModal plan={checkout.plan} cycle={checkout.cycle} b={b} onClose={() => setCheckout(null)} onDone={(r) => { setCheckout(null); toast({ title: `You’re now on ${r.subscription.planName}`, description: `Invoice ${r.invoice.number} · ${money(r.invoice.total)} paid` }); reload() }} />}
      {confirmFree && (
        <Modal onClose={() => setConfirmFree(false)} width={460}>
          <div className="modal-header"><h2>Move to Free?</h2></div>
          <div className="modal-body"><p>{s.plan === 'free' ? 'You are already on the Free plan.' : `Cancelling keeps ${s.planName} until ${day(s.currentPeriodEnd)}, then moves the site to Free (10 users, 2 GB, no permissions or audit log).`}</p></div>
          <div className="modal-footer"><button className="btn subtle" onClick={() => setConfirmFree(false)}>Close</button>
            {s.plan !== 'free' && <button className="btn danger" onClick={async () => { try { await api.cancelSubscription(); toast('Subscription will cancel at the end of the period'); reload() } catch (e) { toast({ title: e.message, error: true }) } setConfirmFree(false) }}>Cancel at period end</button>}</div>
        </Modal>
      )}
    </div>
  )
}

function CheckoutModal({ plan, cycle, b, onClose, onDone }) {
  const [quote, setQuote] = useState(null)
  const [useSaved, setUseSaved] = useState(!!b.paymentMethod)
  const [card, setCard] = useState(EMPTY_CARD)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.billingQuote(plan.key, cycle).then(setQuote).catch((e) => setErr(e)) }, [plan.key, cycle])
  const pay = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { onDone(await api.checkout({ plan: plan.key, cycle, ...(useSaved ? { useSaved: true } : { card }) })) } catch (x) { setErr(x); setBusy(false) }
  }
  return (
    <Modal onClose={onClose} width={560}>
      <form onSubmit={pay} className="checkout">
        <div className="modal-header"><h2>Checkout · {plan.name} ({cycle})</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body scroll">
          <div className="order-summary">
            <h4>Order summary</h4>
            {!quote ? <div className="spinner" /> : (
              <>
                {quote.lines.map((l, i) => <div key={i} className={`order-line ${l.amount < 0 ? 'credit' : ''}`}><span>{l.description}</span><b>{l.amount < 0 ? '−' : ''}{money(Math.abs(l.amount))}</b></div>)}
                <div className="order-line total"><span>Due today</span><b data-testid="checkout-total">{money(quote.total)}</b></div>
                <div className="muted small">Then {money(quote.unit * quote.seats)} every {cycle === 'annual' ? 'year' : 'month'} from {day(quote.periodEnd)} until you cancel.</div>
              </>
            )}
          </div>
          <h4>Payment</h4>
          {b.paymentMethod && (
            <div className="pay-choice">
              <label className="radio-row"><input type="radio" checked={useSaved} onChange={() => setUseSaved(true)} /><CardBrandIcon brand={b.paymentMethod.brand} width={28} /> {b.paymentMethod.brand} •••• {b.paymentMethod.last4}</label>
              <label className="radio-row"><input type="radio" checked={!useSaved} onChange={() => setUseSaved(false)} /> Use a new card</label>
            </div>
          )}
          {!useSaved && <CardFields card={card} setCard={setCard} errField={err?.field} />}
          {err && <div className="login-error" role="alert"><Icon name="warning" size={16} />{err.message}</div>}
        </div>
        <div className="modal-footer"><span className="muted small grow"><Icon name="lock" size={12} /> Simulated payment – no real charge</span>
          <button type="button" className="btn subtle" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !quote}>{busy ? 'Processing…' : quote ? `Pay ${money(quote.total)}` : 'Pay'}</button></div>
      </form>
    </Modal>
  )
}

/* ---------------- invoices ---------------- */
function InvoicesSection() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [open, setOpen] = useState(null)
  useEffect(() => { api.invoices().then(setRows).catch((e) => setErr(e.message)) }, [])
  return (
    <div className="page-pad">
      <div className="page-head"><div><h2>Invoices</h2><p className="muted">Every payment for your Masar subscription.</p></div></div>
      {err && <div className="login-error"><Icon name="warning" size={16} />{err}</div>}
      {!rows ? <div className="spinner" /> : rows.length === 0 ? <div className="empty-state"><Icon name="book" size={32} /><p>No invoices yet.</p></div> : (
        <table className="data-table invoices-table">
          <thead><tr><th>Invoice</th><th>Date</th><th>Plan</th><th>Period</th><th>Users</th><th>Amount</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td><button className="link" onClick={() => setOpen(i)}>{i.number}</button></td>
                <td>{day(i.created)}</td>
                <td><span style={{ color: PLAN_COLORS[i.plan], fontWeight: 600 }}>{i.planName}</span> <span className="muted">· {i.cycle}</span></td>
                <td className="muted">{day(i.periodStart)} – {day(i.periodEnd)}</td>
                <td>{i.seats}</td>
                <td><b>{money(i.total)}</b></td>
                <td><span className={`lozenge ${i.status === 'paid' ? 'success' : 'removed'}`}>{i.status}</span></td>
                <td><button className="btn subtle small" onClick={() => setOpen(i)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && <InvoiceModal invoice={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function InvoiceModal({ invoice, onClose }) {
  const [html, setHtml] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => { api.invoiceHtml(invoice.id).then(setHtml).catch((e) => setErr(e.message)) }, [invoice.id])
  const download = () => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const a = document.createElement('a'); a.href = url; a.download = `${invoice.number}.html`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <Modal onClose={onClose} width={820}>
      <div className="modal-header"><h2>Invoice {invoice.number}</h2><button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
      <div className="modal-body">
        {err ? <div className="login-error">{err}</div> : !html ? <div className="spinner" /> : <iframe title="Invoice" className="invoice-frame" srcDoc={html} sandbox="allow-modals allow-scripts" />}
      </div>
      <div className="modal-footer"><button className="btn" disabled={!html} onClick={download}><Icon name="download" size={14} />Download</button><button className="btn primary" onClick={onClose}>Close</button></div>
    </Modal>
  )
}

/* ======================= security & sign-in ======================= */
function SecuritySettings() {
  const { toast } = useApp()
  const [site, setSite] = useState(null)
  const [domains, setDomains] = useState('')
  const [providers, setProviders] = useState(null)
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState(null)
  const load = useCallback(() => {
    api.adminSite().then((s) => { setSite(s); setDomains(s.allowedDomains.join(', ')) }).catch((e) => setErr(e.message))
    api.authProviders().then(setProviders).catch((e) => setErr(e.message))
  }, [])
  useEffect(() => { load() }, [load])
  const saveSite = async (patch) => {
    try { const s = await api.saveAdminSite({ ...site, allowedDomains: domains, ...patch }); setSite(s); setDomains(s.allowedDomains.join(', ')); toast('Sign-up settings saved') } catch (e) { toast({ title: e.message, error: true }) }
  }
  const toggle = async (p) => {
    if (!p.configured) { setEdit(p); return }
    try { await api.saveAuthProvider(p.key, { enabled: !p.enabled }); toast(`${p.name} sign-in ${p.enabled ? 'disabled' : 'enabled'}`); load() } catch (e) { toast({ title: e.message, error: true }) }
  }
  return (
    <div className="page-pad security-page">
      <div className="page-head"><div><h2>Security & sign-in</h2><p className="muted">Control who can create an account and which social logins appear on the log in and sign up screens.</p></div></div>
      {err && <div className="login-error"><Icon name="warning" size={16} />{err}</div>}
      <section className="billing-card">
        <div className="billing-card-head"><h3>Who can sign up</h3></div>
        {!site ? <div className="spinner" /> : (
          <>
            {[['open', 'Anyone', 'Anyone with a verified email address can create an account.'],
              ['domain', 'Approved domains only', 'Only people with an email address at the domains below can sign up.'],
              ['invite', 'Invite only', 'Only administrators can add people (User management). The sign-up screen is closed.']].map(([id, label, text]) => (
              <label key={id} className={`access-option ${site.signup === id ? 'on' : ''}`}>
                <input type="radio" name="signup" checked={site.signup === id} onChange={() => { setSite({ ...site, signup: id }); if (!(id === 'domain' && !domains.trim())) saveSite({ signup: id }) }} />
                <div><b>{label}</b><div className="muted small">{text}</div></div>
              </label>
            ))}
            {site.signup === 'domain' && (
              <div className="row gap8 domain-row">
                <input className="text-input grow" aria-label="Allowed domains" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="example.com, example.org" />
                <button className="btn primary" onClick={() => saveSite({ signup: 'domain' })}>Save domains</button>
              </div>
            )}
          </>
        )}
      </section>
      <section className="billing-card">
        <div className="billing-card-head"><h3>Social login (OAuth)</h3></div>
        <p className="muted small">Masar uses real OAuth 2.0 / OpenID Connect. Create an OAuth app with each provider, register the redirect URI shown, then paste the client ID and secret here. Secrets are stored on the server and never shown again.</p>
        {!providers ? <div className="spinner" /> : providers.map((p) => {
          const Ico = PROVIDER_ICONS[p.key]
          return (
            <div key={p.key} className="provider-row" data-provider={p.key}>
              <Ico size={28} />
              <div className="grow">
                <b>{p.name}</b>
                <div className="muted small">{p.configured ? `Client ID ${p.clientId.slice(0, 18)}${p.clientId.length > 18 ? '…' : ''}${p.source === 'environment' ? ' (from environment)' : ''}` : 'Not configured'} · {p.users} linked account{p.users === 1 ? '' : 's'}</div>
              </div>
              <span className={`lozenge ${p.enabled ? 'success' : ''}`}>{p.enabled ? 'Enabled' : p.configured ? 'Disabled' : 'Off'}</span>
              <button className="btn" onClick={() => setEdit(p)}>Configure</button>
              <label className="switch" title={p.enabled ? 'Disable' : 'Enable'}><input type="checkbox" checked={p.enabled} onChange={() => toggle(p)} /><span /></label>
            </div>
          )
        })}
      </section>
      {edit && <ProviderModal p={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}

const FIELD_LABEL = { clientId: 'Client ID', clientSecret: 'Client secret', tenant: 'Tenant (directory) ID', teamId: 'Team ID', keyId: 'Key ID', privateKey: 'Private key (.p8)' }
const HELP = {
  google: 'Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).',
  microsoft: 'Microsoft Entra admin center → App registrations → New registration (Web). Use "common" for any Microsoft account, or your tenant ID to limit sign-in to your organisation.',
  apple: 'Apple Developer → Identifiers → Services ID (this is the client ID). Enable Sign in with Apple, add the return URL, then create a key with Sign in with Apple and paste the .p8 contents.',
  slack: 'api.slack.com/apps → Create app → OAuth & Permissions → add the redirect URL. Enable "Sign in with Slack" (OpenID Connect).',
}
function ProviderModal({ p, onClose, onSaved }) {
  const { toast } = useApp()
  const [f, setF] = useState({ clientId: p.clientId || '', clientSecret: '', tenant: p.tenant || 'common', teamId: p.teamId || '', keyId: p.keyId || '', privateKey: '' })
  const [enabled, setEnabled] = useState(p.enabled || !p.configured)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    const body = Object.fromEntries(p.fields.map((k) => [k, f[k]]))
    try { await api.saveAuthProvider(p.key, { ...body, enabled }); toast(`${p.name} settings saved`); onSaved() } catch (x) { setErr(x.message); setBusy(false) }
  }
  const Ico = PROVIDER_ICONS[p.key]
  const copy = () => { navigator.clipboard?.writeText(p.redirectUri).then(() => toast('Redirect URI copied')).catch(() => {}) }
  return (
    <Modal onClose={onClose} width={560}>
      <form onSubmit={save}>
        <div className="modal-header"><h2><Ico size={22} /> {p.name} sign-in</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="modal-body scroll">
          <p className="muted small">{HELP[p.key]} <a href={p.console} target="_blank" rel="noreferrer">Open console</a></p>
          <div className="field"><label className="field-title">Redirect URI</label>
            <div className="row gap8"><input className="text-input grow mono" readOnly value={p.redirectUri} onFocus={(e) => e.target.select()} /><button type="button" className="btn" onClick={copy}><Icon name="copy" size={14} /></button></div>
            <div className="field-help">Register exactly this URL with {p.name}. Set the PUBLIC_URL environment variable if Masar sits behind a different public address.</div></div>
          {p.fields.map((k) => {
            const secret = k === 'clientSecret' || k === 'privateKey'
            const has = k === 'clientSecret' ? p.hasClientSecret : k === 'privateKey' ? p.hasPrivateKey : false
            return (
              <div className="field" key={k}><label className="field-title" htmlFor={`pf-${k}`}>{FIELD_LABEL[k]}</label>
                {k === 'privateKey'
                  ? <textarea id={`pf-${k}`} className="text-input mono" rows={4} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={has ? '•••••••• stored – leave blank to keep' : '-----BEGIN PRIVATE KEY-----'} />
                  : <input id={`pf-${k}`} className="text-input" type={secret ? 'password' : 'text'} autoComplete="off" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={secret && has ? '•••••••• stored – leave blank to keep' : ''} />}
              </div>
            )
          })}
          <label className="check-label"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Show “{p.name}” on the log in and sign up screens</label>
          {err && <div className="login-error"><Icon name="warning" size={16} />{err}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  )
}

/* ======================= plan lock banner (used in project settings & audit) ======================= */
export function PlanLock({ feature, compact }) {
  const { meta, navigate } = useApp()
  const has = (meta.plan?.features || []).includes(feature)
  const label = useMemo(() => ({ permissions: ['Standard', 'Permission schemes, project roles and limited/private access'], audit_log: ['Premium', 'The audit log'] })[feature], [feature])
  if (has || !label) return null
  return (
    <div className={`plan-lock ${compact ? 'compact' : ''}`}>
      <Icon name="lock" size={16} />
      <div className="grow"><b>{label[1]} {feature === 'audit_log' ? 'is' : 'are'} available on {label[0]} and above.</b>
        <div className="muted small">You’re on the {meta.plan?.name || 'Free'} plan.{feature === 'permissions' ? ' Everyone currently works as a member; your saved settings come back when you upgrade.' : ''}</div></div>
      <button className="btn primary" onClick={() => navigate({ page: 'admin', section: 'plans' })}>Upgrade</button>
    </div>
  )
}
