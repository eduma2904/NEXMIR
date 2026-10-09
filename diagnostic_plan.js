/* NEXMIR V5.0.13 · pretest diagnóstico y plan adaptativo por temas */
(() => {
  const DAY=86400000;
  state.diagnostic={active:false,pool:[],index:0,answers:{},specialty:null,saving:false};
  state.topicFeedback=[];
  function examHorizon(){const raw=state.studyPlan?.mir_date||'2027-01-23',date=new Date(raw+'T12:00:00'),days=Number.isFinite(date.getTime())?Math.max(0,Math.ceil((date-Date.now())/DAY)):120;return{days,phase:days>180?'Cobertura':days>60?'Consolidación':'Repaso final'}}
  if(typeof loadAll==='function'){
    const priorLoadAll=loadAll;
    loadAll=async function(){await priorLoadAll();if(!state.user)return;const uid=state.user.id;state.topicFeedback=await safeLoad('autoevaluación de teoría',()=>fetchAllPages(()=>state.sb.from('user_topic_feedback').select('*').eq('user_id',uid)),[])};
  }

  function sameSpecialty(value,sp){return displaySpecialty(value)===sp||canonicalSpecialty(value)===canonicalSpecialty(sp)}
  function validDiagnosticQuestion(q){const opts=q?.options||[];return opts.length>=2&&Number.isInteger(+q.correct_index)&&+q.correct_index>=0&&+q.correct_index<opts.length&&String(q.stem||q.question||'').trim()}
  let cachedIndex;
  const specialtyKey=value=>canonicalSpecialty(displaySpecialty(value));
  function diagnosticIndex(){
    const arrays=[state.content,state.questions,state.attempts,state.reviews,state.errorLog,state.topicFeedback],signature=arrays.flatMap(rows=>[rows,rows.length]);
    if(cachedIndex&&Date.now()-cachedIndex.createdAt<30000&&signature.every((v,i)=>v===cachedIndex.signature[i]))return cachedIndex;
    const bySpecialty=new Map(),pool=questionPool(),questions=new Map(pool.map(q=>[`${q._source}:${q.id}`,q])),rm=reviewMap(),now=Date.now();
    const group=value=>{const key=specialtyKey(value);if(!bySpecialty.has(key))bySpecialty.set(key,{questions:[],attempts:[],topics:new Map()});return bySpecialty.get(key)};
    const topic=(g,name)=>{name=name||'General';if(!g.topics.has(name))g.topics.set(name,{topic:name,cards:0,due:0,exam:0,questions:0,theory:0,weightedN:0,weightedOk:0,errorSum:0,last:0});return g.topics.get(name)};
    const contentById=new Map();for(const x of studyContent()){contentById.set(x.id,x);const v=topic(group(x.specialty),x.topic);if(x.kind==='card'){v.cards++;const r=rm[x.id];if(!r||!r.next_review_at||new Date(r.next_review_at).getTime()<=now)v.due++}else if(x.kind==='theory')v.theory++}
    for(const r of state.reviews){const x=contentById.get(r.content_id),rating=Number(r.last_rating);if(!x||x.kind!=='card'||rating<1||rating>4)continue;const v=topic(group(x.specialty),x.topic);v.weightedN+=1.5;v.weightedOk+=rating>=3?1.5:rating===2?.5:0;v.last=Math.max(v.last,new Date(r.last_reviewed_at||0).getTime()||0)}
    for(const f of state.topicFeedback){const v=topic(group(f.specialty),f.topic),rating=Number(f.rating);if(rating<1||rating>4)continue;v.weightedN+=2;v.weightedOk+=rating>=3?2:rating===2?.5:0;v.last=Math.max(v.last,new Date(f.updated_at||0).getTime()||0)}
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

  function examEvidence(q){return !!(q._simulationOrigin||q.source_exam||q.content_use==='simulation'||q.remnote_metadata?.content_use==='simulation')}
  function topicMetrics(sp){
    const all=[...specialtyData(sp).topics.values()].map(v=>({...v,specialty:sp})),now=Date.now(),specific=all.filter(v=>v.topic!=='General'),basis=specific.length?specific:all,maxExam=Math.max(0,...basis.map(v=>v.exam)),maxQuestions=Math.max(1,...basis.map(v=>v.questions));
    const phase=examHorizon().phase,weights=phase==='Cobertura'?[.38,.22,.14,.12,.14]:phase==='Repaso final'?[.39,.38,.09,.10,.04]:[.40,.30,.12,.11,.07];
    for(const v of all){
      const daysSince=v.last?Math.max(0,(now-v.last)/DAY):30;
      v.mastery=(2+v.weightedOk)/(4+v.weightedN);v.accuracy=Math.round(v.mastery*100);v.confidence=v.weightedN>=8?'Alta':v.weightedN>=3?'Media':'Baja';v.yield=(v.topic==='General'&&specific.length)?0.25:Math.min(1,maxExam?v.exam/maxExam:v.questions/maxQuestions);v.yieldSource=maxExam?'Exámenes importados':'Cobertura del banco';v.duePressure=v.cards?v.due/v.cards:0;
      v.errorPressure=Math.min(1,v.errorSum/8);v.forgetting=Math.min(1,daysSince/21);
      v.priority=weights[0]*(1-v.mastery)+weights[1]*v.yield+weights[2]*v.duePressure+weights[3]*v.errorPressure+weights[4]*v.forgetting;
      v.difficulty=v.mastery<.45?'Fundamentos':v.mastery<.7?'Aplicación':'Casos exigentes';v.priorityPct=Math.round(v.priority*100);
    }
    return all.filter(v=>v.cards||v.questions||v.theory).sort((a,b)=>b.priority-a.priority||b.questions-a.questions);
  }
  // Published simulations change the allocation from the first upload. The
  // initial sample is a 200-question prior so one small upload cannot dominate.
  function specialtyWeek(){
    const blueprint=window.NexmirExamBlueprint?.reliableCounts||{};
    const live=new Map();for(const q of questionPool())if(validDiagnosticQuestion(q)&&examEvidence(q)){
      const name=displaySpecialty(q.specialty);if(name!=='Desagrupadas')live.set(name,(live.get(name)||0)+1);
    }
    const specs=new Set([...specialtySummary().map(x=>x.name),...live.keys()]);
    const liveTotal=[...live.values()].reduce((a,b)=>a+b,0),priorTotal=Object.values(blueprint).reduce((a,b)=>a+Number(b||0),0)||1;
    const rows=[...specs].filter(x=>x!=='Desagrupadas').map(name=>{
      const baseline=Number(blueprint[canonicalSpecialty(name)]||blueprint[name]||0);
      const n=200*baseline/priorTotal+(live.get(name)||0);
      const data=specialtyData(name),topics=[...data.topics.values()],attemptN=topics.reduce((a,t)=>a+t.weightedN,0);
      const mastery=attemptN>=3?topics.reduce((a,t)=>a+t.weightedOk,0)/attemptN:.5;
      const due=topics.reduce((a,t)=>a+t.due,0),errors=topics.reduce((a,t)=>a+t.errorSum,0);
      const phase=examHorizon().phase,exponent=phase==='Cobertura'?.65:phase==='Repaso final'?.95:.8;
      const score=Math.pow(Math.max(1,n),exponent)*(.75+Math.min(.9,1-mastery))*(1+Math.min(.3,due/40)+Math.min(.3,errors/20));
      return{name,n,mastery,score,topics:topicMetrics(name)};
    }).filter(x=>x.n||specialtyData(x.name).topics.size).sort((a,b)=>b.score-a.score);
    const source=liveTotal?`${liveTotal} preguntas de simulacros publicadas + muestra inicial`:'18 simulacros aportados (muestra inicial)';
    if(!rows.length)return{days:[],rows:[],source,liveTotal};
    const total=28,week=Math.floor(Date.now()/604800000);
    const phase=examHorizon().phase,headCount=phase==='Cobertura'?8:phase==='Repaso final'?12:10,rotation=14-headCount;
    const head=rows.slice(0,Math.min(headCount,rows.length));
    const tail=rows.slice(headCount),offset=tail.length?(week*rotation)%tail.length:0;
    const chosen=[...head,...Array.from({length:Math.min(rotation,tail.length)},(_,i)=>tail[(offset+i)%tail.length])];
    const count=new Map(chosen.map(x=>[x.name,1]));let left=total-chosen.length;
    const sum=chosen.reduce((a,x)=>a+x.score,0)||1;
    const remainder=chosen.map(x=>({x,value:left*x.score/sum}));
    for(const item of remainder){const n=Math.floor(item.value);count.set(item.x.name,count.get(item.x.name)+n);left-=n}
    remainder.sort((a,b)=>(b.value%1)-(a.value%1));for(let i=0;i<left;i++)count.set(remainder[i].x.name,count.get(remainder[i].x.name)+1);
    const queue=[],occurrences=new Map();
    for(let i=0;i<total;i++){
      const best=chosen.filter(x=>count.get(x.name)>0).sort((a,b)=>{
        const recent=sp=>queue.slice(-4).filter(q=>q.name===sp).length;
        return (b.score/(1+recent(b.name)*3))-(a.score/(1+recent(a.name)*3));
      })[0];if(!best)break;
      const seen=occurrences.get(best.name)||0,rank=seen===0?0:seen%2?Math.ceil(seen/2):0;
      queue.push({name:best.name,n:best.n,topic:best.topics[rank%Math.max(1,best.topics.length)]?.topic||'General'});
      occurrences.set(best.name,seen+1);count.set(best.name,count.get(best.name)-1);
    }
    const days=Array.from({length:7},(_,i)=>({label:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][i],items:[]}));
    queue.forEach((x,i)=>days[i%7].items.push(x));return{days,rows,source,liveTotal};
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
  if(typeof openTopic==='function'){
    const oldOpenTopic=openTopic;
    openTopic=function(es,et){oldOpenTopic(es,et);const sp=decodeURIComponent(es),topic=decodeURIComponent(et);if(!state.studyPath?.items?.some(x=>x.kind==='theory'))return;
      const body=$('#studyDialogBody'),area=document.createElement('div');area.className='theory-feedback card';area.innerHTML=`<strong>Después de estudiar la teoría, ¿cómo te fue?</strong><p class="muted small">Esta autoevaluación ajusta el dominio del tema en tu plan. Puedes cambiarla después.</p><div class="actions"><button type="button" class="btn" onclick="rateTheoryTopic('${encodeURIComponent(sp)}','${encodeURIComponent(topic)}',1)">Necesito repasarlo</button><button type="button" class="btn" onclick="rateTheoryTopic('${encodeURIComponent(sp)}','${encodeURIComponent(topic)}',4)">Lo domino</button></div><small id="theoryFeedbackStatus" class="muted"></small>`;body.append(area);
    };
  }
  async function rateTheoryTopic(es,et,rating){const sp=decodeURIComponent(es),topic=decodeURIComponent(et),row={user_id:state.user.id,specialty:sp,topic,rating,updated_at:new Date().toISOString()};const {error}=await state.sb.from('user_topic_feedback').upsert(row,{onConflict:'user_id,specialty,topic'});if(error)return toast('No se pudo guardar: '+error.message);state.topicFeedback=[...state.topicFeedback.filter(x=>!(sameSpecialty(x.specialty,sp)&&x.topic===topic)),row];const status=$('#theoryFeedbackStatus');if(status)status.textContent=rating===4?'Registrado: lo domino':'Registrado: necesito repasarlo';toast('El plan se ajustará con esta autoevaluación')}
  window.rateTheoryTopic=rateTheoryTopic;

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
    const rows=currentDiagnosticResults(d),ok=rows.reduce((a,x)=>a+x.ok,0),total=rows.reduce((a,x)=>a+x.n,0),metrics=topicMetrics(d.specialty);
    $('#questionDialogBody').innerHTML=`<div class="dialog-head"><div><span class="chip">Diagnóstico completado</span><h2>${esc(d.specialty)} · ${ok}/${total}</h2></div><button class="icon-btn" onclick="$('#questionDialog').close();route('${esc(d.returnView||'study')}')">×</button></div><p class="muted">El resultado es una estimación inicial. Se corregirá con banqueos, simulacros y repasos posteriores.</p><div class="diagnostic-results">${rows.map(x=>`<div class="diagnostic-result ${x.acc<50?'weak':x.acc>=80?'strong':''}"><div><strong>${esc(x.topic)}</strong><span>${x.ok}/${x.n} correctas</span></div><b>${x.acc}%</b></div>`).join('')}</div><div class="callout"><strong>Prioridad inicial</strong><p>${metrics.length?`El tema que más conviene reforzar ahora es ${esc(metrics[0].topic)}. Consulta la semana de estudio para ver sus bloques asignados.`:'Necesitas contenido clasificado para generar el plan.'}</p></div><div class="dialog-actions"><button class="btn" onclick="$('#questionDialog').close();route('${esc(d.returnView||'study')}')">Cerrar</button><button class="btn primary" onclick="$('#questionDialog').close();openDiagnosticPlan('${encodeURIComponent(d.specialty)}')">Ver mi plan</button></div>`;
  }

  function priorityLabel(x){return x.priority>=.6?'Muy alta':x.priority>=.45?'Alta':x.priority>=.3?'Media':'Mantenimiento'}
  function metricRowsHtml(metrics,assigned){return metrics.slice(0,10).map((x,i)=>{
    const blocks=assigned.get(x.topic)||0;
    const evidence=x.weightedN<3?'Estimación inicial':`Aciertos estimados ${x.accuracy}%`;
    return `<div class="plan-topic-row"><span class="plan-rank">${i+1}</span><div class="grow"><button type="button" class="plan-topic-link" onclick="studyPlanTopic('${encodeURIComponent(x.specialty)}','${encodeURIComponent(x.topic)}')">${esc(x.topic)} →</button><div class="path">${evidence} · ${x.exam} en simulacros · ${x.questions} en banco · ${x.due} tarjetas vencidas</div><div class="priority-track"><i style="width:${Math.min(100,x.priorityPct)}%"></i></div></div><span class="priority-pill p${priorityLabel(x).replace('Muy alta','very-high').toLowerCase()}">${priorityLabel(x)}</span><span class="plan-allocation">${blocks?blocks+' bloque'+(blocks===1?'':'s'):'En espera'}</span></div>`;
  }).join('')}
  function planPanelHtml(sp,week=state.planWeek||specialtyWeek()){
    const metrics=topicMetrics(sp),selected=week.days.map(day=>({label:day.label,items:day.items.filter(x=>sameSpecialty(x.name,sp))})).filter(day=>day.items.length);
    const blocks=selected.reduce((n,day)=>n+day.items.length,0),assigned=new Map();for(const day of selected)for(const item of day.items)assigned.set(item.topic,(assigned.get(item.topic)||0)+1);
    if(!metrics.length)return'<div class="empty">Aún no hay preguntas ni tarjetas clasificadas para esta especialidad.</div>';
    const source=metrics.find(x=>x.exam)?.yieldSource||metrics[0]?.yieldSource||'Sin datos',measured=diagnosticStatus(sp),horizon=examHorizon();
    return `<div class="plan-detail-intro"><div><span class="chip">PASO 2 · TEMAS DE LA ESPECIALIDAD</span><h2>Dentro de ${esc(sp)}</h2><p>Arriba elegiste una especialidad. Aquí ves sus <strong>${blocks} bloque${blocks===1?'':'s'} de la misma semana</strong> y los temas asignados a cada uno. La lista de prioridad explica esa elección.</p></div><span class="plan-detail-count">${blocks} × 25 min</span></div>
    ${!measured.attempts?'<p class="mir-note"><strong>Estimación inicial:</strong> el pretest y tus siguientes respuestas ajustarán el orden de los temas.</p>':''}
    <div class="grid cols-2 diagnostic-plan-grid"><div class="card"><div class="section-head"><h3>Por qué estos temas</h3><span class="chip">${metrics.length} temas</span></div><p class="muted small">Fase ${horizon.phase.toLowerCase()} (${horizon.days} días restantes). Se combinan preguntas de simulacros, aciertos y fallos en banqueos, repasos de flashcards y tu autoevaluación de teoría. «En espera» indica que el tema sigue disponible, pero no tiene bloque esta semana.</p>${metricRowsHtml(metrics,assigned)}</div>
    <div class="card"><div class="section-head"><h3>Bloques de ${esc(sp)} esta semana</h3><span class="chip">${blocks} en el calendario</span></div>${selected.length?`<div class="plan-selected-week">${selected.map(day=>`<div class="plan-selected-day"><strong>${day.label}</strong>${day.items.map(x=>`<button type="button" onclick="studyPlanTopic('${encodeURIComponent(sp)}','${encodeURIComponent(x.topic)}')"><span>${esc(x.topic)}</span><small>25 min · Abrir material y preguntas →</small></button>`).join('')}</div>`).join('')}</div>`:'<p class="muted">Esta especialidad no tiene bloque asignado esta semana. Se alterna con otras de menor frecuencia en las próximas semanas. Puedes abrir cualquier tema de la lista para estudiar hoy.</p>'}</div></div>
    <details class="plan-method-help"><summary>¿Cómo se decide el orden de los temas?</summary><p>En cobertura se reparten más especialidades y temas; en repaso final se concentran bloques en alta frecuencia y bajo dominio. Se usan dominio, frecuencia de simulacros, tarjetas vencidas, errores y tiempo sin practicar. La teoría se pondera cuando marcas cómo la comprendiste. Fuente de frecuencia: ${esc(source)}. La dificultad se estima por desempeño y errores; no se infiere solo por leer teoría.</p></details>`;
  }
  function selectPlanSpecialty(encoded,scroll=true){
    const sp=decodeURIComponent(encoded);state.planSpecialty=sp;
    const selector=$('#adaptivePlanSpecialty');if(selector)selector.value=sp;
    const box=$('#adaptivePlanBody');if(box)box.innerHTML=planPanelHtml(sp);
    $$('#view-calendar .specialty-day button[data-plan-specialty]').forEach(btn=>{
      const chosen=btn.dataset.planSpecialty===sp;btn.classList.toggle('selected',chosen);btn.setAttribute('aria-pressed',String(chosen));
    });
    if(scroll)$('#planSpecialtyDetail')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function openDiagnosticPlan(encoded){
    state.planSpecialty=decodeURIComponent(encoded);
    if(state.view==='calendar'){selectPlanSpecialty(encoded);return}
    return Promise.resolve(route('calendar')).then(()=>selectPlanSpecialty(encoded));
  }
  function refreshAdaptivePlan(){const sp=$('#adaptivePlanSpecialty')?.value||state.planSpecialty||'';selectPlanSpecialty(encodeURIComponent(sp),false)}
  function startPlanQuestions(es,et){
    const sp=decodeURIComponent(es),topic=decodeURIComponent(et);
    const pool=questionPool().filter(q=>sameSpecialty(q.specialty,sp)&&(q.topic||'General')===topic&&validDiagnosticQuestion(q)).sort(()=>Math.random()-.5).slice(0,10);
    if(!pool.length)return toast('Este tema aún no tiene preguntas publicadas');
    state.bank={pool,index:0,answered:false,selected:null,mode:'immediate',results:[],context:'bank',highlights:{},answers:{},eliminations:{},submitted:false};showQuestion();
  }
  function studyPlanTopic(es,et){const sp=decodeURIComponent(es),topic=decodeURIComponent(et);const items=studyContent().filter(x=>sameSpecialty(x.specialty,sp)&&(x.topic||'General')===topic);if(!items.length)return startPlanQuestions(es,et);openTopic(encodeURIComponent(sp),encodeURIComponent(topic))}
  function specialtyWeekHtml(plan,preferred){
    if(!plan.days.length)return'<div class="empty">Publica preguntas o tarjetas clasificadas para mostrar la semana de estudio.</div>';
    return `<section class="card plan-main-week"><div class="section-head"><div><span class="chip">PASO 1 · SEMANA COMPLETA</span><h2>Qué estudiar cada día</h2><p class="muted">Cada bloque indica <strong>especialidad → tema</strong>. Hay 28 bloques de 25 minutos: las especialidades más frecuentes y tus áreas difíciles aparecen más veces. Pulsa un bloque para ver sus temas y comenzar a estudiar.</p></div><div class="plan-week-actions"><span class="chip">4 bloques por día</span><button type="button" class="btn mini" onclick="refreshStudyPlanData()">Actualizar frecuencias</button></div></div><div class="adaptive-week">${plan.days.map(day=>`<div class="adaptive-day specialty-day"><strong>${day.label}</strong>${day.items.map(x=>`<button type="button" data-plan-specialty="${esc(x.name)}" aria-pressed="${x.name===preferred}" class="${x.name===preferred?'selected':''}" onclick="selectPlanSpecialty('${encodeURIComponent(x.name)}')"><span class="plan-block-specialty">${esc(x.name)}</span><small>Tema: ${esc(x.topic)}</small><span class="plan-block-action">Ver por qué y estudiar →</span></button>`).join('')}</div>`).join('')}</div><p class="muted small plan-source">Distribución basada en ${esc(plan.source)} y ajustada según tus respuestas y repasos. Cada simulacro publicado actualiza las frecuencias al abrir o actualizar este plan. ${state.planSyncError?'No se pudo comprobar la última carga; se muestran los datos disponibles.':''}</p></section>`;
  }

  const oldRenderCalendar=renderCalendar;
  renderCalendar=function(){
    oldRenderCalendar();const plan=specialtyWeek();state.planWeek=plan;
    const specs=[...new Set([...specialtySummary().map(x=>x.name),...questionPool().map(x=>displaySpecialty(x.specialty))])].filter(x=>x!=='Desagrupadas');
    const preferred=specs.includes(state.planSpecialty)?state.planSpecialty:(plan.days.flatMap(x=>x.items)[0]?.name||specs[0]||'');state.planSpecialty=preferred;
    const root=$('#view-calendar');if(root)root.insertAdjacentHTML('beforeend',`${specialtyWeekHtml(plan,preferred)}<section id="planSpecialtyDetail" class="plan-specialty-detail"><div class="section-head"><div><span class="chip">PASO 2 · DETALLE DEL BLOQUE</span><h2>Temas de la especialidad elegida</h2><p class="muted">Selecciona un bloque de arriba o una especialidad aquí. Se muestran sus sesiones de esa misma semana.</p></div><label class="plan-specialty-select">Especialidad<select id="adaptivePlanSpecialty" onchange="refreshAdaptivePlan()">${specs.map(x=>`<option value="${esc(x)}" ${x===preferred?'selected':''}>${esc(x)}</option>`).join('')}</select></label></div><div id="adaptivePlanBody">${preferred?planPanelHtml(preferred,plan):'<div class="empty">Publica contenido clasificado para crear el plan.</div>'}</div></section>`);
  };

  let planDataRefreshedAt=0,planRefreshPromise=null;
  async function refreshPublishedPlanContent(){
    if(!state.sb||!state.user||Date.now()-planDataRefreshedAt<60000)return;
    if(planRefreshPromise)return planRefreshPromise;
    const uid=state.user.id;
    planRefreshPromise=(async()=>{
      try{
        const [questions,cards,feedback]=await Promise.all([
          fetchAllPages(()=>state.sb.from('questions').select('id,source_uid,source_number,source_exam,source,status,stem,options,correct_index,explanation,specialty,topic,subtopic,section,image_path,year,remnote_metadata,created_at,updated_at').eq('status','published').order('created_at',{ascending:false})),
          fetchAllPages(()=>state.sb.from('content_items').select('id,source_uid,kind,card_type,status,current_version,payload,source_hash,source_path,specialty,topic,subtopic,section,last_reviewed_at,created_at,updated_at').eq('status','published').eq('kind','card').eq('card_type','multiple_choice').order('id')),
          safeLoad('autoevaluación de teoría',()=>fetchAllPages(()=>state.sb.from('user_topic_feedback').select('*').eq('user_id',uid)),state.topicFeedback)
        ]);
        if(state.user?.id!==uid)return;
        const imageUrls=new Map(state.questions.map(q=>[q.id,q.image_url]));
        state.questions=questions.map(q=>({...repairImportedClassification(q),image_url:imageUrls.get(q.id)||null}));
        state.content=[...state.content.filter(x=>x.card_type!=='multiple_choice'),...cards.map(repairImportedClassification)];
        state.topicFeedback=feedback;
        hydrateQuestionImages().catch(e=>console.warn('Imágenes diferidas del plan',e));
        planDataRefreshedAt=Date.now();state.planSyncError=false;
      }catch(e){console.warn('No se pudo actualizar la frecuencia del plan',e);state.planSyncError=true}
      finally{planRefreshPromise=null}
    })();
    return planRefreshPromise;
  }
  if(typeof render==='function'){
    const previousRender=render;
    render=async function(view){if(view==='calendar')await refreshPublishedPlanContent();return previousRender(view)};
  }
  window.refreshStudyPlanData=()=>{planDataRefreshedAt=0;return route('calendar')};
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.view==='calendar'&&Date.now()-planDataRefreshedAt>=60000)route('calendar')});

  window.startSpecialtyDiagnostic=startSpecialtyDiagnostic;window.startSelectedStudyDiagnostic=startSelectedStudyDiagnostic;window.startSelectedReviewDiagnostic=startSelectedReviewDiagnostic;window.refreshStudyDiagnosticStatus=refreshStudyDiagnosticStatus;window.chooseDiagnosticOption=chooseDiagnosticOption;window.nextDiagnosticQuestion=nextDiagnosticQuestion;window.closeDiagnostic=closeDiagnostic;window.openDiagnosticPlan=openDiagnosticPlan;window.refreshAdaptivePlan=refreshAdaptivePlan;window.selectPlanSpecialty=selectPlanSpecialty;window.studyPlanTopic=studyPlanTopic;window.highlightDiagnostic=highlightDiagnostic;window.captureDiagnosticHighlight=captureDiagnosticHighlight;window.toggleDiagnosticDiscard=toggleDiagnosticDiscard;
  window.startPlanQuestions=startPlanQuestions;
  window.__nexmirDiagnosticTest={buildDiagnosticPool,diagnosticStatus,topicMetrics,specialtyWeek,planPanelHtml,specialtyWeekHtml};
})();
