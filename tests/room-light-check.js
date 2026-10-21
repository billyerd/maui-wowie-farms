/* Garage and indoor grow lights: one bar, hung level, spanning the pots.
   Run: node tests/room-light-check.js */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.LIGHT_CHROME_PORT || '9388';
const ORIGIN = process.env.LIGHT_ORIGIN || 'http://127.0.0.1:8765';
const SHOTS = process.env.LIGHT_SHOTS || '/tmp/light-shots';

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
  try { const r = await get(ORIGIN + '/index.html'); serverUp = r.status === 200; } catch (e){ serverUp = false; }
  if (!serverUp){ fail('static server is not serving ' + ORIGIN); return; }
  fs.mkdirSync(SHOTS, { recursive: true });

  const profile = '/tmp/chrome-roomlight-' + PORT;
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
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
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source:
`window.__errs=[];
window.addEventListener('error', e => window.__errs.push(String(e.message||e.error||e)));
localStorage.setItem('mwfarms_age_ok','1');
localStorage.setItem('mwfarms_ad_consent_v1','contextual');
localStorage.removeItem('mwfarms_save_v1');
localStorage.removeItem('mwfarms_test_v1');` });

    async function boot(w, h){
      await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await cdp('Page.navigate', { url: ORIGIN + '/index.html?roomlight=' + w + 'x' + h });
      await sleep(1300);
      await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
      await sleep(400);
      await evalJs(`(() => {
        const skip=document.querySelector('#tutc [data-a="skip"]'); if(skip) skip.click();
        G.st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0};
        const card=document.getElementById('tutc'); if(card) card.classList.add('hidden');
        const goal=document.getElementById('goal'); if(goal) goal.classList.remove('open');
        G.st.level=10; G.st.cash=900000;
        return true;
      })()`);
    }

    async function shot(name){
      const pic = await cdp('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const file = path.join(SHOTS, name + '.png');
      fs.writeFileSync(file, Buffer.from(pic.data, 'base64'));
      console.log('shot', file);
    }

    function check(tag, m){
      const L = m.light;
      console.log(tag, JSON.stringify({ light: L, hud: m.hud, bar: m.bar, pots: m.pots, hit: m.hit }));
      assert(L && L.kind === 'led', tag + ' grow light is missing ' + JSON.stringify(L));
      assert(L.w > 12 && L.h >= 16, tag + ' grow light is too small ' + JSON.stringify(L));
      assert(Math.abs(L.x - m.x0) <= 2 && Math.abs((L.x + L.w) - m.x1) <= 2, tag + ' light does not span the pots ' + JSON.stringify(L) + ' pots ' + m.x0 + '-' + m.x1);
      const mid = (m.x0 + m.x1) / 2, lmid = L.x + L.w / 2;
      assert(Math.abs(mid - lmid) <= 2, tag + ' light is not centered on the pots');
      assert(L.y >= m.hud - 1, tag + ' light overlaps the top bar');
      assert(L.y + L.h <= m.bar - 8, tag + ' light overlaps the bottom row');
      assert(L.y + L.h <= L.potTop - 1, tag + ' light overlaps the plants ' + JSON.stringify(L));
      assert(m.hit === 'canvas' || m.hit === 'stage' || m.hit === 'game', tag + ' a plant tap is blocked by ' + m.hit);
      assert(!(m.errs && m.errs.length), tag + ' console errors ' + JSON.stringify(m.errs));
      if (m.pots >= 10) assert(L.w > m.cellW * 2, tag + ' light is shorter than the row');
      if (m.pots >= 20 && m.room === 'garage') assert(L.w > m.w * 0.75, tag + ' a full garage row is not covered');
    }

    const garage = (n) => `(() => {
      G.st.garage=${n >= 20 ? 5 : 0}; G.st.garageKeep=0; G.syncPlots();
      const ids=['maui-wowie','granddaddy-purple','northern-lights','blue-dream'];
      G.st.plots.forEach((p,i)=>{ if(p.zone==='garage'&&p.owned){ p.strain=ids[i%ids.length]; p.prog=0.85; p.water=1; p.food=1; p.pest=null; }});
      G.setRoom('garage');
      const goal=document.getElementById('goal'); if(goal) goal.classList.remove('open');
      if(window.R&&R.resize) R.resize();
      R.frame(0.05);
      const L=R.bedLayout();
      const owned=G.st.plots.filter(p=>p.zone==='garage'&&p.owned);
      let x0=1e9,x1=-1e9;
      owned.forEach(p=>{ const r=R.plotRect(p); if(!r) return; x0=Math.min(x0,r.left); x1=Math.max(x1,r.right); });
      const hud=document.getElementById('hud').getBoundingClientRect();
      const bar=document.getElementById('toolbar').getBoundingClientRect();
      const sample=owned[0]&&R.plotRect(owned[0]);
      const stack=sample?document.elementsFromPoint((sample.left+sample.right)/2,(sample.top+sample.bottom)/2):[];
      const top=stack&&stack[0];
      return { room:L.room, pots:owned.length, light:L.light, x0, x1, cellW:L.cell&&L.cell.w, hud:hud.bottom, bar:bar.top, w:innerWidth, hit:top?(top.id||top.tagName.toLowerCase()):'', errs:(window.__errs||[]).slice(0,4) };
    })()`;

    const indoor = `(() => {
      G.st.land=true; G.st.field=1; G.syncPlots();
      const ids=['maui-wowie','granddaddy-purple','northern-lights','glitter-bomb'];
      G.st.plots.forEach((p,i)=>{ if(p.zone==='field'&&p.owned){ p.strain=ids[i%ids.length]; p.prog=0.9; p.water=1; p.food=1; p.pest=null; }});
      G.setRoom('facility');
      const goal=document.getElementById('goal'); if(goal) goal.classList.remove('open');
      if(window.R&&R.resize) R.resize();
      R.frame(0.05);
      const L=R.bedLayout();
      const owned=G.st.plots.filter(p=>p.zone==='field'&&p.owned);
      let x0=1e9,x1=-1e9;
      owned.forEach(p=>{ const r=R.plotRect(p); if(!r) return; x0=Math.min(x0,r.left); x1=Math.max(x1,r.right); });
      const hud=document.getElementById('hud').getBoundingClientRect();
      const bar=document.getElementById('toolbar').getBoundingClientRect();
      const sample=owned[0]&&R.plotRect(owned[0]);
      const stack=sample?document.elementsFromPoint((sample.left+sample.right)/2,(sample.top+sample.bottom)/2):[];
      const top=stack&&stack[0];
      return { room:L.room, pots:owned.length, light:L.light, x0, x1, cellW:L.cell&&L.cell.w, hud:hud.bottom, bar:bar.top, w:innerWidth, hit:top?(top.id||top.tagName.toLowerCase()):'', errs:(window.__errs||[]).slice(0,4) };
    })()`;

    await boot(390, 844);
    check('390 garage 5', await evalJs(garage(5)));
    await shot('garage_5_390x844');
    check('390 garage 20', await evalJs(garage(20)));
    await shot('garage_20_390x844');
    check('390 indoor', await evalJs(indoor));
    await shot('indoor_390x844');
    const locked = await evalJs(`(() => { G.st.land=false; G.syncPlots(); G.setRoom('facility'); R.frame(0.05); const L=R.bedLayout(); return { light:L.light, build:!!L.build }; })()`);
    assert(locked.build && !locked.light, 'an unbuilt indoor room still hangs a light ' + JSON.stringify(locked));

    await boot(320, 568);
    check('320 garage 5', await evalJs(garage(5)));
    await shot('garage_5_320x568');
    check('320 garage 20', await evalJs(garage(20)));
    await shot('garage_20_320x568');
    check('320 indoor', await evalJs(indoor));
    await shot('indoor_320x568');

    if (!process.exitCode) console.log('room light checks passed');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
