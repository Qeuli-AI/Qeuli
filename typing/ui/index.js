// Typing: frontend entry. The shelf, setup screen and game window come from the shared game kit; this
// file only describes the games.
import { mountShelf } from '../../gamekit.js';
import { mountSprint, mountPassage } from './games.js';
import { OPTIONS } from './options.js';

const NAV_ICON = '<rect x="2.500" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>';

export function mount(ctx) {
  ctx.loadCss(new URL('./typing.css', import.meta.url));
  mountShelf(ctx, {
    id: 'typing',
    label: 'Typing',
    icon: NAV_ICON,
    options: OPTIONS,
    games: {
      sprint: {
        mount: mountSprint, color: '#7fb3ff', blurb: 'Developer words against the clock.',
        icon: '<rect x="2.500" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
        tip: 'The clock starts when you type. Space submits a word.',
      },
      passage: {
        mount: mountPassage, color: '#b89cff', blurb: 'Type a whole passage of prose or code.',
        icon: '<path d="M4 6h16M4 10h16M4 14h10M4 18h13"/>',
        tip: 'The clock starts with your first key. Backspace fixes a slip, but a slip still counts against accuracy.',
      },
    },
  });
}
