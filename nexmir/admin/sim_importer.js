/* NEXMIR V4.3 · Importador universal de simulacros
   - PDFs separados: preguntas + respuestas/comentarios + imágenes opcionales
   - PDF único: preguntas y soluciones/comentarios en el mismo archivo
   - RemNote: ZIP/Markdown, solo flashcards de opción múltiple
   - Limpieza automática de marcas de academias y cabeceras/pies
*/
(() => {
  const simState = {
    mode: 'separate', questions: [], images: new Map(), taxonomy: [], existing: new Map(), existingByNumber: new Map(),
    selected: new Set(), filter: 'all', analyzing: false, extraBrands: [], sourceKind: 'pdf_separate'
  };

  const MIR_SPECS = [
    'Anatomía y Fisiología','Cardiología','Gastroenterología','Neurología','Neumología','Enfermedades Infecciosas',
    'Endocrinología y Nutrición','Nefrología','Hematología','Reumatología','Pediatría','Ginecología y Obstetricia',
    'Psiquiatría','Epidemiología y Medicina Preventiva','Dermatología','Traumatología y Cirugía Ortopédica','Urología',
    'Otorrinolaringología','Oftalmología','Oncología Médica','Geriatría y Cuidados Paliativos','Radiología y Urgencias',
    'Cirugía General','Farmacología','Inmunología y Genética','Bioética y Medicina Legal','Sin clasificar'
  ];
  const RULES = [
    ['Cardiología',/(infarto|iam\b|stent|coronari|angina|electrocard|ecg\b|arritm|fibrilaci[oó]n auricular|flutter|taquicardia|bradicardia|valvul|a[oó]rtic|mitral|insuficiencia cardiaca|cardiomiopat|endocarditis|pericarditis|hipertensi[oó]n arterial|miocard)/i],
    ['Gastroenterología',/(es[oó]fag|g[aá]stric|gastritis|helicobacter|ulcer|intestin|colon|crohn|colitis|celiaqu|pancrea|h[eé]pat|cirrosis|colang|colecist|ves[ií]cula|ictericia|bilirrub|digestiv|esteatorr|hemorragia digestiva)/i],
    ['Neurología',/(ictus|accidente cerebrovascular|epilep|convulsi|cefalea|migra|parkinson|alzheimer|esclerosis m[uú]ltiple|neuropat|mielitis|meningi|glioma|cerebral|sistema nervioso|paresia|afasia|ataxia)/i],
    ['Neumología',/(asma\b|epoc|pulmon|neumon|bronqui|pleura|tuberculosis pulmonar|espirom|fev1|tiffeneau|sarcoidosis|neumot[oó]rax|embolia pulmonar|tromboembolismo pulmonar|fibrosis pulmonar)/i],
    ['Enfermedades Infecciosas',/(vih\b|sida|herpes|tuberculosis|aspergill|bacter|virus|viral|fiebre|sepsis|antibi[oó]tic|meningitis|endocarditis infecciosa|malaria|paras|infecci[oó]n|hongos|mic[oó]tic)/i],
    ['Endocrinología y Nutrición',/(diabetes|insulina|tiroid|hipertiroid|hipotiroid|suprarrenal|adrenal|feocromocitoma|cushing|addison|hip[oó]fisis|prolact|paratiroid|calcio|obesidad|nutrici[oó]n|metanefrina)/i],
    ['Nefrología',/(renal|riñ[oó]n|glomerul|nefrot|nefr[ií]tic|creatinina|di[aá]lisis|hiponatrem|hipernatrem|potasio|acidosis metab[oó]lica|insuficiencia renal|proteinuria|hematuria)/i],
    ['Hematología',/(anemia|leucemia|linfoma|mieloma|plaqueta|coagul|hemofilia|trombocit|neutrop|pancitopen|b12|cobalamina|ferropenia|hem[oó]lisis)/i],
    ['Reumatología',/(lupus|artritis reumatoide|espondil|vasculitis|beh[cç]et|gota\b|escleroderm|polimialgia|sj[oö]gren|reumat|uve[ií]tis.*oral)/i],
    ['Pediatría',/(reci[eé]n nacido|neonatal|prematur|lactante|niñ[oa]|pediatr|membrana hialina|aspiraci[oó]n meconial|desarrollo infantil)/i],
    ['Ginecología y Obstetricia',/(embaraz|gestaci[oó]n|parto|puerper|placenta|ovario|uter|cervix|c[eé]rvix|endometri|anticoncept|menarquia|amenorrea|ginecol|cardiotocogr|eclamps|mastitis)/i],
    ['Psiquiatría',/(depresi[oó]n|esquizof|psicosis|man[ií]a|bipolar|ansiedad|suicid|neurol[eé]pt|antipsic[oó]tic|pseudodemencia|trastorno afectivo|adicci[oó]n|alcoholismo)/i],
    ['Epidemiología y Medicina Preventiva',/(ensayo cl[ií]nico|sensibilidad|especificidad|valor predictivo|odds ratio|riesgo relativo|nnt\b|nnd\b|intervalo de confianza|screening|cribado|tamañ[o] muestral|desviaci[oó]n est[aá]ndar|meta-?an[aá]lisis|forest plot|epidemiolog|bioestad)/i],
    ['Dermatología',/(piel|cut[aá]ne|dermat|psoriasis|liquen|melanoma|nevus|prurito|ves[ií]cula|ampolla|hiperquerat|alopecia)/i],
    ['Traumatología y Cirugía Ortopédica',/(fractura|luxaci[oó]n|escoliosis|tobillo|rodilla|cadera|hueso|osteos[ií]ntesis|cors[eé]|ortop[eé]d|menisco|ligamento)/i],
    ['Urología',/(pr[oó]stata|test[ií]culo|vejiga|urolog|litiasis|c[oó]lico renal|pene|escroto|hematuria.*tumor)/i],
    ['Otorrinolaringología',/(laringe|faringe|am[ií]gdala|hipoacusia|rinne|weber|v[eé]rtigo|dix hallpike|otitis|o[ií]do|orofaring|cuerda vocal)/i],
    ['Oftalmología',/(retina|glaucoma|catarata|ojo\b|ocular|fondo de ojo|agudeza visual|uve[ií]tis|papila [oó]ptica)/i],
    ['Oncología Médica',/(c[aá]ncer|carcinoma|tumor maligno|met[aá]stasis|quimioterapia|radioterapia|oncolog|neoplasia)/i],
    ['Geriatría y Cuidados Paliativos',/(anciano|geriatr|paliativ|fragilidad|demencia.*ancian)/i],
    ['Radiología y Urgencias',/(radiograf[ií]a|tomograf[ií]a|\btc\b|resonancia magn[eé]tica|\brm\b|ecograf[ií]a|urgencias|politrauma)/i],
    ['Cirugía General',/(cirug[ií]a|postoperator|laparoscop|apendic|hernia|abdomen agudo|obstrucci[oó]n intestinal|peritonitis)/i],
    ['Farmacología',/(f[aá]rmaco|farmacol|efecto adverso|ant[ií]doto|toxicidad|interacci[oó]n|dosis|estatinas?|betabloqueante|inhibidor)/i],
    ['Inmunología y Genética',/(inmunolog|anticuerpo|complemento|hipersensibilidad|mutaci[oó]n|gen\b|citogen|herencia|cariotipo|histo?compatibilidad)/i],
    ['Bioética y Medicina Legal',/(consentimiento informado|bio[eé]tica|capacidad|confidencial|secreto profesional|medicina legal|eutanasia|autonom[ií]a del paciente)/i],
    ['Anatomía y Fisiología',/(anatom[ií]a|plexo braquial|nervio mediano|conducto tor[aá]cico|gl[aá]ndula adrenal derecha|fisiolog[ií]a)/i]
  ];

  // Nunca se elimina la palabra MIR genérica: forma parte del nombre oficial del examen.
  const DEFAULT_BRANDS = ['Academia MIR','AMIR','Grupo CTO','CTO','PROMIR','MIR Asturias','MIRMeApp','Mirmedic'];
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ñ]+/g,' ').replace(/\s+/g,' ').trim();
  const slug = s => norm(s).replace(/ñ/g,'n').replace(/\s+/g,'-').replace(/^-|-$/g,'') || 'simulacro';
  const html = s => esc(String(s ?? ''));
  const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  function currentBrands(){
    const extra=($('#simExtraBrands')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);
    return [...new Set([...DEFAULT_BRANDS,...extra])].sort((a,b)=>b.length-a.length);
  }
  function scrubBrandText(value=''){
    let s=String(value||'');
    // URLs y dominios de preparación: se eliminan completos para no dejar marcas residuales.
    s=s.replace(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9.-]*\.(?:com|es|net|org|edu)(?:\/\S*)?/gi,' ');
    for(const b of currentBrands())s=s.replace(new RegExp(`\\b${reEsc(b)}\\b`,'gi'),' ');
    return s.replace(/\s{2,}/g,' ').replace(/\s+([,.;:!?])/g,'$1').trim();
  }
  function sanitizeExamName(value=''){
    let s=String(value||'').replace(/\.pdf$/i,'').replace(/\.(?:md|markdown|zip)$/i,'');
    s=s.replace(/^(?:RESPUESTAS?|SOLUCIONES?|COMENTARIOS?|IMAGENES?|IMÁGENES?|CUADERNILLO\s+DE\s+IM[AÁ]GENES?)\s*[-_:–—]*\s*/i,'');
    s=scrubBrandText(s).replace(/^[-_:–—\s]+|[-_:–—\s]+$/g,'').trim();
    return s || 'Simulacro';
  }
  function setProg(pct,text=''){ const p=Math.max(0,Math.min(100,Math.round(pct))); const bar=$('#simImportProgressBar'), lab=$('#simImportProgressText'); if(bar)bar.style.width=p+'%'; if(lab)lab.textContent=`${p}%${text?' · '+text:''}`; }
  function showProg(on=true){ $('#simImportProgress')?.classList.toggle('hidden',!on); }
  function cleanLine(line=''){
    let s=scrubBrandText(String(line||'').replace(/\s+/g,' ').trim());
    if(!s)return '';
    if(/^(MEDICINA|CUADERNO DE EXAMEN|CUADERNILLO DE IM[AÁ]GENES|PRUEBAS SELECTIVAS|P[aá]g\.?\s*\d+|SIMULACRO|N[ÚU]MERO DE MESA:?|N[ÚU]MERO DE EXPEDIENTE:?|APELLIDOS Y NOMBRE:?)$/i.test(s))return '';
    if(/^M\d+[A-Z]{2}$/i.test(s))return '';
    if(/^\d+$/.test(s))return '';
    return s;
  }
  function smartJoin(lines){
    let out='';
    for(const raw of lines||[]){const line=cleanLine(raw);if(!line)continue;if(!out){out=line;continue}if(/-$/.test(out)&&/^[a-záéíóúüñ]/i.test(line))out=out.slice(0,-1)+line;else out+=' '+line}
    return scrubBrandText(out.replace(/\s+/g,' ').trim());
  }

  async function loadPdf(file){
    if(!window.pdfjsLib)throw new Error('No se pudo cargar el motor PDF.js. Comprueba tu conexión a internet y vuelve a abrir el Panel Admin.');
    pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js?v=3.11.174';
    return pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  }
  async function pageColumnLines(page){
    const viewport=page.getViewport({scale:1}),tc=await page.getTextContent(),half=viewport.width/2,cols=[[],[]];
    for(const it of tc.items){if(!it.str?.trim())continue;const x=it.transform?.[4]||0,y=it.transform?.[5]||0;cols[x<half?0:1].push({x,y,str:it.str})}
    const lines=[];
    for(const arr of cols){arr.sort((a,b)=>Math.abs(b.y-a.y)>2?b.y-a.y:a.x-b.x);let current=[],lastY=null;const flush=()=>{if(current.length){lines.push(current.sort((a,b)=>a.x-b.x).map(v=>v.str).join(' '));current=[]}};for(const it of arr){if(lastY===null||Math.abs(it.y-lastY)<=2.5){current.push(it);if(lastY===null)lastY=it.y}else{flush();current=[it];lastY=it.y}}flush()}
    return lines.map(cleanLine).filter(Boolean);
  }
  function qStart(line){
    const m=String(line||'').match(/^(\d{1,3})\.\s+(.+)$/);if(!m)return null;const n=+m[1],rest=m[2].trim();if(n<1||n>400)return null;
    // Las preguntas 1-4 son el principal punto de colisión con las alternativas 1-4.
    // Solo se aceptan como inicio si el PDF las identifica explícitamente como pregunta ligada a imagen.
    // A partir de la 5, el número ya no puede confundirse con una alternativa estándar del MIR.
    if(/Pregunta\s+(?:asociada|vinculada)\s+a\s+la\s+imagen/i.test(rest))return n;
    if(n>=5)return n;
    return null;
  }
  async function extractExamLines(file,progressBase=0,progressSpan=30){
    const doc=await loadPdf(file),pages=[];let started=false;
    for(let p=1;p<=doc.numPages;p++){
      const page=await doc.getPage(p),lines=await pageColumnLines(page),hits=lines.map(qStart).filter(Boolean);
      if(!started&&(hits.length>=2||hits.includes(1)||lines.some(x=>/Pregunta\s+(?:asociada|vinculada)\s+a\s+la\s+imagen\s*1/i.test(x))))started=true;
      if(started)pages.push(lines);
      setProg(progressBase+progressSpan*(p/doc.numPages),`Leyendo ${file.name} · pág. ${p}/${doc.numPages}`);
    }
    if(!pages.length)throw new Error(`No pude localizar el inicio de las preguntas en ${file.name}.`);
    return pages.flat();
  }
  function blocksByQuestionAll(lines,maxN=400){
    const starts=[];lines.forEach((l,i)=>{const n=qStart(l);if(n&&n<=maxN)starts.push([i,n])});const out=new Map();
    for(let k=0;k<starts.length;k++){const [i,n]=starts[k],end=k+1<starts.length?starts[k+1][0]:lines.length;const block=lines.slice(i,end);if(!out.has(n))out.set(n,[]);out.get(n).push(block)}
    return out;
  }
  function parseQuestion(block,n){
    if(!block?.length)return null;let first=String(block[0]).replace(new RegExp('^'+n+'\\.\\s*'),'').trim(),imageNumber=null;
    const im=first.match(/^Pregunta\s+(?:asociada|vinculada)\s+a\s+la\s+imagen\s+(\d+)\s*:\s*(.*)$/i);if(im){imageNumber=+im[1];first=im[2]||''}
    const beforeAnswer=[];for(const l of [first,...block.slice(1)]){
      // No confundir enunciados como "señale la CORRECTA:" con una etiqueta de solución.
      // "Correcta:" solo corta el bloque si inmediatamente trae una alternativa (1-4 / A-D).
      if(/^(?:Respuesta\s+correcta|Respuesta|Soluci[oó]n)\s*:/i.test(l)||/^Correcta\s*:\s*(?:[1-4A-D])\b/i.test(l)||/^(?:Comentario|Explicaci[oó]n|Soluci[oó]n\s+comentada)\s*:/i.test(l))break;
      beforeAnswer.push(l)
    }
    const opts=[null,null,null,null],stem=[],buf=[beforeAnswer[0],...beforeAnswer.slice(1)];let cur=-1;
    for(const raw of buf){const l=cleanLine(raw);if(!l)continue;const om=l.match(/^([1-4])\.\s*(.*)$/);if(om){cur=+om[1]-1;opts[cur]=om[2]||''}else if(cur<0)stem.push(l);else opts[cur]=(opts[cur]+' '+l).trim()}
    const parsed={number:n,image_number:imageNumber,stem:smartJoin(stem),options:opts.map(x=>smartJoin([x||'']))};
    const score=parsed.options.filter(Boolean).length*10+(parsed.stem.length>20?5:0)-(parsed.stem.length>3000?2:0);
    return {...parsed,_score:score};
  }
  function parseAnswer(block){
    if(!block?.length)return {correct_index:null,explanation:''};
    const lines=block.map(x=>cleanLine(x)).filter(Boolean);
    let idx=null, commentAt=-1;
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      if(idx===null){
        const m=line.match(/(?:Respuesta\s+correcta|Respuesta|Correcta|Soluci[oó]n)\s*:\s*(?:opci[oó]n\s*)?([1-4A-D])/i);
        if(m)idx=/[A-D]/i.test(m[1])?m[1].toUpperCase().charCodeAt(0)-65:+m[1]-1;
      }
      if(commentAt<0&&/(?:Comentario|Explicaci[oó]n|Soluci[oó]n\s+comentada)\s*:/i.test(line))commentAt=i;
    }
    let explanation='';
    if(commentAt>=0){
      const first=lines[commentAt].replace(/^.*?(?:Comentario|Explicaci[oó]n|Soluci[oó]n\s+comentada)\s*:\s*/i,'');
      const tail=[first,...lines.slice(commentAt+1)]
        .filter(x=>!/(?:Respuesta\s+correcta|Respuesta|Correcta|Soluci[oó]n)\s*:/i.test(x));
      explanation=smartJoin(tail);
    }
    return {correct_index:idx,explanation};
  }
  function bestQuestionBlock(blocks,n){
    let best=null,bestScore=-Infinity;for(const b of blocks||[]){const p=parseQuestion(b,n);if(!p)continue;let s=p._score;if(/(?:Respuesta\s+correcta|Comentario)\s*:/i.test(b.join('\n')))s-=1;if(s>bestScore){bestScore=s;best=p}}return best;
  }
  function mergeQuestionBlocks(groups,n){
    const parsed=[];
    for(const blocks of groups||[]) for(const b of blocks||[]){ const p=parseQuestion(b,n); if(p) parsed.push(p); }
    if(!parsed.length) return null;
    const stem=parsed.map(p=>p.stem||'').sort((a,b)=>b.length-a.length)[0]||'';
    const options=[0,1,2,3].map(i=>parsed.map(p=>(p.options||[])[i]||'').filter(Boolean).sort((a,b)=>b.length-a.length)[0]||'');
    const image_number=(parsed.find(p=>p.image_number)?.image_number)||null;
    return {number:n,image_number,stem,options,_score:options.filter(Boolean).length*10+(stem.length>20?5:0)};
  }
  function bestAnswer(blocks){
    let correct=null,longest='';
    for(const b of blocks||[]){
      const a=parseAnswer(b);
      if(correct===null&&a.correct_index!==null)correct=a.correct_index;
      if((a.explanation||'').length>longest.length)longest=a.explanation||'';
    }
    return {correct_index:correct,explanation:longest};
  }

  async function extractImages(file,progressBase=60,progressSpan=20){
    if(!file)return new Map();const doc=await loadPdf(file),map=new Map();
    for(let p=1;p<=doc.numPages;p++){
      const page=await doc.getPage(p),scale=1.55,viewport=page.getViewport({scale}),tc=await page.getTextContent();
      const labels=[],textItems=tc.items.filter(it=>it.str?.trim()).map(it=>({str:scrubBrandText(it.str.trim()),x:it.transform?.[4]||0,y:it.transform?.[5]||0}));
      textItems.sort((a,b)=>Math.abs(b.y-a.y)>2?b.y-a.y:a.x-b.x);let line=[],lastY=null;
      const flushLabel=()=>{if(!line.length)return;const joined=line.sort((a,b)=>a.x-b.x).map(x=>x.str).join(' ').replace(/\s+/g,' ').trim();const m=joined.match(/^IMAGEN\s+(\d+)$/i);if(m){const pt=viewport.convertToViewportPoint(line[0].x,line[0].y);labels.push({n:+m[1],y:pt[1]})}line=[]};
      for(const it of textItems){if(lastY===null||Math.abs(it.y-lastY)<=2.5){line.push(it);if(lastY===null)lastY=it.y}else{flushLabel();line=[it];lastY=it.y}}flushLabel();
      if(labels.length){labels.sort((a,b)=>a.y-b.y);const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const ctx=canvas.getContext('2d');await page.render({canvasContext:ctx,viewport}).promise;for(let i=0;i<labels.length;i++){const lab=labels[i],next=labels[i+1],x=Math.round(18*scale),y=Math.max(0,Math.round(lab.y+14*scale)),endY=next?Math.round(next.y-10*scale):Math.round(viewport.height-28*scale),w=Math.max(20,canvas.width-x*2),h=Math.max(20,endY-y),crop=document.createElement('canvas');crop.width=w;crop.height=h;crop.getContext('2d').drawImage(canvas,x,y,w,h,0,0,w,h);const blob=await new Promise(resolve=>crop.toBlob(resolve,'image/jpeg',0.88));if(blob)map.set(lab.n,{blob,url:URL.createObjectURL(blob)})}}
      setProg(progressBase+progressSpan*(p/doc.numPages),`Extrayendo imágenes · pág. ${p}/${doc.numPages}`);
    }
    return map;
  }

  function inferSpecialty(q){const text=norm([q.stem,...q.options,q.explanation].join(' '));let best='Sin clasificar',score=0;for(const [sp,re] of RULES){const m=text.match(re);if(m){let s=1,token=norm(m[0]);if(token.length>8)s+=1;if(sp==='Anatomía y Fisiología'&&best!=='Sin clasificar')s=.5;if(s>score){score=s;best=sp}}}return best}
  function taxonomyScore(label,text){const n=norm(label);if(!n||n==='general')return 0;let s=text.includes(n)?10:0;for(const t of n.split(' ').filter(x=>x.length>=5))if(text.includes(t))s++;return s}
  function inferTopic(q,sp){const text=norm([q.stem,...q.options,q.explanation].join(' ')),rows=simState.taxonomy.filter(x=>x.specialty===sp);let best=null,bscore=0;for(const r of rows){const s=taxonomyScore(r.topic,text)*2+taxonomyScore(r.subtopic,text)+taxonomyScore(r.section,text);if(s>bscore){bscore=s;best=r}}return bscore>=2?{topic:best.topic||'General',subtopic:best.subtopic||null,section:best.section||null}:{topic:'General',subtopic:null,section:null}}
  async function loadTaxonomy(){simState.taxonomy=[];if(!cloudMode||!sb)return;const {data,error}=await sb.from('content_items').select('specialty,topic,subtopic,section').eq('status','published');if(error)return;const seen=new Set();for(const r of data||[]){const k=[r.specialty,r.topic,r.subtopic,r.section].join('|');if(seen.has(k))continue;seen.add(k);simState.taxonomy.push(r)}}
  async function existingForExam(examName){
    simState.existing=new Map();simState.existingByNumber=new Map();if(!cloudMode||!sb)return;const {data,error}=await sb.from('questions').select('*').eq('source_exam',examName);if(error){if(/column.*source_exam|does not exist/i.test(error.message))throw new Error('Falta ejecutar la migración de simulacros en Supabase.');throw error}
    for(const r of data||[]){if(r.source_uid)simState.existing.set(r.source_uid,r);if(r.source_number!=null)simState.existingByNumber.set(+r.source_number,r)}
  }
  function questionSig(q){return JSON.stringify([scrubBrandText(q.stem),q.options.map(scrubBrandText),q.correct_index,scrubBrandText(q.explanation),q.specialty,q.topic,q.subtopic,q.section,!!q.is_reserve])}
  function recalcStatuses(){
    const exam=sanitizeExamName($('#simExamName').value.trim()||'Simulacro');$('#simExamName').value=exam;
    for(const q of simState.questions){
      q.source_exam=exam;q.source_uid=q.native_uid?`sim:${slug(exam)}:${q.native_uid}`:`sim:${slug(exam)}:q${q.number}`;
      const old=simState.existing.get(q.source_uid)||simState.existingByNumber.get(+q.number);if(q.native_uid&&old?.remnote_metadata?.classification_origin==='admin_manual'){for(const field of ['specialty','topic','subtopic','section'])q[field]=old[field];q.remnote_metadata={...q.remnote_metadata,classification_origin:'admin_manual'}}q.status_import=!old?'new':questionSig(q)===questionSig({...old,number:old.source_number,options:Array.isArray(old.options)?old.options:[]})?'unchanged':'modified';q.db_id=old?.id||null;q.legacy_source_uid=old?.source_uid||null;if(q.status_import!=='unchanged')simState.selected.add(q.source_uid)
    }
  }
  function renderStats(){const qs=simState.questions,c={new:0,modified:0,unchanged:0,review:0};qs.forEach(q=>{c[q.status_import]=(c[q.status_import]||0)+1;if(q.specialty==='Sin clasificar')c.review++});$('#simImportStats').innerHTML=`<div class="stat"><div class="num">${qs.length}</div><div class="label">Preguntas</div></div><div class="stat"><div class="num">${qs.filter(q=>q.correct_index!==null).length}</div><div class="label">Respuestas</div></div><div class="stat"><div class="num">${qs.filter(q=>(q.explanation||'').trim()).length}</div><div class="label">Explicaciones</div></div><div class="stat"><div class="num">${simState.images.size}</div><div class="label">Imágenes</div></div><div class="stat"><div class="num">${c.new+c.modified}</div><div class="label">Para publicar</div></div><div class="stat"><div class="num">${c.review}</div><div class="label">Sin clasificar</div></div>`}
  function badgeStatus(s){return `<span class="badge ${s}">${({new:'Nueva',modified:'Modificada',unchanged:'Sin cambios'}[s]||s)}</span>`}
  function filtered(){let arr=simState.questions;const f=simState.filter,q=norm($('#simImportSearch')?.value||'');if(f==='review')arr=arr.filter(x=>x.specialty==='Sin clasificar');else if(f==='problems')arr=arr.filter(x=>getProblemReasons(x).length>0);else if(f!=='all')arr=arr.filter(x=>x.status_import===f);if(q)arr=arr.filter(x=>norm(`${x.number} ${x.stem} ${x.specialty} ${x.topic}`).includes(q));return arr}
  function questionPreview(value,max=220){let text=String(value||'').replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/!\[\]\(/g,' ').replace(/[*_`#>|]/g,' ').replace(/\s+/g,' ').trim();if(!text)return 'Sin enunciado legible detectado';return text.length>max?text.slice(0,max-1).trimEnd()+'…':text}
  function readableStem(q){const text=questionPreview(q?.stem,200);return text!=='Sin enunciado legible detectado'&&text.length>=12}
  function questionIssuesHtml(q){const issues=getProblemReasons(q);return issues.length?`<span class="simqIssue">⚠ ${issues.length===1?html(issues[0]):issues.length+' incidencias'}</span>`:''}
  function removeQuestion(n,{fromProblems=false}={}){const q=simState.questions.find(x=>x.number===n);if(!q)return;if(!confirm(`¿Eliminar la pregunta ${q.number} de esta importación? No se publicará ni se guardará en el banco.`))return;simState.questions=simState.questions.filter(x=>x!==q);simState.selected.delete(q.source_uid);if($('#simQuestionEditDialog')?.open)$('#simQuestionEditDialog').close();recalcStatuses();renderPreview();if(fromProblems&&$('#simProblemsDialog')?.open)renderProblemsDialog();}
  function removeSelectedQuestions(){const selected=simState.questions.filter(q=>simState.selected.has(q.source_uid));if(!selected.length){alert('Selecciona al menos una pregunta para eliminar.');return}const count=selected.length;if(!confirm(`¿Eliminar las ${count} preguntas seleccionadas de esta importación? No se publicarán ni se guardarán en el banco.`))return;const ids=new Set(selected.map(q=>q.source_uid));simState.questions=simState.questions.filter(q=>!ids.has(q.source_uid));simState.selected.clear();if($('#simQuestionEditDialog')?.open)$('#simQuestionEditDialog').close();recalcStatuses();renderPreview();if($('#simProblemsDialog')?.open)renderProblemsDialog();}
  function renderList(){
    NexmirContentRules.retainSelection(simState.selected,filtered().filter(q=>q.status_import!=='unchanged'),q=>q.source_uid);const arr=filtered(), selectedCount=simState.selected.size;$('#simImportSelectedCount').textContent=`${selectedCount} seleccionadas`;const deleteSelected=$('#simDeleteSelected');if(deleteSelected)deleteSelected.disabled=!selectedCount;$('#simQuestionList').innerHTML=arr.length?arr.map(q=>`<div class="simqRow" data-n="${q.number}"><input class="simqSel" type="checkbox" ${simState.selected.has(q.source_uid)?'checked':''} ${q.status_import==='unchanged'?'disabled':''}><div class="simqBadges">${badgeStatus(q.status_import)}${q.is_reserve?'<span class="badge">Reserva</span>':''}${q.image_number?'<span class="badge mcq">Imagen '+q.image_number+'</span>':''}</div><div class="simqCopy"><div class="question">${q.number}. ${html(questionPreview(q.stem,420))}</div><div class="meta">Correcta: ${q.correct_index===null?'—':String.fromCharCode(65+q.correct_index)} · ${html(q.specialty)} › ${html(q.topic||'General')}</div>${questionIssuesHtml(q)}</div><div class="simqActions"><button type="button" class="secondary simqEdit">Revisar</button><button type="button" class="secondary danger simqDelete">Eliminar</button></div></div>`).join(''):'<div class="empty">No hay preguntas con este filtro.</div>';$$('#simQuestionList .simqRow').forEach(row=>{const q=simState.questions.find(x=>x.number===+row.dataset.n);row.querySelector('.simqSel').onclick=e=>{e.stopPropagation();e.target.checked?simState.selected.add(q.source_uid):simState.selected.delete(q.source_uid);renderList()};row.querySelector('.simqEdit').onclick=e=>{e.stopPropagation();editQuestion(q.number)};row.querySelector('.simqDelete').onclick=e=>{e.stopPropagation();removeQuestion(q.number)};row.querySelector('.simqCopy').onclick=()=>editQuestion(q.number)})}
  function getProblemReasons(q){
    const reasons=[];
    if(!readableStem(q)) reasons.push('Enunciado no legible detectado');
    if(q.correct_index===null || q.correct_index===undefined) reasons.push('Respuesta correcta no detectada');
    const validOpts=(q.options||[]).filter(x=>String(x||'').trim()).length;
    if(validOpts<(q.native_uid?2:4)||validOpts!==q.options.length) reasons.push(`Solo ${validOpts}/4 alternativas detectadas`);
    if(!(q.explanation||'').trim()) reasons.push('Explicación/comentario no detectado');
    return reasons;
  }
  function problemQuestions(){return simState.questions.filter(q=>getProblemReasons(q).length>0)}
  function renderProblemsDialog(){
    const rows=problemQuestions(),body=$('#simProblemsBody');if(!body)return;
    const withUnreadable=rows.filter(q=>!readableStem(q)).length,withNoAnswer=rows.filter(q=>q.correct_index===null||q.correct_index===undefined).length,withFewOptions=rows.filter(q=>(q.options||[]).filter(Boolean).length<4).length,withNoExplanation=rows.filter(q=>!(q.explanation||'').trim()).length;
    body.innerHTML=`<div class="problemsDialog"><div class="problemsDialogHead"><div><div class="eyebrow">CONTROL DE CALIDAD</div><h2>Revisión de importación</h2><p class="muted">Corrige las preguntas útiles o elimina las que se hayan leído mal. Las eliminadas no se publicarán.</p></div><span class="problemTotal">${rows.length} pendientes</span></div>${rows.length?`<div class="problemSummary"><div><strong>${withUnreadable}</strong><span>enunciados no legibles</span></div><div><strong>${withNoAnswer}</strong><span>sin clave</span></div><div><strong>${withFewOptions}</strong><span>alternativas incompletas</span></div><div><strong>${withNoExplanation}</strong><span>sin explicación</span></div></div><div class="problemList">${rows.map(q=>`<article class="problemItem"><div class="problemNumber">${q.number}</div><div class="problemCopy"><div class="problemTitle">${html(questionPreview(q.stem,170))}</div><div class="problemMeta">${html(q.specialty)} · ${html(q.topic||'General')}${q.is_reserve?' · Reserva':''}</div><div class="problemReasons">${getProblemReasons(q).map(r=>`<span>${html(r)}</span>`).join('')}</div></div><div class="problemActions"><button type="button" class="secondary simProblemOpen" data-n="${q.number}">Revisar</button><button type="button" class="secondary danger simProblemDelete" data-n="${q.number}">Eliminar</button></div></article>`).join('')}</div>`:'<div class="notice"><strong>No quedan preguntas con problemas.</strong><br>Ya puedes volver a la lista y publicar las seleccionadas.</div>'}<div class="problemsFooter"><button type="button" class="primary" id="simProblemsDone">Volver a la revisión</button></div></div>`;
    $$('.simProblemOpen',body).forEach(btn=>btn.onclick=()=>{ $('#simProblemsDialog').close(); editQuestion(+btn.dataset.n); });
    $$('.simProblemDelete',body).forEach(btn=>btn.onclick=()=>removeQuestion(+btn.dataset.n,{fromProblems:true}));
    $('#simProblemsDone',body).onclick=()=>$('#simProblemsDialog').close();
  }
  function openProblems(){renderProblemsDialog();$('#simProblemsDialog').showModal()}
  function confirmPublishDraft(noAnswer){
    return new Promise(resolve=>{
      const dlg=$('#simProblemsDialog'),body=$('#simProblemsBody');
      body.innerHTML=`<div class="detail"><div class="eyebrow">ANTES DE PUBLICAR</div><h2>${noAnswer.length} preguntas sin respuesta correcta</h2><p class="muted">Estas preguntas se publicarían como borrador. Recomendamos revisarlas primero.</p><div class="problemList">${noAnswer.map(q=>`<div class="cardBox problemItem"><strong>Pregunta ${q.number}</strong><div class="muted" style="margin:6px 0">${html(q.stem).slice(0,220)}</div><button type="button" class="secondary simDraftOpen" data-n="${q.number}">Revisar</button></div>`).join('')}</div><div class="actions"><button type="button" class="secondary" id="simDraftCancel">Volver a revisar</button><button type="button" class="primary" id="simDraftContinue">Continuar como borrador</button></div></div>`;
      $$('.simDraftOpen',body).forEach(btn=>btn.onclick=()=>{dlg.close();resolve(false);editQuestion(+btn.dataset.n)});
      $('#simDraftCancel',body).onclick=()=>{dlg.close();resolve(false)};
      $('#simDraftContinue',body).onclick=()=>{dlg.close();resolve(true)};
      dlg.oncancel=()=>resolve(false);dlg.showModal();
    });
  }
  function renderPreview(){
    recalcStatuses();renderStats();renderList();
    const withAnswer=simState.questions.filter(q=>q.correct_index!==null).length;
    const withExplanation=simState.questions.filter(q=>(q.explanation||'').trim()).length;
    const problems=problemQuestions();
    const box=$('#simImportQuality');
    if(box){
      box.classList.remove('hidden');
      box.innerHTML=problems.length===0
        ? `<strong>Control de calidad:</strong> ${withAnswer}/${simState.questions.length} con respuesta correcta · ${withExplanation}/${simState.questions.length} con explicación. Sin problemas detectados.`
        : `<strong>⚠ Control de calidad:</strong> ${problems.length} preguntas requieren revisión. <button type="button" class="secondary" id="simShowProblems" style="margin-left:8px">Ver problemas (${problems.length})</button>`;
      box.classList.toggle('danger',problems.length>0);
      const b=$('#simShowProblems');if(b)b.onclick=openProblems;
    }
    $('#simImportSetup').classList.add('hidden');$('#simImportReview').classList.remove('hidden');
  }
  function editQuestion(n){
    const q=simState.questions.find(x=>x.number===n);if(!q)return;
    const img=q.image_number&&simState.images.get(q.image_number),topics=[...new Set(simState.taxonomy.filter(x=>x.specialty===q.specialty).map(x=>x.topic).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    const opts=Array.from({length:Math.max(2,q.options?.length||0)},(_,i)=>i).map(i=>q.options?.[i]||'');
    $('#simQuestionEditBody').innerHTML=`<div class="detail simEditor"><div class="simEditorTop"><div><div class="eyebrow">PREGUNTA ${q.number}${q.is_reserve?' · RESERVA':''}</div><h2>Revisar y corregir pregunta</h2></div><button type="button" id="simToggleEditorSize" class="secondary">⛶ Ampliar</button></div>${!readableStem(q)?'<div class="simMalformedNotice"><strong>Lectura incompleta detectada.</strong> Puedes completar el enunciado y guardar, o eliminar esta pregunta de la importación.</div>':''}<div class="simEditorMain ${img?'hasImage':''}"><section class="simEditorPanel"><label class="fieldLabel simEditorLabel">Enunciado<textarea class="simEditorTextarea simStemTextarea" id="simEditStem" rows="7">${html(q.stem)}</textarea></label></section>${img?`<section class="simEditorPanel simEditorImagePanel"><div class="simEditorSectionTitle">Imagen asociada ${q.image_number||''}</div><img class="simImagePreview" src="${img.url}" alt="Imagen ${q.image_number}"></section>`:''}</div><section class="simEditorPanel"><div class="simEditorSectionTitle">Alternativas</div><div class="simOptionsEditGrid">${opts.map((o,i)=>`<label class="fieldLabel simOptionEditor"><span class="simOptionLetter">${String.fromCharCode(65+i)}</span><textarea class="simEditorTextarea simOptionTextarea" id="simEditOpt${i}" rows="4">${html(o)}</textarea></label>`).join('')}</div><div class="simCorrectRow"><label class="fieldLabel">Respuesta correcta<select id="simEditCorrect"><option value="">Sin detectar</option>${[0,1,2,3].map(i=>`<option value="${i}" ${i===q.correct_index?'selected':''}>${String.fromCharCode(65+i)} · ${html((opts[i]||'').slice(0,80))}</option>`).join('')}</select></label></div></section><section class="simEditorPanel"><label class="fieldLabel simEditorLabel">Comentario / explicación<textarea class="simEditorTextarea simExplanationTextarea" id="simEditExplanation" rows="10">${html(q.explanation||'')}</textarea></label></section><section class="simEditorPanel"><div class="simEditorSectionTitle">Clasificación</div><div class="grid2"><label class="fieldLabel">Especialidad<select id="simEditSpec">${MIR_SPECS.map(s=>`<option ${s===q.specialty?'selected':''}>${html(s)}</option>`).join('')}</select></label><label class="fieldLabel">Tema<input id="simEditTopic" list="simTopicList" value="${html(q.topic||'General')}"><datalist id="simTopicList">${topics.map(t=>`<option value="${html(t)}">`).join('')}</datalist></label><label class="fieldLabel">Subtema<input id="simEditSub" value="${html(q.subtopic||'')}"></label><label class="fieldLabel">Apartado<input id="simEditSection" value="${html(q.section||'')}"></label></div></section><div class="simEditorStickyActions"><button type="button" id="simDeleteEdit" class="secondary danger">Eliminar pregunta</button><span class="simEditorActionSpacer"></span><button type="button" id="simCancelEdit" class="secondary">Cancelar</button><button id="simSaveEdit" class="primary">Guardar cambios</button></div></div>`;
    const dlg=$('#simQuestionEditDialog');dlg.showModal();
    const autoGrow=el=>{el.style.height='auto';el.style.height=Math.min(Math.max(el.scrollHeight,96),420)+'px'};
    $$('#simQuestionEditBody textarea').forEach(el=>{autoGrow(el);el.addEventListener('input',()=>autoGrow(el))});
    $('#simCancelEdit').onclick=()=>dlg.close();
    $('#simDeleteEdit').onclick=()=>removeQuestion(q.number);
    $('#simToggleEditorSize').onclick=()=>{dlg.classList.toggle('maximized');$('#simToggleEditorSize').textContent=dlg.classList.contains('maximized')?'🗗 Restaurar':'⛶ Ampliar'};
    $('#simSaveEdit').onclick=()=>{
      q.stem=$('#simEditStem').value.trim();q.options=opts.map((_,i)=>$('#simEditOpt'+i).value.trim());const cv=$('#simEditCorrect').value;q.correct_index=cv===''?null:+cv;q.explanation=$('#simEditExplanation').value.trim();q.specialty=$('#simEditSpec').value;q.topic=$('#simEditTopic').value.trim()||'General';q.subtopic=$('#simEditSub').value.trim()||null;q.section=$('#simEditSection').value.trim()||null;if(q.remnote_metadata)q.remnote_metadata={...q.remnote_metadata,classification_origin:'admin_manual'};q.parse_problem=getProblemReasons(q).length>0;simState.selected.add(q.source_uid);$('#simQuestionEditDialog').close();recalcStatuses();renderStats();renderList();renderPreview();
    };
  }
  function sanitizeQuestion(q){
    q.stem=scrubBrandText(q.stem);
    q.options=(q.options||[]).map(scrubBrandText);
    q.explanation=scrubBrandText(q.explanation||'');
    return q;
  }

  async function buildFromPdfSeparate(qf,rf,imf){
    simState.sourceKind='pdf_separate';const qLines=qf?await extractExamLines(qf,3,25):null,rLines=rf?await extractExamLines(rf,28,28):null,qb=qLines?blocksByQuestionAll(qLines):new Map(),rb=rLines?blocksByQuestionAll(rLines):new Map();
    const nums=[...new Set([...qb.keys(),...rb.keys()])].filter(n=>n>=1&&n<=400).sort((a,b)=>a-b);if(nums.length<5)throw new Error('Se detectaron muy pocas preguntas. Revisa que los PDFs correspondan al simulacro.');
    for(const n of nums){
      // Fusiona ambos PDFs. El de respuestas suele contener también enunciado y alternativas,
      // y sirve como respaldo si el PDF de preguntas se extrae mal por columnas o saltos de página.
      const base=mergeQuestionBlocks([qb.get(n),rb.get(n)],n);if(!base)continue;
      const ans=bestAnswer(rb.get(n)?.length?rb.get(n):qb.get(n));
      const q=sanitizeQuestion({...base,correct_index:ans.correct_index,explanation:ans.explanation,is_reserve:n>200,specialty:'Sin clasificar',topic:'General',subtopic:null,section:null});
      q.parse_problem=q.options.filter(Boolean).length<4 || (rf && !q.explanation);
      q.specialty=inferSpecialty(q);Object.assign(q,inferTopic(q,q.specialty));simState.questions.push(q)
    }
    if(imf)simState.images=await extractImages(imf,58,25);
  }
  async function buildFromPdfSingle(file,imf){
    simState.sourceKind='pdf_single';const lines=await extractExamLines(file,4,50),all=blocksByQuestionAll(lines),nums=[...all.keys()].filter(n=>n>=1&&n<=400).sort((a,b)=>a-b);if(nums.length<5)throw new Error('Se detectaron muy pocas preguntas en el PDF único.');
    for(const n of nums){const blocks=all.get(n),base=mergeQuestionBlocks([blocks],n);if(!base)continue;const ans=bestAnswer(blocks),q=sanitizeQuestion({...base,correct_index:ans.correct_index,explanation:ans.explanation,is_reserve:n>200,specialty:'Sin clasificar',topic:'General',subtopic:null,section:null});q.parse_problem=q.options.filter(Boolean).length<4||!q.explanation;q.specialty=inferSpecialty(q);Object.assign(q,inferTopic(q,q.specialty));simState.questions.push(q)}
    if(imf)simState.images=await extractImages(imf,58,25);
  }
  async function loadRemnoteMarkdown(file){
    const out=[];if(!file)throw new Error('Selecciona una exportación de RemNote.');const low=file.name.toLowerCase();
    if(low.endsWith('.zip')){const zip=await JSZip.loadAsync(file),entries=Object.values(zip.files).filter(x=>!x.dir&&/\.(?:md|markdown)$/i.test(x.name));if(!entries.length)throw new Error('El ZIP no contiene archivos Markdown.');let i=0;for(const e of entries){out.push({name:e.name,text:await e.async('string')});i++;setProg(8+42*(i/entries.length),`Leyendo RemNote ${i}/${entries.length}`)}}
    else if(/\.(?:md|markdown)$/i.test(low))out.push({name:file.name,text:await file.text()});else throw new Error('Para RemNote usa ZIP, .md o .markdown.');return out;
  }
  async function buildFromRemnote(file){
    simState.sourceKind='remnote_mcq';const mds=await loadRemnoteMarkdown(file),cards=[];let i=0;
    for(const md of mds){const r=parseMarkdown(md.text,md.name,{archiveName:file.name});cards.push(...r.cards.filter(c=>c.type==='multiple_choice'));i++;setProg(52+25*(i/mds.length),`Analizando tarjetas ${i}/${mds.length}`)}
    const unique=dedupe(cards).unique.sort((a,b)=>String(a.source).localeCompare(String(b.source),'es')-(0)||(+a.line||0)-(+b.line||0));if(!unique.length)throw new Error('No encontré flashcards de opción múltiple en esta exportación de RemNote.');
    let n=0;for(const c of unique){n++;const resolved=typeof resolveRemnoteMcqOptions==='function'?resolveRemnoteMcqOptions(c.options||[]):null,rawOpts=resolved?.options||(c.options||[]),opts=rawOpts.map(o=>scrubBrandText(typeof o==='string'?o:o.text||'')),correct=resolved?.correct_index??rawOpts.findIndex(o=>o.correct),extra=resolved?.explanation||(rawOpts.find(o=>o.correct)?.extra||c.explanation||[]),q=sanitizeQuestion({number:n,native_uid:c.uid,classification_origin:c.classification_origin,remnote_metadata:{source_path:c.source,context:c.context||[],native_uid:c.uid,classification_origin:c.classification_origin,content_use:'simulation',archive_name:c.archive_name},image_number:null,stem:c.front||'',options:opts,correct_index:correct>=0&&correct<opts.length?correct:null,explanation:Array.isArray(extra)?extra.join('\n'):String(extra||''),is_reserve:false,specialty:c.specialty||'Sin clasificar',topic:c.topic||'General',subtopic:c.subtopic||null,section:c.section||null,correct_inferred_by:resolved?.method||c.correct_inferred_by||null});simState.questions.push(q)}
  }

  function detectDefaultName(){
    let f=null;if(simState.mode==='separate')f=$('#simQuestionsPdf').files[0]||$('#simAnswersPdf').files[0];else if(simState.mode==='single')f=$('#simSinglePdf').files[0];else f=$('#simRemnoteFile').files[0];return sanitizeExamName($('#simExamName').value.trim()||f?.name||'Simulacro');
  }
  async function analyze(){
    if(simState.analyzing)return;simState.filter='all';$('#simImportSearch').value='';$$('#simImportTabs .tab').forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));simState.analyzing=true;simState.questions=[];simState.images.forEach(x=>URL.revokeObjectURL(x.url));simState.images=new Map();simState.selected.clear();showProg(true);setProg(1,'Preparando');$('#simAnalyzeBtn').disabled=true;
    try{
      await loadTaxonomy();
      if(simState.mode==='separate'){
        const qf=$('#simQuestionsPdf').files[0],rf=$('#simAnswersPdf').files[0],imf=$('#simImagesPdf').files[0];if(!qf&&!rf)throw new Error('Selecciona el PDF de preguntas y/o el PDF de respuestas/comentarios.');await buildFromPdfSeparate(qf,rf,imf);
      }else if(simState.mode==='single'){
        const sf=$('#simSinglePdf').files[0],imf=$('#simSingleImagesPdf').files[0];if(!sf)throw new Error('Selecciona el PDF único.');await buildFromPdfSingle(sf,imf);
      }else{
        const rf=$('#simRemnoteFile').files[0];await buildFromRemnote(rf);
      }
      setProg(84,'Comprobando respuestas');const exam=detectDefaultName();$('#simExamName').value=exam;await existingForExam(exam);setProg(94,'Comparando con Supabase');renderPreview();setProg(100,`Listo · ${simState.questions.length} preguntas`);setTimeout(()=>showProg(false),1200);
    }catch(e){console.error(e);alert('No se pudo analizar el simulacro: '+(e.message||e));showProg(false)}finally{simState.analyzing=false;$('#simAnalyzeBtn').disabled=false}
  }

  async function uploadImages(examName,selectedQs,onProgress){
    const needed=[...new Set(selectedQs.map(q=>q.image_number).filter(Boolean))],map=new Map();let done=0;for(const n of needed){const im=simState.images.get(n);if(!im){done++;continue}const path=`${slug(examName)}/imagen-${String(n).padStart(2,'0')}.jpg`;const {error}=await sb.storage.from('question-images').upload(path,im.blob,{contentType:'image/jpeg',upsert:true});if(error)throw error;map.set(n,path);done++;onProgress?.(done,needed.length)}return map;
  }
  function missingQuestionColumn(error){
    const msg=String(error?.message||error||'');
    const m=msg.match(/Could not find the ['"]([^'"]+)['"] column of ['"]?questions['"]? in the schema cache/i)
      || msg.match(/column ['"]?questions\.([^'"\s]+)['"]? does not exist/i)
      || msg.match(/column ['"]([^'"]+)['"] of relation ['"]questions['"] does not exist/i);
    return m?.[1]||null;
  }
  async function writeQuestionCompat(row,dbId){
    const payload={...row};
    const removed=[];
    for(let attempt=0;attempt<20;attempt++){
      let error=null;
      if(dbId){({error}=await sb.from('questions').update(payload).eq('id',dbId))}
      else{({error}=await sb.from('questions').upsert(payload,{onConflict:'source_uid'}))}
      if(!error)return {removed};
      const col=missingQuestionColumn(error);
      if(col && Object.prototype.hasOwnProperty.call(payload,col)){
        delete payload[col];removed.push(col);
        console.warn(`NEXMIR: columna opcional ausente en questions: ${col}. Reintentando sin ella.`);
        continue;
      }
      // Compatibilidad con esquemas antiguos sin source_uid/ON CONFLICT.
      if(/source_uid|on conflict|unique constraint|no unique or exclusion constraint/i.test(String(error.message||'')) && !dbId){
        const fallback={...payload};delete fallback.source_uid;
        const {error:insertError}=await sb.from('questions').insert(fallback);
        if(!insertError)return {removed:[...removed,'source_uid']};
        const fallbackCol=missingQuestionColumn(insertError);
        if(fallbackCol && Object.prototype.hasOwnProperty.call(payload,fallbackCol)){
          delete payload[fallbackCol];removed.push(fallbackCol);continue;
        }
        throw insertError;
      }
      throw error;
    }
    throw new Error('No se pudo adaptar la publicación al esquema actual de questions.');
  }
  async function publish(){
    NexmirContentRules.retainSelection(simState.selected,filtered().filter(q=>q.status_import!=='unchanged'),q=>q.source_uid);
    if(!cloudMode||!sb){alert('Conecta Supabase e inicia sesión como admin antes de publicar.');return}const selected=simState.questions.filter(q=>simState.selected.has(q.source_uid)&&q.status_import!=='unchanged');if(!selected.length){alert('No hay preguntas nuevas o modificadas seleccionadas.');return}if(simState.sourceKind==='remnote_mcq'&&!validateRemnotePublication(selected.map(q=>({status:'new',newValue:q}))))return;const noAnswer=selected.filter(q=>!NexmirContentRules.validTest(q));if(noAnswer.length&&!(await confirmPublishDraft(noAnswer)))return;
    const exam=sanitizeExamName($('#simExamName').value.trim()||'Simulacro'),year=Number($('#simExamYear').value)||null;$('#simExamName').value=exam;$('#simPublishBtn').disabled=true;showProg(true);setProg(1,'Preparando publicación');
    try{
      const {data:imp,error:ie}=await sb.from('question_imports').insert({name:exam,source_kind:simState.sourceKind,status:'processing',counts:{detected:simState.questions.length,selected:selected.length,images:simState.images.size},created_by:cloudUser.id}).select().single();if(ie)throw ie;
      const imagePaths=await uploadImages(exam,selected,(d,t)=>setProg(5+25*(d/Math.max(1,t)),`Subiendo imágenes ${d}/${t}`));let done=0;
      const skippedColumns=new Set();
      for(const q0 of selected){const q=sanitizeQuestion({...q0}),row={source_uid:q.source_uid,source_exam:exam,source_number:q.number,image_path:imagePaths.get(q.image_number)||simState.existingByNumber.get(+q.number)?.image_path||null,is_reserve:!!q.is_reserve,specialty:q.specialty||'Sin clasificar',topic:q.topic||'General',subtopic:q.subtopic||null,section:q.section||null,stem:q.stem,options:q.options,correct_index:q.correct_index??0,explanation:q.explanation||null,year,source:simState.sourceKind==='remnote_mcq'?'RemNote':'PDF',status:NexmirContentRules.validTest(q)?'published':'draft',import_id:imp.id,updated_at:new Date().toISOString(),...(q.remnote_metadata?{remnote_metadata:q.remnote_metadata}:{})};
        const result=await writeQuestionCompat(row,q.db_id);for(const c of result.removed||[])skippedColumns.add(c);done++;setProg(32+64*(done/selected.length),`Publicando ${done}/${selected.length}`)}
      if(skippedColumns.size)console.info('NEXMIR publicó usando compatibilidad de esquema. Columnas omitidas:',[...skippedColumns]);
      const {error:ue}=await sb.from('question_imports').update({status:'published',published_at:new Date().toISOString(),counts:{detected:simState.questions.length,published:selected.length,new:selected.filter(q=>q.status_import==='new').length,modified:selected.filter(q=>q.status_import==='modified').length,draft:selected.filter(q=>q.correct_index===null).length,images:imagePaths.size,reserve:simState.questions.filter(q=>q.is_reserve).length}}).eq('id',imp.id);if(ue)throw ue;setProg(100,'Publicación completada');alert(`Añadidas ${selected.length} preguntas al banco reutilizable. Los usuarios ya pueden combinarlas en sus propios simulacros.`);await existingForExam(exam);recalcStatuses();simState.selected.clear();renderStats();renderList();setTimeout(()=>showProg(false),1800);
    }catch(e){console.error(e);const msg=String(e?.message||e);if(/row-level security|violates row-level security|permission denied/i.test(msg)){alert('Supabase bloqueó la publicación por permisos RLS. Ejecuta FIX_RLS_SIMULACROS.sql incluido en esta versión y confirma que tu usuario aparece con role = admin o moderator.');}else{alert('No se pudo publicar el simulacro: '+msg)}}finally{$('#simPublishBtn').disabled=false}
  }
  function reset(){simState.images.forEach(x=>URL.revokeObjectURL(x.url));simState.questions=[];simState.images=new Map();simState.selected.clear();$('#simImportReview').classList.add('hidden');$('#simImportSetup').classList.remove('hidden');['simQuestionsPdf','simAnswersPdf','simImagesPdf','simSinglePdf','simSingleImagesPdf','simRemnoteFile'].forEach(id=>{const el=$('#'+id);if(el)el.value=''});showProg(false)}
  function setMode(mode){simState.mode=mode;$$('#simSourceTabs .tab').forEach(x=>x.classList.toggle('active',x.dataset.mode===mode));$('#simModeSeparate').classList.toggle('hidden',mode!=='separate');$('#simModeSingle').classList.toggle('hidden',mode!=='single');$('#simModeRemnote').classList.toggle('hidden',mode!=='remnote');const help={separate:'Usa un PDF de preguntas y otro de respuestas/comentarios. El cuadernillo de imágenes es opcional.',single:'Usa un único PDF que incluya preguntas y sus respuestas/comentarios. Puedes añadir un PDF de imágenes si vienen aparte.',remnote:'Sube un ZIP o Markdown exportado de RemNote. Solo las flashcards de opción múltiple se convierten en preguntas. La correcta se infiere por la explicación hija y, si no existe, por la primera alternativa.'};$('#simModeHelp').textContent=help[mode]}
  function init(){
    if(!$('#simAnalyzeBtn'))return;$('#simSourceTabs').onclick=e=>{if(e.target.matches('.tab'))setMode(e.target.dataset.mode)};setMode('separate');$('#simAnalyzeBtn').onclick=analyze;$('#simPublishBtn').onclick=publish;$('#simImportReset').onclick=reset;$('#simDeleteSelected').onclick=removeSelectedQuestions;$('#simQuestionEditClose').onclick=()=>$('#simQuestionEditDialog').close();$('#simProblemsClose').onclick=()=>$('#simProblemsDialog').close();$('#simImportSearch').oninput=renderList;$('#simImportTabs').onclick=e=>{if(!e.target.matches('.tab'))return;$$('#simImportTabs .tab').forEach(x=>x.classList.remove('active'));e.target.classList.add('active');simState.filter=e.target.dataset.filter;renderList()};$('#simSelectVisible').onchange=e=>{for(const q of filtered()){if(q.status_import==='unchanged')continue;e.target.checked?simState.selected.add(q.source_uid):simState.selected.delete(q.source_uid)}renderList()};$('#simExamName').onchange=async()=>{if(!simState.questions.length)return;try{$('#simExamName').value=sanitizeExamName($('#simExamName').value);await existingForExam($('#simExamName').value.trim());simState.selected.clear();renderPreview()}catch(e){alert(e.message)}};
  }
  window.NexmirSimImportReview={rows:()=>simState.questions,selected:()=>simState.selected,filtered,render:renderList,busy:()=>simState.analyzing||$('#simPublishBtn').disabled,remove:ids=>{simState.questions=simState.questions.filter(q=>!ids.has(q.source_uid));simState.selected.clear();recalcStatuses();renderPreview()}};
  init();
})();
