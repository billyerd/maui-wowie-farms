/* DOM UI: HUD, location tabs, toolbar, panels (bottom sheet / side sheet), shop, popovers, modals, toasts.
   Every control is tap-first (no hover-only UI). Features unlock gradually by level (G.GATE) and story. */
window.UI = (function(){
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const T=()=>window.GAME_CONFIG.title;
  let tool='hand', panel=null, tab=null, lastPointer=0, popPlot=null, saveUi=null, importDraft='', exportPack=null, helpUi=false;
  const labA={v:null}, labB={v:null}, huntSel={v:null};
  const fmt=n=>G.fmt(n), sec=s=>G.dur(s);
  const tag=s=>`<span class="tag t-${s.rarity}">${s.rarity}</span>${s.island?'<span class="tag" style="background:#0f8f8a;color:#eafffd">Island</span>':''}${s.hemp?'<span class="tag" style="background:#6a8a3a;color:#f2ffe0">CBD</span>':''}${G.EVENT_ONLY[s.id]==='premium'?'<span class="tag" style="background:#ffd35a;color:#3a2500">Exclusive</span>':G.EVENT_ONLY[s.id]?'<span class="tag" style="background:#c05ad0;color:#fff">Festival</span>':''}`;
  const thc=s=>s.thc==null?'THC n/a':'THC '+s.thc+'%';
  const ico=(n,cls='')=>`<span class="ico ico-${n} ${cls}"></span>`;
  const gradeBadge=q=>`<span class="grade g${q}">${q}</span>`;
  const bar=(p,cls)=>`<div class="bar ${cls||''}"><i style="width:${Math.max(0,Math.min(1,p))*100}%"></i></div>`;
  const lvlLock=k=>`${ico('lock')} Level ${G.GATE[k]}`;
  // ---------- toasts / modal ----------
  // Toast queue: one small toast at a time, merges duplicates / same-group toasts ("3 achievements unlocked").
  const tq=[]; let tCur=null, tTimer=0;
  const GROUP_TXT={ach:(n,first)=>n>1?n+' achievements unlocked! Claim in Quests':'Achievement: '+first+'! Claim in Quests', pest:(n,first)=>first};
  function toast(text,kind='',group){
    const same=it=>group?it.group===group:it.text===text;
    if(tCur&&same(tCur)&&tCur.el){ tCur.n++; tCur.el.textContent=label(tCur); clearTimeout(tTimer); tTimer=setTimeout(hideToast,1800); bumpEl(tCur.el); return; }
    const q=tq.find(same); if(q){ q.n++; return; }
    tq.push({text,kind,group,n:1,first:text}); if(tq.length>5) tq.splice(tq.findIndex(x=>x.kind!=='bad'),1);
    if(!tCur) nextToast();
  }
  function label(it){ if(it.group&&GROUP_TXT[it.group]) return GROUP_TXT[it.group](it.n,it.first); return it.n>1?it.text+'  ×'+it.n:it.text; }
  function bumpEl(el){ el.classList.remove('tbump'); void el.offsetWidth; el.classList.add('tbump'); }
  function nextToast(){ if(mOpen||cOpen){ setTimeout(()=>{ if(!tCur) nextToast(); },400); return; } tCur=tq.shift(); if(!tCur) return; placeToasts(); const d=document.createElement('div'); d.className='toast '+tCur.kind; d.textContent=label(tCur); tCur.el=d; $('#toasts').innerHTML=''; $('#toasts').appendChild(d);
    tTimer=setTimeout(hideToast,tCur.kind.includes('long')?5200:tq.length>2?1200:2000); }
  function placeToasts(){ const t=$('#toasts'); if(!t) return; let L=8,Rr=innerWidth-8; for(const id of ['seedBag','scoutBtn','upgBtn']){ const e=document.getElementById(id); if(e&&e.getClientRects().length){ const r=e.getBoundingClientRect(); L=Math.max(L,r.right+6); } } const lt=document.getElementById('locTabs'); if(lt&&lt.getClientRects().length) Rr=Math.min(Rr,lt.getBoundingClientRect().left-6);
    t.style.top=(GainLane.top()+34)+'px'; t.style.bottom='auto'; t.style.left=((L+Rr)/2)+'px'; t.style.right='auto'; t.style.transform='translateX(-50%)'; t.style.alignItems='center'; t.style.maxWidth=Math.max(160,Rr-L)+'px'; t.style.width='auto'; }
  function hideToast(){ const it=tCur; if(!it) return; const d=it.el; d.classList.add('out'); setTimeout(()=>{ d.remove(); tCur=null; nextToast(); },220); }
  const mq=[]; let mOpen=false;
  function modal(html,acts){ return new Promise(res=>{ mq.push({html,acts,res}); if(!mOpen&&!cOpen) nextModal(); }); }
  function nextModal(){ const it=mq.shift(); const m=$('#modal'), c=$('#modalCard'); if(!it){ mOpen=false; m.classList.add('hidden'); if(cq.length&&!cOpen){ setTimeout(()=>{ if(!mOpen&&!cOpen) nextCel(); },200); return; } if(celWait.length) setTimeout(()=>{ while(celWait.length&&!mOpen) loginCel(celWait.shift()); },250); return; } mOpen=true;
    c.innerHTML=it.html+`<div class="acts">${it.acts.map((a,i)=>`<button class="btn ${a.cls||''}" data-i="${i}">${a.label}</button>`).join('')}</div>`;
    m.classList.remove('hidden'); Sound.play('open');
    c.querySelectorAll('.acts .btn').forEach(b=>b.onclick=()=>{ m.classList.add('hidden'); it.res(it.acts[+b.dataset.i].v); setTimeout(nextModal,120); }); }
  // ---------- celebrations (level up, login streak) ----------
  const cq=[]; let cOpen=false;
  function celebrate(html,dur){ cq.push({html,dur}); if(!cOpen&&!mOpen&&!document.getElementById('splash')) nextCel(); else if(!cOpen) setTimeout(()=>{ if(!cOpen&&!mOpen&&cq.length) nextCel(); },600); }
  function nextCel(){ const it=cq.shift(), el=$('#celebrate'); if(!it){ cOpen=false; el.classList.add('hidden'); if(mq.length&&!mOpen) setTimeout(()=>{ if(!mOpen&&!cOpen) nextModal(); },150); return; } if(mOpen||document.getElementById('splash')){ cq.unshift(it); cOpen=false; setTimeout(()=>{ if(!cOpen&&!mOpen) nextCel(); },500); return; } cOpen=true;
    el.innerHTML=it.html+'<div class="tapc">Tap to continue</div>'; el.classList.remove('hidden'); el.style.animation='none'; el.offsetHeight; el.style.animation='';
    confetti(); const done=()=>{ clearTimeout(tm); el.onclick=null; el.classList.add('hidden'); setTimeout(nextCel,150); }; const tm=setTimeout(done,it.dur||4200); el.onclick=done; }
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
  function loginCel(o){ if(G.st.quest<=4&&!window.__giftForce){ setTimeout(()=>loginCel(o),3000); return; } window.__giftForce=0;   // the guided first minute comes first
    if(document.getElementById('splash')){ setTimeout(()=>loginCel(o),400); return; } if(mOpen||mq.length){ celWait.push(o); return; } celebrate(`<div style="font-size:12px;font-weight:900;letter-spacing:3px;color:#9fe8ff">DAILY GIFT</div><h3>Day ${o.n} streak!</h3>${streakHTML(true)}<div class="rw"><span>${ico('gem')} +${o.r.gems}</span>${o.r.cash?`<span>${ico('coin')} +${fmt(o.r.cash*100*G.st.level)}</span>`:''}${o.r.rarePacks?'<span>Rare Seed Pack</span>':''}${o.r.legPacks?'<span>Legendary Seed Pack</span>':''}</div><div style="font-size:12px;color:#cfe">${window.__streakSaved?'<b style="color:#9dffc0">Streak saved!</b> You missed a day, but your streak was kept. ':''}Come back tomorrow for Day ${o.n+1}. Missing a day or two pauses your streak, it never resets.</div>`,6000); }
  // ---------- big milestone celebrations ----------
  function bigCel(kind){
    const C={land:['art/island-bg.webp','The family land is yours!','Uncle Ikaika hands you the keys to the land on the hill. Terraces are ready, and there is room for a greenhouse.'],
      ghbuilt:['art/greenhouse.webp','Greenhouse built!','Glass, raised beds and fans. Weather still matters, but beds yield 35% more than the garage.'],
      permit:['art/indoor.webp','County Agricultural Permit approved','Auntie Lani stamps your paperwork. The indoor facility is one step closer.'],
      indoor:['art/indoor.webp','Indoor facility open!','Sealed rooms, rolling benches and LED bars. Double yield and AAA grade, with real running costs.']}[kind];
    if(!C) return; Sound.play('level');
    celebrate(`<div style="font-size:12px;font-weight:900;letter-spacing:3px;color:#9fe8ff">MILESTONE</div><img src="${C[0]}" alt="" style="width:min(320px,76vw);border-radius:16px;margin:8px auto;display:block;box-shadow:0 6px 24px rgba(0,0,0,.4)"><h3>${C[1]}</h3><p style="color:#dfe;max-width:320px;margin:0 auto">${C[2]}</p>`,6500);
  }
  // mystery strain reveal: silhouette -> painted close-up
  function reveal(s){ Sound.play('discover'); confetti(140);
    modal(`<div class="reveal"><img class="r-sil" src="${R.closeup(s,220,true)}" alt=""><img class="r-real" src="${R.closeup(s,220)}" alt=""></div><div style="font-size:12px;font-weight:900;letter-spacing:3px;color:#d9a8ff">PHENO DISCOVERED</div><h3>${esc(s.name)}</h3><div>${tag(s)}</div><p>${esc(s.parents.join(' × '))}<br>Recipe recorded in your Strain Book. Seeds unlocked (+3 in your bag).</p>`,[{label:'Details',cls:'sec',v:'d'},{label:'Thanks!',cls:'gold'}]).then(v=>{ if(v==='d') strainModal(s.id); }); }

  // ---------- HUD ----------
  let shownCash=0;
  const LOCI={garage:'🏠',farm:'🌿',indoor:'🏭'};
  function landReq(){ const st=G.st; return [{t:'Reach level '+G.LAND_LEVEL,ok:st.level>=G.LAND_LEVEL,p:Math.min(1,(st.level-1+st.xp/G.xpNeed(st.level))/(G.LAND_LEVEL-1))},{t:'Save '+fmt(G.LAND_COST),ok:st.cash>=G.LAND_COST,p:st.cash/G.LAND_COST}]; }
  let goalT=0; function goalPeek(ms){ const g=$('#goal'); if(!g) return; g.classList.add('open'); clearTimeout(goalT); goalT=setTimeout(()=>g.classList.remove('open'),ms); }
  function orderBoard(){ const st=G.st, n=$('#obN'), t=$('#obTop'); if(!n) return; let nv, tv; if(st.level<G.GATE.orders){ nv='🔒'; tv='Unlocks at level '+G.GATE.orders; } else { nv=String(st.orders.length); const o=st.orders[0], s=o&&G.strain(o.s); tv=o&&s?`${o.who}: ${o.n}× ${s.name.split(' ')[0]} · ${G.orderHave(o)>=o.n?'ready ✓':G.orderHave(o)+'/'+o.n}`:'No orders right now'; }
    if(n.textContent!==nv) n.textContent=nv; if(t.textContent!==tv) t.textContent=tv; }
  function seedBag(){ const st=G.st, s=G.strain(st.selSeed); const n=$('#sbName'), c=$('#sbCount'); if(!n) return; const nm=s?s.name.split(' ')[0]:'Seeds', ct=s?(st.seeds[s.id]||0)+'×':'0'; if(n.textContent!==nm) n.textContent=nm; if(c.textContent!==ct) c.textContent=ct; }
  function seedPick(){ const st=G.st, el=$('#seedPick'); if(!el.classList.contains('hidden')){ el.classList.add('hidden'); return; }
    const own=G.S.filter(s=>(st.seeds[s.id]||0)>0).sort((a,b)=>a.game.growSec-b.game.growSec);
    el.innerHTML=`<div class="sp-h">Seed bag</div>`+(own.length?own.map(s=>`<button class="sp-row${st.selSeed===s.id?' on':''}" data-pick="${s.id}"><img src="art/seed_48.webp" alt=""><span class="sp-n"><b>${esc(s.name)}</b><small>⏱ ${sec(s.game.growSec)}</small></span><em>${st.seeds[s.id]}×</em></button>`).join(''):`<p class="sp-e">Bag's empty. Grab seeds at the shop.</p>`)+`<button class="sp-shop" data-pick="__shop">Seed shop</button>`;
    el.classList.remove('hidden'); Sound.play('open'); }
  function locTabs(){
    const st=G.st, el=$('#locTabs'); if(!el) return;
    if(el.children.length!==G.LOCS.length+1) el.innerHTML=G.LOCS.map(l=>`<button class="loctab" data-loc="${l}"><span class="li"></span><span class="lt"><b>${G.LOC_NAME[l]}</b><small></small><div class="bar thin"><i></i></div></span><em class="badge"></em></button>`).join('')+`<button class="loctab stand" data-stand="1"><span class="li"><img src="art/stand_icon.webp" alt=""></span><span class="lt"><b>Farm Stand</b><small></small></span><em class="badge"></em></button>`;
    G.LOCS.forEach((l,i)=>{ const btn=el.children[i]; { const bn=btn.querySelector('b'); if(bn.textContent!==G.LOC_NAME[l]) bn.textContent=G.LOC_NAME[l]; } const open=G.locOpen(l), ripe=open?G.ripeIn(l):0; let sub='', p=0;
      if(open){ const tot=st.plots.filter(q=>q.loc===l&&q.owned).length, grow=st.plots.filter(q=>q.loc===l&&q.owned&&q.strain).length; sub=grow+'/'+tot+' growing'; if(st.upkeepWarn[l]>0) sub='⚠ upkeep short'; }
      else if(l==='farm'){ const r=landReq(); p=(Math.min(1,r[0].p)+Math.min(1,r[1].p))/2; sub=st.level<G.LAND_LEVEL?'Lv '+G.LAND_LEVEL+' · '+fmt(G.LAND_COST):fmt(Math.min(st.cash,G.LAND_COST))+' / '+fmt(G.LAND_COST); }
      else { const ck=G.indoorChecklist(); const n=ck.filter(c=>c.ok).length; p=n/ck.length; sub=n+'/'+ck.length+' checklist'; }
      const cls='loctab'+(st.loc===l?' on':'')+(open?'':' locked'); if(btn.className!==cls) btn.className=cls;
      const set=(sel,v)=>{ const e=btn.querySelector(sel); if(e.textContent!==v) e.textContent=v; };
      set('.li',open?LOCI[l]:'🔒'); set('small',sub); set('.badge',ripe?String(ripe):'');
      const br=btn.querySelector('.bar'); br.style.display=open?'none':''; const w=Math.max(0,Math.min(1,p))*100+'%'; if(br.firstChild.style.width!==w) br.firstChild.style.width=w; });
    { const sb=el.lastElementChild, n=G.invCount?0:0; const cls='loctab stand'+(panel==='stand'&&!$('#sheet').classList.contains('hidden')?' on':''); if(sb.className!==cls) sb.className=cls; const q=sb.querySelector('small'), v=(st.cust&&st.cust.length?st.cust.length+' waiting':'Sell your buds'); if(q.textContent!==v) q.textContent=v; }
    const tb=$('#toolbar'); if(tb){ const b=(tb.offsetHeight+10)+'px'; if(document.documentElement.style.getPropertyValue('--toastb')!==b) document.documentElement.style.setProperty('--toastb',b); }
  }
  function hud(dt){
    const st=G.st;
    // Chase the live balance. Restarting a timed ease whenever cash changes (upkeep does, every frame) froze the label on the value from load.
    { const target=st.cash, gap=target-shownCash;
      if(Math.abs(gap)<0.5) shownCash=target;
      else { const dt0=Math.max(0,Math.min(0.25,typeof dt==='number'&&dt>0?dt:0)), k=dt0?1-Math.pow(0.001,dt0/0.45):0; shownCash+=gap*k; if(Math.abs(shownCash-target)<0.5) shownCash=target; } }
    $('#cash').textContent=fmt(shownCash); $('#gems').textContent=G.num(st.gems);
    $('#lvl').textContent=st.level; $('#xpfill').style.width=Math.min(100,st.xp/G.xpNeed(st.level)*100)+'%';
    const m=G.earnMult(); $('#multBadge').textContent='x'+(m<10?m.toFixed(1):Math.round(m)); $('#multBadge').style.display=m>1.001?'':'none';
    const ph=G.dayPhase(), hh=Math.floor(ph*24), mm=Math.floor((ph*24-hh)*60), w=G.WEATHER[st.weather.type];
    const U=G.upkeepRates()[st.loc]; const upk=U.total>0?` · ${fmt(U.total)}/h upkeep${st.upkeepWarn[st.loc]>0?' ⚠ slowed':''}`:'';
    { const sm=innerWidth<520, se=G.SEASONS[G.season()], extra=(sm&&(G.marketDay()||G.evFx('swell'))?'':' · '+(sm?se.name.split(' ')[0]:se.name))+(G.marketDay()?(sm?' · Market':' · Market day'):'')+(G.evFx('swell')?(sm?' · Swell':' · Big swell'):''), wn=st.weather.rainbow>0?(sm?'Rainbow':'Rainbow +10%'):w.name;
      $('#clockTxt').textContent=`${sm?'D':'Day '}${Math.floor(st.time/G.DAY_LEN)+1} · ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} · ${sm&&extra?wn.split(' ')[0]:wn}${extra}${sm?(extra?'':upk.replace(' upkeep','')):upk}`; }
    $('#clock').classList.toggle('warn',st.upkeepWarn[st.loc]>0);
    const wet=G.invCount('wet'), sellable=G.invCount('dry')+G.invCount('cured')+G.goodsCount();
    $('#procBadge').textContent=wet?G.num(wet):''; const qr=G.questsReady()+(G.st.questDone?1:0); $('#qBadge').textContent=qr||'';
    const mk=sellable+(st.level>=G.GATE.orders?st.orders.filter(o=>G.orderHave(o)>=o.n).length:0); $('#mktBadge').textContent=mk?G.num(mk):'';
    const chips=[]; const b=st.gecko&&st.gecko.boost; if(b&&b.t>0) chips.push(`🦎 ${b.k==='grow'?'2x growth':'+50% prices'} · ${sec(b.t)}`);
    if(st.event.id){ const E=st.event.id==='season'?G.seasonEv():G.EVENTS[st.event.id]; chips.push(`${E.name} · ${E.desc} · ${sec(st.event.t)}`); }
    else if(st.market.hot&&st.market.hotT>0) chips.push(`Tourist rush · ${G.strain(st.market.hot).name.split(' ')[0]} 2x · ${sec(st.market.hotT)}`);
    const fs=G.festState(); if(fs&&!fs.claimed) chips.push(`🌺 ${fs.f.name} · ${fs.prog}/${fs.f.goal}`);
    const ec=$('#eventChip'); const ct=chips.join('  |  '); if(ct){ if(ec.textContent!==ct) ec.textContent=ct; ec.classList.remove('hidden'); } else ec.classList.add('hidden');
    { let bh=$('#boostHud'); if(!bh){ bh=document.createElement('div'); bh.id='boostHud'; document.body.appendChild(bh); bh.addEventListener('click',e=>{ const t=e.target.closest('[data-go]'); if(t) open('shop',t.dataset.go); }); }
      const B=G.BOOSTS, parts=Object.keys(B).filter(k=>G.boostLeft(k)>0).map(k=>`<span class="bpill b-${k}" data-go="gemstore">${B[k].icon} ${B[k].name} <b>${sec(G.boostLeft(k))}</b></span>`), ad=G.adState();
      /* ads counter lives in the shop now */
      const hh=parts.join(''); if(bh._h!==hh){ bh._h=hh; bh.innerHTML=hh; }  const ecv=$('#eventChip'), ref=ecv&&!ecv.classList.contains('hidden')&&ecv.getBoundingClientRect().top<innerHeight/2?ecv:$('#clock'); if(ref){ const r=ref.getBoundingClientRect(); bh.style.top=Math.round(r.bottom+6)+'px'; } }
    const s=G.strain(st.selSeed);
    if(s&&$('#seedLbl')){ $('#seedLbl').textContent=(st.seeds[s.id]||0)+'× '+s.name.split(' ')[0]; }
    const q=G.curQuest(), g=$('#goal');
    if(q){ const r=q.r.cash?fmt(q.r.cash):q.r.gems?q.r.gems+' gems':q.r.hints+' hint'+(q.r.hints>1?'s':''); const who=G.F.storyGoals&&q.who?q.who:null;
      const h=`${who?portraitImg(who,'gport'):'<span class="gport" style="display:grid;place-items:center;background:#24402c;border-radius:50%">🎯</span>'}<i class="gdot"></i><div class="gtx"><div class="gt">${st.questDone?'Goal complete! Tap to claim':(who?esc(who)+' · ':'')+'Goal '+(st.quest+1)+'/'+G.QUESTS.length}</div>${esc(q.t)} <span class="gr">${r}</span></div>`;
      if(g._h!==h){ const first=g._h==null; g._h=h; g.innerHTML=h; if(!first) goalPeek(4500); } g.classList.toggle('done',st.questDone); }
    else if(g._h!==''){ g._h=''; g.innerHTML=''; }
    // story glow. The tutorial card points on its own, so the two hands don't fight.
    const tutOn=window.Tutorial&&Tutorial.active&&Tutorial.active();
    const gq=!tutOn&&q&&!st.questDone&&st.quest<7?{plant:'#seedBag',dry:'[data-panel=process]',sell:'[data-panel=market]',gcap:'[data-panel=upgrades]',feed:null}[q.id]:null;
    $$('.guide').forEach(e=>{ if(!gq||!e.matches(gq)) e.classList.remove('guide'); }); if(gq){ const e=$(gq); if(e) e.classList.add('guide'); }
    // water/feed all gating
    const wa=$('#waterAll'), fa=$('#feedAll'); wa.classList.toggle('locked',G.lv('water')<1); if(fa) fa.classList.remove('locked');
    locTabs(); seedBag(); orderBoard();
  }
  // ---------- location tabs ----------
  function tapLoc(l){ const st=G.st; Sound.play('tap');
    if(G.locOpen(l)){ if(st.loc!==l){ G.setLoc(l); hidePop(); } return; }
    if(l==='farm') landModal(); else indoorModal(); }
  function reqList(L){ return `<div class="reqs">${L.map(c=>`<div class="req ${c.ok?'ok':''}"><span>${c.ok?'✅':'⬜'}</span><div class="grow"><b>${esc(c.t)}</b>${c.p!=null&&!c.ok?bar(c.p,'thin'):''}${c.v&&!c.ok?`<small>${esc(c.v)}</small>`:''}</div></div>`).join('')}</div>`; }
  function landModal(){ const L=landReq(); const ready=L.every(c=>c.ok);
    modal(`<img src="art/island-bg.webp" alt="" style="width:100%;border-radius:14px;max-height:150px;object-fit:cover"><h3>Buy the family land</h3><p>Uncle Ikaika is selling the old terraces on the hill. The land opens the farm: outdoor terraces now, a greenhouse next. Your garage keeps producing the whole time.</p>${reqList(L)}`,
      [{label:'Later',cls:'sec',v:0},{label:ready?'Buy for '+fmt(G.LAND_COST):'Not yet',cls:ready?'gold':'sec',v:ready?1:0}]).then(v=>{ if(v&&G.buyLand()){ G.setLoc('farm'); } }); }
  function indoorModal(){ const ck=G.indoorChecklist(); const st=G.st;
    const ready=ck.slice(0,5).every(c=>c.ok);
    const acts=[{label:'Later',cls:'sec',v:0}];
    if(!st.permit&&st.level>=G.INDOOR.permitLevel) acts.push({label:'Buy permit '+fmt(G.INDOOR.permitCost),cls:'',v:'permit'});
    if(st.permit&&!st.found&&st.level>=G.INDOOR.foundLevel) acts.push({label:'Pour foundation '+fmt(G.INDOOR.foundCost),cls:'',v:'found'});
    if(ready) acts.push({label:(st.cash>=G.INDOOR.build?'Build ':'Need ')+fmt(G.INDOOR.build),cls:st.cash>=G.INDOOR.build?'gold':'sec',v:st.cash>=G.INDOOR.build?'build':0});
    modal(`<img src="art/indoor.webp" alt="" style="width:100%;border-radius:14px;max-height:150px;object-fit:cover"><h3>Indoor facility checklist</h3><p>Sealed veg and flower rooms on rolling benches: double yield and AAA grade, but power, climate and rent cost money every hour. Pour the foundation before the build.</p>${reqList(ck)}`,acts)
      .then(v=>{ if(v==='permit'){ if(G.buyPermit()) indoorModal(); } else if(v==='found'){ if(G.buyFoundation()) indoorModal(); } else if(v==='build'&&G.buildIndoor()){ G.setLoc('indoor'); } }); }
  // ---------- tools ----------
  function setTool(t){ tool=t; $$('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===t)); Sound.play('tap'); }
  // ---------- plot interaction ----------
  function tapPlot(p,sx,sy){
    const st=G.st, again=popPlot===p||lastSel===p; hidePop();
    if(!p.strain){ lastSel=null; if(st.seeds[st.selSeed]>0) G.plant(p); else { toast('No '+(G.strain(st.selSeed)?.name||'')+' seeds. Open your seed bag or the seed shop!','bad'); open('seeds'); } return; }
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
    const p=popPlot; if(!p||!p.strain){ hidePop(); return; } const s=G.strain(p.strain), left=G.timeLeft(p), cc=G.cycleCost(p);
    $('#pop').innerHTML=`<h5>${esc(s.name)} <small style="color:var(--mut)">${esc(G.ZONE[p.zone].name)}</small></h5>
      <div class="l"><span>Ready in</span><b>${p.prog>=1?'Ripe now!':sec(left)+' · ~'+clockAt(left)}</b></div>${bar(p.prog)}
      <div class="l"><span>Water</span><b>${Math.round(p.water*100)}%</b></div>${bar(p.water,'blue')}
      <div class="l"><span>Feed</span><b>${p.food>0?'Fed (+15% speed, +20% yield)':G.isHungry(p)?'<span class="down">Needs one free feed (20% slower, no yield bonus)</span>':'One free feed at halfway'}</b></div>
      <div class="l"><span>Health</span><b>${p.pest==='mold'?'<span class="down">Mold! Treat now</span>':p.pest==='pests'?'<span class="down">Pests! Treat now</span>':'Healthy'}</b></div>
      <div class="l"><span>Training</span><b>${p.pruned?'Pruned (+12%)':G.canPrune(p)?'<span class="up">Ready to prune</span>':p.prog<.15?'Too young to prune':'Not pruned'}${p.trellis?' · Trellis (+8%)':''}${p.train==='top'?' · Topped (+15%)':p.train==='lst'?' · LST (+8%)':''}</b></div>
      <div class="l"><span>Expected grade</span><b>${gradeBadge(G.gradeOf(G.plotScore(p)))}</b></div>
      <div class="l"><span>Upkeep this cycle</span><b>${fmt(cc.total)}</b></div>${G.st.upkeepWarn[p.loc]>0?'<div class="l"><span class="down">Cash too low for upkeep: growing at 30%</span></div>':''}
      <div class="acts">${G.canTrain(p)?`<button class="btn sm green" data-pa="top">Top (+15%, 10% slower)</button><button class="btn sm green" data-pa="lst">Tie down / LST (+8%, +3% quality)</button>`:''}${G.canPrune(p)?`<button class="btn sm green" data-pa="prune">Prune (+12%)</button>`:''}${G.canTrellis(p)?`<button class="btn sm" data-pa="trellis">Trellis ${fmt(G.trellisCost(p))} (+8%)</button>`:''}${p.pest?`<button class="btn sm pink" data-pa="treat">Treat ${fmt(G.treatCost(p))}</button>`:''}<button class="btn sm" data-pa="water">${ico('drop')}Water</button><button class="btn sm gold" data-pa="feed" ${p.food>0||!G.isHungry(p)?'disabled':''}>${ico('feed')}${p.food>0?'Fed':G.isHungry(p)?'Feed':'Feed at halfway'}</button></div>`;
  }
  function hidePop(keepSel){ popPlot=null; if(!keepSel) lastSel=null; $('#pop').classList.add('hidden'); }
  // ---------- panels ----------
  const PANELS={};
  function open(name,t){ panel=name; tab=t||null; hidePop(); render(true); $('#sheet').classList.remove('hidden'); document.body.classList.add('sheet-open'); Sound.play('open'); }
  function close(){ panel=null; $('#sheet').classList.add('hidden'); document.body.classList.remove('sheet-open'); }
  function render(reset){
    if(!panel) return; const P=PANELS[panel]; const body=$('#sheetBody'); const top=body.scrollTop;
    const o=P(); $('#sheetTitle').textContent=o.title; $('#sheetSub').innerHTML=o.sub||'';
    $('#sheetTabs').innerHTML=(o.tabs||[]).map(([k,l])=>`<button data-tab="${k}" class="${k===tab?'on':''}">${l}</button>`).join('');
    if(body._h!==o.body||reset){ body._h=o.body; body.innerHTML=o.body; body.querySelectorAll('img[data-cu]').forEach(im=>{ const s=G.strain(im.dataset.cu); im.src=R.closeup(s,+im.dataset.sz||96,im.dataset.h==='1'); }); syncVol(body); }
    const f=o.foot||''; if($('#sheetFoot')._h!==f){ $('#sheetFoot')._h=f; $('#sheetFoot').innerHTML=f; }
    if(!reset) body.scrollTop=top; else body.scrollTop=0;
    const lc=document.getElementById('labScene'); if(lc) drawLab(lc); drawCosPrev(body); { const pt=document.getElementById('passTrack'); if(pt&&!pt._init){ pt._init=1; const nx=pt.querySelector('.pt-col.next')||pt.querySelector('.pt-col.un:last-child'); if(nx) pt.scrollLeft=Math.max(0,nx.offsetLeft-60); } } if(document.getElementById('strainWeb')) webInit(); body.querySelectorAll('canvas.pcard').forEach(c=>{ const x=c.getContext('2d'); x.clearRect(0,0,c.width,c.height); try{ R.plantCard(x,JSON.parse(c.dataset.pc)); }catch(e){} });
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
  const row=(s,mid,right,sel,hidden)=>`<div class="row ${sel?'sel':''}">${cu(s,96,hidden)}<div class="grow"><h4>${hidden?'???':esc(s.name)} ${tag(s)}</h4>${mid}</div>${right||''}</div>`;
  const pips=(l,m)=>`<span style="letter-spacing:2px;color:var(--acc)">${'●'.repeat(l)}<span style="color:rgba(255,255,255,.2)">${'●'.repeat(Math.max(0,m-l))}</span></span>`;

  // Seeds
  PANELS.seeds=()=>{
    const st=G.st; tab=tab||'all';
    const list=G.S.filter(s=>st.discovered[s.id]).filter(s=>tab==='all'||(tab==='fast'?s.game.growSec<=1800:tab==='island'?s.island:s.tier>=3));
    list.sort((a,b)=>a.game.growSec-b.game.growSec);
    const body=list.map(s=>{ const pr=G.seedPrice(s), m=G.mastery(s.id); const ph=s.game.payout/(s.game.growSec/3600);
      return row(s,`<div class="stats"><span>⏱ ${sec(s.game.growSec)}</span><span>${s.game.buds} buds</span><span>~${fmt(s.game.payout)}/plant</span><span>${fmt(ph)}/h</span><span>${thc(s)}</span></div><p>Seed ${fmt(pr)} · own <b>${st.seeds[s.id]||0}</b>${m.lvl?` · Mastery x${m.m}`:''}${m.next&&st.level>=3?` · ${m.n}/${m.next} harvests to x${m.nextM}`:''}</p>`,
      `<div style="display:flex;flex-direction:column;gap:4px"><button class="btn sm" data-a="buy" data-id="${s.id}" data-n="1" ${st.cash<pr?'disabled':''}>Buy 1</button><button class="btn sm sec" data-a="buy" data-id="${s.id}" data-n="5" ${st.cash<pr*5?'disabled':''}>×5</button>${st.selSeed===s.id?'<span class="chip selchip">✓ Selected</span>':''}</div>`,st.selSeed===s.id).replace('<div class="row','<div data-pickseed="'+s.id+'" class="row '+((st.seeds[s.id]||0)>0?'pickable':'')); }).join('')
      +`<div class="note">Grow times run from 30 seconds (Common) to 3 days (Legendary). Plants keep growing while you're away. Long grows pay a little more per hour. More strains unlock by level, breeding and island festivals.</div>`;
    const sel=G.strain(st.selSeed), empty=st.plots.filter(p=>p.owned&&!p.strain&&p.loc===st.loc).length;
    return {title:'Seed Shop',sub:'Pick a strain, then tap an empty bucket, pot or bed.',tabs:[['all','All'],['fast','Under 30m'],['island','Island'],['top','Epic+']],body,
      foot:`<div style="flex:1;font-size:12px;color:var(--mut)">Selected: <b style="color:#fff">${esc(sel?.name||'-')}</b> (${st.seeds[st.selSeed]||0})</div><button class="btn" data-a="plantall" ${!empty?'disabled':''}>Plant ${empty} here</button>`};
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
  // Market: sell, orders, customers
  function spark(id){ const h=G.st.market.hist[id]||[]; if(h.length<2) return ''; const mn=.5,mx=1.85; const pts=h.map((v,i)=>`${(i/(h.length-1)*60).toFixed(1)},${(18-(v-mn)/(mx-mn)*18).toFixed(1)}`).join(' ');
    const up=h[h.length-1]>=h[h.length-2]; return `<svg width="60" height="18" style="vertical-align:middle"><polyline points="${pts}" fill="none" stroke="${up?'#7dffa6':'#ff8a8a'}" stroke-width="1.6"/></svg>`; }
  PANELS.stand=()=>{ const o=PANELS.market(); return {...o, title:'Farm Stand', sub:'Fresh island buds, sold right off the stand', body:`<div class="stand-hero"><img src="art/stand_hero.webp" alt="Farm stand"></div>`+o.body}; };
  PANELS.market=()=>{
    const st=G.st; tab=tab||'sell'; let total=0, body='', foot='';
    const tabs=[['sell','Sell']]; if(st.level>=G.GATE.orders) tabs.push(['orders','Orders ('+st.orders.length+')']); if(st.level>=G.GATE.customers) tabs.push(['cust','Customers ('+st.cust.length+')']);
    const rt=G.repTier(), R0=G.REP[rt], R1=G.REP[rt+1];
    const repLine=st.level>=G.GATE.orders?`<div class="row" style="display:block"><h4>Reputation: ${esc(R0.n)} ${R0.b?`<span class="chip">+${Math.round(R0.b*100)}% prices</span>`:''}</h4>${R1?`${bar((st.rep-R0.at)/(R1.at-R0.at),'amber')}<p>${Math.floor(st.rep)} / ${R1.at} to ${esc(R1.n)}: better buyers (${esc(G.BUYERS[Math.min(4,rt+1)].n)}) and +${Math.round(R1.b*100)}% prices</p>`:'<p>Top tier reached. Island royalty!</p>'}</div>`:'';
    if(tab==='sell'){
      if(st.market.hot){ const s=G.strain(st.market.hot); body+=`<div class="testbanner" style="color:#ffe28a">Tourist rush! ${esc(s.name)} sells for 2x for ${sec(st.market.hotT)}</div>`; }
      const lots=[]; for(const stg of ['cured','dry','wet']) for(const [k,n] of Object.entries(st.inv[stg])) lots.push([stg,k,n]);
      if(!lots.length&&!G.goodsCount()) body+='<div class="empty">Nothing to sell yet. Harvest, dry and cure your buds first.</div>';
      lots.forEach(([stg,k,n])=>{ const {id,g,q}=G.unkey(k), s=G.strain(id), p=G.price(id,g,stg,q), f=st.market.f[id]; total+=p*n;
        body+=row(s,`<p>${gradeBadge(q)} <b>${n}</b> ${stg==='wet'?'fresh':stg} ${g>=2?'<span class="tag mut">Mutant x2.5</span>':''} ${g%2?'· Indoor AAA':''}</p><div class="stats"><span>${fmt(p)}/bud</span><span class="${f>=1?'up':'down'}">${f>=1?'▲':'▼'} ${(f*100).toFixed(0)}%</span><span>${spark(id)}</span></div>`,`<button class="btn sm gold" data-a="sell" data-stg="${stg}" data-k="${k}">${fmt(p*n)}</button>`); });
      Object.entries(st.goods).forEach(([k,n])=>{ const [t,id]=k.split('|'); const v=G.goodPrice(k); total+=v*n; body+=row(G.strain(id),`<p><b>${n}</b> × ${esc(G.CRAFT[t].name)}</p>`,`<button class="btn sm gold" data-a="sellgood" data-k="${k}">${fmt(v*n)}</button>`); });
      body+=repLine+`<div class="note">Prices drift (55% to 180%). Your multiplier: x${G.earnMult().toFixed(2)}${st.pass2x?' (2x pass)':''}.</div>`;
      foot=`<button class="btn gold wide" data-a="sellall" ${!total?'disabled':''}>${ico('coin')}Sell everything · ${fmt(total)}</button>`;
    } else if(tab==='orders'){
      body+=`<div class="note">Contracts from local buyers. Deliver dried or cured buds before the timer runs out for bonus cash, XP and reputation. Better reputation brings better buyers.</div>`;
      body+=st.orders.length?st.orders.map(o=>{ const s=G.strain(o.s), have=G.orderHave(o), ok=have>=o.n; return row(s,`<p><b>${esc(o.who)}</b> wants <b>${o.n}</b> ${esc(s.name)} (dried or cured)</p>${bar(Math.min(1,have/o.n))}<div class="stats"><span>${have}/${o.n} in stock</span><span>⏱ ${sec(o.t-o.T)}</span><span>+${o.rep} rep</span></div>`,`<button class="btn sm ${ok?'gold':'sec'}" data-a="order" data-id="${o.id}" ${ok?'':'disabled'}>${fmt(G.orderValue(o))}</button>`); }).join(''):'<div class="empty">No orders right now. New ones arrive every minute or so.</div>';
      body+=repLine;
    } else {
      body+=`<div class="note">Walk-in customers at the farm stand. Match their taste for a 30-70% tip. They leave after a few minutes.</div>`;
      body+=st.cust.length?st.cust.map(c=>{ const m=G.custMatch(c); return `<div class="row"><div class="grow"><h4>${esc(c.who)}</h4><p>"${esc(c.pref.t)}" · wants ${c.n} · pays +${Math.round((c.bonus-1)*100)}%</p><p>${m.length?'You have: '+esc(G.strain(G.unkey(m[0].k).id).name):'<span class="down">Nothing in stock matches</span>'} · leaves in ${sec(c.t-c.T)}</p></div><button class="btn sm ${m.length?'gold':'sec'}" data-a="serve" data-id="${c.id}" ${m.length?'':'disabled'}>Serve</button></div>`; }).join(''):'<div class="empty">No customers right now.</div>';
    }
    return {title:'Farm Stand',sub:'Thanks for supporting local farms!',tabs:tabs.length>1?tabs:null,body,foot};
  };
  // Upgrades / build
  function upRow(k,isW){
    const d=isW?G.WORKERS[k]:G.UPG[k]; const l=isW?G.wk(k):G.lv(k), max=isW?d.max:G.maxLv(d), done=l>=max, c=done?0:G.cost(d,l), price=c<=0?(isW&&l>0?'Train':'Free'):fmt(c);
    let lock=''; if(isW&&!G.workerOk(k)) lock=G.st.level<d.level?ico('lock')+'Lv '+d.level:'Needs location'; else if(!isW&&!G.upgNeedOk(d)) lock='Needs location'; else if(!isW&&d.lvl&&G.st.level<d.lvl) lock=ico('lock')+'Lv '+d.lvl;
    const name=d.steps?`${esc(d.name)}: <span style="color:var(--acc)">${esc(d.steps[l])}</span>`:esc(d.name);
    const desc=d.steps?(done?esc(d.descs[l]):`Next: <b>${esc(d.steps[l+1])}</b> · ${esc(d.descs[l+1])}`):esc(d.desc);
    const who=isW&&window.CHARACTERS?Object.keys(window.CHARACTERS).find(n=>n!=='Unko Kuli'&&d.name.startsWith(n)):null;
    return `<div class="row">${who?portraitImg(who,'wport','bust'):(window.UpgIcons?`<img class="upico" alt="" src="${UpgIcons.url(k,d.loc||'all')}">`:'')}<div class="grow"><h4>${name} ${max>1?pips(l,max):''}</h4><p>${desc}</p></div>${done?'<span class="chip">'+(max>1?'MAX':'Owned')+'</span>':`<button class="btn sm ${isW?'pink':''}" data-a="${isW?'hire':'upg'}" data-k="${k}" ${(c>0&&G.st.cash<c)||lock?'disabled':''}>${lock||price}</button>`}</div>`;
  }
  function stepCard(kind,label){ const n=G.nextStep(kind); if(!n) return `<div class="row"><div class="grow"><h4>${label}: all space bought</h4></div><span class="chip">MAX</span></div>`;
    return `<div class="row">${window.UpgIcons?`<img class="upico" alt="" src="${UpgIcons.url('step_'+kind,'step')}">`:''}<div class="grow"><h4>${esc(n.name)}</h4><p>${esc(n.desc||('+'+n.add+' plant spaces'))}</p></div><button class="btn sm gold" data-a="step" data-k="${kind}" ${G.st.cash<n.cost?'disabled':''}>${fmt(n.cost)}</button></div>`; }
  function upkeepBox(l){ const U=G.upkeepRates()[l]; const parts=Object.entries(U.parts).filter(([k,v])=>v>.005);
    return `<div class="row" style="display:block"><h4>Upkeep now: ${fmt(U.total)}/hour ${G.st.upkeepWarn[l]>0?'<span class="tag" style="background:#ff8a5c">Cash short: growth slowed to 30%</span>':''}</h4>${parts.length?`<dl class="kv">${parts.map(([k,v])=>`<dt>${esc(G.UPK_NAME[k]||k)}</dt><dd>${fmt(v)}/h</dd>`).join('')}</dl>`:'<p>Nothing growing here right now.</p>'}<p>Charged while plants grow. If cash runs out you never go into debt: plants just grow slower until you can pay.</p></div>`; }
  PANELS.upgrades=()=>{
    const st=G.st; tab=tab||st.loc; let body='';
    const tabs=[['garage',G.LOC_NAME.garage],['farm','Farm'],['indoor','Indoor'],['lines','Water + feed'],['hands','Helpers']];
    if(tab==='garage'){ const g=G.GARAGE[st.garage];
      body+=`<div class="section-t">Grow space · ${G.capOf('garage')}/25 plants (hard max)</div><div class="note">Now: <b>${esc(g.name)}</b>. New grow tables, buckets and lights fill the floor next to the Kahuna K4 truck as you buy them.</div>`+stepCard('garage','Garage')+upkeepBox('garage');
      body+=`<div class="section-t">Garage gear</div>`+['light','fan','oscfan','dehu','timer','phkit','trays'].map(k=>upRow(k)).join('');
      body+=`<div class="section-t">Pheno work</div><div class="note">${G.garageRole()==='grow'?"This is Grandpa's garage, your main grow for now. When you buy the family land it becomes your Pheno Room.":G.garageRole()==='pheno'?'Pheno Room: double mutation odds on plants grown here, 30% less yield. Crossbreeding happens here.':'Pheno work has moved to the Indoor Breeding Pheno Room. The garage is now storage (+4 drying slots) and a bonus grow.'}</div>`+(G.st.breedLab?'':`<div class="row"><div class="grow"><b>Indoor Breeding Pheno Room</b><p>Takes over pheno work: crosses 60% faster, double mutation odds, +1 hint token per mystery found. Needs the indoor facility.</p></div><button class="btn sm gold" data-buylab ${G.st.inBuilt?'':'disabled'}>${fmt(G.LAB.cost)}</button></div>`); }
    else if(tab==='farm'){
      if(!st.land){ const L=landReq(); body+=`<div class="note">Buy the family land to open the farm.</div>${reqList(L)}<button class="btn wide gold" data-a="land" ${L.every(c=>c.ok)?'':'disabled'}>Buy land · ${fmt(G.LAND_COST)}</button>`; }
      else { body+=`<div class="section-t">Terraces · ${G.capOf('field')}/40 plants</div>`+stepCard('field','Terraces');
        body+=`<div class="section-t">Greenhouse · ${Math.round(G.capOf('gh')/3)}/12 beds</div>`+(st.ghBuilt?stepCard('gh','Greenhouse'):`<div class="row"><div class="grow"><h4>Build the greenhouse</h4><p>Glass house with 3 raised beds to start (expand bay by bay to 12). Cheap to run but weather still matters.</p></div><button class="btn sm gold" data-a="ghbuild" ${st.cash<G.GH_BUILD.cost||!G.gate('gh')?'disabled':''}>${G.gate('gh')?fmt(G.GH_BUILD.cost):ico('lock')+'Lv '+G.GH_BUILD.level}</button></div>`);
        body+=upkeepBox('farm')+`<div class="section-t">Farm gear</div>`+['beds','shade','lightdep','cooler','catch','supp','shutters'].map(k=>upRow(k)).join(''); } }
    else if(tab==='indoor'){
      if(!st.inBuilt){ body+=`<div class="note">The indoor facility is the big late-game step. Finish the checklist:</div>`+reqList(G.indoorChecklist());
        if(!st.permit) body+=`<button class="btn wide" data-a="permit" ${st.level<G.INDOOR.permitLevel||st.cash<G.INDOOR.permitCost?'disabled':''}>${st.level<G.INDOOR.permitLevel?ico('lock')+'Permit at Lv '+G.INDOOR.permitLevel:'Buy County Agricultural Permit · '+fmt(G.INDOOR.permitCost)}</button>`;
        if(st.permit&&!st.found) body+=`<button class="btn wide" data-a="found" style="margin-top:8px" ${st.level<G.INDOOR.foundLevel||st.cash<G.INDOOR.foundCost?'disabled':''}>${st.level<G.INDOOR.foundLevel?ico('lock')+'Foundation at Lv '+G.INDOOR.foundLevel:'Pour the foundation · '+fmt(G.INDOOR.foundCost)}</button>`;
        body+=`<button class="btn wide gold" data-a="buildin" style="margin-top:8px" ${G.indoorChecklist().every(c=>c.ok)?'':'disabled'}>Build indoor facility · ${fmt(G.INDOOR.build)}</button>`; }
      else { body+=`<div class="section-t">Benches · ${G.capOf('in')}/32 pots</div>`+stepCard('bench','Benches')+upkeepBox('indoor')+`<div class="section-t">Facility gear</div>`+['led','hvac','co2','fert','veg','clone','dryroom','solar'].map(k=>upRow(k)).join(''); } }
    else if(tab==='lines'){ body+=`<div class="note">The hose unlocks <b>Water all</b>. Each plant needs one free feed at halfway. <b>Feed all</b> does that for this room and does not need a purchase.</div>`+upRow('water')+upRow('nutes')+upRow('stand'); }
    else { body+=`<div class="note">Each helper has a one-time hire price. Training after that is free, and hired helpers take no wages. Crew you already hired stay on the farm.</div>`+Object.keys(G.WORKERS).map(k=>upRow(k,true)).join('')+(st.vip?'<div class="note">VIP active: auto-load and auto-sell run even without helpers.</div>':''); }
    return {title:'Upgrades',sub:'Every upgrade is earnable in game.',tabs,body};
  };
  // Pheno Room: pheno-hunting mystery
  const parse=v=>!v?null:v.startsWith('s:')?{type:'s',id:v.slice(2)}:{type:'c',name:v.slice(2)};
  PANELS.lab=()=>{
    const st=G.st; let body='';
    if(!G.gate('breed')) body+=`<div class="testbanner" style="color:#ffd9a8">${ico('lock')} The Pheno Room opens at level ${G.GATE.breed}.</div>`;
    const opts=[...G.S.filter(s=>st.discovered[s.id]).map(s=>['s:'+s.id,s.name]),...Object.keys(st.clones).sort().map(n=>['c:'+n,n+' (clone)'])];
    const sel=(v,id)=>`<select data-sel="${id}" style="width:100%;height:44px;border-radius:12px;background:#0f1d17;color:#fff;border:1px solid var(--line);font:inherit;font-weight:700;padding:0 8px"><option value="">Choose parent…</option>${opts.map(([k,l])=>`<option value="${esc(k)}" ${v===k?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
    const a=parse(labA.v), b=parse(labB.v); let preview='Pick any two parents you own. Nobody hands you the recipe: experiment, and every third failed cross earns a hint token.', cost=0, time=0;
    if(a&&b){ cost=G.crossCost(a,b); time=G.crossTime(a,b); const tr=G.triedResult(a,b); preview=tr==='dud'?'You tried this cross: no stable pheno came from it.':tr?`Known result: <b>${esc(G.strain(tr).name)}</b> (repeat for 3 more seeds)`:'Unknown result. Only one way to find out!'; }
    body+=`<canvas id="labScene" width="720" height="260" style="width:100%;border-radius:14px;display:block;margin-bottom:8px"></canvas>`;
    { const H=st.hunt, pct=x=>(x>=0?'+':'')+Math.round(x*100)+'%';
      body+=`<div class="section-t">Pheno hunt · ${st.breedLab?'Breeding Pheno Room':'Pheno Room'}</div>`;
      if(!st.phenoRoom) body+=`<div class="note">Pheno hunts start once Grandpa's garage becomes your Pheno Room (buy the family land).</div>`;
      else if(!H){ const own=G.S.filter(x=>st.discovered[x.id]&&(st.seeds[x.id]||0)>=G.huntSize()); body+=`<div class="note">Pop ${G.huntSize()} seeds of one strain and grow them side by side. Each pheno comes out different. Keep the best one as a <b>mother</b>: every plant of that strain you grow afterwards carries her traits.</div>`+
        (own.length?`<div style="display:grid;grid-template-columns:1fr auto;gap:8px"><select data-sel="H" style="height:44px;border-radius:12px;background:#0f1d17;color:#fff;border:1px solid var(--line);font:inherit;font-weight:700;padding:0 8px">${own.map(x=>`<option value="${x.id}" ${huntSel.v===x.id?'selected':''}>${esc(x.name)} (${st.seeds[x.id]} seeds)${st.keepers[x.id]?' · has mother':''}</option>`).join('')}</select><button class="btn sm green" data-a="hunt">Start hunt</button></div><div class="note">Uses ${G.huntSize()} seeds and takes ${sec(G.huntTime(huntSel.v&&own.find(x=>x.id===huntSel.v)?huntSel.v:own[0].id))}.</div>`:`<div class="note">You need ${G.huntSize()} seeds of a strain. Buy them in Seeds.</div>`); }
      else if(!H.phenos) body+=`<div class="row"><div class="grow"><h4>Growing out ${H.n} ${esc(G.strain(H.id).name)} phenos…</h4>${bar(H.t/H.dur)}<p>${sec(H.dur-H.t)} left</p></div></div>`;
      else { const best=H.phenos.reduce((b,x,i)=>G.phenoScore(x)>G.phenoScore(H.phenos[b])?i:b,0); body+=`<div class="note">Compare the ${esc(G.strain(H.id).name)} phenos and keep one as your mother${st.keepers[H.id]?' (this replaces your current mother)':''}.</div>`+H.phenos.map((x,i)=>`<div class="row ${i===best?'sel':''}"><canvas class="pcard" width="168" height="192" data-pc='${JSON.stringify(Object.assign({x:84,y:178,h:165},{id:H.id,prog:1,seed:i*7+3,h:165*x.h}))}' style="width:56px;height:64px;flex:none;border-radius:10px;background:#16261d"></canvas><div class="grow"><h4>Pheno ${x.k} · ${x.terp}</h4><p>Yield <b>${pct(x.y-1)}</b> · Quality <b>${pct(x.q)}</b> · Growth speed <b>${pct(x.g-1)}</b></p></div><button class="btn sm gold" data-a="keep" data-i="${i}">Keep</button></div>`).join('')+`<button class="btn sm sec" data-a="drophunt">Discard all</button>`; }
      const K=Object.entries(st.keepers||{}); if(K.length) body+=`<div class="section-t">Your mothers (${K.length})</div>`+K.map(([id,x])=>`<div class="row"><canvas class="pcard" width="168" height="192" data-pc='${JSON.stringify(Object.assign({x:84,y:178,h:165},{id,prog:.42,seed:40,pruned:true,train:'lst'}))}' style="width:56px;height:64px;flex:none;border-radius:10px;background:#16261d"></canvas><div class="grow"><h4>${esc(G.strain(id).name)} mother ${x.k} <span class="tag" style="background:${G.lineGen(id)>=G.LINE.stable?'#2f7a34':'#8a5a1a'};color:#fff">${G.lineName(id)}</span> · ${x.terp}</h4><p>Yield ${pct(x.y-1)} · Quality ${pct(x.q)} · Growth ${pct(x.g-1)} on every ${esc(G.strain(id).name)} you grow</p></div>${(()=>{ const c=G.cutState(id); return c.ready?`<button class="btn sm green" data-a="cut" data-id="${id}">Take ${G.CUT.n+(st.breedLab?2:0)} cuttings ${fmt(G.CUT.cost*(G.CUT.n+(st.breedLab?2:0)))}</button>`:`<button class="btn sm sec" disabled>Regrowing ${sec(c.wait)}</button>`; })()}</div>`).join('')+((st.cuts||[]).length?`<div class="section-t">Clone dome</div>`+st.cuts.map(c=>`<div class="row"><canvas class="pcard" width="168" height="192" data-pc='${JSON.stringify(Object.assign({x:84,y:178,h:165},{id:c.id,prog:.06,seed:9,h:600,y:186}))}' style="width:56px;height:64px;flex:none;border-radius:10px;background:#16261d"></canvas><div class="grow"><h4>${c.n} ${esc(G.strain(c.id).name)} cuttings rooting</h4>${bar(c.t/c.dur)}<p>${sec(c.dur-c.t)} left. Rooted clones plant 10% grown with the mother's traits.</p></div></div>`).join(''):''); }
    { const P=G.breedProgress(); body+=`<div class="section-t">End game: complete the strain web</div><div class="row" style="display:block"><h4>${P.pct}% complete</h4>${bar(P.pct/100,'amber')}<p>${P.found}/${P.mystery} mystery phenos bred · ${P.stable} lines stable (F${G.LINE.stable}+). New crosses start as unstable F1 lines; keep a mother from each pheno hunt to advance a generation. Legendary recipes need stable parent lines in the Breeding Pheno Room.</p><button class="btn sm sec" data-a="openweb">Open strain web</button></div>`;
      { const ibl=Object.entries(st.lines||{}).filter(([k,v])=>v.gen>=G.LINE.max), n=G.heirCount();
        body+=`<div class="section-t">F6 tier: Heirloom Seed Vault · ${n} heirloom${n===1?'':'s'}</div><div class="note">Take a line to F6 (IBL) with 2 more kept mothers after it is stable, then certify it in the seed bank (24 h, one at a time). Heirlooms earn +12% on every harvest of that strain and fill the Seed Vault.</div>`;
        if(st.cert) body+=`<div class="row heir-row">${cu(G.strain(st.cert.id),56)}<div class="grow"><h4>Certifying ${esc(G.strain(st.cert.id).name)}</h4>${bar(st.cert.t/st.cert.dur,'amber')}<p>${sec(st.cert.dur-st.cert.t)} left in the seed bank</p></div></div>`;
        body+=ibl.length?ibl.map(([id,v])=>`<div class="row heir-row ${v.heir?'heir':''}">${cu(G.strain(id),56)}<div class="grow"><h4>${esc(G.strain(id).name)} <span class="tag" style="background:${v.heir?'#c9971f':'#2f7a34'};color:#fff">${G.lineName(id)}</span></h4><p>${v.heir?'Certified heirloom · +12% on every harvest':'IBL line, ready to certify'}</p></div>${v.heir?'<span class="chip">🏅</span>':G.canCertify(id)?`<button class="btn sm gold" data-a="certify" data-id="${id}">Certify ${fmt(G.heirCost(id))}</button>`:`<button class="btn sm sec" disabled>${st.cert?(st.cert.id===id?'Certifying…':'Seed bank busy'):'Needs Breeding Room'}</button>`}</div>`).join(''):`<div class="note">No F6 lines yet. Lines at F4-F5: ${Object.values(st.lines||{}).filter(v=>v.gen>=G.LINE.stable&&v.gen<G.LINE.max).length}.</div>`;
        const V=st.vault||{}; body+=`<div class="vault">`+G.VAULT.map((v,i)=>`<div class="vt ${V[i]===2?'got':V[i]===1?'ready':''}"><b>${v.n}</b><span>${esc(v.name)}</span><small>${ico('gem')}${v.r.gems} · ${v.r.legPacks} Leg.</small>${V[i]===1?`<button class="btn sm gold" data-a="vaultclaim" data-i="${i}">Claim</button>`:V[i]===2?'<i>✓</i>':''}</div>`).join('')+`</div>`; }
      if(st.breedLab) body+=`<div class="section-t">Breeding room upgrades</div>`+upRow('labPollen')+upRow('labTissue')+upRow('labSeq'); }
    if(st.breed){ body+=`<div class="row"><div class="grow"><h4>Pollinating…</h4>${bar(st.breed.t/st.breed.dur)}<p>${sec(st.breed.dur-st.breed.t)} left</p></div></div>`; }
    body+=`<div class="section-t">Cross two parents · ${st.hints} hint token${st.hints===1?'':'s'}</div><div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center">${sel(labA.v,'A')}<b>×</b>${sel(labB.v,'B')}</div><div class="note">${preview}</div>`;
    const myst=G.S.filter(s=>s.mystery&&!st.discovered[s.id]).sort((x,y)=>x.tier-y.tier||x.game.unlockLevel-y.game.unlockLevel);
    body+=`<div class="section-t">Mystery phenos (${myst.length} unknown)</div>`+(myst.length?myst.map(s=>{ const hl=G.hintLevel(s); let hint='No hint yet. Level up or keep experimenting.';
      if(hl===1) hint=esc(G.vagueHint(s)); else if(hl>=2){ const r=hl-1; hint='Parents: '+s.parents.map((n,i)=>i<r?'<b>'+esc(n)+'</b>':'???').join(' × '); }
      const canHint=hl<1+Math.min(2,s.parents.length);
      return `<div class="row">${cu(s,96,true)}<div class="grow"><h4>??? ${tag(s)}</h4><p>${hint}</p></div>${canHint?`<button class="btn sm sec" data-a="hint" data-id="${s.id}" ${st.hints<1?'disabled':''}>Use hint</button>`:''}</div>`; }).join(''):'<div class="empty">Every mystery pheno discovered. Legendary!</div>');
    const tried=Object.entries(st.tried).slice(-12).reverse();
    if(tried.length) body+=`<div class="section-t">Your breeding log</div>`+tried.map(([k,r])=>`<div class="row"><div class="grow"><p><b>${esc(k.split('|').join(' × '))}</b> → ${r==='dud'?'no stable pheno':esc(G.strain(r).name)}</p></div></div>`).join('');
    const names=window.POLLEN.slice().sort();
    body+=`<div class="section-t">Heritage clone library</div><div class="note">Parents you can't grow from seed can be bought once as clones (${fmt(G.cloneCost())} each) and used forever.</div>`+names.map(n=>`<div class="row"><div class="grow"><h4>${esc(n)}</h4></div>${st.clones[n]?'<span class="chip">Owned</span>':`<button class="btn sm sec" data-a="clone" data-n="${esc(n)}" ${st.cash<G.cloneCost(n)?'disabled':''}>${fmt(G.cloneCost(n))}</button>`}</div>`).join('');
    const can=a&&b&&!st.breed&&st.cash>=cost&&G.gate('breed');
    return {title:'Pheno Room',sub:'Hunt mystery phenos by experimenting',body,foot:`<button class="btn wide pink" data-a="breed" ${can?'':'disabled'}>${ico('dna')}${a&&b?'Cross for '+fmt(cost)+' · '+sec(time):'Start cross'}</button>`};
  };
  // ---------- Strain Web: family tree of parents -> children (pan, pinch-zoom, tap for details, highlighted lineage) ----------
  const TAU=Math.PI*2, WEB={sel:null,cam:null};
  function webGraph(){ const st=G.st, S=G.S, nodes=new Map(), edges=[];
    const nameOf=new Map(S.map(s=>[s.name.toLowerCase(),s.id]));
    S.forEach(s=>nodes.set(s.id,{id:s.id,s,kind:'s'}));
    S.forEach(s=>s.parents.forEach((pn,i)=>{ const pid=s.parentIds[i]||nameOf.get(pn.toLowerCase())||('p:'+pn.toLowerCase()); if(!nodes.has(pid)) nodes.set(pid,{id:pid,name:pn,kind:'p'}); edges.push({a:pid,b:s.id,i}); }));
    // generation = longest parent chain
    const gen=new Map(), par=new Map(); edges.forEach(e=>{ (par.get(e.b)||par.set(e.b,[]).get(e.b)).push(e.a); });
    const g=id=>{ if(gen.has(id)) return gen.get(id); gen.set(id,0); const P=par.get(id)||[]; const v=P.length?1+Math.max(...P.map(g)):0; gen.set(id,v); return v; }; nodes.forEach((n,id)=>n.g=g(id));
    // roots with no children and no parents go in a separate "starter" column; order each column by the mean y of parents
    const cols=[]; nodes.forEach(n=>{ (cols[n.g]=cols[n.g]||[]).push(n); });
    const order=n=>n.kind==='p'?1:0; cols.forEach((c,gi)=>{ c.sort((a,b)=>{ if(gi>0){ const ma=avgY(a), mb=avgY(b); if(ma!==mb) return ma-mb; } return order(a)-order(b)||((a.s?a.s.tier:0)-(b.s?b.s.tier:0))||(a.s?a.s.name:a.name).localeCompare(b.s?b.s.name:b.name); }); c.forEach((n,i)=>{ n.x=gi*230; n.y=(i-(c.length-1)/2)*92; }); });
    function avgY(n){ const P=par.get(n.id)||[]; if(!P.length) return 0; return P.reduce((t,p)=>t+(nodes.get(p).y||0),0)/P.length; }
    return {nodes,edges,par}; }
  function webState(n){ const st=G.st; if(n.kind==='p') return 'pollen'; const s=n.s; if(st.discovered[s.id]) return 'known'; if(window.PREMIUM_STRAINS&&PREMIUM_STRAINS[s.id]) return 'locked'; if(s.mystery) return (st.hintRev[s.id]||0)>0?'hinted':'mystery'; return 'locked'; }
  // which parent edges of a node the player may see (no spoilers): discovered child = all, hinted = first r parents, otherwise none
  function edgeVisible(e,Gr){ const n=Gr.nodes.get(e.b), stt=webState(n); if(stt==='known'||stt==='locked'&&!n.s.mystery) return true; if(stt==='hinted') return e.i<(G.st.hintRev[n.id]||0); return false; }
  const webImg=new Map();
  function thumb(n,hid){ const k=n.id+(hid?'h':''); let im=webImg.get(k); if(im) return im; const u=R.closeup(n.s,96,hid); im=new Image(); if(u&&u.toDataURL) im.src=u.toDataURL(); else im.src=u; im.onload=()=>webDraw(); webImg.set(k,im); return im; }
  let WG=null;
  function webDraw(){ const cv=document.getElementById('strainWeb'); if(!cv||!WG) return; const x=cv.getContext('2d'), d=Math.min(2,devicePixelRatio||1), W=cv.clientWidth, H=cv.clientHeight;
    if(cv.width!==Math.round(W*d)||cv.height!==Math.round(H*d)){ cv.width=Math.round(W*d); cv.height=Math.round(H*d); }
    const c=WEB.cam; x.setTransform(d,0,0,d,0,0); x.clearRect(0,0,W,H); const bg=x.createRadialGradient(W/2,H/2,20,W/2,H/2,Math.max(W,H)); bg.addColorStop(0,'#17301f'); bg.addColorStop(1,'#0a140e'); x.fillStyle=bg; x.fillRect(0,0,W,H);
    x.setTransform(d*c.z,0,0,d*c.z,d*(W/2-c.x*c.z),d*(H/2-c.y*c.z));
    const hl=new Set(), hle=new Set(); if(WEB.sel){ const up=id=>{ if(hl.has(id)) return; hl.add(id); WG.edges.forEach((e,i)=>{ if(e.b===id&&edgeVisible(e,WG)){ hle.add(i); up(e.a); } }); }; up(WEB.sel); WG.edges.forEach((e,i)=>{ if(e.a===WEB.sel&&edgeVisible(e,WG)){ hle.add(i); hl.add(e.b); } }); }
    WG.edges.forEach((e,i)=>{ const A=WG.nodes.get(e.a), B=WG.nodes.get(e.b), vis=edgeVisible(e,WG), on=hle.has(i); if(!vis&&!on) return;
      x.strokeStyle=on?'#ffd35a':WEB.sel?'rgba(160,220,170,.12)':'rgba(160,220,170,.38)'; x.lineWidth=on?3.2:1.6; x.setLineDash(webState(B)==='hinted'?[6,5]:[]);
      x.beginPath(); x.moveTo(A.x+30,A.y); x.bezierCurveTo(A.x+120,A.y,B.x-120,B.y,B.x-30,B.y); x.stroke(); x.setLineDash([]);
      if(on){ x.fillStyle='#ffd35a'; x.beginPath(); x.moveTo(B.x-30,B.y); x.lineTo(B.x-40,B.y-5); x.lineTo(B.x-40,B.y+5); x.fill(); } });
    WG.nodes.forEach(n=>{ const stt=webState(n), dim=WEB.sel&&!hl.has(n.id), r=n.kind==='p'?20:30; x.globalAlpha=dim?.35:1;
      if(n.kind==='p'){ x.fillStyle='#2a3a2e'; x.strokeStyle='#9fd76a'; x.lineWidth=2; x.beginPath(); x.arc(n.x,n.y,r,0,TAU); x.fill(); x.stroke(); x.fillStyle='#d8f0c0'; for(let k=0;k<6;k++){ const a=k*TAU/6; x.beginPath(); x.arc(n.x+Math.cos(a)*8,n.y+Math.sin(a)*8,3.2,0,TAU); x.fill(); } x.fillStyle='#ffd35a'; x.beginPath(); x.arc(n.x,n.y,4,0,TAU); x.fill(); }
      else { const hid=stt==='mystery'||stt==='hinted', im=thumb(n,hid); x.save(); x.beginPath(); x.arc(n.x,n.y,r,0,TAU); x.clip(); if(im.complete&&im.naturalWidth) x.drawImage(im,n.x-r,n.y-r,2*r,2*r); else { x.fillStyle='#223'; x.fill(); } if(stt==='locked'){ x.fillStyle='rgba(0,0,0,.55)'; x.fillRect(n.x-r,n.y-r,2*r,2*r); } x.restore();
        const ex=window.PREMIUM_STRAINS&&window.PREMIUM_STRAINS[n.id]; x.strokeStyle=WEB.sel===n.id?'#fff':ex?'#ffd35a':({Common:'#9aa',Uncommon:'#5ad06a',Rare:'#4aa0ff',Epic:'#b07be0',Legendary:'#ffb02a'})[n.s.rarity]||'#9aa'; x.lineWidth=WEB.sel===n.id?4:ex?3.5:2.5; x.beginPath(); x.arc(n.x,n.y,r,0,TAU); x.stroke();
        if(stt==='mystery'){ x.fillStyle='#fff'; x.font='900 26px system-ui'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('?',n.x,n.y+1); }
        { const Ln=G.st.lines&&G.st.lines[n.id]; if(Ln&&Ln.heir){ x.strokeStyle='#ffd35a'; x.lineWidth=2; x.setLineDash([4,3]); x.beginPath(); x.arc(n.x,n.y,r+6,0,TAU); x.stroke(); x.setLineDash([]); x.font='14px system-ui'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('🏅',n.x-r*.78,n.y-r*.78); } }
        if(G.st.keepers&&G.st.keepers[n.id]){ x.fillStyle='#ffd35a'; x.beginPath(); x.arc(n.x+r*.75,n.y-r*.75,7,0,TAU); x.fill(); x.fillStyle='#3a2500'; x.font='900 9px system-ui'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('M',n.x+r*.75,n.y-r*.75+.5); }
        if(ex){ x.fillStyle='#ffd35a'; x.font='900 8px system-ui'; x.textAlign='center'; x.fillText('EXCLUSIVE',n.x,n.y-r-6); } }
      const lab=n.kind==='p'?n.name+' (pollen)':stt==='mystery'?'???':n.s.name; x.font='700 11px system-ui'; x.textAlign='center'; x.textBaseline='top'; x.fillStyle='rgba(0,0,0,.6)'; const tw=x.measureText(lab).width; x.fillRect(n.x-tw/2-4,n.y+r+3,tw+8,15); x.fillStyle=stt==='locked'?'#9aa':'#eafff2'; x.fillText(lab,n.x,n.y+r+5); x.globalAlpha=1; });
    x.setTransform(1,0,0,1,0,0); }
  function webCard(){ const el=document.getElementById('webCard'); if(!el) return; const id=WEB.sel; if(!id){ el.innerHTML='<p class="wc-hint">Tap a strain to see its family. Drag to pan, pinch or scroll to zoom.</p>'; return; }
    const n=WG.nodes.get(id), st=G.st; if(n.kind==='p'){ const kids=WG.edges.filter(e=>e.a===id&&edgeVisible(e,WG)).map(e=>WG.nodes.get(e.b).s.name); el.innerHTML=`<h4>${esc(n.name)} <span class="tag">Pollen</span></h4><p>A parent line you can use as pollen in the Pheno Room.</p><p><b>Known children:</b> ${kids.length?esc(kids.join(', ')):'none found yet'}</p>`; return; }
    const s=n.s, stt=webState(n), ex=window.PREMIUM_STRAINS&&window.PREMIUM_STRAINS[id], k=st.keepers&&st.keepers[id], r=st.hintRev[id]||0;
    const pars=s.parents.length?s.parents.map((p,i)=>stt==='known'||(stt==='locked'&&!s.mystery)||i<r?esc(p):'???').join(' × '):'Landrace / original line';
    const how=[]; if(ex){ const n=G.PREMIUM.filter(i=>G.strain(i)).length||1; how.push('Exclusive: Island Shop (money or gems)','Rare drop: Legendary Seed Packs ('+pct(G.DROP.packPremium/n)+' each, as an extra seed)','Rare drop: finished pheno hunts ('+pct(G.DROP.huntPremium/n)+' each)'); }
    if(s.mystery) how.push(stt==='known'?'Bred in the Pheno Room':'Cross the right two parents in the Pheno Room'+(r?' (hint: '+r+' parent'+(r>1?'s':'')+' revealed)':'')); else if(!ex) how.push(window.G.festNow&&G.FESTS.some(f=>f.strain===id)?'Island festival reward':'Seed shop from level '+s.game.unlockLevel);
    el.innerHTML=`<div class="wc-top"><img src="${R.closeup(s,96,stt==='mystery'||stt==='hinted')}" alt=""><div><h4>${stt==='mystery'?'??? mystery pheno':esc(s.name)} ${tag(s)}</h4><p>${esc(s.type)}${stt==='known'&&s.thc?' · '+s.thc+'% THC':''} · ${esc(s.rarity)}</p></div></div>
      <p><b>Parents:</b> ${pars}</p><p><b>How to get:</b> ${esc(how.join(' · '))}</p><p><b>Line:</b> ${G.st.lines&&G.st.lines[id]?esc(G.lineName(id)):s.mystery&&stt!=='known'?'not bred yet':'commercial stable line'}${s.tier>=4?' · Legendary recipe: parents must be stable lines (F'+G.LINE.stable+'+) in the Breeding Pheno Room':''}</p><p><b>Kept mother:</b> ${k?`Pheno ${esc(k.k)} · ${esc(k.terp)} · yield ${Math.round((k.y-1)*100)}%, quality +${Math.round(k.q*100)}%`:'none'}</p>
      ${stt==='known'?`<button class="btn sm sec" data-a="strain" data-id="${id}">Open strain page</button>`:''}`; }
  function webInit(){ const cv=document.getElementById('strainWeb'); if(!cv||cv._init) { webDraw(); return; } cv._init=1; WG=webGraph(); if(!WEB.cam){ let mx=0; WG.nodes.forEach(n=>mx=Math.max(mx,n.x)); let f=null; WG.nodes.forEach(n=>{ if(!f&&n.s&&G.st.discovered[n.id]&&n.g>0) f=n; }); f=f||[...WG.nodes.values()][0]; WEB.cam={x:f.x,y:f.y,z:1}; }
    const pts=new Map(); let moved=0, pinch=null;
    const toW=(px,py)=>{ const c=WEB.cam, W=cv.clientWidth, H=cv.clientHeight; return {x:c.x+(px-W/2)/c.z, y:c.y+(py-H/2)/c.z}; };
    const zoomAt=(px,py,f)=>{ const c=WEB.cam, a=toW(px,py); c.z=Math.max(.25,Math.min(3,c.z*f)); const b=toW(px,py); c.x+=a.x-b.x; c.y+=a.y-b.y; };
    cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.offsetX,y:e.offsetY}); moved=0; if(pts.size===2){ const [a,b]=[...pts.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y)}; } });
    cv.addEventListener('pointermove',e=>{ const p=pts.get(e.pointerId); if(!p) return; const dx=e.offsetX-p.x, dy=e.offsetY-p.y; p.x=e.offsetX; p.y=e.offsetY;
      if(pts.size>=2&&pinch){ const [a,b]=[...pts.values()], d=Math.hypot(a.x-b.x,a.y-b.y); zoomAt((a.x+b.x)/2,(a.y+b.y)/2,d/Math.max(1,pinch.d)); pinch.d=d; moved=99; }
      else { moved+=Math.abs(dx)+Math.abs(dy); WEB.cam.x-=dx/WEB.cam.z; WEB.cam.y-=dy/WEB.cam.z; } webDraw(); });
    const up=e=>{ const had=pts.has(e.pointerId); pts.delete(e.pointerId); if(pts.size<2) pinch=null; if(had&&moved<8&&!pts.size){ const w=toW(e.offsetX,e.offsetY); let hit=null; WG.nodes.forEach(n=>{ if(Math.hypot(n.x-w.x,n.y-w.y)<(n.kind==='p'?22:32)) hit=n.id; }); WEB.sel=hit===WEB.sel?null:hit; webDraw(); webCard(); } };
    cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
    cv.addEventListener('wheel',e=>{ e.preventDefault(); zoomAt(e.offsetX,e.offsetY,Math.exp(-e.deltaY*.0015)); webDraw(); },{passive:false});
    webDraw(); webCard(); }
  window.StrainWeb={select:id=>{ WEB.sel=id; const n=WG&&WG.nodes.get(id); if(n){ WEB.cam.x=n.x; WEB.cam.y=n.y; } webDraw(); webCard(); }, get sel(){ return WEB.sel; }};
  // Strain book
  PANELS.book=()=>{
    const st=G.st, n=Object.keys(st.discovered).length; tab=tab||'web';
    if(tab==='web') return {title:'Strain Book',sub:`${n}/${G.S.length} discovered · family web`,tabs:[['web','Web'],['list','List']],body:`${(()=>{ const P=G.breedProgress(); return `<div class="row" style="display:block"><h4>Breeding completion · ${P.pct}%</h4>${bar(P.pct/100,'amber')}<p>${P.found}/${P.mystery} mystery phenos bred · ${P.stable}/${P.mystery} lines stabilized to F${G.LINE.stable}+ · ${P.known}/${P.all} strains in your book</p></div>`; })()}<div id="webWrap"><canvas id="strainWeb"></canvas><div class="web-legend"><span><i style="background:#ffd35a"></i>Exclusive</span><span><i style="background:#9fd76a"></i>Pollen</span><span>? mystery</span><span>M kept mother</span></div></div><div id="webCard" class="row" style="display:block"></div>`};
    const cards=G.S.slice().sort((a,b)=>a.tier-b.tier||a.name.localeCompare(b.name)).map(s=>{ const d=st.discovered[s.id], hid=!d&&s.mystery;
      return `<button class="card ${d?'':'locked'}" data-a="strain" data-id="${s.id}"><img data-cu="${s.id}" data-sz="120" data-h="${hid?1:0}" alt="" style="width:100%;aspect-ratio:1;border-radius:12px;display:block;${d||hid?'':'filter:brightness(.35) saturate(.2)'}"><div class="nm">${hid?'???':esc(s.name)}</div><span class="tag t-${s.rarity}" style="font-size:12px">${s.rarity}</span>${st.recipes[s.id]?'<span class="tag" style="font-size:12px;background:#7a4ad0;color:#fff">Recipe</span>':''}</button>`; }).join('');
    return {title:'Strain Book',sub:`${n}/${G.S.length} discovered`,tabs:[['web','Web'],['list','List']],body:`<div class="grid">${cards}</div><div class="note">Strain notes are original game text. Fields marked ESTIMATE were not given a published figure. Close-ups are painted game art tinted from each strain's described look; no photos are shipped.</div>`};
  };
  function strainModal(id){
    const s=G.strain(id), st=G.st, d=st.discovered[id];
    if(!d&&s.mystery){ const hl=G.hintLevel(s); modal(`<img src="${R.closeup(s,200,true)}" style="width:180px;height:180px;border-radius:20px"><h3>??? ${tag(s)}</h3><p>A mystery pheno. Find it by crossbreeding in the Pheno Room.</p><p>${hl>=1?esc(G.vagueHint(s)):'No hint yet.'}</p>`,[{label:'Close',cls:'sec'}]); return; }
    const m=G.mastery(id), L=s.look||{};
    const html=`<img src="${R.closeup(s,220)}" style="width:200px;height:200px;border-radius:20px"><h3>${esc(s.name)}</h3><div>${tag(s)} <span class="chip">${s.type}</span></div>
      <dl class="kv" style="text-align:left"><dt>Recognition</dt><dd>${esc(s.recognition)}</dd>
      <dt>Lineage</dt><dd>${s.parents.length?s.parents.map(esc).join(' × '):'Landrace / unpublished'}</dd>${st.recipes[id]?`<dt>Your recipe</dt><dd>${esc(st.recipes[id].split('|').join(' × '))}</dd>`:''}
      <dt>THC / CBD</dt><dd>${s.thc==null?'THC not published (game estimate '+s.thcEstimate+'%)':s.thc+'%'} / ${s.cbd==null?'n/a':s.cbd+'%'}</dd>
      <dt>Terpenes</dt><dd>${s.terpenes.length?s.terpenes.join(', '):'Not published'}</dd><dt>Flavors</dt><dd>${s.flavors.join(', ')}</dd>
      <dt>Flowering</dt><dd>${s.floweringDays} days (${esc(s.floweringSource)})</dd><dt>Look</dt><dd>${esc(L.shape||'')} buds, frost ${Math.round((L.frost||0)*100)}% <small style="color:var(--mut)">(${esc(L.src||'ESTIMATE')})</small></dd>
      <dt>In game</dt><dd>${sec(s.game.growSec)} grow · ${s.game.buds} buds · ~${fmt(s.game.payout)}/plant · seed ${fmt(G.seedPrice(s))}</dd>${G.F.mastery?`<dt>Mastery</dt><dd>${m.n} harvests · x${m.m} price${m.next?' · next x'+m.nextM+' at '+m.next:''}</dd>`:''}</dl>
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
      if(q) body+=`<div class="row" style="display:block"><h4>${q.who?esc(q.who)+': ':''}${esc(q.t)}</h4><p>Reward: ${q.r.cash?fmt(q.r.cash):''}${q.r.gems?q.r.gems+' gems':''}${q.r.hints?q.r.hints+' hint token(s)':''}</p>${st.questDone?`<button class="btn gold" data-a="goal">Claim reward</button>`:''}</div>`;
      body+=`<div class="section-t">The road from garage to facility</div>`+G.QUESTS.map((x,i)=>`<div class="row ${i<st.quest?'ach-done':''}"><div class="grow"><p>${i<st.quest?'✅':i===st.quest?'👉':'⬜'} ${i<=st.quest+1?esc(x.t):'???'}</p></div></div>`).join('');
      const fs=G.festState(); if(fs){ const s=G.strain(fs.f.strain); body+=`<div class="section-t">🌺 Festival now: ${esc(fs.f.name)}</div><div class="row">${cu(s,96,!st.discovered[s.id])}<div class="grow"><h4>${esc(fs.f.desc)}</h4><p>Goal: ${fs.f.k==='harvests'?'harvest':'sell'} ${fs.f.goal} ${fs.f.k==='harvests'?'plants':'buds'} during the festival. Reward: exclusive <b>${esc(s.name)}</b> seeds + 25 gems.</p>${bar(fs.prog/fs.f.goal,'amber')}<p>${fs.prog}/${fs.f.goal} · ends ${new Date(fs.f.ends).toLocaleDateString([], {weekday:'long'})}</p></div>${fs.claimed?'<span class="chip">Done</span>':`<button class="btn sm gold" data-a="fest" ${fs.prog>=fs.f.goal?'':'disabled'}>Claim</button>`}</div>`; }
      else if(st.level>=G.GATE.events) body+=`<div class="note">Island festivals run Thursday to Sunday, rotating weekly: ${G.FESTS.map(f=>esc(f.name)).join(', ')}. Each has an exclusive strain.</div>`;
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
      body+=`<div class="section-t">Island Spirit tree · ${st.mana} to spend</div>`+Object.entries(G.MANA_UPG).map(([k,d])=>{ const l=G.mana(k), mx=l>=d.max, c=mx?0:G.manaCost(k); return `<div class="row"><div class="grow"><h4>${esc(d.name)} ${pips(l,d.max)}</h4><p>${esc(d.desc)}</p></div>${mx?'<span class="chip">MAX</span>':`<button class="btn sm gem" data-a="mana" data-k="${k}" ${st.mana<c?'disabled':''}>${c} spirit</button>`}</div>`; }).join('');
      body+=`<div class="note"><b>You keep:</b> strains, recipes, hints, clones, level, gems, packs, themes, perks, mastery, sets and reputation.<br><b>Resets:</b> cash, garage tables and buckets, land, greenhouse, indoor facility, upgrades, helpers, seeds and inventory.</div>`;
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
      body+=adsCard()+piggyCard()+`<div class="section-t">Boosts (1 hour each, they stack)</div>`+list(['boost_grow','boost_price','boost_pheno'])+rushCard()+`<div class="section-t">Extra manager</div>`+list(['mgr_slot','mgr_slot_g']);
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
      +`<div class="section-t">Sound</div>`+sl('vMusic','Music','Island soundtrack: ukulele, slack-key, reggae')+sl('vAmb','Ambience','Waves, wind, birds and night insects')+sl('vSfx','Sound effects','Harvest plucks, coins, steel-guitar level-ups')
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
      case 'plantall': { let n=0; st.plots.forEach(p=>{ if(p.loc===st.loc&&p.owned&&!p.strain&&st.seeds[st.selSeed]>0&&G.plant(p)) n++; }); if(!n) toast('No seeds left','bad'); break; }
      case 'load': G.loadDryer(); break;
      case 'sell': G.sell(d.stg,d.k); break;
      case 'sellgood': G.sellGood(d.k); break;
      case 'sellall': { let v=G.sellAll(); for(const k of Object.keys(st.goods)) v+=G.sellGood(k); if(v) toast('Sold for '+fmt(v),'good'); break; }
      case 'craft': if(G.startCraft(d.t,d.stg,d.k)){ Sound.play('plant'); toast(G.CRAFT[d.t].name+' started','good'); } break;
      case 'order': G.fillOrder(d.id); break;
      case 'serve': G.serveCust(d.id); break;
      case 'upg': if(G.buyUpg(d.k)){ Sound.play('buy'); toast(G.UPG[d.k].name+' upgraded!','good'); } break;
      case 'hire': if(G.hire(d.k)){ Sound.play('buy'); const who=G.WORKERS[d.k].name.split(',')[0]; toast(G.wk(d.k)===1?who+' joined the farm. One-time hire, no wages.':who+' trained. Still no wages.','good'); } break;
      case 'step': if(G.buyStep(d.k)){ Sound.play('buy'); } break;
      case 'land': if(G.buyLand()){ G.setLoc('farm'); close(); } break;
      case 'ghbuild': if(G.buildGH()){ close(); G.setLoc('farm'); } break;
      case 'permit': G.buyPermit(); break;
      case 'found': if(G.buyFoundation()){ Sound.play('buy'); Haptics.medium(); } break;
      case 'buildin': if(G.buildIndoor()){ close(); G.setLoc('indoor'); } break;
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
      case 'openweb': open('book','web'); break;
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
        const crew=save.workers&&typeof save.workers==='object'?Object.keys(save.workers).filter(k=>save.workers[k]>0).length:0;
        const ok=await modal(`<h3>Replace this farm?</h3><p>The backup becomes the farm on this device: level ${Math.floor(save.level||1)}, ${esc(G.fmt(typeof save.cash==='number'?save.cash:0))}${crew?', '+crew+' hired helper'+(crew===1?'':'s'):''}. Store purchases on this device stay.</p>`,[{label:'Cancel',cls:'sec',v:false},{label:'Replace farm',cls:'pink',v:true}]);
        if(!ok) break;
        const r=G.installBackup(save); if(!r.ok){ toast(r.error||'Could not store that backup','bad long'); break; }
        saveUi=null; importDraft=''; exportPack=null; R.rebuild(); close(); toast('Farm restored','good'); break; }
    }
    G.save(); render();
  }
  function showPack(list){ Sound.play('discover');
    modal(`<h3>Seed pack opened!</h3><div class="grid" style="margin-top:10px">${list.map(s=>`<div class="card"><img src="${R.closeup(s,96)}" style="width:100%;border-radius:12px"><div class="nm">${esc(s.name)}</div><span class="tag t-${s.rarity}" style="font-size:12px">${s.rarity}</span></div>`).join('')}</div>`,[{label:'Thanks!',cls:'gold'}]); }
  // story dialogue (Unko Kuli teaches the trade) - shown when a new goal starts
  const QUICK={plant:'Tap the seed bag, then a bucket',water:'Tap your plant to water it',harvest:'Ripe! Tap to harvest',dry:'Open Dry & Cure to dry your buds',sell:'Open Market to sell'};
  function storyLine(q){ if(!q||!G.F.storyGoals) return; if(window.Tutorial&&Tutorial.active&&Tutorial.active()) return; if(QUICK[q.id]&&G.st.quest<=4){ toast('👆 '+QUICK[q.id],'good'); return; } const who=q.who||'Unko Kuli'; const c=window.CHARACTERS[who];
    modal(`<div class="dlg">${portraitImg(who,'dport')}<div><b>${esc(who)}</b><p>${esc((window.STORY_SAY&&window.STORY_SAY[q.id])||q.t)}</p></div></div>`,[{label:'Got it!',cls:'gold'}]); }
  // ---------- wiring ----------
  function init(){
    document.title=T(); $('#gTitle').textContent=T(); $('#gTag').textContent=window.GAME_CONFIG.tagline;
    $$('#menu button').forEach(b=>b.onclick=()=>open(b.dataset.panel));
    $('#upgBtn').onclick=()=>{ Sound.play('tap'); open('upgrades'); };
    $('#orderBoard').onclick=()=>{ Sound.play('tap'); if(G.st.level<G.GATE.orders){ toast('The order board opens at level '+G.GATE.orders+'. Keep growing!'); return; } open('stand','orders'); };
    $('#sheetBody').addEventListener('click',e=>{ const r=e.target.closest('[data-pickseed]'); if(!r||e.target.closest('button,a,input')) return; const id=r.dataset.pickseed; if(!(G.st.seeds[id]>0)){ toast('Buy a seed first, then tap the card to pick it'); return; } if(G.st.selSeed!==id){ G.st.selSeed=id; Sound.play('tap'); seedBag(); render(); toast('Tap empty buckets or beds to plant '+G.strain(id).name); } });
    $('#seedBag').onclick=e=>{ e.stopPropagation(); Sound.play('tap'); seedPick(); };
    $('#seedPick').onclick=e=>{ e.stopPropagation(); const b=e.target.closest('[data-pick]'); if(!b) return; $('#seedPick').classList.add('hidden'); if(b.dataset.pick==='__shop'){ open('seeds'); return; } G.st.selSeed=b.dataset.pick; setTool('seed'); seedBag(); Sound.play('tap'); toast('Tap empty buckets or beds to plant '+G.strain(b.dataset.pick).name); };
    document.addEventListener('pointerdown',e=>{ if(!e.target.closest('#seedPick,#seedBag')) $('#seedPick').classList.add('hidden'); });
    $('#locTabs').addEventListener('click',e=>{ if(e.target.closest('[data-stand]')){ Sound.play('tap'); open('stand'); return; } const b=e.target.closest('[data-loc]'); if(b) tapLoc(b.dataset.loc); });
    $('#shopBtn').onclick=()=>open('shop'); $('#multBadge').onclick=()=>open('quests','season'); $('#gemPill').onclick=()=>open('shop'); $('#settingsBtn').onclick=()=>open('settings');
    $('#sheetClose').onclick=close; $('#sheet').addEventListener('click',e=>{ if(e.target.id==='sheet') close(); });
    $('#sheetTabs').addEventListener('click',e=>{ const b=e.target.closest('button[data-tab]'); if(b){ tab=b.dataset.tab; render(true); Sound.play('tap'); } });
    const del=e=>{ const b=e.target.closest('[data-a]'); if(!b||b.disabled) return; act(b.dataset.a,b.dataset); };
    $('#sheetBody').addEventListener('input',e=>{ const ta=e.target.closest('textarea[data-savecode="in"]'); if(ta){ importDraft=ta.value; return; } const i=e.target.closest('input[data-vol]'); if(!i) return; G.st.settings[i.dataset.vol]=+i.value; if(window.applySettings) applySettings(); syncVol($('#sheetBody')); if(i.dataset.vol==='vSfx') Sound.play('coin'); });
    $('#sheetBody').addEventListener('click',del); $('#sheetFoot').addEventListener('click',del);
    $('#sheetBody').addEventListener('change',e=>{ const s=e.target.closest('select[data-sel]'); if(s){ (s.dataset.sel==='A'?labA:s.dataset.sel==='H'?huntSel:labB).v=s.value; render(); return; } const f=e.target.closest('input[data-savefile]'); if(!f||!f.files||!f.files[0]) return; f.files[0].text().then(t=>{ importDraft=t; saveUi='import'; render(); toast('Backup file loaded. Review it, then tap Restore.','good'); }).catch(()=>toast('Could not read that file','bad')); });
    $('#sheet').addEventListener('pointerdown',()=>lastPointer=performance.now(),true);
    $('#pop').addEventListener('click',e=>{ const b=e.target.closest('[data-pa]'); if(!b||!popPlot) return; if(b.dataset.pa==='treat'){ if(!G.treat(popPlot)) toast('Not enough cash','bad'); } else if(b.dataset.pa==='prune') G.prune(popPlot); else if(b.dataset.pa==='top'||b.dataset.pa==='lst') G.train(popPlot,b.dataset.pa); else if(b.dataset.pa==='trellis'){ if(!G.trellis(popPlot)) toast('Not enough cash','bad'); } else if(b.dataset.pa==='water') G.water(popPlot); else if(!G.feed(popPlot)) toast(popPlot.food>0?'Already fed this grow':'Feed opens at halfway','bad'); renderPop(); });
    $('#goal').onclick=()=>{ const g=$('#goal'); if(!g.classList.contains('open')){ goalPeek(5000); return; } if(G.st.questDone){ if(G.claimQuest()) Sound.play('level'); } else open('quests','story'); };
    document.addEventListener('click',e=>{ const b=e.target.closest('[data-buylab]'); if(!b) return; if(!G.buyLab()) toast(G.st.inBuilt?'Not enough cash':'Build the indoor facility first','bad'); else render(true); });
    $('#scoutBtn').onclick=()=>{ const on=!R.lens.on; R.setLens(on,innerWidth/2,innerHeight*.45); $('#scoutBtn').classList.toggle('on',on); hidePop(); toast(on?'Inspect: drag the lens over plants. Tap to remove any eggs or spores you find.':'Scouting off'); };
    $('#harvestAll').onclick=()=>{ let n=0; G.st.plots.forEach(p=>{ if(p.loc===G.st.loc&&p.strain&&p.prog>=1&&G.harvest(p)) n++; }); if(!n) toast('Nothing ripe here yet'); };
    $('#waterAll').onclick=()=>{ if(G.lv('water')<1){ toast('Water all needs a garden hose','bad'); open('upgrades','lines'); return; } let n=0; G.st.plots.forEach(p=>{ if(p.loc===G.st.loc&&p.strain&&p.prog<1&&p.water<.95){ G.water(p); n++; } }); if(!n) toast('Everything here is watered'); };
    $('#feedAll').onclick=()=>{ let n=0; G.st.plots.forEach(p=>{ if(p.loc===G.st.loc&&G.isHungry(p)&&G.feed(p,true)) n++; }); toast(n?'Fed '+n+' plants':'Nobody needs a feed yet'); };
    window.Payments.setConfirmUI(p=>modal(`${art(p.art)}<h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p>${oddsForProduct(p)}<div class="big-n">${window.Payments.formatUSD(p.priceUSD)}</div><div class="testbanner">TEST MODE: you will not be charged. This grants the item locally.</div>`,[{label:'Cancel',cls:'sec',v:false},{label:'Buy (test)',cls:'pink',v:true}]));
  }
  let acc=0;
  function update(dt){ hud(dt); acc+=dt; if(acc>.5){ acc=0; if(panel&&performance.now()-lastPointer>700&&!document.activeElement?.matches('select')) render(); if(popPlot) renderPop(); } }
  return {init,update,toast,modal,celebrate,levelUp,loginCel,confetti,open,close,tapPlot,quick,hidePop,setTool,strainModal,bigCel,reveal,storyLine,landModal,indoorModal,get tool(){return tool},get panel(){return panel},render};
})();
