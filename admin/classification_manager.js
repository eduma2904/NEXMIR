/* NEXMIR V5.0.23 · unified editor for published RemNote content and question banks. */
(function(global){
  const st={rows:[],selected:new Set(),page:0,busy:false,pending:null},PAGE=100;
  const el=id=>document.getElementById(id),key=r=>r.kind+':'+r.id;
  const html=`<section id="groupingView" class="view hidden">
    <div class="pageHead"><div><div class="eyebrow">CONTENIDO PUBLICADO</div><h1>Desagrupadas / Agrupar</h1><p>Flashcards, teoría y preguntas del banco en una sola vista. Selecciona y corrige su especialidad, tema, subtema o apartado.</p></div><button id="groupRefresh" class="secondary">Actualizar</button></div>
    <div class="cardBox"><div class="filters groupingFilters"><input id="groupSearch" type="search" placeholder="Buscar texto, carpeta de origen o clasificación"><select id="groupScope"><option value="unclassified">Solo desagrupadas</option><option value="all">Todo lo publicado</option></select><select id="groupKind"><option value="all">Todos los contenidos</option><option value="card">Flashcards</option><option value="theory">Teoría</option><option value="question">Preguntas del banco</option></select></div></div>
    <div class="bulkbar groupingActions"><label><input id="groupVisible" type="checkbox"> Seleccionar página</label><button id="groupSelectAll" class="secondary">Seleccionar todo el filtro</button><button id="groupClear" class="secondary">Limpiar selección</button><button id="groupEditSelected" class="primary">Agrupar seleccionadas</button><button id="groupRepair" class="secondary">Recuperar jerarquía RemNote</button></div>
    <p id="groupMessage" class="muted" aria-live="polite"></p><div id="groupPager" class="diffPager"></div><div id="groupList" class="panel"></div>
  </section>`;
  document.querySelector('main.main').insertAdjacentHTML('beforeend',html);
  document.body.insertAdjacentHTML('beforeend',`<datalist id="classificationSubjects">${RemnoteTaxonomy.subjects.map(s=>`<option value="${esc(s)}"></option>`).join('')}</datalist>
    <dialog id="classificationDialog" class="classificationDialog"><div id="classificationBody"></div></dialog>`);
  function publishedRecord(kind,r){
    if(kind==='content')return {kind,id:r.id,uid:r.source_uid,status:r.status,version:r.current_version,updated_at:r.updated_at,
      specialty:r.specialty??r.payload?.specialty,topic:r.topic??r.payload?.topic,subtopic:r.subtopic??r.payload?.subtopic,section:r.section??r.payload?.section,
      source:r.source_path||r.payload?.source||'',context:r.payload?.context||[],origin:r.payload?.classification_origin,payload:r.payload||{},record:r};
    const meta=r.remnote_metadata||{};
    return {kind,id:r.id,uid:r.source_uid,status:r.status,updated_at:r.updated_at,specialty:r.specialty,topic:r.topic,subtopic:r.subtopic,section:r.section,
      source:meta.source_path||r.source||r.source_exam||'',context:meta.context||[],origin:meta.classification_origin,payload:r,record:r};
  }
  async function load(){
    if(st.busy)return;
    el('groupMessage').textContent='Cargando contenidos publicados…';st.selected.clear();st.page=0;
    try{
      if(cloudMode){
        const [content,questions]=await Promise.all([
          fetchAllPages(()=>sb.from('content_items').select('*').eq('status','published').order('id')),
          fetchAllPages(()=>sb.from('questions').select('*').eq('status','published').order('id'))
        ]);
        st.rows=[...content.map(r=>publishedRecord('content',r)),...questions.map(r=>publishedRecord('question',r))];
      }else{
        st.rows=[];for(const [kind,bucket] of [['card',state.db.cards],['theory',state.db.theory]])for(const r of Object.values(bucket))if(r.status==='published'){
          st.rows.push({kind:'content',id:r.id||r.uid,uid:r.uid,status:r.status,version:r.version,updated_at:r.updated_at,...r.current,payload:r.current,localKind:kind});
        }
      }
      render();
    }catch(error){el('groupMessage').textContent='No se pudo cargar: '+(error.message||error)}
  }
  function filtered(){
    const q=normalize(el('groupSearch').value),scope=el('groupScope').value,kind=el('groupKind').value;
    return st.rows.filter(r=>(scope!=='unclassified'||isUnclassifiedValue(r.specialty))&&(kind==='all'||(kind==='question'?r.kind==='question':r.kind==='content'&&(kind==='theory'?r.record?.kind==='theory'||r.localKind==='theory':r.record?.kind==='card'||r.localKind==='card')))&&
      (!q||normalize([title(r),r.payload.back,r.specialty,r.topic,r.subtopic,r.section,r.source,...r.context].filter(Boolean).join(' ')).includes(q)));
  }
  function title(r){return stripMd(r.kind==='question'?r.payload.stem:r.payload.front||r.payload.text||'')}
  function label(r){return r.kind==='question'?'Pregunta del banco':r.record?.kind==='theory'||r.localKind==='theory'?'Teoría':'Flashcard'}
  function setBusy(value){
    st.busy=value;el('groupingView').querySelectorAll('button,input,select').forEach(e=>e.disabled=value);
    el('classificationDialog').querySelectorAll('button,input').forEach(e=>e.disabled=value);
    if(!value){
      if(el('groupPrev'))el('groupPrev').disabled=st.page<=0;
      if(el('groupNext'))el('groupNext').disabled=st.page>=Math.ceil(filtered().length/PAGE)-1;
      for(const field of ['Topic','Subtopic','Section'])if(el('classUse'+field))el('class'+field).disabled=!el('classUse'+field).checked;
    }
  }
  function render(){
    const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/PAGE));st.page=Math.min(st.page,pages-1);
    const page=rows.slice(st.page*PAGE,(st.page+1)*PAGE),byKey=new Map(page.map(r=>[key(r),r]));
    el('groupMessage').textContent=`${rows.length} contenidos con este filtro · ${st.selected.size} seleccionados · ${st.rows.filter(r=>isUnclassifiedValue(r.specialty)).length} desagrupados publicados en total`;
    el('groupVisible').checked=page.length>0&&page.every(r=>st.selected.has(key(r)));
    el('groupPager').innerHTML=rows.length?`<button id="groupPrev" class="secondary" ${st.page===0?'disabled':''}>Anterior</button><span>Página ${st.page+1} de ${pages}</span><button id="groupNext" class="secondary" ${st.page===pages-1?'disabled':''}>Siguiente</button>`:'';
    el('groupList').innerHTML=page.length?page.map(r=>`<div class="groupingRow" data-key="${esc(key(r))}"><input class="groupCheck" type="checkbox" ${st.selected.has(key(r))?'checked':''}><div class="groupingText"><strong>${esc(title(r).slice(0,240))}</strong><small>${esc(label(r))} · ${esc(r.source||'Origen no guardado')}</small><span>${esc([isUnclassifiedValue(r.specialty)?'Desagrupadas':r.specialty,r.topic,r.subtopic,r.section].filter(Boolean).join(' › '))}</span></div><button class="secondary groupPreview">Ver / Editar</button></div>`).join(''):'<div class="empty">No hay contenidos con esos filtros. Cambia a «Todo lo publicado» para revisar también los agrupados.</div>';
    if(el('groupPrev'))el('groupPrev').onclick=()=>{st.page--;render()};if(el('groupNext'))el('groupNext').onclick=()=>{st.page++;render()};
    el('groupList').querySelectorAll('.groupingRow').forEach(row=>{
      const k=row.dataset.key,r=byKey.get(k);row.querySelector('.groupCheck').onchange=e=>{e.target.checked?st.selected.add(k):st.selected.delete(k);render()};
      row.querySelector('.groupPreview').onclick=()=>edit([r]);
    });
    if(st.busy)setBusy(true);
  }
  function preview(r){
    if(r.kind==='content')return renderValue({...r.payload,specialty:r.specialty,topic:r.topic,subtopic:r.subtopic,section:r.section});
    const q=r.payload;return `<div class="question">${inlineMd(q.stem||'')}</div><ol>${(q.options||[]).map((o,i)=>`<li>${i===q.correct_index?'✓ ':''}${inlineMd(typeof o==='string'?o:o.text||'')}</li>`).join('')}</ol><p>${inlineMd(q.explanation||'')}</p>`;
  }
  function showForm(rows,save,{imported=false,proposals=null}={}){
    const first=rows[0],single=rows.length===1;
    const proposed=proposals?.[0]||first;
    el('classificationBody').innerHTML=`<div class="compareHead"><h2>${proposals?'Revisar recuperación de jerarquía':'Editar clasificación'}</h2><button id="classClose" class="secondary">Cerrar</button></div>
      <p class="muted">${rows.length} ${imported?'contenidos de la importación':'contenidos publicados'}. ${single?'':'Cambiar la especialidad conserva los temas de cada registro, salvo que actives un campo.'}</p>
      ${proposals?`<div class="classificationProposals">${proposals.slice(0,100).map((p,i)=>`<p><strong>${esc(title(rows[i]).slice(0,90))}</strong><br>${esc([p.specialty,p.topic,p.subtopic,p.section].filter(Boolean).join(' › '))}</p>`).join('')}${proposals.length>100?`<p>Y ${proposals.length-100} propuestas más.</p>`:''}</div>`:
      `<label class="fieldLabel">Especialidad<input id="classSpecialty" list="classificationSubjects" value="${esc(single&&!isUnclassifiedValue(first.specialty)?first.specialty:'')}" placeholder="Elige o escribe una especialidad"></label>
      ${[['Topic','Tema','topic'],['Subtopic','Subtema','subtopic'],['Section','Apartado','section']].map(([id,label,field])=>`<label class="classificationField"><span><input id="classUse${id}" type="checkbox" ${single?'checked':''}> Cambiar ${label.toLowerCase()}</span><input id="class${id}" value="${esc(single?first[field]||'':'')}" placeholder="${label}" ${single?'':'disabled'}></label>`).join('')}`}
      ${single&&!proposals?`<div class="classificationPreview">${preview(first)}</div>`:''}
      <p id="classMessage" class="muted" aria-live="polite"></p><div class="actions"><button id="classSave" class="primary">${proposals?'Aplicar recuperación':'Guardar clasificación'}</button></div>`;
    el('classClose').onclick=()=>el('classificationDialog').close();
    for(const field of ['Topic','Subtopic','Section'])if(el('classUse'+field))el('classUse'+field).onchange=e=>el('class'+field).disabled=!e.target.checked;
    el('classSave').onclick=async()=>{
      try{
        const patches=proposals||rows.map(r=>RemnoteTaxonomy.manual(el('classSpecialty').value,{
          topic:el('classUseTopic').checked?el('classTopic').value:r.topic,
          subtopic:el('classUseSubtopic').checked?el('classSubtopic').value:r.subtopic,
          section:el('classUseSection').checked?el('classSection').value:r.section
        }));
        await save(patches);
      }catch(e){el('classMessage').textContent=e.message||String(e)}
    };
    el('classificationDialog').showModal();
  }
  function edit(rows){if(st.busy||st.pending)return;if(!rows.length){alert('Selecciona al menos un contenido.');return}showForm(rows,patches=>savePublished(rows,patches))}
  async function savePublished(rows,patches){
    if(remnoteQueue.running||remnoteQueue.publishing||state.import?.cloudPublish)throw new Error('Termina la carga o publicación de RemNote antes de editar lo publicado.');
    if(!cloudMode){
      for(let i=0;i<rows.length;i++){
        const r=rows[i],rec=(r.localKind==='theory'?state.db.theory:state.db.cards)[r.uid];
        Object.assign(rec.current,patches[i]);rec.version++;rec.updated_at=new Date().toISOString();
        rec.versions.push({version:rec.version,action:'updated',published_at:rec.updated_at,value:structuredClone(rec.current)});
      }
      saveDb();el('classificationDialog').close();await load();renderContent();return;
    }
    st.pending={batches:remnoteBatches(rows.map((r,i)=>({kind:r.kind,id:r.id,...patches[i],expected_version:r.version??null,expected_updated_at:r.updated_at??null}))),next:0,changed:0};
    await continueSave();
  }
  async function continueSave(){
    if(st.busy||!st.pending)return;
    const pending=st.pending;setBusy(true);
    try{
      for(;pending.next<pending.batches.length;pending.next++){
        const {data,error}=await sb.rpc('nexmir_regroup_published',{p_changes:pending.batches[pending.next]});
        if(error){
          if(missingRemnoteBatchFunction(error))throw new Error('Para guardar estas agrupaciones ejecuta supabase/CLASIFICACION.sql en Supabase > SQL Editor.');
          throw error;
        }
        pending.changed+=Number(data?.changed||0);
        el('classMessage').textContent=`Guardando lote ${pending.next+1}/${pending.batches.length}…`;
      }
      const changed=pending.changed;st.pending=null;el('classificationDialog').close();setBusy(false);
      await load();if(cloudMode)await loadCloudDb();
      alert(`${changed} contenidos actualizados. Se conservan las preguntas, respuestas y el progreso.`);
    }catch(e){
      if(['40001','22023'].includes(e.code)){st.pending=null;setBusy(false);el('classificationDialog').close();await load();alert((e.message||String(e))+' Los lotes anteriores completados se conservan; revisa la lista actualizada antes de continuar.');return}
      el('classMessage').textContent=(e.message||String(e))+' Puedes reintentar en esta pestaña.';
      el('groupMessage').textContent=(e.message||String(e))+' Usa Reintentar agrupación para continuar.';
    }finally{
      setBusy(false);
      if(st.pending){
        el('groupingView').querySelectorAll('button,input,select').forEach(e=>e.disabled=true);
        el('groupEditSelected').disabled=false;el('groupEditSelected').textContent='Reintentar agrupación';
        el('classificationDialog').querySelectorAll('input').forEach(e=>e.disabled=true);
        el('classSave').disabled=false;el('classSave').textContent='Reintentar agrupación';el('classSave').onclick=continueSave;
        // Missing function before the first batch: allow closing and installing SQL before retry.
        el('classClose').disabled=false;
      }else el('groupEditSelected').textContent='Agrupar seleccionadas';
    }
  }
  function recover(r){
    if(r.origin==='admin_manual')return null;
    let recovered=RemnoteTaxonomy.classify(r.context,r.source);
    if(r.kind==='question'&&!r.context.length&&!r.payload.remnote_metadata?.source_path){
      // Legacy imports discarded paths. Recover only from an exact, unique MCQ match.
      const matches=st.rows.filter(c=>c.kind==='content'&&c.payload.type==='multiple_choice'&&normalize(c.payload.front)===normalize(r.payload.stem)&&
        JSON.stringify((c.payload.options||[]).map(o=>normalize(o.text||o)))===JSON.stringify((r.payload.options||[]).map(o=>normalize(typeof o==='string'?o:o.text))));
      if(matches.length!==1)return null;recovered=RemnoteTaxonomy.classify(matches[0].context,matches[0].source);
    }
    if(isUnclassifiedValue(recovered.specialty))return null;
    return recovered;
  }
  function repair(){
    if(st.busy||st.pending)return;
    const candidates=st.selected.size?st.rows.filter(r=>st.selected.has(key(r))):filtered();
    const rows=[],proposals=[];let unresolved=0;
    for(const r of candidates){const p=recover(r);if(!p){unresolved++;continue}if([r.specialty,r.topic,r.subtopic,r.section].join('§')!==[p.specialty,p.topic,p.subtopic,p.section].join('§')){rows.push(r);proposals.push(p)}}
    if(!rows.length){alert(`No hay correcciones recuperables con este filtro. ${unresolved} registros no tienen una jerarquía original recuperable; puedes seleccionarlos y asignar su especialidad manualmente.`);return}
    showForm(rows,patches=>savePublished(rows,patches),{proposals});
  }
  global.openGrouping=()=>{go('grouping');if(!st.pending)load()};
  global.openImportGrouping=diffs=>{
    if(remnoteQueue.running||remnoteQueue.publishing||state.import?.cloudPublish)return;
    const selected=diffs.filter(d=>d.newValue&&d.status!=='missing');if(!selected.length){alert('Selecciona contenido para agrupar.');return}
    const rows=selected.map(d=>({kind:'content',payload:d.newValue,...d.newValue}));
    showForm(rows,async patches=>{selected.forEach((d,i)=>Object.assign(d.newValue,patches[i]));state.import.meta.unclassified=state.import.diffs.filter(d=>isUnclassifiedValue(d.newValue?.specialty)).length;el('classificationDialog').close();renderCompare()},{imported:true});
  };
  global.validateRemnotePublication=diffs=>{
    const invalid=diffs.filter(d=>d.status!=='missing'&&isUnclassifiedValue(d.newValue?.specialty));
    if(!invalid.length)return true;
    if(global.openFreeClassification){global.openFreeClassification(invalid.map(d=>d.newValue),()=>{if(state.import)renderCompare()});return false}
    alert(`${invalid.length} contenidos seleccionados no tienen especialidad. Usa «Agrupar seleccionadas» antes de publicar. No se ha subido ningún cambio.`);return false;
  };
  global.NexmirGroupingBulk={all:filtered,visible:()=>filtered().slice(st.page*PAGE,(st.page+1)*PAGE),selector:'#groupList .groupingRow',host:'#groupList',selected:st.selected,nativeChecks:true,canWrite:()=>!cloudMode||cloudRole==='admin',key,remove:async r=>{if(cloudMode){if(r.kind==='content')await NexmirContentAdmin.mutate(sb,{id:r.id,action:'delete',version:r.version});else{const result=await sb.from('questions').delete().eq('id',r.id);if(result.error)throw result.error}}else{delete(r.localKind==='theory'?state.db.theory:state.db.cards)[r.uid];saveDb()}st.rows=st.rows.filter(x=>key(x)!==key(r))},refresh:async()=>{await load();if(cloudMode)await loadCloudDb();renderContent();renderDashboard()},busy:()=>st.busy||!!st.pending||remnoteQueue.running||remnoteQueue.publishing};
  el('groupRefresh').onclick=load;el('groupSelectAll').onclick=()=>{filtered().forEach(r=>st.selected.add(key(r)));render()};
  el('groupClear').onclick=()=>{st.selected.clear();render()};
  el('groupVisible').onchange=e=>{filtered().slice(st.page*PAGE,(st.page+1)*PAGE).forEach(r=>e.target.checked?st.selected.add(key(r)):st.selected.delete(key(r)));render()};
  el('groupEditSelected').onclick=()=>st.pending?continueSave():edit(st.rows.filter(r=>st.selected.has(key(r))));el('groupRepair').onclick=repair;
  ['groupSearch','groupScope','groupKind'].forEach(id=>{el(id).oninput=()=>{st.page=0;render()};el(id).onchange=()=>{st.page=0;render()}});
  document.querySelector('[data-view="grouping"]').addEventListener('click',()=>{if(!st.pending)load()});
  el('importGroupSelected').onclick=()=>openImportGrouping(state.import?.diffs.filter(d=>state.selected.has(diffKey(d)))||[]);
})(window);
