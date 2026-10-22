import http from 'node:http';
import crypto from 'node:crypto';
import { loadStore } from './store.js';
import { suggest } from './suggest.js';
import { notify, notifyEvent } from './notify.js';
import { localDay } from './time.js';
import { createFeatures } from './features.js';
import { createProfile } from './profile.js';
import { createScanner } from './scanner.js';
import { liveConfig, sanitizeConfig, writeConfig } from './config.js';
import { integrations, installClaude, uninstallClaude } from './install.js';
import { listEditorThemes, activeEditorThemes, readEditorTheme } from './editor.js';

export const PORT = Number(process.env.QEULI_PORT || 47821);
export const HOST = '127.0.0.1';

const today = () => localDay();

export function createDaemon() {
  const { data, save, flush } = loadStore();
  const getConfig = liveConfig();
  const sessions = new Map();
  const streams = new Set();

  const profile = createProfile({ data, save });

  // Features (water/, ...) live in their own folders; the core only hands them these few hooks.
  const features = createFeatures({
    data, save, notify,
    award: (xp, reason) => profile.award(xp, reason),
    waitHistory: (n) => {
      const out = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const day = localDay(d.getTime());
        const rec = data.days[day] || {};
        out.push({ day, waitMs: rec.waitMs || 0, runs: rec.runs || 0 });
      }
      return out;
    },
    queueAdd: (item) => {
      const q = { id: crypto.randomUUID(), url: item.url, title: item.title || item.url, minutes: Number(item.minutes) || 5, done: false };
      data.queue.push(q);
      save();
      broadcast();
      return q;
    },
    waitMsToday: () => {
      // Finished waits plus the run in progress, so a long run counts as it happens.
      const live = [...sessions.values()].filter((s) => s.status === 'running').reduce((n, s) => n + (Date.now() - s.since), 0);
      return (data.days[today()]?.waitMs || 0) + live;
    },
    isRunning: (id) => sessions.get(id)?.status === 'running',
  });

  const snapshot = () => ({
    sessions: [...sessions.values()],
    queue: data.queue.filter((q) => !q.done),
    today: data.days[today()] || { waitMs: 0, runs: 0 },
  });

  const broadcast = () => {
    const msg = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const res of streams) res.write(msg);
  };

  function applyEvent({ source = 'unknown', type, session = 'default', cwd, message, name, progress, tool, target }) {
    const now = Date.now();
    const prev = sessions.get(session);
    const day = (data.days[today()] ||= { waitMs: 0, runs: 0 });

    // Time spent in the "running" state counts as wait time.
    if (prev?.status === 'running') day.waitMs += now - prev.since;

    // A run spans started -> (waiting -> running)* -> done, so remember when it began.
    const runStart = type === 'started' ? now : prev?.runStart ?? now;

    if (type === 'progress') {
      if (!prev) return false;
      const pct = Math.max(0, Math.min(100, Number(progress)));
      if (Number.isNaN(pct)) return false;
      sessions.set(session, { ...prev, progress: pct, message: message ?? prev.message });
      broadcast();
      return true;
    }

    if (type === 'resumed') {
      // Fired after every tool call. Features hear about it (Context shows it), and if we were waiting
      // on the user the run is going again.
      if (tool) features.onEvent({ type: 'tool', session, source, cwd, tool, target });
      if (!prev) return true;
      const next = { ...prev, ...(tool && { activity: { tool, target, at: now } }) };
      if (prev.status === 'waiting') {
        next.status = 'running';
        next.since = now;
      }
      sessions.set(session, next);
      broadcast();
      return true;
    }

    if (type === 'started') {
      day.runs += 1;
      sessions.set(session, { id: session, source, name, status: 'running', since: now, runStart, cwd });
    } else if (type === 'waiting') {
      sessions.set(session, { id: session, source, name, status: 'waiting', since: now, runStart, cwd, message });
    } else if (type === 'done') {
      sessions.set(session, { id: session, source, name, status: 'idle', since: now, cwd });
    } else {
      return false;
    }
    save();
    broadcast();
    notifyEvent({ source, type, cwd, message, name }, type === 'done' ? now - runStart : 0, getConfig().notify);
    features.onEvent({ type, source, session, name, cwd });
    return true;
  }

  // Only the local CLI (no Origin) and our own extension/desktop app may talk to us.
  // This blocks arbitrary websites from poking the daemon via the browser.
  const originOk = (origin) =>
    !origin || origin === process.env.QEULI_DEV_ORIGIN ||origin.startsWith('chrome-extension://') || origin.startsWith('tauri://') || origin === 'http://tauri.localhost';
  const hostOk = (host) => /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host || '');

  const readJson = (req) =>
    new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 64_000) reject(new Error('too large'));
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
    });

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!hostOk(req.headers.host) || !originOk(origin)) {
      res.writeHead(403).end();
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    const url = new URL(req.url, `http://${HOST}`);
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    try {
      if (req.method === 'GET' && url.pathname === '/state') return send(200, snapshot());

      // The desktop app asks for this on quit so pending data is written before the process ends.
      if (req.method === 'POST' && url.pathname === '/shutdown') {
        send(200, { ok: true });
        setTimeout(() => {
          flush();
          process.exit(0);
        }, 50);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/stream') {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
        streams.add(res);
        req.on('close', () => streams.delete(res));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/event') {
        const ok = applyEvent(await readJson(req));
        return send(ok ? 200 : 400, { ok });
      }

      if (req.method === 'GET' && url.pathname === '/suggest') {
        const minutes = Number(url.searchParams.get('minutes')) || 3;
        return send(200, suggest(data.queue, minutes));
      }

      if (req.method === 'GET' && url.pathname === '/queue') {
        return send(200, data.queue.filter((q) => !q.done));
      }

      if (req.method === 'POST' && url.pathname === '/queue') {
        const { url: link, title, minutes } = await readJson(req);
        if (!/^https?:\/\//.test(link || '')) return send(400, { error: 'url must be http(s)' });
        const item = {
          id: crypto.randomUUID(),
          url: link,
          title: title || link,
          minutes: Number(minutes) || 5,
          done: false,
        };
        data.queue.push(item);
        save();
        broadcast();
        return send(200, item);
      }

      const done = url.pathname.match(/^\/queue\/([\w-]+)\/done$/);
      if (req.method === 'POST' && done) {
        const item = data.queue.find((q) => q.id === done[1]);
        if (!item) return send(404, { error: 'not found' });
        item.done = true;
        save();
        broadcast();
        return send(200, item);
      }

      if (url.pathname === '/config') {
        if (req.method === 'GET') return send(200, getConfig());
        if (req.method === 'PUT') {
          const cfg = sanitizeConfig(await readJson(req));
          writeConfig(cfg);
          return send(200, cfg);
        }
      }

      if (req.method === 'GET' && url.pathname === '/features') return send(200, features.list());

      if (url.pathname === '/profile') {
        if (req.method === 'GET') return send(200, profile.view());
        if (req.method === 'PUT') return send(200, profile.configure(await readJson(req)));
      }
      if (req.method === 'POST' && url.pathname === '/profile/award') {
        const { xp, reason } = await readJson(req);
        return send(200, profile.award(xp, reason || 'ui'));
      }

      // /features/<id>/<route> goes to that feature's backend; "enabled" is reserved for the on/off switch.
      const feat = url.pathname.match(/^\/features\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
      if (feat) {
        const [, id, route] = feat;
        const body = req.method === 'GET' ? {} : await readJson(req);
        if (route === 'enabled' && req.method === 'POST') return send(200, features.setEnabled(id, body.enabled));
        return send(200, await features.handle(id, req.method, route, body, Object.fromEntries(url.searchParams))); // handlers may be async (network)
      }

      if (req.method === 'GET' && url.pathname === '/integrations') return send(200, integrations());

      if (req.method === 'POST' && url.pathname === '/integrations/claude') {
        const { enabled } = await readJson(req);
        enabled ? installClaude() : uninstallClaude();
        return send(200, integrations());
      }

      if (req.method === 'GET' && url.pathname === '/editor/themes') {
        return send(200, { themes: listEditorThemes(), active: activeEditorThemes() });
      }

      if (req.method === 'GET' && url.pathname === '/editor/theme') {
        return send(200, readEditorTheme(url.searchParams.get('file') || ''));
      }

      if (req.method === 'POST' && url.pathname === '/learned') {
        const { topic, note } = await readJson(req);
        if (!topic) return send(400, { error: 'topic required' });
        data.learned.push({ topic, note, at: new Date().toISOString() });
        save();
        return send(200, { ok: true });
      }

      send(404, { error: 'not found' });
    } catch (e) {
      send(e.status || 400, { error: String(e.message || e) });
    }
  });

  return { server, applyEvent, snapshot, getConfig, features, tick: () => features.tick() };
}

export function startDaemon() {
  const { server, applyEvent, getConfig, tick } = createDaemon();
  setInterval(tick, 60_000);
  // Watches from config.json are tracked in-process; no separate `watch` command needed.
  createScanner(getConfig,(e) => applyEvent({ source: 'process', ...e })).start();
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`qeuli daemon already running on ${HOST}:${PORT}`);
      process.exit(0);
    }
    throw e;
  });
  server.listen(PORT, HOST, () => console.log(`qeuli daemon listening on http://${HOST}:${PORT}`));
}
