/* Scouting glass: 3 second hold on a plant or empty floor.
   Real touches go through Chrome's touch pipeline (Input.dispatchTouchEvent),
   not element.dispatchEvent, plus a synthesized pointerType:"touch" sequence
   that pretends the finger lifted when the iOS callout starts.
   Run: node tests/hold-inspect-check.js
   Uses headless Chrome against the local static server. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = process.env.HOLD_CHROME_PORT || '9348';
const GAME = process.env.HOLD_GAME_URL || 'http://127.0.0.1:8765/index.html';

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

async function waitPort(){
  for (let i = 0; i < 40; i++){
    try { await get('http://127.0.0.1:' + PORT + '/json/version'); return; }
    catch (e){ await sleep(250); }
  }
  throw new Error('Chrome did not open port ' + PORT);
}

async function main(){
  let serverUp = false;
  try { const r = await get(GAME); serverUp = r.status === 200; } catch (e){ serverUp = false; }
  if (!serverUp){ fail('static server is not serving ' + GAME); return; }

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
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 1400));
      return r.result && r.result.value;
    }
    async function touch(type, x, y){
      const end = type === 'touchEnd' || type === 'touchCancel';
      await cdp('Input.dispatchTouchEvent', {
        type,
        touchPoints: end ? [] : [{ x: x, y: y, id: 1, radiusX: 2, radiusY: 2, rotationAngle: 0, force: 0.6 }]
      });
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
localStorage.setItem('mwfarms_ad_consent_v1','contextual');`
    });
    await cdp('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: true
    });
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp('Page.navigate', { url: GAME + '?hold=' + Date.now() });
    await sleep(1600);
    await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); if(window.Tutorial&&Tutorial.skip) Tutorial.skip(); const m=document.getElementById('modal'); if(m) m.classList.add('hidden'); return true; })()`);
    await sleep(400);

    const boot = await evalJs(`(() => {
      const cs = id => getComputedStyle(document.getElementById(id)||document.documentElement);
      const stage = document.getElementById('stage');
      window.__hit = [];
      ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','contextmenu'].forEach(type => {
        document.addEventListener(type, e => {
          window.__hit.push(type + ':' + ((e.target&& (e.target.id||e.target.tagName)) || '') + ':' + (e.pointerType||''));
          if (window.__hit.length > 30) window.__hit.shift();
        }, true);
      });
      window.__glass = () => {
        const m = document.getElementById('modal');
        const card = document.getElementById('modalCard');
        return { open: !!(m && !m.classList.contains('hidden')), text: card ? (card.innerText||card.textContent||'') : '' };
      };
      window.__ring = () => {
        const el = document.getElementById('holdRing');
        if (!el || el.classList.contains('hidden')) return { on:false, prog:0 };
        const arc = el.querySelector('.arc');
        const off = arc ? parseFloat(arc.getAttribute('stroke-dashoffset')) : 113;
        const vis = getComputedStyle(el).visibility;
        return { on: vis !== 'hidden', prog: Math.max(0, 113.097 - off), pe: getComputedStyle(el).pointerEvents };
      };
      window.__closeGlass = async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        if (window.UI && UI.hidePop) UI.hidePop();
        const cel = document.getElementById('celebrate');
        if (cel && !cel.classList.contains('hidden')){
          const b = cel.querySelector('button');
          if (b) b.click(); else cel.classList.add('hidden');
          await sleep(180);
        }
        for (let i = 0; i < 5; i++){
          const m = document.getElementById('modal');
          if (!m || m.classList.contains('hidden')) break;
          const b = m.querySelector('.acts .btn');
          if (b) b.click(); else m.classList.add('hidden');
          await sleep(180);
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
        for (let i = 0; i < 4; i++) R.frame(0.016);
        function top(x, y){
          const el = document.elementsFromPoint(x, y)[0];
          return el ? (el.id || el.tagName) : '';
        }
        function world(x, y){ const id = top(x, y); return id === 'stage' || id === 'game'; }
        function far(x, y){
          if (R.nearPlant && R.nearPlant(x, y)) return false;
          const ov = R._ovl ? R._ovl() : [];
          for (const o of ov){ if (o && Math.hypot(o.x - x, o.y - y) < 100) return false; }
          return true;
        }
        function clearFloor(x, y){
          if (!world(x, y)) return false;
          for (let dy = -24; dy <= 24; dy += 12){
            for (let dx = -24; dx <= 24; dx += 12){
              let h = null; try { h = R.pick(x + dx, y + dy); } catch (e){ return false; }
              if (h) return false;
              if (!far(x + dx, y + dy)) return false;
              if (!world(x + dx, y + dy)) return false;
            }
          }
          return true;
        }
        let plant = null, empty = null, emptyD = 1e9;
        for (let y = 150; y < 700; y += 8){
          for (let x = 36; x < 354; x += 8){
            if (!world(x, y)) continue;
            let h = null; try { h = R.pick(x, y); } catch (e){ h = { type:'err' }; }
            if (!plant && h && h.type === 'plot' && h.p && h.p.strain) plant = { x, y, top: top(x, y) };
            if (clearFloor(x, y)){
              const d = Math.hypot(x - 195, y - 200);
              if (d < emptyD){ emptyD = d; empty = { x, y, top: top(x, y) }; }
            }
          }
        }
        const btn = document.getElementById('locBtn');
        const br = btn ? btn.getBoundingClientRect() : null;
        return {
          room: G.currentRoom(), zone, owned: G.st.plots.filter(p => p.zone === zone && p.owned).length,
          plant, empty,
          hud: br ? { x: Math.round(br.left + br.width / 2), y: Math.round(br.top + br.height / 2), top: top(br.left + br.width / 2, br.top + br.height / 2) } : null,
          sheetBlocks: top(195, 420) === 'sheet'
        };
      };
      return {
        htmlTA: getComputedStyle(document.documentElement).touchAction,
        bodyTA: getComputedStyle(document.body).touchAction,
        stageTA: stage ? cs('stage').touchAction : 'missing',
        gameTA: cs('game').touchAction,
        confettiTA: cs('confetti').touchAction,
        confettiPE: cs('confetti').pointerEvents,
        stageCallout: stage ? cs('stage').webkitTouchCallout : 'missing',
        hasStage: !!stage
      };
    })()`);
    console.log('styles', JSON.stringify(boot));
    assert(boot && boot.hasStage, 'playfield stage is missing');
    assert(boot.htmlTA === 'manipulation' && boot.bodyTA === 'manipulation', 'page touch-action should be manipulation so a child none is honored: ' + JSON.stringify(boot));
    assert(boot.stageTA === 'none' && boot.gameTA === 'none', 'stage and canvas need touch-action none: ' + JSON.stringify(boot));
    assert(boot.confettiPE === 'none', 'confetti canvas still receives touches');

    const synth = await evalJs(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const stage = document.getElementById('stage');
      const cv = document.getElementById('game');
      const out = { cases: {} };
      function ptr(type, x, y, id, kind, target){
        (target || stage).dispatchEvent(new PointerEvent(type, {
          bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:id,
          pointerType:kind || 'mouse', isPrimary:true, button:0,
          buttons: (type === 'pointerup' || type === 'pointercancel') ? 0 : 1,
          width:4, height:4, pressure: type === 'pointerup' ? 0 : 0.5
        }));
      }
      const spot = window.__spots('garage');
      out.spot = spot;
      if (!spot.plant || !spot.empty) return out;
      const plant = spot.plant, empty = spot.empty;

      await window.__closeGlass();
      ptr('pointerdown', plant.x, plant.y, 1, 'mouse', cv);
      await sleep(500);
      const ringEarly = window.__ring();
      ptr('pointermove', plant.x + 12, plant.y + 8, 1, 'mouse', cv);
      await sleep(2800);
      const held = window.__glass();
      const ringLate = window.__ring();
      ptr('pointerup', plant.x + 12, plant.y + 8, 1, 'mouse', cv);
      out.cases.mousePlant = { open: held.open, text: held.text.slice(0, 160), ringEarly, ringGone: !ringLate.on };

      await window.__closeGlass();
      const emptyNow = window.__spots('garage').empty || empty;
      ptr('pointerdown', emptyNow.x, emptyNow.y, 2, 'mouse');
      await sleep(200);
      ptr('pointerup', emptyNow.x + 3, emptyNow.y + 2, 2, 'mouse');
      await sleep(80);
      const justUp = { ring: window.__ring().on, open: window.__glass().open, text: window.__glass().text.slice(0, 80) };
      await sleep(3000);
      out.cases.earlyLift = { open: window.__glass().open, text: window.__glass().text.slice(0, 80), justUp };
      await window.__closeGlass();

      ptr('pointerdown', empty.x, empty.y, 3, 'mouse');
      ptr('pointermove', empty.x + 40, empty.y, 3, 'mouse');
      await sleep(3200);
      out.cases.bigMove = { open: window.__glass().open };
      ptr('pointerup', empty.x + 40, empty.y, 3, 'mouse');
      await window.__closeGlass();

      ptr('pointerdown', plant.x, plant.y, 4, 'mouse', cv);
      ptr('pointercancel', plant.x, plant.y, 4, 'mouse', cv);
      const menu = cv.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, cancelable:true, clientX:plant.x, clientY:plant.y }));
      await sleep(3200);
      const cancelled = window.__glass();
      out.cases.pointerCancel = { open: cancelled.open, text: cancelled.text.slice(0, 120), menuPrevented: menu === false };
      await window.__closeGlass();

      // iOS: the callout arrives as pointerup, then about 180ms later contextmenu and pointercancel.
      ptr('pointerdown', plant.x, plant.y, 11, 'touch', stage);
      const tStart = new Touch({ identifier:11, target:stage, clientX:plant.x, clientY:plant.y, radiusX:2, radiusY:2, force:0.5 });
      stage.dispatchEvent(new TouchEvent('touchstart', { bubbles:true, cancelable:true, touches:[tStart], targetTouches:[tStart], changedTouches:[tStart] }));
      await sleep(520);
      ptr('pointerup', plant.x, plant.y, 11, 'touch', stage);
      const tEnd = new Touch({ identifier:11, target:stage, clientX:plant.x, clientY:plant.y, radiusX:2, radiusY:2, force:0 });
      stage.dispatchEvent(new TouchEvent('touchend', { bubbles:true, cancelable:true, touches:[], targetTouches:[], changedTouches:[tEnd] }));
      await sleep(50);
      const ringAfterFakeLift = window.__ring();
      await sleep(130);
      stage.dispatchEvent(new PointerEvent('pointercancel', { bubbles:true, cancelable:true, clientX:plant.x, clientY:plant.y, pointerId:11, pointerType:'touch', isPrimary:true, buttons:0 }));
      const menu2 = stage.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, cancelable:true, clientX:plant.x, clientY:plant.y }));
      await sleep(2700);
      const ios = window.__glass();
      out.cases.iosCallout = { open: ios.open, text: ios.text.slice(0, 160), ringHeld: ringAfterFakeLift.on, menuPrevented: menu2 === false };
      await window.__closeGlass();
      out.errs = (window.__errs || []).slice(0, 8);
      return out;
    })()`);
    console.log('synth', JSON.stringify(synth, null, 2));
    assert(synth && synth.spot && synth.spot.plant && synth.spot.empty, 'could not find a plant cell and empty floor on the stage: ' + JSON.stringify(synth && synth.spot));
    assert(synth.cases.mousePlant && synth.cases.mousePlant.open && /Northern Lights/i.test(synth.cases.mousePlant.text), 'mouse hold on a plant did not open the glass: ' + JSON.stringify(synth.cases.mousePlant));
    assert(synth.cases.mousePlant.ringEarly && synth.cases.mousePlant.ringEarly.on && synth.cases.mousePlant.ringEarly.prog > 5, 'growing ring did not show during the mouse hold');
    assert(synth.cases.mousePlant.ringGone, 'ring stayed up after the glass opened');
    assert(synth.cases.earlyLift && synth.cases.earlyLift.open === false, 'lifting before 3 seconds still opened the glass');
    assert(synth.cases.bigMove && synth.cases.bigMove.open === false, 'a 40px move still opened the glass');
    assert(synth.cases.pointerCancel && synth.cases.pointerCancel.open && /Northern Lights/i.test(synth.cases.pointerCancel.text), 'pointercancel aborted the hold: ' + JSON.stringify(synth.cases.pointerCancel));
    assert(synth.cases.pointerCancel.menuPrevented === true, 'context menu was not cancelled');
    assert(synth.cases.iosCallout && synth.cases.iosCallout.ringHeld, 'the iOS fake lift cleared the ring: ' + JSON.stringify(synth.cases.iosCallout));
    assert(synth.cases.iosCallout.open && /Northern Lights/i.test(synth.cases.iosCallout.text) && synth.cases.iosCallout.menuPrevented, 'iOS callout (pointerup then contextmenu) aborted the hold: ' + JSON.stringify(synth.cases.iosCallout));

    async function pressHold(x, y){
      await evalJs('window.__closeGlass()');
      await sleep(60);
      try { await touch('touchCancel', x, y); } catch (e){}
      try { await touch('touchEnd', x, y); } catch (e){}
      await evalJs('window.__hit.length=0');
      await touch('touchStart', x, y);
      const t0 = Date.now();
      await sleep(650);
      const mid = await evalJs('({ ring: window.__ring(), top: (document.elementsFromPoint(' + x + ',' + y + ')[0]||{}).id || (document.elementsFromPoint(' + x + ',' + y + ')[0]||{}).tagName, hits: window.__hit.slice() })');
      let n = 0;
      while (Date.now() - t0 < 3300){
        n++;
        const left = 3300 - (Date.now() - t0);
        if (left <= 40) break;
        await touch('touchMove', x + (n % 2 ? 3 : -2), y + (n % 2 ? -2 : 3));
        await sleep(Math.min(240, Math.max(0, 3300 - (Date.now() - t0))));
      }
      const held = await evalJs('window.__glass()');
      const late = await evalJs('window.__ring()');
      await touch('touchEnd', x, y);
      await sleep(80);
      return { mid: mid.ring, top: mid.top, hits: mid.hits, held, late };
    }

    const rooms = {};
    for (const room of ['garage', 'gh', 'facility']){
      const spot = await evalJs('window.__spots(' + JSON.stringify(room) + ')');
      await evalJs('window.__closeGlass()');
      await sleep(80);
      rooms[room] = { spot };
      if (!spot || !spot.plant || !spot.empty) continue;
      rooms[room].plant = await pressHold(spot.plant.x, spot.plant.y);
      await evalJs('window.__closeGlass()');
      await sleep(200);
      rooms[room].empty = await pressHold(spot.empty.x, spot.empty.y);
      await evalJs('window.__closeGlass()');
      await sleep(200);
    }
    console.log('cdp rooms', JSON.stringify(rooms, null, 2));
    for (const room of ['garage', 'gh', 'facility']){
      const r = rooms[room];
      assert(r && r.spot && r.spot.plant && r.spot.empty && !r.spot.sheetBlocks, room + ' had no stage plant/empty: ' + JSON.stringify(r && r.spot));
      assert(r.spot.plant.top === 'stage' || r.spot.plant.top === 'game', room + ' plant touch would hit ' + r.spot.plant.top);
      assert(r.spot.empty.top === 'stage' || r.spot.empty.top === 'game', room + ' empty touch would hit ' + r.spot.empty.top);
      assert(r.plant.mid && r.plant.mid.on && r.plant.mid.prog > 5 && r.plant.mid.pe === 'none', room + ' ring did not grow under a real touch: ' + JSON.stringify(r.plant.mid));
      assert(r.plant.held && r.plant.held.open && /Northern Lights/i.test(r.plant.held.text) && r.plant.late && !r.plant.late.on, room + ' plant hold did not open the glass: ' + JSON.stringify(r.plant));
      assert(r.empty.mid && r.empty.mid.on, room + ' empty floor showed no ring: ' + JSON.stringify(r.empty && r.empty.mid));
      assert(r.empty.held && r.empty.held.open && /No plant/i.test(r.empty.held.text), room + ' empty hold did not open the glass: ' + JSON.stringify(r.empty && r.empty.held));
    }

    await evalJs('R.fit(); R.frame(0.016); window.__closeGlass()');
    const garage = await evalJs('window.__spots("garage")');
    await evalJs('window.__closeGlass()');
    await touch('touchStart', garage.empty.x, garage.empty.y);
    await sleep(280);
    await touch('touchEnd', garage.empty.x, garage.empty.y);
    await sleep(3100);
    const early = await evalJs('window.__glass()');
    assert(early && early.open === false, 'a 280ms real touch still opened the glass: ' + JSON.stringify(early));

    await evalJs('window.__closeGlass()');
    await touch('touchStart', garage.empty.x, garage.empty.y);
    await sleep(800);
    await touch('touchEnd', garage.empty.x, garage.empty.y);
    await sleep(2800);
    const midLift = await evalJs('window.__glass()');
    assert(midLift && midLift.open === false, 'letting go at 0.8s still opened the glass: ' + JSON.stringify(midLift));

    await evalJs('window.__closeGlass()');
    await touch('touchStart', garage.plant.x, garage.plant.y);
    await sleep(40);
    await touch('touchMove', garage.plant.x + 48, garage.plant.y);
    await sleep(3300);
    const big = await evalJs('window.__glass()');
    await touch('touchEnd', garage.plant.x + 48, garage.plant.y);
    assert(big && big.open === false, 'a 48px real touch move still opened the glass: ' + JSON.stringify(big));

    await evalJs('R.fit(); R.frame(0.016); window.__closeGlass()');
    const again = await evalJs('window.__spots("garage")');
    await sleep(200);
    await touch('touchStart', again.empty.x, again.empty.y);
    await sleep(80);
    await touch('touchCancel', again.empty.x, again.empty.y);
    await sleep(3300);
    const cancelled = await evalJs('window.__glass()');
    assert(cancelled && cancelled.open && /No plant/i.test(cancelled.text), 'touchcancel aborted the real touch hold: ' + JSON.stringify(cancelled));
    await evalJs('window.__closeGlass()');

    if (garage.hud){
      await touch('touchStart', garage.hud.x, garage.hud.y);
      await sleep(500);
      const hudRing = await evalJs('window.__ring()');
      await touch('touchEnd', garage.hud.x, garage.hud.y);
      await sleep(2800);
      const hudGlass = await evalJs('window.__glass()');
      assert(hudRing && hudRing.on === false && hudGlass && hudGlass.open === false, 'a hold on the location button started the glass: ' + JSON.stringify({ hud: garage.hud, hudRing, hudGlass }));
    }

    await evalJs('window.__closeGlass()');
    await sleep(150);
    const card = await evalJs(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const s = window.__spots('garage');
      UI.hidePop();
      return { x:s.plant.x, y:s.plant.y };
    })()`);
    await touch('touchStart', card.x, card.y);
    await sleep(70);
    await touch('touchEnd', card.x, card.y);
    await sleep(200);
    await touch('touchStart', card.x, card.y);
    await sleep(70);
    await touch('touchEnd', card.x, card.y);
    await sleep(250);
    let popped = await evalJs(`(() => {
      const pop = document.getElementById('pop');
      const btn = pop && pop.querySelector('[data-pa="glass"]');
      return { open: !!(pop && !pop.classList.contains('hidden')), has: !!btn, text: pop ? (pop.innerText||'').slice(0,120) : '' };
    })()`);
    if (!popped.open){
      await evalJs(`(() => { const p = G.st.plots.find(q => q.strain); UI.tapPlot(p, ${card.x}, ${card.y}); UI.tapPlot(p, ${card.x}, ${card.y}); return true; })()`);
      await sleep(80);
      popped = await evalJs(`(() => {
        const pop = document.getElementById('pop');
        const btn = pop && pop.querySelector('[data-pa="glass"]');
        return { open: !!(pop && !pop.classList.contains('hidden')), has: !!btn, text: pop ? (pop.innerText||'').slice(0,120) : '', via: 'api' };
      })()`);
    }
    console.log('plant card', JSON.stringify(popped));
    assert(popped && popped.open && popped.has, 'plant card has no Scouting glass button: ' + JSON.stringify(popped));
    await evalJs(`document.querySelector('#pop [data-pa="glass"]').click()`);
    await sleep(200);
    const fromCard = await evalJs('window.__glass()');
    assert(fromCard && fromCard.open && /Northern Lights/i.test(fromCard.text), 'Scouting glass button did not open the glass: ' + JSON.stringify(fromCard));
    await evalJs('window.__closeGlass()');

    const errs = await evalJs('(window.__errs||[]).slice(0, 12)');
    const hits = await evalJs('(window.__hit||[]).slice(-12)');
    console.log('last hits', JSON.stringify(hits));
    const bad = (errs || []).filter(e => !/AudioContext|favicon/i.test(e));
    assert(!bad.length, 'console errors: ' + bad.join(' | '));
    if (!process.exitCode) console.log('hold inspect checks passed');
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
