// Arcade (the retro classics): backend entry. The games run in the app window; the daemon keeps the best
// scores and awards XP, using the score store every game feature shares. Routes: /features/arcade/<route>.
import { gameBackend } from '../src/scores.js';

export const GAMES = {
  snake: { name: 'Snake', better: 'higher', unit: 'points' },
  g2048: { name: '2048', better: 'higher', unit: 'points' },
};

export default gameBackend({ games: GAMES });
