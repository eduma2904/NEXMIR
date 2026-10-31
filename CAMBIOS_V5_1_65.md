# NEXMIR V5.1.65

Seguimiento de estudio: cerrar el ciclo estudiar, fallar, corregir.

## Mis errores
- Nueva pestaña **Superadas**: una pregunta pasa ahí cuando sus **dos últimos intentos válidos fueron correctos** (un solo acierto no basta; las marcadas como dudosas no pasan). Ya no aparecen en Hoy, Próximos ni Todos.
- Filtro por **especialidad** con el número de errores pendientes de cada una.
- Botón **Rehacer estos errores**: abre un banqueo con corrección inmediata con las preguntas de la lista visible (pestaña y especialidad). Máximo 100 por sesión, al azar.
- "Practicar errores de hoy" queda cubierto por la pestaña Hoy más ese botón.
- Las tarjetas ya acertadas muestran la etiqueta "Ya acertada".

## Marcadas
- Las preguntas marcadas tienen **Resolver** y **Quitar**, y toda la fila abre la pregunta.
- Nuevo botón **Practicar preguntas marcadas** (aparece con 2 o más).
- Corrección: las preguntas marcadas que venían de tarjetas tipo test (RemNote) no aparecían en la lista; ahora sí.
- Quitar una marca actualiza la lista al instante y avisa si falla el borrado.

## Resultados del banqueo
- La revisión final abre en una pestaña **Resumen** (también disponible con el enlace "Resumen" del panel y "Volver al resumen" en cada pregunta).
- Resumen: tiempo total, **tiempo medio por pregunta**, desglose **por tema** de más débil a más fuerte, y botones **Repetir las falladas**, **Repetir falladas y en blanco** y **Ver Mis errores**.
- Se mide el tiempo por pregunta (tramos inactivos de más de 3 minutos cuentan 3) y se conserva al reanudar el banqueo.

## Modo "Al final"
- Se elimina el aviso "Respuesta guardada" en cada respuesta. El estado aparece en la línea de guardado de la propia pregunta.

## Teclado
- La pista del banqueo se escribe desde el origen como "Teclado: 1–N o A–E · N siguiente · P anterior" (antes se corregía después de dibujarla).

## Encabezado compacto en pantallas táctiles
- Los controles se ven igual de bajos (30 a 34 px), pero su zona pulsable llega a 40 a 44 px con un área invisible. V5.1.64 había reducido a 30 a 32 px lo que `product_polish.css` ya exigía en 44 px en móvil.
- Más separación entre los botones de tamaño de texto y entre las filas del encabezado de Focus para que las zonas no se solapen.

## Otros
- Título de la pestaña actualizado a V5.1.65 (decía V5.1.50).
- Nuevas pruebas automáticas en `tools/test-v5-1-65.mjs` (requiere `npm install` en `tools`, que añade jsdom solo para pruebas). `npm run build` las ejecuta.

## Criterio de "Superadas"
- Se exigen dos aciertos seguidos. Para cambiarlo, ajusta `DONE_STREAK` en `study_clarity.js`.
