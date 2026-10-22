import test from 'node:test';
import assert from 'node:assert/strict';
import { report, insight, formatMinutes } from './report.js';

const MIN = 60_000;
/** Build `n` days ending today, each with the given minutes (oldest first). */
const days = (mins, runs = 1) => mins.map((m, i) => ({ day: `2026-06-${String(i + 1).padStart(2, '0')}`, waitMs: m * MIN, runs: m ? runs : 0 }));

test('minutes are shown the way people say them', () => {
  assert.deepEqual([0, 5, 59.6, 60, 125].map(formatMinutes), ['0 min', '5 min', '1 h 00 min', '1 h 00 min', '2 h 05 min']);
  assert.equal(formatMinutes(0.4), '<1 min', 'a real wait is never shown as zero');
});

test('totals, runs and the average per run add up', () => {
  const r = report(days([10, 20, 0, 30]));
  assert.equal(r.totalMinutes, 60);
  assert.equal(r.runs, 3);
  assert.equal(r.averagePerRun, 20);
});

test('this week and last week are the latest seven days and the seven before', () => {
  const r = report(days([...Array(7).fill(10), ...Array(7).fill(20)]));
  assert.equal(r.lastWeek, 70);
  assert.equal(r.thisWeek, 140);
  assert.deepEqual(r.trend, { pct: 100, direction: 'more' });
  const less = report(days([...Array(7).fill(20), ...Array(7).fill(10)]));
  assert.deepEqual(less.trend, { pct: -50, direction: 'less' });
});

test('no trend is claimed until there is a previous week to compare with', () => {
  assert.equal(report(days([10, 10, 10, 10, 10, 10, 10])).trend, null);
  assert.equal(report(days([...Array(7).fill(0), ...Array(7).fill(5)])).trend, null, 'last week was zero, so a percentage would be meaningless');
});

test('the busiest day is the one with the most waiting, or none at all', () => {
  assert.deepEqual(report(days([5, 40, 12])).busiest, { day: '2026-06-02', minutes: 40 });
  assert.equal(report(days([0, 0, 0])).busiest, null);
});

test('equivalents are rounded down and never invented from nothing', () => {
  const r = report(days([...Array(7).fill(0), ...Array(6).fill(0), 31]));
  assert.deepEqual(r.equivalents, { walks: 6, reads: 5, eyeRests: 93 });
  assert.deepEqual(report(days([0, 0])).equivalents, { walks: 0, reads: 0, eyeRests: 0 });
});

test('the insight sentence is plain and honest', () => {
  assert.match(insight(report(days([0, 0]))), /No agent runs recorded yet/);
  assert.equal(insight(report(days([30, 30, 0, 0, 0, 0, 0]))), 'You waited 1 h 00 min on agents in the last 7 days.');
  assert.equal(insight(report(days([...Array(7).fill(10), ...Array(7).fill(20)]))), 'You waited 2 h 20 min in the last 7 days, 100% more than the week before.');
  assert.equal(insight(report(days([...Array(14).fill(10)]))), 'You waited 1 h 10 min in the last 7 days, the same as the week before.');
});

test('an empty range does not divide by zero', () => {
  const r = report([]);
  assert.equal(r.averagePerRun, 0);
  assert.equal(r.totalMinutes, 0);
  assert.equal(r.trend, null);
});
