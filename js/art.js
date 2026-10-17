/* Procedural art: plants (fan leaves, colas, pistils, trichomes), tropical foliage, thumbnails. */
window.Art = (function(){
  const TAU=Math.PI*2;
  function rng(seed){ let s=seed>>>0||1; return ()=>((s=Math.imul(s^s>>>15,1|s),s^=s+Math.imul(s^s>>>7,61|s),((s^s>>>14)>>>0)/4294967296)); }
  function hash(str){ let h=2166136261; for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; }
  function hex(c){ if(c.startsWith('rgb')) return c.match(/\d+/g).slice(0,3).map(Number); c=c.replace('#',''); return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)]; }
  function mix(a,b,t){ const A=hex(a),B=hex(b); return 'rgb('+A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')+')'; }
  function shade(a,amt){ return amt>0?mix(a,'#ffffff',amt):mix(a,'#000000',-amt); }

  // Smooth lanceolate leaflet along +x. Serrations are rounded curves, widest near the middle.
  function blade(ctx,L,W){
    const n=8;
    const bell=t=>{ const u=Math.max(0,Math.min(1,t)); return Math.sin(Math.PI*Math.pow(u,.7))*W*(u>.94?(1-u)/.06:1); };
    ctx.beginPath(); ctx.moveTo(0,0);
    for(let i=0;i<n;i++){
      const t0=i/n, tTip=(i+.62)/n, t1=(i+1)/n;
      const y0=bell(t0)*(i===0?.12:.3), yTip=bell(tTip)*(0.96+((i*3)%5)*.015), y1=i===n-1?0:bell(t1)*.3;
      const x0=t0*L, xTip=tTip*L, x1=t1*L;
      ctx.quadraticCurveTo(x0+(xTip-x0)*.82,-(yTip*.72), xTip,-yTip);
      ctx.quadraticCurveTo(xTip+(x1-xTip)*.22,-(y1*.35), x1,-y1);
    }
    for(let i=n-1;i>=0;i--){
      const t0=i/n, tTip=(i+.62)/n, t1=(i+1)/n;
      const y0=bell(t0)*(i===0?.12:.3), yTip=bell(tTip)*(0.96+((i*3)%5)*.015), y1=i===n-1?0:bell(t1)*.3;
      const x0=t0*L, xTip=tTip*L, x1=t1*L;
      ctx.quadraticCurveTo(x1-(x1-xTip)*.22,y1*.35, xTip,yTip);
      ctx.quadraticCurveTo(xTip-(xTip-x0)*.82,yTip*.72, x0,y0);
    }
    ctx.closePath();
  }
  function paintBlade(ctx,len,wr,col,dark){
    ctx.save();
    ctx.translate(1.4,2.4); ctx.globalAlpha=.16; ctx.fillStyle='#061208';
    blade(ctx,len,len*wr); ctx.fill();
    ctx.restore();
    const g=ctx.createLinearGradient(0,-len*wr*.8,len*.9,len*wr*.5);
    g.addColorStop(0,shade(col,.48)); g.addColorStop(.38,col); g.addColorStop(1,dark);
    ctx.fillStyle=g; blade(ctx,len,len*wr); ctx.fill();
    ctx.strokeStyle=shade(dark,-.05); ctx.globalAlpha=.55; ctx.lineWidth=Math.max(.8,len*.012); ctx.stroke(); ctx.globalAlpha=1;
    ctx.strokeStyle='rgba(244,255,226,.78)'; ctx.lineWidth=Math.max(1.1,len*.028); ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(len*.08,0); ctx.quadraticCurveTo(len*.5,-len*.01,len*.84,0); ctx.stroke();
    ctx.strokeStyle='rgba(18,48,14,.5)'; ctx.lineWidth=Math.max(.7,len*.012);
    for(let s=1;s<=4;s++){
      const u=.18+s*.15, px=len*u;
      const wy=Math.sin(Math.PI*Math.pow(u,.7))*len*wr*.62;
      ctx.beginPath();
      ctx.moveTo(px,0); ctx.quadraticCurveTo(px+len*.07,-wy*.55,px+len*.14,-wy);
      ctx.moveTo(px,0); ctx.quadraticCurveTo(px+len*.07,wy*.55,px+len*.14,wy);
      ctx.stroke();
    }
  }
  // Fan leaf on a petiole. ang is the aim; sag bends the petiole toward the ground.
  function fanLeaf(ctx,x,y,ang,size,k,wr,col,dark,pet=0,sag=0){
    ctx.save(); ctx.translate(x,y);
    ctx.lineJoin='round'; ctx.lineCap='round';
    let nang=ang, ox=0, oy=0;
    if(pet>1){
      const dx=Math.cos(ang), dy=Math.sin(ang);
      let px=-dy, py=dx; if(py<0){ px=-px; py=-py; }
      const s=sag||0;
      ox=dx*pet+px*pet*s; oy=dy*pet+py*pet*s;
      const stemW=Math.max(1.5,size*.05);
      const sg=ctx.createLinearGradient(0,-stemW,0,stemW);
      sg.addColorStop(0,shade(dark,-.2)); sg.addColorStop(.4,shade(col,.15)); sg.addColorStop(1,shade(dark,-.45));
      ctx.strokeStyle=sg; ctx.lineWidth=stemW;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(ox*.45+px*pet*s*.4,oy*.45+py*pet*s*.4,ox,oy); ctx.stroke();
      ctx.strokeStyle='rgba(232,255,214,.5)'; ctx.lineWidth=Math.max(.6,stemW*.28);
      ctx.beginPath(); ctx.moveTo(px*-.3,py*-.3); ctx.quadraticCurveTo(ox*.4,oy*.4,ox*.92,oy*.92); ctx.stroke();
      nang=Math.atan2(oy,ox);
    }
    ctx.translate(ox,oy); ctx.rotate(nang);
    const spread=k>=9?2.55:k>=7?2.2:k>=5?1.8:.85;
    const order=[]; for(let j=0;j<k;j++) order.push(j);
    order.sort((a,b)=>Math.abs(b-(k-1)/2)-Math.abs(a-(k-1)/2));
    for(const j of order){
      const t=k===1?0:(j/(k-1)-.5);
      const a=t*spread, len=size*(1-Math.pow(Math.abs(t)*2,1.05)*.5);
      if(len<size*.2) continue;
      ctx.save(); ctx.rotate(a+t*sag*.15);
      paintBlade(ctx,len,wr,col,dark);
      ctx.restore();
    }
    ctx.fillStyle=shade(dark,-.15); ctx.beginPath(); ctx.arc(0,0,Math.max(1.8,size*.055),0,TAU); ctx.fill();
    ctx.fillStyle=shade(col,.4); ctx.beginPath(); ctx.arc(-size*.02,-size*.015,Math.max(.7,size*.02),0,TAU); ctx.fill();
    ctx.restore();
  }
  function sugarFan(ctx,len,wr,col,dark){
    const k=len>18?3:1;
    for(let j=0;j<k;j++){
      const t=k===1?0:(j/(k-1)-.5);
      ctx.save(); ctx.rotate(t*1.25);
      paintBlade(ctx,len*(1-Math.abs(t)*.35),wr*.85,col,dark);
      ctx.restore();
    }
  }
  // Cola: a spiral of overlapping calyx bracts, sugar leaves in the gaps,
  // curled pistils, and stalked trichomes. The base sits on the stem tip.
  function cola(ctx,x,y,ang,len,wid,c,R,ripe){
    const dx=Math.cos(ang), dy=Math.sin(ang), sx=-dy, sy=dx;
    const shape=c.shape||'chunky';
    const fox=shape==='foxtail', spear=shape==='spear'||fox;
    const density=c.density==null?.65:+c.density;
    const phase=(c.phase||0);
    const tiers=Math.max(7,Math.round((ripe?15:10)*(fox?1.4:spear?1.15:1)));
    const around=fox?4:spear?5:6;
    const bracts=[];
    for(let t=0;t<tiers;t++){
      const u=(t+.45)/tiers;
      const profile=Math.sin(Math.PI*Math.pow(u,fox?.72:.88));
      const bend=fox?Math.sin(u*2.6)*wid*.9:spear?Math.sin(u*1.4)*wid*.25:0;
      const rad=wid*(.42+.58*profile)*(0.82+density*.28);
      const twist=phase+t*(fox?.7:.55);
      for(let k=0;k<around;k++){
        const a=twist+k/around*TAU;
        const side=Math.sin(a), depth=Math.cos(a);
        const along=(u-.03)*len;
        const px=x+dx*along+sx*(side*rad+bend);
        const py=y+dy*along+sy*(side*rad*.9+bend*.25);
        const r=wid*(.55+.4*profile)*(depth<0?.84:1)*(0.9+R()*.16);
        bracts.push({px,py,r,u,side,depth,a});
      }
    }
    bracts.sort((p,q)=>p.depth-q.depth);
    // Shadow core so the bud has weight before the bracts.
    ctx.save();
    ctx.translate(x+dx*len*.42,y+dy*len*.42); ctx.rotate(ang);
    const core=ctx.createRadialGradient(0,0,wid*.1,0,0,len*.55);
    core.addColorStop(0,shade(c.bud,-.35)); core.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=core; ctx.globalAlpha=.55;
    ctx.beginPath(); ctx.ellipse(0,0,wid*.7,len*.42,0,0,TAU); ctx.fill();
    ctx.restore();
    for(const b of bracts){
      ctx.save(); ctx.translate(b.px,b.py); ctx.rotate(ang+b.side*.28+(R()-.5)*.12);
      const light=b.depth>0?c.budLight:mix(c.bud,c.budLight,.35);
      const g=ctx.createRadialGradient(-b.r*.15,-b.r*.28,b.r*.08,b.r*.05,b.r*.08,b.r*1.15);
      g.addColorStop(0,light); g.addColorStop(.5,c.bud); g.addColorStop(1,shade(c.bud,-.55));
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.moveTo(b.r*.92,0);
      ctx.bezierCurveTo(b.r*.4,-b.r*.78,-b.r*.62,-b.r*.58,-b.r*.28,0);
      ctx.bezierCurveTo(-b.r*.62,b.r*.58,b.r*.4,b.r*.78,b.r*.92,0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle=shade(c.bud,-.25); ctx.globalAlpha=.4; ctx.lineWidth=Math.max(.6,b.r*.07);
      ctx.beginPath(); ctx.moveTo(-b.r*.15,0); ctx.quadraticCurveTo(b.r*.25,-b.r*.06,b.r*.7,0); ctx.stroke();
      ctx.globalAlpha=1;
      ctx.fillStyle='rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.ellipse(-b.r*.05,-b.r*.22,b.r*.28,b.r*.16,-.4,0,TAU); ctx.fill();
      ctx.restore();
    }
    for(const b of bracts){
      if(b.depth<.15||b.u<.1||b.u>.9) continue;
      if(((b.u*20+b.a)|0)%4!==0) continue;
      ctx.save(); ctx.translate(b.px,b.py); ctx.rotate(ang+b.side*1.2);
      sugarFan(ctx,Math.max(10,b.r*2.1),0.2,c.sugar,shade(c.sugar,-.42));
      ctx.restore();
    }
    const hairs=ripe?c.pistil:mix(c.pistil,'#f4efe4',.72);
    ctx.strokeStyle=hairs; ctx.fillStyle=shade(hairs,.12); ctx.lineCap='round';
    ctx.lineWidth=Math.max(1.6,len*.014);
    for(const b of bracts){
      if(b.depth<.05||b.u<.06) continue;
      const count=ripe?(b.u>.55?3:2):2;
      for(let k=0;k<count;k++){
        const spin=b.a+k*1.7;
        const ox=Math.cos(spin)*b.r*.2, oy=Math.sin(spin)*b.r*.2;
        const curl=(Math.sin(spin*1.3))*len*(ripe?.09:.06);
        const lift=ripe?len*(.03+b.u*.07):-len*(.04+R()*.04);
        const x2=b.px+ox+sx*curl, y2=b.py+oy+sy*curl*.75+lift;
        const cx1=b.px+ox+sx*curl*.35, cy1=b.py+oy-b.r*.25+lift*(ripe?.15:.6);
        ctx.beginPath(); ctx.moveTo(b.px+ox,b.py+oy); ctx.quadraticCurveTo(cx1,cy1,x2,y2); ctx.stroke();
        ctx.beginPath(); ctx.arc(x2,y2,Math.max(.8,wid*.028),0,TAU); ctx.fill();
      }
    }
    const frost=Math.max(0,Math.min(1,c.frost==null?.6:c.frost))*(ripe?1:c.early?.15:.4);
    if(frost>.05){
      for(const b of bracts){
        const dots=Math.round((ripe?7:3)*frost*(b.depth>0?1:.6));
        for(let k=0;k<dots;k++){
          const a=R()*TAU, d=Math.sqrt(R())*b.r*.78;
          const qx=b.px+Math.cos(a)*d, qy=b.py+Math.sin(a)*d;
          const head=Math.max(1.15,wid*(ripe?.055:.032))*(0.7+R()*.5);
          const amber=ripe&&R()<.16;
          ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=.6;
          ctx.beginPath(); ctx.moveTo(qx,qy+head*.2); ctx.lineTo(qx,qy-head*.85); ctx.stroke();
          const hg=ctx.createRadialGradient(qx-head*.2,qy-head*1.05,head*.1,qx,qy-head*.9,head);
          hg.addColorStop(0,'rgba(255,255,255,.95)');
          hg.addColorStop(.55,amber?'rgba(232,170,70,.9)':'rgba(255,255,255,.75)');
          hg.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(qx,qy-head*.9,head,0,TAU); ctx.fill();
        }
      }
      ctx.save();
      ctx.translate(x+dx*len*.4,y+dy*len*.38); ctx.rotate(ang);
      const veil=ctx.createRadialGradient(-wid*.2,-len*.05,wid*.1,0,0,len*.5);
      veil.addColorStop(0,'rgba(255,255,255,'+(0.16*frost)+')');
      veil.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=veil; ctx.beginPath(); ctx.ellipse(0,0,wid*.85,len*.4,0,0,TAU); ctx.fill();
      ctx.restore();
    }
  }
  // Plant sprite cache: key strain|stage|zone|quality
  const cache=new Map();
  const PW=150, PH=200; // logical sprite size (base at x=75,y=190)
  function plantColors(st){
    const tags=st.colorTags||[]; const g=st.game||{}; const L=st.look||{}; const t0=(tags[0]||'green').toLowerCase();
    const bud=L.bud||g.budColor||'#6a9a3a';
    const budLight=L.bud2||g.budLight||mix(bud,'#ffffff',.48);
    const pistil=L.pistil||g.pistil||'#e07028';
    const typed=st.type==='Sativa'?'#4e9a34':st.type==='Indica'?'#2c5c28':'#3c7a32';
    const leaf=L.leaf||typed;
    const purple=['purple','violet','lavender','pink','blue','black'].includes(t0);
    const dark=t0==='dark'||t0==='black';
    const frost=L.frost==null?.6:Math.max(0,Math.min(1,+L.frost));
    return {
      bud, budLight, pistil, leaf,
      leafDark:shade(leaf,-.4),
      leafLite:shade(leaf,.4),
      sugar:mix(leaf,bud,purple?.55:.34),
      leafLate:purple?mix(leaf,bud,.48):dark?shade(leaf,-.12):mix(leaf,'#c6b15a',.16),
      stem:purple?mix('#3d5a28',bud,.42):dark?shade(leaf,-.22):mix('#4e7a34',leaf,.4),
      frost, purple, dark, tag:t0,
      shape:L.shape||'chunky',
      density:L.density==null?.6:+L.density
    };
  }
  function plantSprite(st,stage,scale,droop=0){
    const key=st.id+'|'+stage+'|'+scale+'|'+droop;
    if(cache.has(key)) return cache.get(key);
    const raw=document.createElement('canvas'); raw.width=PW*scale; raw.height=PH*scale;
    const rc=raw.getContext('2d'); rc.scale(scale,scale);
    // The painted plant is built at a large size. Fit that drawing into the legacy thumb box.
    drawPlant(rc,st,stage,PW/2,PH-10,0.34,droop);
    // strong silhouette: dark outline built from 8 offset copies, then the plant on top
    const c=document.createElement('canvas'); c.width=raw.width; c.height=raw.height; const ctx=c.getContext('2d');
    const o=Math.max(1,Math.round(1.3*scale));
    for(const [dx,dy] of [[-o,0],[o,0],[0,-o],[0,o],[-o,-o],[o,-o],[-o,o],[o,o]]) ctx.drawImage(raw,dx,dy);
    ctx.globalCompositeOperation='source-in'; ctx.fillStyle='rgba(12,34,14,.9)'; ctx.fillRect(0,0,c.width,c.height);
    ctx.globalCompositeOperation='source-over'; ctx.drawImage(raw,0,0);
    const out={c,w:PW,h:PH,ox:PW/2,oy:PH-10}; if(cache.size>600) cache.clear(); cache.set(key,out); return out;
  }
  function oddFingers(n){ n=Math.round(n); if(n<3) return 3; if(n>9) return 9; return n%2?n:n-1; }
  function stemLimb(ctx,x0,y0,x1,y1,w0,w1,col,bend){
    const mx=(x0+x1)/2+bend, my=(y0+y1)/2;
    const g=ctx.createLinearGradient(x0-w0,y0,x0+w0,y1);
    g.addColorStop(0,shade(col,-.38)); g.addColorStop(.38,shade(col,.28)); g.addColorStop(1,shade(col,-.5));
    ctx.strokeStyle=g; ctx.lineCap='round'; ctx.lineWidth=w0;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(mx,my,x1,y1); ctx.stroke();
    if(w1<w0*.92){
      ctx.lineWidth=w1; ctx.globalAlpha=.01; ctx.stroke(); ctx.globalAlpha=1;
    }
    ctx.strokeStyle='rgba(236,255,214,.38)'; ctx.lineWidth=Math.max(.7,w0*.22);
    ctx.beginPath(); ctx.moveTo(x0-w0*.12,y0); ctx.quadraticCurveTo(mx-w0*.15,my,x1,y1); ctx.stroke();
  }
  function nodeBump(ctx,x,y,w,col){
    ctx.fillStyle=shade(col,-.35); ctx.beginPath(); ctx.ellipse(x,y,w*1.15,w*.55,0,0,TAU); ctx.fill();
    ctx.fillStyle=shade(col,.22); ctx.beginPath(); ctx.ellipse(x-w*.22,y-w*.16,w*.48,w*.22,0,0,TAU); ctx.fill();
  }
  // Painted plant. Foot is (bx, by) and every leaf grows above it.
  // Stages: 0 seedling, 1 early veg, 2 veg, 3 early flower, 4 full flower, 5 ripe.
  // variant 0..7 changes the lean and the cola spiral so two pots of one strain are not copies.
  function drawPlant(ctx,st,stage,bx,by,sz,droop=0,variant=0){
    const v=variant|0;
    const R=rng(hash((st&&st.id)||'plant')+stage*97+v*131+11);
    const col=plantColors(st||{});
    const sativa=st&&st.type==='Sativa', indica=st&&st.type==='Indica';
    const look=(st&&st.look)||{};
    const leafShape=look.leafShape||(sativa?'narrow':indica?'broad':'mid');
    const fingers=oddFingers(leafShape==='narrow'?9:leafShape==='broad'?5:7);
    const wr=leafShape==='narrow'?.105:leafShape==='broad'?.2:.145;
    const stretch=(sativa?1.12:indica?.8:1)*(col.shape==='foxtail'?1.06:1);
    const H=[96,230,320,350,430,460][Math.max(0,Math.min(5,stage|0))]*sz*stretch;
    const lean=((v%2?1:-1)*(8+ (v%4)*2)+(R()-.5)*6)*sz;
    const dr=Math.max(0,droop||0);
    ctx.save();
    ctx.lineJoin='round'; ctx.lineCap='round';
    // Nothing paints below the soil line, so a drooping leaf cannot push the sprite off the pot.
    ctx.beginPath(); ctx.rect(-2000,-2000,4000,by+2000); ctx.clip();
    const leafCol=dr?mix(stage>=5?col.leafLate:col.leaf,'#c2a84a',.35):stage>=5?col.leafLate:stage===4?mix(col.leaf,col.leafLate,.4):col.leaf;
    const young=mix(leafCol,'#e7f8c4',.4);
    const dark=shade(leafCol,-.42);
    if(stage<=0){
      const h=H*.92, top=by-h;
      stemLimb(ctx,bx,by,bx+(lean*.15),top,3.2*sz,1.6*sz,col.stem,lean*.1);
      nodeBump(ctx,bx,by-h*.55,3.2*sz,leafCol);
      ctx.fillStyle=shade(young,.05);
      ctx.beginPath(); ctx.ellipse(bx-11*sz,by-h*.62,12*sz,5.2*sz,-.55,0,TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx+12*sz,by-h*.55,12*sz,5.2*sz,.5,0,TAU); ctx.fill();
      ctx.strokeStyle='rgba(236,255,214,.8)'; ctx.lineWidth=1.1*sz;
      ctx.beginPath(); ctx.moveTo(bx-20*sz,by-h*.55); ctx.quadraticCurveTo(bx-10*sz,by-h*.72,bx-2*sz,by-h*.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx+22*sz,by-h*.48); ctx.quadraticCurveTo(bx+11*sz,by-h*.66,bx+2*sz,by-h*.54); ctx.stroke();
      fanLeaf(ctx,bx,by-h*.48,-Math.PI/2-1.15,22*sz,3,wr*.95,young,dark,10*sz,.35+dr);
      fanLeaf(ctx,bx,by-h*.4,-Math.PI/2+1.12,24*sz,3,wr*.95,shade(young,.05),dark,11*sz,.32+dr);
      fanLeaf(ctx,bx+lean*.12,top,-Math.PI/2+lean*.002,16*sz,3,wr,mix(young,'#ffffff',.15),dark,4*sz,.05);
      ctx.restore(); return;
    }
    const nodes=stage===1?3:stage===2?4:stage===3?5:6;
    // Shape changes how the height is split. The cola never stacks past H, so a foxtail stays on the canvas.
    const form=col.shape==='foxtail'?1.45:col.shape==='spear'?1.2:.88;
    const colaUnits=stage>=5?form:stage===4?form*.7:stage===3?form*.38:0;
    const stemUnits=stage>=5?(indica?1.05:sativa?1.35:1.2):stage===4?1.35:stage===3?1.7:(indica?1.45:1.65);
    const unit=H/Math.max(.01,stemUnits+colaUnits);
    const stem=stemUnits*unit;
    const colaLen=colaUnits*unit;
    const ups=[];
    for(let i=0;i<nodes;i++){
      const t=(i+1)/(nodes+.25);
      const u=Math.pow(t,indica?.82:sativa?1.12:1);
      ups.push(stem*(.16+.84*u));
    }
    const xAt=up=>bx+lean*(up/Math.max(1,H));
    const top=stem;
    const topX=xAt(top), topY=by-top;
    const fingersAt=t=>oddFingers(stage===1?Math.min(5,fingers):t>.82?3:t>.6?Math.min(fingers,5):fingers);
    const leafAt=t=>H*(indica?.2:sativa?.175:.19)*(1-t*.5)*(stage<=1?1.45:1);
    // Far leaves first, then the stalk, then the fans that face the light.
    for(let i=0;i<nodes;i++){
      const t=i/(nodes-1), up=ups[i], x=xAt(up), y=by-up;
      const back=shade(leafCol,-.16);
      fanLeaf(ctx,x,y,-Math.PI/2-(v%2?.22:-.18),leafAt(t)*.62,Math.max(3,fingersAt(t)-2),wr,back,shade(leafCol,-.5),leafAt(t)*.28,.08);
    }
    stemLimb(ctx,bx,by,topX,topY,Math.max(3.2,(4.2+stage*.35)*sz),Math.max(1.6,2.2*sz),col.stem,lean*.25);
    const limbs=[];
    for(let i=0;i<nodes;i++){
      const t=i/(nodes-1), up=ups[i], x=xAt(up), y=by-up;
      nodeBump(ctx,x,y,Math.max(2.2,(2.4+stage*.15)*sz*(1-t*.35)),leafCol);
      const baseSpread=indica?1.32:sativa?.62:.98;
      const spread=(stage<=1?Math.max(baseSpread,1.08):baseSpread)*(1-t*.22);
      const sag=(indica?.42:.28)+dr*.55+(1-t)*.12;
      const twist=(i%2?1:-1)*.08*(v%3===0?-1:1);
      for(const side of [-1,1]){
        const ang=-Math.PI/2+side*spread+twist;
        const szL=leafAt(t)*(side<0?.9+R()*.12:1);
        const colL=t>.7?mix(leafCol,young,.45):leafCol;
        fanLeaf(ctx,x,y,ang,szL,fingersAt(t),wr,colL,dark,szL*.62,sag);
      }
      const branch=stage>=2&&t>.08&&t<.78;
      if(branch){
        for(const side of [-1,1]){
          const len=H*(.13+.08*(1-t))*(sativa?1.02:indica?.72:.88)*(.85+R()*.2);
          const rise=len*(indica?.42:sativa?.62:.52);
          const y1=Math.max(by-stem-colaLen*.08, y-rise);
          const x1=x+side*Math.min(len, Math.abs(y-y1)+len*.45);
          limbs.push({x,y,x1,y1,side,t,len});
        }
      }
    }
    limbs.forEach(b=>{
      stemLimb(ctx,b.x,b.y,b.x1,b.y1,Math.max(1.6,(2.1-b.t)*sz),1.3*sz,col.stem,b.side*b.len*.08);
      const ang=-Math.PI/2+b.side*(indica?.85:.7);
      const s=leafAt(b.t)*.55;
      fanLeaf(ctx,b.x1,b.y1,ang,s,oddFingers(Math.max(3,fingers-2)),wr,leafCol,dark,s*.4,.2+dr*.3);
      nodeBump(ctx,b.x1,b.y1,2*sz,leafCol);
    });
    const girth=(col.shape==='chunky'?1.22:col.shape==='foxtail'?.58:.78)*(0.75+col.density*.4);
    const colaW=colaLen*(col.shape==='foxtail'?.1:col.shape==='spear'?.135:.2)*(0.88+Math.min(1.2,girth)*.12);
    const budCol=stage>=5?col.bud:stage===4?mix(col.bud,col.leaf,.28):mix(col.bud,'#b7d48a',.45);
    const c2={
      bud:budCol,
      budLight:stage>=5?col.budLight:mix(col.budLight,'#f6fbe8',.45),
      pistil:stage>=5?col.pistil:mix(col.pistil,'#f7f3ea',.62),
      sugar:col.sugar, frost:col.frost, shape:col.shape, density:col.density,
      phase:v*0.7, early:stage<4?1:0
    };
    if(stage<3){
      fanLeaf(ctx,topX,topY,-Math.PI/2-.4,H*.1,oddFingers(Math.min(5,fingers)),wr,young,dark,H*.035,.06);
      fanLeaf(ctx,topX,topY,-Math.PI/2+.38,H*.09,3,wr,young,dark,H*.03,.06);
      fanLeaf(ctx,topX,topY-2*sz,-Math.PI/2,H*.08,3,wr,mix(young,'#ffffff',.18),dark,H*.02,0);
      ctx.restore(); return;
    }
    if(stage===3){
      limbs.forEach(b=>{
        if(b.t<.4) return;
        cola(ctx,b.x1,b.y1,-Math.PI/2+b.side*.15,colaLen*.42,colaW*.7,c2,R,false);
      });
      cola(ctx,topX,topY,-Math.PI/2,colaLen,colaW,c2,R,false);
      ctx.restore(); return;
    }
    const ripe=stage>=5;
    limbs.slice().sort((a,b)=>b.y-a.y).forEach(b=>{
      if(b.t<.2) return;
      const L=colaLen*(ripe?.5:.38)*(1-b.t*.18);
      cola(ctx,b.x1,b.y1,-Math.PI/2+b.side*.18,L,colaW*(ripe?.72:.6)*(1-b.t*.1),c2,R,ripe);
    });
    cola(ctx,topX,topY,-Math.PI/2+lean*.004,colaLen,colaW,c2,R,ripe);
    ctx.restore();
  }
  // Procedural stand-in used until the painted sprite is ready, and if a photo canvas cannot be read.
  function thumbCanvas(st,size=96,locked=false){
    size=size||96; const c=document.createElement('canvas'); c.width=size; c.height=size; const ctx=c.getContext('2d'); if(!ctx||!st) return c;
    const g=st.game||{}, L=st.look||{}, bud=g.budColor||L.bud||'#6a9a3a';
    const grd=ctx.createRadialGradient(size/2,size*.45,4,size/2,size/2,size*.7);
    grd.addColorStop(0,mix(bud,'#0a1712',.6)); grd.addColorStop(1,'#08140f'); ctx.fillStyle=grd; ctx.fillRect(0,0,size,size);
    if(locked){ ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='800 '+Math.round(size*.22)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('???',size/2,size/2); return c; }
    ctx.save(); ctx.translate(size/2,size*.94); const fit=(size*.9)/500; ctx.scale(fit,fit); try{ drawPlant(ctx,st,5,0,0,1); }catch(e){} ctx.restore(); return c;
  }
  const thumbs={};
  function thumb(st,size=96,locked=false){
    const key=(st&&st.id||'?')+size+(locked?'L':''); if(thumbs[key]) return thumbs[key];
    const c=thumbCanvas(st,size,locked); let url='';
    try{ url=c.toDataURL('image/jpeg',.86); }catch(e){ try{ url=c.toDataURL(); }catch(e2){ url=''; } }
    thumbs[key]=url; return url;
  }
  // ---- tropical foliage ----
  function palm(ctx,x,y,h,R,sway,night){
    const lean=(R()-.5)*.5+sway*.15;
    ctx.strokeStyle=night?'#4a3a2a':'#8a6a44'; ctx.lineCap='round';
    const tx=x+lean*h, ty=y-h;
    for(let i=0;i<10;i++){ const t0=i/10,t1=(i+1)/10;
      ctx.lineWidth=(9-6*t0)*h/120; ctx.strokeStyle=i%2?(night?'#3f3122':'#7b5c3a'):(night?'#4d3c2b':'#94744d');
      ctx.beginPath(); ctx.moveTo(x+lean*h*t0*t0,y-h*t0); ctx.lineTo(x+lean*h*t1*t1,y-h*t1); ctx.stroke(); }
    const fronds=7;
    for(let i=0;i<fronds;i++){
      const a=-Math.PI/2+(i/(fronds-1)-.5)*Math.PI*1.5+sway*.12+(R()-.5)*.2; const L=h*(.55+R()*.15);
      const g1=night?'#1d3b2a':'#2f8a3c', g2=night?'#16301f':'#1f6a2c';
      ctx.save(); ctx.translate(tx,ty); ctx.rotate(a);
      ctx.strokeStyle=g2; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(L*.5,-L*.1,L,L*.35); ctx.stroke();
      ctx.fillStyle=g1;
      for(let j=1;j<14;j++){ const t=j/14, px=L*t, py=-L*.1*Math.sin(t*Math.PI)+L*.35*t*t;
        const ll=L*.28*(1-t*.6);
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+ll*.3,py+ll); ctx.lineTo(px+ll*.45,py+ll*.9); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+ll*.3,py-ll*.6); ctx.lineTo(px+ll*.45,py-ll*.5); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    ctx.fillStyle=night?'#2e2416':'#5b4022'; for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(tx+(i-1)*4,ty+4,4,0,TAU);ctx.fill();}
  }
  function monstera(ctx,x,y,s,R,night,tint){
    for(let i=0;i<6;i++){
      const a=-Math.PI/2+(i/5-.5)*2.6+(R()-.5)*.3, L=s*(.7+R()*.4);
      const lx=x+Math.cos(a)*L*.6, ly=y+Math.sin(a)*L*.45;
      ctx.strokeStyle=night?'#1a3a24':'#2c6b33'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(lx,ly); ctx.stroke();
      ctx.save(); ctx.translate(lx,ly); ctx.rotate(a+Math.PI/2);
      const g=ctx.createLinearGradient(-L*.4,0,L*.4,0); g.addColorStop(0,night?'#163322':(tint||'#2e8a3e')); g.addColorStop(1,night?'#0f2618':'#1d5e2b');
      ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(0,0,L*.38,L*.32,0,0,TAU); ctx.fill();
      ctx.globalCompositeOperation='destination-out';
      for(let j=0;j<3;j++){ ctx.beginPath(); ctx.ellipse((j-1)*L*.18,-L*.14,L*.035,L*.12,(j-1)*.35,0,TAU); ctx.fill(); }
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.beginPath(); ctx.moveTo(0,L*.3); ctx.lineTo(0,-L*.28); ctx.stroke();
      ctx.restore();
    }
  }
  function hibiscus(ctx,x,y,s,R,night,flower){
    ctx.fillStyle=night?'#15301e':'#2a7535';
    for(let i=0;i<9;i++){ const a=R()*TAU, d=R()*s*.6; ctx.beginPath(); ctx.ellipse(x+Math.cos(a)*d,y-s*.3+Math.sin(a)*d*.5,s*.28,s*.18,a,0,TAU); ctx.fill(); }
    ctx.fillStyle=night?'#1d4027':'#3a9145';
    for(let i=0;i<5;i++){ const a=R()*TAU, d=R()*s*.4; ctx.beginPath(); ctx.ellipse(x+Math.cos(a)*d,y-s*.45+Math.sin(a)*d*.5,s*.2,s*.13,a,0,TAU); ctx.fill(); }
    for(let i=0;i<4;i++){ const fx=x+(R()-.5)*s, fy=y-s*.35+(R()-.5)*s*.5; const fc=flower||'#ff4f6a';
      ctx.fillStyle=night?shade(fc,-.55):fc; for(let p=0;p<5;p++){ const a=p/5*TAU; ctx.beginPath(); ctx.ellipse(fx+Math.cos(a)*s*.07,fy+Math.sin(a)*s*.07,s*.08,s*.05,a,0,TAU); ctx.fill(); }
      ctx.fillStyle='#ffe066'; ctx.beginPath(); ctx.arc(fx,fy,s*.025,0,TAU); ctx.fill(); }
  }
  function banana(ctx,x,y,s,R,night){
    ctx.strokeStyle=night?'#2a4a2a':'#6c9a3e'; ctx.lineWidth=s*.06; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-s*.7); ctx.stroke();
    for(let i=0;i<5;i++){ const a=-Math.PI/2+(i/4-.5)*2.4; ctx.save(); ctx.translate(x,y-s*.7); ctx.rotate(a);
      ctx.fillStyle=night?'#1b3a22':(i%2?'#4fa23f':'#3b8a35'); ctx.beginPath(); ctx.ellipse(s*.38,0,s*.42,s*.11,0,0,TAU); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(s*.78,0); ctx.stroke(); ctx.restore(); }
  }
  // Greenhouse daylight rail. One aluminum purlin bolted to the roof, with a
  // sun-glass trough fused to it. Drawn in room pixels so a zoom stays sharp.
  function roundBox(ctx,x,y,w,h,r){
    const rad=Math.max(0,Math.min(r,w/2,h/2));
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x,y,w,h,rad);
    else ctx.rect(x,y,w,h);
  }
  function bolt(ctx,cx,cy){
    ctx.fillStyle='#2a2826'; ctx.beginPath(); ctx.arc(cx,cy,1.05,0,TAU); ctx.fill();
    ctx.fillStyle='#f7f4ee'; ctx.beginPath(); ctx.arc(cx-.32,cy-.32,.32,0,TAU); ctx.fill();
  }
  function daylightRail(ctx,x,y,w,h){
    if(!(w>12)||!(h>10)) return;
    const beamH=Math.max(7,Math.min(10,h*.28));
    const bodyTop=y+beamH-1.2;
    const bodyH=Math.max(8,(y+h)-bodyTop-1);
    ctx.save();
    // Same down-right shadow the plants cast. Nothing opaque behind the fixture.
    ctx.fillStyle='rgba(48,38,26,.20)';
    ctx.beginPath(); ctx.ellipse(x+w*.53,y+h+2.4,w*.47,Math.max(2.2,h*.13),0,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(255,214,150,.16)';
    ctx.beginPath(); ctx.ellipse(x+w*.5,y+h+1.2,w*.40,Math.max(2.6,h*.18),0,0,TAU); ctx.fill();
    // Glazing bar, the cool gray of the greenhouse frame, sun on the top edge.
    const metal=ctx.createLinearGradient(x,y,x,y+beamH);
    metal.addColorStop(0,'#f7f4ee'); metal.addColorStop(.32,'#c9ccd0'); metal.addColorStop(.7,'#8e9399'); metal.addColorStop(1,'#5a6066');
    ctx.fillStyle=metal; roundBox(ctx,x,y,w,beamH,1.5); ctx.fill();
    ctx.save(); roundBox(ctx,x,y,w,beamH,1.5); ctx.clip();
    ctx.lineWidth=.55;
    for(let i=0;i<8;i++){
      const gy=y+.8+i*(beamH-1.6)/7;
      ctx.strokeStyle=i%2?'rgba(255,252,246,.28)':'rgba(36,40,44,.14)';
      ctx.beginPath(); ctx.moveTo(x,gy); ctx.lineTo(x+w,gy+(i%3-1)*.25); ctx.stroke();
    }
    ctx.fillStyle='rgba(255,248,230,.7)'; ctx.fillRect(x,y,w,1.35);
    ctx.restore();
    // Trough shares the purlin's wall so the housing cannot float under it.
    const house=ctx.createLinearGradient(x,bodyTop,x,bodyTop+bodyH);
    house.addColorStop(0,'#f3f0e8'); house.addColorStop(.18,'#c4c0b6'); house.addColorStop(.55,'#9a958c'); house.addColorStop(1,'#5e5a54');
    ctx.fillStyle=house; roundBox(ctx,x+.6,bodyTop,w-1.2,bodyH,2); ctx.fill();
    ctx.save(); roundBox(ctx,x+.6,bodyTop,w-1.2,bodyH,2); ctx.clip();
    ctx.fillStyle='rgba(255,252,246,.42)'; ctx.fillRect(x,bodyTop,w,1.2);
    ctx.fillStyle='rgba(40,36,30,.18)'; ctx.fillRect(x,bodyTop+bodyH-2.2,w,2.2);
    ctx.restore();
    const pad=3.4, panes=Math.max(2,Math.min(18,Math.round(w/30)));
    const gapP=1.25, inner=w-pad*2, pw=(inner-(panes-1)*gapP)/panes, ph=Math.max(6,bodyH-5.2);
    const py=bodyTop+(bodyH-ph)*.58;
    const ambers=['#f6c56a','#f3d48a','#e8b15a','#f8d7a0','#efc278'];
    for(let i=0;i<panes;i++){
      const px=x+pad+i*(pw+gapP), deep=ambers[i%ambers.length];
      const glow=ctx.createLinearGradient(px,py,px+pw*.2,py+ph);
      glow.addColorStop(0,'#fffdf8'); glow.addColorStop(.28,'#fff1cf'); glow.addColorStop(1,deep);
      ctx.fillStyle=glow; roundBox(ctx,px,py,pw,ph,1.5); ctx.fill();
      ctx.fillStyle='rgba(110,68,22,.16)'; ctx.fillRect(px+.5,py+ph*.7,Math.max(1,pw-1),ph*.3);
      const hot=ctx.createRadialGradient(px+pw*.36,py+ph*.26,.4,px+pw*.48,py+ph*.42,Math.max(pw,ph)*.85);
      hot.addColorStop(0,'rgba(255,255,252,.95)'); hot.addColorStop(.45,'rgba(255,230,180,.22)'); hot.addColorStop(1,'rgba(255,210,140,0)');
      ctx.fillStyle=hot; ctx.beginPath(); ctx.rect(px,py,pw,ph); ctx.fill();
      ctx.strokeStyle='rgba(72,64,52,.32)'; ctx.lineWidth=.55; roundBox(ctx,px,py,pw,ph,1.5); ctx.stroke();
      ctx.strokeStyle='rgba(255,252,244,.55)'; ctx.lineWidth=.45;
      ctx.beginPath(); ctx.moveTo(px+1.1,py+1.3); ctx.lineTo(px+pw*.62,py+1.3); ctx.stroke();
    }
    // Saddle clamps stitch the trough to the purlin. Ends bolt into the frame.
    const clamps=Math.max(2,Math.min(11,Math.round(w/72)));
    for(let i=0;i<clamps;i++){
      const sx=x+9+(w-18)*(clamps===1?.5:i/(clamps-1));
      const sg=ctx.createLinearGradient(sx-3.2,0,sx+3.2,0);
      sg.addColorStop(0,'#5c5954'); sg.addColorStop(.48,'#f4f1ea'); sg.addColorStop(1,'#4e4b46');
      ctx.fillStyle=sg; roundBox(ctx,sx-2.3,y+beamH*.35,4.6,beamH*.7+3.2,1); ctx.fill();
      bolt(ctx,sx,y+beamH*.62);
    }
    const shoe=ctx.createLinearGradient(0,y,0,y+beamH+bodyH*.45);
    shoe.addColorStop(0,'#f3f0ea'); shoe.addColorStop(.4,'#b9b6ae'); shoe.addColorStop(1,'#6a6660');
    ctx.fillStyle=shoe;
    roundBox(ctx,x,y,8,beamH+5.5,1.4); ctx.fill();
    roundBox(ctx,x+w-8,y,8,beamH+5.5,1.4); ctx.fill();
    ctx.strokeStyle='rgba(255,252,246,.45)'; ctx.lineWidth=.6;
    ctx.beginPath(); ctx.moveTo(x+.4,y+.5); ctx.lineTo(x+6.6,y+.5); ctx.moveTo(x+w-6.6,y+.5); ctx.lineTo(x+w-.6,y+.5); ctx.stroke();
    bolt(ctx,x+3.4,y+beamH*.48); bolt(ctx,x+w-3.4,y+beamH*.48);
    ctx.restore();
  }
  // Garage and indoor grow light. One bar, hung straight down from the ceiling
  // and drawn in room pixels so a zoom stays sharp. No backdrop.
  function growLight(ctx,x,y,w,h){
    if(!(w>12)||!(h>12)) return;
    const drop=Math.max(3.5,Math.min(7,h*.22));
    const barY=y+drop-1.2;
    const barH=Math.max(8,(y+h)-barY);
    ctx.save();
    ctx.fillStyle='rgba(24,18,10,.22)';
    ctx.beginPath(); ctx.ellipse(x+w*.52,y+h+2.2,w*.46,Math.max(2,h*.11),0,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(255,220,160,.14)';
    ctx.beginPath(); ctx.ellipse(x+w*.5,y+h+1,w*.38,Math.max(2.2,h*.14),0,0,TAU); ctx.fill();
    const n=Math.max(2,Math.min(7,Math.round(w/110)));
    for(let i=0;i<n;i++){
      const cx=x+12+(w-24)*(n===1?.5:i/(n-1));
      const rod=ctx.createLinearGradient(cx-1.8,0,cx+1.8,0);
      rod.addColorStop(0,'#3c4046'); rod.addColorStop(.48,'#e8ebef'); rod.addColorStop(1,'#2c3036');
      ctx.fillStyle=rod; ctx.fillRect(cx-1.15,y,2.3,drop+1.6);
      const shoe=ctx.createLinearGradient(cx-4,y,cx+4,y+3);
      shoe.addColorStop(0,'#f7f8fa'); shoe.addColorStop(1,'#8d939a');
      ctx.fillStyle=shoe; roundBox(ctx,cx-3.6,y,7.2,2.6,0.8); ctx.fill();
      bolt(ctx,cx,y+1.3);
    }
    const metal=ctx.createLinearGradient(x,barY,x,barY+barH);
    metal.addColorStop(0,'#f7f8fa'); metal.addColorStop(.2,'#d0d4d8'); metal.addColorStop(.55,'#9aa0a6'); metal.addColorStop(1,'#3a3f44');
    ctx.fillStyle=metal; roundBox(ctx,x,barY,w,barH,2); ctx.fill();
    ctx.save(); roundBox(ctx,x,barY,w,barH,2); ctx.clip();
    ctx.fillStyle='rgba(255,252,248,.78)'; ctx.fillRect(x,barY,w,1.35);
    ctx.strokeStyle='rgba(40,44,48,.16)'; ctx.lineWidth=.45;
    const fins=Math.max(3,Math.min(6,Math.round(barH/5)));
    for(let i=0;i<fins;i++){ const fy=barY+2+i*((barH*.34)/fins); ctx.beginPath(); ctx.moveTo(x,fy); ctx.lineTo(x+w,fy); ctx.stroke(); }
    ctx.restore();
    const lensY=barY+barH*.42, lensH=Math.max(4,barH*.46);
    const lens=ctx.createLinearGradient(x,lensY,x,lensY+lensH);
    lens.addColorStop(0,'#fffefb'); lens.addColorStop(.3,'#fff3d2'); lens.addColorStop(1,'#f0c56e');
    ctx.fillStyle=lens; roundBox(ctx,x+1.6,lensY,w-3.2,lensH,1.3); ctx.fill();
    const diodes=Math.max(6,Math.min(56,Math.round(w/12)));
    const slot=(w-8)/diodes;
    for(let i=0;i<diodes;i++){
      const dx=x+4+i*slot+slot*.18, dw=Math.max(1.4,slot*.55);
      const hot=ctx.createLinearGradient(dx,lensY,dx,lensY+lensH);
      hot.addColorStop(0,'rgba(255,255,255,.95)'); hot.addColorStop(.55,'rgba(255,236,190,.35)'); hot.addColorStop(1,'rgba(255,210,140,0)');
      ctx.fillStyle=hot; roundBox(ctx,dx,lensY+.6,dw,lensH-1.2,0.8); ctx.fill();
    }
    ctx.strokeStyle='rgba(70,64,52,.28)'; ctx.lineWidth=.5; roundBox(ctx,x+1.6,lensY,w-3.2,lensH,1.3); ctx.stroke();
    const cap=ctx.createLinearGradient(0,barY,0,barY+barH);
    cap.addColorStop(0,'#f4f5f7'); cap.addColorStop(.45,'#b7bcc2'); cap.addColorStop(1,'#5c6268');
    ctx.fillStyle=cap;
    roundBox(ctx,x,barY,7,barH,1.4); ctx.fill();
    roundBox(ctx,x+w-7,barY,7,barH,1.4); ctx.fill();
    bolt(ctx,x+3.5,barY+barH*.42); bolt(ctx,x+w-3.5,barY+barH*.42);
    ctx.restore();
  }
  return {plantColors,cola,rng,hash,mix,shade,plantSprite,thumb,thumbCanvas,palm,monstera,hibiscus,banana,fanLeaf,drawPlant,daylightRail,growLight};
})();
