// The reading queue: links saved for waits. It lives under the Web division.
import { h, post, toast, openUrl } from './lib.js';
import { DIVISIONS } from './brand.js';

export function buildQueue(app) {
  const d = DIVISIONS.find((x) => x.id === 'web');
  const el = h('section', { class: 'page', id: 'page-queue', hidden: true });
  const list = h('div');

  const url = h('input', { id: 'qurl', type: 'url', required: true, placeholder: 'https://' });
  const title = h('input', { id: 'qtitle', type: 'text' });
  const minutes = h('input', { id: 'qmin', type: 'number', min: 1, max: 120, value: 5 });
  const form = h('form', { class: 'stackform', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await post('/queue', { url: url.value, title: title.value || undefined, minutes: Number(minutes.value) || 5 });
      form.reset();
      minutes.value = 5;
      toast('Saved');
    } catch (err) {
      toast(err.message);
    }
  } },
    h('div', { class: 'field' }, h('label', { for: 'qurl' }, 'Link'), url),
    h('div', { class: 'field' }, h('label', { for: 'qtitle' }, 'Title (optional)'), title),
    h('div', { class: 'field' }, h('label', { for: 'qmin' }, 'Minutes to read'), minutes),
    h('div', {}, h('button', { class: 'btn primary', type: 'submit' }, 'Save')));

  el.append(
    h('div', { class: 'pagehead' }, h('div', {}, h('a', { class: 'kicker', href: '#/d/web', style: `--c:${d.color}` }, h('i', {}, '←'), 'Web'), h('h1', {}, 'Reading queue'),
      h('p', {}, 'Links saved for waits. A queued read is offered when its length fits the time you have.'))),
    h('div', { class: 'cols' },
      h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Save a link'), form),
      h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Saved'), list)));

  function update() {
    const q = app.state.queue;
    list.replaceChildren(...(q.length
      ? q.map((item) =>
          h('div', { class: 'q' },
            h('a', { href: item.url, onclick: (e) => { e.preventDefault(); openUrl(item.url); }, title: item.url }, item.title),
            h('span', { class: 'min' }, `${item.minutes} min`),
            h('button', { class: 'btn quiet', type: 'button', 'aria-label': `Mark ${item.title} read`, onclick: () => post(`/queue/${item.id}/done`) }, 'Done')))
      : [h('div', { class: 'empty' }, h('b', {}, 'Empty. '), 'Save a link here, or add stories from the Feed.')]));
  }
  return { el, update, onShow: update };
}
