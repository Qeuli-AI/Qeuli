// Small delights: frontend entry. Same ctx contract as water/ui/index.js.
import { JOKES, ORACLE, riddleForDay, isCorrect, deck } from './content.js';

const NAV_ICON = '<circle cx="12" cy="12" r="9"/><path d="M8 14.500c1 1.500 2.500 2.300 4 2.300s3-.8 4-2.300M9 9.500h.01M15 9.500h.01"/>';

export function mount(ctx) {
  const { h } = ctx;
  ctx.loadCss(new URL('./fun.css', import.meta.url));
  const reduce = () => document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;

  let state = null;
  const nextJoke = deck(JOKES);
  const nextOracle = deck(ORACLE);

  // ---- joke ----
  const joke = h('p', { class: 'fn-big', 'aria-live': 'polite' }, nextJoke());
  const jokePanel = h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Dev joke'), joke,
    h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { joke.textContent = nextJoke(); joke.classList.remove('pop'); void joke.offsetWidth; joke.classList.add('pop'); } }, 'Another')));

  // ---- riddle ----
  const riddleQ = h('p', { class: 'fn-big' });
  const guess = h('input', { id: 'fn-guess', type: 'text', placeholder: 'Your answer', autocomplete: 'off', 'aria-label': 'Your answer' });
  const result = h('p', { class: 'fn-result', 'aria-live': 'polite' });
  const streakLine = h('p', { class: 'lab' });
  let riddle = null;
  let revealed = false;
  const riddleForm = h('form', { class: 'fn-row', onsubmit: async (e) => {
    e.preventDefault();
    if (!riddle || !guess.value.trim()) return;
    if (isCorrect(riddle, guess.value)) {
      try {
        state = await ctx.call('POST', 'solve');
        result.textContent = state.first ? 'Right! +10 XP' : 'Right again.';
        result.dataset.ok = 'true';
        renderRiddle();
      } catch (err) {
        ctx.toast(err.message);
      }
    } else {
      result.textContent = 'Not quite. Try again, or reveal the answer.';
      result.dataset.ok = 'false';
    }
  } }, guess, h('button', { class: 'btn primary', type: 'submit' }, 'Check'),
    h('button', { class: 'btn quiet', type: 'button', onclick: () => { revealed = true; renderRiddle(); } }, 'Reveal'));
  const riddlePanel = h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Riddle of the day'), riddleQ, riddleForm, result, streakLine);

  function renderRiddle() {
    if (!state) return;
    riddle = riddleForDay(state.today);
    riddleQ.textContent = riddle.q;
    const done = state.solvedToday;
    riddleForm.hidden = done || revealed;
    if (done) result.textContent = `Solved today. The answer: ${riddle.answers[0]}.`;
    else if (revealed) result.textContent = `The answer: ${riddle.answers[0]}. Tomorrow's is a fresh one.`;
    streakLine.textContent = state.streak ? `${state.streak}-day streak · ${state.totalSolved} solved in all` : state.totalSolved ? `${state.totalSolved} solved so far` : 'Solve one a day to build a streak';
    ctx.setSummary(state.enabled ? (done ? `Riddle solved · ${state.streak}-day streak` : 'A riddle is waiting') : '');
  }

  // ---- oracle ----
  const bird = h('div', { class: 'fn-bird hawk', 'aria-hidden': 'true' });
  const question = h('input', { id: 'fn-q', type: 'text', placeholder: 'Ask the hawk anything', autocomplete: 'off', 'aria-label': 'Your question' });
  const answer = h('p', { class: 'fn-big fn-answer', 'aria-live': 'polite' }, 'The hawk is thinking about it.');
  const ask = () => {
    bird.classList.remove('shake');
    void bird.offsetWidth;
    if (!reduce()) bird.classList.add('shake');
    answer.textContent = '…';
    setTimeout(() => {
      answer.textContent = nextOracle();
      answer.classList.remove('pop');
      void answer.offsetWidth;
      answer.classList.add('pop');
    }, reduce() ? 0 : 650);
  };
  const oraclePanel = h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Ask the hawk'),
    h('div', { class: 'fn-oracle' }, bird, h('div', {}, question, h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn primary', type: 'button', onclick: ask }, 'Ask')))), answer);
  question.addEventListener('keydown', (e) => e.key === 'Enter' && ask());

  // ---- coin and dice ----
  const coin = h('div', { class: 'fn-coin' }, h('span', { class: 'face front' }, 'H'), h('span', { class: 'face back' }, 'T'));
  const coinText = h('p', { class: 'lab' }, 'Heads or tails?');
  let flips = 0;
  const flip = () => {
    const heads = Math.random() < 0.5;
    flips += 1;
    coin.style.setProperty('--spin', `${flips * 1800 + (heads ? 0 : 180)}deg`);
    coin.classList.add('flipping');
    coinText.textContent = '…';
    setTimeout(() => { coinText.textContent = heads ? 'Heads' : 'Tails'; coin.classList.remove('flipping'); }, reduce() ? 0 : 900);
  };
  coin.addEventListener('click', flip);
  const dieOut = h('div', { class: 'fn-die', 'aria-live': 'polite' }, '–');
  const dieNote = h('p', { class: 'lab' }, 'Pick a die');
  const roll = (sides) => {
    const final = 1 + Math.floor(Math.random() * sides);
    dieNote.textContent = `d${sides}`;
    if (reduce()) { dieOut.textContent = String(final); return; }
    let n = 0;
    const t = setInterval(() => {
      dieOut.textContent = String(1 + Math.floor(Math.random() * sides));
      if (++n > 9) { clearInterval(t); dieOut.textContent = String(final); }
    }, 55);
  };
  const luckPanel = h('div', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'Leave it to luck'),
    h('div', { class: 'fn-luck' },
      h('div', { class: 'fn-col' }, h('button', { class: 'fn-coinbtn', type: 'button', onclick: flip, 'aria-label': 'Flip the coin' }, coin), coinText),
      h('div', { class: 'fn-col' }, dieOut, h('div', { class: 'choices' }, ...[6, 20, 100].map((n) => h('button', { class: 'btn', type: 'button', onclick: () => roll(n) }, `d${n}`))), dieNote)));

  const el = ctx.addView({ label: 'Small delights', icon: NAV_ICON, onShow: () => refresh() });
  el.append(h('div', { class: 'pad' }, h('div', { class: 'cols' }, jokePanel, riddlePanel, oraclePanel, luckPanel)));

  async function refresh() {
    try {
      state = await ctx.call('GET', 'state');
    } catch {
      return;
    }
    renderRiddle();
  }
  ctx.onRefresh(refresh);
  refresh();
}
