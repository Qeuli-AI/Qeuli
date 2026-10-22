// The typing games. Each mounts into a host element and returns { stop() } (see gamekit.js).
import { wordPool, typingStats, shuffle } from './rules.js';
import { buildPassage, charStates, passageStats } from './passages.js';

// ------------------------------------------------------------------ typing sprint

export function mountSprint(host, { h, end, opts = {} }) {
  const SECONDS = Number(opts.time) || 30;
  const pool = wordPool(opts.words);
  const current = h('div', { class: 'ty-word', 'aria-live': 'polite' });
  const upcoming = h('div', { class: 'ty-next' });
  const input = h('input', { type: 'text', class: 'ty-input', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, 'aria-label': 'Type the word', placeholder: 'Start typing to begin' });
  const info = h('div', { class: 'gk-info' });
  const result = h('div', { class: 'ty-result', hidden: true });
  host.append(info, current, upcoming, input, result);

  let words;
  let i;
  let started;
  let t0;
  let timer;
  let correctChars;
  let correctWords;
  let wrongWords;

  function reset() {
    clearInterval(timer);
    // Plenty of words for the fastest typist over the longest sprint.
    words = [];
    while (words.length < 300) words.push(...shuffle(pool));
    i = 0;
    started = false;
    correctChars = correctWords = wrongWords = 0;
    input.value = '';
    input.disabled = false;
    result.hidden = true;
    paint();
    info.textContent = `${SECONDS} seconds. The clock starts when you type.`;
    input.focus();
  }
  function paint() {
    current.textContent = words[i];
    upcoming.textContent = words.slice(i + 1, i + 7).join('  ');
  }
  function finish() {
    clearInterval(timer);
    input.disabled = true;
    const s = typingStats({ correctChars, correctWords, wrongWords, seconds: SECONDS });
    info.textContent = 'Time.';
    result.hidden = false;
    result.replaceChildren(h('b', {}, `${s.wpm} wpm`), h('span', {}, `${s.accuracy}% of words right`), h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Again'));
    end(s.wpm);
  }
  function tick() {
    const left = Math.max(0, SECONDS - (performance.now() - t0) / 1000);
    const elapsed = SECONDS - left;
    const wpm = elapsed > 2 ? Math.round(correctChars / 5 / (elapsed / 60)) : 0;
    info.textContent = `${Math.ceil(left)}s left   ${wpm} wpm`;
    if (left <= 0) finish();
  }
  input.addEventListener('input', () => {
    if (!started && input.value) {
      started = true;
      t0 = performance.now();
      timer = setInterval(tick, 200);
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    const typed = input.value.trim();
    if (!typed) return;
    if (typed === words[i]) {
      correctWords += 1;
      correctChars += words[i].length + 1;
    } else {
      wrongWords += 1;
    }
    i += 1;
    input.value = '';
    paint();
  });
  reset();
  return { stop: () => clearInterval(timer) };
}

// ------------------------------------------------------------------ long-form typing

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Type a whole passage of prose or code. Each character turns green or red as you go; backspace works. */
export function mountPassage(host, { h, end, opts = {} }) {
  const kind = opts.text === 'code' ? 'code' : 'prose';
  const info = h('div', { class: 'gk-info' });
  const fill = h('i');
  const bar = h('div', { class: 'ps-bar', role: 'progressbar', 'aria-label': 'Progress through the passage', 'aria-valuemin': '0', 'aria-valuemax': '100' }, fill);
  const text = h('div', { class: `ps-text${kind === 'code' ? ' code' : ''}`, 'aria-hidden': 'true' });
  // A see-through textarea covers the text, so a click anywhere focuses it and the browser does the typing.
  const input = h('textarea', { class: 'ps-input', rows: 1, autocomplete: 'off', autocapitalize: 'off', spellcheck: false, 'aria-label': `Type the ${kind === 'code' ? 'code' : 'passage'} shown above` });
  const result = h('div', { class: 'ty-result', hidden: true });
  host.append(info, bar, h('div', { class: 'ps-stage' }, text, input), result);

  let target;
  let spans;
  let prev;
  let caret = 0;
  let keystrokes;
  let mistakes;
  let t0;
  let done;
  let timer;

  const stats = () => passageStats({ typed: prev, target, keystrokes, mistakes, ms: t0 ? performance.now() - t0 : 0 });

  function reset() {
    clearInterval(timer);
    target = buildPassage(kind, opts.length);
    spans = Array.from(target, (ch) => h('span', { class: 'todo' }, ch === '\n' ? '↵\n' : ch));
    text.replaceChildren(...spans);
    text.scrollTop = 0;
    prev = '';
    caret = 0;
    keystrokes = mistakes = 0;
    t0 = 0;
    done = false;
    input.value = '';
    input.disabled = false;
    result.hidden = true;
    fill.style.width = '0%';
    bar.setAttribute('aria-valuenow', '0');
    spans[0].classList.add('cur');
    info.textContent = `${target.split(/\s+/).length} words. The clock starts with your first key.`;
    input.focus({ preventScroll: true });
  }

  function paint(typed) {
    const states = charStates(typed, target);
    let p = 0;
    while (p < prev.length && p < typed.length && prev[p] === typed[p]) p++;
    for (let i = p; i < Math.max(prev.length, typed.length) && i < spans.length; i++) spans[i].className = states[i];
    spans[caret]?.classList.remove('cur');
    caret = typed.length;
    const at = spans[caret];
    if (at) {
      at.classList.add('cur');
      // Keep the next character in view without scrolling the whole page.
      if (at.offsetTop < text.scrollTop + 8) text.scrollTop = at.offsetTop - 8;
      else if (at.offsetTop + at.offsetHeight > text.scrollTop + text.clientHeight - 8) text.scrollTop = at.offsetTop + at.offsetHeight - text.clientHeight + 8;
    }
  }

  function live() {
    const s = stats();
    const pct = Math.round((prev.length / target.length) * 100);
    fill.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(pct));
    info.textContent = `${t0 && performance.now() - t0 > 3000 ? s.wpm : '--'} wpm   ${keystrokes ? s.accuracy : 100}% accurate   ${prev.length} of ${target.length} characters`;
  }

  function finish() {
    done = true;
    clearInterval(timer);
    input.disabled = true;
    const s = stats();
    live();
    result.hidden = false;
    result.replaceChildren(h('b', {}, `${s.wpm} wpm`), h('span', {}, `${s.accuracy}% accurate in ${clock(s.seconds)}`), h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Another passage'));
    end(s.wpm);
  }

  input.addEventListener('input', () => {
    if (done) return;
    let v = input.value;
    if (v.length > target.length) v = v.slice(0, target.length);
    if (input.value !== v) input.value = v;
    if (!t0 && v) {
      t0 = performance.now();
      timer = setInterval(live, 500);
    }
    for (let i = prev.length; i < v.length; i++) {
      keystrokes += 1;
      if (v[i] !== target[i]) mistakes += 1;
    }
    paint(v);
    prev = v;
    live();
    if (v.length === target.length) finish();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && kind === 'prose') e.preventDefault(); // prose has no line breaks to type
  });
  for (const ev of ['paste', 'drop']) input.addEventListener(ev, (e) => e.preventDefault()); // typing practice, so no shortcuts

  reset();
  return { stop: () => clearInterval(timer) };
}
