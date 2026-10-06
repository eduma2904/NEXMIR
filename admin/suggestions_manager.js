/* NEXMIR V5.0.29 · bandeja de sugerencias */
(() => {
 const statusLabels={open:'Pendiente',reviewing:'En revisión',planned:'Planificada',done:'Completada',dismissed:'Descartada'};
 const categoryLabels={feature:'Nueva función',improvement:'Mejora',problem:'Problema',other:'Otro'};
 let rows=[],profiles=new Map();
 const oldGo=go;
 go=function(view){oldGo(view);if(view==='suggestions')loadSuggestions()};
 async function loadSuggestions(){
   const box=document.getElementById('suggestionsList'),msg=document.getElementById('suggestionsMessage');if(!box)return;
   if(!cloudMode||!sb){msg.textContent='Conecta Supabase e inicia sesión como administrador.';box.innerHTML='';return}
   msg.textContent='Cargando sugerencias…';
   const [{data,error},{data:profileRows}]=await Promise.all([sb.from('feature_suggestions').select('*').order('created_at',{ascending:false}).limit(500),sb.from('profiles').select('id,display_name,email')]);
   if(error){msg.textContent=error.message;box.innerHTML='';return}
   rows=data||[];profiles=new Map((profileRows||[]).map(p=>[p.id,p]));msg.textContent=`${rows.length} sugerencias cargadas`;renderSuggestions();
 }
 function renderSuggestions(){
   const box=document.getElementById('suggestionsList');if(!box)return;
   const st=document.getElementById('suggestionsStatus')?.value||'open',cat=document.getElementById('suggestionsCategory')?.value||'all';
   const arr=rows.filter(x=>(st==='all'||x.status===st)&&(cat==='all'||x.category===cat));
   box.innerHTML=arr.map(x=>{const p=profiles.get(x.user_id)||{};return `<div class="contentRow suggestionAdminRow"><span class="badge">${esc(categoryLabels[x.category]||x.category)}</span><div><strong>${esc(x.title||'Sin título')}</strong><div class="question">${esc(x.detail)}</div><div class="meta">${new Date(x.created_at).toLocaleString('es-ES')} · ${esc(p.display_name||p.email||x.user_id)}${p.email&&p.display_name?` · ${esc(p.email)}`:''}</div><label class="fieldLabel">Nota para el usuario<textarea class="suggestionNote" data-id="${esc(x.id)}" rows="2" maxlength="2000">${esc(x.admin_note||'')}</textarea></label></div><div><label class="fieldLabel">Estado<select class="suggestionState" data-id="${esc(x.id)}">${Object.entries(statusLabels).map(([k,v])=>`<option value="${k}" ${x.status===k?'selected':''}>${v}</option>`).join('')}</select></label><button class="secondary suggestionSave" data-id="${esc(x.id)}">Guardar</button></div></div>`}).join('')||'<div class="empty">No hay sugerencias con esos filtros.</div>';
   box.querySelectorAll('.suggestionSave').forEach(b=>b.onclick=()=>saveSuggestion(b.dataset.id));
 }
 async function saveSuggestion(id){
   const status=document.querySelector(`.suggestionState[data-id="${CSS.escape(id)}"]`)?.value||'open';
   const admin_note=document.querySelector(`.suggestionNote[data-id="${CSS.escape(id)}"]`)?.value.trim()||null;
   const patch={status,admin_note,reviewed_by:cloudUser.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
   const {data,error}=await sb.from('feature_suggestions').update(patch).eq('id',id).select().single();
   if(error){document.getElementById('suggestionsMessage').textContent=error.message;return}
   rows=rows.map(x=>x.id===id?data:x);document.getElementById('suggestionsMessage').textContent='Sugerencia actualizada';renderSuggestions();
 }
 window.loadSuggestions=loadSuggestions;window.renderSuggestions=renderSuggestions;
 document.getElementById('suggestionsRefresh')?.addEventListener('click',loadSuggestions);
 document.getElementById('suggestionsStatus')?.addEventListener('change',renderSuggestions);
 document.getElementById('suggestionsCategory')?.addEventListener('change',renderSuggestions);
})();
