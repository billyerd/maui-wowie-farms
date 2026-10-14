/* Rewarded ads adapter.
 * mode 'test'   : simulated 15 s ad overlay with a countdown; reward only if the ad plays to the end (closing early = no reward).
 * mode 'admob' / 'applovin' : call a Capacitor rewarded-ad plugin exposed as window.NativeAds
 *   ({ load(unitId, opts), show(unitId, opts) -> {completed:boolean} }).
 * opts.personalized is true only after the player allows personalized ads.
 * opts.npa is true for non-personalized ads (pass this through to AdMob as npa=1 / AppLovin similar).
 * Rules (enforced in game.js): 5 gems per completed ad, +50 bonus gems at every 10th ad of the day, max 20 ads per day (200 gems max),
 * counters reset at local midnight.
 * Personalized ads stay off until Ads.setConsent('personalized'). 'contextual' allows non-personalized rewarded ads only.
 */
window.ADS_CONFIG = window.ADS_CONFIG || { mode:'test', testSeconds:15, units:{ admob:{ios:'',android:''}, applovin:{ios:'',android:''} } };
window.Ads = (function(){
  const CONSENT_KEY='mwfarms_ad_consent_v1';
  let busy=false;
  function mode(){ return ADS_CONFIG.mode; }
  function consent(){ const v=window.Store?Store.get(CONSENT_KEY):null; return v==='personalized'||v==='contextual'?v:null; }
  function setConsent(v){ if(v!=='personalized'&&v!=='contextual') return; if(window.Store) Store.set(CONSENT_KEY,v); }
  function personalized(){ return consent()==='personalized'; }
  function adOpts(unit){ return {unitId:unit, personalized:personalized(), npa:!personalized()}; }
  function testAd(){ return new Promise(res=>{
    const sec=ADS_CONFIG.testSeconds; let left=sec, done=false;
    const tag=personalized()?'TEST AD · simulated personalized ad':'TEST AD · simulated non-personalized ad';
    const o=document.createElement('div'); o.id='adOverlay';
    o.innerHTML=`<div class="adbox"><div class="adtag">${tag}</div><div class="adart"><div class="adwave"></div><b>Your ad here</b><span>Rewarded video placeholder</span></div>
      <div class="adbar"><i></i></div><div class="adrow"><span class="adcount">Reward in ${left}s</span><button class="btn sm sec" id="adClose">Close (no reward)</button></div></div>`;
    document.body.appendChild(o); const bar=o.querySelector('.adbar i'), cnt=o.querySelector('.adcount'), t0=performance.now();
    const fin=ok=>{ if(done) return; done=true; clearInterval(iv); o.remove(); res({completed:ok, personalized:personalized()}); };
    o.querySelector('#adClose').onclick=()=>fin(false);
    const iv=setInterval(()=>{ const el=(performance.now()-t0)/1000; left=Math.max(0,Math.ceil(sec-el)); bar.style.width=Math.min(100,el/sec*100)+'%'; cnt.textContent=left>0?`Reward in ${left}s`:'Done!';
      if(el>=sec){ const b=o.querySelector('#adClose'); b.textContent='Claim reward'; b.className='btn sm gold'; b.onclick=()=>fin(true); clearInterval(iv); } },100);
    window.__adFinish=fin; // test hook
  }); }
  async function nativeAd(){ const N=window.NativeAds; if(!N) return {completed:false,error:'Ads are not available yet'}; const plat=(window.Capacitor&&Capacitor.getPlatform&&Capacitor.getPlatform())||'web';
    const unit=(ADS_CONFIG.units[mode()]||{})[plat]; const opts=adOpts(unit);
    try{ if(N.load) await N.load(unit, opts); const r=await N.show(unit, opts); return {completed:!!(r&&r.completed), personalized:personalized()}; }catch(e){ return {completed:false,error:'Ad failed to load'}; } }
  async function show(){
    if(!consent()) return {completed:false, error:'Choose an ad preference before ads can play'};
    if(busy) return {completed:false, error:'busy'};
    busy=true;
    try{ return mode()==='test'?await testAd():await nativeAd(); }
    finally{ busy=false; }
  }
  return { get mode(){ return mode(); }, show, consent, setConsent, personalized, adOpts };
})();
