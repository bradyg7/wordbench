// Contrast ink for highlights: any color, either theme (design/features/highlights, 2026-11-16).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contrast, inkFor, rgbOf, hlStyle, DARK_INK, LIGHT_INK } from '../src/hlink.ts';

test('light colors get dark ink, dark colors get light ink', () => {
  for (const c of ['#ffff00', '#fff3a0', '#a7f3d0', '#ffffff', '#ffb3c6']) assert.equal(inkFor(c), DARK_INK, c);
  for (const c of ['#000000', '#1e3a8a', '#7a1f1f', '#3b2f00', '#4b0082']) assert.equal(inkFor(c), LIGHT_INK, c);
});

test('the chosen ink always has the higher contrast, and at least 4.5:1 on any gray (AA for every color)', () => {
  for (let v = 0; v <= 255; v += 5) {
    const rgb: [number, number, number] = [v, v, v];
    const ink = rgbOf(inkFor(`rgb(${v}, ${v}, ${v})`)!)!;
    const other = rgbOf(ink[0] > 128 ? DARK_INK : LIGHT_INK)!;
    assert.ok(contrast(rgb, ink) >= contrast(rgb, other));
    assert.ok(contrast(rgb, ink) >= 4.5, `gray ${v}`);
  }
});

test('WCAG ratio of black on white is 21', () => {
  assert.equal(Math.round(contrast([0, 0, 0], [255, 255, 255])), 21);
});

test('named colors follow the theme through variables; unknown colors keep the page ink', () => {
  assert.equal(hlStyle('yellow'), 'background-color:var(--hl-yellow);color:var(--hl-yellow-ink);');
  assert.equal(hlStyle('#000'), `background-color:#000;color:${LIGHT_INK};`);
  assert.equal(hlStyle('salmon'), 'background-color:salmon;');
});
