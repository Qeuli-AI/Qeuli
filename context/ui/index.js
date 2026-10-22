// Context: frontend entry. Same ctx contract as water/ui/index.js.
const NAV_ICON = '<circle cx="12" cy="12" r="3"/><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/>';

// A small icon per kind of tool call, on a 24x24 grid.
const TOOL_ICONS = {
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.500 6.500l4 4"/>',
  read: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  bash: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 16h5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.500-4.500"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  other: '<circle cx="12" cy="12" r="3"/>',
};
const KIND = { Edit: 'edit', Write: 'edit', MultiEdit: 'edit', NotebookEdit: 'edit', Read: 'read', Bash: 'bash', Grep: 'search', Glob: 'search', WebFetch: 'web', WebSearch: 'web' };
const VERB = { edit: 'Editing', read: 'Reading', bash: 'Running', search: 'Searching', web: 'Browsing', other: 'Using' };

const ago = (t, now) => {
  const s = Math.max(0, Math.round((now - t) / 1000));
  return s < 5 ? 'now' : s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
};
const dur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function mount(ctx) {
  const { h } = ctx;
  ctx.loadCss(new URL('./context.css', import.meta.url));
  const svg = (markup) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = markup; // static markup defined above
    return s;
  };

  const now = h('div', { class: 'cx-now' });
  const recap = h('div', { class: 'cx-recap' });
  const earlier = h('div');
  const clearBtn = h('button', { class: 'btn quiet', type: 'button' }, 'Clear history');

  const el = ctx.addView({ label: 'Context', icon: NAV_ICON, onShow: () => refresh() });
  el.append(
    h('div', { class: 'pad' },
      h('div', { class: 'cols' },
        h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Right now'), now),
        h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'While you were away'), recap, h('div', { class: 'eyebrow' }, 'Earlier'), earlier, h('div', { style: 'margin-top:12px' }, clearBtn))),
      h('p', { class: 'lede cx-privacy' }, 'Privacy: only the tool name and a short label are kept (a file name, the first word of a command, a website). Never file contents, full paths, full commands or your prompts. It stays on this machine.')));

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
  // The agent just did something: pull the latest, but not more than about once a second.
  let pending;
  ctx.onAgentState(() => {
    clearTimeout(pending);
    pending = setTimeout(refresh, 900);
  });
  setInterval(() => !el.hidden && refresh(), 4000);
  // Once a second only the clocks change, so rewrite their text in place. Rebuilding the list would
  // restart every row's animation and make it flicker.
  setInterval(() => {
    if (!state || el.hidden) return;
    const t = Date.now();
    el.querySelectorAll('.cx-elapsed').forEach((n) => { n.textContent = `${dur(t - Number(n.dataset.start))} elapsed`; });
    el.querySelectorAll('.cx-ago').forEach((n) => { n.textContent = ago(Number(n.dataset.t), t); });
  }, 1000);

  function eventRow(e, t) {
    const kind = KIND[e.tool] || 'other';
    return h('div', { class: 'cx-ev' }, h('span', { class: `cx-ic k-${kind}` }, svg(TOOL_ICONS[kind])), h('span', { class: 'cx-tool' }, e.tool || 'tool'), h('span', { class: 'cx-target' }, e.target || ''), h('span', { class: 'cx-ago', 'data-t': String(e.t) }, ago(e.t, t)));
  }

  function renderNow() {
    const t = Date.now();
    if (!state.enabled) {
      now.replaceChildren(h('div', { class: 'empty' }, 'Context is switched off. Turn it on under Settings > Connections.'));
      return;
    }
    if (!state.live.length) {
      now.replaceChildren(h('div', { class: 'empty' }, h('b', {}, 'No agent is running. '), 'When one starts, every step shows up here as it happens.'));
      return;
    }
    now.replaceChildren(...state.live.map((r) => {
      const last = r.events[0];
      const kind = last ? KIND[last.tool] || 'other' : 'other';
      return h('div', { class: `cx-run is-${r.status}` },
        h('div', { class: 'cx-head' }, h('h3', {}, `${r.name}${r.project ? ` · ${r.project}` : ''}`), h('span', { class: `pill ${r.status === 'waiting' ? 'off' : 'on'}` }, r.status === 'waiting' ? 'needs you' : 'working')),
        r.status === 'waiting'
          ? h('p', { class: 'cx-doing' }, r.message || 'Waiting for your input.')
          : h('p', { class: 'cx-doing' }, last ? `${VERB[kind]} ${last.target || last.tool}` : 'Thinking…', h('span', { class: 'cx-dots' }, h('i'), h('i'), h('i'))),
        h('div', { class: 'cx-meta' }, h('span', { class: 'cx-elapsed', 'data-start': String(r.startedAt) }, `${dur(t - r.startedAt)} elapsed`), h('span', {}, `${r.calls} tool call${r.calls === 1 ? '' : 's'}`), r.waits ? h('span', {}, `${r.waits} wait${r.waits === 1 ? '' : 's'} on you`) : null),
        h('div', { class: 'cx-feed' }, ...r.events.map((e) => eventRow(e, t))));
    }));
  }

  function render() {
    renderNow();
    const [latest, ...rest] = state.recent;
    recap.replaceChildren(...(latest
      ? [
          h('p', { class: 'cx-headline' }, latest.headline),
          h('div', { class: 'cx-meta' }, h('span', {}, `${latest.project || 'project'} · ${clock(latest.endedAt)}`), h('span', {}, dur(latest.durationMs)), h('span', {}, `${latest.calls} tool calls`), latest.waits ? h('span', {}, `${latest.waits} ${latest.waits === 1 ? 'wait' : 'waits'} on you`) : null),
          latest.edited.length ? h('div', { class: 'cx-list' }, h('span', { class: 'lab' }, 'Edited'), ...latest.edited.slice(0, 12).map((f) => h('code', {}, f))) : null,
          latest.commands.length ? h('div', { class: 'cx-list' }, h('span', { class: 'lab' }, 'Ran'), ...latest.commands.map((c) => h('code', {}, c))) : null]
      : [h('div', { class: 'empty' }, h('b', {}, 'Nothing yet. '), 'After your agent finishes a run, a recap of what it did appears here.')]));
    earlier.replaceChildren(...(rest.length
      ? rest.map((r) => h('div', { class: 'cx-old' }, h('span', { class: 'lab' }, clock(r.endedAt)), h('span', {}, r.headline)))
      : [h('div', { class: 'empty' }, 'No earlier runs.')]));
    clearBtn.disabled = !state.recent.length;

    const running = state.live.find((r) => r.status === 'running') || state.live[0];
    ctx.setSummary(!state.enabled ? '' : running ? `${running.name}: ${running.events[0] ? `${running.events[0].tool} ${running.events[0].target}`.trim() : 'working'}` : latest ? `Last run: ${latest.calls} calls` : 'No runs yet');
  }

  clearBtn.addEventListener('click', async () => {
    state = await ctx.call('POST', 'clear');
    render();
  });

  refresh();
}
