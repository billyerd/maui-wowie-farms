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
    el.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('button'); if(!b) return; const a=b.dataset.a; if(a==='play') start(); else if(a==='skip') skip(); else if(a==='next') next(); else if(a==='done') finish(); });
    return el;
  }
  function overlaps(a,b){ return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top; }
  function domBox(el,pad){
    if(!el||!el.getBoundingClientRect||!el.getClientRects().length) return null;
    const r=el.getBoundingClientRect(); if(r.width<2||r.height<2) return null;
    const s=getComputedStyle(el); if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0) return null;
    pad=pad||0; return {left:r.left-pad,top:r.top-pad,right:r.right+pad,bottom:r.bottom+pad};
  }
  function keepClear(){
    const hard=[], soft=[];
    if(window.R&&R.plotRect&&G.st){ for(const p of G.st.plots){ if(!p.owned||p.loc!==G.st.loc) continue; const r=R.plotRect(p); if(r&&r.right-r.left>2&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth) hard.push(r); } }
    if(window.R&&R._qb){ try{ const cv=document.getElementById('game'), cr=cv?cv.getBoundingClientRect():{left:0,top:0}; for(const b of R._qb()){ if(!b||!isFinite(b.x)||!isFinite(b.y)) continue; hard.push({left:b.x+cr.left-26,top:b.y+cr.top-26,right:b.x+cr.left+26,bottom:b.y+cr.top+26}); } }catch(e){} }
    const tr=domBox(targetEl(),12); if(tr) hard.push(tr);
    const gear=domBox(document.getElementById('settingsBtn'),6); if(gear) soft.push(gear);
    ['seedBag','scoutBtn','upgBtn','orderBoard','goal','toolbar','locTabs','hud'].forEach(id=>{ const b=domBox(document.getElementById(id),4); if(b) soft.push(b); });
    const pop=document.getElementById('pop'); if(pop&&!pop.classList.contains('hidden')){ const pr=domBox(pop,6); if(pr) hard.push(pr); }
    return {hard, soft};
  }
  function sheetCard(){ const sh=document.getElementById('sheet'); if(!sh||sh.classList.contains('hidden')) return null; return domBox(sh.querySelector('.sheet-card')||sh,0); }
  function place(){
    const el=document.getElementById('tutc'); if(!el||el.classList.contains('hidden')) return;
    const pad=8, maxW=Math.min(340, innerWidth-pad*2);
    const zones=keepClear(), sheet=sheetCard();
    const focus=domBox(targetEl(),0);
    function spot(w,hh,extra){
      const forbid=zones.hard.concat(extra||[]);
      const xs=[]; const push=x=>{ x=Math.round(Math.max(pad, Math.min(x, innerWidth-pad-w))); if(xs.indexOf(x)<0) xs.push(x); };
      push(pad); push(innerWidth-pad-w); push((innerWidth-w)/2);
      const side=document.getElementById('upgBtn'); if(side&&side.getClientRects().length){ const r=side.getBoundingClientRect(); if(r.width) push(r.right+8); }
      let best=null, bestScore=-1e9;
      for(let y=pad; y<=innerHeight-hh-pad; y+=8){
        for(let i=0;i<xs.length;i++){ const x=xs[i];
          const c={left:x,top:y,right:x+w,bottom:y+hh};
          let hit=false; for(let k=0;k<forbid.length;k++) if(overlaps(c,forbid[k])){ hit=true; break; }
          if(hit) continue;
          const cx=x+w/2, cy=y+hh/2;
          let score=focus?Math.hypot(cx-(focus.left+focus.right)/2, cy-(focus.top+focus.bottom)/2):Math.min(y, innerHeight-(y+hh));
          if(sheet&&overlaps(c,sheet)) score-=280;
          if(cy>innerHeight*.28&&cy<innerHeight*.72) score-=120;
          if(score>bestScore){ bestScore=score; best={x:x,y:y}; }
        }
      }
      return best;
    }
    el.classList.remove('compact');
    el.style.width=maxW+'px';
    let w=maxW, h=el.offsetHeight||120, found=spot(w,h,zones.soft);
    if(!found){ el.classList.add('compact'); h=el.offsetHeight||100; found=spot(w,h,zones.soft); }
    if(!found){ w=Math.min(maxW, 240); el.style.width=w+'px'; h=el.offsetHeight||100; found=spot(w,h,zones.soft)||spot(w,h,[]); }
    if(!found){ el.classList.add('compact'); w=Math.min(220, maxW); el.style.width=w+'px'; h=el.offsetHeight||88; found=spot(w,h,[])||spot(w,h,zones.soft); }
    if(!found) return;
    el.style.left=found.x+'px'; el.style.top=found.y+'px';
    const card={left:found.x,top:found.y,right:found.x+el.offsetWidth,bottom:found.y+el.offsetHeight};
    el.style.zIndex=(sheet&&overlaps(card,sheet))?'34':'12';
  }
  function fill(el,head,tip,acts){
    const sig=head+'\n'+tip+'\n'+acts.map(a=>a.a+a.cls+a.label).join('|');
    if(el._sig!==sig){ el._sig=sig; el.querySelector('.gt').textContent=head; el.querySelector('p').textContent=tip;
      el.querySelector('.acts').innerHTML=acts.map(a=>'<button type="button" class="btn '+(a.cls||'')+'" data-a="'+a.a+'">'+a.label+'</button>').join(''); }
  }
  function paint(){
    const t=tut(); if(!t||!t.on||t.done){ hide(); return; }
    const el=ensure(); const i=t.step|0; const step=STEPS[i];
    const head=step?'Unko Kuli · '+(i+1)+'/'+STEPS.length:'Unko Kuli';
    const tip=say(step||{id:'done'});
    const acts=step?[{a:'skip',cls:'sec',label:'Skip'},{a:'next',cls:'',label:'Next'}]:[{a:'skip',cls:'sec',label:'Skip'},{a:'done',cls:'gold',label:"Let's grow"}];
    fill(el,head,tip,acts);
    el.dataset.mode='coach'; el.classList.remove('hidden'); place();
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
  function start(){ const t=tut(); if(!t) return; t.on=true; t.done=false; t.skip=false; t.step=0; t.bought=t.bought|0; snap(); G.save(); paint(); }
  function offer(){
    const t=tut(); if(!t) return;
    const el=ensure();
    fill(el,'Unko Kuli',"This was your Grandpa's garage. Now it's yours. I can walk you through the first grow, or you can jump in.",[{a:'play',cls:'gold',label:'Play tutorial'},{a:'skip',cls:'sec',label:'Skip'}]);
    el.dataset.mode='offer'; el.classList.remove('hidden'); place();
    requestAnimationFrame(()=>place());
  }
  function onPlay(fresh){ const t=tut(); if(!t) return; if(t.on&&!t.done){ ensureBase(); paint(); return; } hide(); if(fresh&&!t.done&&!t.skip) offer(); }
  function replay(){
    const st=window.G&&G.st; if(!st) return;
    if(!st.tut||typeof st.tut!=='object'||Array.isArray(st.tut)) st.tut={v:1,step:0,on:false,done:false,skip:false,bought:0};
    start();
  }
  if(window.G&&G.on) ['seeds','plant','water','feed','harvest','dryload','sold','order','hire','land'].forEach(n=>G.on(n,sync));
  function follow(){ try{ const el=document.getElementById('tutc'); if(!el||el.classList.contains('hidden')) return; if(active()) sync(); else place(); }catch(e){} }
  const watch=new MutationObserver(follow);
  ['sheet','pop'].forEach(id=>{ const n=document.getElementById(id); if(n) watch.observe(n,{attributes:true,attributeFilter:['class']}); });
  setInterval(follow,400);
  window.addEventListener('resize',()=>{ const el=document.getElementById('tutc'); if(el&&!el.classList.contains('hidden')) place(); });
  return {onPlay, replay, active, targetEl, plot};
})();
