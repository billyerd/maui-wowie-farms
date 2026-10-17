/* Boot, game loop, input (touch / mouse / pinch / wheel), event -> FX/sound wiring, autosave, offline catch-up,
   pause/resume (web visibility + Capacitor App state), age gate. */
(function(){
  const cv=document.getElementById('game');
  let muted=false;
  const boot=G.load();
  if(window.TEST_LV10&&boot.fresh&&!boot.corrupt){ G.applyTestStart(); boot.fresh=false; }
  const testPreset=window.TEST_LV10?null:(window.TestMenu&&TestMenu.applyPending()); if(testPreset) boot.fresh=false;
  if(window.TEST_LV10){ const tag=document.getElementById('testTag'); if(tag) tag.classList.remove('hidden'); }
  // settings defaults (older saves) + apply audio / motion preferences
  const S0=G.st.settings; if(S0.vMusic==null) S0.vMusic=S0.music===false?0:70; if(S0.vSfx==null) S0.vSfx=S0.sfx===false?0:80; if(S0.vAmb==null) S0.vAmb=60;
  if(S0.vib==null) S0.vib=true; if(S0.motion==null) S0.motion=!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches); if(S0.autoQ==null) S0.autoQ=true;
  window.applySettings=()=>{ const s=G.st.settings; const mute=!!s.mute; Sound.setVol('music',s.vMusic/100); Sound.setVol('sfx',s.vSfx/100); Sound.setVol('amb',s.vAmb/100); Sound.setMusic(!mute&&s.vMusic>0); Sound.setSfx(!mute&&s.vSfx>0); Sound.setAmb(!mute&&s.vAmb>0); document.body.classList.toggle('reduce-motion',!s.motion); };
  applySettings();
  function syncMusic(){ try{ const ph=G.dayPhase(); Sound.setScene(G.currentRoom(), ph<.22||ph>.78); }catch(e){} }
  syncMusic();
  R.init(cv); UI.init();
  Payments.onGrant((p)=>{ G.grantProduct(p); UI.toast('Thank you! '+p.name+' added','gemt'); UI.render(); });

  // ---------- events -> feedback ----------
  const fx=(f)=>(a)=>{ if(!muted) f(a); };
  const buzz=ms=>{ const v=Array.isArray(ms)?'heavy':ms>=15?'medium':'light'; Haptics.play(v); };   // tiers: light routine, medium rewards, heavy big moments
  G.on('mute',m=>muted=m);
  G.on('plant',fx(p=>{ Sound.play('plant'); p._pop=.35; buzz(6); R.burst(p,'leaf',8,30); }));
  G.on('water',fx(p=>{ Sound.play('water'); R.burst(p,'water',14,50); R.shake(p); }));
  G.on('sprinkle',fx(p=>{ if(Math.random()<.4) R.burst(p,'water',5,40); }));
  // one free feed: bursts of auto-feeds within 0.5 s merge into one "Fed" label (no cash, no stacked pile)
  let feedQ=null; const flushFeed=()=>{ const q=feedQ; feedQ=null; if(!q) return; const p=q.ps[Math.floor(q.ps.length/2)]; R.floater(p,q.ps.length>1?q.ps.length+' fed':'Fed','#c8ffb0',40); };
  G.on('feed',fx(p=>{ R.burst(p,'feed',10,30); if(!feedQ){ Sound.play('feed'); feedQ={ps:[]}; setTimeout(flushFeed,500); } feedQ.ps.push(p); }));
  G.on('harvest',fx(({p,n,s,golden,mutant,lucky,grade})=>{ Sound.play('harvest'); buzz(12); p._pop=.5; R.pluck(p,n,golden); R.burst(p,'leaf',18,50); R.burst(p,'gold',10,60);
    R.floater(p,'+'+n+' '+s.name.split(' ')[0],grade==='A'?'#ffe27a':grade==='C'?'#e8b48a':'#c8ff7a',80);
    if(mutant){ Sound.play('discover'); buzz([20,40,20]); Shake.add(.45); R.burst(p,'purple',26,90); R.floater(p,'Mutant x2.5','#e3a8ff',120); UI.toast('Mutation! '+s.name.split(' ')[0]+' x2.5','gemt'); }
    if(golden){ R.burst(p,'gem',14,70); R.coinsTo(p,'gemPill',5); UI.toast('Golden bud!','gemt'); }
    if(lucky){ R.floater(p,'Lucky seed!','#9fe8ff',140); UI.toast('Lucky seed: '+lucky.name.split(' ')[0],'good'); } }));
  let pestT=0;
  G.on('pest',fx(p=>{ R.burst(p,p.pest==='mold'?'mold':'bug',10,40); const n=performance.now(); if(n-pestT>6000&&p.loc===G.st.loc){ pestT=n; Sound.play('error'); UI.toast((p.pest==='mold'?'Mold on ':'Pests on ')+G.strain(p.strain).name.split(' ')[0],'bad','pest'); } }));
  G.on('phenoroom',()=>UI.toast('Pheno Room open','good'));
  G.on('breedlab',()=>UI.toast('Breeding room open','good'));
  G.on('huntdone',H=>{ Sound.play('gem'); UI.toast('Pheno hunt done','good'); });
  G.on('rooted',c=>UI.toast(c.n+' clones rooted','good'));
  G.on('linegen',o=>UI.toast(G.strain(o.id).name.split(' ')[0]+' line updated','good'));
  G.on('passtier',t=>UI.toast('Pass tier '+t+'!','gemt'));
  G.on('pass',k=>UI.toast(k==='plus'?'Premium+ unlocked: 10 tiers skipped!':'Grower Pass Premium unlocked!','gemt'));
  G.on('boost',k=>UI.toast(G.BOOSTS[k].name+' active for 1 hour','good'));
  G.on('piggy',n=>UI.toast('Piggy bank cracked: +'+n+' gems!','gemt'));
  G.on('cosmetic',o=>{ if(o.id) UI.toast('Equipped: '+window.COSMETICS[o.sl].items[o.id].name,'good'); });
  G.on('rushed',t=>UI.toast(t.name+' finished','good'));
  G.on('season',se=>{ UI.toast(se.name+' begins. '+se.tip,'good long'); Sound.play('tap'); });
  G.on('tip',t=>UI.toast(t,'long'));
  G.on('train',fx(({p,kind,auto})=>{ Sound.play('tap'); R.shake(p); R.leafFall(p,kind==='top'?6:2); if(!auto) R.floater(p,kind==='top'?'Topped! +15% yield':'Tied down! +8% yield','#b9ffa0',70); }));
  G.on('scoutstreak',({n,g})=>UI.toast('Inspect streak '+n+'! +'+g+' gems','gemt'));
  G.on('streaklost',n=>UI.toast('Some eggs hatched. Your inspect streak of '+n+' ended.','bad'));
  G.on('prune',fx(({p,auto})=>{ Sound.play('tap'); R.shake(p); R.leafFall(p,10); if(!auto) R.floater(p,'Pruned! +12% yield','#b9ffa0',70); }));
  G.on('trellis',fx(({p,auto})=>{ Sound.play('tap'); R.shake(p); if(!auto) R.floater(p,'Trellis up! +8% yield','#ffe08a',70); }));
  G.on('scouted',fx(p=>{ Sound.play('water'); R.burst(p,'heal',10,40); R.floater(p,(p.eggK==='mold'?'Spores':'Eggs')+' removed!','#9dffc0',70); }));
  G.on('treat',fx(({p,auto})=>{ Sound.play('water'); R.burst(p,'heal',14,50); R.shake(p); R.leafFall(p,8); R.floater(p,auto?'Treated':'Healthy!','#9dffc0',70); }));
  G.on('ripe',fx(p=>{ R.burst(p,'gold',6,50); }));
  // sale feedback: rising combo chime for quick back-to-back sales, '+$' pop and bump on the cash pill
  let combo={n:0,t:0}; function saleFx(v){ const now=performance.now(); if(now-combo.t<110) return; combo.n=now-combo.t<1800?combo.n+1:0; combo.t=now; Sound.play('cash',combo.n);
    const pill=document.getElementById('cashPill'); if(!pill) return; pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    GainLane.push('+'+G.fmt(v)+(combo.n>=2?'  x'+(combo.n+1):''),combo.n>=3); }
  G.on('sold',fx(({v})=>{ saleFx(v); R.coinsTo(null,'cashPill',Math.min(10,3+Math.floor(Math.log10(v+1)*2))); }));
  G.on('dryload',fx(n=>{ Sound.play('tap'); UI.toast(n+' buds on the drying racks'); }));
  G.on('level',fx(o=>{ Sound.play('level'); buzz([30,50,30]); Shake.add(.35); UI.levelUp(o); }));
  G.on('login',fx(o=>{ Sound.play('gem'); UI.loginCel(o); }));
  G.on('ach',fx(a=>{ Sound.play('discover'); UI.toast(a.name,'gemt','ach'); }));
  G.on('qclaim',fx(q=>{ UI.toast('Quest complete: +'+q.r.gems+' gems','gemt'); }));
  G.on('qbonus',fx(w=>{ Sound.play('discover'); UI.confetti(60); UI.toast(w==='w'?'Weekly quests done!':'Daily quests done!','gemt'); }));
  G.on('regular',fx(r=>UI.toast(r.who+' is a regular','good')));
  G.on('contest',fx(r=>{ Sound.play('level'); UI.toast('Best Bud! +10 gems','gemt'); }));
  G.on('certstart',fx(id=>UI.toast(G.strain(id).name.split(' ')[0]+' certifying','good')));
  G.on('heirloom',fx(e=>{ Sound.play('discover'); UI.toast(G.strain(e.id).name.split(' ')[0]+' is an Heirloom','gemt'); }));
  G.on('vault',fx(v=>UI.toast('Vault: '+v.name,'gemt')));
  // Festivals, timed events, tourist rush, rainbow sales, and market day do not announce themselves.
  G.on('gems',fx(({n,why})=>{ if(n>0&&why) UI.toast('+'+n+' gems · '+why,'gemt'); }));
  G.on('nocash',fx(()=>{ Sound.play('error'); UI.toast('Not enough cash','bad'); }));
  G.on('nogems',fx(()=>{ Sound.play('error'); UI.toast('Not enough gems','bad'); }));
  G.on('toast',fx(({t,k})=>UI.toast(t,k)));
  G.on('discover',fx(({s,quiet,how})=>{ if(quiet==='lvl') return; if(how==='bred'&&s.mystery) return; Sound.play('discover'); UI.toast((quiet?'Unlocked: ':'New strain: ')+s.name+'!','good'); }));
  G.on('bred',fx(({s,fresh})=>{ if(s.mystery&&fresh){ UI.reveal(s); return; } Sound.play('discover'); UI.toast((fresh?'Bred: ':'Cross: ')+s.name.split(' ')[0],'good'); }));
  G.on('dud',fx(({hint,back})=>{ Sound.play('tap'); UI.toast(hint?'No pheno +1 hint':(back?'Saved a '+back.name.split(' ')[0]+' seed':'No stable pheno'),hint?'gemt':''); }));
  G.on('hint',fx(({s})=>{ Sound.play('gem'); UI.toast('Hint: '+s.rarity+' parent','gemt'); }));
  G.on('weather',fx(w=>{ if(!G.st.land) return; if(w==='storm') UI.toast(G.lv('shutters')?'Storm incoming':'Storm! Farm plants at risk','bad'); else if(w==='rain') UI.toast('Rain: free water'); else if(w==='vog') UI.toast('Vog: growth -10%'); }));
  G.on('questclaim',fx(()=>{ UI.toast('Goal reward claimed!','good'); const q=G.curQuest(); if(q) setTimeout(()=>UI.storyLine(q),400); }));
  G.on('worker',()=>{ /* helpers stay off the map; jobs are grouped into one portrait */ });
  G.on('expand',fx(({kind,n})=>{ Sound.play('level'); buzz(15); UI.confetti(50); UI.toast(n.name+'!','good'); R.rebuild(); if(kind==='garage'&&G.st.loc==='garage') R.fit(); }));
  G.on('land',()=>{ R.rebuild(); R.unlockPan&&R.unlockPan('farm'); UI.bigCel('land'); });
  G.on('ghbuilt',()=>{ R.rebuild(); R.unlockPan&&R.unlockPan('farm'); UI.bigCel('ghbuilt'); });
  G.on('permit',()=>{ UI.bigCel('permit'); });
  G.on('indoor',()=>{ R.rebuild(); R.unlockPan&&R.unlockPan('indoor'); UI.bigCel('indoor'); });
  G.on('loc',l=>{ R.setLoc(l); });
  G.on('room',()=>{ syncMusic(); });
  G.on('rep',fx(({r})=>{ Sound.play('level'); UI.confetti(80); UI.toast('Reputation up: '+r.n+'! Market prices are higher','gemt'); }));
  G.on('mastery',fx(({s,m})=>{ Sound.play('discover'); UI.toast(s.name+' mastery! Now sells x'+m.m,'gemt'); }));
  G.on('set',fx(({d})=>{ Sound.play('level'); UI.confetti(90); UI.toast('Set complete: '+d.name+' · '+d.bonus,'gemt'); }));
  G.on('order',fx(({o,v})=>{ Sound.play('cash'); R.coinsTo(null,'cashPill',8); UI.toast(o.who+' +'+G.fmt(v),'good'); }));
  G.on('neworder',fx(o=>{ if(G.st.orders.length===1) UI.toast('New order on the board from '+o.who); }));
  G.on('customer',fx(()=>{}));
  G.on('served',fx(({c,v,tip,mood,auto})=>{ saleFx(v+(tip||0)); buzz(10); R.custReact(c.id,'served',{v,tip,mood});
    if(G.st.loc!=='farm') UI.toast(c.who+' paid: +'+G.fmt(v+(tip||0))+(tip?' (with tip)':''),'good'); }));
  G.on('custno',fx(c=>{ Sound.play('error'); R.custReact(c.id,'none'); if(G.st.loc!=='farm') UI.toast('No '+c.pref.t.toLowerCase()+' in stock for '+c.who,'bad'); else UI.toast('Dry or cure something that fits: '+c.pref.t); }));
  G.on('custleft',fx(c=>{ R.custReact(c.id,'grumpy'); if(G.st.loc==='farm') UI.toast(c.who+' got tired of waiting (-1 reputation)','bad'); }));
  G.on('gecko',fx(()=>{ Sound.play('gem'); UI.toast('A golden gecko! Tap it quickly','gemt','gecko'); }));
  G.on('geckotap',fx(({b,extra})=>{ Sound.play('discover'); buzz([10,30,10]); UI.confetti(40); UI.toast('Golden gecko: '+b.name+(extra?' '+extra:' · '+b.desc),'gemt'); }));
  G.on('crafted',fx(j=>{ Sound.play('gem'); UI.toast(G.CRAFT[j.t].name+' ×'+j.n+' ready to sell','good'); }));
  G.on('festclaim',fx(({f,s})=>{ UI.reveal(s); }));
  G.on('skip',r=>{ UI.toast('Skipped '+G.dur(r.seconds),'good'); });

  // ---------- input ----------
  // Press-and-hold (~0.45s) on the room shows the magnifier under the finger.
  // Drag while the finger stays down moves it. A lift dismisses it. A quick tap
  // still taps the plant. A swipe before the glass appears cancels the hold.
  // Pointer events own the gesture and capture the pointer. Touch events keep
  // driving it if iOS cancels the pointer (callout / scroll) without a real lift.
  const HOLD_MS=450, SWIPE_PX=24, TAP_SLOP=12;
  let hold=null, ringRAF=0;
  const WORLD='button,a,input,select,textarea,label,#sheet,#modal,#celebrate,#pop,#seedPick,#locPick,#toolbar,#hud,#seedBag,#qaFab';
  function isWorld(el){
    if(!el) return false;
    if(el===document.body||el===document.documentElement||el===document) return true;
    if(el.id==='game'||el.id==='stage'||el.id==='confetti'||el.id==='holdRing') return true;
    if(el.closest&&el.closest(WORLD)) return false;
    return true;
  }
  function hideRing(){
    if(ringRAF){ cancelAnimationFrame(ringRAF); ringRAF=0; }
    const ring=document.getElementById('holdRing'); if(ring) ring.classList.add('hidden');
  }
  function clearHold(){
    const h=hold; hold=null;
    if(!h){ hideRing(); return; }
    if(h.timer) clearTimeout(h.timer);
    if(h.stuck) clearTimeout(h.stuck);
    hideRing();
  }
  function ensureRing(){
    let el=document.getElementById('holdRing'); if(el) return el;
    el=document.createElement('div'); el.id='holdRing'; el.className='hidden'; el.setAttribute('aria-hidden','true');
    el.innerHTML='<svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true"><circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="3"/><circle class="arc" cx="24" cy="24" r="18" fill="none" stroke="#b6ffcf" stroke-width="3" stroke-linecap="round" stroke-dasharray="113.097" stroke-dashoffset="113.097" transform="rotate(-90 24 24)"/></svg>';
    document.body.appendChild(el); return el;
  }
  ensureRing();
  function paintRing(){
    ringRAF=0; if(!hold||hold.phase!=='arm') return;
    const el=ensureRing(), p=Math.max(0,Math.min(1,(performance.now()-hold.t0)/HOLD_MS));
    el.style.left=hold.x+'px'; el.style.top=hold.y+'px'; el.classList.remove('hidden');
    const arc=el.querySelector('.arc'); if(arc) arc.setAttribute('stroke-dashoffset', String(113.097*(1-p)));
    ringRAF=requestAnimationFrame(paintRing);
  }
  function capturePointer(e){
    const stage=document.getElementById('stage');
    const el=stage&&stage.setPointerCapture?stage:(e.target&&e.target.setPointerCapture?e.target:cv);
    try{ el.setPointerCapture(e.pointerId); }catch(err){}
  }
  function showLens(x,y){
    try{ UI.hidePop(); }catch(err){}
    try{ R.setLens(true,x,y); }catch(err){ console.error(err); }
  }
  function hideLens(){ try{ if(R.lens&&R.lens.on) R.setLens(false); }catch(err){} }
  function cancelArm(){
    if(!hold||hold.phase==='lens') return;
    clearHold();
  }
  function fireHold(){
    if(!hold||hold.phase!=='arm'||hold.finishing) return;
    // A captured touch pointer is often cancelled immediately on iOS. Keep waiting
    // for the touch stream. If the pointer died and no touch ever arrived, drop it.
    if(hold.pointerLost&&!hold.touchSeen){ cancelArm(); return; }
    hold.phase='lens'; hold.timer=null; hideRing();
    showLens(hold.x, hold.y);
  }
  function beginHold(x,y,src,pointerId,e){
    if(hold&&!hold.finishing){
      const same=src==='touch'||!hold.pointerSeen||hold.pointerLost||hold.pointerId==null||pointerId===hold.pointerId;
      if(!same){ if(hold.phase==='arm') cancelArm(); return; }
      hold.x=x; hold.y=y;
      if(src==='touch'){ hold.touchSeen=true; hold.touchLost=false; }
      if(src==='pointer'){ hold.pointerSeen=true; hold.pointerLost=false; hold.pointerId=pointerId; if(e) capturePointer(e); }
      return;
    }
    hold={x0:x,y0:y,x:x,y:y,t0:performance.now(),phase:'arm',pointerId:pointerId==null?null:pointerId,
      pointerSeen:src==='pointer',touchSeen:src==='touch',pointerLost:false,touchLost:false,finishing:false,timer:null,stuck:0};
    hold.timer=setTimeout(fireHold, HOLD_MS);
    if(src==='pointer'&&e) capturePointer(e);
    if(!ringRAF) paintRing();
  }
  function moveHold(x,y,src){
    if(!hold||hold.finishing) return;
    if(hold.stuck){ clearTimeout(hold.stuck); hold.stuck=0; }
    if(src==='touch'){ hold.touchSeen=true; hold.touchLost=false; }
    if(src==='pointer'){ hold.pointerSeen=true; hold.pointerLost=false; }
    hold.x=x; hold.y=y;
    if(hold.phase==='lens'){ showLens(x,y); return; }
    if(Math.hypot(x-hold.x0,y-hold.y0)>SWIPE_PX) cancelArm();
  }
  function finishHold(x,y){
    if(!hold||hold.finishing) return;
    hold.finishing=true;
    const phase=hold.phase, x0=hold.x0, y0=hold.y0, t0=hold.t0;
    clearHold();
    if(phase==='lens'){ hideLens(); return; }
    if(Math.hypot(x-x0,y-y0)<=TAP_SLOP&&performance.now()-t0<HOLD_MS+80) tapAt(x,y);
  }
  function noteLost(kind){
    if(!hold||hold.finishing) return;
    if(kind==='pointer') hold.pointerLost=true; else hold.touchLost=true;
    if(hold.phase==='lens'){
      // The finger is still down. iOS sends pointercancel when a callout or scroll
      // tries to take the gesture. Leave the glass up and let touch moves drive it.
      if(hold.pointerLost&&hold.touchLost&&!hold.stuck){
        hold.stuck=setTimeout(()=>{ if(!hold||hold.phase!=='lens'||hold.finishing) return; if(!(hold.pointerLost&&hold.touchLost)) return; hideLens(); clearHold(); }, 480);
      }
      return;
    }
    if((hold.pointerLost&&hold.touchLost)||(hold.pointerLost&&!hold.touchSeen)||(hold.touchLost&&!hold.pointerSeen)) cancelArm();
  }
  function tapAt(x,y){
    let h=null; try{ h=R.pick(x,y); }catch(err){ h=null; }
    if(!h){ UI.hidePop(); return; }
    if(h.type==='qa') UI.quick(h.a,h.p);
    else if(h.type==='plot') UI.tapPlot(h.p,x,y);
    else if(h.type==='gecko') G.geckoTap();
    else if(h.type==='serve'){ Sound.play('tap'); G.serveCust(h.id); }
    else if(h.type==='mentor'){ Sound.play('tap'); if(G.st.questDone) G.claimQuest(); else UI.storyLine(G.curQuest()); }
    else if(h.type==='expand'){ const n=G.nextStep(h.kind); if(n) UI.modal(`<h3>${n.name}</h3><p>${n.desc||('+'+n.add+' plant spaces')}</p><div class="big-n">${G.fmt(n.cost)}</div>`,[{label:'Later',cls:'sec',v:0},{label:'Buy',cls:'gold',v:1}]).then(v=>{ if(v) G.buyStep(h.kind); }); }
    else if(h.type==='ghbuild') UI.open('upgrades','gh');
    else if(h.type==='land') UI.landModal();
    else if(h.type==='bld'){ Sound.play('tap'); UI.open(h.panel); }
  }
  document.addEventListener('pointerdown',e=>{
    try{ Sound.resume(); }catch(err){}
    if(e.button!=null&&e.button!==0) return;
    if(!isWorld(e.target)) return;
    if((e.pointerType==='touch'||e.pointerType==='pen')&&e.cancelable) e.preventDefault();
    beginHold(e.clientX,e.clientY,'pointer',e.pointerId,e);
  }, true);
  document.addEventListener('pointermove',e=>{
    if(!hold) return;
    if(hold.pointerSeen&&!hold.pointerLost&&hold.pointerId!=null&&e.pointerId!==hold.pointerId) return;
    if(e.cancelable&&(e.pointerType==='touch'||e.pointerType==='pen'||hold.phase==='lens')) e.preventDefault();
    moveHold(e.clientX,e.clientY,'pointer');
  }, true);
  document.addEventListener('pointerup',e=>{
    if(!hold) return;
    if(hold.pointerId!=null&&e.pointerId!==hold.pointerId) return;
    finishHold(e.clientX,e.clientY);
  }, true);
  document.addEventListener('pointercancel',e=>{ noteLost('pointer'); }, true);
  document.addEventListener('contextmenu',e=>{ if(isWorld(e.target)) e.preventDefault(); }, true);
  document.addEventListener('selectstart',e=>{ if(isWorld(e.target)) e.preventDefault(); }, true);
  document.addEventListener('touchstart',e=>{
    if(!isWorld(e.target)) return;
    if(e.cancelable) e.preventDefault();
    if(e.touches.length>=2){ if(hold&&hold.phase==='arm') cancelArm(); return; }
    const t=e.touches[0]; if(!t) return;
    beginHold(t.clientX,t.clientY,'touch',null,null);
  }, {capture:true, passive:false});
  document.addEventListener('touchmove',e=>{
    if(!hold){ if(isWorld(e.target)&&e.cancelable) e.preventDefault(); return; }
    if(e.cancelable) e.preventDefault();
    if(e.touches.length!==1){ if(e.touches.length>=2&&hold.phase==='arm') cancelArm(); return; }
    const t=e.touches[0]; if(t) moveHold(t.clientX,t.clientY,'touch');
  }, {capture:true, passive:false});
  document.addEventListener('touchend',e=>{
    if(e.touches.length>0) return;
    if(!hold) return;
    // A healthy pointer stream reports its own lift. Touch ends the gesture only
    // when the pointer was cancelled or never existed.
    if(hold.pointerSeen&&!hold.pointerLost) return;
    const t=e.changedTouches&&e.changedTouches[0];
    finishHold(t?t.clientX:hold.x, t?t.clientY:hold.y);
  }, {capture:true, passive:false});
  document.addEventListener('touchcancel',e=>{ if(e.cancelable) e.preventDefault(); noteLost('touch'); }, {capture:true, passive:false});
  document.addEventListener('wheel',e=>{ if(!isWorld(e.target)) return; e.preventDefault(); R.zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0015)); }, {passive:false});
  document.addEventListener('gesturestart',e=>{ if(isWorld(e.target)) e.preventDefault(); });
  window.addEventListener('keydown',e=>{ if(e.target.matches('input,select,textarea')) return; const k=e.key.toLowerCase();
    if(k==='1') UI.setTool('hand'); if(k==='2') UI.setTool('seed'); if(k==='3') UI.setTool('water'); if(k==='4') UI.setTool('feed');
    if(k==='g') G.setLoc('garage'); if(k==='f'&&G.locOpen('farm')) G.setLoc('farm'); if(k==='i'&&G.locOpen('indoor')) G.setLoc('indoor');
    if(k==='h') document.getElementById('harvestAll').click(); if(k==='escape') UI.close(); });
  let rz; window.addEventListener('resize',()=>{ clearTimeout(rz); rz=setTimeout(()=>{ R.resize(); R.fit(); },120); });

  // ---------- loop ----------
  let last=performance.now(), saveT=0, lbT=25, paused=false, pausedAt=0, musT=1;
  // adaptive quality for low-end phones: if frames stay slow, drop render resolution, then the extra effects (Settings > Auto quality)
  let pf={t:0,n:0,slow:0,step:0};
  function perf(dt){ if(!G.st.settings.autoQ||pf.step>=2) return; pf.t+=dt; pf.n++; if(pf.t<4) return; const fps=pf.n/pf.t; pf.t=0; pf.n=0;
    if(fps<40){ if(++pf.slow>=2){ pf.slow=0; pf.step++; R.setDprCap(2); if(pf.step>=2) G.st.settings.hq=false; R.resize(); console.info('[perf] quality step',pf.step,'fps',fps.toFixed(1)); } } else pf.slow=0; }
  const sheetEl=document.getElementById('sheet'), modalEl=document.getElementById('modal'); let covN=0, covAcc=0, hudFit=false;
  function loop(now){
    let dt=(now-last)/1000; last=now; if(dt>.25) dt=.25; if(window.__paused){ requestAnimationFrame(loop); return; }   // econ-sim: deterministic, sim drives time
    // while a full-screen sheet or modal covers the world, redraw the canvas at ~1/3 rate (the blurred backdrop is costly on big screens)
    const cov=sheetEl&&(!sheetEl.classList.contains('hidden')||!modalEl.classList.contains('hidden')); covAcc+=dt;
    if(!paused){ G.tick(dt); if(!cov||(++covN%3===0)){ try{ R.frame(Math.min(.25,covAcc)); }catch(err){ if(!loop._fr){ loop._fr=1; console.error(err); } } covAcc=0; } else if(!cov) covAcc=0; try{ UI.update(dt); }catch(err){ if(!loop._hud){ loop._hud=1; console.error(err); } } if(!hudFit){ hudFit=true; R.fit(); if(!cov) R.frame(0); } saveT+=dt; lbT+=dt; perf(dt); musT+=dt; if(musT>1){ musT=0; syncMusic(); }
      if(saveT>5){ saveT=0; G.save(); }
      if(lbT>30){ lbT=0; const st=G.st, L=window.Leaderboard; if(L&&st.level>=G.GATE.leaderboard){ L.submit('season',st.runEarn); L.submit('lifetime',st.lifetime); L.submit('strains',Object.keys(st.discovered).length); L.submit('level',st.level); L.submit('phenos',st.stats.phenos||0); } } }
    requestAnimationFrame(loop);
  }
  // pause/resume: browser tab hidden, or app backgrounded (Capacitor App plugin if present)
  function pause(){ if(paused) return; paused=true; pausedAt=Date.now(); G.save(); Sound.setPaused(true); }
  function resume(){ if(!paused) return; paused=false; const el=(Date.now()-pausedAt)/1000; last=performance.now(); Sound.setPaused(false);
    if(el>30){ const cap=G.OFFLINE_CAP(); const r=G.simulate(Math.min(el,cap),true); showAway(r,el,cap); } }
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) pause(); else resume(); });
  window.addEventListener('pagehide',()=>{ try{ G.save(); }catch(e){} });
  window.addEventListener('beforeunload',()=>{ try{ G.save(); }catch(e){} });
  try{ const A=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App; if(A){ A.addListener('pause',pause); A.addListener('resume',resume); A.addListener('appStateChange',s=>{ s.isActive?resume():pause(); }); } }catch(e){}
  function showAway(r,el,cap){
    if(!r||(r.harvests===0&&r.sold===0&&Math.abs(r.cash)<1&&el<600)) return;
    const li=[]; if(r.days>0) li.push(`<b>${r.days}</b> game day${r.days===1?'':'s'} went by (1 real hour = 1 game day). It's the <b>${r.season}</b> now.`);
    if(r.seasons&&r.seasons.length) li.push('Season changes: '+r.seasons.join(' → ')+'.'); if(r.markets) li.push(`${r.markets} market day${r.markets===1?'':'s'} came and went.`);
    li.push(`${r.harvests} harvests · ${r.sold} buds sold.`);
    if(r.ripe) li.push(`${r.ripe} plants are ripe and waiting.`); if(r.pests) li.push(`${r.pests} plants need treatment for pests or mold.`); if(r.thirsty) li.push(`${r.thirsty} plants are out of water.`);
    if(r.huntDone) li.push('Your pheno hunt finished. Open Breed to pick a mother.');
    UI.modal(`${portraitImg('Unko Kuli','dport')}<h3>While you were away</h3><p>You were gone ${G.dur(el)}${el>cap?' (catch-up capped at '+G.dur(cap)+')':''}.</p><div class="big-n">${r.cash>=0?'+':''}${G.fmt(r.cash)}</div><ul class="away">${li.map(t=>`<li>${t}</li>`).join('')}</ul>${r.cash>0?'<p style="font-size:13px;color:#cfe">Watch a short ad to double what the farm earned. It\'s optional.</p>':''}`,[...(r.cash>0?[{label:'Watch ad: 2x',cls:'pink',v:'ad'}]:[]),{label:'Back to the farm',cls:'gold'}]).then(async v=>{ if(v!=='ad') return; const a=await window.Ads.show(); if(a&&a.completed){ G.addCash(r.cash,'away'); Sound.play('cash',5); Haptics.success(); UI.toast('Doubled! +'+G.fmt(r.cash),'good'); } else UI.toast('No reward, the ad was closed early.'); });
  }

  // ---------- age gate, ad consent, splash ----------
  const AGE_KEY='mwfarms_age_ok';
  const ag=document.getElementById('ageGate'), cg=document.getElementById('consentGate'), pb=document.getElementById('playBtn');
  function splashStep(){
    const aged=Store.get(AGE_KEY)==='1';
    const cons=!!(window.Ads&&Ads.consent());
    ag.classList.toggle('hidden', aged);
    cg.classList.toggle('hidden', !aged||cons);
    pb.classList.toggle('hidden', !aged||!cons);
  }
  splashStep();
  document.getElementById('ageYes').onclick=()=>{ Store.set(AGE_KEY,'1'); splashStep(); };
  document.getElementById('ageNo').onclick=()=>{ ag.innerHTML='<p>Sorry, this game is only for players 18 and older. Thanks for stopping by!</p>'; };
  document.getElementById('consentYes').onclick=()=>{ Ads.setConsent('personalized'); splashStep(); };
  document.getElementById('consentNo').onclick=()=>{ Ads.setConsent('contextual'); splashStep(); };
  pb.onclick=async()=>{
    Sound.resume(); document.getElementById('splash').classList.add('gone'); setTimeout(()=>document.getElementById('splash').remove(),600);
    const ret=await Payments.handleReturn(); if(ret&&!ret.ok) UI.toast('Purchase not completed: '+ret.error,'bad');
    if(window.Tutorial) Tutorial.onPlay(!!boot.fresh);
    else if(boot.fresh) UI.modal(`<div class="dlg">${portraitImg('Unko Kuli','dport')}<div><b>Unko Kuli</b><p>Hello, and welcome to <b>${window.GAME_CONFIG.title}</b>. This was your Grandpa's garage. Now it's yours. Follow my hand 👆</p></div></div>`,[{label:'Let\'s grow',cls:'gold'}]).then(()=>UI.storyLine(G.curQuest()));
    if(G.st.econMigrated){ delete G.st.econMigrated; UI.modal(`<h3>Real-world prices</h3><p>Prices now follow real Hawaii costs: one bud is an eighth (3.5 g), gear and land cost what they do on Kauai, and time runs on the real clock (1 real hour = 1 game day). You kept everything you built; your cash was converted to the new prices.</p>`,[{label:'Got it!',cls:'gold'}]); }
    if(boot.corrupt) UI.modal(`<h3>Save needs a backup</h3><p>The farm stored on this device could not be read, so it was left in place. Open Settings to export it, or import a backup you already have.</p>`,[{label:'Got it!',cls:'gold'}]);
    if(boot.kept) UI.toast('Farm kept. Your plants, cash, and unlocks are still on this device.','good long');
    else if(boot.off) showAway(boot.off,boot.off.away,boot.off.cap);
    if(G.dailyReady()&&!boot.fresh&&!window.TEST_MODE&&!window.TEST_LV10){   // test mode: gift only via Settings > Test so QC can capture clean screens
 window.__streakSaved=G.streakSaved(); G.claimDaily(); }
  };
  requestAnimationFrame(loop);
  window.__game={G,R,UI};
})();
