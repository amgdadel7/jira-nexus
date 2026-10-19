'use strict';

const { PLANS, money } = require('../../../domain/billing');

const plan = (p) => ({
  key: p.key, name: p.name, tagline: p.tagline, price: p.price, maxUsers: p.maxUsers, storageBytes: p.storageBytes,
  trashDays: p.trashDays, features: p.features, highlights: p.highlights,
});

const card = (c) => c && { brand: c.brand, last4: c.last4, expMonth: c.exp_month, expYear: c.exp_year, holder: c.holder };

const invoice = (i) => ({
  id: i.id, number: i.number, created: i.created_at, periodStart: i.period_start, periodEnd: i.period_end,
  plan: i.plan, planName: PLANS[i.plan]?.name || i.plan, cycle: i.cycle, seats: i.seats, lines: i.lines || [],
  subtotal: i.subtotal_cents, total: i.total_cents, status: i.status, card: i.card, currency: 'USD',
});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—');

/** Printable HTML invoice. */
function invoiceHtml(inv, { company, billingEmail }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(inv.number)} – Masar</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#172B4D;max-width:760px;margin:40px auto;padding:0 24px}
.top{display:flex;justify-content:space-between;align-items:flex-start}h1{font-size:28px;margin:0}.muted{color:#626F86}
table{width:100%;border-collapse:collapse;margin-top:28px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #DCDFE4}td.n,th.n{text-align:right}
.tot td{font-weight:700;border-bottom:none}.badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:12px;font-weight:700;background:${inv.status === 'paid' ? '#DCFFF1;color:#216E4E' : '#FFECEB;color:#AE2E24'};text-transform:uppercase}
.logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:20px}@media print{button{display:none}}</style></head><body>
<div class="top"><div><div class="logo"><svg width="28" height="28" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0C66E4"/><path d="M8 22 L13 12 L18 19 L24 9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>Masar</div>
<p class="muted">Masar Software<br>billing@masar.example</p></div>
<div style="text-align:right"><h1>Invoice</h1><p class="muted">${esc(inv.number)}<br>Issued ${day(inv.created)}</p><span class="badge">${esc(inv.status)}</span></div></div>
<p><b>Billed to</b><br>${esc(company || 'AHD Financial')}<br><span class="muted">${esc(billingEmail)}</span></p>
<p class="muted">Service period: ${day(inv.periodStart)} – ${day(inv.periodEnd)} · ${esc(inv.planName)} (${esc(inv.cycle)}) · ${inv.seats} user${inv.seats === 1 ? '' : 's'}</p>
<table><thead><tr><th>Description</th><th class="n">Amount</th></tr></thead><tbody>
${inv.lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="n">${l.amount < 0 ? '−' : ''}${money(Math.abs(l.amount))}</td></tr>`).join('')}
<tr class="tot"><td>Total (USD)</td><td class="n">${money(inv.total)}</td></tr></tbody></table>
<p class="muted">${inv.card ? `Paid with ${esc(inv.card)}.` : 'Payment due.'} This is a simulated invoice – no real payment was taken.</p>
<button onclick="print()">Print</button></body></html>`;
}

module.exports = { plan, card, invoice, invoiceHtml };
