/* New-game coach. Story goals stay the quest chain. This only points at the real controls,
   one step at a time, and can be skipped or replayed. Progress lives in st.tut. */
window.Tutorial=(function(){
  const STEPS=[
    {id:'seeds'},
    {id:'plant'},
    {id:'water'},
    {id:'feed'},
    {id:'harvest'},
    {id:'dry'},
    {id:'sell'},
    {id:'order'},
    {id:'hire'},
    {id:'land'}
  ];
  function tut(){ const st=window.G&&G.st; const t=st&&st.tut; return t&&typeof t==='object'&&!Array.isArray(t)?t:null; }
  function active(){ const t=tut(); return !!(t&&t.on&&!t.done); }
  function crew(){ const w=G.st.workers||{}; let n=0; for(const k in w) n+=(w[k]|0); return n; }
  function kai(){ const W=G.WORKERS||{}; const k=W.mgrG?'mgrG':W.farmhand?'farmhand':Object.keys(W)[0]; return k?{k,d:W[k]}:null; }
  function sheetOpen(){ const sh=document.getElementById('sheet'); return !!(sh&&!sh.classList.contains('hidden')); }
  function panel(){ return window.UI&&UI.panel; }
  function popOpen(){ const p=document.getElementById('pop'); return !!(p&&!p.classList.contains('hidden')); }
  function owned(){ return G.st.plots.filter(p=>p.owned); }
  function hereOr(list){ const loc=G.st.loc; return list.find(p=>p.loc===loc)||list[0]||null; }
  function plotFor(id){
    const mine=owned();
    if(id==='plant'){ if(!(G.st.seeds[G.st.selSeed]>0)) return null; return hereOr(mine.filter(p=>!p.strain)); }
    if(id==='water') return hereOr(mine.filter(p=>p.strain&&p.prog<1));
    if(id==='feed') return hereOr(mine.filter(p=>p.strain&&p.prog>=.5&&p.prog<1&&!(p.food>0)))||hereOr(mine.filter(p=>p.strain&&p.prog<1&&!(p.food>0)));
    if(id==='harvest') return hereOr(mine.filter(p=>p.strain&&p.prog>=1))||hereOr(mine.filter(p=>p.strain&&p.prog<1));
    return null;
  }
  function plot(){ if(!active()) return null; const step=STEPS[tut().step|0]; if(!step) return null;
    if(sheetOpen()&&(step.id==='plant'||step.id==='water'||step.id==='feed'||step.id==='harvest')) return null;
    if(popOpen()&&(step.id==='water'||step.id==='feed')) return null;
    const p=plotFor(step.id); return p?p.id:null; }
  function closeBtn(){ return document.getElementById('sheetClose'); }
  function buyBtn(){ return document.querySelector('#sheet [data-a="buy"][data-id="northern-lights"][data-n="1"]:not([disabled])')||document.querySelector('#sheet [data-a="buy"]:not([disabled])')||document.querySelector('#sheet [data-a="buy"]'); }
  function hireBtn(){ const k=kai(); return (k&&document.querySelector('#sheet [data-a="hire"][data-k="'+k.k+'"]'))||document.querySelector('#sheet [data-a="hire"]'); }
  function targetEl(){
    if(!active()) return null;
    const step=STEPS[tut().step|0]; if(!step) return null;
    const world=step.id==='plant'||step.id==='water'||step.id==='feed'||step.id==='harvest'||step.id==='order'||step.id==='land';
    if(sheetOpen()&&world) return closeBtn();
    if(step.id==='seeds'){ if(sheetOpen()&&panel()==='seeds') return buyBtn(); if(sheetOpen()) return closeBtn(); return document.querySelector('#menu [data-panel="seeds"]'); }
    if(step.id==='plant'){ if(!(G.st.seeds[G.st.selSeed]>0)) return document.getElementById('seedBag'); const p=plotFor('plant'); if(p&&p.loc!==G.st.loc) return document.querySelector('#locTabs [data-loc="'+p.loc+'"]'); return null; }
    if(step.id==='water'){ if(popOpen()) return document.querySelector('#pop [data-pa="water"]'); const p=plotFor('water'); if(p&&p.loc!==G.st.loc) return document.querySelector('#locTabs [data-loc="'+p.loc+'"]'); return null; }
    if(step.id==='feed'){ if(popOpen()) return document.querySelector('#pop [data-pa="feed"]'); const p=plotFor('feed'); if(p&&p.loc!==G.st.loc) return document.querySelector('#locTabs [data-loc="'+p.loc+'"]'); return null; }
    if(step.id==='harvest'){ const p=plotFor('harvest'); if(p&&p.loc!==G.st.loc) return document.querySelector('#locTabs [data-loc="'+p.loc+'"]'); return null; }
    if(step.id==='dry'){ if(sheetOpen()&&panel()==='process') return document.querySelector('#sheet [data-a="load"]')||closeBtn(); if(sheetOpen()) return closeBtn(); return document.querySelector('#menu [data-panel="process"]'); }
    if(step.id==='sell'){ if(sheetOpen()&&(panel()==='market'||panel()==='stand')) return document.querySelector('#sheet [data-a="sell"]')||closeBtn(); if(sheetOpen()) return closeBtn(); return document.querySelector('#menu [data-panel="market"]'); }
    if(step.id==='order') return document.getElementById('orderBoard');
    if(step.id==='hire'){ if(sheetOpen()&&panel()==='upgrades'){ const tab=document.querySelector('#sheetTabs [data-tab="hands"]'); if(tab&&!tab.classList.contains('on')) return tab; return hireBtn()||tab; } if(sheetOpen()) return closeBtn(); return document.getElementById('upgBtn'); }
    if(step.id==='land') return document.querySelector('#locTabs [data-loc="farm"]');
    return null;
  }
  function snap(){
    const t=tut(), st=G.st; if(!t) return;
    t.base={step:t.step|0, plant:st.stats.plant|0, water:st.stats.water|0, feed:st.stats.feed|0, harvests:st.stats.harvests|0, dry:st.stats.dryLoads|0, sold:st.stats.sold|0, orders:st.stats.orders|0, bought:t.bought|0, crew:crew(), land:st.land?1:0};
  }
  function ensureBase(){ const t=tut(); const b=t&&t.base; if(!b||typeof b!=='object'||(b.step|0)!==(t.step|0)){ snap(); G.save(); } }
  function met(step){
    const t=tut(), st=G.st, b=t.base||{};
    if(step.id==='seeds') return (t.bought|0)>(b.bought|0);
    if(step.id==='plant') return (st.stats.plant|0)>(b.plant|0);
    if(step.id==='water') return (st.stats.water|0)>(b.water|0);
    if(step.id==='feed') return (st.stats.feed|0)>(b.feed|0);
    if(step.id==='harvest') return (st.stats.harvests|0)>(b.harvests|0);
    if(step.id==='dry') return (st.stats.dryLoads|0)>(b.dry|0);
    if(step.id==='sell') return (st.stats.sold|0)>(b.sold|0);
    if(step.id==='order') return (st.stats.orders|0)>(b.orders|0);
    if(step.id==='hire') return crew()>(b.crew|0);
    if(step.id==='land') return !!st.land&&!b.land;
    return false;
  }
  function locLine(p){ if(!p||p.loc===G.st.loc) return ''; const name=(G.LOC_NAME&&G.LOC_NAME[p.loc])||p.loc; return 'Open '+name+' first. '; }
  function say(step){
    const blocked=sheetOpen()&&targetEl()===closeBtn();
    if(blocked) return 'Close this panel. The next step is on the farm.';
    if(step.id==='seeds') return "Open Seeds and buy one. You've already got four Northern Lights. This is how you restock the bag.";
    if(step.id==='plant'){ if(!(G.st.seeds[G.st.selSeed]>0)) return 'Your bag is empty. Tap the seed bag and pick a seed you own.'; const p=plotFor('plant'); if(!p) return 'Every bucket you own is full. Harvest one, or tap Next.'; return locLine(p)+'Tap an empty bucket to plant. Northern Lights is already selected.'; }
    if(step.id==='water'){ const p=plotFor('water'); if(!p) return 'Nothing is growing yet. Plant a seed, or tap Next.'; return locLine(p)+'Tap the plant, then the water drop above it. A full tank keeps it growing.'; }
    if(step.id==='feed'){ const p=plotFor('feed'); if(!p) return 'The free feed happens once, at halfway. Plant something, or tap Next.'; return locLine(p)+'Each plant gets one free feed at the halfway mark. Tap the feed icon. It costs nothing.'; }
    if(step.id==='harvest'){ const p=plotFor('harvest'); if(!p) return 'Nothing to harvest yet. Tap Next if you already picked it.'; return locLine(p)+(p.prog>=1?'It is ripe. Tap the plant, or Harvest all.':'When the plant glows, tap it to harvest. Fresh buds go into your inventory.'); }
    if(step.id==='dry') return 'Open Dry & Cure and load the racks. Curing jars raise the price later. You do not have to wait for them now.';
    if(step.id==='sell') return 'Open Market and sell what you grew. Fresh, dried, or cured buds all count.';
    if(step.id==='order') return 'The order board is up here. Neighbors pay extra, and it opens at level '+G.GATE.orders+'. Fill one when you can, or tap Next.';
    if(step.id==='hire'){ const h=kai(); const name=h?h.d.name.split(',')[0]:'Kai'; const lv=h?h.d.level:2; const price=h?G.fmt(G.cost(h.d,0)):G.fmt(300); return 'Open Upgrades, then Helpers. '+name+' is a one-time hire with no wages. That needs level '+lv+' and '+price+'. Tap Next to move on.'; }
    if(step.id==='land') return 'The '+(G.LOC_NAME.farm||'Greenhouse')+' tab is the family land. It opens at level '+G.LAND_LEVEL+' for '+G.fmt(G.LAND_COST)+'. Buying it turns this garage into your Pheno Room. Tap Next to move on.';
    return "That's the loop. Plant, water, one free feed, harvest, dry, then sell. I'll stay on the goal card when you want the longer story.";
  }
  function ensure(){
    let el=document.getElementById('tutc'); if(el) return el;
    el=document.createElement('div'); el.id='tutc'; el.className='hidden'; el.setAttribute('role','status');
    el.innerHTML=(window.portraitImg?portraitImg('Unko Kuli','gport'):'')+'<div class="gtx"><div class="gt"></div><p></p><div class="acts"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('button'); if(!b) return; const a=b.dataset.a; if(a==='skip') skip(); else if(a==='next') next(); else if(a==='done') finish(); });
    return el;
  }
  function overlaps(a,b){ return !(a.right<b.left+4||a.left>b.right-4||a.bottom<b.top+4||a.top>b.bottom-4); }
  function box(id){ const e=document.getElementById(id); if(!e||e.classList.contains('hidden')) return null; const r=e.getBoundingClientRect(); if(r.width<2||r.height<2||getComputedStyle(e).display==='none'||getComputedStyle(e).visibility==='hidden') return null; return r; }
  function place(){
    const el=document.getElementById('tutc'); if(!el||el.classList.contains('hidden')) return;
    const goal=box('goal'); const bar=box('toolbar');
    const tgt=targetEl(); const tr=tgt&&tgt.getClientRects&&tgt.getClientRects().length?tgt.getBoundingClientRect():null;
    const pad=8;
    el.style.left=pad+'px';
    el.style.width=Math.min(340, innerWidth-pad*2)+'px';
    const h=el.offsetHeight||130;
    const belowGoal=goal?goal.bottom+pad:70;
    const aboveBar=bar?bar.top-h-pad:innerHeight-h-pad;
    const high=tr&&(tr.top+tr.height/2)<innerHeight*.42;
    const fit=t=>Math.max(pad, Math.min(t, innerHeight-h-pad));
    let top=fit(high?aboveBar:belowGoal);
    el.style.top=top+'px';
    if(!tr||tr.width<2) return;
    const hits=t=>{ const a={left:pad,top:t,right:pad+el.offsetWidth,bottom:t+h}; return overlaps(a,tr); };
    if(hits(top)) el.style.top=fit(high?belowGoal:aboveBar)+'px';
  }
  function paint(){
    const t=tut(); if(!t||!t.on||t.done){ hide(); return; }
    const el=ensure(); const i=t.step|0; const step=STEPS[i];
    const head=step?'Unko Kuli · '+(i+1)+'/'+STEPS.length:'Unko Kuli';
    const tip=say(step||{id:'done'});
    const acts=step?[{a:'skip',cls:'sec',label:'Skip'},{a:'next',cls:'',label:'Next'}]:[{a:'skip',cls:'sec',label:'Skip'},{a:'done',cls:'gold',label:"Let's grow"}];
    const sig=head+'\n'+tip+'\n'+acts.map(a=>a.a+a.cls+a.label).join('|');
    if(el._sig!==sig){ el._sig=sig; el.querySelector('.gt').textContent=head; el.querySelector('p').textContent=tip;
      el.querySelector('.acts').innerHTML=acts.map(a=>'<button class="btn '+(a.cls||'')+'" data-a="'+a.a+'">'+a.label+'</button>').join(''); }
    el.classList.remove('hidden'); place();
  }
  function hide(){ const el=document.getElementById('tutc'); if(el) el.classList.add('hidden'); }
  function advance(from){
    const t=tut(); if(!t||!t.on||t.done) return; if(from!=null&&(t.step|0)!==from) return;
    t.step=(t.step|0)+1; if(t.step<STEPS.length) snap(); G.save(); paint();
  }
  function sync(){ try{ const t=tut(); if(!t||!t.on||t.done) return; ensureBase(); const i=t.step|0; const step=STEPS[i]; if(step&&met(step)) advance(i); else paint(); }catch(e){} }
  function next(){ const t=tut(); if(!t) return; if((t.step|0)>=STEPS.length){ finish(); return; } advance(t.step|0); }
  function resumeStory(){ try{ if(window.UI&&UI.storyLine&&G.curQuest) UI.storyLine(G.curQuest()); }catch(e){} }
  function skip(){ const t=tut(); if(!t) return; t.on=false; t.done=true; t.skip=true; G.save(); hide(); if(window.UI&&UI.toast) UI.toast('Tutorial skipped. You can replay it in Settings.'); resumeStory(); }
  function finish(){ const t=tut(); if(!t) return; t.on=false; t.done=true; t.skip=false; t.step=STEPS.length; G.save(); hide(); resumeStory(); }
  function start(){ const t=tut(); if(!t) return; t.on=true; t.done=false; t.skip=false; t.step=0; snap(); G.save(); paint(); }
  function offer(){
    const html='<div class="dlg">'+(window.portraitImg?portraitImg('Unko Kuli','dport'):'')+'<div><b>Unko Kuli</b><p>This was your Grandpa\'s garage. Now it\'s yours. I can walk you through the first grow, or you can jump in.</p></div></div>';
    UI.modal(html,[{label:'Play tutorial',cls:'gold',v:'play'},{label:'Skip',cls:'sec',v:'skip'}]).then(v=>{ if(v==='play') start(); else skip(); });
  }
  function onPlay(fresh){ const t=tut(); if(!t) return; if(t.on&&!t.done){ ensureBase(); paint(); return; } hide(); if(fresh&&!t.done&&!t.skip) offer(); }
  function replay(){ start(); }
  if(window.G&&G.on) ['seeds','plant','water','feed','harvest','dryload','sold','order','hire','land'].forEach(n=>G.on(n,sync));
  setInterval(sync,400);
  window.addEventListener('resize',()=>{ if(active()) place(); });
  return {onPlay, replay, active, targetEl, plot};
})();
