import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Qeuli was first called AgentWell. Someone who already has ~/.agentwell keeps using it, so nothing
// is lost or moved; a fresh install starts in ~/.qeuli.
const legacyDir = path.join(os.homedir(), '.agentwell');
const newDir = path.join(os.homedir(), '.qeuli');
export const DATA_DIR = process.env.QEULI_HOME || (!fs.existsSync(newDir) && fs.existsSync(legacyDir) ? legacyDir : newDir);
const FILE = path.join(DATA_DIR, 'data.json');
const BACKUP = `${FILE}.bak`;
const BACKUP_EVERY_MS = 10 * 60_000;

const empty = () => ({ queue: [], learned: [], days: {}, modules: {} });
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * Load saved data. A file that exists but cannot be read is never thrown away silently: it is kept
 * as data.json.corrupt-<time>, and we fall back to the last backup before starting empty.
 */
function load() {
  if (!fs.existsSync(FILE)) return empty();
  try {
    return { ...empty(), ...read(FILE) };
  } catch {
    try {
      fs.copyFileSync(FILE, `${FILE}.corrupt-${Date.now()}`);
    } catch {}
    try {
      return { ...empty(), ...read(BACKUP) };
    } catch {
      return empty();
    }
  }
}

export function loadStore() {
  const data = load();
  let timer = null;
  let dirty = false;
  let lastBackup = 0;

  /** Write to a temp file, then rename over the real one, so a kill mid-write cannot leave half a file. */
  const flush = () => {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    if (fs.existsSync(FILE) && Date.now() - lastBackup > BACKUP_EVERY_MS) {
      try {
        fs.copyFileSync(FILE, BACKUP);
        lastBackup = Date.now();
      } catch {}
    }
    fs.renameSync(tmp, FILE);
  };

  const save = () => {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 150);
  };

  // A normal exit or Ctrl+C should never drop a pending write.
  process.on('exit', flush);
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      flush();
      process.exit(0);
    });
  }

  return { data, save, flush };
}
