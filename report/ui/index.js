// Waiting report: frontend entry. Same ctx contract as water/ui/index.js.
const NAV_ICON = '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>';

const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmt = (min) => {
  if (min > 0 && min < 1) return '<1 min';
  const m = Math.round(min);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
};

export function mount(ctx) {
  const { h } = ctx;
  ctx.loadCss(new URL('./report.css', import.meta.url));

  const insight = h('p', { class: 'rp-insight', 'aria-live': 'polite' });
  const tiles = h('div', { class: 'rp-tiles' });
  const bars = h('div', { class: 'rp-bars' });
  const labels = h('div', { class: 'rp-labels' });
  const bought = h('div', { class: 'rp-bought' });
  const rangeRow = h('div', { class: 'rp-ranges', role: 'group', 'aria-label': 'Range' });

  const el = ctx.addView({ label: 'Waiting report', icon: NAV_ICON, onShow: () => refresh() });
  el.append(
    h('div', { class: 'pad' },
      h('div', { class: 'panel' }, insight, tiles),
      h('div', { class: 'cols' },
        h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Minutes waited, per day'), rangeRow, bars, labels,
          h('p', { class: 'lede rp-note' }, 'Counted from when an agent starts a run to when it finishes, minus the time it spent waiting on you.')),
        h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'What that week could have bought'), bought))));

  let range = 14;
  let data = null;

  async function refresh() {
    try {
      data = await ctx.call('GET', `state?days=${range}`);
    } catch {
      return;
    }
    render();
  }
  ctx.onRefresh(refresh);

  function render() {
    insight.textContent = data.insight;
    tiles.replaceChildren(
      ...[
        ['This week', fmt(data.thisWeek)],
        ['Last week', fmt(data.lastWeek)],
        ['Runs', String(data.runs)],
        ['Average run', data.runs ? fmt(data.averagePerRun) : 'none yet'],
      ].map(([k, v]) => h('div', { class: 'rp-tile' }, h('span', { class: 'lab' }, k), h('b', {}, v))));

    rangeRow.replaceChildren(...[14, 30, 90].map((n) =>
      h('button', { class: 'btn quiet', type: 'button', 'aria-pressed': String(n === range), onclick: () => { range = n; refresh(); } }, `${n}d`)));

    const top = Math.max(...data.days.map((d) => d.minutes), 1);
    bars.setAttribute('role', 'img');
    bars.setAttribute('aria-label', `Minutes waited per day over the last ${data.days.length} days. ${data.insight}`);
    bars.replaceChildren(...data.days.map((d) =>
      h('span', { class: `bar${d.day === data.busiest?.day ? ' peak' : ''}`, style: `height:${d.minutes ? Math.max(4, (d.minutes / top) * 100) : 0}%`, title: `${parseDay(d.day).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.minutes} min, ${d.runs} run${d.runs === 1 ? '' : 's'}` })));
    labels.replaceChildren(...[h('span', {}, parseDay(data.days[0].day).toLocaleDateString([], { day: 'numeric', month: 'short' })), data.busiest ? h('span', {}, `busiest: ${parseDay(data.busiest.day).toLocaleDateString([], { weekday: 'short' })} · ${fmt(data.busiest.minutes)}`) : null, h('span', {}, 'today')].filter(Boolean));

    const eq = data.equivalents;
    bought.replaceChildren(
      ...(data.thisWeek
        ? [
            ['Short walks', eq.walks, '5 minutes each'],
            ['Quick reads', eq.reads, 'about 6 minutes each'],
            ['Eye rests', eq.eyeRests, '20 seconds each'],
          ].map(([k, v, sub]) => h('div', { class: 'rp-eq' }, h('b', {}, String(v)), h('div', {}, k, h('small', {}, sub))))
        : [h('div', { class: 'empty' }, 'Nothing to convert yet.')]));

    ctx.setSummary(data.runs ? `${fmt(data.thisWeek)} waited this week` : 'No runs yet');
  }

  refresh();
}
