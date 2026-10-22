// Typing: backend entry. The games run in the app window; the daemon keeps the best scores and awards XP,
// using the score store every game feature shares. Routes: /features/typing/<route>.
import { gameBackend } from '../src/scores.js';

export const GAMES = {
  sprint: { name: 'Word sprint', better: 'higher', unit: 'wpm' },
  passage: { name: 'Passage', better: 'higher', unit: 'wpm' },
};

export default gameBackend({ games: GAMES });
