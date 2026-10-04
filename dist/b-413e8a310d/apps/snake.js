// Snake: arrow keys / WASD or the on-screen pad. Enter or Space starts and
// pauses. The game pauses itself when its window loses focus.
import { h } from '../os/util.js';
import { uiIcon } from '../os/icons.js';

const CELLS = 18;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};
let best = 0; // best score this session

export function mount(win) {
  const canvas = h('canvas', { class: 'snake-canvas', role: 'img', 'aria-label': 'Snake board' });
  const scoreEl = h('span', null, '0');
  const bestEl = h('span', null, String(best));
  const status = h('p', { class: 'snake-status', role: 'status', 'aria-live': 'polite' });
  const playBtn = h('button', { class: 'btn btn-primary snake-play', type: 'button', onClick: () => toggle() });
  const stage = h('div', { class: 'snake-stage' }, canvas);
  const padBtn = (dir, label, icon) =>
    h('button', { class: `tool-btn snake-pad-${dir}`, type: 'button', 'aria-label': label, html: uiIcon(icon), onClick: () => { steer(dir); root.focus(); } });
  const root = h('div', { class: 'snake', tabindex: '0', 'aria-label': 'Snake game. Arrow keys steer, Enter starts or pauses.' },
    h('div', { class: 'snake-hud' },
      h('span', null, 'Score ', h('strong', null, scoreEl)),
      h('span', null, 'Best ', h('strong', null, bestEl)),
      playBtn),
    stage,
    status,
    h('div', { class: 'snake-pad' },
      padBtn('up', 'Up', 'up'), padBtn('left', 'Left', 'back'), padBtn('down', 'Down', 'up'), padBtn('right', 'Right', 'forward')),
  );
  win.body.append(root);
  win.onFocus(() => root.focus({ preventScroll: true }));

  const ctx = canvas.getContext('2d');
  let state = 'ready'; // ready | running | paused | over
  let snake;
  let dir;
  let queue;
  let food;
  let score;
  let timer = null;
  let cell = 20;

  function reset() {
    const mid = Math.floor(CELLS / 2);
    snake = [[mid, mid], [mid - 1, mid], [mid - 2, mid]];
    dir = 'right';
    queue = [];
    score = 0;
    scoreEl.textContent = '0';
    placeFood();
  }

  function placeFood() {
    const free = [];
    for (let x = 0; x < CELLS; x++) for (let y = 0; y < CELLS; y++) {
      if (!snake.some(([sx, sy]) => sx === x && sy === y)) free.push([x, y]);
    }
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function speed() {
    return Math.max(70, 150 - score * 4);
  }

  function setState(next) {
    state = next;
    clearTimeout(timer);
    if (state === 'running') timer = setTimeout(tick, speed());
    playBtn.textContent = state === 'running' ? 'Pause' : state === 'paused' ? 'Resume' : state === 'over' ? 'Play again' : 'Start';
    status.textContent = {
      ready: 'Press Enter or Start to play.',
      running: '',
      paused: 'Paused — press Enter to resume.',
      over: `Game over — score ${score}. Press Enter to play again.`,
    }[state];
    draw();
  }

  function toggle() {
    if (state === 'running') setState('paused');
    else if (state === 'paused') setState('running');
    else {
      reset();
      setState('running');
    }
  }

  function steer(next) {
    if (state === 'ready' || state === 'over') toggle();
    if (state !== 'running') return;
    const last = queue.length ? queue[queue.length - 1] : dir;
    const [lx, ly] = DIRS[last];
    const [nx, ny] = DIRS[next];
    if (next === last || (lx + nx === 0 && ly + ny === 0)) return; // no reversing into yourself
    if (queue.length < 2) queue.push(next);
  }

  function tick() {
    if (queue.length) dir = queue.shift();
    const [dx, dy] = DIRS[dir];
    const head = [snake[0][0] + dx, snake[0][1] + dy];
    const eating = food && head[0] === food[0] && head[1] === food[1];
    const body = eating ? snake : snake.slice(0, -1);
    const hitWall = head[0] < 0 || head[1] < 0 || head[0] >= CELLS || head[1] >= CELLS;
    if (hitWall || body.some(([x, y]) => x === head[0] && y === head[1])) {
      best = Math.max(best, score);
      bestEl.textContent = String(best);
      setState('over');
      return;
    }
    snake = [head, ...body];
    if (eating) {
      score += 1;
      scoreEl.textContent = String(score);
      placeFood();
      if (!food) { setState('over'); return; } // board full: you win
    }
    draw();
    timer = setTimeout(tick, speed());
  }

  // --- drawing --------------------------------------------------------------------
  function resize() {
    const box = stage.getBoundingClientRect();
    const size = Math.max(CELLS * 8, Math.floor(Math.min(box.width, box.height) / CELLS) * CELLS);
    cell = size / CELLS;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = canvas.style.height = `${size}px`;
    canvas.width = canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    if (!snake) return;
    const css = getComputedStyle(root);
    const size = cell * CELLS;
    ctx.fillStyle = css.getPropertyValue('--snake-bg');
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = css.getPropertyValue('--snake-grid');
    for (let x = 0; x < CELLS; x++) for (let y = 0; y < CELLS; y++) {
      if ((x + y) % 2) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    if (food) {
      ctx.fillStyle = '#e5534b';
      ctx.beginPath();
      ctx.arc((food[0] + 0.5) * cell, (food[1] + 0.5) * cell, cell * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
    const accent = css.getPropertyValue('--accent-ink').trim();
    snake.forEach(([x, y], i) => {
      ctx.fillStyle = accent;
      ctx.globalAlpha = i === 0 ? 1 : Math.max(0.45, 0.9 - i * 0.02);
      const pad = cell * 0.08;
      roundRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.25);
    });
    ctx.globalAlpha = 1;
    if (state !== 'running') {
      ctx.fillStyle = 'rgba(0, 0, 0, .45)';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.max(14, cell * 0.9)}px system-ui, sans-serif`;
      const title = { ready: 'Snake', paused: 'Paused', over: 'Game over' }[state];
      ctx.fillText(title, size / 2, size / 2 - cell * 0.3);
      ctx.font = `${Math.max(11, cell * 0.6)}px system-ui, sans-serif`;
      ctx.fillText(state === 'over' ? `Score ${score} · Enter to retry` : 'Enter or Space to play', size / 2, size / 2 + cell);
    }
  }

  function roundRect(x, y, w, hgt, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, hgt, r) : ctx.rect(x, y, w, hgt);
    ctx.fill();
  }

  // --- input ------------------------------------------------------------------------
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return; // let buttons work
    if (KEYMAP[e.key]) {
      e.preventDefault();
      steer(KEYMAP[e.key]);
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      toggle();
    }
  });

  // Pause when the window stops being the active one (minimised, other app focused).
  const offWm = win.wm.events.on(() => {
    if (state === 'running' && (win.wm.active !== win || win.minimized)) setState('paused');
  });
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  win.onClose(() => { clearTimeout(timer); observer.disconnect(); offWm(); });

  reset();
  setState('ready');
}
