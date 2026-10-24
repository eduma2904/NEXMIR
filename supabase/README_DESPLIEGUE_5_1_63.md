# Supabase · despliegue de NEXMIR V5.1.63

Los archivos de esta carpeta son migraciones incrementales. No sustituyen el esquema base histórico de NEXMIR y no deben ejecutarse como si fueran una instalación vacía.

## Tablas base requeridas

Antes de aplicar estas migraciones deben existir, como mínimo:

- `profiles`
- `content_items`
- `questions`
- `user_question_attempts`
- `user_flashcard_reviews`
- `user_bookmarks`
- `user_notes`
- `study_plans`
- `content_versions`
- `remnote_imports`
- `remnote_import_changes`
- `question_imports`

También deben existir los buckets de Storage `question-images` y `arcade-images` si se usan imágenes.

## Comprobación previa

Ejecuta en el SQL Editor antes de migrar:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = any(array[
    'profiles','content_items','questions','user_question_attempts',
    'user_flashcard_reviews','user_bookmarks','user_notes','study_plans',
    'content_versions','remnote_imports','remnote_import_changes','question_imports'
  ])
order by table_name;
```

Si falta alguna tabla, restaura primero el esquema base de la instalación actual. No se incluye aquí un `CREATE TABLE` aproximado porque podría crear columnas, claves o políticas incompatibles con los datos reales.

## Migraciones funcionales actuales

Aplica únicamente las que todavía no estén instaladas. Las más recientes y necesarias para las funciones visibles son:

1. `PERSONALIZACION_ESTADISTICAS.sql`
2. `PLANES_Y_BATALLAS_5_1_19.sql`
3. `SESIONES_5_1_20.sql`
4. `ERRORES_Y_REPORTES.sql`
5. `SUGERENCIAS.sql`
6. `NEXMIR_FOCUS_V1.sql`
7. `HOTFIX_BATTLE_PARTICIPANTS_RLS.sql`
8. `HOTFIX_BATTLE_PARTICIPANTS_RETURNING.sql`
9. `HOTFIX_FREE_BATTLES_5.sql`
10. `HOTFIX_FREE_FLASHCARDS_MODE_5_1_39.sql`
11. `SEGURIDAD_5_1_12.sql`
12. `RLS_HARDENING.sql`

Las reglas Free/Pro y su zona de corte diario se mantienen sin cambios en V5.1.63; se revisarán como una decisión de producto separada.
