import test from 'node:test';
import assert from 'node:assert/strict';
import { createMove, sanitizeSettings } from './move.js';
import { ROUTINES, totalSeconds } from './routines.js';

const at = (hour, dayOffset = 0) => new Date(2026, 5, 10 + dayOffset, hour).getTime();
function make(t = at(10)) {
  const clock = { t };
  const store = {};
  return { move: createMove({ store, save() {}, now: () => clock.t }), clock, store };
}

test('each routine runs as long as it says: 3, 2, 5 and 4 minutes', () => {
  const minutes = Object.fromEntries(ROUTINES.map((r) => [r.id, totalSeconds(r) / 60]));
  assert.deepEqual(minutes, { 'desk-reset': 3, wrists: 2, 'wake-up': 5, 'back-reset': 4 });
});

test('every step has a name, a positive duration and a cue, and ids are unique', () => {
  assert.equal(new Set(ROUTINES.map((r) => r.id)).size, ROUTINES.length);
  for (const r of ROUTINES) for (const s of r.steps) {
    assert.ok(s.name && s.cue && s.seconds >= 10 && s.seconds <= 60, `${r.id}: ${s.name}`);
  }
});

test('finishing a routine logs its full length and counts toward the goal', () => {
  const { move } = make();
  const s = move.done('desk-reset');
  assert.equal(s.todayMin, 3);
  assert.equal(s.sessionsToday, 1);
  assert.equal(move.done('wrists').todayMin, 5);
});

test('an unknown routine is a 400', () => {
  assert.throws(() => make().move.done('crossfit'), (e) => e.status === 400 && /unknown routine/.test(e.message));
});

test('the streak counts days at the goal and survives an unfinished today', () => {
  const { move, clock } = make(at(10, -2));
  move.done('wake-up'); // 5 min, meets the default goal
  clock.t = at(10, -1);
  move.done('wake-up');
  clock.t = at(10);
  assert.equal(move.state().streak, 2);
  move.done('back-reset'); // 4 minutes: short of the 5-minute goal, so today does not count yet
  assert.equal(move.state().streak, 2);
  move.done('wrists'); // 6 minutes in all
  assert.equal(move.state().streak, 3);
  clock.t = at(10, 2);
  assert.equal(move.state().streak, 0);
});

test('a short routine alone does not meet a bigger goal', () => {
  const { move } = make();
  move.configure({ goalMin: 10 });
  move.done('wrists');
  assert.equal(move.history(1).days[0].reached, false);
  move.done('wake-up');
  move.done('wake-up'); // 2 + 5 + 5 = 12 minutes
  assert.equal(move.history(1).days[0].reached, true);
});

test('undo removes the last session of today only', () => {
  const { move, clock } = make(at(10, -1));
  move.done('wrists');
  clock.t = at(10);
  move.done('desk-reset');
  assert.equal(move.undo().todayMin, 0);
  assert.equal(move.undo().todayMin, 0, 'yesterday is left alone');
  assert.equal(move.history(2).days[0].minutes, 2);
});

test('history lists every day with minutes, oldest first', () => {
  const { move, clock } = make(at(10, -2));
  move.done('desk-reset');
  clock.t = at(10);
  move.done('wrists');
  const h = move.history(3);
  assert.deepEqual(h.days.map((d) => d.minutes), [3, 0, 2]);
  assert.equal(move.history(9999).days.length, 365);
});

test('the goal is clamped, and a bare disabled record from the core is fine', () => {
  assert.equal(sanitizeSettings({ goalMin: 9999 }).goalMin, 120);
  assert.equal(sanitizeSettings({ goalMin: 0 }).goalMin, 1);
  assert.equal(sanitizeSettings({ goalMin: 'lots' }).goalMin, 5);
  const { move, store } = make();
  store.enabled = false;
  assert.equal(move.state().enabled, false);
});
