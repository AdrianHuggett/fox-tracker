/* FOX Prep Tracker — front end */
(function(){
'use strict';
var SB=null, U=null, ADMIN=false, R4ED=false, membersLoaded=false, D={items:[],packs:[],contents:{},base:{},settings:{}}, uPacks={};
var timers={}, sync=document.getElementById('sync');
var sortMode='section', sortDir=-1;
/* Which Backpack groups are folded shut, keyed by group name so the state
   survives a re-render and a reload. */
var PACK_FOLD={};
try{ PACK_FOLD=JSON.parse(localStorage.getItem('fox-pack-fold')||'{}')||{}; }catch(err){ PACK_FOLD={}; }
/* Dated snapshots of this member's Have, and the measured Free / day they give. */
var HIST=[], HIST_OK=false, FREE_M={}, HIST_SPAN=0, HIST_SINCE='';
var FREE_MIN_DAYS=3;
/* Daily income drifts as an account grows, so only the latest three months count.
   The database drops older rows on its own; this keeps the maths to the same window. */
var FREE_WINDOW_DAYS=90;
var FOLD={};
try{ FOLD=JSON.parse(localStorage.getItem('fox-fold')||'{}')||{}; }catch(err){ FOLD={}; }
var CURR={GBP:{symbol:'£',rate:1},USD:{symbol:'$',rate:1.27},EUR:{symbol:'€',rate:1.17},
  MUR:{symbol:'Rs',rate:63.4},INR:{symbol:'₹',rate:106},ZAR:{symbol:'R',rate:23.5},
  AUD:{symbol:'A$',rate:1.93},CAD:{symbol:'C$',rate:1.74},PHP:{symbol:'₱',rate:71},
  BRL:{symbol:'R$',rate:7.1},NGN:{symbol:'₦',rate:1950},SGD:{symbol:'S$',rate:1.65}};
var CUR={code:'GBP',symbol:'£',rate:1};
var SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">';
var ICO={
  target:SVG+'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><path d="M12 1.6v2.4M12 20v2.4M1.6 12H4M20 12h2.4"/></svg>',
  bars:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 20v-6.5"/><path d="M12 20V5"/><path d="M19 20v-9.5"/></svg>',
  coins:SVG+'<ellipse cx="12" cy="6.2" rx="7.6" ry="3.2"/><path d="M4.4 6.2v5.6c0 1.77 3.4 3.2 7.6 3.2s7.6-1.43 7.6-3.2V6.2"/><path d="M4.4 11.8v5.6c0 1.77 3.4 3.2 7.6 3.2s7.6-1.43 7.6-3.2v-5.6"/></svg>',
  box:SVG+'<path d="M20.5 7.7 12 3 3.5 7.7 12 12.4l8.5-4.7Z"/><path d="M3.5 7.7v8.6L12 21l8.5-4.7V7.7"/><path d="M12 12.4V21"/></svg>',
  calendar:SVG+'<rect x="3.2" y="5" width="17.6" height="16" rx="2.4"/><path d="M16 3v4M8 3v4M3.2 10h17.6"/></svg>'
};
function initials(email,name){
  name=(name||'').trim();
  if(name){ var p=name.split(/\s+/); return (p[0].charAt(0)+(p[1]?p[1].charAt(0):'')).toUpperCase(); }
  email=(email||'').trim();
  var loc=email.split('@')[0]||'';
  return (loc.slice(0,2)||'??').toUpperCase();
}
function identifyUser(u){
  U=u; $('who').textContent=u.email;
  var av=$('avatar'); if(av) av.textContent=initials(u.email,u.user_metadata&&u.user_metadata.name);
}
function money(v,dp){ return CUR.symbol+fmt(v*CUR.rate,dp===undefined?2:dp); }
/* Torxim baselines are priced in USD; pack prices are held in GBP. Convert the
   USD figure to the GBP base first so money() lands in the user's currency. */
function baseMoney(usd){ return money(usd/((CURR.USD&&CURR.USD.rate)||1.27),1); }
function fillCurrencyInputs(){
  var sel=$('cur-select'), sy=$('cur-symbol'), ra=$('cur-rate');
  if(!sel) return;
  sel.value = CURR[CUR.code] ? CUR.code : 'CUSTOM';
  sy.value = CUR.symbol; ra.value = CUR.rate;
}
function saveCurrency(){
  queue('currency',function(){
    return SB.from('profiles').update({currency_code:CUR.code,currency_symbol:CUR.symbol,currency_rate:n(CUR.rate)}).eq('id',U.id);
  });
}

var toastTimer=null;
/* The header status span is hidden on narrow screens, so anything that actually
   went wrong also goes here, where it is visible at every width and stays put
   until it is dismissed. */
function toast(msg,bad){
  var t=$('toast'), x=$('toast-text');
  if(!t||!x) return;
  x.textContent=msg;
  t.className=bad?'bad':'';
  t.hidden=false;
  clearTimeout(toastTimer);
  if(!bad) toastTimer=setTimeout(function(){ t.hidden=true; },2600);
}
function say(t,warn){
  if(sync){ sync.textContent=t||''; sync.className=warn?'warn':''; }
  if(warn) toast(t,1);
}
/* A load that fails leaves nothing on screen, so say what happened and offer a way back. */
function fatal(title,why){
  var f=$('fatal'); if(!f) return;
  if($('fatal-title')) $('fatal-title').textContent=title;
  if($('fatal-why')) $('fatal-why').textContent=why||'';
  f.hidden=false;
  if($('auth')) $('auth').style.display='none';
  if($('app')) $('app').style.display='none';
  var nv=$('navtabs'); if(nv) nv.style.display='none';
  if(sync){ sync.textContent=title; sync.className='warn'; }
}
window.onerror=function(m){ say('error: '+String(m).slice(0,80),1); };
window.addEventListener('unhandledrejection',function(e){
  var r=e.reason; say('error: '+String((r&&r.message)||r).slice(0,80),1);
});
function n(v){ v=parseFloat(v); return isFinite(v)?v:0; }
function fmt(v,dp){ if(v===null||v===undefined||v==='') return '—';
  dp=dp||0; if(dp===0&&Math.abs(v-Math.round(v))>1e-9) dp=1;
  return Number(v).toLocaleString('en-GB',{minimumFractionDigits:dp,maximumFractionDigits:dp}); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function $(id){ return document.getElementById(id); }

/* Seasonal quantities represent purchases during this event, never a monthly rate. */
function moonlightPack(p){ return p.grp==='Moonlight Festival'; }
/* ---------- maths ---------- */
/* Every projection is driven by this date, and nothing in the app can change it,
   so when it runs out or goes missing the app has to say so rather than quietly
   projecting zero days of income. */
function svsInfo(){
  var s=D.settings.next_svs;
  if(!s) return {state:'missing',days:30};
  var d=new Date(s+'T00:00:00');
  if(isNaN(d)) return {state:'missing',days:30};
  var t=new Date(); t.setHours(0,0,0,0);
  var n=Math.round((d-t)/86400000);
  return {state:(n<0?'past':(n===0?'today':'ok')),days:Math.max(0,n),date:s};
}
function days(){ return svsInfo().days; }
function renderSvsWarn(){
  var b=$('svswarn'); if(!b) return;
  var i=svsInfo();
  if(i.state==='ok'||i.state==='today'){ b.hidden=true; return; }
  b.textContent = i.state==='missing'
    ? 'No SvS date is set, so every projection below assumes 30 days of income. Ask Adrian to set the next date.'
    : 'The SvS date (' + i.date + ') has passed, so projections now assume no time left and everything reads as behind. Ask Adrian to set the next date.';
  b.hidden=false;
}
function calcItem(it){
  /* The pack number on Things to buy is what has already been bought, and whatever
     those packs delivered is already inside Have. Adding it again would count it
     twice, so the only thing still to come is free income until SvS day. */
  var have=n(it.have), tgt=n(it.target), g=freeRate(it)*days();
  var proj=have+g;
  return {have:have,tgt:tgt,proj:proj,pct:tgt>0?have/tgt:null,
          raw:tgt>0?Math.max(tgt-have,0):0, left:tgt>0?Math.max(tgt-proj,0):0,
          ok:tgt>0?(proj>=tgt):null};
}
function itemMap(){ var m={}; D.items.forEach(function(i){m[i.name]=i;}); return m; }
function calcPack(p,byName){
  if(moonlightPack(p)) return {best:null,iv:0,pv:0,verdict:'Event pack',scoreable:false};
  var price=Math.max(n(p.price),0.01), best=null, bv=0, c=D.contents[p.id]||{};
  var scoreable=false;
  Object.keys(c).forEach(function(k){
    if(k==='Gems') return;
    var it=byName[k]; if(!it) return;
    var b=n(D.base[k]); if(!b) return;
    scoreable=true;
    if(calcItem(it).raw<=0) return;
    var v=n(c[k])*b/price; if(v>bv){ bv=v; best=k; }
  });
  var pv=n(p.pack_value), iv=bv*100, verdict;
  if(!scoreable){
    if(pv>=150) verdict='Must buy';
    else if(pv>=100) verdict='Worth checking';
    else if(pv>0) verdict='Last resort';
    else verdict='—';
  }
  else if(iv<=0) verdict='—';
  else if(pv>=150&&iv>=120) verdict='Must buy';
  else if(iv>=120) verdict='Item buy';
  else if(pv>=150) verdict='Worth checking';
  else verdict='Last resort';
  return {best:best,iv:iv,pv:pv,verdict:verdict,scoreable:scoreable};
}
function budget(){ var t=0; D.packs.forEach(function(p){ t+=n(p.price)*n(uPacks[p.id]); }); return t; }

/* ---------- measured free income ----------
   Every time a member saves their Backpack, today's Have is stored alongside how
   many of each pack they have bought so far. Free / day is then

     (rise in Have  -  what the packs bought in between delivered)  /  days

   taken from the oldest snapshot in the last FREE_WINDOW_DAYS to the latest, so it
   sharpens as updates build up and still follows income as it changes. Pack items are taken out of the rate here and
   are still counted in Projected, through Have. Until a member has FREE_MIN_DAYS
   of history the starting estimate stored on the item is used instead. */
function todayKey(){
  var d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function dayNum(s){ var p=String(s).split('-'); return Math.round(Date.UTC(+p[0],+p[1]-1,+p[2])/864e5); }
function prettyDay(s){
  var p=String(s).split('-'); if(p.length<3) return s;
  return (+p[2])+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+p[1]-1];
}
/* Pack counts are stored rather than the items they add up to, and turned into
   items with today's Pack contents. A later correction to a pack's contents then
   applies to both ends of the window alike, instead of reading as a purchase. */
function packCounts(){
  var c={}; Object.keys(uPacks).forEach(function(id){ if(n(uPacks[id])) c[id]=n(uPacks[id]); });
  return c;
}
function packsDelivered(a,b,item){
  var pa=a.packs||{}, pb=b.packs||{}, seen={}, t=0;
  Object.keys(pa).concat(Object.keys(pb)).forEach(function(id){
    if(seen[id]) return; seen[id]=1;
    var d=n(pb[id])-n(pa[id]); if(!d) return;
    var c=D.contents[id]; if(c&&c[item]) t+=d*n(c[item]);
  });
  return t;
}
function currentSnapshot(){
  var h={}; D.items.forEach(function(it){ h[it.name]=n(it.have); });
  return {day:todayKey(),have:h,packs:packCounts()};
}
function trimHistory(){
  if(!HIST.length) return;
  var cut=dayNum(HIST[HIST.length-1].day)-FREE_WINDOW_DAYS;
  HIST=HIST.filter(function(s){ return dayNum(s.day)>=cut; });
}
function recomputeFree(){
  trimHistory();
  FREE_M={}; HIST_SPAN=0; HIST_SINCE=HIST.length?HIST[0].day:'';
  if(HIST.length<2) return;
  HIST_SPAN=dayNum(HIST[HIST.length-1].day)-dayNum(HIST[0].day);
  /* An item added part-way through starts its own clock at its first snapshot. */
  var first={}, last={};
  HIST.forEach(function(s){
    Object.keys(s.have||{}).forEach(function(k){ if(!first[k]) first[k]=s; last[k]=s; });
  });
  Object.keys(first).forEach(function(k){
    var a=first[k], b=last[k], span=dayNum(b.day)-dayNum(a.day);
    if(span<FREE_MIN_DAYS) return;
    var gain=n(b.have[k])-n(a.have[k]);
    var packs=packsDelivered(a,b,k);
    /* Spending during prep can push this below zero; income is never negative. */
    FREE_M[k]={rate:Math.max(0,(gain-packs)/span),span:span};
  });
}
function freeRate(it){ var m=FREE_M[it.name]; return m?m.rate:n(it.free); }
function freeCell(it){
  var m=FREE_M[it.name];
  if(m) return '<span title="Measured over '+plural(m.span,'day')+' of your updates">'+fmt(m.rate,2)+'</span>';
  var v=n(it.free);
  return v?'<span class="mini" title="Starting estimate, used until you have '+FREE_MIN_DAYS+' days of updates">'+fmt(v,2)+'</span>'
          :'<span class="mini">\u2014</span>';
}
function renderFreeNote(){
  var el=$('free-note'); if(!el) return;
  if(!HIST_OK){ el.textContent=''; return; }
  if(Object.keys(FREE_M).length){
    el.textContent='Measured over '+plural(HIST_SPAN,'day')+' of your updates, since '+prettyDay(HIST_SINCE)+
      '. It uses your last 3 months, so it keeps up as your daily income changes.';
  }else{
    el.textContent='Measuring started '+prettyDay(HIST_SINCE||todayKey())+'. Once you have '+FREE_MIN_DAYS+
      ' days of updates, your own measured figure replaces the faded starting estimate.';
  }
}
/* Called on every Backpack or pack-count change. One row per member per day: later
   saves on the same day replace it, so the day's final numbers are what count. */
function noteSnapshot(){
  if(!HIST_OK||!U||!SB) return;
  var s=currentSnapshot(), last=HIST[HIST.length-1];
  if(last&&last.day===s.day) HIST[HIST.length-1]=s;
  else if(!last||last.day<s.day) HIST.push(s);
  else return;
  recomputeFree();
  queue('snap',function(){
    var x=currentSnapshot();
    return SB.from('stock_history').upsert({user_id:U.id,day:x.day,have:x.have,packs:x.packs,
      updated_at:new Date().toISOString()},{onConflict:'user_id,day'});
  });
}
/* Loaded on its own so a missing table only switches measuring off, rather than
   stopping the whole tracker from loading. */
/* ---------- R4 roles ----------
   Who leads each alliance task and who backs them up. Everyone signed in can read
   it; only an admin can change it, and that is enforced by the database's row
   policies, not by what this page shows or hides. */
var R4={members:[],tasks:[],loaded:false,loading:false};
/* An admin reads the same compact table as everyone else; the edit controls only
   appear after switching to editing, so the page is not a wall of boxes. */
var R4_EDIT=false;
var R4_SECTIONS=['Core Administrative Tasks','Leadership and Support',
  'Event, Activity Management & Scheduling','Expansion and Farms'];
var R4_TONE=['coral','orange','gold','good'];
function r4Task(id){ for(var i=0;i<R4.tasks.length;i++) if(R4.tasks[i].id===id) return R4.tasks[i]; return null; }
function r4Name(id){ for(var i=0;i<R4.members.length;i++) if(String(R4.members[i].id)===String(id)) return R4.members[i].name; return ''; }
function r4Msg(html){
  var t=$('r4'); if(!t) return;
  t.querySelector('thead').innerHTML='';
  t.querySelector('tbody').innerHTML='<tr><td class="empty">'+html+'</td></tr>';
}
/* "18:50" or "14:00 / 17:00" in UTC, rewritten in the viewer's own clock. Nothing is
   shown for someone already on UTC, or for text with no time in it. */
function r4Local(s){
  s=String(s||'');
  if(!/\d{1,2}:\d{2}/.test(s)||!new Date().getTimezoneOffset()) return '';
  return s.replace(/(\d{1,2}):(\d{2})/g,function(m,h,mi){
    var d=new Date(); d.setUTCHours(+h,+mi,0,0);
    return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  });
}
function r4Sections(){
  var out=R4_SECTIONS.slice();
  R4.tasks.forEach(function(t){ if(out.indexOf(t.section)<0) out.push(t.section); });
  return out;
}
function r4Who(t){
  var main=[], help=[];
  R4.members.forEach(function(m){
    var r=t.roles[m.id]; if(r==='main') main.push(m.name); else if(r==='assist') help.push(m.name);
  });
  return {main:main,help:help};
}
function r4In(t,f,label,max){
  return '<input class="r4in" type="text" maxlength="'+max+'" data-r4f="'+f+'" data-t="'+t.id+'" value="'+
    esc(t[f]||'')+'" placeholder="'+esc(label)+'" aria-label="'+esc(label)+'">';
}
function renderR4(){
  var tb=$('r4'); if(!tb||!R4.loaded) return;
  /* Admin edits everything; an R4 editor (named by the admin on Members) only moves the dots. */
  var adm=!!ADMIN&&R4_EDIT, dots=!!R4ED&&R4_EDIT, M=R4.members, cols=4+M.length+(adm?1:0);
  var eb=$('r4-edit');
  if(eb){ eb.hidden=!R4ED; eb.textContent=R4_EDIT?'Done':'Edit roles'; eb.setAttribute('aria-pressed',String(R4_EDIT)); }
  tb.classList.toggle('adm',dots);
  tb.querySelector('thead').innerHTML='<tr><th>Task</th>'+
    M.map(function(m){ return '<th class="r4m" scope="col">'+esc(m.name)+'</th>'; }).join('')+
    '<th>Frequency</th><th>Remarks</th><th class="num">UTC</th>'+(adm?'<th><span class="sr">Remove</span></th>':'')+'</tr>';
  var out=[], open=0, lead={}, help={};
  M.forEach(function(m){ lead[m.id]=0; help[m.id]=0; });
  r4Sections().forEach(function(sec,si){
    var list=R4.tasks.filter(function(t){ return t.section===sec; });
    if(!list.length&&!adm) return;
    out.push('<tr class="r4sec" data-tone="'+(R4_TONE[si]||'ice')+'"><td colspan="'+cols+'"><span class="sw" aria-hidden="true"></span>'+
      esc(sec)+(adm?'<button type="button" class="r4btn r4addt" data-r4="addtask" data-s="'+esc(sec)+'">Add task</button>':'')+'</td></tr>');
    list.forEach(function(t){
      var w=r4Who(t);
      if(!w.main.length&&!w.help.length) open++;
      var loc=r4Local(t.time_utc);
      /* On a phone a list of every name says less than "All R4s" does. */
      var all=function(l){ return M.length>1&&l.length===M.length?'All R4s':l.join(', '); };
      var who=(w.main.length?'<span><b>Main</b> '+esc(all(w.main))+'</span>':'')+
              (w.help.length?'<span><b>Assist</b> '+esc(all(w.help))+'</span>':'')+
              (!w.main.length&&!w.help.length?'<span class="r4none">Nobody assigned yet</span>':'');
      var cells=M.map(function(m){
        var r=t.roles[m.id]||'';
        if(r==='main') lead[m.id]++; else if(r==='assist') help[m.id]++;
        var word=r==='main'?'Main':(r==='assist'?'Assist':'not assigned');
        if(dots) return '<td class="r4c"><button type="button" class="r4dot '+r+'" data-r4="cycle" data-t="'+t.id+'" data-m="'+m.id+
          '" aria-label="'+esc(m.name+', '+t.name+': '+word+'. Tap to change')+'"><span class="r4n">'+esc(m.name)+'</span></button></td>';
        return '<td class="r4c">'+(r?'<span class="r4dot '+r+'" role="img" aria-label="'+esc(m.name+': '+word)+'" title="'+esc(m.name+': '+word)+'"></span>':'')+'</td>';
      }).join('');
      out.push('<tr data-q="'+esc((t.name+' '+w.main.join(' ')+' '+w.help.join(' ')+' '+t.remarks).toLowerCase())+'">'+
        '<td class="r4task">'+(adm?r4In(t,'name','Task name',80):esc(t.name))+'<div class="r4who">'+who+'</div>'+
          ((t.freq||t.remarks)&&!dots?'<div class="r4meta">'+esc([t.freq,t.remarks].filter(Boolean).join(' \u00b7 '))+'</div>':'')+'</td>'+cells+
        '<td class="r4freq">'+(adm?r4In(t,'freq','Frequency',40):esc(t.freq||'—'))+'</td>'+
        '<td class="r4rem">'+(adm?r4In(t,'remarks','Remarks',200):esc(t.remarks||''))+'</td>'+
        '<td class="r4time num'+(t.time_utc||adm?'':' nt')+'">'+(adm?r4In(t,'time_utc','Time in UTC',30):(t.time_utc?esc(t.time_utc):'—'))+
          (loc&&!adm?'<small>'+esc(loc)+' yours</small>':'')+'</td>'+
        (adm?'<td class="r4x"><button type="button" class="r4del" data-r4="deltask" data-t="'+t.id+'" aria-label="'+esc('Remove '+t.name)+'">&times;</button></td>':'')+
        '</tr>');
    });
  });
  if(M.length) out.push('<tr class="need r4tot"><td>Tasks led / backing up</td>'+
    M.map(function(m){ return '<td class="r4c num">'+lead[m.id]+' / '+help[m.id]+'</td>'; }).join('')+
    '<td colspan="'+(3+(adm?1:0))+'"></td></tr>');
  tb.querySelector('tbody').innerHTML=out.join('')||'<tr><td class="empty">No tasks yet.</td></tr>';
  if($('r4-count')) $('r4-count').textContent=plural(M.length,'R4')+' · '+plural(R4.tasks.length,'task')+
    (open?' · '+open+' with nobody assigned':'');
  if($('r4-adminhint')) $('r4-adminhint').textContent=adm?' Tap a dot to switch between Main, Assist and nobody; text saves when you leave the box.':
    (dots?' Tap a dot to switch between Main, Assist and nobody.':'');
  var box=$('r4-admin');
  if(box){
    box.hidden=!adm;
    if(adm) $('r4-mlist').innerHTML=M.map(function(m){
      return '<div class="r4mrow"><input type="text" maxlength="30" data-r4m="'+m.id+'" value="'+esc(m.name)+'" aria-label="'+esc('Rename '+m.name)+'">'+
        '<button type="button" class="r4btn ghost" data-r4="delmem" data-m="'+m.id+'">Remove</button></div>';
    }).join('');
  }
  applyFilters();
}
async function loadR4(force){
  if(R4.loading||(R4.loaded&&!force)) return;
  R4.loading=true;
  if(!R4.loaded) r4Msg('Loading…');
  try{
    var r=await Promise.all([
      SB.from('r4_members').select('*').order('sort').order('id'),
      SB.from('r4_tasks').select('*').order('sort').order('id')]);
    var e=r[0].error||r[1].error;
    if(e){ r4Msg('Could not load the R4 roles — '+esc(e.message)); return; }
    R4.members=r[0].data||[];
    R4.tasks=(r[1].data||[]).map(function(t){ t.roles=t.roles||{}; return t; });
    R4.loaded=true; renderR4();
  }catch(err){ r4Msg('Could not reach the server. Try the tab again.'); }
  finally{ R4.loading=false; }
}
function r4Refocus(sel){ var el=document.querySelector(sel); if(el) el.focus(); }
function r4Cycle(tid,mid){
  var t=r4Task(tid); if(!t) return;
  var cur=t.roles[mid], next=!cur?'main':(cur==='main'?'assist':null), r={};
  Object.keys(t.roles).forEach(function(k){ r[k]=t.roles[k]; });
  if(next) r[mid]=next; else delete r[mid];
  t.roles=r; renderR4();
  r4Refocus('#r4 [data-r4="cycle"][data-t="'+tid+'"][data-m="'+mid+'"]');
  /* One dot at a time on the server, so two people editing different dots never
     overwrite each other, and an R4 editor can change nothing but the roles. */
  queue('r4r'+tid+'-'+mid,function(){ return SB.rpc('set_r4_role',{task_id:tid,member_id:+mid,new_role:next}); });
}
function r4Field(el){
  var t=r4Task(+el.dataset.t); if(!t) return;
  var f=el.dataset.r4f, v=el.value.trim();
  if(f==='name'&&!v){ el.value=t.name; say('A task needs a name.',1); return; }
  if(t[f]===v) return;
  t[f]=v;
  var patch={}; patch[f]=v;
  queue('r4f'+t.id+f,function(){ return SB.from('r4_tasks').update(patch).eq('id',t.id); });
}
async function r4AddTask(sec){
  var list=R4.tasks.filter(function(t){ return t.section===sec; });
  var sort=list.length?list[list.length-1].sort+1:(R4.tasks.length?R4.tasks[R4.tasks.length-1].sort+10:10);
  say('saving…');
  var r=await SB.from('r4_tasks').insert({section:sec,name:'New task',sort:sort}).select().single();
  if(r.error){ say('Not saved — '+r.error.message,1); return; }
  r.data.roles=r.data.roles||{};
  R4.tasks.push(r.data);
  R4.tasks.sort(function(a,b){ return a.sort-b.sort||a.id-b.id; });
  renderR4(); say('saved');
  var el=document.querySelector('#r4 input[data-r4f="name"][data-t="'+r.data.id+'"]');
  if(el){ el.focus(); el.select(); }
}
async function r4DelTask(tid){
  var t=r4Task(tid); if(!t||!window.confirm('Remove "'+t.name+'" from the R4 roles?')) return;
  say('saving…');
  var r=await SB.from('r4_tasks').delete().eq('id',tid);
  if(r.error){ say('Not removed — '+r.error.message,1); return; }
  R4.tasks=R4.tasks.filter(function(x){ return x.id!==tid; });
  renderR4(); say('saved');
}
async function r4AddMember(){
  var el=$('r4-newname'), v=el?el.value.trim():'';
  if(!v){ say('Type the new R4’s name first.',1); return; }
  say('saving…');
  var sort=R4.members.length?R4.members[R4.members.length-1].sort+10:10;
  var r=await SB.from('r4_members').insert({name:v,sort:sort}).select().single();
  if(r.error){ say('Not saved — '+r.error.message,1); return; }
  R4.members.push(r.data); el.value='';
  renderR4(); say('saved');
}
async function r4DelMember(mid){
  var nm=r4Name(mid);
  if(!window.confirm('Remove '+nm+' from the R4 list? Their dots are cleared from every task.')) return;
  say('saving…');
  var held=R4.tasks.filter(function(t){ return t.roles[mid]; });
  var ops=held.map(function(t){
    var r={}; Object.keys(t.roles).forEach(function(k){ if(k!==String(mid)) r[k]=t.roles[k]; });
    return SB.from('r4_tasks').update({roles:r}).eq('id',t.id).then(function(x){ if(!x.error) t.roles=r; return x; });
  });
  var res=await Promise.all(ops);
  var bad=res.find(function(x){ return x.error; });
  if(bad){ say('Not removed — '+bad.error.message,1); renderR4(); return; }
  var d=await SB.from('r4_members').delete().eq('id',mid);
  if(d.error){ say('Not removed — '+d.error.message,1); renderR4(); return; }
  R4.members=R4.members.filter(function(m){ return String(m.id)!==String(mid); });
  renderR4(); say('saved');
}
function r4Rename(el){
  var mid=+el.dataset.r4m, v=el.value.trim(), m=null;
  R4.members.forEach(function(x){ if(x.id===mid) m=x; });
  if(!m) return;
  if(!v){ el.value=m.name; say('A name cannot be empty.',1); return; }
  if(m.name===v) return;
  m.name=v; renderR4();
  queue('r4m'+mid,function(){ return SB.from('r4_members').update({name:v}).eq('id',mid); });
}
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('#p-r4 [data-r4]'); if(!b||!R4ED) return;
  var a=b.getAttribute('data-r4');
  if(a==='edit'){ R4_EDIT=!R4_EDIT; renderR4(); return; }
  if(!R4_EDIT) return;
  if(a!=='cycle'&&!ADMIN) return;
  if(a==='cycle') r4Cycle(+b.dataset.t,b.dataset.m);
  else if(a==='deltask') r4DelTask(+b.dataset.t);
  else if(a==='addtask') r4AddTask(b.dataset.s);
  else if(a==='addmem') r4AddMember();
  else if(a==='delmem') r4DelMember(+b.dataset.m);
});
document.addEventListener('change',function(e){
  var el=e.target; if(!ADMIN||!el.matches) return;
  if(el.matches('#p-r4 input[data-r4f]')) r4Field(el);
  else if(el.matches('#p-r4 input[data-r4m]')) r4Rename(el);
});
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&e.target.id==='r4-newname'){ e.preventDefault(); r4AddMember(); }
});

/* ---------- what's new ----------
   Newest first. Add an entry with every change members will notice. Each id must be
   new, because the newest id a member has closed is what marks the rest as seen. */
var UPDATES=[
  {id:'2026-09-28-r4ed',date:'2026-09-28',title:'R4 editors',points:[
    'Adrian can now let chosen members update who does which R4 task.',
    'If that is you, you will see an Edit roles button on the R4 roles tab. Tap a dot to switch between Main, Assist and nobody.']},
  {id:'2026-09-27-r4',date:'2026-09-27',title:'New R4 roles tab',points:[
    'See who leads each alliance task and who backs them up, grouped the same way as our leadership sheet.',
    'Event times are shown in UTC and in your own time.',
    'Search a name to see everything one R4 looks after.']},
  {id:'2026-09-27-freeday',date:'2026-09-27',title:'Free / day is now measured from your own updates',points:[
    'Each time you save your Backpack, the tracker quietly notes your Have for that day. Nobody else can see it.',
    'Free / day comes from how your Have grows over your last 3 months, so it keeps up as your daily income changes.',
    'Items from packs you have bought are taken out, so only free income counts.',
    'Until you have 3 days of updates, you will see your old starting estimate, faded.']},
  {id:'2026-09-27-bought',date:'2026-09-27',title:'Packs are no longer counted twice',points:[
    'The number on Things to buy is now "Bought": the packs you have already bought.',
    'What they gave you is already in your Have, so Projected is now Have plus Free / day until SvS day.',
    'Some items may now show as behind. That is the corrected figure, not a mistake.']},
  {id:'2026-09-23-fold',date:'2026-09-23',title:'Things to buy folds by section',points:[
    'Tap a section or group heading to fold it away. The tracker remembers what you folded.']},
  {id:'2026-09-21-header',date:'2026-09-21',title:'More room on phones',points:[
    'The top bar slides away as you scroll down, and comes straight back when you scroll up a little.']},
  {id:'2026-09-21-art',date:'2026-09-21',title:'Item pictures',points:[
    'Most items now show their in-game picture in the Backpack and on the Dashboard.']}
];
var NEWS_KEY='fox-news-seen';
function newsHtml(list){
  return list.map(function(u){
    return '<article class="nitem"><time datetime="'+esc(u.date)+'">'+esc(prettyDay(u.date)+' '+u.date.slice(0,4))+'</time>'+
      '<h3>'+esc(u.title)+'</h3><ul>'+u.points.map(function(p){ return '<li>'+esc(p)+'</li>'; }).join('')+'</ul></article>';
  }).join('');
}
function markNewsSeen(){ try{ if(UPDATES.length) localStorage.setItem(NEWS_KEY,UPDATES[0].id); }catch(e){} }
function openNews(list){
  var d=$('news'); if(!d||!list.length) return;
  $('news-list').innerHTML=newsHtml(list);
  $('news-list').scrollTop=0;
  $('news-all').hidden=list.length>=UPDATES.length;
  if(d.showModal){ if(!d.open) d.showModal(); } else d.setAttribute('open','');
}
function closeNews(){
  var d=$('news'); if(!d) return;
  markNewsSeen();
  if(d.close&&d.open) d.close(); else d.removeAttribute('open');
}
/* Shows only what this member has not closed yet. Someone arriving for the first
   time gets the latest three rather than the whole history. */
function maybeShowNews(){
  if(!UPDATES.length) return;
  var seen;
  try{ seen=localStorage.getItem(NEWS_KEY); }catch(e){ return; }  /* no storage: never nag */
  if(seen===UPDATES[0].id) return;
  var i=-1;
  for(var k=0;k<UPDATES.length;k++) if(UPDATES[k].id===seen){ i=k; break; }
  openNews(i>0?UPDATES.slice(0,i):UPDATES.slice(0,3));
}
function wireNews(){
  var d=$('news'); if(!d) return;
  $('news-x').addEventListener('click',closeNews);
  $('news-ok').addEventListener('click',closeNews);
  $('news-all').addEventListener('click',function(){ openNews(UPDATES); });
  /* Escape closes a dialog natively; it still counts as having seen it. */
  d.addEventListener('close',markNewsSeen);
  /* A tap on the dimmed backdrop lands on the dialog itself, not on its box. */
  d.addEventListener('click',function(e){ if(e.target===d) closeNews(); });
  if($('news-open')) $('news-open').addEventListener('click',function(){ openNews(UPDATES); });
}

async function loadHistory(){
  HIST=[]; HIST_OK=false;
  try{
    var h=await SB.from('stock_history').select('day,have,packs').eq('user_id',U.id).order('day');
    if(!h.error){
      HIST=(h.data||[]).map(function(r){ return {day:String(r.day).slice(0,10),have:r.have||{},packs:r.packs||{}}; });
      HIST_OK=true;
    }
  }catch(e){}
  recomputeFree();
  /* The first visit starts the clock, so a member does not have to edit anything
     before measuring begins. */
  if(HIST_OK&&!HIST.length&&D.items.length) noteSnapshot();
}
function pcolor(p){ if(p===null) return 'var(--faint)';
  if(p>=1) return 'var(--good)'; if(p>=.75) return 'var(--ice)';
  if(p>=.5) return '#C79A16'; return 'var(--ember)'; }

/* ---------- saving ---------- */
function queue(key,fn){
  clearTimeout(timers[key]); say('saving…');
  timers[key]=setTimeout(function(){
    fn().then(function(r){
      if(r&&r.error){ say('Not saved — check your connection, then change the number again.',1); }
      else say('saved');
    }).catch(function(e){ say('Not saved — check your connection, then change the number again.',1); });
  },500);
}
function saveItem(it,field){
  var patch={}; patch[field]=n(it[field]);
  queue('i'+it.sort+field,function(){
    return SB.from('user_items').update(patch).eq('sort',it.sort).eq('user_id',U.id);
  });
  if(field==='have') noteSnapshot();
}
function savePack(id,freq){
  queue('p'+id,function(){
    return SB.from('user_packs').update({freq:n(freq)}).eq('pack_id',id).eq('user_id',U.id);
  });
  noteSnapshot();
}

/* ---------- rendering ---------- */
/* In-game artwork. Unmatched items keep their existing icon. */
var ITEM_ART = {
  "Fire Crystals": "item-fire-crystals.png",
  "Refined Fire Crystals": "item-refined-fire-crystals.png",
  "Fire Crystal Shards": "item-fire-crystal-shards.png",
  "Stamina Cans": "item-stamina-cans.png",
  "General Expert Sigils": "item-general-expert-sigils.png",
  "Ciryl Sigils": "item-ciryl-sigils.png",
  "Agnes Sigils": "item-agnes-sigils.png",
  "Holger Sigils": "item-holger-sigils.png",
  "Romulus Sigils": "item-romulus-sigils.png",
  "Baldur Sigils": "item-baldur-sigils.png",
  "Fabian Sigils": "item-fabian-sigils.png",
  "Valeria Sigils": "item-valeria-sigils.png",
  "Ronne Sigils": "item-ronne-sigils.png",
  "Kathy Sigils": "item-kathy-sigils.png",
  "Books of Knowledge": "item-books-of-knowledge.png",
  "Advanced Wild Marks": "item-advanced-wild-marks.png",
  "Common Wild Marks": "item-common-wild-marks.png",
  "Energizing Potions": "item-energizing-potions.png",
  "Taming Manuals": "item-taming-manuals.png",
  "Strengthening Serum": "item-strengthening-serum.png",
  "Charm Designs": "item-charm-designs.png",
  "Charm Guides": "item-charm-guides.png",
  "Hardened Alloy": "item-hardened-alloy.png",
  "Polishing Solution": "item-polishing-solution.png",
  "Design Plans": "item-design-plans.png",
  "Lunar Amber": "item-lunar-amber.png",
  "Mithril": "item-mithril.png",
  "Essence Stones": "item-essence-stones.png",
  "Mythic Hero Shards": "item-mythic-hero-shards.png",
  "Epic Hero Shards": "item-epic-hero-shards.png",
  "Rare Hero Shards": "item-rare-hero-shards.png",
  "Gems": "item-gems.png",
  "General Speedups": "item-general-speedups.png",
  "Training Speedups": "item-training-speedups.png",
  "Construction Speedups": "item-construction-speedups.png",
  "Research Speedups": "item-research-speedups.png",
  "Expert Skill Learning Speedups": "item-expert-skill-learning-speedups.png",
  "Healing Speedups": "item-healing-speedups.png"
};
function itemIcon(it){
  var src=ITEM_ART[it.name];
  return src ? '<img class="item-art" src="'+esc(src)+'" alt="" width="24" height="24" decoding="async">' : esc(it.icon||'·');
}
function inp(val,cls,attrs){
  return '<input class="cell '+(cls||'')+'" type="number" step="any" value="'+
    (val===null||val===undefined?'':val)+'" '+(attrs||'')+'>';
}
function renderStock(){
  /* Count each group first so its header can say how much of it you have filled in. */
  var stats={};
  D.items.forEach(function(it){
    var k=it.grp||'';
    if(!stats[k]) stats[k]={n:0,f:0};
    stats[k].n++; if(n(it.have)>0) stats[k].f++;
  });
  var out=[], g=null;
  D.items.forEach(function(it,idx){
    if(it.grp!==g){
      g=it.grp;
      var st=stats[g]||{n:0,f:0}, pc=st.n?Math.round(st.f/st.n*100):0, open=!FOLD[g];
      out.push('<tr class="grp"><td colspan="9">'+
        '<button class="gtog" type="button" data-gname="'+esc(g)+'" aria-expanded="'+open+'">'+
        '<span class="chev" aria-hidden="true"></span>'+
        '<span class="gname">'+esc(g)+'</span>'+
        '<span class="gmeta"><span class="gbar"><i style="width:'+pc+'%"></i></span>'+
        '<span class="gcount">'+st.f+'/'+st.n+'</span></span></button></td></tr>');
    }
    var c=calcItem(it);
    var state=c.tgt<=0?'none':(c.ok?'met':'behind');
    var pill=c.tgt<=0?'<span class="pill p-na">no target</span>'
      :(c.ok?'<span class="pill p-yes">on track</span>':'<span class="pill p-no">behind</span>');
    var w=c.pct===null?0:Math.max(0,Math.min(100,c.pct*100));
    /* the pill already says "on track"; only the shortfall adds anything */
    var rc=(c.tgt>0 && !c.ok && c.left>0)?fmt(c.left)+' short by SvS day':'';
    out.push('<tr data-state="'+state+'" data-q="'+esc(it.name.toLowerCase())+'" data-gn="'+esc(g)+'">'+
      '<td class="ic">'+itemIcon(it)+'</td><td class="nm">'+esc(it.name)+'</td>'+
      '<td data-label="Have">'+inp(it.have,'','data-idx="'+idx+'" data-k="have" aria-label="'+esc(it.name)+' have"')+'</td>'+
      '<td data-label="Target">'+inp(it.target,'t2','data-idx="'+idx+'" data-k="target" aria-label="'+esc(it.name)+' target"')+'</td>'+
      '<td class="num">'+(c.tgt>0?fmt(c.raw):'<span class="mini">\u2014</span>')+'</td>'+
      '<td><div class="prog"><div class="pbar"><i style="width:'+w.toFixed(1)+'%;background:'+pcolor(c.pct)+'"></i></div>'+
        '<span>'+(c.pct===null?'\u2014':Math.round(c.pct*100)+'%')+'</span></div></td>'+
      '<td class="num">'+freeCell(it)+'</td>'+
      '<td class="num">'+fmt(c.proj)+'</td>'+
      '<td>'+pill+'<div class="rc">'+esc(rc)+'</div></td></tr>');
  });
  $('stock').querySelector('tbody').innerHTML=out.join('');
}
function packRank(v){ return {'Must buy':4,'Item buy':3,'Worth checking':2,'Last resort':1,'—':0}[v]||0; }
function renderPacks(){
  var byName=itemMap(), out=[], sec=null, grp=null;
  var priceTh=document.querySelector('#packs thead th[data-sort="price"]');
  if(priceTh) priceTh.setAttribute('data-label','Price '+CUR.symbol);
  var VP={'Event pack':'p-pack','Must buy':'p-gold','Item buy':'p-item','Worth checking':'p-pack','Last resort':'p-low','—':'p-na'};
  var list=D.packs.map(function(p,i){ return {p:p,i:i,c:calcPack(p,byName)}; });
  if(sortMode!=='section'){
    var key=function(o){
      switch(sortMode){
        case 'name':    return o.p.name.toLowerCase();
        case 'price':   return n(o.p.price);
        case 'freq':    return n(uPacks[o.p.id]);
        case 'pv':      return n(o.c.pv);
        case 'iv':      return n(o.c.iv);
        case 'verdict': return packRank(o.c.verdict);
      }
      return 0; };
    list.sort(function(a,b){ var x=key(a),y=key(b);
      if(x<y) return -sortDir; if(x>y) return sortDir; return a.i-b.i; });
  }
  list.forEach(function(o){
    var p=o.p, c=o.c;
    if(sortMode==='section'){
      if(p.sec!==sec){ sec=p.sec; grp=null; out.push('<tr class="sec"><td colspan="8"><button class="gtog" type="button" data-psection="'+esc(sec)+'" aria-expanded="'+(!PACK_FOLD[sec])+'"><span class="chev" aria-hidden="true"></span><span class="gname">'+esc(sec)+'</span></button></td></tr>'); }
      if(p.grp!==grp){ grp=p.grp; out.push('<tr class="grp" data-psection="'+esc(sec)+'"><td colspan="8"><button class="gtog" type="button" data-psection="'+esc(sec)+'" data-pgroup="'+esc(sec+'|'+grp)+'" aria-expanded="'+(!PACK_FOLD[sec+'|'+grp])+'"><span class="chev" aria-hidden="true"></span><span class="gname">'+esc(grp)+'</span></button></td></tr>'); }
    }
    function vb(v,col){ if(!(v>0)) return '<span class="mini">—</span>';
      return '<span class="vbar"><i style="width:'+Math.min(100,v/300*100).toFixed(0)+'%;background:'+col+'"></i></span>'+
             '<span class="mono">'+Math.round(v)+'%</span>'; }
    var k=c.verdict==='Must buy'?'golden':(c.verdict==='Item buy'?'item':(c.verdict==='Worth checking'?'pack':'low'));
    if(n(uPacks[p.id])>0) k+=' buying';
    out.push('<tr data-pgroup="'+esc(p.sec+'|'+p.grp)+'" data-psection="'+esc(p.sec)+'" data-state="'+k+'" data-q="'+esc((p.name+' '+p.grp).toLowerCase())+'">'+
      '<td class="ic">'+esc(p.icon||'·')+'</td>'+
      '<td class="nm">'+esc(p.name)+'<div class="mini">'+
        esc(sortMode==='section'?(p.occurrence||''):((p.grp||'')+(p.occurrence?' · '+p.occurrence:'')))+'</div></td>'+
      '<td class="num" data-label="Price '+esc(CUR.symbol)+'">'+fmt(n(p.price)*CUR.rate,2)+'</td>'+
      '<td data-label="Bought">'+inp(uPacks[p.id]||0,'t2','data-pid="'+p.id+'" aria-label="'+esc(p.name)+' packs bought so far'+'"')+(moonlightPack(p)?'<div class="mini">per event</div>':'')+'</td>'+
      '<td data-label="Best item for you">'+(c.best?esc(c.best):'<span class="mini">'+(moonlightPack(p)?'Event rewards':(c.scoreable?'—':'contents not priced'))+'</span>')+'</td>'+
      '<td class="num" data-label="Pack value">'+vb(c.pv,'var(--ice)')+'</td>'+
      '<td class="num" data-label="Best item">'+vb(c.iv,'var(--ember)')+'</td>'+
      '<td><span class="pill '+VP[c.verdict]+'">'+esc(c.verdict)+'</span></td></tr>');
  });
  $('packs').querySelector('tbody').innerHTML=out.join('');
  [].forEach.call(document.querySelectorAll('#packs thead th[data-sort]'),function(th){
    var on=th.getAttribute('data-sort')===sortMode;
    th.setAttribute('aria-sort', on?(sortDir===1?'ascending':'descending'):'none');
    th.innerHTML=th.getAttribute('data-label')+(on?'<i class="arr">'+(sortDir===1?'▲':'▼')+'</i>':'<i class="arr"></i>');
  });
  var b=$('c-section');
  if(b){ var sorted=sortMode!=='section';
    b.setAttribute('aria-pressed',String(!sorted)); b.classList.toggle('act',sorted);
    b.textContent = sorted ? '✕ Reset sort' : 'Grouped by section'; }
}
function renderMatrix(){
  var byName=itemMap();
  var cols=D.items.filter(function(i){ return D.base[i.name]!==undefined; }).map(function(i){ return i.name; });
  D.packs.forEach(function(p){ if(moonlightPack(p)) Object.keys(D.contents[p.id]||{}).forEach(function(k){ if(cols.indexOf(k)<0) cols.push(k); }); });
  $('matrix').querySelector('thead').innerHTML='<tr><th>Pack</th>'+
    cols.map(function(c){ return '<th class="num">'+esc(c)+'</th>'; }).join('')+'</tr>';
  var out=['<tr class="need"><td>Still short</td>'+cols.map(function(c){
    var it=byName[c], r=it?calcItem(it).raw:0;
    return '<td class="num">'+(r?fmt(r):'<span class="mini">0</span>')+'</td>'; }).join('')+'</tr>'];
  D.packs.forEach(function(p){
    var c=D.contents[p.id]||{};
    out.push('<tr data-q="'+esc((p.name+' '+p.grp).toLowerCase())+'"><td>'+esc(p.name)+
      ' <span class="mini">'+money(n(p.price))+'</span></td>'+
      cols.map(function(col){
        return '<td class="num">'+(c[col]===undefined?'<span class="mini">·</span>':fmt(n(c[col])))+'</td>';
      }).join('')+'</tr>');
  });
  $('matrix').querySelector('tbody').innerHTML=out.join('');
}
function renderRef(){
  var keys=Object.keys(D.base).sort();
  $('baselines').innerHTML=keys.map(function(k){
    return '<div class="frow"><span>'+esc(k)+'</span><b class="mono">'+D.base[k]+'</b></div>'; }).join('');
  $('svsdate').textContent=D.settings.next_svs||'—';
  $('murrate').textContent=D.settings.mur||63.4;
}
/* ---------- members (admin only) ---------- */
function plural(n,w){ return n+' '+w+(n===1?'':'s'); }
function fmtDate(iso){
  if(!iso) return '\u2014';
  var d=new Date(iso); if(isNaN(d)) return '\u2014';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
/* One phrase and one colour per member, so the list reads at a glance rather than
   by comparing timestamps. */
function ago(iso){
  if(!iso) return {text:'never',tone:'gone'};
  var t=new Date(iso); if(isNaN(t)) return {text:'never',tone:'gone'};
  var mins=Math.floor((Date.now()-t.getTime())/60000);
  if(mins<0) mins=0;
  if(mins<2) return {text:'just now',tone:'now'};
  if(mins<60) return {text:plural(mins,'minute')+' ago',tone:'now'};
  var hrs=Math.floor(mins/60);
  if(hrs<24) return {text:plural(hrs,'hour')+' ago',tone:'now'};
  var d=Math.floor(hrs/24);
  if(d===1) return {text:'yesterday',tone:'week'};
  if(d<7) return {text:plural(d,'day')+' ago',tone:'week'};
  if(d<30) return {text:plural(Math.floor(d/7),'week')+' ago',tone:'slow'};
  return {text:plural(Math.floor(d/30),'month')+' ago',tone:'gone'};
}
var TONE={now:['p-yes','active today'],week:['p-item','this week'],
          slow:['p-gold','quiet'],gone:['p-na','gone quiet']};
var MEMBERS=[];
function renderMembers(rows){
  var t=$('members'); if(!t) return;
  MEMBERS=rows;
  rows=rows.slice().sort(function(a,b){
    var x=a.last_seen?new Date(a.last_seen).getTime():-1;
    var y=b.last_seen?new Date(b.last_seen).getTime():-1;
    return y-x; });
  var active=0;
  var out=rows.map(function(m){
    var a=ago(m.last_seen), tn=TONE[a.tone];
    if(a.tone==='now'||a.tone==='week') active++;
    var nm=String(m.name||'').trim()||String(m.email||'').split('@')[0]||'\u2014';
    return '<tr data-q="'+esc((nm+' '+(m.email||'')).toLowerCase())+'">'+
      '<td class="nm">'+esc(nm)+
        (m.is_admin?' <span class="pill p-pack">admin</span>':'')+'</td>'+
      '<td data-label="Email"><span class="mail">'+esc(m.email||'\u2014')+'</span></td>'+
      '<td class="num" data-label="Signed up">'+esc(fmtDate(m.created_at))+'</td>'+
      '<td class="num" data-label="Last seen">'+esc(a.text)+'</td>'+
      '<td class="st"><span class="pill '+tn[0]+'">'+tn[1]+'</span></td>'+
      '<td class="r4e">'+(m.is_admin?'':'<button type="button" class="chip" data-r4ed="'+esc(m.id)+'" aria-pressed="'+!!m.r4_editor+
        '" aria-label="'+esc(nm+' can edit R4 roles')+'">R4 editor</button>')+'</td></tr>';
  }).join('');
  t.querySelector('tbody').innerHTML=out||'<tr><td colspan="6" class="empty">Nobody has signed up yet.</td></tr>';
  if($('admin-count')) $('admin-count').textContent=plural(rows.length,'member')+' \u00b7 '+active+' active this week';
  applyFilters();
}
function membersMsg(html){
  var t=$('members'); if(t) t.querySelector('tbody').innerHTML='<tr><td colspan="6" class="empty">'+html+'</td></tr>';
}
/* Only the admin can name R4 editors: the server function refuses anyone else. */
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('#members [data-r4ed]'); if(!b||!ADMIN) return;
  var id=b.getAttribute('data-r4ed'), m=null;
  MEMBERS.forEach(function(x){ if(String(x.id)===id) m=x; });
  if(!m) return;
  m.r4_editor=!m.r4_editor; b.setAttribute('aria-pressed',String(m.r4_editor));
  queue('r4ed'+id,function(){ return SB.rpc('set_r4_editor',{target:id,on_off:!!m.r4_editor}); });
});
async function loadMembers(force){
  if(!ADMIN) return;
  if(membersLoaded&&!force) return;
  if(!membersLoaded) membersMsg('Loading\u2026');
  try{
    var r=await SB.from('profiles').select('id,name,email,created_at,last_seen,is_admin,r4_editor');
    if(r.error){ membersMsg('Could not load the member list \u2014 '+esc(r.error.message)); return; }
    membersLoaded=true; renderMembers(r.data||[]);
  }catch(e){ membersMsg('Could not reach the server. Try the tab again.'); }
}
/* The name came from the sign-up form and was never editable afterwards, so a typo
   or an in-game rename was permanent. The account's own metadata stays the source of
   truth: the copy in profiles is refreshed from it on every load. */
function dispMsg(t){ var e=$('dispname-msg'); if(e) e.textContent=t||'\u00a0'; }
function saveDisplayName(){
  var el=$('dispname'); if(!el||!U||!SB) return;
  var v=el.value.trim().slice(0,40);
  if(!v){ dispMsg('Your name cannot be empty.'); return; }
  dispMsg('\u00a0');
  queue('dispname',function(){
    return SB.auth.updateUser({data:{name:v}}).then(function(r){
      if(r&&r.error) return r;
      U.user_metadata=U.user_metadata||{}; U.user_metadata.name=v;
      var av=$('avatar'); if(av) av.textContent=initials(U.email,v);
      membersLoaded=false;
      /* best effort: the admin list reads this copy, but the name is already saved
         on the account even if this table has not been set up yet */
      return SB.from('profiles').update({name:v}).eq('id',U.id)
        .then(function(){ return {error:null}; },function(){ return {error:null}; });
    });
  });
}

/* Everyone stamps their own row on the way in, which is what makes "last seen" work
   with no server-side job. The admin flag is never written from the browser. */
function touchProfile(){
  if(!U||!SB) return;
  var meta=U.user_metadata||{};
  try{
    SB.from('profiles').update({email:U.email||null,
      name:String(meta.name||'').trim()||null,
      last_seen:new Date().toISOString()}).eq('id',U.id).then(function(){},function(){});
  }catch(e){}
}
/* Asked for on its own so a project without the admin column simply answers "no"
   and the tab stays hidden, rather than breaking the whole load. */
function checkAdmin(){
  if(!U||!SB) return;
  try{
    SB.from('profiles').select('is_admin,r4_editor').eq('id',U.id).maybeSingle().then(function(r){
      ADMIN=!!(r&&r.data&&r.data.is_admin);
      R4ED=ADMIN||!!(r&&r.data&&r.data.r4_editor);
      var at=$('tab-admin'); if(at) at.hidden=!ADMIN;
      if(R4.loaded) renderR4();
      /* A refresh on the Members tab clicks it before this answer arrives, so the
         list is fetched here once admin rights are known. */
      var pa=$('p-admin'); if(ADMIN&&pa&&pa.classList.contains('on')) loadMembers();
    },function(){});
  }catch(e){}
}

function renderTop(){
  var withT=0,met=0,sum=0,behind=0;
  D.items.forEach(function(it){ var c=calcItem(it);
    if(c.tgt>0){ withT++; sum+=Math.min(c.have/c.tgt,1); if(c.have>=c.tgt) met++; if(!c.ok) behind++; } });
  var byName=itemMap(), gold=0, marked=0;
  D.packs.forEach(function(p){ if(n(uPacks[p.id])>0) marked++;
    if(calcPack(p,byName).verdict==='Must buy') gold++; });
  var avg=withT?sum/withT:0, bud=budget(), dleft=days();
  var metPct=(withT?met/withT*100:0), avgPct=avg*100;
  $('stats').innerHTML=
    '<div class="stat c-blue"><span class="sicon">'+ICO.target+'</span><span class="lbl">Targets met</span>'+
    '<b>'+met+' / '+withT+'</b><small>'+behind+' behind by SvS day</small>'+
    '<div class="barrow"><div class="bar"><i style="width:'+metPct.toFixed(0)+'%;background:var(--ice)"></i></div>'+
    '<span class="barpct" style="color:var(--ice)">'+Math.round(metPct)+'%</span></div></div>'+
    '<div class="stat c-green"><span class="sicon">'+ICO.bars+'</span><span class="lbl">Average progress</span>'+
    '<b>'+Math.round(avg*100)+'%</b><small>across '+withT+' targets</small>'+
    '<div class="barrow"><div class="bar"><i style="width:'+avgPct.toFixed(0)+'%;background:var(--good)"></i></div>'+
    '<span class="barpct" style="color:var(--good)">'+Math.round(avgPct)+'%</span></div></div>'+
    '<div class="stat c-violet"><span class="sicon">'+ICO.coins+'</span><span class="lbl">Spent so far</span>'+
    '<b>'+money(bud)+'</b><small>'+esc(CUR.code)+'</small></div>'+
    '<div class="stat c-orange"><span class="sicon">'+ICO.box+'</span><span class="lbl">Packs bought</span>'+
    '<b>'+marked+'</b><small>of '+D.packs.length+' &middot; '+gold+' must buy</small></div>'+
    '<div class="stat svs"><span class="lbl">Days to next SvS</span>'+
    '<b>'+dleft+'</b><span class="date">'+ICO.calendar+esc(D.settings.next_svs||'')+'</span></div>';
  $('c-all').textContent='All '+D.items.length;
  $('c-behind').textContent='Behind ('+behind+')';
  $('c-pall').textContent='All '+D.packs.length;
  $('c-gold').textContent='Must buy ('+gold+')';
  $('c-buying').textContent='Bought ('+marked+')';
}
function dbar(pct,col){
  return '<div class="dbar"><i style="width:'+Math.max(1.5,Math.min(100,pct)).toFixed(1)+'%;background:'+col+'"></i></div>'; }
function dashRow(rank,it,c,tone,right,sub){
  return '<li class="drow '+tone+'"><span class="rank">'+rank+'</span>'+
    '<span class="dic">'+itemIcon(it)+'</span>'+
    '<span class="dname">'+esc(it.name)+'<em>'+esc(sub)+'</em></span>'+
    '<span class="dbarwrap">'+dbar(c.pct===null?0:c.pct*100, tone==='up'?'var(--good)':'var(--ember)')+'</span>'+
    '<b class="dval">'+right+'</b></li>'; }
function renderDash(){
  var withT=D.items.map(function(it){ return {it:it,c:calcItem(it)}; }).filter(function(o){ return o.c.tgt>0; });
  /* A target already hit is finished business. Both cards are about what is still
     open, so anything at or past 100% drops out of the ranking entirely. */
  var open=withT.filter(function(o){ return o.c.pct<1; });
  var byPct=open.slice().sort(function(a,b){ return b.c.pct-a.c.pct; });
  var closest=byPct.slice(0,5);
  $('d-top').innerHTML=closest.map(function(o,i){
    return dashRow(i+1,o.it,o.c,'up',Math.round(o.c.pct*100)+'%',fmt(o.c.raw)+' to go'); }).join('')
    || (withT.length?'<li class="dempty">Every target met \u2014 nothing left to close.</li>'
                    :'<li class="dempty">No targets set yet.</li>');
  /* Taking the worst from what the card above did not already show keeps an item
     from appearing as both the best and the worst when few targets are open. */
  var rest=byPct.slice(closest.length);
  $('d-bot').innerHTML=rest.slice().reverse().slice(0,5).map(function(o,i){
    return dashRow(i+1,o.it,o.c,'down',Math.round(o.c.pct*100)+'%',fmt(o.c.raw)+' short'); }).join('')
    || (!withT.length?'<li class="dempty">No targets set yet.</li>'
       :(open.length?'<li class="dempty">Everything still open is listed above.</li>'
                    :'<li class="dempty">Every target met \u2014 nothing left to close.</li>'));
  var gaps=withT.filter(function(o){ return o.c.raw>0 && D.base[o.it.name]; })
    .map(function(o){ return {it:o.it,c:o.c,usd:o.c.raw*n(D.base[o.it.name])}; })
    .sort(function(a,b){ return b.usd-a.usd; }).slice(0,5);
  var mx=gaps.length?gaps[0].usd:1;
  $('d-gap').innerHTML=gaps.map(function(o,i){
    return '<li class="drow down"><span class="rank">'+(i+1)+'</span>'+
      '<span class="dic">'+itemIcon(o.it)+'</span>'+
      '<span class="dname">'+esc(o.it.name)+'<em>'+fmt(o.c.raw)+' short</em></span>'+
      '<span class="dbarwrap">'+dbar(o.usd/mx*100,'var(--violet)')+'</span>'+
      '<b class="dval">'+baseMoney(o.usd)+'</b></li>'; }).join('')
    || '<li class="dempty">Nothing outstanding.</li>';
  var byName=itemMap();
  var buys=D.packs.map(function(p){ return {p:p,c:calcPack(p,byName)}; })
    .filter(function(o){ return o.c.iv>0; }).sort(function(a,b){ return b.c.iv-a.c.iv; }).slice(0,5);
  $('d-buy').innerHTML=buys.map(function(o,i){
    var tone=o.c.verdict==='Must buy'?'p-gold':(o.c.verdict==='Item buy'?'p-item':'p-pack');
    return '<li class="drow"><span class="rank">'+(i+1)+'</span>'+
      '<span class="dname">'+esc(o.p.name)+'<em>'+esc(o.c.best||'')+' · '+money(n(o.p.price))+'</em></span>'+
      '<span class="dbarwrap">'+dbar(Math.min(100,o.c.iv/300*100),'var(--ember)')+'</span>'+
      '<b class="dval">'+Math.round(o.c.iv)+'%</b>'+
      '<span class="pill '+tone+'">'+esc(o.c.verdict)+'</span></li>'; }).join('')
    || '<li class="dempty">Nothing scores yet — set some targets.</li>';
}
function focusKey(el){ if(!el||!el.dataset) return null;
  return [el.dataset.idx,el.dataset.pid,el.dataset.k].join('|'); }
function render(){
  var key=focusKey(document.activeElement);
  renderSvsWarn(); renderFreeNote();
  renderTop(); renderDash(); renderStock(); renderPacks(); renderMatrix(); renderRef(); applyFilters(); bind();
  if(key){ var a=document.querySelectorAll('input.cell');
    for(var i=0;i<a.length;i++) if(focusKey(a[i])===key){ a[i].focus(); break; } }
}
function bind(){
  [].forEach.call(document.querySelectorAll('input.cell'),function(el){
    if(el.__b) return; el.__b=1;
    function commit(){
      try{
        if(el.dataset.idx!==undefined){
          var it=D.items[+el.dataset.idx]; it[el.dataset.k]=n(el.value); saveItem(it,el.dataset.k);
        } else if(el.dataset.pid!==undefined){
          var selected=D.packs.find(function(p){return String(p.id)===el.dataset.pid;});
          var qty=n(el.value); if(selected&&moonlightPack(selected)){ qty=Math.max(0,Math.floor(qty)); if(/Lunar Blessing|Everbright Moon/.test(selected.name)) qty=Math.min(1,qty); el.value=qty; }
          uPacks[el.dataset.pid]=qty; savePack(el.dataset.pid,qty);
        }
      }catch(e){ say('That change did not go through. Try typing it again.',1); }
    }
    el.addEventListener('input',commit);
    el.addEventListener('blur',commit);
    el.addEventListener('change',function(){ commit(); render(); });
  });
}

/* ---------- filters / tabs ---------- */
var filters={stock:'all',packs:'all'}, queries={stock:'',packs:'',matrix:'',members:'',r4:''};
function applyFilters(){
  ['stock','packs','matrix','members','r4'].forEach(function(id){
    var t=$(id); if(!t) return;
    var f=filters[id]||'all', q=(queries[id]||'').trim().toLowerCase();
    /* A search or a filter reaches across groups, so folding is ignored while one is on. */
    var searching = !!q || f!=='all';
    [].forEach.call(t.querySelectorAll('tbody tr'),function(r){
      if(r.classList.contains('grp')||r.classList.contains('sec')||r.classList.contains('need')){
        var foldedGroup=id==='packs' && sortMode==='section' && r.classList.contains('grp') && !!PACK_FOLD[r.dataset.psection];
        r.classList.toggle('hide', searching || foldedGroup); return; }
      var st=r.dataset.state||'';
      var okF = f==='all' || st.split(' ').indexOf(f)>=0;
      var okQ = !q || (r.dataset.q||'').indexOf(q)>=0;
      var okG = searching || !r.dataset.gn || !FOLD[r.dataset.gn];
      if(id==='packs' && !searching && sortMode==='section' && (PACK_FOLD[r.dataset.psection] || PACK_FOLD[r.dataset.pgroup])) okG=false;
      r.classList.toggle('hide', !(okF&&okQ&&okG));
    });
  });
}
document.addEventListener('input',function(e){
  if(e.target.matches&&e.target.matches('input[type=search]')){
    queries[e.target.dataset.for]=e.target.value; applyFilters(); } });
document.addEventListener('click',function(e){
  var t=e.target;
  if(t.matches('nav.tabs button[data-p]')){
    [].forEach.call(document.querySelectorAll('nav.tabs button[data-p]'),function(b){
      b.setAttribute('aria-selected',String(b===t)); });
    [].forEach.call(document.querySelectorAll('.panel'),function(p){
      p.classList.toggle('on',p.id==='p-'+t.dataset.p); });
    try{ sessionStorage.setItem('fox-tab',t.dataset.p); }catch(err){}
    if(t.dataset.p==='admin') loadMembers();
    if(t.dataset.p==='r4') loadR4();
    headroomShow();
    return; }
  var pt=t.closest&&t.closest('#packs .gtog');
  if(pt){
    var section=pt.getAttribute('data-pgroup')||pt.getAttribute('data-psection');
    if(PACK_FOLD[section]) delete PACK_FOLD[section]; else PACK_FOLD[section]=1;
    pt.setAttribute('aria-expanded',String(!PACK_FOLD[section]));
    try{ localStorage.setItem('fox-pack-fold',JSON.stringify(PACK_FOLD)); }catch(err){}
    applyFilters(); return;
  }
  var gt=t.closest&&t.closest('#stock .gtog');
  if(gt){
    var gn=gt.getAttribute('data-gname');
    if(FOLD[gn]) delete FOLD[gn]; else FOLD[gn]=1;
    gt.setAttribute('aria-expanded',String(!FOLD[gn]));
    try{ localStorage.setItem('fox-fold',JSON.stringify(FOLD)); }catch(err){}
    applyFilters();
    return; }
  var th=t.closest&&t.closest('#packs thead th[data-sort]');
  if(th){ var m=th.getAttribute('data-sort');
    if(sortMode===m){ var first=(m==='name')?1:-1;
      if(sortDir===first){ sortDir=-first; } else { sortMode='section'; sortDir=-1; } }
    else { sortMode=m; sortDir=(m==='name')?1:-1; }
    renderPacks(); applyFilters(); bind(); return; }
  if(t.id==='c-section'){ sortMode='section'; sortDir=-1; renderPacks(); applyFilters(); bind(); return; }
  if(t.matches('.chip[data-f]')){
    filters[t.dataset.scope]=t.dataset.f;
    [].forEach.call(document.querySelectorAll('.chip[data-scope="'+t.dataset.scope+'"]'),function(c){
      c.setAttribute('aria-pressed',String(c===t)); });
    applyFilters(); return; }
});

/* ---------- auth ---------- */
function authMsg(t,ok){ var e=$('authmsg'); e.textContent=t||''; e.className='authmsg'+(ok?' ok':''); }
function showAuth(){ if($('fatal')) $('fatal').hidden=true;
  $('auth').style.display=''; $('app').style.display='none'; $('userbar').style.display='none';
  var nv=$('navtabs'); if(nv) nv.style.display='none'; }
function showApp(){ if($('fatal')) $('fatal').hidden=true;
  $('auth').style.display='none'; $('app').style.display=''; $('userbar').style.display='';
  var nv=$('navtabs'); if(nv) nv.style.display=''; }

async function loadAll(){
  say('loading…');
  var r = await Promise.all([
    SB.from('settings').select('*').single(),
    SB.from('baselines').select('*'),
    SB.from('packs').select('*').order('sort'),
    SB.from('pack_contents').select('*'),
    SB.from('user_items').select('*').order('sort'),
    SB.from('user_packs').select('*'),
    SB.from('profiles').select('currency_code,currency_symbol,currency_rate').eq('id',U.id).maybeSingle()
  ]);
  var err=r.find(function(x){ return x.error; });
  if(err){ fatal('Could not load your tracker',err.error.message); return; }
  D.settings=r[0].data||{};
  D.base={}; r[1].data.forEach(function(b){ D.base[b.item]=Number(b.usd); });
  D.packs=r[2].data;
  D.contents={}; r[3].data.forEach(function(c){ (D.contents[c.pack_id]=D.contents[c.pack_id]||{})[c.item]=Number(c.qty); });
  D.items=r[4].data.filter(function(i){ return !/Moonlight Festival/i.test(i.grp||''); }).map(function(i){ return {sort:i.sort,grp:i.grp,icon:i.icon,name:i.name,
    have:Number(i.have),target:Number(i.target),free:Number(i.free)}; });
  /* Keep added items with their existing Backpack group without changing saved IDs. */
  var groupOrder={};
  D.items.forEach(function(it,idx){ if(groupOrder[it.grp]===undefined) groupOrder[it.grp]=idx; });
  D.items.sort(function(a,b){ return groupOrder[a.grp]-groupOrder[b.grp] || a.sort-b.sort; });
  uPacks={}; r[5].data.forEach(function(p){ uPacks[p.pack_id]=Number(p.freq); });
  var prof=r[6]&&r[6].data;
  if(prof){ CUR.code=prof.currency_code||'GBP'; CUR.symbol=prof.currency_symbol||'£'; CUR.rate=Number(prof.currency_rate)||1; }
  fillCurrencyInputs();
  if(!D.items.length){ say('Your backpack is empty — ask Adrian to set your account up.',1); }
  await loadHistory();
  touchProfile(); checkAdmin();
  if($('dispname')) $('dispname').value=String((U.user_metadata&&U.user_metadata.name)||'').trim();
  showApp(); render(); say('saved');
  restoreTab();
  maybeShowNews();
}

/* Arriving at the site should always open the Dashboard; a refresh should leave you
   where you were. sessionStorage is already per browser tab, and the navigation type
   is what separates a reload from someone opening the tracker fresh. */
function isReload(){
  try{
    var e=performance.getEntriesByType('navigation')[0];
    if(e&&e.type) return e.type==='reload';
    return !!(performance.navigation&&performance.navigation.type===1);
  }catch(err){ return false; }
}
function restoreTab(){
  try{
    if(!isReload()){ sessionStorage.setItem('fox-tab','dash'); return; }
    var tb=sessionStorage.getItem('fox-tab');
    if(!tb||tb==='dash') return;
    var b=document.querySelector('nav.tabs button[data-p="'+tb+'"]');
    if(b) b.click();
  }catch(e){}
}

/* ---------- headroom ----------
   The phone header wraps to two rows and the hero takes another 236px below it,
   so leaving the bar on screen would eat a third of the view, and leaving it
   static — which is what it did — put the tabs out of reach as soon as you
   scrolled. This does what a reader expects of a bar instead: it lifts away
   while you move down the page and returns on any upward flick, so the tabs are
   always one gesture away. The CSS only arms this below 820px; desktop keeps
   the plain sticky bar it already had. */
var hrEl=null, hrLast=0, hrTick=false, hrMq=null;
var HR_REVEAL=90;  /* stay put over the brand row; there is nothing to gain yet */
var HR_TOL=5;      /* ignore the jitter a soft keyboard or a rubber-band produces */
function headroomShow(){ if(hrEl) hrEl.classList.remove('hr-off'); }
function headroomApply(){
  hrTick=false;
  if(!hrEl) return;
  if(hrMq&&!hrMq.matches){ hrEl.classList.remove('hr-off','hr-stuck'); hrLast=0; return; }
  var y=window.pageYOffset||document.documentElement.scrollTop||0;
  if(y<0) y=0;
  hrEl.classList.toggle('hr-stuck',y>4);
  var d=y-hrLast;
  if(d>HR_TOL||d<-HR_TOL){
    /* Past the end of the document the browser is bouncing, not scrolling, and
       hiding the bar on a bounce reads as a glitch rather than a gesture. */
    var floor=document.documentElement.scrollHeight-window.innerHeight-2;
    if(d>0&&y>HR_REVEAL&&y<floor) hrEl.classList.add('hr-off');
    else if(d<0) headroomShow();
    hrLast=y;
  }
  if(y<=HR_REVEAL) headroomShow();
}
function headroomScroll(){
  if(hrTick) return;
  hrTick=true;
  if(window.requestAnimationFrame) requestAnimationFrame(headroomApply); else setTimeout(headroomApply,16);
}
function headroom(){
  hrEl=document.querySelector('header.top');
  if(!hrEl||!window.matchMedia) return;
  hrMq=window.matchMedia('(max-width:820px)');
  if(hrMq.addEventListener) hrMq.addEventListener('change',headroomApply);
  else if(hrMq.addListener) hrMq.addListener(headroomApply);
  window.addEventListener('scroll',headroomScroll,false);
  window.addEventListener('resize',headroomScroll,false);
  /* Reaching the sign-out button by keyboard must not leave you typing into a
     bar that is parked off the top of the screen. */
  hrEl.addEventListener('focusin',headroomShow,false);
  headroomApply();
}

async function boot(){
  if(!window.CONFIG||!CONFIG.url||CONFIG.url.indexOf('YOUR-')===0){
    $('auth').innerHTML='<div class="card"><h3>Not configured yet</h3>'+
      '<p class="hint">Add your Supabase project URL and anon key at the top of index.html.</p></div>';
    return; }
  SB=window.supabase.createClient(CONFIG.url,CONFIG.key);
  /* Listeners go on before the first network call. If that call fails the sign-in
     form still has to work, rather than sitting there inert behind a blank page. */
  wireUp();
  try{
    var s=await SB.auth.getSession();
    if(s.data.session){ identifyUser(s.data.session.user); await loadAll(); }
    else showAuth();
  }catch(e){
    fatal('Could not reach the server',(e&&e.message)||String(e));
  }
}

function wireUp(){
  if($('toast-x')) $('toast-x').addEventListener('click',function(){ $('toast').hidden=true; });
  wireNews();
  if($('fatal-retry')) $('fatal-retry').addEventListener('click',function(){ location.reload(); });
  if($('dispname')){
    $('dispname').addEventListener('input',saveDisplayName);
    $('dispname').addEventListener('blur',saveDisplayName);
  }
  $('signin').addEventListener('submit',async function(e){
    e.preventDefault(); authMsg('Signing in…');
    try{
      var r=await SB.auth.signInWithPassword({email:$('si-email').value.trim(),password:$('si-pw').value});
      if(r.error) return authMsg(r.error.message);
      identifyUser(r.data.user); authMsg(''); await loadAll();
    }catch(err){ authMsg('Could not reach the server. Check your connection and try again.'); }
  });
  $('signup').addEventListener('submit',async function(e){
    e.preventDefault();
    if($('su-pw').value.length<8) return authMsg('Password needs at least 8 characters.');
    authMsg('Creating your account…');
    try{
      var r=await SB.auth.signUp({email:$('su-email').value.trim(),password:$('su-pw').value,
        options:{data:{name:$('su-name').value.trim()}}});
      if(r.error) return authMsg(r.error.message);
      if(r.data.session){ identifyUser(r.data.user); authMsg(''); await loadAll(); }
      else authMsg('Check your email to confirm the account, then sign in.',1);
    }catch(err){ authMsg('Could not reach the server. Check your connection and try again.'); }
  });
  $('forgot').addEventListener('click',async function(){
    var em=$('si-email').value.trim();
    if(!em) return authMsg('Type your email above first.');
    var r=await SB.auth.resetPasswordForEmail(em,{redirectTo:location.href});
    authMsg(r.error?r.error.message:'Reset link sent to '+em,!r.error);
  });
  $('signout').addEventListener('click',async function(){
    await SB.auth.signOut(); location.reload();
  });
  if($('cur-select')){
    $('cur-select').addEventListener('change',function(){
      var code=$('cur-select').value; CUR.code=code;
      if(CURR[code]){ CUR.symbol=CURR[code].symbol; CUR.rate=CURR[code].rate; }
      fillCurrencyInputs(); render(); saveCurrency();
    });
    $('cur-symbol').addEventListener('input',function(){
      CUR.symbol=$('cur-symbol').value||'£'; CUR.code='CUSTOM'; $('cur-select').value='CUSTOM';
      render(); saveCurrency();
    });
    $('cur-rate').addEventListener('input',function(){
      CUR.rate=n($('cur-rate').value)||1; render(); saveCurrency();
    });
  }
  [].forEach.call(document.querySelectorAll('.authtab'),function(b){
    b.addEventListener('click',function(){
      [].forEach.call(document.querySelectorAll('.authtab'),function(x){
        x.setAttribute('aria-selected',String(x===b)); });
      $('signin').style.display = b.dataset.a==='in'?'':'none';
      $('signup').style.display = b.dataset.a==='up'?'':'none';
      authMsg('');
    });
  });
}
headroom();
boot();
})();
