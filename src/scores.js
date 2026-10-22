// Best scores for a set of games, shared by every game feature (Arcade, Typing, Memory...).
// The games themselves run in the app window; this only keeps the numbers.
//
// `games` is { id: { name, better: 'higher' | 'lower', unit } }. Each game also keeps a best per
// "variant": the options it was played with (board size, speed...), so a best on an easy setting is
// never compared with a best on a hard one.

const MAX_SCORE = 10_000_000;
export const MAX_VARIANTS = 120; // per game: comfortably above every real option combination, so this only stops a runaway client
export const VARIANT = /^[a-z0-9\-/]{1,64}$/i; // no dots or underscores: no "__proto__", no path-like labels

// `store` is the feature's own persisted record; the core hands it in.
export function createScores({ games, store, save, now = Date.now }) {
  const w = () => {
    store.enabled ??= true;
    store.scores ??= {};
    return store;
  };

  function state() {
    const scores = {};
    for (const id of Object.keys(games)) {
      const s = w().scores[id] ?? {};
      scores[id] = { ...games[id], best: s.best ?? null, plays: s.plays ?? 0, lastAt: s.lastAt ?? null, variants: s.variants ?? {} };
    }
    return { enabled: w().enabled, scores, plays: Object.values(scores).reduce((n, s) => n + s.plays, 0) };
  }

  /** Record a finished game. Returns the new state plus whether it set a personal best for that variant. */
  function submit(game, score, variant = '') {
    if (!Object.hasOwn(games, game)) throw Object.assign(new Error(`unknown game "${game}"`), { status: 400 });
    const n = Number(score);
    if (!Number.isFinite(n) || n < 0 || n > MAX_SCORE) throw Object.assign(new Error('score out of range'), { status: 400 });
    const key = String(variant ?? '');
    if (key && !VARIANT.test(key)) throw Object.assign(new Error('bad options label'), { status: 400 });
    const value = Math.round(n);
    const rec = (w().scores[game] ??= { best: null, plays: 0 });
    // Own entries only: a label like "constructor" must never resolve to something inherited.
    const known = key && rec.variants && Object.hasOwn(rec.variants, key);
    if (key && !known && Object.keys(rec.variants ?? {}).length >= MAX_VARIANTS) throw Object.assign(new Error('too many option sets'), { status: 400 });

    // A zero is never a personal best (nobody should be congratulated for losing instantly).
    const better = (v, than) => (than === null ? v > 0 : games[game].better === 'higher' ? v > than : v < than);
    let beats = better(value, rec.best);
    if (beats) rec.best = value;
    if (key) {
      rec.variants ??= {};
      if (!known) rec.variants[key] = { best: null, plays: 0 };
      const v = rec.variants[key];
      beats = better(value, v.best);
      if (beats) v.best = value;
      v.plays += 1;
    }
    rec.plays += 1;
    rec.lastAt = now();
    save();
    return { ...state(), isBest: beats };
  }

  return { state, submit };
}

/**
 * The two routes every game feature serves, so a feature's backend is a few lines:
 *   export default gameBackend({ games })
 */
export function gameBackend({ games }) {
  return {
    setup(ctx) {
      const scores = createScores({ games, store: ctx.store, save: ctx.save, now: ctx.now });
      return {
        routes: {
          'GET state': () => scores.state(),
          'POST score': (body) => {
            const result = scores.submit(body.game, body.score, body.variant);
            ctx.award?.(3, 'game'); // playing counts; the core caps it so it cannot be farmed
            if (result.isBest) ctx.award?.(5, 'game-best');
            return result;
          },
        },
      };
    },
  };
}
