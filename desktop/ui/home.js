// Home: the hero, the tide, today's numbers, what your agent is doing, and every division.
import { h, api, post, toast, openUrl, fmt, nameOf, icon } from './lib.js';
import { DIVISIONS } from './brand.js';
import { createTide } from './tide.js';
import { greeting } from './story.js';
import { SIGIL_COLORS } from './story.js';

export function buildHome(app) {
  const el = h('section', { class: 'page', id: 'page-home', hidden: true });

  // ---- hero ----
  const hiDot = h('i');
  const hiText = h('span');
  const phrase = h('h1', { class: 'phrase', 'aria-live': 'polite' }, 'Quiet.');
  const sub = h('p', { class: 'sub' });
  const cta = h('div', { class: 'cta' },
    h('a', { class: 'btn primary big', href: '#/d/health' }, 'Take a break →'),
    h('a', { class: 'btn big', href: '#divisions', onclick: (e) => { e.preventDefault(); divisions.scrollIntoView({ behavior: 'smooth' }); } }, 'Explore'));
  const art = h('div', { class: 'hero-art', 'aria-hidden': 'true' },
    h('i', { class: 'spark' }), h('i', { class: 'spark' }), h('i', { class: 'spark' }), h('i', { class: 'spark' }),
    h('div', { class: 'streaks' }, h('i'), h('i'), h('i'), h('i')),
    h('div', { class: 'hawk' }));
  const hero = h('div', { class: 'hero' }, h('div', {}, h('span', { class: 'hi' }, hiDot, hiText), phrase, sub, cta), art);

  // ---- tide band ----
  const canvas = h('canvas', { id: 'tide', 'aria-hidden': 'true' });
  const tidewrap = h('div', { class: 'tidewrap' }, canvas);
  const tide = createTide(canvas);
  app.onTheme(() => tide.refresh());

  // ---- today ----
  const stats = h('div', { class: 'stats' });
  const chips = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:16px' });
  const banner = h('section', { class: 'banner' }, h('h2', { class: 'band-title' }, 'Today'), stats, chips);

  // ---- runs and the wait ----
  const sessions = h('div');
  const use = h('div', { class: 'use' });
  const cols = h('div', { class: 'cols' },
    h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Runs'), sessions),
    h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Use the wait'), use));

  // ---- divisions ----
  const grid = h('div', { class: 'dgrid' });
  const divisions = h('div', { id: 'divisions' }, h('div', { class: 'eyebrow' }, 'Everything'), grid);

  el.append(hero, tidewrap, banner, cols, divisions);

  // ---------------------------------------------------------------- state
  let lastDone = null; // { name, at, ranMs }
  const prevStatus = new Map();
  let suggestKey = '';

  const primary = () => {
    const live = app.state.sessions.filter((s) => s.status !== 'idle');
    return live.find((s) => s.status === 'waiting') || live.sort((a, b) => b.since - a.since)[0] || null;
  };

  function trackTransitions(next) {
    for (const s of next.sessions) {
      const prev = prevStatus.get(s.id);
      if ((prev === 'running' || prev === 'waiting') && s.status === 'idle') {
        lastDone = { name: nameOf(s), at: Date.now(), ranMs: s.runStart ? Date.now() - s.runStart : null };
        setTimeout(update, 8100);
      }
      prevStatus.set(s.id, s.status);
    }
  }

  function mode() {
    const p = primary();
    const settled = !p && lastDone && Date.now() - lastDone.at < 8000;
    return { p, settled, mode: !app.online ? 'quiet' : p ? p.status : settled ? 'settled' : 'quiet' };
  }

  function updateHero() {
    const { p, settled, mode: m } = mode();
    phrase.dataset.s = m;
    art.dataset.s = m;
    phrase.textContent = !app.online ? 'Offline.' : p ? `${nameOf(p)} ${p.status === 'waiting' ? 'needs you' : 'is working'}.` : settled ? `${lastDone.name} is done.` : 'Quiet.';
    tide.set(m === 'settled' ? 'settled' : m, p?.progress ?? null);
    const color = SIGIL_COLORS[app.profile.character.sigil] || SIGIL_COLORS.hawk;
    hiDot.style.background = color;
    hiText.textContent = greeting(app.profile);
    updateCaption();
  }

  function updateCaption() {
    const { p, settled } = mode();
    let text;
    if (!app.online) text = 'Starting the local daemon. If this stays, open Settings > Connections.';
    else if (p) {
      const parts = [p.status === 'waiting' ? p.message || 'Waiting for your input' : `${fmt(Date.now() - (p.runStart || p.since))} elapsed`];
      if (p.status === 'running' && p.progress != null) parts.push(`${Math.round(p.progress)}%`);
      if (p.status === 'running' && p.activity) parts.push(`${p.activity.tool}${p.activity.target ? ` ${p.activity.target}` : ''}`);
      else if (p.status === 'running' && p.message) parts.push(p.message);
      text = parts.join('  ·  ');
    } else if (settled) text = lastDone.ranMs ? `Ran ${fmt(lastDone.ranMs)}.` : 'Finished.';
    else text = 'Nothing running. When an agent starts working, the hawk takes flight.';
    sub.textContent = text;
  }
  setInterval(updateCaption, 1000);

  function updateStats() {
    const s = app.state;
    const pr = app.profile;
    stats.replaceChildren(
      h('div', { class: 'stat' }, h('span', { class: 'lab' }, 'Agent runs'), h('b', {}, String(s.today.runs))),
      h('div', { class: 'stat' }, h('span', { class: 'lab' }, 'Minutes waited'), h('b', {}, String(Math.round(s.today.waitMs / 60000)))),
      h('div', { class: 'stat' }, h('span', { class: 'lab' }, `Level ${pr.level}`), h('b', {}, `${pr.xp} XP`),
        h('div', { class: 'xpbar' }, h('i', { style: `width:${Math.round(pr.progress * 100)}%` })),
        h('small', {}, `${pr.levelTo - pr.xp} to level ${pr.level + 1}`)));
    chips.replaceChildren(...app.chips.values());
  }

  function updateSessions() {
    // Finished runs stay visible for ten minutes, then drop off.
    const live = app.state.sessions.filter((s) => s.status !== 'idle' || Date.now() - s.since < 600_000);
    sessions.replaceChildren(...(live.length
      ? live.map((s) =>
          h('div', { class: 'session' },
            h('div', { class: 'name' }, h('span', { class: 'dot', 'data-s': s.status }), nameOf(s)),
            h('div', { class: 'word' }, s.status === 'running' && s.progress != null ? `${Math.round(s.progress)}%` : { running: 'working', waiting: 'needs you', idle: 'idle' }[s.status]),
            s.status === 'running' && s.progress != null ? h('div', { class: 'bar' }, h('i', { style: `width:${s.progress}%` })) : null,
            s.activity && s.status === 'running' ? h('div', { class: 'note' }, `${s.activity.tool}${s.activity.target ? ` · ${s.activity.target}` : ''}`) : s.message || s.cwd ? h('div', { class: 'note' }, s.message || s.cwd) : null))
      : [h('div', { class: 'empty' }, h('b', {}, 'No runs yet. '), 'Connect Claude Code under Settings > Connections, or add a process to watch.')]));
  }

  async function updateUse() {
    const p = primary();
    if (!p) {
      suggestKey = '';
      use.replaceChildren(h('p', { class: 'what' }, 'Nothing to wait for.'), h('div', { class: 'row' }, h('span', {}, 'When an agent starts working, I will suggest a read or a break that fits the time.'), h('a', { class: 'btn', href: '#/d/games' }, 'Play something')));
      return;
    }
    const key = `${p.id}:${p.runStart}`;
    if (key === suggestKey) return;
    suggestKey = key;
    loadSuggestion();
  }

  async function loadSuggestion() {
    const p = primary();
    if (!p) return;
    // Estimate the time left from progress when we have it, otherwise assume five minutes.
    let minutes = 5;
    if (p.progress > 5) {
      const elapsed = (Date.now() - (p.runStart || p.since)) / 60000;
      minutes = Math.max(1, Math.round((elapsed * (100 - p.progress)) / p.progress));
    }
    try {
      const s = await api(`/suggest?minutes=${minutes}`);
      use.replaceChildren(
        h('p', { class: 'what' }, s.title),
        h('div', { class: 'row' },
          h('span', {}, s.kind === 'read' ? `~${s.minutes} min read` : `${s.minutes} min break`),
          s.kind === 'read'
            ? [h('button', { class: 'btn primary', type: 'button', onclick: () => openUrl(s.url) }, 'Open'), h('button', { class: 'btn', type: 'button', onclick: async () => { await post(`/queue/${s.id}/done`); toast('Marked read'); loadSuggestion(); } }, 'Mark read')]
            : h('button', { class: 'btn', type: 'button', onclick: loadSuggestion }, 'Another')));
    } catch {}
  }

  function updateDivisions() {
    grid.replaceChildren(...DIVISIONS.map((d, i) => {
      const feats = app.featuresIn(d.id);
      const sums = feats.map((f) => app.summaries.get(f.id)).filter(Boolean).slice(0, 2);
      return h('a', { class: 'dcard', href: `#/d/${d.id}`, style: `--c:${d.color};--i:${i}` },
        h('div', {}, h('span', { class: 'dicon' }, icon(d.icon)), h('h3', {}, d.name), h('p', {}, d.blurb)),
        h('div', { class: 'foot' },
          h('div', { class: 'sum' }, ...(sums.length ? sums.map((s) => h('b', {}, s)) : [h('span', {}, `${feats.length} ${feats.length === 1 ? 'feature' : 'features'}`)])),
          h('span', { class: 'go' }, 'Open →')));
    }));
  }

  function update() {
    updateHero();
    updateStats();
    updateSessions();
    updateUse();
  }

  return {
    el,
    update,
    updateDivisions,
    onState: (next) => {
      trackTransitions(next);
      update();
    },
    onShow: () => {
      tide.refresh();
      update();
      updateDivisions();
    },
  };
}
