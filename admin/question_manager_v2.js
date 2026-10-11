/* Banco editorial: preguntas formales y tarjetas tipo test publicadas. */
(()=>{
  const $=s=>document.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)],safe=s=>esc(String(s??''));
  const Q=window.NexmirQuestionQuality;
  const st={rows:[],flags:new Map(),stats:new Map(),page:0};
  const unclassified=q=>RemnoteTaxonomy.unclassified(q.specialty);
  const sourceType=q=>RemnoteTaxonomy.simulationContent(q)?'simulation':q._source==='remnote'?'bank':/^Banco:/i.test(String(q.source||''))||/bank|^remnote:/i.test(String(q.source_uid||''))?'bank':'other';
  const sourceLabel=q=>q._source==='remnote'?'Tarjeta RemNote':q.source_exam||q.source||q.source_uid||'—';
  const issues=q=>[...(st.flags.get(Q.key(q))||[]),...(unclassified(q)?['sin clasificar']:[])];
  const priority=q=>{const r=st.stats.get(Q.key(q));return r&&Number(r.attempts)>=5&&Number(r.users)>=3&&Number(r.users_wrong)>=2?Number(r.users_wrong)*100+Number(r.incorrect)/Number(r.attempts)*20:0};
  function mapRemnote(x){const p=x.payload||{},options=(p.options||[]).map(o=>typeof o==='string'?o:o.text||'');return {...x,_source:'remnote',stem:p.front||p.question||'',options,correct_index:(p.options||[]).findIndex(o=>o&&typeof o==='object'&&o.correct),explanation:Array.isArray(p.explanation)?p.explanation.join('\n'):p.explanation||'',image_path:p.images?.[0]||null,source:x.source_path||'RemNote'}}
  async function load(){
    const body=$('#qmBody');if(!body)return;
    if(!cloudMode||!sb){body.innerHTML='<tr><td colspan="9">Conecta Supabase como administrador.</td></tr>';return}
    body.innerHTML='<tr><td colspan="9">Cargando preguntas…</td></tr>';
    try{
      const [formal,content,summary,reports]=await Promise.all([
        fetchAllPages(()=>sb.from('questions').select('*').order('updated_at',{ascending:false})),
        fetchAllPages(()=>sb.from('content_items').select('id,kind,card_type,payload,status,specialty,topic,subtopic,section,source_path,updated_at').eq('kind','card').eq('status','published')),
        sb.rpc('nexmir_editorial_question_stats'),
        sb.rpc('nexmir_list_question_reports')
      ]);
      const remnote=(content||[]).filter(x=>x.card_type==='multiple_choice'||x.payload?.type==='multiple_choice').map(mapRemnote);
      st.rows=[...(formal||[]).map(q=>({...q,_source:'questions'})),...remnote];
      st.stats=new Map((summary.data||[]).map(x=>[`${x.source_type}:${x.source_id}`,x]));
      st.flags=Q.inspect(st.rows,reports.data||[]);
      $('#qmEditorialStatus').textContent=summary.error?'Para ordenar por fallos de usuarios, ejecuta supabase/MEJORAS_ESTUDIO_PLANES_5_1_36.sql.':'Prioridad basada en respuestas válidas de al menos 3 usuarios y 5 intentos.';
      fillFilters();st.page=0;render();
    }catch(error){body.innerHTML=`<tr><td colspan="9">${safe(error.message)}</td></tr>`}
  }
  function fillFilters(){
    const sp=$('#qmSpecialty'),tp=$('#qmTopic'),old=sp.value,oldTopic=tp.value;
    const names=[...new Set([...RemnoteTaxonomy.subjects,...st.rows.filter(q=>!unclassified(q)).map(q=>q.specialty)])].sort((a,b)=>a.localeCompare(b,'es'));
    sp.innerHTML='<option value="all">Todas las asignaturas MIR</option><option value="__unclassified">Sin clasificar</option>'+names.map(x=>`<option value="${safe(x)}">${safe(x)}</option>`).join('');if([...sp.options].some(o=>o.value===old))sp.value=old;refreshTopics(oldTopic);
  }
  function refreshTopics(old){const sp=$('#qmSpecialty').value,topics=[...new Set(st.rows.filter(q=>sp==='all'||sp==='__unclassified'&&unclassified(q)||q.specialty===sp).map(q=>q.topic).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),tp=$('#qmTopic');tp.innerHTML='<option value="all">Todos los temas</option>'+topics.map(x=>`<option value="${safe(x)}">${safe(x)}</option>`).join('');if(topics.includes(old))tp.value=old}
  function filtered(){
    const term=RemnoteTaxonomy.searchable($('#qmSearch').value),status=$('#qmStatus').value,sp=$('#qmSpecialty').value,topic=$('#qmTopic').value,src=$('#qmSource').value,quality=$('#qmQuality').value;
    return st.rows.filter(q=>{
      if(status!=='all'&&(q.status||'published')!==status)return false;
      if(sp==='__unclassified'&&!unclassified(q)||sp!=='all'&&sp!=='__unclassified'&&q.specialty!==sp)return false;
      if(topic!=='all'&&q.topic!==topic||src!=='all'&&sourceType(q)!==src)return false;
      if(term&&!RemnoteTaxonomy.searchable([q.stem,q.options,q.explanation,q.specialty,q.topic,q.subtopic,sourceLabel(q)]).includes(term))return false;
      const f=issues(q);
      if(quality==='problems'&&!f.length||quality==='unclassified'&&!unclassified(q)||quality==='duplicates'&&!f.includes('posible duplicado')||quality==='ambiguous'&&!f.some(x=>/ambigu|repetidas/.test(x))||quality==='inconsistent'&&!f.includes('respuesta inconsistente')||quality==='incomplete'&&!f.some(x=>x.includes('explicación'))||quality==='priority'&&!priority(q)||quality==='no_explanation'&&String(q.explanation||'').trim()||quality==='no_image'&&q.image_path)return false;
      return true;
    }).sort((a,b)=>priority(b)-priority(a)||issues(b).length-issues(a).length||String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
  }
  function render(){
    const rows=filtered(),body=$('#qmBody'),empty=$('#qmEmpty'),pageSize=100,pages=Math.max(1,Math.ceil(rows.length/pageSize));st.page=Math.min(st.page,pages-1);
    const count=k=>st.rows.filter(q=>issues(q).includes(k)).length;
    $('#qmStats').innerHTML=`<div class="stat"><div class="num">${st.rows.length}</div><div class="label">Preguntas y tarjetas test</div></div><div class="stat"><div class="num">${st.rows.filter(x=>x.status==='published').length}</div><div class="label">Publicadas</div></div><div class="stat"><div class="num">${st.rows.filter(q=>issues(q).length).length}</div><div class="label">Para revisar</div></div><div class="stat"><div class="num">${count('posible duplicado')}</div><div class="label">Posibles duplicados</div></div><div class="stat"><div class="num">${count('respuesta inconsistente')}</div><div class="label">Respuestas inconsistentes</div></div><div class="stat"><div class="num">${st.rows.filter(priority).length}</div><div class="label">Prioridad por fallos</div></div>`;
    empty.classList.toggle('hidden',rows.length>0);
    body.innerHTML=rows.slice(st.page*pageSize,(st.page+1)*pageSize).map(q=>{
      const f=issues(q),stat=st.stats.get(Q.key(q)),strong=priority(q)>0;
      return `<tr data-source="${q._source}"><td>${safe(q.source_number??'—')}</td><td><div class="qmStem">${safe(q.stem||'')}</div>${f.length?`<div class="qmIssue">⚠ ${safe(f.join(' · '))}</div>`:''}</td><td><strong>${safe(q.specialty||'Sin clasificar')}</strong><div class="muted">${safe([q.topic,q.subtopic].filter(Boolean).join(' › ')||'General')}</div></td><td>${safe(sourceLabel(q))}</td><td>${q.explanation?'✓':'—'}</td><td>${q.image_path?'✓':'—'}</td><td>${strong?`<strong>${stat.users_wrong} usuarios fallaron</strong><div class="muted">${Math.round(100*stat.incorrect/stat.attempts)}% · ${stat.attempts} intentos</div>`:'<span class="muted">Sin muestra suficiente</span>'}</td><td><span class="statusPill ${safe(q.status||'published')}">${safe(q.status||'published')}</span></td><td><div class="actions">${q._source==='remnote'?`<button class="secondary qmOpenContent" data-id="${safe(q.id)}">Ver tarjeta</button>`:`<button class="secondary qmEdit" data-id="${safe(q.id)}">Editar</button><button class="secondary qmArchive" data-id="${safe(q.id)}">${q.status==='archived'?'Publicar':'Archivar'}</button>${cloudRole==='admin'?`<button class="secondary danger qmDelete" data-id="${safe(q.id)}">Eliminar</button>`:''}`}</div></td></tr>`;
    }).join('');
    $$('.qmEdit',body).forEach(b=>b.onclick=()=>edit(b.dataset.id));$$('.qmArchive',body).forEach(b=>b.onclick=()=>toggleArchive(b.dataset.id));$$('.qmDelete',body).forEach(b=>b.onclick=()=>remove(b.dataset.id));$$('.qmOpenContent',body).forEach(b=>b.onclick=()=>openContent(b.dataset.id));
    $('#qmPager').innerHTML=rows.length>pageSize?`<button class="secondary" id="qmPrev" ${st.page===0?'disabled':''}>Anterior</button><span>${st.page+1} / ${pages} · ${rows.length} resultados</span><button class="secondary" id="qmNext" ${st.page+1>=pages?'disabled':''}>Siguiente</button>`:`<span>${rows.length} resultado(s)</span>`;
    $('#qmPrev')?.addEventListener('click',()=>{st.page--;render()});$('#qmNext')?.addEventListener('click',()=>{st.page++;render()});
  }
  function openContent(id){const q=st.rows.find(x=>x._source==='remnote'&&String(x.id)===String(id));if(!q)return;go('content');$('#contentType').value='multiple_choice';$('#contentSearch').value=String(q.stem||'').slice(0,50);renderContent()}
  function edit(id){
    const q=st.rows.find(x=>x._source==='questions'&&String(x.id)===String(id));if(!q)return;
    const opts=Array.from({length:Math.max(2,Array.isArray(q.options)?q.options.length:0)},(_,i)=>(q.options||[])[i]||''),dialog=$('#questionManagerDialog'),body=$('#questionManagerBody');
    body.innerHTML=`<div class="questionEditor"><div class="questionEditorHead"><h2>Editar pregunta</h2><span class="statusPill ${safe(q.status)}">${safe(q.status)}</span></div><section class="qeCard"><label class="fieldLabel">Enunciado<textarea id="qmEStem" class="qeTextarea qeStem" lang="es" spellcheck="true">${safe(q.stem)}</textarea></label></section><section class="qeCard"><h3>Alternativas</h3><div class="qeOptions">${opts.map((o,i)=>`<label class="qeOption"><span class="qeLetter">${String.fromCharCode(65+i)}</span><textarea class="qeTextarea qmOption" lang="es" spellcheck="true">${safe(typeof o==='string'?o:o?.text||'')}</textarea></label>`).join('')}</div></section><section class="qeCard"><div class="qeMetaGrid"><label class="fieldLabel">Respuesta correcta<select id="qmECorrect"><option value="">Sin detectar</option>${opts.map((_,i)=>`<option value="${i}" ${q.correct_index!=null&&Number(q.correct_index)===i?'selected':''}>${String.fromCharCode(65+i)}</option>`).join('')}</select></label><label class="fieldLabel">Estado<select id="qmEStatus">${['published','draft','archived'].map(s=>`<option value="${s}" ${q.status===s?'selected':''}>${s}</option>`).join('')}</select></label><label class="fieldLabel">Asignatura MIR<input id="qmESp" list="classificationSubjects" value="${safe(unclassified(q)?'':q.specialty)}"></label><label class="fieldLabel">Tema<input id="qmETopic" value="${safe(q.topic||'')}"></label><label class="fieldLabel">Subtema<input id="qmESub" value="${safe(q.subtopic||'')}"></label></div></section><section class="qeCard"><label class="fieldLabel">Explicación<textarea id="qmEExp" class="qeTextarea qeExplain" lang="es" spellcheck="true">${safe(q.explanation||'')}</textarea></label></section><div class="qeSticky"><button id="qmECancel" class="secondary">Cancelar</button><button id="qmESave" class="primary">Guardar cambios</button></div></div>`;
    $('#qmECancel').onclick=()=>dialog.close();$('#qmESave').onclick=async()=>{
      let classification;try{classification=RemnoteTaxonomy.manual($('#qmESp').value,{topic:$('#qmETopic').value,subtopic:$('#qmESub').value,section:q.section})}catch(e){return alert(e.message)}
      const patch={stem:$('#qmEStem').value.trim(),options:$$('.qmOption',body).map(x=>x.value.trim()),correct_index:$('#qmECorrect').value===''?null:Number($('#qmECorrect').value),explanation:$('#qmEExp').value.trim()||null,specialty:classification.specialty,topic:classification.topic,subtopic:classification.subtopic,section:classification.section,remnote_metadata:{...(q.remnote_metadata||{}),classification_origin:'admin_manual'},status:$('#qmEStatus').value,updated_at:new Date().toISOString()};
      if(!patch.stem||patch.options.filter(Boolean).length<2)return alert('Completa el enunciado y al menos dos alternativas.');
      const {error}=await sb.from('questions').update(patch).eq('id',q.id);if(error)return alert(error.message);dialog.close();await load();
    };dialog.showModal();
  }
  async function toggleArchive(id){const q=st.rows.find(x=>x._source==='questions'&&String(x.id)===String(id));if(!q)return;const status=q.status==='archived'?'published':'archived';if(!confirm(`¿${status==='archived'?'Archivar':'Publicar'} esta pregunta?`))return;const {error}=await sb.from('questions').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(error)return alert(error.message);await load()}
  async function remove(id){const q=st.rows.find(x=>x._source==='questions'&&String(x.id)===String(id));if(!q||cloudRole!=='admin'||!confirm('¿Eliminar esta pregunta de forma permanente?'))return;try{await NexmirContentAdmin.mutate(sb,{id,kind:'question',action:'delete',updatedAt:q.updated_at});await load()}catch(e){alert(e.message)}}
  document.querySelector('[data-view="questions"]')?.addEventListener('click',()=>setTimeout(load,0));
  $('#qmRefresh').onclick=load;$('#qmSpecialty').onchange=()=>{refreshTopics();st.page=0;render()};['qmSearch','qmStatus','qmTopic','qmSource','qmQuality'].forEach(id=>{const el=$('#'+id);el.oninput=el.onchange=()=>{st.page=0;render()}});$('#questionManagerClose').onclick=()=>$('#questionManagerDialog').close();
  window.NexmirQuestionsBulk={all:()=>filtered().filter(q=>q._source==='questions'),visible:()=>filtered().filter(q=>q._source==='questions').slice(st.page*100,(st.page+1)*100),selector:'#qmBody tr[data-source="questions"]',host:'#qmBody',key:q=>String(q.id),canWrite:()=>cloudMode&&cloudRole==='admin',remove:async q=>{const {error}=await sb.from('questions').delete().eq('id',q.id);if(error)throw error;st.rows=st.rows.filter(x=>x.id!==q.id)},refresh:load};
})();
