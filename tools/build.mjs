/* NEXMIR · empaquetado de la app del estudiante.
   Fuente de verdad: index.dev.html (lista y orden de scripts y estilos, sin tocar).
   Resultado: assets/nexmir.<hash>.js y assets/nexmir.<hash>.css + index.html generado.
   No cambia ninguna lógica: une en el mismo orden y minimiza sin renombrar nombres globales. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';
import * as cssoNs from 'csso';
const csso = cssoNs.default || cssoNs;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);
const dev = read('index.dev.html');

const isLocal = u => !/^(https?:)?\/\//.test(u) && !u.startsWith('vendor/');
const scriptRe = /[ \t]*<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>[ \t]*\r?\n?/g;
const linkRe = /[ \t]*<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*\/?>[ \t]*\r?\n?/g;

const jsFiles = [], cssFiles = [];
for (const m of dev.matchAll(scriptRe)) if (isLocal(m[1])) jsFiles.push(m[1].split('?')[0]);
for (const m of dev.matchAll(linkRe)) if (isLocal(m[1])) cssFiles.push(m[1].split('?')[0]);

// ---------- JS ----------
const parts = jsFiles.map(f => `/* ${f} */\n${read(f)}\n;`);
const jsOut = await minify(parts.join('\n'), {
  compress: { passes: 1, unsafe: false },
  mangle: { toplevel: false },      // los nombres globales (onclick="openContent(...)") no se tocan
  format: { comments: false },
  keep_fnames: false,
});
if (!jsOut.code) throw new Error('Terser no produjo código');

// ---------- CSS ----------
const cssSrc = cssFiles.map(f => `/* ${f} */\n${read(f)}`).join('\n');
// restructure:false: no reordena ni fusiona reglas (el orden de la cascada queda idéntico).
const cssOut = csso.minify(cssSrc, { restructure: false, comments: false }).css;

// ---------- salida ----------
// Los paquetes van en la raíz (el CSS usa rutas relativas como assets/hero-*.svg).
// Solo se borran paquetes anteriores con este patrón; nunca otros archivos.
for (const f of fs.readdirSync(root)) if (/^nexmir\.[0-9a-f]{10}\.(js|css)$/.test(f)) fs.rmSync(path.join(root, f));
const jsName = `nexmir.${hash(jsOut.code)}.js`, cssName = `nexmir.${hash(cssOut)}.css`;
fs.writeFileSync(path.join(root, jsName), jsOut.code);
fs.writeFileSync(path.join(root, cssName), cssOut);

let html = dev, firstJs = true, firstCss = true;
html = html.replace(scriptRe, (all, src) => {
  if (!isLocal(src)) return all;
  if (firstJs) { firstJs = false; return `<script src="${jsName}"></script>\n`; }
  return '';
});
html = html.replace(linkRe, (all, src) => {
  if (!isLocal(src)) return all;
  if (firstCss) { firstCss = false; return `<link rel="stylesheet" href="${cssName}" />\n`; }
  return '';
});
// conexión anticipada a Supabase (ahorra la negociación TLS en la primera consulta)
const sb = (read('app.js').match(/url:'(https:\/\/[a-z0-9]+\.supabase\.co)'/) || [])[1];
if (sb) html = html.replace('<head>', `<head>\n  <link rel="preconnect" href="${sb}" crossorigin />`);
html = html.replace('<!doctype html>', '<!doctype html>\n<!-- GENERADO por tools/build.mjs. No editar: edita index.dev.html y vuelve a compilar. -->');
fs.writeFileSync(path.join(root, 'index.html'), html);

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`JS : ${jsFiles.length} archivos -> ${jsName} (${kb(jsOut.code.length)})`);
console.log(`CSS: ${cssFiles.length} archivos -> ${cssName} (${kb(cssOut.length)})`);
