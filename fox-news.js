/* Game news is published with the site, without database writes. */
window.FOXNews = (function () {
 'use strict';
 function esc(s) { return String(s || '').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
 function render() {
  var posts=(window.FOX_NEWS_POSTS||[]).slice().sort(function(a,b){return Number(b.pinned)-Number(a.pinned)||new Date(b.created_at)-new Date(a.created_at);});
  document.getElementById('fox-news-list').innerHTML=posts.map(function(p){
   var source;try{source=new URL(p.source_url);}catch(_){return '';}
   if(source.protocol!=='https:')return '';
   var banner=/^news-[a-z-]+\.(png|webp)$/.test(p.banner)?p.banner:'news-world.png';
   var bullets=String(p.body||'').split(/\r?\n/).map(function(s){return s.trim().replace(/^[-•]\s*/,'');}).filter(Boolean).map(function(s){return '<li>'+esc(s)+'</li>';}).join('');
   return '<article class="fox-news-post"><img class="fox-news-banner" src="'+esc(banner)+'" alt="" loading="lazy"><div class="fox-news-meta">'+(p.pinned?'<strong>Pinned</strong> · ':'')+'Game news · <time datetime="'+esc(p.created_at)+'">'+esc(new Date(p.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}))+'</time></div><h3>'+esc(p.title)+'</h3><ul class="fox-news-body">'+bullets+'</ul><a href="'+esc(source.href)+'" target="_blank" rel="noopener noreferrer">Read source ↗</a></article>';
  }).join('')||'<p>No news yet.</p>';
 }
 return {mount:render};
})();
