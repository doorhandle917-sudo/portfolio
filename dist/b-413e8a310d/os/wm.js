// Window manager: drag, resize, minimise, maximise, close, focus, z-order,
// keyboard move/resize, and a single-app mode for small screens.
import { h, clamp, createEmitter } from './util.js';
import { appIcon, uiIcon } from './icons.js';

const TITLE_H = 34;
const CASCADE = 28;
const KEY_STEP = 24;
const DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
let nextId = 1;

class Win {
  constructor(wm, opts) {
    this.wm = wm;
    this.id = nextId++;
    this.appId = opts.appId;
    this.icon = opts.icon || opts.appId;
    this.minW = opts.minWidth || 260;
    this.minH = opts.minHeight || 160;
    this.rect = { x: 0, y: 0, w: opts.width || 640, h: opts.height || 440 };
    this.prevRect = null;
    this.minimized = false;
    this.maximized = false;
    this.beforeClose = null; // async () => boolean; return false to cancel
    this.data = opts.data || {}; // app-specific identity, e.g. { path }
    this._closeHooks = [];
    this._focusHooks = [];
    this._resizeHooks = [];
  }

  setTitle(title) {
    this.title = title;
    this.titleEl.textContent = title;
    this.titlebar.setAttribute('aria-label', `${title} — title bar`);
    this.wm.changed();
  }

  /** Called when the window is closed (cleanup timers, listeners…). */
  onClose(fn) { this._closeHooks.push(fn); }
  /** Called when the window should move keyboard focus into its content. */
  onFocus(fn) { this._focusHooks.push(fn); }
  /** Called after the window's size changes. */
  onResize(fn) { this._resizeHooks.push(fn); }

  focusContent() {
    if (this._focusHooks.length) this._focusHooks.forEach((fn) => fn());
    else this.el.focus({ preventScroll: true });
  }

  focus(opts) { this.wm.focus(this, opts); }
  close() { return this.wm.close(this); }
}

export class WindowManager {
  constructor(layer) {
    this.layer = layer;
    this.windows = []; // z-order: last is on top
    this.active = null;
    this.mobile = false;
    this.cascade = 0;
    this.events = createEmitter();
    this.help = h('p', { id: 'wm-help', class: 'sr-only' }, 'Arrow keys move the window. Shift plus arrow keys resize it. Double-click or press Enter to maximise.');
    layer.append(this.help);
    window.addEventListener('resize', () => this.fitAll());
  }

  get bounds() {
    return { w: this.layer.clientWidth, h: this.layer.clientHeight };
  }

  changed() { this.events.emit(this); }

  // --- lifecycle --------------------------------------------------------------
  open(opts) {
    const win = new Win(this, opts);
    const { w: bw, h: bh } = this.bounds;
    win.rect.w = Math.min(win.rect.w, Math.max(win.minW, bw - 24));
    win.rect.h = Math.min(win.rect.h, Math.max(win.minH, bh - 24));
    const step = (this.cascade++ % 7) * CASCADE;
    win.rect.x = opts.x ?? Math.round((bw - win.rect.w) / 2 - 2 * CASCADE + step);
    win.rect.y = opts.y ?? Math.round(Math.max(8, (bh - win.rect.h) / 2 - 2 * CASCADE + step));
    this.build(win, opts.title || opts.appId);
    this.constrain(win);
    this.windows.push(win);
    this.layer.append(win.el);
    this.apply(win);
    win.el.addEventListener('animationend', () => win.el.classList.remove('is-opening'), { once: true });
    this.focus(win);
    return win;
  }

  build(win, title) {
    const titleId = `win-${win.id}-title`;
    const btn = (cls, label, icon, onClick) =>
      h('button', { class: `win-btn ${cls}`, type: 'button', 'aria-label': label, title: label, html: uiIcon(icon), onClick });

    win.titleEl = h('h2', { class: 'win-title', id: titleId });
    win.maxBtn = btn('maximize', 'Maximise', 'maximize', () => this.toggleMaximize(win));
    win.minBtn = btn('minimize', 'Minimise', 'minimize', () => this.minimize(win));
    win.titlebar = h('header', { class: 'win-titlebar', tabindex: '0', 'aria-describedby': 'wm-help' },
      h('span', { class: 'win-icon', html: appIcon(win.icon) }),
      win.titleEl,
      h('div', { class: 'win-controls' },
        win.minBtn,
        win.maxBtn,
        btn('close', 'Close', 'close', () => this.close(win)),
      ),
    );
    win.body = h('div', { class: 'win-body' });
    win.el = h('section', {
      class: 'win is-opening', role: 'dialog', 'aria-labelledby': titleId, tabindex: '-1', dataset: { app: win.appId },
    }, win.titlebar, win.body, DIRS.map((dir) => h('div', { class: 'win-resize', dataset: { dir }, 'aria-hidden': 'true' })));
    win.setTitle(title);

    // Any interaction raises the window; keyboard focus entering it does too.
    win.el.addEventListener('pointerdown', () => { if (this.active !== win) this.focus(win, { moveFocus: false }); }, true);
    win.el.addEventListener('focusin', () => { if (this.active !== win) this.focus(win, { moveFocus: false }); });

    this.bindDrag(win);
    this.bindResize(win);
    this.bindKeyboard(win);
  }

  async close(win) {
    if (!this.windows.includes(win)) return true;
    if (win.closing) return false; // a "save changes?" prompt is already open
    if (win.beforeClose) {
      this.focus(win);
      win.closing = true;
      const ok = await win.beforeClose();
      win.closing = false;
      if (!ok) return false;
    }
    win._closeHooks.forEach((fn) => { try { fn(); } catch (err) { console.error(err); } });
    win.el.remove();
    this.windows = this.windows.filter((w) => w !== win);
    if (this.active === win) {
      this.active = null;
      this.focusTopmost();
    }
    this.changed();
    return true;
  }

  // --- state changes ------------------------------------------------------------
  focus(win, { moveFocus = true } = {}) {
    if (win.minimized) {
      win.minimized = false;
      win.el.hidden = false;
    }
    this.windows = this.windows.filter((w) => w !== win).concat(win);
    this.windows.forEach((w, i) => {
      w.el.style.zIndex = String(10 + i);
      w.el.classList.toggle('is-focused', w === win);
    });
    this.active = win;
    if (moveFocus && !win.el.contains(document.activeElement)) win.focusContent();
    this.changed();
  }

  focusTopmost() {
    const next = !this.mobile && [...this.windows].reverse().find((w) => !w.minimized);
    if (next) this.focus(next);
    else {
      this.windows.forEach((w) => w.el.classList.remove('is-focused'));
      this.active = null;
      this.events.emit(this, { idle: true });
    }
  }

  minimize(win) {
    win.minimized = true;
    win.el.hidden = true;
    win.el.classList.remove('is-focused');
    if (this.active === win) {
      this.active = null;
      this.focusTopmost();
    }
    this.changed();
  }

  toggleMaximize(win) {
    if (this.mobile) return;
    if (win.maximized) {
      win.maximized = false;
      if (win.prevRect) win.rect = { ...win.prevRect };
    } else {
      win.prevRect = { ...win.rect };
      win.maximized = true;
    }
    this.apply(win);
    this.changed();
  }

  /** Taskbar behaviour: focus, or minimise if it is already the active window. */
  toggleFromTaskbar(win) {
    if (this.active === win && !win.minimized) this.minimize(win);
    else this.focus(win);
  }

  /** Small screens: every window is full-size and only the active one is shown. */
  setMobile(mobile) {
    this.mobile = mobile;
    this.layer.classList.toggle('wm-mobile', mobile);
    this.windows.forEach((w) => {
      if (!mobile) this.constrain(w);
      this.apply(w);
    });
    this.changed();
  }

  // --- geometry -----------------------------------------------------------------
  constrain(win) {
    const { w: bw, h: bh } = this.bounds;
    const r = win.rect;
    r.w = clamp(r.w, Math.min(win.minW, bw), Math.max(win.minW, bw));
    r.h = clamp(r.h, Math.min(win.minH, bh), Math.max(win.minH, bh));
    // Keep the title bar reachable: at least 90px visible horizontally.
    r.x = clamp(r.x, 90 - r.w, bw - 90);
    r.y = clamp(r.y, 0, Math.max(0, bh - TITLE_H));
  }

  apply(win) {
    const full = win.maximized || this.mobile;
    const r = win.rect;
    const s = win.el.style;
    const pos = full ? 'translate(0px, 0px)' : `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`;
    s.transform = pos;
    s.setProperty('--win-pos', pos);
    s.width = full ? '100%' : `${Math.round(r.w)}px`;
    s.height = full ? '100%' : `${Math.round(r.h)}px`;
    win.el.classList.toggle('is-maximized', full);
    win.maxBtn.innerHTML = uiIcon(win.maximized ? 'restore' : 'maximize');
    win.maxBtn.setAttribute('aria-label', win.maximized ? 'Restore' : 'Maximise');
    win.maxBtn.title = win.maxBtn.getAttribute('aria-label');
    const minLabel = this.mobile ? 'Home screen' : 'Minimise';
    win.minBtn.innerHTML = uiIcon(this.mobile ? 'back' : 'minimize');
    win.minBtn.setAttribute('aria-label', minLabel);
    win.minBtn.title = minLabel;
    win._resizeHooks.forEach((fn) => fn());
  }

  fitAll() {
    this.windows.forEach((w) => { this.constrain(w); this.apply(w); });
  }

  // --- pointer interaction ------------------------------------------------------
  bindDrag(win) {
    const bar = win.titlebar;
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.mobile || e.target.closest('.win-btn')) return;
      e.preventDefault();
      const start = { px: e.clientX, py: e.clientY, x: win.rect.x, y: win.rect.y };
      let dragging = false;
      bar.setPointerCapture(e.pointerId);

      const move = (ev) => {
        let dx = ev.clientX - start.px;
        let dy = ev.clientY - start.py;
        if (!dragging) {
          if (Math.hypot(dx, dy) < 4) return;
          dragging = true;
          win.el.classList.add('is-dragging');
          if (win.maximized) {
            // Un-maximise under the pointer, keeping the grab point proportional.
            const layerBox = this.layer.getBoundingClientRect();
            const ratio = (start.px - layerBox.left) / layerBox.width;
            win.maximized = false;
            win.rect = { ...(win.prevRect || win.rect) };
            start.x = start.px - layerBox.left - win.rect.w * ratio;
            start.y = 0;
          }
        }
        win.rect.x = start.x + dx;
        win.rect.y = start.y + dy;
        this.constrain(win);
        this.apply(win);
      };
      const end = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', end);
        bar.removeEventListener('pointercancel', end);
        win.el.classList.remove('is-dragging');
        if (dragging) this.changed();
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', end);
      bar.addEventListener('pointercancel', end);
    });
    bar.addEventListener('dblclick', (e) => {
      if (!e.target.closest('.win-btn')) this.toggleMaximize(win);
    });
  }

  bindResize(win) {
    win.el.querySelectorAll('.win-resize').forEach((handle) => {
      const dir = handle.dataset.dir;
      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || this.mobile || win.maximized) return;
        e.preventDefault();
        e.stopPropagation();
        this.focus(win, { moveFocus: false });
        handle.setPointerCapture(e.pointerId);
        const s = { px: e.clientX, py: e.clientY, ...win.rect };
        const { w: bw, h: bh } = this.bounds;
        win.el.classList.add('is-resizing');

        const move = (ev) => {
          const dx = ev.clientX - s.px;
          const dy = ev.clientY - s.py;
          const r = win.rect;
          if (dir.includes('e')) r.w = clamp(s.w + dx, win.minW, bw - s.x);
          if (dir.includes('s')) r.h = clamp(s.h + dy, win.minH, bh - s.y);
          if (dir.includes('w')) {
            r.x = clamp(s.x + dx, Math.min(0, s.x), s.x + s.w - win.minW);
            r.w = s.w + (s.x - r.x);
          }
          if (dir.includes('n')) {
            r.y = clamp(s.y + dy, 0, s.y + s.h - win.minH);
            r.h = s.h + (s.y - r.y);
          }
          this.apply(win);
        };
        const end = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', end);
          handle.removeEventListener('pointercancel', end);
          win.el.classList.remove('is-resizing');
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
      });
    });
  }

  // --- keyboard -------------------------------------------------------------------
  bindKeyboard(win) {
    win.titlebar.addEventListener('keydown', (e) => {
      if (e.target !== win.titlebar) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        this.toggleMaximize(win);
        return;
      }
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!delta || this.mobile) return;
      e.preventDefault();
      if (win.maximized) this.toggleMaximize(win);
      const [dx, dy] = delta.map((d) => d * KEY_STEP);
      if (e.shiftKey) {
        win.rect.w = Math.max(win.minW, win.rect.w + dx);
        win.rect.h = Math.max(win.minH, win.rect.h + dy);
      } else {
        win.rect.x += dx;
        win.rect.y += dy;
      }
      this.constrain(win);
      this.apply(win);
    });
  }
}
