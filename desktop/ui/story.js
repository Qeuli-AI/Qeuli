// The player's story, written from their own answers. No network, no model: just templates, so it is
// instant, private and predictable. Plain functions with no DOM, so they can be tested directly.

export const SIGIL_COLORS = { hawk: '#63C8C1', wave: '#7FB3FF', ember: '#FFA463', moss: '#8BD66B', volt: '#FFD84D', dusk: '#B89CFF' };

const lower = (s) => String(s || '').toLowerCase();
const who = (p) => p.name || 'You';

/** A short title for the card: "NAMAN, THE CALM BUILDER". */
export function epithet(p) {
  const c = p.character;
  return `${who(p)}, the ${lower(c.vibe)} ${lower(c.role)}`;
}

/** The opening paragraph, shown while the character is being made and again on the Story page. */
export function prologue(p) {
  const c = p.character;
  const name = who(p);
  const origin = (c.origin || '').trim().replace(/[.!?]+$/, '');
  const lines = [
    `${name} is a ${lower(c.vibe)} ${lower(c.role)} with one quest: ${lower(c.quest)}.`,
    origin ? `It began like this: "${origin}".` : '',
    `Whenever an agent takes over the keyboard, a hawk circles overhead, waiting for ${name === 'You' ? 'you' : name} to look up, drink some water, and come back sharper.`,
  ];
  return lines.filter(Boolean).join(' ');
}

// Each chapter unlocks at a level. {name} and {quest} are filled in from the profile.
export const CHAPTERS = [
  { level: 1, title: 'The First Wait', text: '{name} sits down, the agent starts typing, and for the first time the waiting has company. The hawk lands on the monitor and watches the cursor.' },
  { level: 2, title: 'Fresh Water', text: 'A glass appears on the desk. {name} drinks it without being asked. The hawk tilts its head: this is going to work.' },
  { level: 3, title: 'Eyes on the Horizon', text: 'Twenty feet away there is a window, and beyond it, weather. {name} had forgotten. The hawk has not.' },
  { level: 4, title: 'The Quiet Stretch', text: 'Shoulders drop, wrists unclench. Somewhere in the build output, a long task finishes without {name} even noticing.' },
  { level: 5, title: 'Signal in the Noise', text: 'The agent is fast, but {name} is learning to read what it did and why. The quest ({quest}) feels closer.' },
  { level: 6, title: 'The Long Run', text: 'A run that would have eaten an afternoon now fits around a walk, a read, and a game of snake. The hawk circles higher.' },
  { level: 8, title: "Hawk's Eye", text: '{name} spots the bug before the agent does. Rested minds notice things. The hawk says nothing, and looks smug.' },
  { level: 10, title: 'The Summit', text: 'From up here the whole project is a map. {name} chose the path, the agent walked it, and the hawk got the view. The quest ({quest}) is yours.' },
];

const fill = (text, p) => text.replaceAll('{name}', who(p)).replaceAll('{quest}', lower(p.character.quest));

/** Which chapters are open at this level, which one is current, and what unlocks next. */
export function chaptersFor(p, level) {
  const unlocked = CHAPTERS.filter((c) => c.level <= level).map((c) => ({ ...c, text: fill(c.text, p) }));
  const next = CHAPTERS.find((c) => c.level > level) ?? null;
  return { unlocked, current: unlocked[unlocked.length - 1] ?? null, next: next && { level: next.level, title: next.title } };
}

/** A friendly greeting that changes with the time of day. */
export function greeting(p, date = new Date()) {
  const h = date.getHours();
  const part = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return p.name ? `${part}, ${p.name}` : part;
}
