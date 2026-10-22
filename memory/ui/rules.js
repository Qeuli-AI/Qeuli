// The rules of the memory games, with no DOM, so they can be tested directly.

// ---- memory match ----

export const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'plus', 'ring', 'bar'];

export function shuffle(list, rand = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Two of each of the first `pairs` shapes (eight by default, so sixteen cards), shuffled. */
export function makeDeck(rand = Math.random, pairs = SHAPES.length) {
  const n = Math.min(SHAPES.length, Math.max(2, pairs));
  return shuffle(SHAPES.slice(0, n).flatMap((shape) => [shape, shape]), rand).map((shape, id) => ({ id, shape }));
}

// ---- chimp test ----

/**
 * Where the numbers 1..count go on a board of `cells` squares: result[i] is the cell holding number i + 1.
 * No two numbers share a cell, and a board never holds more numbers than it has squares.
 */
export function layoutChimp(count, cells, rand = Math.random) {
  const n = Math.max(0, Math.min(count, cells));
  return shuffle(Array.from({ length: cells }, (_, i) => i), rand).slice(0, n);
}

export function newChimpRound(count, cells, rand = Math.random) {
  const at = layoutChimp(count, cells, rand);
  return { count: at.length, cells, at, next: 1 };
}

/**
 * Tap a square. 'ignore' is an empty square, 'wrong' is a number out of order, 'ok' is the right one,
 * and 'done' is the right one when it was the last. A right tap moves `round.next` on.
 */
export function tapChimp(round, cell) {
  const i = round.at.indexOf(cell);
  if (i === -1) return 'ignore';
  if (i + 1 !== round.next) return 'wrong';
  round.next += 1;
  return round.next > round.count ? 'done' : 'ok';
}

// ---- sequence memory ----

/**
 * Add one more square to the pattern. It never repeats the previous square, so every step of the
 * pattern is a visible change (a repeat would look like one long flash).
 */
export function extendSequence(seq, cells, rand = Math.random) {
  const last = seq[seq.length - 1];
  let next = Math.floor(rand() * cells);
  for (let tries = 0; cells > 1 && next === last && tries < 50; tries++) next = Math.floor(rand() * cells);
  if (cells > 1 && next === last) next = (last + 1) % cells; // a stuck random source still gives a legal pattern
  return [...seq, next];
}

/** Judge a tap while repeating the pattern: where you are now, and what that tap meant. */
export function tapSequence(seq, progress, cell) {
  if (seq[progress] !== cell) return { result: 'wrong', progress };
  const p = progress + 1;
  return { result: p === seq.length ? 'complete' : 'next', progress: p };
}
