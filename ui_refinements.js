/* NEXMIR 5.1.1: shared loading and searchable Focus selectors. */
(() => {
  for(const name of ['createBattle','joinBattle','startBattleRoom','confirmNexmirFocus','resumeNexmirFocus','finishBank']){
    const original=window[name];
    if(typeof original!=='function')continue;
    let pending=false;
    window[name]=async function(...args){
      if(pending)return;
      pending=true;
      try{return await runPlanLoading(()=>original.apply(this,args),name==='finishBank'?'Enviando respuestas…':'Preparando sesión…')}
      catch(error){console.error(error);toast('No se pudo completar la operación. Inténtalo de nuevo.')}
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
  function sync(){
    for(const select of document.querySelectorAll('#focusSubject,#focusTopic')){
      let trigger=select.nextElementSibling;
      if(!trigger?.classList.contains('select-trigger')){
        trigger=document.createElement('button');trigger.type='button';trigger.className='select-trigger';
        trigger.setAttribute('aria-haspopup','dialog');
        select.after(trigger);select.hidden=true;
        trigger.onclick=()=>{source=select;search.value='';picker.querySelector('h3').textContent=select.id==='focusSubject'?'Elegir asignatura':'Elegir tema';draw();picker.showModal();search.focus()};
      }
      const text=select.selectedOptions[0]?.text||'Seleccionar';
      if(trigger.textContent!==text)trigger.textContent=text;
      trigger.setAttribute('aria-label',(select.id==='focusSubject'?'Asignatura: ':'Tema: ')+text);
    }
  }
  new MutationObserver(sync).observe(document.getElementById('view-focus')||document.body,{childList:true,subtree:true});
  sync();
})();
