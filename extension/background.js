const BASE = 'http://127.0.0.1:47821';
const last = new Map();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'queue', title: 'Save to Qeuli reading queue', contexts: ['page', 'link'] });
  chrome.alarms.create('reconnect', { periodInMinutes: 0.5 });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  fetch(`${BASE}/queue`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: info.linkUrl || info.pageUrl, title: info.linkUrl ? undefined : tab?.title }),
  }).catch(() => {});
});

function notify(session) {
  const needsYou = session.status === 'waiting';
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: needsYou ? 'Your agent needs you' : 'Your agent is done',
    message: session.message || session.cwd || session.source,
  });
}

function onState(state) {
  for (const s of state.sessions) {
    const prev = last.get(s.id);
    if (prev && prev !== s.status && (s.status === 'waiting' || s.status === 'idle')) notify(s);
    last.set(s.id, s.status);
  }
  const running = state.sessions.filter((s) => s.status === 'running').length;
  chrome.action.setBadgeText({ text: running ? String(running) : '' });
}

let connecting = false;
async function connect() {
  if (connecting) return;
  connecting = true;
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
        try { onState(JSON.parse(line)); } catch {}
      }
    }
  } catch {}
  connecting = false;
}

chrome.alarms.onAlarm.addListener(connect);
chrome.runtime.onStartup.addListener(connect);
connect();
