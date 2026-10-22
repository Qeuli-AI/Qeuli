import test from 'node:test';
import assert from 'node:assert/strict';
import { PROSE, CODE, buildPassage, charStates, passageStats } from './ui/passages.js';

const words = (s) => s.trim().split(/\s+/).length;
/** A deterministic "random" so a test can predict the shuffle. */
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

test('every passage is plain typeable ASCII, with no stray spaces or tabs', () => {
  for (const text of [...PROSE, ...CODE]) {
    assert.match(text, /^[\x20-\x7e\n]+$/, text.slice(0, 40));
    assert.ok(!text.includes('\t'));
    assert.ok(!/ {2}/.test(text), 'double spaces are impossible to see and unfair to type: ' + text.slice(0, 40));
    assert.ok(!/(^|\n) /.test(text), 'indentation is skipped, so lines start at the first character');
    assert.equal(text, text.trim());
  }
});

test('prose passages are paragraph sized and there are enough to vary the run', () => {
  assert.ok(PROSE.length >= 10 && CODE.length >= 8);
  for (const p of PROSE) assert.ok(words(p) >= 35 && words(p) <= 80, `${words(p)} words: ${p.slice(0, 30)}`);
  assert.equal(new Set(PROSE).size, PROSE.length, 'no duplicate passages');
  assert.equal(new Set(CODE).size, CODE.length);
});

test('longer runs use more passages and never repeat one', () => {
  const rand = seeded(7);
  const short = words(buildPassage('prose', 'short', rand));
  const medium = words(buildPassage('prose', 'medium', rand));
  const long = buildPassage('prose', 'long', rand);
  assert.ok(short < medium && medium < words(long));
  const pieces = PROSE.filter((p) => long.includes(p));
  assert.equal(pieces.length, 4, 'a long run is four distinct passages');
});

test('code runs join snippets with a blank line and cap at three', () => {
  const text = buildPassage('code', 'long', seeded(3));
  const used = CODE.filter((c) => text.includes(c));
  assert.equal(used.length, 3);
  assert.equal(text.split('\n\n').length, 3);
  assert.equal(buildPassage('code', 'short', seeded(3)).split('\n\n').length, 1);
});

test('unknown kinds and lengths fall back to a medium prose run', () => {
  const t = buildPassage('???', '???', seeded(1));
  assert.ok(PROSE.some((p) => t.includes(p)));
  assert.equal(PROSE.filter((p) => t.includes(p)).length, 2);
});

test('the same random source gives the same passage', () => {
  assert.equal(buildPassage('prose', 'medium', seeded(42)), buildPassage('prose', 'medium', seeded(42)));
});

test('characters are marked right, wrong, or still to come', () => {
  assert.deepEqual(charStates('cab', 'cat'), ['ok', 'ok', 'bad']);
  assert.deepEqual(charStates('c', 'cat'), ['ok', 'todo', 'todo']);
  assert.deepEqual(charStates('', 'ab'), ['todo', 'todo']);
  assert.deepEqual(charStates('a\nb', 'a\nb'), ['ok', 'ok', 'ok']);
  assert.deepEqual(charStates('abcd', 'ab'), ['ok', 'ok'], 'extra characters never add marks');
});

test('speed counts only correct characters, five to a word', () => {
  // 300 correct characters in one minute is 60 wpm.
  const target = 'a'.repeat(300);
  assert.equal(passageStats({ typed: target, target, keystrokes: 300, mistakes: 0, ms: 60000 }).wpm, 60);
  // The same 300 keystrokes with a third of them wrong is only 200 correct characters: 40 wpm.
  const typed = 'a'.repeat(200) + 'b'.repeat(100);
  assert.equal(passageStats({ typed, target, keystrokes: 300, mistakes: 100, ms: 60000 }).wpm, 40);
});

test('accuracy remembers mistakes that were corrected', () => {
  const target = 'hello';
  const s = passageStats({ typed: 'hello', target, keystrokes: 8, mistakes: 3, ms: 30000 });
  assert.equal(s.accuracy, 63);
  assert.equal(s.correct, 5);
  assert.equal(s.seconds, 30);
});

test('no time or no keystrokes never divides by zero', () => {
  const s = passageStats({ typed: '', target: 'abc', keystrokes: 0, mistakes: 0, ms: 0 });
  assert.deepEqual(s, { wpm: 0, accuracy: 0, correct: 0, seconds: 0 });
  assert.equal(passageStats({ typed: 'a', target: 'abc', keystrokes: 1, mistakes: 5, ms: 1000 }).accuracy, 0, 'accuracy never goes negative');
});
