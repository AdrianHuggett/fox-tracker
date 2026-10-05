/* Dawn Academy Experts planner. Same contract as the other planners:
   FOXExperts.mount(host, api) with api.plan, api.stock() -> {itemName:{have,target}},
   api.savePlan(plan) and api.applyTargets([{name,target}]). Costs follow the WoSTools
   rules checked in docs/experts-notes.md. */
(function(){'use strict';window.FOXExperts={mount:function(host,api){
const data=window.EXPERTS_DATA,P=data.points;
const SIGIL_ITEM={cyrille:'Ciryl Sigils',agnes:'Agnes Sigils',holger:'Holger Sigils',romulus:'Romulus Sigils',baldur:'Baldur Sigils',fabian:'Fabian Sigils',valeria:'Valeria Sigils',ronne:'Ronne Sigils',kathy:'Kathy Sigils',gareth:'Gareth Sigils'};
const GENERAL='General Expert Sigils',BOOKS='Books of Knowledge';
const ART={'Books of Knowledge':'item-books-of-knowledge.png','General Expert Sigils':'item-general-expert-sigils.png','Ciryl Sigils':'item-ciryl-sigils.png','Agnes Sigils':'item-agnes-sigils.png','Holger Sigils':'item-holger-sigils.png','Romulus Sigils':'item-romulus-sigils.png','Baldur Sigils':'item-baldur-sigils.png','Fabian Sigils':'item-fabian-sigils.png','Valeria Sigils':'item-valeria-sigils.png','Ronne Sigils':'item-ronne-sigils.png','Kathy Sigils':'item-kathy-sigils.png'};
/* Relationship levels: a multiple of 10 is first reached (x - 0.5) and then advanced (x) with sigils. */
const REL=[0];for(let a=1;a<=100;a++){if(a%10===0)REL.push(a-.5);REL.push(a);}
const relLabel=v=>v%1?'Lv. '+(v+.5):(v>0&&v%10===0?'Lv. '+v+' · Advanced':'Lv. '+v);
const snapRel=v=>{v=Number(v);return REL.indexOf(v)>=0?v:0;};
let disposed=false,busy=false,status='',gen=1;const open=new Set();
const raw=api.plan||{},state={experts:{},view:raw.view==='saved'?'saved':'edit'};
data.experts.forEach(e=>{const r=(raw.experts||{})[e.id]||{},from=snapRel(r.from),to=Math.max(from,snapRel(r.to)),skills={};
  e.skills.filter(s=>!s.talent).forEach(s=>{const k=(r.skills||{})[s.id]||{},f=clamp(k.from,0,s.maxLevel);skills[s.id]={from:f,to:Math.max(f,clamp(k.to,0,s.maxLevel))};});
  state.experts[e.id]={from,to,skills};});
function clamp(v,lo,hi){v=Math.floor(Number(v));return Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):lo;}
const fmt=n=>Math.round(n).toLocaleString('en-GB'),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const duration=m=>{m=Math.round(m);const d=Math.floor(m/1440),h=Math.floor(m%1440/60),mi=m%60;return (d?d+'d ':'')+h+'h '+mi+'m';};
const affinity=(e,a,b)=>b<=a?0:e.affinityCosts.slice(Math.max(0,Math.ceil(a)),Math.min(100,Math.ceil(b))).reduce((x,y)=>x+y,0);
const sigils=(e,a,b)=>{let n=0;for(let i=10;i<=100;i+=10)if(i>a&&i<=b)n+=e.sigilCosts[i/10-1];return n;};
const unlockAt=(e,s)=>(e.skills.filter(x=>!x.talent).findIndex(x=>x.id===s.id)+1)*10;
function capAt(e,s,rel){const n=10*Math.floor(rel/10);if(n<unlockAt(e,s))return 0;const c=s.caps;if(!c)return s.maxLevel;const keys=Object.keys(c).map(Number).sort((a,b)=>a-b);if(!keys.length||n<keys[0]||n>keys[keys.length-1])return s.maxLevel;let r=0;for(const k of keys){if(k<=n)r=c[k];else break;}return r;}
const span=(arr,s,a,b)=>b<=a?0:arr.slice(a,Math.min(s.maxLevel,b)).reduce((x,y)=>x+y,0);
function expertCost(e){const p=state.experts[e.id],out={affinity:affinity(e,p.from,p.to),sigils:sigils(e,p.from,p.to),books:0,minutes:0,steps:0};
  if(p.to>p.from)out.steps++;
  e.skills.filter(s=>!s.talent).forEach(s=>{const k=p.skills[s.id];if(k.to>k.from){out.books+=span(s.bookCosts,s,k.from,k.to);out.minutes+=span(s.minutes,s,k.from,k.to);out.steps++;}});return out;}
function totals(){const stock=api.stock()||{};const t={affinity:0,sigils:0,books:0,minutes:0,steps:0,perExpert:{},general:0};
  data.experts.forEach(e=>{const c=expertCost(e);t.affinity+=c.affinity;t.sigils+=c.sigils;t.books+=c.books;t.minutes+=c.minutes;t.steps+=c.steps;
    const own=(stock[SIGIL_ITEM[e.id]]||{}).have||0;t.perExpert[e.id]=c.sigils;t.general+=Math.max(0,c.sigils-own);});return t;}
function store(){status='Unsaved changes. Choose Save to keep your plan.';}
function planned(e){const p=state.experts[e.id];return p.to>p.from||Object.values(p.skills).some(k=>k.to>k.from);}
async function save(){if(busy||disposed)return;busy=true;status='Saving plan…';render();
  try{await api.savePlan({experts:state.experts,view:'saved'});if(disposed)return;state.view='saved';status='Plan saved to your account.';}
  catch(err){status='Plan not saved. '+(err.message||'Check your connection and retry.');}
  finally{busy=false;if(!disposed)render();}}
function relSelect(e,field,val,min){return `<select aria-label="${esc(e.name)} relationship ${field==='from'?'current':'target'} level" data-rel="${e.id}" data-field="${field}">${REL.filter(v=>v>=min).map(v=>`<option value="${v}" ${v===val?'selected':''}>${relLabel(v)}</option>`).join('')}</select>`;}
function lvlSelect(e,s,field,val,max,min){let o='';for(let i=min;i<=max;i++)o+=`<option value="${i}" ${i===val?'selected':''}>${i}</option>`;return `<select aria-label="${esc(s.name)} ${field==='from'?'current':'target'} level" data-ex="${e.id}" data-skill="${s.id}" data-field="${field}">${o}</select>`;}
function expertBlock(e){const p=state.experts[e.id],c=expertCost(e),saving=state.view==='saved';
  const head=`<summary><span class="ex-name"><strong>${esc(e.name)}</strong><small>${esc(e.focus)}${e.estimated?' · <em>estimated data</em>':''}</small></span><span class="ex-sum">${c.steps?`${fmt(c.sigils)} <small>sigils</small> · ${fmt(c.books)} <small>books</small>`:'<small>No upgrades planned</small>'}</span></summary>`;
  const rel=saving?(p.to>p.from?`<p class="ex-recap">Relationship ${relLabel(p.from)} → ${relLabel(p.to)} · ${fmt(c.affinity)} Affinity · ${fmt(c.sigils)} sigils</p>`:''):
    `<div class="ex-row"><div class="ex-label"><strong>Relationship</strong><span>${fmt(c.affinity)} Affinity · ${fmt(c.sigils)} sigils</span></div><div class="ex-levels"><label>Current${relSelect(e,'from',p.from,0)}</label><span>→</span><label>Target${relSelect(e,'to',p.to,p.from)}</label></div></div>`;
  const skills=e.skills.map(s=>{if(s.talent)return saving?'':`<div class="ex-row ex-talent"><div class="ex-label"><strong>${esc(s.name)}</strong><span>Talent · auto-upgrades with relationship</span></div></div>`;
    const k=p.skills[s.id],cap=capAt(e,s,p.to),books=span(s.bookCosts,s,k.from,k.to),mins=span(s.minutes,s,k.from,k.to);
    if(saving)return k.to>k.from?`<p class="ex-recap">${esc(s.name)} Lv. ${k.from} → Lv. ${k.to} · ${fmt(books)} books</p>`:'';
    const top=Math.max(k.from,cap),note=cap<s.maxLevel?(cap===0?`Unlocks at relationship Lv. ${unlockAt(e,s)} (advanced)`:`Max Lv. ${cap} at the target relationship`):'';
    return `<div class="ex-row"><div class="ex-label"><strong>${esc(s.name)}</strong><span>Max ${s.maxLevel}${note?' · '+note:''}</span></div><div class="ex-levels"><label>Current${lvlSelect(e,s,'from',k.from,s.maxLevel,0)}</label><span>→</span><label>Target${lvlSelect(e,s,'to',k.to,top,k.from)}</label></div><div class="ex-cost">${k.to>k.from?`${fmt(books)} <small>books</small><span>${duration(mins)}</span>`:'<span>—</span>'}</div></div>`;}).join('');
  return `<details class="ex-expert" data-open="${e.id}" ${open.has(e.id)||(saving&&planned(e))?'open':''}>${head}${rel}${skills}</details>`;}
function render(){const t=totals(),saving=state.view==='saved',stock=api.stock()||{};
  const mats=[[BOOKS,t.books]].concat(data.experts.filter(e=>t.perExpert[e.id]>0).map(e=>[SIGIL_ITEM[e.id],t.perExpert[e.id]]));
  if(t.general>0)mats.push([GENERAL,t.general]);
  const usable=mats.filter(([n,v])=>v>0&&stock[n]),missing=mats.filter(([n,v])=>v>0&&!stock[n]);
  const icon=n=>ART[n]?`<img src="${ART[n]}" alt="">`:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7z"/></svg>';
  const list=data.experts.filter(e=>e.generation===gen&&(!saving||planned(e)));
  host.innerHTML=`<h1>Plan your Dawn Academy Experts.</h1><p class="lead">Plan relationship levels and skills for every Expert. Turn the sigils and books into Backpack targets.</p>
<div class="ex-layout"><section class="ex-plan"><div class="ex-heading"><strong>My Experts plan <small>${t.steps} upgrades</small></strong><div><button id="ex-edit" aria-pressed="${!saving}">Edit</button><button id="ex-save" aria-pressed="${saving}">Save</button></div></div>
<p id="ex-status" class="ex-note" role="status">${esc(status)}</p>
<div class="ex-tabs" role="tablist" aria-label="Generation">${[1,2,3].map(g=>`<button role="tab" aria-selected="${gen===g}" data-gen="${g}">Gen ${g}</button>`).join('')}</div>
<p class="ex-note">${saving?'Only planned upgrades are shown. Choose Edit to change your plan.':'Enter the levels shown in your game. A multiple of 10 is reached first, then advanced with sigils. Skill targets stop at the highest level the target relationship allows.'}</p>
<div class="ex-list">${list.map(expertBlock).join('')||'<p class="ex-empty">No upgrades planned in this generation. Choose Edit to add one.</p>'}</div></section>
<aside class="ex-summary"><section><h3>Your plan total</h3><p class="ex-small">All Experts combined</p>
${mats.filter(([n,v])=>v>0).map(([n,v])=>{const s=stock[n];return `<div class="ex-material">${icon(n)}<div><strong>${fmt(v)}</strong><span>${esc(n)}</span><small>${s?`Have ${fmt(s.have||0)} · Still needed ${fmt(Math.max(0,v-(s.have||0)))}`:'Not in your Backpack'}</small></div></div>`;}).join('')||'<p class="ex-small">No upgrades planned yet.</p>'}
<p class="ex-small">Each Expert uses its own sigils first. General Expert Sigils cover what its own sigils do not.</p>
<div class="ex-time"><span>Affinity</span><strong>${fmt(t.affinity)}</strong><small>Compass 10 · Fiery Heart 100 · Sail of Conquest 1,000 each. Not tracked in the Backpack.</small></div>
<div class="ex-time"><span>Learning time</span><strong>${duration(t.minutes)}</strong><small>Before learning speedups.</small></div>
<button class="ex-primary" id="ex-push" ${usable.length&&!busy?'':'disabled'}>Push to Backpack as Target</button>
<p class="ex-small">${missing.length?'Not in your Backpack, so not updated: '+missing.map(([n])=>esc(n)).join(', ')+'.':'Review the targets before applying.'}</p></section>
<section><h3>SvS points</h3><strong class="ex-points">${fmt(t.sigils*P.sigil+t.books*P.book)} <small>pts</small></strong><p class="ex-small">${fmt(t.sigils)} sigils × ${fmt(P.sigil)} + ${fmt(t.books)} books × ${fmt(P.book)}</p><p class="ex-small">Learning speedups (${P.learningMinute} pts per minute) and bonuses are excluded.</p></section></aside></div>
<p class="ex-source">Cost reference: <a href="https://wostools.net/experts-calculator" target="_blank" rel="noopener">WoSTools Experts calculator</a>, checked ${esc(data.source.retrieved)}. Ronne and Kathy costs are estimates in the source. Verify skill caps in game before spending.</p>
<dialog id="ex-dialog"><h3>Update your Backpack targets?</h3><p>Replace these targets with your plan totals.</p>${usable.map(([n,v])=>`<p class="ex-resource"><span>${esc(n)}</span><strong>${fmt((stock[n]||{}).target||0)} → ${fmt(v)}</strong></p>`).join('')}<p>Your current stock stays unchanged.</p><p id="ex-error" role="alert"></p><div class="ex-actions"><button id="ex-cancel">Keep current targets</button><button id="ex-apply" class="ex-primary">Apply targets</button></div></dialog>`;
  host.querySelectorAll('select,#ex-save,#ex-edit').forEach(x=>x.disabled=busy);
  host.querySelector('#ex-save').onclick=save;host.querySelector('#ex-edit').onclick=()=>{if(!busy){state.view='edit';render();}};
  host.querySelectorAll('[data-gen]').forEach(b=>b.onclick=()=>{gen=+b.dataset.gen;render();});
  host.querySelectorAll('details[data-open]').forEach(d=>d.ontoggle=()=>{d.open?open.add(d.dataset.open):open.delete(d.dataset.open);});
  host.querySelectorAll('select[data-rel]').forEach(s=>s.onchange=()=>{if(busy)return;const p=state.experts[s.dataset.rel],e=data.experts.find(x=>x.id===s.dataset.rel);p[s.dataset.field]=snapRel(s.value);if(p.to<p.from)p.to=p.from;
    e.skills.filter(x=>!x.talent).forEach(x=>{const k=p.skills[x.id];k.to=Math.max(k.from,Math.min(k.to,capAt(e,x,p.to)));});store();render();});
  host.querySelectorAll('select[data-skill]').forEach(s=>s.onchange=()=>{if(busy)return;const k=state.experts[s.dataset.ex].skills[s.dataset.skill];k[s.dataset.field]=+s.value;if(k.to<k.from)k.to=k.from;store();render();});
  const d=host.querySelector('#ex-dialog');let applying=false;
  host.querySelector('#ex-push').onclick=()=>d.showModal();host.querySelector('#ex-cancel').onclick=()=>{if(!applying)d.close();};d.oncancel=ev=>{if(applying)ev.preventDefault();};
  host.querySelector('#ex-apply').onclick=async()=>{if(applying||disposed)return;applying=true;const a=host.querySelector('#ex-apply'),c=host.querySelector('#ex-cancel');a.disabled=c.disabled=true;
    try{await api.applyTargets(usable.map(([n,v])=>({name:n,target:v})));if(!disposed){d.close();status='Backpack targets updated.';render();}}
    catch(err){if(!disposed)host.querySelector('#ex-error').textContent=err.message||'Targets could not be saved. Please retry.';}
    finally{applying=false;if(!disposed){a.disabled=c.disabled=false;}}};}
render();return{refresh:function(){if(!disposed&&!busy&&!host.querySelector('dialog[open]'))render();},dispose:function(){disposed=true;}};
}};})();
