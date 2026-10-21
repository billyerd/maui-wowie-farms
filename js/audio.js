/* Procedural island soundtrack + ambience + SFX, all synthesized with Web Audio (no audio files, 0 bytes of music).
   Two music beds. The Garage and the Greenhouse share one, so moving between them
   does not restart the bar. The Indoor Facility (and the sealed benches) have their own.
   Switching beds crossfades. Night, when the clock is actually night, replaces only the shared bed.
     garage = chill ukulele strum (re-entrant GCEA voicings, C-Am-F-G7), soft bass, shaker
     indoor = uppity indoor bounce (126 bpm, bright C-G-Am-F, hopped bass, offbeat chops)
     night  = gentle ukulele fingerpicking (C-Em-Am-F, slow, sparse)
     farm   = sunny slack-key, kept in the instrument rack and not selected by a room
   Ambience: ocean waves, trade wind, birds by day, crickets/insects at night, fan hum indoors.
   Strings are Karplus-Strong plucks; steel guitar = gliding filtered saw/triangle with vibrato. */
window.Sound = (function(){
  let ctx=null, master, comp, musicBus, sfxGain, ambBus, started=false, timer=null, noiseBuf=null;
  const vol={music:.7, sfx:.8, amb:.6}; let musicOn=true, sfxOn=true, ambOn=true, paused=false;
  let scene='garage', night=false, style='garage', roomId='garage', bedGen=0, bedStyle=null, styles={}, nextBar=0, bar=0, amb=null, ambT=0;
  const ksCache={}; const mtof=m=>440*Math.pow(2,(m-69)/12);
  function dropCtx(){
    try{ if(timer) clearInterval(timer); }catch(e){}
    ctx=null; started=false; timer=null; styles={}; amb=null; master=null; comp=null; musicBus=null; sfxGain=null; ambBus=null; noiseBuf=null;
  }
  function init(){
    if(ctx&&ctx.state==='closed') dropCtx();
    if(ctx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    ctx=new AC(); master=ctx.createGain(); master.gain.value=.85; master.connect(ctx.destination);
    comp=ctx.createDynamicsCompressor(); comp.threshold.value=-18; comp.ratio.value=3; comp.connect(master);
    musicBus=ctx.createGain(); musicBus.connect(comp); sfxGain=ctx.createGain(); sfxGain.connect(comp); ambBus=ctx.createGain(); ambBus.connect(comp);
    // gentle "room" for the music: short feedback delay
    const d=ctx.createDelay(); d.delayTime.value=.19; const fb=ctx.createGain(); fb.gain.value=.22; const wet=ctx.createGain(); wet.gain.value=.18; const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2400;
    musicBus.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(comp);
    for(const k of ['garage','farm','indoor','night']){ const g=ctx.createGain(); g.gain.value=0; g.connect(musicBus); styles[k]=g; }
    const n=ctx.sampleRate*3; noiseBuf=ctx.createBuffer(1,n,ctx.sampleRate); const nd=noiseBuf.getChannelData(0); let b=0; for(let i=0;i<n;i++){ const w=Math.random()*2-1; b=(b+.02*w)/1.02; nd[i]=w*.6+b*3; }
    applyVol();
  }
  function applyVol(){ if(!ctx) return; const t=ctx.currentTime;
    musicBus.gain.setTargetAtTime(musicOn&&!paused?.32*vol.music:0,t,.2); sfxGain.gain.setTargetAtTime(sfxOn?.6*vol.sfx:0,t,.05); ambBus.gain.setTargetAtTime(ambOn&&!paused?.5*vol.amb:0,t,.4); }
  function unlockIOS(){ try{ const b=ctx.createBuffer(1,1,22050), s=ctx.createBufferSource(); s.buffer=b; s.connect(ctx.destination); s.start(0); }catch(e){} }
  /* QC iOS: Safari can leave the context 'suspended'/'interrupted' (first load, call, app switch); re-resume inside every user gesture */
  function resume(){ try{ init(); if(!ctx) return; unlockIOS(); if(ctx.state==='closed'){ dropCtx(); init(); if(!ctx) return; } if(ctx.state!=='running'){ const p=ctx.resume(); if(p&&p.catch) p.catch(function(){}); } if(!started){ started=true; nextBar=ctx.currentTime+.15; setStyle(pick(),true); startAmb(); timer=setInterval(sched,180); } else if(!(nextBar>0)||nextBar<ctx.currentTime-.35) nextBar=ctx.currentTime+.08; }catch(e){} }
  ['touchend','pointerdown','click','keydown'].forEach(ev=>document.addEventListener(ev,()=>{ if(!paused) resume(); },{capture:true,passive:true}));
  function wake(){ if(document.hidden||paused) return; resume(); }
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) wake(); });
  window.addEventListener('pageshow',()=>wake());
  window.addEventListener('focus',()=>wake());
  // ---------- instruments ----------
  function ksBuf(f,decay,bright){ const key=Math.round(f*10)+'|'+decay+'|'+bright; let buf=ksCache[key]; if(buf) return buf;
    const sr=ctx.sampleRate, n=Math.floor(sr*(decay>.995?2.4:1.4)), N=Math.max(2,Math.round(sr/f)); buf=ctx.createBuffer(1,n,sr); const d=buf.getChannelData(0);
    const ring=new Float32Array(N); let lp=0; for(let i=0;i<N;i++){ const w=Math.random()*2-1; lp=lp+(w-lp)*bright; ring[i]=lp; }
    let p=0; for(let i=0;i<n;i++){ const nx=(p+1)%N, v=ring[p]; d[i]=v; ring[p]=decay*.5*(v+ring[nx]); p=nx; } ksCache[key]=buf; return buf; }
  let jit=0; function pluck(m,t,v,dest,o){ o=o||{}; const s=ctx.createBufferSource(); s.buffer=ksBuf(mtof(m+(dest===sfxGain?jit:0)),o.decay||.996,o.bright||.6); const g=ctx.createGain(); g.gain.value=v;
    const fl=ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=o.cut||3000; s.connect(fl); fl.connect(g); g.connect(dest); s.start(t); if(o.dur) s.stop(t+o.dur); }
  const uke=(m,t,v,dest)=>pluck(m,t,v,dest,{decay:.991,bright:.75,cut:4200});            // short, bright nylon
  const guitar=(m,t,v,dest)=>pluck(m,t,v,dest,{decay:.996,bright:.55,cut:3000});         // steel-string slack-key
  function strum(ch,t,v,dest,up,spread){ const n=up?[...ch].reverse():ch; n.forEach((m,i)=>uke(m,t+i*(spread||.014),v*(i===0?1:.85),dest)); }
  function tone(f,t,dur,type,v,dest,att,cut,f2){ if(!isFinite(f)||!isFinite(t)||!isFinite(v)||!isFinite(dur)||(f2!=null&&!isFinite(f2))){ (window.__toneBad=window.__toneBad||[]).push([f,t,dur,v,f2,new Error().stack.split('\n').slice(2,4).join('|')]); return; } const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+dur*.8);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+(att||.01)); g.gain.exponentialRampToValueAtTime(.0001,t+dur); let n=o;
    if(cut){ const fl=ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=cut; o.connect(fl); n=fl; } n.connect(g); g.connect(dest); o.start(t); o.stop(t+dur+.05); }
  function bass(m,t,dur,v,dest){ tone(mtof(m),t,dur,'triangle',v,dest,.015,420); tone(mtof(m),t,dur*.9,'sine',v*.8,dest,.01); }
  function noise(t,dur,v,dest,type,f,q){ const s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true; s.loopStart=Math.random()*2; const fl=ctx.createBiquadFilter(); fl.type=type||'highpass'; fl.frequency.value=f||6000; if(q) fl.Q.value=q;
    const g=ctx.createGain(); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t,Math.random()*2); s.stop(t+dur+.02); }
  // steel / lap-steel slide: glide between notes with delayed vibrato
  function steel(notes,t,v,dest,step){ step=step||.35; const o=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain(), fl=ctx.createBiquadFilter(), lfo=ctx.createOscillator(), lg=ctx.createGain();
    o.type='sawtooth'; o2.type='triangle'; fl.type='lowpass'; fl.frequency.value=1700; fl.Q.value=2; lfo.frequency.value=5.2; lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(6,t+notes.length*step);
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    notes.forEach((m,i)=>{ const f=mtof(m), tt=t+i*step; if(i===0){ o.frequency.setValueAtTime(f*.94,tt); o2.frequency.setValueAtTime(f*.94,tt); } o.frequency.exponentialRampToValueAtTime(f,tt+.09); o2.frequency.exponentialRampToValueAtTime(f,tt+.09); });
    const end=t+notes.length*step+.6; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.05); g.gain.setValueAtTime(v*.8,end-.7); g.gain.exponentialRampToValueAtTime(.0001,end);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(dest); [o,o2,lfo].forEach(x=>{ x.start(t); x.stop(end+.05); }); }
  // ---------- styles ----------
  const PENT=[60,62,64,67,69,72,74,76,79];
  const STY={
    garage:{bpm:84, play(t,b,B,dest){ // chill ukulele
      const P=[[67,60,64,72],[69,60,64,69],[69,60,65,69],[67,62,65,71]], R=[48,45,41,43], ch=P[b%4];
      // island strum: D . D U . U D U
      [[0,0],[1,0],[1.5,1],[2.5,1],[3,0],[3.5,1]].forEach(([k,up])=>strum(ch,t+k*B,(k===0?.12:.08),dest,up));
      bass(R[b%4],t,B*1.6,.16,dest); bass(R[b%4]+7,t+2*B,B*1.4,.12,dest);
      for(let i=0;i<8;i++) noise(t+i*B/2+(i%2?B*.06:0),.05,i%2?.018:.01,dest,'highpass',7000);
      if(b%4===3){ [72,74,76,79].forEach((m,i)=>uke(m,t+B*(2+i*.5),.07,dest)); } }},
    farm:{bpm:92, play(t,b,B,dest){ // sunny slack-key
      const C=[[55,59,62,67],[55,60,64,67],[54,57,62,66],[55,59,62,71]], ch=C[b%4];
      for(let i=0;i<4;i++) guitar(i%2?ch[0]-12:43,t+i*B,.2,dest);
      const pat=[3,1,2,1,3,2,1,2]; for(let i=0;i<8;i++){ if(i===5&&b%2) continue; guitar(ch[pat[i]]+(i===6&&b%4===3?2:0),t+Math.floor(i/2)*B+(i%2?B*.58:0),.1,dest); }
      tone(90,t,.25,'sine',.12,dest,.005); tone(90,t+2*B,.25,'sine',.1,dest,.005); tone(140,t+3.5*B,.12,'sine',.05,dest,.005);
      if(b%8===3) steel([74,76,79,76,74],t+B*.5,.045,dest,B*.5); if(b%8===7) steel([71,74,79],t+B,.045,dest,B*.6); }},
    indoor:{bpm:126, play(t,b,B,dest){ // uppity indoor bounce: bright, hopped, faster than the yard
      const loop=[
        {ch:[60,64,67,72], root:48, mel:[72,76,79,76]}, // C
        {ch:[55,59,62,67], root:43, mel:[74,79,78,74]}, // G
        {ch:[57,60,64,69], root:45, mel:[76,72,69,72]}, // Am
        {ch:[53,57,60,65], root:41, mel:[72,69,67,65]}, // F
      ], p=loop[b%4];
      tone(64,t,.09,'sine',.2,dest,.002,0,46); tone(70,t+1.5*B,.05,'sine',.07,dest,.002,0,50); tone(62,t+2*B,.08,'sine',.14,dest,.002,0,44);
      noise(t+B,.05,.055,dest,'bandpass',2200,.8); noise(t+3*B,.05,.05,dest,'bandpass',2400,.8);
      for(let i=0;i<8;i++) noise(t+i*B/2,.025,i%2?.03:.012,dest,'highpass',9500);
      [0.5,1.5,2.5,3.5].forEach((k,i)=>strum(p.ch,t+k*B,i===0?.1:.075,dest,false,.009));
      bass(p.root,t,B*.35,.17,dest); bass(p.root+7,t+.75*B,B*.28,.11,dest); bass(p.root+12,t+2*B,B*.32,.13,dest); bass(p.root+7,t+2.75*B,B*.25,.1,dest);
      if(b%2===1) p.mel.forEach((m,i)=>uke(m+12,t+B*(2+i*.5),.05,dest));
      if(b%4===0) tone(1568,t,.18,'sine',.03,dest,.004); }},
    night:{bpm:66, play(t,b,B,dest){ // gentle ukulele
      const P=[[60,64,67,72],[59,64,67,71],[57,64,69,72],[57,60,65,69]], ch=P[b%4];
      [0,2,1,3,2,1,3,2].forEach((k,i)=>{ if(b%2&&i===7) return; uke(ch[k],t+i*B/2,.07,dest); });
      bass([48,52,45,41][b%4],t,B*3,.08,dest);
      if(b%4===1) uke(PENT[4+(b%3)]+12,t+B*3.5,.04,dest); }},
  };
  // Garage and greenhouse share the yard bed. Indoor rooms share the indoor bed.
  // Night replaces only the yard bed, so those two rooms still match after dark.
  function musicBed(r, isNight){
    if(r==='facility'||r==='benches'||r==='indoor') return 'indoor';
    if(isNight) return 'night';
    return 'garage';
  }
  function resolveRoom(r){
    if(r==='garage'||r==='gh'||r==='facility'||r==='benches') return r;
    try{ if(typeof G!=='undefined'&&G.currentRoom){ const cr=G.currentRoom(); if(cr==='garage'||cr==='gh'||cr==='facility'||cr==='benches') return cr; } }catch(e){}
    if(r==='indoor') return 'facility';
    return 'garage';
  }
  function ambKey(r){ return (r==='facility'||r==='benches'||r==='indoor')?'indoor':r==='gh'?'farm':'garage'; }
  function pick(){ return musicBed(roomId, night); }
  function setStyle(s,now){ if(!ctx||!STY[s]) return; const changed=s!==bedStyle; if(!changed&&!now) return; const t=ctx.currentTime;
    for(const k in styles) styles[k].gain.setTargetAtTime(k===s?1:0,t,now?.05:.7); style=s; if(changed){ bedStyle=s; bedGen++; } }
  function sched(){
    try{
      if(!ctx||paused) return;
      if(ctx.state==='closed'){ resume(); return; }
      if(ctx.state!=='running') return;
      const s=STY[style]; if(!s) return; const B=60/s.bpm;
      if(!(nextBar>0)||nextBar<ctx.currentTime-.4) nextBar=ctx.currentTime+.05;
      while(nextBar<ctx.currentTime+1.0){ if(musicOn&&vol.music>0) s.play(nextBar,bar,B,styles[style]); nextBar+=B*4; bar++; }
      ambTick();
    }catch(e){}
  }
  // ---------- ambience ----------
  function loopNoise(type,f,q,v){ const s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true; const fl=ctx.createBiquadFilter(); fl.type=type; fl.frequency.value=f; if(q) fl.Q.value=q; const g=ctx.createGain(); g.gain.value=v; s.connect(fl); fl.connect(g); g.connect(ambBus); s.start(); return {g,fl}; }
  function startAmb(){ amb={waves:loopNoise('lowpass',520,.7,0), wind:loopNoise('bandpass',700,.6,0), hum:loopNoise('lowpass',160,1,0), hiss:loopNoise('highpass',5200,0,0)}; ambT=0; }
  const AMB={garage:{waves:.10,wind:.04,hum:.02,birds:.25,bugs:.3},farm:{waves:.22,wind:.09,hum:0,birds:1,bugs:1},indoor:{waves:0,wind:0,hum:.12,birds:0,bugs:0}};
  let nextSwell=0, nextBird=0, nextBug=0;
  function ambTick(){ if(!amb) return; const t=ctx.currentTime, A=AMB[scene]||AMB.farm;
    if(t>nextSwell){ const per=5+Math.random()*4; amb.waves.g.gain.cancelScheduledValues(t); amb.waves.g.gain.setTargetAtTime(A.waves*(.5+Math.random()*.6),t,per*.3); amb.waves.g.gain.setTargetAtTime(A.waves*.25,t+per*.55,per*.25);
      amb.waves.fl.frequency.setTargetAtTime(380+Math.random()*400,t,per*.3); amb.wind.g.gain.setTargetAtTime(A.wind*(.4+Math.random()*.8),t,2.5); amb.wind.fl.frequency.setTargetAtTime(450+Math.random()*700,t,3);
      amb.hum.g.gain.setTargetAtTime(A.hum,t,1); amb.hiss.g.gain.setTargetAtTime(night?.006*A.bugs:0,t,2); nextSwell=t+per; }
    if(!night&&A.birds>0&&t>nextBird){ bird(t+Math.random()*.5,A.birds); nextBird=t+2+Math.random()*6; }
    if(night&&A.bugs>0&&t>nextBug){ cricket(t+Math.random()*.3,A.bugs); nextBug=t+.6+Math.random()*1.4; }
  }
  function bird(t,k){ const base=2200+Math.random()*1800, n=2+Math.floor(Math.random()*4), kind=Math.random();
    for(let i=0;i<n;i++){ const tt=t+i*(.09+Math.random()*.06); if(kind<.5) tone(base,tt,.08,'sine',.035*k,ambBus,.005,0,base*1.35); else tone(base*1.2,tt,.1,'sine',.03*k,ambBus,.005,0,base*.8); } }
  function cricket(t,k){ const f=4300+Math.random()*500; for(let i=0;i<3+Math.floor(Math.random()*3);i++) tone(f,t+i*.045,.03,'sine',.018*k,ambBus,.003); }
  // ---------- SFX (island flavoured) ----------
  const S={
    tap(){ uke(84,ctx.currentTime,.06,sfxGain); },
    plant(){ const t=ctx.currentTime; tone(160,t,.12,'sine',.25,sfxGain,.004,0,90); noise(t,.1,.08,sfxGain,'bandpass',900,1); uke(72,t+.05,.09,sfxGain); },
    water(){ const t=ctx.currentTime; for(let i=0;i<6;i++) tone(700+Math.random()*900,t+i*.035,.07,'sine',.06,sfxGain,.003,0,1600+Math.random()*600); noise(t,.3,.05,sfxGain,'bandpass',2500,1); },
    feed(){ const t=ctx.currentTime; noise(t,.2,.1,sfxGain,'bandpass',700,1.2); tone(220,t,.15,'triangle',.1,sfxGain); },
    harvest(){ const t=ctx.currentTime, r=[0,4,7,12][Math.floor(Math.random()*4)]; [72,76,79,84].forEach((m,i)=>uke(m+r-(r>7?12:0),t+i*.055,.14,sfxGain)); noise(t,.12,.06,sfxGain,'highpass',4000); },   // ukulele pluck run
    coin(){ const t=ctx.currentTime; uke(88,t,.08,sfxGain); tone(2093,t+.05,.18,'sine',.05,sfxGain,.003); },
    cash(k){ k=Math.min(7,k|0); const t=ctx.currentTime; strum([67,72,76,79].map(n=>n+k),t,.12,sfxGain,false,.025); tone(2637*Math.pow(2,k/12),t+.12,.25,'sine',.04,sfxGain); if(k>=4) tone(3520*Math.pow(2,k/24),t+.2,.2,'sine',.025,sfxGain); }, // k = sale combo: each quick sale rises a step
    buy(){ const t=ctx.currentTime; uke(72,t,.12,sfxGain); uke(79,t+.08,.12,sfxGain); },
    error(){ const t=ctx.currentTime; tone(200,t,.15,'triangle',.08,sfxGain,.005,700); tone(150,t+.1,.2,'triangle',.08,sfxGain,.005,700); },
    level(){ const t=ctx.currentTime; steel([67,71,74,79],t,.09,sfxGain,.13); strum([67,71,74,79],t+.55,.12,sfxGain); },                                    // steel-guitar slide
    gem(){ const t=ctx.currentTime; [1760,2349,2637].forEach((f,i)=>tone(f,t+i*.05,.4,'sine',.08,sfxGain)); },
    open(){ uke(79,ctx.currentTime,.05,sfxGain); },
    discover(){ const t=ctx.currentTime; [67,71,74,76,79,83].forEach((m,i)=>guitar(m,t+i*.07,.13,sfxGain)); steel([79,83,86],t+.45,.07,sfxGain,.18); },
  };
  const DUCK={harvest:.6,cash:.6,level:.35,discover:.35,gem:.55,buy:.75};   // music ducks under big rewards, then recovers
  return { get state(){ return ctx?ctx.state:"none"; },
    resume,
    play(n,a){ try{ if(!ctx||ctx.state==='closed'||!sfxOn||vol.sfx<=0) return; jit=n==='cash'||n==='level'||n==='discover'?0:Math.round((Math.random()-.5)*8)/10; // ±0.4 semitone (~±2.5%) so repeats never sound robotic
      if(DUCK[n]&&musicOn&&!paused){ const t=ctx.currentTime, g=musicBus.gain, base=.32*vol.music; g.cancelScheduledValues(t); g.setTargetAtTime(base*DUCK[n],t,.03); g.setTargetAtTime(base,t+.55,.35); }
      S[n]&&S[n](a); jit=0; }catch(e){} },
    setScene(l,isNight){ try{ roomId=resolveRoom(l); night=!!isNight; scene=ambKey(roomId); const s=pick(); if(ctx&&started&&ctx.state!=='closed'){ if(s!==style) setStyle(s,false); } else if(s!==style) style=s; }catch(e){} },
    trackFor(r,isNight){ return musicBed(r, !!isNight); },
    setVol(k,v){ try{ vol[k]=Math.max(0,Math.min(1,+v)); applyVol(); }catch(e){} },
    setPaused(p){ try{ paused=!!p; if(!p&&ctx&&ctx.state==='closed') dropCtx(); applyVol(); if(ctx){ if(p) ctx.suspend&&ctx.suspend(); else { const r=ctx.resume&&ctx.resume(); if(r&&r.catch) r.catch(function(){}); nextBar=Math.max(nextBar,(ctx.currentTime||0)+.1); } } else if(!p) resume(); }catch(e){} },
    setMusic(on){ musicOn=!!on; applyVol(); }, setSfx(on){ sfxOn=!!on; applyVol(); }, setAmb(on){ ambOn=!!on; applyVol(); },
    get music(){ return musicOn; }, get sfx(){ return sfxOn; }, get style(){ return style; }, get vol(){ return {...vol}; },
    get bed(){ return bedGen; }, get bar(){ return bar; }, get room(){ return roomId; },
    get bpm(){ const s=STY[style]; return s?s.bpm:0; },
  };
})();
