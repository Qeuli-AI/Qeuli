// Small helpers shared by every part of the UI.

// Outside the desktop app (dev preview in a browser) ?port=N points at a different daemon.
const devPort = window.__TAURI__ ? null : new URLSearchParams(location.search).get('port');
export const BASE = `http://127.0.0.1:${/^\d{4,5}$/.test(devPort || '') ? devPort : 47821}`;
export const tauri = window.__TAURI__;

export const $ = (id) => document.getElementById(id);

/** Tiny DOM builder. Text always goes in as text, never as HTML. */
export function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k.startsWith('aria-') && typeof v === 'boolean') n.setAttribute(k, String(v));
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...kids.flat().filter((x) => x != null && x !== false));
  return n;
}

export const api = async (path, init) => {
  const res = await fetch(BASE + path, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
};
const json = (method) => (path, body) => api(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
export const put = json('PUT');
export const post = json('POST');

let toastTimer;
export function toast(msg) {
  document.querySelector('.toast')?.remove();
  document.body.append(h('div', { class: 'toast', role: 'status' }, msg));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => document.querySelector('.toast')?.remove(), 2600);
}

export const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    toast('Copy failed');
  }
};

export const openUrl = (url) => (tauri?.opener ? tauri.opener.openUrl(url) : window.open(url, '_blank', 'noopener'));

export const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}:${String(s % 60).padStart(2, '0')}`;
};

/** UI-only settings live in this webview. Every read and write is guarded: storage can be unavailable. */
export const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

export const reducedMotion = () => document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;

const NAMES = { 'claude-code': 'Claude', codex: 'Codex', cli: 'Command', process: 'Process' };
export const nameOf = (s) => s.name || NAMES[s.source] || 'Agent';

export const SVG_NS = 'http://www.w3.org/2000/svg';
/** An inline icon from trusted, built-in markup (24x24 grid). */
export function icon(markup, cls = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  svg.innerHTML = markup;
  return svg;
}
