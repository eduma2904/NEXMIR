/* NEXMIR V5.1.33: consejos breves la primera vez que se entra a cada sección.
   Complementa el tutorial corto; se guarda por usuario en este navegador. */
(() => {
 'use strict';
 const TIPS={
  focus:['Modo Focus','Elige duración, asignatura y tema. Una sesión válida de al menos 10 minutos puede contar para tu racha; las respuestas demasiado rápidas no cuentan como estudio.'],
  battles:['Batallas','Crea una sala o entra con un código para resolver el mismo bloque frente a otro estudiante.'],
  arcade:['Arcade','Repasa jugando. Código Vital es el ahorcado médico: en PC escribe con el teclado y en móvil toca las letras. No suma XP ni racha.'],
  errors:['Mis errores','Aquí están las preguntas que fallaste. Usa «Repasar» para volver al contenido relacionado.'],
  bookmarks:['Marcadas','Guarda preguntas, tarjetas o teoría mientras estudias y vuelve a ellas desde aquí.'],
  goal:['Mi plaza MIR','Define especialidad, hospital, baremo y número objetivo. Las cifras son orientativas y no garantizan plaza.'],
  calendar:['Plan de estudio','Organiza tu semana. El plan adaptativo tiene en cuenta tu actividad, errores y repasos, y puedes elegir la fecha de tu examen.'],
  profile:['Perfil','Aquí cambias el tema de color, la mascota y repites el tutorial o el PDF con las funciones Free y Pro.'],
  simulations:['Tip de atajos','Durante un simulacro o banqueo usa A–E para elegir, N para avanzar y P para volver.']
 };
 const uid=()=>(typeof state!=='undefined'&&state?.user?.id)||null;
 const kSeen=()=>`nexmir_tips_seen_v1:${uid()}`,kOff=()=>`nexmir_tips_off_v1:${uid()}`;
 const read=()=>{try{return JSON.parse(localStorage.getItem(kSeen())||'{}')}catch{return{}}};
 const write=o=>{try{localStorage.setItem(kSeen(),JSON.stringify(o))}catch{}};
 const isOff=()=>{try{return localStorage.getItem(kOff())==='1'}catch{return true}};
 let timer=null,tipEl=null;
 function hide(){clearTimeout(timer);if(!tipEl)return;const el=tipEl;tipEl=null;el.classList.add('out');setTimeout(()=>el.remove(),260)}
 function show(view){
  if(!uid()||isOff()||!TIPS[view])return;
  const seen=read();if(seen[view])return;
  if(window.nexmirTutorial?.isActive?.()||document.querySelector('dialog[open]'))return;
  if(typeof state!=='undefined'&&state.view!==view)return;
  seen[view]=1;write(seen);
  const style=window.nexmirMascot?.prefs?.().style||'clasico',img=['clasico','clinico','digital','junior'].includes(style)?style:'clasico';
  const el=document.createElement('aside');el.className='mx-tip';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
  el.innerHTML=`<img src="assets/lince-${img}.webp" alt="" width="46" height="46"><div class="mx-tip-copy"><strong></strong><p></p><div class="mx-tip-actions"><button type="button" class="btn mini primary" data-tip="ok">Entendido</button><button type="button" class="link-btn" data-tip="off">No mostrar consejos</button></div></div>`;
  el.querySelector('strong').textContent=TIPS[view][0];el.querySelector('p').textContent=TIPS[view][1];
  el.addEventListener('click',e=>{const a=e.target.closest('[data-tip]')?.dataset.tip;if(a==='ok')hide();if(a==='off'){try{localStorage.setItem(kOff(),'1')}catch{}hide();if(typeof toast==='function')toast('Consejos desactivados. Puedes reactivarlos desde Perfil.')}});
  tipEl=el;document.body.append(el);
 }
 function schedule(view){clearTimeout(timer);timer=setTimeout(()=>show(view),1100)}
 const wrap=()=>{
  if(typeof window.route!=='function'||window.route.__tips)return;
  const original=window.route;
  const wrapped=function(v){hide();clearTimeout(timer);const r=original.apply(this,arguments);Promise.resolve(r).finally(()=>schedule(v));return r};
  wrapped.__tips=true;window.route=wrapped;
 };
 wrap();window.addEventListener('load',wrap);
 window.addEventListener('nexmir:signout',hide);
 window.nexmirTips={
  reset(){try{localStorage.removeItem(kSeen());localStorage.removeItem(kOff())}catch{}if(typeof toast==='function')toast('Verás los consejos otra vez al entrar a cada sección.')},
  hide
 };
})();
