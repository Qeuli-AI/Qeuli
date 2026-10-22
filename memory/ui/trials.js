// The Chimp test and Sequence memory. Each mounts into a host element and returns { stop() } (see gamekit.js).
// env = { h, opts, end(score), active() }.
import { newChimpRound, tapChimp, extendSequence, tapSequence } from './rules.js';

// ------------------------------------------------------------------ chimp test
// Numbers are scattered over a board. Tap them in order; after the first tap the rest are hidden, so you
// must remember where each one was. Clear a round and there is one more number next time. A miss is a strike.

export function mountChimp(host, { h, end, opts = {} }) {
  const [COLS, ROWS] = opts.grid === 'tight' ? [6, 4] : [8, 5];
  const CELLS = COLS * ROWS;
  const START = Math.min(Number(opts.start) || 4, CELLS);
  const MAX_STRIKES = Number(opts.strikes) || 3;

  const info = h('div', { class: 'gk-info' });
  const board = h('div', { class: 'cm-board', style: `--cols:${COLS};--rows:${ROWS}` });
  const card = h('div', { class: 'cm-card', hidden: true });
  host.append(info, board, card);

  let count = START; // how many numbers this round
  let strikes = 0;
  let cleared = 0; // the most numbers cleared in one round: the score
  let round;
  let hidden;
  let timer;
  let over = false;
  let locked = false; // true while a miss is being shown, so extra taps cannot count

  function status() {
    info.textContent = `Numbers ${count}   Strikes ${strikes} of ${MAX_STRIKES}`;
  }

  function paint() {
    board.replaceChildren(...Array.from({ length: CELLS }, (_, cell) => {
      const i = round.at.indexOf(cell);
      if (i === -1 || i + 1 < round.next) return h('span', { class: 'cm-empty' }); // empty, or already tapped
      return h('button', {
        class: `cm-sq${hidden ? ' masked' : ''}`, type: 'button',
        'aria-label': hidden ? 'hidden square' : `number ${i + 1}`,
        onclick: () => tap(cell),
      }, hidden ? '' : String(i + 1));
    }));
  }

  function startRound() {
    clearTimeout(timer);
    round = newChimpRound(count, CELLS);
    count = round.count;
    hidden = false;
    locked = false;
    card.hidden = true;
    board.hidden = false;
    status();
    paint();
  }

  function tap(cell) {
    if (over || locked || round.next > round.count) return;
    const first = round.next === 1;
    const r = tapChimp(round, cell);
    if (r === 'ignore') return;
    if (r === 'wrong') {
      strikes += 1;
      locked = true;
      hidden = false; // show where they were, so a miss teaches something
      paint();
      status();
      timer = setTimeout(() => finishRound(false), 1100);
      return;
    }
    if (first) hidden = true;
    paint();
    if (r === 'done') finishRound(true);
  }

  function finishRound(success) {
    board.hidden = true;
    card.hidden = false;
    if (success) cleared = Math.max(cleared, count);
    const perfect = success && count >= CELLS;
    const out = !success && strikes >= MAX_STRIKES;
    status();

    const rows = [
      h('div', { class: 'cm-big' }, String(count)),
      h('div', { class: 'cm-lab' }, 'Numbers'),
      h('div', { class: 'cm-line' }, `Strikes ${strikes} of ${MAX_STRIKES}`),
    ];
    if (perfect || out) {
      over = true;
      rows.push(h('div', { class: 'cm-line' }, perfect ? 'Every square on the board. Perfect.' : `Out of strikes. You cleared ${cleared || 'none'}.`));
      card.replaceChildren(...rows);
      end(cleared);
      return;
    }
    if (success) count += 1;
    const next = h('button', { class: 'btn primary big', type: 'button', onclick: startRound }, 'Continue');
    card.replaceChildren(...rows, h('div', { class: 'cm-line' }, success ? 'Cleared.' : 'Missed. Same count again.'), next);
    next.focus({ preventScroll: true });
  }

  startRound();
  return { stop: () => clearTimeout(timer) };
}

// ------------------------------------------------------------------ sequence memory
// Squares light up one after another. Repeat the pattern. Every level adds one more square, and one
// wrong tap ends the run. The score is how many levels you repeated.

const SPEED = { slow: { on: 800, gap: 300 }, normal: { on: 550, gap: 200 }, fast: { on: 350, gap: 150 } };
const SCALE = [0, 2, 4, 7, 9]; // a pentatonic scale, so any order of squares sounds fine

export function mountSequence(host, { h, end, opts = {} }) {
  const N = Number(opts.grid) === 4 ? 4 : 3;
  const CELLS = N * N;
  const speed = SPEED[opts.speed] || SPEED.normal;
  const sound = opts.sound === 'on';

  const info = h('div', { class: 'gk-info' });
  const cells = Array.from({ length: CELLS }, (_, i) =>
    h('button', { class: 'sq-cell', type: 'button', 'aria-label': `square ${i + 1}`, disabled: true, onclick: () => tap(i) }));
  const board = h('div', { class: 'sq-board', style: `--n:${N}` }, ...cells);
  host.append(info, board);

  let seq = [];
  let progress = 0;
  let phase = 'show'; // 'show' | 'input' | 'over'
  const timers = new Set();
  let audio = null;

  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
  };

  function beep(cell) {
    if (!sound) return;
    try {
      audio ??= new AudioContext();
      const o = audio.createOscillator();
      const g = audio.createGain();
      const semis = SCALE[cell % SCALE.length] + 12 * Math.floor(cell / SCALE.length);
      o.frequency.value = 261.63 * 2 ** (semis / 12);
      g.gain.setValueAtTime(0.0001, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.3);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.32);
    } catch { /* no audio available: the flashes still work */ }
  }

  const light = (cell, ms) => {
    cells[cell].classList.add('lit');
    beep(cell);
    later(() => cells[cell].classList.remove('lit'), ms);
  };

  function setInput(on) {
    phase = on ? 'input' : 'show';
    for (const c of cells) c.disabled = !on;
    info.textContent = on ? `Level ${seq.length}   Your turn` : `Level ${seq.length}   Watch`;
  }

  function nextLevel() {
    seq = extendSequence(seq, CELLS);
    progress = 0;
    setInput(false);
    const step = speed.on + speed.gap;
    seq.forEach((cell, i) => later(() => light(cell, speed.on), 600 + i * step));
    later(() => setInput(true), 600 + seq.length * step);
  }

  function tap(cell) {
    if (phase !== 'input') return;
    const r = tapSequence(seq, progress, cell);
    if (r.result === 'wrong') {
      phase = 'over';
      for (const c of cells) c.disabled = true;
      cells[cell].classList.add('bad');
      cells[seq[progress]].classList.add('hint'); // the one it should have been
      const score = seq.length - 1;
      info.textContent = `Out at level ${seq.length}. You repeated ${score} level${score === 1 ? '' : 's'}.`;
      end(score);
      return;
    }
    light(cell, 160);
    progress = r.progress;
    if (r.result === 'complete') {
      setInput(false);
      info.textContent = `Level ${seq.length}   Got it`;
      later(nextLevel, 800);
    }
  }

  info.textContent = 'Get ready';
  later(nextLevel, 500);
  return { stop: () => { for (const t of timers) clearTimeout(t); timers.clear(); audio?.close?.().catch(() => {}); } };
}
