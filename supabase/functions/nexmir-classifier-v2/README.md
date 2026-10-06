# Activar la clasificación con IA en el proyecto Supabase actual

El HTML local no puede ejecutar esta función por sí solo. Se instala una vez en el proyecto Supabase al que se conecta el panel. Tu suscripción a ChatGPT no proporciona automáticamente una clave para la API de OpenAI; la función necesita `OPENAI_API_KEY` en Supabase Edge Function Secrets. No pegues esa clave en el HTML ni en GitHub.

1. En Supabase Dashboard, abre **tu proyecto actual** > **Edge Functions** > **Deploy a new function** > **Via Editor**.
2. Ponle exactamente `nexmir-classifier-v2`. Sustituye el código de ejemplo por **todo** el contenido de este archivo hermano `index.ts` y pulsa **Deploy function**. Si ya existe, edita la misma función y pulsa **Deploy updates**.
3. En el mismo proyecto, abre **Edge Functions > Secrets**. Añade una clave `OPENAI_API_KEY` con el valor de tu clave de API de OpenAI y pulsa **Save**. La función utiliza `gpt-4.1-mini` por defecto; `OPENAI_CLASSIFIER_MODEL` es opcional.
4. En el panel admin local, conectado a este mismo Supabase con rol admin, pulsa **Comprobar IA sin modificar tarjetas**. Esa prueba verifica la clave y el modelo con una petición breve a la API; no modifica la base.
5. Si indica «IA conectada y lista», pulsa **Clasificar desagrupadas con IA**. Procesa hasta 20 elementos por pulsación y deja sin clasificar los de confianza menor de 0,70. Repite solo si ves pendientes. Para tarjetas que sí tienen jerarquía RemNote, prefiere reimportar el ZIP o **Revisar clasificación guardada**.

Una función publicada sin el secreto responderá que falta `OPENAI_API_KEY`. Si aparece «No se pudo conectar», comprueba que la función esté publicada **en el mismo proyecto** y que el HTML local se haya abierto mediante `http://localhost` (no como archivo `file://`). El panel distingue también errores de sesión, permisos y clave inválida.

Guías oficiales: https://supabase.com/docs/guides/functions/quickstart-dashboard y https://supabase.com/docs/guides/functions/secrets
