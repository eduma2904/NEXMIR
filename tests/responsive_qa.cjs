const { chromium } = require('playwright');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { tmpdir } = require('node:os');
const assert = require('node:assert/strict');
const root = join(__dirname, '..');
const mockSupabase='window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({})}})}';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/tmp/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const [width,height] of [[320,568],[375,667],[390,844],[430,932],[667,375],[844,390],[768,1024],[1024,768],[1366,768],[1920,1080],[3840,2160]]) {
      const collision=(a,b)=>a.x<b.right-1 && a.right>b.x+1 && a.y<b.bottom-1 && a.bottom>b.y+1;
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion:'reduce' });
      await page.route('**/vendor/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:mockSupabase}));
      await page.goto(pathToFileURL(join(root,'index.html')).href);
      await page.waitForSelector('#authScreen:not(.hidden)');
      assert.equal(await page.locator('#configBtn,#configDialog').count(), 0);
      await page.locator('[data-password-toggle="loginPassword"]').click();
      assert.equal(await page.locator('#loginPassword').getAttribute('type'), 'text');
      await page.locator('[data-password-toggle="loginPassword"]').click();
      assert.equal(await page.locator('#loginPassword').getAttribute('type'), 'password');
      await page.evaluate(() => {
        document.querySelector('#authScreen').classList.add('hidden');
        document.querySelector('#app').classList.remove('hidden');
        document.querySelector('#view-dashboard').classList.add('active');
        document.querySelector('#view-dashboard').innerHTML = `<div class="home-split"><section class="home-section home-question"><span class="home-question-badge">Pregunta del día · ANATOMÍA Y FISIOLOGÍA DEL CORAZÓN</span><h4>¿Cuándo alcanza su valor máximo el flujo sanguíneo coronario del ventrículo izquierdo?</h4><div class="home-options"><div class="home-option">A. Al comienzo de la diástole.</div><div class="home-option">B. Al comienzo de la sístole isovolumétrica.</div></div><button class="btn primary">Resolver ahora</button></section><section class="home-section">Actividad de estudio</section></div>`;
      });
      const overflow = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, width: innerWidth, badge: document.querySelector('.home-question-badge').getBoundingClientRect().right }));
      assert.ok(overflow.doc <= width + 1 && overflow.body <= width + 1 && overflow.badge <= width, `dashboard overflow ${width}: ${JSON.stringify(overflow)}`);
      if (width === 390) await page.screenshot({path:join(tmpdir(),'nexmir-mobile-dashboard-qa.png')});
      await page.evaluate(() => {
        state.user = { id: 'responsive-local', email: 'test@example.org' };
        state.profile = { role: 'user', plan: 'free', display_name: 'Test' };
        state.questions = [{id:'responsive-q',stem:'Paciente con cuadro de dolor y diagnóstico de prueba',specialty:'Cardiología',topic:'Anatomía y fisiología del corazón',options:['Primera respuesta','Segunda respuesta','Tercera respuesta','Cuarta respuesta'],correct_index:0}];
        state.content = [{id:'responsive-card',kind:'card',specialty:'Cardiología',topic:'Fisiología',payload:{front:'Pregunta de estudio',back:'Respuesta de estudio'}}];
      });
      for (const view of ['dashboard','study','focus','reviews','bank','simulations','battles','errors','bookmarks','progress','goal','calendar','profile']) {
        await page.evaluate(view => route(view), view);
        const result = await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,error:!!document.querySelector('.view.active .view-error')}));
        assert.ok(!result.error && result.scroll <= width + 1, `${view} ${width}px: ${JSON.stringify(result)}`);
      }
      if(width===390||width===667)await page.evaluate(()=>document.documentElement.dataset.themeMode='dark');
      await page.evaluate(() => {
        const q = document.querySelector('#questionDialog');
        q.querySelector('#questionDialogBody').innerHTML = `<div class="dialog-head"><h2>Pregunta 1</h2><button class="icon-btn">×</button></div><div class="bank-question-workspace has-question-image"><div class="bank-question-reading"><div class="question-stem">Paciente con un enunciado clínico largo que debe envolver el texto correctamente</div><div class="question-image-wrap"><img class="question-image" src="assets/hero-blue.svg"></div></div><div class="bank-question-options"><div class="mcq-options"><div class="mcq-option discardable"><button class="answer-choice">A. Primera alternativa</button><button class="discard-btn">Descartar</button></div></div></div></div><div class="bank-nav-actions"><button class="btn">Anterior</button><button class="btn">Siguiente</button></div>`;
        q.showModal();
      });
      const question = await page.locator('#questionDialog').evaluate(el => ({width:el.getBoundingClientRect().width, doc:document.documentElement.scrollWidth, scroll:el.querySelector('.bank-question-workspace').scrollHeight, client:el.querySelector('.bank-question-workspace').clientHeight}));
      assert.ok(question.width <= width + 1 && question.doc <= width + 1, `question overflow ${width}: ${JSON.stringify(question)}`);
      const open = await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map(d => d.id));
      assert.deepEqual(open, ['questionDialog'], `Unexpected modal layer at ${width}px: ${open}`);
      await page.locator('#questionDialog .dialog-head .tutorial-dialog-help').waitFor();
      const questionHeader=await page.locator('#questionDialog .dialog-head').evaluate(el=>{const h=el.querySelector('.tutorial-dialog-help').getBoundingClientRect(),c=el.querySelector('.icon-btn').getBoundingClientRect();return {h,c}});
      assert.ok(!collision(questionHeader.h,questionHeader.c),`question header ${width}x${height}`);
      if (width === 390) await page.screenshot({path:join(tmpdir(),'nexmir-mobile-question-qa.png')});
      await page.evaluate(() => {
        document.querySelector('#questionDialog').close();
        const card = document.querySelector('#cardDialog');
        card.querySelector('#cardDialogBody').innerHTML = `<div class="dialog-head flash-dialog-head"><div>Flashcard · Cardiología</div><button class="icon-btn">×</button></div><div class="flash-study-layout"><div class="flash-prompt-panel"><div class="flash-front">¿En qué momento ocurre el flujo sanguíneo coronario máximo?</div></div><div class="flash-answer-panel"><div class="flash-back">Durante la diástole, especialmente al comienzo.</div><div class="rating-grid"><button>Otra vez</button><button>Difícil</button><button>Bien</button><button>Fácil</button></div></div></div>`;
        card.showModal();
      });
      const flash = await page.locator('#cardDialog').evaluate(el => ({width:el.getBoundingClientRect().width, scroll:document.documentElement.scrollWidth}));
      assert.ok(flash.width <= width + 1 && flash.scroll <= width + 1, `flashcard overflow ${width}: ${JSON.stringify(flash)}`);
      await page.locator('#cardDialog .dialog-head .tutorial-dialog-help').waitFor();
      const cardHeader=await page.locator('#cardDialog .dialog-head').evaluate(el=>{const h=el.querySelector('.tutorial-dialog-help').getBoundingClientRect(),c=el.querySelector('.icon-btn').getBoundingClientRect();return {h,c}});
      assert.ok(!collision(cardHeader.h,cardHeader.c),`flashcard header ${width}x${height}`);
      await page.evaluate(() => {
        document.querySelector('#cardDialog').close();
        const sim = document.querySelector('#simDialog');
        sim.querySelector('#simDialogBody').innerHTML = `<div class="sim-shell"><div class="sim-top"><div class="grow"><div class="sim-title">Mini-MIR</div><div class="sim-counter">8 de 15 · Pediatría › DIARREA</div></div><div id="simTimer" class="sim-timer">00:39:59</div><button class="icon-btn" aria-label="Cerrar simulacro">×</button></div><div class="sim-body"><div class="sim-question"><div class="highlight-toolbar"><button class="btn">Resaltar</button><button class="btn">Quitar resaltado</button><span>Teclado 1–5 para responder</span></div><div class="sim-stem">Lactante de 8 meses, presenta desde hace 2 días diarrea, vómitos e hiporexia. ¿Qué alteración electrolítica explica el compromiso del sensorio?</div><div class="sim-options">${Array.from({length:8},(_,i)=>`<div class="sim-option"><button class="answer-choice">${i+1}. Alternativa larga con texto clínico de demostración</button></div>`).join('')}</div></div><aside class="sim-side">Mapa de preguntas</aside></div><div class="sim-bottom"><button class="btn">← Anterior</button><button class="btn">Dejar en blanco</button><button class="btn">★ Marcar</button><div class="spacer"></div><button class="btn primary">Siguiente →</button><button class="btn">Entregar</button><button class="btn">Reportar contenido</button><button class="btn danger">Eliminar pregunta</button></div></div>`;
        sim.showModal();
      });
      await page.locator('#simDialog .sim-top .tutorial-dialog-help').waitFor();
      const sim = await page.locator('#simDialog').evaluate(el => {
        const rect=selector=>{const r=el.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
        return {width:el.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth,contentHeight:el.querySelector('.sim-question').clientHeight,scrollHeight:el.querySelector('.sim-question').scrollHeight,footer:rect('.sim-bottom'),timer:rect('.sim-timer'),help:rect('.tutorial-dialog-help'),close:rect('.sim-top>.icon-btn')};
      });
      assert.ok(sim.width <= width + 1 && sim.scroll <= width + 1 && sim.contentHeight >= 80 && sim.footer.bottom <= height + 1 && !collision(sim.help,sim.timer) && !collision(sim.help,sim.close) && sim.help.right <= width + 1, `simulation layout ${width}x${height}: ${JSON.stringify(sim)}`);
      if(width===390||width===667)await page.screenshot({path:join(tmpdir(),`nexmir-simulation-${width}x${height}.png`)});
      await page.evaluate(() => {
        const dialog=document.querySelector('#simDialog');dialog.close();
        dialog.querySelector('#simDialogBody').innerHTML=`<div class="sim-results-shell"><div class="sim-results-top"><div class="dialog-head"><div><span class="chip">Entregado</span><h2>Resultado · Mini-MIR de Pediatría</h2></div><button class="icon-btn">×</button></div><div class="sim-result-grid"><div class="sim-result-card"><strong>8</strong><span>Correctas</span></div><div class="sim-result-card"><strong>4</strong><span>Incorrectas</span></div><div class="sim-result-card"><strong>3</strong><span>Blancas</span></div><div class="sim-result-card"><strong>6,67</strong><span>Netas</span></div></div></div><div class="sim-review-workspace"><aside class="sim-review-sidebar"><div class="sim-review-nav"><button class="sim-review-nav-btn">Pregunta 1</button></div></aside><main class="sim-review-detail">Explicación y respuesta de la pregunta</main></div></div>`;
        dialog.showModal();
      });
      await page.locator('#simDialog .sim-results-top .tutorial-dialog-help').waitFor();
      const review=await page.evaluate(()=>{const d=document.querySelector('#simDialog'),help=d.querySelector('.tutorial-dialog-help').getBoundingClientRect(),close=d.querySelector('.sim-results-top .icon-btn').getBoundingClientRect();return {help:{x:help.x,y:help.y,right:help.right,bottom:help.bottom},close:{x:close.x,y:close.y,right:close.right,bottom:close.bottom},doc:document.documentElement.scrollWidth}});
      assert.ok(review.doc<=width+1 && !collision(review.help,review.close),`review header ${width}x${height}: ${JSON.stringify(review)}`);
      await page.close();
      const admin = await browser.newPage({ viewport: { width, height } });
      await admin.goto(pathToFileURL(join(root,'admin','index.html')).href);
      const adminBox = await admin.evaluate(() => ({ doc:document.documentElement.scrollWidth, width:innerWidth, nav:document.querySelector('.sidebar').getBoundingClientRect().height }));
      assert.ok(adminBox.doc <= width + 1 && (width > 900 || adminBox.nav < 220), `admin overflow ${width}: ${JSON.stringify(adminBox)}`);
      for(const view of ['dashboard','import','questions','content','grouping','simmanager','reports','suggestions','history','users','bankimport','simimport']){
        await admin.evaluate(view=>go(view),view);
        const adminScroll=await admin.evaluate(()=>document.documentElement.scrollWidth);
        assert.ok(adminScroll<=width+1,`admin ${view} overflow ${width}x${height}: ${adminScroll}`);
      }
      await admin.close();
      console.log(`PASS responsive/auth ${width}x${height}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
