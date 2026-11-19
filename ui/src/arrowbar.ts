// The arrow's own small bar (design/features/marks T9, MK7-25; rows 13 to 16). After Arrow the mark bar shrinks to a prompt,
// "Select where it points", with Back (a misclick: the start selection and its bar come back) and Cancel (nothing is made).
// Trying to leave the chapter while choosing changes the prompt to the reason, with Cancel. The start words stay outlined
// (main.ts puts the `arrow-from` class on them). The arrow's color is chosen here: the last arrow style used, else the
// first arrow entry of the legend, else a default ink.
import { wb } from './api';
import { h } from './ui';

const KEY = 'wb.arrowStyle';
const DEFAULT_INK = 'blue';
export const STAY = 'An arrow stays in this chapter. Links across chapters come with cross-references, later.';

export interface ArrowBar {
  el: HTMLElement;
  prompt(): void;
  /** The reason the reader did not move (or a target was refused); Back goes away, Cancel stays. */
  say(text: string): void;
}

const ICON = 'M3 13L13 3M6 3h7v7';
const BACK = 'M10 3.5L5.5 8l4.5 4.5';

function svg(path: string, size: number): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('width', String(size)); s.setAttribute('height', String(size)); s.setAttribute('aria-hidden', 'true');
  s.classList.add('ico');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  s.append(p);
  return s;
}

export function createArrowBar(on: { back(): void; cancel(): void }): ArrowBar {
  const el = h('div', 'markbar arrow-bar');
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Choose where the arrow points');
  const text = h('span', 'ab-text', 'Select where it points');
  text.setAttribute('role', 'status');
  const back = h('button', 'ab-back');
  back.type = 'button';
  back.append(svg(BACK, 14), document.createTextNode('Back'));
  back.onclick = on.back;
  const cancel = h('button', 'ab-cancel', 'Cancel');
  cancel.type = 'button';
  cancel.onclick = on.cancel;
  el.append(svg(ICON, 16), text, back, cancel);
  el.addEventListener('pointerdown', e => e.stopPropagation());
  return {
    el,
    prompt() { text.textContent = 'Select where it points'; back.hidden = false; el.classList.remove('ab-said'); },
    say(t) { text.textContent = t; back.hidden = true; el.classList.add('ab-said'); },
  };
}

/** Which color a new arrow takes, and why (the bar says what it chose). */
export async function arrowColor(): Promise<{ color: string; why: string; name?: string }> {
  try {
    const last = localStorage.getItem(KEY);
    if (last) return { color: last, why: 'the last arrow style used' };
  } catch { /* storage off */ }
  try {
    const l = await wb(['legend']);
    const e = (l?.entries || []).find((x: any) => x.kind === 'arrow');
    if (e) return { color: e.color, why: 'the first arrow style in the legend', name: e.label || e.name };
  } catch { /* the default stands */ }
  return { color: DEFAULT_INK, why: 'the default ink' };
}

export function rememberArrowColor(color: string) {
  try { localStorage.setItem(KEY, color); } catch { /* storage off */ }
}
