/* Fake Supabase for local tests. tools/smoke_test.py serves this file in place of the
   jsDelivr supabase-js script. It ignores RLS: permission logic is not tested here.
   window.__DB holds the data, window.__log every write and rpc. Set
   window.__MOCK_NO_SESSION = true before load to start on the sign-in screen. */
(function(){
var DB = window.__DB = {
  settings: [{id:1, next_svs:'2026-10-20', mur:63.4}],
  baselines: [{item:'Charm Designs', usd:0.5}, {item:'Design Plans', usd:2}, {item:'Hardened Alloy', usd:0.01}],
  packs: [{id:1, sort:1, sec:'Daily', grp:'Daily deals', name:'Test pack', icon:'·', price:4.99, pack_value:180, occurrence:'daily'}],
  pack_contents: [{pack_id:1, item:'Design Plans', qty:20}, {pack_id:1, item:'Charm Designs', qty:30}],
  user_items: [
    {sort:1, grp:'Charms', icon:'', name:'Charm Guides',       have:100,  target:50,   free:0},
    {sort:2, grp:'Charms', icon:'', name:'Charm Designs',      have:10,   target:40,   free:1},
    {sort:3, grp:'Gear',   icon:'', name:'Design Plans',       have:100,  target:200,  free:2},
    {sort:4, grp:'Gear',   icon:'', name:'Lunar Amber',        have:0,    target:10,   free:0},
    {sort:5, grp:'Gear',   icon:'', name:'Polishing Solution', have:50,   target:100,  free:0},
    {sort:6, grp:'Gear',   icon:'', name:'Hardened Alloy',     have:1000, target:5000, free:0}],
  user_packs: [{user_id:'u1', pack_id:1, freq:0}],
  user_exchanges: [{xid:'charm-g2d', qty:20}],
  stock_history: [
    {day:'2026-10-01',have:{'Design Plans':90},packs:{'1':1}},
    {day:'2026-10-04',have:{'Design Plans':100},packs:{}}
  ],
  profiles: [
    {id:'u1', name:'Adrian', is_admin:true,  r4_editor:false, currency_code:'GBP', currency_symbol:'£', currency_rate:1, created_at:'2026-09-01', last_seen:'2026-10-02'},
    {id:'u2', name:'Emi',    is_admin:false, r4_editor:true,  created_at:'2026-09-05', last_seen:'2026-09-25'}],
  r4_members: [{id:1, sort:10, name:'Emi'}, {id:2, sort:20, name:'Solo'}],
  r4_tasks: [
    {id:11, sort:1, section:'Core Administrative Tasks', name:'Canyon Clash', freq:'Weekly', remarks:'', time_utc:'12:00', roles:{'1':'main','2':'assist'}},
    {id:12, sort:2, section:'Core Administrative Tasks', name:'Bear Hunt',    freq:'Daily',  remarks:'', time_utc:'',      roles:{}}]
};
var log = window.__log = [];
function clone(x){ return JSON.parse(JSON.stringify(x)); }
function Q(t){ this.t=t; this.op='select'; this.f=[]; this.one=false; this.orders=[]; }
Q.prototype.select=function(columns,options){ this.count=options&&options.count; return this; };
Q.prototype.eq=function(k,v){ this.f.push([k,v]); return this; };
Q.prototype.order=function(k){ this.orders.push(k); return this; };
Q.prototype.range=function(first,last){ this.bounds=[first,last]; return this; };
Q.prototype.limit=Q.prototype.gte=Q.prototype.lte=function(){ return this; };
Q.prototype.maybeSingle=Q.prototype.single=function(){ this.one=true; return this; };
Q.prototype.update=function(p){ this.op='update'; this.p=p; return this; };
Q.prototype.insert=function(p){ this.op='insert'; this.p=p; return this; };
Q.prototype.upsert=function(p,o){ this.op='upsert'; this.p=p; this.o=o; return this; };
Q.prototype.delete=function(){ this.op='delete'; return this; };
Q.prototype.then=function(res,rej){
  var T=DB[this.t]=DB[this.t]||[], f=this.f;
  var match=function(r){ return f.every(function(x){ return r[x[0]]==null||String(r[x[0]])===String(x[1]); }); };
  var rows=T.filter(match), data;
  if(this.op==='update'){ log.push([this.t,'update',f,this.p]); rows.forEach(function(r){ Object.assign(r,this.p); },this); data=rows; }
  else if(this.op==='insert'){ log.push([this.t,'insert',this.p]); var row=Object.assign({id:Date.now()%100000},this.p); T.push(row); data=[row]; }
  else if(this.op==='upsert'){
    log.push([this.t,'upsert',this.p,this.o]);
    var keys=(this.o&&this.o.onConflict||'').split(',').filter(Boolean), p=this.p;
    var hit=T.find(function(r){ return keys.length&&keys.every(function(k){ return String(r[k])===String(p[k]); }); });
    if(hit) Object.assign(hit,p); else T.push(Object.assign({},p)); data=[p];
  }
  else if(this.op==='delete'){ log.push([this.t,'delete',f]); DB[this.t]=T.filter(function(r){ return !match(r); }); data=rows; }
  else data=rows.slice().sort(function(a,b){ return (a.sort||0)-(b.sort||0)||((a.id||0)-(b.id||0)); });
  var orders=this.orders;
  if(orders.length) data.sort(function(a,b){ for(var k of orders){ if(a[k]<b[k]) return -1; if(a[k]>b[k]) return 1; } return 0; });
  var count=data.length;
  if(this.bounds) data=data.slice(this.bounds[0],this.bounds[1]+1);
  if(this.op==='select') data=data.slice(0,window.__MOCK_ROW_CAP||1000);
  data=clone(data);
  return Promise.resolve({data:this.one?(data[0]||null):data, count:this.count?count:null, error:null}).then(res,rej);
};
var user={id:'u1', email:'adrian@example.test', user_metadata:{name:'Adrian'}};
window.supabase={createClient:function(){ return {
  from:function(t){ return new Q(t); },
  rpc:function(name,args){ log.push(['rpc',name,args]); return Promise.resolve({data:null,error:null}); },
  auth:{
    getSession:function(){ return Promise.resolve({data:{session:window.__MOCK_NO_SESSION?null:{user:user}}}); },
    onAuthStateChange:function(){ return {data:{subscription:{unsubscribe:function(){}}}}; },
    signInWithPassword:function(){ return Promise.resolve({data:{user:user},error:null}); },
    signUp:function(){ return Promise.resolve({data:{user:user,session:{user:user}},error:null}); },
    signOut:function(){ return Promise.resolve({error:null}); },
    resetPasswordForEmail:function(e,o){ log.push(['auth','reset',e,o]); return Promise.resolve({error:null}); },
    updateUser:function(p){ log.push(['auth','updateUser',p]); return Promise.resolve({data:{user:user},error:null}); }
  }
}; }};
})();
