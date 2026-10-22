import { spawn } from 'node:child_process';
import { HOST, PORT } from './daemon.js';

const BASE = `http://${HOST}:${PORT}`;
const CLI = process.argv[1];

async function raw(path, init) {
  const res = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(1500) });
  return res.json();
}

function spawnDaemon() {
  spawn(process.execPath, [CLI, 'daemon'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

/** Call the daemon, starting it in the background if it is not running yet. */
export async function api(path, body) {
  const init = body === undefined ? undefined : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
  try {
    return await raw(path, init);
  } catch {
    spawnDaemon();
    await new Promise((r) => setTimeout(r, 800));
    return raw(path, init);
  }
}
