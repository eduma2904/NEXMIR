/* NEXMIR V5.1.39 · usuarios, Plan Pro con vigencia de 30 días, roles y dispositivo */
(() => {
 const st={rows:[]};
 const $=s=>document.querySelector(s);
 const esc2=s=>esc(String(s??''));
 const PRICE={PEN:60,USD:18,days:30};
 const SOON_DAYS=5;
 const MS_DAY=86400000;
 const limaFmt=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric'});
 const limaParts=d=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));
 const fmtDate=v=>v?limaFmt.format(new Date(v)):'—';
 const fmtDateTime=v=>v?new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—';

 /* Estado del plan de una fila: free | pro | pro-soon | pro-legacy | pro-expired */
 function planInfo(x,now=Date.now()){
  const isPro=String(x.plan||'free').toLowerCase()==='pro';
  if(!isPro)return {kind:'free',label:'FREE',detail:'',left:null};
  if(!x.plan_expires_at)return {kind:'pro-legacy',label:'PRO',detail:'Sin fecha de vencimiento (activado a mano)',left:null};
  const end=new Date(x.plan_expires_at).getTime();
  if(end<=now)return {kind:'pro-expired',label:'PRO VENCIDO',detail:`Venció el ${fmtDate(x.plan_expires_at)}`,left:0};
  const left=Math.ceil((end-now)/MS_DAY);
  return {kind:left<=SOON_DAYS?'pro-soon':'pro',label:'PRO',detail:`Vence ${fmtDate(x.plan_expires_at)} · ${left} ${left===1?'día':'días'}`,left};
 }

 async function load(){
  const b=$('#usersBody');if(!b)return;
  if(!cloudMode||!sb){b.innerHTML='<tr><td colspan="6" class="muted">Conecta Supabase.</td></tr>';return}
  b.innerHTML='<tr><td colspan="6" class="muted">Cargando usuarios…</td></tr>';
  // Retira Pro a quien no renovó (idempotente; si el script SQL aún no está, se ignora).
  let expired=0;try{const {data}=await sb.rpc('nexmir_expire_pro_plans');expired=Number(data)||0}catch{}
  let data=[];
  try{data=await fetchAllPages(()=>sb.from('profiles').select('*').order('updated_at',{ascending:false}))}
  catch(error){b.innerHTML=`<tr><td colspan="6" class="muted">${esc2(error.message)}</td></tr>`;return}
  st.rows=data||[];st.expiredNow=expired;render();
 }

 function matches(x,term,plan,role){
  const info=planInfo(x);
  const okPlan=plan==='all'
   ||(plan==='free'&&info.kind==='free')
   ||(plan==='pro'&&info.kind!=='free')
   ||(plan==='expiring'&&(info.kind==='pro-soon'||info.kind==='pro-expired'))
   ||(plan==='legacy'&&info.kind==='pro-legacy');
  return okPlan&&(role==='all'||(x.role||'user')===role)&&(!term||`${x.display_name||''} ${x.email||''} ${x.goal_specialty||''}`.toLowerCase().includes(term));
 }
 const filtered=()=>{const term=($('#usersSearch')?.value||'').toLowerCase(),plan=$('#usersPlan')?.value||'all',role=$('#usersRole')?.value||'all';return st.rows.filter(x=>matches(x,term,plan,role))};

 function summary(){
  const box=$('#usersPlanSummary');if(!box)return;
  const c={pro:0,soon:0,legacy:0,free:0};
  st.rows.forEach(x=>{const k=planInfo(x).kind;if(k==='free')c.free++;else{c.pro++;if(k==='pro-soon'||k==='pro-expired')c.soon++;if(k==='pro-legacy')c.legacy++}});
  box.innerHTML=`<span class="planStat"><strong>${c.pro}</strong> Pro</span><span class="planStat${c.soon?' warn':''}"><strong>${c.soon}</strong> por vencer (≤${SOON_DAYS} días)</span><span class="planStat${c.legacy?' note':''}"><strong>${c.legacy}</strong> Pro sin fecha</span><span class="planStat"><strong>${c.free}</strong> Free</span>${st.expiredNow?`<span class="planStat warn">Se retiró Pro a <strong>${st.expiredNow}</strong> por vencimiento</span>`:''}`;
 }

 function planCell(x){
  const i=planInfo(x);
  const cls={free:'free',pro:'pro','pro-soon':'soon','pro-legacy':'legacy','pro-expired':'expired'}[i.kind];
  return `<span class="planBadge ${cls}">${i.label}</span>${i.detail?`<div class="planDetail">${esc2(i.detail)}</div>`:''}`;
 }
 function actionsCell(x){
  const i=planInfo(x),id=esc2(x.id);
  const isAdminRole=String(x.role||'user')==='admin';
  const proBtns=i.kind==='free'||i.kind==='pro-expired'
   ?`<button class="primary usrGrant" data-id="${id}">Activar Pro · 30 días</button>`
   :`<button class="primary usrGrant" data-id="${id}">Renovar +30 días</button><button class="secondary danger usrRevoke" data-id="${id}">Quitar Pro</button>`;
  return `<div class="actions planActions">${isAdminRole?'':proBtns}<button class="secondary usrHistory" data-id="${id}">Pagos</button><button class="secondary usrSave" data-id="${id}">Guardar rol</button><button class="secondary usrReset" data-id="${id}">Reset dispositivo</button></div>`;
 }
 function render(){
  summary();
  const arr=filtered(),b=$('#usersBody'),empty=$('#usersEmpty');
  if(!arr.length){b.innerHTML='';empty.classList.remove('hidden');return}
  empty.classList.add('hidden');
  b.innerHTML=arr.map(x=>`<tr><td><strong>${esc2(x.display_name||'Sin nombre')}</strong><div class="muted">${esc2(x.email||x.id)}</div></td><td>${planCell(x)}</td><td><select class="usrRole" data-id="${esc2(x.id)}"><option value="user" ${(x.role||'user')==='user'?'selected':''}>user</option><option value="moderator" ${x.role==='moderator'?'selected':''}>moderator</option><option value="admin" ${x.role==='admin'?'selected':''}>admin</option></select></td><td><span>${esc2(x.active_device_label||'Sin vincular')}</span></td><td>${esc2(x.goal_specialty||'—')}<div class="muted">${x.target_number?'Nº < '+esc2(x.target_number):''}</div></td><td>${actionsCell(x)}</td></tr>`).join('');
  b.querySelectorAll('.usrSave').forEach(btn=>btn.onclick=()=>saveRole(btn.dataset.id));
  b.querySelectorAll('.usrReset').forEach(btn=>btn.onclick=()=>reset(btn.dataset.id));
  b.querySelectorAll('.usrGrant').forEach(btn=>btn.onclick=()=>openGrant(btn.dataset.id));
  b.querySelectorAll('.usrRevoke').forEach(btn=>btn.onclick=()=>revoke(btn.dataset.id));
  b.querySelectorAll('.usrHistory').forEach(btn=>btn.onclick=()=>openHistory(btn.dataset.id));
 }

 async function refreshRow(id){
  const {data,error}=await sb.from('profiles').select('*').eq('id',id).single();
  if(error)throw error;
  const i=st.rows.findIndex(x=>String(x.id)===String(id));if(i>=0)st.rows[i]=data;else st.rows.unshift(data);
  render();return data;
 }

 async function saveRole(id){
  const row=st.rows.find(x=>String(x.id)===String(id)),tr=[...$('#usersBody').rows].find(r=>r.querySelector('.usrSave')?.dataset.id===id);
  if(!row||!tr)return;
  const role=tr.querySelector('.usrRole').value,button=tr.querySelector('.usrSave');
  if(role===(row.role||'user'))return alert('El rol no ha cambiado.');
  button.disabled=true;button.textContent='Guardando…';
  try{
   const {data,error}=await sb.from('profiles').update({role,updated_at:new Date().toISOString()}).eq('id',id).select('id,role,updated_at').single();
   if(error)throw error;
   if(!data||data.role!==role)throw new Error('Supabase no confirmó el cambio de rol.');
   Object.assign(row,data);alert(`Rol actualizado: ${data.role}`);render();
  }catch(error){alert(error.message||'No se pudo actualizar el rol');await load()}
  finally{button.disabled=false;button.textContent='Guardar rol'}
 }

 async function reset(id){
  if(!confirm('¿Cerrar las sesiones de este usuario? Deberá iniciar sesión nuevamente.'))return;
  const {error}=await sb.rpc('nexmir_session_reset_user',{p_user_id:id});
  if(error)return alert(error.message);
  await load();
 }

 /* ---------- Activar / renovar Pro ---------- */
 function previewExpiry(row,days){
  // Misma regla que admin_grant_pro: si sigue vigente se suma al último día; si no, desde hoy (hora de Lima).
  const info=planInfo(row);let base;
  if(info.kind==='pro'||info.kind==='pro-soon'){const p=limaParts(new Date(row.plan_expires_at));base=Date.UTC(+p.year,+p.month-1,+p.day)}
  else{const p=limaParts(new Date());base=Date.UTC(+p.year,+p.month-1,+p.day)}
  const end=new Date(base+Number(days||PRICE.days)*MS_DAY);
  return new Intl.DateTimeFormat('es-PE',{timeZone:'UTC',weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(end);
 }
 function grantDialog(){
  let d=$('#planGrantDialog');
  if(!d){d=document.createElement('dialog');d.id='planGrantDialog';d.className='planDialog';document.body.append(d)}
  return d;
 }
 function openGrant(id){
  const row=st.rows.find(x=>String(x.id)===String(id));if(!row)return;
  const info=planInfo(row),renew=info.kind==='pro'||info.kind==='pro-soon';
  const d=grantDialog();
  d.innerHTML=`<button class="dialogClose" type="button" id="planGrantClose" aria-label="Cerrar">×</button>
   <div class="eyebrow">${renew?'RENOVAR PLAN PRO':'ACTIVAR PLAN PRO'}</div>
   <h2>${esc2(row.display_name||'Sin nombre')}</h2><p class="muted">${esc2(row.email||row.id)}</p>
   ${renew?`<p class="planNotice">Pro vigente hasta el <strong>${esc2(fmtDate(row.plan_expires_at))}</strong>. Los días nuevos se suman a esa fecha; no pierde ninguno.</p>`:''}
   <p class="planNotice strong">Confirma el pago <u>antes</u> de activar. Precio: S/ ${PRICE.PEN} o US$ ${PRICE.USD} por ${PRICE.days} días calendario.</p>
   <div class="planForm">
    <label>Moneda<select id="pgCurrency"><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select></label>
    <label>Monto verificado<input id="pgAmount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${PRICE.PEN}"></label>
    <label>Medio de pago<input id="pgMethod" list="pgMethods" placeholder="Yape, Interbank, Scotiabank…" autocomplete="off"></label>
    <label>N.º de operación<input id="pgRef" placeholder="Evita registrar dos veces el mismo comprobante" autocomplete="off"></label>
    <label class="wide">Nota (opcional)<input id="pgNote" placeholder="Ej.: pagó por WhatsApp el 12/10" autocomplete="off"></label>
    <label>Días de acceso<input id="pgDays" type="number" min="1" max="366" step="1" value="${PRICE.days}"></label>
   </div>
   <datalist id="pgMethods"><option value="Yape"><option value="Plin"><option value="Interbank"><option value="Banco de la Nación"><option value="Scotiabank"><option value="BCP"><option value="PayPal"><option value="Efectivo"></datalist>
   <p class="planPreview" id="pgPreview"></p>
   <div class="actions planDialogActions"><button class="secondary" type="button" id="pgCancel">Cancelar</button><button class="primary" type="button" id="pgConfirm">${renew?'Confirmar pago y renovar':'Confirmar pago y activar'}</button></div>
   <p class="planError hidden" id="pgError" role="alert"></p>`;
  const cur=d.querySelector('#pgCurrency'),amt=d.querySelector('#pgAmount'),days=d.querySelector('#pgDays'),prev=d.querySelector('#pgPreview');
  const upd=()=>{prev.innerHTML=`Pro hasta el final del <strong>${esc2(previewExpiry(row,days.value))}</strong> (hora de Lima). Si no renueva, se retira solo.`};
  cur.onchange=()=>{amt.value=PRICE[cur.value];upd()};days.oninput=upd;upd();
  d.querySelector('#planGrantClose').onclick=d.querySelector('#pgCancel').onclick=()=>d.close();
  d.querySelector('#pgConfirm').onclick=async()=>{
   const btn=d.querySelector('#pgConfirm'),err=d.querySelector('#pgError');err.classList.add('hidden');
   const amount=Number(amt.value),dn=Number(days.value);
   if(!(amount>0)){err.textContent='Indica el monto verificado del pago.';err.classList.remove('hidden');return}
   if(!Number.isInteger(dn)||dn<1||dn>366){err.textContent='Los días deben ser un número entero entre 1 y 366.';err.classList.remove('hidden');return}
   const ref=d.querySelector('#pgRef').value.trim();
   if(!ref&&!confirm('No ingresaste número de operación. Sin él no se detectan comprobantes repetidos. ¿Continuar igual?'))return;
   btn.disabled=true;const old=btn.textContent;btn.textContent='Guardando…';
   try{
    const {data,error}=await sb.rpc('admin_grant_pro',{p_user:id,p_amount:amount,p_currency:cur.value,p_method:d.querySelector('#pgMethod').value.trim()||null,p_reference:ref||null,p_note:d.querySelector('#pgNote').value.trim()||null,p_days:dn});
    if(error)throw error;
    const fresh=await refreshRow(id);
    d.close();
    alert(`Plan Pro ${data?.action==='renew'?'renovado':'activado'} para ${fresh.display_name||fresh.email||'el usuario'}.\nVence el ${fmtDate(fresh.plan_expires_at)} (hora de Lima).`);
   }catch(e){
    const msg=e.message||'';
    err.textContent=(/PGRST202|schema cache|Could not find the function/i.test(msg))?'Falta ejecutar supabase/PLAN_PRO_30_DIAS_5_1_39.sql en Supabase.':(msg||'No se pudo activar el plan.');
    err.classList.remove('hidden');btn.disabled=false;btn.textContent=old;
   }
  };
  d.showModal();
 }

 async function revoke(id){
  const row=st.rows.find(x=>String(x.id)===String(id));if(!row)return;
  if(!confirm(`¿Quitar el Plan Pro a ${row.display_name||row.email||'este usuario'} ahora mismo?\nVolverá a Free de inmediato.`))return;
  const reason=prompt('Motivo (opcional): reembolso, error de pago, etc.','');
  if(reason===null)return;
  try{const {error}=await sb.rpc('admin_revoke_pro',{p_user:id,p_reason:reason||null});if(error)throw error;await refreshRow(id);alert('Plan Pro retirado. La cuenta volvió a Free.')}
  catch(e){alert(e.message||'No se pudo quitar el plan.')}
 }

 /* ---------- Historial de pagos ---------- */
 async function openHistory(id){
  const row=st.rows.find(x=>String(x.id)===String(id));if(!row)return;
  let d=$('#planHistoryDialog');if(!d){d=document.createElement('dialog');d.id='planHistoryDialog';d.className='planDialog';document.body.append(d)}
  d.innerHTML=`<button class="dialogClose" type="button" id="planHistClose" aria-label="Cerrar">×</button><div class="eyebrow">PAGOS Y CAMBIOS DE PLAN</div><h2>${esc2(row.display_name||'Sin nombre')}</h2><p class="muted">${esc2(row.email||row.id)}</p><div id="planHistBody" class="muted">Cargando…</div>`;
  d.querySelector('#planHistClose').onclick=()=>d.close();d.showModal();
  const body=d.querySelector('#planHistBody');
  try{
   const {data,error}=await sb.from('plan_payments').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(100);
   if(error)throw error;
   if(!data?.length){body.textContent='Todavía no hay pagos registrados para esta cuenta.';return}
   const label={grant:'Activación',renew:'Renovación',revoke:'Retiro manual',expire:'Vencimiento'};
   body.className='';
   body.innerHTML=`<div class="tableWrap"><table class="adminTable"><thead><tr><th>Fecha</th><th>Evento</th><th>Monto</th><th>Medio / operación</th><th>Vence</th><th>Nota</th></tr></thead><tbody>${data.map(p=>`<tr><td>${esc2(fmtDateTime(p.created_at))}</td><td>${esc2(label[p.action]||p.action)}</td><td>${p.amount!=null?esc2((p.currency==='USD'?'US$ ':'S/ ')+Number(p.amount).toFixed(2)):'—'}</td><td>${esc2([p.method,p.reference].filter(Boolean).join(' · ')||'—')}</td><td>${esc2(fmtDate(p.expires_at))}</td><td>${esc2(p.note||'—')}</td></tr>`).join('')}</tbody></table></div>`;
  }catch(e){body.textContent=/does not exist|schema cache|plan_payments/i.test(e.message||'')?'Falta ejecutar supabase/PLAN_PRO_30_DIAS_5_1_39.sql en Supabase.':(e.message||'No se pudo cargar el historial.')}
 }

 function init(){
  document.querySelector('[data-view="users"]')?.addEventListener('click',()=>setTimeout(load,0));
  $('#usersRefresh').onclick=load;
  ['usersSearch','usersPlan','usersRole'].forEach(id=>{$('#'+id).oninput=render;$('#'+id).onchange=render});
 }
 init();
})();
