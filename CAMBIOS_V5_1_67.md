# NEXMIR V5.1.67

Accesibilidad por teclado, navegación entre subtemas y limpieza de producción. Incluye lo de V5.1.66 (subtema elegido sombreado con el color de la paleta).

## Teclado y lectores de pantalla
- Nuevo `keyboard_access.js`: las tarjetas de asignatura y tema, las filas de contenido, cuadros y marcadas, y las imágenes ampliables (todas `<div onclick>` o `<img onclick>`) reciben `tabindex="0"` y, si no contienen otros botones, `role="button"`. Responden a **Enter** y **Espacio**.
- Se aplica también a lo que se dibuja después (ventanas, listas, resultados de búsqueda de contenido).
- Anillo de foco visible con el color de la paleta. Las filas marcadas (que llevan botones propios) son enfocables, pero sus botones siguen funcionando por separado.
- No se tocan las funciones existentes ni el panel Admin.

## Subtemas
- Al elegir un subtema con el clic, la vista baja a la lista de contenidos si esta queda lejos o fuera de pantalla (respeta "reducir movimiento"). No se desplaza al volver de abrir un contenido ni al venir desde el buscador.
- Cada subtema muestra: total de contenidos, **tarjetas pendientes** (nuevas o vencidas) del total, y **bloques de teoría leídos** del total (usa el progreso de "Estudiar en orden").
- Corrección de V5.1.66: `aria-pressed` del subtema elegido no se actualizaba por leer `window.state` (es una constante global, no una propiedad de window).

## Producción
- Los 8 `console.warn` de `app.js` pasan por `nxDebug`: silenciosos por defecto. Para verlos: `localStorage.setItem('nexmir_debug','1')`. Los `console.error` se conservan.
- Todos los `?v=` locales de `index.dev.html` y el del iframe de Criteria Rush quedan en 5.1.67 (el de `vendor/supabase.js` conserva el de la librería).
- La prueba de V5.1.63 ya no fija un número de versión concreto.

## Pruebas
- Nuevo `tools/test-v5-1-67.mjs` (teclado, contadores y aria-pressed); `npm run build` lo ejecuta.

## Pendiente
Quedan `console.warn` en otros archivos (focus.js, study_*.js, arcade.js, etc.); no se tocaron para limitar el alcance.
