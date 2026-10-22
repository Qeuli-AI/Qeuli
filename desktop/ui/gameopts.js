// The options a game offers, and the small rules around them. Pure, so it can be tested.
//
// A feature describes its options as { gameId: [option, ...] } where an option is
//   { id, label, def, choices: [[value, label], ...], cosmetic?, when? }
// `cosmetic` options change how a game looks, not how it plays, so they never split the scores.
// `when` hides an option unless other options have the named values.

export function createOptions(OPTIONS) {
  /** The saved choice for each option of a game, falling back to the default if it is missing or unknown. */
  function chosen(id, saved) {
    const out = {};
    for (const o of OPTIONS[id]) {
      const v = saved?.[id]?.[o.id];
      out[o.id] = o.choices.some(([c]) => c === v) ? v : o.def;
    }
    return out;
  }

  const shown = (o, opts) => !o.when || Object.entries(o.when).every(([k, v]) => opts[k] === v);
  const visible = (id, opts) => OPTIONS[id].filter((o) => shown(o, opts));

  /** The label the daemon files a score under: the visible options that change how the game plays. */
  const variantOf = (id, opts) => visible(id, opts).filter((o) => !o.cosmetic).map((o) => `${o.id}-${opts[o.id]}`).join('/');

  /** "Large · Fast · Wrap around": the settings in words, for the strip above a running game. */
  const describe = (id, opts) => visible(id, opts).filter((o) => !o.cosmetic).map((o) => o.choices.find(([v]) => v === opts[o.id])[1]).join(' · ');

  /** Every combination of every option, as option objects (used by tests). */
  function* allSettings(id) {
    const options = OPTIONS[id];
    const walk = function* (i, opts) {
      if (i === options.length) {
        yield { ...opts };
        return;
      }
      for (const [value] of options[i].choices) yield* walk(i + 1, { ...opts, [options[i].id]: value });
    };
    yield* walk(0, {});
  }

  return { chosen, shown, visible, variantOf, describe, allSettings };
}
