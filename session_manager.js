/* NEXMIR 5.1.20 · session lifecycle shared by the app and admin panel. */
(() => {
  'use strict';
  const IDLE_MS=60*60*1000, POLL_MS=15000;
  const nativeFetch=window.fetch.bind(window);
  let client,config={},session=null,lastActivity=0,poll=null,checking=null,ending=null,epoch=0;
  const read=k=>{try{return localStorage.getItem(k)}catch{return null}};
  const write=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
  const remove=k=>{try{localStorage.removeItem(k)}catch{}};
  const sid=s=>{try{return JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id}catch{return null}};
  const activityKey=s=>`nexmir_activity_v520:${s?.user?.id}:${sid(s||{})}`;
  const closedKey=s=>`nexmir_closed_v520:${s?.user?.id}:${sid(s||{})}`;
  const message=reason=>({expired:'Tu sesión se cerró después de una hora sin actividad. Inicia sesión para continuar.',replaced:'Tu sesión se cerró porque ingresaste a esta cuenta desde otro dispositivo.',logout:'Has cerrado sesión.'}[reason]||'Tu sesión terminó. Inicia sesión para continuar.');
  function reasonFrom(value){const s=JSON.stringify(value);if(s.includes('NEXMIR_SESSION_REPLACED'))return 'replaced';if(s.includes('NEXMIR_SESSION_EXPIRED'))return 'expired';if(s.includes('NEXMIR_SESSION_REQUIRED'))return 'required';return null}
  function stop(){clearInterval(poll);poll=null;epoch++;checking=null}
  function mergeActivity(){if(!session)return;const stored=Number(read(activityKey(session)));if(stored>lastActivity&&stored<=Date.now())lastActivity=stored}
  function expired(){mergeActivity();return !!session&&Date.now()-lastActivity>=IDLE_MS}
  function activity(event){
    if(!session||ending||document.hidden||event?.isTrusted===false)return;
    if(expired()){void end('expired');return}
    lastActivity=Date.now();write(activityKey(session),String(lastActivity));
  }
  // Token refreshes, focus changes and periodic API calls are not activity.
  for(const name of ['pointerdown','keydown','input','wheel','touchstart'])document.addEventListener(name,activity,{capture:true,passive:true});
  document.addEventListener('scroll',activity,{capture:true,passive:true});
  window.addEventListener('storage',event=>{
    if(!session)return;
    if(event.key===closedKey(session)&&event.newValue){void end('logout',false);return}
    if(event.key===activityKey(session))mergeActivity();
  });
  async function check(){
    if(!session||ending)return false;
    if(expired()){await end('expired');return false}
    if(document.hidden||checking)return checking||true;
    const generation=epoch;
    checking=(async()=>{
      try{
        const {data,error}=await client.rpc('nexmir_session_touch',{p_activity_at:new Date(lastActivity).toISOString()});
        if(generation!==epoch||!session)return false;
        if(error){const reason=reasonFrom(error);if(reason){await end(reason);return false}console.warn('Comprobación de sesión pendiente',error);return true}
        if(data?.status!=='active'){await end(data?.status||'required');return false}
        return true;
      }catch(error){console.warn('No se pudo comprobar la sesión',error);return true}
      finally{if(generation===epoch)checking=null}
    })();
    return checking;
  }
  for(const name of ['focus','online','pageshow'])window.addEventListener(name,()=>{if(session)void check()});
  document.addEventListener('visibilitychange',()=>{if(session&&!document.hidden)void check()});
  function forgetStorage(s){
    const key=config.storageKey;if(!key)return;
    // Do not remove a newer login that another tab has just stored.
    try{const stored=JSON.parse(read(key)||'null');if(!stored||sid(stored)===sid(s)){remove(key);remove(key+'-code-verifier');remove(key+'-user')}}catch{remove(key)}
  }
  async function end(reason='logout',revoke=true){
    if(ending)return ending;
    const old=session,oldClient=client;stop();session=null;
    if(old){write(closedKey(old),'1');remove(activityKey(old));forgetStorage(old)}
    config.onEnd?.(reason,message(reason));
    // End the UI before waiting on a mobile connection or the auth lock.
    ending=(async()=>{
      if(revoke&&old){
        const headers={'Content-Type':'application/json',apikey:config.key,Authorization:`Bearer ${old.access_token}`};
        void nativeFetch(config.url+'/rest/v1/rpc/nexmir_session_close',{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(4000)}).catch(()=>{});
      }
      if(oldClient){
        const work=oldClient.auth.signOut({scope:'local'}).catch(error=>console.warn('Cierre remoto pendiente',error));
        let handle;await Promise.race([work,new Promise(resolve=>{handle=setTimeout(resolve,4000)})]);clearTimeout(handle);
        if(old)forgetStorage(old);
      }
    })().finally(()=>{ending=null});
    return ending;
  }
  async function open(s,{fresh=false}={}){
    if(!s?.user||!sid(s))throw new Error('No se pudo identificar la sesión. Vuelve a ingresar.');
    if(ending)await ending;
    stop();const generation=epoch;
    const stored=Number(read(activityKey(s))),hasActivity=stored>0&&stored<=Date.now();
    session=s;lastActivity=hasActivity?stored:Date.now();
    if(read(closedKey(s))||(!fresh&&expired())){await end('expired');return false}
    try{
      const {data,error}=await client.rpc('nexmir_session_open',{p_device_id:deviceId(),p_device_label:deviceLabel(),p_takeover:fresh,p_activity_at:(fresh||hasActivity)?new Date(lastActivity).toISOString():null});
      if(generation!==epoch||session!==s)return false;
      if(error)throw error;
      if(data?.status!=='active'){await end(data?.status||'required');return false}
      // The server's activity timestamp survives lost/cleared browser metadata.
      lastActivity=Math.min(lastActivity,new Date(data.last_active_at).getTime());
      if(!Number.isFinite(lastActivity))throw new Error('Respuesta de sesión inválida.');
      write(activityKey(s),String(lastActivity));
      if(expired()){await end('expired');return false}
      poll=setInterval(()=>{void check()},POLL_MS);
      return true;
    }catch(error){
      if(generation===epoch){stop();session=null}
      const missing=/PGRST202|nexmir_session_open.*(not find|does not exist)/i.test(JSON.stringify(error));
      throw new Error(missing?'Ejecuta SESIONES_5_1_20.sql en Supabase para activar el acceso de esta versión.':(error.message||'No se pudo verificar tu sesión. Comprueba la conexión y vuelve a intentar.'));
    }
  }
  function observe(s){if(!session||sid(session)!==sid(s||{}))return false;session=s;return true}
  function reset(){stop();session=null}
  function deviceId(){let id=read('nexmir_device_v1');if(!id){id=crypto.randomUUID?.()||('dev_'+Date.now()+'_'+Math.random().toString(36).slice(2));write('nexmir_device_v1',id)}return id}
  function deviceLabel(){const ua=navigator.userAgent;const b=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Navegador';return `${b} · ${navigator.platform||'dispositivo'}`}
  async function sessionFetch(input,init){
    const response=await nativeFetch(input,init);
    if(!response.ok&&session){
      try{const reason=reasonFrom(await response.clone().json());if(reason)setTimeout(()=>{void end(reason)},0)}catch{}
    }
    return response;
  }
  window.NexmirSessions={IDLE_MS,configure(c){config=c;client=c.client},open,observe,check,end,reset,deviceId,deviceLabel,fetch:sessionFetch,active:()=>!!session&&!ending};
})();
