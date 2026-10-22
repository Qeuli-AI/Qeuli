import { localDay, hourOfDay, atHour } from '../src/time.js';

// The kinds of break. `seconds` is how long the guided session runs; `every` is the default reminder gap.
export const KINDS = {
  eyes: { name: 'Eye rest', seconds: 20, every: 20, text: 'Look at something 20 feet away for 20 seconds.' },
  stretch: { name: 'Stretch', seconds: 60, every: 60, text: 'Roll your shoulders, then stretch your neck and wrists.' },
  walk: { name: 'Walk', seconds: 300, every: 120, text: 'Stand up and walk for a few minutes.' },
  breathe: { name: 'Breathe', seconds: 64, every: 0, text: 'Four slow breaths: in 4, hold 4, out 4, hold 4.' },
};
const IDS = Object.keys(KINDS);

export const DEFAULTS = {
  goal: 8, // breaks a day that count as a good day
  startHour: 9,
  endHour: 20,
  kinds: {
    eyes: { on: true, every: 20 },
    stretch: { on: true, every: 60 },
    walk: { on: true, every: 120 },
    breathe: { on: false, every: 0 },
  },
};

const MIN = 60_000;
const RUN_SETTLE_MS = 20_000; // a run must still be going this long before we nudge
const NUDGE_COOLDOWN_MS = 10 * MIN; // at most one break nudge in this window
const WAIT_NUDGE_AFTER = { eyes: 15 * MIN, stretch: 45 * MIN }; // nudge at run start only if you are this overdue
const KEEP_DAYS = 400;

const clamp = (v, min, max, fallback) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : fallback);

/** Accept only known fields within sane ranges. */
export function sanitizeSettings(input = {}, prev = DEFAULTS) {
  const startHour = clamp(input.startHour, 0, 22, prev.startHour);
  const kinds = {};
  for (const id of IDS) {
    const p = prev.kinds?.[id] ?? DEFAULTS.kinds[id];
    const i = input.kinds?.[id] ?? {};
    const on = i.on === undefined ? p.on : Boolean(i.on);
    // A reminder gap of 0 means "no reminders", which is only meaningful for kinds that default to it.
    kinds[id] = { on, every: clamp(i.every, 10, 480, p.every || 45) };
  }
  return {
    goal: clamp(input.goal, 1, 40, prev.goal),
    startHour,
    endHour: clamp(input.endHour, startHour + 1, 24, Math.max(prev.endHour, startHour + 1)),
    kinds,
  };
}

// `store` is this feature's own persisted record; the core hands it in.
export function createBreaks({ store, save, notify, isRunning, now = Date.now }) {
  const w = () => {
    store.enabled ??= true;
    store.settings ??= structuredClone(DEFAULTS);
    store.log ??= [];
    store.lastNotify ??= {};
    return store;
  };
  const dayAgo = (t, i) => {
    const d = new Date(t);
    d.setDate(d.getDate() - i);
    return localDay(d.getTime());
  };
  const inHours = (t) => {
    const h = hourOfDay(t);
    return h >= w().settings.startHour && h < w().settings.endHour;
  };
  const lastTaken = (kind) => {
    const log = w().log;
    for (let i = log.length - 1; i >= 0; i--) if (log[i].kind === kind) return log[i].t;
    return 0;
  };
  const lastAnyNotify = () => Math.max(0, ...Object.values(w().lastNotify));

  function state() {
    const t = now();
    const { settings: s, enabled } = w();
    const today = w().log.filter((e) => localDay(e.t) === localDay(t));
    const total = today.length;

    const byDay = {};
    for (const e of w().log) byDay[localDay(e.t)] = (byDay[localDay(e.t)] || 0) + 1;
    let streak = 0;
    for (let i = (byDay[localDay(t)] || 0) >= s.goal ? 0 : 1; ; i++) {
      if ((byDay[dayAgo(t, i)] || 0) >= s.goal) streak++;
      else break;
    }

    const kinds = IDS.map((id) => {
      const k = s.kinds[id];
      const taken = lastTaken(id);
      let nextAt = null;
      if (enabled && k.on && k.every > 0) {
        const base = Math.max(taken, w().lastNotify[id] ?? 0, atHour(s.startHour, t));
        const candidate = base + k.every * MIN;
        if (candidate < atHour(s.endHour, t)) nextAt = Math.max(candidate, t);
      }
      return { id, ...KINDS[id], on: k.on, every: k.every, count: today.filter((e) => e.kind === id).length, lastAt: taken || null, nextAt };
    });

    return { enabled, settings: s, total, goal: s.goal, streak, kinds, log: today.map((e) => ({ t: e.t, kind: e.kind })) };
  }

  function take(kind = 'eyes') {
    if (!KINDS[kind]) throw Object.assign(new Error(`unknown break "${kind}" (use ${IDS.join(', ')})`), { status: 400 });
    const before = state();
    w().log.push({ t: now(), kind });
    const cutoff = now() - KEEP_DAYS * 86_400_000;
    w().log = w().log.filter((e) => e.t >= cutoff);
    save();
    const after = state();
    if (before.total < before.goal && after.total >= after.goal) notify('Break goal reached', `${after.total} breaks today. Your eyes and back thank you.`);
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

  function history(days = 14) {
    const t = now();
    const n = clamp(days, 1, 365, 14);
    const list = [];
    for (let i = n - 1; i >= 0; i--) {
      const day = dayAgo(t, i);
      const entries = w().log.filter((e) => localDay(e.t) === day);
      const byKind = Object.fromEntries(IDS.map((id) => [id, entries.filter((e) => e.kind === id).length]));
      list.push({ day, total: entries.length, byKind, reached: entries.length >= w().settings.goal });
    }
    return { goal: w().settings.goal, days: list };
  }

  function nudge(id, title, body) {
    w().lastNotify[id] = now();
    save();
    notify(title, body);
  }

  /** Once a minute: the plain "every N minutes" reminders, one at a time. */
  function tick() {
    const t = now();
    const { settings: s, enabled } = w();
    if (!enabled || !inHours(t) || t - lastAnyNotify() < NUDGE_COOLDOWN_MS) return;
    for (const id of IDS) {
      const k = s.kinds[id];
      if (!k.on || !(k.every > 0)) continue;
      const base = Math.max(lastTaken(id), w().lastNotify[id] ?? 0, atHour(s.startHour, t));
      if (t - base >= k.every * MIN) {
        nudge(id, `${KINDS[id].name} break`, KINDS[id].text);
        return; // never more than one at a time
      }
    }
  }

  /** An agent run just started: if you are overdue for a break, offer one once the wait is real. */
  function onRunStart(session, name) {
    setTimeout(() => {
      const t = now();
      const { enabled, settings: s } = w();
      if (!enabled || !isRunning(session) || !inHours(t) || t - lastAnyNotify() < NUDGE_COOLDOWN_MS) return;
      for (const id of Object.keys(WAIT_NUDGE_AFTER)) {
        if (!s.kinds[id].on || t - lastTaken(id) < WAIT_NUDGE_AFTER[id]) continue;
        nudge(id, 'Good moment for a break', `${name || 'Your agent'} is working. ${KINDS[id].text}`);
        return;
      }
    }, RUN_SETTLE_MS).unref?.();
  }

  return { state, take, undo, configure, history, tick, onRunStart };
}
