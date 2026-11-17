// The cards' frame (design/features/words, W4 and W6): a handle to drag the card by, a corner to size it from, and a card
// that stays where it was put until it is closed (findings dfce, 149b). Shared by the verse card and the word card.
// At phone width a card is a sheet over the bottom, and has neither (the sheet's own grab bar sizes it).
import { icon } from './ui';

const MIN_W = 280, MIN_H = 160;

/** Drag `handle` to move `panel`; once moved, `panel.dataset.moved` is set so nothing puts the card back beside its source. */
export function dragBy(panel: HTMLElement, handle: HTMLElement) {
  handle.classList.add('card-handle');
  handle.addEventListener('pointerdown', e => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    const r = panel.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
    const move = (m: PointerEvent) => {
      const w = panel.offsetWidth, hgt = panel.offsetHeight;
      panel.style.left = `${Math.max(0, Math.min(m.clientX - dx, window.innerWidth - Math.min(w, 120)))}px`;
      panel.style.top = `${Math.max(0, Math.min(m.clientY - dy, window.innerHeight - Math.min(hgt, 48)))}px`;
      panel.dataset.moved = '1';
    };
    const end = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
}

/** A corner to size `panel` from. */
export function sizeFrom(panel: HTMLElement) {
  const c = document.createElement('div');
  c.className = 'card-size';
  c.setAttribute('aria-label', 'Size the card');
  c.title = 'Drag to size the card';
  c.addEventListener('pointerdown', e => {
    const r = panel.getBoundingClientRect();
    const x0 = e.clientX, y0 = e.clientY;
    c.setPointerCapture(e.pointerId);
    e.preventDefault();
    const move = (m: PointerEvent) => {
      panel.style.width = `${Math.max(MIN_W, Math.min(r.width + m.clientX - x0, window.innerWidth - r.left))}px`;
      panel.style.height = `${Math.max(MIN_H, Math.min(r.height + m.clientY - y0, window.innerHeight - r.top))}px`;
      panel.style.maxHeight = 'none';
      panel.dataset.moved = '1';
    };
    const end = () => { c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', end); c.removeEventListener('pointercancel', end); };
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  });
  panel.append(c);
  return c;
}

/** The handle's grip icon (drawn only where the card can be dragged). */
export function grip(): SVGSVGElement {
  const g = icon('grip', 16);
  g.classList.add('card-grip');
  return g;
}

/** Makes a card opened by `openSheet` movable and sizable (not at phone width). Returns whether it did. */
export function frameCard(panel: HTMLElement, handle: HTMLElement, wide: boolean): boolean {
  if (!wide) return false;
  panel.classList.add('card-frame');
  dragBy(panel, handle);
  sizeFrom(panel);
  return true;
}
