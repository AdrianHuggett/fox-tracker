"""Chief Gear rank rendering and current/target plan preservation, on local data only."""
import os
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'tools' / 'out'
OUT.mkdir(exist_ok=True)
FIXTURE = OUT / 'gear-icons-harness.html'
FIXTURE.write_text(f'<base href="{ROOT.as_uri()}/"><section id="p-gear" style="padding:20px"></section>', encoding='utf-8')


def run(p, width):
    executable = os.environ.get('FOX_TEST_BROWSER')
    browser = p.chromium.launch(**({'executable_path': executable} if executable else {}))
    pg = browser.new_page(viewport={'width': width, 'height': 950})
    pg.set_default_timeout(10000)
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(FIXTURE.as_uri())
    for css in ['style.css', 'chief-gear.css', 'chief-gear-icons.css']:
        pg.add_style_tag(path=str(ROOT / css))
    for script in ['chief-gear-data.js', 'chief-gear-icons.js', 'chief-gear.js']:
        pg.add_script_tag(path=str(ROOT / script))
    pg.evaluate("""() => {
      window.seedPlan={version:FOX_GEAR_DATA.version,view:'saved',rows:[
        {id:'jacket',from:'green-1',to:'blue-3'},
        {id:'pants',from:'purple-t1-2',to:'gold-t1-2'},
        {id:'helmet',from:'gold-t1-3',to:'pink-t1-1'},
        {id:'watch',from:'gold-t1-0',to:'pink-t3-3-s4'},
        {id:'ring',from:'pink-1-s1',to:'pink-t4-1-s1'},
        {id:'cane',from:'none',to:'pink-0-s1'}]};
      for(const r of seedPlan.rows)for(const k of ['from','to'])if(!FOX_GEAR_DATA.stages.some(s=>s.id===r[k]))throw Error('Missing fixture stage '+r[k]);
      window.saves=[];window.applied=[];
      FOXGear.mount(document.getElementById('p-gear'),{
        plan:seedPlan,stock:()=>Object.fromEntries(['hardenedAlloy','polishingSolution','designPlans','lunarAmber'].map(k=>[k,{have:100,target:200}])),
        savePlan:async plan=>saves.push(structuredClone(plan)),applyTargets:async changes=>applied.push(changes)
      });
    }""")
    assert pg.locator('.gear-row .cg-icon').count() == 12
    watch = pg.locator('.gear-row').nth(3)
    assert watch.locator('.gear-rowtop .cg-icon-tier').inner_text() == 'T1'
    assert watch.locator('.gear-rowtop .cg-icon-stars').count() == 0
    assert watch.locator('.gear-destination .cg-icon-tier').inner_text() == 'T3'
    assert watch.locator('.gear-destination .cg-icon-stars > span').count() == 3
    assert watch.locator('.gear-destination .cg-icon-step').inner_text() == '4/5'
    assert pg.locator('.gear-row').nth(4).locator('.gear-destination .cg-icon-step').inner_text() == '1/5'
    assert pg.locator('.cg-icon img').evaluate_all('(imgs) => imgs.every(i=>i.complete && i.naturalWidth>0)')
    assert pg.evaluate('saves.length') == 0
    assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth')
    pg.screenshot(path=str(OUT / f'gear-icons-saved-{width}.png'), full_page=True)
    pg.locator('#cg-edit').click()
    pg.wait_for_function('saves.length === 1')
    assert pg.evaluate('JSON.stringify(saves[0].rows) === JSON.stringify(seedPlan.rows)')
    assert pg.locator('.gear-target-choice .cg-icon').count() == 6
    pg.locator('select[data-piece="0"][data-field="to"]').select_option(label='Red T4 2★ · stage 3/5')
    assert pg.locator('.gear-row').first.locator('.gear-target-choice .cg-icon-tier').inner_text() == 'T4'
    assert pg.locator('.gear-row').first.locator('.gear-target-choice .cg-icon-stars > span').count() == 2
    assert pg.locator('.gear-row').first.locator('.gear-target-choice .cg-icon-step').inner_text() == '3/5'
    assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert pg.evaluate('applied.length') == 0
    assert not errors, errors
    pg.screenshot(path=str(OUT / f'gear-icons-edit-{width}.png'), full_page=True)
    browser.close()
    print(f'PASS {width}px: current/target icons, stars, T ranks, 4/5-part stages, saved IDs, no overflow')


with sync_playwright() as p:
    for width in (1150, 400):
        run(p, width)
