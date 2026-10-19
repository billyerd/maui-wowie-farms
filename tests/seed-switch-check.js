/* When the selected seed runs out, the next tap plants the first bag seed
   that fits the current room. A pick with seeds left is kept, including
   across a reload. An empty plantable bag shows "No seeds" and a pot tap
   does not open the shop. Tapping the tab still does.
   Run: node tests/seed-switch-check.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = {
  console,
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
  return {
    add: (...c) => c.forEach(x => s.add(x)),
    remove: (...c) => c.forEach(x => s.delete(x)),
    contains: c => s.has(c),
    toggle(c, on){ const next = on == null ? !s.has(c) : !!on; next ? s.add(c) : s.delete(c); return next; }
  };
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
  const node = {
    className: '', textContent: '', _html: '', scrollTop: 0, value: '', style: {}, dataset: {},
    clientWidth: 390, clientHeight: 600, width: 0, height: 0, children: [],
    classList: classList(),
    addEventListener(){}, removeEventListener(){},
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
sandbox.document = {
  title: '',
  body: make('body'),
  documentElement: { style: { getPropertyValue(){ return ''; }, setProperty(){} } },
  getElementById: id => els[id] || null,
  querySelector: sel => { const m = String(sel).match(/^#([\w-]+)$/); return m ? ensure(m[1]) : null; },
  querySelectorAll: () => [],
  addEventListener(){},
  createElement: () => make('')
};
sandbox.Sound = { play(){}, setScene(){}, setPaused(){}, resume(){} };
sandbox.R = { closeup(){ return ''; }, plantCard(){}, cosPreview(){}, shake(){}, frame(){}, fit(){}, resize(){}, lens:{on:false}, setLens(){} };
sandbox.Payments = { isOwned(){ return false; }, setConfirmUI(){}, formatUSD(){ return '$0'; }, mode: 'test', purchase: async () => ({ ok: false }), restore: async () => ({ restored: [] }) };
sandbox.Ads = { consent(){ return 'contextual'; }, setConsent(){}, show: async () => ({ completed: false }) };

vm.createContext(sandbox);
function load(rel){
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), sandbox, { filename: rel });
}
load('js/config.js');
load('js/storage.js');
load('js/strains.js');
load('js/characters.js');
load('js/game.js');
load('js/ui.js');

const G = sandbox.G;
const UI = sandbox.UI;
function fail(msg){ console.error('FAIL', msg); process.exitCode = 1; }
function assert(cond, msg){ if (!cond) fail(msg); }

const info = G.load();
assert(info && info.fresh && !info.corrupt, 'fresh load failed');
const gdp = G.strain('granddaddy-purple');
const oldGrow = gdp.game.growSec;
const oldRooms = gdp.rooms;
try {
  gdp.game.growSec = 10;
  gdp.rooms = ['gh'];
  G.st.room = 'garage';
  G.st.loc = 'garage';
  G.st.seeds = { 'granddaddy-purple': 5, 'northern-lights': 2, 'durban-poison': 2 };
  G.st.discovered['granddaddy-purple'] = true;
  G.st.discovered['durban-poison'] = true;
  G.st.selSeed = 'durban-poison';
  const pots = G.st.plots.filter(p => p.zone === 'garage' && p.owned);
  pots.forEach(p => { p.strain = null; p.prog = 0; });
  assert(pots.length >= 5, 'garage did not start with 5 pots: ' + pots.length);

  assert(G.plant(pots[0]) === true, 'first plant failed');
  assert(pots[0].strain === 'durban-poison', 'first plant was not the player pick');
  assert(G.st.seeds['durban-poison'] === 1, 'durban count after one plant ' + G.st.seeds['durban-poison']);
  assert(G.st.selSeed === 'durban-poison', 'pick changed while seeds remained: ' + G.st.selSeed);
  assert(G.ensureSeed() === 'durban-poison', 'ensureSeed replaced a pick that still has seeds');

  assert(G.plant(pots[1]) === true, 'second plant failed');
  assert(pots[1].strain === 'durban-poison', 'the last seed of the pick was not planted');
  assert(G.st.seeds['durban-poison'] === 0, 'durban did not hit 0');
  assert(G.st.selSeed === 'northern-lights', 'did not auto-pick the next plantable seed: ' + G.st.selSeed);
  assert(G.st.selSeed !== 'granddaddy-purple', 'auto-pick used a seed the garage cannot plant');
  assert(UI.panel == null, 'planting opened a panel');

  assert(G.plant(pots[2]) === true && pots[2].strain === 'northern-lights', 'the next tap did not plant the new top seed');
  assert(G.st.seeds['northern-lights'] === 1, 'NL count after the switch plant ' + G.st.seeds['northern-lights']);
  assert(G.ensureSeed() === 'northern-lights', 'ensureSeed left NL while seeds remain');

  G.st.seeds['durban-poison'] = 1;
  assert(G.plant(pots[3], 'durban-poison') === true, 'explicit plant failed');
  assert(pots[3].strain === 'durban-poison', 'explicit plant did not use the requested seed');
  assert(G.st.selSeed === 'northern-lights', 'explicit plant of another seed changed the pick');
  assert(G.st.seeds['northern-lights'] === 1, 'explicit plant spent the selected seed');

  G.save();
  const again = G.load();
  assert(again && !again.corrupt, 'reload failed');
  assert(G.st.selSeed === 'northern-lights', 'reload dropped a pick that still had seeds: ' + G.st.selSeed);
  assert((G.st.seeds['northern-lights'] || 0) === 1, 'reload lost the NL count');

  G.st.seeds['northern-lights'] = 0;
  G.st.seeds['durban-poison'] = 0;
  G.st.seeds['granddaddy-purple'] = 5;
  assert(G.ensureSeed() === '', 'an ineligible leftover seed was selected: ' + G.st.selSeed);
  UI.init();
  UI.update(0);
  assert(ensure('sbName').textContent === 'No seeds', 'empty tab label is "' + ensure('sbName').textContent + '"');
  UI.close();
  UI.tapPlot(pots[4], 40, 40);
  assert(!pots[4].strain, 'an empty bag planted a pot');
  assert(ensure('seedPip').textContent === 'No seeds', 'pot tap did not pip No seeds');
  assert(UI.panel == null && ensure('sheet').classList.contains('hidden'), 'pot tap opened the shop');
  ensure('seedBag').onclick({ stopPropagation(){} });
  assert(UI.panel === 'seeds' && !ensure('sheet').classList.contains('hidden'), 'tab tap did not open the seed shop');
  assert(ensure('sheetTitle').textContent === 'Seed bag', 'shop title changed');
  assert(/Buy seeds/.test(ensure('sheetBody')._html) && /data-a="buy"/.test(ensure('sheetBody')._html), 'the shop buy rows are missing');
  assert(/in the bag/.test(ensure('sheetBody')._html), 'owned seeds dropped the bag count line');
  if (!process.exitCode) console.log('seed switch checks passed');
} finally {
  gdp.game.growSec = oldGrow;
  if (oldRooms == null) delete gdp.rooms; else gdp.rooms = oldRooms;
}
