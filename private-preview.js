/* Only the delivery bridge is public. Documents and profiles are returned by
   owner-scoped database policies, never by a public HTML/JS asset. */
(function(){
  'use strict';
  window.FOXPrivatePreview={create:function(options){
    var sb=options.sb, owner=options.userId, rowId='account-optimizer';
    var alive=true, allowed=false, frame=null, host=null, revision=0, busy=false;
    var generation=0, loadPromise=null;
    function query(columns){return sb.from('private_feature_previews').select(columns).eq('id',rowId).eq('owner_id',owner).maybeSingle();}
    function send(message){if(alive&&frame&&frame.contentWindow)frame.contentWindow.postMessage(Object.assign({channel:'fox-private-preview'},message),'*');}
    function clear(){generation++;if(frame)frame.remove();frame=null;if(host)host.replaceChildren();}
    function notice(message,retry){
      if(!host)return;host.replaceChildren();var box=document.createElement('div');box.className='card';
      var p=document.createElement('p');p.textContent=message;box.appendChild(p);
      if(retry){var b=document.createElement('button');b.type='button';b.className='chip';b.textContent='Retry';b.onclick=function(){mount(host);};box.appendChild(b);}
      host.appendChild(box);
    }
    async function check(){
      try{var r=await query('version');if(!alive)return false;allowed=!r.error&&!!r.data;return allowed;}
      catch(e){allowed=false;return false;}
    }
    async function mount(container){
      if(!alive||!allowed)return;if(frame&&host===container)return;if(loadPromise)return loadPromise;
      host=container;clear();var ticket=generation;notice('Loading your private preview…');
      loadPromise=(async function(){
        try{
          var r=await query('document,profile,revision,version');if(!alive||ticket!==generation)return;
          if(r.error)throw new Error('Your private preview could not be loaded. Try again.');
          if(!r.data||typeof r.data.document!=='string'){allowed=false;notice('This preview is not available for this account.');options.onDenied();return;}
          revision=r.data.revision;
          var saved=r.data.profile||{};frame=document.createElement('iframe');
          // Reference links may open a separate tab; the preview keeps an opaque origin.
          frame.title='My profile — private test';frame.dataset.privatePreviewVersion=String(r.data.version||'');
          frame.setAttribute('sandbox','allow-scripts allow-popups allow-popups-to-escape-sandbox');frame.referrerPolicy='no-referrer';
          frame.style.cssText='display:block;width:100%;height:800px;border:0;border-radius:12px;';
          frame.addEventListener('load',function(){send({type:'init',profile:saved});});
          frame.srcdoc=r.data.document;host.replaceChildren(frame);
        }catch(e){if(alive&&ticket===generation)notice(e.message||'Could not load the private preview.',true);}
        finally{loadPromise=null;}
      })();return loadPromise;
    }
    async function message(e){
      if(!alive||!frame||e.source!==frame.contentWindow||!e.data||e.data.channel!=='fox-private-preview')return;
      var m=e.data;
      if(m.type==='resize'){var h=Number(m.height);if(Number.isFinite(h))frame.style.height=Math.min(30000,Math.max(440,Math.ceil(h)))+'px';return;}
      if(m.type!=='save'||busy||!allowed)return;
      if(!m.profile||m.profile.schema!==1||JSON.stringify(m.profile).length>1000000){send({type:'save-result',request:m.request,error:'This profile is too large or has an unsupported format.'});return;}
      busy=true;
      try{
        var r=await sb.from('private_feature_previews').update({profile:m.profile}).eq('id',rowId).eq('owner_id',owner).eq('revision',revision).select('revision');
        if(!alive)return;
        if(r.error)throw new Error('Your changes were not saved. Check your connection and try again.');
        if(!r.data||r.data.length!==1)throw new Error('This profile changed in another tab, or access was removed. Keep this tab open and copy any unsaved changes before refreshing.');
        revision=r.data[0].revision;send({type:'save-result',request:m.request});
      }catch(err){send({type:'save-result',request:m.request,error:err.message});}
      finally{busy=false;}
    }
    window.addEventListener('message',message);
    return {check:check,mount:mount,dispose:function(){alive=false;allowed=false;clear();window.removeEventListener('message',message);}};
  }};
})();
