let r = await call('POST', '/issues', { projectKey: 'KAN', type: 'Task', summary: 'will vanish' }); console.log('created', r.status, r.data.key);
r = await call('POST', '/reset'); console.log('reset', r.status, !!r.data.token);
H.authorization = 'Bearer ' + r.data.token;
r = await call('GET', '/issues/KAN-31'); console.log('after reset KAN-31', r.status);
r = await call('GET', '/issues?jql=' + encodeURIComponent('project = KAN')); console.log('KAN count', r.status, r.data.total ?? r.data.issues?.length);
r = await call('GET', '/projects/KAN/automation'); console.log('automation runs', r.data.rules.map((x) => x.runs).join(','));
