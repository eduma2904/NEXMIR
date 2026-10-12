/* Presentación de planes y canales de adquisición configurados en Supabase. */
(()=>{
  const $=s=>document.querySelector(s);
  let channels=[],lastFetch=0,loading=false;
  const benefits={
    free:['Estudio, teoría y Focus','15 preguntas de banqueo al día','20 flashcards al día','1 Mini-MIR de 15 preguntas al día','5 batallas al día'],
    pro:['Todo lo incluido en Free','Banqueo y flashcards sin límite diario','Simulacros completos y personalizados','Batallas sin límite diario y explicaciones']
  };
  function cards(){return `<div class="plan-comparison"><div class="card"><span class="chip">FREE</span><h3>Empieza gratis</h3><ul>${benefits.free.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="card pro-plan-card"><span class="chip">PRO</span><h3>Estudia sin límites diarios</h3><button class="btn primary" type="button" onclick="openProPurchase()">Adquirir Plan Pro</button><ul>${benefits.pro.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div>`}
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
    if(!banks.length&&!contacts.length)return '<p class="muted">Los canales para adquirir Pro aún no están disponibles. Puedes seguir usando Free.</p>';
    const bankHtml=banks.length?`<div class="bank-channel-grid">${banks.map(c=>{const account=String(c.account_number||c.target||'').trim(),cci=String(c.cci||'').trim();return `<article class="bank-channel-card"><div><span class="chip">Transferencia${c.currency?` · ${esc(c.currency)}`:''}</span><h4>${esc(c.label)}</h4>${c.description?`<p class="muted small">${esc(c.description)}</p>`:''}</div><div class="bank-detail"><span>Número de cuenta</span><strong>${esc(account)}</strong><button class="btn bank-copy" type="button" data-copy="${esc(account)}">Copiar</button></div>${cci?`<div class="bank-detail"><span>CCI</span><strong>${esc(cci)}</strong><button class="btn bank-copy" type="button" data-copy="${esc(cci)}">Copiar</button></div>`:''}</article>`}).join('')}</div>`:'';
    const contactHtml=contacts.length?`<div class="plan-channel-list">${contacts.map(c=>`<a class="btn primary" href="${esc(channelUrl(c))}" target="_blank" rel="noopener noreferrer">${esc(c.label)}</a>${c.description?`<small>${esc(c.description)}</small>`:''}`).join('')}</div>`:'';
    return `<p class="muted">Transfiere a una de las cuentas y envía el comprobante por WhatsApp. La activación Pro se confirma en tu cuenta.</p>${bankHtml}${contactHtml}`;
  }
  async function loadChannels(){
    if(!state.sb||loading)return;
    loading=true;lastFetch=Date.now();
    try{const {data,error}=await state.sb.from('plan_purchase_channels').select('id,label,kind,target,currency,account_number,cci,description,active,sort_order').eq('active',true).order('sort_order');if(error)throw error;channels=data||[]}catch{channels=[]}finally{loading=false}if(state.view==='profile'&&state.user)renderProfile();
  }
  window.openProPurchase=async()=>{
    let dialog=$('#proPurchaseDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='proPurchaseDialog';dialog.className='dialog';dialog.style.width='min(780px,94vw)';document.body.append(dialog)}
    const render=()=>{dialog.innerHTML=`<div class="dialog-head"><h3>Adquirir Plan Pro</h3><button class="icon-btn" type="button" aria-label="Cerrar" onclick="document.getElementById('proPurchaseDialog').close()">×</button></div>`+channelsHtml()};
    render();if(!dialog.open)dialog.showModal();await loadChannels();render();
  };
  function insertSignupBenefits(){const panel=$('#signupPanel');if(panel&&!$('#signupPlans')){const box=document.createElement('details');box.id='signupPlans';box.className='signup-plan-details';box.open=true;box.innerHTML=`<summary>Beneficios de Free y Pro</summary>${cards()}<p class="muted small">La cuenta se crea en Free. Pro se activa posteriormente desde la administración de NEXMIR.</p>`;panel.append(box)}}
  const previousProfile=renderProfile;
  renderProfile=function(){
    if(Date.now()-lastFetch>30000)void loadChannels();
    previousProfile();const root=$('#view-profile');if(!root)return;
    const grids=[...root.querySelectorAll(':scope > .grid')],personal=grids[0]?.children[0]?.outerHTML||'',resident=grids[0]?.children[1]?.outerHTML||'',limits=grids[1]?.children[0]?.outerHTML||'',session=grids[1]?.children[1]?.outerHTML||'',suggestions=root.querySelector(':scope > .card:not(.focus-preferences-card)')?.outerHTML||'',preferences=root.querySelector(':scope > .focus-preferences-card')?.outerHTML||'';
    const isPro=NexmirPlanRules.hasUnlimitedAccess(state.profile);
    root.innerHTML=`<div class="section-head"><div><h2>Mi perfil</h2><p class="muted">Tu cuenta, plan y progreso en un solo lugar.</p></div><span class="chip">${isPro?'PRO':'FREE'}</span></div><section class="card profile-plan-overview"><div class="section-head"><div><span class="chip">Plan actual</span><h3>${isPro?'NEXMIR Pro':'NEXMIR Free'}</h3></div></div>${!isPro?`<button class="btn primary" type="button" onclick="openProPurchase()">Adquirir Plan Pro</button>`:'<p class="muted">Tu cuenta tiene acceso a las funciones Pro.</p>'}</section><div class="profile-sections"><details open><summary>Datos de mi cuenta</summary>${personal}</details><details><summary>Comparar planes y límites</summary>${cards()}${limits}</details><details><summary>Mi progreso y logros</summary>${resident}</details><details><summary>Preferencias de estudio</summary>${preferences}</details><details><summary>Sesión y dispositivos</summary>${session}</details><details><summary>Sugerencias para NEXMIR</summary>${suggestions}</details></div>`;
  };
  window.showProUpsell=reason=>{
    if(NexmirPlanRules.hasUnlimitedAccess(state.profile))return;
    let dialog=$('#proUpsellDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='proUpsellDialog';dialog.className='dialog pro-upsell-dialog';document.body.append(dialog)}
    dialog.innerHTML=`<div class="dialog-head"><div><span class="chip">NEXMIR Free</span><h3>Continúa con Pro</h3></div><button class="icon-btn" type="button" aria-label="Cerrar" onclick="document.getElementById('proUpsellDialog').close()">×</button></div><p>${esc(reason)}</p><p class="muted">En Pro tendrás banqueo y flashcards sin límite diario, simulacros completos y batallas sin límite diario.</p><div class="dialog-actions"><button class="btn" type="button" onclick="document.getElementById('proUpsellDialog').close()">Seguir en Free</button><button class="btn primary" type="button" onclick="document.getElementById('proUpsellDialog').close();route('profile')">Ver planes</button></div>`;
    if(!dialog.open)dialog.showModal();
  };
  insertSignupBenefits();
  document.addEventListener('click',async event=>{const button=event.target.closest('.bank-copy');if(!button)return;const value=button.dataset.copy||'';try{await navigator.clipboard.writeText(value)}catch{const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();document.execCommand('copy');area.remove()}const old=button.textContent;button.textContent='Copiado';setTimeout(()=>button.textContent=old,1400)});
  window.addEventListener('nexmir:ready',loadChannels);
  window.addEventListener('nexmir:signout',()=>{channels=[];lastFetch=0});
})();
