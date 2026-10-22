// Parking lot: frontend entry. Same ctx contract as water/ui/index.js.
const NAV_ICON = '<path d="M5 12.500l4.500 4.500L19 7.500"/>';

const KINDS = [
  { id: 'idea', label: 'Idea', title: 'Ideas', hint: 'A thought to come back to.', empty: 'No ideas parked. Something will occur to you while you wait.' },
  { id: 'prompt', label: 'Next prompt', title: 'Next prompts', hint: 'Draft it now, paste it when your agent is done.', empty: 'No prompts drafted. Write the next one while the agent works.' },
  { id: 'todo', label: 'To-do', title: 'To-dos', hint: 'A small task so it stops nagging you.', empty: 'No to-dos. Nice and quiet.' },
];

const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
};

export function mount(ctx) {
  const { h } = ctx;
  ctx.loadCss(new URL('./parking.css', import.meta.url));

  let kind = 'idea';
  const text = h('textarea', { id: 'pk-text', rows: 3, maxlength: 4000, placeholder: 'What is on your mind?' });
  const hint = h('span', { class: 'pk-hint' });
  const kindRow = h('div', { class: 'choices', role: 'group', 'aria-label': 'What kind of note' });
  const paintKinds = () => kindRow.replaceChildren(...KINDS.map((k) =>
    h('button', { class: 'btn', type: 'button', 'aria-pressed': String(k.id === kind), onclick: () => { kind = k.id; paintKinds(); paintHint(); } }, k.label)));
  const paintHint = () => { hint.textContent = KINDS.find((k) => k.id === kind).hint; };
  const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Park it');
  const form = h('form', { class: 'pk-form', onsubmit: async (e) => {
    e.preventDefault();
    const value = text.value.trim();
    if (!value) return;
    try {
      state = await ctx.call('POST', 'add', { text: value, kind });
      text.value = '';
      render();
      text.focus();
    } catch (err) {
      ctx.toast(err.message);
    }
  } },
    h('div', { class: 'field' }, h('label', { for: 'pk-text' }, 'Park a thought'), text),
    h('div', { class: 'pk-actions' }, kindRow, h('span', { class: 'pk-spacer' }), hint, submit));
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit();
  });
  paintKinds();
  paintHint();

  const lists = Object.fromEntries(KINDS.map((k) => [k.id, h('div')]));
  const clearDone = h('button', { class: 'btn quiet', type: 'button' }, 'Clear finished');
  const banner = h('div', { class: 'pk-banner', hidden: true });

  const el = ctx.addView({ label: 'Parking lot', icon: NAV_ICON, onShow: () => { refresh(); text.focus(); } });
  el.append(
    h('div', { class: 'pad' },
      banner,
      h('div', { class: 'panel' }, form),
      h('div', { class: 'cols pk-cols' }, ...KINDS.map((k) => h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, k.title), lists[k.id]))),
      h('div', {}, clearDone)));

  let state = null;
  async function refresh() {
    try {
      state = await ctx.call('GET', 'state');
    } catch {
      return;
    }
    render();
  }
  ctx.onRefresh(refresh);

  // When an agent is working this is exactly the moment to draft the next prompt.
  ctx.onAgentState((s) => {
    const running = s.sessions.find((x) => x.status === 'running');
    banner.hidden = !running;
    if (running) {
      banner.textContent = `${running.name || 'Your agent'} is working. A good moment to write the next prompt, or park an idea.`;
      text.placeholder = 'Write your next prompt, or whatever just occurred to you…';
    } else {
      text.placeholder = 'What is on your mind?';
    }
  });

  function itemRow(i) {
    const actions = [];
    if (i.kind === 'prompt') {
      actions.push(h('button', { class: 'btn quiet', type: 'button', onclick: async () => {
        try {
          await navigator.clipboard.writeText(i.text);
          ctx.toast('Prompt copied');
        } catch {
          ctx.toast('Copy failed');
        }
      } }, 'Copy'));
    }
    actions.push(
      h('button', { class: 'btn quiet', type: 'button', onclick: async () => { state = await ctx.call('POST', 'toggle', { id: i.id }); render(); } }, i.done ? 'Undo' : 'Done'),
      h('button', { class: 'btn quiet danger', type: 'button', 'aria-label': 'Delete', onclick: async () => { state = await ctx.call('POST', 'remove', { id: i.id }); render(); } }, 'Delete'));
    return h('div', { class: `pk-item${i.done ? ' done' : ''}` }, h('p', {}, i.text), h('div', { class: 'pk-foot' }, h('span', { class: 'lab' }, ago(i.t)), h('span', { class: 'pk-btns' }, ...actions)));
  }

  function render() {
    for (const k of KINDS) {
      const items = state.items.filter((i) => i.kind === k.id);
      lists[k.id].replaceChildren(...(items.length ? items.map(itemRow) : [h('div', { class: 'empty' }, k.empty)]));
    }
    clearDone.disabled = !state.items.some((i) => i.done);
    const parts = KINDS.filter((k) => state.counts[k.id]).map((k) => `${state.counts[k.id]} ${state.counts[k.id] === 1 ? k.label.toLowerCase() : `${k.label.toLowerCase()}s`}`);
    ctx.setSummary(!state.enabled ? '' : state.open ? parts.join(' · ') : 'Nothing parked');
  }

  clearDone.addEventListener('click', async () => {
    state = await ctx.call('POST', 'clear-done');
    render();
  });

  refresh();
}
