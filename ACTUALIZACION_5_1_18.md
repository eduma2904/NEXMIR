# NEXMIR 5.1.18 · Arcade y Panel Admin

Para actualizar desde 5.1.17:

1. Ejecuta `supabase/ARCADE_5_1_18.sql` en el SQL Editor de Supabase.
   La migración no borra preguntas ni reportes. Amplía las respuestas a 160
   caracteres, permite imagen en el enunciado y habilita reportes de Arcade.
   Requiere que ya existan `arcade_questions` y `question_reports`.
2. Publica la carpeta `nexmir` completa y recarga también el panel Admin.

Para instalar Arcade desde cero en una base NEXMIR que ya tiene los reportes,
ejecuta `supabase/ARCADE.sql` y después `supabase/ARCADE_5_1_18.sql`.

La sesión Admin se conserva mediante el almacenamiento de Supabase y renueva
automáticamente el token mientras sea válido. Cerrar sesión, borrar los datos
del navegador o revocar la cuenta obliga a identificarse de nuevo. Las preguntas
ya guardadas permanecen en Supabase. El editor Arcade también conserva un
borrador de texto en este navegador; por seguridad, el archivo de imagen debe
elegirse otra vez al recargar.

En Admin, las áreas de texto usan revisión ortográfica del navegador en español.
Las sugerencias y autocorrección dependen del navegador y el sistema operativo;
no se cambian términos médicos automáticamente sin revisión.

En PC, Código Vital acepta letras del teclado físico aunque el foco esté en el
botón de ampliar; en móvil se toca el teclado en pantalla. El botón Reportar
pregunta abre un formulario que llega a Reportes del panel Admin. El canal de
reporte se reutiliza en los siguientes juegos de Arcade.

No hay límite de tres palabras para la respuesta: el máximo es 160 caracteres,
con letras, tildes, Ñ, espacios y guiones. Números y otros signos no son válidos
en el ahorcado. La imagen de la pregunta se ve durante la partida; la imagen
de la respuesta aparece al terminarla.
