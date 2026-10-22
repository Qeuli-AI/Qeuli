import test from 'node:test';
import assert from 'node:assert/strict';
import { createScores, MAX_VARIANTS } from '../src/scores.js';

// A small fixture: two games where more is better and one where fewer is better.
const GAMES = {
  snake: { name: 'Snake', better: 'higher', unit: 'points' },
  typing: { name: 'Typing', better: 'higher', unit: 'wpm' },
  memory: { name: 'Pair match', better: 'lower', unit: 'moves' },
};

const make = () => {
  const store = {};
  return { arcade: createScores({ games: GAMES, store, save() {}, now: () => 5 }), store };
};

test('a fresh score store has every game with no best score', () => {
  const s = make().arcade.state();
  assert.deepEqual(Object.keys(s.scores).sort(), Object.keys(GAMES).sort());
  assert.equal(s.scores.snake.best, null);
  assert.equal(s.plays, 0);
});

test('higher-is-better games keep the highest score and flag a new best', () => {
  const { arcade } = make();
  assert.equal(arcade.submit('snake', 12).isBest, true);
  assert.equal(arcade.submit('snake', 7).isBest, false);
  const r = arcade.submit('snake', 30);
  assert.equal(r.isBest, true);
  assert.equal(r.scores.snake.best, 30);
  assert.equal(r.scores.snake.plays, 3);
});

test('a lower-is-better game is scored in moves, so fewer is better', () => {
  const { arcade } = make();
  assert.equal(arcade.submit('memory', 22).isBest, true);
  assert.equal(arcade.submit('memory', 30).isBest, false);
  assert.equal(arcade.submit('memory', 16).isBest, true);
  assert.equal(arcade.state().scores.memory.best, 16);
});

test('a score of zero is never a personal best, but it is still a play', () => {
  const { arcade } = make();
  const r = arcade.submit('snake', 0);
  assert.equal(r.isBest, false);
  assert.equal(r.scores.snake.best, null);
  assert.equal(r.scores.snake.plays, 1);
});

test('unknown games and silly scores are rejected with a 400', () => {
  const { arcade } = make();
  assert.throws(() => arcade.submit('doom', 5), (e) => e.status === 400);
  for (const bad of [-1, NaN, Infinity, 1e12, 'lots']) assert.throws(() => arcade.submit('snake', bad), (e) => e.status === 400);
});

test('fractional scores are rounded, and a bare disabled record from the core is fine', () => {
  const { arcade, store } = make();
  store.enabled = false;
  assert.equal(arcade.state().enabled, false);
  assert.equal(arcade.submit('typing', 41.6).scores.typing.best, 42);
});

test('bests are kept per option set, so an easy setting never competes with a hard one', () => {
  const { arcade } = make();
  assert.equal(arcade.submit('snake', 30, 'size-14/speed-chill').isBest, true);
  // A lower score on a different setting is still that setting's first best.
  const r = arcade.submit('snake', 12, 'size-26/speed-fast');
  assert.equal(r.isBest, true);
  assert.equal(r.scores.snake.variants['size-14/speed-chill'].best, 30);
  assert.equal(r.scores.snake.variants['size-26/speed-fast'].best, 12);
  assert.equal(r.scores.snake.best, 30, 'the overall best is still the highest score');
  assert.equal(arcade.submit('snake', 20, 'size-26/speed-fast').isBest, true);
  assert.equal(arcade.submit('snake', 5, 'size-26/speed-fast').isBest, false);
});

test('for lower-is-better games each option set keeps its own fewest moves', () => {
  const { arcade } = make();
  arcade.submit('memory', 12, 'pairs-6');
  assert.equal(arcade.submit('memory', 25, 'pairs-8').isBest, true);
  assert.equal(arcade.submit('memory', 20, 'pairs-8').isBest, true);
  assert.equal(arcade.state().scores.memory.variants['pairs-8'].best, 20);
});

test('a missing option label behaves exactly as before', () => {
  const { arcade } = make();
  const r = arcade.submit('snake', 9);
  assert.deepEqual(r.scores.snake.variants, {});
  assert.equal(r.isBest, true);
});

test('option labels are validated and cannot grow without limit', () => {
  const { arcade } = make();
  for (const bad of ['has space', '<script>', 'x'.repeat(65), '../../etc']) assert.throws(() => arcade.submit('snake', 5, bad), (e) => e.status === 400, bad);
  for (let i = 0; i < MAX_VARIANTS; i++) arcade.submit('snake', 5, 'v' + i);
  assert.throws(() => arcade.submit('snake', 5, 'one-too-many'), (e) => e.status === 400);
  assert.equal(arcade.submit('snake', 6, 'v3').scores.snake.variants.v3.plays, 2, 'an existing label still works at the limit');
});

test('labels that name built-in properties cannot reach anything outside this game', () => {
  const { arcade } = make();
  assert.throws(() => arcade.submit('snake', 5, '__proto__'), (e) => e.status === 400);
  const r = arcade.submit('snake', 7, 'constructor');
  assert.equal(r.scores.snake.variants.constructor.best, 7);
  assert.equal(Object.hasOwn(r.scores.snake.variants, 'constructor'), true);
  assert.equal(({}).best, undefined, 'nothing leaked onto Object.prototype');
  assert.equal(typeof Object.best, 'undefined', 'nothing leaked onto the Object constructor');
});

test('a rejected submission changes nothing', () => {
  const { arcade } = make();
  for (let i = 0; i < MAX_VARIANTS; i++) arcade.submit('snake', 1, 'v' + i);
  const before = JSON.stringify(arcade.state());
  assert.throws(() => arcade.submit('snake', 999, 'overflow'), (e) => e.status === 400);
  assert.equal(JSON.stringify(arcade.state()), before, 'no best or play count moved');
});

test('a game id that merely exists on Object.prototype is not a game', () => {
  const { arcade } = make();
  for (const bad of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.throws(() => arcade.submit(bad, 5), (e) => e.status === 400, bad);
});
