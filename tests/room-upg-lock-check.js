/* Greenhouse and Indoor Facility upgrades stay locked until that room is built.
   buyUpg rejects them, and the Upgrades sheet shows the requirement.
   Garage gear stays buyable. Owned levels on an old save are kept.
   Run: node tests/room-upg-lock-check.js */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = process.env.UPG_CHROME_PORT || '9368';
const ORIGIN = process.env.UPG_ORIGIN || 'http://127.0.0.1:8765';

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

  const profile = '/tmp/chrome-upglock-' + PORT;
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
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source:
`window.__errs=[];
window.addEventListener('error', e => window.__errs.push(String(e.message||e.error||e)));
localStorage.setItem('mwfarms_age_ok','1');
localStorage.setItem('mwfarms_ad_consent_v1','contextual');
localStorage.removeItem('mwfarms_save_v1');
localStorage.removeItem('mwfarms_test_v1');` });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp('Page.navigate', { url: ORIGIN + '/index.html?upglock=1' });
    await sleep(1300);
    await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
    await sleep(400);
    await evalJs(`(() => {
      const skip=document.querySelector('#tutc [data-a="skip"]'); if(skip) skip.click();
      G.st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0};
      const card=document.getElementById('tutc'); if(card) card.classList.add('hidden');
      G.st.level=10; G.st.cash=900000; G.st.ghBuilt=false; G.st.land=false; G.st.inBuilt=false;
      return true;
    })()`);

    const card = `(k) => {
      const el=document.querySelector('#sheetBody [data-uk="'+k+'"]');
      if(!el) return null;
      const btn=el.querySelector('button');
      return { cls: el.className, disabled: btn ? !!btn.disabled : null, text: btn ? btn.textContent.replace(/\\s+/g,' ').trim() : '' };
    }`;

    function checkLocked(tag, row, phrase){
      console.log(tag, JSON.stringify(row));
      assert(row, tag + ' card is missing');
      assert(row.cls.indexOf('locked') >= 0 && row.cls.indexOf('canbuy') < 0, tag + ' is shown as available ' + JSON.stringify(row));
      assert(row.disabled === true, tag + ' button is purchasable ' + JSON.stringify(row));
      assert(row.text.indexOf(phrase) >= 0, tag + ' lock text is ' + JSON.stringify(row) + ' expected ' + phrase);
    }

    const locked = await evalJs(`(() => {
      const card=${card};
      const cash=G.st.cash;
      const gh=['shade','cooler','lightdep','supp'];
      const fac=['beds','catch','shutters','led','hvac','co2','fert','veg','clone','dryroom','solar'];
      UI.open('upgrades','garage');
      const fanBefore=card('fan');
      const bought={};
      gh.concat(fac).forEach(k=>{ bought[k]=G.buyUpg(k); });
      const garage=G.buyUpg('fan');
      UI.open('upgrades','garage');
      const fan=card('fan');
      UI.open('upgrades','gh');
      const ghCards={ shade:card('shade'), cooler:card('cooler'), beds:card('beds'), catch:card('catch'), shutters:card('shutters') };
      UI.open('upgrades','facility');
      const facCards={ beds:card('beds'), led:card('led'), hvac:card('hvac'), solar:card('solar') };
      UI.open('upgrades','lines');
      const hose=card('water');
      return { bought, garage, fanBefore, fan, ghCards, facCards, hose, cash:G.st.cash, start:cash, lvFan:G.lv('fan'), errs:(window.__errs||[]).slice(0,4) };
    })()`);
    console.log('locked', JSON.stringify(locked));
    assert(!(locked.errs && locked.errs.length), 'console errors ' + JSON.stringify(locked.errs));
    ['shade','cooler','lightdep','supp','beds','catch','shutters','led','hvac','co2','fert','veg','clone','dryroom','solar'].forEach(k=>{
      assert(locked.bought[k] === false, k + ' was purchased before its room ' + locked.bought[k]);
    });
    assert(locked.cash === locked.start - 180, 'rejected buys changed cash or the garage fan did not spend 180 ' + locked.cash);
    assert(locked.fanBefore && locked.fanBefore.cls.indexOf('canbuy') >= 0 && locked.fanBefore.disabled === false, 'garage fan started locked ' + JSON.stringify(locked.fanBefore));
    assert(locked.garage === true && locked.lvFan === 1, 'garage fan was not buyable');
    assert(locked.fan && locked.fan.cls.indexOf('owned') >= 0, 'garage fan card did not update ' + JSON.stringify(locked.fan));
    checkLocked('gh/shade', locked.ghCards.shade, 'Unlock the Greenhouse first');
    checkLocked('gh/cooler', locked.ghCards.cooler, 'Unlock the Greenhouse first');
    checkLocked('gh/beds', locked.ghCards.beds, 'Unlock the Indoor Facility first');
    checkLocked('gh/catch', locked.ghCards.catch, 'Unlock the Indoor Facility first');
    checkLocked('gh/shutters', locked.ghCards.shutters, 'Unlock the Indoor Facility first');
    checkLocked('fac/beds', locked.facCards.beds, 'Unlock the Indoor Facility first');
    checkLocked('fac/led', locked.facCards.led, 'Unlock the Indoor Facility first');
    checkLocked('fac/hvac', locked.facCards.hvac, 'Unlock the Indoor Facility first');
    checkLocked('fac/solar', locked.facCards.solar, 'Unlock the Indoor Facility first');
    assert(locked.hose && locked.hose.disabled === false && locked.hose.cls.indexOf('canbuy') >= 0, 'water gear was locked ' + JSON.stringify(locked.hose));

    const built = await evalJs(`(() => {
      const card=${card};
      G.st.upg.lightdep=1; G.st.ghBuilt=false;
      const kept=!G.buyUpg('lightdep') && G.lv('lightdep')===1;
      G.st.ghBuilt=true;
      const keptNext=G.buyUpg('lightdep') && G.lv('lightdep')===2;
      G.st.upg.shade=0;
      UI.open('upgrades','gh');
      const shade=card('shade');
      const bought=G.buyUpg('shade');
      UI.open('upgrades','gh');
      const shadeAfter=card('shade');
      const bedsBlocked=!G.buyUpg('beds') && G.upgBlock('beds');
      G.st.land=true;
      UI.open('upgrades','facility');
      const beds=card('beds');
      const led=card('led');
      const bedsBuy=G.buyUpg('beds');
      const ledBuy=G.buyUpg('led');
      G.st.upg.led=2; G.st.inBuilt=false;
      const keptLed=G.lv('led')===2 && !G.buyUpg('led');
      G.st.inBuilt=true;
      const ledNext=G.buyUpg('led');
      UI.open('upgrades','garage');
      const light=card('light');
      const lightBuy=G.buyUpg('light');
      return { kept, keptNext, shade, bought, shadeLv:G.lv('shade'), shadeAfter, bedsBlocked, beds, led, bedsBuy, ledBuy, keptLed, ledLv:G.lv('led'), ledNext, light, lightBuy, errs:(window.__errs||[]).slice(0,4) };
    })()`);
    console.log('built', JSON.stringify(built));
    assert(!(built.errs && built.errs.length), 'console errors after build ' + JSON.stringify(built.errs));
    assert(built.kept && built.keptNext, 'an owned greenhouse upgrade was wiped, or the next level stayed locked after the greenhouse was built');
    assert(built.shade && built.shade.cls.indexOf('canbuy') >= 0 && built.shade.disabled === false, 'shade stayed locked after the greenhouse was built ' + JSON.stringify(built.shade));
    assert(built.bought === true && built.shadeLv === 1, 'shade did not unlock once the greenhouse was built ' + built.shadeLv);
    assert(built.shadeAfter && built.shadeAfter.cls.indexOf('owned') >= 0, 'owned shade did not show as owned');
    assert(built.bedsBlocked === 'Unlock the Indoor Facility first', 'beds block is ' + built.bedsBlocked);
    checkLocked('fac/led after land', built.led, 'Unlock the sealed benches first');
    assert(built.beds && built.beds.cls.indexOf('canbuy') >= 0 && built.bedsBuy === true, 'facility beds did not unlock with the Indoor Facility ' + JSON.stringify(built.beds));
    assert(built.ledBuy === false && built.keptLed, 'sealed gear was bought before the benches, or an owned level was wiped');
    assert(built.ledNext === true && built.ledLv === 3, 'sealed gear did not unlock once the benches were built ' + built.ledLv);
    assert(built.light && built.light.cls.indexOf('canbuy') >= 0 && built.lightBuy === true, 'garage lights were locked ' + JSON.stringify(built.light));

    if (!process.exitCode) console.log('room upgrade lock checks passed');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
