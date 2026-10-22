// Memory: backend entry. The games run in the app window; the daemon keeps the best scores and awards XP,
// using the score store every game feature shares. Routes: /features/memory/<route>.
import { gameBackend } from '../src/scores.js';

export const GAMES = {
  match: { name: 'Pair match', better: 'lower', unit: 'moves' },
  chimp: { name: 'Chimp test', better: 'higher', unit: 'numbers' },
  sequence: { name: 'Sequence memory', better: 'higher', unit: 'levels' },
};

export default gameBackend({ games: GAMES });
