const {chromium}=require('playwright');
const assert=require('node:assert/strict');

const base=process.env.NEXMIR_TEST_URL||'http://127.0.0.1:4173';
function samplePdf(){
  const lines=[];
  for(let n=1;n<=6;n++)lines.push(`${n}. Pregunta asociada a la imagen ${n}: Paciente del caso clinico ${n} con dolor toracico. Cual es la respuesta correcta?`,'1. Primera respuesta','2. Segunda respuesta','3. Tercera respuesta','4. Cuarta respuesta','Respuesta correcta: 1','Comentario: Explicacion de cardiologia del caso.');
  const text='BT /F1 8 Tf 12 TL 30 780 Td\n'+lines.map((line,i)=>(i?'T* ':'')+'('+line+') Tj').join('\n')+'\nET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 620 820] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`];
  let pdf='%PDF-1.4\n',offsets=[0];
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`});
  const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Root 1 0 R /Size ${objects.length+1} >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf).toString('base64');
}
async function main(){
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1365,height:900}});
  const errors=[];
  context.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())});
  // Only the local app and pinned library files are permitted. No live Supabase writes.
  await context.route('**/*',async route=>{
    const url=route.request().url();
    if(url.startsWith(base)||url.startsWith('data:'))return route.continue();
    return route.abort();
  });
  const page=await context.newPage();await page.goto(base);await page.waitForFunction(()=>document.getElementById('authScreen').classList.contains('hidden')===false);
  await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=800;const c=canvas.getContext('2d');c.fillStyle='#729ad1';c.fillRect(0,0,1000,800);c.fillStyle='#fff';c.font='80px sans-serif';c.fillText('Imagen de prueba',100,400);
    const image=canvas.toDataURL('image/png');
    state.bank={pool:[{id:'one',stem:'Pregunta con una imagen insertada ![Imagen de prueba]('+image+')',options:['Primera','Segunda','Tercera','Cuarta'],correct_index:0,_source:'questions'},{id:'two',stem:'Segunda pregunta',options:['Primera','Segunda'],correct_index:1,_source:'questions'}],index:0,mode:'immediate',answers:{},highlights:{},eliminations:{},results:[]};
    showQuestion();
  });
  await page.locator('#bankStem .inline-image-zoom').click();await page.waitForFunction(()=>document.getElementById('imageViewerImg').naturalWidth===1000);
  assert.equal(await page.locator('#imageViewerDialog').evaluate(el=>el.open),true);
  await page.locator('[data-image-action="actual"]').click();await page.locator('[data-image-action="in"]').click();
  assert.equal(await page.locator('#imageViewerImg').evaluate(el=>Math.round(el.getBoundingClientRect().width)),1250);
  await page.keyboard.press('1');assert.equal(await page.evaluate(()=>state.bank.selected),null);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#questionDialog').evaluate(el=>el.open),true);
  console.log('PASS inline images open a zoomable viewer; viewer keys do not answer questions');

  async function shrink(){
    const before=await page.locator('#questionDialog').boundingBox();
    const grip=page.locator('#questionDialog > .resize-grip');await grip.scrollIntoViewIfNeeded();const box=await grip.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-160,box.y+box.height/2-100,{steps:8});await page.mouse.up();
    const after=await page.locator('#questionDialog').boundingBox();assert.ok(after.width<before.width-100);assert.ok(after.height<before.height-50);
  }
  await shrink();await page.evaluate(()=>{state.bank.index=1;showQuestion()});await shrink();
  const width=await page.locator('#questionDialog').evaluate(el=>el.getBoundingClientRect().width);await page.locator('#questionDialog > .resize-grip').focus();await page.keyboard.press('ArrowLeft');
  assert.ok(await page.locator('#questionDialog').evaluate(el=>el.getBoundingClientRect().width)<width);
  console.log('PASS popup resizes by drag and keyboard, including after replacing the question');
  await page.setViewportSize({width:390,height:844});assert.equal(Math.round(await page.locator('#questionDialog').evaluate(el=>el.getBoundingClientRect().width)),390);
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'nexmir-mobile.png')});await page.setViewportSize({width:1365,height:900});await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'nexmir-question.png')});
  await page.evaluate(()=>{
    state.content=[{id:'basic',kind:'card',card_type:'basic',payload:{front:'Básica',back:'Respuesta',content_use:'simulation'}},{id:'two-choice',kind:'card',card_type:'multiple_choice',payload:{front:'Dos alternativas',options:[{text:'A',correct:true},{text:'B'}]}},{id:'five-choice',kind:'card',card_type:'multiple_choice',payload:{front:'Cinco alternativas',options:['A','B','C','D','E'].map((text,i)=>({text,correct:i===4}))}}];state.questions=[];
  });
  assert.deepEqual(await page.evaluate(()=>questionPool().map(q=>q.id)),['two-choice','five-choice']);
  assert.equal(await page.evaluate(()=>simulationCandidates().length),2);
  assert.equal(await page.evaluate(()=>studyContent().some(x=>x.id==='basic')),true);
  console.log('PASS 2/5-option MCQ work in bank and simulations; ordinary cards remain in study');

  const battleIds=await page.evaluate(async()=>{
    state.user={id:'local-test-user'};state.profile={role:'admin',plan:'pro'};
    state.questions=Array.from({length:5},(_,i)=>({id:'battle-'+i,stem:'Pregunta de batalla '+i,options:Array.from({length:i===0?2:i===1?5:4},(_,n)=>'Alternativa '+n),correct_index:0}));
    state.questions.push({...state.questions[0],id:'duplicate'},{id:'invalid',stem:'Sin alternativas',options:[],correct_index:0});
    let ids=[];state.sb={from:table=>({insert:row=>{if(table!=='battle_rooms')throw Error('Unexpected write');ids=row.question_ids;return{select:()=>({single:async()=>({error:{message:'Prueba local sin publicar'}})})}}})};
    await window.createBattle();return ids;
  });
  assert.equal(new Set(battleIds).size,5);assert.ok(!battleIds.includes('invalid'));assert.ok(battleIds.includes('battle-1'));assert.ok(battleIds.includes('battle-0')||battleIds.includes('duplicate'));
  console.log('PASS battle creation uses complete deduplicated tests, including 2/5 alternatives, without a live write');

  const admin=await context.newPage();await admin.goto(base+'/admin/');await admin.waitForFunction(()=>!!window.NexmirSimImportReview);
  const md='# Cardiología\nContenido teórico sobre el corazón.\n\n- Primera pregunta con respuesta explicada >>A)\n    - Uno\n        - Explicación cardiológica de la primera opción.\n    - Dos\n    - Tres\n    - Cuatro\n- Segunda pregunta sin explicación >>A)\n    - Uno\n    - Dos\n    - Tres\n    - Cuatro\n    - Cinco\n- Flashcard simple >> Respuesta sencilla\n';
  const zipped=Buffer.from(await admin.evaluate(async text=>{const zip=new JSZip();zip.file('Cardiología/tema.md',text);zip.file('RemNoteExport/Untitled.md','- Concepto sin clasificar >> Respuesta');return zip.generateAsync({type:'base64'})},md),'base64');
  await admin.evaluate(()=>go('import'));await admin.locator('#fileInput').setInputFiles({name:'Material.zip',mimeType:'application/zip',buffer:zipped});
  await admin.locator('#intentContinue').waitFor();assert.equal(await admin.locator('[name="importIntent"]:checked').inputValue(),'combined');await admin.locator('#intentCancel').click();
  await admin.locator('#fileInput').setInputFiles({name:'Material.zip',mimeType:'application/zip',buffer:zipped});await admin.locator('#intentContinue').click();await admin.waitForFunction(()=>!!state.import&&!remnoteQueue.running);
  assert.equal(await admin.evaluate(()=>state.import.diffs.filter(d=>d.newValue.type==='multiple_choice').length),2);
  assert.equal(await admin.evaluate(()=>state.import.diffs.filter(d=>d.kind==='theory').length),1);
  assert.equal(await admin.evaluate(()=>state.import.diffs.filter(d=>d.newValue.type==='basic').length),2);
  await admin.locator('#statusTabs [data-status="review"]').click();
  const selected=await admin.evaluate(()=>state.selected.size);assert.equal(selected,1);
  await admin.locator('#importRepairSelected').click();await admin.locator('#freeClassUseMisc').click();await admin.locator('#freeClassApply').click();
  assert.equal(await admin.evaluate(()=>state.selected.size),0);
  await admin.locator('#statusTabs [data-status="all"]').click();await admin.locator('#importSelectAll').click();await admin.locator('#publishBtn').click();await admin.waitForFunction(()=>!state.import);
  assert.equal(await admin.evaluate(()=>Object.keys(state.db.cards).length),4);assert.equal(await admin.evaluate(()=>Object.keys(state.db.theory).length),1);
  console.log('PASS combined ZIP detects categories, cancel permits reselection, free classification and local publication work');

  // Use the real existing importers to exercise quality tabs and bulk deletion.
  for(const [prefix,view,input,apiName,tabs,check,count] of [
    ['bank','bankimport','bankRemnoteFile','NexmirBankImportReview','bankTabs','bankSelectVisible','bankSelectedCount'],
    ['sim','simimport','simRemnoteFile','NexmirSimImportReview','simImportTabs','simSelectVisible','simImportSelectedCount']]){
    await admin.evaluate(v=>go(v),view);await admin.locator(`#${prefix}SourceTabs [data-mode="remnote"]`).click();await admin.locator('#'+input).setInputFiles({name:'Cardiología.md',mimeType:'text/markdown',buffer:Buffer.from(md)});
    await admin.locator(`#${prefix}AnalyzeBtn`).click();await admin.waitForFunction(name=>window[name].rows().length===2,apiName);await admin.waitForFunction(name=>!window[name].busy(),apiName);
    assert.equal(await admin.evaluate(name=>window[name].rows()[1].options.length,apiName),5);
    await admin.locator(`#${tabs} [data-filter="problems"]`).click();
    assert.equal(await admin.evaluate(name=>window[name].filtered().length,apiName),1);assert.equal(await admin.evaluate(name=>window[name].selected().size,apiName),1);
    await admin.locator(`#${prefix}BulkClear`).click();await admin.locator('#'+check).check();
    assert.equal(await admin.evaluate(name=>window[name].selected().size,apiName),1);
    const keep=await admin.evaluate(name=>window[name].rows().find(q=>!window[name].selected().has(q.source_uid)).source_uid,apiName);
    await admin.locator(prefix==='sim'?'#simDeleteSelected':'#bankBulkDelete').click();
    assert.deepEqual(await admin.evaluate(name=>window[name].rows().map(q=>q.source_uid),apiName),[keep]);
    await admin.locator(`#${tabs} [data-filter="all"]`).click();await admin.locator('#'+check).check();
    await admin.locator(prefix==='sim'?'#simImportSearch':'#bankSearch').fill('sin coincidencias');
    assert.equal(await admin.evaluate(name=>window[name].selected().size,apiName),0);
    console.log('PASS '+prefix+' quality filters constrain selection, search and deletion; five options survive import');
  }
  const pdfZip=Buffer.from(await admin.evaluate(async data=>{const zip=new JSZip();zip.file('Prueba.pdf',data,{base64:true});return zip.generateAsync({type:'base64'})},samplePdf()),'base64');
  for(const intent of ['bank','simulation']){
    await admin.evaluate(()=>go('import'));await admin.locator('#fileInput').setInputFiles({name:'Preguntas.zip',mimeType:'application/zip',buffer:pdfZip});await admin.locator('#intentContinue').waitFor();await admin.locator(`[name="importIntent"][value="${intent}"]`).check();await admin.locator('#intentContinue').click();
    const api=intent==='bank'?'NexmirBankImportReview':'NexmirSimImportReview';
    await admin.waitForFunction(name=>window[name].rows().length===6&&!window[name].busy(),api);
    assert.equal(await admin.evaluate(name=>window[name].rows().every(NexmirContentRules.validTest),api),true);
    assert.equal(await admin.locator('#fileInput').inputValue(),'');
    console.log('PASS PDF ZIP routes to '+intent+' and parses six complete questions with local PDF.js worker');
  }
  const mixedZip=Buffer.from(await admin.evaluate(async({pdf,md})=>{const zip=new JSZip();zip.file('Prueba.pdf',pdf,{base64:true});zip.file('Cardiología/tema.md',md);return zip.generateAsync({type:'base64'})},{pdf:samplePdf(),md}),'base64');
  await admin.evaluate(()=>{state.db=emptyDb();state.import=null;resetImportQueue();go('import')});await admin.locator('#fileInput').setInputFiles({name:'Combinado.zip',mimeType:'application/zip',buffer:mixedZip});await admin.locator('#intentContinue').click();await admin.waitForFunction(()=>!!state.import&&!remnoteQueue.running);
  assert.equal(await admin.evaluate(()=>state.import.diffs.filter(d=>d.newValue.type==='multiple_choice').length),8);
  assert.equal(await admin.evaluate(()=>state.import.diffs.filter(d=>d.kind==='theory').length),1);
  assert.equal(await admin.evaluate(()=>state.import.diffs.filter(d=>d.newValue.type==='basic').length),1);
  console.log('PASS mixed PDF/Markdown ZIP produces a single review with tests, flashcards and theory');
  await admin.locator('#discardImportBtn').click();
  await admin.evaluate(()=>go('import'));await admin.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'nexmir-admin.png')});
  await admin.setViewportSize({width:390,height:844});assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await admin.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'nexmir-admin-mobile.png')});
  assert.deepEqual(errors,[]);console.log('PASS no browser script errors; admin layout fits mobile');
  await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1)});
