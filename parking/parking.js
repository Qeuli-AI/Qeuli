import { randomUUID } from 'node:crypto';

export const KINDS = ['idea', 'prompt', 'todo'];
const MAX_ITEMS = 200;
const MAX_TEXT = { idea: 400, todo: 400, prompt: 4000 }; // a drafted prompt can be long

const clean = (v) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim() : '');

// `store` is this feature's own persisted record; the core hands it in.
export function createParking({ store, save, now = Date.now, newId = randomUUID }) {
  const w = () => {
    store.enabled ??= true;
    store.items ??= [];
    return store;
  };

  function state() {
    const items = w().items;
    const count = (kind) => items.filter((i) => i.kind === kind && !i.done).length;
    return {
      enabled: w().enabled,
      items: items.slice().reverse(), // newest first
      counts: { idea: count('idea'), prompt: count('prompt'), todo: count('todo') },
      open: items.filter((i) => !i.done).length,
    };
  }

  function add(text, kind = 'idea') {
    if (!KINDS.includes(kind)) throw Object.assign(new Error(`kind must be one of ${KINDS.join(', ')}`), { status: 400 });
    const body = clean(text).slice(0, MAX_TEXT[kind]);
    if (!body) throw Object.assign(new Error('write something to park'), { status: 400 });
    const items = w().items;
    items.push({ id: newId(), t: now(), kind, text: body, done: false });
    // When full, drop the oldest finished items first, then the oldest of all.
    while (items.length > MAX_ITEMS) {
      const i = items.findIndex((x) => x.done);
      items.splice(i >= 0 ? i : 0, 1);
    }
    save();
    return state();
  }

  function find(id) {
    const item = w().items.find((i) => i.id === id);
    if (!item) throw Object.assign(new Error('not found'), { status: 404 });
    return item;
  }

  function toggle(id) {
    const item = find(id);
    item.done = !item.done;
    save();
    return state();
  }

  function remove(id) {
    find(id);
    w().items = w().items.filter((i) => i.id !== id);
    save();
    return state();
  }

  function clearDone() {
    w().items = w().items.filter((i) => !i.done);
    save();
    return state();
  }

  return { state, add, toggle, remove, clearDone };
}
