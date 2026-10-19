/* DOM UI: HUD, location tabs, toolbar, panels (bottom sheet / side sheet), shop, popovers, modals, toasts.
   Every control is tap-first (no hover-only UI). Features unlock gradually by level (G.GATE) and story. */
window.UI = (function(){
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const T=()=>window.GAME_CONFIG.title;
  let tool='hand', panel=null, tab=null, lastPointer=0, popPlot=null, saveUi=null, importDraft='', exportPack=null, helpUi=false, boughtKey=null, boughtTimer=0;
  const labA={v:null}, labB={v:null}, huntSel={v:null};
  const fmt=n=>G.fmt(n), sec=s=>G.dur(s);
  const tag=s=>`<span class="tag t-${s.rarity}">${s.rarity}</span>${s.island?'<span class="tag" style="background:#0f8f8a;color:#eafffd">Island</span>':''}${s.hemp?'<span class="tag" style="background:#6a8a3a;color:#f2ffe0">CBD</span>':''}${G.EVENT_ONLY[s.id]==='premium'?'<span class="tag" style="background:#ffd35a;color:#3a2500">Exclusive</span>':G.EVENT_ONLY[s.id]?'<span class="tag" style="background:#c05ad0;color:#fff">Festival</span>':''}`;
  const thc=s=>s.thc==null?'THC n/a':'THC '+s.thc+'%';
  const ico=(n,cls='')=>`<span class="ico ico-${n} ${cls}"></span>`;
  const gradeBadge=q=>`<span class="grade g${q}">${q}</span>`;
  const bar=(p,cls)=>`<div class="bar ${cls||''}"><i style="width:${Math.max(0,Math.min(1,p))*100}%"></i></div>`;
  const lvlLock=k=>`${ico('lock')} Level ${G.GATE[k]}`;
  // ---------- notices / modal ----------
  // Routine notices are non-blocking pills. Mold and pest stay as OK cards (William likes those).
  // OK cards are reserved for a choice or something the player must read: save problems, the away
  // rescue, big unlocks and prestige confirms, strain reveals the player opened, and pest/mold.
  const nq=[]; let noticeLive=null;
  const GROUP_TXT={ach:(n,first)=>n>1?n+' achievements!':first, pest:(n,first)=>first};
  function toast(text,kind='',group){
    if(group==='pest'){
      const same=it=>it.group==='pest';
      if(noticeLive&&same(noticeLive)){ noticeLive.n++; paintNotice(noticeLive); return; }
      const q=nq.find(same); if(q){ q.n++; return; }
      nq.push({text,kind,group:'pest',n:1,first:text}); if(nq.length>4) nq.shift();
      pumpNotices();
      return;
    }
    showPill(text,kind,group);
  }
  function canopyTop(){
    try{
      if(!window.R||!R.bedSprites) return 0;
      const list=R.bedSprites();
      let top=1e9;
      for(let i=0;i<list.length;i++){
        const s=list[i];
        if(s&&typeof s.top==='number'&&s.top<top) top=s.top;
      }
      return top<1e8?top:0;
    }catch(e){ return 0; }
  }
  function livePill(){
    const el=document.querySelector('#toasts .toast, #achToasts .toast');
    if(!el||!el.getClientRects||!el.getClientRects().length) return null;
    return el;
  }
  function setSheetGap(px){
    const body=document.getElementById('sheetBody');
    if(!body) return;
    const next=px>0?Math.ceil(px)+'px':'';
    if(body.style.marginBottom!==next) body.style.marginBottom=next;
  }
  function goalBannerBottom(){
    const g=document.getElementById('goal');
    if(!g||!g.classList||!g.classList.contains('open')) return 0;
    const tx=g.querySelector('.gtx');
    if(!tx||!tx.getBoundingClientRect) return 0;
    const r=tx.getBoundingClientRect();
    return r.height>8?r.bottom:0;
  }
  let sheetGapOn=false, dockY=0;
  function bagRows(body){
    if(!body) return [];
    const view=body.getBoundingClientRect();
    const out=[];
    body.querySelectorAll('[data-pickseed]').forEach(el=>{
      if((el.textContent||'').indexOf('in the bag')<0) return;
      const r=el.getBoundingClientRect();
      const top=Math.max(r.top, view.top), bottom=Math.min(r.bottom, view.bottom);
      if(bottom-top>4) out.push({top, bottom});
    });
    return out;
  }
  function pillHits(y, ph, rows){
    return rows.some(r=>y<r.bottom-1 && y+ph>r.top+1);
  }
  function toastTop(){
    const H=window.innerHeight||800;
    if(sheetOpen()){
      const bar=document.getElementById('toolbar');
      const foot=document.getElementById('sheetFoot');
      const body=document.getElementById('sheetBody');
      const fr=foot&&foot.getClientRects&&foot.getClientRects().length?foot.getBoundingClientRect():null;
      const br=bar&&bar.getBoundingClientRect?bar.getBoundingClientRect():null;
      const anchor=(fr&&fr.height>8&&fr.top>120)?fr.top:(br&&br.top>120?br.top:H-80);
      const pill=livePill();
      const ph=pill?Math.max(22, pill.getBoundingClientRect().height):0;
      if(!ph){ sheetGapOn=false; setSheetGap(0); return Math.max(64, Math.round(anchor-44)); }
      // Just above the sheet foot. A long notice that would cover the last
      // visible seed row keeps a gap under those rows until the notice is gone.
      const yLow=Math.max(64, Math.round(anchor-Math.max(44, ph+12)));
      if(!sheetGapOn && pillHits(yLow, ph, bagRows(body))) sheetGapOn=true;
      setSheetGap(sheetGapOn?ph+14:0);
      if(sheetGapOn && body){
        const bb=body.getBoundingClientRect();
        if(bb.height>40) return Math.max(64, Math.round(bb.bottom+4));
      }
      return yLow;
    }
    sheetGapOn=false;
    setSheetGap(0);
    // Under the HUD when the goal card is closed. Below the card when it is open,
    // so the pill does not cover "Tap to claim".
    let y=56, hudB=0;
    const hud=document.getElementById('hud');
    if(hud&&hud.getBoundingClientRect){
      const r=hud.getBoundingClientRect();
      if(r.height>8 && r.bottom<H*0.55){ hudB=r.bottom; y=Math.max(56, Math.round(r.bottom+6)); }
    }
    const banner=goalBannerBottom();
    if(banner>40) return Math.max(108, Math.round(banner+6));
    const leaf=canopyTop(), slim=22;
    if(leaf>72 && y+slim+4>leaf) y=Math.max(56, hudB+4, Math.round(leaf-slim-6));
    return Math.max(56, Math.round(y));
  }
  function placeToasts(){
    let y=toastTop();
    // Ignore a 1px layout wobble so the slide does not restart every frame.
    if(dockY && Math.abs(y-dockY)<3) y=dockY; else dockY=y;
    const top=y+'px';
    const root=document.documentElement.style;
    if(root.getPropertyValue('--dock-top')!==top) root.setProperty('--dock-top', top);
    [document.getElementById('toasts'), document.getElementById('achToasts')].forEach(box=>{
      if(!box) return;
      if(box.style.top!==top) box.style.top=top;
      box.style.bottom='auto';
      if(box.style.getPropertyValue('--dock-top')!==top) box.style.setProperty('--dock-top', top);
      box.style.zIndex='60';
    });
  }
  function sheetOpen(){ return !!(document.body&&document.body.classList&&document.body.classList.contains('sheet-open')); }
  let pillSeq=0;
  function capToasts(){
    const live=[];
    ['toasts','achToasts'].forEach(id=>{
      const box=document.getElementById(id);
      if(box&&box.querySelectorAll) box.querySelectorAll('.toast').forEach(el=>live.push(el));
    });
    // One pill. A burst in the same moment keeps the last line. After that, the
    // line that is already up stays: a long harvest summary until it expires,
    // and a short note for a beat so a late achievement does not erase it.
    const now=Date.now();
    const age=el=>now-(+el.dataset.at||now);
    const seq=el=>+el.dataset.seq||0;
    const newer=(a,b)=>seq(a)>=seq(b)?a:b;
    const longs=live.filter(el=>el.classList&&el.classList.contains('long')&&age(el)<2600);
    const held=live.filter(el=>age(el)>=40&&age(el)<500);
    const pool=longs.length?longs:(held.length?held:live);
    let best=pool[0];
    for(const el of pool) best=newer(best, el);
    live.forEach(el=>{
      if(el===best) return;
      if(el._t) clearTimeout(el._t);
      if(el.remove) el.remove();
    });
  }
  function clipToast(text){
    return String(text||'').replace(/\s+/g,' ').trim();
  }
  function achHost(){
    let box=document.getElementById('achToasts');
    if(!box){ box=document.createElement('div'); box.id='achToasts'; document.body.appendChild(box); }
    return box;
  }
  function showPill(text,kind,group){
    let box=group==='ach'?achHost():document.getElementById('toasts');
    if(!box){ box=document.createElement('div'); box.id='toasts'; document.body.appendChild(box); }
    if(box.classList) box.classList.remove('dock');
    placeToasts();
    const k=noticeKind(kind), long=/(^|\s)long(\s|$)/.test(String(kind||''));
    const kids=box.querySelectorAll? [...box.querySelectorAll('.toast')]:[];
    const same=kids.find(el=>group?el.dataset.group===group:el.dataset.raw===String(text));
    if(same){
      const n=(+same.dataset.n||1)+1; same.dataset.n=String(n);
      const first=same.dataset.first||same.dataset.raw||text;
      same.textContent=clipToast(group&&GROUP_TXT[group]?GROUP_TXT[group](n,first):(n>1?first+'  ×'+n:first));
      same.dataset.seq=String(++pillSeq);
      same.dataset.at=String(Date.now());
      armPill(same, long||same.classList.contains('long'));
      capToasts();
      return;
    }
    const el=document.createElement('div');
    el.className='toast'+(k?' '+k:'')+(long?' long':'');
    el.dataset.raw=String(text||''); el.dataset.first=String(text||''); el.dataset.n='1';
    el.dataset.seq=String(++pillSeq);
    el.dataset.at=String(Date.now());
    if(group) el.dataset.group=group;
    el.textContent=clipToast(group&&GROUP_TXT[group]?GROUP_TXT[group](1,text):String(text||''));
    if(box.appendChild) box.appendChild(el);
    capToasts();
    armPill(el, long);
    placeToasts();
  }
  function armPill(el, long){
    if(!el) return;
    clearTimeout(el._t); if(el.classList&&el.classList.remove) el.classList.remove('out');
    el.dataset.ms='2500';
    el._t=arm(()=>{ if(el.classList) el.classList.add('out'); arm(()=>{ if(el.remove) el.remove(); },240); }, 2500);
  }
  // A short note under the HUD. Used for the tutorial skip.
  function brief(text){
    let box=document.getElementById('toasts');
    if(!box){ box=document.createElement('div'); box.id='toasts'; document.body.appendChild(box); }
    if(box.classList) box.classList.remove('dock');
    placeToasts();
    const el=document.createElement('div'); el.className='toast';     el.dataset.ms='2500'; el.dataset.seq=String(++pillSeq); el.dataset.at=String(Date.now()); el.textContent=clipToast(text); box.appendChild(el);
    capToasts();
    setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>{ if(el.remove) el.remove(); else if(el.parentNode) el.parentNode.removeChild(el); },240); },2500);
  }
  // A tiny note. No OK button, and it does not open a sheet.
  let pipFade=0, pipHide=0;
  function arm(fn,ms){ const t=setTimeout(fn,ms); if(t&&t.unref) t.unref(); return t; }
  function pip(text){
    let el=document.getElementById('seedPip');
    if(!el){ el=document.createElement('div'); el.id='seedPip'; el.setAttribute('role','status'); document.body.appendChild(el); }
    el.textContent=String(text||'');
    el.classList.remove('hidden','out');
    clearTimeout(pipFade); clearTimeout(pipHide);
    pipFade=arm(()=>{ el.classList.add('out'); pipHide=arm(()=>el.classList.add('hidden'),180); },1500);
  }
  function label(it){ if(it.group&&GROUP_TXT[it.group]) return GROUP_TXT[it.group](it.n,it.first); return it.n>1?it.text+'  ×'+it.n:it.text; }
  function noticeKind(kind){ return (String(kind||'').split(/\s+/).find(k=>k==='good'||k==='bad'||k==='gemt'))||''; }
  function paintNotice(it){ const p=document.querySelector('#modalCard p.notice'); if(p) p.textContent=label(it); }
  function splashUp(){ const s=document.getElementById('splash'); return !!(s&&!s.classList.contains('gone')); }
  function pumpNotices(){
    if(!nq.length||noticeLive||mOpen||cOpen||cq.length) return;
    if(celWait.length){ setTimeout(pumpNotices,300); return; }
    if(splashUp()){ setTimeout(pumpNotices,400); return; }
    const it=nq.shift(); if(!it) return;
    noticeLive=it;
    const k=noticeKind(it.kind);
    modal(`<p class="notice${k?' '+k:''}">${esc(label(it))}</p>`,[{label:'OK',cls:'gold',v:'ok'}]).then(()=>{ noticeLive=null; setTimeout(pumpNotices,0); });
  }
  const mq=[]; let mOpen=false;
  function modal(html,acts){ return new Promise(res=>{ mq.push({html,acts,res}); if(!mOpen&&!cOpen) nextModal(); }); }
  function nextModal(){ const it=mq.shift(); const m=$('#modal'), c=$('#modalCard'); if(!it){ mOpen=false; m.classList.add('hidden'); if(cq.length&&!cOpen){ setTimeout(()=>{ if(!mOpen&&!cOpen) nextCel(); },200); return; } if(celWait.length) setTimeout(()=>{ while(celWait.length&&!mOpen) loginCel(celWait.shift()); },250); setTimeout(pumpNotices,0); return; } mOpen=true;
    c.innerHTML=it.html+`<div class="acts">${it.acts.map((a,i)=>`<button class="btn ${a.cls||''}" data-i="${i}">${a.label}</button>`).join('')}</div>`;
    paintStrainImgs(c);
    m.classList.remove('hidden'); Sound.play('open');
    c.querySelectorAll('.acts .btn').forEach(b=>b.onclick=()=>{ m.classList.add('hidden'); it.res(it.acts[+b.dataset.i].v); setTimeout(nextModal,120); }); }
  // ---------- celebrations (level up, login streak, milestones) ----------
  const cq=[]; let cOpen=false;
  function celebrate(html,dur){ cq.push({html,dur}); if(!cOpen&&!mOpen&&!splashUp()) nextCel(); else if(!cOpen) setTimeout(()=>{ if(!cOpen&&!mOpen&&cq.length) nextCel(); },600); }
  function nextCel(){ const it=cq.shift(), el=$('#celebrate'); if(!it){ cOpen=false; el.classList.add('hidden'); if(mq.length&&!mOpen) setTimeout(()=>{ if(!mOpen&&!cOpen) nextModal(); },150); else setTimeout(pumpNotices,0); return; } if(mOpen||splashUp()){ cq.unshift(it); cOpen=false; setTimeout(()=>{ if(!cOpen&&!mOpen) nextCel(); },500); return; } cOpen=true;
    el.innerHTML='<div class="cel-card">'+it.html+'<div class="acts"><button class="btn gold" type="button">OK</button></div></div>'; el.classList.remove('hidden');
    const card=el.querySelector('.cel-card'); card.style.animation='none'; card.offsetHeight; card.style.animation='';
    confetti(); const btn=el.querySelector('button'); btn.onclick=()=>{ btn.onclick=null; el.classList.add('hidden'); setTimeout(nextCel,150); }; }
  let conf=[], confRaf=0;
  function confetti(n=110){ if(G.st&&G.st.settings.motion===false) return; try{ if(localStorage.getItem('mwf_noconfetti')) return; }catch(e){} const cv=$('#confetti'), d=Math.min(2,devicePixelRatio||1); cv.width=innerWidth*d; cv.height=innerHeight*d;
    const cols=['#ffd76a','#ff6fb1','#6fe3ff','#8dff8a','#ffffff','#ff9f43','#b97bff'];
    n=Math.min(n,Math.max(0,260-conf.length)); for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, v=4+Math.random()*9; const side=i%2, cel=cOpen; if(i===0){ var eL=8,eR=innerWidth-8; for(const id of ['seedBag','scoutBtn','upgBtn']){ const e=document.getElementById(id); if(e&&e.getClientRects().length){ const r=e.getBoundingClientRect(); eL=Math.max(eL,r.right+6); } } const lt=document.getElementById('locTabs'); if(lt&&lt.getClientRects().length) eR=Math.min(eR,lt.getBoundingClientRect().left-6); } conf.push({x:cel?innerWidth/2:(side?eR:eL),y:cel?innerHeight*.45:innerHeight*.7,vx:cel?Math.cos(a)*v:(side?-1:1)*(1.2+Math.random()*3.2),vy:cel?Math.sin(a)*v-6:-6-Math.random()*6,r:Math.random()*6.28,vr:(Math.random()-.5)*.4,w:5+Math.random()*6,h:3+Math.random()*4,c:cols[i%cols.length],t:0,shape:Math.random()<.25}); }
    if(!confRaf) confRaf=requestAnimationFrame(confStep); }
  function confStep(){ const cv=$('#confetti'), x=cv.getContext('2d'), d=cv.width/innerWidth; x.setTransform(d,0,0,d,0,0); x.clearRect(0,0,innerWidth,innerHeight);
    conf=conf.filter(p=>p.y<innerHeight+30&&p.t<240); conf.forEach(p=>{ p.t++; p.vy+=.22; p.vx*=.985; p.vy*=.985; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; x.save(); x.translate(p.x,p.y); x.rotate(p.r); x.fillStyle=p.c;
      if(p.shape){ x.beginPath(); for(let k=0;k<5;k++){ const a=k*Math.PI/2.5; x.ellipse(Math.cos(a)*3,Math.sin(a)*3,3.2,1.8,a,0,6.3); } x.fill(); } else x.fillRect(-p.w/2,-p.h/2,p.w,p.h*Math.abs(Math.cos(p.r*2))+1); x.restore(); });
    for(const id of ['hud','goal','toolbar','menu','locTabs','orderBoard','seedBag','scoutBtn','upgBtn','toasts','gainLane']){ const e=document.getElementById(id); if(!e||!e.getClientRects().length) continue; const r=e.getBoundingClientRect(); if(r.width) x.clearRect(r.left-4,r.top-4,r.width+8,r.height+8); }
    confRaf=conf.length?requestAnimationFrame(confStep):0; if(!conf.length) x.clearRect(0,0,innerWidth,innerHeight); }
  function levelUp(o){
    const items=[...o.miles.map(m=>`<li>${ico('lock')} <b>Unlocked:</b> ${esc(m)}</li>`),...o.strains.map(s=>`<li>${ico('seed')} <b>New seeds:</b> ${esc(s.name)} <span class="tag t-${s.rarity}" style="font-size:12px">${s.rarity}</span></li>`)];
    const nx=nextMilestone(o.L);
    celebrate(`<div style="font-size:12px;font-weight:900;letter-spacing:3px;color:#9fe8ff">LEVEL UP</div><div class="lv">${o.L}</div><h3>Nice work! Level ${o.L}</h3><div class="rw"><span>${ico('gem')} +${o.gems}</span><span>${ico('coin')} +${fmt(o.cash)}</span></div>${items.length?`<ul>${items.join('')}</ul>`:''}${nx?`<div style="font-size:12px;color:#cfe">Next unlock at level ${nx.L}: ${esc(nx.t)}</div>`:''}`, items.length?5200:3200);
  }
  function nextMilestone(L){ const M=G.MILES; for(let l=L+1;l<=60;l++){ if(M[l]) return {L:l,t:M[l][0]}; const s=G.S.find(x=>x.game.unlockLevel===l&&(x.tier<=2||!x.parents.length)); if(s) return {L:l,t:s.name+' seeds'}; } return null; }
  function streakHTML(today){ const st=G.st, n=today?st.streak.n:G.dailyReady()?G.streakDay():st.streak.n; const cyc=Math.floor((n-1)/7)*7;
    return `<div class="streak">${G.LOGIN.map((r,i)=>{ const d=cyc+i+1; const cls=d<n?'got':d===n?(today||!G.dailyReady()?'today':'got'):''; const lab=r.legPacks?'Leg.':r.rarePacks?'Rare':r.cash?'Cash':''; return `<div class="${d===n&&(today||G.dailyReady())?'today':cls}">Day<br>${d}<b>${r.gems}${ico('gem')}</b>${lab}</div>`; }).join('')}</div>`; }
  const celWait=[];
  function loginCel(o){ if(G.st.quest<=4&&!window.__giftForce){ setTimeout(()=>loginCel(o),3000); return; } window.__giftForce=0;
    if(document.getElementById('splash')){ setTimeout(()=>loginCel(o),400); return; }
    toast('Daily gift ready!','gemt'); }
  // ---------- big milestone celebrations ----------
  function bigCel(kind){
    const C={land:['art/island-bg.webp','The Indoor Facility is yours!','Uncle Ikaika hands you the keys. The terraces are ready, and Grandpa\'s garage is now your Pheno Room.'],
      ghbuilt:['art/greenhouse.webp','Greenhouse built!','Glass, raised beds and fans. Weather still matters, but beds yield 35% more than the garage.'],
      permit:['art/indoor.webp','County Agricultural Permit approved','Auntie Lani stamps your paperwork. The indoor facility is one step closer.'],
      indoor:['art/indoor.webp','Indoor facility open!','Sealed rooms, rolling benches and LED bars. Double yield and AAA grade, with real running costs.']}[kind];
    if(!C) return; Sound.play('level');
    celebrate(`<div style="font-size:12px;font-weight:900;letter-spacing:3px;color:#9fe8ff">MILESTONE</div><img src="${C[0]}" alt="" style="width:min(320px,76vw);border-radius:16px;margin:8px auto;display:block;box-shadow:0 6px 24px rgba(0,0,0,.4)"><h3>${C[1]}</h3><p style="color:#dfe;max-width:320px;margin:0 auto">${C[2]}</p>`,6500);
  }
  // mystery strain reveal: silhouette -> painted close-up
  function reveal(s){ Sound.play('discover'); confetti(140);
    modal(`<div class="reveal"><img class="r-sil" data-cu="${s.id}" data-sz="220" data-h="1" alt=""><img class="r-real" data-cu="${s.id}" data-sz="220" data-h="0" alt=""></div><div style="font-size:12px;font-weight:900;letter-spacing:3px;color:#d9a8ff">PHENO DISCOVERED</div><h3>${esc(s.name)}</h3><div>${tag(s)}</div><p>${esc((s.parents||[]).join(' × '))}<br>Recipe recorded in your Strain Book. Seeds unlocked (+3 in your bag).</p>`,[{label:'Details',cls:'sec',v:'d'},{label:'Thanks!',cls:'gold'}]).then(v=>{ if(v==='d') strainModal(s.id); }); }

  // ---------- HUD ----------
  let shownCash=0, xpVis=null, xpLv=0;
  const LOCI={garage:'🏠',farm:'🌿',indoor:'🏭'};
  function landReq(){ const st=G.st; return [{t:'Reach level '+G.LAND_LEVEL,ok:st.level>=G.LAND_LEVEL,p:Math.min(1,(st.level-1+st.xp/G.xpNeed(st.level))/(G.LAND_LEVEL-1))},{t:'Save '+fmt(G.LAND_COST),ok:st.cash>=G.LAND_COST,p:st.cash/G.LAND_COST}]; }
  let goalT=0; function goalPeek(ms){ const g=$('#goal'); if(!g) return; g.classList.add('open'); clearTimeout(goalT); goalT=setTimeout(()=>g.classList.remove('open'),ms); }
  function orderBoard(){ const st=G.st, n=$('#obN'), t=$('#obTop'); if(!n) return; let nv, tv; if(st.level<G.GATE.orders){ nv='🔒'; tv='Unlocks at level '+G.GATE.orders; } else { nv=String(st.orders.length); const o=st.orders[0], s=o&&G.strain(o.s); tv=o&&s?`${o.who}: ${o.n}× ${s.name.split(' ')[0]} · ${G.orderHave(o)>=o.n?'ready ✓':G.orderHave(o)+'/'+o.n}`:'No orders right now'; }
    if(n.textContent!==nv) n.textContent=nv; if(t.textContent!==tv) t.textContent=tv; }
  let bagMeasureOk=null, bagFitKey='', bagFitName='';
  function bagMeasure(text, font){
    try{
      if(!document.createElement) return -1;
      const c=bagMeasure.c||(bagMeasure.c=document.createElement('canvas'));
      const x=c.getContext&&c.getContext('2d');
      if(!x||typeof x.measureText!=='function') return -1;
      x.font=font||'800 8px system-ui,sans-serif';
      const w=x.measureText(String(text||'')).width;
      return (typeof w==='number'&&isFinite(w))?w:-1;
    }catch(e){ return -1; }
  }
  function bagCanMeasure(){
    if(bagMeasureOk!=null) return bagMeasureOk;
    const a=bagMeasure('i','800 13px system-ui,sans-serif');
    const b=bagMeasure('Peanut Butter Breath','800 13px system-ui,sans-serif');
    bagMeasureOk=a>0&&b>a+8;
    return bagMeasureOk;
  }
  function labelFont(el){
    try{
      if(typeof getComputedStyle==='function'&&el){
        const cs=getComputedStyle(el);
        if(cs&&cs.fontSize) return (cs.fontWeight||'800')+' '+cs.fontSize+' '+(cs.fontFamily||'system-ui,sans-serif');
      }
    }catch(e){}
    return '800 8px system-ui,sans-serif';
  }
  // Handmade tab labels, longest first. Used only when the full name does not fit.
  const TAB_SHORT={
    acdc:['ACDC'],
    'menehune-mint':['MM'],
    'apple-fritter':['AF'],
    biscotti:['BISC'],
    'blue-dream':['BD'],
    'honu-blue':['HB'],
    'blueberry-pancakes':['BP'],
    'cereal-milk':['CM'],
    naupaka:['NAUP'],
    chemdawg:['CHEM'],
    'cherry-wine':['CW'],
    'do-si-dos':['DOSI'],
    'double-og-chem':['DOC'],
    'dulce-de-uva':['DDU'],
    'durban-poison':['DP'],
    'gary-payton':['GP'],
    'lilikoi-pop':['LP'],
    gelato:['GELATO','GEL'],
    'glitter-bomb':['GB'],
    'gmo-cookies':['GMO'],
    'granddaddy-purple':['GDP'],
    'grape-cream-cake':['GCC'],
    gsc:['GSC'],
    'gush-mints':['GM'],
    harlequin:['HARL'],
    'hash-burger':['HBUR'],
    'ice-cream-cake':['ICC'],
    jealousy:['JEAL'],
    'kush-mints':['KM'],
    'lemon-cherry-gelato':['LCG'],
    mac:['MAC'],
    'mendo-breath':['MB'],
    mimosa:['MIMO'],
    'northern-lights':['NL'],
    'og-kush':['OG'],
    'peanut-butter-breath':['PBB'],
    'permanent-marker':['PM'],
    'purple-punch':['PP'],
    'roswell-47':['R47'],
    rs11:['RS11'],
    runtz:['RUNTZ','RUNT'],
    slurricane:['SLUR'],
    'sour-diesel':['SD'],
    'super-boof':['BOOF'],
    'trop-cherry':['TC'],
    'tropical-slushie':['TS'],
    'wedding-cake':['WC'],
    'white-truffle':['WT'],
    zkittlez:['Z'],
    zoap:['ZOAP'],
    'maui-wowie':['MW'],
    'kona-gold':['KG'],
    'hawaiian-snow':['HS'],
    'puna-budder':['PB'],
    'hawaiian-haze':['HH'],
    hawaiian:['HAWA'],
    'kauai-electric':['KE']
  };
  function fitTab(s, count, budget){
    const full=String(s.name||'').replace(/\s+/g,' ').trim()||'Seed';
    const words=full.split(' ').filter(Boolean);
    // Measuring is unavailable in a couple of headless stubs. Keep the full name there.
    if(!bagCanMeasure()||!(budget>8)) return full;
    const font=labelFont($('#sbName'));
    const room=budget-bagMeasure(count, font)-2;
    const px=(/(\d+(?:\.\d+)?)px/.exec(font)||[])[1];
    const track=0.06*(px?+px:7);
    const wide=t=>{
      const raw=bagMeasure(t, font);
      if(!(raw>=0)) return raw;
      const n=String(t).length;
      return n>1?raw-track*(n-1):raw;
    };
    const fits=t=>!!t&&wide(t)<=room+0.5;
    if(fits(full)) return full;
    const shorts=TAB_SHORT[s&&s.id];
    if(shorts&&shorts.length){
      for(const t of shorts) if(fits(t)) return t;
      return shorts[shorts.length-1];
    }
    if(words.length>1) return words.map(w=>(w[0]||'').toUpperCase()).join('')||full;
    return (words[0]||full).slice(0,4).toUpperCase();
  }
  function seedBag(){
    if(G.ensureSeed) G.ensureSeed();
    const st=G.st, n=$('#sbName'), c=$('#sbCount'); if(!n||!c) return;
    const s=G.strain(st.selSeed), have=!!(s&&(st.seeds[s.id]||0)>0);
    const bag=$('#seedBag');
    let nm, ct, al;
    if(!have){
      nm='No seeds'; ct='';
      al='No seeds. Open the shop to buy seeds.';
    }else{
      ct=(st.seeds[s.id]||0)+'×';
      const w=bag&&bag.clientWidth>8?bag.clientWidth:32;
      const key=s.id+'|'+ct+'|'+w+'|'+(bagCanMeasure()?'m':'x');
      if(key!==bagFitKey){ bagFitKey=key; bagFitName=fitTab(s, ct, Math.max(8, w-1)); }
      nm=bagFitName;
      al='Seed bag: '+s.name+', '+(st.seeds[s.id]||0)+'. Pick a seed or buy more.';
    }
    if(n.textContent!==nm) n.textContent=nm;
    if(c.textContent!==ct) c.textContent=ct;
    if(bag){
      bag.classList.toggle('is-empty', !have);
      if(bag.getAttribute('aria-label')!==al) bag.setAttribute('aria-label', al);
    }
    const line=$('#seedName');
    if(line){
      const show=!!(have&&s&&s.name);
      if(show){
        if(line.textContent!==s.name) line.textContent=s.name;
        line.classList.remove('hidden');
      }else{
        if(line.textContent) line.textContent='';
        line.classList.add('hidden');
      }
    }
  }
  function seedPick(){ const st=G.st, el=$('#seedPick'); if(!el.classList.contains('hidden')){ el.classList.add('hidden'); return; }
    const own=G.S.filter(s=>(st.seeds[s.id]||0)>0).sort((a,b)=>a.game.growSec-b.game.growSec);
    el.innerHTML=`<div class="sp-h">Seed bag</div>`+(own.length?own.map(s=>`<button class="sp-row${st.selSeed===s.id?' on':''}" data-pick="${s.id}"><img src="art/seed_48.webp" alt=""><span class="sp-n"><b>${esc(s.name)}</b><small>⏱ ${sec(s.game.growSec)}</small></span><em>${st.seeds[s.id]}×</em></button>`).join(''):`<p class="sp-e">Bag's empty. Grab seeds at the shop.</p>`)+`<button class="sp-shop" data-pick="__shop">Seed shop</button>`;
    el.classList.remove('hidden'); Sound.play('open'); }
  function locChoices(){
    const st=G.st, cur=G.currentRoom();
    const rows=[
      {r:'garage', name:'Garage', sub:cur==='garage'?'Here now':'Open'},
      {r:'gh', name:'Greenhouse', sub:st.ghBuilt?(cur==='gh'?'Here now':'Open'):('Level '+G.GH_BUILD.level+' · '+fmt(G.GH_BUILD.cost))},
      {r:'facility', name:'Indoor Facility', sub:st.land?(cur==='facility'?'Here now':'Open'):('Level '+G.LAND_LEVEL+' · '+fmt(G.LAND_COST))}
    ];
    if(st.inBuilt) rows.push({r:'benches', name:'Benches', sub:cur==='benches'?'Here now':'Open'});
    return rows;
  }
  function paintLocPick(pick){
    const cur=G.currentRoom(), st=G.st;
    const html=locChoices().map(row=>{
      const on=row.r===cur?' on':'';
      const locked=(row.r==='gh'&&!st.ghBuilt)||(row.r==='facility'&&!st.land)?' locked':'';
      return `<button type="button" data-room="${row.r}" class="${(on+locked).trim()}"><b>${esc(row.name)}</b><small>${esc(row.sub)}</small></button>`;
    }).join('');
    if(pick._h!==html){ pick._h=html; pick.innerHTML=html; }
  }
  function closeLocPick(){ const pick=$('#locPick'), lb=$('#locBtn'); if(pick) pick.classList.add('hidden'); if(lb) lb.setAttribute('aria-expanded','false'); }
  function toggleLocPick(){
    const pick=$('#locPick'), lb=$('#locBtn'); if(!pick) return;
    const willOpen=pick.classList.contains('hidden');
    hidePop();
    if(!willOpen) return;
    paintLocPick(pick); pick.classList.remove('hidden');
    if(lb) lb.setAttribute('aria-expanded','true');
    Sound.play('open');
  }
  function locTabs(){
    const cur=G.currentRoom();
    const names={garage:'Garage',gh:'Greenhouse',facility:'Indoor Facility',benches:'Benches'};
    const shown={garage:'Garage',gh:'Green',facility:'Indoor',benches:'Bench'};
    const ico={garage:'🏠',gh:'🌿',facility:'🏭',benches:'💡'};
    const lb=$('#locBtn');
    if(lb){
      const ripe=G.roomRipe?G.roomRipe(cur):0;
      const name=names[cur]||'Garage';
      const sm=lb.querySelector('small'), ic=lb.querySelector('.li');
      if(sm&&sm.textContent!==(shown[cur]||name)) sm.textContent=shown[cur]||name;
      if(ic) ic.textContent=ico[cur]||'🏠';
      const al='Location: '+name+(ripe?' · '+ripe+' ready':'')+'. Garage, Greenhouse, and Indoor Facility.';
      if(lb.getAttribute('aria-label')!==al) lb.setAttribute('aria-label',al);
      lb.classList.toggle('ripe',!!ripe);
    }
    const el=$('#locTabs'); if(el&&el.childElementCount){ el.innerHTML=''; el.dataset.rooms=''; }
    const pick=$('#locPick'); if(pick&&!pick.classList.contains('hidden')) paintLocPick(pick);
    placeToasts();
  }
  function hud(dt){
    const st=G.st;
    // Chase the live balance. Restarting a timed ease whenever cash changes (upkeep does, every frame) froze the label on the value from load.
    { const target=st.cash, gap=target-shownCash;
      if(Math.abs(gap)<0.5) shownCash=target;
      else { const dt0=Math.max(0,Math.min(0.25,typeof dt==='number'&&dt>0?dt:0)), k=dt0?1-Math.pow(0.001,dt0/0.45):0; shownCash+=gap*k; if(Math.abs(shownCash-target)<0.5) shownCash=target; } }
    $('#cash').textContent=fmt(shownCash); $('#gems').textContent=G.num(st.gems);
    { const ring=$('#xpRing'), box=$('#lvlBox'), lvEl=$('#lvl'), lv=st.level|0;
      if(lvEl){ const digits=String(Math.max(0,lv)).length; lvEl.textContent=String(lv); lvEl.style.fontSize=digits>=3?'13px':digits===2?'15px':'17px'; }
      if(ring){ const need=G.xpNeed(lv)||1, pct=Math.max(0,Math.min(1,st.xp/need));
        if(xpVis==null||lv!==xpLv){ xpVis=(xpLv&&lv!==xpLv)?0:pct; xpLv=lv; }
        const dt0=Math.max(0,Math.min(0.25,typeof dt==='number'&&dt>0?dt:0)), k=dt0?1-Math.pow(0.001,dt0/0.4):1;
        xpVis+=(pct-xpVis)*k; if(Math.abs(xpVis-pct)<0.003) xpVis=pct;
        const C=2*Math.PI*18; ring.style.strokeDasharray=(xpVis<=0.004?0:C*xpVis)+' '+C;
        if(box) box.setAttribute('aria-label','Level '+lv+', '+Math.round(pct*100)+'% to next'); } }
    const m=G.earnMult(); $('#multBadge').textContent='x'+(m<10?m.toFixed(1):Math.round(m)); $('#multBadge').style.display=m>1.001?'':'none';
    const ph=G.dayPhase(), hh=Math.floor(ph*24), mm=Math.floor((ph*24-hh)*60), w=G.WEATHER[st.weather.type];
    { const sm=innerWidth<520, se=G.SEASONS[G.season()], extra=(sm&&(G.marketDay()||G.evFx('swell'))?'':' · '+(sm?se.name.split(' ')[0]:se.name))+(G.marketDay()?(sm?' · Market':' · Market day'):'')+(G.evFx('swell')?(sm?' · Swell':' · Big swell'):''), wn=st.weather.rainbow>0?(sm?'Rainbow':'Rainbow +10%'):w.name;
      $('#clockTxt').textContent=`${sm?'D':'Day '}${Math.floor(st.time/G.DAY_LEN)+1} · ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} · ${sm&&extra?wn.split(' ')[0]:wn}${extra}`; }
    $('#clock').classList.remove('warn');
    const wet=G.invCount('wet'), sellable=G.invCount('dry')+G.invCount('cured')+G.goodsCount();
    $('#procBadge').textContent=wet?G.num(wet):''; const qr=G.questsReady()+(G.st.questDone?1:0); $('#qBadge').textContent=qr||'';
    $('#mktBadge').textContent=sellable?G.num(sellable):'';
    // Nothing pink announces itself. The festival stays on the Story card, the tourist
    // rush stays on the Market panel, and boost timers stay in the shop.
    const ec=$('#eventChip'); if(ec){ if(ec.textContent) ec.textContent=''; ec.classList.add('hidden'); }
    const bh=$('#boostHud'); if(bh){ bh.textContent=''; bh.classList.add('hidden'); }
    const s=G.strain(st.selSeed);
    if(s&&$('#seedLbl')){ $('#seedLbl').textContent=(st.seeds[s.id]||0)+'× '+s.name.split(' ')[0]; }
    const q=G.curQuest(), g=$('#goal');
    if(q){ const r=q.r.cash?fmt(q.r.cash):q.r.gems?q.r.gems+' gems':q.r.hints+' hint'+(q.r.hints>1?'s':''); const who=G.F.storyGoals&&q.who?q.who:null;
      const claim=!!(st.questDone&&G.questMet&&G.questMet(q));
      const h=`${who?portraitImg(who,'gport'):'<span class="gport" style="display:grid;place-items:center;background:#24402c;border-radius:50%">🎯</span>'}<i class="gdot"></i><div class="gtx"><div class="gt">${claim?'Goal complete! Tap to claim':(who?esc(who)+' · ':'')+'Goal '+(st.quest+1)+'/'+G.QUESTS.length}</div>${esc(q.t)} <span class="gr">${r}</span></div>`;
      if(g._h!==h){ const first=g._h==null; g._h=h; g.innerHTML=h; if(!first) goalPeek(4500); } g.classList.toggle('done',claim); g.setAttribute('aria-label', who||'Goal'); }
    else if(g._h!==''){ g._h=''; g.innerHTML=''; }
    // story glow. The tutorial card points on its own, so the two hands don't fight.
    const tutOn=window.Tutorial&&Tutorial.active&&Tutorial.active();
    const gq=!tutOn&&q&&!st.questDone&&st.quest<7?{plant:'#seedBag',dry:'[data-panel=process]',sell:'[data-panel=market]',gcap:'[data-panel=upgrades]',feed:null}[q.id]:null;
    $$('.guide').forEach(e=>{ if(!gq||!e.matches(gq)) e.classList.remove('guide'); }); if(gq){ const e=$(gq); if(e) e.classList.add('guide'); }
    // water/feed all gating
    const wa=$('#waterAll'), fa=$('#feedAll'); if(wa){ wa.classList.toggle('locked',G.lv('water')<1); const sm=wa.querySelector('small'); if(sm) sm.textContent=G.lv('water')<1?'Needs garden hose':'Water all'; } if(fa) fa.classList.remove('locked');
    locTabs(); seedBag();
    placeToasts();
  }
  // ---------- location tabs ----------
  function tapRoom(r){ Sound.play('tap'); hidePop();
    if(r==='garage'){ G.setRoom('garage'); return; }
    if(r==='facility'){ if(!G.st.land) landModal(); else G.setRoom('facility'); return; }
    if(r==='gh'){ if(!G.st.ghBuilt) ghModal(); else G.setRoom('gh'); return; }
    if(r==='benches'){ if(!G.st.inBuilt) indoorModal(); else G.setRoom('benches'); } }
  // The location tab opens the picker. Rooms are not separate buttons.
  function cycleRoom(){ toggleLocPick(); }
  function tapLoc(l){ if(l==='indoor') tapRoom('benches'); else if(l==='farm') tapRoom('facility'); else tapRoom('garage'); }
  function reqList(L){ return `<div class="reqs">${L.map(c=>`<div class="req ${c.ok?'ok':''}"><span>${c.ok?'✅':'⬜'}</span><div class="grow"><b>${esc(c.t)}</b>${c.p!=null&&!c.ok?bar(c.p,'thin'):''}${c.v&&!c.ok?`<small>${esc(c.v)}</small>`:''}</div></div>`).join('')}</div>`; }
  function inspectGlass(p){
    if(!p||!p.strain){ modal('<h3>Scouting glass</h3><p>No plant under your finger. Hold on a plant to read it.</p>',[{label:'OK',cls:'gold',v:0}]); return; }
    const s=G.strain(p.strain); if(!s){ toast('No plant under your finger'); return; }
    const lines=[
      (p.prog>=1?'Ripe and ready to harvest':Math.round(p.prog*100)+'% grown'),
      'Water '+Math.round((p.water||0)*100)+'%',
      p.food>0?'Fed this grow':'Not fed yet'
    ];
    if(p.pest==='mold') lines.push('Mold on the leaves');
    else if(p.pest) lines.push('Pests on the plant');
    else if(p.eggs>0) lines.push('Eggs or spores are hiding. Wipe them before they hatch.');
    else lines.push('No mold or pests.');
    const acts=[{label:'OK',cls:'gold',v:0}];
    if(p.eggs>0) acts.unshift({label:'Wipe eggs',cls:'',v:'wipe'});
    if(p.pest) acts.unshift({label:'Treat '+fmt(G.treatCost(p)),cls:'pink',v:'treat'});
    modal(`<h3>${esc(s.name)}</h3><p>${lines.map(esc).join('<br>')}</p>`,acts).then(v=>{
      if(v==='wipe') G.scout(p);
      else if(v==='treat'&&!G.treat(p)) toast('Not enough cash','bad');
    });
  }
  function ghModal(){
    const st=G.st, need=G.GH_BUILD.level, cost=G.GH_BUILD.cost;
    const reqs=[
      {t:'Reach level '+need, ok:st.level>=need, p:Math.min(1,(st.level-1+st.xp/G.xpNeed(st.level))/Math.max(1,need-1))},
      {t:'Save '+fmt(cost), ok:st.cash>=cost, p:Math.min(1,st.cash/Math.max(1,cost))}
    ];
    const ready=reqs.every(c=>c.ok);
    modal(`<h3>Greenhouse</h3><p>A daylight room: steel poles and a plastic topper over dirt beds. It opens with the same number of pots you own in the garage. Needs level ${need} and ${fmt(cost)}. The Indoor Facility comes later, at level ${G.LAND_LEVEL}.</p>${reqList(reqs)}`,
      [{label:'Later',cls:'sec',v:0},{label:ready?'Build for '+fmt(cost):'Not yet',cls:ready?'gold':'sec',v:ready?1:0}]).then(v=>{ if(v&&G.buildGH()) G.setRoom('gh'); });
  }
  function landModal(){ const L=landReq(); const ready=L.every(c=>c.ok);
    modal(`<img src="assets/new-art/backgrounds/indoor-facility.jpg" alt="" style="width:100%;border-radius:14px;max-height:150px;object-fit:cover"><h3>Indoor Facility</h3><p>The Indoor Facility is the old family land. It opens at level ${G.LAND_LEVEL} for ${fmt(G.LAND_COST)}: 40 plots, and plants already growing there stay put. The sealed bench room comes later, at level ${G.INDOOR.level}: permit ${fmt(G.INDOOR.permitCost)} at level ${G.INDOOR.permitLevel}, foundation ${fmt(G.INDOOR.foundCost)} at level ${G.INDOOR.foundLevel}, then the build for ${fmt(G.INDOOR.build)}.</p>${reqList(L)}`,
      [{label:'Later',cls:'sec',v:0},{label:ready?'Buy for '+fmt(G.LAND_COST):'Not yet',cls:ready?'gold':'sec',v:ready?1:0}]).then(v=>{ if(v&&G.buyLand()){ G.setRoom('facility'); } }); }
  function indoorModal(){ const ck=G.indoorChecklist(); const st=G.st;
    const ready=ck.slice(0,5).every(c=>c.ok);
    const acts=[{label:'Later',cls:'sec',v:0}];
    if(!st.permit&&st.level>=G.INDOOR.permitLevel) acts.push({label:'Buy permit '+fmt(G.INDOOR.permitCost),cls:'',v:'permit'});
    if(st.permit&&!st.found&&st.level>=G.INDOOR.foundLevel) acts.push({label:'Pour foundation '+fmt(G.INDOOR.foundCost),cls:'',v:'found'});
    if(ready) acts.push({label:(st.cash>=G.INDOOR.build?'Build ':'Need ')+fmt(G.INDOOR.build),cls:st.cash>=G.INDOOR.build?'gold':'sec',v:st.cash>=G.INDOOR.build?'build':0});
    modal(`<img src="art/indoor.webp" alt="" style="width:100%;border-radius:14px;max-height:150px;object-fit:cover"><h3>Indoor facility checklist</h3><p>Sealed veg and flower rooms on rolling benches: double yield and AAA grade. Pour the foundation before the build.</p>${reqList(ck)}`,acts)
      .then(v=>{ if(v==='permit'){ if(G.buyPermit()) indoorModal(); } else if(v==='found'){ if(G.buyFoundation()) indoorModal(); } else if(v==='build'&&G.buildIndoor()){ G.setLoc('indoor'); } }); }
  // ---------- tools ----------
  function setTool(t){ tool=t; $$('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===t)); Sound.play('tap'); }
  // ---------- plot interaction ----------
  function tapPlot(p,sx,sy){
    const st=G.st, again=popPlot===p||lastSel===p; hidePop();
    if(!p.strain){ lastSel=null; if(G.ensureSeed) G.ensureSeed(); if((st.seeds[st.selSeed]||0)>0) G.plant(p); else pip('No seeds'); seedBag(); return; }
    if(p.prog>=1){ G.harvest(p); lastSel=null; return; }
    // one tap = highlighted with quick-action bubbles; tap the same plant again for the full plant card
    if(again){ lastSel=null; showPop(p,sx,sy); return; }
    lastSel=p; Sound.play('tap');
  }
  let lastSel=null;
  function quick(a,p){ let ok=true;
    if(a==='water') ok=G.water(p)!==false; else if(a==='feed'){ ok=!!G.feed(p); if(!ok) toast(p.food>0?'Already fed this grow':'Feed opens at halfway','bad'); }
    else if(a==='treat'){ ok=!!G.treat(p); if(!ok) toast('Need '+fmt(G.treatCost(p))+' to treat','bad'); } else if(a==='prune') G.prune(p); else if(a==='top') G.train(p,'top'); else if(a==='harvest'){ G.harvest(p); lastSel=null; }
    if(ok){ Sound.play(a==='water'?'water':'tap'); if(R.shake) R.shake(p); Haptics.light(); } renderPop(); }
  function showPop(p,sx,sy){ popPlot=p; const pop=$('#pop'); renderPop(); pop.style.left=Math.max(120,Math.min(innerWidth-120,sx))+'px'; pop.style.top=Math.max(170,sy-10)+'px'; pop.classList.remove('hidden'); }
  function clockAt(sec){ const d=new Date(Date.now()+sec*1000); return d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+(sec>20*3600?' '+d.toLocaleDateString([], {weekday:'short'}):''); }
  function renderPop(){
    const p=popPlot; if(!p||!p.strain){ hidePop(); return; } const s=G.strain(p.strain); if(!s){ hidePop(); return; } const left=G.timeLeft(p);
    const bits=[];
    if(p.pest) bits.push(`<div class="l"><span>Health</span><b class="down">${p.pest==='mold'?'Mold':'Pests'}</b></div>`);
    if(G.isThirsty(p)||p.water<1) bits.push(`<div class="l"><span>Water</span><b>${Math.round(p.water*100)}%</b></div>${bar(p.water,'blue')}`);
    if(G.isHungry(p)||p.food>0) bits.push(`<div class="l"><span>Feed</span><b>${p.food>0?'Fed':G.isHungry(p)?'Needs one free feed':'Halfway feed'}</b></div>`);
    const acts=[];
    if(p.pest) acts.push(`<button class="btn sm pink" data-pa="treat">Treat ${fmt(G.treatCost(p))}</button>`);
    if(G.isThirsty(p)) acts.push(`<button class="btn sm" data-pa="water">${ico('drop')}Water</button>`);
    if(G.isHungry(p)&&!(p.food>0)) acts.push(`<button class="btn sm gold" data-pa="feed">${ico('feed')}Feed</button>`);
    if(p.prog>=1) acts.push(`<button class="btn sm gold" data-pa="harvest">Harvest</button>`);
    acts.push(`<button class="btn sm" data-pa="glass">Scouting glass</button>`);
    $('#pop').innerHTML=`<h5>${esc(s.name)} <small style="color:var(--mut)">${esc((G.ZONE[p.zone]&&G.ZONE[p.zone].name)||'')}</small></h5>
      <div class="l"><span>Ready in</span><b>${p.prog>=1?'Ripe now!':sec(left)}</b></div>${bar(p.prog)}
      ${bits.join('')||'<p>This plant is fine. No water, feed, or pest care right now.</p>'}
      ${acts.length?'<div class="acts">'+acts.join('')+'</div>':''}`;
  }
  function hidePop(keepSel){ popPlot=null; if(!keepSel) lastSel=null; $('#pop').classList.add('hidden'); closeLocPick(); }
  // ---------- panels ----------
  const PANELS={};
  function open(name,t){ if(name==='stand') name='market'; panel=name; tab=t||null; hidePop();
    try{ render(true); }
    catch(err){ console.error(err); const body=$('#sheetBody'), foot=$('#sheetFoot'); if(body) body._h=''; if(foot) foot._h=''; const title=$('#sheetTitle'); if(title) title.textContent='Farm'; const sub=$('#sheetSub'); if(sub) sub.innerHTML=''; const tabsEl=$('#sheetTabs'); if(tabsEl) tabsEl.innerHTML='';
      const stack=String(err&&err.stack||''), hit=stack.match(/([A-Za-z0-9_.-]+\.js):(\d+)/), spot=(err&&err.name||'Error')+(hit?' '+hit[1]+':'+hit[2]:'');
      if(body) body.innerHTML='<div class="empty">This page hit a problem in this save. The rest of the farm is still here.</div><p class="save-err">'+esc(spot)+'</p>'; if(foot) foot.innerHTML=''; }
    $('#sheet').classList.remove('hidden'); document.body.classList.add('sheet-open'); try{ capToasts(document.getElementById('toasts')); }catch(e){} Sound.play('open'); }
  function close(){ panel=null; $('#sheet').classList.add('hidden'); document.body.classList.remove('sheet-open','web-open'); }
  // One bad picture must not blank the sheet. Mount a canvas (Safari paints that; a data URL often stays empty).
  function mountStrainArt(im){
    const id=im&&im.dataset&&im.dataset.cu;
    if(!id||(!im.isConnected&&!(im.parentNode))) return;
    const sz=Math.max(16,Math.min(512,+im.dataset.sz||96))||96, hid=im.dataset.h==='1';
    const s=G.strain(id); if(!s) return;
    let src=null;
    try{ if(R.closeupCanvas) src=R.closeupCanvas(s,sz,hid); }catch(e){ console.error(e); src=null; }
    if(!src&&window.Art&&Art.thumbCanvas){ try{ src=Art.thumbCanvas(s,sz,hid); }catch(e){ console.error(e); src=null; } }
    if(!src) src=strainStandIn(sz, hid);
    if(!src) return;
    const view=document.createElement('canvas'); view.width=src.width||sz; view.height=src.height||sz;
    view.className=im.className||''; const st=im.getAttribute&&im.getAttribute('style'); if(st) view.setAttribute('style',st);
    view.dataset.cu=id; view.dataset.sz=String(sz); view.dataset.h=hid?'1':'0';
    try{ const x=view.getContext('2d'); if(x) x.drawImage(src,0,0); }catch(e){ console.error(e); const ph=strainStandIn(sz, hid); if(ph){ view.width=ph.width; view.height=ph.height; try{ const x=view.getContext('2d'); if(x) x.drawImage(ph,0,0); }catch(e2){ console.error(e2); } } }
    if(im.replaceWith) im.replaceWith(view); else if(im.parentNode) im.parentNode.replaceChild(view,im);
  }
  function strainStandIn(sz, hid){
    try{
      const c=document.createElement('canvas'); c.width=sz; c.height=sz; const x=c.getContext('2d'); if(!x) return null;
      x.fillStyle=hid?'#16181c':'#1a3324'; x.fillRect(0,0,sz,sz);
      x.strokeStyle=hid?'#4a5160':'#3e7a52'; x.lineWidth=Math.max(2,Math.round(sz*.06)); x.strokeRect(x.lineWidth,x.lineWidth,sz-x.lineWidth*2,sz-x.lineWidth*2);
      x.fillStyle=hid?'#d7dde6':'#d9ffe6'; x.font='800 '+Math.round(sz*.42)+'px system-ui,sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(hid?'?':'*',sz/2,sz/2);
      return c;
    }catch(e){ console.error(e); return null; }
  }
  function packetUrl(im){
    const s=G.strain(im.dataset.cu); if(!s||!R.closeup) return '';
    const sz=Math.max(16,+im.dataset.sz||112)||112;
    try{ return R.closeup(s,sz,im.dataset.h==='1')||''; }catch(e){ console.error(e); return ''; }
  }
  function paintStrainImgs(root){ if(!root||!root.querySelectorAll) return; root.querySelectorAll('img[data-cu]').forEach(im=>{ try{
      if(im.dataset.ready==='1'&&im.getAttribute('src')) return;
      if(im.dataset.pkt==='1'){ const url=packetUrl(im); if(url){ im.src=url; im.dataset.ready='1'; return; } }
      mountStrainArt(im);
    }catch(e){ console.error(e); try{ const sz=Math.max(16,+im.dataset.sz||44)||44, ph=strainStandIn(sz, im.dataset.h==='1'); if(ph&&im.replaceWith) im.replaceWith(ph); }catch(e2){ console.error(e2); } } }); }
  function render(reset){
    if(!panel) return; const P=PANELS[panel]; const body=$('#sheetBody'); const top=body.scrollTop;
    const o=P(); $('#sheetTitle').textContent=o.title; $('#sheetSub').innerHTML=o.sub||'';
    $('#sheetTabs').innerHTML=(o.tabs||[]).map(([k,l])=>`<button data-tab="${k}" class="${k===tab?'on':''}">${l}</button>`).join('');
    if(body._h!==o.body||reset){ body._h=o.body; body.innerHTML=o.body; paintStrainImgs(body); syncVol(body); }
    const f=o.foot||''; if($('#sheetFoot')._h!==f){ $('#sheetFoot')._h=f; $('#sheetFoot').innerHTML=f; }
    if(!reset) body.scrollTop=top; else body.scrollTop=0;
    const lc=document.getElementById('labScene'); if(lc) drawLab(lc); drawCosPrev(body); { const pt=document.getElementById('passTrack'); if(pt&&!pt._init){ pt._init=1; const nx=pt.querySelector('.pt-col.next')||pt.querySelector('.pt-col.un:last-child'); if(nx) pt.scrollLeft=Math.max(0,nx.offsetLeft-60); } } body.classList.remove('fit-web'); document.body.classList.remove('web-open'); body.querySelectorAll('canvas.pcard').forEach(c=>{ const x=c.getContext('2d'); x.clearRect(0,0,c.width,c.height); try{ R.plantCard(x,JSON.parse(c.dataset.pc)); }catch(e){} });
  }
  // Pheno Room / Breeding Pheno Room vignette at the top of the breeding sheet: the current hunt grows out on the bench, mothers stand on the right
  function drawLab(c){ const st=G.st, x=c.getContext('2d'), W=c.width, H=c.height, lab=st.breedLab, hunt=st.hunt; x.clearRect(0,0,W,H);
    // room
    if(lab){ x.fillStyle='#e9eef0'; x.fillRect(0,0,W,H); x.strokeStyle='rgba(120,140,150,.25)'; for(let i=0;i<W;i+=36){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,H*.62); x.stroke(); } for(let j=0;j<H*.62;j+=36){ x.beginPath(); x.moveTo(0,j); x.lineTo(W,j); x.stroke(); }
      x.fillStyle='#b9c3c8'; x.fillRect(0,H*.62,W,H*.38); x.fillStyle='#9aa6ad'; x.fillRect(0,H*.62,W,4); }
    else { const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,'#5a4636'); g.addColorStop(.62,'#4a3a2c'); g.addColorStop(.62,'#6e6a64'); g.addColorStop(1,'#56524c'); x.fillStyle=g; x.fillRect(0,0,W,H);
      x.strokeStyle='rgba(0,0,0,.25)'; for(let i=0;i<W;i+=48){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,H*.62); x.stroke(); } }
    // light bars
    for(let i=0;i<3;i++){ const lx=40+i*(W-260)/3; x.fillStyle=lab?'#d8dde0':'#222'; x.fillRect(lx,14,(W-300)/3,10); x.fillStyle=lab?'rgba(255,255,255,.95)':'rgba(255,120,230,.9)'; x.fillRect(lx+4,24,(W-300)/3-8,3); }
    const glow=x.createRadialGradient(W*.38,40,10,W*.38,40,W*.5); glow.addColorStop(0,lab?'rgba(255,255,255,.35)':'rgba(255,80,220,.35)'); glow.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=glow; x.fillRect(0,0,W,H);
    // sign
    x.font='900 18px system-ui,sans-serif'; const t=lab?'BREEDING PHENO ROOM':'PHENO ROOM', tw=x.measureText(t).width+24; x.fillStyle=lab?'#1d3b4a':'#2a1838'; x.fillRect(W-tw-14,12,tw,30); x.fillStyle=lab?'#9be7ff':'#ff9be9'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(t,W-tw/2-14,28);
    // bench
    const by=H*.78, bx0=24, bx1=W-200; x.fillStyle=lab?'#c7ced2':'#6b4a2a'; x.fillRect(bx0,by,bx1-bx0,12); x.fillStyle=lab?'#8f999f':'#4a321c'; x.fillRect(bx0+8,by+12,6,H-by-12); x.fillRect(bx1-14,by+12,6,H-by-12);
    const tagAt=(px,py,tag,gold)=>{ if(!tag) return; x.font='800 12px system-ui'; const w=x.measureText(tag).width+10; x.fillStyle=gold?'#ffd35a':'#fff5c2'; x.fillRect(px-w/2,py+6,w,16); x.fillStyle='#3a2a18'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(tag,px,py+14); };
    const pot=(px,py,w)=>{ x.fillStyle='#262626'; x.beginPath(); x.moveTo(px-w/2,py); x.lineTo(px+w/2,py); x.lineTo(px+w*.4,py-w*.7); x.lineTo(px-w*.4,py-w*.7); x.closePath(); x.fill(); x.fillStyle='#3b2a1c'; x.fillRect(px-w*.4,py-w*.7,w*.8,4); };
    // real strain sprites (same art, growth stages and health/training visuals as the farm)
    const plantAt=(id,px,py,h,prog,seed,o)=>{ pot(px,py,30); R.plantCard(x,Object.assign({id,prog,x:px,y:py-19,h,seed},o||{})); };
    if(hunt){ const n=hunt.n, sp=(bx1-bx0-40)/n, pr=hunt.phenos?1:Math.min(1,hunt.t/hunt.dur); const best=hunt.phenos?hunt.phenos.reduce((b,q,i)=>G.phenoScore(q)>G.phenoScore(hunt.phenos[b])?i:b,0):-1;
      for(let i=0;i<n;i++){ const ph=hunt.phenos&&hunt.phenos[i], px=bx0+30+sp*(i+.5); plantAt(hunt.id,px,by,(ph?ph.h:1)*Math.min(150,sp*1.6),ph?1:.06+.9*pr,i*7+3); tagAt(px,by,ph?ph.k+(i===best?' ★':''):'#'+(i+1),i===best); } }
    else { x.fillStyle=lab?'#4a5a62':'#e8d9b8'; x.font='700 14px system-ui'; x.textAlign='center'; x.fillText('Bench is empty. Start a pheno hunt below.',(bx0+bx1)/2,by-40); }
    // clone dome with rooting cuttings
    const cuts=(st.cuts||[]).slice(0,2); cuts.forEach((c,ci)=>{ const dx=bx0+40+ci*110, dy=H-8; x.fillStyle=lab?'#9aa6ad':'#3a2a18'; x.fillRect(dx-46,dy-8,92,8);
      for(let k=0;k<Math.min(c.n,6);k++){ const px=dx-36+k*14.4; x.fillStyle='#6b4a2a'; x.fillRect(px-5,dy-14,10,6); R.plantCard(x,{id:c.id,prog:.03+.05*Math.min(1,c.t/c.dur),x:px,y:dy-13,h:150,seed:k+ci*9}); }
      x.fillStyle='rgba(210,240,255,.28)'; x.strokeStyle='rgba(255,255,255,.65)'; x.lineWidth=1.5; x.beginPath(); x.moveTo(dx-46,dy-8); x.quadraticCurveTo(dx-46,dy-44,dx,dy-46); x.quadraticCurveTo(dx+46,dy-44,dx+46,dy-8); x.closePath(); x.fill(); x.stroke();
      x.fillStyle=lab?'#22343c':'#fff'; x.font='700 10px system-ui'; x.textAlign='center'; x.fillText('Rooting '+Math.round(100*Math.min(1,c.t/c.dur))+'%',dx,dy-50); });
    // mothers (kept in veg: big, pruned, tied down)
    const K=Object.keys(st.keepers||{}).slice(-2); K.forEach((id,i)=>{ const px=W-150+i*80, py=H*.92; x.fillStyle=lab?'#c7ced2':'#5b4632'; x.fillRect(px-30,py,60,8); plantAt(id,px,py,175,.42,40+i,{pruned:true,train:'lst',trellis:true}); tagAt(px,py,'Mother',true); x.font='700 10px system-ui'; x.fillStyle=lab?'#22343c':'#fff'; x.textAlign='center'; x.fillText(G.strain(id).name.slice(0,14),px,py-128); });
    if(!K.length){ x.fillStyle=lab?'#4a5a62':'#e8d9b8'; x.font='700 12px system-ui'; x.textAlign='center'; x.fillText('No mothers yet',W-110,H*.8); }
  }

  function syncVol(root){ root.querySelectorAll('input[data-vol]').forEach(i=>{ const v=G.st.settings[i.dataset.vol]; i.value=v==null?70:v; }); root.querySelectorAll('[data-volv]').forEach(b=>{ const v=G.st.settings[b.dataset.volv]; b.textContent=(v==null?70:v)+'%'; }); }
  const cu=(s,sz,hidden)=>`<img class="thumb" data-cu="${s.id}" data-sz="${sz||96}" data-h="${hidden?1:0}" alt="">`;
  const row=(s,mid,right,sel,hidden,pic)=>s?`<div class="row ${sel?'sel':''}">${pic?`<img class="thumb shoppic" data-cu="${s.id}" data-sz="${pic}" data-h="${hidden?1:0}" alt="">`:cu(s,96,hidden)}<div class="grow"><h4>${hidden?'???':esc(s.name)} ${tag(s)}</h4>${mid}</div>${right||''}</div>`:`<div class="row"><div class="grow"><h4>Retired strain</h4>${mid||''}</div>${right||''}</div>`;
  const pips=(l,m)=>`<span style="letter-spacing:2px;color:var(--acc)">${'●'.repeat(l)}<span style="color:rgba(255,255,255,.2)">${'●'.repeat(Math.max(0,m-l))}</span></span>`;
  const upips=(l,m)=>{ let s='<span class="upips">'; for(let i=0;i<m;i++) s+=`<i class="${i<l?'on':''}"></i>`; return s+'</span>'; };
  function flashBuy(k){ boughtKey=k; clearTimeout(boughtTimer); boughtTimer=setTimeout(()=>{ boughtKey=null; if(panel) render(); },720); }
  function ucard(o){ return `<div class="ucard th-${o.theme} ${o.state}${boughtKey===o.key?' flash':''}" data-uk="${esc(o.key)}"><div class="uplate">${o.img||''}</div><div class="ugrow"><h4>${o.title}</h4>${o.pips||''}<p>${o.desc}</p></div><div class="uact">${o.action}</div></div>`; }
  function upBanner(room){
    const M={garage:['assets/new-art/backgrounds/garage.jpg','Garage','One hanging light over stacked pots.'],gh:['assets/new-art/backgrounds/greenhouse.jpg','Greenhouse','Daylight, dirt beds, no grow lights.'],facility:['assets/new-art/backgrounds/indoor-facility.jpg','Indoor Facility','Forty plots under one ceiling light.']};
    if(M[room]) return `<div class="ubanner" style="background-image:url('${M[room][0]}')"><div><b>${M[room][1]}</b><span>${M[room][2]}</span></div></div>`;
    if(room==='lines') return `<div class="ubanner soft"><img alt="" src="assets/new-art/sprites/water-barrel.png"><div><b>Water + feed</b><span>The hose unlocks Water all. Feed all stays free.</span></div></div>`;
    return `<div class="ubanner soft"><div><b>Upgrades</b><span>Gear lives on these cards.</span></div></div>`;
  }

  const pktCache=new Map();
  function fitLine(cands, budget, font){
    if(!cands.length) return '';
    if(!bagCanMeasure()||!(budget>16)) return cands[0];
    let best=cands[cands.length-1];
    for(const t of cands){ if(bagMeasure(t, font)<=budget+0.5) return t; }
    return best;
  }
  function nameCands(s){
    const words=String(s.name||'').split(/\s+/).filter(Boolean);
    const aka=String(s.aka||'').replace(/^aka\s+/i,'').split(',').map(t=>t.trim()).filter(Boolean);
    const out=[];
    const push=t=>{ t=String(t||'').replace(/\s+/g,' ').trim(); if(t&&out.indexOf(t)<0) out.push(t); };
    push(words.join(' '));
    aka.sort((a,b)=>b.length-a.length).forEach(push);
    for(let n=words.length-1;n>=1;n--) push(words.slice(0,n).join(' '));
    const initials=words.map(w=>w[0]).join('');
    if(initials.length>1) push(initials);
    if(words[0]) for(let n=words[0].length-1;n>=1;n--) push(words[0].slice(0,n));
    return out.length?out:['Seed'];
  }
  function descCands(s){
    const type=s.type||'Hybrid';
    const flav=(s.flavors||[]).filter(Boolean);
    const f1=flav[0]||(s.terpenes&&s.terpenes[0])||'';
    const f2=flav[1]||'';
    const nose=f2?(f1+', '+String(f2).toLowerCase()):f1;
    const grow=G.dur(s.game.growSec);
    const price=G.fmt(G.seedPrice(s));
    const yld=s.yieldClass?(s.yieldClass+' yield'):(s.game&&s.game.buds?(Math.max(1,Math.round(s.game.buds))+' buds'):'');
    const line=(...ps)=>ps.filter(Boolean).join(' · ');
    const bits=[line(type, nose, grow, price, yld), line(type, nose, grow, price), line(type, nose, grow), line(type, f1, grow), line(type, grow), type];
    return bits.filter((t,i)=>t&&bits.indexOf(t)===i);
  }
  function packetText(s, budget){
    const price=Math.round(G.seedPrice(s)*100);
    const key=s.id+'|'+budget+'|'+price+'|'+(bagCanMeasure()?'1':'0');
    if(pktCache.has(key)) return pktCache.get(key);
    const name=fitLine(nameCands(s), budget, '800 13px system-ui,sans-serif');
    const desc=fitLine(descCands(s), budget, '700 11px system-ui,sans-serif');
    const out={name, desc};
    if(pktCache.size>200) pktCache.delete(pktCache.keys().next().value);
    pktCache.set(key, out);
    return out;
  }
  function pktBudget(shop){
    const w=Math.max(280, Math.min(typeof innerWidth==='number'?innerWidth:390, 720));
    let text=w-28-18-(shop?96:56)-10;
    if(shop) text-=88;
    return Math.max(64, Math.floor(text));
  }
  function pktCard(s, shop){
    const st=G.st, own=(st.seeds[s.id]||0)>0, sel=st.selSeed===s.id;
    const copy=packetText(s, pktBudget(!!shop));
    const faceCls=shop?'thumb shoppic':'thumb';
    const face=shop
      ?`<div class="pkt-face big"><img class="${faceCls}" data-cu="${s.id}" data-sz="112" data-h="0" data-pkt="1" alt=""></div>`
      :`<div class="pkt-face"><img class="${faceCls}" data-cu="${s.id}" data-sz="112" data-h="0" data-pkt="1" alt=""></div>`;
    const hold=shop?'':`<p class="pkt-hold">${st.seeds[s.id]} in the bag</p>`;
    const buy=shop?`<div class="pkt-buy"><button class="btn sm" data-a="buy" data-id="${s.id}" data-n="1" ${st.cash<G.seedPrice(s)?'disabled':''}>Buy 1</button><button class="btn sm sec" data-a="buy" data-id="${s.id}" data-n="5" ${st.cash<G.seedPrice(s)*5?'disabled':''}>×5</button>${sel?'<span class="chip selchip">✓ Selected</span>':''}</div>`:'';
    return `<div class="row pkt${sel?' sel':''}${own?' pickable':''}" data-pickseed="${s.id}">${face}<div class="pkt-copy"><h4 class="pkt-name">${esc(copy.name)}</h4><p class="pkt-desc">${esc(copy.desc)}</p>${hold}</div>${buy}</div>`;
  }
  // Seeds
  PANELS.seeds=()=>{
    const st=G.st; tab=tab||'all';
    const list=G.S.filter(s=>st.discovered[s.id]).filter(s=>tab==='all'||(tab==='fast'?s.game.growSec<=1800:tab==='island'?s.island:s.tier>=3));
    list.sort((a,b)=>a.game.growSec-b.game.growSec||(a.name<b.name?-1:a.name>b.name?1:0));
    const body=list.map(s=>pktCard(s, true)).join('')
      +`<div class="note">Grow times run from 30 seconds (Common) to 3 days (Legendary). Plants keep growing while you're away. Long grows pay a little more per hour. More strains unlock by level, breeding and island festivals.</div>`;
    if(G.ensureSeed) G.ensureSeed();
    const sel=G.strain(st.selSeed), empty=st.plots.filter(p=>p.owned&&!p.strain&&p.loc===st.loc).length;
    const owned=G.bagSeeds?G.bagSeeds():G.S.filter(s=>(st.seeds[s.id]||0)>0).sort((a,b)=>a.game.growSec-b.game.growSec);
    const bag=owned.length?owned.map(s=>pktCard(s, false)).join(''):`<div class="note">Bag's empty. Grab seeds at the shop.</div>`;
    const plantable=!!(sel&&(st.seeds[sel.id]||0)>0);
    const foot=plantable?`<div style="flex:1;font-size:12px;color:var(--mut)">Selected: <b style="color:#fff">${esc(sel.name)}</b> (${st.seeds[sel.id]||0})</div><button class="btn" data-a="plantall" ${!empty?'disabled':''}>Plant ${empty} here</button>`:'';
    return {title:'Seed bag',sub:'Pick a seed you own, or buy more below.',tabs:[['all','All'],['fast','Under 30m'],['island','Island'],['top','Epic+']],body:`<div class="section-t">In the bag</div>${bag}<div class="section-t">Buy seeds</div>`+body,
      foot};
  };
  // Dry, cure and craft
  PANELS.process=()=>{
    const st=G.st; tab=tab||'dry'; let body='', foot='';
    const tabs=[['dry','Dry & Cure']]; if(st.level>=G.GATE.hash) tabs.push(['craft','Craft']);
    if(tab==='dry'){ const slots=G.dryerSlots();
      body+=`<div class="note">Fresh buds sell for 40%. <b>Dried</b> = 100%. <b>Cured</b> = 145% (needs curing jars). Grades: <b>A</b> x1.25 · <b>B</b> x1 · <b>C</b> x0.7.</div><div class="section-t">Drying racks ${st.dryer.length}/${slots}</div>`;
      for(let i=0;i<slots;i++){ const j=st.dryer[i]; if(!j){ body+=`<div class="row"><div class="grow"><h4 style="color:var(--mut)">Empty rack</h4><p>Holds up to ${G.batchMax()} buds</p></div></div>`; continue; }
        const {id,g,q}=G.unkey(j.k), s=G.strain(id); body+=row(s,`<p>${gradeBadge(q)} ${j.n} buds ${g?'('+G.gradeLabel(g)+')':''} · ${j.phase==='dry'?'Drying':'Curing'} · ${sec(j.dur-j.t)}</p>${bar(j.t/j.dur,j.phase==='cure'?'amber':'')}`); }
      const wet=Object.entries(st.inv.wet);
      body+=`<div class="section-t">Fresh harvest (${G.invCount('wet')})</div>`+(wet.length?wet.map(([k,n])=>{const {id,g,q}=G.unkey(k);return row(G.strain(id),`<p>${gradeBadge(q)} ${n} fresh buds ${g?'· '+G.gradeLabel(g):''}</p>`);}).join(''):'<div class="empty">Nothing fresh. Harvest ripe plants!</div>');
      body+=`<div class="section-t">Processing upgrades</div>`+upRow('dryer')+upRow('cure');
      foot=`<button class="btn wide" data-a="load" ${!G.invCount('wet')||st.dryer.length>=slots?'disabled':''}>${ico('jar')}Load racks (${G.invCount('wet')} fresh)</button>`;
    } else {
      body+=`<div class="note">Turn dried or cured buds into higher-value products in your licensed workshop. Bubble hash (Lv ${G.GATE.hash}), live rosin (Lv ${G.GATE.rosin}, rosin press) and infused edibles (Lv ${G.GATE.edibles}, licensed kitchen).</div>`;
      body+=`<div class="section-t">Workshop ${st.craft.length}/${G.craftSlots()} slots</div>`+(st.craft.length?st.craft.map(j=>row(G.strain(j.id),`<p>${esc(G.CRAFT[j.t].name)} ×${j.n} · ${sec(j.dur-j.T)}</p>${bar(j.T/j.dur,'amber')}`)).join(''):'<div class="empty">Workshop idle</div>');
      const lots=[]; for(const stg of ['cured','dry']) for(const [k,n] of Object.entries(st.inv[stg])) lots.push([stg,k,n]);
      body+=`<div class="section-t">Make something</div>`+(lots.length?lots.map(([stg,k,n])=>{ const {id,q}=G.unkey(k), s=G.strain(id);
        const btns=Object.entries(G.CRAFT).map(([t,c])=>{ const okT=G.craftOk(t), mx=G.craftMax(t,stg,k); if(!okT) return st.level<G.GATE[c.gate]?'':`<button class="btn sm sec" disabled>${esc(c.name.split(' ').pop())}: needs ${esc(G.UPG[c.upg].name)}</button>`;
          const v=s.game.budValue*c.need*c.mult; return `<button class="btn sm" data-a="craft" data-t="${t}" data-stg="${stg}" data-k="${k}" ${!mx||st.craft.length>=G.craftSlots()?'disabled':''}>${esc(c.name)} ×${mx||0} <small>(${c.need} buds each, x${c.mult} value)</small></button>`; }).join('');
        return row(s,`<p>${gradeBadge(q)} ${n} ${stg}</p><div class="chips" style="gap:4px;display:flex;flex-wrap:wrap">${btns}</div>`); }).join(''):'<div class="empty">Dry some buds first.</div>');
      const goods=Object.entries(st.goods); body+=`<div class="section-t">Products ready (${G.goodsCount()})</div>`+(goods.length?goods.map(([k,n])=>{ const [t,id,c,q]=k.split('|'); return row(G.strain(id),`<p>${gradeBadge(q||'B')} ${n} × ${esc(G.CRAFT[t].name)}${+c?' (from cured)':''} · ${fmt(G.goodPrice(k))} each</p>`,`<button class="btn sm gold" data-a="sellgood" data-k="${k}">${fmt(G.goodPrice(k)*n)}</button>`); }).join(''):'<div class="empty">No products yet.</div>');
      body+=`<div class="section-t">Workshop gear</div>`+upRow('press')+upRow('kitchen');
    }
    return {title:'Drying Shed',sub:'Dry, cure and craft for top prices',tabs:tabs.length>1?tabs:null,body,foot};
  };
  // Market: sell dried, cured, and crafted goods. The Orders tab is gone; saved orders stay on the file.
  function spark(id){ const h=G.st.market.hist[id]||[]; if(h.length<2) return ''; const mn=.5,mx=1.85; const pts=h.map((v,i)=>`${(i/(h.length-1)*60).toFixed(1)},${(18-(v-mn)/(mx-mn)*18).toFixed(1)}`).join(' ');
    const up=h[h.length-1]>=h[h.length-2]; return `<svg width="60" height="18" style="vertical-align:middle"><polyline points="${pts}" fill="none" stroke="${up?'#7dffa6':'#ff8a8a'}" stroke-width="1.6"/></svg>`; }
  PANELS.pass=()=>{
    const P=window.PRODUCTS;
    const body=passTab()+`<div class="section-t">VIP Grower</div><div class="prod-grid">`+prodCard(P.vip)+prodCard(P.vip_g)+`</div>`;
    return {title:'Game Pass',sub:'Grower Pass and VIP. Prices are the ones already in the shop.',body};
  };
  PANELS.market=()=>{
    const st=G.st; tab='sell'; let total=0, body='', foot='';
    const tabs=[['sell','Sell']];
    const rt=G.repTier(), R0=G.REP[rt], R1=G.REP[rt+1];
    const repLine=`<div class="row" style="display:block"><h4>Reputation: ${esc(R0.n)} ${R0.b?`<span class="chip">+${Math.round(R0.b*100)}% prices</span>`:''}</h4>${R1?`${bar((st.rep-R0.at)/(R1.at-R0.at),'amber')}<p>${Math.floor(st.rep)} / ${R1.at} to ${esc(R1.n)}: +${Math.round(R1.b*100)}% prices</p>`:'<p>Top tier reached. Island royalty!</p>'}</div>`;
    if(tab==='sell'){
      if(st.market.hot){ const s=G.strain(st.market.hot); if(s) body+=`<div class="testbanner" style="color:#ffe28a">Tourist rush! ${esc(s.name)} sells for 2x for ${sec(st.market.hotT)}</div>`; }
      const lots=[]; for(const stg of ['cured','dry','wet']) for(const [k,n] of Object.entries(st.inv[stg])) lots.push([stg,k,n]);
      if(!lots.length&&!G.goodsCount()) body+='<div class="empty">Nothing to sell yet. Harvest, dry and cure your buds first.</div>';
      lots.forEach(([stg,k,n])=>{ const {id,g,q}=G.unkey(k), s=G.strain(id), p=G.price(id,g,stg,q), f=st.market.f[id]; total+=p*n;
        body+=row(s,`<p>${gradeBadge(q)} <b>${n}</b> ${stg==='wet'?'fresh':stg} ${g>=2?'<span class="tag mut">Mutant x2.5</span>':''} ${g%2?'· Indoor AAA':''}</p><div class="stats"><span>${fmt(p)}/bud</span><span class="${f>=1?'up':'down'}">${f>=1?'▲':'▼'} ${(f*100).toFixed(0)}%</span><span>${spark(id)}</span></div>`,`<button class="btn sm gold" data-a="sell" data-stg="${stg}" data-k="${k}">${fmt(p*n)}</button>`); });
      Object.entries(st.goods).forEach(([k,n])=>{ const [t,id]=k.split('|'); const v=G.goodPrice(k); total+=v*n; body+=row(G.strain(id),`<p><b>${n}</b> × ${esc(G.CRAFT[t].name)}</p>`,`<button class="btn sm gold" data-a="sellgood" data-k="${k}">${fmt(v*n)}</button>`); });
      body+=repLine+`<div class="note">Prices drift (55% to 180%). Your multiplier: x${G.earnMult().toFixed(2)}${st.pass2x?' (2x pass)':''}.</div>`;
      foot=`<button class="btn gold wide" data-a="sellall" ${!total?'disabled':''}>${ico('coin')}Sell everything · ${fmt(total)}</button>`;
    }
    return {title:'Market',sub:'Sell dried and cured buds',tabs:null,body,foot};
  };
  // Upgrades / build
  function upRow(k,isW){
    const d=isW?G.WORKERS[k]:G.UPG[k]; const l=isW?G.wk(k):G.lv(k), max=isW?d.max:G.maxLv(d), done=l>=max, c=done?0:G.cost(d,l), price=c<=0?(isW&&l>0?'Train':'Free'):fmt(c);
    let lock=''; if(isW&&!G.workerOk(k)) lock=G.st.level<d.level?ico('lock')+' Lv '+d.level:'Needs location'; else if(!isW&&G.upgBlock(k)) lock=G.upgBlock(k); else if(!isW&&d.lvl&&G.st.level<d.lvl) lock=ico('lock')+' Lv '+d.lvl;
    const stepName=d.steps?d.steps[Math.min(l,(d.steps.length||1)-1)]:'';
    const name=d.steps?`${esc(d.name)} <em>${esc(stepName)}</em>`:esc(d.name);
    const desc=d.steps?(done?esc(d.descs[Math.min(l,d.descs.length-1)]):`Next: <b>${esc(d.steps[l+1])}</b> · ${esc(d.descs[l+1])}`):esc(d.desc);
    const who=isW&&window.CHARACTERS?Object.keys(window.CHARACTERS).find(n=>n!=='Unko Kuli'&&d.name.startsWith(n)):null;
    const theme=isW?'hands':d.loc==='farm'?'farm':d.loc==='indoor'?'indoor':d.loc==='garage'?'garage':'all';
    const state=done?'owned':lock?'locked':(c>0&&G.st.cash<c)?'short':'canbuy';
    const img=who?portraitImg(who,'wport','bust'):(window.UpgIcons?`<img class="upico" alt="" src="${UpgIcons.url(k,d.loc||'all')}">`:'');
    const action=done?`<span class="uchip">${max>1?'MAX':'Owned'}</span>`:`<button class="btn ${isW?'pink':state==='canbuy'?'gold':''}" data-a="${isW?'hire':'upg'}" data-k="${k}" ${(c>0&&G.st.cash<c)||lock?'disabled':''}>${lock||price}</button>`;
    return ucard({key:k,theme,state,img,title:name,desc,pips:max>1?upips(l,max):'',action});
  }
  function stepCard(kind,label){ const n=G.nextStep(kind); const img=window.UpgIcons?`<img class="upico" alt="" src="${UpgIcons.url('step_'+kind,'step')}">`:'';
    if(!n) return ucard({key:'step_'+kind,theme:'step',state:'owned',img,title:esc(label)+': all space bought',desc:'This room is at its plant cap.',action:'<span class="uchip">MAX</span>'});
    const state=G.st.cash<n.cost?'short':'canbuy';
    return ucard({key:'step_'+kind,theme:'step',state,img,title:esc(n.name),desc:esc(n.desc||('+'+n.add+' plant spaces')),action:`<button class="btn gold" data-a="step" data-k="${kind}" ${state==='short'?'disabled':''}>${fmt(n.cost)}</button>`}); }
  PANELS.upgrades=()=>{
    const st=G.st; const cur=G.currentRoom(); tab=tab||(cur==='benches'?'facility':cur==='facility'?'facility':cur==='gh'?'gh':'garage'); if(tab==='farm') tab='facility'; if(tab==='indoor') tab='facility'; if(tab==='hands') tab='garage'; let body='';
    const tabs=[['garage','Garage'],['gh','Greenhouse'],['facility','Indoor Facility'],['lines','Water + feed']];
    if(tab==='garage'){ const gi=Math.max(0,Math.min(G.GARAGE.length-1,st.garage|0)), g=G.GARAGE[gi], cap=G.capOf('garage'), buyMax=G.GARAGE[G.GARAGE.length-1].cap;
      const space=cap>buyMax?cap+' pots':cap+'/'+buyMax+' pots';
      const now=cap>buyMax?('You have <b>'+cap+' buckets</b> from an older save. Every plant stays. New buys stop at '+buyMax+'.'):(cap!==g.cap?('Now: <b>'+cap+' buckets</b> kept from an older save. The next upgrade fills the next step, up to '+buyMax+'.'):('Now: <b>'+esc(g.name)+'</b>. Each upgrade adds 3 buckets, up to '+buyMax+'.'));
      body+=upBanner('garage')+`<div class="section-t">Grow space · ${space}</div><div class="note">${now} Beds stay in the room. Gear you buy shows up here, not on the floor.</div>`+stepCard('garage','Garage');
      body+=`<div class="section-t">Garage gear</div>`+['light','fan','oscfan','dehu','timer','phkit','trays'].map(k=>upRow(k)).join('');
      const labImg=window.UpgIcons?`<img class="upico" alt="" src="${UpgIcons.url('labPollen','garage')}">`:'';
      body+=`<div class="section-t">Pheno work</div><div class="note">${G.garageRole()==='grow'?"This is Grandpa's garage, your main grow for now. When you buy the Indoor Facility it becomes your Pheno Room.":G.garageRole()==='pheno'?'Pheno Room: double mutation odds on plants grown here, 30% less yield. Crossbreeding happens here.':'Pheno work has moved to the Indoor Breeding Pheno Room. The garage is now storage (+4 drying slots) and a bonus grow.'}</div>`+(G.st.breedLab?'':ucard({key:'lab',theme:'indoor',state:G.st.inBuilt&&G.st.cash>=G.LAB.cost?'canbuy':'locked',img:labImg,title:'Indoor Breeding Pheno Room',desc:'Takes over pheno work: crosses 60% faster, double mutation odds, +1 hint token per mystery found. Needs the sealed benches.',action:`<button class="btn gold" data-buylab ${G.st.inBuilt?'':'disabled'}>${G.st.inBuilt?fmt(G.LAB.cost):(st.land?'Unlock the sealed benches first':'Unlock the Indoor Facility first')}</button>`})); }
    else if(tab==='gh'){
      body+=upBanner('gh');
      const ghImg=`<img class="upico" alt="" src="assets/new-art/sprites/hoop-house.png">`;
      if(!st.ghBuilt){
        const need=G.GH_BUILD.level, cost=G.GH_BUILD.cost;
        const reqs=[
          {t:'Reach level '+need, ok:st.level>=need, p:Math.min(1,(st.level-1+st.xp/G.xpNeed(st.level))/Math.max(1,need-1))},
          {t:'Save '+fmt(cost), ok:st.cash>=cost, p:Math.min(1,st.cash/Math.max(1,cost))}
        ];
        body+=`<div class="note">The greenhouse is a daylight room of its own: steel poles, a plastic topper, and dirt beds. It starts with the same number of pots you own in the garage. Needs level ${need} and ${fmt(cost)}. The Indoor Facility is later, at level ${G.LAND_LEVEL}.</div>${reqList(reqs)}`;
        body+=ucard({key:'ghbuild',theme:'farm',state:reqs.every(c=>c.ok)?'canbuy':'locked',img:ghImg,title:'Build the greenhouse',desc:'Opens with your current garage pot count. No grow lights.',action:`<button class="btn gold" data-a="ghbuild" ${reqs.every(c=>c.ok)?'':'disabled'}>${st.level<need?ico('lock')+' Lv '+need:fmt(cost)}</button>`});
      } else {
        body+=`<div class="section-t">Greenhouse · ${G.capOf('gh')} pots</div><div class="note">Outdoor daylight. A roof light runs the length of the pots. Plants root in the dirt. There is no grow-light upgrade.</div>`+stepCard('gh','Greenhouse'); }
      body+=`<div class="section-t">Greenhouse gear</div>`+['beds','shade','cooler','catch','shutters'].map(k=>upRow(k)).join('');
    }
    else if(tab==='facility'){
      body+=upBanner('facility');
      const gear=G.INDOOR_GEAR.map(k=>upRow(k)).join('');
      const kept=['veg','clone','dryroom','solar'].filter(k=>G.lv(k)>0);
      const roomImg=`<img class="upico" alt="" src="assets/new-art/sprites/dehumidifier.png">`;
      if(!st.land){
        const need=G.LAND_LEVEL, cost=G.LAND_COST, L=landReq();
        body+=`<div class="note">The Indoor Facility is its own room: 40 plots under one ceiling light. It opens at level ${need} for ${fmt(cost)}. The sealed benches are later, at level ${G.INDOOR.level}.</div>${reqList(L)}`;
        body+=ucard({key:'land',theme:'indoor',state:L.every(c=>c.ok)?'canbuy':'locked',img:roomImg,title:'Buy the Indoor Facility',desc:'Opens 40 plots. Gear mounts under the ceiling light after you buy the room.',action:`<button class="btn gold" data-a="land" ${L.every(c=>c.ok)?'':'disabled'}>${st.level<need?ico('lock')+' Lv '+need:fmt(cost)}</button>`});
      } else {
        body+=`<div class="section-t">Indoor Facility · ${G.capOf('field')}/40 plots</div><div class="note">Climate, lights, airflow and nutrients. The ceiling light is already there. Each upgrade mounts in its own spot under that light.</div>`+stepCard('field','Plots');
      }
      body+=`<div class="section-t">Indoor gear</div>`+gear;
      if(st.land){
        body+=`<div class="section-t">Sealed benches</div>`;
        if(!st.inBuilt){ body+=`<div class="note">A later sealed room with its own pots. Finish the checklist when you are ready. Plants already in that room stay on their benches.</div>`+reqList(G.indoorChecklist());
          if(!st.permit) body+=`<button class="btn wide" data-a="permit" ${st.level<G.INDOOR.permitLevel||st.cash<G.INDOOR.permitCost?'disabled':''}>${st.level<G.INDOOR.permitLevel?ico('lock')+'Permit at Lv '+G.INDOOR.permitLevel:'Buy County Agricultural Permit · '+fmt(G.INDOOR.permitCost)}</button>`;
          if(st.permit&&!st.found) body+=`<button class="btn wide" data-a="found" style="margin-top:8px" ${st.level<G.INDOOR.foundLevel||st.cash<G.INDOOR.foundCost?'disabled':''}>${st.level<G.INDOOR.foundLevel?ico('lock')+'Foundation at Lv '+G.INDOOR.foundLevel:'Pour the foundation · '+fmt(G.INDOOR.foundCost)}</button>`;
          body+=`<button class="btn wide gold" data-a="buildin" style="margin-top:8px" ${G.indoorChecklist().every(c=>c.ok)?'':'disabled'}>Build sealed benches · ${fmt(G.INDOOR.build)}</button>`; }
        else body+=`<div class="note">${G.capOf('in')}/32 pots. Open them with the Benches chip on the room tabs.</div>`+stepCard('bench','Benches');
      }
      if(kept.length) body+=`<div class="section-t">Already on this farm</div>`+kept.map(k=>upRow(k)).join('');
    }
    else { body+=upBanner('lines')+`<div class="note">The hose unlocks <b>Water all</b> on the quick-action button. <b>Feed all</b> and <b>Harvest all</b> are free.</div>`+upRow('water')+upRow('nutes'); }
    return {title:'Upgrades',sub:'Gear lives on these cards. Rooms stay clear.',tabs,body};
  };
  // Pheno Room: pheno-hunting mystery
  const parse=v=>!v?null:v.startsWith('s:')?{type:'s',id:v.slice(2)}:{type:'c',name:v.slice(2)};
  PANELS.lab=()=>{
    const st=G.st; let body='';
    if(!G.gate('breed')) body+=`<div class="testbanner" style="color:#ffd9a8">${ico('lock')} The Pheno Room opens at level ${G.GATE.breed}.</div>`;
    const opts=[...G.S.filter(s=>st.discovered&&st.discovered[s.id]).map(s=>['s:'+s.id,s.name]),...Object.keys(st.clones||{}).sort().map(n=>['c:'+n,n+' (clone)'])];
    const sel=(v,id)=>`<select data-sel="${id}" style="width:100%;height:44px;border-radius:12px;background:#0f1d17;color:#fff;border:1px solid var(--line);font:inherit;font-weight:700;padding:0 8px"><option value="">Choose parent…</option>${opts.map(([k,l])=>`<option value="${esc(k)}" ${v===k?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
    const a=parse(labA.v), b=parse(labB.v); let preview='Pick any two parents you own. Nobody hands you the recipe: experiment, and every third failed cross earns a hint token.', cost=0, time=0;
    if(a&&b){ cost=G.crossCost(a,b); time=G.crossTime(a,b); const tr=G.triedResult(a,b); const known=tr&&tr!=='dud'&&G.strain(tr); preview=tr==='dud'?'You tried this cross: no stable pheno came from it.':known?`Known result: <b>${esc(known.name)}</b> (repeat for 3 more seeds)`:'Unknown result. Only one way to find out!'; }
    body+=`<canvas id="labScene" width="720" height="260" style="width:100%;border-radius:14px;display:block;margin-bottom:8px"></canvas>`;
    { const H=st.hunt, pct=x=>(x>=0?'+':'')+Math.round(x*100)+'%';
      body+=`<div class="section-t">Pheno hunt · ${st.breedLab?'Breeding Pheno Room':'Pheno Room'}</div>`;
      if(!st.phenoRoom) body+=`<div class="note">Pheno hunts start once you buy the Indoor Facility (level ${G.LAND_LEVEL}). That turns Grandpa's garage into your Pheno Room.</div>`;
      else if(!H){ const own=G.S.filter(x=>st.discovered[x.id]&&(st.seeds[x.id]||0)>=G.huntSize()); body+=`<div class="note">Pop ${G.huntSize()} seeds of one strain and grow them side by side. Each pheno comes out different. Keep the best one as a <b>mother</b>: every plant of that strain you grow afterwards carries her traits.</div>`+
        (own.length?`<div style="display:grid;grid-template-columns:1fr auto;gap:8px"><select data-sel="H" style="height:44px;border-radius:12px;background:#0f1d17;color:#fff;border:1px solid var(--line);font:inherit;font-weight:700;padding:0 8px">${own.map(x=>`<option value="${x.id}" ${huntSel.v===x.id?'selected':''}>${esc(x.name)} (${st.seeds[x.id]} seeds)${st.keepers[x.id]?' · has mother':''}</option>`).join('')}</select><button class="btn sm green" data-a="hunt">Start hunt</button></div><div class="note">Uses ${G.huntSize()} seeds and takes ${sec(G.huntTime(huntSel.v&&own.find(x=>x.id===huntSel.v)?huntSel.v:own[0].id))}.</div>`:`<div class="note">You need ${G.huntSize()} seeds of a strain. Buy them from the seed bag.</div>`); }
      else if(!H.phenos) body+=`<div class="row"><div class="grow"><h4>Growing out ${H.n} ${esc(G.strain(H.id).name)} phenos…</h4>${bar(H.t/H.dur)}<p>${sec(H.dur-H.t)} left</p></div></div>`;
      else { const best=H.phenos.reduce((b,x,i)=>G.phenoScore(x)>G.phenoScore(H.phenos[b])?i:b,0); body+=`<div class="note">Compare the ${esc(G.strain(H.id).name)} phenos and keep one as your mother${st.keepers[H.id]?' (this replaces your current mother)':''}.</div>`+H.phenos.map((x,i)=>`<div class="row ${i===best?'sel':''}"><canvas class="pcard" width="168" height="192" data-pc='${JSON.stringify(Object.assign({x:84,y:178,h:165},{id:H.id,prog:1,seed:i*7+3,h:165*x.h}))}' style="width:56px;height:64px;flex:none;border-radius:10px;background:#16261d"></canvas><div class="grow"><h4>Pheno ${x.k} · ${x.terp}</h4><p>Yield <b>${pct(x.y-1)}</b> · Quality <b>${pct(x.q)}</b> · Growth speed <b>${pct(x.g-1)}</b></p></div><button class="btn sm gold" data-a="keep" data-i="${i}">Keep</button></div>`).join('')+`<button class="btn sm sec" data-a="drophunt">Discard all</button>`; }
      const K=Object.entries(st.keepers||{}).filter(([id,x])=>x&&typeof x==='object'&&!Array.isArray(x)&&G.strain(id)); if(K.length) body+=`<div class="section-t">Your mothers (${K.length})</div>`+K.map(([id,x])=>`<div class="row"><canvas class="pcard" width="168" height="192" data-pc='${JSON.stringify(Object.assign({x:84,y:178,h:165},{id,prog:.42,seed:40,pruned:true,train:'lst'}))}' style="width:56px;height:64px;flex:none;border-radius:10px;background:#16261d"></canvas><div class="grow"><h4>${esc(G.strain(id).name)} mother ${x.k} <span class="tag" style="background:${G.lineGen(id)>=G.LINE.stable?'#2f7a34':'#8a5a1a'};color:#fff">${G.lineName(id)}</span> · ${x.terp}</h4><p>Yield ${pct(x.y-1)} · Quality ${pct(x.q)} · Growth ${pct(x.g-1)} on every ${esc(G.strain(id).name)} you grow</p></div>${(()=>{ const c=G.cutState(id); return c&&c.ready?`<button class="btn sm green" data-a="cut" data-id="${id}">Take ${G.CUT.n+(st.breedLab?2:0)} cuttings ${fmt(G.CUT.cost*(G.CUT.n+(st.breedLab?2:0)))}</button>`:`<button class="btn sm sec" disabled>Regrowing ${sec(c?c.wait:0)}</button>`; })()}</div>`).join('')+((st.cuts||[]).length?`<div class="section-t">Clone dome</div>`+st.cuts.filter(c=>c&&typeof c==='object'&&G.strain(c.id)).map(c=>`<div class="row"><canvas class="pcard" width="168" height="192" data-pc='${JSON.stringify(Object.assign({x:84,y:178,h:165},{id:c.id,prog:.06,seed:9,h:600,y:186}))}' style="width:56px;height:64px;flex:none;border-radius:10px;background:#16261d"></canvas><div class="grow"><h4>${c.n} ${esc(G.strain(c.id).name)} cuttings rooting</h4>${bar(c.t/c.dur)}<p>${sec(c.dur-c.t)} left. Rooted clones plant 10% grown with the mother's traits.</p></div></div>`).join(''):''); }
    { const P=G.breedProgress(); body+=`<div class="section-t">End game: complete the strain book</div><div class="row" style="display:block"><h4>${P.pct}% complete</h4>${bar(P.pct/100,'amber')}<p>${P.found}/${P.mystery} mystery phenos bred · ${P.stable} lines stable (F${G.LINE.stable}+). New crosses start as unstable F1 lines; keep a mother from each pheno hunt to advance a generation. Legendary recipes need stable parent lines in the Breeding Pheno Room.</p><button class="btn sm sec" data-a="openweb">Open strain book</button></div>`;
      { const ibl=Object.entries(st.lines||{}).filter(([,v])=>v&&typeof v==='object'&&v.gen>=G.LINE.max), n=G.heirCount();
        body+=`<div class="section-t">F6 tier: Heirloom Seed Vault · ${n} heirloom${n===1?'':'s'}</div><div class="note">Take a line to F6 (IBL) with 2 more kept mothers after it is stable, then certify it in the seed bank (24 h, one at a time). Heirlooms earn +12% on every harvest of that strain and fill the Seed Vault.</div>`;
        if(st.cert) body+=`<div class="row heir-row">${cu(G.strain(st.cert.id),56)}<div class="grow"><h4>Certifying ${esc(G.strain(st.cert.id).name)}</h4>${bar(st.cert.t/st.cert.dur,'amber')}<p>${sec(st.cert.dur-st.cert.t)} left in the seed bank</p></div></div>`;
        body+=ibl.length?ibl.map(([id,v])=>`<div class="row heir-row ${v.heir?'heir':''}">${cu(G.strain(id),56)}<div class="grow"><h4>${esc(G.strain(id).name)} <span class="tag" style="background:${v.heir?'#c9971f':'#2f7a34'};color:#fff">${G.lineName(id)}</span></h4><p>${v.heir?'Certified heirloom · +12% on every harvest':'IBL line, ready to certify'}</p></div>${v.heir?'<span class="chip">🏅</span>':G.canCertify(id)?`<button class="btn sm gold" data-a="certify" data-id="${id}">Certify ${fmt(G.heirCost(id))}</button>`:`<button class="btn sm sec" disabled>${st.cert?(st.cert.id===id?'Certifying…':'Seed bank busy'):'Needs Breeding Room'}</button>`}</div>`).join(''):`<div class="note">No F6 lines yet. Lines at F4-F5: ${Object.values(st.lines||{}).filter(v=>v&&typeof v==='object'&&v.gen>=G.LINE.stable&&v.gen<G.LINE.max).length}.</div>`;
        const V=st.vault||{}; body+=`<div class="vault">`+G.VAULT.map((v,i)=>`<div class="vt ${V[i]===2?'got':V[i]===1?'ready':''}"><b>${v.n}</b><span>${esc(v.name)}</span><small>${ico('gem')}${v.r.gems} · ${v.r.legPacks} Leg.</small>${V[i]===1?`<button class="btn sm gold" data-a="vaultclaim" data-i="${i}">Claim</button>`:V[i]===2?'<i>✓</i>':''}</div>`).join('')+`</div>`; }
      if(st.breedLab) body+=`<div class="section-t">Breeding room upgrades</div>`+upRow('labPollen')+upRow('labTissue')+upRow('labSeq'); }
    if(st.breed){ body+=`<div class="row"><div class="grow"><h4>Pollinating…</h4>${bar(st.breed.t/st.breed.dur)}<p>${sec(st.breed.dur-st.breed.t)} left</p></div></div>`; }
    body+=`<div class="section-t">Cross two parents · ${st.hints} hint token${st.hints===1?'':'s'}</div><div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center">${sel(labA.v,'A')}<b>×</b>${sel(labB.v,'B')}</div><div class="note">${preview}</div>`;
    const myst=G.S.filter(s=>s.mystery&&!st.discovered[s.id]).sort((x,y)=>x.tier-y.tier||x.game.unlockLevel-y.game.unlockLevel);
    body+=`<div class="section-t">Mystery phenos (${myst.length} unknown)</div>`+(myst.length?myst.map(s=>{ const hl=G.hintLevel(s); let hint='No hint yet. Level up or keep experimenting.';
      if(hl===1) hint=esc(G.vagueHint(s)||''); else if(hl>=2){ const r=hl-1, parents=Array.isArray(s.parents)?s.parents:[]; hint='Parents: '+parents.map((n,i)=>i<r?'<b>'+esc(n)+'</b>':'???').join(' × '); }
      const canHint=hl<1+Math.min(2,Array.isArray(s.parents)?s.parents.length:0);
      return `<div class="row">${cu(s,96,true)}<div class="grow"><h4>??? ${tag(s)}</h4><p>${hint}</p></div>${canHint?`<button class="btn sm sec" data-a="hint" data-id="${s.id}" ${st.hints<1?'disabled':''}>Use hint</button>`:''}</div>`; }).join(''):'<div class="empty">Every mystery pheno discovered. Legendary!</div>');
    const triedBag=st.tried&&typeof st.tried==='object'&&!Array.isArray(st.tried)?st.tried:{};
    const tried=Object.entries(triedBag).filter(([,r])=>typeof r==='string').slice(-12).reverse();
    if(tried.length) body+=`<div class="section-t">Your breeding log</div>`+tried.map(([k,r])=>{ const named=r==='dud'?'no stable pheno':(G.strain(r)?esc(G.strain(r).name):'unknown'); return `<div class="row"><div class="grow"><p><b>${esc(String(k).split('|').join(' × '))}</b> → ${named}</p></div></div>`; }).join('');
    const names=window.POLLEN.slice().sort();
    body+=`<div class="section-t">Heritage clone library</div><div class="note">Parents you can't grow from seed can be bought once as clones (${fmt(G.cloneCost())} each) and used forever.</div>`+names.map(n=>`<div class="row"><div class="grow"><h4>${esc(n)}</h4></div>${st.clones[n]?'<span class="chip">Owned</span>':`<button class="btn sm sec" data-a="clone" data-n="${esc(n)}" ${st.cash<G.cloneCost(n)?'disabled':''}>${fmt(G.cloneCost(n))}</button>`}</div>`).join('');
    const can=a&&b&&!st.breed&&st.cash>=cost&&G.gate('breed');
    return {title:'Pheno Room',sub:'Hunt mystery phenos by experimenting',body,foot:`<button class="btn wide pink" data-a="breed" ${can?'':'disabled'}>${ico('dna')}${a&&b?'Cross for '+fmt(cost)+' · '+sec(time):'Start cross'}</button>`};
  };
  // Strain book is a single list. Generations follow the longest parent chain, pollen included.
  function bookGroups(){
    const S=(G.S||[]).filter(s=>s&&s.id), nodes=new Map(), nameOf=new Map(), par=new Map();
    S.forEach(s=>{ if(s.name) nameOf.set(String(s.name).toLowerCase(), s.id); nodes.set(s.id,{id:s.id}); });
    S.forEach(s=>{ const parents=Array.isArray(s.parents)?s.parents:[], ids=Array.isArray(s.parentIds)?s.parentIds:[];
      parents.forEach((pn,i)=>{ if(pn==null||pn==='') return; const name=String(pn), pid=ids[i]||nameOf.get(name.toLowerCase())||('p:'+name.toLowerCase());
        if(!nodes.has(pid)) nodes.set(pid,{id:pid,kind:'p'}); (par.get(s.id)||par.set(s.id,[]).get(s.id)).push(pid); }); });
    const gen=new Map();
    const g=id=>{ if(gen.has(id)) return gen.get(id); gen.set(id,0); const P=par.get(id)||[]; const v=P.length?1+Math.max(...P.map(g)):0; gen.set(id,v); return v; };
    const groups=new Map();
    S.forEach(s=>{ const n=g(s.id); if(!groups.has(n)) groups.set(n,[]); groups.get(n).push(s); });
    return [...groups.keys()].sort((a,b)=>a-b).map(n=>({g:n, strains:groups.get(n).sort((a,b)=>(a.tier||0)-(b.tier||0)||String(a.name||'').localeCompare(String(b.name||'')))}));
  }
  function bookState(s, disc, hints){
    if(disc[s.id]) return 'known';
    if(window.PREMIUM_STRAINS&&PREMIUM_STRAINS[s.id]) return 'locked';
    if(s.mystery) return (hints[s.id]||0)>0?'hinted':'mystery';
    return 'locked';
  }
  function parentChips(s, stt, hints){
    const parents=Array.isArray(s.parents)?s.parents:[];
    if(!parents.length) return '<i>Landrace</i>';
    const r=+hints[s.id]||0;
    return parents.map((p,i)=>{ const show=stt==='known'||(stt==='locked'&&!s.mystery)||i<r; return `<i class="${show?'':'hid'}">${show?esc(p):'???'}</i>`; }).join('');
  }
  function bookRow(s, disc, hints, keepers){
    const stt=bookState(s, disc, hints), hid=stt==='mystery'||stt==='hinted';
    const label=hid?'???':(s.name||'Strain'), name=esc(label);
    const raw=keepers[s.id], mom=!!(raw&&typeof raw==='object'&&!Array.isArray(raw));
    const momTxt=mom?'Pheno '+(raw.k||'?'):'none';
    return `<button type="button" class="srow ${stt}" data-a="strain" data-id="${esc(s.id)}" aria-label="${esc(label+'. Kept mother: '+momTxt)}"><span class="sart"><img data-cu="${esc(s.id)}" data-sz="80" data-h="${hid?1:0}" alt=""></span><span class="smeta"><b>${name}</b><span class="schips">${parentChips(s,stt,hints)}</span></span><span class="stag">${mom?'<i class="mom" title="Kept mother">M</i>':''}<em>${hid?'Hidden':esc(s.rarity||'')}</em></span></button>`;
  }
  PANELS.book=()=>{
    const st=G.st||{};
    const disc=st.discovered&&typeof st.discovered==='object'&&!Array.isArray(st.discovered)?st.discovered:{};
    const hints=st.hintRev&&typeof st.hintRev==='object'&&!Array.isArray(st.hintRev)?st.hintRev:{};
    const keepers=st.keepers&&typeof st.keepers==='object'&&!Array.isArray(st.keepers)?st.keepers:{};
    const n=Object.keys(disc).filter(id=>disc[id]).length;
    const P=G.breedProgress();
    const groups=bookGroups();
    const body=`<div class="shead"><span>Breeding completion · ${P.pct}%</span>${bar((P.pct||0)/100,'amber')}</div><div class="sbook">`+
      groups.map(g=>`<h3 class="sgen">${g.g===0?'Gen 1':'Gen '+(g.g+1)} <small>${g.strains.length}</small></h3>`+g.strains.map(s=>bookRow(s,disc,hints,keepers)).join('')).join('')+
      `</div><p class="note">Tap a row for the full card. Close-ups are painted game art.</p>`;
    return {title:'Strain Book', sub:`${n}/${(G.S||[]).length} discovered`, body};
  };
  function strainModal(id){
    const s=G.strain(id), st=G.st||{}, disc=st.discovered&&typeof st.discovered==='object'?st.discovered:{}, d=disc[id];
    if(!s){ modal('<h3>Unknown strain</h3><p>This save names a strain that is not in the book.</p>',[{label:'Close',cls:'sec'}]); return; }
    if(!d&&s.mystery){ const hl=G.hintLevel(s); modal(`<img data-cu="${s.id}" data-sz="200" data-h="1" alt="" style="width:180px;height:180px;border-radius:20px"><h3>??? ${tag(s)}</h3><p>A mystery pheno. Find it by crossbreeding in the Pheno Room.</p><p>${hl>=1?esc(G.vagueHint(s)):'No hint yet.'}</p>`,[{label:'Close',cls:'sec'}]); return; }
    const m=G.mastery(id), L=s.look||{}, parents=Array.isArray(s.parents)?s.parents:[], terps=Array.isArray(s.terpenes)?s.terpenes:[], flavors=Array.isArray(s.flavors)?s.flavors:[], game=s.game||{}, recipes=st.recipes&&typeof st.recipes==='object'?st.recipes:{}, recipe=typeof recipes[id]==='string'?recipes[id]:'';
    const html=`<img data-cu="${s.id}" data-sz="220" data-h="0" alt="" style="width:200px;height:200px;border-radius:20px"><h3>${esc(s.name)}</h3><div>${tag(s)} <span class="chip">${s.type}</span></div>
      <dl class="kv" style="text-align:left"><dt>Recognition</dt><dd>${esc(s.recognition)}</dd>
      <dt>Lineage</dt><dd>${parents.length?parents.map(esc).join(' × '):'Landrace / unpublished'}</dd>${recipe?`<dt>Your recipe</dt><dd>${esc(recipe.split('|').join(' × '))}</dd>`:''}
      <dt>THC / CBD</dt><dd>${s.thc==null?'THC not published (game estimate '+s.thcEstimate+'%)':s.thc+'%'} / ${s.cbd==null?'n/a':s.cbd+'%'}</dd>
      <dt>Terpenes</dt><dd>${terps.length?terps.join(', '):'Not published'}</dd><dt>Flavors</dt><dd>${flavors.length?flavors.join(', '):'Not published'}</dd>
      <dt>Flowering</dt><dd>${s.floweringDays} days (${esc(s.floweringSource)})</dd><dt>Look</dt><dd>${esc(L.shape||'')} buds, frost ${Math.round((L.frost||0)*100)}% <small style="color:var(--mut)">(${esc(L.src||'ESTIMATE')})</small></dd>
      <dt>In game</dt><dd>${sec(game.growSec||0)} grow · ${game.buds||0} buds · ~${fmt(game.payout||0)}/plant · seed ${fmt(G.seedPrice(s))}</dd>${G.F.mastery?`<dt>Mastery</dt><dd>${m.n} harvests · x${m.m} price${m.next?' · next x'+m.nextM+' at '+m.next:''}</dd>`:''}</dl>
      <p style="text-align:left;font-size:12px">${esc(s.blurb)}</p>${d?'':'<p style="font-size:12px"><b>Not discovered yet</b></p>'}`;
    modal(html,[{label:'Close',cls:'sec'}]);
  }

  // season mini-quest chain + season event card (shared by the Quests panel and the Grower Pass tab)
  function sqHTML(){ const st=G.st, Z=window.PASS, S=Z.seasonNow(), E=G.seasonEv(), I=G.sqInfo(), on=st.event.id==='season';
    const rw=r=>[r.gems?ico('gem')+r.gems:'',r.px?r.px+' pass XP':'',r.rarePacks?r.rarePacks+' Rare pack':'',r.legPacks?r.legPacks+' Legendary pack':'',r.seeds?r.seeds+' '+esc(G.strain(r.strain).name)+' seeds':''].filter(Boolean).join(' · ');
    let h=`<div class="sq-ev ${on?'on':''}" style="background:linear-gradient(135deg,${S.c1},${S.c2})"><div class="sq-ic">${E.icon}</div><div class="grow"><small>SEASON EVENT</small><h4>${esc(E.name)}</h4><p>${esc(E.desc)}${on?` · <b>live now, ${sec(st.event.t)} left</b>`:' · pops up now and then during '+esc(S.name)}</p></div></div>`;
    const done=I.filter(q=>q.state==='done').length;
    h+=`<div class="section-t">${esc(S.name)} quests · ${done}/${I.length} · a new one each week</div>`;
    h+=I.map(q=>{ const act=q.state==='active', ok=act&&q.prog>=q.n;
      return `<div class="row sq-row ${q.state}">${q.state==='locked'||q.state==='later'?'<div class="sq-lock">🔒</div>':portraitImg(q.who,'sport')}<div class="grow"><h4>${q.i+1}. ${q.state==='later'||q.state==='locked'?(q.state==='locked'?'Opens '+new Date(q.opens).toLocaleDateString([], {month:'short',day:'numeric'}):'Finish the quest before this one'):esc(q.t)}</h4>${act?`<p class="sq-say">${esc(q.who)}: "${esc(q.say)}"</p>`+bar(q.prog/q.n,ok?'amber':'')+`<p>${G.num(q.prog)} / ${G.num(q.n)}</p>`:''}<p class="sq-rw">${rw(q.r)}</p></div>${q.state==='done'?'<span class="chip">✓</span>':ok?`<button class="btn sm gold" data-a="sqclaim">Claim</button>`:''}</div>`; }).join('');
    return h+`<div class="note">Season quests are free for everyone. Progress counts from the day each quest opens.</div>`; }
  // Quests, story, sets, leaderboard, season
  PANELS.quests=()=>{
    const st=G.st; tab=tab||'story'; G.ensureQuests(); let body='', foot='';
    const tabs=[['story','Story'],['sq',window.PASS.seasonNow().name.split(' ')[0]],['daily','Daily'],['weekly','Weekly'],['ach','Awards']]; if(st.level>=G.GATE.sets) tabs.push(['sets','Sets']); if(st.level>=G.GATE.leaderboard) tabs.push(['board','Leaderboard']); if(st.level>=G.GATE.season||st.rebirths) tabs.push(['season','Season']);
    const qrow=(q,w,i)=>{ const pr=G.qProg(q), ok=pr>=q.goal; return `<div class="row qrow ${q.c?'ach-done':''}"><div class="grow"><h4>${esc(q.t)}</h4><p>${ico('gem')}${q.r.gems} · ${fmt(q.r.cash)}</p>${bar(pr/q.goal,ok?'amber':'')}<p>${G.num(pr)} / ${G.num(q.goal)}</p></div>${q.c?'<span class="chip">Done</span>':`<button class="btn sm ${ok?'gold':'sec'}" data-a="qclaim" data-w="${w}" data-i="${i}" ${ok?'':'disabled'}>${ok?'Claim':'…'}</button>`}</div>`; };
    if(tab==='story'){ const q=G.curQuest(); const K=window.CHARACTERS['Unko Kuli'];
      body+=`<div class="storyhead">${portraitImg('Unko Kuli','sport')}<div><h4>Unko Kuli</h4><p>${esc(K.role)}</p></div></div>`;
      if(q){ const claim=!!(st.questDone&&G.questMet&&G.questMet(q)); body+=`<div class="row" style="display:block"><h4>${q.who?esc(q.who)+': ':''}${esc(q.t)}</h4><p>Reward: ${q.r.cash?fmt(q.r.cash):''}${q.r.gems?q.r.gems+' gems':''}${q.r.hints?q.r.hints+' hint token(s)':''}</p>${claim?`<button class="btn gold" data-a="goal">Claim reward</button>`:''}</div>`; }
      body+=`<div class="section-t">The road from garage to facility</div>`+G.QUESTS.map((x,i)=>`<div class="row ${i<st.quest?'ach-done':''}"><div class="grow"><p>${i<st.quest?'✅':i===st.quest?'👉':'⬜'} ${i<=st.quest+1?esc(x.t):'???'}</p></div></div>`).join('');
      const fs=G.festState(); if(fs){ const s=G.strain(fs.f.strain); body+=`<div class="section-t">🌺 Festival now: ${esc(fs.f.name)}</div><div class="row">${cu(s,96,!st.discovered[s.id])}<div class="grow"><h4>${esc(fs.f.desc)}</h4><p>Goal: ${fs.f.k==='harvests'?'harvest':'sell'} ${fs.f.goal} ${fs.f.k==='harvests'?'plants':'buds'} during the festival. Reward: exclusive <b>${esc(s.name)}</b> seeds + 25 gems.</p>${bar(fs.prog/fs.f.goal,'amber')}<p>${fs.prog}/${fs.f.goal} · ends ${new Date(fs.f.ends).toLocaleDateString([], {weekday:'long'})}</p></div>${fs.claimed?'<span class="chip">Done</span>':`<button class="btn sm gold" data-a="fest" ${fs.prog>=fs.f.goal?'':'disabled'}>Claim</button>`}</div>`; }
      else if(st.level>=G.GATE.events) body+=`<div class="note">Island festivals run Thursday to Sunday, rotating weekly: ${G.FESTS.map(f=>esc(f.name)).join(', ')}. Each has an exclusive strain.</div>`;
      if(st.event&&st.event.id){ const E=st.event.id==='season'?G.seasonEv():G.EVENTS[st.event.id]; if(E) body+=`<div class="note">${esc(E.name)} · ${esc(E.desc)} · ${sec(st.event.t)} left</div>`; }
    } else if(tab==='sq'){ body+=sqHTML();
    } else if(tab==='daily'){
      body+=`<div class="section-t">Login streak · Day ${st.streak.n||0}</div>${streakHTML(false)}`;
      if(G.dailyReady()) body+=`<button class="btn wide gold" data-a="daily" style="margin-bottom:8px">${ico('gem')}Claim today's gift</button>`;
      body+=`<div class="section-t">Daily quests</div>`+st.dq.list.map((q,i)=>qrow(q,'d',i)).join('')+`<div class="note">Finish all 3 for a bonus Rare Seed Pack + hint token.</div>`;
    } else if(tab==='weekly'){ body+=`<div class="section-t">Weekly quests · reset Monday</div>`+st.wq.list.map((q,i)=>qrow(q,'w',i)).join('')+`<div class="note">Finish all 3 for a Legendary Seed Pack + 2 hint tokens.</div>`;
    } else if(tab==='ach'){ const got=G.ACH.filter(a=>st.ach[a.id]).length;
      body+=`<div class="note">${got}/${G.ACH.length} achievements</div>`+G.ACH.map(a=>{ const s=st.ach[a.id], pr=Math.min(a.goal,G.stat(a.k)); return `<div class="row ${s===2?'ach-done':''}"><span class="ico ico-trophy" style="width:26px;height:26px;${s?'':'filter:grayscale(1) opacity(.4)'}"></span><div class="grow"><h4>${esc(a.name)}</h4><p>${G.num(pr)}/${G.num(a.goal)} · ${ico('gem')}${a.gems}</p>${s?'':bar(pr/a.goal)}</div>${s===1?`<button class="btn sm gold" data-a="achclaim" data-id="${a.id}">Claim</button>`:s===2?'<span class="chip">Done</span>':''}</div>`; }).join('');
      if(G.achReady()) foot=`<button class="btn wide gold" data-a="achall">${ico('trophy')}Claim all (${G.achReady()})</button>`;
    } else if(tab==='sets'){ body+=`<div class="note">Harvest every strain in a set once for a permanent bonus.</div>`+Object.entries(G.SETS).map(([k,d])=>{ const n=d.ids.filter(i=>(st.harv[i]||0)>0).length; return `<div class="row ${st.sets[k]?'ach-done':''}"><div class="grow"><h4>${esc(d.name)} ${st.sets[k]?'<span class="chip">Complete</span>':''}</h4><p>${esc(d.desc)} · Bonus: <b>${esc(d.bonus)}</b></p>${bar(n/d.ids.length,'amber')}<p>${d.ids.map(i=>{ const s=G.strain(i); const ok=(st.harv[i]||0)>0; return `<span class="chip" style="${ok?'background:rgba(95,224,138,.25)':''}">${st.discovered[i]||!s.mystery?esc(s.name):'???'}${ok?' ✓':''}</span>`; }).join(' ')}</p></div></div>`; }).join('');
    } else if(tab==='board'){ body+=`<div class="note">Offline island rankings: your best scores against fictional island growers (computer rivals). Online rankings (Game Center / Google Play Games) arrive with the app versions.</div><div id="lbBox"><div class="empty">Loading…</div></div>`; setTimeout(fillBoard,0);
    } else { const need=G.rebirthNeed(), pct=Math.min(1,st.runEarn/need), gain=G.manaGain();
      body+=`<div class="row" style="display:block"><h4>New Season ${st.rebirths?'#'+(st.rebirths+1):''}</h4><p>Season earnings ${fmt(st.runEarn)} of ${fmt(need)}</p>${bar(pct,'amber')}<p>Starting a new season now earns <b>${gain} Island Spirit</b>. Unspent spirit adds +1% to all prices each.</p></div>`;
      body+=`<div class="section-t">Island Spirit tree · ${st.mana} to spend</div>`+Object.entries(G.MANA_UPG).map(([k,d])=>{ if(k==='crew') return `<div class="row"><div class="grow"><h4>${esc(d.name)}</h4><p>${esc(d.desc)}</p></div><span class="chip">Retired</span></div>`; const l=G.mana(k), mx=l>=d.max, c=mx?0:G.manaCost(k); return `<div class="row"><div class="grow"><h4>${esc(d.name)} ${pips(l,d.max)}</h4><p>${esc(d.desc)}</p></div>${mx?'<span class="chip">MAX</span>':`<button class="btn sm gem" data-a="mana" data-k="${k}" ${st.mana<c?'disabled':''}>${c} spirit</button>`}</div>`; }).join('');
      body+=`<div class="note"><b>You keep:</b> strains, recipes, hints, clones, level, gems, packs, themes, perks, mastery, sets and reputation.<br><b>Resets:</b> cash, garage tables and buckets, land, greenhouse, indoor facility, upgrades, seeds and inventory.</div>`;
      foot=`<button class="btn gold wide" data-a="rebirth" ${pct<1?'disabled':''}>${ico('star')}${pct<1?'Earn '+fmt(need-st.runEarn)+' more':'Start New Season (+'+gain+' spirit)'}</button>`; }
    return {title:'Story & Quests',sub:'Daily, weekly and lifetime rewards. All free.',tabs,body,foot};
  };
  async function fillBoard(){ const el=$('#lbBox'); if(!el) return; const B=window.Leaderboard.BOARDS; let h='';
    for(const [k,b] of Object.entries(B)){ const L=await window.Leaderboard.top(k,'You'); const me=L.find(x=>x.me);
      h+=`<div class="section-t">${esc(b.name)} · you are #${me.rank}</div>`+L.slice(0,5).concat(me.rank>5?[me]:[]).map(r=>`<div class="row ${r.me?'sel':''}"><div class="grow"><p><b>#${r.rank}</b> ${esc(r.name)}${r.rival?' <small style="color:var(--mut)">(rival)</small>':''}</p></div><b>${b.fmt==='cash'?fmt(r.score):G.num(r.score)}</b></div>`).join(''); }
    if($('#lbBox')) $('#lbBox').innerHTML=h; }
  function art(k){
    const gem=(x,y,s,c1='#e9fdff',c2='#3a8cff')=>`<path d="M${x-s} ${y-s*.3}L${x-s*.5} ${y-s}H${x+s*.5}L${x+s} ${y-s*.3}L${x} ${y+s}Z" fill="url(#gg)" stroke="#fff" stroke-opacity=".6"/>`;
    const defs=`<defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9fdff"/><stop offset=".5" stop-color="#6fd7ff"/><stop offset="1" stop-color="#2a6cff"/></linearGradient><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="1" stop-color="#e69b17"/></linearGradient></defs>`;
    const w=b=>`<svg class="art" viewBox="0 0 64 64">${defs}${b}</svg>`;
    switch(k){
      case 'gems1': return w(gem(32,34,16));
      case 'gems2': return w(gem(22,38,12)+gem(42,38,12)+gem(32,24,13));
      case 'gems3': return w(`<rect x="8" y="34" width="48" height="22" rx="4" fill="#a8743a"/>`+gem(18,30,10)+gem(46,30,10)+gem(32,22,13)+gem(32,40,9));
      case 'gems4': return w(`<rect x="6" y="20" width="52" height="38" rx="6" fill="#3a4b6a"/><circle cx="32" cy="39" r="11" fill="#6a7b9a"/>`+gem(20,16,9)+gem(44,16,9)+gem(32,10,10));
      case 'starter': return w(`<rect x="10" y="26" width="44" height="30" rx="4" fill="#ff6fb1"/><rect x="8" y="20" width="48" height="10" rx="3" fill="#ff8ad0"/><rect x="29" y="20" width="6" height="36" fill="#ffd34d"/><path d="M32 20c-8-12-18-6-10 0zM32 20c8-12 18-6 10 0z" fill="#ffd34d"/>`);
      case 'pass': return w(`<circle cx="32" cy="32" r="24" fill="url(#gold)"/><text x="32" y="40" font-size="22" font-weight="900" text-anchor="middle" fill="#3a2500" font-family="sans-serif">2x</text>`);
      case 'vip': return w(`<path d="M10 46L14 18l12 14 6-18 6 18 12-14 4 28z" fill="url(#gold)"/><rect x="10" y="46" width="44" height="8" rx="2" fill="#e69b17"/><circle cx="32" cy="38" r="4" fill="#ff6fb1"/>`);
      case 'skip': return w(`<circle cx="32" cy="34" r="22" fill="#2a3a4a" stroke="#9be6ff" stroke-width="4"/><path d="M32 18v16l10 6" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M48 10l8 6-8 6z" fill="#9be6ff"/>`);
      case 'mgr': return w(`<circle cx="32" cy="22" r="10" fill="#c68a5e"/><path d="M14 58c0-14 8-22 18-22s18 8 18 22z" fill="#3ab08a"/><path d="M22 18c2-8 18-8 20 0" fill="#2a1a10"/><circle cx="50" cy="14" r="9" fill="url(#gold)"/><text x="50" y="18" font-size="12" font-weight="900" text-anchor="middle" fill="#3a2500">+</text>`);
      case 'boost_grow': return w(`<circle cx="32" cy="32" r="26" fill="#1f6a3a"/><path d="M32 50V26M32 30c-10-2-14-10-12-16 8 0 12 6 12 16zM32 34c10-2 14-10 12-16-8 0-12 6-12 16z" fill="#8ee06a" stroke="#cfffb0" stroke-width="1.5"/><text x="32" y="60" font-size="12" font-weight="900" text-anchor="middle" fill="#fff">2x</text>`);
      case 'boost_price': return w(`<circle cx="32" cy="32" r="26" fill="url(#gold)"/><text x="32" y="40" font-size="22" font-weight="900" text-anchor="middle" fill="#3a2500">$$</text>`);
      case 'boost_pheno': return w(`<circle cx="32" cy="32" r="26" fill="#5a2a8a"/><path d="M22 12c20 10-20 30 0 40M42 12c-20 10 20 30 0 40" stroke="#ff9ad6" stroke-width="3" fill="none"/><path d="M24 22h16M24 32h16M24 42h16" stroke="#fff" stroke-width="2"/>`);
      case 'piggy': return w(`<ellipse cx="32" cy="36" rx="22" ry="17" fill="#ff8ab8"/><circle cx="50" cy="34" r="7" fill="#ff6fa6"/><circle cx="24" cy="30" r="2" fill="#3a1a2a"/><rect x="26" y="18" width="12" height="3" rx="1" fill="#3a1a2a"/><path d="M18 50v6M42 50v6" stroke="#ff6fa6" stroke-width="5"/>`+gem(32,10,7));
      case 'pack_rare': return w(`<rect x="14" y="8" width="36" height="48" rx="5" fill="#2f6fd6"/><path d="M14 14l6-6h24l6 6z" fill="#5a90ff"/><circle cx="32" cy="34" r="10" fill="#9fd76a"/><path d="M32 26c-4 4-4 12 0 16 4-4 4-12 0-16z" fill="#2f7a34"/>`);
      case 'pack_leg': return w(`<rect x="14" y="8" width="36" height="48" rx="5" fill="url(#gold)"/><path d="M14 14l6-6h24l6 6z" fill="#ff6fb1"/><circle cx="32" cy="34" r="10" fill="#b07be0"/><path d="M32 26c-4 4-4 12 0 16 4-4 4-12 0-16z" fill="#5a2a8a"/>`);
      default: { const th={theme_neon:['#2a0a5a','#ff3fd0','#3ff0ff'],theme_plumeria:['#7fd0ff','#ffd1e3','#5aa64a'],theme_mauna:['#1f4a8a','#f4f8ff','#3f8a5a']}[k]||['#3fa6ef','#ffd27a','#4c9a3b'];
        return w(`<rect x="4" y="8" width="56" height="48" rx="10" fill="${th[0]}"/><path d="M4 40Q20 18 34 30T60 26V48a8 8 0 01-8 8H12a8 8 0 01-8-8z" fill="${th[2]}"/><circle cx="46" cy="20" r="7" fill="${th[1]}"/><path d="M14 44v-14M14 30c-6-2-8 2-8 2M14 30c6-3 9 1 9 1M14 30c-3-5-1-8-1-8" stroke="#3a2a1a" stroke-width="2" fill="none"/>`); }
    }
  }
  function pct(p){ return (Math.round(p*10000)/100).toFixed(2)+'%'; }
  function renderOdds(o){
    if(!o) return '';
    let h=`<div class="odds"><h5>Drop odds</h5><p>${o.seedCount} seeds. Each chance below is for one roll, taken from the live drop table. Percents are rounded to the nearest 0.01%.</p>`;
    o.slots.forEach(slot=>{
      h+=`<p><b>${esc(slot.label)}${slot.count>1?' · '+slot.count+' seeds':''}</b></p>`;
      if(slot.fallbackUsed) h+=`<p>The higher tier has no seeds right now, so this slot uses the next tier.</p>`;
      if(slot.empty||!slot.tiers.length){ h+=`<p>No seeds in this pool.</p>`; return; }
      h+=`<table class="odds-table"><thead><tr><th>Rarity and item</th><th>Chance</th></tr></thead><tbody>`;
      slot.tiers.forEach(t=>{
        h+=`<tr class="odds-tier"><td>${esc(t.rarity)}</td><td>${pct(t.chance)}</td></tr>`;
        t.items.forEach(it=>{ h+=`<tr class="odds-item"><td>${esc(it.name)}</td><td>${pct(it.chance)}</td></tr>`; });
      });
      h+=`</tbody></table>`;
    });
    if(o.hints) h+=`<p><b>Hint tokens:</b> ${o.hints}, every pack (100%).</p>`;
    o.bonuses.forEach(b=>{
      h+=`<p><b>${esc(b.label)}</b></p><table class="odds-table"><thead><tr><th>Outcome</th><th>Chance</th></tr></thead><tbody>`;
      h+=`<tr class="odds-tier"><td>No extra seed</td><td>${pct(b.none)}</td></tr>`;
      b.items.forEach(it=>{ h+=`<tr class="odds-item"><td>${esc(it.name)} <span class="mut">(${esc(it.rarity)})</span></td><td>${pct(it.chance)}</td></tr>`; });
      h+=`</tbody></table>`;
    });
    return h+`</div>`;
  }
  function oddsForProduct(p){
    const g=(p&&p.grants)||{}; const parts=[];
    if(g.rarePacks) parts.push(renderOdds(G.packOdds('rare')));
    if(g.legPacks) parts.push(renderOdds(G.packOdds('leg')));
    return parts.join('');
  }
  function prodCard(p){
    const st=G.st, P=window.Payments;
    const owned=p.once&&(P.isOwned(p.id)||(p.grants.pass2x&&st.pass2x)||(p.grants.vip&&st.vip)||(p.grants.theme&&!p.grants.gems&&st.themes[p.grants.theme]));
    const btn=owned?`<button class="btn sm sec" disabled>Owned</button>`:p.kind==='usd'?`<button class="btn sm pink" data-a="usd" data-id="${p.id}">${P.formatUSD(p.priceUSD)}</button>`:`<button class="btn sm gem" data-a="gemsbuy" data-id="${p.id}" ${st.gems<p.priceGems?'disabled':''}>${ico('gem')}${G.num(p.priceGems)}</button>`;
    const odds=oddsForProduct(p);
    return `<div class="prod ${owned?'owned':''}${odds?' wide':''}">${p.flag&&!owned?`<span class="flag">${p.flag}</span>`:''}${art(p.art)}<h4>${esc(p.name)}</h4><p>${esc(p.desc)}</p>${odds}${btn}</div>`;
  }
  // ---- ads / piggy / rush / cosmetics / exclusive strains ----
  function adsCard(){ const a=G.adState(), A=G.ADS, full=a.n>=A.cap; return `<div class="section-t">Watch ads for gems</div><div class="row adcard"><span class="ico ico-gem" style="width:34px;height:34px"></span><div class="grow"><h4>Watch a short ad: +${A.gems} gems</h4>
      <p>Every ${A.bonusAt} ads earns a <b>+${A.bonus} gem bonus</b>. Up to ${A.cap} ads a day (max ${A.cap*A.gems+Math.floor(A.cap/A.bonusAt)*A.bonus} gems), resets at midnight.</p>${bar(full?1:(a.n%A.bonusAt)/A.bonusAt,'amber')}<p><b>${full?A.bonusAt:a.n%A.bonusAt}/${A.bonusAt}</b> to the next +${A.bonus} bonus · ${a.n}/${A.cap} ads today${a.bonus?' · '+a.bonus+' bonus'+(a.bonus>1?'es':'')+' earned':''}</p></div>
      <button class="btn sm pink" data-a="watchad" ${full?'disabled':''}>${full?'Come back tomorrow':'▶ Watch ad'}</button></div>`; }
  function piggyCard(){ const P=G.PIGGY, g=Math.floor(G.st.piggy.g), ok=g>=P.min; return `<div class="section-t">Piggy bank</div><div class="row piggy"><div class="pigart">${art('piggy')}</div><div class="grow"><h4>${G.num(g)} / ${P.cap} gems saved</h4>
      <p>Fills as you play: harvests, goals, quests and achievements. Crack it any time it holds ${P.min}+ gems.</p>${bar(g/P.cap,'amber')}</div><button class="btn sm pink" data-a="usd" data-id="piggy" ${ok?'':'disabled'}>${ok?'Crack · '+window.Payments.formatUSD(window.PRODUCTS.piggy.priceUSD):'Needs '+P.min}</button></div>`; }
  function rushCard(){ const T=G.timers(); return `<div class="section-t">Finish timers now</div>`+(T.length?T.map(t=>`<div class="row"><div class="grow"><h4>${esc(t.name)}</h4><p>${sec(t.left)} left · priced by time left</p></div><button class="btn sm gem" data-a="rush" data-k="${t.k}" data-i="${t.i==null?'':t.i}" ${G.st.gems<t.gems?'disabled':''}>${ico('gem')}${t.gems} Finish</button></div>`).join(''):'<div class="empty">Nothing is running right now. Breeding, pheno hunts, cuttings, drying, curing and crafting can be finished early here.</div>'); }
  let cosPrev=null;
  function styleTab(){ const st=G.st, C=window.COSMETICS, own=k=>G.cosOwned(k), eq=st.cos.eq, pay=window.Payments; let h='';
    const pv=cosPrev||(()=>{ for(const sl in C) if(eq[sl]) return {sl,id:eq[sl]}; return {sl:'truck',id:'sunset'}; })(), pd=C[pv.sl].items[pv.id];
    h+=`<div class="cos-hero"><canvas class="cosprev big" width="640" height="360" data-sl="${pv.sl}" data-id="${pv.id}"></canvas><div class="cos-hero-t"><b>${esc(pd.name)}</b><span>${esc(C[pv.sl].label)} · ${own(pv.sl+':'+pv.id)?(eq[pv.sl]===pv.id?'Equipped':'Owned'):'Preview'}</span></div></div>`;
    h+=`<div class="note">Cosmetic only: no gameplay effect. Buy with money or gems, then equip or unequip any time. Tap a card to preview it.</div>`;
    for(const [sl,g] of Object.entries(C)){ h+=`<div class="section-t">${esc(g.label)}</div><div class="prod-grid">`;
      for(const [id,c] of Object.entries(g.items)){ const k=sl+':'+id, o=own(k), on=eq[sl]===id, pu=window.PRODUCTS['cos_'+sl+'_'+id], pg=window.PRODUCTS['cos_'+sl+'_'+id+'_g'];
        h+=`<div class="prod cos ${on?'on':''} ${pv.sl===sl&&pv.id===id?'sel':''}" data-a="cosprev" data-sl="${sl}" data-id="${id}"><canvas class="cosprev" width="240" height="170" data-sl="${sl}" data-id="${id}"></canvas><h4>${esc(c.name)}</h4><p>${esc(c.desc)}</p>`+
          (o?`<button class="btn sm ${on?'sec':'green'}" data-a="equip" data-sl="${sl}" data-id="${on?'':id}">${on?'Unequip':'Equip'}</button>`:c.pass?`<button class="btn sm sec" data-a="gopass">Grower Pass reward</button>`:`<div class="buy2"><button class="btn sm pink" data-a="usd" data-id="${pu.id}">${pay.formatUSD(pu.priceUSD)}</button><button class="btn sm gem" data-a="gemsbuy" data-id="${pg.id}" ${st.gems<pg.priceGems?'disabled':''}>${ico('gem')}${G.num(pg.priceGems)}</button></div>`)+`</div>`; }
      h+='</div>'; }
    return h; }
  function strainsTab(){ const st=G.st, pay=window.Payments, n=G.PREMIUM.filter(id=>G.strain(id)).length||1;
    let h=`<div class="note">Exclusive Legendary strains. Buy seeds here with money or gems, or find an extra seed in play: <b>Legendary Seed Packs (${pct(G.DROP.packPremium)} total, ${pct(G.DROP.packPremium/n)} each)</b> and <b>finished pheno hunts (${pct(G.DROP.huntPremium)} total, ${pct(G.DROP.huntPremium/n)} each)</b>. Those extras do not replace the pack's listed seeds.</div><div class="prod-grid">`;
    for(const id of G.PREMIUM){ const s=G.strain(id); if(!s) continue; const pu=window.PRODUCTS['strain_'+id], pg=window.PRODUCTS['strain_'+id+'_g'];
      h+=`<div class="prod excl"><span class="flag">Exclusive</span><img data-cu="${id}" data-sz="160" data-h="0" alt="" style="width:100%;aspect-ratio:1;border-radius:14px"><h4>${esc(s.name)}</h4><p>${tag(s)} ${esc(s.type)} · ${s.thc?s.thc+'% THC':''}<br>${esc((s.blurb||'').slice(0,90))}…</p><p>${st.discovered[id]?'In your book · '+(st.seeds[id]||0)+' seeds':'Not discovered yet'}</p>
        <div class="buy2"><button class="btn sm pink" data-a="usd" data-id="${pu.id}">${pay.formatUSD(pu.priceUSD)}</button><button class="btn sm gem" data-a="gemsbuy" data-id="${pg.id}" ${st.gems<pg.priceGems?'disabled':''}>${ico('gem')}${G.num(pg.priceGems)}</button></div></div>`; }
    return h+'</div>'; }
  function rwText(r){ if(!r) return ''; const a=[]; if(r.cos){ const [sl,id]=r.cos.split(':'); a.push(window.COSMETICS[sl].items[id].name); } if(r.strain) a.push(r.n+'x '+G.strain(r.strain).name+' seeds'); if(r.legPacks) a.push('Legendary pack'); if(r.rarePacks) a.push('Rare pack'); if(r.boost) a.push(G.BOOSTS[r.boost].name+' 1h'); if(r.skip) a.push('Skip '+sec(r.skip)); if(r.gems) a.push(r.gems+' gems'); return a.join(' + '); }
  function rwIcon(r){ if(!r) return ''; if(r.cos){ const [sl,id]=r.cos.split(':'); return `<canvas class="cosprev" width="150" height="104" data-sl="${sl}" data-id="${id}"></canvas>`; } if(r.strain) return `<img data-cu="${r.strain}" data-sz="96" data-h="0" alt="">`; if(r.legPacks) return art('pack_leg'); if(r.rarePacks) return art('pack_rare'); if(r.boost) return art('boost_'+r.boost); if(r.skip) return art('skip'); return art(r.gems>=50?'gems2':'gems1'); }
  function passTab(){ const st=G.st, Z=window.PASS, S=Z.seasonNow(), P=G.passState(), T=Z.track(S), tier=G.passTier(), pay=window.Payments, left=S.end-Date.now(), into=P.xp-tier*Z.XP_PER_TIER;
    const tt=Z.totals(S); let h=`<div class="pass-hero" style="background:linear-gradient(135deg,${S.c1},${S.c2})"><div class="ph-t"><small>GROWER PASS · ${esc(S.tag.toUpperCase())}</small><h3>${esc(S.name)}</h3><p>Ends in <b>${sec(Math.max(0,left/1000))}</b> · ${new Date(S.start).toLocaleDateString([], {month:'short'})} - ${new Date(S.end-864e5).toLocaleDateString([], {month:'short',day:'numeric'})}</p></div><img class="ph-seed" data-cu="${S.strain}" data-sz="160" data-h="0" alt=""></div>`;
    h+=`<div class="row" style="display:block"><h4>Tier ${tier}/${Z.TIERS} ${P.premium?'<span class="tag" style="background:#ffd35a;color:#3a2500">Premium'+(P.plus?'+':'')+'</span>':''}</h4>${bar(tier>=Z.TIERS?1:into/Z.XP_PER_TIER,'amber')}<p>${tier>=Z.TIERS?'Pass complete!':G.num(into)+' / '+Z.XP_PER_TIER+' pass XP to tier '+(tier+1)} · Earn pass XP from harvests, sales, goals and quests, breeding, kept mothers and ads.</p></div>`;
    if(!P.premium) h+=`<div class="pass-buy"><div><b>Premium track</b><p>~${G.num(tt.prem.gems)} gems, ${tt.prem.cosmetics} ${esc(S.name)} cosmetics, ${tt.prem.seeds} exclusive ${esc(G.strain(S.strain).name)} seeds, ${tt.prem.legPacks} Legendary + ${tt.prem.rarePacks} Rare packs, ${tt.prem.boosts} boosts, ${tt.prem.skipsH}h of skips. Drop odds for those packs are above the price.</p></div>
      ${renderOdds(G.packOdds('rare'))}${renderOdds(G.packOdds('leg'))}
      <div class="buy2"><button class="btn sm pink" data-a="usd" data-id="pass_premium">Premium ${pay.formatUSD(Z.PRICE.premium)}</button><button class="btn sm gold" data-a="usd" data-id="pass_plus">Premium+ ${pay.formatUSD(Z.PRICE.plus)} (skip 10 tiers)</button><button class="btn sm gem" data-a="gemsbuy" data-id="pass_premium_g" ${st.gems<Z.PRICE.gems?'disabled':''}>${ico('gem')}${G.num(Z.PRICE.gems)}</button></div></div>`;
    const ready=T.filter(r=>r.tier<=tier&&((r.f&&!P.cf[r.tier])||(P.premium&&!P.cp[r.tier]))).length;
    h+=`<div class="section-t">Reward track ${ready?`<button class="btn sm gold" data-a="passall" style="float:right">Claim all (${ready})</button>`:''}</div><div class="pass-track" id="passTrack">`;
    for(const r of T){ const un=r.tier<=tier, fc=P.cf[r.tier], pc=P.cp[r.tier];
      h+=`<div class="pt-col ${un?'un':''} ${r.tier===tier+1?'next':''}"><div class="pt-n">${r.tier}</div>
        <div class="pt-cell free ${fc?'got':''}">${r.f?rwIcon(r.f)+`<span>${esc(rwText(r.f))}</span>`+(un&&!fc?`<button class="btn sm green" data-a="passclaim" data-t="${r.tier}" data-k="f">Claim</button>`:fc?'<i>✓</i>':''):'<span class="mut">-</span>'}</div>
        <div class="pt-cell prem ${pc?'got':''} ${P.premium?'':'locked'}">${rwIcon(r.p)}<span>${esc(rwText(r.p))}</span>${un&&P.premium&&!pc?`<button class="btn sm gold" data-a="passclaim" data-t="${r.tier}" data-k="p">Claim</button>`:pc?'<i>✓</i>':P.premium?'':'<i>🔒</i>'}</div></div>`; }
    h+=`</div><div class="note">Free track for everyone. Pass cosmetics are cosmetic only. ${esc(G.strain(S.strain).name)} also drops rarely in play this season (${pct(G.DROP.huntSeason)} from finished pheno hunts and ${pct(G.DROP.packSeason)} from Legendary Seed Packs, as an extra seed).</div>`;
    h+=sqHTML(); return h; }
  function drawCosPrev(root){ root.querySelectorAll('canvas.cosprev').forEach(c=>{ try{ R.cosPreview(c.getContext('2d'),c.dataset.sl,c.dataset.id); }catch(e){} }); }
  PANELS.shop=()=>{
    tab=tab||'featured'; const st=G.st, P=window.PRODUCTS, pay=window.Payments; let body='';
    if(pay.mode==='test') body+=`<div class="testbanner">TEST MODE: no real charges. Purchases are granted locally so you can try the shop.</div>`;
    const list=ids=>`<div class="prod-grid">${ids.map(i=>prodCard(P[i])).join('')}</div>`;
    if(tab==='featured'){
      const sOwned=pay.isOwned('starter');
      if(!sOwned) body+=`<div class="shop-hero"><span class="ribbon">BEST DEAL</span><h3>Island Starter Bundle</h3><p>500 gems · 2 Rare Seed Packs · ${fmt(2500)} cash · Neon Luau theme. Each Rare Seed Pack uses the odds below.</p>${renderOdds(G.packOdds('rare'))}<button class="btn" data-a="usd" data-id="starter" style="background:#fff;color:#d63d93;box-shadow:0 3px 0 #b02a78">Get it · ${pay.formatUSD(P.starter.priceUSD)}</button></div>`;
      body+=`<div class="section-t">Perks</div>`+list(['pass2x','vip']);
      if(st.rarePacks||st.legPacks) body+=`<div class="section-t">Your seed packs</div><div class="row"><div class="grow"><h4>Rare packs: ${st.rarePacks} · Legendary packs: ${st.legPacks}</h4></div>${st.rarePacks?'<button class="btn sm" data-a="openpack" data-k="rare">Open rare</button>':''}${st.legPacks?'<button class="btn sm gold" data-a="openpack" data-k="leg">Open legendary</button>':''}</div>`;
      body+=`<div class="section-t">Gems</div>`+list(['gems_s','gems_m','gems_l','gems_xl']);
    } else if(tab==='gemstore'){
      const live=Object.keys(G.BOOSTS).filter(k=>G.boostLeft(k)>0);
      if(live.length) body+=`<div class="note">Running now: ${live.map(k=>esc(G.BOOSTS[k].name)+' · '+sec(G.boostLeft(k))).join(' · ')}</div>`;
      body+=adsCard()+piggyCard()+`<div class="section-t">Boosts (1 hour each, they stack)</div>`+list(['boost_grow','boost_price','boost_pheno'])+rushCard();
      body+=`<div class="section-t">More gem items</div><div class="note">Gems are also earned free: level-ups (+10), goals, daily and weekly quests, achievements, login streaks, new strain discoveries and golden buds.</div>`+list(['skip15','skip60','skip240','pack_rare','pack_leg','pass2x_g','vip_g']);
      if(st.rarePacks||st.legPacks) body+=`<div class="row"><div class="grow"><h4>Packs to open: ${st.rarePacks} rare · ${st.legPacks} legendary</h4></div>${st.rarePacks?'<button class="btn sm" data-a="openpack" data-k="rare">Open rare</button>':''}${st.legPacks?'<button class="btn sm gold" data-a="openpack" data-k="leg">Open legendary</button>':''}</div>`;
    } else if(tab==='pass'){ body+=passTab(); } else if(tab==='style'){ body+=styleTab(); } else if(tab==='strains'){ body+=strainsTab(); } else {
      body+=`<div class="note">Themes are cosmetic only. Golden Hour unlocks free at level 10.</div>`+list(['theme_neon','theme_plumeria','theme_mauna']);
      body+=`<div class="section-t">Your themes</div>`+Object.entries(window.THEMES).map(([k,t])=>`<div class="row"><div class="grow"><h4>${esc(t.name)}</h4><p>${st.themes[k]?'Owned':t.earnLevel?'Unlocks at level '+t.earnLevel:'Not owned'}</p></div>${st.themes[k]?`<button class="btn sm ${st.theme===k?'':'sec'}" data-a="theme" data-k="${k}">${st.theme===k?'Active':'Use'}</button>`:''}</div>`).join('');
    }
    body+=`<div class="note">Free to play: every non-cosmetic item here can also be earned in game. Purchases are saved on this device.</div>`;
    return {title:'Island Shop',sub:`${ico('gem')} ${G.num(st.gems)} gems`,tabs:[['featured','Featured'],['pass','Grower Pass'],['gemstore','Gems & Boosts'],['style','Style'],['strains','Exclusive'],['themes','Themes']],body};
  };
  function saveBlock(){
    const pack=exportPack;
    let extra='';
    if(saveUi==='export'&&pack){
      extra=`<textarea class="savebox" readonly aria-label="Backup code">${esc(pack.code)}</textarea>`
        +`<div class="buy2"><button class="btn sm" data-a="savecopy">Copy code</button><button class="btn sm sec" data-a="savedown">Download file</button><button class="btn sm sec" data-a="saveclose">Close</button></div>`
        +(pack.corrupt?'<p class="note">This save could not be read. Copy or download it before you import a different farm.</p>':'<p class="note">Keep this code or file somewhere safe. Store purchases stay on this device and are not inside the backup.</p>');
    } else if(saveUi==='import'){
      extra=`<textarea class="savebox" data-savecode="in" aria-label="Backup code to restore" placeholder="Paste a backup code or JSON">${esc(importDraft)}</textarea>`
        +`<input class="savefile" type="file" accept="application/json,.json,.txt,text/plain" data-savefile="1" aria-label="Backup file">`
        +`<div class="buy2"><button class="btn sm pink" data-a="saveimportgo">Restore</button><button class="btn sm sec" data-a="saveclose">Close</button></div>`
        +`<p class="note">Restore asks before it replaces the farm on this device. Store purchases on this device stay.</p>`;
    }
    return `<div class="section-t">Save</div>`
      +`<div class="note">The farm is stored in this browser and kept when the game updates. Export a backup before you clear site data or switch devices.</div>`
      +(G.st._holdSave?'<div class="note"><b>The save on this device could not be read.</b> It has not been overwritten. Export it, or import a backup.</div>':'')
      +`<div class="row"><div class="grow"><h4>Export save</h4><p>Copy a backup code or download a file</p></div><button class="btn sm sec" data-a="export">Export</button></div>`
      +`<div class="row"><div class="grow"><h4>Import save</h4><p>Paste a code or choose a file</p></div><button class="btn sm sec" data-a="import">Import</button></div>`
      +extra;
  }
  function supportPlatform(){
    try{
      const nav=navigator||{};
      const p=nav.userAgentData&&nav.userAgentData.platform;
      if(p) return String(p);
      if(nav.platform) return String(nav.platform);
    }catch(e){}
    return 'unknown';
  }
  function supportMailto(){
    const cfg=window.GAME_CONFIG||{};
    const email=String(cfg.SUPPORT_EMAIL||'808games@mail.grokbot.com');
    const id=G.supportId?G.supportId():'';
    const lines=[
      'Game version: '+(cfg.version||''),
      'OS / platform: '+supportPlatform(),
      'Anonymous player ID: '+id
    ];
    return 'mailto:'+encodeURI(email)+'?subject='+encodeURIComponent((cfg.title||'Maui Wowie Farms')+' support')+'&body='+encodeURIComponent(lines.join('\n'));
  }
  function helpBlock(){
    const id=G.supportId?G.supportId():'';
    const email=String((window.GAME_CONFIG&&GAME_CONFIG.SUPPORT_EMAIL)||'808games@mail.grokbot.com');
    const head=`<div class="section-t">Help & Support</div><div class="row"><div class="grow"><h4>Help & Support</h4><p>Contact, backups, purchases, and the tutorial</p></div><button class="btn sm ${helpUi?'':'sec'}" data-a="help">${helpUi?'Close':'Open'}</button></div>`;
    if(!helpUi) return head;
    return head
      +`<div class="row"><div class="grow"><h4>Contact Support</h4><p>Email ${esc(email)} with the game version, OS / platform, and anonymous player ID ${esc(id)}.</p></div><a class="btn sm" href="${esc(supportMailto())}">Contact Support</a></div>`
      +`<div class="section-t">FAQ</div>`
      +`<div class="note"><b>Saves and backup.</b> In Settings, Export copies a backup code or downloads a file. Import asks before it replaces the farm on this device. Store purchases stay on this device.</div>`
      +`<div class="note"><b>Purchases.</b> Test mode grants the item on this device and does not charge a card. Restore purchases reapplies perks and themes already bought here.</div>`
      +`<div class="note"><b>Tutorial.</b> Tutorial, at the top of Settings, replays Unko Kuli's walkthrough on this farm at any time. It does not erase the farm. Skip it whenever you want.</div>`;
  }
  PANELS.settings=()=>{
    const st=G.st;
    const tg=(k,l,on)=>`<div class="row"><div class="grow"><h4>${l}</h4></div><button class="btn sm ${on?'':'sec'}" data-a="set" data-k="${k}">${on?'On':'Off'}</button></div>`;
    const sl=(k,l,d)=>`<div class="row slrow"><div class="grow"><h4>${l}</h4><p>${d}</p></div><input type="range" min="0" max="100" step="5" data-vol="${k}" aria-label="${l} volume"><b class="slv" data-volv="${k}"></b></div>`;
    const body=(window.TestMenu?TestMenu.html():'')+(window.DevPanel?DevPanel.html():'')
      +`<div class="section-t">Tutorial</div><div class="row"><div class="grow"><h4>Tutorial</h4><p>Replay Unko Kuli's walkthrough on this farm, any time. Skip it whenever you want.</p></div><button class="btn sm" data-a="tutorial">Tutorial</button></div>`
      +`<div class="section-t">Sound</div>`+tg('mute','Mute',!!st.settings.mute)+sl('vMusic','Music','Ukulele in the garage and greenhouse. A brighter beat indoors.')+sl('vAmb','Ambience','Waves, wind, birds and night insects')+sl('vSfx','Sound effects','Harvest plucks, coins, steel-guitar level-ups')
      +`<div class="section-t">Comfort</div>`+tg('vib','Vibration (haptics)',st.settings.vib!==false)+tg('shake','Screen shake',st.settings.shake!==false)+tg('motion','Motion effects (confetti, plant sway)',st.settings.motion!==false)
      +`<div class="section-t">Performance</div>`+tg('hq','High quality graphics',st.settings.hq)+tg('autoQ','Auto quality (lower detail if the game runs slowly)',st.settings.autoQ!==false)
      +`<div class="row"><div class="grow"><h4>Daily gift</h4><p>Login streak: day ${st.streak.n||0}</p></div><button class="btn sm gem" data-a="daily" ${G.dailyReady()?'':'disabled'}>${G.dailyReady()?'Claim':'Claimed'}</button></div>`
      +`<div class="row"><div class="grow"><h4>Restore purchases</h4><p>Re-apply perks and themes bought on this account</p></div><button class="btn sm sec" data-a="restore">Restore</button></div>`
      +`<div class="section-t">Privacy and ads</div><div class="row"><div class="grow"><h4>Privacy policy</h4><p>Saves, ads, payments, and analytics</p></div><a class="btn sm sec" href="privacy.html" target="_blank" rel="noopener">Open</a></div>`
      +`<div class="row"><div class="grow"><h4>Ad preference</h4><p>${window.Ads.consent()==='personalized'?'Personalized ads are allowed.':window.Ads.consent()==='contextual'?'Only non-personalized ads.':'Choose one before ads can play.'}</p></div><div class="buy2"><button class="btn sm ${window.Ads.consent()==='personalized'?'':'sec'}" data-a="adconsent" data-v="personalized">Personalized</button><button class="btn sm ${window.Ads.consent()==='contextual'?'':'sec'}" data-a="adconsent" data-v="contextual">Non-personalized</button></div></div>`
      +helpBlock()
      +`<div class="section-t">About</div><div class="note"><b>${esc(T())}</b> is a free-to-play farming simulation for players 18+. It depicts legal, licensed cultivation as a business. Nothing in it can be bought or delivered in real life. Progress saves on this device, stays when the game updates, and your farm keeps working while you're away (72h, 96h with VIP).<br>Strain notes are original game text. Art is painted for the game.<br>Payments: ${window.Payments.mode==='test'?'TEST MODE (no real charges)':esc(window.Payments.mode)}.</div>`
      +saveBlock()
      +`<div class="row"><div class="grow"><h4>Reset farm</h4><p>Erase this device's save (store purchases stay)</p></div><button class="btn sm sec" data-a="reset">Reset</button></div>`;
    return {title:'Settings',sub:'',body};
  };
  // ---------- actions ----------
  async function act(a,d){
    const st=G.st;
    switch(a){
      case 'buy': if(G.buySeeds(d.id,+d.n)){ Sound.play('buy'); toast('+'+d.n+' '+G.strain(d.id).name+' seeds','good'); } break;
      case 'sel': st.selSeed=d.id; setTool('seed'); toast('Tap empty buckets or beds to plant '+G.strain(d.id).name); break;
      case 'plantall': { if(G.ensureSeed) G.ensureSeed(); let planted=0; st.plots.forEach(p=>{ if(p.loc===st.loc&&p.owned&&!p.strain&&G.plant(p)) planted++; }); if(!planted) pip('No seeds'); seedBag(); break; }
      case 'load': G.loadDryer(); break;
      case 'sell': { const have=(st.inv[d.stg]&&st.inv[d.stg][d.k])||0; const id=String(d.k||'').split('|')[0]; const v=G.sell(d.stg,d.k); if(v){ const s=G.strain(id); toast((s?s.name.split(' ')[0]:'Buds')+' x'+have+' +'+fmt(v),'good'); } break; }
      case 'sellgood': G.sellGood(d.k); break;
      case 'sellall': { let v=G.sellAll(); for(const k of Object.keys(st.goods)) v+=G.sellGood(k); if(v) toast('Sold +'+fmt(v),'good'); break; }
      case 'craft': if(G.startCraft(d.t,d.stg,d.k)){ Sound.play('plant'); toast(G.CRAFT[d.t].name+' started','good'); } break;
      case 'order': G.fillOrder(d.id); break;
      case 'serve': G.serveCust(d.id); break;
      case 'upg': if(G.buyUpg(d.k)){ flashBuy(d.k); Sound.play('buy'); toast(G.UPG[d.k].name+' upgraded!','good'); } break;
      case 'hire': if(G.hire(d.k)){ flashBuy(d.k); Sound.play('buy'); const who=G.WORKERS[d.k].name.split(',')[0]; toast(G.wk(d.k)===1?who+' joined the farm. One-time hire, no wages.':who+' trained. Still no wages.','good'); } break;
      case 'step': if(G.buyStep(d.k)){ flashBuy('step_'+d.k); Sound.play('buy'); } break;
      case 'land': if(G.buyLand()){ G.setRoom('facility'); close(); } break;
      case 'ghbuild': if(G.buildGH()){ close(); G.setRoom('gh'); } break;
      case 'permit': G.buyPermit(); break;
      case 'found': if(G.buyFoundation()){ Sound.play('buy'); Haptics.medium(); } break;
      case 'buildin': if(G.buildIndoor()){ close(); G.setRoom('benches'); } break;
      case 'clone': if(G.buyClone(d.n)){ Sound.play('buy'); toast(d.n+' clone added','good'); } break;
      case 'hint': G.useHint(d.id); break;
      case 'hunt': { const id=huntSel.v||($('[data-sel="H"]')||{}).value; if(id&&G.startHunt(id)){ Sound.play('plant'); toast('Pheno hunt started','good'); } break; }
      case 'keep': if(G.keepPheno(+d.i)){ Sound.play('level'); toast('Mother kept! Every plant of this strain now carries her traits.','good long'); } break;
      case 'drophunt': G.dropHunt(); break;
      case 'cut': if(G.takeCuttings(d.id)){ Sound.play('plant'); toast('Cuttings in the clone dome','good'); } break;
      case 'breed': { const A=parse(labA.v),B=parse(labB.v); if(G.startBreed(A,B)){ Sound.play('plant'); toast('Cross started!','good'); } break; }
      case 'strain': strainModal(d.id); break;
      case 'goal': if(G.claimQuest()) Sound.play('level'); break;
      case 'fest': G.claimFest(); break;
      case 'mana': if(G.buyMana(d.k)) Sound.play('gem'); break;
      case 'rebirth': { const ok=await modal(`<h3>Start a New Season?</h3><p>Your farm resets to the garage, but you keep strains, recipes, level, gems and perks, and earn <b>${G.manaGain()} Island Spirit</b> for permanent upgrades.</p>`,[{label:'Not yet',cls:'sec',v:false},{label:'New Season',cls:'gold',v:true}]);
        if(ok&&G.rebirth()){ R.rebuild(); G.setLoc('garage'); Sound.play('discover'); toast('A new season begins. Good luck!','good'); } break; }
      case 'usd': { const r=await window.Payments.purchase(d.id); if(r.ok){ Sound.play('gem'); } else if(r.error&&r.error!=='cancelled') toast(r.error,'bad'); break; }
      case 'restore': { const r=await window.Payments.restore(); toast(r.restored.length?'Restored '+r.restored.length+' item(s)':'Nothing to restore'); break; }
      case 'watchad': { const a=G.adState(); if(a.n>=G.ADS.cap){ toast('Daily ad limit reached. Come back tomorrow!'); break; } const r=await window.Ads.show(); if(r.completed){ const g=G.adReward(); if(g){ Sound.play('gem'); toast(g.bonus?`+${G.ADS.gems} gems and a +${g.bonus} gem bonus!`:`+${G.ADS.gems} gems · ${g.n%G.ADS.bonusAt}/${G.ADS.bonusAt} to the next bonus`,'gemt'); } } else toast(r.error||'Ad closed early, no reward'); break; }
      case 'rush': if(G.rush(d.k,d.i===''?null:+d.i)){ Sound.play('gem'); toast('Finished!','good'); } break;
      case 'openweb': open('book'); break;
      case 'gopass': open('shop','pass'); break;
      case 'passclaim': if(G.passClaim(+d.t,d.k)){ Sound.play('gem'); toast('Claimed tier '+d.t+' reward','gemt'); } break;
      case 'sqclaim': { const q=G.sqClaim(); if(q){ Sound.play('gem'); toast('Season quest done! +'+q.r.gems+' gems, +'+q.r.px+' pass XP','gemt'); } break; }
      case 'certify': { if(G.startCertify(d.id)) Sound.play('discover'); break; }
      case 'vaultclaim': { if(G.claimVault(+d.i)){ Sound.play('gem'); } break; }
      case 'passall': { const n=G.passClaimAll(); if(n){ Sound.play('gem'); toast('Claimed '+n+' rewards','gemt'); } break; }
      case 'cosprev': cosPrev={sl:d.sl,id:d.id}; break;
      case 'equip': if(G.equipCos(d.sl,d.id||null)){ cosPrev={sl:d.sl,id:d.id||cosPrev&&cosPrev.id||Object.keys(window.COSMETICS[d.sl].items)[0]}; toast(d.id?'Equipped!':'Unequipped','good'); } break;
      case 'gemsbuy': { const p=window.PRODUCTS[d.id]; if(G.buyWithGems(d.id)){ Sound.play('gem'); toast(p.name+'. Thank you!','gemt'); } break; }
      case 'openpack': { const k=d.k; if(k==='rare'&&st.rarePacks>0){ st.rarePacks--; showPack(G.openPack('rare')); } else if(k==='leg'&&st.legPacks>0){ st.legPacks--; showPack(G.openPack('leg')); } break; }
      case 'theme': st.theme=d.k; toast(window.THEMES[d.k].name+' theme on','good'); break;
      case 'set': st.settings[d.k]=!(st.settings[d.k]!==false); if(window.applySettings) applySettings(); break;
      case 'adconsent': window.Ads.setConsent(d.v); toast(d.v==='personalized'?'Personalized ads allowed':'Non-personalized ads only','good'); break;
      case 'daily': if(G.claimDaily()){ Sound.play('gem'); } break;
      case 'qclaim': if(G.claimQ(d.w,+d.i)){ Sound.play('coin'); } break;
      case 'achclaim': if(G.claimAch(d.id)) Sound.play('gem'); break;
      case 'achall': { let n=0; G.ACH.forEach(x=>{ if(G.claimAch(x.id)) n++; }); if(n){ Sound.play('gem'); toast(n+' achievements claimed!','gemt'); } break; }
      case 'tutorial': close(); if(window.Tutorial) Tutorial.replay(); break;
      case 'help': helpUi=!helpUi; break;
      case 'reset': { const ok=await modal('<h3>Reset your farm?</h3><p>This erases your farm on this device. Store purchases are kept.</p>',[{label:'Cancel',cls:'sec',v:false},{label:'Reset',cls:'pink',v:true}]); if(ok){ G.resetAll(); R.rebuild(); close(); if(window.Tutorial) Tutorial.onPlay(true); } break; }
      case 'export': exportPack=G.exportBackup(); saveUi='export'; break;
      case 'import': saveUi='import'; break;
      case 'saveclose': saveUi=null; break;
      case 'savecopy': { const pack=exportPack||G.exportBackup(); let copied=false;
        try{ if(navigator.clipboard&&navigator.clipboard.writeText){ await navigator.clipboard.writeText(pack.code); copied=true; } }catch(e){}
        if(!copied){ const ta=document.querySelector('textarea.savebox'); if(ta){ ta.focus(); ta.select(); try{ copied=document.execCommand('copy'); }catch(e){} } }
        toast(copied?'Backup code copied':'Select the code and copy it', copied?'good':''); break; }
      case 'savedown': { const pack=exportPack||G.exportBackup(); const blob=new Blob([pack.json],{type:pack.corrupt?'text/plain':'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=pack.file; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500); toast('Backup file downloaded','good'); break; }
      case 'saveimportgo': { const ta=document.querySelector('textarea[data-savecode="in"]'); const text=ta?ta.value:importDraft; let save;
        try{ save=G.parseBackup(text); }catch(err){ toast(err.message||'That backup is not valid','bad'); break; }
        const ok=await modal(`<h3>Replace this farm?</h3><p>The backup becomes the farm on this device: level ${Math.floor(save.level||1)}, ${esc(G.fmt(typeof save.cash==='number'?save.cash:0))}. Store purchases on this device stay.</p>`,[{label:'Cancel',cls:'sec',v:false},{label:'Replace farm',cls:'pink',v:true}]);
        if(!ok) break;
        const r=G.installBackup(save); if(!r.ok){ toast(r.error||'Could not store that backup','bad long'); break; }
        saveUi=null; importDraft=''; exportPack=null; R.rebuild(); close(); toast('Farm restored','good'); break; }
    }
    G.save(); render();
  }
  function showPack(list){ Sound.play('discover');
    toast('Seed pack: '+(list||[]).map(s=>s&&s.name).filter(Boolean).join(', '),'good long'); }
  // Story beats stay readable as a long pill. The goal chip still holds the task.
  const QUICK={plant:'Tap the seed bag, then a bucket',water:'Tap your plant to water it',harvest:'Ripe! Tap to harvest',dry:'Open Dry & Cure to dry your buds',sell:'Open Market to sell'};
  function storyLine(q){ if(!q||!G.F.storyGoals) return; if(window.Tutorial&&Tutorial.active&&Tutorial.active()) return;
    const line=QUICK[q.id]&&G.st.quest<=4?QUICK[q.id]:((window.STORY_SAY&&window.STORY_SAY[q.id])||q.t);
    toast((q.who||'Unko Kuli')+': '+line,'good long'); }
  // ---------- wiring ----------
  function init(){
    document.title=T(); $('#gTitle').textContent=T(); $('#gTag').textContent=window.GAME_CONFIG.tagline;
    if(!init._seedBag){ init._seedBag=1; G.on('plant', seedBag); G.on('seeds', seedBag); G.on('room', seedBag); }
    $$('#menu button').forEach(b=>b.onclick=()=>{ if(b.dataset.panel==='pass') open('pass'); else open(b.dataset.panel); });
    $('#upgBtn').onclick=()=>{ Sound.play('tap'); open('upgrades'); };
    $('#sheetBody').addEventListener('click',e=>{ const r=e.target.closest('[data-pickseed]'); if(!r||e.target.closest('button,a,input')) return; const id=r.dataset.pickseed; if(!(G.st.seeds[id]>0)){ toast('Buy a seed first, then tap the card to pick it'); return; } if(G.st.selSeed!==id){ G.st.selSeed=id; Sound.play('tap'); seedBag(); render(); toast('Tap empty buckets or beds to plant '+G.strain(id).name); } });
    $('#seedBag').onclick=e=>{ e.stopPropagation(); Sound.play('tap'); const pick=$('#seedPick'); if(pick) pick.classList.add('hidden'); open('seeds'); };
    $('#seedPick').onclick=e=>{ e.stopPropagation(); const b=e.target.closest('[data-pick]'); if(!b) return; $('#seedPick').classList.add('hidden'); if(b.dataset.pick==='__shop'){ open('seeds'); return; } G.st.selSeed=b.dataset.pick; setTool('seed'); seedBag(); Sound.play('tap'); toast('Tap empty buckets or beds to plant '+G.strain(b.dataset.pick).name); };
    document.addEventListener('pointerdown',e=>{ if(!e.target.closest('#seedPick,#seedBag')) $('#seedPick').classList.add('hidden'); });
    const locBtn=$('#locBtn'); if(locBtn) locBtn.onclick=e=>{ e.stopPropagation(); toggleLocPick(); };
    const locPick=$('#locPick'); if(locPick) locPick.addEventListener('click',e=>{ const b=e.target.closest('[data-room]'); if(!b) return; e.stopPropagation(); tapRoom(b.dataset.room); });
    document.addEventListener('pointerdown',e=>{ if(e.target.closest&&e.target.closest('#locSlot')) return; closeLocPick(); });
    const qa=$('#qaMain'), qm=$('#qaMenu');
    if(qa&&qm){ qa.onclick=e=>{ e.stopPropagation(); const closed=qm.classList.toggle('hidden'); qa.classList.toggle('open', !closed); qa.setAttribute('aria-expanded', closed?'false':'true'); Sound.play('tap'); };
      document.addEventListener('pointerdown',e=>{ if(e.target.closest('#qaFab')) return; qm.classList.add('hidden'); qa.classList.remove('open'); qa.setAttribute('aria-expanded','false'); }); }
    $('#shopBtn').onclick=()=>open('shop'); $('#multBadge').onclick=()=>open('quests','season'); $('#gemPill').onclick=()=>open('shop'); $('#settingsBtn').onclick=()=>open('settings');
    $('#sheetClose').onclick=close; $('#sheet').addEventListener('click',e=>{ if(e.target.id==='sheet') close(); });
    $('#sheetTabs').addEventListener('click',e=>{ const b=e.target.closest('button[data-tab]'); if(b){ tab=b.dataset.tab; render(true); Sound.play('tap'); } });
    const del=e=>{ const b=e.target.closest('[data-a]'); if(!b||b.disabled) return; act(b.dataset.a,b.dataset); };
    $('#sheetBody').addEventListener('input',e=>{ const ta=e.target.closest('textarea[data-savecode="in"]'); if(ta){ importDraft=ta.value; return; } const i=e.target.closest('input[data-vol]'); if(!i) return; G.st.settings[i.dataset.vol]=+i.value; if(window.applySettings) applySettings(); syncVol($('#sheetBody')); if(i.dataset.vol==='vSfx') Sound.play('coin'); });
    $('#sheetBody').addEventListener('click',del); $('#sheetFoot').addEventListener('click',del);
    $('#sheetBody').addEventListener('change',e=>{ const s=e.target.closest('select[data-sel]'); if(s){ (s.dataset.sel==='A'?labA:s.dataset.sel==='H'?huntSel:labB).v=s.value; render(); return; } const f=e.target.closest('input[data-savefile]'); if(!f||!f.files||!f.files[0]) return; f.files[0].text().then(t=>{ importDraft=t; saveUi='import'; render(); toast('Backup file loaded. Review it, then tap Restore.','good'); }).catch(()=>toast('Could not read that file','bad')); });
    $('#sheet').addEventListener('pointerdown',()=>lastPointer=performance.now(),true);
    const sheetBody=$('#sheetBody');
    if(sheetBody){
      sheetBody.addEventListener('scroll',()=>{ lastPointer=performance.now(); },{passive:true});
      sheetBody.addEventListener('pointermove',()=>{ lastPointer=performance.now(); },{passive:true});
    }
    $('#pop').addEventListener('click',e=>{ const b=e.target.closest('[data-pa]'); if(!b||!popPlot) return; if(b.dataset.pa==='glass'){ const p=popPlot; hidePop(true); inspectGlass(p); return; } if(b.dataset.pa==='treat'){ if(!G.treat(popPlot)) toast('Not enough cash','bad'); } else if(b.dataset.pa==='prune') G.prune(popPlot); else if(b.dataset.pa==='top'||b.dataset.pa==='lst') G.train(popPlot,b.dataset.pa); else if(b.dataset.pa==='trellis'){ if(!G.trellis(popPlot)) toast('Not enough cash','bad'); } else if(b.dataset.pa==='water') G.water(popPlot); else if(b.dataset.pa==='harvest'){ G.harvest(popPlot); hidePop(); return; } else if(!G.feed(popPlot)) toast(popPlot.food>0?'Already fed this grow':'Feed opens at halfway','bad'); renderPop(); });
    $('#goal').onclick=()=>{ const g=$('#goal'); if(!g.classList.contains('open')){ goalPeek(5000); return; } const q=G.curQuest(); if(G.st.questDone&&G.questMet&&G.questMet(q)){ if(G.claimQuest()) Sound.play('level'); } else open('quests','story'); };
    document.addEventListener('click',e=>{ const b=e.target.closest('[data-buylab]'); if(!b) return; if(!G.buyLab()) toast(G.st.inBuilt?'Not enough cash':'Build the indoor facility first','bad'); else render(true); });
    const foldQa=()=>{ const m=$('#qaMenu'), b=$('#qaMain'); if(m) m.classList.add('hidden'); if(b){ b.classList.remove('open'); b.setAttribute('aria-expanded','false'); } };
    $('#harvestAll').onclick=()=>{ let n=0; G.plotsHere().forEach(p=>{ if(p.owned&&p.strain&&p.prog>=1&&G.harvest(p)) n++; }); if(!n) toast('Nothing ripe here yet'); foldQa(); };
    $('#waterAll').onclick=()=>{ if(G.lv('water')<1){ toast('Water all needs a garden hose','bad'); open('upgrades','lines'); return; } let n=0; G.plotsHere().forEach(p=>{ if(p.owned&&p.strain&&p.prog<1&&p.water<.95){ G.water(p); n++; } }); if(!n) toast('Everything here is watered'); foldQa(); };
    $('#feedAll').onclick=()=>{ let n=0; G.plotsHere().forEach(p=>{ if(p.owned&&G.isHungry(p)&&G.feed(p,true)) n++; }); toast(n?'Fed '+n+' plants':'Nobody needs a feed yet'); foldQa(); };
    window.Payments.setConfirmUI(p=>modal(`${art(p.art)}<h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p>${oddsForProduct(p)}<div class="big-n">${window.Payments.formatUSD(p.priceUSD)}</div><div class="testbanner">TEST MODE: you will not be charged. This grants the item locally.</div>`,[{label:'Cancel',cls:'sec',v:false},{label:'Buy (test)',cls:'pink',v:true}]));
  }
  let acc=0;
  function update(dt){ hud(dt); acc+=dt; if(acc>.5){ acc=0; if(panel&&performance.now()-lastPointer>700&&!document.activeElement?.matches('select')) render(); if(popPlot) renderPop(); } }
  function artReady(){ const body=document.getElementById('sheetBody'); if(body) body._h=''; if(panel) render(); const card=document.getElementById('modalCard'); const host=card&&card.closest&&card.closest('#modal'); if(card&&host&&!host.classList.contains('hidden')) paintStrainImgs(card); }
  return {init,update,toast,brief,modal,celebrate,levelUp,loginCel,confetti,open,close,tapPlot,quick,hidePop,setTool,strainModal,bigCel,reveal,storyLine,landModal,indoorModal,inspectGlass,artReady,get tool(){return tool},get panel(){return panel},render};
})();
