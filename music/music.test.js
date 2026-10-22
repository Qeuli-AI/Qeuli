import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusic, sanitizeSettings, DEFAULTS, SCAPES } from './music.js';

test('defaults are quiet and manual: nothing starts by itself until you ask', () => {
  const s = createMusic({ store: {}, save() {} }).state();
  assert.equal(s.settings.auto, false);
  assert.equal(s.settings.volume, 0.5);
  assert.deepEqual(s.scapes, SCAPES);
});

test('settings keep only known scapes and clamp the volume', () => {
  assert.equal(sanitizeSettings({ scape: 'rain' }).scape, 'rain');
  assert.equal(sanitizeSettings({ scape: 'death-metal' }).scape, DEFAULTS.scape);
  assert.equal(sanitizeSettings({ volume: 9 }).volume, 1);
  assert.equal(sanitizeSettings({ volume: -3 }).volume, 0);
  assert.equal(sanitizeSettings({ volume: 'loud' }).volume, DEFAULTS.volume);
  assert.equal(sanitizeSettings({ volume: 0.333 }).volume, 0.33);
});

test('unset fields keep their previous value', () => {
  const prev = { scape: 'lofi', volume: 0.2, auto: true, fade: false };
  assert.deepEqual(sanitizeSettings({}, prev), prev);
  assert.equal(sanitizeSettings({ auto: false }, prev).auto, false);
});

test('configure saves, and survives a bare record from the core', () => {
  let saved = 0;
  const store = { enabled: false };
  const music = createMusic({ store, save: () => saved++ });
  assert.equal(music.state().enabled, false);
  assert.equal(music.configure({ scape: 'night', auto: true }).settings.scape, 'night');
  assert.equal(saved, 1);
});
