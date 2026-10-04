// Persistent desktop preferences (theme, accent, wallpaper) + applying them
// as CSS custom properties on <html>.
import { createEmitter } from './util.js';
import { ensureContrast, isHex, readableOn } from './color.js';
import { WALLPAPERS, wallpaperCss } from './wallpapers.js';

const KEY = 'gentoo-os:prefs:v1';

export const ACCENTS = [
  { name: 'Gentoo purple', value: '#54487a' },
  { name: 'Blue', value: '#2f6db5' },
  { name: 'Teal', value: '#1f7f78' },
  { name: 'Green', value: '#3c7d37' },
  { name: 'Amber', value: '#b4650f' },
  { name: 'Red', value: '#b3404a' },
  { name: 'Pink', value: '#a3437a' },
];

export const DEFAULTS = Object.freeze({ theme: 'dark', accent: ACCENTS[0].value, wallpaper: 'larry' });

// Lightest/darkest window surfaces per theme (keep in sync with styles/os.css).
const SURFACES = { dark: ['#24232b', '#2e2d36'], light: ['#f7f6fa', '#e9e7ef'] };

const emitter = createEmitter();
let state = load();

function sanitize(p) {
  return {
    theme: p.theme === 'light' ? 'light' : 'dark',
    accent: isHex(p.accent) ? p.accent.toLowerCase() : DEFAULTS.accent,
    wallpaper: WALLPAPERS.some((w) => w.id === p.wallpaper) ? p.wallpaper : DEFAULTS.wallpaper,
  };
}

function load() {
  try {
    return sanitize({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') });
  } catch {
    return { ...DEFAULTS };
  }
}

export const getPrefs = () => ({ ...state });
export const onPrefsChange = (fn) => emitter.on(fn);

export function setPrefs(patch) {
  state = sanitize({ ...state, ...patch });
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable: keep in memory */ }
  applyPrefs();
  emitter.emit(getPrefs());
}

export function currentWallpaperCss() {
  return wallpaperCss(state.wallpaper, state);
}

export function applyPrefs(root = document.documentElement) {
  const { theme, accent } = state;
  const [surface, surface2] = SURFACES[theme];
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--on-accent', readableOn(accent));
  // Accent used as text / focus ring must stay readable on both window surfaces.
  root.style.setProperty('--accent-ink', ensureContrast(ensureContrast(accent, surface), surface2));
  root.style.setProperty('--wallpaper', currentWallpaperCss());
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#ecebf1' : '#0b0a10';
}
