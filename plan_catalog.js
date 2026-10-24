/* Presentación de planes y canales de adquisición configurados en Supabase. */
(()=>{
  const $=s=>document.querySelector(s);
  let channels=[],lastFetch=0,loading=false;
  const benefits={
    free:['Estudio, teoría y Focus','15 preguntas de banqueo al día','20 flashcards al día','1 Mini-MIR de 15 preguntas al día','5 batallas al día'],
    pro:['Todo lo incluido en Free','Banqueo y flashcards sin límite diario','Simulacros completos y personalizados','Batallas sin límite diario y explicaciones']
  };
  // Precio oficial del Plan Pro (acceso por 30 días calendario).
  const PRICE=Object.freeze({pen:60,usd:18,days:30});
  const money=(kind)=>kind==='pen'?`S/ ${PRICE.pen}`:`US$ ${PRICE.usd}`;
  function amountFor(currency){const c=String(currency||'').toLowerCase();if(/sol|pen|s\/|nuevo/.test(c))return money('pen');if(/d[oó]lar|usd|us\$/.test(c))return money('usd');return `${money('pen')} o ${money('usd')}`}
  function priceHtml(){return `<div class="plan-price" role="group" aria-label="Precio del Plan Pro"><span class="plan-price-amount"><strong>${money('pen')}</strong><small>soles</small></span><span class="plan-price-or" aria-hidden="true">o</span><span class="plan-price-amount"><strong>${money('usd')}</strong><small>dólares</small></span><span class="plan-price-term">por ${PRICE.days} días calendario</span></div>`}
  function expiryHtml(profile){
    const rules=window.NexmirPlanRules;if(!rules||!profile?.plan_expires_at||rules.normalizePlan(profile.plan)!=='pro')return '';
    const left=rules.proDaysLeft(profile),date=new Date(profile.plan_expires_at).toLocaleDateString('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'long',year:'numeric'});
    const soon=left!==null&&left<=5;
    return `<p class="plan-expiry${soon?' is-soon':''}">Tu Plan Pro está activo hasta el <strong>${esc(date)}</strong>${left!==null?` (${left} ${left===1?'día restante':'días restantes'})`:''}.${soon?' Renueva antes de esa fecha para no perder el acceso.':''}</p>`;
  }
  function cards(){return `<div class="plan-comparison"><div class="card"><span class="chip">FREE</span><h3>Empieza gratis</h3><ul>${benefits.free.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="card pro-plan-card"><span class="chip">PRO</span><h3>Estudia sin límites diarios</h3>${priceHtml()}<button class="btn primary" type="button" onclick="openProPurchase()">Adquirir Plan Pro</button><ul>${benefits.pro.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div>`}
  function channelUrl(c){
    const target=String(c.target||'').trim();
    if(c.kind==='email'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target))return `mailto:${target}?subject=NEXMIR%20Pro`;
    if(c.kind==='whatsapp'&&/^\d{8,15}$/.test(target))return `https://wa.me/${target}?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20NEXMIR%20Pro`;
    if(c.kind==='url'){try{const u=new URL(target);if(u.protocol==='https:')return u.href}catch{}}
    return null;
  }
  function channelsHtml(){
    const banks=channels.filter(c=>c.active&&c.kind==='bank'&&String(c.account_number||c.target||'').trim());
    const contacts=channels.filter(c=>c.active&&c.kind!=='bank'&&channelUrl(c));
    const guide=`<ol class="plan-steps"><li>Transfiere <strong>${money('pen')}</strong> o <strong>${money('usd')}</strong> a una de las cuentas.</li><li>Envía el comprobante por WhatsApp.</li><li>Cuando se verifique el pago, tu cuenta pasa a Pro por <strong>${PRICE.days} días calendario</strong>.</li></ol><p class="plan-renew-note">Para mantener el acceso, renueva antes de que se cumplan los ${PRICE.days} días.</p>`;
    if(!banks.length&&!contacts.length)return guide+'<p class="muted">Las cuentas para pagar aún no están disponibles. Puedes seguir usando Free.</p>';
    const bankHtml=banks.length?`<div class="bank-channel-grid">${banks.map(c=>{const account=String(c.account_number||c.target||'').trim(),cci=String(c.cci||'').trim();return `<article class="bank-channel-card"><header class="bank-channel-head"><span class="chip">Transferencia${c.currency?` · ${esc(c.currency)}`:''}</span><h4>${esc(c.label)}</h4>${c.description?`<p class="bank-channel-note">${esc(c.description)}</p>`:''}<p class="bank-channel-amount">Monto a transferir: <strong>${esc(amountFor(c.currency))}</strong></p></header><div class="bank-detail"><span class="bank-detail-label">Número de cuenta</span><strong class="bank-detail-value">${esc(account)}</strong><button class="btn bank-copy" type="button" data-copy="${esc(account)}" aria-label="Copiar número de cuenta de ${esc(c.label)}">Copiar</button></div>${cci?`<div class="bank-detail"><span class="bank-detail-label">CCI</span><strong class="bank-detail-value">${esc(cci)}</strong><button class="btn bank-copy" type="button" data-copy="${esc(cci)}" aria-label="Copiar CCI de ${esc(c.label)}">Copiar</button></div>`:''}</article>`}).join('')}</div>`:'';
    const contactHtml=contacts.length?`<div class="plan-channel-list">${contacts.map(c=>`<a class="btn primary" href="${esc(channelUrl(c))}" target="_blank" rel="noopener noreferrer">${esc(c.label)}</a>${c.description?`<small>${esc(c.description)}</small>`:''}`).join('')}</div>`:'';
    return `${guide}${bankHtml}${contactHtml}`;
  }
  async function loadChannels(){
    if(!state.sb||loading)return;
    loading=true;lastFetch=Date.now();
    try{const {data,error}=await state.sb.from('plan_purchase_channels').select('id,label,kind,target,currency,account_number,cci,description,active,sort_order').eq('active',true).order('sort_order');if(error)throw error;channels=data||[]}catch{channels=[]}finally{loading=false}if(state.view==='profile'&&state.user)renderProfile();
  }
  window.openProPurchase=async()=>{
    let dialog=$('#proPurchaseDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='proPurchaseDialog';dialog.className='dialog plan-dialog';document.body.append(dialog)}
    const render=()=>{dialog.innerHTML=`<div class="dialog-head"><h3>Adquirir Plan Pro</h3><button class="icon-btn" type="button" aria-label="Cerrar" onclick="document.getElementById('proPurchaseDialog').close()">×</button></div>${priceHtml()}`+channelsHtml()};
    render();if(!dialog.open)dialog.showModal();await loadChannels();render();
  };
  function insertSignupBenefits(){const panel=$('#signupPanel');if(panel&&!$('#signupPlans')){const box=document.createElement('details');box.id='signupPlans';box.className='signup-plan-details';box.open=true;box.innerHTML=`<summary>Beneficios de Free y Pro</summary>${cards()}<p class="muted small">La cuenta se crea en Free. Pro se activa posteriormente desde la administración de NEXMIR.</p>`;panel.append(box)}}
  const previousProfile=renderProfile;
  renderProfile=function(){
    if(Date.now()-lastFetch>30000)void loadChannels();
    previousProfile();const root=$('#view-profile');if(!root)return;
    const grids=[...root.querySelectorAll(':scope > .grid')],personal=grids[0]?.children[0]?.outerHTML||'',resident=grids[0]?.children[1]?.outerHTML||'',limits=grids[1]?.children[0]?.outerHTML||'',session=grids[1]?.children[1]?.outerHTML||'',preferences=root.querySelector(':scope > .focus-preferences-card')?.outerHTML||'',theme=root.querySelector(':scope > .profile-theme-card')?.outerHTML||'',stats=root.querySelector(':scope > .profile-stats')?.outerHTML||'',suggestions=[...root.querySelectorAll(':scope > .card')].find(card=>/Sugerencias para NEXMIR/.test(card.textContent||''))?.outerHTML||'';
    const isPro=NexmirPlanRules.hasUnlimitedAccess(state.profile);
    root.innerHTML=`<div class="section-head"><div><h2>Mi perfil</h2><p class="muted">Tu cuenta, plan y progreso en un solo lugar.</p></div><span class="chip">${isPro?'PRO':'FREE'}</span></div><section class="card profile-plan-overview"><div class="section-head"><div><span class="chip">Plan actual</span><h3>${isPro?'NEXMIR Pro':'NEXMIR Free'}</h3></div></div>${!isPro?`<button class="btn primary" type="button" onclick="openProPurchase()">Adquirir Plan Pro</button>`:`<p class="muted">Tu cuenta tiene acceso a las funciones Pro.</p>${expiryHtml(state.profile)}`}</section><div class="profile-sections"><details open><summary>Datos de mi cuenta</summary>${personal}</details><details data-profile-section="appearance"><summary>Temas y apariencia</summary><div id="profileAppearanceSlot">${theme||'<p class="muted">Elige tu tema visual desde esta sección.</p>'}</div></details><details><summary>Comparar planes y límites</summary>${cards()}${limits}</details><details><summary>Mi progreso y logros</summary>${resident}<div id="profileStatsSlot">${stats}</div></details><details><summary>Preferencias de estudio</summary>${preferences}</details><details><summary>Sesión y dispositivos</summary>${session}</details><details data-profile-section="suggestions"><summary>Sugerencias para NEXMIR</summary>${suggestions||'<p class="muted">Aquí podrás enviar recomendaciones al equipo de NEXMIR.</p>'}</details></div>`;
  };
  window.showProUpsell=reason=>{
    if(NexmirPlanRules.hasUnlimitedAccess(state.profile))return;
    let dialog=$('#proUpsellDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='proUpsellDialog';dialog.className='dialog pro-upsell-dialog';document.body.append(dialog)}
    dialog.innerHTML=`<div class="dialog-head"><div><span class="chip">NEXMIR Free</span><h3>Continúa con Pro</h3></div><button class="icon-btn" type="button" aria-label="Cerrar" onclick="document.getElementById('proUpsellDialog').close()">×</button></div><p>${esc(reason)}</p><p class="muted">En Pro tendrás banqueo y flashcards sin límite diario, simulacros completos y batallas sin límite diario.</p>${priceHtml()}<div class="dialog-actions"><button class="btn" type="button" onclick="document.getElementById('proUpsellDialog').close()">Seguir en Free</button><button class="btn primary" type="button" onclick="document.getElementById('proUpsellDialog').close();route('profile')">Ver planes</button></div>`;
    if(!dialog.open)dialog.showModal();
  };
  insertSignupBenefits();
  document.addEventListener('click',async event=>{const button=event.target.closest('.bank-copy');if(!button)return;const value=button.dataset.copy||'';try{await navigator.clipboard.writeText(value)}catch{const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();document.execCommand('copy');area.remove()}const old=button.dataset.label||button.textContent;button.dataset.label=old;button.textContent='Copiado ✓';button.classList.add('is-copied');clearTimeout(button._t);button._t=setTimeout(()=>{button.textContent=old;button.classList.remove('is-copied')},1600)});
  window.addEventListener('nexmir:ready',loadChannels);
  window.addEventListener('nexmir:signout',()=>{channels=[];lastFetch=0});
})();
