import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import notifier from 'node-notifier';

// Source checkout keeps the icon in extension/; the desktop bundle puts it next to the daemon.
const ICON = [process.env.QEULI_ICON, fileURLToPath(new URL('../extension/icon.png', import.meta.url)), fileURLToPath(new URL('./icon.png', import.meta.url))]
  .find((p) => p && fs.existsSync(p));
// A bundled daemon cannot find node-notifier's vendored toast helper, so the app passes its path.
const SNORETOAST = process.env.QEULI_SNORETOAST;
let toaster;
const enabled = () => process.env.QEULI_NOTIFY !== '0';

const names = { 'claude-code': 'Claude', codex: 'Codex', cli: 'Your command' };

export function notify(title, message) {
  if (!enabled()) return;
  toaster ??= SNORETOAST && process.platform === 'win32' ? new notifier.WindowsToaster({ withFallback: false, customPath: SNORETOAST }) : notifier;
  toaster.notify({ title, message, icon: ICON, appID: 'Qeuli' }, () => {});
}

/** Turn a state change into a notification. `ranMs` is how long the run lasted (for "done"). */
export function notifyEvent({ type, source, cwd, message, name }, ranMs = 0, prefs = {}) {
  if (prefs[type] === false) return;
  const who = name || names[source] || 'Your agent';
  const where = cwd ? path.basename(cwd) : '';
  const suffix = where ? ` in ${where}` : '';

  if (type === 'started') notify(`${who} is working`, `Running${suffix}. Good time for a break or a read.`);
  else if (type === 'waiting') notify(`${who} needs you`, message || `Waiting for your input${suffix}.`);
  // Skip "done" for very short runs, they are just noise.
  else if (type === 'done' && ranMs >= 10_000) notify(`${who} is done`, `Finished${suffix}.`);
}
