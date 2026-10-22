// Fonts and visual styles the player can choose. The CSS for each lives in styles.css, keyed by the
// data-font and data-look attributes on <html>.

export const FONT_PACKS = [
  { id: 'sticker', name: 'Sticker', desc: 'Bold condensed headlines, mono text, a hand-drawn touch.', sample: "font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase" },
  { id: 'editorial', name: 'Editorial', desc: 'Italic serif headlines over a coding mono.', sample: "font-family:'Instrument Serif',Georgia,serif;font-style:italic" },
  { id: 'terminal', name: 'Terminal', desc: 'One mono face everywhere, like your editor.', sample: "font-family:'JetBrains Mono',monospace;font-weight:600" },
  { id: 'clean', name: 'Clean', desc: 'A friendly geometric sans, no frills.', sample: "font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700" },
];

export const LOOKS = [
  { id: 'sticker', name: 'Sticker', desc: 'Thick outlines, hard shadows, flat bright colour.' },
  { id: 'calm', name: 'Calm', desc: 'Hairlines, soft corners, quiet space.' },
];

export function applyLook(prefs) {
  const root = document.documentElement;
  root.dataset.font = prefs.font;
  root.dataset.look = prefs.look;
  root.dataset.layout = 'sidebar'; // the sidebar is the only layout
  root.dataset.density = prefs.density;
  root.dataset.motion = prefs.motion;
}
