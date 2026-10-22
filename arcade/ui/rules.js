// The rules of the retro games, with no DOM, so they can be tested directly.

// ---- 2048 ----

/** Slide one row to the left, merging equal neighbours once each. */
export function slideRow(row) {
  const tiles = row.filter(Boolean);
  const out = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i++;
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < row.length) out.push(0);
  return { row: out, gained };
}

const transpose = (g) => g[0].map((_, c) => g.map((r) => r[c]));
const reverseRows = (g) => g.map((r) => r.slice().reverse());

/** Move the whole grid. dir is 'left' | 'right' | 'up' | 'down'. */
export function moveGrid(grid, dir) {
  let g = grid.map((r) => r.slice());
  if (dir === 'right') g = reverseRows(g);
  if (dir === 'up') g = transpose(g);
  if (dir === 'down') g = reverseRows(transpose(g));
  let gained = 0;
  g = g.map((row) => {
    const r = slideRow(row);
    gained += r.gained;
    return r.row;
  });
  if (dir === 'right') g = reverseRows(g);
  if (dir === 'up') g = transpose(g);
  if (dir === 'down') g = transpose(reverseRows(g));
  const moved = g.some((row, y) => row.some((v, x) => v !== grid[y][x]));
  return { grid: g, gained, moved };
}

/** Put a 2 (90%) or a 4 (10%) in a random empty cell. */
export function addTile(grid, rand = Math.random) {
  const empty = [];
  grid.forEach((row, y) => row.forEach((v, x) => !v && empty.push([x, y])));
  if (!empty.length) return grid;
  const [x, y] = empty[Math.floor(rand() * empty.length)];
  const g = grid.map((r) => r.slice());
  g[y][x] = rand() < 0.9 ? 2 : 4;
  return g;
}

export const emptyGrid = (n = 4) => Array.from({ length: n }, () => Array(n).fill(0));

export function canMove(grid) {
  return ['left', 'right', 'up', 'down'].some((d) => moveGrid(grid, d).moved);
}

// ---- snake ----

/** The cell a snake head moves into. With `wrap` the edges join up; otherwise leaving the board is a hit. */
export function advance(head, dir, n, wrap) {
  let x = head.x + dir.x;
  let y = head.y + dir.y;
  if (wrap) {
    x = (x + n) % n;
    y = (y + n) % n;
    return { x, y, hit: false };
  }
  return { x, y, hit: x < 0 || y < 0 || x >= n || y >= n };
}

/** `count` rock cells on an n by n board, never on a cell in `avoid`, never two on the same cell. */
export function placeRocks(n, count, avoid, rand = Math.random) {
  const blocked = new Set(avoid.map((c) => `${c.x},${c.y}`));
  const free = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!blocked.has(`${x},${y}`)) free.push({ x, y });
  return shuffle(free, rand).slice(0, Math.max(0, count));
}


function shuffle(list, rand = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

