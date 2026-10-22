import { localDay, hourOfDay, atHour } from '../src/time.js';

// What you drink from. Each has a fixed volume; "custom" uses whatever glassMl you set.
export const VESSELS = [
  { id: 'sip', name: 'Sip', ml: 100 },
  { id: 'cup', name: 'Cup', ml: 200 },
  { id: 'glass', name: 'Glass', ml: 250 },
  { id: 'mug', name: 'Mug', ml: 350 },
  { id: 'bottle', name: 'Bottle', ml: 500 },
  { id: 'flask', name: 'Large bottle', ml: 750 },
  { id: 'litre', name: 'Litre', ml: 1000 },
];

export const DEFAULTS = { weightKg: null, goalMl: 2500, vessel: 'glass', glassMl: 250, intervalMin: 120, startHour: 9, endHour: 22 };

const HISTORY_KEEP_DAYS = 400;

const MIN = 60_000;
const HEAVY_WAIT_MS = 90 * MIN; // a day with this much agent wait time counts as a heavy work day
const HEAVY_BONUS_ML = 250;
const WAIT_NUDGE_AFTER_MS = 45 * MIN; // nudge at run start only if you have not had water this long
const NUDGE_COOLDOWN_MS = 30 * MIN;
const RUN_SETTLE_MS = 20_000; // a run must still be going after this long before we nudge

const clamp = (v, min, max, fallback) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : fallback);

/** A known vessel fixes the volume; "custom" takes the typed volume. */
function vesselFields(input, prev) {
  let id = input.vessel ?? prev.vessel ?? 'custom';
  let known = VESSELS.find((v) => v.id === id);
  // A typed volume that does not match the vessel on file means the user went custom.
  if (input.vessel === undefined && input.glassMl !== undefined && known && Number(input.glassMl) !== known.ml) {
    id = 'custom';
    known = undefined;
  }
  if (known) return { vessel: known.id, glassMl: known.ml };
  return { vessel: 'custom', glassMl: clamp(input.glassMl, 50, 1000, prev.glassMl) };
}

/** Accept only known fields within sane ranges. */
export function sanitizeSettings(input = {}, prev = DEFAULTS) {
  const startHour = clamp(input.startHour, 0, 22, prev.startHour);
  return {
    weightKg: input.weightKg == null || input.weightKg === '' ? null : clamp(input.weightKg, 20, 300, prev.weightKg),
    goalMl: clamp(input.goalMl, 500, 8000, prev.goalMl),
    ...vesselFields(input, prev),
    intervalMin: clamp(input.intervalMin, 15, 480, prev.intervalMin),
    startHour,
    endHour: clamp(input.endHour, startHour + 1, 24, Math.max(prev.endHour, startHour + 1)),
  };
}

/** Rough guideline: about 35 ml per kg of body weight, rounded to 50 ml. Not medical advice. */
export const goalForWeight = (kg) => Math.round((kg * 35) / 50) * 50;

// `store` is this feature's own persisted record; the core hands it in, so Water never touches other data.
export function createWater({ store, save, notify, waitMsToday, isRunning, now = Date.now }) {
  // The features registry may have created a bare record (e.g. when toggling enabled), so fill any gaps.
  const w = () => {
    const m = store;
    m.enabled ??= true;
    m.settings ??= { ...DEFAULTS };
    // Settings saved before vessels existed: pick the matching vessel, else custom.
    m.settings.vessel ??= VESSELS.find((v) => v.ml === m.settings.glassMl)?.id ?? 'custom';
    m.log ??= [];
    m.lastNotifyAt ??= 0;
    return m;
  };
  const dayAgo = (t, i) => {
    const d = new Date(t);
    d.setDate(d.getDate() - i);
    return localDay(d.getTime());
  };
  const sum = (entries) => entries.reduce((n, e) => n + e.ml, 0);
  const inHours = (t) => {
    const { startHour, endHour } = w().settings;
    const h = hourOfDay(t);
    return h >= startHour && h < endHour;
  };

  function dayTotals(t) {
    const byDay = {};
    for (const e of w().log) byDay[localDay(e.t)] = (byDay[localDay(e.t)] || 0) + e.ml;
    return byDay;
  }

  function state() {
    const t = now();
    const { settings: s, enabled } = w();
    const today = w().log.filter((e) => localDay(e.t) === localDay(t));
    const drunkMl = sum(today);
    const heavy = waitMsToday() >= HEAVY_WAIT_MS;
    const goalMl = s.goalMl + (heavy ? HEAVY_BONUS_ML : 0);
    const lastAt = w().log.length ? w().log[w().log.length - 1].t : null;

    // Streak: consecutive days at or above the base goal, counting today only once it is met.
    const byDay = dayTotals(t);
    let streak = 0;
    for (let i = byDay[localDay(t)] >= s.goalMl ? 0 : 1; ; i++) {
      if ((byDay[dayAgo(t, i)] || 0) >= s.goalMl) streak++;
      else break;
    }

    let nextAt = null;
    if (enabled && drunkMl < goalMl) {
      const base = Math.max(lastAt ?? 0, w().lastNotifyAt, atHour(s.startHour, t));
      const candidate = base + s.intervalMin * MIN;
      if (candidate < atHour(s.endHour, t)) nextAt = Math.max(candidate, t);
    }

    return {
      enabled, settings: s, goalMl, bonusMl: heavy ? HEAVY_BONUS_ML : 0, drunkMl,
      glasses: Math.round((drunkMl / s.glassMl) * 10) / 10, streak, lastAt, nextAt,
      vessels: VESSELS,
      log: today.map((e) => ({ t: e.t, ml: e.ml, v: e.v })),
    };
  }

  function remainingText(st) {
    const left = Math.max(0, st.goalMl - st.drunkMl);
    return `${left} ml to go today. One glass is ${st.settings.glassMl} ml.`;
  }

  function drink(ml, vessel) {
    const before = state();
    const amount = clamp(ml ?? before.settings.glassMl, 10, 2000, before.settings.glassMl);
    const v = VESSELS.some((x) => x.id === vessel) ? vessel : undefined;
    w().log.push({ t: now(), ml: amount, ...(v && { v }) });
    // Keep over a year of history for the daily view; drop anything older.
    const cutoff = now() - HISTORY_KEEP_DAYS * 86_400_000;
    w().log = w().log.filter((e) => e.t >= cutoff);
    save();
    const after = state();
    if (before.drunkMl < before.goalMl && after.drunkMl >= after.goalMl) notify('Water goal reached', `${after.drunkMl} ml today. Nicely done.`);
    return after;
  }

  function undo() {
    const log = w().log;
    if (log.length && localDay(log[log.length - 1].t) === localDay(now())) {
      log.pop();
      save();
    }
    return state();
  }

  function configure(input) {
    w().settings = sanitizeSettings(input, w().settings);
    save();
    return state();
  }

  /** Called every minute: the plain "every N minutes" reminder. */
  function tick() {
    const st = state();
    const t = now();
    if (!st.enabled || !inHours(t) || st.drunkMl >= st.goalMl) return;
    const base = Math.max(st.lastAt ?? 0, w().lastNotifyAt, atHour(st.settings.startHour, t));
    if (t - base >= st.settings.intervalMin * MIN) {
      w().lastNotifyAt = t;
      save();
      notify('Time for water', remainingText(st));
    }
  }

  /** An agent run just started: if you are due, nudge once it is clear the wait is real. */
  function onRunStart(session, name) {
    setTimeout(() => {
      const st = state();
      const t = now();
      if (!st.enabled || !isRunning(session) || !inHours(t) || st.drunkMl >= st.goalMl) return;
      if (t - (st.lastAt ?? 0) < WAIT_NUDGE_AFTER_MS || t - w().lastNotifyAt < NUDGE_COOLDOWN_MS) return;
      w().lastNotifyAt = t;
      save();
      notify('Good moment for water', `${name || 'Your agent'} is working. ${remainingText(st)}`);
    }, RUN_SETTLE_MS).unref?.();
  }

  /** Per-day totals for the last `days` local days, oldest first, zero days included. */
  function history(days = 30) {
    const t = now();
    const n = clamp(days, 1, 365, 30);
    const byDay = dayTotals(t);
    const goalMl = w().settings.goalMl;
    const list = [];
    for (let i = n - 1; i >= 0; i--) {
      const day = dayAgo(t, i);
      list.push({ day, ml: byDay[day] || 0, reached: (byDay[day] || 0) >= goalMl });
    }
    const logged = list.filter((d) => d.ml > 0);
    return {
      goalMl,
      days: list,
      averageMl: logged.length ? Math.round(sum(logged) / logged.length) : 0,
      bestMl: Math.max(0, ...list.map((d) => d.ml)),
      reachedDays: list.filter((d) => d.reached).length,
    };
  }

  return { state, drink, undo, configure, tick, onRunStart, history };
}
