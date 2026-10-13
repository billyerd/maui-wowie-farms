/* Maui Wowie Farms payments (provider abstraction).
 * The game calls only:  Payments.purchase(productId) -> Promise<{ok, productId, mode, txId?, error?}>
 *                       Payments.restore()           -> Promise<{ok, restored:[productIds]}>
 * Providers (pick with PAYMENTS_CONFIG.mode, or 'auto'):
 *   'test'     : no money moves. Clear TEST MODE confirm, grants locally. (current default)
 *   'stripe'   : web only. Stripe Payment Link redirect. NOT allowed inside the iOS/Android apps for digital goods.
 *   'appstore' : Apple In-App Purchase (StoreKit) via a Capacitor plugin - stub below, wire before App Store release.
 *   'play'     : Google Play Billing via a Capacitor plugin - stub below, wire before Play release.
 * 'auto' picks appstore on iOS native, play on Android native, otherwise test (or stripe once configured).
 *
 * TODO before real money:
 *  - Stripe: one Payment Link per USD product; redirect to https://<site>/?purchase=success&pid=<id>&session_id={CHECKOUT_SESSION_ID};
 *    verify on a server (webhook checkout.session.completed) before granting. Never put a secret key here.
 *  - App Store / Play: create products with the SAME ids as products.js (consumables: gems_*, starter;
 *    non-consumables: pass2x, vip, theme_*). Verify receipts server-side (App Store Server API / Play Developer API).
 *    Apple requires a visible "Restore purchases" button (Settings has one) for non-consumables.
 */
(function(){
  const PAYMENTS_CONFIG = { mode:'test', verifyEndpoint:null };
  const STRIPE_PAYMENT_LINKS = { gems_s:'', gems_m:'', gems_l:'', gems_xl:'', starter:'', pass2x:'', vip:'', theme_neon:'', theme_plumeria:'', theme_mauna:'' };
  const ENT_KEY='mwfarms_entitlements_v1', PENDING_KEY='mwfarms_pending_purchase_v1';
  let grantHandler=null, confirmUI=null;

  function loadEnt(){ return Store.getJSON(ENT_KEY,null) || {tx:{}, owned:{}}; }
  function saveEnt(e){ Store.setJSON(ENT_KEY,e); }
  function rid(){ return 'tx_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10); }
  function platform(){ try{ const C=window.Capacitor; if(C&&C.isNativePlatform&&C.isNativePlatform()) return C.getPlatform(); }catch(e){} return 'web'; }
  function mode(){ if(PAYMENTS_CONFIG.mode!=='auto') return PAYMENTS_CONFIG.mode; const p=platform(); return p==='ios'?'appstore':p==='android'?'play':'test'; }

  // Idempotent grant: a transaction id is only ever granted once.
  function grant(productId, txId, m){
    const p=window.PRODUCTS[productId]; if(!p) return {ok:false,productId,error:'unknown product'};
    const ent=loadEnt(); if(ent.tx[txId]) return {ok:true,productId,mode:m,txId,duplicate:true};
    if(p.once&&ent.owned[productId]) return {ok:false,productId,error:'already owned'};
    ent.tx[txId]={productId,mode:m,at:Date.now()}; if(p.once) ent.owned[productId]=true; saveEnt(ent);
    if(grantHandler) grantHandler(p,txId,m);
    return {ok:true,productId,mode:m,txId};
  }
  async function verifyWithServer(kind, token, productId){
    if(!PAYMENTS_CONFIG.verifyEndpoint) return {paid:true,unverified:true};
    const r=await fetch(PAYMENTS_CONFIG.verifyEndpoint+'?kind='+kind+'&token='+encodeURIComponent(token)+'&pid='+encodeURIComponent(productId));
    if(!r.ok) return {paid:false}; const j=await r.json(); return {paid:!!j.paid&&j.productId===productId};
  }

  const providers={
    test:{ async purchase(p){ const yes=confirmUI?await confirmUI(p):true; if(!yes) return {ok:false,productId:p.id,error:'cancelled'}; return grant(p.id,rid(),'test'); }, async restore(){ return []; } },
    stripe:{ async purchase(p){ const link=STRIPE_PAYMENT_LINKS[p.id]; if(!link) return {ok:false,productId:p.id,error:'Store not configured yet'};
        const nonce=rid(); Store.setJSON(PENDING_KEY,{productId:p.id,nonce,at:Date.now()}); const u=new URL(link); u.searchParams.set('client_reference_id',nonce); window.location.href=u.toString(); return {ok:false,productId:p.id,pending:true}; },
      async restore(){ return []; } },
    // Native stubs: replace the bodies with calls to your chosen Capacitor IAP plugin.
    appstore:{ async purchase(p){ const IAP=window.NativeIAP; if(!IAP) return {ok:false,productId:p.id,error:'In-app purchases are not available yet'};
        const r=await IAP.purchase(p.id); if(!r||!r.transactionId) return {ok:false,productId:p.id,error:'cancelled'};
        const v=await verifyWithServer('apple',r.receipt||r.transactionId,p.id); if(!v.paid) return {ok:false,productId:p.id,error:'not verified'};
        const out=grant(p.id,'apple_'+r.transactionId,'appstore'); if(IAP.finish) await IAP.finish(r.transactionId); return out; },
      async restore(){ const IAP=window.NativeIAP; if(!IAP||!IAP.restore) return []; return (await IAP.restore())||[]; } },
    play:{ async purchase(p){ const IAP=window.NativeIAP; if(!IAP) return {ok:false,productId:p.id,error:'In-app purchases are not available yet'};
        const r=await IAP.purchase(p.id); if(!r||!r.purchaseToken) return {ok:false,productId:p.id,error:'cancelled'};
        const v=await verifyWithServer('google',r.purchaseToken,p.id); if(!v.paid) return {ok:false,productId:p.id,error:'not verified'};
        const out=grant(p.id,'play_'+r.purchaseToken.slice(0,40),'play'); if(IAP.finish) await IAP.finish(r.purchaseToken,!p.once); return out; },
      async restore(){ const IAP=window.NativeIAP; if(!IAP||!IAP.restore) return []; return (await IAP.restore())||[]; } },
  };

  async function purchase(productId){
    const p=window.PRODUCTS[productId];
    if(!p||p.kind!=='usd') return {ok:false,productId,error:'not a real-money product'};
    if(p.once&&loadEnt().owned[productId]) return {ok:false,productId,error:'already owned'};
    const pr=providers[mode()]; if(!pr) return {ok:false,productId,error:'payments disabled'};
    try{ return await pr.purchase(Object.assign({id:productId},p)); }catch(e){ return {ok:false,productId,error:String(e&&e.message||e)}; }
  }
  // Restore non-consumables (required by Apple). Returns product ids newly granted.
  async function restore(){
    const pr=providers[mode()]; let ids=[]; try{ ids=await pr.restore(); }catch(e){}
    const out=[]; ids.forEach(id=>{ const p=window.PRODUCTS[id]; if(p&&p.once&&!loadEnt().owned[id]){ const r=grant(id,'restore_'+id,mode()); if(r.ok) out.push(id); } });
    return {ok:true,restored:out};
  }
  // Web only: completes a Stripe redirect purchase.
  async function handleReturn(){
    const q=new URLSearchParams(location.search); if(q.get('purchase')!=='success') return null;
    const pid=q.get('pid'), sid=q.get('session_id')||''; const pending=Store.getJSON(PENDING_KEY,null);
    history.replaceState(null,'',location.pathname);
    if(!pending||pending.productId!==pid) return {ok:false,productId:pid,error:'no matching pending purchase'};
    const v=await verifyWithServer('stripe',sid,pid); if(!v.paid) return {ok:false,productId:pid,error:'payment not verified'};
    Store.remove(PENDING_KEY); return grant(pid,'stripe_'+(sid||pending.nonce),'stripe');
  }
  window.Payments={ purchase, restore, handleReturn, get mode(){ return mode(); }, platform,
    isOwned:id=>!!loadEnt().owned[id], markOwned:id=>{ const e=loadEnt(); e.owned[id]=true; saveEnt(e); },
    onGrant:fn=>{ grantHandler=fn; }, setConfirmUI:fn=>{ confirmUI=fn; }, formatUSD:n=>'$'+n.toFixed(2) };
})();
