/* ?test=fresh100m starts a brand-new level-1 farm with $100,000,000 in its own save key.
   A normal index.html keeps mwfarms_save_v1. ?test=lv10 still uses mwfarms_test_v1.
   ?test=fresh100m&reset=1 wipes only the fresh key and starts over.
   Run: node tests/fresh100m-start-check.js
   Uses headless Chrome against the local static server. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = process.env.FRESH_CHROME_PORT || '9337';
const ORIGIN = process.env.FRESH_ORIGIN || 'http://127.0.0.1:8765';
const FRESH_KEY = 'mwfarms_test_fresh_v1';

function fail(msg){ console.error('FAIL', msg); process.exitCode = 1; }
function assert(cond, msg){ if (!cond) fail(msg + ' :: ' + JSON.stringify(cond)); }

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

  const profile = '/tmp/chrome-fresh100m-' + PORT;
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
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 1400));
      return r.result && r.result.value;
    }
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Network.enable');
    await cdp('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source:
`window.__errs=[];
window.addEventListener('error', e => window.__errs.push(String(e.message||e.error||e)));
const _ce=console.error; console.error=function(){ window.__errs.push([].map.call(arguments,String).join(' ')); return _ce.apply(console, arguments); };
localStorage.setItem('mwfarms_age_ok','1');
localStorage.setItem('mwfarms_ad_consent_v1','contextual');
localStorage.removeItem('mwf_test_slot');
localStorage.removeItem('mwf_test_init');
try{ sessionStorage.removeItem('mwf_test'); }catch(e){}
if(!sessionStorage.getItem('freshboot')){
  sessionStorage.setItem('freshboot','1');
  localStorage.removeItem('mwfarms_save_v1');
  localStorage.removeItem('mwfarms_test_v1');
  localStorage.removeItem('${FRESH_KEY}');
}` });

    async function open(path){
      await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
      await cdp('Page.navigate', { url: ORIGIN + path });
      await sleep(1400);
      await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
      await sleep(700);
    }

    await open('/index.html?real=1');
    const seeded = await evalJs(`(() => {
      G.st.level = 4;
      G.st.xp = 0;
      G.claimDaily();
      G.st.cash = 777;
      G.st.tut = {v:1,step:0,on:false,done:true,skip:true,bought:0};
      const ok = G.save();
      return { ok, pid: G.st.pid, key: GAME_CONFIG.saveKey, raw: localStorage.getItem('mwfarms_save_v1'), fresh: localStorage.getItem('${FRESH_KEY}'), lv10: localStorage.getItem('mwfarms_test_v1'), errs: (window.__errs||[]).slice(0,6) };
    })()`);
    assert(seeded && seeded.ok && seeded.key === 'mwfarms_save_v1', 'real save did not write mwfarms_save_v1 ' + JSON.stringify(seeded));
    assert(!seeded.fresh && !seeded.lv10, 'a test key appeared on a normal visit ' + JSON.stringify(seeded));
    const realPid = seeded.pid;

    await open('/index.html?test=fresh100m');
    const started = await evalJs(`(() => new Promise(resolve => {
      const t0 = Date.now();
      (function poll(){
        const text = (document.getElementById('cash') || {}).textContent || '';
        if (text !== '$100M' && Date.now() - t0 < 3000){ requestAnimationFrame(poll); return; }
        const tag = document.getElementById('testTag');
        const tut = document.getElementById('tutc');
        const missing = G.S.filter(s => !s.mystery && !(G.EVENT_ONLY && G.EVENT_ONLY[s.id]) && s.game.unlockLevel <= 1 && !G.st.discovered[s.id]).map(s => s.id);
        const extra = G.S.filter(s => s.game.unlockLevel > 1 && G.st.discovered[s.id] && s.tier !== 0).map(s => s.id);
        const saved = JSON.parse(localStorage.getItem('${FRESH_KEY}') || 'null');
        const realNow = JSON.parse(localStorage.getItem('mwfarms_save_v1') || 'null');
        resolve({
          level: G.st.level, xp: G.st.xp, cash: G.st.cash, gems: G.st.gems, fmt: G.fmt(100000000), text,
          key: GAME_CONFIG.saveKey, pid: G.st.pid, flag: !!window.TEST_FRESH100M, lv10: !!window.TEST_LV10,
          land: !!G.st.land, gh: !!G.st.ghBuilt, indoor: !!G.st.inBuilt, permit: !!G.st.permit, rebirths: G.st.rebirths,
          garage: G.st.garage, seeds: G.st.seeds && G.st.seeds['northern-lights'],
          tut: G.st.tut, missing, extra,
          offer: tut && !tut.classList.contains('hidden') && tut.dataset.mode === 'offer',
          tag: tag ? tag.textContent : '', tagHidden: !tag || tag.classList.contains('hidden'),
          savedLevel: saved && saved.level, savedCash: saved && saved.cash, savedTut: saved && saved.tut,
          lv10key: localStorage.getItem('mwfarms_test_v1'),
          real: realNow && { pid: realNow.pid, level: realNow.level, cash: realNow.cash },
          slot: localStorage.getItem('mwf_test_slot'),
          errs: (window.__errs||[]).slice(0,8)
        });
      })();
    }))()`);
    console.log('FRESH', JSON.stringify({ level: started.level, cash: started.cash, text: started.text, key: started.key, seeds: started.seeds, offer: started.offer, extra: started.extra, missing: started.missing }));
    assert(started.fmt === '$100M' && started.text === '$100M' && started.cash === 100000000 && started.level === 1 && started.xp === 0, 'level 1 / $100M did not boot ' + JSON.stringify(started));
    assert(started.flag && !started.lv10 && started.key === FRESH_KEY && !started.slot, 'fresh save key or flag is wrong ' + JSON.stringify(started));
    assert(started.savedLevel === 1 && started.savedCash === 100000000, 'fresh key was not written ' + JSON.stringify(started));
    assert(!started.lv10key, 'level-10 key was written by the fresh link');
    assert(started.real && started.real.pid === realPid && started.real.level === 4 && started.real.cash === 777, 'real save was overwritten ' + JSON.stringify(started.real));
    assert(!started.land && !started.gh && !started.indoor && !started.permit && started.rebirths === 0 && started.garage === 0, 'buildings or progress were granted ' + JSON.stringify(started));
    assert(started.gems === 20 && started.seeds === 4, 'starting gems or seeds changed ' + JSON.stringify(started));
    assert(started.tut && !started.tut.done && !started.tut.skip && !started.tut.on, 'tutorial was not the new-game offer ' + JSON.stringify(started.tut));
    assert(started.savedTut && !started.savedTut.done && !started.savedTut.skip, 'saved tutorial was skipped ' + JSON.stringify(started.savedTut));
    assert(started.offer, 'welcome offer did not show');
    assert(started.tag === 'TEST SAVE' && !started.tagHidden, 'TEST SAVE tag missing ' + JSON.stringify(started));
    assert(!started.missing.length && !started.extra.length, 'unlocks are not a normal level-1 game ' + JSON.stringify({ missing: started.missing, extra: started.extra }));
    assert(!(started.errs && started.errs.length), 'console errors ' + JSON.stringify(started.errs));
    const freshPid = started.pid;

    await evalJs(`(() => { G.st.cash = 42000000; return G.save(); })()`);
    await open('/index.html?test=fresh100m&again=1');
    const kept = await evalJs(`(() => {
      const real = JSON.parse(localStorage.getItem('mwfarms_save_v1') || 'null');
      const tut = document.getElementById('tutc');
      return { level: G.st.level, cash: G.st.cash, pid: G.st.pid, key: GAME_CONFIG.saveKey, realCash: real && real.cash, realPid: real && real.pid, realLevel: real && real.level, text: document.getElementById('cash').textContent, offer: tut && !tut.classList.contains('hidden'), errs: (window.__errs||[]).slice(0,4) };
    })()`);
    assert(kept.level === 1 && kept.cash === 42000000 && kept.pid === freshPid && kept.key === FRESH_KEY && kept.text === '$42.0M', 'fresh save did not persist ' + JSON.stringify(kept));
    assert(kept.realCash === 777 && kept.realPid === realPid && kept.realLevel === 4 && !kept.offer, 'reload touched the real save or restarted the tutorial ' + JSON.stringify(kept));

    await open('/index.html?test=fresh100m&reset=1');
    const reset = await evalJs(`(() => new Promise(resolve => {
      const t0 = Date.now();
      (function poll(){
        const text = (document.getElementById('cash') || {}).textContent || '';
        if (text !== '$100M' && Date.now() - t0 < 3000){ requestAnimationFrame(poll); return; }
        const real = JSON.parse(localStorage.getItem('mwfarms_save_v1') || 'null');
        const saved = JSON.parse(localStorage.getItem('${FRESH_KEY}') || 'null');
        resolve({ level: G.st.level, cash: G.st.cash, pid: G.st.pid, text, key: GAME_CONFIG.saveKey, savedLevel: saved && saved.level, realCash: real && real.cash, realPid: real && real.pid, lv10: localStorage.getItem('mwfarms_test_v1'), errs: (window.__errs||[]).slice(0,4) });
      })();
    }))()`);
    assert(reset.level === 1 && reset.cash === 100000000 && reset.text === '$100M' && reset.pid !== freshPid && reset.key === FRESH_KEY && reset.savedLevel === 1, 'reset did not start a new level-1 farm ' + JSON.stringify(reset));
    assert(reset.realCash === 777 && reset.realPid === realPid && !reset.lv10, 'reset touched the real save or the level-10 key ' + JSON.stringify(reset));
    assert(!(reset.errs && reset.errs.length), 'reset console errors ' + JSON.stringify(reset.errs));
    const resetPid = reset.pid;

    await open('/index.html?test=lv10');
    const lv10 = await evalJs(`(() => {
      const fresh = JSON.parse(localStorage.getItem('${FRESH_KEY}') || 'null');
      const real = JSON.parse(localStorage.getItem('mwfarms_save_v1') || 'null');
      return { level: G.st.level, cash: G.st.cash, key: GAME_CONFIG.saveKey, flag: !!window.TEST_LV10, freshFlag: !!window.TEST_FRESH100M, freshLevel: fresh && fresh.level, freshCash: fresh && fresh.cash, freshPid: fresh && fresh.pid, realCash: real && real.cash, realPid: real && real.pid, text: document.getElementById('cash').textContent };
    })()`);
    assert(lv10.level === 10 && lv10.cash === 100000000 && lv10.text === '$100M' && lv10.key === 'mwfarms_test_v1' && lv10.flag && !lv10.freshFlag, '?test=lv10 changed ' + JSON.stringify(lv10));
    assert(lv10.freshLevel === 1 && lv10.freshCash === 100000000 && lv10.freshPid === resetPid && lv10.realCash === 777 && lv10.realPid === realPid, 'level-10 visit touched the other saves ' + JSON.stringify(lv10));

    await open('/index.html?after=1');
    const back = await evalJs(`(() => ({ level: G.st.level, cash: G.st.cash, pid: G.st.pid, key: GAME_CONFIG.saveKey, tagHidden: document.getElementById('testTag').classList.contains('hidden'), fresh: !!localStorage.getItem('${FRESH_KEY}') }))()`);
    assert(back.level === 4 && back.cash === 777 && back.pid === realPid && back.key === 'mwfarms_save_v1' && back.tagHidden && back.fresh, 'leaving the test URL did not return to the real save ' + JSON.stringify(back));

    if (!process.exitCode) console.log('fresh100m start checks passed');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
