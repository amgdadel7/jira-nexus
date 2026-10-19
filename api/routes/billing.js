// Billing & subscription API (mock payments). Everyone signed in can see the plan and usage;
// only site administrators can change the plan, payment method or download invoices.
const express = require('express');
const B = require('../billing');
const A = require('../auth');
const L = require('../lib');
const PM = require('../perms');
const db = require('../db');

const r = express.Router();
const isAdmin = (req) => req.user?.role === 'admin';

// public: plan catalogue (used by the pricing page before sign-in too)
r.get('/plans', L.wrap((req, res) => {
  res.json({ currency: 'USD', trialDays: B.TRIAL_DAYS, plans: B.ORDER.map((k) => B.planOut(B.PLANS[k])), annualDiscount: 'Pay for 10 months, get 12' });
}));

r.get('/billing', A.requireAuth, L.wrap((req, res) => {
  const out = { subscription: B.summary(), usage: B.usage(), canManage: isAdmin(req), plans: B.ORDER.map((k) => B.planOut(B.PLANS[k])) };
  if (isAdmin(req)) {
    out.paymentMethod = B.cardOut(B.defaultCard());
    out.upcoming = B.upcoming();
    const s = db.prepare('SELECT billing_email, company FROM subscription WHERE id = 1').get();
    out.billingEmail = s?.billing_email || req.user.email;
    out.company = s?.company || '';
  }
  res.json(out);
}));

r.get('/billing/quote', A.requireAdmin, L.wrap((req, res) => {
  const plan = String(req.query.plan || '');
  const cycle = String(req.query.cycle || 'monthly');
  if (!B.PLANS[plan] || plan === 'free') throw L.bad('Choose the Standard or Premium plan.');
  if (!['monthly', 'annual'].includes(cycle)) throw L.bad('Billing cycle must be monthly or annual.');
  res.json(B.quote(plan, cycle));
}));

r.post('/billing/checkout', A.requireAdmin, L.wrap((req, res) => {
  const { plan, cycle = 'monthly', card, useSaved } = req.body || {};
  const out = B.checkout({ plan, cycle, card, useSaved: !!useSaved });
  PM.audit(req, 'billing.plan_changed', { target: B.PLANS[plan].name, details: { from: out.previous, to: plan, cycle, invoice: out.invoice.number, total: out.invoice.total } });
  res.status(201).json({ ok: true, invoice: out.invoice, subscription: B.summary() });
}));

r.post('/billing/trial', A.requireAdmin, L.wrap((req, res) => {
  const plan = req.body?.plan || 'premium';
  B.startTrial(plan);
  PM.audit(req, 'billing.trial_started', { target: B.PLANS[plan].name, details: { days: B.TRIAL_DAYS } });
  res.json({ ok: true, subscription: B.summary() });
}));

r.post('/billing/cancel', A.requireAdmin, L.wrap((req, res) => {
  const before = B.getSubscription().plan;
  B.cancel();
  PM.audit(req, 'billing.cancel_scheduled', { target: B.PLANS[before].name });
  res.json({ ok: true, subscription: B.summary() });
}));

r.post('/billing/resume', A.requireAdmin, L.wrap((req, res) => {
  B.resume();
  PM.audit(req, 'billing.resumed', { target: B.PLANS[B.getSubscription().plan].name });
  res.json({ ok: true, subscription: B.summary() });
}));

r.put('/billing/payment-method', A.requireAdmin, L.wrap((req, res) => {
  const c = B.validateCard(req.body || {});
  const saved = B.saveCard(c);
  PM.audit(req, 'billing.card_updated', { target: `${saved.brand} •••• ${saved.last4}` });
  // pay any open invoice with the new card
  const open = db.prepare("SELECT id FROM invoices WHERE status = 'open'").all();
  if (open.length) {
    db.prepare("UPDATE invoices SET status = 'paid', card = ? WHERE status = 'open'").run(`${saved.brand} •••• ${saved.last4}`);
    if (B.getSubscription().status === 'past_due') B.update({ status: 'active' });
  }
  res.json({ ok: true, paymentMethod: B.cardOut(saved), paidInvoices: open.length });
}));

r.put('/billing/details', A.requireAdmin, L.wrap((req, res) => {
  const { billingEmail, company } = req.body || {};
  if (billingEmail !== undefined && billingEmail !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(billingEmail))) throw L.bad('Enter a valid billing email address.');
  B.getSubscription();
  db.prepare('UPDATE subscription SET billing_email = COALESCE(?, billing_email), company = COALESCE(?, company) WHERE id = 1')
    .run(billingEmail === undefined ? null : String(billingEmail), company === undefined ? null : String(company).slice(0, 120));
  res.json({ ok: true });
}));

r.get('/billing/invoices', A.requireAdmin, L.wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM invoices ORDER BY created_at DESC, id DESC').all().map(B.invoiceOut));
}));
function getInvoice(id) {
  const i = db.prepare('SELECT * FROM invoices WHERE id = ? OR number = ?').get(Number(id) || -1, String(id));
  if (!i) throw L.notFound('Invoice not found.');
  return i;
}
r.get('/billing/invoices/:id', A.requireAdmin, L.wrap((req, res) => res.json(B.invoiceOut(getInvoice(req.params.id)))));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—');
r.get('/billing/invoices/:id/html', A.requireAdmin, L.wrap((req, res) => {
  const inv = B.invoiceOut(getInvoice(req.params.id));
  const s = db.prepare('SELECT billing_email, company FROM subscription WHERE id = 1').get() || {};
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(inv.number)} – Masar</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#172B4D;max-width:760px;margin:40px auto;padding:0 24px}
.top{display:flex;justify-content:space-between;align-items:flex-start}h1{font-size:28px;margin:0}.muted{color:#626F86}
table{width:100%;border-collapse:collapse;margin-top:28px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #DCDFE4}td.n,th.n{text-align:right}
.tot td{font-weight:700;border-bottom:none}.badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:12px;font-weight:700;background:${inv.status === 'paid' ? '#DCFFF1;color:#216E4E' : '#FFECEB;color:#AE2E24'};text-transform:uppercase}
.logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:20px}@media print{button{display:none}}</style></head><body>
<div class="top"><div><div class="logo"><svg width="28" height="28" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0C66E4"/><path d="M8 22 L13 12 L18 19 L24 9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>Masar</div>
<p class="muted">Masar Software<br>billing@masar.example</p></div>
<div style="text-align:right"><h1>Invoice</h1><p class="muted">${esc(inv.number)}<br>Issued ${day(inv.created)}</p><span class="badge">${esc(inv.status)}</span></div></div>
<p><b>Billed to</b><br>${esc(s.company || 'AHD Financial')}<br><span class="muted">${esc(s.billing_email || req.user.email)}</span></p>
<p class="muted">Service period: ${day(inv.periodStart)} – ${day(inv.periodEnd)} · ${esc(inv.planName)} (${esc(inv.cycle)}) · ${inv.seats} user${inv.seats === 1 ? '' : 's'}</p>
<table><thead><tr><th>Description</th><th class="n">Amount</th></tr></thead><tbody>
${inv.lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="n">${l.amount < 0 ? '−' : ''}${B.money(Math.abs(l.amount))}</td></tr>`).join('')}
<tr class="tot"><td>Total (USD)</td><td class="n">${B.money(inv.total)}</td></tr></tbody></table>
<p class="muted">${inv.card ? `Paid with ${esc(inv.card)}.` : 'Payment due.'} This is a simulated invoice – no real payment was taken.</p>
<button onclick="print()">Print</button></body></html>`);
}));

module.exports = r;
