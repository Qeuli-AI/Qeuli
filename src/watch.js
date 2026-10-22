import { api } from './client.js';
import { createScanner } from './scanner.js';

const send = (session, name, type) =>
  api('/event', { source: 'process', type, session, name }).catch(() => {});

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM'; // exists, but owned by someone else
  }
}

/** Treat one existing PID as a run: started now, done when it exits. */
export async function watchPid(pid, name = `process ${pid}`) {
  if (!alive(pid)) {
    console.error(`No process with pid ${pid}`);
    process.exit(1);
  }
  const session = `pid-${pid}`;
  console.log(`Watching ${name}. Press Ctrl+C to stop.`);
  await send(session, name, 'started');
  const timer = setInterval(async () => {
    if (alive(pid)) return;
    clearInterval(timer);
    await send(session, name, 'done');
    console.log(`${name} exited.`);
    process.exit(0);
  }, 2000);
}

/** Watch for any process whose command line contains `pattern` (many workers count as one run). */
export function watchMatch(pattern, name = pattern, exe) {
  console.log(`Waiting for a process matching "${pattern}". Press Ctrl+C to stop.`);
  const cfg = { scanSeconds: 5, minSeconds: 0, graceSeconds: 10, watches: [{ name, match: pattern, exe }] };
  createScanner(
    () => cfg,
    ({ type, session, name: n }) => {
      console.log(type === 'started' ? 'Detected, tracking.' : 'Finished.');
      return send(session, n, type);
    },
  ).start();
}
