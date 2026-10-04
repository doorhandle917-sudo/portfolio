// App registry, launcher and file associations.
// Each app module exports mount(win, args); it may set win.reuse(args) to
// accept new arguments when the launcher focuses an existing window.
import { h } from './util.js';
import { os } from './system.js';

export const APPS = {
  browser: {
    title: 'Portfolio', icon: 'browser', category: 'Internet', description: 'Browse the portfolio',
    width: 900, height: 620, minWidth: 320, minHeight: 260,
    load: () => import('../apps/browser.js'),
  },
  terminal: {
    title: 'Terminal', icon: 'terminal', category: 'Accessories', description: 'Shell with a virtual filesystem',
    width: 740, height: 470, minWidth: 300, minHeight: 180,
    load: () => import('../apps/terminal.js'),
  },
  files: {
    title: 'Files', icon: 'folder', category: 'Accessories', description: 'Browse the filesystem',
    width: 780, height: 500, minWidth: 320, minHeight: 240,
    load: () => import('../apps/files.js'),
  },
  editor: {
    title: 'Text Editor', icon: 'editor', category: 'Accessories', description: 'Write notes and edit files',
    width: 700, height: 500, minWidth: 300, minHeight: 220, reuseByPath: true,
    load: () => import('../apps/editor.js'),
  },
  snake: {
    title: 'Snake', icon: 'snake', category: 'Games', description: 'Eat, grow, avoid yourself',
    width: 460, height: 560, minWidth: 300, minHeight: 380, singleton: true,
    load: () => import('../apps/snake.js'),
  },
  minesweeper: {
    title: 'Minesweeper', icon: 'minesweeper', category: 'Games', description: 'Clear the field',
    width: 420, height: 540, minWidth: 300, minHeight: 360, singleton: true,
    load: () => import('../apps/minesweeper.js'),
  },
  settings: {
    title: 'Settings', icon: 'settings', category: 'Settings', description: 'Wallpaper, accent colour, theme',
    width: 640, height: 520, minWidth: 320, minHeight: 300, singleton: true,
    load: () => import('../apps/settings.js'),
  },
};

export const CATEGORIES = ['Internet', 'Accessories', 'Games', 'Settings'];

export async function launch(appId, args = {}) {
  const app = APPS[appId];
  if (!app) throw new Error(`Unknown application: ${appId}`);
  const { wm } = os;

  const existing = wm.windows.find((w) => w.appId === appId &&
    (app.singleton || (app.reuseByPath && args.path && w.data.path === args.path)));
  if (existing) {
    wm.focus(existing);
    existing.reuse?.(args);
    return existing;
  }

  const win = wm.open({
    appId, title: app.title, icon: app.icon, data: { ...args },
    width: app.width, height: app.height, minWidth: app.minWidth, minHeight: app.minHeight,
  });
  win.body.append(h('p', { class: 'app-loading' }, `Starting ${app.title}…`));
  try {
    const mod = await app.load();
    win.body.replaceChildren();
    await mod.mount(win, args);
    if (wm.active === win) win.focusContent();
  } catch (err) {
    console.error(err);
    win.body.replaceChildren(h('p', { class: 'app-error', role: 'alert' }, `${app.title} failed to start: ${err.message}`));
  }
  return win;
}

/**
 * Open a filesystem path in the matching app: folders in Files, app binaries
 * launch their app, text files open in the Text Editor.
 */
export function openPath(input, cwd) {
  const info = os.vfs.stat(input, cwd);
  if (!info) return Promise.reject(Object.assign(new Error(`${input}: No such file or directory`), { code: 'ENOENT' }));
  switch (os.vfs.kind(info)) {
    case 'dir': return launch('files', { path: info.path });
    case 'app': return launch(info.app);
    case 'binary':
      return Promise.reject(Object.assign(new Error(`${info.name} is a command-line program — run it in the Terminal.`), { code: 'EBINARY' }));
    default: return launch('editor', { path: info.path });
  }
}
