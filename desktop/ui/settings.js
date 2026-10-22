// Settings: Connections (what Qeuli watches), Appearance (how it looks), Story (your character).
import { h, api, put, post, toast, copy, tauri } from './lib.js';
import { fromEditorTheme, parseJsonc } from './themes.js';
import { FONT_PACKS, LOOKS } from './looks.js';
import { characterForm, storyPreview } from './character.js';
import { chaptersFor } from './story.js';
import { BRAND } from './brand.js';

const TABS = [
  { id: 'connections', label: 'Connections', blurb: 'What Qeuli watches, and what it may tell you.' },
  { id: 'appearance', label: 'Appearance', blurb: 'Fonts, style and colour. Make it yours.' },
  { id: 'story', label: 'Story', blurb: 'Your character, your chapters, your XP.' },
];

export function buildSettings(app) {
  const el = h('section', { class: 'page', id: 'page-settings', hidden: true });
  const body = h('div');
  const head = h('div', { class: 'pagehead' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  el.append(head, tabs, body);

  function show(tab = 'connections') {
    if (!TABS.some((t) => t.id === tab)) tab = 'connections';
    const t = TABS.find((x) => x.id === tab);
    head.replaceChildren(h('div', {}, h('a', { class: 'kicker', href: '#/' }, h('i', {}, '←'), 'Home'), h('h1', {}, 'Settings'), h('p', {}, t.blurb)));
    tabs.replaceChildren(...TABS.map((x) => h('a', { class: 'btn', href: `#/settings/${x.id}`, role: 'tab', 'aria-pressed': String(x.id === tab) }, x.label)));
    body.replaceChildren(tab === 'appearance' ? appearanceTab(app) : tab === 'story' ? storyTab(app) : connectionsTab(app));
  }
  return { el, show };
}

// ---------------------------------------------------------------- connections

function connectionsTab(app) {
  let cfg = null;
  let saveTimer;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        cfg = await put('/config', cfg);
        toast('Saved');
      } catch (err) {
        toast(err.message);
      }
    }, 500);
  };

  const features = h('div');
  const agents = h('div');
  const watches = h('div');
  const notify = h('div');
  const timing = h('div', { class: 'grid2' });
  const addWatch = h('button', { class: 'btn', type: 'button', onclick: () => { if (cfg) { cfg.watches.push({ name: '', match: '', exe: '' }); renderWatches(); } } }, 'Add process');

  const root = h('div', { class: 'cols' },
    h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Features'), features,
      h('p', { class: 'lede', style: 'margin:12px 0 0' }, 'Add a feature from a folder with a ', h('code', {}, 'feature.json'), ': ', h('code', {}, 'qeuli feature install ./folder'), '. Installed features only schedule reminders and never run code.')),
    h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Agents'), agents),
    h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Processes'),
      h('p', { class: 'lede' }, 'Anything long-running: training, builds, encodes. A watch matches text in a process command line. Adding the executable name keeps scanning cheap.'),
      watches, h('p', {}, addWatch)),
    h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Notifications'), notify, h('div', { class: 'eyebrow' }, 'Timing'), timing));

  const cmdBox = (text) => h('div', { class: 'cmd' }, h('code', { title: text }, text), h('button', { class: 'btn', type: 'button', onclick: () => copy(text) }, 'Copy'));

  function renderAgents(integ) {
    const c = integ.claude;
    agents.replaceChildren(
      h('div', { class: 'line' },
        h('div', {}, h('span', {}, 'Claude Code '), h('span', { class: `pill ${c.installed ? 'on' : 'off'}` }, c.installed ? 'connected' : 'not connected'), h('small', {}, `Adds four hooks to ${c.settings}. Restart Claude Code after changing.`)),
        h('button', { class: c.installed ? 'btn danger' : 'btn primary', type: 'button', onclick: async () => { renderAgents(await post('/integrations/claude', { enabled: !c.installed })); toast(c.installed ? 'Disconnected' : 'Connected. Restart Claude Code.'); } }, c.installed ? 'Disconnect' : 'Connect')),
      h('div', { class: 'stack' }, h('div', {}, 'Codex', h('small', {}, 'Add this line to ~/.codex/config.toml')), cmdBox(integ.codex.line)),
      h('div', { class: 'stack' }, h('div', {}, 'MCP server', h('small', {}, 'Lets an agent queue reads and ask for a break')), cmdBox(integ.mcp.command)));
  }

  function renderFeatures() {
    features.replaceChildren(...app.features.map((f) =>
      h('div', { class: 'line' },
        h('div', {}, h('span', {}, `${f.name} `), h('span', { class: 'pill' }, f.builtin ? 'built in' : 'installed'), h('small', {}, f.description)),
        h('label', { class: 'toggle' },
          h('input', { type: 'checkbox', 'aria-label': `${f.name} enabled`, checked: f.enabled, onchange: async (e) => {
            try {
              await post(`/features/${f.id}/enabled`, { enabled: e.target.checked });
              await app.reloadFeatures();
            } catch (err) {
              toast(err.message);
            }
          } }),
          h('span')))));
  }

  function renderWatches() {
    const field = (label, value, key, w, ph) => {
      const id = `w-${Math.random().toString(36).slice(2, 7)}`;
      return h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { id, type: 'text', value: value ?? '', placeholder: ph, oninput: (e) => { w[key] = e.target.value; save(); } }));
    };
    watches.replaceChildren(...(cfg.watches.length
      ? cfg.watches.map((w, i) =>
          h('div', { class: 'watch' },
            field('Name', w.name, 'name', w, 'Model training'),
            field('Command line contains', w.match, 'match', w, 'train.py'),
            field('Executable (optional)', w.exe, 'exe', w, 'python'),
            h('button', { class: 'btn quiet danger', type: 'button', 'aria-label': `Remove ${w.name || w.match}`, onclick: () => { cfg.watches.splice(i, 1); renderWatches(); save(); } }, 'Remove')))
      : [h('div', { class: 'empty' }, h('b', {}, 'No processes. '), `Add one and ${BRAND.name} will notice it starting and finishing by itself.`)]));
  }

  function renderNotify() {
    const rows = [['started', 'Agent starts working', 'A nudge to use the wait'], ['waiting', 'Agent needs you', 'A permission prompt or question'], ['done', 'Run finishes', 'Only for runs longer than 10 seconds']];
    notify.replaceChildren(...rows.map(([k, title, sub]) =>
      h('div', { class: 'line' }, h('div', {}, title, h('small', {}, sub)),
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', 'aria-label': title, checked: cfg.notify[k] !== false, onchange: (e) => { cfg.notify[k] = e.target.checked; save(); } }), h('span')))));
  }

  function renderTiming() {
    const num = (key, label, sub, min, max) => {
      const id = `t-${key}`;
      return h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { id, type: 'number', min, max, value: cfg[key], oninput: (e) => { cfg[key] = Number(e.target.value); save(); } }), h('small', { class: 'lab', style: 'text-transform:none;letter-spacing:0' }, sub));
    };
    timing.replaceChildren(
      num('scanSeconds', 'Scan every (s)', 'How often to look for new processes', 3, 300),
      num('minSeconds', 'Count after (s)', 'Ignore processes shorter than this', 0, 3600),
      num('graceSeconds', 'Finish after (s)', 'Gap allowed between epochs or steps', 0, 600));
  }

  (async () => {
    try {
      cfg = await api('/config');
      renderAgents(await api('/integrations'));
      renderFeatures();
      renderWatches();
      renderNotify();
      renderTiming();
    } catch {
      agents.replaceChildren(h('div', { class: 'empty' }, 'The daemon is not reachable yet.'));
    }
  })();
  return root;
}

// ---------------------------------------------------------------- appearance

function appearanceTab(app) {
  const p = app.prefs;

  const options = (list, current, onPick, sample) => {
    const wrap = h('div', { class: 'opts' });
    const paint = () => wrap.replaceChildren(...list.map((o) =>
      h('button', { class: 'opt', type: 'button', 'aria-pressed': String(o.id === current()), onclick: () => { onPick(o.id); paint(); } },
        sample ? h('span', { class: 'sample', style: o.sample }, 'Aa') : null,
        h('b', {}, o.name), h('small', {}, o.desc))));
    paint();
    return wrap;
  };

  // themes
  const themes = h('div', { class: 'themes' });
  const paintThemes = () => themes.replaceChildren(...app.allThemes().map((t) =>
    h('button', { class: 'swatch', type: 'button', 'aria-pressed': String(t.id === p.theme), onclick: () => { app.setTheme(t.id); paintThemes(); } },
      h('div', { class: 'art', style: `background:${t.c.bg}` },
        h('b', { style: `background:${t.c.accent}` }), h('s', { style: `background:${t.c.fg}` }), h('em', { style: `background:${t.c.wait}` }), h('i', { style: `background:${t.c.run}` })),
      h('div', { class: 'nm' }, h('span', {}, t.name), h('span', {}, t.imported ? 'editor' : t.type)))));
  paintThemes();

  // editor themes
  const found = h('div', { class: 'found', hidden: true });
  let editorThemes = null;
  async function importFromEditor(entry) {
    try {
      const json = await api(`/editor/theme?file=${encodeURIComponent(entry.file)}`);
      const t = fromEditorTheme(json, entry.label);
      if (!t) return toast('That theme has no editor background to read.');
      app.addTheme(t);
      paintThemes();
      toast(`Using ${t.name}`);
    } catch (err) {
      toast(err.message);
    }
  }
  async function scanEditors() {
    try {
      editorThemes = await api('/editor/themes');
    } catch {
      return toast('The daemon is not reachable.');
    }
    const { themes: list, active } = editorThemes;
    found.hidden = false;
    found.replaceChildren(...(list.length
      ? list.map((t) => h('div', { class: 'line' }, h('div', {}, t.label, h('small', {}, `${t.editor === 'cursor' ? 'Cursor' : 'VS Code'} · ${t.type}${active[t.editor] === t.label ? ' · active' : ''}`)), h('button', { class: 'btn', type: 'button', onclick: () => importFromEditor(t) }, 'Use')))
      : [h('div', { class: 'empty', style: 'padding:12px' }, 'No extension themes found. Cursor and VS Code built-in themes ship inside the app, so import their JSON file instead.')]));
  }
  const matchEditor = async () => {
    if (!editorThemes) await scanEditors();
    if (!editorThemes) return;
    const { themes: list, active } = editorThemes;
    for (const ed of ['cursor', 'vscode']) {
      const hit = list.find((t) => t.editor === ed && t.label.toLowerCase() === (active[ed] || '').toLowerCase());
      if (hit) return importFromEditor(hit);
    }
    const names = Object.values(active);
    toast(names.length ? `"${names[0]}" is built into the editor. Pick one from the list or import its JSON.` : 'No active editor theme found.');
  };
  const themeFile = h('input', { id: 'themeFile', type: 'file', accept: '.json,.jsonc', onchange: async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const t = fromEditorTheme(parseJsonc(await file.text()), file.name.replace(/\.jsonc?$/i, ''));
      if (!t) return toast('That file has no editor background to read.');
      app.addTheme(t);
      paintThemes();
      toast(`Using ${t.name}`);
    } catch {
      toast('Could not read that theme file.');
    }
  } });

  // details
  const accent = h('input', { type: 'color', 'aria-label': 'Accent colour', value: p.accent || app.currentTheme().c.accent, oninput: (e) => { p.accent = e.target.value; app.restyle(); } });
  const toggle = (id, label, checked, on) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', id, 'aria-label': label, checked, onchange: (e) => on(e.target.checked) }), h('span'));
  const autostart = h('input', { type: 'checkbox', 'aria-label': 'Launch at login' });
  const autoLine = h('div', { class: 'line' }, h('div', {}, 'Launch at login', h('small', {}, 'Starts in the tray so detection is always on')), h('label', { class: 'toggle' }, autostart, h('span')));
  if (!tauri) autoLine.hidden = true;
  else {
    tauri.core.invoke('autostart_enabled').then((v) => (autostart.checked = v)).catch(() => {});
    autostart.onchange = (e) => tauri.core.invoke('set_autostart', { enabled: e.target.checked }).catch(() => { e.target.checked = !e.target.checked; toast('Could not change launch at login'); });
  }

  return h('div', {},
    h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Font'), options(FONT_PACKS, () => p.font, (id) => { p.font = id; app.restyle(); }, true)),
    h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Style'), options(LOOKS, () => p.look, (id) => { p.look = id; app.restyle(); })),
    h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Colour'), themes),
    h('div', { class: 'cols' },
      h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'From your editor'),
        h('p', { class: 'lede' }, 'Reads installed Cursor and VS Code themes from disk. Nothing leaves your machine.'),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
          h('button', { class: 'btn', type: 'button', onclick: scanEditors }, 'Find editor themes'),
          h('button', { class: 'btn', type: 'button', onclick: matchEditor }, 'Match my active theme'),
          h('label', { class: 'btn', for: 'themeFile' }, 'Import theme file…'), themeFile),
        found),
      h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Details'),
        h('div', { class: 'line' }, h('div', {}, 'Accent', h('small', {}, "Override the theme's accent colour")),
          h('div', { style: 'display:flex;gap:8px;align-items:center' }, accent, h('button', { class: 'btn quiet', type: 'button', onclick: () => { p.accent = null; accent.value = app.currentTheme().c.accent; app.restyle(); } }, 'Reset'))),
        h('div', { class: 'line' }, h('div', {}, 'Compact spacing', h('small', {}, 'Tighter padding')), toggle('compact', 'Compact spacing', p.density === 'compact', (v) => { p.density = v ? 'compact' : 'comfortable'; app.restyle(); })),
        h('div', { class: 'line' }, h('div', {}, 'Reduce motion', h('small', {}, 'Hold the animations still')), toggle('reduce', 'Reduce motion', p.motion === 'reduce', (v) => { p.motion = v ? 'reduce' : 'auto'; app.restyle(); }))),
      h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'App'),
        autoLine,
        h('div', { class: 'line' }, h('div', {}, 'Opening animation', h('small', {}, 'Plays each time the app opens')), toggle('introToggle', 'Opening animation', p.intro !== false, (v) => { p.intro = v; app.restyle(); })),
        h('div', { class: 'line' }, h('div', {}, 'Run setup again', h('small', {}, 'The intro, then fonts, style and your story')), h('button', { class: 'btn', type: 'button', onclick: () => app.replayOnboarding() }, 'Replay')))));
}

// ---------------------------------------------------------------- story

function storyTab(app) {
  const root = h('div');
  const draft = JSON.parse(JSON.stringify(app.profile));
  let timer;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        app.setProfile(await put('/profile', { name: draft.name, character: draft.character }));
        toast('Saved');
      } catch (err) {
        toast(err.message);
      }
    }, 600);
  };
  const preview = storyPreview(draft);
  const form = characterForm(draft, app.profile.options, () => {
    preview.update();
    save();
  });

  const p = app.profile;
  const { unlocked, next } = chaptersFor(p, p.level);
  const chapters = h('div', {},
    ...unlocked.map((c) => h('div', { class: 'chapter' }, h('h3', {}, `${c.level}. ${c.title}`), h('p', {}, c.text))),
    next ? h('div', { class: 'chapter locked' }, h('h3', {}, `${next.level}. ${next.title}`), h('p', {}, `Unlocks at level ${next.level}. Keep looking after yourself.`)) : null);

  root.append(
    h('div', { class: 'cols' },
      h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Your character'), form),
      h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Preview'), preview.el)),
    h('div', { class: 'cols' },
      h('div', { class: 'panel' },
        h('div', { class: 'eyebrow' }, `Level ${p.level}`),
        h('div', { class: 'xpbar', style: 'border-color:var(--ink)' }, h('i', { style: `width:${Math.round(p.progress * 100)}%;background:var(--accent)` })),
        h('p', { class: 'lede', style: 'margin-top:8px' }, `${p.xp} XP. ${p.levelTo - p.xp} more for level ${p.level + 1}. You earn XP for water, breaks, and the small good habits in every division.`),
        h('div', { class: 'eyebrow' }, 'Recent'),
        ...(p.recent.length ? p.recent.map((e) => h('div', { class: 'line' }, h('span', {}, e.reason), h('span', { class: 'lab' }, `+${e.xp} XP`))) : [h('div', { class: 'empty' }, 'Nothing yet. Drink some water.')])),
      h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Chapters'), chapters)));
  return root;
}
