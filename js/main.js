/* Boot, game loop, input (touch / mouse / pinch / wheel), event -> FX/sound wiring, autosave, offline catch-up,
   pause/resume (web visibility + Capacitor App state), age gate. */
(function(){
  const cv=document.getElementById('game');
  let muted=false;
  const boot=G.load(); const testPreset=window.TestMenu&&TestMenu.applyPending(); if(testPreset) boot.fresh=false;
  // settings defaults (older saves) + apply audio / motion preferences
  const S0=G.st.settings; if(S0.vMusic==null) S0.vMusic=S0.music===false?0:70; if(S0.vSfx==null) S0.vSfx=S0.sfx===false?0:80; if(S0.vAmb==null) S0.vAmb=60;
  if(S0.vib==null) S0.vib=true; if(S0.motion==null) S0.motion=!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches); if(S0.autoQ==null) S0.autoQ=true;
  window.applySettings=()=>{ const s=G.st.settings; Sound.setVol('music',s.vMusic/100); Sound.setVol('sfx',s.vSfx/100); Sound.setVol('amb',s.vAmb/100); Sound.setMusic(s.vMusic>0); Sound.setSfx(s.vSfx>0); document.body.classList.toggle('reduce-motion',!s.motion); };
  applySettings();
  R.init(cv); UI.init();
  Payments.onGrant((p)=>{ G.grantProduct(p); UI.toast('Thank you! '+p.name+' added','gemt'); UI.render(); });

  // ---------- events -> feedback ----------
  const fx=(f)=>(a)=>{ if(!muted) f(a); };
  const buzz=ms=>{ const v=Array.isArray(ms)?'heavy':ms>=15?'medium':'light'; Haptics.play(v); };   // tiers: light routine, medium rewards, heavy big moments
  G.on('mute',m=>muted=m);
  G.on('plant',fx(p=>{ Sound.play('plant'); p._pop=.35; buzz(6); R.burst(p,'leaf',8,30); }));
  G.on('water',fx(p=>{ Sound.play('water'); R.burst(p,'water',14,50); R.shake(p); }));
  G.on('sprinkle',fx(p=>{ if(Math.random()<.4) R.burst(p,'water',5,40); }));
  // feed costs: bursts of auto-feeds within 0.5 s merge into one "-$X · N fed" label over the group (no stacked label pile)
  let feedQ=null; const flushFeed=()=>{ const q=feedQ; feedQ=null; if(!q) return; const p=q.ps[Math.floor(q.ps.length/2)]; R.floater(p,'-'+G.fmt(q.sum)+(q.ps.length>1?' · '+q.ps.length+' fed':''),'#ffb59a',40); };
  G.on('feed',fx(p=>{ R.burst(p,'feed',10,30); if(!feedQ){ Sound.play('feed'); feedQ={sum:0,ps:[]}; setTimeout(flushFeed,500); } feedQ.sum+=G.feedCost(p); feedQ.ps.push(p); }));
  G.on('harvest',fx(({p,n,s,golden,mutant,lucky,grade})=>{ Sound.play('harvest'); buzz(12); p._pop=.5; R.pluck(p,n,golden); R.burst(p,'leaf',18,50); R.burst(p,'gold',10,60);
    R.floater(p,'+'+n+' '+s.name.split(' ')[0]+' · Grade '+grade,grade==='A'?'#ffe27a':grade==='C'?'#e8b48a':'#c8ff7a',80);
    if(mutant){ Sound.play('discover'); buzz([20,40,20]); Shake.add(.45); R.burst(p,'purple',26,90); R.floater(p,'MUTANT PHENO! x2.5','#e3a8ff',120); UI.toast('Mutation! A rare '+s.name+' phenotype (sells x2.5)','gemt'); }
    if(golden){ R.burst(p,'gem',14,70); R.coinsTo(p,'gemPill',5); UI.toast('Golden bud! Bonus gems','gemt'); }
    if(lucky){ R.floater(p,'Lucky seed!','#9fe8ff',140); UI.toast('Lucky seed drop: '+lucky.name+' ('+lucky.rarity+')','good'); } }));
  let pestT=0;
  G.on('pest',fx(p=>{ R.burst(p,p.pest==='mold'?'mold':'bug',10,40); const n=performance.now(); if(n-pestT>6000&&p.loc===G.st.loc){ pestT=n; Sound.play('error'); UI.toast((p.pest==='mold'?'Mold spotted':'Pests spotted')+' on '+G.strain(p.strain).name+'! Tap it to treat','bad','pest'); } }));
  G.on('phenoroom',()=>UI.toast("Grandpa's garage is now your Pheno Room: double mutation odds here, and crossbreeding happens here. The farm is your main grow now.",'good long'));
  G.on('breedlab',()=>UI.toast('Indoor Breeding Pheno Room open! Crosses are 60% faster. The garage is now storage and a bonus grow.','good long'));
  G.on('huntdone',H=>{ Sound.play('gem'); UI.toast('Pheno hunt done: '+H.n+' '+G.strain(H.id).name+' phenos to compare. Open Breed to pick a mother.','good long'); });
  G.on('rooted',c=>UI.toast(c.n+' '+G.strain(c.id).name+' clones rooted. They plant 10% grown.','good'));
  G.on('linegen',o=>UI.toast(G.strain(o.id).name+' line is now '+G.lineName(o.id),'good'));
  G.on('passtier',t=>UI.toast('Grower Pass tier '+t+' reached! Rewards ready in the Shop','gemt'));
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
  G.on('qbonus',fx(w=>{ Sound.play('discover'); UI.confetti(60); UI.toast(w==='w'?'All weekly quests done! Legendary Seed Pack added':'All daily quests done! Rare Seed Pack added','gemt'); }));
  G.on('regular',fx(r=>UI.toast(r.who+(r.tier===1?' is now a regular at your stand (+5% pay, more patience)':' is a loyal regular now (tier '+r.tier+')'),'good')));
  G.on('contest',fx(r=>{ Sound.play('level'); UI.toast('Best Bud of the Week! '+r.who+' judged your grade-A cured bud the best on the island: +10 gems, +10 reputation','gemt'); }));
  G.on('marketday',fx(()=>{ Sound.play('discover'); UI.toast('Market day! Customers come twice as often and pay 10% more at the farm stand','gemt'); }));
  G.on('certstart',fx(id=>UI.toast(G.strain(id).name+' is in the seed bank for certification (24 h)','good')));
  G.on('heirloom',fx(e=>{ Sound.play('discover'); UI.toast('🏅 '+G.strain(e.id).name+' is now a certified Heirloom! ('+e.n+' in the Seed Vault)','gemt'); }));
  G.on('vault',fx(v=>UI.toast('Seed Vault milestone: '+v.name+'. Claim it in the Pheno Room','gemt')));
  G.on('event',fx(e=>{ Sound.play('discover'); UI.toast(e.name+' started! '+e.desc,'gemt'); }));
  G.on('gems',fx(({n,why})=>{ if(n>0&&why) UI.toast('+'+n+' gems · '+why,'gemt'); }));
  G.on('nocash',fx(()=>{ Sound.play('error'); UI.toast('Not enough cash','bad'); }));
  G.on('nogems',fx(()=>{ Sound.play('error'); UI.toast('Not enough gems. Earn more by leveling up!','bad'); }));
  G.on('noseed',fx(()=>{ UI.toast('Out of those seeds. Visit the seed shop','bad'); }));
  G.on('toast',fx(({t,k})=>UI.toast(t,k)));
  G.on('discover',fx(({s,quiet,how})=>{ if(quiet==='lvl') return; if(how==='bred'&&s.mystery) return; Sound.play('discover'); UI.toast((quiet?'Unlocked: ':'New strain: ')+s.name+'!','good'); }));
  G.on('bred',fx(({s,fresh})=>{ if(s.mystery&&fresh){ UI.reveal(s); return; } Sound.play('discover'); UI.modal(`<img src="${R.closeup(s,160)}" style="width:150px;height:150px;border-radius:22px"><h3>${fresh?'New strain bred!':'Cross complete'}</h3><p><b>${s.name}</b> (${s.rarity})<br>${s.parents.join(' × ')}</p><p>+3 seeds added to your seed bag.</p>`,[{label:'Thanks!',cls:'gold'}]); }));
  G.on('dud',fx(({hint,back})=>{ Sound.play('tap'); UI.toast('No stable pheno from that cross.'+(back?' You saved a '+back.name+' seed.':'')+(hint?' +1 hint token for your persistence!':''),hint?'gemt':''); }));
  G.on('hint',fx(({s})=>{ Sound.play('gem'); UI.toast('Hint used: a parent of a '+s.rarity+' mystery revealed','gemt'); }));
  G.on('hot',fx(s=>UI.toast('Tourist rush! '+s.name+' sells 2x','good')));
  G.on('weather',fx(w=>{ if(!G.st.land) return; if(w==='storm') UI.toast('Trade-wind storm rolling in!'+(G.lv('shutters')?'':' Ripe farm plants may get hurt'),'bad'); else if(w==='rain') UI.toast('Rain showers: free water for the terraces'); else if(w==='vog') UI.toast('Vog haze from the volcano: outdoor growth -10%, odd phenotypes more likely'); }));
  G.on('rainbow',fx(()=>UI.toast('Rainbow! +10% sale prices','good')));
  G.on('questclaim',fx(()=>{ UI.toast('Goal reward claimed!','good'); const q=G.curQuest(); if(q) setTimeout(()=>UI.storyLine(q),400); }));
  G.on('worker',fx(({w,p})=>{ if(p) R.sendWorker(w,p); }));
  G.on('upkeepwarn',fx(l=>{ UI.toast(G.LOC_NAME[l]+': not enough cash for upkeep. Plants grow slower until you can pay','bad','upk'); }));
  G.on('expand',fx(({kind,n})=>{ Sound.play('level'); buzz(15); UI.confetti(50); UI.toast(n.name+'!','good'); R.rebuild(); }));
  G.on('land',()=>{ R.rebuild(); R.unlockPan&&R.unlockPan('farm'); UI.bigCel('land'); });
  G.on('ghbuilt',()=>{ R.rebuild(); R.unlockPan&&R.unlockPan('farm'); UI.bigCel('ghbuilt'); });
  G.on('permit',()=>{ UI.bigCel('permit'); });
  G.on('indoor',()=>{ R.rebuild(); R.unlockPan&&R.unlockPan('indoor'); UI.bigCel('indoor'); });
  G.on('loc',l=>{ R.setLoc(l); });
  G.on('rep',fx(({r})=>{ Sound.play('level'); UI.confetti(80); UI.toast('Reputation up: '+r.n+'! Better buyers are calling','gemt'); }));
  G.on('mastery',fx(({s,m})=>{ Sound.play('discover'); UI.toast(s.name+' mastery! Now sells x'+m.m,'gemt'); }));
  G.on('set',fx(({d})=>{ Sound.play('level'); UI.confetti(90); UI.toast('Set complete: '+d.name+' · '+d.bonus,'gemt'); }));
  G.on('order',fx(({o,v})=>{ Sound.play('cash'); R.coinsTo(null,'cashPill',8); UI.toast('Order filled for '+o.who+': +'+G.fmt(v),'good'); }));
  G.on('neworder',fx(o=>{ if(G.st.orders.length===1) UI.toast('New order on the board from '+o.who); }));
  G.on('customer',fx(c=>{ UI.toast(c.who+' is at the farm stand: "'+c.pref.t+'"'); }));
  G.on('served',fx(({c,v,tip,mood,auto})=>{ saleFx(v+(tip||0)); buzz(10); R.custReact(c.id,'served',{v,tip,mood});
    if(G.st.loc!=='farm') UI.toast((auto?'Malia served ':'')+c.who+(auto?'':' paid')+': +'+G.fmt(v+(tip||0))+(tip?' (with tip)':''),'good'); }));
  G.on('custno',fx(c=>{ Sound.play('error'); R.custReact(c.id,'none'); if(G.st.loc!=='farm') UI.toast('No '+c.pref.t.toLowerCase()+' in stock for '+c.who,'bad'); else UI.toast('Dry or cure something that fits: '+c.pref.t); }));
  G.on('custleft',fx(c=>{ R.custReact(c.id,'grumpy'); if(G.st.loc==='farm') UI.toast(c.who+' got tired of waiting (-1 reputation)','bad'); }));
  G.on('gecko',fx(()=>{ Sound.play('gem'); UI.toast('A golden gecko! Tap it quickly','gemt','gecko'); }));
  G.on('geckotap',fx(({b,extra})=>{ Sound.play('discover'); buzz([10,30,10]); UI.confetti(40); UI.toast('Golden gecko: '+b.name+(extra?' '+extra:' · '+b.desc),'gemt'); }));
  G.on('crafted',fx(j=>{ Sound.play('gem'); UI.toast(G.CRAFT[j.t].name+' ×'+j.n+' ready to sell','good'); }));
  G.on('festclaim',fx(({f,s})=>{ UI.reveal(s); }));
  G.on('skip',r=>{ UI.modal(`<h3>Time skipped</h3><p>Your farm worked ${G.dur(r.seconds)}.</p><div class="big-n">${r.cash>=0?'+':''}${G.fmt(r.cash)}</div><p>${r.harvests} harvests · ${r.sold} buds sold${r.upkeep>0?' · '+G.fmt(r.upkeep)+' upkeep':''}</p>`,[{label:'Thanks!',cls:'gold'}]); });

  // ---------- input ----------
  const ptrs=new Map(); let downAt=null, moved=0, pinchD=0;
  cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(ptrs.size===1){ downAt={x:e.clientX,y:e.clientY}; moved=0; } else { downAt=null; const [a,b]=[...ptrs.values()]; pinchD=Math.hypot(a.x-b.x,a.y-b.y); } Sound.resume(); });
  cv.addEventListener('pointermove',e=>{ if(R.lens.on&&(e.pointerType==='mouse'||ptrs.size===1)) R.setLens(true,e.clientX,e.clientY-(e.pointerType==='mouse'?0:60)); const p=ptrs.get(e.pointerId); if(!p) return; const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY;
    if(ptrs.size===1){ moved+=Math.abs(dx)+Math.abs(dy); if(moved>8){ if(!R.lens.on) R.pan(dx,dy); UI.hidePop(); } }
    else if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); if(pinchD>0) R.zoomAt((a.x+b.x)/2,(a.y+b.y)/2,d/pinchD); pinchD=d; } });
  const up=e=>{ const had=ptrs.has(e.pointerId); ptrs.delete(e.pointerId); if(!had) return;
    if(R.lens.on&&ptrs.size===0&&(moved<=8||e.pointerType!=='mouse')){ const lx=R.lens.x, ly=R.lens.y; let h=R.pick(lx,ly); let p=h&&h.type==='plot'&&h.p.eggs>0?h.p:null;
      if(!p){ const c=[]; for(const d of [[0,0],[-18,0],[18,0],[0,-18],[0,18],[-28,-14],[28,-14],[-28,14],[28,14]]){ const k=R.pick(lx+d[0],ly+d[1]); if(k&&k.type==='plot'&&k.p.eggs>0) c.push(k.p); } p=c[0]; }
      if(p) G.scout(p); else if(moved<=8) UI.toast('Nothing hiding here. Keep looking.');
      if(ptrs.size<2) pinchD=0; downAt=null; return; }
    if(downAt&&moved<=8&&ptrs.size===0){ const h=R.pick(e.clientX,e.clientY);
      if(!h) UI.hidePop();
      else if(h.type==='qa') UI.quick(h.a,h.p);
      else if(h.type==='plot') UI.tapPlot(h.p,e.clientX,e.clientY);
      else if(h.type==='gecko') G.geckoTap();
      else if(h.type==='serve'){ Sound.play('tap'); G.serveCust(h.id); }
      else if(h.type==='mentor'){ Sound.play('tap'); if(G.st.questDone) G.claimQuest(); else UI.storyLine(G.curQuest()); }
      else if(h.type==='expand'){ const n=G.nextStep(h.kind); if(n) UI.modal(`<h3>${n.name}</h3><p>${n.desc||('+'+n.add+' plant spaces')}</p><div class="big-n">${G.fmt(n.cost)}</div>`,[{label:'Later',cls:'sec',v:0},{label:'Buy',cls:'gold',v:1}]).then(v=>{ if(v) G.buyStep(h.kind); }); }
      else if(h.type==='ghbuild') UI.open('upgrades','farm');
      else if(h.type==='bld'){ Sound.play('tap'); UI.open(h.panel); }
    }
    if(ptrs.size<2) pinchD=0; downAt=ptrs.size===0?null:downAt; };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{ e.preventDefault(); R.zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0015)); },{passive:false});
  document.addEventListener('gesturestart',e=>e.preventDefault());
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
    if(fps<40){ if(++pf.slow>=2){ pf.slow=0; pf.step++; if(pf.step===1) R.setDprCap(1.25); else { R.setDprCap(1); G.st.settings.hq=false; } R.resize(); console.info('[perf] quality step',pf.step,'fps',fps.toFixed(1)); } } else pf.slow=0; }
  const sheetEl=document.getElementById('sheet'), modalEl=document.getElementById('modal'); let covN=0, covAcc=0;
  function loop(now){
    let dt=(now-last)/1000; last=now; if(dt>.25) dt=.25; if(window.__paused){ requestAnimationFrame(loop); return; }   // econ-sim: deterministic, sim drives time
    // while a full-screen sheet or modal covers the world, redraw the canvas at ~1/3 rate (the blurred backdrop is costly on big screens)
    const cov=sheetEl&&(!sheetEl.classList.contains('hidden')||!modalEl.classList.contains('hidden')); covAcc+=dt;
    if(!paused){ G.tick(dt); if(!cov||(++covN%3===0)){ R.frame(Math.min(.25,covAcc)); covAcc=0; } else if(!cov) covAcc=0; UI.update(dt); saveT+=dt; lbT+=dt; perf(dt); musT+=dt; if(musT>1){ musT=0; const ph=G.dayPhase(); Sound.setScene(G.st.loc,ph<.22||ph>.78); }
      if(saveT>5){ saveT=0; G.save(); }
      if(lbT>30){ lbT=0; const st=G.st, L=window.Leaderboard; if(L&&st.level>=G.GATE.leaderboard){ L.submit('season',st.runEarn); L.submit('lifetime',st.lifetime); L.submit('strains',Object.keys(st.discovered).length); L.submit('level',st.level); L.submit('phenos',st.stats.phenos||0); } } }
    requestAnimationFrame(loop);
  }
  // pause/resume: browser tab hidden, or app backgrounded (Capacitor App plugin if present)
  function pause(){ if(paused) return; paused=true; pausedAt=Date.now(); G.save(); Sound.setPaused(true); }
  function resume(){ if(!paused) return; paused=false; const el=(Date.now()-pausedAt)/1000; last=performance.now(); Sound.setPaused(false);
    if(el>30){ const cap=G.OFFLINE_CAP(); const r=G.simulate(Math.min(el,cap),true); showAway(r,el,cap); } }
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) pause(); else resume(); });
  window.addEventListener('pagehide',()=>G.save());
  try{ const A=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App; if(A){ A.addListener('pause',pause); A.addListener('resume',resume); A.addListener('appStateChange',s=>{ s.isActive?resume():pause(); }); } }catch(e){}
  function showAway(r,el,cap){
    if(!r||(r.harvests===0&&r.sold===0&&Math.abs(r.cash)<1&&el<600)) return;
    const li=[]; if(r.days>0) li.push(`<b>${r.days}</b> game day${r.days===1?'':'s'} went by (1 real hour = 1 game day). It's the <b>${r.season}</b> now.`);
    if(r.seasons&&r.seasons.length) li.push('Season changes: '+r.seasons.join(' → ')+'.'); if(r.markets) li.push(`${r.markets} market day${r.markets===1?'':'s'} came and went.`);
    li.push(`${r.harvests} harvests by your crew · ${r.sold} buds sold${r.upkeep>0?' · '+G.fmt(r.upkeep)+' upkeep paid':''}.`);
    if(r.ripe) li.push(`${r.ripe} plants are ripe and waiting.`); if(r.pests) li.push(`${r.pests} plants need treatment for pests or mold.`); if(r.thirsty) li.push(`${r.thirsty} plants are out of water.`);
    if(r.huntDone) li.push('Your pheno hunt finished. Open Breed to pick a mother.');
    UI.modal(`${portraitImg('Unko Kuli','dport')}<h3>While you were away</h3><p>You were gone ${G.dur(el)}${el>cap?' (catch-up capped at '+G.dur(cap)+')':''}.</p><div class="big-n">${r.cash>=0?'+':''}${G.fmt(r.cash)}</div><ul class="away">${li.map(t=>`<li>${t}</li>`).join('')}</ul>${r.cash>0?'<p style="font-size:13px;color:#cfe">Watch a short ad to double what your crew earned. It\'s optional.</p>':''}`,[...(r.cash>0?[{label:'Watch ad: 2x',cls:'pink',v:'ad'}]:[]),{label:'Back to the farm',cls:'gold'}]).then(async v=>{ if(v!=='ad') return; const a=await window.Ads.show(); if(a&&a.completed){ G.addCash(r.cash,'away'); Sound.play('cash',5); Haptics.success(); UI.toast('Doubled! +'+G.fmt(r.cash),'good'); } else UI.toast('No reward, the ad was closed early.'); });
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
    if(boot.fresh) UI.modal(`<div class="dlg">${portraitImg('Unko Kuli','dport')}<div><b>Unko Kuli</b><p>Hello, and welcome to <b>${window.GAME_CONFIG.title}</b>. This was your Grandpa's garage. Now it's yours. Follow my hand 👆</p></div></div>`,[{label:'Let\'s grow',cls:'gold'}]).then(()=>UI.storyLine(G.curQuest()));
    if(G.st.econMigrated){ delete G.st.econMigrated; UI.modal(`<h3>Real-world prices</h3><p>Prices now follow real Hawaii costs: one bud is an eighth (3.5 g), gear and land cost what they do on Kauai, and time runs on the real clock (1 real hour = 1 game day). You kept everything you built; your cash was converted to the new prices.</p>`,[{label:'Got it!',cls:'gold'}]); }
    if(boot.migrated) UI.modal(`<h3>Big update!</h3><p>Your journey now starts in the garage and grows to land, a greenhouse and an indoor facility. You kept your level, gems and perks, plus a starter bonus and 3 hint tokens.</p>`,[{label:'Got it!',cls:'gold'}]);
    else if(boot.off) showAway(boot.off,boot.off.away,boot.off.cap);
    if(G.dailyReady()&&!boot.fresh&&!window.TEST_MODE){   // test mode: gift only via Settings > Test so QC can capture clean screens
 window.__streakSaved=G.streakSaved(); G.claimDaily(); }
  };
  requestAnimationFrame(loop);
  window.__game={G,R,UI};
})();
