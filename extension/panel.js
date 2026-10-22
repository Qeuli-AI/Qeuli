const BASE = 'http://127.0.0.1:47821';
const $ = (id) => document.getElementById(id);

const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};

const label = { running: 'Working', waiting: 'Needs you', idle: 'Done' };

function render(state) {
  $('offline').style.display = 'none';
  const mins = Math.round(state.today.waitMs / 60000);
  $('today').textContent = `Today: ${state.today.runs} runs, ${mins} min of wait time`;

  $('sessions').replaceChildren(
    ...(state.sessions.length
      ? state.sessions.map((s) =>
          el('div', { className: `card ${s.status}` },
            el('div', { className: 'row' },
              el('span', {}, el('span', { className: 'dot' }), s.name || s.source),
              el('span', { className: 'muted' }, s.progress != null && s.status === 'running' ? `${Math.round(s.progress)}%` : label[s.status])),
            s.progress != null && s.status === 'running'
              ? el('progress', { value: s.progress, max: 100, style: 'width:100%' })
              : '',
            el('div', { className: 'muted' }, s.message || s.cwd || '')))
      : [el('div', { className: 'muted' }, 'No agent activity yet.')]),
  );

  $('queue').replaceChildren(
    ...(state.queue.length
      ? state.queue.map((q) => {
          const done = el('button', { textContent: 'Done' });
          done.onclick = () => fetch(`${BASE}/queue/${q.id}/done`, { method: 'POST' });
          return el('div', { className: 'card row' },
            el('a', { href: q.url, target: '_blank', rel: 'noreferrer', textContent: q.title }),
            el('span', { className: 'muted' }, `${q.minutes}m`), done);
        })
      : [el('div', { className: 'muted' }, 'Empty. Right-click any page or link to save it.')]),
  );
}

async function connect() {
  try {
    const res = await fetch(`${BASE}/stream`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, i).replace(/^data: /, '');
        buf = buf.slice(i + 2);
        try { render(JSON.parse(line)); } catch {}
      }
    }
  } catch {}
  $('offline').style.display = 'block';
  setTimeout(connect, 3000);
}

connect();
