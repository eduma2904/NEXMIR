# NEXMIR 5.1.17

- Código Vital: botón Ampliar en la esquina superior derecha. X roja o Escape
  para volver sin reiniciar la partida. Si el navegador no permite pantalla
  completa nativa, el juego ocupa toda la ventana.
- Admin → Arcade: tema opcional, con sugerencias según la especialidad y los
  contenidos existentes. Puedes escribir un tema nuevo o dejarlo vacío.
  El tema se conserva al editar y aparece en la lista y la previsualización.
  También puedes buscar preguntas por tema. No cambia las categorías del juego.
- Las respuestas formadas por varias palabras muestran espacios y mantienen
  las palabras agrupadas cuando cabe. Los casos iniciales «Proteinosis alveolar»
  y «Lavado alveolar» se corrigen si nadie ha modificado la respuesta original.
- Light explica los tres criterios de exudado y cómo reconocer el trasudado;
  el editor recuerda detallar ambos resultados en criterios comparativos.
- El editor admite una imagen opcional de respuesta (JPG, PNG o WebP, hasta
  5 MB). Se revela al finalizar la partida junto a la explicación. Para jugar
  al ahorcado se sigue introduciendo el nombre de la respuesta en letras.

## Actualizar desde 5.1.16

1. Ejecuta `supabase/ARCADE_TEMAS_5_1_17.sql` en Supabase SQL Editor para añadir
   tema, ruta de imagen y el depósito privado de imágenes. Actualiza solo los
   valores iniciales que siguen intactos. No borra preguntas ni cambia las
   políticas de acceso al banco; añade políticas para las imágenes.
2. Publica todo el contenido de `nexmir`, incluidas `admin` y `arcade`.
3. Recarga NEXMIR. Prueba Ampliar, la X y Escape; guarda una pregunta con tema,
   una sin tema y otra con imagen desde Admin → Arcade.

Para una instalación nueva, utiliza `supabase/ARCADE.sql`, que ya incluye todo.

Validación: pruebas de lógica con DOM simulado y revisión de sintaxis.
La ejecución SQL y la comprobación en tu navegador quedan para la instalación.
