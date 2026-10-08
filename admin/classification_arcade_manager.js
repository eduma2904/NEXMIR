/* Importación editorial de tablas y casos para Clasificaciones MIR. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const builtin=new Set(['apgar','hinchey','asma','curb','forrest','glasgow','garden','nyha','child','ann','birads','breslow','killip']);
 const allowed=()=>cloudMode&&sb&&cloudUser&&cloudRole==='admin';
 const msg=value=>{$('classesMessage').textContent=value};
 const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 let rows=[],selected=null,generation=0,busy=false;
 const exampleChoice={
   id:'nueva-clasificacion',name:'Nombre de la clasificación',topic:'Especialidad',
   type:'choice',icon:'✦',note:'Indica qué debe decidir el alumno, sin revelar la respuesta.',
   source:'https://example.org/fuente-oficial',
   options:['I','II'],
   cases:[{text:'Describe aquí los hallazgos clínicos de un caso original.',answer:'I',why:'Explica por qué corresponde al grado I.'}],
   review:{headers:['Grado','Significado'],rows:[['I','Describe el grado I'],['II','Describe el grado II']]}
 };
 const exampleScore={
   id:'nueva-escala',name:'Nombre de la escala',topic:'Especialidad',
   type:'score',icon:'＋',note:'Puntúa cada componente; no muestres sus umbrales durante la pregunta.',
   source:'https://example.org/fuente-oficial',
   labels:['Criterio A','Criterio B'],values:[0,1],
   cases:[{text:'Presenta un caso original con los valores observados.',observations:['Valor observado A','Valor observado B'],answer:[1,0]}],
   review:{headers:['Criterio','0 puntos','1 punto'],rows:[['Criterio A','Umbral para 0','Umbral para 1'],['Criterio B','Umbral para 0','Umbral para 1']]}
 };
 const exampleExtra={
   id:'hinchey',cases:[{text:'Diverticulitis con pus libre difuso, sin heces libres en la cavidad.',answer:'III',why:'Peritonitis purulenta generalizada.'}]
 };
 const previous=go;
 go=function(view){previous(view);if(view==='arcadeclasses')load()};
 function reviewValid(r){
   return r&&Array.isArray(r.headers)&&r.headers.length>=2&&r.headers.length<=8&&r.headers.every(v=>text(v,120))
     &&Array.isArray(r.rows)&&r.rows.length>=1&&r.rows.length<=40
     &&r.rows.every(a=>Array.isArray(a)&&a.length===r.headers.length&&a.every(v=>text(v,400)))
     &&(!r.note||text(r.note,1000));
 }
 function validate(raw,published){
   if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('El archivo debe contener un objeto JSON.');
   if(!/^[a-z][a-z0-9_-]{2,39}$/.test(raw.id||''))throw Error('Usa un identificador de 3 a 40 caracteres: letras minúsculas, números, guion o guion bajo.');
   const base=builtin.has(raw.id),d={...raw};delete d.id;
   if(!Array.isArray(d.cases)||d.cases.length<1||d.cases.length>100)throw Error('Incluye entre 1 y 100 casos por carga.');
   if(base){
     if(d.review&&!reviewValid(d.review))throw Error('La tabla final debe tener encabezados y filas del mismo tamaño.');
     // Los componentes y opciones de una clasificación incluida no se alteran.
     const choices={
       hinchey:['I','II','III','IV'],asma:['Intermitente','Persistente leve','Persistente moderada','Persistente severa'],
       forrest:['Ia','Ib','IIa','IIb','IIc','III'],garden:['I','II','III','IV'],
       nyha:['I','II','III','IV'],ann:['I','II','III','IV'],birads:['0','1','2','3','4','5','6'],
       breslow:['T1a','T1b','T2a','T2b','T3a','T3b','T4a','T4b'],killip:['I','II','III','IV']
     };
     const scoreLength={apgar:5,curb:5,glasgow:3,child:5}[raw.id];
     const scoreValues={apgar:[[0,1,2]],curb:[[0,1]],glasgow:[[1,2,3,4],[1,2,3,4,5,'NT'],[1,2,3,4,5,6]],child:[[1,2,3]]}[raw.id];
     for(const c of d.cases){
       if(!text(c?.text,1200))throw Error('Cada caso necesita un enunciado de hasta 1200 caracteres.');
       if(scoreLength){
         if(!Array.isArray(c.observations)||c.observations.length!==scoreLength||!c.observations.every(v=>text(v,300))
            ||!Array.isArray(c.answer)||c.answer.length!==scoreLength
            ||!c.answer.every((v,i)=>(scoreValues.length===1?scoreValues[0]:scoreValues[i]).includes(v)))
           throw Error('El caso de puntuación necesita observaciones y respuestas válidas para cada criterio.');
       }else if(!choices[raw.id].includes(c.answer)||!text(c.why,1000))
         throw Error('Elige un grado permitido y explica el motivo en cada caso.');
     }
   }else{
     if(!text(d.name,120)||!text(d.topic,120)||!text(d.note,500)||!['choice','score'].includes(d.type)
       ||!text(d.source,500)||!/^https:\/\//.test(d.source)||!reviewValid(d.review))
       throw Error('La nueva clasificación necesita nombre, especialidad, tipo, indicación, fuente HTTPS y tabla completa de repaso.');
     if(published&&/example\.org|Nombre de |Describe aquí|Umbral para /i.test(JSON.stringify(d)))
       throw Error('Sustituye todos los textos de ejemplo y la fuente antes de publicar.');
     if(d.type==='choice'){
       if(!Array.isArray(d.options)||d.options.length<2||d.options.length>12||!d.options.every(v=>text(v,50)))
         throw Error('Incluye entre 2 y 12 opciones de grado.');
       if(!d.cases.every(c=>text(c?.text,1200)&&d.options.includes(c.answer)&&text(c.why,1000)))
         throw Error('Cada caso debe tener texto, un grado válido y una explicación.');
     }else{
       if(!Array.isArray(d.labels)||d.labels.length<2||d.labels.length>8||!d.labels.every(v=>text(v,120))
         ||!Array.isArray(d.values)||!d.values.length||d.values.length>8
         ||!d.values.every(v=>Array.isArray(v)?v.length>0&&v.every(n=>Number.isInteger(n)||n==='NT'):Number.isInteger(v)||v==='NT'))
         throw Error('Define entre 2 y 8 componentes y sus valores numéricos permitidos.');
       if(Array.isArray(d.values[0])&&(d.values.length!==d.labels.length||!d.values.every(Array.isArray)))
         throw Error('Si cada criterio tiene opciones distintas, define una lista por criterio.');
       if(!d.cases.every(c=>text(c?.text,1200)&&Array.isArray(c.observations)&&c.observations.length===d.labels.length
         &&c.observations.every(v=>text(v,300))&&Array.isArray(c.answer)&&c.answer.length===d.labels.length
         &&c.answer.every((v,i)=>(Array.isArray(d.values[0])?d.values[i]:d.values).includes(v))))
         throw Error('Cada caso necesita observaciones y puntuaciones válidas para todos los componentes.');
     }
   }
   return {id:raw.id,data:d,base};
 }
 function parse(){let raw;try{raw=JSON.parse($('classesJson').value)}catch{throw Error('El JSON no es válido. Revisa comillas, comas y corchetes.')}return validate(raw,$('classesPublished').checked)}
 function reset(){selected=null;$('classesTitle').textContent='Subir una clasificación';$('classesForm').reset();$('classesPreviewBox').hidden=true}
 function list(){
   $('classesCount').textContent=rows.length+' definiciones añadidas · '+rows.filter(x=>x.published).length+' publicadas';
   $('classesList').innerHTML=rows.map(r=>'<article class="cardBox arcadeAdminRow"><div><span class="badge">'+(r.published?'Publicada':'Borrador')+'</span> <strong>'+esc(r.data.name||r.id)+'</strong><p class="muted">'+esc(r.id)+' · '+r.data.cases.length+' casos '+(builtin.has(r.id)?'extra para una tabla incluida':'en una tabla nueva')+'</p></div><button type="button" class="secondary" data-id="'+esc(r.id)+'">Editar</button></article>').join('')||'<p class="muted">Todavía no hay cargas. Las 13 clasificaciones incluidas siguen disponibles para los alumnos.</p>';
   $('classesList').querySelectorAll('[data-id]').forEach(button=>button.onclick=()=>edit(button.dataset.id));
 }
 async function load(){
   const ticket=++generation;reset();rows=[];$('classesBody').hidden=true;
   if(!allowed()){msg('Inicia sesión como administrador para subir clasificaciones.');return}
   msg('Cargando definiciones…');
   try{
     const loaded=[];
     for(let offset=0;;offset+=500){
       const {data,error}=await sb.from('arcade_classifications').select('*').order('id').range(offset,offset+499);
       if(ticket!==generation||!allowed())return;if(error)throw error;loaded.push(...(data||[]));if(!data||data.length<500)break;
     }
     rows=loaded;$('classesBody').hidden=false;list();msg('Panel listo. Las escalas incluidas no requieren carga inicial.');
   }catch(error){msg('No se pudieron cargar las clasificaciones. Ejecuta supabase/ARCADE_CLASIFICACIONES_5_1_24.sql y pulsa Actualizar. '+String(error.message||''))}
 }
 function edit(id){
   const r=rows.find(x=>x.id===id);if(!r)return;
   selected=r;$('classesTitle').textContent='Editar · '+(r.data.name||r.id);
   $('classesJson').value=JSON.stringify({id:r.id,...r.data},null,2);
   $('classesPublished').checked=r.published;$('classesPreviewBox').hidden=true;
   $('classesForm').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function preview(){
   try{
     const v=parse(),box=$('classesPreviewBox');
     box.hidden=false;
     box.innerHTML='<h3>'+esc(v.data.name||v.id)+'</h3><p>'+esc(v.id)+' · '+v.data.cases.length+' casos '+(v.base?'extra, se añaden sin borrar los incluidos':'en una nueva clasificación')+'</p><p>Primer caso: '+esc(v.data.cases[0].text)+'</p><details><summary>Ver respuesta y tabla final</summary><p>'+esc(String(v.data.cases[0].answer))+'</p>'+(v.data.review?'<table class="arcadeClassReview"><thead><tr>'+v.data.review.headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+v.data.review.rows.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p>Se conservará la tabla de repaso incluida.</p>')+'</details>';
     msg('Validación correcta. Revisa contenido y fuente antes de publicar.');
   }catch(error){$('classesPreviewBox').hidden=true;msg(error.message)}
 }
 async function save(event){
   event.preventDefault();if(busy||!allowed())return;
   let v;try{v=parse()}catch(error){msg(error.message);return}
   if(!selected&&rows.some(r=>r.id===v.id)){msg('Ese identificador ya existe. Abre el registro para editarlo.');return}
   if(selected&&selected.id!==v.id){msg('No cambies el identificador al editar. Crea una definición nueva si necesitas otro nombre.');return}
   busy=true;$('classesSave').disabled=true;msg('Guardando…');
   try{
     const payload={id:v.id,data:v.data,published:$('classesPublished').checked,updated_at:new Date().toISOString()};
     const query=selected
       ?sb.from('arcade_classifications').update(payload).eq('id',selected.id).eq('updated_at',selected.updated_at)
       :sb.from('arcade_classifications').insert(payload);
     const {data,error}=await query.select().single();if(error)throw error;
     rows=selected?rows.map(r=>r.id===data.id?data:r):[...rows,data];
     reset();list();msg(data.published?'Publicada: aparecerá al volver a abrir Clasificaciones MIR.':'Borrador guardado: todavía no aparece para los alumnos.');
   }catch(error){msg(error.code==='PGRST116'?'El registro cambió desde que lo abriste. Actualiza y vuelve a editar.':'No se guardó: '+String(error.message||error))}
   finally{busy=false;$('classesSave').disabled=false}
 }
 $('classesRefresh').onclick=load;
 $('classesCancel').onclick=reset;
 $('classesPreview').onclick=preview;
 $('classesForm').onsubmit=save;
 $('classesFile').onchange=async event=>{
   const file=event.target.files?.[0];if(!file)return;
   if(file.size>500*1024){msg('El archivo supera 500 KB.');return}
   try{$('classesJson').value=await file.text();$('classesPreviewBox').hidden=true;preview()}catch{msg('No se pudo leer el archivo JSON.')}
 };
 for(const [id,sample] of [['classesChoiceExample',exampleChoice],['classesScoreExample',exampleScore],['classesExtraExample',exampleExtra]]){
   $(id).onclick=()=>{reset();$('classesJson').value=JSON.stringify(sample,null,2);msg('Plantilla cargada. Sustituye los textos de ejemplo y verifica la fuente antes de publicar.')};
 }
 const logout=logoutCloud;
 logoutCloud=async function(){generation++;rows=[];selected=null;$('classesBody').hidden=true;return logout()};
})();
