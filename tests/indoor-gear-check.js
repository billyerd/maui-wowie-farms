/* Indoor Facility gear follows the greenhouse sheet: five cards, similar prices,
   locked until the facility (level 10), and one fixed wall spot each.
   Old owned levels stay, including ones past the new cap.
   Run: node tests/indoor-gear-check.js */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.GEAR_CHROME_PORT || '9392';
const ORIGIN = process.env.GEAR_ORIGIN || 'http://127.0.0.1:8765';
const SHOTS = '/tmp/indoor-gear-shots';

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
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

async function main(){
  let serverUp = false;
  try { const r = await get(ORIGIN + '/index.html'); serverUp = r.status === 200; } catch (e){ serverUp = false; }
  if (!serverUp){ fail('static server is not serving ' + ORIGIN); return; }
  fs.mkdirSync(SHOTS, { recursive: true });

  const profile = '/tmp/chrome-ingear-' + PORT;
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
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp('Page.navigate', { url: ORIGIN + '/index.html?ingear=1' });
    await sleep(1300);
    await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
    await sleep(400);
    await evalJs(`(() => {
      const skip=document.querySelector('#tutc [data-a="skip"]'); if(skip) skip.click();
      G.st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0};
      const card=document.getElementById('tutc'); if(card) card.classList.add('hidden');
      const goal=document.getElementById('goal'); if(goal) goal.classList.remove('open');
      G.st.level=10; G.st.cash=900000; G.st.ghBuilt=false; G.st.land=false; G.st.inBuilt=false;
      return true;
    })()`);

    const sheet = await evalJs(`(() => {
      UI.open('upgrades','facility');
      const text=document.getElementById('sheetBody').innerText;
      const keys=[...document.querySelectorAll('#sheetBody [data-uk]')].map(el=>el.getAttribute('data-uk'));
      UI.open('upgrades','gh');
      const gh=document.getElementById('sheetBody').innerText;
      const ghKeys=[...document.querySelectorAll('#sheetBody [data-uk]')].map(el=>el.getAttribute('data-uk'));
      const U=G.UPG;
      const cost=(k,l)=>G.cost(U[k], l||0);
      return {
        order:G.INDOOR_GEAR.slice(), keys, text,
        ghKeys, ghDay:/no grow-light upgrade/i.test(gh), ghShade:gh.indexOf('Shade cloth')>=0, ghLed:ghKeys.indexOf('led')>=0,
        prices:{ led:cost('led'), air:cost('air'), hvac:cost('hvac'), fert:cost('fert'), co2:cost('co2'), led2:cost('led',1), led3:cost('led',2) },
        max:{ led:G.maxLv(U.led), air:G.maxLv(U.air), hvac:G.maxLv(U.hvac), fert:G.maxLv(U.fert), co2:G.maxLv(U.co2) },
        need:{ led:U.led.need, air:U.air.need, hvac:U.hvac.need, fert:U.fert.need, co2:U.co2.need, shade:U.shade.need, solar:U.solar.need },
        errs:(window.__errs||[]).slice(0,4)
      };
    })()`);
    console.log('sheet', JSON.stringify(sheet));
    assert(!(sheet.errs && sheet.errs.length), 'console errors ' + JSON.stringify(sheet.errs));
    assert(JSON.stringify(sheet.order) === JSON.stringify(['led','air','hvac','fert','co2']), 'indoor gear order is ' + JSON.stringify(sheet.order));
    const gearAt = sheet.keys.indexOf('led');
    assert(gearAt >= 0 && sheet.keys.slice(gearAt, gearAt + 5).join(',') === 'led,air,hvac,fert,co2', 'facility sheet gear is ' + sheet.keys.join(','));
    assert(/indoor gear/i.test(sheet.text) && sheet.text.indexOf('Shade cloth') < 0 && !/facility gear/i.test(sheet.text), 'facility sheet still mixes in daylight gear');
    assert(sheet.text.indexOf('Grow light bars') < sheet.text.indexOf('Airflow fans') && sheet.text.indexOf('Airflow fans') < sheet.text.indexOf('Climate control') && sheet.text.indexOf('Climate control') < sheet.text.indexOf('Nutrient doser') && sheet.text.indexOf('Nutrient doser') < sheet.text.indexOf('CO2 enrichment'), 'card titles are out of greenhouse order');
    assert(sheet.ghShade && !sheet.ghLed, 'greenhouse list changed ' + JSON.stringify(sheet.ghKeys));
    assert(sheet.prices.led === 1500 && sheet.prices.air === 350 && sheet.prices.hvac === 1800 && sheet.prices.fert === 2500 && sheet.prices.co2 === 3500, 'prices are not the greenhouse shape ' + JSON.stringify(sheet.prices));
    assert(sheet.prices.led2 === 3900 && sheet.prices.led3 === 10140, 'light steps are not 1500 x 2.6 ' + JSON.stringify(sheet.prices));
    assert(sheet.max.led === 3 && sheet.max.air === 1 && sheet.max.hvac === 1 && sheet.max.fert === 1 && sheet.max.co2 === 1, 'caps are ' + JSON.stringify(sheet.max));
    assert(sheet.need.led === 'land' && sheet.need.air === 'land' && sheet.need.shade === 'gh' && sheet.need.solar === 'in', 'locks moved ' + JSON.stringify(sheet.need));
    await shot('sheet_locked_390');

    const fx = await evalJs(`(() => {
      const p=G.st.plots.find(q=>q.zone==='field');
      p.owned=true; p.strain='northern-lights'; p.prog=0.2; p.water=1; p.food=0; p.q=1; p.pest=null;
      ['led','air','hvac','fert','co2','solar'].forEach(k=>G.st.upg[k]=0);
      const g0=G.growRate(p), q0=G.quality(p), y0=G.yieldMult(p), m0=G.pestRisk(p).mold;
      G.st.upg.led=1; const gLed=G.growRate(p)/g0; G.st.upg.led=0;
      G.st.upg.co2=1; const gCo2=G.growRate(p)/g0; G.st.upg.co2=0;
      G.st.upg.solar=1; const gSun=G.growRate(p)/g0; G.st.upg.solar=0;
      G.st.upg.hvac=1; G.st.upg.air=1; const q1=G.quality(p)-q0; const m1=G.pestRisk(p).mold/m0;
      G.st.upg.hvac=0; G.st.upg.air=0;
      G.st.upg.fert=1; const y1=G.yieldMult(p)/y0;
      const bench=G.st.plots.find(q=>q.zone==='in');
      bench.strain='northern-lights'; bench.prog=0.2; bench.water=1; bench.food=1; bench.q=1; bench.pest=null;
      const b0=G.growRate(bench); G.st.upg.led=1; const bLed=G.growRate(bench)/b0; G.st.upg.led=0;
      bench.strain=null; p.strain=null;
      const blocked=!G.buyUpg('led') && !G.buyUpg('air') && G.upgBlock('led');
      G.st.land=true;
      const open=G.buyUpg('air') && G.lv('air')===1 && !G.upgBlock('led');
      return { gLed, gCo2, gSun, q1, m1, y1, bLed, blocked, open, errs:(window.__errs||[]).slice(0,4) };
    })()`);
    console.log('fx', JSON.stringify(fx));
    assert(!(fx.errs && fx.errs.length), 'console errors in effects ' + JSON.stringify(fx.errs));
    assert(Math.abs(fx.gLed - 1.15) < 0.001, 'lights are not +15% on facility plots ' + fx.gLed);
    assert(Math.abs(fx.gCo2 - 1.2) < 0.001, 'CO2 is not +20% on facility plots ' + fx.gCo2);
    assert(Math.abs(fx.gSun - 1.06) < 0.001, 'an owned solar roof stopped helping ' + fx.gSun);
    assert(Math.abs(fx.q1 - 0.09) < 0.001, 'climate and airflow quality is ' + fx.q1);
    assert(Math.abs(fx.m1 - 0.78 * 0.75) < 0.001, 'mold reduction is ' + fx.m1);
    assert(Math.abs(fx.y1 - 1.1) < 0.001, 'nutrient yield is ' + fx.y1);
    assert(Math.abs(fx.bLed - 1.15) < 0.001, 'lights skipped the sealed benches ' + fx.bLed);
    assert(fx.blocked === 'Unlock the Indoor Facility first' && fx.open === true, 'lock or buy failed ' + JSON.stringify(fx));

    function scene(field){
      return `(() => {
        G.st.land=true; G.st.field=${field}; G.syncPlots();
        G.st.upg.led=2; G.st.upg.air=1; G.st.upg.hvac=1; G.st.upg.fert=1; G.st.upg.co2=1; G.st.upg.solar=0;
        G.setRoom('facility');
        const goal=document.getElementById('goal'); if(goal) goal.classList.remove('open');
        if(window.R&&R.resize) R.resize();
        R.frame(0.05);
        const L=R.bedLayout();
        const cr=document.getElementById('game').getBoundingClientRect();
        const pots=G.st.plots.filter(p=>p.zone==='field'&&p.owned).map(p=>{
          const r=R.plotRect(p); if(!r) return null;
          return {x:r.left-cr.left,y:r.top-cr.top,w:r.right-r.left,h:r.bottom-r.top};
        }).filter(Boolean);
        const bar=document.getElementById('toolbar').getBoundingClientRect();
        const hud=document.getElementById('hud').getBoundingClientRect();
        return { gear:L.gear, light:L.light, pots, n:pots.length, bar:bar.top-cr.top, hud:hud.bottom-cr.top, errs:(window.__errs||[]).slice(0,4) };
      })()`;
    }
    const few = await evalJs(scene(0));
    await shot('room_spots_390');
    const many = await evalJs(scene(3));
    console.log('spots', JSON.stringify({ few: few.gear, many: many.gear, n:[few.n, many.n], light: many.light }));
    assert(!(few.errs && few.errs.length) && !(many.errs && many.errs.length), 'console errors in the room');
    assert(few.n > 0 && many.n > few.n, 'plot counts did not grow ' + few.n + ' ' + many.n);
    assert(few.gear && few.gear.length === 5 && many.gear.length === 5, 'missing wall spots ' + JSON.stringify(few.gear));
    const keys = ['led','air','hvac','fert','co2'];
    keys.forEach(k => {
      const a = few.gear.find(g => g.k === k), b = many.gear.find(g => g.k === k);
      assert(a && b, 'missing spot ' + k);
      assert(a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h, k + ' moved when pots were added ' + JSON.stringify(a) + ' ' + JSON.stringify(b));
    });
    function clearOf(tag, pack){
      const light = { x: pack.light.x, y: pack.light.y, w: pack.light.w, h: pack.light.h };
      pack.gear.forEach(g => {
        assert(g.y >= light.y + light.h - 0.5, tag + ' ' + g.k + ' covers the ceiling light');
        assert(g.y + g.h <= pack.bar - 2, tag + ' ' + g.k + ' covers the bottom row');
        assert(!overlaps(g, light), tag + ' ' + g.k + ' intersects the light');
        pack.pots.forEach(p => { assert(!overlaps(g, p), tag + ' ' + g.k + ' covers a pot ' + JSON.stringify(g) + ' ' + JSON.stringify(p)); });
      });
      for (let i = 0; i < pack.gear.length; i++) for (let j = i + 1; j < pack.gear.length; j++){
        assert(!overlaps(pack.gear[i], pack.gear[j]), tag + ' spots overlap ' + pack.gear[i].k + ' ' + pack.gear[j].k);
      }
    }
    clearOf('10 plots', few);
    clearOf('40 plots', many);
    assert(many.light && many.light.kind === 'led', 'indoor ceiling light changed ' + JSON.stringify(many.light));

    await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
    await sleep(250);
    const few320 = await evalJs(scene(0));
    const many320 = await evalJs(scene(3));
    console.log('spots320', JSON.stringify({ few: few320.gear, many: many320.gear, n:[few320.n, many320.n] }));
    assert(!(few320.errs && few320.errs.length) && !(many320.errs && many320.errs.length), 'console errors at 320');
    keys.forEach(k => {
      const a = few320.gear.find(g => g.k === k), b = many320.gear.find(g => g.k === k);
      assert(a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h, '320 ' + k + ' moved when pots were added');
    });
    clearOf('320 10 plots', few320);
    clearOf('320 40 plots', many320);
    await shot('room_spots_320');

    const bare = await evalJs(`(() => {
      G.st.land=false; G.syncPlots(); G.setRoom('facility'); R.frame(0.05);
      const L=R.bedLayout();
      G.st.land=true; G.st.ghBuilt=true; G.syncPlots(); G.setRoom('gh'); R.frame(0.05);
      const gh=R.bedLayout();
      UI.open('upgrades','gh');
      const day=/no grow-light upgrade/i.test(document.getElementById('sheetBody').innerText);
      return { build:!!L.build, light:L.light, gear:L.gear, ghKind:gh.light&&gh.light.kind, ghGear:(gh.gear||[]).length, day };
    })()`);
    assert(bare.build && !bare.light && (!bare.gear || !bare.gear.length), 'an unbuilt facility shows gear ' + JSON.stringify(bare));
    assert(bare.ghKind === 'day' && bare.ghGear === 0 && bare.day === true, 'greenhouse picked up indoor spots or a grow-light upgrade ' + JSON.stringify(bare));

    const migrated = await evalJs(`(() => {
      G.st.land=true; G.st.inBuilt=false;
      G.st.upg.led=4; G.st.upg.hvac=3; G.st.upg.solar=2; G.st.upg.veg=1; G.st.upg.clone=1; G.st.upg.dryroom=1; G.st.upg.co2=1; G.st.upg.fert=1;
      G.st.inGear=0;
      G.save();
      G.load();
      const keptLv={ led:G.lv('led'), hvac:G.lv('hvac'), solar:G.lv('solar'), veg:G.lv('veg'), clone:G.lv('clone'), dry:G.lv('dryroom'), co2:G.lv('co2'), fert:G.lv('fert'), inGear:G.st.inGear };
      const buyLed=G.buyUpg('led');
      const buyHvac=G.buyUpg('hvac');
      UI.open('upgrades','facility');
      const text=document.getElementById('sheetBody').innerText;
      const keys=[...document.querySelectorAll('#sheetBody [data-uk]')].map(el=>el.getAttribute('data-uk'));
      const p=G.st.plots.find(q=>q.zone==='in');
      p.strain='northern-lights'; p.prog=0.2; p.water=1; p.food=1; p.q=1; p.pest=null;
      const ownedLed=G.lv('led'), ownedSun=G.lv('solar'), ownedCo2=G.lv('co2');
      G.st.upg.led=0; G.st.upg.solar=0; G.st.upg.co2=0;
      const base=G.growRate(p);
      G.st.upg.led=ownedLed; G.st.upg.solar=ownedSun; G.st.upg.co2=ownedCo2;
      const grew=G.growRate(p)/base;
      p.strain=null;
      return Object.assign(keptLv, {
        buyLed, buyHvac, ledNow:G.lv('led'), hvacNow:G.lv('hvac'), grew,
        kept:/already on this farm/i.test(text) && keys.indexOf('solar')>=0 && keys.indexOf('veg')>=0 && keys.indexOf('clone')>=0 && keys.indexOf('dryroom')>=0,
        errs:(window.__errs||[]).slice(0,6)
      });
    })()`);
    console.log('migrated', JSON.stringify(migrated));
    assert(!(migrated.errs && migrated.errs.length), 'console errors after load ' + JSON.stringify(migrated.errs));
    assert(migrated.led === 4 && migrated.hvac === 3 && migrated.solar === 2 && migrated.veg === 1 && migrated.clone === 1 && migrated.dry === 1 && migrated.co2 === 1 && migrated.fert === 1, 'owned indoor levels were wiped ' + JSON.stringify(migrated));
    assert(migrated.inGear === 1 && migrated.buyLed === false && migrated.buyHvac === false && migrated.ledNow === 4 && migrated.hvacNow === 3, 'migration clamped or rebought a capped upgrade ' + JSON.stringify(migrated));
    assert(Math.abs(migrated.grew - (1 + 0.15 * 4) * (1 + 0.2 * 1) * (1 + 0.06 * 2)) < 0.002, 'old light, CO2 and solar bonuses did not all apply ' + migrated.grew);
    assert(migrated.kept, 'owned retired gear disappeared from the sheet');
    await shot('sheet_owned_390');

    if (!process.exitCode) console.log('indoor gear checks passed');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
