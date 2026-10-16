/* 3-second scouting glass: mouse and touch, 15px jitter, early lift, big move, pointercancel.
   Run: node tests/hold-inspect-check.js
   Uses headless Chrome against the local static server. */
const { spawn } = require('child_process');
const http = require('http');

const PORT = process.env.HOLD_CHROME_PORT || '9333';
const GAME = process.env.HOLD_GAME_URL || 'http://127.0.0.1:8765/index.html';

function fail(msg){ console.error('FAIL', msg); process.exitCode = 1; }
function assert(cond, msg){ if (!cond) fail(msg); }

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
    catch (e){ await new Promise(r => setTimeout(r, 250)); }
  }
  throw new Error('Chrome did not open port ' + PORT);
}

async function main(){
  let serverUp = false;
  try { const r = await get(GAME); serverUp = r.status === 200; } catch (e){ serverUp = false; }
  if (!serverUp){ fail('static server is not serving ' + GAME); return; }

  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/chrome-hold-' + PORT, 'about:blank'
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
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 1200));
      return r.result && r.result.value;
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
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp('Page.navigate', { url: GAME + '?hold=' + Date.now() });
    await new Promise(r => setTimeout(r, 1500));
    await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); if(window.Tutorial&&Tutorial.skip) Tutorial.skip(); const m=document.getElementById('modal'); if(m) m.classList.add('hidden'); return true; })()`);
    await new Promise(r => setTimeout(r, 400));

    const report = await evalJs(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const cv = document.getElementById('game');
      const out = { errs: [], cases: {} };
      function ptr(type, x, y, id, kind){
        cv.dispatchEvent(new PointerEvent(type, {
          bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:id,
          pointerType:kind||'mouse', isPrimary:true, button:0, buttons: (type==='pointerup'||type==='pointercancel')?0:1
        }));
      }
      function touch(type, x, y){
        const end = type==='touchend' || type==='touchcancel';
        const t = new Touch({ identifier:1, target:cv, clientX:x, clientY:y, radiusX:2, radiusY:2, force: end?0:0.5 });
        const list = end ? [] : [t];
        cv.dispatchEvent(new TouchEvent(type, { bubbles:true, cancelable:true, touches:list, targetTouches:list, changedTouches:[t] }));
      }
      function glass(){
        const m = document.getElementById('modal');
        const card = document.getElementById('modalCard');
        return { open: !!(m && !m.classList.contains('hidden')), text: card ? (card.innerText||card.textContent||'') : '' };
      }
      async function closeGlass(){
        for(let i=0;i<4;i++){
          const m=document.getElementById('modal');
          if(!m || m.classList.contains('hidden')) return;
          const b=m.querySelector('.acts .btn');
          if(b) b.click(); else m.classList.add('hidden');
          await sleep(180);
        }
      }
      function ring(){
        const el=document.getElementById('holdRing');
        if(!el || el.classList.contains('hidden')) return { on:false, prog:0 };
        const arc=el.querySelector('.arc');
        const off=arc ? parseFloat(arc.getAttribute('stroke-dashoffset')) : 113;
        return { on:true, prog: Math.max(0, 113.097-off) };
      }
      const pot = G.st.plots.find(p => p.zone==='garage' && p.owned);
      pot.strain='northern-lights'; pot.prog=0.55; pot.water=1; pot.food=1; pot.pest=null; pot.eggs=0;
      R.frame(0.016); await sleep(50); R.frame(0.016);
      let plant=null, empty=null;
      for(let y=48; y<760 && (!plant||!empty); y+=8){
        for(let x=20; x<370 && (!plant||!empty); x+=8){
          let h=null; try{ h=R.pick(x,y); }catch(e){ h={type:'err'}; }
          if(!plant && h && h.type==='plot' && h.p && h.p.strain) plant={x,y};
          if(!empty && !h) empty={x,y};
        }
      }
      out.plant=plant; out.empty=empty;
      if(!plant || !empty){
        const sample=[];
        for(let y=60; y<800; y+=40){
          const row=[];
          for(let x=10; x<380; x+=40){
            let h=null; try{ h=R.pick(x,y); }catch(e){ h={type:'err'}; }
            row.push(h?h.type||'hit':'·');
          }
          sample.push(y+':'+row.join(''));
        }
        out.cases.setup='missing spot';
        out.sample=sample;
        out.owned=G.st.plots.filter(p=>p.zone==='garage'&&p.owned).length;
        return out;
      }

      await closeGlass();
      ptr('pointerdown', plant.x, plant.y, 1, 'mouse');
      await sleep(500);
      const ringEarly = ring();
      ptr('pointermove', plant.x+12, plant.y+9, 1, 'mouse');
      await sleep(2700);
      const held = glass();
      const ringLate = ring();
      ptr('pointerup', plant.x+12, plant.y+9, 1, 'mouse');
      out.cases.mousePlant = { open: held.open, text: held.text.slice(0,180), ringEarly, ringGone: !ringLate.on };

      await closeGlass();
      ptr('pointerdown', empty.x, empty.y, 2, 'mouse');
      await sleep(1000);
      ptr('pointerup', empty.x+4, empty.y+3, 2, 'mouse');
      await sleep(2300);
      out.cases.earlyLift = { open: glass().open };
      await closeGlass();

      ptr('pointerdown', empty.x, empty.y, 3, 'mouse');
      ptr('pointermove', empty.x+40, empty.y, 3, 'mouse');
      await sleep(3200);
      out.cases.bigMove = { open: glass().open };
      ptr('pointerup', empty.x+40, empty.y, 3, 'mouse');
      await closeGlass();

      ptr('pointerdown', plant.x, plant.y, 4, 'mouse');
      ptr('pointercancel', plant.x, plant.y, 4, 'mouse');
      cv.dispatchEvent(new Event('contextmenu', { bubbles:true, cancelable:true }));
      const menu = cv.dispatchEvent(new Event('contextmenu', { bubbles:true, cancelable:true }));
      await sleep(3200);
      const cancelled = glass();
      out.cases.pointerCancel = { open: cancelled.open, text: cancelled.text.slice(0,120), menuPrevented: menu===false };
      await closeGlass();

      touch('touchstart', empty.x, empty.y);
      await sleep(400);
      const ringTouch = ring();
      touch('touchmove', empty.x+10, empty.y+11);
      await sleep(2800);
      const touched = glass();
      touch('touchend', empty.x+10, empty.y+11);
      out.cases.touchEmpty = { open: touched.open, text: touched.text.slice(0,160), ring: ringTouch.on };
      await closeGlass();

      touch('touchstart', empty.x, empty.y);
      touch('touchmove', empty.x+8, empty.y+6);
      touch('touchcancel', empty.x+8, empty.y+6);
      await sleep(3200);
      const touchKept = glass();
      out.cases.touchCancel = { open: touchKept.open, text: touchKept.text.slice(0,160) };
      await closeGlass();

      touch('touchstart', plant.x, plant.y);
      touch('touchmove', plant.x+48, plant.y);
      await sleep(3200);
      out.cases.touchBig = { open: glass().open };
      touch('touchend', plant.x+48, plant.y);
      await closeGlass();

      out.errs = (window.__errs||[]).slice(0, 8);
      return out;
    })()`);

    console.log(JSON.stringify(report, null, 2));
    assert(report && report.plant && report.empty, 'could not find a plant cell and empty room space');
    assert(report.cases.mousePlant && report.cases.mousePlant.open && /Northern Lights/i.test(report.cases.mousePlant.text), 'mouse hold on a plant did not open the glass: ' + JSON.stringify(report.cases.mousePlant));
    assert(report.cases.mousePlant.ringEarly && report.cases.mousePlant.ringEarly.on && report.cases.mousePlant.ringEarly.prog > 5, 'growing ring did not show during the mouse hold');
    assert(report.cases.mousePlant.ringGone, 'ring stayed up after the glass opened');
    assert(report.cases.earlyLift && report.cases.earlyLift.open === false, 'lifting at 1s still opened the glass');
    assert(report.cases.bigMove && report.cases.bigMove.open === false, 'a 40px move still opened the glass');
    assert(report.cases.pointerCancel && report.cases.pointerCancel.open && /Northern Lights/i.test(report.cases.pointerCancel.text), 'pointercancel aborted the hold: ' + JSON.stringify(report.cases.pointerCancel));
    assert(report.cases.touchEmpty && report.cases.touchEmpty.open && /No plant/i.test(report.cases.touchEmpty.text) && report.cases.touchEmpty.ring, 'touch hold on empty room did not open the glass: ' + JSON.stringify(report.cases.touchEmpty));
    assert(report.cases.touchCancel && report.cases.touchCancel.open && /No plant/i.test(report.cases.touchCancel.text), 'touchcancel aborted the hold: ' + JSON.stringify(report.cases.touchCancel));
    assert(report.cases.touchBig && report.cases.touchBig.open === false, 'a 48px touch move still opened the glass');
    assert(report.cases.pointerCancel.menuPrevented === true, 'context menu was not cancelled');
    const bad = (report.errs || []).filter(e => !/AudioContext|favicon/i.test(e));
    assert(!bad.length, 'console errors: ' + bad.join(' | '));
    if (!process.exitCode) console.log('hold inspect checks passed');
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
