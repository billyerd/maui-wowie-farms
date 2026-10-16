/* Indoor Facility fills the screen the way the garage and greenhouse do.
   Five pots across, cell size locked to the full 40-pot grid, no side gutter.
   Upgrade spots stay in a fixed shelf under the light.
   Run: node tests/indoor-layout-check.js
*/
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.LAYOUT_CHROME_PORT || '9412';
const ORIGIN = process.env.LAYOUT_ORIGIN || 'http://127.0.0.1:8765';
const SHOTS = '/tmp/indoor-layout-shots';
const SAT = 59;

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

function overlaps(a, b){
  return a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5;
}

async function main(){
  let serverUp = false;
  try { const r = await get(ORIGIN + '/index.html'); serverUp = r.status === 200; } catch (e){ serverUp = false; }
  if (!serverUp){ fail('static server is not serving ' + ORIGIN); return; }
  fs.mkdirSync(SHOTS, { recursive: true });

  const profile = '/tmp/chrome-ilayout-' + PORT;
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
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 1800));
      return r.result && r.result.value;
    }
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    async function shot(name){
      const pic = await cdp('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const file = path.join(SHOTS, name + '.png');
      fs.writeFileSync(file, Buffer.from(pic.data, 'base64'));
      console.log('shot', file);
    }
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
      await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true });
      await cdp('Emulation.setSafeAreaInsetsOverride', { insets: { top: SAT, left: 0, right: 0, bottom: 0 } });
    }

    await boot(390, 844);
    await cdp('Page.navigate', { url: ORIGIN + '/index.html?ilayout=1' });
    await sleep(1400);
    await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
    await sleep(400);
    await evalJs(`(() => {
      const skip=document.querySelector('#tutc [data-a="skip"]'); if(skip) skip.click();
      G.st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0};
      const card=document.getElementById('tutc'); if(card) card.classList.add('hidden');
      const goal=document.getElementById('goal'); if(goal) goal.classList.remove('open');
      G.st.level=10; G.st.cash=900000;
      G.st.land=true; G.st.ghBuilt=true; G.st.ghMatch=36; G.st.gh=0; G.st.inBuilt=false;
      G.st.upg.led=2; G.st.upg.air=1; G.st.upg.hvac=1; G.st.upg.fert=1; G.st.upg.co2=1;
      return true;
    })()`);

    const measure = (zone) => `(() => {
      if(window.R&&R.resize) R.resize();
      R.frame(0.05);
      const L=R.bedLayout();
      const cr=document.getElementById('game').getBoundingClientRect();
      const hud=document.getElementById('hud').getBoundingClientRect();
      const bar=document.getElementById('toolbar').getBoundingClientRect();
      const bag=document.getElementById('seedBag').getBoundingClientRect();
      const pots=[];
      G.st.plots.filter(p=>p.zone==='${zone}'&&p.owned).forEach(p=>{
        const r=R.plotRect(p); if(!r) return;
        pots.push({x:r.left-cr.left,y:r.top-cr.top,w:r.right-r.left,h:r.bottom-r.top});
      });
      let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
      const xs=[];
      pots.forEach(c=>{ x0=Math.min(x0,c.x); y0=Math.min(y0,c.y); x1=Math.max(x1,c.x+c.w); y1=Math.max(y1,c.y+c.h); xs.push(Math.round(c.x)); });
      const sample=pots[0];
      const stack=sample?document.elementsFromPoint(cr.left+sample.x+sample.w/2, cr.top+sample.y+sample.h/2):[];
      const top=stack&&stack[0];
      const bagEl=document.getElementById('seedBag');
      const bagStack=document.elementsFromPoint(bag.left+bag.width/2, bag.top+bag.height/2);
      const bagTop=bagStack&&bagStack[0];
      const cv=document.getElementById('game');
      return {
        room:L.room, n:pots.length, cell:L.cell, light:L.light, gear:L.gear||[],
        box:pots.length?{x0,y0,x1,y1}:{x0:0,y0:0,x1:0,y1:0},
        cols:[...new Set(xs)].length,
        hud:hud.bottom-cr.top, bar:bar.top-cr.top, bag:bag.top-cr.top,
        bagHit:bagTop&&bagEl&&(bagTop===bagEl||bagEl.contains(bagTop))?'seedBag':(bagTop?(bagTop.id||bagTop.tagName.toLowerCase()):''),
        potHit:top?(top.id||top.tagName.toLowerCase()):'',
        W:innerWidth, H:innerHeight,
        canvasW:cv.getBoundingClientRect().width, canvasH:cv.getBoundingClientRect().height,
        sat:getComputedStyle(document.documentElement).getPropertyValue('--sat').trim(),
        scrollY:window.scrollY, scrollH:document.documentElement.scrollHeight, clientH:document.documentElement.clientHeight,
        errs:(window.__errs||[]).slice(0,4)
      };
    })()`;

    function checkRoom(tag, m, expect){
      console.log(tag, JSON.stringify({ n:m.n, cols:m.cols, cell:m.cell, box:m.box, light:m.light&&{x:+m.light.x.toFixed(1),y:+m.light.y.toFixed(1),w:+m.light.w.toFixed(1),h:+m.light.h.toFixed(1),potTop:m.light.potTop}, gear:(m.gear||[]).map(g=>g.k+':'+Math.round(g.x)+','+Math.round(g.y)), hud:m.hud, bar:m.bar, sat:m.sat }));
      assert(!(m.errs && m.errs.length), tag + ' console errors ' + JSON.stringify(m.errs));
      assert(m.sat === SAT + 'px', tag + ' safe area is ' + m.sat);
      assert(Math.abs(m.canvasW - m.W) < 1 && Math.abs(m.canvasH - m.H) < 1, tag + ' canvas does not cover the screen');
      assert(m.scrollY === 0 && m.scrollH <= m.clientH + 2, tag + ' the room scrolls ' + m.scrollH + '/' + m.clientH);
      assert(m.n === expect.n, tag + ' pot count ' + m.n);
      assert(m.cols === expect.cols, tag + ' columns ' + m.cols);
      assert(m.cell && m.cell.w >= 36 && m.cell.h >= 36, tag + ' cell is under 36px ' + JSON.stringify(m.cell));
      assert(m.box.x0 <= 8 && m.box.x1 >= m.W - 8, tag + ' pots do not span the width ' + JSON.stringify(m.box));
      assert(m.box.y0 >= m.hud - 1 && m.box.y1 <= m.bar + 1, tag + ' pots overlap the top bar or the bottom row ' + JSON.stringify(m.box) + ' hud ' + m.hud + ' bar ' + m.bar);
      assert(m.box.y1 <= m.bag, tag + ' pots overlap the seed bag');
      assert(m.light && m.light.kind === expect.kind, tag + ' light kind ' + JSON.stringify(m.light));
      assert(m.light.y >= m.hud - 1, tag + ' light overlaps the top bar');
      assert(m.light.y + m.light.h <= m.bar - 8, tag + ' light overlaps the bottom row');
      assert(m.light.y + m.light.h <= m.light.potTop - 1, tag + ' light overlaps the plants');
      assert(Math.abs(m.light.x - m.box.x0) <= 2 && Math.abs((m.light.x + m.light.w) - m.box.x1) <= 2, tag + ' light does not span the pots');
      assert(m.potHit === 'canvas' || m.potHit === 'game' || m.potHit === 'stage', tag + ' a plant is covered by ' + m.potHit);
      assert(m.bagHit === 'seedBag' || m.bagHit === 'b' || m.bagHit === 'small' || m.bagHit === 'img', tag + ' seed bag is covered by ' + m.bagHit);
      if (expect.fill) assert(m.box.y1 >= m.bar - 6, tag + ' the full grid stops short of the bottom row ' + m.box.y1 + ' bar ' + m.bar);
    }

    function checkGear(tag, few, many){
      assert(few.gear && few.gear.length === 5 && many.gear.length === 5, tag + ' missing shelf spots');
      const keys = ['led','air','hvac','fert','co2'];
      keys.forEach(k => {
        const a = few.gear.find(g => g.k === k), b = many.gear.find(g => g.k === k);
        assert(a && b, tag + ' missing ' + k);
        assert(a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h, tag + ' ' + k + ' moved when the pot count changed');
        [a].forEach(g => {
          assert(g.y >= few.light.y + few.light.h - 0.5, tag + ' ' + k + ' covers the light');
          assert(g.y + g.h <= few.box.y0 + 0.5 || few.box.y0 > g.y + g.h - 0.5, tag + ' ' + k + ' covers a min-pot row');
          assert(g.x >= 0 && g.x + g.w <= few.W, tag + ' ' + k + ' leaves the screen');
          assert(g.y >= few.hud - 1 && g.y + g.h <= few.bar - 2, tag + ' ' + k + ' overlaps the bars');
        });
      });
      many.gear.forEach(g => {
        assert(g.y + g.h <= many.box.y0 + 0.5, tag + ' ' + g.k + ' covers the full grid ' + JSON.stringify(g) + ' ' + JSON.stringify(many.box));
        assert(!overlaps(g, {x:many.light.x,y:many.light.y,w:many.light.w,h:many.light.h}), tag + ' ' + g.k + ' intersects the light');
      });
      for (let i = 0; i < many.gear.length; i++) for (let j = i + 1; j < many.gear.length; j++){
        assert(!overlaps(many.gear[i], many.gear[j]), tag + ' spots overlap');
      }
    }

    const plant = `var ids=['maui-wowie','granddaddy-purple','northern-lights','blue-dream'];
      G.st.plots.forEach(function(p,i){ if(p.owned){ p.strain=ids[i%4]; p.prog=0.85; p.water=1; p.food=1; p.pest=null; } });`;

    const sizes = [[320,568],[360,740],[390,844],[430,932]];
    for (const [w,h] of sizes){
      await boot(w, h);
      await sleep(200);
      const few = await evalJs(`G.st.field=0; G.syncPlots(); ${plant} G.setRoom('facility');` + measure('field'));
      await shot('indoor_min_' + w + 'x' + h);
      const many = await evalJs(`G.st.field=3; G.syncPlots(); ${plant} G.setRoom('facility');` + measure('field'));
      await shot('indoor_max_' + w + 'x' + h);
      const garage = await evalJs(`G.st.garage=5; G.st.garageKeep=0; G.syncPlots(); ${plant} G.setRoom('garage');` + measure('garage'));
      await shot('garage_' + w + 'x' + h);
      const gh = await evalJs(`G.st.ghBuilt=true; G.st.ghMatch=36; G.st.gh=0; G.syncPlots(); ${plant} G.setRoom('gh');` + measure('gh'));
      await shot('greenhouse_' + w + 'x' + h);

      checkRoom(w + ' indoor 10', few, { n:10, cols:5, kind:'led', fill:false });
      checkRoom(w + ' indoor 40', many, { n:40, cols:5, kind:'led', fill:true });
      checkRoom(w + ' garage 20', garage, { n:20, cols:5, kind:'led', fill:true });
      checkRoom(w + ' greenhouse', gh, { n:36, cols:6, kind:'day', fill:true });
      checkGear(w + ' shelf', few, many);
      assert(Math.abs(few.cell.w - many.cell.w) < 0.2 && Math.abs(few.cell.h - many.cell.h) < 0.2, w + ' indoor cells resized when pots were added');
      assert(Math.abs(few.cell.w - garage.cell.w) < 0.8, w + ' indoor width ' + few.cell.w + ' is not the garage width ' + garage.cell.w);
      assert((few.gear||[]).length === 5 && (garage.gear||[]).length === 0 && (gh.gear||[]).length === 0, w + ' gear leaked into another room');
    }

    await boot(390, 844);
    await sleep(200);
    const clicked = await evalJs(`(() => {
      G.st.field=0; G.syncPlots(); ${plant}
      document.getElementById('locBtn').click();
      const fac=document.querySelector('#locPick [data-room="facility"]'); if(fac) fac.click();
      R.frame(0.05);
      const a=R.bedLayout().room;
      document.getElementById('locBtn').click();
      const g=document.querySelector('#locPick [data-room="garage"]'); if(g) g.click();
      R.frame(0.05);
      const b=R.bedLayout().room;
      document.getElementById('locBtn').click();
      const h=document.querySelector('#locPick [data-room="gh"]'); if(h) h.click();
      R.frame(0.05);
      const c=R.bedLayout().room;
      document.getElementById('seedBag').click();
      const sheet=document.getElementById('sheet');
      const open=sheet&&!sheet.classList.contains('hidden');
      const title=(document.getElementById('sheetTitle')||{}).textContent||'';
      if(window.UI&&UI.close) UI.close();
      return { a, b, c, open, title, errs:(window.__errs||[]).slice(0,4) };
    })()`);
    console.log('clicked', JSON.stringify(clicked));
    assert(!(clicked.errs && clicked.errs.length), 'click path console errors ' + JSON.stringify(clicked.errs));
    assert(clicked.a === 'facility' && clicked.b === 'garage' && clicked.c === 'gh', 'location buttons did not switch rooms ' + JSON.stringify(clicked));
    assert(clicked.open && /seed/i.test(clicked.title), 'seed bag did not open ' + JSON.stringify(clicked));

    if (!process.exitCode) console.log('indoor layout checks passed');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
