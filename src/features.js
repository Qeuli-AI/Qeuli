import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.js';
import { hourOfDay } from './time.js';
import { FEATURES } from './registry.js';

// Two kinds of feature:
//   built in   a top-level folder in the repo (water/, ...) with feature.json and optional backend + UI.
//              Listed in the generated src/registry.js. See README.md for the folder contract.
//   installed  a folder copied into ~/.qeuli/features/ containing only a feature.json that
//              declares reminders. It carries no code, so installing one can never run someone's code.
export const INSTALLED_DIR = path.join(DATA_DIR, 'features');

export const DIVISION_IDS = ['health', 'productivity', 'context', 'music', 'games', 'fun', 'activity', 'web'];

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Validate and normalise an installed feature's feature.json. */
export function validateManifest(m) {
  if (!m || typeof m !== 'object' || !ID.test(m.id || '')) throw new Error('feature.json needs an id like "stretch" (lowercase letters, digits, dashes)');
  if (FEATURES.some((f) => f.manifest.id === m.id)) throw new Error(`"${m.id}" is a built-in feature`);
  const reminders = (Array.isArray(m.reminders) ? m.reminders : []).slice(0, 10).map((r, i) => {
    const startHour = Math.min(23, Math.max(0, Math.round(Number(r.startHour ?? 9))));
    return {
      id: ID.test(r.id || '') ? r.id : `r${i}`,
      title: str(r.title, 80) || str(m.name, 80),
      message: str(r.message, 200),
      everyMinutes: Math.min(1440, Math.max(5, Math.round(Number(r.everyMinutes) || 60))),
      startHour,
      endHour: Math.min(24, Math.max(startHour + 1, Math.round(Number(r.endHour ?? 18)))),
    };
  });
  const division = DIVISION_IDS.includes(m.division) ? m.division : 'productivity';
  return { id: m.id, name: str(m.name, 60) || m.id, description: str(m.description, 300), version: str(m.version, 20) || '0.0.0', division, reminders };
}

export function loadInstalled() {
  let dirs = [];
  try {
    dirs = fs.readdirSync(INSTALLED_DIR);
  } catch {
    return [];
  }
  const found = [];
  for (const dir of dirs) {
    try {
      found.push(validateManifest(JSON.parse(fs.readFileSync(path.join(INSTALLED_DIR, dir, 'feature.json'), 'utf8'))));
    } catch {}
  }
  return found;
}

export function installFromFolder(folder) {
  const manifest = validateManifest(JSON.parse(fs.readFileSync(path.join(folder, 'feature.json'), 'utf8')));
  const dest = path.join(INSTALLED_DIR, manifest.id);
  fs.mkdirSync(dest, { recursive: true });
  // Only the validated manifest is copied; nothing else from the folder comes along.
  fs.writeFileSync(path.join(dest, 'feature.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

export function removeInstalled(id) {
  if (!ID.test(id)) throw new Error('bad id');
  fs.rmSync(path.join(INSTALLED_DIR, id), { recursive: true, force: true });
}

/** Manifests of built-in features, for callers that need metadata without a running daemon (CLI, build). */
export const builtinManifests = () => FEATURES.map((f) => f.manifest);

// Toasts from different features can fire at the same moment (e.g. when a run starts). Send the first
// right away and space the rest out, so they arrive one at a time instead of stacking.
const TOAST_GAP_MS = 6000;

export function createFeatures({ data, save, notify: rawNotify, waitMsToday, isRunning, now = Date.now, toastGapMs = TOAST_GAP_MS, award = () => {}, queueAdd = () => {}, waitHistory = () => [] }) {
  const pending = [];
  let draining = false;
  const drain = () => {
    const next = pending.shift();
    if (!next) {
      draining = false;
      return;
    }
    rawNotify(next.title, next.message);
    setTimeout(drain, toastGapMs).unref?.();
  };
  const notify = (title, message) => {
    pending.push({ title, message });
    if (!draining) {
      draining = true;
      drain();
    }
  };

  const rec = (id) => (data.modules[id] ||= {});
  const builtin = (id) => FEATURES.find((f) => f.manifest.id === id);

  const enabled = (id) => rec(id).enabled ?? builtin(id)?.manifest.defaultEnabled ?? false;

  // Each built-in feature gets its own data record, and can only notify while it is switched on.
  const runtime = {};
  for (const f of FEATURES) {
    if (!f.backend) continue;
    const id = f.manifest.id;
    runtime[id] = f.backend.setup({
      store: rec(id),
      save,
      notify: (title, message) => enabled(id) && notify(title, message),
      waitMsToday,
      isRunning,
      now,
      award, // award(xp, reason): XP toward the player's story
      queueAdd, // queueAdd({ url, title, minutes }): add to the reading queue
      waitHistory, // waitHistory(days): [{ day, waitMs, runs }] oldest first, today included
    });
  }

  function list() {
    const builtins = FEATURES.map(({ manifest }) => ({
      id: manifest.id, name: manifest.name, description: manifest.description, version: manifest.version,
      division: manifest.division || 'productivity', ui: manifest.ui, builtin: true,
    }));
    const installed = loadInstalled().map((m) => ({ id: m.id, name: m.name, description: m.description, version: m.version, division: m.division, ui: false, builtin: false }));
    return [...builtins, ...installed].map((m) => ({ ...m, enabled: enabled(m.id) }));
  }

  function setEnabled(id, on) {
    if (!list().some((m) => m.id === id)) throw new HttpError(404, 'unknown feature');
    rec(id).enabled = Boolean(on);
    save();
    return list();
  }

  /** Dispatch /features/<id>/<route> to the feature's backend. */
  function handle(id, method, route, body, query = {}) {
    const fn = runtime[id]?.routes?.[`${method} ${route}`];
    if (!fn) throw new HttpError(404, 'not found');
    return fn(body || {}, query);
  }

  /** Once a minute: built-in feature ticks, plus any installed reminder that is due. */
  function tick() {
    const t = now();
    for (const [id, r] of Object.entries(runtime)) if (enabled(id)) r.tick?.();

    const h = hourOfDay(t);
    for (const m of loadInstalled()) {
      if (!enabled(m.id)) continue;
      for (const r of m.reminders) {
        if (h < r.startHour || h >= r.endHour) continue;
        const last = (rec(m.id).last ||= {});
        // First sighting only starts the clock, so a newly installed feature never fires instantly.
        if (last[r.id] == null) {
          last[r.id] = t;
          continue;
        }
        if (t - last[r.id] >= r.everyMinutes * 60_000) {
          last[r.id] = t;
          save();
          notify(r.title, r.message);
        }
      }
    }
  }

  /** Forward agent events (started, done, ...) to enabled built-in features. */
  function onEvent(event) {
    for (const [id, r] of Object.entries(runtime)) if (enabled(id)) r.onEvent?.(event);
  }

  return { list, setEnabled, handle, tick, onEvent, enabled };
}
