// Hand-drawn SVG icon set. App icons are full-colour 48×48 tiles; UI glyphs
// are 16×16 strokes in currentColor.

// Gentoo-style swirl ("g" with an eye), drawn for this site.
export const LOGO_PATH =
  'M37 3C53 2 63 13 61 27C59 41 47 49 33 49C27 49 21 52 15 58C11 62 5 61 6 56C7 52 12 47 16 43C6 37 4 25 10 16C16 7 26 3 37 3Z' +
  'M46.8 19.4A9.5 6.2 -28 1 0 30 28.4A9.5 6.2 -28 1 0 46.8 19.4Z';

export function logo({ size = 20, fill = 'currentColor', label } = {}) {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="logo" ${a11y} width="${size}" height="${size}" viewBox="0 0 64 64"><path fill="${fill}" fill-rule="evenodd" d="${LOGO_PATH}"/></svg>`;
}

const app = (body) =>
  `<svg class="app-icon" aria-hidden="true" viewBox="0 0 48 48" width="48" height="48">${body}</svg>`;

const sheet = (band) => `
  <path d="M11 4h19l9 9v29a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#f3f1f8"/>
  <path d="M30 4l9 9h-7a2 2 0 0 1-2-2z" fill="#cfc9df"/>
  <path d="M9 42a2 2 0 0 0 2 2h26a2 2 0 0 0 2-2v-8H9z" fill="${band}"/>`;

const lines = '<path d="M14 15h12M14 20h20M14 25h20M14 30h14" stroke="#a7a1b8" stroke-width="2" stroke-linecap="round"/>';

export const APP_ICONS = {
  terminal: app(`
    <rect x="3" y="6" width="42" height="36" rx="5" fill="#2a2833"/>
    <rect x="3" y="6" width="42" height="7" rx="5" fill="#3d3a4a"/><rect x="3" y="10" width="42" height="3" fill="#3d3a4a"/>
    <path d="M11 21l7 5-7 5" fill="none" stroke="#8fe388" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M22 33h12" stroke="#e8e6ef" stroke-width="3" stroke-linecap="round"/>`),
  folder: app(`
    <path d="M4 12a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v3H4z" fill="#6f63a8"/>
    <rect x="4" y="16" width="40" height="25" rx="3" fill="#8b7fc7"/>
    <rect x="4" y="16" width="40" height="3" fill="#a196da"/>`),
  'folder-home': app(`
    <path d="M4 12a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v3H4z" fill="#6f63a8"/>
    <rect x="4" y="16" width="40" height="25" rx="3" fill="#8b7fc7"/>
    <path d="M24 21l-8 7h2.5v7h4v-5h3v5h4v-7H32z" fill="#f3f1f8"/>`),
  editor: app(`
    <path d="M10 4h20l9 9v29a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#f3f1f8"/>
    <path d="M30 4l9 9h-7a2 2 0 0 1-2-2z" fill="#cfc9df"/>${lines}
    <path d="M38 22l5 5-15 15-6 1 1-6z" fill="#e8a23a"/><path d="M38 22l5 5 2-2a2 2 0 0 0 0-3l-2-2a2 2 0 0 0-3 0z" fill="#d0574f"/>
    <path d="M23 37l5 5-6 1z" fill="#f6dcb0"/>`),
  browser: app(`
    <circle cx="24" cy="24" r="19" fill="#3f7fc8"/>
    <path d="M5 24h38M24 5c-7 6-7 32 0 38M24 5c7 6 7 32 0 38M9 14h30M9 34h30" fill="none" stroke="#cfe3fa" stroke-width="2"/>
    <circle cx="24" cy="24" r="19" fill="none" stroke="#2b5f9c" stroke-width="2"/>`),
  settings: app(`
    <path d="M21 4h6l1 5 4 2 5-3 4 4-3 5 2 4 5 1v6l-5 1-2 4 3 5-4 4-5-3-4 2-1 5h-6l-1-5-4-2-5 3-4-4 3-5-2-4-5-1v-6l5-1 2-4-3-5 4-4 5 3 4-2z" fill="#7d7a8c"/>
    <circle cx="24" cy="24" r="8" fill="#e8e6ef"/><circle cx="24" cy="24" r="4" fill="#7d7a8c"/>`),
  snake: app(`
    <rect x="3" y="3" width="42" height="42" rx="7" fill="#1f3b2a"/>
    <path d="M12 34h10V24h10V14" fill="none" stroke="#7ad48c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="32" cy="12" r="1.6" fill="#1f3b2a"/>
    <circle cx="36" cy="33" r="4" fill="#e85b5b"/>`),
  minesweeper: app(`
    <rect x="3" y="3" width="42" height="42" rx="7" fill="#c9c6d3"/>
    <path d="M24 9v30M9 24h30M13.5 13.5l21 21M34.5 13.5l-21 21" stroke="#26232e" stroke-width="3" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="10" fill="#26232e"/><circle cx="20.5" cy="20.5" r="3" fill="#f3f1f8"/>`),
  'file-text': app(sheet('#7d7a8c') + lines),
  'file-md': app(sheet('#6f63a8') + lines + '<path d="M14 41v-5l3 3 3-3v5M26 36v5m-2.5-2.5L26 41l2.5-2.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  'file-conf': app(sheet('#4f8c6a') + lines),
  'file-bin': app(`
    <rect x="8" y="4" width="32" height="40" rx="3" fill="#3a3746"/>
    <path d="M15 14h4v8M27 14h4v8M15 30h4v8M27 30h4v8" fill="none" stroke="#9ad49a" stroke-width="2.4"/>`),
};

const ui = (body) =>
  `<svg class="ui-icon" aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const UI_ICONS = {
  minimize: ui('<path d="M4 11.5h8"/>'),
  maximize: ui('<rect x="3.5" y="3.5" width="9" height="9" rx="1"/>'),
  restore: ui('<rect x="3" y="5.5" width="7.5" height="7.5" rx="1"/><path d="M5.5 5.5V4a1 1 0 0 1 1-1H12a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-1.5"/>'),
  close: ui('<path d="M4 4l8 8M12 4l-8 8"/>'),
  back: ui('<path d="M10 3L5 8l5 5"/>'),
  forward: ui('<path d="M6 3l5 5-5 5"/>'),
  up: ui('<path d="M3 10l5-5 5 5"/>'),
  reload: ui('<path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5V5h-2.5"/>'),
  home: ui('<path d="M2.5 7.5L8 3l5.5 4.5M4 6.5V13h3v-3.5h2V13h3V6.5"/>'),
  folder: ui('<path d="M2 4.5a1 1 0 0 1 1-1h3.5L8 5h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/>'),
  root: ui('<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M5 10h6M5 7h2"/>'),
  file: ui('<path d="M4 2h5.5L12 4.5V14H4z"/><path d="M9.5 2v3H12"/>'),
  save: ui('<path d="M3 3h8l2 2v8H3z"/><path d="M5.5 3v3h4.5V3M5.5 13V9.5h5V13"/>'),
  plus: ui('<path d="M8 3v10M3 8h10"/>'),
  open: ui('<path d="M2 4.5a1 1 0 0 1 1-1h3.5L8 5h5a1 1 0 0 1 1 1v1.5M2 12.5l1.8-4.5H15l-1.8 4.5z"/>'),
  grid: ui('<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>'),
  list: ui('<path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01"/>'),
  flag: ui('<path d="M4 14V2.5M4 3h7l-1.5 2.5L11 8H4"/>'),
  sun: ui('<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>'),
  moon: ui('<path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"/>'),
  external: ui('<path d="M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5"/>'),
  mail: ui('<rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="M2.5 4.5L8 9l5.5-4.5"/>'),
  lock: ui('<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>'),
};

export const appIcon = (name) => APP_ICONS[name] || APP_ICONS['file-text'];
export const uiIcon = (name) => UI_ICONS[name] || '';
