/* The Seeds tab is gone. The seed bag sits in that slot, opens the picker,
   and the same sheet still sells seeds. The row stays even at 320x568 and 390x844,
   and the plant grid uses the toolbar as its floor (the bag no longer floats above it).
   Run: node tests/seed-row-check.js */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = process.env.SEED_CHROME_PORT || '9352';
const ORIGIN = process.env.SEED_ORIGIN || 'http://127.0.0.1:8765';

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

  const profile = '/tmp/chrome-seedrow-' + PORT;
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

    async function boot(w, h){
      await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await cdp('Page.navigate', { url: ORIGIN + '/index.html?seedrow=' + w + 'x' + h });
      await sleep(1400);
      await evalJs(`(() => { const b=document.getElementById('playBtn'); if(b) b.click(); return true; })()`);
      await sleep(500);
      await evalJs(`(() => {
        const skip=document.querySelector('#tutc [data-a="skip"], #modal [data-a="skip"]');
        if(skip) skip.click();
        G.st.tut = {v:1,step:0,on:false,done:true,skip:true,bought:0};
        const card=document.getElementById('tutc'); if(card) card.classList.add('hidden');
        const modal=document.getElementById('modal'); if(modal) modal.classList.add('hidden');
        UI.close();
        if(window.R&&R.frame) R.frame(0.016);
        return true;
      })()`);
      await sleep(200);
    }

    const measureSrc = `(() => {
      if(window.R&&R.frame) R.frame(0.016);
      const bar = document.getElementById('toolbar').getBoundingClientRect();
      const bagEl = document.getElementById('seedBag');
      const bag = bagEl.getBoundingClientRect();
      const hud = document.getElementById('hud').getBoundingClientRect();
      const goal = document.getElementById('goal');
      const goalR = goal && goal.getClientRects().length ? goal.getBoundingClientRect() : null;
      const pick = document.getElementById('seedPick');
      const items = [...document.querySelectorAll('#toolbar #menu button, #locBtn, #qaFab, #upgBtn, #seedBag')].map(el => {
        const r = el.getBoundingClientRect();
        return { id: el.id || el.getAttribute('data-panel') || 'btn', l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
      }).filter(it => it.w > 1 && it.h > 1).sort((a,b) => a.l - b.l);
      const qBadge = document.getElementById('qBadge');
      if (qBadge) qBadge.textContent = '3';
      const badgeEl = document.getElementById('qBadge');
      const badgeR = badgeEl && badgeEl.getClientRects().length ? badgeEl.getBoundingClientRect() : null;
      const story = document.querySelector('#toolbar [data-panel="quests"]');
      const storyR = story ? story.getBoundingClientRect() : null;
      const nameEl = document.getElementById('sbName');
      const countEl = document.getElementById('sbCount');
      const nameR = nameEl ? nameEl.getBoundingClientRect() : null;
      const countR = countEl ? countEl.getBoundingClientRect() : null;
      const labels = [...document.querySelectorAll('#toolbar #menu button small, #toolbar #locBtn small, #toolbar #upgBtn b, #toolbar #seedBag b, #toolbar #seedBag small')].map(el => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return {
          t: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
          w: +r.width.toFixed(1), h: +r.height.toFixed(1),
          fs: parseFloat(s.fontSize) || 0,
          clip: s.clip, pos: s.position
        };
      });
      const hits = items.map(it => {
        const stack = document.elementsFromPoint((it.l+it.r)/2, (it.t+it.b)/2);
        const top = stack && stack[0];
        const ok = !!(top && (top === document.getElementById(it.id) || (top.closest && top.closest('#' + (document.getElementById(it.id) ? it.id : 'menu')))));
        const owner = top && (top.closest('#toolbar #menu button, #locBtn, #qaFab, #upgBtn, #seedBag'));
        return { id: it.id, hit: top ? (top.id || top.className || top.tagName) : '', owner: owner ? (owner.id || owner.getAttribute('data-panel')) : '' };
      });
      const lay = window.R && R.bedLayout ? R.bedLayout() : null;
      const cv = document.getElementById('game').getBoundingClientRect();
      const H = innerHeight;
      let bandTop = 64;
      if (hud.height > 8 && hud.bottom < H * 0.55) bandTop = Math.max(bandTop, hud.bottom + 4);
      if (goalR && goalR.height > 8 && goalR.bottom < H * 0.55 && getComputedStyle(goal).display !== 'none') bandTop = Math.max(bandTop, goalR.bottom + 4);
      let bandBot = H - 4;
      if (bar.top > H * 0.4) bandBot = Math.min(bandBot, bar.top - 2);
      const gutter = 18;
      const expectH = ((bandBot - cv.top) - bandTop - gutter - 6) / 4;
      const seedsTab = !!document.querySelector('[data-panel="seeds"]');
      const above = document.elementsFromPoint(bar.left + bar.width / 2, Math.max(0, bar.top - 24));
      const aboveHit = above && above[0];
      return {
        w: innerWidth, h: innerHeight, seedsTab,
        parent: bagEl.parentElement && bagEl.parentElement.id,
        bag: { l: bag.left, t: bag.top, r: bag.right, b: bag.bottom, w: bag.width, h: bag.height },
        bar: { l: bar.left, t: bar.top, r: bar.right, b: bar.bottom, h: bar.height },
        hudB: hud.bottom,
        goalB: goalR ? goalR.bottom : 0,
        items, hits, labels,
        bagName: nameEl ? nameEl.textContent : '',
        bagCount: countEl ? countEl.textContent : '',
        nameBox: nameR ? { w: +nameR.width.toFixed(1), h: +nameR.height.toFixed(1), l: +nameR.left.toFixed(1), r: +nameR.right.toFixed(1) } : null,
        countBox: countR ? { w: +countR.width.toFixed(1), h: +countR.height.toFixed(1) } : null,
        badge: badgeR ? { l: +badgeR.left.toFixed(1), t: +badgeR.top.toFixed(1), r: +badgeR.right.toFixed(1), b: +badgeR.bottom.toFixed(1), w: +badgeR.width.toFixed(1), h: +badgeR.height.toFixed(1) } : null,
        story: storyR ? { l: +storyR.left.toFixed(1), t: +storyR.top.toFixed(1), r: +storyR.right.toFixed(1), b: +storyR.bottom.toFixed(1) } : null,
        cellH: lay && lay.cell ? lay.cell.h : 0,
        expectH,
        n: lay ? lay.n : 0,
        pickHidden: !pick || pick.classList.contains('hidden'),
        above: aboveHit ? (aboveHit.id || aboveHit.className || aboveHit.tagName) : '',
        quest: (G.curQuest() || {}).t || '',
        errs: (window.__errs || []).slice(0, 6)
      };
    })()`;

    function checkLayout(tag, m){
      console.log(tag, JSON.stringify({
        items: m.items.map(it => it.id + ':' + Math.round(it.w) + 'x' + Math.round(it.h)),
        barH: Math.round(m.bar.h), cellH: +m.cellH.toFixed(1), expectH: +m.expectH.toFixed(1), bagParent: m.parent
      }));
      assert(!m.seedsTab, tag + ' still has a Seeds tab');
      assert(m.parent === 'toolbar', tag + ' seed bag is not in the toolbar');
      assert(m.bag.t >= m.bar.t - 1 && m.bag.b <= m.bar.b + 1, tag + ' seed bag floats outside the row ' + JSON.stringify(m.bag) + ' bar ' + JSON.stringify(m.bar));
      assert(m.bag.l >= -1 && m.bag.r <= m.w + 1, tag + ' seed bag leaves the screen');
      assert(m.hudB <= m.bar.t + 1, tag + ' hud overlaps the row');
      assert(!m.goalB || m.goalB <= m.bar.t - 8, tag + ' goal overlaps the row');
      assert(m.items.length === 10, tag + ' bottom row count ' + m.items.length + ' ' + m.items.map(it => it.id).join(','));
      const widths = m.items.map(it => it.w);
      const wMin = Math.min.apply(null, widths);
      const slot = (m.bar.r - m.bar.l) / 10;
      assert(wMin >= slot - 3, tag + ' a button collapsed ' + JSON.stringify(m.items.map(it => [it.id, +it.w.toFixed(1)])) + ' slot ' + slot.toFixed(1));
      for (let i = 0; i < m.items.length; i++){
        const it = m.items[i];
        assert(it.h >= 40, tag + ' tab hit box is under 40px tall ' + JSON.stringify(it));
        assert(it.w >= slot - 3 && it.w <= slot + 4, tag + ' tab is not an equal share of the row ' + JSON.stringify(it) + ' slot ' + slot.toFixed(1));
        assert(it.l >= -1 && it.r <= m.w + 1, tag + ' tab leaves the screen ' + JSON.stringify(it));
        const cx = (it.l + it.r) / 2;
        assert(cx >= 8 && cx <= m.w - 8, tag + ' tab center is off screen ' + JSON.stringify(it));
        assert(it.t >= m.bar.t - 1 && it.b <= m.bar.b + 1, tag + ' button leaves the row ' + JSON.stringify(it));
        if (i){
          const prev = m.items[i - 1];
          assert(it.l >= prev.r - 1, tag + ' tab boxes overlap ' + prev.id + ' ' + it.id);
          assert(cx >= (prev.l + prev.r) / 2 + slot * 0.7, tag + ' tab centers are stacked ' + prev.id + ' ' + it.id);
        }
      }
      const badHit = m.hits.find((h, i) => {
        const it = m.items[i];
        const cx = it ? (it.l + it.r) / 2 : 0;
        if (cx < 4 || cx > m.w - 4) return false;
        return h.owner !== h.id;
      });
      assert(!badHit, tag + ' a row button is covered ' + JSON.stringify(m.hits));
      const words = ['Pass','Garage','Gear','Dry','Market','Breed','Strains','Story'];
      words.forEach(name => {
        const lab = (m.labels || []).find(l => l.t === name);
        assert(lab, tag + ' missing label ' + name);
        assert(lab.h >= 6 && lab.w >= 8, tag + ' ' + name + ' label is clipped away ' + JSON.stringify(lab));
        assert(lab.fs >= 7 && lab.fs <= 9.5, tag + ' ' + name + ' label is not 7-9px ' + JSON.stringify(lab));
        assert(lab.pos !== 'absolute', tag + ' ' + name + ' label is taken out of the button');
      });
      assert(m.bagName && m.bagName.length > 0, tag + ' seed bag lost its strain name');
      assert(m.bagCount && /\d/.test(m.bagCount), tag + ' seed bag lost its seed count ' + m.bagCount);
      assert(m.nameBox && m.nameBox.h >= 6 && m.nameBox.w >= 8, tag + ' seed name is clipped ' + JSON.stringify(m.nameBox));
      assert(m.countBox && m.countBox.h >= 6 && m.countBox.w >= 6, tag + ' seed count is clipped ' + JSON.stringify(m.countBox));
      assert(m.badge && m.story, tag + ' story badge missing ' + JSON.stringify({ badge: m.badge, story: m.story }));
      assert(m.badge.w >= 8 && m.badge.h >= 8, tag + ' story badge is clipped ' + JSON.stringify(m.badge));
      assert(m.badge.l >= m.story.l - 1 && m.badge.r <= m.story.r + 1 && m.badge.t >= m.story.t - 1 && m.badge.b <= m.story.b + 1, tag + ' story badge leaves its tab ' + JSON.stringify(m.badge) + ' ' + JSON.stringify(m.story));
      assert(m.badge.r <= m.w + 0.5 && m.badge.l >= -0.5, tag + ' story badge leaves the screen ' + JSON.stringify(m.badge));
      assert(m.above !== 'seedBag' && m.cellH > 0, tag + ' plants did not lay out ' + m.above);
      assert(Math.abs(m.cellH - m.expectH) < 3, tag + ' plant grid is not using the toolbar floor ' + m.cellH + ' vs ' + m.expectH);
      assert(m.pickHidden, tag + ' the old seed popup is open');
      assert(!/Seeds tab|Open Seeds/i.test(m.quest), tag + ' goal still names a Seeds tab: ' + m.quest);
      assert(/seed bag/i.test(m.quest), tag + ' plant goal does not mention the seed bag: ' + m.quest);
      assert(!(m.errs && m.errs.length), tag + ' console errors ' + JSON.stringify(m.errs));
    }

    await boot(320, 568);
    const small = await evalJs(measureSrc);
    checkLayout('320x568', small);

    await boot(360, 640);
    const mid = await evalJs(measureSrc);
    checkLayout('360x640', mid);

    await boot(390, 844);
    const tall = await evalJs(measureSrc);
    checkLayout('390x844', tall);

    const shop = await evalJs(`(async () => {
      G.st.cash = Math.max(G.st.cash, 500);
      document.getElementById('seedBag').click();
      const title = document.getElementById('sheetTitle').textContent;
      const body = document.getElementById('sheetBody').innerHTML;
      const buy = document.querySelector('#sheetBody [data-a="buy"][data-n="1"]:not([disabled])');
      const id = buy && buy.dataset.id;
      const before = id ? (G.st.seeds[id] || 0) : -1;
      if (buy) buy.click();
      const after = id ? (G.st.seeds[id] || 0) : -1;
      G.st.seeds.acdc = (G.st.seeds.acdc || 0) + 2;
      if (!G.st.discovered.acdc) G.st.discovered.acdc = true;
      UI.open('seeds');
      const row = document.querySelector('#sheetBody [data-pickseed="acdc"]');
      if (row) row.click();
      const pick = document.getElementById('seedPick');
      const foot = document.getElementById('sheetFoot').innerHTML;
      const selected = G.st.selSeed;
      UI.close();
      Tutorial.replay();
      const tip = (document.querySelector('#tutc p') || {}).textContent || '';
      const target = Tutorial.targetEl();
      document.getElementById('seedBag').click();
      await new Promise(r => setTimeout(r, 80));
      const tipOpen = (document.querySelector('#tutc p') || {}).textContent || '';
      const targetOpen = Tutorial.targetEl();
      const skip = document.querySelector('#tutc [data-a="skip"]');
      if (skip) skip.click();
      return {
        title, hasBag: /In the bag/i.test(body), hasShop: /Buy seeds/i.test(body) && /data-a="buy"/.test(body), body: body.slice(0, 180),
        bought: after === before + 1, before, after, id,
        selected,
        panel: UI.panel,
        sheetOpen: !document.getElementById('sheet').classList.contains('hidden'),
        pickHidden: !pick || pick.classList.contains('hidden'),
        plantAll: /data-a="plantall"/.test(foot),
        tip, tipOpen,
        target: target && target.id,
        targetOpen: targetOpen && (targetOpen.getAttribute('data-a') || targetOpen.id),
        errs: (window.__errs || []).slice(0, 6)
      };
    })()`);
    console.log('SHOP', JSON.stringify({ title: shop.title, bought: shop.bought, selected: shop.selected, tip: shop.tip, tipOpen: shop.tipOpen, target: shop.target, targetOpen: shop.targetOpen }));
    assert(shop.title === 'Seed bag' && shop.sheetOpen && shop.panel === 'seeds', 'bag did not open the seed sheet ' + JSON.stringify(shop));
    assert(shop.hasBag && shop.hasShop, 'sheet is missing the bag or the shop ' + shop.body);
    assert(shop.bought && shop.plantAll, 'buying or Plant all is gone ' + JSON.stringify(shop));
    assert(shop.selected === 'acdc', 'tapping a bag row did not select that seed ' + shop.selected);
    assert(shop.pickHidden, 'the floating seed popup opened');
    assert(shop.target === 'seedBag' && /seed bag/i.test(shop.tip) && !/Seeds tab|Open Seeds/i.test(shop.tip), 'tutorial still points at a Seeds tab ' + JSON.stringify(shop));
    assert(shop.targetOpen === 'buy' && /Buy one/i.test(shop.tipOpen), 'open bag does not point at buying ' + JSON.stringify(shop));
    assert(!(shop.errs && shop.errs.length), 'shop console errors ' + JSON.stringify(shop.errs));

    if (!process.exitCode) console.log('seed row checks passed');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
