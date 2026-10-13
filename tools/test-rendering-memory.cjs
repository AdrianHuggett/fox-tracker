// Local-only rendering regression with synthetic data. Requires playwright.
// Usage: node tools/test-rendering-memory.cjs [site-directory] [viewport-width]
const fs=require('fs'),path=require('path'),cp=require('child_process');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'..'),root=process.argv[2]||repo;
const out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
let mock=fs.readFileSync(path.join(repo,'tools/mock-supabase.js'),'utf8')+`
var db=window.__DB;
while(db.user_items.length<87){var k=db.user_items.length;db.user_items.push({sort:k+1,grp:'Materials',name:'Material '+k,have:100,target:200,free:0});}
db.baselines=db.user_items.map(x=>({item:x.name,usd:1}));
db.packs=Array.from({length:207},(_,k)=>({id:k+1,sort:k+1,sec:'Daily',grp:'Packs',name:'Pack '+k,price:5,pack_value:200,occurrence:'daily'}));
db.pack_contents=db.packs.map(x=>({pack_id:x.id,item:'Design Plans',qty:20}));`;
(async()=>{
 const b=await chromium.launch(process.env.FOX_TEST_BROWSER?{executablePath:process.env.FOX_TEST_BROWSER}:{});
 const pg=await b.newPage({viewport:{width:Number(process.argv[3])||1150,height:900}}),errors=[];
 pg.on('pageerror',e=>errors.push(String(e)));
 await pg.route('**/*',r=>r.request().url().includes('supabase-js')?r.fulfill({body:mock,contentType:'application/javascript'}):r.request().url().startsWith('file:')?r.continue():r.fulfill({body:'',status:200}));
 const c=await pg.context().newCDPSession(pg);await c.send('Performance.enable');
 await pg.goto(require('url').pathToFileURL(path.join(root,'index.html')).href);
 await pg.waitForFunction(()=>document.querySelector('#c-all').textContent.includes('87'));
 await pg.evaluate(()=>document.querySelector('#news')?.remove());
 async function metrics(label){await c.send('HeapProfiler.collectGarbage');console.log(label,JSON.stringify(Object.fromEntries((await c.send('Performance.getMetrics')).metrics.filter(x=>['JSHeapUsedSize','Nodes','JSEventListeners'].includes(x.name)).map(x=>[x.name,x.value]))));}
 await metrics('initial');
 await pg.click('#category-nav [data-category="prep"]');
 await pg.getByRole('spinbutton',{name:'Design Plans have',exact:true}).waitFor();
 await metrics('backpack');
 for(let i=0;i<20;i++){const e=pg.getByRole('spinbutton',{name:'Design Plans have',exact:true});await e.fill(String(101+i));await e.press('Tab');}
 await pg.waitForTimeout(900);await metrics('after20edits');
 for(const category of ['resources','prep']){await pg.click('#category-nav [data-category="'+category+'"]');const pages=await pg.locator('#category-sub [data-page]').evaluateAll(els=>els.map(e=>e.dataset.page));for(const page of pages){await pg.locator('#category-sub [data-page="'+page+'"]').click();await pg.waitForTimeout(60);}}
 for(const page of ['buildings','gear','war','experts','hero','charms']){
   await pg.click('#category-nav [data-category="planner"]');
   await pg.click('#p-planner [data-go="'+page+'"]');
   if(await pg.locator('#p-'+page+' input, #p-'+page+' select, #p-'+page+' button').count()===0)throw new Error('Empty planner '+page);
 }
 await pg.click('#category-nav [data-category="resources"]');
 await pg.click('#category-sub [data-page="matrix"]');
 const before=await pg.locator('#matrix tbody').innerHTML();
 await pg.click('#category-nav [data-category="prep"]');await pg.click('#category-sub [data-page="stock"]');
 await pg.getByRole('spinbutton',{name:'Design Plans target',exact:true}).fill('333');
 await pg.getByRole('spinbutton',{name:'Design Plans target',exact:true}).press('Tab');
 if(before!==await pg.locator('#matrix tbody').innerHTML())throw new Error('Hidden matrix rebuilt');
 await pg.click('#category-nav [data-category="resources"]');await pg.click('#category-sub [data-page="matrix"]');
 if(before===await pg.locator('#matrix tbody').innerHTML())throw new Error('Matrix was not refreshed on return');
 await pg.locator('select.langsel').first().selectOption('es');
 await pg.locator('select.langsel').first().selectOption('en');
 await pg.click('#category-nav [data-category="prep"]');await pg.click('#category-sub [data-page="stock"]');
 await pg.screenshot({path:path.join(out,'memory-fix-'+(process.argv[3]||1150)+'.png'),fullPage:false});
 await metrics('alltabs');console.log('errors',errors);if(errors.length)throw new Error(errors.join('\n'));
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
