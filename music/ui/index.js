// Soundscapes: frontend entry. Same ctx contract as water/ui/index.js.
import { createEngine, SCAPE_INFO } from './engine.js';

const NAV_ICON = '<path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/>';
const SCAPE_ICONS = {
  tide: '<path d="M2 12c2.500-4 4.500-4 7 0s4.500 4 7 0 4.500-4 6 0"/><path d="M2 18c2.500-4 4.500-4 7 0s4.500 4 7 0 4.500-4 6 0" opacity=".5"/>',
  rain: '<path d="M7 15a4 4 0 1 1 1-7.900A5 5 0 0 1 17.500 9 3.500 3.500 0 0 1 17 15z"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>',
  focus: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5" opacity=".6"/><circle cx="12" cy="12" r="1.500"/>',
  lofi: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M21 12h-3" opacity=".6"/>',
  night: '<path d="M20 14.500A8 8 0 1 1 9.500 4a6.500 6.500 0 0 0 10.500 10.500z"/>',
};

export function mount(ctx) {
  const { h } = ctx;
  ctx.loadCss(new URL('./music.css', import.meta.url));
  const engine = createEngine();
  const svg = (markup) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = markup; // static markup defined above
    return s;
  };

  let state = null;
  let autoStarted = false; // sound that we started because an agent started, so we may fade it out again
  const settings = () => state.settings;

  // ---- layout ----
  const canvas = h('canvas', { class: 'mu-scope', 'aria-hidden': 'true' });
  const nowName = h('div', { class: 'mu-name' });
  const nowDesc = h('p', { class: 'mu-desc' });
  const playBtn = h('button', { class: 'btn primary big', type: 'button' });
  const volume = h('input', { id: 'mu-vol', type: 'range', min: 0, max: 100, step: 1, 'aria-label': 'Volume' });
  const unlock = h('div', { class: 'mu-unlock', hidden: true }, h('span', {}, 'Your browser needs one click before it will play sound.'), h('button', { class: 'btn', type: 'button', onclick: () => engine.unlock().then(() => { unlock.hidden = true; }) }, 'Allow sound'));
  const cards = h('div', { class: 'mu-cards' });

  const toggle = (id, label, sub, key) => {
    const input = h('input', { type: 'checkbox', id, 'aria-label': label, onchange: (e) => save({ [key]: e.target.checked }) });
    return { input, row: h('div', { class: 'line' }, h('div', {}, label, h('small', {}, sub)), h('label', { class: 'toggle' }, input, h('span'))) };
  };
  const autoT = toggle('mu-auto', 'Play while my agent works', 'Starts the soundscape when a run starts', 'auto');
  const fadeT = toggle('mu-fade', 'Fade out when it needs me', 'Only for sound it started itself: it fades when your agent asks for you or finishes', 'fade');

  const el = ctx.addView({ label: 'Soundscapes', icon: NAV_ICON, onShow: () => { refresh(); startScope(); } });
  el.append(
    h('div', { class: 'pad' },
      h('div', { class: 'cols' },
        h('div', { class: 'panel mu-now' },
          h('div', { class: 'eyebrow' }, 'Now playing'),
          canvas,
          h('div', { class: 'mu-row' }, h('div', {}, nowName, nowDesc), playBtn),
          unlock,
          h('div', { class: 'field mu-vol' }, h('label', { for: 'mu-vol' }, 'Volume'), volume),
          autoT.row, fadeT.row),
        h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Pick a scape'), cards,
          h('p', { class: 'lede', style: 'margin-top:12px;font-size:12px' }, 'Everything is generated live from noise and tones, so there are no audio files and nothing is downloaded.')))));

  // ---- settings ----
  let saveTimer;
  async function save(patch) {
    state.settings = { ...state.settings, ...patch };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        state = await ctx.call('PUT', 'settings', state.settings);
      } catch (err) {
        ctx.toast(err.message);
      }
    }, 400);
    paint();
  }

  async function refresh() {
    try {
      state = await ctx.call('GET', 'state');
    } catch {
      return;
    }
    engine.setVolume(settings().volume);
    paint();
  }
  ctx.onRefresh(refresh);

  // ---- playing ----
  async function play(id, { auto = false } = {}) {
    const ok = await engine.play(id);
    if (!ok) {
      unlock.hidden = false;
      return false;
    }
    unlock.hidden = true;
    autoStarted = auto;
    paint();
    return true;
  }
  function stop() {
    engine.stop(1.5);
    autoStarted = false;
    paint();
  }
  playBtn.addEventListener('click', () => (engine.playing ? stop() : play(settings().scape)));
  volume.addEventListener('input', (e) => {
    const v = Number(e.target.value) / 100;
    engine.setVolume(v);
    save({ volume: v });
  });
  // Any click in this page counts as the user allowing sound.
  el.addEventListener('pointerdown', () => engine.unlock().then((ok) => ok && (unlock.hidden = true)), { once: false });

  // ---- follow the agent ----
  let wasRunning = false;
  ctx.onAgentState((s) => {
    if (!state) return;
    const running = s.sessions.some((x) => x.status === 'running');
    const waiting = s.sessions.some((x) => x.status === 'waiting');
    if (running && !wasRunning && settings().auto && !engine.playing) play(settings().scape, { auto: true });
    if (!running && wasRunning && settings().fade && autoStarted && engine.playing) {
      engine.stop(3); // slow fade so it is gentle, not a jolt
      autoStarted = false;
      if (waiting) ctx.toast('Your agent needs you. Soundscape fading out.');
      paint();
    }
    wasRunning = running;
  });

  // ---- drawing ----
  function paint() {
    if (!state) return;
    const s = settings();
    const info = SCAPE_INFO[s.scape];
    nowName.textContent = engine.playing ? SCAPE_INFO[engine.currentId].name : 'Silent';
    nowDesc.textContent = engine.playing ? SCAPE_INFO[engine.currentId].desc : `${info.name} is ready. Press play.`;
    playBtn.textContent = engine.playing ? 'Stop' : `Play ${info.name}`;
    volume.value = String(Math.round(s.volume * 100));
    autoT.input.checked = s.auto;
    fadeT.input.checked = s.fade;
    cards.replaceChildren(...state.scapes.map((id) =>
      h('button', { class: 'mu-card', type: 'button', 'aria-pressed': String(id === (engine.currentId ?? s.scape)), onclick: async () => { await save({ scape: id }); play(id); } },
        h('span', { class: 'mu-ico' }, svg(SCAPE_ICONS[id])), h('b', {}, SCAPE_INFO[id].name), h('small', {}, SCAPE_INFO[id].desc))));
    ctx.setSummary(!state.enabled ? '' : engine.playing ? `Playing: ${SCAPE_INFO[engine.currentId].name}` : 'Silent');
  }

  let raf = 0;
  const colors = { line: '#333', ink: '#000', run: '#63c8c1' };
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    for (const k of Object.keys(colors)) colors[k] = cs.getPropertyValue(`--${k === 'ink' ? 'ink' : k}`).trim() || colors[k];
  };
  ctx.onTheme(readColors);
  readColors();
  const PALETTE = ['#b89cff', '#63c8c1', '#ffd84d', '#ff9ec4', '#7fb3ff'];

  function draw(now) {
    if (el.hidden) {
      raf = 0;
      return;
    }
    const g = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const hh = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hh * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hh * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    const bars = Math.max(16, Math.floor(w / 14));
    const data = new Uint8Array(engine.analyser ? engine.analyser.frequencyBinCount : 0);
    if (engine.analyser) engine.analyser.getByteFrequencyData(data);
    const gap = 4;
    const bw = (w - gap * (bars - 1)) / bars;
    for (let i = 0; i < bars; i++) {
      // low frequencies matter most to the ear, so sample the first part of the spectrum more densely
      const v = engine.playing && data.length ? data[Math.floor((i / bars) ** 1.6 * data.length * 0.6)] / 255 : 0.06 + 0.04 * Math.sin(now / 700 + i * 0.5);
      const bh = Math.max(4, v * hh * 0.92);
      g.fillStyle = PALETTE[i % PALETTE.length];
      const x = i * (bw + gap);
      const r = Math.min(4, bw / 2);
      g.beginPath();
      g.moveTo(x, hh);
      g.lineTo(x, hh - bh + r);
      g.quadraticCurveTo(x, hh - bh, x + r, hh - bh);
      g.lineTo(x + bw - r, hh - bh);
      g.quadraticCurveTo(x + bw, hh - bh, x + bw, hh - bh + r);
      g.lineTo(x + bw, hh);
      g.closePath();
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = colors.ink;
      g.stroke();
    }
    raf = requestAnimationFrame(draw);
  }
  function startScope() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  refresh();
}
