# Compilación de la app del estudiante

- **Fuente de verdad:** `index.dev.html` (lista y orden de scripts y estilos). Los archivos `.js` y `.css` de la raíz siguen siendo el código fuente.
- **`index.html` está GENERADO.** No lo edites a mano.
- Para regenerar: `cd tools && npm install && npm run build`
  - Ejecuta primero las regresiones de Pregunta del día, recuperación, cronómetro, legibilidad y accesibilidad.
  - Une los JS en el mismo orden y los minimiza sin renombrar nombres globales.
  - Une los CSS en el mismo orden (sin reordenar reglas).
  - Escribe `nexmir.<hash>.js` y `nexmir.<hash>.css` en la raíz y reescribe `index.html`.
- Para depurar sin paquete, abre `index.dev.html` (carga los 60 archivos por separado).
- El panel Admin (`admin/`) no se empaqueta.
