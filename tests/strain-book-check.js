/* Regression: the Strains sheet must render for a legacy save and a mid-game save
   whose line records are missing, numeric, {g:n}, or null. Run: node tests/strain-book-check.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const FAIL = 'This page hit a problem in this save.';
const errors = [];
const sandbox = {
  console: {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: (...a) => { errors.push(a.map(x => x && x.stack || String(x)).join('\n')); }
  },
  setTimeout, clearTimeout, setInterval, clearInterval,
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
  const node = {
    id, className: '', textContent: '', _html: '', scrollTop: 0, value: '', style: {}, dataset: {},
    clientWidth: id === 'strainWeb' ? 390 : 800,
    clientHeight: id === 'strainWeb' ? 640 : 600,
    width: 0, height: 0,
    classList: classList(),
    addEventListener(){}, removeEventListener(){}, setPointerCapture(){},
    getContext(){ return ctx; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    getBoundingClientRect(){ return { x:0, y:0, left:0, top:0, right:44, bottom:44, width:44, height:44 }; },
    closest(){ return null; }, appendChild(){}, remove(){}, focus(){}, select(){}, click(){}
  };
  Object.defineProperty(node, 'innerHTML', {
    get(){ return node._html; },
    set(v){
      node._html = String(v == null ? '' : v);
      if (id !== 'sheetBody') return;
      if (node._html.includes('id="strainWeb"')) { if (!els.strainWeb) els.strainWeb = make('strainWeb'); }
      else delete els.strainWeb;
      if (node._html.includes('id="webCard"')) { if (!els.webCard) els.webCard = make('webCard'); }
      else delete els.webCard;
    }
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
  createElement: () => make('el')
};
sandbox.Sound = { play(){}, setScene(){}, setPaused(){} };
sandbox.R = { closeup: () => 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', plantCard(){}, cosPreview(){}, shake(){}, frame(){}, fit(){}, resize(){} };

vm.createContext(sandbox);
function load(rel){
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), sandbox, { filename: rel });
}
load('js/config.js');
load('js/storage.js');
load('js/strains.js');
load('js/game.js');
load('js/ui.js');

function fail(msg){ console.error('FAIL', msg); process.exitCode = 1; }
function assert(cond, msg){ if (!cond) fail(msg); }
function bookOk(label){
  const before = errors.length;
  sandbox.UI.open('book');
  const body = els.sheetBody._html;
  const tabs = els.sheetTabs._html;
  const title = els.sheetTitle.textContent;
  assert(!body.includes(FAIL), label + ' showed the save-error page');
  assert(tabs.includes('Web') && tabs.includes('List'), label + ' tabs were ' + tabs);
  assert(title === 'Strain Book', label + ' title was ' + title);
  assert(!!els.strainWeb, label + ' did not mount the strain web');
  assert(body.includes('Breeding completion'), label + ' did not render breeding progress');
  assert(errors.length === before, label + ' threw\n' + errors.slice(before).join('\n'));
  sandbox.UI.open('book', 'list');
  const list = els.sheetBody._html;
  assert(!list.includes(FAIL), label + ' list tab showed the save-error page');
  assert(list.includes('class="grid"'), label + ' list tab did not render cards');
  assert(errors.length === before, label + ' list tab threw\n' + errors.slice(before).join('\n'));
}

function boot(file){
  errors.length = 0;
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  sandbox.Store.set(sandbox.GAME_CONFIG.saveKey, JSON.stringify(raw));
  const info = sandbox.G.load();
  assert(info && !info.corrupt, file + ' was treated as corrupt');
  return raw;
}

boot('legacy-strain-save.json');
assert(sandbox.G.st.loc === 'farm', 'legacy loc was rewritten');
assert(sandbox.G.lineGen('northern-lights') === sandbox.G.LINE.max, 'missing line should stay a commercial stable line');
let prog = sandbox.G.breedProgress();
assert(Number.isFinite(prog.pct) && Number.isFinite(prog.stable), 'legacy breedProgress was not numeric');
bookOk('legacy');
const s = sandbox.G.S.find(x => x.id === 'maui-wowie');
const parents = s.parents, parentIds = s.parentIds;
s.parents = null; s.parentIds = null;
sandbox.G.st.discovered = null;
sandbox.G.st.hintRev = null;
sandbox.G.st.recipes = null;
bookOk('legacy missing discovery and parents');
s.parents = parents; s.parentIds = parentIds;

boot('mid-strain-save.json');
const lines = sandbox.G.st.lines;
assert(lines['maui-wowie'] && lines['maui-wowie'].gen === 2, 'maui-wowie {g:2} did not become gen 2');
assert(lines['northern-lights'] && lines['northern-lights'].gen === 2, 'numeric line did not become {gen:2}');
assert(lines['blue-dream'] && lines['blue-dream'].gen === 1, 'null line did not default to F1');
assert(!sandbox.G.st.keepers['maui-wowie'], 'string keeper should be dropped on load');
assert(sandbox.G.lineName('maui-wowie') === 'F2 unstable', 'line name was ' + sandbox.G.lineName('maui-wowie'));
assert(sandbox.G.lineGen('og-kush') === sandbox.G.LINE.max, 'undiscovered line slot should stay commercial');
prog = sandbox.G.breedProgress();
assert(prog.stable === 0 && prog.lines === 3, 'mid progress counted ' + prog.stable + ' stable / ' + prog.lines + ' lines');
sandbox.G.st.lines.gelato = { gen: 6, heir: 123, at: 1 };
assert(sandbox.G.lineName('gelato') === 'Heirloom (F6)', 'a normal heirloom record was ' + sandbox.G.lineName('gelato'));
assert(sandbox.G.lineMult('gelato') === sandbox.G.HEIR.mult, 'heirloom multiplier changed');
assert(sandbox.G.heirCount() === 1, 'heirloom count missed a normal record');
bookOk('mid');
delete sandbox.G.st.lines.gelato;

sandbox.G.st.lines['blue-dream'] = null;
sandbox.G.st.lines['og-kush'] = { g: 5 };
sandbox.G.st.lines['gelato'] = 4;
sandbox.G.st.keepers['maui-wowie'] = 'best';
sandbox.G.st.discovered = null;
prog = sandbox.G.breedProgress();
assert(Number.isFinite(prog.pct), 'breedProgress threw or returned a bad pct after a live bad write');
assert(sandbox.G.lineGen('og-kush') === 5, 'live {g:5} did not read as gen 5');
assert(sandbox.G.lineGen('gelato') === 4, 'live numeric line did not read as gen 4');
assert(sandbox.G.lineGen('blue-dream') === 1, 'live null line did not read as F1');
bookOk('mid live bad records');
sandbox.UI.open('book');
sandbox.StrainWeb.select('maui-wowie');
assert(!els.webCard._html.includes(FAIL), 'selecting a strain with a string keeper blanked the page');
assert(els.webCard._html.includes('Kept mother'), 'strain card did not render');
assert(els.webCard._html.includes('none'), 'string keeper was shown as a mother');
assert(!errors.length, 'selecting a strain threw\n' + errors.join('\n'));

if (process.exitCode) process.exit(process.exitCode);
console.log('strain book regression ok');
