// The mark bar (design/features/marks T6, MK7-8 to MK7-12, MK7-16, MK7-24, MK7-30, MK7-31; rows 1, 4 to 10, 20 to 22, 24).
// Words are selected: a bar of icons only sits just above them: six kinds (the name and key on hover), a divider, the
// Legend, a divider, Add to…. A click on Highlight, Underline, Circle or Box opens a small drop-down from that icon, on
// the side away from the selection: that kind's styles by name (the person's quick ones pinned with a tick, then the
// recent ones, six at most, numbered), then Any color…. A color no legend entry has is drawn at once and asks for its
// name in the drop-down ("New pen", MK7-11). The Legend icon opens the whole legend with a filter. The bar never grows
// with the legend. Arrow and Margin note are tickets T9 and T10: their icons are here and `kindHooks` is where they plug in.
//
// Marks are made with `wb mark add` (--style for a legend entry, or --kind, --color and --lines) and entries with
// `wb legend add`; this file draws nothing itself, it asks `hooks.drawn` to show the mark that came back.
import { wb, type DrawnMark } from './api';
import { h } from './ui';
import { toast } from './sheets';
import { inkOf } from './markdraw';

export type Kind = 'highlight' | 'underline' | 'circle' | 'box' | 'arrow' | 'note';
const KINDS: { kind: Kind; name: string; key: string; path: string }[] = [
  { kind: 'highlight', name: 'Highlight', key: 'H', path: 'M9.5 2.5l4 4-6 6H4v-3.5zM2.5 14.5h11' },
  { kind: 'underline', name: 'Underline', key: 'U', path: 'M4.5 2.5v5a3.5 3.5 0 0 0 7 0v-5M3 14h10' },
  { kind: 'circle', name: 'Circle', key: 'C', path: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z' },
  { kind: 'box', name: 'Box', key: 'B', path: 'M3 3h10v10H3z' },
  { kind: 'arrow', name: 'Arrow', key: 'A', path: 'M3 13L13 3M6 3h7v7' },
  { kind: 'note', name: 'Margin note', key: 'N', path: 'M3.5 2h9v12h-9zM6 5.5h4M6 8h4M6 10.5h2' },
];
const DROPS: Kind[] = ['highlight', 'underline', 'circle', 'box'];   // the kinds with a drop-down today
const LEGEND_PATH = 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01';
const ADD_PATH = 'M8 3v10M3 8h10';

/** Where Arrow (T9) and Margin note (T10) plug in. Nothing is set yet: clicking those icons or pressing A or N does nothing. */
export const kindHooks: { arrow?: (ctx: BarContext) => void; note?: (ctx: BarContext) => void } = {};

export interface BarContext { anchor: string; label: string }
export interface BarHooks {
  /** The chapter's marks (for the recent styles). */
  chapterMarks(): DrawnMark[];
  /** A mark was made: draw it. `made` is what `wb mark add` answered. */
  drawn(made: any): void | Promise<void>;
  /** The bar is done: close it and clear the selection. */
  finish(): void;
  /** Add to…: the reader's own Add (T7 gives it its final form). */
  addTo(from: HTMLElement): void;
}

interface Style { kind: Kind; color: string; lines?: number; name?: string; label: string; style: string; quick?: boolean }
interface Legend { entries: any[]; unlisted: any[] }

const RECENT_KEY = 'wb.markRecent';
/** The styles last used, newest first, kept in the reader's own storage (a style is `kind:color[:lines]`); the chapter's marks fill in after. */
function recents(): string[] {
  try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(r) ? r : []; } catch { return []; }
}
function remember(style: string) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([style, ...recents().filter(s => s !== style)].slice(0, 40))); } catch { /* storage off */ }
}

const styleKey = (kind: string, color: string, lines?: number) => kind === 'underline' ? `${kind}:${color}:${lines ?? 1}` : `${kind}:${color}`;
const WORD = ['', '', 'double ', 'triple '];
function parseStyle(s: string): Style | null {
  const m = /^(highlight|underline|circle|box|arrow):([^:]+)(?::(\d))?$/.exec(s);
  if (!m) return null;
  const kind = m[1] as Kind, lines = m[3] ? +m[3] : undefined;
  return { kind, color: m[2], lines, label: `Unnamed ${m[2]} ${kind === 'underline' ? WORD[lines ?? 1] ?? '' : ''}${kind}`, style: s };
}
function fromEntry(e: any): Style {
  return { kind: e.kind, color: e.color, lines: e.lines, name: e.name, label: e.label || e.name || `Unnamed ${e.color} ${e.kind}`, style: e.style || styleKey(e.kind, e.color, e.lines), quick: !!e.quick };
}

/** A sample of a style: the same drawing the reader makes, small. Never a bare color dot. */
function sample(s: Style): HTMLElement {
  const e = h('i', `mb-sample s-${s.kind}`);
  const ink = inkOf(s.color);
  if (s.kind === 'highlight') e.style.background = /^#/.test(s.color) ? s.color : `var(--hl-${s.color}, ${ink})`;
  else if (s.kind === 'underline') for (let n = 0; n < (s.lines ?? 1); n++) { const l = h('b'); l.style.background = ink; l.style.height = `${[0, 3, 2, 1.5][s.lines ?? 1]}px`; e.append(l); }
  else if (s.kind === 'arrow') { e.textContent = '↗'; e.style.color = ink; }
  else e.style.borderColor = ink;
  return e;
}

function svg(path: string, size = 18): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('width', String(size));
  s.setAttribute('height', String(size));
  s.setAttribute('aria-hidden', 'true');
  s.classList.add('ico');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  s.append(p);
  return s;
}

export interface MarkBar {
  el: HTMLElement;
  /** A key pressed while the bar is open; true when the bar took it. */
  onKey(e: KeyboardEvent): boolean;
  /** The bar is going away; a pen waiting for its name is kept Unnamed (MK7-11). */
  dispose(): void;
}

export function createBar(ctx: BarContext, hooks: BarHooks): MarkBar {
  const el = h('div', 'markbar');
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Mark the selection');
  let menu: HTMLElement | null = null;
  let open: { kind: Kind | 'legend' } | null = null;
  let rows: Style[] = [];
  let lines = 1;
  let naming: { kind: Kind; color: string; lines?: number; done: boolean } | null = null;
  let busy = false;
  let legendP: Promise<Legend> | null = null;
  const legend = () => legendP ||= (wb(['legend']) as Promise<Legend>).then(l => ({ entries: l?.entries || [], unlisted: l?.unlisted || [] })).catch(() => ({ entries: [], unlisted: [] }));

  const buttons = new Map<Kind | 'legend' | 'add', HTMLButtonElement>();
  const button = (id: Kind | 'legend' | 'add', title: string, path: string, run: () => void) => {
    const b = h('button', `mb-btn mb-${id}`);
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.dataset.kind = id;
    b.append(svg(path));
    b.onclick = run;
    buttons.set(id, b);
    el.append(b);
    return b;
  };
  for (const k of KINDS) button(k.kind, `${k.name} (${k.key})`, k.path, () => pressKind(k.kind));
  el.append(h('span', 'mb-sep'));
  button('legend', 'Legend', LEGEND_PATH, () => toggle('legend'));
  el.append(h('span', 'mb-sep'));
  const add = button('add', 'Add to…', ADD_PATH, () => hooks.addTo(add));

  function closeMenu() {
    menu?.remove();
    menu = null;
    open = null;
    rows = [];
    for (const b of buttons.values()) b.classList.remove('on');
  }

  function showMenu(id: Kind | 'legend', m: HTMLElement) {
    menu?.remove();
    menu = m;
    open = { kind: id };
    for (const [k, b] of buttons) b.classList.toggle('on', k === id);
    m.classList.add('mb-menu');
    m.addEventListener('pointerdown', e => e.stopPropagation());
    el.append(m);
    const b = buttons.get(id)!;
    // from the icon, on the side away from the selection (the bar sets data-side), kept inside the window
    m.style.left = '0px';
    const w = m.offsetWidth, base = el.getBoundingClientRect().left;
    const want = Math.min(b.offsetLeft, Math.max(0, window.innerWidth - 8 - w - base));
    m.style.left = `${Math.max(want, 8 - base)}px`;
    // if it would leave the window on that side it opens on the other
    const r = m.getBoundingClientRect();
    m.classList.toggle('mb-flip', r.top < 8 || r.bottom > window.innerHeight - 8);
  }

  function toggle(id: Kind | 'legend') {
    if (open?.kind === id && !naming) return closeMenu();
    if (naming) void settle('');
    if (id === 'legend') void showLegend(); else void showKind(id as Kind);
  }

  function pressKind(kind: Kind) {
    if (kind === 'arrow' || kind === 'note') { kindHooks[kind === 'arrow' ? 'arrow' : 'note']?.(ctx); return; }   // T9, T10
    toggle(kind);
  }

  // ---- styles --------------------------------------------------------------------------------------------------------
  function recentOf(kind: Kind, data: Legend): Style[] {
    const known = new Map<string, Style>();
    for (const e of [...data.unlisted, ...data.entries]) known.set(e.style || styleKey(e.kind, e.color, e.lines), fromEntry(e));
    const seen: string[] = [];
    for (const s of recents()) if (!seen.includes(s)) seen.push(s);
    const fromChapter = [...hooks.chapterMarks()].filter(m => m.kind !== 'arrow').sort((a, b) => (a.created < b.created ? 1 : -1)).map(m => m.style || styleKey(m.kind, m.color, m.lines));
    for (const s of fromChapter) if (!seen.includes(s)) seen.push(s);
    return seen.filter(s => s.startsWith(`${kind}:`)).map(s => known.get(s) || parseStyle(s)).filter((s): s is Style => !!s);
  }

  async function lastStyle(kind: Kind): Promise<Style | undefined> { return recentOf(kind, await legend())[0]; }

  function row(s: Style, n?: number): HTMLButtonElement {
    const r = h('button', 'mb-row');
    r.type = 'button';
    r.dataset.style = s.style;
    r.append(sample(s), h('span', 'mb-name', s.label));
    if (s.quick) { const t = h('span', 'mb-tick'); t.title = 'A quick style'; t.append(svg('M3 8.5l3.5 3.5L13 4.5', 14)); r.append(t); }
    if (n) r.append(h('kbd', 'mb-n', String(n)));
    r.onclick = () => void applyStyle(s);
    return r;
  }

  function anyColor(kind: Kind, label = 'Any color…'): HTMLElement {
    const a = h('label', 'mb-any');
    const ring = h('i', 'mb-rainbow');
    const input = h('input') as HTMLInputElement;
    input.type = 'color';
    input.value = '#d9822b';
    input.setAttribute('aria-label', label);
    input.onchange = () => void newPen(kind, input.value.toLowerCase());
    a.append(ring, h('span', 'mb-name', label), input);
    return a;
  }

  function linesChoice(): HTMLElement {
    const g = h('div', 'mb-lines');
    g.setAttribute('role', 'group');
    [1, 2, 3].forEach(n => {
      const b = h('button', 'mb-line', n === 1 ? '1 line' : String(n));
      b.type = 'button';
      b.dataset.lines = String(n);
      b.setAttribute('aria-pressed', String(n === lines));
      b.onclick = () => { lines = n; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
      g.append(b);
    });
    return g;
  }

  async function showKind(kind: Kind) {
    open = { kind };
    const data = await legend();
    if (open?.kind !== kind) return;
    const entries = data.entries.filter(e => e.kind === kind).map(fromEntry);
    const pinned = entries.filter(s => s.quick);
    const have = new Set(pinned.map(s => s.style));
    const recent = recentOf(kind, data).filter(s => !have.has(s.style));
    recent.forEach(s => have.add(s.style));
    const rest = entries.filter(s => !have.has(s.style));
    rows = [...pinned, ...recent, ...rest].slice(0, 6);
    const m = h('div');
    m.dataset.menu = kind;
    if (kind === 'underline') m.append(linesChoice());
    rows.forEach((s, i) => m.append(row(s, i + 1)));
    if (rows.length) m.append(h('hr', 'mb-rule'));
    m.append(anyColor(kind));
    showMenu(kind, m);
  }

  async function showLegend(filter = '') {
    open = { kind: 'legend' };
    const data = await legend();
    if (open?.kind !== 'legend') return;
    const all = [...data.entries, ...data.unlisted].filter(e => e.kind !== 'arrow').map(fromEntry);
    const m = h('div');
    m.dataset.menu = 'legend';
    const input = h('input', 'mb-filter') as HTMLInputElement;
    input.type = 'text';
    input.placeholder = 'Find a style';
    input.setAttribute('aria-label', 'Find a style in the legend');
    input.value = filter;
    const list = h('div', 'mb-list');
    let at = 0;
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      rows = all.filter(s => !q || s.label.toLowerCase().includes(q) || s.kind.includes(q));
      at = Math.min(at, Math.max(0, rows.length - 1));
      list.replaceChildren(...rows.map((s, i) => { const r = row(s); r.classList.toggle('cur', i === at); return r; }));
      if (!rows.length) list.append(h('div', 'mb-empty', 'No style by that name'));
    };
    input.oninput = () => { at = 0; draw(); };
    input.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (rows[at]) void applyStyle(rows[at]); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); at = Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1))); draw(); }
    };
    const fresh = h('button', 'mb-row mb-newpen');
    fresh.type = 'button';
    fresh.append(svg(ADD_PATH, 14), h('span', 'mb-name', 'New pen…'));
    fresh.onclick = () => showNewPen();
    m.append(input, list, h('hr', 'mb-rule'), fresh);
    draw();
    showMenu('legend', m);
    input.focus();
  }

  /** New pen… from the Legend: a kind, then Any color…. */
  function showNewPen() {
    let kind: Kind = 'highlight';
    const m = h('div');
    m.dataset.menu = 'newpen';
    const seg = h('div', 'mb-kinds');
    const colorSlot = h('div');
    const fill = () => { colorSlot.replaceChildren(...(kind === 'underline' ? [linesChoice()] : []), anyColor(kind, 'Pick a color…')); };
    DROPS.forEach(k => {
      const b = h('button', 'mb-kindpick', KINDS.find(x => x.kind === k)!.name);
      b.type = 'button';
      b.dataset.kind = k;
      b.setAttribute('aria-pressed', String(k === kind));
      b.onclick = () => { kind = k; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); fill(); };
      seg.append(b);
    });
    fill();
    m.append(seg, colorSlot);
    showMenu('legend', m);
    m.dataset.menu = 'newpen';
  }

  // ---- making marks --------------------------------------------------------------------------------------------------
  const argsOf = (s: { kind: string; color: string; lines?: number; name?: string }) =>
    s.name ? ['--style', s.name] : ['--kind', s.kind, '--color', s.color, ...(s.kind === 'underline' ? ['--lines', String(s.lines ?? 1)] : [])];

  async function made(s: { kind: string; color: string; lines?: number; name?: string }): Promise<boolean> {
    try {
      const out = await wb(['mark', 'add', ctx.anchor, ...argsOf(s)]);
      remember(styleKey(s.kind, s.color, s.lines));
      await hooks.drawn(out);
      return true;
    } catch (err) {
      toast(String((err as Error)?.message ?? err));
      return false;
    }
  }

  async function applyStyle(s: Style) {
    if (busy) return;
    busy = true;
    const ok = await made(s);
    busy = false;
    if (ok) hooks.finish();
  }

  async function newPen(kind: Kind, color: string) {
    if (busy) return;
    const l = kind === 'underline' ? lines : undefined;
    const key = styleKey(kind, color, l);
    const data = await legend();
    const known = data.entries.find(e => (e.style || styleKey(e.kind, e.color, e.lines)) === key);
    if (known) return void applyStyle(fromEntry(known));
    busy = true;
    const ok = await made({ kind, color, lines: l });
    busy = false;
    if (!ok) return;
    naming = { kind, color, lines: l, done: false };
    const m = h('div', 'mb-naming');
    m.dataset.menu = 'naming';
    const head = h('div', 'mb-row mb-fixed');
    head.append(sample({ kind, color, lines: l, label: '', style: key }), h('span', 'mb-name', 'Name this pen'));
    const input = h('input', 'mb-pen') as HTMLInputElement;
    input.type = 'text';
    input.placeholder = 'Name this pen';
    input.setAttribute('aria-label', 'Name this pen');
    input.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); void settle(input.value); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); void settle(''); }
    };
    m.append(head, input, h('div', 'mb-hint', 'Enter keeps the name; Esc leaves it Unnamed.'));
    showMenu(kind, m);
    input.focus();
  }

  /** The pen's name is given (or left): the entry is added to the legend, then the bar closes. */
  async function settle(name: string, close = true) {
    const n = naming;
    if (!n || n.done) return;
    n.done = true;
    naming = null;
    const text = name.trim();
    try {
      await wb(['legend', 'add', '--kind', n.kind, '--color', n.color, ...(n.kind === 'underline' ? ['--lines', String(n.lines ?? 1)] : []), ...(text ? ['--name', text] : [])]);
    } catch (err) {
      toast(String((err as Error)?.message ?? err));
    }
    if (close) hooks.finish();
  }

  // ---- keys ----------------------------------------------------------------------------------------------------------
  function onKey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if ((e.target as HTMLElement | null)?.closest?.('input:not([type=color]), textarea, [contenteditable]')) return false;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const kind = KINDS.find(x => x.key.toLowerCase() === k);
    if (kind) {
      if (kind.kind === 'arrow' || kind.kind === 'note') { kindHooks[kind.kind === 'arrow' ? 'arrow' : 'note']?.(ctx); return true; }
      if (open?.kind === kind.kind && !naming) void lastStyle(kind.kind).then(s => { if (s) void applyStyle(s); });   // a kind's key twice: its last style
      else pressKind(kind.kind);
      return true;
    }
    if (/^[1-6]$/.test(k) && open && open.kind !== 'legend' && !naming) {
      const s = rows[+k - 1];
      if (s) void applyStyle(s);
      return true;
    }
    return false;
  }

  return { el, onKey, dispose: () => { void settle('', false); } };
}
