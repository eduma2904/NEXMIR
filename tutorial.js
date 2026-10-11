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
    ['reviews','#view-reviews .review-filters','Repasos de hoy','Verás cuántas tarjetas son para repasar (ya las viste) y cuántas son nuevas, con un límite diario para no saturarte. Filtra por asignatura, tema o subtema, elige el tamaño de la sesión y valora cuánto recordabas.'],
    ['bank','#view-bank .bank-selector-head','Banqueo por temas','Selecciona una o varias especialidades y después los temas, el número de preguntas, la corrección y el origen.'],
    ['bank','#startBankBtn','Resolver preguntas','Al comenzar se abre una ventana para responder, navegar, marcar y descartar opciones. Al finalizar verás explicación y corrección.'],
    ['simulations','#view-simulations > .section-head','Simulacros','Aquí configuras un Mini-MIR, un simulacro completo o uno personalizado según tu plan.'],
    ['simulations','#view-simulations > .grid.cols-3 > .card:first-child','Mini-MIR','El Mini-MIR usa 15 preguntas. En Free hay uno por día; Pro permite más simulacros y opciones de personalización.'],
    ['simulations','#tutorialReviewDemo .sim-results-top','Resumen del resultado','Arriba ves correctas, incorrectas, en blanco y netas MIR (correctas menos incorrectas/3). Esta pantalla es una demostración: no usa ni guarda tus respuestas.'],
    ['simulations','#tutorialReviewDemo .sim-review-sidebar','Lista de preguntas','Cada botón es una pregunta: verde si acertaste, rojo si fallaste y gris si la dejaste en blanco. Toca una para abrir su revisión. En el móvil la lista queda sobre el detalle.'],
    ['simulations','#tutorialDemoDetail','Detalle y explicación','Verás el enunciado, la opción que marcaste (en rojo si falló), la correcta (en verde) y la explicación. Aquí se muestra la pregunta 2, que está incorrecta.'],
    ['simulations','#tutorialReviewDemo .sim-review-side-actions','Cerrar o ir a Mis errores','Con Cerrar vuelves a Simulacros; con Mis errores practicas lo que fallaste. En esta demostración los botones no hacen nada.'],
    ['battles','#view-battles .section-head','Batallas','Crea una sala o entra con un código para resolver el mismo bloque frente a otro estudiante.'],
    ['arcade','#view-arcade .section-head','Arcade: repasa jugando','Esta es la biblioteca de minijuegos de NEXMIR. Por ahora encontrarás Código Vital, el ahorcado médico. Se adapta al tema de color que elegiste.'],
    ['arcade','#arcadePlay','Código Vital','Pulsa Jugar, elige especialidad y descubre el término con letras. En PC puedes escribir con el teclado; en móvil toca las letras. Las respuestas de varias palabras conservan sus espacios. La imagen de la pregunta, si existe, aparece con la pista; la imagen de respuesta se revela al terminar. Puedes reportar el caso para revisión desde el juego. Usa Ampliar y sal con la X roja o Escape sin perder la partida. Arcade no suma XP ni racha y no consume banqueo.'],
    ['errors','#view-errors .section-head','Mis errores','Consulta las preguntas falladas y usa «Repasar» para volver al contenido relacionado.'],
    ['bookmarks','#view-bookmarks .section-head','Marcadas','Guarda preguntas, tarjetas o teoría durante el estudio y vuelve a ellas desde esta sección.'],
    ['progress','#view-progress .progress-head','Progreso','Cambia el periodo para ver respuestas, precisión, cobertura, netas y temas débiles.'],
    ['goal','#view-goal .goal-layout > .card','Mi plaza MIR','Define especialidad, hospital, baremo y número objetivo. Las cifras son orientativas y no garantizan plaza.'],
    ['calendar','#view-calendar > .section-head','Plan de estudio','Organiza tu semana y consulta el plan adaptativo que considera actividad, errores y repasos.'],
    ['profile','#tutorialProfileCard','Ayuda en Perfil','Aquí puedes repetir el tutorial y abrir el PDF dentro de NEXMIR. También puedes descargarlo desde su visor.'],
    ['profile','#mascotSettings','Tu lince','Elige una de las cuatro apariencias de la mascota y controla sus animaciones. La guía seguirá disponible aunque ocultes las reacciones habituales.'],
    ['dashboard','#tutorialBtn','Tu guía siempre disponible','Este botón repite el tutorial corto. Al terminar te pediremos el tema de color y Mi plaza MIR con baremo; el diagnóstico será opcional. Cada sección te dará un consejo breve la primera vez que entres.'],
    ['simulations','#tutorialReviewDemo','Así se revisa un simulacro','Al entregar verás el resumen con tus netas MIR, la lista de preguntas por colores (verde acierto, rojo fallo, gris en blanco) y la explicación de cada una. Es una demostración: no guarda nada.']
  ];
  // Recorrido corto (8 pasos); el completo sigue disponible desde Perfil.
  const shortIds=[0,2,6,7,10,26,20,25];
  let plan=steps;
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
    const rows=[
      {status:'Correcta',cls:'correct',chosen:1,right:1,text:'Pregunta de ejemplo 1',explanation:'Así se ve una pregunta acertada: tu opción coincide con la correcta y ambas se marcan en verde.'},
      {status:'Incorrecta',cls:'wrong',chosen:0,right:2,text:'Pregunta de ejemplo 2',explanation:'Aquí leerás por qué la opción C es la correcta. Tu elección (A) aparece en rojo para que identifiques el error.'},
      {status:'En blanco',cls:'blank',chosen:-1,right:3,text:'Pregunta de ejemplo 3',explanation:'Aunque dejes una pregunta sin responder, puedes consultar la respuesta correcta y su explicación.'}
    ];
    const navBtn=(r,i)=>`<button type="button" class="sim-review-nav-btn ${r.cls}${i?'':' active'}" data-demo-question="${i}" aria-label="Pregunta ${i+1}, ${r.status}"><span class="review-card-number">${i+1}</span><span class="review-card-copy"><strong>${r.text}</strong><small>${r.status}</small></span><span class="review-card-dot"></span></button>`;
    demo.innerHTML=`<div class="sim-results-shell"><div class="sim-results-top"><div class="dialog-head"><div><span class="chip">Demostración · sin datos reales</span><h2>Resultado · Simulacro de ejemplo</h2></div></div><div class="sim-result-grid"><div class="sim-result-card"><strong class="green">1</strong><span>Correctas</span></div><div class="sim-result-card"><strong class="red">1</strong><span>Incorrectas</span></div><div class="sim-result-card"><strong>1</strong><span>En blanco</span></div><div class="sim-result-card"><strong class="accent">0,67</strong><span>Netas MIR</span></div></div><div class="sim-result-summary"><span>Precisión <strong>33%</strong></span><span>Netas = correctas − incorrectas/3</span></div></div><div class="sim-review-workspace"><aside class="sim-review-sidebar"><div class="sim-review-sidebar-head"><strong>Revisión final</strong><span class="chip">3</span></div><div class="sim-review-legend"><span><i class="correct"></i>Correcta</span><span><i class="wrong"></i>Incorrecta</span><span><i class="blank"></i>Blanco</span></div><div class="sim-review-nav">${rows.map(navBtn).join('')}</div><div class="sim-review-side-actions"><button type="button" class="btn" data-demo-note="Cerrar">Cerrar</button><button type="button" class="btn primary" data-demo-note="Mis errores">Mis errores</button></div></aside><main id="tutorialDemoDetail" class="sim-review-detail" aria-live="polite"></main></div></div>`;
    document.body.append(demo);
    let current=0;
    const L='ABCD';
    const paint=()=>{
      const q=rows[current],detail=demo.querySelector('#tutorialDemoDetail');
      const opts=[0,1,2,3].map(i=>{const good=i===q.right,chosen=i===q.chosen;
        return `<div class="sim-review-option ${good?'correct-option':''} ${chosen&&!good?'wrong-option':''} ${chosen?'chosen-option':''}"><span class="option-letter">${L[i]}.</span><span>Opción de ejemplo ${L[i]}</span>${good?'<span class="option-tag good">Correcta</span>':''}${chosen&&!good?'<span class="option-tag bad">Tu respuesta</span>':''}</div>`}).join('');
      detail.innerHTML=`<div class="sim-review-detail-head"><div><span class="chip">Pregunta ${current+1}</span><div class="path">Especialidad de ejemplo › Tema de ejemplo</div></div><span class="review-status-pill ${q.cls}">${q.status}</span></div><div class="question-stem sim-review-stem">Enunciado de ejemplo ${current+1}: en una revisión real aquí aparece el caso clínico completo y, si existe, su imagen.</div><div class="sim-review-options">${opts}</div><div class="sim-review-answerline"><strong>Tu respuesta:</strong> ${q.chosen<0?'En blanco':L[q.chosen]} <span>·</span> <strong>Correcta:</strong> ${L[q.right]}</div><div class="sim-review-explanation"><strong>Explicación</strong><p>${q.explanation}</p></div>`;
      detail.classList.remove('tut-swap');void detail.offsetWidth;detail.classList.add('tut-swap');detail.scrollTop=0;
      demo.querySelectorAll('[data-demo-question]').forEach((b,i)=>{b.classList.toggle('active',i===current);b.setAttribute('aria-current',i===current?'true':'false')});
      requestAnimationFrame(()=>moveSpotlight());
    };
    demo.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;
      if(button.dataset.demoQuestion!==undefined){current=+button.dataset.demoQuestion;paint()}
      else if(button.dataset.demoNote&&typeof toast==='function')toast('Demostración: «'+button.dataset.demoNote+'» no hace nada aquí.')});
    paint();
  }
  async function show(n,direction=1){
    const my=++ticket;
    if(n>=plan.length){finish();if(typeof toast==='function')toast('¡Listo! Puedes repetir la guía cuando quieras.');return}
    if(n<0)return;
    index=n;
    const [view,selector,title,body]=plan[n];
    // Changing a view never starts a study session or modifies account data.
    if(state.view!==view && typeof window.route==='function')await window.route(view);
    if(my!==ticket)return;
    await wait(70);
    if(my!==ticket)return;
    const demoStep=selector.startsWith('#tutorialReviewDemo')||selector==='#tutorialDemoDetail';
    if(demoStep)ensureReviewDemo();else document.getElementById('tutorialReviewDemo')?.remove();
    if(demoStep)document.querySelector(`#tutorialReviewDemo [data-demo-question="${selector==='#tutorialDemoDetail'||selector==='#tutorialReviewDemo'?1:0}"]`)?.click();
    let target=document.querySelector(selector);
    if(!target||!target.getClientRects().length||target.getBoundingClientRect().width<1||target.getBoundingClientRect().height<1)return show(n+direction,direction);
    cleanupCard();
    document.querySelector(`.nav-item[data-view="${view}"]`)?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});
    bringIntoView(target,demoStep);
    ensureOverlay(demoStep,n+1);
    const card=el('section','tutorial-card');card.id='tutorialCard';if(demoStep)card.classList.add('tutorial-card-demo');card.tabIndex=-1;card.setAttribute('role','dialog');card.setAttribute('aria-modal','false');card.setAttribute('aria-labelledby','tutorialTitle');card.setAttribute('aria-describedby','tutorialCopy');
    const style=window.nexmirMascot?.prefs?.().style||'clasico';
    card.innerHTML=`<div class="tutorial-head"><img src="assets/lince-${['clasico','clinico','digital','junior'].includes(style)?style:'clasico'}.webp" alt="Lince NEXMIR" width="68" height="68"><div><span class="tutorial-kicker">Tu lince te guía · ${n+1}/${plan.length}</span><h3 id="tutorialTitle"></h3></div></div><p id="tutorialCopy" class="tutorial-copy"></p><div class="tutorial-meter" aria-hidden="true"><span></span></div><div class="tutorial-actions"><button type="button" class="btn mini" data-action="skip">Omitir</button><span class="tutorial-spacer"></span><button type="button" class="btn mini" data-action="back" ${n?'':'disabled'}>Anterior</button><button type="button" class="btn primary mini" data-action="next">${n===plan.length-1?'Terminar':'Siguiente'}</button></div>`;
    card.querySelector('h3').textContent=title;
    card.querySelector('.tutorial-copy').textContent=body;
    const meter=card.querySelector('.tutorial-meter span');meter.style.width=`${Math.max(0,n)/plan.length*100}%`;requestAnimationFrame(()=>requestAnimationFrame(()=>{meter.style.width=`${(n+1)/plan.length*100}%`}));
    card.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='skip')stop();if(action==='back')show(index-1,-1);if(action==='next')show(index+1,1)});
    document.body.append(card);
    moveSpotlight(true);
    if(window.ResizeObserver){highlightObserver=new ResizeObserver(moveSpotlight);highlightObserver.observe(target);const nav=document.querySelector(`.nav-item[data-view="${view}"]`);if(nav)highlightObserver.observe(nav)}
    requestAnimationFrame(()=>{if(my===ticket)moveSpotlight()});
    card.focus({preventScroll:true});
  }
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
  let curMain=null,tweenId=0;
  function cleanupCard(){highlightObserver?.disconnect();highlightObserver=null;document.getElementById('tutorialCard')?.remove()}
  function cleanupVisuals(){cleanupCard();tweenId++;curMain=null;['tutorialShade','tutorialSpotlight','tutorialNavSpotlight'].forEach(id=>document.getElementById(id)?.remove())}
  function ensureOverlay(passive,stepNo){
    let shade=document.getElementById('tutorialShade');
    if(!shade){shade=el('div','tutorial-shade');shade.id='tutorialShade';shade.setAttribute('aria-hidden','true');shade.innerHTML='<svg aria-hidden="true"><path fill="rgba(4,15,29,.58)" fill-rule="evenodd"></path></svg>';document.body.append(shade)}
    shade.classList.toggle('passive',!!passive);
    let spot=document.getElementById('tutorialSpotlight');
    if(!spot){spot=el('div','tutorial-spotlight');spot.id='tutorialSpotlight';spot.setAttribute('aria-hidden','true');document.body.append(spot)}
    spot.dataset.step=String(stepNo);
    if(!document.getElementById('tutorialNavSpotlight')){const nav=el('div','tutorial-spotlight tutorial-nav-spotlight');nav.id='tutorialNavSpotlight';nav.setAttribute('aria-hidden','true');document.body.append(nav)}
  }
  function bringIntoView(target,demoStep){
    if(innerWidth<=760&&!demoStep&&!target.closest('#tutorialReviewDemo')){
      // En móvil la tarjeta ocupa la parte baja: dejamos el elemento justo bajo la barra superior.
      target.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
      const bar=document.querySelector('.topbar');window.scrollBy(0,-((bar?.offsetHeight||70)+18));
    }else target.scrollIntoView?.({block:'center',inline:'nearest',behavior:'instant'});
  }
  function placeCard(main){
    const card=document.getElementById('tutorialCard');if(!card||card.classList.contains('tutorial-card-demo'))return;
    const mobile=innerWidth<=760,w=card.offsetWidth,h=card.offsetHeight,m=mobile?10:20,sideLeft=innerWidth>900?250:m;
    const spots=mobile?[{b:m,l:m},{t:m,l:m}]:[{b:m,r:m},{b:m,l:sideLeft},{t:90,r:m},{t:90,l:sideLeft}];
    const hit=p=>{const x=p.l!==undefined?p.l:innerWidth-p.r-w,y=p.t!==undefined?p.t:innerHeight-p.b-h,g=12;
      return !(x+w<main.x-g||x>main.x+main.w+g||y+h<main.y-g||y>main.y+main.h+g)};
    const pick=spots.find(p=>!hit(p))||spots[0];
    const st=card.style;st.top=pick.t!==undefined?pick.t+'px':'auto';st.bottom=pick.b!==undefined?pick.b+'px':'auto';
    st.left=pick.l!==undefined?pick.l+'px':'auto';st.right=pick.r!==undefined?pick.r+'px':'auto';
  }
  function moveSpotlight(animate){
    if(index<0)return;
    const target=document.querySelector(plan[index][1])||document.querySelector(`#view-${plan[index][0]}`);
    const nav=document.querySelector(`.nav-item[data-view="${plan[index][0]}"]`);
    const spot=document.getElementById('tutorialSpotlight'),navSpot=document.getElementById('tutorialNavSpotlight'),shade=document.getElementById('tutorialShade');
    if(!spot||!target||!shade)return;
    const rect=node=>{const r=node.getBoundingClientRect(),p=6,x=Math.max(14,r.left-p),y=Math.max(14,r.top-p),right=Math.min(innerWidth-8,r.right+p),bottom=Math.min(innerHeight-8,r.bottom+p);return{x,y,w:Math.max(0,right-x),h:Math.max(0,bottom-y)}};
    const main=rect(target);
    const navRect=nav?.getClientRects().length?nav.getBoundingClientRect():null;
    const side=navRect&&navRect.right>0&&navRect.left<innerWidth?rect(nav):null;
    const place=(node,r)=>{node.style.cssText=`left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`};
    const hole=r=>{const k=Math.max(0,Math.min(16,r.w/2,r.h/2)),x=r.x,y=r.y,w=r.w,h=r.h;return `M${x+k} ${y} H${x+w-k} Q${x+w} ${y} ${x+w} ${y+k} V${y+h-k} Q${x+w} ${y+h} ${x+w-k} ${y+h} H${x+k} Q${x} ${y+h} ${x} ${y+h-k} V${y+k} Q${x} ${y} ${x+k} ${y} Z`};
    const paint=m=>{place(spot,m);if(side){place(navSpot,side);navSpot.hidden=false}else navSpot.hidden=true;
      shade.querySelector('svg').setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
      shade.querySelector('path').setAttribute('d',`M0 0 H${innerWidth} V${innerHeight} H0 Z ${hole(m)} ${side?hole(side):''}`)};
    if(animate===true&&curMain&&!reduceMotion){
      const from={...curMain},t0=performance.now(),id=++tweenId;
      const step=t=>{if(id!==tweenId)return;const p=Math.min(1,(t-t0)/420),e=1-Math.pow(1-p,3);
        const m={x:from.x+(main.x-from.x)*e,y:from.y+(main.y-from.y)*e,w:from.w+(main.w-from.w)*e,h:from.h+(main.h-from.h)*e};
        paint(m);curMain=m;if(p<1)requestAnimationFrame(step);else{curMain=main;paint(main)}};
      requestAnimationFrame(step);
    }else{tweenId++;paint(main);curMain=main}
    placeCard(main);
  }
  function startTour(auto=false,full=false){if(!state.user)return;plan=full?steps:shortIds.map(i=>steps[i]);initialTour=auto;if(auto)setSeen();openDialogs().forEach(d=>{if(['studyDialog','cardDialog','questionDialog','simDialog','focusSessionDialog'].includes(d.id))d.close()});lastFocus=document.activeElement;show(0)}
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
      root?.insertAdjacentHTML('beforeend','<section class="card tutorial-profile-card" id="tutorialProfileCard"><span class="chip">Ayuda</span><h3>Conoce NEXMIR</h3><p class="muted">Vuelve a recorrer la web con tu lince o consulta aquí el PDF con todas las funciones y los límites Free/Pro.</p><div class="row gap"><button class="btn primary" type="button" onclick="nexmirTutorial.start()">🐾 Tutorial corto</button><button class="btn" type="button" onclick="nexmirTutorial.startFull()">Recorrido completo</button><button class="btn" type="button" onclick="window.nexmirTips?.reset()">Ver consejos otra vez</button><button class="btn" type="button" onclick="nexmirTutorial.openGuide()">Ver guía PDF</button></div></section>');
      return result;
    };
  },0);
  window.nexmirTutorial={start:()=>startTour(false),startFull:()=>startTour(false,true),stop,openGuide,isActive:()=>index>=0,isOnboardingPending:()=>index>=0&&initialTour,showExamRecommendation};
})();
