// The memory games. Each mounts into a host element and returns { stop() } (see gamekit.js).
import { makeDeck } from './rules.js';

const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const PALETTE = ['#ffd84d', '#ff9ec4', '#63c8c1', '#b89cff', '#7fb3ff', '#8bd66b', '#ffa463', '#5ed6e8'];

// ------------------------------------------------------------------ memory match

const SHAPE_SVG = {
  circle: '<circle cx="12" cy="12" r="7.500"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  triangle: '<path d="M12 4l8.500 15H3.500z"/>',
  diamond: '<path d="M12 3l9 9-9 9-9-9z"/>',
  star: '<path d="M12 3l2.600 5.600 6 .8-4.400 4.200 1.100 6L12 16.700 6.700 19.600l1.100-6L3.400 9.400l6-.8z"/>',
  plus: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
  ring: '<circle cx="12" cy="12" r="6.500" fill="none" stroke-width="4"/>',
  bar: '<rect x="3.500" y="9.500" width="17" height="5" rx="2.500"/>',
};

export function mountMatch(host, { h, end, opts = {} }) {
  const PAIRS = Number(opts.pairs) || 8;
  const FLIP_BACK = opts.flip === 'fast' ? 380 : 750;
  const info = h('div', { class: 'gk-info' });
  const grid = h('div', { class: 'mm-grid' });
  host.append(info, grid, h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn', type: 'button', onclick: () => reset() }, 'New game')));

  let deck;
  let open;
  let matched;
  let moves;
  let locked;
  let timer;

  function shape(card) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.style.fill = PALETTE[Object.keys(SHAPE_SVG).indexOf(card.shape)];
    s.style.stroke = css('--ink', '#000');
    s.style.strokeWidth = '1.5';
    s.innerHTML = SHAPE_SVG[card.shape]; // static markup defined above
    return s;
  }
  function render() {
    grid.replaceChildren(...deck.map((card) => {
      const up = open.includes(card.id) || matched.has(card.id);
      return h('button', { class: `m-card${up ? ' up' : ''}${matched.has(card.id) ? ' done' : ''}`, type: 'button', 'aria-label': up ? card.shape : 'face down card', disabled: up || locked, onclick: () => flip(card) }, up ? shape(card) : null);
    }));
    info.textContent = matched.size === deck.length ? `Matched all in ${moves} moves.` : `Moves ${moves}   Pairs ${matched.size / 2} of ${deck.length / 2}`;
  }
  function flip(card) {
    if (locked || open.includes(card.id) || matched.has(card.id)) return;
    open.push(card.id);
    if (open.length === 2) {
      moves += 1;
      const [a, b] = open.map((id) => deck[id]);
      if (a.shape === b.shape) {
        matched.add(a.id);
        matched.add(b.id);
        open = [];
        if (matched.size === deck.length) end(moves);
      } else {
        locked = true;
        timer = setTimeout(() => { open = []; locked = false; render(); }, FLIP_BACK);
      }
    }
    render();
  }
  function reset() {
    clearTimeout(timer);
    deck = makeDeck(Math.random, PAIRS);
    open = [];
    matched = new Set();
    moves = 0;
    locked = false;
    if (opts.peek === 'on') {
      // Show every card for a moment, then turn them over. Moves are not counted for the peek.
      open = deck.map((c) => c.id);
      locked = true;
      timer = setTimeout(() => { open = []; locked = false; render(); }, 1800);
    }
    render();
  }
  reset();
  return { stop: () => clearTimeout(timer) };
}
