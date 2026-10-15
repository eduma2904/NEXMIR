/* NEXMIR V5.1.50 · caché local SOLO del catálogo publicado (flashcards y preguntas).
   Nunca guarda perfil, rol, plan, permisos, repasos, intentos ni nada personal.
   Si algo falla, la app carga como siempre desde Supabase. */
(function(){
  'use strict';
  const DB='nexmir_boot',STORE='catalog',VERSION=1;
  function open(){return new Promise((resolve,reject)=>{
    if(!window.indexedDB)return reject(new Error('sin IndexedDB'));
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('bloqueada'));
  })}
  function withTimeout(p,ms){return Promise.race([p,new Promise(res=>setTimeout(()=>res(null),ms))])}
  async function read(uid){
    try{
      return await withTimeout((async()=>{
        const db=await open();
        return await new Promise(resolve=>{
          const q=db.transaction(STORE,'readonly').objectStore(STORE).get(uid);
          q.onsuccess=()=>{const v=q.result;db.close();resolve(v&&v.v===VERSION&&v.uid===uid&&Array.isArray(v.content)&&Array.isArray(v.questions)?v:null)};
          q.onerror=()=>{db.close();resolve(null)};
        });
      })(),1500);
    }catch(e){return null}
  }
  async function write(uid,content,questions){
    try{
      const db=await open();
      await new Promise(resolve=>{
        const tx=db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).put({v:VERSION,uid,savedAt:Date.now(),content,questions},uid);
        tx.oncomplete=tx.onerror=tx.onabort=()=>{db.close();resolve()};
      });
    }catch(e){/* la caché es opcional */}
  }
  async function clear(){
    try{const db=await open();await new Promise(resolve=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=tx.onerror=tx.onabort=()=>{db.close();resolve()}})}catch(e){}
  }
  window.NexmirBootCache={read,write,clear};
})();
