/* Fills an endgame farm for camera studies. Not used in normal play. */
(function(){
  const q=new URLSearchParams(location.search), mock=q.get('mock');
  if(mock==='upgrades'){
    document.documentElement.classList.add('mock-cam','mock-upgrades');
    window.__paused=true;
    const root=document.createElement('div'); root.id='upgMock';
    root.innerHTML=`<header><h2>Upgrades</h2><p>Buy gear for each room. Harvest, water, and feed stay on the room button.</p></header>
      <div class="body" id="upgBody"></div>`;
    document.body.appendChild(root);
    const groups=[
      ['Water + feed','The garden hose unlocks Water all on the room button. Feed all is already free.',[
        ['Garden hose','Unlocks Water all for the room you are in.','$40',0,'drop'],
        ['Feed tank','One free feed at halfway. Feed all needs no purchase.','Owned',1,'water-barrel.png']
      ]],
      ['Garage','',[
        ['Clip-on fans','Air through the canopy: -15% mold, +2% quality.','Owned',1,'clip-fan.png'],
        ['Light timer','Steady photoperiod: +5% growth, -10% power.','Owned',1,'temp-meter.png'],
        ['Deep drip trays','Garage plants hold water 25% longer.','Owned',1,'boxes.png'],
        ['Garage lights','Bar-style LED: +38% growth, +15% yield.','Owned',1,'led-bar-light.png'],
        ['pH / EC meter','Dial in the feed: +5% quality.','$120',0,'ph-meter.png'],
        ['Inline fan + filter','Exhaust and odor control: -25% mold, +3% quality.','$180',0,'inline-fan.png'],
        ['Dehumidifier','-35% garage mold, +4% power.','$280',0,'dehumidifier.png'],
        ['Rosin press','Unlocks live rosin and +1 craft slot.','$1,500',0,'rosin-press.png']
      ]],
      ['Greenhouse','Daylight room. No light upgrades.',[
        ['Shade cloth','Cuts midday heat: +4% greenhouse quality.','Owned',1,'shade-cloth.png'],
        ['Swamp cooler','Exhaust fan and cooler: -40% mold, +3% quality.','$1,800',0,'swamp-cooler.png'],
        ['Hoop covers','Storm shutters. Ripe farm plants ride out the wind.','$3,500',0,'hoop-house.png'],
        ['Rain catchment','-60% water upkeep. Rain refills the terraces.','$2,500',0,'water-barrel.png']
      ]],
      ['Indoor Facility','These stay locked until the facility is built.',[
        ['LED light bars','+15% indoor growth per level.','$12.0K',0,'led-bar-light.png'],
        ['HVAC','-22% indoor mold per level, +6% quality.','$9,000',0,'dehumidifier.png'],
        ['Fertigation','Auto-feeds each indoor plant once, +10% yield.','$15.0K',0,'reservoir.png'],
        ['Veg room','Indoor plants start 15% grown.','$35.0K',0,'grow-tent.png'],
        ['Drying room','+3 drying slots and 25% faster drying.','$25.0K',0,'drying-rack.png']
      ]]
    ];
    const body=root.querySelector('#upgBody');
    groups.forEach(([title,note,cards])=>{
      const h=document.createElement('div'); h.className='section-t'; h.textContent=title; body.appendChild(h);
      if(note){ const n=document.createElement('div'); n.className='note'; n.textContent=note; body.appendChild(n); }
      cards.forEach(([name,effect,price,owned,art])=>{
        const row=document.createElement('div'); row.className='row'+(owned?'':' locked');
        const thumb=art==='drop'
          ? '<div class="thumb hose"><span class="ico ico-drop"></span></div>'
          : '<img class="thumb" alt="" src="assets/new-art/sprites/'+art+'">';
        const side=owned?'<span class="own">Owned</span>':'<button type="button" class="btn sm gold price" disabled>'+price+'</button>';
        row.innerHTML=thumb+'<div class="grow"><h4>'+name+' <span class="tag">'+(owned?'Owned':'Locked')+'</span></h4><p>'+effect+'</p></div>'+side;
        body.appendChild(row);
      });
    });
    window.__mockReady=1; window.__upgMock=1;
    return;
  }
  if(mock!=='grid'&&mock!=='iso'&&mock!=='room'&&mock!=='beds') return;
  document.documentElement.classList.add('mock-cam');
  if(mock==='beds') document.documentElement.classList.add('mock-beds');
  window.__paused=true;
  const raw=q.get('spot')||(mock==='room'?'land':mock==='beds'?'garage':'garage');
  const spot=mock==='beds'?(raw==='gh'||raw==='greenhouse'?'gh':raw==='indoor'||raw==='land'||raw==='in'?'indoor':'garage'):raw;
  const zone=mock==='beds'?(spot==='indoor'?'field':spot==='gh'?'gh':'garage'):(spot==='land'?'field':spot==='gh'?'gh':'garage');
  if(mock==='room'||mock==='beds'){
    const nav=document.createElement('nav'); nav.id='roomTabs';
    const tabs=mock==='beds'?[['garage','Garage'],['gh','Greenhouse'],['indoor','Indoor Facility']]:[['garage','Garage'],['land','Land'],['gh','Greenhouse']];
    tabs.forEach(([id,label])=>{
      const b=document.createElement('button'); b.type='button'; b.textContent=label; if(id===spot) b.className='on';
      b.onclick=()=>{ location.search='?mock='+mock+'&spot='+id; }; nav.appendChild(b);
    });
    document.body.appendChild(nav);
  }
  if(mock==='beds'){
    const fab=document.createElement('div'); fab.id='qaFab';
    fab.innerHTML=`<div class="qa-pop">
        <button type="button" class="go"><span class="ico ico-scythe"></span>Harvest all</button>
        <button type="button" class="locked" disabled><span class="ico ico-lock"></span>Water all<small>Needs garden hose</small></button>
        <button type="button" class="feed"><span class="ico ico-feed"></span>Feed all</button>
      </div>
      <button type="button" class="qa-main" aria-label="Harvest, water, and feed"><span class="ico ico-up"></span></button>`;
    fab.querySelector('.qa-main').onclick=()=>fab.classList.toggle('open');
    if(q.get('qa')==='open') fab.classList.add('open');
    document.body.appendChild(fab);
    const bar=document.getElementById('toolbar');
    if(bar){ const top=bar.getBoundingClientRect().top; if(top>40) fab.style.bottom=(innerHeight-top+8)+'px'; }
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
