// The character editor, shared by first-run setup and Settings > Story.
import { h } from './lib.js';
import { SIGIL_COLORS, epithet, prologue } from './story.js';

export const hawkMark = () => h('div', { class: 'hawk', 'aria-hidden': 'true' });

export function avatar(sigil) {
  return h('div', { class: 'avatar', style: `--c:${SIGIL_COLORS[sigil] || SIGIL_COLORS.hawk}` }, hawkMark());
}

/** A live "ID card": avatar, epithet, quest and the opening of the story. */
export function idCard(draft) {
  return h('div', { class: 'card-id' },
    avatar(draft.character.sigil),
    h('div', {},
      h('h3', {}, epithet(draft)),
      h('p', {}, `Quest: ${draft.character.quest}`)));
}

/**
 * Build the editor for `draft` (a profile-shaped object, edited in place).
 * `options` is { sigils, roles, quests, vibes }. `onChange` runs after every edit.
 */
export function characterForm(draft, options, onChange) {
  const change = () => onChange?.(draft);

  const choice = (label, key, list) => {
    const wrap = h('div', { class: 'choices', role: 'group', 'aria-label': label });
    const paint = () => wrap.replaceChildren(...list.map((v) =>
      h('button', { class: 'btn', type: 'button', 'aria-pressed': String(draft.character[key] === v), onclick: () => { draft.character[key] = v; paint(); change(); } }, v)));
    paint();
    return h('div', { class: 'block field' }, h('span', { class: 'lab' }, label), wrap);
  };

  const sigils = h('div', { class: 'sigils', role: 'group', 'aria-label': 'Sigil' });
  const paintSigils = () => sigils.replaceChildren(...options.sigils.map((s) =>
    h('button', { class: 'sigil', type: 'button', title: s, 'aria-label': s, 'aria-pressed': String(draft.character.sigil === s), style: `--c:${SIGIL_COLORS[s]}`, onclick: () => { draft.character.sigil = s; paintSigils(); change(); } }, hawkMark())));
  paintSigils();

  const name = h('input', { id: 'char-name', type: 'text', maxlength: 24, value: draft.name, placeholder: 'What should the hawk call you?', autocomplete: 'off', oninput: (e) => { draft.name = e.target.value; change(); } });
  const origin = h('textarea', { id: 'char-origin', maxlength: 140, placeholder: 'I started coding because…  (optional, one line)', oninput: (e) => { draft.character.origin = e.target.value; change(); } });
  origin.value = draft.character.origin || '';

  return h('div', {},
    h('div', { class: 'block field' }, h('label', { for: 'char-name' }, 'Your name'), name),
    h('div', { class: 'block field' }, h('span', { class: 'lab' }, 'Sigil'), sigils),
    choice('Role', 'role', options.roles),
    choice('Quest', 'quest', options.quests),
    choice('Vibe', 'vibe', options.vibes),
    h('div', { class: 'block field' }, h('label', { for: 'char-origin' }, 'Your origin'), origin));
}

/** The preview column: ID card plus the generated prologue. Call update() after edits. */
export function storyPreview(draft) {
  const card = h('div');
  const text = h('p', { class: 'prologue' });
  const el = h('div', {}, card, h('div', { class: 'eyebrow' }, 'Chapter zero'), text);
  const update = () => {
    card.replaceChildren(idCard(draft));
    text.textContent = prologue(draft);
  };
  update();
  return { el, update };
}
