/* Core simulation, economy, progression, save/load, offline catch-up. No DOM here except events.
   Progression: Garage tent (home lot) -> buy land (farm: terraces) -> outdoor greenhouse -> indoor facility.
   Every location keeps producing. Grow times run 30 s .. 3 days (see data/strains.json game.growSec). */
window.G = (function(){
  const S = window.STRAINS, BY = {}; S.forEach(s=>BY[s.id]=s);
  // ---------- REAL-WORLD ECONOMY (see ECONOMY.md / SOURCES.md) ----------
  // 1 "bud" in the game = one eighth (3.5 g). Dry price per eighth runs from ~$9 (starter strains, wholesale-ish) to ~$32 (top exotics);
  // curing (x1.45) and A grade (x1.25) take it to Hawaii dispensary shelf prices ($40-65 an eighth). Seeds cost like real feminized seeds ($6-25).
  // Yield per plant is in eighths (a garage tent plant 1.5-4 oz). Time is compressed: one grow takes minutes, not months, so grow
  // times are squashed for slow late strains (they were up to 45 h), and XP per harvest is scaled with the grow time so levelling pace stays the same.
  const ECON={yield:.1, startCash:120, xp:.07};
  S.forEach(x=>{ const g=x.game; if(g._real) return; g._real=1; const t=Math.min(1,Math.max(0,(g.unlockLevel-1)/20)); let h=0; for(const c of x.id) h=(h*31+c.charCodeAt(0))>>>0; const v=.92+(h%17)/100;
    const old=g.growSec, comp=old<=300?old:Math.round(300*Math.pow(old/300,.25));
    // END GAME pacing: Legendary grows take 1-3 REAL days (the catalog's original times), Epic takes 2-8 real hours; the rest stay compressed.
    g.growSec=x.tier>=4?Math.max(86400,Math.min(259200,old)):x.tier===3?Math.round(Math.max(7200,Math.min(28800,old*.25))):comp; g._comp=comp;
    g.waitMult=x.tier>=3?Math.pow(g.growSec/comp,.88):1;   // long grows pay much more per plant (worth the wait): per real hour roughly on par with fast strains, without the check-ins
    g.xp=Math.max(1,Math.round(g.xp*Math.min(1,comp/old)*g.waitMult));
    g.budValue=Math.round((9+23*Math.pow(t,.9))*v*100)/100; g.realEighths=Math.round(12+20*t); g.buds=Math.round(g.realEighths*ECON.yield*g.waitMult*100)/100; g.seedCost=Math.round((6+19*t)*v*100)/100; g.payout=Math.round(g.budValue*g.buds); });
  const CFG = window.GAME_CONFIG;
  const F = CFG.features||{};   // held mechanics (see config.js); all default off
  const DAY_LEN = 3600;           // REAL TIME: 1 real hour = 1 in-game day (24-day island year = 1 real day). st.time is derived from the wall clock (st.t0)
  const TIERN = ['Common','Uncommon','Rare','Epic','Legendary'];
  const STAGE_MULT = {wet:.4, dry:1, cured:1.45};
  // ---------- locations / zones ----------
  // up: upkeep as a fraction of the plant's dried value, charged as the plant grows (cost per cycle).
  const ZONE = {
    garage:{loc:'garage', name:'Garage buckets',      yield:1.00, up:{power:.12, fan:.02}},
    // dens: plants per old 'spot' are now realistic (terrace patch 10 at ~1.1 m, greenhouse bed 3 at ~0.6 m); yield, seed use and XP per plant
    // scale by dens so a full patch earns the same as before (economy + timings unchanged)
    field: {loc:'farm',   name:'Terrace plots',    yield:1.15*.3, dens:.3, up:{water:.02}, outdoor:1},
    gh:    {loc:'farm',   name:'Greenhouse beds',  yield:1.35/3, dens:1/3, up:{water:.03, upkeep:.03}, outdoor:.5},
    in:    {loc:'indoor', name:'Indoor facility',  yield:2.00, up:{power:.30, climate:.10}, aaa:true},
  };
  // garage: 100 W LED per plant, 4 wk veg at 18 h + 9 wk flower at 12 h = 126 kWh -> $43; fan 25 W shared -> $5
  // field: ~3 gal/day x 120 days = 360 gal -> $2. greenhouse: water $3 + vents/fans/film $10
  // indoor: 120 W/plant lighting (150 kWh) $51, HVAC + dehumidifier ~40% of lighting $21.
  // Nutrient salts used to be $8 per indoor grow. Feeding is now one free action per plant, so that line is not billed.
  // The nutrients key stays at 0 so an old save or a stray lookup still resolves.
  const UPK_REAL={garage:{power:43,fan:5}, field:{water:2}, gh:{water:3,upkeep:10}, in:{power:51,climate:21,nutrients:0}};
  const UPK_NAME={power:'Electricity',fan:'Fan + filter',water:'Water',upkeep:'Glass + vents upkeep',climate:'AC + dehumidifier',nutrients:'Nutrients',fixed:'Rent + insurance'};
  const LOCS=['garage','farm','indoor'];
  const LOC_NAME={get garage(){ return locName('garage'); },farm:'Greenhouse',indoor:'Indoor'};
  function locName(l){ if(l!=='garage') return {farm:'Greenhouse',indoor:'Indoor'}[l]; const r=st?garageRole():'grow'; return r==='pheno'?'Pheno Room':r==='storage'?'Garage storage':'Garage'; }
  // Garage buckets. A new game starts at 5 and each upgrade adds 3, landing on 20.
  // Costs sum to the old path's $3,590 (2→25) so filling the garage still costs the same.
  // Plot records stay g0–g24 so an older save keeps every plant and its id. Buys stop at 20.
  const GARAGE_MAX=20;
  const GARAGE=[
    {name:'Five buckets on a grow table', cap:5,  cost:0,    desc:'Five 5-gal buckets on a grow table under a hanging LED bar'},
    {name:'Eight buckets',                cap:8,  cost:150,  desc:'+3 buckets. The garage holds 8.'},
    {name:'Eleven buckets',               cap:11, cost:280,  desc:'+3 buckets. The garage holds 11.'},
    {name:'Fourteen buckets',             cap:14, cost:520,  desc:'+3 buckets. The garage holds 14.'},
    {name:'Seventeen buckets',            cap:17, cost:960,  desc:'+3 buckets. The garage holds 17.'},
    {name:'Twenty buckets (garage max)',  cap:20, cost:1680, desc:'+3 buckets. Hard max 20.'},
  ];
  const LAND_COST=12000, LAND_LEVEL=3;
  const FIELD=[{name:'Starter terrace (10 plants)',add:10,cost:0},{name:'East terrace',add:10,cost:3000},{name:'Lower terrace',add:10,cost:6000},{name:'Ocean-view terrace',add:10,cost:9000}];
  const GH_BUILD={cost:12000, level:4};
  const GH=[{name:'Bay 1 (3 raised beds, 9 plants)',add:9,cost:0},{name:'Bay 2 (+3 beds)',add:9,cost:1500},{name:'Bay 3 (+3 beds)',add:9,cost:2500},{name:'Bay 4 (+3 beds, full house)',add:9,cost:4000}];
  // balance (QC econ report 2026-10-12): foundation is a level 10-12 cash sink paid before the build
  const INDOOR={level:11, permitCost:100000, permitLevel:9, build:300000, foundCost:250000, foundLevel:9, ghBeds:12, ghPlants:36};
  const BENCH=[{name:'Back bench (8 pots)',add:8,cost:0},{name:'Middle bench',add:8,cost:40000},{name:'Front bench',add:8,cost:80000},{name:'Vertical rack tier (2nd level)',add:8,cost:250000}];
  // ---------- upgrades ----------
  // loc: which tab lists it. Watering + feeding lines are farm-wide.
  const UPG = {
    water:   {loc:'all', name:'Watering', steps:['Watering can','Garden hose','Drip lines','Irrigation timer','Smart irrigation'], costs:[0,40,400,3000,15000],
              descs:['Water plants one by one','Unlocks Water all for the current location','Water lasts 60% longer','Auto-waters thirsty plants every 20s, everywhere','Fully automatic: plants never go thirsty, +3% quality']},
    nutes:   {loc:'all', name:'Feeding', steps:['Hand feeding','Feed tank','Auto-doser','Premium lines'], costs:[0,0,900,4000],
              descs:['Each plant needs one free feed, at the halfway mark','Puts a feed tank in the garage. Feed all is free and needs no purchase','Feeds each plant once, automatically, when it reaches halfway','+15% yield and +5% quality on every plant']},
    // --- garage gear ---
    light:   {loc:'garage', name:'Garage lights', steps:['CFL bulbs','Blurple LED panel','Quantum board LED','Bar-style LED'], costs:[0,90,350,750],
              descs:['Cheap, hot, weak','+12% growth, +5% yield','+25% growth, +10% yield, runs cooler','+38% growth, +15% yield, most efficient per watt']},
    fan:     {loc:'garage', name:'Inline fan + carbon filter', desc:'Exhaust + odor control: -25% garage mold and pests, +3% quality', base:180, mul:1, max:1},
    oscfan:  {loc:'garage', name:'Clip-on oscillating fans', desc:'Air movement through the canopy: -15% mold, +2% quality', base:30, mul:1, max:1},
    dehu:    {loc:'garage', name:'Dehumidifier', desc:'-35% garage mold (Kauai humidity!)', base:280, mul:1, max:1},
    timer:   {loc:'garage', name:'Light timer', desc:'Steady photoperiod: +5% growth', base:15, mul:1, max:1},
    phkit:   {loc:'garage', name:'pH / EC meter kit', desc:'Dial in the feed: +5% quality (better grades)', base:120, mul:1, max:1},
    trays:   {loc:'garage', name:'Deep drip trays', desc:'Bigger drip trays under every bucket: garage plants hold water 25% longer', base:25, mul:1, max:1},
    // --- greenhouse gear ---
    beds:    {loc:'farm', name:'Raised beds + compost', desc:'+20% greenhouse and terrace yield per level', base:1500, mul:2.6, max:3, need:'land'},
    shade:   {loc:'farm', name:'Shade cloth (30%)', desc:'Cuts midday heat: +4% greenhouse quality, sunny days no longer dry plants faster', base:350, mul:1, max:1, need:'gh'},
    lightdep:{loc:'farm', name:'Light-dep blackout tarps', desc:'Force flowering on schedule: +15% greenhouse growth per level (Lv3-4: automated light-dep greenhouse roof)', costs:[0,1200,3360,90000,180000], need:'gh'},   // Lv3-4 = level 9-11 cash sink
    loupe:   {loc:'farm', name:'Jeweler\'s loupe', desc:'Bigger Inspect lens, and hidden eggs show as orange dots on screen while you inspect', base:40, mul:1, max:1},
    cooler:  {loc:'farm', name:'Exhaust fans + swamp cooler', desc:'-40% greenhouse mold, +3% quality', base:1800, mul:1, max:1, need:'gh'},
    catch:   {loc:'farm', name:'Catchment tank', desc:'Terraces and greenhouse beds hold water about 40% longer.', base:2500, mul:1, max:1, need:'land'},
    supp:    {loc:'farm', name:'Supplemental lights', desc:'Greenhouse keeps growing at night', base:4500, mul:1, max:1, need:'gh'},
    shutters:{loc:'farm', name:'Storm shutters + hoop covers', desc:'Trade-wind storms no longer hurt ripe farm plants', base:3500, mul:1, max:1, need:'land'},
    // --- indoor facility gear ---
    led:     {loc:'indoor', name:'LED light bars', desc:'+15% indoor growth per level', base:12000, mul:2.5, max:4, need:'in'},
    hvac:    {loc:'indoor', name:'HVAC (ducted mini-splits)', desc:'-22% indoor mold per level, +6% quality', base:9000, mul:2.5, max:3, need:'in'},
    co2:     {loc:'indoor', name:'CO2 enrichment', desc:'+20% indoor growth (sealed room)', base:6000, mul:1, max:1, need:'in'},
    fert:    {loc:'indoor', name:'Fertigation system', desc:'Auto-feeds each indoor plant once, at the halfway mark, and +10% indoor yield', base:15000, mul:1, max:1, need:'in'},
    veg:     {loc:'indoor', name:'Veg room', desc:'Plants move in pre-vegged: indoor plants start 15% grown', base:35000, mul:1, max:1, need:'in'},
    clone:   {loc:'indoor', name:'Clone + mother room', desc:'Cut clones instead of buying seeds: -40% seed prices, +10% head start indoors', base:20000, mul:1, max:1, need:'in'},
    labPollen:{loc:'garage', name:'Pollen chamber', desc:'Clean pollen storage: crosses finish 15% faster per level', base:80000, mul:3, max:3, need:'lab'},
    labTissue:{loc:'garage', name:'Tissue culture bench', desc:'Pheno grow-outs (line stabilizing) finish 20% faster per level', base:120000, mul:3, max:3, need:'lab'},
    labSeq:  {loc:'garage', name:'Genetic sequencer', desc:'Every finished pheno hunt also gives a hint token', base:500000, mul:1, max:1, need:'lab'},
    dryroom: {loc:'indoor', name:'Drying + cure room', desc:'+3 drying slots and 25% faster drying and curing', base:25000, mul:1, max:1, need:'in'},
    solar:   {loc:'indoor', name:'Solar roof', desc:'+6% indoor growth per level (Kauai sun!)', base:45000, mul:2.6, max:3, need:'in'},
    // --- processing / sales ---
    dryer:   {loc:'all', name:'Drying racks', desc:'+1 drying slot and 12% faster drying per level', base:60, mul:2.3, max:8},
    cure:    {loc:'all', name:'Curing jars', desc:'Dried buds cure automatically (+45% value). Faster each level', base:150, mul:2.6, max:4},
    press:   {loc:'all', name:'Rosin press', desc:'Heat + pressure, no solvents: unlocks Live rosin crafting and +1 craft slot', base:1500, mul:1, max:1, lvl:10},
    kitchen: {loc:'all', name:'Licensed commercial kitchen', desc:'Permitted kitchen for infused edibles: unlocks edibles and +1 craft slot', base:150000, mul:1, max:1, lvl:14},
    sign:    {loc:'all', name:'Sale sign', desc:'+8% sale prices per level', base:500, mul:1.8, max:6},
  };
  // Managers (one per location) + two farm-wide helpers.
  const WORKERS_ALL = {
    farmhand:{loc:'all', name:'Kai the farmhand', desc:'Harvests, replants, waters, feeds and treats plants in every location you own. One-time hire, no wages.', base:300, mul:1, max:3, level:2, once:true},
    mgrG:    {loc:'garage', name:'Kai, garage manager', desc:'Harvests, replants, waters and treats the garage. One-time hire, no wages.', base:300, mul:1, max:3, level:2, once:true},
    mgrF:    {loc:'farm',   name:'Malia, farm manager', desc:'Harvests, replants, waters and treats terraces + greenhouse. One-time hire, no wages.', base:4000, mul:1, max:3, level:7, need:'land', once:true},
    mgrI:    {loc:'indoor', name:'Nick, indoor manager', desc:'Harvests, replants, waters and treats the indoor facility. One-time hire, no wages.', base:30000, mul:1, max:3, level:12, need:'in', once:true},
    runner:  {loc:'all', name:'Leilani the runner', desc:'Carries fresh harvests to the drying racks. One-time hire, no wages.', base:1200, mul:1, max:3, level:5, once:true},
    merchant:{loc:'all', name:'Noa the merchant', desc:'Sells dried and cured buds when prices are fair or better. One-time hire, no wages.', base:4000, mul:1, max:3, level:6, once:true},
  };
  const WORKERS = Object.fromEntries(Object.entries(WORKERS_ALL).filter(([k])=>F.managers?k!=='farmhand':!/^mgr/.test(k)));
  const WEATHER = {
    sunny:{name:'Sunny', out:1.3, w:.46}, vog:{name:'Vog haze', out:.9, w:.04}, partly:{name:'Partly cloudy', out:1.0, w:.22},
    rain:{name:'Rain showers', out:.9, w:.2, waters:true}, storm:{name:'Trade-wind storm', out:.55, w:.08, waters:true},
  };
  // ---------- story arc (goal chain) ----------
  const QUESTS = ([
    {id:'plant',  who:'Unko Kuli', t:'Plant a seed in a garage bucket: open your seed bag, then tap a bucket', r:{cash:5}},
    {id:'water',  who:'Unko Kuli', t:'Water your plant (tap it, or use the Water tool)', r:{cash:5}},
    {id:'harvest',who:'Unko Kuli', t:'Harvest a ripe plant', r:{cash:10}},
    {id:'dry',    who:'Unko Kuli', t:'Load fresh buds onto the drying racks (Dry & Cure)', r:{cash:10}},
    {id:'sell',   who:'Unko Kuli', t:'Sell buds at the Market', r:{gems:10}},
    {id:'gcap',   who:'Unko Kuli', t:'Garage: add buckets to your grow table (Upgrades > Garage)', r:{cash:30}},
    {id:'feed',   who:'Unko Kuli', t:'Feed a plant once it is halfway grown', r:{cash:20}},
    {id:'hose',   who:'Unko Kuli',  t:'Buy a garden hose (Upgrades > Water + feed)', r:{cash:40}},
    {id:'order',  who:'Unko Kuli',  t:'Sell a harvest at the Market', r:{gems:10}},
    {id:'tent3',  who:'Unko Kuli',  t:'Add more garage buckets (Upgrades > Garage). Each upgrade is +3, up to 20.', r:{cash:80}},
    {id:'land',   who:'Uncle Ikaika', t:'Save up and buy the family land on the hill', r:{gems:25}},
    {id:'field',  who:'Uncle Ikaika', t:'Plant on the starter terrace', r:{cash:150}},
    {id:'ghbuild',who:'Malia',t:'Build the outdoor greenhouse', r:{gems:20}},
    {id:'mgr',    who:'Kai',  t:'Plant a seed in a greenhouse bed', r:{gems:15}},
    {id:'breed',  who:'Malia',t:'Try a crossbreed in the Pheno Room', r:{hints:1}},
    {id:'craft',  who:'Unko Kuli',t:'Press your first bubble hash (Dry & Cure > Craft)', r:{gems:15}},
    {id:'ghfull', who:'Malia',t:'Expand the greenhouse to all 12 beds', r:{gems:30}},
    {id:'permit', who:'Auntie Lani', t:'Get the County Agricultural Permit', r:{gems:20}},
    {id:'indoor', who:'Keoni',t:'Build the indoor facility', r:{gems:40}},
    {id:'inharv', who:'Keoni',t:'Harvest a plant grown indoors', r:{hints:2}},
    {id:'pheno',  who:'Malia',t:'Discover a mystery strain by crossbreeding', r:{gems:50}},
    {id:'earn',   who:'Unko Kuli', t:'Earn $2,000,000 in one season', r:{gems:80}},
    {id:'season', who:'Unko Kuli', t:'Start a New Season (prestige)', r:{gems:100}},
  ]).filter(q=>F.orders||q.id!=='order');
  const ev = {}; function on(n,f){(ev[n]=ev[n]||[]).push(f);} function emit(n,a){ piggyHook(n); (ev[n]||[]).forEach(f=>f(a));}

  let st;
  function freshPlots(){
    const P=[]; const mk=(zone,pre,n,c0)=>{ for(let i=0;i<n;i++) P.push({id:pre+i,zone,loc:ZONE[zone].loc,idx:i,c:c0+i,r:0,owned:false,strain:null,prog:0,water:0,food:0,q:1,readyT:0,last:null,pest:null}); };
    mk('garage','g',25,0); mk('field','f',40,100); mk('gh','h',36,200); mk('in','i',32,300); // g0–g24 stay so an old 25-pot garage keeps its ids
    return P;
  }
  // Anonymous support id. Random, stored on the save, never derived from a name or the farm.
  function mintPlayerId(){
    const bytes=new Uint8Array(6); let ok=false;
    try{ if(typeof crypto!=='undefined'&&crypto.getRandomValues){ crypto.getRandomValues(bytes); ok=true; } }catch(e){}
    if(!ok){ for(let i=0;i<bytes.length;i++) bytes[i]=Math.floor(Math.random()*256); }
    let hex=''; for(let i=0;i<bytes.length;i++) hex+=bytes[i].toString(16).padStart(2,'0');
    return 'p-'+hex;
  }
  function playerIdOk(id){ return typeof id==='string'&&/^p-[0-9a-f]{12}$/.test(id); }
  function newState(keep){
    const s={
      v:2, econ:2, cash:ECON.startCash, gems:20, xp:0, level:1, lifetime:0, runEarn:0, rebirths:0, mana:0, manaSpent:{},
      garage:0, garageV:3, garageKeep:0, land:false,   // 5 starting buckets
 field:0, ghBuilt:false, gh:0, permit:false, inBuilt:false, bench:0, loc:'garage', room:'garage',
      plots:freshPlots(), seeds:{'northern-lights':4}, selSeed:'northern-lights',
      inv:{wet:{},dry:{},cured:{}}, dryer:[], upg:{}, workers:{}, discovered:{}, clones:{},
      market:{f:{},hist:{},hot:null,hotT:-150,next:0}, weather:{type:'sunny',t:0,dur:90,rainbow:0},
      time:DAY_LEN*.3, t0:Date.now()-DAY_LEN*.3*1000, tv:2, phenoRoom:false, breedLab:false, hunt:null, keepers:{}, cuts:[], cutSeeds:{}, quest:0, questDone:false, tut:{v:1,step:0,on:false,done:false,skip:false,bought:0}, stats:{harvests:0,sold:0,bred:0,inHarv:0,plant:0,water:0,feed:0,dryLoads:0,cured:0,golden:0,mutants:0,lucky:0,legHarv:0,streakMax:0,orders:0,customers:0,phenos:0},
      streak:{n:0,last:null}, dq:null, wq:null, ach:{}, event:{id:null,t:0,next:240},
      pass2x:false, vip:false, cos:{own:{},eq:{}}, mgrSlot:false, boosts:{grow:0,price:0,pheno:0}, lines:{}, piggy:{g:0,cracked:0}, theme:'classic', themes:{classic:true}, rarePacks:0, legPacks:0,
      breed:null, lastSave:Date.now(), settings:{music:true,sfx:true,hq:true}, upkeepPaid:0, upkeepWarn:{},
      harv:{}, sets:{}, rep:0, orders:[], orderT:5, cust:[], custT:40, hints:0, hintRev:{}, tried:{}, fails:0, recipes:{}, playT:0, gecko:{next:150,on:null,boost:null}, craft:[], goods:{}, fest:{}, lb:{},
    };
    S.forEach(x=>{ if(x.tier===0) s.discovered[x.id]=true; s.market.f[x.id]=.85+Math.random()*.3; s.market.hist[x.id]=[]; });
    if(keep) Object.assign(s,keep);
    if(!playerIdOk(s.pid)) s.pid=mintPlayerId();
    return s;
  }
  function supportId(){
    if(!st) return '';
    const prev=st.pid;
    if(!playerIdOk(prev)) st.pid=mintPlayerId();
    if(st.pid!==prev&&!st._holdSave) save();
    return st.pid;
  }
  // ---------- helpers ----------
  const strain=id=>BY[id];
  // once: the first level is the only cash price. Later levels are free (workers: no wages, no repeat hire fee).
  const cost=(def,lvl)=>def.once?(lvl>0?0:Math.round(def.base)):def.costs?def.costs[lvl+1]:Math.round(def.base*Math.pow(def.mul,lvl));
  const maxLv=d=>d.costs?d.costs.length-1:d.max;
  const lv=k=>st.upg[k]||0;
  const wk=k=>st.workers[k]||0;
  const mana=k=>F.prestigeTree?(st.manaSpent[k]||0):0;
  function fmt(n){ if(n<0) return '-'+fmt(-n); if(n<100&&n%1>.004) return '$'+n.toFixed(2); n=Math.floor(n); if(n<1e4) return '$'+n.toLocaleString('en-US'); const u=['','K','M','B','T','Qa']; let i=0; let v=n; while(v>=1000&&i<u.length-1){v/=1000;i++;} return '$'+(v<100?v.toFixed(v<10?2:1):Math.floor(v))+u[i]; }
  function num(n){ n=Math.floor(n); if(n<1e4) return n.toLocaleString('en-US'); return fmt(n).slice(1); }
  function dur(s){ s=Math.max(0,Math.round(s)); if(s<60) return s+'s'; if(s<3600) return Math.floor(s/60)+'m'+(s%60&&s<600?' '+(s%60)+'s':''); if(s<86400) return Math.floor(s/3600)+'h'+(Math.floor(s%3600/60)?' '+Math.floor(s%3600/60)+'m':''); return Math.floor(s/86400)+'d'+(Math.floor(s%86400/3600)?' '+Math.floor(s%86400/3600)+'h':''); }
  function repTier(){ if(!F.repTiers) return 0; let t=0; REP.forEach((r,i)=>{ if(st.rep>=r.at) t=i; }); return t; }
  function setDone(k){ return !!F.sets&&!!st.sets[k]; }
  function earnMult(){ return (st.pass2x?2:1)*(1+.08*lv('sign'))*(1+REP[repTier()].b)*(1+.1*mana('fame'))*(F.prestigeTree?1+.01*st.mana:1+.5*st.rebirths)*(setDone('aloha')?1.1:1); }
  function xpNeed(L){ return Math.floor(10*Math.pow(L,1.5)); }
  function key(id,g,q){ return id+'|'+g+'|'+(q||'B'); }
  function unkey(k){ const [id,g,q]=k.split('|'); return {id,g:+g,q:q||'B'}; }
  const QMULT={A:1.25,B:1,C:.7};
  function gradeOf(score){ return score>=1.08?'A':score>=.86?'B':'C'; }
  function plotScore(p){ return quality(p)*(p.zone==='in'?.97:1); }
  const GRADE=[1,1.5,2.5,3.75], GRADE_L=['','Indoor AAA','Mutant','Indoor AAA Mutant'];
  function gradeLabel(g){ return GRADE_L[g]||''; }
  function invCount(stage){ const bag=st.inv&&st.inv[stage]; if(!bag||typeof bag!=='object'||Array.isArray(bag)) return 0; return Object.values(bag).reduce((a,b)=>a+(typeof b==='number'&&isFinite(b)?b:0),0); }
  // ---------- reputation, mastery, sets ----------
  const REP=[{n:'Backyard Grower',at:0,b:0},{n:'Local Favorite',at:40,b:.05},{n:'North Shore Name',at:250,b:.10},{n:'Island Famous',at:1200,b:.18},{n:'Legendary Grower',at:5000,b:.30}];
  function addRep(n){ if(!F.repTiers) return; if(festOn('aloha')) n*=2; const t0=repTier(); st.rep+=n; const t1=repTier(); if(t1>t0) emit('rep',{tier:t1,r:REP[t1]}); }
  const MASTERY=[[25,1.25],[50,1.5],[100,2],[250,3]];
  function mastery(id){ const n=st.harv[id]||0; if(!F.mastery) return {n,m:1,lvl:0,next:null,nextM:null}; let m=1, lvl=0; MASTERY.forEach(([k,v],i)=>{ if(n>=k){ m=v; lvl=i+1; } }); const nx=MASTERY[lvl]; return {n,m,lvl,next:nx?nx[0]:null,nextM:nx?nx[1]:null}; }
  const SETS={
    aloha:  {name:'Island Collection', desc:'Harvest every island strain', bonus:'+10% all sale prices', ids:S.filter(s=>s.island).map(s=>s.id)},
    classics:{name:'Old-School Classics', desc:'Harvest the classic landrace-era strains', bonus:'The classic strains are on the family record', ids:['northern-lights','durban-poison','granddaddy-purple','chemdawg','og-kush','sour-diesel','blue-dream'].filter(i=>BY[i])},
    purple: {name:'Purple Reign', desc:'Harvest the purple-flowering strains', bonus:'+10% growth speed everywhere', ids:S.filter(s=>s.look&&s.look.base==='purple'&&s.tier<=3).map(s=>s.id)},
    dessert:{name:'Dessert Menu', desc:'Harvest the cookie, gelato and cake family', bonus:'+10% yield everywhere', ids:['gsc','gelato','biscotti','ice-cream-cake','wedding-cake','gmo-cookies','lemon-cherry-gelato'].filter(i=>BY[i])},
    cbd:    {name:'Hemp Heritage', desc:'Harvest every CBD-rich hemp strain', bonus:'Your hemp strains are on the family record', ids:S.filter(s=>s.hemp).map(s=>s.id)},
    soty:   {name:'Garden Cup', desc:'Harvest every Garden Cup winner', bonus:'+15% XP', ids:S.filter(s=>/Garden Cup \d{4} \(winner\)/.test(s.recognition||'')).map(s=>s.id)},
  };
  function checkSets(){ if(!F.sets) return; for(const [k,d] of Object.entries(SETS)){ if(st.sets[k]) continue; if(d.ids.length&&d.ids.every(i=>(st.harv[i]||0)>0)){ st.sets[k]=true; emit('set',{k,d}); } } }
  // ---------- prestige (Island Spirit) ----------
  const MANA_UPG={
    thumb:{name:'Green Thumb', desc:'+8% growth speed everywhere per level', max:5},
    fame: {name:'Island Fame', desc:'+10% sale prices per level', max:5},
    roots:{name:'Deep Roots', desc:'Start each season with +$2,000 and +1 garage step per level', max:3},
    crew: {name:'Family Crew', desc:'Retired. Helpers have left the farm, so this node no longer changes anything. Spirit already spent stays spent.', max:3},
    vault:{name:'Seed Vault', desc:'-15% seed prices per level', max:3},
    pheno:{name:'Pheno Luck', desc:'+25% mutation chance per level, +1 hint token each season', max:3},
  };
  const manaCost=(k)=>[1,2,4,7,11][mana(k)];
  function manaGain(){ return Math.floor(3*Math.sqrt(st.runEarn/1e6)); }
  function buyMana(k){ if(!F.prestigeTree||k==='crew') return false; const d=MANA_UPG[k]; if(!d||mana(k)>=d.max) return false; const c=manaCost(k); if(st.mana<c) return false; st.mana-=c; st.manaSpent[k]=mana(k)+1; emit('mana',k); return true; }

  // ---------- island festivals (seasonal, real-calendar, limited time) ----------
  // A festival runs Thu-Sun every week, rotating through four. Each has an exclusive strain earned by its festival goal.
  const FESTS=[
    {id:'makahiki',name:'Harvest Festival',desc:'+25% harvest yield',strain:'glitter-bomb',goal:25,k:'harvests'},
    {id:'leiday',  name:'Flower Fair',desc:'+15% sale prices',strain:'zoap',goal:150,k:'sold'},
    {id:'aloha',   name:'Island Festival',desc:'Double reputation',strain:'kauai-electric',goal:30,k:'harvests'},
    {id:'monarch', name:'Merrie Monarch Week',desc:'+20% growth everywhere',strain:'cereal-milk',goal:200,k:'sold'},
  ];
  const EVENT_ONLY=Object.fromEntries(FESTS.map(f=>[f.strain,f.id]));
  // Exclusive premium strains: sold in the shop (money or gems) and also drop rarely in play.
  // Chances are the single source for the shop odds table (packOdds). Do not duplicate them in UI copy.
  const PREMIUM=['menehune-mint','lilikoi-pop','honu-blue'];
  const DROP={packPremium:.04, packSeason:.02, huntPremium:.03, huntSeason:.02};
  PREMIUM.forEach(id=>{ if(S.some(s=>s.id===id)) EVENT_ONLY[id]='premium'; }); S.forEach(s=>{ if(s.passExclusive) EVENT_ONLY[s.id]='pass'; });
  function premiumDrop(chance,how){ if(Math.random()>=chance) return null; const live=PREMIUM.filter(id=>strain(id)); if(!live.length) return null; const id=live[Math.floor(Math.random()*live.length)]; st.seeds[id]=(st.seeds[id]||0)+1; discover(id,true); emit('premiumdrop',{id,how}); emit('toast',{t:'Rare find! A '+strain(id).name+' seed ('+how+')',k:'good'}); return id; }
  // Timed gem boosts (1 hour each, stack by adding time): 2x growth, 2x sale price, better pheno odds
  const BOOSTS={grow:{name:'2x growth',icon:'🌱'},price:{name:'2x sale price',icon:'💰'},pheno:{name:'Better pheno odds',icon:'🧬'}};
  function boostLeft(k){ return Math.max(0,(st.boosts&&st.boosts[k])||0); }
  function tickBoosts(dt){ if(!st.boosts) return; for(const k in st.boosts) st.boosts[k]=Math.max(0,st.boosts[k]-dt); }
  // Rewarded ads: 5 gems each, +50 bonus at every 10th ad of the day (10, 20), cap 20/day (resets at local midnight)
  const ADS={cap:20,gems:5,bonusAt:10,bonus:50};   // max per day: 20*5 + 2*50 = 200 gems
  function adDay(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function adState(){ const k=adDay(); if(!st.ads||st.ads.day!==k) st.ads={day:k,n:0,bonus:false}; return st.ads; }
  function adReward(){ const a=adState(); if(a.n>=ADS.cap) return null; a.n++; addGems(ADS.gems,'Ad reward'); let b=0; if(a.n%ADS.bonusAt===0){ a.bonus=(a.bonus|0)+1; b=ADS.bonus; addGems(b,'Ad streak bonus'); } save(); emit('adreward',{n:a.n,bonus:b}); return {n:a.n,bonus:b}; }
  // ---------- Grower Pass (config in js/passes.js) ----------
  const PZ=window.PASS;
  function passState(){ const S=PZ.seasonNow(); if(!st.pass||st.pass.key!==S.key) st.pass={key:S.key,xp:0,premium:false,plus:false,cf:{},cp:{},day:'',dx:{}}; return st.pass; }
  function passTier(){ const P=passState(); return Math.min(PZ.TIERS,Math.floor(P.xp/PZ.XP_PER_TIER)); }
  function passHook(n){ if(!st||!PZ) return; const add=PZ.PASS_XP[n]; if(!add) return; const P=passState(), d=adDay(); if(P.day!==d){ P.day=d; P.dx={}; }
    const cap=PZ.PASS_XP.caps[n]; if(cap){ const u=P.dx[n]||0; if(u>=cap) return; P.dx[n]=u+add; } const t0=passTier(); P.xp+=add*(st.event&&st.event.id==='season'?1.5:1); const t1=passTier(); if(t1>t0) emitRaw('passtier',t1); }
  function emitRaw(n,a){ (ev[n]||[]).forEach(f=>f(a)); }
  function grantReward(r,src){ if(!r) return; if(r.gems) addGems(r.gems,src); if(r.rarePacks) st.rarePacks+=r.rarePacks; if(r.legPacks) st.legPacks+=r.legPacks; if(r.hints) st.hints+=r.hints;
    if(r.skip){ const x=simulate(r.skip,false); emit('skip',x); } if(r.boost){ st.boosts=st.boosts||{}; st.boosts[r.boost]=boostLeft(r.boost)+3600; emit('boost',r.boost); }
    if(r.cos){ st.cos=st.cos||{own:{},eq:{}}; st.cos.own[r.cos]=true; emit('cosunlock',r.cos); }
    if(r.strain){ st.seeds[r.strain]=(st.seeds[r.strain]||0)+(r.n||1); discover(r.strain,true); emit('premiumdrop',{id:r.strain,how:'Grower Pass'}); } }

  // ---------- season events + season mini-quests (data in passes.js) ----------
  function seasonEv(){ const S=PZ.seasonNow(); return Object.assign({sid:S.id},PZ.SEASON_EV[S.id]); }
  function evFx(k){ const id=st.event&&st.event.id; if(id===k) return true; return id==='season'&&seasonEv().fx===k; }
  function sqWeek(){ const S=PZ.seasonNow(); return Math.min(8,1+Math.floor((Date.now()-S.start)/(7*864e5))); }
  function sqState(){ const S=PZ.seasonNow(); if(!st.sq||st.sq.key!==S.key) st.sq={key:S.key,done:[],cur:0,base:null}; const Q=st.sq, list=PZ.seasonQuests(S.id);
    if(Q.cur<list.length&&Q.base==null&&Q.cur<sqWeek()) Q.base=stat(list[Q.cur].k);                    // a quest starts counting once its week has opened
    return {S,list,Q,week:sqWeek()}; }
  function sqInfo(){ const {S,list,Q,week}=sqState(); return list.map((q,i)=>Object.assign({},q,{state:i<Q.cur?'done':i>=week?'locked':i>Q.cur?'later':'active',prog:i===Q.cur&&Q.base!=null?Math.min(q.n,stat(q.k)-Q.base):i<Q.cur?q.n:0,
    opens:S.start+i*7*864e5})); }
  function sqClaim(){ const {list,Q}=sqState(); const q=list[Q.cur]; if(!q||Q.base==null||stat(q.k)-Q.base<q.n) return false; const r=q.r;
    grantReward({gems:r.gems,rarePacks:r.rarePacks,legPacks:r.legPacks,strain:r.strain,n:r.seeds},'Season quest'); if(r.px){ const P=passState(), t0=passTier(); P.xp+=r.px; const t1=passTier(); if(t1>t0) emitRaw('passtier',t1); }
    Q.done.push(q.i); Q.cur++; Q.base=null; sqState(); emit('sqclaim',q); save(); return q; }
  function sqReady(){ const I=sqInfo().find(x=>x.state==='active'); return I&&I.prog>=I.n?1:0; }
  function passClaim(tier,track){ const P=passState(), row=PZ.track(PZ.seasonNow())[tier-1]; if(!row) return false; if(tier>passTier()) return false; const key=track==='p'?'cp':'cf';
    if(P[key][tier]) return false; if(track==='p'&&!P.premium) return false; const r=track==='p'?row.p:row.f; if(!r) return false; P[key][tier]=1; grantReward(r,'Grower Pass'); save(); emit('passclaim',{tier,track,r}); return true; }
  function passClaimAll(){ let n=0; for(let t=1;t<=passTier();t++){ if(passClaim(t,'f')) n++; if(passClaim(t,'p')) n++; } return n; }
  function seasonDrop(chance,how){ if(Math.random()>=chance) return null; const id=PZ.seasonNow().strain; if(!strain(id)) return null; st.seeds[id]=(st.seeds[id]||0)+1; discover(id,true); emit('premiumdrop',{id,how}); emit('toast',{t:'Rare season find! A '+strain(id).name+' seed ('+how+')',k:'good'}); return id; }
  // Piggy bank: fills with gems as you play (0.25 per harvest, 3 per goal / quest / achievement claim) up to PIGGY.cap; one purchase cracks it
  const PIGGY={cap:400,min:40};
  function piggyHook(n){ passHook(n); if(!st||!st.piggy) return; const add=n==='harvest'?.25:(n==='qclaim'||n==='questclaim'||n==='achclaim')?3:0; if(add) st.piggy.g=Math.min(PIGGY.cap,st.piggy.g+add); }
  let festForce=null;
  function festNow(){ if(!F.events||!st||st.level<GATE.events) return null; if(festForce) return festForce; const d=Math.floor(Date.now()/864e5), w=Math.floor(d/7); if(d%7>=4) return null;
    const f=FESTS[w%FESTS.length]; return Object.assign({week:w,ends:(w*7+4)*864e5},f); }
  function festState(){ const f=festNow(); if(!f) return null; if(!st.fest||st.fest.week!==f.week||st.fest.id!==f.id) st.fest={id:f.id,week:f.week,base:st.stats[f.k]||0,claimed:false}; return {f,prog:Math.min(f.goal,(st.stats[f.k]||0)-st.fest.base),claimed:st.fest.claimed}; }
  function festOn(id){ const f=festNow(); return !!f&&f.id===id; }
  function claimFest(){ const fs=festState(); if(!fs||fs.claimed||fs.prog<fs.f.goal) return false; st.fest.claimed=true; const id=fs.f.strain; const fresh=discover(id,false,'festival'); st.seeds[id]=(st.seeds[id]||0)+3; addGems(25,fs.f.name); emit('festclaim',{f:fs.f,s:strain(id),fresh}); return true; }
  // ---------- golden gecko (rare clickable boost) ----------
  const GECKO=[{k:'grow',name:'Growth rush',desc:'2x growth for 60s',t:60,w:3},{k:'price',name:'Market buzz',desc:'+50% sale prices for 60s',t:60,w:3},{k:'cash',name:'Lucky find',desc:'Instant cash',t:0,w:2},{k:'hint',name:'Old seed journal',desc:'+1 hint token',t:0,w:1}];
  function boostOn(k){ const b=st.gecko&&st.gecko.boost; return !!b&&b.k===k&&b.t>0; }
  function tickGecko(dt){ if(!F.gecko||st.level<GATE.gecko) return; const g=st.gecko; if(g.boost){ g.boost.t-=dt; if(g.boost.t<=0) g.boost=null; }
    if(g.on){ const dur=g.on.dur||8; g.on.p=(g.on.p||0)+dt/dur; g.on.t=(g.on.t||dur)-dt; if(g.on.p>=1||g.on.t<=0){ g.on=null; g.next=36+Math.random()*40; } return; }
    g.next-=dt; if(g.next<=0){ const dur=6+Math.random()*4; g.on={t:dur,dur,p:0,y:0.28+Math.random()*0.38,dir:Math.random()<.5?1:-1}; emit('gecko',g.on); } }
  function geckoTap(){ const g=st.gecko; if(!g.on) return false; g.on=null; g.next=200+Math.random()*260; let r=Math.random()*GECKO.reduce((a,b)=>a+b.w,0), pick=GECKO[0]; for(const x of GECKO){ r-=x.w; if(r<=0){ pick=x; break; } }
    let extra=''; if(pick.k==='cash'){ const v=Math.round(25*Math.pow(st.level,2.1)); addCash(v,'gecko'); extra=fmt(v); } else if(pick.k==='hint'){ st.hints++; } else g.boost={k:pick.k,t:pick.t,max:pick.t};
    bump('geckos'); emit('geckotap',{b:pick,extra}); return pick; }
  // ---------- crafting (hash, rosin, edibles) ----------
  const CRAFT={
    hash:   {name:'Bubble hash',     desc:'Ice-water extraction of trichomes', need:4, mult:1.3, time:60,  gate:'hash'},
    rosin:  {name:'Live rosin',      desc:'Pressed with heat, no solvents',    need:5, mult:1.55,time:150, gate:'rosin', upg:'press'},
    edibles:{name:'Infused edibles', desc:'Made in a licensed kitchen',        need:6, mult:1.8, time:300, gate:'edibles', upg:'kitchen'},
  };
  function craftOk(t){ const c=CRAFT[t]; return F.crafting&&gate(c.gate)&&(!c.upg||lv(c.upg)>0); }
  function craftSlots(){ return 1+lv('press')+lv('kitchen'); }
  function craftMax(t,stg,k){ return Math.min(10,Math.floor((st.inv[stg][k]||0)/CRAFT[t].need)); }
  function startCraft(t,stg,k,units){ if(!craftOk(t)||st.craft.length>=craftSlots()) return false; const c=CRAFT[t]; const mx=craftMax(t,stg,k); units=Math.min(units||mx,mx); if(!(units>0)) return false;
    st.inv[stg][k]-=units*c.need; if(st.inv[stg][k]<=0) delete st.inv[stg][k]; const {id,q}=unkey(k);
    st.craft.push({t,id,q,stg,n:units,T:0,dur:c.time*(1+.15*(units-1))}); emit('craftstart',{t,id,units}); return true; }
  function tickCraft(dt){ for(let i=st.craft.length-1;i>=0;i--){ const j=st.craft[i]; j.T+=dt; if(j.T>=j.dur){ const key=j.t+'|'+j.id+'|'+(j.stg==='cured'?1:0)+'|'+(j.q||'B'); st.goods[key]=(st.goods[key]||0)+j.n; st.craft.splice(i,1); bump('crafted',j.n); done('craft'); emit('crafted',j); } } }
  function goodPrice(key){ const [t,id,c,q]=key.split('|'); const s=strain(id), C=CRAFT[t]; return (boostLeft('price')>0?2:1)*s.game.budValue*C.need*C.mult*(QMULT[q]||1)*(+c?STAGE_MULT.cured:1)*st.market.f[id]*mastery(id).m*earnMult()*(boostOn('price')?1.5:1)*(festOn('leiday')?1.15:1)*(evFx('swell')?1.25:1); }
  function sellGood(key,n){ const have=st.goods[key]||0; n=Math.min(n==null?have:n,have); if(n<=0) return 0; const v=goodPrice(key)*n; st.goods[key]-=n; if(st.goods[key]<=0) delete st.goods[key];
    addCash(v,'sale'); addXP(Math.max(1,Math.round(n*2))); addRep(n*.08); bump('goodsSold',n); emit('sold',{v,n,id:key.split('|')[1],good:true}); return v; }
  function goodsCount(){ const bag=st.goods; if(!bag||typeof bag!=='object'||Array.isArray(bag)) return 0; return Object.values(bag).reduce((a,b)=>a+(typeof b==='number'&&isFinite(b)?b:0),0); }
  // ---------- availability / mystery strains ----------
  function refreshUnlocks(){
    S.forEach(s=>{ if(st.discovered[s.id]||s.mystery||EVENT_ONLY[s.id]) return; if(st.level>=s.game.unlockLevel) discover(s.id,true); });
  }
  function discover(id,quiet,how){
    if(st.discovered[id]) return false;
    st.discovered[id]=true;
    const s=strain(id); if(!quiet){ addGems(s.tier>=4?25:s.tier>=3?10:5,'New strain!'); }
    if(s.mystery){ st.stats.phenos++; done('pheno'); if(st.breedLab) st.hints++; }
    emit('discover',{s,quiet:quiet&&(lvlQuiet?'lvl':true),how}); checkQuest(); return true;
  }
  // ---------- economy ----------
  function testerCurrencyBlocked(src){
    if(src!=='dev'&&src!=='Dev') return false;
    return !!(window.storeDisablesTester&&window.storeDisablesTester());
  }
  function addCash(n,src){ if(testerCurrencyBlocked(src)) return; st.cash+=n; if(n>0){ st.lifetime+=n; st.runEarn+=n; } emit('cash',{n,src}); }
  function addGems(n,why){ if(testerCurrencyBlocked(why)) return; st.gems+=n; emit('gems',{n,why}); }
  function spend(n){ if(st.cash<n-1e-9){ emit('nocash',n); return false;} st.cash-=n; emit('cash',{n:-n}); return true; }
  function spendGems(n){ if(st.gems<n){ emit('nogems',n); return false;} st.gems-=n; emit('gems',{n:-n}); return true; }
  function addXP(n){ n*=ECON.xp; if(evFx('festival')) n*=2; if(st&&st.time!=null&&season()==='makahiki') n*=1.25; if(setDone('soty')) n*=1.15; st.xp+=n; while(st.xp>=xpNeed(st.level)){ st.xp-=xpNeed(st.level); st.level++; const gems=10, cash=Math.round(15*Math.pow(st.level,2.2)); addGems(gems); addCash(cash,'level');
      const before=new Set(Object.keys(st.discovered)); lvlQuiet=true; refreshUnlocks(); lvlQuiet=false; const fresh=Object.keys(st.discovered).filter(k=>!before.has(k)).map(strain);
      if(st.level>=10&&!st.themes.golden) st.themes.golden=true;
      emit('level',{L:st.level,gems,cash,strains:fresh,miles:MILES[st.level]||[]}); checkQuest(); } }
  let lvlQuiet=false;
  const GATE={land:LAND_LEVEL, gh:GH_BUILD.level, breed:5, permit:INDOOR.permitLevel, indoor:INDOOR.level, orders:2, gecko:3, events:4, customers:5, leaderboard:5, sets:6, hash:6, rosin:10, edibles:14, season:8};
  const MILES={2:['Halfway feed: one free feeding per plant (+15% speed, +20% yield). Skip it and that plant grows 20% slower','Sell dried and cured buds at the Market'],
    3:['Family land on the hill is for sale','Watch for the golden gecko: tap it for a short boost'],
    4:['Uncommon strains (10-30 min grows) reach the seed shop','Outdoor greenhouse can be built','Island festivals: limited-time events with exclusive strains'],
    5:['Pheno Room opens: hunt mystery phenos','Island leaderboard'],
    6:['Craft bubble hash from dried buds','Collection sets: finish a set for a permanent bonus'],
    7:['Greenhouse gear (beds, shade, cooler) is in Upgrades'],8:['New Season (prestige) unlocks once you earn enough'],9:['Rare strains (1-4 hour grows) reach the seed shop','County Agricultural Permit can be bought'],
    10:['Rosin press (craft rosin)','Golden Hour theme (free)'],
    11:['Indoor facility: with a full greenhouse, the permit, and the foundation poured, you can build it'],
    12:['CO2, HVAC, and the veg room are in Upgrades'],14:['Epic strains (8-24 hour grows) unlock','Licensed kitchen (craft edibles)'],20:['Legendary strains (1-3 day grows) unlock']};
  function gate(k){ return st.level>=GATE[k]; }

  // ---------- capacity / plots ----------
  function capOf(zone){ if(zone==='garage'){ const i=Math.max(0,Math.min(GARAGE.length-1,st.garage|0)); return Math.max(GARAGE[i].cap, st.garageKeep|0); } if(zone==='field') return st.land?FIELD.slice(0,st.field+1).reduce((a,b)=>a+b.add,0):0; if(zone==='gh'){ if(!st.ghBuilt) return 0; if(typeof st.ghMatch==='number'){ const extra=st.gh>0?GH.slice(1,st.gh+1).reduce((a,b)=>a+b.add,0):0; return st.ghMatch+extra; } return GH.slice(0,st.gh+1).reduce((a,b)=>a+b.add,0); } if(zone==='in') return st.inBuilt?BENCH.slice(0,st.bench+1).reduce((a,b)=>a+b.add,0):0; return 0; }
  function syncPlots(){ st.plots.forEach(p=>{ p.owned=p.idx<capOf(p.zone); }); }
  function locOpen(l){ return l==='garage'||(l==='farm'&&st.land)||(l==='indoor'&&st.inBuilt); }
  function nextStep(kind){ // {name,cost,...} of next capacity purchase or null
    if(kind==='garage'){ const cur=capOf('garage'); if(cur>=GARAGE_MAX) return null; const idx=GARAGE.findIndex(g=>g.cap>cur); if(idx<0) return null; const src=GARAGE[idx], gain=src.cap-cur, cost=gain>=3?src.cost:Math.max(0,Math.round(src.cost*gain/3)); return {name:src.name, cap:src.cap, cost, desc:gain===3?src.desc:('+'+gain+' buckets, up to '+src.cap+'.'), add:gain}; }
    if(kind==='field') return st.land?FIELD[st.field+1]||null:null;
    if(kind==='gh') return st.ghBuilt?GH[st.gh+1]||null:null;
    if(kind==='bench') return st.inBuilt?BENCH[st.bench+1]||null:null;
  }
  function buyStep(kind){
    const n=nextStep(kind); if(!n) return false; if(!spend(n.cost)) return false;
    if(kind==='garage'){ const cur=capOf('garage'), idx=GARAGE.findIndex(g=>g.cap>cur); if(idx>=0) st.garage=idx; if((st.garageKeep|0)<=GARAGE[st.garage].cap) st.garageKeep=0; if(capOf('garage')>5) done('gcap'); if(capOf('garage')>=9) done('tent3'); }
    if(kind==='field') st.field++;
    if(kind==='gh'){ st.gh++; if(capOf('gh')>=INDOOR.ghPlants) done('ghfull'); }
    if(kind==='bench') st.bench++;
    syncPlots(); emit('expand',{kind,n}); return true;
  }
  function buyLand(){ if(st.land) return false; if(!gate('land')){ emit('toast',{t:'The family land goes on sale at level '+LAND_LEVEL,k:'bad'}); return false; } if(!spend(LAND_COST)) return false; st.land=true; st.phenoRoom=true; syncPlots(); done('land'); emit('land'); emit('phenoroom'); return true; }
  // Indoor Breeding Pheno Room: takes over pheno work from the garage (crosses 60% faster, double mutation odds, +1 hint per discovery). The garage becomes storage (+4 drying slots) and a bonus grow.
  const LAB={cost:600000,level:INDOOR_LAB_LEVEL()};
  function INDOOR_LAB_LEVEL(){ return 14; }
  function buyLab(){ if(st.breedLab||!st.inBuilt) return false; if(!spend(LAB.cost)) return false; st.breedLab=true; emit('breedlab'); return true; }
  function garageRole(){ return !st.phenoRoom?'grow':st.breedLab?'storage':'pheno'; }
  function buildGH(){ if(st.ghBuilt||!st.land) return false; if(!gate('gh')){ emit('toast',{t:'Greenhouse needs level '+GH_BUILD.level,k:'bad'}); return false; } if(!spend(GH_BUILD.cost)) return false; const n=st.plots.filter(p=>p.zone==='garage'&&p.owned).length; st.ghBuilt=true; st.gh=0; st.ghMatch=n; syncPlots(); done('ghbuild'); emit('ghbuilt'); return true; }
  function buyPermit(){ if(st.permit) return false; if(st.level<INDOOR.permitLevel){ emit('toast',{t:'Permit office opens at level '+INDOOR.permitLevel,k:'bad'}); return false; } if(!spend(INDOOR.permitCost)) return false; st.permit=true; done('permit'); emit('permit'); return true; }
  function indoorChecklist(){
    return [
      {k:'land',  t:'Own the family land', ok:st.land},
      {k:'gh',    t:'Greenhouse fully expanded (12 beds)', ok:capOf('gh')>=INDOOR.ghPlants, p:capOf('gh')/INDOOR.ghPlants, v:Math.round(capOf('gh')/3)+'/12 beds'},
      {k:'level', t:'Reach level '+INDOOR.level, ok:st.level>=INDOOR.level, p:Math.min(1,(st.level-1+st.xp/xpNeed(st.level))/(INDOOR.level-1)), v:'Level '+st.level},
      {k:'permit',t:'County Agricultural Permit ('+fmt(INDOOR.permitCost)+' at Lv '+INDOOR.permitLevel+', or quest reward)', ok:st.permit},
      {k:'found', t:'Pour the concrete foundation ('+fmt(INDOOR.foundCost)+' at Lv '+INDOOR.foundLevel+')', ok:!!st.found},
      {k:'cash',  t:'Build cost '+fmt(INDOOR.build), ok:st.cash>=INDOOR.build, p:Math.min(1,st.cash/INDOOR.build), v:fmt(st.cash)},
    ];
  }
  function buyFoundation(){ if(st.found) return false; if(!st.permit||st.level<INDOOR.foundLevel){ emit('toast',{t:'Foundation needs the permit and level '+INDOOR.foundLevel,k:'bad'}); return false; } if(!spend(INDOOR.foundCost)) return false; st.found=true; emit('toast',{t:'Foundation poured! The indoor build is next.',k:'good'}); return true; }
  function buildIndoor(){ if(st.inBuilt) return false; const ck=indoorChecklist(); if(!ck.slice(0,5).every(c=>c.ok)){ emit('toast',{t:'Finish the indoor checklist first',k:'bad'}); return false; } if(!spend(INDOOR.build)) return false;
    st.inBuilt=true; syncPlots(); done('indoor'); emit('indoor'); return true; }
  function seedPrice(s){ return Math.max(1,Math.round(s.game.seedCost*(1-.15*mana('vault'))*(lv('clone')?.6:1)*100)/100); }
  function buySeeds(id,n){ const s=strain(id); if(!st.discovered[id]) return false; if(!spend(seedPrice(s)*n)) return false; st.seeds[id]=(st.seeds[id]||0)+n; if(!(st.seeds[st.selSeed]>0)) st.selSeed=id; if(st.tut&&typeof st.tut==='object') st.tut.bought=(st.tut.bought|0)+n; emit('seeds',{id,n}); return true; }
  function plant(p,id){
    id=id||st.selSeed; if(!p.owned||p.strain||!id) return false;
    if(!(st.seeds[id]>0)) return false;
    const dn=ZONE[p.zone].dens||1; if(dn<1){ st.sf=st.sf||{}; st.sf[id]=(st.sf[id]||0)+dn; if(st.sf[id]>=.999){ st.sf[id]-=1; st.seeds[id]--; } } else st.seeds[id]--; p.strain=id; p.prog=p.zone==='in'?.15*lv('veg')+.1*lv('clone'):0; if(st.cutSeeds&&st.cutSeeds[id]>0){ st.cutSeeds[id]--; p.prog=Math.max(p.prog,.1); p.fromCut=true; } else p.fromCut=false; p.water=lv('water')>=4?1:.6; p.food=0; p.q=1; p.readyT=0; p.last=id; p.pest=null; p.t0=st.playT;
    bump('plant'); done('plant'); if(p.zone==='field'||p.zone==='gh') done('field'); emit('plant',p); return true;
  }
  function water(p){ if(!p.strain||p.prog>=1) return false; p.water=1; bump('water'); done('water'); emit('water',p); return true; }
  // One free feed per plant, from 50% grown until harvest. feedCost stays exported and is always 0.
  // Ignoring the feed does not pause growth. An empty water tank is the harsh stall (15% speed).
  // Hunger keeps the older, milder penalty for the rest of the grow: 80% speed, no +15% fed speed,
  // no +20% harvest yield, and a slow quality drop. A successful feed sets food to 1 for the rest
  // of that grow (it does not drain) and restores the fed bonuses. Before halfway there is no penalty.
  function feedCost(){ return 0; }
  function feed(p,auto){ if(!p||!p.strain||p.prog>=1||p.prog<.5||p.food>0) return false; p.food=1; bump('feed'); if(!auto) done('feed'); emit('feed',p); return true; }
  function quality(p){ let q=p.q; { const K=keeperRec(p.strain); if(K&&typeof K.q==='number') q+=K.q; q*=lineGen(p.strain)>=LINE.stable?1:lineMult(p.strain); } if(p.zone==='in') q+=.1+.06*lv('hvac'); if(p.zone==='garage') q+=.03*lv('fan')+.02*lv('oscfan')+.05*lv('phkit'); if(p.zone==='gh') q+=.04*lv('shade')+.03*lv('cooler'); if(lv('water')>=4) q+=.03; if(lv('nutes')>=3) q+=.05; return Math.max(.5,q); }
  function yieldMult(p){ const z=ZONE[p.zone]; let y=z.yield; { const K=keeperRec(p.strain); if(K&&typeof K.y==='number') y*=K.y; y*=lineMult(p.strain); } if(p.zone==='garage') y*=1+.05*lv('light'); if(p.zone==='in'&&lv('fert')) y*=1.1; if(p.zone==='gh'||p.zone==='field') y*=1+.2*lv('beds');  if(lv('nutes')>=3) y*=1.15; if(setDone('dessert')) y*=1.1; return y; }
  function mgrCovers(){ return false; }
  function offColCap(){ return (8+4*lv('water'))*3600; }   // upgradable via Watering
  function harvest(p){
    if(!p.strain||p.prog<1) return false;
    const s=strain(p.strain);
    const ym=yieldMult(p)*(p.food>0?1.2:1)*quality(p)*(festOn('makahiki')?1.25:1)*seasonYield(p)*(p.pruned?1.12:1)*(p.trellis?1.08:1)*(p.train==='top'?1.15:p.train==='lst'?1.08:1)*(p.zone==='garage'?(garageRole()==='pheno'?.7:garageRole()==='storage'?.85:1):1);
    const raw=s.game.buds*ym*(st._half?.5:1), dn=ZONE[p.zone].dens||1; const n=Math.max(1,Math.floor(raw)+(Math.random()<raw-Math.floor(raw)?1:0));
    const mutant=Math.random()<mutChance(p);
    const grade=gradeOf(plotScore(p));
    const g=(p.zone==='in'?1:0)+(mutant?2:0), k=key(s.id,g,grade);
    st.inv.wet[k]=(st.inv.wet[k]||0)+n;
    st.stats.harvests++; if(p.zone==='in'){ st.stats.inHarv++; done('inharv'); } if(s.tier>=4) st.stats.legHarv++;
    if(mutant) st.stats.mutants++;
    const m0=mastery(s.id).lvl; st.harv[s.id]=(st.harv[s.id]||0)+1; const m1=mastery(s.id); if(m1.lvl>m0) emit('mastery',{s,m:m1});
    checkSets();
    addXP(Math.max(1,Math.round((s.game.xp+(p.zone==='in'?2:0))*(dn<1?dn*1.3:1))));
    const golden=Math.random()<1/30;
    if(golden){ st.stats.golden++; addGems(2+Math.floor(Math.random()*4)); }
    let lucky=null; if(Math.random()<.04){ lucky=pickSeed(Math.min(2,Math.max(st.level>=9?1:0,s.tier))); if(lucky){ st.seeds[lucky.id]=(st.seeds[lucky.id]||0)+1; st.stats.lucky++; } }
    emit('harvest',{p,n,s,golden,mutant,lucky,grade});
    if(lucky) discover(lucky.id);
    p.strain=null; p.prog=0; p.food=0; p.water=0; p.q=1; p.pest=null; p.pruned=false; p.trellis=false; p.eggs=0; p.train=null;
    done('harvest'); return n;
  }
  // ---------- upkeep ----------
  function upkeepFrac(p,k){ let f=ZONE[p.zone].up[k]||0;
    if(p.zone==='garage'&&k==='power') f*=[1,1.1,1.05,.95][lv('light')]*(1+.04*lv('dehu'))*(1-.1*lv('timer'));
    if((p.zone==='gh'||p.zone==='field')&&k==='water') f*=1-.6*lv('catch');
    if(p.zone==='in'&&k==='power') f*=(1+.05*lv('led'))*(1-.15*lv('solar'));
    if(p.zone==='in'&&k==='climate') f*=(1-.1*lv('hvac'))*(1+.6*lv('co2'));
    if(k==='nutrients') return 0;
    if(setDone('cbd')) f*=.85; return f; }
  function cycleCost(){ return {total:0}; }
  function upkeepRates(){ return {garage:{total:0,parts:{}},farm:{total:0,parts:{}},indoor:{total:0,parts:{}}}; }
  // ---------- growth ----------
  function isNight(){ return false; }
  function dayPhase(){ return 0.45; }
  function growRate(p,offline){
    const s=strain(p.strain); let r=1/s.game.growSec; { const K=keeperRec(p.strain); if(K&&typeof K.g==='number') r*=K.g; }
    const z=ZONE[p.zone];
    if(!st.stats.harvests) r*=3;   // fast first harvest (~10 s) for the guided first minute
    if(p.zone==='garage') r*=(1+.125*lv('light'))*(1+.05*lv('timer'));
    if(p.zone==='gh') r*=1+.15*lv('lightdep');
    if(p.zone==='in') r*=(1+.15*lv('led'))*(1+.2*lv('co2'))*(1+.06*lv('solar'));
    if(z.outdoor) r*=1;
    r*=1+.08*mana('thumb'); if(setDone('purple')) r*=1.1; if(boostOn('grow')) r*=2; if(boostLeft('grow')>0) r*=2; if(festOn('monarch')) r*=1.2;
    if(p.water<=0) r*=.15;
    if(p.food>0) r*=1.15; else if(isHungry(p)) r*=.8;
    if(p.pest) r*=.5;
    // Tester growth speed (?dev=1 only). Ignored in normal play, store builds, and time-skip catch-up.
    if(!offline && devOn() && st.devSpeed>1) r*=Math.min(10000, st.devSpeed);
    return r;
  }
  function timeLeft(p){ if(!p.strain||p.prog>=1) return 0; return (1-p.prog)/Math.max(1e-9,growRate(p)); }
  function isThirsty(p){ return !!p.strain&&p.prog<1&&p.water<=.15; }
  function isHungry(p){ return !!p&&!!p.strain&&p.prog<1&&p.prog>=.5&&!(p.food>0); }
  // Pest / mold chance per grow cycle (scaled by progress so a 3-day plant is not doomed).
  function pestRisk(p){
    if(!p.strain||p.prog<.1) return {pests:0,mold:0};
    if(p.zone==='in') return {pests:.0004, mold:.0028*Math.max(.15,1-.22*lv('hvac'))};
    if(p.zone==='garage'){ const f=1-.25*lv('fan'); return {pests:.0008*f, mold:.0014*f*(1-.15*lv('oscfan'))*(1-.35*lv('dehu'))}; }
    if(p.zone==='gh') return {pests:.0009, mold:.0003*(1-.4*lv('cooler'))};
    return {pests:.0012, mold:.0002};
  }
  function treatCost(p){ const s=strain(p.strain); return Math.max(.5,Math.round(s.game.payout*.06*ZONE[p.zone].yield*100)/100); }
  // training in veg (prog 0.15-0.5): prune the lower branches (+12% yield, once) and, for tall outdoor/greenhouse plants, tie them to a trellis (+8%)
  function canPrune(p){ return !!p.strain&&!p.pruned&&p.prog>=.15&&p.prog<.5; }
  function canTrellis(p){ return !!p.strain&&!p.trellis&&p.prog>=.15&&p.prog<.6&&(p.zone==='field'||p.zone==='gh'); }
  function prune(p,auto){ if(!canPrune(p)) return false; p.pruned=true; bump('pruned'); emit('prune',{p,auto}); return true; }
  function trellis(p,auto){ if(!canTrellis(p)) return false; const c=Math.round(strain(p.strain).game.budValue*.15); if(!auto&&!spend(c)) return false; if(auto){ if(st.cash<c) return false; st.cash-=c; } p.trellis=true; bump('trellis'); emit('trellis',{p,auto}); return true; }
  function trellisCost(p){ return Math.round(strain(p.strain).game.budValue*.15); }
  // scouting: early eggs/spores can be found with the magnifier before they hatch; removing them is free and keeps quality up
  function eggHint(off){ if(off||st.stats.eggHint) return; st.stats.eggHint=1; emit('tip','Something is laying eggs on your plants. Press and hold on a plant to look, then wipe the eggs before they hatch.'); }
  function scout(p){ if(!p||!(p.eggs>0)) return false; p.eggs=0; p.q=Math.min(1.15,p.q+.02); bump('scouted'); st.scoutStreak=(st.scoutStreak||0)+1; emit('scouted',p);
    if(st.scoutStreak%5===0){ const g=2+Math.min(8,st.scoutStreak/5|0); addGems(g,'scout'); emit('scoutstreak',{n:st.scoutStreak,g}); } return true; }
  // training choice in veg (one per plant): topping = +15% yield but 10% slower growth; low-stress training (LST) = +8% yield, +3% quality, no slowdown
  function canTrain(p){ return !!p.strain&&!p.train&&p.prog>=.15&&p.prog<.4; }
  function train(p,kind,auto){ if(!canTrain(p)||(kind!=='top'&&kind!=='lst')) return false; p.train=kind; if(kind==='lst') p.q=Math.min(1.15,p.q+.03); bump('trained'); emit('train',{p,kind,auto}); return true; }
  function treat(p,auto){ if(!p.pest) return false; if(!spend(treatCost(p))) return false; const k=p.pest; p.pest=null; bump('treated'); emit('treat',{p,k,auto}); return true; }
  function stage(p){ if(!p.strain) return -1; const x=p.prog; return x>=1?5:x<.08?0:x<.25?1:x<.45?2:x<.65?3:4; }
  function tickPlot(p,dt,offline){
    if(!p.strain) return;
    if(p.prog>=1){ p.readyT+=dt; if(p.pest) p.q=Math.max(.55,p.q-.01*dt*(60/strain(p.strain).game.growSec)); return; }
    const s=strain(p.strain), gs=s.game.growSec;
    if(lv('water')>=4&&p.water<.6) p.water=1;
    let dp=growRate(p,offline)*dt*(p.train==='top'?1/1.1:1);
    if(!offline&&!st.stats.pruneHint&&canPrune(p)){ st.stats.pruneHint=1; emit('tip','Your first plant is ready for training. Tap it to prune, top or tie it down for a bigger harvest.'); }
    p.prog=Math.min(1,p.prog+dp);
    const wdrain=dt/(gs*.5)*(st.stats.harvests?1:.3)*(lv('water')>=2?.625:1)*(p.zone==='garage'&&lv('trays')?.8:1)*(lv('catch')&&(p.zone==='field'||p.zone==='gh')?.7:1);
    p.water=Math.max(0,p.water-wdrain); if(!(p.food>0)) p.food=0;
    const hurt=(p.water<=0?.006:0)+(isHungry(p)?.0015:0)+(p.pest?.012:0);
    p.q=Math.max(.55,Math.min(1.15,p.q+(p.food>0?.16:0)*dp-hurt*dt*(26/gs)));
    if(!p.pest){ const rk=pestRisk(p), m=(offline?.35:1)*Math.min(1,60/gs); const r=Math.random();
      if(p.eggs>0){ p.eggs-=dt; if(p.eggs<=0){ p.eggs=0; p.pest=p.eggK||'pests'; if(st.scoutStreak) emit('streaklost',st.scoutStreak); st.scoutStreak=0; emit('pest',p); } }
      else if(r<rk.mold*dt*m){ p.eggs=offline?.01:45+Math.random()*45; p.eggK='mold'; eggHint(offline); } else if(r<(rk.mold+rk.pests)*dt*m){ p.eggs=offline?.01:45+Math.random()*45; p.eggK='pests'; eggHint(offline); } }
    if(p.prog>=1){ p.readyT=0; emit('ripe',p); }
  }
  // ---------- drying / curing ----------
  function dryerSlots(){ return 2+lv('dryer')+3*lv('dryroom')+(garageRole()==='storage'?4:0); }
  function batchMax(){ return 20+10*lv('dryer'); }
  function loadDryer(){
    let loaded=0;
    for(const k of Object.keys(st.inv.wet)){
      while(st.inv.wet[k]>0 && st.dryer.length<dryerSlots()){
        const n=Math.min(st.inv.wet[k],batchMax()); st.inv.wet[k]-=n; loaded+=n;
        st.dryer.push({k,n,t:0,phase:'dry',dur:(12+n*.5)*Math.pow(.88,lv('dryer'))*(lv('dryroom')?.75:1)});
      }
      if(st.inv.wet[k]<=0) delete st.inv.wet[k];
    }
    if(loaded){ bump('dryLoads'); done('dry'); emit('dryload',loaded); }
    return loaded;
  }
  function tickDryer(dt){
    for(let i=st.dryer.length-1;i>=0;i--){
      const j=st.dryer[i]; j.t+=dt;
      if(j.t>=j.dur){
        if(j.phase==='dry' && lv('cure')>0){ j.phase='cure'; j.t=0; j.dur=(25+j.n*.7)*Math.pow(.82,lv('cure')-1)*(lv('dryroom')?.75:1); emit('dried',j); continue; }
        const dest=j.phase==='dry'?'dry':'cured'; st.inv[dest][j.k]=(st.inv[dest][j.k]||0)+j.n; st.dryer.splice(i,1); if(dest==='cured') bump('cured',j.n); emit(j.phase==='dry'?'dried':'cured',j);
      }
    }
  }
  // ---------- market ----------
  function price(id,g,stg,q){ const s=strain(id); return (boostLeft('price')>0?2:1)*s.game.budValue*(QMULT[q]||1)*st.market.f[id]*STAGE_MULT[stg]*GRADE[g||0]*mastery(id).m*earnMult()*(st.market.hot===id?2:1)*(evFx('swell')?1.25:1)*(boostOn('price')?1.5:1)*(festOn('leiday')?1.15:1); }
  function sell(stg,k,n,bonus){
    const have=st.inv[stg][k]||0; n=Math.min(n==null?have:n,have); if(n<=0) return 0;
    const {id,g,q}=unkey(k); const v=price(id,g,stg,q)*n*(bonus||1);
    st.inv[stg][k]-=n; if(st.inv[stg][k]<=0) delete st.inv[stg][k];
    addCash(v,'sale'); st.stats.sold+=n; addXP(Math.max(1,Math.round(n*.2*(1+strain(id).tier)*4/strain(id).game.buds))); addRep(n*.01*(1+strain(id).tier));
    done('sell'); emit('sold',{v,n,id}); return v;
  }
  function sellAll(filter){ let tot=0; for(const stg of ['cured','dry','wet']) for(const k of Object.keys(st.inv[stg])){ const {id}=unkey(k); if(!filter||filter(id,stg)) tot+=sell(stg,k); } return tot; }
  function tickMarket(dt){
    const m=st.market; m.next-=dt;
    if(m.next<=0){ m.next=5;
      S.forEach(s=>{ let f=m.f[s.id]; f+=(1-f)*.06+(Math.random()-.5)*.09; m.f[s.id]=Math.max(.55,Math.min(1.8,f)); const h=m.hist[s.id]; h.push(+m.f[s.id].toFixed(3)); if(h.length>24) h.shift(); });
    }
    if(m.hotT>0){ m.hotT-=dt; if(m.hotT<=0){ m.hot=null; m.hotT=-(150+Math.random()*120); } }
    else { m.hotT+=dt; if(m.hotT>=0){ const pool=S.filter(s=>st.discovered[s.id]); const s=pool[Math.floor(Math.random()*pool.length)]; m.hot=s.id; m.hotT=90; emit('hot',s); } }
  }
  // ---------- order board (contracts) ----------
  const NAMES=['Auntie Rose','Uncle Bo','Kimo','Leilani','Makoa','Pua','Surfer Jake','Kalani','Hoku','Nalu','Tourist Brenda','Chef Kekoa','Coach Mahina','Dr. Akana'];
  const BUYERS=[{n:'Neighbor',tier:0,bonus:0},{n:'Local cafe',tier:1,bonus:.1},{n:'North Shore surf lodge',tier:2,bonus:.25},{n:'Resort wellness spa',tier:3,bonus:.4},{n:'Licensed dispensary chain',tier:4,bonus:.6}];
  function orderSlots(){ return 3+(repTier()>=2?1:0)+(repTier()>=4?1:0); }
  function orderPool(){ return S.filter(s=>st.discovered[s.id]&&!EVENT_ONLY[s.id]&&(st.harv[s.id]||st.seeds[s.id]||s.tier<=Math.max(0,maxTierOwned()))); }
  function maxTierOwned(){ let t=0; S.forEach(s=>{ if(st.harv[s.id]) t=Math.max(t,s.tier); }); return t; }
  function newOrder(){
    const pool=orderPool(); if(!pool.length) return null;
    const grown=pool.filter(s=>(st.harv[s.id]||0)>0||['dry','cured','wet'].some(stg=>Object.keys(st.inv[stg]).some(k=>unkey(k).id===s.id&&st.inv[stg][k]>0)));
    const use=grown.length?grown:pool;
    const s=use[Math.floor(Math.random()*use.length)];
    const n=Math.max(2,Math.round(s.game.buds*(.8+Math.random()*1.6)));
    const rt=repTier(), B=BUYERS.filter(b=>b.tier<=rt), buyer=B[Math.floor(Math.random()*B.length)];
    const mult=1.6+Math.random()*.6+buyer.bonus;
    return {id:Math.random().toString(36).slice(2,8), who:buyer.tier?buyer.n:NAMES[Math.floor(Math.random()*NAMES.length)], buyer:buyer.n, s:s.id, n, mult, t:Math.max(900,s.game.growSec*3+600), T:0, rep:Math.round(4+3*s.tier+n*.5)};
  }
  function orderValue(o){ return strain(o.s).game.budValue*o.n*o.mult*earnMult(); }
  function orderHave(o){ let n=0; for(const stg of ['dry','cured']) for(const [k,c] of Object.entries(st.inv[stg])) if(unkey(k).id===o.s) n+=c; return n; }
  function fillOrder(id){ if(!F.orders) return false; const o=st.orders.find(x=>x.id===id); if(!o||orderHave(o)<o.n) return false;
    let need=o.n; for(const stg of ['dry','cured']){ const ks=Object.keys(st.inv[stg]).filter(k=>unkey(k).id===o.s).sort((a,b)=>'CBA'.indexOf(unkey(a).q)-'CBA'.indexOf(unkey(b).q)); for(const k of ks){ const t=Math.min(need,st.inv[stg][k]); st.inv[stg][k]-=t; need-=t; if(st.inv[stg][k]<=0) delete st.inv[stg][k]; if(!need) break; } if(!need) break; }
    const v=orderValue(o); addCash(v,'order'); addRep(o.rep); addXP(3+strain(o.s).tier*4); st.stats.orders++; st.stats.sold+=o.n;
    st.orders=st.orders.filter(x=>x!==o); st.orderT=Math.min(st.orderT,20); done('order'); emit('order',{o,v}); return true; }
  function tickOrders(){ /* Retired. Saved st.orders stays on the file and is not cleared, expired, or refilled. */ }
  // ---------- walk-in customers with preferences ----------
  const PREFS=[
    {k:'type',v:'Indica',t:'Something heavy and relaxing (Indica)'},{k:'type',v:'Sativa',t:'Something uplifting (Sativa)'},{k:'type',v:'Hybrid',t:'A balanced hybrid'},
    {k:'island',t:'Anything Hawaiian-grown'},{k:'thc',t:'The strongest you have (25%+ THC)'},{k:'cbd',t:'CBD-rich, no buzz please'},
    {k:'flavor',v:'Citrus',t:'Something citrusy'},{k:'flavor',v:'Sweet',t:'Something sweet'},{k:'flavor',v:'Earthy',t:'Earthy and classic'},{k:'flavor',v:'Berry',t:'Berry flavors'},{k:'flavor',v:'Pine',t:'Piney and fresh'},{k:'flavor',v:'Grape',t:'Grape all day'},
  ];
  function prefOk(c,s){ const P=c.pref; if(P.k==='type') return s.type===P.v; if(P.k==='island') return s.island; if(P.k==='thc') return (s.thc||s.thcEstimate||0)>=25; if(P.k==='cbd') return (s.cbd||0)>=5; if(P.k==='flavor') return (s.flavors||[]).includes(P.v); return false; }
  function custMatch(c){ return []; }
  function regTier(who){ const n=(st.regs||{})[who]||0; return n>=18?3:n>=9?2:n>=3?1:0; }
  // Walk-in selling is gone. Stored st.cust / st.upg.stand stay on the save and do nothing.
  function serveCust(){ if(st) st.cust=[]; return false; }
  function tickCust(){ if(st&&st.cust&&st.cust.length) st.cust=[]; }
  // ---------- seasons (24-day island year): wet season 10 days, dry season 12 days, Makahiki harvest festival 2 days ----------
  // wet: more rain/storms, mold risk x1.6 outdoors, indicas +10% outdoor yield. dry: more sun, outdoor plants drink 30% faster,
  // Makahiki is the harvest festival: +25% XP. Selling stays on the Market.
  const SEASONS={wet:{name:'Wet season',fav:'Indica',tip:'Rain and storms are more common and mold spreads faster outdoors. Indicas get +10% outdoor yield.'},
    dry:{name:'Dry season',fav:'Sativa',tip:'Long sunny days. Outdoor plants drink 30% faster. Sativas get +10% outdoor yield.'},
    makahiki:{name:'Makahiki',fav:null,tip:'The harvest festival. You earn +25% XP. Sell buds at the Market.'}};
  function season(){ const d=dayNum()%24; return d<10?'wet':d<22?'dry':'makahiki'; }
  function seasonYield(){ return 1; }
  let lastSeason=null;
  function dayNum(){ return Math.floor(st.time/DAY_LEN); }
  function marketDay(){ return false; }
  let lastDay=-1; function tickDay(){ const d=dayNum(); if(lastDay>=0&&d!==lastDay&&marketDay()) emit('marketday'); lastDay=d; const se=season(); if(lastSeason&&se!==lastSeason) emit('season',SEASONS[se]); lastSeason=se; }
  // ---------- weather ----------
  function tickWeather(){ if(!st.weather) return; st.weather.type='sunny'; st.weather.rainbow=0; st.weather.t=0; }
  // ---------- automation ----------
  const auto={r:0,m:0,w:0,f:0};
  function tickAuto(dt,offline){
    if(lv('water')>=3){ auto.w+=dt; if(auto.w>=20){ auto.w=0; st.plots.forEach(p=>{ if(p.strain&&p.prog<1&&p.water<.4){ p.water=1; if(!offline&&p.loc===st.loc) emit('sprinkle',p);} }); } }
    if(lv('fert')) st.plots.forEach(p=>{ if(p.zone==='in'&&isHungry(p)) feed(p,true); });
    if(lv('nutes')>=2){ auto.f+=dt; if(auto.f>=8){ auto.f=0; st.plots.forEach(p=>{ if(isHungry(p)) feed(p,true); }); } }
    if(st.vip){ auto.r+=dt; if(auto.r>=6){ auto.r=0; if(invCount('wet')) loadDryer(); } }
    if(st.vip){ auto.m+=dt; if(auto.m>=10){ auto.m=0;
      sellAll((id,stg)=>stg!=='wet'&&(st.market.f[id]>=1||st.market.hot===id||(stg==='dry'&&!lv('cure')&&st.market.f[id]>=.9)));
      for(const k of Object.keys(st.goods||{})) if(st.market.f[k.split('|')[1]]>=.95) sellGood(k); } }
  }
  // ---------- breeding: pheno hunting mystery ----------
  // Recipes are never shown up front. Players cross any two parents they own; a documented cross reveals the strain.
  function pName(a){ return a.type==='s'?strain(a.id).name:a.name; }
  function pairKey(a,b){ return [pName(a).toLowerCase(),pName(b).toLowerCase()].sort().join(' × '); }
  function recipesFor(a,b){
    const A=pName(a).toLowerCase(), B=pName(b).toLowerCase();
    const aid=a.type==='s'?a.id:null, bid=b.type==='s'?b.id:null, out=[];
    for(const s of S){
      if(!s.parents.length) continue;
      const P=s.parents.map(x=>x.toLowerCase()), I=s.parentIds;
      const is=(X,xid,i)=>X===P[i]||(xid&&xid===I[i]);
      if(s.parents.length===1){ if((A===B||aid&&aid===bid) && is(A,aid,0)) out.push(s); continue; }
      if((is(A,aid,0)&&is(B,bid,1))||(is(A,aid,1)&&is(B,bid,0))) out.push(s);
    }
    return out;
  }
  function recipeFor(a,b){ const L=recipesFor(a,b); return L.find(s=>!st.discovered[s.id])||L[0]||null; }
  // ---------- BREEDING END GAME ----------
  // Every bred strain starts as an unstable F1 line. Each pheno hunt where you keep a mother advances the line one filial generation
  // (F1 -> F2 ... F6). Lines are 'stable' from F4 (IBL at F6). Unstable lines lose quality and yield; stable lines gain a bonus.
  // Legendary recipes only take when the strain parents are stable lines (F4+) in the Breeding Pheno Room; pollen-only legendaries
  // need any two stable lines you own. Seed-shop / store strains are commercial lines and count as stable (F6).
  const LINE={stable:4,max:6};
  // Old saves stored a generation as a number, as {g:n}, or as null. A missing line is a commercial stable (F6).
  // A present but unreadable record is an unfinished F1, never a free IBL.
  function clampGen(n){ n=Math.round(+n); if(!isFinite(n)||n<1) return 1; return Math.min(LINE.max, n); }
  function lineBag(){ const bag=st&&st.lines; return bag&&typeof bag==='object'&&!Array.isArray(bag)?bag:null; }
  function lineRecord(v, present){
    if(typeof v==='number'&&isFinite(v)) return {gen:clampGen(v)};
    if(v&&typeof v==='object'&&!Array.isArray(v)){
      const raw=typeof v.gen==='number'&&isFinite(v.gen)?v.gen:(typeof v.g==='number'&&isFinite(v.g)?v.g:1);
      const rec=Object.assign({},v); rec.gen=clampGen(raw); return rec;
    }
    return present?{gen:1}:null;
  }
  function linePresent(id){ const bag=lineBag(); return !!(bag&&Object.prototype.hasOwnProperty.call(bag,id)); }
  function lineOf(id){ return linePresent(id)?lineRecord(lineBag()[id],true):null; }
  function eachLine(){ const bag=lineBag(); if(!bag) return []; return Object.keys(bag).map(k=>[k,lineRecord(bag[k],true)]); }
  // Load drops nulls, strings, and arrays. A number or {g}/{gen} object is a real record. A missing key stays commercial F6.
  function healLines(map){ const src=map&&typeof map==='object'&&!Array.isArray(map)?map:{}; const out={};
    Object.keys(src).forEach(k=>{ if(typeof k!=='string'||!k) return; const v=src[k];
      if(typeof v==='number'&&isFinite(v)) out[k]=lineRecord(v,true);
      else if(v&&typeof v==='object'&&!Array.isArray(v)) out[k]=lineRecord(v,true);
    }); return out; }
  function healKeepers(map){ const src=map&&typeof map==='object'&&!Array.isArray(map)?map:{}; const out={}; Object.keys(src).forEach(k=>{ const v=src[k]; if(v&&typeof v==='object'&&!Array.isArray(v)) out[k]=v; }); return out; }
  function keeperRec(id){ const K=st.keepers&&st.keepers[id]; return K&&typeof K==='object'&&!Array.isArray(K)?K:null; }
  function lineGen(id){ const rec=lineOf(id); return rec?rec.gen:LINE.max; }
  function lineName(id){ const rec=lineOf(id), g=rec?rec.gen:LINE.max; return rec&&rec.heir?'Heirloom (F6)':g>=LINE.max?'IBL (F6)':'F'+g+(g>=LINE.stable?' stable':' unstable'); }
  function lineMult(id){ const rec=lineOf(id); if(!rec) return 1; const g=rec.gen; return rec.heir?HEIR.mult:g>=LINE.max?1.06:g>=LINE.stable?1.03:.86+.04*g; }
  function stableLines(){ return eachLine().filter(([,v])=>v.gen>=LINE.stable).map(([k])=>k); }

  // ---------- F6 end-game tier: heirloom certification + the Seed Vault ----------
  // An F6 (IBL) line can be certified as a Kauai Heirloom: one at a time, 24 real hours in the seed bank (Breeding Pheno Room needed).
  // Heirlooms get a bigger line bonus (+12%), a gold ring in the strain web, and count toward Seed Vault milestones.
  const HEIR={sec:86400, cost:[25000,0], mult:1.12};
  const VAULT=[{n:1,name:'Seed Keeper',r:{gems:60,legPacks:1}},{n:3,name:'Heirloom Breeder',r:{gems:120,legPacks:1,hints:3}},{n:6,name:'Island Seed Bank',r:{gems:250,legPacks:2}},
    {n:12,name:'Master of Lines',r:{gems:400,legPacks:3}},{n:18,name:'Kauai Legend',r:{gems:800,legPacks:5}}];
  function heirCount(){ return eachLine().filter(([,v])=>v.heir).length; }
  function heirCost(id){ return Math.round(HEIR.cost[0]*Math.max(1,strain(id).tier)); }
  function canCertify(id){ const L=lineOf(id); return !!(L&&L.gen>=LINE.max&&!L.heir&&st.breedLab&&!st.cert); }
  function startCertify(id){ if(!canCertify(id)){ emit('toast',{t:st.cert?'The seed bank is already certifying a line':'Only F6 (IBL) lines can be certified, in the Breeding Pheno Room',k:'bad'}); return false; }
    if(!spend(heirCost(id))) return false; st.cert={id,t:0,dur:HEIR.sec}; emit('certstart',id); save(); return true; }
  function tickCert(dt){ const C=st.cert; if(!C) return; C.t+=dt; if(C.t<C.dur) return; st.cert=null; const L=st.lines&&st.lines[C.id]; if(L&&typeof L==='object'&&!Array.isArray(L)){ L.heir=Date.now(); } bump('heirlooms'); emit('heirloom',{id:C.id,n:heirCount()}); checkVault(); }
  function checkVault(){ st.vault=st.vault||{}; const n=heirCount(); VAULT.forEach((v,i)=>{ if(n>=v.n&&!st.vault[i]){ st.vault[i]=1; emit('vault',v); } }); }
  function claimVault(i){ st.vault=st.vault||{}; if(st.vault[i]!==1) return false; st.vault[i]=2; grantReward(VAULT[i].r,'Seed Vault'); emit('vaultclaim',VAULT[i]); save(); return true; }
  function legendaryGate(s,a,b){ if(!s||s.tier<4) return null; if(!st.breedLab) return 'Legendary recipes need the Breeding Pheno Room';
    const sp=[a,b].filter(x=>x.type==='s').map(x=>x.id); const bad=sp.filter(id=>lineGen(id)<LINE.stable);
    if(bad.length) return 'Legendary cross! Stabilize '+bad.map(id=>strain(id).name).join(' and ')+' to F'+LINE.stable+' first (keep mothers from pheno hunts)';
    if(!sp.length&&stableLines().length<2) return 'Legendary cross! You need two stable (F'+LINE.stable+'+) bred lines before this pollen will take';
    return null; }
  function parentTier(a){ if(a.type==='s') return strain(a.id).tier; return 2; }
  function crossCost(a,b){ return [30,120,600,3000,15000][Math.max(parentTier(a),parentTier(b))]; }
  const CROSS_T=[600,1800,7200,21600,43200], HUNT_T=[900,2700,10800,28800,57600];   // real seconds by child tier: 10 min .. 12 h crosses, 15 min .. 16 h grow-outs
  function crossTime(a,b){ const s=recipeFor(a,b), t=s?s.tier:Math.max(parentTier(a),parentTier(b)); return Math.round(CROSS_T[Math.min(4,t)]*(st.breedLab?.6:1)*Math.pow(.85,lv('labPollen'))); }
  function triedResult(a,b){ return st.tried[pairKey(a,b)]; } // undefined | 'dud' | strain id
  const FAM=[['Hawaiian',/hawai|maui|kona|puna|kauai/i],['Kush',/kush|og\b|ogkb|bubba|hindu/i],['Cookies',/cookie|gsc|gelato|biscotti|mints|cake|sherb|sherbert|runtz|zkittlez|original z|wife|y life/i],['Diesel / Chem',/diesel|chem|gmo|gasoline|dawg/i],['Purple',/purple|grape|granddaddy|purps|punch|uva|ape/i],['Fruit',/apple|banana|cherry|papaya|guava|tropic|clementine|lemon|grapefruit|mimosa|blueberry|berry/i],['Skunk / Haze',/skunk|haze|durban|thai|african|colombian|afghani|durb/i],['Breath',/breath|mendo|dosi|do-si|face off/i]];
  function familyOf(name){ for(const [f,re] of FAM) if(re.test(name)) return f; return 'Heirloom'; }
  function vagueHint(s){ if(!s||!Array.isArray(s.parents)||!s.parents.length) return null; const f=s.parents.map(familyOf); return s.parents.length===1?'Parents: a '+f[0]+' line crossed with itself':'Parents: one '+f[0]+', one '+f[1]; }
  function hintLevel(s){ // 0 nothing, 1 vague family hint, 2+ exact parents revealed by tokens
    const rev=st.hintRev&&typeof st.hintRev==='object'&&!Array.isArray(st.hintRev)?st.hintRev:{}; const r=rev[s.id]||0; if(r) return 1+r; return st.level>=s.game.unlockLevel-4||st.fails>=4?1:0; }
  function useHint(id){ const s=strain(id); if(!s||st.discovered[id]||!s.mystery) return false; const r=st.hintRev[id]||0; if(r>=Math.min(2,s.parents.length)) return false; if(st.hints<1){ emit('toast',{t:'No hint tokens. Earn them from quests, events and failed crosses',k:'bad'}); return false; } st.hints--; st.hintRev[id]=r+1; emit('hint',{s,r:r+1}); return true; }
  function cloneCost(name){ return 300; }
  function buyClone(name){ if(st.clones[name]) return false; if(!spend(cloneCost(name))) return false; st.clones[name]=true; emit('clone',name); return true; }
  function startBreed(a,b){
    if(st.breed) return false; if(!gate('breed')){ emit('toast',{t:'The Pheno Room opens at level '+GATE.breed,k:'bad'}); return false; }
    const s=recipeFor(a,b); { const why=legendaryGate(s,a,b); if(why){ emit('toast',{t:why,k:'bad long'}); return false; } }
    const c=crossCost(a,b); if(!spend(c)) return false;
    st.breed={a,b,id:s?s.id:null,t:0,dur:crossTime(a,b),key:pairKey(a,b)}; done('breed'); emit('breedstart',{a,b}); return true;
  }
  // ---------- pheno hunt: pop a pack of seeds of one strain, grow them out side by side, keep the best as a mother ----------
  // Every plant of that strain then carries the keeper's traits (cuts from the mother). The Breeding Pheno Room hunts 6 instead of 4 with better odds.
  const TERPS=['Gassy','Fruity','Earthy','Floral','Citrus','Piney','Sweet','Spicy'];
  function huntSize(){ return st.breedLab?6:4; }
  function huntTime(id){ return Math.round(HUNT_T[Math.min(4,strain(id).tier)]*(st.breedLab?.6:1)*Math.pow(.8,lv('labTissue'))); }
  function canHunt(){ return st.phenoRoom&&gate('breed')&&!st.hunt; }
  function startHunt(id){ if(!canHunt()||!st.discovered[id]) return false; const n=huntSize(); if((st.seeds[id]||0)<n){ emit('toast',{t:'You need '+n+' seeds of this strain for a pheno hunt',k:'bad'}); return false; }
    st.seeds[id]-=n; st.hunt={id,n,t:0,dur:huntTime(id),phenos:null}; bump('hunts'); emit('hunt',st.hunt); return true; }
  function rollPhenos(H){ const L=(st.breedLab?1:0)+(boostLeft('pheno')>0?1.5:0), r=(a,b)=>a+Math.random()*(b-a), rd=x=>Math.round(x*100)/100; const out=[];
    for(let i=0;i<H.n;i++) out.push({k:'#'+(i+1),y:rd(r(.85,1.18+.06*L)),q:rd(r(-.05,.07+.03*L)),g:rd(r(.9,1.12+.04*L)),terp:TERPS[Math.floor(Math.random()*TERPS.length)],h:r(.75,1.15)});
    return out; }
  function phenoScore(x){ return (x.y-1)+(x.q*2)+(x.g-1); }
  function keepPheno(i){ const H=st.hunt; if(!H||!H.phenos||!H.phenos[i]) return false; const x=H.phenos[i]; st.keepers[H.id]=Object.assign({at:Date.now()},x); st.hunt=null;
    const rec=lineOf(H.id); if(rec&&rec.gen<LINE.max){ const bag=lineBag()||(st.lines={}); bag[H.id]=Object.assign({},rec,{gen:rec.gen+1}); emit('linegen',{id:H.id,gen:bag[H.id].gen}); } bump('keepers'); emit('keeper',{id:H.id,x}); return true; }
  function dropHunt(){ if(!st.hunt||!st.hunt.phenos) return false; st.hunt=null; return true; }
  // cuttings from a mother: snip a few tips, root them in a clone dome (rooting cubes ~$2 each), they come out as rooted clones
  // that plant 10% grown and carry the mother's traits. A mother needs a rest between snips; the Breeding Pheno Room roots faster.
  const CUT={n:4,cost:2,rest:180,root:90};
  function cutState(id){ const K=keeperRec(id); if(!K) return null; const now=Date.now(); return {ready:!(K.next>now), wait:Math.max(0,((K.next||0)-now)/1000)}; }
  function takeCuttings(id){ const K=keeperRec(id); if(!K) return false; const c=cutState(id); if(!c.ready){ emit('toast',{t:'This mother needs to regrow before you snip again',k:'bad'}); return false; }
    const n=CUT.n+(st.breedLab?2:0); if(!spend(CUT.cost*n)) return false; K.next=Date.now()+CUT.rest*1000; K.cut=(K.cut||0)+n;
    st.cuts=st.cuts||[]; st.cuts.push({id,n,t:0,dur:Math.round(CUT.root*(st.breedLab?.6:1))}); bump('cuttings',n); emit('cuttings',{id,n}); return true; }
  function tickCuts(dt){ if(!st.cuts||!st.cuts.length) return; for(const c of st.cuts) c.t+=dt; const done_=st.cuts.filter(c=>c.t>=c.dur); if(!done_.length) return;
    st.cuts=st.cuts.filter(c=>c.t<c.dur); st.cutSeeds=st.cutSeeds||{}; for(const c of done_){ st.seeds[c.id]=(st.seeds[c.id]||0)+c.n; st.cutSeeds[c.id]=(st.cutSeeds[c.id]||0)+c.n; emit('rooted',c); } }
  function tickHunt(dt){ tickCuts(dt); const H=st.hunt; if(!H||H.phenos) return; H.t+=dt; if(H.t>=H.dur){ H.phenos=rollPhenos(H); if(lv('labSeq')) st.hints++; emit('huntdone',H); premiumDrop(DROP.huntPremium,'pheno hunt'); seasonDrop(DROP.huntSeason,'pheno hunt'); } }
  function tickBreed(dt){ tickHunt(dt); tickCert(dt); if(!st.breed) return; st.breed.t+=dt; if(st.breed.t<st.breed.dur) return;
    const B=st.breed; st.breed=null; st.stats.bred++; bump('bred',0);
    if(B.id){ const s=strain(B.id); st.lines=st.lines||{}; if(!st.lines[B.id]) st.lines[B.id]={gen:1,at:Date.now()}; const fresh=discover(B.id,false,'bred'); st.tried[B.key]=B.id; st.recipes[B.id]=B.key; st.seeds[B.id]=(st.seeds[B.id]||0)+3; addXP(10+s.tier*10); emit('bred',{s,fresh}); }
    else { st.tried[B.key]='dud'; st.fails++; let hint=false; if(st.fails%3===0){ st.hints++; hint=true; } const back=[B.a,B.b].find(x=>x.type==='s'); if(back) st.seeds[back.id]=(st.seeds[back.id]||0)+1; addXP(3); emit('dud',{key:B.key,hint,back:back&&strain(back.id)}); } }
  // ---------- packs ----------
  function openPack(kind){
    const out=[]; const n=kind==='leg'?4:5;
    for(let i=0;i<n;i++){ const s=kind==='leg'&&i===0?pickSeed(3)||pickSeed(2):pickSeed(kind==='leg'?2:1); if(!s) continue; out.push(s); st.seeds[s.id]=(st.seeds[s.id]||0)+1; discover(s.id,true); }
    if(kind==='leg'){ st.hints+=2; const pd=premiumDrop(DROP.packPremium,'legendary pack'); if(pd) out.push(strain(pd)); const sd=seasonDrop(DROP.packSeason,'legendary pack'); if(sd) out.push(strain(sd)); }
    emit('pack',out); return out;
  }
  // ---------- upgrades / workers ----------
  function upgNeedOk(d){ return !d.need||(d.need==='gh'?st.ghBuilt:d.need==='land'?st.land:d.need==='in'?st.inBuilt:d.need==='lab'?st.breedLab:true); }
  function buyUpg(k){ if(k==='stand'||!UPG[k]) return false; const d=UPG[k], l=lv(k); if(l>=maxLv(d)) return false; if(!upgNeedOk(d)){ emit('toast',{t:'Unlock that location first',k:'bad'}); return false; } if(d.lvl&&st.level<d.lvl){ emit('toast',{t:d.name+' unlocks at level '+d.lvl,k:'bad'}); return false; } if(!spend(cost(d,l))) return false; st.upg[k]=l+1; if(k==='water'&&l+1>=1) done('hose'); emit('upgrade',k); return true; }
  function workerOk(){ return false; }
  function hire(){ return false; }
  // ---------- rebirth (New Season) ----------
  function rebirthNeed(){ return 2e6*Math.pow(4,st.rebirths); }
  function rebirth(){
    if(st.runEarn<rebirthNeed()) return false;
    const gain=manaGain();
    const keep={streak:st.streak,dq:st.dq,wq:st.wq,ach:st.ach,gems:st.gems,xp:st.xp,level:st.level,lifetime:st.lifetime,rebirths:st.rebirths+1,discovered:st.discovered,clones:st.clones,
      pass2x:st.pass2x,vip:st.vip,cos:st.cos,mgrSlot:st.mgrSlot,pass:st.pass,sq:st.sq,vault:st.vault,cert:st.cert,lines:st.lines,boosts:st.boosts,piggy:st.piggy,theme:st.theme,themes:st.themes,rarePacks:st.rarePacks,legPacks:st.legPacks,quest:st.quest,questDone:st.questDone,stats:st.stats,settings:st.settings,time:st.time,
      mana:st.mana+gain,manaSpent:st.manaSpent,harv:st.harv,sets:st.sets,rep:st.rep,hints:st.hints+mana('pheno'),hintRev:st.hintRev,tried:st.tried,fails:st.fails,recipes:st.recipes,playT:st.playT,fest:st.fest,pid:st.pid};
    st=newState(keep); st.market.f=Object.fromEntries(S.map(s=>[s.id,1])); S.forEach(s=>st.market.hist[s.id]=[]);
    st.cash+=2000*mana('roots'); st.garage=Math.min(GARAGE.length-1,mana('roots')); syncPlots();
    done('season'); emit('rebirth',{n:st.rebirths,gain}); save(); return true;
  }
  // ---------- story goals ----------
  function curQuest(){ return QUESTS[st.quest]; }
  function done(id){ const q=curQuest(); if(q&&q.id===id&&!st.questDone){ st.questDone=true; emit('questdone',q); } }
  // Goal state is derived from real progress, so goals done "early" (before the chain reached them), migrated saves and
  // players who never tap the card all stay in sync. If the player is more than one goal behind, the already-satisfied
  // goals are claimed automatically (rewards paid, one summary toast) and the card lands on the latest real goal.
  function questSat(q){ if(!q) return false; const t=st.stats||{};
    const c={plant:t.plant>0||st.plots.some(p=>p.strain), water:t.water>0, harvest:t.harvests>0, dry:t.dryLoads>0, sell:t.sold>0, gcap:capOf('garage')>5, feed:t.feed>0, hose:lv('water')>=1,
      order:t.orders>0, tent3:capOf('garage')>=9, land:st.land, field:st.plots.some(p=>(p.zone==='field'||p.zone==='gh')&&p.strain)||st.field>0, ghbuild:st.ghBuilt, mgr:st.plots.some(p=>p.zone==='gh'&&(p.strain||p.last)),
      breed:t.bred>0||!!st.breed, craft:(t.crafted||0)>0, ghfull:capOf('gh')>=INDOOR.ghPlants, permit:st.permit, indoor:st.inBuilt, inharv:t.inHarv>0, pheno:t.phenos>0, earn:st.runEarn>=2e6, season:false};
    if(c[q.id]) return true;
    // a later one-time milestone already reached means the player has clearly passed this step (e.g. bought land but never watered by hand)
    const MS=['gcap','hose','tent3','land','ghbuild','ghfull','permit','indoor']; const i=QUESTS.indexOf(q);
    return QUESTS.some((x,j)=>j>i&&MS.includes(x.id)&&c[x.id]); }
  function payQuest(q){ if(q.r.cash) addCash(q.r.cash,'quest'); if(q.r.gems) addGems(q.r.gems,'Goal complete'); if(q.r.hints) st.hints+=q.r.hints; }
  function checkQuest(){ let q=curQuest(); if(!q) return;
    // The order board is gone. Pay this goal once and step past it so the card never points at a missing tab. The quest stays in QUESTS so later indexes do not shift, and st.orders is left alone.
    if(q.id==='order'){ payQuest(q); st.quest++; st.questDone=false; q=curQuest(); if(!q) return; }
    if(!st.questDone&&questSat(q)) done(q.id);
    let n=0; const R={cash:0,gems:0,hints:0};
    while(st.questDone&&(q=curQuest())&&questSat(QUESTS[st.quest+1])){ payQuest(q); for(const k in R) R[k]+=q.r[k]||0; st.quest++; st.questDone=true; n++; }
    if(n){ emit('questcatchup',{n,R}); emit('toast',{t:'Caught up on '+n+' story goal'+(n>1?'s':'')+': '+[R.cash?fmt(R.cash):'',R.gems?R.gems+' gems':'',R.hints?R.hints+' hints':''].filter(Boolean).join(', '),k:'good'}); } }
  function claimQuest(){ const q=curQuest(); if(!q||!st.questDone) return false; payQuest(q);
    if(q.r.hints) emit('toast',{t:'+'+q.r.hints+' hint token'+(q.r.hints>1?'s':''),k:'gemt'});
    st.quest++; st.questDone=false; checkQuest(); emit('questclaim',q); return true; }
  // ---------- login streak, daily / weekly quests, achievements, events ----------
  function dayKey(d){ d=d||new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function weekKey(){ const d=new Date(); const m=new Date(d.getFullYear(),d.getMonth(),d.getDate()-((d.getDay()+6)%7)); return 'w'+dayKey(m); }
  const LOGIN=[{gems:10,cash:1},{gems:15},{gems:20,cash:2},{gems:25,hints:1},{gems:30,rarePacks:1},{gems:40,cash:4},{gems:60,legPacks:1}];
  function dailyReady(){ return st.streak.last!==dayKey(); }
  // forgiving calendar: missing up to 2 days pauses the streak instead of resetting it (no loss-aversion punishment)
  function streakDay(){ for(let k=1;k<=3;k++){ const y=new Date(); y.setDate(y.getDate()-k); if(st.streak.last===dayKey(y)) return st.streak.n+1; } return st.streak.n>0&&st.streak.last?Math.max(1,st.streak.n-((st.streak.n-1)%7))||1:1; }
  function streakSaved(){ const y=new Date(); y.setDate(y.getDate()-1); return !!st.streak.last&&st.streak.last!==dayKey(y)&&st.streak.last!==dayKey()&&streakDay()>1; }
  function dailyCash(r){ return r.cash?Math.round(r.cash*25*Math.pow(st.level,1.8)):0; }
  function claimDaily(){ if(!dailyReady()) return false; const n=streakDay(); st.streak={n,last:dayKey()}; st.stats.streakMax=Math.max(st.stats.streakMax||0,n);
    const r=LOGIN[(n-1)%7]; addGems(r.gems); if(r.cash) addCash(dailyCash(r),'daily'); if(r.rarePacks) st.rarePacks+=r.rarePacks; if(r.legPacks) st.legPacks+=r.legPacks; if(r.hints) st.hints+=r.hints;
    emit('login',{n,r}); return {n,r}; }
  function stat(k){ if(k==='earned') return st.lifetime; if(k==='disc') return Object.keys(st.discovered).length; if(k==='island') return S.filter(x=>x.island&&st.discovered[x.id]).length; if(k==='rebirths') return st.rebirths; if(k==='level') return st.level; if(k==='rep') return Math.floor(st.rep); if(k==='setsDone') return Object.keys(st.sets).length; if(k==='mastered') return Object.keys(st.harv).filter(i=>st.harv[i]>=25).length; return st.stats[k]||0; }
  const DQ_POOL=[
    {k:'scouted',t:n=>'Wet season: find and remove '+n+' hidden pest nests',n:()=>3,need:()=>season()==='wet'&&st.land},
    {k:'trained',t:n=>'Dry season: top or LST '+n+' plants',n:()=>4,need:()=>season()==='dry'&&st.land},
    {k:'pruned',t:n=>'Prune '+n+' plants',n:()=>5,need:()=>st.land},
    {k:'plant',t:n=>'Plant '+n+' seeds',n:L=>6+L},{k:'water',t:n=>'Water '+n+' plants',n:L=>8+Math.floor(L/2)},
    {k:'harvests',t:n=>'Harvest '+n+' plants',n:L=>5+L},{k:'sold',t:n=>'Sell '+n+' buds',n:L=>20+5*L},
    {k:'earned',t:n=>'Earn '+fmt(n),n:L=>Math.max(100,Math.round(60*Math.pow(L,2.6)/50)*50)},{k:'dryLoads',t:n=>'Load the drying racks '+n+' times',n:()=>3},
    {k:'feed',t:n=>'Feed '+n+' plants',n:()=>4},{k:'bred',t:()=>'Try a crossbreed',n:()=>1,need:()=>gate('breed')},
    {k:'inHarv',t:n=>'Harvest '+n+' indoor plants',n:()=>4,need:()=>st.inBuilt},{k:'cured',t:n=>'Cure '+n+' buds',n:L=>15+2*L,need:()=>lv('cure')>0},
  ];
  const WQ_POOL=[
    {k:'harvests',t:n=>'Harvest '+n+' plants',n:L=>60+8*L},{k:'earned',t:n=>'Earn '+fmt(n),n:L=>Math.max(1000,Math.round(600*Math.pow(L,2.6)/500)*500)},
    {k:'sold',t:n=>'Sell '+n+' buds',n:L=>300+40*L},
    {k:'bred',t:n=>'Try '+n+' crossbreeds',n:()=>5,need:()=>gate('breed')},{k:'mutants',t:n=>'Harvest '+n+' mutant plants',n:()=>2},
  ];
  function rollQuests(pool,count,rew){ const ok=pool.filter(q=>!q.need||q.need()); const out=[]; while(out.length<count&&ok.length){ const q=ok.splice(Math.floor(Math.random()*ok.length),1)[0]; const n=q.n(st.level); out.push({k:q.k,t:q.t(n),goal:n,base:stat(q.k),r:rew(),c:false}); } return out; }
  function retireCustQuest(q){ if(!q||q.k!=='customers') return; q.k='sold'; q.t='Sell '+(q.goal||1)+' buds at the Market'; q.base=Math.min(q.base||0, stat('sold')); }
  function retireOrderQuest(q){ if(!q||q.k!=='orders') return; q.k='sold'; q.t='Sell '+(q.goal||1)+' buds at the Market'; q.base=Math.min(q.base||0, stat('sold')); }
  function ensureQuests(){
    const L=st.level;
    if(!st.dq||st.dq.day!==dayKey()) st.dq={day:dayKey(),list:rollQuests(DQ_POOL,3,()=>({gems:5+Math.floor(L/5)*2,cash:Math.round(20*Math.pow(L,2))})),bonus:false};
    if(!st.wq||st.wq.week!==weekKey()) st.wq={week:weekKey(),list:rollQuests(WQ_POOL,3,()=>({gems:30+Math.floor(L/5)*5,cash:Math.round(200*Math.pow(L,2))})),bonus:false};
    for(const Q of [st.dq,st.wq]) if(Q&&Q.list) Q.list.forEach(q=>{ retireCustQuest(q); retireOrderQuest(q); });
  }
  function qProg(q){ return Math.min(q.goal,stat(q.k)-q.base); }
  function claimQ(which,i){ ensureQuests(); const Q=which==='w'?st.wq:st.dq, q=Q.list[i]; if(!q||q.c||qProg(q)<q.goal) return false; q.c=true; addGems(q.r.gems); addCash(q.r.cash,'quest'); emit('qclaim',q);
    if(!Q.bonus&&Q.list.every(x=>x.c)){ Q.bonus=true; if(which==='w'){ st.legPacks++; st.hints+=2; } else { st.rarePacks++; st.hints++; } emit('qbonus',which); } return true; }
  function questsReady(){ ensureQuests(); let n=0; for(const Q of [st.dq,st.wq]) Q.list.forEach(q=>{ if(!q.c&&qProg(q)>=q.goal) n++; }); return n+achReady(); }
  const ACH=[];
  [['harvests','Green Thumb','Harvest Moon','Bumper Crop','Breadbasket of the Isle',[10,100,1000,5000]],
   ['earned','First Dollar Days','Local Legend','Island Mogul','Tycoon of the Pacific',[1e4,1e6,1e8,1e10]],
   ['disc','Seed Collector','Strain Scholar','Living Seed Bank','Complete Strain Book',[15,30,45,S.length]],
   ['bred','Pollinator','Plant Breeder','Master Breeder',null,[1,10,30]],
   ['phenos','Pheno Hunter','Mystery Solver','Legend Keeper',null,[1,5,S.filter(s=>s.mystery).length]],
   ['inHarv','Lights On','Indoor Expert',null,null,[25,250]],
   ['golden','Golden Bud','Golden Touch',null,null,[1,10]],
   ['mutants','Strange Pheno','Mutation Hunter','Mad Botanist',null,[1,10,50]],
   ['island','Island Roots','All Island Strains',null,null,[3,S.filter(x=>x.island).length]],
   ['rebirths','New Season','Many Moons',null,null,[1,5]],
   ['streakMax','Week-Long Streak','Month-Long Streak',null,null,[7,30]],
   ['sold','Market Regular','Market Mogul',null,null,[500,10000]],
   ['orders','Order Up','Contract Grower','Island Supplier',null,[5,50,250]],
   ['customers','Good Listener','Neighborhood Favorite',null,null,[5,50]],
   ['rep','Local Favorite','Island Famous','Pacific Legend',null,[40,1200,5000]],
   ['setsDone','Collector','Completionist',null,null,[1,Object.keys(SETS).length]],
   ['mastered','Strain Master','Master of Many',null,null,[1,10]],
   ['legHarv','Legendary Harvest',null,null,null,[1]],
   ['geckos','Gecko Spotter','Gecko Whisperer',null,null,[1,25]],
   ['crafted','Hash Maker','Master Crafter',null,null,[5,200]],
   ['level','Rising Grower','Seasoned Grower','Island Elder',null,[10,25,50]],
  ].filter(([k])=>({orders:false,customers:F.customers,rep:F.repTiers,setsDone:F.sets,mastered:F.mastery})[k]!==false).forEach(([k,a,b,c,d,goals])=>goals.forEach((g,i)=>ACH.push({id:k+i,k,name:[a,b,c,d][i],goal:g,gems:[10,20,35,50][i]})));
  function achReady(){ return ACH.filter(a=>st.ach[a.id]===1).length; }
  function checkAch(){ ACH.forEach(a=>{ if(!st.ach[a.id]&&stat(a.k)>=a.goal){ st.ach[a.id]=1; emit('ach',a); } }); }
  function claimAch(id){ const a=ACH.find(x=>x.id===id); if(!a||st.ach[id]!==1) return false; st.ach[id]=2; addGems(a.gems); emit('achclaim',a); return true; }
  function bump(k,n){ if(n==null) n=1; if(n) st.stats[k]=(st.stats[k]||0)+n; }
  const EVENTS={ moon:{name:'Lucky Pheno Hunt',desc:'3x mutation chance, +1 hint token',dur:120}, festival:{name:'Island Festival',desc:'2x XP',dur:120}, swell:{name:'Big Swell',desc:'Surfers in town: +25% prices',dur:100} };
  function mutChance(p){ return (p&&p.zone==='garage'&&garageRole()==='pheno'?2:1)*(st.breedLab?2:1)*.035*(evFx('moon')?3:1)*(1+.25*mana('pheno')); }
  function tickEvent(dt){ if(!F.events||st.level<GATE.events) return; const e=st.event; if(e.id){ e.t-=dt; if(e.t<=0){ e.id=null; e.next=240+Math.random()*240; emit('eventend'); } } else { e.next-=dt; if(e.next<=0){ if(Math.random()<.4){ const se=seasonEv(); e.id='season'; e.t=se.dur; if(se.fx==='moon') st.hints++; bump('seasonEv'); emit('event',se); } else { const ks=Object.keys(EVENTS); const id=ks[Math.floor(Math.random()*ks.length)]; e.id=id; e.t=EVENTS[id].dur; if(id==='moon') st.hints++; emit('event',EVENTS[id]); } } } }
  function tierWeight(tier){ return tier>=3?1:tier===2?3:6; }
  // Same filter and weights as pickSeed. packOdds reads this so the shop table cannot drift from the roll.
  function seedPool(minT){
    const cap=Math.max(minT,2);
    const items=S.filter(s=>s.tier>=minT&&!s.mystery&&!EVENT_ONLY[s.id]&&s.tier<=cap);
    const weights=items.map(s=>tierWeight(s.tier));
    const total=weights.reduce((a,b)=>a+b,0);
    return {items,weights,total};
  }
  function pickSeed(minT){
    const {items,weights,total}=seedPool(minT);
    if(!items.length||!total) return null;
    let r=Math.random()*total;
    for(let i=0;i<items.length;i++){ r-=weights[i]; if(r<=0) return items[i]; }
    return items[0];
  }
  function poolOdds(minT){
    const {items,weights,total}=seedPool(minT);
    if(!total) return {tiers:[], empty:true};
    const by={};
    items.forEach((s,i)=>{
      const p=weights[i]/total;
      const row=by[s.tier]||(by[s.tier]={tier:s.tier, rarity:TIERN[s.tier]||s.rarity, chance:0, items:[]});
      row.chance+=p;
      row.items.push({id:s.id, name:s.name, rarity:s.rarity, chance:p});
    });
    const tiers=Object.keys(by).map(k=>by[k]).sort((a,b)=>a.tier-b.tier);
    tiers.forEach(t=>t.items.sort((a,b)=>a.name.localeCompare(b.name)));
    return {tiers, empty:false};
  }
  function slotOdds(minT, fallback){
    const primary=poolOdds(minT);
    if(!primary.empty) return Object.assign({minT, fallbackUsed:false}, primary);
    if(fallback!=null) return Object.assign({minT:fallback, fallbackUsed:true}, poolOdds(fallback));
    return {minT, fallbackUsed:false, tiers:[], empty:true};
  }
  // kind: 'rare' (5 independent Uncommon/Rare rolls) or 'leg' (1 Epic slot, 3 Rare slots, plus bonus rolls).
  function packOdds(kind){
    const leg=kind==='leg';
    const slots=leg
      ? [Object.assign({count:1, label:'Seed 1 of 4, Epic slot'}, slotOdds(3,2)), Object.assign({count:3, label:'Seeds 2 to 4, each rolls on its own'}, slotOdds(2))]
      : [Object.assign({count:5, label:'Each of the 5 seeds rolls on its own'}, slotOdds(1))];
    const bonuses=[];
    if(leg){
      const prem=PREMIUM.map(id=>strain(id)).filter(Boolean);
      bonuses.push({label:'Extra premium seed. This roll does not replace the 4 seeds.', chance:DROP.packPremium, none:1-DROP.packPremium,
        items:prem.map(s=>({id:s.id, name:s.name, rarity:s.rarity, chance:prem.length?DROP.packPremium/prem.length:0}))});
      const sid=window.PASS&&PASS.seasonNow&&PASS.seasonNow().strain;
      const ss=sid&&strain(sid);
      bonuses.push({label:'Extra season seed. This roll does not replace the 4 seeds.', chance:DROP.packSeason, none:1-DROP.packSeason,
        items:ss?[{id:ss.id, name:ss.name, rarity:ss.rarity, chance:DROP.packSeason}]:[]});
    }
    return {kind:leg?'leg':'rare', seedCount:leg?4:5, slots, bonuses, hints:leg?2:0};
  }
  // ---------- tick ----------
  function tick(dt,offline){
    st.playT+=dt; tickBoosts(dt);
    if(!offline){ syncTime(); tickWeather(dt); tickEvent(dt); tickCust(dt); tickGecko(dt); }
    for(const p of st.plots) tickPlot(p,dt,offline);
    tickDryer(dt); tickMarket(dt); tickBreed(dt); tickAuto(dt,offline); tickOrders(dt); tickCraft(dt);
    checkQuest(); achT+=dt; if(achT>1){ achT=0; checkAch(); safetyNet(); }
  }
  // Never soft-lock: if broke with nothing growing, nothing to sell and no seeds, Unko Kuli drops off free starter seeds.
  function safetyNet(){
    if(st.cash>=1) return; const seedBag=st.seeds&&typeof st.seeds==='object'&&!Array.isArray(st.seeds)?st.seeds:{}; if(Object.values(seedBag).some(n=>typeof n==='number'&&n>0)) return; if(st.plots.some(p=>p.strain)) return;
    if(invCount('wet')+invCount('dry')+invCount('cured')>0||st.dryer.length) return;
    st.seeds['northern-lights']=(st.seeds['northern-lights']||0)+3; st.selSeed='northern-lights'; emit('toast',{t:'Unko Kuli dropped off 3 free Northern Lights seeds. Keep growing!',k:'good'}); emit('seeds',{id:'northern-lights',n:3});
  }
  let achT=0;
  // Fast-forward (offline catch-up and time skips). Step grows for long absences so 3 days stays fast.
  function simulate(seconds,offline){
    const before={cash:st.cash,harv:st.stats.harvests,sold:st.stats.sold,upk:st.upkeepPaid,ripe:st.plots.filter(p=>p.strain&&p.prog>=1).length};
    let left=seconds; const step=Math.max(offline?3:2,seconds/20000); st.offCol=offline?0:Infinity;
    emit('mute',true);
    while(left>0){ const d=Math.min(step,left); if(offline) st.offCol=(st.offCol||0)+d; tick(d,true); left-=d; if(!offline){ st.t0-=d*1000; } } syncTime();
    emit('mute',false); st.offCol=0;
    return {seconds,cash:st.cash-before.cash,harvests:st.stats.harvests-before.harv,sold:st.stats.sold-before.sold,upkeep:st.upkeepPaid-before.upk,ripe:st.plots.filter(p=>p.strain&&p.prog>=1).length};
  }
  function syncTime(){ st.time=Math.max(0,(Date.now()-st.t0)/1000); }
  function setTime(x){ st.t0=Date.now()-x*1000; st.time=x; }
  const OFFLINE_CAP=()=>(st.vip?96:72)*3600;
  // ---------- save ----------
  // The localStorage key never changes with the schema version. Older and newer JSON is merged in;
  // a version bump must not delete the key or replace the farm with a fresh one.
  let saveWarnAt=0;
  function saveFailText(r){
    const blob=((r&&r.error)||'')+' '+((r&&r.message)||'');
    if(/quota/i.test(blob)) return 'Could not save: this browser is out of storage space. Export a backup from Settings.';
    if(/security|denied/i.test(blob)) return 'Could not save on this device. Export a backup from Settings before you leave.';
    return 'Could not save the farm. Export a backup from Settings before you leave.';
  }
  function warnSave(r){
    const t=typeof r==='string'?r:saveFailText(r);
    const now=Date.now(); if(now-saveWarnAt<15000) return; saveWarnAt=now;
    emit('toast',{t,k:'bad long'});
  }
  if(window.Store&&Store.onWriteFail) Store.onWriteFail((k,r)=>{ if(k===CFG.saveKey) warnSave(r); });
  function save(){
    if(st._holdSave){ warnSave('The save on this device could not be read, so it was not overwritten. Export it from Settings.'); return false; }
    try{
      const prev=Store.get(CFG.saveKey);
      if(prev){
        let old=null; try{ old=JSON.parse(prev); }catch(e){ old=null; }
        if(old&&typeof old==='object'&&!Array.isArray(old)&&playerIdOk(old.pid)&&playerIdOk(st.pid)&&old.pid!==st.pid){
          const ahead=(old.level|0)>(st.level|0)
            ||((old.level|0)===(st.level|0)&&typeof old.cash==='number'&&old.cash>st.cash+1)
            ||(Array.isArray(old.plots)&&old.plots.some(p=>p&&p.strain)&&!(Array.isArray(st.plots)&&st.plots.some(p=>p&&p.strain))&&(old.level|0)>=(st.level|0));
          if(ahead){ warnSave('A further-along farm is already saved on this device, so it was not overwritten.'); return false; }
        }
      }
    }catch(e){}
    st.lastSave=Date.now();
    let json; try{ json=JSON.stringify(st); }catch(e){ warnSave('Could not save the farm. Export a backup from Settings before you leave.'); return false; }
    const r=Store.set(CFG.saveKey,json);
    if(r&&r.ok===false){ warnSave(r); return false; }
    return true;
  }
  function toB64(str){
    const bytes=new TextEncoder().encode(str); let bin='';
    for(let i=0;i<bytes.length;i+=0x8000) bin+=String.fromCharCode.apply(null, bytes.subarray(i,i+0x8000));
    return btoa(bin);
  }
  function fromB64(b64){
    const bin=atob(b64); const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function exportBackup(){
    if(st._holdSave) return {corrupt:true, code:st._holdSave, json:st._holdSave, file:'maui-wowie-farms-save-raw.txt'};
    const save=JSON.parse(JSON.stringify(st));
    delete save.econMigrated; delete save.schemaNote;
    const wrap={mwf:1, game:CFG.title||'Maui Wowie Farms', exported:st.lastSave||Date.now(), save};
    const json=JSON.stringify(wrap);
    return {corrupt:false, code:'MWF1.'+toB64(json), json, file:'maui-wowie-farms-save.json'};
  }
  function parseBackup(text){
    let s=String(text||'').replace(/^\uFEFF/,'').trim();
    if(!s) throw new Error('Paste a backup code or choose a file first.');
    if(/^MWF1\./i.test(s)){
      try{ s=fromB64(s.slice(5).replace(/\s+/g,'')); }
      catch(e){ throw new Error('That backup code is damaged.'); }
    }
    let data; try{ data=JSON.parse(s); }catch(e){ throw new Error('That backup is not valid.'); }
    let save=data;
    if(data&&typeof data==='object'&&!Array.isArray(data)&&data.mwf===1&&data.save&&typeof data.save==='object'&&!Array.isArray(data.save)) save=data.save;
    if(!save||typeof save!=='object'||Array.isArray(save)) throw new Error('That file is not a farm save.');
    if(save.v!=null&&typeof save.v!=='number') throw new Error('That save has a bad version.');
    if(save.cash!=null&&typeof save.cash!=='number') throw new Error('That save has a bad cash value.');
    if(save.level!=null&&typeof save.level!=='number') throw new Error('That save has a bad level.');
    if(save.plots!=null&&!Array.isArray(save.plots)) throw new Error('That save has a bad plot list.');
    if(save.workers!=null&&(typeof save.workers!=='object'||Array.isArray(save.workers))) throw new Error('That save has a bad crew list.');
    const known=typeof save.v==='number'||typeof save.cash==='number'||Array.isArray(save.plots)||(save.workers&&typeof save.workers==='object');
    if(!known) throw new Error('That file is missing farm data.');
    return save;
  }
  function installBackup(saveObj){
    let clean; try{ clean=JSON.parse(JSON.stringify(saveObj)); }catch(e){ return {ok:false, error:'That backup could not be stored.'}; }
    delete clean._holdSave; delete clean.econMigrated; delete clean.schemaNote;
    const json=JSON.stringify(clean);
    const r=Store.set(CFG.saveKey,json);
    if(r&&r.ok===false) return {ok:false, error:saveFailText(r)};
    if(Store.get(CFG.saveKey)!==json) return {ok:false, error:'The backup was not stored on this device.'};
    load();
    return {ok:true};
  }
  function adoptSave(raw){
    const prevV=raw.v;
    st=Object.assign(newState(),raw);
    st.stats=Object.assign(newState().stats,(raw.stats&&typeof raw.stats==='object'&&!Array.isArray(raw.stats))?raw.stats:{});
    if(!raw.event||typeof raw.event!=='object') st.event={id:null,t:0,next:240};
    if(!Array.isArray(st.plots)) st.plots=freshPlots();
    st.plots=st.plots.filter(p=>p&&typeof p==='object');
    if(raw.workers&&typeof raw.workers==='object'&&!Array.isArray(raw.workers)) st.workers=Object.assign({},raw.workers);
    else st.workers={};
    if(!st.upg||typeof st.upg!=='object'||Array.isArray(st.upg)) st.upg={};
    if(!st.seeds||typeof st.seeds!=='object'||Array.isArray(st.seeds)) st.seeds={};
    if(!st.discovered||typeof st.discovered!=='object'||Array.isArray(st.discovered)) st.discovered={};
    if(!st.settings||typeof st.settings!=='object'||Array.isArray(st.settings)) st.settings={music:true,sfx:true,hq:true};
    if(!st.themes||typeof st.themes!=='object') st.themes={classic:true};
    if(!st.inv||typeof st.inv!=='object'||Array.isArray(st.inv)) st.inv={wet:{},dry:{},cured:{}};
    ['wet','dry','cured'].forEach(k=>{ if(!st.inv[k]||typeof st.inv[k]!=='object') st.inv[k]={}; });
    if(!st.market||typeof st.market!=='object'||Array.isArray(st.market)) st.market={f:{},hist:{},hot:null,hotT:-150,next:0};
    if(!st.market.f||typeof st.market.f!=='object') st.market.f={};
    if(!st.market.hist||typeof st.market.hist!=='object') st.market.hist={};
    if(st.market.hot!=null&&typeof st.market.hot!=='string') st.market.hot=null;
    // Old saves sometimes stored lists as objects, nulls, or id arrays. Coerce them so a panel
    // can open instead of throwing and looking like a dead menu button.
    const asList=v=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object'):(v&&typeof v==='object'?Object.values(v).filter(x=>x&&typeof x==='object'):[]);
    const asMap=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
    ['orders','cust','dryer','cuts','craft'].forEach(k=>{ st[k]=asList(st[k]); });
    ['goods','clones','keepers','lines','tried','recipes','harv','upkeepWarn','hintRev','cutSeeds','seeds','workers','upg','boosts','fest','lb','sets','manaSpent'].forEach(k=>{ st[k]=asMap(st[k]); });
    const keepMap=(v,ok)=>{ const src=v&&typeof v==='object'&&!Array.isArray(v)?v:{}; const out={}; Object.keys(src).forEach(k=>{ if(typeof k==='string'&&k&&ok(src[k])) out[k]=src[k]; }); return out; };
    const numOk=v=>typeof v==='number'&&isFinite(v);
    ['seeds','harv','cutSeeds','workers','upg','hintRev','boosts','goods','manaSpent'].forEach(k=>{ st[k]=keepMap(st[k], numOk); });
    ['wet','dry','cured'].forEach(k=>{ st.inv[k]=keepMap(st.inv[k], numOk); });
    st.tried=keepMap(st.tried, v=>typeof v==='string'&&v);
    st.recipes=keepMap(st.recipes, v=>typeof v==='string'&&v);
    st.clones=keepMap(st.clones, v=>v===true||v===1);
    st.lines=healLines(st.lines);
    st.keepers=healKeepers(st.keepers);
    if(Array.isArray(raw.discovered)){ st.discovered={}; raw.discovered.forEach(id=>{ if(typeof id==='string') st.discovered[id]=true; }); }
    else st.discovered=keepMap(asMap(st.discovered), v=>v!=null&&v!==false);
    if(typeof st.cash!=='number'||!isFinite(st.cash)) st.cash=0;
    if(typeof st.gems!=='number'||!isFinite(st.gems)) st.gems=0;
    if(typeof st.level!=='number'||!isFinite(st.level)||st.level<1) st.level=1;
    if(!playerIdOk(st.pid)) st.pid=mintPlayerId();
    st.v=2;
    migrateStrainIds(st);
    S.forEach(s=>{ if(st.market.f[s.id]==null) st.market.f[s.id]=1; if(!st.market.hist[s.id]) st.market.hist[s.id]=[]; });
    return prevV;
  }
  // v2 stored a level 0–7 for caps 2,4,6,9,13,17,21,25. v3 is 5 then +3 up to 20.
  // newState already stamps garageV 3, and adoptSave copies that onto an old file that never had the field,
  // so the version has to be read from the raw save. Owned pots are kept (a 25-pot save stays at 25).
  // Buys still stop at 20. Plot ids are not rewritten.
  function migrateGarage(st, raw){
    if(!st) return;
    const OLD=[2,4,6,9,13,17,21,25];
    if(!raw){ st.garageV=3; if(!(st.garageKeep>0)) st.garageKeep=0; return; }
    const ver=raw.garageV|0;
    if(ver>=3){
      st.garage=Math.max(0,Math.min(GARAGE.length-1,st.garage|0));
      st.garageKeep=(st.garageKeep|0)>0?(st.garageKeep|0):0;
      st.garageV=3;
      return;
    }
    const lv=Math.max(0,Math.min(OLD.length-1,raw.garage|0));
    let owned=OLD[lv];
    (st.plots||[]).forEach(p=>{ if(p&&p.zone==='garage'&&(p.owned||p.strain)) owned=Math.max(owned,(p.idx|0)+1); });
    if(owned<5) owned=5;
    let idx=0; for(let i=0;i<GARAGE.length;i++) if(GARAGE[i].cap<=owned) idx=i;
    st.garage=idx; st.garageKeep=owned>GARAGE[idx].cap?owned:0; st.garageV=3;
  }
  // p.food used to drain from 1 to 0. Any leftover food means this grow was already fed, so snap it
  // to 1 and leave it there. Empty or missing food stays 0. A stray nutrient pile on the save
  // (there is no nutrient item in this build) is left untouched so old saves still load.
  function migrateFeeds(st){ if(!st||!st.plots) return; st.plots.forEach(p=>{ if(p) p.food=Number(p.food)>0?1:0; }); }
  // Retired strain ids (renamed paid exclusives and Naupaka) keep the player's seeds, plants, and breeding log.
  function migrateStrainIds(st){
    const MAP=window.STRAIN_MIGRATIONS||{};
    const NAME=window.STRAIN_NAME_MIGRATIONS||{};
    if(!st||st.idMig>=1||!Object.keys(MAP).length) return;
    const mapId=id=>id&&MAP[id]||id;
    const remapPair=k=>{
      if(typeof k!=='string') return k;
      const parts=k.split(' × ');
      if(parts.length<2) return NAME[k]||k;
      return parts.map(p=>NAME[p.trim()]||p.trim()).sort().join(' × ');
    };
    const moveNum=obj=>{ if(!obj) return; for(const [o,n] of Object.entries(MAP)){ if(obj[o]==null) continue; obj[n]=(obj[n]||0)+obj[o]; delete obj[o]; } };
    const moveObj=obj=>{ if(!obj) return; for(const [o,n] of Object.entries(MAP)){ if(obj[o]==null) continue; if(obj[n]==null) obj[n]=obj[o]; delete obj[o]; } };
    const moveFlag=obj=>{ if(!obj) return; for(const [o,n] of Object.entries(MAP)){ if(!(o in obj)) continue; if(obj[o]) obj[n]=true; else if(!(n in obj)) obj[n]=obj[o]; delete obj[o]; } };
    const moveHist=obj=>{ if(!obj) return; for(const [o,n] of Object.entries(MAP)){ if(obj[o]==null) continue; if(!obj[n]||(Array.isArray(obj[n])&&!obj[n].length)) obj[n]=obj[o]; else if(Array.isArray(obj[o])&&Array.isArray(obj[n])) obj[n]=obj[n].concat(obj[o]); delete obj[o]; } };
    const moveKey=k=>{ if(typeof k!=='string') return k; const p=k.split('|'); if(MAP[p[0]]) p[0]=MAP[p[0]]; else if(p.length>1&&MAP[p[1]]) p[1]=MAP[p[1]]; return p.join('|'); };
    const moveKeyed=obj=>{ if(!obj) return; const next={}; for(const [k,v] of Object.entries(obj)){ const nk=moveKey(k); if(typeof v==='number') next[nk]=(next[nk]||0)+v; else if(next[nk]==null) next[nk]=v; } for(const k of Object.keys(obj)) delete obj[k]; Object.assign(obj,next); };
    moveNum(st.seeds); moveNum(st.harv); moveNum(st.cutSeeds); moveNum(st.hintRev);
    moveFlag(st.discovered); moveObj(st.keepers); moveObj(st.lines);
    if(st.market){ moveNum(st.market.f); moveHist(st.market.hist); if(st.market.hot) st.market.hot=mapId(st.market.hot); }
    ['wet','dry','cured'].forEach(stage=>{ if(st.inv&&st.inv[stage]) moveKeyed(st.inv[stage]); });
    moveKeyed(st.goods);
    (st.dryer||[]).forEach(j=>{ if(j&&j.k) j.k=moveKey(j.k); });
    (st.craft||[]).forEach(j=>{ if(j&&j.id) j.id=mapId(j.id); });
    (st.cuts||[]).forEach(c=>{ if(c&&c.id) c.id=mapId(c.id); });
    (st.orders||[]).forEach(o=>{ if(o&&o.s) o.s=mapId(o.s); });
    (st.plots||[]).forEach(p=>{ if(!p) return; if(p.strain) p.strain=mapId(p.strain); if(p.last) p.last=mapId(p.last); });
    if(st.selSeed) st.selSeed=mapId(st.selSeed);
    if(st.hunt&&st.hunt.id) st.hunt.id=mapId(st.hunt.id);
    if(st.cert&&st.cert.id) st.cert.id=mapId(st.cert.id);
    if(st.breed){ if(st.breed.id) st.breed.id=mapId(st.breed.id); ['a','b'].forEach(side=>{ const x=st.breed[side]; if(x&&x.type==='s'&&x.id) x.id=mapId(x.id); }); if(st.breed.key) st.breed.key=remapPair(st.breed.key); }
    if(st.tried){ const next={}; for(const [k,v] of Object.entries(st.tried)){ const nk=remapPair(k); const nv=v==='dud'?'dud':mapId(v); if(!(nk in next)) next[nk]=nv; } st.tried=next; }
    if(st.recipes){ const next={}; for(const [k,v] of Object.entries(st.recipes)) next[mapId(k)]=typeof v==='string'?remapPair(v):v; st.recipes=next; }
    st.idMig=1;
  }
  function load(){
    const rawStr=Store.get(CFG.saveKey);
    st=newState();
    let raw=null, corrupt=false;
    if(rawStr){
      try{ raw=JSON.parse(rawStr); if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('shape'); }
      catch(e){ corrupt=true; raw=null; }
    }
    if(corrupt){ st._holdSave=rawStr; return {fresh:false,off:null,migrated:false,corrupt:true,kept:false}; }
    let schemaKept=false;
    if(raw){
      try{ const prevV=adoptSave(raw); schemaKept=prevV!==2; }
      catch(e){ st=newState(); st._holdSave=rawStr; return {fresh:false,off:null,migrated:false,corrupt:true,kept:false}; }
    }
    try{
      // v2 saves from before real-time: keep the same in-game day/hour, then let the wall clock drive it
      if(raw&&(!raw.tv||raw.t0==null)){ const old=raw.time||0, days=old/480; st.t0=(raw.lastSave||Date.now())-days*DAY_LEN*1000; st.tv=2; }
      if(st.land&&!st.phenoRoom) st.phenoRoom=true;
      migrateGarage(st, raw); migrateRoom(st, raw);
      if(st.inBuilt) st.found=true;
      // Older saves may store upg.stand. Leave the number on the save. It does not buy anything and does not change prices.
      // pre-real-economy saves: prices changed scale, so convert cash (assets, upgrades, inventory and crew are kept)
      if(raw&&!raw.econ){ st.econ=2; st.cash=Math.min((raw.cash||0)*2,50000+Math.pow(st.level,2)*2500); st.econMigrated=true; }
      // Saves from before the tutorial stay in normal play. A brand-new game keeps the offer.
      if(raw && (!raw.tut || typeof raw.tut!=='object' || Array.isArray(raw.tut))) st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0};
      else if(st.tut&&typeof st.tut==='object'){ st.tut.bought=st.tut.bought|0; st.tut.step=st.tut.step|0; if(st.tut.done||st.tut.skip) st.tut.on=false; }
      syncTime();
      const fp=freshPlots(); fp.forEach(q=>{ if(!st.plots.find(p=>p.id===q.id)) st.plots.push(q); });
      syncPlots(); migrateFeeds(st); applyEntitlements(); refreshUnlocks(); ensureQuests();
      // Older saves may list hired helpers. Keep the object and ignore it: nobody is automated from it.
      if(raw&&raw.workers&&typeof raw.workers==='object'&&!Array.isArray(raw.workers)){
        for(const k of Object.keys(raw.workers)) if(raw.workers[k]>0&&!(st.workers[k]>0)) st.workers[k]=raw.workers[k];
      }
    }catch(e){
      if(rawStr){ st=newState(); st._holdSave=rawStr; return {fresh:false,off:null,migrated:false,corrupt:true,kept:false}; }
      throw e;
    }
    let off=null;
    if(raw){ try{ const el=(Date.now()-(raw.lastSave||Date.now()))/1000; const cap=OFFLINE_CAP(); if(el>30){ off=simulate(Math.min(el,cap),true); off.away=el; off.capped=el>cap; off.cap=cap;
      { const d0=Math.floor(((raw.lastSave||Date.now())-st.t0)/1000/DAY_LEN), d1=dayNum(); const sz=d=>{ const x=((d%24)+24)%24; return x<10?'wet':x<22?'dry':'makahiki'; }; const seen=[]; let mk=0;
        for(let d=d0+1; d<=d1 && d<=d0+400; d++){ if(d%7===6) mk++; if(sz(d)!==sz(d-1)) seen.push(SEASONS[sz(d)].name); }
        off.days=d1-d0; off.markets=mk; off.seasons=seen; off.season=SEASONS[season()].name; off.pests=st.plots.filter(p=>p.owned&&p.pest).length; off.thirsty=st.plots.filter(p=>p.owned&&p.strain&&p.prog<1&&p.water<=0).length;
        off.huntDone=!!(st.hunt&&st.hunt.phenos); off.dryN=(st.dryer||[]).filter(b=>b&&b.t>=b.dur).length; } } }catch(e){ off=null; } }
    if(raw&&!playerIdOk(raw.pid)&&!st._holdSave) save();
    return {fresh:!raw,off,migrated:false,corrupt:false,kept:schemaKept};
  }
  // Fresh ?test=lv10 farm. Buildings stay locked behind their level and cost.
  // Strains with unlockLevel <= 10 show up in the shop. The tutorial does not.
  function applyTestStart(){
    st.level=10; st.xp=0; st.cash=100000000;
    st.land=false; st.ghBuilt=false; st.permit=false; st.found=false; st.inBuilt=false; st.breedLab=false;
    st.garage=0; st.garageKeep=0; st.garageV=3;
    st.room='garage'; st.loc='garage';
    st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0};
    st.streak={n:0,last:dayKey()};
    if(st.gecko) st.gecko.next=240;
    syncPlots();
    lvlQuiet=true; refreshUnlocks(); lvlQuiet=false;
    save();
  }
  function applyEntitlements(){
    const P=window.Payments; if(!P) return;
    if(P.isOwned('pass2x')||P.isOwned('pass2x_g')) st.pass2x=true;
    if(P.isOwned('vip')||P.isOwned('vip_g')) st.vip=true;
    ['neon','plumeria','mauna'].forEach(t=>{ if(P.isOwned('theme_'+t)) st.themes[t]=true; });
    if(P.isOwned('starter')) st.themes.neon=true;
    st.cos=st.cos||{own:{},eq:{}}; for(const [id,p] of Object.entries(window.PRODUCTS||{})){ if(!P.isOwned(id)) continue; if(p.grants.cos) st.cos.own[p.grants.cos]=true; if(p.grants.mgrSlot) st.mgrSlot=true; }
  }
  function grantProduct(p){
    const g=p.grants;
    if(g.gems) addGems(g.gems,p.name);
    if(g.cash) addCash(g.cash,'bundle');
    if(g.rarePacks) st.rarePacks+=g.rarePacks;
    if(g.legPacks) st.legPacks+=g.legPacks;
    if(g.hints) st.hints+=g.hints;
    if(g.pass2x) st.pass2x=true;
    if(g.vip) st.vip=true;
    if(g.theme){ st.themes[g.theme]=true; st.theme=g.theme; emit('theme',g.theme); }
    if(g.skip){ const r=simulate(g.skip,false); emit('skip',r); }
    if(g.cos){ const [sl,id]=g.cos.split(':'); st.cos=st.cos||{own:{},eq:{}}; st.cos.own[g.cos]=true; st.cos.eq[sl]=id; emit('cosmetic',{sl,id}); }
    if(g.strain){ st.seeds[g.strain]=(st.seeds[g.strain]||0)+(g.n||5); discover(g.strain,true); emit('premiumdrop',{id:g.strain,how:'shop'}); }
    if(g.boost){ st.boosts=st.boosts||{}; st.boosts[g.boost]=boostLeft(g.boost)+(g.sec||3600); emit('boost',g.boost); }
    if(g.piggy){ const n=Math.floor(st.piggy.g); st.piggy.g=0; st.piggy.cracked++; addGems(n,'Piggy bank'); emit('piggy',n); }
    if(g.pass){ const P=passState(); P.premium=true; if(g.pass==='plus'&&!P.plus){ P.plus=true; P.xp=Math.max(P.xp,(passTier()+PZ.PRICE.plusSkip)*PZ.XP_PER_TIER); } emit('pass',g.pass); }
    if(g.mgrSlot) st.mgrSlot=true;
    save(); emit('granted',p);
  }
  function buyWithGems(id){
    const p=window.PRODUCTS[id]; if(!p||p.kind!=='gems') return false;
    if(p.once&&((p.grants.pass2x&&st.pass2x)||(p.grants.vip&&st.vip)||(p.grants.mgrSlot&&st.mgrSlot)||(p.grants.cos&&cosOwned(p.grants.cos)))) return false;
    if(!spendGems(p.priceGems)) return false;
    if(p.once) window.Payments.markOwned(id);
    grantProduct(p); return true;
  }
  // ---------- cosmetics (no gameplay effect) ----------
  function cosOwned(k){ return !!(st.cos&&st.cos.own[k]); }
  function equipCos(sl,id){ st.cos=st.cos||{own:{},eq:{}}; if(id&&!cosOwned(sl+':'+id)) return false; st.cos.eq[sl]=id||null; save(); emit('cosmetic',{sl,id}); return true; }
  // ---------- instant finish: gems priced by time left (~50 gems per hour, same rate as the time skips) ----------
  const rushCost=sec=>Math.max(1,Math.ceil(Math.max(0,sec)/72));
  function timers(){ const T=[];
    if(st.breed) T.push({k:'breed',name:'Breeding cross',left:st.breed.dur-st.breed.t});
    if(st.hunt&&!st.hunt.phenos) T.push({k:'hunt',name:'Pheno hunt: '+strain(st.hunt.id).name,left:st.hunt.dur-st.hunt.t});
    if(st.cert) T.push({k:'cert',name:'Heirloom certification: '+strain(st.cert.id).name,left:st.cert.dur-st.cert.t});
    (st.cuts||[]).forEach((c,i)=>T.push({k:'cut',i,name:c.n+' '+strain(c.id).name+' cuttings rooting',left:c.dur-c.t}));
    (st.dryer||[]).forEach((j,i)=>{ if(j&&j.t<j.dur) T.push({k:'dry',i,name:(j.phase==='dry'?'Drying ':'Curing ')+j.n+' '+strain(unkey(j.k).id).name,left:j.dur-j.t}); });
    (st.craft||[]).forEach((j,i)=>T.push({k:'craft',i,name:CRAFT[j.t].name+': '+strain(j.id).name,left:j.dur-j.T}));
    return T.map(t=>Object.assign(t,{gems:rushCost(t.left)})); }
  function rush(k,i){ const t=timers().find(x=>x.k===k&&(x.i==null||x.i===+i)); if(!t) return false; if(!spendGems(t.gems)) return false;
    if(k==='breed') st.breed.t=st.breed.dur; else if(k==='hunt') st.hunt.t=st.hunt.dur; else if(k==='cert') st.cert.t=st.cert.dur; else if(k==='cut') st.cuts[i].t=st.cuts[i].dur; else if(k==='dry') st.dryer[i].t=st.dryer[i].dur; else if(k==='craft') st.craft[i].T=st.craft[i].dur;
    tickBreed(0); tickCraft(0); tickDryer(0); emit('rushed',t); save(); return true; }
  // breeding completion (strain web tracker) + a rough plan estimate for the pacing report
  function breedProgress(){ const M=S.filter(s=>s&&s.mystery), disc=st.discovered&&typeof st.discovered==='object'&&!Array.isArray(st.discovered)?st.discovered:{}, d=M.filter(s=>disc[s.id]).length;
    const bag=st.lines&&typeof st.lines==='object'&&!Array.isArray(st.lines)?st.lines:{};
    const L=Object.values(bag).filter(v=>v&&typeof v==='object'&&!Array.isArray(v)).map(v=>lineRecord(v,true)).filter(v=>v&&typeof v==='object'&&typeof v.gen==='number');
    const stab=L.filter(v=>v.gen>=LINE.stable).length, ibl=L.filter(v=>v.gen>=LINE.max).length, heir=L.filter(v=>v.heir).length;
    return {mystery:M.length, found:d, all:S.length, known:Object.keys(disc).length, lines:L.length, stable:stab, ibl, heir, pct:M.length?Math.round(100*(d+stab+heir)/(3*M.length)):0}; }
  function breedPlanEstimate(o){ o=Object.assign({sessionsPerDay:4,labLv:1},o||{}); // real days, assuming the Breeding Pheno Room, ~4 check-ins a day and the lab upgrades bought over time
    const lab=.6, pol=Math.pow(.85,2), tis=Math.pow(.8,2), gap=24*3600/o.sessionsPerDay/2; let sec=0, n=0;
    for(const s of S.filter(s=>s.mystery)){ const t=Math.min(4,s.tier); sec+=CROSS_T[t]*lab*pol+gap+s.game.growSec*.5; // cross + grow its seeds (overlapped with other work)
      sec+=(LINE.stable-1)*(HUNT_T[t]*lab*tis+gap); n++;
      if(o.heirloom){ sec+=(LINE.max-LINE.stable)*(HUNT_T[t]*lab*tis+gap)+HEIR.sec*.5; } } // F4 -> F6 + certification (overlaps the next line's hunts)                                               // stabilise to F4 with grow-outs
    return {days:sec/86400, strains:n, note:'one bench, sequential crosses and grow-outs; parallel farm growing not counted'}; }
  function resetAll(){ Store.remove(CFG.saveKey); st=newState(); syncPlots(); applyEntitlements(); refreshUnlocks(); save(); emit('reset'); }
  // ---------- hidden tester tools (?dev=1). Every call no-ops in normal play and in store builds. ----------
  function devOn(){
    if(window.storeDisablesTester&&window.storeDisablesTester()){ window.DEV_MODE=false; return false; }
    return !!window.DEV_MODE;
  }
  function devGrantCash(n){
    if(!devOn()) return false;
    n=Math.round(+n); if(!n) return false;
    addCash(n,'dev'); save(); return true;
  }
  function devGrantGems(n){
    if(!devOn()) return false;
    n=Math.round(+n); if(!n) return false;
    addGems(n,'Dev'); save(); return true;
  }
  function devSetLevel(n){
    if(!devOn()) return false;
    n=Math.max(1,Math.min(60,Math.floor(+n)||1));
    st.level=n; st.xp=0;
    lvlQuiet=true; refreshUnlocks(); lvlQuiet=false;
    checkQuest();
    emit('toast',{t:'Tester: level '+n,k:'good'});
    save(); return true;
  }
  function devGrantSeeds(id,n){
    if(!devOn()) return false;
    const s=strain(id); if(!s) return false;
    n=Math.max(1,Math.min(999,Math.floor(+n)||1));
    if(!st.discovered[id]) st.discovered[id]=true;
    st.seeds[id]=(st.seeds[id]||0)+n;
    if(!(st.seeds[st.selSeed]>0)) st.selSeed=id;
    emit('seeds',{id,n});
    emit('toast',{t:'Tester: +'+n+' '+s.name+' seeds',k:'good'});
    save(); return true;
  }
  function devSetSpeed(n){
    if(!devOn()) return false;
    n=Math.max(1,Math.min(10000,Math.round(+n)||1));
    st.devSpeed=n;
    emit('toast',{t:n<=1?'Tester: growth at normal speed':'Tester: plants grow at '+n+'× while you play',k:'good'});
    save(); return n;
  }
  function devSkip(sec){
    if(!devOn()) return null;
    sec=Math.max(1,Math.min(14*86400,Math.round(+sec)||0));
    const r=simulate(sec,false);
    emit('skip',r); save(); return r;
  }
  function devUnlockAll(){
    if(!devOn()) return false;
    if(st.level<20){ st.level=20; st.xp=0; }
    lvlQuiet=true; refreshUnlocks(); lvlQuiet=false;
    if(st.cash<100000) addCash(100000-st.cash,'dev');
    if(st.gems<200) addGems(200-st.gems,'Dev');
    st.land=true; st.phenoRoom=true; st.field=FIELD.length-1;
    st.ghBuilt=true; st.gh=GH.length-1;
    st.permit=true; st.found=true; st.inBuilt=true; st.bench=BENCH.length-1; st.breedLab=true;
    st.garage=GARAGE.length-1;
    if(lv('water')<1) st.upg.water=1;
    if(lv('cure')<1) st.upg.cure=1;
    if(lv('dryer')<1) st.upg.dryer=1;
    if(lv('press')<1) st.upg.press=1;
    if(lv('kitchen')<1) st.upg.kitchen=1;
    syncPlots(); checkQuest();
    const d=Math.floor(Date.now()/864e5), w=Math.floor(d/7), f=FESTS[w%FESTS.length];
    festForce=Object.assign({week:w,ends:Date.now()+2*864e5},f);
    emit('toast',{t:'Tester: garage, land, greenhouse, indoor, lab, and crafting are open. '+f.name+' is on.',k:'good long'});
    save(); return true;
  }
  // Player-facing rooms. Indoor Facility is the old family land (zone field, 40 plots).
  // Greenhouse is the outdoor glass house (zone gh). Sealed benches stay the late indoor zone
  // so an old indoor save is not dropped; they are a chip inside the facility, not a fourth home tab.
  const ROOM_ZONE={garage:'garage',facility:'field',gh:'gh',benches:'in'};
  const ROOM_NAME={garage:'Garage',facility:'Indoor Facility',gh:'Greenhouse',benches:'Benches'};
  function roomZone(r){ return ROOM_ZONE[r]||'garage'; }
  function migrateRoom(s, raw){
    if(!s) return;
    // newState fills room:'garage' before the save is merged, so an old file with no room
    // field must follow its loc. A save that already picked a room keeps that pick.
    const known=raw&&(raw.room==='garage'||raw.room==='gh'||raw.room==='facility'||raw.room==='benches');
    if(!known){
      if(s.loc==='indoor'&&s.inBuilt) s.room='benches';
      else if(s.loc==='farm') s.room='facility';
      else s.room='garage';
    }
    if(s.room==='benches'&&!s.inBuilt) s.room=s.land?'facility':'garage';
    if(s.room!=='garage'&&s.room!=='gh'&&s.room!=='facility'&&s.room!=='benches') s.room='garage';
  }
  function currentRoom(){
    if(!st) return 'garage';
    if(st.room==='benches'&&st.inBuilt) return 'benches';
    if(st.room==='gh') return 'gh';
    if(st.room==='facility') return 'facility';
    if(st.room==='garage') return 'garage';
    if(st.loc==='indoor'&&st.inBuilt) return 'benches';
    if(st.loc==='farm') return 'facility';
    return 'garage';
  }
  function roomOpen(r){
    if(r==='garage') return true;
    if(r==='facility') return !!st.land;
    if(r==='gh') return !!st.ghBuilt;
    if(r==='benches') return !!st.inBuilt;
    return false;
  }
  function setRoom(r){
    if(r!=='garage'&&r!=='gh'&&r!=='facility'&&r!=='benches') return;
    if(r==='benches'&&!st.inBuilt) return;
    st.room=r;
    const l=r==='benches'?'indoor':r==='garage'?'garage':'farm';
    st.loc=l;
    emit('loc',l);
    emit('room',r);
  }
  function setLoc(l){
    if(l==='garage') return setRoom('garage');
    if(l==='indoor') return setRoom('benches');
    if(l==='farm') return setRoom('facility');
  }
  function plotsHere(){ const z=roomZone(currentRoom()); return st.plots.filter(p=>p.zone===z); }
  function ripeIn(l){ return st.plots.filter(p=>p.loc===l&&p.strain&&p.prog>=1).length; }
  function roomRipe(r){ const z=roomZone(r); return st.plots.filter(p=>p.zone===z&&p.strain&&p.prog>=1).length; }
  const crewLog=[];
  function noteCrew(w){ if(w){ crewLog.push(w); if(crewLog.length>120) crewLog.shift(); } }
  function drainCrew(){ const a=crewLog.slice(); crewLog.length=0; return a; }

  return {
    get st(){return st}, F, S, BY, strain, UPG, WORKERS, WEATHER, QUESTS, ZONE, UPK_NAME, LOCS, LOC_NAME, TIERN, STAGE_MULT, DAY_LEN, GARAGE, FIELD, GH, GH_BUILD, BENCH, INDOOR, LAND_COST, LAND_LEVEL,
    REP, repTier, addRep, MASTERY, mastery, SETS, MANA_UPG, manaCost, manaGain, buyMana, mana,
    passState, passTier, passClaim, passClaimAll, seasonEv, evFx, sqInfo, sqClaim, sqReady, sqWeek, startSeasonEvent:()=>{ const se=seasonEv(); st.event.id='season'; st.event.t=se.dur; emit('event',se); },
    LINE, HEIR, VAULT, heirCount, heirCost, canCertify, startCertify, claimVault, checkVault, lineGen, lineName, lineMult, stableLines, breedProgress, breedPlanEstimate, CROSS_T, HUNT_T,
    ADS, adState, adReward, PREMIUM, DROP, packOdds, BOOSTS, boostLeft, PIGGY,
    cosOwned, equipCos, rushCost, timers, rush,
    on, emit, fmt, num, dur, cost, maxLv, lv, wk, earnMult, xpNeed, key, unkey, invCount, capOf, syncPlots, locOpen, nextStep, buyStep, buyLand, buildGH, buyPermit, indoorChecklist, buildIndoor,
    buySeeds, seedPrice, plant, water, feed, feedCost, harvest, quality, yieldMult, cycleCost, upkeepRates, growRate, timeLeft, isNight, dayPhase, stage, dryerSlots, batchMax, loadDryer,
    price, sell, sellAll, marketDay, dayNum, regTier, orderSlots, orderValue, orderHave, fillOrder, PREFS, prefOk, custMatch, serveCust,
    recipeFor, recipesFor, crossCost, crossTime, triedResult, pairKey, vagueHint, hintLevel, useHint, familyOf, cloneCost, buyClone, startBreed, openPack, buyUpg, upgNeedOk, hire, workerOk, rebirthNeed, rebirth, curQuest, claimQuest, questSat,
    isThirsty, isHungry, streakSaved, addCash, buyFoundation, pestRisk, season, SEASONS, seasonYield, canPrune, canTrellis, canTrain, train, huntSize, huntTime, CUT, cutState, takeCuttings, canHunt, startHunt, keepPheno, dropHunt, phenoScore, setTime, syncTime, buyLab, LAB, garageRole, locName, prune, trellis, trellisCost, scout, treatCost, treat, gradeOf, plotScore, QMULT, dailyReady, claimDaily, dailyCash, streakDay, LOGIN, ensureQuests, qProg, claimQ, questsReady, ACH, claimAch, achReady, stat, EVENTS, GATE, gate, MILES, gradeLabel, GRADE, mutChance,
    FESTS, EVENT_ONLY, festNow, festState, festOn, claimFest, GECKO, boostOn, geckoTap, CRAFT, craftOk, craftSlots, craftMax, startCraft, goodPrice, sellGood, goodsCount, BUYERS, setFest:f=>{ festForce=f?Object.assign({week:-1,ends:Date.now()+864e5},FESTS.find(x=>x.id===f)):null; },
    tick, simulate, save, load, applyTestStart, exportBackup, parseBackup, installBackup, supportId, grantProduct, buyWithGems, resetAll, discover, addGems, setLoc, setRoom, currentRoom, roomZone, roomOpen, roomRipe, plotsHere, ROOM_ZONE, ROOM_NAME, drainCrew, ripeIn, OFFLINE_CAP,
    devSetLevel, devGrantSeeds, devSetSpeed, devSkip, devUnlockAll, devGrantCash, devGrantGems,
  };
})();
