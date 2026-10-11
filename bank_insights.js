/* Cobertura del banco y orden de preguntas: solo datos del usuario actual. */
window.NexmirBankInsights=(()=>{
  const key=q=>`${q._source||'questions'}:${q.id}`;
  const attemptKey=a=>a.question_id?`questions:${a.question_id}`:a.source_content_id?`remnote:${a.source_content_id}`:null;
  function history(attempts=[]){
    const map=new Map();
    for(const a of attempts){const k=attemptKey(a);if(!k)continue;const h=map.get(k)||{count:0,last:0};h.count++;h.last=Math.max(h.last,Date.parse(a.answered_at)||0);map.set(k,h)}
    return map;
  }
  function seen(q,historyMap){return (q._aliases||[key(q)]).some(k=>historyMap.has(k))}
  function usage(q,historyMap){return (q._aliases||[key(q)]).reduce((best,k)=>{const h=historyMap.get(k);return h?{count:best.count+h.count,last:Math.max(best.last,h.last)}:best},{count:0,last:0})}
  function coverage(pool,attempts){
    const h=history(attempts),groups=new Map();
    for(const q of pool){const specialty=typeof displaySpecialty==='function'?displaySpecialty(q.specialty):q.specialty||'Sin clasificar',topic=q.topic||'General',id=JSON.stringify([specialty,topic]),row=groups.get(id)||{specialty,topic,total:0,seen:0};row.total++;if(seen(q,h))row.seen++;groups.set(id,row)}
    return [...groups.values()].map(row=>({...row,pct:row.total?Math.round(100*row.seen/row.total):0})).sort((a,b)=>a.specialty.localeCompare(b.specialty,'es')||a.topic.localeCompare(b.topic,'es'));
  }
  function order(pool,attempts){
    const h=history(attempts);
    return pool.map(q=>({q,u:usage(q,h),random:Math.random()})).sort((a,b)=>a.u.count-b.u.count||a.u.last-b.u.last||a.random-b.random).map(x=>x.q);
  }
  return {key,history,seen,usage,coverage,order};
})();
