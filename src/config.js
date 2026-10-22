import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.js';

export const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const DEFAULTS = {
  scanSeconds: 10, // how often to look for new matching processes
  minSeconds: 15, // a process must run this long before it counts as a run
  graceSeconds: 10, // how long it may disappear before the run counts as finished
  watches: [],
  notify: { started: true, waiting: true, done: true }, // per-event toggles
};

const num = (v, min, max, fallback) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback);

/** Accept only the fields we know, so the UI cannot write arbitrary keys. */
export function sanitizeConfig(input) {
  const str = (v) => (typeof v === 'string' ? v.trim().slice(0, 200) : '');
  const watches = (Array.isArray(input.watches) ? input.watches : [])
    .map((w) => ({ name: str(w.name) || str(w.match), match: str(w.match), ...(str(w.exe) && { exe: str(w.exe) }) }))
    .filter((w) => w.match)
    .slice(0, 50);
  const n = input.notify || {};
  return {
    scanSeconds: num(input.scanSeconds, 3, 300, DEFAULTS.scanSeconds),
    minSeconds: num(input.minSeconds, 0, 3600, DEFAULTS.minSeconds),
    graceSeconds: num(input.graceSeconds, 0, 600, DEFAULTS.graceSeconds),
    watches,
    notify: { started: n.started !== false, waiting: n.waiting !== false, done: n.done !== false },
  };
}

export function readConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

/** Config getter that only re-parses the file when it changes on disk. */
export function liveConfig() {
  let mtime = -1;
  let cfg = readConfig();
  return () => {
    try {
      const m = fs.statSync(CONFIG_FILE).mtimeMs;
      if (m !== mtime) {
        mtime = m;
        cfg = readConfig();
      }
    } catch {
      cfg = readConfig();
    }
    return cfg;
  };
}
