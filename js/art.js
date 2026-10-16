/* Procedural art: plants (fan leaves, colas, pistils, trichomes), tropical foliage, thumbnails. */
window.Art = (function(){
  const TAU=Math.PI*2;
  function rng(seed){ let s=seed>>>0||1; return ()=>((s=Math.imul(s^s>>>15,1|s),s^=s+Math.imul(s^s>>>7,61|s),((s^s>>>14)>>>0)/4294967296)); }
  function hash(str){ let h=2166136261; for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; }
  function hex(c){ if(c.startsWith('rgb')) return c.match(/\d+/g).slice(0,3).map(Number); c=c.replace('#',''); return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)]; }
  function mix(a,b,t){ const A=hex(a),B=hex(b); return 'rgb('+A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')+')'; }
  function shade(a,amt){ return amt>0?mix(a,'#ffffff',amt):mix(a,'#000000',-amt); }

  // Serrated leaflet along +x. Teeth step forward only, so the outline cannot cross itself.
  function leaflet(ctx,L,W,serr){
    const n=Math.max(8,serr|0), tw=L/n;
    const bell=t=>Math.sin(Math.PI*Math.pow(t,.8))*(1-.1*t);
    ctx.beginPath(); ctx.moveTo(0,0);
    for(let i=1;i<=n;i++){
      const t=i/n, y=bell(t)*W, x=t*L, deep=i%2?1:.58;
      ctx.lineTo(x-tw*.62,-y*deep*.4);
      ctx.lineTo(x-tw*.04,-y*deep);
    }
    ctx.lineTo(L,0);
    for(let i=n;i>=1;i--){
      const t=i/n, y=bell(t)*W, x=t*L, deep=i%2?1:.58;
      ctx.lineTo(x-tw*.04,y*deep);
      ctx.lineTo(x-tw*.62,y*deep*.4);
    }
    ctx.closePath();
  }
  // Fan leaf. Overhead light: the face toward world-up is pale, the far side is in shade. Veins stay inside the leaflet.
  function fanLeaf(ctx,x,y,ang,size,k,wr,col,dark,pet=0){
    ctx.save(); ctx.translate(x,y); ctx.rotate(ang);
    if(pet){
      ctx.strokeStyle=dark; ctx.lineWidth=Math.max(1.1,size*.055); ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(pet*.4,-pet*.08,pet,0); ctx.stroke();
      ctx.strokeStyle=shade(col,.4); ctx.lineWidth=Math.max(.45,size*.018);
      ctx.beginPath(); ctx.moveTo(size*.02,-size*.012); ctx.quadraticCurveTo(pet*.38,-pet*.1,pet*.9,-size*.01); ctx.stroke();
      ctx.translate(pet,0);
    }
    const spread=Math.PI*(k>=9?.9:k>=7?.78:.66);
    for(let j=0;j<k;j++){
      const t=k===1?0:(j/(k-1)-.5), a=t*spread, len=size*(1-Math.abs(t)*.55);
      if(len<size*.22) continue;
      ctx.save(); ctx.rotate(a);
      const tot=ang+a, ux=Math.sin(tot), uy=-Math.cos(tot);
      const g=ctx.createLinearGradient(-ux*len*.15,-uy*len*.15,ux*len*.55,uy*len*.55);
      g.addColorStop(0,shade(col,.42)); g.addColorStop(.45,col); g.addColorStop(1,dark);
      ctx.fillStyle=g; leaflet(ctx,len,len*wr,k>=9?10:12); ctx.fill();
      ctx.strokeStyle=shade(dark,-.15); ctx.lineWidth=Math.max(.7,len*.016); ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.strokeStyle='rgba(244,255,226,.8)'; ctx.lineWidth=Math.max(1,len*.03); ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(len*.08,0); ctx.lineTo(len*.9,0); ctx.stroke();
      ctx.strokeStyle='rgba(18,46,14,.62)'; ctx.lineWidth=Math.max(.65,len*.014);
      for(let s=1;s<=5;s++){
        const u=s/6, px=len*(.2+u*.58), wy=Math.sin(Math.PI*Math.pow((.2+u*.58),.8))*len*wr*.62;
        ctx.beginPath();
        ctx.moveTo(px,0); ctx.quadraticCurveTo(px+len*.05,wy*.5,px+len*.12,wy);
        ctx.moveTo(px,0); ctx.quadraticCurveTo(px+len*.05,-wy*.5,px+len*.12,-wy);
        ctx.stroke();
      }
      ctx.restore(); ctx.restore();
    }
    ctx.fillStyle=shade(dark,-.2); ctx.beginPath(); ctx.arc(0,0,Math.max(1.3,size*.055),0,TAU); ctx.fill();
    ctx.fillStyle=shade(col,.45); ctx.beginPath(); ctx.arc(-size*.02,-size*.02,Math.max(.6,size*.022),0,TAU); ctx.fill();
    ctx.restore();
  }
  // Cola: sugar leaves behind stacked calyxes, curled pistils, trichome stalks. Cached with the plant sprite.
  function cola(ctx,x,y,ang,len,wid,c,R,ripe){
    const dx=Math.cos(ang), dy=Math.sin(ang), n=ripe?10:7, blobs=[];
    for(let i=0;i<n;i++){
      const u=i/(n-1), taper=Math.sin(Math.PI*Math.min(1,u*.9))*(1-u*.28);
      const r=wid*(.5+.62*taper)*(.88+R()*.16);
      blobs.push([x+dx*len*u+(R()-.5)*wid*.2, y+dy*len*u+(R()-.5)*wid*.1, r, u]);
    }
    blobs.forEach(([px,py,r,u])=>{ if(u>.78||R()>.5) return;
      for(const sd of [-1,1]){ ctx.save(); ctx.translate(px,py); ctx.rotate(ang+sd*(.95+R()*.3)); ctx.fillStyle=c.sugar; leaflet(ctx,r*1.25,r*.15,7); ctx.fill(); ctx.restore(); } });
    for(const [px,py,r] of blobs){
      ctx.save(); ctx.translate(px,py); ctx.rotate(ang);
      const g=ctx.createRadialGradient(-r*.22,-r*.3,r*.06,r*.05,r*.08,r);
      g.addColorStop(0,c.budLight); g.addColorStop(.5,c.bud); g.addColorStop(1,shade(c.bud,-.45));
      ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(0,0,r*.58,r*.82,0,0,TAU); ctx.fill();
      ctx.fillStyle=shade(c.budLight,.1); ctx.globalAlpha=.8; ctx.beginPath(); ctx.ellipse(-r*.1,-r*.18,r*.26,r*.34,-.4,0,TAU); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=shade(c.bud,-.32); ctx.lineWidth=Math.max(.45,r*.04); ctx.beginPath(); ctx.ellipse(0,0,r*.58,r*.82,0,0,TAU); ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle=c.pistil; ctx.fillStyle=shade(c.pistil,.22); ctx.lineCap='round'; ctx.lineWidth=Math.max(.8,wid*.06);
    for(const [px,py,r,u] of blobs){ if(u<.12) continue; const hairs=ripe?4:2;
      for(let k=0;k<hairs;k++){ const a=-2.4+R()*1.4, sx=px+Math.cos(a)*r*.15, sy=py+Math.sin(a)*r*.1, curl=(R()-.5)*r*1.15;
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.quadraticCurveTo(sx+curl*.45,sy-r*.75,sx+curl,sy-r*1.05); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx+curl,sy-r*1.05,Math.max(.5,wid*.028),0,TAU); ctx.fill(); } }
    const frost=Math.max(.2,Math.min(1,c.frost==null?.65:c.frost))*(ripe?1:.4);
    for(const [px,py,r] of blobs){ const dots=Math.round((ripe?9:4)*frost);
      for(let k=0;k<dots;k++){ const a=R()*TAU, d=Math.sqrt(R())*r*.7, qx=px+Math.cos(a)*d, qy=py+Math.sin(a)*d, head=Math.max(.55,wid*(ripe?.04:.028));
        ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=.4; ctx.beginPath(); ctx.moveTo(qx,qy); ctx.lineTo(qx+(R()-.5)*.3,qy-head*1.25); ctx.stroke();
        const amber=ripe&&R()<.16;
        ctx.fillStyle=amber?'rgba(255,186,70,.92)':'rgba(255,255,255,'+(.55+R()*.4)+')'; ctx.beginPath(); ctx.arc(qx,qy-head*1.25,head,0,TAU); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(qx-head*.25,qy-head*1.45,head*.26,0,TAU); ctx.fill(); } }
  }
  // Plant sprite cache: key strain|stage|zone|quality
  const cache=new Map();
  const PW=150, PH=200; // logical sprite size (base at x=75,y=190)
  function plantColors(st){
    const tags=st.colorTags||[]; const g=st.game||{}; const L=st.look||{}; const t0=tags[0]||'green';
    const budColor=g.budColor||L.bud||'#7fb04a', budLightC=g.budLight||L.bud2||'#d6f09a', pistil=g.pistil||L.pistil||'#e8c56b';
    const strong=['purple','violet','lavender','pink','blue','black'].includes(t0);
    const frosty=['white','frost','frosty','silver'].includes(t0);
    const k=strong?.8:frosty?.2:t0==='dark'?.5:.52;
    const bud=frosty?'#9fcf7a':mix('#7fb04a',budColor,k), budLight=frosty?'#f2fbe8':mix('#d6f09a',budLightC,Math.min(.9,k*1.05));
    const purple=strong;
    const typed=st.type==='Sativa'?'#4f9e36':st.type==='Indica'?'#2c6e30':'#3c8434';
    const leaf0=L.leaf?mix(typed,L.leaf,.7):typed;
    const leaf=strong?mix(leaf0,budColor,.22):leaf0;
    const frost=L.frost==null?.65:Math.max(0,Math.min(1,+L.frost));
    return {bud,budLight,pistil,leaf,sugar:mix(leaf,budColor,strong?.55:.22),leafLate:purple?mix(leaf,budColor,.55):mix(leaf,'#c4b25a',.28),frosty,frost};
  }
  function plantSprite(st,stage,scale,droop=0){
    const key=st.id+'|'+stage+'|'+scale+'|'+droop;
    if(cache.has(key)) return cache.get(key);
    const raw=document.createElement('canvas'); raw.width=PW*scale; raw.height=PH*scale;
    const rc=raw.getContext('2d'); rc.scale(scale,scale);
    drawPlant(rc,st,stage,PW/2,PH-10,1,droop);
    // strong silhouette: dark outline built from 8 offset copies, then the plant on top
    const c=document.createElement('canvas'); c.width=raw.width; c.height=raw.height; const ctx=c.getContext('2d');
    const o=Math.max(1,Math.round(1.3*scale));
    for(const [dx,dy] of [[-o,0],[o,0],[0,-o],[0,o],[-o,-o],[o,-o],[-o,o],[o,o]]) ctx.drawImage(raw,dx,dy);
    ctx.globalCompositeOperation='source-in'; ctx.fillStyle='rgba(12,34,14,.9)'; ctx.fillRect(0,0,c.width,c.height);
    ctx.globalCompositeOperation='source-over'; ctx.drawImage(raw,0,0);
    const out={c,w:PW,h:PH,ox:PW/2,oy:PH-10}; if(cache.size>600) cache.clear(); cache.set(key,out); return out;
  }
  function drawStem(ctx,x0,y0,x1,y1,w,bend){
    const g=ctx.createLinearGradient(x0-w,y0,x0+w,y1);
    g.addColorStop(0,'#243818'); g.addColorStop(.42,'#6a9a44'); g.addColorStop(1,'#15280f');
    ctx.strokeStyle=g; ctx.lineWidth=w; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo((x0+x1)/2+bend,(y0+y1)/2,x1,y1); ctx.stroke();
  }
  function nodeRing(ctx,x,y,w,col){
    ctx.fillStyle=shade(col,-.45); ctx.beginPath(); ctx.ellipse(x,y,w,w*.42,0,0,TAU); ctx.fill();
    ctx.fillStyle=shade(col,.28); ctx.beginPath(); ctx.ellipse(x-w*.2,y-w*.12,w*.45,w*.18,0,0,TAU); ctx.fill();
  }
  function drawPlant(ctx,st,stage,bx,by,sz,droop=0){
    const R=rng(hash(st.id)+stage*7); const col=plantColors(st);
    const sativa=st.type==='Sativa', indica=st.type==='Indica';
    const shape=(st.look&&st.look.leafShape)||'';
    const k=sativa||shape==='narrow'?9:indica||shape==='broad'?5:7;
    let wr=sativa?.14:indica?.28:.18;
    if(shape==='narrow') wr*=.82; else if(shape==='broad') wr*=1.18;
    // Seedling: stem planted at by, smooth cotyledons, then one serrated true leaf.
    if(stage===0){
      drawStem(ctx,bx,by,bx,by-22*sz,Math.max(1.6,2.2*sz),0);
      nodeRing(ctx,bx,by-16*sz,2.4*sz,'#3d6a2c');
      ctx.fillStyle='#8ed06a'; ctx.beginPath(); ctx.ellipse(bx-7*sz,by-18*sz,7*sz,2.6*sz,-.35,0,TAU); ctx.fill();
      ctx.fillStyle='#74c258'; ctx.beginPath(); ctx.ellipse(bx+7*sz,by-18*sz,7*sz,2.6*sz,.35,0,TAU); ctx.fill();
      ctx.strokeStyle='rgba(236,255,220,.7)'; ctx.lineWidth=Math.max(.6,.5*sz);
      ctx.beginPath(); ctx.moveTo(bx-12*sz,by-17*sz); ctx.lineTo(bx-2*sz,by-19*sz); ctx.moveTo(bx+12*sz,by-17*sz); ctx.lineTo(bx+2*sz,by-19*sz); ctx.stroke();
      fanLeaf(ctx,bx,by-22*sz,-Math.PI/2,14*sz,3,wr,'#b6ee86','#2f6a28',3*sz);
      return;
    }
    const stretch=sativa?1.12:indica?.84:1;
    const H=[0,48,92,128,156,176][stage]*sz*stretch;
    const nodes=[0,2,3,4,5,6][stage];
    let leafCol=stage>=5?col.leafLate:stage===4?mix(col.leaf,col.leafLate,.45):col.leaf; if(droop) leafCol=mix(leafCol,'#b5a24a',.4);
    const dark=shade(leafCol,-.42), back=shade(leafCol,-.22), backDark=shade(leafCol,-.55);
    const flowering=stage>=4, ripe=stage>=5;
    const br=[];
    for(let i=0;i<nodes;i++){
      const t=nodes===1?.55:i/(nodes-1); const y=by-H*(.16+.68*t);
      const len=H*(.22*(1-t*.55)+.06);
      for(const side of [-1,1]){
        const a=-Math.PI/2+side*(indica?.55:.72)*(1-.22*t)+(R()-.5)*.08;
        br.push({t,y,side,len,a});
      }
    }
    const dr=droop*.8;
    // Far leaves first, darker, so the canopy has depth.
    br.forEach(b=>{ const s=(H*.22*(1-b.t*.35)+7)*(.92+R()*.1); fanLeaf(ctx,bx+b.side*1.5,b.y,b.side>0?-.42-R()*.2+dr:Math.PI+.42+R()*.2-dr,s,Math.max(3,k-2),wr,back,backDark,s*.38); });
    const sway=(R()-.5)*4*sz;
    drawStem(ctx,bx,by,bx+sway*.25,by-H,Math.max(2.1,(2.4+stage*.55)*sz),sway);
    br.forEach(b=>{
      const tx=bx+Math.cos(b.a)*b.len*.62, ty=b.y+Math.sin(b.a)*b.len*.28;
      drawStem(ctx,bx,b.y,tx,ty,Math.max(1.15,(1.2+stage*.22)*(1-b.t*.4)*sz),b.side*2);
      nodeRing(ctx,bx,b.y,Math.max(1.8,(1.4+stage*.22)*sz),leafCol);
      b.tx=tx; b.ty=ty;
    });
    br.forEach(b=>{ const s=(H*.24*(1-b.t*.4)+8)*(.9+R()*.12); fanLeaf(ctx,bx+b.side*1.2,b.y+1,b.side>0?.48+R()*.18+dr:Math.PI-.48-R()*.18-dr,s,k,wr,leafCol,dark,s*.42); });
    if(!flowering){
      br.forEach(b=>fanLeaf(ctx,b.tx,b.ty,b.a+(b.side>0?dr:-dr)*.4,H*.1+6,k,wr,mix(leafCol,'#c6f08a',.18),dark,2*sz));
      fanLeaf(ctx,bx+sway*.15,by-H,-Math.PI/2+dr*.15,H*.18+6,k,wr,mix(leafCol,'#d4f6a0',.25),dark,2*sz);
      return;
    }
    const chunk=indica||(st.look&&st.look.shape==='chunky')?1.15:sativa?.82:1;
    const c2={bud:ripe?col.bud:mix(col.bud,'#8fc060',.35),budLight:ripe?col.budLight:mix(col.budLight,'#e7f6c8',.35),pistil:ripe?shade(col.pistil,-.06):'#f4f0dc',sugar:col.sugar,frost:col.frost};
    br.filter(b=>b.t>.32).slice().sort((a,b)=>b.y-a.y).forEach(b=>{
      const L=(ripe?28:16)*(1-b.t*.2)*sz*chunk, w=(ripe?9:5.5)*(1-b.t*.12)*sz*chunk;
      cola(ctx,b.tx,b.ty,-Math.PI/2+(b.a+Math.PI/2)*.22,L,w,c2,R,ripe);
    });
    cola(ctx,bx+sway*.1,by-H+6*sz,-Math.PI/2,(ripe?52:30)*sz,(ripe?13:8)*sz*chunk,c2,R,ripe);
  }
  // Procedural stand-in used until the painted sprite is ready, and if a photo canvas cannot be read.
  function thumbCanvas(st,size=96,locked=false){
    size=size||96; const c=document.createElement('canvas'); c.width=size; c.height=size; const ctx=c.getContext('2d'); if(!ctx||!st) return c;
    const g=st.game||{}, L=st.look||{}, bud=g.budColor||L.bud||'#6a9a3a';
    const grd=ctx.createRadialGradient(size/2,size*.45,4,size/2,size/2,size*.7);
    grd.addColorStop(0,mix(bud,'#0a1712',.6)); grd.addColorStop(1,'#08140f'); ctx.fillStyle=grd; ctx.fillRect(0,0,size,size);
    if(locked){ ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='800 '+Math.round(size*.22)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('???',size/2,size/2); return c; }
    const s=size/96; ctx.save(); ctx.translate(size/2,size*.98); ctx.scale(s*.62,s*.62); try{ drawPlant(ctx,st,5,0,0,1); }catch(e){} ctx.restore(); return c;
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
