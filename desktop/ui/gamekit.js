// The shelf and the game window, shared by every game feature (Arcade, Typing, Memory...).
//
// A feature's screen is a shelf of game cards. Opening one puts a window over the page that starts on
// a setup screen (that game's options and an "Okay, start" button); the game begins when you press it.
// Bests are kept per set of options, so Fast never competes with Chill.
//
// A feature mounts it with:
//   mountShelf(ctx, { id, label, icon, options, games })
// where `games` is { gameId: { mount(host, env), color, blurb, icon, tip } } and `options` is the
// feature's option map (see gameopts.js). A game's mount gets env = { h, opts, active(), end(score) }
// and returns { stop() }; `active()` is false while the screen is hidden, so games never run behind your back.
import { createOptions } from './gameopts.js';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let cssLoaded = false;

// ---- the window: dialog semantics, Tab stays inside, Esc or a click outside closes it, focus goes back ----

function openModal({ h, parent, title, color, onClose }) {
  const opener = document.activeElement;
  const titleEl = h('h2', { class: 'gk-mtitle', id: 'gk-mtitle' }, title);
  const sub = h('div', { class: 'gk-msub' });
  const body = h('div', { class: 'gk-mbody' });
  const closeBtn = h('button', { class: 'gk-mclose', type: 'button', 'aria-label': 'Close', onclick: () => close() }, '×');
  const win = h('div', { class: 'gk-mwin', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gk-mtitle', tabindex: -1, style: color ? `--game:${color}` : null },
    h('div', { class: 'gk-mhead' }, h('div', {}, titleEl, sub), closeBtn), body);
  const scrim = h('div', { class: 'gk-modal', onmousedown: (e) => { if (e.target === scrim) close(); } }, win);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    removeEventListener('keydown', onKey, true);
    scrim.classList.add('out');
    setTimeout(() => scrim.remove(), 160); // let the exit play; with reduced motion the duration is ~0
    onClose?.();
    if (opener?.isConnected) opener.focus?.({ preventScroll: true });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...win.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === win)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  parent.append(scrim);
  addEventListener('keydown', onKey, true);
  win.focus({ preventScroll: true });

  return { body, close, setSub: (t) => { sub.textContent = t; } };
}

const fmtScore = (v, unit) => (v === null || v === undefined ? 'none yet' : `${v} ${unit}`);

export function mountShelf(ctx, { id: featureId, label, icon, options: OPTIONS, games: GAMES }) {
  const { h } = ctx;
  const opt = createOptions(OPTIONS);
  if (!cssLoaded) {
    ctx.loadCss(new URL('./gamekit.css', import.meta.url));
    cssLoaded = true;
  }
  const svg = (markup) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = markup; // static markup supplied by the feature
    return s;
  };

  const KEY = `qeuli.games.${featureId}.options`;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private window: options just reset next time */ } };

  let state = null;
  const saved = read();
  let session = null; // { id, modal, opts, game, banner, ... } while a game window is open
  const cards = h('div', { class: 'gk-cards' });
  const banner = h('div', { class: 'gk-banner', hidden: true });

  const el = ctx.addView({ label, icon, onShow: () => refresh() });
  el.append(h('div', { class: 'pad gk' }, banner, cards));

  async function refresh() {
    try {
      state = await ctx.call('GET', 'state');
    } catch {
      return;
    }
    render();
  }
  ctx.onRefresh(refresh);

  function render() {
    cards.replaceChildren(...Object.entries(state.scores).map(([id, s]) => {
      const g = GAMES[id];
      return h('button', { class: 'gk-card', type: 'button', style: `--game:${g.color}`, onclick: () => open(id) },
        h('span', { class: 'gk-cover' }, svg(g.icon), h('span', { class: 'gk-play' }, 'Play')),
        h('span', { class: 'gk-info-col' },
          h('b', {}, s.name),
          h('small', {}, g.blurb),
          h('span', { class: 'gk-best' }, s.best === null ? 'No score yet' : `Best ${s.best} ${s.unit}`)));
    }));
    ctx.setSummary(!state.enabled ? '' : state.plays ? `${state.plays} game${state.plays === 1 ? '' : 's'} played` : 'Pick a game');
    if (session) paintHeader();
  }

  // ---- the game window ----

  function open(id) {
    session?.modal.close();
    const modal = openModal({ h, parent: el, title: state.scores[id].name, color: GAMES[id].color, onClose: () => teardown() });
    session = { id, modal, game: null, opts: opt.chosen(id, saved), banner: h('div', { class: 'gk-banner', hidden: true }) };
    paintBanner();
    showSetup();
  }

  function teardown() {
    session?.game?.stop();
    session = null;
  }

  function paintHeader() {
    const { id, opts, modal } = session;
    const s = state.scores[id];
    const mine = s.variants?.[opt.variantOf(id, opts)]?.best ?? null;
    modal.setSub(`Best on these settings: ${fmtScore(mine, s.unit)}${s.best !== null && s.best !== mine ? `  ·  best ever ${s.best}` : ''}`);
  }

  /** Step one: choose the options, then press the button. Nothing runs until you do. */
  function showSetup() {
    const { id, opts, modal } = session;
    session.game?.stop();
    session.game = null;

    const optionsBar = h('div', { class: 'gk-opts' });
    const paintOptions = () => optionsBar.replaceChildren(...opt.visible(id, opts).map((o) =>
      h('div', { class: 'gk-opt', role: 'group', 'aria-label': o.label },
        h('span', { class: 'gk-optlab' }, o.label),
        h('div', { class: 'gk-seg' }, ...o.choices.map(([value, text]) =>
          h('button', {
            type: 'button', 'aria-pressed': String(opts[o.id] === value),
            onclick: () => {
              if (opts[o.id] === value) return;
              opts[o.id] = value;
              saved[id] = { ...opts };
              write(saved);
              paintOptions(); // some choices show or hide others
              paintHeader();
            },
          }, text))))));
    paintOptions();

    const start = h('button', { class: 'btn primary big gk-start', type: 'button', onclick: () => showPlay() }, 'Okay, start');
    modal.body.replaceChildren(
      session.banner,
      h('p', { class: 'gk-lede' }, GAMES[id].blurb, ' ', GAMES[id].tip),
      optionsBar,
      h('div', { class: 'gk-startrow' }, start));
    paintHeader();
    start.focus({ preventScroll: true });
  }

  /** Step two: the game, with the options out of the way so the board can be big. */
  function showPlay() {
    const { id, opts, modal } = session;
    session.result = h('div', { class: 'gk-flash', hidden: true });
    session.stage = h('div', { class: 'gk-stage' });
    modal.body.replaceChildren(
      session.banner,
      h('div', { class: 'gk-strip' },
        h('button', { class: 'btn quiet', type: 'button', onclick: () => showSetup() }, '← Settings'),
        h('span', { class: 'gk-settings' }, opt.describe(id, opts))),
      session.result,
      session.stage);
    paintHeader();
    launch();
  }

  function launch() {
    const { id, opts } = session;
    session.game?.stop();
    session.result.hidden = true;
    const host = h('div', { class: 'gk-host' });
    session.stage.replaceChildren(host);
    session.game = GAMES[id].mount(host, {
      h,
      opts: { ...opts },
      active: () => !el.hidden && !document.hidden && !!session,
      end: (score) => finished(id, opts, score),
    });
    host.querySelector('input, textarea, [tabindex="0"]')?.focus({ preventScroll: true });
  }

  async function finished(id, opts, score) {
    const mine = session;
    try {
      const r = await ctx.call('POST', 'score', { game: id, score, variant: opt.variantOf(id, opts) });
      state = r;
      render();
      if (session !== mine) return; // closed while saving: nothing left to show
      const s = r.scores[id];
      mine.result.hidden = false;
      mine.result.dataset.best = String(r.isBest);
      mine.result.replaceChildren(
        h('span', { class: 'gk-resmsg' }, r.isBest ? `New best: ${score} ${s.unit}` : `Finished: ${score} ${s.unit}`),
        h('button', { class: 'btn primary', type: 'button', onclick: () => launch() }, 'Play again'),
        h('button', { class: 'btn', type: 'button', onclick: () => showSetup() }, 'Settings'),
        h('button', { class: 'btn quiet', type: 'button', onclick: () => mine.modal.close() }, 'Close'));
      if (r.isBest) burst(mine.result);
    } catch (err) {
      ctx.toast(err.message);
    }
  }

  /** A little confetti over the result bar. Pure decoration: reduced motion collapses it to nothing. */
  function burst(host) {
    const colors = ['#ffd84d', '#ff9ec4', '#63c8c1', '#b89cff', '#8bd66b', '#ffa463'];
    const layer = h('span', { class: 'gk-confetti', 'aria-hidden': 'true' });
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 70;
      layer.append(h('i', { style: `--dx:${Math.round(Math.cos(angle) * dist)}px;--dy:${Math.round(Math.sin(angle) * dist - 20)}px;--r:${Math.round(Math.random() * 540 - 270)}deg;background:${colors[i % colors.length]}` }));
    }
    host.append(layer);
    setTimeout(() => layer.remove(), 1400);
  }

  // The moment your agent needs you or finishes, say so, loudly enough to notice mid-game.
  let agentMessage = '';
  let wasRunning = false;
  function paintBanner() {
    for (const b of [banner, session?.banner]) {
      if (!b) continue;
      b.hidden = !agentMessage;
      if (!agentMessage) continue;
      b.replaceChildren(
        h('span', {}, agentMessage),
        h('a', { class: 'btn', href: '#/', onclick: () => { agentMessage = ''; session?.modal.close(); paintBanner(); } }, 'Back to it'),
        h('button', { class: 'btn quiet', type: 'button', onclick: () => { agentMessage = ''; paintBanner(); } }, 'Keep playing'));
    }
  }
  ctx.onAgentState((s) => {
    const live = s.sessions.some((x) => x.status === 'running');
    if (wasRunning && !live && !el.hidden) {
      const waiting = s.sessions.find((x) => x.status === 'waiting');
      agentMessage = waiting ? `${waiting.name || 'Your agent'} needs you.` : 'Your agent is done.';
      paintBanner();
    }
    if (live && agentMessage) {
      agentMessage = '';
      paintBanner();
    }
    wasRunning = live;
  });

  refresh();
}
