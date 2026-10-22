// Memory: frontend entry. The shelf, setup screen and game window come from the shared game kit; this
// file only describes the games.
import { mountShelf } from '../../gamekit.js';
import { mountMatch } from './games.js';
import { mountChimp, mountSequence } from './trials.js';
import { OPTIONS } from './options.js';

const NAV_ICON = '<rect x="3" y="5" width="8" height="14" rx="1.500"/><rect x="13" y="5" width="8" height="14" rx="1.500" opacity=".5"/><path d="M7 12h.01"/>';

export function mount(ctx) {
  ctx.loadCss(new URL('./memory.css', import.meta.url));
  mountShelf(ctx, {
    id: 'memory',
    label: 'Memory',
    icon: NAV_ICON,
    options: OPTIONS,
    games: {
      match: {
        mount: mountMatch, color: '#ff9ec4', blurb: 'Find the pairs in the fewest moves.',
        icon: '<rect x="3" y="5" width="8" height="14" rx="1.500"/><rect x="13" y="5" width="8" height="14" rx="1.500" opacity=".5"/><path d="M7 12h.01"/>',
        tip: 'Flip two cards at a time. Fewer moves is better.',
      },
      chimp: {
        mount: mountChimp, color: '#5ed6e8', blurb: 'Tap the numbers in order, after they vanish.',
        icon: '<rect x="3" y="3" width="8" height="8" rx="1.500"/><rect x="13" y="3" width="8" height="8" rx="1.500" opacity=".5"/><rect x="3" y="13" width="8" height="8" rx="1.500" opacity=".5"/><path d="M16.500 14v6M15 15.500l1.500-1.500"/>',
        tip: 'Tap 1 and the rest are hidden. Remember where each number was. A miss is a strike. Clear a round and the next has one more number.',
      },
      sequence: {
        mount: mountSequence, color: '#ffa463', blurb: 'Watch the pattern, then repeat it.',
        icon: '<rect x="4" y="4" width="7" height="7" rx="1.500"/><rect x="13" y="4" width="7" height="7" rx="1.500" fill="currentColor"/><rect x="4" y="13" width="7" height="7" rx="1.500"/><rect x="13" y="13" width="7" height="7" rx="1.500"/>',
        tip: 'Squares light up one by one. Repeat them in order. Each level adds one more, and one wrong tap ends the run.',
      },
    },
  });
}
