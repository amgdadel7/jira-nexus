'use strict';
process.env.DATABASE_URL ||= 'postgres://masar:masar@localhost:5432/masar_test';
process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = '/tmp/masar-up';
const { bootstrap } = require('./src/main');
const { seedDemo } = require('./src/infrastructure/database/seeds/demoSeed');

(async () => {
  const t0 = Date.now();
  const { app, container } = await bootstrap({ listen: false, serveClient: false, seed: (c) => seedDemo(c, { force: true }) });
  console.log('seeded in', Date.now() - t0, 'ms');
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.argv[2] || 'ahmed@ahdfinancial.com', password: 'password' }) })).json();
  global.base = base; const H = global.H = { authorization: 'Bearer ' + login.token, 'content-type': 'application/json' };
  global.call = async (method, path, body) => {
    const r = await fetch(base + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, data };
  };
  const script = require('fs').readFileSync(process.argv[3] || '_checks.js', 'utf8');
  try { await eval(`(async () => { ${script} })()`); } catch (e) { console.error('SCRIPT ERROR', e); }
  server.close();
  await container.db.close();
  process.exit(0);
})().catch((e) => { console.error('BOOT ERROR', e); process.exit(1); });
