// Text editor: open, edit and save files from the virtual filesystem. Saved
// files persist in localStorage through the VFS overlay.
import { h } from '../os/util.js';
import { appIcon, uiIcon } from '../os/icons.js';
import { os } from '../os/system.js';
import { choose, prompt, custom } from '../os/dialog.js';

export function mount(win, args = {}) {
  const { vfs } = os;
  let path = null; // absolute path; null while untitled
  let saved = ''; // text as last loaded/saved
  let readonly = false;

  const textarea = h('textarea', { class: 'editor-text', spellcheck: 'false', autocapitalize: 'off', 'aria-label': 'Document' });
  const banner = h('div', { class: 'editor-banner', hidden: true });
  const where = h('span', { class: 'grow' });
  const cursor = h('span', { class: 'editor-cursor' });
  const state = h('span', { role: 'status' });
  const tool = (icon, label, title, onClick) =>
    h('button', { class: 'tool-btn', type: 'button', title, html: uiIcon(icon), onClick }, h('span', null, label));

  win.body.append(h('div', { class: 'editor' },
    h('div', { class: 'app-toolbar', role: 'toolbar', 'aria-label': 'File' },
      tool('plus', 'New', 'New document', () => newDocument()),
      tool('open', 'Open…', 'Open a file', () => openDialog()),
      tool('save', 'Save', 'Save (Ctrl+S)', () => save()),
      tool('file', 'Save as…', 'Save as (Ctrl+Shift+S)', () => saveAs()),
    ),
    banner,
    textarea,
    h('div', { class: 'app-status' }, where, cursor, state),
  ));
  win.onFocus(() => textarea.focus({ preventScroll: true }));

  const isDirty = () => textarea.value !== saved;
  const displayName = () => (path ? vfs.nameOf(path) : 'Untitled');

  function update() {
    win.setTitle(`${isDirty() ? '• ' : ''}${displayName()} — Text Editor`);
    where.textContent = path ? vfs.display(path) : 'Not saved yet';
    state.textContent = readonly ? 'Read-only' : isDirty() ? 'Modified' : path && vfs.exists(path) ? 'Saved' : 'New file';
    const info = path && vfs.stat(path);
    if (readonly) {
      banner.hidden = false;
      banner.textContent = 'This is a read-only system file. Use “Save as…” to keep an edited copy in your home folder.';
    } else if (info?.modified) {
      banner.hidden = false;
      banner.textContent = 'You have edited this file. Edits are saved in this browser only.';
    } else banner.hidden = true;
  }

  function updateCursor() {
    const before = textarea.value.slice(0, textarea.selectionStart);
    const line = before.split('\n').length;
    const col = before.length - before.lastIndexOf('\n');
    cursor.textContent = `Ln ${line}, Col ${col}`;
  }

  function load(target) {
    const info = vfs.stat(target);
    if (info && (info.type === 'dir' || info.binary)) {
      flash(`Can't open “${vfs.display(info.path)}” as text.`);
      return;
    }
    path = vfs.normalize(target);
    saved = info ? vfs.read(path) : '';
    readonly = !vfs.isWritable(path);
    textarea.value = saved;
    win.data.path = path;
    textarea.setSelectionRange(0, 0);
    textarea.scrollTop = 0;
    update();
    updateCursor();
  }

  function flash(text) {
    state.textContent = text;
  }

  /** Resolves true when it's fine to throw away the current buffer. */
  async function confirmDiscard(action) {
    if (!isDirty()) return true;
    const answer = await choose(win, {
      title: `Save changes to “${displayName()}” ${action}?`,
      message: 'Your changes will be lost if you don\'t save them.',
      buttons: [
        { label: `${action === 'before closing' ? 'Close' : 'Continue'} without saving`, value: 'discard', danger: true },
        { label: 'Cancel', value: 'cancel' },
        { label: 'Save', value: 'save', primary: true },
      ],
      cancelValue: 'cancel',
    });
    if (answer === 'save') return save();
    return answer === 'discard';
  }

  function writeTo(target) {
    try {
      vfs.write(target, textarea.value);
      path = vfs.normalize(target);
      saved = textarea.value;
      readonly = false;
      win.data.path = path;
      update();
      flash('Saved');
      return true;
    } catch (err) {
      flash(`Could not save: ${err.message}`);
      return false;
    }
  }

  async function save() {
    if (!path || readonly) return saveAs();
    return writeTo(path);
  }

  async function saveAs() {
    const name = path ? vfs.nameOf(path) : 'untitled.txt';
    const suggestion = path && vfs.isWritable(path) ? vfs.display(path) : `~/notes/${/\.\w+$/.test(name) ? name : name + '.txt'}`;
    const target = await prompt(win, {
      title: 'Save as',
      message: 'Save anywhere in your home folder (~) or /tmp.',
      value: suggestion,
      okLabel: 'Save',
      validate: (value) => {
        if (!value.trim()) return 'Enter a file name.';
        const p = vfs.normalize(value.trim());
        const info = vfs.stat(p);
        if (info?.type === 'dir') return 'That is a folder — add a file name.';
        if (!vfs.isDir(vfs.parentOf(p))) return `The folder “${vfs.display(vfs.parentOf(p))}” does not exist.`;
        if (!vfs.isWritable(p) || info?.binary) return 'Permission denied — save inside ~ or /tmp.';
        return null;
      },
    });
    if (target == null) return false;
    const p = vfs.normalize(target.trim());
    if (p !== path && vfs.exists(p)) {
      const overwrite = await choose(win, {
        title: `Replace “${vfs.nameOf(p)}”?`,
        message: 'A file with that name already exists.',
        buttons: [{ label: 'Cancel', value: false }, { label: 'Replace', value: true, primary: true }],
        cancelValue: false,
      });
      if (!overwrite) return false;
    }
    return writeTo(p);
  }

  async function newDocument() {
    if (!(await confirmDiscard('first'))) return;
    path = null;
    saved = '';
    readonly = false;
    textarea.value = '';
    win.data.path = null;
    update();
    updateCursor();
    textarea.focus();
  }

  function textFiles(dir, out = []) {
    for (const e of vfs.list(dir)) {
      if (e.type === 'dir' && !e.private) textFiles(e.path, out);
      else if (e.type === 'file' && !e.binary) out.push(e);
    }
    return out;
  }

  async function openDialog() {
    if (!(await confirmDiscard('first'))) return;
    const files = textFiles(vfs.home);
    const target = await custom(win, (finish, titleId) => {
      const input = h('input', { class: 'text-input', type: 'text', placeholder: '~/notes/todo.txt', 'aria-label': 'Path to open', spellcheck: 'false' });
      const error = h('p', { class: 'dialog-error', role: 'alert' });
      const submit = () => {
        const value = input.value.trim();
        if (!value) { error.textContent = 'Pick a file or type a path.'; return; }
        const info = vfs.stat(value);
        if (info?.type === 'dir') { error.textContent = 'That is a folder.'; return; }
        if (info?.binary) { error.textContent = 'That is a program, not a text file.'; return; }
        if (!info && !vfs.isDir(vfs.parentOf(vfs.normalize(value)))) { error.textContent = 'No such file or directory.'; return; }
        finish(value);
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      return {
        cancelValue: null,
        initialFocus: input,
        content: [
          h('h3', { id: titleId }, 'Open file'),
          h('ul', { class: 'editor-files', 'aria-label': 'Files in your home folder' },
            files.map((f) => h('li', null, h('button', { type: 'button', html: appIcon(/\.md$/.test(f.name) ? 'file-md' : 'file-text'), onClick: () => finish(f.path) },
              h('span', null, vfs.display(f.path)))))),
          input,
          error,
          h('div', { class: 'win-dialog-actions' },
            h('button', { class: 'btn', type: 'button', onClick: () => finish(null) }, 'Cancel'),
            h('button', { class: 'btn btn-primary', type: 'button', onClick: submit }, 'Open')),
        ],
      };
    });
    if (target == null) return;
    // Reuse a window that already has this file open.
    const p = vfs.normalize(target);
    const other = os.wm.windows.find((w) => w !== win && w.appId === 'editor' && w.data.path === p);
    if (other) other.focus();
    else load(p);
  }

  textarea.addEventListener('input', () => { update(); updateCursor(); });
  ['keyup', 'click', 'select'].forEach((type) => textarea.addEventListener(type, updateCursor));
  win.body.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (e.shiftKey) saveAs();
      else save();
    }
  });

  // Pick up saves from other windows when this buffer has no local changes.
  const off = vfs.onChange((change) => {
    if (change.path === path && !isDirty() && vfs.read(path) !== saved) load(path);
    else if (change.path === path) update();
  });
  win.onClose(off);
  win.beforeClose = () => confirmDiscard('before closing');

  if (args.path) load(args.path);
  else { update(); updateCursor(); }
}
