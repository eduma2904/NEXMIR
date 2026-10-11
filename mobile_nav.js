/* NEXMIR V5.1.33: barra inferior en móvil/tableta, grupos de navegación e iconos SVG.
   Solo llama a route(); no cambia datos ni rutas existentes. */
(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
 const MQ=window.matchMedia('(max-width:1080px)');
 const S='fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
 const ICONS={
  dashboard:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h4.5v-5h4v5h4.5V10"/>',
  study:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z"/><path d="M9 7.5h6"/>',
  focus:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  reviews:'<rect x="3.5" y="7" width="13" height="12" rx="2.5"/><path d="M7.5 7V5.5A2 2 0 0 1 9.5 3.5h9a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H17"/>',
  bank:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/>',
  simulations:'<circle cx="12" cy="13" r="8"/><path d="M12 8.5V13l3 2"/><path d="M9.5 2.8h5"/>',
  battles:'<path d="m5 5 9.5 9.5M19 5l-9.5 9.5"/><path d="m3.5 6.5 3 3M20.5 6.5l-3 3"/><path d="m8 16-3 3m11-3 3 3"/>',
  arcade:'<path d="m12 3 2.3 5.2 5.7.6-4.3 3.8 1.2 5.6L12 15.2 7.1 18.2l1.2-5.6L4 8.8l5.7-.6z"/>',
  errors:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
  bookmarks:'<path d="M6.5 3.5h11a1 1 0 0 1 1 1V21L12 17l-6.5 4V4.5a1 1 0 0 1 1-1z"/>',
  progress:'<path d="M4 20V10m6 10V4m6 16v-7m5 7H3"/>',
  goal:'<path d="M6 21V4"/><path d="M6 5h11l-2.2 3.5L17 12H6"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4m8-4v4M3.5 10h17"/><path d="M8 14h2m3 0h2M8 17.5h2"/>',
  profile:'<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-3.8 3.8-5.8 7.5-5.8s6.7 2 7.5 5.8"/>',
  admin:'<circle cx="12" cy="12" r="3"/><path d="M12 3v2.6m0 12.8V21M3 12h2.6m12.8 0H21M5.6 5.6l1.9 1.9m9 9 1.9 1.9m0-12.8-1.9 1.9m-9 9-1.9 1.9"/>',
  practice:'<path d="M13 2.8 5 13.5h6l-1 7.7 8-10.8h-6z"/>',
  more:'<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>',
  guide:'<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".7" fill="currentColor"/>',
  logout:'<path d="M9 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h3"/><path d="m14 8 4 4-4 4m4-4H9.5"/>'
 };
 const svg=n=>`<svg class="mx-ico" viewBox="0 0 24 24" width="22" height="22" ${S} aria-hidden="true" focusable="false">${ICONS[n]||''}</svg>`;
 window.NexmirIcons={svg,names:Object.keys(ICONS)};

 /* Iconos SVG en el menú lateral (PC) en lugar de símbolos de texto */
 for(const item of $$('.sidebar .nav-item')){
  const key=item.dataset.view||(item.id==='adminLink'?'admin':'');
  if(!ICONS[key])continue;
  const first=item.firstChild;
  if(first&&first.nodeType===3)first.remove();
  const wrap=document.createElement('span');wrap.className='mx-nav-ico';wrap.innerHTML=svg(key);item.prepend(wrap);
 }
 const menuItems={accountProfileBtn:'profile',accountLogoutBtn:'logout'};
 for(const [id,key] of Object.entries(menuItems)){const b=document.getElementById(id),g=b?.querySelector('span[aria-hidden]');if(g){g.className='mx-nav-ico';g.innerHTML=svg(key)}}

 /* Grupos */
 const GROUPS={
  dashboard:{views:['dashboard']},
  study:{views:['study']},
  practice:{label:'Practicar',title:'Practicar',views:['reviews','bank','simulations','battles','focus'],items:[
   {view:'reviews',label:'Repasos',hint:'Flashcards pendientes',badge:true},
   {view:'bank',label:'Banqueo',hint:'Preguntas por tema'},
   {view:'simulations',label:'Simulacros',hint:'Mini-MIR y completos'},
   {view:'battles',label:'Batallas',hint:'Contra otro estudiante'},
   {view:'focus',label:'Modo Focus',hint:'Sesión concentrada'}]},
  progress:{label:'Progreso',title:'Mi avance',views:['progress','errors','bookmarks'],items:[
   {view:'progress',label:'Progreso',hint:'Precisión y cobertura'},
   {view:'errors',label:'Mis errores',hint:'Repasa lo fallado'},
   {view:'bookmarks',label:'Marcadas',hint:'Tu lista guardada'}]},
  more:{label:'Más',title:'Más opciones',views:['calendar','goal','arcade','profile'],items:[
   {view:'calendar',label:'Plan de estudio',hint:'Tu semana adaptativa'},
   {view:'goal',label:'Mi plaza MIR',hint:'Objetivo y baremo'},
   {view:'arcade',label:'Arcade',hint:'Repasa jugando'},
   {view:'profile',label:'Perfil',hint:'Cuenta y apariencia'},
   {action:'guide',label:'Guía',hint:'Repetir el tutorial',icon:'guide'},
   {action:'admin',label:'Panel Admin',hint:'Solo administradores',icon:'admin',admin:true},
   {action:'logout',label:'Cerrar sesión',hint:'Salir de NEXMIR',icon:'logout',danger:true}]}
 };
 const BAR=[['dashboard','Inicio','dashboard'],['study','Estudiar','study'],['practice','Practicar','practice'],['progress','Progreso','progress'],['more','Más','more']];

 const bar=document.createElement('nav');bar.id='mxBottomNav';bar.setAttribute('aria-label','Navegación principal');bar.hidden=true;
 bar.innerHTML='<span class="mx-bar-ind" aria-hidden="true"></span>'+BAR.map(([g,label,icon])=>`<button type="button" class="mx-tab" data-group="${g}" aria-label="${label}">${svg(icon)}<span class="mx-tab-label">${label}</span><b class="mx-tab-badge" hidden></b></button>`).join('');
 document.body.append(bar);
 const scrim=document.createElement('div');scrim.id='mxSheetScrim';document.body.append(scrim);
 const sheet=document.createElement('section');sheet.id='mxSheet';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','mxSheetTitle');sheet.hidden=true;
 sheet.innerHTML='<div class="mx-sheet-grip" aria-hidden="true"></div><div class="mx-sheet-head"><h3 id="mxSheetTitle"></h3><button type="button" class="mx-sheet-close" aria-label="Cerrar">×</button></div><div class="mx-sheet-list"></div>';
 document.body.append(sheet);
 let openGroup=null,lastTab=null;

 const currentView=()=>(typeof state!=='undefined'&&state?.view)||'dashboard';
 const groupOf=v=>Object.keys(GROUPS).find(g=>GROUPS[g].views.includes(v));
 function dueCount(){const b=document.getElementById('dueBadge');return b&&!b.classList.contains('hidden')?(parseInt(b.textContent,10)||0):0}
 function syncBadge(){
  const n=dueCount(),tab=$('.mx-tab[data-group="practice"] .mx-tab-badge',bar);
  tab.hidden=!n;tab.textContent=n>99?'99+':String(n);
  const row=$('.mx-sheet-item[data-view="reviews"] .mx-item-badge',sheet);if(row){row.hidden=!n;row.textContent=String(n)}
 }
 function moveInd(){
  const ind=$('.mx-bar-ind',bar),active=$('.mx-tab.active',bar);
  if(!active||bar.hidden){ind.style.opacity='0';return}
  ind.style.opacity='1';ind.style.width=active.offsetWidth*.5+'px';ind.style.transform=`translateX(${active.offsetLeft+active.offsetWidth*.25}px)`;
 }
 function syncActive(){
  const g=groupOf(currentView());
  $$('.mx-tab',bar).forEach(t=>{const on=t.dataset.group===g;t.classList.toggle('active',on);if(on)t.setAttribute('aria-current','page');else t.removeAttribute('aria-current')});
  $$('.mx-sheet-item',sheet).forEach(i=>i.classList.toggle('active',i.dataset.view===currentView()));
  moveInd();
 }
 function closeSheet(restore=true){
  if(!openGroup)return;openGroup=null;sheet.classList.remove('open');scrim.classList.remove('on');
  $$('.mx-tab',bar).forEach(t=>t.removeAttribute('aria-expanded'));
  setTimeout(()=>{if(!openGroup)sheet.hidden=true},260);
  if(restore)lastTab?.focus?.({preventScroll:true});
 }
 function openSheet(g,tab){
  const def=GROUPS[g];if(!def?.items)return;
  if(openGroup===g)return closeSheet();
  openGroup=g;lastTab=tab;
  $('#mxSheetTitle',sheet).textContent=def.title;
  const adminVisible=!!$('#adminLink')&&!$('#adminLink').classList.contains('hidden');
  $('.mx-sheet-list',sheet).innerHTML=def.items.filter(i=>!i.admin||adminVisible).map(i=>{
   const key=i.icon||i.view;
   return `<button type="button" class="mx-sheet-item${i.danger?' danger':''}${i.view===currentView()?' active':''}" ${i.view?`data-view="${i.view}"`:`data-action="${i.action}"`}><span class="mx-item-ico">${svg(key)}</span><span class="mx-item-copy"><strong>${i.label}</strong><small>${i.hint||''}</small></span>${i.badge?'<b class="mx-item-badge" hidden></b>':''}</button>`}).join('');
  syncBadge();
  sheet.hidden=false;requestAnimationFrame(()=>{sheet.classList.add('open');scrim.classList.add('on')});
  $$('.mx-tab',bar).forEach(t=>{if(t===tab)t.setAttribute('aria-expanded','true')});
  $('.mx-sheet-item',sheet)?.focus({preventScroll:true});
 }
 bar.addEventListener('click',e=>{
  const tab=e.target.closest('.mx-tab');if(!tab)return;
  const g=tab.dataset.group,def=GROUPS[g];
  if(def.items){openSheet(g,tab);return}
  closeSheet(false);
  if(currentView()===g){window.scrollTo({top:0,behavior:'smooth'});return}
  if(typeof route==='function')route(g);
 });
 sheet.addEventListener('click',e=>{
  if(e.target.closest('.mx-sheet-close'))return closeSheet();
  const item=e.target.closest('.mx-sheet-item');if(!item)return;
  closeSheet(false);
  if(item.dataset.view){if(typeof route==='function')route(item.dataset.view);return}
  const a=item.dataset.action;
  if(a==='guide')window.nexmirTutorial?.start?.();
  else if(a==='admin')$('#adminLink')?.click();
  else if(a==='logout')document.getElementById('accountLogoutBtn')?.click();
 });
 scrim.addEventListener('click',()=>closeSheet());
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openGroup){e.preventDefault();closeSheet()}});
 /* Deslizar hacia abajo para cerrar */
 let y0=null;
 sheet.addEventListener('touchstart',e=>{if(e.target.closest('.mx-sheet-list')&&$('.mx-sheet-list',sheet).scrollTop>0)return;y0=e.touches[0].clientY},{passive:true});
 sheet.addEventListener('touchmove',e=>{if(y0===null)return;const dy=Math.max(0,e.touches[0].clientY-y0);sheet.style.transform=`translateY(${dy}px)`;sheet.style.transition='none'},{passive:true});
 sheet.addEventListener('touchend',e=>{if(y0===null)return;const dy=(e.changedTouches[0]?.clientY||0)-y0;y0=null;sheet.style.transition='';sheet.style.transform='';if(dy>70)closeSheet()},{passive:true});

 /* Visibilidad: solo con la app abierta y en pantallas estrechas */
 const app=document.getElementById('app');
 function visibility(){
  const show=MQ.matches&&app&&!app.classList.contains('hidden');
  bar.hidden=!show;document.body.classList.toggle('mx-has-bottom-nav',!!show);
  if(!show)closeSheet(false);
  syncActive();syncBadge();
 }
 if(app)new MutationObserver(visibility).observe(app,{attributes:true,attributeFilter:['class']});
 MQ.addEventListener?.('change',visibility);
 window.addEventListener('resize',moveInd);
 const dueBadge=document.getElementById('dueBadge');
 if(dueBadge)new MutationObserver(syncBadge).observe(dueBadge,{attributes:true,childList:true,characterData:true,subtree:true});
 const nav=document.getElementById('nav');
 if(nav)new MutationObserver(()=>{syncActive();if(openGroup)closeSheet(false)}).observe(nav,{attributes:true,subtree:true,attributeFilter:['class']});
 document.addEventListener('click',e=>{if(e.target.closest('dialog')===null&&openGroup&&!e.target.closest('#mxSheet,#mxBottomNav'))closeSheet(false)});
 visibility();setTimeout(visibility,400);
})();
