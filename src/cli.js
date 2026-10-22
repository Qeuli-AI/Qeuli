#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startDaemon } from './daemon.js';
import { api } from './client.js';
import { CLAUDE_EVENTS, installClaude, integrations } from './install.js';
import { builtinManifests, installFromFolder, removeInstalled } from './features.js';
import { describeTool } from './hooks.js';

const [cmd, ...args] = process.argv.slice(2);

const featureCommands = () => builtinManifests().flatMap((m) => (m.cli || []).map((c) => ({ ...c, feature: m.id })));

/** Run a command declared in a feature's feature.json: call its route, print the templated result. */
async function runFeatureCommand(c) {
  const raw = args[0];
  const body = c.arg && raw !== undefined ? { [c.arg]: Number.isNaN(Number(raw)) ? raw : Number(raw) } : {};
  const result = await api(`/features/${c.feature}/${c.route}`, c.method === 'GET' ? undefined : body);
  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
  } else {
    console.log(c.print ? c.print.replace(/\{(\w+)\}/g, (_, k) => result[k] ?? '') : JSON.stringify(result, null, 2));
  }
}

async function readStdin() {
  let s = '';
  for await (const chunk of process.stdin) s += chunk;
  return s;
}

async function hook(source) {
  // Hooks must never break the agent, so every failure is swallowed.
  try {
    if (source === 'claude') {
      const input = JSON.parse(await readStdin());
      const type = CLAUDE_EVENTS[input.hook_event_name];
      if (type) {
        await api('/event', {
          source: 'claude-code',
          type,
          session: input.session_id,
          cwd: input.cwd,
          message: input.message,
          ...(input.tool_name ? describeTool(input.tool_name, input.tool_input) : {}),
        });
      }
    } else if (source === 'codex') {
      // Codex passes its notification JSON as the last argument.
      const input = JSON.parse(args[args.length - 1]);
      if (input.type === 'agent-turn-complete') {
        await api('/event', { source: 'codex', type: 'done', session: input['thread-id'], cwd: input.cwd });
      }
    }
  } catch {}
}

function run(cmdline) {
  const session = `run-${process.pid}`;
  const send = (type) => api('/event', { source: 'cli', type, session, cwd: process.cwd() }).catch(() => {});
  send('started');
  const child = spawn(cmdline[0], cmdline.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('exit', async (code) => {
    await send('done');
    process.exit(code ?? 0);
  });
}

async function main() {
  switch (cmd) {
    case 'daemon':
      return startDaemon();
    case 'hook':
      return hook(args[0]);
    case 'mcp':
      return import('./mcp.js');
    case 'run':
      return run(args.filter((a) => a !== '--'));
    case 'watch': {
      const { watchPid, watchMatch } = await import('./watch.js');
      const nameIdx = args.indexOf('--name');
      const name = nameIdx >= 0 ? args[nameIdx + 1] : undefined;
      const matchIdx = args.indexOf('--match');
      const exeIdx = args.indexOf('--exe');
      if (matchIdx >= 0) return watchMatch(args[matchIdx + 1], name, exeIdx >= 0 ? args[exeIdx + 1] : undefined);
      const pid = Number(args[0]);
      if (!pid) break;
      return watchPid(pid, name);
    }
    case 'config': {
      const { CONFIG_FILE, readConfig, writeConfig } = await import('./config.js');
      if (args[0] === 'add') {
        const opt = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
        const match = opt('--match');
        if (!match) return console.error('config add needs --match <text> [--name <n>] [--exe <image>]');
        const cfg = readConfig();
        cfg.watches = cfg.watches.filter((w) => w.match !== match);
        cfg.watches.push({ name: opt('--name') || match, match, ...(opt('--exe') && { exe: opt('--exe') }) });
        writeConfig(cfg);
        console.log(`Watching "${match}" automatically. The daemon picks this up within one scan.`);
      } else {
        if (!fs.existsSync(CONFIG_FILE)) writeConfig(readConfig());
        console.log(CONFIG_FILE);
      }
      return;
    }
    case 'progress': {
      const pct = Number(args[0]);
      if (Number.isNaN(pct)) return console.error('usage: qeuli progress <0-100> [--session <id>] [--message <text>]');
      const opt = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
      let session = opt('--session');
      if (!session) {
        const running = (await api('/state')).sessions.filter((s) => s.status === 'running');
        if (running.length !== 1) return console.error(`${running.length} sessions running; pass --session <id> (see \`qeuli status\`).`);
        session = running[0].id;
      }
      const r = await api('/event', { type: 'progress', session, progress: pct, message: opt('--message') });
      console.log(r.ok ? `${session}: ${pct}%` : 'No such session.');
      return;
    }
    case 'feature':
    case 'module': {
      if (args[0] === 'install' && args[1]) {
        try {
          const manifest = installFromFolder(args[1]);
          console.log(`Installed "${manifest.name}" with ${manifest.reminders.length} reminder(s). Enable it in the app under Sources, or run: qeuli feature enable ${manifest.id}`);
        } catch (e) {
          console.error(`Could not install: ${e.message}`);
          process.exitCode = 1;
        }
      } else if (args[0] === 'remove' && args[1]) {
        removeInstalled(args[1]);
        console.log(`Removed ${args[1]}`);
      } else if ((args[0] === 'enable' || args[0] === 'disable') && args[1]) {
        await api(`/features/${args[1]}/enabled`, { enabled: args[0] === 'enable' });
        console.log(`${args[1]} ${args[0]}d`);
      } else {
        for (const f of await api('/features')) console.log(`${f.enabled ? 'on ' : 'off'}  ${f.id.padEnd(14)} ${f.builtin ? '(built in) ' : ''}${f.description}`);
      }
      return;
    }
    case 'status': {
      const s = await api('/state');
      console.log(JSON.stringify(s, null, 2));
      return;
    }
    case 'suggest': {
      console.log(JSON.stringify(await api(`/suggest?minutes=${args[0] || 3}`), null, 2));
      return;
    }
    case 'queue': {
      if (args[0] === 'add') {
        const item = await api('/queue', { url: args[1], title: args[2], minutes: Number(args[3]) || 5 });
        console.log(item.error || `Queued: ${item.title}`);
      } else {
        for (const q of await api('/queue')) console.log(`${q.minutes}m  ${q.title}  ${q.url}`);
      }
      return;
    }
    case 'install': {
      if (args[0] === 'claude') {
        console.log(`Hooks added to ${installClaude()}
Restart Claude Code to pick them up.`);
        return;
      }
      if (args[0] === 'codex') {
        console.log(`Add this line to ~/.codex/config.toml:\n\n${integrations().codex.line}`);
        return;
      }
      break;
    }
  }

  // Commands a feature declares in its feature.json (e.g. water's `drink`).
  const entry = featureCommands().find((c) => c.name === cmd);
  if (entry) return runFeatureCommand(entry);

  const featureHelp = featureCommands()
    .map((c) => `  ${`${c.name}${c.arg ? ` [${c.arg}]` : ''}`.padEnd(28)}${c.help || ''}`)
    .join('\n');
  console.log(`qeuli <command>

  daemon                      start the local daemon
  status                      show agent sessions and today's wait time
  suggest [minutes]           get a read or break that fits a wait
  queue [add <url> [title] [minutes]]
  run -- <command>            wrap any command as an agent run
  feature [install <folder>|remove <id>|enable <id>|disable <id>]
                              list or manage features
  config                      create/print the config file path
  config add --match <text> [--name <n>] [--exe <image>]
                              have the daemon watch for this process automatically
  progress <0-100> [--session <id>] [--message <text>]
                              report progress of a running session
  watch <pid> [--name <n>]    track an existing process until it exits
  watch --match <text> [--name <n>]
                              track any process whose command line contains <text>
  install claude|codex        connect an agent
  mcp                         start the MCP server (stdio)
${featureHelp}`);
}

main();
