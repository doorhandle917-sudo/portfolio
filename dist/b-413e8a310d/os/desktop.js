// Desktop shell: top panel (app menu, taskbar, clock), wallpaper, desktop
// icons and the window layer.
import { h, asset, formatTime } from './util.js';
import { appIcon, logo } from './icons.js';
import { WindowManager } from './wm.js';
import { APPS, CATEGORIES, launch, openPath } from './apps.js';
import { createVfs } from './vfs.js';
import { os } from './system.js';

const DESKTOP_ICONS = [
  { label: 'Home', icon: 'folder-home', run: () => launch('files', { path: '~' }) },
  { label: 'Terminal', icon: 'terminal', run: () => launch('terminal') },
  { label: 'Portfolio', icon: 'browser', run: () => launch('browser') },
  { label: 'Projects', icon: 'folder', run: () => launch('files', { path: '~/projects' }) },
  { label: 'about.txt', icon: 'file-text', run: () => os.openPath('~/about.txt') },
];

export function mountDesktop({ content }) {
  const layer = h('div', { class: 'window-layer' });
  const wm = new WindowManager(layer);
  Object.assign(os, { content, wm, launch, openPath, vfs: createVfs(content) });

  const menu = createAppMenu(content);
  const taskbar = createTaskbar(wm);
  const clock = createClock(content.system.timezone);
  const icons = createDesktopIcons();
  const launcher = createLauncher();

  const panel = h('nav', { class: 'panel', 'aria-label': 'Panel' },
    menu.button,
    taskbar.element,
    h('div', { class: 'panel-tray' }, clock),
  );
  const workspace = h('main', { class: 'workspace', 'aria-label': 'Desktop' }, icons.element, launcher, layer);
  const desktop = h('div', { class: 'desktop' }, panel, workspace, menu.element);
  document.body.append(desktop);

  // Below 768px: launcher grid + one full-screen app at a time.
  const small = window.matchMedia('(max-width: 767px)');
  const applyMode = () => {
    desktop.classList.toggle('is-mobile', small.matches);
    wm.setMobile(small.matches);
  };
  small.addEventListener('change', applyMode);
  applyMode();

  workspace.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.win, .desktop-icon')) icons.select(null);
  });

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'F1') {
      e.preventDefault();
      menu.toggle();
    }
  });

  // When no window is left active, keep keyboard focus somewhere useful.
  wm.events.on((_, info) => {
    if (!info?.idle) return;
    const lost = !document.activeElement || document.activeElement === document.body || document.activeElement.closest('.win[hidden], .win:not(.is-focused)');
    if (lost) (wm.mobile ? launcher.querySelector('button') : menu.button).focus();
  });

  menu.button.focus();
  return { wm, desktop };
}

// --- app menu ---------------------------------------------------------------------
function createAppMenu(content) {
  const { person } = content;
  const button = h('button', {
    class: 'panel-btn panel-menu-btn', type: 'button',
    'aria-expanded': 'false', 'aria-controls': 'app-menu', 'aria-label': 'Applications', title: 'Applications (Alt+F1)',
    html: logo({ size: 18 }),
  }, h('span', { class: 'label' }, 'Applications'));

  const items = [];
  const groups = CATEGORIES.map((category) => {
    const entries = Object.entries(APPS).filter(([, app]) => app.category === category);
    const groupId = `menu-group-${category.toLowerCase()}`;
    return h('li', null,
      h('div', { class: 'app-menu-group', id: groupId }, category),
      h('ul', { class: 'app-menu-items', role: 'list', 'aria-labelledby': groupId },
        entries.map(([id, app]) => {
          const item = h('button', {
            class: 'app-menu-item', type: 'button', dataset: { app: id },
            html: appIcon(app.icon),
            onClick: () => { close(); launch(id); },
          }, h('span', null, app.title, h('small', null, app.description)));
          items.push(item);
          return h('li', null, item);
        })),
    );
  });

  const element = h('nav', { class: 'app-menu', id: 'app-menu', 'aria-label': 'Applications', hidden: true },
    h('div', { class: 'app-menu-head' },
      h('img', { src: asset(person.avatar), alt: '', width: '46', height: '46' }),
      h('div', null, h('p', { class: 'app-menu-name' }, person.name), h('p', { class: 'app-menu-role' }, person.role)),
    ),
    h('ul', { class: 'app-menu-list', role: 'list' }, groups),
  );

  const isOpen = () => !element.hidden;
  function open() {
    element.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    items[0].focus();
  }
  function close({ restoreFocus = false } = {}) {
    if (!isOpen()) return;
    element.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
  }
  const toggle = () => (isOpen() ? close({ restoreFocus: true }) : open());

  button.addEventListener('click', toggle);
  element.addEventListener('keydown', (e) => {
    const i = items.indexOf(document.activeElement);
    const move = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (move !== undefined) {
      e.preventDefault();
      items[(move + items.length) % items.length].focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close({ restoreFocus: true });
    }
  });
  element.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !element.contains(e.relatedTarget) && e.relatedTarget !== button) close();
  });
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !element.contains(e.target) && !button.contains(e.target)) close();
  });

  return { button, element, open, close, toggle };
}

// --- taskbar ------------------------------------------------------------------------
function createTaskbar(wm) {
  const element = h('div', { class: 'taskbar', role: 'toolbar', 'aria-label': 'Open windows' });
  const buttons = new Map();

  wm.events.on(() => {
    const live = new Set(wm.windows.map((w) => w.id));
    for (const [id, btn] of buttons) {
      if (!live.has(id)) { btn.remove(); buttons.delete(id); }
    }
    // Taskbar keeps opening order (ids ascending), not z-order.
    [...wm.windows].sort((a, b) => a.id - b.id).forEach((win) => {
      let btn = buttons.get(win.id);
      if (!btn) {
        btn = h('button', { class: 'panel-btn task-btn', type: 'button', html: appIcon(win.icon), onClick: () => wm.toggleFromTaskbar(win) },
          h('span', { class: 'label' }));
        buttons.set(win.id, btn);
      }
      element.append(btn);
      btn.querySelector('.label').textContent = win.title;
      btn.title = win.title + (win.minimized ? ' (minimised)' : '');
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-pressed', String(wm.active === win && !win.minimized));
      btn.classList.toggle('is-minimized', win.minimized);
    });
  });
  return { element };
}

// --- clock ---------------------------------------------------------------------------
function createClock(timeZone) {
  const el = h('time', { class: 'panel-btn panel-clock', title: `Local time (${timeZone})` });
  const tick = () => {
    const now = new Date();
    el.dateTime = now.toISOString();
    el.textContent =
      formatTime(now, timeZone, { weekday: 'short', day: 'numeric', month: 'short' }) + '  ' +
      formatTime(now, timeZone, { hour: '2-digit', minute: '2-digit' });
    setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
  };
  tick();
  return el;
}

// --- launcher (small screens) -------------------------------------------------------------
function createLauncher() {
  const items = [
    ...CATEGORIES.flatMap((category) => Object.entries(APPS)
      .filter(([, app]) => app.category === category)
      .map(([id, app]) => ({ label: app.title, icon: app.icon, run: () => launch(id) }))),
    ...DESKTOP_ICONS.filter((item) => ['Projects', 'about.txt'].includes(item.label)),
  ];
  return h('nav', { class: 'launcher', 'aria-label': 'Apps' },
    items.map((item) => h('button', { class: 'launcher-item', type: 'button', html: appIcon(item.icon), onClick: () => item.run() },
      h('span', { class: 'label' }, item.label))));
}

// --- desktop icons -------------------------------------------------------------------
function createDesktopIcons() {
  let selected = null;
  const select = (btn) => {
    selected?.classList.remove('is-selected');
    selected = btn;
    btn?.classList.add('is-selected');
  };

  const element = h('ul', { class: 'desktop-icons', role: 'list', 'aria-label': 'Desktop shortcuts' },
    DESKTOP_ICONS.map((item) => {
      const btn = h('button', { class: 'desktop-icon', type: 'button', html: appIcon(item.icon), title: `Open ${item.label}` },
        h('span', { class: 'label' }, item.label));
      let touchOpened = false;
      btn.addEventListener('pointerdown', (e) => {
        select(btn);
        if (e.pointerType !== 'touch') touchOpened = false;
      });
      btn.addEventListener('pointerup', (e) => {
        // Touch devices open on a single tap.
        if (e.pointerType === 'touch') { touchOpened = true; item.run(); }
      });
      btn.addEventListener('dblclick', () => { if (!touchOpened) item.run(); });
      btn.addEventListener('click', (e) => {
        if (e.detail === 0) item.run(); // keyboard activation (Enter / Space)
      });
      btn.addEventListener('focus', () => select(btn));
      return h('li', null, btn);
    }),
  );
  return { element, select };
}
