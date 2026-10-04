// Minesweeper. Mouse: click reveals, right-click flags, clicking a number
// with enough flags around it reveals its neighbours. Keyboard: arrows move,
// Enter/Space reveal, F flags. Touch: long-press or "Flag mode" flags.
import { h } from '../os/util.js';
import { uiIcon } from '../os/icons.js';

const LEVELS = {
  beginner: { label: 'Beginner', cols: 9, rows: 9, mines: 10 },
  intermediate: { label: 'Intermediate', cols: 16, rows: 16, mines: 40 },
};
const MINE = '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M8 1v14M1 8h14M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="8" r="4.6" fill="currentColor"/><circle cx="6.6" cy="6.6" r="1.3" fill="#fff"/></svg>';

export function mount(win) {
  let level = 'beginner';
  let cfg;
  let cells = [];
  let state = 'ready'; // ready | playing | won | lost
  let flagMode = false;
  let focusIndex = 0;
  let startedAt = 0;
  let timerId = null;

  const minesLeft = h('output', { class: 'mines-counter', 'aria-label': 'Mines left' });
  const clock = h('output', { class: 'mines-counter', 'aria-label': 'Seconds elapsed' });
  const status = h('p', { class: 'mines-status', role: 'status', 'aria-live': 'polite' });
  const newBtn = h('button', { class: 'btn', type: 'button', onClick: () => newGame() }, 'New game');
  const flagBtn = h('button', { class: 'tool-btn mines-flagmode', type: 'button', 'aria-pressed': 'false', title: 'Flag mode: clicks place flags', html: uiIcon('flag'), onClick: () => {
    flagMode = !flagMode;
    flagBtn.setAttribute('aria-pressed', String(flagMode));
  } }, h('span', null, 'Flag mode'));
  const levelButtons = Object.entries(LEVELS).map(([key, l]) =>
    h('button', { class: 'tool-btn', type: 'button', 'aria-pressed': String(key === level), onClick: () => { level = key; newGame(); } }, l.label));
  const board = h('div', { class: 'mines-board', role: 'grid', 'aria-label': 'Minefield' });

  win.body.append(h('div', { class: 'mines' },
    h('div', { class: 'app-toolbar mines-toolbar' }, h('div', { class: 'mines-levels', role: 'group', 'aria-label': 'Difficulty' }, levelButtons), flagBtn),
    h('div', { class: 'mines-hud' }, minesLeft, newBtn, clock),
    h('div', { class: 'mines-stage' }, board),
    status,
  ));
  win.onFocus(() => cellButton(focusIndex)?.focus({ preventScroll: true }));

  const cellButton = (i) => board.querySelector(`[data-i="${i}"]`);

  function neighbours(i) {
    const { cols, rows } = cfg;
    const x = i % cols;
    const y = Math.floor(i / cols);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push(ny * cols + nx);
    }
    return out;
  }

  function newGame() {
    cfg = LEVELS[level];
    cells = Array.from({ length: cfg.cols * cfg.rows }, () => ({ mine: false, open: false, flag: false, n: 0, boom: false }));
    state = 'ready';
    focusIndex = Math.min(focusIndex, cells.length - 1);
    stopTimer();
    clock.textContent = '000';
    levelButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(Object.keys(LEVELS)[i] === level)));
    buildBoard();
    update();
    say(`${cfg.label}: ${cfg.cols} × ${cfg.rows}, ${cfg.mines} mines. The first click is always safe.`);
  }

  function plant(safe) {
    const banned = new Set([safe, ...neighbours(safe)]);
    const spots = cells.map((_, i) => i).filter((i) => !banned.has(i));
    for (let k = 0; k < cfg.mines; k++) {
      const pick = Math.floor(Math.random() * spots.length);
      cells[spots[pick]].mine = true;
      spots.splice(pick, 1);
    }
    cells.forEach((c, i) => { c.n = neighbours(i).filter((j) => cells[j].mine).length; });
  }

  function reveal(i) {
    if (state === 'won' || state === 'lost') return;
    const c = cells[i];
    if (c.flag) return;
    if (c.open) return chord(i);
    if (state === 'ready') {
      plant(i);
      state = 'playing';
      startTimer();
    }
    if (c.mine) {
      c.open = true;
      c.boom = true;
      return lose();
    }
    const stack = [i];
    while (stack.length) {
      const j = stack.pop();
      const cell = cells[j];
      if (cell.open || cell.flag) continue;
      cell.open = true;
      if (cell.n === 0) stack.push(...neighbours(j).filter((k) => !cells[k].open && !cells[k].mine));
    }
    if (cells.every((cell) => cell.mine || cell.open)) win_();
    update();
  }

  function chord(i) {
    const c = cells[i];
    if (!c.open || !c.n) return;
    const around = neighbours(i);
    if (around.filter((j) => cells[j].flag).length !== c.n) return;
    around.forEach((j) => { if (!cells[j].open && !cells[j].flag && state === 'playing') reveal(j); });
  }

  function toggleFlag(i) {
    const c = cells[i];
    if (c.open || state === 'won' || state === 'lost') return;
    c.flag = !c.flag;
    update();
  }

  function lose() {
    state = 'lost';
    stopTimer();
    update();
    say('Boom! You hit a mine. Press “New game” to try again.');
  }

  function win_() {
    state = 'won';
    stopTimer();
    cells.forEach((c) => { if (c.mine) c.flag = true; });
    say(`You cleared the field in ${elapsed()} seconds!`);
  }

  // --- timer ------------------------------------------------------------------------
  const elapsed = () => Math.min(999, Math.floor((Date.now() - startedAt) / 1000));
  function startTimer() {
    startedAt = Date.now();
    timerId = setInterval(() => { clock.textContent = String(elapsed()).padStart(3, '0'); }, 250);
  }
  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  // --- rendering ----------------------------------------------------------------------
  function buildBoard() {
    board.style.setProperty('--cols', cfg.cols);
    board.style.setProperty('--rows', cfg.rows);
    board.setAttribute('aria-rowcount', cfg.rows);
    board.setAttribute('aria-colcount', cfg.cols);
    const rows = [];
    for (let y = 0; y < cfg.rows; y++) {
      rows.push(h('div', { class: 'mines-row', role: 'row' },
        Array.from({ length: cfg.cols }, (_, x) => {
          const i = y * cfg.cols + x;
          return h('span', { role: 'gridcell' }, h('button', { class: 'mines-cell', type: 'button', tabindex: i === focusIndex ? '0' : '-1', dataset: { i } }));
        })));
    }
    board.replaceChildren(...rows);
  }

  function update() {
    const flags = cells.filter((c) => c.flag).length;
    minesLeft.textContent = String(cfg.mines - flags).padStart(3, '0');
    newBtn.textContent = state === 'won' ? 'You win! · New game' : state === 'lost' ? 'Boom · New game' : 'New game';
    cells.forEach((c, i) => {
      const btn = cellButton(i);
      const x = (i % cfg.cols) + 1;
      const y = Math.floor(i / cfg.cols) + 1;
      const showMine = c.mine && (c.open || state === 'lost') && !c.flag;
      const wrongFlag = state === 'lost' && c.flag && !c.mine;
      btn.className = 'mines-cell' + (c.open || showMine ? ' is-open' : '') + (c.boom ? ' is-boom' : '') +
        (c.open && c.n && !c.mine ? ` n${c.n}` : '') + (wrongFlag ? ' is-wrong' : '');
      let label;
      if (showMine) { btn.innerHTML = MINE; label = c.boom ? 'exploded mine' : 'mine'; }
      else if (c.flag) { btn.innerHTML = uiIcon(wrongFlag ? 'close' : 'flag'); label = wrongFlag ? 'wrong flag' : 'flagged'; }
      else if (c.open) { btn.textContent = c.n ? String(c.n) : ''; label = c.n ? `${c.n} mine${c.n > 1 ? 's' : ''} nearby` : 'empty'; }
      else { btn.textContent = ''; label = 'hidden'; }
      btn.setAttribute('aria-label', `Row ${y}, column ${x}: ${label}`);
    });
  }

  function say(text) {
    status.textContent = text;
  }

  function moveFocus(i) {
    cellButton(focusIndex)?.setAttribute('tabindex', '-1');
    focusIndex = i;
    const btn = cellButton(i);
    btn.setAttribute('tabindex', '0');
    btn.focus();
  }

  // --- input ---------------------------------------------------------------------------
  let longPress = null;
  let suppressClick = false;

  board.addEventListener('click', (e) => {
    const btn = e.target.closest('.mines-cell');
    if (!btn) return;
    const i = Number(btn.dataset.i);
    if (suppressClick) { suppressClick = false; return; }
    moveFocus(i);
    if (flagMode && !cells[i].open) toggleFlag(i);
    else reveal(i);
  });
  board.addEventListener('contextmenu', (e) => {
    const btn = e.target.closest('.mines-cell');
    if (!btn) return;
    e.preventDefault();
    if (e.pointerType === 'touch' || suppressClick) return; // handled by long-press
    toggleFlag(Number(btn.dataset.i));
  });
  board.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.mines-cell');
    if (!btn || e.pointerType !== 'touch') return;
    longPress = setTimeout(() => {
      suppressClick = true;
      toggleFlag(Number(btn.dataset.i));
    }, 450);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => board.addEventListener(type, () => clearTimeout(longPress)));

  board.addEventListener('keydown', (e) => {
    const btn = e.target.closest('.mines-cell');
    if (!btn) return;
    const i = Number(btn.dataset.i);
    const { cols } = cfg;
    const x = i % cols;
    const moves = {
      ArrowLeft: x > 0 ? i - 1 : i, ArrowRight: x < cols - 1 ? i + 1 : i,
      ArrowUp: i - cols >= 0 ? i - cols : i, ArrowDown: i + cols < cells.length ? i + cols : i,
      Home: i - x, End: i - x + cols - 1,
    };
    if (e.key in moves) { e.preventDefault(); moveFocus(moves[e.key]); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFlag(i); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (flagMode && !cells[i].open) toggleFlag(i); else reveal(i); }
  });

  // Space activates buttons on keyup; it is already handled on keydown.
  board.addEventListener('keyup', (e) => { if (e.key === ' ') e.preventDefault(); });

  win.onClose(stopTimer);
  newGame();
}
