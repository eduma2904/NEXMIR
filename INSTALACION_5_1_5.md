# NEXMIR 5.1.5

Actualización de interfaz y guardado de selecciones sobre el ZIP NEXMIR_V5_1_4_AJUSTADO.

## Actualizar la web

1. Conserva una copia de la carpeta actualmente publicada.
2. Reemplaza sus archivos por el contenido de `nexmir/` de este ZIP, incluidos los dos archivos nuevos `product_polish.css` e `interaction_polish.js`.
3. Recarga la web con Ctrl + F5. Los recursos corregidos llevan la versión 5.1.5.2 para renovar la caché.

Este ajuste permite que los enunciados sin imagen ocupen el ancho del modal y que las preguntas de Focus aprovechen el ancho disponible en escritorio. En móvil se conserva el desplazamiento vertical dentro de la pantalla de estudio.

El simulacro mantiene ahora el modal anclado al viewport al empezar y al reanudar, incluso si la página estaba desplazada. El administrador dispone de «Eliminar pregunta» al resolver y revisar preguntas del banco y del simulacro, en el registro de errores y en Focus; las flashcards conservan su botón de eliminación. Cada eliminación pide confirmación y usa las mismas comprobaciones de permisos del servidor.

Esta actualización **no requiere una migración SQL nueva**. Los SQL, las funciones de Supabase y las integraciones de 5.1.4 se conservan sin cambios. Si todavía no habías instalado la base de 5.1.4, sigue primero sus instrucciones existentes.

## Cómo se guardan las respuestas

- Banqueo con corrección al final: elegir una alternativa guarda la selección inmediatamente en este navegador. Puedes cambiarla y pasar a Siguiente o Anterior sin confirmarla. Ya no aparece «Guardar respuesta».
- El contador se actualiza al elegir. El texto «Selección guardada en este navegador» confirma la elección; no significa que ya se haya corregido o enviado a Supabase.
- «Finalizar y enviar» corrige y envía el bloque al historial con la lógica existente. Si un envío del banqueo falla, sus respuestas siguen disponibles y el reintento omite los intentos confirmados.
- Banqueo con corrección inmediata: la elección también se conserva automáticamente; «Responder» mantiene su función de revelar y registrar la corrección. Al finalizar se envían también las selecciones que aún no habías corregido, sin repetir las ya confirmadas.
- Cerrar el banqueo conserva el borrador. En Banqueo aparece «Continuar banqueo». Una recarga permite restaurarlo. Iniciar otro banco sustituye el borrador del bloque anterior, como sesión de estudio actual.
- Los simulacros mantienen su guardado automático, su cronómetro y su sistema de entrega. Se ha añadido el mismo lenguaje visual de selección y soporte de teclado.
- Si el navegador bloquea o agota el almacenamiento local, se muestra un aviso y la elección permanece en la sesión abierta. No cierres esa pestaña antes de enviar. Los borradores locales no se sincronizan entre dispositivos y no sobreviven al borrado de los datos del navegador.

## Validación local

La web continúa siendo estática, sin compilación ni nuevas dependencias de producción. Las dependencias de pruebas ya existían en 5.1.4.

En `tests/`:

```sh
npm ci
npm run test:unit
npm run test:db
npm run test:answers
```

`test:answers` inicia su propio servidor local, bloquea las conexiones externas y usa datos ficticios. En Windows usa Microsoft Edge; en otras plataformas usa el Chromium instalado para Playwright. `CHROMIUM_PATH` permite indicar otro ejecutable. Las capturas se guardan en la carpeta temporal del sistema o en `NEXMIR_SCREENSHOT_DIR`.

Para `npm run test:ui`, mantén la web servida en `http://127.0.0.1:4173` y configura `CHROMIUM_PATH` si corresponde. También admite `NEXMIR_TEST_URL`.

La actualización se probó localmente en Edge/Chromium. No se ha publicado ni aplicado nada a tu Supabase real; Safari, Firefox, lectores de pantalla y dispositivos físicos no fueron probados.
