// Hacker News stories through its public Firebase API (https://github.com/HackerNews/API).
// The daemon makes the requests from your machine; no account, no cookies, nothing about you is sent.
const HN = 'https://hacker-news.firebaseio.com/v0';
export const LISTS = { top: 'topstories', new: 'newstories', best: 'beststories' };

const DEFAULT_LIMIT = 30;
const BATCH = 10;
const TIMEOUT_MS = 8000;

const fail = (status, message) => Object.assign(new Error(message), { status });

export function toStory(item) {
  if (!item || item.type !== 'story' || item.dead || item.deleted || !item.title) return null;
  const hn = `https://news.ycombinator.com/item?id=${item.id}`;
  const external = typeof item.url === 'string' && /^https?:\/\//i.test(item.url);
  const url = external ? item.url : hn;
  let domain = 'news.ycombinator.com';
  if (external) {
    try {
      domain = new URL(item.url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }
  // A rough guess, shown with a "~": discussions and short posts are quicker than articles.
  const minutes = !external || /^(ask|show) hn/i.test(item.title) ? 3 : /\.pdf($|\?)/i.test(item.url) ? 12 : 6;
  return { id: item.id, title: String(item.title).slice(0, 200), url, domain, score: item.score ?? 0, comments: item.descendants ?? 0, by: item.by ?? '', time: (item.time ?? 0) * 1000, minutes, hn };
}

export function createFeed({ fetchImpl = globalThis.fetch, now = Date.now, ttlMs = 10 * 60_000 } = {}) {
  const cache = new Map(); // list -> { at, stories }

  async function getJson(url) {
    let res;
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw fail(502, `Could not reach Hacker News (${e.name === 'TimeoutError' ? 'timed out' : 'offline?'})`);
    }
    if (!res.ok) throw fail(502, `Hacker News answered ${res.status}`);
    return res.json();
  }

  /** The stories for a list, from cache if fresh. If the network fails, stale stories are better than none. */
  async function stories(list = 'top', { refresh = false, limit = DEFAULT_LIMIT } = {}) {
    if (!LISTS[list]) throw fail(400, `list must be one of ${Object.keys(LISTS).join(', ')}`);
    const cached = cache.get(list);
    if (cached && !refresh && now() - cached.at < ttlMs) return { list, stories: cached.stories, fetchedAt: cached.at, stale: false };
    try {
      const ids = (await getJson(`${HN}/${LISTS[list]}.json`)).slice(0, Math.min(Math.max(limit, 1), 60));
      const found = [];
      for (let i = 0; i < ids.length; i += BATCH) {
        const items = await Promise.allSettled(ids.slice(i, i + BATCH).map((id) => getJson(`${HN}/item/${id}.json`)));
        for (const r of items) if (r.status === 'fulfilled') found.push(toStory(r.value));
      }
      const list_ = found.filter(Boolean);
      if (!list_.length) throw fail(502, 'Hacker News returned no stories');
      cache.set(list, { at: now(), stories: list_ });
      return { list, stories: list_, fetchedAt: now(), stale: false };
    } catch (e) {
      if (cached) return { list, stories: cached.stories, fetchedAt: cached.at, stale: true, error: e.message };
      throw e;
    }
  }

  /** Find a story we have already listed, so "save" never trusts a URL sent from outside. */
  function find(id) {
    for (const { stories: s } of cache.values()) {
      const hit = s.find((x) => x.id === Number(id));
      if (hit) return hit;
    }
    return null;
  }

  return { stories, find };
}
