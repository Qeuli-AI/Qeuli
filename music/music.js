export const SCAPES = ['tide', 'rain', 'focus', 'lofi', 'night'];

export const DEFAULTS = {
  scape: 'tide',
  volume: 0.5, // 0 to 1
  auto: false, // start when an agent starts working
  fade: true, // fade out when the agent needs you or finishes (only for sound that auto started)
};

const clampVolume = (v, fallback) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Math.round(Number(v) * 100) / 100)) : fallback);

/** Accept only known fields within sane ranges. */
export function sanitizeSettings(input = {}, prev = DEFAULTS) {
  return {
    scape: SCAPES.includes(input.scape) ? input.scape : prev.scape,
    volume: clampVolume(input.volume, prev.volume),
    auto: input.auto === undefined ? prev.auto : Boolean(input.auto),
    fade: input.fade === undefined ? prev.fade : Boolean(input.fade),
  };
}

// `store` is this feature's own persisted record; the core hands it in.
export function createMusic({ store, save }) {
  const w = () => {
    store.enabled ??= true;
    store.settings ??= { ...DEFAULTS };
    return store;
  };
  return {
    state: () => ({ enabled: w().enabled, settings: w().settings, scapes: SCAPES }),
    configure(input) {
      w().settings = sanitizeSettings(input, w().settings);
      save();
      return { enabled: w().enabled, settings: w().settings, scapes: SCAPES };
    },
  };
}
