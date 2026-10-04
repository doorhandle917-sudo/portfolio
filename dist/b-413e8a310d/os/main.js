// OS entry point — loaded by index.html only after the visitor presses Enter.
import content from '../content.js';
import { h, loadStyle, reducedMotion } from './util.js';
import { applyPrefs, currentWallpaperCss } from './prefs.js';

const STYLESHEETS = ['../styles/os.css', '../styles/boot.css', '../styles/apps.css'];

/** @param {{ skipRequested?: () => boolean }} options  Esc pressed before the boot screen loaded. */
export async function start({ skipRequested = () => false } = {}) {
  try {
    applyPrefs();
    const stylesReady = Promise.all(STYLESHEETS.map((href) => loadStyle(new URL(href, import.meta.url).href)));
    // The desktop loads in the background while the boot sequence plays.
    const desktopReady = import('./desktop.js');
    desktopReady.catch(() => {}); // reported when awaited below
    const skipBoot = reducedMotion();
    const bootReady = skipBoot ? null : import('../boot/boot.js');

    await stylesReady;
    document.getElementById('landing')?.remove();

    let boot = null;
    if (bootReady) {
      const { createBoot } = await bootReady;
      boot = createBoot({ content, wallpaper: currentWallpaperCss() });
      if (skipRequested()) boot.skip();
      await boot.play();
    }

    const { mountDesktop } = await desktopReady;
    mountDesktop({ content });
    await boot?.exit();
    window.__osReady = true;
  } catch (err) {
    console.error(err);
    panic(err);
  }
}

function panic(err) {
  document.querySelector('.boot')?.remove();
  document.getElementById('landing')?.remove();
  document.body.append(
    h('pre', { class: 'kernel-panic', role: 'alert', style: 'position:fixed;inset:0;margin:0;padding:16px;background:#000;color:#ddd;font:14px/1.5 monospace;white-space:pre-wrap' },
      'Kernel panic - not syncing: failed to start the desktop\n\n',
      String(err && err.stack ? err.stack : err),
      '\n\nReload the page to reboot.'),
  );
}
