'use strict';

/**
 * Live updates over Server-Sent Events. Payloads carry no data, only what
 * changed and who did it; clients reload what they show.
 */
class LiveUpdates {
  constructor({ pingMs = 25000 } = {}) {
    this.clients = new Set();
    this.seq = 0;
    this.pingMs = pingMs;
  }

  online() {
    return [...new Set([...this.clients].map((c) => c.user.id))];
  }

  /** Attaches an HTTP response as an event stream for `user`. */
  connect(req, res, user) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    const client = { res, user, clientId: String(req.query.client || '') };
    this.clients.add(client);
    this.send(client, 'hello', { users: this.online() });
    this.broadcast('presence', { users: this.online() });
    const ping = setInterval(() => res.write(': ping\n\n'), this.pingMs);
    req.on('close', () => {
      clearInterval(ping);
      this.clients.delete(client);
      this.broadcast('presence', { users: this.online() });
    });
  }

  send(client, event, data) {
    try {
      this.seq += 1;
      client.res.write(`id: ${this.seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.clients.delete(client);
    }
  }

  /** `filter(client)` may be async (permission checks). */
  async broadcast(event, data, filter = null) {
    for (const client of [...this.clients]) {
      if (!filter || (await filter(client))) this.send(client, event, data);
    }
  }

  closeAll() {
    for (const client of this.clients) client.res.end();
    this.clients.clear();
  }
}

module.exports = { LiveUpdates };
