/* Tester jump menu: Beginning / Middle / End presets, each in a separate save slot (mwfarms_test_<preset>). Hidden unless ?test=1. */
window.TestMenu=(function(){
  const NAMES={begin:'Beginning',mid:'Middle',end:'End'};
  function go(p){ localStorage.setItem('mwf_test_slot',p); localStorage.setItem('mwf_test_init',p); localStorage.removeItem('mwfarms_test_'+p); location.reload(); }
  function back(){ localStorage.removeItem('mwf_test_slot'); localStorage.removeItem('mwf_test_init'); location.reload(); }
  function maxAll(locs){ for(const k in G.UPG){ const d=G.UPG[k]; if(locs&&!locs.includes(d.loc)) continue; for(let i=0;i<12;i++){ try{ if(!G.buyUpg(k)) break; }catch(e){ break; } } } }
  function hireAll(){ for(const k in G.WORKERS) for(let i=0;i<4;i++){ try{ if(!G.hire(k)) break; }catch(e){ break; } } }
  function steps(kind,n){ for(let i=0;i<n;i++) if(!G.buyStep(kind)) break; }
  function fill(loc,share){ const S=G.S.filter(s=>G.st.discovered[s.id]&&s.game.growSec<=4*3600); G.st.plots.filter(p=>p.loc===loc&&p.owned&&!p.strain).forEach((p,i)=>{ const s=S[i%S.length]; if(!s) return; G.st.seeds[s.id]=(G.st.seeds[s.id]||0)+1; G.st.selSeed=s.id; G.plant(p); p.prog=Math.min(.98,(i*.17)%1*share); p.water=1; }); }
  function build(p){ const st=G.st; st.questDone=false; st.tutDone=true;
    if(p==='begin'){ { const kk=G.WORKERS.mgrG?'mgrG':'farmhand'; if(G.WORKERS[kk]&&!G.wk(kk)) st.workers[kk]=1; } G.save(); return; }   // matches a real player who got Kai from the 'sell' goal
    const all=G.S.slice().sort((a,b)=>a.tier-b.tier);
    if(p==='mid'){ st.level=9; st.cash=2e6; st.gems=300; st.xp=0;
      steps('garage',7); G.buyLand(); G.buildGH(); steps('gh',3); steps('field',2); maxAll(['all','farm']); try{ G.hire('mgrF'); }catch(e){}
      all.filter(s=>['Common','Uncommon','Rare'].includes(s.rarity)).slice(0,22).forEach(s=>{ G.discover(s.id,true); st.seeds[s.id]=(st.seeds[s.id]||0)+5; });
      fill('farm',1); fill('garage',1); all.slice(0,6).forEach(s=>{ if(st.discovered[s.id]) st.inv.cured[s.id+'|1|A']=12; });
      st.cash=180000; st.rep=Math.max(st.rep||0,60); }
    if(p==='end'){ st.level=30; st.cash=5e9; st.gems=50000;
      steps('garage',7); G.buyLand(); G.buildGH(); steps('gh',3); steps('field',3); G.buyPermit(); G.buyFoundation&&G.buyFoundation(); G.buildIndoor(); steps('bench',3); G.buyLab(); maxAll(); hireAll();
      all.forEach(s=>{ G.discover(s.id,true); st.seeds[s.id]=(st.seeds[s.id]||0)+10; }); fill('farm',1); fill('indoor',1); fill('garage',1);
      all.filter(s=>s.rarity==='Legendary').forEach(s=>{ st.inv.cured[s.id+'|1|A']=20; }); st.cash=25e6; st.rep=Math.max(st.rep||0,5000); }
    st.custT=0; G.syncPlots(); G.save(); }
  function applyPending(){ const p=localStorage.getItem('mwf_test_init'); if(!p) return null; localStorage.removeItem('mwf_test_init'); try{ build(p); }catch(e){ console.error('test preset',e); } return p; }
  function html(){ if(!window.TEST_MODE) return ''; const cur=window.TEST_SLOT;
    return `<div class="section-t">Tester jump menu</div><div class="note">${cur?`Playing test save: <b>${NAMES[cur]||cur}</b>. Your own save is untouched.`:'Jump to a stage of the game. Each uses its own test save; your real save is untouched.'}</div>
      <div class="row testrow">${Object.keys(NAMES).map(k=>`<button class="btn sm ${cur===k?'gold':''}" data-test="${k}">${NAMES[k]}</button>`).join('')}</div><button class="btn wide sec" data-test="__gift">Show daily gift</button>${cur?`<button class="btn wide sec" data-test="__back">Back to my save</button>`:''}`; }
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-test]'); if(!b) return; const k=b.dataset.test; if(k==='__back') back(); else if(k==='__gift'){ window.__giftForce=1; G.st.streak.last=null; G.claimDaily(); } else go(k); });
  return {applyPending,html,go,back};
})();
