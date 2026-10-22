import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SELF = process.argv[1]; // the entry script: cli.js, or qeuli.mjs when bundled
// The preview points this at a scratch file, so connecting an agent there never edits your real hooks.
const SETTINGS = process.env.QEULI_CLAUDE_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json');

export const CLAUDE_EVENTS = {
  UserPromptSubmit: 'started',
  PostToolUse: 'resumed',
  Notification: 'waiting',
  Stop: 'done',
};

// Hooks run with the same Node that runs the daemon, so a bundled Node works without PATH.
const hookCommand = () => `"${process.execPath}" "${SELF}" hook claude`;
const isOurs = (h) => typeof h.command === 'string' && / hook claude$/.test(h.command) && /(cli.js|qeuli.mjs|agentwell.mjs)"/.test(h.command);

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
}

export function claudeInstalled() {
  const hooks = readSettings().hooks || {};
  return Object.keys(CLAUDE_EVENTS).every((ev) => (hooks[ev] || []).some((g) => g.hooks?.some(isOurs)));
}

export function installClaude() {
  const settings = readSettings();
  settings.hooks ||= {};
  for (const event of Object.keys(CLAUDE_EVENTS)) {
    // Replace any older Qeuli hook (e.g. from a moved install) with the current one.
    const groups = (settings.hooks[event] || [])
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
      .filter((g) => g.hooks.length);
    groups.push({ hooks: [{ type: 'command', command: hookCommand() }] });
    settings.hooks[event] = groups;
  }
  writeSettings(settings);
  return SETTINGS;
}

export function uninstallClaude() {
  const settings = readSettings();
  for (const event of Object.keys(settings.hooks || {})) {
    const groups = settings.hooks[event]
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
      .filter((g) => g.hooks.length);
    if (groups.length) settings.hooks[event] = groups;
    else delete settings.hooks[event];
  }
  if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks;
  writeSettings(settings);
  return SETTINGS;
}

export function integrations() {
  const slash = (p) => p.replaceAll('\\', '/');
  return {
    claude: { installed: claudeInstalled(), settings: SETTINGS },
    codex: { line: `notify = ["${slash(process.execPath)}", "${slash(SELF)}", "hook", "codex"]` },
    mcp: { command: `claude mcp add qeuli -- "${process.execPath}" "${SELF}" mcp` },
  };
}
