'use strict';

/**
 * Subscription plans, limits, card validation and proration – pure rules.
 * Payments are simulated: cards are validated (Luhn, expiry, CVC) and only the
 * brand + last four digits are kept. Test numbers:
 *   4000 0000 0000 0002 → card declined · 4000 0000 0000 9995 → insufficient funds
 */
const { AppError, ValidationError } = require('../shared/errors');

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
const PLAN_ORDER = ['free', 'standard', 'premium'];
const CYCLES = ['monthly', 'annual'];
const FEATURE_LABEL = { permissions: 'Permissions & access levels', audit_log: 'Audit log' };
const FEATURE_PLAN = { permissions: 'standard', audit_log: 'premium' };
const TRIAL_DAYS = 14;

const planByKey = (key) => PLANS[key] || PLANS.free;
const nextPlanFor = (predicate) => PLAN_ORDER.map((k) => PLANS[k]).find(predicate);

function addCycle(iso, cycle) {
  const d = new Date(iso);
  if (cycle === 'annual') d.setUTCFullYear(d.getUTCFullYear() + 1); else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

const money = (cents) => `$${(cents / 100).toFixed(2)}`;
function formatBytes(b) {
  if (b == null) return 'Unlimited';
  if (b >= GB) return `${+(b / GB).toFixed(b % GB ? 1 : 0)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

const seatLine = (plan, cycle, seats) => ({
  description: `${plan.name} plan (${cycle}) – ${seats} user${seats === 1 ? '' : 's'} × ${money(plan.price[cycle])}`,
  amount: plan.price[cycle] * seats,
});

/* ---------- cards ---------- */
function luhn(num) {
  let sum = 0;
  for (let i = 0; i < num.length; i += 1) {
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

const declined = (message, code) => new AppError(message, 402, { code });

/** Validates a card and returns only the parts that may be stored. */
function validateCard(card = {}, now = new Date()) {
  const number = String(card.number || '').replace(/[\s-]/g, '');
  const holder = String(card.holder || card.name || '').trim();
  const cvc = String(card.cvc || '').trim();
  let month;
  let year;
  if (card.exp) {
    const m = String(card.exp).match(/^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/);
    if (m) { month = Number(m[1]); year = Number(m[2]); }
  } else { month = Number(card.expMonth); year = Number(card.expYear); }
  if (year < 100) year += 2000;
  if (!holder) throw new ValidationError('Enter the name on the card.', { field: 'holder' });
  if (!/^\d{12,19}$/.test(number) || !luhn(number)) throw new ValidationError('Your card number is invalid.', { field: 'number' });
  if (!month || month < 1 || month > 12 || !year) throw new ValidationError('Enter the expiry date as MM/YY.', { field: 'exp' });
  const y = now.getUTCFullYear();
  if (year < y || (year === y && month < now.getUTCMonth() + 1) || year > y + 20) throw new ValidationError('Your card has expired or the expiry date is invalid.', { field: 'exp' });
  const brand = brandOf(number);
  if (!(brand === 'Amex' ? /^\d{4}$/ : /^\d{3}$/).test(cvc)) throw new ValidationError(`Enter the ${brand === 'Amex' ? '4' : '3'}-digit security code.`, { field: 'cvc' });
  if (number === '4000000000000002') throw declined('Your card was declined. Try a different card.', 'card_declined');
  if (number === '4000000000009995') throw declined('Your card has insufficient funds.', 'insufficient_funds');
  return { brand, last4: number.slice(-4), exp_month: month, exp_year: year, holder };
}

/* ---------- limits ---------- */
function seatLimitMessage(plan, used, extra) {
  if (plan.maxUsers == null || used + extra <= plan.maxUsers) return null;
  const up = nextPlanFor((x) => x.maxUsers == null || x.maxUsers >= used + extra);
  return {
    message: `Your ${plan.name} plan includes up to ${plan.maxUsers} users and you already have ${used}. Upgrade to ${up?.name || 'a higher plan'} to add more people.`,
    extra: { limit: 'users', max: plan.maxUsers, used, upgradeTo: up?.key },
  };
}

function storageLimitMessage(plan, used, bytes) {
  if (plan.storageBytes == null || used + bytes <= plan.storageBytes) return null;
  const up = nextPlanFor((x) => x.storageBytes == null || x.storageBytes >= used + bytes);
  return {
    message: `This upload would exceed the ${formatBytes(plan.storageBytes)} storage included in your ${plan.name} plan. Upgrade to ${up?.name || 'a higher plan'} for more storage.`,
    extra: { limit: 'storage', max: plan.storageBytes, used, upgradeTo: up?.key },
  };
}

function featureLimitMessage(feature) {
  const up = FEATURE_PLAN[feature];
  const single = feature === 'audit_log';
  return {
    message: `${FEATURE_LABEL[feature] || feature} ${single ? 'is' : 'are'} available on the ${PLANS[up].name} plan and above. Upgrade to use ${single ? 'it' : 'them'}.`,
    extra: { limit: 'feature', feature, upgradeTo: up },
  };
}

/** Reason a site cannot move to `plan` with its current usage (or null). */
function downgradeProblem(plan, usage) {
  if (plan.maxUsers != null && usage.users > plan.maxUsers) {
    const n = usage.users - plan.maxUsers;
    return `The ${plan.name} plan allows ${plan.maxUsers} users but you have ${usage.users} active. Deactivate ${n} user${n === 1 ? '' : 's'} first.`;
  }
  if (plan.storageBytes != null && usage.storageBytes > plan.storageBytes) {
    return `The ${plan.name} plan includes ${formatBytes(plan.storageBytes)} storage but you are using ${formatBytes(usage.storageBytes)}. Remove some attachments first.`;
  }
  return null;
}

/** Share of the current period that is still unused (0…1). */
function unusedShare(periodStart, periodEnd, now = Date.now()) {
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  return Math.max(0, end - now) / Math.max(1, end - start);
}

const invoiceNumber = (year, sequence) => `MSR-${year}-${String(sequence).padStart(5, '0')}`;

module.exports = {
  PLANS, PLAN_ORDER, CYCLES, FEATURE_LABEL, FEATURE_PLAN, TRIAL_DAYS, GB,
  planByKey, nextPlanFor, addCycle, money, formatBytes, seatLine, luhn, brandOf, validateCard,
  seatLimitMessage, storageLimitMessage, featureLimitMessage, downgradeProblem, unusedShare, invoiceNumber,
};
