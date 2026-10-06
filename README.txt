NEXMIR V5.1.13 · ESTUDIO RESPONSIVE Y RENDIMIENTO

Aplicación web estática conectada a Supabase para autenticación, contenido,
progreso, simulacros, administración y clasificación asistida.

ACTUALIZACIÓN DESDE 5.1.12
1. Lee CAMBIOS_5_1_13.txt.
2. Publica el contenido completo de nexmir/ en la misma fuente de GitHub Pages.
3. Comprueba móvil y escritorio: asignaturas, banqueo, reanudación, flashcards, Focus, Mini-MIR y errores.
4. No se requieren cambios nuevos en SQL para esta actualización. Si no instalaste la seguridad 5.1.12, sigue INSTALACION_5_1_12.md antes de publicar.

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

Consulta CAMBIOS_5_1_13.txt para el detalle del parche.
