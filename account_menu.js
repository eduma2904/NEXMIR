/* Accessible account menu, including touch and narrow screens. */
(() => {
  const avatar=document.getElementById('userAvatar'),menu=document.getElementById('accountMenu');
  if(!avatar||!menu)return;
  const items=()=>[...menu.querySelectorAll('button')];
  function close(focus=false){menu.hidden=true;avatar.setAttribute('aria-expanded','false');if(focus)avatar.focus()}
  function open(){
    menu.hidden=false;avatar.setAttribute('aria-expanded','true');
    const r=avatar.getBoundingClientRect();
    menu.style.top=(r.bottom+8)+'px';menu.style.right=Math.max(8,window.innerWidth-r.right)+'px';
    const label=document.getElementById('accountMenuName');if(label)label.textContent=profileName();
  }
  avatar.addEventListener('click',()=>{if(menu.hidden)open();else close()});
  avatar.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open();items()[event.key==='ArrowUp'?1:0].focus()}});
  menu.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close(true)}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const list=items(),i=list.indexOf(document.activeElement);list[event.key==='Home'?0:event.key==='End'?list.length-1:(i+(event.key==='ArrowDown'?1:-1)+list.length)%list.length].focus()}
  });
  document.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!avatar.contains(event.target))close()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden)close(true)});
  document.addEventListener('focusin',event=>{if(!menu.hidden&&!menu.contains(event.target)&&event.target!==avatar)close()});
  window.addEventListener('resize',()=>close());
  window.addEventListener('nexmir:signout',()=>close());
  document.getElementById('accountProfileBtn').addEventListener('click',()=>{close();route('profile')});
  document.getElementById('accountLogoutBtn').addEventListener('click',()=>{close();void logout()});
})();
