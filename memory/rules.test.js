import test from 'node:test';
import assert from 'node:assert/strict';
import { shuffle, makeDeck, SHAPES } from './ui/rules.js';

test('shuffle keeps every item and is repeatable with the same randomness', () => {
  const mk = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const a = shuffle([1, 2, 3, 4, 5, 6], mk());
  assert.deepEqual(a.slice().sort(), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(a, shuffle([1, 2, 3, 4, 5, 6], mk()));
});

test('the deck is sixteen cards, two of each of eight shapes', () => {
  const deck = makeDeck();
  assert.equal(deck.length, 16);
  for (const shape of SHAPES) assert.equal(deck.filter((c) => c.shape === shape).length, 2);
  assert.equal(new Set(deck.map((c) => c.id)).size, 16);
});

test('a deck can have fewer pairs, and still has exactly two of each shape', () => {
  for (const pairs of [6, 8]) {
    const deck = makeDeck(Math.random, pairs);
    assert.equal(deck.length, pairs * 2);
    const counts = {};
    deck.forEach((c) => { counts[c.shape] = (counts[c.shape] || 0) + 1; });
    assert.ok(Object.values(counts).every((n) => n === 2));
  }
  assert.equal(makeDeck().length, 16, 'the default is unchanged');
  assert.equal(makeDeck(Math.random, 99).length, SHAPES.length * 2, 'cannot ask for more shapes than exist');
});

/** A deterministic "random" so a test can predict a layout. */
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

test('the chimp board puts each number in its own square, on the board', async () => {
  const { layoutChimp } = await import('./ui/rules.js');
  for (const count of [4, 9, 24, 40]) {
    const at = layoutChimp(count, 40, seeded(count));
    assert.equal(at.length, count);
    assert.equal(new Set(at).size, count, 'no two numbers share a square');
    assert.ok(at.every((c) => Number.isInteger(c) && c >= 0 && c < 40));
  }
  assert.equal(layoutChimp(99, 24, seeded(1)).length, 24, 'cannot hold more numbers than squares');
  assert.deepEqual(layoutChimp(0, 24, seeded(1)), []);
  assert.deepEqual(layoutChimp(5, 40, seeded(7)), layoutChimp(5, 40, seeded(7)), 'repeatable with the same randomness');
});

test('tapping the chimp squares in order clears the round, and out of order is a miss', async () => {
  const { newChimpRound, tapChimp } = await import('./ui/rules.js');
  const round = newChimpRound(4, 40, seeded(3));
  const [one, two, three, four] = round.at;
  const empty = [...Array(40).keys()].find((c) => !round.at.includes(c));
  assert.equal(tapChimp(round, empty), 'ignore', 'an empty square does nothing');
  assert.equal(tapChimp(round, three), 'wrong', 'skipping ahead is a miss');
  assert.equal(round.next, 1, 'a miss does not move the round on');
  assert.equal(tapChimp(round, one), 'ok');
  assert.equal(tapChimp(round, one), 'wrong', 'a square already cleared is no longer the next number');
  assert.equal(tapChimp(round, two), 'ok');
  assert.equal(tapChimp(round, three), 'ok');
  assert.equal(tapChimp(round, four), 'done');
});

test('a sequence grows by one square and never repeats the one before', async () => {
  const { extendSequence } = await import('./ui/rules.js');
  let seq = [];
  const rand = seeded(11);
  for (let i = 0; i < 200; i++) seq = extendSequence(seq, 9, rand);
  assert.equal(seq.length, 200);
  assert.ok(seq.every((c) => c >= 0 && c < 9));
  assert.ok(seq.every((c, i) => i === 0 || c !== seq[i - 1]), 'no immediate repeats');
  assert.deepEqual(extendSequence([2, 5], 9, seeded(1)).slice(0, 2), [2, 5], 'the earlier steps are untouched');
  assert.equal(extendSequence([0], 1, () => 0).length, 2, 'a one-square board still works (it has to repeat)');
});

test('a stuck random source still gives a legal sequence', async () => {
  const { extendSequence } = await import('./ui/rules.js');
  const seq = extendSequence([4], 9, () => 4 / 9); // always picks square 4, the same as the last
  assert.notEqual(seq[1], 4);
});

test('repeating a sequence: right taps advance, the last one completes, a wrong one ends it', async () => {
  const { tapSequence } = await import('./ui/rules.js');
  const seq = [3, 1, 4];
  assert.deepEqual(tapSequence(seq, 0, 3), { result: 'next', progress: 1 });
  assert.deepEqual(tapSequence(seq, 1, 1), { result: 'next', progress: 2 });
  assert.deepEqual(tapSequence(seq, 2, 4), { result: 'complete', progress: 3 });
  assert.deepEqual(tapSequence(seq, 1, 5), { result: 'wrong', progress: 1 });
  assert.deepEqual(tapSequence([7], 0, 7), { result: 'complete', progress: 1 }, 'level one is a single square');
});
