// Shared by the build (prepare.mjs) and the browser preview (preview.mjs).
// Features are top-level folders with a feature.json. This refreshes the static registry the daemon
// imports, copies each feature's ui/ next to the app's own, and collects the tray entries features declare.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { featureFolders } from '../../scripts/gen-registry.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Returns the tray entries found in every feature.json. */
export function stageFeatureUi() {
  execSync('node scripts/gen-registry.mjs', { cwd: root, stdio: 'inherit' });
  const out = path.join(root, 'desktop', 'ui', 'features');
  fs.rmSync(out, { recursive: true, force: true });
  const tray = [];
  for (const id of featureFolders()) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, id, 'feature.json'), 'utf8'));
    const uiDir = path.join(root, id, 'ui');
    if (fs.existsSync(uiDir)) fs.cpSync(uiDir, path.join(out, id), { recursive: true });
    for (const t of manifest.tray || []) tray.push({ feature: id, label: t.label, method: t.method, route: t.route });
  }
  return tray;
}
