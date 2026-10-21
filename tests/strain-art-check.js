/* Every strain image path the game builds must exist in art/ with the same case.
   Run: node tests/strain-art-check.js */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const scene = fs.readFileSync(path.join(root, 'js/scene.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const haveSrc = fs.readFileSync(path.join(root, 'js/art-have.js'), 'utf8');
const strains = JSON.parse(fs.readFileSync(path.join(root, 'data/strains.json'), 'utf8'));
const artDir = path.join(root, 'art');
const onDisk = new Set(fs.readdirSync(artDir));
const byLower = new Map();
for (const name of onDisk) byLower.set(name.toLowerCase(), name);

const need = new Map();
function add(stem, why){
  if (!stem || stem.includes('*')) return;
  const file = stem.endsWith('.webp') ? stem : stem + '.webp';
  if (!need.has(file)) need.set(file, why);
}

const namesBlock = scene.match(/const NAMES=\[([\s\S]*?)\];/);
if (!namesBlock) { console.error('FAIL could not find NAMES in js/scene.js'); process.exit(1); }
for (const m of namesBlock[1].matchAll(/'([^']+)'/g)) {
  if (/^(stage\d+|mature_[a-z0-9-]+)$/.test(m[1])) add(m[1], 'NAMES');
}

const sigBlock = scene.match(/const SIG=\{([\s\S]*?)\};/);
if (!sigBlock) { console.error('FAIL could not find SIG in js/scene.js'); process.exit(1); }
const sigVals = new Set();
for (const m of sigBlock[1].matchAll(/:\s*'([^']+)'/g)) sigVals.add(m[1]);
if (!sigVals.size) { console.error('FAIL SIG map had no file names'); process.exit(1); }
for (const name of sigVals) { add('sig_' + name, 'SIG'); add('sig_' + name + '_pot', 'SIG pot'); }

const gsLoop = scene.match(/for\(const t of '([a-z]+)'\) for\(let i=0;i<(\d+);i\+\+\)/);
const ivLoop = scene.match(/for\(const v of \[([^\]]+)\]\)\{\s*const n='gs_iv_'/);
if (!gsLoop || !ivLoop) { console.error('FAIL could not find the gs_ / gs_iv_ loaders in js/scene.js'); process.exit(1); }
for (const t of gsLoop[1]) for (let i = 0; i < +gsLoop[2]; i++) add('gs_' + t + i, 'growth sprite');
for (const m of ivLoop[1].matchAll(/'([^']+)'/g)) add('gs_iv_' + m[1], 'indica colour');

for (const s of strains) {
  const base = s.look && s.look.base || 'green';
  if (!/^[a-z0-9-]+$/.test(base)) { console.error('FAIL bad look.base on', s.id, base); process.exitCode = 1; continue; }
  add('mature_' + base, 'look.base ' + s.id);
}
add('mature_green', 'look fallback');

const have = JSON.parse(haveSrc.slice(haveSrc.indexOf('{'), haveSrc.lastIndexOf('}') + 1));
for (const key of Object.keys(have)) {
  if (/^(sig_|gs_|stage\d|mature_)/.test(key)) add(key, 'ART_HAVE');
}

let missing = 0;
for (const [file, why] of [...need.entries()].sort()) {
  if (onDisk.has(file)) continue;
  missing++;
  const folded = byLower.get(file.toLowerCase());
  console.error('MISSING', file, '(' + why + ')', folded ? 'disk has ' + folded : 'not in art/');
}
if (/src="\$\{R\.closeup/.test(ui + main)) {
  missing++;
  console.error('FAIL a strain picture is still inlined as an R.closeup data URL');
}
if (!scene.includes('function closeupCanvas')) { missing++; console.error('FAIL closeupCanvas is missing'); }
if (!ui.includes('function paintStrainImgs')) { missing++; console.error('FAIL paintStrainImgs is missing'); }

if (missing) { console.error(missing + ' strain art check(s) failed'); process.exit(1); }
console.log('strain art ok (' + need.size + ' paths)');
