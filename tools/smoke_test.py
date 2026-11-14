"""Smoke test for the FOX Prep Tracker.

Opens index.html from the repo with a fake Supabase (tools/mock-supabase.js), visits
every tab at desktop and phone width, saves screenshots to tools/out/, and exits
non-zero if the page throws. Extend the checks below as features change.

    pip install playwright && python -m playwright install chromium
    python tools/smoke_test.py
"""
import os, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
MOCK = (ROOT / 'tools' / 'mock-supabase.js').read_text(encoding='utf-8')
OUT = ROOT / 'tools' / 'out'
OUT.mkdir(exist_ok=True)
TABS = ['dash', 'stock', 'packs', 'experts', 'gear', 'matrix', 'ref', 'r4', 'admin', 'foundry', 'canyon', 'layout', 'foxnews']
CATEGORIES = {'dash':'prep', 'stock':'prep', 'packs':'prep', 'matrix':'resources', 'ref':'resources', 'r4':'alliance', 'admin':'alliance', 'foundry':'alliance', 'canyon':'alliance', 'layout':'alliance'}
CATEGORIES['foxnews'] = 'foxnews'
CATEGORIES['experts'] = 'planner'
CATEGORIES['gear'] = 'planner'
CATEGORIES['widgets'] = 'planner'

def open_tab(pg, tab):
    pg.click(f'#category-nav button[data-category="{CATEGORIES[tab]}"]')
    if tab != 'foxnews':
        button = pg.locator(f'#category-sub button[data-page="{tab}"]')
        if button.count() == 0:
            return False
        if not button.is_visible() and CATEGORIES[tab] == 'planner':
            pg.locator(f'#p-planner button[data-go="{tab}"]').click()
            return True
        button.click()
    return True


def route(r):
    u = r.request.url
    if 'supabase-js' in u:
        return r.fulfill(body=MOCK, content_type='application/javascript')
    if u.startswith('file://'):
        return r.continue_()
    return r.fulfill(body='', status=200)  # fonts, CDNs: not needed offline


def run(p, width, name):
    executable = os.environ.get('FOX_TEST_BROWSER')
    b = p.chromium.launch(**({'executable_path': executable} if executable else {}))
    pg = b.new_page(viewport={'width': width, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/*', route)
    pg.goto((ROOT / 'index.html').as_uri())
    pg.wait_for_timeout(1500)
    pg.evaluate("var n=document.querySelector('#news'); if(n) n.remove()")
    for t in TABS:
        if not open_tab(pg, t):
            print(f'[{name}] tab {t}: not visible (ok if not admin)')
            continue
        pg.wait_for_timeout(400)
        pg.screenshot(path=str(OUT / f'{name}-{t}.png'), full_page=True)

    # Feature checks: keep these in sync with docs/03-features.md
    open_tab(pg, 'stock'); pg.wait_for_timeout(300)
    expert_rows = pg.locator('#stock tr[data-gn$="Expert Materials"]:not(.xch)')
    assert expert_rows.locator('td.nm').all_text_contents() == [
        'Kathy Sigils', 'Gareth Sigils', 'Justus Sigils', 'Books of Knowledge'
    ], 'Keep Justus with sigils and Books of Knowledge last'
    for expert in ['Gareth', 'Justus']:
        art = pg.locator(f'#stock tr[data-q="{expert.lower()} sigils"] img.item-art')
        assert art.get_attribute('src') == ('item-justus-sigils-v2.png' if expert == 'Justus' else 'item-gareth-sigils.png')
        assert art.evaluate('(img) => img.complete && img.naturalWidth > 0'), f'{expert} artwork did not load'
    free = pg.locator('#stock tr[data-q="design plans"] td').nth(6)
    assert free.text_content().strip() == '3.33', 'Bought reset must not inflate free income'
    detail = free.locator('span').get_attribute('title')
    assert '3 days' in detail and '2026-10-01 to 2026-10-04' in detail, detail
    proj = pg.eval_on_selector_all(
        '#stock tbody tr:not(.grp):not(.xch)',
        'rs=>Object.fromEntries(rs.map(r=>[r.children[1].innerText.trim(), r.children[7].innerText.trim()]))')
    print(f'[{name}] projected:', proj)
    open_tab(pg, 'r4'); pg.wait_for_timeout(400)
    print(f'[{name}] r4 workload:', pg.inner_text('#r4-load').replace('\n', ' | ') if pg.query_selector('#r4-load') else 'missing')
    # Gen 6 is available to existing widget plans, with the same cost and stock rules.
    for hero in ('Wu Ming', 'Renee', 'Wayne'):
        assert pg.locator(f'#stock tr[data-q="{hero.lower()}"]').count() == 1
    widget_icons = pg.locator('#stock tr[data-q*="widget gen"] img.item-art')
    assert widget_icons.count() == 19
    widget_icons.evaluate_all('(images) => Promise.all(images.map(img => img.decode()))')
    assert widget_icons.evaluate_all('(images) => images.every(img => img.naturalWidth > 0)')
    assert open_tab(pg, 'widgets')
    pg.locator('#p-widgets [data-gen="6"]').click()
    assert pg.locator('#p-widgets .widget-person strong').all_text_contents() == ['Wu Ming', 'Renee', 'Wayne']
    assert pg.locator('#p-widgets .widget-person img').evaluate_all('(images) => images.every(img => img.getAttribute("src").startsWith("widget-art/"))')
    pg.locator('#p-widgets select[data-hero="Renee"][data-field="from"]').select_option('3')
    pg.locator('#p-widgets select[data-hero="Renee"][data-field="to"]').select_option('4')
    assert pg.locator('#p-widgets .widget-total strong').inner_text() == '20'
    result = pg.evaluate("""() => {
        const plan = FOXWidgets.normalize({view:'saved',rows:{Mia:{from:4,to:5},Renee:{from:3,to:4}}});
        const totals = FOXWidgets.calculate(plan, {'Mia widget':{have:0},'Renee widget':{have:5}});
        return {mia:plan.rows.Mia,wayne:plan.rows.Wayne,count:Object.keys(plan.rows).length,
            total:totals.total,points:totals.points,renee:totals.rows.Renee.short};
    }""")
    assert result == {'mia':{'from':4,'to':5},'wayne':{'from':0,'to':0},'count':19,
                      'total':45,'points':360000,'renee':15}, result

    # Foundry roster changes also update markers in earlier phases.
    assert open_tab(pg, 'foundry'), 'Foundry tab unavailable to mock admin'
    ff = pg.frame_locator('#p-foundry iframe')
    ff.locator('[data-legion="2"]').click()
    team_a = ff.locator('[data-addteam="A"]')
    team_a.locator('input').fill('Captain')
    team_a.get_by_role('button', name='Add', exact=True).click()
    captain = ff.locator('[data-player="Captain"]')
    move_team = ff.get_by_role('combobox', name='Move Captain to another team')
    for phase in (1, 2):
        ff.locator(f'[data-phase="{phase}"]').click()
        captain.click()
        assert move_team.is_visible()
        ff.locator('#map').click(position={'x': 40, 'y': 80})
    captain.click()
    move_team.select_option('D')
    assert captain.get_attribute('data-team') == 'D'
    ff.locator('#undo').click()
    assert captain.get_attribute('data-team') == 'A' and not move_team.is_visible()
    captain.click()
    move_team.select_option('D')
    captain.click()
    assert captain.get_attribute('data-role') == 'rally' and not move_team.is_visible()
    captain.click()
    assert captain.get_attribute('data-role') == 'loot'
    captain.click()
    assert captain.get_attribute('data-role') == 'member' and not move_team.is_visible()
    captain.click()
    assert move_team.is_visible() and captain.get_attribute('data-role') == 'member'
    foundry = next(f for f in pg.frames if 'foundry.html' in f.url)
    markers = foundry.evaluate("""() =>
        JSON.parse(localStorage.getItem('fox-foundry-war-room-v4-L2')).items
            .filter(m => m.label === 'Captain').map(m => [m.phase, m.color, m.kind])
    """)
    assert markers == [[1, 'D', 'team'], [2, 'D', 'team']], markers
    foundry.goto(foundry.url)
    assert captain.get_attribute('data-team') == 'D' and captain.get_attribute('data-role') == 'member'

    # Layout planner: the iframe loads, Generate seats players, and the layout is saved under the account's own key
    open_tab(pg, 'layout'); pg.wait_for_timeout(800)
    lf = pg.frame_locator('#p-layout iframe')
    lf.locator('#genBtn').click(); pg.wait_for_timeout(1500)
    gen = lf.locator('#genMsg').text_content()
    assert 'players' in gen and 'failed' not in gen, gen
    keys = next(f for f in pg.frames if 'layout.html' in f.url).evaluate("Object.keys(localStorage).filter(k=>k.indexOf('fox-layout-v1')===0)")
    assert keys and all(k.startswith('fox-layout-v1-') for k in keys), keys
    print(f'[{name}] layout:', gen[:120], keys)
    # Canyon planner (R4/admin): the map loads with all 94 buildings and a tap cycles the owner
    if open_tab(pg, 'canyon'):
        pg.wait_for_timeout(1000)
        cf = pg.frame_locator('#p-canyon iframe')
        n = cf.locator('#blds .bld').count()
        assert n == 94, n
        cfr = next(f for f in pg.frames if 'canyon.html' in f.url)
        cfr.evaluate("""() => { const t = document.querySelector('#blds .bld[data-b="F10"] text'), r = t.getBoundingClientRect(), o = { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1 };
            t.dispatchEvent(new PointerEvent('pointerdown', o)); t.dispatchEvent(new PointerEvent('pointerup', o)); }"""); pg.wait_for_timeout(300)
        print(f'[{name}] canyon:', n, 'buildings |', cf.locator('#binfo .bname').text_content())

    b.close()
    return errs


with sync_playwright() as p:
    bad = False
    for width, name in ((1150, 'desktop'), (400, 'phone')):
        errs = run(p, width, name)
        if errs:
            bad = True
            print(f'[{name}] PAGE ERRORS:', *errs, sep='\n  ')
    print('screenshots in', OUT)
    sys.exit(1 if bad else 0)
