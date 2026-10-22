// Colour roles every theme must provide. Components only ever use these tokens.
//   bg surface fg muted line  : structure and text
//   accent                    : the one strong colour (focus, selection, active nav)
//   run wait ok               : agent states (working / needs you / done), used the same everywhere

export const BUILTIN = [
  // Paper and Ink are made for the Sticker look: pure black-on-white and white-on-black, one teal accent.
  { id: 'paper', name: 'Paper', type: 'light', c: { bg: '#FFFEFA', surface: '#FFFFFF', fg: '#0B0B0B', muted: '#4D4D4D', line: '#D9D6CC', accent: '#63C8C1', run: '#1F8F88', wait: '#B45309', ok: '#15803D' } },
  { id: 'ink', name: 'Ink', type: 'dark', c: { bg: '#0B0B0B', surface: '#161616', fg: '#F4F4EE', muted: '#A8A8A0', line: '#333333', accent: '#63C8C1', run: '#63C8C1', wait: '#FFB020', ok: '#6BCB77' } },
  { id: 'tide', name: 'Tide', type: 'dark', c: { bg: '#0e1514', surface: '#141d1c', fg: '#d9e4e0', muted: '#8a9c97', line: '#223130', accent: '#7fd1b9', run: '#5bb8c4', wait: '#e8a65d', ok: '#9ccf8e' } },
  { id: 'chalk', name: 'Chalk', type: 'light', c: { bg: '#f3f1ea', surface: '#fbfaf6', fg: '#23302d', muted: '#5f6b66', line: '#dcd8cb', accent: '#1f6f5c', run: '#2a7f8c', wait: '#a85a0c', ok: '#3b7a36' } },
  { id: 'tokyo-night', name: 'Tokyo Night', type: 'dark', c: { bg: '#1a1b26', surface: '#16161e', fg: '#c0caf5', muted: '#7f89b5', line: '#292e42', accent: '#7aa2f7', run: '#7dcfff', wait: '#e0af68', ok: '#9ece6a' } },
  { id: 'dracula', name: 'Dracula', type: 'dark', c: { bg: '#282a36', surface: '#21222c', fg: '#f8f8f2', muted: '#98a3cc', line: '#44475a', accent: '#bd93f9', run: '#8be9fd', wait: '#ffb86c', ok: '#50fa7b' } },
  { id: 'nord', name: 'Nord', type: 'dark', c: { bg: '#2e3440', surface: '#3b4252', fg: '#eceff4', muted: '#a3afc2', line: '#434c5e', accent: '#88c0d0', run: '#81a1c1', wait: '#ebcb8b', ok: '#a3be8c' } },
  { id: 'gruvbox', name: 'Gruvbox', type: 'dark', c: { bg: '#282828', surface: '#32302f', fg: '#ebdbb2', muted: '#a89984', line: '#3c3836', accent: '#fabd2f', run: '#83a598', wait: '#fe8019', ok: '#b8bb26' } },
  { id: 'solarized-dark', name: 'Solarized Dark', type: 'dark', c: { bg: '#002b36', surface: '#073642', fg: '#93a1a1', muted: '#869ba0', line: '#124a57', accent: '#2aa198', run: '#268bd2', wait: '#b58900', ok: '#859900' } },
  { id: 'solarized-light', name: 'Solarized Light', type: 'light', c: { bg: '#fdf6e3', surface: '#eee8d5', fg: '#4f6770', muted: '#566d75', line: '#e0d9c2', accent: '#1d7f78', run: '#1f76b4', wait: '#8f6d00', ok: '#6b7b00' } },
  { id: 'catppuccin', name: 'Catppuccin Mocha', type: 'dark', c: { bg: '#1e1e2e', surface: '#181825', fg: '#cdd6f4', muted: '#9399b2', line: '#313244', accent: '#cba6f7', run: '#89dceb', wait: '#f9e2af', ok: '#a6e3a1' } },
  { id: 'rose-pine', name: 'Rosé Pine', type: 'dark', c: { bg: '#191724', surface: '#1f1d2e', fg: '#e0def4', muted: '#908caa', line: '#26233a', accent: '#ebbcba', run: '#9ccfd8', wait: '#f6c177', ok: '#7fc4a0' } },
  { id: 'github-dark', name: 'GitHub Dark', type: 'dark', c: { bg: '#0d1117', surface: '#161b22', fg: '#e6edf3', muted: '#8b949e', line: '#30363d', accent: '#58a6ff', run: '#79c0ff', wait: '#d29922', ok: '#3fb950' } },
  { id: 'github-light', name: 'GitHub Light', type: 'light', c: { bg: '#f6f8fa', surface: '#ffffff', fg: '#1f2328', muted: '#59636e', line: '#d1d9e0', accent: '#0969da', run: '#1b7c83', wait: '#9a6700', ok: '#1a7f37' } },
];

// ---------- colour maths ----------

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const toRgb = (hex) => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? [...h].map((x) => x + x).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
const toHex = (rgb) => '#' + rgb.map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
const lum = (hex) => {
  const [r, g, b] = toRgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

/** Nudge `color` toward the readable end until it reaches `ratio` against `bg`. */
function ensure(color, bg, ratio) {
  const target = lum(bg) > 0.5 ? '#000000' : '#ffffff';
  let c = color;
  for (let i = 0; i < 20 && contrast(c, bg) < ratio; i++) c = mix(c, target, 0.12);
  return c;
}

// ---------- editor (VS Code / Cursor) theme import ----------

/** Theme files are JSONC: comments and trailing commas are legal. */
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

const isHex = (v) => typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);
const solid = (v) => {
  // Drop alpha: "#rrggbbaa" -> "#rrggbb", "#rgb" -> "#rrggbb".
  const h = v.replace('#', '');
  return '#' + (h.length === 3 ? [...h].map((x) => x + x).join('') : h.slice(0, 6)).toLowerCase();
};

/** Map a VS Code / Cursor colour theme onto our roles. Returns null if it has no editor background. */
export function fromEditorTheme(json, name) {
  const col = json?.colors || {};
  const pick = (...keys) => {
    for (const k of keys) if (isHex(col[k])) return solid(col[k]);
    return null;
  };
  const bg = pick('editor.background');
  if (!bg) return null;

  const type = json.type === 'light' || json.type === 'hc-light' || lum(bg) > 0.5 ? 'light' : 'dark';
  const fg = ensure(pick('editor.foreground', 'foreground') || (type === 'light' ? '#222222' : '#dddddd'), bg, 7);
  const surface = pick('sideBar.background', 'editorWidget.background', 'activityBar.background') || mix(bg, fg, 0.05);
  const line = pick('panel.border', 'editorGroup.border', 'sideBar.border') || mix(bg, fg, 0.14);
  const muted = ensure(pick('descriptionForeground', 'editorLineNumber.foreground') || mix(fg, bg, 0.45), bg, 4.5);
  const accent = ensure(pick('button.background', 'textLink.foreground', 'focusBorder', 'activityBarBadge.background') || '#6aa9ff', bg, 3);
  const run = ensure(pick('terminal.ansiCyan', 'terminal.ansiBlue') || accent, bg, 3);
  const wait = ensure(pick('terminal.ansiYellow', 'editorWarning.foreground') || '#d19a66', bg, 3);
  const ok = ensure(pick('terminal.ansiGreen', 'testing.iconPassed') || '#98c379', bg, 3);

  return { id: 'imp-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, type, imported: true, c: { bg, surface, fg, muted, line, accent, run, wait, ok } };
}

// ---------- applying ----------

export function applyTheme(theme, prefs) {
  const c = { ...theme.c };
  if (prefs.accent) c.accent = ensure(prefs.accent, c.bg, 3);
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(c)) root.setProperty(`--${k}`, v);
  // Text drawn on top of the accent colour.
  root.setProperty('--accent-ink', contrast('#000000', c.accent) > contrast('#ffffff', c.accent) ? '#0b0b0b' : '#ffffff');
  root.setProperty('--r', `${prefs.radius}px`);
  document.documentElement.style.colorScheme = theme.type;
  return c; // font, look, density and motion are applied by looks.js
}
