/* NEXMIR V5.1.61 · iconos SVG de línea (reemplazan emojis y símbolos de texto).
   Uso en plantillas HTML: ${NxIcon('target')}. Hereda el color y el tamaño del texto (1em).
   Solo para innerHTML: en textContent o en toast() mostraría el código; ahí se usa texto plano. */
(() => {
  'use strict';
  const P = {
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5 4.2 16.5"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3 3 0 0 0 7 10.5M17 6h3v1.5a3 3 0 0 1-3 3"/>',
    minus: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12h7"/>',
    medal: '<circle cx="12" cy="15" r="5.5"/><path d="m8.5 3 3 6.5M15.5 3l-3 6.5"/><path d="m12 12.6.8 1.6 1.8.2-1.3 1.2.3 1.7-1.6-.9-1.6.9.3-1.7-1.3-1.2 1.8-.2z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
    pen: '<path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="m14.5 6.5 3 3"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 8.5V13l3 2"/><path d="M9.5 2.8h5"/>',
    hourglass: '<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 3 6 5 9-2 3-5 4-5 9M17 3c0 5-3 6-5 9 2 3 5 4 5 9"/>',
    warning: '<path d="m12 3.8 9.2 15.7H2.8z"/><path d="M12 10v4.4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    bookmark: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1V21L12 17l-6.5 4V4.5a1 1 0 0 1 1-1z"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M3.5 15h17M10 4.5v15"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    flag: '<path d="M6 21V4"/><path d="M6 5h11l-2.2 3.5L17 12H6"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    play: '<path d="M7 4.5v15L19 12z"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5"/>',
    list: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    spark: '<path d="m12 3 2.3 5.2 5.7.6-4.3 3.8 1.2 5.6L12 15.2 7.1 18.2l1.2-5.6L4 8.8l5.7-.6z"/>',
    bolt: '<path d="M13 2.8 5 13.5h6l-1 7.7 8-10.8h-6z"/>',
    cards: '<rect x="3.5" y="7" width="13" height="12" rx="2.5"/><path d="M7.5 7V5.5A2 2 0 0 1 9.5 3.5h9a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H17"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 8.5V13l3 2"/><path d="M9.5 2.8h5"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-3.8 3.8-5.8 7.5-5.8s6.7 2 7.5 5.8"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    swords: '<path d="m5 5 9.5 9.5M19 5l-9.5 9.5"/><path d="m3.5 6.5 3 3M20.5 6.5l-3 3"/><path d="m8 16-3 3m11-3 3 3"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z"/><path d="M9 7.5h6"/>'
  };
  window.NxIcon = (name, cls = '') =>
    `<svg class="nx-i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;
  window.NxIcon.names = Object.keys(P);
})();
