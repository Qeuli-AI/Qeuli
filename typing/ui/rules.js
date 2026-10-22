// The rules of the typing games, with no DOM, so they can be tested directly.

// ---- typing sprint ----

export const DEV_WORDS = ['const', 'async', 'await', 'refactor', 'commit', 'merge', 'branch', 'deploy', 'cache', 'query', 'render', 'state', 'props', 'hook', 'token', 'stream', 'buffer', 'thread', 'mutex', 'lambda', 'schema', 'index', 'router', 'socket', 'daemon', 'kernel', 'module', 'import', 'export', 'return', 'yield', 'filter', 'reduce', 'parse', 'build', 'lint', 'test', 'mock', 'stub', 'patch', 'rebase', 'stash', 'pipe', 'queue', 'stack', 'heap', 'graph', 'tree', 'node', 'edge', 'proxy', 'cookie', 'header', 'payload', 'client', 'server', 'bundle', 'compile', 'runtime', 'binary', 'vector', 'matrix', 'prompt', 'agent', 'context', 'latency', 'throttle', 'debounce', 'promise', 'closure'];

/** Which words a sprint draws from: all of them, the short ones, or the long ones. */
export function wordPool(kind = 'dev') {
  if (kind === 'short') return DEV_WORDS.filter((w) => w.length <= 5);
  if (kind === 'long') return DEV_WORDS.filter((w) => w.length >= 7);
  return DEV_WORDS;
}

/** Words per minute (5 characters = 1 word) and accuracy for a finished sprint. */
export function typingStats({ correctChars, correctWords, wrongWords, seconds }) {
  const wpm = seconds > 0 ? Math.round(correctChars / 5 / (seconds / 60)) : 0;
  const total = correctWords + wrongWords;
  return { wpm, accuracy: total ? Math.round((correctWords / total) * 100) : 0 };
}


export function shuffle(list, rand = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
