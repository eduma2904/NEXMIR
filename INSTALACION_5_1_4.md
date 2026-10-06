# NEXMIR 5.1.4

Reemplaza la carpeta de la web por el contenido de `nexmir/` y actualiza la página
con Ctrl + F5. Se conserva la conexión Supabase que ya utilizas.

Antes de publicar nuevas preguntas MCQ desde «Importar contenido», ejecuta
`supabase/TEST_CONTENT_SYNC.sql` en el SQL Editor de tu proyecto Supabase.
Se aplica sobre el esquema existente de NEXMIR; conserva las migraciones que
ya tenías instaladas. Haz un respaldo de tu base antes de aplicar la migración.

Esta migración crea las preguntas test correspondientes a las MCQ ya publicadas.
Una MCQ conserva su tarjeta original para estudio y su representación en el banco
para batallas. Los cambios de texto, respuestas, clasificación y estado se
sincronizan entre ambas; archivar o eliminar no deja una copia activa.
Las flashcards básicas, cloze, reversas, bidireccionales, ordenadas y multilínea
no se convierten en preguntas test. Las MCQ incompletas quedan como borradores
en el banco hasta corregirse.

La actualización y la migración se han probado localmente. No se han desplegado
ni aplicado a tu proyecto real de Supabase desde esta tarea.

## Importación

1. En «Importar contenido», elige un ZIP, Markdown o PDF.
2. El panel muestra el contenido detectado y pregunta por su tipo.
3. Banco y Simulacro conservan las MCQ; Flashcards conserva las tarjetas;
   Teoría conserva los bloques teóricos. Las MCQ también se incluyen cuando
   eliges Flashcards o Teoría, y se habilitan en los modos test.
4. Combinado conserva todas las categorías. Un ZIP con Markdown y PDF se reúne
   en una sola revisión. Indica si los PDF contienen preguntas, soluciones
   o imágenes. Los PDF de preguntas pueden estar completos o separados.
5. Revisa la clasificación y las respuestas antes de publicar.

Los ZIP de teoría y flashcards deben contener Markdown de RemNote. El lector PDF
actual está orientado a preguntas test numeradas con cuatro alternativas y no
hace OCR de documentos escaneados. Las MCQ de Markdown admiten dos o más
alternativas, sin truncarlas a cuatro. Los formatos no compatibles se indican
en la vista previa. La detección por carpetas y el clasificador gratuito se
conservan; las especialidades personalizadas siguen siendo válidas.

Cambiar de pestaña o buscar elimina de la selección los contenidos que quedan
fuera del filtro. «Seleccionar este filtro» solo selecciona sus preguntas.
En la revisión paginada de Markdown, «Seleccionar visibles» selecciona la
página y «Seleccionar todo el filtro» abarca todas sus páginas. Los registros
«Sin cambios» se muestran para consulta y no se vuelven a publicar.

## Desarrollo y pruebas

La web es estática. No requiere compilar ni instalar dependencias para abrirla.
Supabase JS 2.57.4 y PDF.js 3.11.174 se incluyen localmente con sus licencias.
Sirve la carpeta `nexmir/` con Python 3:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Las pruebas requieren Node.js y Chromium. En `nexmir/tests/`:

```sh
npm ci
npm run test:unit
npm run test:db
npm run test:ui
```

Mantén el servidor iniciado mientras ejecutas `test:ui`. Por defecto usa
`http://127.0.0.1:4173` y `/usr/bin/chromium`; puedes ajustar `NEXMIR_TEST_URL`
y `CHROMIUM_PATH`. La prueba de base usa PostgreSQL local mediante PGlite con
tablas de prueba. Las pruebas en navegador bloquean conexiones externas:
no publican contenido ni modifican una cuenta o base real de Supabase.
