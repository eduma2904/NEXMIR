/* V5.1.13: show the operation before expensive synchronous view construction. */
(() => {
  const labels={
    openSpecialty:'Cargando asignatura MIR…',
    openTopic:'Cargando tema y flashcards…',
    startBank:'Preparando banqueo…',
    startReview:'Preparando repaso de flashcards…',
    studyRelated:'Abriendo tus errores…',
    reviewErrorQuestion:'Abriendo pregunta fallada…',
    startAdaptiveBank:'Preparando banqueo adaptativo…',
    startSpecialtyDiagnostic:'Preparando diagnóstico…',
    startMirSimulation:'Preparando simulacro…'
  };
  for(const [name,label] of Object.entries(labels)){
    const original=window[name];if(typeof original!=='function')continue;
    let busy=false;
    window[name]=async function(...args){
      if(busy)return;
      busy=true;
      try{return await runPlanLoading(()=>original.apply(this,args),label)}
      catch(error){console.error(`Error en ${name}`,error);toast('No se pudo completar la carga. Reintenta desde esta sección.')}
      finally{busy=false}
    };
  }
  // iOS can keep pixel dimensions set by an earlier desktop resize after rotation.
  function clearStaleDialogSizes(){
    if(window.innerWidth>760)return;
    for(const id of ['studyDialog','cardDialog','questionDialog','simDialog','focusSessionDialog']){
      const dialog=document.getElementById(id);if(!dialog)continue;
      dialog.style.removeProperty('width');dialog.style.removeProperty('height');
      dialog.style.removeProperty('--dialog-width');dialog.style.removeProperty('--dialog-height');
    }
  }
  window.addEventListener('resize',clearStaleDialogSizes,{passive:true});
  document.addEventListener('DOMContentLoaded',clearStaleDialogSizes,{once:true});
  clearStaleDialogSizes();
})();
