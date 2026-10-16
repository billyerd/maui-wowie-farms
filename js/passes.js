/* Grower Pass: six 2-month seasons a year. Data-driven: themes, exclusive strains, cosmetics and the 50-tier reward tracks.
 * FREE track for everyone; PREMIUM ($14.99, test-mode payment, or 3,000 gems) and PREMIUM+ ($19.99: premium + skips the first 10 tiers).
 * Pass XP: harvests, sales, goals/quests/achievements, breeding, kept mothers, rewarded ads (see PASS_XP). Tuned so an active
 * player (~400 pass XP a day) finishes all 50 tiers in about 6-7 weeks of a ~8.5-week season.
 * Fairness: pass cosmetics are cosmetic only; the season's exclusive seed is also a rare in-play drop during its season
 * (chances are game.js DROP.huntSeason and DROP.packSeason). Gems, boosts, skips, and packs can also be earned or bought with gems.
 */
(function(){
// ---- exclusive season strains (original names; game numbers follow the same tier rules as the rest of the book) ----
const base={aka:null,thcEstimate:null,cbd:0,cbg:1,floweringSource:'Island grow notes',yieldClass:'Medium',yieldSource:'ESTIMATE',colorSource:'ESTIMATE: derived from flavor tags',
  rarity:'Legendary',tier:4,hemp:false,island:false,mystery:false,passExclusive:true};
const mk=(o,g,l)=>Object.assign({},base,o,{game:Object.assign({growSec:129600,buds:4,budValue:30,seedCost:20,xp:43,payout:120,unlockLevel:20},g),look:Object.assign({frost:.75,density:.8,shape:'chunky',leafShape:'mid',src:'Painted game art from flavor notes (no photo shipped)'},l)});
const PASS_STRAINS=[
 mk({id:'makai-blue',name:'Makai Blue',type:'Hybrid',thc:21,cbg:0,parents:['Blueberry','Hawaiian Sativa'],parentIds:[null,null],terpenes:['Caryophyllene','Myrcene','Pinene'],flavors:['Tropical','Sweet','Blueberry'],topEffect:'Happy',floweringDays:70,colorTags:['blue','orange'],recognition:'Grower Pass exclusive: Makana Winter',island:true,
   blurb:'Makai Blue is the Makana Winter pass flower: a blueberry and Hawaiian sativa cross with blue-green buds, orange hairs, and a sweet tropical nose. It flowers in about ten weeks.'},
   {growSec:108000,budColor:'#4a7ad0',budLight:'#9cc4ff',accent:'#ffffff',pistil:'#ff8a3a'},{bud:'#5a7aa8',bud2:'#9ab4d8',leaf:'#3a5a3a',pistil:'#f08a3a',base:'blue'}),
 mk({id:'lehua-fizz',name:'Lehua Fizz',type:'Sativa',thc:21,cbg:0,parents:[],parentIds:[],terpenes:['Terpinolene','Myrcene','Pinene'],flavors:['Tropical','Pear','Citrus'],topEffect:'Uplifted',floweringDays:58,colorTags:['green','pink'],recognition:'Grower Pass exclusive: Merrie Monarch',island:true,
   blurb:'Lehua Fizz is the Merrie Monarch pass sativa: pear, citrus, and tropical fruit on green-pink flowers, with an uplift that arrives slowly. It finishes in about eight weeks.'},
   {growSec:93600,budColor:'#5aa04a',budLight:'#ffb0d0',accent:'#ff6fa6',pistil:'#ff7aa8'},{bud:'#6aa850',bud2:'#e8a0c0',leaf:'#3a6a32',pistil:'#ff7aa8',base:'pink'}),
 mk({id:'hala-gold',name:'Hala Gold',type:'Hybrid',thc:19,parents:['Golden Goat','Pineapple Kush'],parentIds:[null,null],terpenes:['Terpinolene','Myrcene','Pinene'],flavors:['Pineapple','Tropical','Sour'],topEffect:'Creative',floweringDays:60,colorTags:['golden','green'],recognition:'Grower Pass exclusive: Lei Day & Kamehameha',
   blurb:'Hala Gold is the Lei Day pass hybrid: a golden goat line crossed with pineapple kush, sour and pineapple-sweet, creative in the notes, and done in about sixty days.'},
   {growSec:122400,budColor:'#c8a030',budLight:'#ffe27a',accent:'#ffd34a',pistil:'#ff9a2a'},{bud:'#b8a040',bud2:'#f0d878',leaf:'#4a6a2a',pistil:'#ff9a2a',base:'golden'}),
 mk({id:'kona-sunset',name:'Kona Sunset',type:'Hybrid',thc:18,parents:['GSC','Pink Panties'],parentIds:['gsc',null],terpenes:['Caryophyllene','Limonene','Myrcene'],flavors:['Sweet','Berry','Citrus'],topEffect:'Relaxed',floweringDays:60,colorTags:['purple','orange'],recognition:'Grower Pass exclusive: Summer Swell',
   blurb:'Kona Sunset is the Summer Swell pass hybrid: a GSC and pink-parent cross with berry-citrus sweetness, purple-orange flowers, and a relaxed finish in about sixty days.'},
   {growSec:136800,budColor:'#9a5ab0',budLight:'#ffb07a',accent:'#ff8a5a',pistil:'#ff8a3a'},{bud:'#8a5a9a',bud2:'#e8a070',leaf:'#3a5232',pistil:'#e8873a',base:'purple'}),
 mk({id:'maile-grape',name:'Maile Grape',type:'Hybrid',thc:19,cbg:0,parents:['Grape Stomper',"'98 Aloha White Widow"],parentIds:[null,null],terpenes:['Myrcene','Linalool','Caryophyllene'],flavors:['Blueberry','Grape','Tropical'],topEffect:'Uplifted',floweringDays:60,colorTags:['purple','white'],recognition:'Grower Pass exclusive: Aloha Festivals',island:true,
   blurb:'Maile Grape is the Aloha Festivals pass hybrid: a grape line crossed with an aloha white widow, heavy frost, a grape-fuel nose, and a clear, airy finish.'},
   {growSec:151200,budColor:'#6a3fa0',budLight:'#c8a0f0',accent:'#ffffff',pistil:'#ffb07a'},{bud:'#6a4a8e',bud2:'#b09ad0',leaf:'#34522e',pistil:'#e8a07a',base:'purple'}),
 mk({id:'makahiki-flame',name:'Makahiki Flame',type:'Hybrid',thc:20,parents:['OG Kush','SFV OG Kush'],parentIds:['og-kush',null],terpenes:['Myrcene','Limonene','Caryophyllene'],flavors:['Lemon','Pine','Earthy'],topEffect:'Euphoric',floweringDays:67,colorTags:['green','orange'],recognition:'Grower Pass exclusive: Makahiki Harvest',
   blurb:'Makahiki Flame is the harvest-season pass hybrid: OG Kush crossed with an SFV OG line, lemon and pine, with red-orange hairs that read like embers. It flowers in about nine to ten weeks.'},
   {growSec:172800,budColor:'#5a8a3a',budLight:'#ffb04a',accent:'#ff5a2a',pistil:'#ff4a1a'},{bud:'#6a8a40',bud2:'#d8a050',leaf:'#3a5a2a',pistil:'#ff5a2a',base:'green'}),
];
PASS_STRAINS.forEach(s=>{ if(!window.STRAINS.some(x=>x.id===s.id)) window.STRAINS.push(s); });

// ---- seasons (calendar months, local time) ----
const SEASONS=[
 {id:'s1',months:[0,1],name:'Makana Winter',tag:'Whale season',c1:'#0e4a7a',c2:'#3ab0e0',accent:'#bfeaff',strain:'makai-blue',
  cos:{stand:['s1_lei','Whale-watch lei','lei',{f:['#ffffff','#bfeaff','#3ab0e0','#e8f8ff','#7ad0ff']}],truck:['s1_truck','Humpback blue','wrap',{c:[30,80,150],flower:'#e8f8ff',mark:'whale'}],outfit:['s1_shirt','Ocean aloha shirt','aloha',{col:[30,90,170],fl:[220,245,255]}],pet:['s1_pet','Sea-spray poi dog','dog',{body:'#9aa6b0',dark:'#5a6670'}],room:['s1_room','Deep ocean indoor room','neon',{t1:'80,180,255',t2:'200,240,255'}]}},
 {id:'s2',months:[2,3],name:'Merrie Monarch',tag:'Hula, lei and flowers',c1:'#7a1a4a',c2:'#ff6fa6',accent:'#ffe0ef',strain:'lehua-fizz',
  cos:{stand:['s2_lei','Hula lei garland','lei',{f:['#ff5c9a','#ffd2e6','#fff07a','#ff2a5a','#ffffff']}],truck:['s2_truck','Lehua bloom wrap','wrap',{c:[200,40,80],flower:'#ffe0ef'}],outfit:['s2_shirt','Hula festival shirt','aloha',{col:[40,140,70],fl:[255,210,230]}],pet:['s2_pet','Golden moa','moa',{body:'#e0a030',dark:'#7a4a10'}],room:['s2_room','Hula hall garage','surfshack',{lights:['255,120,170','255,220,120','255,255,255','255,90,140']}]}},
 {id:'s3',months:[4,5],name:'Lei Day & Kamehameha',tag:'Gold and royal feather capes',c1:'#6a3a00',c2:'#ffc23a',accent:'#fff3c0',strain:'hala-gold',
  cos:{stand:['s3_tiki','Royal gold torches','tiki',{flame:['#ffd34a','#fff1a8','#ffffff'],pole:'#c8a040'}],truck:['s3_truck','Royal gold','paint',{c:[220,170,40]}],outfit:['s3_cape','Feather cape poncho','poncho',{col:[200,30,30]}],pet:['s3_pet','Black velvet cat','cat',{body:'#2a2a30',dark:'#141418'}],room:['s3_room','Royal gold indoor room','neon',{t1:'255,200,60',t2:'255,80,60'}]}},
 {id:'s4',months:[6,7],name:'Summer Swell',tag:'Surf and shave ice',c1:'#0a6a7a',c2:'#ff9a5a',accent:'#fff0e0',strain:'kona-sunset',
  cos:{stand:['s4_surf','Shave ice longboard','surf',{s1:'#ff6fa6',s2:'#5ad0ff',s3:'#fff07a'}],truck:['s4_truck','Seafoam green','paint',{c:[60,200,170]}],outfit:['s4_trunks','Surf trunks overalls','overalls',{col:[255,120,60]}],pet:['s4_pet','Sandy poi dog','dog',{body:'#e0c08a',dark:'#a07a4a'}],room:['s4_room','Beach shack garage','surfshack',{lights:['90,200,255','255,160,90','255,255,200','120,255,200']}]}},
 {id:'s5',months:[8,9],name:'Aloha Festivals',tag:'Floats and ukulele',c1:'#4a1a7a',c2:'#ffd34a',accent:'#f4e6ff',strain:'maile-grape',
  cos:{stand:['s5_lei','Parade float lei','lei',{f:['#ffd34a','#c97bff','#ff5c9a','#5ad06a','#ffffff']}],truck:['s5_truck','Parade float wrap','wrap',{c:[250,200,50],flower:'#c97bff'}],outfit:['s5_shirt','Ukulele aloha shirt','aloha',{col:[110,50,170],fl:[255,220,90]}],pet:['s5_pet','Snow-white moa','moa',{body:'#f4f0e8',dark:'#a8a090'}],room:['s5_room','Festival neon indoor room','neon',{t1:'255,90,220',t2:'120,255,140'}]}},
 {id:'s6',months:[10,11],name:'Makahiki Harvest',tag:'Torches and harvest',c1:'#5a1a0a',c2:'#ff7a2a',accent:'#ffe6c8',strain:'makahiki-flame',
  cos:{stand:['s6_tiki','Makahiki ember torches','tiki',{flame:['#ff3a1a','#ff8a2a','#ffe08a'],pole:'#5a3a1c'}],truck:['s6_truck','Ember red','paint',{c:[180,40,20]}],outfit:['s6_overalls','Harvest overalls','overalls',{col:[120,80,40]}],pet:['s6_pet','Ember tabby cat','cat',{body:'#c86a2a',dark:'#7a3a10'}],room:['s6_room','Torch-lit garage','surfshack',{lights:['255,140,40','255,90,30','255,200,90','255,120,60']}]}},
];
const SLOT={stand:'stand',truck:'truck',outfit:'outfit',pet:'pet',room:null};
const ROOMSLOT={neon:'room_indoor',surfshack:'room_garage',bamboo:'room_gh'};
// register season cosmetics as pass-only items (no store product)
function regCos(){ SEASONS.forEach(S=>{ for(const [k,[id,name,b,pal]] of Object.entries(S.cos)){ const sl=k==='room'?ROOMSLOT[b]:SLOT[k]; const g=window.COSMETICS[sl]; if(!g) continue;
  g.items[id]={name,desc:S.name+' Grower Pass reward',base:b,pal,pass:S.id}; S.cos[k]=[id,name,b,pal,sl]; } }); }

// ---- pass XP and tracks ----
const PASS_XP={harvest:2, sold:1, qclaim:25, questclaim:40, achclaim:20, bred:30, keeper:40, adreward:10, caps:{harvest:220, sold:60}};
const TIERS=50, XP_PER_TIER=360;   // 18,000 XP a season; active player ~400/day -> ~45 days (6.5 weeks)
function track(S){ const T=[];
  for(let i=1;i<=TIERS;i++){ let f=null, p;
    // free track: small gems, packs, a skip, a boost, legendary pack at 50
    if(i%10===0) f=i===50?{legPacks:1,gems:50}:{rarePacks:1}; else if(i%5===0) f=i===25?{boost:'grow'}:{skip:900}; else if(i%2===1) f={gems:i<25?5:10};
    // premium track: gems every tier, cosmetics, boosts, skips, packs, exclusive seed at 50
    const c=S.cos; const cosAt={8:c.stand,18:c.truck,28:c.outfit,38:c.pet,45:c.room};
    if(cosAt[i]) p={cos:cosAt[i][4]+':'+cosAt[i][0],gems:20};
    else if(i===50) p={strain:S.strain,n:5,gems:250};
    else if(i===25) p={legPacks:1,gems:60};
    else if(i%10===0) p={legPacks:1,gems:40};
    else if([5,15,35].includes(i)) p={boost:['grow','price','pheno'][[5,15,35].indexOf(i)],gems:40};
    else if([12,22,32,42].includes(i)) p={skip:3600,gems:40};
    else if(i%3===0) p={rarePacks:1,gems:40};
    else p={gems:60};
    T.push({tier:i,f,p}); }
  return T; }
function totals(S){ const T=track(S), t={free:{gems:0,rarePacks:0,legPacks:0,skips:0,boosts:0},prem:{gems:0,rarePacks:0,legPacks:0,skipsH:0,boosts:0,cosmetics:0,seeds:0}};
  T.forEach(r=>{ if(r.f){ t.free.gems+=r.f.gems||0; t.free.rarePacks+=r.f.rarePacks||0; t.free.legPacks+=r.f.legPacks||0; t.free.skips+=r.f.skip?1:0; t.free.boosts+=r.f.boost?1:0; }
    const p=r.p; t.prem.gems+=p.gems||0; t.prem.rarePacks+=p.rarePacks||0; t.prem.legPacks+=p.legPacks||0; t.prem.skipsH+=(p.skip||0)/3600; t.prem.boosts+=p.boost?1:0; t.prem.cosmetics+=p.cos?1:0; t.prem.seeds+=p.n||0; });
  return t; }
function seasonNow(d){ d=d||new Date(); const m=d.getMonth(), S=SEASONS.find(s=>s.months.includes(m)), y=d.getFullYear(); const start=new Date(y,S.months[0],1), end=new Date(y,S.months[1]+1,1);
  return Object.assign({key:y+'-'+S.id,start:+start,end:+end},S); }
// ---------- season events + mini-quest chains (one per pass season) ----------
// ev.fx reuses the core event effects: 'swell' +25% prices, 'festival' 2x XP, 'moon' 3x mutation + a hint token.
// Every season event also gives +50% pass XP while it runs. Quests unlock one per week of the season and run in order.
// Each line has a giver; local characters use a little pidgin now and then (about 1 line in 4). UI text stays plain English.
const SEASON_EV={
 s1:{name:'Whale Watch Week',desc:'Whale-watch tourists in town: +25% prices, +50% pass XP',fx:'swell',dur:150,icon:'🐋'},
 s2:{name:'Merrie Monarch Hula Week',desc:'Hula festival crowds: 2x XP, +50% pass XP',fx:'festival',dur:150,icon:'🌺'},
 s3:{name:'Lei Day Lucky Bloom',desc:'Lei Day luck: 3x mutation chance, +1 hint token, +50% pass XP',fx:'moon',dur:150,icon:'🌼'},
 s4:{name:'North Shore Surf Contest',desc:'Surf contest crowds: +25% prices, +50% pass XP',fx:'swell',dur:150,icon:'🏄'},
 s5:{name:'Aloha Festivals Parade',desc:'Floral parade: 2x XP, +50% pass XP',fx:'festival',dur:150,icon:'🎉'},
 s6:{name:'Makahiki Games',desc:'Makahiki games: 3x mutation chance, +1 hint token, +50% pass XP',fx:'moon',dur:150,icon:'🏹'},
};
// [stat key, goal, task text, giver, line]
const SQ_RAW={
 s1:[['harvests',40,'Harvest 40 plants for the whale-watch crowd','Malia','Tour boats leave at dawn. Let us have buds ready for the visitors.'],
     ['sold',150,'Sell 150 buds at the Market','Keoni','Whale season brings big crowds. Keep the jars stocked.'],
     ['customers',10,'Serve 10 walk-in customers','Auntie Lani','Brah, da tourists stay lining up already. Go help them.'],
     ['cured',60,'Cure 60 buds','Malia','Slow-cured buds sell best to the visitors.'],
     ['bred',3,'Try 3 crossbreeds','Uncle Ikaika','Winter is a good time to plan new lines.'],
     ['hunts',2,'Finish 2 pheno hunts','Kai','Find a keeper before the whales head north.'],
     ['crafted',10,'Craft 10 goods','Keoni','Visitors love pre-rolls and hash for the boat ride.'],
     ['keepers',2,'Keep 2 mothers from pheno hunts','Unko Kuli','Good mothers make good seasons. Keep the best ones, yeah?']],
 s2:[['harvests',40,'Harvest 40 plants for the hula festival','Auntie Lani','The halau needs gifts for the dancers. Harvest a big batch.'],
     ['sold',150,'Sell 150 buds','Keoni','Festival week is the busiest week of spring.'],
     ['plant',60,'Plant 60 seeds','Malia','Plant now and you will be ready for Merrie Monarch.'],
     ['customers',10,'Serve 10 festival guests','Kai','Ho, plenny people from Hilo! Go serve them.'],
     ['cured',60,'Cure 60 buds','Auntie Lani','Cure them slow, like a good lei takes time.'],
     ['bred',3,'Try 3 crossbreeds','Uncle Ikaika','Cross something as bright as a lehua blossom.'],
     ['hunts',2,'Finish 2 pheno hunts','Malia','Find the pheno with the best flower smell.'],
     ['keepers',2,'Keep 2 mothers','Unko Kuli','Keep the good ones close. They stay family now.']],
 s3:[['harvests',40,'Harvest 40 plants for Lei Day','Malia','Everyone wants yellow and gold for Lei Day.'],
     ['sold',150,'Sell 150 buds','Keoni','King Kamehameha Day brings the whole town out.'],
     ['pruned',20,'Prune 20 plants','Uncle Ikaika','Clean plants, clean buds. Prune before the parade.'],
     ['customers',10,'Serve 10 walk-in customers','Auntie Lani','The parade crowd is hungry. Go take care of them, k?'],
     ['cured',60,'Cure 60 buds','Malia','A royal harvest deserves a proper cure.'],
     ['bred',3,'Try 3 crossbreeds','Kai','Look for a golden pheno this season.'],
     ['hunts',2,'Finish 2 pheno hunts','Uncle Ikaika','A strong line starts with a good hunt.'],
     ['keepers',2,'Keep 2 mothers','Unko Kuli','Keep da gold ones. Grandpa always did.']],
 s4:[['harvests',40,'Harvest 40 plants before the big swell','Kai','Surf is coming. Get the harvest in early.'],
     ['sold',150,'Sell 150 buds','Keoni','Surf contest week means a busy stand.'],
     ['water',80,'Water 80 plants in the summer heat','Malia','Summer is dry. Keep the plants watered.'],
     ['customers',10,'Serve 10 surfers','Kai','Da boys stay coming in from Hanalei. Go help them.'],
     ['cured',60,'Cure 60 buds','Auntie Lani','Cool, slow curing keeps the summer terps.'],
     ['bred',3,'Try 3 crossbreeds','Uncle Ikaika','Breed something that handles the heat.'],
     ['hunts',2,'Finish 2 pheno hunts','Malia','Find a pheno that smells like shave ice.'],
     ['keepers',2,'Keep 2 mothers','Unko Kuli','Keep the good ones. Summer go by fast, brah.']],
 s5:[['harvests',40,'Harvest 40 plants for Aloha Festivals','Auntie Lani','The parade floats need a lot of flowers this year.'],
     ['sold',150,'Sell 150 buds','Keoni','Festival crowds all week. Keep selling.'],
     ['plant',60,'Plant 60 seeds','Malia','Plant now for the fall harvest.'],
     ['customers',10,'Serve 10 festival guests','Kai','Ho, da ukulele band like try your buds!'],
     ['cured',60,'Cure 60 buds','Auntie Lani','Cure them well. We share with the whole block.'],
     ['bred',3,'Try 3 crossbreeds','Uncle Ikaika','Festival season is a good time for new crosses.'],
     ['hunts',2,'Finish 2 pheno hunts','Malia','Find a grape pheno for the parade.'],
     ['keepers',2,'Keep 2 mothers','Unko Kuli','Aloha means taking care. Take care of your mothers.']],
 s6:[['harvests',40,'Harvest 40 plants for Makahiki','Unko Kuli','Makahiki is the harvest season. Bring in a big one.'],
     ['sold',150,'Sell 150 buds','Keoni','Holiday shoppers are out. Keep the stand full.'],
     ['crafted',10,'Craft 10 goods','Malia','Make gifts for the holidays.'],
     ['customers',10,'Serve 10 walk-in customers','Auntie Lani','Get plenny visitors for da holidays. Go help them.'],
     ['cured',60,'Cure 60 buds','Malia','Cure the last harvest of the year with care.'],
     ['bred',3,'Try 3 crossbreeds','Uncle Ikaika','End the year with a bold cross.'],
     ['hunts',2,'Finish 2 pheno hunts','Kai','One more hunt before the new year.'],
     ['keepers',2,'Keep 2 mothers','Unko Kuli','Good job this year. Keep the best ones for next season.']],
};
function seasonQuests(id){ const S=SEASONS.find(x=>x.id===id); return (SQ_RAW[id]||[]).map(([k,n,t,who,say],i)=>({i,k,n,t,who,say,
  r: i===7?{gems:100,px:300,legPacks:1,strain:S.strain,seeds:2}:i===3?{gems:35,px:180,rarePacks:1}:{gems:20+5*i,px:120+20*i}})); }

window.PASS={SEASON_EV,seasonQuests,regCos,SEASONS,PASS_STRAINS,PASS_XP,TIERS,XP_PER_TIER,track,totals,seasonNow,PRICE:{premium:14.99,plus:19.99,gems:3000,plusSkip:10}};
})();
