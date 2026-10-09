/* NEXMIR V5.1.19 · producto: planes, dashboard inteligente, adaptativo, calendario, batallas y gamificación */
(() => {
  const $v=s=>document.querySelector(s), $$v=s=>[...document.querySelectorAll(s)];
  const DAY=86400000;
  const planRules=window.NexmirPlanRules;
  if(!planRules)throw new Error('No se cargaron las reglas de planes NEXMIR');
  const MIR_DATE_DEFAULT='2027-01-23';
  state.studyPlan=null; state.battle=null; state.battleRooms=[]; state.battleHistory=[]; state.deviceBlocked=false; state.mySuggestions=[];
  viewNames.calendar='Plan de estudio';

  function planName(){return planRules.normalizePlan(state.profile?.plan)}
  function unlimited(){return planRules.hasUnlimitedAccess(state.profile)}
  function localDay(d=new Date()){return planRules.localDay(d)}
  function todayAttempts(mode){const t=localDay();return state.attempts.filter(a=>localDay(new Date(a.answered_at))===t&&(!mode||a.mode===mode))}
  function todayReviews(){const t=localDay();return state.reviews.filter(r=>r.last_reviewed_at&&localDay(new Date(r.last_reviewed_at))===t)}
  function todaySims(){const t=localDay();return state.simulations.filter(s=>s.finished_at&&localDay(new Date(s.finished_at))===t)}
  function todayMiniSims(){return todaySims().filter(s=>s.mode==='mini'&&Number(s.total||0)<=15)}
  function remaining(kind){return planRules.remaining(state.profile,kind,{attempts:state.attempts,reviews:state.reviews,simulations:state.simulations,battles:state.battleHistory})}
  function limitText(kind){const r=remaining(kind);return r===Infinity?'Ilimitado':`${r} restantes hoy`}

  function deviceId(){return window.NexmirSessions.deviceId()}
  function deviceLabel(){return window.NexmirSessions.deviceLabel()}
  async function replaceDevice(){toast('El dispositivo se activa automáticamente al iniciar sesión.')} 

  const oldLoadAll=loadAll;
  loadAll=async function(){
    const uid=state.user?.id;await oldLoadAll();if(!uid||state.user?.id!==uid)return;
    const [plan,history,suggestions]=await Promise.all([
      safeLoad('plan de estudio',async()=>{const {data,error}=await state.sb.from('study_plans').select('*').eq('user_id',uid).maybeSingle();if(error)throw error;return data},null),
      safeLoad('historial de batallas',async()=>{const {data,error}=await state.sb.from('battle_participants').select('*').eq('user_id',uid).order('joined_at',{ascending:false}).limit(100);if(error)throw error;return data}),
      safeLoad('sugerencias',async()=>{const {data,error}=await state.sb.from('feature_suggestions').select('id,category,title,detail,status,admin_note,created_at,updated_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(10);if(error)throw error;return data})
    ]);
    if(state.user?.id!==uid)return;
    state.studyPlan=plan;state.battleHistory=history||[];state.mySuggestions=suggestions||[];state.deviceBlocked=false;
    if(state.profile&&!state.profile.email&&state.user?.email){const email=state.user.email;try{const {error}=await state.sb.from('profiles').update({email}).eq('id',uid);if(!error&&state.user?.id===uid)state.profile.email=email}catch{}}
  };

  // Password recovery + email verification
  async function forgotPassword(){const email=$v('#loginEmail')?.value.trim();if(!email)return toast('Escribe primero tu correo');const redirect=location.protocol.startsWith('http')?location.origin+location.pathname:undefined;const {error}=await state.sb.auth.resetPasswordForEmail(email,redirect?{redirectTo:redirect}:undefined);if(error)return toast(error.message);toast('Te enviamos un correo para restablecer tu contraseña')}
  async function resendVerification(){const email=$v('#loginEmail')?.value.trim()||state.user?.email;if(!email)return;const {error}=await state.sb.auth.resend({type:'signup',email});if(error)return toast(error.message);toast('Correo de verificación reenviado')}
  async function saveNewPassword(){const p=$v('#newPassword').value;if(p.length<8)return toast('Usa al menos 8 caracteres');const {error}=await state.sb.auth.updateUser({password:p});if(error)return toast(error.message);$v('#resetPasswordDialog').close();toast('Contraseña actualizada')}
  $v('#forgotPasswordBtn')?.addEventListener('click',forgotPassword);$v('#resendVerifyBtn')?.addEventListener('click',resendVerification);$v('#saveNewPasswordBtn')?.addEventListener('click',saveNewPassword);$v('#deviceLogoutBtn')?.addEventListener('click',logout);$v('#deviceReplaceBtn')?.addEventListener('click',replaceDevice);
  state.sb?.auth?.onAuthStateChange?.((event)=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>$v('#resetPasswordDialog')?.showModal(),50)});

  window.nexmirResidentInfo=()=>({...levelInfo(),streak:currentStreak()});
  function qKey(q){return q?`${q._source||'questions'}:${q.id}`:''}
  function qAttempts(q){return state.attempts.filter(a=>a.is_valid!==false&&(q._source==='remnote'?a.source_content_id:a.question_id)===q.id)}
  function latestAttempt(q){return qAttempts(q).sort((a,b)=>new Date(b.answered_at)-new Date(a.answered_at))[0]||null}
  function weakMap(){const m=new Map();for(const a of state.attempts.filter(a=>a.is_valid!==false)){const q=getAttemptQuestion(a);if(!q)continue;const k=[q.specialty||'Sin clasificar',q.topic||'General'].join('||'),v=m.get(k)||{n:0,ok:0};v.n++;if(a.is_correct)v.ok++;m.set(k,v)}return m}
  function userTargetDifficulty(){const a=state.attempts.filter(x=>x.is_valid!==false).slice(0,150);const acc=a.length?a.filter(x=>x.is_correct).length/a.length:.55;return acc>.8?'hard':acc>.62?'medium':'easy'}
  function adaptiveScore(q){let s=Math.random()*1.5;const la=latestAttempt(q),all=qAttempts(q),k=[q.specialty||'Sin clasificar',q.topic||'General'].join('||'),w=weakMap().get(k);if(!all.length)s+=7;else{s+=Math.max(0,4-all.length*.35);if(la&&!la.is_correct)s+=9;const days=la?(Date.now()-new Date(la.answered_at).getTime())/DAY:999;if(days<7&&!la?.is_correct)s+=4;if(days<2&&la?.is_correct)s-=3}if(w&&w.n>=3){const acc=w.ok/w.n;s+=(1-acc)*8}if(state.bookmarks.some(b=>b.item_type==='question'&&b.item_id===q.id))s+=3;const target=userTargetDifficulty(),d=String(q.difficulty||'').toLowerCase();if(d&&((target==='hard'&&/hard|dif/i.test(d))||(target==='medium'&&/med|inter/i.test(d))||(target==='easy'&&/easy|fac/i.test(d))))s+=2;return s}
  function buildAdaptivePool(n=20){return questionPool().slice().sort((a,b)=>adaptiveScore(b)-adaptiveScore(a)).slice(0,Math.min(n,questionPool().length))}
  function startAdaptiveBank(n=20){let limit=remaining('bank');if(limit===0)return toast('Has alcanzado el límite diario del plan Free');if(limit!==Infinity)n=Math.min(n,limit);const pool=buildAdaptivePool(n);if(!pool.length)return toast('No hay preguntas disponibles');state.bank={pool,index:0,answered:false,selected:null,mode:'end',results:[],context:'adaptive',highlights:{},answers:{},submitted:false};showQuestion()}
  window.startAdaptiveBank=startAdaptiveBank;

  const oldStartBank=startBank;
  startBank=function(){if(unlimited())return oldStartBank();let rem=remaining('bank');if(rem<=0)return toast('Plan Free: ya usaste tus 15 preguntas de hoy');const input=$v('#bankCount');let asked=Math.max(0,Math.floor(Number(input?.value)||0));if(asked===0||asked>rem){if(input)input.value=rem;toast(`Plan Free: usarás como máximo ${rem} preguntas hoy`)}return oldStartBank()};
  const oldStartMirSimulation=startMirSimulation;
  startMirSimulation=function(n,config=null){if(unlimited())return oldStartMirSimulation(n,config);if(Number(n)===15&&(!config||!config.reserveCount)){if(remaining('miniSimulations')<=0)return toast('Plan Free: ya utilizaste tu Mini-MIR de 15 preguntas de hoy');return oldStartMirSimulation(15,config)}return toast('Plan Free: los simulacros completos son Pro. Puedes hacer 1 Mini-MIR de 15 preguntas al día')};
  const oldRateCard=rateCard;
  rateCard=async function(q){if(!unlimited()&&remaining('reviews')<=0){toast('Plan Free: ya completaste tus 20 flashcards de hoy');return}return oldRateCard(q)};

  // gamification derived from real activity
  function activeDates(){const ds=new Set();state.attempts.forEach(a=>a.answered_at&&ds.add(localDay(new Date(a.answered_at))));state.reviews.forEach(r=>r.last_reviewed_at&&ds.add(localDay(new Date(r.last_reviewed_at))));state.simulations.forEach(s=>s.finished_at&&ds.add(localDay(new Date(s.finished_at))));return ds}
  function currentStreak(){if(state.studyStreak&&Number.isFinite(Number(state.studyStreak.current_streak)))return Number(state.studyStreak.current_streak);const ds=activeDates();let n=0,d=new Date();for(;;){const k=localDay(d);if(ds.has(k)){n++;d=new Date(d.getTime()-DAY)}else{if(n===0&&k===localDay()){d=new Date(d.getTime()-DAY);continue}break}}return n}
  function xpTotal(){if(Array.isArray(state.xpEvents))return state.xpEvents.reduce((sum,e)=>sum+(Number(e.xp_amount)||0),0);const correct=state.attempts.filter(a=>a.is_correct).length,wrong=state.attempts.length-correct,revs=state.reviews.filter(r=>r.last_reviewed_at).length,sims=state.simulations.length;return correct*5+wrong*2+revs*3+sims*100}
  function levelInfo(){const xp=xpTotal();let level=Math.max(1,Math.floor(Math.sqrt(xp/100))+1);while(xp>=100*level*level)level++;while(level>1&&xp<100*(level-1)*(level-1))level--;const next=100*level*level,prev=100*(level-1)*(level-1),pct=Math.max(0,Math.min(100,(xp-prev)/(next-prev)*100));const rank=level>=16?'Especialista':level>=12?'R4':level>=9?'R3':level>=6?'R2':level>=3?'R1':'R0';return{xp,level,next,pct,rank}}
  function specialtyAchievements(){const m=new Map();for(const a of state.attempts.filter(a=>a.is_valid!==false)){const q=getAttemptQuestion(a);if(!q)continue;const sp=q.specialty||'Sin clasificar',v=m.get(sp)||{n:0,ok:0};v.n++;if(a.is_correct)v.ok++;m.set(sp,v)}return [...m].filter(([,v])=>v.n>=30&&v.ok/v.n>=.8).map(([sp,v])=>({sp,n:v.n,acc:Math.round(v.ok/v.n*100)}))}

  function smartWeakTopics(){const m=weakMap();return [...m.entries()].map(([k,v])=>{const [specialty,topic]=k.split('||');return{specialty,topic,n:v.n,acc:v.n?Math.round(v.ok/v.n*100):0}}).filter(x=>x.n>=3).sort((a,b)=>a.acc-b.acc||b.n-a.n)}
  function goalGap(){const sp=MIR_RESIDENCY_SPECIALTIES.find(x=>x.name===state.profile?.goal_specialty);const latest=state.simulations.find(s=>s.net_score!=null);if(!sp||!latest||!sp.avgNetas2025)return null;return{ref:sp.avgNetas2025,current:Number(latest.net_score),gap:sp.avgNetas2025-Number(latest.net_score)}}

  renderDashboard=function(){const due=dueCards().length,weak=smartWeakTopics().slice(0,3),lvl=levelInfo(),gap=goalGap(),rem=remaining('bank'),sims=state.simulations.length,last=state.simulations[0];const todayRec=due?`Empieza con ${Math.min(due,40)} flashcards pendientes`:weak[0]?`Refuerza ${weak[0].topic}`:'Haz un banqueo adaptativo';$v('#view-dashboard').innerHTML=`<div class="smart-hero"><div><span class="chip">Plan de hoy</span><h1>${esc(todayRec)}</h1><p>Combina active recall, preguntas adaptativas y tu objetivo MIR en una sola ruta.</p><div class="hero-actions"><button class="btn primary" onclick="${due?"route('reviews')":"startAdaptiveBank(20)"}">${due?'Empezar repasos':'20 preguntas adaptativas'}</button><button class="btn" onclick="route('calendar')">Ver plan semanal</button></div></div><div class="resident-card"><div class="resident-avatar">${lvl.rank}</div><div><strong>Nivel ${lvl.level}</strong><span>${lvl.xp} XP · racha ${currentStreak()} días</span></div><div class="progress-track"><div class="progress-fill" style="width:${lvl.pct}%"></div></div></div></div><div class="grid cols-4"><div class="card"><div class="metric">${due}</div><div class="metric-label">Repasos pendientes</div></div><div class="card"><div class="metric">${rem===Infinity?'∞':rem}</div><div class="metric-label">Preguntas disponibles hoy</div></div><div class="card"><div class="metric">${last?Number(last.net_score).toFixed(1):'—'}</div><div class="metric-label">Últimas netas</div></div><div class="card"><div class="metric">${currentStreak()}</div><div class="metric-label">Días de racha</div></div></div><div class="grid cols-2 dashboard-smart"><div class="card"><div class="section-head"><h3>Qué estudiar hoy</h3><span class="chip">Adaptativo</span></div>${weak.length?weak.map(w=>`<div class="weak-row"><div><strong>${esc(w.topic)}</strong><div class="path">${esc(w.specialty)} · ${w.acc}% · ${w.n} preguntas</div></div><button class="btn mini" onclick="studyRelated('${encodeURIComponent(w.specialty)}','${encodeURIComponent(w.topic)}')">Repasar</button></div>`).join(''):'<p class="muted">Aún no hay suficientes datos. NEXMIR empezará a detectar debilidades después de tus primeros banqueos.</p>'}<button class="btn primary" style="margin-top:12px" onclick="startAdaptiveBank(20)">Preguntas recomendadas</button></div><div class="card"><div class="section-head"><h3>Objetivo MIR</h3><button class="btn mini" onclick="route('goal')">Abrir</button></div><p><strong>${esc(state.profile?.goal_specialty||'Sin especialidad configurada')}</strong></p>${gap?`<div class="goal-gap ${gap.gap<=0?'good':''}"><span>${gap.gap<=0?'Referencia histórica alcanzada':'Diferencia orientativa'}</span><strong>${gap.gap<=0?'+': ''}${(-gap.gap).toFixed(1)} netas vs referencia</strong></div>`:'<p class="muted">Configura tu especialidad y completa simulacros para comparar tu evolución.</p>'}<div class="row" style="margin-top:12px"><span>Simulacros completados</span><strong>${sims}</strong></div></div></div><div class="card"><div class="section-head"><h3>Simulacro recomendado</h3><span class="chip">${new Date().getDay()===0?'Hoy':'Domingo'}</span></div><p class="muted">${new Date().getDay()===0?'Hoy es buen día para un simulacro completo o Mini-MIR.':'Tu plan prioriza un simulacro cada domingo para medir progreso.'}</p><button class="btn" onclick="route('simulations')">Ir a simulacros</button></div>`};

  const oldRenderBank=renderBank;
  renderBank=function(){oldRenderBank();const root=$v('#view-bank .hero-main');if(root){const box=document.createElement('div');box.className='adaptive-box';box.innerHTML=`<div><span class="chip">Motor adaptativo</span><strong>Prioriza nuevas, errores recientes y temas débiles</strong><small>Dificultad objetivo actual: ${userTargetDifficulty()==='hard'?'alta':userTargetDifficulty()==='medium'?'intermedia':'progresiva inicial'}</small></div><button class="btn violet-btn" onclick="startAdaptiveBank(20)">Banqueo adaptativo · 20</button>`;root.prepend(box)}};

  // Presentación de límites Free dentro de Simulacros.
  const oldRenderSimulationsV5=renderSimulations;
  renderSimulations=function(){
    oldRenderSimulationsV5();
    if(unlimited())return;
    const root=$v('#view-simulations');
    if(!root)return;
    root.querySelectorAll('button[onclick*="startMirSimulation(200)"],button[onclick*="startCustomSimulation("]').forEach(btn=>{btn.disabled=true;btn.title='Disponible en Pro';btn.textContent='PRO'});
    const note=root.querySelector('.mir-note');
    if(note)note.innerHTML='<strong>Plan Free:</strong> 1 Mini-MIR de 15 preguntas al día. Los simulacros personalizados y completos están disponibles en Pro.';
  };

  // Calendar / study plan
  function daysUntilMir(){const d=new Date((state.studyPlan?.mir_date||MIR_DATE_DEFAULT)+'T12:00:00');return Math.max(0,Math.ceil((d-Date.now())/DAY))}
  function weekStats(){const now=new Date(),day=(now.getDay()+6)%7,start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-day),ts=start.getTime();return{q:state.attempts.filter(a=>new Date(a.answered_at).getTime()>=ts).length,r:state.reviews.filter(x=>x.last_reviewed_at&&new Date(x.last_reviewed_at).getTime()>=ts).length,s:state.simulations.filter(x=>x.finished_at&&new Date(x.finished_at).getTime()>=ts).length}}
  renderCalendar=function(){
    const p=state.studyPlan||{},ws=weekStats(),mir=p.mir_date||MIR_DATE_DEFAULT,qg=p.weekly_question_goal??350,rg=p.weekly_review_goal??500;
    $v('#view-calendar').innerHTML=`<div class="section-head"><div><h2>Mi plan de estudio</h2><p class="muted">Una sola semana de estudio: primero ves qué especialidad y tema toca; después puedes consultar por qué se eligió.</p></div><span class="chip">${daysUntilMir()} días para el MIR</span></div>
    <div class="grid cols-3 plan-progress"><div class="card"><div class="metric">${ws.q}/${qg}</div><div class="metric-label">Preguntas respondidas esta semana</div><div class="progress-track"><div class="progress-fill" style="width:${qg?Math.min(100,100*ws.q/qg):0}%"></div></div></div><div class="card"><div class="metric">${ws.r}/${rg}</div><div class="metric-label">Flashcards repasadas esta semana</div><div class="progress-track"><div class="progress-fill" style="width:${rg?Math.min(100,100*ws.r/rg):0}%"></div></div></div><div class="card"><div class="metric">${ws.s}</div><div class="metric-label">Simulacros completados esta semana</div></div></div>
    <details class="card plan-settings"><summary>Mis objetivos semanales</summary><div class="grid cols-2"><label>Fecha MIR<input id="planMirDate" type="date" value="${esc(mir)}"></label><label>Objetivo de preguntas<input id="planQGoal" type="number" min="0" value="${qg}"></label><label>Objetivo de flashcards<input id="planRGoal" type="number" min="0" value="${rg}"></label></div><button class="btn primary" onclick="saveStudyPlan()">Guardar objetivos</button><p class="muted small">Los objetivos miden tu avance; los bloques del calendario indican qué estudiar. Las tarjetas vencidas siguen apareciendo en Repasos.</p></details>`;
  };
  async function saveStudyPlan(){const row={user_id:state.user.id,mir_date:$v('#planMirDate').value||MIR_DATE_DEFAULT,weekly_question_goal:+$v('#planQGoal').value||0,weekly_review_goal:+$v('#planRGoal').value||0,sunday_simulation:state.studyPlan?.sunday_simulation!==false,updated_at:new Date().toISOString()};const {data,error}=await state.sb.from('study_plans').upsert(row,{onConflict:'user_id'}).select().single();if(error)return toast(error.message);state.studyPlan=data;toast('Plan guardado');renderCalendar()}
  window.saveStudyPlan=saveStudyPlan;

  // Goal: augment historical comparison
  const oldGoalDataHtml=goalDataHtml;
  goalDataHtml=function(){const base=oldGoalDataHtml();const sp=MIR_RESIDENCY_SPECIALTIES.find(x=>x.name===($v('#goalSpecialty')?.value||state.profile?.goal_specialty)),latest=state.simulations.find(x=>x.net_score!=null),target=+$v('#goalNumber')?.value||state.profile?.target_number||null;if(!sp)return base;const rows=[];if(sp.close2026)rows.push(`<div class="row"><span>Último nº de orden 2026 (especialidad)</span><strong>${sp.close2026.toLocaleString('es-ES')}</strong></div>`);if(target&&sp.close2026)rows.push(`<div class="row"><span>Tu nº objetivo vs cierre 2026</span><strong class="${target<=sp.close2026?'green':'red'}">${target<=sp.close2026?'Dentro del rango histórico':'Por encima del cierre histórico'}</strong></div>`);if(latest&&sp.avgNetas2025){const gap=sp.avgNetas2025-Number(latest.net_score);rows.push(`<div class="row"><span>Qué te falta (orientativo)</span><strong class="${gap<=0?'green':''}">${gap<=0?'Referencia de netas superada':gap.toFixed(1)+' netas hasta la media histórica'}</strong></div>`)}return base+`<div class="card"><h3>Histórico y comparación</h3>${rows.join('')||'<p class="muted">No hay histórico local suficiente para esta especialidad.</p>'}<p class="muted small">Los históricos orientan; no predicen el número de orden de 2027 ni garantizan un hospital.</p></div>`};

  // Batallas 1 vs 1: salas en Supabase, enlace de invitación y ranking validado por backend.
  function requestedBattleCode(){return planRules.sanitizeBattleCode(new URLSearchParams(location.search).get('battle'))}
  function battleCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
  function battleQuestionKey(q){return `${q?._source||'questions'}:${q?.id||''}`}
  function battleInviteUrl(code){return planRules.battleInviteUrl(location.href,code)}
  function battleSpecialty(q){return RemnoteTaxonomy.canonical(q?.specialty||'')}
  function battleSpecialtyCounts(){
    const counts=new Map();
    for(const q of questionPool().filter(NexmirContentRules.validTest)){
      const name=battleSpecialty(q);if(!RemnoteTaxonomy.unclassified(name))counts.set(name,(counts.get(name)||0)+1);
    }
    return [...counts].sort((a,b)=>a[0].localeCompare(b[0],'es'));
  }
  function battleTopicLabel(pool){
    const names=[...new Set(pool.map(battleSpecialty))].filter(n=>!RemnoteTaxonomy.unclassified(n));
    return names.length===1?names[0]:names.length>1?'Mix de '+names.length+' especialidades':'Mix general';
  }
  function battlePick(pool,count){
    const buckets=new Map();
    for(const q of pool){const name=battleSpecialty(q),items=buckets.get(name)||[];items.push(q);buckets.set(name,items)}
    const shuffle=items=>{for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]]}return items};
    for(const bucket of buckets.values())shuffle(bucket);
    const groups=shuffle([...buckets.values()]),result=[];
    while(result.length<count&&groups.length){
      for(let i=groups.length-1;i>=0&&result.length<count;i--){
        result.push(groups[i].pop());if(!groups[i].length)groups.splice(i,1);
      }
      shuffle(groups);
    }
    return shuffle(result);
  }
  window.toggleBattleSpecialties=()=>{const selected=$v('input[name="battleScope"]:checked')?.value==='selected',list=$v('#battleSpecialtyList');if(list)list.hidden=!selected};
  function battleScopeHtml(){
    const available=battleSpecialtyCounts();
    const choices=available.map(([name,n],i)=>'<label class="battle-specialty-choice"><input type="checkbox" name="battleSpecialty" value="'+esc(name)+'"><span>'+esc(name)+'</span><small>'+n+' preguntas</small></label>').join('');
    return '<fieldset class="battle-scope"><legend>Especialidades de la batalla</legend><div class="battle-scope-modes"><label><input type="radio" name="battleScope" value="mix" checked onchange="toggleBattleSpecialties()"> Mix de todas</label><label><input type="radio" name="battleScope" value="selected" onchange="toggleBattleSpecialties()"> Elegir una o varias</label></div><div id="battleSpecialtyList" class="battle-specialty-list" hidden>'+choices+'</div><p class="muted small">Las preguntas se reparten entre las especialidades elegidas. Ambas personas reciben exactamente el mismo bloque.</p></fieldset>';
  }
  async function shareBattle(code){
    const url=battleInviteUrl(code),share={title:'Batalla NEXMIR',text:`Te invito a una batalla NEXMIR. Crea tu cuenta o inicia sesión y entra con el código ${code}.`,url};
    if(navigator.share){try{await navigator.share(share);return}catch(error){if(error?.name==='AbortError')return}}
    try{await navigator.clipboard.writeText(url);toast('Enlace de invitación copiado')}catch{prompt('Copia este enlace de invitación:',url)}
  }
  async function createBattle(rematch=false){
    if(!unlimited()&&remaining('battles')<=0)return toast('Plan Free: límite diario de batallas alcanzado');
    const previous=rematch?state.battle?.room:null,previousSelection=rematch?state.battle?.selection:null;
    const count=Math.max(5,Math.min(50,rematch?(previous?.question_ids?.length||10):(+ $v('#battleCount')?.value||10))),minutes=Math.max(3,Math.min(60,rematch?Math.ceil((previous?.duration_seconds||600)/60):(+ $v('#battleMinutes')?.value||10)));
    const scope=rematch?(previousSelection?.scope||'mix'):($v('input[name="battleScope"]:checked')?.value||'mix');
    const specialties=scope==='selected'?(rematch?previousSelection?.specialties||[]:$$v('#battleSpecialtyList input:checked').map(x=>x.value)):[];
    if(scope==='selected'&&!specialties.length)return toast('Selecciona al menos una especialidad o elige Mix de todas');
    const allowed=new Set(specialties);
    const available=questionPool().filter(NexmirContentRules.validTest).filter(q=>scope==='mix'||allowed.has(battleSpecialty(q)));
    if(available.length<5)return toast('Se necesitan al menos 5 preguntas test publicadas para esta selección. Elige más especialidades.');
    if(available.length<count)return toast('Hay '+available.length+' preguntas disponibles para esta selección. Elige más especialidades o reduce el número de preguntas.');
    const pool=battlePick(available,count);
    const code=battleCode(),room={code,host_user_id:state.user.id,status:'waiting',question_ids:pool.map(q=>q.id),question_sources:pool.map(q=>q._source||'questions'),duration_seconds:minutes*60};
    const {data,error}=await state.sb.from('battle_rooms').insert(room).select().single();if(error)return toast(error.message);
    const {data:participant,error:joinError}=await state.sb.from('battle_participants').insert({room_id:data.id,user_id:state.user.id,display_name:profileName()}).select().single();
    if(joinError){await state.sb.from('battle_rooms').delete().eq('id',data.id);return toast(joinError.message)}
    state.battleHistory.unshift(participant);state.battle={room:data,pool,index:0,answers:{},started:false,participants:[participant],selection:{scope,specialties}};
    history.replaceState(null,'',battleInviteUrl(code));toast(rematch?'Revancha creada. Comparte la invitación con tu rival.':`Sala ${code} creada`);renderBattles();await pollBattle(data.id);
  }
  async function joinBattle(invitedCode=''){
    const code=planRules.sanitizeBattleCode(invitedCode||$v('#battleJoinCode')?.value);if(code.length!==6)return toast('Escribe un código de 6 caracteres');
    const {data:room,error}=await state.sb.from('battle_rooms').select('*').eq('code',code).in('status',['waiting','active']).maybeSingle();if(error||!room)return toast('Sala no encontrada o ya finalizada');
    const alreadyJoined=(state.battleHistory||[]).some(x=>String(x.room_id)===String(room.id));
    if(!alreadyJoined&&!unlimited()&&remaining('battles')<=0)return toast('Plan Free: límite diario de batallas alcanzado');
    const participantResult=alreadyJoined
      ?await state.sb.from('battle_participants').select('*').eq('room_id',room.id).eq('user_id',state.user.id).single()
      :await state.sb.from('battle_participants').insert({room_id:room.id,user_id:state.user.id,display_name:profileName()}).select().single();
    const {data:participant,error:joinError}=participantResult;if(joinError)return toast(joinError.message);
    if(participant&&!alreadyJoined)state.battleHistory.unshift(participant);
    const ids=room.question_ids||[],sources=room.question_sources?.length===ids.length?room.question_sources:ids.map(()=>'questions'),map=new Map(questionPool().map(q=>[battleQuestionKey(q),q])),pool=ids.map((id,i)=>map.get(`${sources[i]}:${id}`)).filter(Boolean);
    if(pool.length!==ids.length)return toast('La sala contiene preguntas que ya no están disponibles');
    const {data:prior,error:priorError}=await state.sb.from('battle_answers').select('question_id,source_type,selected_index').eq('room_id',room.id).eq('user_id',state.user.id);
    if(priorError)return toast(priorError.message);
    const answers=Object.fromEntries((prior||[]).map(a=>[`${a.source_type}:${a.question_id}`,a.selected_index]));
    const next=pool.findIndex(q=>answers[battleQuestionKey(q)]==null);
    state.battle={room,pool,index:next<0?pool.length:next,answers,started:room.status==='active',participants:participant?[participant]:[]};
    history.replaceState(null,'',battleInviteUrl(code));renderBattles();await pollBattle(room.id);
  }
  async function startBattleRoom(){const r=state.battle?.room;if(!r||r.host_user_id!==state.user.id)return;const {data,error}=await state.sb.from('battle_rooms').update({status:'active',started_at:new Date().toISOString()}).eq('id',r.id).select().single();if(error)return toast(error.message);state.battle.room=data;state.battle.started=true;renderBattles();await pollBattle(r.id)}
  let battlePoll=null;
  function battleStandings(parts){return parts.slice().sort((a,b)=>Number(b.score||0)-Number(a.score||0)||Number(b.correct||0)-Number(a.correct||0)||new Date(a.finished_at||'9999')-new Date(b.finished_at||'9999')||String(a.user_id).localeCompare(String(b.user_id)))}
  function battleAvatar(p){const name=p.display_name||'Jugador',initials=name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();return `<span class="battle-avatar" aria-hidden="true">${esc(initials||'J')}</span>`}
  function battleEnded(room){return room?.status==='completed'||(room?.started_at&&Date.now()>=new Date(room.started_at).getTime()+Number(room.duration_seconds||600)*1000)}
  function battleReviewStatus(b,q){const selected=b.answers?.[battleQuestionKey(q)];return selected==null?'blank':Number(selected)===Number(q.correct_index)?'correct':'wrong'}
  function battleReviewDetail(b,i){
    const q=b.pool[i],selected=b.answers?.[battleQuestionKey(q)],status=battleReviewStatus(b,q),blank=status==='blank',pro=unlimited();
    return `<div class="battle-review-detail-head"><span class="chip">Pregunta ${i+1} de ${b.pool.length}</span><span class="review-status-pill ${status}">${blank?'En blanco':status==='correct'?'Correcta':'Incorrecta'}</span></div>
      <div class="question-stem">${mdInline(q.stem||'')}</div>${questionImageHtml(q)}
      <div class="battle-review-options">${(q.options||[]).map((o,j)=>{const correct=j===Number(q.correct_index),chosen=j===Number(selected)&&!blank;return `<div class="battle-review-option ${correct?'is-correct':''} ${chosen&&!correct?'is-wrong':''}"><span class="battle-review-number">${j+1}</span><span>${optionHtml(typeof o==='string'?o:o.text||'')}</span>${correct?'<strong>Correcta</strong>':''}${chosen?'<em>Tu respuesta</em>':''}</div>`}).join('')}</div>
      <p class="battle-review-answerline"><strong>Tu respuesta:</strong> ${blank?'En blanco':`Opción ${Number(selected)+1}`} · <strong>Correcta:</strong> Opción ${Number(q.correct_index)+1}</p>
      ${pro?`<section class="battle-review-explanation"><h4>Explicación</h4>${q.explanation?markdownToHtml(q.explanation):'<p>Esta pregunta no tiene explicación registrada.</p>'}</section>`:'<div class="battle-review-pro"><strong>Explicación · Plan Pro</strong><p>Con Pro puedes leer la explicación de cada pregunta de la batalla.</p></div>'}`;
  }
  function renderBattleReview(b){
    const root=$v('#view-battles'),n=b.pool.length,correct=b.pool.filter(q=>battleReviewStatus(b,q)==='correct').length,wrong=b.pool.filter(q=>battleReviewStatus(b,q)==='wrong').length,blank=n-correct-wrong;
    b.reviewIndex=Math.max(0,Math.min(b.reviewIndex||0,n-1));
    root.innerHTML=`<div class="battle-review-head"><div><span class="chip">Batalla ${esc(b.room.code)}</span><h2>Revisión de batalla</h2><p class="muted">${correct} correctas · ${wrong} incorrectas · ${blank} en blanco</p></div><button class="btn" type="button" onclick="closeBattleReview()">Volver al resultado</button></div><div class="battle-review-layout"><nav class="card battle-review-nav" aria-label="Preguntas de la batalla">${b.pool.map((q,i)=>{const status=battleReviewStatus(b,q);return `<button type="button" class="battle-review-nav-item ${status} ${i===b.reviewIndex?'active':''}" onclick="showBattleReviewQuestion(${i})" aria-label="Pregunta ${i+1}: ${status==='correct'?'correcta':status==='wrong'?'incorrecta':'en blanco'}">${i+1}<span>${status==='correct'?'✓':status==='wrong'?'×':'—'}</span></button>`}).join('')}</nav><main class="card battle-review-detail" id="battleReviewDetail">${battleReviewDetail(b,b.reviewIndex)}</main></div>`;
  }
  function showBattleReviewQuestion(i){const b=state.battle;if(!b?.reviewOpen||!battleEnded(b.room)||!Number.isInteger(i)||i<0||i>=b.pool.length)return;b.reviewIndex=i;renderBattleReview(b)}
  function closeBattleReview(){if(!state.battle)return;state.battle.reviewOpen=false;renderBattles()}
  async function openBattleReview(roomId){
    if(!state.user)return;
    if(state.battle?.room?.id===roomId&&battleEnded(state.battle.room)){state.battle.reviewOpen=true;state.battle.reviewIndex=0;renderBattles();return}
    if(!(state.battleHistory||[]).some(p=>p.room_id===roomId))return toast('No participaste en esta batalla');
    const {data:room,error}=await state.sb.from('battle_rooms').select('*').eq('id',roomId).single();
    if(error||!room||!battleEnded(room))return toast('La batalla todavía no ha terminado');
    const ids=room.question_ids||[],sources=room.question_sources?.length===ids.length?room.question_sources:ids.map(()=>'questions'),map=new Map(questionPool().map(q=>[battleQuestionKey(q),q])),pool=ids.map((id,i)=>map.get(`${sources[i]}:${id}`));
    if(pool.some(q=>!q))return toast('Hay preguntas de esta batalla que ya no están disponibles');
    const [{data:rows,error:answersError},{data:participants,error:partsError}]=await Promise.all([
      state.sb.from('battle_answers').select('question_id,source_type,selected_index').eq('room_id',roomId).eq('user_id',state.user.id),
      state.sb.from('battle_participants').select('*').eq('room_id',roomId)
    ]);
    if(answersError||partsError)return toast('No se pudo cargar la revisión');
    clearInterval(battlePoll);
    const answers=Object.fromEntries((rows||[]).map(a=>[`${a.source_type}:${a.question_id}`,a.selected_index]));
    state.battle={room,pool,index:pool.length,answers,started:true,participants:participants||[],reviewOpen:true,reviewIndex:0};
    history.replaceState(null,'',battleInviteUrl(room.code));route('battles');
  }
  window.openBattleReview=openBattleReview;window.showBattleReviewQuestion=showBattleReviewQuestion;window.closeBattleReview=closeBattleReview;
  async function pollBattle(id){
    clearInterval(battlePoll);
    const tick=async()=>{
      if(!state.battle?.room||state.battle.room.id!==id)return clearInterval(battlePoll);
      const [{data:room},{data:parts}]=await Promise.all([state.sb.from('battle_rooms').select('*').eq('id',id).single(),state.sb.from('battle_participants').select('*').eq('room_id',id)]);
      if(!state.battle?.room||state.battle.room.id!==id)return clearInterval(battlePoll);
      if(room){state.battle.room=room;if(room.status==='active')state.battle.started=true}
      if(parts){
        state.battle.participants=parts;
        const mine=parts.find(p=>p.user_id===state.user?.id);
        if(mine){const index=(state.battleHistory||[]).findIndex(p=>p.room_id===id);if(index>=0)state.battleHistory[index]=mine;else state.battleHistory.unshift(mine)}
      }
      if(state.view==='battles')renderBattles();
      if(room?.status==='completed'||room?.status==='cancelled')clearInterval(battlePoll);
    };
    await tick();
    if(state.battle?.room?.id===id&&state.battle.room.status!=='completed'&&state.battle.room.status!=='cancelled')battlePoll=setInterval(tick,2500);
  }
  function selectBattleAnswer(i){
    const b=state.battle,q=b?.pool?.[b.index],key=battleQuestionKey(q);
    if(!q||b.submitting||b.answers[key]!=null||(b.eliminations?.[key]||[]).includes(i)||b.room.status!=='active')return;
    b.selected=i;renderBattles();$v('#battleConfirmAnswer')?.focus();
  }
  function cancelBattleAnswer(){if(!state.battle||state.battle.submitting)return;state.battle.selected=null;renderBattles()}
  async function answerBattle(){
    const b=state.battle,q=b?.pool?.[b.index],key=battleQuestionKey(q),i=b?.selected;
    if(!q||!Number.isInteger(i)||b.submitting||b.answers[key]!=null||b.room.status!=='active')return;
    b.submitting=true;renderBattles();
    const {error}=await state.sb.from('battle_answers').insert({room_id:b.room.id,user_id:state.user.id,question_id:q.id,source_type:q._source||'questions',selected_index:i});
    if(state.battle!==b)return;
    b.submitting=false;
    if(error){renderBattles();return toast(error.message)}
    b.answers[key]=i;b.selected=null;
    b.index=b.pool.findIndex(item=>b.answers[battleQuestionKey(item)]==null);
    if(b.index<0)b.index=b.pool.length;
    renderBattles();await pollBattle(b.room.id);
  }
  window.battleCaptureHighlight=()=>{const root=$v('#battleStem'),sel=window.getSelection();if(root&&sel?.rangeCount&&!sel.isCollapsed&&root.contains(sel.getRangeAt(0).commonAncestorContainer))battleSelection=sel.getRangeAt(0).cloneRange()};
  let battleSelection=null;
  window.battleHighlight=(clear=false)=>{const b=state.battle,q=b?.pool?.[b.index],key=battleQuestionKey(q),root=$v('#battleStem');if(!q||!root)return;b.highlights??={};if(clear){root.querySelectorAll('mark.user-highlight').forEach(m=>m.replaceWith(...m.childNodes));root.normalize()}else{const sel=window.getSelection(),range=sel?.rangeCount&&!sel.isCollapsed&&root.contains(sel.getRangeAt(0).commonAncestorContainer)?sel.getRangeAt(0).cloneRange():battleSelection;if(!range||!root.contains(range.commonAncestorContainer))return toast('Selecciona parte del enunciado');const mark=document.createElement('mark');mark.className='user-highlight';try{range.surroundContents(mark)}catch{try{mark.appendChild(range.extractContents());range.insertNode(mark)}catch{return toast('Selecciona un fragmento más corto')}}sel?.removeAllRanges()}b.highlights[key]=root.innerHTML;battleSelection=null};
  window.battleToggleDiscard=i=>{const b=state.battle,q=b?.pool?.[b.index],key=battleQuestionKey(q);if(!q||b.answers[key]!=null||b.submitting)return;b.eliminations??={};const set=new Set(b.eliminations[key]||[]);if(set.has(i))set.delete(i);else set.add(i);b.eliminations[key]=[...set];if(b.selected===i)b.selected=null;renderBattles()};
  function leaveBattle(){clearInterval(battlePoll);state.battle=null;history.replaceState(null,'',location.pathname);route('dashboard')}
  function newBattle(){clearInterval(battlePoll);state.battle=null;history.replaceState(null,'',location.pathname);route('battles')}
  window.createBattle=createBattle;window.joinBattle=joinBattle;window.startBattleRoom=startBattleRoom;window.answerBattle=answerBattle;window.selectBattleAnswer=selectBattleAnswer;window.cancelBattleAnswer=cancelBattleAnswer;window.leaveBattle=leaveBattle;window.newBattle=newBattle;window.shareBattle=shareBattle;
  renderBattles=function(){
    const b=state.battle,invited=requestedBattleCode();
    if(!b){$v('#view-battles').innerHTML=`<div class="section-head"><div><h2>Batallas NEXMIR</h2><p class="muted">Duelo 1 vs 1 entre usuarios Free o Pro, con las mismas preguntas, tiempo y ranking.</p></div><span class="pill">${limitText('battles')}</span></div><div class="grid cols-2"><div class="card"><h3>Crear duelo</h3><label>Preguntas<input id="battleCount" type="number" min="5" max="50" value="10"></label><label>Minutos<input id="battleMinutes" type="number" min="3" max="60" value="10"></label>${battleScopeHtml()}<button class="btn primary" onclick="createBattle()">Crear sala</button></div><div class="card"><h3>Unirse</h3>${invited?'<div class="callout"><strong>Invitación detectada</strong><p>Revisa el código y entra a la sala.</p></div>':''}<label>Código<input id="battleJoinCode" maxlength="6" value="${esc(invited)}" placeholder="ABC123" style="text-transform:uppercase"></label><button class="btn" onclick="joinBattle()">Entrar a sala</button></div></div><div class="card" style="margin-top:16px"><h3>Cómo funciona</h3><p class="muted">Quien crea la sala comparte el enlace. El invitado crea su cuenta o inicia sesión, entra a la sala y el anfitrión inicia cuando estén los dos.</p></div>`;
      const history=(state.battleHistory||[]).filter(p=>p.finished_at).slice(0,10);
      if(history.length)$v('#view-battles').insertAdjacentHTML('beforeend',`<section class="card battle-review-history"><h3>Revisar batallas anteriores</h3>${history.map(p=>`<div><span>${new Date(p.joined_at).toLocaleDateString('es-PE')} · ${p.score||0} pts · ${p.correct||0}/${p.answered||0} correctas</span><button class="btn mini" type="button" onclick="openBattleReview('${esc(p.room_id)}')">Revisión</button></div>`).join('')}</section>`);
      return}
    if(b.reviewOpen&&battleEnded(b.room))return renderBattleReview(b);
    const parts=b.participants||[],room=b.room;
    if(!b.started&&room.status==='waiting'){$v('#view-battles').innerHTML=`<div class="hero-main"><span class="chip">Sala de espera</span><h1>Código ${esc(room.code)}</h1><p class="muted">Preguntas: ${esc(battleTopicLabel(b.pool))}</p><p>Comparte el enlace con tu rival. Si todavía no usa NEXMIR, primero podrá crear su cuenta gratis.</p><div class="battle-share-actions"><button class="btn primary" type="button" onclick="shareBattle('${esc(room.code)}')">↗ Compartir invitación</button><input class="battle-share-url" value="${esc(battleInviteUrl(room.code))}" readonly aria-label="Enlace de invitación"></div><div class="battle-ranking">${parts.map((p,i)=>`<div><strong>${i+1}. ${esc(p.display_name||'Jugador')}</strong><span>${p.user_id===room.host_user_id?'Host':''}</span></div>`).join('')}</div>${room.host_user_id===state.user.id?`<button class="btn primary" ${parts.length!==2?'disabled':''} onclick="startBattleRoom()">Empezar batalla</button>`:'<p class="muted">Esperando a que el anfitrión inicie…</p>'}</div>`;return}
    const elapsed=room.started_at?Math.floor((Date.now()-new Date(room.started_at))/1000):0,left=Math.max(0,(room.duration_seconds||600)-elapsed),ended=room.status==='completed'||left===0,finished=b.index>=b.pool.length,q=ended||finished?null:b.pool[b.index],qkey=battleQuestionKey(q);
    const ordered=battleStandings(parts),done=parts.filter(p=>p.finished_at||Number(p.answered)>=b.pool.length).length;
    const ranking=`<div class="battle-rank-list">${ordered.map((p,i)=>`<div class="rank-row"><strong>${i+1}. ${esc(p.display_name||'Jugador')}</strong><span>${p.score||0} pts · ${p.correct||0}/${p.answered||0}${p.finished_at?' ✓':''}</span></div>`).join('')}</div>`;
    const result=ended?`<section class="battle-results ${b.resultShown?'':'first-show'}" aria-label="Resultado de batalla"><h3>Clasificación final</h3><div class="battle-podium">${ordered.map((p,i)=>`<div class="battle-result ${p.user_id===state.user.id?'is-you':''} ${i===0?'is-winner':'is-runner'}" style="--place:${i}">${battleAvatar(p)}<span class="battle-emotion" aria-hidden="true">${i===0?'🎉':'😔'}</span><div><span class="battle-place">${i+1}.º puesto${p.user_id===state.user.id?' · Tú':''}</span><strong>${esc(p.display_name||'Jugador')}</strong><small>${p.score||0} puntos · ${p.correct||0} aciertos</small></div></div>`).join('')}</div><div class="battle-actions"><button class="btn" onclick="leaveBattle()">Ir al inicio</button><button class="btn primary" onclick="createBattle(true)">Revancha con mi rival</button><button class="btn" onclick="newBattle()">Nueva batalla</button></div><p class="muted small">Para la revancha, comparte la nueva invitación con el mismo rival.</p></section>`:'';
    const waiting=!ended&&finished?`<div class="battle-waiting" role="status" aria-live="polite"><span class="battle-wait-icon" aria-hidden="true">⌛</span><div><h3>¡Terminaste! Espera a que tu rival concluya.</h3><p>${done}/${parts.length} participantes han terminado · faltan ${Math.max(0,parts.length-done)}.</p></div></div>`:'';
    $v('#view-battles').innerHTML=`<div class="battle-head"><div><span class="chip">Batalla ${esc(room.code)}</span><span class="chip">${esc(battleTopicLabel(b.pool))}</span><h2>${ended?'Resultado final':finished?'Esperando resultados':`${b.index+1}/${b.pool.length}`}</h2></div><div class="sim-timer">${Math.floor(left/60).toString().padStart(2,'0')}:${(left%60).toString().padStart(2,'0')}</div></div><div class="battle-layout ${ended?'is-ended':''}"><main class="card battle-question-card">${q?`<div class="highlight-toolbar"><span>Enunciado</span><button class="btn mini" type="button" onmousedown="event.preventDefault()" onclick="battleHighlight()">🖍 Resaltar</button><button class="btn mini" type="button" onclick="battleHighlight(true)">Quitar resaltado</button></div><div id="battleStem" class="question-stem" onmouseup="battleCaptureHighlight()" onkeyup="battleCaptureHighlight()">${b.highlights?.[qkey]||mdInline(q.stem||'')}</div><p class="muted small">Teclado: 1–${Math.min(9,(q.options||[]).length)} para seleccionar; confirma antes de enviar.</p><div class="sim-options">${(q.options||[]).map((o,i)=>`<div class="battle-option-row ${(b.eliminations?.[qkey]||[]).includes(i)?'eliminated':''}"><button type="button" class="sim-option ${b.selected===i?'selected':''}" aria-pressed="${b.selected===i}" ${(b.eliminations?.[qkey]||[]).includes(i)||b.submitting?'disabled':''} onclick="selectBattleAnswer(${i})"><span class="letter">${i+1}</span><span>${optionHtml(typeof o==='string'?o:o.text||'')}</span></button><button type="button" class="focus-discard-btn" ${b.submitting?'disabled':''} onclick="battleToggleDiscard(${i})">${(b.eliminations?.[qkey]||[]).includes(i)?'↶ Recuperar':'× Descartar'}</button></div>`).join('')}</div>${b.selected!=null?`<div class="battle-confirm" role="group" aria-label="Confirmar respuesta"><strong>Seleccionaste la opción ${b.selected+1}. ¿Estás seguro de tu respuesta?</strong><div><button type="button" class="btn" onclick="cancelBattleAnswer()" ${b.submitting?'disabled':''}>Cambiar respuesta</button><button id="battleConfirmAnswer" type="button" class="btn primary" onclick="answerBattle()" ${b.submitting?'disabled':''}>${b.submitting?'Enviando…':'Confirmar respuesta'}</button></div></div>`:''}`:waiting||result}</main><aside class="card battle-ranking-card"><h3>Ranking</h3>${ranking}</aside></div>`;
    if(ended)$v('#view-battles .battle-actions')?.insertAdjacentHTML('afterbegin','<button class="btn primary" type="button" onclick="openBattleReview(state.battle.room.id)">Revisión de preguntas</button>');
    if(ended)b.resultShown=true;
  };

  const showAppBeforeBattle=showApp;
  showApp=function(){showAppBeforeBattle();const code=requestedBattleCode();if(code&&!state.deviceBlocked)setTimeout(async()=>{await route('battles');if(!state.battle)await joinBattle(code)},0)};

  const suggestionStatusLabels={open:'Pendiente',reviewing:'En revisión',planned:'Planificada',done:'Completada',dismissed:'Descartada'};
  const suggestionCategoryLabels={feature:'Nueva función',improvement:'Mejora',problem:'Problema',other:'Otro'};
  async function submitFeatureSuggestion(){
    const category=$v('#suggestionCategory')?.value||'feature',title=($v('#suggestionTitle')?.value||'').trim(),detail=($v('#suggestionDetail')?.value||'').trim(),btn=$v('#suggestionSubmit');
    if(detail.length<10)return toast('Describe tu sugerencia con al menos 10 caracteres');
    if(detail.length>3000)return toast('La sugerencia es demasiado larga');
    if(btn){btn.disabled=true;btn.textContent='Enviando…'}
    const {data,error}=await state.sb.from('feature_suggestions').insert({user_id:state.user.id,category,title:title||null,detail}).select('id,category,title,detail,status,admin_note,created_at,updated_at').single();
    if(btn){btn.disabled=false;btn.textContent='Enviar sugerencia'}
    if(error)return toast(error.message);
    state.mySuggestions=[data,...(state.mySuggestions||[])].slice(0,10);toast('Sugerencia enviada. Gracias por ayudar a mejorar NEXMIR');renderProfile();
  }
  window.submitFeatureSuggestion=submitFeatureSuggestion;
  function suggestionHistoryHtml(){const rows=(state.mySuggestions||[]).slice(0,5);if(!rows.length)return '<p class="muted small">Aún no has enviado sugerencias.</p>';return `<div class="suggestion-history">${rows.map(x=>`<div class="suggestion-item"><div class="row"><strong>${esc(x.title||suggestionCategoryLabels[x.category]||'Sugerencia')}</strong><span class="chip">${esc(suggestionStatusLabels[x.status]||x.status||'Pendiente')}</span></div><p class="muted small">${esc((x.detail||'').slice(0,220))}</p>${x.admin_note?`<p class="small"><strong>Respuesta del equipo:</strong> ${esc(x.admin_note)}</p>`:''}</div>`).join('')}</div>`}

  // Profile with plan / verification / gamification
  renderProfile=function(){const lvl=levelInfo(),verified=!!state.user?.email_confirmed_at,ach=specialtyAchievements();$v('#view-profile').innerHTML=`<div class="grid cols-2"><div class="card"><h3>Perfil</h3><label>Nombre<input id="profileName" value="${esc(state.profile?.display_name||'')}"></label><label>Correo<input value="${esc(state.user.email)}" disabled></label><div class="row"><span>Verificación</span><span class="chip ${verified?'green-chip':''}">${verified?'Correo verificado':'Pendiente'}</span></div>${!verified?'<button class="btn mini" onclick="resendVerification()">Reenviar verificación</button>':''}<div class="row" style="margin-top:10px"><span>Plan</span><span class="pill">${esc(planName().toUpperCase())}</span></div><div class="row" style="margin-top:10px"><span>Rol</span><span class="chip">${esc(state.profile?.role||'user')}</span></div><button class="btn primary" style="margin-top:15px" onclick="saveProfile()">Guardar</button></div><div class="card"><h3>Residente virtual</h3><div class="resident-big">${lvl.rank}</div><div class="row"><span>Nivel ${lvl.level}</span><strong>${lvl.xp} XP</strong></div><div class="progress-track"><div class="progress-fill" style="width:${lvl.pct}%"></div></div><div class="row"><span>Racha</span><strong>${currentStreak()} días</strong></div><h4>Logros por especialidad</h4>${ach.length?ach.map(a=>`<span class="achievement">🏅 ${esc(a.sp)} · ${a.acc}%</span>`).join(''):'<p class="muted">Logra ≥80% con al menos 30 preguntas de una especialidad.</p>'}</div></div><div class="grid cols-2" style="margin-top:16px"><div class="card"><h3>Límites del plan</h3><div class="row"><span>Banqueo</span><strong>${limitText('bank')}</strong></div><div class="row"><span>Flashcards</span><strong>${limitText('reviews')}</strong></div><div class="row"><span>Mini-MIR · 15 preguntas</span><strong>${limitText('miniSimulations')}</strong></div><div class="row"><span>Simulacro completo</span><strong>${unlimited()?'Ilimitado':'Solo Pro'}</strong></div><div class="row"><span>Batallas</span><strong>${limitText('battles')}</strong></div><p class="muted small">Plan Free: 15 preguntas de banqueo/día, 20 flashcards/día, 1 Mini-MIR de 15 preguntas/día y 5 batallas/día. Pro, admin y moderador: ilimitado.</p></div><div class="card"><h3>Sesión y dispositivos</h3><p class="muted">Este dispositivo: ${esc(deviceLabel())}</p><p class="muted">${state.profile?.role==='admin'?'Como administrador puedes ingresar desde varios dispositivos.':'Tu cuenta permite una sesión activa. Al ingresar desde otro dispositivo se cierra la anterior.'}</p><p class="muted small">La sesión se cierra tras una hora sin actividad.</p><div class="profile-device-actions"><button class="btn danger" type="button" onclick="logout()">Cerrar sesión</button></div></div></div><div class="card" style="margin-top:16px"><div class="section-head"><div><h3>Sugerencias para NEXMIR</h3><p class="muted">Cuéntanos qué función te gustaría tener, qué mejorarías o qué problema encontraste.</p></div></div><div class="grid cols-2"><label>Categoría<select id="suggestionCategory"><option value="feature">Nueva función</option><option value="improvement">Mejora</option><option value="problem">Problema</option><option value="other">Otro</option></select></label><label>Título opcional<input id="suggestionTitle" maxlength="120" placeholder="Ej. Modo de repaso por especialidad"></label></div><label>Tu recomendación<textarea id="suggestionDetail" minlength="10" maxlength="3000" rows="5" placeholder="Describe la función o mejora que te gustaría ver en NEXMIR…"></textarea></label><div class="dialog-actions"><button id="suggestionSubmit" class="btn primary" type="button" onclick="submitFeatureSuggestion()">Enviar sugerencia</button></div><h4 style="margin-top:18px">Tus últimas sugerencias</h4>${suggestionHistoryHtml()}</div>`};
  window.resendVerification=resendVerification;window.replaceDevice=replaceDevice;

  // extend renderer with calendar
  const oldRender=render;
  render=function(v){if(v==='calendar')return renderCalendar();return oldRender(v)};

  // plan label refresh
  const oldShowApp2=showApp;
  showApp=function(){oldShowApp2();if($v('#planPill'))$v('#planPill').textContent=['admin','moderator'].includes(state.profile?.role)?state.profile.role.toUpperCase():planName().toUpperCase()};
})();
