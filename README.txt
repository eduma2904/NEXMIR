NEXMIR V5.1.12 · SEGURIDAD Y CIERRE RESPONSIVE

Aplicación web estática conectada a Supabase para autenticación, contenido,
progreso, simulacros, administración y clasificación asistida.

ACTUALIZACIÓN DESDE 5.1.11
1. Lee INSTALACION_5_1_12.md.
2. Ejecuta supabase/SEGURIDAD_5_1_12.sql en el SQL Editor de Supabase.
3. Confirma en el resumen 4f que los tres contadores de seguridad sean 0.
4. Publica el contenido completo de nexmir/ en la misma fuente de GitHub Pages.
5. Comprueba acceso, banqueo, Mini-MIR, panel Admin y correos de autenticación.

IMPORTANTE
- No uses SEGURIDAD_5_1_11.sql de paquetes anteriores.
- No ejecutes CONTENT_RESET.sql durante una actualización normal.
- Nunca publiques Secret keys, service_role ni OPENAI_API_KEY en GitHub.
- La Publishable key de Supabase incluida en app.js está diseñada para el cliente;
  la protección real depende de RLS y de los permisos instalados.

PRUEBAS LOCALES
cd tests
npm ci
npm test

Consulta CAMBIOS_5_1_12.txt para el detalle del parche.
