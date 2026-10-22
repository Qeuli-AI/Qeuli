// Desk workouts: frontend entry. Same ctx contract as water/ui/index.js.
const NAV_ICON = '<path d="M3 12h3l2.500-6 4 12 2.500-6H21"/>';
const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_R = 96;
const RING_LEN = 2 * Math.PI * RING_R;

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function mount(ctx) {
  const { h } = ctx;
  ctx.loadCss(new URL('./move.css', import.meta.url));

  const stage = h('div', { class: 'mv-stage' });
  const routines = h('div', { class: 'mv-routines' });
  const today = h('div', { class: 'mv-today' });
  const bars = h('div', { class: 'mv-bars' });
  const barLabels = h('div', { class: 'mv-barlabels' });
  const undoBtn = h('button', { class: 'btn quiet', type: 'button' }, 'Undo last');
  const goal = h('input', { id: 'mv-goal', type: 'number', min: 1, max: 120, 'aria-label': 'Daily goal in minutes' });

  const el = ctx.addView({ label: 'Desk workouts', icon: NAV_ICON, onShow: () => refresh() });
  el.append(
    h('div', { class: 'pad' },
      h('div', { class: 'cols' },
        h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Move'), stage),
        h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Pick a routine'), routines)),
      h('div', { class: 'cols detail' },
        h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Today'), today, h('div', { class: 'eyebrow' }, 'Last 7 days'), bars, barLabels, h('div', { style: 'margin-top:12px' }, undoBtn)),
        h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Your plan'),
          h('p', { class: 'lede' }, 'These are gentle, no-equipment moves you can do in work clothes. Stop if anything hurts. They are not a substitute for medical advice.'),
          h('div', { class: 'field', style: 'max-width:220px' }, h('label', { for: 'mv-goal' }, 'Daily goal (minutes)'), goal)))));

  let state = null;
  let hist = null;
  let session = null; // { routine, i, remaining, paused, timer, last }

  async function refresh() {
    try {
      [state, hist] = await Promise.all([ctx.call('GET', 'state'), ctx.call('GET', 'history?days=7')]);
    } catch {
      return;
    }
    render();
  }
  ctx.onRefresh(refresh);

  function ring() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 220 220');
    svg.setAttribute('class', 'mv-ring');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<circle class="track" cx="110" cy="110" r="${RING_R}"/><circle class="arc" cx="110" cy="110" r="${RING_R}" stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}" transform="rotate(-90 110 110)"/>`;
    return svg;
  }

  function idleStage() {
    const pct = Math.min(1, state.todayMin / state.goalMin);
    const svg = ring();
    svg.querySelector('.arc').style.strokeDashoffset = String(RING_LEN * (1 - pct));
    stage.className = 'mv-stage idle';
    stage.replaceChildren(svg, h('div', { class: 'mv-center' },
      h('div', { class: 'mv-read' }, `${Math.round(state.todayMin * 10) / 10}`),
      h('div', { class: 'mv-step' }, `of ${state.goalMin} min today`)));
  }

  function render() {
    const s = state;
    routines.replaceChildren(...s.routines.map((r) =>
      h('button', { class: 'mv-card', type: 'button', disabled: !!session, onclick: () => start(r) },
        h('b', {}, r.name),
        h('small', {}, r.blurb),
        h('span', { class: 'mv-meta' }, `${Math.round(r.seconds / 60)} min · ${r.steps.filter((x) => x.name !== 'Rest').length} moves`))));
    today.replaceChildren(
      h('div', { class: 'mv-big' }, `${Math.round(s.todayMin * 10) / 10}`, h('small', {}, `/ ${s.goalMin} min`)),
      h('p', { class: 'lede', style: 'margin:4px 0 0' }, s.todayMin >= s.goalMin ? 'Goal reached. Nicely moved.' : `${Math.round((s.goalMin - s.todayMin) * 10) / 10} min to go.${s.streak ? ` ${s.streak}-day streak.` : ''}`));
    undoBtn.disabled = s.sessionsToday === 0;
    goal.value = String(s.goalMin);
    renderBars();
    if (!session) idleStage();
    ctx.setSummary(s.enabled ? `${Math.round(s.todayMin * 10) / 10} / ${s.goalMin} min today` : '');
  }

  function renderBars() {
    const days = hist.days;
    const top = Math.max(hist.goalMin, ...days.map((d) => d.minutes), 1);
    bars.setAttribute('role', 'img');
    bars.setAttribute('aria-label', `Minutes moved per day over the last ${days.length} days: ${days.map((d) => d.minutes).join(', ')}. Goal ${hist.goalMin}.`);
    bars.replaceChildren(
      h('i', { class: 'goalline', style: `bottom:${(hist.goalMin / top) * 100}%`, title: `Goal: ${hist.goalMin} min` }),
      ...days.map((d) => h('span', { class: `bar${d.reached ? ' met' : ''}`, style: `height:${d.minutes ? Math.max(4, (d.minutes / top) * 100) : 0}%`, title: `${parseDay(d.day).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.minutes} min${d.reached ? ', goal met' : ''}` })));
    barLabels.replaceChildren(h('span', {}, parseDay(days[0].day).toLocaleDateString([], { weekday: 'short' })), h('span', {}, 'today'));
  }

  // ---- the guided session ----
  function start(routine) {
    if (session) return;
    session = { routine, i: 0, remaining: routine.steps[0].seconds, paused: false, last: performance.now() };
    paintSession();
    session.timer = setInterval(tick, 200);
    render();
  }

  function paintSession() {
    const { routine, i } = session;
    const step = routine.steps[i];
    const next = routine.steps[i + 1];
    const read = h('div', { class: 'mv-read' }, String(step.seconds));
    const svg = ring();
    const pause = h('button', { class: 'btn', type: 'button', onclick: () => { session.paused = !session.paused; pause.textContent = session.paused ? 'Resume' : 'Pause'; } }, 'Pause');
    stage.className = `mv-stage live${step.name === 'Rest' ? ' rest' : ''}`;
    stage.replaceChildren(
      svg,
      h('div', { class: 'mv-center' }, read, h('div', { class: 'mv-name' }, step.name)),
      h('p', { class: 'mv-cue' }, step.cue),
      h('div', { class: 'mv-up' }, `Step ${i + 1} of ${routine.steps.length}`, next ? ` · next: ${next.name}` : ' · last one'),
      h('div', { class: 'mv-ctl' }, pause,
        h('button', { class: 'btn quiet', type: 'button', onclick: () => advance() }, 'Skip'),
        h('button', { class: 'btn quiet danger', type: 'button', onclick: () => stop(false) }, 'Stop')));
    session.read = read;
    session.arc = svg.querySelector('.arc');
  }

  function tick() {
    const now = performance.now();
    const dt = (now - session.last) / 1000;
    session.last = now;
    if (session.paused) return;
    session.remaining -= dt;
    const step = session.routine.steps[session.i];
    if (session.remaining <= 0) {
      advance();
      return;
    }
    session.arc.style.strokeDashoffset = String(RING_LEN * (1 - session.remaining / step.seconds));
    session.read.textContent = mmss(session.remaining);
  }

  function advance() {
    session.i += 1;
    if (session.i >= session.routine.steps.length) return stop(true);
    session.remaining = session.routine.steps[session.i].seconds;
    session.last = performance.now();
    paintSession();
  }

  async function stop(completed) {
    const { routine, timer } = session;
    clearInterval(timer);
    session = null;
    if (!completed) {
      render();
      return;
    }
    try {
      state = await ctx.call('POST', 'done', { routine: routine.id });
      hist = await ctx.call('GET', 'history?days=7');
    } catch (err) {
      ctx.toast(err.message);
      render();
      return;
    }
    render();
    const svg = ring();
    svg.querySelector('.arc').style.strokeDashoffset = '0';
    stage.className = 'mv-stage done';
    stage.replaceChildren(svg, h('div', { class: 'mv-center' }, h('div', { class: 'mv-read' }, 'Done'), h('div', { class: 'mv-step' }, `${routine.name} logged`)));
    setTimeout(() => !session && stage.classList.contains('done') && idleStage(), 3500);
  }

  undoBtn.addEventListener('click', async () => {
    try {
      state = await ctx.call('POST', 'undo');
      hist = await ctx.call('GET', 'history?days=7');
      render();
    } catch (err) {
      ctx.toast(err.message);
    }
  });
  let goalTimer;
  goal.addEventListener('input', () => {
    clearTimeout(goalTimer);
    goalTimer = setTimeout(async () => {
      try {
        state = await ctx.call('PUT', 'settings', { goalMin: Number(goal.value) });
        render();
        ctx.toast('Saved');
      } catch (err) {
        ctx.toast(err.message);
      }
    }, 500);
  });

  refresh();
}
