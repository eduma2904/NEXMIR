/* NEXMIR V5.0.23 · shared structural classification. No clinical-text guessing. */
(function(global){
  const aliases={
    'Cardiología':['cardio','cardiologia'],
    'Gastroenterología':['gastro','digestivo','aparato digestivo','gastroenterologia'],
    'Endocrinología y Nutrición':['endocrino','endocrinologia','endocrinologia y nutricion'],
    'Enfermedades Infecciosas':['infectologia','infecciosas','enfermedades infecciosas'],
    'Ginecología y Obstetricia':['gine','ginecologia','obstetricia','ginecologia y obstetricia'],
    'Traumatología':['trauma','traumatologia','traumatologia y ortopedia','traumatologia y cirugia ortopedica','ortopedia'],
    'Otorrinolaringología':['orl','otorrino','otorrinolaringologia'],
    'Oncología Médica':['oncologia','oncologia medica'],
    'Epidemiología y Medicina Preventiva':['epidemiologia','medicina preventiva','salud publica','medicina preventiva y salud publica','epidemiologia y medicina preventiva'],
    'Estadística':['estadistica','estadisticas','bioestadistica','bioestadisticas','estadistica medica'],
    'Cirugía Torácica':['cx de torax','cx torax','cx toracica','cirugia de torax','cirugia del torax','cirugia torax','cirugia toracica'],
    'Cirugía Plástica':['cx plastica','cx plastica y reparadora','cirugia plastica','cirugia plastica y reparadora','cirugia plastica estetica y reparadora'],
    'Neonatología':['neonatologia','neonat','neonatos'],
    'Miscelánea':['miscelanea','miscelaneas','miscelaneo','miscelaneos'],
    'Cirugía General':['cx general','cx gral','cirugia general','cirugia general y del aparato digestivo','cirugia'],
    'Cirugía Cardiovascular':['cx cardiovascular','cirugia cardiovascular','cx cardiaca','cirugia cardiaca'],
    'Cirugía Vascular':['cx vascular','cirugia vascular','angiologia y cirugia vascular'],
    'Cirugía Maxilofacial':['cx maxilofacial','cirugia maxilofacial'],
    'Neurocirugía':['neurocirugia','cx neurologica'],
    'Cirugía Pediátrica':['cx pediatrica','cirugia pediatrica'],
    'Geriatría y Cuidados Paliativos':['geriatria','paliativos','cuidados paliativos','geriatria y cuidados paliativos'],
    'Radiología y Urgencias':['radiologia','urgencias','radiologia y urgencias'],
    'Inmunología y Genética':['inmunologia','genetica','inmunologia y genetica'],
    'Bioética y Medicina Legal':['bioetica','medicina legal','bioetica y medicina legal'],
    'Anatomía y Fisiología':['anatomia','fisiologia','anatomia y fisiologia'],
    'Anatomía Patológica':['anatomia patologica','anatomopatologia'],
    'Anestesiología y Reanimación':['anestesia','anestesiologia','anestesiologia y reanimacion'],
    'Medicina Interna':['medicina interna','mi'],
    'Alergología':['alergologia'],
    'Farmacología':['farmacologia'],
    'Nefrología':['nefrologia','nefro'], 'Neumología':['neumologia','neumo'],
    'Neurología':['neurologia','neuro'], 'Hematología':['hematologia','hemato'],
    'Reumatología':['reumatologia','reuma'], 'Pediatría':['pediatria','pedi'],
    'Psiquiatría':['psiquiatria','psiqu'], 'Dermatología':['dermatologia','dermato'],
    'Oftalmología':['oftalmologia','oftalmo'], 'Urología':['urologia']
  };
  function cleanLabel(value){
    return String(value??'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\^\^|\u200b/g,'')
      .replace(/[*`]/g,'').replace(/_/g,' ').replace(/<[^>]*>/g,'').replace(/^[\s#>•\-–—]+/,'')
      .replace(/\.(?:md|markdown|zip)$/i,'').replace(/\s+(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i,'')
      .replace(/^\d+[.)\s-]+/,'').replace(/\s+(?:AMIR|CTO)$/i,'').replace(/\s+/g,' ').trim();
  }
  function key(value){return cleanLabel(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  const map=new Map();for(const [canonical,names] of Object.entries(aliases))for(const label of [canonical,...names])map.set(key(label),canonical);
  function unclassified(value){const n=key(value);return !n||['sin clasificar','desagrupadas','desagrupados','desagrupada','desagrupado','unclassified','sin especialidad','pendiente'].includes(n)||n.startsWith('sin clasificar ')}
  const subjectLabel=value=>cleanLabel(value).replace(/^(?:especialidad|asignatura|materia)\s*[:：]\s*/i,'');
  function known(value){return map.get(key(subjectLabel(value)))||null}
  function canonical(value){const s=subjectLabel(value);return unclassified(s)?'Desagrupadas':known(s)||s}
  function simulationLabel(value){return /^simulacros?(?:\s|$)/.test(key(value))}
  function simulationContent(item){
    const p=item?.payload||item||{},m=item?.remnote_metadata||{};
    const use=p.content_use||m.content_use;if(use)return use==='simulation';
    return !!item?.source_exam||[item?.source_path,p.source,p.archive_name,m.source_path,m.archive_name,...(p.context||[]),...(m.context||[]),...(p.sources||[])].some(v=>String(v||'').split(/[\/\\]/).some(simulationLabel));
  }
  function searchable(value){
    const text=v=>typeof v==='string'?v:Array.isArray(v)?v.map(text).join(' '):v&&typeof v==='object'?Object.values(v).map(text).join(' '):'';
    return text(value).replace(/<[^>]*>/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[*_`#>|]/g,' ').replace(/\s+/g,' ').trim();
  }
  function wrapper(value){const n=key(value);return !n||simulationLabel(value)||/^[a-f0-9]{32}$|^[a-f0-9]{8} [a-f0-9]{4} [a-f0-9]{4} [a-f0-9]{4} [a-f0-9]{12}$/.test(n)||unclassified(n)||/^remnoteexport|^remnote export/.test(n)||['remnote','export','exportacion','exportacion remnote','documentos','documents','notas','notes','flashcards','tarjetas','mir','nexmir','amir','cto','banco','banco de preguntas','general','pregunta','preguntas','questions','documento','document','untitled','sin titulo','index','readme'].includes(n)}
  function usable(value){const s=cleanLabel(value);return !wrapper(s)&&s.length<=160&&!/[?¿]|==|>>|→/.test(s)}
  function classify(context=[],source='',options={}){
    const sourceParts=String(source||'').split('/').map(cleanLabel).filter(Boolean);
    const parts=[];
    for(const label of [...sourceParts,...(context||[])]){
      const s=cleanLabel(label);if(wrapper(s)||!s)continue;
      if(!parts.some(p=>key(p)===key(s)))parts.push(s);
    }
    let index=parts.findIndex(p=>known(p)),specialty=index>=0?known(parts[index]):null,origin='remnote_hierarchy';
    const rootFolder=sourceParts.slice(0,-1).find(usable);
    if(rootFolder&&!known(rootFolder)){specialty=canonical(rootFolder);index=parts.findIndex(p=>key(p)===key(rootFolder));origin='remnote_custom_hierarchy'}
    if(!specialty){
      index=parts.findIndex(p=>/^(?:especialidad|asignatura|materia)\s*[:：]/i.test(p)&&usable(subjectLabel(p)));
      if(index>=0){specialty=canonical(parts[index]);origin='remnote_custom_hierarchy'}
    }
    if(!specialty){
      // Custom folders are valid subjects; a closed MIR catalog must never erase them.
      const folders=sourceParts.slice(0,-1).filter(usable);
      const headings=(context||[]).map(cleanLabel).filter(p=>!sourceParts.some(s=>key(s)===key(p))).filter(usable);
      const root=folders[0]||headings[0]||(sourceParts.length===1&&usable(sourceParts[0])?sourceParts[0]:null);
      if(root){specialty=canonical(root);index=parts.findIndex(p=>key(p)===key(root));origin='remnote_custom_hierarchy'}
    }
    if(!specialty&&!unclassified(options.fallbackSpecialty)){
      specialty=canonical(options.fallbackSpecialty);index=-1;origin='admin_manual';
    }
    if(!specialty)return {specialty:'Sin clasificar',topic:'General',subtopic:null,section:null,path:[],classification_origin:'unresolved'};
    const descendants=(index>=0?parts.slice(index+1):parts).filter(p=>key(canonical(p))!==key(specialty));
    const topic=descendants[0]||'General',subtopic=descendants[1]||null,section=descendants.slice(2).join(' › ')||null;
    return {specialty,topic,subtopic,section,path:[specialty,topic,subtopic,section].filter(Boolean),classification_origin:origin};
  }
  function manual(specialty,fields={}){
    const sp=canonical(specialty);if(unclassified(sp))throw new Error('Elige o escribe una especialidad antes de guardar.');
    const topic=cleanLabel(fields.topic)||'General',subtopic=cleanLabel(fields.subtopic)||null,section=cleanLabel(fields.section)||null;
    return {specialty:sp,topic,subtopic,section,path:[sp,topic,subtopic,section].filter(Boolean),classification_origin:'admin_manual'};
  }
  global.RemnoteTaxonomy={aliases,subjects:Object.keys(aliases).sort((a,b)=>a.localeCompare(b,'es')),cleanLabel,key,known,canonical,unclassified,classify,manual,simulationLabel,simulationContent,searchable};
})(typeof window!=='undefined'?window:globalThis);
