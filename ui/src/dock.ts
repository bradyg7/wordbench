// The dock: panes in tabbed columns beside the reader (docs/PLAN.md section 3, the desktop sheets).
//
//   Large (≥ 1440)        a column on each side: study panes (word study, interlinear, uses) on the left, the
//                         Notebook and threads on the right; any pane can float.
//   Expanded, Medium      one column on the right, holding every pane as a tab.
//   Compact (< 600)       no columns: the pane in front is a full screen over the reader, with "Back to …".
//
// A pane keeps its element (and so its scroll and state) while it is open; switching tabs only hides it. Nothing here
// moves the reader: opening, closing or switching panes never loses the place.
import { h, icon, sizeClass } from './ui';

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
let seq = 0;

export class Dock {
  panes: Pane[] = [];
  front: Partial<Record<Side, string>> = {};
  hidden: Partial<Record<Side, boolean>> = {};
  /** Where the floating column sits. */
  floatAt = { x: 0, y: 0, w: 420, h: 520 };
  private cols: Record<Side, HTMLElement>;
  private sheet: HTMLElement;
  backLabel = () => '';
  /** Called before the reader's width changes; the function it returns puts the reader back at the same verse. */
  keepPlace: () => () => void = () => () => {};

  constructor(private host: HTMLElement) {
    this.cols = { left: this.column('left'), right: this.column('right'), float: this.column('float') };
    this.sheet = h('section', 'pane-sheet');
    host.append(this.cols.left, this.cols.right, this.cols.float, this.sheet);
    try { Object.assign(this.floatAt, JSON.parse(localStorage.getItem(STORE) || '{}').floatAt || {}); } catch { /* defaults */ }
    window.addEventListener('resize', () => this.layout());
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
      for (const p of list) p.el.hidden = p.id !== this.front[side];
      if (this.hidden[side]) {
        const back = h('button', 'dock-restore', list.map(p => p.title).join(' · '));
        back.title = 'Show the panes again';
        back.onclick = () => { this.hidden[side] = false; this.layout(); };
        col.replaceChildren(back);
      }
    }
    const restore = this.keepPlace();
    const [lw, rw] = WIDTH[size];
    const leftOpen = by.left.length > 0 && !this.hidden.left, rightOpen = by.right.length > 0 && !this.hidden.right;
    root.style.setProperty('--dock-l', `${leftOpen ? lw : 0}px`);
    root.style.setProperty('--dock-r', `${rightOpen ? rw : 0}px`);
    root.style.setProperty('--dock-lw', `${lw}px`);
    root.style.setProperty('--dock-rw', `${rw}px`);
    restore();
    const f = this.cols.float;
    Object.assign(f.style, { left: `${this.floatAt.x || window.innerWidth - this.floatAt.w - 40}px`, top: `${this.floatAt.y || 90}px`, width: `${this.floatAt.w}px`, height: `${this.floatAt.h}px` });
    this.drawSheet(by.sheet);
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
    s.setAttribute('role', 'tablist');
    for (const p of list) {
      const t = h('div', `tab${p.id === this.front[side] ? ' on' : ''}`);
      t.setAttribute('role', 'tab');
      const name = h('button', 'tab-name', p.title);
      name.onclick = () => this.show(p);
      const x = h('button', 'tab-x');
      x.append(icon('x', 12));
      x.setAttribute('aria-label', `Close ${p.title}`);
      x.onclick = () => this.close(p);
      t.append(name, x);
      s.append(t);
    }
    s.append(h('span', 'grow'));
    const tool = (ico: string, label: string, fn: () => void) => {
      const b = h('button', 'strip-btn');
      b.append(icon(ico, 14));
      b.title = label;
      b.setAttribute('aria-label', label);
      b.onclick = fn;
      s.append(b);
    };
    const front = list.find(p => p.id === this.front[side])!;
    tool('minus', 'Minimize', () => { this.hidden[side] = true; this.layout(); });
    if (side === 'float') tool('float', 'Dock it again', () => this.move(front, front.kind === 'notebook' || front.kind === 'threads' || front.kind === 'thread' ? 'right' : 'left'));
    else tool('float', 'Float it', () => this.move(front, 'float'));
    tool('x', 'Close these panes', () => list.forEach(p => this.close(p)));
    if (side === 'float') this.dragBy(s);
    return s;
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
        try { localStorage.setItem(STORE, JSON.stringify({ floatAt: this.floatAt })); } catch { /* this run only */ }
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
