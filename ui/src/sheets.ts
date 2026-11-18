// Sheets (touch, compact width): over the reader, two heights, close by dragging down or tapping above. At wider widths
// the same content is a popover beside what was tapped. Hover cards are for a mouse only. None of them moves the reader.

const overlay = () => document.getElementById('overlay')!;
export const compact = () => window.innerWidth < 600;

let current: { close: () => void } | null = null;
let onClose: (() => void) | null = null;

export function closeSheet() {
  current?.close();
}

export function sheetOpen() {
  return current !== null;
}

// Opens `body` as a sheet (compact) or a popover near `from` (wider). Returns the panel.
export function openSheet(body: HTMLElement, from: Element | null, opts: { closed?: () => void; stays?: boolean } = {}): HTMLElement {
  closeSheet();
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const panel = document.createElement('section');
  panel.setAttribute('role', 'dialog');
  const asSheet = compact();
  panel.className = asSheet ? 'sheet half' : 'popover';
  if (asSheet) {
    const grab = document.createElement('div');
    grab.className = 'grab';
    grab.innerHTML = '<span></span>';
    panel.append(grab);
    dragToResize(panel, grab);
  }
  const x = document.createElement('button');
  x.className = 'close';
  x.setAttribute('aria-label', 'Close');
  x.textContent = '✕';
  x.onclick = () => closeSheet();
  panel.append(x, body);
  // a card that stays (it is moved and sized, the reader behind it still read) has no scrim over the reader; at phone width it is a sheet and keeps one
  overlay().append(...(opts.stays && !asSheet ? [panel] : [scrim, panel]));
  if (!asSheet && from) placeBeside(panel, from.getBoundingClientRect());
  scrim.addEventListener('pointerdown', e => { e.preventDefault(); closeSheet(); });
  const prevFocus = document.activeElement as HTMLElement | null;
  onClose = opts.closed ?? null;
  current = {
    close: () => {
      scrim.remove(); panel.remove(); current = null;
      prevFocus?.focus?.({ preventScroll: true });   // back where the person was; the reader never scrolled
      const f = onClose; onClose = null; f?.();
    },
  };
  return panel;
}

function placeBeside(panel: HTMLElement, r: DOMRect) {
  const w = Math.min(400, window.innerWidth - 32);
  panel.style.width = `${w}px`;
  const left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 16));
  panel.style.left = `${left}px`;
  const h = panel.offsetHeight;
  const below = r.bottom + 10, above = r.top - 10 - h;
  panel.style.top = `${below + h < window.innerHeight - 16 || above < 16 ? Math.min(below, window.innerHeight - h - 16) : above}px`;
}

// Drag the grab bar: up to full height, down to half, further down to close.
function dragToResize(panel: HTMLElement, grab: HTMLElement) {
  let y0 = 0, h0 = 0, dragging = false;
  grab.addEventListener('pointerdown', e => {
    dragging = true; y0 = e.clientY; h0 = panel.getBoundingClientRect().height;
    grab.setPointerCapture(e.pointerId);
    panel.style.transition = 'none';
  });
  grab.addEventListener('pointermove', e => {
    if (!dragging) return;
    const h = Math.max(80, Math.min(window.innerHeight - 24, h0 - (e.clientY - y0)));
    panel.style.height = `${h}px`;
  });
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    panel.style.transition = '';
    const h = panel.getBoundingClientRect().height, vh = window.innerHeight;
    panel.style.height = '';
    if (e.clientY - y0 > 0 && h < vh * 0.35) return closeSheet();
    panel.classList.toggle('full', h > vh * 0.72);
    panel.classList.toggle('half', h <= vh * 0.72);
  };
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);
}

// ---- hover cards (mouse) ------------------------------------------------------------------------------------------
let card: HTMLElement | null = null;

export function showCard(body: HTMLElement, r: DOMRect) {
  hideCard();
  card = document.createElement('div');
  card.className = 'hovercard';
  card.append(body);
  overlay().append(card);
  const w = Math.min(420, window.innerWidth - 32);
  card.style.width = `${w}px`;
  card.style.left = `${Math.max(16, Math.min(r.left, window.innerWidth - w - 16))}px`;
  const h = card.offsetHeight;
  card.style.top = `${r.bottom + 8 + h < window.innerHeight ? r.bottom + 8 : Math.max(8, r.top - 8 - h)}px`;
}

export function hideCard() {
  card?.remove();
  card = null;
}

export function cardShown() {
  return card !== null;
}

// ---- toast ----------------------------------------------------------------------------------------------------------
export function toast(text: string) {
  // a new one replaces the one showing, so two never sit on top of each other
  overlay().querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  overlay().append(t);
  setTimeout(() => t.remove(), 2200);
}

/** A toast with one Undo (Hide all of the eyes, TH-5); it stays 10 seconds. */
export function toastUndo(text: string, undo: () => Promise<void>) {
  overlay().querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div');
  t.className = 'toast toast-undo';
  t.append(document.createTextNode(`${text} `));
  const b = document.createElement('button');
  b.className = 'btn small';
  b.textContent = 'Undo';
  b.onclick = () => { t.remove(); void undo(); };
  t.append(b);
  overlay().append(t);
  setTimeout(() => t.remove(), 10000);
}
