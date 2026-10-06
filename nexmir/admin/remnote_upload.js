/* NEXMIR V5.0.22 · bounded, atomic RemNote publication. */
function remnoteBatches(rows,maxRows=100,maxBytes=750000){
  const batches=[];let batch=[],bytes=2;const encoder=new TextEncoder();
  for(const row of rows){
    const size=encoder.encode(JSON.stringify(row)).byteLength+1;
    if(batch.length&&(batch.length>=maxRows||bytes+size>maxBytes)){batches.push(batch);batch=[];bytes=2}
    batch.push(row);bytes+=size;
  }
  if(batch.length)batches.push(batch);return batches;
}
function missingRemnoteBatchFunction(error){
  return error?.code==='PGRST202'||error?.code==='42883';
}
async function remnoteRpc(params){
  // A batch and its versions/audit are one transaction; retries reuse its receipt.
  for(let attempt=0;attempt<3;attempt++){
    let result;
    try{result=await sb.rpc('nexmir_publish_remnote_batch',params)}catch(error){result={error}}
    if(!result.error)return result.data;
    const transient=!result.error.code||['57014','40001','40P01','53300','57P03','PGRST000','PGRST001','PGRST002','PGRST003'].includes(result.error.code);
    if(!transient||attempt===2)throw result.error;
    await new Promise(resolve=>setTimeout(resolve,500*2**attempt));
  }
}
async function requireTestContentSync(){
  if(!cloudMode||!filteredDiffs().some(d=>state.selected.has(diffKey(d))&&d.kind==='card'&&d.newValue?.type==='multiple_choice'))return;
  const {data,error}=await sb.rpc('nexmir_test_content_sync_ready');
  if(error&&!['PGRST202','42883'].includes(error.code))throw error;
  if(error||!data?.available)throw new Error('Para habilitar estas preguntas en banco, simulacros y batallas, ejecuta supabase/TEST_CONTENT_SYNC.sql una vez en Supabase > SQL Editor. '+(error?.message||''));
}
async function publishSelectedV3(){
  if(remnoteQueue.running||remnoteQueue.publishing||!state.import)return;
  NexmirContentRules.retainSelection(state.selected,filteredDiffs(),diffKey);
  if(!validateRemnotePublication(state.import.diffs.filter(d=>state.selected.has(diffKey(d)))))return;
  if(!cloudMode){publishSelected();return}
  remnoteQueue.publishing=true;setRemnoteControls(true,true);
  $('#publishBtn').textContent='Publicando…';
  const mode=$('#remnotePublishMode');let succeeded=false;
  try{
    await requireTestContentSync();
    let pending=state.import.cloudPublish;
    if(!pending){
      const probe=await sb.rpc('nexmir_publish_remnote_batch',{p_import_id:null,p_batch_id:0,p_changes:[]});
      if(probe.error){
        if(!missingRemnoteBatchFunction(probe.error))throw probe.error;
        mode.textContent='Modo compatible. Para activar la publicación rápida, ejecuta supabase/REMNOTE_BATCH.sql en Supabase > SQL Editor.';
        await publishSelectedLegacy();succeeded=true;return;
      }
      const seen=new Set(),changes=[];
      for(const d of state.import.diffs){
        const key=diffKey(d);if(seen.has(key)||d.status==='unchanged')continue;seen.add(key);
        changes.push({source_uid:d.uid,kind:d.kind,change_type:d.status,old_payload:d.oldValue||null,new_payload:d.newValue||null,selected:state.selected.has(key)});
      }
      const selected=changes.filter(d=>d.selected).length;
      if(!selected){alert('No hay cambios seleccionados.');return}
      const names=state.import.meta.archive_names||state.import.meta.file_names||[];
      const {data:imp,error}=await sb.from('remnote_imports').insert({filename:names.join(' · ').slice(0,500)||'RemNote export',status:'review',stats:{...state.import.meta,published_changes:selected},created_by:cloudUser.id}).select().single();
      if(error)throw error;
      pending=state.import.cloudPublish={id:imp.id,batches:remnoteBatches(changes),nextBatch:0,total:selected,processed:0};
    }
    mode.textContent='Publicación rápida activa · lotes de hasta 100 elementos.';
    for(;pending.nextBatch<pending.batches.length;pending.nextBatch++){
      const data=await remnoteRpc({p_import_id:pending.id,p_batch_id:pending.nextBatch,p_changes:pending.batches[pending.nextBatch]});
      pending.processed+=Number(data?.processed||0);
      setPublishProgress(5+90*((pending.nextBatch+1)/pending.batches.length),`Lote ${pending.nextBatch+1}/${pending.batches.length} · ${pending.processed}/${pending.total} cambios`);
      await importYield();
    }
    const {error}=await sb.from('remnote_imports').update({status:'published',published_at:new Date().toISOString()}).eq('id',pending.id);if(error)throw error;
    setPublishProgress(98,'Actualizando panel…');await loadCloudDb();
    const total=pending.total;state.import=null;state.selected.clear();resetImportQueue();
    $('#compareView').classList.add('hidden');setPublishProgress(100,'Completado');succeeded=true;
    alert(`Publicados ${total} cambios en Supabase.`);go('dashboard');
  }catch(error){
    console.error(error);
    const resume=state.import?.cloudPublish?' Los lotes completados están guardados. Pulsa Reintentar publicación para continuar en esta pestaña sin duplicarlos.':'';
    alert('No se pudo completar la publicación: '+(error.message||error)+resume);
  }finally{
    remnoteQueue.publishing=false;setRemnoteControls(false,false);
    const pending=!!state.import?.cloudPublish;
    if(pending){
      $('#fileInput').disabled=true;$('#discardImportBtn').disabled=true;$('#selectVisible').disabled=true;
      $$('#diffList input').forEach(input=>input.disabled=true);
    }
    $('#publishBtn').textContent=pending?'Reintentar publicación':'Publicar seleccionados';
    if(succeeded)setTimeout(hidePublishProgress,1800);
  }
}
$('#publishBtn').onclick=()=>publishSelectedV3();
