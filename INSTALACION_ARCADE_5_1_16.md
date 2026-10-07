# NEXMIR 5.1.16 - Arcade

Basado en NEXMIR_V5_1_15_REVISION_FOCUS(2).zip y Código Vital v3.
Esta entrega es un paquete de archivos: no se ha publicado en tu web ni se ha ejecutado SQL en tu proyecto.

## Instalar

1. Conserva una copia de tu versión publicada.
2. En Supabase, abre SQL Editor y ejecuta `supabase/ARCADE.sql`.
   No borra bancos previos. Crea `arcade_questions` y carga 16 casos iniciales
   (10 de Neumología, 5 de Enfermedades Infecciosas y 1 de Endocrinología).
   Repetir el SQL no sobrescribe los cambios en los casos iniciales.
3. Publica TODO el contenido de la carpeta `nexmir`, incluidas las carpetas
   `arcade`, `admin` y `assets`. No basta con reemplazar index.html.
4. Abre NEXMIR y entra en Arcade. Verás el catálogo con Código Vital.
5. En Admin → Arcade · Preguntas, inicia sesión como admin y pulsa Actualizar.
   Crea una pregunta, previsualízala, marca Publicada y guarda.
6. Vuelve a Juegos y abre Código Vital otra vez para recargar el contenido.
7. Comprueba el tutorial desde Guía y el PDF de Perfil (ahora tiene 4 páginas).

## Incluido

- Sección Arcade independiente en la navegación y catálogo de juegos.
- Código Vital conserva su personaje y diseño; hereda color y modo de NEXMIR.
- Catálogo canónico de especialidades, más las detectadas en los contenidos.
- Preguntas cargadas desde Supabase, sin claves privadas ni una sesión adicional.
- Editor admin con especialidad, categoría, respuesta, pista, explicación,
  publicación/borrador, búsqueda, filtros y previsualización.
- Retirada reversible: desmarcar Publicada en lugar de borrar.
- Control de concurrencia al editar y políticas RLS: solo admin modifica;
  usuarios autenticados solo leen preguntas publicadas. No se concede edición a moderator.
- Tildes, Ñ, espacios y guiones admitidos en las respuestas. Los separadores
  no consumen intentos. Preguntas siempre terminadas en interrogación.
- Selector cancelable por botón, Escape o fondo, sin perder el caso actual.
- Tutorial ampliado y guía PDF original conservada con dos páginas de Arcade.

## Límites deliberados

- Disponible para Free y Pro, sin consumir cuotas ni otorgar XP o racha diaria.
- La racha del juego es local a la sesión del juego; no persiste al recargar.
- Solo hay un juego implementado. Añadir otro requiere implementar su lógica.
- Las preguntas iniciales son el banco aprobado en el prototipo, no una nueva
  revisión de guías clínicas. El admin debe revisar ambigüedades y actualizaciones.

## Comprobación

Se han ejecutado pruebas de lógica de Arcade, regresiones de clasificación y Focus,
validación de sintaxis JavaScript y revisión visual de las páginas PDF añadidas.
Las pruebas Arcade usan un DOM simulado; no equivalen a una prueba visual en navegador.
Las políticas SQL se revisaron estáticamente; la conexión real y las políticas deben
confirmarse en Supabase tras ejecutar ARCADE.sql. No se accedió a datos reales.

Desde la carpeta nexmir:
`node --test tests/arcade.test.cjs tests/content_rules.test.js tests/focus_rules.test.js`

Después de instalar, verifica como estudiante y como admin: entrar a Arcade,
cerrar el selector sin cambios, jugar, cambiar tema, publicar/retirar una pregunta
y confirmar que un estudiante no puede modificar la tabla.
