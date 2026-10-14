/* Maui Wowie Farms payments (provider abstraction).
 * The game calls only:  Payments.purchase(productId) -> Promise<{ok, productId, mode, txId?, error?}>
 *                       Payments.restore()           -> Promise<{ok, restored:[productIds]}>
 * Providers (pick with PAYMENTS_CONFIG.mode, or 'auto'):
 *   'test'     : no money moves. Clear TEST MODE confirm, grants locally. (current default)
 *   'stripe'   : web only. Stripe Payment Link redirect. NOT allowed inside the iOS/Android apps for digital goods.
 *   'appstore' : Apple In-App Purchase (StoreKit) via a Capacitor plugin.
 *   'play'     : Google Play Billing via a Capacitor plugin.
 * 'auto' picks appstore on iOS native, play on Android native, otherwise test.
 *
 * Real-money grants go through verifyWithServer. Set PAYMENTS_CONFIG.verifyEndpoint to your
 * HTTPS verifier (see docs/receipt-verification.md). The client POSTs
 * {kind:'apple'|'google'|'stripe', token, productId} and grants only when the JSON body is
 * {paid:true, productId:<same id>}. Test mode never calls the server.
 * A missing endpoint, a network error, or paid:false grants nothing.
 * Never put a store secret or Stripe secret in this file.
 */
(function(){
  window.PAYMENTS_CONFIG = Object.assign({ mode:'test', verifyEndpoint:'' }, window.PAYMENTS_CONFIG||{});
  const PAYMENTS_CONFIG = window.PAYMENTS_CONFIG;
  // App Store / Play mode turns the tester panel off before the panel script runs.
  if(window.applyTesterLock) window.applyTesterLock();
  const STRIPE_PAYMENT_LINKS = { gems_s:'', gems_m:'', gems_l:'', gems_xl:'', starter:'', pass2x:'', vip:'', theme_neon:'', theme_plumeria:'', theme_mauna:'' };
  const ENT_KEY='mwfarms_entitlements_v1', PENDING_KEY='mwfarms_pending_purchase_v1';
  let grantHandler=null, confirmUI=null;

  function mapProductId(id){
    const M=window.STRAIN_MIGRATIONS||{};
    if(!id) return id;
    for(const [o,n] of Object.entries(M)){
      if(id==='strain_'+o+'_g') return 'strain_'+n+'_g';
      if(id==='strain_'+o) return 'strain_'+n;
    }
    return id;
  }
  function loadEnt(){
    const e=Store.getJSON(ENT_KEY,null) || {tx:{}, owned:{}};
    if(!e.tx) e.tx={}; if(!e.owned) e.owned={};
    if(e.idMig>=1) return e;
    const tx={};
    for(const [k,v] of Object.entries(e.tx)){
      if(v&&v.productId) v.productId=mapProductId(v.productId);
      tx[k]=v;
    }
    const owned={};
    for(const [k,v] of Object.entries(e.owned)){ if(v) owned[mapProductId(k)]=true; }
    e.tx=tx; e.owned=owned; e.idMig=1; saveEnt(e);
    return e;
  }
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
  // Server receipt check. Real-money providers call this and grant only when paid is true.
  async function verifyWithServer(kind, token, productId){
    const url=String(PAYMENTS_CONFIG.verifyEndpoint||'').trim();
    if(!url) return {paid:false, error:'Receipt verification is not configured'};
    if(!token) return {paid:false, error:'Missing receipt'};
    let r;
    try{
      r=await fetch(url,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({kind, token, productId})});
    }catch(e){ return {paid:false, error:'Could not reach the receipt server'}; }
    if(!r.ok) return {paid:false, error:'Receipt was not accepted'};
    let j; try{ j=await r.json(); }catch(e){ return {paid:false, error:'Receipt server sent an unreadable response'}; }
    if(j&&j.paid===true&&j.productId===productId) return {paid:true, txId:j.txId||null};
    return {paid:false, error:(j&&j.error)||'Receipt was not accepted'};
  }

  const providers={
    test:{ async purchase(p){ const yes=confirmUI?await confirmUI(p):true; if(!yes) return {ok:false,productId:p.id,error:'cancelled'}; return grant(p.id,rid(),'test'); }, async restore(){ return []; } },
    stripe:{ async purchase(p){ const link=STRIPE_PAYMENT_LINKS[p.id]; if(!link) return {ok:false,productId:p.id,error:'Store not configured yet'};
        if(!String(PAYMENTS_CONFIG.verifyEndpoint||'').trim()) return {ok:false,productId:p.id,error:'Receipt verification is not configured'};
        const nonce=rid(); Store.setJSON(PENDING_KEY,{productId:p.id,nonce,at:Date.now()}); const u=new URL(link); u.searchParams.set('client_reference_id',nonce); window.location.href=u.toString(); return {ok:false,productId:p.id,pending:true}; },
      async restore(){ return []; } },
    // Native: NativeIAP.purchase(productId) -> {transactionId|purchaseToken, receipt?}. Finish only after the server accepts the receipt.
    appstore:{ async purchase(p){ const IAP=window.NativeIAP; if(!IAP) return {ok:false,productId:p.id,error:'In-app purchases are not available yet'};
        const r=await IAP.purchase(p.id); if(!r||!r.transactionId) return {ok:false,productId:p.id,error:'cancelled'};
        const v=await verifyWithServer('apple', r.receipt||r.transactionId, p.id); if(!v.paid) return {ok:false,productId:p.id,error:v.error||'not verified'};
        const out=grant(p.id, v.txId||('apple_'+r.transactionId), 'appstore'); if(out.ok&&IAP.finish) await IAP.finish(r.transactionId); return out; },
      async restore(){ const IAP=window.NativeIAP; if(!IAP||!IAP.restore) return []; return (await IAP.restore())||[]; } },
    play:{ async purchase(p){ const IAP=window.NativeIAP; if(!IAP) return {ok:false,productId:p.id,error:'In-app purchases are not available yet'};
        const r=await IAP.purchase(p.id); if(!r||!r.purchaseToken) return {ok:false,productId:p.id,error:'cancelled'};
        const v=await verifyWithServer('google', r.purchaseToken, p.id); if(!v.paid) return {ok:false,productId:p.id,error:v.error||'not verified'};
        const out=grant(p.id, v.txId||('play_'+r.purchaseToken.slice(0,40)), 'play'); if(out.ok&&IAP.finish) await IAP.finish(r.purchaseToken, !p.once); return out; },
      async restore(){ const IAP=window.NativeIAP; if(!IAP||!IAP.restore) return []; return (await IAP.restore())||[]; } },
  };

  async function purchase(productId){
    const p=window.PRODUCTS[productId];
    if(!p||p.kind!=='usd') return {ok:false,productId,error:'not a real-money product'};
    if(p.once&&loadEnt().owned[productId]) return {ok:false,productId,error:'already owned'};
    const pr=providers[mode()]; if(!pr) return {ok:false,productId,error:'payments disabled'};
    try{ return await pr.purchase(Object.assign({id:productId},p)); }catch(e){ return {ok:false,productId,error:String(e&&e.message||e)}; }
  }
  // Restore non-consumables (required by Apple). Real stores must return {productId, token} and pass verifyWithServer.
  async function restore(){
    const m=mode(); const pr=providers[m]; let rows=[]; try{ rows=await pr.restore()||[]; }catch(e){}
    const out=[];
    for(const row of rows){
      const id=mapProductId(typeof row==='string'?row:row&&row.productId);
      const token=row&&typeof row==='object'?(row.token||row.receipt||row.purchaseToken):null;
      const p=id&&window.PRODUCTS[id];
      if(!p||!p.once||loadEnt().owned[id]) continue;
      if(m==='test'){ const r=grant(id,'restore_'+id,m); if(r.ok&&!r.duplicate) out.push(id); continue; }
      if(!token) continue;
      const kind=m==='appstore'?'apple':m==='play'?'google':'stripe';
      const v=await verifyWithServer(kind, token, id);
      if(!v.paid) continue;
      const r=grant(id, v.txId||('restore_'+id), m);
      if(r.ok&&!r.duplicate) out.push(id);
    }
    return {ok:true,restored:out};
  }
  // Web only: completes a Stripe redirect purchase after the server accepts the Checkout session.
  async function handleReturn(){
    const q=new URLSearchParams(location.search); if(q.get('purchase')!=='success') return null;
    const pid=q.get('pid'), sid=q.get('session_id')||''; const pending=Store.getJSON(PENDING_KEY,null);
    if(!pending||pending.productId!==pid){ history.replaceState(null,'',location.pathname); return {ok:false,productId:pid,error:'no matching pending purchase'}; }
    const v=await verifyWithServer('stripe', sid, pid);
    if(!v.paid) return {ok:false,productId:pid,error:v.error||'payment not verified'};
    history.replaceState(null,'',location.pathname);
    Store.remove(PENDING_KEY);
    return grant(pid, v.txId||('stripe_'+(sid||pending.nonce)), 'stripe');
  }
  window.Payments={ purchase, restore, handleReturn, get mode(){ return mode(); }, platform, verifyWithServer,
    isOwned:id=>!!loadEnt().owned[id], markOwned:id=>{ const e=loadEnt(); e.owned[id]=true; saveEnt(e); },
    onGrant:fn=>{ grantHandler=fn; }, setConfirmUI:fn=>{ confirmUI=fn; }, formatUSD:n=>'$'+Number(n).toFixed(2) };
})();
