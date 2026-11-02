// The reader handles touch and the mouse itself instead of the web view's text selection (docs/PLAN.md section 6):
//
//   touch   tap a word → word sheet; tap a verse number → verse sheet; press and hold → a selection with two handles
//           that snap to whole words, across verses; keep the finger down after the hold and drag to extend it
//   mouse   hover a word or verse number → hover card; click → the same sheet (a popover at wide sizes);
//           press and drag → a selection, then the color bar
//
// Scrolling is left to the web view (touch-action: pan-y) until a hold starts a selection; then touchmove is cancelled.
import type { Drawn } from './reader';

export type InputMode = 'auto' | 'touch' | 'pointer';

export interface Handlers {
  tapWord(k: number, el: HTMLElement, at: number): void;
  tapVerse(v: number, el: HTMLElement, at: number): void;
  hoverWord(k: number, el: HTMLElement): void;
  hoverVerse(v: number, el: HTMLElement): void;
  unhover(): void;
  selected(a: number, b: number, touch: boolean): void;   // a selection was made or changed (bar shows)
  cleared(): void;
}

const HOLD_MS = 450;
const SLOP = 10;   // px a finger may move before a press counts as a scroll

export class Selector {
  sel: { a: number; b: number } | null = null;
  mode: InputMode = 'auto';
  private d: Drawn | null = null;
  private press: { id: number; x: number; y: number; touch: boolean; k: number | null; v: number | null; timer: number; moved: boolean; held: boolean } | null = null;
  private drag: { id: number; end: 'a' | 'b' | 'free'; anchor: number; dx: number; dy: number } | null = null;
  private handles: HTMLElement[];
  private hoverTimer = 0;

  constructor(private root: HTMLElement, private scroller: HTMLElement, private h: Handlers) {
    this.handles = ['a', 'b'].map(end => {
      const e = document.createElement('div');
      e.className = `handle handle-${end}`;
      e.dataset.end = end;
      e.innerHTML = '<i></i>';
      e.hidden = true;
      root.append(e);
      return e;
    });
    root.addEventListener('pointerdown', e => this.down(e));
    root.addEventListener('pointermove', e => this.move(e));
    root.addEventListener('pointerup', e => this.up(e));
    root.addEventListener('pointercancel', () => this.cancel());
    root.addEventListener('contextmenu', e => e.preventDefault());           // a long press must not open the menu
    root.addEventListener('touchmove', e => { if (this.drag) e.preventDefault(); }, { passive: false });
    root.addEventListener('pointerover', e => this.over(e));
    root.addEventListener('pointerout', e => this.out(e));
    root.addEventListener('selectstart', e => e.preventDefault());
  }

  attach(d: Drawn) {
    this.d = d;
    this.sel = null;
    this.handles.forEach(h => { h.hidden = true; this.root.append(h); });
  }

  private isTouch(e: PointerEvent) {
    return this.mode === 'touch' || (this.mode === 'auto' && e.pointerType !== 'mouse');
  }

  // The word under a point, or the nearest word on that line.
  wordAt(x: number, y: number): number | null {
    const t = document.elementFromPoint(x, y) as HTMLElement | null;
    const w = t?.closest<HTMLElement>('.w, .g');
    if (w && this.root.contains(w)) return +w.dataset.k!;
    if (!this.d) return null;
    // On a plain space between words: the word before it.
    const node = caretNode(x, y);
    if (node && node.nodeType === Node.TEXT_NODE && this.root.contains(node)) {
      const before = node.previousSibling as HTMLElement | null;
      if (before?.classList?.contains('w')) return +before.dataset.k!;
    }
    let best: number | null = null, bestD = Infinity;
    // Between words or past a line's end: the closest word whose line box holds y.
    for (let k = 0; k < this.d.el.length; k++) {
      if (!this.d.el[k]) continue;   // not drawn yet
      for (const r of this.d.el[k].getClientRects()) {
        if (y < r.top - 6 || y > r.bottom + 6) continue;
        const dist = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
        if (dist < bestD) { bestD = dist; best = k; }
      }
    }
    return best;
  }

  private down(e: PointerEvent) {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    const handle = t.closest<HTMLElement>('.handle');
    if (handle && this.sel) {
      // Dragging a handle: keep the offset between the finger and the word edge it marks.
      e.preventDefault();
      capture(handle, e.pointerId);
      const end = handle.dataset.end as 'a' | 'b';
      const r = this.edgeRect(end);
      this.drag = { id: e.pointerId, end, anchor: end === 'a' ? this.sel.b : this.sel.a, dx: (end === 'a' ? r.left + 2 : r.right - 2) - e.clientX, dy: r.top + r.height / 2 - e.clientY };
      return;
    }
    this.h.unhover();
    const w = t.closest<HTMLElement>('.w, .g');
    const vn = t.closest<HTMLElement>('.vn');
    const touch = this.isTouch(e);
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, touch, k: w ? +w.dataset.k! : null, v: vn ? +vn.dataset.v! : null, timer: 0, moved: false, held: false };
    if (touch && this.press.k !== null) {
      this.press.timer = window.setTimeout(() => this.hold(), HOLD_MS);
    }
  }

  private hold() {
    const p = this.press;
    if (!p || p.moved || p.k === null) return;
    p.held = true;
    navigator.vibrate?.(8);                       // a light tick where the platform allows it
    this.set(p.k, p.k);
    this.drag = { id: p.id, end: 'free', anchor: p.k, dx: 0, dy: 0 };
    capture(this.root, p.id);
  }

  private move(e: PointerEvent) {
    if (this.drag && e.pointerId === this.drag.id) {
      e.preventDefault();
      const x = e.clientX + this.drag.dx, y = e.clientY + this.drag.dy;
      const k = this.wordAt(x, y);
      if (k !== null) {
        const a = Math.min(this.drag.anchor, k), b = Math.max(this.drag.anchor, k);
        if (!this.sel || a !== this.sel.a || b !== this.sel.b) this.set(a, b);
      }
      this.autoScroll(e.clientY);
      return;
    }
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > (p.touch ? SLOP : 4)) {
      p.moved = true;
      clearTimeout(p.timer);
      // A mouse press that moves starts a selection by dragging.
      if (!p.touch && p.k !== null && !this.drag) {
        capture(this.root, p.id);
        this.drag = { id: p.id, end: 'free', anchor: p.k, dx: 0, dy: 0 };
        this.set(p.k, p.k);
      }
    }
  }

  private up(e: PointerEvent) {
    if (this.drag && e.pointerId === this.drag.id) {
      this.drag = null;
      this.press = null;
      this.stopScroll();
      if (this.sel) this.h.selected(this.sel.a, this.sel.b, this.isTouch(e));
      return;
    }
    const p = this.press;
    this.press = null;
    if (!p || e.pointerId !== p.id) return;
    clearTimeout(p.timer);
    if (p.moved || p.held) return;
    const at = e.timeStamp;
    if (this.sel) { this.clear(); return; }      // a tap away from a selection only clears it
    if (p.v !== null) this.h.tapVerse(p.v, (e.target as HTMLElement).closest('.vn')!, at);
    else if (p.k !== null) this.h.tapWord(p.k, this.d!.el[p.k], at);
  }

  private cancel() {
    // The web view took the gesture (a scroll).
    if (this.press) clearTimeout(this.press.timer);
    this.press = null;
    if (this.drag) { this.drag = null; this.stopScroll(); if (this.sel) this.h.selected(this.sel.a, this.sel.b, true); }
  }

  private over(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || this.mode === 'touch' || this.drag || this.press) return;
    const t = e.target as HTMLElement;
    const w = t.closest<HTMLElement>('.w');
    const vn = t.closest<HTMLElement>('.vn');
    clearTimeout(this.hoverTimer);
    if (!w && !vn) return;
    this.hoverTimer = window.setTimeout(() => {
      if (w && this.d?.strong[+w.dataset.k!]) this.h.hoverWord(+w.dataset.k!, w);
      else if (vn) this.h.hoverVerse(+vn.dataset.v!, vn);
    }, 280);
  }

  private out(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(this.hoverTimer);
    const to = e.relatedTarget as HTMLElement | null;
    if (to?.closest?.('.hovercard')) return;
    if (to?.closest?.('.w, .vn') && to !== e.target) return;   // over() handles the next one
    this.hoverTimer = window.setTimeout(() => this.h.unhover(), 180);
  }

  set(a: number, b: number) {
    const d = this.d!;
    if (this.sel) for (let k = this.sel.a; k <= this.sel.b; k++) { d.el[k].classList.remove('sel', 'sj'); d.gap[k]?.classList.remove('sel'); }
    this.sel = { a, b };
    // 'sj' carries the selection color across a plain space to the next word.
    for (let k = a; k <= b; k++) { d.el[k].classList.add('sel'); if (k < b) { d.gap[k]?.classList.add('sel'); if (!d.gap[k]) d.el[k].classList.add('sj'); } }
    this.placeHandles();
  }

  clear() {
    const d = this.d;
    if (d && this.sel) for (let k = this.sel.a; k <= this.sel.b; k++) { d.el[k].classList.remove('sel', 'sj'); d.gap[k]?.classList.remove('sel'); }
    this.sel = null;
    this.handles.forEach(h => { h.hidden = true; });
    this.h.cleared();
  }

  private edgeRect(end: 'a' | 'b'): DOMRect {
    const d = this.d!, s = this.sel!;
    const rects = d.el[end === 'a' ? s.a : s.b].getClientRects();
    return end === 'a' ? rects[0] : rects[rects.length - 1];
  }

  placeHandles() {
    if (!this.sel) return;
    const base = this.root.getBoundingClientRect();
    (['a', 'b'] as const).forEach((end, n) => {
      const r = this.edgeRect(end), h = this.handles[n];
      h.hidden = false;
      h.style.left = `${(end === 'a' ? r.left : r.right) - base.left}px`;
      h.style.top = `${r.top - base.top}px`;
      h.style.height = `${r.height}px`;
    });
  }

  // While dragging near the top or bottom edge, scroll so the selection can grow past the screen.
  private scrollV = 0;
  private scrollRaf = 0;
  private autoScroll(y: number) {
    const r = this.scroller.getBoundingClientRect(), edge = 48;
    this.scrollV = y < r.top + edge ? -(r.top + edge - y) / 3 : y > r.bottom - edge ? (y - (r.bottom - edge)) / 3 : 0;
    if (this.scrollV && !this.scrollRaf) {
      const step = () => {
        if (!this.scrollV) { this.scrollRaf = 0; return; }
        this.scroller.scrollTop += this.scrollV;
        this.scrollRaf = requestAnimationFrame(step);
      };
      this.scrollRaf = requestAnimationFrame(step);
    }
  }

  private stopScroll() {
    this.scrollV = 0;
  }
}

// Keeps the pointer's moves coming to the reader while it drags. A pointer the browser no longer knows (or a synthetic
// one in tests) cannot be captured; the drag still works from the events that arrive.
function capture(el: Element, id: number) {
  try { el.setPointerCapture(id); } catch { /* not an active pointer */ }
}

function caretNode(x: number, y: number): Node | null {
  const doc = document as any;
  if (doc.caretPositionFromPoint) return doc.caretPositionFromPoint(x, y)?.offsetNode ?? null;
  return doc.caretRangeFromPoint?.(x, y)?.startContainer ?? null;
}
