let r = await fetch(base + '/openapi.json'); const s = await r.json(); console.log('openapi', r.status, s.openapi, s.info.version, Object.keys(s.paths).length);
r = await fetch(base + '/docs'); console.log('docs', r.status, (await r.text()).length);
