/* Juice: tiny easing + tween library, tiered haptics, trauma screen shake (Eiserloh GDC16), button press bounce,
   and a single "gain lane" so floating +$ numbers never overlap the HUD or each other. See QUALITY_GUIDE.md. */
window.Ease={
  linear:t=>t, inQuad:t=>t*t, outQuad:t=>t*(2-t), outCubic:t=>1-Math.pow(1-t,3), inOutCubic:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  outBack:(t,s=1.70158)=>1+(s+1)*Math.pow(t-1,3)+s*Math.pow(t-1,2),
  outElastic:t=>t===0||t===1?t:Math.pow(2,-10*t)*Math.sin((t*10-.75)*(2*Math.PI)/3)+1,
};
window.Tween=(function(){ const L=[]; let raf=0;
  function step(now){ for(let i=L.length-1;i>=0;i--){ const w=L[i], k=Math.min(1,(now-w.t0)/w.dur); w.fn(w.from+(w.to-w.from)*w.ease(k),k); if(k>=1){ L.splice(i,1); w.done&&w.done(); } } raf=L.length?requestAnimationFrame(step):0; }
  function to(o){ const w={from:o.from||0,to:o.to==null?1:o.to,dur:o.dur||300,ease:o.ease||Ease.outCubic,fn:o.fn,done:o.done,t0:performance.now(),key:o.key};
    if(w.key){ const j=L.findIndex(x=>x.key===w.key); if(j>=0) L.splice(j,1); } L.push(w); if(!raf) raf=requestAnimationFrame(step); return w; }
  return {to};
})();
window.Haptics=(function(){
  const on=()=>{ try{ return !window.G||!G.st||G.st.settings.vib!==false; }catch(e){ return true; } };
  const P={light:8, medium:18, heavy:[20,40,30], success:[12,50,24]};
  function play(k){ if(!on()) return; try{ const H=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.Haptics;
    if(H){ if(k==='success') H.notification({type:'SUCCESS'}); else H.impact({style:k==='heavy'?'HEAVY':k==='medium'?'MEDIUM':'LIGHT'}); return; }
    if(navigator.vibrate&&(!navigator.userActivation||navigator.userActivation.hasBeenActive)) navigator.vibrate(P[k]||P.light); /* QC: no pre-gesture vibrate (Chrome console error) */ }catch(e){} }
  return {light:()=>play('light'),medium:()=>play('medium'),heavy:()=>play('heavy'),success:()=>play('success'),play};
})();
// trauma shake: add 0..1, decays linearly, offset = trauma^2. Moves the canvas element only (never the HUD).
window.Shake=(function(){ let tr=0, raf=0, last=0, seed=Math.random()*100;
  const on=()=>{ try{ return G.st.settings.shake!==false&&G.st.settings.motion!==false; }catch(e){ return true; } };
  const n=(x)=>Math.sin(x*12.9898)*.5+Math.sin(x*4.1414+1.3)*.5;   // smooth pseudo-noise
  function step(now){ const dt=Math.min(.05,(now-last)/1000); last=now; tr=Math.max(0,tr-dt*1.6); const c=document.getElementById('game'); const s=tr*tr, t=now/1000*14+seed;
    if(c) c.style.transform=s>0.001?`translate(${(n(t)*7*s).toFixed(2)}px,${(n(t+50)*7*s).toFixed(2)}px) rotate(${(n(t+99)*.6*s).toFixed(3)}deg)`:'';
    raf=tr>0?requestAnimationFrame(step):0; }
  function add(a){ if(!on()) return; tr=Math.min(1,tr+a); if(!raf){ last=performance.now(); raf=requestAnimationFrame(step); } }
  return {add};
})();
// Gain lane: one column of "+$" chips just under the HUD stack. Max 3 visible, newest at top, older slide down & fade. No overlaps.
window.GainLane=(function(){ let lane=null; const items=[];
  function top(){ let y=0; for(const id of ['cashPill','lvlBox','goal','orderBoard']){ const e=document.getElementById(id); if(!e) continue; const r=e.getBoundingClientRect(); if(r.height&&getComputedStyle(e).display!=='none'&&r.bottom<innerHeight*.45&&(id!=='orderBoard'||innerHeight>innerWidth)) y=Math.max(y,r.bottom); } return y+6; }
  function ensure(){ if(lane&&lane.isConnected) return lane; lane=document.createElement('div'); lane.id='gainLane'; document.body.appendChild(lane); return lane; }
  function push(text,hot){ const l=ensure(); l.style.top=top()+'px'; const cp=document.getElementById('cashPill'); if(cp){ const r=cp.getBoundingClientRect(); let cl=0; for(const id of ['seedBag','scoutBtn','upgBtn']){ const e=document.getElementById(id); if(e&&e.getClientRects().length){ const q=e.getBoundingClientRect(); if(q.width) cl=Math.max(cl,q.right); } } l.style.left=Math.max(80,r.left+r.width/2,cl?cl+80:0)+'px'; }
    const last=items[0]; if(last&&!last.gone&&performance.now()-last.t<350){ last.el.textContent=text; last.el.classList.toggle('hot',!!hot); last.t=performance.now(); return; }
    const d=document.createElement('div'); d.className='gchip'+(hot?' hot':''); d.textContent=text; l.prepend(d); const it={el:d,t:performance.now()}; items.unshift(it);
    Tween.to({dur:420,ease:Ease.outBack,fn:v=>{ d.style.transform=`scale(${.6+.4*v})`; d.style.opacity=Math.min(1,v*1.6); }});
    while(items.length>1){ const o=items.pop(); o.gone=1; o.el.remove(); }
    setTimeout(()=>{ it.gone=1; d.classList.add('out'); setTimeout(()=>{ d.remove(); const i=items.indexOf(it); if(i>=0) items.splice(i,1); },260); },1300); }
  return {push,top};
})();
// Button press bounce (pointer-first, <100 ms feedback) on every .btn / tab / tool button.
(function(){ const SEL='.btn,.loctab,.tool,.qbtn,#menu button,.pill,.side-btn,#seedBag,#scoutBtn,#upgBtn,#orderBoard,.pbtn';
  document.addEventListener('pointerdown',e=>{ const b=e.target.closest&&e.target.closest(SEL); if(!b||b.disabled) return; b.classList.remove('jpop'); b.classList.add('jdown'); },{passive:true});
  const up=e=>{ document.querySelectorAll('.jdown').forEach(b=>{ b.classList.remove('jdown'); void b.offsetWidth; b.classList.add('jpop'); setTimeout(()=>b.classList.remove('jpop'),360); }); };
  document.addEventListener('pointerup',up,{passive:true}); document.addEventListener('pointercancel',up,{passive:true});
})();

// Guided first minute: a painted-style pointing hand over the DOM button the current early goal needs (dry -> Dry & Cure, sell -> Market).
// The in-room steps (plant/water/harvest) are pointed at by scene.js guide().
window.FirstGuide=(function(){ let hand=null;
  function tick(){ try{ const st=G.st, q=G.curQuest&&G.curQuest(); let el=null;
    const busy=!document.getElementById('modal').classList.contains('hidden')||!document.getElementById('celebrate').classList.contains('hidden')||document.getElementById('splash');
    const tut=window.Tutorial&&Tutorial.active&&Tutorial.active();
    if(tut&&!busy){ el=Tutorial.targetEl?Tutorial.targetEl():null; }
    else if(q&&st.quest<=4&&!busy){
      const open=document.body.classList.contains('sheet-open');
      if(st.questDone) el=document.getElementById('goal');
      else if(q.id==='plant'&&!st.selSeed) el=document.getElementById('seedBag');
      else if(q.id==='dry'&&!open) el=document.querySelector('#menu [data-panel="process"]');
      else if(q.id==='sell'&&!open) el=document.querySelector('#menu [data-panel="market"]'); }
    if(!el){ if(hand) hand.style.display='none'; return; }
    if(!hand){ hand=document.createElement('div'); hand.id='fgHand'; hand.textContent='\u{1F446}'; document.body.appendChild(hand); }
    const r=el.getBoundingClientRect(); hand.style.display='block'; hand.style.left=(r.left+r.width/2)+'px'; hand.style.top=(r.top+(r.top>innerHeight*.6?-6:r.height+4))+'px'; hand.classList.toggle('up',r.top>innerHeight*.6);
  }catch(e){} }
  setInterval(tick,250); return {tick};
})();
