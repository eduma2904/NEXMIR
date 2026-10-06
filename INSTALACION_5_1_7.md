# NEXMIR 5.1.7 · Bienvenida y ventanas corregidas

## Instalación

Reemplaza la carpeta pública por el contenido de `nexmir/` de este ZIP (haz antes una copia). Incluye `tutorial.js`, `tutorial.css` y `assets/GUIA_NEXMIR_FREE_PRO.pdf`. Recarga con Ctrl + F5. No hay migraciones SQL.

## Recorrido de usuario nuevo

- La guía automática corresponde a cuentas creadas a partir de esta actualización. Se marca como presentada al abrirse, de modo que una recarga a mitad del recorrido no la inicia de nuevo. Los usuarios existentes pueden ejecutarla cuando quieran desde «🐾 Guía» o Perfil.
- Durante el recorrido se iluminan a la vez la sección explicada y su entrada de la barra lateral. Hacer clic fuera de la tarjeta no cierra la guía. «Omitir» o Escape sí la cierran.
- Tras el primer recorrido (o al omitirlo), se ofrece elegir color y modo de pantalla. Luego se abre Mi plaza MIR para indicar especialidad y baremo, con opción de completarlo después. Finalmente se pregunta una sola vez si se desea hacer el diagnóstico de entrada. «Ahora no» permite comenzar a estudiar sin examen. Nunca se lanza automáticamente.
- Se retiró el bloque de pretest que ocupaba la cabecera de Estudiar y la invitación repetida de Repasos. El diagnóstico sigue disponible al abrir una especialidad para quien quiera hacerlo más tarde.
- Perfil ofrece «Volver a ver tutorial» y «Descargar guía PDF». El documento explica las secciones y diferencia límites Free/Pro.

## Corrección de ventanas

Los diálogos cerrados permanecían visibles porque sus estilos de diseño forzaban `display:flex`. Ahora quedan ocultos cuando carecen de `open`. El tirador de tamaño permanece en la esquina inferior derecha del popup en escritorio. La ayuda contextual se muestra como botón flotante, sin ocupar una fila de la ventana.

## Comprobación

Verifica con una cuenta nueva: guía → tema → Mi plaza MIR/baremo → invitación opcional al diagnóstico → «Ahora no» → recargar. La guía y la invitación no deben reaparecer. Verifica con una cuenta antigua: ninguna bienvenida automática; el botón de Perfil la abre manualmente. Entra y sal de Banqueo, Repasos y Focus para confirmar que las ventanas cerradas no quedan dibujadas en otras secciones.
