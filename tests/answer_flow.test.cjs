const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=process.env.NEXMIR_SCREENSHOT_DIR||path.join(require('node:os').tmpdir(),'nexmir-515');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let name=decodeURIComponent(req.url.split('?')[0]);if(name.endsWith('/'))name+='index.html';const file=path.join(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(fs.readFileSync(file))});
function seed(){
 document.querySelector('#bootScreen').classList.add('hidden');document.querySelector('#authScreen').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');
 state.user={id:'local-flow-test',email:'fixture@example.test'};state.profile={display_name:'Andrea',role:'admin',plan:'pro'};
 state.questions=Array.from({length:15},(_,i)=>({id:'q'+i,_source:i===1?'remnote':'questions',specialty:'Cardiología',topic:'Hipertensión arterial',stem:i===0?'Varón de 55 años consulta por cefalea moderada e insomnio. Al examen: PA 145/95 mmHg. Se solicita un MAPA, el cual muestra mediciones de presión dentro de lo normal. ¿Cómo se clasifica esta hipertensión arterial?':'Pregunta '+(i+1)+'. Seleccione la alternativa correcta.',options:['Enmascarada','Ficticia','Secundaria','De bata blanca'],correct_index:3,explanation:'Explicación de prueba para verificar el flujo de estudio.'}));
 // The second question exercises the real RemNote adapter, not an invalid source alias.
 const rem=state.questions.splice(1,1)[0];state.content=[{id:rem.id,kind:'card',card_type:'multiple_choice',specialty:rem.specialty,topic:rem.topic,payload:{front:rem.stem,options:rem.options.map((text,i)=>({text,correct:i===3}))}}];
 document.documentElement.dataset.palette='blue';document.documentElement.dataset.themeMode='light';
 window.localAttempts=[];window.failAttemptNumber=null;
 state.sb={from:table=>({upsert:row=>({select:()=>({single:async()=>({data:row,error:null})})}),insert:row=>({select:()=>({single:async()=>{if(table!=='user_question_attempts')throw Error('Unexpected table '+table);if(window.failAttemptNumber===window.localAttempts.length)return {error:{message:'fallo simulado'}};const data={...row,id:'saved-'+window.localAttempts.length};window.localAttempts.push(data);return {data,error:null}}})})})};
}
function startBankFixture(mode='end'){
 const all=questionPool(),pool=[all.find(q=>q.id==='q0'),all.find(q=>q._source==='remnote'),all.find(q=>q.id==='q2')];state.bank={pool,index:0,mode,answers:{},highlights:{},eliminations:{},results:[],context:'bank',submitted:false};showQuestion();
}
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
 const errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',r=>r.request().url().startsWith(base)||r.request().url().startsWith('data:')?r.continue():r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#authScreen').classList.contains('hidden'));await page.evaluate(seed);await page.evaluate(startBankFixture);
  assert.equal(await page.getByRole('button',{name:'Guardar respuesta',exact:true}).count(),0);
  await page.locator('.answer-choice').nth(1).click();
  assert.equal(await page.locator('#bankAnswerCounts').textContent(),'1 respondidas · 2 pendientes');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nexmir_study_resume:local-flow-test')).bank.answers[bankQKey(state.bank.pool[0])].selected),1);
  await page.locator('[data-bank-nav="next"]').click();await page.keyboard.press('4');await page.locator('[data-bank-nav="previous"]').click();
  assert.equal(await page.locator('.answer-choice[aria-checked=true]').count(),1);assert.equal(await page.evaluate(()=>state.bank.selected),1);
  await page.locator('.answer-choice').nth(1).focus();await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>state.bank.selected),2);
  await page.locator('.discard-btn').nth(2).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>state.bank.selected),null);
  await page.locator('.discard-btn').nth(2).click();await page.locator('.answer-choice').nth(2).click();
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#authScreen').classList.contains('hidden'));await page.evaluate(seed);await page.evaluate(()=>nexmirRestoreStudy());await page.waitForFunction(()=>document.querySelector('#bankStem'));
  assert.equal(await page.evaluate(()=>state.bank.selected),2);assert.equal(await page.locator('#bankAnswerCounts').textContent(),'2 respondidas · 1 pendientes');
  await page.getByRole('button',{name:'Cerrar banqueo'}).click();await page.evaluate(()=>route('bank'));await page.getByRole('button',{name:'Continuar banqueo'}).click();await page.waitForFunction(()=>document.querySelector('#questionDialog').open);
  assert.equal(await page.evaluate(()=>state.bank.selected),2);
  console.log('PASS autosave, counters, next/back, arrows, discard, reload, close/resume');

  await page.evaluate(()=>{window.failAttemptNumber=1});await page.getByRole('button',{name:'Finalizar y enviar',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#planLoadingDialog').open);
  assert.equal(await page.evaluate(()=>state.bank.submitted),false);assert.equal(await page.evaluate(()=>window.localAttempts.length),1);
  await page.evaluate(()=>{window.failAttemptNumber=null});await page.getByRole('button',{name:'Finalizar y enviar',exact:true}).click();await page.waitForFunction(()=>state.bank.submitted);
  assert.equal(await page.evaluate(()=>window.localAttempts.length),2);assert.equal(await page.locator('.bank-review-nav-btn.blank').count(),1);
  assert.equal(await page.evaluate(()=>window.localAttempts[1].source_content_id),'q1');
  console.log('PASS failed delivery retains answers; retry sends only pending attempts');

  await page.evaluate(()=>document.querySelector('#questionDialog').close());await page.evaluate(startBankFixture,'immediate');await page.keyboard.press('2');
  assert.equal(await page.evaluate(()=>state.bank.answered),false);assert.equal(await page.locator('#qFeedback').textContent(),'');
  await page.getByRole('button',{name:'Responder',exact:true}).click();await page.waitForFunction(()=>state.bank.answered);
  const persisted=await page.evaluate(()=>window.localAttempts.length);await page.keyboard.press('3');assert.equal(await page.evaluate(()=>state.bank.selected),1);
  await page.locator('[data-bank-nav="next"]').click();await page.keyboard.press('4');await page.getByRole('button',{name:'Finalizar y enviar',exact:true}).click();await page.waitForFunction(()=>state.bank.submitted);
  assert.equal(await page.evaluate(()=>window.localAttempts.length),persisted+1);
  console.log('PASS immediate feedback preserved; selected unconfirmed answer submitted once at finish');

  await page.evaluate(()=>document.querySelector('#questionDialog').close());await page.evaluate(startBankFixture);
  await page.evaluate(()=>{window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('nexmir_study_resume:'))throw new DOMException('quota','QuotaExceededError');return window.realSetItem.call(this,k,v)}});
  await page.locator('.answer-choice').nth(0).click();assert.equal(await page.evaluate(()=>state.bank.selected),0);assert.match(await page.locator('#bankSelectionStatus').textContent(),/no se pudo guardar/);
  await page.evaluate(()=>{Storage.prototype.setItem=window.realSetItem});await page.locator('.answer-choice').nth(1).click();assert.match(await page.locator('#bankSelectionStatus').textContent(),/Selección guardada/);
  console.log('PASS local storage failure keeps selection, reports limitation, recovers');

  await page.evaluate(()=>{document.querySelector('#questionDialog').close();window.scrollTo(0,800);startMirSimulation(15)});
  const checkSimViewport=async label=>{await page.waitForTimeout(200);const g=await page.locator('#simDialog').evaluate(d=>{const a=d.getBoundingClientRect(),head=d.querySelector('.sim-top').getBoundingClientRect();return {top:a.top,bottom:a.bottom,headTop:head.top,headBottom:head.bottom,overflow:getComputedStyle(d).overflowY,scrollTop:d.scrollTop,viewport:innerHeight}});assert(g.top>=-1&&g.bottom<=g.viewport+1&&g.headTop>=g.top-1&&g.headBottom<=g.viewport,`${label} simulation clipped: ${JSON.stringify(g)}`);assert.equal(g.overflow,'hidden');assert.equal(g.scrollTop,0)};
  for(const width of [1920,1440,390]){await page.setViewportSize({width,height:width===390?844:1000});await checkSimViewport(`start ${width}`)}
  await page.setViewportSize({width:1440,height:1000});assert.equal(await page.locator('#simDialog .admin-delete-question').count(),1);await page.screenshot({path:path.join(out,'simulation-start.png')});
  await page.locator('#simDialog .answer-choice').nth(3).click();await page.locator('#simDialog').getByRole('button',{name:'Siguiente →',exact:true}).click();await page.keyboard.press('2');await page.locator('#simDialog').getByRole('button',{name:'← Anterior',exact:true}).click();
  assert.equal(await page.locator('#simDialog [aria-checked=true]').count(),1);assert.equal(await page.evaluate(()=>state.simulation.answers[simQKey(state.simulation.pool[0])]),3);
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#authScreen').classList.contains('hidden'));await page.evaluate(seed);await page.evaluate(()=>resumeMirSimulation());await page.waitForFunction(()=>document.querySelector('#simDialog').open);
  await checkSimViewport('resume');assert.equal(await page.locator('#simDialog .admin-delete-question').count(),1);await page.screenshot({path:path.join(out,'simulation-resume.png')});
  assert.equal(await page.locator('#simDialog [aria-checked=true]').count(),1);await page.locator('#simDialog .answer-choice').nth(0).focus();await page.keyboard.press('End');assert.equal(await page.locator('#simDialog .answer-choice').nth(3).getAttribute('aria-checked'),'true');
  console.log('PASS simulation autosave, navigation, reload, keyboard');

  await page.evaluate(()=>{document.querySelector('#simDialog').close();clearInterval(simTimerHandle);state.simulation.active=false;clearPersistedSimulation()});await page.evaluate(startBankFixture);await page.keyboard.press('2');
  for(const width of [1440,1024,768,390,320]){
   await page.setViewportSize({width,height:width<700?844:1000});
   const geometry=await page.locator('#questionDialog').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,rect:el.getBoundingClientRect().toJSON()}));
   assert(geometry.scroll<=geometry.width+1,`question overflow ${width}: ${JSON.stringify(geometry)}`);
   assert(geometry.rect.x>=-1&&geometry.rect.right<=width+1,`question viewport ${width}`);
   const close=await page.getByRole('button',{name:'Cerrar banqueo'}).boundingBox();assert(close.x+close.width<=width-4,`close button viewport ${width}: ${JSON.stringify(close)}`);
   const aligned=await page.locator('.discard-btn').first().evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom});assert(aligned,'discard remains inside option');
   if(width===1440||width===390)await page.screenshot({path:path.join(out,`question-${width}.png`)});
  }
  await page.setViewportSize({width:1440,height:1000});
  const contrast=[];
  for(const mode of ['light','dark'])for(const palette of ['blue','green','orange','pink']){
   await page.evaluate(({mode,palette})=>{document.documentElement.dataset.themeMode=mode;document.documentElement.dataset.palette=palette},{mode,palette});
   await page.waitForTimeout(220); // Measure the settled theme, not a color-transition frame.
   const ratio=await page.locator('[data-bank-nav="next"]').evaluate(el=>{
    const s=getComputedStyle(el),parse=x=>x.match(/[\d.]+/g).slice(0,3).map(Number),lum=x=>parse(x).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0),a=lum(s.color),b=lum(s.backgroundColor);return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),bg:s.backgroundImage,color:s.color,background:s.backgroundColor};
   });contrast.push({mode,palette,...ratio});assert(ratio.ratio>=4.5,JSON.stringify(contrast.at(-1)));assert.equal(ratio.bg,'none');
  }
  fs.writeFileSync(path.join(out,'contrast.json'),JSON.stringify(contrast,null,2));
  await page.screenshot({path:path.join(out,'question-dark.png')});await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#questionDialog').evaluate(el=>getComputedStyle(el).animationName),'none');
  console.log('PASS responsive 320–1440px; discard alignment; all eight button palette contrasts; reduced motion');

  await page.evaluate(()=>{document.querySelector('#questionDialog').close();document.documentElement.dataset.themeMode='light';document.documentElement.dataset.palette='blue'});
  for(const width of [1440,768,390]){
   await page.setViewportSize({width,height:1000});
   for(const view of ['dashboard','study','focus','reviews','bank','simulations','errors','bookmarks','progress','goal','calendar','profile']){
    await page.evaluate(v=>route(v),view);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`${view} overflow ${width}`);
    if(width===1440&&['dashboard','focus','bank','profile'].includes(view)||width===390&&view==='dashboard')await page.screenshot({path:path.join(out,`${view}-${width}.png`),fullPage:true});
   }
  }
  console.log('PASS student routes at desktop, tablet, mobile');
  const admin=await context.newPage();admin.on('pageerror',e=>errors.push(e.message));await admin.goto(base+'/admin/');await admin.waitForFunction(()=>typeof go==='function');
  for(const width of [1440,768,390]){
   await admin.setViewportSize({width,height:1000});
   for(const view of ['dashboard','import','bankimport','simimport','content','history']){
    await admin.evaluate(v=>go(v),view);assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`admin ${view} overflow ${width}`);
    if(view==='dashboard'||view==='import')await admin.screenshot({path:path.join(out,`admin-${view}-${width}.png`),fullPage:true});
   }
  }
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{window.deleted=[];state.sb.rpc=async(name,args)=>{window.deleted.push({name,args});return {data:true,error:null}}});await page.evaluate(startBankFixture);
  assert.equal(await page.locator('#questionDialog .admin-delete-question').count(),1);
  await page.locator('#questionDialog .admin-delete-question').click();await page.waitForFunction(()=>!state.questions.some(q=>q.id==='q0'));
  assert.equal(await page.evaluate(()=>window.deleted[0].args.p_kind),'question');
  assert.equal(await page.locator('#questionDialog .admin-delete-question').count(),1);
  await page.locator('#questionDialog .admin-delete-question').click();await page.waitForFunction(()=>!state.content.some(c=>c.id==='q1'));
  assert.equal(await page.evaluate(()=>window.deleted[1].args.p_kind),'content');
  assert.equal(await page.evaluate(()=>state.bank.pool.length),1);
  await page.evaluate(()=>{document.querySelector('#questionDialog').close();startMirSimulation(10)});
  const deletedSimKey=await page.evaluate(()=>simQKey(state.simulation.pool[state.simulation.index]));
  await page.locator('#simDialog .admin-delete-question').click();await page.waitForFunction(k=>!state.simulation.pool.some(q=>simQKey(q)===k),deletedSimKey);
  assert.equal(await page.evaluate(()=>state.simulation.pool.length),9);
  assert.equal(await page.evaluate(()=>state.simulation.primaryCount),9);
  assert.equal(await page.locator('#simDialog .admin-delete-question').count(),1);
  console.log('PASS admin deletion from bank uses guarded question/content RPC and advances the active session');
  assert.deepEqual(errors,[]);console.log('PASS admin routes and no browser script errors');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1});
