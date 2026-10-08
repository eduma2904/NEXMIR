/* Arcade is separate from attempts, XP, streaks and Free/Pro quotas. */
(() => {
 'use strict';
 let frame=null, rows=[], request=0;
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
   reportQuestion=row;reportForm.reset();
   (expanded?document.getElementById('arcadePlayer'):document.body).appendChild(reportDialog);
   document.getElementById('arcadeReportQuestion').textContent=row.clue;
   document.getElementById('arcadeReportMessage').textContent='';reportDialog.showModal();
 }};
 reportForm.onsubmit=async event=>{
   event.preventDefault();if(!reportQuestion||!state.user||!state.sb)return;
   const form=new FormData(reportForm),detail=String(form.get('detail')||'').trim();
   if(detail.length<10||detail.length>2000){document.getElementById('arcadeReportMessage').textContent='Escribe entre 10 y 2000 caracteres.';return}
   const button=reportForm.querySelector('[type="submit"]');button.disabled=true;
   try{
     const {error}=await state.sb.from('question_reports').insert({user_id:state.user.id,source_type:'arcade',source_id:String(reportQuestion.id),part:form.get('part'),category:form.get('category'),detail});
     if(error)throw error;
     reportDialog.close();document.body.appendChild(reportDialog);reportQuestion=null;
   }catch(error){document.getElementById('arcadeReportMessage').textContent='No se pudo enviar el reporte. Comprueba que se haya ejecutado supabase/ARCADE_5_1_18.sql.'}
   finally{button.disabled=false}
 };
 const observer=new MutationObserver(()=>send('nexmir:arcade-theme',theme()));
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-palette','data-theme-mode']});
 function clean(){exitExpanded();reportDialog.close();reportQuestion=null;request++;frame=null;rows=[];root()?.replaceChildren()}
 window.addEventListener('nexmir:signout',clean);
 function home(){
   exitExpanded();reportDialog.close();reportQuestion=null;
   request++;frame=null;rows=[];
   root().innerHTML='<div class="section-head"><div><span class="chip">NEXMIR Arcade</span><h2>Repasa jugando</h2><p class="muted">Perlas clínicas y memoria activa, una partida a la vez.</p></div></div><div class="grid cols-3"><article class="card arcade-game"><div class="type-icon" aria-hidden="true">✦</div><span class="chip">Ahorcado médico</span><h3>Código Vital</h3><p class="muted">Descubre el término a partir de una pista clínica. Elige especialidad y repasa diagnósticos, pruebas, tratamientos y criterios.</p><p class="muted small">6 errores por caso · Explicación al terminar</p><button class="btn primary" id="arcadePlay">Jugar a Código Vital</button></article></div><p class="muted small">Arcade está disponible para Free y Pro. Sus partidas no consumen banqueo ni suman XP, dominio o racha de estudio.</p>';
   document.getElementById('arcadePlay').onclick=play;
 }
 async function play(){
   const ticket=++request;
   root().innerHTML='<div id="arcadePlayer"><div class="section-head arcade-toolbar"><h2>Código Vital</h2><div class="arcade-actions"><button class="btn" id="arcadeBack">← Juegos</button><button class="btn primary arcade-expand" id="arcadeExpand" aria-label="Ampliar a pantalla completa" aria-pressed="false" title="Ampliar a pantalla completa" disabled><span aria-hidden="true">⛶</span> <span>Ampliar</span></button></div></div><p id="arcadeLoading" role="status" class="muted">Cargando preguntas publicadas…</p><div id="arcadeHost"></div></div>';
   document.getElementById('arcadeBack').onclick=home;
   document.getElementById('arcadeExpand').onclick=toggleExpanded;
   try{
     if(!state.user||!state.sb)throw new Error('Inicia sesión para jugar.');
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
     const retry=document.createElement('button');retry.className='btn';retry.textContent='Reintentar';retry.onclick=play;document.getElementById('arcadeHost').appendChild(retry);
   }
 }
 window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==frame?.contentWindow||!state.user)return;
   if(event.data?.type==='nexmir:arcade-exit-fullscreen'){exitExpanded();return}
   if(event.data?.type==='nexmir:arcade-report'){window.NexmirArcadeReports.open(event.data.game,event.data.questionId);return}
   if(event.data?.type==='nexmir:arcade-ready'){
     const specialties=[...new Set([...RemnoteTaxonomy.subjects,...detectedSpecialties().map(x=>RemnoteTaxonomy.canonical(x)),...rows.map(x=>x.specialty)])].filter(x=>!RemnoteTaxonomy.unclassified(x)).sort((a,b)=>a.localeCompare(b,'es'));
     send('nexmir:arcade-init',{questions:rows,specialties,...theme()});
     send('nexmir:arcade-fullscreen',{expanded});
   }
 });
 viewNames.arcade='Arcade';
 const prior=window.render;window.render=function(view){if(view==='arcade')return home();exitExpanded();return prior(view)};
})();
