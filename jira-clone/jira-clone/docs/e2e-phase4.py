import json, urllib.request, time, re
from playwright.sync_api import sync_playwright
B='http://localhost:3000'
results=[]; errs=[]
def ok(name, cond, extra=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ')+name+(' '+str(extra) if extra else ''), flush=True)
def login(pg, idx=0):
    pg.goto(B+'/jira/software/projects/KAN/list?jql=project+%3D+KAN+ORDER+BY+cf%5B10019%5D+ASC'); pg.locator('.login-card').wait_for()
    pg.locator('.demo-user').nth(idx).click(); pg.locator('tbody tr').first.wait_for(timeout=10000)
with sync_playwright() as p:
    br=p.chromium.launch()
    A=br.new_context(viewport={'width':1440,'height':900}); pa=A.new_page()
    pa.on('pageerror', lambda e: errs.append('A '+str(e)))
    pa.on('console', lambda m: errs.append('A console '+m.text) if m.type=='error' and '401' not in m.text else None)
    login(pa, 0)
    ok('legacy KAN list URL still works', pa.locator('tbody tr').count()>=20 and '/projects/KAN/list' in pa.url)
    # ---- projects directory ----
    pa.locator('.side-item:has-text("View all projects")').click(); pa.locator('.projects-table').wait_for(); pa.wait_for_timeout(500)
    ok('projects page lists 3 projects', pa.locator('.projects-table tbody tr').count()==3, pa.locator('.projects-table tbody tr').count())
    pa.screenshot(path='/tmp/e2e/p4-projects.png')
    pa.locator('.page-head button:has-text("Create project")').click()
    pa.locator('#pname').fill('Operations Hub')
    ok('key suggested from name', pa.locator('#pkey').input_value()=='OH', pa.locator('#pkey').input_value())
    pa.locator('#pkey').fill('OPS')
    pa.screenshot(path='/tmp/e2e/p4-create-project.png')
    pa.locator('.modal button:has-text("Create project")').click(); pa.wait_for_timeout(1800)
    ok('new project opens on its backlog', '/projects/OPS/backlog' in pa.url and pa.locator('.backlog-section').count()>=1, pa.url)
    ok('sidebar shows new project', pa.locator('.sidebar .side-item:has-text("Operations Hub")').count()==1)
    # create issue in OPS
    pa.keyboard.press('c'); pa.locator('.create-modal').wait_for()
    ok('create modal defaults to current project', pa.locator('.create-modal select[aria-label="Space"]').input_value()=='OPS')
    pa.locator('.create-modal input.text-input').first.fill('Set up on-call rota')
    pa.locator('.create-modal button.primary:has-text("Create")').click(); pa.wait_for_timeout(1200)
    ok('issue created with OPS key', 'OPS-1' in pa.inner_text('body'))
    # ---- switch to FIN (business) ----
    pa.locator('.sidebar .side-item:has-text("Finance Close")').click(); pa.wait_for_timeout(1500)
    tabs=[t.strip() for t in pa.locator('.tabs .tab').all_inner_texts()]
    ok('business project hides Backlog/Releases/Reports', 'Backlog' not in tabs and 'Releases' not in tabs and 'List' in tabs, tabs)
    pa.locator('.tabs .tab:has-text("Board")').click(); pa.wait_for_timeout(1000)
    ok('business board has no sprint bar', pa.locator('.sprint-bar').count()==0 and pa.locator('.board-card, .card').count()>=1)
    pa.locator('.tabs .tab:has-text("List")').click(); pa.wait_for_timeout(1000)
    ok('FIN list shows FIN items only', pa.locator('tbody tr.issue-row').count()==6 and 'FIN-1' in pa.inner_text('tbody'), pa.locator('tbody tr').count())
    # ---- KAN releases ----
    pa.goto(B+'/jira/software/projects/KAN/releases'); pa.locator('.releases-table').wait_for(); pa.wait_for_timeout(600)
    ok('releases: 2 unreleased versions', pa.locator('.releases-table tbody tr').count()==2)
    pa.locator('.releases-table .link-strong:has-text("1.3.0")').click(); pa.wait_for_timeout(800)
    ok('release detail lists work items', pa.locator('.vd-issues li').count()>=10, pa.locator('.vd-issues li').count())
    pa.screenshot(path='/tmp/e2e/p4-releases.png')
    pa.locator('.version-detail button:has-text("Release 1.3.0")').click(); pa.wait_for_timeout(400)
    ok('release modal warns about unresolved work', 'unresolved' in pa.inner_text('.modal'))
    pa.locator('.modal button.primary:has-text("Release")').click(); pa.wait_for_timeout(1200)
    pa.locator('.segmented button:text-is("Released")').click(); pa.wait_for_timeout(400)
    ok('1.3.0 now released', pa.locator('.releases-table tbody tr:has-text("1.3.0")').count()==1)
    r=json.loads(urllib.request.urlopen(urllib.request.Request(B+'/api/search?jql='+urllib.parse.quote('project = KAN AND fixVersion = "1.4.0" AND status != Done')+'&maxResults=1', headers={'Authorization':'Bearer '+pa.evaluate("localStorage.getItem('jc.token')")})).read())
    ok('unresolved work moved to 1.4.0', r['total']>=10, r['total'])
    # ---- fix version in issue panel ----
    pa.goto(B+'/browse/KAN-2'); pa.locator('.issue-modal').wait_for(); pa.wait_for_timeout(600)
    pa.locator('.issue-modal details:has-text("Fix versions") summary').first.evaluate("e => e.parentElement.open = true")
    ok('issue panel shows Fix versions field', pa.locator('.issue-modal :text("Fix versions")').count()>=1)
    pa.keyboard.press('Escape')
    # ---- reports ----
    pa.goto(B+'/jira/software/projects/KAN/reports'); pa.wait_for_timeout(1200)
    ok('velocity chart bars', pa.locator('.report-chart rect').count()>=6, pa.locator('.report-chart rect').count())
    pa.screenshot(path='/tmp/e2e/p4-velocity.png')
    pa.locator('.report-link:has-text("Sprint report")').click(); pa.wait_for_timeout(1200)
    ok('sprint report burndown + tables', pa.locator('.report-chart path').count()>=1 and pa.locator('.report-card').count()>=2)
    pa.screenshot(path='/tmp/e2e/p4-sprint.png', full_page=True)
    pa.locator('.report-link:has-text("Cumulative flow")').click(); pa.wait_for_timeout(1200)
    ok('CFD has 4 status bands', pa.locator('.report-chart path').count()==4, pa.locator('.report-chart path').count())
    pa.screenshot(path='/tmp/e2e/p4-cfd.png')
    # ---- live updates between two users ----
    Bc=br.new_context(viewport={'width':1440,'height':900}); pb=Bc.new_page()
    pb.on('pageerror', lambda e: errs.append('B '+str(e)))
    login(pb, 1)  # Sara
    pa.goto(B+'/jira/software/projects/KAN/list'); pa.locator('tbody tr').first.wait_for(); pa.wait_for_timeout(1500)
    ok('presence: Ahmed sees Sara online', pa.locator('.presence').count()==1, pa.locator('.presence').count())
    n0=pa.locator('tbody tr').count()
    pb.keyboard.press('c'); pb.locator('.create-modal').wait_for()
    pb.locator('.create-modal input.text-input').first.fill('Live update from Sara')
    pb.locator('.create-modal button.primary:has-text("Create")').click()
    try:
        pa.locator('tbody tr:has-text("Live update from Sara")').wait_for(timeout=6000); live=True
    except Exception: live=False
    ok('live: Ahmed’s list shows Sara’s new item without reload', live, (n0, pa.locator('tbody tr').count()))
    pa.screenshot(path='/tmp/e2e/p4-live.png')
    Bc.close()
    # ---- API tokens ----
    pa.locator('.topnav .avatar-btn, .top-nav .avatar-btn').last.click(); pa.wait_for_timeout(300)
    pa.locator('.menu-item:has-text("Profile")').first.click(); pa.wait_for_timeout(800)
    pa.locator('input[aria-label="Token name"]').fill('E2E script'); pa.locator('button:has-text("Create token")').click(); pa.wait_for_timeout(800)
    tok=pa.locator('.token-value code').inner_text()
    pa.screenshot(path='/tmp/e2e/p4-tokens.png')
    me=json.loads(urllib.request.urlopen(urllib.request.Request(B+'/api/auth/me', headers={'Authorization':'Bearer '+tok})).read())
    ok('API token works for REST calls', me['user']['email']=='ahmed@ahdfinancial.com')
    pa.locator('.session-row:has-text("E2E script") button:has-text("Revoke")').click(); pa.wait_for_timeout(600)
    try: urllib.request.urlopen(urllib.request.Request(B+'/api/auth/me', headers={'Authorization':'Bearer '+tok})); revoked=False
    except urllib.error.HTTPError as e: revoked = e.code==401
    ok('revoked token is rejected', revoked)
    pa.keyboard.press('Escape')
    # ---- API docs ----
    d=A.new_page(); d.goto(B+'/api/docs')
    ok('API docs page renders', d.locator('details.ep').count()>=50, d.locator('details.ep').count())
    d.screenshot(path='/tmp/e2e/p4-docs.png'); d.close()
    # ---- delete project (admin) ----
    pa.goto(B+'/jira/projects'); pa.locator('.projects-table').wait_for(); pa.wait_for_timeout(400)
    pa.locator('.projects-table tr:has-text("Operations Hub") button[aria-label^="Actions"]').click()
    pa.locator('.menu-item:has-text("Delete project")').click()
    pa.locator('#confirm-key').fill('OPS'); pa.locator('.modal button:has-text("Delete project")').click(); pa.wait_for_timeout(1200)
    ok('project deleted', pa.locator('.projects-table tbody tr').count()==3)
    br.close()
print('errors:', errs[:6])
print(sum(results),'/',len(results))
