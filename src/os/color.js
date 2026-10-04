// Colour maths for theming: keeps accent-derived colours readable.

const parse = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');

export const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** Linear blend: t=0 → a, t=1 → b. */
export function mix(a, b, t) {
  const x = parse(a);
  const y = parse(b);
  return toHex(x.map((c, i) => c + (y[i] - c) * t));
}

export function luminance(hex) {
  const [r, g, b] = parse(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Nudge `color` toward white or black until it reaches `ratio` against `bg`. */
export function ensureContrast(color, bg, ratio = 4.5) {
  const target = luminance(bg) < 0.5 ? '#ffffff' : '#000000';
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mix(color, target, t);
    if (contrast(c, bg) >= ratio) return c;
  }
  return target;
}

/** Best text colour to sit on top of `bg`. */
export const readableOn = (bg) => (contrast('#ffffff', bg) >= contrast('#16141c', bg) ? '#ffffff' : '#16141c');
