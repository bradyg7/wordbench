// Small DOM helpers shared by the shell, the panes and the Notebook.
import { app, goTo } from './app';

export const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Line icons, 16px, drawn with currentColor (the toolbar and pane chrome of the design sheets).
const PATHS: Record<string, string> = {
  book: 'M2 3h5a2 2 0 0 1 2 2v9a1.5 1.5 0 0 0-1.5-1.5H2zM14 3H9a2 2 0 0 0-2 2v9a1.5 1.5 0 0 1 1.5-1.5H14z',
  search: 'M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM14 14l-3.5-3.5',
  notebook: 'M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4zM4 2v12M2 5h2M2 8h2M2 11h2M7 5h4',
  threads: 'M4 2v4a3 3 0 0 0 3 3h2a3 3 0 0 1 3 3v2M12 2v4M4 9v5M4 2a1 1 0 1 0 0 .01M12 2a1 1 0 1 0 0 .01',
  shelf: 'M2 4h12M2 8h12M2 12h8',
  pen: 'M10.5 2.5l3 3L6 13H3v-3zM9 4l3 3M2 15h12',
  more: 'M3 8h.01M8 8h.01M13 8h.01',
  down: 'M4 6l4 4 4-4',
  left: 'M10 3L5 8l5 5',
  right: 'M6 3l5 5-5 5',
  x: 'M4 4l8 8M12 4l-8 8',
  minus: 'M3 8h10',
  plus: 'M8 3v10M3 8h10',
  float: 'M5 5V2.5h8.5V11H11M2.5 5H11v8.5H2.5z',
  pin: 'M8 14s4.5-4 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 10 8 14 8 14zM8 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  eye: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  eyeoff: 'M2 2l12 12M6.5 6.6A2 2 0 0 0 9.4 9.5M4 4.6C2.4 5.8 1.5 8 1.5 8S4 12.5 8 12.5c1.3 0 2.4-.4 3.3-1M7 3.6c.3 0 .7-.1 1-.1 4 0 6.5 4.5 6.5 4.5s-.5.9-1.4 1.9',
  grip: 'M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01',
  prompt: 'M3 5l3 3-3 3M8 11h5',
  filter: 'M2 3h12M4 8h8M6 13h4',
  expand: 'M10 2h4v4M14 2L9 7M6 14H2v-4M2 14l5-5',
  collapse: 'M13 3L9 7M9 3v4h4M3 13l4-4M7 13V9H3',
  copy: 'M5.5 5.5h8v8h-8zM3 10.5V3h7.5',
  check: 'M3 8.5l3.5 3.5L13 4.5',
  trash: 'M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.5 6.5v4.5M9.5 6.5v4.5',
};

export function icon(name: string, size = 16): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('width', String(size));
  s.setAttribute('height', String(size));
  s.setAttribute('aria-hidden', 'true');
  s.classList.add('ico');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', PATHS[name] || '');
  s.append(p);
  return s;
}

export function button(cls: string, label: string, onclick: (e: MouseEvent) => void, ico?: string): HTMLButtonElement {
  const b = h('button', cls);
  if (ico) b.append(icon(ico));
  if (label) b.append(document.createTextNode(label));
  b.onclick = onclick;
  return b;
}

// A place pill: the pin and a label; click goes there.
export function placePill(label: string, go?: (e: MouseEvent) => void): HTMLElement {
  const p = h(go ? 'button' : 'span', 'pill place-pill');
  p.append(icon('pin', 13), document.createTextNode(label));
  if (go) (p as HTMLButtonElement).onclick = go;
  return p;
}

/** A verse clicked outside the reader (note 21bd): a small menu, Go to in the reader or Open in a tab (a second reader,
 * which never moves the reader). Ctrl+click goes straight to the reader; on a phone it goes there as before. */
export function refChoice(from: HTMLElement, ref: string, e?: MouseEvent) {
  if (e?.ctrlKey || e?.metaKey || sizeClass() === 'compact') return void goTo(ref);
  const box = h('div', 'menu-list ref-choice');
  const item = (label: string, ico: string, fn: () => void) => {
    const b = h('button', 'menu-item');
    b.append(icon(ico, 14), document.createTextNode(` ${label}`));
    b.onclick = () => { close(); fn(); };
    box.append(b);
  };
  item('Go to in the reader', 'book', () => void goTo(ref));
  item('Open in a tab', 'float', () => app.secondReader(ref));
  box.append(h('div', 'muted small ref-choice-hint', 'Ctrl+click: straight to the reader'));
  const close = popMenu(from, box, { width: 230 });
}

/** A place pill whose click asks: the reader, or a tab. */
export function placeGo(label: string, ref: string): HTMLElement {
  return placePill(label, e => refChoice(e.currentTarget as HTMLElement, ref, e));
}

// Text with verse references made into links (positions from wb-core's find_refs, counted in characters).
export interface Found { start: number; end: number; ref: string; hash: string }
export function linkedText(text: string, refs: Found[] | undefined, go: (ref: string, a: HTMLElement, e: MouseEvent) => void, hover?: (a: HTMLElement, ref: string) => void): DocumentFragment {
  const f = document.createDocumentFragment();
  const chars = [...text];
  let at = 0;
  for (const r of refs || []) {
    if (r.start < at) continue;
    f.append(chars.slice(at, r.start).join(''));
    const a = h('a', 'ref', chars.slice(r.start, r.end).join(''));
    a.href = r.hash;
    a.onclick = e => { e.preventDefault(); go(r.ref, a, e); };
    if (hover) hover(a, r.ref);
    f.append(a);
    at = r.end;
  }
  f.append(chars.slice(at).join(''));
  return f;
}

// Hover cards: 'off' (the default; a click opens a card, as a tap does on a phone), 'refs' (only references in notes)
// or 'on'. Kept between runs.
export const hoverMode = () => document.documentElement.dataset.hover || 'off';
export function setHover(mode: string) {
  document.documentElement.dataset.hover = mode;
  try { localStorage.setItem('wb.hover', mode); } catch { /* this run only */ }
}

export const sizeClass = () => {
  const w = window.innerWidth;
  return w < 600 ? 'compact' : w < 1024 ? 'medium' : w < 1440 ? 'expanded' : 'large';
};

// A small menu or form beside an element; closes on Escape or a click outside. Returns a close function.
let menuOpen: (() => void) | null = null;
export function popMenu(from: Element, body: HTMLElement, opts: { align?: 'left' | 'right'; width?: number } = {}): () => void {
  menuOpen?.();
  const m = h('div', 'menu');
  if (opts.width) m.style.width = `${opts.width}px`;
  m.append(body);
  document.getElementById('overlay')!.append(m);
  const r = from.getBoundingClientRect();
  const w = m.offsetWidth;
  const left = opts.align === 'right' ? r.right - w : r.left;
  m.style.left = `${Math.max(8, Math.min(left, window.innerWidth - w - 8))}px`;
  const top = r.bottom + 6;
  m.style.top = `${top + m.offsetHeight > window.innerHeight - 8 ? Math.max(8, r.top - 6 - m.offsetHeight) : top}px`;
  const outside = (e: PointerEvent) => { if (!m.contains(e.target as Node) && !from.contains(e.target as Node)) close(); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const close = () => {
    m.remove();
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', key, true);
    if (menuOpen === close) menuOpen = null;
  };
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
  document.addEventListener('keydown', key, true);
  menuOpen = close;
  return close;
}
export const closeMenu = () => menuOpen?.();

/** A floating box moved by dragging its head (finding 707d: the findings box hid what the finding was about). Where it
 *  was left is kept in the window's storage under `key`, kept inside the window, and used the next time it opens. */
export function movable(box: HTMLElement, handle: HTMLElement, key: string) {
  const fit = (x: number, y: number) => ({
    x: Math.max(8, Math.min(x, innerWidth - box.offsetWidth - 8)),
    y: Math.max(8, Math.min(y, innerHeight - box.offsetHeight - 8)),
  });
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null') as { x: number; y: number } | null;
    if (saved) { const p = fit(saved.x, saved.y); box.style.left = `${p.x}px`; box.style.top = `${p.y}px`; }
  } catch { /* where it opens by default */ }
  handle.classList.add('movable-handle');
  handle.title = 'Drag to move';
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, textarea')) return;
    e.preventDefault();
    const r = box.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    handle.setPointerCapture(e.pointerId);
    box.classList.add('moving');
    const move = (m: PointerEvent) => { const p = fit(m.clientX - dx, m.clientY - dy); box.style.left = `${p.x}px`; box.style.top = `${p.y}px`; };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      box.classList.remove('moving');
      try { localStorage.setItem(key, JSON.stringify({ x: parseFloat(box.style.left), y: parseFloat(box.style.top) })); } catch { /* not kept */ }
      box.querySelector<HTMLElement>('textarea, input')?.focus();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up, { once: true });
    handle.addEventListener('pointercancel', up, { once: true });
  });
}
