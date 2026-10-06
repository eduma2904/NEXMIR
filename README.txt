NEXMIR V5.1.5 · SELECCIÓN AUTOMÁTICA Y REFINAMIENTO UX
Consulta INSTALACION_5_1_5.md y REVISION_5_1_5.md.
No requiere nuevas migraciones SQL ni dependencias de producción.

NEXMIR V5.1.4 · IMÁGENES, IMPORTACIÓN UNIFICADA Y ADMINISTRACIÓN

Consulta INSTALACION_5_1_4.md y CAMBIOS_5_1_4.txt.
Para sincronizar las MCQ de RemNote con el banco de batallas, ejecuta
supabase/TEST_CONTENT_SYNC.sql una vez antes de publicarlas.
Las instrucciones que siguen corresponden a versiones anteriores.

HISTORIAL BASE: V5.0.29 · CORRECCIÓN FREE/PRO + SUGERENCIAS

CAMBIOS PRINCIPALES
- Se mantiene Free/Pro. EDICION_CONTENIDO.sql añade a profiles las columnas que la app utiliza: plan, display_name, email y control de dispositivo.
- plan acepta solo free/pro y por defecto es free.
- role y plan quedan protegidos: un usuario normal puede editar su perfil, pero no autoasignarse Pro/admin.
- Límites actuales de Free: 15 preguntas de banqueo/día, 20 flashcards/día, 1 Mini-MIR de 15 preguntas/día, simulacro completo solo Pro y 2 batallas/día. Pro/admin/moderator no tienen límite desde la interfaz.
- Nueva sección “Sugerencias para NEXMIR” dentro del perfil.
- Nueva bandeja “Sugerencias” en el panel Admin, con estados Pendiente / En revisión / Planificada / Completada / Descartada y nota del equipo.
- Eliminada por completo la función generate-explanation, su Edge Function y AI_EXPLANATION_SECURITY.sql. Si una pregunta no trae explicación, NEXMIR simplemente indica que no hay explicación registrada.
- Se mantienen los atajos numéricos de flashcards y preguntas.

DESPLIEGUE SQL (EN ESTE ORDEN)
1. EDICION_CONTENIDO.sql
2. RLS_HARDENING.sql
3. ERRORES_Y_REPORTES.sql
4. SUGERENCIAS.sql
5. CONTENT_RESET.sql

EDGE FUNCTIONS
- Desplegar solo: nexmir-classifier-v2
- NO existe ni debes desplegar generate-explanation.
- OPENAI_API_KEY solo es necesaria si usas el clasificador IA del panel admin. No se usa para explicaciones de preguntas.

AUTH
- Configura contraseña mínima de 8 caracteres en Supabase Auth.
- Activa protección de contraseñas filtradas si tu plan de Supabase la ofrece.

IMPORTANTE
- Estos SQL están preparados para el esquema de profiles comprobado: id, role, created_at, updated_at, goal_hospital, academic_average, goal_specialty, goal_city, target_number, theme_palette, theme_mode.
- Las columnas nuevas se crean con IF NOT EXISTS, por lo que no borran los datos actuales.

NEXMIR V5.1.0 · NEXMIR FOCUS V1
- Nuevo “🎯 Modo Focus” para Free y Pro, coherente con el Design System actual.
- Selector 5/10/15/25 min o sin temporizador, misión automática y arranque desde asignatura/tema.
- Tiempo activo: se pausa con pestaña oculta/inactividad y no premia dejar el navegador abierto.
- Preguntas válidas, detector de ritmo sospechoso, aviso 3 consecutivas o 4/6, observación 5 preguntas y recuperación tras 5 normales.
- Racha: 15 preguntas válidas O Focus válido ≥10 min; 3 congeladores automáticos por mes no acumulables.
- XP por pregunta, revisión, error recuperado, consolidación, Focus, misiones y objetivo diario; eventos idempotentes en backend.
- Mastery 0–100 separado de XP, deterioro efectivo por tiempo y dominio ajustado por cobertura.
- Repetición V1: 3→7→14→30→60→120→180 días, con recuperación de error a 1 día.
- 3 misiones diarias, continuar sesión interrumpida, preferencias de estudio y responsive/accessibility.
- Migración: ejecutar supabase/NEXMIR_FOCUS_V1.sql. Ver NEXMIR_FOCUS_V1_DEPLOY.txt.

