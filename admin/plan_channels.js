/* Canales Pro: configuración editorial, sin cobro ni activación automática. */
(()=>{
  const root=document.getElementById('planChannelList'),message=document.getElementById('planChannelMessage');
  let rows=[],draft=false;
  const safe=s=>esc(String(s??''));
  function valid(kind,target){
    if(kind==='url')return /^https:\/\/[^\s]+$/i.test(target);
    if(kind==='email')return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target);
    return /^\d{8,15}$/.test(target);
  }
  function field(row){const id=row.id||'new';return `<div class="cardBox plan-channel-admin" data-id="${safe(id)}"><div class="grid2"><label class="fieldLabel">Nombre visible<input class="pcLabel" maxlength="80" value="${safe(row.label||'')}"></label><label class="fieldLabel">Tipo<select class="pcKind"><option value="url" ${row.kind==='url'?'selected':''}>Enlace HTTPS</option><option value="email" ${row.kind==='email'?'selected':''}>Correo</option><option value="whatsapp" ${row.kind==='whatsapp'?'selected':''}>WhatsApp</option></select></label></div><label class="fieldLabel">Enlace, correo o número internacional<input class="pcTarget" maxlength="500" value="${safe(row.target||'')}" placeholder="https://… / correo@… / 51999999999"></label><label class="fieldLabel">Descripción breve<input class="pcDescription" maxlength="300" value="${safe(row.description||'')}"></label><div class="plan-channel-admin-actions"><label><input class="pcActive" type="checkbox" ${row.active?'checked':''}> Publicado</label><label>Orden<input class="pcOrder" type="number" value="${Number(row.sort_order)||0}"></label><button class="primary pcSave" type="button">Guardar</button>${row.id?'<button class="secondary pcDelete" type="button">Eliminar</button>':'<button class="secondary pcCancel" type="button">Cancelar</button>'}</div></div>`}
  function render(){root.innerHTML=(draft?field({kind:'url'}):'')+rows.map(field).join('')||'<div class="cardBox">Todavía no hay canales. Puedes añadir uno cuando decidas cómo ofrecer Pro.</div>';root.querySelectorAll('.pcSave').forEach(b=>b.onclick=()=>save(b.closest('[data-id]')));root.querySelectorAll('.pcDelete').forEach(b=>b.onclick=()=>remove(b.closest('[data-id]').dataset.id));root.querySelectorAll('.pcCancel').forEach(b=>b.onclick=()=>{draft=false;render()})}
  async function load(){
    if(!cloudMode||!sb||cloudRole!=='admin'){message.textContent='Inicia sesión como administrador.';return}
    message.textContent='Cargando canales…';const {data,error}=await sb.from('plan_purchase_channels').select('*').order('sort_order');
    if(error){message.textContent='No se pudieron cargar. Ejecuta supabase/MEJORAS_ESTUDIO_PLANES_5_1_36.sql. '+error.message;return}
    rows=data||[];message.textContent=rows.length?`${rows.length} canal(es) configurado(s).`:'Aún no hay canales publicados.';render();
  }
  async function save(card){
    const id=card.dataset.id,label=card.querySelector('.pcLabel').value.trim(),kind=card.querySelector('.pcKind').value,target=card.querySelector('.pcTarget').value.trim(),description=card.querySelector('.pcDescription').value.trim(),active=card.querySelector('.pcActive').checked,sort_order=Number(card.querySelector('.pcOrder').value)||0;
    if(label.length<2||!valid(kind,target)){message.textContent='Revisa el nombre y el destino. Usa un enlace HTTPS, un correo válido o un número de WhatsApp con código de país.';return}
    const button=card.querySelector('.pcSave');button.disabled=true;
    const payload={label,kind,target,description,active,sort_order,updated_at:new Date().toISOString()};
    const {error}=id==='new'?await sb.from('plan_purchase_channels').insert(payload):await sb.from('plan_purchase_channels').update(payload).eq('id',id);
    button.disabled=false;if(error){message.textContent='No se guardó: '+error.message;return}draft=false;await load();message.textContent='Canal guardado.';
  }
  async function remove(id){if(!confirm('¿Eliminar este canal de adquisición?'))return;const {error}=await sb.from('plan_purchase_channels').delete().eq('id',id);if(error){message.textContent=error.message;return}await load();message.textContent='Canal eliminado.'}
  document.querySelector('[data-view="plans"]')?.addEventListener('click',()=>setTimeout(load,0));
  document.getElementById('planChannelAdd')?.addEventListener('click',()=>{draft=true;render();root.querySelector('.pcLabel')?.focus()});
})();
