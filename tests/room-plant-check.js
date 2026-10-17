/* Room plants are original painted growth art: a stem, fan leaves, and
   strain-colored colas. They stay in the pot and fit the cell.
   The seed shop keeps its own bud portraits.
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
        if(window.Art&&Art.drawPlant&&!Art.drawPlant.__wrapped){
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

    // Fill every owned plot in a zone. Each growth stage is its own painted plant.
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
      assert(m.sprites && m.sprites.length === m.n, tag + ' sprite count ' + (m.sprites && m.sprites.length) + ' vs pots ' + m.n);
      for (const s of m.sprites || []){
        assert(s.painted && s.grown && !s.closeup, tag + ' pot ' + s.id + ' is not the grown plant ' + JSON.stringify(s));
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
        const feet=()=>R.bedSprites().map(s=>({id:s.id,foot:s.foot,top:s.top,h:s.h,closeup:s.closeup,grown:s.grown,stage:s.stage,cellTop:s.cellTop}));
        R.setDprCap(1); R.resize(); R.frame(0.05);
        const low=feet();
        R.zoomAt(innerWidth/2, innerHeight/2, 2.4);
        R.frame(0.05);
        const pinched=feet();
        R.setDprCap(3); R.resize(); R.frame(0.05);
        const hi=feet();
        R.setDprCap(3); R.resize(); R.frame(0.05);
        return {low, pinched, hi, errs:(window.__errs||[]).slice(0,4)};
      })()`);
      console.log(tag, JSON.stringify({ n: m.low.length, hi: m.hi.length }));
      assert(!(m.errs && m.errs.length), tag + ' console errors ' + JSON.stringify(m.errs));
      assert(m.low.length && m.low.length === m.hi.length && m.low.length === m.pinched.length, tag + ' zoom lost plants');
      for (let i = 0; i < m.low.length; i++){
        const a = m.low[i], b = m.pinched[i], c = m.hi[i];
        assert(a.grown && b.grown && c.grown && !a.closeup, tag + ' zoom left the grown plant');
        assert(Math.abs(a.foot - b.foot) < 0.6 && Math.abs(a.foot - c.foot) < 0.6, tag + ' zoom moved the plant off the pot ' + JSON.stringify([a,b,c]));
        assert(Math.abs((a.top + a.h) - a.foot) < 0.6 && Math.abs((c.top + c.h) - c.foot) < 0.6, tag + ' plant is not sitting on the soil');
        assert(a.top >= a.cellTop - 1 && c.top >= c.cellTop - 1, tag + ' zoom grew the plant out of the cell');
      }
    }

    async function sizeCheck(){
      await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
      const m = await evalJs(`(() => {
        R.setDprCap(3); if(R.resize) R.resize();
        const dpr = document.getElementById('game').width / innerWidth;
        G.st.garage=0; G.st.garageKeep=0; G.syncPlots();
        const g=G.st.plots.filter(p=>p.zone==='garage'&&p.owned);
        g.forEach(p=>{ p.strain='jealousy'; p.prog=1; p.water=1; p.food=1; p.pest=null; });
        G.setRoom('garage'); R.frame(0.05);
        const maui=R.bedSprites()[0];
        G.st.land=true; G.st.field=3; G.syncPlots();
        const inn=G.st.plots.filter(p=>p.zone==='field'&&p.owned);
        const ids=(window.STRAINS||[]).map(s=>s.id);
        inn.forEach((p,i)=>{ p.strain=ids[i%ids.length]; p.prog=1; p.water=1; p.food=1; p.pest=null; });
        G.setRoom('facility'); R.frame(0.05);
        const sprites=R.bedSprites();
        const short=sprites.filter(s=>{
          const span=s.foot-s.cellTop, aspect=s.w/Math.max(0.01,s.h), maxH=span-2;
          if(aspect*maxH>=55) return s.w<54.5;
          return s.h<maxH*0.88;
        });
        G.st.discovered=G.st.discovered||{}; G.st.discovered['maui-wowie']=1; G.st.discovered['granddaddy-purple']=1;
        UI.open('seeds');
        return {
          dpr, ripe:{h:+maui.h.toFixed(1), w:+maui.w.toFixed(1), span:+(maui.foot-maui.cellTop).toFixed(1), id:'jealousy'},
          indoor:sprites.length, short:short.length,
          minW:+Math.min(...sprites.map(s=>s.w)).toFixed(1), maxW:+Math.max(...sprites.map(s=>s.w)).toFixed(1),
          errs:(window.__errs||[]).slice(0,3)
        };
      })()`);
      await sleep(400);
      const shop = await evalJs(`(() => {
        const im=document.querySelector('.shoppic');
        if(!im) return null;
        const r=im.getBoundingClientRect();
        return {w:+r.width.toFixed(1), h:+r.height.toFixed(1), sz:im.dataset.sz};
      })()`);
      await evalJs(`(() => { UI.close(); return true; })()`);
      await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
      await evalJs(`(() => { if(R.resize) R.resize(); return true; })()`);
      console.log('size', JSON.stringify(Object.assign({}, m, {shop})));
      assert(!(m.errs && m.errs.length), 'size console errors ' + JSON.stringify(m.errs));
      assert(m.dpr >= 2.9, 'device pixel ratio is capped below 3 (' + m.dpr + ')');
      assert(m.ripe && m.ripe.h >= m.ripe.span * 0.60, 'garage ripe plant is under 60% of the cell ' + JSON.stringify(m.ripe));
      assert(m.indoor >= 20, 'indoor size sample is too small');
      assert(m.short === 0, 'indoor ripe plants are smaller than the cell allows');
      assert(m.maxW >= 55, 'no indoor ripe plant reached 55px wide');
      assert(shop && shop.w >= 90 && shop.h >= 110, 'seed shop picture is still small ' + JSON.stringify(shop));
    }

    async function stageRow(label){
      const m = await evalJs(`(() => {
        G.st.garage=0; G.st.garageKeep=0; G.syncPlots();
        const owned=G.st.plots.filter(p=>p.zone==='garage'&&p.owned);
        const setup=[[0.04,'northern-lights'],[0.34,'northern-lights'],[0.75,'northern-lights'],[1,'northern-lights'],[1,'granddaddy-purple']];
        owned.forEach((p,i)=>{
          const s=setup[i];
          if(!s){ p.strain=null; p.prog=0; return; }
          p.strain=s[1]; p.prog=s[0]; p.water=1; p.food=1; p.pest=null;
        });
        G.setRoom('garage');
        const goal=document.getElementById('goal'); if(goal) goal.classList.remove('open');
        if(R.resize) R.resize();
        R.frame(0.05); R.frame(0.05);
        return { sprites:R.bedSprites(), errs:(window.__errs||[]).slice(0,4) };
      })()`);
      console.log('stages', label, JSON.stringify((m.sprites||[]).map(s=>({stage:s.stage,h:+s.h.toFixed(1),w:+s.w.toFixed(1)}))));
      assert(!(m.errs && m.errs.length), label + ' stage errors ' + JSON.stringify(m.errs));
      const four=(m.sprites||[]).slice(0,4);
      assert(four.map(s=>s.stage).join(',')==='0,2,4,5', label + ' stages ' + four.map(s=>s.stage).join(','));
      assert(four[0].h < four[1].h && four[1].h < four[3].h, label + ' growth did not read ' + four.map(s=>s.h).join(','));
      for (const s of m.sprites||[]){
        assert(s.grown && s.painted && !s.closeup, label + ' stage plant is not grown art');
        assert(Math.abs((s.top + s.h) - s.foot) < 0.6, label + ' stage plant is not rooted');
      }
      await shot('stages_' + label);
      await evalJs(`(() => { UI.open('seeds'); return true; })()`);
      await sleep(700);
      await shot('shop_' + label);
      await evalJs(`(() => { UI.close(); return true; })()`);
      await sleep(200);
    }

    await boot(390, 844);
    check('390 garage 5', await evalJs(scene('garage', 'garage', `G.st.garage=0; G.st.garageKeep=0;`)));
    await shot('garage_5_390x844');
    await stageRow('390x844');
    check('390 garage 20', await evalJs(scene('garage', 'garage', `G.st.garage=5; G.st.garageKeep=0;`)));
    await shot('garage_20_390x844');
    check('390 greenhouse', await evalJs(scene('gh', 'gh', `G.st.ghBuilt=true; G.st.gh=0; G.st.ghMatch=12;`)));
    await shot('greenhouse_390x844');
    await zoomCheck('zoom garage', 'G.st.garage=0; G.st.garageKeep=0;', 'garage', 'garage');
    await zoomCheck('zoom greenhouse', 'G.st.ghBuilt=true; G.st.gh=0; G.st.ghMatch=12;', 'gh', 'gh');
    await zoomCheck('zoom indoor', 'G.st.land=true; G.st.field=0;', 'facility', 'field');
    check('390 indoor', await evalJs(scene('facility', 'field', `G.st.land=true; G.st.field=1;`)));
    await shot('indoor_390x844');
    await sizeCheck();
    check('390 benches', await evalJs(scene('benches', 'in', `G.st.land=true; G.st.inBuilt=true; G.st.bench=0;`)));
    await shot('benches_390x844');

    await boot(320, 568);
    check('320 garage 5', await evalJs(scene('garage', 'garage', `G.st.garage=0; G.st.garageKeep=0;`)));
    await shot('garage_5_320x568');
    await stageRow('320x568');
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
