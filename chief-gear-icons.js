/* Shared Chief Gear artwork and rank badges. Presentation only; no saved data changes. */
(function(){'use strict';
const pieces={jacket:'Jacket',pants:'Pants',helmet:'Helmet',watch:'Watch',ring:'Ring',cane:'Cane'};
const names={green:'Green',blue:'Blue',purple:'Purple',gold:'Gold',red:'Red',pink:'Red'};
// Partial-stage denominators from the existing Chief Gear catalogue.
const partialSteps={"gold-t2-3":4,"red-0":4,"red-1":4,"red-2":4,"red-3":4,"red-t1-0":4,"red-t1-1":4,"red-t1-2":4,"red-t1-3":4,"red-t2-0":4,"red-t2-1":4,"red-t2-2":4,"red-t2-3":4,"red-t3-0":4,"red-t3-1":4,"red-t3-2":4,"red-t3-3":5,"red-t4-0":5,"red-t4-1":5,"red-t4-2":5};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function describe(stage){
  if(!stage)return {unknown:true,label:'Unknown'};
  if(stage.id==='none'||stage.tier==='None')return {empty:true,label:'Not equipped'};
  const m=String(stage.id||'').match(/^(green|blue|purple|gold|red|pink)(?:-t(\d+))?-(\d+)(?:-s(\d+))?$/);
  if(!m)return {unknown:true,label:'Unknown'};
  const color=m[1]==='pink'?'red':m[1],tier=m[2]?'T'+m[2]:'',stars=Number(stage.stars??m[3]);
  const subStep=Number(stage.subStep??m[4]??0),totalSubSteps=Number(stage.totalSubSteps||partialSteps[m[0].replace(/-s\d+$/,'').replace(/^pink/,'red')]||0);
  return {color,tier,stars,subStep,totalSubSteps,label:names[color]+(tier?' '+tier:'')+' '+stars+'★'+(subStep?' · stage '+subStep+(totalSubSteps?'/'+totalSubSteps:''):'')};
}
function render(piece,stage,options){
  if(!Object.hasOwn(pieces,piece))return '';
  const d=describe(stage),label=pieces[piece]+': '+d.label;
  if(d.unknown||d.empty)return '<span class="cg-icon cg-icon-empty" role="img" aria-label="'+esc(label)+'" title="'+esc(label)+'"><span aria-hidden="true">'+(d.unknown?'?':'—')+'</span></span>';
  const base=options?.baseURL||'',src=base+'chief-gear-art/'+piece+'-'+d.color+'.png';
  const slots=['helmet','watch','jacket','pants','ring','cane'],colors=['green','blue','purple','gold','red'];
  const art=options?.sprite?'<span class="cg-icon-art" style="background-image:var(--cg-gear-sprite);background-size:336px 280px;background-position:'+(-slots.indexOf(piece)*56)+'px '+(-colors.indexOf(d.color)*56)+'px"></span>':'<img src="'+esc(src)+'" alt="" width="56" height="56" decoding="async">';
  return '<span class="cg-icon" role="img" aria-label="'+esc(label)+'" title="'+esc(label)+'" data-gear-color="'+d.color+'" data-gear-tier="'+d.tier+'" data-gear-stars="'+d.stars+'">'+
    art+
    (d.tier?'<span class="cg-icon-tier" aria-hidden="true">'+d.tier+'</span>':'')+
    (d.stars?'<span class="cg-icon-stars" aria-hidden="true">'+Array.from({length:d.stars},()=>'<span>★</span>').join('')+'</span>':'')+
    (d.subStep?'<span class="cg-icon-step" aria-hidden="true">'+d.subStep+(d.totalSubSteps?'/'+d.totalSubSteps:'')+'</span>':'')+'</span>';
}
window.FOXChiefGearIcons={describe,render,label:stage=>describe(stage).label};
})();
