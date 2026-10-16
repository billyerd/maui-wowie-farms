/* Room music: garage and greenhouse share one bed (no restart).
   The Indoor Facility and the sealed benches share a faster bed.
   Mute, volume, and the current room survive a reload, including ?test=lv10.
   Run: node tests/room-music-check.js */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = process.env.MUSIC_CHROME_PORT || '9396';
const ORIGIN = process.env.MUSIC_ORIGIN || 'http://127.0.0.1:8765';

function fail(msg){ console.error('FAIL', msg); process.exitCode = 1; }
function assert(cond, msg){ if (!cond) fail(msg + (cond && cond.message ? '' : '')); }

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

  const profile = '/tmp/chrome-music-' + PORT;
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
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
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 1800));
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
localStorage.setItem('mwfarms_age_ok','1');
localStorage.setItem('mwfarms_ad_consent_v1','contextual');` });

    async function open(path){
      await cdp('Page.navigate', { url: ORIGIN + path });
      await sleep(1400);
      const ready = await evalJs(`(() => !!(window.G && window.Sound && G.st))()`);
      assert(ready, 'page did not boot ' + path);
    }
    function cleanErrs(errs){
      return (errs || []).filter(e => !/AudioContext|favicon|ResizeObserver/i.test(e));
    }

    await open('/index.html?music=1');
    const map = await evalJs(`(() => {
      const T = Sound.trackFor;
      return {
        garage: T('garage'), gh: T('gh'), facility: T('facility'), benches: T('benches'),
        garageNight: T('garage', true), ghNight: T('gh', true), facilityNight: T('facility', true),
        indoorAlias: T('indoor'), farmLegacy: T('farm'),
        room: G.currentRoom(), style: Sound.style, bpm: Sound.bpm
      };
    })()`);
    assert(map && map.garage === 'garage' && map.gh === 'garage', 'garage and greenhouse do not share a bed ' + JSON.stringify(map));
    assert(map.facility === 'indoor' && map.benches === 'indoor' && map.indoorAlias === 'indoor', 'indoor rooms are not on the indoor bed ' + JSON.stringify(map));
    assert(map.garageNight === 'night' && map.ghNight === 'night' && map.facilityNight === 'indoor', 'night split the shared bed or replaced the indoor bed ' + JSON.stringify(map));
    assert(map.farmLegacy === 'garage', 'legacy farm loc did not fall through to the yard bed ' + JSON.stringify(map));
    assert(map.room === 'garage' && map.style === 'garage' && map.bpm === 84, 'a fresh farm did not start on the yard bed ' + JSON.stringify(map));

    const started = await evalJs(`(() => { Sound.resume(); return { state: Sound.state, style: Sound.style, bed: Sound.bed, music: Sound.music }; })()`);
    await sleep(700);
    const yard = await evalJs(`(() => {
      const before = { style: Sound.style, bed: Sound.bed, bar: Sound.bar, room: Sound.room, bpm: Sound.bpm, state: Sound.state };
      G.st.ghBuilt = true;
      G.setRoom('gh');
      const after = { style: Sound.style, bed: Sound.bed, bar: Sound.bar, room: Sound.room, bpm: Sound.bpm };
      return { before, after, tone: (window.__toneBad||[]).length, errs: window.__errs||[] };
    })()`);
    assert(started && started.music, 'music was not on for a fresh farm ' + JSON.stringify(started));
    assert(yard.before.state === 'running', 'audio context did not start ' + JSON.stringify(yard.before));
    assert(yard.before.bar > 0, 'the yard bed did not schedule a bar ' + JSON.stringify(yard.before));
    assert(yard.after.room === 'gh' && yard.after.style === 'garage' && yard.after.bpm === 84, 'greenhouse changed the soundtrack ' + JSON.stringify(yard.after));
    assert(yard.after.bed === yard.before.bed && yard.after.bar >= yard.before.bar, 'greenhouse restarted the shared bed ' + JSON.stringify(yard));
    assert(!cleanErrs(yard.errs).length && yard.tone === 0, 'yard music threw ' + JSON.stringify(yard));

    await sleep(400);
    const indoor = await evalJs(`(() => {
      const before = { style: Sound.style, bed: Sound.bed, bar: Sound.bar };
      G.st.land = true;
      G.setRoom('facility');
      const mid = { style: Sound.style, bed: Sound.bed, bar: Sound.bar, room: Sound.room, bpm: Sound.bpm };
      G.st.inBuilt = true;
      G.setRoom('benches');
      const bench = { style: Sound.style, bed: Sound.bed, bar: Sound.bar, room: Sound.room, bpm: Sound.bpm };
      return { before, mid, bench };
    })()`);
    assert(indoor.mid.room === 'facility' && indoor.mid.style === 'indoor' && indoor.mid.bpm === 126, 'Indoor Facility did not switch to its own bed ' + JSON.stringify(indoor.mid));
    assert(indoor.mid.bed === indoor.before.bed + 1, 'entering the facility did not cross to a new bed ' + JSON.stringify(indoor));
    assert(indoor.bench.room === 'benches' && indoor.bench.style === 'indoor' && indoor.bench.bed === indoor.mid.bed && indoor.bench.bar >= indoor.mid.bar, 'sealed benches restarted the indoor bed ' + JSON.stringify(indoor.bench));

    const played = await evalJs(`(() => new Promise(resolve => {
      const start = Sound.bar, t0 = Date.now();
      const id = setInterval(() => {
        if (Sound.bar > start || Date.now() - t0 > 4500){
          clearInterval(id);
          resolve({ bar: Sound.bar, start, style: Sound.style, bpm: Sound.bpm, tone: (window.__toneBad||[]).length, errs: window.__errs||[] });
        }
      }, 100);
    }))()`);
    assert(played.bar > played.start && played.style === 'indoor' && played.bpm === 126 && played.tone === 0, 'indoor bed did not keep playing ' + JSON.stringify(played));
    assert(!cleanErrs(played.errs).length, 'indoor music threw ' + JSON.stringify(played.errs));

    const back = await evalJs(`(() => {
      const bed = Sound.bed, bar = Sound.bar;
      G.setRoom('garage');
      const garage = { style: Sound.style, bed: Sound.bed, bar: Sound.bar, bpm: Sound.bpm, room: Sound.room };
      G.setRoom('gh');
      const gh = { style: Sound.style, bed: Sound.bed, bar: Sound.bar, bpm: Sound.bpm, room: Sound.room };
      return { bed, bar, garage, gh };
    })()`);
    assert(back.garage.style === 'garage' && back.garage.bpm === 84 && back.garage.bed === back.bed + 1, 'leaving the facility did not return to the yard bed ' + JSON.stringify(back));
    assert(back.gh.style === 'garage' && back.gh.bed === back.garage.bed && back.gh.bar >= back.garage.bar, 'returning to the greenhouse restarted the yard bed ' + JSON.stringify(back));

    const muted = await evalJs(`(() => {
      G.st.settings.mute = true;
      G.st.settings.vMusic = 35;
      G.st.land = true;
      G.setRoom('facility');
      applySettings();
      const saved = G.save();
      return { saved, music: Sound.music, vol: Sound.vol.music, style: Sound.style, room: Sound.room, key: GAME_CONFIG.saveKey };
    })()`);
    assert(muted.saved && muted.music === false && Math.abs(muted.vol - 0.35) < 0.001, 'mute and volume did not apply ' + JSON.stringify(muted));
    assert(muted.style === 'indoor' && muted.room === 'facility' && muted.key === 'mwfarms_save_v1', 'mute switched the bed or the save key ' + JSON.stringify(muted));

    await open('/index.html?music=2');
    const reloaded = await evalJs(`(() => ({
      room: G.currentRoom(), style: Sound.style, bpm: Sound.bpm, music: Sound.music, vol: Sound.vol.music,
      mute: !!G.st.settings.mute, vMusic: G.st.settings.vMusic, key: GAME_CONFIG.saveKey,
      errs: window.__errs||[]
    }))()`);
    assert(reloaded.room === 'facility' && reloaded.style === 'indoor' && reloaded.bpm === 126, 'reload did not keep the indoor bed ' + JSON.stringify(reloaded));
    assert(reloaded.mute && reloaded.music === false && reloaded.vMusic === 35 && Math.abs(reloaded.vol - 0.35) < 0.001, 'mute did not survive the reload ' + JSON.stringify(reloaded));
    assert(reloaded.key === 'mwfarms_save_v1', 'reload left the real save ' + JSON.stringify(reloaded));
    assert(!cleanErrs(reloaded.errs).length, 'reload threw ' + JSON.stringify(reloaded.errs));

    const woke = await evalJs(`(() => new Promise(resolve => {
      Sound.resume();
      const bed = Sound.bed, style = Sound.style, bar = Sound.bar;
      Sound.setPaused(true);
      Sound.setPaused(false);
      setTimeout(() => resolve({
        before: { bed, style, bar },
        after: { state: Sound.state, style: Sound.style, bed: Sound.bed, bar: Sound.bar, music: Sound.music, room: Sound.room }
      }), 400);
    }))()`);
    assert(woke.after.state === 'running' && woke.after.style === 'indoor' && woke.after.bed === woke.before.bed, 'audio resume left the indoor bed ' + JSON.stringify(woke));
    assert(woke.after.music === false && woke.after.bar >= woke.before.bar, 'resume restarted the clock or ignored mute ' + JSON.stringify(woke));

    const unmuted = await evalJs(`(() => { G.st.settings.mute = false; applySettings(); return { music: Sound.music, vol: Sound.vol.music, style: Sound.style }; })()`);
    assert(unmuted.music === true && Math.abs(unmuted.vol - 0.35) < 0.001 && unmuted.style === 'indoor', 'unmute did not restore the indoor bed at the saved volume ' + JSON.stringify(unmuted));

    await open('/index.html?test=lv10&reset=1');
    const testStart = await evalJs(`(() => ({
      level: G.st.level, room: G.currentRoom(), style: Sound.style, bpm: Sound.bpm,
      key: GAME_CONFIG.saveKey, music: Sound.music, mute: !!G.st.settings.mute
    }))()`);
    assert(testStart.level === 10 && testStart.key === 'mwfarms_test_v1', 'test save did not start ' + JSON.stringify(testStart));
    assert(testStart.room === 'garage' && testStart.style === 'garage' && testStart.bpm === 84 && testStart.music === true && !testStart.mute, 'test save did not start on the yard bed ' + JSON.stringify(testStart));

    const testMove = await evalJs(`(() => {
      Sound.resume();
      const bed = Sound.bed, bar = Sound.bar;
      G.st.ghBuilt = true;
      G.setRoom('gh');
      const gh = { style: Sound.style, bed: Sound.bed, bar: Sound.bar, room: Sound.room };
      G.st.land = true;
      G.setRoom('facility');
      G.st.settings.vMusic = 50;
      applySettings();
      const indoor = { style: Sound.style, bed: Sound.bed, room: Sound.room, bpm: Sound.bpm, vol: Sound.vol.music };
      const saved = G.save();
      return { bed, bar, gh, indoor, saved };
    })()`);
    assert(testMove.gh.style === 'garage' && testMove.gh.bed === testMove.bed && testMove.gh.bar >= testMove.bar, 'test save restarted music between garage and greenhouse ' + JSON.stringify(testMove));
    assert(testMove.indoor.style === 'indoor' && testMove.indoor.bpm === 126 && testMove.indoor.bed === testMove.bed + 1 && testMove.saved, 'test save did not crossfade into the indoor bed ' + JSON.stringify(testMove));

    await open('/index.html?test=lv10');
    const testKept = await evalJs(`(() => ({
      level: G.st.level, room: G.currentRoom(), style: Sound.style, bpm: Sound.bpm,
      vol: Sound.vol.music, vMusic: G.st.settings.vMusic, key: GAME_CONFIG.saveKey,
      real: localStorage.getItem('mwfarms_save_v1') ? true : false,
      errs: window.__errs||[]
    }))()`);
    assert(testKept.level === 10 && testKept.room === 'facility' && testKept.style === 'indoor' && testKept.bpm === 126, 'test reload did not keep the indoor bed ' + JSON.stringify(testKept));
    assert(testKept.key === 'mwfarms_test_v1' && testKept.vMusic === 50 && Math.abs(testKept.vol - 0.5) < 0.001, 'test reload lost the volume or the save key ' + JSON.stringify(testKept));
    assert(!cleanErrs(testKept.errs).length, 'test reload threw ' + JSON.stringify(testKept.errs));

    if (!process.exitCode) console.log('PASS room music');
  } finally {
    try { chrome.kill('SIGKILL'); } catch (e){}
  }
}

main().catch(err => { console.error('FAIL', err && err.stack || err); process.exitCode = 1; });
