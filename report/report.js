// Turn per-day wait stats into a readable report. Pure functions, no clock and no storage.
const MIN = 60_000;
const round1 = (n) => Math.round(n * 10) / 10;

export function formatMinutes(min) {
  if (min > 0 && min < 1) return '<1 min'; // never round a real wait down to "0 min"
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/**
 * `days` is oldest first, as [{ day, waitMs, runs }], the last entry being today.
 * Returns totals for the whole range and for the latest 7 days against the 7 before.
 */
export function report(days) {
  const rows = days.map((d) => ({ day: d.day, minutes: round1(d.waitMs / MIN), runs: d.runs }));
  const total = rows.reduce((n, r) => n + r.minutes, 0);
  const runs = rows.reduce((n, r) => n + r.runs, 0);
  const sum = (list) => round1(list.reduce((n, r) => n + r.minutes, 0));
  const thisWeek = sum(rows.slice(-7));
  const lastWeek = sum(rows.slice(-14, -7));
  const busiest = rows.reduce((best, r) => (r.minutes > (best?.minutes ?? 0) ? r : best), null);

  // The trend is only worth saying once there is a previous week to compare with.
  let trend = null;
  if (lastWeek > 0) {
    const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    trend = { pct, direction: pct > 0 ? 'more' : pct < 0 ? 'less' : 'same' };
  }

  return {
    days: rows,
    totalMinutes: round1(total),
    runs,
    averagePerRun: runs ? round1(total / runs) : 0,
    thisWeek,
    lastWeek,
    trend,
    busiest: busiest && busiest.minutes > 0 ? { day: busiest.day, minutes: busiest.minutes } : null,
    // What a week of waiting could have bought, in the units Qeuli knows about.
    equivalents: { walks: Math.floor(thisWeek / 5), reads: Math.floor(thisWeek / 6), eyeRests: Math.floor((thisWeek * 60) / 20) },
  };
}

/** One honest sentence for the top of the screen. */
export function insight(r) {
  if (!r.runs) return 'No agent runs recorded yet. Once your agent starts working, this fills in.';
  const week = formatMinutes(r.thisWeek);
  if (!r.trend) return `You waited ${week} on agents in the last 7 days.`;
  if (r.trend.direction === 'same') return `You waited ${week} in the last 7 days, the same as the week before.`;
  return `You waited ${week} in the last 7 days, ${Math.abs(r.trend.pct)}% ${r.trend.direction} than the week before.`;
}
