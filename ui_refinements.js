/* NEXMIR 5.1.46: registro local de errores de código para diagnóstico (no depende de la consola). */
(()=>{
  const KEY='nexmir_last_client_errors';
  window.nexmirReportClientError=(error,where='')=>{
    try{
      const list=JSON.parse(sessionStorage.getItem(KEY)||'[]');
      list.push({at:new Date().toISOString(),where,name:error?.name||'Error',message:String(error?.message||error).slice(0,300),stack:String(error?.stack||'').split('\n').slice(0,4).join(' | ').slice(0,500)});
      sessionStorage.setItem(KEY,JSON.stringify(list.slice(-20)));
    }catch{}
  };
  window.addEventListener('error',e=>window.nexmirReportClientError(e.error||e.message,'window.onerror'));
  window.addEventListener('unhandledrejection',e=>window.nexmirReportClientError(e.reason,'unhandledrejection'));
})();
/* NEXMIR 5.1.1: shared loading and searchable Focus selectors. */
(() => {
  const loadingTasks={
    createBattle:'Creando la sala…',
    joinBattle:'Entrando a la batalla…',
    startBattleRoom:'Iniciando la batalla…',
    answerBattle:'Enviando tu respuesta…',
    openBattleReview:'Cargando la revisión…',
    confirmNexmirFocus:'Preparando sesión Focus…',
    resumeNexmirFocus:'Recuperando sesión Focus…',
    finishFocusEarly:'Guardando tu sesión…',
    finishBank:'Enviando respuestas…',
    finishMirSimulation:'Guardando el simulacro…',
    saveStudyPlan:'Guardando tu plan…',
    submitFeatureSuggestion:'Enviando sugerencia…',
    resendVerification:'Enviando correo…',
    saveErrorEntry:'Guardando el repaso…',
    markQuestionDoubt:'Guardando la pregunta…',
    saveProfile:'Guardando tu perfil…',
    deleteReviewCardAsAdmin:'Eliminando la flashcard…',
    deleteQuestionAsAdmin:'Eliminando la pregunta…'
  };
  window.NexmirLoading={
    run(work,label='Cargando…'){return runPlanLoading(work,label)},
    get active(){return runPlanLoading.pending>0}
  };
  for(const [name,label] of Object.entries(loadingTasks)){
    const original=window[name];
    if(typeof original!=='function')continue;
    let pending=false;
    window[name]=async function(...args){
      if(pending)return;
      pending=true;
      try{return await runPlanLoading(()=>original.apply(this,args),label)}
      catch(error){window.nexmirReportClientError?.(error,name);console.error('[NEXMIR]',name,error);const code=(error&&(error.name==='ReferenceError'||error.name==='TypeError'))?` (código ${name})`:'';const detail=error&&error.message&&!/is not defined|is not a function|undefined|null|Cannot read/i.test(error.message)?' '+error.message:'';toast('No se pudo completar la operación. Inténtalo de nuevo.'+detail+code)}
      finally{pending=false}
    };
  }
  const picker=document.createElement('dialog');
  picker.id='selectPickerDialog';picker.className='dialog select-picker';
  picker.setAttribute('aria-labelledby','selectPickerTitle');
  picker.innerHTML='<div class="dialog-head"><h3 id="selectPickerTitle">Seleccionar</h3><button class="icon-btn" type="button" aria-label="Cerrar">×</button></div><input type="search" aria-label="Buscar opciones" placeholder="Buscar…"><div class="select-picker-options"></div>';
  document.body.append(picker);
  const search=picker.querySelector('input'),list=picker.querySelector('.select-picker-options');
  let source=null;
  picker.querySelector('button').onclick=()=>picker.close();
  function draw(){
    list.replaceChildren();
    const query=search.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    for(const option of source.options){
      if(!option.text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query))continue;
      const button=document.createElement('button');button.type='button';
      button.className='picker-option';button.textContent=(option.selected?'✓  ':'')+option.text;
      button.setAttribute('aria-pressed',String(option.selected));button.disabled=option.disabled;
      button.onclick=()=>{source.value=option.value;source.dispatchEvent(new Event('change',{bubbles:true}));sync();picker.close()};
      list.append(button);
    }
    if(!list.children.length)list.textContent='No hay coincidencias.';
  }
  search.oninput=draw;
  picker.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      const options=[...list.querySelectorAll('button:not(:disabled)')];
      if(!options.length)return;event.preventDefault();
      const index=options.indexOf(document.activeElement);
      options[(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length].focus();
    }
  });
  const pickerLabels={
    focusSubject:'Elegir asignatura',focusTopic:'Elegir tema',
    reviewSpecialty:'Elegir asignatura',reviewTopic:'Elegir tema',reviewSubtopic:'Elegir subtema',
    goalSpecialty:'Elegir especialidad MIR',adaptivePlanSpecialty:'Elegir especialidad',studyDiagnosticSpecialty:'Elegir especialidad'
  };
  function sync(){
    for(const select of document.querySelectorAll(Object.keys(pickerLabels).map(id=>'#'+id).join(','))){
      let trigger=select.nextElementSibling;
      if(!trigger?.classList.contains('select-trigger')){
        trigger=document.createElement('button');trigger.type='button';trigger.className='select-trigger';
        trigger.setAttribute('aria-haspopup','dialog');
        select.after(trigger);select.hidden=true;
        trigger.onclick=()=>{source=select;search.value='';picker.querySelector('h3').textContent=pickerLabels[select.id]||'Seleccionar';draw();picker.showModal();search.focus()};
      }
      const text=select.selectedOptions[0]?.text||'Seleccionar';
      if(trigger.textContent!==text)trigger.textContent=text;
      trigger.setAttribute('aria-label',(pickerLabels[select.id]||'Seleccionar')+': '+text);
    }
  }
  new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
  sync();
})();
