// Breaks: frontend entry. The desktop app calls mount(ctx) once. Same ctx contract as water/ui/index.js.
// Elements with class "detail" are hidden in the dashboard layout, which shows only the essentials.

const NAV_ICON = '<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="2.800"/>';

const KIND_ICONS = {
  eyes: NAV_ICON,
  stretch: '<circle cx="12" cy="5" r="2"/><path d="M12 7.500V15M6 9.500l6 2 6-2M9 20.500l3-5.500 3 5.500"/>',
  walk: '<circle cx="13" cy="4.500" r="2"/><path d="M11 21l1.500-6-2.500-2.500 1-4.500 3.500 1.500 2 3M9.500 8.500 7 12"/>',
  breathe: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".55"/><circle cx="12" cy="12" r="10.500" opacity=".28"/>',
};

// What to say while a session runs. Each step lasts an equal share of the session.
const STEPS = {
  eyes: ['Look at something far away', 'Let your eyes soften', 'Blink slowly, a few times'],
  stretch: ['Neck: tilt your head to the left', 'Neck: tilt to the right', 'Shoulders: roll them back', 'Shoulders: roll them forward', 'Wrists: open and close your hands', 'Stand tall and reach up'],
  walk: ['Stand up and walk. Water on the way back.'],
};
const PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold']; // box breathing, 4 seconds each

const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_R = 96;
const RING_LEN = 2 * Math.PI * RING_R;
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const mmss = (s) => {
  const t = Math.ceil(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

function icon(id) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = KIND_ICONS[id]; // static markup defined above
  return svg;
}

export function mount(ctx) {
  const { h } = ctx;
  ctx.loadCss(new URL('./breaks.css', import.meta.url));

  const stage = h('div', { class: 'stage' });
  const kindsRow = h('div', { class: 'kinds', role: 'group', 'aria-label': 'Start a break' });
  const big = h('div', { class: 'bigcount', 'aria-live': 'polite' });
  const caption = h('p', { class: 'caption' });
  const rows = h('div');
  const bars = h('div', { class: 'minibars' });
  const barLabels = h('div', { class: 'barlabels' });
  const undoBtn = h('button', { class: 'btn quiet', type: 'button' }, 'Undo last');
  const log = h('div');
  const plan = h('div');

  const el = ctx.addView({ label: 'Breaks', icon: NAV_ICON, onShow: () => refresh() });
  el.append(
    h('div', { class: 'pad' },
      h('h2', { class: 'title' }, 'Breaks'),
      h('div', { class: 'cols' },
        h('div', { class: 'panel' },
          h('div', { class: 'eyebrow' }, 'Take a break'),
          stage,
          h('div', { class: 'lab', style: 'margin-top:16px' }, 'Start one now'),
          kindsRow),
        h('div', { class: 'panel' },
          h('div', { class: 'eyebrow' }, 'Today'),
          big, caption, rows,
          h('div', { class: 'eyebrow' }, 'Last 14 days'),
          bars, barLabels,
          h('div', { style: 'margin-top:12px' }, undoBtn))),
      h('div', { class: 'cols detail' },
        h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Log'), log),
        h('div', { class: 'panel' },
          h('div', { class: 'eyebrow' }, 'Your plan'),
          h('p', { class: 'lede' }, 'Reminders come during your active hours, one at a time. When your agent starts a run and you are overdue for an eye rest or stretch, you get a nudge then, because that is a free moment.'),
          plan))));

  // ---- state ----
  let state = null;
  let hist = null;
  let planBuilt = false;
  let session = null; // { kind, t0, timer }

  async function refresh() {
    try {
      [state, hist] = await Promise.all([ctx.call('GET', 'state'), ctx.call('GET', 'history?days=14')]);
    } catch {
      return;
    }
    render();
  }
  ctx.onRefresh(refresh);

  const kindById = (id) => state.kinds.find((k) => k.id === id);

  function render() {
    const s = state;
    big.replaceChildren(String(s.total), h('small', {}, `/ ${s.goal} breaks`));
    big.dataset.reached = String(s.total >= s.goal);
    caption.textContent = !s.enabled
      ? 'Breaks are switched off. Turn them on under Sources.'
      : s.total >= s.goal
        ? 'Goal reached. Nicely done.'
        : `${s.goal - s.total} to go today.${s.streak ? ` ${s.streak}-day streak.` : ''}`;

    kindsRow.replaceChildren(
      ...s.kinds.map((k) =>
        h('button', { class: 'kind', type: 'button', disabled: !!session, onclick: () => start(k.id), title: k.text },
          icon(k.id), h('span', { class: 'kn' }, k.name), h('span', { class: 'ks' }, k.seconds >= 60 ? `${Math.round(k.seconds / 60)} min` : `${k.seconds} s`))),
    );

    rows.replaceChildren(
      ...s.kinds.map((k) =>
        h('div', { class: 'krow' },
          h('span', { class: 'kname' }, icon(k.id), k.name),
          h('span', { class: 'kcount' }, h('b', {}, k.count), ' today'),
          h('span', { class: 'knext' }, !k.on ? 'off' : k.nextAt ? `next ${clock(k.nextAt)}` : k.every ? 'done for today' : 'on demand'))),
    );
    undoBtn.disabled = s.total === 0;

    renderBars();
    log.replaceChildren(
      ...(s.log.length
        ? s.log.slice().reverse().map((e) => h('div', { class: 'wl' }, h('span', {}, clock(e.t)), h('span', {}, kindById(e.kind)?.name ?? e.kind)))
        : [h('div', { class: 'empty' }, h('b', {}, 'Nothing yet. '), 'Start a break above.')]),
    );

    if (!planBuilt) buildPlan();
    if (!session) renderIdleStage();

    ctx.setSummary?.(s.enabled ? `${s.total} / ${s.goal} breaks` : '');
    ctx.setChip(
      s.enabled ? h('button', { class: 'chip', onclick: () => ctx.showView(), 'aria-label': 'Open breaks' }, h('b', {}, `${s.total} / ${s.goal}`), ' breaks') : null,
    );
  }

  // ---- last 14 days: one bar per day, goal marked by a line ----
  function renderBars() {
    const days = hist.days;
    const top = Math.max(hist.goal, ...days.map((d) => d.total), 1);
    bars.setAttribute('role', 'img');
    bars.setAttribute('aria-label', `Breaks per day over the last ${days.length} days: ${days.map((d) => d.total).join(', ')}. Goal ${hist.goal}.`);
    bars.replaceChildren(
      h('i', { class: 'goalline', style: `bottom:${(hist.goal / top) * 100}%`, title: `Goal: ${hist.goal} breaks` }),
      ...days.map((d) => {
        const date = parseDay(d.day).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
        return h('span', { class: `bar${d.reached ? ' met' : ''}`, style: `height:${d.total ? Math.max(4, (d.total / top) * 100) : 0}%`, title: `${date}: ${d.total} break${d.total === 1 ? '' : 's'}${d.reached ? ', goal met' : ''}` });
      }),
    );
    const first = parseDay(days[0].day).toLocaleDateString([], { day: 'numeric', month: 'short' });
    barLabels.replaceChildren(h('span', {}, first), h('span', {}, 'today'));
  }

  // ---- guided session ----
  function ringSvg() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 220 220');
    svg.setAttribute('class', 'ring');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<circle class="track" cx="110" cy="110" r="${RING_R}"/><circle class="arc" cx="110" cy="110" r="${RING_R}" stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}" transform="rotate(-90 110 110)"/>`;
    return svg;
  }

  function renderIdleStage() {
    const next = state.kinds.filter((k) => k.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0];
    stage.className = 'stage idle';
    stage.replaceChildren(
      ringSvg(),
      h('div', { class: 'center' },
        h('div', { class: 'readout' }, 'Ready'),
        h('div', { class: 'step' }, next ? `Next: ${next.name.toLowerCase()} at ${clock(next.nextAt)}` : 'Pick a break below')));
  }

  function start(kindId) {
    if (session) return;
    const k = kindById(kindId);
    const readout = h('div', { class: 'readout' }, String(k.seconds));
    const step = h('div', { class: 'step' });
    const cancel = h('button', { class: 'btn quiet', type: 'button', onclick: () => stop(false) }, 'Cancel');
    const svg = ringSvg();
    const arc = svg.querySelector('.arc');
    // A little scene per kind: rings drifting outward for distance, a circle that breathes, or a calm pulse.
    const scene = h('div', { class: `scene ${kindId}`, 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));

    stage.className = `stage live ${kindId}`;
    stage.replaceChildren(scene, svg, h('div', { class: 'center' }, readout, step), h('div', { class: 'stagebtn' }, cancel));
    document.querySelectorAll('#view-breaks .kind').forEach((b) => (b.disabled = true));

    const t0 = performance.now();
    const total = k.seconds;
    const tick = () => {
      const e = (performance.now() - t0) / 1000;
      if (e >= total) return stop(true);
      arc.style.strokeDashoffset = String(RING_LEN * (1 - e / total));
      readout.textContent = total >= 120 ? mmss(total - e) : String(Math.ceil(total - e));
      if (kindId === 'breathe') {
        const p = Math.floor((e % 16) / 4);
        step.textContent = PHASES[p];
        scene.dataset.phase = String(p);
      } else {
        const steps = STEPS[kindId];
        step.textContent = steps[Math.min(steps.length - 1, Math.floor((e / total) * steps.length))];
      }
    };
    session = { kindId, timer: setInterval(tick, 100) };
    tick();
  }

  async function stop(completed) {
    if (!session) return;
    const { kindId, timer } = session;
    clearInterval(timer);
    session = null;
    if (!completed) {
      render();
      return;
    }
    try {
      state = await ctx.call('POST', 'take', { kind: kindId });
      hist = await ctx.call('GET', 'history?days=14');
    } catch (err) {
      ctx.toast(err.message);
      render();
      return;
    }
    stage.className = 'stage done';
    stage.replaceChildren(
      ringSvg(),
      h('div', { class: 'center' }, h('div', { class: 'readout' }, 'Done'), h('div', { class: 'step' }, `${kindById(kindId).name} logged`)));
    stage.querySelector('.arc').style.strokeDashoffset = '0';
    render();
    setTimeout(() => {
      if (!session && stage.classList.contains('done')) renderIdleStage();
    }, 3500);
  }

  undoBtn.addEventListener('click', async () => {
    try {
      state = await ctx.call('POST', 'undo');
      hist = await ctx.call('GET', 'history?days=14');
      render();
    } catch (err) {
      ctx.toast(err.message);
    }
  });

  // ---- plan (settings) ----
  let planTimer;
  function buildPlan() {
    planBuilt = true;
    const s = JSON.parse(JSON.stringify(state.settings));
    const save = () => {
      clearTimeout(planTimer);
      planTimer = setTimeout(async () => {
        try {
          state = await ctx.call('PUT', 'settings', s);
          render();
          ctx.toast('Saved');
        } catch (err) {
          ctx.toast(err.message);
        }
      }, 500);
    };
    const num = (id, label, value, min, max, onInput, disabled = false) =>
      h('div', { class: 'field' }, h('label', { for: id }, label),
        h('input', { id, type: 'number', min, max, value: value ?? '', disabled, oninput: (e) => { onInput(Number(e.target.value)); save(); } }));

    const kindRows = state.kinds.map((k) => {
      const every = num(`bp-every-${k.id}`, 'Every (min)', s.kinds[k.id].every || '', 10, 480, (v) => { s.kinds[k.id].every = v; }, !s.kinds[k.id].on);
      const toggle = h('label', { class: 'toggle' },
        h('input', { type: 'checkbox', 'aria-label': `${k.name} reminders`, checked: s.kinds[k.id].on, onchange: (e) => {
          s.kinds[k.id].on = e.target.checked;
          every.querySelector('input').disabled = !e.target.checked;
          save();
        } }),
        h('span'));
      return h('div', { class: 'plan-kind' }, h('div', { class: 'pk-name' }, icon(k.id), h('div', {}, k.name, h('small', {}, k.text))), every, toggle);
    });

    plan.replaceChildren(
      ...kindRows,
      h('div', { class: 'grid2', style: 'margin-top:12px' },
        num('bp-goal', 'Daily goal (breaks)', s.goal, 1, 40, (v) => { s.goal = v; }),
        num('bp-start', 'Active from (hour)', s.startHour, 0, 22, (v) => { s.startHour = v; }),
        num('bp-end', 'Active until (hour)', s.endHour, 1, 24, (v) => { s.endHour = v; })));
  }

  refresh();
}
