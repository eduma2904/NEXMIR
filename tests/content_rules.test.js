const assert=require('node:assert/strict');
const {test}=require('node:test');
const rules=require('../content_rules.js');

test('test modes accept complete MCQ with 2, 4 or 5 options',()=>{
  for(const n of [2,4,5]){
    const q={stem:'Pregunta',options:Array.from({length:n},(_,i)=>'Opción '+i),correct_index:n-1};
    assert.equal(rules.validTest(q),true);
    assert.equal(rules.validTest({...q,correct_index:n}),false);
    assert.equal(rules.validTest({...q,options:q.options.map((v,i)=>i===0?'':v)}),false);
  }
});
test('ambiguous correct-answer markers are excluded from test modes',()=>{
  assert.equal(rules.validTest({type:'multiple_choice',front:'Pregunta',options:[{text:'A',correct:true},{text:'B',correct:true}]}),false);
});
test('ordinary flashcards and theory never become test questions',()=>{
  for(const type of ['basic','cloze','reverse','bidirectional','ordered','multiline']){
    const card={kind:'card',card_type:type,payload:{type,front:'Recuerdo',back:'Respuesta',content_use:'simulation'}};
    assert.equal(rules.isMultipleChoice(card),false);
    assert.equal(rules.validTest(card),false);
    assert.equal(rules.include(card,'bank'),false);
    assert.equal(rules.include(card,'simulation'),false);
    assert.equal(rules.include(card,'flashcards'),true);
  }
  assert.equal(rules.validTest({kind:'theory',payload:{text:'Teoría',options:['A','B'],correct_index:0}}),false);
});
test('import intents retain the correct categories and auto-route MCQ',()=>{
  const testCard={type:'multiple_choice',front:'Test',options:[{text:'A',correct:true},{text:'B'}]};
  const theory={text:'Contenido teórico'},basic={type:'basic',front:'Pregunta',back:'Respuesta'};
  for(const intent of ['bank','simulation','theory','flashcards','combined'])assert.equal(rules.include(testCard,intent),true);
  assert.equal(rules.include(theory,'theory'),true);assert.equal(rules.include(theory,'flashcards'),false);
  assert.equal(rules.include(basic,'theory'),false);assert.equal(rules.include(basic,'combined'),true);
});
test('selection changes cannot retain hidden, deleted or searched-out cards',()=>{
  const selected=new Set(['good','problem','unclassified','deleted']);
  rules.retainSelection(selected,[{id:'problem'}],q=>q.id);
  assert.deepEqual([...selected],['problem']);
  rules.retainSelection(selected,[],q=>q.id);
  assert.equal(selected.size,0);
  rules.retainSelection(selected,[{id:'good'},{id:'problem'}],q=>q.id);
  assert.equal(selected.size,0);
});
