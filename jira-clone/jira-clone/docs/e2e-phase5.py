import json, urllib.request, urllib.parse, time
from playwright.sync_api import sync_playwright
B = 'http://localhost:3000'
SHOTS = 'docs/screenshots'
results = []; errs = []
def ok(name, cond, extra=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if extra else ''), flush=True)
def login(pg, idx):
    pg.goto(B + '/jira/software/projects/KAN/list?jql=project+%3D+KAN+ORDER+BY+cf%5B10019%5D+ASC'); pg.locator('.login-card').wait_for()
    pg.locator('.demo-user').nth(idx).click(); pg.locator('tr.issue-row').first.wait_for(timeout=10000)
def watch(pg, tag):
    pg.on('pageerror', lambda e: errs.append(tag + ' ' + str(e)))
    pg.on('console', lambda m: errs.append(tag + ' console ' + m.text) if m.type == 'error' and '401' not in m.text and '403' not in m.text and '404' not in m.text else None)
def block_sse(ctx):
    ctx.route('**/api/events*', lambda r: r.abort())

with sync_playwright() as p:
    br = p.chromium.launch()
    # ================= admin =================
    A = br.new_context(viewport={'width': 1440, 'height': 900}); block_sse(A); pa = A.new_page(); watch(pa, 'A')
    login(pa, 0)
    ok('admin sees role chip in project header', 'administrator' in pa.inner_text('.access-chip').lower(), pa.inner_text('.access-chip'))
    pa.goto(B + '/jira/software/projects/KAN/settings/access'); pa.locator('.access-levels').wait_for(); pa.wait_for_timeout(500)
    ok('settings page has 9 sections (phase 7 adds Automation + Import)', pa.locator('.settings-nav .side-item').count() == 9, pa.locator('.settings-nav .side-item').count())
    ok('KAN access is Limited', pa.locator('.access-card.on').inner_text().startswith('Limited'))
    ok('people table lists explicit members', pa.locator('.members-table tbody tr').count() >= 6, pa.locator('.members-table tbody tr').count())
    ok('everyone else row shows Viewer', 'viewer' in pa.inner_text('.everyone-row').lower())
    pa.screenshot(path=SHOTS + '/p5-access.png')
    # change Omar to viewer and back
    pa.locator('tr[data-user="u3"] select').select_option('viewer'); pa.wait_for_timeout(700)
    ok('role change toast', 'Omar Saleh is now Viewer' in pa.inner_text('.toasts'))
    pa.locator('tr[data-user="u3"] select').select_option('member'); pa.wait_for_timeout(700)
    # permissions matrix
    pa.locator('.settings-nav .side-item:has-text("Permissions")').click(); pa.locator('.perm-table').wait_for(); pa.wait_for_timeout(300)
    ok('permission matrix has 16 permissions (phase 7 adds worklog perms)', pa.locator('.perm-table tr[data-perm]').count() == 16)
    ok('admin "Administer project" is locked', pa.locator('tr[data-perm="ADMINISTER_PROJECT"] input').first.is_disabled())
    pa.locator('tr[data-perm="DELETE_ISSUES"] input').nth(1).check(); pa.wait_for_timeout(200)
    pa.locator('button:has-text("Save changes")').click(); pa.wait_for_timeout(800)
    ok('scheme saved as customised', pa.locator('.lozenge:has-text("Customised")').count() == 1)
    pa.screenshot(path=SHOTS + '/p5-permissions.png')
    pa.once('dialog', lambda d: d.accept())
    pa.locator('button:has-text("Reset to defaults")').click(); pa.wait_for_timeout(800)
    ok('scheme reset to default', pa.locator('.lozenge:has-text("Default scheme")').count() == 1)
    # components
    pa.locator('.settings-nav .side-item:has-text("Components")').click(); pa.locator('.components-table').wait_for(); pa.wait_for_timeout(300)
    ok('4 KAN components', pa.locator('.components-table tbody tr').count() == 4)
    pa.locator('button:has-text("Create component")').click(); pa.locator('#cm-name').fill('Mobile App'); pa.locator('#cm-def').select_option('component_lead')
    pa.locator('.modal button.primary:has-text("Create")').click(); pa.wait_for_timeout(800)
    ok('component created', pa.locator('tr[data-component="Mobile App"]').count() == 1)
    pa.screenshot(path=SHOTS + '/p5-components.png')
    # board settings: WIP limit
    pa.locator('.settings-nav .side-item:has-text("Board")').click(); pa.locator('.wip-grid').wait_for()
    pa.locator('input[aria-label="WIP limit for In Progress"]').fill('2')
    pa.locator('button:has-text("Save board settings")').click(); pa.wait_for_timeout(800)
    pa.goto(B + '/jira/software/projects/KAN/board'); pa.locator('.board-col').first.wait_for(); pa.wait_for_timeout(1200)
    ok('board shows WIP limit exceeded', pa.locator('.board-col-header.over-limit').count() >= 1, pa.inner_text('.board-col-header >> nth=1'))
    pa.locator('select[aria-label="Swimlanes"]').select_option('assignee'); pa.wait_for_timeout(600)
    ok('swimlanes by assignee', pa.locator('.lane-head').count() >= 3, pa.locator('.lane-head').count())
    pa.screenshot(path=SHOTS + '/p5-board-swimlanes.png')
    pa.locator('select[aria-label="Swimlanes"]').select_option('none'); pa.wait_for_timeout(300)
    # issue modal: components & team, delete -> recycle bin -> undo
    pa.goto(B + '/browse/KAN-6'); pa.locator('.issue-modal').wait_for(); pa.wait_for_timeout(800)
    ok('issue modal has Components and Team fields', pa.locator('.issue-modal .field-label:text-is("Components")').count() == 1 and pa.locator('.issue-modal .field-label:text-is("Team")').count() == 1)
    pa.locator('.issue-modal button[title="More actions"]').click(); pa.locator('.menu-item:has-text("Delete"), .menu button:has-text("Delete")').last.click()
    ok('delete confirm mentions recycle bin', 'recycle bin' in pa.inner_text('.modal >> nth=-1'))
    pa.locator('button:has-text("Move to recycle bin")').click(); pa.wait_for_timeout(900)
    ok('toast: moved to recycle bin', 'KAN-6 moved to the recycle bin' in pa.inner_text('.toasts'))
    pa.locator('.toasts button.link:has-text("Undo")').click(); pa.wait_for_timeout(1000)
    ok('undo restores the item', 'KAN-6 restored' in pa.inner_text('.toasts'))
    # recycle bin page
    pa.goto(B + '/jira/software/projects/KAN/settings/trash'); pa.locator('.trash-table, .empty-state').first.wait_for(); pa.wait_for_timeout(500)
    ok('recycle bin lists the seeded spike', pa.locator('.trash-table tr[data-key="KAN-31"]').count() == 1)
    pa.screenshot(path=SHOTS + '/p5-recycle-bin.png')
    pa.locator('tr[data-key="KAN-31"] button:has-text("Restore")').click(); pa.wait_for_timeout(1200)
    ok('restore opens the restored item', pa.locator('.issue-modal').count() == 1 and 'evaluate PDF' in pa.inner_text('.issue-modal'))
    pa.keyboard.press('Escape'); pa.wait_for_timeout(300)
    # audit
    pa.goto(B + '/jira/software/projects/KAN/settings/audit'); pa.locator('.audit-table').wait_for(); pa.wait_for_timeout(300)
    acts = pa.locator('.audit-table tr[data-action]').evaluate_all('rs => rs.map(r => r.dataset.action)')
    ok('audit log records this session', all(a in acts for a in ['issue.restored', 'issue.deleted', 'permissions.reset', 'permissions.changed', 'component.created', 'member.role_changed']), acts[:12])
    pa.screenshot(path=SHOTS + '/p5-audit.png')
    # teams
    pa.locator('.sidebar .side-item:has-text("Teams")').click(); pa.locator('.team-grid').wait_for(); pa.wait_for_timeout(300)
    ok('teams page shows 3 teams', pa.locator('.team-card').count() == 3)
    pa.locator('button:has-text("Create team")').click(); pa.locator('#tm-name').fill('Risk & Compliance')
    pa.locator('.member-checklist label:has-text("Mona Farouk") input').check()
    pa.locator('.modal button.primary:has-text("Create team")').click(); pa.wait_for_timeout(800)
    ok('team created', pa.locator('.team-card[data-team="Risk & Compliance"]').count() == 1)
    pa.screenshot(path=SHOTS + '/p5-teams.png')
    pa.locator('.team-card[data-team="Payments Squad"] button.link').click(); pa.wait_for_timeout(1500)
    ok('team link opens list with team JQL', 'team' in pa.url and pa.locator('tr.issue-row').count() >= 5, pa.locator('tr.issue-row').count())
    # people tabs
    pa.goto(B + '/jira/people'); pa.locator('.page-tabs').wait_for()
    pa.locator('.page-tabs .tab:has-text("Global permissions")').click(); pa.locator('.global-perm-table').wait_for()
    ok('global permissions tab', pa.locator('.global-perm-table tr[data-perm]').count() == 4)
    pa.screenshot(path=SHOTS + '/p5-global-permissions.png')
    pa.locator('.page-tabs .tab:has-text("Audit log")').click(); pa.locator('.audit-table').wait_for(); pa.wait_for_timeout(300)
    ok('site audit includes user.invited', pa.locator('.audit-table tr[data-action="user.invited"]').count() >= 1)

    # ================= viewer (Khalid) =================
    K = br.new_context(viewport={'width': 1440, 'height': 900}); block_sse(K); pk = K.new_page(); watch(pk, 'K')
    login(pk, 3)
    ok('viewer: role chip says Viewer', 'viewer' in pk.inner_text('.access-chip').lower())
    ok('viewer: Create button disabled', pk.locator('.create-btn').is_disabled())
    ok('viewer: no inline create row in list', pk.locator('.create-trigger').count() == 0)
    ok('viewer: no drag handles', pk.locator('.drag-handle').count() == 0)
    pk.goto(B + '/browse/KAN-2'); pk.locator('.issue-modal').wait_for(); pk.wait_for_timeout(700)
    ok('viewer: read-only banner in issue', pk.locator('.readonly-banner').count() == 1 and 'view and comment' in pk.inner_text('.readonly-banner'))
    ok('viewer: summary not editable', pk.locator('.issue-summary.readonly').count() == 1)
    ok('viewer: can still comment', pk.locator('#comment-box, .comment-box textarea, .comment-input').count() >= 1)
    pk.screenshot(path=SHOTS + '/p5-viewer-issue.png')
    pk.keyboard.press('Escape')
    pk.goto(B + '/jira/software/projects/KAN/board'); pk.locator('.board-col').first.wait_for(); pk.wait_for_timeout(800)
    ok('viewer: board read-only', pk.locator('.readonly-chip').count() == 1 and pk.locator('.card[draggable="true"]').count() == 0)
    pk.goto(B + '/jira/software/projects/KAN/settings/permissions'); pk.locator('.perm-table').wait_for(); pk.wait_for_timeout(300)
    ok('viewer: permissions read-only', pk.locator('.notice-inline:has-text("Administrator role")').count() == 1 and pk.locator('.perm-table input:not([disabled])').count() == 0)
    ok('viewer: sees own role banner', 'Viewer' in pk.inner_text('.my-role-banner'))
    pk.goto(B + '/jira/software/projects/KAN/releases'); pk.wait_for_timeout(1200)
    ok('viewer: releases view only', pk.locator('.readonly-chip:has-text("View only")').count() == 1)
    r = pk.evaluate("fetch('/api/issues/KAN-2', {method:'PATCH', headers:{'Content-Type':'application/json', Authorization:'Bearer '+(sessionStorage.getItem('jc.token')||localStorage.getItem('jc.token'))}, body: JSON.stringify({summary:'x'})}).then(r => r.status)")
    ok('viewer: API PATCH is 403', r == 403, r)

    # ================= non-member of a private project (Sara) =================
    S = br.new_context(viewport={'width': 1440, 'height': 900}); block_sse(S); ps = S.new_page(); watch(ps, 'S')
    login(ps, 1)
    ok('sara: FIN hidden from sidebar', ps.locator('.sidebar .side-item:has-text("Finance Close")').count() == 0)
    ps.goto(B + '/jira/software/projects/FIN/list'); ps.wait_for_timeout(2000)
    ok('sara: private project denied with toast', 'have access to FIN' in ps.inner_text('.toasts') and '/projects/FIN/' not in ps.url, (ps.url, ps.inner_text('.toasts')[:120]))
    ps.screenshot(path=SHOTS + '/p5-denied.png')
    # admin adds Sara to FIN as Viewer via UI
    pa.goto(B + '/jira/software/projects/FIN/settings/access'); pa.locator('.members-table').wait_for(); pa.wait_for_timeout(400)
    ok('FIN is private', pa.locator('.access-card.on').inner_text().startswith('Private'))
    pa.locator('button:has-text("Add people")').click(); pa.locator('#ap-user').select_option('u2'); pa.locator('#ap-role').select_option('viewer')
    pa.locator('.modal button.primary:has-text("Add")').click(); pa.wait_for_timeout(800)
    ok('sara added to FIN', pa.locator('tr[data-user="u2"]').count() == 1)
    ps.goto(B + '/jira/software/projects/FIN/list'); ps.locator('tr.issue-row').first.wait_for(timeout=8000); ps.wait_for_timeout(500)
    ok('sara can now browse FIN as viewer', ps.locator('tr.issue-row').count() == 6 and 'viewer' in ps.inner_text('.access-chip').lower())
    pa.locator('tr[data-user="u2"] button[aria-label^="Remove"]').click(); pa.wait_for_timeout(600)
    ok('sara removed again', pa.locator('tr[data-user="u2"]').count() == 0)

    br.close()

print('\nerrors:', errs[:10])
print(f'{sum(results)}/{len(results)} passed')
