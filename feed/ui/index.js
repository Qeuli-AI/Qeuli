// Feed: frontend entry. Same ctx contract as water/ui/index.js.
const NAV_ICON = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>';
const LISTS = [{ id: 'top', label: 'Top' }, { id: 'new', label: 'New' }, { id: 'best', label: 'Best' }];

const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 3600 ? `${Math.max(1, Math.floor(s / 60))}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
};

export function mount(ctx) {
  const { h } = ctx;
  ctx.loadCss(new URL('./feed.css', import.meta.url));
  // Opening a link goes through the desktop app's opener when there is one, otherwise a new tab.
  const open = (url) => (window.__TAURI__?.opener ? window.__TAURI__.opener.openUrl(url) : window.open(url, '_blank', 'noopener'));

  let list = 'top';
  let data = null;
  let loading = false;
  let error = '';

  const tabs = h('div', { class: 'ranges', role: 'group', 'aria-label': 'Which stories' });
  const refreshBtn = h('button', { class: 'btn', type: 'button', onclick: () => load(true) }, 'Refresh');
  const status = h('span', { class: 'fd-status lab' });
  const body = h('div', { class: 'fd-list' });

  const el = ctx.addView({ label: 'Feed', icon: NAV_ICON, onShow: () => { if (!data) load(false); } });
  el.append(
    h('div', { class: 'pad' },
      h('div', { class: 'panel' },
        h('div', { class: 'fd-bar' }, tabs, h('span', { class: 'fd-spacer' }), status, refreshBtn),
        body,
        h('p', { class: 'lede fd-note' }, 'Qeuli fetches hacker-news.firebaseio.com from your computer. No account, no cookies, nothing about you is sent. Reading times are rough guesses.'))));

  async function load(refresh) {
    if (loading) return;
    loading = true;
    error = '';
    paint();
    try {
      data = await ctx.call('GET', `stories?list=${list}${refresh ? '&refresh=1' : ''}`);
      if (data.stale) error = `Showing saved stories. ${data.error}`;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
      paint();
    }
  }

  async function save(story, btn) {
    btn.disabled = true;
    try {
      await ctx.call('POST', 'save', { id: story.id });
      btn.textContent = 'Saved';
      ctx.toast('Saved for a wait');
    } catch (err) {
      btn.disabled = false;
      ctx.toast(err.message);
    }
  }

  function paint() {
    tabs.replaceChildren(...LISTS.map((l) =>
      h('button', { class: 'btn quiet', type: 'button', 'aria-pressed': String(l.id === list), onclick: () => { list = l.id; data = null; load(false); } }, l.label)));
    refreshBtn.disabled = loading;
    status.textContent = loading ? 'Loading…' : data ? `Updated ${ago(data.fetchedAt)} ago` : '';
    if (loading && !data) {
      body.replaceChildren(...Array.from({ length: 6 }, () => h('div', { class: 'fd-skel' })));
      return;
    }
    const rows = [];
    if (error) rows.push(h('div', { class: 'fd-error', role: 'alert' }, error, data ? null : h('button', { class: 'btn', type: 'button', onclick: () => load(true) }, 'Try again')));
    if (data) {
      rows.push(...data.stories.map((s, i) => {
        const saveBtn = h('button', { class: 'btn', type: 'button' }, 'Save for a wait');
        saveBtn.addEventListener('click', () => save(s, saveBtn));
        return h('article', { class: 'fd-item' },
          h('span', { class: 'fd-rank' }, String(i + 1)),
          h('div', { class: 'fd-main' },
            h('a', { class: 'fd-title', href: s.url, onclick: (e) => { e.preventDefault(); open(s.url); } }, s.title),
            h('div', { class: 'fd-meta' }, `${s.score} points`, ' · ', h('a', { href: s.hn, onclick: (e) => { e.preventDefault(); open(s.hn); } }, `${s.comments} comments`), ` · ${s.domain} · ${ago(s.time)} ago · ~${s.minutes} min`)),
          saveBtn);
      }));
    }
    body.replaceChildren(...rows);
    ctx.setSummary(data && !error ? `${data.stories.length} stories ready` : '');
  }

  ctx.onRefresh(() => data && !el.hidden && load(true));
  paint();
}
