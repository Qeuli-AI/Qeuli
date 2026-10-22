import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, newRun, record, headline, duration } from './context.js';

function make(t0 = 1_000_000) {
  const clock = { t: t0 };
  const store = {};
  const ctx = createContext({ store, save() {}, now: () => clock.t });
  const send = (e) => ctx.onEvent({ session: 's1', source: 'claude-code', cwd: 'C:\\work\\shop', ...e });
  return { ctx, clock, store, send };
}

test('a run counts files edited, files read and commands, without duplicates', () => {
  const run = newRun({ session: 's', name: 'Claude', cwd: '/home/me/shop', t: 0 });
  record(run, { tool: 'Edit', target: 'app.js' }, 1);
  record(run, { tool: 'Edit', target: 'app.js' }, 2);
  record(run, { tool: 'Write', target: 'styles.css' }, 3);
  record(run, { tool: 'Read', target: 'a.js' }, 4);
  record(run, { tool: 'Read', target: 'b.js' }, 5);
  record(run, { tool: 'Bash', target: 'npm' }, 6);
  record(run, { tool: 'Bash', target: 'npm' }, 7);
  assert.deepEqual(run.edited, ['app.js', 'styles.css']);
  assert.equal(run.read, 2);
  assert.deepEqual(run.commands, ['npm']);
  assert.equal(run.calls, 7);
  assert.equal(run.project, 'shop');
});

test('the headline reads like a sentence', () => {
  const run = newRun({ session: 's', name: 'Claude', cwd: '/x/proj', t: 0 });
  assert.equal(headline(run), 'Claude was working, with no tool calls yet.');
  record(run, { tool: 'Edit', target: 'a.js' }, 1);
  assert.equal(headline(run), 'Claude edited 1 file (a.js).');
  record(run, { tool: 'Edit', target: 'b.js' }, 2);
  record(run, { tool: 'Edit', target: 'c.js' }, 3);
  record(run, { tool: 'Bash', target: 'npm' }, 4);
  record(run, { tool: 'Read', target: 'z' }, 5);
  assert.equal(headline(run), 'Claude edited 3 files (a.js, b.js, +1), ran npm, and read 1 file.');
  record(run, { tool: 'Bash', target: 'git' }, 6);
  record(run, { tool: 'Bash', target: 'make' }, 7);
  assert.equal(headline(run), 'Claude edited 3 files (a.js, b.js, +1), ran npm + git + make, and read 1 file.');
});

test('durations are short and readable', () => {
  assert.deepEqual([4_000, 65_000, 3_725_000].map(duration), ['4s', '1m 05s', '1h 02m']);
});

test('started opens a run, tools fill it, done files it away as a recap', () => {
  const { ctx, clock, send } = make();
  send({ type: 'started' });
  clock.t += 5_000;
  send({ type: 'tool', tool: 'Edit', target: 'app.js' });
  send({ type: 'tool', tool: 'Bash', target: 'git' });
  assert.equal(ctx.state().live.length, 1);
  assert.equal(ctx.state().live[0].calls, 2);
  assert.equal(ctx.state().live[0].events[0].tool, 'Bash', 'newest event first');
  clock.t += 55_000;
  send({ type: 'done' });
  const s = ctx.state();
  assert.equal(s.live.length, 0);
  assert.equal(s.recent.length, 1);
  assert.equal(s.recent[0].durationMs, 60_000);
  assert.match(s.recent[0].headline, /edited 1 file \(app\.js\) and ran git/);
});

test('waiting is recorded, and the next tool call means it is running again', () => {
  const { ctx, send } = make();
  send({ type: 'started' });
  send({ type: 'waiting', message: 'Claude needs your permission to use Bash' });
  assert.equal(ctx.state().live[0].status, 'waiting');
  assert.equal(ctx.state().live[0].waits, 1);
  send({ type: 'tool', tool: 'Bash', target: 'npm' });
  assert.equal(ctx.state().live[0].status, 'running');
});

test('a run with no tool calls is not worth a recap', () => {
  const { ctx, send } = make();
  send({ type: 'started' });
  send({ type: 'done' });
  assert.equal(ctx.state().recent.length, 0);
});

test('a new prompt in the same session closes the previous run', () => {
  const { ctx, send } = make();
  send({ type: 'started' });
  send({ type: 'tool', tool: 'Read', target: 'a' });
  send({ type: 'started' });
  assert.equal(ctx.state().recent.length, 1);
  assert.equal(ctx.state().live.length, 1);
});

test('only the latest runs are kept, and clear empties them', () => {
  const { ctx, send } = make();
  for (let i = 0; i < 20; i++) {
    send({ type: 'started' });
    send({ type: 'tool', tool: 'Read', target: String(i) });
    send({ type: 'done' });
  }
  assert.equal(ctx.state().recent.length, 8, 'the view shows the latest eight');
  assert.equal(ctx.clear().recent.length, 0);
});

test('works when the core wrote a bare record first', () => {
  const { ctx, store } = make();
  store.enabled = false;
  assert.equal(ctx.state().enabled, false);
});
