"""Verify Hero Gear previews through the planner, with isolated saved-plan fixtures."""
import os
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'tools' / 'out'
OUT.mkdir(exist_ok=True)
FIXTURE = OUT / 'hero-gear-icons-harness.html'
FIXTURE.write_text(f'<base href="{ROOT.as_uri()}/"><section id="p-hero" style="padding:16px"></section>', encoding='utf-8')

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('FOX_TEST_BROWSER'))
    for width in (1150, 400):
        page = browser.new_page(viewport={'width': width, 'height': 950})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(FIXTURE.as_uri())
        for css in ('style.css', 'hero-gear.css'):
            page.add_style_tag(path=str(ROOT / css))
        for script in ('hero-gear-data.js', 'hero-gear.js'):
            page.add_script_tag(path=str(ROOT / script))
        page.evaluate("""() => {
            window.savedPlan = null;
            FOXHero.mount(document.querySelector('#p-hero'), {
                plan: {rows: {'infantry:goggles': {ef:118,et:120,ff:30,ft:30}}},
                stock: () => ({}),
                savePlan: async plan => { window.savedPlan = structuredClone(plan); },
                applyTargets: async () => { throw new Error('Unexpected stock change'); }
            });
        }""")
        piece = page.locator('.hg-piece').first
        icons = piece.locator('.hg-gear-icon')
        assert icons.nth(0).get_attribute('aria-label') == 'Current: Infantry Goggles, Ascended +18, Mastery 10'
        assert icons.nth(1).get_attribute('aria-label') == 'Target: Infantry Goggles, Ascended +20, Mastery 11'
        assert piece.locator('.hg-ascended').count() == 2
        page.locator('#hg-auto').uncheck()
        assert 'Mastery 10' in icons.nth(1).get_attribute('aria-label')
        page.locator('#hg-auto').check()
        piece.locator('[data-field="ef"]').select_option('100')
        assert piece.locator('.hg-mythic').count() == 1
        piece.locator('[data-field="ef"]').select_option('101')
        assert piece.locator('.hg-ascended').count() == 2
        assert icons.nth(0).locator('.hg-gear-enhancement').inner_text() == '+1'
        piece.locator('[data-field="ef"]').select_option('118')
        for troop in ('lancer', 'marksman', 'infantry'):
            page.locator(f'[data-set="{troop}"]').click()
            for index, slot in enumerate(('goggles', 'gloves', 'belt', 'boots')):
                art = page.locator('.hg-piece').nth(index).locator('.hg-gear-art').first
                assert art.get_attribute('src') == f'hero-gear-art/{troop}-{slot}.webp'
                art.evaluate('(img) => img.decode()')
                assert art.evaluate('(img) => img.naturalWidth > 0')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUT / f'hero-gear-icons-{width}.png'), full_page=True)
        page.locator('#hg-save').click()
        page.wait_for_function('window.savedPlan !== null')
        assert page.locator('.hg-gear-icon').count() == 2
        assert page.evaluate('savedPlan.rows["infantry:goggles"]') == {'ef':118,'et':120,'ff':30,'ft':30}
        assert errors == [], errors
        page.close()
        print(f'PASS {width}px: gear art, rarity, levels, automatic mastery, saved plan, no overflow')
    browser.close()
