# Clasificaciones MIR en NEXMIR Arcade

Esta versión añade un segundo juego en Arcade (Free y Pro). Incluye 13
clasificaciones y 104 casos originales, sin imágenes de Garden. En puntuación,
la pregunta solo muestra los parámetros observados y las opciones de puntos:
los umbrales de la tabla se enseñan al terminar la partida, también si se
pulsa **Terminar partida** antes del último ejercicio.

## Killip y Kimball (5.1.31)

En **Arcade → Clasificaciones MIR → Cardiología** aparece **Clasificación de
Killip y Kimball**. Incluye 12 casos, tres para cada clase I–IV, y una tabla de
repaso al finalizar. Los casos distinguen ausencia de insuficiencia cardíaca,
crepitantes basales o S3, edema pulmonar franco y shock cardiogénico. La
referencia enlazada es el estándar de datos de síndrome coronario agudo de la
Sociedad Europea de Cardiología. Actualiza los archivos de la web; no se
requiere una nueva migración SQL para estos casos incluidos.

## Centro de gestión Arcade (5.1.26)

El menú lateral del panel admin presenta un único acceso **Arcade**. Al abrirlo,
el administrador elige entre **Código Vital** y **Clasificaciones MIR**. Cada
editor conserva sus funciones anteriores y ofrece **Elegir juego** para volver
al centro de gestión sin salir del panel.

## Instalar la ampliación de la base de datos

En el proyecto Supabase utilizado por NEXMIR, tras las migraciones de Arcade
existentes y supabase/SUGERENCIAS.sql, ejecutar en el editor SQL:

supabase/ARCADE_CLASIFICACIONES_5_1_24.sql

La aplicación no elimina ni modifica preguntas de Código Vital. Si todavía no
se aplica esta migración, los 13 juegos y sus casos incluidos funcionan, pero
el panel no podrá publicar clasificaciones adicionales ni los alumnos enviar
reportes de casos de Clasificaciones.

## Subir contenido

Abrir **Panel Admin → Arcade → Clasificaciones MIR** con una cuenta admin. Elegir
un ejemplo, pegar JSON o seleccionar un archivo .json de hasta 500 KB.
Validar y previsualizar, revisar cada caso, respuesta, fuente y tabla de repaso,
y marcar **Publicada** al guardar. El contenido publicado aparece cuando el
alumno vuelve a abrir Clasificaciones MIR.

- Una clasificación nueva lleva id, name, topic, type (choice o
  score), note, URL source, cases y review (headers y rows).
- Para una clasificación incluida, usar su id (por ejemplo, curb) y
  proporcionar cases; se añaden a los casos originales. Puede añadirse
  review para sustituir la tabla de repaso. No se sobrescriben los casos
  incluidos ni se revelan los umbrales durante las preguntas.
- Un caso de elegir grado lleva text, answer y why. Un caso de puntuar
  lleva text, observations (un valor por criterio) y answer (los puntos
  correspondientes). La validación comprueba las opciones y la longitud.
- Guardar sin publicar permite revisar el borrador después.

**Reportar pregunta** envía el caso y la descripción a **Reportes de
estudiantes**. **Sugerir nueva clasificación** llega a **Sugerencias**.
Estas acciones requieren sesión y sus tablas/políticas Supabase instaladas.

Los ejemplos de plantillas para escalas nuevas contienen texto marcador;
reemplazarlo, comprobar la fuente oficial y verificar la corrección clínica
antes de publicar. El juego es material educativo, no soporte para decisiones
clínicas individuales.

## Batallas por especialidad

En **Batallas → Crear duelo**, el anfitrión puede elegir **Mix de todas** o
marcar una o varias especialidades. La lista muestra las especialidades que
tienen preguntas test publicadas y su cantidad disponible. La selección
filtra las preguntas antes de crear la sala y reparte los casos entre las
especialidades elegidas. Si faltan preguntas para el tamaño solicitado, se
debe seleccionar otra especialidad o reducir el número de preguntas; no se
crea una sala incompleta. Ambos jugadores reciben las mismas preguntas.
La revancha mantiene la selección mientras se conserve la sala en la sesión.
Esta función no requiere una migración adicional para Batallas.

## Corrección móvil y pantallas de carga

La versión 5.1.25 añade manejo táctil para **Salir del juego**, **Sugerir nueva
clasificación** y **Reportar pregunta** dentro de Clasificaciones MIR. También
muestra una pantalla de carga al terminar una partida, preparar el repaso,
abrir un juego y durante las operaciones principales que guardan o consultan
datos. Los identificadores de versión de los scripts se actualizaron para
evitar que el móvil conserve archivos antiguos en caché.
