// Qeuli: boot, routing, navigation, and the bridge between the app and each feature's UI.
import { $, h, api, put, post, toast, store, icon, BASE, reducedMotion } from './lib.js';
import { BRAND, DIVISIONS } from './brand.js';
import { BUILTIN, applyTheme } from './themes.js';
import { applyLook } from './looks.js';
import { buildHome } from './home.js';
import { buildSettings } from './settings.js';
import { buildQueue } from './queue.js';
import { runOnboarding } from './onboarding.js';
import { chaptersFor } from './story.js';

document.title = BRAND.name;

// ---------------------------------------------------------------- preferences (UI-only, kept in this webview)

const prefs = {
  theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'ink' : 'paper',
  accent: null,
  radius: 8,
  density: 'comfortable',
  motion: 'auto',
  font: 'sticker',
  look: 'sticker',
  layout: 'sidebar',
  intro: true,
  ...store.get('aw.prefs', {}),
};
prefs.layout = 'sidebar'; // the sidebar is the only layout; older saved choices are overridden
let custom = store.get('aw.themes', []);

const PLACEHOLDER_PROFILE = {
  onboarded: true, // never run first-time setup until the daemon has told us the truth
  name: '', character: { sigil: 'hawk', role: 'Builder', quest: 'Ship the thing', vibe: 'Calm', origin: '' },
  xp: 0, level: 1, levelFrom: 0, levelTo: 25, progress: 0, recent: [],
  options: { sigils: ['hawk', 'wave', 'ember', 'moss', 'volt', 'dusk'], roles: ['Builder', 'Tinkerer', 'Architect', 'Explorer', 'Maker', 'Debugger'], quests: ['Ship the thing', 'Learn deeply', 'Build in public', 'Stay healthy', 'Find calm'], vibes: ['Calm', 'Bold', 'Playful', 'Focused'] },
};

const themeHooks = [];
const stateHooks = [];

/** Everything pages and features may use. Built once, passed around instead of imported (no cycles). */
const app = {
  prefs,
  online: false,
  state: { sessions: [], queue: [], today: { waitMs: 0, runs: 0 } },
  profile: PLACEHOLDER_PROFILE,
  features: [],
  summaries: new Map(), // feature id -> short live text for its card
  chips: new Map(), // feature id -> small node on the Home banner
  featureIcons: new Map(),
  allThemes: () => [...BUILTIN, ...custom],
  currentTheme: () => app.allThemes().find((t) => t.id === prefs.theme) || BUILTIN[0],
  featuresIn: (division) => app.features.filter((f) => (f.division || 'productivity') === division),
  onTheme: (fn) => themeHooks.push(fn),
  onState: (fn) => stateHooks.push(fn),
  restyle() {
    applyTheme(app.currentTheme(), prefs);
    applyLook(prefs);
    themeHooks.forEach((fn) => fn());
    store.set('aw.prefs', prefs);
  },
  setTheme(id) {
    prefs.theme = id;
    app.restyle();
  },
  addTheme(t) {
    custom = [...custom.filter((x) => x.id !== t.id), t];
    store.set('aw.themes', custom);
    app.setTheme(t.id);
  },
  setProfile(next) {
    const before = app.profile.level;
    app.profile = next;
    paintProfile();
    if (next.level > before && app.profile.onboarded && before >= 1 && app.online) {
      const c = chaptersFor(next, next.level).current;
      toast(`Level ${next.level}!${c && c.level === next.level ? ` New chapter: ${c.title}` : ''}`);
    }
    home.update();
  },
  async refreshProfile() {
    try {
      app.setProfile(await api('/profile'));
    } catch {}
  },
  async reloadFeatures() {
    try {
      app.features = await api('/features');
    } catch {
      return;
    }
    await mountFeatures();
    route();
  },
  replayOnboarding: () => runOnboarding(app, { first: true }),
};

// ---------------------------------------------------------------- pages and routing

const pagesEl = $('pages');
const home = buildHome(app);
const settings = buildSettings(app);
const queue = buildQueue(app);
const featurePages = new Map(); // feature id -> { el, onShow }
let divisionEl = null;
pagesEl.append(home.el, settings.el, queue.el);

const HOME_ICON = '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>';

function buildNav() {
  const link = (href, label, markup, color, key) =>
    h('a', { class: 'navlink', href, 'data-key': key, style: color ? `--c:${color}` : '' }, icon(markup), h('span', {}, label));
  $('navlinks').replaceChildren(link('#/', 'Home', HOME_ICON, null, 'home'), ...DIVISIONS.map((d) => link(`#/d/${d.id}`, d.name, d.icon, d.color, d.id)));
}

function setNav(key) {
  document.querySelectorAll('#navlinks .navlink').forEach((a) => (a.dataset.key === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const gear = $('settingsBtn');
  key === 'settings' ? gear.setAttribute('aria-current', 'page') : gear.removeAttribute('aria-current');
}

function hideAll() {
  for (const el of pagesEl.children) el.hidden = true;
}

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b] = parts;
  hideAll();
  let key = 'home';
  if (a === 'd' && DIVISIONS.some((d) => d.id === b)) {
    key = b;
    showDivision(DIVISIONS.find((d) => d.id === b));
  } else if (a === 'f' && featurePages.has(b)) {
    const f = app.features.find((x) => x.id === b);
    key = f?.division || 'productivity';
    const page = featurePages.get(b);
    page.el.hidden = false;
    page.onShow?.();
  } else if (a === 'queue') {
    key = 'web';
    queue.el.hidden = false;
    queue.onShow();
  } else if (a === 'settings') {
    key = 'settings';
    settings.el.hidden = false;
    settings.show(b);
  } else {
    home.el.hidden = false;
    home.onShow();
  }
  setNav(key);
  $('main').scrollTo({ top: 0 });
}

// ---- a division page: its feature cards ----

function featureCard(f, d, i) {
  const markup = app.featureIcons.get(f.id) || d.icon;
  const summary = h('div', { class: 'summary' }, app.summaries.get(f.id) || (f.enabled ? '' : 'Off'));
  const toggle = h('label', { class: 'toggle', title: f.enabled ? 'On' : 'Off' },
    h('input', { type: 'checkbox', 'aria-label': `${f.name} enabled`, checked: f.enabled, onchange: async (e) => {
      try {
        await post(`/features/${f.id}/enabled`, { enabled: e.target.checked });
        await app.reloadFeatures();
      } catch (err) {
        toast(err.message);
      }
    } }), h('span'));
  return h('article', { class: 'fcard', 'data-off': String(!f.enabled), style: `--c:${d.color};--i:${i}` },
    h('header', {}, h('span', { class: 'dicon' }, icon(markup)), h('h3', {}, f.name)),
    h('div', { class: 'body' }, h('p', {}, f.description), summary),
    h('footer', {}, f.ui ? h('a', { class: 'btn primary', href: `#/f/${f.id}` }, 'Open →') : h('span', { class: 'lab' }, 'Reminders only'), toggle));
}

function showDivision(d) {
  const feats = app.featuresIn(d.id);
  const cards = feats.map((f, i) => featureCard(f, d, i));
  if (d.id === 'web') {
    cards.push(h('article', { class: 'fcard', style: `--c:${d.color};--i:${cards.length}` },
      h('header', {}, h('span', { class: 'dicon' }, icon('<path d="M4 6h16M4 12h11M4 18h6"/>')), h('h3', {}, 'Reading queue')),
      h('div', { class: 'body' }, h('p', {}, 'Links saved for waits. One is offered when its length fits the time you have.'), h('div', { class: 'summary' }, `${app.state.queue.length} saved`)),
      h('footer', {}, h('a', { class: 'btn primary', href: '#/queue' }, 'Open →'), h('span', { class: 'lab' }, 'Built in'))));
  }
  const el = h('section', { class: 'page', id: `page-d-${d.id}` },
    h('div', { class: 'pagehead' }, h('div', {},
      h('a', { class: 'kicker', href: '#/', style: `--c:${d.color}` }, h('i', {}, '←'), 'Home'),
      h('h1', {}, d.name), h('p', {}, d.blurb))),
    cards.length ? h('div', { class: 'fgrid' }, ...cards) : h('div', { class: 'panel' }, h('div', { class: 'empty' }, h('b', {}, 'Nothing here yet. '), 'Features for this division are on their way.')));
  divisionEl?.remove();
  divisionEl = el;
  pagesEl.append(el);
}

// ---------------------------------------------------------------- features: the bridge

const mounted = new Set();
const refreshers = [];
const refreshAll = () => refreshers.forEach((fn) => fn());
let cardTimer;
const refreshCards = () => {
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => {
    home.updateDivisions();
    if (divisionEl && !divisionEl.hidden) route(); // keep an open division page's summaries live
  }, 120);
};

function makeCtx(f) {
  const id = f.id;
  return {
    h,
    toast,
    call: async (method, route_, body) => {
      const out = await api(`/features/${id}/${route_}`, method === 'GET' ? undefined : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
      if (method !== 'GET') setTimeout(() => app.refreshProfile(), 250); // actions may have earned XP
      return out;
    },
    addView({ icon: markup, onShow }) {
      if (markup) app.featureIcons.set(id, markup);
      const d = DIVISIONS.find((x) => x.id === (f.division || 'productivity')) || DIVISIONS[1];
      const el = h('section', { class: 'page feature', id: `view-${id}`, hidden: true },
        h('div', { class: 'pagehead' }, h('div', {},
          h('a', { class: 'kicker', href: `#/d/${d.id}`, style: `--c:${d.color}` }, h('i', {}, '←'), d.name),
          h('h1', {}, f.name), h('p', {}, f.description))));
      pagesEl.append(el);
      featurePages.set(id, { el, onShow });
      return el;
    },
    showView: () => { location.hash = `#/f/${id}`; },
    setChip(node) {
      node ? app.chips.set(id, node) : app.chips.delete(id);
      home.update();
    },
    setSummary(text) {
      text ? app.summaries.set(id, text) : app.summaries.delete(id);
      refreshCards();
    },
    onRefresh: (fn) => refreshers.push(fn),
    onTheme: (fn) => themeHooks.push(fn),
    onAgentState: (fn) => {
      stateHooks.push(fn);
      fn(app.state);
    },
    award: (xp, reason) => post('/profile/award', { xp, reason }).then((v) => { app.setProfile(v); return v; }).catch(() => null),
    loadCss: (url) => document.head.append(h('link', { rel: 'stylesheet', href: String(url) })),
  };
}

let mounting = false;
async function mountFeatures() {
  if (mounting) return;
  mounting = true;
  try {
    for (const f of app.features) {
      if (!f.builtin || !f.ui || mounted.has(f.id)) continue;
      try {
        const mod = await import(`./features/${f.id}/index.js`);
        mod.mount(makeCtx(f));
        mounted.add(f.id);
      } catch (err) {
        console.error(`feature "${f.id}" failed to load`, err);
      }
    }
  } finally {
    mounting = false;
  }
}

// ---------------------------------------------------------------- live state

function paintProfile() {
  const p = app.profile;
  $('levelChip').hidden = !app.online;
  $('levelNum').textContent = String(p.level);
  $('levelText').textContent = p.name ? `${p.name} · Lv ${p.level}` : `Level ${p.level}`;
}

function setOnline(v) {
  if (v === app.online && $('link').dataset.init) return;
  const was = app.online;
  app.online = v;
  $('link').dataset.init = '1';
  $('link').className = `link ${v ? 'on' : 'off'}`;
  $('link').title = v ? 'Daemon connected' : 'Daemon not reachable. Retrying…';
  paintProfile();
  home.update();
  if (v && !was) bootstrap();
}

function connect() {
  const es = new EventSource(`${BASE}/stream`);
  es.onmessage = (e) => {
    app.state = JSON.parse(e.data);
    setOnline(true);
    home.onState(app.state);
    queue.update();
    stateHooks.forEach((fn) => fn(app.state));
  };
  es.onerror = () => setOnline(false);
}

let booted = false;
async function bootstrap() {
  if (booted) return;
  booted = true;
  try {
    app.profile = await api('/profile');
    app.features = await api('/features');
  } catch {
    booted = false;
    return;
  }
  paintProfile();
  await mountFeatures();
  home.updateDivisions();
  route();
  // First launch runs setup (fonts, style, story). Later launches just play the intro.
  if (!app.profile.onboarded) await runOnboarding(app, { first: true });
  else if (prefs.intro !== false && document.visibilityState === 'visible') await runOnboarding(app, { first: false });
  route();
}

// ---------------------------------------------------------------- start

app.restyle();
buildNav();
paintProfile();
addEventListener('hashchange', route);
route();
connect();
setInterval(refreshAll, 30_000);
setInterval(() => app.refreshProfile(), 45_000);
addEventListener('focus', () => {
  refreshAll();
  app.refreshProfile();
});
