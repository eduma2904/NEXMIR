/* NEXMIR V5.1.30: movimiento y transiciones entre pestañas.
   Solo observa el DOM y añade clases; no modifica datos ni llamadas a Supabase. */
(() => {
 'use strict';
 const reduce=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];

 /* Barra de progreso superior */
 const bar=document.createElement('div');bar.id='mxRoute';bar.setAttribute('aria-hidden','true');document.body.append(bar);
 let barTimer;
 function barStart(){clearTimeout(barTimer);bar.style.transition='none';bar.style.width='0';bar.classList.add('on');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition='';bar.style.width='72%'}))}
 function barDone(){bar.style.width='100%';barTimer=setTimeout(()=>{bar.classList.remove('on');setTimeout(()=>{bar.style.width='0'},300)},260)}

 /* Dirección de la transición según el orden del menú */
 const order=$$('#nav .nav-item[data-view]').map(b=>b.dataset.view);
 let lastView=null;
 const wrap=()=>{
  if(typeof window.route!=='function'||window.route.__mx)return;
  const original=window.route;
  const wrapped=function(v){
   const from=order.indexOf(lastView),to=order.indexOf(v);
   const target=document.getElementById('view-'+v);
   if(target){target.classList.toggle('mx-from-down',from>-1&&to>-1&&to<from)}
   lastView=v;barStart();
   window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});
   const result=original.apply(this,arguments);
   Promise.resolve(result).finally(()=>{barDone();requestAnimationFrame(decorate)});
   return result;
  };
  wrapped.__mx=true;window.route=wrapped;
 };
 wrap();document.addEventListener('DOMContentLoaded',wrap);window.addEventListener('load',wrap);

 /* Indicador deslizante del menú */
 const nav=$('#nav');let ind;
 if(nav){ind=document.createElement('span');ind.id='mxNavInd';nav.prepend(ind)}
 function moveInd(){
  if(!nav||!ind)return;const a=$('.nav-item.active',nav);
  if(!a||!a.offsetHeight){ind.style.opacity='0';return}
  ind.style.opacity='1';ind.style.height=Math.round(a.offsetHeight*.6)+'px';
  ind.style.transform='translateY('+Math.round(a.offsetTop+a.offsetHeight*.2)+'px)';
 }
 if(nav){new MutationObserver(moveInd).observe(nav,{attributes:true,subtree:true,attributeFilter:['class']});window.addEventListener('resize',moveInd);setTimeout(moveInd,300)}
 $$('.sidebar .nav-item').forEach((el,i)=>el.style.setProperty('--mx-n',i));

 /* Escalonado, números y barras en cada render de vista */
 const seen=new WeakSet();
 function stagger(view){
  if(reduce)return;
  const items=$$(':scope > .card, :scope > .hero > *, :scope > .grid > *, :scope > .section-head, :scope > .resume-bank-card, :scope > .dashboard-focus-card',view);
  let i=0;for(const el of items){if(seen.has(el))continue;seen.add(el);el.style.setProperty('--mx-i',Math.min(i++,14));el.classList.add('mx-stagger')}
 }
 function countUp(view){
  if(reduce)return;
  for(const el of $$('.metric',view)){
   if(el.dataset.mxDone||el.children.length)continue;
   const m=el.textContent.trim().match(/^(\d+(?:[.,]\d+)?)(.*)$/);if(!m)continue;
   const end=parseFloat(m[1].replace(',','.')),dec=(m[1].split(/[.,]/)[1]||'').length,tail=m[2];
   if(!isFinite(end)||end===0||end>1e6)continue;el.dataset.mxDone='1';
   const t0=performance.now(),dur=900;
   const step=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=(end*e).toFixed(dec).replace('.',m[1].includes(',')?',':'.')+tail;if(p<1)requestAnimationFrame(step)};
   requestAnimationFrame(step);
  }
 }
 function bars(view){
  if(reduce)return;
  for(const f of $$('.progress-fill',view)){
   if(f.dataset.mxDone)continue;const w=f.style.width;if(!w)continue;f.dataset.mxDone='1';
   f.style.transition='none';f.style.width='0';
   requestAnimationFrame(()=>requestAnimationFrame(()=>{f.style.transition='';f.style.width=w}));
  }
 }
 const io='IntersectionObserver' in window?new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){e.target.classList.add('mx-in');io.unobserve(e.target)}},{rootMargin:'0px 0px -8% 0px',threshold:.05}):null;
 function reveal(view){
  if(reduce||!io)return;
  $$(':scope > .card:nth-child(n+7), :scope > .list > *:nth-child(n+8)',view).forEach(el=>{
   if(el.classList.contains('mx-stagger')||el.dataset.mxR)return;el.dataset.mxR='1';el.classList.add('mx-reveal');io.observe(el);
  });
 }
 function decorate(){
  const view=$('.view.active');if(!view)return;
  stagger(view);countUp(view);bars(view);reveal(view);moveInd();
 }
 let pending=false;
 const watch=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;decorate()})});
 $$('.view').forEach(v=>watch.observe(v,{childList:true}));

 /* Ondas en botones */
 document.addEventListener('pointerdown',e=>{
  if(reduce)return;const b=e.target.closest('.btn:not(:disabled)');if(!b)return;
  const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height)*2,w=document.createElement('span');
  w.className='mx-ripple';w.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;
  b.append(w);setTimeout(()=>w.remove(),650);
 },{passive:true});

 /* Barra superior con sombra y botón de volver arriba */
 const top=document.createElement('button');top.id='mxTop';top.type='button';top.textContent='↑';top.setAttribute('aria-label','Volver arriba');
 top.onclick=()=>window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});document.body.append(top);
 const topbar=$('.topbar');
 let tick=false;
 window.addEventListener('scroll',()=>{if(tick)return;tick=true;requestAnimationFrame(()=>{tick=false;
  const y=window.scrollY;topbar&&topbar.classList.toggle('mx-scrolled',y>8);top.classList.toggle('on',y>600)})},{passive:true});

 /* Velo del menú móvil: toca fuera para cerrar */
 const sidebar=$('.sidebar'),scrim=document.createElement('div');scrim.id='mxScrim';document.body.append(scrim);
 if(sidebar){
  new MutationObserver(()=>scrim.classList.toggle('on',sidebar.classList.contains('open'))).observe(sidebar,{attributes:true,attributeFilter:['class']});
  scrim.onclick=()=>sidebar.classList.remove('open');
 }

 /* Vibración suave en móviles al acertar o fallar */
 if(navigator.vibrate&&!reduce){
  const fx=new MutationObserver(ms=>{for(const m of ms){const t=m.target;if(!(t instanceof Element)||!t.matches('.mcq-option,.sim-option'))continue;
   if(t.classList.contains('correct')&&!(m.oldValue||'').includes('correct'))navigator.vibrate(18);
   else if(t.classList.contains('wrong')&&!(m.oldValue||'').includes('wrong'))navigator.vibrate([12,40,12])}});
  fx.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});
 }
 decorate();
})();
