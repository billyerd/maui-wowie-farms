/* Procedural art: plants (fan leaves, colas, pistils, trichomes), tropical foliage, thumbnails. */
window.Art = (function(){
  const TAU=Math.PI*2;
  function rng(seed){ let s=seed>>>0||1; return ()=>((s=Math.imul(s^s>>>15,1|s),s^=s+Math.imul(s^s>>>7,61|s),((s^s>>>14)>>>0)/4294967296)); }
  function hash(str){ let h=2166136261; for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; }
  function hex(c){ if(c.startsWith('rgb')) return c.match(/\d+/g).slice(0,3).map(Number); c=c.replace('#',''); return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)]; }
  function mix(a,b,t){ const A=hex(a),B=hex(b); return 'rgb('+A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')+')'; }
  function shade(a,amt){ return amt>0?mix(a,'#ffffff',amt):mix(a,'#000000',-amt); }

  // One serrated leaflet along +x of length L and half-width W
  function leaflet(ctx,L,W,serr){
    const n=serr; ctx.beginPath(); ctx.moveTo(0,0);
    for(let i=1;i<=n;i++){ const t=i/n, w=Math.sin(Math.PI*Math.pow(t,.8))*W*(1-.15*t); const x=t*L; ctx.lineTo(x-L/n*.5,-w*.82); ctx.lineTo(x,-w); }
    ctx.lineTo(L,0);
    for(let i=n;i>=1;i--){ const t=i/n, w=Math.sin(Math.PI*Math.pow(t,.8))*W*(1-.15*t); const x=t*L; ctx.lineTo(x,w); ctx.lineTo(x-L/n*.5,w*.82); }
    ctx.closePath();
  }
  // Fan leaf: k leaflets fanning around angle
  function fanLeaf(ctx,x,y,ang,size,k,wr,col,dark,pet=0){
    ctx.save(); ctx.translate(x,y); ctx.rotate(ang);
    if(pet){ ctx.strokeStyle=dark; ctx.lineWidth=Math.max(1,size*.05); ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(pet*.5,-pet*.15,pet,0); ctx.stroke(); ctx.translate(pet,0); }
    const spread=Math.PI*(k>=7?.78:.7);
    for(let j=0;j<k;j++){
      const t=k===1?0:(j/(k-1)-.5), a=t*spread, len=size*(1-Math.abs(t)*1.15);
      if(len<size*.15) continue;
      ctx.save(); ctx.rotate(a);
      const g=ctx.createLinearGradient(0,-len*wr,0,len*wr); g.addColorStop(0,dark); g.addColorStop(.5,col); g.addColorStop(1,dark);
      ctx.fillStyle=g; leaflet(ctx,len,len*wr,12); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.28)'; ctx.lineWidth=Math.max(.6,len*.025); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len*.95,0); ctx.stroke();
      ctx.strokeStyle='rgba(18,42,12,.35)'; ctx.lineWidth=Math.max(.35,len*.012);
      for(let s=1;s<=4;s++){ const t=s/5, px=len*t, wy=Math.sin(Math.PI*Math.pow(t,.8))*len*wr*.55; ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px+len*.08,wy); ctx.moveTo(px,0); ctx.lineTo(px+len*.08,-wy); ctx.stroke(); }
      ctx.restore();
    }
    ctx.fillStyle=dark; ctx.beginPath(); ctx.arc(0,0,size*.05,0,TAU); ctx.fill();
    ctx.restore();
  }
  // Cola: stacked calyx clusters along a direction, tapering to the tip
  function cola(ctx,x,y,ang,len,wid,c,R,ripe){
    const dx=Math.cos(ang), dy=Math.sin(ang), n=Math.max(5,Math.round(len/wid*3.2));
    const blobs=[];
    for(let i=0;i<n;i++){ const u=i/(n-1); const r=wid*(1-.5*u)*(.8+R()*.35); const px=x+dx*len*u+(R()-.5)*wid*.5, py=y+dy*len*u+(R()-.5)*wid*.3; blobs.push([px,py,r]); }
    // sugar leaves behind
    ctx.fillStyle=c.sugar;
    for(let i=0;i<n;i+=1){ const [px,py,r]=blobs[i]; for(const sd of [-1,1]){ if(R()<.5) continue; ctx.save(); ctx.translate(px,py); ctx.rotate(ang+sd*(1.1+R()*.5)); leaflet(ctx,r*1.5,r*.28,5); ctx.fill(); ctx.restore(); } }
    for(const [px,py,r] of blobs){
      const g=ctx.createRadialGradient(px-r*.35,py-r*.35,r*.1,px,py,r);
      g.addColorStop(0,c.budLight); g.addColorStop(.6,c.bud); g.addColorStop(1,shade(c.bud,-.4));
      ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(px,py,r,r*.9,ang,0,TAU); ctx.fill();
      // calyx bumps
      ctx.fillStyle='rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(px-r*.3,py-r*.3,r*.35,0,TAU); ctx.fill();
    }
    ctx.strokeStyle=c.pistil; ctx.lineCap='round'; ctx.lineWidth=Math.max(.7,wid*.08);
    for(const [px,py,r] of blobs){ for(let k=0;k<3;k++){ const a=R()*TAU; const sx=px+Math.cos(a)*r*.6, sy=py+Math.sin(a)*r*.6;
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.quadraticCurveTo(sx+Math.cos(a)*r*.5,sy+Math.sin(a)*r*.2-r*.3,sx+Math.cos(a)*r*.7+(R()-.5)*r*.4,sy-r*.45); ctx.stroke(); } }
    const fr=ripe?1:.45;
    for(const [px,py,r] of blobs){ for(let k=0;k<7*fr;k++){ const a=R()*TAU,d=Math.sqrt(R())*r; ctx.fillStyle='rgba(255,255,255,'+(.45+R()*.5)+')'; ctx.beginPath(); ctx.arc(px+Math.cos(a)*d,py+Math.sin(a)*d,Math.max(.5,wid*.05),0,TAU); ctx.fill(); } }
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
    const leaf=st.type==='Sativa'?'#4f9e36':st.type==='Indica'?'#2c6e30':'#3c8434';
    return {bud,budLight,pistil,leaf,sugar:mix(leaf,budColor,strong?.45:.15),leafLate:purple?mix(leaf,budColor,.4):mix(leaf,'#b9a83a',.22),frosty};
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
  function drawPlant(ctx,st,stage,bx,by,sz,droop=0){
    const R=rng(hash(st.id)+stage*7); const col=plantColors(st);
    const k=st.type==='Sativa'?7:st.type==='Indica'?7:7;
    const wr=st.type==='Sativa'?.12:st.type==='Indica'?.21:.16;
    if(stage===0){
      ctx.fillStyle='#5a3c22'; ctx.beginPath(); ctx.ellipse(bx,by-1,11,4,0,0,TAU); ctx.fill();
      ctx.strokeStyle='#6fb24a'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(bx,by-2); ctx.lineTo(bx,by-9); ctx.stroke();
      ctx.fillStyle='#9ad870'; ctx.beginPath(); ctx.ellipse(bx-5,by-10,5,2.4,-.4,0,TAU); ctx.ellipse(bx+5,by-10,5,2.4,.4,0,TAU); ctx.fill(); return;
    }
    const H=[0,40,78,118,148,160][stage]*sz;
    const nodes=[0,2,3,4,5,5][stage];
    let leafCol=stage>=5?col.leafLate:stage===4?mix(col.leaf,col.leafLate,.4):col.leaf; if(droop) leafCol=mix(leafCol,'#a9a043',.38);
    const dark=shade(leafCol,-.38), back=shade(leafCol,-.22), backDark=shade(leafCol,-.5);
    const flowering=stage>=4, ripe=stage>=5;
    const br=[];
    for(let i=0;i<nodes;i++){ const t=nodes===1?.5:i/(nodes-1); const y=by-H*(.14+.66*t); const len=H*(.40*(1-t)+.12);
      for(const side of [-1,1]){ const a=-Math.PI/2+side*(.78-.3*t)+(R()-.5)*.12; br.push({t,y,side,len,a,tx:bx+Math.cos(a)*len,ty:y+Math.sin(a)*len}); } }
    // back fan leaves (behind stem)
    const dr=droop*.75; br.forEach(b=>{ const s=(H*.30*(1-b.t*.45)+10)*(.85+R()*.25); fanLeaf(ctx,bx+b.side*3,b.y,b.side>0?-.25-R()*.35+dr:Math.PI+.25+R()*.35-dr,s*.92,k,wr,back,backDark,s*.45); });
    // stem + branches
    ctx.lineCap='round'; ctx.strokeStyle='#4f7f30'; ctx.lineWidth=2.4+stage*.9;
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.quadraticCurveTo(bx+(R()-.5)*6,by-H*.5,bx,by-H); ctx.stroke();
    br.forEach(b=>{ ctx.lineWidth=1.4+stage*.45*(1-b.t); ctx.beginPath(); ctx.moveTo(bx,b.y); ctx.quadraticCurveTo(bx+b.side*b.len*.25,b.y-b.len*.15,b.tx,b.ty); ctx.stroke(); });
    // front fan leaves drooping out from nodes
    br.forEach(b=>{ const s=(H*.27*(1-b.t*.5)+9)*(.85+R()*.25); fanLeaf(ctx,bx+b.side*2,b.y+2,b.side>0?.3+R()*.3+dr:Math.PI-.3-R()*.3-dr,s,k,wr,leafCol,dark,s*.5); });
    if(!flowering){
      br.forEach(b=>fanLeaf(ctx,b.tx,b.ty,b.a+(b.side>0?dr:-dr)*.8,H*.13+5,k,wr,mix(leafCol,'#b8f070',.15),dark));
      fanLeaf(ctx,bx,by-H,-Math.PI/2,H*.18+6,k,wr,mix(leafCol,'#c0f080',.25),dark);
      return;
    }
    // colas at branch tips + main top cola
    const c2={...col,bud:ripe?col.bud:mix(col.bud,'#8fc060',.4),budLight:ripe?col.budLight:mix(col.budLight,'#e0f7c0',.3),pistil:ripe?shade(col.pistil,-.12):'#f4f0e0'};
    br.sort((a,b)=>b.y-a.y).forEach(b=>{ const L=(ripe?34:22)*(1-b.t*.3)*sz, w=(ripe?10:6.5)*(1-b.t*.22)*sz; cola(ctx,b.tx+Math.cos(b.a)*-3,b.ty+Math.sin(b.a)*-3,-Math.PI/2+(b.a+Math.PI/2)*.35,L,w,c2,R,ripe); });
    cola(ctx,bx,by-H+12,-Math.PI/2,(ripe?58:38)*sz,(ripe?14:9.5)*sz,c2,R,ripe);
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
  return {plantColors,cola,rng,hash,mix,shade,plantSprite,thumb,thumbCanvas,palm,monstera,hibiscus,banana,fanLeaf,drawPlant};
})();
