import test from 'node:test';
import assert from 'node:assert/strict';
import { typingStats, DEV_WORDS, wordPool } from './ui/rules.js';

test('typing speed counts five characters as a word, accuracy counts words', () => {
  assert.deepEqual(typingStats({ correctChars: 150, correctWords: 25, wrongWords: 5, seconds: 30 }), { wpm: 60, accuracy: 83 });
  assert.deepEqual(typingStats({ correctChars: 0, correctWords: 0, wrongWords: 0, seconds: 30 }), { wpm: 0, accuracy: 0 });
  assert.equal(typingStats({ correctChars: 10, correctWords: 1, wrongWords: 0, seconds: 0 }).wpm, 0);
});

test('there are enough distinct, lowercase words to type', () => {
  assert.ok(new Set(DEV_WORDS).size === DEV_WORDS.length, 'no duplicates');
  assert.ok(DEV_WORDS.length >= 60);
  assert.ok(DEV_WORDS.every((w) => /^[a-z]+$/.test(w)));
});

test('word pools split the typing words by length without losing any', () => {
  assert.ok(wordPool('short').every((w) => w.length <= 5));
  assert.ok(wordPool('long').every((w) => w.length >= 7));
  assert.ok(wordPool('short').length >= 10 && wordPool('long').length >= 10, 'enough words for a sprint of each kind');
  assert.equal(wordPool('dev'), DEV_WORDS);
  assert.equal(wordPool('nonsense'), DEV_WORDS);
});
