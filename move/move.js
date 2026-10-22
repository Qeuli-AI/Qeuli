import { localDay } from '../src/time.js';
import { ROUTINES, routineList } from './routines.js';

export const DEFAULTS = { goalMin: 5 }; // minutes of movement that make a good day
const KEEP_DAYS = 400;
const clamp = (v, min, max, fallback) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : fallback);

export function sanitizeSettings(input = {}, prev = DEFAULTS) {
  return { goalMin: clamp(input.goalMin, 1, 120, prev.goalMin) };
}

// `store` is this feature's own persisted record; the core hands it in.
export function createMove({ store, save, now = Date.now }) {
  const w = () => {
    store.enabled ??= true;
    store.settings ??= { ...DEFAULTS };
    store.log ??= [];
    return store;
  };
  const dayAgo = (t, i) => {
    const d = new Date(t);
    d.setDate(d.getDate() - i);
    return localDay(d.getTime());
  };
  const minutesByDay = () => {
    const by = {};
    for (const e of w().log) by[localDay(e.t)] = (by[localDay(e.t)] || 0) + e.seconds;
    return by;
  };

  function state() {
    const t = now();
    const goalMin = w().settings.goalMin;
    const by = minutesByDay();
    const todaySeconds = by[localDay(t)] || 0;
    const met = (day) => (by[day] || 0) >= goalMin * 60;
    let streak = 0;
    for (let i = met(localDay(t)) ? 0 : 1; met(dayAgo(t, i)); i++) streak++;
    return {
      enabled: w().enabled,
      settings: w().settings,
      goalMin,
      todayMin: Math.round((todaySeconds / 60) * 10) / 10,
      streak,
      sessionsToday: w().log.filter((e) => localDay(e.t) === localDay(t)).length,
      routines: routineList(),
      log: w().log.filter((e) => localDay(e.t) === localDay(t)).map((e) => ({ t: e.t, routine: e.routine, seconds: e.seconds })),
    };
  }

  function done(routineId) {
    const routine = ROUTINES.find((r) => r.id === routineId);
    if (!routine) throw Object.assign(new Error(`unknown routine "${routineId}"`), { status: 400 });
    const seconds = routine.steps.reduce((n, s) => n + s.seconds, 0);
    w().log.push({ t: now(), routine: routine.id, seconds });
    const cutoff = now() - KEEP_DAYS * 86_400_000;
    w().log = w().log.filter((e) => e.t >= cutoff);
    save();
    return state();
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

  function history(days = 7) {
    const t = now();
    const n = clamp(days, 1, 365, 7);
    const by = minutesByDay();
    const goal = w().settings.goalMin * 60;
    const list = [];
    for (let i = n - 1; i >= 0; i--) {
      const day = dayAgo(t, i);
      list.push({ day, minutes: Math.round(((by[day] || 0) / 60) * 10) / 10, reached: (by[day] || 0) >= goal });
    }
    return { goalMin: w().settings.goalMin, days: list };
  }

  return { state, done, undo, configure, history };
}
