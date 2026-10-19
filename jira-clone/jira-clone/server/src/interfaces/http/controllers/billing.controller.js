'use strict';

const { handle, created } = require('../handler');
const { PLANS, PLAN_ORDER, TRIAL_DAYS } = require('../../../domain/billing');
const present = require('../presenters/billing');

/**
 * Billing & subscription (simulated payments). Everyone signed in can see the
 * plan and usage; only site administrators can change it.
 */
module.exports = function billingController(router, { services, guards }) {
  const { billing } = services;
  const { requireAuth, requireAdmin } = guards;
  const plans = () => PLAN_ORDER.map((k) => present.plan(PLANS[k]));

  router.get('/plans', handle(() => ({ currency: 'USD', trialDays: TRIAL_DAYS, plans: plans(), annualDiscount: 'Pay for 10 months, get 12' })));

  router.get('/billing', requireAuth, handle(async (req) => {
    const isAdmin = req.actor.isSiteAdmin;
    const out = { subscription: await billing.summary(), usage: await billing.usage(), canManage: isAdmin, plans: plans() };
    if (isAdmin) {
      const sub = await billing.getSubscription();
      out.paymentMethod = present.card(await billing.defaultCard());
      out.upcoming = await billing.upcoming();
      out.billingEmail = sub.billing_email || req.user.email;
      out.company = sub.company || '';
    }
    return out;
  }));

  router.get('/billing/quote', requireAdmin, handle((req) => billing.quote(String(req.query.plan || ''), String(req.query.cycle || 'monthly'))));

  router.post('/billing/checkout', requireAdmin, handle(async (req, res) => {
    const { plan, cycle = 'monthly', card, useSaved } = req.body || {};
    const invoice = await billing.checkout(req.actor, { plan, cycle, card, useSaved: !!useSaved });
    return created(res, { ok: true, invoice: present.invoice(invoice), subscription: await billing.summary() });
  }));

  router.post('/billing/trial', requireAdmin, handle(async (req) => {
    await billing.startTrial(req.actor, req.body?.plan || 'premium');
    return { ok: true, subscription: await billing.summary() };
  }));

  router.post('/billing/cancel', requireAdmin, handle(async (req) => {
    await billing.cancel(req.actor);
    return { ok: true, subscription: await billing.summary() };
  }));

  router.post('/billing/resume', requireAdmin, handle(async (req) => {
    await billing.resume(req.actor);
    return { ok: true, subscription: await billing.summary() };
  }));

  router.put('/billing/payment-method', requireAdmin, handle(async (req) => {
    const { card, paidInvoices } = await billing.updatePaymentMethod(req.actor, req.body);
    return { ok: true, paymentMethod: present.card(card), paidInvoices };
  }));

  router.put('/billing/details', requireAdmin, handle(async (req) => {
    await billing.updateDetails(req.body || {});
    return { ok: true };
  }));

  router.get('/billing/invoices', requireAdmin, handle(async () => (await billing.listInvoices()).map(present.invoice)));
  router.get('/billing/invoices/:id', requireAdmin, handle(async (req) => present.invoice(await billing.getInvoice(req.params.id))));
  router.get('/billing/invoices/:id/html', requireAdmin, handle(async (req, res) => {
    const inv = present.invoice(await billing.getInvoice(req.params.id));
    const sub = await billing.getSubscription();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(present.invoiceHtml(inv, { company: sub.company, billingEmail: sub.billing_email || req.user.email }));
  }));
};
