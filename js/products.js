/* Maui Wowie Farms product catalog.
 * Real-money products (priceUSD) are sold through payments.js -> purchase(productId).
 * Gem items (priceGems) are bought with gems, which are ALSO earned in-game
 * (level-ups, goals, daily gift, golden buds, new strain discoveries).
 * Fairness rules: nothing in the core loop needs money. Every non-cosmetic
 * benefit here can also be earned with in-game gems. Cosmetic themes are the
 * only real-money-only items (one theme, "Golden Hour", is earned free at level 10).
 */
window.PRODUCTS = {
  // ---- Real-money (USD) ----
  gems_s:   {id:'gems_s',  kind:'usd', priceUSD:0.99,  name:'Pouch of Gems',  desc:'120 gems',            grants:{gems:120}, art:'gems1'},
  gems_m:   {id:'gems_m',  kind:'usd', priceUSD:4.99,  name:'Jar of Gems',    desc:'650 gems (+8% bonus)', grants:{gems:650}, art:'gems2', flag:'Popular'},
  gems_l:   {id:'gems_l',  kind:'usd', priceUSD:9.99,  name:'Crate of Gems',  desc:'1,400 gems (+17% bonus)', grants:{gems:1400}, art:'gems3'},
  gems_xl:  {id:'gems_xl', kind:'usd', priceUSD:19.99, name:'Vault of Gems',  desc:'3,000 gems (+25% bonus)', grants:{gems:3000}, art:'gems4', flag:'Best value'},
  starter:  {id:'starter', kind:'usd', priceUSD:2.99,  name:'Starter Bundle', once:true,
             desc:'500 gems, 2 Rare Seed Packs, $2,500 cash and the Neon Luau theme', grants:{gems:500, rarePacks:2, cash:2500, theme:'neon'}, art:'starter', flag:'One time'},
  pass2x:   {id:'pass2x',  kind:'usd', priceUSD:6.99,  name:'2x Earnings Pass', once:true, desc:'Double all sale income, forever. Also earnable for 2,500 gems.', grants:{pass2x:true}, art:'pass'},
  vip:      {id:'vip',     kind:'usd', priceUSD:4.99,  name:'VIP Grower',  once:true, desc:'Auto-collect: auto-load dryer and auto-sell at good prices, plus 24h offline earnings (from 8h). Also earnable for 1,500 gems.', grants:{vip:true}, art:'vip'},
  theme_neon:  {id:'theme_neon',  kind:'usd', priceUSD:1.99, name:'Neon Luau',  once:true, desc:'Glowing tiki torches and neon night sky (cosmetic)', grants:{theme:'neon'}, art:'theme_neon'},
  theme_plumeria:{id:'theme_plumeria',kind:'usd', priceUSD:1.99, name:'Plumeria Bloom',once:true, desc:'Flowering plumeria trees and pink sand paths (cosmetic)', grants:{theme:'plumeria'}, art:'theme_plumeria'},
  theme_mauna: {id:'theme_mauna', kind:'usd', priceUSD:1.99, name:'Mauna Snow', once:true, desc:'Snow-capped summit and cool blue night (cosmetic)', grants:{theme:'mauna'}, art:'theme_mauna'},

  // ---- Gem store (all earnable) ----
  skip15:   {id:'skip15', kind:'gems', priceGems:15,  name:'Time Skip 15m', desc:'Fast-forward your farm 15 minutes', grants:{skip:900}, art:'skip'},
  skip60:   {id:'skip60', kind:'gems', priceGems:50,  name:'Time Skip 1h',  desc:'Fast-forward your farm 1 hour',     grants:{skip:3600}, art:'skip'},
  skip240:  {id:'skip240',kind:'gems', priceGems:170, name:'Time Skip 4h',  desc:'Fast-forward your farm 4 hours',    grants:{skip:14400}, art:'skip'},
  pack_rare:{id:'pack_rare',kind:'gems',priceGems:80, name:'Rare Seed Pack', desc:'5 seeds. Each seed rolls Uncommon or Rare. Odds are on this card, from the live drop table.', grants:{rarePacks:1}, art:'pack_rare'},
  pack_leg: {id:'pack_leg', kind:'gems',priceGems:260,name:'Legendary Seed Pack', desc:'4 seeds: 1 Epic slot and 3 Rare slots, plus a chance at an extra exclusive seed. Full odds below.', grants:{legPacks:1}, art:'pack_leg'},
  pass2x_g: {id:'pass2x_g', kind:'gems',priceGems:2500,name:'2x Earnings Pass', once:true, desc:'Same pass as the store, earned with gems', grants:{pass2x:true}, art:'pass'},
  vip_g:    {id:'vip_g',    kind:'gems',priceGems:1500,name:'VIP Grower', once:true, desc:'Same VIP perks, earned with gems', grants:{vip:true}, art:'vip'},
};
window.THEMES = {
  classic: {name:'Garden Isle', free:true},
  golden:  {name:'Golden Hour', earnLevel:10},
  neon:    {name:'Neon Luau'},
  plumeria:{name:'Plumeria Bloom'},
  mauna:   {name:'Mauna Snow'},
};

/* ---- Cosmetics: real money OR gems, no gameplay effect, every item is drawn in game (scene.js) ---- */
window.COSMETICS = {
  stand:  {label:'Farm stand decor', items:{
    tiki:{name:'Tiki torches', desc:'Two flickering torches at the farm stand', usd:1.99, gems:220},
    lei:{name:'Lei garland', desc:'A plumeria and orchid lei strung across the stand', usd:0.99, gems:120},
    surf:{name:'Surfboard sign', desc:'A hand-painted longboard sign: ALOHA, FRESH FROM KAUAI', usd:1.99, gems:220} }},
  truck:  {label:'Kahuna K4 paint', items:{
    sunset:{name:'Sunset orange', desc:'Glossy orange paint for the Kahuna K4 in the garage', usd:1.99, gems:240, c:[255,122,42]},
    teal:{name:'Ocean teal', desc:'Deep ocean teal paint', usd:1.99, gems:240, c:[20,170,176]},
    matte:{name:'Matte black', desc:'Flat stealth black, no shine', usd:2.99, gems:340, c:[46,46,50], matte:true},
    hibiscus:{name:'Hibiscus wrap', desc:'Big red hibiscus print wrapped across the tailgate', usd:3.99, gems:450, c:[232,69,127], wrap:true} }},
  outfit: {label:'Grower outfits', items:{
    aloha:{name:'Aloha shirt', desc:'Red hibiscus print shirt', usd:1.99, gems:200},
    poncho:{name:'Rain poncho', desc:'Bright yellow poncho for the wet season', usd:1.99, gems:200},
    overalls:{name:'Farm overalls', desc:'Denim work overalls', usd:1.99, gems:200} }},
  room_garage:{label:'Garage skin', items:{
    surfshack:{name:'Surf shack garage', desc:'Koa plank walls, surf posters and warm string lights', usd:2.99, gems:320} }},
  room_gh:{label:'Greenhouse skin', items:{
    bamboo:{name:'Bamboo greenhouse', desc:'Bamboo frame with lashed joints and thatch trim', usd:2.99, gems:320} }},
  room_indoor:{label:'Indoor room skin', items:{
    neon:{name:'Neon indoor room', desc:'Night-club neon: pink and cyan tubes and a glowing floor', usd:2.99, gems:320} }},
  pet:    {label:'Farm pets', items:{
    dog:{name:'Poi dog', desc:'A friendly island mutt who follows you around', usd:2.99, gems:350},
    cat:{name:'Farm cat', desc:'An orange tabby who naps in the sun and patrols the rows', usd:2.99, gems:350},
    moa:{name:'Moa (wild chicken)', desc:'A proud red jungle fowl that pecks along the path', usd:1.99, gems:240} }},
};
for(const [sl,g] of Object.entries(window.COSMETICS)) for(const [id,c] of Object.entries(g.items)){
  const k=sl+':'+id;
  window.PRODUCTS['cos_'+sl+'_'+id]={id:'cos_'+sl+'_'+id, kind:'usd', priceUSD:c.usd, once:true, name:c.name, desc:c.desc+' (cosmetic)', grants:{cos:k}, cos:k};
  window.PRODUCTS['cos_'+sl+'_'+id+'_g']={id:'cos_'+sl+'_'+id+'_g', kind:'gems', priceGems:c.gems, once:true, name:c.name, desc:c.desc+' (cosmetic)', grants:{cos:k}, cos:k};
}
/* ---- Premium manager slot: real money once, or gems (earnable) ---- */
window.PRODUCTS.mgr_slot  ={id:'mgr_slot',  kind:'usd',  priceUSD:4.99, once:true, name:'Extra manager: Lani', desc:'This extra-manager perk no longer hires anyone. VIP still auto-loads the dryer and auto-sells.', grants:{mgrSlot:true}, art:'mgr'};
window.PRODUCTS.mgr_slot_g={id:'mgr_slot_g',kind:'gems', priceGems:1800, once:true, name:'Extra manager: Lani', desc:'This extra-manager perk no longer hires anyone. VIP still auto-loads the dryer and auto-sells.', grants:{mgrSlot:true}, art:'mgr'};

/* ---- Exclusive premium strains (original names). Also drop rarely in play: legendary packs and finished pheno hunts (chances live in game.js DROP). ---- */
window.PREMIUM_STRAINS={'menehune-mint':{usd:2.99,gems:450},'lilikoi-pop':{usd:2.99,gems:450},'honu-blue':{usd:2.99,gems:450}};
for(const [id,c] of Object.entries(window.PREMIUM_STRAINS)){
  const nm=(window.STRAINS||[]).find(s=>s.id===id); const n=nm?nm.name:id;
  window.PRODUCTS['strain_'+id]  ={id:'strain_'+id,  kind:'usd', priceUSD:c.usd, name:n+' seeds', desc:'5 seeds of an exclusive Legendary strain', grants:{strain:id,n:5}, strain:id};
  window.PRODUCTS['strain_'+id+'_g']={id:'strain_'+id+'_g', kind:'gems', priceGems:c.gems, name:n+' seeds', desc:'5 seeds, bought with gems', grants:{strain:id,n:5}, strain:id};
}
/* ---- Timed boosts (gems only, 1 hour each, stack) ---- */
window.PRODUCTS.boost_grow ={id:'boost_grow', kind:'gems',priceGems:60,name:'2x Growth (1h)', desc:'All plants grow twice as fast for 1 hour', grants:{boost:'grow',sec:3600}, art:'boost_grow'};
window.PRODUCTS.boost_price={id:'boost_price',kind:'gems',priceGems:80,name:'2x Sale Price (1h)', desc:'Every sale pays double for 1 hour', grants:{boost:'price',sec:3600}, art:'boost_price'};
window.PRODUCTS.boost_pheno={id:'boost_pheno',kind:'gems',priceGems:50,name:'Better Pheno Odds (1h)', desc:'Pheno hunts that finish in the next hour roll wider keeper stats (yield, quality, growth). Not a random item, and it does not change seed-pack drop rates.', grants:{boost:'pheno',sec:3600}, art:'boost_pheno'};
/* ---- Piggy bank: fills with gems while you play, one purchase cracks it ---- */
window.PRODUCTS.piggy={id:'piggy',kind:'usd',priceUSD:2.99,name:'Crack the Piggy Bank',desc:'Get every gem saved in your piggy bank',grants:{piggy:true},art:'piggy'};

/* ---- Grower Pass (js/passes.js): season cosmetics + premium unlocks (per season, not once) ---- */
window.PASS.regCos();
window.PRODUCTS.pass_premium  ={id:'pass_premium',  kind:'usd',  priceUSD:window.PASS.PRICE.premium, name:'Grower Pass Premium', desc:'Unlock the premium track for this season', grants:{pass:'premium'}, art:'pass_p'};
window.PRODUCTS.pass_plus     ={id:'pass_plus',     kind:'usd',  priceUSD:window.PASS.PRICE.plus,    name:'Grower Pass Premium+', desc:'Premium track + skip the first 10 tiers', grants:{pass:'plus'}, art:'pass_p'};
window.PRODUCTS.pass_premium_g={id:'pass_premium_g',kind:'gems', priceGems:window.PASS.PRICE.gems,   name:'Grower Pass Premium', desc:'Premium track, earned with gems', grants:{pass:'premium'}, art:'pass_p'};
