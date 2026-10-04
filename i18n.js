/* Language switcher. It never touches the app's own code: it swaps the text the page
   shows for a translation from i18n-data.js whenever the text matches an English entry
   exactly, and keeps the English original so switching back is exact. Anything without
   an entry stays in English, and if anything here fails the site simply stays English. */
(function(){
'use strict';
try{
var NAMES={en:'English',es:'Español',tr:'Türkçe',no:'Norsk'};
var COL={es:1,tr:2,no:3};
var KEY='fox-lang';
var MONTHS={
  en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  es:['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],
  tr:['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],
  no:['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']};
var DICT={es:{},tr:{},no:{}};
(window.I18N_ROWS||[]).forEach(function(r){
  Object.keys(COL).forEach(function(l){ if(r[COL[l]]) DICT[l][r[0]]=r[COL[l]]; });
});
var NUM=/\d+(?:[.,]\d+)*/g;
var MON=/(\d+) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g;
var ATTRS=['placeholder','title','aria-label','alt'];
var SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1,TEXTAREA:1};
var lang='en';
var origT=new WeakMap(), outT=new WeakMap(), recA=new WeakMap();

function translate(s){
  if(lang==='en') return null;
  var lead=s.match(/^\s*/)[0], trail=s.match(/\s*$/)[0];
  var core=s.replace(/\s+/g,' ').trim();
  if(core.length<2) return null;
  var months=[];
  var k=core.replace(MON,function(m,d,mon){ months.push(MONTHS.en.indexOf(mon)); return d+' {m}'; });
  var nums=k.match(NUM)||[];
  var hit=DICT[lang][k.replace(NUM,'{n}')];
  if(!hit) return null;
  var parts=hit.split(/(\{n\}|\{m\})/), out='', ni=0, mi=0;
  for(var i=0;i<parts.length;i++){
    if(parts[i]==='{n}'){ if(ni>=nums.length) return null; out+=nums[ni++]; }
    else if(parts[i]==='{m}'){ if(mi>=months.length) return null; out+=MONTHS[lang][months[mi++]]; }
    else out+=parts[i];
  }
  if(ni!==nums.length||mi!==months.length) return null;
  return lead+out+trail;
}
function skipped(el){ return !el||el.nodeType!==1?false:!!(el.closest&&el.closest('[translate="no"]')); }
function doText(node){
  var p=node.parentNode; if(!p||SKIP[p.nodeName]||skipped(p)) return;
  var cur=node.nodeValue, orig=(outT.has(node)&&cur===outT.get(node))?origT.get(node):cur;
  var t=translate(orig), want=t===null?orig:t;
  if(cur!==want) node.nodeValue=want;
  if(t!==null){ origT.set(node,orig); outT.set(node,want); } else { origT.delete(node); outT.delete(node); }
}
function doAttr(el,a){
  if(skipped(el)) return;
  var v=el.getAttribute(a); if(v===null) return;
  var rec=recA.get(el)||{}, r=rec[a], orig=(r&&v===r.out)?r.orig:v;
  var t=translate(orig), want=t===null?orig:t;
  if(v!==want) el.setAttribute(a,want);
  if(t!==null){ rec[a]={orig:orig,out:want}; recA.set(el,rec); } else if(r){ delete rec[a]; }
}
function walk(root){
  if(root.nodeType===3){ doText(root); return; }
  if(root.nodeType!==1) return;
  if(SKIP[root.nodeName]) return;
  attrs(root);
  var w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,null), n;
  while((n=w.nextNode())){
    if(n.nodeType===3) doText(n);
    else if(!SKIP[n.nodeName]) attrs(n);
  }
}
function attrs(el){ ATTRS.forEach(function(a){ if(el.hasAttribute(a)) doAttr(el,a); }); }

function setLang(l,save){
  if(!NAMES[l]) l='en';
  lang=l;
  if(save){ try{ localStorage.setItem(KEY,l); }catch(e){} }
  document.documentElement.lang=(l==='no'?'nb':l);
  walk(document.body);
  [].forEach.call(document.querySelectorAll('select.langsel'),function(s){ s.value=l; });
}
function detect(){
  var saved=null; try{ saved=localStorage.getItem(KEY); }catch(e){}
  if(saved&&NAMES[saved]) return saved;
  var list=(navigator.languages&&navigator.languages.length)?navigator.languages:[navigator.language||'en'];
  for(var i=0;i<list.length;i++){
    var c=String(list[i]).toLowerCase().slice(0,2);
    if(c==='es'||c==='tr') return c;
    if(c==='nb'||c==='nn'||c==='no') return 'no';
    if(c==='en') return 'en';
  }
  return 'en';
}
function start(){
  [].forEach.call(document.querySelectorAll('select.langsel'),function(s){
    s.addEventListener('change',function(){ setLang(s.value,true); });
  });
  new MutationObserver(function(muts){
    if(lang==='en') return;
    muts.forEach(function(m){
      if(m.type==='childList'){ [].forEach.call(m.addedNodes,walk); }
      else if(m.type==='characterData'){ doText(m.target); }
      else if(m.type==='attributes'){ doAttr(m.target,m.attributeName); }
    });
  }).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  setLang(detect(),false);
}
window.FOXLang={set:function(l){ setLang(l,true); },get:function(){ return lang; }};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
}catch(e){ if(window.console) console.warn('Language switcher not started',e); }
})();
