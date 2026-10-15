/* Fills an endgame farm for camera studies. Not used in normal play. */
(function(){
  const q=new URLSearchParams(location.search), mock=q.get('mock');
  if(mock!=='grid'&&mock!=='iso'&&mock!=='room'&&mock!=='beds') return;
  document.documentElement.classList.add('mock-cam');
  if(mock==='beds') document.documentElement.classList.add('mock-beds');
  window.__paused=true;
  const spot=q.get('spot')||(mock==='room'||mock==='beds'?'land':'garage'), zone=spot==='land'?'field':spot==='gh'?'gh':'garage';
  if(mock==='room'||mock==='beds'){
    const nav=document.createElement('nav'); nav.id='roomTabs';
    [['garage','Garage'],['land','Land'],['gh','Greenhouse']].forEach(([id,label])=>{
      const b=document.createElement('button'); b.type='button'; b.textContent=label; if(id===spot) b.className='on';
      b.onclick=()=>{ location.search='?mock='+mock+'&spot='+id; }; nav.appendChild(b);
    });
    document.body.appendChild(nav);
  }
  const ids=['maui-wowie','granddaddy-purple','northern-lights','durban-poison','kauai-electric'];
  function arm(){
    if(!window.G||!G.st||!G.UPG) return setTimeout(arm,40);
    const st=G.st;
    st.level=30; st.land=true; st.ghBuilt=true; st.permit=true; st.phenoRoom=true;
    st.garage=G.GARAGE.length-1; st.field=G.FIELD.length-1; st.gh=G.GH.length-1;
    st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0}; st.questDone=true;
    if(st.settings) st.settings.motion=false;
    st.loc=zone==='garage'?'garage':'farm';
    for(const k in G.UPG) st.upg[k]=G.UPG[k].max||1;
    G.syncPlots();
    let n=0;
    st.plots.forEach(p=>{
      if(p.zone!==zone||!p.owned) return;
      const id=ids[n%ids.length]; n++;
      if(G.discover) G.discover(id,true);
      st.discovered[id]=true;
      p.strain=id; p.prog=.9; p.water=1; p.food=1; p.pest=null; p.q=1;
    });
    window.__paused=true; window.__mockReady=n;
  }
  arm();
})();
