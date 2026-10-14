(function(){
'use strict';
var source=window.PETS_DATA;
if(!source||!Array.isArray(source.pets))return;
var PETS=source.pets, BY_ID={};
PETS.forEach(function(p){BY_ID[p.id]=p;});
var MATERIALS=[
  ['petFood','Pet Food',''],
  ['tamingManuals','Taming Manuals','item-taming-manuals.png'],
  ['energizingPotions','Energizing Potions','item-energizing-potions.png'],
  ['strengtheningSerums','Strengthening Serum','item-strengthening-serum.png'],
  ['commonWildMarks','Common Wild Marks','item-common-wild-marks.png'],
  ['advancedWildMarks','Advanced Wild Marks','item-advanced-wild-marks.png']
];
var RARITY=[['Common','Common'],['N','Uncommon'],['R','Rare'],['SR','Epic'],['SSR','Legendary']];
function number(v){v=Number(v);return Number.isFinite(v)&&v>=0?Math.floor(v):0;}
function clamp(v,low,high){return Math.max(low,Math.min(high,v));}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmt(v){return Math.round(v).toLocaleString('en-GB');}
function options(p){
  var out=[{value:0,label:'Not tamed'}],adv=new Set(p.advancementCosts.map(function(x){return x.level;}));
  for(var n=1;n<=p.maxLevel;n++){
    if(adv.has(n))out.push({value:n-.5,label:'Lv. '+n});
    out.push({value:n,label:'Lv. '+n+(adv.has(n)?' · Advanced':'')});
  }
  return out;
}
function petCost(p,from,to){
  from=clamp(Number(from)||0,0,p.maxLevel);to=clamp(Number(to)||0,from,p.maxLevel);
  var result={petFood:0,tamingManuals:0,energizingPotions:0,strengtheningSerums:0,advancementScore:0};
  if(to>from){
    var first=Math.ceil(Math.max(1,from)),last=Math.ceil(to);
    for(var i=first-1;i<last-1;i++)result.petFood+=p.foodCosts[i]||0;
    p.advancementCosts.forEach(function(step){
      if(step.level>from&&step.level<=to){
        result.tamingManuals+=step.tamingManuals;
        result.energizingPotions+=step.energizingPotions;
        result.strengtheningSerums+=step.strengtheningSerums;
        result.advancementScore+=step.advancementScore;
      }
    });
  }
  return result;
}
function troopAD(p,level){
  if(level<=0)return 0;
  var isPre=!Number.isInteger(level),ceil=Math.ceil(level);
  var ix=p.advancementCosts.findIndex(function(x){return x.level===ceil;});
  if(ix>=0)return isPre?p.troopADPreAdv[ix]:p.troopAD[ix+1];
  if(ceil<=1)return p.troopAD[0];
  for(var i=0;i<p.advancementCosts.length;i++){
    var start=i===0?1:p.advancementCosts[i-1].level,end=p.advancementCosts[i].level;
    if(ceil>start&&ceil<end)return p.troopAD[i]+(ceil-start)/(end-start)*(p.troopADPreAdv[i]-p.troopAD[i]);
  }
  return p.troopAD[p.troopAD.length-1];
}
function normalize(raw){
  raw=raw||{};
  var rows={};PETS.forEach(function(p){
    var r=(raw.rows||{})[p.id]||{},available=options(p).map(function(o){return o.value;});
    var from=available.includes(Number(r.from))?Number(r.from):0;
    var to=available.includes(Number(r.to))?Number(r.to):from;
    rows[p.id]={from:from,to:Math.max(from,to)};
  });
  return {rows:rows,commonWildMarks:number(raw.commonWildMarks),advancedWildMarks:number(raw.advancedWildMarks),customChests:number(raw.customChests),view:raw.view==='saved'?'saved':'edit'};
}
function calculate(state){
  var total={petFood:0,tamingManuals:0,energizingPotions:0,strengtheningSerums:0,advancementScore:0,commonWildMarks:number(state.commonWildMarks),advancedWildMarks:number(state.advancedWildMarks),count:0},costs={},warnings=[];
  PETS.forEach(function(p){
    var r=state.rows[p.id],cost=petCost(p,r.from,r.to);costs[p.id]=cost;
    ['petFood','tamingManuals','energizingPotions','strengtheningSerums','advancementScore'].forEach(function(k){total[k]+=cost[k];});
    if(r.to>r.from)total.count++;
    if(p.unlocksAfterPetId&&r.to>0){
      var previous=state.rows[p.unlocksAfterPetId],required=p.unlocksAfterLevel||15;
      if(!previous||Math.ceil(previous.to)<required)warnings.push(p.name+' requires '+BY_ID[p.unlocksAfterPetId].name+' Lv. '+required+'.');
    }
  });
  total.svsPoints=total.advancementScore*50+total.commonWildMarks*1150+total.advancedWildMarks*15000;
  return {total:total,costs:costs,warnings:warnings};
}
function mount(host,api){
  var state=normalize(api.plan),active='SSR',status='',busy=false,disposed=false,extraOpen=false;
  function saveLocal(){if(!disposed)status='Unsaved changes';}
  function stockFor(k,stock){return stock[MATERIALS.find(function(m){return m[0]===k;})[1]];}
  function optionHtml(p,value){return options(p).map(function(o){return '<option value="'+o.value+'"'+(value===o.value?' selected':'')+'>'+esc(o.label)+'</option>';}).join('');}
  function resource(k,label,img,amount,stock){
    var have=stockFor(k,stock),available=have?number(have.have):0,short=Math.max(0,amount-available);
    return '<div class="pet-material">'+(img?'<img src="'+img+'" alt="">':'<span class="pet-food-icon" aria-hidden="true">🥩</span>')+'<div><strong>'+fmt(amount)+'</strong><span>'+esc(label)+'</span><small>Have '+fmt(available)+' · Still needed '+fmt(short)+'</small></div></div>';
  }
  function row(p,c){
    var r=state.rows[p.id],saving=state.view==='saved',chosen=r.to>r.from;
    return '<div class="pet-row"><div class="pet-name"><strong>'+esc(p.name)+'</strong><small>'+esc(p.skillName||'')+' · Max Lv. '+p.maxLevel+'</small></div>'+
      (saving?'<div class="pet-recap">'+esc(options(p).find(function(x){return x.value===r.from;}).label)+' → '+esc(options(p).find(function(x){return x.value===r.to;}).label)+'</div>':
      '<div class="pet-levels"><label>Current<select data-pet="'+esc(p.id)+'" data-field="from" aria-label="'+esc(p.name)+' current level">'+optionHtml(p,r.from)+'</select></label><span>→</span><label>Target<select data-pet="'+esc(p.id)+'" data-field="to" aria-label="'+esc(p.name)+' target level">'+optionHtml(p,r.to)+'</select></label></div>')+
      '<div class="pet-row-cost">'+(chosen?'<strong>'+fmt(c.petFood)+' Food</strong><small>'+fmt(c.tamingManuals)+' Manuals · '+fmt(c.energizingPotions)+' Potions · '+fmt(c.strengtheningSerums)+' Serums</small><small>+'+fmt(c.advancementScore*50)+' SvS pts</small>':'<span>No planned upgrade</span>')+'<small>Troop A/D '+troopAD(p,r.to).toFixed(2)+'%</small></div></div>';
  }
  function render(){
    if(disposed)return;
    var result=calculate(state),total=result.total,stock=api.stock(),saving=state.view==='saved';
    var shown=PETS.filter(function(p){return p.rarity===active&&(!saving||state.rows[p.id].to>state.rows[p.id].from);});
    var mats=MATERIALS.filter(function(m){return total[m[0]]>0;});
 var chestNeeds=[['tamingManuals',7],['energizingPotions',2],['strengtheningSerums',1]].map(function(entry){
  var item=stockFor(entry[0],stock),missing=Math.max(0,total[entry[0]]-(item?number(item.have):0));
  return Math.ceil(missing/entry[1]);
 });
 var chestsNeeded=chestNeeds.reduce(function(sum,value){return sum+value;},0);
    host.innerHTML='<h1>Plan your pets.</h1><p class="pet-lead">Set current and target levels for all 14 pets. Upgrade costs, Backpack gaps and SvS points update as you plan.</p>'+
      '<div class="pet-layout"><section class="pet-plan"><div class="pet-heading"><div><strong>My pet plan</strong><small>'+total.count+' planned upgrades</small></div><div><button type="button" id="pet-edit" aria-pressed="'+!saving+'">Edit</button><button type="button" id="pet-save" aria-pressed="'+saving+'">Save</button></div></div><p class="pet-status" id="pet-status">'+esc(status)+'</p>'+
      '<div class="pet-tabs" role="tablist" aria-label="Pet rarity">'+RARITY.map(function(t){var n=PETS.filter(function(p){return p.rarity===t[0];}).length;return '<button type="button" role="tab" data-tier="'+t[0]+'" aria-selected="'+(active===t[0])+'">'+t[1]+' <small>'+n+'</small></button>';}).join('')+'</div>'+
      '<div class="pet-rows">'+(shown.length?shown.map(function(p){return row(p,result.costs[p.id]);}).join(''):'<p class="pet-empty">No upgrades in this tier. Choose Edit to plan one.</p>')+'</div></section>'+
      '<aside class="pet-summary"><section><h2>Resources for your plan</h2>'+MATERIALS.slice(0,4).map(function(m){return resource(m[0],m[1],m[2],total[m[0]],stock);}).join('')+
      '<details class="pet-extra"'+(extraOpen?' open':'')+'><summary>Wild Marks and custom chests</summary><p class="pet-small">Enter the Wild Marks you plan to spend during SvS. Custom chests can supply 7 Manuals, 2 Potions or 1 Serum each; they are not added to Backpack targets.</p>'+
      '<div class="pet-extra-inputs">'+[['commonWildMarks','Common Wild Marks'],['advancedWildMarks','Advanced Wild Marks'],['customChests','Custom Chests (Pet Adv. Mat.)']].map(function(m){return '<label>'+m[1]+'<input type="number" min="0" step="1" data-extra="'+m[0]+'" value="'+number(state[m[0]])+'"'+(saving?' disabled':'')+'></label>';}).join('')+'</div>'+
 MATERIALS.slice(4).map(function(m){return resource(m[0],m[1],m[2],total[m[0]],stock);}).join('')+'<p class="pet-small">To cover the missing advancement materials: '+fmt(chestsNeeded)+' custom chests needed; '+fmt(state.customChests)+' entered. Open each chest for the material you need (7 Manuals, 2 Potions or 1 Serum). Backpack targets still show the full cost.</p></details>'+ 
      (result.warnings.length?'<div class="pet-warning"><strong>Unlock requirements</strong>'+result.warnings.map(function(w){return '<p>'+esc(w)+'</p>';}).join('')+'</div>':'')+
      '<button class="pet-primary" id="pet-push" type="button"'+(mats.length&&!busy?'':' disabled')+'>Push to Backpack Target</button><p class="pet-small">Review each target before applying. Have stays unchanged.</p></section>'+
      '<section><h2>SvS points</h2><strong class="pet-points">'+fmt(total.svsPoints)+' <small>pts</small></strong><p class="pet-small">'+fmt(total.advancementScore)+' advancement score × 50 + '+fmt(total.commonWildMarks)+' Common Wild Marks × 1,150 + '+fmt(total.advancedWildMarks)+' Advanced Wild Marks × 15,000.</p><p class="pet-small">Material spending estimate. Event bonuses and pet food do not add points.</p></section></aside></div>'+
      '<p class="pet-source">Pet costs and unlocks: <a href="https://wostools.net/pets-calculator" target="_blank" rel="noopener">WoSTools</a>. Data captured 14 Oct 2026.</p>'+
      '<dialog id="pet-dialog"><h2>Update Backpack targets?</h2><p>Replace the listed targets with the full planned amounts.</p>'+mats.map(function(m){var current=stockFor(m[0],stock);return '<p class="pet-target"><span>'+esc(m[1])+'</span><strong>'+fmt(current?current.target:0)+' → '+fmt(total[m[0]])+'</strong></p>';}).join('')+'<p>Current stock stays unchanged.</p><p class="pet-error" id="pet-error"></p><div class="pet-actions"><button type="button" id="pet-cancel">Keep targets</button><button type="button" class="pet-primary" id="pet-apply">Apply targets</button></div></dialog>';
    host.querySelector('#pet-edit').onclick=function(){if(!busy){state.view='edit';render();}};
    host.querySelector('#pet-save').onclick=async function(){
      if(busy)return;busy=true;status='Saving plan…';render();
      try{await api.savePlan({rows:state.rows,commonWildMarks:state.commonWildMarks,advancedWildMarks:state.advancedWildMarks,customChests:state.customChests,view:'saved'});if(disposed)return;state.view='saved';status='Plan saved to your account.';}
      catch(err){status='Plan not saved. '+(err.message||'Please retry.');}
      finally{busy=false;if(!disposed)render();}
    };
    host.querySelectorAll('[data-tier]').forEach(function(b){b.onclick=function(){active=b.dataset.tier;render();};});
    host.querySelector('.pet-extra').ontoggle=function(e){extraOpen=e.target.open;};
    host.querySelectorAll('select[data-pet]').forEach(function(s){s.onchange=function(){var p=BY_ID[s.dataset.pet],r=state.rows[p.id],value=Number(s.value);r[s.dataset.field]=value;if(r.to<r.from)r.to=r.from;saveLocal();render();};});
    host.querySelectorAll('[data-extra]').forEach(function(input){input.onchange=function(){state[input.dataset.extra]=number(input.value);saveLocal();render();};});
    var d=host.querySelector('#pet-dialog');
    host.querySelector('#pet-push').onclick=function(){d.showModal();};
    host.querySelector('#pet-cancel').onclick=function(){if(!busy)d.close();};
    d.oncancel=function(e){if(busy)e.preventDefault();};
    host.querySelector('#pet-apply').onclick=async function(){
      if(busy)return;busy=true;d.querySelectorAll('button').forEach(function(b){b.disabled=true;});
      try{await api.applyTargets(mats.map(function(m){return {name:m[1],target:total[m[0]]};}));if(disposed)return;d.close();status='Backpack targets updated.';render();}
      catch(err){if(!disposed)host.querySelector('#pet-error').textContent=err.message||'Targets were not saved. Please retry.';}
      finally{busy=false;if(!disposed&&d.open)d.querySelectorAll('button').forEach(function(b){b.disabled=false;});}
    };
  }
  render();
  return {refresh:function(){if(!disposed&&!busy&&!host.querySelector('dialog[open]'))render();},dispose:function(){disposed=true;}};
}
window.FOXPets={mount:mount,calculate:calculate,normalize:normalize,petCost:petCost,options:options,troopAD:troopAD};
})();
