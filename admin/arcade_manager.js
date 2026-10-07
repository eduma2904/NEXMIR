(() => {
 'use strict';
 let rows=[], editing=null, busy=false, generation=0;
 const id=s=>document.getElementById(s);
 const allowed=()=>cloudMode&&sb&&cloudUser&&cloudRole==='admin';
 const message=t=>{if(id('arcadeMessage'))id('arcadeMessage').textContent=t};
 const previous=go;go=function(view){previous(view);if(view==='arcade')load()};
 function shell(){
  id('arcadeView').innerHTML=`<div class="pageHead"><div><div class="eyebrow">NEXMIR ARCADE</div><h1>Preguntas de los juegos</h1><p>Gestiona Código Vital por especialidad. Este banco no se mezcla con preguntas test ni flashcards.</p></div><button id="arcadeRefresh" class="secondary">Actualizar</button></div><p id="arcadeMessage" role="status" aria-live="polite"></p><div id="arcadeAdminBody" hidden><div class="cardBox"><h2 id="arcadeEditorTitle">Nueva pregunta</h2><form id="arcadeForm"><div class="grid2"><label class="fieldLabel">Juego<select name="game"><option value="codigo_vital">Código Vital</option></select></label><label class="fieldLabel">Especialidad<input name="specialty" list="arcadeSpecialties" required minlength="2" maxlength="160" placeholder="Neumología"><datalist id="arcadeSpecialties"></datalist></label></div><div class="grid2"><label class="fieldLabel">Categoría<input name="category" list="arcadeCategories" required minlength="2" maxlength="80" placeholder="Diagnósticos"><datalist id="arcadeCategories"><option value="Diagnósticos"><option value="Tratamiento clave"><option value="Criterios y pruebas"><option value="Escalas"><option value="Perlas MIR"><option value="Fármacos"><option value="Microorganismos"></datalist></label><label class="fieldLabel">Respuesta oculta<input name="answer" required minlength="2" maxlength="80" placeholder="Proteinosis alveolar"><small class="muted">Letras, espacios y guiones. Se admiten tildes y Ñ; no números.</small></label></div><label class="fieldLabel">Pista clínica<textarea name="clue" rows="4" required minlength="15" maxlength="1200" placeholder="Describe el caso y termina en una pregunta: ¿Cuál es el diagnóstico?"></textarea></label><label class="fieldLabel">Explicación al terminar<textarea name="explanation" rows="3" required minlength="10" maxlength="3000" placeholder="La perla clínica que debe recordar el estudiante."></textarea></label><label class="arcadePublish"><input type="checkbox" name="published"> Publicada: disponible para los estudiantes</label><p class="muted small">Borrador si está desmarcada. Comprueba que la pista conduzca a una sola respuesta.</p><div class="actions"><button class="primary" type="submit" id="arcadeSave">Guardar pregunta</button><button class="secondary" type="button" id="arcadePreviewBtn">Previsualizar</button><button class="ghost" type="button" id="arcadeCancel">Cancelar edición</button></div><div id="arcadePreview" class="cardBox" hidden></div></form></div><div class="toolbar"><label>Especialidad<select id="arcadeFilter"></select></label><label>Estado<select id="arcadeStatus"><option value="all">Todos</option><option value="published">Publicadas</option><option value="draft">Borradores</option></select></label><input id="arcadeSearch" type="search" aria-label="Buscar preguntas Arcade" placeholder="Buscar respuesta o pista"></div><p id="arcadeCount" class="muted"></p><div id="arcadeList"></div></div>`;
  id('arcadeRefresh').onclick=()=>{if(!busy&&(!editing||confirm('¿Descartar la edición y actualizar?')))load()};
 }
 async function load(){
  const ticket=++generation;rows=[];editing=null;shell();
  if(!allowed()){message('Inicia sesión como administrador para gestionar Arcade. Los moderadores no pueden modificar este banco.');return}
  message('Cargando preguntas…');
  try{
   const loaded=[];
   for(let offset=0;;offset+=500){const {data,error}=await sb.from('arcade_questions').select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+499);if(ticket!==generation||!allowed())return;if(error)throw error;loaded.push(...(data||[]));if(!data||data.length<500)break}
   rows=loaded;id('arcadeAdminBody').hidden=false;
   const extra=Object.values(state.db.cards||{}).map(x=>x.current?.specialty).filter(Boolean);
   const subjects=[...new Set([...RemnoteTaxonomy.subjects,...extra,...rows.map(x=>x.specialty)])].sort((a,b)=>a.localeCompare(b,'es'));
   id('arcadeSpecialties').innerHTML=subjects.map(x=>`<option value="${esc(x)}">`).join('');
   id('arcadeFilter').innerHTML='<option value="">Todas</option>'+subjects.map(x=>`<option>${esc(x)}</option>`).join('');
   id('arcadeForm').onsubmit=save;id('arcadeCancel').onclick=reset;id('arcadePreviewBtn').onclick=preview;
   for(const name of ['arcadeFilter','arcadeStatus','arcadeSearch'])id(name).addEventListener('input',list);
   reset();list();message(`${rows.length} preguntas cargadas.`);
  }catch(error){message('No se pudo cargar Arcade. '+(/arcade_questions|schema cache|42P01/.test(error.message)?'Ejecuta supabase/ARCADE.sql y pulsa Actualizar.':String(error.message||error)))}
 }
 function reset(){if(busy)return;editing=null;id('arcadeForm').reset();id('arcadeEditorTitle').textContent='Nueva pregunta';id('arcadeSave').textContent='Guardar pregunta';id('arcadePreview').hidden=true}
 function values(){const f=id('arcadeForm').elements;return{game:'codigo_vital',specialty:RemnoteTaxonomy.canonical(f.specialty.value.trim()),category:f.category.value.trim(),answer:f.answer.value.trim().replace(/\s+/g,' '),clue:f.clue.value.trim(),explanation:f.explanation.value.trim(),published:f.published.checked}}
 function valid(v){if(RemnoteTaxonomy.unclassified(v.specialty))return 'Elige una especialidad.';if(!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ -]+$/.test(v.answer)||!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(v.answer))return 'La respuesta solo admite letras, espacios y guiones.';if(!v.clue.endsWith('?')||!v.clue.includes('¿'))return 'La pista debe terminar con una pregunta entre ¿ y ?.';return ''}
 function preview(){if(!id('arcadeForm').reportValidity())return;const v=values(),error=valid(v);if(error){message(error);return}const p=id('arcadePreview');p.hidden=false;p.innerHTML=`<strong>Vista previa · ${esc(v.specialty)}</strong><p>${esc(v.clue)}</p><p class="arcadeLetters">${esc(v.answer.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,'＿'))}</p><details><summary>Ver respuesta y explicación</summary><p><strong>${esc(v.answer)}</strong></p><p>${esc(v.explanation)}</p></details>`}
 function list(){
  const sp=id('arcadeFilter').value,status=id('arcadeStatus').value,search=id('arcadeSearch').value.toLocaleLowerCase('es');
  const filtered=rows.filter(x=>(!sp||x.specialty===sp)&&(status==='all'||x.published===(status==='published'))&&[x.answer,x.clue].join(' ').toLocaleLowerCase('es').includes(search));
  id('arcadeCount').textContent=`${filtered.length} preguntas · ${rows.filter(x=>x.published).length} publicadas en total`;
  id('arcadeList').innerHTML=filtered.map(x=>`<article class="cardBox arcadeAdminRow"><div><span class="badge">${x.published?'Publicada':'Borrador'}</span><strong>${esc(x.answer)}</strong><p class="muted">${esc(x.specialty)} · ${esc(x.category)}</p><p>${esc(x.clue)}</p></div><button class="secondary" data-edit="${esc(x.id)}">Editar</button></article>`).join('')||'<div class="empty">No hay preguntas con esos filtros.</div>';
  id('arcadeList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.edit));
 }
 function edit(key){if(busy||!allowed())return;editing=rows.find(x=>x.id===key);if(!editing)return;const f=id('arcadeForm').elements;for(const k of ['specialty','category','answer','clue','explanation'])f[k].value=editing[k];f.published.checked=editing.published;id('arcadeEditorTitle').textContent='Editar pregunta';id('arcadeSave').textContent='Guardar cambios';id('arcadePreview').hidden=true;id('arcadeForm').scrollIntoView({behavior:'smooth',block:'start'});f.answer.focus({preventScroll:true})}
 async function save(event){
  event.preventDefault();if(busy)return;if(!allowed()){message('Necesitas una sesión de administrador.');return}
  if(!id('arcadeForm').reportValidity())return;const v=values(),error=valid(v);if(error){message(error);return}
  busy=true;const selected=editing;id('arcadeSave').disabled=true;message('Guardando…');
  try{
   const payload={...v,updated_at:new Date().toISOString()};
   const query=selected?sb.from('arcade_questions').update(payload).eq('id',selected.id).eq('updated_at',selected.updated_at):sb.from('arcade_questions').insert(payload);
   const {data,error}=await query.select().single();if(error)throw error;
   rows=selected?rows.map(x=>x.id===data.id?data:x):[data,...rows];busy=false;reset();list();
   message(data.published?'Guardada y publicada. Aparecerá al volver a abrir Código Vital.':'Borrador guardado. No aparece en el juego.');
  }catch(error){message(error.code==='PGRST116'?'La pregunta cambió desde que la abriste. Actualiza la lista antes de editar.':'No se guardó: '+String(error.message||error))}
  finally{busy=false;if(id('arcadeSave'))id('arcadeSave').disabled=false}
 }
 const logout=logoutCloud;logoutCloud=async function(){generation++;rows=[];editing=null;id('arcadeView').replaceChildren();return logout()};
})();
