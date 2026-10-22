import test from 'node:test';
import assert from 'node:assert/strict';
import { createParking } from './parking.js';

function make() {
  let n = 0;
  const store = {};
  const parking = createParking({ store, save() {}, now: () => 1000 + n, newId: () => `id${++n}` });
  return { parking, store };
}

test('items are parked newest first, with counts per kind', () => {
  const { parking } = make();
  parking.add('look into caching', 'idea');
  parking.add('Refactor the router, keep the tests green', 'prompt');
  const s = parking.add('buy coffee', 'todo');
  assert.deepEqual(s.items.map((i) => i.kind), ['todo', 'prompt', 'idea']);
  assert.deepEqual(s.counts, { idea: 1, prompt: 1, todo: 1 });
  assert.equal(s.open, 3);
});

test('empty text and unknown kinds are refused with a 400', () => {
  const { parking } = make();
  assert.throws(() => parking.add('   '), (e) => e.status === 400);
  assert.throws(() => parking.add('x', 'secret'), (e) => e.status === 400 && /idea, prompt, todo/.test(e.message));
});

test('text is trimmed, control characters dropped, and ideas are length-limited but prompts are not short', () => {
  const { parking } = make();
  const idea = parking.add(`  hi\u0000 there  ${'x'.repeat(1000)}`, 'idea').items[0];
  assert.equal(idea.text.startsWith('hi there'), true);
  assert.equal(idea.text.length, 400);
  const prompt = parking.add('p'.repeat(3000), 'prompt').items[0];
  assert.equal(prompt.text.length, 3000);
});

test('toggle marks an item done and back; done items stop counting as open', () => {
  const { parking } = make();
  const id = parking.add('ship it', 'todo').items[0].id;
  assert.equal(parking.toggle(id).open, 0);
  assert.equal(parking.toggle(id).open, 1);
});

test('remove deletes one item; clearDone removes only finished ones', () => {
  const { parking } = make();
  parking.add('a', 'idea');
  parking.add('b', 'idea');
  parking.add('c', 'idea');
  const [c, b, a] = parking.state().items;
  parking.toggle(a.id);
  assert.equal(parking.remove(b.id).items.length, 2);
  assert.deepEqual(parking.clearDone().items.map((i) => i.text), ['c']);
  assert.ok(c);
});

test('unknown ids are a 404', () => {
  const { parking } = make();
  assert.throws(() => parking.toggle('nope'), (e) => e.status === 404);
  assert.throws(() => parking.remove('nope'), (e) => e.status === 404);
});

test('the lot never grows past 200, dropping finished items first', () => {
  const { parking } = make();
  const first = parking.add('keep me', 'idea').items[0];
  const done = parking.add('finished', 'idea').items[0];
  parking.toggle(done.id);
  for (let i = 0; i < 205; i++) parking.add(`idea ${i}`, 'idea');
  const items = parking.state().items;
  assert.equal(items.length, 200);
  assert.equal(items.some((i) => i.id === done.id), false, 'the finished one went first');
  assert.ok(first);
});

test('works when the core wrote a bare disabled record first', () => {
  const { parking, store } = make();
  store.enabled = false;
  assert.equal(parking.state().enabled, false);
  assert.equal(parking.add('still works', 'idea').open, 1);
});
