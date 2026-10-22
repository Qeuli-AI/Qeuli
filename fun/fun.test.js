import test from 'node:test';
import assert from 'node:assert/strict';
import { createFun } from './fun.js';
import { JOKES, RIDDLES, ORACLE, riddleForDay, isCorrect, deck } from './ui/content.js';

const at = (dayOffset = 0, hour = 10) => new Date(2026, 5, 10 + dayOffset, hour).getTime();
function make(t = at()) {
  const clock = { t };
  const store = {};
  return { fun: createFun({ store, save() {}, now: () => clock.t }), clock, store };
}

test('solving the riddle marks today, and only the first solve of a day is "first"', () => {
  const { fun } = make();
  assert.equal(fun.state().solvedToday, false);
  assert.equal(fun.solve().first, true);
  assert.equal(fun.state().solvedToday, true);
  assert.equal(fun.solve().first, false, 'no repeat XP');
  assert.equal(fun.state().totalSolved, 1);
});

test('the streak counts consecutive days and survives an unsolved today', () => {
  const { fun, clock } = make(at(-2));
  fun.solve();
  clock.t = at(-1);
  fun.solve();
  clock.t = at(0);
  assert.equal(fun.state().streak, 2, 'today is not solved yet, yesterday and the day before count');
  fun.solve();
  assert.equal(fun.state().streak, 3);
  clock.t = at(2);
  assert.equal(fun.state().streak, 0, 'a missed day breaks it');
});

test('works when the core wrote a bare disabled record first', () => {
  const { fun, store } = make();
  store.enabled = false;
  assert.equal(fun.state().enabled, false);
  assert.equal(fun.solve().totalSolved, 1);
});

test('the same riddle all day, a different one most days', () => {
  assert.equal(riddleForDay('2026-06-10'), riddleForDay('2026-06-10'));
  const seen = new Set(Array.from({ length: 10 }, (_, i) => riddleForDay(`2026-06-${String(10 + i).padStart(2, '0')}`).q));
  assert.equal(seen.size, 10);
});

test('answers are checked loosely but not stupidly', () => {
  const echo = RIDDLES.find((r) => r.answers.includes('echo'));
  assert.equal(isCorrect(echo, 'Echo'), true);
  assert.equal(isCorrect(echo, ' an  ECHO! '), true);
  assert.equal(isCorrect(echo, 'the echo'), true);
  assert.equal(isCorrect(echo, 'an echoing hall'), true, 'a long answer may contain the word');
  assert.equal(isCorrect(echo, 'ecko'), false);
  assert.equal(isCorrect(echo, ''), false);
  const m = RIDDLES.find((r) => r.answers.includes('theletterm'));
  assert.equal(isCorrect(m, 'm'), true);
  assert.equal(isCorrect(m, 'monkey'), false, 'a short answer must match exactly, not just be contained');
});

test('the content is real: unique, non-empty, and every riddle has an answer', () => {
  for (const list of [JOKES, ORACLE]) {
    assert.ok(list.length >= 14);
    assert.equal(new Set(list).size, list.length, 'no duplicates');
    assert.ok(list.every((s) => s.trim().length > 4));
  }
  assert.equal(new Set(RIDDLES.map((r) => r.q)).size, RIDDLES.length);
  assert.ok(RIDDLES.every((r) => r.answers.length && r.answers.every((a) => /^[a-z0-9]+$/.test(a))));
});

test('the joke deck shows everything once before repeating, and never twice in a row', () => {
  const next = deck(['a', 'b', 'c', 'd']);
  const first = [next(), next(), next(), next()];
  assert.deepEqual(first.slice().sort(), ['a', 'b', 'c', 'd']);
  const second = [next(), next(), next(), next()];
  assert.deepEqual(second.slice().sort(), ['a', 'b', 'c', 'd']);
  assert.notEqual(first[3], second[0], 'no repeat across the reshuffle');
});
