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
        const notes=document.getElementById('toasts');
        if(notes){ notes.classList.remove('dock'); notes.querySelectorAll('.toast').forEach(el=>el.remove()); }
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
        assert(!s.a || Math.abs(s.w / s.h - s.a) < 0.06, tag + ' pot ' + s.id + ' is cropped instead of scaled ' + JSON.stringify(s));
        if (s.cellW) assert(s.w <= s.cellW * 1.12 + 1, tag + ' pot ' + s.id + ' is wider than 1.1 cells ' + JSON.stringify(s));
        assert(s.top >= (s.cellTop || 0) - 1, tag + ' pot ' + s.id + ' covers the pot above ' + JSON.stringify(s));
        if (s.edge != null && s.x != null && s.x + s.w / 2 > s.edge + 0.6) assert(s.feather > 0.4, tag + ' pot ' + s.id + ' is hard-clipped at the margin ' + JSON.stringify(s));
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
        assert(a.top >= a.cellTop - 1 && c.top >= c.cellTop - 1, tag + ' zoom grew the plant over the pot above');
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
        const garage=R.bedSprites();
        const maui=garage[Math.min(2, garage.length-1)];
        const edge=garage.reduce((a,s)=>s.x>a.x?s:a, garage[0]);
        G.st.land=true; G.st.field=3; G.syncPlots();
        const inn=G.st.plots.filter(p=>p.zone==='field'&&p.owned);
        const ids=(window.STRAINS||[]).map(s=>s.id);
        inn.forEach((p,i)=>{ p.strain=ids[i%ids.length]; p.prog=1; p.water=1; p.food=1; p.pest=null; });
        G.setRoom('facility'); R.frame(0.05);
        const sprites=R.bedSprites();
        const slack=sprites.filter(s=>{
          const span=s.foot-s.cellTop;
          const edgeOut=s.edge!=null && s.x+s.w/2>s.edge+0.6 && !(s.feather>0.4);
          const cropped=s.a && Math.abs(s.w/s.h - s.a)>0.06;
          return edgeOut || cropped || s.top<s.cellTop-1 || s.h>span+1.5;
        }).slice(0,3);
        const narrow=['blue-dream','glitter-bomb','rs11','durban-poison','jealousy'];
        const facility=[];
        narrow.forEach(id=>{
          inn.forEach(p=>{ p.strain=id; p.prog=1; p.water=1; p.food=1; p.pest=null; });
          R.frame(0.05);
          const s=R.bedSprites()[0];
          if(!s) return;
          const span=s.foot-s.cellTop;
          const edgeW=s.edge!=null?Math.max(0,(s.edge-s.x)*2):999;
          facility.push({id, w:+s.w.toFixed(1), h:+s.h.toFixed(1), span:+span.toFixed(1), a:+(s.a||0).toFixed(3), edgeW:+edgeW.toFixed(1), top:+s.top.toFixed(1), cellTop:+s.cellTop.toFixed(1)});
        });
        G.st.discovered=G.st.discovered||{}; G.st.discovered['maui-wowie']=1; G.st.discovered['granddaddy-purple']=1;
        UI.open('seeds');
        return {
          dpr, ripe:{h:+maui.h.toFixed(1), w:+maui.w.toFixed(1), span:+(maui.foot-maui.cellTop).toFixed(1), cellW:+maui.cellW.toFixed(1), cellH:+(maui.cellH||0).toFixed(1), top:+maui.top.toFixed(1), cellTop:+maui.cellTop.toFixed(1), id:'jealousy'},
          edge:{right:+(edge.x+edge.w/2).toFixed(1), limit:edge.edge, feather:edge.feather||0, id:edge.art},
          indoor:sprites.length, slack:slack.length, facility,
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
      assert(m.ripe && m.ripe.cellH > 40 && m.ripe.h >= m.ripe.cellH * 0.76 && m.ripe.h <= m.ripe.cellH * 0.80, 'garage ripe plant is not about 0.78 of the cell ' + JSON.stringify(m.ripe));
      assert(m.ripe.w <= m.ripe.cellW * 1.25 + 1, 'narrow garage ripe plant is wider than the canopy ' + JSON.stringify(m.ripe));
      assert(m.ripe.h > m.ripe.w, 'tall ripe plant is not taller than it is wide ' + JSON.stringify(m.ripe));
      assert(m.ripe.top >= m.ripe.cellTop - 1, 'garage ripe plant covers the pot above ' + JSON.stringify(m.ripe));
      assert(m.edge && (m.edge.right <= m.edge.limit + 0.6 || m.edge.feather > 0.4), 'rightmost garage plant is hard-clipped ' + JSON.stringify(m.edge));
      assert(m.indoor >= 20, 'indoor size sample is too small');
      assert(m.slack === 0, 'indoor ripe plants are outside the cell limits ' + JSON.stringify(m));
      assert(m.facility && m.facility.length === 5, 'facility narrow sample missing ' + JSON.stringify(m.facility));
      for (const s of m.facility || []){
        assert(s.top >= s.cellTop - 1, 'facility ' + s.id + ' covers the pot above ' + JSON.stringify(s));
        assert(s.h <= s.span + 1.2, 'facility ' + s.id + ' leaves the row ' + JSON.stringify(s));
        assert(Math.abs(s.w / s.h - s.a) < 0.06, 'facility ' + s.id + ' is cropped ' + JSON.stringify(s));
        if (s.a < 0.9) assert(s.h >= s.span * 0.7, 'facility ' + s.id + ' lost height it could keep ' + JSON.stringify(s));
      }
      assert(shop && shop.w >= 90 && shop.h >= 110, 'seed shop picture is still small ' + JSON.stringify(shop));
    }

    async function toastCheck(){
      const m = await evalJs(`(async () => {
        const notes=document.getElementById('toasts');
        if(notes) notes.querySelectorAll('.toast').forEach(el=>el.remove());
        UI.toast('Daily gift ready!','good');
        UI.toast('Watered the row','good');
        await new Promise(r=>setTimeout(r, 320));
        const box=document.getElementById('toasts');
        const hud=document.getElementById('hud').getBoundingClientRect();
        const tb=document.getElementById('toolbar').getBoundingClientRect();
        const els=[...document.querySelectorAll('#toasts .toast, #achToasts .toast')].filter(el=>el.getClientRects().length);
        const rects=els.map(el=>{
          const r=el.getBoundingClientRect();
          return {t:+r.top.toFixed(1), b:+r.bottom.toFixed(1), text:el.textContent, len:(el.textContent||'').length, one:el.scrollHeight<=el.clientHeight+2, ms:el.dataset.ms};
        });
        const boxTop=box.getBoundingClientRect().top;
        return {n:els.length, rects, hud:+hud.bottom.toFixed(1), bar:+tb.top.toFixed(1), boxTop:+boxTop.toFixed(1)};
      })()`);
      console.log('toasts', JSON.stringify(m));
      assert(m.n === 1, 'more than one toast is showing ' + JSON.stringify(m));
      assert(m.boxTop + 1 >= m.hud && m.boxTop >= 56 && m.boxTop <= 140, 'toast stack is not under the HUD ' + JSON.stringify(m));
      for (const r of m.rects || []){
        assert(r.t >= m.hud - 1 && r.t <= 180, 'toast is not under the HUD ' + JSON.stringify(r));
        assert(r.t + 1 >= m.hud, 'toast covers the HUD ' + JSON.stringify(r) + ' hud ' + m.hud);
        assert(r.b < m.bar - 20, 'toast reaches the bottom row ' + JSON.stringify(r));
        assert(r.one && r.text === 'Watered the row', 'toast was truncated ' + JSON.stringify(r));
        assert(r.ms === '2500', 'toast does not dismiss in 2.5s ' + JSON.stringify(r));
      }
      const banner = await evalJs(`(async () => {
        const g=document.getElementById('goal');
        g.classList.remove('open');
        document.querySelectorAll('#toasts .toast, #achToasts .toast').forEach(el=>el.remove());
        UI.toast('Legendary Harvest','gemt','ach');
        await new Promise(r=>setTimeout(r, 40));
        const hud=document.getElementById('hud').getBoundingClientRect().bottom;
        const closed=document.querySelector('#achToasts .toast, #toasts .toast').getBoundingClientRect().top;
        g.classList.add('open');
        UI.update();
        await new Promise(r=>setTimeout(r, 40));
        const el=document.querySelector('#achToasts .toast, #toasts .toast');
        const open=el.getBoundingClientRect().top;
        const tx=g.querySelector('.gtx').getBoundingClientRect();
        const text=el.textContent;
        g.classList.remove('open');
        UI.update();
        await new Promise(r=>setTimeout(r, 40));
        const back=document.querySelector('#achToasts .toast, #toasts .toast').getBoundingClientRect().top;
        el.remove();
        return {closed:+closed.toFixed(1), open:+open.toFixed(1), back:+back.toFixed(1), banner:+tx.bottom.toFixed(1), hud:+hud.toFixed(1), text};
      })()`);
      console.log('toast banner', JSON.stringify(banner));
      assert(banner.text === 'Legendary Harvest', 'achievement toast was rewritten ' + JSON.stringify(banner));
      assert(banner.closed >= banner.hud + 4, 'achievement toast sits on the HUD ' + JSON.stringify(banner));
      assert(Math.abs(banner.back - banner.closed) < 3, 'toast jumps when the goal banner closes ' + JSON.stringify(banner));
      assert(Math.abs(banner.open - banner.closed) < 16, 'toast jumps when the goal banner opens ' + JSON.stringify(banner));
      const clearance = await evalJs(`(() => {
        const rooms=[
          {room:'gh', prep:()=>{ G.st.ghBuilt=true; G.st.gh=3; G.st.ghMatch=9; }},
          {room:'facility', prep:()=>{ G.st.land=true; G.st.field=3; }}
        ];
        const out=[];
        document.querySelectorAll('#toasts .toast, #achToasts .toast').forEach(el=>el.remove());
        for(const spec of rooms){
          spec.prep(); G.syncPlots();
          const zone=spec.room==='gh'?'gh':'field';
          G.st.plots.filter(p=>p.zone===zone&&p.owned).forEach(p=>{ p.strain='jealousy'; p.prog=1; p.water=1; p.food=1; p.pest=null; });
          G.setRoom(spec.room); if(R.resize) R.resize(); R.frame(0.05);
          UI.toast('Watered the row','good');
          const el=document.querySelector('#toasts .toast, #achToasts .toast');
          const r=el.getBoundingClientRect();
          const sprites=R.bedSprites();
          const leaf=Math.min.apply(null, sprites.map(s=>s.top));
          el.remove();
          out.push({room:spec.room, top:+r.top.toFixed(1), bottom:+r.bottom.toFixed(1), leaf:+leaf.toFixed(1), h:+r.height.toFixed(1)});
        }
        return out;
      })()`);
      console.log('toast clearance', JSON.stringify(clearance));
      for (const row of clearance){
        assert(row.bottom < row.leaf - 1, row.room + ' toast covers the first row ' + JSON.stringify(row));
        assert(row.h <= 28, row.room + ' toast is not slim ' + JSON.stringify(row));
      }
      const sheet = await evalJs(`(async () => {
        G.st.discovered=G.st.discovered||{};
        G.st.seeds=G.st.seeds||{};
        G.st.discovered['durban-poison']=1; G.st.seeds['durban-poison']=4;
        G.st.discovered['northern-lights']=1; G.st.seeds['northern-lights']=3;
        UI.open('seeds');
        UI.toast('Daily gift ready!','good');
        UI.toast('Watered the row','good');
        await new Promise(r=>setTimeout(r, 320));
        const els=[...document.querySelectorAll('#toasts .toast, #achToasts .toast')].filter(el=>el.getClientRects().length);
        const rows=[...document.querySelectorAll('[data-pickseed]')].filter(el=>(el.textContent||'').indexOf('in the bag')>=0).map(el=>el.getBoundingClientRect()).filter(r=>r.height>8);
        const sub=document.getElementById('sheetSub').getBoundingClientRect();
        const tabs=document.getElementById('sheetTabs').getBoundingClientRect();
        const bar=document.getElementById('toolbar').getBoundingClientRect();
        const hit=(a,b)=>a.bottom>b.top+1 && a.top<b.bottom-1 && a.right>b.left && a.left<b.right;
        const overlap=els.some(el=>{
          const a=el.getBoundingClientRect();
          return rows.some(b=>hit(a,b));
        });
        const head=els.some(el=>{
          const a=el.getBoundingClientRect();
          return hit(a, sub) || hit(a, tabs);
        });
        const art=document.querySelector('[data-pickseed] canvas, [data-pickseed] img');
        const sz=art?+(art.dataset.sz||art.width||0):0;
        const r=els[0]&&els[0].getBoundingClientRect();
        const text=els.map(el=>el.textContent);
        els.forEach(el=>el.remove());
        UI.close();
        return {n:els.length, overlap, head, top:r?+r.top.toFixed(1):0, bottom:r?+r.bottom.toFixed(1):0, bar:+bar.top.toFixed(1), text, rows:rows.length, sz};
      })()`);
      console.log('toasts sheet', JSON.stringify(sheet));
      assert(sheet.n === 1, 'a sheet shows more than one toast ' + JSON.stringify(sheet));
      assert(sheet.rows > 0, 'seed bag has no rows ' + JSON.stringify(sheet));
      assert(!sheet.overlap, 'toast covers a seed row ' + JSON.stringify(sheet));
      assert(!sheet.head, 'toast covers the sheet subtitle or chips ' + JSON.stringify(sheet));
      assert(sheet.bottom <= sheet.bar + 8 && sheet.bottom > sheet.bar - 80, 'sheet toast is not just above the tabs ' + JSON.stringify(sheet));
      assert(sheet.sz >= 100, 'seed bag thumbnail is not drawn at 2x ' + JSON.stringify(sheet));
      await evalJs(`(() => { const notes=document.getElementById('toasts'); if(notes) notes.querySelectorAll('.toast').forEach(el=>el.remove()); UI.toast('Short note','good'); return true; })()`);
      await sleep(3200);
      const left = await evalJs(`(() => document.querySelectorAll('#toasts .toast').length)()`);
      assert(left === 0, 'toast did not auto-dismiss ' + left);
    }

    async function stageRow(label){
      const m = await evalJs(`(() => {
        G.st.garage=0; G.st.garageKeep=0; G.syncPlots();
        const owned=G.st.plots.filter(p=>p.zone==='garage'&&p.owned);
        const setup=[[0.04,'jealousy'],[0.34,'jealousy'],[0.75,'jealousy'],[1,'jealousy'],[1,'granddaddy-purple']];
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

    async function fadeCheck(){
      const m = await evalJs(`(() => {
        let prev=-1, back=null;
        for(let i=0;i<=200;i++){
          const prog=i/200;
          const g=R.growthPaint(prog);
          let lead=g.layers[0];
          for(const L of g.layers){
            if(L.a>lead.a+1e-6 || (Math.abs(L.a-lead.a)<=1e-6 && L.stage>lead.stage)) lead=L;
          }
          if(lead.stage<prev) back={prog:+prog.toFixed(3), lead:lead.stage, prev, layers:g.layers};
          prev=lead.stage;
        }
        const ripe=R.growthPaint(1);
        const mid=R.growthPaint(0.081);
        G.st.garage=0; G.st.garageKeep=0; G.syncPlots();
        const owned=G.st.plots.filter(q=>q.zone==='garage'&&q.owned);
        owned.forEach(q=>{ q.strain=null; q.prog=0; q.pest=null; });
        const p=owned[0];
        G.setRoom('garage'); if(R.resize) R.resize();
        const dips=[]; const heights={};
        const marks=[0.40,0.449,0.452,0.50,0.64,0.649,0.652,0.80,1];
        for(const id of ['durban-poison','maile-grape']){
          let prev=0, prevA=0, prevFade=false; const series=[];
          for(const prog of marks){
            p.strain=id; p.prog=prog; p.water=1; p.food=1; p.pest=null;
            R.frame(0.05);
            const sp=R.bedSprites().find(s=>s.id===p.id);
            const h=sp?sp.h:0, a=sp?sp.a:0, fade=!!R.fadeMix(prog);
            const cropped=sp && Math.abs(sp.w/sp.h - a)>0.06;
            if(cropped) dips.push({id, prog, h:+h.toFixed(2), w:sp&&+sp.w.toFixed(1), a:+a.toFixed(3), cropped:!!cropped});
            else if(!fade && !prevFade && h+0.6<prev && a<=prevA+0.02) dips.push({id, prog, h:+h.toFixed(2), prev:+prev.toFixed(2), a:+a.toFixed(3)});
            prev=h; prevA=a; prevFade=fade; series.push(+h.toFixed(1));
          }
          heights[id]=series;
        }
        p.strain=null; p.prog=0; p.pest=null;
        G.st.discovered=G.st.discovered||{}; G.st.discovered['durban-poison']=1;
        G.st.seeds['durban-poison']=(G.st.seeds['durban-poison']||0)+1;
        const planted=G.plant(p,'durban-poison');
        p.prog=1; p.water=1; p.food=1;
        R.frame(0.05);
        const sp=R.bedSprites().find(s=>s.id===p.id);
        return {back, ripe, mid, planted, art:sp&&sp.art, stage:sp&&sp.stage, dips, heights, errs:(window.__errs||[]).slice(0,4)};
      })()`);
      console.log('fade', JSON.stringify({ back: m.back, ripe: m.ripe, mid: m.mid, art: m.art, stage: m.stage, planted: m.planted, heights: m.heights, dips: m.dips }));
      assert(!(m.errs && m.errs.length), 'fade console errors ' + JSON.stringify(m.errs));
      assert(!m.back, 'drawn sprite went backwards ' + JSON.stringify(m.back));
      assert(m.ripe && m.ripe.layers && m.ripe.layers.length === 1 && m.ripe.layers[0].stage === 5 && m.ripe.layers[0].a === 1, 'prog 1 does not draw the strain sprite ' + JSON.stringify(m.ripe));
      assert(m.mid && m.mid.layers && m.mid.layers.length === 1 && m.mid.layers[0].stage === 1, 'stage edge snapped back to the previous sprite ' + JSON.stringify(m.mid));
      assert(m.planted && m.art === 'durban-poison' && m.stage === 5, 'ripe Durban Poison did not draw its strain sprite ' + JSON.stringify(m));
      assert(!(m.dips && m.dips.length), 'drawn height decreased across a stage ' + JSON.stringify(m.dips) + ' ' + JSON.stringify(m.heights));
      const grow = await evalJs(`(() => {
        G.st.garage=0; G.st.garageKeep=0; G.syncPlots();
        const owned=G.st.plots.filter(q=>q.zone==='garage'&&q.owned);
        const p=owned[2]||owned[0];
        G.setRoom('garage'); if(R.resize) R.resize();
        const ids=['durban-poison','northern-lights','maile-grape','jealousy'];
        const jumps=[]; const widths=[]; const ends={};
        ids.forEach(id=>{
          let prev=-1, prevW=-1;
          for(let i=0;i<=100;i++){
            const prog=i/100;
            p.strain=id; p.prog=prog; p.water=1; p.food=1; p.pest=null;
            R.frame(0.02);
            const sp=R.bedSprites().find(s=>s.id===p.id);
            const h=sp?sp.h:0, w=sp?sp.w:0;
            if(prev>=0 && h+0.6<prev) jumps.push({id, prog:+prog.toFixed(2), h:+h.toFixed(1), prev:+prev.toFixed(1), drop:1});
            else if(prev>=0 && h>prev+8) jumps.push({id, prog:+prog.toFixed(2), h:+h.toFixed(1), prev:+prev.toFixed(1), jump:1});
            if(prevW>=0 && w>prevW+8) widths.push({id, prog:+prog.toFixed(2), w:+w.toFixed(1), prev:+prevW.toFixed(1)});
            prev=h; prevW=w;
          }
          const sp=R.bedSprites().find(s=>s.id===p.id);
          ends[id]={h:sp?+sp.h.toFixed(1):0, w:sp?+sp.w.toFixed(1):0, cellW:sp?+sp.cellW.toFixed(1):0, cellH:sp?+sp.cellH.toFixed(1):0, span:sp?+(sp.foot-sp.cellTop).toFixed(1):0};
        });
        const wideIds=['cherry-wine','gary-payton','northern-lights','menehune-mint','do-si-dos'];
        owned.forEach((q,i)=>{ q.strain=wideIds[i%wideIds.length]; q.prog=i%2?1:0.55; q.water=1; q.food=1; q.pest=null; });
        R.frame(0.05);
        const row=R.bedSprites();
        let badTap=0, wideOver=0;
        const samples=[];
        row.forEach(s=>{
          if(s.w>s.cellW*1.12+1) wideOver++;
          const tip=R.pick(s.x+s.w/2-1, s.top+Math.min(12, s.h*0.2));
          const hit=tip&&tip.p&&tip.p.id===s.id;
          if(!hit) badTap++;
          if(samples.length<4) samples.push({id:s.art, w:+s.w.toFixed(1), cell:+s.cellW.toFixed(1), hit:hit?s.id:(tip&&tip.p&&tip.p.id)});
        });
        const wash=['maile-grape','granddaddy-purple','blue-dream'].map(id=>{
          const a=R.washProbe(id, 0.2), b=R.washProbe(id, 0.5);
          return {id, a, b};
        });
        p.strain=null; p.prog=0;
        return {jumps, widths, ends, wash, badTap, wideOver, samples, n:row.length, errs:(window.__errs||[]).slice(0,4)};
      })()`);
      console.log('grow', JSON.stringify({ jumps: grow.jumps, widths: grow.widths, ends: grow.ends, wash: grow.wash, taps: grow.badTap, wideOver: grow.wideOver, samples: grow.samples }));
      assert(!(grow.errs && grow.errs.length), 'growth sweep errors ' + JSON.stringify(grow.errs));
      assert(!(grow.jumps && grow.jumps.length), 'height is not a smooth climb ' + JSON.stringify(grow.jumps));
      assert(!(grow.widths && grow.widths.length), 'width pops at a stage edge ' + JSON.stringify(grow.widths));
      assert(!grow.wideOver, 'a wide plant is over 1.1 cells ' + JSON.stringify(grow.samples));
      assert(!grow.badTap, 'a leaf tip hit the neighbour ' + grow.badTap + ' ' + JSON.stringify(grow.samples));
      for (const id of ['durban-poison','jealousy']){
        const e=grow.ends[id];
        assert(e && e.h >= e.cellH*0.76 && e.h <= e.cellH*0.80, id + ' ripe height left the 0.78 cell target ' + JSON.stringify(e));
      }
      for (const id of ['northern-lights','maile-grape']){
        const e=grow.ends[id];
        assert(e && e.h+0.5 >= e.span*0.58, id + ' wide ripe plant lost the height floor ' + JSON.stringify(e));
        assert(e && e.w <= e.cellW*1.12+1, id + ' wide ripe plant is over 1.1 cells ' + JSON.stringify(e));
      }
      for (const row of grow.wash || []){
        for (const sample of [row.a, row.b]){
          assert(sample && sample.clear > 40 && sample.leaked === 0, row.id + ' wash painted transparent pixels ' + JSON.stringify(sample));
        }
      }
    }

    async function harvestCheck(){
      const m = await evalJs(`(() => {
        const rooms=[
          {room:'garage', zone:'garage', prep:()=>{ G.st.garage=5; G.st.garageKeep=0; }},
          {room:'gh', zone:'gh', prep:()=>{ G.st.ghBuilt=true; G.st.gh=0; G.st.ghMatch=12; }},
          {room:'facility', zone:'field', prep:()=>{ G.st.land=true; G.st.field=3; }}
        ];
        const out=[];
        const bar=document.getElementById('toolbar').getBoundingClientRect();
        for(const spec of rooms){
          spec.prep(); G.syncPlots();
          const owned=G.st.plots.filter(p=>p.zone===spec.zone&&p.owned);
          owned.forEach(p=>{ p.strain='durban-poison'; p.prog=1; p.water=1; p.food=1; p.pest=null; });
          G.setRoom(spec.room); if(R.resize) R.resize(); R.frame(0.05);
          const sprites=R.bedSprites();
          const s=sprites[sprites.length-1];
          const px=s.x, py=s.foot-1;
          const pot=R.pick(px, py);
          const leaf=R.pick(s.x+s.w/2-1, s.top+Math.min(12, s.h*0.2));
          const el=document.elementFromPoint(px, py);
          const topEl=el?(el.id||el.tagName):'';
          const open=!(el&&el.closest&&el.closest('#toolbar,#hud,#sheet,#modal'));
          const before=G.st.stats.harvests;
          let fired=false;
          if(open&&pot&&pot.type==='plot'&&pot.p&&pot.p.id===s.id){ UI.tapPlot(pot.p, px, py); fired=!pot.p.strain && G.st.stats.harvests>before; }
          out.push({
            room:spec.room, n:sprites.length, id:s&&s.id, art:s&&s.art,
            pot:pot&&pot.type, potId:pot&&pot.p&&pot.p.id,
            leaf:leaf&&leaf.type, leafId:leaf&&leaf.p&&leaf.p.id,
            topEl, open, fired, foot:+s.foot.toFixed(1), barTop:+bar.top.toFixed(1)
          });
        }
        return {out, errs:(window.__errs||[]).slice(0,4)};
      })()`);
      console.log('harvest', JSON.stringify(m));
      assert(!(m.errs && m.errs.length), 'harvest console errors ' + JSON.stringify(m.errs));
      for (const row of m.out || []){
        assert(row.fired, row.room + ' last cell harvest did not fire ' + JSON.stringify(row));
        assert(row.leafId === row.id, row.room + ' leaf tip missed the plant ' + JSON.stringify(row));
        assert(row.foot <= row.barTop + 1, row.room + ' last plant sits under the toolbar ' + JSON.stringify(row));
      }
    }

    await boot(390, 844);
    await fadeCheck();
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
    await harvestCheck();
    await toastCheck();
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
