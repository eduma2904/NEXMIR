/* Shared semantics; preserves existing click handlers and application routes. */
(() => {
 const toast=document.getElementById('toast');if(toast){toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.setAttribute('aria-atomic','true')}
 for(const id of ['authMsg','reportMessage']){const el=document.getElementById(id);if(el){el.setAttribute('role','status');el.setAttribute('aria-live','polite')}}
 const menu=document.getElementById('mobileMenu'),sidebar=document.querySelector('.sidebar');
 if(menu&&sidebar){
  sidebar.id='mainSidebar';menu.setAttribute('aria-controls',sidebar.id);menu.setAttribute('aria-label','Abrir navegación');
  const sync=()=>{const open=sidebar.classList.contains('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Cerrar navegación':'Abrir navegación')};
  new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});sync();
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sidebar.classList.contains('open')&&!document.querySelector('dialog[open]')){sidebar.classList.remove('open');menu.focus()}});
 }
 function enhance(root){
  for(const button of root.querySelectorAll('button.icon-btn:not([aria-label])')){
   if(['×','✕','✖'].includes(button.textContent.trim()))button.setAttribute('aria-label','Cerrar ventana');
  }
  for(const dialog of root.querySelectorAll('dialog:not([aria-label]):not([aria-labelledby])')){
   const heading=dialog.querySelector('h1,h2,h3,.sim-title');
   if(heading){if(!heading.id)heading.id=(dialog.id||'nexmirDialog')+'Title';dialog.setAttribute('aria-labelledby',heading.id)}
   else dialog.setAttribute('aria-label',({questionDialog:'Preguntas de estudio',simDialog:'Simulacro',studyDialog:'Contenido de estudio',cardDialog:'Repaso de tarjetas',imageViewerDialog:'Imagen ampliada'})[dialog.id]||'Ventana de NEXMIR');
  }
  for(const nav of root.querySelectorAll('.nav-item[data-view],.nav[data-view]')){
   if(nav.classList.contains('active'))nav.setAttribute('aria-current','page');else nav.removeAttribute('aria-current');
  }
 }
 // Add semantics only to new content. Attribute-only mutations cannot retrigger this observer.
 const observer=new MutationObserver(()=>enhance(document));observer.observe(document.body,{childList:true,subtree:true});enhance(document);
 document.addEventListener('click',e=>{if(e.target.closest('.nav-item,.nav'))queueMicrotask(()=>enhance(document))});
 document.addEventListener('keydown',e=>{
  const radio=e.target.closest('.answer-choice[role="radio"]');if(!radio||!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const group=radio.closest('[role="radiogroup"]'),options=[...group.querySelectorAll('.answer-choice:not(:disabled)')];if(!options.length)return;
  e.preventDefault();const current=options.indexOf(radio),next=e.key==='Home'?0:e.key==='End'?options.length-1:(current+(['ArrowDown','ArrowRight'].includes(e.key)?1:-1)+options.length)%options.length;
  options[next].focus({preventScroll:true});options[next].click();
 });
})();
