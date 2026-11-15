# NEXMIR V5.1.66

Subtema elegido visible en Estudio (teoría y flashcards) y en los filtros de Repaso.

## Causa del problema
La regla `.sub-clickable.sub-active` (V5.1.34) sí se aplicaba, pero perdía contra `.card{background:...!important;border:...!important}` de `styles.css`, así que el subtema elegido no cambiaba de aspecto.

## Cambios
- Nuevo `subtopic_active_5_1_66.css` (carga justo antes de `text_flow_guard.css`): el subtema elegido se sombrea con el color de la paleta activa (`--n-primary`: verde, azul, rosa o naranja), con borde, sombra suave, texto en el color de la paleta y una marca ✓ en la esquina. Funciona en modo claro y oscuro.
- Nuevo `subtopic_active.js`: marca `aria-pressed` en el subtema elegido (lectores de pantalla) y sombrea los filtros de Repaso (asignatura, tema y subtema) cuando tienen un valor distinto de "Todos".
- El anillo de foco del teclado en los subtemas usa el color de la paleta.
- Título de la pestaña y prueba automática actualizados a V5.1.66.

## Sin cambios
No se tocó lógica de datos, Supabase ni permisos. `npm run build` pasa todas las pruebas.
