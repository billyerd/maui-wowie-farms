/* Hidden tester panel. Created only when this tab was opened with ?dev=1 (session sticks until ?dev=0)
   AND the build allows it. Store builds set GAME_CONFIG.allowDevTools to false and this file builds
   nothing. App Store / Play payment modes apply the same lock. Cash and gem buttons go through
   G.devGrantCash / G.devGrantGems, which refuse to run in store mode. */
window.DevPanel=(function(){
  if(window.applyTesterLock) window.applyTesterLock();
  function html(){
    if(!window.DEV_MODE||(window.storeDisablesTester&&window.storeDisablesTester())) return '';
    return `<div class="section-t">Tester tools</div><div class="note">This tab was opened with <b>?dev=1</b>. App Store, Play, and production-store builds set <b>allowDevTools</b> to false in js/config.js and ignore that link. Your save key is unchanged.</div>`;
  }
  if(!window.DEV_MODE||(window.storeDisablesTester&&window.storeDisablesTester())) return {html};
  const SPEEDS=[['1×',1],['10×',10],['60×',60],['360×',360],['1 day / min',1440]];
  const SKIPS=[['10 min',600],['1 hour',3600],['8 hours',28800],['1 day',86400],['3 days',259200]];
  const CASH=[['+ $1,000',1000],['+ $10,000',10000],['+ $100,000',100000],['+ $1,000,000',1000000]];
  const GEMS=[['+ 100',100],['+ 1,000',1000],['+ 10,000',10000]];
  const LEVELS=[3,5,8,11,14,20];
  function chip(label,attrs){ return `<button type="button" class="btn sm sec" ${attrs}>${label}</button>`; }
  function init(){
    const dock=document.createElement('div');
    dock.id='devdock';
    dock.innerHTML=`<button type="button" id="devtoggle" aria-expanded="false" aria-controls="devsheet">Tester</button>
      <div id="devsheet" class="hidden" role="dialog" aria-label="Tester tools">
        <header><b>Tester tools</b><button type="button" id="devclose" aria-label="Close tester tools">&times;</button></header>
        <p class="devnote">Hidden unless this tab uses <b>?dev=1</b> on a build with tester tools allowed. Store builds turn that off. Save key stays the same.</p>
        <div class="devsec">Cash</div>
        <div class="devrow">${CASH.map(([l,n])=>chip(l,`data-dev="cash" data-n="${n}"`)).join('')}</div>
        <div class="devsec">Gems</div>
        <div class="devrow">${GEMS.map(([l,n])=>chip(l,`data-dev="gems" data-n="${n}"`)).join('')}</div>
        <div class="devsec">Level</div>
        <div class="devrow">${LEVELS.map(n=>chip('Lv '+n,`data-dev="level" data-n="${n}"`)).join('')}</div>
        <div class="devline"><input id="devlevel" type="number" min="1" max="60" step="1" value="1" aria-label="Level"><button type="button" class="btn sm gold" data-dev="levelset">Set level</button></div>
        <div class="devsec">Locations and features</div>
        <button type="button" class="btn sm gold devwide" data-dev="unlock">Unlock garage, land, greenhouse, indoor, lab, and crafting</button>
        <div class="devsec">Seeds</div>
        <input id="devfilter" type="search" placeholder="Find a strain" aria-label="Filter strains">
        <select id="devstrain" aria-label="Strain"></select>
        <div class="devline"><input id="devcount" type="number" min="1" max="999" step="1" value="10" aria-label="Seed count"><button type="button" class="btn sm gold" data-dev="seeds">Grant seeds</button></div>
        <div class="devsec">Growth speed</div>
        <p class="devnote">Multiplies plant growth while you play. Time skip is separate and also finishes drying, crosses, and crafting.</p>
        <div class="devrow" id="devspeeds">${SPEEDS.map(([l,n])=>chip(l,`data-dev="speed" data-n="${n}"`)).join('')}</div>
        <div class="devsec">Time skip</div>
        <div class="devrow">${SKIPS.map(([l,n])=>chip(l,`data-dev="skip" data-n="${n}"`)).join('')}</div>
      </div>`;
    document.body.appendChild(dock);
    const sheet=dock.querySelector('#devsheet');
    const toggle=dock.querySelector('#devtoggle');
    const sel=dock.querySelector('#devstrain');
    const filter=dock.querySelector('#devfilter');
    function strains(){
      const q=(filter.value||'').trim().toLowerCase();
      return G.S.filter(s=>!q||s.name.toLowerCase().includes(q)||s.id.includes(q)||(s.rarity||'').toLowerCase().includes(q));
    }
    function fillStrains(){
      const keep=sel.value;
      const list=strains();
      const groups={};
      list.forEach(s=>{ (groups[s.rarity]||(groups[s.rarity]=[])).push(s); });
      sel.innerHTML=Object.keys(groups).map(r=>`<optgroup label="${r}">${groups[r].map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</optgroup>`).join('')
        ||'<option value="">No match</option>';
      if(keep&&list.some(s=>s.id===keep)) sel.value=keep;
    }
    function open(on){
      sheet.classList.toggle('hidden',!on);
      toggle.setAttribute('aria-expanded',on?'true':'false');
      if(on){ const lv=dock.querySelector('#devlevel'); if(lv&&G.st) lv.value=G.st.level; fillStrains(); markSpeed(); }
    }
    function markSpeed(){
      const n=(G.st&&G.st.devSpeed)||1;
      dock.querySelectorAll('[data-dev="speed"]').forEach(b=>b.classList.toggle('gold',+b.dataset.n===n));
    }
    function poke(){ if(window.UI){ UI.update(0); if(UI.panel) UI.render(); } if(window.R&&R.rebuild) R.rebuild(); }
    toggle.onclick=()=>open(sheet.classList.contains('hidden'));
    dock.querySelector('#devclose').onclick=()=>open(false);
    filter.addEventListener('input',fillStrains);
    dock.addEventListener('click',e=>{
      const b=e.target.closest('[data-dev]'); if(!b) return;
      const k=b.dataset.dev, n=+b.dataset.n;
      if(k==='cash') G.devGrantCash(n);
      else if(k==='gems') G.devGrantGems(n);
      else if(k==='level'||k==='levelset'){ const v=k==='levelset'?+dock.querySelector('#devlevel').value:n; G.devSetLevel(v); }
      else if(k==='unlock') G.devUnlockAll();
      else if(k==='seeds'){ const id=sel.value; if(id) G.devGrantSeeds(id,+dock.querySelector('#devcount').value||1); }
      else if(k==='speed') G.devSetSpeed(n);
      else if(k==='skip') G.devSkip(n);
      if(k==='cash'||k==='gems'||k==='seeds') G.save();
      markSpeed(); poke();
    });
    fillStrains(); markSpeed();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
  return {html,init};
})();
