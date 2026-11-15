/* NEXMIR V5.1.67: acceso por teclado y lectores de pantalla a tarjetas y filas que usan onclick.
   Las tarjetas de asignatura y tema, las filas de contenido, cuadros y marcadas, y las imágenes
   ampliables eran <div onclick> sin foco. Aquí reciben tabindex y role="button" (si no contienen
   otros controles) y responden a Enter y Espacio. No cambia ninguna función existente. */
(() => {
  'use strict';
  const SEL='[onclick]:not(button):not(a):not(input):not(select):not(textarea):not(summary):not([role]):not([tabindex])';
  const INTERACTIVE='button,a[href],input,select,textarea';
  const SKIP=/backdrop|overlay|scrim/i;
  function enhanceOne(el){
    if(el.hasAttribute('data-nx-kb'))return;
    const code=el.getAttribute('onclick')||'';
    if(/^\s*event\.stopPropagation\(\)\s*;?\s*$/.test(code)||SKIP.test(el.className||''))return;
    el.setAttribute('data-nx-kb','');
    el.setAttribute('tabindex','0');
    if(!el.querySelector(INTERACTIVE))el.setAttribute('role','button');
    if(el.tagName==='IMG'&&!el.hasAttribute('aria-label'))el.setAttribute('aria-label',el.getAttribute('alt')||'Ampliar imagen');
  }
  function enhance(root){
    if(!root||root.nodeType!==1)return;
    if(root.matches(SEL))enhanceOne(root);
    root.querySelectorAll(SEL).forEach(enhanceOne);
  }
  enhance(document.body);
  new MutationObserver(list=>{for(const m of list)m.addedNodes.forEach(enhance)}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('keydown',e=>{
    const el=e.target;
    if(!(el instanceof Element)||!el.hasAttribute('data-nx-kb')||e.defaultPrevented)return;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}
  });
})();
