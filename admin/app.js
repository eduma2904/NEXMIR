const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DB_KEY='mir_admin_v4_db';
const SB_CFG_KEY='mir_admin_v4_supabase';
let sb=null, cloudUser=null, cloudRole=null, cloudMode=false;
const typeNames={basic:'Básica',multiline:'Multilínea',ordered:'Ordenada',multiple_choice:'Opción múltiple',cloze:'Cloze',bidirectional:'Bidireccional',reverse:'Reversa'};
const state={db:loadDb(),import:null,statusFilter:'all',selected:new Set(),contentKind:'cards'};
function emptyDb(){return{cards:{},theory:{},history:[],imports:[],meta:{schema:'4.1',created_at:new Date().toISOString()}}}
function loadDb(){try{return JSON.parse(localStorage.getItem(DB_KEY))||emptyDb()}catch{return emptyDb()}}
function saveDb(){localStorage.setItem(DB_KEY,JSON.stringify(state.db));renderDashboard()}
function cleanRemnoteMarks(s=''){return String(s??'').replace(/\^\^/g,'').replace(/\u200b/g,'')}
function clean(s){return cleanRemnoteMarks(s||'').replace(/^\s*-\s*/,'').trim()}
function stripMd(s){return cleanRemnoteMarks(s||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'[imagen]').replace(/\*\*/g,'').replace(/[_`]/g,'').trim()}
function normalize(s){return stripMd(s).toLowerCase().replace(/\s+/g,' ').replace(/[“”]/g,'"').trim()}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
function indentOf(line){const m=line.match(/^(\s*)/);return(m?m[1].replace(/\t/g,'    ').length:0)}
function listContent(line){return line.replace(/^\s*[-*+]\s+/,'').trimEnd()}
function getImages(s){return[...(s||'').matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1])}
function getTags(s){return[...(s||'').matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)].map(m=>m[1])}

function setImportProgress(pct,text=''){const p=Math.max(0,Math.min(100,Math.round(pct)));const bar=$('#importProgressBar'),lab=$('#importProgressPct');if(bar)bar.style.width=p+'%';if(lab)lab.textContent=p+'%';if(text&&$('#loadingText'))$('#loadingText').textContent=text}
function setPublishProgress(pct,text=''){const p=Math.max(0,Math.min(100,Math.round(pct)));const wrap=$('#publishProgressWrap'),bar=$('#publishProgressBar'),lab=$('#publishProgressText');if(wrap)wrap.classList.remove('hidden');if(bar)bar.style.width=p+'%';if(lab)lab.textContent=text?`${p}% · ${text}`:`${p}%`}
function hidePublishProgress(){const wrap=$('#publishProgressWrap');if(wrap)wrap.classList.add('hidden')}
function marker(text){const t=text.trim();if(/>>A\)\s*$/.test(t))return{type:'multiple_choice',marker:'>>A)'};if(/>>1\.\s*$/.test(t))return{type:'ordered',marker:'>>1.'};if(/>>>\s*$/.test(t))return{type:'multiline',marker:'>>>'};if(/<>/.test(t))return{type:'bidirectional',marker:'<>'};if(/<<|:<|;</.test(t))return{type:'reverse',marker:(t.match(/<<|:<|;</)||[])[0]};if(/→|―|==/.test(t))return{type:'basic',marker:(t.match(/→|―|==/)||[])[0]};if(/{{[^}]+}}/.test(t))return{type:'cloze',marker:'{{}}'};if(/(?:^|[^>])>>(?=[^>])/.test(t)||/:>|;;/.test(t))return{type:'basic',marker:(t.match(/>>|:>|;;/)||[])[0]};return null}
function contextOf(stack,pathParts){
  const files=pathParts.map(x=>cleanContextName(x.replace(/\.(md|markdown)$/i,'')));
  const headings=stack.filter(x=>x.text).map(x=>cleanContextName(x.text));
  const out=[];for(const x of [...files,...headings])if(x&&normalize(out.at(-1)||'')!==normalize(x))out.push(x);
  return out;
}
const SPECIALTY_RULES=[
  ['Ginecología y Obstetricia',/embaraz|aborto|ect[oó]pic|mola|trofobl|gestaci|placenta|preeclamp|eclamp|parto|puerper|ovario|uter|cervi|ginec|obstetr/i],
  ['Cardiología',/cardio|arr[ií]t|fibrilaci[oó]n auricular|flutter|infarto|iam|sca|insuficiencia card|valvul|hipertensi[oó]n|ecg|electrocard/i],
  ['Endocrinología',/endocr|diabetes|tiroid|suprarren|addison|cushing|hip[oó]fis|adh|siadh|calcio|paratiroid/i],
  ['Gastroenterología',/digest|gastro|hepat|cirrosis|pancre|intestin|colon|crohn|colitis|es[oó]fag/i],
  ['Nefrología',/nefro|renal|glomer|proteinuria|hematuria|di[aá]lisis|riñ[oó]n/i],
  ['Neumología',/neumo|pulm[oó]n|asma|epoc|pleura|neumon|tromboembolismo pulmonar/i],
  ['Neurología',/neuro|ictus|epilep|parkinson|alzheimer|esclerosis|cefalea/i],
  ['Infecciosas',/vih|infecc|antibi[oó]tico|malaria|tuberculosis|endocarditis infecciosa|virus|bacteria|hongo/i],
  ['Hematología',/hemat|anemia|leucem|linfoma|mieloma|coagul|plaqueta/i],
  ['Reumatología',/reumat|lupus|artritis|vasculitis|escleroderm|sj[oö]gren/i],
  ['Pediatría',/pediatr|neonato|lactante|niñ|vacuna/i],
  ['Psiquiatría',/psiqu|depresi[oó]n|esquizofren|bipolar|ansiedad/i],
  ['Epidemiología y Medicina Preventiva',/epidemi|medicina preventiva|preventiva|bioestad|salud p[uú]blica|sensibilidad|especificidad|riesgo relativo|odds ratio|incidencia|prevalencia/i],
  ['Dermatología',/dermat|melanoma|psoriasis|eczema|piel/i],
  ['Oncología',/oncolog|c[aá]ncer|carcinoma|tumor|neoplas/i],
  ['Traumatología',/trauma|fractura|luxaci[oó]n|ortop/i],
  ['Oftalmología',/oftalm|retina|glaucoma|catarata|ojo/i],
  ['Otorrinolaringología',/otorrino|o[ií]do|sinusitis|laringe|faringe/i],
  ['Urología',/urolog|pr[oó]stata|test[ií]culo|vejiga/i]
];
function cleanContextName(x){return stripMd(String(x||'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')).replace(/^#+\s*/,'').replace(/^[-–—\s]+|[-–—\s]+$/g,'').replace(/\s+[a-f0-9]{32}$/i,'').trim()}
const SPECIALTY_ALIASES={
 'Cardiología':['cardiologia','cardio'], 'Gastroenterología':['gastroenterologia','digestivo','aparato digestivo','gastro'],
 'Endocrinología y Nutrición':['endocrinologia','endocrinologia y nutricion','endocrino'],
 'Enfermedades Infecciosas':['enfermedades infecciosas','infecciosas','infectologia'],
 'Ginecología y Obstetricia':['ginecologia y obstetricia','ginecologia','obstetricia','gine'],
 'Oncología Médica':['oncologia','oncologia medica'],
 'Epidemiología y Medicina Preventiva':['epidemiologia','medicina preventiva','epidemiologia y medicina preventiva','bioestadistica'],
 'Otorrinolaringología':['otorrinolaringologia','otorrino','orl'],
 'Traumatología':['traumatologia','traumatologia y ortopedia'],
 'Geriatría y Cuidados Paliativos':['geriatria','cuidados paliativos','geriatria y cuidados paliativos'],
 'Radiología y Urgencias':['radiologia','urgencias','radiologia y urgencias'],
 'Cirugía General':['cirugia general','cirugia'], 'Inmunología y Genética':['inmunologia','genetica','inmunologia y genetica'],
 'Bioética y Medicina Legal':['bioetica','medicina legal','bioetica y medicina legal'], 'Farmacología':['farmacologia']
};
function hierarchyKey(s){return normalize(cleanContextName(s)).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^\d+[.) -]+/,'').replace(/\s+amir$/,'').replace(/\s+/g,' ').trim()}
function explicitSpecialty(s){const n=hierarchyKey(s);for(const [name,aliases] of Object.entries(SPECIALTY_ALIASES))if(aliases.includes(n))return name;for(const [name] of SPECIALTY_RULES)if(hierarchyKey(name)===n)return name;return null}
function inferSpecialty(context,source){
  const parts=[...(context||[]),...String(source||'').split('/').map(x=>x.replace(/\.(md|markdown)$/i,''))];
  for(const p of parts){const sp=explicitSpecialty(p);if(sp)return sp}
  // Fallback only if the structural labels agree on one subject.
  const hay=parts.join(' '),matches=SPECIALTY_RULES.filter(([,re])=>re.test(hay));
  return matches.length===1?(explicitSpecialty(matches[0][0])||matches[0][0]):'Sin clasificar';
}
function classify(context,source){
  const parts=[];
  for(const raw of [...String(source||'').split('/').map(x=>x.replace(/\.(md|markdown)$/i,'')),...(context||[])]){
    const x=cleanContextName(raw);if(!x||/^remnoteexport/i.test(x))continue;
    if(!parts.some(p=>hierarchyKey(p)===hierarchyKey(x)))parts.push(x);
  }
  const index=parts.findIndex(x=>explicitSpecialty(x));
  const specialty=index>=0?explicitSpecialty(parts[index]):inferSpecialty(parts,'');
  const candidates=index>=0?parts.slice(index+1):parts;
  const topic=candidates[0]||'General',subtopic=candidates[1]||null,section=candidates.slice(2).join(' › ')||null;
  return{specialty,topic,subtopic,section,path:[specialty,topic,subtopic,section].filter(Boolean),classification_origin:index>=0?'remnote_hierarchy':specialty==='Sin clasificar'?'unresolved':'label_inference'};
}
function parseMarkdownTable(lines){if(lines.length<2)return null;const split=row=>row.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());const headers=split(lines[0]);if(!headers.length||!/^\s*\|?\s*:?-{3,}/.test(lines[1]))return null;const rows=lines.slice(2).filter(Boolean).map(split);return{headers,rows,markdown:lines.join('\n')}}
function theoryBlocks(body){const lines=(body||'').split('\n'),blocks=[];let buf=[];const flush=()=>{const t=buf.join('\n').trim();buf=[];if(t)blocks.push({type:'markdown',text:t})};for(let i=0;i<lines.length;i++){if(lines[i].includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){flush();const tbl=[lines[i],lines[i+1]];i+=2;while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){tbl.push(lines[i]);i++}i--;const parsed=parseMarkdownTable(tbl);if(parsed)blocks.push({type:'table',...parsed});else buf.push(...tbl)}else buf.push(lines[i])}flush();return blocks}
function applyClassification(obj){const c=classify(obj.context||[],obj.source||'');Object.assign(obj,c);return obj}
function stableUid(c){return 'rn_'+hash([c.type,normalize(c.front)].join('§'))}
function contentHash(c){return hash(JSON.stringify({type:c.type,front:normalize(c.front),back:normalize(c.back||''),items:(c.items||[]).map(x=>normalize(x.text)),options:(c.options||[]).map(x=>({t:normalize(x.text),c:!!x.correct,e:(x.extra||[]).map(normalize)})),tags:[...(c.tags||[])].sort(),images:c.images||[]}))}
function resolveRemnoteMcqOptions(options){
  const opts=(options||[]).map(o=>({text:String(o?.text||'').trim(),correct:!!o?.correct,extra:(o?.extra||[]).map(x=>String(x||'').trim()).filter(Boolean),line:o?.line||null})).filter(o=>o.text||o.extra.length);
  if(!opts.length)return{options:[],correct_index:null,explanation:[],method:'none',multiple_explanations:false};
  const explicit=opts.findIndex(o=>o.correct);
  const explained=opts.map((o,i)=>({i,len:o.extra.join(' ').trim().length})).filter(x=>x.len>0).sort((a,b)=>b.len-a.len);
  let idx=explicit>=0?explicit:(explained.length?explained[0].i:0);
  opts.forEach((o,i)=>o.correct=i===idx);
  return{options:opts,correct_index:idx,explanation:opts[idx]?.extra||[],method:explicit>=0?'explicit_marker':explained.length?'child_explanation':'first_option_fallback',multiple_explanations:explained.length>1};
}
function parseMarkdown(text,source){const lines=text.replace(/\r\n/g,'\n').split('\n'),cards=[],theory=[],issues=[],stack=[],pathParts=source.split('/');let theoryBuffer=[],theoryContext=null;const flushTheory=()=>{const body=theoryBuffer.join('\n').trim();theoryBuffer=[];if(body&&body.replace(/[-#|\s]/g,'').length>2){const ctx=theoryContext||contextOf(stack,pathParts),blocks=theoryBlocks(body);const item=applyClassification({uid:'th_'+hash(normalize(body)+'§'+ctx.slice(-2).join('§')),source,context:ctx,text:body,blocks,tables:blocks.filter(b=>b.type==='table'),images:getImages(body),content_hash:hash(normalize(body))});theory.push(item)}theoryContext=null};
for(let i=0;i<lines.length;i++){const raw=lines[i];if(!raw.trim()){if(theoryBuffer.length)theoryBuffer.push('');continue}const ind=indentOf(raw),content=listContent(raw).trim();while(stack.length&&stack.at(-1).indent>=ind)stack.pop();if(/^#{1,6}\s+/.test(content)){flushTheory();const level=(content.match(/^#+/)||['#'])[0].length,listHeading=/^\s*[-*+]\s+/.test(raw),headingIndent=listHeading?ind:-1;while(stack.length&&stack.at(-1).headingLevel&&stack.at(-1).headingLevel>=level&&(stack.at(-1).headingIndent??-1)>=headingIndent)stack.pop();stack.push({indent:listHeading?ind-0.5:-100+level,text:content.replace(/^#+\s*/,''),headingLevel:level,headingIndent});continue}const m=marker(content);if(m){flushTheory();const ctx=contextOf(stack,pathParts),base=applyClassification({type:m.type,source,sources:[source],line:i+1,context:ctx,tags:getTags(content),images:getImages(content),raw:content});if(['basic','bidirectional','reverse'].includes(m.type)){const idx=content.indexOf(m.marker);base.front=content.slice(0,idx).trim();base.back=content.slice(idx+m.marker.length).trim();base.images=[...new Set([...getImages(base.front),...getImages(base.back)])];cards.push(base);continue}if(m.type==='cloze'){base.front=content;base.back=null;base.clozes=[...content.matchAll(/{{([^}]+)}}/g)].map(x=>x[1]);cards.push(base);continue}base.front=content.replace(new RegExp(m.marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*$'),'').trim();const children=[];let j=i+1;while(j<lines.length){const r=lines[j];if(!r.trim()){j++;continue}const ci=indentOf(r);if(ci<=ind)break;children.push({raw:r,indent:ci,text:listContent(r).trim(),line:j+1});j++}if(m.type==='multiple_choice'){const topCandidates=children.filter(c=>/^\s*-/.test(c.raw)||/^\s*\d+\./.test(c.raw));const optionIndent=topCandidates.length?Math.min(...topCandidates.map(c=>c.indent)):(children[0]?.indent||ind+4);const opts=[];let current=null;children.forEach(c=>{if(c.indent===optionIndent){const correct=/^\(Correct\)\s*/i.test(c.text),txt=c.text.replace(/^\(Correct\)\s*/i,'').replace(/^\d+\.\s*/,'').trim();current={text:txt,correct,extra:[],line:c.line};opts.push(current)}else if(current)current.extra.push(c.text)});const resolved=resolveRemnoteMcqOptions(opts);base.options=resolved.options;base.correct_inferred_by=resolved.method;base.back=resolved.correct_index==null?null:(resolved.options[resolved.correct_index]?.text||null);base.explanation=resolved.explanation;if(resolved.correct_index==null)issues.push({level:'warn',source,line:i+1,title:'MCQ sin alternativas válidas',detail:stripMd(base.front)});else if(resolved.multiple_explanations&&!opts.some(o=>o.correct))issues.push({level:'warn',source,line:i+1,title:'MCQ con varias alternativas con contenido hijo',detail:'Se eligió como correcta la alternativa con la explicación más extensa: '+stripMd(base.front)});cards.push(base)}else{base.items=children.map(c=>({text:c.text.replace(/^\d+\.\s*/,''),depth:Math.max(1,Math.round((c.indent-ind)/4)),line:c.line}));base.back=base.items.map(x=>x.text).join(' | ');cards.push(base)}i=j-1;continue}let next=i+1;while(next<lines.length&&!lines[next].trim())next++;
const parent=/^\s*[-*+]\s+/.test(raw)&&next<lines.length&&indentOf(lines[next])>ind;
if(/^\*\*[^*]+\*\*\s*$/.test(content)||parent){flushTheory();stack.push({indent:ind,text:content});continue}
if(!theoryBuffer.length)theoryContext=contextOf(stack,pathParts);theoryBuffer.push(content)}flushTheory();cards.forEach(c=>{c.uid=stableUid(c);c.content_hash=contentHash(c)});return{cards,theory,issues}}
function dedupe(cards){const byContent=new Map(),collisions=[];for(const c of cards){const exact=c.content_hash;if(byContent.has(exact)){const p=byContent.get(exact);p.sources=[...new Set([...p.sources,c.source])];if((c.classification_origin==='remnote_hierarchy'&&p.classification_origin!=='remnote_hierarchy')||((c.classification_origin===p.classification_origin)&&(c.context?.length||0)>(p.context?.length||0))){p.context=c.context;p.source=c.source;applyClassification(p)}}else byContent.set(exact,c)}const unique=[...byContent.values()],byUid=new Map();for(const c of unique){if(byUid.has(c.uid)&&byUid.get(c.uid).content_hash!==c.content_hash){collisions.push({a:byUid.get(c.uid),b:c});c.uid=c.uid+'_'+hash((c.context||[]).slice(-2).join('§'))}byUid.set(c.uid,c)}return{unique,collisions}}
async function readFiles(files){const md=[];let totalUnits=Math.max(1,files.length),doneUnits=0;setImportProgress(2,'Preparando archivos…');for(const file of files){const low=file.name.toLowerCase();if(low.endsWith('.rar'))throw new Error('Los archivos RAR todavía no son compatibles con el importador RemNote. Descomprímelo o usa ZIP.');if(low.endsWith('.zip')){const zip=await JSZip.loadAsync(file),entries=Object.values(zip.files).filter(x=>!x.dir&&/\.md$|\.markdown$/i.test(x.name));totalUnits+=entries.length;for(const e of entries){const txt=await e.async('string');md.push({name:e.name,text:txt});doneUnits++;setImportProgress(5+45*(doneUnits/totalUnits),`Cargando ${e.name}`)}}else if(/\.md$|\.markdown$/i.test(file.name)){md.push({name:file.name,text:await file.text()});doneUnits++;setImportProgress(5+45*(doneUnits/totalUnits),`Cargando ${file.name}`)}doneUnits++;setImportProgress(5+45*(doneUnits/totalUnits),`Leyendo ${file.name}`)}return md}
function classificationSignature(v){return [v?.specialty||'',v?.topic||'',v?.subtopic||'',v?.section||''].map(normalize).join('§')}
function reconcileImport(items,bucket){
  const incomingIds=new Set(items.map(x=>x.uid)),used=new Set();
  for(const item of items){
    if(item.text!=null){
      const sameSource=Object.entries(bucket).filter(([uid,r])=>!used.has(uid)&&r.current?.source===item.source&&r.current?.content_hash===item.content_hash&&normalize(r.current.text||'')===normalize(item.text));
      if(sameSource.length===1){item.uid=sameSource[0][0];used.add(item.uid)}
    }
    if(!bucket[item.uid]){
      const matches=Object.entries(bucket).filter(([uid,r])=>!incomingIds.has(uid)&&!used.has(uid)&&r.current?.content_hash===item.content_hash&&
        (item.front!=null?normalize(r.current.front||'')===normalize(item.front)&&r.current.type===item.type:normalize(r.current.text||'')===normalize(item.text||'')));
      if(matches.length===1){item.uid=matches[0][0];used.add(item.uid)}
    }
    const old=bucket[item.uid]?.current;
    // A partial export without ancestors must not erase a saved classification.
    if(old&&!isUnclassifiedValue(old.specialty)&&item.classification_origin!=='remnote_hierarchy'){
      for(const k of ['specialty','topic','subtopic','section','path','classification_origin'])if(old[k]!==undefined)item[k]=structuredClone(old[k]);
    }
  }
}
function compareImport(cards,theory,meta){
  reconcileImport(cards,state.db.cards);reconcileImport(theory,state.db.theory);
  theory=[...new Map(theory.map(x=>[x.uid,x])).values()];
  meta.unclassified=[...cards,...theory].filter(x=>isUnclassifiedValue(x.specialty)).length;
  meta.existing_duplicates=0;const diffs=[];
  // Incremental import: ONLY items present in the current file are considered.
  for(const [kind,items,bucket] of [['card',cards,state.db.cards],['theory',theory,state.db.theory]])for(const item of items){
    const old=bucket[item.uid];
    const status=!old?'new':old.status==='archived'||old.current.content_hash!==item.content_hash||classificationSignature(old.current)!==classificationSignature(item)?'modified':'unchanged';
    if(status==='unchanged'){meta.existing_duplicates++;continue}
    diffs.push({kind,status,uid:item.uid,newValue:item,oldValue:old?.current||null,selected:true});
  }
  state.import={id:'imp_'+Date.now(),created_at:new Date().toISOString(),meta,diffs};
  state.statusFilter='all';state.selected=new Set(diffs.map(diffKey));
  if(typeof document!=='undefined'){$$('#statusTabs .tab').forEach(x=>x.classList.toggle('active',x.dataset.status==='all'));if($('#compareSearch'))$('#compareSearch').value=''}
  renderCompare();
}
async function processFiles(files){$('#loadingView').classList.remove('hidden');$('#compareView').classList.add('hidden');setImportProgress(0,'Iniciando carga…');try{const mds=await readFiles(files);if(!mds.length)throw new Error('No encontré archivos Markdown.');let all=[],theory=[],issues=[];for(let i=0;i<mds.length;i++){setImportProgress(50+45*((i+1)/mds.length),`Analizando ${i+1} de ${mds.length}: ${mds[i].name}`);const r=parseMarkdown(mds[i].text,mds[i].name);all.push(...r.cards);theory.push(...r.theory);issues.push(...r.issues);await new Promise(r=>setTimeout(r,0))}const d=dedupe(all);const allItems=[...d.unique,...theory],tableCount=theory.reduce((n,t)=>n+(t.tables?.length||0),0),unclassified=allItems.filter(x=>x.specialty==='Sin clasificar').length;setImportProgress(98,'Comparando con la base publicada…');compareImport(d.unique,theory,{files:mds.length,raw_cards:all.length,unique_cards:d.unique.length,duplicate_cards:all.length-d.unique.length,uid_collisions:d.collisions.length,issues:issues.length,tables:tableCount,unclassified,file_names:mds.map(x=>x.name)});setImportProgress(100,'Carga completa');await new Promise(r=>setTimeout(r,180));$('#loadingView').classList.add('hidden');$('#compareView').classList.remove('hidden')}catch(e){$('#loadingView').classList.add('hidden');alert(e.message||'No se pudo analizar la exportación.')}}
function stat(label,n){return`<div class="stat"><div class="num">${n}</div><div class="label">${label}</div></div>`}
function counts(diffs){const c={new:0,modified:0,unchanged:0,missing:0};diffs.forEach(d=>c[d.status]++);return c}
function renderCompare(){if(!state.import)return;const c=counts(state.import.diffs),m=state.import.meta;
  $('#compareMeta').textContent=m.repair?'Revisión de la clasificación guardada. Solo se muestran las correcciones propuestas.':`${m.files} archivos del ZIP actual · ${m.raw_cards} tarjetas detectadas · ${m.duplicate_cards} repeticiones dentro del ZIP unificadas. No se comparan ausencias de cargas anteriores.`;
  $('#compareStats').innerHTML=stat('Nuevos',c.new)+stat('Con cambios',c.modified)+stat('Ya existentes · omitidos',m.existing_duplicates||0)+stat('Tablas',m.tables||0)+stat('Sin clasificar',m.unclassified||0)+stat('Problemas',m.issues+m.uid_collisions);renderDiffList();
}
function badge(status){return`<span class="badge ${status}">${{new:'Nuevo',modified:'Modificado',unchanged:'Sin cambios',missing:'Ausente'}[status]}</span>`}
function diffKey(d){return d.uid+'§'+d.kind}
function renderDiffList(){const q=normalize($('#compareSearch').value),filter=state.statusFilter;const rows=state.import.diffs.filter(d=>(filter==='all'||d.status===filter)&&(!q||normalize((d.newValue||d.oldValue)?.front||(d.newValue||d.oldValue)?.text||'').includes(q)));$('#selectedCount').textContent=`${state.selected.size} seleccionados`;$('#selectVisible').checked=rows.length>0&&rows.every(d=>state.selected.has(diffKey(d)));$('#diffList').innerHTML=rows.length?rows.map(d=>{const v=d.newValue||d.oldValue,front=d.kind==='card'?stripMd(v.front):stripMd(v.text).slice(0,220),path=(v.path||v.context||[]).join(' › ');const selectable=d.status!=='unchanged';return`<div class="diffRow" data-key="${esc(diffKey(d))}"><input class="rowSelect" type="checkbox" ${state.selected.has(diffKey(d))?'checked':''} ${selectable?'':'disabled'}>${badge(d.status)}<div><div class="question">${esc(front).slice(0,300)}</div><div class="meta">${d.kind==='card'?(typeNames[v.type]||v.type):'Teoría'} · ${esc(v.source||'')}</div></div><div class="path">${esc(path||'—')}</div><div class="chev">›</div></div>`}).join(''):'<div class="empty">No hay elementos con este filtro.</div>';$$('.diffRow').forEach(r=>{const key=r.dataset.key,d=state.import.diffs.find(x=>diffKey(x)===key);r.querySelector('.rowSelect').addEventListener('click',e=>{e.stopPropagation();e.target.checked?state.selected.add(key):state.selected.delete(key);renderDiffList()});r.addEventListener('click',()=>showDiff(d))})}
function publishSelected(){if(!state.import)return;const now=new Date().toISOString(),changes=[];for(const d of state.import.diffs){const key=diffKey(d);if(!state.selected.has(key))continue;if(d.status==='unchanged')continue;const bucket=d.kind==='card'?state.db.cards:state.db.theory;if(d.status==='missing'){const rec=bucket[d.uid];if(rec){rec.status='archived';rec.archived_at=now;rec.versions.push({version:rec.versions.length+1,action:'archived',published_at:now,value:rec.current});changes.push({uid:d.uid,kind:d.kind,action:'archived',summary:titleOf(rec.current)})}continue}const incoming=structuredClone(d.newValue),existing=bucket[d.uid];if(!existing){bucket[d.uid]={uid:d.uid,status:'published',current:incoming,version:1,created_at:now,updated_at:now,last_reviewed_at:now,versions:[{version:1,action:'created',published_at:now,value:incoming}]};changes.push({uid:d.uid,kind:d.kind,action:'created',summary:titleOf(incoming)})}else{const ver=existing.version+1;existing.current=incoming;existing.version=ver;existing.status='published';existing.updated_at=now;existing.last_reviewed_at=now;existing.versions.push({version:ver,action:'updated',published_at:now,value:incoming});changes.push({uid:d.uid,kind:d.kind,action:'updated',summary:titleOf(incoming)})}}
state.db.history.unshift({id:'pub_'+Date.now(),published_at:now,import_id:state.import.id,changes});state.db.imports.unshift({id:state.import.id,created_at:state.import.created_at,published_at:now,meta:state.import.meta,change_count:changes.length});state.db.imports=state.db.imports.slice(0,50);state.db.history=state.db.history.slice(0,200);saveDb();alert(`Publicados ${changes.length} cambios.`);state.import=null;state.selected.clear();$('#compareView').classList.add('hidden');$('#fileInput').value='';go('dashboard')}
function titleOf(v){return stripMd(v?.front||v?.text||'').slice(0,180)}
function renderDashboard(){
  const cards=Object.values(state.db.cards),theory=Object.values(state.db.theory),activeCards=cards.filter(x=>x.status==='published').length,activeTheory=theory.filter(x=>x.status==='published').length,archived=cards.filter(x=>x.status==='archived').length;
  const m=state.db.meta?.live_metrics;
  const delta=(n,label='última importación')=>Number.isFinite(+n)?`<div class="statDelta">+${(+n).toLocaleString('es-ES')} ${label}</div>`:`<div class="statDelta mutedDelta">Sin dato de importación</div>`;
  if(cloudMode&&m){
    $('#dashboardStats').innerHTML=
      `<div class="stat"><div class="num">${(+m.flashcards||0).toLocaleString('es-ES')}</div><div class="label">Flashcards</div>${delta(m.last_flashcards_new)}</div>`+
      `<div class="stat"><div class="num">${(+m.theory||0).toLocaleString('es-ES')}</div><div class="label">Teoría</div>${delta(m.last_theory_new)}</div>`+
      `<div class="stat"><div class="num">${(+m.bank||0).toLocaleString('es-ES')}</div><div class="label">Banco</div>${delta(m.last_bank_new)}</div>`+
      `<div class="stat"><div class="num">${(+m.simulations||0).toLocaleString('es-ES')}</div><div class="label">Simulacros</div></div>`+
      `<div class="stat"><div class="num">${(+m.sim_questions||0).toLocaleString('es-ES')}</div><div class="label">Preguntas simulacro</div></div>`+
      `<div class="stat"><div class="num">${(+m.unclassified||0).toLocaleString('es-ES')}</div><div class="label">Sin clasificar</div></div>`;
  }else{
    $('#dashboardStats').innerHTML=stat('Flashcards vigentes',activeCards)+stat('Bloques de teoría',activeTheory)+stat('Archivados',archived)+stat('Publicaciones',state.db.history.length)+stat('Importaciones',state.db.imports.length);
  }
  const stale=cloudMode&&m?m.editorial_stale:cards.filter(x=>x.status==='published'&&Date.now()-new Date(x.last_reviewed_at||x.updated_at).getTime()>365*864e5).length;
  const editorialActive=cloudMode&&m?m.editorial_active:activeCards, editorialArchived=cloudMode&&m?m.editorial_archived:archived;
  $('#editorialState').innerHTML=`<div class="minirow"><span class="statusLine"><i class="dot"></i> Flashcards vigentes</span><strong>${(+editorialActive||0).toLocaleString('es-ES')}</strong></div><div class="minirow"><span class="statusLine"><i class="dot warn"></i> >12 meses sin revisión</span><strong>${(+stale||0).toLocaleString('es-ES')}</strong></div><div class="minirow"><span class="statusLine"><i class="dot bad"></i> Archivadas</span><strong>${(+editorialArchived||0).toLocaleString('es-ES')}</strong></div>`;
  if(cloudMode&&m?.recent_imports?.length){$('#recentImports').innerHTML=m.recent_imports.map(i=>`<div class="minirow importSummary"><span><strong>${esc(i.kind)}</strong> · ${new Date(i.date).toLocaleString()}<small>${esc(i.name||'')}</small></span><strong>${(+i.new||0).toLocaleString('es-ES')} nuevas${i.modified?` · ${(+i.modified).toLocaleString('es-ES')} mod.`:''}${i.archived?` · ${(+i.archived).toLocaleString('es-ES')} arch.`:''}</strong></div>`).join('')}else $('#recentImports').innerHTML=state.db.imports.length?state.db.imports.slice(0,5).map(i=>`<div class="minirow"><span>${new Date(i.published_at||i.created_at).toLocaleString()}</span><strong>${i.change_count||0} cambios</strong></div>`).join(''):'<div class="empty">Aún no hay importaciones publicadas.</div>'
}
function renderContent(){const q=normalize($('#contentSearch').value),type=$('#contentType').value;if(state.contentKind==='cards'){const rows=Object.values(state.db.cards).filter(r=>r.status==='published').filter(r=>(type==='all'||r.current.type===type)&&(!q||normalize(r.current.front+' '+(r.current.back||'')+' '+(r.current.context||[]).join(' ')).includes(q)));$('#contentList').innerHTML=rows.length?rows.map(r=>`<div class="contentRow" data-uid="${r.uid}" data-kind="card"><span class="badge ${r.current.type==='multiple_choice'?'mcq':''}">${typeNames[r.current.type]||r.current.type}</span><div><div class="question">${esc(stripMd(r.current.front)).slice(0,300)}</div><div class="meta">v${r.version} · revisado ${new Date(r.last_reviewed_at).toLocaleDateString()}</div></div><div class="path">${esc((r.current.path||r.current.context||[]).join(' › ')||r.current.source)}</div><div class="chev">›</div></div>`).join(''):'<div class="empty">No hay flashcards publicadas.</div>'}else{const rows=Object.values(state.db.theory).filter(r=>r.status==='published').filter(r=>!q||normalize(r.current.text+' '+(r.current.context||[]).join(' ')).includes(q));$('#contentList').innerHTML=rows.length?rows.map(r=>`<div class="contentRow" data-uid="${r.uid}" data-kind="theory"><span class="badge">Teoría</span><div><div class="question">${esc(stripMd(r.current.text)).slice(0,300)}</div><div class="meta">v${r.version} · revisado ${new Date(r.last_reviewed_at).toLocaleDateString()}</div></div><div class="path">${esc((r.current.path||r.current.context||[]).join(' › ')||r.current.source)}</div><div class="chev">›</div></div>`).join(''):'<div class="empty">No hay teoría publicada.</div>'}$$('.contentRow').forEach(r=>r.addEventListener('click',()=>showRecord(r.dataset.kind,r.dataset.uid)))}
function renderHistory(){const h=state.db.history;$('#historyList').innerHTML=h.length?h.map(x=>`<div class="historyRow"><div><strong>${new Date(x.published_at).toLocaleString()}</strong><div class="meta">${x.import_id}</div></div><div><div class="question">${x.changes.length} cambios publicados</div><div class="meta">${x.changes.slice(0,4).map(c=>`${c.action}: ${c.summary}`).join(' · ')}${x.changes.length>4?' …':''}</div></div><div class="path">${x.changes.filter(c=>c.action==='created').length} nuevos · ${x.changes.filter(c=>c.action==='updated').length} actualizados · ${x.changes.filter(c=>c.action==='archived').length} archivados</div></div>`).join(''):'<div class="empty">El historial aparecerá después de la primera publicación.</div>'}
function showDiff(d){const old=d.oldValue,newV=d.newValue;$('#dialogBody').innerHTML=`<div class="detail">${badge(d.status)}<h2>${esc(titleOf(newV||old))}</h2>${d.status==='modified'?`<div class="diffCols"><div class="diffPane"><h4>Versión publicada</h4>${renderValue(old)}</div><div class="diffPane"><h4>Nueva importación</h4>${renderValue(newV)}</div></div>`:renderValue(newV||old)}<hr><p class="tiny"><strong>UID estable:</strong> <code>${esc(d.uid)}</code><br><strong>Acción:</strong> ${d.status==='missing'?'si la seleccionas, se archivará; no se borra':'solo cambia al publicar'}</p></div>`;$('#detailDialog').showModal()}
function clsText(v){return [v.specialty,v.topic,v.subtopic,v.section].filter(Boolean).map(esc).join(' › ')}
function inlineMd(x){let y=esc(x||'');y=y.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,'<img class="theoryImg" alt="$1" src="$2" loading="lazy">');y=y.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');y=y.replace(/`([^`]+)`/g,'<code>$1</code>');return y}
function renderTheory(v){const blocks=v.blocks?.length?v.blocks:theoryBlocks(v.text||'');return `<div class="taxonomy">${clsText(v)}</div><div class="theoryRender">${blocks.map(b=>{if(b.type==='table')return `<div class="tableWrap"><table><thead><tr>${b.headers.map(h=>`<th>${inlineMd(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r=>`<tr>${b.headers.map((_,i)=>`<td>${inlineMd(r[i]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;return b.text.split('\n').map(line=>{if(/^#{1,6}\s+/.test(line)){const level=Math.min(6,(line.match(/^#+/)||['#'])[0].length);return `<h${level}>${inlineMd(line.replace(/^#+\s*/,''))}</h${level}>`}if(!line.trim())return '<br>';return `<p>${inlineMd(line.replace(/^\s*-\s*/,''))}</p>`}).join('')}).join('')}</div>`}
function renderValue(v){if(!v)return'<p>—</p>';if(v.type==='multiple_choice')return`<div class="taxonomy">${clsText(v)}</div><div class="answer">${inlineMd(v.front)}</div><ul>${(v.options||[]).map(o=>`<li class="${o.correct?'correct':''}">${o.correct?'✓ ':''}${inlineMd(o.text)}</li>`).join('')}</ul>`;if(v.type)return`<div class="taxonomy">${clsText(v)}</div><div class="answer"><strong>Pregunta:</strong> ${inlineMd(v.front)}<br><br><strong>Respuesta:</strong> ${inlineMd(v.back||'')}</div>`;return renderTheory(v)}
function showRecord(kind,uid){const rec=(kind==='card'?state.db.cards:state.db.theory)[uid];$('#dialogBody').innerHTML=`<div class="detail"><span class="badge">Publicado · v${rec.version}</span><h2>${esc(titleOf(rec.current))}</h2>${renderValue(rec.current)}<hr><h3>Historial de versiones</h3>${[...rec.versions].reverse().map(v=>`<div class="versionBox"><strong>v${v.version} · ${v.action}</strong><div class="meta">${new Date(v.published_at).toLocaleString()}</div><div class="tiny">${esc(titleOf(v.value))}</div></div>`).join('')}</div>`;$('#detailDialog').showModal()}
function exportDb(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state.db,null,2)],{type:'application/json'}));a.download='mir_admin_backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function go(view){$$('.view').forEach(v=>v.classList.add('hidden'));$('#'+view+'View').classList.remove('hidden');$$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===view));if(view==='dashboard')renderDashboard();if(view==='content')renderContent();if(view==='history')renderHistory()}
$$('.nav').forEach(n=>n.onclick=()=>go(n.dataset.view));
$('#fileInput').addEventListener('change',e=>e.target.files.length&&processFiles([...e.target.files]));['dragenter','dragover'].forEach(ev=>$('#dropzone').addEventListener(ev,e=>{e.preventDefault();$('#dropzone').classList.add('drag')}));['dragleave','drop'].forEach(ev=>$('#dropzone').addEventListener(ev,e=>{e.preventDefault();$('#dropzone').classList.remove('drag')}));$('#dropzone').addEventListener('drop',e=>e.dataTransfer.files.length&&processFiles([...e.dataTransfer.files]));
$('#statusTabs').onclick=e=>{if(!e.target.matches('.tab'))return;$$('#statusTabs .tab').forEach(x=>x.classList.remove('active'));e.target.classList.add('active');state.statusFilter=e.target.dataset.status;renderDiffList()};$('#compareSearch').oninput=renderDiffList;$('#selectVisible').onchange=e=>{const q=normalize($('#compareSearch').value),f=state.statusFilter;state.import.diffs.filter(d=>(f==='all'||d.status===f)&&d.status!=='unchanged'&&(d.status!=='missing'||f==='missing')&&(!q||normalize((d.newValue||d.oldValue)?.front||(d.newValue||d.oldValue)?.text||'').includes(q))).forEach(d=>e.target.checked?state.selected.add(diffKey(d)):state.selected.delete(diffKey(d)));renderDiffList()};$('#publishBtn').onclick=publishSelected;$('#discardImportBtn').onclick=()=>{state.import=null;state.selected.clear();$('#compareView').classList.add('hidden');$('#fileInput').value=''};
$('#contentTabs').onclick=e=>{if(!e.target.matches('.tab'))return;$$('#contentTabs .tab').forEach(x=>x.classList.remove('active'));e.target.classList.add('active');state.contentKind=e.target.dataset.kind;$('#contentType').style.display=state.contentKind==='cards'?'':'none';renderContent()};$('#contentSearch').oninput=renderContent;$('#contentType').onchange=renderContent;$('#exportDbBtn').onclick=exportDb;$('#dialogClose').onclick=()=>$('#detailDialog').close();$('#resetAllBtn').onclick=()=>{if(confirm('¿Borrar la base local de esta demo y todo su historial?')){localStorage.removeItem(DB_KEY);state.db=emptyDb();state.import=null;state.selected.clear();renderDashboard();renderContent();renderHistory()}};
renderDashboard();

// ===== V3: SUPABASE CLOUD LAYER =====
function cloudMsg(t,bad=false){const el=$('#cloudMessage');if(el){el.textContent=t||'';el.style.color=bad?'#ff8e8e':''}}
function getSbCfg(){try{return JSON.parse(localStorage.getItem(SB_CFG_KEY))||{}}catch{return{}}}
function setSbCfg(url,key){localStorage.setItem(SB_CFG_KEY,JSON.stringify({url,key}))}
function initSb(){const c=getSbCfg();if(!c.url||!c.key||!window.supabase?.createClient)return false;try{sb=window.supabase.createClient(c.url,c.key);$('#sbUrl').value=c.url;$('#sbKey').value=c.key;return true}catch{return false}}
async function refreshCloudAuth(){if(!sb){cloudMode=false;paintCloudState();return}const {data:{session},error}=await sb.auth.getSession();if(error||!session){cloudUser=null;cloudRole=null;cloudMode=false;paintCloudState();return}cloudUser=session.user;const {data,error:pe}=await sb.from('profiles').select('role').eq('id',cloudUser.id).single();if(pe){cloudRole=null;cloudMode=false;paintCloudState();cloudMsg('Conectado, pero no pude leer tu rol. ¿Ejecutaste el SQL y convertiste tu usuario en admin?',true);return}cloudRole=data.role;if(!['admin','moderator'].includes(cloudRole)){cloudMode=false;paintCloudState();cloudMsg(`Tu cuenta tiene rol “${cloudRole}”. El Panel Admin requiere admin o moderator.`,true);return}cloudMode=true;paintCloudState();await loadCloudDb();cloudMsg(`Conectado como ${cloudRole}.`)}
function paintCloudState(){if(cloudMode){$('#dbState').textContent='Supabase';$('#userState').classList.remove('hidden');$('#userState').textContent=`${cloudRole}: ${cloudUser?.email||''}`;$('#logoutBtn').classList.remove('hidden')}else{$('#dbState').textContent='Base local';$('#userState').classList.add('hidden');$('#logoutBtn').classList.add('hidden')} }
async function fetchAllPages(makeQuery,pageSize=1000){const out=[];for(let from=0;;from+=pageSize){const {data,error}=await makeQuery().range(from,from+pageSize-1);if(error)throw error;const rows=data||[];out.push(...rows);if(rows.length<pageSize)break}return out}
async function exactCount(makeQuery){const {count,error}=await makeQuery();if(error)throw error;return count||0}
async function loadCloudDb(){
  if(!cloudMode)return;
  cloudMsg('Cargando contenido completo desde Supabase…');
  const cutoff=new Date(Date.now()-365*864e5).toISOString();
  try{
    const [items,versions,importsR,qImportsR,flashCount,theoryCount,archivedCards,staleCards,bankCount,simQuestionCount,simRows,contentUnNull,contentUnNamed,contentUnEmpty,qUnNull,qUnNamed,qUnEmpty]=await Promise.all([
      fetchAllPages(()=>sb.from('content_items').select('*').order('updated_at',{ascending:false})),
      fetchAllPages(()=>sb.from('content_versions').select('*').order('published_at',{ascending:true})),
      sb.from('remnote_imports').select('*').eq('status','published').order('published_at',{ascending:false}).limit(20),
      sb.from('question_imports').select('id,name,source_kind,status,counts,published_at,created_at').eq('status','published').order('published_at',{ascending:false}).limit(20),
      exactCount(()=>sb.from('content_items').select('id',{count:'exact',head:true}).eq('kind','card').eq('status','published')),
      exactCount(()=>sb.from('content_items').select('id',{count:'exact',head:true}).eq('kind','theory').eq('status','published')),
      exactCount(()=>sb.from('content_items').select('id',{count:'exact',head:true}).eq('kind','card').eq('status','archived')),
      exactCount(()=>sb.from('content_items').select('id',{count:'exact',head:true}).eq('kind','card').eq('status','published').lt('last_reviewed_at',cutoff)),
      exactCount(()=>sb.from('questions').select('id',{count:'exact',head:true}).eq('status','published').is('source_exam',null)),
      exactCount(()=>sb.from('questions').select('id',{count:'exact',head:true}).eq('status','published').not('source_exam','is',null)),
      fetchAllPages(()=>sb.from('questions').select('source_exam').eq('status','published').not('source_exam','is',null)),
      exactCount(()=>sb.from('content_items').select('id',{count:'exact',head:true}).eq('status','published').is('specialty',null)),
      exactCount(()=>sb.from('content_items').select('id',{count:'exact',head:true}).eq('status','published').eq('specialty','Sin clasificar')),
      exactCount(()=>sb.from('content_items').select('id',{count:'exact',head:true}).eq('status','published').eq('specialty','')),
      exactCount(()=>sb.from('questions').select('id',{count:'exact',head:true}).eq('status','published').is('specialty',null)),
      exactCount(()=>sb.from('questions').select('id',{count:'exact',head:true}).eq('status','published').eq('specialty','Sin clasificar')),
      exactCount(()=>sb.from('questions').select('id',{count:'exact',head:true}).eq('status','published').eq('specialty',''))
    ]);
    if(importsR.error)throw importsR.error;if(qImportsR.error)throw qImportsR.error;
    const imports=importsR.data||[],qImports=qImportsR.data||[];
    const db=emptyDb(),vmap={};
    versions.forEach(v=>{(vmap[v.content_id]??=[]).push({version:v.version,action:v.action,published_at:v.published_at,value:v.payload})});
    items.forEach(r=>{const rec={id:r.id,uid:r.source_uid,status:r.status,current:{...r.payload,specialty:r.specialty??r.payload?.specialty,topic:r.topic??r.payload?.topic,subtopic:r.subtopic??r.payload?.subtopic,section:r.section??r.payload?.section},version:r.current_version,created_at:r.created_at,updated_at:r.updated_at,last_reviewed_at:r.last_reviewed_at,archived_at:r.archived_at,versions:vmap[r.id]||[]};(r.kind==='card'?db.cards:db.theory)[r.source_uid]=rec});

    // Última importación RemNote: contamos cambios reales seleccionados, no filas detectadas.
    let lastFlashcardsNew=null,lastTheoryNew=null;
    const lastRemnote=imports[0]||null;
    if(lastRemnote){
      const changes=await fetchAllPages(()=>sb.from('remnote_import_changes').select('kind,change_type,selected').eq('import_id',lastRemnote.id).eq('selected',true));
      lastFlashcardsNew=changes.filter(x=>x.kind==='card'&&x.change_type==='new').length;
      lastTheoryNew=changes.filter(x=>x.kind==='theory'&&x.change_type==='new').length;
    }
    const lastBank=qImports.find(i=>String(i.name||'').toLowerCase().startsWith('banco:'))||null;
    let lastBankNew=null;
    if(lastBank){if(Number.isFinite(+lastBank.counts?.new))lastBankNew=+lastBank.counts.new;else if(Number.isFinite(+lastBank.counts?.published))lastBankNew=+lastBank.counts.published}

    // Resumen limpio de las últimas importaciones RemNote + bancos/simulacros.
    const remRecent=await Promise.all(imports.slice(0,5).map(async i=>{
      const [n,m,a]=await Promise.all([
        exactCount(()=>sb.from('remnote_import_changes').select('id',{count:'exact',head:true}).eq('import_id',i.id).eq('selected',true).eq('change_type','new')),
        exactCount(()=>sb.from('remnote_import_changes').select('id',{count:'exact',head:true}).eq('import_id',i.id).eq('selected',true).eq('change_type','modified')),
        exactCount(()=>sb.from('remnote_import_changes').select('id',{count:'exact',head:true}).eq('import_id',i.id).eq('selected',true).eq('change_type','missing'))
      ]);
      return {kind:'RemNote',name:i.filename||'RemNote',date:i.published_at||i.created_at,new:n,modified:m,archived:a};
    }));
    const qRecent=qImports.slice(0,8).map(i=>({kind:String(i.name||'').toLowerCase().startsWith('banco:')?'Banco':'Simulacro',name:i.name||i.source_kind||'Importación',date:i.published_at||i.created_at,new:Number(i.counts?.new??i.counts?.published??0)||0,modified:Number(i.counts?.modified??i.counts?.updated??0)||0,archived:0}));
    const recent=[...remRecent,...qRecent].filter(x=>x.date).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);

    const uniqueSims=new Set(simRows.map(r=>String(r.source_exam||'').trim()).filter(Boolean)).size;
    const unclassified=contentUnNull+contentUnNamed+contentUnEmpty+qUnNull+qUnNamed+qUnEmpty;
    db.imports=imports.map(i=>({id:i.id,created_at:i.created_at,published_at:i.published_at,meta:i.stats||{},change_count:i.stats?.published_changes||0}));db.history=[];
    db.meta.live_metrics={flashcards:flashCount,theory:theoryCount,bank:bankCount,simulations:uniqueSims,sim_questions:simQuestionCount,unclassified,last_flashcards_new:lastFlashcardsNew,last_theory_new:lastTheoryNew,last_bank_new:lastBankNew,editorial_active:flashCount,editorial_stale:staleCards,editorial_archived:archivedCards,recent_imports:recent};
    state.db=db;renderDashboard();renderContent();renderHistory();
    cloudMsg(`Base completa: ${flashCount.toLocaleString('es-ES')} flashcards, ${theoryCount.toLocaleString('es-ES')} bloques de teoría y ${bankCount.toLocaleString('es-ES')} preguntas de banco.`)
    const normKey='nexmir_marks_normalized_v506';if(!localStorage.getItem(normKey)){normalizeLegacyMarksInCloud().then(n=>{localStorage.setItem(normKey,'1');if(n){cloudMsg(`Normalización completada: ${n} contenidos antiguos limpiados de ^^.`);loadCloudDb().catch(()=>{})}})}
    // IA disponible a petición, después de revisar la jerarquía RemNote.
  }catch(e){cloudMsg(e.message||'No se pudo cargar Supabase.',true);throw e}
}
async function loginCloud(){if(!sb){cloudMsg('Primero guarda Project URL y Publishable key.',true);return}const email=$('#loginEmail').value.trim(),password=$('#loginPassword').value;const {error}=await sb.auth.signInWithPassword({email,password});if(error){cloudMsg(error.message,true);return}await refreshCloudAuth();if(cloudMode)$('#cloudDialog').close()}
async function logoutCloud(){if(sb)await sb.auth.signOut();cloudUser=null;cloudRole=null;cloudMode=false;state.db=loadDb();paintCloudState();renderDashboard();renderContent();renderHistory()}
async function saveCloudConfig(){const url=$('#sbUrl').value.trim(),key=$('#sbKey').value.trim();if(!/^https:\/\/.+\.supabase\.co\/?$/.test(url)){cloudMsg('Project URL no parece válido.',true);return}if(!/^sb_publishable_/.test(key)&&!/^eyJ/.test(key)){cloudMsg('Usa la Publishable key (sb_publishable_...). También acepto anon legacy si tu proyecto aún la usa.',true);return}setSbCfg(url,key);initSb();cloudMsg('Conexión guardada. Ahora inicia sesión.');await refreshCloudAuth()}

const MIR_AI_SUBJECTS=['Cardiología','Gastroenterología','Enfermedades Infecciosas','Endocrinología y Nutrición','Nefrología','Neumología','Neurología','Ginecología y Obstetricia','Pediatría','Hematología','Reumatología','Psiquiatría','Epidemiología y Medicina Preventiva','Dermatología','Oncología Médica','Traumatología','Oftalmología','Otorrinolaringología','Urología','Geriatría y Cuidados Paliativos','Radiología y Urgencias','Cirugía General','Farmacología','Inmunología y Genética','Bioética y Medicina Legal'];
function isUnclassifiedValue(v=''){const n=normalize(v||'');return !n||n==='sin clasificar'||n==='desagrupadas'||n.startsWith('sin clasificar ')}
async function classifyUnclassifiedWithAI(opts={}){
  if(!cloudMode||!sb){if(!opts.silent)alert('Conecta Supabase como admin primero.');return null}
  const btn=$('#aiClassifyBtn'),status=$('#aiClassifyStatus');if(btn)btn.disabled=true;if(status)status.textContent='Clasificando pendientes con IA…';
  try{
    const {data,error}=await sb.functions.invoke('classify-content',{body:{scope:'all',limit:opts.limit||300,subjects:MIR_AI_SUBJECTS}});
    if(error)throw error;
    const changed=Number(data?.updated||0),remaining=Number(data?.remaining||0);
    if(status)status.textContent=`IA: ${changed} clasificados · ${remaining} pendientes`;
    await loadCloudDb();
    if(!opts.silent)alert(`Clasificación IA terminada: ${changed} registros clasificados. ${remaining} siguen en Desagrupadas para revisión manual.`);
    return data;
  }catch(e){console.warn('Clasificación IA no disponible',e);if(status)status.textContent='IA no configurada o función no desplegada';if(!opts.silent)alert('No pude ejecutar la clasificación IA. Revisa supabase/functions/classify-content/README.md. Detalle: '+(e.message||e));return null}
  finally{if(btn)btn.disabled=false}
}
async function previewHierarchyRepair(){
  const btn=$('#repairHierarchyBtn');if(btn)btn.disabled=true;
  try{
    if(state.import&&!confirm('Hay una comparación pendiente. ¿Sustituirla por la revisión de clasificación?'))return;
    if(cloudMode)await loadCloudDb();
    const cards=[],theory=[];let unresolved=0;
    for(const [kind,bucket] of [['card',state.db.cards],['theory',state.db.theory]])for(const [uid,rec] of Object.entries(bucket)){
      if(rec.status!=='published')continue;
      const current=rec.current||{},next=structuredClone(current),classification=classify(current.context||[],current.source||'');
      if(classification.classification_origin!=='remnote_hierarchy'){unresolved++;continue}
      Object.assign(next,classification,{uid});
      if(classificationSignature(next)!==classificationSignature(current))(kind==='card'?cards:theory).push(next);
    }
    go('import');compareImport(cards,theory,{repair:true,files:0,raw_cards:cards.length,unique_cards:cards.length,duplicate_cards:0,uid_collisions:0,issues:0,tables:0,file_names:['Reparación de jerarquía guardada']});
    $('#compareView').classList.remove('hidden');
    alert(`${cards.length+theory.length} correcciones listas para revisar. ${unresolved} registros no tienen una especialidad explícita recuperable en la ruta guardada: vuelve a importar su exportación completa. La base todavía no se ha modificado. Esta revisión cubre Contenido; para bancos usa Importar banco con el mismo nombre.`);
  }catch(e){alert('No se pudo preparar la reparación: '+(e.message||e))}finally{if(btn)btn.disabled=false}
}
async function normalizeLegacyMarksInCloud(){
  if(!cloudMode||!sb)return;try{
    const rows=await fetchAllPages(()=>sb.from('content_items').select('id,payload').eq('status','published'));
    let changed=0;
    const cleanDeep=v=>typeof v==='string'?cleanRemnoteMarks(v):Array.isArray(v)?v.map(cleanDeep):(v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,cleanDeep(x)])):v);
    for(const r of rows){const raw=JSON.stringify(r.payload||{});if(!raw.includes('^^'))continue;const payload=cleanDeep(r.payload||{});const {error}=await sb.from('content_items').update({payload,updated_at:new Date().toISOString()}).eq('id',r.id);if(!error)changed++}
    return changed;
  }catch(e){console.warn('No pude normalizar marcadores antiguos',e);return 0}
}

async function publishSelectedV3(){
  if(!cloudMode)return publishSelected();
  if(!state.import)return;
  const rawSelected=state.import.diffs.filter(d=>state.selected.has(diffKey(d))&&d.status!=='unchanged');
  const uniqueSelected=[];const seen=new Set();
  for(const d of rawSelected){const k=`${d.kind}:${d.uid}`;if(seen.has(k))continue;seen.add(k);uniqueSelected.push(d)}
  if(!uniqueSelected.length){alert('No hay cambios seleccionados.');return}
  $('#publishBtn').disabled=true;$('#publishBtn').textContent='Publicando…';setPublishProgress(1,'Preparando publicación');
  try{
    const now=new Date().toISOString();
    const {data:imp,error:ie}=await sb.from('remnote_imports').insert({filename:state.import.meta.file_names?.[0]||'RemNote export',status:'review',stats:{...state.import.meta,published_changes:uniqueSelected.length},created_by:cloudUser.id}).select().single();if(ie)throw ie;
    setPublishProgress(5,'Registrando cambios');
    const changeRows=state.import.diffs.map(d=>({import_id:imp.id,source_uid:d.uid,kind:d.kind,change_type:d.status,old_payload:d.oldValue||null,new_payload:d.newValue||null,selected:state.selected.has(diffKey(d)),reviewed:state.selected.has(diffKey(d))}));
    if(changeRows.length){const {error}=await sb.from('remnote_import_changes').insert(changeRows);if(error)throw error}
    let processed=0;
    for(const d of uniqueSelected){
      const bucket=d.kind==='card'?state.db.cards:state.db.theory;
      let existing=bucket[d.uid]||null;
      if(!existing){
        const {data:dbExisting,error:lookupErr}=await sb.from('content_items').select('*').eq('source_uid',d.uid).maybeSingle();
        if(lookupErr)throw lookupErr;
        if(dbExisting)existing={id:dbExisting.id,uid:dbExisting.source_uid,status:dbExisting.status,current:dbExisting.payload,version:dbExisting.current_version||1,created_at:dbExisting.created_at,updated_at:dbExisting.updated_at,last_reviewed_at:dbExisting.last_reviewed_at,archived_at:dbExisting.archived_at,versions:[]};
      }
      if(d.status==='missing'){
        if(existing?.id){const ver=(existing.version||1)+1;let {error}=await sb.from('content_items').update({status:'archived',current_version:ver,archived_at:now,updated_at:now}).eq('id',existing.id);if(error)throw error;({error}=await sb.from('content_versions').insert({content_id:existing.id,version:ver,action:'archived',payload:existing.current,source_hash:existing.current?.content_hash||null,published_by:cloudUser.id,published_at:now}));if(error)throw error}
      }else{
        const incoming=d.newValue;
        if(!existing){
          let conflictRecovered=false;
          let {data:item,error}=await sb.from('content_items').insert({source_uid:d.uid,kind:d.kind,card_type:d.kind==='card'?incoming.type:null,status:'published',current_version:1,payload:incoming,source_hash:incoming.content_hash,source_path:incoming.source||null,specialty:incoming.specialty||'Sin clasificar',topic:incoming.topic||'General',subtopic:incoming.subtopic||null,section:incoming.section||null,last_reviewed_at:now,created_by:cloudUser.id}).select().single();
          if(error&&error.code==='23505'){
            const {data:again,error:ae}=await sb.from('content_items').select('*').eq('source_uid',d.uid).single();if(ae)throw ae;item=again;error=null;conflictRecovered=true;
          }
          if(error)throw error;
          if(conflictRecovered){
            const ver=(item.current_version||1)+1;let {error:ue}=await sb.from('content_items').update({kind:d.kind,card_type:d.kind==='card'?incoming.type:null,status:'published',current_version:ver,payload:incoming,source_hash:incoming.content_hash,source_path:incoming.source||null,specialty:incoming.specialty||'Sin clasificar',topic:incoming.topic||'General',subtopic:incoming.subtopic||null,section:incoming.section||null,last_reviewed_at:now,updated_at:now,archived_at:null}).eq('id',item.id);if(ue)throw ue;({error:ue}=await sb.from('content_versions').insert({content_id:item.id,version:ver,action:'updated',payload:incoming,source_hash:incoming.content_hash,published_by:cloudUser.id,published_at:now}));if(ue)throw ue;
          }else{
            const {error:ve}=await sb.from('content_versions').insert({content_id:item.id,version:1,action:'created',payload:incoming,source_hash:incoming.content_hash,published_by:cloudUser.id,published_at:now});if(ve)throw ve;
          }
        }else{
          const ver=(existing.version||1)+1;let {error}=await sb.from('content_items').update({kind:d.kind,card_type:d.kind==='card'?incoming.type:null,status:'published',current_version:ver,payload:incoming,source_hash:incoming.content_hash,source_path:incoming.source||null,specialty:incoming.specialty||'Sin clasificar',topic:incoming.topic||'General',subtopic:incoming.subtopic||null,section:incoming.section||null,last_reviewed_at:now,updated_at:now,archived_at:null}).eq('id',existing.id);if(error)throw error;({error}=await sb.from('content_versions').insert({content_id:existing.id,version:ver,action:'updated',payload:incoming,source_hash:incoming.content_hash,published_by:cloudUser.id,published_at:now}));if(error)throw error;
        }
      }
      processed++;setPublishProgress(8+88*(processed/uniqueSelected.length),`Procesando ${processed} de ${uniqueSelected.length}`);
    }
    const {error:ue}=await sb.from('remnote_imports').update({status:'published',published_at:now}).eq('id',imp.id);if(ue)throw ue;
    setPublishProgress(98,'Actualizando panel');await loadCloudDb();setPublishProgress(100,'Completado');
    state.import=null;state.selected.clear();$('#compareView').classList.add('hidden');$('#fileInput').value='';alert(`Publicados ${uniqueSelected.length} cambios en Supabase.`);go('dashboard')
  }catch(e){console.error(e);alert('No se pudo publicar en Supabase: '+(e.message||e))}
  finally{$('#publishBtn').disabled=false;$('#publishBtn').textContent='Publicar seleccionados';setTimeout(hidePublishProgress,1800)}
}


// Reemplaza handlers V2 por handlers V3.
$('#publishBtn').onclick=publishSelectedV3;
// Las importaciones incrementales no generan ausentes ni archivan contenido.
$('#cloudBtn').onclick=()=>{$('#cloudDialog').showModal();const c=getSbCfg();$('#sbUrl').value=c.url||'';$('#sbKey').value=c.key||'';cloudMsg(cloudMode?`Conectado como ${cloudRole}.`:'')};
$('#cloudClose').onclick=()=>$('#cloudDialog').close();
$('#saveCloudBtn').onclick=saveCloudConfig;
$('#loginBtn').onclick=loginCloud;
$('#logoutBtn').onclick=logoutCloud;
$('#togglePasswordBtn').onclick=()=>{const inp=$('#loginPassword'),btn=$('#togglePasswordBtn');const show=inp.type==='password';inp.type=show?'text':'password';btn.textContent=show?'Ocultar':'Mostrar';btn.setAttribute('aria-label',show?'Ocultar contraseña':'Mostrar contraseña')};
$('#loginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')loginCloud()});
$('#loginEmail').addEventListener('keydown',e=>{if(e.key==='Enter')$('#loginPassword').focus()});

if(initSb())refreshCloudAuth();else paintCloudState();
