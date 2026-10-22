// Checks that apply to every game feature (Arcade, Typing, Memory): their option sets, the score labels
// those produce, and that the shared pieces fit together. New game features: add the id to FEATURES.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createOptions } from '../desktop/ui/gameopts.js';
import { VARIANT, MAX_VARIANTS } from '../src/scores.js';

const FEATURES = ['arcade', 'typing', 'memory'];

async function load(id) {
  const { GAMES } = await import(`../${id}/index.js`);
  const { OPTIONS } = await import(`../${id}/ui/options.js`);
  return { GAMES, OPTIONS, opt: createOptions(OPTIONS) };
}

test('each game feature has options for exactly the games it keeps scores for', async () => {
  for (const id of FEATURES) {
    const { GAMES, OPTIONS } = await load(id);
    assert.deepEqual(Object.keys(OPTIONS).sort(), Object.keys(GAMES).sort(), id);
    for (const g of Object.values(GAMES)) {
      assert.ok(g.name && ['higher', 'lower'].includes(g.better) && g.unit, `${id}: ${JSON.stringify(g)}`);
    }
  }
});

test('every option has a default that is one of its choices, and unique ids', async () => {
  for (const id of FEATURES) {
    const { OPTIONS } = await load(id);
    for (const [game, options] of Object.entries(OPTIONS)) {
      assert.equal(new Set(options.map((o) => o.id)).size, options.length, `${id}/${game}: duplicate option ids`);
      for (const o of options) {
        assert.ok(o.choices.length >= 2, `${id}/${game}/${o.id}: an option needs a choice to make`);
        assert.ok(o.choices.some(([v]) => v === o.def), `${id}/${game}/${o.id}: default is not a choice`);
        assert.equal(new Set(o.choices.map(([v]) => v)).size, o.choices.length, `${id}/${game}/${o.id}: duplicate values`);
      }
    }
  }
});

test('every combination of every game\'s options makes a score label the daemon accepts', async () => {
  let longest = '';
  for (const id of FEATURES) {
    const { OPTIONS, opt } = await load(id);
    for (const game of Object.keys(OPTIONS)) {
      for (const opts of opt.allSettings(game)) {
        const label = opt.variantOf(game, opts);
        assert.match(label, VARIANT, `${id}/${game}: ${label}`);
        if (label.length > longest.length) longest = label;
      }
    }
  }
  assert.ok(longest.length > 40, 'the longest label is longer than the old 40 character limit: ' + longest);
});

test('no game offers more scoring combinations than the daemon will keep', async () => {
  for (const id of FEATURES) {
    const { OPTIONS, opt } = await load(id);
    for (const game of Object.keys(OPTIONS)) {
      const labels = new Set([...opt.allSettings(game)].map((o) => opt.variantOf(game, o)));
      assert.ok(labels.size <= MAX_VARIANTS, `${id}/${game} has ${labels.size} combinations, the limit is ${MAX_VARIANTS}`);
    }
  }
  const { OPTIONS, opt } = await load('arcade');
  assert.equal(new Set([...opt.allSettings('snake')].map((o) => opt.variantOf('snake', o))).size, 54, 'snake: 3 sizes x 3 speeds x 2 walls x 3 rocks (the skin is cosmetic)');
});

test('cosmetic options never split the scores, and unknown saved values fall back to defaults', async () => {
  const { opt } = await load('arcade');
  const a = { size: '20', speed: 'normal', walls: 'solid', rocks: 'none', skin: 'sun' };
  assert.equal(opt.variantOf('snake', a), opt.variantOf('snake', { ...a, skin: 'ink' }), 'a skin is not a different game');
  assert.notEqual(opt.variantOf('snake', a), opt.variantOf('snake', { ...a, rocks: 'few' }));
  assert.equal(opt.describe('snake', { ...a, skin: 'ink' }), 'Medium · Normal · Solid · None');
  assert.deepEqual(opt.chosen('snake', { snake: { size: '99', speed: 'fast' } }), { size: '20', speed: 'fast', walls: 'solid', rocks: 'none', skin: 'sun' });
  assert.equal(opt.chosen('g2048', null).size, '4', 'nothing saved at all is fine');
});

test('the sound option on sequence memory is cosmetic, so it cannot split the scores', async () => {
  const { opt } = await load('memory');
  const s = { grid: '3', speed: 'normal', sound: 'off' };
  assert.equal(opt.variantOf('sequence', s), opt.variantOf('sequence', { ...s, sound: 'on' }));
});

test('every game feature is a Games division feature with a ui folder', () => {
  for (const id of FEATURES) {
    const manifest = JSON.parse(fs.readFileSync(new URL(`../${id}/feature.json`, import.meta.url), 'utf8'));
    assert.equal(manifest.id, id);
    assert.equal(manifest.division, 'games');
    assert.ok(fs.existsSync(new URL(`../${id}/ui/index.js`, import.meta.url)), `${id}/ui/index.js`);
  }
});

test('the game kit and every game feature keep their own styles scoped', () => {
  const kit = fs.readFileSync(new URL('../desktop/ui/gamekit.css', import.meta.url), 'utf8');
  const selectors = kit.split('\n').filter((l) => /^[.:@a-z#]/i.test(l) && l.includes('{')).map((l) => l.split('{')[0]);
  for (const s of selectors) {
    if (s.startsWith('@') || s.startsWith(':root')) continue;
    assert.ok(/(^|[\s,])\.gk-/.test(s), `a kit rule is not gk- prefixed: ${s}`);
  }
  for (const id of FEATURES) {
    const dir = new URL(`../${id}/ui/`, import.meta.url);
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.css'))) {
      const css = fs.readFileSync(new URL(f, dir), 'utf8');
      const rules = css.split('\n').filter((l) => l.includes('{') && !l.startsWith('/*') && !l.startsWith('@') && !l.startsWith(' '));
      for (const r of rules) {
        const sel = r.split('{')[0];
        for (const part of sel.split(',')) assert.ok(part.includes(`#view-${id}`), `${id}/${f}: unscoped selector: ${part.trim()}`);
      }
    }
  }
});
