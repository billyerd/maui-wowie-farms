/* Every strain the game can plant resolves to a painted sprite that is in the repo.
   Run: node tests/strain-sprite-check.js */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;
function fail(msg){ failed++; console.error('FAIL', msg); }

const strains = JSON.parse(fs.readFileSync(path.join(root, 'data/strains.json'), 'utf8'));
const passes = fs.readFileSync(path.join(root, 'js/passes.js'), 'utf8');
const scene = fs.readFileSync(path.join(root, 'js/scene.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const ids = strains.map(s => s && s.id).filter(Boolean);
const block = passes.slice(passes.indexOf('const PASS_STRAINS'), passes.indexOf('PASS_STRAINS.forEach'));
for (const m of block.matchAll(/id:\s*'([^']+)'/g)) {
  if (!ids.includes(m[1])) ids.push(m[1]);
}
if (ids.length !== 63) fail('expected 63 strains, found ' + ids.length);

if (!scene.includes("return 'art/plants/strains/'+id+'.png'")) fail('scene does not map a strain id to art/plants/strains/<id>.png');
if (!scene.includes('art/plants/stages/stage2.png')) fail('stage 2 sprite is not wired');
if (!scene.includes('art/plants/stages/early_flower.png')) fail('early flower sprite is not wired');
if (!scene.includes('art/plants/stages/mid_flower.png')) fail('mid flower sprite is not wired');
if (/function\s+warpOf|function\s+shapePlant|function\s+tintedPlant|BUD_FORMATION/.test(scene)) fail('ripe warp or tint path is still in scene.js');
if (html.includes('bud-formation.js')) fail('bud-formation.js is still loaded');
if (!/dprCap=3/.test(scene)) fail('canvas pixel ratio cap is not 3');

for (const id of ids) {
  const file = path.join(root, 'art/plants/strains', id + '.png');
  if (!fs.existsSync(file)) { fail('missing sprite for ' + id); continue; }
  const st = fs.statSync(file);
  if (st.size < 1000) fail(id + ' sprite is empty');
}
for (const name of ['stage2.png', 'early_flower.png', 'mid_flower.png']) {
  const file = path.join(root, 'art/plants/stages', name);
  if (!fs.existsSync(file)) fail('missing stage sprite ' + name);
}
for (const name of ['seedling.png', 'veg.png']) {
  if (!fs.existsSync(path.join(root, 'art/plants', name))) fail('missing ' + name);
}

const { execFileSync } = require('child_process');
try {
  execFileSync('python3', ['-c', `
from pathlib import Path
from PIL import Image
root = Path(${JSON.stringify(root)})
files = list((root/'art/plants/strains').glob('*.png')) + list((root/'art/plants/stages').glob('*.png'))
bad = []
for p in files:
    im = Image.open(p).convert('RGBA')
    w, h = im.size
    px = im.load()
    n = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            edge = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if xx < 0 or yy < 0 or xx >= w or yy >= h or px[xx, yy][3] < 8:
                    edge = True
                    break
            if not edge:
                continue
            # Saturated pink or magenta matte. Muted pistils and frost stay.
            if r >= 190 and b >= 140 and g <= 130 and (r - g) >= 70 and (b - g) >= 40:
                n += 1
    if n:
        bad.append(p.name + ':' + str(n))
if bad:
    raise SystemExit('pink fringe on ' + ', '.join(bad))
print('no pink fringe on', len(files), 'sprites')
`], { stdio: 'inherit' });
} catch (e) {
  fail('pink fringe check failed');
}

if (failed) { console.error(failed + ' strain sprite check(s) failed'); process.exit(1); }
console.log('strain sprites ok (' + ids.length + ' strains)');
