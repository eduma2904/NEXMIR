/* Bandeja editorial: el estudiante envía observaciones, solo el panel decide. */
let questionReports=[];
const reportPartLabels={question:'Pregunta',answer:'Respuesta',explanation:'Explicación',image:'Imagen',other:'Otra'};
const reportStatusLabels={open:'Pendiente',reviewing:'En revisión',resolved:'Resuelto',dismissed:'Descartado'};
const oldAdminGo=go;
go=function(view){oldAdminGo(view);if(view==='reports')loadQuestionReports()};
async function loadQuestionReports(){
    const message=document.getElementById('reportsMessage');
    if(!cloudMode||!sb){message.textContent='Conecta Supabase e inicia sesión como admin para ver los reportes.';document.getElementById('reportsList').innerHTML='';return}
    message.textContent='Cargando reportes…';
    let {data,error}=await sb.rpc('nexmir_list_question_reports');
    if(error)({data,error}=await sb.from('question_reports').select('*').order('created_at',{ascending:false}).limit(500));
    if(error){message.textContent='No pude cargar los reportes. Ejecuta el archivo supabase/REPORTES_ADMIN.sql y vuelve a entrar como admin. '+error.message;return}
    questionReports=data||[];message.textContent=`${questionReports.length} reportes recientes`;renderQuestionReports();
  };
function renderQuestionReports(){
  const status=document.getElementById('reportStatusFilter').value;
  const rows=questionReports.filter(r=>status==='all'||r.status===status);
  document.getElementById('reportsList').innerHTML=rows.map(r=>`<div class="contentRow"><span class="badge">${esc(reportStatusLabels[r.status]||r.status)}</span><div><strong>${esc(reportPartLabels[r.part]||r.part)} · ${esc(r.category)}</strong><div class="question">${esc(r.detail)}</div><div class="meta">${new Date(r.created_at).toLocaleString('es-ES')} · ${esc(r.source_type)} · ${esc(r.source_id)}</div>${r.admin_note?`<div class="meta">Admin: ${esc(r.admin_note)}</div>`:''}</div><button class="secondary" onclick="openReportedQuestion('${r.id}')">Revisar</button></div>`).join('')||'<div class="empty">No hay reportes en este estado.</div>';
}
async function openReportedQuestion(id){
  const r=questionReports.find(x=>x.id===id);if(!r)return;
  const classification=r.source_type==='arcade'&&r.source_id.startsWith('classification:');
  const table=r.source_type==='questions'?'questions':r.source_type==='arcade'?'arcade_questions':'content_items';
  const {data,error}=classification?{data:null,error:null}:await sb.from(table).select('*').eq('id',r.source_id).maybeSingle();
  const text=classification?'Clasificaciones MIR · El enunciado original figura entre corchetes en el reporte. Revisa esta tabla en Arcade · Clasificaciones.':data?(r.source_type==='questions'?data.stem||data.question:r.source_type==='arcade'?data.clue+' · '+data.answer:data.payload?.front||data.payload?.question):'';
  const explanation=data?(r.source_type==='questions'||r.source_type==='arcade'?data.explanation:data.payload?.explanation):'';
  const body=document.getElementById('dialogBody');
  body.innerHTML=`<div class="detail"><h2>Reporte editorial</h2><p><strong>${esc(reportPartLabels[r.part]||r.part)}:</strong> ${esc(r.detail)}</p><p class="muted">${esc(r.source_type)} · ${esc(r.source_id)}</p><hr><h3>Contenido actual</h3><p>${error?'No se pudo leer: '+esc(error.message):esc(text||'El contenido fue archivado o eliminado.')}</p>${explanation?`<p><strong>Explicación:</strong> ${esc(Array.isArray(explanation)?explanation.join(' '):explanation)}</p>`:''}<hr><label class="fieldLabel">Estado<select id="editReportStatus">${Object.entries(reportStatusLabels).map(([value,label])=>`<option value="${value}" ${r.status===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="fieldLabel">Nota administrativa<textarea id="editReportNote" maxlength="2000" rows="3">${esc(r.admin_note||'')}</textarea></label><div class="actions"><button class="primary" onclick="saveReportedQuestion('${r.id}')">Guardar revisión</button></div><p id="editReportMessage" class="muted"></p></div>`;
  document.getElementById('detailDialog').showModal();
}
async function saveReportedQuestion(id){
  const status=document.getElementById('editReportStatus').value,note=document.getElementById('editReportNote').value.trim();
  const {data,error}=await sb.from('question_reports').update({status,admin_note:note||null,reviewed_by:cloudUser.id,reviewed_at:new Date().toISOString()}).eq('id',id).select().single();
  if(error){document.getElementById('editReportMessage').textContent=error.message;return}
  questionReports=questionReports.map(r=>r.id===id?data:r);document.getElementById('detailDialog').close();renderQuestionReports();
}
