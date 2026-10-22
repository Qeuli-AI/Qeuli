import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point the data dir at a temp folder before the modules read it.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'qeuli-test-'));
process.env.QEULI_HOME = home;
const { createFeatures, validateManifest, installFromFolder, removeInstalled, loadInstalled } = await import('../src/features.js');
const { render } = await import('../scripts/gen-registry.mjs');

const hour = (h, m = 0) => new Date(2026, 5, 10, h, m).getTime();

function make(t = hour(10)) {
  const clock = { t };
  const sent = [];
  const data = { modules: {} };
  const features = createFeatures({
    data, save() {}, notify: (title, body) => sent.push({ title, body }),
    waitMsToday: () => 0, isRunning: () => false, now: () => clock.t,
  });
  return { features, clock, sent, data };
}

test('registry file matches the feature folders on disk', () => {
  const current = fs.readFileSync(new URL('../src/registry.js', import.meta.url), 'utf8');
  assert.equal(current, render(), 'src/registry.js is stale. Run: npm run features');
});

test('water is built in, on by default, and routes reach its backend', () => {
  const { features } = make();
  const water = features.list().find((f) => f.id === 'water');
  assert.ok(water.builtin && water.enabled);
  assert.equal(features.handle('water', 'POST', 'drink', { ml: 300 }).drunkMl, 300);
  assert.equal(features.handle('water', 'GET', 'state', {}).drunkMl, 300);
});

test('unknown feature or route is a 404', () => {
  const { features } = make();
  assert.throws(() => features.handle('nope', 'GET', 'state', {}), (e) => e.status === 404);
  assert.throws(() => features.handle('water', 'GET', 'nope', {}), (e) => e.status === 404);
  assert.throws(() => features.setEnabled('nope', true), (e) => e.status === 404);
});

test('a disabled feature cannot notify, and keeps working after being re-enabled', () => {
  const { features, sent, clock } = make(hour(11, 5));
  features.setEnabled('breaks', false); // isolate water: breaks has its own reminders
  features.setEnabled('water', false);
  features.tick(); // water would normally be due by 11:05
  assert.equal(sent.length, 0);
  features.setEnabled('water', true);
  features.tick();
  assert.equal(sent.length, 1);
  assert.equal(features.handle('water', 'POST', 'drink', {}).drunkMl, 250);
  clock.t += 1;
});

test('each feature gets its own data record', () => {
  const { features, data } = make();
  features.handle('water', 'POST', 'drink', { ml: 100 });
  features.handle('breaks', 'POST', 'take', { kind: 'walk' });
  assert.ok('water' in data.modules && 'breaks' in data.modules, 'each feature has its own record');
  assert.equal(data.modules.water.log.length, 1);
  assert.equal(data.modules.breaks.log.length, 1);
  assert.equal(data.modules.water.log[0].kind, undefined, 'water never sees breaks data');
  assert.equal(data.modules.breaks.log[0].ml, undefined, 'breaks never sees water data');
});

test('manifest validation rejects path tricks and built-in ids, and clamps reminders', () => {
  assert.throws(() => validateManifest({ id: '../../evil' }));
  assert.throws(() => validateManifest({ id: 'water' }), /built-in/);
  const m = validateManifest({ id: 'tidy', name: 'Tidy', reminders: [{ title: 't', everyMinutes: 1, startHour: 99, endHour: -4 }] });
  assert.equal(m.reminders[0].everyMinutes, 5);
  assert.ok(m.reminders[0].endHour > m.reminders[0].startHour);
});

test('installed features: copy only the manifest, then remind on schedule', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'qeuli-src-'));
  fs.writeFileSync(path.join(src, 'feature.json'), JSON.stringify({ id: 'stretch', name: 'Stretch', reminders: [{ id: 'neck', title: 'Neck', message: 'Roll', everyMinutes: 60, startHour: 9, endHour: 18 }] }));
  fs.writeFileSync(path.join(src, 'payload.js'), 'throw new Error("must never be copied")');
  installFromFolder(src);
  assert.deepEqual(fs.readdirSync(path.join(home, 'features', 'stretch')), ['feature.json']);
  assert.equal(loadInstalled().length, 1);

  const { features, clock, sent } = make(hour(10));
  features.setEnabled('breaks', false); // keep the built-in reminders out of this test
  features.setEnabled('water', false);
  features.tick();
  assert.equal(sent.length, 0, 'installed features are off by default');
  features.setEnabled('stretch', true);
  features.tick(); // first sighting only starts the clock
  assert.equal(sent.filter((n) => n.title === 'Neck').length, 0);
  clock.t = hour(11, 1);
  features.tick();
  assert.equal(sent.filter((n) => n.title === 'Neck').length, 1);
  clock.t = hour(11, 30);
  features.tick();
  assert.equal(sent.filter((n) => n.title === 'Neck').length, 1, 'not again before the interval');

  removeInstalled('stretch');
  assert.equal(loadInstalled().length, 0);
});

test('simultaneous toasts from different features are spaced out, not stacked', async () => {
  const sent = [];
  const features = createFeatures({
    data: { modules: {} }, save() {}, notify: (title) => sent.push(title),
    waitMsToday: () => 0, isRunning: () => false, now: () => hour(11, 5), toastGapMs: 40,
  });
  features.tick(); // breaks and water are both due at this moment
  assert.equal(sent.length, 1, 'the first goes out immediately');
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(sent.length, 2, 'the second follows after the gap');
  assert.notEqual(sent[0], sent[1]);
});

test('every built-in feature names a real division, and the daemon and the UI agree on the list', async () => {
  const { builtinManifests, DIVISION_IDS } = await import('../src/features.js');
  const ui = fs.readFileSync(new URL('../desktop/ui/brand.js', import.meta.url), 'utf8');
  const uiIds = [...ui.matchAll(/\{ id: '([a-z]+)', name: '/g)].map((m) => m[1]);
  assert.deepEqual(uiIds, DIVISION_IDS, 'desktop/ui/brand.js DIVISIONS must match DIVISION_IDS in src/features.js');
  for (const m of builtinManifests()) {
    assert.ok(DIVISION_IDS.includes(m.division), `${m.id} has division "${m.division}"`);
    assert.ok(m.name && m.description, `${m.id} needs a name and description`);
  }
});

test('every built-in feature that declares a UI really has one, and its CLI commands are unique', async () => {
  const { builtinManifests } = await import('../src/features.js');
  const names = [];
  for (const m of builtinManifests()) {
    const hasUi = fs.existsSync(new URL(`../${m.id}/ui/index.js`, import.meta.url));
    assert.equal(m.ui, hasUi, `${m.id}: registry ui flag matches the folder`);
    for (const c of m.cli || []) names.push(c.name);
  }
  assert.equal(new Set(names).size, names.length, 'no two features may claim the same CLI command');
});
