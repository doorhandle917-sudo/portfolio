// Settings: theme, accent colour and wallpaper. Changes apply immediately and
// persist in localStorage (os/prefs.js).
import { h } from '../os/util.js';
import { uiIcon } from '../os/icons.js';
import { ACCENTS, getPrefs, setPrefs, onPrefsChange } from '../os/prefs.js';
import { WALLPAPERS } from '../os/wallpapers.js';

let groupId = 0;

export function mount(win) {
  const id = `settings-${++groupId}`;
  const radio = (name, value, checked, label, extra = {}) =>
    h('input', { class: 'set-radio', type: 'radio', name: `${id}-${name}`, value, checked, 'aria-label': label, ...extra });

  // --- theme ----------------------------------------------------------------------
  const themeOptions = [['dark', 'Dark', 'moon'], ['light', 'Light', 'sun']].map(([value, label, icon]) => {
    const input = radio('theme', value, false, label);
    input.addEventListener('change', () => setPrefs({ theme: value }));
    return { value, input, el: h('label', { class: 'set-seg' }, input, h('span', null, h('span', { html: uiIcon(icon) }), label)) };
  });

  // --- accent ---------------------------------------------------------------------
  const accentOptions = ACCENTS.map(({ name, value }) => {
    const input = radio('accent', value, false, name);
    input.addEventListener('change', () => setPrefs({ accent: value }));
    return { value, input, el: h('label', { class: 'set-swatch', title: name }, input, h('span', { style: `background:${value}` })) };
  });
  const customInput = h('input', { class: 'set-color', type: 'color', 'aria-label': 'Custom accent colour' });
  customInput.addEventListener('input', () => setPrefs({ accent: customInput.value }));
  const customLabel = h('label', { class: 'set-custom' }, customInput, h('span', null, 'Custom…'));

  // --- wallpaper ------------------------------------------------------------------
  const wallpaperOptions = WALLPAPERS.map((wp) => {
    const input = radio('wallpaper', wp.id, false, wp.name);
    input.addEventListener('change', () => setPrefs({ wallpaper: wp.id }));
    const thumb = h('span', { class: 'set-thumb' });
    return { wp, input, thumb, el: h('label', { class: 'set-wallpaper' }, input, thumb, h('span', { class: 'set-wallpaper-name' }, wp.name)) };
  });

  const status = h('p', { class: 'set-note', role: 'status' }, 'Changes are applied and saved automatically.');

  win.body.append(h('div', { class: 'settings' },
    h('fieldset', null, h('legend', null, 'Appearance'), h('div', { class: 'set-segs' }, themeOptions.map((o) => o.el))),
    h('fieldset', null, h('legend', null, 'Accent colour'), h('div', { class: 'set-swatches' }, accentOptions.map((o) => o.el), customLabel)),
    h('fieldset', null, h('legend', null, 'Wallpaper'), h('div', { class: 'set-wallpapers' }, wallpaperOptions.map((o) => o.el))),
    status,
  ));

  function sync(prefs) {
    themeOptions.forEach((o) => { o.input.checked = o.value === prefs.theme; });
    accentOptions.forEach((o) => { o.input.checked = o.value === prefs.accent; });
    const custom = !ACCENTS.some((a) => a.value === prefs.accent);
    customLabel.classList.toggle('is-active', custom);
    customInput.value = prefs.accent;
    wallpaperOptions.forEach((o) => {
      o.input.checked = o.wp.id === prefs.wallpaper;
      o.thumb.style.background = o.wp.css(prefs);
    });
  }

  sync(getPrefs());
  win.onClose(onPrefsChange(sync));
  win.onFocus(() => (themeOptions.find((o) => o.input.checked) || themeOptions[0]).input.focus({ preventScroll: true }));
}
