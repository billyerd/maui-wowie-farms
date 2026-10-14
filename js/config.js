/* Single place to rename the game. Also update "name"/"short_name" in manifest.webmanifest. */
window.GAME_CONFIG = {
  title: 'Maui Wowie Farms',
  shortTitle: 'Maui Wowie Farms',
  tagline: 'Hawaiian Island Farm Tycoon',
  saveKey: 'mwfarms_save_v1', // stable storage key. The schema version lives in the JSON (st.v). Never rename this when the game updates.
  // Genre mechanics (owner-approved checklist, see MECHANICS.md). Each unlocks gradually by level / story.
  features: { orders:true, managers:true, mastery:true, prestigeTree:true, customers:true, sets:true, repTiers:true, storyGoals:true, events:true, gecko:true, crafting:true, leaderboards:true },
};
/* Tester jump menu (?test=1). Presets live in their own save slots so the real save is never touched. */
(function(){ try{
  const q=new URLSearchParams(location.search); if(q.get('test')==='1') sessionStorage.setItem('mwf_test','1'); if(q.get('test')==='0') sessionStorage.removeItem('mwf_test');
  const slot=localStorage.getItem('mwf_test_slot'); window.TEST_MODE=sessionStorage.getItem('mwf_test')==='1'||!!slot;
  if(slot) window.GAME_CONFIG.saveKey='mwfarms_test_'+slot; window.TEST_SLOT=slot||null;
}catch(e){} })();
