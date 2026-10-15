/* Scene renderer (window.R): painted location art + sprite plants at real-world scale.
   Garage | Farm (greenhouse + terraces in front of the island backdrop) | Indoor facility.
   Plants: art/stage*.webp + art/mature_*.webp tinted per strain `look` (leaf/bud colour, frost, pistils, shape).
   Falls back to procedural Art.plantSprite if images fail. People are 1.7 m tall; plants 1-2 m. */
window.R=(function(){
  const TAU=Math.PI*2;
  let cv,ctx,W=0,H=0,dpr=1,t=0, loc='garage';
  const cams={}; let cam={x:0,y:0,z:1};
  const IM={}; let imgOK=true, loaded=0;
  const NAMES=['p_vegtent','p_clonecart','p_fertig','p_swamp','p_pedfan','p_clipfan','p_drynet','p_press','garage','greenhouse','indoor','island-bg','home-lot','stage0','stage1','stage2','stage3','stage4','mature_green','mature_purple','mature_white','mature_golden','mature_pink','mature_blue','b_stand','b_hale','b_house','b_shed','b_tank','b_cart','b_cart_buds','skin_garage_surfshack','skin_greenhouse_bamboo','skin_indoor_neon'];
  // Dedicated mature sprites for signature strains. ACDC shares the Naupaka art; White Truffle shares Menehune Mint.
  const SIG={'maui-wowie':'maui-wowie','granddaddy-purple':'granddaddy-purple','naupaka':'naupaka',acdc:'naupaka','durban-poison':'durban-poison','menehune-mint':'menehune-mint','white-truffle':'menehune-mint','kauai-electric':'kauai-electric','glitter-bomb':'glitter-bomb','super-boof':'super-boof'};
  // Adult people (art-src/npcs.jpg). The teen figure in the source sheet is never exported or used (18+ game).
  const PEOPLE={customer:['npc_sundress','npc_tank','npc_aloha','npc_elder','npc_tourist'],farmhand:['npc_overalls','npc_crate'],walker:['npc_tourist','npc_aloha','npc_sundress','npc_elder','npc_tank']};
  [...new Set(Object.values(SIG))].forEach(n=>NAMES.push('sig_'+n,'sig_'+n+'_pot')); ['npc_sundress','npc_tank','npc_aloha','npc_elder','npc_tourist','npc_overalls','npc_crate'].forEach(n=>NAMES.push(n));
  function loadImages(){ NAMES.forEach(n=>{ const im=new Image(); im.onload=()=>{ loaded++; }; im.onerror=()=>{ im._bad=true; if(/^stage|^mature/.test(n)) imgOK=false; }; im.src='art/'+n+'.webp'; IM[n]=im; }); }
  const ok=n=>IM[n]&&IM[n].complete&&IM[n].naturalWidth>0;
  const hash=s=>{ let h=2166136261; for(const c of String(s)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; };
  const rgb=h=>{ h=(h||'#6a9a3a').replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; };

  // ---------------- world layouts ----------------
  // Garage: art/garage.webp keyed from art-src/garage-clean.jpg (1280x720, white background removed by tools/key_garage.py).
  // The clear left floor (u < 6.4) holds the tents; the K4, workbench, cooler and surfboard sit on the right / back wall.
  // garage floor (art/garage.webp from art-src/garage-clean.jpg, 1280x720): u = m along the back wall (0..11.1, left->right), v = m from the
  // open front edge (0) to the back wall (6). Bilinear between the painted floor edges; door 2.7 m = 288 px, truck 5.4 m long on 3/4 view.
  const GP=(u,v)=>{ const t=v/8.6, bx=94+94.4*u, by=375-13.5*u, fx=288+112.2*u, fy=712-21.25*u; return {x:fx+(bx-fx)*t, y:fy+(by-fy)*t}; };   // garage-tall: floor 8.8 m wide x 8.6 m deep (door 2.7 m = 256 px; truck 5.4 m = 63% of the right-hand depth)
  // ONE WORLD SCALE (px per metre), calibrated on painted references with the ?scale=1 debug overlay:
  //   garage: truck cab ~1.9 m, workbench ~0.9 m, surfboard ~2.1 m  -> gppm (12% lower than the old fit)
  //   farm:   greenhouse door 2.05 m = 225 px in greenhouse.webp (110 px/m); stand awning post ~2.2 m = 170 px (77 px/m);
  //           house porch post ~2.4 m (37 px/m); shed door ~2.1 m (50 px/m); cart wheel ~1.0 m (110 px/m)  -> every building scaled to FARM_PPM
  //   indoor: fabric pots ~0.7 m wide (30 gal), bench top ~0.8 m (about waist height on a 1.7 m adult)
  const gppm=y=>95+(y-375)*.22;                       // vertical px per metre (garage door 2.3 m tall at the back wall = 244 px)
  const FARM_PPM=50;
  const inppm=y=>(49+(y-283)*.069)/.7;
  // Garage tents (procedural iso boxes standing on the clear left floor). T1 is swapped for a bigger tent each step; T2 is the second tent.
  // Real footprints: 2x2 ft = 0.6 m, 3x3 = 0.9 m, 4x4 = 1.2 m, 5x5 = 1.5 m, 4x8 = 1.2 x 2.4 m. Capacities per G.GARAGE_STEPS (max 25).
  const TENTS=[
    {id:'T1', steps:[[0,[0.5,1.1,4.9,5.5],'2x2'],[1,[0.5,1.4,4.6,5.5],'3x3'],[2,[0.5,1.7,4.3,5.5],'4x4'],[4,[0.5,2.0,4.0,5.5],'5x5']]},
    {id:'T2', steps:[[5,[2.7,3.9,2.6,3.8],'4x4'],[6,[2.7,5.1,2.6,3.8],'4x8']]},
  ];
  const RACK={step:7, r:[4.4,7.4,0.35,0.8]};                                           // low veg rack along the open front
  const T1N=[2,4,6,9,13], T2N=[0,0,0,0,0,4,8,8];
  function gridIn(r0,n){ const r=[r0[0]+.1,r0[1]-.1,r0[2]+.22,r0[3]-.06], [u0,u1,v0,v1]=r, cols=n<=2?2:n<=4?2:n<=6?3:n<=9?3:4, rows=Math.ceil(n/cols), out=[];
    for(let k=0;k<n;k++){ const row=Math.floor(k/cols), inRow=Math.min(cols,n-row*cols), c=k-row*cols; const du=(u1-u0)/inRow, dv=(v1-v0)/rows;
      out.push([u0+du*(c+.5), v1-dv*(row+.5), Math.min(du,dv)]); } return out; }
  // Pot layout (no tents): 5 rows x 5 pots on the clear left floor, 0.75 m centres, rows 0.8 m apart with a walkway in front.
  // Slots fill row by row (back row first), so caps 2/4/6/9/13/17/21/25 per level are unchanged (save migration stays 1:1).
  // grow tables: 0.76 m tall benches, one per row; slots sit on the table top (GT = floor point lifted by the table height)
  const TBL_H=.76, GT=(u,v)=>{ const p=GP(u,v); return {x:p.x,y:p.y-TBL_H*gppm(p.y)}; };
  const PROWS=[7.4,6.0,4.6,3.2,1.8], PCOLS=[1.0,2.0,3.0,4.0,5.0];
  function garageSlots(){ const S=[];
    PROWS.forEach((v,r)=>PCOLS.forEach((u,c)=>{ const p=GT(u,v); S.push({x:p.x,y:p.y,ppm:gppm(GP(u,v).y),hs:.85,kind:'pot',u,v,row:r,cls:'in',sp:.6,tent:'R'+r}); }));
    return S; }
  // Farm composite world (1800 x 1100): backdrop on top, greenhouse + terraces in the foreground.
  const GH={x:110,y:600,s:FARM_PPM/110};
  const GH_BEDS=[[164,418],[329,452],[433,511],[298,371],[408,411],[526,455],[383,324],[508,364],[608,408],[470,277],[576,318],[689,364]]; // greenhouse.webp px, 3 rows x 4 bays, bay by bay (door end first)
  const GHW=902, GHH=704;
  const TER={o:[905,880],L:[72,-40],C:[175,62]};
  function terracePlots(k){ const b=[TER.o[0]+TER.C[0]*(k%2)+TER.L[0]*4*(k>>1), TER.o[1]+TER.C[1]*(k%2)+TER.L[1]*4*(k>>1)]; return [0,1,2].map(j=>[b[0]+TER.L[0]*j,b[1]+TER.L[1]*j]); }
  // building scale s = FARM_PPM / (image px per metre measured on a door/post), see the calibration notes above
  const BLD={ house:{img:'b_house',x:2080,y:640,s:1.35,panel:'quests',label:'Family house'}, tank:{img:'b_tank',x:1700,y:690,s:.55,panel:'upgrades',label:'Water tank',need:()=>G.lv('catch')>0},
    shed:{img:'b_shed',x:2080,y:1100,s:1.0,panel:'process',label:'Drying shed'}, hale:{img:'b_hale',x:1560,y:1285,s:1.2,panel:'lab',label:'Breeding shed'},
    stand:{img:'b_stand',x:800,y:1250,s:.156,panel:'market',label:'Farm stand'}, cart:{img:'b_cart',x:1080,y:1260,s:.45,panel:'seeds',label:'Seed cart'} };
  function farmSlots(){
    const S=[];
    // terraces: 2 rows x 5 plants per patch, ~1.1 m apart (outdoor in-ground spacing)
    for(let k=0;k<4;k++){ const b=terracePlots(k)[0]; for(const c of [-.15,.15]) for(const j of [-.35,.325,1,1.675,2.35]) S.push({x:b[0]+TER.L[0]*j+TER.C[0]*c,y:b[1]+TER.L[1]*j+TER.C[1]*c,ppm:FARM_PPM,cls:'out',sp:1.1,kind:'soil',ter:k,zone:'field'}); }
    // greenhouse: 3 plants along each raised bed, ~0.55 m apart
    const ga=-.5, gd=.55*FARM_PPM; GH_BEDS.forEach(([bx,by],i)=>{ for(const o of [-1,0,1]) S.push({x:GH.x+bx*GH.s+Math.cos(ga)*gd*o,y:GH.y+by*GH.s+3+Math.sin(ga)*gd*o,ppm:110*GH.s,cls:'gh',sp:.6,kind:'bed',bay:Math.floor(i/3),zone:'gh'}); });
    return S;
  }
  // Indoor: 3 bench rows x 8 fabric pots measured on indoor.webp (1100x680; pot-top centre x, y, rim width px),
  // plus a vertical rack tier above the back bench.
  const IN_ROWS=[[[281,317,50],[345,305,50],[408,295,49],[468,283,49],[530,272,48],[589,262,47],[644,251,47],[696,241,46]],
    [[285,366,53],[350,354,53],[417,343,52],[481,329,51],[539,320,51],[612,305,50],[666,293,49],[716,282,48]],
    [[379,405,58],[450,393,57],[509,383,56],[562,368,55],[627,355,54],[714,335,53],[770,324,52],[828,307,51]]];
  const RACK_L={x:452,y:536,w:58}, RACK_R={x:812,y:452,w:52}, RACK_H=24; const rackPt=i=>{ const f=(i+.5)/8; return {x:RACK_L.x+(RACK_R.x-RACK_L.x)*f, y:RACK_L.y+(RACK_R.y-RACK_L.y)*f, w:RACK_L.w+(RACK_R.w-RACK_L.w)*f}; }; // deck 50px in front of/below the front bench pots, 0.3 m above the floor
  function indoorSlots(){
    const S=[]; IN_ROWS.forEach((row,r)=>row.forEach(([x,y,w])=>S.push({x,y:y+5,ppm:w/.7,cls:'in',sp:.75,kind:'art',bench:r,pw:w,fy:y+5+1.4*w/.7})));
    // veg/clone rack: a low floor-standing plant stand along the front of the front bench (pots rest on its deck)
    for(let i=0;i<8;i++){ const p=rackPt(i); S.push({x:p.x,y:p.y,ppm:p.w/.7*.9,cls:'rack',sp:.6,kind:'rackpot',bench:3,pw:p.w*.85,fy:p.y+RACK_H}); }
    return S;
  }
  const SC={
    garage:{w:1280,h:720, focusL:[40,10,1250,715], focusP:[56,14,940,715], slots:null},
    farm:{w:2400,h:1300, focusL:[40,470,2380,1300], focusP:[60,560,980,1290], slots:null},
    indoor:{w:1100,h:680, focusL:[20,8,1080,650], focusP:[30,120,1070,640], slots:null},
  };
  function rebuild(){ SC.garage.slots=garageSlots(); SC.farm.slots=farmSlots(); SC.indoor.slots=indoorSlots(); mapPlots(); }
  let slotOf=new Map();
  function mapPlots(){ slotOf=new Map(); const st=G.st; if(!st) return;
    st.plots.forEach(p=>{ let s=null; if(p.zone==='garage') s=SC.garage.slots[p.idx]; else if(p.zone==='field') s=SC.farm.slots[p.idx]; else if(p.zone==='gh') s=SC.farm.slots[40+p.idx]; else if(p.zone==='in') s=SC.indoor.slots[p.idx]; if(s) slotOf.set(p.id,s); }); }

  // ---------------- strain look: tinted sprite cache ----------------
  const tcache=new Map();
  const TYPEH={Sativa:1.6,Indica:1.1,Hybrid:1.3}, TYPEW={Sativa:.8,Indica:1.15,Hybrid:1};
  // REALISTIC SIZE THROUGH THE GROW (metres): seedling 5-10 cm -> early veg 20-40 cm -> late veg 50-90 cm -> flowering stretch
  // (sativa ~2x, indica ~1.5x) -> mature height by setting. Width follows type aspect and fills the planting spacing at maturity.
  const MATH={out:{Sativa:2.3,Hybrid:1.9,Indica:1.6},gh:{Sativa:1.2,Hybrid:1.05,Indica:.9},in:{Sativa:1.25,Hybrid:1.05,Indica:.85},sog:{Sativa:.95,Hybrid:.85,Indica:.75},rack:{Sativa:.6,Hybrid:.55,Indica:.5}};
  const STRETCH={Sativa:2,Hybrid:1.75,Indica:1.5}, ASP={Sativa:.58,Hybrid:.78,Indica:.98};
  const smooth=x=>{ x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); };
  function plantSize(type,prog,sl){ const M=MATH[sl.cls||'in']||MATH.in, H=M[type]||M.Hybrid, ve=Math.min(.9,H/(STRETCH[type]||1.75)); let h;
    if(prog<.08) h=.05+.05*smooth(prog/.08);
    else if(prog<.45) h=.1+(ve-.1)*Math.pow(smooth((prog-.08)/.37),1.1);
    else if(prog<.8){ const k=(prog-.45)/.35; h=ve+(H-ve)*(1-(1-k)*(1-k)); } else h=H;
    const fill=prog<.45?.75:.75+.4*smooth((prog-.45)/.4);                  // canopy closes the gap as it matures
    const w=Math.min(h*(ASP[type]||.78)*(prog<.08?1.3:1),(sl.sp||.8)*fill); return {h,w}; }
  function look(s){ return s.look||{bud:s.game.budColor,bud2:s.game.budLight,leaf:'#4f8a32',frost:.5,pistil:s.game.pistil,shape:'round',base:'green'}; }
  function tinted(name,s,mature){
    const key=name+'|'+s.id; if(tcache.has(key)) return tcache.get(key);
    const im=IM[name]; if(!ok(name)) return null;
    const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; const x=c.getContext('2d'); x.drawImage(im,0,0);
    const L=look(s);
    try{
      const d=x.getImageData(0,0,c.width,c.height), a=d.data, lf=rgb(L.leaf), b1=rgb(L.bud), b2=rgb(L.bud2||L.bud), pi=rgb(L.pistil);
      let seed=hash(s.id)||1; const rnd=()=>((seed=Math.imul(seed^seed>>>15,2246822507)+1013904223>>>0)/4294967296);
      const fr=Math.max(0,Math.min(1,L.frost==null?.5:L.frost)), lumL=(lf[0]*.3+lf[1]*.59+lf[2]*.11)/255;
      for(let i=0;i<a.length;i+=4){ if(a[i+3]<10) continue; const r=a[i],g=a[i+1],b=a[i+2];
        const lum=(r*.3+g*.59+b*.11)/255, mx=Math.max(r,g,b), mn=Math.min(r,g,b), sat=(mx-mn)/(mx+1);
        const leafy=g>r*1.06&&g>=b&&sat>.16&&lum<.62;
        if(!mature||leafy){ const k=lum/Math.max(.15,lumL)*.95; for(let j=0;j<3;j++) a[i+j]=a[i+j]*.62+Math.min(255,lf[j]*k)*.38; }
        else { const t2=Math.min(1,lum*1.3); for(let j=0;j<3;j++){ const tg=(b1[j]*(1-t2)+b2[j]*t2)*(.55+lum*.7); a[i+j]=a[i+j]*.5+Math.min(255,tg)*.5; }
          const q=rnd(); if(q<fr*.22){ a[i]=a[i]*.35+236*.65; a[i+1]=a[i+1]*.35+242*.65; a[i+2]=a[i+2]*.35+248*.65; }
          else if(q>1-.014*(1.2-fr*.5)){ a[i]=pi[0]; a[i+1]=pi[1]; a[i+2]=pi[2]; } } }
      x.putImageData(d,0,0);
    }catch(e){ /* tainted canvas (file://) -> untinted */ }
    const out={c,w:c.width,h:c.height}; tcache.set(key,out); return out;
  }
  const sigOf=(s,pot)=>{ const n=SIG[s.id]&&'sig_'+SIG[s.id]+(pot?'_pot':''); if(!n||!ok(n)) return null; const im=IM[n]; return {c:im,w:im.naturalWidth,h:im.naturalHeight,sig:1}; };
  function plantImage(s,prog){
    const stg=prog>=1?5:prog<.08?0:prog<.25?1:prog<.45?2:prog<.65?3:4;
    if(!imgOK) return null;
    // type art (art/gs_s*, gs_i*): sativas use the tall-narrow row, indicas the short-bushy row; hybrids keep the shared stages
    // hybrids use the hybrid row (art/gs_h*); mature indicas pick the colour variant closest to the strain look (purple/pink keep gs_i4)
    const tp=s.type==='Sativa'?'s':s.type==='Indica'?'i':'h';
    if((window.ART_HAVE||{})['gs_'+tp+'0']&&ok('gs_'+tp+'4')){ const sg2=sigOf(s); if(sg2&&prog>=1) return {a:sg2};
      const base=look(s).base||'green', IV={green:'gs_iv_green',white:'gs_iv_white',golden:'gs_iv_gold',blue:'gs_iv_blue'}[base];
      const raw=n=>{ const m=IM[n]; return {c:m,w:m.naturalWidth,h:m.naturalHeight}; };
      const B=[.08,.25,.45,.8], gi=prog<.08?0:prog<.25?1:prog<.45?2:prog<.8?3:4, im=i=>i===4&&tp==='i'&&IV&&ok(IV)?raw(IV):tinted('gs_'+tp+i,s,i===4);
      if(gi<4){ const f=smooth((prog-(B[gi]-.05))/.05); if(f>0) return {a:im(gi),b:sg2&&gi===3?sg2:im(gi+1),mix:f}; } return {a:im(gi)}; }
    const sg=sigOf(s); if(sg){ if(stg===5) return {a:sg}; if(stg===4) return {a:tinted('stage4',s,false),b:sg,mix:Math.max(0,(prog-.82)/.18)}; }
    if(stg===5) return {a:tinted('mature_'+(look(s).base||'green'),s,true)};
    if(stg===4){ const m=tinted('mature_'+(look(s).base||'green'),s,true), b=tinted('stage4',s,false); return {a:b,b:m,mix:Math.max(0,(prog-.82)/.18)}; }
    const nx=[.08,.25,.45,.65][stg], f=nx?smooth((prog-(nx-.05))/.05):0;   // fade into the next stage over the last 5% of each stage
    if(f>0) return {a:tinted('stage'+stg,s,false),b:stg+1===4?tinted('stage4',s,false):tinted('stage'+(stg+1),s,false),mix:f};
    return {a:tinted('stage'+stg,s,false)};
  }

  // ---------------- camera ----------------
  let dprCap=2; function setDprCap(c){ dprCap=c; }
  function resize(){ dpr=Math.min(dprCap,innerHeight<500&&innerWidth>innerHeight?1.5:9,window.devicePixelRatio||1); W=innerWidth; H=innerHeight; cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px'; }
  // free play area = screen minus top HUD + goal bubble, the right location rail and the bottom tool bar/nav
  function insets(){ const port=H>W; let top=port?92:52, bot=port?170:110, right=0;
    try{ const r=id=>{ const e=document.getElementById(id); return e&&e.offsetHeight?e.getBoundingClientRect():null; };
      const g=r('goal'), hud=r('hud'), t=r('locTabs'), tb=r('toolbar'); if(hud) top=hud.bottom+4; if(g&&port) top=Math.max(top,Math.min(g.bottom,g.top+50)+4);
      if(t) right=W-t.left+4; if(tb) bot=H-tb.top+4; const ob=r('orderBoard'); if(ob&&!port&&loc==='indoor') top=Math.max(top,ob.bottom+4); }catch(e){}
    return {top, bot, left:0, right}; }
  function fit(){ if(loc==='garage'){ fitGarage(); return; } const sc=SC[loc], f=H>W?sc.focusP:sc.focusL, I=insets();
    // portrait: the slim location rail floats over the room's top-right wall, so the room may use ~92% of the full width
    if(H>W){ const lc=document.getElementById('upgBtn'), lr=lc&&lc.offsetHeight?lc.getBoundingClientRect().right+2:0; I.left=Math.max(W*.04,lr); I.right=W*.04; }
    else { const lc=document.getElementById('upgBtn'); if(lc&&lc.offsetHeight) I.left=Math.max(I.left,lc.getBoundingClientRect().right+6); }
    const aw=W-I.left-I.right, ah=H-I.top-I.bot;
    const z=Math.min(aw/(f[2]-f[0]), ah/(f[3]-f[1])); cam.z=z; cam.fitZ=z; cam.x=(f[0]+f[2])/2-(I.left+aw/2)/z; cam.y=(f[1]+f[3])/2-(I.top+ah/2)/z; clamp(); }
  // Everything the player owns in the garage, plus the painted truck, in one world box.
  // Empty future tables stay outside the frame so the room can scale up to the screen.
  function garageMust(){
    const slots=SC.garage.slots||[], cap=G.capOf?G.capOf('garage'):slots.length, use=slots.slice(0,Math.max(1,Math.min(slots.length,cap)));
    let x0=820, y0=175, x1=1210, y1=470; // Kahuna K4, baked into the garage art
    for(const s of use){ const ppm=s.ppm||100, soil=s.y-.32*ppm;
      x0=Math.min(x0,s.x-.5*ppm); x1=Math.max(x1,s.x+.5*ppm);
      y0=Math.min(y0,soil-1.32*ppm); y1=Math.max(y1,s.y+.16*ppm); }
    if(use.length){ const s=use[use.length-1]; const toe=GP(s.u,s.v+.55); y1=Math.max(y1,toe.y); x0=Math.min(x0,toe.x-40); }
    return {x0:Math.max(0,x0-14), y0:Math.max(0,y0-8), x1:Math.min(1280,x1+16), y1:Math.min(720,y1+10)};
  }
  function uiBox(id){ const e=document.getElementById(id); if(!e||e.classList.contains('hidden')) return null; const r=e.getBoundingClientRect(); return r.width>=12&&r.height>=12?r:null; }
  function hudObstacles(){ const out=[]; for(const id of ['hud','toolbar','seedBag','scoutBtn','upgBtn','locTabs','clock','goal','orderBoard','eventChip']){ const r=uiBox(id); if(r) out.push({l:r.left-3,t:r.top-3,r:r.right+3,b:r.bottom+3}); } return out; }
  function rectHits(a,obs){ return obs.some(o=>a.l<o.r&&a.r>o.l&&a.t<o.b&&a.b>o.t); }
    // Largest uniform scale that keeps the must-see box on screen and clear of the HUD.
    // Wide screens then stop at the scale that shows the whole 1280×720 painting, letterboxed on the existing backdrop.
  function fitGarage(){
    const M=garageMust(), mw=Math.max(1,M.x1-M.x0), mh=Math.max(1,M.y1-M.y0), obs=hudObstacles();
    const zHi=Math.min(W/mw,H/mh), zLo=Math.min(zHi,.2);
    const anchors=()=>{ const tb=uiBox('toolbar'), hud=uiBox('hud'), rail=uiBox('locTabs');
      const sides=['seedBag','scoutBtn','upgBtn'].map(uiBox).filter(Boolean);
      const top=(hud?hud.bottom:0)+8, bot=tb?tb.top-8:H-8;
      const sideR=sides.length?Math.max(...sides.map(r=>r.right))+8:8, sideB=sides.length?Math.max(...sides.map(r=>r.bottom))+8:top;
      const railL=rail?rail.left-8:W-8, railB=rail?rail.bottom+8:top;
      const below=Math.max(sideB,railB);
      return [
        {l:8,t:top,r:W-8,b:bot},
        {l:8,t:below,r:W-8,b:bot},
        {l:sideR,t:top,r:railL,b:bot},
        {l:sideR,t:below,r:railL,b:bot},
      ].filter(a=>a.r-a.l>40&&a.b-a.t>40); };
    function coverOf(sx,sy,z){ const vx=M.x0-sx/z, vy=M.y0-sy/z, vw=W/z, vh=H/z;
      const iw=Math.max(0,Math.min(1280,vx+vw)-Math.max(0,vx)), ih=Math.max(0,Math.min(720,vy+vh)-Math.max(0,vy)); return iw*ih*z*z; }
    function settle(z){ const cw=mw*z, ch=mh*z; let best=null;
      const consider=(sx,sy)=>{ const rect={l:sx,t:sy,r:sx+cw,b:sy+ch};
        if(sx<-1||sy<-1||sx+cw>W+1||sy+ch>H+1||rectHits(rect,obs)) return;
        const cover=coverOf(sx,sy,z), mid=(0-(M.y0-sy/z))*z+360*z, bias=Math.abs(mid-H/2);
        if(!best||cover>best.cover+1||(Math.abs(cover-best.cover)<=1&&bias<best.bias)) best={sx,sy,cover,bias}; };
      for(const a of anchors()){ if(cw>a.r-a.l+1||ch>a.b-a.t+1) continue;
        const xs=[a.l, a.l+(a.r-a.l-cw)/2, a.r-cw], ys=[a.t, a.t+(a.b-a.t-ch)/2, a.b-ch];
        for(const sx0 of xs) for(const sy0 of ys){ let sx=sx0, sy=sy0;
          for(let n=0;n<8;n++){ const rect={l:sx,t:sy,r:sx+cw,b:sy+ch}; let hit=null; for(const o of obs) if(rect.l<o.r&&rect.r>o.l&&rect.t<o.b&&rect.b>o.t){ hit=o; break; } if(!hit) break;
            const pushes=[{d:rect.r-hit.l,x:-1,y:0},{d:hit.r-rect.l,x:1,y:0},{d:rect.b-hit.t,x:0,y:-1},{d:hit.b-rect.t,x:0,y:1}].sort((p,q)=>p.d-q.d);
            let moved=false; for(const p of pushes){ const nx=sx+p.x*(p.d+1), ny=sy+p.y*(p.d+1); if(nx<a.l-1||ny<a.t-1||nx+cw>a.r+1||ny+ch>a.b+1) continue; sx=nx; sy=ny; moved=true; break; }
            if(!moved) break; }
          consider(sx,sy); } }
      return best; }
    let lo=zLo, hi=zHi, win=settle(zLo);
    for(let i=0;i<14;i++){ const mid=(lo+hi)/2, got=settle(mid); if(got){ win=got; lo=mid; } else hi=mid; }
    let z=lo;
    // A phone still fills the safe area (pots stay big). A wide screen can show the whole painting
    // when that scale still clears the HUD and the owned pots stay a large part of the view.
    const zArt=Math.min(W/1280, H/720);
    if(zArt+0.004<z && Math.min(W,H)>=700){ const art=settle(zArt); if(art && mh*zArt>=Math.min(W,H)*0.42){ win=art; z=zArt; } }
    cam.z=z; cam.fitZ=z; cam.x=M.x0-(win?win.sx:8)/z; cam.y=M.y0-(win?win.sy:8)/z; cam.fitX=cam.x; cam.fitY=cam.y; clamp(); }
  function clamp(){ const sc=SC[loc];
    if(loc==='garage'&&cam.fitZ){ cam.z=Math.max(cam.fitZ,Math.min(4,cam.z));
      if(cam.z<=cam.fitZ*1.02){ cam.z=cam.fitZ; cam.x=cam.fitX; cam.y=cam.fitY; return; }
      const vw=W/cam.z, vh=H/cam.z, m=36;
      cam.x=vw>=sc.w?cam.fitX:Math.max(-m,Math.min(sc.w+m-vw,cam.x));
      cam.y=vh>=sc.h?cam.fitY:Math.max(-m,Math.min(sc.h+m-vh,cam.y)); return; }
    const zmin=Math.min(Math.min(W/sc.w,H/sc.h)*.9,cam.fitZ||1e9); cam.z=Math.max(zmin,Math.min(4,cam.z));
    const vw=W/cam.z, vh=H/cam.z, m=120; cam.x=vw>sc.w+2*m?(sc.w-vw)/2:Math.max(-m,Math.min(sc.w+m-vw,cam.x)); cam.y=vh>sc.h+2*m?(sc.h-vh)/2:Math.max(-m-60,Math.min(sc.h+m-vh,cam.y)); }
  function pan(){ /* stacked beds fill the screen; nothing to pan */ }
  function zoomAt(){ /* stacked beds stay fitted; nothing to zoom */ }
  const toS=(x,y)=>({x:(x-cam.x)*cam.z, y:(y-cam.y)*cam.z});
  function setLoc(l){ if(!SC[l]) return; cams[loc]={...cam}; loc=l; if(cams[l]){ cam={...cams[l]}; clamp(); } else fit(); fx.length=0; actors.length=0; }

  // ---------------- FX ----------------
  const fx=[], floats=[], coins=[];
  const FXC={leaf:['#5fbf4a','#8be05a','#3e9a3a'],water:['#7fd0ff','#bfe8ff','#4aa8f0'],gold:['#ffe27a','#ffc83a','#fff3b0'],purple:['#d9a8ff','#b57bff','#f0d8ff'],gem:['#7af0ff','#c0f8ff','#5ad0ff'],feed:['#ffb06a','#ffd28a','#e8853a'],bug:['#6b4a2a','#3a2a1a'],mold:['#d8d8d0','#b8b8a8'],heal:['#9dffc0','#e0ffe8']};
  function worldOf(target){ if(!target) return null; if(target.id&&slotOf.has(target.id)){ const s=slotOf.get(target.id), p=G.st.plots.find(q=>q.id===target.id); if(p&&p.loc!==loc) return null; return {x:s.x,y:s.y-(s.ppm*.5)}; }
    if(typeof target==='string'){ const b=BLD[target]; if(b&&loc==='farm') return {x:b.x,y:b.y-IM[b.img].naturalHeight*b.s*.5}; return null; } if(target.x!=null) return target; return null; }
  function burst(target,kind,n,spread){ const w=worldOf(target); if(!w) return; const C=FXC[kind]||FXC.gold; n=n||10; if(G.st.settings.motion===false||!G.st.settings.hq) n=Math.ceil(n/2); spread=spread||40;
    for(let i=0;i<n;i++){ const a=Math.random()*TAU, v=(.3+Math.random())*spread; fx.push({x:w.x,y:w.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-spread*.6,life:.9+Math.random()*.5,t:0,c:C[i%C.length],k:kind,r:2+Math.random()*2.5}); } }
  function leafFall(target,n){ const w=worldOf(target); if(!w) return; const sl=slotOf.get(target.id), pp=sl?sl.ppm:40; for(let i=0;i<(n||6);i++) fx.push({x:w.x+(Math.random()-.5)*pp*.5,y:w.y-pp*.3*Math.random(),vx:(Math.random()-.5)*20,vy:-10-Math.random()*15,life:1.6+Math.random()*.6,t:0,c:['#c8b040','#9a8a30','#6fae3a'][i%3],k:'fall',r:2.5+Math.random()*2}); }
  function floater(target,text,color,dy){ const w=worldOf(target); if(!w) return; let lane=0; for(const f of floats) if(f.t<f.life*.8&&Math.abs(f.x-w.x)<160&&Math.abs(f.y-w.y)<120) lane=Math.max(lane,f.lane+1); if(lane>2){ const o=floats.find(f=>f.lane===0&&Math.abs(f.x-w.x)<160); if(o) o.t=o.life; lane=2; } floats.push({x:w.x,y:w.y,text,color:color||'#fff',t:0,life:1.6,dy:(dy||60),lane}); }
  let rkV=1,rkT=-1; function ripeK(now){ if(now!==rkT){ rkT=now; const n=G.st.plots.filter(p=>p.loc===loc&&p.strain&&p.prog>=1).length; rkV=n<=4?1:Math.max(.3,Math.sqrt(4/n)); } return rkV; }   // tone the harvest glow down when many plants are ripe
  let hfC=0,hfT=0; function hudFloor(){ const nw=performance.now(); if(nw-hfT<250) return hfC; hfT=nw; let y=0; for(const id of ['hud','goal']){ const e=document.getElementById(id); if(!e) continue; const r=e.getBoundingClientRect(); if(r.height&&r.bottom<innerHeight*.45) y=Math.max(y,r.bottom); } const c=document.getElementById('game'); return hfC=y-(c?c.getBoundingClientRect().top:0); }
  function coinsTo(target,elId,n){ const w=worldOf(target); const el=document.getElementById(elId); if(!el) return; const r=el.getBoundingClientRect(); const s=w?toS(w.x,w.y):{x:W/2,y:H/2};
    for(let i=0;i<(n||5);i++) coins.push({x:s.x+(Math.random()-.5)*30,y:s.y+(Math.random()-.5)*20,tx:r.left+r.width/2,ty:r.top+r.height/2,t:-i*.06,gem:elId==='gemPill'}); }
    const DOOR={garage:{x:620,y:600},farm:{x:420,y:1285},indoor:{x:940,y:520}};
  // ================= PEOPLE: actors with eased spline paths, walk cycle, fake-3D turns, depth scale, sun shadows, idles =================
  // Every person (worker trips, managers, customers, walkers) is an actor. Positions are world px; speeds are metres/second
  // converted with the local px/m (ppmAt), so a 1.7 m adult walks ~1.2 m/s everywhere and shrinks with depth.
  const FB=[{sk:'#5a3a26',top:'#e05a3a',hair:'#1a1410',f:0},{sk:'#f0c8a8',top:'#3a8ae0',hair:'#c8a060',f:1},{sk:'#8d5a3a',top:'#3ab08a',hair:'#141010',f:1},{sk:'#c68a5e',top:'#e0b03a',hair:'#2a1a10',f:0},{sk:'#e8b890',top:'#8a5ae0',hair:'#3a2418',f:1},{sk:'#3e2a1e',top:'#2f7a4a',hair:'#0e0a08',f:0}];
  let ppmOverride=0; const ppmAt=y=>ppmOverride?ppmOverride:loc==='garage'?gppm(y):loc==='indoor'?inppm(Math.min(560,y)):FARM_PPM*(1+(y-1000)*.00025);
  const actors=[]; let walkT=6, aid=0;
  const mo=()=>G.st.settings.motion!==false, hq=()=>G.st.settings.hq!==false;
  // Managers: dedicated full-body art if present (art/staff_*.webp, see tools/process_art.py), else tinted stand-ins
  const HAVE=window.ART_HAVE||{};
  const STAFF={garage:{name:'Kai',art:'staff_kai',sub:'npc_tank',tint:'rgba(214,84,52,.45)',need:()=>G.wk('mgrG')>0||G.wk('farmhand')>0},
               farm:{name:'Malia',art:'staff_malia',sub:'npc_sundress',tint:'rgba(61,110,168,.5)',need:()=>G.wk('mgrF')>0&&G.st.land},
               indoor:{name:'Nick',art:'staff_nick',sub:'npc_crate',tint:'rgba(20,20,26,.6)',need:()=>G.wk('mgrI')>0&&G.st.inBuilt}};
  ['sunset','teal','matte','hibiscus','s1_truck','s2_truck','s3_truck','s4_truck','s5_truck','s6_truck'].forEach(k=>{ NAMES.push('truck_'+k); if(['sunset','teal','matte','hibiscus'].includes(k)) NAMES.push('truckcard_'+k); });
  Object.values(STAFF).forEach(s=>{ if(HAVE[s.art]&&!NAMES.includes(s.art)) NAMES.push(s.art); });
  for(const t of 'sih') for(let i=0;i<5;i++){ const n='gs_'+t+i; if(HAVE[n]&&!NAMES.includes(n)) NAMES.push(n); }
  for(const v of ['green','white','gold','blue']){ const n='gs_iv_'+v; if(HAVE[n]&&!NAMES.includes(n)) NAMES.push(n); }
  const tintC={};
  // high-quality people: the art is ~2x the largest drawn size; downscale with step-halving + imageSmoothingQuality 'high' into a cached
  // canvas at the size actually drawn (quantised to 1/4 octave), so the browser never minifies a big sprite with its cheap filter
  const hiC=new Map();
  const mips=new Map();
  function mipOf(im){ let L=mips.get(im); if(L) return L; L=[im]; let src=im, w=im.naturalWidth||im.width, h=im.naturalHeight||im.height;
    while(h>=64){ const t=document.createElement('canvas'); t.width=Math.max(1,Math.round(w/2)); t.height=Math.max(1,Math.round(h/2)); const x=t.getContext('2d'); x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; x.drawImage(src,0,0,t.width,t.height); L.push(t); src=t; w=t.width; h=t.height; }
    mips.set(im,L); return L; }
  function hiSprite(im,devH){ const H0=im.naturalHeight||im.height; let m=hiC.get(im); if(!m){ m=new Map(); hiC.set(im,m); } if(!H0){ if(!m.get(0)) m.set(0,{c:im,k:0}); return m.get(0); }
    const q=Math.round(Math.pow(2,Math.round(Math.log2(Math.max(8,devH))*3)/3)); if(q*1.1>=H0){ if(!m.get(0)) m.set(0,{c:im,k:0}); return m.get(0); }
    let c=m.get(q); if(c) return c; const L=mipOf(im); let src=L[0]; for(const l of L){ if((l.naturalHeight||l.height)>=q) src=l; }
    const tw=Math.max(1,Math.round((im.naturalWidth||im.width)*q/H0)), f=document.createElement('canvas'); f.width=tw; f.height=q; const fx=f.getContext('2d'); fx.imageSmoothingEnabled=true; fx.imageSmoothingQuality='high'; fx.drawImage(src,0,0,tw,q);
    c={c:f,k:q}; if(m.size>40) m.delete(m.keys().next().value); m.set(q,c); return c; }
  function darkOf(hs){ if(hs.d) return hs.d; const s=hs.c, d=document.createElement('canvas'); d.width=s.width||s.naturalWidth; d.height=s.height||s.naturalHeight; const x=d.getContext('2d'); x.drawImage(s,0,0,d.width,d.height); x.globalCompositeOperation='source-in'; x.fillStyle='#000'; x.fillRect(0,0,d.width,d.height); hs.d=d; return d; }
  function spriteOf(a){ if(a.outfit) return outfitSprite(a.outfit); if(a.staff){ const S=a.staff; if(HAVE[S.art]&&ok(S.art)) return IM[S.art]; if(!ok(S.sub)) return null; if(tintC[S.art]) return tintC[S.art];
      const im=IM[S.sub], c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; const x=c.getContext('2d'); x.drawImage(im,0,0); x.globalCompositeOperation='source-atop'; x.fillStyle=S.tint; x.fillRect(0,c.height*.2,c.width,c.height*.36); return tintC[S.art]=c; }
    return a.img&&ok(a.img)?IM[a.img]:null; }
  // Catmull-Rom spline through waypoints -> arc-length table
  function spline(P){ if(P.length<2) P=[P[0],P[0]]; const pts=[P[0]], E=[P[0],...P,P[P.length-1]];
    for(let i=1;i<E.length-2;i++){ const [p0,p1,p2,p3]=[E[i-1],E[i],E[i+1],E[i+2]]; for(let k=1;k<=10;k++){ const t=k/10,t2=t*t,t3=t2*t;
      pts.push({x:.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3), y:.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3)}); } }
    const L=[0]; for(let i=1;i<pts.length;i++) L.push(L[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y)); return {pts,L,len:L[L.length-1]}; }
  function along(sp,s){ const L=sp.L; s=Math.max(0,Math.min(sp.len,s)); let lo=0,hi=L.length-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(L[m]<s) lo=m; else hi=m; }
    const k=(s-L[lo])/Math.max(1e-6,L[hi]-L[lo]), a=sp.pts[lo], b=sp.pts[hi]; return {x:a.x+(b.x-a.x)*k, y:a.y+(b.y-a.y)*k, dx:b.x-a.x, dy:b.y-a.y}; }
  // route through an "aisle" in front of both points so people walk around benches/tents instead of through them
  function route(a,b){ const dist=Math.hypot(b.x-a.x,b.y-a.y); if(loc==='farm'||dist<40) { const mx=(a.x+b.x)/2, my=(a.y+b.y)/2, n=dist*.12*(hash(a.x+','+b.y)&1?1:-1); return detour([a,{x:mx-(b.y-a.y)/Math.max(1,dist)*n,y:my+(b.x-a.x)/Math.max(1,dist)*n},b]); }
    const ay=Math.max(a.y,b.y)+.5*ppmAt(Math.max(a.y,b.y)); return [a,{x:a.x+(b.x-a.x)*.15,y:ay},{x:a.x+(b.x-a.x)*.85,y:ay},b]; }
  function spawn(o){ const a=Object.assign({id:++aid,x:0,y:0,v:0,face:1,f:1,lean:0,ph:Math.random()*6,alpha:0,fade:1,t:0,idleT:0,look:2+Math.random()*4,state:'idle',vmax:1.2+Math.random()*.25,fb:FB[aid%FB.length]},o); actors.push(a); return a; }
  function walkTo(a,pts,then){ a.sp=spline([{x:a.x,y:a.y},...pts]); a.s=0; a.state='walk'; a.then=then; }
  function updActor(a,dt){ if(a.delay>0){ a.delay-=dt; a.alpha=0; return; } a.t+=dt; a.alpha+=(a.fade-a.alpha)*Math.min(1,dt*3.5); const ppm=ppmAt(a.y);
    if(a.state==='walk'&&a.sp){ const acc=1.6, rem=a.sp.len-a.s, vstop=Math.sqrt(2*acc*Math.max(0,rem/ppm));  // m/s, ease in + ease out
      a.v=Math.min(a.vmax,a.v+acc*dt,vstop); if(rem<1){ a.v=0; a.state='idle'; a.sp=null; a.idleT=0; const f=a.then; a.then=null; if(f) f(a); }
      else { a.s+=a.v*ppm*dt; const p=along(a.sp,a.s); const hd=Math.atan2(p.dy,p.dx); if(a.hd!=null){ let d=hd-a.hd; while(d>Math.PI) d-=TAU; while(d<-Math.PI) d+=TAU; a.turn=d/Math.max(dt,1e-3); } a.hd=hd;
        a.x=p.x; a.y=p.y; if(Math.abs(p.dx)>.3) a.face=p.dx>0?1:-1; } }
    else { a.v=Math.max(0,a.v-3*dt); a.idleT+=dt; a.turn=0; if(a.state==='idle'&&a.look>0&&(a.idleT>a.look)){ a.idleT=0; a.look=2.5+Math.random()*5; if(hq()) a.face=-a.face; } }
    a.ph+=dt*(a.v>.05?a.v*5.6:0);                                                                         // ~1.8 steps/s at 1.2 m/s
    const tl=mo()?Math.max(-.12,Math.min(.12,(a.turn||0)*.035*a.v)):0; a.lean+=(tl-a.lean)*Math.min(1,dt*6);   // lean into turns
    a.f+=Math.sign(a.face-a.f)*Math.min(Math.abs(a.face-a.f),dt*(mo()?6:60)); }                             // fake-3D flip-through
  function sun(){ if(loc!=='farm') return null; const ph=G.dayPhase(); if(ph<.25||ph>.75) return null; const ang=Math.PI*(ph-.25)/.5, el=Math.sin(ang); return {dx:-Math.cos(ang), el}; }
  function drawActor(a,now){ if(a.pet){ drawPet(a,now); return; } const im=spriteOf(a), ppm=ppmAt(a.y), h=1.7*ppm, sf=Math.min(1,a.v/1.2), m=mo(), al=a.alpha; if(al<.02) return;
    const x=a.x, y=a.y; ctx.save(); ctx.globalAlpha=al;
    // shadows: soft contact + sun-cast (stretches toward evening, rotates with the sun); overhead-lit rooms get contact only
    const S=hq()?sun():null; if(S){ const len=h*Math.min(1.6,.35/Math.max(.22,S.el)), dx=S.dx*len, dy=-len*.18; ctx.save(); ctx.translate(x+dx*.5,y+dy*.5); ctx.rotate(Math.atan2(dy,dx)); ctx.fillStyle='rgba(20,30,10,'+(.18*Math.min(1,S.el*2))+')'; ctx.beginPath(); ctx.ellipse(0,0,Math.abs(len)*.5+h*.06,h*.055,0,0,TAU); ctx.fill(); ctx.restore(); }
    ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x,y,h*.12*(1-.15*sf*Math.abs(Math.sin(a.ph))),h*.035,0,0,TAU); ctx.fill();
    // body: walk bob + sway + squash/stretch synced to stride, idle breathing / weight shift, lean, flip-through turn
    let bob=0, rot=a.lean, sy=1, ox=0;
    if(m){ if(sf>.02){ const s=Math.sin(a.ph); bob=Math.abs(s)*h*.022*sf; rot+=Math.sin(a.ph)*.03*sf; sy=1+.025*sf*Math.cos(2*a.ph); }
      else if(hq()){ sy=1+.008*Math.sin(now*2.2+a.id); ox=Math.sin(now*.7+a.id)*h*.006; rot+=Math.sin(now*.7+a.id)*.012; if(a.state==='work') sy*=.97+.02*Math.sin(now*3+a.id); } }
    const fx=Math.sign(a.f||1)*Math.max(.12,Math.abs(a.f)), sx=fx/Math.sqrt(sy);
    ctx.translate(x+ox,y-bob); ctx.rotate(rot); ctx.scale(sx,sy);
    if(im){ const w=h*(im.naturalWidth||im.width)/(im.naturalHeight||im.height), hs=hiSprite(im,h*cam.z*dpr*Math.abs(sy)); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; ctx.drawImage(hs.c,-w/2,-h,w,h); if(Math.abs(a.f)<.6){ ctx.globalAlpha=al*(.25*(1-Math.abs(a.f)/.6))/.25*.25; ctx.drawImage(darkOf(hs),-w/2,-h,w,h); ctx.globalAlpha=al; } }
    else { const fb=a.fb; ctx.fillStyle='#2f3b4a'; ctx.fillRect(-h*.07,-h*.47,h*.06,h*.47); ctx.fillRect(h*.01,-h*.47,h*.06,h*.47); ctx.fillStyle=fb.top; rr(-h*.11,-h*.82,h*.22,h*.38,h*.05); ctx.fill();
      if(fb.f){ ctx.beginPath(); ctx.moveTo(-h*.11,-h*.5); ctx.lineTo(h*.11,-h*.5); ctx.lineTo(h*.15,-h*.3); ctx.lineTo(-h*.15,-h*.3); ctx.fill(); } ctx.fillStyle=fb.hair; ctx.beginPath(); ctx.arc(0,-h*.91,h*.085,0,TAU); ctx.fill(); ctx.fillStyle=fb.sk; ctx.beginPath(); ctx.arc(0,-h*.89,h*.07,0,TAU); ctx.fill(); }
    if(a.board){ ctx.fillStyle=a.board; ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(h*.2,-h*.55,h*.07,h*.6,.08,0,TAU); ctx.fill(); ctx.stroke(); ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(h*.2,-h*1.1); ctx.lineTo(h*.2+h*.09,-h*.05); ctx.stroke(); }
    ctx.restore();
    if((a.staff||a.role==='player')&&cam.z>=.8&&al>.5){ a.tag={x,y:y-h-6}; } else a.tag=null; }
  // ================= COSMETICS (shop items, no gameplay effect): truck paint, stand decor, player outfits, pets =================
  const COSM=()=>window.COSMETICS||{}, EQ=()=>(G.st&&G.st.cos&&G.st.cos.eq)||{};
  // item lookup: season pass items reuse a base drawing (it.base) with their own palette (it.pal)
  const CI=(sl,id)=>{ const g=COSM()[sl], it=g&&g.items[id]; return {b:(it&&it.base)||id, pal:(it&&it.pal)||{}, it:it||{}}; };
  // room skins (tools/room_skins.py): swap the base room art for the recoloured version + animated extras
  const SKIN={garage:['room_garage','skin_garage_'],greenhouse:['room_gh','skin_greenhouse_'],indoor:['room_indoor','skin_indoor_']};
  function roomIm(n){ const d=SKIN[n], id=d&&EQ()[d[0]]; if(!id) return IM[n]; const b=CI(d[0],id).b; if(ok(d[1]+b)) return IM[d[1]+b]; return IM[n]; }
  function roomExtras(now){ const eq=EQ();
    if(loc==='garage'&&eq.room_garage){ const LP=CI('room_garage',eq.room_garage).pal.lights; ctx.save(); // string lights along the back beam + two surf posters
      const A=[268,112],B=[962,170]; ctx.strokeStyle='#3a2a1a'; ctx.lineWidth=1.2; ctx.beginPath(); for(let i=0;i<=40;i++){ const t=i/40, x=A[0]+(B[0]-A[0])*t, y=A[1]+(B[1]-A[1])*t+Math.sin(t*Math.PI*6)**2*10+8; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
      ctx.globalCompositeOperation='lighter'; for(let i=0;i<=24;i++){ const t=i/24, x=A[0]+(B[0]-A[0])*t, y=A[1]+(B[1]-A[1])*t+Math.sin(t*Math.PI*6)**2*10+11, c=(LP||['255,200,90','255,120,160','120,220,255','160,255,140'])[i%4], f=.75+.25*Math.sin(now*2+i*1.7);
        const g=ctx.createRadialGradient(x,y,0,x,y,12); g.addColorStop(0,'rgba('+c+','+(.9*f)+')'); g.addColorStop(1,'rgba('+c+',0)'); ctx.fillStyle=g; ctx.fillRect(x-12,y-12,24,24); ctx.fillStyle='rgba(255,250,230,'+f+')'; ctx.beginPath(); ctx.arc(x,y,2.2,0,TAU); ctx.fill(); }
      ctx.globalCompositeOperation='source-over';
      for(const [px,py,c1,c2,txt] of [[742,182,'#ff7a2a','#17a3b0','SURF'],[838,192,'#ffd34a','#e8457f','KAUAI']]){ ctx.save(); ctx.translate(px,py); ctx.rotate(.06); ctx.fillStyle='#f5ecd8'; ctx.fillRect(-26,-34,52,62); const g=ctx.createLinearGradient(0,-30,0,24); g.addColorStop(0,c1); g.addColorStop(1,c2); ctx.fillStyle=g; ctx.fillRect(-22,-30,44,44);
        ctx.fillStyle='rgba(255,240,180,.95)'; ctx.beginPath(); ctx.arc(8,-14,8,0,TAU); ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-22,4); ctx.quadraticCurveTo(-6,-12,6,2); ctx.quadraticCurveTo(14,10,22,0); ctx.stroke(); ctx.fillStyle='#2a1a10'; ctx.font='900 9px system-ui'; ctx.textAlign='center'; ctx.fillText(txt,0,24); ctx.restore(); }
      ctx.restore(); }
    if(loc==='indoor'&&eq.room_indoor){ const TP=CI('room_indoor',eq.room_indoor).pal, T1=TP.t1||'60,240,255', T2=TP.t2||'255,80,220'; ctx.save(); ctx.globalCompositeOperation='lighter'; const f=.85+.15*Math.sin(now*3.1)+(Math.random()<.01?-.4:0);
      const tube=(P,c,w)=>{ for(const [lw,al] of [[w*5,.12],[w*2.4,.3],[w,.95]]){ ctx.strokeStyle='rgba('+c+','+al*f+')'; ctx.lineWidth=lw; ctx.lineCap='round'; ctx.beginPath(); P.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke(); } };
      tube([[172,515],[1058,430]],T1,3); tube([[165,345],[690,290]],T2,2.5); tube([[700,290],[960,318]],T2,2.5);
      for(const [x,y] of [[322,258],[402,242],[490,228],[575,215],[658,204],[765,185]]){ tube([[x-38,y+2],[x+38,y-8]],(x>600?T1:T2),2.2); }
      ctx.font='900 30px system-ui'; ctx.textAlign='center'; ctx.shadowColor='rgba('+T2+',1)'; ctx.shadowBlur=18; ctx.fillStyle='rgba('+T2+','+f+')'; ctx.save(); ctx.translate(830,250); ctx.rotate(.08); ctx.fillText('ALOHA',0,0); ctx.shadowColor='rgba('+T1+',1)'; ctx.fillStyle='rgba('+T1+','+f+')'; ctx.font='800 18px system-ui'; ctx.fillText('GROW CLUB',0,24); ctx.restore();
      ctx.restore(); } }
  // Kahuna K4 paint: recolour the truck that is painted into garage.webp. Mask = low-saturation body pixels inside the truck outline,
  // new colour keeps the original shading (luminance), so reflections, panel lines and wheel arches survive. Cached per paint job.
  const TRB=[840,195,350,260];                                  // baked paint layers (tools/truck_paints.py) cover the K4 in art/garage.webp
  const truckC={};
  function truckPaint(id){ if(truckC[id]) return truckC[id]; return ok('truck_'+id)?(truckC[id]=IM['truck_'+id]):null; }
  function drawTruckPaint(){ const id=EQ().truck; if(!id) return; const c=truckPaint(id); if(c) ctx.drawImage(c,TRB[0],TRB[1]); }
  // Farm stand decor (world px around BLD.stand, metre-scaled with FARM_PPM)
  function standDecor(id0,x,y,w,M,now){ ctx.save(); const ci=CI('stand',id0), id=ci.b, pal=ci.pal;
    if(id==='tiki') for(const sx of [-1,1]){ const tx=x+sx*w*.56, ty=y+6, th=1.9*M; ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(tx,ty,.18*M,.05*M,0,0,TAU); ctx.fill();
      const g=ctx.createLinearGradient(tx-4,0,tx+4,0); g.addColorStop(0,'#5a3a1c'); g.addColorStop(.5,pal.pole||'#9a6a36'); g.addColorStop(1,'#4a2e14'); ctx.fillStyle=g; ctx.fillRect(tx-.04*M,ty-th,.08*M,th);
      ctx.strokeStyle='#3a2410'; ctx.lineWidth=1.2; for(let k=1;k<7;k++){ ctx.beginPath(); ctx.moveTo(tx-.04*M,ty-th+k*th/7); ctx.lineTo(tx+.04*M,ty-th+k*th/7-2); ctx.stroke(); }
      ctx.fillStyle='#7a5228'; ctx.beginPath(); ctx.moveTo(tx-.11*M,ty-th); ctx.lineTo(tx+.11*M,ty-th); ctx.lineTo(tx+.07*M,ty-th+.22*M); ctx.lineTo(tx-.07*M,ty-th+.22*M); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#c9a36a'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(tx-.1*M,ty-th+.06*M); ctx.lineTo(tx+.1*M,ty-th+.06*M); ctx.moveTo(tx-.08*M,ty-th+.15*M); ctx.lineTo(tx+.08*M,ty-th+.15*M); ctx.stroke();
      const f=Math.sin(now*9+sx*3)*.5+Math.sin(now*13.7+sx)*.3, fh=.34*M*(1+.12*f); ctx.globalCompositeOperation='lighter'; const fg=ctx.createRadialGradient(tx,ty-th-fh*.3,2,tx,ty-th-fh*.3,M*.9); fg.addColorStop(0,'rgba(255,170,60,.35)'); fg.addColorStop(1,'rgba(255,120,30,0)'); ctx.fillStyle=fg; ctx.fillRect(tx-M,ty-th-M*1.2,2*M,2*M); ctx.globalCompositeOperation='source-over';
      const FL=pal.flame||['#ff6a1a','#ffb431','#fff1a8']; for(const [c,s] of [[FL[0],1],[FL[1],.7],[FL[2],.38]]){ ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(tx-.09*M*s,ty-th); ctx.quadraticCurveTo(tx-.12*M*s,ty-th-fh*s*.5,tx+f*3*s,ty-th-fh*s); ctx.quadraticCurveTo(tx+.12*M*s,ty-th-fh*s*.5,tx+.09*M*s,ty-th); ctx.closePath(); ctx.fill(); } }
    if(id==='lei'){ const x0=x-w*.44, x1=x+w*.44, yy=y-1.05*M, n=26; ctx.strokeStyle='#2f6a2a'; ctx.lineWidth=1.5; ctx.beginPath(); for(let i=0;i<=n;i++){ const t=i/n, px=x0+(x1-x0)*t, py=yy+Math.sin(t*Math.PI*3)**2*.22*M; i?ctx.lineTo(px,py):ctx.moveTo(px,py); } ctx.stroke();
      for(let i=0;i<=n;i++){ const t=i/n, px=x0+(x1-x0)*t, py=yy+Math.sin(t*Math.PI*3)**2*.22*M, col=(pal.f||['#fff4f0','#ffd2e6','#ff5c9a','#fff07a','#c97bff'])[i%5], r=.1*M;
        ctx.fillStyle='#3f8a34'; ctx.beginPath(); ctx.ellipse(px+r*.6,py+r*.3,r*.7,r*.3,.6,0,TAU); ctx.fill();
        ctx.fillStyle=col; for(let k=0;k<5;k++){ const a=k*TAU/5+i; ctx.beginPath(); ctx.ellipse(px+Math.cos(a)*r*.5,py+Math.sin(a)*r*.5,r*.42,r*.28,a,0,TAU); ctx.fill(); } ctx.fillStyle='#ffc93a'; ctx.beginPath(); ctx.arc(px,py,r*.18,0,TAU); ctx.fill(); }
      for(const sx of [x0,x1]){ for(let k=0;k<5;k++){ ctx.fillStyle=['#ff5c9a','#fff4f0','#fff07a'][k%3]; ctx.beginPath(); ctx.arc(sx,yy+k*.08*M,.05*M,0,TAU); ctx.fill(); } } }
    if(id==='surf'){ const bx=x+w*.68, by=y+4, bh=2.15*M, bw=.52*M; ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(bx,by,bw*.7,.07*M,0,0,TAU); ctx.fill();
      ctx.save(); ctx.translate(bx,by); ctx.rotate(.07); ctx.beginPath(); ctx.moveTo(0,-bh); ctx.bezierCurveTo(bw*.62,-bh*.82,bw*.56,-bh*.12,bw*.3,0); ctx.lineTo(-bw*.3,0); ctx.bezierCurveTo(-bw*.56,-bh*.12,-bw*.62,-bh*.82,0,-bh); ctx.closePath();
      const g=ctx.createLinearGradient(-bw/2,0,bw/2,0); g.addColorStop(0,'#e6d6b4'); g.addColorStop(.45,'#fff7e6'); g.addColorStop(1,'#d2bf98'); ctx.fillStyle=g; ctx.fill(); ctx.save(); ctx.clip();
      ctx.fillStyle=pal.s1||'#17a3b0'; ctx.fillRect(-bw,-bh*.9,bw*2,bh*.08); ctx.fillStyle=pal.s2||'#ff7a2a'; ctx.fillRect(-bw,-bh*.8,bw*2,bh*.04); ctx.fillStyle=pal.s3||pal.s1||'#17a3b0'; ctx.fillRect(-bw,-bh*.2,bw*2,bh*.05);
      ctx.strokeStyle='rgba(120,90,50,.5)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,-bh); ctx.lineTo(0,0); ctx.stroke(); ctx.restore();
      ctx.strokeStyle='#8a6a3a'; ctx.lineWidth=1.2; ctx.stroke();
      ctx.fillStyle='#1d4f6a'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='900 '+Math.round(.2*M)+'px system-ui,sans-serif'; 'ALOHA'.split('').forEach((ch,i)=>ctx.fillText(ch,0,-bh*.7+i*.23*M));
      ctx.font='800 '+Math.round(.085*M)+'px system-ui,sans-serif'; ctx.fillStyle='#b04a1a'; ctx.fillText('FRESH',0,-bh*.29); ctx.fillText('KAUAI',0,-bh*.25); ctx.restore(); }
    ctx.restore(); }
  function standDecorAll(list,now){ const b=BLD.stand, eq=EQ(); if(!eq.stand||!ok(b.img)) return; const w=IM[b.img].naturalWidth*b.s; list.push({y:b.y+(eq.stand==='lei'?.5:8),draw:()=>standDecor(eq.stand,b.x,b.y,w,FARM_PPM,t)}); }
  // Player outfit: recolour the base adult figure's clothing (pixel mask: non-skin, cloth-toned pixels in the clothing band), keep shading.
  const outfitC={};
  function outfitSprite(id0){ if(outfitC[id0]!==undefined) return outfitC[id0]; const ci=CI('outfit',id0), id=ci.b, pal=ci.pal, base='npc_tank'; if(!ok(base)) return null; const im=IM[base], w=im.naturalWidth, h=im.naturalHeight;
    const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.drawImage(im,0,0); let D; try{ D=x.getImageData(0,0,w,h); }catch(e){ return outfitC[id0]=im; } const a=D.data;
    const band=id==='poncho'?[.13,.66]:id==='overalls'?[.27,.66]:[.14,.5], M=new Uint8Array(w*h);
    for(let j=Math.floor(band[0]*h);j<band[1]*h;j++) for(let i=0;i<w;i++){ const o=(j*w+i)*4; if(a[o+3]<40) continue; const r=a[o],g=a[o+1],b=a[o+2], sat=Math.max(r,g,b)-Math.min(r,g,b), skin=r>g+12&&g>b&&r-b>34&&r>70;
      const isShirt=j<.48*h&&sat<38&&!skin, isShorts=j>=.44*h&&!skin; if(id==='aloha'?isShirt:id==='overalls'?(isShorts||(isShirt&&Math.abs(i-w*.5)<w*.16&&j>.3*h)):(isShirt||isShorts||(j<.5*h&&!skin&&sat<60))) M[j*w+i]=1; }
    const col=pal.col||(id==='aloha'?[205,40,48]:id==='poncho'?[255,206,28]:[52,92,150]), flc=pal.fl||[255,236,190];
    for(let k=0;k<w*h;k++){ if(!M[k]) continue; const o=k*4, l=(a[o]*.3+a[o+1]*.59+a[o+2]*.11)/110, kk=id==='poncho'?.65+.45*l:Math.pow(l,.9);
      let [r,g,b]=col; if(id==='aloha'){ const i=k%w, j=(k/w)|0, ox=(Math.floor(j/26)%2)*11, di=((i+ox)%22)-11, dj=(j%26)-13, rr2=di*di+dj*dj; if(rr2<26){ [r,g,b]=flc; } else if(rr2<34){ r=255; g=170; b=60; } }
      if(id==='overalls'){ const i=k%w; if(Math.abs(i-w*.5)%14<1.3) { r=200; g=150; b=60; } }
      a[o]=Math.min(255,r*kk); a[o+1]=Math.min(255,g*kk); a[o+2]=Math.min(255,b*kk); }
    if(id==='overalls'){ // shoulder straps
      for(let j=Math.floor(.15*h);j<.3*h;j++) for(const cx of [.4,.6]){ const ci=Math.round(cx*w+(j-.3*h)*(cx<.5?-.12:.12)); for(let i=ci-3;i<=ci+3;i++){ const o=(j*w+i)*4; if(a[o+3]<40) continue; const l=(a[o]*.3+a[o+1]*.59+a[o+2]*.11)/120; a[o]=52*(.6+l*.5); a[o+1]=92*(.6+l*.5); a[o+2]=150*(.6+l*.5); } } }
    x.putImageData(D,0,0); if(id==='poncho'){ x.globalCompositeOperation='source-atop'; x.fillStyle='rgba(255,255,255,.08)'; for(let j=0;j<6;j++) x.fillRect(0,h*(.2+j*.07),w,2); }
    return outfitC[id0]=c; }
  // Pets: vector-drawn, use the people actor system (same eased splines, depth scaling and sun shadow) via a.pet
  function drawPet(a,now){ const ppm=ppmAt(a.y), al=a.alpha; if(al<.02) return; const pci=CI('pet',a.pet), kind=pci.b, ppal=pci.pal, sf=Math.min(1,a.v/.9), ph=a.ph*1.6, M=ppm;
    ctx.save(); ctx.globalAlpha=al; ctx.fillStyle='rgba(0,0,0,.26)'; ctx.beginPath(); ctx.ellipse(a.x,a.y,(kind==='moa'?.16:.3)*M,.05*M,0,0,TAU); ctx.fill();
    ctx.translate(a.x,a.y); const fx=Math.sign(a.f||1)*Math.max(.15,Math.abs(a.f)); ctx.scale(fx,1);
    const leg=(x0,y0,len,ang,c,wd)=>{ ctx.strokeStyle=c; ctx.lineWidth=wd; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x0+Math.sin(ang)*len,y0+Math.cos(ang)*len); ctx.stroke(); };
    if(kind==='dog'||kind==='cat'){ const D=kind==='dog', body=ppal.body||(D?'#c58a4a':'#e08a3a'), dark=ppal.dark||(D?'#8a5a2a':'#b0601e'), lh=(D?.24:.17)*M, bl=(D?.5:.42)*M, bh=(D?.2:.15)*M, by=-lh-bh*.45+(sf?Math.abs(Math.sin(ph))*.015*M:Math.sin(now*2+a.id)*.004*M);
      const sw=sf*.55; leg(-bl*.32,by+bh*.3,lh,Math.sin(ph)*sw,dark,.06*M); leg(bl*.3,by+bh*.3,lh,-Math.sin(ph)*sw,dark,.06*M);
      ctx.save(); ctx.translate(-bl*.5,by-bh*.1); ctx.rotate(D?-.9+Math.sin(now*(sf?9:4))*.35:-1.3+Math.sin(now*1.5)*.25); ctx.strokeStyle=body; ctx.lineWidth=(D?.07:.05)*M; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(-.1*M,-.14*M,(D?-.05:.06)*M,-(D?.22:.32)*M); ctx.stroke(); ctx.restore();
      const g=ctx.createLinearGradient(0,by-bh/2,0,by+bh/2); g.addColorStop(0,body); g.addColorStop(1,dark); ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(0,by,bl/2,bh/2,0,0,TAU); ctx.fill();
      if(!D){ ctx.strokeStyle='rgba(120,50,10,.55)'; ctx.lineWidth=.025*M; for(let k=-2;k<=2;k++){ ctx.beginPath(); ctx.moveTo(k*bl*.13,by-bh*.48); ctx.lineTo(k*bl*.13-bl*.03,by+bh*.05); ctx.stroke(); } }
      else { ctx.fillStyle='#f3e2c4'; ctx.beginPath(); ctx.ellipse(bl*.2,by+bh*.18,bl*.2,bh*.25,0,0,TAU); ctx.fill(); }
      leg(-bl*.22,by+bh*.3,lh,-Math.sin(ph)*sw,body,.065*M); leg(bl*.38,by+bh*.3,lh,Math.sin(ph)*sw,body,.065*M);
      const hx=bl*.52, hy=by-bh*.55+(D?0:.02*M), hr=(D?.12:.1)*M; ctx.fillStyle=body; ctx.beginPath(); ctx.ellipse(hx,hy,hr,hr*.9,0,0,TAU); ctx.fill();
      if(D){ ctx.fillStyle='#f3e2c4'; ctx.beginPath(); ctx.ellipse(hx+hr*.8,hy+hr*.3,hr*.6,hr*.42,0,0,TAU); ctx.fill(); ctx.fillStyle='#1a1410'; ctx.beginPath(); ctx.arc(hx+hr*1.35,hy+hr*.15,hr*.18,0,TAU); ctx.fill();
        ctx.fillStyle=dark; ctx.beginPath(); ctx.ellipse(hx-hr*.35,hy-hr*.2,hr*.28,hr*.62,.5+Math.sin(now*3)*.1,0,TAU); ctx.fill(); }
      else { ctx.fillStyle=body; for(const ex of [-.45,.35]){ ctx.beginPath(); ctx.moveTo(hx+hr*ex-hr*.3,hy-hr*.6); ctx.lineTo(hx+hr*ex,hy-hr*1.45); ctx.lineTo(hx+hr*ex+hr*.35,hy-hr*.55); ctx.closePath(); ctx.fill(); } ctx.fillStyle='#f6d2b0'; ctx.beginPath(); ctx.ellipse(hx+hr*.55,hy+hr*.35,hr*.45,hr*.32,0,0,TAU); ctx.fill();
        ctx.fillStyle='#ff9ab0'; ctx.beginPath(); ctx.arc(hx+hr*.95,hy+hr*.15,hr*.12,0,TAU); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.lineWidth=.6; for(const s of [-1,1]){ ctx.beginPath(); ctx.moveTo(hx+hr*.9,hy+hr*.3); ctx.lineTo(hx+hr*1.6,hy+hr*(.3+s*.2)); ctx.stroke(); } }
      ctx.fillStyle=D?'#1a1410':'#3a8a2a'; ctx.beginPath(); ctx.arc(hx+hr*.45,hy-hr*.18,hr*.13,0,TAU); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(hx+hr*.5,hy-hr*.24,hr*.05,0,TAU); ctx.fill();
      if(D){ ctx.fillStyle='#e0303a'; ctx.fillRect(hx-hr*.95,hy+hr*.35,hr*.4,hr*.6); } }
    else { // moa (red jungle fowl): body, sickle tail, comb, pecking idle
      const peck=!sf?Math.max(0,Math.sin(now*2.4+a.id*1.7))**8:0, lh=.12*M, by=-lh-.1*M; leg(-.03*M,by+.07*M,lh,Math.sin(ph*1.5)*.5*sf,'#d4a23a',.022*M); leg(.03*M,by+.07*M,lh,-Math.sin(ph*1.5)*.5*sf,'#d4a23a',.022*M);
      for(const [c,r] of [['#1c3a5a',1],['#1f6a4a',.8],['#2a2a2a',.6]]){ ctx.strokeStyle=c; ctx.lineWidth=.03*M; ctx.beginPath(); ctx.moveTo(-.08*M,by-.02*M); ctx.quadraticCurveTo(-.24*M*r,by-.3*M*r,-.18*M*r-.05*M,by-.02*M); ctx.stroke(); }
      const g=ctx.createLinearGradient(0,by-.1*M,0,by+.1*M); g.addColorStop(0,ppal.body||'#c8501e'); g.addColorStop(1,ppal.dark||'#5a2a10'); ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(0,by,.12*M,.09*M,-.15,0,TAU); ctx.fill();
      ctx.fillStyle='#1f4a3a'; ctx.beginPath(); ctx.ellipse(-.02*M,by+.01*M,.07*M,.045*M,-.3,0,TAU); ctx.fill();
      ctx.save(); ctx.translate(.08*M,by-.06*M); ctx.rotate(peck*1.3); ctx.fillStyle='#e8a030'; ctx.beginPath(); ctx.ellipse(.02*M,-.06*M,.045*M,.08*M,.3,0,TAU); ctx.fill();
      ctx.fillStyle='#d8261e'; ctx.beginPath(); ctx.arc(.05*M,-.15*M,.025*M,0,TAU); ctx.arc(.08*M,-.14*M,.022*M,0,TAU); ctx.arc(.025*M,-.145*M,.02*M,0,TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(.07*M,-.07*M,.012*M,.025*M,0,0,TAU); ctx.fill();
      ctx.fillStyle='#f0c040'; ctx.beginPath(); ctx.moveTo(.08*M,-.11*M); ctx.lineTo(.13*M,-.1*M); ctx.lineTo(.08*M,-.09*M); ctx.fill(); ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(.055*M,-.115*M,.008*M,0,TAU); ctx.fill(); ctx.restore(); }
    ctx.restore(); }
  // player + pet behaviour on farm and garage: wander between spots near the stand / garage floor
  function cosSpot(){ if(loc==='garage'){ const u=.7+Math.random()*2.6, v=.2+Math.random()*1.2; return GP(u,v); } return {x:640+Math.random()*440,y:1250+Math.random()*60}; } // farm: hang around the stand so you and your pet stay in the usual view
  function cosPlace(x,y){ for(const a of actors){ if(a.role==='player'||a.role==='pet'){ a.x=x+(a.role==='pet'?34:-20); a.y=y+(a.role==='pet'?10:0); a.sp=null; a.state='idle'; a.next=8; } } }
  function cosActors(dt){ const eq=EQ(), here=(loc==='farm'&&G.st.land)||loc==='garage';
    let pl=actors.find(a=>a.role==='player'); if(eq.outfit&&here){ if(!pl){ const s=cosSpot(); pl=spawn({role:'player',outfit:eq.outfit,x:s.x,y:s.y,vmax:1.15,next:1}); } pl.outfit=eq.outfit; } else if(pl&&!pl.dead){ pl.fade=0; pl.dead=pl.t+.6; }
    let pt=actors.find(a=>a.role==='pet'); if(eq.pet&&here){ if(pt&&pt.pet!==eq.pet){ pt.fade=0; pt.dead=pt.t+.4; pt.role='petold'; pt=null; } if(!pt){ const s=cosSpot(); pt=spawn({role:'pet',pet:eq.pet,x:s.x,y:s.y,vmax:eq.pet==='moa'?.55:.95,next:.5}); } } else if(pt&&!pt.dead){ pt.fade=0; pt.dead=pt.t+.6; }
    for(const a of [pl,pt]){ if(!a||a.dead||a.state==='walk') continue; a.next-=dt; if(a.next>0) continue; a.next=(a.role==='pet'?1.5:3)+Math.random()*(a.role==='pet'?3:6);
      let d=cosSpot(); if(a.role==='pet'&&pl&&!pl.dead&&Math.random()<.7){ const m=ppmAt(pl.y); d={x:pl.x+(Math.random()<.5?-1:1)*(.6+Math.random()*.6)*m,y:pl.y+(Math.random()*.6-.1)*m}; }
      const dist=Math.hypot(d.x-a.x,d.y-a.y); if(dist>8) walkTo(a,[{x:(a.x+d.x)/2+(Math.random()-.5)*dist*.2,y:(a.y+d.y)/2},d]); } }
  // previews for the shop's equip screen: same drawing code as the game, into a small canvas
  function cosPreview(cx2,sl,id,o){ const keep=ctx, W2=cx2.canvas.width, H2=cx2.canvas.height; ctx=cx2; cx2.save(); cx2.clearRect(0,0,W2,H2); const now=o&&o.now!=null?o.now:performance.now()/1000;
    try{ if(sl==='truck'&&ok('truckcard_'+id)){ const im=IM['truckcard_'+id], sc=Math.max(W2/im.naturalWidth,H2/im.naturalHeight), w=im.naturalWidth*sc, h=im.naturalHeight*sc; cx2.imageSmoothingQuality='high'; cx2.drawImage(im,(W2-w)/2,(H2-h)/2,w,h); } else if(sl==='truck'){ const c=truckPaint(id)||null; const s=Math.min(W2/TRB[2],H2/TRB[3]); cx2.imageSmoothingQuality='high'; if(ok('garage')) cx2.drawImage(IM.garage,TRB[0],TRB[1],TRB[2],TRB[3],(W2-TRB[2]*s)/2,(H2-TRB[3]*s)/2,TRB[2]*s,TRB[3]*s); if(c) cx2.drawImage(c,(W2-TRB[2]*s)/2,(H2-TRB[3]*s)/2,TRB[2]*s,TRB[3]*s); }
      else if(sl==='stand'){ const b=BLD.stand; if(ok(b.img)){ const im=IM[b.img], s=Math.min(W2*.6/im.naturalWidth,H2*.66/im.naturalHeight), w=im.naturalWidth*s, h=im.naturalHeight*s, x=W2*(id==='surf'?.42:.5), y=H2*.9, M=FARM_PPM*s/b.s;
          cx2.fillStyle='#7aa84a'; cx2.fillRect(0,y-4,W2,H2); cx2.imageSmoothingQuality='high'; cx2.drawImage(hiSprite(im,h).c,x-w/2,y-h,w,h); standDecor(id,x,y,w,M,now); } }
      else if(sl==='outfit'){ const im=outfitSprite(id); if(im){ const h=H2*.92, w=h*im.width/im.height; cx2.imageSmoothingQuality='high'; cx2.drawImage(hiSprite(im,h).c,(W2-w)/2,H2*.96-h,w,h); } }
      else if(sl.startsWith('room_')){ const base={room_garage:'garage',room_gh:'greenhouse',room_indoor:'indoor'}[sl], n=SKIN[base][1]+CI(sl,id).b, im=ok(n)?IM[n]:IM[base]; if(im){ const sc=Math.min(W2/im.naturalWidth,H2/im.naturalHeight), w=im.naturalWidth*sc, h=im.naturalHeight*sc; cx2.imageSmoothingQuality='high'; cx2.drawImage(hiSprite(im,h).c,(W2-w)/2,(H2-h)/2,w,h);
        if(base!=='greenhouse'){ const keepL=loc; loc=base; const eq=G.st.cos.eq, k0=eq[sl]; eq[sl]=id; cx2.save(); cx2.translate((W2-w)/2,(H2-h)/2); cx2.scale(w/im.naturalWidth*(base==='indoor'?im.naturalWidth/1100:1),h/im.naturalHeight*(base==='indoor'?im.naturalHeight/680:1)); roomExtras(now); cx2.restore(); eq[sl]=k0; loc=keepL; } } }
      else if(sl==='pet'){ const M=Math.min(W2/0.85,H2/0.7)*(id==='moa'?1.25:1); const a={pet:id,x:W2*.5,y:H2*.9,v:0,ph:now*3,alpha:1,f:1,id:1}; drawPetAt(a,now,M); } }
    catch(e){} cx2.restore(); ctx=keep; }
  function drawPetAt(a,now,M){ const keepP=ppmOverride; ppmOverride=M; try{ drawPet(a,now); } finally{ ppmOverride=keepP; } }

  // ---- roles ----
  // Standing spots sit OUTSIDE every footprint: in front of the indoor bench block, at tent doors, in front of the veg rack.
  const IFRONT=[[209,442],[371,546],[935,381]];     // indoor bench block front edge (left face, front corner, right end), measured on indoor.webp
  function floorOf(s){
    if(loc==='indoor'){ if(s.x<380){ const t=Math.max(0,Math.min(1,(s.y-230)/180)); return {x:209+162*t-24,y:442+104*t+16}; } const x=Math.min(925,s.x+18); return {x,y:546-(x-371)*.2926+20}; }
    if(loc==='garage'){ if(s.rack) return GP(s.u,.25);
      if(s.row!=null) return GP(s.u,s.v-.4); if(s.tent){ const T=TENTS.find(t=>t.id===s.tent), tr=T&&tentRect(T,G.st.garage); if(tr){ const [u0,u1,v0]=tr.r; return GP(Math.max(u0+.25,Math.min(u1-.25,s.u)),Math.max(.2,v0-.45)); } } }
    return {x:s.x+.3*s.ppm,y:(s.fy||s.y)+4}; }
  // farm building footprints (ellipse on the ground under each building); routes detour in front of them
  function farmFoot(){ const F=[]; for(const k in BLD){ const b=BLD[k]; if(b.need&&!b.need()||!ok(b.img)) continue; const w=IM[b.img].naturalWidth*b.s; F.push({x:b.x,y:b.y-w*.13,rx:w*.52,ry:w*.17,front:b.y+24}); } return F; }
  function detour(P){ if(loc!=='farm') return P; const F=farmFoot(); const out=[P[0]];
    for(let i=1;i<P.length;i++){ const a=P[i-1], b=P[i];
      for(const f of F){ const inF=q=>((q.x-f.x)/f.rx)**2+((q.y-f.y)/f.ry)**2<1; if(inF(a)||inF(b)) continue; let hit=null; for(let k=1;k<12;k++){ const q={x:a.x+(b.x-a.x)*k/12,y:a.y+(b.y-a.y)*k/12}; if(inF(q)){ hit=q; break; } }
        if(hit){ const side=hit.x<f.x?-1:1; out.push({x:f.x+side*f.rx*.75,y:f.front},{x:f.x-side*f.rx*.2,y:f.front+6}); } }
      out.push(b); }
    return out; }
  function sendWorker(){ /* helpers stay off the beds; finished work shows as one portrait summary */ }
  const CUSTF=['npc_sundress','npc_tourist'], CUSTM=['npc_tank','npc_aloha'], CUSTN={'Auntie Rose':'npc_sundress','Uncle Bo':'npc_elder','Surfer Jake':'npc_tank','Tourist Brenda':'npc_tourist','Chef Kekoa':'npc_aloha','Dr. Akana':'npc_aloha','Leilani':'npc_sundress','Pua':'npc_sundress','Hoku':'npc_tourist','Coach Mahina':'npc_tourist','Kimo':'npc_tank','Makoa':'npc_aloha','Nalu':'npc_tank','Kalani':'npc_elder'};
  const custSprite=c=>CUSTN[c.who]||(hash(c.id)&1?CUSTF:CUSTM)[hash(c.id)%2];
  const PATH=[{x:300,y:1300},{x:560,y:1300},{x:820,y:1318},{x:1080,y:1312},{x:1350,y:1300}];
  function people(list,dt,now){ const st=G.st; cosActors(dt);
    // managers walk their own location
    const S=STAFF[loc]; let mg=actors.find(a=>a.role==='mgr');
    if(S&&S.need()){ if(!mg){ const own=st.plots.filter(p=>p.loc===loc&&p.owned).map(p=>slotOf.get(p.id)).filter(Boolean); if(own.length){ const f=floorOf(own[aid%own.length]); mg=spawn({role:'mgr',staff:S,x:f.x,y:f.y,vmax:1.1,next:1}); } } }
    else if(mg){ mg.fade=0; mg.dead=mg.t+.6; }
    if(mg&&!mg.dead&&mg.state!=='walk'){ mg.next-=dt; if(mg.next<=0){ const own=st.plots.filter(p=>p.loc===loc&&p.owned&&p.strain).map(p=>slotOf.get(p.id)).filter(Boolean); if(own.length){ const f=floorOf(own[Math.floor(Math.random()*own.length)]); walkTo(mg,route({x:mg.x,y:mg.y},f).slice(1),a=>{ a.state='work'; a.next=2+Math.random()*3; }); } else mg.next=3; } }
    if(loc==='farm'&&st.land){ const b=BLD.stand;
      // customers walk in along the path, queue at the stand, browse, then walk off when served or tired of waiting
      (st.cust||[]).slice(0,4).forEach((c,i)=>{ if(actors.some(a=>a.cid===c.id)) return; const spot={x:b.x+[-50,60,150,-140][i],y:b.y+[30,18,36,44][i]}; if((c.T||0)>8){ spawn({role:'cust',cid:c.id,c,at:1,img:custSprite(c),x:spot.x,y:spot.y,face:i===1?-1:1,f:i===1?-1:1,say:window.CUST_LINES?{text:CUST_LINES.pick('ask',c.who,prefShort(c.pref)),t:0,life:5}:null}); return; }
        const a=spawn({role:'cust',cid:c.id,c,img:custSprite(c),x:PATH[0].x,y:PATH[0].y,delay:i*1.8});
        walkTo(a,[PATH[1],{x:spot.x-40,y:spot.y+30},spot],a=>{ a.face=i===1?-1:1; a.state='idle'; a.at=1; if(window.CUST_LINES) a.say={text:CUST_LINES.pick('ask',c.who,prefShort(c.pref)),t:0,life:4.5}; }); });
      actors.filter(a=>a.role==='cust'&&!a.leaving&&!(a.hold>0)&&!(st.cust||[]).some(c=>c.id===a.cid)).forEach(a=>{ a.leaving=1; walkTo(a,[{x:a.x+80,y:a.y+50},PATH[3],PATH[4]],a=>{ a.fade=0; a.dead=a.t+.6; }); });
      actors.filter(a=>a.leaving&&a.sp&&a.s>a.sp.len*.75).forEach(a=>a.fade=0);
      // the odd visitor strolling the path
      const busy=(G.marketDay&&G.marketDay())||G.evFx('swell'); if(hq()||busy){ walkT-=dt; if(walkT<=0&&actors.filter(a=>a.role==='walk').length<(busy?(hq()?5:3):2)){ walkT=busy?3+Math.random()*5:14+Math.random()*20; const dir=Math.random()<.5, P=dir?PATH:[...PATH].reverse();
        const a=spawn({role:'walk',img:PEOPLE.walker[Math.floor(Math.random()*PEOPLE.walker.length)],x:P[0].x,y:P[0].y,vmax:.9+Math.random()*.4,board:G.evFx('swell')&&Math.random()<.6?['#ffd23a','#3ab0ff','#ff6a4a','#ffffff'][aid%4]:null}); walkTo(a,P.slice(1),a=>{ a.fade=0; a.dead=a.t+.6; }); } } }
    for(const a of actors){ if(a.hold>0) a.hold-=dt; if(a.say){ a.say.t+=dt; if(a.say.t>16) a.say.t=0; } if(a.react) a.react.t+=dt; updActor(a,dt); if(a.role==='walk'&&a.sp&&a.s>a.sp.len-30) a.fade=0; }
    for(let i=actors.length-1;i>=0;i--){ const a=actors[i]; if(a.dead&&a.t>a.dead) actors.splice(i,1); }
    for(const a of actors) list.push({y:a.y,draw:()=>drawActor(a,now)}); }
  function nameTags(){ custBubbles(); for(const a of actors){ if(!a.tag) continue; const s=toS(a.tag.x,a.tag.y); pill(s.x,s.y-8,a.staff?a.staff.name:'You','rgba(16,30,22,.8)','#ffe9a8',10); } }
  // ---------------- drawing helpers ----------------
  function pill(x,y,text,bg,fg,size){ ctx.font='700 '+(size||11)+'px system-ui,-apple-system,Segoe UI,Roboto,sans-serif'; const w=ctx.measureText(text).width+12, h=(size||11)+8;
    ctx.fillStyle=bg; rr(x-w/2,y-h/2,w,h,h/2); ctx.fill(); ctx.fillStyle=fg; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,x,y+.5); return {x:x-w/2,y:y-h/2,w,h}; }
  function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function quad(a,b,c,d){ ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.closePath(); }
  function fabricPot(x,y,ppm,small,tray){ const w=(small?.32:.42)*ppm, h=(small?.24:.32)*ppm;
    if(tray){ ctx.fillStyle='rgba(30,30,30,.55)'; ctx.beginPath(); ctx.ellipse(x,y+h,w*.68,w*.2,0,0,TAU); ctx.fill(); }
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x+3,y+h,w*.6,w*.18,0,0,TAU); ctx.fill();
    const g=ctx.createLinearGradient(x-w/2,0,x+w/2,0); g.addColorStop(0,'#1b1b1d'); g.addColorStop(.45,'#3a3a3e'); g.addColorStop(1,'#151517');
    ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(x-w/2,y); ctx.lineTo(x-w*.46,y+h); ctx.ellipse(x,y+h,w*.46,w*.13,0,Math.PI,0,true); ctx.lineTo(x+w/2,y); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#4a3524'; ctx.beginPath(); ctx.ellipse(x,y,w/2,w*.14,0,0,TAU); ctx.fill(); ctx.strokeStyle='#2a2a2c'; ctx.lineWidth=1.5; ctx.stroke(); }
  function bucketPot(x,y,ppm){ const w=.36*ppm, h=.32*ppm, b=w*.84, ty=y+h;
    // drip tray (square black tray with a lip and a thin film of runoff)
    const tw=w*1.42, td=tw*.34; ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x+2,ty+3,tw*.56,td*.6,0,0,TAU); ctx.fill();
    ctx.fillStyle='#1d1f22'; ctx.beginPath(); ctx.roundRect(x-tw/2,ty-td/2,tw,td,td*.35); ctx.fill(); ctx.fillStyle='#2c3034'; ctx.beginPath(); ctx.roundRect(x-tw/2+2,ty-td/2+1.5,tw-4,td-4,td*.3); ctx.fill();
    ctx.fillStyle='rgba(150,190,220,.22)'; ctx.beginPath(); ctx.ellipse(x-tw*.12,ty,tw*.3,td*.22,0,0,TAU); ctx.fill(); ctx.fillStyle='#16181a'; ctx.fillRect(x-tw/2+td*.3,ty+td/2-2,tw-td*.6,2);
    // 5-gal bucket: tapered, ribbed, with a rim and wire handle
    const g=ctx.createLinearGradient(x-w/2,0,x+w/2,0); g.addColorStop(0,'#16171a'); g.addColorStop(.35,'#3b3d42'); g.addColorStop(.55,'#2c2e32'); g.addColorStop(1,'#111214');
    ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(x-w/2,y); ctx.lineTo(x-b/2,ty); ctx.ellipse(x,ty,b/2,b*.14,0,Math.PI,0,true); ctx.lineTo(x+w/2,y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=1; for(const f of [.3,.62]){ const yy=y+h*f, ww=w-(w-b)*f; ctx.beginPath(); ctx.ellipse(x,yy,ww/2,ww*.13,0,0,Math.PI); ctx.stroke(); }
    ctx.fillStyle='#4a4c51'; ctx.beginPath(); ctx.ellipse(x,y,w/2+1.5,w*.15+1,0,0,TAU); ctx.fill();
    ctx.fillStyle='#4a3524'; ctx.beginPath(); ctx.ellipse(x,y,w/2-1,w*.13,0,0,TAU); ctx.fill(); ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x,y+1,w/2-3,w*.09,0,0,Math.PI); ctx.fill();
    ctx.strokeStyle='#8a8d92'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x-w/2+1,y+h*.08); ctx.quadraticCurveTo(x,y+h*.55,x+w/2-1,y+h*.08); ctx.stroke(); }
  // ---------------- upgrade props ----------------
  // Static props are painted once into an offscreen canvas at the current device scale and finished like the room art:
  // fine grain, warm key light from the top-left, cool falloff bottom-right and base occlusion. Animated bits stay live.
  const propC=new Map(); let noiseC=null;
  function noisePat(g){ if(!noiseC){ noiseC=document.createElement('canvas'); noiseC.width=noiseC.height=96; const n=noiseC.getContext('2d'), d=n.createImageData(96,96); for(let i=0;i<d.data.length;i+=4){ const v=100+Math.random()*110|0; d.data[i]=d.data[i+1]=d.data[i+2]=v; d.data[i+3]=255; } n.putImageData(d,0,0); } return g.createPattern(noiseC,'repeat'); }
  function pSpr(key,k,wM,hM,fn){ const q=Math.max(8,Math.round(k*cam.z*dpr/6)*6), id=key+'|'+q; let s=propC.get(id); if(s) return s;
    const W0=Math.ceil(wM*q)+8, H0=Math.ceil(hM*q)+8, c=document.createElement('canvas'); c.width=W0; c.height=H0; const g=c.getContext('2d'); g.translate(W0/2,H0-4);
    const keep=ctx; ctx=g; try{ fn({x:0,y:0},q); } finally{ ctx=keep; }
    g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation='source-atop';
    g.globalAlpha=.06; g.fillStyle=noisePat(g); g.fillRect(0,0,W0,H0); g.globalAlpha=1;
    const L=g.createLinearGradient(0,0,W0*.8,H0); L.addColorStop(0,'rgba(255,246,228,.14)'); L.addColorStop(.45,'rgba(255,255,255,0)'); L.addColorStop(1,'rgba(18,22,30,.24)'); g.fillStyle=L; g.fillRect(0,0,W0,H0);
    const A=g.createLinearGradient(0,H0*.72,0,H0); A.addColorStop(0,'rgba(0,0,0,0)'); A.addColorStop(1,'rgba(0,0,0,.2)'); g.fillStyle=A; g.fillRect(0,0,W0,H0); g.globalCompositeOperation='source-over';
    s={c,W0,H0,q}; if(propC.size>400) propC.clear(); propC.set(id,s); return s; }
  // soft contact shadow on the floor (room light is overhead, slightly from the front-left)
  function cshadow(p,k,w,d){ const cx=p.x+.04*k, cy=p.y+.01*k, g=ctx.createRadialGradient(cx,cy,0,cx,cy,w*k); g.addColorStop(0,'rgba(0,0,0,.42)'); g.addColorStop(.6,'rgba(0,0,0,.18)'); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.save(); ctx.fillStyle=g; ctx.translate(cx,cy); ctx.scale(1,d||.32); ctx.translate(-cx,-cy); ctx.beginPath(); ctx.arc(cx,cy,w*k,0,TAU); ctx.fill(); ctx.restore(); }
  function drawProp(key,p,k,wM,hM,fn,sw){ if(sw) cshadow(p,k,sw); const s=pSpr(key,k,wM,hM,fn), r=k/s.q; ctx.drawImage(s.c,p.x-s.W0/2*r,p.y-(s.H0-4)*r,s.W0*r,s.H0*r); }
  const LG=(x0,y0,x1,y1,c)=>{ const g=ctx.createLinearGradient(x0,y0,x1,y1); c.forEach((cc,i)=>g.addColorStop(i/(c.length-1),cc)); return g; };
  const RG=(x,y,r,c)=>{ const g=ctx.createRadialGradient(x-r*.3,y-r*.35,r*.05,x,y,r); c.forEach((cc,i)=>g.addColorStop(i/(c.length-1),cc)); return g; };
  const RR=(x,y,w,h,r)=>{ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); };
  // a box seen in this room's 3/4 view: front face + lit top face (depth goes up-right a little)
  function box(x,y,w,h,d,front,top,side){ const dx=d*.35, dy=d*.55; ctx.fillStyle=side||'#555'; ctx.beginPath(); ctx.moveTo(x+w,y); ctx.lineTo(x+w+dx,y-dy); ctx.lineTo(x+w+dx,y-h-dy); ctx.lineTo(x+w,y-h); ctx.fill(); ctx.fillStyle=top; ctx.beginPath(); ctx.moveTo(x,y-h); ctx.lineTo(x+dx,y-h-dy); ctx.lineTo(x+w+dx,y-h-dy); ctx.lineTo(x+w,y-h); ctx.fill(); ctx.fillStyle=front; ctx.fillRect(x,y-h,w,h); }
  // vertical cylinder (tank, bottle, bucket): shaded body + elliptical top
  function cyl(cx,by,r,h,c,topC){ ctx.fillStyle=LG(cx-r,0,cx+r,0,c); ctx.beginPath(); ctx.moveTo(cx-r,by-h); ctx.lineTo(cx-r,by); ctx.ellipse(cx,by,r,r*.3,0,Math.PI,0,true); ctx.lineTo(cx+r,by-h); ctx.fill(); ctx.fillStyle=topC||c[1]; ctx.beginPath(); ctx.ellipse(cx,by-h,r,r*.3,0,0,TAU); ctx.fill(); }

  // painted prop sprites (art/p_*.webp keyed from art-src/props-sheet.jpg): feet at (x,y), real height hM metres
  function art(name,x,y,hM,k,flip){ const im=IM[name]; if(!ok(name)) return false; const h=hM*k, w=h*im.naturalWidth/im.naturalHeight, hs=hiSprite(im,h*cam.z*dpr); ctx.save(); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; ctx.translate(x,y); if(flip) ctx.scale(-1,1); ctx.drawImage(hs.c,-w/2,-h,w,h);
    const sp=SPIN[name]; if(sp&&G.st.settings.motion!==false){ // spinning blades: rotating soft sweeps clipped to the cage
      const cx=-w/2+sp[0]*w, cy=-h+sp[1]*h, rx=sp[2]*w, ry=sp[3]*h, a0=t*(sp[4]||16); ctx.save(); ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,TAU); ctx.clip(); ctx.translate(cx,cy); ctx.scale(rx,ry);
      for(let b=0;b<3;b++){ const a=a0+b*TAU/3; ctx.fillStyle='rgba(40,44,48,.22)'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,.95,a,a+.7); ctx.closePath(); ctx.fill(); ctx.fillStyle='rgba(235,240,243,.16)'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,.95,a+.7,a+.95); ctx.closePath(); ctx.fill(); }
      ctx.restore(); }
    ctx.restore(); return true; }
  const SPIN={p_pedfan:[.285,.27,.25,.24,14], p_clipfan:[.29,.305,.26,.26,18]};
  function garageGear(list){ const L=k=>G.lv(k);
    const put=(u,v,fn)=>{ const p=GP(u,v); list.push({y:p.y,draw:()=>{ ctx.save(); fn(p,gppm(p.y)); ctx.restore(); }}); };
    // garden hose on a wheeled reel cart (Watering lv1+)
    if(L('water')>=1) put(.5,2.5,(p,k)=>drawProp('hose',p,k,.75,.95,(o,s)=>{ const r=.22*s, cy=-.34*s;
      ctx.strokeStyle='#30343a'; ctx.lineWidth=.035*s; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(-.2*s,-.02*s); ctx.lineTo(0,cy); ctx.lineTo(.2*s,-.02*s); ctx.moveTo(0,cy); ctx.lineTo(.08*s,-.86*s); ctx.lineTo(-.06*s,-.86*s); ctx.stroke();
      ctx.fillStyle='#1d2023'; ctx.beginPath(); ctx.arc(-.2*s,-.05*s,.05*s,0,TAU); ctx.arc(.2*s,-.05*s,.05*s,0,TAU); ctx.fill();
      ctx.fillStyle=RG(0,cy,r,['#3c4146','#15171a']); ctx.beginPath(); ctx.arc(0,cy,r,0,TAU); ctx.fill();
      for(let i=0;i<7;i++){ const rr=r*.92-i*.022*s; ctx.strokeStyle=i%2?'#2a7d44':'#3a9c57'; ctx.lineWidth=.026*s; ctx.beginPath(); ctx.arc(0,cy,rr,0,TAU); ctx.stroke(); }
      ctx.strokeStyle='rgba(190,255,205,.35)'; ctx.lineWidth=.012*s; ctx.beginPath(); ctx.arc(0,cy,r*.85,3.6,4.6); ctx.stroke();
      ctx.fillStyle=RG(0,cy,r*.25,['#f6c45a','#b77a1c']); ctx.beginPath(); ctx.arc(0,cy,r*.22,0,TAU); ctx.fill();
      ctx.strokeStyle='#2f8f4e'; ctx.lineWidth=.026*s; ctx.beginPath(); ctx.moveTo(r*.8,cy+r*.5); ctx.quadraticCurveTo(.3*s,-.01*s,.33*s,-.02*s); ctx.stroke(); },.32));
    // nutrient reservoir (Feeding lv1+): 50-gal tank with lid, label and pump line up to the first bucket
    if(L('nutes')>=1){ put(.62,4.6,(p,k)=>{ drawProp('res',p,k,.8,.8,(o,s)=>{ const r=.3*s, h=.6*s; cyl(0,0,r,h,['#8f999f','#e9eef1','#c3cbd0','#6b747a'],'#2c3135'); ctx.fillStyle='rgba(255,255,255,.35)'; ctx.fillRect(-r*.62,-h+.06*s,.04*s,h-.12*s);
        ctx.fillStyle='rgba(70,140,80,.35)'; ctx.fillRect(-r+.02*s,-h*.5,r*2-.04*s,h*.45); ctx.fillStyle='#d9772f'; RR(-r*.62,-h*.82,r*1.24,.12*s,.02*s); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='800 '+(.075*s)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('NUTES',0,-h*.82+.06*s);
        ctx.fillStyle='#1f2326'; ctx.beginPath(); ctx.ellipse(0,-h,r*.95,r*.27,0,0,TAU); ctx.fill(); ctx.fillStyle='#3b4045'; ctx.beginPath(); ctx.ellipse(-r*.15,-h-.01*s,r*.35,r*.11,0,0,TAU); ctx.fill(); },.42);
        const t=GT(PCOLS[0],PROWS[0]-.1); ctx.strokeStyle='#121416'; ctx.lineWidth=Math.max(1.4,.022*k); ctx.beginPath(); ctx.moveTo(p.x-.12*k,p.y-.62*k); ctx.quadraticCurveTo(p.x-.05*k,t.y-.3*k,t.x-.05*k,t.y-.05*k); ctx.stroke(); }); }
    // control board on the left wall: digital light timer + pH/EC monitor, big lit displays so they read at phone zoom
    if(L('timer')>=1||L('phkit')>=1) put(1.45,4.35,(p,k)=>{ // grow-controller cart beside the reservoir: lit timer + pH/EC readouts (displays never drop below phone-readable size)
      drawProp('cart',p,k,.6,.9,(o,s)=>{ const w=.46*s; ctx.fillStyle='#3a3f44'; for(const x of [-w/2,w/2-.03*s]) ctx.fillRect(x,-.78*s,.03*s,.78*s); box(-w/2,-.38*s,w,.03*s,.3*s,'#59606a','#8d969e','#474d54'); box(-w/2,-.78*s,w,.03*s,.3*s,'#59606a','#8d969e','#474d54'); ctx.fillStyle='#1b1d20'; for(const x of [-w/2+.015*s,w/2-.015*s]){ ctx.beginPath(); ctx.arc(x,0,.025*s,0,TAU); ctx.fill(); }
        ctx.fillStyle=LG(0,-.37*s,0,-.12*s,['#2c4f2a','#1d3a1c']); RR(-w*.38,-.37*s,w*.32,.22*s,.02*s); ctx.fill(); ctx.fillStyle=LG(0,-.37*s,0,-.12*s,['#7a3a1f','#52230f']); RR(w*.04,-.34*s,w*.32,.19*s,.02*s); ctx.fill(); },.32);
      const z=cam.z, mpx=v=>Math.max(v*k,1), dw=Math.max(.24*k,22/z), dh=dw*.72, top=p.y-.8*k; const dev=(x,big,lab,col)=>{ const y=top-dh; ctx.fillStyle='rgba(0,0,0,.35)'; RR(x+1.5/z,y+2/z,dw,dh,dw*.1); ctx.fill(); ctx.fillStyle=LG(0,y,0,y+dh,['#f3f5f6','#c3c9ce']); RR(x,y,dw,dh,dw*.1); ctx.fill(); ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=1/z; ctx.stroke();
        ctx.fillStyle='#0d1712'; RR(x+dw*.09,y+dh*.1,dw*.82,dh*.55,dw*.05); ctx.fill(); ctx.save(); ctx.shadowColor=col; ctx.shadowBlur=dw*.12; ctx.fillStyle=col; ctx.font='900 '+(dh*.42)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(big,x+dw/2,y+dh*.39); ctx.restore(); ctx.fillStyle='#2b3035'; ctx.font='800 '+(dh*.2)+'px system-ui'; ctx.textAlign='center'; ctx.fillText(lab,x+dw/2,y+dh*.83); };
      const both=L('timer')>=1&&L('phkit')>=1, x0=p.x-(both?dw+1/z:dw/2); if(L('timer')>=1) dev(x0,'18/6','TIMER','#ffd25a'); if(L('phkit')>=1) dev(both?p.x+1/z:x0,'6.2','pH','#7dffa8'); });
    // dehumidifier on castors by the back wall
    if(L('dehu')>=1) put(6.1,8.15,(p,k)=>drawProp('dehu',p,k,.6,.75,(o,s)=>{ const w=.42*s, h=.64*s; box(-w/2,0,w,h,.22*s,LG(-w/2,0,w/2,0,['#d4d9dd','#f7f8f9','#c3cacf']),'#e9edf0','#9aa2a8');
      ctx.fillStyle='#22272b'; RR(-w*.38,-h*.9,w*.76,h*.17,.02*s); ctx.fill(); ctx.fillStyle='#56d8ff'; ctx.font='800 '+(.07*s)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('45%',-w*.08,-h*.815); ctx.fillStyle='#4ce07a'; ctx.beginPath(); ctx.arc(w*.24,-h*.815,.012*s,0,TAU); ctx.fill();
      ctx.fillStyle='#7f888e'; for(let i=0;i<7;i++) ctx.fillRect(-w*.38,-h*.62+i*h*.075,w*.76,h*.035); ctx.fillStyle='#2a2d30'; ctx.beginPath(); ctx.arc(-w*.35,0,.025*s,0,TAU); ctx.arc(w*.35,0,.025*s,0,TAU); ctx.fill(); },.3));
    // inline fan + carbon filter hung under the ceiling joists over the back table, ducted up through the wall
    if(L('fan')>=1) put(3.2,8.35,(p,k)=>{ const y=p.y-2.25*k; ctx.strokeStyle='#45494d'; ctx.lineWidth=1; ctx.beginPath(); const cy0=p.y-2.75*k; ctx.lineWidth=1.2; ctx.moveTo(p.x-.2*k,y-.13*k); ctx.lineTo(p.x-.2*k,cy0); ctx.moveTo(p.x+.25*k,y-.11*k); ctx.lineTo(p.x+.25*k,cy0); ctx.stroke(); ctx.fillStyle='#2a2c2f'; ctx.fillRect(p.x-.2*k-3,cy0-1,6,2.5); ctx.fillRect(p.x+.25*k-3,cy0-1,6,2.5);
      drawProp('ifan',{x:p.x,y:y+.16*k},k,1.4,.4,(o,s)=>{ const cy=-.16*s; ctx.strokeStyle='#c4cacd'; ctx.lineWidth=.12*s; ctx.beginPath(); ctx.moveTo(.45*s,cy); ctx.lineTo(.62*s,cy); ctx.lineTo(.62*s,-.39*s); ctx.stroke(); ctx.strokeStyle='rgba(120,128,132,.6)'; ctx.lineWidth=.008*s; for(let i=0;i<8;i++){ ctx.beginPath(); ctx.moveTo(.45*s+i*.02*s,cy-.06*s); ctx.lineTo(.45*s+i*.02*s,cy+.06*s); ctx.stroke(); }
        ctx.fillStyle=LG(0,cy-.13*s,0,cy+.13*s,['#5c6166','#2a2d31','#16181a']); RR(-.62*s,cy-.13*s,.56*s,.26*s,.05*s); ctx.fill(); ctx.fillStyle='#101214'; for(let i=0;i<9;i++) ctx.fillRect(-.6*s+i*.06*s,cy-.11*s,.025*s,.22*s); ctx.fillStyle='#d23b2f'; ctx.fillRect(-.6*s,cy+.1*s,.52*s,.02*s);
        ctx.fillStyle=LG(0,cy-.15*s,0,cy+.15*s,['#cdd3d6','#8e979c','#5a6166']); RR(-.06*s,cy-.15*s,.52*s,.3*s,.07*s); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.3)'; ctx.fillRect(0,cy-.12*s,.4*s,.02*s); ctx.fillStyle='#e8eaec'; ctx.font='800 '+(.06*s)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('CARBON',.2*s,cy+.02*s); }); });
    // clip-on fans gripping the edge of each grow table, heads angled into the canopy (live spin)
    if(L('oscfan')>=1){ const cap=G.capOf('garage'); PROWS.forEach((v,r)=>{ const n=Math.max(0,Math.min(5,cap-r*5)); if(!n) return; const now=t; for(const u of n>=3?[PCOLS[0]-.42,PCOLS[n-1]+.42]:[PCOLS[0]-.42]){ const q=GT(u,v-.36); list.push({y:q.y+1,draw:()=>{ const k=gppm(GP(u,v).y); art('p_clipfan',q.x,q.y+.03*k,.36,k,u>PCOLS[0]); }}); } }); }
    // drying line with hanging branches (Drying racks), curing jars + rosin press on the workbench
    if(L('dryer')>=1) put(4.9,7.95,(p,k)=>{ const y=p.y-2.05*k, x0=p.x-.9*k, x1=p.x+.7*k; ctx.strokeStyle='#d8d2c0'; ctx.lineWidth=Math.max(1,.01*k); ctx.beginPath(); ctx.moveTo(x0,y); ctx.quadraticCurveTo(p.x,y+.06*k,x1,y); ctx.stroke(); { const cy0=p.y-2.75*k; ctx.strokeStyle='rgba(40,40,40,.8)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x0,cy0); ctx.moveTo(x1,y); ctx.lineTo(x1,cy0); ctx.stroke(); ctx.fillStyle='#2a2c2f'; ctx.fillRect(x0-3,cy0-1,6,2.5); ctx.fillRect(x1-3,cy0-1,6,2.5); } const n=Math.min(9,3+L('dryer'));
      for(let i=0;i<n;i++){ const x=x0+(i+.5)*(x1-x0)/n, yy=y+.03*k*Math.sin(i/n*Math.PI); drawProp('br'+(i%3),{x,y:yy+.42*k},k,.24,.44,(o,s)=>{ ctx.strokeStyle='#6b5a33'; ctx.lineWidth=.012*s; ctx.beginPath(); ctx.moveTo(0,-.43*s); ctx.lineTo(0,-.05*s); ctx.stroke(); for(let j=0;j<5;j++){ const yy=-.38*s+j*.07*s, w=(.05+.012*j)*s; ctx.fillStyle=LG(-w,0,w,0,['#566b2c','#9aae55','#4d6127']); ctx.beginPath(); ctx.ellipse((j%2?.02:-.02)*s,yy,w*.75,.045*s,0,0,TAU); ctx.fill(); ctx.fillStyle='rgba(235,220,170,.35)'; ctx.beginPath(); ctx.arc(-.015*s,yy-.01*s,.012*s,0,TAU); ctx.fill(); } }); } });
    if(L('cure')>=1||L('press')>=1) put(3.1,8.5,(p,k)=>{ const by=p.y-.93*k; if(L('cure')>=1) for(let i=0;i<Math.min(5,1+L('cure'));i++) drawProp('jar',{x:p.x-.55*k+i*.13*k,y:by},k,.14,.22,(o,s)=>{ ctx.fillStyle='rgba(200,225,235,.4)'; RR(-.05*s,-.16*s,.1*s,.16*s,.02*s); ctx.fill(); ctx.fillStyle='#86a84a'; for(let j=0;j<5;j++){ ctx.beginPath(); ctx.arc(-.02*s+(j%2)*.04*s,-.03*s-j*.025*s,.022*s,0,TAU); ctx.fill(); } ctx.fillStyle='rgba(255,255,255,.55)'; ctx.fillRect(-.04*s,-.14*s,.012*s,.12*s); ctx.fillStyle=LG(-.05*s,0,.05*s,0,['#b8962e','#f2d36a','#9c7a22']); RR(-.052*s,-.19*s,.104*s,.035*s,.01*s); ctx.fill(); });
      if(L('press')>=1) art('p_press',p.x+.3*k,by+.01*k,.42,k); });
  }
  // ---- greenhouse / farm upgrades ----
  const gi=(ix,iy)=>({x:GH.x+ix*GH.s,y:GH.y+iy*GH.s});
  const GHQ={ R1:[240,182], R2:[635,10], E1:[445,388], E2:[845,180], L1:[52,232], L2:[448,58], W1:[450,585], W2:[850,350] };
  const ghp=n=>gi(GHQ[n][0],GHQ[n][1]);
  const lerpP=(a,b,f)=>({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f});
  function poly(pts){ ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath(); }
  function nightAmt(){ const ph=G.dayPhase(); return ph<.2||ph>.8?1:ph<.27?(.27-ph)/.07:ph>.73?(ph-.73)/.07:0; }
  // drawn over the plants (like the glass overlay): cloth, tarps and grow-light fixtures on the roof
  function ghRoofGear(now){ const st=G.st; if(!st.ghBuilt) return; const R1=ghp('R1'),R2=ghp('R2'),E1=ghp('E1'),E2=ghp('E2'),L1=ghp('L1'),L2=ghp('L2'),W1=ghp('W1'),W2=ghp('W2'), m=GH.s*110;
    if(G.lv('supp')){ const nt=nightAmt(); for(const f of [.3,.66]){ const a=lerpP(R1,E1,f), b=lerpP(R2,E2,f), dy=.45*m; /* QC: hanger wires from the roof frame so the supplemental bars don't float */ ctx.strokeStyle='rgba(40,44,48,.85)'; ctx.lineWidth=.012*m; for(const t of [.06,.5,.94]){ const h=lerpP(a,b,t); ctx.beginPath(); ctx.moveTo(h.x,h.y); ctx.lineTo(h.x,h.y+dy); ctx.stroke(); } ctx.lineCap='round'; ctx.strokeStyle='#26292d'; ctx.lineWidth=.07*m; ctx.beginPath(); ctx.moveTo(a.x,a.y+dy); ctx.lineTo(b.x,b.y+dy); ctx.stroke();
      ctx.save(); ctx.strokeStyle=nt>.2?'#fff1c4':'#d9d2b8'; if(nt>.2){ ctx.shadowColor='#ffd98a'; ctx.shadowBlur=10*nt; } ctx.lineWidth=.025*m; ctx.beginPath(); ctx.moveTo(a.x,a.y+dy+.03*m); ctx.lineTo(b.x,b.y+dy+.03*m); ctx.stroke(); ctx.restore(); ctx.lineCap='butt'; } }
    if(G.lv('shade')){ ctx.save(); for(const q of [[R1,R2,E2,E1],[L1,L2,R2,R1]]){ poly(q); ctx.save(); ctx.clip(); const g=ctx.createLinearGradient(q[0].x,q[0].y,q[3].x,q[3].y); g.addColorStop(0,'rgba(34,46,40,.5)'); g.addColorStop(.5,'rgba(22,30,26,.58)'); g.addColorStop(1,'rgba(30,40,34,.52)'); ctx.fillStyle=g; ctx.fill();
      ctx.strokeStyle='rgba(120,140,128,.18)'; ctx.lineWidth=.5; const A=q[0],B=q[1],D=q[3]; for(let i=0;i<=40;i++){ const f=i/40, s0=lerpP(A,B,f), s1=lerpP(D,q[2],f); ctx.beginPath(); ctx.moveTo(s0.x,s0.y); ctx.lineTo(s1.x,s1.y); ctx.stroke(); }
      const sh=ctx.createLinearGradient(A.x,A.y,B.x,B.y); sh.addColorStop(0,'rgba(255,255,255,0)'); sh.addColorStop(.5,'rgba(255,250,235,.08)'); sh.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=sh; ctx.fill(); ctx.restore();
      ctx.strokeStyle='rgba(15,20,18,.7)'; ctx.lineWidth=.025*m; poly(q); ctx.stroke(); }
      ctx.fillStyle='#e8e4d8'; for(let i=0;i<=6;i++){ const p=lerpP(E1,E2,i/6); ctx.beginPath(); ctx.arc(p.x,p.y,.035*m,0,TAU); ctx.fill(); } ctx.restore(); }
    if(G.lv('lightdep')){ const nt=nightAmt(); if(nt>0){ ctx.save(); ctx.globalAlpha=.86*Math.min(1,nt*1.4); ctx.fillStyle='#0d0f10'; for(const q of [[R1,R2,E2,E1],[L1,L2,R2,R1],[E1,E2,W2,W1]]){ poly(q); ctx.fill(); } ctx.restore(); }
      // tarps rolled up along the ridge in daytime (thick black roll, sheen on top)
      const k=1-Math.min(1,nt*1.4); if(k>0){ ctx.save(); ctx.globalAlpha=k; ctx.lineCap='round'; const o=.12*m; ctx.strokeStyle='#121416'; ctx.lineWidth=.2*m; ctx.beginPath(); ctx.moveTo(R1.x+o*.3,R1.y+o); ctx.lineTo(R2.x+o*.3,R2.y+o); ctx.stroke(); ctx.strokeStyle='rgba(150,160,165,.35)'; ctx.lineWidth=.04*m; ctx.beginPath(); ctx.moveTo(R1.x+o*.3,R1.y+o-.06*m); ctx.lineTo(R2.x+o*.3,R2.y+o-.06*m); ctx.stroke();
        ctx.strokeStyle='#121416'; ctx.lineWidth=.16*m; ctx.beginPath(); ctx.moveTo(E1.x,E1.y+.05*m); ctx.lineTo(E2.x,E2.y+.05*m); ctx.stroke(); ctx.restore(); } } }
  function farmGear(list,now){ const st=G.st, m=FARM_PPM;
    // evaporative (swamp) cooler outside the greenhouse back corner, ducted through the wall
    if(st.ghBuilt&&G.lv('cooler')){ const p=gi(842,412); list.push({y:p.y,draw:()=>{ cshadow(p,m,.5); art('p_swamp',p.x,p.y+.02*m,1.1,m); }}); }
    // compost bins beside the greenhouse (Raised beds + compost)
    if(st.ghBuilt&&G.lv('beds')){ const n=Math.min(3,G.lv('beds')); for(let i=0;i<n;i++){ const p={x:560+i*44,y:905-i*14}; list.push({y:p.y,draw:()=>{ cshadow(p,m,.55); drawProp('compost',p,m,1.0,.95,(o,s)=>{ const w=.8*s,h=.7*s; ctx.fillStyle='#3a2a1a'; ctx.beginPath(); ctx.ellipse(.15*s,-h-.12*s,w*.42,.12*s,0,0,TAU); ctx.fill(); ctx.fillStyle=RG(.1*s,-h-.12*s,w*.4,['#6b4a2a','#2e1f12']); ctx.beginPath(); ctx.ellipse(.15*s,-h-.08*s,w*.48,.16*s,0,Math.PI,0); ctx.fill();
      box(-w/2,0,w,h,.6*s,'#8a6038','#a87a4a','#6b4728'); ctx.fillStyle='rgba(30,18,8,.55)'; for(let j=0;j<5;j++) ctx.fillRect(-w/2,-h+j*h/5+h/5-.02*s,w,.03*s); ctx.fillStyle='#c79a66'; for(const x of [-w/2,w/2-.05*s]) ctx.fillRect(x,-h,.05*s,h); ctx.fillStyle='#7aa040'; ctx.beginPath(); ctx.arc(-.1*s,-h-.06*s,.04*s,0,TAU); ctx.arc(.25*s,-h-.12*s,.035*s,0,TAU); ctx.fill(); },.6); }}); } }
    // storm shutters + hoop covers: PVC hoops over each planted terrace, row cover rolled along the windward edge
    if(G.lv('shutters')){ const nT=st.field||0; for(let k=0;k<4;k++){ if(!st.plots.some(p=>p.zone==='field'&&Math.floor(p.idx/10)===k)) continue; const b=terracePlots(k)[0], P=(j,c)=>({x:b[0]+TER.L[0]*j+TER.C[0]*c,y:b[1]+TER.L[1]*j+TER.C[1]*c});
      const roll0=P(-.65,-.34), roll1=P(2.65,-.34); list.push({y:roll0.y-30,draw:()=>{ ctx.lineCap='round'; ctx.strokeStyle='rgba(230,238,240,.92)'; ctx.lineWidth=.22*m; ctx.beginPath(); ctx.moveTo(roll0.x,roll0.y-.1*m); ctx.lineTo(roll1.x,roll1.y-.1*m); ctx.stroke(); ctx.strokeStyle='rgba(160,175,180,.6)'; ctx.lineWidth=.06*m; ctx.beginPath(); ctx.moveTo(roll0.x,roll0.y-.03*m); ctx.lineTo(roll1.x,roll1.y-.03*m); ctx.stroke(); ctx.lineCap='butt'; }});
      for(const j of [-.65,.5,1.5,2.65]){ const a=P(j,-.34), c=P(j,.34); list.push({y:Math.max(a.y,c.y)+2,draw:()=>{ const h=1.0*m; ctx.strokeStyle='rgba(245,247,248,.95)'; ctx.lineWidth=.045*m; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.bezierCurveTo(a.x,a.y-h*1.25,c.x,c.y-h*1.25,c.x,c.y); ctx.stroke(); ctx.strokeStyle='rgba(120,130,135,.5)'; ctx.lineWidth=.015*m; ctx.beginPath(); ctx.moveTo(a.x+1,a.y); ctx.bezierCurveTo(a.x+1,a.y-h*1.22,c.x+1,c.y-h*1.22,c.x+1,c.y); ctx.stroke(); }}); } } }
  }
  // ---- indoor facility upgrades (room art px; inppm(y) px per metre) ----
  function indoorGear(list,now){ const backs={push:fn=>list.push({y:-1e9,draw:fn})}; const L=k=>G.lv(k), ip=y=>inppm(Math.min(560,y));
    const put=(x,y,key,wM,hM,fn,sw)=>list.push({y,draw:()=>drawProp(key,{x,y},ip(y),wM,hM,fn,sw)});
    // solar array on the right roof slope (rows per level), drawn on the roof before the room contents
    if(L('solar')) backs.push(()=>{ const R={x:521,y:32}, E={x:1090,y:134}, D={x:.983,y:-.184}; const P=(a,b)=>({x:R.x+(E.x-R.x)*a+D.x*b,y:R.y+(E.y-R.y)*a+D.y*b}); const rows=Math.min(3,L('solar'));
      for(let r=0;r<rows;r++) for(let c=0;c<5;c++){ const a0=.12+r*.2, a1=a0+.17, b0=6+c*18, b1=b0+16, q=[P(a0,b0),P(a0,b1),P(a1,b1),P(a1,b0)]; /* QC: racking shadow so panels sit on the roof, array kept inside the roof edge */ poly(q.map(o=>({x:o.x+1.5,y:o.y+2.5}))); ctx.fillStyle='rgba(20,24,30,.45)'; ctx.fill(); poly(q); ctx.fillStyle=LG(q[0].x,q[0].y,q[2].x,q[2].y,['#2d4f86','#173058','#0d1c38']); ctx.fill(); ctx.strokeStyle='#c9d0d6'; ctx.lineWidth=1.2; ctx.stroke();
        ctx.strokeStyle='rgba(150,180,230,.35)'; ctx.lineWidth=.5; for(let i=1;i<4;i++){ const u=lerpP(q[0],q[3],i/4), v=lerpP(q[1],q[2],i/4); ctx.beginPath(); ctx.moveTo(u.x,u.y); ctx.lineTo(v.x,v.y); ctx.stroke(); } const u=lerpP(q[0],q[1],.5), v=lerpP(q[3],q[2],.5); ctx.beginPath(); ctx.moveTo(u.x,u.y); ctx.lineTo(v.x,v.y); ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,.12)'; poly([q[0],lerpP(q[0],q[1],.6),lerpP(q[3],q[2],.2),q[3]]); ctx.fill(); } });
    // HVAC: cool air streaming from the mini-split; level 2+ adds a wall thermostat
    if(L('hvac')) list.push({y:175,draw:()=>{ ctx.save(); for(let i=0;i<3+L('hvac');i++){ const f=((now*.35+i/(3+L('hvac')))%1), x=400+i*30, y=175+f*70; ctx.globalAlpha=(1-f)*.35; ctx.strokeStyle='#cfeaff'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x+10,y+12,x+2,y+24); ctx.stroke(); } ctx.restore();
      if(L('hvac')>=2){ ctx.fillStyle='rgba(40,40,50,.28)'; RR(550,114,22,30,3); ctx.fill(); ctx.fillStyle='#e9ecee'; RR(548,112,22,30,3); ctx.fill(); ctx.fillStyle='#14324a'; RR(551,116,16,11,2); ctx.fill(); ctx.fillStyle='#7fd3ff'; ctx.font='800 8px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('75°',559,122); } }});
    // CO2 cylinder + regulator by the dehumidifier
    if(L('co2')) put(960,440,'co2',.4,1.55,(o,s)=>{ const r=.12*s,h=1.2*s; cyl(0,0,r,h,['#4d5a52','#8fa596','#5f7266','#34403a'],'#3c4842'); ctx.fillStyle=RG(0,-h-.04*s,r*.8,['#9aa3a8','#4c5257']); ctx.beginPath(); ctx.ellipse(0,-h,r*.85,r*.4,0,Math.PI,0); ctx.fill(); ctx.fillStyle='#b7bdc1'; ctx.fillRect(-.02*s,-h-.14*s,.04*s,.12*s); ctx.fillStyle=RG(.06*s,-h-.15*s,.05*s,['#ffffff','#b8bec2']); ctx.beginPath(); ctx.arc(.06*s,-h-.15*s,.045*s,0,TAU); ctx.fill(); ctx.fillStyle='#e8e8e8'; RR(-r*.75,-h*.6,r*1.5,.16*s,.02*s); ctx.fill(); ctx.fillStyle='#1a1a1a'; ctx.font='900 '+(.09*s)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('CO₂',0,-h*.6+.08*s); },.22);
    // fertigation: reservoir + dosing controller, blue drip lines along every bench
    if(L('fert')){
      list.push({y:470,draw:()=>{ const k=ip(470); cshadow({x:850,y:470},k,.5); art('p_fertig',850,472,1.0,k); }}); }
    // veg room: a lit veg tent in the porch corner, flap open
    if(L('veg')) list.push({y:540,draw:()=>{ const k=ip(540); cshadow({x:262,y:540},k,.45); art('p_vegtent',262,543,1.25,k); }});
    // clone + mother room: rolling cart with humidity domes under a T5
    if(L('clone')) list.push({y:600,draw:()=>{ const k=ip(600); cshadow({x:345,y:600},k,.45); art('p_clonecart',345,603,.95,k); }});
    // drying + cure room: stacked hanging dry nets with branches in the back-left corner
    if(L('dryroom')) list.push({y:300,draw:()=>{ const x=232, k=ip(300); ctx.strokeStyle='rgba(40,40,40,.8)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x,150); ctx.lineTo(x,300-.95*k); ctx.stroke(); /* QC: ceiling cleat + hook so the dry line visibly hangs from the rafter */ ctx.fillStyle='#6b4a2e'; ctx.fillRect(x-7,146,14,5); ctx.fillStyle='#3a2a1c'; ctx.fillRect(x-7,150,14,1.2); ctx.strokeStyle='#9aa0a6'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(x,153,2,0,Math.PI*2); ctx.stroke(); art('p_drynet',x,300,.95,k); }});
  }
  // Garage lights upgrade: CFL reflectors -> blurple panel -> quantum boards -> bar-style LED, each brighter/wider with a light cone
  function growLight(A0,B0,k){ const ang=Math.atan2(B0.y-A0.y,B0.x-A0.x), len=Math.hypot(B0.x-A0.x,B0.y-A0.y); ctx.save(); ctx.translate(A0.x,A0.y); ctx.rotate(ang); growLight0({x:0,y:0},{x:len,y:0},k); ctx.restore(); }
  function growLight0(A,B,k){ const LL=Math.min(3,G.lv('light')), col=['255,226,170','255,150,235','255,248,232','255,255,250'][LL], ga=[.05,.07,.09,.12][LL]*(G.st.phenoRoom?.5:1), d=[0,.03,.045,.06][LL]*k, span=B.x-A.x;
    // cone of light down to the canopy/table
    ctx.save(); const drop=1.35*k, sp=[.1,.18,.26,.34][LL]*k, g=ctx.createLinearGradient(0,A.y,0,A.y+drop); g.addColorStop(0,'rgba('+col+','+ga+')'); g.addColorStop(1,'rgba('+col+',0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(A.x,A.y+2); ctx.lineTo(B.x,B.y+2); ctx.lineTo(B.x+sp,B.y+drop); ctx.lineTo(A.x-sp,A.y+drop); ctx.closePath(); ctx.fill();
    const pg=ctx.createRadialGradient((A.x+B.x)/2,A.y+drop,0,(A.x+B.x)/2,A.y+drop,span*.6); pg.addColorStop(0,'rgba('+col+','+ga*.9+')'); pg.addColorStop(1,'rgba('+col+',0)'); ctx.fillStyle=pg; ctx.save(); ctx.translate(0,A.y+drop); ctx.scale(1,.25); ctx.translate(0,-(A.y+drop)); ctx.beginPath(); ctx.arc((A.x+B.x)/2,A.y+drop,span*.6,0,TAU); ctx.fill(); ctx.restore(); ctx.restore();
    if(LL===0){ // three CFL bulbs in dome reflectors
      for(let i=0;i<3;i++){ const x=A.x+span*(i+.5)/3, y=A.y, r=.13*k; ctx.fillStyle=LG(x-r,0,x+r,0,['#7c8389','#d6dbde','#6a7176']); ctx.beginPath(); ctx.moveTo(x-r,y+r*.55); ctx.quadraticCurveTo(x,y-r*.6,x+r,y+r*.55); ctx.closePath(); ctx.fill(); ctx.save(); ctx.shadowColor='rgba('+col+',1)'; ctx.shadowBlur=.08*k; ctx.fillStyle='#fff6dc'; ctx.beginPath(); ctx.ellipse(x,y+r*.55,r*.32,r*.2,0,0,TAU); ctx.fill(); ctx.restore(); }
      ctx.strokeStyle='#24272b'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(A.x,A.y-1); ctx.lineTo(B.x,B.y-1); ctx.stroke(); return; }
    // fixture slab seen slightly from below/front: top face, front edge, glowing underside
    const h=[0,.05,.035,.03][LL]*k; ctx.fillStyle=LG(0,A.y-d,0,A.y,LL===1?['#3e4247','#1a1c1f']:['#6a7177','#2a2e33']); ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(A.x+d*.3,A.y-d); ctx.lineTo(B.x-d*.3,B.y-d); ctx.lineTo(B.x,B.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle=LG(0,A.y,0,A.y+h,['#3a3e43','#15171a']); ctx.fillRect(A.x,A.y,span,h);
    ctx.save(); ctx.shadowColor='rgba('+col+',1)'; ctx.shadowBlur=[0,.08,.12,.16][LL]*k;
    if(LL===1){ ctx.fillStyle='rgba(255,120,220,.95)'; ctx.fillRect(A.x+2,A.y+h-1,span-4,Math.max(1.5,.012*k)); ctx.fillStyle='#b9a6ff'; for(let i=0;i<14;i++) ctx.fillRect(A.x+4+i*(span-8)/14,A.y+h*.3,1.5,1.5); }
    else if(LL===2){ for(const [a,b] of [[0,.48],[.52,1]]){ ctx.fillStyle='#fffaf0'; ctx.fillRect(A.x+span*a+2,A.y+h-1,span*(b-a)-4,Math.max(1.5,.014*k)); } }
    else { for(let i=0;i<4;i++){ const yy=A.y-d+(i+.5)*(d/4), xx=d*.3*(1-(i+.5)/4); ctx.strokeStyle='#ffffff'; ctx.lineWidth=Math.max(.8,.008*k); ctx.beginPath(); ctx.moveTo(A.x+xx+2,yy); ctx.lineTo(B.x-xx-2,yy); ctx.stroke(); } ctx.fillStyle='#ffffff'; ctx.fillRect(A.x+2,A.y+h-1,span-4,Math.max(1.5,.012*k)); }
    ctx.restore(); }
  // one grow table per garage row: wood top on a steel frame, legs to the floor
  function growTable(r,n){ const v=PROWS[r], u0=PCOLS[0]-.48, u1=PCOLS[n-1]+.48, d=.42;
    const F=(u,dv)=>GP(u,v+dv), T=(u,dv)=>GT(u,v+dv), a=T(u0,-d), b=T(u1,-d), c=T(u1,d), e=T(u0,d), fa=F(u0,-d), fb=F(u1,-d);
    // floor shadow
    ctx.fillStyle='rgba(0,0,0,.28)'; quad(F(u0,-d-.05),F(u1+.05,-d-.05),F(u1+.05,d),F(u0,d)); ctx.fill();
    // legs (back first)
    const leg=(u,dv)=>{ const t=T(u,dv), f=F(u,dv), k=gppm(f.y)*.05; ctx.fillStyle='#5d6268'; ctx.fillRect(t.x-k/2,t.y,k,f.y-t.y); ctx.fillStyle='#3d4146'; ctx.fillRect(t.x+k*.15,t.y,k*.35,f.y-t.y); ctx.fillStyle='#222'; ctx.fillRect(t.x-k*.7,f.y-2,k*1.4,3); };
    const us=[u0+.06]; for(let u=u0+2;u<u1-.5;u+=2) us.push(u); us.push(u1-.06); us.forEach(u=>leg(u,d-.06));
    // lower shelf rail
    { const k=.3; const p0=GP(u0+.06,v-d+.06), p1=GP(u1-.06,v-d+.06), h0=TBL_H*k*gppm(p0.y), h1=TBL_H*k*gppm(p1.y); ctx.strokeStyle='#4a4f55'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(p0.x,p0.y-h0); ctx.lineTo(p1.x,p1.y-h1); ctx.stroke(); }
    us.forEach(u=>leg(u,-d+.06));
    // top: wood boards with an edge apron
    const g=ctx.createLinearGradient(0,c.y,0,a.y); g.addColorStop(0,'#7a5a3a'); g.addColorStop(1,'#9b7449'); ctx.fillStyle=g; quad(a,b,c,e); ctx.fill();
    ctx.strokeStyle='rgba(40,25,12,.35)'; ctx.lineWidth=1; for(let i=1;i<4;i++){ const t=i/4, p=T(u0,-d+2*d*t), q=T(u1,-d+2*d*t); ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke(); }
    const ah=.07*gppm(fa.y); ctx.fillStyle='#5b5f65'; quad(a,b,{x:b.x,y:b.y+ah},{x:a.x,y:a.y+ah}); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.18)'; ctx.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y)-.5,0,0);
    ctx.strokeStyle='rgba(255,255,255,.22)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    ctx.fillStyle='#45494e'; quad(a,e,{x:e.x,y:e.y+ah},{x:a.x,y:a.y+ah}); ctx.fill(); }
  function soilMound(x,y,ppm){ ctx.fillStyle='rgba(60,38,22,.85)'; ctx.beginPath(); ctx.ellipse(x,y,.28*ppm,.09*ppm,0,0,TAU); ctx.fill(); }

  // tents (procedural, iso boxes on the garage floor)
  const LIGHTC=[['#ffd889','CFL'],['#d470ff','Blurple LED'],['#fff0d0','Quantum board'],['#ffffff','Bar LED']];
  function tentRect(T,gst){ let r=null,label=''; T.steps.forEach(([s,rect,l])=>{ if(gst>=s){ r=rect; label=l; } }); return r?{r,label}:null; }
  function tentBack(r,lightLv){ const [u0,u1,v0,v1]=r, side=Math.min(u1-u0,v1-v0), Hm=side<.7?1.4:side<1?1.8:2.0,   // real tent heights: 2x2 4.6 ft, 3x3 6 ft, 4x4+ 6.6 ft
    P00=GP(u0,v0),P10=GP(u1,v0),P01=GP(u0,v1),P11=GP(u1,v1), hp=Hm*gppm((P00.y+P11.y)/2);
    const up=p=>({x:p.x,y:p.y-hp});
    ctx.fillStyle='rgba(205,210,214,.92)'; quad(P00,P10,P11,P01); ctx.fill();
    const L=LIGHTC[lightLv]||LIGHTC[0];
    ctx.fillStyle='#bfc4c8'; quad(P01,P11,up(P11),up(P01)); ctx.fill(); ctx.fillStyle='#d7dbde'; quad(P10,P11,up(P11),up(P10)); ctx.fill();
    const cx=(P00.x+P11.x)/2, cy=(P00.y+P11.y)/2-hp*.92; const g=ctx.createRadialGradient(cx,cy,2,cx,cy+hp*.6,hp*1.1); g.addColorStop(0,L[0]+'aa'); g.addColorStop(1,L[0]+'00');
    ctx.fillStyle=g; quad(P00,P10,P11,P01); ctx.fill(); ctx.fillRect(Math.min(P00.x,P01.x),cy,Math.abs(P10.x-P01.x),hp);
    return {P00,P10,P01,P11,hp,cx,cy,L}; }
  function tentFront(T){ const {P00,P10,P01,P11,hp,cx,cy,L}=T, up=p=>({x:p.x,y:p.y-hp});
    ctx.fillStyle='rgba(20,22,24,.18)'; quad(P00,P10,up(P10),up(P00)); ctx.fill(); quad(P00,P01,up(P01),up(P00)); ctx.fill();
    ctx.fillStyle='rgba(20,22,24,.92)'; quad(up(P00),up(P10),up(P11),up(P01)); ctx.fill();
    ctx.strokeStyle='#1c1d20'; ctx.lineWidth=2.2; ctx.beginPath(); for(const p of [P00,P10,P11,P01]){ ctx.moveTo(p.x,p.y); ctx.lineTo(p.x,p.y-hp); } ctx.moveTo(P01.x,P01.y); ctx.lineTo(P00.x,P00.y); ctx.lineTo(P10.x,P10.y); ctx.stroke();
    // rolled-up door flaps
    ctx.fillStyle='#26282b'; const a=up(P00), b=up(P10); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(b.x,b.y+7); ctx.lineTo(a.x,a.y+7); ctx.fill(); const c=up(P01), c2=up(P11); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(c.x,c.y); ctx.lineTo(c.x,c.y+7); ctx.lineTo(a.x,a.y+7); ctx.fill();
    // light fixture
    { const tw=Math.hypot(P10.x-P00.x,P10.y-P00.y), n=tw>200?2:1, lw=Math.min(90,tw*(n>1?.32:.55)); for(let k=0;k<n;k++){ const lx=n>1?P00.x+(P10.x-P00.x)*(k?.72:.28)+(P01.x-P00.x)*.5:cx; ctx.fillStyle='#2b2d30'; ctx.fillRect(lx-lw/2,cy-2,lw,5); ctx.fillStyle=L[0]; ctx.shadowColor=L[0]; ctx.shadowBlur=10; ctx.fillRect(lx-lw/2+2,cy+3,lw-4,2.5); ctx.shadowBlur=0; } }  // light sized to the tent (two fixtures in the 4x8)
    if(G.lv('fan')){ const c=up(P11); ctx.fillStyle='#8c9196'; ctx.beginPath(); ctx.ellipse(c.x-12,c.y-5,7,5,0,0,TAU); ctx.fill(); ctx.fillStyle='#4a4e52'; ctx.fillRect(c.x-26,c.y-9,14,8); } }

  // ---------------- per-scene backgrounds ----------------
  let grassC=null;
  function grass(){ if(grassC) return grassC; const c=document.createElement('canvas'); c.width=900; c.height=330; const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,0,330); g.addColorStop(0,'#5d8a2e'); g.addColorStop(1,'#3f6d22'); x.fillStyle=g; x.fillRect(0,0,900,330);
    let s=7; const r=()=>((s=(s*16807)%2147483647)/2147483647); for(let i=0;i<5000;i++){ x.fillStyle=['#6c9a36','#4e7d28','#7aa842','#3a6620'][i%4]; x.globalAlpha=.5; x.fillRect(r()*900,r()*330,1.5,2+r()*3); }
    grassC=c; return c; }
  function drawBack(){
    if(loc==='garage'){ const g=ctx.createRadialGradient(W/2,H*.48,30,W/2,H*.5,Math.max(W,H)*.75); g.addColorStop(0,'#2c3a33'); g.addColorStop(1,'#111a16'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }   // neutral dark stage behind the cutaway (no photo)
    else if(loc==='indoor'){ const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#1c2430'); g.addColorStop(1,'#10151c'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }
    else { const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#7cc4e8'); g.addColorStop(1,'#3f6d22'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }
  }
  // static background (sky, painted backdrop, grass, paths, decor) is cached in an offscreen canvas and only re-rendered when the
  // camera, viewport or loaded art changes: one blit per frame instead of 3-4 overlapping full-screen layers (big fill-rate win)
  let baseC=null, baseK='';
  function drawBase(){ const k=[loc,G.season(),cam.x.toFixed(2),cam.y.toFixed(2),cam.z.toFixed(4),W,H,dpr,G.st.land?1:0,loaded,EQ().truck||'',EQ().room_garage||'',EQ().room_gh||'',EQ().room_indoor||''].join('|');
    if(!baseC){ baseC=document.createElement('canvas'); }
    if(k!==baseK||baseC.width!==cv.width||baseC.height!==cv.height){ baseK=k; if(baseC.width!==cv.width||baseC.height!==cv.height){ baseC.width=cv.width; baseC.height=cv.height; }
      const keep=ctx; ctx=baseC.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); drawBack(); ctx.setTransform(dpr*cam.z,0,0,dpr*cam.z,-cam.x*cam.z*dpr,-cam.y*cam.z*dpr); drawWorldBase(); ctx=keep; }
    ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(baseC,0,0); ctx.setTransform(dpr*cam.z,0,0,dpr*cam.z,-cam.x*cam.z*dpr,-cam.y*cam.z*dpr); }
  function drawWorldBase(){
    if(loc==='garage'){ if(ok('garage')){ ctx.drawImage(roomIm('garage'),0,0); drawTruckPaint(); } else { ctx.fillStyle='#8a8478'; ctx.fillRect(40,200,940,450); } }
    if(loc==='indoor'){ if(ok('indoor')) ctx.drawImage(roomIm('indoor'),0,0,1100,680); else { ctx.fillStyle='#ccc'; ctx.fillRect(40,60,1000,600); } }
    if(loc==='farm'){
      if(ok('island-bg')) ctx.drawImage(IM['island-bg'],-500,-560,3400,1913);
      { const se=G.season(); ctx.fillStyle=se==='wet'?'rgba(20,110,70,.13)':se==='dry'?'rgba(222,170,70,.17)':'rgba(255,170,90,.08)'; ctx.fillRect(-500,-560,3400,1913); }
      // soft blend from the painted backdrop into the play-field grass (no hard seam)
      const fade=ctx.createLinearGradient(0,470,0,640); fade.addColorStop(0,'rgba(93,138,46,0)'); fade.addColorStop(.6,'rgba(93,138,46,.75)'); fade.addColorStop(1,'rgba(93,138,46,1)'); ctx.fillStyle=fade; ctx.fillRect(-900,470,4400,170);
      const gr=grass(); ctx.drawImage(gr,-900,638,4400,1000);
      // path
      ctx.strokeStyle='rgba(150,95,55,.75)'; ctx.lineWidth=26; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(300,1295); ctx.quadraticCurveTo(820,1150,1350,1290); ctx.moveTo(1050,1200); ctx.quadraticCurveTo(1500,1010,1960,1120); ctx.stroke();
      if(st().land) ctx.drawImage(groundDecor(),100,600);
    }
  }
  // Garage buckets and rack pots are drawn above the slot (the slot is the bucket bottom / table).
  // The plant, its selection ring and its timer all use the soil line, or they slide down the pot as you zoom.
  function potLift(sl){ return (sl.kind==='pot'?.32:sl.kind==='pot2'||sl.kind==='rackpot'?.24:0)*(sl.ppm||0); }
  // A few growth sprites have one or two clear rows under the stem. Shift those so the opaque feet sit on the soil.
  const footC=new WeakMap();
  function footFrac(img){ const src=img&&img.c; if(!src) return 0; const hit=footC.get(src); if(hit!=null) return hit;
    const w=src.naturalWidth||src.width, h=src.naturalHeight||src.height; if(!w||!h){ footC.set(src,0); return 0; }
    let x; try{ if(typeof src.getContext==='function') x=src.getContext('2d',{willReadFrequently:true});
      else { const c=document.createElement('canvas'); c.width=w; c.height=h; x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(src,0,0); }
      let pad=0; for(let row=h-1;row>=0&&pad<6;row--){ const d=x.getImageData(0,row,w,1).data; let mx=0; for(let i=3;i<d.length;i+=4) if(d[i]>mx) mx=d[i]; if(mx>=48) break; pad++; }
      const f=pad/h; footC.set(src,f); return f; }catch(e){ footC.set(src,0); return 0; } }
  // ---------------- plant drawing ----------------
  function drawPlantAt(p,s,sl,now){
    const st=G.strain(p.strain), L=look(st); const prog=p.prog;
    const hf=.1+.9*Math.min(1,Math.pow(Math.min(1,prog/.95),.85));
    const PS=plantSize(st.type,prog,sl); if(p.pruned||p.train) PS.w*=1+(p.pruned?.06:0)+(p.train==='top'?.1:p.train==='lst'?.07:0); const hpx=PS.h*(L.shape==='spear'||L.shape==='foxtail'?1.04:1)*sl.ppm, wpx=PS.w*sl.ppm;
    const fitW=img=>{ const nat=hpx*img.w/img.h; return Math.max(nat*.72,Math.min(nat*1.3,wpx)); };
    if(hpx*cam.z*dpr<9&&ctx===mainCtx){ ctx.fillStyle=L.leaf||'#4a8a32'; ctx.beginPath(); ctx.ellipse(sl.x,sl.y-hpx*.45,Math.max(1.5,wpx*.45),Math.max(2,hpx*.5),0,0,TAU); ctx.fill(); return hpx; }
    const pi=plantImage(st,prog), seed=hash(p.id);
    const flip=seed&1?-1:1, sway=G.st.settings.hq&&G.st.settings.motion!==false?Math.sin(now*1.3+seed%7)*.025*(p.water<=0?.3:1):0;
    // health on the plant: eased droop when thirsty, yellowing when hungry/dry, pest spots, grey mold fuzz
    const thirst=p.prog<1?Math.max(0,1-p.water/.3):0, tgt=1-.13*thirst; p._dv=p._dv==null?tgt:p._dv+(tgt-p._dv)*Math.min(1,1/60*4); const droop=p._dv;
    const hk=(p.prog<1&&G.isHungry(p)?'h':'')+(p.water<=0&&p.prog<1?'d':'')+(p.pest==='pests'?'p':p.pest==='mold'?'m':'');
    ctx.save(); ctx.translate(sl.x,sl.y);
    ctx.fillStyle='rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(2,1,hpx*.35+4,hpx*.08+2,0,0,TAU); ctx.fill();
    if(p.trellis){ const sx=Math.max(6,wpx*.42), th=hpx*.78; ctx.strokeStyle='#c9a86a'; ctx.lineWidth=Math.max(1.2,sl.ppm*.03); ctx.beginPath(); ctx.moveTo(-sx,0); ctx.lineTo(-sx,-th); ctx.moveTo(sx,0); ctx.lineTo(sx,-th); ctx.stroke();
      ctx.strokeStyle='rgba(240,240,230,.55)'; ctx.lineWidth=.8; ctx.beginPath(); for(let i=1;i<=3;i++){ ctx.moveTo(-sx,-th*i/3.2); ctx.lineTo(sx,-th*i/3.2); } ctx.stroke(); }
    if(p._pop>0){ const q=Math.sin(p._pop*22)*p._pop*.5; ctx.scale(1+q*.35,1-q*.45); if(G.st.settings.motion!==false) ctx.rotate(Math.sin(p._pop*48)*p._pop*.22); }
    if((sl.cls==='out'||sl.cls==='gh')&&PS.h>1.2&&prog>.45&&prog<1.02){ const sh2=Math.min(hpx*.85,(PS.h*.85)*sl.ppm); ctx.strokeStyle='#c8b070'; ctx.lineWidth=Math.max(1.2,.025*sl.ppm); ctx.beginPath(); ctx.moveTo(3,2); ctx.lineTo(3+sway*20,-sh2); ctx.stroke();
      ctx.strokeStyle='#7fae4a'; ctx.lineWidth=1.4; for(const f of [.35,.6,.82]){ ctx.beginPath(); ctx.moveTo(-1,-sh2*f); ctx.lineTo(7,-sh2*f+2); ctx.stroke(); } }
    if(p._shake>0&&G.st.settings.motion!==false) ctx.rotate(Math.sin(p._shake*40)*p._shake*.14);
    ctx.rotate(sway); ctx.scale(flip,droop);
    let foot=0;
    if(pi&&pi.a){ const img=pi.a, w=fitW(img); foot=footFrac(img);
      ctx.drawImage(sick(img,hk,seed),-w/2,-hpx*(1-foot),w,hpx);
      if(pi.b&&pi.mix>0){ const w2=fitW(pi.b), f2=footFrac(pi.b); ctx.globalAlpha=pi.mix; ctx.drawImage(sick(pi.b,hk,seed),-w2/2,-hpx*(1-f2),w2,hpx); ctx.globalAlpha=1; } }
    else if(window.Art){ const stg=G.stage(p); const sp=Art.plantSprite(st,Math.min(stg,4),1); const k=hpx/(sp.h*.9); ctx.drawImage(sp.c,-sp.ox*k,-sp.oy*k,sp.c.width*k,sp.c.height*k); }
    ctx.restore();
    return hpx*(1-foot);
  }
  // per-sprite health variants, cached (effects are clipped to the plant's own pixels, never the ground behind it)
  const sickC=new WeakMap();
  function sick(img,hk,seed){ if(!hk) return img.c; let m=sickC.get(img.c); if(!m){ m={}; sickC.set(img.c,m); } const k=hk+(hk.includes('p')||hk.includes('m')?seed%4:''); if(m[k]) return m[k];
    const c=document.createElement('canvas'); c.width=img.w; c.height=img.h; const x=c.getContext('2d'); x.drawImage(img.c,0,0); x.globalCompositeOperation='source-atop';
    if(hk.includes('d')){ x.fillStyle='rgba(150,115,40,.32)'; x.fillRect(0,0,c.width,c.height); }
    if(hk.includes('h')){ const g=x.createLinearGradient(0,c.height,0,c.height*.35); g.addColorStop(0,'rgba(225,200,50,.5)'); g.addColorStop(1,'rgba(225,200,50,0)'); x.fillStyle=g; x.fillRect(0,0,c.width,c.height); }
    const r=rng(seed%997+3);
    if(hk.includes('p')){ for(let i=0;i<40;i++){ x.fillStyle=i%3?'rgba(70,45,20,.85)':'rgba(240,235,200,.8)'; x.beginPath(); x.arc(r()*c.width,c.height*.25+r()*c.height*.7,1.5+r()*2.5,0,TAU); x.fill(); } }
    if(hk.includes('m')){ for(let i=0;i<10;i++){ const px=c.width*(.25+r()*.5), py=c.height*(.05+r()*.45), rr2=6+r()*12; const g=x.createRadialGradient(px,py,0,px,py,rr2); g.addColorStop(0,'rgba(235,235,225,.95)'); g.addColorStop(1,'rgba(200,200,190,0)'); x.fillStyle=g; x.fillRect(px-rr2,py-rr2,rr2*2,rr2*2); } }
    return m[k]=c; }
  const ICON={water:['#3d9be8','💧'],food:['#e8853a','🧪'],prune:['#7bc043','✂️'],top:['#2f8f4e','🔝'],pests:['#c0392b','🐛'],mold:['#7f8c8d','🍄']};
  function badge(x,y,ic,r){ if(!ic) return; ctx.fillStyle='rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill(); ctx.strokeStyle=ic[0]; ctx.lineWidth=2.5; ctx.stroke(); ctx.font=Math.round(r*1.15)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ic[1],x,y+1); }
  // overlays drawn in screen space so they stay readable at any zoom
  const patchC={};
  function drawPatch(k,P){ const sc=Math.round(cam.z*dpr*20)/20, key=sc+'|'+P.map(p=>p.id+p.strain+Math.round(p.prog*30)+(p.water<=.15?'t':'')+(p.water<=0?'d':'')+(G.isHungry(p)?'h':'')+(p.pest||'')).join(',');
    let e=patchC[k]; const S=P.map(p=>slotOf.get(p.id)); const bx=Math.min(...S.map(s=>s.x))-90, by=Math.min(...S.map(s=>s.y))-2.7*FARM_PPM, bw=Math.max(...S.map(s=>s.x))+90-bx, bh=Math.max(...S.map(s=>s.y))+30-by;
    if(!e||e.key!==key){ if(!e){ e=patchC[k]={c:document.createElement('canvas')}; } e.key=key; e.bx=bx; e.by=by; e.c.width=Math.ceil(bw*sc); e.c.height=Math.ceil(bh*sc);
      const keep=ctx; ctx=e.c.getContext('2d'); ctx.setTransform(sc,0,0,sc,-bx*sc,-by*sc); const hq0=G.st.settings.hq; G.st.settings.hq=false;
      P.slice().sort((a,b)=>slotOf.get(a.id).y-slotOf.get(b.id).y).forEach(p=>{ const sl=slotOf.get(p.id); p._dv=null; drawPlantAt(p,null,sl,0); }); G.st.settings.hq=hq0; ctx=keep; }
    ctx.drawImage(e.c,e.bx,e.by,e.c.width/sc,e.c.height/sc); }
  let mulchC=null; function mulchS(){ if(mulchC) return mulchC; const c=document.createElement('canvas'); c.width=c.height=48; const x=c.getContext('2d'); const r=rng(11);
    for(let i=0;i<70;i++){ x.strokeStyle=['#c9a75a','#b08a44','#dcc07a','#8f6e34'][i%4]; x.lineWidth=1; const px=r()*48, py=r()*48, a=r()*Math.PI; x.beginPath(); x.moveTo(px,py); x.lineTo(px+Math.cos(a)*6,py+Math.sin(a)*3); x.stroke(); } return mulchC=c; }
  let glowC=null; function glowS(){ if(glowC) return glowC; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'), g=x.createRadialGradient(32,32,2,32,32,32); g.addColorStop(0,'rgba(255,226,110,1)'); g.addColorStop(1,'rgba(255,226,110,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); return glowC=c; }
  function overlays(list,now){
    const vis=list.filter(o=>{ if(!o.p.strain) return false; const q=toS(o.sl.x,o.sl.y); return q.x>-20&&q.x<W+20&&q.y>-20&&q.y<H+40; }).length, crowd=vis>(cam.z>=2.6?40:cam.z>=1.6?18:12);
    // crowded tents/beds/benches: one count badge per group instead of a pile of per-plant markers
    const CL=new Map(), inCl=new Set();
    for(const o of list){ if(!o.p.strain) continue; const sl=o.sl, k=(sl.row!=null?'rows':sl.tent)||(sl.rack?'rack':sl.bay!=null?'bay'+sl.bay:sl.bench!=null?'bn'+sl.bench:null); if(!k) continue; if(!CL.has(k)) CL.set(k,[]); CL.get(k).push(o); }
    for(const [k,a] of CL){ if(a.length<2) continue; const sp=Math.min(...a.map(o=>(o.sl.sp||.6)*o.sl.ppm))*cam.z; if(sp>=34&&!crowd) continue;
      a.forEach(o=>inCl.add(o)); let rd=0,wa=0,fo=0,pe=0,x=0,ty=1e9; for(const o of a){ const p=o.p, q=toS(o.sl.x,o.sl.y-o.h); x+=q.x; ty=Math.min(ty,q.y); if(p.prog>=1) rd++; else { if(p.pest) pe++; if(G.isThirsty(p)) wa++; if(G.isHungry(p)) fo++; } }
      x/=a.length; const items=[]; if(rd) items.push(['#7bc043','✂️',rd]); if(pe) items.push(['#e74c3c','🐛',pe]); if(wa) items.push([ICON.water[0],ICON.water[1],wa]); if(fo) items.push([ICON.food[0],ICON.food[1],fo]);
      if(!items.length) continue; const y=ty-9, iw=26, tw=items.length*iw+6; ctx.fillStyle='rgba(12,22,16,.82)'; ctx.beginPath(); ctx.roundRect(x-tw/2,y-9,tw,18,9); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1; ctx.stroke();
      ctx.textBaseline='middle'; items.forEach(([c,ic,n],i)=>{ const ix=x-tw/2+3+i*iw; ctx.font='10px sans-serif'; ctx.textAlign='left'; ctx.fillText(ic,ix+1,y+.5); ctx.font='800 10px system-ui,sans-serif'; ctx.fillStyle=c; ctx.fillText(String(n),ix+14,y+.5); ctx.fillStyle='#fff'; }); }
    // Ring stays on this plant's soil and inside its own spacing, so a tall plant does not circle the pots beside it.
    function selRing(o,s){ const stn=G.strain(o.p.strain); if(!stn) return; const ps=plantSize(stn.type,o.p.prog,o.sl), ppm=o.sl.ppm||40, sp=(o.sl.sp||.6)*ppm*cam.z, canopy=ps.w*ppm*cam.z;
      const rx=Math.max(8,Math.min(canopy*.55, sp*.42)), ry=Math.max(4,rx*.3), pu=.75+.25*Math.sin(now*5);
      ctx.strokeStyle='rgba(255,217,106,'+pu+')'; ctx.lineWidth=3; ctx.shadowColor='#ffd96a'; ctx.shadowBlur=10; ctx.beginPath(); ctx.ellipse(s.x,s.y-2,rx,ry,0,0,TAU); ctx.stroke(); ctx.shadowBlur=0; }
    for(const o of list){ const p=o.p, s=toS(o.sl.x,o.feet!=null?o.feet:o.sl.y), top=toS(o.sl.x,o.sl.y-o.h).y; if(o.sel&&p.strain) selRing(o,s); if(s.x<-40||s.x>W+40||s.y<-40||s.y>H+60) continue;
      if(p.strain&&p.prog>=1){ const pulse=.6+.4*Math.sin(now*4+o.sl.x), gr2=Math.max(16,(s.y-top)*(crowd?.42:.55)); ctx.globalAlpha=.42*pulse; ctx.drawImage(glowS(),s.x-gr2,(s.y+top)/2-gr2,gr2*2,gr2*2);
        /* QC: harvest-ready breathe: warm painted halo on the soil + two slow golden motes rising through the canopy */ { const br=.5+.5*Math.sin(now*2.2+o.sl.x*.7), rw=Math.max(14,(s.y-top)*.42); ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=(.16+.14*br)*ripeK(now); ctx.translate(s.x,s.y-2); ctx.scale(1,.3); ctx.drawImage(glowS(),-rw,-rw,rw*2,rw*2); ctx.restore(); ctx.save(); ctx.globalCompositeOperation='lighter'; for(let i=0;i<2;i++){ const f=((now*.35+i*.5+o.sl.x*.013)%1), mx=s.x+Math.sin(now*1.3+i*2.1+o.sl.x)*rw*.5, my=s.y-(s.y-top)*(.15+.8*f), ms=Math.max(2.5,(s.y-top)*.05); ctx.globalAlpha=.55*Math.sin(f*Math.PI); ctx.drawImage(glowS(),mx-ms,my-ms,ms*2,ms*2); } ctx.restore(); }
        ctx.globalAlpha=1; if(inCl.has(o)) continue;
        const cp=crowd||(s.y-top)<46, by=top-(cp?7:12)-(cp?1:3)*Math.sin(now*3+o.sl.x); const hx=bubX(s.x,cp?10:22); qbub.push({x:hx,y:by,act:{type:'qa',a:'harvest',p}}); const gr=G.gradeOf(G.plotScore(p)); const col=gr==='A'?'#f1c40f':gr==='C'?'#c87f4a':'#7bc043';
          if(cp){ ctx.fillStyle=col; ctx.beginPath(); ctx.arc(hx,by,6,0,TAU); ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke(); ctx.font='800 8px system-ui,sans-serif'; ctx.fillStyle='#1c2a12'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(gr,hx,by+.5); }
          else { badge(hx,by,[col,'✂️'],10); ctx.beginPath(); ctx.arc(hx+9,by-8,6,0,TAU); ctx.fillStyle=col; ctx.fill(); ctx.font='800 9px system-ui,sans-serif'; ctx.fillStyle='#1c2a12'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(gr,hx+11,by-8.5); } }
      else if(p.strain){ if(inCl.has(o)&&!o.sel) continue; const icons=[];
        // Only the care the plant needs right now. A full, healthy plant stays unmarked.
        if(p.pest) icons.push([ICON[p.pest]||ICON.pests,'treat']); if(G.isThirsty(p)) icons.push([ICON.water,'water']); if(G.isHungry(p)) icons.push([ICON.food,'feed']);
        // Optional training stays on the plant the player tapped, and on the plant card, so a room of plants in veg does not grow a scissors on every pot.
        if(o.sel){ if(G.canPrune(p)) icons.push([ICON.prune,'prune']); if(G.canTrain(p)) icons.push([ICON.top,'top']); }
        const cp=(crowd||(s.y-top)<46)&&!o.sel, gap=cp?24:30, r=cp?9:12; if(!lens.on) icons.forEach(([ic,a],i)=>{ const bx=bubX(s.x,((icons.length-1)/2)*gap+r+5)+(i-(icons.length-1)/2)*gap, byy=top-(cp?10:14)-(o.sel?0:2*Math.sin(now*3+i)); if(o.sel){ ctx.fillStyle='rgba(10,20,14,.55)'; ctx.beginPath(); ctx.arc(bx,byy,r+4,0,TAU); ctx.fill(); } badge(bx,byy,ic,r); qbub.push({x:bx,y:byy,act:{type:'qa',a,p}}); });
        // One timer: the plant the player tapped, at every zoom, just under its soil. Drawn in this overlay pass so it stays readable on top of the leaves in front of it.
        if(o.sel&&p.prog<1){ const r=pill(s.x,s.y+12,G.dur(G.timeLeft(p)),'rgba(10,20,14,.9)','#e9ffd6',9); ctx.strokeStyle='rgba(233,255,214,.9)'; ctx.lineWidth=1.25; rr(r.x,r.y,r.w,r.h,r.h/2); ctx.stroke(); } }
      else if(p.owned&&o.hasSeed){ // clean "plant here" badge: solid green disc, white rim, rounded plus, soft drop shadow, gentle bob
        const a=.5+.5*Math.sin(now*3+s.x*.05), r=9, cx=s.x, cy=s.y-8-a*1.5; ctx.save(); ctx.shadowColor='rgba(0,0,0,.45)'; ctx.shadowBlur=4; ctx.shadowOffsetY=1.5; const g=ctx.createLinearGradient(0,cy-r,0,cy+r); g.addColorStop(0,'#6fdc7c'); g.addColorStop(1,'#2a8f43'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,r,0,TAU); ctx.fill(); ctx.restore();
        ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(cx,cy,r,0,TAU); ctx.stroke(); ctx.lineCap='round'; ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(cx-4,cy); ctx.lineTo(cx+4,cy); ctx.moveTo(cx,cy-4); ctx.lineTo(cx,cy+4); ctx.stroke(); ctx.lineCap='butt'; }
    }
  }
  // ---------------- expansion tags ----------------
  let tags=[], qbub=[];
  function tag(wx,wy,text,act,gold){ const s=toS(wx,wy); ctx.font='700 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif'; const hw=ctx.measureText(text).width/2+10; s.x=Math.max(hw+4,Math.min(W-hw-4,s.x)); const r=pill(s.x,s.y,text,gold?'rgba(255,214,90,.95)':'rgba(16,30,22,.85)',gold?'#3a2a00':'#fff',12); ctx.strokeStyle='rgba(255,255,255,.6)'; ctx.lineWidth=1; rr(r.x,r.y,r.w,r.h,r.h/2); ctx.stroke(); tags.push(Object.assign(r,{act})); }
  function stepTag(kind,wx,wy){ const n=G.nextStep(kind); if(!n) return; const can=G.st.cash>=n.cost; tag(wx,wy,'🔒 '+n.name.replace(/\s*\(.*\)/,'')+' · '+G.fmt(n.cost),{type:'expand',kind},can); }

  // quick-action bubbles stay clear of the left buttons and the right location rail (screen px)
  let railR=null, railL=null;
  function bubBounds(){ const a=document.getElementById('locTabs'), b=document.getElementById('upgBtn'); const ra=a&&a.getClientRects().length?a.getBoundingClientRect():null, rb=b&&b.getClientRects().length?b.getBoundingClientRect():null; railR=ra&&ra.width?ra.left-6:W-6; railL=rb&&rb.width?rb.right+6:6; }
  function bubX(x,hw){ if(railR==null) bubBounds(); if(x>railR+10||x<railL-10) return NaN; // plant itself is under the rail: no bubble (pan to reach it)
    if(x+hw>railR) x=railR-hw; if(x-hw<railL) x=railL+hw; return x; }
  // ---------------- main frame ----------------
  let sel=null;
  /* QC: new-room reveal upan: ~1.5 s ease from a wide pull-back into the fitted view, on the first view of the room after it unlocks; any tap skips */
  let panWant=null, upan=null;
  function unlockPan(l){ panWant=l; }
  function skipPan(){ if(upan){ Object.assign(cam,upan.to); upan=null; } }
  addEventListener('pointerdown',skipPan,true);
  function stepPan(dt){
    if(panWant&&panWant===loc&&!upan&&!document.querySelector('#modal:not(.hidden),#celebrate:not(.hidden)')){ panWant=null; fit(); const to={x:cam.x,y:cam.y,z:cam.z}, cx=to.x+W/2/to.z, cy=to.y+H/2/to.z, z0=to.z*.7;
      upan={t:0,d:1.5,to,from:{z:z0,x:cx-W/2/z0-W*.08/z0,y:cy-H/2/z0-H*.06/z0}}; Object.assign(cam,upan.from); }
    if(!upan) return; upan.t+=dt; const k=Math.min(1,upan.t/upan.d), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2, F=upan.from, T=upan.to;
    cam.z=F.z+(T.z-F.z)*e; const fcx=F.x+W/2/F.z, fcy=F.y+H/2/F.z, tcx=T.x+W/2/T.z, tcy=T.y+H/2/T.z, cx=fcx+(tcx-fcx)*e, cy=fcy+(tcy-fcy)*e; cam.x=cx-W/2/cam.z; cam.y=cy-H/2/cam.z; if(k>=1){ Object.assign(cam,T); upan=null; } }
  // Stacked beds: one screen, no scroll. Garage 5x5 pots, Greenhouse 6x6 dirt, Indoor Facility tries 5x8 then 8x5.
  const BGSRC={garage:'assets/new-art/backgrounds/garage.jpg',gh:'assets/new-art/backgrounds/greenhouse.jpg',facility:'assets/new-art/backgrounds/indoor-facility.jpg',benches:'assets/new-art/backgrounds/indoor-facility.jpg'};
  const bgIm={}; let ledIm=null, bedLay=null;
  function ensureRoomArt(){ for(const k in BGSRC){ if(bgIm[k]) continue; const im=new Image(); im.src=BGSRC[k]; bgIm[k]=im; } if(!ledIm){ ledIm=new Image(); ledIm.src='assets/new-art/sprites/led-bar-light.png'; } }
  function roomNow(){ try{ return G.currentRoom(); }catch(e){ return 'garage'; } }
  function shownEl(id){ const e=document.getElementById(id); if(!e||e.classList.contains('hidden')) return null; const r=e.getBoundingClientRect(); if(r.width<8||r.height<8) return null; const s=getComputedStyle(e); if(s.display==='none'||s.visibility==='hidden') return null; return r; }
  function bedBand(room){
    let top=88;
    for(const id of ['hud','clock','goal','eventChip','locTabs']){ const r=shownEl(id); if(r&&r.bottom<H*0.5) top=Math.max(top, r.bottom+6); }
    if(room==='gh') top=Math.max(top, H*0.16);
    let bot=H-8;
    for(const id of ['toolbar','qaFab','seedBag','scoutBtn','upgBtn','orderBoard']){ const r=shownEl(id); if(r&&r.top>H*0.45) bot=Math.min(bot, r.top-8); }
    return {top, bot, left:8, right:Math.max(56,W-8), w:Math.max(48,W-16), h:Math.max(48,bot-top)};
  }
  function gridScore(band, cols, rows){
    const gap=4, cellW=(band.w-gap*(cols-1))/cols, cellH=(band.h-gap*(rows-1))/rows, plantH=cellH-30;
    return {ok:cellW>=40&&cellH>=40, cols, rows, cellW, cellH, gap, plantH};
  }
  function gridFor(room, band){
    if(room==='garage') return Object.assign(gridScore(band,5,5),{n:25,zone:'garage'});
    if(room==='gh') return Object.assign(gridScore(band,6,6),{n:36,zone:'gh'});
    if(room==='benches') return Object.assign(gridScore(band,8,4),{n:32,zone:'in'});
    const a=gridScore(band,5,8), b=gridScore(band,8,5);
    const pick=a.ok?a:(b.ok?b:(a.cellW>=40&&a.cellH>=40?a:b.cellW*b.cellH>a.cellW*a.cellH?b:a));
    return Object.assign(pick,{n:40,zone:'field'});
  }
  function drawCover(im){
    if(!im||!im.complete||!im.naturalWidth){ ctx.fillStyle='#143026'; ctx.fillRect(0,0,W,H); return; }
    const s=Math.max(W/im.naturalWidth,H/im.naturalHeight), dw=im.naturalWidth*s, dh=im.naturalHeight*s;
    ctx.drawImage(im,(W-dw)/2,(H-dh)/2,dw,dh);
  }
  function drawPotPx(cx, rim, cw){
    const w=Math.min(cw*0.7, 46), h=12;
    ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(cx+1,rim+h+2,w*0.55,4,0,0,TAU); ctx.fill();
    ctx.fillStyle='#1c1e22'; ctx.beginPath(); ctx.roundRect(cx-w*0.72,rim+h*0.35,w*1.44,h*0.7,3); ctx.fill();
    const g=ctx.createLinearGradient(cx-w/2,0,cx+w/2,0); g.addColorStop(0,'#16171a'); g.addColorStop(.4,'#3c3e44'); g.addColorStop(1,'#111214');
    ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(cx-w/2,rim-h); ctx.lineTo(cx-w*0.4,rim); ctx.lineTo(cx+w*0.4,rim); ctx.lineTo(cx+w/2,rim-h); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#4a3524'; ctx.beginPath(); ctx.ellipse(cx,rim-h*.15,w*0.46,w*0.1,0,0,TAU); ctx.fill();
  }
  function drawDirtPx(cx, rim, cw){
    const w=Math.max(28,cw*0.88);
    ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(cx+1,rim+5,w*0.48,6,0,0,TAU); ctx.fill();
    ctx.fillStyle='#6b4428'; ctx.beginPath(); ctx.ellipse(cx,rim,w*0.46,7,0,0,TAU); ctx.fill();
    ctx.fillStyle='#3d2814'; ctx.beginPath(); ctx.ellipse(cx,rim-1,w*0.32,4.5,0,0,TAU); ctx.fill();
  }
  function bedCard(x,y,w,h,title,sub){
    ctx.fillStyle='rgba(10,22,16,.9)'; rr(x,y,w,h,16); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='800 16px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(title,x+w/2,y+28);
    ctx.fillStyle='#d7eadc'; ctx.font='13px system-ui,sans-serif'; ctx.fillText(sub,x+w/2,y+52);
  }
  function stepScreenBits(dt){
    for(const f of fx){ f.t+=dt; f.vy+=(f.k==='fall'?20:160)*dt; f.x+=f.vx*dt; f.y+=f.vy*dt; const a=Math.max(0,1-f.t/f.life); ctx.globalAlpha=a; ctx.fillStyle=f.c; ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,TAU); ctx.fill(); }
    ctx.globalAlpha=1; for(let i=fx.length-1;i>=0;i--) if(fx[i].t>fx[i].life) fx.splice(i,1);
    ctx.font='800 15px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    for(const f of floats){ f.t+=dt; const a=Math.max(0,1-f.t/f.life); ctx.globalAlpha=a; ctx.strokeStyle='rgba(0,0,0,.55)'; ctx.lineWidth=4; ctx.strokeText(f.text,f.x,f.y-f.t*18); ctx.fillStyle=f.color; ctx.fillText(f.text,f.x,f.y-f.t*18); }
    ctx.globalAlpha=1; for(let i=floats.length-1;i>=0;i--) if(floats[i].t>floats[i].life) floats.splice(i,1);
    for(const c of coins){ c.t+=dt; if(c.t<0) continue; const k=Math.min(1,c.t/.7); ctx.globalAlpha=k>.82?Math.max(0,(1-k)/.18):1; ctx.fillStyle=c.gem?'#7af0ff':'#ffd23a'; ctx.beginPath(); ctx.arc(c.x+(c.tx-c.x)*k,c.y+(c.ty-c.y)*k,6,0,TAU); ctx.fill(); }
    ctx.globalAlpha=1; for(let i=coins.length-1;i>=0;i--) if(coins[i].t>.7) coins.splice(i,1);
  }
  function drawBeds(dt, now){
    ensureRoomArt(); const st=G.st; if(!st) return false;
    cam.x=0; cam.y=0; cam.z=1; loc=st.loc;
    const room=roomNow();
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
    drawCover(bgIm[room]||bgIm.facility); ctx.fillStyle='rgba(4,8,6,.22)'; ctx.fillRect(0,0,W,H);
    tags=[]; qbub=[]; geckoS=null; mentorS=null;
    const lit=room==='garage'||room==='facility'||room==='benches';
    let band=bedBand(room);
    const gutter=48;
    if(lit) band=Object.assign({},band,{top:band.top+gutter,h:Math.max(48,band.h-gutter)});
    const g=gridFor(room,band);
    const cells=[]; let build=null;
    if(room==='gh'&&!st.ghBuilt){
      const bw=Math.min(300,W-32), bh=132, bx=(W-bw)/2, by=Math.max(band.top, H*0.28);
      bedCard(bx,by,bw,bh,'Greenhouse','Daylight, dirt beds, no lights');
      const label=st.land?(G.gate('gh')?'Build · '+G.fmt(G.GH_BUILD.cost):'Level '+G.GH_BUILD.level):'Buy the land first';
      ctx.fillStyle=st.land&&G.gate('gh')?'#e6b325':'#3d5244'; rr(bx+24,by+74,bw-48,44,12); ctx.fill();
      ctx.fillStyle=st.land&&G.gate('gh')?'#2a1c00':'#d7eadc'; ctx.font='800 15px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(label,W/2,by+96);
      build={x:bx+24,y:by+74,w:bw-48,h:44,act:st.land?{type:'ghbuild'}:{type:'land'}};
    } else if(room==='facility'&&!st.land){
      const bw=Math.min(300,W-32), bh=120, bx=(W-bw)/2, by=band.top+12;
      bedCard(bx,by,bw,bh,'Indoor Facility','40 plots on the old family land');
      build={x:bx+24,y:by+68,w:bw-48,h:40,act:{type:'land'}};
      ctx.fillStyle='#e6b325'; rr(build.x,build.y,build.w,build.h,12); ctx.fill();
      ctx.fillStyle='#2a1c00'; ctx.font='800 15px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('Open the land',W/2,build.y+20);
    } else {
      const plots=st.plots.filter(p=>p.zone===g.zone).sort((a,b)=>a.idx-b.idx);
      const cls=room==='gh'?'gh':room==='facility'?'out':'in';
      const probe={cls,sp:10,ppm:1}; const mature=Math.max(.4,plantSize('Hybrid',1,probe).h);
      let marked=false;
      const kind=g.zone==='garage'?'garage':g.zone==='field'?'field':g.zone==='gh'?'gh':'bench';
      for(let i=0;i<g.n;i++){
        const col=i%g.cols, row=(i/g.cols)|0;
        const x=band.left+col*(g.cellW+g.gap), y=band.top+row*(g.cellH+g.gap);
        const p=plots[i]||null; const pot=room==='garage'||room==='benches';
        const potH=pot?14:8; const rim=y+g.cellH-18-potH;
        const plantH=Math.max(20,rim-y-4); const ppm=plantH/mature; const sp=Math.max(.25,(g.cellW-10)/(ppm*1.2));
        const sl={x:x+g.cellW/2,y:pot?rim-2:rim,cls,sp,ppm,kind:pot?'pot':'soil'};
        let expand=null;
        if(p&&!p.owned&&!marked&&G.nextStep(kind)){ expand=kind; marked=true; }
        cells.push({x,y,w:g.cellW,h:g.cellH,p,owned:!!(p&&p.owned),expand,sl,pot,rim});
        if(p) slotOf.set(p.id,sl);
      }
      if(lit){
        const ly=band.top-gutter+6, lw=Math.min(168,band.w*0.46), lx=(W-lw)/2;
        const glow=ctx.createRadialGradient(W/2,ly+18,6,W/2,ly+36,Math.min(220,band.w*0.55));
        glow.addColorStop(0,'rgba(255,236,190,.34)'); glow.addColorStop(1,'rgba(255,236,190,0)');
        ctx.fillStyle=glow; ctx.fillRect(band.left,ly,band.w,78);
        if(ledIm&&ledIm.complete&&ledIm.naturalWidth) ctx.drawImage(ledIm,lx,ly,lw,26);
        const ge=st.gecko&&st.gecko.on;
        if(ge&&ge.loc===st.loc){ const gx=band.left+24, gy=ly+16; geckoS={x:gx,y:gy,r:22};
          ctx.fillStyle='rgba(255,214,90,.95)'; ctx.beginPath(); ctx.arc(gx,gy,18,0,TAU); ctx.fill();
          ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🦎',gx,gy+1); }
      }
      const care=[];
      for(const c of cells){ if(!c.owned||!c.p||!c.p.strain||c.p.prog>=1) continue; if(c.p.pest||G.isThirsty(c.p)||G.isHungry(c.p)) care.push(c); }
      const group=care.length>8;
      for(const c of cells){
        if(!c.p) continue;
        const cx=c.sl.x;
        if(c.owned){ if(c.pot) drawPotPx(cx,c.rim,c.w); else drawDirtPx(cx,c.rim,c.w); }
        else { ctx.globalAlpha=.35; if(c.pot) drawPotPx(cx,c.rim,c.w); else drawDirtPx(cx,c.rim,c.w); ctx.globalAlpha=1; }
        if(c.owned&&c.p.strain){ drawPlantAt(c.p,null,c.sl,now); }
        if(c.owned&&!c.p.strain){
          ctx.fillStyle='#2f9d4a'; ctx.beginPath(); ctx.arc(cx,c.rim-16,11,0,TAU); ctx.fill();
          ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke(); ctx.strokeStyle='#fff'; ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(cx-5,c.rim-16); ctx.lineTo(cx+5,c.rim-16); ctx.moveTo(cx,c.rim-21); ctx.lineTo(cx,c.rim-11); ctx.stroke();
        }
        if(!c.owned&&c.expand){ ctx.fillStyle='rgba(255,214,90,.95)'; ctx.font='700 11px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('+',cx,c.y+c.h/2); }
        if(sel&&c.p&&sel.id===c.p.id){ ctx.strokeStyle='rgba(255,217,106,.95)'; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(cx,c.rim+2,Math.min(18,c.w*0.28),7,0,0,TAU); ctx.stroke(); }
      }
      for(const c of cells){
        if(!c.owned||!c.p||!c.p.strain) continue;
        let label=c.p.prog>=1?'Ripe':G.dur(G.timeLeft(c.p));
        ctx.font='700 11px system-ui,sans-serif';
        if(ctx.measureText(label).width+10>c.w-2) label=label.replace(/ /g,'');
        if(ctx.measureText(label).width+10>c.w-2) label=label.split(' ')[0];
        pill(c.sl.x,c.y+c.h-9,label,'rgba(10,20,14,.92)','#e9ffd6',11);
      }
      if(group){
        let pe=0,wa=0,fo=0; for(const c of care){ if(c.p.pest) pe++; else if(G.isThirsty(c.p)) wa++; else if(G.isHungry(c.p)) fo++; }
        const bits=[]; if(pe) bits.push(pe+' pests'); if(wa) bits.push(wa+' thirsty'); if(fo) bits.push(fo+' hungry');
        if(bits.length) pill(W/2,band.top-14,bits.join(' · '),'rgba(12,22,16,.9)','#fff',12);
      } else {
        for(const c of care){
          const ic=c.p.pest?(ICON[c.p.pest]||ICON.pests):G.isThirsty(c.p)?ICON.water:ICON.food;
          const a=c.p.pest?'treat':G.isThirsty(c.p)?'water':'feed';
          const bx=Math.min(c.x+c.w-14,c.x+14), by=c.y+14;
          badge(bx,by,ic,11); qbub.push({x:bx,y:by,act:{type:'qa',a,p:c.p}});
        }
      }
      const id=window.Tutorial&&Tutorial.active&&Tutorial.active()&&Tutorial.plot&&Tutorial.plot();
      if(id){ const c=cells.find(q=>q.p&&q.p.id===id&&q.owned); if(c){ const b=Math.abs(Math.sin(now*4))*8; ctx.font='32px sans-serif'; ctx.textAlign='center'; ctx.fillText('👆',c.sl.x,c.y+c.h*0.42+b); } }
    }
    bedLay={room,cells,build,band};
    stepScreenBits(dt);
    st.plots.forEach(p=>{ if(p._pop>0) p._pop=Math.max(0,p._pop-dt); if(p._shake>0) p._shake=Math.max(0,p._shake-dt); });
    return true;
  }
  function frame(dt){
    t+=dt; const now=t, st=G.st; if(!st) return; if(!SC.garage.slots) rebuild();
    try{ if(drawBeds(dt,now)) return; }catch(e){ if((frame._bedN=(frame._bedN|0)+1)<3) console.error(e); return; }
    if(G.st.loc!==loc) setLoc(G.st.loc);
    stepPan(dt);
    drawBase(); // static backdrop comes from the cached blit only (a stray second drawWorldBase() here re-painted the full room art every frame)
    const hasSeed=Object.values(st.seeds).some(n=>n>0);
    const plots=st.plots.filter(p=>p.loc===loc); const list=[]; tags=[]; qbub=[]; bubBounds();
    const backs=[], fronts=[]; let signFn=null;
    if(loc==='garage'){
      { const cap=G.capOf('garage'), lv=st.garage;
        PROWS.forEach((v,r)=>{ const n=Math.max(0,Math.min(5,cap-r*5)); if(!n) return; const a=GP(PCOLS[0]-.35,v), b=GP(PCOLS[n-1]+.35,v), k=gppm(a.y);
          // grow table under the row (drawn just before its buckets) + drip line along the table top
          list.push({y:GT(PCOLS[n-1],v).y-1.5,draw:()=>{ growTable(r,n);
            if(lv>=3){ const p0=GT(PCOLS[0]-.3,v-.24), p1=GT(PCOLS[n-1]+.3,v-.24); ctx.strokeStyle='#15171a'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y); ctx.stroke(); } }});
          // LED bar hung from the ceiling above the row (drawn in front)
          list.push({y:a.y+2,draw:()=>{ const hy=(TBL_H+1.35)*k, A={x:a.x+8,y:a.y-hy}, B={x:b.x-8,y:b.y-hy}; ctx.strokeStyle='rgba(30,30,30,.7)'; ctx.lineWidth=1; ctx.beginPath(); const top=y0=>Math.max(2,y0-(2.75-TBL_H-1.35)*k); for(const H of [{x:A.x+4,y:A.y},{x:B.x-4,y:B.y}]){ const ty=top(H.y); ctx.strokeStyle='rgba(28,29,31,.85)'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(H.x,H.y); ctx.lineTo(H.x,ty); ctx.stroke(); ctx.strokeStyle='rgba(150,155,160,.55)'; ctx.lineWidth=.8; for(let y=H.y-3;y>ty+2;y-=5){ ctx.beginPath(); ctx.ellipse(H.x,y,1.1,2,0,0,TAU); ctx.stroke(); } ctx.fillStyle='#2a2c2f'; ctx.fillRect(H.x-3,ty-1,6,2.5); ctx.fillStyle='#2a2c2f'; ctx.beginPath(); ctx.arc(H.x,H.y,1.6,0,TAU); ctx.fill(); }
            growLight(A,B,k); }});
          // clip fan on a stand at the end of each full row from level 5
          if(lv>=5&&n===5){ const f=GP(PCOLS[4]+.7,v); list.push({y:f.y,draw:()=>{ cshadow(f,k,.16); art('p_pedfan',f.x,f.y+.02*k,.8,k,true); }}); }
        }); }
      // bought garage gear shows up in the room (real-world sizes, metre-scaled with gppm)
      garageGear(list);
      // (no painted tent in the new garage art)
      if(false) list.push({y:GP(RACK.r[0],RACK.r[3]).y-.5,draw:()=>{ const [u0,u1,v0,v1]=RACK.r, a=GP(u0,v0),b=GP(u1,v0),c=GP(u1,v1),d=GP(u0,v1), h=.38*gppm(a.y); ctx.fillStyle='rgba(0,0,0,.22)'; quad(a,b,{x:b.x+6,y:b.y+4},{x:a.x+6,y:a.y+4}); ctx.fill();   
        ctx.fillStyle='#8f969c'; quad({x:a.x,y:a.y-h},{x:b.x,y:b.y-h},{x:c.x,y:c.y-h},{x:d.x,y:d.y-h}); ctx.fill(); const fg=ctx.createLinearGradient(0,a.y-h,0,a.y); fg.addColorStop(0,'#5b6167'); fg.addColorStop(1,'#3a3f44'); ctx.fillStyle=fg; quad({x:a.x,y:a.y-h},{x:b.x,y:b.y-h},b,a); ctx.fill(); ctx.fillStyle='#4a5055'; quad({x:a.x,y:a.y-h},{x:d.x,y:d.y-h},d,a); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(a.x,a.y-h); ctx.lineTo(b.x,b.y-h); ctx.stroke();
        const gl=ctx.createRadialGradient((a.x+c.x)/2,(a.y+c.y)/2-h,4,(a.x+c.x)/2,(a.y+c.y)/2-h,(b.x-a.x)*.6); gl.addColorStop(0,'rgba(255,244,214,.35)'); gl.addColorStop(1,'rgba(255,244,214,0)'); ctx.fillStyle=gl; quad({x:a.x,y:a.y-h},{x:b.x,y:b.y-h},{x:c.x,y:c.y-h},{x:d.x,y:d.y-h}); ctx.fill(); }});
      // LED bar above the rack plants: two slim posts at the back corners, bar along the middle (drawn in front of the pots)
      if(false) list.push({y:GP(RACK.r[0],RACK.r[2]).y+1,draw:()=>{ const [u0,u1,v0,v1]=RACK.r, vm=(v0+v1)/2, d=GP(u0+.08,v1), c=GP(u1-.08,v1), m0=GP(u0+.15,vm), m1=GP(u1-.15,vm), k=gppm(d.y), top=1.05*k;
        ctx.strokeStyle='#3d4247'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(d.x,d.y-.38*k); ctx.lineTo(d.x,d.y-top); ctx.lineTo(m0.x,m0.y-top); ctx.moveTo(c.x,c.y-.38*k); ctx.lineTo(c.x,c.y-top); ctx.lineTo(m1.x,m1.y-top); ctx.stroke();
        ctx.lineCap='round'; ctx.lineWidth=5; ctx.strokeStyle='#26292d'; ctx.beginPath(); ctx.moveTo(m0.x,m0.y-top); ctx.lineTo(m1.x,m1.y-top); ctx.stroke();
        ctx.lineWidth=1.8; ctx.strokeStyle='#fff3d6'; ctx.shadowColor='#ffe9b0'; ctx.shadowBlur=6; ctx.beginPath(); ctx.moveTo(m0.x+3,m0.y-top+2.4); ctx.lineTo(m1.x-3,m1.y-top+2.4); ctx.stroke(); ctx.shadowBlur=0; ctx.lineCap='butt'; }});
      { const role=G.garageRole(); if(role!=='grow'){ list.push({y:1e4,draw:()=>phenoDecor(role,now)}); if(role==='pheno') list.push({y:GP(1.25,.32).y,draw:()=>phenoDecor(role,now,'bench')}); signFn=()=>{ const label=role==='pheno'?(G.st.hunt?'PHENO ROOM · HUNT ON':'PHENO ROOM'):'GARAGE STORAGE'; const q=toS(420,4); const p=fitSign(label,q.x,Math.max(insets().top+2,q.y-34)); signBoard(p.x,p.y,label,role==='pheno'?'#2a1838':'#e8dcc4',role==='pheno'?'#ff9be9':'#4a3a2a'); }; } }
      if(G.lv('dehu')){ const p=GP(3.55,5.9); ctx.fillStyle='#e9ecef'; ctx.fillRect(p.x-12,p.y-34,24,34); ctx.fillStyle='#9aa'; ctx.fillRect(p.x-9,p.y-30,18,6); }
    }
    if(loc==='farm'){
      // terraces
      for(let k=0;k<4;k++){ const owned=st.land&&k<=st.field, next=st.land&&k===st.field+1; if(!owned&&!next) continue; const P=terracePlots(k); const a=P[0],c=P[2]; const ex=[TER.C[0]*.33,TER.C[1]*.33], lx=[TER.L[0]*.6,TER.L[1]*.6];
        const q=[{x:a[0]-lx[0]-ex[0],y:a[1]-lx[1]-ex[1]},{x:c[0]+lx[0]-ex[0],y:c[1]+lx[1]-ex[1]},{x:c[0]+lx[0]+ex[0],y:c[1]+lx[1]+ex[1]},{x:a[0]-lx[0]+ex[0],y:a[1]-lx[1]+ex[1]}];
        if(owned){ ctx.fillStyle={wet:'#43291a',dry:'#7a4e2e',makahiki:'#5a3a22'}[G.season()]; quad(...q); ctx.fill(); ctx.strokeStyle=G.lv('beds')?'#8a6a3a':'rgba(40,24,12,.6)'; ctx.lineWidth=G.lv('beds')?5:2; ctx.stroke();
          ctx.save(); quad(...q); ctx.clip(); ctx.globalAlpha=.55; ctx.fillStyle=ctx.createPattern(mulchS(),'repeat'); ctx.fillRect(Math.min(...q.map(v=>v.x)),Math.min(...q.map(v=>v.y)),400,300); ctx.restore(); ctx.globalAlpha=1;
          { const b0=terracePlots(k)[0]; ctx.strokeStyle='rgba(20,20,20,.75)'; ctx.lineWidth=1.6; ctx.beginPath(); for(const c of [-.15,.15]){ const o=[TER.C[0]*c+TER.C[0]*.035,TER.C[1]*c+TER.C[1]*.035]; ctx.moveTo(b0[0]+TER.L[0]*-.55+o[0],b0[1]+TER.L[1]*-.55+o[1]); ctx.lineTo(b0[0]+TER.L[0]*2.55+o[0],b0[1]+TER.L[1]*2.55+o[1]); } ctx.stroke(); }
          ctx.strokeStyle='rgba(30,18,8,.35)'; ctx.lineWidth=2; for(let f=-2;f<=2;f++){ const o=[TER.C[0]*.08*f,TER.C[1]*.08*f]; ctx.beginPath(); ctx.moveTo(q[0].x+ex[0]+o[0],q[0].y+ex[1]+o[1]); ctx.lineTo(q[1].x+ex[0]+o[0],q[1].y+ex[1]+o[1]); ctx.stroke(); } }
        else { ctx.setLineDash([8,6]); ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=2.5; quad(...q); ctx.stroke(); ctx.setLineDash([]); fronts.push(()=>stepTag('field',(a[0]+c[0])/2,(a[1]+c[1])/2)); } }
      // greenhouse
      const gw=GHW*GH.s, gh=GHH*GH.s;
      if(ok('greenhouse')){ ctx.globalAlpha=st.ghBuilt?1:.35; ctx.drawImage(roomIm('greenhouse'),GH.x,GH.y,gw,gh); ctx.globalAlpha=1; }
      if(st.land&&!st.ghBuilt) fronts.push(()=>tag(GH.x+gw/2,GH.y+gh/2,'Build greenhouse · '+G.fmt(G.GH_BUILD.cost)+(G.gate('gh')?'':' · Lv '+G.GH_BUILD.level),{type:'ghbuild'},st.cash>=G.GH_BUILD.cost&&G.gate('gh')));
      if(st.ghBuilt){ const nb=G.nextStep('gh'); if(nb){ const bay=st.gh+1; const [bx,by]=GH_BEDS[bay*3+1]; fronts.push(()=>stepTag('gh',GH.x+bx*GH.s,GH.y+by*GH.s)); }
        /* BUG-005: unbuilt beds no longer draw dark ovals (they read as floating shadows on the glass); the step tag marks the next bay */ }
      for(const k in BLD){ const b=BLD[k]; if(b.need&&!b.need()) continue; if(!ok(b.img)) continue; const im=IM[b.img], w=im.naturalWidth*b.s, h=im.naturalHeight*b.s; list.push({y:b.y,draw:()=>{ if(k==='cart'&&ok('b_cart_buds')) ctx.drawImage(IM.b_cart_buds,b.x-w/2,b.y-h,w,h); else ctx.drawImage(im,b.x-w/2,b.y-h,w,h); }}); }
    }
    if(loc==='farm'&&st.land){ farmProps(list,now,dt); standDecorAll(list,now); farmGear(list,now); }
    people(list,dt,now); list.push({y:-1e4,draw:()=>roomExtras(now)});
    if(loc==='indoor'){ indoorGear(list,now); const nb=G.nextStep('bench'); 
      if(st.bench>=3){ list.push({y:RACK_R.y-2,draw:()=>{ // low wooden plant stand on the floor: floor shadow, back legs, deck, apron, front legs
        const P=(i,dy)=>{ const p=rackPt(i); return {x:p.x,y:p.y+dy}; };
        const i0=-.55, i1=7.55, dep=-12, fl=RACK_H, A=P(i0,4), B=P(i1,4), C=P(i1,4+dep), D=P(i0,4+dep);
        ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.moveTo(A.x-4,A.y+fl+3); ctx.lineTo(B.x+6,B.y+fl+3); ctx.lineTo(C.x+8,C.y+fl-2); ctx.lineTo(D.x,D.y+fl-2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#5b4330'; ctx.lineWidth=3; for(const i of [i0,3.5,i1]){ const q=P(i,4+dep); ctx.beginPath(); ctx.moveTo(q.x+2,q.y); ctx.lineTo(q.x+2,q.y+fl-2); ctx.stroke(); }
        const g=ctx.createLinearGradient(0,C.y,0,A.y); g.addColorStop(0,'#b88a5c'); g.addColorStop(1,'#9a6f45'); ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(C.x,C.y); ctx.lineTo(D.x,D.y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(70,45,25,.45)'; ctx.lineWidth=.8; for(const t of [.33,.66]){ const p=P(i0,4+dep*t), q=P(i1,4+dep*t); ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke(); }
        ctx.fillStyle='#7a5636'; ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(B.x,B.y+5); ctx.lineTo(A.x,A.y+5); ctx.closePath(); ctx.fill();
        const lg=(x)=>{ const q=ctx.createLinearGradient(x-2,0,x+2,0); q.addColorStop(0,'#5e4430'); q.addColorStop(.5,'#9c7350'); q.addColorStop(1,'#4d3726'); return q; };
        for(const i of [i0,3.5,i1]){ const q=P(i,4); ctx.strokeStyle=lg(q.x); ctx.lineWidth=3.4; ctx.beginPath(); ctx.moveTo(q.x,q.y+4); ctx.lineTo(q.x,q.y+fl+2); ctx.stroke(); }
        ctx.fillStyle='rgba(0,0,0,.32)'; for(let i=0;i<8;i++){ const p=rackPt(i); ctx.beginPath(); ctx.ellipse(p.x+2,p.y+1,p.w*.34,p.w*.09,0,0,TAU); ctx.fill(); } }}); }
      if(nb){ const r=IN_ROWS[Math.min(2,st.bench+1)]; fronts.push(()=>stepTag('bench',(r[0][0]+r[7][0])/2,(r[0][1]+r[7][1])/2-(st.bench+1>=3?90:0))); } }
    if(loc==='garage'&&(st.quest>=5||st.garage>0)){ const n=G.nextStep('garage'); if(n){ const nx=SC.garage.slots[G.capOf('garage')]||SC.garage.slots[24], q=GP(nx.u,nx.v-.3); fronts.push(()=>stepTag('garage',q.x,q.y)); } }
    // plots
    const selId=sel&&sel.id;
    // zoomed out on the farm: each terrace patch's plants are pre-rendered into one cached bitmap (re-rendered only when a plant
    // changes visibly), and drawn as a single item. Overlays (icons, ripe glow) still come from the per-plot entries.
    const useCache=loc==='farm'&&cam.z<.8&&!SCALE_DEBUG, cachedT={};
    for(const p of plots){ const sl=slotOf.get(p.id); if(!sl) continue;
      if(useCache&&p.owned&&p.zone==='field'&&p.strain&&!(p._pop>0)&&!(p._shake>0)){ const o={p,sl,h:plantSize(G.strain(p.strain).type,p.prog,sl).h*sl.ppm,feet:sl.y,sel:selId===p.id,hasSeed}; (cachedT[sl.ter]=cachedT[sl.ter]||[]).push(p); list.push({y:sl.y,draw:()=>{},o}); fronts.push(null); continue; }
      if(!p.owned){ if(loc==='indoor'&&st.inBuilt&&sl.kind==='art'){ list.push({y:sl.sortY!=null?sl.sortY:sl.y,draw:()=>{ ctx.fillStyle='rgba(10,14,20,.55)'; ctx.beginPath(); ctx.ellipse(sl.x,sl.y,sl.pw*.55,sl.pw*.25,0,0,TAU); ctx.fill(); }}); } continue; }
      const o={p,sl,h:20,feet:sl.y,sel:selId===p.id,hasSeed}; list.push({y:sl.sortY!=null?sl.sortY:sl.y,draw:()=>{
        const yoff=potLift(sl); o.feet=sl.y-yoff;
        if(sl.kind==='pot'){ ctx.save(); ctx.translate(0,-yoff); bucketPot(sl.x,sl.y,sl.ppm); ctx.restore(); }
        else if(sl.kind==='pot2'||sl.kind==='rackpot'){ const small=sl.kind!=='pot'; ctx.save(); ctx.translate(0,-yoff); fabricPot(sl.x,sl.y,sl.ppm,small,G.lv('trays')&&p.zone==='garage'); ctx.restore(); }
        else if(sl.kind==='soil'||sl.kind==='bed') soilMound(sl.x,sl.y,sl.ppm);
        if(p.strain){ ctx.save(); ctx.translate(0,-yoff); o.h=drawPlantAt(p,null,sl,now)+yoff; ctx.restore(); }
        else o.h=12; }}); fronts.push(null); list[list.length-1].o=o; }
    for(const k in cachedT){ const P=cachedT[k]; const ys=P.map(p=>slotOf.get(p.id).y); list.push({y:Math.max(...ys)+.5,draw:()=>drawPatch(k,P)}); }
    list.sort((a,b)=>a.y-b.y); const ovl=[];
    for(const d of list){ d.draw(); if(d.o) ovl.push(d.o); } lastOvl=ovl;
    if(loc==='farm'&&st.ghBuilt&&ok('greenhouse')){ ctx.globalAlpha=G.lv('shade')?.3:.2; ctx.drawImage(roomIm('greenhouse'),GH.x,GH.y,GHW*GH.s,GHH*GH.s); ctx.globalAlpha=1; { const P=[[40,412],[268,512],[452,578],[852,344],[856,400],[455,642],[268,568],[40,462]]; ctx.save(); ctx.beginPath(); P.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](GH.x+x*GH.s,GH.y+y*GH.s)); ctx.closePath(); ctx.clip(); ctx.drawImage(roomIm('greenhouse'),GH.x,GH.y,GHW*GH.s,GHH*GH.s); ctx.restore(); } // stone knee wall stays in front of the beds
      ghRoofGear(now); }
    if(loc==='farm') cloudShadows(now);
    if(SCALE_DEBUG) scaleDebug();
    // particles
    for(const f of fx){ f.t+=dt; f.vy+=(f.k==='fall'?20:160)*dt; if(f.k==='fall'){ f.vy=Math.min(f.vy,28); f.vx=Math.sin(f.t*5+f.r)*22; } f.x+=f.vx*dt; f.y+=f.vy*dt; const a=Math.max(0,1-f.t/f.life); ctx.globalAlpha=a; ctx.fillStyle=f.c; if(f.k==='fall'){ ctx.beginPath(); ctx.ellipse(f.x,f.y,f.r*1.6,f.r*.7,f.t*3,0,TAU); ctx.fill(); } else if(f.k==='water'){ ctx.beginPath(); ctx.ellipse(f.x,f.y,f.r*.6,f.r*1.2,0,0,TAU); ctx.fill(); } else if(f.k==='leaf'){ ctx.beginPath(); ctx.ellipse(f.x,f.y,f.r*1.5,f.r*.7,f.t*5,0,TAU); ctx.fill(); } else { ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,TAU); ctx.fill(); } }
    ctx.globalAlpha=1; for(let i=fx.length-1;i>=0;i--) if(fx[i].t>fx[i].life) fx.splice(i,1);
    // ---- screen space ----
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(loc==='farm') weather(now,dt);
    if(loc==='indoor'&&G.lv('led')){ ctx.fillStyle='rgba(200,150,255,'+(.03*G.lv('led'))+')'; ctx.fillRect(0,0,W,H); }
    themeFX(dt);
    drawMentor(); drawGecko(now);
    overlays(ovl,now); nameTags(); guide(now);
    for(const f of fronts) if(f) f(); if(signFn) signFn();
    if(loc==='farm'&&!st.land){ pill(W/2,H/2,'Buy the family land to open the farm','rgba(16,30,22,.85)','#fff',14); }
    { const L=[]; ctx.font='800 15px system-ui,sans-serif'; const cv=document.getElementById('game'), cr=cv?cv.getBoundingClientRect():{left:0,top:0};
      const rt=document.getElementById('locTabs'); let xL=6; for(const id of ['seedBag','scoutBtn','upgBtn']){ const e=document.getElementById(id); if(e&&e.getClientRects().length){ const r=e.getBoundingClientRect(); if(r.width) xL=Math.max(xL,r.right-cr.left+8); } } const _x=0, xR=rt&&rt.getClientRects().length?rt.getBoundingClientRect().left-cr.left-6:W-6;
      for(const f of floats){ f.t+=dt; const s=toS(f.x,f.y), tw=ctx.measureText(f.text).width/2; const x=Math.max(xL+tw,Math.min(xR-tw,s.x)); L.push({f,x,tw,y:Math.max(hudFloor()+18,s.y-f.dy*Ease.outCubic(Math.min(1,f.t/.8)))}); }
      L.sort((a,b)=>a.y-b.y); for(let i=1;i<L.length;i++) for(let k=0;k<i;k++){ const A=L[k],B=L[i]; if(Math.abs(A.x-B.x)<A.tw+B.tw+8&&B.y<A.y+22) B.y=A.y+22; }
      for(const o of L){ const f=o.f, a=Math.max(0,1-f.t/f.life), sc=f.t<.18?Ease.outBack(f.t/.18):1; ctx.globalAlpha=a; ctx.textAlign='center'; ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.55)'; ctx.save(); ctx.translate(o.x,o.y); ctx.scale(sc,sc); ctx.strokeText(f.text,0,0); ctx.fillStyle=f.color; ctx.fillText(f.text,0,0); ctx.restore(); } }
    ctx.globalAlpha=1; for(let i=floats.length-1;i>=0;i--) if(floats[i].t>floats[i].life) floats.splice(i,1);
    for(const c of coins){ c.t+=dt; if(c.t<0) continue; const k=Math.min(1,c.t/.7), e=k*k; const x=c.x+(c.tx-c.x)*e, y=c.y+(c.ty-c.y)*e-Math.sin(k*Math.PI)*60; ctx.globalAlpha=k>.82?Math.max(0,(1-k)/.18):1; if(k>=1&&!c.hit){ c.hit=1; const pe=document.getElementById(c.gem?'gemPill':'cashPill'); if(pe){ pe.classList.remove('bump'); void pe.offsetWidth; pe.classList.add('bump'); } } ctx.fillStyle=c.gem?'#7af0ff':'#ffd23a'; ctx.strokeStyle=c.gem?'#2a9ab0':'#b8860b'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,y,6,0,TAU); ctx.fill(); ctx.stroke(); }
    ctx.globalAlpha=1; for(let i=coins.length-1;i>=0;i--) if(coins[i].t>.7) coins.splice(i,1);
    drawFlyers(dt); drawLens();
    st.plots.forEach(p=>{ if(p._pop>0) p._pop=Math.max(0,p._pop-dt); if(p._shake>0) p._shake=Math.max(0,p._shake-dt); });
  }
  // ---- scale debug overlay (open the game with ?scale=1): 1.7 m reference adults + metre rulers at known props ----
  const SCALE_DEBUG=/[?&]scale=1/.test(location.search);
  function refFig(x,y,ppm,label){ const h=1.7*ppm; ctx.save(); ctx.globalAlpha=.85;
    if(ok('npc_overalls')){ const im=IM.npc_overalls, w=h*im.naturalWidth/im.naturalHeight; ctx.globalAlpha=.6; ctx.drawImage(im,x-w/2,y-h,w,h); ctx.globalAlpha=.9; }
    const rx=x+h*.28; for(let i=0;i<17;i++){ ctx.fillStyle=i%2?'#fff':'#e0302a'; ctx.fillRect(rx,y-(i+1)*ppm*.1,4,ppm*.1); }
    ctx.strokeStyle='#e0302a'; ctx.lineWidth=1.5; for(let m=0;m<=1.7;m+=.5){ ctx.beginPath(); ctx.moveTo(rx-6,y-m*ppm); ctx.lineTo(rx+10,y-m*ppm); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(rx-8,y-1.7*ppm); ctx.lineTo(rx+12,y-1.7*ppm); ctx.stroke();
    ctx.font='700 '+Math.max(9,ppm*.18)+'px system-ui'; ctx.fillStyle='#fff'; ctx.strokeStyle='#000'; ctx.lineWidth=3; ctx.textAlign='left'; const t='1.7 m · '+Math.round(ppm)+' px/m'+(label?' · '+label:''); ctx.strokeText(t,rx+12,y-1.7*ppm); ctx.fillText(t,rx+12,y-1.7*ppm); ctx.restore(); }
  function scaleDebug(){
    if(loc==='farm'){ const b=BLD.stand, h=BLD.house; refFig(b.x+150,b.y+8,FARM_PPM,'stand post 2.2 m'); refFig(GH.x+290*GH.s,GH.y+535*GH.s,FARM_PPM,'greenhouse door 2.05 m'); refFig(h.x-160,h.y+10,FARM_PPM,'house'); refFig(BLD.shed.x-230,BLD.shed.y,FARM_PPM,'shed'); const P=terracePlots(0)[0]; refFig(P[0]-40,P[1]+12,FARM_PPM,'terrace'); }
    if(loc==='garage'){ refFig(555,500,gppm(500),'truck cab ~1.9 m'); refFig(430,352,gppm(352),'tent / bench'); const p=GP(1.0,1.6); refFig(p.x,p.y,gppm(p.y),'open floor'); }
    if(loc==='indoor'){ refFig(255,520,inppm(520),'bench ~0.8 m'); refFig(870,420,inppm(420),'back'); }
  }
  // first-minutes guide: a bouncing finger on the exact plant the current tutorial goal needs
  function guide(now){ const st=G.st; if(!st) return; let p=null;
    const tut=window.Tutorial&&Tutorial.active&&Tutorial.active();
    if(tut&&Tutorial.plot){ const id=Tutorial.plot(); if(id) p=st.plots.find(x=>x.id===id&&x.loc===loc); }
    else { const q=G.curQuest&&G.curQuest(); if(!q||st.questDone||st.quest>4||loc!=='garage') return;
      const mine=st.plots.filter(x=>x.loc===loc&&x.owned);
      if(q.id==='plant') p=mine.find(x=>!x.strain); else if(q.id==='water') p=mine.find(x=>x.strain&&G.isThirsty(x))||mine.find(x=>x.strain&&x.prog<1); else if(q.id==='harvest') p=mine.find(x=>x.strain&&x.prog>=1); }
    if(!p) return; const sl=slotOf.get(p.id); if(!sl) return; const s=toS(sl.x,sl.y); const mv=st.settings.motion!==false, b=mv?Math.abs(Math.sin(now*4))*10:4;
    ctx.save(); ctx.strokeStyle='rgba(255,226,110,'+(mv?.5+.4*Math.sin(now*4):.8)+')'; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(s.x,s.y-4,26+(mv?Math.sin(now*4)*4:0),11,0,0,TAU); ctx.stroke();
    ctx.font='34px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.shadowColor='rgba(0,0,0,.5)'; ctx.shadowBlur=6; ctx.fillText('👆',s.x+6,s.y+8+b); ctx.restore(); }
  // golden gecko (rare tappable boost) and Unko Kuli's mentor bubble
  let geckoS=null, mentorS=null; const MENTOR={garage:[640,120],farm:[1560,560],indoor:[980,560]};
  function drawGecko(now){ geckoS=null; const g=G.st.gecko&&G.st.gecko.on; if(!g||g.loc!==loc) return; const sc=SC[loc], f=H>W?sc.focusP:sc.focusL;
    const w=toS(f[0]+(f[2]-f[0])*(.15+.7*g.u), f[1]+(f[3]-f[1])*(.35+.5*g.v)); const k=Math.max(.8,Math.min(1.4,cam.z*1.4)), wig=Math.sin(now*10)*.25;
    ctx.save(); ctx.translate(w.x,w.y); ctx.scale(k,k); const glow=ctx.createRadialGradient(0,0,2,0,0,34); glow.addColorStop(0,'rgba(255,225,90,.55)'); glow.addColorStop(1,'rgba(255,225,90,0)'); ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(0,0,34,0,TAU); ctx.fill();
    ctx.rotate(Math.sin(now*2)*.2); ctx.strokeStyle='#d99a14'; ctx.lineWidth=5; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(-10,0); ctx.quadraticCurveTo(-22,8+wig*10,-28,-4); ctx.stroke();
    ctx.lineWidth=3; for(const [x,sgn] of [[6,1],[6,-1],[-6,1],[-6,-1]]){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+4,sgn*(9+wig*4*sgn)); ctx.stroke(); }
    const gg=ctx.createLinearGradient(0,-6,0,6); gg.addColorStop(0,'#fff0a0'); gg.addColorStop(1,'#e8a817'); ctx.fillStyle=gg; ctx.beginPath(); ctx.ellipse(0,0,13,6,0,0,TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(15,0,6,4.5,0,0,TAU); ctx.fill();
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(18,-2,1.3,0,TAU); ctx.arc(18,2,1.3,0,TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle='rgba(255,255,255,.9)'; for(let i=0;i<3;i++){ const a=now*3+i*2.1; ctx.beginPath(); ctx.arc(w.x+Math.cos(a)*26*k,w.y+Math.sin(a)*18*k,1.8,0,TAU); ctx.fill(); }
    geckoS={x:w.x,y:w.y,r:36*k}; }
  // the mentor badge shows whoever speaks for the current story goal (Unko Kuli, Kai, Malia, Keoni, Auntie Lani, Uncle Ikaika)
  const busts={}; function bustOf(n){ const c=window.CHARACTERS&&window.CHARACTERS[n]; const src=c&&c.bust||'art/portraits/unko-kuli-bust.webp'; if(!busts[src]){ busts[src]=new Image(); busts[src].src=src; } return busts[src]; }
  function drawMentor(){ mentorS=null; const q=G.curQuest&&G.curQuest(); let bust=bustOf(q&&q.who||'Unko Kuli'); if(!bust.complete||!bust.naturalWidth) bust=bustOf('Unko Kuli'); if(!G.F.storyGoals||!bust.complete||!bust.naturalWidth) return; const m=MENTOR[loc]; if(loc==='farm'&&!G.st.land) return; const p=toS(m[0],m[1]); const r=loc==='garage'?Math.max(12,Math.min(17,40*cam.z)):Math.max(20,Math.min(34,30*cam.z));
    ctx.save(); ctx.shadowColor='rgba(0,0,0,.4)'; ctx.shadowBlur=8; ctx.drawImage(bust,p.x-r,p.y-r,r*2,r*2); ctx.restore();
    if(G.st.questDone){ ctx.fillStyle='#ffd23a'; ctx.beginPath(); ctx.arc(p.x+r*.75,p.y-r*.75,Math.max(5,r*.36),0,TAU); ctx.fill(); ctx.fillStyle='#3a2a00'; ctx.font='900 '+Math.round(Math.max(8,r*.5))+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('!',p.x+r*.75,p.y-r*.75+.5); }
    mentorS={x:p.x,y:p.y,r}; }
  // cosmetic themes (shop / level reward): colour grade + ambient particles
  const TH={golden:{c:'rgba(255,160,50,.16)'},neon:{c:'rgba(170,40,255,.18)',p:'#3ff0ff'},plumeria:{c:'rgba(255,150,190,.10)',p:'#ffd1e3',petal:1},mauna:{c:'rgba(120,170,255,.14)',p:'#ffffff'}};
  const tp=[];
  function themeFX(dt){ const th=TH[G.st.theme]; if(!th) return; ctx.save(); ctx.globalCompositeOperation='overlay'; ctx.fillStyle=th.c; ctx.fillRect(0,0,W,H); ctx.restore();
    if(!th.p||!G.st.settings.hq) return; while(tp.length<28) tp.push({x:Math.random()*W,y:Math.random()*H,v:20+Math.random()*30,a:Math.random()*6}); 
    ctx.fillStyle=th.p; for(const q of tp){ q.y+=q.v*dt; q.a+=dt; q.x+=Math.sin(q.a)*12*dt; if(q.y>H){ q.y=-8; q.x=Math.random()*W; } ctx.globalAlpha=.7; ctx.beginPath(); if(th.petal) ctx.ellipse(q.x,q.y,4,2.2,q.a,0,TAU); else ctx.arc(q.x,q.y,G.st.theme==='neon'?1.6:2.2,0,TAU); ctx.fill(); } ctx.globalAlpha=1; }
  // weather + day tint on the open-air farm
  const flies=[], WIN=[['house',-.12,.42,.16],['house',.18,.4,.14],['hale',0,.3,.2],['shed',-.05,.35,.15],['stand',0,.45,.3]];
  const drops=[], splash=[], PUDDLES=[[760,1215,40],[1110,1290,28],[520,1225,24],[1600,1080,34],[1000,1205,22]]; let wet=0, flash=-2;

  function weather(now,dt){ const w=G.st.weather.type, ph=G.dayPhase(); const night=ph<.2||ph>.8?1:ph<.27?(.27-ph)/.07:ph>.73?(ph-.73)/.07:0;
    if(night>0){ ctx.fillStyle='rgba(10,20,60,'+(.42*night)+')'; ctx.fillRect(0,0,W,H);
      if(G.st.ghBuilt&&G.lv('supp')){ const c=toS(GH.x+400*GH.s,GH.y+420*GH.s); const g=ctx.createRadialGradient(c.x,c.y,10,c.x,c.y,300*cam.z); g.addColorStop(0,'rgba(255,200,120,'+(.35*night)+')'); g.addColorStop(1,'rgba(255,200,120,0)'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); } }
    // sunrise / sunset colour grade
    const sr=Math.max(0,1-Math.abs(ph-.26)/.07), ss=Math.max(0,1-Math.abs(ph-.74)/.07), dim=w==='rain'||w==='storm'?.4:1;
    if(sr>0||ss>0){ const morn=sr>ss, k=Math.max(sr,ss)*dim; ctx.save(); ctx.globalCompositeOperation='overlay'; ctx.fillStyle=morn?'rgba(255,150,130,'+(.38*k)+')':'rgba(255,115,35,'+(.45*k)+')'; ctx.fillRect(0,0,W,H); ctx.restore();
      const g=ctx.createLinearGradient(0,0,0,H*.55); g.addColorStop(0,morn?'rgba(255,175,195,'+(.3*k)+')':'rgba(200,70,140,'+(.3*k)+')'); g.addColorStop(1,'rgba(255,160,90,0)'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H*.55); }
    // lit windows + fireflies at night
    if(night>.3){ ctx.save(); ctx.globalCompositeOperation='lighter'; for(const [k,dx,dy,r] of WIN){ const b=BLD[k]; if(!b||(b.need&&!b.need())||!ok(b.img)) continue; const im=IM[b.img], bw=im.naturalWidth*b.s, bh=im.naturalHeight*b.s, q=toS(b.x+dx*bw,b.y-dy*bh), rr2=r*bw*cam.z;
        const fl=.85+.15*Math.sin(now*3+dx*9); const g=ctx.createRadialGradient(q.x,q.y,1,q.x,q.y,rr2); g.addColorStop(0,'rgba(255,190,90,'+(.55*night*fl)+')'); g.addColorStop(1,'rgba(255,150,60,0)'); ctx.fillStyle=g; ctx.fillRect(q.x-rr2,q.y-rr2,rr2*2,rr2*2); }
      if(w!=='rain'&&w!=='storm'){ const n=G.st.settings.hq?26:8; while(flies.length<n) flies.push({x:Math.random()*2400,y:720+Math.random()*620,a:Math.random()*6,s:.5+Math.random()}); flies.length=n;
        for(const f of flies){ f.a+=dt*f.s; f.x+=Math.cos(f.a*.7)*12*dt; f.y+=Math.sin(f.a)*8*dt; const q=toS(f.x,f.y-30-Math.sin(f.a*1.3)*15); if(q.x<-10||q.x>W+10||q.y<-10||q.y>H+10) continue; const bl=Math.max(0,Math.sin(f.a*2.3))*night;
          const g=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,7); g.addColorStop(0,'rgba(230,255,120,'+bl+')'); g.addColorStop(1,'rgba(180,255,80,0)'); ctx.fillStyle=g; ctx.fillRect(q.x-7,q.y-7,14,14); } } ctx.restore(); }
    // vog: volcanic haze, warm grey and thicker toward the horizon
    if(w==='vog'){ ctx.fillStyle='rgba(205,190,150,.22)'; ctx.fillRect(0,0,W,H); const g=ctx.createLinearGradient(0,0,0,H*.6); g.addColorStop(0,'rgba(215,200,160,.45)'); g.addColorStop(1,'rgba(215,200,160,0)'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H*.6); }
    if(w==='storm'){ ctx.fillStyle='rgba(20,30,40,.25)'; ctx.fillRect(0,0,W,H); }
    if(w==='rain'||w==='storm'){ const n=w==='storm'?140:80; while(drops.length<n) drops.push({x:Math.random()*W,y:Math.random()*H,v:500+Math.random()*300}); drops.length=n;
      ctx.strokeStyle='rgba(200,225,255,.45)'; ctx.lineWidth=1; ctx.beginPath(); for(const d of drops){ d.y+=d.v*dt; d.x-=d.v*.15*dt; if(d.y>H){ d.y=-10; d.x=Math.random()*W*1.2; } ctx.moveTo(d.x,d.y); ctx.lineTo(d.x+3,d.y-14); } ctx.stroke(); }
    // wet ground lingers after showers; splashes + puddle sheen; storm lightning (off with reduced motion)
    const rainy=w==='rain'||w==='storm'; wet+=((rainy?1:0)-wet)*Math.min(1,dt*(rainy?.4:.04));
    if(wet>.02){ const gy=Math.max(0,toS(0,640).y); ctx.fillStyle='rgba(15,35,55,'+(.16*wet)+')'; ctx.fillRect(0,gy,W,H-gy);
      for(const [px,py,r] of PUDDLES){ const q=toS(px,py); ctx.fillStyle='rgba(170,200,230,'+(.35*wet)+')'; ctx.beginPath(); ctx.ellipse(q.x,q.y,r*cam.z,r*.3*cam.z,0,0,TAU); ctx.fill(); ctx.fillStyle='rgba(255,255,255,'+(.25*wet)+')'; ctx.beginPath(); ctx.ellipse(q.x-r*.3*cam.z,q.y-r*.06*cam.z,r*.35*cam.z,r*.06*cam.z,0,0,TAU); ctx.fill(); }
      if(rainy&&G.st.settings.hq){ const gy2=Math.max(gy,0); for(let i=0;i<(w==='storm'?6:3);i++) splash.push({x:Math.random()*W,y:gy2+Math.random()*(H-gy2),t:0});
        ctx.strokeStyle='rgba(220,235,255,.6)'; ctx.lineWidth=1; for(const q of splash){ q.t+=dt; const k=q.t/.35; ctx.globalAlpha=Math.max(0,1-k); ctx.beginPath(); ctx.ellipse(q.x,q.y,2+k*7,(2+k*7)*.35,0,0,TAU); ctx.stroke(); } ctx.globalAlpha=1; for(let i=splash.length-1;i>=0;i--) if(splash[i].t>.35) splash.splice(i,1); } }
    if(w==='storm'&&G.st.settings.motion!==false){ flash-=dt; if(flash<-4-Math.random()*6) flash=.25; if(flash>0){ ctx.fillStyle='rgba(235,240,255,'+(flash*1.4)+')'; ctx.fillRect(0,0,W,H); } }
    if(G.st.weather.rainbow>0){ const r=G.st.weather.rainbow, a=Math.min(1,(60-r)/6,r/10)*.42; const hz=Math.min(H*.62,Math.max(H*.3,toS(0,640).y)); const rad=Math.max(W*.42,H*.55), cx=W*.58, cy=hz+rad*.35;
      ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,hz); ctx.clip(); ctx.globalCompositeOperation='screen'; const bw=Math.max(5,rad*.018);
      ['#ff4d4d','#ffa64d','#fff04d','#4dff6a','#4db8ff','#8a4dff'].forEach((col,i)=>{ ctx.strokeStyle=col; ctx.lineWidth=bw*1.15; ctx.globalAlpha=a; ctx.beginPath(); ctx.arc(cx,cy,rad-i*bw,Math.PI*1.05,Math.PI*1.95); ctx.stroke(); });
      ctx.globalAlpha=a*.35; ctx.strokeStyle='#ffffff'; ctx.lineWidth=bw*7; ctx.beginPath(); ctx.arc(cx,cy,rad-2.5*bw,Math.PI*1.05,Math.PI*1.95); ctx.stroke(); ctx.restore(); }
  }
  // ================= FARM LIFE: ground decor, props, chickens, cloud shadows, harvest flyers =================
  // All sizes in metres at FARM_PPM (50 px/m) so props match the 1.7 m people.
  const M=FARM_PPM; let groundC=null;
  function rng(s){ return ()=>{ s=(s*16807)%2147483647; return (s-1)/2147483646; }; }
  function groundDecor(){ if(groundC) return groundC; const c=document.createElement('canvas'); c.width=2600; c.height=760; const x=c.getContext('2d'); x.translate(-100,-600); const r=rng(7);
    // gravel plaza under the stand + cart
    let g=x.createRadialGradient(930,1255,20,930,1255,330); g.addColorStop(0,'rgba(196,160,112,.85)'); g.addColorStop(.75,'rgba(176,138,92,.6)'); g.addColorStop(1,'rgba(176,138,92,0)'); x.fillStyle=g; x.beginPath(); x.ellipse(930,1255,340,95,0,0,TAU); x.fill();
    for(let i=0;i<500;i++){ const a=r()*TAU, d=Math.sqrt(r()); x.fillStyle=r()<.5?'rgba(120,96,70,.45)':'rgba(235,215,180,.5)'; x.fillRect(930+Math.cos(a)*d*300,1255+Math.sin(a)*d*80,2,1.5); }
    // trail from the greenhouse door to the stand, and stepping stones up to the terraces
    x.strokeStyle='rgba(150,100,60,.55)'; x.lineWidth=20; x.lineCap='round'; x.beginPath(); x.moveTo(330,930); x.bezierCurveTo(360,1080,520,1200,700,1235); x.stroke();
    x.strokeStyle='rgba(110,70,40,.25)'; x.lineWidth=30; x.stroke();
    for(let i=0;i<7;i++){ const t=i/6, px=990+(940-990)*t+Math.sin(t*5)*18, py=1195-t*230; x.fillStyle='rgba(70,60,52,.35)'; x.beginPath(); x.ellipse(px+2,py+3,17,8,0,0,TAU); x.fill(); x.fillStyle='#a49a8e'; x.beginPath(); x.ellipse(px,py,16,7,.2,0,TAU); x.fill(); x.fillStyle='rgba(255,255,255,.18)'; x.beginPath(); x.ellipse(px-4,py-2,8,3,.2,0,TAU); x.fill(); }
    // flower tufts + clover across the grass (kept off terraces, greenhouse and plaza)
    const busy=(px,py)=>(px>80&&px<580&&py<950)||(px>800&&px<1700&&py>700&&py<1180)||(Math.hypot((px-930)/340,(py-1255)/95)<1);
    const FL=['#ff7aa8','#ffd23a','#ffffff','#ff9a3a','#c08bff'];
    for(let i=0;i<420;i++){ const px=r()*2500-50, py=650+r()*700; if(busy(px,py)) continue; const k=r();
      if(k<.55){ x.strokeStyle='rgba(40,90,25,.55)'; x.lineWidth=1.4; x.beginPath(); for(let j=-2;j<=2;j++){ x.moveTo(px+j*2,py); x.lineTo(px+j*3.2,py-6-r()*5); } x.stroke(); }
      else { const col=FL[Math.floor(r()*FL.length)]; for(let j=0;j<4;j++){ x.fillStyle=col; x.beginPath(); x.arc(px+(r()-.5)*12,py+(r()-.5)*5,2.2,0,TAU); x.fill(); } } }
    return groundC=c; }
  // props: [x,y,kind]
  const PROPS=[[560,1235,'sign'],[690,1190,'planter'],[1250,1240,'planter'],[965,1195,'crates'],[600,1255,'torch'],[1200,1235,'torch'],[1290,1180,'bench'],
    [560,1060,'bush'],[1360,1050,'bush'],[1430,1265,'bush'],[230,1180,'bush'],[660,960,'bush'],[1780,880,'bush'],[1880,1270,'bush']];   // BUG-007: code-drawn palms removed (flat style); re-add only as painted sprites
  function prop(k,x0,y0,now){ ctx.save(); ctx.translate(x0,y0); const sh=(w)=>{ ctx.fillStyle='rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(3,1,w,w*.28,0,0,TAU); ctx.fill(); };
    if(k==='sign'){ sh(.5*M); ctx.fillStyle='#6b4a2a'; ctx.fillRect(-.45*M,-1.0*M,.07*M,1.0*M); ctx.fillRect(.38*M,-1.0*M,.07*M,1.0*M); ctx.fillStyle='#8a5e34'; ctx.fillRect(-.6*M,-1.45*M,1.2*M,.55*M); ctx.strokeStyle='#4a301a'; ctx.lineWidth=2; ctx.strokeRect(-.6*M,-1.45*M,1.2*M,.55*M);
      ctx.fillStyle='#fff3d6'; ctx.font='900 '+(.2*M)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('FARM STAND',0,-1.23*M); ctx.fillStyle='#ffd23a'; ctx.font='800 '+(.13*M)+'px system-ui'; ctx.fillText('OPEN DAILY',0,-1.04*M); }
    else if(k==='planter'){ sh(.45*M); ctx.fillStyle='#7a5232'; ctx.fillRect(-.4*M,-.4*M,.8*M,.4*M); ctx.fillStyle='#5e3e24'; ctx.fillRect(-.4*M,-.4*M,.8*M,.07*M);
      const FL=['#ff5a8a','#ffd23a','#ff8a3a','#ffffff']; for(let i=0;i<9;i++){ const a=i*2.4, px=Math.sin(a*1.7)*.3*M, py=-.42*M-Math.abs(Math.cos(a))*.25*M; ctx.fillStyle='#3f8a2e'; ctx.beginPath(); ctx.ellipse(px,py+4,6,3,a,0,TAU); ctx.fill(); ctx.fillStyle=FL[i%4]; ctx.beginPath(); ctx.arc(px,py,4.2,0,TAU); ctx.fill(); ctx.fillStyle='#ffef9a'; ctx.beginPath(); ctx.arc(px,py,1.4,0,TAU); ctx.fill(); } }
    else if(k==='crates'){ sh(.6*M); const box=(bx,by,s)=>{ ctx.fillStyle='#b88a52'; ctx.fillRect(bx,by-s,s*1.3,s); ctx.strokeStyle='#7a5530'; ctx.lineWidth=1.5; ctx.strokeRect(bx,by-s,s*1.3,s); ctx.beginPath(); ctx.moveTo(bx,by-s/2); ctx.lineTo(bx+s*1.3,by-s/2); ctx.stroke(); };
      box(-.55*M,0,.4*M); box(0,0,.4*M); box(-.3*M,-.4*M,.4*M); ctx.fillStyle='#ffb21a'; for(let i=0;i<5;i++){ ctx.beginPath(); ctx.arc(-.2*M+i*7,-.82*M,4.5,0,TAU); ctx.fill(); } ctx.fillStyle='#e8d23a'; ctx.beginPath(); ctx.ellipse(.15*M,-.43*M,9,4,.3,0,TAU); ctx.fill(); }
    else if(k==='torch'){ sh(.15*M); ctx.fillStyle='#5a3a1e'; ctx.fillRect(-2.5,-1.8*M,5,1.8*M); ctx.fillStyle='#8a6a3a'; ctx.fillRect(-5,-1.85*M,10,.18*M);
      const f=1+Math.sin(now*13+x0)*.12+Math.sin(now*7.3)*.08, ph=G.dayPhase(), lit=ph<.27||ph>.73?1:.55; ctx.globalAlpha=lit; const g=ctx.createRadialGradient(0,-1.95*M,1,0,-1.95*M,14*f); g.addColorStop(0,'#fff6b0'); g.addColorStop(.4,'#ffa21a'); g.addColorStop(1,'rgba(255,80,0,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(0,-1.97*M,8*f,14*f,0,0,TAU); ctx.fill();
      if(lit>.9){ const g2=ctx.createRadialGradient(0,-1.9*M,2,0,-1.9*M,90); g2.addColorStop(0,'rgba(255,170,70,.28)'); g2.addColorStop(1,'rgba(255,170,70,0)'); ctx.fillStyle=g2; ctx.fillRect(-90,-1.9*M-90,180,180); } ctx.globalAlpha=1; }
    else if(k==='bench'){ sh(.8*M); ctx.fillStyle='#6b4a2a'; for(const lx of [-.65,.55]) ctx.fillRect(lx*M,-.45*M,.08*M,.45*M); ctx.fillStyle='#9a6a3a'; ctx.fillRect(-.75*M,-.5*M,1.5*M,.1*M); ctx.fillStyle='#8a5e34'; ctx.fillRect(-.75*M,-.9*M,1.5*M,.09*M); ctx.fillRect(-.7*M,-.9*M,.06*M,.4*M); ctx.fillRect(.64*M,-.9*M,.06*M,.4*M); }
    else if(k==='bush'){ const s=1+((x0*7)%5)/10; sh(.55*M*s); const sw=G.st.settings.motion!==false?Math.sin(now*1.1+x0)*.04:0; for(let i=0;i<9;i++){ const a=-Math.PI/2+(i-4)*.32+sw; ctx.save(); ctx.rotate(a+Math.PI/2); ctx.fillStyle=i%2?'#2f7a32':'#3e9442'; ctx.beginPath(); ctx.ellipse(0,-.55*M*s,.11*M*s,.55*M*s,0,0,TAU); ctx.fill(); if(i%3===0){ ctx.fillStyle='#8a2a4a'; ctx.beginPath(); ctx.ellipse(0,-.5*M*s,.06*M*s,.38*M*s,0,0,TAU); ctx.fill(); } ctx.restore(); } }
    else if(k==='palm'){ sh(1.2*M); const sw=G.st.settings.motion!==false?Math.sin(now*.7+x0)*.05:0; ctx.strokeStyle='#7a5a3a'; ctx.lineWidth=.22*M; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(.4*M,-3*M,.2*M,-6*M); ctx.stroke();
      ctx.save(); ctx.translate(.2*M,-6*M); ctx.rotate(sw); for(let i=0;i<8;i++){ const a=i/8*TAU; ctx.save(); ctx.rotate(a); ctx.fillStyle=i%2?'#2e7a2a':'#3d9a38'; ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(1.2*M,-.5*M,2.2*M,.5*M); ctx.quadraticCurveTo(1.1*M,0,0,.15*M); ctx.fill(); ctx.restore(); } ctx.fillStyle='#5a4020'; ctx.beginPath(); ctx.arc(0,6,7,0,TAU); ctx.arc(9,4,6,0,TAU); ctx.fill(); ctx.restore(); }
    ctx.restore(); }
  // Kauai's famous wild chickens: wander, peck, scatter when people pass
  const hens=[]; function chickens(list,dt,now){ if(!G.st.land) return; if(!hens.length) for(let i=0;i<(G.st.settings.hq?4:2);i++) hens.push({x:600+i*230,y:1120+i*30,tx:0,ty:0,t:0,peck:0,f:1,c:i%2?'#c8501e':'#f2e6d0'});
    for(const h of hens){ h.t-=dt; if(h.t<=0){ h.tx=Math.max(250,Math.min(2200,h.x+(Math.random()-.5)*260)); h.ty=Math.max(1000,Math.min(1320,h.y+(Math.random()-.5)*90)); h.t=2+Math.random()*4; h.peck=Math.random()<.5?1.2:0; }
      for(const a of actors){ const d=Math.hypot(a.x-h.x,a.y-h.y); if(d<60){ h.tx=h.x+(h.x-a.x)*2; h.ty=h.y+(h.y-a.y); h.peck=0; } }
      if(h.peck>0) h.peck-=dt; else { const dx=h.tx-h.x, dy=h.ty-h.y, d=Math.hypot(dx,dy); if(d>2){ const v=Math.min(d,45*dt); h.x+=dx/d*v; h.y+=dy/d*v; if(Math.abs(dx)>1) h.f=dx>0?1:-1; } }
      list.push({y:h.y,draw:()=>{ const bob=h.peck>0?Math.abs(Math.sin(now*9))*5:0, step=h.peck>0?0:Math.sin(now*14+h.x)*1.5; ctx.save(); ctx.translate(h.x,h.y); ctx.fillStyle='rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(1,0,9,3,0,0,TAU); ctx.fill(); ctx.scale(h.f,1);
        ctx.strokeStyle='#d8a020'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-2,-6); ctx.lineTo(-2-step,0); ctx.moveTo(2,-6); ctx.lineTo(2+step,0); ctx.stroke();
        ctx.fillStyle=h.c; ctx.beginPath(); ctx.ellipse(0,-11,9,7,0,0,TAU); ctx.fill(); ctx.fillStyle='#1e3a2a'; ctx.beginPath(); ctx.moveTo(-7,-13); ctx.quadraticCurveTo(-15,-24,-12,-9); ctx.fill();
        ctx.fillStyle=h.c; ctx.beginPath(); ctx.arc(8,-17+bob,4.2,0,TAU); ctx.fill(); ctx.fillStyle='#e02a2a'; ctx.beginPath(); ctx.arc(8,-21.5+bob,2.2,0,TAU); ctx.fill(); ctx.fillStyle='#f0b020'; ctx.beginPath(); ctx.moveTo(12,-18+bob); ctx.lineTo(15.5,-16.5+bob); ctx.lineTo(12,-15.5+bob); ctx.fill(); ctx.fillStyle='#111'; ctx.fillRect(9,-18.5+bob,1.4,1.4); ctx.restore(); }}); } }
  function farmProps(list,now,dt){ for(const [x,y,k] of PROPS) list.push({y,draw:()=>prop(k,x,y,now)});
    const sl=G.lv('stand'); if(sl>=2&&ok('b_coldcase')) list.push({y:1262,draw:()=>{ const im=IM.b_coldcase, w=1.1*FARM_PPM, h=w*im.naturalHeight/im.naturalWidth; ctx.drawImage(im,712-w/2,1262-h,w,h); }}); if(sl>=3) list.push({y:1251,draw:()=>standSign()}); chickens(list,dt,now); if((G.marketDay&&G.marketDay())||G.season()==='makahiki') list.push({y:1330,draw:()=>bunting(now)}); if(G.season()==='makahiki'||(G.marketDay&&G.marketDay())) list.push({y:1318,draw:()=>festStall(1090,1318,now)}); }
  // stand upgrades: cold case (Lv2) and a painted sign over the awning (Lv3)

  function coldCase(x,y){ ctx.save(); ctx.translate(x,y); ctx.fillStyle='rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(2,1,.45*M,.12*M,0,0,TAU); ctx.fill(); ctx.fillStyle='#e8eef2'; ctx.fillRect(-.4*M,-.85*M,.8*M,.85*M); ctx.fillStyle='#9fd6f0'; ctx.fillRect(-.33*M,-.78*M,.66*M,.45*M);
    ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillRect(-.3*M,-.76*M,.12*M,.4*M); ctx.fillStyle='rgba(255,255,255,.18)'; ctx.fillRect(-.33*M,-.56*M,.66*M,.02*M); ctx.restore(); }
  function standSign(){ const b=BLD.stand; if(!ok(b.img)) return; const h=IM[b.img].naturalHeight*b.s, x=b.x, y=b.y-h-6; ctx.fillStyle='#5a3a1e'; ctx.fillRect(x-.9*M,y,4,10); ctx.fillRect(x+.9*M-4,y,4,10);
    ctx.fillStyle='#2f6a3a'; rr(x-1.2*M,y-.55*M,2.4*M,.55*M,6); ctx.fill(); ctx.strokeStyle='#ffd23a'; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle='#fff3d6'; ctx.font='900 '+(.24*M)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('MAUI WOWIE FARMS',x,y-.28*M); }
  // market day: flag bunting strung between the tiki torches and a pole over the plaza
  // Makahiki festival stall: thatched canopy, kapa-pattern banner, lei hanging off the front
  function festStall(x,y,now){ const w=2.6*M, h=2.3*M; ctx.fillStyle='rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x,y+2,w*.6,10,0,0,TAU); ctx.fill();
    ctx.fillStyle='#6b4a2a'; ctx.fillRect(x-w/2,y-h,5,h); ctx.fillRect(x+w/2-5,y-h,5,h);
    ctx.fillStyle='#8a5a32'; ctx.fillRect(x-w/2+4,y-.9*M,w-8,.9*M); ctx.fillStyle='#b5793f'; ctx.fillRect(x-w/2+4,y-.9*M,w-8,6);
    ctx.fillStyle='#c9a35a'; ctx.beginPath(); ctx.moveTo(x-w/2-14,y-h+4); ctx.lineTo(x,y-h-.8*M); ctx.lineTo(x+w/2+14,y-h+4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(120,84,40,.8)'; ctx.lineWidth=1.5; ctx.beginPath(); for(let i=-5;i<=5;i++){ ctx.moveTo(x+i*w/11,y-h+4); ctx.lineTo(x+i*w/22,y-h-.8*M+8); } ctx.stroke();
    ctx.fillStyle='#f3e4c2'; ctx.fillRect(x-w*.32,y-h+6,w*.64,16); ctx.fillStyle='#7a2a1a'; for(let i=0;i<8;i++){ const bx=x-w*.32+6+i*w*.64/8; ctx.beginPath(); ctx.moveTo(bx,y-h+8); ctx.lineTo(bx+5,y-h+14); ctx.lineTo(bx,y-h+20); ctx.lineTo(bx-5,y-h+14); ctx.fill(); }
    const cols=['#ff5d8f','#ffd23a','#ff9f2e','#fff']; for(let i=0;i<12;i++){ const t=i/11, lx=x-w/2+8+t*(w-16), ly=y-h+30+Math.sin(t*Math.PI)*14+Math.sin(now*2+i)*.8; ctx.fillStyle=cols[i%4]; ctx.beginPath(); ctx.arc(lx,ly,3.2,0,TAU); ctx.fill(); }
  }
  function bunting(now){ const P=[[600,1255-1.8*M],[905,1335-2.6*M],[1200,1235-1.8*M]]; ctx.fillStyle='#6b4a2a'; ctx.fillRect(903,1335-2.6*M,5,2.6*M);
    const C=['#ff5a5a','#ffd23a','#3ab0ff','#7ee08a','#ff8ad8','#ffffff']; let n=0;
    for(let s2=0;s2<2;s2++){ const [x0,y0]=P[s2],[x1,y1]=P[s2+1]; ctx.strokeStyle='rgba(60,40,20,.8)'; ctx.lineWidth=1.5; ctx.beginPath(); for(let i=0;i<=20;i++){ const k=i/20, x=x0+(x1-x0)*k, y=y0+(y1-y0)*k+Math.sin(k*Math.PI)*28; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
      for(let i=1;i<12;i++){ const k=i/12, x=x0+(x1-x0)*k, y=y0+(y1-y0)*k+Math.sin(k*Math.PI)*28, sw=mo()?Math.sin(now*3+i+s2)*3:0; ctx.fillStyle=C[n++%C.length]; ctx.beginPath(); ctx.moveTo(x-7,y); ctx.lineTo(x+7,y); ctx.lineTo(x+sw,y+16); ctx.fill(); } } }
  // drifting cloud shadows (world space, over everything on the farm)
  function cloudShadows(now){ if(!G.st.settings.hq) return; const w=G.st.weather.type, a=w==='sunny'?.13:w==='partly'?.2:.08; if(w==='storm'||w==='vog') return; ctx.save();
    for(let i=0;i<4;i++){ const sp=14+i*4, span=3600, cx=((now*sp+i*1050)%span)-600, cy=650+i*190+Math.sin(now*.05+i)*30, rx=260+i*60, ry=110+i*20;
      ctx.globalAlpha=a/.2; ctx.drawImage(cloudS(),cx-rx,cy-ry,rx*2,ry*2); } ctx.restore(); }
  let cloudC=null; function cloudS(){ if(cloudC) return cloudC; const c=document.createElement('canvas'); c.width=128; c.height=128; const x=c.getContext('2d'), g=x.createRadialGradient(64,64,0,64,64,64); g.addColorStop(0,'rgba(20,40,30,.2)'); g.addColorStop(.6,'rgba(20,40,30,.14)'); g.addColorStop(1,'rgba(20,40,30,0)'); x.fillStyle=g; x.fillRect(0,0,128,128); return cloudC=c; }
  // harvest: buds plucked off the plant fly to the Dry & Cure button
  const flyers=[];
  function pluck(target,n,golden){ const w=worldOf(target); const el=document.querySelector('#menu [data-panel="process"]'); if(!w||!el) return; const r=el.getBoundingClientRect(), s=toS(w.x,w.y-(slotOf.get(target.id)||{ppm:40}).ppm*.4);
    if(flyers.length>30) return; const k=Math.min(6,Math.max(2,n|0)); for(let i=0;i<k;i++) flyers.push({x:s.x+(Math.random()-.5)*26,y:s.y+(Math.random()-.5)*20,tx:r.left+r.width/2,ty:r.top+r.height*.35,t:-.18-i*.09,rot:Math.random()*6,gold:golden&&i===0,el,last:i===k-1}); }
  // pest-scouting magnifier: a 2.2x lens over the live frame; hidden eggs/spores show as specks with a ring
  const lens={on:false,x:0,y:0}; let lensC=null, lastOvl=[];
  function setLens(on,x,y){ lens.on=on; if(x!=null){ lens.x=x; lens.y=y; } }
  function drawLens(){ if(!lens.on) return; const Z=2.2, r=Math.min(78,W*.2)*(G.lv('loupe')?1.3:1), D=dpr; if(!lensC){ lensC=document.createElement('canvas'); }
    const sw=Math.ceil(2*r/Z*D); if(lensC.width!==sw){ lensC.width=sw; lensC.height=sw; } const lc=lensC.getContext('2d');
    lc.clearRect(0,0,sw,sw); lc.drawImage(cv,(lens.x-r/Z)*D,(lens.y-r/Z)*D,sw,sw,0,0,sw,sw);
    ctx.save(); ctx.setTransform(D,0,0,D,0,0); ctx.beginPath(); ctx.arc(lens.x,lens.y,r,0,TAU); ctx.save(); ctx.clip(); ctx.imageSmoothingEnabled=true; ctx.drawImage(lensC,lens.x-r,lens.y-r,2*r,2*r);
    if(lens.crisp!==false){ // Inspect: re-render plants under the lens at the lens zoom with full-res art (hiSprite picks the cache from cam.z*dpr), so they stay crisp instead of a stretched frame
      const z0=cam.z, x0=cam.x, y0=cam.y, wx=lens.x/z0+x0, wy=lens.y/z0+y0, z1=z0*Z; const now=performance.now()/1000, hq0=G.st.settings.hq; G.st.settings.hq=true;
      cam.z=z1; cam.x=wx-lens.x/z1; cam.y=wy-lens.y/z1; ctx.imageSmoothingQuality='high';
      ctx.setTransform(D*z1,0,0,D*z1,-cam.x*z1*D,-cam.y*z1*D);
      const vis=lastOvl.filter(o=>o.p&&o.p.strain&&o.sl).sort((a,b)=>a.sl.y-b.sl.y);
      for(const o of vis){ const sl=o.sl, yoff=potLift(sl), q=toS(sl.x,sl.y-yoff); if(Math.abs(q.x-lens.x)>r*1.6||q.y<lens.y-r*.4||q.y>lens.y+r*2.6) continue;
        ctx.save(); ctx.translate(0,-yoff); try{ drawPlantAt(o.p,null,sl,now); }catch(e){} ctx.restore(); }
      cam.z=z0; cam.x=x0; cam.y=y0; G.st.settings.hq=hq0; ctx.setTransform(D,0,0,D,0,0); }
    for(const o of lastOvl){ const p=o.p, sl=o.sl; if(!p||!(p.eggs>0)||!p.strain) continue; const h=o.h||20;
      const q=toS(sl.x,sl.y-h*.45), mx=lens.x+(q.x-lens.x)*Z, my=lens.y+(q.y-lens.y)*Z; if(Math.hypot(mx-lens.x,my-lens.y)>r+20) continue; const sd=hash(p.id);
      ctx.fillStyle=p.eggK==='mold'?'rgba(235,235,235,.95)':'rgba(255,250,210,.95)'; for(let i=0;i<9;i++){ const a=(sd*13+i*2.4)%TAU, d=4+((sd>>i)&7)*1.6; ctx.beginPath(); ctx.arc(mx+Math.cos(a)*d,my+Math.sin(a)*d*.8,1.6,0,TAU); ctx.fill(); }
      ctx.strokeStyle='#ff9f2e'; ctx.lineWidth=2; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.arc(mx,my,18,0,TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.font='800 11px system-ui,sans-serif'; ctx.textAlign='center'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.7)'; const t=p.eggK==='mold'?'Mold spores':'Pest eggs'; ctx.strokeText(t,mx,my-22); ctx.fillStyle='#ffd27a'; ctx.fillText(t,mx,my-22); }
    ctx.restore(); ctx.beginPath(); ctx.arc(lens.x,lens.y,r,0,TAU); ctx.shadowColor='rgba(0,0,0,.6)'; ctx.shadowBlur=10; ctx.strokeStyle='#2a1c0e'; ctx.lineWidth=9; ctx.stroke(); ctx.shadowBlur=0; ctx.strokeStyle='#f0c45a'; ctx.lineWidth=4; ctx.stroke(); ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(lens.x,lens.y,r-4,3.6,5.2); ctx.stroke();
    if(G.lv('loupe')){ const t=performance.now()/1000; for(const o of lastOvl){ if(!(o.p&&o.p.eggs>0)) continue; const q=toS(o.sl.x,o.sl.y-(o.h||20)*.5); if(Math.hypot(q.x-lens.x,q.y-lens.y)<r) continue; ctx.globalAlpha=.6+.4*Math.sin(t*5); ctx.fillStyle='#ff9f2e'; ctx.beginPath(); ctx.arc(q.x,q.y,5,0,TAU); ctx.fill(); ctx.globalAlpha=1; } }
    ctx.strokeStyle='#3a2a18'; ctx.lineWidth=9; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(lens.x+r*.72,lens.y+r*.72); ctx.lineTo(lens.x+r*1.05,lens.y+r*1.05); ctx.stroke(); ctx.lineCap='butt'; ctx.restore(); }
  // painted-wood sign on the garage wall. x is the center, y is the top.
  function signBoard(x,y,t,bg,fg){ ctx.save(); ctx.font='900 18px system-ui,sans-serif'; const w=ctx.measureText(t).width+28; ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(x-w/2+3,y+3,w,30); ctx.fillStyle=bg; ctx.fillRect(x-w/2,y,w,30); ctx.strokeStyle=fg; ctx.lineWidth=2; ctx.strokeRect(x-w/2+3,y+3,w-6,24); ctx.fillStyle=fg; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(t,x,y+16); ctx.restore(); }
  // Keep the whole board on screen and off the HUD. Prefer the wall anchor; slide to the nearest clear spot.
  function fitSign(text,ax,ay){ ctx.save(); ctx.font='900 18px system-ui,sans-serif'; const w=ctx.measureText(text).width+28, h=30, m=12; ctx.restore();
    const obs=hudObstacles();
    // The left seed / scout / upgrades stack is one column. Keep the sign out of that lane, including the space directly under the lowest button.
    const sides=['seedBag','scoutBtn','upgBtn'].map(uiBox).filter(Boolean);
    if(sides.length){ const rgt=Math.max(...sides.map(r=>r.right))+14; obs.push({l:-40,t:-40,r:rgt,b:H+40}); }
    const clamp=(x,y)=>({x:Math.max(m+w/2,Math.min(W-m-w/2,x)), y:Math.max(m,Math.min(H-h-m,y))});
    const clear=(x,y)=>{ const rect={l:x-w/2,t:y,r:x+w/2,b:y+h}; return !rectHits(rect,obs); };
    const a0=clamp(ax,ay); if(clear(a0.x,a0.y)) return a0;
    let best=null;
    for(const dy of [0,40,-40,80,-80,120,160,200,-120]) for(const dx of [0,60,-60,120,-120,180,240,300,380,460,560,-180,-240]){
      const p=clamp(ax+dx,ay+dy); if(!clear(p.x,p.y)) continue; const d=(p.x-ax)*(p.x-ax)+(p.y-ay)*(p.y-ay); if(!best||d<best.d) best={x:p.x,y:p.y,d}; }
    if(best) return best;
    const sideR=sides.length?Math.max(...sides.map(r=>r.right))+10:m;
    return clamp(Math.max(sideR+w/2,ax), ay); }
  // pheno room makeover: pink full-spectrum glow, pheno tags on each pot, a breeding bench with labelled clone domes
  const cutCache=new Map();
  // pheno room glow: smooth radial gradient baked once at low res and scaled up (a full-room gradient fill each frame was a big fill-rate cost)
  let phGlow=null; function phenoGlowC(){ if(phGlow) return phGlow; const c=document.createElement('canvas'); c.width=260; c.height=180; const x=c.getContext('2d'), k=260/1300; x.scale(k,k); x.translate(100,50); const gr=x.createRadialGradient(560,400,30,560,400,560); gr.addColorStop(0,'rgba(255,70,220,1)'); gr.addColorStop(.55,'rgba(200,60,255,.45)'); gr.addColorStop(1,'rgba(255,79,216,0)'); x.fillStyle=gr; x.fillRect(-100,-50,1300,900); return phGlow=c; }
  function phenoDecor(role,now,part){ if(role==='pheno'&&part!=='bench'){ ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=.15+.03*Math.sin(now*1.5); ctx.drawImage(phenoGlowC(),-100,-50,1300,900);
      // magenta LED strips along the ceiling beam, each with a light cone
      for(let k=0;k<4;k++){ const lx=210+k*190, ly=56; ctx.globalAlpha=.95; ctx.fillStyle='#ff7be6'; ctx.fillRect(lx-60,ly,120,5); ctx.globalAlpha=.07; const cg=ctx.createLinearGradient(0,ly,0,ly+260); cg.addColorStop(0,'#ff6ae0'); cg.addColorStop(1,'rgba(255,106,224,0)'); ctx.fillStyle=cg; ctx.beginPath(); ctx.moveTo(lx-60,ly); ctx.lineTo(lx+60,ly); ctx.lineTo(lx+120,ly+260); ctx.lineTo(lx-120,ly+260); ctx.closePath(); ctx.fill(); }
      ctx.restore(); }
    if(role==='pheno'&&part==='bench'){ const b=GP(1.25,.32), m=gppm(b.y), w=1.25*m, by=b.y-.85*m; ctx.fillStyle='#5b4632'; ctx.fillRect(b.x-w/2,by,w,10); ctx.fillStyle='#3e2e1f'; ctx.fillRect(b.x-w/2+6,by+10,7,.85*m-10); ctx.fillRect(b.x+w/2-13,by+10,7,.85*m-10);
      const ids=Object.keys(G.st.keepers||{}), cid=(G.st.cuts&&G.st.cuts[0]&&G.st.cuts[0].id)||ids[0]||G.st.selSeed||'northern-lights';
      for(let i=0;i<3;i++){ const dx=b.x-w/2+w*(i+.5)/3, dw=w/3-14; ctx.fillStyle='#2a2a2a'; ctx.fillRect(dx-dw/2,by-8,dw,8); for(let k=0;k<5;k++){ const px=dx-dw/2+dw*(k+.5)/5; ctx.fillStyle='#7a5532'; ctx.fillRect(px-3,by-12,6,5); { const ck=cid+'|'+Math.round(m)+'|'+(k%3); let cc=cutCache.get(ck); if(!cc){ cc=document.createElement('canvas'); cc.width=Math.ceil(m*.8); cc.height=Math.ceil(m*.8); plantCard(cc.getContext('2d'),{id:cid,prog:.05,x:cc.width/2,y:cc.height-2,h:.9*m*6,seed:k%3,now:0}); if(cutCache.size>30) cutCache.clear(); cutCache.set(ck,cc); } ctx.drawImage(cc,px-cc.width/2,by-11-cc.height+2); } }
        ctx.fillStyle='rgba(220,245,255,.22)'; ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(dx-dw/2,by-8); ctx.quadraticCurveTo(dx-dw/2,by-8-.32*m,dx,by-8-.34*m); ctx.quadraticCurveTo(dx+dw/2,by-8-.32*m,dx+dw/2,by-8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#fff'; ctx.font='800 9px system-ui'; ctx.textAlign='center'; ctx.fillText('Dome '+(i+1),dx,by+20); } }
    if(role==='pheno'&&part!=='bench') for(const o of lastOvl){ if(!o.p||!o.p.strain) continue; const i=(hash(o.p.id)%40)+1; ctx.fillStyle='#fff5c2'; ctx.fillRect(o.sl.x+6,o.sl.y-12,24,13); ctx.fillStyle='#4a2a5a'; ctx.font='800 10px system-ui'; ctx.textAlign='center'; ctx.fillText('#'+i,o.sl.x+18,o.sl.y-2); }
    if(role==='storage'){ for(let i=0;i<3;i++){ const p=GP(6.7+i*.55,.7); ctx.fillStyle='#a07a4a'; ctx.fillRect(p.x-14,p.y-22-i%2*4,28,22); ctx.strokeStyle='#5a3a1a'; ctx.strokeRect(p.x-14,p.y-22-i%2*4,28,22); } } }
  // draw a real strain plant (same sprites, growth crossfade, health + training visuals as the farm) into any 2D context:
  // used by the Breed sheet room scene, pheno compare cards, mothers and clone domes. h = px height of a mature plant.
  function plantCard(cx2,o){ if(!o||!o.id||!G.strain(o.id)) return 0; const keep=ctx, s=G.strain(o.id), sl={x:o.x,y:o.y,cls:'in',sp:.9,ppm:1};
    const full=plantSize(s.type,1,sl).h; sl.ppm=o.h/Math.max(.1,full);
    const p={id:o.seed!=null?'pc'+o.seed:'pc'+o.id,strain:o.id,prog:o.prog==null?1:o.prog,zone:o.zone||'garage',water:o.water==null?1:o.water,food:o.food==null?1:o.food,pest:o.pest||null,trellis:!!o.trellis,pruned:!!o.pruned,train:o.train||null,q:1,_dv:1};
    ctx=cx2; cx2.save(); cx2.imageSmoothingEnabled=true; cx2.imageSmoothingQuality='high'; let r=0; try{ r=drawPlantAt(p,null,sl,o.now==null?performance.now()/1000:o.now); }catch(e){} cx2.restore(); ctx=keep; return r; }
  function drawFlyers(dt){ for(const f of flyers){ f.t+=dt; if(f.t<0){ // pop up off the plant first
        const k=1+f.t/.18; ctx.globalAlpha=Math.max(0,Math.min(1,k+1)); budIcon(f.x,f.y-Math.max(0,(k+.2))*14,f.rot,f.gold); continue; }
      const k=Math.min(1,f.t/.65), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2, x=f.x+(f.tx-f.x)*e, y=f.y-14+(f.ty-f.y+14)*e-Math.sin(k*Math.PI)*90, sc=1-.45*k; ctx.globalAlpha=1;
      ctx.save(); ctx.translate(x,y); ctx.scale(sc,sc); budIcon(0,0,f.rot+f.t*8,f.gold); ctx.restore();
      if(k>=1&&!f.done){ f.done=1; if(f.last&&f.el){ f.el.classList.remove('bump'); void f.el.offsetWidth; f.el.classList.add('bump'); } } }
    ctx.globalAlpha=1; for(let i=flyers.length-1;i>=0;i--) if(flyers[i].done) flyers.splice(i,1); }
  function budIcon(x,y,rot,gold){ ctx.save(); ctx.translate(x,y); ctx.rotate(rot*.3); ctx.fillStyle=gold?'#ffd23a':'#6fbf3a'; ctx.strokeStyle=gold?'#a87a10':'#2f6a1e'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.ellipse(0,0,7,10,0,0,TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle=gold?'#fff3b0':'#c8f08a'; ctx.beginPath(); ctx.arc(-2,-3,2,0,TAU); ctx.fill(); ctx.fillStyle='#e8853a'; ctx.fillRect(1,-5,1.5,4); ctx.fillRect(-3,2,1.5,3); ctx.restore(); }

  // ================= FARM STAND SELLING: speech bubbles, patience ring, tap to serve, handoff + coins, reactions =================
  const prefShort=P=>P.k==='type'||P.k==='flavor'?(P.k==='flavor'?P.v.toLowerCase()+' flavors':P.v):P.k==='island'?'Hawaiian-grown':P.k==='thc'?'something strong (25%+ THC)':P.k==='cbd'?'CBD-rich':'something good';
  const bubR=[];
  function bubble(x,y,text,col){ ctx.font='700 11px system-ui,sans-serif'; const words=text.split(' '), lines=[]; let ln=''; for(const w of words){ const t=ln?ln+' '+w:w; if(ctx.measureText(t).width>150&&ln){ lines.push(ln); ln=w; } else ln=t; } lines.push(ln);
    const w=Math.max(...lines.map(l=>ctx.measureText(l).width))+14, h=lines.length*14+8, bx=Math.max(4,Math.min(W-w-4,x-w/2)); let by=y-h-8;
    for(let k=0;k<4;k++){ const hit=bubR.find(r=>bx<r.x+r.w+4&&bx+w>r.x-4&&by<r.y+r.h+4&&by+h>r.y-4); if(!hit) break; by=hit.y-h-6; } bubR.push({x:bx,y:by,w,h});
    ctx.fillStyle=col||'rgba(255,253,245,.96)'; rr(bx,by,w,h,8); ctx.fill(); ctx.beginPath(); ctx.moveTo(x-5,by+h-.5); ctx.lineTo(x+5,by+h-.5); ctx.lineTo(x,by+h+7); ctx.fill();
    ctx.fillStyle='#2a2a22'; ctx.textAlign='left'; ctx.textBaseline='top'; lines.forEach((l,i)=>ctx.fillText(l,bx+7,by+5+i*14)); return {x:bx,y:by,w,h}; }
  function moodIcon(x,y,m){ ctx.save(); ctx.translate(x,y); if(m==='happy'){ ctx.fillStyle='#ff5a8a'; ctx.beginPath(); ctx.moveTo(0,5); ctx.bezierCurveTo(-11,-3,-6,-12,0,-5); ctx.bezierCurveTo(6,-12,11,-3,0,5); ctx.fill(); }
    else { ctx.fillStyle=m==='grumpy'?'#ff8a5a':'#ffd23a'; ctx.beginPath(); ctx.arc(0,0,8,0,TAU); ctx.fill(); ctx.fillStyle='#3a2a10'; ctx.fillRect(-4,-3,2,2.5); ctx.fillRect(2,-3,2,2.5); ctx.strokeStyle='#3a2a10'; ctx.lineWidth=1.5; ctx.beginPath(); if(m==='grumpy') ctx.arc(0,5.5,3.5,Math.PI*1.15,Math.PI*1.85); else if(m==='none') { ctx.moveTo(-3,3); ctx.lineTo(3,3); } else ctx.arc(0,1,3.5,.2,Math.PI-.2); ctx.stroke(); } ctx.restore(); }
  function custBubbles(){ bubR.length=0; if(loc!=='farm') return; for(const a of actors){ if(a.role!=='cust'||a.alpha<.5) continue; const h=1.7*ppmAt(a.y), p=toS(a.x,a.y-h); if(p.x<-40||p.x>W+40||p.y<0||p.y>H) continue;
      if(a.react&&a.react.t<2.6){ ctx.globalAlpha=Math.min(1,(2.6-a.react.t)*2); const b=bubble(p.x,p.y-4,a.react.text,a.react.mood==='grumpy'?'rgba(255,226,214,.96)':undefined); moodIcon(b.x+b.w,b.y+2,a.react.mood); ctx.globalAlpha=1; continue; }
      if(!a.at||a.leaving||!a.c) continue; const c=(G.st.cust||[]).find(x=>x.id===a.cid); if(!c) continue;
      if(a.say&&a.say.t<a.say.life&&cam.z>=.45){ ctx.globalAlpha=Math.min(1,(a.say.life-a.say.t)*2,a.say.t*4); bubble(p.x,p.y-4,a.say.text); ctx.globalAlpha=1; }
      else { const k=Math.min(1,c.T/c.t), cx=p.x, cy=p.y-16, can=G.custMatch(c).length>0; ctx.fillStyle='rgba(16,30,22,.85)'; ctx.beginPath(); ctx.arc(cx,cy,12,0,TAU); ctx.fill();
        ctx.strokeStyle=k<.6?'#7ee08a':k<.85?'#ffd23a':'#ff6a4a'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(cx,cy,12,-Math.PI/2,-Math.PI/2+TAU*(1-k)); ctx.stroke();
        if(c.reg){ ctx.fillStyle='#ff8ad8'; ctx.font='900 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('★'.repeat(c.reg),cx,cy-20); }
        ctx.fillStyle=can?'#ffe27a':'#9aa'; ctx.font='900 11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(can?'$':'?',cx,cy+.5);
        if(can&&mo()){ ctx.globalAlpha=.5+.5*Math.sin(t*5); ctx.strokeStyle='#ffe27a'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(cx,cy,16,0,TAU); ctx.stroke(); ctx.globalAlpha=1; } } } }
  function custHit(wx,wy){ if(loc!=='farm') return null; for(const a of actors){ if(a.role!=='cust'||!a.at||a.leaving||a.hold>0) continue; const pp=ppmAt(a.y); if(Math.abs(wx-a.x)<Math.max(.35*pp,22/cam.z)&&wy<a.y+10&&wy>a.y-1.7*pp-40/cam.z) return a; } return null; }
  function custReact(id,kind,o){ const a=actors.find(x=>x.cid===id&&x.role==='cust'); o=o||{}; const who=a&&a.c?a.c.who:'';
    const mood=kind==='served'?o.mood:kind; const L=window.CUST_LINES; const text=L?L.pick(kind==='served'?o.mood:kind==='grumpy'?'grumpy':'none',who):'';
    if(!a){ return; } a.react={mood,text,t:0}; a.say=null; if(kind!=='none') a.hold=2.6; else return;
    if(kind==='served'){ const b=BLD.stand, from=toS(b.x+10,b.y-.95*FARM_PPM), to=toS(a.x,a.y-.95*ppmAt(a.y)); for(let i=0;i<3;i++) flyers.push({x:from.x+(Math.random()-.5)*14,y:from.y,tx:to.x,ty:to.y,t:-i*.08,rot:Math.random()*6});
      setTimeout(()=>{ if(!actors.includes(a)) return; coinsTo({x:a.x,y:a.y-ppmAt(a.y)},'cashPill',o.tip?8:5); floater({x:a.x,y:a.y+.15*ppmAt(a.y)},'+'+G.fmt(o.v)+(o.tip?' +'+G.fmt(o.tip)+' tip':''),'#ffe27a',22); },650); } }
  // ---------------- picking ----------------
  function pick(sx,sy){
    if(bedLay){
      if(geckoS&&Math.hypot(sx-geckoS.x,sy-geckoS.y)<geckoS.r+4) return {type:'gecko'};
      let bq=null, bd=22; for(const b of qbub){ const d=Math.hypot(sx-b.x,sy-b.y); if(d<bd){ bd=d; bq=b; } } if(bq) return bq.act;
      if(bedLay.build&&sx>=bedLay.build.x&&sx<=bedLay.build.x+bedLay.build.w&&sy>=bedLay.build.y&&sy<=bedLay.build.y+bedLay.build.h) return bedLay.build.act;
      for(let i=bedLay.cells.length-1;i>=0;i--){ const c=bedLay.cells[i]; if(sx<c.x||sx>c.x+c.w||sy<c.y||sy>c.y+c.h) continue;
        if(c.expand) return {type:'expand',kind:c.expand};
        if(c.owned&&c.p){ sel=c.p; return {type:'plot',p:c.p}; }
        return null; }
      return null;
    }
    if(geckoS&&Math.hypot(sx-geckoS.x,sy-geckoS.y)<geckoS.r) return {type:'gecko'};
    if(mentorS&&Math.hypot(sx-mentorS.x,sy-mentorS.y)<mentorS.r+4) return {type:'mentor'};
    { let bq=null, bd=22; for(const b of qbub){ const d=Math.hypot(sx-b.x,sy-b.y); if(d<bd){ bd=d; bq=b; } } if(bq) return bq.act; }
    for(const r of tags) if(sx>=r.x-6&&sx<=r.x+r.w+6&&sy>=r.y-6&&sy<=r.y+r.h+6) return r.act;
    const wx=sx/cam.z+cam.x, wy=sy/cam.z+cam.y; let best=null, by=-1e9;
    { const ca=custHit(wx,wy); if(ca) return {type:'serve',id:ca.cid}; }
    for(const p of G.st.plots){ if(p.loc!==loc||!p.owned) continue; const sl=slotOf.get(p.id); if(!sl) continue; const hh=p.strain?Math.max(.45,plantSize(G.strain(p.strain).type,p.prog,sl).h)*sl.ppm:.5*sl.ppm; const hw=Math.max(Math.min(.35,sl.sp*.45)*sl.ppm,(sl.cls==='out'||sl.cls==='gh'?12:22)/cam.z);
      if(wx>sl.x-hw&&wx<sl.x+hw&&wy>sl.y-hh-14/cam.z&&wy<sl.y+Math.max(.25*sl.ppm,16/cam.z)&&sl.y>by){ best=p; by=sl.y; } }
    if(best){ sel=best; return {type:'plot',p:best}; }
    if(loc==='farm') for(const k in BLD){ const b=BLD[k]; if(b.need&&!b.need()) continue; const im=IM[b.img]; if(!ok(b.img)) continue; const w=im.naturalWidth*b.s, h=im.naturalHeight*b.s; if(wx>b.x-w/2&&wx<b.x+w/2&&wy>b.y-h&&wy<b.y) return {type:'bld',id:k,panel:b.panel}; }
    if(loc==='farm'&&st().land&&!st().ghBuilt&&wx>GH.x&&wx<GH.x+GHW*GH.s&&wy>GH.y&&wy<GH.y+GHH*GH.s) return {type:'ghbuild'};
    sel=null; return null;
  }
  const st=()=>G.st;
  function screenOf(p){ const sl=slotOf.get(p.id); if(!sl||p.loc!==loc) return null; return toS(sl.x,sl.y); }
  // Screen box of an owned pot, including the plant, the bucket, and the pointing finger under it.
  function plotRect(p){
    if(bedLay&&p){ const c=bedLay.cells.find(q=>q.p&&q.p.id===p.id&&q.owned); if(c){ const cv=document.getElementById('game'), cr=cv?cv.getBoundingClientRect():{left:0,top:0}; return {left:c.x+cr.left,top:c.y+cr.top,right:c.x+c.w+cr.left,bottom:c.y+c.h+cr.top}; } if(p.zone!=={garage:'garage',gh:'gh',facility:'field',benches:'in'}[bedLay.room]) return null; }
    if(!p||p.loc!==loc||!p.owned) return null;
    const sl=slotOf.get(p.id); if(!sl) return null;
    const ppm=sl.ppm||40, z=cam.z||1, lift=potLift(sl);
    let hh=.55*ppm;
    if(p.strain){ try{ const s=G.strain(p.strain); if(s) hh=Math.max(.45,plantSize(s.type,p.prog,sl).h)*ppm; }catch(e){} }
    const hw=Math.max(Math.min(.45,(sl.sp||.6)*.55)*ppm, 32/z);
    const top=sl.y-lift-hh-24/z, bot=sl.y+Math.max(.28*ppm, 22/z)+42/z;
    const a=toS(sl.x-hw, top), b=toS(sl.x+hw, bot);
    const cv=document.getElementById('game'), cr=cv?cv.getBoundingClientRect():{left:0,top:0};
    return {left:Math.min(a.x,b.x)+cr.left, top:Math.min(a.y,b.y)+cr.top, right:Math.max(a.x,b.x)+cr.left, bottom:Math.max(a.y,b.y)+cr.top};
  }

  // ---------------- strain close-up (strain book) ----------------
  const cups={};
  function closeup(s,size,hidden){ size=size||220; const key=s.id+size+(hidden?'h':''); if(cups[key]) return cups[key];
    const c=document.createElement('canvas'); c.width=size; c.height=size; const x=c.getContext('2d');
    const L=look(s); const g=x.createRadialGradient(size/2,size*.45,6,size/2,size/2,size*.75); g.addColorStop(0,hidden?'#2a2a34':'#26402a'); g.addColorStop(1,hidden?'#101016':'#0c1a10'); x.fillStyle=g; x.fillRect(0,0,size,size);
    const sg=imgOK&&sigOf(s,true), m=sg||(imgOK?tinted('mature_'+(L.base||'green'),s,true):null);
    if(SIG[s.id]&&!sg) return window.Art?Art.thumb(s,size,hidden):'';   // not loaded yet: don't cache a generic look
    if(m){ const sw=sg?m.w:m.w*.62, sh=sg?m.h*.62:m.h*.55, sx=(m.w-sw)/2, sy=sg?0:m.h*.05; const k=size/Math.max(sw,sh)*1.05;
      if(hidden){ const t=document.createElement('canvas'); t.width=size; t.height=size; const y=t.getContext('2d'); y.drawImage(m.c,sx,sy,sw,sh,(size-sw*k)/2,(size-sh*k)/2,sw*k,sh*k); y.globalCompositeOperation='source-in'; y.fillStyle='#05050a'; y.fillRect(0,0,size,size); x.drawImage(t,0,0); x.fillStyle='rgba(255,255,255,.85)'; x.font='800 '+Math.round(size*.22)+'px system-ui'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('???',size/2,size/2); }
      else { x.drawImage(m.c,sx,sy,sw,sh,(size-sw*k)/2,(size-sh*k)/2,sw*k,sh*k); if(sg){ cups[key]=c.toDataURL('image/png'); return cups[key]; } let sd=hash(s.id); const r=()=>((sd=(sd*16807)%2147483647)/2147483647); x.fillStyle='rgba(255,255,255,.7)'; for(let i=0;i<(L.frost||.5)*120;i++){ x.globalAlpha=.3+r()*.6; x.beginPath(); x.arc(size*.2+r()*size*.6,size*.15+r()*size*.6,.6+r()*1.2,0,TAU); x.fill(); } x.globalAlpha=1; } }
    else if(window.Art){ const im=new Image(); return Art.thumb(s,size,hidden); }
    const url=c.toDataURL('image/png'); cups[key]=url; return url; }

  let mainCtx=null;
  function init(c){ cv=c; ctx=mainCtx=cv.getContext('2d'); resize(); loadImages(); loc=(G.st&&G.st.loc)||'garage'; rebuild(); fit(); }
  return {unlockPan,skipPan,bedLayout:()=>bedLay&&{room:bedLay.room,n:bedLay.cells.length,cell:bedLay.cells[0]?{x:bedLay.cells[0].x,y:bedLay.cells[0].y,w:bedLay.cells[0].w,h:bedLay.cells[0].h}:null,last:bedLay.cells.length?{x:bedLay.cells[bedLay.cells.length-1].x,y:bedLay.cells[bedLay.cells.length-1].y,w:bedLay.cells[bedLay.cells.length-1].w,h:bedLay.cells[bedLay.cells.length-1].h}:null,build:!!bedLay.build},get panning(){return !!upan;},_toS:(x,y)=>toS(x,y),_qb:()=>qbub.map(b=>({x:b.x,y:b.y,a:b.act.a,id:b.act.p.id})),_ovl:()=>lastOvl.filter(o=>o.p&&o.p.strain).map(o=>({id:o.p.id,...toS(o.sl.x,o.sl.y-(o.h||20)*.5)})),select:p=>{ sel=p; },plantCard,cosPreview,cosPlace,setLens,lens,init,pluck,leafFall,shake:p=>{ p._shake=.45; },custReact,custSay:()=>actors.forEach(a=>{ if(a.say) a.say.t=.3; }),setDprCap,spawnPerson:(img,x,y,face)=>spawn({role:'test',img,x,y,face:face||1,f:face||1,fade:1}),resize,fit,pan,zoomAt,frame,pick,setLoc,rebuild,burst,floater,coinsTo,sendWorker,closeup,screenOf,plotRect,get loc(){return loc;},get cam(){return cam;},SC,slotOf:()=>slotOf,tinted,imagesLoaded:()=>loaded,get mentorS(){return mentorS;},get geckoS(){return geckoS;}};
})();
