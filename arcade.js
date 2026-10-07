/* Arcade is separate from attempts, XP, streaks and Free/Pro quotas. */
(() => {
 'use strict';
 let frame=null, rows=[], request=0;
 async function imageUrls(items){
   const paths=[...new Set(items.map(x=>x.answer_image_path).filter(Boolean))];
   if(!paths.length)return items;
   const signed=new Map();
   for(let offset=0;offset<paths.length;offset+=100){
     const {data,error}=await state.sb.storage.from('arcade-images').createSignedUrls(paths.slice(offset,offset+100),43200);
     if(error)throw error;
     for(const item of data||[])if(item.signedUrl)signed.set(item.path,item.signedUrl);
   }
   return items.map(x=>({...x,answer_image_url:signed.get(x.answer_image_path)||null}));
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
 });
 const observer=new MutationObserver(()=>send('nexmir:arcade-theme',theme()));
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-palette','data-theme-mode']});
 function clean(){exitExpanded();request++;frame=null;rows=[];root()?.replaceChildren()}
 window.addEventListener('nexmir:signout',clean);
 function home(){
   exitExpanded();
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
       const {data,error}=await state.sb.from('arcade_questions').select('id,specialty,topic,category,answer,clue,explanation,answer_image_path').eq('game','codigo_vital').eq('published',true).order('id').range(start,start+499);
       if(ticket!==request||state.view!=='arcade')return;
       if(error)throw error;
       collected.push(...(data||[]));if(!data||data.length<500)break;
     }
     try{rows=await imageUrls(collected)}catch(error){console.warn('No se pudieron cargar imágenes de Arcade',error);rows=collected}
     if(ticket!==request||state.view!=='arcade')return;
     if(!rows.length){document.getElementById('arcadeLoading').textContent='Todavía no hay preguntas publicadas. Vuelve cuando el administrador añada contenido.';return}
     const host=document.getElementById('arcadeHost');
     frame=document.createElement('iframe');frame.title='Código Vital · Ahorcado médico';frame.className='arcade-frame';
     frame.src='arcade/codigo-vital.html?v=5.1.17';host.appendChild(frame);
     document.getElementById('arcadeExpand').disabled=false;
     document.getElementById('arcadeLoading').textContent='Elige una especialidad para comenzar.';
   }catch(error){
     if(ticket!==request)return;
     const text=String(error.message||error);
     document.getElementById('arcadeLoading').textContent=/answer_image_path|topic|42703/.test(text)?'Arcade necesita la actualización de base de datos supabase/ARCADE_TEMAS_5_1_17.sql.':/arcade_questions|schema cache|42P01/.test(text)?'Arcade está pendiente de instalación. El administrador debe ejecutar supabase/ARCADE.sql.':'No se pudieron cargar las preguntas. Comprueba tu conexión y vuelve a intentarlo.';
     const retry=document.createElement('button');retry.className='btn';retry.textContent='Reintentar';retry.onclick=play;document.getElementById('arcadeHost').appendChild(retry);
   }
 }
 window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==frame?.contentWindow||!state.user)return;
   if(event.data?.type==='nexmir:arcade-exit-fullscreen'){exitExpanded();return}
   if(event.data?.type==='nexmir:arcade-ready'){
     const specialties=[...new Set([...RemnoteTaxonomy.subjects,...detectedSpecialties().map(x=>RemnoteTaxonomy.canonical(x)),...rows.map(x=>x.specialty)])].filter(x=>!RemnoteTaxonomy.unclassified(x)).sort((a,b)=>a.localeCompare(b,'es'));
     send('nexmir:arcade-init',{questions:rows,specialties,...theme()});
     send('nexmir:arcade-fullscreen',{expanded});
   }
 });
 viewNames.arcade='Arcade';
 const prior=window.render;window.render=function(view){if(view==='arcade')return home();exitExpanded();return prior(view)};
})();
