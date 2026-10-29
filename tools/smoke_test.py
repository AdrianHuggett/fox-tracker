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
TABS = ['dash', 'stock', 'packs', 'matrix', 'ref', 'r4', 'admin', 'foundry', 'canyon', 'layout', 'foxnews']
CATEGORIES = {'dash':'prep', 'stock':'prep', 'packs':'prep', 'matrix':'resources', 'ref':'resources', 'r4':'alliance', 'admin':'alliance', 'foundry':'alliance', 'canyon':'alliance', 'layout':'alliance'}
CATEGORIES['foxnews'] = 'foxnews'

def open_tab(pg, tab):
    pg.click(f'#category-nav button[data-category="{CATEGORIES[tab]}"]')
    if tab != 'foxnews':
        button = pg.locator(f'#category-sub button[data-page="{tab}"]')
        if button.count() == 0:
            return False
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
