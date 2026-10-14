/* Storage wrapper. The game only talks to Store (sync get/set/remove on an in-memory mirror).
   Web: backed by localStorage. Native (Capacitor): call Store.useBackend(adapter) before boot, where adapter has
   async get(key)/set(key,value)/remove(key) - e.g. @capacitor/preferences - then await Store.preload([...keys]).
   set/remove return {ok:false, error, message} when the write fails (quota, private mode). The in-memory
   value is rolled back so a failed write does not pretend the disk copy changed. */
window.Store=(function(){
  const mem={}; let backend=null, failFn=null;
  const fail=(e)=>({ok:false, error:e&&e.name||'Error', message:e&&e.message||'Could not write the save'});
  const ls={
    get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } },
    set:(k,v)=>{ try{ localStorage.setItem(k,v); return {ok:true}; }catch(e){ return fail(e); } },
    remove:k=>{ try{ localStorage.removeItem(k); return {ok:true}; }catch(e){ return fail(e); } }
  };
  function rollback(k,had,prev){ if(had) mem[k]=prev; else delete mem[k]; }
  function get(k){ if(k in mem) return mem[k]; const v=backend?null:ls.get(k); mem[k]=v; return v; }
  function set(k,v){
    const had=k in mem, prev=mem[k];
    mem[k]=v;
    if(backend){
      Promise.resolve().then(()=>backend.set(k,v)).catch(e=>{ rollback(k,had,prev); if(failFn) failFn(k,fail(e)); });
      return {ok:true, pending:true};
    }
    const r=ls.set(k,v);
    if(!r.ok) rollback(k,had,prev);
    return r;
  }
  function remove(k){
    const had=k in mem, prev=mem[k];
    delete mem[k];
    if(backend){
      Promise.resolve().then(()=>backend.remove(k)).catch(e=>{ rollback(k,had,prev); if(failFn) failFn(k,fail(e)); });
      return {ok:true, pending:true};
    }
    const r=ls.remove(k);
    if(!r.ok) rollback(k,had,prev);
    return r;
  }
  function onWriteFail(fn){ failFn=fn; }
  function useBackend(a){ backend=a; }
  async function preload(keys){ if(!backend) return; for(const k of keys){ try{ mem[k]=await backend.get(k); }catch(e){ mem[k]=null; } } }
  const getJSON=(k,d)=>{ try{ const v=get(k); return v?JSON.parse(v):d; }catch(e){ return d; } };
  const setJSON=(k,v)=>set(k,JSON.stringify(v));
  return {get,set,remove,getJSON,setJSON,useBackend,preload,onWriteFail};
})();
