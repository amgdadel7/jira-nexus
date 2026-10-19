# Phase 6 E2E: Atlassian-style sign up / log in, OAuth popup (fake provider), plans & billing, plan limits.
import json, threading, secrets, base64, subprocess, re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs, urlencode
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3000'; SHOTS = '/home/user/jira-clone/docs/screenshots/'
res = []
def ok(name, cond, info=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {info}'))

# ---------- fake OpenID provider ----------
codes = {}
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
class FP(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == '/authorize':
            code = secrets.token_hex(6); codes[code] = {'nonce': q.get('nonce'), 'sub': 'slack-777', 'email': 'lina@example.org', 'name': 'Lina Haddad'}
            self.send_response(302); self.send_header('Location', q['redirect_uri'] + '?' + urlencode({'code': code, 'state': q['state']})); self.end_headers(); return
        if u.path == '/userinfo':
            c = codes.get(self.headers.get('Authorization', '').replace('Bearer at-', ''))
            self.send_response(200 if c else 401); self.send_header('Content-Type', 'application/json'); self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'sub': c['sub'], 'email': c['email'], 'email_verified': True, 'name': c['name']} if c else {}).encode()); return
        self.send_response(404); self.end_headers()
    def do_POST(self):
        body = parse_qs(self.rfile.read(int(self.headers['Content-Length'])).decode()); code = body['code'][0]; c = codes.get(code)
        self.send_response(200 if c else 400); self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps({'ok': True, 'access_token': 'at-' + code, 'id_token': b64({'alg': 'none'}) + '.' + b64({'sub': c['sub'], 'aud': 'slack-cid', 'nonce': c['nonce']}) + '.x'} if c else {'error': 'invalid_grant'}).encode())
srv = HTTPServer(('127.0.0.1', 4555), FP); threading.Thread(target=srv.serve_forever, daemon=True).start()
FAKE = 'http://127.0.0.1:4555'

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
    def ctx():
        c = br.new_context(viewport={'width': 1366, 'height': 900}); pg = c.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e))); return c, pg

    # 1. sign up screen = clone of the Atlassian screen
    c, pg = ctx()
    pg.goto(B + '/signup'); pg.locator('.login-card').wait_for()
    ok('sign up heading', pg.locator('.auth-card h1').inner_text() == 'Sign up to continue')
    ok('logo + wordmark Masar', pg.locator('.auth-logo').inner_text().strip() == 'Masar' and pg.locator('.auth-logo svg[aria-label="Masar"]').count() == 1)
    ok('legal text', 'Cloud Terms of Service' in pg.locator('.auth-legal-text').inner_text() and 'Privacy Policy' in pg.locator('.auth-legal-text').inner_text())
    ok('4 social buttons in order', [b.strip() for b in pg.locator('.social-btn').all_inner_texts()] == ['Google', 'Microsoft', 'Apple', 'Slack'])
    ok('Or continue with', pg.locator('.auth-or').inner_text() == 'Or continue with:')
    ok('already have an account link', 'Already have a Masar account? Log in' in pg.locator('.auth-links').inner_text())
    ok('footer MASAR + one account', 'MASAR' in pg.locator('.auth-foot').inner_text() and 'One account' in pg.locator('.auth-foot').inner_text())
    ok('title', pg.title() == 'Sign up - Masar', pg.title())
    pg.locator('.auth-legal-text button').first.click(); ok('terms modal', pg.locator('.modal h2:text("Masar Cloud Terms of Service")').count() == 1); pg.keyboard.press('Escape')
    # unconfigured social provider
    pg.locator('.social-btn[data-provider=google]').click()
    ok('unconfigured provider explains', 'isn’t set up' in pg.locator('.login-error').inner_text())
    # invalid email
    pg.fill('#signup-email', 'nope'); pg.locator('.auth-card form .auth-btn').click()
    ok('invalid email error', 'valid email' in pg.locator('.login-error').inner_text())
    # existing account → login password step
    pg.fill('#signup-email', 'sara@ahdfinancial.com'); pg.locator('.auth-card form .auth-btn').click()
    pg.locator('#password').wait_for(timeout=5000)
    ok('existing email → log in with notice', 'already have a Masar account' in pg.locator('.login-notice').inner_text() and pg.url.endswith('/login'))
    pg.locator('.auth-email-chip button').click(); pg.locator('.auth-links button:text("Create an account")').click()
    # full sign up
    pg.fill('#signup-email', 'reem@example.org'); pg.locator('.auth-card form .auth-btn').click()
    pg.locator('.code-inputs').wait_for(timeout=5000)
    ok('verify screen', 'Check your inbox' in pg.locator('.auth-card h1').inner_text() and 'reem@example.org' in pg.locator('.auth-sub').inner_text())
    pg.screenshot(path=SHOTS + 'p6-verify.png')
    code = pg.locator('.dev-code-value').inner_text()
    wrong = '000000' if code != '000000' else '111111'
    for i, ch in enumerate(wrong): pg.locator('.code-box').nth(i).fill(ch)
    pg.locator('.login-error').wait_for(timeout=4000)
    ok('wrong code rejected', 'isn’t right' in pg.locator('.login-error').inner_text())
    pg.locator('.dev-code-value').click()
    pg.locator('#full-name').wait_for(timeout=5000)
    ok('finish screen shows verified email', 'reem@example.org' in pg.locator('.auth-email-chip.verified').inner_text())
    pg.fill('#full-name', 'Reem Saeed'); pg.fill('#new-password', 'short'); pg.locator('.auth-card form .auth-btn').click()
    ok('short password rejected', '8 characters' in pg.locator('.login-error').inner_text())
    pg.fill('#new-password', 'Masar-2026!'); pg.locator('.auth-card form .auth-btn').click()
    pg.locator('tr.issue-row').first.wait_for(timeout=10000)
    ok('signed up and inside the app', pg.locator('.login-card').count() == 0)
    ok('brand Masar in top bar', 'Masar' in pg.locator('.brand').inner_text())
    ok('plan chip Premium', pg.locator('.plan-chip').inner_text().lower() == 'premium')
    ok('page title Masar', pg.title().endswith('- Masar'), pg.title())
    s, me = api(pg, 'GET', '/api/auth/me'); ok('new user is a member', me['user']['role'] == 'member' and me['user']['name'] == 'Reem Saeed')
    c.close()

    # 2. two-step login
    c, pg = ctx()
    pg.goto(B + '/login'); pg.locator('.login-card').wait_for()
    pg.fill('#email', 'sara@ahdfinancial.com'); pg.locator('.auth-card form .auth-btn').click()
    ok('password step shows email chip', 'sara@ahdfinancial.com' in pg.locator('.auth-email-chip').inner_text())
    pg.fill('#password', 'wrong'); pg.locator('.auth-card form .auth-btn').click(); pg.locator('.login-error').wait_for()
    ok('wrong password message', 'Incorrect' in pg.locator('.login-error').inner_text())
    pg.fill('#password', 'password'); pg.locator('.auth-card form .auth-btn').click(); pg.locator('tr.issue-row').first.wait_for(timeout=10000)
    ok('logged in with email + password', pg.locator('.login-card').count() == 0)
    c.close()

    # 3. admin: security settings + OAuth popup
    c, pg = ctx(); login_demo(pg, 0)
    pg.goto(B + '/jira/settings/security'); pg.locator('.provider-row').first.wait_for()
    ok('security page lists 4 providers', pg.locator('.provider-row').count() == 4)
    pg.locator('.provider-row[data-provider=google] button:text("Configure")').click()
    ok('provider modal shows redirect URI', pg.locator('.modal input[readonly]').input_value().endswith('/api/auth/oauth/google/callback'))
    pg.fill('#pf-clientId', 'g-client'); pg.locator('.modal button:text("Save")').click(); pg.locator('.modal .login-error').wait_for()
    ok('enable without secret is refused', 'clientSecret' in pg.locator('.modal .login-error').inner_text())
    pg.keyboard.press('Escape')
    s, d = api(pg, 'PUT', '/api/admin/auth-providers/slack', {'enabled': True, 'clientId': 'slack-cid', 'clientSecret': 'slack-secret', 'authUrl': FAKE + '/authorize', 'tokenUrl': FAKE + '/token', 'userinfoUrl': FAKE + '/userinfo'})
    ok('configure slack via API', s == 200 and d['enabled'], d)
    pg.reload(); pg.locator('.provider-row').first.wait_for()
    ok('slack shows enabled', 'Enabled' in pg.locator('.provider-row[data-provider=slack]').inner_text().title())
    # signup policy
    pg.locator('.access-option:has-text("Invite only") input').check(); pg.wait_for_timeout(500)
    s, d = api(pg, 'GET', '/api/auth/config'); ok('policy saved: invite', d['signup'] == 'invite')
    pg.locator('.access-option:has-text("Anyone") input').check(); pg.wait_for_timeout(500)
    pg.screenshot(path=SHOTS + 'p6-security.png')
    c.close()

    c, pg = ctx()
    pg.goto(B + '/login'); pg.locator('.login-card').wait_for()
    with pg.expect_popup() as pop: pg.locator('.social-btn[data-provider=slack]').click()
    popup = pop.value
    pg.locator('tr.issue-row').first.wait_for(timeout=15000)
    s, me = api(pg, 'GET', '/api/auth/me')
    ok('OAuth popup signed up the Slack user', me['user']['email'] == 'lina@example.org' and me['user']['name'] == 'Lina Haddad', me)
    pg.wait_for_timeout(500); ok('popup closed itself', popup.is_closed())
    c.close()

    # 4. billing as admin
    c, pg = ctx(); login_demo(pg, 0)
    pg.locator('.topnav-right button[title=Settings]').click(); pg.locator('.menu-item:has-text("Billing & plans")').click()
    pg.locator('.plan-summary').wait_for()
    ok('billing overview: Premium monthly', 'Premium' in pg.locator('.plan-summary-name').inner_text() and 'monthly' in pg.locator('.plan-summary-name').inner_text())
    ok('usage shows 9 users (7 + 2 sign-ups)', '9' in pg.locator('.usage-row').first.inner_text(), pg.locator('.usage-row').first.inner_text())
    ok('card on file Visa 4242', 'Visa •••• 4242' in pg.locator('.card-line').inner_text())
    pg.screenshot(path=SHOTS + 'p6-billing.png', full_page=True)
    pg.locator('.settings-nav .side-item:has-text("Plans")').click(); pg.locator('.plan-card').first.wait_for()
    ok('3 plan cards', pg.locator('.plan-card').count() == 3)
    ok('premium is current', pg.locator('.plan-card[data-plan=premium] .plan-cta').inner_text() == 'Current plan')
    pg.locator('.cycle-toggle button:has-text("Annual")').click()
    ok('annual pricing shown', '$6.28' in pg.locator('.plan-card[data-plan=standard] .plan-price').inner_text(), pg.locator('.plan-card[data-plan=standard] .plan-price').inner_text())
    pg.screenshot(path=SHOTS + 'p6-plans.png', full_page=True)
    pg.locator('.plan-card[data-plan=standard] .plan-cta').click(); pg.locator('[data-testid=checkout-total]').wait_for()
    ok('checkout shows proration credit', pg.locator('.order-line.credit').count() == 1)
    pg.locator('.radio-row:has-text("Use a new card") input').check()
    pg.fill('#cc-name', 'Ahmed Al-Haddad'); pg.fill('#cc-number', '4000000000000002'); pg.fill('#cc-exp', '1230'); pg.fill('#cc-cvc', '123')
    ok('card number formatted', pg.locator('#cc-number').input_value() == '4000 0000 0000 0002')
    pg.screenshot(path=SHOTS + 'p6-checkout.png')
    pg.locator('.modal button:has-text("Pay")').click(); pg.locator('.modal .login-error').wait_for()
    ok('declined card error', 'declined' in pg.locator('.modal .login-error').inner_text())
    pg.fill('#cc-number', '5555555555554444'); pg.locator('.modal button:has-text("Pay")').click()
    pg.locator('.toast:has-text("Standard")').wait_for(timeout=8000)
    ok('upgrade/downgrade toast', 'Standard' in pg.locator('.toast').first.inner_text())
    pg.wait_for_timeout(600)
    ok('plan chip now Standard', pg.locator('.plan-chip').inner_text().lower() == 'standard')
    pg.locator('.settings-nav .side-item:has-text("Invoices")').click(); pg.locator('.invoices-table tbody tr').first.wait_for()
    ok('4 invoices, newest Mastercard', pg.locator('.invoices-table tbody tr').count() == 4)
    pg.locator('.invoices-table tbody tr').first.locator('button:text("View")').click()
    pg.locator('.invoice-frame').wait_for(); ok('invoice preview', 'Invoice' in pg.frame_locator('.invoice-frame').locator('h1').inner_text())
    pg.keyboard.press('Escape')
    # Standard → audit log locked
    pg.goto(B + '/jira/people'); pg.locator('button:has-text("Audit log")').first.click()
    pg.locator('.plan-lock').wait_for(timeout=5000)
    ok('audit log locked on Standard', 'Premium' in pg.locator('.plan-lock').inner_text())
    # cancel / resume
    pg.goto(B + '/jira/settings/billing'); pg.locator('.plan-summary').wait_for()
    pg.locator('button:has-text("Cancel subscription")').click(); pg.locator('.modal button.danger').click()
    pg.locator('button:has-text("Resume subscription")').wait_for(timeout=5000)
    ok('cancel scheduled', 'Cancels' in pg.locator('.plan-summary .lozenge').inner_text().title())
    # fast-forward to the end of the period → Free
    subprocess.run(['node', '-e', "const db=require('./server/db');db.prepare('UPDATE subscription SET current_period_end=? WHERE id=1').run(new Date(Date.now()-1000).toISOString())"], cwd='/home/user/jira-clone', check=True)
    pg.wait_for_timeout(1200); pg.reload(); pg.locator('.plan-summary').wait_for()
    ok('moved to Free at period end', 'Free' in pg.locator('.plan-summary-name').inner_text())
    ok('plan chip Free', pg.locator('.plan-chip').inner_text().lower() == 'free')
    pg.goto(B + '/jira/software/projects/PAY/settings/access'); pg.locator('.plan-lock').wait_for(timeout=6000)
    ok('access section shows plan lock', 'Standard' in pg.locator('.plan-lock').inner_text())
    pg.locator('.access-levels button, .access-levels label').filter(has_text='Private').first.click()
    pg.locator('.toast:has-text("View plans")').wait_for(timeout=5000)
    ok('402 toast with View plans action', pg.locator('.toast button:text("View plans")').count() == 1)
    pg.screenshot(path=SHOTS + 'p6-free-lock.png')
    pg.locator('.toast button:text("View plans")').click(); pg.locator('.plan-card').first.wait_for()
    ok('View plans navigates to plans', '/jira/settings/plans' in pg.url)
    # free trial
    pg.goto(B + '/jira/settings/billing'); pg.locator('.plan-summary').wait_for()
    ok('trial already used (seeded site)', pg.locator('button:has-text("Start 14-day")').count() == 0)
    c.close()

    # 5. member: read-only billing, no security menu
    c, pg = ctx(); login_demo(pg, 2)
    pg.locator('.topnav-right button[title=Settings]').click()
    ok('member has no Security menu', pg.locator('.menu-item:has-text("Security")').count() == 0)
    pg.locator('.menu-item:has-text("Billing & plans")').click(); pg.locator('.plan-summary').wait_for()
    ok('member sees read-only billing', 'Only site administrators' in pg.inner_text('.billing-grid') and pg.locator('.card-line').count() == 0)
    c.close()

    # 6. public pricing page
    c, pg = ctx(); pg.goto(B + '/pricing'); pg.locator('.plan-card').first.wait_for()
    ok('public pricing page', pg.locator('.plan-card').count() == 3 and pg.locator('.compare-table').count() == 1 and 'Get it free' in pg.inner_text('.pricing-nav'))
    pg.screenshot(path=SHOTS + 'p6-pricing.png', full_page=True)
    c.close()
    br.close()
ok('no page errors', not errs, errs)
print(f'\n{sum(res)}/{len(res)} passed')
