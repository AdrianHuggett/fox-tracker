/* FOX Prep Tracker — front end */
(function(){
'use strict';
var SB=null, U=null, ADMIN=false, membersLoaded=false, D={items:[],packs:[],contents:{},base:{},settings:{}}, uPacks={};
var timers={}, sync=document.getElementById('sync');
var sortMode='section', sortDir=-1;
/* Which Backpack groups are folded shut, keyed by group name so the state
   survives a re-render and a reload. */
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
function months(){ return days()/30; }
function calcItem(it){
  var have=n(it.have), tgt=n(it.target), g=n(it.free)*days(), m=months();
  D.packs.forEach(function(p){
    var f=n(uPacks[p.id]); if(!f) return;
    var c=D.contents[p.id]; if(!c||!c[it.name]) return;
    g+=f*n(c[it.name])*m;
  });
  var proj=have+g;
  return {have:have,tgt:tgt,proj:proj,pct:tgt>0?have/tgt:null,
          raw:tgt>0?Math.max(tgt-have,0):0, left:tgt>0?Math.max(tgt-proj,0):0,
          ok:tgt>0?(proj>=tgt):null};
}
function itemMap(){ var m={}; D.items.forEach(function(i){m[i.name]=i;}); return m; }
function calcPack(p,byName){
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
}
function savePack(id,freq){
  queue('p'+id,function(){
    return SB.from('user_packs').update({freq:n(freq)}).eq('pack_id',id).eq('user_id',U.id);
  });
}

/* ---------- rendering ---------- */
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
    var rc=(c.tgt>0 && !c.ok && c.left>0)?fmt(c.left)+' short after plan':'';
    out.push('<tr data-state="'+state+'" data-q="'+esc(it.name.toLowerCase())+'" data-gn="'+esc(g)+'">'+
      '<td class="ic">'+esc(it.icon||'\u00b7')+'</td><td class="nm">'+esc(it.name)+'</td>'+
      '<td data-label="Have">'+inp(it.have,'','data-idx="'+idx+'" data-k="have" aria-label="'+esc(it.name)+' have"')+'</td>'+
      '<td data-label="Target">'+inp(it.target,'t2','data-idx="'+idx+'" data-k="target" aria-label="'+esc(it.name)+' target"')+'</td>'+
      '<td class="num">'+(c.tgt>0?fmt(c.raw):'<span class="mini">\u2014</span>')+'</td>'+
      '<td><div class="prog"><div class="pbar"><i style="width:'+w.toFixed(1)+'%;background:'+pcolor(c.pct)+'"></i></div>'+
        '<span>'+(c.pct===null?'\u2014':Math.round(c.pct*100)+'%')+'</span></div></td>'+
      '<td class="num">'+(n(it.free)?fmt(n(it.free),2):'<span class="mini">\u2014</span>')+'</td>'+
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
  var VP={'Must buy':'p-gold','Item buy':'p-item','Worth checking':'p-pack','Last resort':'p-low','—':'p-na'};
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
      if(p.sec!==sec){ sec=p.sec; grp=null; out.push('<tr class="sec"><td colspan="8">'+esc(sec)+'</td></tr>'); }
      if(p.grp!==grp){ grp=p.grp; out.push('<tr class="grp"><td colspan="8">'+esc(grp)+'</td></tr>'); }
    }
    function vb(v,col){ if(!(v>0)) return '<span class="mini">—</span>';
      return '<span class="vbar"><i style="width:'+Math.min(100,v/300*100).toFixed(0)+'%;background:'+col+'"></i></span>'+
             '<span class="mono">'+Math.round(v)+'%</span>'; }
    var k=c.verdict==='Must buy'?'golden':(c.verdict==='Item buy'?'item':(c.verdict==='Worth checking'?'pack':'low'));
    if(n(uPacks[p.id])>0) k+=' buying';
    out.push('<tr data-state="'+k+'" data-q="'+esc(p.name.toLowerCase())+'">'+
      '<td class="ic">'+esc(p.icon||'·')+'</td>'+
      '<td class="nm">'+esc(p.name)+'<div class="mini">'+
        esc(sortMode==='section'?(p.occurrence||''):((p.grp||'')+(p.occurrence?' · '+p.occurrence:'')))+'</div></td>'+
      '<td class="num" data-label="Price '+esc(CUR.symbol)+'">'+fmt(n(p.price)*CUR.rate,2)+'</td>'+
      '<td data-label="Buy / mo">'+inp(uPacks[p.id]||0,'t2','data-pid="'+p.id+'" aria-label="'+esc(p.name)+' packs bought per month"')+'</td>'+
      '<td data-label="Best item for you">'+(c.best?esc(c.best):'<span class="mini">'+(c.scoreable?'—':'contents not priced')+'</span>')+'</td>'+
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
  $('matrix').querySelector('thead').innerHTML='<tr><th>Pack</th>'+
    cols.map(function(c){ return '<th class="num">'+esc(c)+'</th>'; }).join('')+'</tr>';
  var out=['<tr class="need"><td>Still short</td>'+cols.map(function(c){
    var it=byName[c], r=it?calcItem(it).raw:0;
    return '<td class="num">'+(r?fmt(r):'<span class="mini">0</span>')+'</td>'; }).join('')+'</tr>'];
  D.packs.forEach(function(p){
    var c=D.contents[p.id]||{};
    out.push('<tr data-q="'+esc(p.name.toLowerCase())+'"><td>'+esc(p.name)+
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
function renderMembers(rows){
  var t=$('members'); if(!t) return;
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
      '<td class="num" data-label="Signed up">'+esc(fmtDate(m.signed_up))+'</td>'+
      '<td class="num" data-label="Last seen">'+esc(a.text)+'</td>'+
      '<td class="st"><span class="pill '+tn[0]+'">'+tn[1]+'</span></td></tr>';
  }).join('');
  t.querySelector('tbody').innerHTML=out||'<tr><td colspan="5" class="empty">Nobody has signed up yet.</td></tr>';
  if($('admin-count')) $('admin-count').textContent=plural(rows.length,'member')+' \u00b7 '+active+' active this week';
  applyFilters();
}
function membersMsg(html){
  var t=$('members'); if(t) t.querySelector('tbody').innerHTML='<tr><td colspan="5" class="empty">'+html+'</td></tr>';
}
async function loadMembers(force){
  if(!ADMIN) return;
  if(membersLoaded&&!force) return;
  if(!membersLoaded) membersMsg('Loading\u2026');
  try{
    var r=await SB.from('profiles').select('id,name,email,signed_up,last_seen,is_admin');
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
    SB.from('profiles').upsert({id:U.id,email:U.email||null,
      name:String(meta.name||'').trim()||null,
      signed_up:U.created_at||null,
      last_seen:new Date().toISOString()},{onConflict:'id'}).then(function(){},function(){});
  }catch(e){}
}
/* Asked for on its own so a project without the admin column simply answers "no"
   and the tab stays hidden, rather than breaking the whole load. */
function checkAdmin(){
  if(!U||!SB) return;
  try{
    SB.from('profiles').select('is_admin').eq('id',U.id).maybeSingle().then(function(r){
      ADMIN=!!(r&&r.data&&r.data.is_admin);
      var at=$('tab-admin'); if(at) at.hidden=!ADMIN;
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
    '<b>'+met+' / '+withT+'</b><small>'+behind+' behind after plan</small>'+
    '<div class="barrow"><div class="bar"><i style="width:'+metPct.toFixed(0)+'%;background:var(--ice)"></i></div>'+
    '<span class="barpct" style="color:var(--ice)">'+Math.round(metPct)+'%</span></div></div>'+
    '<div class="stat c-green"><span class="sicon">'+ICO.bars+'</span><span class="lbl">Average progress</span>'+
    '<b>'+Math.round(avg*100)+'%</b><small>across '+withT+' targets</small>'+
    '<div class="barrow"><div class="bar"><i style="width:'+avgPct.toFixed(0)+'%;background:var(--good)"></i></div>'+
    '<span class="barpct" style="color:var(--good)">'+Math.round(avgPct)+'%</span></div></div>'+
    '<div class="stat c-violet"><span class="sicon">'+ICO.coins+'</span><span class="lbl">Monthly spend</span>'+
    '<b>'+money(bud)+'</b><small>'+esc(CUR.code)+'</small></div>'+
    '<div class="stat c-orange"><span class="sicon">'+ICO.box+'</span><span class="lbl">Packs marked</span>'+
    '<b>'+marked+'</b><small>of '+D.packs.length+' &middot; '+gold+' must buy</small></div>'+
    '<div class="stat svs"><span class="lbl">Days to next SvS</span>'+
    '<b>'+dleft+'</b><span class="date">'+ICO.calendar+esc(D.settings.next_svs||'')+'</span></div>';
  $('c-all').textContent='All '+D.items.length;
  $('c-behind').textContent='Behind ('+behind+')';
  $('c-pall').textContent='All '+D.packs.length;
  $('c-gold').textContent='Must buy ('+gold+')';
  $('c-buying').textContent='Buying ('+marked+')';
}
function dbar(pct,col){
  return '<div class="dbar"><i style="width:'+Math.max(1.5,Math.min(100,pct)).toFixed(1)+'%;background:'+col+'"></i></div>'; }
function dashRow(rank,it,c,tone,right,sub){
  return '<li class="drow '+tone+'"><span class="rank">'+rank+'</span>'+
    '<span class="dic">'+esc(it.icon||'·')+'</span>'+
    '<span class="dname">'+esc(it.name)+'<em>'+esc(sub)+'</em></span>'+
    '<span class="dbarwrap">'+dbar(c.pct===null?0:c.pct*100, tone==='up'?'var(--good)':'var(--ember)')+'</span>'+
    '<b class="dval">'+right+'</b></li>'; }
function renderDash(){
  var withT=D.items.map(function(it){ return {it:it,c:calcItem(it)}; }).filter(function(o){ return o.c.tgt>0; });
  var byPct=withT.slice().sort(function(a,b){ return b.c.pct-a.c.pct; });
  $('d-top').innerHTML=byPct.slice(0,5).map(function(o,i){
    return dashRow(i+1,o.it,o.c,'up',Math.round(o.c.pct*100)+'%',o.c.raw>0?(fmt(o.c.raw)+' to go'):'target met'); }).join('')
    || '<li class="dempty">No targets set yet.</li>';
  $('d-bot').innerHTML=byPct.slice().reverse().slice(0,5).map(function(o,i){
    return dashRow(i+1,o.it,o.c,'down',Math.round(o.c.pct*100)+'%',fmt(o.c.raw)+' short'); }).join('')
    || '<li class="dempty">No targets set yet.</li>';
  var gaps=withT.filter(function(o){ return o.c.raw>0 && D.base[o.it.name]; })
    .map(function(o){ return {it:o.it,c:o.c,usd:o.c.raw*n(D.base[o.it.name])}; })
    .sort(function(a,b){ return b.usd-a.usd; }).slice(0,5);
  var mx=gaps.length?gaps[0].usd:1;
  $('d-gap').innerHTML=gaps.map(function(o,i){
    return '<li class="drow down"><span class="rank">'+(i+1)+'</span>'+
      '<span class="dic">'+esc(o.it.icon||'·')+'</span>'+
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
  renderSvsWarn();
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
          uPacks[el.dataset.pid]=n(el.value); savePack(el.dataset.pid,el.value);
        }
      }catch(e){ say('That change did not go through. Try typing it again.',1); }
    }
    el.addEventListener('input',commit);
    el.addEventListener('blur',commit);
    el.addEventListener('change',function(){ commit(); render(); });
  });
}

/* ---------- filters / tabs ---------- */
var filters={stock:'all',packs:'all'}, queries={stock:'',packs:'',matrix:'',members:''};
function applyFilters(){
  ['stock','packs','matrix','members'].forEach(function(id){
    var t=$(id); if(!t) return;
    var f=filters[id]||'all', q=(queries[id]||'').trim().toLowerCase();
    /* A search or a filter reaches across groups, so folding is ignored while one is on. */
    var searching = !!q || f!=='all';
    [].forEach.call(t.querySelectorAll('tbody tr'),function(r){
      if(r.classList.contains('grp')||r.classList.contains('sec')||r.classList.contains('need')){
        r.classList.toggle('hide', searching); return; }
      var st=r.dataset.state||'';
      var okF = f==='all' || st.split(' ').indexOf(f)>=0;
      var okQ = !q || (r.dataset.q||'').indexOf(q)>=0;
      var okG = searching || !r.dataset.gn || !FOLD[r.dataset.gn];
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
    return; }
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
  D.items=r[4].data.map(function(i){ return {sort:i.sort,grp:i.grp,icon:i.icon,name:i.name,
    have:Number(i.have),target:Number(i.target),free:Number(i.free)}; });
  uPacks={}; r[5].data.forEach(function(p){ uPacks[p.pack_id]=Number(p.freq); });
  var prof=r[6]&&r[6].data;
  if(prof){ CUR.code=prof.currency_code||'GBP'; CUR.symbol=prof.currency_symbol||'£'; CUR.rate=Number(prof.currency_rate)||1; }
  fillCurrencyInputs();
  if(!D.items.length){ say('Your backpack is empty — ask Adrian to set your account up.',1); }
  touchProfile(); checkAdmin();
  if($('dispname')) $('dispname').value=String((U.user_metadata&&U.user_metadata.name)||'').trim();
  showApp(); render(); say('saved');
  restoreTab();
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
boot();
})();
