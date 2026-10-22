// Water: frontend entry. The desktop app calls mount(ctx) once. Everything about this screen lives here.
//   ctx.h              DOM builder: h('div', { class: 'x', onclick }, ...children)
//   ctx.call(m, route, body)  request to this feature's backend (/features/water/<route>)
//   ctx.toast(msg)     brief message
//   ctx.addView({ label, icon, onShow })  add a screen + nav button; returns its root element
//   ctx.setChip(node)  put a small chip in the Tide header (null removes it)
//   ctx.showView()     navigate to this screen
//   ctx.onRefresh(fn)  fn runs on focus, every 30s, and after features are toggled
//   ctx.onTheme(fn)    fn runs when the colour theme changes
//   ctx.loadCss(url)   load a stylesheet that ships with this feature
// Elements with class "detail" are hidden in the dashboard layout, which shows only the essentials.
import { createGlass } from './glass.js';

const NAV_ICON = '<path d="M12 3.500c3.300 4 5.500 6.800 5.500 9.700a5.500 5.500 0 0 1-11 0c0-2.900 2.200-5.700 5.500-9.700z"/><path d="M9.500 14.200a2.600 2.600 0 0 0 2 2.200" opacity=".6"/>';

// One small outline per vessel, drawn on a 24x24 grid.
const VESSEL_ICONS = {
  sip: '<path d="M12 5c2.200 2.800 3.500 4.600 3.500 6.400a3.500 3.500 0 0 1-7 0C8.500 9.600 9.800 7.800 12 5z"/>',
  cup: '<path d="M6 9h12l-1.200 8a2 2 0 0 1-2 1.700H9.200a2 2 0 0 1-2-1.700z"/>',
  glass: '<path d="M7 4h10l-1.400 15a1.500 1.500 0 0 1-1.500 1.300H9.900A1.500 1.500 0 0 1 8.400 19z"/>',
  mug: '<path d="M5 7h10v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M15 9h1.500a2.500 2.500 0 0 1 0 5H15"/>',
  bottle: '<path d="M10 3h4v3l1.500 2.500V19a1.500 1.500 0 0 1-1.500 1.500h-4A1.500 1.500 0 0 1 8.500 19V8.500L10 6z"/>',
  flask: '<path d="M9.500 3h5v3l2.500 3v10a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V9l2.500-3z"/><path d="M7 13h10" opacity=".5"/>',
  litre: '<path d="M7 5h8l2 3v11a1.500 1.500 0 0 1-1.500 1.500h-7A1.500 1.500 0 0 1 7 19z"/><path d="M17 10h1.500a2 2 0 0 1 0 4H17"/>',
  custom: '<path d="M12 5v14M5 12h14"/>',
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const num = (n) => Math.round(n).toLocaleString();
const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

function icon(id) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = VESSEL_ICONS[id] || VESSEL_ICONS.custom; // static markup defined above
  return svg;
}

export function mount(ctx) {
  const { h } = ctx;
  ctx.loadCss(new URL('./water.css', import.meta.url));

  // ---- layout ----
  const canvas = h('canvas', { id: 'glass', 'aria-hidden': 'true' });
  const amount = h('div', { class: 'big', 'aria-live': 'polite' });
  const caption = h('p', { class: 'caption' });
  const drinkBtn = h('button', { class: 'btn primary', type: 'button' });
  const undoBtn = h('button', { class: 'btn quiet', type: 'button' }, 'Undo');
  const vesselRow = h('div', { class: 'vessels', role: 'group', 'aria-label': 'Log a drink' });
  const customMl = h('input', { id: 'wCustomMl', type: 'number', min: 10, max: 2000, step: 10, placeholder: '330' });
  const customForm = h('form', { class: 'custom' },
    h('label', { class: 'lab', for: 'wCustomMl' }, 'Other amount (ml)'),
    h('div', { class: 'cmd' }, customMl, h('button', { class: 'btn', type: 'submit' }, 'Add')));
  const stats = h('div', { class: 'stats' });

  const histHost = h('div', { class: 'chart' });
  const histTable = h('div', { class: 'tablewrap', hidden: true });
  const tiles = h('div', { class: 'tiles' });
  const rangeRow = h('div', { class: 'ranges', role: 'group', 'aria-label': 'Range' });
  const viewToggle = h('button', { class: 'btn quiet', type: 'button' }, 'Table');
  const tip = h('div', { class: 'tip', role: 'status', hidden: true });

  const log = h('div');
  const plan = h('div', { class: 'grid2' });

  const el = ctx.addView({
    label: 'Water',
    icon: NAV_ICON,
    onShow: () => {
      refresh();
      glass.refresh();
    },
  });
  el.append(
    h('div', { class: 'pad' },
      h('h2', { class: 'title' }, 'Water'),
      h('div', { class: 'cols' },
        h('div', { class: 'panel' },
          h('div', { class: 'water-hero' }, canvas,
            h('div', { class: 'water-info' }, amount, caption,
              h('div', { class: 'actions' }, drinkBtn, undoBtn),
              h('div', { class: 'lab' }, 'Log a drink'), vesselRow,
              h('div', { class: 'detail' }, customForm), stats))),
        h('div', { class: 'panel' },
          h('div', { class: 'eyebrow' }, 'Each day'),
          h('div', { class: 'histbar' }, rangeRow, viewToggle),
          tiles,
          h('div', { class: 'chartwrap' }, histHost, tip),
          histTable)),
      h('div', { class: 'cols detail' },
        h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Today'), log),
        h('div', { class: 'panel' },
          h('div', { class: 'eyebrow' }, 'Your plan'),
          h('p', { class: 'lede' }, 'Reminders arrive during your active hours, and once more when your agent starts a long run and you are due. A rough guide is 35 ml per kg of body weight. It is not medical advice. A heavy work day (90+ minutes of agent waiting) adds 250 ml.'),
          plan))));

  const glass = createGlass(canvas);
  ctx.onTheme(() => glass.refresh());

  // ---- state ----
  let state = null;
  let hist = null;
  let range = 14;
  let showTable = false;
  let planBuilt = false;

  async function refresh() {
    try {
      [state, hist] = await Promise.all([ctx.call('GET', 'state'), ctx.call('GET', `history?days=${range}`)]);
    } catch {
      return;
    }
    render();
  }
  ctx.onRefresh(refresh);

  const vesselName = (id) => state?.vessels.find((v) => v.id === id)?.name ?? 'Custom';

  function render() {
    const s = state;
    const reached = s.drunkMl >= s.goalMl;
    glass.set(s.goalMl ? s.drunkMl / s.goalMl : 0, reached);

    amount.dataset.reached = reached;
    amount.replaceChildren(num(s.drunkMl), h('small', {}, `/ ${num(s.goalMl)} ml`));

    const left = Math.max(0, s.goalMl - s.drunkMl);
    const portions = Math.ceil(left / s.settings.glassMl);
    const unit = s.settings.vessel === 'custom' ? 'drink' : vesselName(s.settings.vessel).toLowerCase();
    caption.textContent = !s.enabled
      ? 'Water is switched off. Turn it on under Sources.'
      : reached
        ? 'Goal reached. Nicely done.'
        : `${num(left)} ml to go, about ${portions} ${portions === 1 ? unit : unit.endsWith('s') ? `${unit}es` : `${unit}s`}.${s.bonusMl ? ` Includes +${s.bonusMl} ml for a heavy work day.` : ''}`;
    drinkBtn.textContent = `+ ${s.settings.vessel === 'custom' ? 'Drink' : vesselName(s.settings.vessel)} · ${s.settings.glassMl} ml`;

    // one-tap vessels
    vesselRow.replaceChildren(
      ...s.vessels.map((v) =>
        h('button', {
          class: 'vessel', type: 'button', 'aria-pressed': String(v.id === s.settings.vessel), title: `Log ${v.name.toLowerCase()}, ${v.ml} ml`,
          onclick: () => drink(v.ml, v.id),
        }, icon(v.id), h('span', { class: 'vn' }, v.name), h('span', { class: 'vm' }, `${v.ml} ml`))),
    );

    stats.replaceChildren(
      h('span', {}, h('b', {}, s.streak), ' day streak'),
      s.nextAt ? h('span', {}, 'Next nudge ', h('b', {}, clock(s.nextAt))) : s.enabled && !reached ? h('span', {}, 'No more nudges today') : null,
    );

    log.replaceChildren(
      ...(s.log.length
        ? s.log.slice().reverse().map((e) => h('div', { class: 'wl' }, h('span', {}, clock(e.t)), h('span', {}, `${e.v ? `${vesselName(e.v)} · ` : ''}+${e.ml} ml`)))
        : [h('div', { class: 'empty' }, h('b', {}, 'Nothing yet. '), 'Log your first drink above.')]),
    );

    if (!planBuilt) buildPlan();
    renderHistory();

    ctx.setSummary?.(s.enabled ? `${num(s.drunkMl)} / ${num(s.goalMl)} ml` : '');

    // Tide header chip, only while the feature is on.
    ctx.setChip(
      s.enabled
        ? h('button', { class: 'chip', onclick: () => ctx.showView(), 'aria-label': 'Open water' }, h('b', {}, num(s.drunkMl)), ` / ${num(s.goalMl)} ml water`)
        : null,
    );
  }

  // ---- history: one series of daily totals, goal as a dashed line ----
  function renderHistory() {
    if (!hist) return;
    rangeRow.replaceChildren(
      ...[7, 14, 30, 90].map((n) =>
        h('button', { class: 'btn quiet', type: 'button', 'aria-pressed': String(n === range), onclick: () => { range = n; refresh(); } }, `${n}d`)),
    );
    viewToggle.textContent = showTable ? 'Chart' : 'Table';
    viewToggle.setAttribute('aria-pressed', String(showTable));
    histHost.parentElement.hidden = showTable;
    histTable.hidden = !showTable;

    const logged = hist.days.filter((d) => d.ml > 0).length;
    tiles.replaceChildren(
      ...[
        ['Average', logged ? `${num(hist.averageMl)} ml` : 'none yet'],
        ['Best day', hist.bestMl ? `${num(hist.bestMl)} ml` : 'none yet'],
        ['At goal', `${hist.reachedDays} of ${hist.days.length} days`],
        ['Streak', `${state.streak} day${state.streak === 1 ? '' : 's'}`],
      ].map(([k, v]) => h('div', { class: 'tile' }, h('span', { class: 'lab' }, k), h('b', {}, v))),
    );

    if (showTable) drawTable();
    else drawChart();
  }

  function drawTable() {
    const rows = hist.days.slice().reverse();
    histTable.replaceChildren(
      h('table', {},
        h('thead', {}, h('tr', {}, ['Day', 'Total', 'Of goal', ''].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, ...rows.map((d) =>
          h('tr', {},
            h('td', {}, parseDay(d.day).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })),
            h('td', {}, d.ml ? `${num(d.ml)} ml` : '–'),
            h('td', {}, d.ml ? `${Math.round((d.ml / hist.goalMl) * 100)}%` : '–'),
            h('td', {}, d.reached ? 'Goal met' : ''))))));
  }

  const niceMax = (v) => {
    const step = v <= 3000 ? 500 : 1000;
    return Math.ceil(v / step) * step;
  };

  function drawChart() {
    const days = hist.days;
    const n = days.length;
    const W = Math.max(300, histHost.clientWidth || 600);
    const H = 240;
    const m = { l: 46, r: 12, t: 16, b: 30 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const top = niceMax(Math.max(hist.goalMl * 1.15, hist.bestMl * 1.08));
    const y = (v) => m.t + ph - (v / top) * ph;
    const slot = pw / n;
    const bw = Math.max(2, Math.min(30, slot * 0.62));
    const step = top <= 3000 ? 500 : 1000;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Daily water for the last ${n} days against a goal of ${num(hist.goalMl)} ml. A table view has the same numbers.`);
    const add = (tag, attrs, text) => {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      if (text != null) node.textContent = text;
      svg.append(node);
      return node;
    };

    // recessive grid and y labels
    for (let v = 0; v <= top; v += step) {
      add('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), style: `stroke:var(--line);stroke-width:${v === 0 ? 1.5 : 1}` });
      add('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end', style: 'fill:var(--muted);font:11px var(--mono)' }, v === 0 ? '0' : `${v / 1000} L`);
    }

    // bars: thin, rounded at the data end, anchored to the baseline
    days.forEach((d, i) => {
      if (!d.ml) return;
      const x = m.l + slot * i + (slot - bw) / 2;
      const yt = y(d.ml);
      const y0 = y(0);
      const r = Math.min(4, bw / 2, y0 - yt);
      add('path', {
        d: `M${x},${y0} L${x},${yt + r} Q${x},${yt} ${x + r},${yt} L${x + bw - r},${yt} Q${x + bw},${yt} ${x + bw},${yt + r} L${x + bw},${y0} Z`,
        style: `fill:var(${d.reached ? '--ok' : '--run'})`,
      });
    });

    // goal line, labelled directly
    add('line', { x1: m.l, x2: W - m.r, y1: y(hist.goalMl), y2: y(hist.goalMl), 'stroke-dasharray': '5 4', style: 'stroke:var(--fg);stroke-width:1.5;opacity:.7' });
    add('text', { x: W - m.r, y: y(hist.goalMl) - 6, 'text-anchor': 'end', style: 'fill:var(--fg);font:11px var(--mono);stroke:var(--surface);stroke-width:4px;paint-order:stroke' }, `goal ${num(hist.goalMl)} ml`);

    // sparse x labels
    const every = Math.max(1, Math.ceil(n / (W < 480 ? 4 : 7)));
    days.forEach((d, i) => {
      if ((n - 1 - i) % every !== 0) return;
      const date = parseDay(d.day);
      const label = n <= 14 ? date.toLocaleDateString([], { weekday: 'short', day: 'numeric' }) : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
      add('text', { x: m.l + slot * i + slot / 2, y: H - 8, 'text-anchor': 'middle', style: 'fill:var(--muted);font:11px var(--mono)' }, label);
    });

    // hover targets: a full-height column per day, larger than the bar itself
    days.forEach((d, i) => {
      const hit = add('rect', { x: m.l + slot * i, y: m.t, width: slot, height: ph, style: 'fill:transparent;cursor:default' });
      const show = () => {
        const date = parseDay(d.day).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
        tip.replaceChildren(h('b', {}, date), d.ml ? ` · ${num(d.ml)} ml · ${Math.round((d.ml / hist.goalMl) * 100)}% of goal${d.reached ? ' · goal met' : ''}` : ' · nothing logged');
        tip.hidden = false;
        const wrap = tip.parentElement.getBoundingClientRect();
        const box = svg.getBoundingClientRect();
        const cx = box.left - wrap.left + (m.l + slot * i + slot / 2) * (box.width / W);
        tip.style.left = `${Math.min(Math.max(cx, 90), wrap.width - 90)}px`;
      };
      hit.addEventListener('mouseenter', show);
      hit.addEventListener('mousemove', show);
      hit.addEventListener('mouseleave', () => (tip.hidden = true));
    });

    // legend: colour carries "met / not met", so say so in words too
    const legend = h('div', { class: 'legend' },
      h('span', {}, h('i', { class: 'sw', style: 'background:var(--ok)' }), 'Goal met'),
      h('span', {}, h('i', { class: 'sw', style: 'background:var(--run)' }), 'Under goal'),
      h('span', {}, h('i', { class: 'sw dash' }), 'Goal'));
    histHost.replaceChildren(svg, legend);
  }

  viewToggle.addEventListener('click', () => {
    showTable = !showTable;
    renderHistory();
  });
  new ResizeObserver(() => hist && !showTable && drawChart()).observe(histHost);

  // ---- plan (settings) ----
  let planTimer;
  function buildPlan() {
    planBuilt = true;
    const s = { ...state.settings };
    const inputs = {};
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
    const field = (key, label, min, max, step = 1) => {
      const id = `wp-${key}`;
      inputs[key] = h('input', { id, type: 'number', min, max, step, value: s[key] ?? '', oninput: (e) => { s[key] = e.target.value === '' ? null : Number(e.target.value); save(); } });
      return h('div', { class: 'field' }, h('label', { for: id }, label), inputs[key]);
    };
    const weight = field('weightKg', 'Weight (kg)', 20, 300);
    // Entering a weight suggests a goal (about 35 ml/kg); the goal stays editable.
    inputs.weightKg.addEventListener('change', (e) => {
      const kg = Number(e.target.value);
      if (!kg) return;
      s.goalMl = Math.round((kg * 35) / 50) * 50;
      inputs.goalMl.value = s.goalMl;
      ctx.toast(`Goal set to ${s.goalMl} ml. Edit it if you like.`);
      save();
    });

    // default vessel: used by the main button, the tray item and `qeuli drink`
    const vesselSelect = h('select', { id: 'wp-vessel', onchange: (e) => {
      s.vessel = e.target.value;
      const v = state.vessels.find((x) => x.id === s.vessel);
      if (v) s.glassMl = v.ml;
      inputs.glassMl.value = s.glassMl;
      inputs.glassMl.disabled = s.vessel !== 'custom';
      save();
    } },
      ...state.vessels.map((v) => h('option', { value: v.id, selected: v.id === s.vessel }, `${v.name} · ${v.ml} ml`)),
      h('option', { value: 'custom', selected: s.vessel === 'custom' }, 'Custom volume'));
    const glassMl = field('glassMl', 'Custom volume (ml)', 50, 1000, 10);
    inputs.glassMl.disabled = s.vessel !== 'custom';

    plan.replaceChildren(
      weight,
      field('goalMl', 'Daily goal (ml)', 500, 8000, 50),
      h('div', { class: 'field' }, h('label', { for: 'wp-vessel' }, 'Default drink'), vesselSelect),
      glassMl,
      field('intervalMin', 'Remind every (min)', 15, 480, 5),
      field('startHour', 'Active from (hour)', 0, 22),
      field('endHour', 'Active until (hour)', 1, 24),
    );
  }

  // ---- actions ----
  async function drink(ml, vessel) {
    try {
      state = await ctx.call('POST', 'drink', { ...(ml ? { ml } : {}), ...(vessel ? { vessel } : {}) });
      hist = await ctx.call('GET', `history?days=${range}`);
      glass.burst();
      render();
    } catch (err) {
      ctx.toast(err.message);
    }
  }
  drinkBtn.addEventListener('click', () => drink(null, state.settings.vessel === 'custom' ? null : state.settings.vessel));
  undoBtn.addEventListener('click', async () => {
    try {
      state = await ctx.call('POST', 'undo');
      hist = await ctx.call('GET', `history?days=${range}`);
      render();
    } catch (err) {
      ctx.toast(err.message);
    }
  });
  customForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = Number(customMl.value);
    if (v) drink(v);
    customMl.value = '';
  });

  refresh();
}
