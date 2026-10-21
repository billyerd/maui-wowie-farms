/* Live magnifier: hold ~0.45s on the room, drag while the finger is down, release to dismiss.
   Real touches go through Chrome's touch pipeline (Input.dispatchTouchEvent).
   Run: node tests/hold-inspect-check.js
   Uses headless Chrome against the local static server. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.HOLD_CHROME_PORT || '9494';
const GAME = process.env.HOLD_GAME_URL || 'http://127.0.0.1:8765/index.html';
const SHOTS = process.env.HOLD_SHOTS || '/tmp/hold-shots';

function fail(msg){ console.error('FAIL', msg); process.exitCode = 1; }
function assert(cond, msg){ if (!cond) fail(msg); }
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function get(url, method){
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: method || 'GET' }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main(){
  let serverUp = false;
  try { const r = await get(GAME); serverUp = r.status === 200; } catch (e){ serverUp = false; }
  if (!serverUp){ fail('static server is not serving ' + GAME); return; }
  fs.mkdirSync(SHOTS, { recursive: true });

  const profile = '/tmp/chrome-hold-' + PORT;
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--touch-events=enabled',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    await waitPort();
    const created = await get('http://127.0.0.1:' + PORT + '/json/new?about:blank', 'PUT');
    let list;
    try { list = JSON.parse(created.body); }
    catch (e){ throw new Error('json/new ' + created.status + ' ' + created.body.slice(0, 200)); }
    const ws = new WebSocket(list.webSocketDebuggerUrl);
    let seq = 0;
    const wait = new Map();
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && wait.has(m.id)){
        const { resolve, reject } = wait.get(m.id);
        wait.delete(m.id);
        if (m.error) reject(new Error(m.error.message || JSON.stringify(m.error)));
        else resolve(m.result);
      }
    });
    await new Promise(res => ws.addEventListener('open', res, { once: true }));
    function cdp(method, params){
      const id = ++seq;
      ws.send(JSON.stringify({ id, method, params: params || {} }));
      return new Promise((resolve, reject) => wait.set(id, { resolve, reject }));
    }
    async function evalJs(expression){
      const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 1600));
      return r.result && r.result.value;
    }
    async function touch(type, x, y){
      const end = type === 'touchEnd' || type === 'touchCancel';
      await cdp('Input.dispatchTouchEvent', {
        type,
        touchPoints: end ? [] : [{ x: x, y: y, id: 1, radiusX: 2, radiusY: 2, rotationAngle: 0, force: 0.6 }]
      });
    }
    async function shot(name){
      const data = await evalJs(`(() => { R.frame(0.016); return document.getElementById('game').toDataURL('image/png'); })()`);
      const b64 = String(data || '').replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(b64, 'base64'));
    }

    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Network.enable');
    await cdp('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source:
      `window.__errs=[];
window.addEventListener('error', e => window.__errs.push(String(e.message||e.error||e)));
const _ce=console.error; console.error=function(){ window.__errs.push([].map.call(arguments,String).join(' ')); return _ce.apply(console, arguments); };
localStorage.removeItem('mwfarms_save_v1');
localStorage.setItem('mwfarms_age_ok','1');
localStorage.setItem('mwfarms_ad_consent_v1','contextual');
(function(){
  const orig = Element.prototype.setPointerCapture;
  window.__caps = 0;
  Element.prototype.setPointerCapture = function(id){ window.__caps++; return orig.apply(this, arguments); };
})();`
    });
    await cdp('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: true
    });
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp('Page.navigate', { url: GAME + '?hold=' + Date.now() });
    await sleep(1600);
    await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); if(window.Tutorial&&Tutorial.skip) Tutorial.skip(); const m=document.getElementById('modal'); if(m) m.classList.add('hidden'); return true; })()`);
    await sleep(500);

    const boot = await evalJs(`(async () => {
      const cs = id => getComputedStyle(document.getElementById(id)||document.documentElement);
      const stage = document.getElementById('stage');
      const game = document.getElementById('game');
      window.__lens = () => {
        const L = window.R && R.lens;
        const modal = document.getElementById('modal');
        const pop = document.getElementById('pop');
        return {
          on: !!(L && L.on), x: L ? L.x : null, y: L ? L.y : null,
          viewX: L ? L.viewX : null, viewY: L ? L.viewY : null,
          w: innerWidth, h: innerHeight,
          modal: !!(modal && !modal.classList.contains('hidden')),
          pop: !!(pop && !pop.classList.contains('hidden'))
        };
      };
      window.__closeGlass = async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        if (window.UI && UI.hidePop) UI.hidePop();
        try { if (window.R && R.lens && R.lens.on) R.setLens(false); } catch (e){}
        const cel = document.getElementById('celebrate');
        if (cel && !cel.classList.contains('hidden')){
          const b = cel.querySelector('button');
          if (b) b.click(); else cel.classList.add('hidden');
          await sleep(120);
        }
        for (let i = 0; i < 4; i++){
          const m = document.getElementById('modal');
          if (!m || m.classList.contains('hidden')) break;
          const b = m.querySelector('.acts .btn');
          if (b) b.click(); else m.classList.add('hidden');
          await sleep(120);
        }
        return true;
      };
      window.__spots = room => {
        if (room === 'gh'){ G.st.ghBuilt = true; G.st.ghMatch = 5; G.syncPlots(); G.setRoom('gh'); }
        else if (room === 'facility'){ G.st.land = true; G.st.field = 0; G.syncPlots(); G.setRoom('facility'); }
        else G.setRoom('garage');
        const zone = room === 'gh' ? 'gh' : room === 'facility' ? 'field' : 'garage';
        const pot = G.st.plots.find(p => p.zone === zone && p.owned);
        G.st.plots.forEach(p => { p.strain = null; p.eggs = 0; p.pest = null; });
        if (pot){ pot.strain = 'northern-lights'; pot.prog = 0.55; pot.water = 1; pot.food = 1; pot.pest = null; pot.eggs = 0; }
        for (let i = 0; i < 5; i++) R.frame(0.016);
        function top(x, y){
          const el = document.elementsFromPoint(x, y)[0];
          return el ? (el.id || el.tagName) : '';
        }
        function world(x, y){ const id = top(x, y); return id === 'stage' || id === 'game'; }
        let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
        for (let y = 150; y < 700; y += 6){
          for (let x = 24; x < 366; x += 6){
            if (!world(x, y)) continue;
            let h = null; try { h = R.pick(x, y); } catch (e){ h = null; }
            if (h && h.type === 'plot' && h.p && h.p.strain){
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
          }
        }
        let plant = null;
        if (maxX >= 0){
          const x = Math.round((minX + maxX) / 2), y = Math.round((minY + maxY) / 2);
          plant = { x, y, top: top(x, y), box: { minX, maxX, minY, maxY } };
        }
        const sprites = (R.bedSprites ? R.bedSprites() : []).filter(s => s && s.id);
        const painted = sprites.filter(s => s.painted && s.grown && !s.closeup);
        const btn = document.getElementById('locBtn');
        const br = btn ? btn.getBoundingClientRect() : null;
        return {
          room: G.currentRoom(), zone,
          plant, painted: painted.length, sprites: sprites.length,
          hud: br ? { x: Math.round(br.left + br.width / 2), y: Math.round(br.top + br.height / 2), top: top(br.left + 4, br.top + 4) } : null,
          sheetBlocks: top(195, 420) === 'sheet'
        };
      };
      window.__ringPx = () => {
        const L = R.lens;
        if (!L || !L.on) return { on:false };
        const cx = L.viewX != null ? L.viewX : L.x, cy = L.viewY != null ? L.viewY : L.y;
        const cv = document.getElementById('game');
        const ctx = cv.getContext('2d');
        const dpr = cv.width / Math.max(1, cv.clientWidth);
        const r0 = Math.min(78, innerWidth * 0.2) * (G.lv('loupe') ? 1.3 : 1);
        let hit = 0, n = 0;
        for (const r of [r0 - 4, r0, r0 + 4]){
          for (let i = 0; i < 16; i++){
            const a = (i / 16) * Math.PI * 2;
            const px = Math.round((cx + Math.cos(a) * r) * dpr);
            const py = Math.round((cy + Math.sin(a) * r) * dpr);
            if (px < 1 || py < 1 || px >= cv.width - 1 || py >= cv.height - 1) continue;
            const p = ctx.getImageData(px, py, 1, 1).data;
            n++;
            // The lens rim is #f0c45a. Dark room pixels must not count.
            const gold = p[0] > 190 && p[1] > 140 && p[1] < 235 && p[2] > 40 && p[2] < 155 && p[0] > p[2] + 40;
            if (gold) hit++;
          }
        }
        const cols = [];
        for (let i = 0; i < 8; i++){
          const a = (i / 8) * Math.PI * 2;
          const px = Math.round((cx + Math.cos(a) * r0) * dpr);
          const py = Math.round((cy + Math.sin(a) * r0) * dpr);
          if (px < 0 || py < 0 || px >= cv.width || py >= cv.height){ cols.push(null); continue; }
          const p = ctx.getImageData(px, py, 1, 1).data;
          cols.push([p[0], p[1], p[2], p[3]]);
        }
        return { on:true, hit, n, r: r0, dpr, x: cx, y: cy, cols };
      };
      const stageCS = stage ? cs('stage') : null;
      const gameCS = game ? cs('game') : null;
      const cssText = await (await fetch('css/style.css', { cache: 'no-store' })).text();
      const flat = cssText.replace(/\\s+/g, '');
      return {
        htmlTA: getComputedStyle(document.documentElement).touchAction,
        bodyTA: getComputedStyle(document.body).touchAction,
        stageTA: stage ? stageCS.touchAction : 'missing',
        gameTA: game ? gameCS.touchAction : 'missing',
        confettiPE: cs('confetti').pointerEvents,
        stageCallout: stageCS ? stageCS.webkitTouchCallout : 'missing',
        gameCallout: gameCS ? gameCS.webkitTouchCallout : 'missing',
        stageSelect: stageCS ? stageCS.userSelect : 'missing',
        gameSelect: gameCS ? gameCS.userSelect : 'missing',
        htmlCallout: getComputedStyle(document.documentElement).webkitTouchCallout,
        htmlSelect: getComputedStyle(document.documentElement).userSelect,
        cssCallout: flat.indexOf('-webkit-touch-callout:none') >= 0,
        cssSelect: flat.indexOf('user-select:none') >= 0,
        cssTouch: flat.indexOf('touch-action:none') >= 0,
        cssCanvas: flat.indexOf('canvas') >= 0 && flat.indexOf('touch-action:none') > flat.indexOf('canvas'),
        hasStage: !!stage
      };
    })()`);
    console.log('styles', JSON.stringify(boot));
    assert(boot && boot.hasStage, 'playfield stage is missing');
    assert(boot.htmlTA === 'manipulation' && boot.bodyTA === 'manipulation', 'page touch-action should stay manipulation: ' + JSON.stringify(boot));
    assert(boot.stageTA === 'none' && boot.gameTA === 'none', 'stage and canvas need touch-action none: ' + JSON.stringify(boot));
    assert(boot.confettiPE === 'none', 'confetti canvas still receives touches');
    assert(boot.stageSelect === 'none' && boot.gameSelect === 'none' && boot.htmlSelect === 'none', 'user-select should be none: ' + JSON.stringify(boot));
    assert(boot.cssCallout && boot.cssSelect && boot.cssTouch && boot.cssCanvas, 'stylesheet is missing callout, user-select, canvas, or touch-action: ' + JSON.stringify(boot));

    const blocked = await evalJs(`(() => {
      const stage = document.getElementById('stage');
      const menu = stage.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, cancelable:true, clientX:40, clientY:200 }));
      const sel = stage.dispatchEvent(new Event('selectstart', { bubbles:true, cancelable:true }));
      return { menuPrevented: menu === false, selectPrevented: sel === false };
    })()`);
    assert(blocked && blocked.menuPrevented && blocked.selectPrevented, 'contextmenu or selectstart was not cancelled: ' + JSON.stringify(blocked));

    const images = await evalJs(`(async () => {
      for (let i = 0; i < 50; i++){
        if (window.R && R.imagesLoaded && R.imagesLoaded()) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    })()`);
    assert(images === true, 'plant sprites did not finish loading');

    function near(lens, x, y){
      return lens && lens.on && Math.abs(lens.x - x) <= 8 && Math.abs(lens.y - y) <= 8;
    }
    // The magnified sample stays on the finger. The drawn glass sits above it, or below only when the top edge has no room.
    function glassClear(lens, ring, tx, ty){
      if (!lens || !ring || lens.viewX == null || lens.viewY == null) return false;
      const r = ring.r || 0, vx = lens.viewX, vy = lens.viewY, w = lens.w || 390, h = lens.h || 844;
      const gap = 36, m = 8;
      const on = vx - r >= -2 && vy - r >= -2 && vx + r <= w + 2 && vy + r <= h + 2;
      const above = vy + r <= ty - 16;
      const below = vy - r >= ty + 16;
      const roomAbove = (ty - r - gap) >= (r + m);
      return on && (roomAbove ? above : (above || below));
    }

    const rooms = {};
    for (const room of ['garage', 'gh', 'facility']){
      const spot = await evalJs('window.__spots(' + JSON.stringify(room) + ')');
      await evalJs('window.__closeGlass()');
      await sleep(80);
      rooms[room] = { spot };
      assert(spot && spot.plant && !spot.sheetBlocks, room + ' had no plant on the stage: ' + JSON.stringify(spot));
      assert(spot.plant.top === 'stage' || spot.plant.top === 'game', room + ' plant touch would hit ' + (spot.plant && spot.plant.top));
      assert(spot.painted > 0, room + ' plant is not a painted grown sprite: ' + JSON.stringify(spot));

      const x = spot.plant.x, y = spot.plant.y;
      try { await touch('touchCancel', x, y); } catch (e){}
      try { await touch('touchEnd', x, y); } catch (e){}
      await sleep(40);
      await evalJs('window.__caps=0; window.__closeGlass()');
      await touch('touchStart', x, y);
      await sleep(180);
      const early = await evalJs('window.__lens()');
      await sleep(420);
      const held = await evalJs('(() => { R.frame(0.016); return { lens: window.__lens(), ring: window.__ringPx(), caps: window.__caps }; })()');
      const dx = x + 64, dy = y + 36;
      await touch('touchMove', dx, dy);
      await sleep(40);
      const dragged = await evalJs('(() => { R.frame(0.016); return { lens: window.__lens(), ring: window.__ringPx() }; })()');
      if (room === 'garage') await shot('hold_lens_garage');
      if (room === 'gh') await shot('hold_lens_greenhouse');
      if (room === 'facility') await shot('hold_lens_facility');
      await evalJs(`(() => {
        const stage = document.getElementById('stage');
        stage.dispatchEvent(new PointerEvent('pointercancel', { bubbles:true, cancelable:true, clientX:${dx}, clientY:${dy}, pointerId:7, pointerType:'touch', isPrimary:true, buttons:0 }));
        return true;
      })()`);
      await sleep(40);
      const afterCancel = await evalJs('window.__lens()');
      const dx2 = dx - 28, dy2 = dy + 22;
      await touch('touchMove', dx2, dy2);
      await sleep(30);
      const still = await evalJs('(() => { R.frame(0.016); return window.__lens(); })()');
      await touch('touchEnd', dx2, dy2);
      await sleep(60);
      const up = await evalJs('window.__lens()');
      rooms[room].gesture = { early, held, dragged: dragged.lens, ring: dragged.ring, afterCancel, still, up };
      console.log(room, JSON.stringify(rooms[room].gesture));

      assert(early && early.on === false && early.modal === false, room + ' glass appeared before 0.45s: ' + JSON.stringify(early));
      assert(near(held.lens, x, y) && held.lens.modal === false, room + ' hold did not keep the sample on the finger: ' + JSON.stringify(held.lens));
      assert(glassClear(held.lens, held.ring, x, y), room + ' glass is not above the finger: ' + JSON.stringify(held));
      assert(dragged.ring && dragged.ring.hit >= 8, room + ' glass ring did not draw: ' + JSON.stringify(dragged.ring));
      assert(glassClear(dragged.lens, dragged.ring, dx, dy), room + ' dragged glass covers the finger or left the screen: ' + JSON.stringify(dragged));
      assert(held.caps > 0, room + ' setPointerCapture was not called');
      assert(near(dragged.lens, dx, dy), room + ' drag did not move the glass: ' + JSON.stringify(dragged.lens));
      assert(afterCancel && afterCancel.on === true, room + ' pointercancel dismissed the glass mid-drag: ' + JSON.stringify(afterCancel));
      assert(near(still, dx2, dy2), room + ' glass stopped following after pointercancel: ' + JSON.stringify(still));
      assert(up && up.on === false, room + ' lift did not dismiss the glass: ' + JSON.stringify(up));
    }

    const garage = await evalJs('window.__spots("garage")');
    await evalJs('window.__closeGlass()');
    await sleep(60);
    await touch('touchStart', garage.plant.x, garage.plant.y);
    await sleep(70);
    await touch('touchEnd', garage.plant.x, garage.plant.y);
    await sleep(80);
    const oneTap = await evalJs(`(() => { R.frame(0.016); const pop=document.getElementById('pop'); return { lens: window.__lens(), pop: !!(pop && !pop.classList.contains('hidden')), bubbles: (R._qb?R._qb():[]).length }; })()`);
    await sleep(500);
    const afterTap = await evalJs('window.__lens()');
    console.log('quick tap', JSON.stringify({ oneTap, afterTap }));
    assert(oneTap && oneTap.lens.on === false && oneTap.pop === false, 'a quick tap opened the glass or the plant card: ' + JSON.stringify(oneTap));
    assert(afterTap && afterTap.on === false, 'a quick tap armed the glass late: ' + JSON.stringify(afterTap));

    await touch('touchStart', garage.plant.x, garage.plant.y);
    await sleep(70);
    await touch('touchEnd', garage.plant.x, garage.plant.y);
    await sleep(200);
    const popped = await evalJs(`(() => {
      const pop = document.getElementById('pop');
      const btn = pop && pop.querySelector('[data-pa="glass"]');
      return { open: !!(pop && !pop.classList.contains('hidden')), has: !!btn, text: pop ? (pop.innerText||'').slice(0, 120) : '', lens: window.__lens() };
    })()`);
    console.log('plant card', JSON.stringify(popped));
    assert(popped && popped.open && popped.has && popped.lens.on === false, 'second quick tap did not open the plant card: ' + JSON.stringify(popped));
    await evalJs(`document.querySelector('#pop [data-pa="glass"]').click()`);
    await sleep(180);
    const fromCard = await evalJs(`(() => { const m=document.getElementById('modal'); const card=document.getElementById('modalCard'); return { open: !!(m && !m.classList.contains('hidden')), text: card ? (card.innerText||'').slice(0,160) : '' }; })()`);
    assert(fromCard && fromCard.open && /Northern Lights/i.test(fromCard.text), 'Scouting glass button did not open the card: ' + JSON.stringify(fromCard));
    await evalJs('window.__closeGlass(); if (window.R && R.select) R.select(null); R.frame(0.016);');

    await touch('touchStart', garage.plant.x, garage.plant.y);
    await sleep(40);
    await touch('touchMove', garage.plant.x + 48, garage.plant.y + 8);
    await sleep(620);
    const swiped = await evalJs('(() => { R.frame(0.016); return { lens: window.__lens(), bubbles: (R._qb?R._qb():[]).length }; })()');
    await touch('touchEnd', garage.plant.x + 48, garage.plant.y + 8);
    await sleep(40);
    const swipedUp = await evalJs('window.__lens()');
    console.log('swipe', JSON.stringify({ swiped, swipedUp }));
    assert(swiped && swiped.lens.on === false, 'a swipe before the hold still opened the glass: ' + JSON.stringify(swiped));
    assert(swipedUp && swipedUp.on === false, 'swipe release showed the glass: ' + JSON.stringify(swipedUp));
    await touch('touchStart', garage.plant.x, garage.plant.y);
    await sleep(60);
    await touch('touchEnd', garage.plant.x, garage.plant.y);
    await sleep(120);
    const afterSwipeTap = await evalJs(`(() => { const pop=document.getElementById('pop'); return { open: !!(pop && !pop.classList.contains('hidden')), lens: window.__lens() }; })()`);
    assert(afterSwipeTap && afterSwipeTap.open === false && afterSwipeTap.lens.on === false, 'the swipe counted as a tap: ' + JSON.stringify(afterSwipeTap));

    if (garage.hud){
      await evalJs('window.__closeGlass()');
      const before = await evalJs(`(() => { const p=document.getElementById('locPick'); return { open: !!(p && !p.classList.contains('hidden')) }; })()`);
      await touch('touchStart', garage.hud.x, garage.hud.y);
      await sleep(80);
      await touch('touchEnd', garage.hud.x, garage.hud.y);
      await sleep(200);
      const hudTap = await evalJs(`(() => { const p=document.getElementById('locPick'); return { lens: window.__lens(), open: !!(p && !p.classList.contains('hidden')) }; })()`);
      await touch('touchStart', garage.hud.x, garage.hud.y);
      await sleep(560);
      const hudHold = await evalJs('window.__lens()');
      await touch('touchEnd', garage.hud.x, garage.hud.y);
      console.log('hud', JSON.stringify({ before, hudTap, hudHold, hud: garage.hud }));
      assert(hudTap && hudTap.lens.on === false && hudTap.open !== before.open, 'a quick tap on the location button did not click it: ' + JSON.stringify(hudTap));
      assert(hudHold && hudHold.on === false, 'a hold on the location button started the glass: ' + JSON.stringify(hudHold));
    }

    await cdp('Page.navigate', { url: GAME + '?test=lv10&holdlv=' + Date.now() });
    await sleep(1600);
    await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); if(window.Tutorial&&Tutorial.skip) Tutorial.skip(); const m=document.getElementById('modal'); if(m) m.classList.add('hidden'); return true; })()`);
    await sleep(400);
    const lv = await evalJs(`(() => ({ level: G.st.level, cash: G.st.cash, fmt: G.fmt(G.st.cash), key: window.GAME_CONFIG.saveKey, tag: !document.getElementById('testTag').classList.contains('hidden'), lens: typeof R.setLens }))()`);
    console.log('lv10', JSON.stringify(lv));
    assert(lv && lv.level === 10 && lv.cash === 100000000 && lv.fmt === '$100M' && lv.key === 'mwfarms_test_v1' && lv.tag === true && lv.lens === 'function', '?test=lv10 did not boot: ' + JSON.stringify(lv));

    const errs = await evalJs('(window.__errs||[]).slice(0, 12)');
    const bad = (errs || []).filter(e => !/AudioContext|favicon/i.test(e));
    assert(!bad.length, 'console errors: ' + bad.join(' | '));
    if (!process.exitCode) console.log('hold inspect checks passed');
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

async function waitPort(){
  for (let i = 0; i < 40; i++){
    try { await get('http://127.0.0.1:' + PORT + '/json/version'); return; }
    catch (e){ await sleep(250); }
  }
  throw new Error('Chrome did not open port ' + PORT);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
