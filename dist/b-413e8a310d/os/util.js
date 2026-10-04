// Small DOM and formatting helpers shared by the OS and its apps.

/** Create an element: h('button', { class: 'x', onClick: fn }, 'label', childNode) */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'html') el.innerHTML = value; // trusted, static markup only (icons)
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  appendChildren(el, children);
  return el;
}

export function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** Parse a trusted SVG/HTML string into a single element. */
export function fragment(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

export function loadStyle(href) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = link.onerror = () => resolve(link);
    document.head.append(link);
  });
}

/** Resolve a path relative to src/ (e.g. content.person.avatar) to a URL. */
export function asset(path) {
  return new URL('../' + path, import.meta.url).href;
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function createEmitter() {
  const handlers = new Set();
  return {
    on(fn) { handlers.add(fn); return () => handlers.delete(fn); },
    emit(...args) { handlers.forEach((fn) => fn(...args)); },
  };
}

// --- content helpers -------------------------------------------------------

export const isPlaceholder = (v) => typeof v === 'string' && /^PLACEHOLDER\b/.test(v);

/** Visible, clearly marked placeholder chip. */
export function placeholderChip(text) {
  return h('span', { class: 'placeholder', title: 'Missing from the source repo — fill in src/content.js' }, text);
}

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Split "text [label](url) more" into text nodes and safe links. */
export function inlineNodes(text) {
  const nodes = [];
  let last = 0;
  for (const m of String(text).matchAll(LINK_RE)) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(externalLink(m[2], m[1]));
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Same text with links flattened to "label (url)" for plain-text files. */
export const inlinePlain = (text) => String(text).replace(LINK_RE, '$1 ($2)');

export function externalLink(href, label = href, props = {}) {
  return h('a', { href, target: '_blank', rel: 'noopener noreferrer', ...props }, label);
}

export function mailLink(email, props = {}) {
  return h('a', { href: 'mailto:' + email, ...props }, email);
}

// --- time ------------------------------------------------------------------

export function formatTime(date, timeZone, options) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, ...options }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  }
}
