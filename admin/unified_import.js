/* One entry point for ZIP/Markdown and PDF imports. Publication remains explicit. */
(() => {
  const labels={bank:'Banco',simulation:'Simulacro',theory:'Teoría',flashcards:'Flashcards',combined:'Combinado'};
  const dialog=document.createElement('dialog');dialog.id='importIntentDialog';dialog.className='import-intent-dialog';document.body.append(dialog);
  let choosing=false;
  async function inspect(files){
    const summary={tests:0,cards:0,theory:0,documents:0,pdfs:[],unsupported:0};
    async function markdown(name,text,archiveName){const result=parseMarkdown(text,name,{archiveName});summary.documents++;summary.tests+=result.cards.filter(NexmirContentRules.isMultipleChoice).length;summary.cards+=result.cards.filter(c=>!NexmirContentRules.isMultipleChoice(c)).length;summary.theory+=result.theory.length;await importYield()}
    for(const file of files){
      if(/\.zip$/i.test(file.name)){
        const zip=await JSZip.loadAsync(file);
        for(const entry of Object.values(zip.files).filter(e=>!e.dir&&!e.name.startsWith('__MACOSX/'))){
          if(/\.(md|markdown)$/i.test(entry.name))await markdown(entry.name,await entry.async('string'),file.name);
          else if(/\.pdf$/i.test(entry.name))summary.pdfs.push({name:entry.name,load:async()=>new File([await entry.async('uint8array')],entry.name.split('/').at(-1),{type:'application/pdf'})});
          else if(!/\.(png|jpe?g|webp|gif|svg)$/i.test(entry.name))summary.unsupported++;
        }
      }else if(/\.(md|markdown)$/i.test(file.name))await markdown(file.name,await file.text(),file.name);
      else if(/\.pdf$/i.test(file.name))summary.pdfs.push({name:file.name,load:async()=>file});
      else summary.unsupported++;
    }
    return summary;
  }
  window.chooseContentImport=async(files)=>{
    if(choosing)return null;choosing=true;
    dialog.innerHTML='<h2>Revisando archivos…</h2><p class="muted" aria-live="polite">Detectando el contenido antes de elegir el destino.</p>';dialog.showModal();
    let aborted=false;const abort=()=>{aborted=true};dialog.addEventListener('cancel',abort,{once:true});
    try{
      const info=await inspect(files);if(aborted||!dialog.open)return null;
      if(!info.documents&&!info.pdfs.length)throw Error('No encontramos Markdown ni PDF. Este importador admite ZIP de RemNote con Markdown y ZIP con PDFs.');
      const onlyPdf=!info.documents;
      dialog.innerHTML=`<div class="compareHead"><div><div class="eyebrow">NUEVA IMPORTACIÓN</div><h2>¿Qué estás subiendo?</h2></div><button type="button" id="intentClose" aria-label="Cerrar">×</button></div><p class="muted">${files.map(f=>esc(f.name)).join(' · ')}</p><div class="import-detection"><span><strong>${info.tests}</strong> preguntas test</span><span><strong>${info.cards}</strong> flashcards sin alternativas</span><span><strong>${info.theory}</strong> bloques de teoría</span>${info.pdfs.length?`<span><strong>${info.pdfs.length}</strong> PDF</span>`:''}</div><fieldset class="import-intents"><legend>Tipo de carga</legend>${Object.entries(labels).map(([value,label])=>`<label><input type="radio" name="importIntent" value="${value}" ${value===(onlyPdf?'bank':'combined')?'checked':''} ${onlyPdf&&!['bank','simulation'].includes(value)?'disabled':''}><strong>${label}</strong></label>`).join('')}</fieldset><p id="intentRouting" class="notice" aria-live="polite"></p>${info.pdfs.length?`<p class="muted">Los PDF se analizan con el importador de preguntas. ${info.documents?'Combinado procesa tanto el Markdown como los PDF seleccionados.':'Indica el contenido de cada PDF.'}</p><div class="pdf-import-roles">${info.pdfs.map((f,i)=>`<label class="fieldLabel">${esc(f.name)}<select data-pdf-role="${i}"><option value="skip">Omitir</option><option value="complete" ${info.pdfs.length===1?'selected':''}>Preguntas y soluciones juntas</option><option value="questions" ${info.pdfs.length>1&&i===0?'selected':''}>Preguntas</option><option value="answers" ${info.pdfs.length>1&&i===1?'selected':''}>Respuestas y comentarios</option><option value="images">Imágenes</option></select></label>`).join('')}</div>`:''}${info.unsupported?`<p class="muted">${info.unsupported} archivos de otros formatos no se analizarán.</p>`:''}<p id="intentError" class="danger" role="alert"></p><div class="actions"><button id="intentCancel" class="secondary" type="button">Cancelar</button><button id="intentContinue" class="primary" type="button">Analizar y revisar</button></div>`;
      function routing(){
        const intent=dialog.querySelector('[name="importIntent"]:checked').value;
        const pdfMode=info.pdfs.length&&['bank','simulation','combined'].includes(intent);
        dialog.querySelector('.pdf-import-roles')?.classList.toggle('hidden',!pdfMode);
        let count=info.tests+(intent==='combined'||intent==='flashcards'?info.cards:0)+(intent==='combined'||intent==='theory'?info.theory:0);
        dialog.querySelector('#intentRouting').textContent=pdfMode?(intent==='combined'?'Se combinarán los contenidos Markdown y las preguntas de los PDF seleccionados en una sola revisión.':'Se prepararán los PDF seleccionados. El Markdown de este ZIP se conserva sin importar en esta carga.'):`${count} contenidos para revisar. Las preguntas de opción múltiple se habilitan en banco, simulacros y batallas. Las flashcards sin alternativas se reservan para estudio, repasos y Focus. ${intent==='combined'?'Se incluyen todas las categorías detectadas.':'Las demás categorías quedan fuera de esta carga; elige Combinado para incluirlas.'}`;
      }
      dialog.querySelectorAll('[name="importIntent"]').forEach(el=>el.onchange=routing);routing();
      const choice=await new Promise(resolve=>{
        const cancel=()=>resolve(null);dialog.addEventListener('cancel',cancel,{once:true});
        dialog.querySelector('#intentClose').onclick=cancel;dialog.querySelector('#intentCancel').onclick=cancel;
        dialog.querySelector('#intentContinue').onclick=()=>{
          const intent=dialog.querySelector('[name="importIntent"]:checked').value;
          const roles=[...dialog.querySelectorAll('[data-pdf-role]')].map(el=>({entry:info.pdfs[+el.dataset.pdfRole],role:el.value})).filter(x=>x.role!=='skip');
          if(info.pdfs.length&&['bank','simulation','combined'].includes(intent)){
            const kinds=roles.map(x=>x.role);
            if(!kinds.some(x=>['complete','questions','answers'].includes(x))||new Set(kinds).size!==kinds.length||kinds.includes('complete')&&(kinds.includes('questions')||kinds.includes('answers'))){dialog.querySelector('#intentError').textContent='Elige un PDF completo o PDFs separados de preguntas y respuestas, con un PDF de imágenes opcional.';return}
            resolve({intent,pdfs:roles});
          }else resolve({intent,pdfs:[]});
        };
      });
      if(dialog.open)dialog.close();return choice;
    }catch(e){if(dialog.open)dialog.close();alert('No se pudo preparar la importación: '+e.message);return null}
    finally{dialog.removeEventListener('cancel',abort);choosing=false}
  };
  window.routePdfImport=async choice=>{
    const prefix=choice.intent==='simulation'?'sim':'bank';go(prefix==='sim'?'simimport':'bankimport');
    const complete=choice.pdfs.some(x=>x.role==='complete');
    document.querySelector(`#${prefix==='sim'?'sim':'bank'}SourceTabs [data-mode="${complete?'single':'separate'}"]`).click();
    const ids=prefix==='sim'?{complete:'simSinglePdf',questions:'simQuestionsPdf',answers:'simAnswersPdf',images:complete?'simSingleImagesPdf':'simImagesPdf'}:{complete:'bankSinglePdf',questions:'bankQuestionsPdf',answers:'bankAnswersPdf',images:complete?'bankSingleImagesPdf':'bankImagesPdf'};
    for(const id of Object.values(ids))document.getElementById(id).value='';
    for(const {entry,role} of choice.pdfs){const dt=new DataTransfer();dt.items.add(await entry.load());document.getElementById(ids[role]).files=dt.files}
    await document.getElementById(prefix==='sim'?'simAnalyzeBtn':'bankAnalyzeBtn').onclick();
  };
  window.prepareCombinedPdfCards=async(choice,archiveName)=>{
    await window.routePdfImport({...choice,intent:'bank'});
    const api=window.NexmirBankImportReview;
    if(!api.rows().length)throw new Error('No se pudo preparar el PDF. Revisa sus preguntas antes de combinarlo.');
    const cards=[];
    for(const q of api.rows()){
      let front=q.stem;
      const image=api.images().get(q.image_number);
      if(image?.blob){
        const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(image.blob)});
        front+='\n![Imagen de la pregunta]('+data+')';
      }
      const card={type:'multiple_choice',front,back:q.correct_index==null?null:q.options[q.correct_index],
        options:q.options.map((text,i)=>({text,correct:i===q.correct_index,extra:i===q.correct_index&&q.explanation?[q.explanation]:[]})),
        explanation:q.explanation?[q.explanation]:[],specialty:q.specialty,topic:q.topic,subtopic:q.subtopic,section:q.section,
        classification_origin:'pdf_content_inference',source:archiveName+'/PDF',sources:[archiveName+'/PDF'],context:[],
        archive_name:archiveName,content_use:'study',import_intent:'combined',images:getImages(front)};
      card.uid=stableUid(card);card.content_hash=contentHash(card);cards.push(card);
    }
    document.getElementById('bankResetBtn').onclick();go('import');return cards;
  };

})();
