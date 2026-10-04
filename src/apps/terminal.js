// Terminal: a small bash-like shell over the virtual filesystem.
import { h, externalLink, mailLink, isPlaceholder, placeholderChip, formatTime, reducedMotion } from '../os/util.js';
import { os } from '../os/system.js';
import { GUI_BINARIES } from '../os/vfs.js';
import { KERNEL, ARCH, SHELL, DESKTOP } from '../os/release.js';
import { getPrefs } from '../os/prefs.js';
import { APPS } from '../os/apps.js';

const history = []; // shared by every terminal window in this session
const MAX_ROWS = 1500;
const CANCELLED = Symbol('cancelled');

// Own drawing of a Gentoo-style swirl for neofetch.
const ART = [
  "          .:+oooo+:.",
  "       .+oooooooooooo+.",
  "     .+oooooooooooooooo+.",
  "    :oooooo+:.  .:+oooooo:",
  "   +ooooo+'  .--.  '+ooooo:",
  "   oooooo'  /    \\  'oooooo",
  "   +ooooo:  \\    /  .ooooo+",
  "   .oooooo+. '--' .+oooooo.",
  "    '+oooooooo++oooooooo+'",
  "      ':+ooooooooooooo+:'",
  "       .+ooooooo+:-.'",
  "     .+oooo+:.'",
  "    +ooo/.'",
  "   +o/.'",
  "   :'",
];

// Larry the Cow, drawn for this site.
const COW = [
  "        \\   ,__,",
  "         \\  (oo)____",
  "            (__)    )\\",
  "               ||--|| *",
];

export function mount(win, args = {}) {
  new Terminal(win, args);
}

const c = (cls, text) => h('span', { class: cls }, text);

class Terminal {
  constructor(win, args) {
    this.win = win;
    this.vfs = os.vfs;
    this.content = os.content;
    this.cwd = args.cwd && this.vfs.isDir(args.cwd) ? this.vfs.normalize(args.cwd) : this.vfs.home;
    this.prevCwd = null;
    this.histIndex = history.length;
    this.draft = '';
    this.busy = false;
    this.cancelled = false;
    this.cancelWaiters = new Set();
    this.question = null;

    this.output = h('div', { class: 'term-output', role: 'log', 'aria-live': 'polite', 'aria-label': 'Terminal output' });
    this.promptEl = h('span', { class: 'term-prompt', 'aria-hidden': 'true' });
    this.input = h('input', {
      class: 'term-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off',
      spellcheck: 'false', enterkeyhint: 'send', 'aria-label': 'Terminal command',
    });
    this.screen = h('div', { class: 'term-screen' }, this.output, h('div', { class: 'term-line' }, this.promptEl, this.input));
    this.root = h('div', { class: 'term' }, this.screen);
    win.body.append(this.root);
    win.onFocus(() => this.input.focus({ preventScroll: true }));

    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.screen.addEventListener('mouseup', () => {
      if (!String(window.getSelection())) this.input.focus({ preventScroll: true });
    });

    this.printText(this.vfs.read('/etc/motd').trimEnd(), 't-dim');
    this.print();
    this.renderPrompt();
  }

  // --- output -----------------------------------------------------------------
  print(...nodes) {
    const row = h('div', { class: 'term-row' }, ...nodes);
    this.output.append(row);
    while (this.output.childElementCount > MAX_ROWS) this.output.firstElementChild.remove();
    this.scroll();
    return row;
  }

  printText(text, cls) {
    for (const line of String(text).split('\n')) this.print(cls ? c(cls, line) : line);
  }

  error(text) { this.print(c('t-red', text)); }

  scroll() {
    cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => { this.screen.scrollTop = this.screen.scrollHeight; });
  }

  promptNodes() {
    const { user, hostname } = this.vfs;
    return [c('t-green t-bold', `${user}@${hostname}`), c('t-blue t-bold', ` ${this.vfs.display(this.cwd)} $`), ' '];
  }

  renderPrompt() {
    this.promptEl.replaceChildren(...(this.question ? [c('t-bold', this.question.text + ' ')] : this.promptNodes()));
    this.win.setTitle(`${this.vfs.user}@${this.vfs.hostname}: ${this.vfs.display(this.cwd)}`);
    this.scroll();
  }

  // --- input ------------------------------------------------------------------
  onKey(e) {
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      if (this.busy) { this.cancel(); e.preventDefault(); return; }
      if (window.getSelection && String(window.getSelection())) return; // let copy work
      e.preventDefault();
      this.print(...(this.question ? [this.question.text + ' '] : this.promptNodes()), this.input.value, c('t-dim', '^C'));
      this.input.value = '';
      if (this.question) { this.question.resolve(null); this.question = null; }
      this.renderPrompt();
      return;
    }
    if (this.busy) { e.preventDefault(); return; }
    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); this.output.replaceChildren(); return; }
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); this.input.value = ''; return; }

    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        const line = this.input.value;
        this.input.value = '';
        this.submit(line);
        break;
      }
      case 'ArrowUp':
        e.preventDefault();
        if (this.question || !history.length) return;
        if (this.histIndex === history.length) this.draft = this.input.value;
        this.histIndex = Math.max(0, this.histIndex - 1);
        this.setInput(history[this.histIndex]);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (this.question || this.histIndex >= history.length) return;
        this.histIndex += 1;
        this.setInput(this.histIndex === history.length ? this.draft : history[this.histIndex]);
        break;
      case 'Tab':
        e.preventDefault();
        if (!this.question) this.complete();
        break;
      default:
    }
  }

  setInput(value) {
    this.input.value = value;
    requestAnimationFrame(() => this.input.setSelectionRange(value.length, value.length));
  }

  async submit(line) {
    if (this.question) {
      const q = this.question;
      this.question = null;
      this.print(c('t-bold', q.text + ' '), line);
      this.renderPrompt();
      q.resolve(line);
      return;
    }
    this.print(...this.promptNodes(), line);
    if (line.trim() && history[history.length - 1] !== line) history.push(line);
    this.histIndex = history.length;
    this.draft = '';
    if (!line.trim()) return;

    this.busy = true;
    this.cancelled = false;
    this.root.classList.add('is-busy');
    try {
      await this.execute(line);
    } catch (err) {
      if (err !== CANCELLED) {
        console.error(err);
        this.error(`bash: ${err.message}`);
      }
    } finally {
      this.busy = false;
      this.root.classList.remove('is-busy');
      this.renderPrompt();
      if (this.win.wm.active === this.win) this.input.focus({ preventScroll: true });
    }
  }

  /** Ask a question; the next submitted line is the answer (null on Ctrl+C). */
  ask(text) {
    return new Promise((resolve) => {
      this.question = { text, resolve };
      this.busy = false;
      this.root.classList.remove('is-busy');
      this.renderPrompt();
    }).finally(() => {
      this.busy = true;
      this.root.classList.add('is-busy');
    });
  }

  cancel() {
    this.cancelled = true;
    this.print(c('t-dim', '^C'));
    this.cancelWaiters.forEach((fn) => fn());
    this.cancelWaiters.clear();
  }

  /** Sleep that aborts on Ctrl+C. Instant when reduced motion is requested. */
  sleep(ms) {
    if (this.cancelled) return Promise.reject(CANCELLED);
    if (reducedMotion()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const done = () => reject(CANCELLED);
      const timer = setTimeout(() => { this.cancelWaiters.delete(done); resolve(); }, ms);
      this.cancelWaiters.add(() => { clearTimeout(timer); done(); });
    });
  }

  // --- execution ----------------------------------------------------------------
  env(name) {
    const vars = {
      USER: this.vfs.user, HOME: this.vfs.home, PWD: this.cwd, HOSTNAME: this.vfs.hostname,
      SHELL: '/bin/bash', TERM: 'xterm-256color', PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'en_GB.UTF-8',
    };
    return vars[name] ?? '';
  }

  async execute(line) {
    const [name, ...args] = tokenize(line, (v) => this.env(v), this.vfs.home);
    if (name === undefined) return;
    const command = COMMANDS[name];
    if (command) return command.run.call(this, args);
    if (Object.hasOwn(GUI_BINARIES, name)) return this.startApp(GUI_BINARIES[name]);
    if (name.includes('/')) {
      const info = this.vfs.stat(name, this.cwd);
      if (!info) return this.error(`bash: ${name}: No such file or directory`);
      if (info.type === 'dir') return this.error(`bash: ${name}: Is a directory`);
      if (info.app) return this.startApp(info.app);
      if (!info.binary) return this.error(`bash: ${name}: Permission denied`);
      return this.error(`bash: ${name}: run it by name, e.g. ${info.name}`);
    }
    this.error(`bash: ${name}: command not found`);
  }

  startApp(appId) {
    os.launch(appId);
    this.print(c('t-dim', `Started ${APPS[appId].title}.`));
  }

  // --- tab completion -------------------------------------------------------------
  complete() {
    const value = this.input.value;
    const caret = this.input.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const word = /(\S*)$/.exec(before)[1];
    const isCommand = before.slice(0, before.length - word.length).trim() === '';
    let candidates;

    if (isCommand && !word.includes('/')) {
      const names = new Set([...Object.keys(COMMANDS), ...Object.keys(GUI_BINARIES)]);
      candidates = [...names].filter((n) => n.startsWith(word)).sort().map((n) => ({ text: n, label: n, dir: false }));
    } else {
      const slash = word.lastIndexOf('/');
      const dirPart = word.slice(0, slash + 1);
      const base = word.slice(slash + 1);
      const dirsOnly = /^\s*cd\s/.test(before);
      let entries = [];
      try { entries = this.vfs.list(dirPart || '.', this.cwd); } catch { entries = []; }
      candidates = entries
        .filter((e) => e.name.startsWith(base) && (base.startsWith('.') || !e.name.startsWith('.')))
        .filter((e) => !dirsOnly || e.type === 'dir')
        .map((e) => ({ text: dirPart + e.name, label: e.name + (e.type === 'dir' ? '/' : ''), dir: e.type === 'dir' }));
    }

    if (!candidates.length) return;
    const insert = (text) => {
      const next = before.slice(0, before.length - word.length) + text;
      this.input.value = next + value.slice(caret);
      this.input.setSelectionRange(next.length, next.length);
    };
    if (candidates.length === 1) {
      const [only] = candidates;
      insert(only.text + (only.dir ? '/' : ' '));
      return;
    }
    const prefix = candidates.reduce((acc, cand) => {
      let i = 0;
      while (i < acc.length && acc[i] === cand.text[i]) i++;
      return acc.slice(0, i);
    }, candidates[0].text);
    if (prefix.length > word.length) insert(prefix);
    else {
      this.print(...this.promptNodes(), value);
      this.print(h('div', { class: 'term-grid' }, candidates.map((cand) => c(cand.dir ? 't-blue t-bold' : '', cand.label))));
    }
  }
}

// --- tokenizer ------------------------------------------------------------------------
export function tokenize(line, env, home) {
  const tokens = [];
  let cur = '';
  let inToken = false;
  let quote = null;
  const expand = (i) => {
    const m = /^\$(?:\{(\w+)\}|(\w+))/.exec(line.slice(i));
    if (!m) return null;
    return { value: env(m[1] || m[2]), length: m[0].length };
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) { quote = null; continue; }
      if (quote === '"' && ch === '\\' && i + 1 < line.length) { cur += line[++i]; continue; }
      if (quote === '"' && ch === '$') {
        const x = expand(i);
        if (x) { cur += x.value; i += x.length - 1; continue; }
      }
      cur += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (inToken) { tokens.push(cur); cur = ''; inToken = false; }
      continue;
    }
    if (!inToken && ch === '~' && (i + 1 === line.length || /[\s/]/.test(line[i + 1]))) {
      inToken = true;
      cur += home;
      continue;
    }
    inToken = true;
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '\\' && i + 1 < line.length) { cur += line[++i]; continue; }
    if (ch === '$') {
      const x = expand(i);
      if (x) { cur += x.value; i += x.length - 1; continue; }
    }
    cur += ch;
  }
  if (quote) throw new Error(`unexpected EOF while looking for matching \`${quote}'`);
  if (inToken) tokens.push(cur);
  return tokens;
}

/** Split "-al" style flags from operands. Returns { flags:Set, operands, bad } */
function parseFlags(args, allowed) {
  const flags = new Set();
  const operands = [];
  let bad = null;
  for (const arg of args) {
    if (arg.startsWith('-') && arg.length > 1 && !operands.length) {
      for (const f of arg.slice(1)) {
        if (allowed.includes(f)) flags.add(f);
        else bad ??= f;
      }
    } else operands.push(arg);
  }
  return { flags, operands, bad };
}

const pad = (s, n) => String(s).padEnd(n);

function dateString(timeZone, date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const zone = formatTime(date, timeZone, { timeZoneName: 'short' }).split(' ').pop();
  return `${parts.weekday} ${parts.month} ${String(parts.day).padStart(2, ' ')} ${parts.hour}:${parts.minute}:${parts.second} ${zone} ${parts.year}`;
}

function lsDate(ms, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.month} ${String(p.day).padStart(2, ' ')} ${p.hour}:${p.minute}`;
}

function entryClass(e) {
  if (e.type === 'dir') return 't-blue t-bold';
  if (e.binary) return 't-green t-bold';
  return '';
}

function valueNode(value) {
  return isPlaceholder(value) ? placeholderChip(value) : value;
}

// --- commands ---------------------------------------------------------------------------
const COMMANDS = {
  help: {
    summary: 'show this help',
    run() {
      const section = (title, names) => {
        this.print(c('t-bold t-accent', title));
        for (const n of names) this.print('  ', c('t-green', pad(COMMANDS[n].usage || n, 18)), c('t-dim', COMMANDS[n].summary));
      };
      this.print(c('t-bold', `GNU ${SHELL} — portfolio edition`));
      this.print();
      section('Portfolio', ['about', 'projects', 'skills', 'contact']);
      this.print();
      section('System', ['ls', 'cd', 'pwd', 'cat', 'echo', 'clear', 'history', 'whoami', 'uname', 'date', 'neofetch', 'help', 'exit']);
      this.print();
      this.print(c('t-bold t-accent', 'Apps'));
      this.print('  ', Object.keys(GUI_BINARIES).map((n, i) => [i ? c('t-dim', ' · ') : '', c('t-green', n)]));
      this.print();
      this.print(c('t-dim', 'Tab completes · ↑/↓ history · Ctrl+L clears · Ctrl+C cancels'));
      this.print(c('t-dim', '…and a few things any Gentoo user would try.'));
    },
  },

  about: {
    summary: 'who I am',
    run() {
      const { person, profile, experience, education, languages, interests, oryks } = this.content;
      this.print(c('t-bold t-accent', person.name));
      this.print(`${person.role} · ${person.location}`);
      this.print(c('t-green', '● '), person.status);
      this.print();
      this.print(c('t-bold', profile.title));
      this.print(profile.text);
      this.print();
      this.print(c('t-bold', 'Work Experience'));
      const width = Math.max(...experience.map((j) => `${j.title} — ${j.company}`.length)) + 3;
      for (const j of experience) this.print('  ', pad(`${j.title} — ${j.company}`, width), c('t-dim', j.period));
      this.print(c('t-dim', '  details: ls ~/experience'));
      this.print();
      this.print(c('t-bold', 'Education'));
      for (const e of education) this.print('  ', `${e.degree}, ${e.school}`, c('t-dim', ` · ${e.period} · ${e.location}`));
      this.print();
      this.print(c('t-bold', 'Languages'));
      this.print('  ', languages.map((l, i) => [i ? c('t-dim', ' · ') : '', `${l.name} `, c('t-dim', `(${l.level})`)]));
      this.print();
      this.print(c('t-bold', 'Interests'));
      this.print('  ', interests.join(' · '));
      this.print();
      this.print(c('t-bold', oryks.title), c('t-dim', ' — cat ~/oryks/README.md'));
      this.print();
      this.print(c('t-dim', `"${person.quote}"`));
    },
  },

  projects: {
    summary: 'personal projects',
    run() {
      const { projects } = this.content;
      this.print(c('t-bold t-accent', `Personal Projects (${projects.length})`));
      projects.forEach((p, i) => {
        this.print();
        this.print(c('t-yellow', `[${i + 1}] `), c('t-bold', p.title));
        for (const b of p.bullets) this.print(c('t-dim', '    • '), b);
        this.print(c('t-dim', '    tags: '), p.tags.map((t, j) => [j ? c('t-dim', ' · ') : '', c('t-cyan', t)]));
        if (p.period) this.print(c('t-dim', '    period: '), valueNode(p.period));
        if (p.repo) this.print(c('t-dim', '    repo: '), isPlaceholder(p.repo) ? placeholderChip(p.repo) : externalLink(p.repo));
      });
      this.print();
      this.print(c('t-dim', 'Files: ls ~/projects · Viewer: portfolio'));
    },
  },

  skills: {
    summary: 'technical skills',
    run() {
      const { skills } = this.content;
      const width = Math.max(...skills.map((s) => s.group.length)) + 3;
      this.print(c('t-bold t-accent', 'Skills'));
      for (const s of skills) this.print('  ', c('t-bold', pad(s.group, width)), s.items.map((t, j) => [j ? c('t-dim', ' · ') : '', c('t-cyan', t)]));
    },
  },

  contact: {
    summary: 'how to reach me',
    run() {
      const { contact } = this.content;
      const width = Math.max(5, ...contact.links.map((l) => l.label.length)) + 3;
      this.print(c('t-bold t-accent', contact.heading), c('t-dim', ` — ${contact.cta}`));
      this.print('  ', c('t-bold', pad('Email', width)), mailLink(contact.email));
      for (const l of contact.links) this.print('  ', c('t-bold', pad(l.label, width)), externalLink(l.url));
    },
  },

  ls: {
    usage: 'ls [-al] [path]',
    summary: 'list directory contents',
    run(args) {
      const { flags, operands, bad } = parseFlags(args, ['a', 'l', 'A', '1', 'h']);
      if (bad) return this.error(`ls: invalid option -- '${bad}'`);
      const targets = operands.length ? operands : ['.'];
      const showAll = flags.has('a') || flags.has('A');
      const long = flags.has('l');
      const tz = this.content.system.timezone;

      const render = (entries) => {
        if (long) {
          const sizeW = Math.max(...entries.map((e) => String(e.size).length), 1);
          for (const e of entries) {
            const perms = e.type === 'dir' ? 'drwxr-xr-x' : e.binary ? '-rwxr-xr-x' : '-rw-r--r--';
            this.print(`${perms} 1 ${pad(e.owner, 5)} ${pad(e.owner, 5)} ${String(e.size).padStart(sizeW)} ${lsDate(e.mtime, tz)} `, c(entryClass(e), e.label || e.name));
          }
        } else if (entries.length) {
          this.print(h('div', { class: 'term-grid' }, entries.map((e) => c(entryClass(e), e.label || e.name))));
        }
      };

      targets.forEach((target, i) => {
        const info = this.vfs.stat(target, this.cwd);
        if (!info) return this.error(`ls: cannot access '${target}': No such file or directory`);
        if (info.type !== 'dir') return render([{ ...info, label: target }]);
        let entries;
        try {
          entries = this.vfs.list(info.path);
        } catch (err) {
          return this.error(`ls: cannot open directory '${target}': ${err.message}`);
        }
        if (!showAll) entries = entries.filter((e) => !e.name.startsWith('.'));
        if (flags.has('a')) {
          const self = this.vfs.stat(info.path);
          entries = [{ ...self, label: '.' }, { ...this.vfs.stat(this.vfs.parentOf(info.path)), label: '..' }, ...entries];
        }
        if (targets.length > 1) {
          if (i) this.print();
          this.print(`${target}:`);
        }
        render(entries);
      });
    },
  },

  cd: {
    usage: 'cd [dir]',
    summary: 'change directory',
    run(args) {
      let target = args[0] ?? '~';
      if (args.length > 1) return this.error('bash: cd: too many arguments');
      if (target === '-') {
        if (!this.prevCwd) return this.error('bash: cd: OLDPWD not set');
        target = this.prevCwd;
        this.print(this.vfs.display(target));
      }
      const info = this.vfs.stat(target, this.cwd);
      if (!info) return this.error(`bash: cd: ${args[0]}: No such file or directory`);
      if (info.type !== 'dir') return this.error(`bash: cd: ${args[0]}: Not a directory`);
      if (info.private) return this.error(`bash: cd: ${args[0]}: Permission denied`);
      this.prevCwd = this.cwd;
      this.cwd = info.path;
    },
  },

  pwd: { summary: 'print working directory', run() { this.print(this.cwd); } },

  cat: {
    usage: 'cat <file>…',
    summary: 'print files',
    run(args) {
      if (!args.length) return this.error('cat: missing file operand (try: cat ~/about.txt)');
      for (const arg of args) {
        const info = this.vfs.stat(arg, this.cwd);
        if (!info) { this.error(`cat: ${arg}: No such file or directory`); continue; }
        if (info.type === 'dir') { this.error(`cat: ${arg}: Is a directory`); continue; }
        if (info.binary) { this.print(c('t-dim', `cat: ${arg}: binary file — not printing it to your terminal`)); continue; }
        const text = this.vfs.read(info.path);
        this.printText(text.endsWith('\n') ? text.slice(0, -1) : text);
      }
    },
  },

  echo: {
    usage: 'echo [text]',
    summary: 'print text',
    run(args) {
      const noNewline = args[0] === '-n';
      this.print((noNewline ? args.slice(1) : args).join(' '));
    },
  },

  clear: { summary: 'clear the screen', run() { this.output.replaceChildren(); } },

  history: {
    summary: 'command history',
    run() {
      const w = String(history.length).length + 2;
      history.forEach((line, i) => this.print(c('t-dim', String(i + 1).padStart(w)), '  ', line));
    },
  },

  whoami: { summary: 'print user name', run() { this.print(this.vfs.user); } },

  uname: {
    usage: 'uname [-a]',
    summary: 'system information',
    run(args) {
      const { flags, bad } = parseFlags(args, ['a', 's', 'n', 'r', 'v', 'm', 'o', 'p', 'i']);
      if (bad) return this.error(`uname: invalid option -- '${bad}'`);
      const info = {
        s: 'Linux', n: this.vfs.hostname, r: KERNEL, v: '#1 SMP PREEMPT_DYNAMIC',
        m: ARCH, p: ARCH, i: ARCH, o: 'GNU/Linux',
      };
      const order = flags.has('a') ? ['s', 'n', 'r', 'v', 'm', 'o'] : ['s', 'n', 'r', 'v', 'm', 'p', 'i', 'o'].filter((f) => flags.has(f));
      this.print((order.length ? order : ['s']).map((f) => info[f]).join(' '));
    },
  },

  date: { summary: 'print date and time', run() { this.print(dateString(this.content.system.timezone)); } },

  neofetch: {
    summary: 'system summary',
    run() {
      const { person } = this.content;
      const prefs = getPrefs();
      const mins = Math.floor(performance.now() / 60000);
      const uptime = mins < 1 ? `${Math.floor(performance.now() / 1000)} secs` : `${mins} min${mins === 1 ? '' : 's'}`;
      const title = `${this.vfs.user}@${this.vfs.hostname}`;
      const rows = [
        [null, c('t-accent t-bold', this.vfs.user), '@', c('t-accent t-bold', this.vfs.hostname)],
        [null, '-'.repeat(title.length)],
        ['OS', `Gentoo Linux ${ARCH}`],
        ['Host', 'Web Browser Virtual Machine'],
        ['Kernel', KERNEL],
        ['Uptime', uptime],
        ['Packages', '1042 (emerge)'],
        ['Shell', SHELL],
        ['Resolution', `${window.screen.width}x${window.screen.height}`],
        ['DE', DESKTOP],
        ['Theme', `${prefs.theme === 'light' ? 'Light' : 'Dark'} · accent ${prefs.accent}`],
        ['Terminal', 'terminal'],
        ['CPU', `${navigator.hardwareConcurrency || 1} logical cores`],
        [null, ''],
        ['Name', person.name],
        ['Role', person.role],
        ['Location', person.location],
        ['Status', person.status],
      ];
      const info = h('div', { class: 'neo-info' },
        rows.map(([key, ...value]) => h('div', null, key ? [c('t-accent t-bold', key), ': '] : null, ...value)),
        h('div', { class: 'neo-colors', 'aria-hidden': 'true' },
          ['#2e2b38', '#e05561', '#5fb85c', '#d9a43b', '#5b8de8', '#a57de0', '#4fb6c4', '#d6d3df'].map((bg) => h('span', { style: `background:${bg}` }))),
      );
      this.print(h('div', { class: 'neofetch' }, h('pre', { class: 'neo-art t-accent', 'aria-hidden': 'true' }, ART.join('\n')), info));
    },
  },

  exit: { summary: 'close the terminal', run() { this.print('logout'); setTimeout(() => this.win.close(), 150); } },

  // --- easter eggs ---------------------------------------------------------------------
  sudo: {
    summary: 'run as root',
    run() {
      this.print(`[sudo] password for ${this.vfs.user}: `);
      this.print(`${this.vfs.user} is not in the sudoers file.  This incident will be reported.`);
    },
  },

  cowsay: {
    summary: 'Larry the Cow says something',
    run(args) {
      const text = args.join(' ') || this.content.person.quote;
      const lines = wrap(text, 38);
      const width = Math.max(...lines.map((l) => l.length));
      const out = [' ' + '_'.repeat(width + 2)];
      lines.forEach((l, i) => {
        const [open, close] = lines.length === 1 ? ['<', '>'] : i === 0 ? ['/', '\\'] : i === lines.length - 1 ? ['\\', '/'] : ['|', '|'];
        out.push(`${open} ${l.padEnd(width)} ${close}`);
      });
      out.push(' ' + '-'.repeat(width + 2), ...COW);
      this.print(h('pre', { class: 'term-pre' }, out.join('\n')));
    },
  },

  emerge: {
    summary: 'Portage package manager',
    async run(args) {
      const { flags, operands } = parseFlags(args.filter((a) => !a.startsWith('--')), ['a', 'v', 'u', 'D', 'N', 'p', 'q']);
      const long = new Set(args.filter((a) => a.startsWith('--')));
      const ask = flags.has('a') || long.has('--ask');
      const pretend = flags.has('p') || long.has('--pretend');

      if (long.has('--help') || long.has('-h')) {
        this.printText('emerge [options] [action] [ebuild | tbz2file | file | @set | atom] [...]\n   --ask (-a)   ask before merging\n   --pretend (-p)\n   --sync       update the Gentoo repository\n   --update (-u) --deep (-D) --newuse (-N) @world');
        return;
      }
      if (long.has('--sync')) {
        const steps = [
          `>>> Syncing repository 'gentoo' into '/var/db/repos/gentoo'...`,
          '/usr/bin/git fetch origin --depth 1',
          'remote: Enumerating objects: 4182, done.',
          'Receiving objects: 100% (4182/4182), 1.86 MiB | 9.41 MiB/s, done.',
          '=== Sync completed for gentoo',
          '',
          ' * IMPORTANT: 3 news items need reading for repository \'gentoo\'.',
          ' * Use eselect news read to view new items.',
        ];
        for (const s of steps) { this.print(s.startsWith(' *') ? c('t-yellow', s) : s); await this.sleep(260); }
        return;
      }
      if (!operands.length) {
        this.print('emerge: please tell me what to do.');
        this.print(c('t-dim', 'try: emerge --ask app-misc/neofetch · emerge --sync · emerge -avuDN @world'));
        return;
      }

      this.print('');
      this.print('These are the packages that would be merged, in order:');
      this.print('');
      const calc = this.print('Calculating dependencies... ');
      await this.sleep(900);
      calc.append('done!');

      if (operands.includes('@world')) {
        this.print('Dependency resolution took 4.20 s (backtrack: 0/20).');
        this.print('');
        this.print(c('t-green', 'Nothing to merge; quitting.'), c('t-dim', ' (Already compiled to perfection.)'));
        return;
      }

      const atoms = operands.map(qualify);
      const merges = [...atoms, { cat: 'dev-libs', name: 'caffeine', version: '9.9.9' }];
      for (const a of merges) {
        this.print('[', c('t-green', 'ebuild'), c('t-green t-bold', '  N    '), '] ', c('t-green', `${a.cat}/${a.name}-${a.version}`), '::gentoo  ', c('t-dim', `USE="-systemd" ${(a.name.length * 337) % 9000 + 120} KiB`));
      }
      this.print('');
      this.print(`Total: ${merges.length} packages (${merges.length} new), Size of downloads: ${merges.length * 1823} KiB`);
      if (pretend) return;
      this.print('');

      if (ask) {
        const answer = await this.ask('Would you like to merge these packages? [Yes/No]');
        if (answer === null || !/^y(es)?$/i.test(answer.trim() || 'yes')) {
          this.print('');
          this.print('Quitting.');
          return;
        }
      }

      for (const [i, a] of merges.entries()) {
        const id = `${a.cat}/${a.name}-${a.version}`;
        this.print('>>> Emerging (', c('t-yellow', `${i + 1} of ${merges.length}`), ') ', c('t-green', id), '::gentoo');
        await this.sleep(320);
        this.print(c('t-green', ' * '), `${a.name}-${a.version}.tar.xz BLAKE2B SHA512 size ;-) ...`, c('t-blue t-bold', ' [ '), c('t-green', 'ok'), c('t-blue t-bold', ' ]'));
        await this.sleep(320);
        this.print('>>> Compiling source in ', `/var/tmp/portage/${id}/work/${a.name}-${a.version} ...`);
        await this.sleep(420);
        this.print('>>> Completed (', c('t-yellow', `${i + 1} of ${merges.length}`), ') ', c('t-green', id), '::gentoo');
      }
      this.print('');
      this.print(c('t-green', ' * '), 'Messages for package ', c('t-green', `dev-libs/caffeine-9.9.9`), ':');
      this.print(c('t-green', ' * '), 'Developer is now fully operational. Compile times may vary.');
    },
  },
};

const KNOWN_CATEGORIES = {
  neofetch: 'app-misc', firefox: 'www-client', vim: 'app-editors', neovim: 'app-editors', emacs: 'app-editors',
  docker: 'app-containers', caddy: 'www-servers', go: 'dev-lang', python: 'dev-lang', nodejs: 'net-libs',
  ansible: 'app-admin', 'gentoo-sources': 'sys-kernel', gcc: 'sys-devel', postgresql: 'dev-db', htop: 'sys-process',
};

function qualify(atom) {
  const clean = atom.replace(/^[<>=~]+/, '').replace(/::.*$/, '');
  const [cat, name] = clean.includes('/') ? clean.split('/', 2) : [KNOWN_CATEGORIES[clean] || 'app-misc', clean];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { cat, name, version: `${1 + (hash % 9)}.${(hash >>> 4) % 20}.${(hash >>> 9) % 10}` };
}

function wrap(text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > width) { lines.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
