/* Images embedded in Markdown use the same viewer as attached images. */
(() => {
  const dialog=document.getElementById('imageViewerDialog');
  const img=document.getElementById('imageViewerImg');
  const body=dialog.querySelector('.image-viewer-body');
  const toolbar=document.createElement('div');
  toolbar.className='image-viewer-controls';
  toolbar.innerHTML='<button class="btn mini" type="button" data-image-action="out" aria-label="Reducir imagen">−</button><output aria-live="polite">100%</output><button class="btn mini" type="button" data-image-action="in" aria-label="Aumentar imagen">+</button><button class="btn mini" type="button" data-image-action="fit">Ajustar</button><button class="btn mini" type="button" data-image-action="actual">Tamaño original</button>';
  dialog.querySelector('.image-viewer-head').append(toolbar);
  let scale=1;
  function apply(value){
    if(!img.naturalWidth)return;
    scale=Math.max(.1,Math.min(4,value));
    img.style.width=Math.round(img.naturalWidth*scale)+'px';
    img.style.height=Math.round(img.naturalHeight*scale)+'px';
    toolbar.querySelector('output').textContent=Math.round(scale*100)+'%';
    toolbar.querySelector('[data-image-action="out"]').disabled=scale<=.1;
    toolbar.querySelector('[data-image-action="in"]').disabled=scale>=4;
  }
  function fit(){apply(Math.min(1,(body.clientWidth-24)/img.naturalWidth,(body.clientHeight-24)/img.naturalHeight));body.scrollTo(0,0)}
  function act(action){
    if(action==='in')apply(scale*1.25);
    if(action==='out')apply(scale/1.25);
    if(action==='actual')apply(1);
    if(action==='fit')fit();
  }
  toolbar.onclick=e=>act(e.target.closest('[data-image-action]')?.dataset.imageAction);
  img.addEventListener('load',fit);
  img.addEventListener('error',()=>{toolbar.querySelector('output').textContent='No se pudo cargar la imagen'});
  const original=window.openQuestionImageFromElement;
  window.openQuestionImageFromElement=el=>{if(!el?.src)return;original(el);if(img.complete&&img.naturalWidth)fit()};
  dialog.addEventListener('keydown',e=>{
    // Do not let viewer keys choose or discard a question alternative.
    e.stopPropagation();
    if(['+','=','-','0'].includes(e.key)){e.preventDefault();act(e.key==='-'?'out':e.key==='0'?'fit':'in')}
  });
  const selector='.question-stem img,.focus-stem img,.sim-stem img,.sim-review-detail img,.flash-front img,.flash-back img';
  function sync(){
    document.querySelectorAll(selector).forEach(el=>{
      if(el.closest('#imageViewerDialog,.question-image-wrap'))return;
      el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','Ampliar imagen: '+(el.alt||'imagen de la pregunta'));el.title='Pulsa para ampliar';
      if(el.nextElementSibling?.classList.contains('inline-image-zoom'))return;
      const btn=document.createElement('button');btn.type='button';btn.className='image-zoom-btn inline-image-zoom';btn.textContent='⛶ Ver imagen ampliada';el.after(btn);
    });
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest('.inline-image-zoom'),el=button?.previousElementSibling||e.target.closest(selector);
    if(el?.tagName!=='IMG')return;
    e.preventDefault();e.stopPropagation();window.openQuestionImageFromElement(el);
  },true);
  document.addEventListener('keydown',e=>{
    if(e.target.matches?.(selector)&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();window.openQuestionImageFromElement(e.target)}
  },true);
  new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',()=>{if(dialog.open)fit()});
  sync();
})();
