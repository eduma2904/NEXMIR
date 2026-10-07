const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=path.join(__dirname,'..');
class Element{
 constructor(){this.children=[];this.hidden=false;this.value='';this.dataset={};this.style={};this.events={};const classes=new Set();this.classList={add(x){classes.add(x)},remove(x){classes.delete(x)},toggle(x,v){if(v)classes.add(x);else classes.delete(x)},contains(x){return classes.has(x)}};this.tagName='DIV';this.textContent='';this.disabled=false}
 set innerHTML(v){this.html=v;this.children=[]}get innerHTML(){return this.html||''}
 appendChild(x){this.children.push(x);return x}replaceChildren(...xs){this.children=xs;this.value=xs[0]?.value||''}
 setAttribute(k,v){this[k]=v}focus(){this.doc.activeElement=this}addEventListener(k,f){this.events[k]=f}
 querySelectorAll(){return this.children}querySelector(){return null}remove(){}scrollIntoView(){}
}
function dom(){const nodes=new Map(),events={};const document={events,activeElement:{tagName:'BODY'},documentElement:{dataset:{}},body:{style:{},insertAdjacentHTML(){}},getElementById(id){if(!nodes.has(id)){const e=new Element;e.doc=document;nodes.set(id,e)}return nodes.get(id)},createElement(){const e=new Element;e.doc=document;return e},querySelector(sel){return this.getElementById(sel)},addEventListener(k,f){events[k]=f}};return {document,nodes}}
function game(){const {document}=dom(),messages=[],listeners={},parent={postMessage(x){messages.push(x)}};const context={document,parent,location:{origin:'https://nexmir.test'},console,setTimeout:f=>f(),matchMedia:()=>({matches:true,addEventListener(){}}),localStorage:{getItem(){return null}},Option:function(t,v=t){this.text=t;this.value=v},addEventListener(k,f){listeners[k]=f}};context.window=context;vm.createContext(context);const html=fs.readFileSync(path.join(base,'arcade/codigo-vital.html'),'utf8');vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);const run=s=>vm.runInContext(s,context);function init(questions){listeners.message({source:parent,origin:context.location.origin,data:{type:'nexmir:arcade-init',palette:'pink',mode:'dark',specialties:['Neumología','Cardiología'],questions}})}return{document,context,run,init,listeners,messages,parent}}
const q={answer:'PEÑA-ÁRBOL',specialty:'Neumología',category:'Perlas',clue:'Paciente ficticio. ¿Cuál es el término?',explanation:'Texto <img src=x onerror=alert(1)> de prueba.'};
test('Handshake, inherited theme, modal cancel preserves game and blocks guesses',()=>{const g=game();assert.equal(g.messages[0].type,'nexmir:arcade-ready');g.init([q]);assert.equal(g.document.documentElement.dataset.palette,'pink');assert.equal(g.document.getElementById('specialty-modal').hidden,false);g.run("guess('Z')");assert.equal(g.run('errors'),0);g.run("closeSpecialtyModal();guess('Z');openSpecialtyModal();closeSpecialtyModal()");assert.equal(g.run('errors'),1);assert.equal(g.run('specialty'),'Neumología');assert.equal(g.document.querySelector('main').inert,false)});
test('Spaces, accents, Ñ, win and escaped explanation',()=>{const g=game();g.init([q]);g.run('closeSpecialtyModal()');assert.equal(g.run('current.a'),'PEÑA-ARBOL');g.run("for(const ch of new Set(current.a)){if(LETTERS.includes(ch))guess(ch)}");assert.equal(g.run('won'),true);assert.equal(g.run('errors'),0);assert.ok(g.document.getElementById('result').innerHTML.includes('&lt;img'));assert.ok(!g.document.getElementById('result').innerHTML.includes('<img'))});
test('Six misses lose; hints cost one and disable on last attempt',()=>{const g=game();g.init([{...q,answer:'AAA'}]);g.run("closeSpecialtyModal();for(const ch of 'BCDEF')guess(ch)");assert.equal(g.run('errors'),5);assert.equal(g.document.getElementById('hint').disabled,true);g.run("hint();guess('G')");assert.equal(g.run('errors'),6);assert.equal(g.run('finished'),true);assert.equal(g.run('won'),false);const other=game();other.init([{...q,answer:'ABC'}]);other.run('closeSpecialtyModal();hint()');assert.equal(other.run('errors'),1);assert.equal(other.run('used.length'),1)});
test('Specialty and category filters remain within the selected pool',()=>{const g=game();g.init([q,{...q,answer:'OTRO',specialty:'Cardiología',category:'Pruebas'}]);g.run("chooseSpecialty('Cardiología')");assert.equal(g.run('current.a'),'OTRO');assert.equal(g.run('current.s'),'Cardiología');assert.equal(g.document.getElementById('topic').children[1].value,'Pruebas');g.run("chooseSpecialty('Unknown')");assert.equal(g.run('specialty'),'Cardiología')});
test('Cross-origin messages cannot replace game data; escape closes safely',()=>{const g=game();g.init([q]);g.listeners.message({source:g.parent,origin:'https://evil.test',data:{type:'nexmir:arcade-init',questions:[{...q,answer:'EVIL'}]}});assert.equal(g.run('current.a'),'PEÑA-ARBOL');g.document.events.keydown({key:'Escape'});assert.equal(g.document.getElementById('specialty-modal').hidden,true)});
test('Admin validation, role guard and no insertion on unauthorized access',()=>{const {document}=dom();let calls=0;const context={document,go(){},logoutCloud:async()=>{},cloudMode:true,sb:{from(){calls++;throw Error('No writes expected')}},cloudUser:{id:'test'},cloudRole:'moderator',RemnoteTaxonomy:{unclassified:x=>!x},console};context.window=context;vm.createContext(context);let code=fs.readFileSync(path.join(base,'admin/arcade_manager.js'),'utf8');code=code.replace(/\}\)\(\);\s*$/,'globalThis.check={allowed,valid,save};})();');vm.runInContext(code,context);assert.equal(context.check.allowed(),false);context.cloudRole='admin';assert.equal(context.check.allowed(),true);assert.equal(context.check.valid({specialty:'Neumología',answer:'PEÑA',clue:'¿Cuál es el diagnóstico?'}),'');assert.match(context.check.valid({specialty:'N',answer:'A2',clue:'¿Qué?'}),/letras/);context.cloudRole='moderator';context.check.save({preventDefault(){}});assert.equal(calls,0)});
test('SQL policies, repeat-safe seed and integration points',()=>{const sql=fs.readFileSync(path.join(base,'supabase/ARCADE.sql'),'utf8');assert.match(sql,/enable row level security/);assert.match(sql,/revoke all.*from anon/);assert.match(sql,/for all to authenticated.*role='admin'.*with check/s);assert.match(sql,/on conflict\(id\) do nothing/);assert.equal((sql.match(/a7cade00-0000-4000-8000-/g)||[]).length,16);for(const file of ['index.html','admin/index.html'])assert.ok(fs.readFileSync(path.join(base,file),'utf8').includes('data-view="arcade"'));assert.ok(fs.readFileSync(path.join(base,'tutorial.js'),'utf8').includes("['arcade'"))});

test('Multiterm answer preserves spaces; image and full criteria appear only after reveal',()=>{
 const g=game();g.init([{...q,answer:'PROTEINOSIS ALVEOLAR',explanation:'Exudado: uno de tres.\nTrasudado: ninguno.',answer_image_url:'https://nexmir.test/signed/image.png'}]);
 g.run('closeSpecialtyModal()');assert.equal(g.run('current.a'),'PROTEINOSIS ALVEOLAR');assert.ok(g.document.getElementById('word').innerHTML.includes('word-separator'));
 assert.ok(!g.document.getElementById('result').innerHTML.includes('<img'));
 g.run("for(const ch of new Set(current.a)){if(LETTERS.includes(ch))guess(ch)}");
 assert.ok(g.document.getElementById('result').innerHTML.includes('alt="Imagen de la respuesta: PROTEINOSIS ALVEOLAR"'));
 assert.ok(g.document.getElementById('result').innerHTML.includes('Trasudado: ninguno.'));
});
test('Escape inside expanded game requests exit and preserves the ongoing round',()=>{
 const g=game();g.init([q]);g.run("closeSpecialtyModal();guess('Z');openSpecialtyModal()");
 g.listeners.message({source:g.parent,origin:g.context.location.origin,data:{type:'nexmir:arcade-fullscreen',expanded:true}});
 let prevented=false;g.document.events.keydown({key:'Escape',preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(g.messages.at(-1).type,'nexmir:arcade-exit-fullscreen');assert.equal(g.run('errors'),1);assert.equal(g.document.getElementById('specialty-modal').hidden,false);
});
test('Admin accepts optional topic and image; seed migration keeps edits and comparative criteria',()=>{
 const {document}=dom(),f=document.getElementById('arcadeForm');f.elements={};for(const key of ['specialty','topic','category','answer','clue','explanation','published'])f.elements[key]={value:'',checked:false};
 const context={document,go(){},logoutCloud:async()=>{},cloudMode:true,sb:{},cloudUser:{id:'1'},cloudRole:'admin',state:{db:{cards:{},theory:{}}},RemnoteTaxonomy:{canonical:x=>x,unclassified:x=>!x},esc:x=>String(x),console};context.window=context;
 const code=fs.readFileSync(path.join(base,'admin/arcade_manager.js'),'utf8').replace(/\}\)\(\);\s*$/,'globalThis.check={values,valid,updateTopics,imageFileError};})();');vm.createContext(context);vm.runInContext(code,context);
 f.elements.specialty.value='Neumología';f.elements.answer.value='Proteinosis alveolar';f.elements.clue.value='Paciente. ¿Cuál es el diagnóstico?';context.check.updateTopics();assert.ok(document.getElementById('arcadeTopics').innerHTML.includes('EPOC'));
 assert.equal(context.check.values().topic,null);assert.equal(context.check.valid(context.check.values()),'');f.elements.topic.value='Neumonía';assert.equal(context.check.values().topic,'Neumonía');
 assert.equal(context.check.imageFileError({type:'image/svg+xml',size:500}), 'Usa una imagen JPG, PNG o WebP.');
 const upgrade=fs.readFileSync(path.join(base,'supabase/ARCADE_TEMAS_5_1_17.sql'),'utf8');assert.match(upgrade,/answer_image_path/);assert.match(upgrade,/answer='PROTEINOSIS ALVEOLAR'/);assert.match(upgrade,/and answer='PROTEINOSISALVEOLAR'/);assert.match(upgrade,/TRASUDADO: no cumple ninguno/);
});

async function parentPlayer(native){
 const {document}=dom(),listeners={};document.documentElement.classList=new Element().classList;
 const make=document.createElement.bind(document);document.createElement=tag=>{const el=make();if(tag==='iframe')el.contentWindow={postMessage(){}};return el};
 const panel=document.getElementById('arcadePlayer'),root=document.getElementById('view-arcade'),outside=make();
 root.children=[panel,outside];panel.parentElement=root;root.parentElement=document.body;document.body.children=[root];
 document.exitFullscreen=async()=>{document.fullscreenElement=null;document.events.fullscreenchange()};
 if(native)panel.requestFullscreen=async()=>{document.fullscreenElement=panel;document.events.fullscreenchange()};
 else panel.requestFullscreen=async()=>{throw Error('Not available')};
 const db={select(){return this},eq(){return this},order(){return this},async range(){return{data:[q]}}};
 const context={document,location:{origin:'https://nexmir.test'},state:{user:{id:'1'},view:'arcade',sb:{from:()=>db}},MutationObserver:class{observe(){}},viewNames:{},render(){},addEventListener(k,f){listeners[k]=f},console};context.window=context;
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(base,'arcade.js'),'utf8'),context);context.render('arcade');await document.getElementById('arcadePlay').onclick();root.children=[panel,outside];
 return{document,panel,root,outside,listeners,context,button:document.getElementById('arcadeExpand'),frame:document.getElementById('arcadeHost').children[0]};
}
test('Fullscreen X and native Escape preserve iframe and restore outside controls',async()=>{
 const p=await parentPlayer(true),frame=p.frame;await p.button.onclick();assert.equal(p.document.fullscreenElement,p.panel);assert.equal(p.outside.inert,true);assert.equal(p.button['aria-pressed'],'true');
 await p.button.onclick();assert.equal(p.document.fullscreenElement,null);assert.equal(p.panel.classList.contains('is-expanded'),false);assert.equal(p.outside.inert,undefined);
 await p.button.onclick();await p.document.exitFullscreen();assert.equal(p.button['aria-pressed'],'false');assert.equal(p.document.getElementById('arcadeHost').children[0],frame);
});
test('Fallback fullscreen exits on Escape in parent or game; cross-origin ignored',async()=>{
 const p=await parentPlayer(false);await p.button.onclick();assert.equal(p.panel.classList.contains('is-expanded'),true);
 p.listeners.message({origin:'https://evil.test',source:p.frame.contentWindow,data:{type:'nexmir:arcade-exit-fullscreen'}});assert.equal(p.button['aria-pressed'],'true');
 p.listeners.message({origin:p.context.location.origin,source:p.frame.contentWindow,data:{type:'nexmir:arcade-exit-fullscreen'}});assert.equal(p.button['aria-pressed'],'false');
 await p.button.onclick();p.document.events.keydown({key:'Escape',preventDefault(){}});assert.equal(p.button['aria-pressed'],'false');
 await p.button.onclick();p.context.render('home');assert.equal(p.button['aria-pressed'],'false');
});

test('Admin upload stores an optional answer image alongside text and topic',async()=>{
 const {document}=dom(),form=document.getElementById('arcadeForm'),saved=[];form.elements={};
 for(const key of ['specialty','topic','category','answer','clue','explanation','published'])form.elements[key]=document.createElement();
 Object.assign(form.elements.specialty,{value:'Neumología'});form.elements.topic.value='EPOC';form.elements.category.value='Perlas MIR';form.elements.answer.value='Proteinosis alveolar';form.elements.clue.value='Paciente con lavado lechoso. ¿Cuál es el diagnóstico?';form.elements.explanation.value='La explicación.';form.elements.published.checked=true;
 const file={type:'image/png',size:12345},image=document.getElementById('arcadeImageFile');image.files=[file];document.getElementById('arcadeRemoveImage').parentElement=document.createElement();
 const storage={upload(path,blob){assert.equal(blob,file);return Promise.resolve({data:{path}})},remove(){throw Error('Should not remove saved image')}};
 const db={insert(payload){saved.push(payload);return this},select(){return this},async single(){return{data:{id:'new',...saved.at(-1)}}}};
 const context={document,go(){},logoutCloud:async()=>{},cloudMode:true,sb:{from:()=>db,storage:{from:()=>storage}},cloudUser:{id:'1'},cloudRole:'admin',state:{db:{cards:{},theory:{}}},RemnoteTaxonomy:{canonical:x=>x,unclassified:x=>!x},esc:x=>String(x),crypto:{randomUUID:()=> 'test-uuid'},URL:{revokeObjectURL(){}},console};context.window=context;
 form.reportValidity=()=>true;form.reset=()=>{};document.getElementById('arcadeStatus').value='all';
 let code=fs.readFileSync(path.join(base,'admin/arcade_manager.js'),'utf8').replace(/\}\)\(\);\s*$/,'globalThis.check={save};})();');vm.createContext(context);vm.runInContext(code,context);
 await context.check.save({preventDefault(){}});
 assert.equal(saved.length,1);assert.equal(saved[0].answer,'Proteinosis alveolar');assert.equal(saved[0].topic,'EPOC');assert.equal(saved[0].answer_image_path,'arcade/test-uuid.png');
});
