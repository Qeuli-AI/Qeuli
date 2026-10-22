// Stages everything the installer needs, so the app is one download with no Node or npm required:
//   src-tauri/daemon/qeuli.mjs   the daemon + CLI + MCP server, bundled into one file
//   src-tauri/daemon/snoretoast-*.exe  Windows toast helper used by node-notifier
//   src-tauri/daemon/icon.png          notification icon
//   src-tauri/binaries/node-<triple>   the Node runtime that runs the daemon (Tauri sidecar)
//   ui/features/<id>/                  each feature folder's ui/ (the app loads these at runtime)
//   src-tauri/daemon/tray.json         tray menu entries collected from every feature.json
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { featureFolders } from '../../scripts/gen-registry.mjs';
import { stageFeatureUi } from './stage-ui.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tauri = path.join(root, 'desktop', 'src-tauri');
const daemonDir = path.join(tauri, 'daemon');
const binDir = path.join(tauri, 'binaries');
fs.mkdirSync(daemonDir, { recursive: true });
fs.mkdirSync(binDir, { recursive: true });

// Refresh the registry, copy each feature's UI next to the app's, and collect the tray entries.
const tray = stageFeatureUi();
fs.writeFileSync(path.join(daemonDir, 'tray.json'), JSON.stringify(tray, null, 2));

// node-notifier is CommonJS and uses require/__dirname, which do not exist in an ES module bundle.
const banner = `import { createRequire as __cr } from 'node:module';
import { fileURLToPath as __fu } from 'node:url';
import { dirname as __dn } from 'node:path';
const require = __cr(import.meta.url);
const __filename = __fu(import.meta.url);
const __dirname = __dn(__filename);`;

await build({
  entryPoints: [path.join(root, 'src', 'cli.js')],
  outfile: path.join(daemonDir, 'qeuli.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  minify: true,
  banner: { js: banner },
  logLevel: 'info',
});

const vendor = path.join(root, 'node_modules', 'node-notifier', 'vendor', 'snoreToast');
for (const f of ['snoretoast-x64.exe']) fs.copyFileSync(path.join(vendor, f), path.join(daemonDir, f));
fs.copyFileSync(path.join(root, 'extension', 'icon.png'), path.join(daemonDir, 'icon.png'));

const triple = execSync('rustc -vV').toString().match(/host: (.+)/)[1].trim();
const ext = process.platform === 'win32' ? '.exe' : '';
fs.copyFileSync(process.execPath, path.join(binDir, `node-${triple}${ext}`));
console.log(`staged daemon bundle, ${featureFolders().length} feature(s), toast helper, icon, and node sidecar (${triple})`);
