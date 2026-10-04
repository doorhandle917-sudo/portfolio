// Virtual filesystem. The tree is generated from content.js on every load;
// files saved by the visitor are kept as an overlay in localStorage.
import { createEmitter } from './util.js';
import { KERNEL } from './release.js';
import * as docs from './documents.js';

const STORAGE_KEY = 'gentoo-os:vfs:v1';

const ERRORS = {
  ENOENT: 'No such file or directory',
  ENOTDIR: 'Not a directory',
  EISDIR: 'Is a directory',
  EACCES: 'Permission denied',
};

export function fsError(code, path) {
  const err = new Error(ERRORS[code] || code);
  err.code = code;
  err.path = path;
  return err;
}

const dir = (children = {}, opts = {}) => ({ type: 'dir', children, ...opts });
const file = (content, opts = {}) => ({ type: 'file', content, ...opts });
const binary = (app) => ({ type: 'file', content: '', binary: true, app });

/** Command-line programs in /usr/bin (implemented by the terminal). */
export const CLI_BINARIES = [
  'about', 'cat', 'clear', 'contact', 'cowsay', 'date', 'echo', 'emerge', 'ls',
  'neofetch', 'projects', 'pwd', 'skills', 'sudo', 'uname', 'whoami',
];

/** Graphical programs in /usr/bin → app id. */
export const GUI_BINARIES = {
  portfolio: 'browser', terminal: 'terminal', files: 'files', editor: 'editor',
  settings: 'settings', snake: 'snake', minesweeper: 'minesweeper',
};

const OS_RELEASE = `NAME=Gentoo
ID=gentoo
PRETTY_NAME="Gentoo Linux"
ANSI_COLOR="1;32"
HOME_URL="https://www.gentoo.org/"
SUPPORT_URL="https://www.gentoo.org/support/"
BUG_REPORT_URL="https://bugs.gentoo.org/"
VERSION_ID="2.17"
`;

const MAKE_CONF = `# These settings were set by the catalyst build script that automatically
# built this stage. Please consult /usr/share/portage/config/make.conf.example
# for a more detailed example.
COMMON_FLAGS="-O2 -pipe -march=native"
CFLAGS="\${COMMON_FLAGS}"
CXXFLAGS="\${COMMON_FLAGS}"
MAKEOPTS="-j8 -l8"
USE="X wayland pulseaudio -systemd"
ACCEPT_LICENSE="-* @FREE"

# This sets the language of build output to English.
LC_MESSAGES=C.utf8
`;

const BASHRC = `# /etc/skel/.bashrc
#
# This file is sourced by all *interactive* bash shells on startup.

# Test for an interactive shell.
if [[ $- != *i* ]] ; then
	return
fi

alias ls='ls --color=auto'
alias grep='grep --colour=auto'
`;

export function createVfs(content) {
  const { user, hostname } = content.system;
  const home = `/home/${user}`;
  const bootTime = Date.now();
  const emitter = createEmitter();
  let overlay = loadOverlay();

  const byFile = (items, name, render) => Object.fromEntries(items.map((item) => [name(item), file(render(item))]));

  const tree = dir({
    boot: dir({ [`vmlinuz-${KERNEL}`]: binary() }),
    etc: dir({
      hostname: file(hostname + '\n'),
      motd: file(docs.motd(content)),
      'os-release': file(OS_RELEASE),
      portage: dir({ 'make.conf': file(MAKE_CONF) }),
    }),
    home: dir({
      [user]: dir({
        '.bashrc': file(BASHRC),
        'about.txt': file(docs.aboutTxt(content)),
        'contact.txt': file(docs.contactTxt(content)),
        'education.txt': file(docs.educationTxt(content)),
        'interests.txt': file(docs.interestsTxt(content)),
        'skills.txt': file(docs.skillsTxt(content)),
        experience: dir(byFile(content.experience, (j) => `${j.slug}.md`, docs.experienceMd)),
        projects: dir(byFile(content.projects, (p) => `${p.slug}.md`, docs.projectMd)),
        oryks: dir({ 'README.md': file(docs.oryksMd(content)) }),
        notes: dir(),
      }),
    }),
    root: dir({}, { private: true }),
    tmp: dir(),
    usr: dir({
      bin: dir({
        ...Object.fromEntries(CLI_BINARIES.map((name) => [name, binary()])),
        ...Object.fromEntries(Object.entries(GUI_BINARIES).map(([name, app]) => [name, binary(app)])),
      }),
    }),
  });

  function loadOverlay() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  }

  function saveOverlay() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
      return true;
    } catch {
      return false;
    }
  }

  // --- paths ---------------------------------------------------------------------
  function normalize(input, cwd = home) {
    let p = String(input ?? '');
    if (p === '~' || p.startsWith('~/')) p = home + p.slice(1);
    if (!p.startsWith('/')) p = `${cwd}/${p}`;
    const parts = [];
    for (const seg of p.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return '/' + parts.join('/');
  }

  const display = (path) => (path === home ? '~' : path.startsWith(home + '/') ? '~' + path.slice(home.length) : path);
  const parentOf = (path) => (path === '/' ? '/' : path.slice(0, path.lastIndexOf('/')) || '/');
  const nameOf = (path) => (path === '/' ? '/' : path.slice(path.lastIndexOf('/') + 1));
  const isWritable = (path) => [home, '/tmp'].some((root) => path === root || path.startsWith(root + '/'));
  const ownerOf = (path) => (path === home || path.startsWith(home + '/') ? user : 'root');

  function baseNode(path) {
    let node = tree;
    for (const seg of path.split('/').filter(Boolean)) {
      if (node.type !== 'dir' || !Object.hasOwn(node.children, seg)) return null;
      node = node.children[seg];
    }
    return node;
  }

  // --- queries -------------------------------------------------------------------
  function stat(input, cwd) {
    const path = normalize(input, cwd);
    const node = baseNode(path);
    const saved = overlay[path];
    if (!node && !saved) return null;
    if (node?.type === 'dir') {
      return { path, name: nameOf(path), type: 'dir', private: !!node.private, writable: isWritable(path), owner: ownerOf(path), mtime: bootTime, size: 4096 };
    }
    if (!node && (!stat(parentOf(path)) || stat(parentOf(path)).type !== 'dir')) return null;
    const text = saved ? saved.content : node.content;
    return {
      path, name: nameOf(path), type: 'file',
      binary: !!node?.binary, app: node?.app || null,
      writable: isWritable(path) && !node?.binary, owner: ownerOf(path),
      modified: !!(saved && node), created: !!(saved && !node),
      mtime: saved ? saved.mtime : bootTime,
      size: node?.binary ? 18432 + (nameOf(path).length * 977) % 90000 : new TextEncoder().encode(text).length,
    };
  }

  function list(input, cwd) {
    const path = normalize(input, cwd);
    const info = stat(path);
    if (!info) throw fsError('ENOENT', path);
    if (info.type !== 'dir') throw fsError('ENOTDIR', path);
    if (info.private) throw fsError('EACCES', path);
    const names = new Set(Object.keys(baseNode(path).children));
    for (const p of Object.keys(overlay)) if (parentOf(p) === path) names.add(nameOf(p));
    return [...names]
      .map((name) => stat(path === '/' ? `/${name}` : `${path}/${name}`))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  }

  function read(input, cwd) {
    const info = stat(input, cwd);
    if (!info) throw fsError('ENOENT', normalize(input, cwd));
    if (info.type === 'dir') throw fsError('EISDIR', info.path);
    return overlay[info.path]?.content ?? baseNode(info.path).content;
  }

  function write(input, text, cwd) {
    const path = normalize(input, cwd);
    const existing = stat(path);
    if (existing?.type === 'dir') throw fsError('EISDIR', path);
    const parent = stat(parentOf(path));
    if (!parent) throw fsError('ENOENT', path);
    if (parent.type !== 'dir') throw fsError('ENOTDIR', path);
    if (!isWritable(path) || existing?.binary) throw fsError('EACCES', path);
    const previous = overlay[path];
    overlay[path] = { content: String(text), mtime: Date.now() };
    if (!saveOverlay()) {
      if (previous) overlay[path] = previous;
      else delete overlay[path];
      const err = new Error('Not enough browser storage to save this file');
      err.code = 'ENOSPC';
      throw err;
    }
    emitter.emit({ type: 'write', path });
    return stat(path);
  }

  /** What kind of document a path is, for icons and "open with". */
  function kind(info) {
    if (!info) return null;
    if (info.type === 'dir') return 'dir';
    if (info.app) return 'app';
    if (info.binary) return 'binary';
    if (/\.md$/i.test(info.name)) return 'markdown';
    if (/\.txt$/i.test(info.name)) return 'text';
    return 'config';
  }

  return {
    home, user, hostname,
    normalize, display, parentOf, nameOf,
    stat, list, read, write, kind, isWritable,
    exists: (p, cwd) => !!stat(p, cwd),
    isDir: (p, cwd) => stat(p, cwd)?.type === 'dir',
    onChange: emitter.on,
  };
}
