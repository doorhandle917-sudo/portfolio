// Wallpapers are generated SVGs (no image files): each returns a CSS
// `background` value. "Solid" follows the current accent colour.
import { LOGO_PATH } from './icons.js';
import { mix } from './color.js';

const W = 1600;
const H = 1000;
const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`;
const toCss = (markup, fallback) => `url("data:image/svg+xml,${encodeURIComponent(markup)}") center / cover no-repeat, ${fallback}`;

// Deterministic PRNG so generated patterns look the same on every visit.
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function larry() {
  return svg(
    `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#glow)"/>
     <g transform="translate(1010 300) scale(8.4)"><path fill="url(#swirl)" fill-rule="evenodd" d="${LOGO_PATH}"/></g>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#15112a"/><stop offset=".55" stop-color="#352d5c"/><stop offset="1" stop-color="#6a5e9f"/></linearGradient>
     <radialGradient id="glow" cx=".76" cy=".62" r=".55"><stop offset="0" stop-color="#c2b8f0" stop-opacity=".32"/><stop offset="1" stop-color="#c2b8f0" stop-opacity="0"/></radialGradient>
     <linearGradient id="swirl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity=".03"/></linearGradient>`,
  );
}

function portage() {
  const rand = rng(7);
  const nodes = Array.from({ length: 70 }, () => [rand() * W, rand() * H, 1.5 + rand() * 3.5]);
  let edges = '';
  nodes.forEach(([x, y], i) => {
    nodes
      .map(([x2, y2], j) => [Math.hypot(x2 - x, y2 - y), j, x2, y2])
      .filter(([d, j]) => j > i && d < 260)
      .slice(0, 3)
      .forEach(([, , x2, y2]) => { edges += `M${x.toFixed(0)} ${y.toFixed(0)}L${x2.toFixed(0)} ${y2.toFixed(0)}`; });
  });
  const dots = nodes.map(([x, y, r]) => `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}"/>`).join('');
  return svg(
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>
     <path d="${edges}" stroke="#9a8fd0" stroke-opacity=".2" stroke-width="1.2" fill="none"/>
     <g fill="#b9b0ea" fill-opacity=".55">${dots}</g>`,
    `<radialGradient id="bg" cx=".3" cy=".2" r="1.1"><stop offset="0" stop-color="#1d2030"/><stop offset="1" stop-color="#0c0d13"/></radialGradient>`,
  );
}

function stage3() {
  const layers = [
    ['#2a2350', 470, 60], ['#3a3170', 560, 55], ['#4d4290', 650, 50], ['#6a5eae', 740, 45], ['#9387cf', 840, 35],
  ];
  const waves = layers.map(([color, y0, amp], i) => {
    let d = `M0 ${y0}`;
    const seg = W / 4;
    for (let s = 0; s < 4; s++) {
      const x = s * seg;
      const dir = (s + i) % 2 ? 1 : -1;
      d += ` C${x + seg / 3} ${y0 + dir * amp} ${x + (2 * seg) / 3} ${y0 + dir * amp} ${x + seg} ${y0}`;
    }
    return `<path d="${d} V${H} H0 Z" fill="${color}" fill-opacity=".92"/>`;
  }).join('');
  return svg(
    `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="1180" cy="380" r="120" fill="url(#sun)"/>${waves}`,
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e0b1c"/><stop offset="1" stop-color="#2c2450"/></linearGradient>
     <radialGradient id="sun"><stop offset="0" stop-color="#f1d9ff" stop-opacity=".9"/><stop offset=".45" stop-color="#c7a8f0" stop-opacity=".35"/><stop offset="1" stop-color="#c7a8f0" stop-opacity="0"/></radialGradient>`,
  );
}

function compile() {
  const rand = rng(42);
  const pkgs = ['sys-kernel/gentoo-sources', 'dev-lang/go', 'app-containers/docker', 'www-servers/caddy', 'dev-db/postgresql', 'net-libs/nodejs', 'app-admin/ansible', 'app-shells/bash'];
  const templates = [
    (p) => `>>> Emerging (1 of 8) ${p}::gentoo`,
    (p) => `>>> Compiling source in /var/tmp/portage/${p}/work ...`,
    () => 'x86_64-pc-linux-gnu-gcc -O2 -pipe -march=native -fPIC -c src/main.c -o main.o',
    () => 'make -j8 -l8 all',
    (p) => `>>> Installing (1 of 8) ${p}::gentoo`,
    () => ' * Applying gentoo patches ...                                   [ ok ]',
    () => 'CCLD     libportage.la',
  ];
  let text = '';
  for (let i = 0; i < 46; i++) {
    const line = templates[Math.floor(rand() * templates.length)](pkgs[Math.floor(rand() * pkgs.length)]);
    text += `<text x="${(24 + rand() * 30).toFixed(0)}" y="${30 + i * 21.5}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
  }
  return svg(
    `<rect width="${W}" height="${H}" fill="#0b0e0c"/>
     <g font-family="DejaVu Sans Mono, monospace" font-size="15" fill="#7fd48a" fill-opacity=".16">${text}</g>
     <rect width="${W}" height="${H}" fill="url(#vignette)"/>`,
    `<radialGradient id="vignette" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>`,
  );
}

const cache = new Map();
const cached = (id, fn) => {
  if (!cache.has(id)) cache.set(id, fn());
  return cache.get(id);
};

export const WALLPAPERS = [
  { id: 'larry', name: 'Larry', css: () => toCss(cached('larry', larry), '#352d5c') },
  { id: 'portage', name: 'Portage', css: () => toCss(cached('portage', portage), '#11131a') },
  { id: 'stage3', name: 'Stage 3', css: () => toCss(cached('stage3', stage3), '#2c2450') },
  { id: 'compile', name: 'Compile', css: () => toCss(cached('compile', compile), '#0b0e0c') },
  { id: 'solid', name: 'Solid', css: ({ accent, theme }) => (theme === 'light' ? mix(accent, '#ffffff', 0.55) : mix(accent, '#000000', 0.45)) },
];

export function wallpaperCss(id, prefs) {
  const wp = WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0];
  return wp.css(prefs);
}
