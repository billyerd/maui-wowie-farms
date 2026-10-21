/* Story characters. Painted portraits: Unko Kuli from art-src/unko-kuli.jpg, the five managers from art-src/managers.jpg
   (crops made by tools/process_art.py). portrait = 256px square, waist = waist-up 256x384, bust = round 160px HUD badge. */
const P=n=>({portrait:`art/portraits/${n}.webp`, waist:`art/portraits/${n}-waist.webp`, bust:`art/portraits/${n}-bust.webp`});
window.CHARACTERS={
  'Unko Kuli':   {role:'Your mentor. An old-school Kauai grower who teaches you the trade', ...P('unko-kuli'), story:'art/portraits/unko-kuli-story.webp'},
  'Kai':         {role:'Gardener who knows the garage buckets', ...P('kai')},
  'Malia':       {role:'Grower who knows greenhouses inside out', ...P('malia')},
  'Keoni':       {role:'Indoor tech who keeps the sealed rooms dialed in', ...P('keoni')},
  'Nick':        {role:'Grower who knows the sealed rooms', ...P('nick')},
  'Auntie Lani': {role:'Lei maker who also knows everyone at the county permit office', ...P('lani')},
  'Uncle Ikaika':{role:'Landowner selling the old family terraces on the hill', ...P('ikaika')},
};
window.portraitImg=function(name,cls,kind){ const c=window.CHARACTERS[name]; const src=c?(c[kind||'portrait']||c.portrait):'art/portraits/placeholder.svg';
  return `<img class="${cls||'portrait'}" src="${src}" alt="${name}" onerror="this.onerror=null;this.src='art/portraits/placeholder.svg'">`; };
// What each story character says when a goal starts (speaker = QUESTS[].who in game.js). Plain English; the local characters
// (Unko Kuli, Uncle Ikaika, Auntie Lani, Kai) use a light touch of pidgin in about 1 line in 4. UI text is always plain English.
window.STORY_SAY={
  plant:"Welcome! These five buckets on the grow table are where I started too. Tap the seed bag, pick Northern Lights, then tap a bucket. Thirty seconds and you'll see what I mean.",
  water:"Plants get thirsty fast. Tap a plant to water it, or pick up the watering tool.",
  harvest:"See the gold glow? That means it's ripe. Tap it to harvest. Don't wait too long.",
  dry:"Fresh buds sell cheap. Hang them on the drying racks first. Patience pays.",
  sell:"Take your dried buds to the Market. Your first money out of the garage. Shoots, nice job!",
  gcap:"Five buckets is a start. Each upgrade adds three, up to twenty. Look under Upgrades, Garage tab.",
  feed:"Halfway through, each plant wants one feeding. It is free. Skip it and they grow slower and yield less.",
  hose:"A watering can is fine for two plants, not for twenty. Get a hose so you can water everything at once.",
  order:"Sell what you grew at the Market. Dried and cured buds pay the best.",
  tent3:"The garage can hold more. Add another three buckets. Twenty is the top.",
  land:"The Indoor Facility is the last place you open, at level "+(window.G?G.LAND_LEVEL:10)+". When you buy it, Grandpa's garage turns into your Pheno Room for hunting new strains.",
  field:"Plant the starter terrace. Sun, rain and trade winds. Growing outdoors costs nothing to power, but the weather is in charge.",
  ghbuild:"The greenhouse opens at level "+(window.G?G.GH_BUILD.level:5)+". Build it and the daylight beds are yours. You do not need the Indoor Facility first.",
  mgr:"The greenhouse beds are ready. Plant a seed out there and see how the daylight treats it.",
  breed:"Now the fun part. Cross two strains in the Pheno Room. Nobody hands you the recipes. You have to find them.",
  craft:"Got extra buds? Press some bubble hash. Small kine batch, big value.",
  ghfull:"Fill every bed in the greenhouse. The county wants to see a real operation before they talk about indoor.",
  permit:"No worries, I know everybody at the county office. I'll walk your agricultural permit through, and we'll keep it all legal.",
  indoor:"This is the big one. Sealed rooms, LED bars, rolling benches. The buds come out top grade.",
  inharv:"First indoor harvest, and it's AAA grade. Great work.",
  pheno:"Find a mystery pheno. Some of the best strains in the world started as someone's lucky cross.",
  earn:"Two million in one season. Then you're a real island farmer.",
  season:"Every farmer starts over at some point. New season, same spirit, more know-how.",
};
// Farm-stand customer lines. Plain English; local customers (not visitors) use subtle pidgin about 1 line in 4-5.
window.CUST_LINES={
  visitors:['Tourist Brenda','Surfer Jake'],
  ask:['Hi there! {p}, please.','Morning! I am after {p}.','What do you have today? {p} would be great.','Hello! Looking for {p}.'],
  askP:['Howzit! {p}, if you get.','Eh, you get {p}?'],
  happy:['Perfect, thank you!','This is exactly what I wanted.','Smells amazing. See you next week!','Best buds on the island.'],
  happyP:['Ho, nice! Mahalo!','Shoots, this the one!'],
  ok:['Thanks, that works.','Good enough for today.','Thank you, see you around.'],
  grumpy:['I cannot wait any longer.','Nothing for me today, I guess.','Too slow today. Maybe next time.'],
  grumpyP:['Eh, too long already. Next time.'],
  none:['Hmm, nothing like that yet?','Not quite what I wanted.'],
  pick(kind,who,p){ const local=!this.visitors.includes(who); const pid=this[kind+'P']; const L=(local&&pid&&Math.random()<.22)?pid:this[kind]; return L[Math.floor(Math.random()*L.length)].replace('{p}',p||'something good'); }
};
