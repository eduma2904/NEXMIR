# NEXMIR 5.1.12 · Actualización segura

Esta versión corrige el parche de permisos 5.1.11, unifica los identificadores
de versión y refuerza el uso móvil. No borra usuarios, preguntas, flashcards,
simulacros, progreso ni configuraciones.

## 1. Copia de seguridad

1. Conserva una copia del repositorio o publicación que funciona actualmente.
2. En Supabase, crea un respaldo desde **Database > Backups** si tu plan lo
   permite. No ejecutes `CONTENT_RESET.sql`.

## 2. Supabase

1. Abre **SQL Editor** en el mismo proyecto usado por NEXMIR.
2. Copia y ejecuta `supabase/SEGURIDAD_5_1_12.sql` completo.
3. Revisa la fila de resumen final (sección 4f):
   - `tablas_sin_rls`: debe ser 0.
   - `politicas_abiertas`: debe ser 0, salvo una apertura deliberada que hayas
     revisado.
   - `funciones_internas_expuestas`: debe ser 0.
   - `cuentas_elevadas`: confirma manualmente cada admin o moderator.
4. Si quieres el detalle de algún contador distinto de 0, selecciona y ejecuta
   por separado la auditoría correspondiente:
   - 4a: debe mostrar 0 tablas sin RLS.
   - 4b: debe mostrar 0 políticas abiertas, salvo alguna que hayas publicado
     deliberadamente.
   - 4c: confirma manualmente los administradores y moderadores.
   - 4e: debe mostrar 0 funciones internas accesibles por `authenticated`.
5. Si cualquiera de 4a, 4b o 4e devuelve resultados inesperados, detén la
   publicación y revisa esas filas antes de continuar.

La sección 3b corrige automáticamente las tres políticas heredadas que el
auditor puede detectar: elimina `anon` de los borrados administrativos y
restringe `question_ai_explanations` al personal autorizado.

No ejecutes `SEGURIDAD_5_1_11.sql`. Fue retirado de este paquete.

## 3. GitHub Pages

Sustituye en el repositorio el contenido público anterior por todo lo incluido
en la carpeta `nexmir/`, conservando la misma estructura. No subas el ZIP como
único archivo: GitHub Pages debe recibir `index.html`, los `.js`, `.css`,
`assets/`, `admin/`, `vendor/` y demás carpetas.

Después del despliegue, abre la web en una ventana privada y comprueba que el
título indique `NEXMIR V5.1.12`.

## 4. Brevo

Esta versión no modifica la configuración SMTP ni contiene claves de Brevo.
Después de publicar, prueba registro, verificación y recuperación de contraseña.
Si los tres correos llegan, no cambies la configuración de Brevo.

## 5. Prueba mínima posterior

- Acceso y opción Mostrar/Ocultar contraseña.
- Perfil, rol y plan correctos.
- Banqueo y registro de una respuesta.
- Inicio, pausa, continuación y finalización de Mini-MIR.
- Flashcard y repaso.
- Panel Admin con usuario autorizado.
- Móvil vertical y horizontal, especialmente encabezado del simulacro.
- Registro, verificación y recuperación de contraseña por correo.

Solo tras completar esta lista debe considerarse finalizada la actualización.
