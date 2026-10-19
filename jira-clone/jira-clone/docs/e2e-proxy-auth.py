# Simulates hostile preview proxies: headers / cookies / query tokens removed before they reach the server.
import re
from playwright.sync_api import sync_playwright
B='http://localhost:3000'; res=[]
def ok(n,c,x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n, x, flush=True)

def make_route(ctx_holder, strip_headers, strip_query):
    def handler(route):
        ctx_holder[0].clear_cookies()
        req=route.request
        url=req.url
        if strip_query: url=re.sub(r'([?&])access_token=[^&]*&?', r'\1', url).rstrip('?&')
        if '/api/events' in url: return route.abort()   # long-lived stream; not needed for this test
        h={k:v for k,v in req.headers.items() if k.lower() not in strip_headers}
        resp=route.fetch(url=url, headers=h)
        rh={k:v for k,v in resp.headers.items() if k.lower()!='set-cookie'}   # browser never gets a cookie
        ctx_holder[0].clear_cookies()
        route.fulfill(response=resp, headers=rh)
    return handler

def scenario(br, name, strip_headers, strip_query=False, expect_ok=True):
    ctx=br.new_context(viewport={'width':1400,'height':900})
    ctx.route('**/api/**', make_route([ctx], strip_headers | {'cookie'}, strip_query))
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(B+'/'); pg.locator('.login-card').wait_for()
    pg.locator('.demo-user').first.click(); pg.wait_for_timeout(2500)
    if expect_ok:
        ok(f'[{name}] browser holds no cookie', not ctx.cookies())
        ok(f'[{name}] logged in, list loaded', pg.locator('.login-card').count()==0 and pg.locator('tbody tr').count()>=20, pg.locator('tbody tr').count())
        for tab in ['Board','Backlog','Releases','Reports','Summary']:
            pg.locator(f'.tabs .tab:has-text("{tab}")').click(); pg.wait_for_timeout(900)
        ok(f'[{name}] still logged in after visiting 5 views', pg.locator('.login-card').count()==0)
        pg.reload(); pg.wait_for_timeout(2500)
        ok(f'[{name}] still logged in after reload', pg.locator('.login-card').count()==0 and 'session has expired' not in pg.inner_text('body'))
        pg.screenshot(path=f'/tmp/e2e/proxy-{name}.png')
    else:
        body=pg.inner_text('body')
        ok(f'[{name}] stays on login with a clear explanation (not "session expired")', pg.locator('.login-card').count()==1 and 'dropped the session' in body and 'session has expired' not in body, body[body.find('Logged in'):][:160])
        pg.screenshot(path=f'/tmp/e2e/proxy-{name}.png')
    ok(f'[{name}] no page errors', not errs, errs[:2])
    ctx.unroute_all(behavior='ignoreErrors'); ctx.close()

with sync_playwright() as p:
    br=p.chromium.launch()
    scenario(br, 'no-proxy-issues', set())
    scenario(br, 'auth-header-and-cookies-stripped', {'authorization','cookie'})
    scenario(br, 'all-headers-and-cookies-stripped', {'authorization','x-jc-auth','cookie'})
    scenario(br, 'everything-stripped', {'authorization','x-jc-auth','cookie'}, strip_query=True, expect_ok=False)
    br.close()
print(sum(res),'/',len(res))
