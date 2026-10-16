const {chromium} = require('C:/Users/ECS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
const path = require('path');
(async () => {
 const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 fs.mkdirSync('tools/out',{recursive:true});
 for (const width of [1150,400]) {
  const page = await browser.newPage({viewport:{width,height:900}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().includes('supabase-js') ? r.fulfill({body:fs.readFileSync('tools/mock-supabase.js','utf8'),contentType:'application/javascript'}) : r.request().url().startsWith('file:') ? r.continue() : r.fulfill({body:''}));
  await page.goto(require('url').pathToFileURL(path.resolve('index.html')).href);
  await page.waitForTimeout(800);
  await page.evaluate(()=>document.getElementById('news')?.remove());
  if(!(await page.locator('#p-foxnews').evaluate(el=>el.classList.contains('on')))) throw Error('News is not the landing page');
  await page.locator('[data-category="prep"]').click();
  await page.locator('#category-sub [data-page="dash"]').click();
  if(!(await page.locator('#p-dash').evaluate(el=>el.classList.contains('on')))) throw Error('Dashboard not in My Prep');
  await page.screenshot({path:"tools/out/prep-.png",fullPage:true});
  await page.locator('[data-category="foxnews"]').click();
  await page.getByRole('heading',{name:'How pack promotion percentages work'}).waitFor();
  await page.screenshot({path:`tools/out/news-${width}.png`,fullPage:true});
  if(await page.locator('#fox-news-list article').count() !== 3) throw Error('Expected three news articles');
  if(await page.locator('#fox-news-list li').count() < 10) throw Error('Missing summaries');
  for(const [group,tab] of [['prep','dash'],['prep','stock'],['prep','packs'],['resources','matrix'],['resources','ref'],['alliance','r4'],['alliance','admin']]) {
   await page.locator(`[data-category="${group}"]`).click();
   await page.locator(`#category-sub [data-page="${tab}"]`).click();
   if(tab==='stock') {
    await page.locator('[data-stock-fold="collapse"]').click();
    if(await page.locator('#stock .gtog[aria-expanded="true"]').count()) throw Error('Collapse all failed');
    if(await page.locator('#stock tbody tr[data-gn]:not(.hide)').count()) throw Error('Collapsed rows still visible');
    await page.locator('[data-stock-fold="expand"]').click();
    if(await page.locator('#stock .gtog[aria-expanded="false"]').count()) throw Error('Expand all failed');
   }
   await page.waitForTimeout(150);
  }
  if(errors.length) throw Error(errors.join('\n'));
  console.log(`${width}px: landing, navigation and production news passed`);
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
