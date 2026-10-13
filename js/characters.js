/* Story characters. Painted portraits: Unko Kuli from art-src/unko-kuli.jpg, the five managers from art-src/managers.jpg
   (crops made by tools/process_art.py). portrait = 256px square, waist = waist-up 256x384, bust = round 160px HUD badge. */
const P=n=>({portrait:`art/portraits/${n}.webp`, waist:`art/portraits/${n}-waist.webp`, bust:`art/portraits/${n}-bust.webp`});
window.CHARACTERS={
  'Unko Kuli':   {role:'Your mentor. An old-school Kauai grower who teaches you the trade', ...P('unko-kuli'), story:'art/portraits/unko-kuli-story.webp'},
  'Kai':         {role:'Gardener who runs the garage for you once hired', ...P('kai')},
  'Malia':       {role:'Farm manager who knows greenhouses inside out', ...P('malia')},
  'Keoni':       {role:'Indoor tech who keeps the sealed rooms dialed in', ...P('keoni')},
  'Nick':        {role:'Indoor facility manager. Runs the sealed rooms off his tablet', ...P('nick')},
  'Auntie Lani': {role:'Lei maker who also knows everyone at the county permit office', ...P('lani')},
  'Uncle Ikaika':{role:'Landowner selling the old family terraces on the hill', ...P('ikaika')},
};
window.portraitImg=function(name,cls,kind){ const c=window.CHARACTERS[name]; const src=c?(c[kind||'portrait']||c.portrait):'art/portraits/placeholder.svg';
  return `<img class="${cls||'portrait'}" src="${src}" alt="${name}" onerror="this.onerror=null;this.src='art/portraits/placeholder.svg'">`; };
// What each story character says when a goal starts (speaker = QUESTS[].who in game.js). Plain English; the local characters
// (Unko Kuli, Uncle Ikaika, Auntie Lani, Kai) use a light touch of pidgin in about 1 line in 4. UI text is always plain English.
window.STORY_SAY={
  plant:"Welcome! These four buckets on the grow table are where I started too. Pick Northern Lights from your seeds and tap a bucket. Thirty seconds and you'll see what I mean.",
  water:"Plants get thirsty fast. Tap a plant to water it, or pick up the watering tool.",
  harvest:"See the gold glow? That means it's ripe. Tap it to harvest. Don't wait too long.",
  dry:"Fresh buds sell cheap. Hang them on the drying racks first. Patience pays.",
  sell:"Take your dried buds to the farm stand. Your first money out of Grandpa's garage. Shoots, nice job!",
  gcap:"Two plants won't buy the land. Let's get you more buckets. Look under Upgrades, Garage tab.",
  feed:"Nutrients make plants grow faster and bigger. Feed the hungry ones.",
  hose:"A watering can is fine for two plants, not for twenty. Get a hose so you can water everything at once.",
  order:"The neighbors are asking for your buds now. Fill their orders on the board. They pay extra and they tell their friends.",
  tent3:"Time to fill the back table. More buckets, more plants.",
  land:"I'm selling the old family terraces up on the hill. Save up, it's your future farm. When you buy it, Grandpa's garage turns into your Pheno Room for hunting new strains.",
  field:"Plant the starter terrace. Sun, rain and trade winds. Growing outdoors costs nothing to power, but the weather is in charge.",
  ghbuild:"A greenhouse keeps the rain off and the warmth in. Build one and I'll help you run it.",
  mgr:"You can't be in two places at once. Hire me to run the garage while you work the farm.",
  breed:"Now the fun part. Cross two strains in the Pheno Room. Nobody hands you the recipes. You have to find them.",
  craft:"Got extra buds? Press some bubble hash. Small kine batch, big value.",
  ghfull:"Fill every bed in the greenhouse. The county wants to see a real operation before they talk about indoor.",
  permit:"No worries, I know everybody at the county office. I'll walk your agricultural permit through, and we'll keep it all legal.",
  indoor:"This is the big one. Sealed rooms, LED bars, rolling benches. Expensive to run, but the quality is worth it.",
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
  happy:['Perfect, thank you!','This is exactly what I wanted.','Smells amazing. See you next week!','Best stand on the island.'],
  happyP:['Ho, nice! Mahalo!','Shoots, this the one!'],
  ok:['Thanks, that works.','Good enough for today.','Thank you, see you around.'],
  grumpy:['I cannot wait any longer.','Nothing for me today, I guess.','Too slow today. Maybe next time.'],
  grumpyP:['Eh, too long already. Next time.'],
  none:['Hmm, nothing like that yet?','Not quite what I wanted.'],
  pick(kind,who,p){ const local=!this.visitors.includes(who); const pid=this[kind+'P']; const L=(local&&pid&&Math.random()<.22)?pid:this[kind]; return L[Math.floor(Math.random()*L.length)].replace('{p}',p||'something good'); }
};
