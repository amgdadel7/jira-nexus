'use strict';

const B = require('../../domain/billing');
const { bad, notFound, PlanLimitError } = require('../../shared/errors');
const { isEmail } = require('../../shared/validation');
const { nowIso } = require('../../shared/time');

/**
 * Subscription use cases with simulated payments: plan state with lazy period
 * rollover (renewals, trial expiry, scheduled cancellation), checkout with
 * proration, trials, limits enforcement and invoices.
 */
class BillingService {
  constructor({ db, billingRepo, audit }) {
    Object.assign(this, { db, repo: billingRepo, audit });
    this.memo = null; // { at, sub } – the plan is read on almost every request
  }

  invalidate() {
    this.memo = null;
  }

  async update(fields) {
    const row = await this.repo.updateSubscription(fields);
    this.invalidate();
    return row;
  }

  /* ---------- state ---------- */
  async rollover() {
    let row = await this.repo.getSubscription();
    for (let guard = 0; guard < 36 && row.plan !== 'free' && row.current_period_end && row.current_period_end <= nowIso(); guard += 1) {
      if (row.status === 'trialing' || row.cancel_at_period_end) {
        // trial over without a purchase, or cancellation took effect → back to Free
        row = await this.update({ plan: 'free', cycle: 'monthly', status: 'active', trial_ends_at: row.status === 'trialing' ? null : row.trial_ends_at, current_period_start: null, current_period_end: null, cancel_at_period_end: false });
      } else {
        row = await this.renew(row);
      }
    }
    return row;
  }

  /** Auto-renewal: charges the saved card for the next period. */
  async renew(row) {
    const start = row.current_period_end;
    const end = B.addCycle(start, row.cycle);
    const card = await this.repo.defaultCard();
    const seats = await this.billableSeats();
    const plan = B.planByKey(row.plan);
    await this.createInvoice({
      created: start, periodStart: start, periodEnd: end, plan: row.plan, cycle: row.cycle, seats,
      lines: [B.seatLine(plan, row.cycle, seats)], status: card ? 'paid' : 'open', card: card ? `${card.brand} •••• ${card.last4}` : null,
    });
    return this.update({ current_period_start: start, current_period_end: end, status: card ? 'active' : 'past_due' });
  }

  async getSubscription() {
    if (this.memo && Date.now() - this.memo.at < 1000) return this.memo.sub;
    const sub = await this.rollover();
    this.memo = { at: Date.now(), sub };
    return sub;
  }

  async plan() {
    return B.planByKey((await this.getSubscription()).plan);
  }

  async hasFeature(name) {
    return (await this.plan()).features.includes(name);
  }

  async retentionDays() {
    return (await this.plan()).trashDays;
  }

  async usage() {
    const u = await this.repo.usage();
    return { ...u, storageBytes: Number(u.storageBytes) };
  }

  async billableSeats() {
    return Math.max(1, (await this.usage()).users);
  }

  /* ---------- limits ---------- */
  async limitError(problem) {
    return new PlanLimitError(problem.message, { plan: (await this.getSubscription()).plan, ...problem.extra });
  }

  async assertSeat(extra = 1) {
    const problem = B.seatLimitMessage(await this.plan(), (await this.usage()).users, extra);
    if (problem) throw await this.limitError(problem);
  }

  async assertStorage(bytes) {
    const problem = B.storageLimitMessage(await this.plan(), (await this.usage()).storageBytes, bytes);
    if (problem) throw await this.limitError(problem);
  }

  async assertFeature(name) {
    if (await this.hasFeature(name)) return;
    throw await this.limitError(B.featureLimitMessage(name));
  }

  defaultCard() {
    return this.repo.defaultCard();
  }

  /* ---------- invoices ---------- */
  async createInvoice({ created = nowIso(), periodStart, periodEnd, plan, cycle, seats, lines, status = 'paid', card }) {
    const number = B.invoiceNumber(new Date(created).getUTCFullYear(), (await this.repo.countInvoices()) + 1);
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    return this.repo.insertInvoice({
      number, created_at: created, period_start: periodStart, period_end: periodEnd, plan, cycle, seats, lines,
      subtotal_cents: subtotal, total_cents: Math.max(0, subtotal), status, card: card || null,
    });
  }

  async listInvoices() {
    return this.repo.listInvoices();
  }

  async getInvoice(id) {
    const invoice = await this.repo.findInvoice(id);
    if (!invoice) throw notFound('Invoice not found.');
    return invoice;
  }

  /** Unused value of the current paid period in cents (credited when changing plan). */
  async unusedCredit(sub) {
    if (sub.plan === 'free' || sub.status === 'trialing' || !sub.current_period_end) return 0;
    const share = B.unusedShare(sub.current_period_start, sub.current_period_end);
    const paid = await this.repo.lastPaidInvoiceFor(sub.current_period_start, sub.plan);
    const base = paid
      ? paid.lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0)
      : B.planByKey(sub.plan).price[sub.cycle] * (await this.billableSeats());
    return Math.round(base * share);
  }

  validatePlanChoice(plan, cycle) {
    if (!B.PLANS[plan] || plan === 'free') throw bad('Choose the Standard or Premium plan.');
    if (!B.CYCLES.includes(cycle)) throw bad('Billing cycle must be monthly or annual.');
  }

  async quote(planKey, cycle) {
    this.validatePlanChoice(planKey, cycle);
    const sub = await this.getSubscription();
    const plan = B.PLANS[planKey];
    const seats = await this.billableSeats();
    const unit = plan.price[cycle];
    const lines = [B.seatLine(plan, cycle, seats)];
    const credit = await this.unusedCredit(sub);
    if (credit > 0) lines.push({ description: `Credit for unused time on ${B.PLANS[sub.plan].name} (${sub.cycle})`, amount: -Math.min(credit, unit * seats) });
    const total = Math.max(0, lines.reduce((s, l) => s + l.amount, 0));
    const periodStart = nowIso();
    return { plan: planKey, cycle, seats, unit, lines, total, periodStart, periodEnd: B.addCycle(periodStart, cycle) };
  }

  async assertCanMoveTo(planKey) {
    const problem = B.downgradeProblem(B.PLANS[planKey], await this.usage());
    if (problem) throw bad(problem, { code: 'over_limit' });
  }

  async checkout(actor, { plan, cycle = 'monthly', card, useSaved }) {
    if (!B.PLANS[plan] || plan === 'free') throw bad('Choose the Standard or Premium plan. To move to Free, cancel your subscription.');
    if (!B.CYCLES.includes(cycle)) throw bad('Billing cycle must be monthly or annual.');
    const sub = await this.getSubscription();
    if (sub.plan === plan && sub.cycle === cycle && sub.status === 'active') throw bad(`You are already on ${B.PLANS[plan].name} (${cycle}).`);
    await this.assertCanMoveTo(plan);
    let paymentMethod;
    if (card && !useSaved) paymentMethod = B.validateCard(card);
    else {
      paymentMethod = await this.repo.defaultCard();
      if (!paymentMethod) throw bad('Add a payment card.', { field: 'number' });
    }
    const q = await this.quote(plan, cycle);
    const invoice = await this.db.tx(async () => {
      const saved = card && !useSaved ? await this.repo.saveCard(paymentMethod) : paymentMethod;
      const inv = await this.createInvoice({ periodStart: q.periodStart, periodEnd: q.periodEnd, plan, cycle, seats: q.seats, lines: q.lines, card: `${saved.brand} •••• ${saved.last4}` });
      await this.update({ plan, cycle, status: 'active', trial_ends_at: null, current_period_start: q.periodStart, current_period_end: q.periodEnd, cancel_at_period_end: false });
      return inv;
    });
    await this.audit.record(actor, 'billing.plan_changed', { target: B.PLANS[plan].name, details: { from: sub.plan, to: plan, cycle, invoice: invoice.number, total: invoice.total_cents } });
    return invoice;
  }

  async startTrial(actor, planKey = 'premium') {
    const sub = await this.getSubscription();
    if (!['standard', 'premium'].includes(planKey)) throw bad('You can trial Standard or Premium.');
    if (sub.plan !== 'free') throw bad('Free trials are only available on the Free plan.');
    if (sub.trial_used) throw bad('Your site has already used its free trial.');
    const end = new Date(Date.now() + B.TRIAL_DAYS * 864e5).toISOString();
    await this.update({ plan: planKey, cycle: 'monthly', status: 'trialing', trial_ends_at: end, trial_used: true, current_period_start: nowIso(), current_period_end: end, cancel_at_period_end: false });
    await this.audit.record(actor, 'billing.trial_started', { target: B.PLANS[planKey].name, details: { days: B.TRIAL_DAYS } });
  }

  async cancel(actor) {
    const sub = await this.getSubscription();
    if (sub.plan === 'free') throw bad('You are already on the Free plan.');
    await this.assertCanMoveTo('free');
    await this.update({ cancel_at_period_end: true });
    await this.audit.record(actor, 'billing.cancel_scheduled', { target: B.PLANS[sub.plan].name });
  }

  async resume(actor) {
    const sub = await this.getSubscription();
    if (!sub.cancel_at_period_end) throw bad('Your subscription is not scheduled to cancel.');
    await this.update({ cancel_at_period_end: false });
    await this.audit.record(actor, 'billing.resumed', { target: B.PLANS[sub.plan].name });
  }

  /** Saves a new default card and pays open invoices with it. */
  async updatePaymentMethod(actor, body) {
    const card = B.validateCard(body || {});
    return this.db.tx(async () => {
      const saved = await this.repo.saveCard(card);
      const label = `${saved.brand} •••• ${saved.last4}`;
      await this.audit.record(actor, 'billing.card_updated', { target: label });
      const paid = await this.db.query('UPDATE invoices SET status = \'paid\', card = $1 WHERE status = \'open\'', [label]);
      if (paid.rowCount && (await this.getSubscription()).status === 'past_due') await this.update({ status: 'active' });
      return { card: saved, paidInvoices: paid.rowCount };
    });
  }

  async updateDetails({ billingEmail, company }) {
    if (billingEmail !== undefined && billingEmail !== '' && !isEmail(billingEmail)) throw bad('Enter a valid billing email address.');
    await this.getSubscription();
    const fields = {};
    if (billingEmail !== undefined) fields.billing_email = String(billingEmail);
    if (company !== undefined) fields.company = String(company).slice(0, 120);
    if (Object.keys(fields).length) await this.update(fields);
  }

  async summary() {
    const sub = await this.getSubscription();
    const p = B.planByKey(sub.plan);
    return {
      plan: sub.plan, planName: p.name, cycle: sub.cycle, status: sub.status, trialEndsAt: sub.trial_ends_at, trialUsed: !!sub.trial_used,
      currentPeriodStart: sub.current_period_start, currentPeriodEnd: sub.current_period_end, cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      features: p.features, limits: { users: p.maxUsers, storageBytes: p.storageBytes, trashDays: p.trashDays },
    };
  }

  async upcoming() {
    const sub = await this.getSubscription();
    if (sub.plan === 'free' || sub.cancel_at_period_end) return null;
    const seats = await this.billableSeats();
    const unit = B.planByKey(sub.plan).price[sub.cycle];
    return { date: sub.current_period_end, seats, unit, total: seats * unit, plan: sub.plan, cycle: sub.cycle, afterTrial: sub.status === 'trialing' };
  }
}

module.exports = { BillingService };
