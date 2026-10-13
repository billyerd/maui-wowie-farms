/* Leaderboards with a pluggable provider.
   'local' (now): offline boards stored on this device. Your scores are ranked against a fixed set of fictional
   island growers (clearly labelled as computer rivals), so the board works with no server.
   Later: set Leaderboard.useProvider(adapter) with submit(board,score) / top(board) backed by
   Game Center (iOS) or Play Games Services (Android) via a Capacitor plugin, or your own server. */
window.Leaderboard=(function(){
  const KEY='mwfarms_leaderboard_v1';
  const BOARDS={
    season:{name:'Best season earnings', fmt:'cash'},
    lifetime:{name:'Lifetime earnings', fmt:'cash'},
    strains:{name:'Strains discovered', fmt:'num'},
    level:{name:'Grower level', fmt:'num'},
    phenos:{name:'Mystery phenos found', fmt:'num'},
  };
  const RIVALS=['Auntie Malama','Kimo of Hanalei','Big Wave Dave','Leilani K.','Uncle Bo','Makana Farms','Pua and Sons','Koa Ridge Co-op','Surfer Jake','Hilltop Hank'];
  const SCALE={season:[2e4,6e4,2e5,6e5,1.5e6,4e6,1e7,3e7,8e7,2e8],lifetime:[5e4,2e5,8e5,3e6,1e7,4e7,1.5e8,6e8,2e9,8e9],strains:[6,9,12,16,21,26,32,38,44,50],level:[4,7,10,13,17,21,26,31,37,45],phenos:[0,1,1,2,3,4,6,8,11,15]};
  let provider=null; const mine=Object.assign({},(window.Store&&Store.getJSON(KEY,{}))||{});
  function submit(board,score){ if(!BOARDS[board]||!(score>=0)) return; if(!(mine[board]>=score)){ mine[board]=score; Store.setJSON(KEY,mine); }
    if(provider&&provider.submit) provider.submit(board,score).catch(()=>{}); }
  async function top(board,myName){ if(provider&&provider.top){ try{ return await provider.top(board); }catch(e){} }
    const L=RIVALS.map((n,i)=>({name:n,score:SCALE[board][i],rival:true})); L.push({name:myName||'You',score:mine[board]||0,me:true});
    return L.sort((a,b)=>b.score-a.score).map((r,i)=>Object.assign(r,{rank:i+1})); }
  return {BOARDS,submit,top,best:b=>mine[b]||0,useProvider:p=>{ provider=p; },get online(){ return !!provider; }};
})();
