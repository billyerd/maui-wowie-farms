/* A festival and a sale must not show a pink banner, chip, or announcement toast.
   The Story card still carries the festival. The Market and the shop still carry the sale.
   Mold still opens an OK card. Run: node tests/pink-banner-check.js */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = process.env.PINK_CHROME_PORT || '9341';
const ORIGIN = process.env.PINK_ORIGIN || 'http://127.0.0.1:8765';

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

  const profile = '/tmp/chrome-pink-' + PORT;
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
localStorage.removeItem('mwfarms_test_v1');` });

    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp('Page.navigate', { url: ORIGIN + '/index.html?pink=1' });
    await sleep(1400);
    await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
    await sleep(600);

    const armed = await evalJs(`(() => {
      const skip=document.querySelector('#tutc [data-a="skip"]'); if(skip) skip.click();
      G.st.level = 8;
      G.st.xp = 0;
      G.st.tut = {v:1,step:0,on:false,done:true,skip:true,bought:0};
      if(G.st.streak){ const d=new Date(); G.st.streak.last=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
      G.setFest('makahiki');
      G.st.market.hot = 'acdc';
      G.st.market.hotT = 90;
      G.st.boosts = {grow:200, price:200, pheno:200};
      G.st.gecko.boost = {k:'price', t:40};
      G.startSeasonEvent();
      G.emit('hot', G.strain('acdc'));
      G.emit('rainbow');
      G.emit('marketday');
      G.st.event.id = 'festival';
      G.st.event.t = 80;
      G.emit('event', G.EVENTS.festival);
      UI.update(0.2);
      const chip=document.getElementById('eventChip');
      if(chip){ chip.textContent='Island Festival · 2x XP'; chip.classList.remove('hidden'); }
      UI.update(0.2);
      return { fest: G.festState() && G.festState().f.name, event: G.st.event.id, hot: G.st.market.hot };
    })()`);
    assert(armed && armed.fest === 'Harvest Festival', 'festival did not arm ' + JSON.stringify(armed));
    await sleep(300);

    const scan = await evalJs(`(() => {
      function shown(el){
        if(!el || !el.isConnected) return false;
        for(let n=el; n && n.nodeType===1; n=n.parentElement){
          const cs=getComputedStyle(n);
          if(cs.display==='none' || cs.visibility==='hidden' || Number(cs.opacity)===0) return false;
          if(n.classList && n.classList.contains('hidden')) return false;
        }
        const r=el.getBoundingClientRect();
        return r.width>2 && r.height>2;
      }
      function pinks(s){
        const out=[]; const re=/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/g; let m;
        while((m=re.exec(String(s)))) out.push([+m[1],+m[2],+m[3]]);
        return out;
      }
      function isPink(c){
        const r=c[0], g=c[1], b=c[2];
        if(r>=190 && b>=120 && g<=180 && r>=g+50 && r>b) return true;
        if(b>=200 && r>=90 && r<=170 && g<=90 && b>r+40) return true;
        return false;
      }
      const hits=[];
      document.querySelectorAll('body *').forEach(el=>{
        if(!shown(el)) return;
        if(el.closest('#toolbar,#hud,#seedBag,#seedPick,#confetti')) return;
        if(el.classList.contains('badge') || el.classList.contains('btn') || el.classList.contains('gchip')) return;
        const cs=getComputedStyle(el);
        const blob=cs.backgroundColor+' '+cs.backgroundImage+' '+cs.borderTopColor+' '+cs.borderRightColor+' '+cs.borderBottomColor+' '+cs.borderLeftColor;
        const pink=pinks(blob).some(isPink);
        const named=el.id==='eventChip' || el.id==='boostHud' || el.classList.contains('bpill') || el.classList.contains('b-pheno') || el.classList.contains('b-price');
        const floating=cs.position==='fixed' || cs.position==='sticky' || el.classList.contains('toast');
        const inSheet=!!el.closest('#sheet,#modal,#celebrate');
        if(named || (pink && floating && !inSheet)) hits.push({id:el.id||'', cls:String(el.className).slice(0,80), text:(el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,90), pink:!!pink});
      });
      const chip=document.getElementById('eventChip');
      const ccs=chip?getComputedStyle(chip):null;
      const toasts=[...document.querySelectorAll('.toast')].filter(shown).map(t=>(t.textContent||'').replace(/\\s+/g,' ').trim());
      return {
        hits, toasts,
        chipText: chip?chip.textContent:'missing',
        chipDisplay: ccs?ccs.display:'missing',
        chipHidden: !!(chip && chip.classList.contains('hidden')),
        errs: (window.__errs||[]).slice(0,8)
      };
    })()`);

    assert(scan && scan.chipDisplay === 'none', 'event chip is displayed ' + JSON.stringify(scan && {chipDisplay:scan.chipDisplay, chipText:scan.chipText, chipHidden:scan.chipHidden}));
    assert(scan.chipHidden && scan.chipText === '', 'event chip still has festival or sale text ' + JSON.stringify(scan.chipText));
    assert(!scan.hits.length, 'pink banner is showing ' + JSON.stringify(scan.hits));
    const announced = (scan.toasts||[]).filter(t => /started!|Tourist rush|Market day|Rainbow!|Island Festival|Harvest Festival|2x sale|Better pheno/i.test(t));
    assert(!announced.length, 'a festival or sale announced itself ' + JSON.stringify(announced) + ' all=' + JSON.stringify(scan.toasts));
    assert(!(scan.errs||[]).length, 'console errors ' + JSON.stringify(scan.errs));

    const panels = await evalJs(`(() => {
      UI.close();
      UI.open('quests','story');
      const story=(document.getElementById('sheetBody')||{}).innerText||'';
      UI.close();
      UI.open('market');
      const market=(document.getElementById('sheetBody')||{}).innerText||'';
      UI.close();
      UI.open('shop','gemstore');
      const shop=(document.getElementById('sheetBody')||{}).innerText||'';
      UI.close();
      UI.toast('Mold spotted on ACDC! Tap it to treat','bad','pest');
      const modal=document.getElementById('modal');
      const pest=modal && !modal.classList.contains('hidden') && /Mold spotted/.test(modal.textContent||'');
      const ok=document.querySelector('#modal .acts .btn'); if(ok) ok.click();
      return {
        storyFest: /Festival now/i.test(story) && /Harvest Festival/i.test(story),
        storyEvent: /Island Festival/i.test(story) && /2x XP/i.test(story),
        market: /Tourist rush/i.test(market) && /ACDC/i.test(market),
        shop: /2x growth/.test(shop) && /2x sale price/.test(shop) && /Better pheno odds/.test(shop),
        pest: !!pest,
        storyTail: story.slice(-280),
        marketHead: market.slice(0,180)
      };
    })()`);
    assert(panels && panels.storyFest, 'Story card lost the festival ' + JSON.stringify(panels && panels.storyTail));
    assert(panels.storyEvent, 'Story card lost the timed event ' + JSON.stringify(panels.storyTail));
    assert(panels.market, 'Market lost the sale ' + JSON.stringify(panels.marketHead));
    assert(panels.shop, 'shop lost the running boosts');
    assert(panels.pest, 'mold pop-up did not open');

    await sleep(200);
    const after = await evalJs(`(() => {
      const chip=document.getElementById('eventChip');
      const modal=document.getElementById('modal');
      const shown=document.querySelectorAll('.toast,.bpill,#boostHud').length;
      const boost=document.getElementById('boostHud');
      const bcs=boost?getComputedStyle(boost).display:'none';
      return { chip: chip?getComputedStyle(chip).display:'missing', boost: bcs, modalHidden: !modal || modal.classList.contains('hidden'), errs:(window.__errs||[]).slice(0,8), nodes: shown };
    })()`);
    assert(after && after.chip === 'none' && after.boost === 'none', 'a banner came back ' + JSON.stringify(after));
    assert(after.modalHidden, 'pest card stayed open');
    assert(!(after.errs||[]).length, 'console errors after panels ' + JSON.stringify(after.errs));

    if (!process.exitCode) console.log('pink banner checks passed');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => { console.error('FAIL', err && err.stack || err); process.exitCode = 1; });
