/* Falla si algún CSS vuelve a poner flex, grid o columnas en un contenedor de texto con formato.
   Causa del bug "enunciado partido en columnas": un display:flex en .flash-front hacía que cada
   <strong> fuera una columna aparte. Se ejecuta antes de empaquetar (npm run build / npm run check). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cssoNs from 'csso';
const csso = cssoNs.default || cssoNs;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = fs.readFileSync(path.join(root, 'index.dev.html'), 'utf8');
const files = [...dev.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"?]+)[^"]*"/g)].map(m => m[1]).filter(u => !/^(https?:)?\/\//.test(u));
// Contenedores donde el texto se inserta con mdInline / optionHtml (negrita, cursiva, código).
const RICH = ['flash-front', 'flash-back', 'question-stem', 'sim-stem', 'focus-stem', 'sim-review-stem', 'cuadro-title', 'option-text'];
const BAD = /^(flex|inline-flex|grid|inline-grid)$/;
const problems = [];
let order = 0, lastGuard = -1;
for (const f of files) {
  const ast = csso.syntax.parse(fs.readFileSync(path.join(root, f), 'utf8'), { positions: true });
  csso.syntax.walk(ast, { visit: 'Rule', enter(rule) {
    if (!rule.prelude || rule.prelude.type !== 'SelectorList') return;
    const sels = csso.syntax.generate(rule.prelude).split(',');
    // el último compuesto del selector es el elemento que recibe el texto
    const hits = sels.filter(s => { const last = s.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() || ''; return RICH.some(c => new RegExp('\\.' + c + '(?![\\w-])').test(last)) && !/:is\(|::|\bimg\b/.test(last); });
    if (!hits.length) return;
    csso.syntax.walk(rule.block, { visit: 'Declaration', enter(d) {
      const prop = d.property.toLowerCase(), val = csso.syntax.generate(d.value).trim().replace(/!important/, '').trim();
      const bad = (prop === 'display' && BAD.test(val)) || ((prop === 'column-count' || prop === 'columns') && val !== 'auto' && val !== '1') || prop === 'column-width';
      if (bad && !f.endsWith('text_flow_guard.css')) problems.push(`${f}:${d.loc?.start.line ?? '?'}  ${hits.join(', ').trim()} { ${prop}: ${val} }`);
    } });
  } });
}
if (files[files.length - 1] !== 'text_flow_guard.css') problems.push('text_flow_guard.css debe ser el ÚLTIMO CSS de index.dev.html (hoy es ' + files[files.length - 1] + ')');
if (problems.length) { console.error('\n✖ Texto con formato en contenedor flex/grid/columnas (rompe los enunciados):\n  ' + problems.join('\n  ') + '\n'); process.exit(1); }
console.log('✔ check-richtext: ' + files.length + ' CSS revisados, ningún contenedor de texto con formato usa flex/grid/columnas.');
