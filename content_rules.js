/* Shared content compatibility rules, also used by the import preview. */
(function(global){
  function isMultipleChoice(item){
    const p=item?.payload||item||{};
    const type=item?.card_type||p.type;
    if(item?.kind==='theory'||(type&&type!=='multiple_choice'))return false;
    return type==='multiple_choice'||Array.isArray(p.options)&&p.options.length>=2;
  }
  function validTest(q){
    if(!isMultipleChoice(q))return false;
    const p=q?.payload||q,options=p.options||[];
    const marked=options.filter(o=>o?.correct===true).length;
    if(p.correct_index==null&&marked!==1)return false;
    const correct=p.correct_index??options.findIndex(o=>o?.correct===true);
    return !!String(p.stem||p.front||'').trim()&&options.length>=2&&
      options.every(o=>String(typeof o==='string'?o:o?.text||'').trim())&&
      Number.isInteger(correct)&&correct>=0&&correct<options.length;
  }
  function include(item,intent){
    if(intent==='combined'||!intent)return true;
    if(isMultipleChoice(item))return true;
    if(intent==='theory')return item.text!=null||item.kind==='theory';
    if(intent==='flashcards')return item.front!=null||item.kind==='card';
    return false;
  }
  function retainSelection(selected,rows,key){
    const allowed=new Set(rows.map(key));
    for(const id of selected)if(!allowed.has(id))selected.delete(id);
    return selected;
  }
  const api={isMultipleChoice,validTest,include,retainSelection};
  global.NexmirContentRules=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
