/* Greenhouse daylight rail: spans the pots, hangs under the roof, and stays off
   the plants, the top bar, and the bottom row. Not a grow-light upgrade.
   Run: node tests/gh-light-check.js */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = process.env.GH_CHROME_PORT || '9364';
const ORIGIN = process.env.GH_ORIGIN || 'http://127.0.0.1:8765';

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

  const profile = '/tmp/chrome-ghlight-' + PORT;
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
      await cdp('Page.navigate', { url: ORIGIN + '/index.html?ghlight=' + w + 'x' + h });
      await sleep(1300);
      await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
      await sleep(400);
      await evalJs(`(() => {
        const skip=document.querySelector('#tutc [data-a="skip"]'); if(skip) skip.click();
        G.st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0};
        const card=document.getElementById('tutc'); if(card) card.classList.add('hidden');
        G.st.level=10; G.st.cash=900000;
        return true;
      })()`);
    }

    function check(tag, m){
      const L = m.light;
      console.log(tag, JSON.stringify({ light: L, hud: m.hud, bar: m.bar, hit: m.hit }));
      assert(L && L.w > 12 && L.h >= 16, tag + ' daylight rail is missing ' + JSON.stringify(L));
      assert(Math.abs(L.x - m.x0) <= 2 && Math.abs((L.x + L.w) - m.x1) <= 2, tag + ' rail does not span the pots ' + JSON.stringify(L) + ' pots ' + m.x0 + '-' + m.x1);
      const mid = (m.x0 + m.x1) / 2, lmid = L.x + L.w / 2;
      assert(Math.abs(mid - lmid) <= 2, tag + ' rail is not centered on the pots');
      assert(L.y >= m.hud - 1, tag + ' rail overlaps the top bar');
      assert(L.y + L.h <= m.bar - 8, tag + ' rail overlaps the bottom row');
      assert(L.y + L.h <= L.potTop - 1, tag + ' rail overlaps the plants ' + JSON.stringify(L));
      assert(m.hit === 'canvas' || m.hit === 'stage' || m.hit === 'game', tag + ' a plant tap is blocked by ' + m.hit);
      assert(!(m.errs && m.errs.length), tag + ' console errors ' + JSON.stringify(m.errs));
      if (m.pots >= 10) assert(L.w > m.cellW * 2, tag + ' rail is shorter than the row');
      if (m.pots >= 20) assert(L.w > m.w * 0.75, tag + ' a full row is not covered');
    }

    const measure = (n) => `(() => {
      G.st.ghBuilt=true; G.st.gh=0; G.st.ghMatch=${n}; G.syncPlots();
      G.st.plots.forEach(p=>{ if(p.zone==='gh'&&p.owned){ p.strain='northern-lights'; p.prog=0.7; p.water=1; p.food=1; }});
      G.setRoom('gh');
      if(window.R&&R.resize) R.resize();
      if(window.R&&R.frame) R.frame(0.05);
      const L=R.bedLayout();
      const owned=G.st.plots.filter(p=>p.zone==='gh'&&p.owned);
      let x0=1e9,x1=-1e9;
      owned.forEach(p=>{ const r=R.plotRect(p); if(!r) return; x0=Math.min(x0,r.left); x1=Math.max(x1,r.right); });
      const hud=document.getElementById('hud').getBoundingClientRect();
      const bar=document.getElementById('toolbar').getBoundingClientRect();
      const sample=owned[0]&&R.plotRect(owned[0]);
      const stack=sample?document.elementsFromPoint((sample.left+sample.right)/2,(sample.top+sample.bottom)/2):[];
      const top=stack&&stack[0];
      return {
        pots: owned.length, light: L.light, x0, x1, cellW: L.cell&&L.cell.w,
        hud: hud.bottom, bar: bar.top, w: innerWidth,
        hit: top ? (top.id || top.tagName.toLowerCase()) : '',
        errs: (window.__errs||[]).slice(0,4)
      };
    })()`;

    await boot(390, 844);
    for (const n of [5, 10, 20]) check('390x844/' + n, await evalJs(measure(n)));
    const garage = await evalJs(`(() => { G.setRoom('garage'); R.frame(0.05); const L=R.bedLayout(); return { room: L.room, light: L.light }; })()`);
    assert(garage.room === 'garage' && garage.light && garage.light.kind === 'led', 'garage should keep its own grow light, not the daylight rail ' + JSON.stringify(garage));

    await boot(320, 568);
    for (const n of [5, 10, 20]) check('320x568/' + n, await evalJs(measure(n)));

    if (!process.exitCode) console.log('greenhouse light checks passed');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
