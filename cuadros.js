/* NEXMIR V5.1.50 · panel "Cuadros" en Repaso. Solo lee el catálogo; no toca tarjetas, repasos ni permisos. */
(() => {
  'use strict';
  if(typeof renderReviews!=='function'||typeof namedCuadros!=='function')return;
  const base=renderReviews;
  function selected(){const v=id=>document.querySelector('#view-reviews #'+id)?.value||'';return{sp:v('reviewSpecialty'),topic:v('reviewTopic'),sub:v('reviewSubtopic')}}
  function items(){
    const {sp,topic,sub}=selected(),out=[];
    for(const x of studyContent()){
      if(x.kind!=='theory')continue;
      if(sp&&displaySpecialty(x.specialty)!==sp)continue;
      if(topic&&(x.topic||'General')!==topic)continue;
      if(sub&&(x.subtopic||'General')!==sub)continue;
      for(const c of namedCuadros(x))out.push({x,c});
    }
    return out.sort((a,b)=>a.c.title.localeCompare(b.c.title,'es'));
  }
  function paint(){
    const host=document.getElementById('cuadrosPanel');if(!host)return;
    const list=items();
    host.hidden=!list.length;
    if(!list.length){host.innerHTML='';return}
    host.innerHTML=`<details class="card cuadros-panel"><summary>▦ Cuadros de esta selección (${list.length})</summary><div class="list">${list.slice(0,60).map(({x,c})=>cuadroRow(x,c)).join('')}</div>${list.length>60?'<p class="muted small">Mostrando 60. Afina asignatura, tema o subtema para ver el resto.</p>':''}</details>`;
  }
  renderReviews=function(...args){
    const result=base.apply(this,args);
    const view=document.getElementById('view-reviews');
    if(view&&!document.getElementById('cuadrosPanel')){
      const panel=document.createElement('div');panel.id='cuadrosPanel';panel.hidden=true;view.appendChild(panel);
      view.addEventListener('change',e=>{if(e.target.matches('#reviewSpecialty,#reviewTopic,#reviewSubtopic'))setTimeout(paint,0)});
    }
    setTimeout(paint,0);
    return result;
  };
  window.renderReviews=renderReviews;
})();
