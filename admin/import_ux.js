/* NEXMIR V5.1.56 · Utilidades de importación del panel Admin.
   1) NexmirShiftSelect: clic en una casilla y Shift+clic en otra selecciona todo el rango.
   2) NexmirHierarchy: cambia SOLO los niveles que se piden (especialidad, tema, subtema, apartado).
      Los demás niveles de cada contenido se conservan tal cual. */
(function(global){
  const anchors=new Map();
  const ShiftSelect={
    /* scope: nombre de la lista (cada lista recuerda su propia última casilla).
       orderedKeys: claves de las filas seleccionables, en el orden en que se ven.
       key: clave de la fila pulsada. set: Set con la selección.
       Devuelve la cantidad de filas cambiadas. */
    apply(scope,ev,orderedKeys,key,set){
      const checked=!!ev.target.checked,last=anchors.get(scope);
      let changed=0;const mark=k=>{if(checked!==set.has(k)){checked?set.add(k):set.delete(k);changed++}};
      const a=ev.shiftKey&&last!=null?orderedKeys.indexOf(last):-1,b=orderedKeys.indexOf(key);
      if(a>-1&&b>-1){const from=Math.min(a,b),to=Math.max(a,b);for(let i=from;i<=to;i++)mark(orderedKeys[i])}
      else mark(key);
      anchors.set(scope,key);return changed;
    },
    forget(scope){anchors.delete(scope)}
  };
  /* Mientras se mantiene Shift no se selecciona texto al hacer clic. */
  const body=()=>document.body;
  addEventListener('keydown',e=>{if(e.key==='Shift')body()?.classList.add('shiftDown')});
  addEventListener('keyup',e=>{if(e.key==='Shift')body()?.classList.remove('shiftDown')});
  addEventListener('blur',()=>body()?.classList.remove('shiftDown'));

  const FIELDS=['specialty','topic','subtopic','section'];
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const Hierarchy={
    FIELDS,
    /* row: contenido actual. changes: solo los campos a cambiar, p. ej. {specialty:'Hematología'}.
       Un campo ausente NO se toca. Un valor null o '' en subtema/apartado lo deja vacío. */
    patch(row,changes={}){
      const T=global.RemnoteTaxonomy;
      const next={specialty:row.specialty,topic:row.topic??'General',subtopic:row.subtopic??null,section:row.section??null};
      if(own(changes,'specialty')){
        const sp=T.canonical(changes.specialty);
        if(T.unclassified(sp))throw new Error('Elige o escribe una especialidad antes de guardar.');
        next.specialty=sp;
      }
      if(own(changes,'topic'))next.topic=T.cleanLabel(changes.topic)||'General';
      if(own(changes,'subtopic'))next.subtopic=T.cleanLabel(changes.subtopic)||null;
      if(own(changes,'section'))next.section=T.cleanLabel(changes.section)||null;
      return {...next,path:[next.specialty,next.topic,next.subtopic,next.section].filter(Boolean),classification_origin:'admin_manual'};
    },
    /* Cuenta los valores distintos de cada nivel para mostrar qué se conserva. */
    distinct(rows){
      const out={};for(const f of FIELDS)out[f]=[...new Set(rows.map(r=>String(r[f]??'').trim()).filter(Boolean))];
      return out;
    }
  };
  global.NexmirShiftSelect=ShiftSelect;global.NexmirHierarchy=Hierarchy;
})(window);
