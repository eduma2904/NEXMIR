/* NEXMIR V5.1.3 · Shared question text-size controls. */
(() => {
  const levels=[.8,.9,1,1.1,1.2,1.35,1.5];
  const storageKey='nexmir_question_text_scale_v1';
  let scale=Number(localStorage.getItem(storageKey)||1);
  if(!levels.includes(scale))scale=1;

  function apply(){
    document.documentElement.style.setProperty('--question-text-scale',String(scale));
    localStorage.setItem(storageKey,String(scale));
    const label=Math.round(scale*100)+'%';
    document.querySelectorAll('.question-text-scale-value').forEach(el=>{if(el.textContent!==label)el.textContent=label});
    document.querySelectorAll('[data-text-scale="smaller"]').forEach(el=>el.disabled=scale===levels[0]);
    document.querySelectorAll('[data-text-scale="larger"]').forEach(el=>el.disabled=scale===levels.at(-1));
  }
  function change(direction){
    const current=Math.max(0,levels.indexOf(scale));
    scale=levels[Math.max(0,Math.min(levels.length-1,current+direction))];
    apply();
  }
  function controls(){
    const box=document.createElement('div');
    box.className='question-text-controls';
    box.setAttribute('aria-label','Tamaño del texto de la pregunta y las alternativas');
    box.innerHTML='<span>Texto</span><button type="button" data-text-scale="smaller" aria-label="Reducir texto">A−</button><button type="button" class="question-text-scale-value" data-text-scale="reset" aria-label="Restablecer texto">100%</button><button type="button" data-text-scale="larger" aria-label="Aumentar texto">A+</button>';
    box.addEventListener('click',event=>{
      const action=event.target.closest('button')?.dataset.textScale;
      if(action==='smaller')change(-1);
      if(action==='larger')change(1);
      if(action==='reset'){scale=1;apply()}
    });
    return box;
  }
  function sync(){
    ['questionDialog','simDialog','focusSessionDialog'].forEach(id=>{
      const dialog=document.getElementById(id);
      if(!dialog)return;
      const anchor=dialog.querySelector('.highlight-toolbar,.sim-review-detail-head,.focus-session-meta');
      if(!anchor)return;
      let control=dialog.querySelector('.question-text-controls');
      if(!control)control=controls();
      if(control.parentElement!==anchor)anchor.appendChild(control);
    });
    apply();
  }
  new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',sync,{once:true});
  sync();
})();
