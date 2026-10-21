/* 40 ripe strains should stay smooth once the downscaled bitmaps are warm.
   Run: node tests/strain-perf-check.js */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = process.env.PERF_CHROME_PORT || '9524';
const ORIGIN = process.env.PLANT_ORIGIN || 'http://127.0.0.1:8765';

function fail(msg){ console.error('FAIL', msg); process.exitCode = 1; }
function get(url, method){
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: method || 'GET' }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject); req.end();
  });
}

async function main(){
  const profile = '/tmp/chrome-sprite-perf-' + PORT;
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++){
      try { await get('http://127.0.0.1:' + PORT + '/json/version'); break; }
      catch (e){ await new Promise(r => setTimeout(r, 250)); }
    }
    const created = await get('http://127.0.0.1:' + PORT + '/json/new?about:blank', 'PUT');
    const list = JSON.parse(created.body);
    const ws = new WebSocket(list.webSocketDebuggerUrl);
    let seq = 0; const wait = new Map();
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && wait.has(m.id)){
        const { resolve, reject } = wait.get(m.id); wait.delete(m.id);
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
    await cdp('Page.enable'); await cdp('Runtime.enable');
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source:
      `localStorage.setItem('mwfarms_age_ok','1');localStorage.setItem('mwfarms_ad_consent_v1','contextual');localStorage.removeItem('mwfarms_save_v1');localStorage.removeItem('mwfarms_test_v1');` });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp('Page.navigate', { url: ORIGIN + '/index.html?perf=1' });
    await new Promise(r => setTimeout(r, 1500));
    await evalJs(`(() => { document.getElementById('playBtn').click(); return true; })()`);
    await new Promise(r => setTimeout(r, 400));
    await evalJs(`(() => {
      const skip=document.querySelector('#tutc [data-a="skip"]'); if(skip) skip.click();
      G.st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0};
      const card=document.getElementById('tutc'); if(card) card.classList.add('hidden');
      G.st.level=10; G.st.cash=9000000; G.st.land=true; G.st.field=3; G.syncPlots();
      return true;
    })()`);
    let warm = null;
    for (let i = 0; i < 80; i++){
      warm = await evalJs(`(() => { try { return R.spriteWarm(); } catch(e){ return {err:String(e)}; } })()`);
      if (warm && warm.ready >= 40 && warm.stages) break;
      await new Promise(r => setTimeout(r, 150));
    }
    await cdp('Emulation.setCPUThrottlingRate', { rate: 4 });
    const m = await evalJs(`(() => {
      const ids=(window.STRAINS||[]).map(s=>s.id).slice(0,40);
      const owned=G.st.plots.filter(p=>p.zone==='field'&&p.owned).slice(0,40);
      owned.forEach((p,i)=>{ p.strain=ids[i]; p.prog=1; p.water=1; p.food=1; p.pest=null; });
      G.setRoom('facility'); if(R.resize) R.resize();
      const times=[];
      for(let i=0;i<24;i++){ const t0=performance.now(); R.frame(1/30); times.push(performance.now()-t0); }
      const n=R.bedSprites().length;
      const strains=new Set(owned.map(p=>p.strain)).size;
      const first=times[0], max=Math.max.apply(null, times);
      const sorted=times.slice().sort((a,b)=>a-b);
      const sum=times.reduce((a,b)=>a+b,0);
      return {n, strains, first:+first.toFixed(1), max:+max.toFixed(1), med:+sorted[Math.floor(sorted.length/2)].toFixed(1), avg:+(sum/times.length).toFixed(1), errs:(window.__errs||[]).slice(0,4)};
    })()`);
    console.log('perf', JSON.stringify(Object.assign({ warm }, m)));
    if (m.errs && m.errs.length) fail('console errors ' + JSON.stringify(m.errs));
    if (m.n < 40 || m.strains < 40) fail('expected 40 plants, got ' + m.n + ' strains ' + m.strains);
    if (!(warm && warm.ready >= 40)) fail('sprites were not warm ' + JSON.stringify(warm));
    if (m.max > 250) fail('a frame took ' + m.max + 'ms');
    const fps = 1000 / Math.max(1, m.med);
    if (fps < 30) fail('median frame ' + m.med + 'ms is under 30fps at 4x throttle');
    if (!process.exitCode) console.log('strain perf ok, median', m.med + 'ms');
    ws.close();
  } finally { chrome.kill(); }
}

main().catch(e => { console.error(e); process.exit(1); });
