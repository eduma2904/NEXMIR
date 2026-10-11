/* Señales editoriales: son candidatas para revisión, no dictámenes clínicos. */
window.NexmirQuestionQuality=(()=>{
  const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/<[^>]*>/g,' ').replace(/[*_`#>|]/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
  const options=q=>Array.isArray(q.options)?q.options.map(o=>norm(typeof o==='string'?o:o?.text)):[];
  const key=q=>`${q._source||'questions'}:${q.id}`;
  function inspect(rows,reports=[]){
    const result=new Map(),byStem=new Map(),reported=new Map();
    for(const r of reports.filter(r=>['open','reviewing'].includes(r.status))){const k=`${r.source_type}:${r.source_id}`;(reported.get(k)||reported.set(k,[]).get(k)).push(r)}
    for(const q of rows){
      const flags=[],stem=norm(q.stem),opts=options(q),correct=Number(q.correct_index),explanation=norm(q.explanation);
      if(!stem)flags.push('sin enunciado');
      if(opts.filter(Boolean).length<2)flags.push('alternativas insuficientes');
      if(q.correct_index===null||q.correct_index===undefined||!Number.isInteger(correct)||correct<0||correct>=opts.length||!opts[correct])flags.push('respuesta inválida');
      if(opts.filter(Boolean).length!==new Set(opts.filter(Boolean)).size)flags.push('alternativas repetidas o ambiguas');
      if(!explanation)flags.push('sin explicación');
      else if(explanation.length<60||/^(pendiente|todo|sin explicacion|ver respuesta)/.test(explanation))flags.push('explicación posiblemente incompleta');
      for(const r of reported.get(key(q))||[])if(r.category==='ambiguous')flags.push('ambigüedad reportada');
      result.set(key(q),new Set(flags));
      if(stem.length>=15)(byStem.get(stem)||byStem.set(stem,[]).get(stem)).push(q);
    }
    for(const group of byStem.values()){
      if(group.length<2)continue;
      const signatures=new Map();
      for(const q of group){const sig=options(q).slice().sort().join('|');(signatures.get(sig)||signatures.set(sig,[]).get(sig)).push(q)}
      for(const same of signatures.values()){
        if(same.length<2)continue;
        for(const q of same)result.get(key(q)).add('posible duplicado');
        const answers=new Set(same.map(q=>options(q)[Number(q.correct_index)]).filter(Boolean));
        if(answers.size>1)for(const q of same)result.get(key(q)).add('respuesta inconsistente');
      }
    }
    return result;
  }
  return {key,inspect};
})();
