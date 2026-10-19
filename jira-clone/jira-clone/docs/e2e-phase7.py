"""Phase 7 end-to-end checks: time tracking, votes, personal settings/theme, automation, CSV import,
webhooks, timesheet and the motion layer. Run against a freshly seeded server:
    node server/seed.js --force && node server/index.js &
    python3 docs/e2e-phase7.py            (BASE=http://localhost:3000 by default)
Mutates data (creates rules, imports work items) - reseed afterwards."""
import json, os, sys, time, threading, hmac, hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import quote
from playwright.sync_api import sync_playwright

B = os.environ.get('BASE', 'http://localhost:3000')
passed, failed = [], []
def check(name, cond, extra=''):
    (passed if cond else failed).append(name)
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))

# ---- tiny webhook receiver
received = []
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        received.append({'headers': dict(self.headers), 'body': body})
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self, *a): pass
srv = HTTPServer(('127.0.0.1', 4566), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

def login_demo(pg, idx):
    pg.goto(B + '/jira/software/projects/KAN/list'); pg.locator('.login-card').wait_for()
    pg.locator('.demo-user').nth(idx).click(); pg.locator('tr.issue-row').first.wait_for(timeout=10000)
def token(pg): return pg.evaluate("localStorage.getItem('jc.token') || sessionStorage.getItem('jc.token')")
def api(pg, method, url, data=None):
    r = pg.request.fetch(B + url, method=method, headers={'Authorization': 'Bearer ' + token(pg), 'Content-Type': 'application/json'}, data=json.dumps(data) if data is not None else None)
    try: return r.status, r.json()
    except Exception: return r.status, None

with sync_playwright() as p:
    br = p.chromium.launch()
    errs = []
    c = br.new_context(viewport={'width': 1440, 'height': 900}); pg = c.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    login_demo(pg, 0)  # Ahmed (site admin)

    # ---------------- motion layer
    check('list rows carry data-issue-key', pg.locator('tr.issue-row[data-issue-key]').count() == pg.locator('tr.issue-row').count())
    pg.hover('.topnav-right button[title=Settings]'); time.sleep(0.6)
    check('ADS tooltip appears on hover', pg.locator('.masar-tooltip').count() == 1)
    pg.mouse.move(700, 600); time.sleep(0.4)
    check('title attribute restored after tooltip hides (selectors keep working)', pg.locator('.topnav-right button[title=Settings]').count() == 1 and pg.locator('.masar-tooltip').count() == 0)
    check('tab indicator rendered', pg.locator('.tabs.has-indicator .tab-indicator').count() == 1)
    pg.locator('.topnav-right button[title=Settings]').click(); time.sleep(0.2)
    check('popover has placement for directional enter', pg.locator('.popover[data-placement]').count() >= 1)
    pg.keyboard.press('Escape'); time.sleep(0.3)
    check('popover removed from DOM after exit (ghost only)', pg.locator('.popover').count() == 0)
    pg.keyboard.press('['); time.sleep(0.4)
    check('sidebar collapses (kept in DOM for animation)', pg.locator('.sidebar-wrap.collapsed').count() == 1)
    pg.hover('.topnav-left button[title^="Toggle sidebar"]'); time.sleep(0.4)
    check('hovering the toggle opens the flyout', pg.locator('.sidebar-wrap.collapsed.flyout').count() == 1)
    pg.keyboard.press('['); time.sleep(0.3)
    check('sidebar expands again', pg.locator('.sidebar-wrap.collapsed').count() == 0)

    # ---------------- time tracking (UI)
    st, d = api(pg, 'GET', '/api/search?jql=' + quote('project = KAN AND status = "In Progress" AND type != Epic ORDER BY cf[10019] ASC'))
    target = d['issues'][0]; key = target['key']
    pg.goto(B + f'/jira/software/projects/KAN/list?selectedIssue={key}'); pg.locator('[data-testid=time-tracking]').wait_for(timeout=10000)
    check('issue shows time tracking field', 'logged' in pg.inner_text('[data-testid=time-tracking]') or 'No time logged' in pg.inner_text('[data-testid=time-tracking]'))
    before = api(pg, 'GET', f'/api/issues/{key}')[1]
    pg.locator('[data-testid=time-tracking]').click()
    pg.locator('.modal input[placeholder="2h 30m"]').wait_for()
    pg.fill('.modal input[placeholder="2h 30m"]', '1h 30m')
    pg.fill('.modal textarea', 'E2E pairing session')
    pg.click('.modal button:text-is("Save")'); time.sleep(1)
    after = api(pg, 'GET', f'/api/issues/{key}')[1]
    check('log work adds 1h30m to time spent', after['timeSpent'] - before['timeSpent'] == 5400, f"{before['timeSpent']}->{after['timeSpent']}")
    if before['remainingEstimate'] is not None:
        check('remaining estimate auto-reduced', after['remainingEstimate'] == max(0, before['remainingEstimate'] - 5400), f"{before['remainingEstimate']}->{after['remainingEstimate']}")
    check('work log tab opens after saving', pg.locator('.chip-tab.on:text-is("Work log")').count() == 1)
    check('new worklog listed', 'E2E pairing session' in pg.inner_text('.issue-body') if pg.locator('.issue-body').count() else 'E2E pairing session' in pg.content())
    check('invalid duration rejected by API', api(pg, 'POST', f'/api/issues/{key}/worklogs', {'timeSpent': 'soon'})[0] == 400)
    st, upd = api(pg, 'PATCH', f'/api/issues/{key}', {'originalEstimate': '3d'})
    check('PATCH originalEstimate accepts duration strings', st == 200 and upd.get('originalEstimate') == 3 * 8 * 3600, str(upd)[:120])
    check('JQL timespent works', api(pg, 'GET', '/api/search?jql=' + quote('project = KAN AND timespent > 0'))[1]['total'] >= 1)

    # ---------------- votes (UI)
    st, d = api(pg, 'GET', '/api/search?jql=' + quote('project = KAN AND status != Done AND reporter != currentUser() AND type != Epic'))
    vkey = d['issues'][0]['key']; v0 = api(pg, 'GET', f'/api/issues/{vkey}/votes')[1]
    pg.goto(B + f'/jira/software/projects/KAN/list?selectedIssue={vkey}'); pg.locator('.vote-btn').wait_for()
    pg.click('.vote-btn'); time.sleep(0.8)
    v1 = api(pg, 'GET', f'/api/issues/{vkey}/votes')[1]
    check('vote button toggles vote', v1['hasVoted'] != v0['hasVoted'] and abs(v1['votes'] - v0['votes']) == 1)
    check('vote count animates (bump class)', pg.locator('.vote-count.bump').count() == 1)
    pg.click('.vote-btn'); time.sleep(0.6)
    check('vote toggles back', api(pg, 'GET', f'/api/issues/{vkey}/votes')[1]['hasVoted'] == v0['hasVoted'])
    rk = api(pg, 'GET', '/api/search?jql=' + quote('project = KAN AND reporter = currentUser() AND status != Done'))[1]['issues'][0]['key']
    check('cannot vote on own work item', api(pg, 'POST', f'/api/issues/{rk}/votes')[0] == 400)
    pg.keyboard.press('Escape'); time.sleep(0.4)

    # ---------------- personal settings + theme
    pg.goto(B + '/jira/software/projects/KAN/list'); pg.locator('tr.issue-row').first.wait_for()
    pg.locator('.topnav-right .avatar-btn').click()
    check('avatar menu has theme options', pg.locator('.menu-item:has-text("Dark")').count() == 1)
    pg.click('.menu-item:has-text("Dark")'); time.sleep(0.8)
    check('dark theme applied instantly', pg.evaluate('document.documentElement.dataset.theme') == 'dark')
    check('theme saved on server', api(pg, 'GET', '/api/auth/me/preferences')[1]['theme'] == 'dark')
    pg.reload(); pg.locator('tr.issue-row').first.wait_for()
    check('theme persists across reload (pre-paint)', pg.evaluate('document.documentElement.dataset.theme') == 'dark')
    pg.locator('.topnav-right .avatar-btn').click(); pg.click('.menu-item:has-text("Personal settings")')
    pg.locator('[data-testid=preferences]').wait_for()
    pg.click('[data-theme-option=light]'); time.sleep(0.5)
    check('preferences modal switches back to light', pg.evaluate('document.documentElement.dataset.theme') == 'light')
    pg.locator('label.switch:has(input[aria-label="Reduce motion"])').click(); time.sleep(0.5)
    check('reduce motion toggles html class', pg.evaluate("document.documentElement.classList.contains('reduce-motion')"))
    pg.locator('label.switch:has(input[aria-label="Reduce motion"])').click(); time.sleep(0.5)
    pg.locator('label.switch:has(input[data-notify=comment])').click(); time.sleep(0.5)
    check('notification preference saved', api(pg, 'GET', '/api/auth/me/preferences')[1]['notify']['comment'] is False)
    pg.locator('label.switch:has(input[data-notify=comment])').click(); time.sleep(0.4)
    png = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201a5f6a4a90000000049454e44ae426082')
    pg.set_input_files('[data-testid=avatar-input]', files=[{'name': 'me.png', 'mimeType': 'image/png', 'buffer': png}]); time.sleep(1)
    me = api(pg, 'GET', '/api/auth/me')[1]['user']
    check('avatar uploaded', bool(me.get('avatarUrl')))
    check('avatar image shown in modal', pg.locator('[data-testid=preferences] img').count() >= 1)
    r = pg.request.get(B + me['avatarUrl']) if me.get('avatarUrl') else None
    check('avatar served publicly', r is not None and r.status == 200)
    check('non-image avatar rejected', pg.request.fetch(B + '/api/auth/me/avatar', method='POST', headers={'Authorization': 'Bearer ' + token(pg), 'Content-Type': 'image/png'}, data=b'hello').status == 400)
    pg.click('[data-testid=preferences] button:text-is("Remove")'); time.sleep(0.8)
    check('avatar removed', not api(pg, 'GET', '/api/auth/me')[1]['user'].get('avatarUrl'))
    pg.keyboard.press('Escape'); time.sleep(0.4)

    # ---------------- automation (UI)
    pg.goto(B + '/jira/software/projects/KAN/settings/automation'); pg.locator('[data-testid=automation]').wait_for(timeout=10000)
    check('automation lists seeded rules', pg.locator('.auto-rule').count() == 3)
    pg.click('button:has-text("Create rule")'); pg.locator('#rule-name').wait_for()
    pg.fill('#rule-name', 'E2E: label new stories')
    pg.select_option('select[aria-label=Trigger]', 'issue_created')
    pg.fill('input[aria-label=Condition]', 'type = Story')
    pg.select_option('select[aria-label=Action]', 'add_label')
    pg.fill('input[aria-label=Label]', 'e2e-auto')
    pg.click('.modal button:text-is("Turn it on")'); time.sleep(1)
    check('rule created from builder', pg.locator('.auto-rule[data-rule="E2E: label new stories"]').count() == 1)
    st, story = api(pg, 'POST', '/api/issues', {'summary': 'E2E automation story', 'type': 'Story', 'projectKey': 'KAN'})
    time.sleep(0.5)
    check('rule fires on create (label added)', 'e2e-auto' in api(pg, 'GET', f"/api/issues/{story['key']}")[1]['labels'])
    hist = api(pg, 'GET', f"/api/issues/{story['key']}")[1]['history']
    check('change attributed to automation bot', any(h.get('authorId') == 'automation' or h.get('userId') == 'automation' or h.get('actorId') == 'automation' for h in hist), str(hist)[:200])
    pg.click('.chip-tab:text-is("Audit log")'); time.sleep(0.8)
    check('automation audit shows the run', pg.locator('.run-row').count() >= 1)
    pg.click('.chip-tab:has-text("Rules")'); time.sleep(0.3)
    pg.locator('.auto-rule[data-rule="E2E: label new stories"] label.switch').click(); time.sleep(0.6)
    rules = api(pg, 'GET', '/api/projects/KAN/automation')[1]['rules']
    check('rule disabled via switch', not [r for r in rules if r['name'] == 'E2E: label new stories'][0]['enabled'])
    check('bad JQL condition rejected', api(pg, 'POST', '/api/projects/KAN/automation', {'name': 'x', 'trigger': {'type': 'issue_created'}, 'condition': 'type = = Bug', 'actions': [{'type': 'add_label', 'label': 'a'}]})[0] == 400)
    pg.click('.chip-tab:text-is("Templates")'); time.sleep(0.3)
    n0 = len(rules); pg.locator('.template-card').first.click(); time.sleep(1)
    check('template creates a rule', len(api(pg, 'GET', '/api/projects/KAN/automation')[1]['rules']) == n0 + 1)
    pg.keyboard.press('Escape'); time.sleep(0.4)

    # ---------------- CSV import (UI)
    pg.goto(B + '/jira/software/projects/KAN/settings/import'); pg.locator('[data-testid=import]').wait_for()
    pg.click('text=Use a sample'); pg.click('button:text-is("Check CSV")'); pg.locator('[data-testid=import-preview]').wait_for()
    check('import preview maps columns', pg.locator('.map-chip.ok').count() >= 8)
    check('import preview shows rows', pg.locator('[data-testid=import-preview] tbody tr').count() == 3)
    total0 = api(pg, 'GET', '/api/search?jql=' + quote('project = KAN'))[1]['total']
    pg.click('button:has-text("Import 3 work items")'); time.sleep(1.2)
    check('import creates 3 work items', api(pg, 'GET', '/api/search?jql=' + quote('project = KAN'))[1]['total'] == total0 + 3)
    st, bad = api(pg, 'POST', '/api/projects/KAN/import', {'csv': 'Summary,Priority\nA,Urgentish\n', 'dryRun': True})
    check('import dry run reports row errors', st == 200 and len(bad['errors']) == 1)

    # ---------------- webhooks (UI + real receiver)
    pg.goto(B + '/jira/settings/webhooks'); pg.locator('[data-testid=webhooks]').wait_for()
    pg.click('button:has-text("Create a webhook")'); pg.locator('#wh-name').wait_for()
    pg.fill('#wh-name', 'E2E receiver'); pg.fill('#wh-url', 'http://127.0.0.1:4566/hook'); pg.fill('#wh-secret', 's3cret')
    pg.click('.modal button:text-is("Create")'); time.sleep(0.8)
    check('webhook created', pg.locator('.wh-card[data-webhook="E2E receiver"]').count() == 1)
    pg.locator('.wh-card[data-webhook="E2E receiver"] button[title="Webhook actions"]').click()
    pg.click('.menu-item:has-text("Send test")'); time.sleep(1.5)
    check('test ping delivered to receiver', len(received) >= 1)
    if received:
        h = {k.lower(): v for k, v in received[-1]['headers'].items()}
        sig = 'sha256=' + hmac.new(b's3cret', received[-1]['body'], hashlib.sha256).hexdigest()
        check('payload HMAC signature valid', h.get('x-hub-signature') == sig)
        check('event header present', h.get('x-masar-event') == 'ping')
    n = len(received)
    api(pg, 'POST', '/api/issues', {'summary': 'E2E webhook item', 'type': 'Task', 'projectKey': 'KAN'}); time.sleep(1.2)
    check('issue_created event delivered', len(received) > n and json.loads(received[-1]['body']).get('webhookEvent') == 'jira:issue_created')
    pg.reload(); pg.locator('.wh-card').first.wait_for()
    pg.locator('.wh-card[data-webhook="E2E receiver"] button[title="Webhook actions"]').click()
    pg.click('.menu-item:has-text("View deliveries")'); pg.locator('.delivery-row').first.wait_for()
    check('delivery log lists deliveries', pg.locator('.delivery-row').count() >= 2)
    pg.locator('.delivery-row').first.click(); time.sleep(0.5)
    check('delivery payload viewable', pg.locator('pre.payload').count() >= 1)
    n = len(received); pg.locator('.delivery-row button:text-is("Redeliver")').first.click(); time.sleep(1.2)
    check('redeliver re-sends', len(received) == n + 1)
    pg.keyboard.press('Escape'); time.sleep(0.4)

    # ---------------- timesheet
    pg.goto(B + '/jira/software/projects/KAN/reports'); pg.click('.report-link:has-text("Timesheet")'); pg.locator('[data-testid=timesheet]').wait_for()
    time.sleep(0.8)
    check('timesheet shows people rows', pg.locator('.ts-table tbody tr:not(.total)').count() >= 2)
    pg.click('.cycle-toggle button:text-is("Work items")'); time.sleep(0.3)
    check('timesheet groups by work item', pg.locator('.ts-table tbody tr:not(.total) button.link').count() >= 2)
    check('timesheet range capped at 62 days', api(pg, 'GET', '/api/reports/timesheet?project=KAN&from=2026-01-01&to=2026-06-01')[0] == 400)

    # ---------------- permissions
    c2 = br.new_context(); pg2 = c2.new_page(); login_demo(pg2, 3)  # Khalid, viewer
    check('viewer cannot log work', api(pg2, 'POST', f'/api/issues/{key}/worklogs', {'timeSpent': '1h'})[0] == 403)
    check('viewer cannot manage automation', api(pg2, 'GET', '/api/projects/KAN/automation')[0] in (403, 404))
    check('non-admin cannot list webhooks', api(pg2, 'GET', '/api/admin/webhooks')[0] == 403)
    c2.close()

    check('no uncaught page errors', not errs, '; '.join(errs)[:300])
    br.close()
srv.shutdown()
print(f'\n{len(passed)} passed, {len(failed)} failed')
if failed: print('FAILED:', failed); sys.exit(1)
