import { localDay } from './time.js';

// Your character. Created during first-run, edited any time under Settings, and levelled up by looking
// after yourself: features call ctx.award(xp, reason) and the story chapters unlock as XP grows.

export const SIGILS = ['hawk', 'wave', 'ember', 'moss', 'volt', 'dusk'];
export const ROLES = ['Builder', 'Tinkerer', 'Architect', 'Explorer', 'Maker', 'Debugger'];
export const QUESTS = ['Ship the thing', 'Learn deeply', 'Build in public', 'Stay healthy', 'Find calm'];
export const VIBES = ['Calm', 'Bold', 'Playful', 'Focused'];

const MAX_XP_LOG = 200;
const PER_REASON_DAILY_CAP = 12; // awards per reason per day, so nothing can be farmed
// Plain text only: drop control characters and anything that looks like an HTML tag.
const clean = (v, max) => (typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : '');
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);

/** XP needed to *reach* a level: level 1 at 0, level 2 at 25, level 3 at 100, level 4 at 225, ... */
export const xpForLevel = (level) => 25 * (level - 1) ** 2;
export const levelForXp = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1;

export const emptyProfile = () => ({
  onboarded: false,
  name: '',
  character: { sigil: 'hawk', role: 'Builder', quest: 'Ship the thing', vibe: 'Calm', origin: '' },
  xp: 0,
  log: [],
  daily: {},
});

/** Keep only known fields within sane limits. */
export function sanitizeProfile(input = {}, prev = emptyProfile()) {
  const c = input.character ?? {};
  const p = prev.character ?? emptyProfile().character;
  return {
    ...prev,
    onboarded: input.onboarded === undefined ? prev.onboarded : Boolean(input.onboarded),
    name: input.name === undefined ? prev.name : clean(input.name, 24),
    character: {
      sigil: pick(c.sigil ?? p.sigil, SIGILS, 'hawk'),
      role: pick(c.role ?? p.role, ROLES, 'Builder'),
      quest: pick(c.quest ?? p.quest, QUESTS, 'Ship the thing'),
      vibe: pick(c.vibe ?? p.vibe, VIBES, 'Calm'),
      origin: c.origin === undefined ? p.origin : clean(c.origin, 140),
    },
  };
}

export function createProfile({ data, save, now = Date.now }) {
  const get = () => {
    data.profile ||= emptyProfile();
    // fill anything a newer version added
    const base = emptyProfile();
    for (const k of Object.keys(base)) data.profile[k] ??= base[k];
    return data.profile;
  };

  function view() {
    const p = get();
    const level = levelForXp(p.xp);
    const from = xpForLevel(level);
    const to = xpForLevel(level + 1);
    return {
      onboarded: p.onboarded,
      name: p.name,
      character: p.character,
      xp: p.xp,
      level,
      levelFrom: from,
      levelTo: to,
      progress: (p.xp - from) / (to - from),
      recent: p.log.slice(-8).reverse(),
      options: { sigils: SIGILS, roles: ROLES, quests: QUESTS, vibes: VIBES },
    };
  }

  function configure(input) {
    data.profile = sanitizeProfile(input, get());
    save();
    return view();
  }

  /** Give XP for a healthy action. Returns what was granted (0 if the daily cap for that reason is hit). */
  function award(xp, reason = 'misc') {
    const p = get();
    const amount = Math.max(0, Math.min(25, Math.round(Number(xp) || 0)));
    const key = `${localDay(now())}:${String(reason).slice(0, 24)}`;
    p.daily[key] = (p.daily[key] || 0) + 1;
    // keep the cap table small: only today's keys survive
    for (const k of Object.keys(p.daily)) if (!k.startsWith(localDay(now()))) delete p.daily[k];
    if (!amount || p.daily[key] > PER_REASON_DAILY_CAP) return { granted: 0, ...view() };
    const before = levelForXp(p.xp);
    p.xp += amount;
    p.log.push({ t: now(), xp: amount, reason: String(reason).slice(0, 24) });
    if (p.log.length > MAX_XP_LOG) p.log.splice(0, p.log.length - MAX_XP_LOG);
    save();
    const v = view();
    return { granted: amount, leveledUp: v.level > before, ...v };
  }

  return { view, configure, award };
}
