'use strict';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Small HTML page shown at the end of a social login. In a popup it hands the result to the opener
 * (postMessage on the same origin, BroadcastChannel as a fallback for partitioned storage) and closes;
 * in a full-page redirect it stores the token and goes to the app.
 */
function oauthResultPage({ popup, provider, payload, error }) {
  const data = JSON.stringify({ type: 'masar-oauth', provider, ...(error ? { error } : payload) }).replace(/</g, '\\u003c');
  const body = error
    ? `<h2>Couldn’t sign you in</h2><p>${escapeHtml(error)}</p><p><a href="/login">Back to log in</a></p>`
    : '<h2>Signed in</h2><p>You can close this window.</p>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Masar</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#172B4D;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#F7F8F9}
.c{background:#fff;padding:32px 40px;border-radius:8px;box-shadow:0 1px 3px rgba(9,30,66,.25);max-width:420px;text-align:center}a{color:#0C66E4}</style></head>
<body><div class="c">${body}</div>
<script>(function(){var d=${data};var popup=${popup ? 'true' : 'false'};
function fallback(){ if(d.token){ try{ (d.remember?localStorage:sessionStorage).setItem('jc.token', d.token); }catch(e){} location.replace('/'); } }
if(!popup){ fallback(); return; }
var sent=false;
try{ if(window.opener && !window.opener.closed){ window.opener.postMessage(d, location.origin); sent=true; } }catch(e){}
try{ var bc=new BroadcastChannel('masar-oauth'); bc.onmessage=function(e){ if(e.data && e.data.type==='masar-oauth-ack') window.close(); }; bc.postMessage(d); }catch(e){}
if(sent) setTimeout(function(){ window.close(); }, 150);
else if(d.token) setTimeout(function(){ try{ window.close(); }catch(e){} setTimeout(fallback, 200); }, 1500);
})();</script></body></html>`;
}

module.exports = { oauthResultPage };
