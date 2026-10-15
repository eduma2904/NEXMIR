/* NEXMIR Arcade · sincronización de tema V5.1.50
   Lee el tema real de la app (misma origen) antes del primer pintado y lo
   mantiene al día cuando la persona cambia paleta o modo. No toca datos. */
(function(){
  'use strict';
  var root=document.documentElement,PALETTES=['blue','green','orange','pink'];
  var TOKENS=['bg','surface','surface2','line','text','muted','primary','violet'];
  var SAFE=/^(#[0-9a-f]{3,8}|rgba?\([0-9 ,.%\/]+\)|hsla?\([0-9 ,.%deg\/]+\))$/i;
  function apply(t){
    if(!t)return;
    root.dataset.palette=PALETTES.indexOf(t.palette)>=0?t.palette:'blue';
    root.dataset.themeMode=t.mode==='light'?'light':'dark';
    TOKENS.forEach(function(name){
      var v=t.vars&&typeof t.vars[name]==='string'?t.vars[name].trim():'';
      if(v&&SAFE.test(v))root.style.setProperty('--'+name,v);else root.style.removeProperty('--'+name);
    });
    var meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',root.dataset.themeMode==='light'?'#edf3fa':'#081525');
  }
  function fromParent(){
    try{
      if(window.parent===window)return null;
      var el=window.parent.document.documentElement,cs=window.parent.getComputedStyle(el),vars={};
      TOKENS.forEach(function(name){vars[name]=cs.getPropertyValue('--'+name)});
      return {palette:el.dataset.palette,mode:el.dataset.themeMode,vars:vars};
    }catch(e){return null}
  }
  try{if(window.parent!==window)root.classList.add('is-embedded')}catch(e){}
  var initial=fromParent();
  if(!initial){
    var light=false;try{light=matchMedia('(prefers-color-scheme: light)').matches}catch(e){}
    initial={palette:root.dataset.palette||'blue',mode:light?'light':'dark'};
  }
  apply(initial);
  window.addEventListener('message',function(event){
    if(event.origin!==location.origin||event.source!==window.parent)return;
    var d=event.data||{};
    if(d.type==='nexmir:arcade-theme')apply({palette:d.palette,mode:d.mode,vars:d.vars});
  });
  window.NexmirArcadeTheme={apply:apply};
})();
