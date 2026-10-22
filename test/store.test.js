import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'qeuli-store-'));
process.env.QEULI_HOME = home;
const { loadStore } = await import('../src/store.js');
const FILE = path.join(home, 'data.json');
const reset = () => fs.readdirSync(home).forEach((f) => fs.rmSync(path.join(home, f), { force: true }));

test('saved data comes back, and no temp file is left behind', () => {
  reset();
  const a = loadStore();
  a.data.queue.push({ id: '1', url: 'https://example.com' });
  a.save();
  a.flush();
  assert.deepEqual(fs.readdirSync(home).filter((f) => f.endsWith('.tmp')), []);
  assert.equal(loadStore().data.queue[0].url, 'https://example.com');
});

test('an unreadable file is kept aside and the last backup is used', () => {
  reset();
  const a = loadStore();
  a.data.modules.water = { log: [{ t: 1, ml: 250 }] };
  a.save();
  a.flush();
  a.data.modules.water.log.push({ t: 2, ml: 300 });
  a.save();
  a.flush(); // second write: the first becomes data.json.bak
  fs.writeFileSync(FILE, '{ "queue": [ truncated by a kill');
  const b = loadStore();
  assert.equal(b.data.modules.water.log.length >= 1, true, 'recovered from the backup');
  assert.equal(fs.readdirSync(home).filter((f) => f.includes('.corrupt-')).length, 1, 'the damaged file was preserved, not discarded');
});

test('an unreadable file with no backup starts empty but is still preserved', () => {
  reset();
  fs.writeFileSync(FILE, 'not json at all');
  const s = loadStore();
  assert.deepEqual(s.data.queue, []);
  assert.equal(fs.readdirSync(home).filter((f) => f.includes('.corrupt-')).length, 1);
});

test('a missing file is simply an empty store', () => {
  reset();
  const s = loadStore();
  assert.deepEqual(Object.keys(s.data).sort(), ['days', 'learned', 'modules', 'queue']);
});

test('a pending save is written by flush(), so exits do not lose it', () => {
  reset();
  const s = loadStore();
  s.data.learned.push({ topic: 'tides' });
  s.save();
  s.flush(); // what the exit handler does
  assert.equal(JSON.parse(fs.readFileSync(FILE, 'utf8')).learned[0].topic, 'tides');
});
