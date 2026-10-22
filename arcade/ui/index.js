// Arcade (the retro classics): frontend entry. The shelf, setup screen and game window come from the shared
// game kit; this file only describes the games.
import { mountShelf } from '../../gamekit.js';
import { mountSnake, mountG2048 } from './games.js';
import { OPTIONS } from './options.js';

const NAV_ICON = '<rect x="3" y="8" width="18" height="10" rx="3"/><path d="M8 11v4M6 13h4M16 12.500h.01M18 14.500h.01"/>';

export function mount(ctx) {
  ctx.loadCss(new URL('./arcade.css', import.meta.url));
  mountShelf(ctx, {
    id: 'arcade',
    label: 'Arcade',
    icon: NAV_ICON,
    options: OPTIONS,
    games: {
      snake: {
        mount: mountSnake, color: '#8bd66b', blurb: 'Eat, grow, do not hit yourself.',
        icon: '<path d="M4 18h6a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h12"/><circle cx="20" cy="6" r="1.200"/>',
        tip: 'Arrow keys or WASD. The first key starts the clock.',
      },
      g2048: {
        mount: mountG2048, color: '#ffd84d', blurb: 'Slide, merge, chase the big tile.',
        icon: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1" opacity=".5"/>',
        tip: 'Arrow keys, WASD or swipe. Equal tiles merge.',
      },
    },
  });
}
