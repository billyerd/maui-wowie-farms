/* A tap inside a cell harvests that cell, even when a wide neighbour overhangs it.
   Center, mid-body, upper leaf, and both side edges of every ripe cell must match.
   Run: node tests/cell-hit-check.js
   Uses headless Chrome against the local static server. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = process.env.HIT_CHROME_PORT || '9341';
const ORIGIN = process.env.HIT_ORIGIN || 'http://127.0.0.1:8765';

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

  const profile = '/tmp/chrome-cellhit-' + PORT;
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
    await cdp('Network.enable');
    await cdp('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source:
`window.__errs=[];
window.addEventListener('error', e => window.__errs.push(String(e.message||e.error||e)));
const _ce=console.error; console.error=function(){ window.__errs.push([].map.call(arguments,String).join(' ')); return _ce.apply(console, arguments); };
localStorage.setItem('mwfarms_age_ok','1');
localStorage.setItem('mwfarms_ad_consent_v1','contextual');
localStorage.removeItem('mwf_test_slot');
localStorage.removeItem('mwfarms_save_v1');
localStorage.removeItem('mwfarms_test_v1');
localStorage.removeItem('mwfarms_test_fresh_v1');` });

    async function open(path, w, h){
      await cdp('Emulation.setDeviceMetricsOverride', { width: w || 390, height: h || 844, deviceScaleFactor: 2, mobile: true });
      await cdp('Page.navigate', { url: ORIGIN + path });
      await sleep(1400);
      await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
      await sleep(500);
    }

    await open('/index.html?test=fresh100m&reset=1', 390, 844);
    const goal = await evalJs(`(() => {
      const g=document.getElementById('goal');
      g.classList.add('open');
      const gt=g.querySelector('.gt');
      return {
        level: G.st.level, done: !!G.st.questDone, met: !!(G.questMet&&G.questMet(G.curQuest())),
        title: gt ? gt.textContent : '', body: g.innerText, errs: (window.__errs||[]).slice(0,4)
      };
    })()`);
    console.log('GOAL', JSON.stringify(goal));
    assert(goal && goal.level === 1 && !goal.done && !goal.met, 'level 1 goal is marked complete ' + JSON.stringify(goal));
    assert(goal.title && !/complete|tap to claim/i.test(goal.title), 'claim text shows on an open goal ' + JSON.stringify(goal));
    assert(/plant a seed/i.test(goal.body), 'level 1 goal lost the plant task ' + JSON.stringify(goal));
    assert(!(goal.errs && goal.errs.length), 'goal console errors ' + JSON.stringify(goal.errs));

    async function tabs(w, h){
      await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await sleep(200);
      return evalJs(`(() => {
        const bar=document.getElementById('toolbar').getBoundingClientRect();
        const els=[...document.querySelectorAll('#toolbar #qaFab, #toolbar #locBtn, #toolbar #upgBtn, #toolbar #seedBag, #toolbar #menu button')];
        const items=els.map(el=>{ const r=el.getBoundingClientRect(); return {id:el.id||el.getAttribute('data-panel'), w:+r.width.toFixed(1), l:+r.left.toFixed(1), r:+r.right.toFixed(1)}; });
        const labels=[...document.querySelectorAll('#toolbar #menu button small, #toolbar #locBtn small, #toolbar #upgBtn b, #toolbar #seedBag b')].map(el=>{
          const r=el.getBoundingClientRect();
          return {t:(el.textContent||'').trim(), w:+r.width.toFixed(1), h:+r.height.toFixed(1)};
        });
        return {w:innerWidth, bar:+bar.width.toFixed(1), items, labels, errs:(window.__errs||[]).slice(0,3)};
      })()`);
    }
    const tab320 = await tabs(320, 568);
    const tab360 = await tabs(360, 740);
    console.log('TABS', JSON.stringify({
      w320: tab320.items.map(it=>it.w),
      w360: tab360.items.map(it=>it.w)
    }));
    assert(tab320.items.length === 10 && tab360.items.length === 10, 'tab count changed');
    for (const it of tab320.items){
      assert(it.w >= 31 && it.l >= -1 && it.r <= 321, '320 tab left the row ' + JSON.stringify(it));
    }
    for (const it of tab360.items){
      assert(it.w >= 36, '360 tab hit is under 36px ' + JSON.stringify(it));
    }
    for (const lab of tab320.labels.concat(tab360.labels)){
      assert(lab.h >= 6 && lab.w >= 8, 'tab label hidden ' + JSON.stringify(lab));
    }

    const rooms = await evalJs(`(() => {
      const ids=G.S.map(s=>s.id);
      const specs=[
        {room:'garage', zone:'garage', cap:1.32, prep:()=>{ G.st.level=10; G.st.garage=5; G.st.garageKeep=0; }},
        {room:'gh', zone:'gh', cap:1.17, prep:()=>{ G.st.ghBuilt=true; G.st.gh=3; delete G.st.ghMatch; }},
        {room:'facility', zone:'field', cap:1.17, prep:()=>{ G.st.land=true; G.st.field=3; }}
      ];
      const out=[];
      const goal=document.getElementById('goal'); if(goal) goal.classList.remove('open');
      for(const spec of specs){
        spec.prep(); G.syncPlots();
        const owned=G.st.plots.filter(p=>p.zone===spec.zone&&p.owned);
        const batches=[];
        for(let i=0;i<ids.length;i+=owned.length) batches.push(ids.slice(i, i+owned.length));
        batches.push(ids.slice());
        const fills=[];
        for(const batch of batches){
          owned.forEach((p,i)=>{ p.strain=batch[i%batch.length]; p.prog=1; p.water=1; p.food=1; p.pest=null; p.q=1; });
          G.setRoom(spec.room); if(R.resize) R.resize(); R.frame(0.05);
          const audit=R.auditCellHits();
          const sprites=R.bedSprites();
          const wide=sprites.filter(s=>s.w>s.cellW*spec.cap+1).slice(0,3).map(s=>({art:s.art,w:+s.w.toFixed(1),cell:+s.cellW.toFixed(1)}));
          const off=sprites.filter(s=>s.edge!=null && s.x+(s.shift||0)+s.w/2>s.edge+8.5).slice(0,3).map(s=>({art:s.art,right:+(s.x+(s.shift||0)+s.w/2).toFixed(1)}));
          const squashed=sprites.filter(s=>s.a && Math.abs(s.w/s.h-s.a)>0.06).length;
          fills.push({n:owned.length, audit, wide, off, squashed, drawn:sprites.length});
          if(!audit.ok) break;
        }
        const narrow=fills[0];
        out.push({room:spec.room, cells:owned.length, strains:ids.length, fills, errs:(window.__errs||[]).slice(0,4)});
      }
      G.st.level=1; G.st.quest=0; G.st.questDone=false;
      G.st.plots.forEach(p=>{ p.strain=null; p.prog=0; });
      G.st.stats.plant=0;
      return out;
    })()`);
    for (const room of rooms || []){
      console.log('HITS', room.room, JSON.stringify(room.fills.map(f=>({n:f.n, misses:f.audit&&f.audit.misses, wide:f.wide, off:f.off, squashed:f.squashed, drawn:f.drawn}))));
      assert(!(room.errs && room.errs.length), room.room + ' console errors ' + JSON.stringify(room.errs));
      assert(room.cells > 4, room.room + ' did not open its pots');
      for (const fill of room.fills){
        assert(fill.drawn === fill.n, room.room + ' did not draw every plant ' + JSON.stringify(fill));
        assert(fill.audit && fill.audit.ok && fill.audit.misses === 0, room.room + ' tap missed its cell ' + JSON.stringify(fill.audit));
        assert(!fill.wide.length, room.room + ' plant exceeds the width cap ' + JSON.stringify(fill.wide));
        assert(!fill.off.length, room.room + ' plant leaves the screen ' + JSON.stringify(fill.off));
        assert(!fill.squashed, room.room + ' plant was squashed');
      }
    }

    if (!process.exitCode) console.log('cell hit checks passed');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
