# NEXMIR V5.1.64

## Encabezados compactos (banqueo, simulacro y Focus)
- Nuevo `study_compact_5_1_64.css` (carga justo antes de `text_flow_guard.css`).
- Focus: título, ruta, reloj, válidas, tamaño de texto, Ayuda y Terminar pasan a una sola franja baja en escritorio; en móvil, dos filas finas.
- Banqueo y simulacro: cabeceras, contadores y barra de resaltado reducidos; botones de control de 30 a 32 px.
- Corrección: las filas del encabezado ya no se encogen (flex:0 0 auto), lo que evitaba que la ruta se pisara con el contador en banqueo.
- Móvil horizontal o ventanas bajas (alto menor de 560 px): se ocultan ruta, chip y textos de apoyo para dar todo el espacio a la pregunta.

## Símbolos extraños en preguntas
- `cleanRemnoteMarks` elimina `[[ ]]`, `{{ }}`, referencias `((id))`, escapes `\*`, enlaces `[texto](url)`, corchetes vacíos o sin pareja.
- `mdInline` elimina asteriscos, `__` y `~~` que quedan sin pareja y espacios iniciales sobrantes.
- Se conservan corchetes con sentido clínico, como [Ca2+], imágenes y negrita/cursiva válidas.
- Regresiones nuevas en `tools/test-v5-1-63.mjs`.
