/* ?test=lv10 starts a level-10 farm with $100,000,000 in its own save key.
   A normal index.html keeps mwfarms_save_v1. ?test=lv10&reset=1 starts over.
   Run: node tests/lv10-start-check.js
   Uses headless Chrome against the local static server. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = process.env.LV10_CHROME_PORT || '9336';
const ORIGIN = process.env.LV10_ORIGIN || 'http://127.0.0.1:8765';

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

  const profile = '/tmp/chrome-lv10-' + PORT;
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
if(!sessionStorage.getItem('lv10boot')){
  sessionStorage.setItem('lv10boot','1');
  localStorage.removeItem('mwfarms_save_v1');
  localStorage.removeItem('mwfarms_test_v1');
}` });

    async function open(path, w, h){
      await cdp('Emulation.setDeviceMetricsOverride', { width: w || 390, height: h || 844, deviceScaleFactor: 2, mobile: true });
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
      return { ok, pid: G.st.pid, key: GAME_CONFIG.saveKey, raw: localStorage.getItem('mwfarms_save_v1'), test: localStorage.getItem('mwfarms_test_v1'), errs: (window.__errs||[]).slice(0,6) };
    })()`);
    assert(seeded && seeded.ok && seeded.key === 'mwfarms_save_v1', 'real save did not write mwfarms_save_v1 ' + JSON.stringify(seeded));
    assert(!seeded.test, 'test key appeared on a normal visit');
    const realRaw = seeded.raw;
    const realPid = seeded.pid;

    await open('/index.html?real=2', 320, 568);
    const real = await evalJs(`(() => {
      const tag = document.getElementById('testTag');
      const modal = document.getElementById('modal');
      const tut = document.getElementById('tutc');
      return {
        level: G.st.level, cash: G.st.cash, pid: G.st.pid, key: GAME_CONFIG.saveKey,
        tagHidden: !tag || tag.classList.contains('hidden'),
        modalHidden: !modal || modal.classList.contains('hidden'),
        tutHidden: !tut || tut.classList.contains('hidden'),
        test: localStorage.getItem('mwfarms_test_v1'),
        errs: (window.__errs||[]).slice(0,6)
      };
    })()`);
    assert(real.level === 4 && real.cash === 777 && real.pid === realPid, 'normal link did not keep the real save ' + JSON.stringify(real));
    assert(real.key === 'mwfarms_save_v1' && real.tagHidden && !real.test, 'normal link used the test save ' + JSON.stringify(real));
    assert(real.modalHidden && real.tutHidden && !(real.errs && real.errs.length), 'normal link showed an intro or error ' + JSON.stringify(real));

    await open('/index.html?test=lv10', 320, 568);
    const started = await evalJs(`(() => new Promise(resolve => {
      const t0 = Date.now();
      (function poll(){
        const text = (document.getElementById('cash') || {}).textContent || '';
        if (text !== '$100M' && Date.now() - t0 < 3000){ requestAnimationFrame(poll); return; }
        const cash = document.getElementById('cashPill').getBoundingClientRect();
        const gems = document.getElementById('gemPill').getBoundingClientRect();
        const shop = document.getElementById('shopBtn').getBoundingClientRect();
        const gear = document.getElementById('settingsBtn').getBoundingClientRect();
        const hud = document.getElementById('hud').getBoundingClientRect();
        const tag = document.getElementById('testTag');
        const modal = document.getElementById('modal');
        const tut = document.getElementById('tutc');
        const missing = G.S.filter(s => !s.mystery && !(G.EVENT_ONLY && G.EVENT_ONLY[s.id]) && s.game.unlockLevel <= 10 && !G.st.discovered[s.id]).map(s => s.id);
        const extra = G.S.filter(s => s.game.unlockLevel > 10 && G.st.discovered[s.id] && s.tier !== 0).map(s => s.id);
        const step = G.nextStep('garage');
        const saved = JSON.parse(localStorage.getItem('mwfarms_test_v1') || 'null');
        const realNow = localStorage.getItem('mwfarms_save_v1');
        resolve({
          level: G.st.level, cash: G.st.cash, fmt: G.fmt(100000000), text,
          key: GAME_CONFIG.saveKey, pid: G.st.pid,
          land: !!G.st.land, gh: !!G.st.ghBuilt, indoor: !!G.st.inBuilt, permit: !!G.st.permit,
          cap: G.capOf('garage'), step: step && step.cost, garage: G.st.garage,
          ghLevel: G.GH_BUILD.level, facilityLevel: G.LAND_LEVEL,
          ghCost: G.GH_BUILD.cost, facilityCost: G.LAND_COST,
          ghReady: G.st.level >= G.GH_BUILD.level && G.st.cash >= G.GH_BUILD.cost && !G.st.ghBuilt,
          facilityReady: G.st.level >= G.LAND_LEVEL && G.st.cash >= G.LAND_COST && !G.st.land,
          rows: (document.getElementById('locBtn').click(), [...document.querySelectorAll('#locPick button')].map(b => (b.innerText||'').replace(/\\s+/g,' ').trim())),
          tut: G.st.tut, missing, extra,
          tag: tag ? tag.textContent : '', tagHidden: !tag || tag.classList.contains('hidden'),
          modalHidden: !modal || modal.classList.contains('hidden'),
          tutHidden: !tut || tut.classList.contains('hidden'),
          savedLevel: saved && saved.level, savedCash: saved && saved.cash,
          realNow: realNow && JSON.parse(realNow),
          box: {
            cashR: +cash.right.toFixed(1), gemsL: +gems.left.toFixed(1),
            shopR: +shop.right.toFixed(1), gearR: +gear.right.toFixed(1),
            hudR: +hud.right.toFixed(1), w: innerWidth
          },
          errs: (window.__errs||[]).slice(0,8)
        });
      })();
    }))()`);
    console.log('LV10', JSON.stringify({ level:started.level, cash:started.cash, text:started.text, key:started.key, cap:started.cap, box:started.box, tag:started.tag }));
    assert(started.fmt === '$100M' && started.text === '$100M' && started.cash === 100000000 && started.level === 10, 'level 10 / $100M did not boot ' + JSON.stringify(started));
    assert(started.key === 'mwfarms_test_v1' && started.savedLevel === 10 && started.savedCash === 100000000, 'test save key mismatch ' + JSON.stringify(started));
    assert(started.realNow && started.realNow.pid === realPid && started.realNow.level === 4 && started.realNow.cash === 777, 'real save was overwritten ' + JSON.stringify(started.realNow && {pid:started.realNow.pid, level:started.realNow.level, cash:started.realNow.cash}));
    assert(!started.land && !started.gh && !started.indoor && !started.permit, 'buildings were granted ' + JSON.stringify(started));
    assert(started.cap === 5 && started.garage === 0 && typeof started.step === 'number', 'garage is not the starting upgradable row ' + JSON.stringify(started));
    assert(started.ghLevel === 5 && started.facilityLevel === 10 && started.ghCost === 12000 && started.facilityCost === 12000 && started.ghReady && started.facilityReady, 'level gates are wrong ' + JSON.stringify({ghLevel:started.ghLevel, facilityLevel:started.facilityLevel, ghReady:started.ghReady, facilityReady:started.facilityReady, ghCost:started.ghCost, facilityCost:started.facilityCost}));
    assert(started.rows && started.rows.some(t => t.indexOf('Greenhouse') >= 0 && t.indexOf('Level 5') >= 0 && t.indexOf('$12.0K') >= 0) && started.rows.some(t => t.indexOf('Indoor Facility') >= 0 && t.indexOf('Level 10') >= 0 && t.indexOf('$12.0K') >= 0), 'picker rows are wrong ' + JSON.stringify(started.rows));
    const bought = await evalJs(`(() => {
      const cash0 = G.st.cash, quest = G.st.quest, done = G.st.questDone;
      const gh = G.buildGH();
      const ghWithoutLand = !!G.st.ghBuilt && !G.st.land;
      G.st.ghBuilt = false; G.st.gh = 0; delete G.st.ghMatch; G.st.cash = cash0;
      const land = G.buyLand();
      const facility = !!G.st.land && !G.st.inBuilt;
      G.st.land = false; G.st.phenoRoom = false; G.st.cash = cash0; G.st.quest = quest; G.st.questDone = done;
      G.syncPlots(); G.save();
      return {gh, ghWithoutLand, land, facility, cash: G.st.cash, ghBuilt: !!G.st.ghBuilt, landNow: !!G.st.land};
    })()`);
    assert(bought.gh && bought.ghWithoutLand && bought.land && bought.facility && bought.cash === 100000000 && !bought.ghBuilt && !bought.landNow, 'level 10 could not buy both rooms ' + JSON.stringify(bought));
    assert(started.tut && started.tut.done && started.tut.skip && !started.tut.on, 'tutorial was not skipped ' + JSON.stringify(started.tut));
    assert(started.tag === 'TEST SAVE' && !started.tagHidden && started.modalHidden && started.tutHidden, 'tag or intro is wrong ' + JSON.stringify(started));
    assert(!started.missing.length && !started.extra.length, 'shop unlocks are wrong ' + JSON.stringify({missing:started.missing, extra:started.extra}));
    const b = started.box;
    assert(b.cashR <= b.gemsL + 1 && b.gearR <= b.w + 1 && b.hudR <= b.w + 1, 'top bar overflow ' + JSON.stringify(b));
    assert(!(started.errs && started.errs.length), 'console errors ' + JSON.stringify(started.errs));
    const testPid = started.pid;

    await evalJs(`(() => { G.st.cash = 42000000; return G.save(); })()`);
    await open('/index.html?test=lv10&again=1', 320, 568);
    const kept = await evalJs(`(() => { const real = JSON.parse(localStorage.getItem('mwfarms_save_v1') || 'null'); return { level: G.st.level, cash: G.st.cash, pid: G.st.pid, key: GAME_CONFIG.saveKey, realCash: real && real.cash, realPid: real && real.pid, realLevel: real && real.level, text: document.getElementById('cash').textContent, errs: (window.__errs||[]).slice(0,4) }; })()`);
    assert(kept.level === 10 && kept.cash === 42000000 && kept.pid === testPid && kept.key === 'mwfarms_test_v1' && kept.realCash === 777 && kept.realPid === realPid && kept.realLevel === 4, 'test save did not persist ' + JSON.stringify(kept));

    await open('/index.html?test=lv10&reset=1', 390, 844);
    const reset = await evalJs(`(() => new Promise(resolve => {
      const t0 = Date.now();
      (function poll(){
        const text = (document.getElementById('cash') || {}).textContent || '';
        if (text !== '$100M' && Date.now() - t0 < 3000){ requestAnimationFrame(poll); return; }
        const real = JSON.parse(localStorage.getItem('mwfarms_save_v1') || 'null');
        resolve({ level: G.st.level, cash: G.st.cash, pid: G.st.pid, text, key: GAME_CONFIG.saveKey, realCash: real && real.cash, realPid: real && real.pid, errs: (window.__errs||[]).slice(0,4) });
      })();
    }))()`);
    assert(reset.level === 10 && reset.cash === 100000000 && reset.text === '$100M' && reset.pid !== testPid && reset.key === 'mwfarms_test_v1' && reset.realCash === 777 && reset.realPid === realPid, 'reset did not start a fresh test farm ' + JSON.stringify(reset));
    assert(!(reset.errs && reset.errs.length), 'reset console errors ' + JSON.stringify(reset.errs));

    await open('/index.html?after=1');
    const back = await evalJs(`(() => ({ level: G.st.level, cash: G.st.cash, pid: G.st.pid, key: GAME_CONFIG.saveKey, tagHidden: document.getElementById('testTag').classList.contains('hidden') }))()`);
    assert(back.level === 4 && back.cash === 777 && back.pid === realPid && back.key === 'mwfarms_save_v1' && back.tagHidden, 'leaving the test URL did not return to the real save ' + JSON.stringify(back));

    if (!process.exitCode) console.log('lv10 start checks passed');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
