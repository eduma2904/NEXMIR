/* Arcade is separate from attempts, XP, streaks and Free/Pro quotas. */
(() => {
 'use strict';
 let frame=null, rows=[], definitions=[], activeGame=null, request=0;
 async function imageUrls(items){
   const paths=[...new Set(items.flatMap(x=>[x.answer_image_path,x.clue_image_path]).filter(Boolean))];
   if(!paths.length)return items;
   const signed=new Map();
   for(let offset=0;offset<paths.length;offset+=100){
     const {data,error}=await state.sb.storage.from('arcade-images').createSignedUrls(paths.slice(offset,offset+100),43200);
     if(error)throw error;
     for(const item of data||[])if(item.signedUrl)signed.set(item.path,item.signedUrl);
   }
   return items.map(x=>({...x,answer_image_url:signed.get(x.answer_image_path)||null,clue_image_url:signed.get(x.clue_image_path)||null}));
 }
 let expanded=false, fullscreenPanel=null, nativeFullscreen=false, inertElements=[];
 const root=()=>document.getElementById('view-arcade');
 const theme=()=>({palette:document.documentElement.dataset.palette||'blue',mode:document.documentElement.dataset.themeMode||'dark'});
 function send(type,extra={}){if(frame?.contentWindow)frame.contentWindow.postMessage({type,...extra},location.origin)}
 function setExpanded(value){
   const panel=document.getElementById('arcadePlayer');
   if(value===expanded||!panel)return;
   expanded=value;
   panel.classList.toggle('is-expanded',value);
   document.documentElement.classList.toggle('arcade-expanded',value);
   const button=document.getElementById('arcadeExpand');
   button.innerHTML=value?'<span aria-hidden="true">×</span>':'<span aria-hidden="true">⛶</span> <span>Ampliar</span>';
   button.setAttribute('aria-label',value?'Salir de pantalla completa (Esc)':'Ampliar a pantalla completa');
   button.setAttribute('aria-pressed',String(value));
   button.title=value?'Salir de pantalla completa (Esc)':'Ampliar a pantalla completa';
   if(value){
     fullscreenPanel=panel;
     for(let node=panel;node.parentElement&&node!==document.body;node=node.parentElement){
       for(const sibling of node.parentElement.children){
         if(sibling!==node){inertElements.push([sibling,sibling.inert]);sibling.inert=true}
       }
     }
   }else{
     inertElements.forEach(([element,inert])=>{element.inert=inert});inertElements=[];
   }
   send('nexmir:arcade-fullscreen',{expanded:value});
   button.focus({preventScroll:true});
 }
 function exitExpanded(){
   const panel=fullscreenPanel;
   setExpanded(false);nativeFullscreen=false;fullscreenPanel=null;
   if(panel&&document.fullscreenElement===panel)document.exitFullscreen().catch(()=>{});
 }
 async function toggleExpanded(){
   if(expanded){exitExpanded();return}
   const panel=document.getElementById('arcadePlayer');
   setExpanded(true);
   // Viewport expansion remains available when the browser cannot enter native fullscreen.
   if(panel.requestFullscreen){
     try{await panel.requestFullscreen();if(!expanded&&document.fullscreenElement===panel)await document.exitFullscreen()}
     catch{/* Keep the viewport fallback. */}
   }
 }
 document.addEventListener('fullscreenchange',()=>{
   if(fullscreenPanel&&document.fullscreenElement===fullscreenPanel){nativeFullscreen=true;return}
   if(nativeFullscreen)exitExpanded();
 });
 document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&expanded){event.preventDefault();exitExpanded()}
   if(state.view==='arcade'&&frame&&!reportDialog.open&&event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName||'')&&!matchMedia('(pointer:coarse) and (max-width:800px)').matches){
     send('nexmir:arcade-key',{key:event.key});
   }
 });
 // Shared reporting entry point for Código Vital and future Arcade games.
 const reportDialog=document.createElement('dialog');reportDialog.className='dialog arcade-report-dialog';
 reportDialog.innerHTML='<form id="arcadeReportForm"><h3>Reportar pregunta</h3><p id="arcadeReportQuestion" class="muted"></p><label>Parte afectada<select name="part"><option value="question">Enunciado</option><option value="answer">Respuesta</option><option value="explanation">Explicación</option><option value="image">Imagen</option><option value="other">Otra</option></select></label><label>Problema<select name="category"><option value="incorrect">Error de contenido</option><option value="ambiguous">Ambigüedad</option><option value="typo">Errata</option><option value="outdated">Desactualizado</option><option value="missing">Información incompleta</option><option value="other">Otro</option></select></label><label>Describe el problema<textarea name="detail" required minlength="10" maxlength="2000" rows="4" spellcheck="true" lang="es" placeholder="¿Qué debemos revisar?"></textarea></label><p id="arcadeReportMessage" role="status" class="muted small"></p><div class="dialog-actions"><button class="btn" type="button" id="arcadeReportCancel">Cancelar</button><button class="btn primary" type="submit">Enviar reporte</button></div></form>';
 document.body.appendChild(reportDialog);
 const reportForm=reportDialog.querySelector('form');let reportQuestion=null;
 document.getElementById('arcadeReportCancel').onclick=()=>reportDialog.close();
 window.NexmirArcadeReports={open(game,questionId){
   if(state.view!=='arcade'||!state.user)return;
   const row=rows.find(x=>x.game===game&&x.id===questionId);
   if(!row)return;
   openReport(row);
 },openClassification(sourceId,title,prompt){
   if(state.view!=='arcade'||!state.user||activeGame!=='clasificaciones'
     ||!/^classification:[a-z][a-z0-9_-]{2,39}:[0-9]{1,3}$/.test(sourceId))return;
   openReport({id:sourceId,clue:title+' · '+prompt,classification:true});
 }};
 function openReport(row){
   reportQuestion=row;reportForm.reset();
   (expanded?document.getElementById('arcadePlayer'):document.body).appendChild(reportDialog);
   document.getElementById('arcadeReportQuestion').textContent=row.clue;
   document.getElementById('arcadeReportMessage').textContent='';reportDialog.showModal();
 }
 reportForm.onsubmit=async event=>{
   event.preventDefault();if(!reportQuestion||!state.user||!state.sb)return;
   const form=new FormData(reportForm),detail=String(form.get('detail')||'').trim();
   if(detail.length<10||detail.length>2000){document.getElementById('arcadeReportMessage').textContent='Escribe entre 10 y 2000 caracteres.';return}
   const button=reportForm.querySelector('[type="submit"]');button.disabled=true;
   try{
     await runPlanLoading(async()=>{
       const body=reportQuestion.classification?'['+reportQuestion.clue.slice(0,450)+'] '+detail:detail;
       if(body.length>2000)throw new Error('Reduce la descripción para enviar el reporte.');
       const {error}=await state.sb.from('question_reports').insert({user_id:state.user.id,source_type:'arcade',source_id:String(reportQuestion.id),part:form.get('part'),category:form.get('category'),detail:body});
       if(error)throw error;
       reportDialog.close();document.body.appendChild(reportDialog);reportQuestion=null;
     },'Enviando reporte…');
   }catch(error){document.getElementById('arcadeReportMessage').textContent=error.message?.startsWith('Reduce')?error.message:'No se pudo enviar el reporte. Revisa la migración de Arcade y vuelve a intentarlo.'}
   finally{button.disabled=false}
 };
 const suggestDialog=document.createElement('dialog');suggestDialog.className='dialog arcade-report-dialog';
 suggestDialog.innerHTML='<form id="arcadeSuggestForm"><h3>Sugerir una clasificación</h3><p class="muted">Cuéntanos qué tabla o escala MIR te gustaría practicar y por qué.</p><label>Clasificación<input name="name" required minlength="3" maxlength="100" placeholder="Por ejemplo, Wells"></label><label>Descripción<textarea name="detail" required minlength="10" maxlength="2500" rows="4" placeholder="Tema, criterios que quieres repasar o un ejemplo de caso"></textarea></label><p id="arcadeSuggestMessage" role="status" class="muted small"></p><div class="dialog-actions"><button class="btn" type="button" id="arcadeSuggestCancel">Cancelar</button><button class="btn primary" type="submit">Enviar sugerencia</button></div></form>';
 document.body.appendChild(suggestDialog);
 document.getElementById('arcadeSuggestCancel').onclick=()=>suggestDialog.close();
 const suggestForm=suggestDialog.querySelector('form');
 suggestForm.onsubmit=async event=>{
   event.preventDefault();if(!state.user||!state.sb)return;
   const form=new FormData(suggestForm),name=String(form.get('name')||'').trim(),detail=String(form.get('detail')||'').trim(),button=suggestForm.querySelector('[type="submit"]');
   if(name.length<3||detail.length<10)return;
   button.disabled=true;
   try{
     await runPlanLoading(async()=>{
       const {error}=await state.sb.from('feature_suggestions').insert({user_id:state.user.id,category:'feature',title:'Arcade · '+name,detail:'Nueva clasificación para Arcade: '+name+'. '+detail});
       if(error)throw error;suggestDialog.close();suggestForm.reset();document.body.appendChild(suggestDialog);
     },'Enviando sugerencia…');
   }catch(error){document.getElementById('arcadeSuggestMessage').textContent='No se pudo enviar. Comprueba que se haya ejecutado supabase/SUGERENCIAS.sql.'}
   finally{button.disabled=false}
 };
 function openClassificationSuggestion(){
   if(state.view!=='arcade'||!state.user||activeGame!=='clasificaciones')return false;
   suggestForm.reset();document.getElementById('arcadeSuggestMessage').textContent='';
   (expanded?document.getElementById('arcadePlayer'):document.body).appendChild(suggestDialog);
   if(!suggestDialog.open)suggestDialog.showModal();
   return true;
 }
 function openClassificationReport(data={}){
   if(state.view!=='arcade'||!state.user||activeGame!=='clasificaciones')return false;
   const sourceId=String(data.sourceId||''),title=String(data.title||'').slice(0,120),prompt=String(data.prompt||'').slice(0,1200);
   const parts=sourceId.split(':'),scale=parts[1],index=Number(parts[2]);
   const base=['apgar','hinchey','asma','curb','forrest','glasgow','garden','nyha','child','ann','birads','breslow','killip'].includes(scale);
   if(!Number.isInteger(index)||index<0||index>999||(!base&&!definitions.some(d=>d.id===scale)))return false;
   window.NexmirArcadeReports.openClassification(sourceId,title,prompt);return true;
 }
 window.NexmirArcadeActions={
   exit(){if(state.view!=='arcade'||activeGame!=='clasificaciones')return false;home();return true},
   suggest:openClassificationSuggestion,
   'classification-report':openClassificationReport
 };
 const observer=new MutationObserver(()=>send('nexmir:arcade-theme',theme()));
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-palette','data-theme-mode']});
 function clean(){exitExpanded();reportDialog.close();suggestDialog.close();reportQuestion=null;request++;frame=null;rows=[];definitions=[];activeGame=null;root()?.replaceChildren()}
 window.addEventListener('nexmir:signout',clean);
 function home(){
   exitExpanded();reportDialog.close();reportQuestion=null;
   request++;frame=null;rows=[];definitions=[];activeGame=null;
   root().innerHTML='<div class="section-head"><div><span class="chip">NEXMIR Arcade</span><h2>Repasa jugando</h2><p class="muted">Perlas clínicas y memoria activa, una partida a la vez.</p></div></div><div class="grid cols-3"><article class="card arcade-game"><div class="type-icon" aria-hidden="true">✦</div><span class="chip">Ahorcado médico</span><h3>Código Vital</h3><p class="muted">Descubre el término a partir de una pista clínica. Elige especialidad y repasa diagnósticos, pruebas, tratamientos y criterios.</p><p class="muted small">6 errores por caso · Explicación al terminar</p><button class="btn primary" id="arcadePlay">Jugar a Código Vital</button></article><article class="card arcade-game"><div class="type-icon" aria-hidden="true">▦</div><span class="chip">Memoria clínica</span><h3>Clasificaciones MIR</h3><p class="muted">Resuelve casos de Apgar, CURB-65, Hinchey, Forrest, Garden y más. Puntúa cada criterio o elige el grado sin pistas que revelen la tabla.</p><p class="muted small">Repaso completo al terminar · 13 clasificaciones incluidas</p><button class="btn primary" id="arcadePlayClassifications">Jugar a clasificaciones</button></article></div><p class="muted small">Arcade está disponible para Free y Pro. Sus partidas no consumen banqueo ni suman XP, dominio o racha de estudio.</p>';
   document.getElementById('arcadePlay').onclick=()=>play('codigo_vital');
   document.getElementById('arcadePlayClassifications').onclick=()=>play('clasificaciones');
 }
 function play(kind='codigo_vital'){return runPlanLoading(()=>loadGame(kind),kind==='clasificaciones'?'Cargando Clasificaciones MIR…':'Cargando Código Vital…')}
 async function loadGame(kind='codigo_vital'){
   const ticket=++request;activeGame=kind;frame=null;rows=[];definitions=[];
   root().innerHTML='<div id="arcadePlayer"><div class="section-head arcade-toolbar"><h2 id="arcadeGameTitle"></h2><div class="arcade-actions"><button class="btn" id="arcadeBack">← Juegos</button><button class="btn primary arcade-expand" id="arcadeExpand" aria-label="Ampliar a pantalla completa" aria-pressed="false" title="Ampliar a pantalla completa" disabled><span aria-hidden="true">⛶</span> <span>Ampliar</span></button></div></div><p id="arcadeLoading" role="status" class="muted">Cargando juego…</p><div id="arcadeHost"></div></div>';
   document.getElementById('arcadeGameTitle').textContent=kind==='clasificaciones'?'Clasificaciones MIR':'Código Vital';
   document.getElementById('arcadeBack').onclick=home;
   document.getElementById('arcadeExpand').onclick=toggleExpanded;
   try{
     if(!state.user||!state.sb)throw new Error('Inicia sesión para jugar.');
     if(kind==='clasificaciones'){
       try{
         const loaded=[];
         for(let start=0;;start+=500){
           const {data,error}=await state.sb.from('arcade_classifications').select('id,data').eq('published',true).order('id').range(start,start+499);
           if(ticket!==request||state.view!=='arcade')return;
           if(error)throw error;
           loaded.push(...(data||[]));if(!data||data.length<500)break;
         }
         definitions=loaded;
       }catch(error){console.warn('Clasificaciones personalizadas pendientes de instalación o conexión',error);definitions=[]}
       if(ticket!==request||state.view!=='arcade')return;
       const host=document.getElementById('arcadeHost');
       frame=document.createElement('iframe');frame.title='Clasificaciones MIR · Memoria clínica';frame.className='arcade-frame';
       frame.src='arcade/clasificaciones.html?v=5.1.31';host.appendChild(frame);
       document.getElementById('arcadeExpand').disabled=false;
       document.getElementById('arcadeLoading').textContent=definitions.length?'Selecciona una clasificación para practicar.':'Selecciona una clasificación. Los casos incluidos están disponibles aunque aún no se instale la ampliación del panel admin.';
       return;
     }
     const collected=[];
     for(let start=0;;start+=500){
       const {data,error}=await state.sb.from('arcade_questions').select('id,game,specialty,topic,category,answer,clue,explanation,answer_image_path,clue_image_path').eq('game','codigo_vital').eq('published',true).order('id').range(start,start+499);
       if(ticket!==request||state.view!=='arcade')return;
       if(error)throw error;
       collected.push(...(data||[]));if(!data||data.length<500)break;
     }
     try{rows=await imageUrls(collected)}catch(error){console.warn('No se pudieron cargar imágenes de Arcade',error);rows=collected}
     if(ticket!==request||state.view!=='arcade')return;
     if(!rows.length){document.getElementById('arcadeLoading').textContent='Todavía no hay preguntas publicadas. Vuelve cuando el administrador añada contenido.';return}
     const host=document.getElementById('arcadeHost');
     frame=document.createElement('iframe');frame.title='Código Vital · Ahorcado médico';frame.className='arcade-frame';
     frame.src='arcade/codigo-vital.html?v=5.1.18';host.appendChild(frame);
     document.getElementById('arcadeExpand').disabled=false;
     document.getElementById('arcadeLoading').textContent='Elige una especialidad para comenzar.';
   }catch(error){
     if(ticket!==request)return;
     const text=String(error.message||error);
     document.getElementById('arcadeLoading').textContent=/clue_image_path|42703/.test(text)?'Arcade necesita la actualización supabase/ARCADE_5_1_18.sql.':/answer_image_path|topic/.test(text)?'Arcade necesita supabase/ARCADE_TEMAS_5_1_17.sql y después supabase/ARCADE_5_1_18.sql.':/arcade_questions|schema cache|42P01/.test(text)?'Arcade está pendiente de instalación. El administrador debe ejecutar supabase/ARCADE.sql.':'No se pudieron cargar las preguntas. Comprueba tu conexión y vuelve a intentarlo.';
     const retry=document.createElement('button');retry.className='btn';retry.textContent='Reintentar';retry.onclick=()=>play(kind);document.getElementById('arcadeHost').appendChild(retry);
   }
 }
 window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==frame?.contentWindow||!state.user)return;
   if(event.data?.type==='nexmir:arcade-exit-fullscreen'){exitExpanded();return}
   if(event.data?.type==='nexmir:arcade-exit'){window.NexmirArcadeActions.exit();return}
   if(event.data?.type==='nexmir:arcade-suggest'){openClassificationSuggestion();return}
   if(event.data?.type==='nexmir:arcade-classification-report'&&activeGame==='clasificaciones'){
     openClassificationReport(event.data);return;
   }
   if(event.data?.type==='nexmir:arcade-report'){window.NexmirArcadeReports.open(event.data.game,event.data.questionId);return}
   if(event.data?.type==='nexmir:arcade-ready'){
     if(activeGame==='clasificaciones'){
       send('nexmir:arcade-classifications-init',{definitions});
       send('nexmir:arcade-theme',theme());
       send('nexmir:arcade-fullscreen',{expanded});
       return;
     }
     const specialties=[...new Set([...RemnoteTaxonomy.subjects,...detectedSpecialties().map(x=>RemnoteTaxonomy.canonical(x)),...rows.map(x=>x.specialty)])].filter(x=>!RemnoteTaxonomy.unclassified(x)).sort((a,b)=>a.localeCompare(b,'es'));
     send('nexmir:arcade-init',{questions:rows,specialties,...theme()});
     send('nexmir:arcade-fullscreen',{expanded});
   }
 });
 viewNames.arcade='Arcade';
 const prior=window.render;window.render=function(view){if(view==='arcade')return home();exitExpanded();return prior(view)};
})();
