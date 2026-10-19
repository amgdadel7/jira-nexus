for (const p of ['/issues/FIN-1', '/search?jql=project%20%3D%20FIN', '/projects/FIN']) { const r = await call('GET', p); console.log(r.status, p, JSON.stringify(r.data).slice(0, 120)); }
