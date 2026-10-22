import test from 'node:test';
import assert from 'node:assert/strict';
import { createWater, sanitizeSettings, goalForWeight } from './water.js';

const H = 3_600_000;
// A local-time timestamp so tests do not depend on the machine's timezone.
const at = (hour, min = 0, dayOffset = 0) => new Date(2026, 5, 10 + dayOffset, hour, min).getTime();

function make({ t = at(10), waitMs = 0, running = false } = {}) {
  const clock = { t };
  const sent = [];
  const store = {}; // a bare record, exactly what the core hands a feature on first use
  const water = createWater({
    store, save() {}, notify: (title, body) => sent.push({ title, body }),
    waitMsToday: () => waitMs, isRunning: () => running, now: () => clock.t,
  });
  return { water, clock, sent, store };
}

// A single drink is capped at 2000 ml, so reach a daily goal in two sips.
const fill = (water) => { water.drink(1250); water.drink(1250); };

test('goal from weight is ~35 ml/kg rounded to 50', () => {
  assert.equal(goalForWeight(70), 2450);
  assert.equal(goalForWeight(82), 2850);
});

test('drinks add up and undo removes the last one', () => {
  const { water } = make();
  water.drink(250);
  water.drink(500);
  assert.equal(water.state().drunkMl, 750);
  assert.equal(water.undo().drunkMl, 250);
});

test('settings are clamped to sane values', () => {
  const s = sanitizeSettings({ goalMl: 99999, glassMl: 1, intervalMin: 1, startHour: 30, endHour: 2 });
  assert.equal(s.goalMl, 8000);
  assert.equal(s.glassMl, 50);
  assert.equal(s.intervalMin, 15);
  assert.ok(s.endHour > s.startHour);
});

test('heavy wait day raises the goal by 250 ml', () => {
  assert.equal(make({ waitMs: 2 * H }).water.state().goalMl, 2750);
  assert.equal(make({ waitMs: 10 * 60_000 }).water.state().goalMl, 2500);
});

test('reminder fires after the interval, not before', () => {
  const { water, clock, sent } = make({ t: at(9, 30) });
  water.tick();
  assert.equal(sent.length, 0, 'only 30 minutes since the day started');
  clock.t = at(11, 1);
  water.tick();
  assert.equal(sent.length, 1);
  clock.t = at(11, 30);
  water.tick();
  assert.equal(sent.length, 1, 'does not repeat before the next interval');
  clock.t = at(13, 2);
  water.tick();
  assert.equal(sent.length, 2);
});

test('drinking resets the reminder clock', () => {
  const { water, clock, sent } = make({ t: at(10) });
  clock.t = at(12, 30);
  water.drink(250);
  clock.t = at(13);
  water.tick();
  assert.equal(sent.length, 0);
});

test('no reminders outside active hours or after the goal is met', () => {
  const night = make({ t: at(23) });
  night.water.tick();
  assert.equal(night.sent.length, 0);
  const done = make({ t: at(10) });
  fill(done.water);
  done.clock.t = at(14);
  done.water.tick();
  assert.equal(done.sent.filter((n) => n.title === 'Time for water').length, 0);
});

test('reaching the goal sends one congratulation', () => {
  const { water, sent } = make();
  water.drink(2000);
  water.drink(500);
  water.drink(250);
  assert.equal(sent.filter((n) => n.title === 'Water goal reached').length, 1);
});

test('streak counts consecutive days at the base goal', () => {
  const { water, clock } = make({ t: at(10, 0, -2) });
  fill(water);
  clock.t = at(10, 0, -1);
  fill(water);
  clock.t = at(10);
  assert.equal(water.state().streak, 2, 'today not met yet, two past days count');
  fill(water);
  assert.equal(water.state().streak, 3);
});

test('run-start nudge only when due, and only if the run is still going', async () => {
  const t0 = at(14);
  const due = make({ t: t0, running: true });
  due.water.drink(250);
  due.clock.t = t0 + 2 * H; // last drink two hours ago
  due.water.onRunStart('s1', 'Claude');
  await new Promise((r) => setTimeout(r, 20_500));
  assert.equal(due.sent.filter((n) => n.title === 'Good moment for water').length, 1);

  const recent = make({ t: t0, running: true });
  recent.water.drink(250);
  recent.water.onRunStart('s1', 'Claude');
  await new Promise((r) => setTimeout(r, 20_500));
  assert.equal(recent.sent.length, 0, 'just drank, no nudge');
});

test('works after the features registry toggles it off and on', () => {
  const { water, store } = make();
  store.enabled = false; // what the core writes when you switch it off
  assert.equal(water.state().enabled, false);
  assert.equal(water.drink(250).drunkMl, 250);
  store.enabled = true;
  assert.equal(water.state().enabled, true);
});

test('a known vessel fixes the volume, custom takes the typed one', () => {
  const { water } = make();
  assert.equal(water.configure({ vessel: 'mug' }).settings.glassMl, 350);
  assert.equal(water.drink().drunkMl, 350, 'default drink uses the vessel volume');
  const custom = water.configure({ vessel: 'custom', glassMl: 330 }).settings;
  assert.equal(custom.glassMl, 330);
  assert.equal(water.configure({ vessel: 'not-a-vessel' }).settings.vessel, 'custom');
});

test('settings saved before vessels existed get a matching vessel', () => {
  const store = { enabled: true, settings: { goalMl: 2500, glassMl: 500, intervalMin: 120, startHour: 9, endHour: 22 }, log: [], lastNotifyAt: 0 };
  const water = createWater({ store, save() {}, notify() {}, waitMsToday: () => 0, isRunning: () => false, now: () => at(10) });
  assert.equal(water.state().settings.vessel, 'bottle');
});

test('drinks remember which vessel they came from', () => {
  const { water } = make();
  water.drink(200, 'cup');
  water.drink(333, 'nonsense');
  const log = water.state().log;
  assert.equal(log[0].v, 'cup');
  assert.equal(log[1].v, undefined);
});

test('history lists every day including empty ones, oldest first', () => {
  const { water, clock } = make({ t: at(10, 0, -3) });
  water.drink(1000);
  water.drink(1500);
  clock.t = at(10, 0, -1);
  water.drink(500);
  clock.t = at(10);
  const h = water.history(5);
  assert.equal(h.days.length, 5);
  assert.deepEqual(h.days.map((d) => d.ml), [0, 2500, 0, 500, 0]);
  assert.deepEqual(h.days.map((d) => d.reached), [false, true, false, false, false]);
  assert.equal(h.averageMl, 1500, 'average over days with any water');
  assert.equal(h.bestMl, 2500);
  assert.equal(h.reachedDays, 1);
  assert.ok(h.days[0].day < h.days[4].day);
});

test('history asks are clamped and old entries are kept for over a year', () => {
  const { water, clock } = make({ t: at(10, 0, -300) });
  water.drink(250);
  clock.t = at(10);
  assert.equal(water.history(9999).days.length, 365);
  assert.equal(water.history(0).days.length, 1);
  water.drink(100); // triggers pruning; the 300-day-old entry must survive
  assert.equal(water.history(365).days.find((d) => d.ml === 250)?.ml, 250);
});
