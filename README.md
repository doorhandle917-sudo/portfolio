# site-v2 — Gentoo in the browser

Portfolio of Dušan Hlavatý, presented as a Gentoo Linux machine: a landing
screen, a GRUB → kernel → OpenRC → login boot sequence, and an Xfce-style
desktop with working apps (terminal, file manager, text editor, portfolio
viewer, settings, Snake, Minesweeper).

Vanilla ES modules and plain CSS — no runtime or build dependencies.

## Run and build

Requires Node 18+.

```sh
npm run dev       # serve src/ at http://localhost:5173
npm run build     # write the static site to dist/
npm run preview   # serve dist/ at http://localhost:5173 (PORT=4173 npm run preview to change)
```

Deploy by uploading the **contents of `dist/`** to any static host. The site
uses ES modules, so it must be served over HTTP(S); opening `index.html`
from disk (`file://`) will not work.

The build copies everything except `index.html` into a content-hashed folder
(`dist/b-<hash>/`) so a new deploy never mixes cached old modules with new
ones. It also lists any placeholders still left in the content.

## Editing content

All portfolio content lives in **`src/content.js`** — the terminal, file
manager, text files, portfolio viewer, boot screen and neofetch all read from
it. Edit it and reload; no UI code needs to change.

- Strings starting with `PLACEHOLDER` are shown on the site as clearly marked
  placeholders. Replace them with real data, or set the field to `null` to
  hide it.
- Inline links use Markdown syntax: `[label](https://example.com)`.
- `system` holds fake-OS settings (login name, hostname, clock time zone).

Visitors' edits made in the text editor and their settings are stored in
their own browser (localStorage) and never change `content.js`.

## Layout

```
src/
  index.html      landing screen; loads nothing else until Enter is pressed
  content.js      all portfolio content
  boot/           boot sequence
  os/             desktop shell, window manager, virtual filesystem, prefs
  apps/           terminal, files, editor, browser, settings, snake, minesweeper
  styles/         os.css (shell + themes), boot.css, apps.css
  assets/         avatar
scripts/          build.mjs, serve.mjs
```

## Keyboard

| Where | Keys |
| --- | --- |
| Landing / boot | Enter boots · Esc skips the boot sequence |
| Desktop | Alt+F1 opens the app menu · arrow keys move in it |
| Window title bar | arrows move the window · Shift+arrows resize · Enter maximises |
| Terminal | Tab completes · ↑/↓ history · Ctrl+L clear · Ctrl+C cancel |
| Files | arrows select · Enter opens · Backspace/Alt+← back · Ctrl+H hidden files |
| Editor | Ctrl+S save · Ctrl+Shift+S save as |
| Snake | arrows/WASD steer · Enter/Space start and pause |
| Minesweeper | arrows move · Enter/Space reveal · F flag |

Below 768 px wide the desktop switches to a launcher with one full-screen
app at a time. With `prefers-reduced-motion`, the boot animation and window
animations are skipped.
