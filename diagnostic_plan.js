/* NEXMIR V5.0.13 · pretest diagnóstico y plan adaptativo por temas */
(() => {
  const DAY=86400000;
  state.diagnostic={active:false,pool:[],index:0,answers:{},specialty:null,saving:false};

  function sameSpecialty(value,sp){return displaySpecialty(value)===sp||canonicalSpecialty(value)===canonicalSpecialty(sp)}
  function validDiagnosticQuestion(q){const opts=q?.options||[];return opts.length>=2&&Number.isInteger(+q.correct_index)&&+q.correct_index>=0&&+q.correct_index<opts.length&&String(q.stem||q.question||'').trim()}
  let cachedIndex;
  const specialtyKey=value=>canonicalSpecialty(displaySpecialty(value));
  function diagnosticIndex(){
    const arrays=[state.content,state.questions,state.attempts,state.reviews,state.errorLog],signature=arrays.flatMap(rows=>[rows,rows.length]);
    if(cachedIndex&&Date.now()-cachedIndex.createdAt<30000&&signature.every((v,i)=>v===cachedIndex.signature[i]))return cachedIndex;
    const bySpecialty=new Map(),pool=questionPool(),questions=new Map(pool.map(q=>[`${q._source}:${q.id}`,q])),rm=reviewMap(),now=Date.now();
    const group=value=>{const key=specialtyKey(value);if(!bySpecialty.has(key))bySpecialty.set(key,{questions:[],attempts:[],topics:new Map()});return bySpecialty.get(key)};
    const topic=(g,name)=>{name=name||'General';if(!g.topics.has(name))g.topics.set(name,{topic:name,cards:0,due:0,exam:0,questions:0,weightedN:0,weightedOk:0,errorSum:0,last:0});return g.topics.get(name)};
    for(const x of studyContent()){const v=topic(group(x.specialty),x.topic);if(x.kind==='card'){v.cards++;const r=rm[x.id];if(!r||!r.next_review_at||new Date(r.next_review_at).getTime()<=now)v.due++}}
    for(const q of pool){if(!validDiagnosticQuestion(q))continue;const g=group(q.specialty);g.questions.push(q);const v=topic(g,q.topic);v.questions++;if(examEvidence(q))v.exam++}
    for(const a of state.attempts){const q=getAttemptQuestion(a);if(!q)continue;const g=group(q.specialty),v=topic(g,q.topic),timestamp=new Date(a.answered_at||0).getTime();if(a.mode==='diagnostic')g.attempts.push(a);if(Number.isFinite(timestamp))v.last=Math.max(v.last,timestamp);const age=Math.max(0,(now-timestamp)/DAY);if(age>365)continue;const base=a.mode==='diagnostic'?2:a.mode==='simulation'?1.35:1,w=base*Math.max(.45,1-age/500);v.weightedN+=w;if(a.is_correct)v.weightedOk+=w}
    for(const e of state.errorLog){const q=questions.get(`${e.source_type}:${e.source_id}`);if(q)topic(group(q.specialty),q.topic).errorSum+=Math.min(3,e.failures||0)+(e.uncertain?1:0)}
    cachedIndex={signature,createdAt:now,bySpecialty};return cachedIndex;
  }
  function specialtyData(sp){return diagnosticIndex().bySpecialty.get(specialtyKey(sp))||{questions:[],attempts:[],topics:new Map()}}
  function diagnosticQuestionPool(sp){return specialtyData(sp).questions}
  function diagnosticTopics(sp){return [...new Set(diagnosticQuestionPool(sp).map(q=>q.topic||'General'))].sort((a,b)=>a.localeCompare(b,'es'))}
  function shuffle(rows){return rows.slice().sort(()=>Math.random()-.5)}
  function buildDiagnosticPool(sp){
    const groups=new Map();
    for(const q of diagnosticQuestionPool(sp)){const t=q.topic||'General';if(!groups.has(t))groups.set(t,[]);groups.get(t).push(q)}
    const rows=[],rest=[];
    for(const [,items] of groups){const mixed=shuffle(items);rows.push(mixed[0]);rest.push(...mixed.slice(1,2))}
    const target=Math.max(rows.length,Math.min(40,rows.length*2));
    rows.push(...shuffle(rest).slice(0,Math.max(0,target-rows.length)));
    return shuffle(rows);
  }
  function diagnosticAttempts(sp){return specialtyData(sp).attempts}
  function diagnosticStatus(sp){
    const attempts=diagnosticAttempts(sp),measured=new Set(attempts.map(a=>getAttemptQuestion(a)?.topic||'General')),available=diagnosticTopics(sp).length;
    const latest=attempts.reduce((m,a)=>Math.max(m,new Date(a.answered_at||0).getTime()),0);
    return{attempts:attempts.length,measured:measured.size,available,latest:latest?new Date(latest):null,complete:available>0&&measured.size>=available};
  }
  function statusText(sp){const s=diagnosticStatus(sp);if(!s.available)return'Sin preguntas objetivas para diagnosticar';if(!s.attempts)return`Pendiente · ${s.available} temas evaluables`;return`${s.complete?'Completo':'Parcial'} · ${s.measured}/${s.available} temas · ${fmtDate(s.latest)}`}

  function examEvidence(q){return !!(q.source_exam||q.year||q.is_reserve||/\bMIR\b/i.test(String(q.source||'')))}
  function topicMetrics(sp){
    const all=[...specialtyData(sp).topics.values()].map(v=>({...v,specialty:sp})),now=Date.now(),maxExam=Math.max(0,...all.map(v=>v.exam)),maxQuestions=Math.max(1,...all.map(v=>v.questions));
    for(const v of all){
      const daysSince=v.last?Math.max(0,(now-v.last)/DAY):30;
      v.mastery=(2+v.weightedOk)/(4+v.weightedN);v.accuracy=Math.round(v.mastery*100);v.confidence=v.weightedN>=8?'Alta':v.weightedN>=3?'Media':'Baja';v.yield=maxExam?v.exam/maxExam:v.questions/maxQuestions;v.yieldSource=maxExam?'Exámenes importados':'Cobertura del banco';v.duePressure=v.cards?v.due/v.cards:0;
      v.errorPressure=Math.min(1,v.errorSum/8);v.forgetting=Math.min(1,daysSince/21);
      v.priority=.42*(1-v.mastery)+.25*v.yield+.13*v.duePressure+.12*v.errorPressure+.08*v.forgetting;
      v.difficulty=v.mastery<.45?'Fundamentos':v.mastery<.7?'Aplicación':'Casos exigentes';v.priorityPct=Math.round(v.priority*100);
    }
    return all.filter(v=>v.cards||v.questions).sort((a,b)=>b.priority-a.priority||b.questions-a.questions);
  }
  function planFor(sp){
    const metrics=topicMetrics(sp),focus=metrics.slice(0,Math.min(10,metrics.length)),blocks=14,counts=new Map(focus.map(x=>[x.topic,1]));
    let left=Math.max(0,blocks-focus.length),sum=focus.reduce((a,x)=>a+x.priority,0)||1;
    const quotas=focus.map(x=>({x,raw:left*x.priority/sum}));
    for(const q of quotas){const n=Math.floor(q.raw);counts.set(q.x.topic,counts.get(q.x.topic)+n);left-=n}
    quotas.sort((a,b)=>(b.raw%1)-(a.raw%1));for(let i=0;i<left&&quotas.length;i++)counts.set(quotas[i%quotas.length].x.topic,counts.get(quotas[i%quotas.length].x.topic)+1);
    const queue=[];let guard=0;while(queue.length<blocks&&guard++<100){for(const x of focus){if((counts.get(x.topic)||0)>0){queue.push(x);counts.set(x.topic,counts.get(x.topic)-1);if(queue.length===blocks)break}}}
    const days=Array.from({length:7},(_,i)=>({label:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][i],items:[]}));queue.forEach((x,i)=>days[i%7].items.push(x));return{metrics,days};
  }

  function diagnosticBanner(sp,context='study'){
    const status=diagnosticStatus(sp),pool=buildDiagnosticPool(sp),disabled=!pool.length;
    return `<div class="diagnostic-banner ${status.complete?'done':''}"><div><span class="chip">Pretest diagnóstico</span><h3>${status.attempts?'Actualiza tu mapa de dominio':'Mide tus temas antes de estudiar'}</h3><p>${esc(statusText(sp))}. NEXMIR no muestra las respuestas hasta terminar para evitar contaminar el diagnóstico.</p></div><button class="btn ${status.attempts?'':'primary'}" ${disabled?'disabled':''} onclick="startSpecialtyDiagnostic('${encodeURIComponent(sp)}','${context}')">${status.attempts?'Repetir diagnóstico':`Comenzar · ${pool.length} preguntas`}</button></div>`;
  }
  function studyDiagnosticSelector(){const specs=specialtySummary().map(x=>x.name).filter(x=>x!=='Desagrupadas'),sp=specs[0]||'';return `<div class="diagnostic-launch"><div><span class="chip">Nuevo · plan adaptativo</span><h2>Empieza por un diagnóstico por temas</h2><p class="muted">Una o dos preguntas objetivas por tema. Después se crea una semana con más peso en fallos y temas frecuentes en el MIR.</p></div><div class="diagnostic-launch-actions"><select id="studyDiagnosticSpecialty" onchange="refreshStudyDiagnosticStatus()">${specs.map(x=>`<option value="${esc(x)}">${esc(x.toLocaleUpperCase('es'))}</option>`).join('')}</select><span id="studyDiagnosticStatus" class="muted small">${sp?esc(statusText(sp)):'No hay especialidades publicadas'}</span><button class="btn primary" ${sp?'':'disabled'} onclick="startSelectedStudyDiagnostic()">Hacer pretest</button></div></div>`}

  const oldRenderStudy=renderStudy;
  renderStudy=function(){oldRenderStudy()};
  function refreshStudyDiagnosticStatus(){const sp=$('#studyDiagnosticSpecialty')?.value||'',el=$('#studyDiagnosticStatus');if(el)el.textContent=sp?statusText(sp):'Selecciona una especialidad'}
  function startSelectedStudyDiagnostic(){const sp=$('#studyDiagnosticSpecialty')?.value;if(sp)startSpecialtyDiagnostic(encodeURIComponent(sp),'study')}

  const oldOpenSpecialty=openSpecialty;
  openSpecialty=function(encoded){oldOpenSpecialty(encoded);const sp=decodeURIComponent(encoded),body=$('#studyDialogBody'),head=body?.querySelector('.dialog-head');if(body&&head)head.insertAdjacentHTML('afterend',diagnosticBanner(sp,'study'))};

  const oldRenderReviews=renderReviews;
  renderReviews=function(){oldRenderReviews()};
  function startSelectedReviewDiagnostic(){const sp=$('#reviewDiagnosticSpecialty')?.value;if(sp)startSpecialtyDiagnostic(encodeURIComponent(sp),'reviews')}

  function startSpecialtyDiagnostic(encoded,returnView='study'){
    const sp=decodeURIComponent(encoded),pool=buildDiagnosticPool(sp);if(!pool.length)return toast('Esta especialidad aún no tiene preguntas de opción múltiple clasificadas por tema');
    state.diagnostic={active:true,pool,index:0,answers:{},specialty:sp,returnView,saving:false,startedAt:new Date().toISOString()};showDiagnosticQuestion();
  }
  function diagnosticKey(q){return`${q._source||'questions'}:${q.id}`}
  let diagnosticSelection=null;
  function captureDiagnosticHighlight(){const root=$('#diagnosticStem'),sel=window.getSelection();if(root&&sel?.rangeCount&&!sel.isCollapsed&&root.contains(sel.getRangeAt(0).commonAncestorContainer))diagnosticSelection=sel.getRangeAt(0).cloneRange()}
  function highlightDiagnostic(clear=false){const d=state.diagnostic,q=d.pool[d.index],root=$('#diagnosticStem');if(!root)return;d.highlights??={};
    if(clear){root.querySelectorAll('mark.user-highlight').forEach(mark=>mark.replaceWith(...mark.childNodes));root.normalize()}
    else{const sel=window.getSelection(),range=sel?.rangeCount&&!sel.isCollapsed&&root.contains(sel.getRangeAt(0).commonAncestorContainer)?sel.getRangeAt(0).cloneRange():diagnosticSelection;
      if(!range||!root.contains(range.commonAncestorContainer))return toast('Selecciona parte del enunciado');const mark=document.createElement('mark');mark.className='user-highlight';try{range.surroundContents(mark)}catch{try{mark.appendChild(range.extractContents());range.insertNode(mark)}catch{return toast('Selecciona un fragmento más corto')}}sel?.removeAllRanges()}
    d.highlights[diagnosticKey(q)]=root.innerHTML;diagnosticSelection=null;
  }
  function toggleDiagnosticDiscard(i){const d=state.diagnostic,q=d.pool[d.index],key=diagnosticKey(q);d.eliminations??={};const active=new Set(d.eliminations[key]||[]);if(active.has(i))active.delete(i);else{active.add(i);if(d.answers[key]===i)delete d.answers[key]}d.eliminations[key]=[...active];showDiagnosticQuestion()}
  function showDiagnosticQuestion(){
    const d=state.diagnostic,q=d.pool[d.index],selected=d.answers[diagnosticKey(q)],topicsDone=new Set(d.pool.slice(0,d.index).map(x=>x.topic||'General')).size;
    const key=diagnosticKey(q),discarded=new Set(d.eliminations?.[key]||[]);
    $('#questionDialogBody').innerHTML=`<div class="dialog-head"><div><span class="chip">Diagnóstico · ${d.index+1}/${d.pool.length}</span><div class="path">${esc(d.specialty)} › ${esc(q.topic||'General')}</div></div><button class="icon-btn" onclick="closeDiagnostic()">×</button></div><div class="diagnostic-progress"><div class="progress-track"><div class="progress-fill" style="width:${Math.round(100*d.index/d.pool.length)}%"></div></div><span>${topicsDone}/${diagnosticTopics(d.specialty).length} temas vistos</span></div><div class="highlight-toolbar"><span>Enunciado</span><button type="button" class="btn mini" onmousedown="event.preventDefault()" onclick="highlightDiagnostic()">🖍 Resaltar</button><button type="button" class="btn mini" onclick="highlightDiagnostic(true)">Quitar resaltado</button></div><div id="diagnosticStem" class="flash-front question-stem" onmouseup="captureDiagnosticHighlight()" onkeyup="captureDiagnosticHighlight()">${d.highlights?.[key]||mdInline(q.stem||q.question||'')}</div>${questionImageHtml(q)}<div class="mcq-options">${(q.options||[]).map((o,i)=>`<div class="diagnostic-option-row ${discarded.has(i)?'eliminated':''}"><button class="mcq-option diagnostic-option ${selected===i?'selected':''}" ${discarded.has(i)?'disabled':''} onclick="chooseDiagnosticOption(${i})"><span class="option-letter">${String.fromCharCode(65+i)}.</span> <span class="option-text">${optionHtml(typeof o==='string'?o:o.text||'')}</span></button><button class="focus-discard-btn" type="button" aria-pressed="${discarded.has(i)}" onclick="toggleDiagnosticDiscard(${i})">${discarded.has(i)?'↶ Recuperar':'× Descartar'}</button></div>`).join('')}</div><div class="dialog-actions"><span class="muted small grow">Sin corrección inmediata · responde sin consultar apuntes</span><button class="btn primary" ${selected===undefined?'disabled':''} onclick="nextDiagnosticQuestion()">${d.index===d.pool.length-1?'Finalizar diagnóstico':'Siguiente →'}</button></div>`;
    const dialog=$('#questionDialog');if(!dialog.open)dialog.showModal();ensureResizableDialog(dialog);
  }
  function chooseDiagnosticOption(i){const d=state.diagnostic,q=d.pool[d.index],key=diagnosticKey(q);if((d.eliminations?.[key]||[]).includes(i))return;d.answers[key]=i;showDiagnosticQuestion()}
  async function nextDiagnosticQuestion(){const d=state.diagnostic,q=d.pool[d.index];if(d.answers[diagnosticKey(q)]===undefined)return;if(d.index<d.pool.length-1){d.index++;showDiagnosticQuestion();return}await finishDiagnostic()}
  function closeDiagnostic(){if(confirm('¿Salir del diagnóstico? Las respuestas aún no se han guardado.')){$('#questionDialog').close();state.diagnostic.active=false}}
  async function finishDiagnostic(){
    const d=state.diagnostic;if(d.saving)return;d.saving=true;const btn=$('#questionDialogBody .btn.primary');if(btn){btn.disabled=true;btn.textContent='Guardando…'}
    const answeredAt=new Date().toISOString(),rows=d.pool.map(q=>({...attemptPayload(q,d.answers[diagnosticKey(q)],+d.answers[diagnosticKey(q)]===+q.correct_index,'diagnostic'),answered_at:answeredAt,...(window.NEXMIR_FOCUS_BACKEND_READY===true&&typeof window.nexmirQuestionActiveSeconds==='function'?{question_active_time_seconds:window.nexmirQuestionActiveSeconds(q,'diagnostic')}: {})}));
    const {data,error}=await state.sb.from('user_question_attempts').insert(rows).select('*');if(error){d.saving=false;toast('No se pudo guardar el diagnóstico: '+error.message);showDiagnosticQuestion();return}
    state.attempts=[...(data||rows),...state.attempts];d.saving=false;d.active=false;renderDiagnosticResults(d);
  }
  function currentDiagnosticResults(d){const by=new Map();for(const q of d.pool){const t=q.topic||'General',v=by.get(t)||{topic:t,n:0,ok:0};v.n++;if(+d.answers[diagnosticKey(q)]===+q.correct_index)v.ok++;by.set(t,v)}return[...by.values()].map(v=>({...v,acc:Math.round(100*v.ok/v.n)})).sort((a,b)=>a.acc-b.acc||a.topic.localeCompare(b.topic,'es'))}
  function renderDiagnosticResults(d){
    const rows=currentDiagnosticResults(d),ok=rows.reduce((a,x)=>a+x.ok,0),total=rows.reduce((a,x)=>a+x.n,0),plan=planFor(d.specialty);
    $('#questionDialogBody').innerHTML=`<div class="dialog-head"><div><span class="chip">Diagnóstico completado</span><h2>${esc(d.specialty)} · ${ok}/${total}</h2></div><button class="icon-btn" onclick="$('#questionDialog').close();route('${esc(d.returnView||'study')}')">×</button></div><p class="muted">El resultado es una estimación inicial. Se corregirá con banqueos, simulacros y repasos posteriores.</p><div class="diagnostic-results">${rows.map(x=>`<div class="diagnostic-result ${x.acc<50?'weak':x.acc>=80?'strong':''}"><div><strong>${esc(x.topic)}</strong><span>${x.ok}/${x.n} correctas</span></div><b>${x.acc}%</b></div>`).join('')}</div><div class="callout"><strong>Plan generado</strong><p>${plan.metrics.length?`Prioridad máxima: ${esc(plan.metrics[0].topic)}. La semana combina recuperación activa, espaciado e intercalado.`:'Necesitas contenido clasificado para generar el plan.'}</p></div><div class="dialog-actions"><button class="btn" onclick="$('#questionDialog').close();route('${esc(d.returnView||'study')}')">Cerrar</button><button class="btn primary" onclick="$('#questionDialog').close();openDiagnosticPlan('${encodeURIComponent(d.specialty)}')">Ver mi plan</button></div>`;
  }

  function priorityLabel(x){return x.priority>=.6?'Muy alta':x.priority>=.45?'Alta':x.priority>=.3?'Media':'Mantenimiento'}
  function metricRowsHtml(metrics){return metrics.slice(0,10).map((x,i)=>`<div class="plan-topic-row"><span class="plan-rank">${i+1}</span><div class="grow"><strong>${esc(x.topic)}</strong><div class="path">Dominio ${x.accuracy}% · confianza ${x.confidence.toLowerCase()} · ${x.due}/${x.cards} tarjetas vencidas</div><div class="priority-track"><i style="width:${Math.min(100,x.priorityPct)}%"></i></div></div><span class="priority-pill p${priorityLabel(x).replace('Muy alta','very-high').toLowerCase()}">${priorityLabel(x)}</span><button class="btn mini" onclick="studyPlanTopic('${encodeURIComponent(x.specialty)}','${encodeURIComponent(x.topic)}')">Estudiar</button></div>`).join('')}
  function planPanelHtml(sp){
    const p=planFor(sp),measured=diagnosticStatus(sp),source=p.metrics.find(x=>x.exam)?.yieldSource||p.metrics[0]?.yieldSource||'Sin datos';
    if(!p.metrics.length)return'<div class="empty">No hay temas clasificados para crear un plan.</div>';
    return `<div class="plan-method"><span><b>42%</b> brecha</span><span><b>25%</b> frecuencia MIR</span><span><b>13%</b> tarjetas vencidas</span><span><b>12%</b> errores</span><span><b>8%</b> tiempo sin repasar</span><small>Fuente de frecuencia: ${esc(source)}</small></div>${!measured.attempts?`<div class="mir-note"><strong>Plan provisional:</strong> haz el pretest para sustituir la estimación inicial por tu rendimiento real.</div>`:''}<div class="grid cols-2 diagnostic-plan-grid"><div class="card"><div class="section-head"><h3>Orden de prioridad</h3><span class="chip">${p.metrics.length} temas</span></div>${metricRowsHtml(p.metrics)}</div><div class="card"><div class="section-head"><h3>Semana intercalada</h3><span class="chip">14 bloques</span></div><div class="adaptive-week">${p.days.map(day=>`<div class="adaptive-day"><strong>${day.label}</strong>${day.items.map(x=>`<button onclick="studyPlanTopic('${encodeURIComponent(sp)}','${encodeURIComponent(x.topic)}')"><span>${esc(x.topic)}</span><small>25 min · ${x.difficulty} · ${x.due?Math.min(15,x.due)+' vencidas':'recuerdo + preguntas'}</small></button>`).join('')||'<span class="muted small">Descanso / simulacro</span>'}</div>`).join('')}</div></div></div><p class="muted small plan-note">Cada bloque: recuperación sin mirar → flashcards vencidas → 3–5 preguntas. NEXMIR recalcula la prioridad con tus nuevas respuestas; un tema fuerte de alta frecuencia conserva bloques de mantenimiento.</p>`;
  }
  function openDiagnosticPlan(encoded){state.planSpecialty=decodeURIComponent(encoded);return route('calendar')}
  function refreshAdaptivePlan(){const sp=$('#adaptivePlanSpecialty')?.value||state.planSpecialty||'';state.planSpecialty=sp;return runPlanLoading(()=>{if(state.view!=='calendar'||sp!==state.planSpecialty)return;const box=$('#adaptivePlanBody');if(box)box.innerHTML=planPanelHtml(sp)})}
  function studyPlanTopic(es,et){const sp=decodeURIComponent(es),topic=decodeURIComponent(et);const items=studyContent().filter(x=>sameSpecialty(x.specialty,sp)&&(x.topic||'General')===topic);if(!items.length)return toast('Este tema aún no tiene contenido de estudio publicado');openTopic(encodeURIComponent(sp),encodeURIComponent(topic))}

  const oldRenderCalendar=renderCalendar;
  renderCalendar=function(){oldRenderCalendar();const specs=specialtySummary().map(x=>x.name).filter(x=>x!=='Desagrupadas'),preferred=(specs.includes(state.planSpecialty)?state.planSpecialty:null)||specs.sort((a,b)=>diagnosticAttempts(b).length-diagnosticAttempts(a).length)[0]||'';state.planSpecialty=preferred;const root=$('#view-calendar');if(root)root.insertAdjacentHTML('beforeend',`<div class="section-head"><div><h2>Plan adaptativo por temas</h2><p class="muted">Se recalcula con diagnóstico, actividad reciente, frecuencia disponible y tarjetas vencidas.</p></div><select id="adaptivePlanSpecialty" onchange="refreshAdaptivePlan()">${specs.map(x=>`<option value="${esc(x)}" ${x===preferred?'selected':''}>${esc(x.toLocaleUpperCase('es'))}</option>`).join('')}</select></div><div id="adaptivePlanBody">${preferred?planPanelHtml(preferred):'<div class="empty">Publica contenido clasificado para crear el plan.</div>'}</div>`) };

  window.startSpecialtyDiagnostic=startSpecialtyDiagnostic;window.startSelectedStudyDiagnostic=startSelectedStudyDiagnostic;window.startSelectedReviewDiagnostic=startSelectedReviewDiagnostic;window.refreshStudyDiagnosticStatus=refreshStudyDiagnosticStatus;window.chooseDiagnosticOption=chooseDiagnosticOption;window.nextDiagnosticQuestion=nextDiagnosticQuestion;window.closeDiagnostic=closeDiagnostic;window.openDiagnosticPlan=openDiagnosticPlan;window.refreshAdaptivePlan=refreshAdaptivePlan;window.studyPlanTopic=studyPlanTopic;window.highlightDiagnostic=highlightDiagnostic;window.captureDiagnosticHighlight=captureDiagnosticHighlight;window.toggleDiagnosticDiscard=toggleDiagnosticDiscard;
  window.__nexmirDiagnosticTest={buildDiagnosticPool,diagnosticStatus,topicMetrics,planFor};
})();
