// Subscription plans, usage limits and a simulated (mock) payment processor.
//
// There is no real payment gateway: card numbers are validated (Luhn, expiry, CVC) and only the
// brand + last four digits are stored. A few well-known test numbers trigger failures:
//   4000 0000 0000 0002  → card declined
//   4000 0000 0000 9995  → insufficient funds
// Everything else that passes validation is "charged" successfully and an invoice is recorded.
const db = require('./db');

const GB = 1024 ** 3;
const PLANS = {
  free: {
    key: 'free', name: 'Free', tagline: 'For small teams getting started',
    price: { monthly: 0, annual: 0 }, // cents per user
    maxUsers: 10, storageBytes: 2 * GB, trashDays: 7, automationRuns: 100,
    features: [],
    highlights: ['Up to 10 users', '2 GB storage', 'Unlimited projects & boards', 'Backlog, sprints, timeline & reports', '100 automation rule runs / month', 'Community support'],
  },
  standard: {
    key: 'standard', name: 'Standard', tagline: 'For growing teams that need control',
    price: { monthly: 753, annual: 7530 },
    maxUsers: 100, storageBytes: 250 * GB, trashDays: 30, automationRuns: 1700,
    features: ['permissions'],
    highlights: ['Up to 100 users', '250 GB storage', 'Project roles & permission schemes', 'Limited & private projects', 'Global permissions', '1,700 automation rule runs / month', '30-day recycle bin'],
  },
  premium: {
    key: 'premium', name: 'Premium', tagline: 'For organisations scaling securely',
    price: { monthly: 1353, annual: 13530 },
    maxUsers: null, storageBytes: null, trashDays: 90, automationRuns: null,
    features: ['permissions', 'audit_log'],
    highlights: ['Unlimited users', 'Unlimited storage', 'Everything in Standard', 'Unlimited automation', 'Audit log', '90-day recycle bin', '24/7 premium support'],
  },
};
const ORDER = ['free', 'standard', 'premium'];
const FEATURE_LABEL = { permissions: 'Permissions & access levels', audit_log: 'Audit log' };
const FEATURE_PLAN = { permissions: 'standard', audit_log: 'premium' };
const TRIAL_DAYS = 14;

const nowIso = () => new Date().toISOString();
function addCycle(iso, cycle) {
  const d = new Date(iso);
  if (cycle === 'annual') d.setUTCFullYear(d.getUTCFullYear() + 1); else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

// ---------- subscription state (with lazy period rollover) ----------
let memo = null; // { at, sub }
function invalidate() { memo = null; }

function rawRow() {
  let row = db.prepare('SELECT * FROM subscription WHERE id = 1').get();
  if (!row) {
    db.prepare("INSERT INTO subscription (id, plan, cycle, status, updated_at) VALUES (1, 'free', 'monthly', 'active', ?)").run(nowIso());
    row = db.prepare('SELECT * FROM subscription WHERE id = 1').get();
  }
  return row;
}
function update(fields) {
  const cols = Object.keys(fields);
  db.prepare(`UPDATE subscription SET ${cols.map((c) => `${c} = @${c}`).join(', ')}, updated_at = @updated_at WHERE id = 1`).run({ ...fields, updated_at: nowIso() });
  invalidate();
}

function rollover() {
  let row = rawRow();
  for (let guard = 0; guard < 36 && row.plan !== 'free' && row.current_period_end && row.current_period_end <= nowIso(); guard++) {
    if (row.status === 'trialing') {
      // trial over without a purchase → back to Free
      update({ plan: 'free', cycle: 'monthly', status: 'active', trial_ends_at: null, current_period_start: null, current_period_end: null, cancel_at_period_end: 0 });
    } else if (row.cancel_at_period_end) {
      update({ plan: 'free', cycle: 'monthly', status: 'active', current_period_start: null, current_period_end: null, cancel_at_period_end: 0 });
    } else {
      // auto-renew: charge the saved card for the next period
      const start = row.current_period_end;
      const end = addCycle(start, row.cycle);
      const card = defaultCard();
      const seats = billableSeats();
      const unit = PLANS[row.plan].price[row.cycle];
      createInvoice({
        created: start, periodStart: start, periodEnd: end, plan: row.plan, cycle: row.cycle, seats,
        lines: [{ description: `${PLANS[row.plan].name} plan (${row.cycle}) – ${seats} user${seats === 1 ? '' : 's'} × ${money(unit)}`, amount: unit * seats }],
        status: card ? 'paid' : 'open', card: card ? `${card.brand} •••• ${card.last4}` : null,
      });
      update({ current_period_start: start, current_period_end: end, status: card ? 'active' : 'past_due' });
    }
    row = rawRow();
  }
  return row;
}

function getSubscription() {
  if (memo && Date.now() - memo.at < 1000) return memo.sub;
  const sub = rollover();
  memo = { at: Date.now(), sub };
  return sub;
}
const planOf = () => PLANS[getSubscription().plan] || PLANS.free;
function feature(name) { return planOf().features.includes(name); }
function retentionDays() { return planOf().trashDays; }

// ---------- usage + limits ----------
function usage() {
  return {
    users: db.prepare('SELECT COUNT(*) c FROM users WHERE active = 1').get().c,
    storageBytes: db.prepare('SELECT COALESCE(SUM(size),0) s FROM attachments').get().s,
    projects: db.prepare('SELECT COUNT(*) c FROM projects').get().c,
    issues: db.prepare('SELECT COUNT(*) c FROM issues').get().c,
  };
}
const billableSeats = () => Math.max(1, usage().users);
const nextPlanFor = (pred) => ORDER.map((k) => PLANS[k]).find(pred);

function planError(message, extra) {
  return Object.assign(new Error(message), { status: 402, extra: { code: 'plan_limit', plan: getSubscription().plan, ...extra } });
}
function assertSeat(extra = 1) {
  const p = planOf();
  const used = usage().users;
  if (p.maxUsers != null && used + extra > p.maxUsers) {
    const up = nextPlanFor((x) => x.maxUsers == null || x.maxUsers >= used + extra);
    throw planError(`Your ${p.name} plan includes up to ${p.maxUsers} users and you already have ${used}. Upgrade to ${up?.name || 'a higher plan'} to add more people.`,
      { limit: 'users', max: p.maxUsers, used, upgradeTo: up?.key });
  }
}
function assertStorage(bytes) {
  const p = planOf();
  const used = usage().storageBytes;
  if (p.storageBytes != null && used + bytes > p.storageBytes) {
    const up = nextPlanFor((x) => x.storageBytes == null || x.storageBytes >= used + bytes);
    throw planError(`This upload would exceed the ${fmtBytes(p.storageBytes)} storage included in your ${p.name} plan. Upgrade to ${up?.name || 'a higher plan'} for more storage.`,
      { limit: 'storage', max: p.storageBytes, used, upgradeTo: up?.key });
  }
}
function assertFeature(name) {
  if (feature(name)) return;
  const up = FEATURE_PLAN[name];
  throw planError(`${FEATURE_LABEL[name] || name} ${name === 'audit_log' ? 'is' : 'are'} available on the ${PLANS[up].name} plan and above. Upgrade to use ${name === 'audit_log' ? 'it' : 'them'}.`,
    { limit: 'feature', feature: name, upgradeTo: up });
}

// ---------- cards ----------
function luhn(num) {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
function brandOf(num) {
  if (/^4/.test(num)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'Amex';
  if (/^(6011|65|64[4-9])/.test(num)) return 'Discover';
  return 'Card';
}
const bad = (msg, extra) => Object.assign(new Error(msg), { status: 400, extra });
const declined = (msg, code) => Object.assign(new Error(msg), { status: 402, extra: { code } });

/** Validates a card and returns the safe parts to store. Never stores the number or CVC. */
function validateCard(card = {}) {
  const number = String(card.number || '').replace(/[\s-]/g, '');
  const holder = String(card.holder || card.name || '').trim();
  const cvc = String(card.cvc || '').trim();
  let month; let year;
  if (card.exp) { const m = String(card.exp).match(/^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/); if (m) { month = Number(m[1]); year = Number(m[2]); } } else { month = Number(card.expMonth); year = Number(card.expYear); }
  if (year < 100) year += 2000;
  if (!holder) throw bad('Enter the name on the card.', { field: 'holder' });
  if (!/^\d{12,19}$/.test(number) || !luhn(number)) throw bad('Your card number is invalid.', { field: 'number' });
  if (!month || month < 1 || month > 12 || !year) throw bad('Enter the expiry date as MM/YY.', { field: 'exp' });
  const now = new Date();
  if (year < now.getUTCFullYear() || (year === now.getUTCFullYear() && month < now.getUTCMonth() + 1) || year > now.getUTCFullYear() + 20) throw bad('Your card has expired or the expiry date is invalid.', { field: 'exp' });
  const brand = brandOf(number);
  if (!(brand === 'Amex' ? /^\d{4}$/ : /^\d{3}$/).test(cvc)) throw bad(`Enter the ${brand === 'Amex' ? '4' : '3'}-digit security code.`, { field: 'cvc' });
  if (number === '4000000000000002') throw declined('Your card was declined. Try a different card.', 'card_declined');
  if (number === '4000000000009995') throw declined('Your card has insufficient funds.', 'insufficient_funds');
  return { brand, last4: number.slice(-4), exp_month: month, exp_year: year, holder };
}
function defaultCard() { return db.prepare('SELECT * FROM payment_methods WHERE is_default = 1 ORDER BY id DESC').get() || null; }
function saveCard(c) {
  db.prepare('UPDATE payment_methods SET is_default = 0').run();
  db.prepare('INSERT INTO payment_methods (brand,last4,exp_month,exp_year,holder,is_default,created_at) VALUES (?,?,?,?,?,1,?)').run(c.brand, c.last4, c.exp_month, c.exp_year, c.holder, nowIso());
  return defaultCard();
}
const cardOut = (c) => c && { brand: c.brand, last4: c.last4, expMonth: c.exp_month, expYear: c.exp_year, holder: c.holder };

// ---------- invoices ----------
const money = (cents) => `$${(cents / 100).toFixed(2)}`;
function fmtBytes(b) {
  if (b == null) return 'Unlimited';
  if (b >= GB) return `${+(b / GB).toFixed(b % GB ? 1 : 0)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}
function createInvoice({ created = nowIso(), periodStart, periodEnd, plan, cycle, seats, lines, status = 'paid', card }) {
  const year = new Date(created).getUTCFullYear();
  const seq = db.prepare('SELECT COUNT(*) c FROM invoices').get().c + 1;
  const number = `MSR-${year}-${String(seq).padStart(5, '0')}`;
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const total = Math.max(0, subtotal);
  const info = db.prepare(`INSERT INTO invoices (number,created_at,period_start,period_end,plan,cycle,seats,lines,subtotal_cents,total_cents,status,card)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(number, created, periodStart, periodEnd, plan, cycle, seats, JSON.stringify(lines), subtotal, total, status, card || null);
  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(info.lastInsertRowid);
}
const invoiceOut = (i) => ({
  id: i.id, number: i.number, created: i.created_at, periodStart: i.period_start, periodEnd: i.period_end,
  plan: i.plan, planName: PLANS[i.plan]?.name || i.plan, cycle: i.cycle, seats: i.seats, lines: JSON.parse(i.lines || '[]'),
  subtotal: i.subtotal_cents, total: i.total_cents, status: i.status, card: i.card, currency: 'USD',
});

/** Unused value of the current paid period, in cents (used to prorate plan changes). */
function unusedCredit(sub) {
  if (sub.plan === 'free' || sub.status === 'trialing' || !sub.current_period_end) return 0;
  const start = new Date(sub.current_period_start).getTime();
  const end = new Date(sub.current_period_end).getTime();
  const left = Math.max(0, end - Date.now()) / Math.max(1, end - start);
  // the last invoice for this period tells us what was actually paid
  const paid = db.prepare("SELECT total_cents, subtotal_cents, lines FROM invoices WHERE period_start = ? AND plan = ? AND status = 'paid' ORDER BY id DESC").get(sub.current_period_start, sub.plan);
  const base = paid ? JSON.parse(paid.lines).filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0) : PLANS[sub.plan].price[sub.cycle] * billableSeats();
  return Math.round(base * left);
}

/** Quote for switching to plan/cycle right now. */
function quote(planKey, cycle) {
  const sub = getSubscription();
  const p = PLANS[planKey];
  const seats = billableSeats();
  const unit = p.price[cycle];
  const lines = [{ description: `${p.name} plan (${cycle}) – ${seats} user${seats === 1 ? '' : 's'} × ${money(unit)}`, amount: unit * seats }];
  const credit = unusedCredit(sub);
  if (credit > 0) lines.push({ description: `Credit for unused time on ${PLANS[sub.plan].name} (${sub.cycle})`, amount: -Math.min(credit, unit * seats) });
  const total = Math.max(0, lines.reduce((s, l) => s + l.amount, 0));
  const periodStart = nowIso();
  return { plan: planKey, cycle, seats, unit, lines, total, periodStart, periodEnd: addCycle(periodStart, cycle) };
}

function checkDowngrade(planKey) {
  const p = PLANS[planKey];
  const u = usage();
  if (p.maxUsers != null && u.users > p.maxUsers) throw bad(`The ${p.name} plan allows ${p.maxUsers} users but you have ${u.users} active. Deactivate ${u.users - p.maxUsers} user${u.users - p.maxUsers === 1 ? '' : 's'} first.`, { code: 'over_limit' });
  if (p.storageBytes != null && u.storageBytes > p.storageBytes) throw bad(`The ${p.name} plan includes ${fmtBytes(p.storageBytes)} storage but you are using ${fmtBytes(u.storageBytes)}. Remove some attachments first.`, { code: 'over_limit' });
}

function checkout({ plan, cycle, card, useSaved }) {
  if (!PLANS[plan] || plan === 'free') throw bad('Choose the Standard or Premium plan. To move to Free, cancel your subscription.');
  if (!['monthly', 'annual'].includes(cycle)) throw bad('Billing cycle must be monthly or annual.');
  const sub = getSubscription();
  if (sub.plan === plan && sub.cycle === cycle && sub.status === 'active') throw bad(`You are already on ${PLANS[plan].name} (${cycle}).`);
  checkDowngrade(plan);
  let pm;
  if (card && !useSaved) pm = validateCard(card);
  else { pm = defaultCard(); if (!pm) throw bad('Add a payment card.', { field: 'number' }); }
  const q = quote(plan, cycle);
  return db.transaction(() => {
    const saved = card && !useSaved ? saveCard(pm) : pm;
    const inv = createInvoice({ periodStart: q.periodStart, periodEnd: q.periodEnd, plan, cycle, seats: q.seats, lines: q.lines, status: 'paid', card: `${saved.brand} •••• ${saved.last4}` });
    update({ plan, cycle, status: 'active', trial_ends_at: null, current_period_start: q.periodStart, current_period_end: q.periodEnd, cancel_at_period_end: 0 });
    return { invoice: invoiceOut(inv), previous: sub.plan };
  })();
}

function startTrial(planKey = 'premium') {
  const sub = getSubscription();
  if (!['standard', 'premium'].includes(planKey)) throw bad('You can trial Standard or Premium.');
  if (sub.plan !== 'free') throw bad('Free trials are only available on the Free plan.');
  if (sub.trial_used) throw bad('Your site has already used its free trial.');
  const end = new Date(Date.now() + TRIAL_DAYS * 864e5).toISOString();
  update({ plan: planKey, cycle: 'monthly', status: 'trialing', trial_ends_at: end, trial_used: 1, current_period_start: nowIso(), current_period_end: end, cancel_at_period_end: 0 });
  return getSubscription();
}
function cancel() {
  const sub = getSubscription();
  if (sub.plan === 'free') throw bad('You are already on the Free plan.');
  checkDowngrade('free');
  update({ cancel_at_period_end: 1 });
  return getSubscription();
}
function resume() {
  const sub = getSubscription();
  if (!sub.cancel_at_period_end) throw bad('Your subscription is not scheduled to cancel.');
  update({ cancel_at_period_end: 0 });
  return getSubscription();
}

const planOut = (p) => ({ key: p.key, name: p.name, tagline: p.tagline, price: p.price, maxUsers: p.maxUsers, storageBytes: p.storageBytes, trashDays: p.trashDays, features: p.features, highlights: p.highlights });
function summary() {
  const sub = getSubscription();
  const p = PLANS[sub.plan];
  return {
    plan: sub.plan, planName: p.name, cycle: sub.cycle, status: sub.status, trialEndsAt: sub.trial_ends_at, trialUsed: !!sub.trial_used,
    currentPeriodStart: sub.current_period_start, currentPeriodEnd: sub.current_period_end, cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    features: p.features, limits: { users: p.maxUsers, storageBytes: p.storageBytes, trashDays: p.trashDays },
  };
}
function upcoming() {
  const sub = getSubscription();
  if (sub.plan === 'free' || sub.cancel_at_period_end) return null;
  const seats = billableSeats();
  const unit = PLANS[sub.plan].price[sub.cycle];
  return { date: sub.current_period_end, seats, unit, total: seats * unit, plan: sub.plan, cycle: sub.cycle, afterTrial: sub.status === 'trialing' };
}

module.exports = {
  PLANS, ORDER, FEATURE_LABEL, FEATURE_PLAN, TRIAL_DAYS,
  getSubscription, invalidate, update, feature, retentionDays, usage, billableSeats,
  assertSeat, assertStorage, assertFeature, validateCard, defaultCard, saveCard, cardOut, luhn, brandOf,
  createInvoice, invoiceOut, quote, checkout, startTrial, cancel, resume, planOut, summary, upcoming, money, fmtBytes, addCycle,
};
