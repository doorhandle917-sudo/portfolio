// File manager: browses the virtual filesystem; double-click opens files in
// their matching app.
import { h } from '../os/util.js';
import { appIcon, uiIcon } from '../os/icons.js';
import { os } from '../os/system.js';
import { APPS } from '../os/apps.js';

const KIND_ICON = { markdown: 'file-md', text: 'file-text', config: 'file-conf', binary: 'file-bin' };
const KIND_LABEL = { dir: 'folder', markdown: 'Markdown document', text: 'plain text document', config: 'configuration file', binary: 'program', app: 'application' };

export function mount(win, args = {}) {
  const { vfs } = os;
  const places = [
    { label: 'Home', path: vfs.home, icon: 'home' },
    { label: 'Projects', path: `${vfs.home}/projects`, icon: 'folder' },
    { label: 'Experience', path: `${vfs.home}/experience`, icon: 'folder' },
    { label: 'Notes', path: `${vfs.home}/notes`, icon: 'folder' },
    { label: 'File System', path: '/', icon: 'root' },
  ];

  let cwd = null;
  let entries = [];
  let selected = -1;
  let showHidden = false;
  const back = [];
  const forward = [];

  const tool = (icon, label, onClick) =>
    h('button', { class: 'tool-btn', type: 'button', 'aria-label': label, title: label, html: uiIcon(icon), onClick });
  const backBtn = tool('back', 'Back (Alt+Left)', () => goBack());
  const forwardBtn = tool('forward', 'Forward (Alt+Right)', () => goForward());
  const upBtn = tool('up', 'Parent folder (Alt+Up)', () => navigate(vfs.parentOf(cwd)));
  const homeBtn = tool('home', 'Home', () => navigate(vfs.home));
  const pathInput = h('input', { class: 'text-input fm-path', type: 'text', 'aria-label': 'Location', spellcheck: 'false', autocomplete: 'off' });
  const list = h('ul', { class: 'fm-items', role: 'listbox', tabindex: '0', 'aria-label': 'Files' });
  const status = h('span', { class: 'grow', role: 'status' });
  const sideButtons = places.map((p) =>
    h('button', { class: 'fm-place', type: 'button', html: uiIcon(p.icon), onClick: () => navigate(p.path) }, h('span', null, p.label)));

  win.body.append(h('div', { class: 'fm' },
    h('div', { class: 'app-toolbar' }, backBtn, forwardBtn, upBtn, homeBtn, h('span', { class: 'tool-sep' }), pathInput),
    h('div', { class: 'fm-main' },
      h('nav', { class: 'fm-side', 'aria-label': 'Places' }, h('h3', null, 'Places'), sideButtons),
      list),
    h('div', { class: 'app-status' }, status, h('span', { class: 'fm-hint' }, 'Double-click to open')),
  ));
  win.onFocus(() => list.focus({ preventScroll: true }));

  // --- navigation ---------------------------------------------------------------
  function navigate(input, { push = true } = {}) {
    const info = vfs.stat(input, cwd || vfs.home);
    if (!info) return say(`“${input}” does not exist.`, true);
    if (info.type !== 'dir') return openEntry(info);
    if (info.private) return say(`You don't have permission to open “${vfs.display(info.path)}”.`, true);
    if (push && cwd && cwd !== info.path) { back.push(cwd); forward.length = 0; }
    cwd = info.path;
    win.data.path = cwd;
    selected = -1;
    render();
  }

  function goBack() {
    if (!back.length) return;
    forward.push(cwd);
    navigate(back.pop(), { push: false });
  }

  function goForward() {
    if (!forward.length) return;
    back.push(cwd);
    navigate(forward.pop(), { push: false });
  }

  function openEntry(info) {
    if (info.type === 'dir') return navigate(info.path);
    os.openPath(info.path).catch((err) => say(err.message, true));
  }

  // --- rendering ----------------------------------------------------------------
  function iconFor(info) {
    const kind = vfs.kind(info);
    if (kind === 'dir') return info.path === vfs.home ? 'folder-home' : 'folder';
    if (kind === 'app') return APPS[info.app]?.icon || 'file-bin';
    return KIND_ICON[kind];
  }

  function render() {
    const name = cwd === '/' ? 'File System' : vfs.nameOf(cwd);
    win.setTitle(`${name} — Files`);
    pathInput.value = vfs.display(cwd);
    backBtn.disabled = !back.length;
    forwardBtn.disabled = !forward.length;
    upBtn.disabled = cwd === '/';
    sideButtons.forEach((btn, i) => btn.setAttribute('aria-current', String(places[i].path === cwd)));

    entries = vfs.list(cwd)
      .filter((e) => showHidden || !e.name.startsWith('.'))
      .sort((a, b) => (a.type === b.type ? 0 : a.type === 'dir' ? -1 : 1) || a.name.localeCompare(b.name));
    list.setAttribute('aria-label', `Files in ${vfs.display(cwd)}`);
    list.removeAttribute('aria-activedescendant');
    list.replaceChildren(...entries.map((info, i) => {
      const item = h('li', {
        class: 'fm-item', role: 'option', id: `fm-${win.id}-${i}`, 'aria-selected': 'false', title: info.name,
        html: appIcon(iconFor(info)),
      }, h('span', { class: 'name' }, info.name));
      item.addEventListener('pointerdown', () => select(i));
      item.addEventListener('dblclick', () => openEntry(info));
      item.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') openEntry(info); });
      return item;
    }));
    if (!entries.length) list.append(h('li', { class: 'fm-empty', role: 'presentation' }, 'This folder is empty.'));
    describe();
  }

  function select(i) {
    selected = i;
    [...list.querySelectorAll('.fm-item')].forEach((el, j) => el.setAttribute('aria-selected', String(j === i)));
    const el = i >= 0 && list.querySelector(`#fm-${win.id}-${i}`);
    if (el) {
      list.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    } else list.removeAttribute('aria-activedescendant');
    describe();
  }

  function describe() {
    const info = entries[selected];
    if (!info) return say(`${entries.length} item${entries.length === 1 ? '' : 's'}`);
    const kind = vfs.kind(info);
    const size = kind === 'dir' ? '' : ` · ${formatSize(info.size)}`;
    const flag = info.modified ? ' · edited' : info.created ? ' · new' : '';
    say(`“${info.name}” — ${KIND_LABEL[kind]}${size}${flag}`);
  }

  function say(text, isError = false) {
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  }

  // --- keyboard -------------------------------------------------------------------
  function columns() {
    const items = list.querySelectorAll('.fm-item');
    if (items.length < 2) return 1;
    const top = items[0].offsetTop;
    let n = 0;
    while (n < items.length && items[n].offsetTop === top) n++;
    return n;
  }

  list.addEventListener('keydown', (e) => {
    const count = entries.length;
    const cur = selected < 0 ? -1 : selected;
    const cols = columns();
    const moves = { ArrowRight: cur + 1, ArrowLeft: cur - 1, ArrowDown: cur < 0 ? 0 : cur + cols, ArrowUp: cur - cols, Home: 0, End: count - 1 };
    if (e.altKey) return;
    if (e.key in moves && count) {
      e.preventDefault();
      select(Math.max(0, Math.min(count - 1, moves[e.key])));
    } else if (e.key === 'Enter' && entries[selected]) {
      e.preventDefault();
      openEntry(entries[selected]);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      goBack();
    }
  });

  win.body.addEventListener('keydown', (e) => {
    if (e.target === pathInput) return;
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goForward(); }
    else if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); if (cwd !== '/') navigate(vfs.parentOf(cwd)); }
    else if (e.ctrlKey && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); showHidden = !showHidden; render(); }
  });

  pathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); navigate(pathInput.value.trim() || '~'); list.focus(); }
    else if (e.key === 'Escape') { pathInput.value = vfs.display(cwd); list.focus(); }
  });

  list.addEventListener('pointerdown', (e) => {
    if (e.target === list) select(-1);
  });

  // Refresh when files are saved elsewhere (editor, other windows).
  const off = vfs.onChange((change) => {
    if (vfs.parentOf(change.path) === cwd) {
      const keep = entries[selected]?.name;
      render();
      if (keep) select(entries.findIndex((e) => e.name === keep));
    }
  });
  win.onClose(off);

  navigate(args.path || '~', { push: false });
  if (!cwd) navigate('~', { push: false });
}

function formatSize(bytes) {
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1e6) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${(bytes / 1e6).toFixed(1)} MB`;
}
