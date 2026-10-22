import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const OPTS = { maxBuffer: 32 * 1024 * 1024, windowsHide: true };

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM'; // exists, owned by someone else
  }
};

const exeName = (s) => s.toLowerCase().replace(/\.exe$/, '');

// Our own helper processes carry the patterns in their command line; never count them.
const isSelf = (p) =>
  p.pid === process.pid ||
  /cli\.js (watch|daemon)/.test(p.cmd) ||
  p.cmd.includes('Get-CimInstance Win32_Process');

/** Cheap on Windows: image names only, no command lines. */
async function runningImages() {
  const { stdout } = await run('tasklist', ['/fo', 'csv', '/nh'], OPTS);
  return new Set(stdout.split('\n').map((l) => l.split('","')[0]?.replace(/^"/, '')).filter(Boolean).map(exeName));
}

/** Process list with command lines. On Windows `exes` limits the (slow) CIM query to those images. */
async function listProcesses(exes) {
  if (process.platform === 'win32') {
    const filter = exes ? ` -Filter "${exes.map((e) => `Name='${e}.exe'`).join(' OR ')}"` : '';
    const { stdout } = await run(
      'powershell',
      ['-NoProfile', '-Command', `Get-CimInstance Win32_Process${filter} | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress`],
      OPTS,
    );
    return [].concat(JSON.parse(stdout || '[]')).map((p) => ({ pid: p.ProcessId, cmd: p.CommandLine || '' }));
  }
  const { stdout } = await run('ps', ['-eo', 'pid=,args='], OPTS);
  return stdout.split('\n').filter(Boolean).map((line) => {
    const m = line.trim().match(/^(\d+)\s+(.*)$/);
    return { pid: Number(m[1]), cmd: m[2] };
  });
}

/**
 * Watches config entries { name, match, exe?, minSeconds?, graceSeconds? } and calls
 * emit({ type, session, name }) when each one starts and finishes.
 * `getConfig()` is re-read every scan so edits apply without a restart.
 */
export function createScanner(getConfig, emit) {
  const state = new Map(); // watch key -> { pids:Set, firstSeen, announced, emptySince }
  let scanTimer = null;
  let liveTimer = null;

  const keyOf = (w) => `watch-${(w.name || w.match).toLowerCase().replace(/\s+/g, '-')}`;

  async function scan() {
    const cfg = getConfig();
    const watches = cfg.watches || [];
    if (watches.length) {
      const everyHasExe = watches.every((w) => w.exe);
      let candidates = watches;
      let exes;
      if (process.platform === 'win32' && everyHasExe) {
        const images = await runningImages().catch(() => null);
        if (images) candidates = watches.filter((w) => images.has(exeName(w.exe)));
        exes = [...new Set(candidates.map((w) => exeName(w.exe)))];
      }
      if (candidates.length) {
        const procs = (await listProcesses(exes).catch(() => [])).filter((p) => !isSelf(p));
        for (const w of candidates) {
          const needle = w.match.toLowerCase();
          const hits = procs.filter((p) => p.cmd.toLowerCase().includes(needle)).map((p) => p.pid);
          if (!hits.length) continue;
          const s = state.get(keyOf(w)) || { pids: new Set(), firstSeen: Date.now(), announced: false, emptySince: null };
          hits.forEach((pid) => s.pids.add(pid));
          s.emptySince = null;
          state.set(keyOf(w), s);
        }
      }
    }
    ensureLive();
    schedule(cfg);
  }

  /** Cheap pass over known PIDs: announce after minSeconds, finish after graceSeconds of silence. */
  function live() {
    const cfg = getConfig();
    const now = Date.now();
    for (const [key, s] of state) {
      const w = (cfg.watches || []).find((x) => keyOf(x) === key);
      if (!w) {
        state.delete(key);
        continue;
      }
      for (const pid of s.pids) if (!alive(pid)) s.pids.delete(pid);

      if (s.pids.size) {
        s.emptySince = null;
        const minMs = (w.minSeconds ?? cfg.minSeconds ?? 15) * 1000;
        if (!s.announced && now - s.firstSeen >= minMs) {
          s.announced = true;
          emit({ type: 'started', session: key, name: w.name || w.match });
        }
      } else {
        s.emptySince ??= now;
        const graceMs = (w.graceSeconds ?? cfg.graceSeconds ?? 10) * 1000;
        if (now - s.emptySince >= graceMs) {
          if (s.announced) emit({ type: 'done', session: key, name: w.name || w.match });
          state.delete(key);
        }
      }
    }
    if (!state.size) {
      clearInterval(liveTimer);
      liveTimer = null;
    }
  }

  function ensureLive() {
    if (state.size && !liveTimer) liveTimer = setInterval(live, 2000);
  }

  function schedule(cfg) {
    scanTimer = setTimeout(() => scan().catch(() => schedule(getConfig())), (cfg.scanSeconds ?? 10) * 1000);
  }

  return {
    start() {
      scan().catch(() => schedule(getConfig()));
    },
    stop() {
      clearTimeout(scanTimer);
      clearInterval(liveTimer);
    },
  };
}
