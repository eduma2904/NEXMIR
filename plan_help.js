/* NEXMIR V5.0.15 · ayuda contextual del plan adaptativo */
(() => {
  const tips={
    'Orden de prioridad':'Ordena los temas según necesidad de refuerzo. Combina rendimiento, errores, tarjetas vencidas, presencia en preguntas MIR disponibles y tiempo sin practicar.',
    'Semana intercalada':'Distribuye 14 bloques de 25 minutos alternando temas. Los temas con mayor prioridad reciben más bloques durante la semana.'
  };
  function addHelp(){
    Object.entries(tips).forEach(([title,text])=>{const h=[...document.querySelectorAll('#adaptivePlanBody h3')].find(x=>x.textContent.trim()===title);if(h&&!h.querySelector('.plan-info')){const b=document.createElement('button');b.className='plan-info';b.type='button';b.textContent='i';b.title='Ver información';b.onclick=()=>alert(title+'\n\n'+text);h.append(' ',b)}});
    const method=document.querySelector('#adaptivePlanBody .plan-method');if(method&&!method.querySelector('.plan-info')){const b=document.createElement('button');b.className='plan-info';b.type='button';b.textContent='i';b.title='Cómo se calcula';b.onclick=()=>alert('Cómo se calcula\n\nEl peso se reparte entre brecha de conocimiento, frecuencia MIR disponible, tarjetas vencidas, errores y tiempo sin repasar. Se actualiza con tu actividad.');method.append(' ',b)}
  }
  const observer=new MutationObserver(()=>addHelp());
  observer.observe(document.querySelector('#view-calendar'),{childList:true,subtree:true});
  const style=document.createElement('style');style.textContent='.plan-info{display:inline-grid;place-items:center;width:18px;height:18px;margin-left:5px;padding:0;border:1px solid var(--primary);border-radius:50%;background:transparent;color:var(--primary);font-size:12px;font-weight:900;line-height:1;cursor:pointer;vertical-align:middle}.plan-info:hover{background:var(--primary);color:#062031}.quick-session-label{margin:10px 0;padding:9px 12px;border-left:3px solid var(--primary);background:rgba(39,211,194,.08);border-radius:8px;color:var(--primary);font-weight:700;font-size:13px}';document.head.append(style);
})();
