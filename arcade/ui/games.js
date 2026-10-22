// The retro games. Each mounts into a host element and returns { stop() }.
// env = { h, opts, end(score), active() }: end reports a finished game; active() is false while the
// screen is hidden, which pauses the game so it never runs behind your back.
import { moveGrid, addTile, canMove, emptyGrid, advance, placeRocks } from './rules.js';

const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// ------------------------------------------------------------------ snake

// Speeds are the starting delay between steps and the fastest it can get, in milliseconds.
const SNAKE_SPEED = { chill: { start: 180, floor: 100 }, normal: { start: 140, floor: 65 }, fast: { start: 100, floor: 50 } };
const SNAKE_SKIN = { sun: { head: '#ffa463', body: '#ffd84d', food: '#ff9ec4' }, mint: { head: '#2fa89f', body: '#63c8c1', food: '#ffd84d' }, ink: { head: '#0b0b0b', body: '#7a7a72', food: '#ff9ec4' } };

export function mountSnake(host, { h, end, active, opts = {} }) {
  const N = Number(opts.size) || 20;
  const S = Math.floor(560 / N);
  const ROCKS = { none: 0, few: Math.round(N / 2), many: N }[opts.rocks] ?? 0;
  const speed = SNAKE_SPEED[opts.speed] || SNAKE_SPEED.normal;
  const skin = SNAKE_SKIN[opts.skin] || SNAKE_SKIN.sun;
  const wrap = opts.walls === 'wrap';
  const canvas = h('canvas', { class: 'ar-canvas', width: N * S, height: N * S, tabindex: 0, 'aria-label': 'Snake. Use the arrow keys or WASD.' });
  const info = h('div', { class: 'gk-info' });
  host.append(info, canvas);

  let snake;
  let dir;
  let next;
  let food;
  let score;
  let over;
  let started;
  let timer;
  let delay;

  let rocks = [];
  const isRock = (x, y) => rocks.some((r) => r.x === x && r.y === y);
  const place = () => {
    do food = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
    while (snake.some((s) => s.x === food.x && s.y === food.y) || isRock(food.x, food.y));
  };
  function reset() {
    clearTimeout(timer);
    const c = Math.floor(N / 2);
    snake = [{ x: c, y: c }, { x: c - 1, y: c }, { x: c - 2, y: c }];
    // Keep a clear lane behind and ahead of the snake so a game never ends on the first step.
    const lane = [];
    for (let y = c - 1; y <= c + 1; y++) for (let x = 0; x < N; x++) lane.push({ x, y });
    rocks = placeRocks(N, ROCKS, lane);
    dir = next = { x: 1, y: 0 };
    score = 0;
    over = false;
    started = false;
    delay = speed.start;
    place();
    draw();
  }

  function draw() {
    const g = canvas.getContext('2d');
    const ink = css('--ink', '#000');
    g.fillStyle = css('--surface', '#fff');
    g.fillRect(0, 0, N * S, N * S);
    g.strokeStyle = css('--line', '#ddd');
    g.lineWidth = 1;
    for (let i = 1; i < N; i++) {
      g.beginPath();
      g.moveTo(i * S + 0.5, 0);
      g.lineTo(i * S + 0.5, N * S);
      g.moveTo(0, i * S + 0.5);
      g.lineTo(N * S, i * S + 0.5);
      g.stroke();
    }
    g.lineWidth = 2;
    g.strokeStyle = ink;
    g.fillStyle = ink;
    for (const r of rocks) {
      g.beginPath();
      g.roundRect(r.x * S + 1, r.y * S + 1, S - 2, S - 2, 4);
      g.fill();
    }
    g.fillStyle = skin.food;
    g.beginPath();
    g.arc(food.x * S + S / 2, food.y * S + S / 2, S / 2 - 3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    snake.forEach((s, i) => {
      g.fillStyle = i === 0 ? skin.head : skin.body;
      g.beginPath();
      g.roundRect(s.x * S + 2, s.y * S + 2, S - 4, S - 4, 5);
      g.fill();
      g.stroke();
    });
    info.textContent = over ? `Game over. ${score} point${score === 1 ? '' : 's'}. Press Enter to play again.` : started ? `Score ${score}` : 'Press an arrow key to start';
  }

  function tick() {
    if (over) return;
    if (!active()) {
      timer = setTimeout(tick, 250); // paused while the screen is hidden
      return;
    }
    dir = next;
    const { hit: wall, ...head } = advance(snake[0], dir, N, wrap);
    const hit = wall || isRock(head.x, head.y) || snake.some((s) => s.x === head.x && s.y === head.y);
    if (hit) {
      over = true;
      draw();
      end(score);
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 1;
      delay = Math.max(speed.floor, delay - 3);
      place();
    } else {
      snake.pop();
    }
    draw();
    timer = setTimeout(tick, delay);
  }

  const KEYS = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
  function onKey(e) {
    if (!active() || e.target?.matches?.('input, textarea, select')) return;
    if (over && e.key === 'Enter') {
      reset();
      return;
    }
    const k = KEYS[e.key] || KEYS[e.key?.toLowerCase?.()];
    if (!k) return;
    e.preventDefault();
    const [x, y] = k;
    if (x === -dir.x && y === -dir.y) return; // no instant reversing into yourself
    next = { x, y };
    if (!started && !over) {
      started = true;
      timer = setTimeout(tick, delay);
    }
  }
  addEventListener('keydown', onKey);
  reset();
  return { stop: () => { clearTimeout(timer); removeEventListener('keydown', onKey); } };
}

// ------------------------------------------------------------------ 2048

export function mountG2048(host, { h, end, active, opts = {} }) {
  const SIZE = Math.min(6, Math.max(3, Number(opts.size) || 4));
  let grid;
  let score;
  let best = 0;
  let over;
  const board = h('div', { class: 'ar-2048', 'data-n': String(SIZE), 'data-pal': ['candy', 'mono', 'sunset'].includes(opts.palette) ? opts.palette : 'candy', style: `--n:${SIZE}`, tabindex: 0, 'aria-label': `2048 on a ${SIZE} by ${SIZE} grid. Use the arrow keys or WASD, or swipe.` });
  const info = h('div', { class: 'gk-info' });
  const again = h('button', { class: 'btn', type: 'button', onclick: () => reset() }, 'New game');
  host.append(info, board, h('div', { style: 'margin-top:12px' }, again));

  function reset() {
    grid = addTile(addTile(emptyGrid(SIZE)));
    score = 0;
    over = false;
    render();
  }
  function render() {
    board.replaceChildren(...grid.flat().map((v) => h('div', { class: 't', 'data-v': String(Math.min(v, 4096)) }, v ? String(v) : '')));
    best = Math.max(best, score);
    info.textContent = over ? `No moves left. ${score} points.` : `Score ${score}   Best this session ${best}`;
  }
  function go(dir) {
    if (over || !active()) return;
    const r = moveGrid(grid, dir);
    if (!r.moved) return;
    grid = addTile(r.grid);
    score += r.gained;
    if (!canMove(grid)) {
      over = true;
      end(score);
    }
    render();
  }
  const KEYS = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
  function onKey(e) {
    if (!active() || e.target?.matches?.('input, textarea, select')) return;
    const d = KEYS[e.key] || KEYS[e.key?.toLowerCase?.()];
    if (!d) return;
    e.preventDefault();
    go(d);
  }
  let sx = 0;
  let sy = 0;
  board.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  board.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  });
  addEventListener('keydown', onKey);
  reset();
  return { stop: () => removeEventListener('keydown', onKey) };
}
