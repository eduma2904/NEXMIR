/* Shared administrative writes: server checks role and expected revision. */
window.NexmirContentAdmin={
  async mutate(client,{id,kind='content',action,payload=null,version=null,updatedAt=null}){
    const {data,error}=await client.rpc('nexmir_edit_content',{p_id:id,p_kind:kind,p_action:action,p_payload:payload,p_expected_version:version,p_expected_updated_at:updatedAt});
    if(error){if(error.code==='PGRST202'||error.code==='42883')throw new Error('Falta instalar supabase/EDICION_CONTENIDO.sql en Supabase → SQL Editor.');throw new Error(error.message||'No se pudo guardar el cambio.')}return data;
  }
};
async function deleteReviewCardAsAdmin(){
  if(state.profile?.role!=='admin')return toast('Solo el administrador puede eliminar flashcards');
  const review=state.review,x=review.pool[review.index];if(!x||review.saving||review.deleting)return;
  if(!confirm('¿Eliminar esta flashcard del banco para todos los usuarios? También se eliminarán sus repasos e intentos asociados.'))return;
  review.deleting=true;review.saving=true;const btn=document.querySelector('#reviewAdminDelete');if(btn){btn.disabled=true;btn.textContent='Eliminando…'}
  try{
    await NexmirContentAdmin.mutate(state.sb,{id:x.id,action:'delete',version:x.current_version});
    state.content=state.content.filter(c=>c.id!==x.id);state.reviews=state.reviews.filter(r=>r.content_id!==x.id);state.attempts=state.attempts.filter(a=>a.source_content_id!==x.id);state.bookmarks=state.bookmarks.filter(b=>b.item_id!==x.id);state.notes=state.notes.filter(n=>n.item_id!==x.id&&n.content_id!==x.id);state.errorLog=state.errorLog.filter(e=>e.source_type!=='remnote'||e.source_id!==x.id);
    review.index=review.pool.slice(0,review.index).filter(c=>c.id!==x.id).length;review.pool=review.pool.filter(c=>c.id!==x.id);review.revealed=false;review.saving=false;review.deleting=false;
    if(state.studyPath?.items)state.studyPath.items=state.studyPath.items.filter(c=>c.id!==x.id);
    document.querySelectorAll('[data-content-id]').forEach(el=>{if(el.dataset.contentId===x.id)el.remove()});
    if(state.view==='study')renderStudy();if(state.view==='reviews')renderReviews();updateDueBadge();showReviewCard();toast('Flashcard eliminada');
  }catch(error){review.saving=false;review.deleting=false;if(btn){btn.disabled=false;btn.textContent='Eliminar flashcard (admin)'}toast(error.message)}
}

async function deleteQuestionAsAdmin(key){
  if(state.profile?.role!=='admin')return toast('Solo el administrador puede eliminar preguntas');
  const [source,id]=String(key||'').split(':');
  if(!id||!['questions','remnote'].includes(source))return toast('Pregunta no disponible');
  const original=source==='questions'?state.questions.find(q=>String(q.id)===id):state.content.find(c=>String(c.id)===id);
  if(!original)return toast('Esta pregunta ya no está disponible');
  if(!confirm('¿Eliminar esta pregunta permanentemente para todos los usuarios? También se eliminarán sus intentos y repasos asociados.'))return;
  const buttons=[...document.querySelectorAll('.admin-delete-question')].filter(b=>b.dataset.questionKey===key);
  buttons.forEach(b=>{b.disabled=true;b.textContent='Eliminando…'});
  try{
    await NexmirContentAdmin.mutate(state.sb,source==='questions'
      ?{id,kind:'question',action:'delete',updatedAt:original.updated_at}
      :{id,kind:'content',action:'delete',version:original.current_version});
    if(source==='questions')state.questions=state.questions.filter(q=>String(q.id)!==id);
    else state.content=state.content.filter(c=>String(c.id)!==id);
    state.attempts=state.attempts.filter(a=>source==='questions'?String(a.question_id)!==id:String(a.source_content_id)!==id);
    state.errorLog=state.errorLog.filter(e=>!(e.source_type===source&&String(e.source_id)===id));
    state.bookmarks=state.bookmarks.filter(b=>String(b.item_id)!==id);
    state.reviews=state.reviews.filter(r=>String(r.content_id)!==id);
    state.notes=state.notes.filter(n=>String(n.item_id)!==id&&String(n.content_id)!==id);
    if(state.review?.pool){state.review.pool=state.review.pool.filter(c=>String(c.id)!==id);state.review.index=Math.min(state.review.index,state.review.pool.length-1)}
    if(state.studyPath?.items)state.studyPath.items=state.studyPath.items.filter(c=>String(c.id)!==id);
    const bank=state.bank;
    if(bank?.pool){bank.pool=bank.pool.filter(q=>`${q._source||'questions'}:${q.id}`!==key);bank.index=Math.max(0,Math.min(bank.index,bank.pool.length-1));delete bank.answers?.[key];delete bank.highlights?.[key];delete bank.eliminations?.[key];if(bank.results)bank.results=bank.results.filter(r=>`${r.q?._source||'questions'}:${r.q?.id}`!==key);window.nexmirSaveStudy?.()}
    const sim=state.simulation;
    if(sim?.pool){const removed=sim.pool.findIndex(q=>`${q._source||'questions'}:${q.id}`===key);if(removed>=0){sim.pool.splice(removed,1);if(removed<sim.primaryCount)sim.primaryCount--;else sim.reserveCount=Math.max(0,sim.reserveCount-1);sim.index=Math.max(0,Math.min(sim.index,sim.pool.length-1));delete sim.answers?.[key];delete sim.highlights?.[key];delete sim.eliminations?.[key];sim.marked?.delete(key);if(sim.pool.length)persistSimulation();else{sim.active=false;clearPersistedSimulation()}}}
    window.nexmirRemoveFocusQuestion?.(key);
    if(document.querySelector('#questionDialog')?.open){if(bank?.pool?.length){if(document.querySelector('.bank-results-shell'))renderBankResults();else showQuestion()}else{$('#questionDialog').close();renderBank()}}
    if(document.querySelector('#simDialog')?.open){if(sim?.pool?.length){if(document.querySelector('.sim-results-shell'))$('#simDialog').close();else renderSimulationQuestion()}else{$('#simDialog').close();renderSimulations()}}
    if(document.querySelector('#cardDialog')?.open&&state.review?.pool)showReviewCard();
    if(state.view==='errors')renderErrors();
    updateDueBadge?.();toast('Pregunta eliminada');
  }catch(error){buttons.forEach(b=>{b.disabled=false;b.textContent='Eliminar pregunta'});toast(error.message||'No se pudo eliminar la pregunta')}
}
window.deleteQuestionAsAdmin=deleteQuestionAsAdmin;
