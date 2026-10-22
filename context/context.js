// Context keeps a small, privacy-safe picture of what an agent has been doing.
// It only ever sees a tool name and a short target (a file's base name, a command's first word, a host),
// never contents, full paths, full commands or prompts. See src/hooks.js for what is let through.

const MAX_EVENTS = 60; // live feed length per run
const MAX_RUNS = 15; // finished runs kept
const MAX_LIST = 40; // distinct files / commands / hosts remembered per run

const EDIT = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SEARCH = new Set(['Grep', 'Glob']);
const WEB = new Set(['WebFetch', 'WebSearch']);

const base = (p) => (typeof p === 'string' ? (p.split(/[\\/]/).filter(Boolean).pop() ?? '') : '');
const add = (list, v) => {
  if (v && !list.includes(v) && list.length < MAX_LIST) list.push(v);
};

export function newRun({ session, name, cwd, t }) {
  return { id: `${session}:${t}`, session, name: name || 'Agent', project: base(cwd), startedAt: t, endedAt: null, status: 'running', message: '', waits: 0, calls: 0, counts: {}, edited: [], read: 0, commands: [], searched: 0, web: [], events: [] };
}

/** Fold one tool call into a run. */
export function record(run, { tool, target }, t) {
  run.calls += 1;
  run.status = 'running';
  run.counts[tool] = (run.counts[tool] || 0) + 1;
  if (EDIT.has(tool)) add(run.edited, target);
  else if (tool === 'Read') run.read += 1;
  else if (tool === 'Bash') add(run.commands, target);
  else if (SEARCH.has(tool)) run.searched += 1;
  else if (WEB.has(tool)) add(run.web, target || tool);
  run.events.push({ t, tool, target: target || '' });
  if (run.events.length > MAX_EVENTS) run.events.shift();
}

export function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Items inside one clause are joined with "+" (npm + git), so they never read like separate clauses.
const join = (items) => items.join(' + ');

/** A one-line, plain-English account of a run. */
export function headline(run) {
  const parts = [];
  if (run.edited.length) {
    const shown = run.edited.slice(0, 2).join(', ');
    parts.push(`edited ${plural(run.edited.length, 'file')} (${shown}${run.edited.length > 2 ? `, +${run.edited.length - 2}` : ''})`);
  }
  if (run.commands.length) parts.push(`ran ${join(run.commands.slice(0, 3))}`);
  if (run.read) parts.push(`read ${plural(run.read, 'file')}`);
  if (run.searched) parts.push(`searched ${plural(run.searched, 'time')}`);
  if (run.web.length) parts.push(`looked at ${join(run.web.slice(0, 2))}`);
  if (!parts.length) return `${run.name} was working, with no tool calls yet.`;
  const last = parts.pop();
  // One clause stands alone, two are joined with "and", three or more use an Oxford comma.
  const text = !parts.length ? last : parts.length === 1 ? `${parts[0]} and ${last}` : `${parts.join(', ')}, and ${last}`;
  return `${run.name} ${text}.`;
}

export function summarize(run, now) {
  const end = run.endedAt ?? now;
  return {
    id: run.id, name: run.name, project: run.project, status: run.status, message: run.message,
    startedAt: run.startedAt, endedAt: run.endedAt, durationMs: end - run.startedAt,
    calls: run.calls, waits: run.waits, edited: run.edited, read: run.read, commands: run.commands,
    headline: headline(run), counts: run.counts,
  };
}

// `store` is this feature's own persisted record; the core hands it in.
export function createContext({ store, save, now = Date.now }) {
  const live = new Map(); // session -> run (in memory: a restart simply starts fresh)
  const w = () => {
    store.enabled ??= true;
    store.runs ??= [];
    return store;
  };

  const runFor = (e) => {
    let run = live.get(e.session);
    if (!run) {
      run = newRun({ session: e.session, name: e.name || ({ 'claude-code': 'Claude', codex: 'Codex' })[e.source], cwd: e.cwd, t: now() });
      live.set(e.session, run);
    }
    return run;
  };

  function finish(session) {
    const run = live.get(session);
    if (!run) return;
    run.endedAt = now();
    run.status = 'done';
    live.delete(session);
    if (run.calls > 0) {
      w().runs.push(summarize(run, now()));
      if (w().runs.length > MAX_RUNS) w().runs.splice(0, w().runs.length - MAX_RUNS);
      save();
    }
  }

  function onEvent(e) {
    if (e.type === 'started') {
      finish(e.session); // a new prompt closes the previous run in the same session
      live.set(e.session, newRun({ session: e.session, name: e.name || ({ 'claude-code': 'Claude', codex: 'Codex' })[e.source], cwd: e.cwd, t: now() }));
    } else if (e.type === 'tool') {
      record(runFor(e), e, now());
    } else if (e.type === 'waiting') {
      const run = runFor(e);
      run.waits += 1;
      run.status = 'waiting';
      run.message = String(e.message || '').slice(0, 120);
    } else if (e.type === 'done') {
      finish(e.session);
    }
  }

  function state() {
    const t = now();
    return {
      enabled: w().enabled,
      live: [...live.values()].map((r) => ({ ...summarize(r, t), events: r.events.slice(-14).reverse() })),
      recent: w().runs.slice(-8).reverse(),
    };
  }

  function clear() {
    w().runs = [];
    save();
    return state();
  }

  return { onEvent, state, clear };
}
