import { localDay } from '../src/time.js';

// The daily riddle is the only thing that needs remembering: which days you solved, and the streak.
// `store` is this feature's own persisted record; the core hands it in.
export function createFun({ store, save, now = Date.now }) {
  const w = () => {
    store.enabled ??= true;
    store.solved ??= []; // local days (YYYY-MM-DD) with a solved riddle, newest last
    return store;
  };
  const dayAgo = (t, i) => {
    const d = new Date(t);
    d.setDate(d.getDate() - i);
    return localDay(d.getTime());
  };

  function state() {
    const t = now();
    const days = new Set(w().solved);
    let streak = 0;
    for (let i = days.has(localDay(t)) ? 0 : 1; days.has(dayAgo(t, i)); i++) streak++;
    return { enabled: w().enabled, today: localDay(t), solvedToday: days.has(localDay(t)), streak, totalSolved: days.size };
  }

  /** Mark today's riddle solved. `first` is true only the first time each day, so XP is not repeatable. */
  function solve() {
    const today = localDay(now());
    const first = !w().solved.includes(today);
    if (first) {
      w().solved.push(today);
      if (w().solved.length > 400) w().solved.splice(0, w().solved.length - 400);
      save();
    }
    return { ...state(), first };
  }

  return { state, solve };
}
