// Long-form typing: the text to type, how each character is marked, and the speed and accuracy stats.
// No DOM in here, so all of it can be tested. Everything is plain ASCII so any keyboard can type it.

const lines = (...l) => l.map((x) => x.trimStart()).join('\n'); // indentation is skipped, only the code itself is typed

export const PROSE = [
  'Good names are a gift to the next person who reads your code, and the next person is usually you in six months. Pick words that say what a thing is for, not how it happens to work today. If a name needs a comment to explain it, spend the effort on the name instead.',
  'A bug that only appears on Fridays is almost never about Fridays. It is about a clock, a cache, a queue that fills up, or a person who ran the script by hand. Write down what changed, shrink the problem until it fits on one screen, and the answer tends to walk out on its own.',
  'Waiting is part of the job now. You hand a task to an agent, and for a few minutes the machine does the typing while you do the thinking. Use that gap well. Stand up, drink some water, look at something far away, and come back ready to read the diff with fresh eyes.',
  'Tests are a promise you make to your future self. They say that this behavior mattered enough to write down. A small test that runs in a blink gets run a hundred times a day, while a slow one gets skipped, and a skipped test protects nothing at all.',
  'Caching is easy until the first time the data changes. Then you learn that every cache is really a small bet that the world will stay the same for a while. Decide how long you are willing to be wrong, write that number next to the code, and make it easy to clear.',
  'Code review is not a search for mistakes so much as a conversation about intent. Ask what the author was trying to do before you decide how they should have done it. A kind question will fix more problems than a sharp correction, and it keeps people willing to ask for review.',
  'Estimates are guesses wearing a suit. They get better when you split the work into pieces small enough to picture, and worse when someone treats them as a promise. Give a range, name what you do not know yet, and update it out loud as soon as you learn something new.',
  'Logs are letters to the person who is on call at three in the morning. Say what happened, to which request, and what the system did about it. Skip the cleverness. That person is tired, the problem is real, and every clear line you wrote saves them a minute.',
  'Refactoring works best in small steps with the tests green after each one. Move a function, run the tests, rename a variable, run the tests again. Big rewrites feel faster until the day they do not compile, and then nobody can say which change broke what.',
  'Documentation is the part of a project that explains why. The code already says what happens, and the history says when, but only a few honest sentences can say why you chose this road over the others. Write them while the reasons are still fresh in your head.',
  'Sleep is a performance tool, and the best debugger you own is a rested brain. Many hard problems dissolve after a walk or a night away from the screen. If you have been stuck for an hour, the next best move might be to close the laptop and come back tomorrow.',
  'Shipping small and often keeps the fear down. A change that touches five lines is easy to read, easy to test, and easy to undo. A change that touches five hundred waits in a branch, grows conflicts, and turns every release into an event that people dread.',
];

export const CODE = [
  lines(
    'function debounce(fn, wait) {',
    '  let timer;',
    '  return (...args) => {',
    '    clearTimeout(timer);',
    '    timer = setTimeout(() => fn(...args), wait);',
    '  };',
    '}'),
  lines(
    'async function retry(task, tries = 3) {',
    '  for (let i = 0; i < tries; i++) {',
    '    try {',
    '      return await task();',
    '    } catch (err) {',
    '      if (i === tries - 1) throw err;',
    '    }',
    '  }',
    '}'),
  lines(
    'def chunks(items, size):',
    '    for i in range(0, len(items), size):',
    '        yield items[i:i + size]'),
  lines(
    'counts = {}',
    'for word in text.split():',
    '    counts[word] = counts.get(word, 0) + 1',
    'top = sorted(counts, key=counts.get, reverse=True)[:5]'),
  lines(
    'SELECT user_id, COUNT(*) AS runs',
    'FROM sessions',
    "WHERE started_at >= NOW() - INTERVAL '7 days'",
    'GROUP BY user_id',
    'ORDER BY runs DESC',
    'LIMIT 10;'),
  lines(
    'git fetch origin',
    'git rebase origin/main',
    'npm test && npm run build',
    'git push --force-with-lease'),
  lines(
    'type Result<T> = { ok: true; value: T } | { ok: false; error: string };',
    'function parse(input: string): Result<number> {',
    '  const n = Number(input);',
    '  return Number.isNaN(n) ? { ok: false, error: "not a number" } : { ok: true, value: n };',
    '}'),
  lines(
    '.card {',
    '  display: grid;',
    '  gap: 12px;',
    '  padding: 16px;',
    '  border: 2px solid #111;',
    '}'),
  lines(
    'const grouped = items.reduce((acc, item) => {',
    '  (acc[item.kind] ||= []).push(item);',
    '  return acc;',
    '}, {});'),
  lines(
    'for f in *.log; do',
    '  echo "$f: $(wc -l < "$f") lines"',
    'done'),
];

/** How many passages each length uses. */
export const LENGTHS = { short: 1, medium: 2, long: 4 };

function shuffled(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The text for one run. Prose passages are joined with a space; code snippets with a blank line.
 * Nothing repeats within a run, and code never asks for more than a few snippets.
 */
export function buildPassage(kind = 'prose', length = 'medium', rand = Math.random) {
  const code = kind === 'code';
  const library = code ? CODE : PROSE;
  const want = LENGTHS[length] ?? LENGTHS.medium;
  const n = Math.min(library.length, code ? Math.min(want, 3) : want);
  return shuffled(library, rand).slice(0, n).join(code ? '\n\n' : ' ');
}

/** 'ok' | 'bad' | 'todo' for every character of the target, given what has been typed so far. */
export function charStates(typed, target) {
  return Array.from(target, (ch, i) => (i >= typed.length ? 'todo' : typed[i] === ch ? 'ok' : 'bad'));
}

/**
 * Words per minute counts only characters that are right (five characters make a word), so guessing
 * wildly never pays. Accuracy is about keystrokes: a mistake you fixed still happened.
 */
export function passageStats({ typed, target, keystrokes, mistakes, ms }) {
  let correct = 0;
  for (let i = 0; i < typed.length && i < target.length; i++) if (typed[i] === target[i]) correct++;
  const minutes = ms / 60000;
  const wpm = minutes > 0 ? Math.round(correct / 5 / minutes) : 0;
  const accuracy = keystrokes > 0 ? Math.max(0, Math.round(((keystrokes - mistakes) / keystrokes) * 100)) : 0;
  return { wpm, accuracy, correct, seconds: Math.round(ms / 1000) };
}
