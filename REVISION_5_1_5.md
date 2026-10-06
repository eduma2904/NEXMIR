# Revisión de producto NEXMIR 5.1.5

Fecha: 5 de octubre de 2026. Base: NEXMIR_V5_1_4_AJUSTADO.zip.

## Dirección y alcance

NEXMIR es una herramienta diaria de preparación médica. La prioridad es resolver, repasar y volver a estudiar sin fricción. Se conserva su identidad: paletas azul, verde, naranja y rosa, temas claro/oscuro, mascota, navegación, contenido y tono cercano.

La revisión comenzó con el inventario completo del ZIP, la arquitectura de scripts y hojas de estilo, los flujos de preguntas, persistencia y corrección, las extensiones de Focus, personalización, importación y administración, el esquema de migraciones y las pruebas existentes. Se capturó la interfaz original antes de modificarla.

Tecnología: HTML/CSS/JavaScript sin framework ni compilación, Supabase JS local, PostgreSQL/RLS y Edge Function de clasificación; JSZip y PDF.js para importación; Playwright y PGlite para pruebas. No se cambiaron los contratos SQL, permisos, planes, límites, rutas, datos, credenciales ni bibliotecas de producción.

## Referencias consultadas

Se consultaron las versiones públicas disponibles durante esta revisión. Se usaron como referencias complementarias, priorizando las instrucciones de conservación de NEXMIR sobre sugerencias para crear productos desde cero.

- [Impeccable, skill original](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md): auditoría técnica, accesibilidad y coherencia; referencias de auditoría y acabado.
- [Taste Skill, design-taste-frontend](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md): composición, densidad y dirección visual. Ajuste deliberadamente conservador para un producto existente; no se adoptaron nuevas librerías o patrones de landing page.
- [Emil Design Engineering, skill original](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md): feedback inmediato, transiciones discretas, rendimiento y movimiento reducido.

## Auditoría y decisiones

| Prioridad / tamaño | Antes | Después | Motivo |
| --- | --- | --- | --- |
| P1 / mediano | El botón Guardar respuesta convivía con una selección ya retenida en memoria; el contador no se actualizaba al instante | Selección guardada al clic, confirmación local y contador inmediato | Eliminar la ambigüedad entre elegir, conservar y corregir |
| P1 / mediano | Cerrar el banco eliminaba su punto de recuperación | Borrador conservado y acceso Continuar banqueo | Continuidad entre sesiones en este navegador |
| P1 / localizado | Una selección sin corregir en modo inmediato podía llegar al resumen sin registro de intento | La entrega guarda esas selecciones y conserva las ya corregidas | Historial coherente con el resultado |
| P1 / mediano | Radios simulados contenían botones de descarte; simulacros dependían del ratón o números | Botones independientes de elección y descarte; grupo de alternativas, estado accesible, flechas/Home/End | Operación por teclado y semántica comprensible |
| P1 / pequeño | Texto blanco sobre degradados claros en botones principales | Color de acción sólido y contraste verificado en ocho combinaciones de tema/paleta | Legibilidad estable |
| P1 / pequeño | Mínimo de 360 px en el diálogo de preguntas | Banqueo adaptado a 320 px y controles táctiles de 44 px en móvil | Evitar recortes en pantallas estrechas |
| P2 / pequeño | Dos acciones de finalización por pantalla | Una entrega por pantalla de banco y simulacro | Menos decisiones repetidas |
| P2 / mediano | Enunciados excesivamente pesados; controles de descarte rojos compiten con la respuesta | Peso tipográfico moderado y descartes neutros; selección con borde, fondo y marca | Priorizar lectura y elección |
| P2 / mediano | Sombras amplias en casi todas las tarjetas, transparencias en cabeceras y herramientas | Sombras suaves, superficies sólidas y métricas agrupadas | Menor ruido visual conservando identidad |
| P2 / pequeño | Acciones del administrador se comprimían en varias líneas estrechas | Filas flexibles con ancho suficiente | Mejor lectura y uso de herramientas |
| P2 / pequeño | Importación avanzada oculta en móvil | Acceso conservado en la navegación móvil administrativa | Evitar que desaparezcan funciones |
| P2 / pequeño | Cierres sin nombre, avisos sin anuncio accesible, navegación sin estado actual | Etiquetas de cierre, regiones de estado y aria-current | Mejor orientación |
| P3 / pequeño | Movimiento y elevación al pasar por elementos de uso frecuente | Transiciones de 140 ms; entrada de diálogos de 180 ms; sin saltos de navegación | Respuesta rápida sin distracción |

No se hizo una reestructuración de componentes o del enrutado: habría ampliado el riesgo sin resolver la necesidad principal. El renderizado de elección/descarte de banco y simulacro sí se comparte para evitar nuevas diferencias.

## Cobertura por superficie

- Acceso: etiquetas existentes conservadas; feedback anunciado, foco y contraste compartidos.
- Inicio: jerarquía, densidad, sombras, métricas y accesos por teclado. Se mantienen la mascota y el arte original.
- Estudio, repasos, errores, marcadas, progreso, plaza y plan: revisión del renderizado y del desbordamiento, con mejoras compartidas en botones, formularios y superficies.
- Banqueo: selección, recuperación, navegación, descarte, teclado, corrección inmediata/diferida, estados de envío y revisión.
- Simulacros: selección conservada, navegación, recarga, teclado, descarte, estados visuales y entrega sin duplicar su botón. Se conservan reglas de tiempo, reservas y netas.
- Focus: reglas y backend conservados; se respetan tamaño de texto, contraste, preferencia de movimiento y componentes comunes. No se cambian ritmo, XP, racha ni repetición.
- Administración: cabecera, navegación, botones, formularios, agrupación de acciones, tablas con desplazamiento interno, importación y revisión en móvil.
- Imágenes: zoom, controles, límites de tamaño y redimensionado verificados con las pruebas existentes.
- Modales y popovers: se mantienen los diálogos nativos y su interacción modal; se mejoran nombres accesibles, entrada discreta y límites de viewport. No se incorpora otra biblioteca.
- Loading, error, success y empty: se conservan los indicadores reales y mensajes de contenido vacío, y se añaden estados explícitos de selección/almacenamiento. No se simulan cargas con skeletons que no corresponden a una operación real.

## Motion

La elección de respuestas no espera una animación. Solo las transiciones visuales ligeras de controles usan 140 ms; la entrada ocasional de diálogos usa 180 ms con `cubic-bezier(.23,1,.32,1)` y desplazamiento de 5 px más opacidad. No se animan dimensiones de preguntas ni se añaden efectos de scroll. Se respeta `prefers-reduced-motion` y la preferencia existente de Focus. Los efectos de presión/hover nuevos se limitan a dispositivos con puntero preciso.

## Verificación

- 6 pruebas unitarias: reglas de contenido y Focus, aprobadas.
- Pruebas PostgreSQL locales: migración repetible, MCQ completas, sincronización de edición, archivo/restauración/eliminación y restricciones de acceso, aprobadas.
- Suite UI original: zoom, bloqueo de atajos durante el visor, redimensionado por ratón/teclado, MCQ de 2/5 opciones, creación de batallas, importación combinada, filtros/selección/borrado local, PDF y diseño móvil, aprobada.
- Nueva suite de respuestas: selección, contador, navegación adelante/atrás, teclado, descarte/recuperación, recarga, cierre/continuación, corrección inmediata, error de almacenamiento, fallo de entrega del banco y reintento sin repetir intentos confirmados, aprobada.
- Simulacro: selección, avance/retroceso, persistencia local, recarga y teclado, aprobados.
- Banqueo sin desbordamiento en 320, 390, 768, 1024 y 1440 px.
- Pantallas de estudiante revisadas a 390, 768 y 1440 px; administración en esos mismos tamaños. Sin errores de script en las pruebas completadas.
- Botones principales: contraste de texto entre 5,55:1 y 6,23:1 en claro; entre 9,06:1 y 10,06:1 en oscuro.
- Revisión visual antes/después, corrección de alineación de descartes y comprobación final de temas y móvil.

Las pruebas se ejecutaron localmente con datos ficticios y las conexiones externas del navegador bloqueadas. No acreditan un despliegue real, una auditoría completa WCAG, funcionamiento en Safari/Firefox, lectores de pantalla o todos los flujos con un Supabase de producción. No se modificó ni ejecutó SQL contra tu base real.

## Archivos principales

- `app.js`: selección compartida, contador, estado local, navegación y entrega del banqueo.
- `study_resume.js`: recuperación y aviso de fallos de almacenamiento.
- `product_polish.css`: acabado visual, temas, responsive y motion.
- `interaction_polish.js`: semántica, avisos, cierres y teclado.
- `dashboard.js`: limpieza de jerarquía y accesos operables por teclado.
- `ui_refinements.js`: mensaje de carga específico al enviar respuestas.
- `index.html` y `admin/index.html`: recursos y versión.
- `tests/answer_flow.test.cjs`: nuevas regresiones; la suite anterior se hizo portable en las rutas de sus capturas.

Se incluyen todos los archivos originales no modificados. Las licencias y los proveedores locales se conservan. No se entrega `node_modules`, cachés de prueba ni datos ficticios dentro de la aplicación.
