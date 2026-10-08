/* Browser spellchecking for hand-edited Spanish questions; never rewrites medical terms silently. */
document.addEventListener('focusin',event=>{
 const field=event.target;
 if(!field.matches?.('textarea'))return;
 field.lang='es';field.spellcheck=true;
 field.setAttribute('autocorrect','on');
});
