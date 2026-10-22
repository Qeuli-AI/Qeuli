// The opening animation, and (first run only) the setup: fonts and style,
// then your story. Everything restyles live behind your choices, so you see exactly what you pick.
import { h, put, post, toast, reducedMotion } from './lib.js';
import { BRAND } from './brand.js';
import { FONT_PACKS, LOOKS } from './looks.js';
import { characterForm, storyPreview } from './character.js';

const rgba = (hex, a) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
};

/** The tide rising behind the logo, drawn on a canvas. Returns a stop function. */
function tideBackdrop(canvas, still) {
  const ctx = canvas.getContext('2d');
  const t0 = performance.now();
  let w = 0;
  let hh = 0;
  let raf = 0;
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    w = canvas.clientWidth;
    hh = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const draw = (now) => {
    const t = (now - t0) / 1000;
    const rise = still ? 1 : 1 - (1 - Math.min(1, t / 2.6)) ** 3;
    const level = 0.1 + 0.4 * rise;
    const amp = still ? 8 : 8 + 26 * Math.exp(-t * 0.9);
    ctx.clearRect(0, 0, w, hh);
    [{ k: 1, p: 0, a: 0.26, c: '#63c8c1' }, { k: 1.6, p: 2, a: 0.18, c: '#b89cff' }, { k: 0.7, p: 4, a: 0.14, c: '#ffd84d' }].forEach((L, i) => {
      const base = hh - level * hh + i * 8;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = base + Math.sin(x * 0.008 * L.k + t * (0.9 + i * 0.4) + L.p) * amp * L.k;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      if (i === 0) {
        ctx.strokeStyle = L.c;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.lineTo(w, hh);
      ctx.lineTo(0, hh);
      ctx.closePath();
      ctx.fillStyle = rgba(L.c, L.a);
      ctx.fill();
    });
  };
  const frame = (now) => {
    draw(now);
    raf = requestAnimationFrame(frame);
  };
  new ResizeObserver(() => {
    fit();
    draw(performance.now());
  }).observe(canvas);
  fit();
  draw(performance.now());
  if (!still) raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

function intro(root) {
  return new Promise((resolve) => {
    const still = reducedMotion();
    const canvas = h('canvas', { 'aria-hidden': 'true' });
    const letters = [...BRAND.name.toUpperCase()].map((c, i) => h('span', { style: `--i:${i}` }, c));
    const skip = h('button', { class: 'btn skip', type: 'button' }, 'Skip');
    const el = h('div', { class: 'intro' }, canvas,
      h('div', { class: 'stage' }, h('div', { class: 'logo', 'aria-hidden': 'true' }), h('div', { class: 'name', 'aria-label': BRAND.name }, ...letters), h('div', { class: 'tag' }, BRAND.tagline)),
      h('div', { class: 'hint' }, 'Click anywhere to continue'));
    root.replaceChildren(el, skip);
    const stop = tideBackdrop(canvas, still);
    let done = false;
    const next = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      removeEventListener('keydown', onKey);
      stop();
      resolve();
    };
    const onKey = (e) => {
      if (['Escape', ' ', 'Enter'].includes(e.key)) next();
    };
    addEventListener('keydown', onKey);
    el.addEventListener('click', next);
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      next();
    });
    const timer = setTimeout(next, still ? 400 : 4200);
  });
}

const STEPS = ['Look', 'Story'];

function frame(step, title, lead, content, foot) {
  const steps = h('div', { class: 'steps' });
  STEPS.forEach((s, i) => {
    if (i) steps.append(h('hr'));
    steps.append(h('i', { class: i === step ? 'on' : i < step ? 'done' : '' }, String(i + 1)), h('span', {}, s));
  });
  return h('div', { class: 'setup' }, steps, h('h1', {}, title), h('p', { class: 'lead' }, lead), content, h('div', { class: 'foot' }, ...foot));
}

/** Resolves with the chosen value when a step's "next" is pressed, or null for "back". */
function step(root, build) {
  return new Promise((resolve) => {
    root.replaceChildren(build(resolve));
    root.scrollTo?.({ top: 0 });
  });
}

const options = (list, current, onPick, sample) => {
  const wrap = h('div', { class: 'opts' });
  const paint = () => wrap.replaceChildren(...list.map((o) =>
    h('button', { class: 'opt', type: 'button', 'aria-pressed': String(o.id === current()), onclick: () => { onPick(o.id); paint(); } },
      sample ? h('span', { class: 'sample', style: o.sample }, 'Aa') : null, h('b', {}, o.name), h('small', {}, o.desc))));
  paint();
  return wrap;
};

export async function runOnboarding(app, { first = true } = {}) {
  const root = h('div', { class: 'ob', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Welcome to ${BRAND.name}` });
  document.body.append(root);

  await intro(root);

  if (first) {
    const p = app.prefs;
    let at = 0;
    // 0 look, 1 story. Back moves one step; the story step ends the flow.
    const draft = JSON.parse(JSON.stringify(app.profile));
    let finished = false;
    while (!finished) {
      if (at === 0) {
        const themes = h('div', { class: 'themes' });
        const paintThemes = () => themes.replaceChildren(...app.allThemes().map((t) =>
          h('button', { class: 'swatch', type: 'button', 'aria-pressed': String(t.id === p.theme), onclick: () => { app.setTheme(t.id); paintThemes(); } },
            h('div', { class: 'art', style: `background:${t.c.bg}` }, h('b', { style: `background:${t.c.accent}` }), h('s', { style: `background:${t.c.fg}` }), h('em', { style: `background:${t.c.wait}` }), h('i', { style: `background:${t.c.run}` })),
            h('div', { class: 'nm' }, h('span', {}, t.name), h('span', {}, t.type)))));
        paintThemes();
        await step(root, (done) => frame(0, 'Make it yours', 'Pick a font and a style. It changes right now, behind this screen, so you can see it.',
          h('div', {},
            h('div', { class: 'block' }, h('div', { class: 'eyebrow' }, 'Font'), options(FONT_PACKS, () => p.font, (id) => { p.font = id; app.restyle(); }, true)),
            h('div', { class: 'block' }, h('div', { class: 'eyebrow' }, 'Style'), options(LOOKS, () => p.look, (id) => { p.look = id; app.restyle(); })),
            h('div', { class: 'block' }, h('div', { class: 'eyebrow' }, 'Colour'), themes)),
          [h('span', { class: 'lab' }, 'You can change all of this later in Settings'), h('button', { class: 'btn primary big', type: 'button', onclick: () => done() }, 'Continue →')]));
        at = 1;
      } else {
        const preview = storyPreview(draft);
        const form = characterForm(draft, app.profile.options, () => preview.update());
        const dir = await step(root, (done) => frame(1, 'Start your story', 'Every wait is a chapter. Tell the hawk who you are and it will write the first page. Healthy habits earn XP and unlock the next chapters.',
          h('div', { class: 'story' }, h('div', {}, form), h('div', {}, preview.el)),
          [h('button', { class: 'btn quiet', type: 'button', onclick: () => done('back') }, '← Back'), h('button', { class: 'btn primary big', type: 'button', onclick: () => done('next') }, 'Begin the story →')]));
        if (dir === 'back') {
          at = 0;
        } else {
          try {
            app.setProfile(await put('/profile', { name: draft.name, character: draft.character, onboarded: true }));
            finished = true;
          } catch (err) {
            toast(`Could not save your story: ${err.message}. Is the daemon running?`);
          }
        }
      }
    }
    await post('/profile/award', { xp: 5, reason: 'welcome' }).then((v) => app.setProfile(v)).catch(() => {});
  }

  root.classList.add('out');
  setTimeout(() => root.remove(), reducedMotion() ? 0 : 650);
}
