/* Single place to rename the game. Also update "name"/"short_name" in manifest.webmanifest. */
window.GAME_CONFIG = {
  title: 'Maui Wowie Farms',
  shortTitle: 'Maui Wowie Farms',
  tagline: 'Hawaiian Island Farm Tycoon',
  version: '1.0', // player-facing build label. The support email includes this.
  saveKey: 'mwfarms_save_v1', // stable storage key. The schema version lives in the JSON (st.v). Never rename this when the game updates.
  // One address for Settings → Help & Support and for privacy.html.
  SUPPORT_EMAIL: '808games@mail.grokbot.com',
  // Genre mechanics (owner-approved checklist, see MECHANICS.md). Each unlocks gradually by level / story.
  features: { orders:true, managers:true, mastery:true, prestigeTree:true, customers:false, sets:true, repTiers:true, storyGoals:true, events:true, gecko:true, crafting:true, leaderboards:true },
  // Tester panel kill switch. See docs/tester-panel.md.
  // true  — website and local test builds. ?dev=1 can open the panel.
  // false — App Store, Google Play, and production-store builds. Required before those ship.
  // When this is not exactly true, ?dev=1 is ignored, the panel is never created, and tester
  // actions cannot grant cash or gems. Native store payment modes force the same lock.
  allowDevTools: true,
};
/* Tester jump menu (?test=1). Presets live in their own save slots so the real save is never touched. */
(function(){ try{
  const q=new URLSearchParams(location.search); if(q.get('test')==='1') sessionStorage.setItem('mwf_test','1'); if(q.get('test')==='0') sessionStorage.removeItem('mwf_test');
  const slot=localStorage.getItem('mwf_test_slot'); window.TEST_MODE=sessionStorage.getItem('mwf_test')==='1'||!!slot;
  if(slot) window.GAME_CONFIG.saveKey='mwfarms_test_'+slot; window.TEST_SLOT=slot||null;
  // ?test=lv10 is a separate farm. It does not set mwf_test_slot, so a normal
  // visit (no parameter) keeps reading mwfarms_save_v1.
  if(q.get('test')==='lv10'){
    window.TEST_LV10=true;
    window.GAME_CONFIG.saveKey='mwfarms_test_v1';
    if(q.get('reset')==='1') localStorage.removeItem('mwfarms_test_v1');
  }
}catch(e){} })();
/* Hidden tester panel (?dev=1) and the ?test=1 jump menu. Off unless this tab opted in
   on a build that allows them. Store builds set GAME_CONFIG.allowDevTools to false
   (see docs/tester-panel.md). That ignores ?dev=1 and ?test=1, clears mwf_dev and the
   mwf_test flags, and leaves DEV_MODE and TEST_MODE false. App Store / Play payment
   modes ('appstore', 'play', or 'auto' inside an iOS/Android app) do the same even if
   the flag was left true. Cash and gem grants from tester actions no-op there. */
(function(){
  let latched=false;
  function nativeStore(){
    try{
      const C=window.Capacitor;
      if(!C||!C.isNativePlatform||!C.isNativePlatform()) return false;
      const p=C.getPlatform?C.getPlatform():'';
      return p==='ios'||p==='android';
    }catch(e){ return true; }
  }
  // Once a store lock is seen it stays on for this page, so flipping the flag
  // or DEV_MODE back on in the console cannot mint cash or gems.
  window.storeDisablesTester=function(){
    if(latched) return true;
    const cfg=window.GAME_CONFIG;
    let off=!cfg||cfg.allowDevTools!==true;
    if(!off){
      const mode=window.PAYMENTS_CONFIG&&window.PAYMENTS_CONFIG.mode;
      if(mode==='appstore'||mode==='play'||(mode==='auto'&&nativeStore())) off=true;
    }
    if(off) latched=true;
    return off;
  };
  window.applyTesterLock=function(){
    if(!window.storeDisablesTester()) return false;
    try{ sessionStorage.removeItem('mwf_dev'); }catch(e){}
    window.DEV_MODE=false;
    try{ const dock=document.getElementById('devdock'); if(dock) dock.remove(); }catch(e){}
    // ?test=1 is decided above, before payments mode exists. A store lock wipes it
    // so the jump menu cannot load a test slot or grant the endgame preset.
    window.TEST_MODE=false;
    window.TEST_SLOT=null;
    try{ sessionStorage.removeItem('mwf_test'); }catch(e){}
    try{
      localStorage.removeItem('mwf_test_slot');
      localStorage.removeItem('mwf_test_init');
    }catch(e){}
    if(window.GAME_CONFIG&&typeof window.GAME_CONFIG.saveKey==='string'&&window.GAME_CONFIG.saveKey.indexOf('mwfarms_test_')===0)
      window.GAME_CONFIG.saveKey='mwfarms_save_v1';
    return true;
  };
})();
(function(){ try{
  if(window.applyTesterLock()) return;
  const q=new URLSearchParams(location.search);
  if(q.get('dev')==='1') sessionStorage.setItem('mwf_dev','1');
  if(q.get('dev')==='0') sessionStorage.removeItem('mwf_dev');
  window.DEV_MODE=sessionStorage.getItem('mwf_dev')==='1';
}catch(e){ window.DEV_MODE=false; } })();
