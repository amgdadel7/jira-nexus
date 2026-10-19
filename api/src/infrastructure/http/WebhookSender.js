'use strict';

const crypto = require('crypto');

const TIMEOUT_MS = 10000;

/** Posts a signed JSON payload (Atlassian-compatible headers). Never throws. */
class WebhookSender {
  constructor({ timeoutMs = TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  static sign(secret, body) {
    return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  async post({ url, secret, event, uuid, body }) {
    const headers = {
      'Content-Type': 'application/json', 'User-Agent': 'Masar-Webhooks/1.0',
      'X-Atlassian-Webhook-Identifier': uuid, 'X-Masar-Event': event, 'X-Masar-Delivery': uuid,
    };
    if (secret) headers['X-Hub-Signature'] = WebhookSender.sign(secret, body);
    const started = Date.now();
    const out = { status: null, ok: false, error: null, response: null };
    try {
      const res = await this.fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(this.timeoutMs), redirect: 'manual' });
      out.status = res.status;
      out.ok = res.status >= 200 && res.status < 300;
      out.response = (await res.text().catch(() => '')).slice(0, 2000);
      if (!out.ok) out.error = `HTTP ${res.status}`;
    } catch (err) {
      out.error = err.name === 'TimeoutError' ? `Timed out after ${this.timeoutMs / 1000}s` : (err.cause?.code || err.message);
    }
    out.durationMs = Date.now() - started;
    return out;
  }
}

module.exports = { WebhookSender };
