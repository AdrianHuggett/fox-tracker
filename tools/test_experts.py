"""Black-box checks for Justus using a local isolated API, never live data."""
import os
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'tools' / 'out'
OUT.mkdir(exist_ok=True)
FIXTURE = OUT / 'experts-harness.html'
FIXTURE.write_text(f'<base href="{ROOT.as_uri()}/"><section id="p-experts" class="panel on" style="padding:20px"></section>', encoding='utf-8')


def run(p, width):
    executable = os.environ.get('FOX_TEST_BROWSER')
    browser = p.chromium.launch(**({'executable_path': executable} if executable else {}))
    pg = browser.new_page(viewport={'width': width, 'height': 900})
    pg.set_default_timeout(10000)
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('https://**/*', lambda r: r.fulfill(body='', status=200))
    pg.goto(FIXTURE.as_uri())
    pg.add_style_tag(path=str(ROOT / 'style.css'))
    pg.add_style_tag(path=str(ROOT / 'experts.css'))
    pg.add_script_tag(path=str(ROOT / 'experts-data.js'))
    pg.add_script_tag(path=str(ROOT / 'experts.js'))
    pg.evaluate("""() => {
      window.testStock = {'Justus Sigils':{have:13,target:7},
        'General Expert Sigils':{have:5,target:9},'Books of Knowledge':{have:90,target:100}};
      window.savedPlan=null; window.appliedTargets=null;
      window.FOXExperts.mount(document.getElementById('p-experts'), {
        plan:{view:'edit',experts:{cyrille:{from:10,to:10,skills:{entrapment:{from:2,to:2}}}}},
        stock:()=>window.testStock,
        savePlan:async plan=>{window.savedPlan=structuredClone(plan)},
        applyTargets:async targets=>{window.appliedTargets=structuredClone(targets)}
      });
    }""")
    pg.get_by_role('tab', name='Gen 3', exact=True).click()
    pg.locator('[data-open="justus"] summary').click()
    rel = pg.get_by_label('Justus relationship target level', exact=True)
    skill = lambda name: pg.get_by_label(name + ' target level', exact=True)
    options = lambda name: skill(name).locator('option').all_text_contents()
    rel.select_option('9.5')
    assert options('Glorious Gains') == ['0']
    rel.select_option('10')
    assert options('Glorious Gains') == ['0', '1', '2']
    assert '8 sigils' in pg.locator('[data-open="justus"] summary').inner_text()
    rel.select_option('20')
    assert options('Treasure Seeker') == ['0', '1', '2']
    rel.select_option('100')
    assert options('Master Diplomat')[-1] == '2'
    assert options('Fortune Wayfarer')[-1] == '4'
    skill('Glorious Gains').select_option('5')
    skill('Treasure Seeker').select_option('5')
    skill('Master Diplomat').select_option('5')
    skill('Fortune Wayfarer').select_option('10')
    assert '513,070' in pg.locator('.ex-summary').inner_text()
    assert '113d 15h 10m' in pg.locator('.ex-summary').inner_text()
    assert '7,050,000' in pg.locator('.ex-points').inner_text()
    assert pg.locator('img[src="item-justus-sigils-v2.png"]').evaluate('(img) => img.complete && img.naturalWidth > 0')
    skill('Treasure Seeker').select_option('0')
    assert skill('Fortune Wayfarer').input_value() == '4'
    skill('Treasure Seeker').select_option('5')
    skill('Fortune Wayfarer').select_option('10')
    assert pg.evaluate('window.savedPlan') is None
    assert pg.evaluate('window.appliedTargets') is None
    pg.locator('#ex-save').click()
    pg.get_by_text('Plan saved to your account.', exact=True).wait_for()
    saved = pg.evaluate('window.savedPlan')
    assert saved['experts']['cyrille']['from'] == 10
    assert saved['experts']['cyrille']['skills']['entrapment'] == {'from': 2, 'to': 2}
    assert saved['experts']['justus']['skills']['fortune-wayfarer']['to'] == 10
    pg.locator('#ex-push').click()
    assert pg.evaluate('window.appliedTargets') is None
    pg.locator('#ex-apply').click()
    pg.get_by_text('Backpack targets updated.', exact=True).wait_for()
    targets = {x['name']: x['target'] for x in pg.evaluate('window.appliedTargets')}
    assert targets == {'Books of Knowledge': 73500, 'Justus Sigils': 440, 'General Expert Sigils': 427}
    assert pg.evaluate('window.testStock["Justus Sigils"].have') == 13
    assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth')
    columns = pg.locator('.ex-layout').evaluate('(e) => getComputedStyle(e).gridTemplateColumns.split(" ").length')
    assert columns == (2 if width == 1150 else 1), 'Verify the actual responsive planner styles are active'
    assert not errors, errors
    pg.screenshot(path=str(OUT / f'experts-justus-{width}.png'), full_page=True)
    browser.close()
    print(f'PASS {width}px: exact costs, skill gates, save preservation, confirmed targets, no overflow')


with sync_playwright() as p:
    for width in (1150, 400):
        run(p, width)
