/* Arcade is separate from attempts, XP, streaks and Free/Pro quotas. */
(() => {
 'use strict';
 let frame=null, rows=[], request=0;
 const root=()=>document.getElementById('view-arcade');
 const theme=()=>({palette:document.documentElement.dataset.palette||'blue',mode:document.documentElement.dataset.themeMode||'dark'});
 function send(type,extra={}){if(frame?.contentWindow)frame.contentWindow.postMessage({type,...extra},location.origin)}
 const observer=new MutationObserver(()=>send('nexmir:arcade-theme',theme()));
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-palette','data-theme-mode']});
 function clean(){request++;frame=null;rows=[];root()?.replaceChildren()}
 window.addEventListener('nexmir:signout',clean);
 function home(){
   request++;frame=null;rows=[];
   root().innerHTML='<div class="section-head"><div><span class="chip">NEXMIR Arcade</span><h2>Repasa jugando</h2><p class="muted">Perlas clínicas y memoria activa, una partida a la vez.</p></div></div><div class="grid cols-3"><article class="card arcade-game"><div class="type-icon" aria-hidden="true">✦</div><span class="chip">Ahorcado médico</span><h3>Código Vital</h3><p class="muted">Descubre el término a partir de una pista clínica. Elige especialidad y repasa diagnósticos, pruebas, tratamientos y criterios.</p><p class="muted small">6 errores por caso · Explicación al terminar</p><button class="btn primary" id="arcadePlay">Jugar a Código Vital</button></article></div><p class="muted small">Arcade está disponible para Free y Pro. Sus partidas no consumen banqueo ni suman XP, dominio o racha de estudio.</p>';
   document.getElementById('arcadePlay').onclick=play;
 }
 async function play(){
   const ticket=++request;
   root().innerHTML='<div class="section-head"><h2>Código Vital</h2><button class="btn" id="arcadeBack">← Juegos</button></div><p id="arcadeLoading" role="status" class="muted">Cargando preguntas publicadas…</p><div id="arcadeHost"></div>';
   document.getElementById('arcadeBack').onclick=home;
   try{
     if(!state.user||!state.sb)throw new Error('Inicia sesión para jugar.');
     const collected=[];
     for(let start=0;;start+=500){
       const {data,error}=await state.sb.from('arcade_questions').select('id,specialty,category,answer,clue,explanation').eq('game','codigo_vital').eq('published',true).order('id').range(start,start+499);
       if(ticket!==request||state.view!=='arcade')return;
       if(error)throw error;
       collected.push(...(data||[]));if(!data||data.length<500)break;
     }
     rows=collected;
     if(!rows.length){document.getElementById('arcadeLoading').textContent='Todavía no hay preguntas publicadas. Vuelve cuando el administrador añada contenido.';return}
     const host=document.getElementById('arcadeHost');
     frame=document.createElement('iframe');frame.title='Código Vital · Ahorcado médico';frame.className='arcade-frame';
     frame.src='arcade/codigo-vital.html?v=5.1.16';host.appendChild(frame);
     document.getElementById('arcadeLoading').textContent='Elige una especialidad para comenzar.';
   }catch(error){
     if(ticket!==request)return;
     const text=String(error.message||error);
     document.getElementById('arcadeLoading').textContent=/arcade_questions|schema cache|42P01/.test(text)?'Arcade está pendiente de instalación. El administrador debe ejecutar supabase/ARCADE.sql.':'No se pudieron cargar las preguntas. Comprueba tu conexión y vuelve a intentarlo.';
     const retry=document.createElement('button');retry.className='btn';retry.textContent='Reintentar';retry.onclick=play;document.getElementById('arcadeHost').appendChild(retry);
   }
 }
 window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==frame?.contentWindow||!state.user)return;
   if(event.data?.type==='nexmir:arcade-ready'){
     const specialties=[...new Set([...RemnoteTaxonomy.subjects,...detectedSpecialties().map(x=>RemnoteTaxonomy.canonical(x)),...rows.map(x=>x.specialty)])].filter(x=>!RemnoteTaxonomy.unclassified(x)).sort((a,b)=>a.localeCompare(b,'es'));
     send('nexmir:arcade-init',{questions:rows,specialties,...theme()});
   }
 });
 viewNames.arcade='Arcade';
 const prior=window.render;window.render=function(view){if(view==='arcade')return home();return prior(view)};
})();
