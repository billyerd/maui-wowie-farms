/* Regression: old saves keep workers and upkeepPaid, but neither bills nor automates.
   An empty pot or Plant all with no seeds shows a tiny "No seeds" note and does not open the shop or bag.
   The broke-farm rescue still grants seeds.
   Run: node tests/upkeep-workers-check.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const errors = [];
const sandbox = {
  console: {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: (...a) => { errors.push(a.map(x => x && x.stack || String(x)).join('\n')); }
  },
  setInterval, clearInterval,
  URLSearchParams, Map, Set, WeakMap, Object, Array, JSON, Math, Date, Number, String, Boolean, Error, RegExp, Promise, Uint8Array, parseInt, parseFloat, isFinite, isNaN,
  performance: { now: () => Date.now() },
  devicePixelRatio: 1,
  innerWidth: 390,
  innerHeight: 844,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  crypto: global.crypto
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.location = { search: '', href: 'http://127.0.0.1/index.html', hostname: '127.0.0.1' };
function memStore(){
  const m = new Map();
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(String(k), String(v)), removeItem: k => m.delete(k) };
}
sandbox.localStorage = memStore();
sandbox.sessionStorage = memStore();
sandbox.navigator = { clipboard: { writeText: async () => {} } };
sandbox.Image = class Image { set src(v){ this._src = v; } get src(){ return this._src; } };
const els = {};
function classList(){
  const s = new Set();
  return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), contains: c => s.has(c), toggle(c, on){ const next = on == null ? !s.has(c) : !!on; next ? s.add(c) : s.delete(c); return next; } };
}
const ctx = new Proxy({}, {
  get(_t, p){
    if (p === 'measureText') return () => ({ width: 48 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop(){} });
    if (typeof p === 'symbol') return undefined;
    return () => ctx;
  },
  set(){ return true; }
});
function make(id){
  const listeners = {};
  const node = {
    className: '', textContent: '', _html: '', scrollTop: 0, value: '', style: {}, dataset: {},
    clientWidth: 390, clientHeight: 600, width: 0, height: 0, children: [],
    classList: classList(),
    addEventListener(type, fn){ (listeners[type] || (listeners[type] = [])).push(fn); },
    removeEventListener(){},
    dispatch(type, ev){ (listeners[type] || []).slice().forEach(fn => fn(ev)); },
    setPointerCapture(){},
    getContext(){ return ctx; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    getBoundingClientRect(){ return { x:0, y:0, left:0, top:0, right:44, bottom:44, width:44, height:44 }; },
    getClientRects(){ return []; },
    closest(){ return null; }, appendChild(){}, remove(){}, focus(){}, select(){}, click(){},
    setAttribute(){}, getAttribute(){ return null; }
  };
  let _id = '';
  Object.defineProperty(node, 'id', {
    get(){ return _id; },
    set(v){
      if (_id && els[_id] === node) delete els[_id];
      _id = v == null ? '' : String(v);
      if (_id) els[_id] = node;
    }
  });
  if (id) node.id = id;
  Object.defineProperty(node, 'innerHTML', {
    get(){ return node._html; },
    set(v){ node._html = String(v == null ? '' : v); }
  });
  return node;
}
function ensure(id){ if (!els[id]) els[id] = make(id); return els[id]; }
sandbox.document = {
  title: '',
  body: make('body'),
  getElementById: id => els[id] || null,
  querySelector: sel => { const m = String(sel).match(/^#([\w-]+)$/); return m ? ensure(m[1]) : null; },
  querySelectorAll: () => [],
  addEventListener(){},
  createElement: () => make('')
};
const pending = [];
let clock = 0, seq = 1;
sandbox.setTimeout = (fn, ms) => {
  const rec = { id: seq++, fn, at: clock + Math.max(0, ms || 0), dead: false };
  pending.push(rec);
  return rec.id;
};
sandbox.clearTimeout = id => {
  const rec = pending.find(t => t.id === id);
  if (rec) rec.dead = true;
};
function flush(ms){
  clock += ms;
  for (let guard = 0; guard < 1000; guard++){
    const due = pending.filter(t => !t.dead && t.at <= clock).sort((a, b) => a.at - b.at || a.id - b.id);
    if (!due.length) return;
    due[0].dead = true;
    due[0].fn();
  }
  throw new Error('timer flush did not settle');
}
sandbox.Sound = { play(){}, setScene(){}, setPaused(){}, resume(){} };
sandbox.R = { closeup(){ return ''; }, plantCard(){}, cosPreview(){}, shake(){}, frame(){}, fit(){}, resize(){}, lens:{on:false}, setLens(){} };

vm.createContext(sandbox);
function load(rel){
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), sandbox, { filename: rel });
}
load('js/config.js');
load('js/storage.js');
load('js/strains.js');
load('js/game.js');
load('js/ui.js');

const G = sandbox.G;
const UI = sandbox.UI;
function fail(msg){ console.error('FAIL', msg); process.exitCode = 1; }
function assert(cond, msg){ if (!cond) fail(msg); }

const raw = {
  v: 2, econ: 2, cash: 80, gems: 4, level: 3, xp: 0, lifetime: 10, runEarn: 10,
  lastSave: Date.now(), garage: 1, land: false, field: 0, ghBuilt: false, gh: 0,
  upkeepPaid: 123.45,
  upkeepWarn: { garage: 3, farm: 2 },
  workers: { mgrG: 1, farmhand: 1, runner: 1, merchant: 1, mgrF: 1, mgrI: 1, mgrX: 2 },
  seeds: { 'northern-lights': 0 },
  selSeed: 'northern-lights',
  discovered: { 'northern-lights': true },
  plots: [
    { id:'g0', zone:'garage', loc:'garage', idx:0, owned:true, strain:'northern-lights', prog:0.2, water:1, food:1, q:1, last:'northern-lights' },
    { id:'g1', zone:'garage', loc:'garage', idx:1, owned:true, strain:null, prog:0, water:0, food:0, q:1, last:'northern-lights' },
    { id:'f0', zone:'field', loc:'farm', idx:0, c:100, r:0, owned:true, strain:null, prog:0, water:0, food:0, q:1 },
    { id:'h0', zone:'gh', loc:'farm', idx:0, c:200, r:0, owned:false, strain:null, prog:0, water:0, food:0, q:1 }
  ],
  stats: { harvests: 1, plant: 1, sold: 0, water: 0, feed: 0 },
  quest: 0, questDone: false,
  inv: { wet:{}, dry:{}, cured:{} }, dryer: [],
  mana: 5, manaSpent: { crew: 1 }
};
sandbox.Store.set(sandbox.GAME_CONFIG.saveKey, JSON.stringify(raw));
const info = G.load();
assert(info && !info.corrupt, 'old worker save was treated as corrupt');
assert(!errors.length, 'load threw\n' + errors.join('\n'));

function sig(p){ return [p.id, p.idx, p.zone, p.loc].join('|'); }
const byId = id => G.st.plots.find(p => p.id === id);
assert(sig(byId('g0')) === 'g0|0|garage|garage', 'g0 identity changed: ' + sig(byId('g0')));
assert(sig(byId('g1')) === 'g1|1|garage|garage', 'g1 identity changed: ' + sig(byId('g1')));
assert(sig(byId('f0')) === 'f0|0|field|farm', 'f0 identity changed: ' + sig(byId('f0')));
assert(sig(byId('h0')) === 'h0|0|gh|farm', 'h0 identity changed: ' + sig(byId('h0')));
assert(G.st.workers && G.st.workers.mgrG === 1 && G.st.workers.farmhand === 1 && G.st.workers.runner === 1 && G.st.workers.mgrX === 2, 'workers were deleted on load: ' + JSON.stringify(G.st.workers));
assert(Math.abs(G.st.upkeepPaid - 123.45) < 1e-6, 'upkeepPaid was rewritten: ' + G.st.upkeepPaid);

const ids = G.QUESTS.map(q => q.id).join(',');
assert(ids === 'plant,water,harvest,dry,sell,gcap,feed,hose,order,tent3,land,field,ghbuild,mgr,breed,craft,ghfull,permit,indoor,inharv,pheno,earn,season', 'quest index moved: ' + ids);
const mgr = G.QUESTS.find(q => q.id === 'mgr');
assert(mgr && mgr.t === 'Plant a seed in a greenhouse bed' && !/hire/i.test(mgr.t), 'mgr quest still requires a hire');
assert(!G.QUESTS.find(q => q.id === 'sell').r.mgr, 'selling still grants a manager');
G.st.quest = G.QUESTS.findIndex(q => q.id === 'mgr');
G.st.questDone = false;
assert(!G.questSat(G.curQuest()), 'hired workers still finish the manager goal');
G.st.workers = { mgrG: 0, farmhand: 0 };
byId('h0').strain = 'northern-lights';
byId('h0').last = 'northern-lights';
assert(G.questSat(G.curQuest()), 'planting a greenhouse bed does not finish the goal');
byId('h0').strain = null;
byId('h0').last = null;
assert(!G.questSat(G.curQuest()), 'the manager goal completes with nothing planted');
G.st.workers = { mgrG: 1, farmhand: 1, runner: 1, merchant: 1, mgrF: 1, mgrI: 1, mgrX: 2 };

const growing = byId('g0');
G.st.upkeepWarn.garage = 3;
const slowed = G.growRate(growing);
G.st.upkeepWarn.garage = 0;
const clear = G.growRate(growing);
assert(Math.abs(slowed - clear) < 1e-9, 'a cash-short warning still slows growth');
G.st.upkeepWarn.garage = 3;
assert(G.cycleCost(growing).total === 0 && G.upkeepRates().garage.total === 0 && G.upkeepRates().indoor.total === 0, 'upkeep rates are not zero');

const cash0 = G.st.cash;
const seeds0 = G.st.seeds['northern-lights'] || 0;
const harv0 = G.st.stats.harvests;
G.st.stats.pruneHint = 1;
G.tick(8);
assert(Math.abs(G.st.cash - cash0) < 1e-6, 'cash changed during tick: ' + G.st.cash + ' from ' + cash0);
assert(Math.abs(G.st.upkeepPaid - 123.45) < 1e-6, 'upkeepPaid rose to ' + G.st.upkeepPaid);
assert((G.st.seeds['northern-lights'] || 0) === seeds0, 'a saved worker bought or planted seeds');
assert(!byId('g1').strain, 'a saved worker planted the empty pot');
assert(G.st.stats.harvests === harv0, 'a saved worker harvested');
assert(sig(byId('g0')) === 'g0|0|garage|garage' && sig(byId('f0')) === 'f0|0|field|farm', 'tick rewrote plot identity');

const beforeHire = G.st.cash;
assert(G.hire('mgrG') === false && G.hire('farmhand') === false && G.workerOk('mgrG') === false, 'hire still succeeds');
assert(G.st.cash === beforeHire && G.st.workers.mgrG === 1, 'hire spent cash or rewrote workers');
assert(G.buyMana('crew') === false && G.st.mana === 5, 'Family Crew can still be bought');

delete G.st.workers.mgrX;
G.grantProduct({ id:'mgr_slot', name:'Extra manager: Lani', grants:{ mgrSlot:true } });
assert(G.st.mgrSlot === true && !(G.st.workers.mgrX > 0), 'the extra-manager purchase still hires Lani');

let noseed = 0;
const toasts = [];
G.on('noseed', () => { noseed++; });
G.on('toast', t => { toasts.push(t && t.t); });
assert(G.plant(byId('g1')) === false && noseed === 0, 'planting with no seeds still emits noseed');

function pipEl(){ return els.seedPip; }
function pipText(){ const el = pipEl(); return el ? el.textContent : ''; }
UI.close();
UI.tapPlot(byId('g1'), 100, 100);
assert(pipText() === 'No seeds' && !pipEl().classList.contains('hidden') && !pipEl().classList.contains('out'), 'empty pot did not show the No seeds note: ' + pipText());
assert(els.sheet.classList.contains('hidden'), 'tapping an empty pot opened a sheet');
assert(!els.seedPick || els.seedPick.classList.contains('hidden'), 'tapping an empty pot opened the seed bag');
assert(!byId('g1').strain, 'tapping an empty pot with no seeds planted it');
const modalHtml = (els.modal && els.modalCard && (els.modal._html || '') + (els.modalCard._html || '')) || '';
assert(!els.modal || els.modal.classList.contains('hidden'), 'tapping an empty pot opened a modal');
assert(!/Open your seed bag|Out of those seeds|No seeds left|not enough cash for upkeep/i.test(modalHtml), 'an out-of-seeds or upkeep pop-up appeared: ' + modalHtml);
flush(1400);
assert(!pipEl().classList.contains('hidden') && !pipEl().classList.contains('out'), 'the No seeds note dismissed before 1.5s');
UI.tapPlot(byId('g1'), 100, 100);
flush(1400);
assert(pipText() === 'No seeds' && !pipEl().classList.contains('out'), 'a second tap did not keep the note up');
flush(100);
assert(pipEl().classList.contains('out') && !pipEl().classList.contains('hidden'), 'the note did not start fading at 1.5s');
flush(180);
assert(pipEl().classList.contains('hidden'), 'the note did not hide after the fade');
assert(noseed === 0, 'the empty-pot note emitted noseed');

UI.open('upgrades', 'hands');
const upBody = els.sheetBody._html;
const upTabs = els.sheetTabs._html;
assert(!/Helpers|Upkeep now|hired helper|no wages/i.test(upTabs + upBody), 'upgrades still shows helpers or upkeep: ' + upTabs);
assert(upTabs.includes('Garage') && upTabs.includes('Water + feed') && !upTabs.includes('hands'), 'helpers tab is still offered');
UI.open('upgrades', 'gh');
assert(!/upkeep/i.test(els.sheetBody._html), 'greenhouse card still mentions upkeep');
UI.open('seeds');
const foot = els.sheetFoot._html;
assert(!/Plant \d+ here/.test(foot) && !/Selected:/.test(foot), 'empty bag still shows the plant footer: ' + foot);
sandbox.Payments = { setConfirmUI(){}, formatUSD(){ return '$0'; }, mode: 'test', purchase: async () => ({ ok: false }), restore: async () => ({ restored: [] }) };
sandbox.Ads = { consent(){ return 'contextual'; }, setConsent(){}, show: async () => ({ completed: false }) };
UI.init();
const beforePlant = G.st.plots.filter(p => p.strain).length;
els.sheetFoot.dispatch('click', { target: { disabled: false, dataset: { a: 'plantall' }, closest(sel){ return sel === '[data-a]' ? this : null; } } });
assert(pipText() === 'No seeds' && !pipEl().classList.contains('hidden'), 'Plant all with no seeds did not show the note');
assert(UI.panel === 'seeds' && !els.sheet.classList.contains('hidden'), 'Plant all left the seed shop');
assert(!els.seedPick || !/Seed bag|Bag's empty/.test(els.seedPick._html || ''), 'Plant all opened the seed bag: ' + (els.seedPick && els.seedPick._html));
assert(!els.modal || els.modal.classList.contains('hidden'), 'Plant all opened a modal');
assert(G.st.plots.filter(p => p.strain).length === beforePlant, 'Plant all with no seeds planted a pot');
flush(1500);
assert(pipEl().classList.contains('out'), 'Plant all note did not fade at 1.5s');
flush(180);
assert(pipEl().classList.contains('hidden'), 'Plant all note stayed on screen');
UI.close();
assert(fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').includes("Bag's empty. Grab seeds at the shop."), 'the empty seed-bag hint was removed');

const indoor = G.st.plots.find(p => p.zone === 'in');
indoor.strain = 'northern-lights';
indoor.prog = 0.2;
indoor.water = 1;
indoor.food = 1;
G.st.upg.solar = 0;
const base = G.growRate(indoor);
G.st.upg.solar = 1;
const sun = G.growRate(indoor);
assert(Math.abs(sun / base - 1.06) < 0.001, 'solar is not +6% indoor growth: ' + (sun / base));
G.st.upg.solar = 0;
indoor.strain = null;

function waterDrop(catchLv){
  const p = byId('f0');
  p.strain = 'northern-lights';
  p.prog = 0.25;
  p.water = 1;
  p.food = 1;
  p.pest = null;
  p.eggs = 0;
  G.st.upg.catch = catchLv;
  G.st.weather.type = 'partly';
  G.st.weather.t = 0;
  G.st.weather.dur = 9999;
  const w = p.water;
  G.tick(10);
  p.strain = null;
  return w - p.water;
}
const plain = waterDrop(0);
const held = waterDrop(1);
assert(plain > 0 && held > 0 && held / plain < 0.8 && held / plain > 0.6, 'catch water hold ratio was ' + (held / plain));

G.st.vip = true;
G.st.inv.wet['northern-lights|0|B'] = 4;
G.st.dryer = [];
G.tick(6.2);
assert(G.st.dryer.length > 0 || !G.st.inv.wet['northern-lights|0|B'], 'VIP did not auto-load the dryer');

G.st.cash = 0;
G.st.seeds = {};
G.st.dryer = [];
G.st.inv = { wet:{}, dry:{}, cured:{} };
G.st.plots.forEach(p => { p.strain = null; });
const beforeRescue = toasts.length;
G.tick(1.2);
assert((G.st.seeds['northern-lights'] || 0) >= 3, 'the broke-farm rescue did not grant starter seeds');
assert(toasts.slice(beforeRescue).some(t => /3 Northern Lights seeds/.test(t || '')), 'the rescue notice was dropped: ' + toasts.slice(beforeRescue).join(' | '));
assert(!toasts.some(t => /Open your seed bag|Out of those seeds|No seeds left|not enough cash for upkeep/i.test(t || '')), 'an out-of-seeds warning toast was emitted');
assert(!errors.length, 'a panel threw\n' + errors.join('\n'));

if (process.exitCode) process.exit(process.exitCode);
console.log('upkeep and workers regression ok');
