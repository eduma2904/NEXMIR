const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DEFAULT_SB={url:'https://yovubdwasqkfpjmeyilg.supabase.co',key:'sb_publishable_iusNo0xndlWbws1_qh95OQ_eSuws-sI'};
const state={sb:null,user:null,profile:null,content:[],questions:[],reviews:[],attempts:[],errorLog:[],bookmarks:[],notes:[],simulations:[],view:'dashboard',studyPath:{},studyMode:'all',bank:{pool:[],index:0,answered:false,selected:null,highlights:{},answers:{},results:[]},review:{pool:[],index:0,revealed:false},simulation:{template:null}};
const viewNames={dashboard:'Inicio',study:'Estudiar',reviews:'Repasos',bank:'Banqueo',simulations:'Simulacros',battles:'Batallas',errors:'Mis errores',bookmarks:'Marcadas',progress:'Progreso',goal:'Mi plaza MIR',profile:'Perfil'};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmtDate=s=>s?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short'}).format(new Date(s)):'—';
const today=(d=new Date())=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
function toast(t){const el=$('#toast');el.textContent=t;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),2600)}
const AUTH_STORAGE_KEY='sb-'+new URL(DEFAULT_SB.url).hostname.split('.')[0]+'-auth-token';
let authGeneration=0,authBusy=false;
function clearSignedInUi(reason,message){
 authGeneration++;routeGeneration++;authTransition=null;window.nexmirClearStudyResume?.();state.user=null;state.deviceBlocked=false;
 state.simulation={template:null};clearInterval(simTimerHandle);
 state.bank={pool:[],index:0,answers:{},results:[]};state.review={pool:[],index:0};
 for(const name of ['content','questions','reviews','attempts','bookmarks','notes','simulations','errorLog'])state[name]=[];
 state.studyPlan=null;state.mySuggestions=[];state.battle=null;state.battleHistory=[];
 $$('.dialog[open],dialog[open]').forEach(d=>d.close());
 $$('.view').forEach(v=>{v.innerHTML='';v.classList.remove('active')});
 document.querySelector('.sidebar')?.classList.remove('open');
 showAuth();$('#authMsg').textContent=message||'';$('#loginPassword').value='';
}
function initSb(){
 state.sb=window.supabase.createClient(DEFAULT_SB.url,DEFAULT_SB.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:AUTH_STORAGE_KEY},global:{fetch:window.NexmirSessions.fetch}});
 window.NexmirSessions.configure({client:state.sb,url:DEFAULT_SB.url,key:DEFAULT_SB.key,storageKey:AUTH_STORAGE_KEY,onEnd:clearSignedInUi});
}
async function fetchAllPages(makeQuery,pageSize=1000){const out=[];for(let from=0;;from+=pageSize){const {data,error}=await makeQuery().range(from,from+pageSize-1);if(error)throw error;const rows=data||[];out.push(...rows);if(rows.length<pageSize)break}return out}
function cleanRemnoteMarks(s=''){return String(s??'').replace(/\^\^/g,'').replace(/\u200b/g,'')}
function unclassifiedSpecialty(s=''){return RemnoteTaxonomy.unclassified(s)}
function displaySpecialty(s=''){return unclassifiedSpecialty(s)?'Desagrupadas':String(s||'Desagrupadas')}
function sanitizePayloadMarks(v){if(typeof v==='string')return cleanRemnoteMarks(v);if(Array.isArray(v))return v.map(sanitizePayloadMarks);if(v&&typeof v==='object'){const o={};for(const [k,val] of Object.entries(v))o[k]=sanitizePayloadMarks(val);return o}return v}
function mdInline(s=''){return esc(cleanRemnoteMarks(s)).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/(^|[^\w])\*([^*\n]+)\*(?!\w)/g,'$1<em>$2</em>').replace(/`(.*?)`/g,'<code>$1</code>').replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(m,alt,url)=>{const u=url.trim();return /^(https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(u)?`<img alt="${alt}" src="${u}" referrerpolicy="no-referrer">`:alt})}
function optionHtml(s=''){return mdInline(String(s??'').replace(/\*\*/g,''))}
function reviewQuestionPreview(q,max=92){let s=cleanRemnoteMarks(q?.stem||q?.question||'').replace(/!\[[^\]]*\]\([^)]+\)/g,' ').replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\*\*|__|`|~~|\^\^/g,'').replace(/^[#>\-]+\s*/g,'').replace(/\s+/g,' ').trim();if(!s)return 'Sin enunciado';return s.length>max?s.slice(0,max-1).trimEnd()+'…':s}
function markdownToHtml(md=''){const lines=md.split('\n');let html='',ul=false,ol=false;for(const raw of lines){const l=raw.trim();if(!l){if(ul){html+='</ul>';ul=false}if(ol){html+='</ol>';ol=false}html+='<br>';continue}if(/^#{1,4}\s/.test(l)){const n=l.match(/^#+/)[0].length;html+=`<h${n}>${mdInline(l.replace(/^#+\s*/,''))}</h${n}>`;continue}if(/^[-*]\s+/.test(l)){if(!ul){if(ol){html+='</ol>';ol=false}html+='<ul>';ul=true}html+=`<li>${mdInline(l.replace(/^[-*]\s+/,''))}</li>`;continue}if(/^\d+\.\s+/.test(l)){if(!ol){if(ul){html+='</ul>';ul=false}html+='<ol>';ol=true}html+=`<li>${mdInline(l.replace(/^\d+\.\s+/,''))}</li>`;continue}if(ul){html+='</ul>';ul=false}if(ol){html+='</ol>';ol=false}html+=`<p>${mdInline(l)}</p>`}if(ul)html+='</ul>';if(ol)html+='</ol>';return html}
function renderTable(b){return `<div class="table-wrap"><table class="md-table"><thead><tr>${(b.headers||[]).map(h=>`<th>${mdInline(h)}</th>`).join('')}</tr></thead><tbody>${(b.rows||[]).map(r=>`<tr>${r.map(c=>`<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function renderTheoryPayload(p){if(p.blocks?.length)return p.blocks.map(b=>b.type==='table'?renderTable(b):`<div>${markdownToHtml(b.text||'')}</div>`).join('');return markdownToHtml(p.text||'')}
function cardAnswer(p){if(p.type==='multiple_choice')return p.back||p.options?.find(o=>o.correct)?.text||'';if(p.items?.length)return `<ul>${p.items.map(x=>`<li>${mdInline(x.text)}</li>`).join('')}</ul>`;if(p.type==='cloze')return (p.clozes||[]).map(esc).join(' · ');return mdInline(p.back||'')}
function pathOf(x){return [displaySpecialty(x.specialty),x.topic,x.subtopic,x.section].filter(Boolean).map(cleanRemnoteMarks).join(' › ')}
function profileName(){return state.profile?.display_name||state.user?.email?.split('@')[0]||'MIR'}
let authTransition=null;
async function enterSession(user,{session=null,fresh=false}={}){
 if(!user)return;
 if(authTransition)return authTransition;
 const generation=authGeneration;
 const work=(async()=>{
   if(!session){const result=await state.sb.auth.getSession();session=result.data?.session}
   if(!await window.NexmirSessions.open(session,{fresh})||generation!==authGeneration)return;
   state.user=user;$('#authMsg').textContent='Cargando tu contenido…';
   await loadAll();
   if(generation!==authGeneration||state.user?.id!==user.id||!window.NexmirSessions.active())return;
   showApp();$('#authMsg').textContent='';
 })().finally(()=>{if(authTransition===work)authTransition=null});
 authTransition=work;return work;
}
async function start(){
 initSb();
 let session=null,lastError=null;
 for(let attempt=0;attempt<2&&!session;attempt++){
   if(attempt)await new Promise(resolve=>setTimeout(resolve,350));
   const result=await state.sb.auth.getSession();session=result.data?.session||null;lastError=result.error||null;
 }
 if(lastError&&!session)console.warn('No se pudo recuperar la sesión',lastError);
 if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 state.sb.auth.onAuthStateChange((event,newSession)=>{
   // Never request Supabase work inside the authentication callback/lock.
   if(authBusy)return;
   if(event==='SIGNED_OUT'){const generation=authGeneration;setTimeout(()=>{if(generation!==authGeneration||authBusy)return;window.NexmirSessions.reset();if(state.user)clearSignedInUi('logout','Has cerrado sesión.')},0);return}
   if(!newSession||event==='INITIAL_SESSION')return;
   if(window.NexmirSessions.observe(newSession))return;
   setTimeout(()=>{
     if(authBusy)return;
     if(event==='PASSWORD_RECOVERY')$('#resetPasswordDialog')?.showModal();
     enterSession(newSession.user,{session:newSession,fresh:event==='PASSWORD_RECOVERY'}).catch(e=>{showAuth();$('#authMsg').textContent=e.message});
   },0);
 });
 if(session)await enterSession(session.user,{session});else showAuth();
}
function hideBootScreen(){const boot=$('#bootScreen');if(boot){boot.classList.add('hidden');boot.setAttribute('aria-busy','false')}}
function showStartupError(error){
 const boot=$('#bootScreen');if(!boot)return showAuth();
 boot.classList.remove('hidden');boot.setAttribute('aria-busy','false');
 const card=boot.querySelector('.boot-card');
 card.innerHTML=`<div class="logo-mark">N</div><h2>No pudimos terminar de cargar</h2><p class="muted">Tu sesión sigue abierta. Comprueba la conexión y vuelve a intentarlo para regresar a tu pregunta.</p><button class="btn primary" type="button" onclick="location.reload()">Volver a intentar</button><p class="muted small">${esc(error?.message||'Error temporal de conexión')}</p>`;
}
function showAuth(){hideBootScreen();state.profile=null;$('#adminLink')?.classList.add('hidden');$('#authScreen').classList.remove('hidden');$('#app').classList.add('hidden');const invite=$('#battleInviteAuth'),code=new URLSearchParams(location.search).get('battle');if(invite)invite.classList.toggle('hidden',!/^[a-z0-9]{6}$/i.test(code||''));window.dispatchEvent(new Event('nexmir:signout'))}
function showApp(){ hideBootScreen();$('#adminLink')?.classList.add('hidden');$('#authScreen').classList.add('hidden');$('#app').classList.remove('hidden');const n=profileName();$('#userAvatar').textContent=n[0]?.toUpperCase()||'N';$('#planPill').textContent=(state.profile?.role==='admin'?'Admin':state.profile?.plan||'Free');if(['admin','moderator'].includes(state.profile?.role))$('#adminLink').classList.remove('hidden');const restored=window.nexmirRestoreStudy?.();if(!restored)route('dashboard');window.dispatchEvent(new CustomEvent('nexmir:ready',{detail:{restored:!!restored}}))}
async function safeLoad(label,fn,fallback=[]){try{return await fn()}catch(e){console.warn('Carga opcional falló:',label,e);return fallback}}
async function loadAll(){
 const uid=state.user.id,generation=authGeneration;
 // Empieza las lecturas personales mientras llega el catálogo; ambas son independientes.
 const secondary=Promise.all([
   safeLoad('repasos',()=>fetchAllPages(()=>state.sb.from('user_flashcard_reviews').select('*').eq('user_id',uid))),
   safeLoad('intentos',()=>fetchAllPages(()=>state.sb.from('user_question_attempts').select('*').eq('user_id',uid).order('answered_at',{ascending:false}))),
   safeLoad('marcadas',()=>fetchAllPages(()=>state.sb.from('user_bookmarks').select('*').eq('user_id',uid))),
   safeLoad('notas',()=>fetchAllPages(()=>state.sb.from('user_notes').select('*').eq('user_id',uid))),
   safeLoad('simulaciones',async()=>{const r=await state.sb.from('simulations').select('*').eq('user_id',uid).order('finished_at',{ascending:false}).limit(100);if(r.error)throw r.error;return r.data||[]}),
   safeLoad('registro de errores',()=>fetchAllPages(()=>state.sb.from('user_error_log').select('*').eq('user_id',uid)))
 ]);
 // Datos esenciales: si estos fallan sí debemos informar al usuario.
 const [pr,ct,qs]=await Promise.all([
   state.sb.from('profiles').select('*').eq('id',uid).maybeSingle(),
   fetchAllPages(()=>state.sb.from('content_items').select('id,source_uid,kind,card_type,status,current_version,payload,source_hash,source_path,specialty,topic,subtopic,section,last_reviewed_at,created_at,updated_at').eq('status','published').order('specialty')),
   fetchAllPages(()=>state.sb.from('questions').select('id,source_uid,source_number,source_exam,source,status,stem,options,correct_index,explanation,specialty,topic,subtopic,section,image_path,year,remnote_metadata,created_at,updated_at').eq('status','published').order('created_at',{ascending:false}))
 ]);
 if(generation!==authGeneration||state.user?.id!==uid){await secondary;return}
 if(pr.error)throw pr.error;
 state.profile=pr.data||{id:uid,role:'user',plan:'free',display_name:state.user?.email?.split('@')[0]||'MIR'};
 state.content=(ct||[]).map(repairImportedClassification);
 state.questions=(qs||[]).map(repairImportedClassification);
 // Datos secundarios: nunca deben impedir entrar a la app.
 const [rv,at,bm,nt,sm,el]=await secondary;
 if(generation!==authGeneration||state.user?.id!==uid)return;
 state.reviews=rv||[];state.attempts=at||[];state.bookmarks=bm||[];state.notes=nt||[];state.simulations=sm||[];state.errorLog=el||[];
 updateDueBadge();
 // Las URLs firmadas de imágenes se cargan después y no bloquean el login.
 hydrateQuestionImages().catch(e=>console.warn('Imágenes diferidas',e));
}
async function hydrateQuestionImages(){
 const rows=state.questions.filter(q=>q.image_path);if(!rows.length)return;
 const paths=[...new Set(rows.map(q=>q.image_path))];
 try{const {data,error}=await state.sb.storage.from('question-images').createSignedUrls(paths,43200);if(error)throw error;const map=new Map((data||[]).map(x=>[x.path,x.signedUrl]));state.questions=state.questions.map(q=>q.image_path?{...q,image_url:map.get(q.image_path)||null}:q)}catch(e){console.warn('No pude firmar imágenes de preguntas',e)}
}
function questionImageHtml(q){return q?.image_url?`<div class="question-image-wrap"><img class="question-image" src="${esc(q.image_url)}" alt="Imagen asociada a la pregunta" loading="lazy" onclick="openQuestionImageFromElement(this)" title="Pulsa para ampliar"><button type="button" class="image-zoom-btn" onclick="openQuestionImageFromElement(this.previousElementSibling)">⛶ Ver imagen ampliada</button></div>`:''}
function openQuestionImageFromElement(img){if(!img?.src)return;const d=$('#imageViewerDialog'),v=$('#imageViewerImg');if(!d||!v)return;v.src=img.src;v.alt=img.alt||'Imagen de la pregunta';if(!d.open)d.showModal()}
function closeQuestionImageViewer(){const d=$('#imageViewerDialog'),v=$('#imageViewerImg');if(d?.open)d.close();if(v)v.removeAttribute('src')}

function sourceHierarchyParts(x){
 const raw=[x?.source_path,x?.payload?.source].filter(Boolean).join('/');
 return raw.split('/').map(v=>v.replace(/\.md$/i,'').trim()).filter(Boolean).filter(v=>!/^RemNoteExport/i.test(v));
}
function isSpecialtyContainer(label,specialty){
 if(!label)return false;const n=normText(label),c=normText(canonicalSpecialty(label)),sp=normText(specialty);
 return c===sp||n===sp||(['gastroenterologia','aparato digestivo','digestivo'].includes(n)&&sp==='gastroenterologia');
}
function repairImportedClassification(x){
 if(!x)return x;
 const payload=sanitizePayloadMarks(x.payload||{}),meta=x.remnote_metadata||{};
 const rawSpecialty=!unclassifiedSpecialty(x.specialty)?x.specialty:!unclassifiedSpecialty(payload.specialty)?payload.specialty:null;
 const recovered=RemnoteTaxonomy.classify(payload.context||meta.context||[],x.source_path||payload.source||meta.source_path||'');
 const origin=payload.classification_origin||meta.classification_origin;
 if(!['admin_manual','ai'].includes(origin)&&origin&&!unclassifiedSpecialty(recovered.specialty)&&recovered.classification_origin==='remnote_hierarchy'&&(!rawSpecialty||canonicalSpecialty(rawSpecialty)!==recovered.specialty))return {...x,...recovered,payload:{...payload,...recovered}};
 if(rawSpecialty&&RemnoteTaxonomy.simulationLabel(rawSpecialty)&&origin!=='admin_manual')return {...x,...recovered,payload:{...payload,...recovered}};
 if(rawSpecialty){
   // Published columns and manual corrections are authoritative. Never reinterpret clinical text.
   const specialty=canonicalSpecialty(rawSpecialty),topic=x.topic??payload.topic??'General',subtopic=x.subtopic??payload.subtopic??null,section=x.section??payload.section??null;
   return {...x,payload:{...payload,specialty,topic,subtopic,section,path:[specialty,topic,subtopic,section].filter(Boolean)},specialty,topic,subtopic,section};
 }
 if(unclassifiedSpecialty(recovered.specialty))return {...x,payload,specialty:'Desagrupadas'};
 return {...x,...recovered,payload:{...payload,...recovered}};
}
function updateDueBadge(){const due=dueCards().length;$('#dueBadge').textContent=due;$('#dueBadge').classList.toggle('hidden',!due)}
async function login(){
 if(authBusy)return;authBusy=true;$('#loginBtn').disabled=true;
 const email=$('#loginEmail').value.trim(),password=$('#loginPassword').value;
 $('#authMsg').textContent='Entrando…';
 try{
   const {data,error}=await state.sb.auth.signInWithPassword({email,password});if(error)throw error;
   await enterSession(data.user,{session:data.session,fresh:true});
 }catch(e){console.error('Login NEXMIR',e);showAuth();$('#authMsg').textContent='No se pudo entrar: '+(e.message||e)}
 finally{authBusy=false;$('#loginBtn').disabled=false}
}
async function signup(){
 if(authBusy)return;
 const name=$('#signupName').value.trim(),email=$('#signupEmail').value.trim(),password=$('#signupPassword').value;
 if(password.length<8){$('#authMsg').textContent='Usa al menos 8 caracteres.';return}
 authBusy=true;$('#signupBtn').disabled=true;
 try{
   const {data,error}=await state.sb.auth.signUp({email,password,options:{data:{display_name:name}}});if(error)throw error;
   if(data.user&&data.session){await enterSession(data.user,{session:data.session,fresh:true});await state.sb.from('profiles').update({display_name:name}).eq('id',data.user.id)}
   else $('#authMsg').textContent='Cuenta creada. Revisa tu correo si Supabase solicita confirmación.';
 }catch(e){$('#authMsg').textContent=e.message||String(e)}
 finally{authBusy=false;$('#signupBtn').disabled=false}
}
// Lookup indexes rebuild after a content refresh; attempt calculations no longer scan the bank.
let attemptQuestionIndex;
function getAttemptQuestion(a){
 if(!a)return null;
 const signature=[state.questions,state.content,state.questions.length,state.content.length];
 if(!attemptQuestionIndex||signature.some((v,i)=>v!==attemptQuestionIndex.signature[i])){
  attemptQuestionIndex={signature,formal:new Map(state.questions.map(q=>[String(q.id),q])),content:new Map(state.content.map(x=>[String(x.id),x]))};
 }
 if(a.question_id){const q=attemptQuestionIndex.formal.get(String(a.question_id));if(q)return {...q,_source:'questions'}}
 if(a.source_content_id){
  const x=attemptQuestionIndex.content.get(String(a.source_content_id));if(!x)return null;
  const p=x.payload||{},opts=(p.options||[]).map(o=>typeof o==='string'?o:o.text||'');
  let ci=(p.options||[]).findIndex(o=>o&&typeof o==='object'&&o.correct);
  if(ci<0&&Number.isInteger(p.correct_index))ci=p.correct_index;
  return {id:x.id,specialty:x.specialty,topic:x.topic,subtopic:x.subtopic,section:x.section,stem:p.front||p.question||'',options:opts,correct_index:Math.max(0,ci),explanation:Array.isArray(p.explanation)?p.explanation.join('\n'):(p.explanation||''),_source:'remnote'};
 }
 return null;
}
let routeGeneration=0;
async function runPlanLoading(work,label='Cargando…'){
 const dialog=$('#planLoadingDialog');
 runPlanLoading.pending++;
 if(dialog){dialog.querySelector('h3').textContent=label;dialog.querySelector('p').textContent='Un momento, estamos preparando la vista.';if(!dialog.open)dialog.showModal()}
 try{await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));return await work()}
 finally{if(--runPlanLoading.pending===0)dialog?.close()}
}
runPlanLoading.pending=0;
function route(v){
 const generation=++routeGeneration;
 state.view=v;
 $$('.view').forEach(x=>x.classList.remove('active'));
 const target=$(`#view-${v}`);
 if(target)target.classList.add('active');
 $$('.nav-item[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===v));
 $('#viewTitle').textContent=viewNames[v]||v;$('#crumb').textContent='';
 const paint=async()=>{
  if(generation!==routeGeneration||!state.user)return;
  try{await render(v)}catch(e){
   console.error('Error renderizando vista',v,e);
   if(target&&state.user&&generation===routeGeneration)target.innerHTML=`<div class="card view-error"><h3>No se pudo cargar esta sección</h3><p class="muted">${esc(e?.message||'Error inesperado')}</p><button class="btn" onclick="route('${esc(v)}')">Reintentar</button></div>`;
  }
 };
 const pending=runPlanLoading(paint,'Cargando '+(viewNames[v]||v)+'…');
 document.querySelector('.sidebar')?.classList.remove('open');
 return pending;
}
function render(v){return ({dashboard:renderDashboard,study:renderStudy,reviews:renderReviews,bank:renderBank,simulations:renderSimulations,battles:renderBattles,errors:renderErrors,bookmarks:renderBookmarks,progress:renderProgress,goal:renderGoal,profile:renderProfile}[v]||(()=>{}))()}
function stats(){const cards=studyContent().filter(x=>x.kind==='card'),theory=studyContent().filter(x=>x.kind==='theory'),attempts=state.attempts,correct=attempts.filter(a=>a.is_correct).length;return{cards,theory,attempts,correct,accuracy:attempts.length?Math.round(correct/attempts.length*100):0,due:dueCards().length}}
function level(){const pts=state.attempts.length+state.reviews.reduce((a,r)=>a+(r.repetitions||0),0);if(pts>2000)return'Especialista';if(pts>1000)return'R4';if(pts>500)return'R3';if(pts>200)return'R2';if(pts>50)return'R1';return'R0'}
function renderDashboard(){const s=stats(),weak=weakSpecialties().slice(0,3);$('#view-dashboard').innerHTML=`
<div class="hero"><div class="hero-main"><span class="chip">${level()}</span><h1>Hola, ${esc(profileName())}</h1><p>${state.profile?.goal_specialty?`Objetivo: <strong>${esc(state.profile.goal_specialty)}</strong>${state.profile.target_number?` · Nº < ${esc(state.profile.target_number)}`:''}`:'Configura tu especialidad objetivo y convierte cada sesión en progreso medible.'}</p><div class="hero-actions"><button class="btn primary" onclick="route('reviews')">Repasar ahora (${s.due})</button><button class="btn" onclick="route('bank')">Hacer preguntas</button><button class="btn" onclick="route('study')">Estudiar teoría</button></div></div>
<div class="card"><h3>Tu día</h3><div class="list"><div class="row"><span>Repasos pendientes</span><strong class="accent">${s.due}</strong></div><div class="row"><span>Preguntas respondidas</span><strong>${state.attempts.filter(a=>a.answered_at?.slice(0,10)===today()).length}</strong></div><div class="row"><span>Precisión global</span><strong>${s.accuracy}%</strong></div><div class="row"><span>Flashcards disponibles</span><strong>${s.cards.length}</strong></div></div></div></div>
<div class="grid cols-4"><div class="card"><div class="metric">${s.cards.length}</div><div class="metric-label">Flashcards</div></div><div class="card"><div class="metric">${s.theory.length}</div><div class="metric-label">Bloques de teoría</div></div><div class="card"><div class="metric">${s.attempts.length}</div><div class="metric-label">Preguntas hechas</div></div><div class="card"><div class="metric">${s.accuracy}%</div><div class="metric-label">Aciertos</div></div></div>
<div class="grid cols-2"><div><div class="section-head"><h3>Continuar estudiando</h3><button class="link-btn" onclick="route('study')">Ver todo</button></div><div class="list">${specialtySummary().slice(0,4).map(x=>specialtyRow(x)).join('')||'<div class="empty">Publica contenido desde el Panel Admin.</div>'}</div></div><div><div class="section-head"><h3>Áreas a reforzar</h3></div><div class="card">${weak.length?weak.map(w=>`<div class="statbar"><span>${esc(w.name)}</span><div class="progress-track"><div class="progress-fill" style="width:${w.acc}%"></div></div><strong>${w.acc}%</strong></div>`).join(''):'<p class="muted">Aún no hay suficientes preguntas respondidas para detectar áreas débiles.</p>'}</div></div></div>`}
function specialtySummary(){const map={};for(const x of studyContent()){const s=displaySpecialty(x.specialty);map[s]??={name:s,cards:0,theory:0};map[s][x.kind==='card'?'cards':'theory']++}return Object.values(map).sort((a,b)=>(b.cards+b.theory)-(a.cards+a.theory))}
function specialtyRow(x){return `<div class="list-item clickable" onclick="openSpecialty('${encodeURIComponent(x.name)}')"><div class="type-icon">${esc(x.name[0]||'?')}</div><div class="grow"><strong class="specialty-name">${esc(x.name)}</strong><div class="path">${x.theory} teoría · ${x.cards} flashcards</div></div><span>›</span></div>`}
function renderStudy(){const groups=specialtySummary();$('#view-study').innerHTML=`<div class="section-head"><div><h3>Asignaturas MIR</h3><p class="muted">Teoría y flashcards agrupadas por asignatura. Lo pendiente de clasificación aparece una sola vez en <strong>Desagrupadas</strong>.</p></div><input id="studySearch" style="max-width:280px" placeholder="Buscar especialidad o tema"></div><div id="studyGrid" class="grid cols-3">${groups.map(x=>`<div class="card specialty-card" data-search="${esc(x.name.toLowerCase())}" onclick="openSpecialty('${encodeURIComponent(x.name)}')"><div class="row"><div class="type-icon">${esc(x.name[0]||'?')}</div><span class="chip">${x.cards+x.theory} contenidos</span></div><h3>${esc(x.name)}</h3><p class="muted">${x.theory} bloques de teoría · ${x.cards} flashcards</p></div>`).join('')||'<div class="empty">No hay contenido publicado todavía.</div>'}</div>`;$('#studySearch')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();$$('#studyGrid [data-search]').forEach(x=>x.style.display=x.dataset.search.includes(q)?'':'none')})}
function openSpecialty(encoded){
 const sp=decodeURIComponent(encoded),topics=new Map();
 for(const x of studyContent())if(displaySpecialty(x.specialty)===sp){const t=x.topic||'General';if(!topics.has(t))topics.set(t,{theory:0,card:0});topics.get(t)[x.kind==='card'?'card':'theory']++}
 const mastery=new Map();
 for(const attempt of state.attempts){const q=getAttemptQuestion(attempt);if(!q||displaySpecialty(q.specialty)!==sp)continue;const t=q.topic||'General',m=mastery.get(t)||{total:0,correct:0};m.total++;if(attempt.is_correct)m.correct++;mastery.set(t,m)}
 $('#studyDialogBody').innerHTML=`<div class="dialog-head"><div><span class="chip">Asignatura MIR</span><h2 class="specialty-name">${esc(sp)}</h2></div><button class="icon-btn" onclick="$('#studyDialog').close()">×</button></div><div class="grid cols-2">${[...topics].map(([t,a])=>{const m=mastery.get(t),percent=m?.total?Math.round(m.correct/m.total*100):0;return`<div class="card specialty-card" onclick="openTopic('${encodeURIComponent(sp)}','${encodeURIComponent(t)}')"><h3>${esc(t)}</h3><p class="muted">${a.theory} teoría · ${a.card} flashcards</p><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><div class="path">Dominio estimado ${percent}%</div></div>`}).join('')}</div>`;
 const dialog=$('#studyDialog');if(!dialog.open)dialog.showModal();dialog.scrollTop=0;ensureResizableDialog(dialog)
}
function openTopic(es,et){const sp=decodeURIComponent(es),t=decodeURIComponent(et),items=studyContent().filter(x=>displaySpecialty(x.specialty)===sp&&(x.topic||'General')===t),subs=new Map();for(const x of items){const name=x.subtopic||'General';subs.set(name,(subs.get(name)||0)+1)}$('#studyDialogBody').innerHTML=`<div class="dialog-head"><div><button class="link-btn" onclick="openSpecialty('${encodeURIComponent(sp)}')">← ${esc(sp)}</button><h2>${esc(t)}</h2></div><button class="icon-btn" onclick="$('#studyDialog').close()">×</button></div><div class="seg"><button class="active" onclick="topicTab(this,'all')">Todo</button><button onclick="topicTab(this,'theory')">Teoría</button><button onclick="topicTab(this,'card')">Flashcards</button></div><div id="topicItems" class="list" style="margin-top:15px">${items.map(contentRow).join('')}</div><div class="section-head"><h3>Subtemas</h3></div><div class="grid cols-3">${[...subs].map(([s,count])=>`<div class="card"><strong>${esc(s)}</strong><div class="path">${count} contenidos</div></div>`).join('')}</div>`;const dialog=$('#studyDialog');if(!dialog.open)dialog.showModal();ensureResizableDialog(dialog);state.studyPath={sp,t,items}}
function topicTab(btn,kind){btn.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$('#topicItems').innerHTML=state.studyPath.items.filter(x=>kind==='all'||x.kind===kind).map(contentRow).join('')}
function contentRow(x){const p=x.payload||{},title=x.kind==='theory'?(p.context?.at(-1)||p.text?.split('\n')[0]||'Teoría'):(p.front||'Flashcard');return`<div data-content-id="${esc(x.id)}" class="list-item clickable" onclick="openContent('${x.id}')"><div class="type-icon">${x.kind==='theory'?'T':'F'}</div><div class="grow"><strong>${mdInline(title).slice(0,240)}</strong><div class="path">${esc(pathOf(x))}</div></div><span class="chip">${x.kind==='theory'?'Teoría':typeLabel(x.card_type||p.type)}</span></div>`}
function typeLabel(t){return({basic:'Básica',multiple_choice:'Opción múltiple',multiline:'Multilínea',ordered:'Ordenada',cloze:'Cloze',reverse:'Reversa',bidirectional:'Bidireccional'}[t]||'Flashcard')}
function openContent(id){const x=state.content.find(x=>x.id===id);if(!x)return;const p=x.payload||{};if(x.kind==='card'){startSingleCard(x);return}$('#studyDialogBody').innerHTML=`<div class="dialog-head"><div><span class="chip">Teoría</span><h2>${esc(p.context?.at(-1)||x.topic||'Teoría')}</h2><div class="path">${esc(pathOf(x))}</div></div><button class="icon-btn" onclick="$('#studyDialog').close()">×</button></div><div class="theory-body">${renderTheoryPayload(p)}</div><div class="dialog-actions"><button class="btn" onclick="toggleBookmark('content','${x.id}')">★ Marcar</button></div>`;$('#studyDialog').showModal();ensureResizableDialog($('#studyDialog'))}
function reviewMap(){return Object.fromEntries(state.reviews.map(r=>[r.content_id,r]))}
function isStudyContent(x){return !NexmirContentRules.isMultipleChoice(x)||!RemnoteTaxonomy.simulationContent(x)}
function studyContent(){return state.content.filter(isStudyContent)}
function dueCards(){const rm=reviewMap(),now=Date.now();return studyContent().filter(x=>x.kind==='card').filter(x=>{const r=rm[x.id];return !r||!r.next_review_at||new Date(r.next_review_at).getTime()<=now})}
function reviewSpecialties(){return [...new Set(dueCards().map(x=>displaySpecialty(x.specialty)))].sort((a,b)=>a.localeCompare(b,'es'))}
function reviewFilteredDue(){let cards=dueCards();const sp=$('#reviewSpecialty')?.value||'',topic=$('#reviewTopic')?.value||'',sub=$('#reviewSubtopic')?.value||'';if(sp)cards=cards.filter(x=>displaySpecialty(x.specialty)===sp);if(topic)cards=cards.filter(x=>(x.topic||'General')===topic);if(sub)cards=cards.filter(x=>(x.subtopic||'General')===sub);return cards}
function refreshReviewTopics(){const sp=$('#reviewSpecialty')?.value||'',old=$('#reviewTopic')?.value||'';let cards=dueCards();if(sp)cards=cards.filter(x=>displaySpecialty(x.specialty)===sp);const topics=[...new Set(cards.map(x=>x.topic||'General'))].sort((a,b)=>a.localeCompare(b,'es'));const el=$('#reviewTopic');if(el){el.innerHTML='<option value="">Todos los temas</option>'+topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');if(topics.includes(old))el.value=old}refreshReviewSubtopics()}
function refreshReviewSubtopics(){const sp=$('#reviewSpecialty')?.value||'',topic=$('#reviewTopic')?.value||'',old=$('#reviewSubtopic')?.value||'';let cards=dueCards();if(sp)cards=cards.filter(x=>displaySpecialty(x.specialty)===sp);if(topic)cards=cards.filter(x=>(x.topic||'General')===topic);const subs=[...new Set(cards.map(x=>x.subtopic||'General'))].sort((a,b)=>a.localeCompare(b,'es'));const el=$('#reviewSubtopic');if(el){el.innerHTML='<option value="">Todos los subtemas</option>'+subs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');if(subs.includes(old))el.value=old}updateReviewFilterCount()}
function updateReviewFilterCount(){const n=reviewFilteredDue().length,el=$('#reviewFilteredCount'),btn=$('#startReviewBtn');if(el)el.textContent=`${n} tarjetas en esta selección`;if(btn)btn.disabled=!n}
function renderReviews(){const due=dueCards(),specs=reviewSpecialties();$('#view-reviews').innerHTML=`<div class="hero-main"><span class="chip">Repaso espaciado</span><h1>${due.length} tarjetas pendientes</h1><p>Elige especialidad, tema y subtema. Tus valoraciones <strong>Otra vez / Difícil / Bien / Fácil</strong> programan automáticamente el siguiente active recall.</p><div class="grid cols-3 review-filters"><label>Asignatura MIR<select id="reviewSpecialty" onchange="refreshReviewTopics()"><option value="">Todas las asignaturas</option>${specs.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label><label>Tema<select id="reviewTopic" onchange="refreshReviewSubtopics()"><option value="">Todos los temas</option></select></label><label>Subtema<select id="reviewSubtopic" onchange="updateReviewFilterCount()"><option value="">Todos los subtemas</option></select></label></div><div class="row review-start"><span id="reviewFilteredCount" class="muted">${due.length} tarjetas en esta selección</span><button id="startReviewBtn" class="btn primary" ${due.length?'':'disabled'} onclick="startReview()">Empezar repaso</button></div></div><div class="grid cols-3" style="margin-top:16px"><div class="card"><div class="metric">${due.length}</div><div class="metric-label">Pendientes hoy</div></div><div class="card"><div class="metric">${state.reviews.length}</div><div class="metric-label">Tarjetas estudiadas</div></div><div class="card"><div class="metric">${state.reviews.filter(r=>(r.repetitions||0)>=3).length}</div><div class="metric-label">Consolidándose</div></div></div>`;refreshReviewTopics()}
function startReview(){const pool=reviewFilteredDue();if(!pool.length)return toast('No hay tarjetas pendientes para esos filtros');state.review={pool:pool.sort(()=>Math.random()-.5),index:0,revealed:false};showReviewCard()}
function startSingleCard(x){state.review={pool:[x],index:0,revealed:false};showReviewCard()}
function formatDueInterval(ms){if(ms<3600000)return `${Math.max(1,Math.round(ms/60000))} min`;if(ms<86400000)return `${Math.round(ms/3600000)} h`;const d=Math.round(ms/86400000);return `${d} día${d===1?'':'s'}`}
function reviewSchedulePreview(old){const reps=old?.repetitions||0,interval=Math.max(0,old?.interval_days||0),ease=Number(old?.ease_factor||2.5);return{
  1:{label:'10 min',ms:10*60000},
  2:{label:formatDueInterval((interval?Math.max(1,Math.round(interval*.7)):1)*86400000),ms:(interval?Math.max(1,Math.round(interval*.7)):1)*86400000},
  3:{label:formatDueInterval((reps===0?3:reps===1?7:Math.max(1,Math.round(Math.max(1,interval)*ease)))*86400000),ms:(reps===0?3:reps===1?7:Math.max(1,Math.round(Math.max(1,interval)*ease)))*86400000},
  4:{label:formatDueInterval((reps===0?7:reps===1?14:Math.max(1,Math.round(Math.max(1,interval)*ease*1.3)))*86400000),ms:(reps===0?7:reps===1?14:Math.max(1,Math.round(Math.max(1,interval)*ease*1.3)))*86400000}
}}
function showReviewCard(){const x=state.review.pool[state.review.index];if(!x){$('#cardDialog').close();toast('Repaso completado');updateDueBadge();renderReviews();return}const p=x.payload||{},old=state.reviews.find(r=>r.content_id===x.id),sched=reviewSchedulePreview(old),answer=state.review.revealed?`<section class="flash-answer-panel"><div class="flash-panel-label">Respuesta</div><div class="flash-back">${cardAnswer(p)}</div><div class="rating-grid"><button class="btn danger" onclick="rateCard(1)"><strong>0</strong><span>Otra vez</span><small>${sched[1].label}</small></button><button class="btn" onclick="rateCard(2)"><strong>1</strong><span>Difícil</span><small>${sched[2].label}</small></button><button class="btn primary" onclick="rateCard(3)"><strong>2</strong><span>Bien</span><small>${sched[3].label}</small></button><button class="btn violet-btn" onclick="rateCard(4)"><strong>3</strong><span>Fácil</span><small>${sched[4].label}</small></button></div><p class="flash-shortcuts">Teclado: 0–3 para programar el próximo repaso.</p></section>`:`<section class="flash-reveal-panel"><p>Recupera la respuesta antes de voltearla.</p><button class="btn primary full" onclick="revealCard()">Mostrar respuesta <span aria-hidden="true">→</span></button></section>`;$('#cardDialogBody').innerHTML=`<div class="dialog-head flash-dialog-head"><div><span class="chip">${typeLabel(x.card_type||p.type)}</span><div class="path">${esc(pathOf(x))}</div></div><button class="icon-btn" aria-label="Cerrar flashcard" onclick="$('#cardDialog').close()">×</button></div>${state.profile?.role==='admin'?'<div class="flash-admin-actions"><button id="reviewAdminDelete" class="btn danger" onclick="deleteReviewCardAsAdmin()">Eliminar flashcard</button></div>':''}<main class="flash-study-layout"><section class="flash-prompt-panel"><div class="flash-panel-label">Pregunta</div><div class="flash-front">${mdInline(p.front||'')}</div></section>${answer}</main>`;const d=$('#cardDialog');if(!d.open)d.showModal();d.scrollTop=0;$('#cardDialogBody').scrollTop=0;ensureResizableDialog(d)}
function revealCard(){state.review.revealed=true;showReviewCard()}
async function rateCard(q){if(state.review.saving)return;state.review.saving=true;const x=state.review.pool[state.review.index],old=state.reviews.find(r=>r.content_id===x.id);let reps=old?.repetitions||0,interval=Math.max(0,old?.interval_days||0),ease=Number(old?.ease_factor||2.5),nextMs;
 if(q===1){reps=0;interval=0;ease=Math.max(1.3,ease-.2);nextMs=10*60000}
 else if(q===2){reps=Math.max(1,reps);interval=interval?Math.max(1,Math.round(interval*.7)):1;ease=Math.max(1.3,ease-.12);nextMs=interval*86400000}
 else if(q===3){reps++;interval=reps===1?3:reps===2?7:Math.max(1,Math.round(Math.max(1,interval)*ease));ease=Math.max(1.3,ease+.03);nextMs=interval*86400000}
 else {reps++;interval=reps===1?7:reps===2?14:Math.max(1,Math.round(Math.max(1,interval)*ease*1.3));ease=Math.max(1.3,ease+.12);nextMs=interval*86400000}
 const next=new Date(Date.now()+nextMs).toISOString();const row={user_id:state.user.id,content_id:x.id,repetitions:reps,interval_days:interval,ease_factor:ease,last_rating:q,last_reviewed_at:new Date().toISOString(),next_review_at:next};const {error}=await state.sb.from('user_flashcard_reviews').upsert(row,{onConflict:'user_id,content_id'});if(error){state.review.saving=false;console.error('review save',error,row);toast('No se pudo guardar el repaso: '+error.message);return}
 const idx=state.reviews.findIndex(r=>r.content_id===x.id);if(idx>=0)state.reviews=state.reviews.map((r,i)=>i===idx?{...r,...row}:r);else state.reviews=[...state.reviews,row];
 if(q===1){const insertAt=Math.min(state.review.pool.length,state.review.index+4);state.review.pool.splice(insertAt,0,x)}
 state.review.index++;state.review.revealed=false;state.review.saving=false;showReviewCard()}
function questionPool(){
 const formal=state.questions.filter(NexmirContentRules.validTest).map(q=>({...q,explanation:q.explanation||'',_source:'questions'}));
 const remnote=state.content
  .filter(x=>x.kind==='card'&&(x.card_type==='multiple_choice'||x.payload?.type==='multiple_choice'))
  .map(x=>({
   id:x.id,
   specialty:x.specialty,
   topic:x.topic,
   subtopic:x.subtopic,
   section:x.section,
   stem:x.payload?.front||'',
   options:(x.payload?.options||[]).map(o=>typeof o==='string'?o:o.text||''),
   correct_index:(x.payload?.options||[]).findIndex(o=>o.correct),
   explanation:Array.isArray(x.payload?.explanation)?x.payload.explanation.join('\n'):(x.payload?.explanation||''),
   content_use:RemnoteTaxonomy.simulationContent(x)?'simulation':'study',
   source_path:x.source_path||x.payload?.source,
   _source:'remnote'
  }));
 // Todas las MCQ publicadas desde RemNote entran directamente al banco.
 // Si la misma pregunta también existe en questions, se evita mostrarla duplicada.
 const norm=v=>(v||'').toString().toLowerCase().replace(/<[^>]*>/g,' ').replace(/[*_`#>|]/g,' ').replace(/\s+/g,' ').trim();
 const sig=q=>norm(q.stem||q.question)+'||'+(q.options||[]).map(o=>norm(typeof o==='string'?o:o.text||'')).join('||');
 const seen=new Map();
 const out=[];
 for(const q of [...formal,...remnote].filter(NexmirContentRules.validTest)){q._simulationOrigin=RemnoteTaxonomy.simulationContent(q);q._aliases=[`${q._source}:${q.id}`];const k=sig(q);if(k&&seen.has(k)){seen.get(k)._simulationOrigin ||= q._simulationOrigin;seen.get(k)._aliases.push(...q._aliases);continue}if(k)seen.set(k,q);out.push(q)}
 return out
}

const MIR_SPECIALTIES=[
'Cardiología','Gastroenterología','Neurología','Neumología','Enfermedades Infecciosas','Endocrinología y Nutrición','Nefrología','Hematología','Reumatología','Pediatría','Ginecología y Obstetricia','Psiquiatría','Epidemiología y Medicina Preventiva','Dermatología','Traumatología','Urología','Otorrinolaringología','Oftalmología','Oncología Médica','Geriatría y Cuidados Paliativos','Radiología y Urgencias','Cirugía General','Farmacología','Inmunología y Genética','Bioética y Medicina Legal'
];

// Especialidades MIR (Medicina) de la convocatoria 2026/2027. Las plazas suman 9.676.
// close2026 = último número de orden nacional conocido (cuando la especialidad se agotó y hay dato consolidado).
// avgNetas2025 = media aproximada de netas de quienes eligieron esa especialidad en 2025; NO es nota de corte.
const MIR_RESIDENCY_SPECIALTIES=[
{name:'Alergología',places:82,close2026:null,avgNetas2025:92.65,slug:'alergologia'},
{name:'Análisis Clínicos',places:10,close2026:9519,avgNetas2025:66.93,slug:'analisis-clinicos'},
{name:'Anatomía Patológica',places:139,close2026:8892,avgNetas2025:88.92,slug:'anatomia-patologica'},
{name:'Anestesiología y Reanimación',places:439,close2026:4525,avgNetas2025:114.87,slug:'anestesiologia-y-reanimacion'},
{name:'Angiología y Cirugía Vascular',places:60,close2026:5297,avgNetas2025:103.08,slug:'angiologia-y-cirugia-vascular'},
{name:'Aparato Digestivo',places:222,close2026:4468,avgNetas2025:110.77,slug:'aparato-digestivo'},
{name:'Bioquímica Clínica',places:1,close2026:null,avgNetas2025:66.92,slug:'bioquimica-clinica'},
{name:'Cardiología',places:209,close2026:2490,avgNetas2025:126.02,slug:'cardiologia'},
{name:'Cirugía Cardiovascular',places:25,close2026:5427,avgNetas2025:102.70,slug:'cirugia-cardiovascular'},
{name:'Cirugía General y del Aparato Digestivo',places:255,close2026:5137,avgNetas2025:104.20,slug:'cirugia-general-y-del-aparato-digestivo'},
{name:'Cirugía Oral y Maxilofacial',places:46,close2026:2310,avgNetas2025:121.88,slug:'cirugia-oral-y-maxilofacial'},
{name:'Cirugía Ortopédica y Traumatología',places:320,close2026:3832,avgNetas2025:112.48,slug:'cirugia-ortopedica-y-traumatologia'},
{name:'Cirugía Pediátrica',places:21,close2026:5014,avgNetas2025:106.11,slug:'cirugia-pediatrica'},
{name:'Cirugía Plástica, Estética y Reparadora',places:55,close2026:632,avgNetas2025:134.92,slug:'cirugia-plastica-estetica-y-reparadora'},
{name:'Cirugía Torácica',places:29,close2026:5596,avgNetas2025:99.64,slug:'cirugia-toracica'},
{name:'Dermatología Médico-Quirúrgica y Venereología',places:144,close2026:486,avgNetas2025:137.82,slug:'dermatologia-medico-quirurgica-y-venereologia'},
{name:'Endocrinología y Nutrición',places:120,close2026:2752,avgNetas2025:118.62,slug:'endocrinologia-y-nutricion'},
{name:'Farmacología Clínica',places:25,close2026:9524,avgNetas2025:68.65,slug:'farmacologia-clinica'},
{name:'Geriatría',places:128,close2026:9588,avgNetas2025:78.48,slug:'geriatria'},
{name:'Hematología y Hemoterapia',places:173,close2026:null,avgNetas2025:103.97,slug:'hematologia-y-hemoterapia'},
{name:'Inmunología',places:23,close2026:null,avgNetas2025:87.33,slug:'inmunologia'},
{name:'Medicina Familiar y Comunitaria',places:2557,close2026:null,avgNetas2025:60.35,slug:'medicina-familiar-y-comunitaria'},
{name:'Medicina Física y Rehabilitación',places:163,close2026:null,avgNetas2025:93.64,slug:'medicina-fisica-y-rehabilitacion'},
{name:'Medicina Intensiva',places:235,close2026:7832,avgNetas2025:92.79,slug:'medicina-intensiva'},
{name:'Medicina Interna',places:444,close2026:8460,avgNetas2025:94.40,slug:'medicina-interna'},
{name:'Medicina Legal y Forense',places:24,close2026:6885,avgNetas2025:96.30,slug:'medicina-legal-y-forense'},
{name:'Medicina Nuclear',places:68,close2026:7697,avgNetas2025:82.04,slug:'medicina-nuclear'},
{name:'Medicina Preventiva y Salud Pública',places:128,close2026:11974,avgNetas2025:66.18,slug:'medicina-preventiva-y-salud-publica'},
{name:'Medicina de Urgencias y Emergencias',places:279,close2026:8861,avgNetas2025:null,slug:'medicina-de-urgencias-y-emergencias'},
{name:'Medicina del Trabajo',places:140,close2026:10555,avgNetas2025:63.75,slug:'medicina-del-trabajo'},
{name:'Microbiología y Parasitología',places:37,close2026:9606,avgNetas2025:66.39,slug:'microbiologia-y-parasitologia'},
{name:'Nefrología',places:119,close2026:null,avgNetas2025:94.28,slug:'nefrologia'},
{name:'Neumología',places:173,close2026:6842,avgNetas2025:95.61,slug:'neumologia'},
{name:'Neurocirugía',places:52,close2026:4882,avgNetas2025:112.14,slug:'neurocirugia'},
{name:'Neurofisiología Clínica',places:68,close2026:null,avgNetas2025:82.72,slug:'neurofisiologia-clinica'},
{name:'Neurología',places:202,close2026:6036,avgNetas2025:110.13,slug:'neurologia'},
{name:'Obstetricia y Ginecología',places:293,close2026:4521,avgNetas2025:112.13,slug:'obstetricia-y-ginecologia'},
{name:'Oftalmología',places:243,close2026:2069,avgNetas2025:120.45,slug:'oftalmologia'},
{name:'Oncología Médica',places:193,close2026:null,avgNetas2025:103.24,slug:'oncologia-medica'},
{name:'Oncología Radioterápica',places:78,close2026:null,avgNetas2025:88.14,slug:'oncologia-radioterapica'},
{name:'Otorrinolaringología',places:127,close2026:2756,avgNetas2025:116.69,slug:'otorrinolaringologia'},
{name:'Pediatría y Sus Áreas Específicas',places:536,close2026:5612,avgNetas2025:106.88,slug:'pediatria-y-sus-areas-especificas'},
{name:'Psiquiatría',places:345,close2026:7023,avgNetas2025:95.22,slug:'psiquiatria'},
{name:'Psiquiatría Infantil y de la Adolescencia',places:57,close2026:null,avgNetas2025:96.06,slug:'psiquiatria-infantil-y-de-la-adolescencia'},
{name:'Radiodiagnóstico',places:324,close2026:5167,avgNetas2025:104.99,slug:'radiodiagnostico'},
{name:'Reumatología',places:102,close2026:5539,avgNetas2025:103.45,slug:'reumatologia'},
{name:'Urología',places:163,close2026:4221,avgNetas2025:113.47,slug:'urologia'}
];


// Atajos de teclado para repaso y preguntas de opción múltiple.
function nexmirNumericShortcut(event){
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.repeat)return;
  const t=event.target,tag=t?.tagName?.toLowerCase();
  if(tag==='textarea'||tag==='select'||t?.isContentEditable||(tag==='input'&&!['radio','checkbox','button','submit'].includes(t.type)))return;
  if(document.querySelector('#focusSessionDialog[open],#selectPickerDialog[open],#planLoadingDialog[open],#imageViewerDialog[open]'))return;
  const key=/^Digit[1-9]$|^Numpad[1-9]$/.test(event.code)?event.code.slice(-1):event.key;
  const card=$('#cardDialog');
  if(card?.open&&state.review?.pool?.[state.review.index]){
    if(!state.review.revealed)return;
    if(['0','1','2','3'].includes(key)){event.preventDefault();rateCard(Number(key)+1);return}
  }
  const qd=$('#questionDialog');
  if(qd?.open&&qd.querySelector('#bankStem')&&state.bank?.pool?.[state.bank.index]){
    const n=Number(key),q=state.bank.pool[state.bank.index];
    if(Number.isInteger(n)&&n>=1&&n<=(q.options||[]).length&&n<=9){event.preventDefault();selectOption(n-1);return}
  }
  const sd=$('#simDialog');
  if(sd?.open&&state.simulation?.active&&state.simulation?.pool?.[state.simulation.index]){
    const n=Number(key),q=state.simulation.pool[state.simulation.index];
    if(Number.isInteger(n)&&n>=1&&n<=(q.options||[]).length&&n<=9){event.preventDefault();chooseSimulationOption(n-1);return}
  }
  if(state.view==='battles'&&state.battle?.started){
    const q=state.battle?.pool?.[state.battle.index],n=Number(key);
    if(q&&Number.isInteger(n)&&n>=1&&n<=(q.options||[]).length&&n<=9){event.preventDefault();answerBattle(n-1)}
  }
}
document.addEventListener('keydown',nexmirNumericShortcut,true);

// Catálogo local de centros docentes verificados en la convocatoria 2027 (núcleo inicial nacional).
// El botón “Ver todos los centros 2027” abre el catálogo completo de la especialidad, que es la referencia exhaustiva.
const MIR_CENTER_CATALOG=[
['C.H. Torrecárdenas','Almería','Andalucía'],['H. Universitario Puerta del Mar','Cádiz','Andalucía'],['H. Universitario Reina Sofía','Córdoba','Andalucía'],['H. Universitario San Cecilio','Granada','Andalucía'],['H. Universitario Virgen de las Nieves','Granada','Andalucía'],['H. Juan Ramón Jiménez','Huelva','Andalucía'],['H. Universitario de Jaén','Jaén','Andalucía'],['H. de Jerez de la Frontera','Jerez de la Frontera','Andalucía'],['H. Costa del Sol','Marbella','Andalucía'],['H. Regional Universitario de Málaga','Málaga','Andalucía'],['H. Universitario Virgen de la Victoria','Málaga','Andalucía'],['H. Universitario de Puerto Real','Puerto Real','Andalucía'],['H. Universitario Ntra. Sra. de Valme','Sevilla','Andalucía'],['H. Universitario Virgen del Rocío','Sevilla','Andalucía'],['H. Universitario Virgen Macarena','Sevilla','Andalucía'],
['H. Clínico Universitario Lozano Blesa','Zaragoza','Aragón'],['H. Universitario Miguel Servet','Zaragoza','Aragón'],
['C.H. Doctor Negrín','Las Palmas de Gran Canaria','Canarias'],['C.H. Universitario Insular Materno-Infantil','Las Palmas de Gran Canaria','Canarias'],['H. Universitario de Canarias','San Cristóbal de La Laguna','Canarias'],['H. Universitario Nuestra Señora de la Candelaria','Santa Cruz de Tenerife','Canarias'],
['H. Universitario Marqués de Valdecilla','Santander','Cantabria'],
['Complejo Asistencial Universitario de Burgos','Burgos','Castilla y León'],['Complejo Asistencial Universitario de León','León','Castilla y León'],['Complejo Asistencial Universitario de Salamanca','Salamanca','Castilla y León'],['H. Clínico Universitario de Valladolid','Valladolid','Castilla y León'],['H. Universitario del Río Hortega','Valladolid','Castilla y León'],
['Área Especializada de Albacete','Albacete','Castilla-La Mancha'],['H. General Universitario de Ciudad Real','Ciudad Real','Castilla-La Mancha'],['H. General Universitario de Guadalajara','Guadalajara','Castilla-La Mancha'],['C.H. Universitario de Toledo','Toledo','Castilla-La Mancha'],
['H. Universitari Germans Trias i Pujol','Badalona','Cataluña'],['H. Clínic de Barcelona','Barcelona','Cataluña'],['H. de la Santa Creu i Sant Pau','Barcelona','Cataluña'],['H. del Mar - Parc de Salut Mar','Barcelona','Cataluña'],['H. Universitario Vall d’Hebron','Barcelona','Cataluña'],['H. Universitari de Girona Doctor Josep Trueta','Girona','Cataluña'],['H. Universitari de Bellvitge','L’Hospitalet de Llobregat','Cataluña'],['H. Universitari Arnau de Vilanova de Lleida','Lleida','Cataluña'],['Corporació Sanitària Parc Taulí','Sabadell','Cataluña'],['H. Universitari de Tarragona Joan XXIII','Tarragona','Cataluña'],
['H. Universitario Príncipe de Asturias','Alcalá de Henares','Comunidad de Madrid'],['H. Universitario Fundación Alcorcón','Alcorcón','Comunidad de Madrid'],['H. Universitario de Fuenlabrada','Fuenlabrada','Comunidad de Madrid'],['H. Universitario de Getafe','Getafe','Comunidad de Madrid'],['H. Universitario Severo Ochoa','Leganés','Comunidad de Madrid'],['H. General Universitario Gregorio Marañón','Madrid','Comunidad de Madrid'],['H. Universitario 12 de Octubre','Madrid','Comunidad de Madrid'],['H. Universitario Clínico San Carlos','Madrid','Comunidad de Madrid'],['H. Universitario de La Princesa','Madrid','Comunidad de Madrid'],['H. Universitario Fundación Jiménez Díaz','Madrid','Comunidad de Madrid'],['H. Universitario La Paz','Madrid','Comunidad de Madrid'],['H. Universitario Ramón y Cajal','Madrid','Comunidad de Madrid'],['H. Universitario Puerta de Hierro','Majadahonda','Comunidad de Madrid'],['H. Universitario Rey Juan Carlos','Móstoles','Comunidad de Madrid'],['H. Universitario Infanta Sofía','San Sebastián de los Reyes','Comunidad de Madrid'],
['H. General Universitario de Alicante','Alicante','Comunitat Valenciana'],['H. General Universitario de Castellón','Castellón','Comunitat Valenciana'],['H. General Universitario de Elche','Elche','Comunitat Valenciana'],['H. Universitario del Vinalopó','Elche','Comunitat Valenciana'],['H. Universitario de Sant Joan','Sant Joan d’Alacant','Comunitat Valenciana'],['H. Clínico Universitario de Valencia','Valencia','Comunitat Valenciana'],['H. General Universitario de Valencia','Valencia','Comunitat Valenciana'],['H. Universitari i Politècnic La Fe','Valencia','Comunitat Valenciana'],['H. Universitario Doctor Peset','Valencia','Comunitat Valenciana'],
['C.H. Universitario de Badajoz','Badajoz','Extremadura'],['C.H. Universitario de Cáceres','Cáceres','Extremadura'],['C.H. de Mérida','Mérida','Extremadura'],
['C.H. Universitario A Coruña','A Coruña','Galicia'],['C.H. Universitario de Lugo','Lugo','Galicia'],['C.H. Universitario de Pontevedra','Pontevedra','Galicia'],['C.H. Universitario de Santiago de Compostela','Santiago de Compostela','Galicia'],['C.H. Universitario de Vigo - EOXI Vigo','Vigo','Galicia'],
['H. Universitario Son Espases','Palma de Mallorca','Illes Balears'],['H. de San Pedro','Logroño','La Rioja'],['Clínica Universidad de Navarra','Pamplona','Navarra'],['H. Universitario de Navarra','Pamplona','Navarra'],
['H. Universitario Cruces','Barakaldo','País Vasco'],['H. Universitario Basurto','Bilbao','País Vasco'],['H. Universitario Donostia','San Sebastián','País Vasco'],['H. Galdakao-Usansolo','Galdakao','País Vasco'],['H. Universitario Araba','Vitoria-Gasteiz','País Vasco'],
['H. Universitario de Cabueñes','Gijón','Principado de Asturias'],['H. Universitario Central de Asturias','Oviedo','Principado de Asturias'],
['C.H. Universitario Sta. Mª del Rosell - Sta. Lucía','Cartagena','Región de Murcia'],['H. Clínico Universitario Virgen de la Arrixaca','Murcia','Región de Murcia']
].map(([name,city,community])=>({name,city,community}));

const MIR_SCORE_FACTORS_2026={exam:0.19676432006,baremo:1.13419834860};

// Pesos orientativos para que el simulacro se parezca al patrón MIR reciente.
// Se normalizan contra las preguntas realmente disponibles, por lo que no son cuotas rígidas.
const MIR_WEIGHTS={
'Gastroenterología':20,'Cardiología':19,'Neurología':15,'Enfermedades Infecciosas':12,'Neumología':10,'Endocrinología y Nutrición':10,'Ginecología y Obstetricia':10,'Pediatría':10,'Hematología':9,'Nefrología':8,'Epidemiología y Medicina Preventiva':8,'Reumatología':7,'Geriatría y Cuidados Paliativos':7,'Radiología y Urgencias':10,'Psiquiatría':6,'Urología':5,'Traumatología':5,'Oncología Médica':5,'Cirugía General':6,'Dermatología':4,'Otorrinolaringología':4,'Oftalmología':4,'Farmacología':3,'Inmunología y Genética':3,'Bioética y Medicina Legal':4
};
function normText(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function canonicalSpecialty(name=''){return RemnoteTaxonomy.canonical(name)}
function detectedSpecialties(){const names=[...state.content.map(x=>x.specialty),...questionPool().map(x=>x.specialty)].filter(Boolean);return [...new Set(names)].sort((a,b)=>a.localeCompare(b,'es'))}
function specialtyQuestionCount(sp){return questionPool().filter(q=>q.specialty===sp||canonicalSpecialty(q.specialty)===canonicalSpecialty(sp)).length}
function selectedBankSpecialties(){return $$('.bank-sp:checked').map(x=>x.value)}
function selectBankSpecs(all){$$('.bank-sp').forEach(x=>x.checked=all&&!x.disabled)}
function filterBankSpecialties(value){const query=normText(value.trim());let visible=0;$$('#bankSpecialties .bank-specialty').forEach(x=>{const show=x.dataset.search.includes(query);x.hidden=!show;if(show)visible++});$('#bankSearchEmpty')?.classList.toggle('hidden',visible>0)}
function updateBankSelection(){const n=selectedBankSpecialties().length,el=$('#bankSelectionSummary');if(el)el.textContent=n?`${n} especialidad${n===1?'':'es'} seleccionada${n===1?'':'s'}`:'Ninguna seleccionada';const start=$('#startBankBtn');if(start)start.disabled=!n}
function bankTopicsFor(specs){let pool=questionPool();if(specs.length)pool=pool.filter(q=>specs.some(s=>q.specialty===s||canonicalSpecialty(q.specialty)===canonicalSpecialty(s)));return [...new Set(pool.map(q=>q.topic).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))}
function refreshBankTopics(){updateBankSelection();const box=$('#bankTopics');if(!box)return;const specs=selectedBankSpecialties(),topics=specs.length?bankTopicsFor(specs):[];box.innerHTML=topics.length?topics.map(t=>`<label class="check-card"><input class="bank-topic" type="checkbox" value="${esc(t)}" checked><span class="grow">${esc(t)}</span></label>`).join(''):`<div class="empty">${specs.length?'No hay temas con preguntas para esta selección.':'Selecciona una o más especialidades para elegir los temas.'}</div>`}
function renderBank(){const pool=questionPool(),det=detectedSpecialties();const specialties=[...new Set(det.map(displaySpecialty))],counts=new Map();for(const q of pool){const sp=displaySpecialty(q.specialty);counts.set(sp,(counts.get(sp)||0)+1)}$('#view-bank').innerHTML=`<div class="hero-main"><span class="chip">Banqueo MIR</span><h1>Banquea por especialidades y temas</h1><p>Las especialidades se extraen de tu RemNote/Supabase. Puedes mezclar varias y luego elegir los temas disponibles.</p><div class="bank-selector-head"><div><h3>Elige tus especialidades</h3><p class="muted small">Selecciona una o varias tarjetas para combinarlas.</p></div><span id="bankSelectionSummary" class="chip" aria-live="polite">Ninguna seleccionada</span></div><div class="bank-selector-tools"><label class="bank-search"><span class="sr-only">Buscar especialidad</span><input id="bankSpecialtySearch" type="search" placeholder="Buscar especialidad…" oninput="filterBankSpecialties(this.value)"></label><div class="filter-actions"><button class="btn" onclick="selectBankSpecs(true);refreshBankTopics()">Seleccionar disponibles</button><button class="btn" onclick="selectBankSpecs(false);refreshBankTopics()">Limpiar</button></div></div><div id="bankSpecialties" class="check-grid bank-specialties">${specialties.map(sp=>`<label class="check-card bank-specialty ${counts.get(sp)?'':'unavailable'}" data-search="${esc(normText(sp))}"><input class="bank-sp" type="checkbox" value="${esc(sp)}" ${counts.get(sp)?'':'disabled'} onchange="refreshBankTopics()"><span class="bank-spec-icon" aria-hidden="true">${esc(sp.slice(0,2).toUpperCase())}</span><span class="grow"><strong>${esc(sp)}</strong><small>${counts.get(sp)||0} preguntas disponibles</small></span><span class="bank-check" aria-hidden="true">✓</span></label>`).join('')||'<div class="empty">Aún no hay especialidades detectadas.</div>'}</div><p id="bankSearchEmpty" class="muted hidden" role="status">No hay especialidades que coincidan con la búsqueda.</p><h3>Temas</h3><div id="bankTopics" class="check-grid"><div class="empty">Selecciona una o más especialidades para filtrar por tema.</div></div><div class="grid cols-3"><label>Nº de preguntas<input id="bankCount" type="number" min="0" step="1" value="20" placeholder="0 = todas"><small class="muted">Escribe cualquier número. 0 = todas las disponibles.</small></label><label>Corrección<select id="bankMode"><option value="immediate">Inmediata</option><option value="end">Al final</option></select></label><label>Origen<select id="bankSource"><option value="all">Todo el banco</option><option value="remnote">RemNote / MCQ</option><option value="questions">Banco MIR</option></select></label></div><button id="startBankBtn" class="btn primary" disabled onclick="startBank()">Comenzar banqueo</button></div>${pool.length?'':`<div class="empty" style="margin-top:16px">Aún no hay preguntas disponibles. Las tarjetas de opción múltiple de RemNote aparecen aquí automáticamente.</div>`}`}
function startBank(){let pool=questionPool(),specs=selectedBankSpecialties(),topics=$$('.bank-topic:checked').map(x=>x.value),raw=$('#bankCount').value,n=Math.max(0,Math.floor(Number(raw)||0)),source=$('#bankSource')?.value||'all';if(!specs.length)return toast('Selecciona al menos una especialidad');if($$('.bank-topic').length&&!topics.length)return toast('Selecciona al menos un tema');if(specs.length)pool=pool.filter(q=>specs.some(s=>q.specialty===s||canonicalSpecialty(q.specialty)===canonicalSpecialty(s)));if(topics.length)pool=pool.filter(q=>topics.includes(q.topic));if(source!=='all')pool=pool.filter(q=>q._source===source);pool=pool.sort(()=>Math.random()-.5);if(n>0&&n<pool.length)pool=pool.slice(0,n);if(!pool.length)return toast('No hay preguntas para esos filtros');if(n>pool.length)toast(`Solo hay ${pool.length} preguntas disponibles; se usarán todas.`);state.bank={pool,index:0,answered:false,selected:null,mode:$('#bankMode').value,results:[],context:'bank',highlights:{},answers:{},eliminations:{},submitted:false};showQuestion()}
function questionHighlightKey(q){return `${q._source||'questions'}:${q.id}`}
function highlightedStemHtml(mode,q){const key=questionHighlightKey(q);const store=mode==='simulation'?(state.simulation?.highlights||{}):(state.bank?.highlights||{});return store[key]||mdInline(q.stem||q.question||'')}
function saveHighlightHtml(mode,key,html){const clean=document.createElement('div');clean.innerHTML=html;clean.querySelectorAll('.inline-image-zoom').forEach(b=>b.remove());html=clean.innerHTML;if(mode==='simulation'){state.simulation.highlights??={};state.simulation.highlights[key]=html;persistSimulation()}else{state.bank.highlights??={};state.bank.highlights[key]=html}}
const pendingHighlightRanges={bank:null,simulation:null};
function highlightRoot(mode){return mode==='simulation'?$('#simStem'):$('#bankStem')}
function captureHighlightSelection(mode){const sel=window.getSelection(),root=highlightRoot(mode);if(!sel||!root||sel.rangeCount===0||sel.isCollapsed)return;const range=sel.getRangeAt(0);if(root.contains(range.commonAncestorContainer)||root===range.commonAncestorContainer)pendingHighlightRanges[mode]=range.cloneRange()}
function validHighlightRange(mode,range){const root=highlightRoot(mode);return !!(root&&range&&(root.contains(range.commonAncestorContainer)||root===range.commonAncestorContainer))}
function highlightSelection(mode){const sel=window.getSelection();let range=null;if(sel&&sel.rangeCount&&!sel.isCollapsed&&validHighlightRange(mode,sel.getRangeAt(0)))range=sel.getRangeAt(0).cloneRange();else range=pendingHighlightRanges[mode];const root=highlightRoot(mode);if(!root||!validHighlightRange(mode,range))return toast('Selecciona primero una parte del enunciado');const mark=document.createElement('mark');mark.className='user-highlight';try{range.surroundContents(mark)}catch{try{const frag=range.extractContents();mark.appendChild(frag);range.insertNode(mark)}catch{return toast('Prueba seleccionando un fragmento más corto.')}}if(sel)sel.removeAllRanges();pendingHighlightRanges[mode]=null;saveHighlightHtml(mode,root.dataset.qkey,root.innerHTML);toast('Texto resaltado')}
function clearQuestionHighlights(mode){const root=highlightRoot(mode);if(!root)return;root.querySelectorAll('mark.user-highlight').forEach(m=>m.replaceWith(...m.childNodes));root.normalize();pendingHighlightRanges[mode]=null;saveHighlightHtml(mode,root.dataset.qkey,root.innerHTML);toast('Resaltado eliminado')}
function bankQKey(q){return questionHighlightKey(q)}
function eliminationRecord(container,key){container.eliminations??={};if(!container.eliminations[key])container.eliminations[key]={order:[],active:[]};const r=container.eliminations[key];r.order=Array.isArray(r.order)?r.order:[];r.active=Array.isArray(r.active)?r.active:[];return r}
function discardOrdinal(n){return `${n}.º`}
function discardSummaryHtml(rec){const order=rec?.order||[];if(!order.length)return '<div class="discard-review-summary none">No descartaste alternativas en esta pregunta.</div>';return `<div class="discard-review-summary"><strong>Orden de descarte:</strong> ${order.map((i,pos)=>`<span class="discard-chip">${discardOrdinal(pos+1)} ${String.fromCharCode(65+i)}</span>`).join(' <span class="discard-arrow">→</span> ')}</div>`}
function discardBadgeHtml(rec,i){const pos=(rec?.order||[]).indexOf(i);if(pos<0)return'';const active=(rec?.active||[]).includes(i);return `<span class="discard-order-badge ${active?'active':'restored'}">${discardOrdinal(pos+1)} descarte${active?'':' · recuperada'}</span>`}
function bankElimination(q){return eliminationRecord(state.bank,bankQKey(q))}
function toggleBankDiscard(i){const q=state.bank.pool[state.bank.index],saved=bankSavedAnswer(q);if(state.bank.submitting||saved?.persisted||saved?.saving||(state.bank.mode==='immediate'&&saved?.answered))return;const rec=bankElimination(q),active=new Set(rec.active);if(active.has(i)){active.delete(i)}else{active.add(i);if(!rec.order.includes(i))rec.order.push(i);if(state.bank.selected===i){state.bank.selected=null;state.bank.answers??={};state.bank.answers[bankQKey(q)]={...(saved||{}),selected:null,answered:false}}}rec.active=[...active];showQuestion()}
function bankSavedAnswer(q){return state.bank.answers?.[bankQKey(q)]||null}
function bankCounts(){const vals=Object.values(state.bank.answers||{});return{answered:vals.filter(v=>v&&v.selected!==null&&v.selected!==undefined).length,blank:state.bank.pool.length-vals.filter(v=>v&&v.selected!==null&&v.selected!==undefined).length}}
function answerChoiceHtml(q,i,{selected,discarded,locked,correct=false,wrong=false,mode='bank'}){
 const option=q.options[i],pick=mode==='bank'?'selectOption':'chooseSimulationOption',discard=mode==='bank'?'toggleBankDiscard':'toggleSimulationDiscard';
 return `<div class="${mode==='bank'?'mcq-option':'sim-option'} discardable ${discarded?'eliminated ':''}${selected?'selected ':''}${correct?'correct ':''}${wrong?'wrong ':''}" data-i="${i}">
  <button type="button" class="answer-choice" role="radio" aria-checked="${selected}" aria-label="${esc(`Alternativa ${i+1}: ${typeof option==='string'?option:option.text||''}`)}" ${locked||discarded?'disabled':''} onclick="${pick}(${i})"><span class="option-letter">${i+1}</span><span class="option-text">${optionHtml(typeof option==='string'?option:option.text||'')}</span><span class="choice-check" aria-hidden="true">${selected?'✓':''}</span></button>
  <button type="button" class="discard-btn ${discarded?'restore':''}" ${locked?'disabled':''} aria-label="${discarded?'Recuperar':'Descartar'} alternativa ${i+1}" aria-pressed="${discarded}" onclick="${discard}(${i})">${discarded?'↶ Recuperar':'× Descartar'}</button>
 </div>`;
}
function bankSelectionStatus(){
 const bank=state.bank,q=bank.pool[bank.index],saved=bankSavedAnswer(q),selected=Number.isInteger(saved?.selected);
 if(saved?.saving)return 'Guardando resultado…';
 if(saved?.answered&&bank.mode==='immediate')return 'Respuesta corregida y enviada';
 if(selected)return window.nexmirStudySaveFailed?'Selección conservada en esta sesión; no se pudo guardar en este navegador.':'✓ Selección guardada en este navegador';
 return 'Elige una alternativa; se guardará automáticamente';
}
function updateBankSelectionStatus(){
 const counts=bankCounts(),status=$('#bankSelectionStatus'),counter=$('#bankAnswerCounts');
 if(counter)counter.textContent=`${counts.answered} respondidas · ${counts.blank} pendientes`;
 if(status)status.textContent=bankSelectionStatus();
 const btn=$('#answerBtn');if(btn)btn.disabled=!Number.isInteger(state.bank.selected)||!!bankSavedAnswer(state.bank.pool[state.bank.index])?.saving;
}
function showQuestion(){
 const bank=state.bank,q=bank.pool[bank.index];if(!q)return finishBank(true);
 const options=q.options||[],qkey=bankQKey(q),saved=bankSavedAnswer(q),selected=saved?.selected??null,answered=!!saved?.answered,discarded=new Set(bankElimination(q).active||[]),immediate=bank.mode==='immediate',counts=bankCounts();
 bank.selected=selected;bank.answered=answered;
 const locked=!!(bank.submitting||saved?.persisted||saved?.saving||(immediate&&answered));
 $('#questionDialogBody').innerHTML=`
 <div class="dialog-head"><div><span class="chip">Pregunta ${bank.index+1} de ${bank.pool.length}</span><div class="path">${esc([q.specialty,q.topic,q.subtopic].filter(Boolean).join(' › '))}</div></div><button class="icon-btn" aria-label="Cerrar banqueo" onclick="closeBankDialog()">×</button></div>
 <div class="bank-progress-row"><span id="bankAnswerCounts">${counts.answered} respondidas · ${counts.blank} pendientes</span><span class="muted keyboard-hint">Teclado: 1–${Math.min(9,options.length)} para elegir</span></div>
 <div class="highlight-toolbar"><span>Resalta lo importante:</span><button class="btn mini" onmousedown="event.preventDefault()" onclick="highlightSelection('bank')">🖍 Resaltar</button><button class="btn mini" onclick="clearQuestionHighlights('bank')">Quitar resaltado</button></div>
 <main class="bank-question-workspace ${q.image_url?'has-question-image':''}"><section class="bank-question-reading"><div id="bankStem" data-qkey="${esc(qkey)}" class="flash-front question-stem highlightable" onmouseup="captureHighlightSelection('bank')" onkeyup="captureHighlightSelection('bank')">${highlightedStemHtml('bank',q)}</div>${questionImageHtml(q)}</section><section class="bank-question-options"><div class="mcq-options" role="radiogroup" aria-label="Alternativas de respuesta">${options.map((o,i)=>answerChoiceHtml(q,i,{selected:selected===i,discarded:discarded.has(i),locked,correct:answered&&immediate&&i===+q.correct_index,wrong:answered&&immediate&&i===selected&&i!==+q.correct_index})).join('')}</div><p id="bankSelectionStatus" class="answer-save-status" role="status" aria-live="polite">${bankSelectionStatus()}</p><div id="qFeedback">${answered&&immediate?bankFeedbackHtml(q,saved):''}</div></section></main>
 <div class="dialog-actions bank-nav-actions"><button class="btn" data-bank-nav="previous" onclick="goBankQuestion(${bank.index-1})" ${bank.index===0?'disabled':''}>← Anterior</button><button class="btn" onclick="toggleBookmark('question','${q.id}')">★ Marcar</button><div class="spacer"></div>
 ${immediate&&!answered?`<button id="answerBtn" class="btn primary" ${saved?.saving||selected===null?'disabled':''} onclick="answerQuestion()">${saved?.saving?'Guardando…':'Responder'}</button>`:''}
 <button class="btn ${!immediate||answered?'primary':''}" data-bank-nav="next" onclick="goBankQuestion(${bank.index+1})" ${bank.index>=bank.pool.length-1?'disabled':''}>Siguiente →</button><button class="btn ${bank.index===bank.pool.length-1?'primary':''}" onclick="finishBank(true)">Finalizar y enviar</button></div><div class="resize-grip" title="Arrastra para cambiar el tamaño"></div>`;
 const d=$('#questionDialog');if(!d.open)d.showModal();ensureResizableDialog(d);
}

function bankFeedbackHtml(q,saved){const correct=!!saved?.correct;return `<div class="card"><strong class="${correct?'green':'red'}">${correct?'Correcta':'Incorrecta'}</strong><div id="bankExplanation">${q.explanation?`<p class="muted">${mdInline(q.explanation)}</p>`:'<p class="muted">Esta pregunta no tiene explicación registrada.</p>'}</div></div>`}
function selectOption(i){const q=state.bank.pool[state.bank.index],saved=bankSavedAnswer(q);if(state.bank.submitting||saved?.persisted||saved?.saving||(state.bank.mode==='immediate'&&saved?.answered))return;if(bankElimination(q).active.includes(i))return toast('Primero recupera esta alternativa para seleccionarla');state.bank.selected=i;state.bank.answers??={};state.bank.answers[bankQKey(q)]={...(saved||{}),selected:i,answered:false};$$('#questionDialogBody .mcq-option').forEach(x=>{const selected=+x.dataset.i===i;x.classList.toggle('selected',selected);const radio=x.querySelector('[role=radio]');radio?.setAttribute('aria-checked',String(selected));const check=x.querySelector('.choice-check');if(check)check.textContent=selected?'✓':''});window.nexmirSaveStudy?.();updateBankSelectionStatus()}
function goBankQuestion(i){if(i<0||i>=state.bank.pool.length)return;const control=document.activeElement?.dataset.bankNav;window.nexmirSaveStudy?.();state.bank.index=i;showQuestion();if(control){const next=document.querySelector(`[data-bank-nav="${control}"]:not(:disabled)`);(next||document.querySelector('#questionDialog .answer-choice:not(:disabled)'))?.focus({preventScroll:true})}}
function closeBankDialog(){if(confirm('¿Salir del banqueo? Tus selecciones quedarán guardadas en este navegador para continuar después.'))$('#questionDialog').close()}
function attemptPayload(q,selectedIndex,isCorrect,mode){return{user_id:state.user.id,question_id:q._source==='questions'?q.id:null,source_content_id:q._source==='remnote'?q.id:null,selected_index:selectedIndex,is_correct:isCorrect,answered_at:new Date().toISOString(),mode}}
async function persistQuestionAttempt(q,selectedIndex,isCorrect,mode){const row=attemptPayload(q,selectedIndex,isCorrect,mode);if(!row.question_id&&!row.source_content_id){toast('No pude identificar la pregunta para guardar el intento');return null}const {data,error}=await state.sb.from('user_question_attempts').insert(row).select('*').single();if(error){console.error('attempt save',error,row);toast('No se pudo guardar el intento: '+error.message);return null}state.attempts.unshift(data||row);return data||row}
async function answerQuestion(){
 const bank=state.bank,q=bank?.pool?.[bank.index],selected=bank?.selected;
 if(!q||!Number.isInteger(selected)){toast('Selecciona una alternativa');return}
 const key=bankQKey(q),saved=bankSavedAnswer(q);if(saved?.saving||(bank.mode==='immediate'&&saved?.answered))return;
 const correct=+q.correct_index===selected;bank.answers??={};
 if(bank.mode==='immediate'){
  bank.answers[key]={selected,answered:false,correct,saving:true};showQuestion();const btn=$('#answerBtn');if(btn){btn.disabled=true;btn.textContent='Guardando…'}
  try{
   const persisted=await persistQuestionAttempt(q,selected,correct,'bank');
   bank.answers[key]={selected,answered:!!persisted,correct,saving:false};
   if(state.bank===bank&&bankQKey(bank.pool[bank.index])===key){showQuestion()}
  }catch(error){
   bank.answers[key]={selected,answered:false,correct,saving:false};
   if(state.bank===bank&&bankQKey(bank.pool[bank.index])===key)showQuestion();toast('No se pudo guardar la respuesta. Puedes reintentar.');console.error('Guardar respuesta',error);
  }
 }else{
  bank.answers[key]={selected,answered:true,correct};bank.answered=true;toast('Respuesta guardada');if(bank.index<bank.pool.length-1)goBankQuestion(bank.index+1);else showQuestion();
 }
}
async function finishBank(ask=true){
 const bank=state.bank;if(bank.submitted||bank.submitting)return;if(Object.values(bank.answers||{}).some(a=>a?.saving))return toast('Espera a que termine de guardarse la respuesta.');
 const answers=bank.answers||{},answered=Object.values(answers).filter(v=>v&&v.selected!==null&&v.selected!==undefined),blank=bank.pool.length-answered.length;
 if(ask&&!confirm(`¿Finalizar y enviar el banqueo? Tienes ${blank} preguntas sin responder.`))return;
 bank.submitting=true;
 try{
  const results=[];
  for(const q of bank.pool){
   const key=bankQKey(q),a=answers[key],selected=a?.selected??null,correct=selected===null?null:+q.correct_index===+selected;
   results.push({q,selected,correct});
   if(selected!==null&&!a.persisted&&(bank.mode==='end'||!a.answered)){
    const saved=await persistQuestionAttempt(q,selected,correct,'bank');
    if(!saved)throw new Error('Faltan respuestas por guardar. Reintenta Finalizar y enviar para continuar desde las pendientes.');
    a.persisted=true;window.nexmirSaveStudy?.();
   }
  }
  bank.submitted=true;bank.results=results;
  const ok=results.filter(x=>x.correct===true).length;toast(`Banqueo enviado: ${ok}/${answered.length} correctas · ${blank} en blanco`);
  if(state.bank===bank)renderBankResults();updateDueBadge();
 }catch(error){toast(error.message||'No se pudo enviar. Tus respuestas se conservan para reintentar.')}
 finally{bank.submitting=false;window.nexmirSaveStudy?.()}
}
function bankReviewStatus(q){const a=state.bank.answers?.[bankQKey(q)];if(!a||a.selected===null||a.selected===undefined)return'blank';return +a.selected===+q.correct_index?'correct':'wrong'}
function renderBankReviewQuestion(i){const b=state.bank;if(!b?.pool?.length)return;i=Math.max(0,Math.min(i,b.pool.length-1));const q=b.pool[i],a=b.answers?.[bankQKey(q)],selected=a?.selected??null,blank=selected===null||selected===undefined,ok=!blank&&+selected===+q.correct_index,opts=q.options||[],elim=eliminationRecord(b,bankQKey(q));$$('.bank-review-nav-btn').forEach((x,idx)=>x.classList.toggle('active',idx===i));const box=$('#bankReviewDetail');if(!box)return;box.innerHTML=`<div class="sim-review-detail-head"><div><span class="chip">Pregunta ${i+1}</span><div class="path">${esc([displaySpecialty(q.specialty),q.topic,q.subtopic].filter(Boolean).join(' › '))}</div></div><span class="review-status-pill ${blank?'blank':ok?'correct':'wrong'}">${blank?'En blanco':ok?'Correcta':'Incorrecta'}</span></div><div class="question-stem sim-review-stem">${mdInline(q.stem||q.question||'')}</div>${questionImageHtml(q)}${discardSummaryHtml(elim)}<div class="sim-review-options">${opts.map((o,oi)=>{const corr=oi===+q.correct_index,chosen=!blank&&oi===+selected,wasDiscarded=elim.order.includes(oi);return `<div class="sim-review-option ${corr?'correct-option':''} ${chosen&&!corr?'wrong-option':''} ${chosen?'chosen-option':''} ${wasDiscarded?'was-discarded':''}"><span class="option-letter">${String.fromCharCode(65+oi)}.</span><span>${optionHtml(typeof o==='string'?o:o.text||'')}</span>${discardBadgeHtml(elim,oi)}${corr?'<span class="option-tag good">Correcta</span>':''}${chosen&&!corr?'<span class="option-tag bad">Tu respuesta</span>':''}</div>`}).join('')}</div><div class="sim-review-answerline"><strong>Tu respuesta:</strong> ${blank?'En blanco':String.fromCharCode(65+selected)} <span>·</span> <strong>Correcta:</strong> ${String.fromCharCode(65+(+q.correct_index||0))}</div>${q.explanation?`<div class="sim-review-explanation"><strong>Explicación</strong><div>${markdownToHtml(q.explanation)}</div></div>`:`<div class="sim-review-explanation"><strong>Explicación</strong><p class="muted">Esta pregunta no tiene explicación registrada.</p></div>`}`;box.scrollLeft=0;box.scrollTop=0;}
function renderBankResults(){const b=state.bank,answered=b.results.filter(x=>x.selected!==null),ok=answered.filter(x=>x.correct).length,wrong=answered.filter(x=>x.correct===false).length,blank=b.pool.length-answered.length;$('#questionDialogBody').innerHTML=`<div class="sim-results-shell bank-results-shell ${b.pool.length<=21?'short-review':''}" style="--review-rows:${Math.ceil(Math.min(b.pool.length,21)/7)}"><div class="sim-results-top"><div class="dialog-head"><div><span class="chip">Banqueo enviado</span><h2 style="margin:8px 0 0">Revisión final</h2></div><button class="icon-btn" onclick="$('#questionDialog').close();renderBank()">×</button></div><div class="sim-result-grid"><div class="sim-result-card"><strong class="green">${ok}</strong><span>Correctas</span></div><div class="sim-result-card"><strong class="red">${wrong}</strong><span>Incorrectas</span></div><div class="sim-result-card"><strong>${blank}</strong><span>En blanco</span></div><div class="sim-result-card"><strong class="accent">${b.pool.length}</strong><span>Total</span></div></div></div><div class="sim-review-workspace"><aside class="sim-review-sidebar"><div class="sim-review-sidebar-head"><strong>Preguntas</strong><span class="chip">${b.pool.length}</span></div><div class="sim-review-legend"><span><i class="correct"></i>Correcta</span><span><i class="wrong"></i>Incorrecta</span><span><i class="blank"></i>Blanco</span></div><div class="sim-review-nav">${b.pool.map((q,i)=>{const st=bankReviewStatus(q),label=st==='correct'?'Correcta':st==='wrong'?'Incorrecta':'En blanco';return `<button class="sim-review-nav-btn bank-review-nav-btn ${st} ${i===0?'active':''}" onclick="renderBankReviewQuestion(${i})"><span class="review-card-number">${i+1}</span><span class="review-card-copy"><strong>${esc(reviewQuestionPreview(q))}</strong><small>${label}</small></span><span class="review-card-dot"></span></button>`}).join('')}</div><div class="sim-review-side-actions"><button class="btn" onclick="$('#questionDialog').close();renderBank()">Cerrar</button><button class="btn primary" onclick="$('#questionDialog').close();route('errors')">Mis errores</button></div></aside><main id="bankReviewDetail" class="sim-review-detail"></main></div></div>`;const d=$('#questionDialog');if(!d.open)d.showModal();renderBankReviewQuestion(0);d.scrollLeft=0;$('#questionDialogBody').scrollLeft=0;}
function groupedByCanonical(pool){const g={};for(const q of pool){const c=canonicalSpecialty(q.specialty);(g[c]??=[]).push(q)}return g}
function proportionalCounts(total,groups){const entries=Object.entries(groups).filter(([,arr])=>arr.length);let weights=entries.map(([sp,arr])=>({sp,w:MIR_WEIGHTS[sp]||4,max:arr.length}));const sum=weights.reduce((a,x)=>a+x.w,0)||1;let out={},used=0;for(const x of weights){out[x.sp]=Math.min(x.max,Math.floor(total*x.w/sum));used+=out[x.sp]}let remaining=Math.min(total,entries.reduce((a,[,arr])=>a+arr.length,0))-used;while(remaining>0){let candidates=weights.filter(x=>out[x.sp]<x.max).sort((a,b)=>(b.w/(out[b.sp]+1))-(a.w/(out[a.sp]+1)));if(!candidates.length)break;out[candidates[0].sp]++;remaining--}return out}
function buildMirSimulation(total=200){const pool=questionPool(),groups=groupedByCanonical(pool),counts=proportionalCounts(total,groups),chosen=[];for(const [sp,n] of Object.entries(counts)){chosen.push(...groups[sp].slice().sort(()=>Math.random()-.5).slice(0,n))}return{pool:chosen.sort(()=>Math.random()-.5),counts,target:total}}
function mirDistributionPreview(total=200){const pool=questionPool(),groups=groupedByCanonical(pool),counts=proportionalCounts(total,groups);return Object.entries(counts).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1])}
const simStorageKey=()=>`nexmir_active_sim_${state.user?.id||'guest'}`;
let simTimerHandle=null;
function simQKey(q){return `${q._source||'questions'}:${q.id}`}
function readStoredSimulation(){try{return JSON.parse(localStorage.getItem(simStorageKey())||'null')}catch{return null}}
function simIsActive(){return !!readStoredSimulation()}
function persistSimulation(){const s=state.simulation;if(!s?.active)return;try{localStorage.setItem(simStorageKey(),JSON.stringify({active:true,title:s.title,mode:s.mode,index:s.index||0,questionKeys:s.pool.map(simQKey),primaryCount:s.primaryCount,reserveCount:s.reserveCount,answers:s.answers||{},marked:[...(s.marked||new Set())],highlights:s.highlights||{},eliminations:s.eliminations||{},startedAt:s.startedAt,endAt:s.endAt,durationSec:s.durationSec}));s.localSaveFailed=false;return true}catch{if(!s.localSaveFailed)toast('No se pudo guardar en este navegador. Mantén esta pestaña abierta hasta entregar.');s.localSaveFailed=true;return false}}
function clearPersistedSimulation(){localStorage.removeItem(simStorageKey())}
function hydrateSimulation(raw){if(!raw?.active)return null;const map=new Map(questionPool().map(q=>[simQKey(q),q]));const pool=(raw.questionKeys||[]).map(k=>map.get(k)).filter(Boolean);if(!pool.length)return null;return{active:true,title:raw.title||'Simulacro MIR',mode:raw.mode||'mir',pool,index:Math.min(raw.index||0,pool.length-1),primaryCount:Math.min(raw.primaryCount||pool.length,pool.length),reserveCount:Math.max(0,Math.min(raw.reserveCount||0,pool.length-(raw.primaryCount||pool.length))),answers:raw.answers||{},marked:new Set(raw.marked||[]),highlights:raw.highlights||{},eliminations:raw.eliminations||{},startedAt:raw.startedAt,endAt:raw.endAt,durationSec:raw.durationSec||16200}}
function fmtClock(sec){sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),ss=sec%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`}
function simulationCounts(){const s=state.simulation,answers=s.answers||{};let answered=0;for(let i=0;i<s.pool.length;i++)if(answers[simQKey(s.pool[i])]!==undefined)answered++;return{answered,blank:s.pool.length-answered,marked:s.marked?.size||0}}
function shuffleQuestions(rows){const out=rows.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
function simulationCandidates(){const origin=$('#simOrigin')?.value||'all';return questionPool().filter(q=>origin==='all'||q._simulationOrigin).filter(NexmirContentRules.validTest)}
function simulationSpecialtiesChanged(){
 const selected=new Set($$('.sim-sp:checked').map(el=>el.value)),topics=new Map();
 for(const q of simulationCandidates())if(selected.has(displaySpecialty(q.specialty))){const pair=[displaySpecialty(q.specialty),q.topic||'General'],key=JSON.stringify(pair);if(!topics.has(key))topics.set(key,{pair,n:0});topics.get(key).n++}
 $('#simTopics').innerHTML=[...topics].sort((a,b)=>a[1].pair.join().localeCompare(b[1].pair.join(),'es')).map(([key,v])=>`<label class="check-card"><input class="sim-topic" type="checkbox" checked value="${esc(key)}" onchange="updateCustomSimulationCount()"><span><strong>${esc(v.pair[1])}</strong><small>${esc(v.pair[0])} · ${v.n} preguntas</small></span></label>`).join('')||'<div class="empty">Selecciona una especialidad con preguntas.</div>';
 updateCustomSimulationCount();
}
function simulationOriginChanged(){
 const counts=new Map();for(const q of simulationCandidates()){const sp=displaySpecialty(q.specialty);counts.set(sp,(counts.get(sp)||0)+1)}
 $('#simSpecialties').innerHTML=[...counts].sort((a,b)=>a[0].localeCompare(b[0],'es')).map(([sp,n])=>`<label class="check-card"><input class="sim-sp" type="checkbox" checked value="${esc(sp)}" onchange="simulationSpecialtiesChanged()"><span><strong>${esc(sp)}</strong><small>${n} preguntas</small></span></label>`).join('')||'<div class="empty">No hay preguntas válidas en este origen.</div>';
 simulationSpecialtiesChanged();
}
function selectSimulationFilters(cls,checked){$$('.'+cls).forEach(el=>el.checked=checked);cls==='sim-sp'?simulationSpecialtiesChanged():updateCustomSimulationCount()}
function selectedSimulationPool(){
 const specialties=new Set($$('.sim-sp:checked').map(el=>el.value)),topics=new Set($$('.sim-topic:checked').map(el=>el.value));
 const history=$('#simHistory')?.value||'all',latest=new Map(),marks=new Set(state.bookmarks.filter(b=>b.item_type==='question').map(b=>String(b.item_id)));
 for(const a of state.attempts){const key=a.question_id?`questions:${a.question_id}`:`remnote:${a.source_content_id}`;const old=latest.get(key);if(!old||new Date(a.answered_at)>new Date(old.answered_at))latest.set(key,a)}
 return simulationCandidates().filter(q=>specialties.has(displaySpecialty(q.specialty))&&topics.has(JSON.stringify([displaySpecialty(q.specialty),q.topic||'General']))).filter(q=>{const aliases=q._aliases||[simQKey(q)],attempts=aliases.map(k=>latest.get(k)).filter(Boolean).sort((a,b)=>new Date(b.answered_at)-new Date(a.answered_at)),last=attempts[0];return history==='all'||history==='unseen'&&!last||history==='wrong'&&last?.is_correct===false||history==='marked'&&aliases.some(k=>marks.has(k.slice(k.indexOf(':')+1))) });
}
function updateCustomSimulationCount(){
 const pool=selectedSimulationPool(),n=Number($('#customSimCount')?.value),r=Number($('#customSimReserves')?.value),mins=Number($('#customSimMinutes')?.value),valid=Number.isInteger(n)&&n>0&&Number.isInteger(r)&&r>=0&&n+r<=pool.length&&Number.isFinite(mins)&&mins>=1&&mins<=1440;
 $('#customSimAvailable').textContent=`${pool.length} preguntas disponibles · ${n+r||0} solicitadas (incluidas reservas)`;
 const btn=$('#customSimStart');btn.disabled=!valid||simIsActive();
 const counts=proportionalCounts(Math.min(Math.max(0,n||0),pool.length),groupedByCanonical(pool));
 $('#customSimDistribution').classList.toggle('hidden',$('#customSimStrategy')?.value!=='mir');
 $('#customSimDistribution').innerHTML=Object.entries(counts).filter(([,v])=>v).sort((a,b)=>b[1]-a[1]).map(([sp,c])=>`<div class="mir-dist-item"><span>${esc(sp)}</span><strong>${c}</strong></div>`).join('');
}
function renderSimulations(){
 const stored=readStoredSimulation(),available=simulationCandidates().length;
 $('#view-simulations').innerHTML=`${stored?.active?`<div class="card" style="margin-bottom:16px"><div class="row"><div><span class="chip">En curso</span><h3>${esc(stored.title||'Simulacro MIR')}</h3><p class="muted">Tu progreso está guardado. El reloj continúa aunque cierres o recargues la página.</p></div><button class="btn primary" onclick="resumeMirSimulation()">Reanudar</button></div></div>`:''}
 <div class="section-head"><div><h3>Crea tu simulacro</h3><p class="muted">Las preguntas de todos los archivos importados forman un banco reutilizable. Elige qué practicar y NEXMIR generará una combinación nueva, sin repetir preguntas dentro del examen.</p></div></div>
 <div class="mir-note"><strong>Modo MIR:</strong> 200 ordinarias + 10 reservas y 4 h 30 min. En el modo personalizado eliges cantidad y tiempo. La corrección se muestra al entregar.</div>
 <div class="grid cols-3"><div class="card"><span class="chip">Rápido</span><h3>Mini-MIR</h3><p class="muted">15 preguntas seleccionadas del banco.</p><button class="btn primary" ${available>=15&&!stored?.active?'':'disabled'} onclick="startMirSimulation(15)">Empezar</button></div><div class="card"><span class="chip">Examen completo</span><h3>Simulacro MIR</h3><p class="muted">200 + 10 reservas · 4 h 30 min.</p><button class="btn" ${available>=210&&!stored?.active?'':'disabled'} onclick="startMirSimulation(200)">Empezar MIR</button></div><div class="card"><span class="chip">Banco reutilizable</span><h3>${available} preguntas válidas</h3><p class="muted">Incluye las importadas de simulacros anteriores. El nombre del archivo identifica su origen.</p></div></div>
 <div class="card custom-simulation" style="margin-top:16px"><h3>Simulacro personalizado</h3>
 <div class="grid cols-3"><label>Nombre<input id="customSimTitle" maxlength="120" value="Mi simulacro"></label><label>Origen<select id="simOrigin" onchange="simulationOriginChanged()"><option value="all">Todo el banco</option><option value="simulation">Preguntas importadas de simulacros</option></select></label><label>Preguntas<select id="simHistory" onchange="updateCustomSimulationCount()"><option value="all">Todas</option><option value="unseen">Nunca respondidas</option><option value="wrong">Falladas en el último intento</option><option value="marked">Marcadas</option></select></label></div>
 <div class="section-head"><h3>Especialidades</h3><div class="row"><button class="btn mini" onclick="selectSimulationFilters('sim-sp',true)">Todas</button><button class="btn mini" onclick="selectSimulationFilters('sim-sp',false)">Limpiar</button></div></div><div id="simSpecialties" class="check-grid simulation-filter-grid"></div>
 <div class="section-head"><h3>Temas</h3><div class="row"><button class="btn mini" onclick="selectSimulationFilters('sim-topic',true)">Todos</button><button class="btn mini" onclick="selectSimulationFilters('sim-topic',false)">Limpiar</button></div></div><div id="simTopics" class="check-grid simulation-filter-grid"></div>
 <div class="grid cols-3"><label>Preguntas ordinarias<input id="customSimCount" type="number" min="1" step="1" value="20" oninput="updateCustomSimulationCount()"></label><label>Reservas<input id="customSimReserves" type="number" min="0" step="1" value="0" oninput="updateCustomSimulationCount()"></label><label>Tiempo (minutos)<input id="customSimMinutes" type="number" min="1" max="1440" value="30" oninput="updateCustomSimulationCount()"></label><label>Distribución<select id="customSimStrategy" onchange="updateCustomSimulationCount()"><option value="random">Aleatoria</option><option value="mir">Ponderada por especialidad MIR</option></select></label></div>
 <p id="customSimAvailable" class="muted" aria-live="polite"></p><div id="customSimDistribution" class="mir-dist"></div><p id="customSimDistributionNote" class="muted small">La distribución ponderada se aplica si eliges esa opción. En modo aleatorio, la distribución cambia en cada sesión.</p><button id="customSimStart" class="btn primary" onclick="startCustomSimulation()">Generar y empezar mi simulacro</button></div>`;
 simulationOriginChanged();
}
function generateSimulationPool(pool,total,strategy='random'){
 if(strategy!=='mir')return shuffleQuestions(pool).slice(0,total);
 const groups=groupedByCanonical(pool),counts=proportionalCounts(total,groups),chosen=[];for(const [sp,n] of Object.entries(counts))chosen.push(...shuffleQuestions(groups[sp]).slice(0,n));return shuffleQuestions(chosen);
}
function startCustomSimulation(){
 const n=Number($('#customSimCount')?.value),reserveCount=Number($('#customSimReserves')?.value),minutes=Number($('#customSimMinutes')?.value),pool=selectedSimulationPool();
 if(!Number.isInteger(n)||n<1||!Number.isInteger(reserveCount)||reserveCount<0||!Number.isFinite(minutes)||minutes<1||minutes>1440)return toast('Revisa cantidad, reservas y tiempo');
 if(n+reserveCount>pool.length)return toast(`Hay ${pool.length} preguntas disponibles. Reduce la cantidad o amplía los filtros.`);
 const strategy=$('#customSimStrategy')?.value||'random';
 // Select ordinary and reserve questions separately so ordinary MIR weights match the preview.
 const ordinary=generateSimulationPool(pool,n,strategy),keys=new Set(ordinary.map(simQKey)),reserve=shuffleQuestions(pool.filter(q=>!keys.has(simQKey(q)))).slice(0,reserveCount);
 return startMirSimulation(n,{pool:[...ordinary,...reserve],reserveCount,durationSec:Math.round(minutes*60),title:$('#customSimTitle')?.value.trim().slice(0,120)||'Mi simulacro'});
}
function startMirSimulation(n,config=null){
 if(simIsActive())return toast('Ya tienes un simulacro en curso');
 const full=n===200&&!config,target=config?n+config.reserveCount:full?210:n,available=simulationCandidates();
 if(!Number.isInteger(n)||n<1)return toast('Cantidad de preguntas inválida');
 const pool=config?.pool||generateSimulationPool(available,target,'mir');
 if(pool.length!==target||new Set(pool.map(simQKey)).size!==pool.length)return toast(`Necesitas ${target} preguntas distintas. Amplía los filtros o reduce la cantidad.`);
 const primaryCount=n,reserveCount=config?.reserveCount||(full?10:0),durationSec=config?.durationSec||(full?16200:Math.round(16200*n/200));
 state.simulation={active:true,title:config?.title||(full?'Simulacro MIR':'Mini-MIR'),mode:config?(n===15&&!reserveCount?'mini':'mir'):full?'mir':'mini',pool,index:0,primaryCount,reserveCount,answers:{},marked:new Set(),highlights:{},eliminations:{},startedAt:new Date().toISOString(),endAt:new Date(Date.now()+durationSec*1000).toISOString(),durationSec};persistSimulation();openSimulation();
}
function quickSim(n){startMirSimulation(n)}
function resumeMirSimulation(){const raw=readStoredSimulation(),sim=hydrateSimulation(raw);if(!sim){clearPersistedSimulation();return toast('No se pudo recuperar el simulacro')};state.simulation=sim;openSimulation()}
function openSimulation(){const d=$('#simDialog');document.body.classList.add('sim-modal-open');if(!d.open)d.showModal();d.scrollTop=0;ensureResizableDialog(d);renderSimulationQuestion();startSimulationTimer()}
function closeSimulationDialog(){if(confirm('¿Salir del simulacro? Tu progreso quedará guardado y el cronómetro seguirá corriendo.')){$('#simDialog').close();clearInterval(simTimerHandle);simTimerHandle=null;renderSimulations()}}
function startSimulationTimer(){clearInterval(simTimerHandle);const tick=()=>{const s=state.simulation;if(!s?.active){clearInterval(simTimerHandle);return}const left=Math.floor((new Date(s.endAt).getTime()-Date.now())/1000),el=$('#simTimer');if(el){el.textContent=fmtClock(left);el.classList.toggle('warn',left<=1800&&left>300);el.classList.toggle('danger',left<=300)}if(left<=0){clearInterval(simTimerHandle);finishMirSimulation(false,true)}};tick();simTimerHandle=setInterval(tick,1000)}
function simulationElimination(q){return eliminationRecord(state.simulation,simQKey(q))}
function toggleSimulationDiscard(i){const s=state.simulation,q=s.pool[s.index],rec=simulationElimination(q),active=new Set(rec.active);if(active.has(i)){active.delete(i)}else{active.add(i);if(!rec.order.includes(i))rec.order.push(i);if(s.answers[simQKey(q)]===i)delete s.answers[simQKey(q)]}rec.active=[...active];persistSimulation();renderSimulationQuestion()}
function renderSimulationQuestion(){const s=state.simulation,q=s?.pool?.[s.index];if(!q)return;const key=simQKey(q),selected=s.answers[key],isReserve=s.index>=s.primaryCount,c=simulationCounts(),opts=q.options||[],elim=simulationElimination(q),discarded=new Set(elim.active||[]);$('#simDialogBody').innerHTML=`<div class="sim-shell"><div class="sim-top"><div class="grow"><div class="sim-title">${esc(s.title)}</div><div class="sim-counter">${isReserve?'Reserva ':''}${s.index+1} de ${s.pool.length} · ${esc([q.specialty,q.topic].filter(Boolean).join(' › '))}</div></div><div id="simTimer" class="sim-timer">--:--:--</div><button class="icon-btn" onclick="closeSimulationDialog()">×</button></div><div class="sim-body"><main class="sim-question">${isReserve?'<div class="sim-reserve-banner">Pregunta de reserva · no entra en las netas mientras no sustituya a una ordinaria anulada.</div>':''}<div class="highlight-toolbar"><span>Selecciona texto del enunciado y:</span><button class="btn mini" onmousedown="event.preventDefault()" onclick="highlightSelection('simulation')">🖍 Resaltar</button><button class="btn mini" onclick="clearQuestionHighlights('simulation')">Quitar resaltado</button><span class="muted">· Teclado 1–${Math.min(9,opts.length)} para responder · ✕ para descartar</span></div><div id="simStem" data-qkey="${esc(key)}" class="sim-stem question-stem highlightable" onmouseup="captureHighlightSelection('simulation')" onkeyup="captureHighlightSelection('simulation')">${highlightedStemHtml('simulation',q)}</div>${questionImageHtml(q)}<div class="sim-options" role="radiogroup" aria-label="Alternativas de respuesta">${opts.map((o,i)=>answerChoiceHtml(q,i,{selected:selected===i,discarded:discarded.has(i),locked:!!s.finishing,mode:"simulation"})).join('')}</div><p class="answer-save-status" role="status">${s.localSaveFailed?"Selección conservada en esta sesión; no se pudo guardar en este navegador.":selected!==undefined?"✓ Selección guardada en este navegador":"Elige una alternativa; se guardará automáticamente"}</p></main><aside class="sim-side"><div class="sim-map-title"><strong>Mapa</strong><span class="chip">${c.answered}/${s.pool.length}</span></div><div class="sim-legend"><span class="lg-answered">Respondida</span><span class="lg-marked">Marcada</span><span>Blanco</span></div><div class="sim-map">${s.pool.map((qq,i)=>{const k=simQKey(qq),ans=s.answers[k]!==undefined,m=s.marked.has(k),res=i>=s.primaryCount;return `<button class="${i===s.index?'current ':''}${ans?'answered ':'blank '}${m?'marked ':''}${res?'reserve':''}" onclick="goSimulationQuestion(${i})">${i+1}</button>`}).join('')}</div><div class="sim-summary"><div><strong>${c.answered}</strong><small>Respondidas</small></div><div><strong>${c.blank}</strong><small>Blancas</small></div><div><strong>${c.marked}</strong><small>Marcadas</small></div></div></aside></div><div class="sim-bottom"><button class="btn" onclick="goSimulationQuestion(${Math.max(0,s.index-1)})" ${s.index===0?'disabled':''}>← Anterior</button><button class="btn" onclick="clearSimulationAnswer()">Dejar en blanco</button><button class="btn ${s.marked.has(key)?'violet-btn':''}" onclick="toggleSimulationMark()">★ ${s.marked.has(key)?'Marcada':'Marcar'}</button><div class="spacer"></div>${s.index<s.pool.length-1?`<button class="btn primary" onclick="goSimulationQuestion(${s.index+1})">Siguiente →</button>`:''}<button class="btn ${s.index===s.pool.length-1?'primary':''}" onclick="finishMirSimulation(true,false)">Entregar</button></div></div>`;startSimulationTimer()}
function chooseSimulationOption(i){const s=state.simulation,q=s.pool[s.index];if(s.finishing||!s.active)return;if(simulationElimination(q).active.includes(i))return toast('Primero recupera esta alternativa para seleccionarla');s.answers[simQKey(q)]=i;const focus=document.activeElement?.closest('.answer-choice')?i:null;persistSimulation();renderSimulationQuestion();if(focus!==null)document.querySelectorAll('#simDialog .answer-choice')[focus]?.focus({preventScroll:true})}
function clearSimulationAnswer(){const s=state.simulation,q=s.pool[s.index];delete s.answers[simQKey(q)];persistSimulation();renderSimulationQuestion()}
function toggleSimulationMark(){const s=state.simulation,k=simQKey(s.pool[s.index]);s.marked.has(k)?s.marked.delete(k):s.marked.add(k);persistSimulation();renderSimulationQuestion()}
function goSimulationQuestion(i){const s=state.simulation;if(!s)return;s.index=Math.max(0,Math.min(i,s.pool.length-1));persistSimulation();renderSimulationQuestion()}
async function finishMirSimulation(ask=true,timedOut=false){const s=state.simulation;if(!s?.active||s.finishing)return;if(ask){const c=simulationCounts();if(!confirm(`¿Entregar el simulacro? Tienes ${c.blank} preguntas en blanco y ${c.marked} marcadas.`))return}s.finishing=true;clearInterval(simTimerHandle);const primary=s.pool.slice(0,s.primaryCount),reserve=s.pool.slice(s.primaryCount,s.primaryCount+s.reserveCount);const calc=arr=>{let correct=0,incorrect=0,blank=0;for(const q of arr){const a=s.answers[simQKey(q)];if(a===undefined)blank++;else if(+a===+q.correct_index)correct++;else incorrect++}return{correct,incorrect,blank,net:correct-incorrect/3}};const main=calc(primary),res=calc(reserve);const rows=[];for(const q of s.pool){const a=s.answers[simQKey(q)];if(a===undefined)continue;rows.push({user_id:state.user.id,question_id:q._source==='questions'?q.id:null,source_content_id:q._source==='remnote'?q.id:null,selected_index:a,is_correct:+a===+q.correct_index,answered_at:new Date().toISOString(),mode:'simulation',...(window.NEXMIR_FOCUS_BACKEND_READY===true&&typeof window.nexmirQuestionActiveSeconds==='function'?{question_active_time_seconds:window.nexmirQuestionActiveSeconds(q,'simulation')}: {})})}if(rows.length){const {data:saved,error}=await state.sb.from('user_question_attempts').insert(rows).select();if(error){console.error('simulation attempts save',error);toast('Algunos intentos del simulacro no se guardaron: '+error.message);for(const q of s.pool){const a=s.answers[simQKey(q)];if(a===undefined)continue;await persistQuestionAttempt(q,a,+a===+q.correct_index,'simulation')}}else if(saved?.length)state.attempts=[...saved,...state.attempts]}const {data:simSaved,error:simErr}=await state.sb.from('simulations').insert({user_id:state.user.id,title:s.title,mode:s.mode,question_ids:s.pool.map(q=>q.id),total:s.primaryCount,correct:main.correct,incorrect:main.incorrect,blank:main.blank,net_score:Number(main.net.toFixed(2)),started_at:s.startedAt,finished_at:new Date().toISOString()}).select().single();if(simErr){console.error(simErr);toast('El resultado del simulacro no pudo guardarse: '+simErr.message)}else if(simSaved)state.simulations.unshift(simSaved);s.active=false;clearPersistedSimulation();renderSimulationResults(s,main,res,timedOut)}
function simulationReviewStatus(s,q){const a=s.answers[simQKey(q)];if(a===undefined)return'blank';return +a===+q.correct_index?'correct':'wrong'}
function simulationReviewButtonLabel(s,i){return i>=s.primaryCount?`R${i-s.primaryCount+1}`:`${i+1}`}
function renderSimulationReviewQuestion(i){const s=state.simulation;if(!s?.pool?.length)return;i=Math.max(0,Math.min(i,s.pool.length-1));const q=s.pool[i],a=s.answers[simQKey(q)],blank=a===undefined,ok=!blank&&+a===+q.correct_index,reserve=i>=s.primaryCount,opts=q.options||[],elim=simulationElimination(q);$$('.sim-review-nav-btn').forEach((b,idx)=>b.classList.toggle('active',idx===i));const box=$('#simReviewDetail');if(!box)return;box.innerHTML=`<div class="sim-review-detail-head"><div><span class="chip">${reserve?'Reserva '+(i-s.primaryCount+1):'Pregunta '+(i+1)}</span><div class="path">${esc([displaySpecialty(q.specialty),q.topic].filter(Boolean).join(' › '))}</div></div><span class="review-status-pill ${blank?'blank':ok?'correct':'wrong'}">${blank?'En blanco':ok?'Correcta':'Incorrecta'}</span></div><div class="question-stem sim-review-stem">${mdInline(q.stem||q.question||'')}</div>${questionImageHtml(q)}${discardSummaryHtml(elim)}<div class="sim-review-options">${opts.map((o,oi)=>{const corr=oi===+q.correct_index,chosen=!blank&&oi===+a,wasDiscarded=elim.order.includes(oi);return `<div class="sim-review-option ${corr?'correct-option':''} ${chosen&&!corr?'wrong-option':''} ${chosen?'chosen-option':''} ${wasDiscarded?'was-discarded':''}"><span class="option-letter">${String.fromCharCode(65+oi)}.</span><span>${optionHtml(typeof o==='string'?o:o.text||'')}</span>${discardBadgeHtml(elim,oi)}${corr?'<span class="option-tag good">Correcta</span>':''}${chosen&&!corr?'<span class="option-tag bad">Tu respuesta</span>':''}</div>`}).join('')}</div><div class="sim-review-answerline"><strong>Tu respuesta:</strong> ${blank?'En blanco':String.fromCharCode(65+a)} <span>·</span> <strong>Correcta:</strong> ${String.fromCharCode(65+(+q.correct_index||0))}</div>${q.explanation?`<div class="sim-review-explanation"><strong>Explicación</strong><div>${markdownToHtml(q.explanation)}</div></div>`:`<div class="sim-review-explanation"><strong>Explicación</strong><p class="muted">Esta pregunta no tiene explicación registrada.</p></div>`}`;box.scrollLeft=0;box.scrollTop=0;}
function renderSimulationResults(s,main,res,timedOut){const pct=s.primaryCount?Math.round(main.correct/s.primaryCount*100):0;state.simulation=s;$('#simDialogBody').innerHTML=`<div class="sim-results-shell"><div class="sim-results-top"><div class="dialog-head"><div><span class="chip">${timedOut?'Tiempo agotado':'Entregado'}</span><h2 style="margin:8px 0 0">Resultado · ${esc(s.title)}</h2></div><button class="icon-btn" onclick="$('#simDialog').close();renderSimulations()">×</button></div><div class="sim-result-grid"><div class="sim-result-card"><strong class="green">${main.correct}</strong><span>Correctas</span></div><div class="sim-result-card"><strong class="red">${main.incorrect}</strong><span>Incorrectas</span></div><div class="sim-result-card"><strong>${main.blank}</strong><span>En blanco</span></div><div class="sim-result-card"><strong class="accent">${main.net.toFixed(2)}</strong><span>Netas MIR</span></div></div><div class="sim-result-summary"><span>Precisión <strong>${pct}%</strong></span>${s.reserveCount?`<span>Reservas C/I/B <strong>${res.correct}/${res.incorrect}/${res.blank}</strong></span>`:''}<span>Netas = correctas − incorrectas/3</span></div></div><div class="sim-review-workspace"><aside class="sim-review-sidebar"><div class="sim-review-sidebar-head"><strong>Revisión final</strong><span class="chip">${s.pool.length}</span></div><div class="sim-review-legend"><span><i class="correct"></i>Correcta</span><span><i class="wrong"></i>Incorrecta</span><span><i class="blank"></i>Blanco</span></div><div class="sim-review-nav">${s.pool.map((q,i)=>{const st=simulationReviewStatus(s,q),reserve=i>=s.primaryCount,label=st==='correct'?'Correcta':st==='wrong'?'Incorrecta':'En blanco',num=simulationReviewButtonLabel(s,i);return `<button class="sim-review-nav-btn ${st} ${i===0?'active':''}" onclick="renderSimulationReviewQuestion(${i})"><span class="review-card-number">${num}</span><span class="review-card-copy"><strong>${esc(reviewQuestionPreview(q))}</strong><small>${reserve?'Reserva '+(i-s.primaryCount+1)+' · ':''}${label}</small></span><span class="review-card-dot"></span></button>`}).join('')}</div><div class="sim-review-side-actions"><button class="btn" onclick="$('#simDialog').close();renderSimulations()">Cerrar</button><button class="btn primary" onclick="$('#simDialog').close();route('errors')">Mis errores</button></div></aside><main id="simReviewDetail" class="sim-review-detail"></main></div></div>`;renderSimulationReviewQuestion(0);$('#simDialog').scrollLeft=0;$('#simDialogBody').scrollLeft=0;}
function renderErrors(){const errs=state.attempts.filter(a=>a.is_valid!==false&&!a.is_correct);$('#view-errors').innerHTML=`<div class="section-head"><div><h3>Mis errores</h3><p class="muted">Convierte cada fallo en un repaso dirigido.</p></div><span class="chip">${errs.length}</span></div><div class="list">${errs.slice(0,100).map(a=>{const q=getAttemptQuestion(a);return q?`<div class="list-item"><div class="type-icon red">×</div><div class="grow"><strong>${mdInline(q.stem||q.question||'Pregunta')}</strong><div class="path">${esc([q.specialty,q.topic].filter(Boolean).join(' › '))} · ${fmtDate(a.answered_at)}</div></div><button class="btn" onclick="studyRelated('${encodeURIComponent(q.specialty||'')}','${encodeURIComponent(q.topic||'')}')">Repasar</button></div>`:''}).join('')||'<div class="empty">Todavía no tienes errores registrados.</div>'}</div>`}
async function studyRelated(s,t){const sp=decodeURIComponent(s),topic=decodeURIComponent(t);await route('study');openTopic(encodeURIComponent(sp),encodeURIComponent(topic))}
async function toggleBookmark(type,id){const ex=state.bookmarks.find(b=>b.item_type===type&&b.item_id===id);if(ex){await state.sb.from('user_bookmarks').delete().eq('id',ex.id);state.bookmarks=state.bookmarks.filter(x=>x.id!==ex.id);toast('Quitado de marcadas')}else{const {data,error}=await state.sb.from('user_bookmarks').insert({user_id:state.user.id,item_type:type,item_id:id}).select().single();if(error){toast(error.message);return}state.bookmarks.unshift(data);toast('Guardado en marcadas')}}
function renderBookmarks(){const rows=state.bookmarks.map(b=>{if(b.item_type==='content'){const x=state.content.find(x=>x.id===b.item_id);return x?contentRow(x):''}const q=state.questions.find(q=>q.id===b.item_id);return q?`<div class="list-item"><div class="type-icon">?</div><div class="grow"><strong>${mdInline(q.stem)}</strong><div class="path">${esc([q.specialty,q.topic].filter(Boolean).join(' › '))}</div></div></div>`:''}).filter(Boolean);$('#view-bookmarks').innerHTML=`<div class="section-head"><h3>Marcadas</h3><span class="chip">${rows.length}</span></div><div class="list">${rows.join('')||'<div class="empty">Marca teoría, flashcards o preguntas para encontrarlas aquí.</div>'}</div>`}
function attemptsBySpecialty(){const map={};for(const a of state.attempts.filter(a=>a.is_valid!==false)){const q=getAttemptQuestion(a);if(!q?.specialty)continue;map[q.specialty]??={n:0,c:0};map[q.specialty].n++;if(a.is_correct)map[q.specialty].c++}return Object.entries(map).map(([name,v])=>({name,n:v.n,acc:Math.round(v.c/v.n*100)}))}
function weakSpecialties(){return attemptsBySpecialty().filter(x=>x.n>=2).sort((a,b)=>a.acc-b.acc)}
function topicMastery(sp,t){const arr=state.attempts.filter(a=>{const q=getAttemptQuestion(a);return q&&displaySpecialty(q.specialty)===sp&&(q.topic||'General')===t});if(!arr.length)return 0;return Math.round(arr.filter(a=>a.is_correct).length/arr.length*100)}
function renderProgress(){const by=attemptsBySpecialty().sort((a,b)=>b.n-a.n),s=stats();$('#view-progress').innerHTML=`<div class="grid cols-4"><div class="card"><div class="metric">${s.attempts.length}</div><div class="metric-label">Preguntas</div></div><div class="card"><div class="metric">${s.accuracy}%</div><div class="metric-label">Precisión</div></div><div class="card"><div class="metric">${state.reviews.reduce((a,r)=>a+(r.repetitions||0),0)}</div><div class="metric-label">Repasos</div></div><div class="card"><div class="metric">${level()}</div><div class="metric-label">Nivel NEXMIR</div></div></div><div class="section-head"><h3>Rendimiento por especialidad</h3></div><div class="card">${by.length?by.map(x=>`<div class="statbar"><span>${esc(x.name)}</span><div class="progress-track"><div class="progress-fill" style="width:${x.acc}%"></div></div><strong>${x.acc}%</strong></div>`).join(''):'<p class="muted">Empieza a responder preguntas para generar estadísticas.</p>'}</div>`}
function residencySpecialty(name){return MIR_RESIDENCY_SPECIALTIES.find(x=>x.name===name)||null}
function specialtyGuideUrl(name){const x=residencySpecialty(name);return x?`https://plazamir.es/especialidad/${x.slug}`:'https://plazamir.es/guias'}
function netasPerBaremoPoint(){return MIR_SCORE_FACTORS_2026.baremo/(3*MIR_SCORE_FACTORS_2026.exam)}
function estimatedNetasForGoal(sp,baremo){if(!sp?.avgNetas2025||!Number.isFinite(baremo))return null;const refBaremo=7.5;return Math.max(0,sp.avgNetas2025-(baremo-refBaremo)*netasPerBaremoPoint())}
function projectedScore2026(netas,baremo){if(!Number.isFinite(netas)||!Number.isFinite(baremo))return null;return netas*3*MIR_SCORE_FACTORS_2026.exam+baremo*MIR_SCORE_FACTORS_2026.baremo}
function goalDataHtml(){const sp=residencySpecialty($('#goalSpecialty')?.value||state.profile?.goal_specialty||''),baremoRaw=$('#goalBaremo')?.value,baremo=(baremoRaw!==undefined&&baremoRaw!=='')?Number(baremoRaw):(state.profile?.academic_average!=null?Number(state.profile.academic_average):NaN),latest=state.simulations.find(x=>x.finished_at&&x.net_score!=null),est=estimatedNetasForGoal(sp,baremo),proj=latest?projectedScore2026(Number(latest.net_score),baremo):null;if(!sp)return '<div class="empty">Selecciona una especialidad para ver plazas y referencias históricas.</div>';return `<div class="goal-insights"><div class="card"><span class="chip">Oferta 2027</span><div class="metric">${sp.places.toLocaleString('es-ES')}</div><div class="metric-label">plazas MIR de ${esc(sp.name)}</div></div><div class="card"><span class="chip">Histórico 2026</span><div class="metric">${sp.close2026?sp.close2026.toLocaleString('es-ES'):'—'}</div><div class="metric-label">${sp.close2026?'último nº de orden nacional conocido':'sin cierre nacional comparable cargado'}</div></div><div class="card"><span class="chip">Referencia 2025</span><div class="metric">${sp.avgNetas2025?sp.avgNetas2025.toFixed(1):'—'}</div><div class="metric-label">netas medias históricas de quienes eligieron la especialidad</div></div><div class="card"><span class="chip">Tu baremo</span><div class="metric">${Number.isFinite(baremo)?baremo.toFixed(2):'—'}</div><div class="metric-label">peso oficial: 10% del resultado final</div></div></div>${est!=null?`<div class="card goal-estimate"><h3>Objetivo orientativo NEXMIR</h3><div class="big-estimate">≈ ${est.toFixed(1)} netas</div><p class="muted">Referencia orientativa ajustada a tu baremo: parte de las netas medias 2025 de la especialidad y usa la sensibilidad de los factores de corrección MIR 2026. <strong>No es una nota de corte ni predice tu número de orden.</strong></p><div class="row"><span>Impacto aproximado del baremo (factores 2026)</span><strong>1 punto de baremo ≈ ${netasPerBaremoPoint().toFixed(2)} netas</strong></div>${latest?`<div class="row" style="margin-top:9px"><span>Último simulacro: ${Number(latest.net_score).toFixed(2)} netas</span><strong>${proj!=null?`puntuación normalizada 2026 ≈ ${proj.toFixed(2)}`:''}</strong></div>`:''}</div>`:''}`}
function refreshGoalHospitals(){const q=($('#goalHospital')?.value||'').toLowerCase();const list=$('#goalHospitalList');if(!list)return;list.innerHTML=MIR_CENTER_CATALOG.filter(h=>!q||`${h.name} ${h.city} ${h.community}`.toLowerCase().includes(q)).slice(0,150).map(h=>`<option value="${esc(h.name)}">${esc(h.city)} · ${esc(h.community)}</option>`).join('')}
function syncGoalHospitalCity(){const hospitalInput=$('#goalHospital'),cityInput=$('#goalCity');if(!hospitalInput||!cityInput)return;const value=hospitalInput.value.trim();if(!value){cityInput.value='';cityInput.dataset.autoCity='';return}const match=MIR_CENTER_CATALOG.find(h=>normText(h.name)===normText(value));if(match){const auto=`${match.city} · ${match.community}`;cityInput.value=auto;cityInput.dataset.autoCity=auto}else if(cityInput.dataset.autoCity){cityInput.value='';cityInput.dataset.autoCity=''}refreshGoalHospitals()}
function refreshGoalInsights(){const box=$('#goalInsights');if(box)box.innerHTML=goalDataHtml();const link=$('#allCentersLink');if(link)link.href=specialtyGuideUrl($('#goalSpecialty')?.value||'')}
function renderGoal(){const current=state.profile?.goal_specialty||'',hospital=state.profile?.goal_hospital||'',baremo=state.profile?.academic_average??'';$('#view-goal').innerHTML=`<div class="grid cols-2 goal-layout"><div><div class="goal-box"><span class="chip">Mi plaza MIR</span><h2>${esc(current||'Elige tu especialidad')}</h2><p class="muted">${hospital?esc(hospital)+' · ':state.profile?.goal_city?esc(state.profile.goal_city)+' · ':''}${state.profile?.target_number?`Objetivo Nº MIR < ${esc(state.profile.target_number)}`:'Configura tu objetivo y baremo para contextualizar tus simulacros.'}</p></div><div id="goalInsights" style="margin-top:16px">${goalDataHtml()}</div></div><div class="card"><h3>Configurar objetivo</h3><label>Especialidad MIR 2027<select id="goalSpecialty" onchange="refreshGoalInsights()"><option value="">Selecciona especialidad</option>${MIR_RESIDENCY_SPECIALTIES.map(x=>`<option value="${esc(x.name)}" ${x.name===current?'selected':''}>${esc(x.name)} · ${x.places} plazas</option>`).join('')}</select></label><label>Hospital / unidad docente <span class="muted small">(opcional)</span><input id="goalHospital" list="goalHospitalList" value="${esc(hospital)}" placeholder="Escribe o selecciona un centro" oninput="syncGoalHospitalCity()" onchange="syncGoalHospitalCity()"><datalist id="goalHospitalList"></datalist></label><div class="row gap"><label class="grow">Ciudad / comunidad <span class="muted small">(automático)</span><input id="goalCity" value="${esc(state.profile?.goal_city||'')}" placeholder="Se completa al elegir hospital" readonly></label><label class="grow">Nº MIR objetivo <span class="muted small">(opcional)</span><input id="goalNumber" type="number" min="1" value="${esc(state.profile?.target_number||'')}" placeholder="Ej. 4000"></label></div><label>Baremo académico / nota media <span class="muted small">(opcional)</span><input id="goalBaremo" type="number" min="0" max="10" step="0.0001" value="${esc(baremo)}" placeholder="Ej. 8.10" oninput="refreshGoalInsights()"></label><div class="row gap"><button class="btn primary" onclick="saveGoal()">Guardar objetivo</button><a id="allCentersLink" class="btn" target="_blank" rel="noopener" href="${esc(specialtyGuideUrl(current))}">Ver todos los centros 2027 ↗</a></div><p class="muted small">La lista completa de centros/unidades depende de la especialidad. El enlace abre el catálogo 2027 contrastado con el BOE; el selector local incluye un catálogo nacional verificado inicial.</p></div></div><div class="card source-note"><strong>Cómo calcula NEXMIR</strong><p class="muted">El MIR pondera el ejercicio al 90% y el baremo académico al 10%. La estimación usa factores definitivos MIR 2026 como referencia; los factores MIR 2027 no se conocerán hasta que se corrija esa convocatoria. El número de orden y la disponibilidad de un hospital concreto cambian cada año.</p></div>`;refreshGoalHospitals();if(hospital)syncGoalHospitalCity();refreshGoalInsights()}
async function saveGoal(){const baremoVal=$('#goalBaremo').value.trim();const row={goal_specialty:$('#goalSpecialty').value||null,goal_city:$('#goalCity').value.trim()||null,goal_hospital:$('#goalHospital').value.trim()||null,academic_average:baremoVal===''?null:Number(baremoVal),target_number:+$('#goalNumber').value||null,updated_at:new Date().toISOString()};if(row.academic_average!=null&&(row.academic_average<0||row.academic_average>10))return toast('El baremo debe estar entre 0 y 10');const {error}=await state.sb.from('profiles').update(row).eq('id',state.user.id);if(error){if(/permission denied.*profiles/i.test(error.message))return toast('Faltan permisos de perfil en Supabase. Ejecuta la migración NEXMIR V3.6.');if(/goal_hospital|academic_average|column/i.test(error.message))return toast('Faltan columnas de Mi plaza MIR en Supabase. Ejecuta la migración NEXMIR V3.6.');return toast(error.message)}Object.assign(state.profile,row);toast('Objetivo guardado');window.dispatchEvent(new Event('nexmir:goal-saved'));renderGoal()}
function renderProfile(){$('#view-profile').innerHTML=`<div class="grid cols-2"><div class="card"><h3>Perfil</h3><label>Nombre<input id="profileName" value="${esc(state.profile?.display_name||'')}"></label><label>Correo<input value="${esc(state.user.email)}" disabled></label><div class="row"><span>Plan</span><span class="pill">${esc(state.profile?.plan||'free')}</span></div><div class="row" style="margin-top:10px"><span>Rol</span><span class="chip">${esc(state.profile?.role||'user')}</span></div><button class="btn primary" style="margin-top:15px" onclick="saveProfile()">Guardar</button></div><div class="card"><h3>Cuenta</h3><p class="muted">Tu progreso se guarda automáticamente en tu cuenta.</p><button class="btn danger" onclick="logout()">Cerrar sesión</button></div></div>`}
async function saveProfile(){const display_name=$('#profileName').value.trim();const {error}=await state.sb.from('profiles').update({display_name,updated_at:new Date().toISOString()}).eq('id',state.user.id);if(error)return toast(error.message);state.profile.display_name=display_name;toast('Perfil actualizado');showApp()}
async function logout(){return window.NexmirSessions.end('logout')}

$$('.auth-tab').forEach(b=>b.onclick=()=>{$$('.auth-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#loginPanel').classList.toggle('hidden',b.dataset.auth!=='login');$('#signupPanel').classList.toggle('hidden',b.dataset.auth!=='signup')});
$('#loginBtn').onclick=login;$('#signupBtn').onclick=signup;$$('[data-password-toggle]').forEach(button=>button.addEventListener('click',()=>{const field=document.getElementById(button.dataset.passwordToggle);const visible=field.type==='password';field.type=visible?'text':'password';button.textContent=visible?'Ocultar':'Mostrar';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Ocultar contraseña':'Mostrar contraseña');field.focus({preventScroll:true})}));$$('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());$$('.nav-item[data-view]').forEach(b=>b.onclick=()=>route(b.dataset.view));$('#mobileMenu').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');
window.addEventListener('beforeunload',e=>{if(simIsActive()){e.preventDefault();e.returnValue=''}});

function ensureResizableDialog(dialog){
 if(!dialog)return;
 // Keep the handle outside the body that is replaced on each question.
 dialog.querySelectorAll('.resize-grip').forEach(g=>{if(g.parentElement!==dialog)g.remove()});
 let grip=dialog.querySelector(':scope > .resize-grip');
 if(!grip){grip=document.createElement('button');grip.type='button';grip.className='resize-grip';grip.title='Arrastra para cambiar el tamaño. También puedes usar las flechas.';grip.setAttribute('aria-label','Cambiar tamaño de la ventana con las flechas o arrastrando');dialog.appendChild(grip)}
 if(grip.dataset.ready==='1')return;grip.dataset.ready='1';
 const size=(w,h)=>{const width=Math.max(360,Math.min(window.innerWidth-48,w)),height=Math.max(260,Math.min(window.innerHeight-48,h));dialog.style.setProperty('--dialog-width',width+'px');dialog.style.setProperty('--dialog-height',height+'px');dialog.style.width=width+'px';dialog.style.height=height+'px'};
 grip.addEventListener('pointerdown',e=>{
   if(window.innerWidth<=760||e.button!==0)return;
   e.preventDefault();e.stopPropagation();const r=dialog.getBoundingClientRect(),x=e.clientX,y=e.clientY;
   grip.setPointerCapture(e.pointerId);
   const move=ev=>size(r.width+ev.clientX-x,r.height+ev.clientY-y);
   const end=()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',end);grip.removeEventListener('pointercancel',end)};
   grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',end);grip.addEventListener('pointercancel',end);
 });
 grip.addEventListener('keydown',e=>{const dx={ArrowLeft:-40,ArrowRight:40}[e.key]||0,dy={ArrowUp:-40,ArrowDown:40}[e.key]||0;if(!dx&&!dy)return;e.preventDefault();const r=dialog.getBoundingClientRect();size(r.width+dx,r.height+dy)});
}
function initResizableDialogs(){['studyDialog','cardDialog','questionDialog','simDialog'].forEach(id=>{const d=document.getElementById(id);if(d)ensureResizableDialog(d)})}
setTimeout(initResizableDialogs,0);
$('#simDialog').addEventListener('cancel',e=>{if(state.simulation?.active){e.preventDefault();closeSimulationDialog()}});
$('#simDialog').addEventListener('close',()=>{document.body.classList.remove('sim-modal-open')});
start().catch(e=>{if(state.user)showStartupError(e);else{hideBootScreen();showAuth();$('#authMsg').textContent='Error al iniciar: '+e.message}console.error(e)});


// ===== V4.9 PROGRESO AVANZADO =====
state.progressRange=state.progressRange||'30';
function setProgressRange(v){state.progressRange=String(v||'30');renderProgress()}
function progressAttempts(){const valid=state.attempts.filter(a=>a.is_valid!==false);const days=state.progressRange==='all'?null:+state.progressRange;if(!days)return valid;const cut=Date.now()-days*864e5;return valid.filter(a=>new Date(a.answered_at||0).getTime()>=cut)}
function attemptStableKey(a){return a.question_id?`q:${a.question_id}`:a.source_content_id?`c:${a.source_content_id}`:null}
function questionForAttempt(a){return getAttemptQuestion(a)}
function progressSpecialties(attempts){const m=new Map();for(const a of attempts){const q=questionForAttempt(a);if(!q)continue;const sp=displaySpecialty(q.specialty);const v=m.get(sp)||{name:sp,n:0,ok:0};v.n++;if(a.is_correct)v.ok++;m.set(sp,v)}return [...m.values()].map(v=>({...v,acc:v.n?Math.round(100*v.ok/v.n):0})).sort((a,b)=>b.n-a.n)}
function progressTopics(attempts){const m=new Map();for(const a of attempts){const q=questionForAttempt(a);if(!q)continue;const sp=displaySpecialty(q.specialty),tp=q.topic||'General',key=sp+'||'+tp,v=m.get(key)||{specialty:sp,topic:tp,n:0,ok:0};v.n++;if(a.is_correct)v.ok++;m.set(key,v)}return [...m.values()].map(v=>({...v,acc:v.n?Math.round(100*v.ok/v.n):0})).sort((a,b)=>(a.acc-b.acc)||(b.n-a.n))}
function repeatedErrors(attempts){const m=new Map();for(const a of attempts.filter(x=>!x.is_correct)){const k=attemptStableKey(a);if(!k)continue;const v=m.get(k)||{n:0,a};v.n++;m.set(k,v)}return [...m.values()].filter(x=>x.n>=2).sort((a,b)=>b.n-a.n)}
function simulationTrendSvg(rows){const vals=rows.slice(0,12).reverse().map(x=>Number(x.net_score)).filter(Number.isFinite);if(vals.length<2)return '<div class="empty">Completa al menos dos simulacros para ver la evolución.</div>';const min=Math.min(...vals),max=Math.max(...vals),span=Math.max(1,max-min),w=700,h=180,p=24;const pts=vals.map((v,i)=>`${p+i*(w-2*p)/(vals.length-1)},${h-p-(v-min)*(h-2*p)/span}`).join(' ');return `<div class="progress-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolución de netas"><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" class="axis"/><polyline points="${pts}" class="trend-line" fill="none"/>${vals.map((v,i)=>{const [x,y]=pts.split(' ')[i].split(',');return `<circle cx="${x}" cy="${y}" r="5" class="trend-dot"><title>${v.toFixed(1)} netas</title></circle>`}).join('')}</svg><div class="chart-scale"><span>${min.toFixed(1)} netas</span><span>${max.toFixed(1)} netas</span></div></div>`}
renderProgress=function(){const at=progressAttempts(),allPool=questionPool(),seen=new Set(at.map(attemptStableKey).filter(Boolean)),uniqueTotal=new Set(allPool.map(q=>`${q._source||'questions'}:${q.id}`)).size,unseen=Math.max(0,uniqueTotal-seen.size),accuracy=at.length?Math.round(100*at.filter(x=>x.is_correct).length/at.length):0,spec=progressSpecialties(at),topics=progressTopics(at),weak=topics.filter(x=>x.n>=3).slice(0,8),repeat=repeatedErrors(at).slice(0,8),due=dueCards().length,reviewed=state.reviews.filter(r=>r.last_reviewed_at).length,consolidating=state.reviews.filter(r=>(r.repetitions||0)>=3).length,sims=state.simulations.filter(x=>x.finished_at&&x.net_score!=null).sort((a,b)=>new Date(b.finished_at)-new Date(a.finished_at)),latest=sims[0];$('#view-progress').innerHTML=`<div class="section-head progress-head"><div><h2>Progreso MIR</h2><p class="muted">Rendimiento, cobertura, puntos débiles y repaso espaciado.</p></div><select class="progress-range" onchange="setProgressRange(this.value)"><option value="7" ${state.progressRange==='7'?'selected':''}>Últimos 7 días</option><option value="30" ${state.progressRange==='30'?'selected':''}>Últimos 30 días</option><option value="all" ${state.progressRange==='all'?'selected':''}>Todo el historial</option></select></div><div class="grid cols-4 progress-kpis"><div class="card"><div class="metric">${at.length}</div><div class="metric-label">Respuestas</div></div><div class="card"><div class="metric">${accuracy}%</div><div class="metric-label">Precisión</div></div><div class="card"><div class="metric">${seen.size}</div><div class="metric-label">Preguntas vistas</div></div><div class="card"><div class="metric">${unseen}</div><div class="metric-label">Preguntas no vistas</div></div><div class="card"><div class="metric">${latest?Number(latest.net_score).toFixed(1):'—'}</div><div class="metric-label">Últimas netas</div></div><div class="card"><div class="metric">${due}</div><div class="metric-label">Flashcards pendientes</div></div><div class="card"><div class="metric">${reviewed}</div><div class="metric-label">Tarjetas estudiadas</div></div><div class="card"><div class="metric">${consolidating}</div><div class="metric-label">Consolidándose</div></div></div><div class="grid cols-2 progress-grid"><div class="card"><div class="section-head"><h3>Evolución de netas</h3><span class="chip">${sims.length} simulacros</span></div>${simulationTrendSvg(sims)}</div><div class="card"><div class="section-head"><h3>Cobertura del banco</h3></div><div class="coverage-big">${uniqueTotal?Math.round(100*seen.size/uniqueTotal):0}%</div><div class="progress-track"><div class="progress-fill" style="width:${uniqueTotal?Math.min(100,100*seen.size/uniqueTotal):0}%"></div></div><div class="row small"><span>${seen.size} vistas</span><span>${unseen} pendientes</span></div></div></div><div class="grid cols-2 progress-grid"><div class="card"><div class="section-head"><h3>Rendimiento por especialidad</h3></div>${spec.length?spec.map(x=>`<div class="statbar"><span>${esc(x.name)} <small class="muted">(${x.n})</small></span><div class="progress-track"><div class="progress-fill" style="width:${x.acc}%"></div></div><strong>${x.acc}%</strong></div>`).join(''):'<p class="muted">Aún no hay respuestas en este periodo.</p>'}</div><div class="card"><div class="section-head"><h3>Temas débiles</h3><span class="chip">mín. 3 preguntas</span></div>${weak.length?weak.map(x=>`<div class="weak-row"><div><strong>${esc(x.topic)}</strong><div class="path">${esc(x.specialty)} · ${x.n} preguntas</div></div><span class="weak-score">${x.acc}%</span><button class="btn mini" onclick="studyRelated('${encodeURIComponent(x.specialty)}','${encodeURIComponent(x.topic)}')">Repasar</button></div>`).join(''):'<div class="empty">Necesitas más preguntas por tema para identificar debilidades.</div>'}</div></div><div class="card"><div class="section-head"><div><h3>Errores recurrentes</h3><p class="muted">Preguntas falladas 2 o más veces durante el periodo seleccionado.</p></div><span class="chip">${repeat.length}</span></div><div class="list">${repeat.length?repeat.map(x=>{const q=questionForAttempt(x.a);return q?`<div class="list-item"><div class="type-icon red">${x.n}×</div><div class="grow"><strong>${mdInline(q.stem||q.question||'Pregunta')}</strong><div class="path">${esc([q.specialty,q.topic].filter(Boolean).join(' › '))}</div></div><button class="btn" onclick="studyRelated('${encodeURIComponent(q.specialty||'')}','${encodeURIComponent(q.topic||'')}')">Repasar</button></div>`:''}).join(''):'<div class="empty">No tienes errores recurrentes en este periodo.</div>'}</div></div>`}
