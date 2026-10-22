import test from 'node:test';
import assert from 'node:assert/strict';
import { slideRow, moveGrid, addTile, canMove, emptyGrid, advance, placeRocks } from './ui/rules.js';

/** A deterministic "random" so a test can predict a shuffle. */
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

test('a row slides left and merges equal neighbours once each', () => {
  assert.deepEqual(slideRow([2, 0, 2, 0]), { row: [4, 0, 0, 0], gained: 4 });
  assert.deepEqual(slideRow([2, 2, 2, 2]), { row: [4, 4, 0, 0], gained: 8 });
  assert.deepEqual(slideRow([2, 2, 4, 0]), { row: [4, 4, 0, 0], gained: 4 });
  assert.deepEqual(slideRow([4, 2, 2, 0]), { row: [4, 4, 0, 0], gained: 4 });
  assert.deepEqual(slideRow([2, 4, 8, 16]), { row: [2, 4, 8, 16], gained: 0 });
});

test('moving the grid works in all four directions', () => {
  const g = [[2, 0, 0, 2], [0, 0, 0, 0], [0, 4, 0, 0], [0, 0, 0, 0]];
  assert.deepEqual(moveGrid(g, 'left').grid[0], [4, 0, 0, 0]);
  assert.deepEqual(moveGrid(g, 'right').grid[0], [0, 0, 0, 4]);
  assert.deepEqual(moveGrid(g, 'up').grid.map((r) => r[1]), [4, 0, 0, 0]);
  assert.deepEqual(moveGrid(g, 'down').grid.map((r) => r[1]), [0, 0, 0, 4]);
  assert.equal(moveGrid(g, 'left').gained, 4);
});

test('a move that changes nothing says so, and does not mutate the input', () => {
  const g = [[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const copy = JSON.stringify(g);
  assert.equal(moveGrid(g, 'left').moved, false);
  assert.equal(moveGrid(g, 'up').moved, false, 'tiles are already against the top');
  assert.equal(moveGrid(g, 'down').moved, true);
  assert.equal(JSON.stringify(g), copy);
});

test('a new tile is a 2 or a 4 in an empty cell, and a full grid is left alone', () => {
  const rand = (() => { const v = [0.5, 0.5]; let i = 0; return () => v[i++ % 2]; })();
  const g = addTile(emptyGrid(), rand);
  assert.equal(g.flat().filter(Boolean).length, 1);
  assert.ok([2, 4].includes(g.flat().find(Boolean)));
  const full = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  assert.equal(addTile(full), full);
});

test('game over is when no move changes the grid', () => {
  assert.equal(canMove([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]), false);
  assert.equal(canMove([[2, 2, 4, 8], [4, 8, 16, 32], [8, 16, 32, 64], [16, 32, 64, 128]]), true);
  assert.equal(canMove(emptyGrid()), false, 'an empty grid has nothing to slide');
});

test('a snake stops at a solid wall but wraps through an open one', () => {
  assert.deepEqual(advance({ x: 4, y: 2 }, { x: 1, y: 0 }, 5, false), { x: 5, y: 2, hit: true });
  assert.deepEqual(advance({ x: 0, y: 2 }, { x: -1, y: 0 }, 5, false), { x: -1, y: 2, hit: true });
  assert.deepEqual(advance({ x: 4, y: 2 }, { x: 1, y: 0 }, 5, true), { x: 0, y: 2, hit: false });
  assert.deepEqual(advance({ x: 3, y: 0 }, { x: 0, y: -1 }, 5, true), { x: 3, y: 4, hit: false });
  assert.deepEqual(advance({ x: 2, y: 2 }, { x: 0, y: 1 }, 5, false), { x: 2, y: 3, hit: false });
});

test('2048 plays on other grid sizes', () => {
  for (const n of [3, 4, 5]) {
    const g = addTile(addTile(emptyGrid(n)));
    assert.equal(g.length, n);
    assert.equal(g.flat().filter(Boolean).length, 2);
  }
  assert.equal(canMove([[2, 4, 2], [4, 2, 4], [2, 4, 2]]), false);
});

test('rocks never land on the cells that must stay clear, or on each other', () => {
  const avoid = [{ x: 1, y: 1 }, { x: 2, y: 1 }];
  const rocks = placeRocks(6, 10, avoid, seeded(5));
  assert.equal(rocks.length, 10);
  assert.equal(new Set(rocks.map((r) => `${r.x},${r.y}`)).size, 10, 'unique');
  assert.ok(rocks.every((r) => r.x >= 0 && r.y >= 0 && r.x < 6 && r.y < 6), 'on the board');
  assert.ok(rocks.every((r) => !avoid.some((a) => a.x === r.x && a.y === r.y)));
});

test('asking for more rocks than there is room for just fills the board', () => {
  const avoid = [{ x: 0, y: 0 }];
  assert.equal(placeRocks(3, 50, avoid, seeded(2)).length, 8);
  assert.deepEqual(placeRocks(3, 0, avoid, seeded(2)), []);
});
