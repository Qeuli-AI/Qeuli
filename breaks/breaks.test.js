import test from 'node:test';
import assert from 'node:assert/strict';
import { createBreaks, sanitizeSettings, KINDS } from './breaks.js';

// A local-time timestamp so tests do not depend on the machine's timezone.
const at = (hour, min = 0, dayOffset = 0) => new Date(2026, 5, 10 + dayOffset, hour, min).getTime();

function make({ t = at(10), running = false } = {}) {
  const clock = { t };
  const sent = [];
  const store = {}; // a bare record, exactly what the core hands a feature on first use
  const breaks = createBreaks({
    store, save() {}, notify: (title, body) => sent.push({ title, body }),
    isRunning: () => running, now: () => clock.t,
  });
  return { breaks, clock, sent, store };
}

test('taking a break counts toward today and records its kind', () => {
  const { breaks } = make();
  breaks.take('eyes');
  const s = breaks.take('stretch');
  assert.equal(s.total, 2);
  assert.equal(s.kinds.find((k) => k.id === 'eyes').count, 1);
  assert.deepEqual(s.log.map((e) => e.kind), ['eyes', 'stretch']);
});

test('an unknown kind is rejected with a helpful message', () => {
  const { breaks } = make();
  assert.throws(() => breaks.take('nap'), (e) => e.status === 400 && /eyes, stretch, walk, breathe/.test(e.message));
});

test('undo removes the last break of today', () => {
  const { breaks } = make();
  breaks.take('eyes');
  breaks.take('walk');
  assert.equal(breaks.undo().total, 1);
});

test('eye reminders start one interval into the active day and repeat', () => {
  const { breaks, clock, sent } = make({ t: at(9, 10) });
  breaks.tick();
  assert.equal(sent.length, 0, 'only 10 minutes since 09:00');
  clock.t = at(9, 21);
  breaks.tick();
  assert.equal(sent.length, 1);
  assert.match(sent[0].title, /Eye rest/);
  clock.t = at(9, 35);
  breaks.tick();
  assert.equal(sent.length, 1, 'not again before the next interval');
  clock.t = at(9, 45);
  breaks.tick();
  assert.equal(sent.length, 2);
});

test('taking a break resets that reminder clock', () => {
  const { breaks, clock, sent } = make({ t: at(9, 30) });
  breaks.take('eyes');
  clock.t = at(9, 45);
  breaks.tick();
  assert.equal(sent.length, 0);
});

test('never more than one nudge at a time, even when several kinds are due', () => {
  const { breaks, clock, sent } = make({ t: at(11) }); // eyes, stretch and walk all overdue
  breaks.tick();
  assert.equal(sent.length, 1);
  clock.t = at(11, 5);
  breaks.tick();
  assert.equal(sent.length, 1, 'cooldown holds the next one back');
  clock.t = at(11, 12);
  breaks.tick();
  assert.equal(sent.length, 2, 'then the next kind goes out');
  assert.notEqual(sent[0].title, sent[1].title);
});

test('no reminders outside active hours or when the feature is off', () => {
  const night = make({ t: at(22) });
  night.breaks.tick();
  assert.equal(night.sent.length, 0);
  const off = make({ t: at(11) });
  off.store.enabled = false;
  off.breaks.tick();
  assert.equal(off.sent.length, 0);
});

test('disabling a kind stops its reminders', () => {
  const { breaks, clock, sent } = make({ t: at(9) });
  breaks.configure({ kinds: { eyes: { on: false }, stretch: { on: false }, walk: { on: false } } });
  clock.t = at(14);
  breaks.tick();
  assert.equal(sent.length, 0);
});

test('reaching the daily goal sends one congratulation and counts a streak day', () => {
  const { breaks, sent, clock } = make({ t: at(9, 0, -1) });
  for (let i = 0; i < 8; i++) breaks.take('eyes');
  clock.t = at(10);
  assert.equal(breaks.state().streak, 1, 'yesterday met the goal, today not yet');
  for (let i = 0; i < 8; i++) breaks.take('eyes');
  assert.equal(sent.filter((n) => n.title === 'Break goal reached').length, 2, 'one per day it was crossed');
  assert.equal(breaks.state().streak, 2);
});

test('settings are clamped and unknown fields ignored', () => {
  const s = sanitizeSettings({ goal: 999, startHour: 40, endHour: 1, kinds: { eyes: { every: 1 }, bogus: { on: true } } });
  assert.equal(s.goal, 40);
  assert.ok(s.endHour > s.startHour);
  assert.equal(s.kinds.eyes.every, 10);
  assert.equal(s.kinds.bogus, undefined);
  assert.deepEqual(Object.keys(s.kinds).sort(), Object.keys(KINDS).sort());
});

test('run-start nudge: only when overdue and the run is still going', async () => {
  const due = make({ t: at(14), running: true });
  due.breaks.onRunStart('s1', 'Claude');
  await new Promise((r) => setTimeout(r, 20_500));
  assert.equal(due.sent.length, 1);
  assert.match(due.sent[0].body, /Claude is working/);

  const fresh = make({ t: at(14), running: true });
  fresh.breaks.take('eyes');
  fresh.breaks.take('stretch');
  fresh.breaks.onRunStart('s1', 'Claude');
  await new Promise((r) => setTimeout(r, 20_500));
  assert.equal(fresh.sent.length, 0, 'just had breaks, no nudge');
});

test('history lists every day with a per-kind breakdown', () => {
  const { breaks, clock } = make({ t: at(10, 0, -2) });
  breaks.take('eyes');
  breaks.take('walk');
  clock.t = at(10);
  breaks.take('stretch');
  const h = breaks.history(4);
  assert.equal(h.days.length, 4);
  assert.deepEqual(h.days.map((d) => d.total), [0, 2, 0, 1]);
  assert.deepEqual(h.days[1].byKind, { eyes: 1, stretch: 0, walk: 1, breathe: 0 });
});

test('works when the core has written a bare disabled record first', () => {
  const { breaks, store } = make();
  store.enabled = false;
  assert.equal(breaks.state().enabled, false);
  assert.equal(breaks.take('eyes').total, 1);
});
