/* Room plants use the painted shop portraits and growth art, stay in the pot,
   and fit the cell. The procedural stand-in is only a fallback.
   Run: node tests/room-plant-check.js */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PLANT_CHROME_PORT || '9380';
const ORIGIN = process.env.PLANT_ORIGIN || 'http://127.0.0.1:8765';
const SHOTS = process.env.PLANT_SHOTS || '/tmp/plant-shots';

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

  const profile = '/tmp/chrome-roomplant-' + PORT;
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
      await cdp('Page.navigate', { url: ORIGIN + '/index.html?plants=' + w + 'x' + h });
      await sleep(1400);
      await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
      await sleep(500);
      await evalJs(`(() => {
        const skip=document.querySelector('#tutc [data-a="skip"]'); if(skip) skip.click();
        G.st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0};
        const card=document.getElementById('tutc'); if(card) card.classList.add('hidden');
        const goal=document.getElementById('goal'); if(goal) goal.classList.remove('open');
        G.st.level=10; G.st.cash=900000;
        window.__draws=0;
        if(window.Art&&!Art.drawPlant.__wrapped){
          const o=Art.drawPlant;
          const wrapped=function(){ window.__draws++; return o.apply(this, arguments); };
          wrapped.__wrapped=1;
          Art.drawPlant=wrapped;
        }
        return true;
      })()`);
      for (let i = 0; i < 50; i++){
        const ready = await evalJs(`(() => {
          try{ return !!(R.closeupCanvas&&R.closeupCanvas(G.strain('maui-wowie'), 48)); }
          catch(e){ return false; }
        })()`);
        if (ready) return;
        await sleep(200);
      }
      throw new Error('shop portrait did not load');
    }

    async function shot(name){
      const goal = await cdp('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const file = path.join(SHOTS, name + '.png');
      fs.writeFileSync(file, Buffer.from(goal.data, 'base64'));
      console.log('shot', file);
    }

    // Fill every owned plot in a zone. Young plants keep a growth-stage picture; ripe plants use the shop portrait.
    const scene = (room, zone, prep) => `(() => {
      ${prep}
      G.syncPlots();
      const ids=['maui-wowie','granddaddy-purple','northern-lights','blue-dream','glitter-bomb','durban-poison','purple-punch','gelato'];
      const progs=[1,1,0.12,0.4,0.7];
      const owned=G.st.plots.filter(p=>p.zone==='${zone}'&&p.owned);
      owned.forEach((p,i)=>{ p.strain=ids[i%ids.length]; p.prog=i<progs.length?progs[i]:1; p.water=1; p.food=1; p.pest=null; p.q=1; });
      G.setRoom('${room}');
      const goal=document.getElementById('goal'); if(goal) goal.classList.remove('open');
      if(window.R&&R.resize) R.resize();
      const before=window.__draws||0;
      R.frame(0.05); R.frame(0.05);
      const sprites=R.bedSprites();
      const lay=R.bedLayout();
      return {
        n: owned.length, room: lay&&lay.room, calls: (window.__draws||0)-before,
        sprites, errs: (window.__errs||[]).slice(0,6),
        light: lay&&lay.light
      };
    })()`;

    function check(tag, m){
      console.log(tag, JSON.stringify({ n: m.n, room: m.room, calls: m.calls, sprites: (m.sprites||[]).length, errs: m.errs }));
      assert(m.room, tag + ' room missing');
      assert(!(m.errs && m.errs.length), tag + ' console errors ' + JSON.stringify(m.errs));
      assert(m.calls === 0, tag + ' drew the procedural plant ' + m.calls + ' times');
      assert(m.sprites && m.sprites.length === m.n, tag + ' sprite count ' + (m.sprites && m.sprites.length) + ' vs pots ' + m.n);
      for (const s of m.sprites || []){
        assert(s.painted && s.closeup, tag + ' pot ' + s.id + ' is not the seed-shop closeup ' + JSON.stringify(s));
        const span = (s.foot || 0) - (s.cellTop || 0);
        if (span >= 48) assert(s.h >= 18 && s.w >= 14, tag + ' pot ' + s.id + ' plant is tiny ' + JSON.stringify(s));
        else assert(s.h >= 10 && s.w >= 8, tag + ' pot ' + s.id + ' plant is tiny ' + JSON.stringify(s));
        assert(s.w <= (s.cellW || 0) + 0.5, tag + ' pot ' + s.id + ' is wider than its cell ' + JSON.stringify(s));
        assert(s.top >= (s.cellTop || 0) - 1, tag + ' pot ' + s.id + ' grows out of its cell ' + JSON.stringify(s));
        assert(Math.abs((s.top + s.h) - s.foot) < 0.6, tag + ' pot ' + s.id + ' is not rooted on the soil ' + JSON.stringify(s));
      }
    }

    async function zoomCheck(tag, prep, room, zone){
      const m = await evalJs(`(() => {
        ${prep}
        G.syncPlots();
        const ids=['maui-wowie','northern-lights','granddaddy-purple'];
        const owned=G.st.plots.filter(p=>p.zone==='${zone}'&&p.owned);
        owned.forEach((p,i)=>{ p.strain=ids[i%ids.length]; p.prog=i%3===0?1:i%3===1?.35:.8; p.water=1; p.food=1; p.pest=null; });
        G.setRoom('${room}');
        if(R.resize) R.resize();
        const feet=()=>R.bedSprites().map(s=>({id:s.id,foot:s.foot,top:s.top,h:s.h,closeup:s.closeup,cellTop:s.cellTop}));
        R.setDprCap(1); R.resize(); R.frame(0.05);
        const low=feet();
        R.zoomAt(innerWidth/2, innerHeight/2, 2.4);
        R.frame(0.05);
        const pinched=feet();
        R.setDprCap(3); R.resize(); R.frame(0.05);
        const hi=feet();
        R.setDprCap(2); R.resize(); R.frame(0.05);
        return {low, pinched, hi, errs:(window.__errs||[]).slice(0,4)};
      })()`);
      console.log(tag, JSON.stringify({ n: m.low.length, hi: m.hi.length }));
      assert(!(m.errs && m.errs.length), tag + ' console errors ' + JSON.stringify(m.errs));
      assert(m.low.length && m.low.length === m.hi.length && m.low.length === m.pinched.length, tag + ' zoom lost plants');
      for (let i = 0; i < m.low.length; i++){
        const a = m.low[i], b = m.pinched[i], c = m.hi[i];
        assert(a.closeup && b.closeup && c.closeup, tag + ' zoom left the shop closeup');
        assert(Math.abs(a.foot - b.foot) < 0.6 && Math.abs(a.foot - c.foot) < 0.6, tag + ' zoom moved the plant off the pot ' + JSON.stringify([a,b,c]));
        assert(Math.abs((a.top + a.h) - a.foot) < 0.6 && Math.abs((c.top + c.h) - c.foot) < 0.6, tag + ' plant is not sitting on the soil');
        assert(a.top >= a.cellTop - 1 && c.top >= c.cellTop - 1, tag + ' zoom grew the plant out of the cell');
      }
    }

    await boot(390, 844);
    check('390 garage 5', await evalJs(scene('garage', 'garage', `G.st.garage=0; G.st.garageKeep=0;`)));
    await shot('garage_5_390x844');
    check('390 garage 20', await evalJs(scene('garage', 'garage', `G.st.garage=5; G.st.garageKeep=0;`)));
    await shot('garage_20_390x844');
    check('390 greenhouse', await evalJs(scene('gh', 'gh', `G.st.ghBuilt=true; G.st.gh=0; G.st.ghMatch=12;`)));
    await shot('greenhouse_390x844');
    await zoomCheck('zoom garage', 'G.st.garage=0; G.st.garageKeep=0;', 'garage', 'garage');
    await zoomCheck('zoom greenhouse', 'G.st.ghBuilt=true; G.st.gh=0; G.st.ghMatch=12;', 'gh', 'gh');
    await zoomCheck('zoom indoor', 'G.st.land=true; G.st.field=0;', 'facility', 'field');
    check('390 indoor', await evalJs(scene('facility', 'field', `G.st.land=true; G.st.field=1;`)));
    await shot('indoor_390x844');
    check('390 benches', await evalJs(scene('benches', 'in', `G.st.land=true; G.st.inBuilt=true; G.st.bench=0;`)));
    await shot('benches_390x844');

    await boot(320, 568);
    check('320 garage 5', await evalJs(scene('garage', 'garage', `G.st.garage=0; G.st.garageKeep=0;`)));
    await shot('garage_5_320x568');
    check('320 garage 20', await evalJs(scene('garage', 'garage', `G.st.garage=5; G.st.garageKeep=0;`)));
    await shot('garage_20_320x568');
    check('320 greenhouse', await evalJs(scene('gh', 'gh', `G.st.ghBuilt=true; G.st.gh=0; G.st.ghMatch=12;`)));
    await shot('greenhouse_320x568');
    check('320 indoor', await evalJs(scene('facility', 'field', `G.st.land=true; G.st.field=0;`)));
    await shot('indoor_320x568');

    if (!process.exitCode) console.log('room plant checks passed');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
