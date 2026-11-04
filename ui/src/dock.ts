// The dock: panes in tabbed columns beside the reader (docs/PLAN.md section 3, the desktop sheets).
//
//   Large (≥ 1440)        a column on each side: study panes (word study, interlinear, uses) on the left, the
//                         Notebook and threads on the right; any pane can float.
//   Expanded, Medium      one column on the right, holding every pane as a tab.
//   Compact (< 600)       no columns: the pane in front is a full screen over the reader, with "Back to …".
//
// A pane keeps its element (and so its scroll and state) while it is open; switching tabs only hides it. Nothing here
// moves the reader: opening, closing or switching panes never loses the place.
import { h, icon, popMenu, sizeClass } from './ui';

export type Side = 'left' | 'right' | 'float';

export interface Pane {
  id: string;
  key: string;
  kind: string;
  title: string;
  side: Side;
  el: HTMLElement;
  /** Draw again from the study folder (after a change). */
  refresh?: () => void | Promise<void>;
  onClose?: () => void;
}

const WIDTH: Record<string, [number, number]> = { large: [440, 420], expanded: [0, 380], medium: [0, 320], compact: [0, 0] };
const STORE = 'wb.dock.v1';
/** A column is never narrower than this, and the reader keeps at least READER_MIN beside the columns. */
const COL_MIN = 280, READER_MIN = 460;
let seq = 0;

export class Dock {
  panes: Pane[] = [];
  front: Partial<Record<Side, string>> = {};
  hidden: Partial<Record<Side, boolean>> = {};
  /** Where the floating column sits. */
  floatAt = { x: 0, y: 0, w: 420, h: 520 };
  /** Widths the person set by dragging a column's edge (per side), and columns expanded to half the window. */
  widths: Partial<Record<'left' | 'right', number>> = {};
  wide: Partial<Record<'left' | 'right', boolean>> = {};
  /** Where each tab strip was scrolled, kept while the strips are drawn again. */
  private stripScroll: Partial<Record<Side, number>> = {};
  private cols: Record<Side, HTMLElement>;
  private sheet: HTMLElement;
  backLabel = () => '';
  /** Called before the reader's width changes; the function it returns puts the reader back at the same verse. */
  keepPlace: () => () => void = () => () => {};

  constructor(private host: HTMLElement) {
    this.cols = { left: this.column('left'), right: this.column('right'), float: this.column('float') };
    this.sheet = h('section', 'pane-sheet');
    host.append(this.cols.left, this.cols.right, this.cols.float, this.sheet);
    try {
      const kept = JSON.parse(localStorage.getItem(STORE) || '{}');
      Object.assign(this.floatAt, kept.floatAt || {});
      Object.assign(this.widths, kept.widths || {});
      Object.assign(this.wide, kept.wide || {});
    } catch { /* defaults */ }
    window.addEventListener('resize', () => this.layout());
    // the floating column is resized from its corner; its size is kept
    new ResizeObserver(() => {
      const f = this.cols.float;
      if (!f.classList.contains('open') || !f.offsetWidth) return;
      this.floatAt.w = f.offsetWidth;
      this.floatAt.h = f.offsetHeight;
      this.save();
    }).observe(this.cols.float);
  }

  private column(side: Side) {
    const c = h('aside', `dock-col dock-${side}`);
    c.dataset.side = side;
    return c;
  }

  /** The side a pane is drawn on at this window size. */
  where(p: Pane): Side | 'sheet' {
    const size = sizeClass();
    if (size === 'compact') return 'sheet';
    if (p.side === 'float') return 'float';
    if (size !== 'large') return 'right';
    return p.side;
  }

  find(key: string) {
    return this.panes.find(p => p.key === key);
  }

  /**
   * Opens a pane, or brings forward the one already open with the same key. `fill` draws into the pane's element (it may
   * be called again by refresh).
   */
  open(kind: string, title: string, key: string, side: Side, fill: (el: HTMLElement, p: Pane) => void | Promise<void>): Pane {
    const have = this.find(key);
    if (have) {
      this.show(have);
      return have;
    }
    const el = h('div', `pane pane-${kind}`);
    const p: Pane = { id: `p${++seq}`, key, kind, title, side, el };
    p.refresh = () => fill(el, p);
    this.panes.push(p);
    this.show(p);
    Promise.resolve(fill(el, p)).catch(e => { el.replaceChildren(h('p', 'error', String(e))); });
    return p;
  }

  show(p: Pane) {
    const w = this.where(p);
    this.front[w === 'sheet' ? p.side : w] = p.id;
    this.hidden[w === 'sheet' ? p.side : w] = false;
    if (w === 'sheet') this.sheetFor = p.id;
    this.layout();
  }

  private sheetFor: string | null = null;

  rename(p: Pane, title: string) {
    p.title = title;
    this.layout();
  }

  close(p: Pane) {
    this.panes = this.panes.filter(x => x !== p);
    p.el.remove();
    p.onClose?.();
    if (this.sheetFor === p.id) this.sheetFor = null;
    this.layout();
  }

  move(p: Pane, side: Side) {
    p.side = side;
    this.show(p);
  }

  /** Every open pane whose title or kind starts with or holds `name` (for `close threads`, `float occurrences`). */
  named(name: string): Pane[] {
    const n = name.trim().toLowerCase();
    if (n === 'all') return [...this.panes];
    for (const fits of [(t: string) => t === n, (t: string) => t.startsWith(n), (t: string) => t.includes(n)]) {
      const hit = this.panes.filter(p => fits(p.title.toLowerCase()) || fits(p.kind));
      if (hit.length) return hit;
    }
    return [];
  }

  refreshAll() {
    for (const p of this.panes) Promise.resolve(p.refresh?.()).catch(() => {});
  }

  private save() {
    try { localStorage.setItem(STORE, JSON.stringify({ floatAt: this.floatAt, widths: this.widths, wide: this.wide })); } catch { /* this run only */ }
  }

  /** The column last widened or narrowed by the person keeps its width; the other one gives way first. */
  private lastSized: 'left' | 'right' = 'right';

  /**
   * The columns' widths now: each expanded (half the window), as dragged, or the size class's own. The reader keeps at
   * least READER_MIN; when both columns want more than that leaves, the one not touched last narrows (to COL_MIN), then
   * the other.
   */
  private widthsNow(leftOpen: boolean, rightOpen: boolean): [number, number] {
    const size = sizeClass(), W = window.innerWidth;
    const want = (side: 'left' | 'right') => {
      const base = WIDTH[size][side === 'left' ? 0 : 1];
      if (!base) return 0;
      return this.wide[side] ? Math.round(W * 0.5) : this.widths[side] ?? base;
    };
    let l = leftOpen ? want('left') : 0, r = rightOpen ? want('right') : 0;
    const room = Math.max(0, W - READER_MIN);
    const min = (x: number) => (x ? Math.min(COL_MIN, x) : 0);
    if (l + r > room) {
      if (this.lastSized === 'right') { l = Math.max(min(l), room - r); r = Math.max(min(r), room - l); }
      else { r = Math.max(min(r), room - l); l = Math.max(min(l), room - r); }
    }
    return [l, r];
  }

  /** Puts every pane in its column, draws the tab strips, and moves the reader over to make room. */
  layout() {
    const size = sizeClass();
    const root = document.documentElement;
    const by: Record<string, Pane[]> = { left: [], right: [], float: [], sheet: [] };
    for (const p of this.panes) by[this.where(p)].push(p);
    for (const side of ['left', 'right', 'float'] as Side[]) {
      const col = this.cols[side], list = by[side];
      const open = list.length > 0 && !this.hidden[side];
      col.classList.toggle('open', open);
      col.classList.toggle('minimized', list.length > 0 && !!this.hidden[side]);
      if (!list.length) { col.replaceChildren(); continue; }
      if (!list.some(p => p.id === this.front[side])) this.front[side] = list[list.length - 1].id;
      col.replaceChildren(this.strip(side, list), ...list.map(p => p.el));
      col.append(side === 'float' ? this.corner() : this.grip(side));
      for (const p of list) p.el.hidden = p.id !== this.front[side];
      if (this.hidden[side]) {
        const back = h('button', 'dock-restore', list.map(p => p.title).join(' · '));
        back.title = 'Show the panes again';
        back.onclick = () => { this.hidden[side] = false; this.layout(); };
        col.replaceChildren(back);
      }
    }
    const restore = this.keepPlace();
    const leftOpen = by.left.length > 0 && !this.hidden.left, rightOpen = by.right.length > 0 && !this.hidden.right;
    const [lw, rw] = this.widthsNow(leftOpen, rightOpen);
    void size;
    root.style.setProperty('--dock-l', `${leftOpen ? lw : 0}px`);
    root.style.setProperty('--dock-r', `${rightOpen ? rw : 0}px`);
    root.style.setProperty('--dock-lw', `${lw}px`);
    root.style.setProperty('--dock-rw', `${rw}px`);
    restore();
    const f = this.cols.float;
    Object.assign(f.style, { left: `${this.floatAt.x || window.innerWidth - this.floatAt.w - 40}px`, top: `${this.floatAt.y || 90}px`, width: `${this.floatAt.w}px`, height: `${this.floatAt.h}px` });
    this.drawSheet(by.sheet);
    requestAnimationFrame(() => this.fitStrips());
  }

  // ---- the floating column's size: its own corner, drawn over the pane (the browser's resize corner sat on the pane's
  // scrollbar, so a drag there moved both) ------------------------------------------------------------------------------
  private corner(): HTMLElement {
    const g = h('div', 'float-corner');
    g.title = 'Drag to resize';
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      g.setPointerCapture(e.pointerId);
      const f = this.cols.float, r = f.getBoundingClientRect();
      const dx = r.right - e.clientX, dy = r.bottom - e.clientY;
      const move = (m: PointerEvent) => {
        f.style.width = `${Math.max(280, Math.min(window.innerWidth - r.left - 8, m.clientX + dx - r.left))}px`;
        f.style.height = `${Math.max(200, Math.min(window.innerHeight - r.top - 8, m.clientY + dy - r.top))}px`;
      };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        this.fitStrips();
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
    });
    return g;
  }

  // ---- a column's width: drag its inner edge (double-click puts it back) ----------------------------------------------
  private grip(side: 'left' | 'right'): HTMLElement {
    const g = h('div', `dock-grip grip-${side}`);
    g.title = 'Drag to make the column wider or narrower (double-click: its usual width)';
    g.setAttribute('role', 'separator');
    g.setAttribute('aria-orientation', 'vertical');
    g.addEventListener('dblclick', () => { delete this.widths[side]; this.wide[side] = false; this.lastSized = side; this.save(); this.layout(); });
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      g.classList.add('dragging');
      const restore = this.keepPlace();
      this.lastSized = side;
      const move = (m: PointerEvent) => {
        this.wide[side] = false;
        this.widths[side] = side === 'left' ? m.clientX : window.innerWidth - m.clientX;
        const [lw, rw] = this.widthsNow(this.cols.left.classList.contains('open'), this.cols.right.classList.contains('open'));
        const root = document.documentElement;
        root.style.setProperty('--dock-l', `${this.cols.left.classList.contains('open') ? lw : 0}px`);
        root.style.setProperty('--dock-r', `${this.cols.right.classList.contains('open') ? rw : 0}px`);
        if (lw) root.style.setProperty('--dock-lw', `${lw}px`);
        if (rw) root.style.setProperty('--dock-rw', `${rw}px`);
      };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        g.classList.remove('dragging');
        this.save();
        restore();
        this.fitStrips();
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
    });
    return g;
  }

  // ---- tab strips: tabs keep their size and scroll; ‹ › show when there is more; the front tab stays in view ----------
  private fitStrips() {
    for (const side of ['left', 'right', 'float'] as Side[]) {
      const strip = this.cols[side].querySelector<HTMLElement>('.tabstrip');
      const tabs = strip?.querySelector<HTMLElement>('.tab-row');
      if (!strip || !tabs) continue;
      // the arrows first: when they appear the tabs get narrower, and the front tab must fit what is left
      this.arrows(strip, tabs);
      const on = tabs.querySelector<HTMLElement>('.tab.on');
      if (on) {
        const l = on.offsetLeft, r = l + on.offsetWidth;
        if (l < tabs.scrollLeft) tabs.scrollLeft = l - 24;
        else if (r > tabs.scrollLeft + tabs.clientWidth) tabs.scrollLeft = r - tabs.clientWidth + 24;
      }
      this.arrows(strip, tabs);
    }
  }

  private arrows(strip: HTMLElement, tabs: HTMLElement) {
    const more = tabs.scrollWidth > tabs.clientWidth + 1;
    strip.classList.toggle('overflowing', more);
    strip.querySelector<HTMLButtonElement>('.tab-scroll.back')!.disabled = tabs.scrollLeft <= 0;
    strip.querySelector<HTMLButtonElement>('.tab-scroll.fwd')!.disabled = tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 1;
  }

  private drawSheet(list: Pane[]) {
    const p = list.find(x => x.id === this.sheetFor);
    this.sheet.classList.toggle('open', !!p);
    if (!p) { this.sheet.replaceChildren(); return; }
    const head = h('div', 'sheet-head');
    const back = h('button', 'back-pill');
    back.append(icon('left', 14), document.createTextNode(` Back to ${this.backLabel()}`));
    back.onclick = () => { this.sheetFor = null; this.layout(); };
    const x = h('button', 'icon-btn');
    x.append(icon('x'));
    x.setAttribute('aria-label', `Close ${p.title}`);
    x.onclick = () => this.close(p);
    head.append(back, h('span', 'sheet-head-title', p.title), x);
    p.el.hidden = false;
    this.sheet.replaceChildren(head, p.el);
  }

  private strip(side: Side, list: Pane[]) {
    const s = h('div', 'tabstrip');
    const tabs = h('div', 'tab-row');
    tabs.setAttribute('role', 'tablist');
    const scrollBy = (dx: number) => tabs.scrollBy({ left: dx, behavior: 'smooth' });
    const back = h('button', 'tab-scroll back');
    back.append(icon('left', 14));
    back.setAttribute('aria-label', 'Earlier tabs');
    back.onclick = () => scrollBy(-tabs.clientWidth * 0.7);
    const fwd = h('button', 'tab-scroll fwd');
    fwd.append(icon('right', 14));
    fwd.setAttribute('aria-label', 'Later tabs');
    fwd.onclick = () => scrollBy(tabs.clientWidth * 0.7);
    // a mouse wheel over the tabs scrolls them sideways
    tabs.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { tabs.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });
    tabs.addEventListener('scroll', () => { this.stripScroll[side] = tabs.scrollLeft; this.arrows(s, tabs); }, { passive: true });
    s.append(back, tabs, fwd);
    for (const p of list) {
      const t = h('div', `tab${p.id === this.front[side] ? ' on' : ''}`);
      t.setAttribute('role', 'tab');
      const name = h('button', 'tab-name', p.title);
      name.onclick = () => { if (!this.dragged) this.show(p); };
      name.addEventListener('pointerdown', e => this.dragTab(e, p));
      const x = h('button', 'tab-x');
      x.append(icon('x', 12));
      x.setAttribute('aria-label', `Close ${p.title}`);
      x.onclick = () => this.close(p);
      t.append(name, x);
      tabs.append(t);
    }
    tabs.scrollLeft = this.stripScroll[side] ?? 0;
    // every tab in this column, by name
    if (list.length > 1) {
      const all = h('button', 'strip-btn tab-list');
      all.append(icon('down', 14));
      all.title = `All ${list.length} tabs`;
      all.setAttribute('aria-label', `All ${list.length} tabs`);
      all.onclick = () => {
        const box = h('div', 'menu-list');
        for (const p of list) {
          const b = h('button', `menu-item${p.id === this.front[side] ? ' on' : ''}`, p.title);
          b.onclick = () => { close(); this.show(p); };
          box.append(b);
        }
        const close = popMenu(all, box, { align: 'right', width: 240 });
      };
      s.append(all);
    }
    const tool = (ico: string, label: string, fn: () => void) => {
      const b = h('button', 'strip-btn');
      b.append(icon(ico, 14));
      b.title = label;
      b.setAttribute('aria-label', label);
      b.onclick = fn;
      s.append(b);
    };
    const front = list.find(p => p.id === this.front[side])!;
    if (side !== 'float' && sizeClass() !== 'compact') {
      const wide = !!this.wide[side];
      tool(wide ? 'collapse' : 'expand', wide ? 'Back to its width' : 'Expand to half the window', () => {
        this.wide[side] = !wide;
        this.lastSized = side;
        this.save();
        this.layout();
      });
    }
    tool('minus', 'Minimize', () => { this.hidden[side] = true; this.layout(); });
    if (side === 'float') tool('float', 'Dock it again', () => this.move(front, front.kind === 'notebook' || front.kind === 'threads' || front.kind === 'thread' ? 'right' : 'left'));
    else tool('float', 'Float it', () => this.move(front, 'float'));
    tool('x', 'Close these panes', () => list.forEach(p => this.close(p)));
    if (side === 'float') this.dragBy(s);
    return s;
  }

  // A tab dragged to the other column docks its pane there; dropped over the reader, it floats. The zone it would go to
  // is shown while dragging. A press that does not move is an ordinary click.
  private dragged = false;
  private dragTab(e: PointerEvent, p: Pane) {
    if (e.button !== 0 || sizeClass() === 'compact') return;
    const x0 = e.clientX, y0 = e.clientY;
    let ghost: HTMLElement | null = null, zone: HTMLElement | null = null, target: Side | null = null;
    this.dragged = false;
    const large = sizeClass() === 'large';
    const sideAt = (x: number): Side => {
      const w = window.innerWidth, lw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-lw')) || 440;
      const rw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-rw')) || 380;
      if (large && x < Math.max(lw, w * 0.22)) return 'left';
      if (x > w - Math.max(rw, w * 0.22)) return 'right';
      return 'float';
    };
    const move = (m: PointerEvent) => {
      if (!this.dragged && Math.hypot(m.clientX - x0, m.clientY - y0) < 8) return;
      if (!this.dragged) {
        this.dragged = true;
        ghost = h('div', 'tab-ghost', p.title);
        zone = h('div', 'drop-zone');
        document.body.append(zone, ghost);
      }
      ghost!.style.left = `${m.clientX + 12}px`;
      ghost!.style.top = `${m.clientY + 8}px`;
      target = sideAt(m.clientX);
      const top = this.host.ownerDocument.getElementById('bar')?.getBoundingClientRect().bottom ?? 56;
      const w = window.innerWidth;
      const r = target === 'left' ? [0, Math.min(440, w * 0.35)] : target === 'right' ? [w - Math.min(420, w * 0.35), w] : [w * 0.3, w * 0.7];
      Object.assign(zone!.style, { left: `${r[0]}px`, width: `${r[1] - r[0]}px`, top: `${top}px`, height: target === 'float' ? '40%' : `calc(100% - ${top}px)` });
      zone!.dataset.side = target;
    };
    // the whole document listens while the button is held, so a quick first move off the tab is not lost
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      ghost?.remove();
      zone?.remove();
      if (this.dragged && target && target !== p.side) this.move(p, target);
      setTimeout(() => { this.dragged = false; });
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  // The floating column moves by its tab strip and keeps where it was put.
  private dragBy(strip: HTMLElement) {
    strip.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('button')) return;
      const f = this.cols.float, r = f.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      strip.setPointerCapture(e.pointerId);
      const move = (m: PointerEvent) => {
        this.floatAt.x = Math.max(0, Math.min(m.clientX - dx, window.innerWidth - 80));
        this.floatAt.y = Math.max(48, Math.min(m.clientY - dy, window.innerHeight - 40));
        f.style.left = `${this.floatAt.x}px`;
        f.style.top = `${this.floatAt.y}px`;
      };
      const up = () => {
        strip.removeEventListener('pointermove', move);
        strip.removeEventListener('pointerup', up);
        this.save();
      };
      strip.addEventListener('pointermove', move);
      strip.addEventListener('pointerup', up);
    });
  }

  /** What is open, for `panes` and `layout save`. */
  describe() {
    return this.panes.map(p => ({ title: p.title, kind: p.kind, key: p.key, side: p.side, front: Object.values(this.front).includes(p.id) }));
  }
}
