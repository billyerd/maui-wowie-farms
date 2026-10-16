/* Top bar stays inside the notch and the side insets.
   One control size. $100M and a long gem count do not push icons off screen.
   Run: node tests/hud-fit-check.js
   Screenshots land in /tmp/hud-shots (not part of the repo). */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.HUD_CHROME_PORT || '9372';
const ORIGIN = process.env.HUD_ORIGIN || 'http://127.0.0.1:8765';
const SHOTS = process.env.HUD_SHOTS || '/tmp/hud-shots';

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

async function runAppMode(measureSrc, check){
  const port = '9374';
  const profile = '/tmp/chrome-hudapp-' + port;
  fs.rmSync(profile, { recursive: true, force: true });
  const url = ORIGIN + '/index.html?test=lv10&reset=1&hudapp=1';
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile,
    '--app=' + url
  ], { stdio: 'ignore' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try {
    for (let i = 0; i < 40; i++){
      try { await get('http://127.0.0.1:' + port + '/json/version'); break; }
      catch (e){ if (i === 39) throw new Error('app-mode Chrome did not open'); await sleep(250); }
    }
    const tabs = JSON.parse((await get('http://127.0.0.1:' + port + '/json')).body);
    const page = tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!page) throw new Error('no app-mode page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let seq = 0;
    const pending = new Map();
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)){
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) reject(new Error(m.error.message || JSON.stringify(m.error)));
        else resolve(m.result);
      }
    });
    await new Promise(res => ws.addEventListener('open', res, { once: true }));
    function cdp(method, params){
      const id = ++seq;
      ws.send(JSON.stringify({ id, method, params: params || {} }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    }
    async function evalJs(expression){
      const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 1600));
      return r.result && r.result.value;
    }
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source:
`window.__errs=[];
window.addEventListener('error', e => window.__errs.push(String(e.message||e.error||e)));
localStorage.setItem('mwfarms_age_ok','1');
localStorage.setItem('mwfarms_ad_consent_v1','contextual');` });
    await cdp('Page.navigate', { url: url });
    await sleep(1400);
    await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
    await sleep(500);
    await evalJs(`(() => {
      const skip=document.querySelector('#tutc [data-a="skip"]'); if(skip) skip.click();
      if(window.G){ G.st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0}; G.st.gems=888888888; G.st.cash=100000000; }
      const card=document.getElementById('tutc'); if(card) card.classList.add('hidden');
      const modal=document.getElementById('modal'); if(modal) modal.classList.add('hidden');
      return true;
    })()`);
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
    assert(css.includes('(display-mode:standalone),(display-mode:fullscreen)'), 'standalone and fullscreen do not share a safe-area rule');
    assert(css.includes('env(safe-area-inset-top, 0px)'), 'top inset is not read from env()');

    async function scene(name, w, h, opt){
      await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await cdp('Emulation.setSafeAreaInsetsOverride', { insets: { top: opt.sat || 0, left: opt.sal || 0, bottom: opt.sab || 0, right: opt.sar || 0 } });
      await evalJs(`(() => { if(window.G){ G.st.cash=100000000; G.st.gems=888888888; } return true; })()`);
      await sleep(300);
      const m = await evalJs(measureSrc);
      const topH = Math.min(m.h, Math.max(150, Math.ceil((m.hud && m.hud.b) || 80) + 70));
      const raw = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: m.w, height: topH, scale: 2 }, captureBeyondViewport: false });
      fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(raw.data, 'base64'));
      check(name, m, Object.assign({ standalone: true }, opt));
    }
    await scene('hud_390_standalone', 390, 844, { sat: 59 });
    await scene('hud_320_standalone', 320, 568, { sat: 47 });
    ws.close();
  } finally {
    chrome.kill();
  }
}

async function main(){
  let serverUp = false;
  try { const r = await get(ORIGIN + '/index.html'); serverUp = r.status === 200; } catch (e){ serverUp = false; }
  if (!serverUp){ fail('static server is not serving ' + ORIGIN); return; }

  fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });
  const profile = '/tmp/chrome-hudfit-' + PORT;
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
    const pending = new Map();
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)){
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) reject(new Error(m.error.message || JSON.stringify(m.error)));
        else resolve(m.result);
      }
    });
    await new Promise(res => ws.addEventListener('open', res, { once: true }));
    function cdp(method, params){
      const id = ++seq;
      ws.send(JSON.stringify({ id, method, params: params || {} }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
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
localStorage.setItem('mwfarms_ad_consent_v1','contextual');
localStorage.removeItem('mwfarms_save_v1');
localStorage.removeItem('mwfarms_test_v1');` });

    async function safeArea(top, left, right, bottom){
      const insets = { top: top|0, left: left|0, bottom: bottom|0, right: right|0 };
      try {
        await cdp('Emulation.setSafeAreaInsetsOverride', { insets });
      } catch (e){
        await cdp('Emulation.setSafeAreaInsetsOverride', insets);
      }
    }
    async function displayMode(mode){
      await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: mode }] });
    }

    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await safeArea(0, 0, 0, 0);
    await displayMode('browser');
    await cdp('Page.navigate', { url: ORIGIN + '/index.html?test=lv10&reset=1&hudfit=1' });
    await sleep(1400);
    await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
    await sleep(500);
    await evalJs(`(() => {
      const skip=document.querySelector('#tutc [data-a="skip"]'); if(skip) skip.click();
      if(window.G){
        G.st.tut={v:1,step:0,on:false,done:true,skip:true,bought:0};
        G.st.gems=888888888;
      }
      const card=document.getElementById('tutc'); if(card) card.classList.add('hidden');
      const modal=document.getElementById('modal'); if(modal) modal.classList.add('hidden');
      const g=document.getElementById('goal'); if(g) g.classList.remove('open');
      const pick=document.getElementById('locPick'); if(pick) pick.classList.add('hidden');
      return true;
    })()`);

    const measureSrc = `(() => new Promise(resolve => {
      const wantCash = '$100M';
      const wantGems = (window.G && G.num) ? G.num(G.st.gems) : '';
      const t0 = Date.now();
      (function poll(){
        const cashEl = document.getElementById('cash');
        const gemEl = document.getElementById('gems');
        const cashTxt = cashEl ? cashEl.textContent : '';
        const gemTxt = gemEl ? gemEl.textContent : '';
        if ((cashTxt !== wantCash || gemTxt !== wantGems) && Date.now() - t0 < 2500){
          requestAnimationFrame(poll); return;
        }
        const g = document.getElementById('goal'); if (g) g.classList.remove('open');
        function envPad(side){
          const d = document.createElement('div');
          d.style.cssText = 'position:absolute;visibility:hidden;padding-' + side + ':env(safe-area-inset-' + side + ', 0px)';
          document.body.appendChild(d);
          const v = parseFloat(getComputedStyle(d).getPropertyValue('padding-' + side)) || 0;
          d.remove();
          return v;
        }
        function pack(el){
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return {
            x: +r.left.toFixed(2), y: +r.top.toFixed(2), r: +r.right.toFixed(2), b: +r.bottom.toFixed(2),
            w: +r.width.toFixed(2), h: +r.height.toFixed(2),
            sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight,
            ov: s.overflow + '/' + s.overflowX, text: (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 48)
          };
        }
        const hud = document.getElementById('hud');
        const hs = getComputedStyle(hud);
        const names = ['goal','lvlBox','cashPill','gemPill','shopBtn','settingsBtn'];
        const nodes = {};
        names.forEach(id => { nodes[id] = pack(document.getElementById(id)); });
        const gear = document.querySelector('#settingsBtn .ico');
        const shopIco = document.querySelector('#shopBtn .ico');
        const coin = document.querySelector('#cashPill .ico');
        const gemIco = document.querySelector('#gemPill .ico');
        const gport = document.querySelector('#goal .gport');
        const lvl = document.getElementById('lvl');
        const label = document.querySelector('#shopBtn .shop-label');
        resolve({
          w: innerWidth, h: innerHeight,
          sat: envPad('top'), sal: envPad('left'), sar: envPad('right'), sab: envPad('bottom'),
          pad: hs.paddingTop + ' ' + hs.paddingRight + ' ' + hs.paddingBottom + ' ' + hs.paddingLeft,
          padT: parseFloat(hs.paddingTop)||0, padR: parseFloat(hs.paddingRight)||0, padB: parseFloat(hs.paddingBottom)||0, padL: parseFloat(hs.paddingLeft)||0,
          hudOv: hs.overflow, wrap: hs.flexWrap,
          hud: pack(hud),
          nodes: nodes,
          gear: pack(gear), shopIco: pack(shopIco), coin: pack(coin), gemIco: pack(gemIco),
          gport: pack(gport), lvl: pack(lvl),
          cashTxt: cashTxt, gemTxt: gemTxt,
          label: label ? getComputedStyle(label).display : 'missing',
          standalone: matchMedia('(display-mode: standalone)').matches,
          fullscreen: matchMedia('(display-mode: fullscreen)').matches,
          errs: (window.__errs||[]).slice(0, 6)
        });
      })();
    }))()`;

    function inside(child, parent, tag, name){
      if (!child || !parent){ assert(false, tag + ' missing ' + name); return; }
      assert(child.x >= parent.x - 0.6 && child.y >= parent.y - 0.6 && child.r <= parent.r + 0.6 && child.b <= parent.b + 0.6,
        tag + ' ' + name + ' is cropped by its control ' + JSON.stringify({ child, parent }));
      assert(child.w >= 14 && child.h >= 14, tag + ' ' + name + ' icon is too small ' + JSON.stringify(child));
    }

    function check(tag, m, opt){
      opt = opt || {};
      console.log(tag, JSON.stringify({
        pad: m.pad, sat: m.sat, sal: m.sal, sar: m.sar, cash: m.cashTxt, gems: m.gemTxt, label: m.label,
        mode: { standalone: m.standalone, fullscreen: m.fullscreen },
        nodes: m.nodes, hud: m.hud && { x: m.hud.x, y: m.hud.y, r: m.hud.r, b: m.hud.b, ov: m.hudOv, wrap: m.wrap }
      }));
      assert(!(m.errs && m.errs.length), tag + ' console errors ' + JSON.stringify(m.errs));
      assert(m.cashTxt === '$100M', tag + ' cash label ' + m.cashTxt);
      assert(m.gemTxt && m.gemTxt.length >= 4, tag + ' gem label ' + m.gemTxt);
      assert(m.wrap === 'nowrap', tag + ' bar wrapped');
      assert(m.hudOv === 'visible', tag + ' hud overflow ' + m.hudOv);
      assert(m.sat >= (opt.sat || 0) - 1, tag + ' env(safe-area-inset-top) is ' + m.sat + ' wanted ' + (opt.sat || 0));
      assert(m.sal >= (opt.sal || 0) - 1, tag + ' env left is ' + m.sal);
      assert(m.sar >= (opt.sar || 0) - 1, tag + ' env right is ' + m.sar);
      assert(m.padT >= m.sat + 4, tag + ' padding-top ' + m.padT + ' does not clear inset ' + m.sat);
      assert(m.padL >= m.sal + 4, tag + ' padding-left ' + m.padL + ' ignores inset ' + m.sal);
      assert(m.padR >= m.sar + 4, tag + ' padding-right ' + m.padR + ' ignores inset ' + m.sar);
      assert(m.hud && m.hud.x >= -0.5 && m.hud.y >= -0.5 && m.hud.r <= m.w + 0.5 && m.hud.b <= m.h + 0.5, tag + ' hud outside the screen');
      const order = ['goal','lvlBox','cashPill','gemPill','shopBtn','settingsBtn'];
      let prev = null;
      const heights = [];
      order.forEach(id => {
        const n = m.nodes[id];
        assert(n && n.w > 8 && n.h > 8, tag + ' ' + id + ' missing ' + JSON.stringify(n));
        assert(n.x >= m.sal - 0.6, tag + ' ' + id + ' is under the left inset ' + JSON.stringify(n) + ' sal ' + m.sal);
        assert(n.r <= m.w - m.sar + 0.6, tag + ' ' + id + ' is under the right inset ' + JSON.stringify(n) + ' sar ' + m.sar + ' w ' + m.w);
        assert(n.y >= m.sat - 0.6, tag + ' ' + id + ' is under the notch ' + JSON.stringify(n) + ' sat ' + m.sat);
        assert(n.b <= m.h + 0.6, tag + ' ' + id + ' runs off the bottom');
        assert(n.b <= m.hud.b + 0.6, tag + ' ' + id + ' sticks out of the bar');
        if (prev) assert(n.x >= prev.r - 0.6, tag + ' ' + id + ' overlaps ' + JSON.stringify({ prev, n }));
        prev = n;
        heights.push(n.h);
      });
      heights.forEach(h => assert(Math.abs(h - heights[0]) <= 1.25, tag + ' control heights differ ' + heights.join(',')));
      ['goal','lvlBox','settingsBtn'].forEach(id => {
        const n = m.nodes[id];
        assert(Math.abs(n.w - 36) <= 1.25 && Math.abs(n.h - 36) <= 1.25, tag + ' ' + id + ' size ' + n.w + 'x' + n.h);
      });
      const shop = m.nodes.shopBtn;
      // A flex item's display:inline computes to block. Hidden is the failure.
      if (m.w < 400){
        assert(m.label === 'none', tag + ' shop label is showing on a narrow phone');
        assert(Math.abs(shop.w - 36) <= 1.25, tag + ' shop is not a circle ' + shop.w);
      } else {
        assert(m.label !== 'none', tag + ' shop label hidden on a wide phone');
        assert(shop.w > 40, tag + ' shop label has no width');
      }
      inside(m.gear, m.nodes.settingsBtn, tag, 'gear');
      inside(m.shopIco, m.nodes.shopBtn, tag, 'shop gem');
      inside(m.coin, m.nodes.cashPill, tag, 'coin');
      inside(m.gemIco, m.nodes.gemPill, tag, 'gem');
      inside(m.gport, m.nodes.goal, tag, 'portrait');
      inside(m.lvl, m.nodes.lvlBox, tag, 'level number');
      assert(m.gport && Math.abs(m.gport.w - m.nodes.goal.w) <= 1.25 && Math.abs(m.gport.h - m.nodes.goal.h) <= 1.25,
        tag + ' portrait is cropped inside the circle ' + JSON.stringify({ gport: m.gport, goal: m.nodes.goal }));
      const cash = m.nodes.cashPill, gems = m.nodes.gemPill;
      const cashFull = m.cashTxt === '$100M' && cash.sw <= cash.cw + 1;
      const gemFull = gems.sw <= gems.cw + 1;
      if (!opt.allowEllipsis){
        assert(cashFull, tag + ' cash text is cut ' + JSON.stringify({ text: m.cashTxt, sw: cash.sw, cw: cash.cw, w: cash.w }));
        assert(gemFull, tag + ' gem text is cut ' + JSON.stringify({ text: m.gemTxt, sw: gems.sw, cw: gems.cw, w: gems.w }));
      }
      if (opt.standalone) assert(m.standalone, tag + ' display-mode is not standalone');
      if (opt.fullscreen) assert(m.fullscreen, tag + ' display-mode is not fullscreen');
    }

    async function shot(name, m){
      const topH = Math.min(m.h, Math.max(150, Math.ceil((m.hud && m.hud.b) || 80) + 70));
      const raw = await cdp('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width: m.w, height: topH, scale: 2 },
        captureBeyondViewport: false
      });
      fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(raw.data, 'base64'));
    }

    async function scene(name, w, h, opt){
      opt = opt || {};
      await cdp('Emulation.setDeviceMetricsOverride', {
        width: w, height: h, deviceScaleFactor: 2, mobile: true
      });
      await safeArea(opt.sat || 0, opt.sal || 0, opt.sar || 0, opt.sab || 0);
      await displayMode(opt.mode || 'browser');
      await evalJs(`(() => { if(window.G){ G.st.cash=100000000; G.st.gems=${opt.gems == null ? 888888888 : opt.gems}; } const g=document.getElementById('goal'); if(g) g.classList.remove('open'); return true; })()`);
      await sleep(280);
      const m = await evalJs(measureSrc);
      await shot(name, m);
      check(name, m, opt);
      return m;
    }

    await scene('hud_320x568', 320, 568, { sat: 0 });
    await scene('hud_360x640', 360, 640, { sat: 0 });
    await scene('hud_390x844', 390, 844, { sat: 0 });
    await scene('hud_430x932', 430, 932, { sat: 0 });
    await scene('hud_320_notch47', 320, 568, { sat: 47 });
    await scene('hud_390_notch59', 390, 844, { sat: 59 });
    await scene('hud_430_notch59', 430, 932, { sat: 59 });
    await scene('hud_390_side16', 390, 844, { sat: 59, sal: 16, sar: 16 });
    await scene('hud_320_long_gems', 320, 568, { sat: 47, gems: 99950 });
    await scene('hud_430_side16', 430, 932, { sat: 59, sal: 16, sar: 16 });

    if (!process.exitCode) console.log('browser hud fit checks passed');
    await runAppMode(measureSrc, check);
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
