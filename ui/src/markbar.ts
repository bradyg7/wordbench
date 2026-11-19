// The mark bar (design/features/marks T6, MK7-8 to MK7-12, MK7-16, MK7-24, MK7-30, MK7-31; rows 1, 4 to 10, 20 to 22, 24).
// Words are selected: a bar of icons only sits just above them: six kinds (the name and key on hover), a divider, the
// Legend, a divider, Add to…. A click on Highlight, Underline, Circle or Box opens a small drop-down from that icon, on
// the side away from the selection: that kind's styles by name (the person's quick ones pinned with a tick, then the
// recent ones, six at most, numbered), then Any color…. A color no legend entry has is drawn at once and asks for its
// name in the drop-down ("New pen", MK7-11). The Legend icon opens the whole legend with a filter. The bar never grows
// with the legend. Arrow (T9) and Margin note (T10) are plugged into `kindHooks` by main.ts.
//
// Marks are made with `wb mark add` (--style for a legend entry, or --kind, --color and --lines) and entries with
// `wb legend add`; this file draws nothing itself, it asks `hooks.drawn` to show the mark that came back.
import { wb, type DrawnMark } from './api';
import { h } from './ui';
import { toast, compact } from './sheets';
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
const COPY_PATH = 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3';
const TAB_PATH = 'M2.5 4.5h4l1.5 1.5h5.5v7.5h-11zM9 2.5h4.5V7';
const MORE_PATH = 'M3 8h.01M8 8h.01M13 8h.01';
const CHEV_PATH = 'M6 3.5L10.5 8 6 12.5';

/** Where Arrow (T9) and Margin note (T10) plug in (main.ts sets both): the icons, the keys A and N and the right-click menu's rows call them. */
export const kindHooks: { arrow?: (ctx: BarContext) => void; note?: (ctx: BarContext) => void } = {};

export interface BarContext { anchor: string; label: string }
export interface BarHooks {
  /** The chapter's marks (for the recent styles). */
  chapterMarks(): DrawnMark[];
  /** A mark was made: draw it. `made` is what `wb mark add` answered. */
  drawn(made: any): void | Promise<void>;
  /** The bar is done: close it and clear the selection. */
  finish(): void;
  /** Add to…: a page, a folder or a save. */
  addTo(from: HTMLElement): void;
  /** Copy: the selected words with their reference; true when it was copied. */
  copy(): Promise<boolean> | boolean;
  /** Open as a tab: the selection's verses in a new reader tab. */
  openTab(): void;
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

/** The legend as the bar and the mark card read it. */
async function readLegend(): Promise<Legend> {
  try { const l = await wb(['legend']); return { entries: l?.entries || [], unlisted: l?.unlisted || [] }; } catch { return { entries: [], unlisted: [] }; }
}

/** The styles of a kind, newest used first: the reader's own storage, then the chapter's marks. */
function recentOf(kind: Kind, data: Legend, chapterMarks: DrawnMark[]): Style[] {
  const known = new Map<string, Style>();
  for (const e of [...data.unlisted, ...data.entries]) known.set(e.style || styleKey(e.kind, e.color, e.lines), fromEntry(e));
  const seen: string[] = [];
  for (const s of recents()) if (!seen.includes(s)) seen.push(s);
  const fromChapter = [...chapterMarks].filter(m => m.kind !== 'arrow').sort((a, b) => (a.created < b.created ? 1 : -1)).map(m => m.style || styleKey(m.kind, m.color, m.lines));
  for (const s of fromChapter) if (!seen.includes(s)) seen.push(s);
  return seen.filter(s => s.startsWith(`${kind}:`)).map(s => known.get(s) || parseStyle(s)).filter((s): s is Style => !!s);
}

function rowOf(s: Style, n: number | undefined, pick: (s: Style) => void): HTMLButtonElement {
  const r = h('button', 'mb-row');
  r.type = 'button';
  r.dataset.style = s.style;
  r.append(sample(s), h('span', 'mb-name', s.label));
  if (s.quick) { const t = h('span', 'mb-tick'); t.title = 'A quick style'; t.append(svg('M3 8.5l3.5 3.5L13 4.5', 14)); r.append(t); }
  if (n) r.append(h('kbd', 'mb-n', String(n)));
  r.onclick = () => pick(s);
  return r;
}

function anyColorOf(label: string, onColor: (color: string) => void): HTMLElement {
  const a = h('label', 'mb-any');
  const ring = h('i', 'mb-rainbow');
  const input = h('input') as HTMLInputElement;
  input.type = 'color';
  input.value = '#d9822b';
  input.setAttribute('aria-label', label);
  input.onchange = () => onColor(input.value.toLowerCase());
  a.append(ring, h('span', 'mb-name', label), input);
  return a;
}

function linesOf(get: () => number, set: (n: number) => void): HTMLElement {
  const g = h('div', 'mb-lines');
  g.setAttribute('role', 'group');
  [1, 2, 3].forEach(n => {
    const b = h('button', 'mb-line', n === 1 ? '1 line' : String(n));
    b.type = 'button';
    b.dataset.lines = String(n);
    b.setAttribute('aria-pressed', String(n === get()));
    b.onclick = () => { set(n); g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
    g.append(b);
  });
  return g;
}

interface KindEnv {
  legend(): Promise<Legend>;
  chapterMarks(): DrawnMark[];
  pick(s: Style): void;
  anyPick(kind: Kind, color: string, lines: number | undefined): void;
  getLines(): number;
  setLines(n: number): void;
  setRows?(r: Style[]): void;
}

/** A kind's styles as rows: the person's quick ones pinned with a tick, then the recent ones, six at most, numbered, then Any color…. */
async function kindMenu(kind: Kind, env: KindEnv): Promise<HTMLElement> {
  const data = await env.legend();
  const entries = data.entries.filter(e => e.kind === kind).map(fromEntry);
  const pinned = entries.filter(s => s.quick);
  const have = new Set(pinned.map(s => s.style));
  const recent = recentOf(kind, data, env.chapterMarks()).filter(s => !have.has(s.style));
  recent.forEach(s => have.add(s.style));
  const rest = entries.filter(s => !have.has(s.style));
  const rows = [...pinned, ...recent, ...rest].slice(0, 6);
  env.setRows?.(rows);
  const m = h('div');
  m.dataset.menu = kind;
  if (kind === 'underline') m.append(linesOf(env.getLines, env.setLines));
  rows.forEach((s, i) => m.append(rowOf(s, i + 1, env.pick)));
  if (rows.length) m.append(h('hr', 'mb-rule'));
  m.append(anyColorOf('Any color…', c => env.anyPick(kind, c, kind === 'underline' ? env.getLines() : undefined)));
  return m;
}

/** What the mark card's Change shows (row 27): the same drop-down as the bar's for that kind; a pick is handed back as a kind, color and lines. */
export async function changeMenu(kind: Kind, chapterMarks: () => DrawnMark[], pick: (s: { kind: Kind; color: string; lines?: number }) => void): Promise<HTMLElement> {
  let lines = 1;
  return kindMenu(kind, {
    legend: readLegend, chapterMarks,
    pick: s => pick({ kind: s.kind, color: s.color, lines: s.kind === 'underline' ? s.lines ?? 1 : undefined }),
    anyPick: (k, c, l) => pick({ kind: k, color: c, lines: l }),
    getLines: () => lines, setLines: n => { lines = n; },
  });
}

/** The same small drawing the bar's rows have: a style's sample, for the mark card. */
export const sampleOf = (kind: Kind, color: string, lines?: number): HTMLElement => sample({ kind, color, lines, label: '', style: styleKey(kind, color, lines) });

export interface MarkBar {
  el: HTMLElement;
  /** A key pressed while the bar is open; true when the bar took it. */
  onKey(e: KeyboardEvent): boolean;
  /** The right-click menu (MK7-34) at the pointer; the bar hides while it is open. */
  openContext(x: number, y: number): void;
  /** The bar is going away; a pen waiting for its name is kept Unnamed (MK7-11). */
  dispose(): void;
}

export function createBar(ctx: BarContext, hooks: BarHooks): MarkBar {
  const el = h('div', 'markbar');
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Mark the selection');
  let menu: HTMLElement | null = null;
  let open: { kind: Kind | 'legend' | 'more' } | null = null;
  let rows: Style[] = [];
  let lines = 1;
  let naming: { kind: Kind; color: string; lines?: number; done: boolean } | null = null;
  let busy = false;
  let legendP: Promise<Legend> | null = null;
  let legendData: Legend | null = null;
  const legend = () => legendP ||= readLegend().then(l => (legendData = l));
  void legend();   // read at once, so Ctrl+1 to Ctrl+9 know their styles

  type Id = Kind | 'legend' | 'add' | 'copy' | 'tab' | 'more';
  const buttons = new Map<Id, HTMLButtonElement>();
  const button = (id: Id, title: string, path: string, run: () => void) => {
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
  el.append(h('span', 'mb-sep'));
  // MK7-32: Copy and Open as a tab are icons after Add to…; on a phone they sit behind ⋯ so the targets stay 44 px
  const phone = compact();
  if (phone) button('more', 'More', MORE_PATH, () => toggle('more'));
  else {
    button('copy', 'Copy', COPY_PATH, () => void doCopy('copy'));
    button('tab', 'Open as a tab', TAB_PATH, () => hooks.openTab());
  }

  /** Copy, and say so for a moment beside the icon that was used. */
  async function doCopy(from: Id) {
    let ok = false;
    try { ok = await hooks.copy(); } catch { ok = false; }
    if (!ok) return;
    const b = buttons.get(from === 'copy' ? 'copy' : 'more')!;
    const t = b.title;
    b.title = 'Copied';
    el.querySelector('.mb-flash')?.remove();
    const f = h('span', 'mb-flash', 'Copied');
    f.setAttribute('role', 'status');
    f.style.left = `${b.offsetLeft + b.offsetWidth / 2}px`;
    el.append(f);
    setTimeout(() => { f.remove(); b.title = t; }, 1400);
  }

  function closeMenu() {
    menu?.remove();
    menu = null;
    open = null;
    rows = [];
    for (const b of buttons.values()) b.classList.remove('on');
  }

  function showMenu(id: Kind | 'legend' | 'more', m: HTMLElement) {
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

  function toggle(id: Kind | 'legend' | 'more') {
    if (open?.kind === id && !naming) return closeMenu();
    if (naming) void settle('');
    if (id === 'legend') void showLegend(); else if (id === 'more') showMore(); else void showKind(id as Kind);
  }

  function pressKind(kind: Kind) {
    if (kind === 'arrow' || kind === 'note') { kindHooks[kind === 'arrow' ? 'arrow' : 'note']?.(ctx); return; }   // T9, T10
    toggle(kind);
  }

  // ---- styles --------------------------------------------------------------------------------------------------------
  async function lastStyle(kind: Kind): Promise<Style | undefined> { return recentOf(kind, await legend(), hooks.chapterMarks())[0]; }

  const row = (s: Style, n?: number) => rowOf(s, n, s2 => void applyStyle(s2));
  const anyColor = (kind: Kind, label = 'Any color…') => anyColorOf(label, c => void newPen(kind, c));
  const linesChoice = () => linesOf(() => lines, n => { lines = n; });

  /** A kind's styles as rows (also the right-click menu's submenu). `rows` is left holding them, for the number keys. */
  const buildKind = (kind: Kind): Promise<HTMLElement> => kindMenu(kind, {
    legend, chapterMarks: hooks.chapterMarks, pick: s => void applyStyle(s), anyPick: (k, c) => void newPen(k, c),
    getLines: () => lines, setLines: n => { lines = n; }, setRows: r => { rows = r; },
  });

  async function showKind(kind: Kind) {
    open = { kind };
    const m = await buildKind(kind);
    if (open?.kind !== kind) return;
    showMenu(kind, m);
  }

  /** ⋯ on a phone: Copy and Open as a tab. */
  function showMore() {
    open = { kind: 'more' };
    const m = h('div');
    m.dataset.menu = 'more';
    const item = (label: string, path: string, run: () => void) => {
      const r = h('button', 'mb-row');
      r.type = 'button';
      r.append(svg(path, 16), h('span', 'mb-name', label));
      r.onclick = run;
      m.append(r);
    };
    item('Copy', COPY_PATH, () => { closeMenu(); void doCopy('more'); });
    item('Open as a tab', TAB_PATH, () => { closeMenu(); hooks.openTab(); });
    showMenu('more', m);
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
    const typing = !!(e.target as HTMLElement | null)?.closest?.('input:not([type=color]), textarea, [contenteditable]');
    if (cm) return cmKey(e);
    // Ctrl+1 to Ctrl+9: the style the Legend assigns to that key (row 23); Ctrl+C: Copy
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && !typing) {
      if (/^[1-9]$/.test(e.key)) {
        const go = (l: Legend) => { const en = l.entries.find(x => x.key && String(x.key).toLowerCase() === `ctrl+${e.key}`); if (en) void applyStyle(fromEntry(en)); return !!en; };
        if (legendData) return go(legendData);
        void legend().then(go);
        return true;
      }
      if (e.key.toLowerCase() === 'c' && !String(window.getSelection() || '')) { void doCopy(phone ? 'more' : 'copy'); return true; }
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (typing) return false;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const kind = KINDS.find(x => x.key.toLowerCase() === k);
    if (kind) {
      if (kind.kind === 'arrow' || kind.kind === 'note') { kindHooks[kind.kind === 'arrow' ? 'arrow' : 'note']?.(ctx); return true; }
      if (open?.kind === kind.kind && !naming) void lastStyle(kind.kind).then(s => { if (s) void applyStyle(s); });   // a kind's key twice: its last style
      else pressKind(kind.kind);
      return true;
    }
    if (/^[1-6]$/.test(k) && open && open.kind !== 'legend' && open.kind !== 'more' && !naming) {
      const s = rows[+k - 1];
      if (s) void applyStyle(s);
      return true;
    }
    return false;
  }

  // ---- the right-click menu (MK7-34) ---------------------------------------------------------------------------------
  // The same actions as the bar, as named rows with their keys. A kind opens its styles as a submenu (the bar's own rows,
  // built by buildKind). The bar hides while it is open.
  interface Cm { box: HTMLElement; rows: HTMLElement[]; cur: number; sub: HTMLElement | null; subKind: Kind | null; subCur: number; seq: number; off: () => void }
  let cm: Cm | null = null;

  function closeCtx() {
    if (!cm) return;
    cm.off();
    cm.box.remove();
    cm = null;
    open = null;
    rows = [];
    el.style.visibility = '';
  }

  function openContext(x: number, y: number) {
    closeMenu();
    closeCtx();
    const box = h('div', 'mb-ctx');
    box.setAttribute('role', 'menu');
    box.addEventListener('pointerdown', e => e.stopPropagation());
    const c: Cm = { box, rows: [], cur: -1, sub: null, subKind: null, subCur: -1, seq: 0, off: () => {} };
    const mk = (act: string, label: string, path: string, key?: string, chev = false, run?: () => void) => {
      const r = h('button', 'mb-row mb-crow');
      r.type = 'button';
      r.dataset.act = act;
      r.setAttribute('role', 'menuitem');
      r.append(svg(path, 16), h('span', 'mb-name', label));
      if (key) r.append(h('kbd', 'mb-key', key));
      if (chev) r.append(svg(CHEV_PATH, 12));
      r.onmouseenter = () => { setCur(c.rows.indexOf(r)); if (chev) void showSub(act as Kind); else hideSub(); };
      r.onclick = () => { if (chev) void showSub(act as Kind); else run?.(); };
      c.rows.push(r);
      box.append(r);
    };
    for (const k of KINDS) {
      const hook = k.kind === 'arrow' ? 'arrow' : k.kind === 'note' ? 'note' : null;
      mk(k.kind, k.name, k.path, k.key, DROPS.includes(k.kind), () => { const f = hook && kindHooks[hook]; if (f) { closeCtx(); f(ctx); } });
    }
    box.append(h('hr', 'mb-rule'));
    mk('legend', 'Legend…', LEGEND_PATH, undefined, false, () => { closeCtx(); toggle('legend'); });
    mk('add', 'Add to…', ADD_PATH, undefined, false, () => { closeCtx(); hooks.addTo(add); });
    box.append(h('hr', 'mb-rule'));
    mk('copy', 'Copy', COPY_PATH, 'Ctrl+C', false, () => { closeCtx(); void doCopy(phone ? 'more' : 'copy'); });
    mk('tab', 'Open as a tab', TAB_PATH, undefined, false, () => { closeCtx(); hooks.openTab(); });
    document.getElementById('overlay')!.append(box);
    const out = (e: PointerEvent) => { if (!box.contains(e.target as Node)) closeCtx(); };
    setTimeout(() => { if (cm === c) document.addEventListener('pointerdown', out, true); });
    c.off = () => document.removeEventListener('pointerdown', out, true);
    cm = c;
    // beside the pointer, kept inside the window
    const w = box.offsetWidth, hh = box.offsetHeight;
    box.style.left = `${Math.max(8, Math.min(x + 2, window.innerWidth - w - 8))}px`;
    box.style.top = `${Math.max(8, Math.min(y + 2, window.innerHeight - hh - 8))}px`;
    el.style.visibility = 'hidden';
  }

  function setCur(i: number) {
    if (!cm) return;
    cm.cur = i;
    cm.rows.forEach((r, n) => r.classList.toggle('cur', n === i));
  }
  function hideSub() {
    if (!cm) return;
    cm.seq++;
    cm.sub?.remove();
    cm.sub = null;
    cm.subKind = null;
    cm.subCur = -1;
    open = null;
    rows = [];
  }
  async function showSub(kind: Kind) {
    const c = cm;
    if (!c || c.subKind === kind) return;
    hideSub();
    const seq = ++c.seq;
    open = { kind };
    const m = await buildKind(kind);
    if (cm !== c || c.seq !== seq) return;
    m.classList.add('mb-sub');
    m.addEventListener('pointerdown', e => e.stopPropagation());
    c.sub = m;
    c.subKind = kind;
    c.box.append(m);
    const row = c.rows.find(r => r.dataset.act === kind)!;
    const at = c.box.getBoundingClientRect(), rr = row.getBoundingClientRect();
    const room = window.innerWidth - at.right - 8 >= m.offsetWidth;
    m.style.left = room ? `${at.width + 2}px` : `${-m.offsetWidth - 2}px`;
    const top = Math.min(rr.top - at.top, window.innerHeight - 8 - m.offsetHeight - at.top);
    m.style.top = `${Math.max(top, 8 - at.top)}px`;
  }
  const subRows = (): HTMLElement[] => cm?.sub ? [...cm.sub.querySelectorAll<HTMLElement>('.mb-row')] : [];
  function cmKey(e: KeyboardEvent): boolean {
    const c = cm!;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const inSub = c.subCur >= 0;
    const mark = (list: HTMLElement[], i: number) => list.forEach((r, n) => r.classList.toggle('cur', n === i));
    if (e.key === 'Escape') { closeCtx(); return true; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const d = e.key === 'ArrowDown' ? 1 : -1;
      if (inSub) { const l = subRows(); c.subCur = (c.subCur + d + l.length) % l.length; mark(l, c.subCur); }
      else { setCur((c.cur + d + c.rows.length) % c.rows.length); hideSub(); }
      return true;
    }
    if (e.key === 'ArrowRight' && !inSub && c.cur >= 0 && DROPS.includes(c.rows[c.cur].dataset.act as Kind)) {
      void showSub(c.rows[c.cur].dataset.act as Kind).then(() => { if (cm === c && c.sub) { c.subCur = 0; mark(subRows(), 0); } });
      return true;
    }
    if (e.key === 'ArrowLeft' && inSub) { c.subCur = -1; mark(subRows(), -1); return true; }
    if (e.key === 'Enter' || e.key === ' ') {
      if (inSub) subRows()[c.subCur]?.click();
      else if (c.cur >= 0) c.rows[c.cur].click();
      return true;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const kind = KINDS.find(x => x.key.toLowerCase() === k);
    if (kind) { setCur(c.rows.findIndex(r => r.dataset.act === kind.kind)); if (DROPS.includes(kind.kind)) void showSub(kind.kind); else hideSub(); return true; }
    if (/^[1-6]$/.test(k) && c.sub && rows[+k - 1]) void applyStyle(rows[+k - 1]);
    return true;   // the menu is modal: no other key reaches the reader while it is open
  }

  return { el, onKey, openContext, dispose: () => { closeCtx(); void settle('', false); } };
}
