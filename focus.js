/* NEXMIR Focus V1 · estudio activo, repetición, mastery, XP, racha y antifarmeo */
(() => {
  const R=window.NexmirFocusRules;
  window.NEXMIR_FOCUS_BACKEND_READY=false;
  const $f=s=>document.querySelector(s);
  const $$f=s=>[...document.querySelectorAll(s)];
  const F={
    ready:false,session:null,pool:[],index:0,selected:null,result:null,processing:false,
    activeSeconds:0,questionActiveSeconds:0,skipped:0,lastInteraction:Date.now(),lastHeartbeat:0,
    reachedTime:false,tick:null,subject:'',topic:'',initialMastery:0,clientSessionId:null,
    bankLastKey:null,bankLastInteraction:Date.now(),bankTimings:{},bankEvents:{},simTimings:{},diagnosticTimings:{},draftDuration:15,answerEventId:null,startClientId:null,
    eliminations:{},highlights:{}
  };
  const uuid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  const qKey=q=>q?`${q._source||'questions'}:${q.id}`:'';
  const now=()=>Date.now();
  const safeText=s=>typeof esc==='function'?esc(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const fmtSec=s=>{s=Math.max(0,Math.floor(Number(s)||0));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};
  const localDate=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
  const timezone=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch{return'UTC'}};
  const visibleActive=()=>!document.hidden&&document.hasFocus()&&(now()-F.lastInteraction)<90000;
  const focusSourceId=q=>String(q?.id||'');
  let learningCache=null,learningRows=null;
  const learningMap=()=>{if(learningRows!==state.focusLearning){learningRows=state.focusLearning;learningCache=new Map((learningRows||[]).map(x=>[`${x.source_type}:${x.source_id}`,x]))}return learningCache};
  const learningFor=q=>learningMap().get(qKey(q))||null;
  const bankActiveFor=q=>Math.max(0,Math.round(F.bankTimings[qKey(q)]||0));
  window.nexmirQuestionActiveSeconds=(q,mode)=>Math.max(0,Math.round((mode==='simulation'?F.simTimings:F.diagnosticTimings)[qKey(q)]||0));
  window.nexmirBankCheckpoint=()=>({events:{...F.bankEvents},timings:{...F.bankTimings}});
  window.nexmirRestoreBankCheckpoint=data=>{F.bankEvents=data?.events||{};F.bankTimings=data?.timings||{}};

  async function fetchPages(make,page=1000){const out=[];for(let i=0;;i+=page){const {data,error}=await make().range(i,i+page-1);if(error)throw error;out.push(...(data||[]));if((data||[]).length<page)break}return out}
  async function opt(label,fn,fallback){try{return await fn()}catch(e){console.warn('Focus:',label,e);return fallback}}

  function ensureDom(){
    if($f('#focusSessionDialog'))return;
    document.body.insertAdjacentHTML('beforeend',`
      <dialog id="focusSessionDialog" class="dialog focus-session-dialog" aria-labelledby="focusSessionTitle"><div id="focusSessionBody"></div></dialog>
      <dialog id="paceWarningDialog" class="dialog pace-warning-dialog" aria-labelledby="paceWarningTitle"><div id="paceWarningBody"></div></dialog>
      <dialog id="focusSummaryDialog" class="dialog focus-summary-dialog" aria-labelledby="focusSummaryTitle"><div id="focusSummaryBody"></div></dialog>
      <dialog id="focusMissionDialog" class="dialog focus-mission-dialog" aria-labelledby="focusMissionTitle"><div id="focusMissionBody"></div></dialog>
      <dialog id="freezeNoticeDialog" class="dialog" aria-labelledby="freezeNoticeTitle"><div id="freezeNoticeBody"></div></dialog>
    `);
    $f('#focusSessionDialog').addEventListener('cancel',e=>{e.preventDefault();finishFocusEarly()});
  }

  async function ensurePreferences(){
    const z=timezone();
    const {data,error}=await state.sb.from('user_study_preferences').select('*').eq('user_id',state.user.id).maybeSingle();
    if(error)throw error;
    if(!data){
      const res=await state.sb.from('user_study_preferences').insert({user_id:state.user.id,timezone:z}).select().single();
      if(res.error)throw res.error;state.focusPreferences=res.data;
    }else{
      state.focusPreferences=data;
      if((!data.timezone||data.timezone==='UTC')&&z!=='UTC'){
        const res=await state.sb.from('user_study_preferences').update({timezone:z,updated_at:new Date().toISOString()}).eq('user_id',state.user.id).select().single();
        if(!res.error)state.focusPreferences=res.data;
      }
    }
    applyPreferences();
  }

  async function loadFocusData(){
    if(!state.user||!state.sb)return;
    const userId=state.user.id;
    try{
      await ensurePreferences();
      const [learning,active]=await Promise.all([
        opt('estado de aprendizaje',()=>fetchPages(()=>state.sb.from('user_question_learning_state').select('*').eq('user_id',userId)),[]),
        opt('sesión activa',()=>state.sb.from('focus_sessions').select('*').eq('user_id',userId).eq('status','active').order('started_at',{ascending:false}).limit(1).maybeSingle().then(r=>{if(r.error)throw r.error;return r.data||null}),null)
      ]);
      if(state.user?.id!==userId)return;
      state.focusLearning=learning||[];state.focusActiveSession=active||null;
      F.ready=true;window.NEXMIR_FOCUS_BACKEND_READY=true;
      // Las estadísticas no condicionan la reanudación de una sesión pendiente.
      void (async()=>{
        const [xp,freeze]=await Promise.all([
          opt('eventos XP',()=>fetchPages(()=>state.sb.from('xp_events').select('id,event_type,xp_amount,created_at,source_type,source_id,focus_session_id').eq('user_id',userId).order('created_at',{ascending:false})),[]),
          opt('congeladores',()=>state.sb.from('streak_freezes').select('*').eq('user_id',userId).order('protected_date',{ascending:false}).limit(12).then(r=>{if(r.error)throw r.error;return r.data||[]}),[])
        ]);
        if(state.user?.id!==userId)return;
        state.xpEvents=xp||[];state.focusXp=(xp||[]).reduce((s,x)=>s+(Number(x.xp_amount)||0),0);state.streakFreezes=freeze||[];
        const streak=await opt('racha',()=>state.sb.rpc('nexmir_refresh_streak').then(r=>{if(r.error)throw r.error;return r.data}),null);
        if(streak)state.studyStreak=streak;
        const missions=await opt('misiones',()=>state.sb.rpc('nexmir_sync_daily_missions').then(r=>{if(r.error)throw r.error;return r.data||[]}),[]);
        if(state.user?.id!==userId)return;
        state.focusMissions=missions||[];showFreezeNoticeIfNeeded();
        if(state.view==='focus')renderFocusHome();
      })().catch(e=>console.warn('Estadísticas Focus diferidas',e));
    }catch(e){F.ready=false;window.NEXMIR_FOCUS_BACKEND_READY=false;state.focusLoadError=e;console.warn('NexMIR Focus requiere NEXMIR_FOCUS_V1.sql',e)}
  }
  let focusLoadUser=null,focusLoadPromise=null,focusLoadPending=false;
  function requestFocusData(){
    const userId=state.user?.id;
    if(!userId)return Promise.resolve();
    if(focusLoadUser===userId&&focusLoadPromise)return focusLoadPromise;
    focusLoadUser=userId;
    focusLoadPending=true;
    focusLoadPromise=loadFocusData().then(()=>{
      if(state.user?.id!==userId)return;
      focusLoadPending=false;
      if(state.view==='focus')renderFocusHome();
      else if(state.view==='dashboard'&&typeof window.renderDashboard==='function')window.renderDashboard();
    }).finally(()=>{if(state.user?.id===userId)focusLoadPending=false});
    window.nexmirFocusReadyPromise=focusLoadPromise;
    return focusLoadPromise;
  }
  window.addEventListener('nexmir:signout',()=>{focusLoadUser=null;focusLoadPromise=null;focusLoadPending=false;F.ready=false;window.NEXMIR_FOCUS_BACKEND_READY=false;window.nexmirFocusReadyPromise=null});

  function focusFeatureFlags(){
    const pro=['admin','moderator'].includes(state.profile?.role)||String(state.profile?.plan||'free').toLowerCase()==='pro';
    return {focus_basic:true,advanced_statistics:pro,advanced_adaptation:pro,intelligent_recommendations:pro,advanced_history:pro,advanced_personalization:pro};
  }
  window.nexmirFocusFeatureFlags=focusFeatureFlags;

  function applyPreferences(){
    const p=state.focusPreferences||{};
    document.documentElement.dataset.focusReduceMotion=p.reduce_animations?'true':'false';
    document.documentElement.dataset.focusShowProgress=p.show_progress===false?'false':'true';
  }

  function personalMedian(){
    const vals=(state.attempts||[]).filter(a=>a.is_valid!==false&&Number.isFinite(Number(a.question_active_time_seconds))).slice(0,30).map(a=>Number(a.question_active_time_seconds)).filter(n=>n>=0).sort((a,b)=>a-b);
    if(!vals.length)return {median:null,count:0};const m=vals.length%2?vals[(vals.length-1)/2]:(vals[vals.length/2-1]+vals[vals.length/2])/2;return{median:m,count:vals.length};
  }

  function effectiveFor(q){const l=learningFor(q);return l?R.effectiveMastery(l.mastery_score,l.last_valid_answered_at||l.last_answered_at):0}
  function masteryForFilter(subject='',topic=''){
    const all=questionPool().filter(q=>(!subject||displaySpecialty(q.specialty)===subject)&&(!topic||(q.topic||'General')===topic));
    if(!all.length)return 0;
    const indexed=learningMap();
    if(topic)return R.topicMastery(all.map(q=>indexed.get(qKey(q))).filter(Boolean),all.length);
    const topics=new Map();for(const q of all){const t=`${displaySpecialty(q.specialty)}||${q.topic||'General'}`,group=topics.get(t)||{count:0,rows:[]};group.count++;const row=indexed.get(qKey(q));if(row)group.rows.push(row);topics.set(t,group)}
    let weighted=0,total=0;for(const group of topics.values()){weighted+=R.topicMastery(group.rows,group.count)*group.count;total+=group.count}
    return total?Math.round(weighted/total):0;
  }

  const oldTopicMastery=window.topicMastery;
  window.topicMastery=function(sp,t){if(F.ready)return masteryForFilter(sp,t);return typeof oldTopicMastery==='function'?oldTopicMastery(sp,t):0};

  function priority(q){
    const l=learningFor(q);let s=R.reviewPriority(l);const err=(state.errorLog||[]).find(e=>`${e.source_type}:${e.source_id}`===qKey(q));
    if(err)s+=25+Math.min(25,Math.max(0,Number(err.failures||0)-1)*5);
    if((state.bookmarks||[]).some(b=>b.item_type==='question'&&String(b.item_id)===String(q.id)))s+=12;
    if(l?.last_valid_answered_at){const days=(now()-new Date(l.last_valid_answered_at).getTime())/86400000;if(days>30)s+=Math.min(20,Math.floor(days/15));}
    if(!l)s+=5;return s+Math.random()*2;
  }
  function buildFocusPool(subject='',topic='',count=20){
    let pool=questionPool().filter(q=>(q.options||[]).length>=2);
    if(subject)pool=pool.filter(q=>displaySpecialty(q.specialty)===subject);
    if(topic)pool=pool.filter(q=>(q.topic||'General')===topic);
    const errors=new Map((state.errorLog||[]).map(e=>[`${e.source_type}:${e.source_id}`,e]));
    const marks=new Set((state.bookmarks||[]).filter(b=>b.item_type==='question').map(b=>String(b.item_id)));
    const scored=pool.map(q=>{const l=learningFor(q),err=errors.get(qKey(q));let score=R.reviewPriority(l)+Math.random()*2;if(err)score+=25+Math.min(25,Math.max(0,Number(err.failures||0)-1)*5);if(marks.has(String(q.id)))score+=12;if(l?.last_valid_answered_at){const days=(now()-Date.parse(l.last_valid_answered_at))/86400000;if(days>30)score+=Math.min(20,Math.floor(days/15))}if(!l)score+=5;return {q,score}});
    return scored.sort((a,b)=>b.score-a.score).slice(0,Math.min(pool.length,count+10)).map(x=>x.q);
  }
  function reviewContext(q){const l=learningFor(q);if(!l)return'new';if(l.last_result===false)return'error_retry';if(l.next_review_at&&new Date(l.next_review_at).getTime()<=now())return'due';return'manual'}

  function missionLabel(m){return m.mission_type==='reviews'?'Completa 10 revisiones pendientes':m.mission_type==='new_questions'?'Responde 10 preguntas nuevas prioritarias':m.mission_type==='recover_errors'?'Recupera 3 errores':'Completa un Focus de 15 minutos'}
  function focusHomeHtml(){
    if(!F.ready)return focusLoadPending
      ?`<div class="hero-main" role="status"><span class="chip">NexMIR Focus</span><h1>Recuperando Focus…</h1><p>Estamos cargando tu progreso y la sesión pendiente.</p></div>`
      :`<div class="hero-main"><span class="chip">NexMIR Focus</span><h1>Falta activar el motor Focus</h1><p>Ejecuta <strong>supabase/NEXMIR_FOCUS_V1.sql</strong> después de las migraciones actuales. El código de la interfaz ya está instalado.</p></div>`;
    const st=state.studyStreak||{},xp=state.focusXp||0,lvl=R.levelFromXp(xp),active=state.focusActiveSession;
    const subjects=[...new Set(questionPool().map(q=>displaySpecialty(q.specialty)))].sort((a,b)=>a.localeCompare(b,'es'));
    const dur=[5,10,15,25,0];
    return `<div class="focus-home">
      <div class="hero-main focus-hero"><div><span class="chip">NexMIR Focus</span><h1>Estudia lo que más necesitas recordar</h1><p>Revisiones vencidas, errores, dominio bajo y preguntas nuevas se ordenan automáticamente para convertir práctica en memoria estable.</p></div>
      <div class="focus-hero-stats"><div><strong>🔥 ${st.current_streak||0}</strong><span>días de racha</span></div><div><strong>❄️ ${st.freezes_available??3}/3</strong><span>congeladores</span></div><div><strong>${xp} XP</strong><span>Nivel ${lvl.level}</span></div></div></div>
      ${active?`<div class="card focus-resume"><div><span class="chip">Continúa donde lo dejaste</span><h3>${safeText(active.subject_filter||'Sesión adaptativa')}</h3><p class="muted">${active.valid_questions||0}/${active.question_target} preguntas válidas · ${fmtSec(active.active_seconds||0)} activos</p></div><button class="btn primary" onclick="resumeNexmirFocus()">Continuar</button></div>`:''}
      <div class="grid cols-2 focus-setup-grid"><div class="card"><div class="section-head"><div><span class="chip">Microobjetivo</span><h3>¿Cuánto quieres estudiar?</h3></div></div><div class="focus-duration-grid">${dur.map(x=>`<button class="btn focus-duration ${F.draftDuration===x?'active':''}" data-duration="${x}" aria-pressed="${F.draftDuration===x}" onclick="setFocusDuration(${x})">${x?`${x} min`:'Sin temporizador'}</button>`).join('')}</div>
      <label>Asignatura<select id="focusSubject" onchange="refreshFocusTopicOptions()"><option value="">Automático · lo más prioritario</option>${subjects.map(s=>`<option value="${safeText(s)}">${safeText(s)}</option>`).join('')}</select></label>
      <label>Tema<select id="focusTopic"><option value="">Todos / automático</option></select></label><button class="btn primary full" onclick="previewNexmirFocus()">Preparar mi misión</button><p class="muted small">Disponible para Free y Pro. El progreso académico se mide por dominio; XP solo representa actividad y constancia.</p></div>
      <div class="card"><div class="section-head"><div><span class="chip">Hoy</span><h3>Misiones diarias</h3></div><span class="chip">máx. 85 XP</span></div><div class="focus-missions">${(state.focusMissions||[]).map(m=>`<div class="focus-mission ${m.completed_at?'done':''}"><span>${m.completed_at?'✓':'◎'}</span><div><strong>${safeText(missionLabel(m))}</strong><small>${Math.min(m.progress||0,m.target)}/${m.target}${m.completed_at?' · +20 XP':''}</small></div></div>`).join('')||'<p class="muted">Las misiones aparecerán al sincronizar tu actividad.</p>'}</div></div></div>
      <div class="grid cols-3 focus-stats-grid"><div class="card"><div class="metric">${masteryForFilter()}%</div><div class="metric-label">Dominio global estimado</div></div><div class="card"><div class="metric">15</div><div class="metric-label">Preguntas válidas para racha</div></div><div class="card"><div class="metric">10 min</div><div class="metric-label">Focus válido alternativo</div></div></div>
    </div>`;
  }

  function renderFocusHome(){const root=$f('#view-focus');if(root)root.innerHTML=focusHomeHtml();setTimeout(refreshFocusTopicOptions,0)}
  window.renderFocusHome=renderFocusHome;
  window.setFocusDuration=n=>{F.draftDuration=Number(n);$$f('.focus-duration').forEach(b=>{const active=Number(b.dataset.duration)===F.draftDuration;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))})};
  window.refreshFocusTopicOptions=()=>{
    const s=$f('#focusSubject')?.value||'',el=$f('#focusTopic');if(!el)return;
    const old=el.value,topics=[...new Set(questionPool().filter(q=>!s||displaySpecialty(q.specialty)===s).map(q=>q.topic||'General'))].sort((a,b)=>a.localeCompare(b,'es'));
    el.innerHTML='<option value="">Todos / automático</option>'+topics.map(t=>`<option value="${safeText(t)}">${safeText(t)}</option>`).join('');if(topics.includes(old))el.value=old;
  };

  function previewNexmirFocus(opts={}){
    if(!F.ready)return toast('Primero ejecuta NEXMIR_FOCUS_V1.sql en Supabase');
    const duration=opts.duration!==undefined?opts.duration:F.draftDuration;
    const subject=opts.subject!==undefined?opts.subject:($f('#focusSubject')?.value||'');
    const topic=opts.topic!==undefined?opts.topic:($f('#focusTopic')?.value||'');
    const pm=personalMedian(),target=R.focusQuestionTarget(duration,pm.median,pm.count),pool=buildFocusPool(subject,topic,Math.max(target*2,target+10));
    if(!pool.length)return toast('No hay preguntas disponibles para este Focus');
    const finalTarget=Math.min(target,Math.max(1,pool.length)),missionSubject=subject||displaySpecialty(pool[0]?.specialty)||'Prioridad adaptativa';
    F.pendingPlan={duration,subject,topic,target:finalTarget};ensureDom();
    $f('#focusMissionBody').innerHTML=`<div class="dialog-head"><div><span class="chip">Tu misión</span><h2 id="focusMissionTitle">${safeText(missionSubject)}</h2></div><button class="icon-btn" onclick="document.getElementById('focusMissionDialog').close()">×</button></div><div class="focus-mission-preview"><div><span>Preguntas objetivo</span><strong>${finalTarget}</strong></div><div><span>Objetivo</span><strong>superar 70%</strong></div><div><span>Duración estimada</span><strong>${duration?`${duration} min`:'Sin temporizador'}</strong></div></div><p class="muted">NexMIR priorizará revisiones vencidas, errores, dominio bajo y después preguntas nuevas. Las preguntas inválidas o saltadas no cuentan para racha, XP ni dominio.</p><div class="dialog-actions"><button class="btn" onclick="document.getElementById('focusMissionDialog').close()">Cambiar</button><button class="btn primary" onclick="confirmNexmirFocus()">Comenzar Focus</button></div>`;
    $f('#focusMissionDialog').showModal();
  }
  window.previewNexmirFocus=previewNexmirFocus;
  window.confirmNexmirFocus=()=>{const p=F.pendingPlan||{};$f('#focusMissionDialog')?.close();return startNexmirFocus(p)};

  async function startNexmirFocus(opts={}){
    if(!F.ready)return toast('Primero ejecuta NEXMIR_FOCUS_V1.sql en Supabase');
    const duration=opts.duration!==undefined?opts.duration:F.draftDuration;
    const subject=opts.subject!==undefined?opts.subject:($f('#focusSubject')?.value||'');
    const topic=opts.topic!==undefined?opts.topic:($f('#focusTopic')?.value||'');
    const pm=personalMedian(),target=R.focusQuestionTarget(duration,pm.median,pm.count),pool=buildFocusPool(subject,topic,Math.max(target*2,target+10));
    if(!pool.length)return toast('No hay preguntas disponibles para este Focus');
    const finalTarget=Math.min(target,Math.max(1,pool.length));const client=F.startClientId||uuid();F.startClientId=client;const initial=masteryForFilter(subject,topic);
    const sessionState={poolKeys:pool.map(qKey),index:0,subject,topic,duration:duration||null,questionTarget:finalTarget,initialMastery:initial};
    const {data,error}=await state.sb.rpc('nexmir_start_focus',{p_client_session_id:client,p_duration_minutes:duration||null,p_question_target:finalTarget,p_subject:subject||null,p_topic:topic||null,p_initial_state:sessionState});
    if(error)return toast('No se pudo iniciar Focus: '+error.message);
    F.startClientId=null;state.focusActiveSession=data;activateSession(data,pool,sessionState);openFocusDialog();
  }
  window.startNexmirFocus=startNexmirFocus;

  function activateSession(session,pool,ss={}){
    F.session=session;F.pool=pool;F.index=Math.max(0,Math.min(Number(ss.index||0),Math.max(0,pool.length-1)));F.selected=null;F.result=null;F.processing=false;F.answerEventId=null;F.eliminations=ss.eliminations||{};F.highlights=ss.highlights||{};
    F.activeSeconds=Number(session.active_seconds||0);F.questionActiveSeconds=0;F.skipped=Number(session.skipped_count||0);F.lastInteraction=now();F.lastHeartbeat=F.activeSeconds;
    F.reachedTime=!!(session.duration_target_minutes&&F.activeSeconds>=session.duration_target_minutes*60);F.subject=session.subject_filter||ss.subject||'';F.topic=session.topic_filter||ss.topic||'';
    F.initialMastery=Number(ss.initialMastery??masteryForFilter(F.subject,F.topic));F.clientSessionId=session.client_session_id;
  }

  async function resumeNexmirFocus(){
    if(!state.focusActiveSession){await loadFocusData();if(!state.focusActiveSession)return toast('No hay una sesión Focus pendiente')}
    const s=state.focusActiveSession,checkpoint=readCheckpoint(s.id),ss=checkpoint?.state||s.session_state||{},map=new Map(questionPool().map(q=>[qKey(q),q]));let pool=(ss.poolKeys||[]).map(raw=>{const retry=String(raw).startsWith('retry|'),k=retry?String(raw).slice(6):String(raw),q=map.get(k);return q?(retry?{...q,_focusRetry:true}:q):null}).filter(Boolean);
    if(!pool.length)pool=buildFocusPool(s.subject_filter||'',s.topic_filter||'',Math.max(s.question_target*2,s.question_target+10));
    activateSession(s,pool,ss);if(checkpoint){F.activeSeconds=Math.max(F.activeSeconds,checkpoint.activeSeconds||0);F.questionActiveSeconds=checkpoint.questionActiveSeconds||0;F.skipped=Math.max(F.skipped,checkpoint.skipped||0);if(checkpoint.questionKey===qKey(currentQ())){F.selected=checkpoint.selected;F.answerEventId=checkpoint.answerEventId;F.result=checkpoint.result||null}F.reachedTime=!!(F.session.duration_target_minutes&&F.activeSeconds>=F.session.duration_target_minutes*60)}openFocusDialog();
  }
  window.resumeNexmirFocus=resumeNexmirFocus;

  function openFocusDialog(){ensureDom();document.body.classList.add('nexmir-focus-active');const d=$f('#focusSessionDialog');if(!d.open)d.showModal();renderFocusQuestion();startTicker()}
  function sessionState(){return{poolKeys:F.pool.map(q=>(q._focusRetry?'retry|':'')+qKey(q)),index:F.index,subject:F.subject,topic:F.topic,duration:F.session?.duration_target_minutes||null,questionTarget:F.session?.question_target||10,initialMastery:F.initialMastery,eliminations:F.eliminations,highlights:F.highlights}}
  const checkpointKey=()=>`nexmir_focus_checkpoint:${state.user?.id}`;
  function readCheckpoint(id){try{const c=JSON.parse(localStorage.getItem(checkpointKey())||'null');return c?.sessionId===id?c:null}catch{return null}}
  function saveCheckpoint(){if(F.session?.status!=='active')return;try{localStorage.setItem(checkpointKey(),JSON.stringify({sessionId:F.session.id,state:sessionState(),questionKey:qKey(currentQ()),selected:F.selected,answerEventId:F.answerEventId,result:F.result,activeSeconds:F.activeSeconds,questionActiveSeconds:F.questionActiveSeconds,skipped:F.skipped}))}catch{}}
  // Timeout keeps a stalled network request recoverable; the event ID survives retries/reloads.
  async function focusRpc(name,args){const controller=new AbortController();let timer;try{const request=state.sb.rpc(name,args);return await Promise.race([Promise.resolve(typeof request.abortSignal==='function'?request.abortSignal(controller.signal):request),new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve({error:{message:'La conexión está tardando. Reintenta; tu respuesta se conserva.'}})},15000)})])}catch(error){return {error}}finally{clearTimeout(timer)}}
  let heartbeatPending=null;
  async function heartbeat(force=false){
    saveCheckpoint();if(!F.session||F.session.status!=='active')return;if(heartbeatPending){await heartbeatPending;if(force)return heartbeat(true);return}if(F.processing&&!force)return;if(!force&&F.activeSeconds-F.lastHeartbeat<30)return;F.lastHeartbeat=F.activeSeconds;
    const id=F.session.id,revision=F.session.total_answered||0;
    heartbeatPending=(async()=>{const {data,error}=await focusRpc('nexmir_focus_heartbeat',{p_session_id:id,p_active_seconds:Math.floor(F.activeSeconds),p_skipped_count:F.skipped,p_session_state:sessionState()});
    if(!error&&data&&F.session?.id===id&&F.session.status==='active'){const counters=['total_answered','valid_questions','correct_count','incorrect_count','xp_earned','recovered_errors'];const local=Object.fromEntries(counters.map(k=>[k,F.session[k]]));F.session={...F.session,...data};if((local.total_answered||0)>revision)Object.assign(F.session,local);state.focusActiveSession=F.session}})();
    try{await heartbeatPending}finally{heartbeatPending=null}
  }

  function startTicker(){if(F.tick)return;F.tick=setInterval(()=>{
    if(F.session?.status==='active'&&$f('#focusSessionDialog')?.open&&visibleActive()&&!F.processing&&!$f('#paceWarningDialog')?.open){
      F.questionActiveSeconds++;
      if(!F.session.duration_target_minutes||F.activeSeconds<F.session.duration_target_minutes*60)F.activeSeconds++;
      if(F.session.duration_target_minutes&&F.activeSeconds>=F.session.duration_target_minutes*60)F.reachedTime=true;
      updateFocusClock();heartbeat(false);
    }
    tickBankTiming();
  },1000)}
  function updateFocusClock(){
    const e=$f('#focusClock');if(e)e.textContent=fmtSec(F.activeSeconds);
    const bar=$f('#focusTimeBar');if(bar&&F.session?.duration_target_minutes)bar.style.width=`${Math.min(100,F.activeSeconds/(F.session.duration_target_minutes*60)*100)}%`;
    const done=$f('#focusTimeDone');if(done)done.classList.toggle('hidden',!F.reachedTime);
  }

  function currentQ(){return F.pool[F.index]||null}
  function requiredNow(){return R.requiredValidQuestions(F.session?.question_target||10,F.activeSeconds)}
  function focusProgress(){const target=F.session?.question_target||10,valid=F.session?.valid_questions||0;return Math.min(100,valid/target*100)}
  let focusSelection=null;
  window.focusCaptureHighlight=function(){const root=$f('#focusStem'),sel=window.getSelection();if(root&&sel?.rangeCount&&!sel.isCollapsed&&root.contains(sel.getRangeAt(0).commonAncestorContainer))focusSelection=sel.getRangeAt(0).cloneRange()};
  window.focusHighlight=function(clear=false){const root=$f('#focusStem'),key=qKey(currentQ());if(!root)return;
    if(clear){root.querySelectorAll('mark.user-highlight').forEach(mark=>mark.replaceWith(...mark.childNodes));root.normalize()}
    else{const sel=window.getSelection(),range=sel?.rangeCount&&!sel.isCollapsed&&root.contains(sel.getRangeAt(0).commonAncestorContainer)?sel.getRangeAt(0).cloneRange():focusSelection;
      if(!range||!root.contains(range.commonAncestorContainer))return toast('Selecciona primero una parte del enunciado');
      const mark=document.createElement('mark');mark.className='user-highlight';try{range.surroundContents(mark)}catch{try{mark.appendChild(range.extractContents());range.insertNode(mark)}catch{return toast('Selecciona un fragmento más corto')}}sel?.removeAllRanges()}
    F.highlights[key]=root.innerHTML;focusSelection=null;saveCheckpoint();
  };
  window.focusToggleDiscard=function(i){const q=currentQ();if(!q||F.result||F.processing||F.answerEventId)return;const key=qKey(q),set=new Set(F.eliminations[key]||[]);
    if(set.has(i))set.delete(i);else{set.add(i);if(F.selected===i)F.selected=null}
    F.eliminations[key]=[...set];F.lastInteraction=now();saveCheckpoint();renderFocusQuestion();
  };
  function renderFocusQuestion(){
    const q=currentQ();if(!q)return completeFocus();const opts=q.options||[],showTimer=state.focusPreferences?.show_timer!==false,showProgress=state.focusPreferences?.show_progress!==false;
    const valid=F.session?.valid_questions||0,target=F.session?.question_target||10;
    const result=F.result,discarded=new Set(F.eliminations[qKey(q)]||[]);
    saveCheckpoint();const body=$f('#focusSessionBody'),sameQuestion=body.dataset.question===qKey(q),scrollTop=sameQuestion?($f('.focus-question-area')?.scrollTop||0):0;body.dataset.question=qKey(q);
    $f('#focusSessionBody').innerHTML=`<div class="focus-session-shell">
      <header class="focus-session-top"><div class="focus-session-heading"><span class="chip">NexMIR Focus</span><h2 id="focusSessionTitle">${safeText(F.subject||'Sesión adaptativa')}</h2><div class="path">${safeText([q.specialty,q.topic,q.subtopic].filter(Boolean).join(' › '))}</div></div><button class="btn mini ghost focus-finish-btn" type="button" onclick="finishFocusEarly()">Terminar</button><div class="focus-session-meta">${showTimer?`<strong id="focusClock">${fmtSec(F.activeSeconds)}</strong>`:''}<span>${valid}/${target} válidas</span></div></header>
      ${showProgress?`<div class="focus-progress"><div class="progress-track"><div class="progress-fill" style="width:${focusProgress()}%"></div></div>${F.session?.duration_target_minutes?`<div class="focus-time-track"><i id="focusTimeBar" style="width:${Math.min(100,F.activeSeconds/(F.session.duration_target_minutes*60)*100)}%"></i></div>`:''}</div>`:''}
      <main class="focus-question-area"><div class="focus-counter">Pregunta ${Math.min(F.index+1,F.pool.length)} · ${safeText(reviewBadge(q))}${state.profile?.role==='admin'?`<button type="button" class="btn mini danger admin-delete-question" data-question-key="${safeText(qKey(q))}" onclick="deleteQuestionAsAdmin('${safeText(qKey(q))}')" ${F.processing?'disabled':''}>Eliminar pregunta</button>`:''}</div><div class="highlight-toolbar"><span>Enunciado</span><button class="btn mini" type="button" onmousedown="event.preventDefault()" onclick="focusHighlight()">🖍 Resaltar</button><button class="btn mini" type="button" onclick="focusHighlight(true)">Quitar resaltado</button></div><div id="focusStem" class="focus-stem question-stem highlightable" onmouseup="focusCaptureHighlight()" onkeyup="focusCaptureHighlight()">${F.highlights[qKey(q)]||mdInline(q.stem||q.question||'')}</div>${typeof questionImageHtml==='function'?questionImageHtml(q):''}
      <div class="focus-options" role="radiogroup" aria-label="Alternativas">${opts.map((o,i)=>`<div class="focus-option-row ${discarded.has(i)?'eliminated':''}"><button class="focus-option ${F.selected===i?'selected':''} ${result&&i===+q.correct_index?'correct':''} ${result&&F.selected===i&&i!==+q.correct_index?'wrong':''}" role="radio" aria-checked="${F.selected===i?'true':'false'}" ${result||F.processing||F.answerEventId||discarded.has(i)?'disabled':''} onclick="focusSelectOption(${i})"><span>${String.fromCharCode(65+i)}<small>${i+1}</small></span><b>${optionHtml(typeof o==='string'?o:o.text||'')}</b></button><button type="button" class="focus-discard-btn" ${result||F.processing||F.answerEventId?'disabled':''} aria-label="${discarded.has(i)?'Recuperar':'Descartar'} alternativa ${String.fromCharCode(65+i)}" aria-pressed="${discarded.has(i)}" onclick="focusToggleDiscard(${i})">${discarded.has(i)?'↶ Recuperar':'× Descartar'}</button></div>`).join('')}</div>
      ${result?focusFeedbackHtml(q,result):''}<div id="focusTimeDone" class="focus-target-note ${F.reachedTime?'':'hidden'}">✓ Objetivo de tiempo alcanzado. Completa las preguntas mínimas para cerrar una sesión válida.</div></main>
      <footer class="focus-session-actions">${result?`<button class="btn primary" onclick="nextFocusQuestion()">${shouldFinishAfterCurrent()?'Finalizar Focus':'Siguiente pregunta →'}</button>`:`<button class="btn" onclick="skipFocusQuestion()">Saltar</button><button class="btn primary" ${Number.isInteger(F.selected)&&!F.processing?'':'disabled'} onclick="submitFocusAnswer()">${F.processing?'Guardando…':'Responder'}</button>`}</footer>
    </div>`;
    $f('.focus-question-area').scrollTop=scrollTop;
    updateFocusClock();
  }
  function reviewBadge(q){const l=learningFor(q);if(!l)return'Nueva';if(l.last_result===false)return'Error a recuperar';if(l.next_review_at&&new Date(l.next_review_at)<=new Date())return'Revisión vencida';return`Dominio ${effectiveFor(q)}%`}
  window.nexmirRemoveFocusQuestion=function(key){
    const old=F.pool.length;F.pool=F.pool.filter(q=>qKey(q)!==key);
    if(old===F.pool.length)return;
    F.index=Math.min(F.index,F.pool.length-1);F.selected=null;F.result=null;F.answerEventId=null;F.questionActiveSeconds=0;
    if(!F.pool.length){if($f('#focusSessionDialog')?.open)completeFocus();return}
    saveCheckpoint();if($f('#focusSessionDialog')?.open)renderFocusQuestion();
  };
  function focusFeedbackHtml(q,r){
    if(r.attempt?.is_valid===false)return `<div class="focus-feedback warning"><strong>No contabilizada</strong><p>${r.attempt.invalid_reason==='pace'?'Esta respuesta fue demasiado rápida dentro de un patrón persistente. Puedes seguir estudiando normalmente.':'Esta repetición no cuenta como actividad válida ni genera XP.'}</p></div>`;
    const ok=!!r.attempt?.is_correct,xp=Number(r.attempt?.xp_awarded||0),recovered=!!r.attempt?.error_recovered,mastery=r.attempt?.mastery_after;
    return `<div class="focus-feedback ${ok?'success':'error'}"><div class="row"><strong>${ok?'Correcta':'Incorrecta'}</strong><span>${xp?`+${xp} XP`:''}</span></div>${recovered?'<div class="focus-recovered">🎯 Error recuperado</div>':''}<p>${q.explanation?mdInline(q.explanation):'Esta pregunta no tiene explicación registrada.'}</p>${mastery!==null&&mastery!==undefined?`<small>Dominio de esta pregunta: ${mastery}% · ${R.masteryLabel(mastery)}</small>`:''}</div>`;
  }

  window.focusSelectOption=i=>{
    if(F.result||F.processing||F.answerEventId||!Number.isInteger(i)||i<0||i>=(currentQ()?.options||[]).length||(F.eliminations[qKey(currentQ())]||[]).includes(i))return;
    F.selected=i;F.lastInteraction=now();
    saveCheckpoint();
    $$f('.focus-option').forEach((button,index)=>{button.classList.toggle('selected',index===i);button.setAttribute('aria-checked',String(index===i))});
    const submit=$f('.focus-session-actions .btn.primary');if(submit)submit.disabled=false;
  };
  async function submitFocusAnswer(){
    const q=currentQ();if(!q||F.result||!Number.isInteger(F.selected)||F.processing)return;F.processing=true;F.lastInteraction=now();renderFocusQuestion();
    const eventId=F.answerEventId||uuid();F.answerEventId=eventId;saveCheckpoint();const ctx=reviewContext(q);
    const slow=setTimeout(()=>{const button=$f('.focus-session-actions .btn.primary');if(F.processing&&button)button.textContent='Esperando conexión…'},3000);
    if(heartbeatPending)await heartbeatPending;
    const {data,error}=await focusRpc('nexmir_submit_answer',{p_source_type:q._source||'questions',p_source_id:q.id,p_selected_index:F.selected,p_mode:'focus',p_active_seconds:Math.max(0,Math.round(F.questionActiveSeconds)),p_focus_session_id:F.session.id,p_client_event_id:eventId,p_review_context:ctx});clearTimeout(slow);
    F.processing=false;
    if(error){toast('No se pudo guardar la respuesta: '+error.message);renderFocusQuestion();return}
    F.answerEventId=null;const a=data?.attempt,l=data?.learning,alreadyRecorded=a&&(state.attempts||[]).some(x=>x.client_event_id===a.client_event_id);if(a)state.attempts=[a,...(state.attempts||[]).filter(x=>x.client_event_id!==a.client_event_id)];if(l)replaceLearning(l);
    if(data?.streak)state.studyStreak={...(state.studyStreak||{}),...data.streak};
    if(a&&!alreadyRecorded){F.session.total_answered=(F.session.total_answered||0)+1;if(a.is_valid){F.session.valid_questions=(F.session.valid_questions||0)+1;if(a.is_correct)F.session.correct_count=(F.session.correct_count||0)+1;else F.session.incorrect_count=(F.session.incorrect_count||0)+1;F.session.xp_earned=(F.session.xp_earned||0)+(a.xp_awarded||0);if(a.error_recovered)F.session.recovered_errors=(F.session.recovered_errors||0)+1}}
    F.result=data;F.questionActiveSeconds=0;
    if(a?.is_valid&&!a.is_correct)scheduleErrorRetry(q);if(a?.is_valid)playRewardSound(!!a.is_correct,!!a.error_recovered);
    renderFocusQuestion();
    if(a?.pace_warning_triggered)showPaceWarning(false);else if(a?.is_valid===false&&a.invalid_reason==='pace')showPaceWarning(true);
    saveCheckpoint();heartbeat(false);syncMissionsSoon();
  }
  window.submitFocusAnswer=submitFocusAnswer;

  function replaceLearning(row){const k=`${row.source_type}:${row.source_id}`,arr=state.focusLearning||[],i=arr.findIndex(x=>`${x.source_type}:${x.source_id}`===k);state.focusLearning=i>=0?arr.map((x,n)=>n===i?row:x):[row,...arr]}
  function scheduleErrorRetry(q){const k=qKey(q),occ=F.pool.filter(x=>qKey(x)===k).length;if(occ>=2)return;const shift=5+Math.floor(Math.random()*6),remaining=Math.max(0,Number(F.session?.question_target||10)-Number(F.session?.valid_questions||0)),distance=remaining>0?Math.min(shift,remaining):1,at=Math.min(F.pool.length,F.index+1+distance);F.pool.splice(at,0,{...q,_focusRetry:true})}
  function shouldFinishAfterCurrent(){if(!F.session)return false;const pendingRetry=F.pool.slice(F.index+1).some(q=>q._focusRetry===true);if(pendingRetry)return false;const valid=F.session.valid_questions||0;if(F.session.duration_target_minutes)return F.reachedTime&&valid>=requiredNow();return valid>=F.session.question_target}
  async function nextFocusQuestion(){if(!F.result)return;if(shouldFinishAfterCurrent())return completeFocus();F.index++;F.selected=null;F.result=null;F.answerEventId=null;F.questionActiveSeconds=0;F.lastInteraction=now();if(F.index>=F.pool.length)return completeFocus();renderFocusQuestion();heartbeat(false)}
  window.nextFocusQuestion=nextFocusQuestion;
  async function skipFocusQuestion(){if(F.processing)return;F.skipped++;F.session.skipped_count=F.skipped;F.index++;F.selected=null;F.result=null;F.answerEventId=null;F.questionActiveSeconds=0;F.lastInteraction=now();if(F.index>=F.pool.length)return completeFocus();renderFocusQuestion();heartbeat(false)}
  window.skipFocusQuestion=skipFocusQuestion;

  async function completeFocus(){
    if(!F.session||F.processing)return;F.processing=true;await heartbeat(true);
    const finalState=sessionState();const before=F.initialMastery;
    const {data,error}=await focusRpc('nexmir_complete_focus',{p_session_id:F.session.id,p_active_seconds:Math.floor(F.activeSeconds),p_skipped_count:F.skipped,p_session_state:finalState});
    F.processing=false;if(error){toast('No se pudo cerrar Focus: '+error.message);return}
    const s=data?.session||{...F.session,status:'completed'};F.session=s;state.focusActiveSession=null;try{localStorage.removeItem(checkpointKey())}catch{}if(data?.streak)state.studyStreak={...(state.studyStreak||{}),...data.streak};
    $f('#focusSessionDialog')?.close();document.body.classList.remove('nexmir-focus-active');const after=masteryForFilter(F.subject,F.topic);
    showFocusSummary(s,before,after,data?.valid_for_xp!==false);await loadFocusData();if(state.view==='focus')renderFocusHome();
  }
  window.completeFocus=completeFocus;
  async function finishFocusEarly(){if(!F.session)return;if(!confirm('¿Terminar esta sesión Focus ahora? Se guardará tu progreso real.'))return;return completeFocus()}
  window.finishFocusEarly=finishFocusEarly;

  function showFocusSummary(s,before,after,validXp){ensureDom();const d=$f('#focusSummaryDialog');$f('#focusSummaryBody').innerHTML=`<div class="focus-summary"><span class="chip">Focus completado</span><h2 id="focusSummaryTitle">🎯 Sesión guardada</h2><div class="grid cols-3"><div class="card"><div class="metric">${fmtSec(s.active_seconds||0)}</div><div class="metric-label">Tiempo activo</div></div><div class="card"><div class="metric">${s.valid_questions||0}</div><div class="metric-label">Preguntas válidas</div></div><div class="card"><div class="metric">+${s.xp_earned||0}</div><div class="metric-label">XP de la sesión</div></div></div><div class="focus-summary-lines"><p><strong>${s.correct_count||0}</strong> correctas · <strong>${s.incorrect_count||0}</strong> incorrectas · <strong>${s.recovered_errors||0}</strong> errores recuperados</p><p>${safeText(s.subject_filter||'Dominio global')}: <strong>${before}% → ${after}%</strong></p><p class="${s.valid_for_streak?'green':'muted'}">${s.valid_for_streak?'🔥 Esta sesión mantiene tu racha.':validXp?'Sesión válida para XP/progreso, pero no cumple el requisito de racha de ≥10 min.':'La sesión se guardó, pero no alcanzó la actividad mínima para XP/racha.'}</p></div><div class="dialog-actions"><button class="btn" onclick="closeFocusSummary()">Terminar</button><button class="btn primary" onclick="continueFocusTen()">Continuar 10 min</button></div></div>`;d.showModal()}
  window.closeFocusSummary=()=>{$f('#focusSummaryDialog')?.close()};
  window.continueFocusTen=()=>{const subject=F.subject,topic=F.topic;$f('#focusSummaryDialog')?.close();startNexmirFocus({duration:10,subject,topic})};


  function playRewardSound(correct,recovered){
    if(!state.focusPreferences?.reward_sounds||!correct)return;
    try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=recovered?740:620;g.gain.setValueAtTime(.035,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.12);o.start();o.stop(c.currentTime+.12);o.onended=()=>c.close()}catch{}
  }

  function showPaceWarning(persistent){ensureDom();const d=$f('#paceWarningDialog');$f('#paceWarningBody').innerHTML=persistent?`<div class="dialog-head"><div><span class="chip">Ritmo de estudio</span><h3 id="paceWarningTitle">⚠️ Ritmo de estudio demasiado rápido</h3></div></div><p>Algunas respuestas no se contabilizarán como actividad válida mientras continúen respondiéndose en muy pocos segundos.</p><p class="muted">Puedes seguir estudiando normalmente.</p><div class="dialog-actions"><button class="btn primary" onclick="closePaceWarning()">Seguir estudiando</button></div>`:`<div class="dialog-head"><div><span class="chip">Ritmo de estudio</span><h3 id="paceWarningTitle">⚠️ Vas bastante rápido</h3></div></div><p>Algunas respuestas se están registrando en muy pocos segundos.</p><p class="muted">Para que tus preguntas cuenten correctamente para tu progreso y racha, asegúrate de leer y responder cada una con calma.</p><div class="dialog-actions"><button class="btn primary" onclick="closePaceWarning()">Seguir estudiando</button></div>`;d.showModal()}
  window.closePaceWarning=()=>{$f('#paceWarningDialog')?.close();F.lastInteraction=now()};

  let missionTimer=null;
  function syncMissionsSoon(){clearTimeout(missionTimer);missionTimer=setTimeout(async()=>{if(F.processing)return syncMissionsSoon();const {data,error}=await focusRpc('nexmir_sync_daily_missions');if(!error)state.focusMissions=data||[]},5000)}

  function showFreezeNoticeIfNeeded(){
    const latest=(state.streakFreezes||[])[0];if(!latest)return;const yesterday=new Date(Date.now()-86400000),yd=new Date(yesterday.getTime()-yesterday.getTimezoneOffset()*60000).toISOString().slice(0,10);if(latest.protected_date!==yd)return;
    const k=`nexmir-freeze-notice-${latest.protected_date}`;if(localStorage.getItem(k))return;localStorage.setItem(k,'1');ensureDom();const left=state.studyStreak?.freezes_available??Math.max(0,3-(state.streakFreezes||[]).filter(x=>x.month_key===latest.month_key).length);
    $f('#freezeNoticeBody').innerHTML=`<div class="dialog-head"><div><span class="chip">Racha</span><h3 id="freezeNoticeTitle">❄️ Tu racha fue protegida</h3></div></div><p>Ayer no completaste tu objetivo diario. Se utilizó 1 congelador de racha.</p><p class="muted">Te quedan <strong>${left}/3</strong> este mes.</p><div class="dialog-actions"><button class="btn primary" onclick="document.getElementById('freezeNoticeDialog').close()">Entendido</button></div>`;$f('#freezeNoticeDialog').showModal();
  }

  async function saveFocusPreferences(){
    const row={user_id:state.user.id,timezone:state.focusPreferences?.timezone||timezone(),reduce_animations:!!$f('#prefReduceAnimations')?.checked,hide_ranking_during_study:!!$f('#prefHideRanking')?.checked,one_task_at_a_time:!!$f('#prefOneTask')?.checked,show_timer:!!$f('#prefShowTimer')?.checked,reward_sounds:!!$f('#prefRewardSounds')?.checked,auto_focus:!!$f('#prefAutoFocus')?.checked,show_progress:!!$f('#prefShowProgress')?.checked,split_large_goals:!!$f('#prefSplitGoals')?.checked,updated_at:new Date().toISOString()};
    const {data,error}=await state.sb.from('user_study_preferences').upsert(row,{onConflict:'user_id'}).select().single();if(error)return toast('No se guardaron las preferencias: '+error.message);state.focusPreferences=data;applyPreferences();toast('Preferencias de estudio guardadas')
  }
  window.saveFocusPreferences=saveFocusPreferences;
  function preferencesHtml(){const p=state.focusPreferences||{};const ck=(v,d=false)=>(v??d)?'checked':'';return `<div class="card focus-preferences-card"><div class="section-head"><div><span class="chip">NexMIR Focus</span><h3>Preferencias de estudio</h3></div></div><div class="focus-pref-grid"><label><input id="prefReduceAnimations" type="checkbox" ${ck(p.reduce_animations)}> Reducir animaciones</label><label><input id="prefHideRanking" type="checkbox" ${ck(p.hide_ranking_during_study,true)}> Ocultar ranking durante estudio</label><label><input id="prefOneTask" type="checkbox" ${ck(p.one_task_at_a_time,true)}> Mostrar una tarea a la vez</label><label><input id="prefShowTimer" type="checkbox" ${ck(p.show_timer,true)}> Mostrar temporizador</label><label><input id="prefRewardSounds" type="checkbox" ${ck(p.reward_sounds)}> Sonidos de recompensa</label><label><input id="prefAutoFocus" type="checkbox" ${ck(p.auto_focus)}> Modo Focus automático</label><label><input id="prefShowProgress" type="checkbox" ${ck(p.show_progress,true)}> Mostrar progreso</label><label><input id="prefSplitGoals" type="checkbox" ${ck(p.split_large_goals,true)}> Dividir objetivos grandes</label></div><button class="btn primary" onclick="saveFocusPreferences()">Guardar preferencias</button></div>`}

  function patchRendering(){
    try{viewNames.focus='NexMIR Focus'}catch{}
    const oldRender=window.render;window.render=function(v){if(v==='focus')return renderFocusHome();return oldRender(v)};
    const oldDashboard=window.renderDashboard;window.renderDashboard=function(){oldDashboard();const root=$f('#view-dashboard');if(!root||$f('#dashboardFocusCard'))return;const st=state.studyStreak||{};root.insertAdjacentHTML('afterbegin',`<div id="dashboardFocusCard" class="card dashboard-focus-card"><div><span class="chip">NexMIR Focus</span><h3>Tu siguiente bloque de estudio</h3><p class="muted">Prioriza revisiones vencidas, errores y temas con dominio bajo.</p></div><div class="dashboard-focus-streak"><strong>🔥 ${st.current_streak||0}</strong><span>❄️ ${st.freezes_available??3}/3</span></div><button class="btn primary" onclick="route('focus')">Empezar Focus</button></div>`)};
    const oldProfile=window.renderProfile;window.renderProfile=function(){oldProfile();const root=$f('#view-profile');if(root&&!$f('.focus-preferences-card'))root.insertAdjacentHTML('beforeend',preferencesHtml())};
    const oldOpenSpecialty=window.openSpecialty;window.openSpecialty=function(encoded){oldOpenSpecialty(encoded);const sp=decodeURIComponent(encoded),head=$f('#studyDialogBody .dialog-head');if(head&&!$f('#focusFromSubject'))head.insertAdjacentHTML('afterend',`<div class="focus-inline-launch"><span>🎯 Estudia esta asignatura con prioridad adaptativa</span><button id="focusFromSubject" class="btn primary mini" onclick="launchFocusSetup('${encodeURIComponent(sp)}','')">Iniciar Focus</button></div>`)};
    const oldOpenTopic=window.openTopic;window.openTopic=function(es,et){oldOpenTopic(es,et);const sp=decodeURIComponent(es),t=decodeURIComponent(et),head=$f('#studyDialogBody .dialog-head');if(head&&!$f('#focusFromTopic'))head.insertAdjacentHTML('afterend',`<div class="focus-inline-launch"><span>🎯 Focus en ${safeText(t)}</span><button id="focusFromTopic" class="btn primary mini" onclick="launchFocusSetup('${encodeURIComponent(sp)}','${encodeURIComponent(t)}')">Iniciar Focus</button></div>`)};
  }
  window.launchFocusSetup=async(es='',et='')=>{const sp=decodeURIComponent(es||''),t=decodeURIComponent(et||'');$f('#studyDialog')?.close();await route('focus');setTimeout(()=>{const s=$f('#focusSubject');if(s){s.value=sp;refreshFocusTopicOptions()}const top=$f('#focusTopic');if(top)top.value=t},0)};

  function tickBankTiming(){
    const d=$f('#questionDialog');if(!d?.open||document.hidden||!document.hasFocus()||(now()-F.bankLastInteraction)>=90000)return;
    const q=state.bank?.pool?.[state.bank?.index];if(!q)return;const k=qKey(q);F.bankLastKey=k;F.bankTimings[k]=(F.bankTimings[k]||0)+1;
  }
  function tickOtherQuestionTiming(){
    if(document.hidden||!document.hasFocus()||(now()-F.lastInteraction)>=90000)return;
    const sim=$f('#simDialog');if(sim?.open&&state.simulation?.active){const q=state.simulation.pool?.[state.simulation.index],k=qKey(q);if(q&&state.simulation.answers?.[typeof simQKey==='function'?simQKey(q):k]===undefined)F.simTimings[k]=(F.simTimings[k]||0)+1}
    const qd=$f('#questionDialog');if(qd?.open&&state.diagnostic?.active){const q=state.diagnostic.pool?.[state.diagnostic.index],k=qKey(q);if(q&&state.diagnostic.answers?.[k]===undefined)F.diagnosticTimings[k]=(F.diagnosticTimings[k]||0)+1}
  }
  function patchBankAttempts(){
    const oldShow=window.showQuestion,oldPersist=window.persistQuestionAttempt;window.showQuestion=function(){const q=state.bank?.pool?.[state.bank?.index],k=qKey(q);if(k&&F.bankLastKey!==k){F.bankLastKey=k;F.bankLastInteraction=now();F.bankTimings[k]??=0}return oldShow()};
    window.persistQuestionAttempt=async function(q,selectedIndex,_isCorrect,mode){
      if(!F.ready||window.NEXMIR_FOCUS_BACKEND_READY!==true)return oldPersist(q,selectedIndex,_isCorrect,mode);
      if(!q)return null;const k=qKey(q),event=F.bankEvents[k]||uuid();F.bankEvents[k]=event;
      const {data,error}=await focusRpc('nexmir_submit_answer',{p_source_type:q._source||'questions',p_source_id:q.id,p_selected_index:selectedIndex,p_mode:mode||'bank',p_active_seconds:bankActiveFor(q),p_focus_session_id:null,p_client_event_id:event,p_review_context:reviewContext(q)});
      if(error){console.error('attempt save',error);toast('No se pudo guardar el intento: '+error.message);return null}
      delete F.bankEvents[k];const a=data?.attempt,l=data?.learning;if(a)state.attempts=[a,...state.attempts.filter(x=>x.client_event_id!==a.client_event_id)];if(l)replaceLearning(l);if(data?.streak)state.studyStreak={...(state.studyStreak||{}),...data.streak};
      if(a?.pace_warning_triggered)showPaceWarning(false);else if(a?.is_valid===false&&a.invalid_reason==='pace')showPaceWarning(true);syncMissionsSoon();return a;
    };
  }

  function hookActivity(){
    ['pointerdown','scroll','touchstart'].forEach(ev=>document.addEventListener(ev,()=>{F.lastInteraction=now();F.bankLastInteraction=now()},{passive:true}));
    document.addEventListener('keydown',e=>{if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.target?.matches('input:not([type=radio]):not([type=checkbox]),textarea,select')||e.target?.isContentEditable||$f('#planLoadingDialog')?.open)return;F.lastInteraction=now();F.bankLastInteraction=now();if(!$f('#focusSessionDialog')?.open||$f('#paceWarningDialog')?.open)return;const q=currentQ();if(!q)return;const key=/^Digit[1-9]$|^Numpad[1-9]$/.test(e.code)?e.code.slice(-1):e.key;if(!F.result&&/^[1-9]$/.test(key)){const i=Number(key)-1;if(i<(q.options||[]).length){e.preventDefault();focusSelectOption(i)}}else if(!F.result&&key==='Enter'&&Number.isInteger(F.selected)){e.preventDefault();submitFocusAnswer()}else if(F.result&&key==='Enter'){e.preventDefault();nextFocusQuestion()}},true);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)heartbeat(true)});window.addEventListener('pagehide',()=>heartbeat(true));
  }

  function patchLoad(){const oldLoad=window.loadAll;window.loadAll=async function(){await oldLoad();requestFocusData()}}
  function patchTopButton(){const b=$f('#focusModeBtn');if(!b)return;b.textContent='🎯 Modo Focus';b.title='Inicia una sesión NexMIR Focus';b.onclick=e=>{e.preventDefault();route('focus')}}

  function init(){ensureDom();patchRendering();patchBankAttempts();patchTopButton();hookActivity();startTicker();const oldAdaptive=window.startAdaptiveBank;if(typeof oldAdaptive==='function')window.startAdaptiveBank=function(n){if(state.focusPreferences?.auto_focus)return startNexmirFocus({duration:15});return oldAdaptive(n)};if(state.user)requestFocusData()}
  patchLoad();setTimeout(init,0);
})();
