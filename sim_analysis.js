/* NEXMIR V5.1.35: análisis después de entregar un simulacro.
   Netas por asignatura, tiempos, comparación con simulacros anteriores y repaso de lo fallado en un clic.
   No cambia datos ni tablas: usa lo que ya se guarda (simulations y user_question_attempts). */
(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s);
 const S=()=>(typeof state!=='undefined'?state:null);
 const fmtSec=v=>{v=Math.max(0,Math.round(v));const m=Math.floor(v/60),r=v%60;return m?`${m} min ${String(r).padStart(2,'0')} s`:`${r} s`};
 const fmtTotal=v=>{v=Math.max(0,Math.round(v));const h=Math.floor(v/3600),m=Math.floor(v%3600/60);return h?`${h} h ${String(m).padStart(2,'0')} min`:`${m} min`};
 const num=v=>v.toFixed(2);
 const sgn=(v,d=1)=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(d);

 /* Tiempo por pregunta: cuenta mientras el simulacro está abierto y la pestaña visible */
 const tKey=()=>`nexmir_sim_qtime_v1:${S()?.user?.id}:${S()?.simulation?.startedAt}`;
 setInterval(()=>{
  const st=S(),s=st?.simulation;
  if(!s?.active||document.hidden||!$('#simDialog')?.open)return;
  const q=s.pool?.[s.index];if(!q)return;
  if(!s.qTime){try{s.qTime=JSON.parse(localStorage.getItem(tKey())||'{}')}catch{s.qTime={}}s._qtTick=0}
  const k=simQKey(q);s.qTime[k]=(s.qTime[k]||0)+1;
  if(++s._qtTick%5===0){try{localStorage.setItem(tKey(),JSON.stringify(s.qTime))}catch{}}
 },1000);

 /* Resultado por asignatura del simulacro actual (solo preguntas principales, sin reservas) */
 function bySubject(s){
  const groups=new Map();
  for(const q of s.pool.slice(0,s.primaryCount)){
   const name=displaySpecialty(q.specialty)||'Sin asignatura',g=groups.get(name)||{name,n:0,ok:0,bad:0,blank:0,secs:0,timed:0};
   const k=simQKey(q),a=s.answers[k];g.n++;
   if(a===undefined)g.blank++;else if(+a===+q.correct_index)g.ok++;else g.bad++;
   const t=s.qTime?.[k];if(t){g.secs+=t;g.timed++}
   groups.set(name,g);
  }
  return[...groups.values()].map(g=>{const net=g.ok-g.bad/3;return{...g,net,lost:g.n-net,acc:g.n?Math.round(g.ok/g.n*100):0,avg:g.timed?g.secs/g.timed:null}}).sort((a,b)=>b.lost-a.lost);
 }

 /* Simulacros anteriores y su precisión por asignatura (estimada con los intentos guardados) */
 const when=r=>Date.parse(r.finished_at||r.created_at||0)||0;
 function previous(cur,s){
  return(S().simulations||[]).filter(x=>x!==cur&&x.total>0&&x.finished_at&&Date.parse(x.started_at)!==Date.parse(s.startedAt)).sort((a,b)=>when(b)-when(a)).slice(0,6);
 }
 function priorBySubject(prev){
  const acc=new Map();
  for(const sim of prev){
   const ids=new Set((sim.question_ids||[]).map(String)),fin=when(sim);if(!ids.size||!fin)continue;
   for(const a of S().attempts||[]){
    if(a.mode!=='simulation'||a.is_valid===false)continue;
    const t=Date.parse(a.answered_at);if(!(t>=fin-300000&&t<=fin+60000))continue;
    const q=getAttemptQuestion(a);if(!q||!ids.has(String(q.id)))continue;
    const name=displaySpecialty(q.specialty)||'Sin asignatura',o=acc.get(name)||{n:0,ok:0};o.n++;if(a.is_correct)o.ok++;acc.set(name,o);
   }
  }
  return acc;
 }
 const perf=r=>r.total?Number(r.net_score||0)/r.total*100:0;

 function render(s,main,res){
  const st=S(),cur=(st.simulations||[]).find(x=>Date.parse(x.started_at)===Date.parse(s.startedAt))||null;
  const rows=bySubject(s),prev=previous(cur,s),prior=priorBySubject(prev);
  const elapsed=cur?.finished_at?(Date.parse(cur.finished_at)-Date.parse(cur.started_at))/1000:(Date.now()-Date.parse(s.startedAt))/1000;
  const nQ=s.primaryCount||1,avgQ=elapsed/nQ,perfNow=main.net/nQ*100;
  const prevAvgQ=prev.length?prev.reduce((t,x)=>t+(Date.parse(x.finished_at)-Date.parse(x.started_at))/1000/x.total,0)/prev.length:null;
  const prevPerf=prev.length?prev.reduce((t,x)=>t+perf(x),0)/prev.length:null,lastPerf=prev.length?perf(prev[0]):null;
  const failed=s.pool.filter(q=>{const a=s.answers[simQKey(q)];return a!==undefined&&+a!==+q.correct_index}).length;
  const blank=s.pool.filter(q=>s.answers[simQKey(q)]===undefined).length;
  const maxLost=Math.max(0.01,...rows.map(r=>r.lost));
  const delta=(v,ref,unit,better)=>ref===null?'':`<small class="sim-an-delta ${(better?v<ref:v>ref)?'up':(v===ref?'':'down')}">${sgn(v-ref,unit==='s'?0:1)}${unit==='s'?' s':' pts'} vs tu promedio anterior</small>`;

  const subjectRows=rows.map((r,i)=>{
   const p=prior.get(r.name),before=p&&p.n>=3?Math.round(p.ok/p.n*100):null,d=before===null?null:r.acc-before;
   const w=x=>r.n?(x/r.n*100).toFixed(1):0;
   return `<div class="sim-an-row${i<3&&r.lost>0.5?' priority':''}"><div class="sim-an-head"><strong>${esc(r.name)}</strong><span>${num(r.net)} de ${r.n} netas</span></div>
    <div class="sim-an-bar" role="img" aria-label="${r.ok} correctas, ${r.bad} incorrectas, ${r.blank} en blanco"><span class="ok" style="width:${w(r.ok)}%"></span><span class="bad" style="width:${w(r.bad)}%"></span><span class="blank" style="width:${w(r.blank)}%"></span></div>
    <div class="sim-an-meta"><span class="lost" style="--w:${Math.round(r.lost/maxLost*100)}%">Pierdes ${num(r.lost)} netas</span><span>${r.bad} incorrectas · ${r.blank} en blanco</span>${r.avg!==null?`<span>${fmtSec(r.avg)} por pregunta</span>`:''}${before!==null?`<span class="${d>0?'up':d<0?'down':''}">Antes ${before}% ${d>0?'▲':d<0?'▼':'='} ${sgn(d,0)}</span>`:''}${i<3&&r.lost>0.5?'<span class="chip">Prioridad</span>':''}</div></div>`;
  }).join('');

  const series=[...prev].reverse().map(x=>({label:new Date(when(x)).toLocaleDateString('es',{day:'2-digit',month:'2-digit'}),v:perf(x),cur:false})).concat([{label:'Este',v:perfNow,cur:true}]);
  const top=Math.max(40,...series.map(x=>x.v)),trend=series.map(x=>`<div class="sim-an-col${x.cur?' cur':''}"><span class="sim-an-val">${x.v.toFixed(0)}%</span><div class="sim-an-colbar" style="height:${Math.max(4,Math.round(Math.max(0,x.v)/top*100))}%"></div><span class="sim-an-lbl">${x.label}</span></div>`).join('');
  const compare=prev.length
   ?`<div class="sim-an-trend" role="img" aria-label="Rendimiento neto por simulacro">${trend}</div><p class="muted small">Rendimiento neto = netas ÷ preguntas. Tu promedio anterior es ${prevPerf.toFixed(0)}% y tu último simulacro fue ${lastPerf.toFixed(0)}%. ${perfNow>=lastPerf?`Subiste ${sgn(perfNow-lastPerf,1)} puntos respecto al último.`:`Bajaste ${Math.abs(perfNow-lastPerf).toFixed(1)} puntos respecto al último.`}</p>`
   :`<p class="muted">Este es tu primer simulacro registrado. Con el siguiente verás aquí cómo evolucionas.</p>`;

  return `<section id="simAnalysis" class="sim-analysis" aria-label="Análisis del simulacro">
   <div class="sim-an-actions"><button type="button" class="btn primary" ${failed?'':'disabled'} onclick="reviewFailedSimulation()">${failed?`Repasar solo lo fallado (${failed})`:'No hay preguntas falladas'}</button>${blank?`<button type="button" class="btn" onclick="reviewFailedSimulation(true)">Incluir las que dejaste en blanco (${blank})</button>`:''}<button type="button" class="btn" onclick="simShowTab('review')">Ver revisión pregunta por pregunta</button></div>
   <div class="sim-an-kpis"><div class="card"><span class="muted small">Tiempo total</span><strong>${fmtTotal(elapsed)}</strong></div><div class="card"><span class="muted small">Tiempo medio por pregunta</span><strong>${fmtSec(avgQ)}</strong>${prevAvgQ===null?'':delta(avgQ,prevAvgQ,'s',true)}</div><div class="card"><span class="muted small">Rendimiento neto</span><strong>${perfNow.toFixed(0)}%</strong>${prevPerf===null?'':delta(perfNow,prevPerf,'p',false)}</div></div>
   <h3>Dónde perdiste puntos</h3><p class="muted small">Ordenado por netas perdidas. Cada pregunta vale 1 neta; una incorrecta resta 1/3.</p>${subjectRows}
   ${prior.size?'<p class="muted small">«Antes» compara con tus respuestas guardadas de simulacros anteriores (estimado).</p>':''}
   <h3>Comparación con tus simulacros anteriores</h3>${compare}</section>`;
 }

 window.simShowTab=function(tab){
  const shell=$('#simDialogBody .sim-results-shell');if(!shell)return;
  shell.dataset.tab=tab;
  shell.querySelectorAll('.sim-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const pane=$('#simAnalysis',shell),ws=$('.sim-review-workspace',shell);
  if(pane)pane.hidden=tab!=='analysis';if(ws)ws.hidden=tab!=='review';
  if(tab==='review')renderSimulationReviewQuestion?.(0);
 };
 window.reviewFailedSimulation=function(includeBlank){
  const st=S(),s=st?.simulation;if(!s?.pool)return;
  const pool=s.pool.filter(q=>{const a=s.answers[simQKey(q)];return(a===undefined?includeBlank===true:+a!==+q.correct_index)&&(q.options||[]).length>=2});
  if(!pool.length)return toast('No hay preguntas para repasar');
  $('#simDialog')?.close();
  try{if(typeof renderSimulations==='function')renderSimulations()}catch(e){console.warn(e)}
  st.bank={pool,index:0,answered:false,selected:null,mode:'immediate',results:[],context:'simfailed',highlights:{},answers:{},eliminations:{},submitted:false};
  showQuestion();
 };

 const priorResults=renderSimulationResults;
 renderSimulationResults=function(s,main,res,timedOut){
  priorResults.apply(this,arguments);
  try{
   const shell=$('#simDialogBody .sim-results-shell'),top=shell?.querySelector('.sim-results-top');if(!shell||!top)return;
   top.insertAdjacentHTML('afterend',`<div class="sim-tabs seg" role="tablist"><button type="button" role="tab" data-tab="analysis" class="active" onclick="simShowTab('analysis')">Análisis</button><button type="button" role="tab" data-tab="review" onclick="simShowTab('review')">Revisión</button></div>${render(s,main,res)}`);
   simShowTab('analysis');
   try{localStorage.removeItem(tKey())}catch{}
  }catch(e){console.warn('análisis del simulacro',e)}
 };
})();
