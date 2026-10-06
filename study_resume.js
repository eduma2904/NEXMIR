/* Restore the user's view and unfinished study after a browser refresh. */
(() => {
  const key=()=>`nexmir_study_resume:${state.user?.id}`;
  const qkey=q=>`${q._source||'questions'}:${q.id}`;
  function read(){try{return JSON.parse(localStorage.getItem(key())||'null')}catch{return null}}
  function save(){
    if(!state.user||state.deviceBlocked)return false;
    const value={view:state.view,focusOpen:!!document.querySelector('#focusSessionDialog[open]')};
    const bank=state.bank;
    if(bank?.pool?.length&&(!bank.submitted||document.querySelector('#questionDialog[open] .bank-results-shell'))){
      value.bank={keys:bank.pool.map(qkey),index:bank.index,mode:bank.mode,context:bank.context,submitted:!!bank.submitted,
        answers:Object.fromEntries(Object.entries(bank.answers||{}).map(([k,a])=>[k,{...a,saving:false}])),
        highlights:bank.highlights||{},eliminations:bank.eliminations||{},activity:window.nexmirBankCheckpoint?.()};
    }
    try{localStorage.setItem(key(),JSON.stringify(value));window.nexmirStudySaveFailed=false;return true}
    catch{if(!window.nexmirStudySaveFailed)toast('No se pudo guardar en este navegador. Mantén esta pestaña abierta hasta enviar las respuestas.');window.nexmirStudySaveFailed=true;return false}
  }
  let restoring=false;
  window.nexmirSaveStudy=save;
  window.nexmirClearStudyResume=()=>{try{localStorage.removeItem(key());localStorage.removeItem(`nexmir_focus_checkpoint:${state.user?.id}`)}catch{}};
  window.nexmirRestoreStudy=()=>{
    const saved=read();if(!saved||state.deviceBlocked)return false;
    restoring=true;
    (async()=>{
      await route(Object.hasOwn(viewNames,saved.view)?saved.view:'dashboard');
      if(saved.focusOpen){
        await window.nexmirFocusReadyPromise;
        if(state.focusActiveSession){await resumeNexmirFocus();return}
      }
      if(saved.bank){
        const map=new Map(questionPool().map(q=>[qkey(q),q])),pool=saved.bank.keys.map(k=>map.get(k));
        if(pool.some(q=>!q)){toast('Parte del banco cambió. Inicia un nuevo bloque para usar el contenido actualizado.');return}
        const b=saved.bank;state.bank={...b,pool,index:Math.min(b.index||0,pool.length-1),selected:null,answered:false,results:[]};window.nexmirRestoreBankCheckpoint?.(b.activity);
        if(b.submitted){state.bank.results=pool.map(q=>{const selected=b.answers?.[bankQKey(q)]?.selected??null;return {q,selected,correct:selected===null?null:+selected===+q.correct_index}});renderBankResults()}
        else showQuestion();
      }
    })().catch(error=>{console.error('Restaurar estudio',error);toast('No se pudo reabrir el estudio. Tu sesión Focus sigue disponible en Continuar.')}).finally(()=>{restoring=false;save()});
    return true;
  };
  const oldRoute=window.route;
  window.route=async function(...args){const result=await oldRoute.apply(this,args);if(!restoring)save();return result};
  const oldRenderBank=window.renderBank;
  window.renderBank=function(...args){
    const result=oldRenderBank.apply(this,args),saved=read();
    if(saved?.bank&&!saved.bank.submitted&&!document.getElementById('resumeBankCard')){
      const box=document.createElement('div');box.id='resumeBankCard';box.className='card resume-bank-card';
      const answered=Object.values(saved.bank.answers||{}).filter(a=>Number.isInteger(a?.selected)).length;
      box.innerHTML=`<div><strong>Banqueo pendiente</strong><p class="muted">${answered} de ${saved.bank.keys.length} respuestas seleccionadas. Continúa donde lo dejaste.</p></div><button class="btn primary" type="button">Continuar banqueo</button>`;
      box.querySelector('button').onclick=()=>window.nexmirRestoreStudy();document.getElementById('view-bank')?.prepend(box);
    }
    return result;
  };
  for(const name of ['showQuestion','selectOption','goBankQuestion','renderBankResults','toggleBankDiscard','highlightSelection','clearQuestionHighlights']){
    const original=window[name];if(typeof original!=='function')continue;
    window[name]=function(...args){const result=original.apply(this,args);if(!restoring)save();return result};
  }
  for(const id of ['focusSessionDialog','questionDialog']){
    const d=document.getElementById(id);if(!d)continue;
    new MutationObserver(()=>{if(!restoring)save()}).observe(d,{attributes:true,attributeFilter:['open']});
    d.addEventListener('close',()=>{if(!restoring)save()});
  }
  window.addEventListener('pagehide',save);
})();
