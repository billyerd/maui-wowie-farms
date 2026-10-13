/* Storage wrapper. The game only talks to Store (sync get/set/remove on an in-memory mirror).
   Web: backed by localStorage. Native (Capacitor): call Store.useBackend(adapter) before boot, where adapter has
   async get(key)/set(key,value)/remove(key) - e.g. @capacitor/preferences - then await Store.preload([...keys]). */
window.Store=(function(){
  const mem={}; let backend=null;
  const ls={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} }, remove:k=>{ try{ localStorage.removeItem(k); }catch(e){} } };
  function get(k){ if(k in mem) return mem[k]; const v=backend?null:ls.get(k); mem[k]=v; return v; }
  function set(k,v){ mem[k]=v; if(backend) backend.set(k,v).catch(()=>{}); else ls.set(k,v); }
  function remove(k){ delete mem[k]; if(backend) backend.remove(k).catch(()=>{}); else ls.remove(k); }
  function useBackend(a){ backend=a; }
  async function preload(keys){ if(!backend) return; for(const k of keys){ try{ mem[k]=await backend.get(k); }catch(e){ mem[k]=null; } } }
  const getJSON=(k,d)=>{ try{ const v=get(k); return v?JSON.parse(v):d; }catch(e){ return d; } };
  const setJSON=(k,v)=>set(k,JSON.stringify(v));
  return {get,set,remove,getJSON,setJSON,useBackend,preload};
})();
