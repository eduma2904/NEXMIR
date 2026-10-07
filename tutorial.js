/* Recorrido de NEXMIR: explicaciones sin iniciar sesiones ni cambiar datos del estudiante. */
(() => {
  'use strict';
  const steps = [
    ['dashboard','#view-dashboard .home-hero','¡Bienvenido a NEXMIR!','Aquí tienes una propuesta de estudio y accesos a tus repasos y asignaturas. Los resúmenes cambian conforme estudias.'],
    ['dashboard','#view-dashboard .home-hero-actions','Accesos rápidos','Desde aquí puedes ir a Repasos o explorar asignaturas. El bloque Focus y las recomendaciones aparecen según tu actividad.'],
    ['study','#view-study > .section-head','Estudiar: asignaturas','Busca una asignatura y entra para explorar temas y subtemas con teoría y flashcards.'],
    ['study','#studyGrid .specialty-card:first-child','Dentro de una asignatura','Abre una tarjeta de asignatura; en sus ventanas podrás filtrar «Todo», «Teoría» y «Flashcards». Usa «? Ayuda» para conocer los controles.'],
    ['focus','#view-focus .focus-setup-grid > .card:first-child','Preparar Focus','Elige duración, asignatura y tema antes de preparar tu misión. Una sesión válida de al menos 10 minutos puede contar para la racha.'],
    ['focus','#view-focus .focus-hero-stats','Racha y ritmo','Aquí están tus días de racha, congeladores y XP. Más abajo se elige la duración; las respuestas demasiado rápidas pueden no contar como estudio válido.'],
    ['reviews','#view-reviews .review-filters','Repasos pendientes','Filtra flashcards por asignatura, tema y subtema. Revela la respuesta y valora cuánto recordabas para programar el siguiente repaso.'],
    ['bank','#view-bank .bank-selector-head','Banqueo por temas','Selecciona una o varias especialidades y después los temas, el número de preguntas, la corrección y el origen.'],
    ['bank','#startBankBtn','Resolver preguntas','Al comenzar se abre una ventana para responder, navegar, marcar y descartar opciones. Al finalizar verás explicación y corrección.'],
    ['simulations','#view-simulations > .section-head','Simulacros','Aquí configuras un Mini-MIR, un simulacro completo o uno personalizado según tu plan.'],
    ['simulations','#view-simulations > .grid.cols-3 > .card:first-child','Mini-MIR','El Mini-MIR usa 15 preguntas. En Free hay uno por día; Pro permite más simulacros y opciones de personalización.'],
    ['simulations','#tutorialReviewDemo .tutorial-demo-results','Pantalla de revisión simulada','Esta es una demostración: al entregar un simulacro verás correctas, incorrectas, blancas y netas. No altera tus resultados.'],
    ['simulations','#tutorialReviewDemo .tutorial-demo-nav','Explora las preguntas','La columna izquierda enumera cada pregunta y su estado. Pulsa 1, 2 o 3 para probar la navegación en esta demostración.'],
    ['simulations','#tutorialReviewDemo .tutorial-demo-detail','Revisa la explicación','A la derecha se ven el enunciado, tu elección, la correcta y la explicación. Prueba a cambiar de pregunta en la columna izquierda.'],
    ['simulations','#tutorialReviewDemo .tutorial-demo-actions','Salir de la revisión','En una revisión real puedes cerrar y volver a Simulacros o ir a Mis errores. Esta demostración no guarda nada.'],
    ['battles','#view-battles .section-head','Batallas','Crea una sala o entra con un código para resolver el mismo bloque frente a otro estudiante.'],
    ['arcade','#view-arcade .section-head','Arcade: repasa jugando','Esta es la biblioteca de minijuegos de NEXMIR. Por ahora encontrarás Código Vital, el ahorcado médico. Se adapta al tema de color que elegiste.'],
    ['arcade','#arcadePlay','Código Vital','Pulsa Jugar, elige especialidad y descubre el término con letras. Tienes seis errores; revelar una letra consume uno. Al terminar verás la explicación. Cambiar especialidad abre un selector que puedes cerrar sin perder la partida. Arcade no suma XP ni racha y no consume banqueo.'],
    ['errors','#view-errors .section-head','Mis errores','Consulta las preguntas falladas y usa «Repasar» para volver al contenido relacionado.'],
    ['bookmarks','#view-bookmarks .section-head','Marcadas','Guarda preguntas, tarjetas o teoría durante el estudio y vuelve a ellas desde esta sección.'],
    ['progress','#view-progress .progress-head','Progreso','Cambia el periodo para ver respuestas, precisión, cobertura, netas y temas débiles.'],
    ['goal','#view-goal .goal-layout > .card','Mi plaza MIR','Define especialidad, hospital, baremo y número objetivo. Las cifras son orientativas y no garantizan plaza.'],
    ['calendar','#view-calendar > .section-head','Plan de estudio','Organiza tu semana y consulta el plan adaptativo que considera actividad, errores y repasos.'],
    ['profile','#tutorialProfileCard','Ayuda en Perfil','Aquí puedes repetir el tutorial y abrir el PDF dentro de NEXMIR. También puedes descargarlo desde su visor.'],
    ['profile','#mascotSettings','Tu lince','Elige una de las cuatro apariencias de la mascota y controla sus animaciones. La guía seguirá disponible aunque ocultes las reacciones habituales.'],
    ['dashboard','#tutorialBtn','Tu guía siempre disponible','Este botón repite el tutorial. Al terminar te pediremos el tema de color y Mi plaza MIR con baremo; el diagnóstico será opcional.']
  ];
  const dialogHelp = {
    studyDialog:['Temas y teoría','Usa las pestañas para separar teoría y flashcards. Abre un contenido y regresa al tema con la flecha. El tirador de la esquina cambia el tamaño en escritorio.'],
    cardDialog:['Flashcards','Piensa la respuesta antes de revelarla. Después indica cuánto recordabas; esa valoración programa el próximo repaso.'],
    questionDialog:['Preguntas','Elige una alternativa y usa los controles para avanzar. Puedes marcar o descartar opciones; revisa la explicación tras corregir. Cerrar conserva el borrador del banqueo.'],
    simDialog:['Simulacro','Consulta el cronómetro, navega entre preguntas y entrega al terminar. La revisión final muestra respuestas, netas y explicaciones.'],
    focusSessionDialog:['Sesión Focus','Responde con atención, revisa la corrección y continúa. Saltar preguntas o marcar respuestas de forma apresurada no ayuda a completar una sesión válida.'],
    paceWarningDialog:['Aviso de ritmo','NEXMIR te avisa si pasas demasiado rápido. Tómate tiempo para leer y razonar; las respuestas sin estudio real pueden no contar para la racha.'],
    focusSummaryDialog:['Resumen de Focus','Consulta preguntas válidas, tiempo activo, XP y evolución de dominio. Los saltos y las respuestas apresuradas no suman como actividad válida.'],
    focusMissionDialog:['Misión Focus','La misión reúne tareas de estudio concretas. Revisa sus objetivos antes de comenzar.'],
    freezeNoticeDialog:['Congelador de racha','Si un día no estudias, un congelador disponible puede proteger la racha. El máximo es de tres oportunidades por mes.'],
    imageViewerDialog:['Imagen ampliada','Examina la imagen y cierra esta ventana para volver a la pregunta.'],
    studyTimerDialog:['Cronómetro','El tiempo cuenta durante actividad de estudio con esta pestaña visible. Puedes pausarlo manualmente.'],
    reportDialog:['Reportar contenido','Indica la parte afectada y describe el problema para que se pueda revisar.'],
    themeWelcomeDialog:['Tema visual','Escoge la apariencia que te resulte cómoda; puedes volver a cambiarla después.'],
    resetPasswordDialog:['Nueva contraseña','Introduce la contraseña nueva y guarda para recuperar el acceso a tu cuenta.'],
    deviceDialog:['Dispositivo vinculado','Tu cuenta solo puede estar activa en un dispositivo. Elige si deseas cerrar sesión o vincular este equipo.'],
  };
  let index=-1, ticket=0, lastFocus=null, autoTimer=null, initialTour=false, highlightObserver=null;
  const rollout=Date.parse('2026-10-06T01:40:00Z');
  const seenKey=()=>`nexmir_tutorial_seen_v2:${state.user?.id||'guest'}`;
  const getSeen=()=>{try{return localStorage.getItem(seenKey())==='1'||localStorage.getItem(`nexmir_tutorial_v1:${state.user?.id||'guest'}`)==='done'}catch{return false}};
  const setSeen=()=>{try{localStorage.setItem(seenKey(),'1')}catch{}};
  const isNewAccount=()=>Number.isFinite(Date.parse(state.user?.created_at))&&Date.parse(state.user.created_at)>=rollout;
  const el=(tag,cls)=>{const node=document.createElement(tag);node.className=cls;return node};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const openDialogs=()=>[...document.querySelectorAll('dialog[open]')].filter(d=>d.id!=='planLoadingDialog');
  function cleanup(){cleanupVisuals();document.getElementById('tutorialReviewDemo')?.remove();lastFocus?.focus?.({preventScroll:true});lastFocus=null;index=-1;ticket++}
  function finish(){const welcome=initialTour;initialTour=false;cleanup();if(welcome)afterTour()}
  function stop(){finish()}
  function afterTour(){
    const d=document.getElementById('themeWelcomeDialog');
    const next=()=>showGoalOnboarding();
    if(d&&typeof window.nexmirOpenWelcomeTheme==='function'){
      d.addEventListener('close',next,{once:true});
      if(window.nexmirOpenWelcomeTheme())return;
      d.removeEventListener('close',next);
    }
    next();
  }
  async function showGoalOnboarding(){
    const userId=state.user?.id;if(!userId)return;
    await route('goal');if(state.user?.id!==userId)return;
    const root=document.getElementById('view-goal');if(!root)return;
    root.querySelector('#tutorialGoalCard')?.remove();
    const panel=el('section','card tutorial-goal-card');panel.id='tutorialGoalCard';
    panel.innerHTML='<span class="chip">Paso final de bienvenida</span><h2>Completa Mi plaza MIR</h2><p class="muted">Elige la especialidad que buscas e indica tu baremo académico (de 0 a 10). Hospital y número objetivo son opcionales; puedes cambiarlos después.</p><div class="row gap"><button type="button" class="btn primary" data-goal-action="save">Guardar y continuar</button><button type="button" class="btn" data-goal-action="later">Lo haré después</button></div>';
    root.prepend(panel);
    let finished=false;
    const finishGoal=()=>{if(finished)return;finished=true;window.removeEventListener('nexmir:goal-saved',saved);panel.remove();setTimeout(showExamRecommendation,0)};
    const saved=()=>{if(state.user?.id!==userId)return;if(!state.profile?.goal_specialty||state.profile?.academic_average==null){toast('Elige especialidad y baremo, o pulsa «Lo haré después».');setTimeout(()=>root.prepend(panel),0);return}finishGoal()};
    window.addEventListener('nexmir:goal-saved',saved);
    panel.querySelector('[data-goal-action="later"]').onclick=finishGoal;
    panel.querySelector('[data-goal-action="save"]').onclick=()=>{if(!document.getElementById('goalSpecialty')?.value||document.getElementById('goalBaremo')?.value.trim()==='')return toast('Elige una especialidad e indica tu baremo académico.');saveGoal()};
    panel.scrollIntoView({block:'start',behavior:'instant'});
  }
  function showExamRecommendation(){
    if(!state.user||document.getElementById('tutorialExamDialog')?.open)return;
    const available=typeof questionPool==='function'?new Set(questionPool().filter(q=>(q.options||[]).length>=2).map(q=>displaySpecialty(q.specialty))):new Set();
    const specs=typeof specialtySummary==='function'?specialtySummary().map(x=>x.name).filter(x=>x!=='Desagrupadas'&&available.has(x)):[];
    const d=el('dialog','dialog tutorial-exam-dialog');d.id='tutorialExamDialog';
    const heading=el('h2','');heading.id='tutorialExamTitle';heading.textContent='¿Quieres hacer un diagnóstico de entrada?';
    d.setAttribute('aria-labelledby',heading.id);
    const copy=el('p','muted');copy.textContent='Es opcional. Responde preguntas por temas para orientar tu plan de estudio; también puedes empezar directamente con teoría, flashcards o banqueo.';
    const mascot=el('img','tutorial-exam-mascot');mascot.src='assets/lince-clasico.webp';mascot.alt='Lince NEXMIR';mascot.width=72;mascot.height=72;
    const head=el('div','tutorial-exam-head');head.append(mascot,heading);
    const actions=el('div','dialog-actions');
    const later=el('button','btn');later.type='button';later.textContent='Ahora no';later.onclick=()=>d.close();
    const go=el('button','btn primary');go.type='button';go.textContent='Hacer diagnóstico';go.disabled=!specs.length;
    const select=el('select','');select.setAttribute('aria-label','Especialidad para el diagnóstico');
    specs.forEach(sp=>{const option=document.createElement('option');option.value=sp;option.textContent=sp;select.append(option)});
    if(specs.includes(state.profile?.goal_specialty))select.value=state.profile.goal_specialty;
    go.onclick=()=>{const sp=select.value;d.close();d.remove();if(sp){route('study').then(()=>window.startSpecialtyDiagnostic?.(encodeURIComponent(sp),'study'))}};
    actions.append(later,go);d.append(head,copy);
    if(specs.length)d.append(select);else{const empty=el('p','muted small');empty.textContent='Aún no hay preguntas clasificadas para un diagnóstico.';d.append(empty)}
    d.append(actions);d.addEventListener('close',()=>d.remove(),{once:true});
    document.body.append(d);d.showModal();
  }
  function ensureReviewDemo(){
    if(document.getElementById('tutorialReviewDemo'))return;
    const demo=el('section','tutorial-review-demo');demo.id='tutorialReviewDemo';demo.setAttribute('role','region');demo.setAttribute('aria-label','Demostración de la revisión de simulacro');
    demo.innerHTML='<div class="tutorial-demo-results"><span class="chip">Demostración · sin datos reales</span><h2>Resultado · Simulacro de ejemplo</h2><div class="tutorial-demo-metrics"><div><strong>1</strong><span>Correcta</span></div><div><strong>1</strong><span>Incorrecta</span></div><div><strong>1</strong><span>En blanco</span></div><div><strong>0,67</strong><span>Netas</span></div></div></div><div class="tutorial-demo-workspace"><aside class="tutorial-demo-nav"><strong>Revisión final · 3 preguntas</strong><p class="muted small">Pulsa una pregunta para ver su detalle.</p><button type="button" data-demo-question="0" class="active"><b>1</b> Pregunta de ejemplo · Correcta</button><button type="button" data-demo-question="1"><b>2</b> Pregunta de ejemplo · Incorrecta</button><button type="button" data-demo-question="2"><b>3</b> Pregunta de ejemplo · En blanco</button></aside><main class="tutorial-demo-detail" aria-live="polite"></main></div><div class="tutorial-demo-actions"><span>En la revisión real puedes cerrar o ir a Mis errores.</span><button type="button" data-demo-prev>← Anterior</button><button type="button" data-demo-next>Siguiente →</button></div>';
    document.body.append(demo);
    const rows=[
      {status:'Correcta',chosen:'B',right:'B',explanation:'La opción B es la respuesta de esta demostración.'},
      {status:'Incorrecta',chosen:'A',right:'C',explanation:'En la revisión real, aquí leerás por qué la opción C es correcta.'},
      {status:'En blanco',chosen:'—',right:'D',explanation:'Aunque dejes una pregunta en blanco, podrás consultar la respuesta y su explicación.'}
    ];
    let current=0;
    const paint=()=>{const q=rows[current],detail=demo.querySelector('.tutorial-demo-detail');detail.innerHTML=`<span class="chip">Pregunta ${current+1} · ${q.status}</span><h3>Enunciado de demostración ${current+1}</h3><p>En un simulacro real se muestra aquí el enunciado original y, si existe, su imagen.</p><div class="tutorial-demo-options"><div>A. Opción de ejemplo</div><div>B. Opción de ejemplo</div><div>C. Opción de ejemplo</div><div>D. Opción de ejemplo</div></div><p><strong>Tu respuesta:</strong> ${q.chosen} &nbsp; <strong>Correcta:</strong> ${q.right}</p><div class="tutorial-demo-explanation"><strong>Explicación</strong><p>${q.explanation}</p></div>`;demo.querySelectorAll('[data-demo-question]').forEach((b,i)=>{b.classList.toggle('active',i===current);b.setAttribute('aria-current',i===current?'true':'false')})};
    demo.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.demoQuestion!==undefined)current=+button.dataset.demoQuestion;else if(button.hasAttribute('data-demo-prev'))current=Math.max(0,current-1);else if(button.hasAttribute('data-demo-next'))current=Math.min(rows.length-1,current+1);paint()});
    paint();
  }
  async function show(n,direction=1){
    const my=++ticket;
    if(n>=steps.length){finish();if(typeof toast==='function')toast('¡Listo! Puedes repetir la guía cuando quieras.');return}
    if(n<0)return;
    index=n;
    const [view,selector,title,body]=steps[n];
    // Changing a view never starts a study session or modifies account data.
    if(state.view!==view && typeof window.route==='function')await window.route(view);
    if(my!==ticket)return;
    await wait(70);
    if(my!==ticket)return;
    const demoStep=selector.startsWith('#tutorialReviewDemo');
    if(demoStep)ensureReviewDemo();else document.getElementById('tutorialReviewDemo')?.remove();
    let target=document.querySelector(selector);
    if(!target||!target.getClientRects().length||target.getBoundingClientRect().width<1||target.getBoundingClientRect().height<1)return show(n+direction,direction);
    cleanupVisuals();
    document.querySelector(`.nav-item[data-view="${view}"]`)?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});
    target?.scrollIntoView?.({block:'center',inline:'nearest',behavior:'instant'});
    const shade=el('div','tutorial-shade');shade.id='tutorialShade';shade.setAttribute('aria-hidden','true');shade.innerHTML='<svg aria-hidden="true"><path fill="rgba(4,15,29,.58)" fill-rule="evenodd"></path></svg>';document.body.append(shade);
    const spotlight=el('div','tutorial-spotlight');spotlight.id='tutorialSpotlight';spotlight.setAttribute('aria-hidden','true');document.body.append(spotlight);
    const navSpotlight=el('div','tutorial-spotlight tutorial-nav-spotlight');navSpotlight.id='tutorialNavSpotlight';navSpotlight.setAttribute('aria-hidden','true');document.body.append(navSpotlight);
    const card=el('section','tutorial-card');card.id='tutorialCard';if(demoStep)card.classList.add('tutorial-card-demo');card.tabIndex=-1;card.setAttribute('role','dialog');card.setAttribute('aria-modal','false');card.setAttribute('aria-labelledby','tutorialTitle');card.setAttribute('aria-describedby','tutorialCopy');
    const style=window.nexmirMascot?.prefs?.().style||'clasico';
    card.innerHTML=`<div class="tutorial-head"><img src="assets/lince-${['clasico','clinico','digital','junior'].includes(style)?style:'clasico'}.webp" alt="Lince NEXMIR" width="68" height="68"><div><span class="tutorial-kicker">Tu lince te guía · ${n+1}/${steps.length}</span><h3 id="tutorialTitle"></h3></div></div><p id="tutorialCopy" class="tutorial-copy"></p><div class="tutorial-meter" aria-hidden="true"><span></span></div><div class="tutorial-actions"><button type="button" class="btn mini" data-action="skip">Omitir</button><span class="tutorial-spacer"></span><button type="button" class="btn mini" data-action="back" ${n?'':'disabled'}>Anterior</button><button type="button" class="btn primary mini" data-action="next">${n===steps.length-1?'Terminar':'Siguiente'}</button></div>`;
    card.querySelector('h3').textContent=title;
    card.querySelector('.tutorial-copy').textContent=body;
    card.querySelector('.tutorial-meter span').style.width=`${(n+1)/steps.length*100}%`;
    card.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='skip')stop();if(action==='back')show(index-1,-1);if(action==='next')show(index+1,1)});
    document.body.append(card);
    moveSpotlight();
    if(window.ResizeObserver){highlightObserver=new ResizeObserver(moveSpotlight);highlightObserver.observe(target);const nav=document.querySelector(`.nav-item[data-view="${view}"]`);if(nav)highlightObserver.observe(nav)}
    requestAnimationFrame(()=>{if(my===ticket)moveSpotlight()});
    card.focus({preventScroll:true});
  }
  function cleanupVisuals(){highlightObserver?.disconnect();highlightObserver=null;['tutorialShade','tutorialSpotlight','tutorialNavSpotlight','tutorialCard'].forEach(id=>document.getElementById(id)?.remove())}
  function moveSpotlight(){
    if(index<0)return;
    const target=document.querySelector(steps[index][1])||document.querySelector(`#view-${steps[index][0]}`);
    const nav=document.querySelector(`.nav-item[data-view="${steps[index][0]}"]`);
    const spot=document.getElementById('tutorialSpotlight'),navSpot=document.getElementById('tutorialNavSpotlight'),shade=document.getElementById('tutorialShade');
    if(!spot||!target||!shade)return;
    const rect=node=>{const r=node.getBoundingClientRect(),p=6,x=Math.max(4,r.left-p),y=Math.max(4,r.top-p),right=Math.min(innerWidth-4,r.right+p),bottom=Math.min(innerHeight-4,r.bottom+p);return{x,y,w:Math.max(0,right-x),h:Math.max(0,bottom-y)}};
    const main=rect(target),side=nav?.getClientRects().length?rect(nav):null;
    const place=(node,r)=>{node.style.cssText=`left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`};
    place(spot,main);if(side){place(navSpot,side);navSpot.hidden=false}else navSpot.hidden=true;
    const hole=r=>`M${r.x} ${r.y} H${r.x+r.w} V${r.y+r.h} H${r.x} Z`;
    shade.querySelector('svg').setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
    shade.querySelector('path').setAttribute('d',`M0 0 H${innerWidth} V${innerHeight} H0 Z ${hole(main)} ${side?hole(side):''}`);
  }
  function startTour(auto=false){if(!state.user)return;initialTour=auto;if(auto)setSeen();openDialogs().forEach(d=>{if(['studyDialog','cardDialog','questionDialog','simDialog','focusSessionDialog'].includes(d.id))d.close()});lastFocus=document.activeElement;show(0)}
  function maybeAuto(restored){clearTimeout(autoTimer);if(!state.user||getSeen()||!isNewAccount())return;const userId=state.user.id;const launch=()=>{if(state.user?.id!==userId||getSeen()||index>=0)return;if(openDialogs().length){autoTimer=setTimeout(launch,2000);return}startTour(true)};autoTimer=setTimeout(launch,restored?2500:1000)}
  function attachDialogHelp(){
    openDialogs().forEach(d=>{if(!dialogHelp[d.id]||d.querySelector('.tutorial-dialog-help'))return;
      const btn=el('button','btn mini tutorial-dialog-help');btn.type='button';btn.textContent='🐾 ? Ayuda';btn.setAttribute('aria-label','Ayuda para esta ventana');
      btn.onclick=()=>{d.querySelector(':scope > .tutorial-dialog-note')?.remove();const note=el('aside','tutorial-dialog-note');note.setAttribute('role','status');const heading=el('strong','');heading.textContent=dialogHelp[d.id][0];const p=el('p','');p.textContent=dialogHelp[d.id][1];const close=el('button','icon-btn');close.type='button';close.textContent='×';close.setAttribute('aria-label','Cerrar ayuda');close.onclick=()=>note.remove();note.append(heading,close,p);d.append(note)};
      const head=d.id==='simDialog' ? d.querySelector('.sim-top,.sim-results-top .dialog-head') : d.querySelector('.dialog-head,.focus-session-top,.tutorial-guide-head');
      if(head){btn.classList.add('in-header');const close=head.querySelector(':scope > .icon-btn');if(close)head.insertBefore(btn,close);else head.append(btn)}
      else d.append(btn);
    });
  }
  function openGuide(){
    let d=document.getElementById('tutorialGuideDialog');
    if(!d){
      d=el('dialog','dialog tutorial-guide-dialog');d.id='tutorialGuideDialog';d.setAttribute('aria-label','Guía PDF de NEXMIR Free y Pro');
      d.innerHTML='<div class="tutorial-guide-head"><div><span class="chip">Guía de usuario</span><h2>Funciones Free y Pro</h2></div><div class="row gap"><a class="btn" href="assets/GUIA_NEXMIR_FREE_PRO.pdf?v=5.1.16" download>Descargar PDF</a><button class="icon-btn" type="button" aria-label="Cerrar guía">×</button></div></div><iframe src="assets/GUIA_NEXMIR_FREE_PRO.pdf?v=5.1.16#toolbar=1" title="Guía NEXMIR Free y Pro"></iframe><p class="muted small">Si tu navegador no muestra el PDF, usa «Descargar PDF».</p>';
      d.querySelector('button').onclick=()=>d.close();document.body.append(d);
    }
    if(!d.open)d.showModal();
  }
  document.getElementById('tutorialBtn')?.addEventListener('click',()=>{if(index>=0)finish();startTour(false)});
  window.addEventListener('nexmir:ready',e=>maybeAuto(e.detail?.restored));
  window.addEventListener('nexmir:signout',()=>{clearTimeout(autoTimer);cleanup()});
  window.addEventListener('resize',moveSpotlight);
  window.addEventListener('scroll',moveSpotlight,true);
  document.addEventListener('keydown',e=>{if(index<0)return;if(e.key==='Escape'){e.preventDefault();stop()}else if(e.key==='ArrowRight'&&e.target?.tagName!=='INPUT'){e.preventDefault();show(index+1)}else if(e.key==='ArrowLeft'&&e.target?.tagName!=='INPUT'){e.preventDefault();show(index-1)}});
  const observer=new MutationObserver(attachDialogHelp);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  setTimeout(()=>{
    const previous=window.renderProfile;
    window.renderProfile=function(...args){
      const result=previous.apply(this,args),root=document.getElementById('view-profile');
      root?.querySelector('#tutorialProfileCard')?.remove();
      root?.insertAdjacentHTML('beforeend','<section class="card tutorial-profile-card" id="tutorialProfileCard"><span class="chip">Ayuda</span><h3>Conoce NEXMIR</h3><p class="muted">Vuelve a recorrer la web con tu lince o consulta aquí el PDF con todas las funciones y los límites Free/Pro.</p><div class="row gap"><button class="btn primary" type="button" onclick="nexmirTutorial.start()">🐾 Volver a ver tutorial</button><button class="btn" type="button" onclick="nexmirTutorial.openGuide()">Ver guía PDF</button></div></section>');
      return result;
    };
  },0);
  window.nexmirTutorial={start:()=>startTour(false),stop,openGuide,isActive:()=>index>=0,isOnboardingPending:()=>index>=0&&initialTour,showExamRecommendation};
})();
