/* NEXMIR V5.0.21 — tablero visual. Conserva las rutas y acciones originales. */
(() => {
  const safe=v=>typeof esc==='function'?esc(String(v??'')):String(v??'');
  const formatDate=()=>new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long'}).format(new Date()).replace(/^./,x=>x.toUpperCase());
  const stat=()=>typeof stats==='function'?stats():{cards:[],theory:[],attempts:[],accuracy:0,due:0};
  const weak=()=>typeof weakSpecialties==='function'?weakSpecialties().slice(0,3):[];
  const questions=()=>typeof questionPool==='function'?questionPool():[];
  const topicLabel=q=>q?.topic||q?.specialty||'Tema MIR';
  const questionPreview=q=>{
    if(!q)return '<p class="muted">Cuando haya preguntas publicadas, verás aquí una recomendación del día.</p>';
    const options=(q.options||[]).slice(0,3).map((x,i)=>`<div class="home-option"><b>${String.fromCharCode(65+i)}.</b>${safe(typeof x==='string'?x:(x.text||x.label||''))}</div>`).join('');
    return `<div class="home-question-badge">Pregunta del día · ${safe(topicLabel(q))}</div><h4>${safe(String(q.stem||q.question||q.text||'Pregunta MIR recomendada').replace(/<[^>]+>/g,'')).slice(0,190)}</h4>${options?`<div class="home-options">${options}</div>`:''}<button class="btn primary" onclick="route('bank')">Resolver ahora</button>`;
  };
  const planRows=items=>items.length?items.map((x,i)=>{
    const acc=Math.max(0,Math.min(100,Number(x.acc??x.accuracy??0))); const score=Math.max(24,100-acc);
    return `<div class="home-plan-row"><span class="home-rank">${i+1}</span><div><strong>${safe(x.name||x.specialty||'Tema pendiente')}</strong><small>${acc?`${acc}% de precisión · `:''}refuerzo recomendado</small><div class="home-plan-line"><i style="width:${score}%"></i></div></div><span class="home-plan-score">${Math.round(score)}%</span></div>`;
  }).join(''):'<p class="muted">Responde algunas preguntas para que el plan detecte tus áreas a reforzar.</p>';
  const activity=(s)=>[
    ['◉',`${s.due||0} repasos pendientes`,s.due?'Prioriza tarjetas vencidas':'Todo al día por ahora'],
    ['?',`${s.attempts?.length||0} preguntas respondidas`,`${s.accuracy||0}% de precisión global`],
    ['▦',`${s.cards?.length||0} flashcards disponibles`,'Repaso espaciado activo']
  ].map(x=>`<div class="home-activity-item"><span class="home-activity-dot">${x[0]}</span><div><strong>${x[1]}</strong><span>${x[2]}</span></div></div>`).join('');
  function dashboard(){
    const s=stat(), areas=weak(), q=questions()[0], user=typeof profileName==='function'?profileName():'Estudiante';
    const todayAttempts=(s.attempts||[]).filter(a=>a.answered_at&&today(new Date(a.answered_at))===today()).length;
    const goal=state.profile?.goal_specialty?`Tu objetivo: ${safe(state.profile.goal_specialty)}`:'Construye una rutina que te acerque a tu plaza MIR.';
    const root=document.querySelector('#view-dashboard'); if(!root)return;
    root.innerHTML=`<div class="nexmir-home">
      <div class="nexmir-welcome"><div><h1>Hola, ${safe(user)}</h1><p>${goal}</p></div><span class="home-date">${formatDate()}</span></div>
      <section class="home-hero"><div class="home-hero-copy"><span class="home-hero-note">◉ Plan adaptativo activo</span><h2>Un paso bien dado hoy cambia tu MIR de mañana.</h2><p>Tu sesión se adapta a los fallos, los repasos pendientes y los temas que más pesan en el examen.</p><div class="home-hero-actions"><button class="btn primary" onclick="route('reviews')">Repasar ahora · ${s.due||0}</button><button class="btn" onclick="route('study')">Explorar asignaturas</button></div></div></section>
      <div class="home-kpis"><article class="home-kpi"><span>Precisión global</span><strong>${s.accuracy||0}%</strong><em>Tu rendimiento acumulado</em></article><article class="home-kpi"><span>Preguntas hoy</span><strong>${todayAttempts}</strong><em>${s.attempts?.length||0} respondidas en total</em></article><article class="home-kpi"><span>Repasos pendientes</span><strong>${s.due||0}</strong><em>Activa tu memoria</em></article><article class="home-kpi"><span>Contenido disponible</span><strong>${(s.cards?.length||0)+(s.theory?.length||0)}</strong><em>Flashcards y teoría</em></article></div>
      <div id="quickStudyPanel"><div class="card"><div class="section-head"><div><h3>No sé qué estudiar</h3><p class="muted">Te proponemos un bloque breve según tus fallos, repasos y áreas débiles.</p></div></div><div class="row"><label style="margin:0;min-width:180px">Tiempo disponible<select id="quickMinutes"><option value="10">10 minutos</option><option value="20" selected>20 minutos</option><option value="30">30 minutos</option></select></label><button class="btn primary" onclick="startQuickStudy()">Recomendar sesión</button></div><div id="quickRecommendation" class="path" style="margin-top:11px"></div></div></div>
      <div class="home-split"><section class="home-section"><div class="home-section-head"><div><h3>Prioridad de esta semana</h3><p>Áreas que conviene reforzar primero.</p></div><button class="link-btn" onclick="route('calendar')">Ver plan</button></div>${planRows(areas)}</section><section class="home-section home-question">${questionPreview(q)}</section></div>
      <div class="home-split"><section class="home-section"><div class="home-section-head"><div><h3>Actividad de estudio</h3><p>Tu progreso se guarda automáticamente.</p></div><button class="link-btn" onclick="route('progress')">Ver progreso</button></div><div class="home-activity">${activity(s)}</div></section><section class="home-section"><div class="home-section-head"><div><h3>Continúa tu preparación</h3><p>Elige cómo quieres seguir.</p></div></div><div class="home-activity"><div class="home-activity-item clickable" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}" onclick="route('bank')"><span class="home-activity-dot">?</span><div><strong>Banqueo de preguntas</strong><span>Entrena criterio MIR con feedback inmediato</span></div></div><div class="home-activity-item clickable" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}" onclick="route('simulations')"><span class="home-activity-dot">◷</span><div><strong>Simulacro MIR</strong><span>Practica en condiciones de examen</span></div></div><div class="home-activity-item clickable" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}" onclick="route('profile')"><span class="home-activity-dot">♙</span><div><strong>Tu perfil y estadísticas</strong><span>Revisa tu tiempo y racha de estudio</span></div></div></div></section></div>
    </div>`;
    window.nexmirMascot?.mountDashboard();
  }
  const original=window.renderDashboard;
  window.renderDashboard=dashboard;
  window.nexmirDesignDashboard=dashboard;
  setTimeout(()=>{if(state?.view==='dashboard'&&!document.querySelector('#app')?.classList.contains('hidden'))dashboard()},60);
  // Referencia intencional: conserva el tablero anterior accesible para depuración sin usarlo en producción.
  window.__nexmirLegacyDashboard=original;
})();
