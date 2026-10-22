import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeed, toStory, LISTS } from './feed.js';

const item = (id, extra = {}) => ({ id, type: 'story', title: `Story ${id}`, url: `https://www.example.com/${id}`, score: 10 + id, descendants: id, by: 'pg', time: 1_700_000_000, ...extra });

/** A fake Hacker News: ids per list and an item table, with a call counter. */
function fakeHN({ lists = { topstories: [1, 2, 3] }, items = {}, failAll = false } = {}) {
  const calls = [];
  const table = { 1: item(1), 2: item(2), 3: item(3), ...items };
  const fetchImpl = async (url) => {
    calls.push(url);
    if (failAll) throw Object.assign(new Error('network down'), { name: 'TypeError' });
    const m = url.match(/\/v0\/(\w+)\.json$/);
    if (m) return { ok: true, json: async () => lists[m[1]] ?? [] };
    const n = url.match(/item\/(\d+)\.json$/);
    return { ok: true, json: async () => table[n[1]] ?? null };
  };
  return { fetchImpl, calls, table };
}

test('a story keeps its domain, comment count and a "time" in milliseconds', () => {
  const s = toStory(item(7));
  assert.equal(s.domain, 'example.com', 'www is dropped');
  assert.equal(s.comments, 7);
  assert.equal(s.time, 1_700_000_000_000);
  assert.equal(s.hn, 'https://news.ycombinator.com/item?id=7');
});

test('Ask HN and Show HN posts, and posts with no link, point at the discussion and read quickly', () => {
  const ask = toStory(item(8, { title: 'Ask HN: what are you building?', url: undefined }));
  assert.equal(ask.url, 'https://news.ycombinator.com/item?id=8');
  assert.equal(ask.minutes, 3);
  assert.equal(toStory(item(9, { title: 'Show HN: my thing' })).minutes, 3);
  assert.equal(toStory(item(10, { url: 'https://x.org/paper.pdf' })).minutes, 12);
  assert.equal(toStory(item(11)).minutes, 6);
});

test('dead, deleted, non-story and untitled items are dropped, and bad URLs never become links', () => {
  assert.equal(toStory(item(1, { dead: true })), null);
  assert.equal(toStory(item(1, { deleted: true })), null);
  assert.equal(toStory(item(1, { type: 'comment' })), null);
  assert.equal(toStory(item(1, { title: '' })), null);
  assert.equal(toStory(null), null);
  assert.equal(toStory(item(2, { url: 'javascript:alert(1)' })).url, 'https://news.ycombinator.com/item?id=2');
});

test('stories come back in list order, and a second call is served from cache', async () => {
  const hn = fakeHN();
  const feed = createFeed({ fetchImpl: hn.fetchImpl, now: () => 1000 });
  const a = await feed.stories('top');
  assert.deepEqual(a.stories.map((s) => s.id), [1, 2, 3]);
  const before = hn.calls.length;
  const b = await feed.stories('top');
  assert.equal(hn.calls.length, before, 'no network the second time');
  assert.equal(b.stale, false);
});

test('refresh and an expired cache both fetch again', async () => {
  const hn = fakeHN();
  const clock = { t: 0 };
  const feed = createFeed({ fetchImpl: hn.fetchImpl, now: () => clock.t, ttlMs: 1000 });
  await feed.stories('top');
  const n = hn.calls.length;
  await feed.stories('top', { refresh: true });
  assert.ok(hn.calls.length > n);
  const m = hn.calls.length;
  clock.t = 5000;
  await feed.stories('top');
  assert.ok(hn.calls.length > m);
});

test('one broken item does not sink the list', async () => {
  const hn = fakeHN({ items: { 2: null } });
  const feed = createFeed({ fetchImpl: hn.fetchImpl });
  assert.deepEqual((await feed.stories('top')).stories.map((s) => s.id), [1, 3]);
});

test('offline with a cache returns the stale stories; offline without one is a 502', async () => {
  const hn = fakeHN();
  const clock = { t: 0 };
  let down = false;
  const fetchImpl = (url, init) => (down ? Promise.reject(new TypeError('offline')) : hn.fetchImpl(url, init));
  const feed = createFeed({ fetchImpl, now: () => clock.t, ttlMs: 10 });
  await assert.doesNotReject(feed.stories('top'));
  down = true;
  clock.t = 1000;
  const r = await feed.stories('top');
  assert.equal(r.stale, true);
  assert.match(r.error, /Could not reach Hacker News/);
  assert.equal(r.stories.length, 3);
  const cold = createFeed({ fetchImpl: fakeHN({ failAll: true }).fetchImpl });
  await assert.rejects(cold.stories('top'), (e) => e.status === 502);
});

test('only known lists are accepted', async () => {
  const feed = createFeed({ fetchImpl: fakeHN().fetchImpl });
  await assert.rejects(feed.stories('../../etc'), (e) => e.status === 400);
  assert.deepEqual(Object.keys(LISTS), ['top', 'new', 'best']);
});

test('find only returns stories we listed, by number or numeric string', async () => {
  const feed = createFeed({ fetchImpl: fakeHN().fetchImpl });
  assert.equal(feed.find(1), null, 'nothing listed yet');
  await feed.stories('top');
  assert.equal(feed.find(2).id, 2);
  assert.equal(feed.find('2').id, 2);
  assert.equal(feed.find(999), null);
});
