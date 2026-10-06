# NEXMIR 5.1.6 · Recorrido guiado

## Actualización

Conserva una copia de la web publicada y sustituye los archivos de la carpeta pública por el contenido de `nexmir/` de este ZIP. Deben subirse también los nuevos `tutorial.js` y `tutorial.css`. Recarga con Ctrl + F5. No hay migración SQL ni configuración adicional.

## Guía para estudiantes

Después de entrar a una cuenta que aún no completó la guía en ese navegador, el lince presenta un recorrido de 20 pasos por las secciones de la web. Si aparece una ventana de bienvenida o se recupera una sesión de estudio, espera a que se cierre antes de abrir el recorrido. «Anterior», «Siguiente» y «Omitir» controlan la guía; Escape la cierra. El botón «🐾 Guía» en la barra superior permite repetirla cuando se quiera.

Dentro de las ventanas de estudio, tarjetas, preguntas, simulacros, Focus y otras ventanas de cuenta hay un botón «🐾 ? Ayuda» con instrucciones sobre esa ventana. La guía no inicia exámenes, responde preguntas ni modifica el progreso. La marca de completado es por cuenta y navegador (almacenamiento local), por lo que en un navegador nuevo puede volver a aparecer. No requiere nuevas tablas o permisos.

## Revisión de esta entrega

- Todos los JavaScript propios pasan `node --check`.
- Las pruebas unitarias disponibles de reglas de contenido y Focus pasan.
- Se verificó que los recursos referenciados por los HTML de estudiante y administrador existen en el paquete.
- Las pruebas de base de datos y de navegador no pudieron repetirse aquí: faltan PGlite y un navegador Playwright en este entorno, y la instalación de dependencias no estaba disponible. Las pruebas previas de 5.1.5 figuran en `REVISION_5_1_5.md`, pero no sustituyen una prueba de 5.1.6 en producción.

La revisión estática no puede garantizar que no exista ningún fallo en cuentas reales o en la conexión a Supabase. Antes de publicar, prueba el alta o inicio de sesión de una cuenta nueva, la guía completa, una ventana de preguntas, Focus y el panel administrador en tu entorno de pruebas.
