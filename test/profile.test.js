import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, sanitizeProfile, levelForXp, xpForLevel, emptyProfile } from '../src/profile.js';
import { describeTool } from '../src/hooks.js';

const make = (t = Date.UTC(2026, 5, 10, 12)) => {
  const data = {};
  const clock = { t };
  const profile = createProfile({ data, save() {}, now: () => clock.t });
  return { profile, data, clock };
};

test('levels follow a gentle curve: 0 -> 1, 25 -> 2, 100 -> 3, 225 -> 4', () => {
  assert.deepEqual([0, 24, 25, 99, 100, 225].map(levelForXp), [1, 1, 2, 2, 3, 4]);
  assert.deepEqual([1, 2, 3, 4].map(xpForLevel), [0, 25, 100, 225]);
});

test('a new profile is empty, not onboarded, and shows progress toward level 2', () => {
  const v = make().profile.view();
  assert.equal(v.onboarded, false);
  assert.equal(v.level, 1);
  assert.equal(v.progress, 0);
  assert.equal(v.levelTo, 25);
});

test('awarding XP adds up, reports a level-up once, and logs recent actions', () => {
  const { profile } = make();
  assert.equal(profile.award(20, 'water').leveledUp, false);
  const r = profile.award(8, 'break');
  assert.equal(r.granted, 8);
  assert.equal(r.leveledUp, true);
  assert.equal(r.level, 2);
  assert.deepEqual(r.recent.map((e) => e.reason), ['break', 'water']);
});

test('XP per award is clamped and each reason has a daily cap', () => {
  const { profile, clock } = make();
  assert.equal(profile.award(9999, 'x').granted, 25);
  let granted = 0;
  for (let i = 0; i < 30; i++) granted += profile.award(1, 'spam').granted;
  assert.equal(granted, 12, 'only 12 awards per reason per day');
  clock.t += 86_400_000;
  assert.equal(profile.award(1, 'spam').granted, 1, 'the cap resets the next day');
});

test('profile edits keep only known values and trim the name', () => {
  const p = sanitizeProfile({ name: '  <b>Naman</b>\u0000  ', character: { sigil: 'nope', role: 'Maker', quest: 'Find calm', vibe: 'Bold', origin: 'x'.repeat(500) }, onboarded: 1 });
  assert.equal(p.name, 'Naman', 'tags and control characters are stripped');
  assert.equal(p.character.sigil, 'hawk');
  assert.equal(p.character.role, 'Maker');
  assert.equal(p.character.origin.length, 140);
  assert.equal(p.onboarded, true);
});

test('configuring a profile never touches XP', () => {
  const { profile } = make();
  profile.award(10, 'water');
  assert.equal(profile.configure({ name: 'Ada', onboarded: true }).xp, 10);
});

test('tool descriptions keep only a name and a short, harmless target', () => {
  assert.deepEqual(describeTool('Edit', { file_path: String.raw`C:\secret\project\src\app.js`, old_string: 'password=hunter2' }), { tool: 'Edit', target: 'app.js' });
  assert.deepEqual(describeTool('Read', { file_path: '/home/me/private/notes.md' }), { tool: 'Read', target: 'notes.md' });
  assert.deepEqual(describeTool('Bash', { command: 'git push https://user:token@example.com/x.git' }), { tool: 'Bash', target: 'git' });
  assert.deepEqual(describeTool('WebFetch', { url: 'https://example.com/a?key=SECRET' }), { tool: 'WebFetch', target: 'example.com' });
  assert.deepEqual(describeTool('Grep', { pattern: 'api_key' }), { tool: 'Grep', target: '' });
  assert.deepEqual(describeTool('WebFetch', { url: 'not a url' }), { tool: 'WebFetch', target: '' });
  assert.deepEqual(describeTool(undefined), { tool: '', target: '' });
});
