// Run the desktop UI in a normal browser, with its own daemon, without building the app.
//
//   npm run preview                 then open the printed address in Chrome
//   npm run preview -- --quiet      no desktop notifications
//   npm run preview -- --reset      start from empty data
//   npm run preview -- --port 47996 --ui 5174 --home D:\somewhere
//
// It is isolated on purpose: its own port, its own data folder, and its own copy of the Claude Code
// settings file, so it cannot disturb an installed Qeuli or change your real Claude Code hooks.
// Edit any file under desktop/ui, water/, breaks/ ... and refresh; run `npm run preview` again after
// adding or renaming a feature folder.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { root, stageFeatureUi } from './stage-ui.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const daemonPort = Number(opt('port', 47995));
const uiPort = Number(opt('ui', 5173));
const home = path.resolve(opt('home', path.join(os.homedir(), '.qeuli-preview')));

if (args.includes('--reset')) fs.rmSync(home, { recursive: true, force: true });
fs.mkdirSync(home, { recursive: true });
stageFeatureUi();

// ---- the daemon, isolated ----
const daemon = spawn(process.execPath, [path.join(root, 'src', 'cli.js'), 'daemon'], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: {
    ...process.env,
    QEULI_HOME: home,
    QEULI_PORT: String(daemonPort),
    QEULI_DEV_ORIGIN: `http://localhost:${uiPort}`,
    QEULI_CLAUDE_SETTINGS: path.join(home, 'claude-settings.json'),
    ...(args.includes('--quiet') ? { QEULI_NOTIFY: '0' } : {}),
  },
});
daemon.on('exit', (code) => {
  console.error(`\nThe preview daemon stopped (code ${code}). Is port ${daemonPort} already in use? Try --port.`);
  process.exit(code || 1);
});

// ---- the UI, served as plain files ----
const ui = path.join(root, 'desktop', 'ui');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(req.url.split('?')[0]);
  const file = path.normalize(path.join(ui, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(ui)) return res.writeHead(403).end();
  fs.readFile(file, (err, body) => {
    if (err) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  });
});
server.listen(uiPort, '127.0.0.1', () => {
  console.log(`\n  Qeuli preview\n  open   http://localhost:${uiPort}/?port=${daemonPort}\n  data   ${home}\n  stop   Ctrl+C\n`);
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${uiPort} is in use. Try --ui <port>.` : e);
  daemon.kill();
  process.exit(1);
});

const stop = () => {
  daemon.removeAllListeners('exit');
  daemon.kill();
  server.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
