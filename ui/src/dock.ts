// The dock: panes in tabbed groups around the reader (docs/PLAN.md section 3; phase 2b tier 1, designs D1, D4, V2).
//
//   Large (≥ 1440)        a column on each side (a column can be split, one group above another), a band across the
//                         top and the bottom of the reader, and floating windows, each with its own tabs.
//   Expanded, Medium      one column on the right (the left column's panes join its tabs), the bands and the floats.
//   Compact (< 600)       no columns: the pane in front is a full screen over the reader, with "Back to …".
//
// A group is one tab strip and its panes. A pane keeps its element (and so its scroll and state) while it is open;
// switching tabs only hides it. Nothing here moves the reader: opening, closing, moving or switching panes never loses
// the place (keepPlace puts the verse at the top back after the reader's size changes).
import { h, icon, popMenu, sizeClass } from './ui';
import { toast } from './sheets';

export type Side = 'left' | 'right' | 'top' | 'bottom' | 'float';
type Docked = 'left' | 'right' | 'top' | 'bottom';
type Rect = { x: number; y: number; w: number; h: number };

/** What a write changed in the study folder. */
export type Change = 'notes' | 'threads' | 'highlights' | 'plans' | 'sets' | 'findings' | 'documents';
export const CHANGES: Change[] = ['notes', 'threads', 'highlights', 'plans', 'sets', 'findings', 'documents'];
/** What each kind of pane shows from the study folder. A write draws again only the panes that show what it changed;
 * the other kinds show the Bible database alone and are never drawn again by a write. */
const SHOWS: Record<string, Change[]> = {
  notebook: ['notes', 'threads', 'documents'], threads: ['threads'], thread: ['threads', 'notes', 'highlights', 'documents'], place: ['notes', 'highlights', 'threads'],
  reader2: ['notes', 'highlights', 'threads'], versecard: ['highlights'], find: ['notes', 'threads'], marked: ['highlights', 'threads'], plans: ['plans'], findings: ['findings'], shelf: ['sets', 'threads'],
  // a document's state follows its thread, the notes and highlights in it, and the documents themselves
  documents: ['documents', 'threads', 'notes', 'highlights'],
};

export interface Pane {
  id: string;
  key: string;
  kind: string;
  title: string;
  /** Where its group is. */
  side: Side;
  group: string;
  /** The column or band it was docked in before it floated: Dock it again goes back there. */
  home?: Side;
  el: HTMLElement;
  /** Draw again from the study folder (after a change). */
  refresh?: () => void | Promise<void>;
  onClose?: () => void;
}

/** One tab strip and its panes: a column (or a part of one, when split), a band, or a floating window. */
interface Group { id: string; side: Side; front?: string; rect?: Rect; z: number; min?: boolean; share?: number }

/** Where a dragged tab would go, the box shown for it, and the box's label. */
interface Drop { to: 'join' | 'split' | 'side' | 'float'; group?: Group; before?: Pane | null; after?: boolean; side?: Docked; rect?: Rect; label: string; box: Rect }

const WIDTH: Record<string, [number, number]> = { large: [440, 420], expanded: [0, 380], medium: [0, 320], compact: [0, 0] };
const STORE = 'wb.dock.v1';
/** A column is never narrower than this, and the reader keeps at least READER_MIN beside the columns. */
const COL_MIN = 280, READER_MIN = 460;
/** A band's usual share of the reader's height; never lower than BAND_MIN, and the reader keeps READER_MIN_H. */
const BAND = 0.34, BAND_MIN = 140, READER_MIN_H = 220;
/** The places remembered for panes closed (by key), so each reopens where it was. */
const SPOTS_MAX = 300;
const NAMES: Record<Docked, string> = { left: 'Left column', right: 'Right column', top: 'Top band', bottom: 'Bottom band' };
let seq = 0;

export class Dock {
  panes: Pane[] = [];
  groups: Group[] = [];
  /** The size a new floating window opens at. */
  floatAt = { w: 420, h: 520 };
  /** Widths the person set by dragging a column's edge (per side), and columns expanded to half the window. */
  widths: Partial<Record<'left' | 'right', number>> = {};
  wide: Partial<Record<'left' | 'right', boolean>> = {};
  /** Heights the person set by dragging a band's edge. */
  bands: Partial<Record<'top' | 'bottom', number>> = {};
  /** Where each pane was when it was last moved or closed, by key: it reopens there. */
  spots: Record<string, { side: Side; rect?: Rect }> = {};
  /** The pane in front of a column drawn as one strip (Expanded and Medium). */
  private colFront: Partial<Record<Docked, string>> = {};
  /** Where each tab strip was scrolled, kept while the strips are drawn again. */
  private stripScroll: Record<string, number> = {};
  private frames: Record<Docked, HTMLElement>;
  private floats = new Map<string, HTMLElement>();
  private chips: HTMLElement;
  private sheet: HTMLElement;
  private z = 0;
  backLabel = () => '';
  /** Called before the reader's size changes; the function it returns puts the reader back at the same verse. */
  keepPlace: () => () => void = () => () => {};

  constructor(private host: HTMLElement) {
    this.frames = {
      left: this.frame('aside', 'dock-col', 'left'), right: this.frame('aside', 'dock-col', 'right'),
      top: this.frame('section', 'dock-band', 'top'), bottom: this.frame('section', 'dock-band', 'bottom'),
    };
    this.chips = h('div', 'dock-chips');
    this.sheet = h('section', 'pane-sheet');
    host.append(this.frames.left, this.frames.right, this.frames.top, this.frames.bottom, this.chips, this.sheet);
    try {
      const kept = JSON.parse(localStorage.getItem(STORE) || '{}');
      if (kept.floatAt?.w) this.floatAt = { w: kept.floatAt.w, h: kept.floatAt.h };
      Object.assign(this.widths, kept.widths || {});
      Object.assign(this.wide, kept.wide || {});
      Object.assign(this.bands, kept.bands || {});
      Object.assign(this.spots, kept.spots || {});
    } catch { /* defaults */ }
    window.addEventListener('resize', () => this.layout());
    // the pane last pressed in: a pane opened from it opens beside it (a press in a menu or card opened from it keeps
    // it). Typing anywhere else (the command field) forgets it, and so do a few seconds. A press in a float brings it
    // to the front.
    document.addEventListener('pointerdown', e => {
      const t = e.target as Element;
      if (t.closest?.('.menu, .popover, .hovercard')) return;
      const g = t.closest?.('.dock-group') as HTMLElement | null;
      this.origin = g?.dataset.front ? { pane: g.dataset.front, at: performance.now() } : null;
      const f = t.closest?.('.dock-float') as HTMLElement | null;
      if (f) this.raise(f.dataset.group!);
    }, true);
    document.addEventListener('keydown', e => { if (!(e.target as Element).closest?.('.dock-group')) this.origin = null; }, true);
  }

  private frame(tag: 'aside' | 'section', cls: string, side: Docked) {
    const c = h(tag, `${cls} dock-${side}`);
    c.dataset.side = side;
    return c;
  }

  /** Where a group on `side` is drawn at this window size. */
  private drawn(side: Side): Side | 'sheet' {
    const size = sizeClass();
    if (size === 'compact') return 'sheet';
    if (side === 'left' && size !== 'large') return 'right';
    return side;
  }

  /** Where a pane is drawn at this window size. */
  where(p: Pane): Side | 'sheet' {
    return this.drawn(p.side);
  }

  find(key: string) {
    return this.panes.find(p => p.key === key);
  }

  private groupOf(p: Pane) {
    return this.groups.find(g => g.id === p.group)!;
  }

  private inGroup(g: Group) {
    return this.panes.filter(p => p.group === g.id);
  }

  private newGroup(side: Side, rect?: Rect, at?: number): Group {
    const g: Group = { id: `g${++seq}`, side, rect: rect && this.fit(rect), z: ++this.z };
    if (at === undefined) this.groups.push(g);
    else this.groups.splice(at, 0, g);
    return g;
  }

  /** A new floating window: at `rect`, or a step down and left of the last one. */
  private newFloat(rect?: Rect): Group {
    const n = this.groups.filter(g => g.side === 'float').length;
    const { w, h } = this.floatAt;
    return this.newGroup('float', rect ?? { x: window.innerWidth - w - 40 - 28 * n, y: 90 + 28 * n, w, h });
  }

  /** The group a pane goes to on a side: the first one there (a column's top part), or a new one. */
  private groupOn(side: Side): Group {
    if (side === 'float') return this.newFloat();
    return this.groups.find(g => g.side === side) ?? this.newGroup(side);
  }

  /** A floating window's box kept inside the window, its strip always reachable. */
  private fit(r: Rect): Rect {
    const W = window.innerWidth, H = window.innerHeight;
    const w = Math.max(280, Math.min(r.w, W - 16)), hh = Math.max(200, Math.min(r.h, H - 56));
    return { x: Math.round(Math.max(0, Math.min(r.x, W - 80))), y: Math.round(Math.max(48, Math.min(r.y, H - 40))), w: Math.round(w), h: Math.round(hh) };
  }

  /** Puts a pane in a group: before `before`, or after the group's last tab. */
  private put(p: Pane, g: Group, before: Pane | null = null) {
    if (g.side === 'float' && p.side !== 'float' && p.group) p.home = p.side;
    p.group = g.id;
    p.side = g.side;
    this.panes = this.panes.filter(x => x !== p);
    let i = before ? this.panes.indexOf(before) : -1;
    if (i < 0) this.panes.forEach((x, k) => { if (x.group === g.id) i = k + 1; });
    this.panes.splice(i < 0 ? this.panes.length : i, 0, p);
  }

  /** Groups left with no panes go. */
  private prune() {
    this.groups = this.groups.filter(g => this.panes.some(p => p.group === g.id));
  }

  private raise(id: string) {
    const g = this.groups.find(x => x.id === id);
    if (!g || g.z === this.z) return;
    g.z = ++this.z;
    this.stackFloats();
  }

  /** Remembers where a pane is, so it reopens there. */
  private remember(p: Pane) {
    const g = this.groupOf(p);
    if (!g) return;
    delete this.spots[p.key];
    this.spots[p.key] = { side: g.side, ...(g.rect ? { rect: { ...g.rect } } : {}) };
    const keys = Object.keys(this.spots);
    for (const k of keys.slice(0, Math.max(0, keys.length - SPOTS_MAX))) delete this.spots[k];
    this.save();
  }

  /** The pane last pressed in, if the last press was in one, and when. */
  private origin: { pane: string; at: number } | null = null;

  /** The next pane opens where its kind goes, not beside the pane it was asked for from (W6: a document's preview opens
   * beside the page, on the left, so the page stays in view). */
  apart() {
    this.origin = null;
  }

  /**
   * Opens a pane, or brings forward the one already open with the same key. `fill` draws into the pane's element (it may
   * be called again by refresh). A new pane opens beside the pane it was opened from (D4); else where it was when it was
   * last closed; else beside a pane of its kind; else on its usual `side`.
   */
  open(kind: string, title: string, key: string, side: Side, fill: (el: HTMLElement, p: Pane) => void | Promise<void>): Pane {
    const have = this.find(key);
    if (have) {
      this.show(have);
      return have;
    }
    const el = h('div', `pane pane-${kind}`);
    const p: Pane = { id: `p${++seq}`, key, kind, title, side, group: '', el };
    p.refresh = () => fill(el, p);
    const from = this.origin && performance.now() - this.origin.at < 3000 ? this.panes.find(x => x.id === this.origin!.pane) : undefined;
    const spot = this.spots[key];
    const kin = this.panes.find(x => x.kind === kind);
    if (from) {
      const g = this.groupOf(from), sibs = this.inGroup(g);
      this.put(p, g, sibs[sibs.indexOf(from) + 1] ?? null);
      // said only when that pane was put somewhere by the person (moved, or reopened where it was)
      const w = this.drawn(g.side);
      if (w !== 'sheet' && w !== this.drawn(side) && this.spots[from.key]) toast(`Opened beside ${from.title}, where you put it`);
    } else if (spot?.side === 'float') {
      const r = spot.rect;
      this.put(p, this.groups.find(g => g.side === 'float' && r && g.rect?.x === r.x && g.rect?.y === r.y) ?? this.newFloat(r));
    } else if (spot) this.put(p, this.groupOn(spot.side));
    else if (kin) this.put(p, this.groupOf(kin));
    else this.put(p, this.groupOn(side));
    this.show(p);
    Promise.resolve(fill(el, p)).catch(e => { el.replaceChildren(h('p', 'error', String(e))); });
    return p;
  }

  show(p: Pane) {
    const g = this.groupOf(p);
    g.front = p.id;
    g.min = false;
    const w = this.drawn(g.side);
    if (w === 'sheet') this.sheetFor = p.id;
    else if (w === 'float') g.z = ++this.z;
    else {
      this.colFront[w] = p.id;
      // a column drawn as one strip is minimized and shown as one
      if (this.oneStrip(w)) for (const x of this.groups) if (this.drawn(x.side) === w) x.min = false;
    }
    this.layout();
  }

  /** Expanded and Medium have one column: its groups are drawn as one strip. */
  private oneStrip(w: Side | 'sheet') {
    return w === 'right' && sizeClass() !== 'large' && this.groups.filter(g => this.drawn(g.side) === 'right').length > 1;
  }

  private sheetFor: string | null = null;

  rename(p: Pane, title: string) {
    p.title = title;
    this.layout();
  }

  close(p: Pane) {
    this.remember(p);
    this.panes = this.panes.filter(x => x !== p);
    p.el.remove();
    p.onClose?.();
    if (this.sheetFor === p.id) this.sheetFor = null;
    this.layout();
  }

  /** Moves a pane to a side: into the first group there, or a new floating window of its own. */
  move(p: Pane, side: Side) {
    if (side === 'float' && p.side === 'float' && this.inGroup(this.groupOf(p)).length === 1) return this.show(p);
    this.put(p, this.groupOn(side));
    this.prune();
    this.remember(p);
    this.show(p);
  }

  /** Docks a floating pane again where it was docked before (or its kind's usual column). */
  dockAgain(p: Pane) {
    this.move(p, p.home && p.home !== 'float' ? p.home : p.kind === 'notebook' || p.kind.startsWith('thread') ? 'right' : 'left');
  }

  /** Minimizes the group a pane is in, and only that group: the other part of a split column, the other column and the
   * bands stay as they are (note 1b2d). A column drawn as one strip (Expanded, Medium) is minimized as one. */
  minimize(p: Pane) {
    const g = this.groupOf(p), w = this.drawn(g.side);
    if (w === 'sheet') return;
    if (this.oneStrip(w)) { for (const x of this.groups) if (this.drawn(x.side) === w) x.min = true; }
    else g.min = true;
    this.layout();
  }

  isMinimized(p: Pane) {
    const g = this.groupOf(p);
    return this.drawn(g.side) !== 'sheet' && !!g.min;
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

  /** Draws again the panes that show what changed, each keeping where it was scrolled. */
  refresh(changed: Change[] = CHANGES) {
    for (const p of this.panes) {
      if (!(SHOWS[p.kind] || []).some(c => changed.includes(c))) continue;
      const top = p.el.scrollTop;
      Promise.resolve(p.refresh?.()).then(() => { if (p.el.scrollTop !== top) p.el.scrollTop = top; }).catch(() => {});
    }
  }

  private save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ floatAt: this.floatAt, widths: this.widths, wide: this.wide, bands: this.bands, spots: this.spots }));
    } catch { /* this run only */ }
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

  /** Where the toolbar ends: the columns, the bands and the reader start below it. */
  private barBottom() {
    return document.getElementById('bar')?.getBoundingClientRect().bottom ?? 56;
  }

  /** The bands' heights now: as dragged or BAND of the room under the toolbar; the reader keeps READER_MIN_H. */
  private heightsNow(topOpen: boolean, bottomOpen: boolean): [number, number] {
    const room = window.innerHeight - this.barBottom();
    const want = (side: 'top' | 'bottom') => Math.max(BAND_MIN, Math.min(room * 0.6, this.bands[side] ?? Math.round(room * BAND)));
    let t = topOpen ? want('top') : 0, b = bottomOpen ? want('bottom') : 0;
    const over = t + b - Math.max(0, room - READER_MIN_H);
    if (over > 0) { const k = (t + b - over) / (t + b); t = Math.round(t * k); b = Math.round(b * k); }
    return [t, b];
  }

  /** Sets the room the columns and bands take from the reader (CSS variables the reader and the frames use). */
  private room(lw: number, rw: number, th: number, bh: number) {
    const root = document.documentElement.style;
    root.setProperty('--dock-l', `${lw}px`);
    root.setProperty('--dock-r', `${rw}px`);
    if (lw) root.setProperty('--dock-lw', `${lw}px`);
    if (rw) root.setProperty('--dock-rw', `${rw}px`);
    root.setProperty('--dock-t', `${th}px`);
    root.setProperty('--dock-b', `${bh}px`);
  }

  private isOpen(side: Docked) {
    return this.frames[side].classList.contains('open');
  }

  /** Puts every group in its column, band or window, draws the tab strips, and moves the reader over to make room. */
  layout() {
    const size = sizeClass();
    this.prune();
    const at: Record<string, Group[]> = { left: [], right: [], top: [], bottom: [], float: [], sheet: [] };
    for (const g of this.groups) at[this.drawn(g.side)].push(g);
    const chips: HTMLElement[] = [];
    for (const side of ['left', 'right', 'top', 'bottom'] as Docked[]) {
      const frame = this.frames[side], gs = at[side], column = side === 'left' || side === 'right';
      const live = gs.filter(g => !g.min), mins = gs.filter(g => g.min);
      const names = (list: Group[]) => this.panes.filter(p => list.some(g => g.id === p.group)).map(p => p.title).join(' · ');
      const back = (list: Group[]) => () => { for (const g of list) g.min = false; this.layout(); };
      frame.classList.toggle('open', live.length > 0);
      frame.classList.toggle('minimized', gs.length > 0 && !live.length && column);
      if (!gs.length) { frame.replaceChildren(); continue; }
      if (!live.length) {
        if (column) {
          const b = h('button', 'dock-restore', names(gs));
          b.title = 'Show the panes again';
          b.onclick = back(gs);
          frame.replaceChildren(b);
        } else {
          frame.replaceChildren();
          chips.push(this.chip(`${names(gs)} · minimized`, back(gs)));
        }
        continue;
      }
      // Expanded and Medium have one column: its groups are drawn as one strip, as before tier 1
      const one = side === 'right' && size !== 'large' && live.length > 1;
      const parts = one
        ? [{ g: live.find(g => g.side === 'right') ?? live[0], list: this.panes.filter(p => live.some(g => g.id === p.group)), front: this.colFront[side] }]
        : live.map(g => ({ g, list: this.inGroup(g), front: g.front }));
      const els: HTMLElement[] = [];
      parts.forEach((x, i) => {
        const el = this.groupEl(x.g, x.list, x.front, side, i === 0, !one);
        if (column && !one && parts.length > 1) el.style.flexGrow = String(x.g.share ?? 1);
        if (i > 0 && column && !one) els.push(this.splitGrip(parts[i - 1].g, x.g));
        els.push(el);
      });
      frame.replaceChildren(...els);
      // a part of a split column minimized on its own waits as a bar at the column's foot; the other part has the room
      for (const g of mins) {
        if (!column) { chips.push(this.chip(`${names([g])} · minimized`, back([g]))); continue; }
        const b = h('button', 'dock-restore-bar');
        b.append(icon('float', 14), document.createTextNode(` ${names([g])}`));
        b.title = 'Show it again';
        b.onclick = back([g]);
        frame.append(b);
      }
      frame.append(column ? this.grip(side) : this.bandGrip(side));
    }
    // each floating window on its own (V2); minimized ones wait as chips
    const live = new Set<string>();
    for (const g of at.float) {
      if (g.min) {
        chips.push(this.chip(`${this.inGroup(g).map(p => p.title).join(' · ')} · minimized`, () => { g.min = false; g.z = ++this.z; this.layout(); }));
        continue;
      }
      live.add(g.id);
      let f = this.floats.get(g.id);
      if (!f) {
        f = h('div', 'dock-float open');
        f.dataset.group = g.id;
        this.floats.set(g.id, f);
        this.host.append(f);
      }
      g.rect = this.fit(g.rect ?? { x: window.innerWidth - this.floatAt.w - 40, y: 90, ...this.floatAt });
      Object.assign(f.style, { left: `${g.rect.x}px`, top: `${g.rect.y}px`, width: `${g.rect.w}px`, height: `${g.rect.h}px` });
      f.replaceChildren(this.groupEl(g, this.inGroup(g), g.front, 'float', true, true), this.corner(g, f));
    }
    for (const [id, f] of this.floats) if (!live.has(id)) { f.remove(); this.floats.delete(id); }
    this.stackFloats();
    this.chips.replaceChildren(...chips);
    this.chips.classList.toggle('open', chips.length > 0);
    const restore = this.keepPlace();
    const [lw, rw] = this.widthsNow(this.isOpen('left'), this.isOpen('right'));
    const [th, bh] = this.heightsNow(this.isOpen('top'), this.isOpen('bottom'));
    this.room(this.isOpen('left') ? lw : 0, this.isOpen('right') ? rw : 0, th, bh);
    restore();
    this.drawSheet(at.sheet.flatMap(g => this.inGroup(g)));
    requestAnimationFrame(() => this.fitStrips());
  }

  /** The floating windows in the order they were last brought forward. */
  private stackFloats() {
    const order = this.groups.filter(g => g.side === 'float').sort((a, b) => a.z - b.z);
    order.forEach((g, i) => { const f = this.floats.get(g.id); if (f) f.style.zIndex = String(7 + Math.min(i, 16)); });
  }

  private chip(text: string, onclick: () => void) {
    const b = h('button', 'dock-chip');
    b.append(icon('float', 14), document.createTextNode(` ${text}`));
    b.title = 'Show it again';
    b.onclick = onclick;
    return b;
  }

  /** One group: its strip, then its panes (only the front one shown). `own` is false for a column drawn as one strip. */
  private groupEl(g: Group, list: Pane[], front: string | undefined, where: Side, first: boolean, own: boolean) {
    const f = front && list.some(p => p.id === front) ? front : list.some(p => p.id === g.front) ? g.front! : list[list.length - 1].id;
    if (own) g.front = f;
    const box = h('div', 'dock-group');
    box.dataset.group = g.id;
    box.dataset.front = f;
    box.append(this.strip(g, list, f, where, first), ...list.map(p => p.el));
    for (const p of list) p.el.hidden = p.id !== f;
    return box;
  }

  // ---- a floating window's size: its own corner, drawn over the pane (the browser's resize corner sat on the pane's
  // scrollbar, so a drag there moved both) ------------------------------------------------------------------------------
  private corner(g: Group, f: HTMLElement): HTMLElement {
    const c = h('div', 'float-corner');
    c.title = 'Drag to resize';
    c.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      c.setPointerCapture(e.pointerId);
      const r = f.getBoundingClientRect();
      const dx = r.right - e.clientX, dy = r.bottom - e.clientY;
      const move = (m: PointerEvent) => {
        f.style.width = `${Math.max(280, Math.min(window.innerWidth - r.left - 8, m.clientX + dx - r.left))}px`;
        f.style.height = `${Math.max(200, Math.min(window.innerHeight - r.top - 8, m.clientY + dy - r.top))}px`;
      };
      const up = () => {
        c.removeEventListener('pointermove', move);
        c.removeEventListener('pointerup', up);
        g.rect = { ...g.rect!, w: f.offsetWidth, h: f.offsetHeight };
        this.floatAt = { w: f.offsetWidth, h: f.offsetHeight };
        for (const p of this.inGroup(g)) this.remember(p);
        this.fitStrips();
      };
      c.addEventListener('pointermove', move);
      c.addEventListener('pointerup', up);
    });
    return c;
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
        const [lw, rw] = this.widthsNow(this.isOpen('left'), this.isOpen('right'));
        const [th, bh] = this.heightsNow(this.isOpen('top'), this.isOpen('bottom'));
        this.room(this.isOpen('left') ? lw : 0, this.isOpen('right') ? rw : 0, th, bh);
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

  // ---- the parts of a split column: drag the line between two (double-click: the same height each; note 523e) --------
  private splitGrip(above: Group, below: Group): HTMLElement {
    const g = h('div', 'split-grip');
    g.title = 'Drag to make one part taller (double-click: the same height each)';
    g.setAttribute('role', 'separator');
    g.setAttribute('aria-orientation', 'horizontal');
    g.addEventListener('dblclick', () => {
      for (const x of this.groups) if (x.side === above.side) delete x.share;
      this.layout();
    });
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      g.classList.add('dragging');
      const col = g.parentElement!;
      const elOf = (x: Group) => col.querySelector<HTMLElement>(`:scope > .dock-group[data-group="${x.id}"]`)!;
      // every part of the column measured first (setting one part's size changes the others'), then nothing changes
      // until the pointer moves: a double-click is not a drag
      const sizes = [...col.querySelectorAll<HTMLElement>(':scope > .dock-group')].map(el => ({ el, grp: this.groups.find(x => x.id === el.dataset.group), h: Math.round(el.getBoundingClientRect().height) }));
      const a = elOf(above), b = elOf(below);
      const top = a.getBoundingClientRect().top, y0 = e.clientY, MIN = 120;
      const total = (sizes.find(x => x.el === a)?.h ?? 0) + (sizes.find(x => x.el === b)?.h ?? 0);
      let started = false;
      const move = (m: PointerEvent) => {
        if (!started) {
          if (Math.abs(m.clientY - y0) < 3) return;
          started = true;
          for (const x of sizes) if (x.grp) { x.grp.share = x.h; x.el.style.flexGrow = String(x.h); }
        }
        const ha = Math.round(Math.max(MIN, Math.min(total - MIN, m.clientY - top)));
        above.share = ha;
        below.share = total - ha;
        a.style.flexGrow = String(above.share);
        b.style.flexGrow = String(below.share);
      };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        g.classList.remove('dragging');
        this.fitStrips();
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
    });
    return g;
  }

  // ---- a band's height: drag its edge next to the reader (double-click puts it back) ----------------------------------
  private bandGrip(side: 'top' | 'bottom'): HTMLElement {
    const g = h('div', `dock-grip band-grip grip-${side}`);
    g.title = 'Drag to make the band taller or shorter (double-click: its usual height)';
    g.setAttribute('role', 'separator');
    g.setAttribute('aria-orientation', 'horizontal');
    g.addEventListener('dblclick', () => { delete this.bands[side]; this.save(); this.layout(); });
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      g.classList.add('dragging');
      const restore = this.keepPlace();
      const move = (m: PointerEvent) => {
        this.bands[side] = side === 'top' ? m.clientY - this.barBottom() : window.innerHeight - m.clientY;
        const [lw, rw] = this.widthsNow(this.isOpen('left'), this.isOpen('right'));
        const [th, bh] = this.heightsNow(this.isOpen('top'), this.isOpen('bottom'));
        this.room(this.isOpen('left') ? lw : 0, this.isOpen('right') ? rw : 0, th, bh);
      };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        g.classList.remove('dragging');
        this.save();
        restore();
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
    });
    return g;
  }

  // ---- tab strips: tabs keep their size and scroll; ‹ › show when there is more; the front tab stays in view ----------
  private fitStrips() {
    for (const strip of this.host.querySelectorAll<HTMLElement>('.tabstrip')) {
      const tabs = strip.querySelector<HTMLElement>('.tab-row');
      if (!tabs) continue;
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

  private strip(g: Group, list: Pane[], front: string, where: Side, first: boolean) {
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
    tabs.addEventListener('scroll', () => { this.stripScroll[g.id] = tabs.scrollLeft; this.arrows(s, tabs); }, { passive: true });
    s.append(back, tabs, fwd);
    for (const p of list) {
      const t = h('div', `tab${p.id === front ? ' on' : ''}`);
      t.setAttribute('role', 'tab');
      t.dataset.pane = p.id;
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
    tabs.scrollLeft = this.stripScroll[g.id] ?? 0;
    // every tab in this group, by name
    if (list.length > 1) {
      const all = h('button', 'strip-btn tab-list');
      all.append(icon('down', 14));
      all.title = `All ${list.length} tabs`;
      all.setAttribute('aria-label', `All ${list.length} tabs`);
      all.onclick = () => {
        const box = h('div', 'menu-list');
        const draw = () => {
          const left = list.filter(p => this.panes.includes(p));
          box.replaceChildren(...left.map(p => {
            const row = h('div', 'tab-list-row');
            const b = h('button', `menu-item${p.id === front ? ' on' : ''}`, p.title);
            b.onclick = () => { close(); this.show(p); };
            // a trash on each tab, red on hover: closes that tab, and the list stays open (note 5e36)
            const x = h('button', 'tab-list-close');
            x.append(icon('trash', 14));
            x.title = `Close ${p.title}`;
            x.setAttribute('aria-label', `Close ${p.title}`);
            // with one tab left the strip has no list, so it closes
            x.onclick = () => { this.close(p); if (left.length > 2) draw(); else close(); };
            row.append(b, x);
            return row;
          }));
        };
        draw();
        const close = popMenu(all, box, { align: 'right', width: 260 });
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
    const fp = list.find(p => p.id === front)!;
    if ((where === 'left' || where === 'right') && first) {
      const wide = !!this.wide[where];
      tool(wide ? 'collapse' : 'expand', wide ? 'Back to its width' : 'Expand to half the window', () => {
        this.wide[where] = !wide;
        this.lastSized = where;
        this.save();
        this.layout();
      });
    }
    tool('minus', 'Minimize', () => this.minimize(fp));
    if (where === 'float') tool('float', 'Dock it again', () => this.dockAgain(fp));
    else tool('float', 'Float it', () => this.move(fp, 'float'));
    tool('x', 'Close these panes', () => list.forEach(p => this.close(p)));
    if (where === 'float') this.dragBy(s, g);
    return s;
  }

  // ---- dragging a tab (D1): to either column, a band across the top or the bottom of the reader, beside a pane (the
  // column splits), onto another strip (the tabs join), or anywhere else over the reader (a window of its own; Shift:
  // split beside the pane it came from). The zone it would go to is shown, with its name. A press that does not move
  // is an ordinary click. -----------------------------------------------------------------------------------------------
  private dragged = false;
  private dragTab(e: PointerEvent, p: Pane) {
    if (e.button !== 0 || sizeClass() === 'compact') return;
    const x0 = e.clientX, y0 = e.clientY;
    let ghost: HTMLElement | null = null, zone: HTMLElement | null = null, label: HTMLElement | null = null, hint: HTMLElement | null = null;
    let drop: Drop | null = null;
    this.dragged = false;
    const move = (m: PointerEvent) => {
      if (!this.dragged && Math.hypot(m.clientX - x0, m.clientY - y0) < 8) return;
      if (!this.dragged) {
        this.dragged = true;
        ghost = h('div', 'tab-ghost', p.title);
        zone = h('div', 'drop-zone');
        label = h('span', 'drop-label');
        zone.append(label);
        hint = h('div', 'drop-hint', 'Drop on the reader to float · Shift: split beside');
        document.body.append(zone, hint, ghost);
        document.body.classList.add('tab-dragging');
      }
      ghost!.style.left = `${m.clientX + 12}px`;
      ghost!.style.top = `${m.clientY + 8}px`;
      drop = this.dropAt(m.clientX, m.clientY, m.shiftKey, p);
      zone!.hidden = !drop;
      if (!drop) return;
      const b = drop.box;
      Object.assign(zone!.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
      zone!.dataset.to = drop.to;
      label!.textContent = drop.label;
    };
    // the whole document listens while the button is held, so a quick first move off the tab is not lost
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      ghost?.remove();
      zone?.remove();
      hint?.remove();
      document.body.classList.remove('tab-dragging');
      if (this.dragged && drop) this.drop(p, drop);
      setTimeout(() => { this.dragged = false; });
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  /** Where a tab dropped at (x, y) would go. */
  private dropAt(x: number, y: number, shift: boolean, p: Pane): Drop | null {
    const mine = this.groupOf(p), alone = this.inGroup(mine).length === 1;
    const box = (r: DOMRect): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height });
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const gEl = el?.closest<HTMLElement>('.dock-group');
    const g = gEl && this.groups.find(q => q.id === gEl.dataset.group);
    if (g && gEl) {
      const where = this.drawn(g.side);
      // the pane named in the label: the one in front, or, when that is the tab dragged, the one that stays
      const shown = this.panes.find(q => q.id === gEl.dataset.front);
      const front = shown === p ? this.panes.find(q => q.group === g.id && q !== p) : shown;
      const strip = el!.closest<HTMLElement>('.tabstrip');
      if (strip) {
        // onto a strip: the tab joins those tabs, before the one under the pointer
        if (g === mine && alone) return null;
        const at = [...strip.querySelectorAll<HTMLElement>('.tab')].find(t => { const b = t.getBoundingClientRect(); return x < b.left + b.width / 2; });
        const before = at ? this.panes.find(q => q.id === at.dataset.pane) ?? null : null;
        return { to: 'join', group: g, before: before === p ? null : before, label: `Beside ${front?.title ?? ''}`, box: box(strip.getBoundingClientRect()) };
      }
      const r = gEl.getBoundingClientRect();
      if ((where === 'left' || where === 'right') && sizeClass() === 'large') {
        // onto a pane in a column: the column splits, the tab above or below it
        if (g === mine && alone) return null;
        const after = y > r.top + r.height / 2;
        return { to: 'split', group: g, after, label: `Split beside ${front?.title ?? ''}`, box: { x: r.left, y: after ? r.top + r.height / 2 : r.top, w: r.width, h: r.height / 2 } };
      }
      if (where !== 'float') {
        if (g === mine && alone) return null;
        return { to: 'join', group: g, before: null, label: NAMES[where as Docked], box: box(r) };
      }
    }
    const W = window.innerWidth, H = window.innerHeight, top = this.barBottom(), edge = Math.max(120, W * 0.18);
    const col = (side: 'left' | 'right'): Drop => {
      const w = Math.min(WIDTH.large[side === 'left' ? 0 : 1], W * 0.35);
      return { to: 'side', side, label: NAMES[side], box: { x: side === 'left' ? 0 : W - w, y: top, w, h: H - top } };
    };
    if (sizeClass() === 'large' && x < edge) return col('left');
    if (x > W - edge) return col('right');
    const reader = document.getElementById('scroller')?.getBoundingClientRect() ?? new DOMRect(0, top, W, H - top);
    const band = Math.max(BAND_MIN, Math.round((H - top) * BAND));
    if (y < reader.top + reader.height * 0.22) return { to: 'side', side: 'top', label: NAMES.top, box: { x: reader.left, y: reader.top, w: reader.width, h: band } };
    if (y > reader.bottom - reader.height * 0.22) return { to: 'side', side: 'bottom', label: NAMES.bottom, box: { x: reader.left, y: reader.bottom - band, w: reader.width, h: band } };
    if (shift && mine.side !== 'float' && !alone) {
      const fp = this.panes.find(q => q.group === mine.id && q !== p);
      const gEl2 = this.host.querySelector<HTMLElement>(`.dock-group[data-group="${mine.id}"]`);
      if (gEl2) return { to: 'split', group: mine, after: true, label: `Split beside ${fp?.title ?? ''}`, box: box(gEl2.getBoundingClientRect()) };
    }
    const rect = this.fit({ x: x - this.floatAt.w / 2, y: y - 20, ...this.floatAt });
    return { to: 'float', rect, label: 'Float', box: rect };
  }

  private drop(p: Pane, d: Drop) {
    if (d.to === 'join') this.put(p, d.group!, d.before ?? null);
    else if (d.to === 'split') this.put(p, this.newGroup(d.group!.side, undefined, this.groups.indexOf(d.group!) + (d.after ? 1 : 0)));
    else if (d.to === 'side') this.put(p, this.groupOn(d.side!));
    else this.put(p, this.newFloat(d.rect));
    this.prune();
    this.remember(p);
    this.show(p);
  }

  // A floating window moves by its tab strip and keeps where it was put.
  private dragBy(strip: HTMLElement, g: Group) {
    strip.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('button')) return;
      const f = this.floats.get(g.id)!, r = f.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      strip.setPointerCapture(e.pointerId);
      const move = (m: PointerEvent) => {
        g.rect = this.fit({ ...g.rect!, x: m.clientX - dx, y: m.clientY - dy });
        f.style.left = `${g.rect.x}px`;
        f.style.top = `${g.rect.y}px`;
      };
      const up = () => {
        strip.removeEventListener('pointermove', move);
        strip.removeEventListener('pointerup', up);
        for (const p of this.inGroup(g)) this.remember(p);
      };
      strip.addEventListener('pointermove', move);
      strip.addEventListener('pointerup', up);
    });
  }

  /** What is open, for `panes` and `layout save`. */
  describe() {
    return this.panes.map(p => {
      const g = this.groupOf(p);
      return { title: p.title, kind: p.kind, key: p.key, side: p.side, front: g?.front === p.id, ...(g?.rect ? { rect: { ...g.rect } } : {}) };
    });
  }
}
