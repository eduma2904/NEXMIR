/* NEXMIR V5.1.33: atajos de teclado (PC) y gestos de deslizar en flashcards (móvil).
   Convierte letras en las teclas numéricas que ya existen y llama a las funciones de navegación actuales. */
(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s);
 const S=()=>(typeof state!=='undefined'?state:null);
 const typing=t=>{const tag=t?.tagName?.toLowerCase();return tag==='textarea'||tag==='select'||t?.isContentEditable||(tag==='input'&&!['radio','checkbox','button','submit'].includes(t.type))};
 const blocked=()=>!!document.querySelector('#selectPickerDialog[open],#planLoadingDialog[open],#imageViewerDialog[open],#paceWarningDialog[open],#reportDialog[open],#themeWelcomeDialog[open],#tutorialExamDialog[open]')||(window.nexmirTutorial?.isActive?.());

 /* Contexto de estudio activo */
 function context(){
  const st=S();if(!st)return null;
  const focusOpen=$('#focusSessionDialog')?.open;
  if(focusOpen)return{type:'focus'};
  const qd=$('#questionDialog');
  if(qd?.open&&qd.querySelector('#bankStem')&&st.bank?.pool?.[st.bank.index])return{type:'bank',n:(st.bank.pool[st.bank.index].options||[]).length};
  const sd=$('#simDialog');
  if(sd?.open&&st.simulation?.active&&st.simulation?.pool?.[st.simulation.index])return{type:'sim',n:(st.simulation.pool[st.simulation.index].options||[]).length};
  const cd=$('#cardDialog');
  if(cd?.open&&st.review?.pool?.[st.review.index])return{type:'card',revealed:!!st.review.revealed};
  if(st.view==='battles'&&st.battle?.started&&st.battle?.pool?.[st.battle.index])return{type:'battle',n:(st.battle.pool[st.battle.index].options||[]).length};
  return null;
 }
 const press=digit=>document.dispatchEvent(new KeyboardEvent('keydown',{key:String(digit),code:'Digit'+digit,bubbles:true,cancelable:true}));
 const clickEnabled=el=>{if(el&&!el.disabled){el.click();return true}return false};

 document.addEventListener('keydown',e=>{
  if(!e.isTrusted||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
  if(typing(e.target)||blocked())return;
  const ctx=context();if(!ctx)return;
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  const onChoice=!!e.target?.closest?.('.answer-choice');

  /* A–E eligen la alternativa (equivale a 1–5) */
  if(!e.shiftKey&&/^[a-e]$/.test(k)&&['bank','sim','focus','battle'].includes(ctx.type)){
   const i=k.charCodeAt(0)-96;
   if(ctx.n===undefined||i<=ctx.n){e.preventDefault();e.stopImmediatePropagation();press(i)}
   return;
  }
  if(e.shiftKey)return;

  /* Siguiente / anterior */
  const next=k==='n'||(k==='ArrowRight'&&!onChoice),prev=k==='p'||(k==='ArrowLeft'&&!onChoice);
  if(ctx.type==='bank'&&(next||prev)){
   e.preventDefault();clickEnabled($(`#questionDialog [data-bank-nav="${next?'next':'previous'}"]`));return;
  }
  if(ctx.type==='sim'&&(next||prev)&&typeof goSimulationQuestion==='function'){
   const st=S().simulation,to=st.index+(next?1:-1);
   if(to>=0&&to<st.pool.length){e.preventDefault();goSimulationQuestion(to)}return;
  }
  /* Enter: responder en banqueo inmediato */
  if(ctx.type==='bank'&&k==='Enter'&&!e.target?.closest?.('button,a')){
   const b=$('#answerBtn');if(b){e.preventDefault();clickEnabled(b)}return;
  }
  /* Flashcards: espacio o Enter muestran la respuesta */
  if(ctx.type==='card'&&!ctx.revealed&&(k===' '||k==='Enter')&&!e.target?.closest?.('button,a')){
   e.preventDefault();if(typeof revealCard==='function')revealCard();return;
  }
  /* Ayuda rápida */
  if(k==='?'&&typeof toast==='function'){
   e.preventDefault();
   toast(ctx.type==='card'?'Atajos: Espacio muestra la respuesta · 0–3 programa el repaso':'Atajos: A–E eligen · N siguiente · P anterior · Enter responde');
  }
 },true);

 /* Texto de ayuda actualizado en banqueo y simulacro */
 const hintObserver=new MutationObserver(()=>{
  const st=S();if(!st)return;
  for(const el of document.querySelectorAll('.keyboard-hint:not([data-mx])')){
   el.dataset.mx='1';const m=el.textContent.match(/1[–-](\d)/);
   if(m){const letters=String.fromCharCode(64+Number(m[1]));el.textContent=`Teclado: 1–${m[1]} o A–${letters} · N siguiente · P anterior`}
  }
 });
 hintObserver.observe(document.body,{childList:true,subtree:true});

 /* Gestos en flashcards: tocar para ver la respuesta, deslizar para valorar */
 const body=document.getElementById('cardDialogBody');
 if(body){
  const THRESH=96;let x0=0,y0=0,drag=false,locked=false,layout=null,tag=null;
  const tagEl=()=>{
   if(tag&&tag.isConnected)return tag;
   tag=document.createElement('div');tag.className='mx-swipe-tag';body.append(tag);return tag;
  };
  const ctxCard=()=>{const st=S();return st?.review?.pool?.[st.review.index]?{revealed:!!st.review.revealed}:null};
  body.addEventListener('touchstart',e=>{
   if(S()?.review?.saving||e.touches.length!==1||!ctxCard()||e.target.closest('button,a,input,textarea,select,.rating-grid'))return;
   x0=e.touches[0].clientX;y0=e.touches[0].clientY;drag=true;locked=false;layout=body.querySelector('.flash-study-layout');
  },{passive:true});
  body.addEventListener('touchmove',e=>{
   if(!drag||!layout)return;
   const dx=e.touches[0].clientX-x0,dy=e.touches[0].clientY-y0;
   if(!locked){if(Math.abs(dy)>Math.abs(dx)*1.2&&Math.abs(dy)>10){drag=false;return}if(Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)*1.6)locked=true;else return}
   const c=ctxCard();if(!c){drag=false;return}
   layout.style.transition='none';layout.style.transform=`translateX(${dx*.6}px) rotate(${dx/40}deg)`;
   const t=tagEl(),p=Math.min(1,Math.abs(dx)/THRESH);
   t.textContent=c.revealed?(dx>0?'Bien':'Otra vez'):'Mostrar respuesta';
   t.dataset.dir=c.revealed?(dx>0?'good':'bad'):'reveal';t.style.opacity=String(p);t.classList.toggle('left',dx<0);
  },{passive:true});
  const end=e=>{
   if(!drag){return}
   drag=false;const dx=(e.changedTouches?.[0]?.clientX??x0)-x0;
   if(layout){layout.style.transition='transform .25s cubic-bezier(.22,1,.36,1)';layout.style.transform=''}
   if(tag)tag.style.opacity='0';
   if(e.type==='touchcancel'||!locked||Math.abs(dx)<THRESH)return;
   const c=ctxCard();if(!c)return;
   if(!c.revealed){if(typeof revealCard==='function')revealCard()}
   else if(typeof rateCard==='function')rateCard(dx>0?3:1);
  };
  body.addEventListener('touchend',end,{passive:true});
  body.addEventListener('touchcancel',end,{passive:true});
  /* Pista visible la primera vez */
  const hintObs=new MutationObserver(()=>{
   const panel=body.querySelector('.flash-reveal-panel:not([data-mx]),.flash-answer-panel .flash-shortcuts:not([data-mx])');
   if(!panel||!matchMedia('(pointer:coarse)').matches)return;panel.dataset.mx='1';
   const p=document.createElement('p');p.className='mx-swipe-hint muted small';
   p.textContent=panel.classList.contains('flash-reveal-panel')?'Desliza hacia un lado para mostrar la respuesta.':'Desliza a la derecha: Bien · a la izquierda: Otra vez.';
   panel.after(p);
  });
  hintObs.observe(body,{childList:true,subtree:true});
 }
})();
