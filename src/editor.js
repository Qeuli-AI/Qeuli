import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = os.homedir();
const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

// Cursor and VS Code keep extensions and user settings in predictable places.
const EDITORS = [
  { id: 'cursor', name: 'Cursor', ext: path.join(home, '.cursor', 'extensions'), settings: userSettings('Cursor') },
  { id: 'vscode', name: 'VS Code', ext: path.join(home, '.vscode', 'extensions'), settings: userSettings('Code') },
];

function userSettings(app) {
  const base =
    process.platform === 'win32' ? appData
    : process.platform === 'darwin' ? path.join(home, 'Library', 'Application Support')
    : path.join(home, '.config');
  return path.join(base, app, 'User', 'settings.json');
}

/** VS Code settings and themes are JSONC: comments and trailing commas are legal. */
export function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1 || text.length;
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

const readJsonc = (file) => parseJsonc(fs.readFileSync(file, 'utf8'));

/** Every color theme contributed by installed extensions, per editor. */
export function listEditorThemes() {
  const themes = [];
  for (const ed of EDITORS) {
    let dirs = [];
    try {
      dirs = fs.readdirSync(ed.ext);
    } catch {
      continue;
    }
    for (const dir of dirs) {
      try {
        const pkg = readJsonc(path.join(ed.ext, dir, 'package.json'));
        for (const t of pkg.contributes?.themes || []) {
          themes.push({
            editor: ed.id,
            label: t.label || t.id,
            type: t.uiTheme === 'vs' ? 'light' : 'dark',
            file: path.join(ed.ext, dir, t.path),
          });
        }
      } catch {}
    }
  }
  return themes;
}

/** The theme name each editor currently has selected (workbench.colorTheme). */
export function activeEditorThemes() {
  const active = {};
  for (const ed of EDITORS) {
    try {
      const s = readJsonc(ed.settings);
      if (s['workbench.colorTheme']) active[ed.id] = s['workbench.colorTheme'];
    } catch {}
  }
  return active;
}

/** Read a theme file, but only from inside an editor extensions directory. */
export function readEditorTheme(file) {
  const resolved = path.resolve(file);
  const ok = EDITORS.some((ed) => resolved.startsWith(path.resolve(ed.ext) + path.sep));
  if (!ok || !resolved.endsWith('.json')) throw new Error('not an editor theme file');
  return readJsonc(resolved);
}
