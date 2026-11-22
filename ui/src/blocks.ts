// A page written block by block (W3 of "The Notebook as a workspace", sheet W2; the person's decisions of 2026-11-07:
// block by block, each list item its own block). Each block is drawn as it reads; a click edits that block's Markdown in
// place, and only that block. Enter at a block's end starts a new one (a list goes on as a list); Backspace in an empty
// block removes it; ↑ at a block's start and ↓ at its end go to the block before or after; Esc ends the writing. `/` in
// an empty block opens the block menu. A block is dragged by its grip. Every change is a `wb block …` command: the
// splitting into blocks and the lines around them are wb-core's (pages.rs), never this file's.
import { wb } from './api';
import { registerPageWriter } from './pagewriters';
import { app, here } from './app';
import { toast } from './sheets';
import { button, h, icon, placePill, popMenu, type Found } from './ui';
import { drawVerses, openSplit, verseCard, type MarkedVerse } from './verses';
import { chapterMarks, drawWords, hasWords, type PageVerse } from './pagescripture';
import { threadChooser } from './panes';
import { openMenu, type MenuGroup, type MenuItem } from './menu';
import { atMenu } from './atmenu';
import { openChapterPanel } from './chapterpanel';
import { scriptureField } from './scripturefield';
import { caretAt, caretLine, chipRefs, clearShape, contentStart, continuation, createEditor, indentList, insertBreak, insertPlain, inlineShortcut, isEmpty, lineStartShortcut, shapeOf, splitAtCaret, tidy, toggleMark, turnedMd, undoTurn, type Turn, type Writer } from './blockedit';
import { isToggleEnd, placeBlocks, toggleHead, toggleOf, wrapHead } from './toggles';
import { KINDS, installSelectionBar, selectionBarBusy, shapeProps } from './selbar';
import { COLORS, label as colorLabel } from './palette';
import { bgOf, takesBackground } from './blockbg';
import { columnGroups, isMarker, MAX_COLUMNS, type Group } from './columns';
import { applyPicks, clearPick, installPicking, pick as pickBlocks, pickedRun } from './blockpick';

export interface Blk { n: number; bid?: string; kind: string; text: string; start: number; end: number; level?: number; checked?: boolean; lang?: string; indent?: number; question?: { done: boolean; text: string } }
export interface Blocks { id: string; title: { text: string; start: number; end: number } | null; blocks: Blk[]; /** the folded toggles, each named by its head's text (settings/pages.json) */ folds?: string[] }
export interface LinkAt { start: number; end: number }

/** What the Notebook lends the blocks: drawing Markdown, the [[link]] list, and redrawing after a change. */
export interface Host {
  state: BlockEditorState;
  render(text: string, refs: Found[], links: any[]): DocumentFragment;
  text: string;
  refs: Found[];
  links: any[];
  linkSuggest(ta: Writer): void;
  /** Every page, day and folder with a title: what the @ menu offers besides a verse. */
  titles(): Promise<{ id: string; title: string; insert: string; kind: string }[]>;
  maybeSuggest(ta: Writer): void;
  suggestKey(ev: KeyboardEvent): boolean;
  /** Something was written: the panes that show notes are drawn again. */
  changed(): void;
  /** Draw the page again (after the writing ends). */
  redraw(): void;
  /** A page inside this one, its link written where the block was. */
  pageInside(title: string, after: number | null): Promise<void>;
  /** Open a note (a view's row). */
  open(id: string): void;
  /** W5: the page is a template: `{` offers the blanks, and its blanks are shown as blanks. */
  template?: boolean;
  questionPlaces?: { anchor: string; label: string }[];
  /** When the page was last written (its `updated`): the block menu's foot says "Edited …". */
  updated?: string;
}

/** Pending input belongs to one editor. Its data is refreshed separately on each draw. */
type BlockFocus = { n: number; at: 'start' | 'end' | number } | { after: number; text: string } | null;
type BlockData = { id: string; got: Promise<any> } | null;
export interface BlockEditorState {
  focus: BlockFocus;
  pending: { id: string; after: () => number; text: string; at?: 'start' | 'end'; pick?: string; menu?: boolean } | null;
  menuKey: ((ev: KeyboardEvent) => boolean) | null;
  menuClose: (() => void) | null;
  scripture: BlockData;
  views: BlockData;
  threads: BlockData;
  words: BlockData;
}
export const createBlockEditorState = (): BlockEditorState => ({
  focus: null, pending: null, menuKey: null, menuClose: null,
  scripture: null, views: null, threads: null, words: null,
});


interface BlockHistory {
  page: string;
  undo: { token: string; n: number; after?: () => Promise<void> }[];
  focus?: number;
  visual?: number;
  busy?: boolean;
}

const blockHistory = new WeakMap<HTMLElement, BlockHistory>();

function historyFor(root: HTMLElement, page: string): BlockHistory {
  let history = blockHistory.get(root);
  if (history?.page !== page) {
    history = { page, undo: [] };
    blockHistory.set(root, history);
  }
  return history;
}

async function undoRemoval(root: HTMLElement | null, data: Blocks, host: Host) {
  if (!root) return;
  const history = historyFor(root, data.id);
  const entry = history.undo.at(-1);
  if (!entry || history.busy) return;
  history.busy = true;
  try {
    await wb(['block', 'undo', data.id, '-'], entry.token);
    history.undo.pop();
    await entry.after?.();
    history.focus = entry.n;
    host.changed();
  } catch (x) { toast(String(x)); }
  finally { history.busy = false; }
}

async function removeBlock(root: HTMLElement | null, data: Blocks, host: Host, n: number, count = 1, expected?: string): Promise<boolean> {
  if (!root) return false;
  const history = historyFor(root, data.id);
  if (history.busy) return false;
  history.busy = true;
  try {
    const result = await wb(['block', 'rm', data.id, String(n), '--count', String(count), '--undo', ...(expected === undefined ? [] : ['--expect', expected])]);
    history.undo.push({ token: JSON.stringify(result.undo), n });
    history.focus = Math.min(n, result.blocks.length);
    host.changed();
    return true;
  } catch (x) { toast(String(x)); return false; }
  finally { history.busy = false; }
}

/** The Undo toast after a block change (trash T9): 10 seconds, in the same rail as a page's. "Deleted · Undo" for a deletion
 *  (notebook row 20), "Joined · Undo" for a Backspace that joined two blocks. A block is part of its page, so it never goes to the Trash. */
function blockUndoToast(root: HTMLElement | null, data: Blocks, host: Host, said = 'Deleted', times = 1) {
  let rail = document.querySelector<HTMLElement>('.page-deletions');
  if (!rail) { rail = h('div', 'page-deletions'); rail.setAttribute('aria-label', 'Page deletion Undo'); document.body.append(rail); }
  rail.querySelectorAll('.block-deletion').forEach(x => x.remove());
  const row = h('div', 'page-deletion block-deletion');
  row.setAttribute('role', 'status');
  const undo = button('btn small', 'Undo', () => { row.remove(); void (async () => { for (let i = 0; i < times; i++) await undoRemoval(root, data, host); })(); });
  row.append(h('span', '', `${said} · `), undo);
  rail.append(row);
  setTimeout(() => row.remove(), 10000);
}

/** Is this block's writing nothing but a list's mark ("- ", "- [ ] ", "2. ")? */
// A block with only its marker is empty: a list item or to-do, a quote (`>`), a heading (`#`). A divider (`---`) and a
// table are never empty; a lone `-` is an empty item, `---` is not.
const blank = (t: string) => !t.replace(/^\s*(([-*+]|\d+[.)])(\s+\[[ xX]\])?|(>\s*)+|#{1,6})(\s+|$)/, '').trim();

// ---- drawing ------------------------------------------------------------------------------------------------------------

/** The page's blocks, each drawn as it reads, with a grip to drag it; and a line under them to write a new one. */
export function drawBlocks(data: Blocks, host: Host): HTMLElement {
  const wrap = h('div', 'nb-page nb-blocks');
  wrap.dataset.id = data.id;
  host.state.scripture = data.blocks.some(isScripture) ? { id: data.id, got: wb(['page', 'scripture', data.id]) } : null;
  host.state.scripture?.got.catch(() => {});
  host.state.views = data.blocks.some(isView) ? { id: data.id, got: wb(['page', 'views', data.id]) } : null;
  host.state.views?.got.catch(() => {});
  host.state.threads = data.blocks.some(isThread) ? { id: data.id, got: wb(['page', 'threads', data.id]) } : null;
  host.state.threads?.got.catch(() => {});
  host.state.words = data.blocks.some(isWord) ? { id: data.id, got: wb(['page', 'words', data.id]) } : null;
  host.state.words?.got.catch(() => {});
  installSelectionBar();
  const places = placeBlocks(data.blocks);
  // columns (rows 15, 44): blocks between the markers of a balanced group are drawn side by side; the markers are blocks of
  // the page too (they keep their numbers) but are not drawn: the opening one starts the first column, each `<!-- column -->`
  // ends one, and the closing one ends the last, so a block added below the last of a column stays in it
  const groups = columnGroups(data.blocks);
  const groupOf = (n: number): Group | undefined => groups.find(g => n >= g.open && n <= g.close);
  let grid: HTMLElement | null = null, column: HTMLElement | null = null;
  for (const b of data.blocks) {
    const el = blockEl(data, b, host);
    const p = places.get(b.n)!;
    el.style.setProperty('--td', String(p.role === 'end' ? p.inside.length - 1 : p.inside.length));
    if (p.role === 'head') {
      el.classList.add('nb-toggle');
      el.insertBefore(toggleTriangle(data, b, host), el.querySelector('.nb-block-body'));
    } else if (p.role === 'end') el.classList.add('nb-toggle-end');
    const g = groupOf(b.n);
    if (g && isMarker(b.text)) {
      el.classList.add('nb-col-marker');
      if (b.n === g.open) {
        grid = h('div', 'nb-columns');
        grid.style.setProperty('--cols', String(Math.min(g.seps.length + 1, MAX_COLUMNS)));
        grid.dataset.columns = String(g.seps.length + 1);
        column = h('div', 'nb-column');
        grid.append(column);
        wrap.append(grid);
      }
      column?.append(el);
      if (g.seps.includes(b.n) && grid) { column = h('div', 'nb-column'); grid.append(column); }
      if (b.n === g.close) { grid = null; column = null; }
      continue;
    }
    (column ?? wrap).append(el);
  }
  applyFolds(wrap, data);
  const add = h('button', 'link-btn nb-block-add muted', data.blocks.length ? 'Write here, or type / for a block' : 'Write the page here, or type / for a block');
  add.onclick = () => startNew(data, host, add, data.blocks.length ? data.blocks[data.blocks.length - 1].n : 0, '');
  wrap.append(add);
  return wrap;
}

// ---- toggles (row 9) -----------------------------------------------------------------------------------------------------

/** Show each toggle folded or open, and hide what is inside a folded one. Folded is the window's, not the page's (settings/pages.json). */
function applyFolds(wrap: HTMLElement, data: Blocks) {
  const places = placeBlocks(data.blocks);
  const folds = data.folds ?? [];
  const textOf = new Map(data.blocks.map(b => [b.n, b.text]));
  for (const b of data.blocks) {
    const el = wrap.querySelector<HTMLElement>(`.nb-block[data-n="${b.n}"]`);
    const p = places.get(b.n);
    if (!el || !p) continue;
    el.classList.toggle('nb-folded', p.inside.some(n => folds.includes(textOf.get(n) ?? '')));
    if (p.role === 'head') {
      const folded = folds.includes(b.text);
      el.classList.toggle('folded', folded);
      el.querySelector('.nb-toggle-tri')?.setAttribute('aria-expanded', String(!folded));
    }
  }
}

/** Fold or unfold the toggle whose head is block `n`; the page is not drawn again. */
async function setFold(data: Blocks, host: Host, wrap: HTMLElement | null, n: number, headText: string, fold: boolean) {
  const folds = (data.folds ??= []);
  const at = folds.indexOf(headText);
  if (fold && at < 0) folds.push(headText);
  if (!fold && at >= 0) folds.splice(at, 1);
  if (wrap) applyFolds(wrap, data);
  try { await wb(['page', 'fold', data.id, String(n), fold ? '--on' : '--off']); } catch (x) { toast(String(x)); }
  void host;
}

function toggleTriangle(data: Blocks, b: Blk, host: Host): HTMLElement {
  const tri = h('button', 'nb-toggle-tri', '›') as HTMLButtonElement;
  tri.type = 'button';
  tri.title = 'Fold or unfold (Ctrl+Enter)';
  tri.setAttribute('aria-label', 'Fold or unfold the toggle');
  tri.onmousedown = ev => ev.preventDefault();
  const flip = () => {
    const wrap = tri.closest<HTMLElement>('.nb-blocks');
    void setFold(data, host, wrap, b.n, b.text, !(data.folds ?? []).includes(b.text));
  };
  tri.onclick = ev => { ev.stopPropagation(); flip(); };
  tri.onkeydown = ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); ev.stopPropagation(); flip(); } };
  return tri;
}

/** The nearest block from `n` in a direction that is shown (not folded away, not a toggle's end), for the arrow keys. */
function shownFrom(wrap: HTMLElement | null, n: number, step: 1 | -1, last: number): number {
  for (let k = n; k >= 1 && k <= last; k += step) {
    const el = wrap?.querySelector<HTMLElement>(`.nb-block[data-n="${k}"]`);
    if (!el || (!el.classList.contains('nb-folded') && !el.classList.contains('nb-toggle-end') && !el.classList.contains('nb-col-marker'))) return k;
  }
  return n;
}

function shifted<T extends { start: number; end: number }>(xs: T[], a: number, b: number): T[] {
  return xs.filter(x => x.start >= a && x.end <= b).map(x => ({ ...x, start: x.start - a, end: x.end - a }));
}

function blockEl(data: Blocks, b: Blk, host: Host): HTMLElement {
  const el = h('div', `nb-block nb-b-${b.kind}`);
  el.dataset.n = String(b.n);
  if (b.bid) el.dataset.bid = b.bid;
  const bg = bgOf(b);
  if (bg) el.dataset.blockBg = bg;
  // the block handle (rows 13, 14, 16, 41): a + and a grip in the left gutter, shown on hover or focus; the gutter is always
  // there, so the text never shifts. + adds an empty line below with the / menu open; the grip drags the block, or opens its menu.
  const plus = h('button', 'nb-plus');
  plus.type = 'button';
  plus.append(icon('plus', 14));
  plus.title = 'Add a line below, with the / menu open';
  plus.setAttribute('aria-label', `Add a block below block ${b.n}`);
  const grip = h('button', 'nb-grip');
  grip.append(icon('grip'));
  grip.title = 'Drag to move this block · click for its menu (Del deletes it, Ctrl+D duplicates it)';
  grip.setAttribute('aria-label', `Actions for block ${b.n}`);
  // a press on either keeps the block being written open: its writing is saved when the handle is used
  for (const x of [plus, grip]) x.onpointerdown = ev => { if (liveEdit && ev.pointerType !== 'touch') ev.preventDefault(); };
  plus.onclick = () => void addBelow(data, host, el, b);
  grip.onclick = () => void openBlockMenu(data, host, el, b, grip);
  grip.onfocus = () => el.classList.add('nb-selected');
  grip.onblur = () => { if (!document.querySelector('.wbm')) el.classList.remove('nb-selected'); };
  grip.onkeydown = ev => {
    const mod = ev.ctrlKey || ev.metaKey;
    const run = pickedRun(data.id);
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && !mod && !ev.shiftKey && !ev.altKey && run && run.ns.length > 1 && run.ns.includes(b.n)) { ev.preventDefault(); void deletePicked(data, host, el, run.ns); }
    else if ((ev.key === 'Delete' || ev.key === 'Backspace') && !mod && !ev.shiftKey && !ev.altKey) { ev.preventDefault(); void deleteBlock(data, host, el, b); }
    else if (mod && ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === 'p') { ev.preventDefault(); void openBlockMenu(data, host, el, b, grip).then(() => document.querySelector<HTMLElement>('.wbm[aria-label="Block actions"] .wbm-row[data-id="move"]')?.click()); }
    else if (mod && !ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === 'd') { ev.preventDefault(); void duplicateBlock(data, host, el, b); }
  };
  grip.draggable = true;
  grip.ondragstart = ev => { ev.dataTransfer!.setData('text/wb-block', `${data.id} ${b.n}`); ev.dataTransfer!.effectAllowed = 'move'; el.classList.add('dragging'); };
  grip.ondragend = () => { el.classList.remove('dragging'); document.querySelectorAll('.drop-before, .drop-after, .drop-left, .drop-right').forEach(x => x.classList.remove('drop-before', 'drop-after', 'drop-left', 'drop-right')); };
  const body = h('div', 'nb-block-body');
  body.append(drawn(b, host, data.id));
  if (isStructured(b)) body.append(button('link-btn small nb-edit-structured', b.kind === 'table' ? 'Edit table' : 'Edit card', () => editBlock(data, b, el, host), 'pen'));
  body.onclick = ev => {
    const t = ev.target as HTMLElement;
    if (t.closest('a, input, button, textarea, label, select, .nb-structured-editor, .nb-block-input')) return;
    if (ev.shiftKey) return;      // Shift+click picks blocks (blockpick.ts)
    { const sel = getSelection(); if (sel && !sel.isCollapsed && body.contains(sel.anchorNode) && sel.toString().trim()) return; }   // words selected (scripture's bar): not a click to edit
    editBlock(data, b, el, host);
  };
  el.append(plus, grip, body);
  if (bg) {
    // the span round the whole text would tint the lines a second time: the block's own wash does it
    const whole = Array.from(body.querySelectorAll<HTMLElement>('[data-bg]')).find(x => x.textContent!.trim() === body.textContent!.trim());
    whole?.classList.add('nb-bg-whole');
  }
  // a block dropped on another goes before it (the upper half) or after it (the lower half); at its far left or right edge, and
  // when the page is wide enough for columns (700 px, library L-23), beside it, in a column (rows 15, 44)
  const where = (ev: DragEvent): 'before' | 'after' | 'left' | 'right' => {
    const r = el.getBoundingClientRect();
    const bodyR = body.getBoundingClientRect();
    const wide = (el.closest('.nb-blocks') as HTMLElement | null)?.clientWidth ?? 0;
    if (wide >= 700 && !isMarker(b.text)) {
      const edge = Math.min(72, bodyR.width * 0.18);
      if (ev.clientX < bodyR.left + edge) return 'left';
      if (ev.clientX > bodyR.right - edge) return 'right';
    }
    return ev.clientY < r.top + r.height / 2 ? 'before' : 'after';
  };
  const drops = ['drop-before', 'drop-after', 'drop-left', 'drop-right'];
  el.ondragover = ev => {
    if (!ev.dataTransfer?.types.includes('text/wb-block')) return;
    ev.preventDefault();
    const w = where(ev);
    for (const c of drops) el.classList.toggle(c, c === `drop-${w}`);
  };
  el.ondragleave = ev => { if (!el.contains(ev.relatedTarget as Node | null)) el.classList.remove(...drops); };
  el.ondrop = async ev => {
    const got = ev.dataTransfer?.getData('text/wb-block');
    const w = where(ev);
    el.classList.remove(...drops);
    if (!got) return;
    ev.preventDefault();
    ev.stopPropagation();
    const [id, n] = got.split(' ');
    if (id !== data.id || Number(n) === b.n) return;
    try {
      if (w === 'left' || w === 'right') {
        await wb(['block', 'move', data.id, n, '--beside', String(b.n), ...(w === 'left' ? ['--left'] : [])]);
      } else {
        const to = w === 'before' ? b.n : b.n + 1;
        await wb(['block', 'move', data.id, n, ...(to > data.blocks.length ? ['--last'] : ['--to', String(to)])]);
      }
      host.changed();
    } catch (x) { toast(String(x)); }
  };
  return el;
}

// ---- the block handle's actions (rows 14, 16, 17, 20, 42) -------------------------------------------------------------------

/** The block being written now (one at a time): the handle saves it first and finds its place from it. */
interface Live { el: HTMLElement; cur: { n: number; count: number; after: number }; save: () => Promise<void>; finish: (then?: BlockFocus) => Promise<void>; text: () => string }
let liveEdit: Live | null = null;

/** Where block `b` is right now, and the page text to guard the change with (none when the page may have been written since it was
 *  drawn: the block being written was saved). The block being written is saved and let go first. null: nothing there to act on. */
async function settle(el: HTMLElement, b: Blk, host: Host): Promise<{ n: number; text: string; expect?: string } | null> {
  const live = liveEdit;
  if (!live) return { n: b.n, text: b.text, expect: host.text };
  const wasNew = live.cur.n === 0;
  await live.save();
  let out: { n: number; text: string; expect?: string } | null;
  if (live.el === el) out = live.cur.n ? { n: live.cur.n, text: live.text() } : null;
  else out = { n: wasNew && live.cur.n > 0 && b.n > live.cur.after ? b.n + live.cur.count : b.n, text: b.text };
  await live.finish();
  return out;
}

/** + : an empty line right below the block, with the / menu open (row 14). Nothing is written until something is typed. */
async function addBelow(data: Blocks, host: Host, el: HTMLElement, b: Blk) {
  if (liveEdit) {
    const t = await settle(el, b, host);
    if (!t) return;
    host.state.focus = null;
    host.state.pending = { id: data.id, after: () => t.n, text: '', at: 'end', menu: true };
    host.redraw();
    return;
  }
  startNew(data, host, el.nextElementSibling as HTMLElement, b.n, '', 'end', undefined, true);
}

async function deleteBlock(data: Blocks, host: Host, el: HTMLElement, b: Blk) {
  const root = el.closest<HTMLElement>('.nb-editor');
  const t = await settle(el, b, host);
  if (!t) return;
  if (await removeBlock(root, data, host, t.n, 1, t.expect)) blockUndoToast(root, data, host, 'Deleted');
}

/** Duplicate: a copy right below, with the caret in it (row 42). A block that is not plain writing gets its grip focused instead. */
async function duplicateBlock(data: Blocks, host: Host, el: HTMLElement, b: Blk) {
  const root = el.closest<HTMLElement>('.nb-editor');
  const t = await settle(el, b, host);
  if (!t || !root) return;
  const history = historyFor(root, data.id);
  if (history.busy) return;
  history.busy = true;
  try {
    const r = await wb(['block', 'dup', data.id, String(t.n), '--undo', ...(t.expect === undefined ? [] : ['--expect', t.expect])]);
    history.undo.push({ token: JSON.stringify(r.undo), n: r.n });
    if (turnable(b)) host.state.focus = { n: r.n, at: 'end' };
    else history.focus = r.n;
    host.changed();
  } catch (x) { toast(String(x)); }
  finally { history.busy = false; }
}

/** Turn into: the block's Markdown as another kind, its words and marks kept (row 17). */
async function turnBlock(data: Blocks, host: Host, el: HTMLElement, b: Blk, key: string) {
  const root = el.closest<HTMLElement>('.nb-editor');
  const t = await settle(el, b, host);
  if (!t) return;
  const k = KINDS.find(x => x.key === key)!;
  const md = k.key === 'toggle' ? wrapHead(turnedMd(t.text, ''), true) : turnedMd(t.text, k.shape, shapeProps(k.key));
  if (md === t.text) return;
  try {
    await wb(['block', 'set', data.id, String(t.n), ...(t.expect === undefined ? [] : ['--expect', t.expect]), '-'], md);
    if (root) historyFor(root, data.id).focus = t.n;
    host.changed();
  } catch (x) { toast(String(x)); }
}

/** Can this block be turned into another text kind? (A table, a fence, a divider, a toggle's line and a callout are not plain text.) */
const turnable = (b: Blk) => ['paragraph', 'heading', 'item', 'numbered', 'todo', 'quote'].includes(b.kind) && !isStructured(b) && !toggleHead(b.text) && !isToggleEnd(b.text);

const wordsIn = (md: string) => md.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

/** "Edited today, 14:02" or "Edited 2026-11-20" from the page's `updated`. */
function editedText(updated?: string): string {
  const d = updated ? new Date(updated) : null;
  if (!d || Number.isNaN(d.getTime())) return 'Edited';
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = /T\d\d:\d\d/.test(updated!) ? `, ${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
  return `Edited ${day === today ? 'today' : day}${time}`;
}

/** The grip's click: the block menu (row 16): Turn into ▸, Duplicate (Ctrl+D), Delete (Del), and at its foot when the page was edited
 *  and how many words it holds. Color ▸ (row 25b), Copy link to block (NB9, row 18) comes with its ticket; Move to is row 19. */
async function openBlockMenu(data: Blocks, host: Host, el: HTMLElement, b: Blk, grip: HTMLElement) {
  if (document.querySelector('.wbm[aria-label="Block actions"]')) return;
  if (liveEdit && liveEdit.el === el) { await liveEdit.save(); if (!liveEdit.cur.n) return; }
  const run = pickedRun(data.id);
  if (run && run.ns.length > 1 && run.ns.includes(b.n)) return openPickMenu(data, host, run.ns, grip);
  el.classList.add('nb-selected');
  const words = data.blocks.reduce((n, x) => n + wordsIn(x.text), wordsIn(data.title?.text ?? ''));
  const items: MenuItem[] = [];
  if (turnable(b)) items.push({ id: 'turn', label: 'Turn into', icon: 'T', hint: '▸', keywords: ['turn', 'change', 'kind'] });
  if (takesBackground(b)) items.push({ id: 'color', label: 'Color', icon: '◐', hint: '▸', keywords: ['background', 'highlight'] });
  if (linkable(b)) items.push({ id: 'link', label: 'Copy link to block', icon: '🔗', keywords: ['link', 'url', 'reference'] });
  items.push({ id: 'dup', label: 'Duplicate', icon: '⧉', hint: 'Ctrl+D', keywords: ['copy'] });
  items.push({ id: 'move', label: 'Move to', icon: '↗', hint: 'Ctrl+Shift+P', keywords: ['page', 'send'] });
  items.push({ id: 'del', label: 'Delete', icon: '✕', hint: 'Del', danger: true, keywords: ['remove'] });
  const keep = host.state.menuClose;
  let picked = false;
  const handle = openMenu({
    groups: [{ items }], label: 'Block actions', placeholder: 'Search actions', at: grip,
    foot: `${editedText(host.updated)}\n${words} word${words === 1 ? '' : 's'}`,
    onPick: it => {
      picked = true;
      if (it.id === 'turn') return turnMenu(data, host, el, b, grip);
      if (it.id === 'color') return colorMenu(host, [b], grip, name => void colorBlocks(data, host, el, b, 1, name), el);
      if (it.id === 'dup') return void duplicateBlock(data, host, el, b);
      if (it.id === 'link') return void copyBlockLink(data, host, el, b);
      if (it.id === 'move') return moveToMenu(data, host, grip, async () => { const t = await settle(el, b, host); return t ? [[t.n, 1]] : []; }, 1, el);
      void deleteBlock(data, host, el, b);
    },
    onClose: () => {
      if (host.state.menuClose === handle.close) host.state.menuClose = keep ?? null;
      if (!picked) el.classList.remove('nb-selected');
    },
  });
  host.state.menuClose = handle.close;
  // Del and Ctrl+D act from the open menu too (the filter box is empty)
  handle.el.addEventListener('keydown', ev => {
    const q = (handle.el.querySelector('.wbm-input') as HTMLInputElement).value;
    const mod = ev.ctrlKey || ev.metaKey;
    if (ev.key === 'Delete' && !q && !mod) { ev.preventDefault(); picked = true; handle.close(); void deleteBlock(data, host, el, b); }
    else if (mod && ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === 'p') { ev.preventDefault(); picked = true; handle.close(); moveToMenu(data, host, grip, async () => { const t = await settle(el, b, host); return t ? [[t.n, 1]] : []; }, 1, el); }
    else if (mod && !ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === 'd') { ev.preventDefault(); picked = true; handle.close(); void duplicateBlock(data, host, el, b); }
  });
}

/** Can the block carry a link id (row 18)? A fenced block carries it on its opening line; tables, dividers and column markers cannot yet. */
const linkable = (b: Blk) => !['table', 'divider'].includes(b.kind) && !isMarker(b.text);

/** Copy link to block (row 18): `wb block link` writes the block's short id at the end of its text the first time and gives
 *  `[[Page title#^abc123]]`, which goes to the clipboard; pasted in another page it is drawn as a chip. */
async function copyBlockLink(data: Blocks, host: Host, el: HTMLElement, b: Blk) {
  const t = await settle(el, b, host);
  if (!t) return;
  try {
    const r = await wb(['block', 'link', data.id, String(t.n)]);
    try { await navigator.clipboard.writeText(r.link); } catch { /* no clipboard here: the toast still names the link */ }
    toast('Link to block copied');
    if (r.wrote) host.changed();
  } catch (x) { toast(String(x)); }
  el.classList.remove('nb-selected');
}

/** Move to (row 19): the page chooser, in the one menu component; the blocks leave this page and are last in the chosen one
 *  (`wb block move ID N --page OTHER --count K`, one call a run of neighbours, in the page's order). `runs` gives [first, count] pairs. */
async function moveToMenu(data: Blocks, host: Host, grip: HTMLElement, runs: () => Promise<[number, number][]>, total: number, el: HTMLElement) {
  let pages: { id: string; title: string; insert: string; kind: string }[] = [];
  try { pages = (await host.titles()).filter(t => t.kind !== 'thread' && t.kind !== 'day' && t.id !== data.id); } catch { /* none to offer */ }
  const keep = host.state.menuClose;
  let picked = false;
  const handle = openMenu({
    groups: [{ title: total > 1 ? `Move ${total} blocks to` : 'Move to', items: pages.map(t => ({ id: t.id, label: t.title || 'Untitled', icon: '↗', keywords: [t.insert] })) }],
    label: 'Move to', placeholder: 'Move to a page', at: grip,
    onPick: it => { picked = true; void (async () => {
      const root = el.closest<HTMLElement>('.nb-editor');
      const todo = await runs();
      if (!todo.length) return;
      clearPick(root);
      let gone = 0, moved = 0;
      const history = root ? historyFor(root, data.id) : null;
      try {
        for (const [from, count] of todo) {
          // the move's undo token is this page's Undo; taking the blocks out of the other page again is its second half
          const r = await wb(['block', 'move', data.id, String(from - gone), '--page', it.id, '--count', String(count)]);
          if (history && r.undo) {
            history.undo.push({ token: JSON.stringify(r.undo), n: from - gone, after: async () => { await wb(['block', 'rm', it.id, String(r.at), '--count', String(count)]); } });
            moved++;
          }
          gone += count;
        }
        if (root && moved) blockUndoToast(root, data, host, `Moved to ${it.label}`, moved);
        else toast(`Moved ${total > 1 ? `${total} blocks` : 'the block'} to ${it.label}`);
      } catch (x) { toast(String(x)); }
      host.changed();
    })(); },
    onClose: () => { if (host.state.menuClose === handle.close) host.state.menuClose = keep ?? null; if (!picked) el.classList.remove('nb-selected'); },
  });
  host.state.menuClose = handle.close;
}

/** Color ▸ (row 25b): Background, Default and the 8 plain colors; a tick on the one the block has (the first one's, for several). */
function colorMenu(host: Host, blocks: Blk[], grip: HTMLElement, pickName: (name: string | null) => void, el?: HTMLElement) {
  const now = bgOf(blocks.find(takesBackground) ?? blocks[0]) ?? 'default';
  const keep = host.state.menuClose;
  const items: MenuItem[] = ['default', ...COLORS].map(name => ({
    id: `bg:${name}`, label: name === 'default' ? 'Default' : colorLabel(name), icon: '', hint: now === name ? '✓' : undefined,
    iconClass: 'nbc-sw', iconData: name === 'default' ? undefined : { bg: name }, keywords: ['background'],
  }));
  const handle = openMenu({
    groups: [{ title: 'Background', items }], label: 'Color', placeholder: 'Color', at: grip,
    onPick: it => pickName(it.id === 'bg:default' ? null : it.id.slice(3)),
    onClose: () => { if (host.state.menuClose === handle.close) host.state.menuClose = keep ?? null; el?.classList.remove('nb-selected'); },
  });
  host.state.menuClose = handle.close;
}

/** A background on `count` blocks from block `b` (wb block color); the change is the page's Undo. */
async function colorBlocks(data: Blocks, host: Host, el: HTMLElement, b: Blk, count: number, name: string | null) {
  const root = el.closest<HTMLElement>('.nb-editor');
  const t = await settle(el, b, host);
  if (!t || !root) return;
  const history = historyFor(root, data.id);
  if (history.busy) return;
  history.busy = true;
  try {
    const r = await wb(['block', 'color', data.id, String(t.n), name ?? 'default', '--count', String(count), '--undo', ...(t.expect === undefined ? [] : ['--expect', t.expect])]);
    history.undo.push({ token: JSON.stringify(r.undo), n: t.n });
    history.focus = t.n;
    host.changed();
  } catch (x) { toast(String(x)); }
  finally { history.busy = false; }
}

/** The grip's menu on several picked blocks (row 21): Turn into, Color and Delete act on all of them. Move to is row 19. */
function openPickMenu(data: Blocks, host: Host, ns: number[], grip: HTMLElement) {
  if (document.querySelector('.wbm[aria-label="Block actions"]')) return;
  const bs = data.blocks.filter(x => ns.includes(x.n) && !isMarker(x.text));
  const runs = runsOf(ns);
  const el = grip.closest<HTMLElement>('.nb-block')!;
  const items: MenuItem[] = [];
  if (bs.some(turnable)) items.push({ id: 'turn', label: 'Turn into', icon: 'T', hint: '▸', keywords: ['change', 'kind'] });
  if (bs.some(takesBackground)) items.push({ id: 'color', label: 'Color', icon: '◐', hint: '▸', keywords: ['background'] });
  items.push({ id: 'move', label: 'Move to', icon: '↗', hint: 'Ctrl+Shift+P', keywords: ['page', 'send'] });
  items.push({ id: 'del', label: 'Delete', icon: '✕', hint: 'Del', danger: true, keywords: ['remove'] });
  const keep = host.state.menuClose;
  const handle = openMenu({
    groups: [{ title: `${bs.length} blocks`, items }], label: 'Block actions', placeholder: 'Search actions', at: grip,
    onPick: it => {
      if (it.id === 'turn') return turnPickedMenu(data, host, bs.filter(turnable), grip);
      if (it.id === 'color') return colorMenu(host, bs, grip, name => void colorRuns(data, host, el, runs, name));
      if (it.id === 'move') return moveToMenu(data, host, grip, async () => runs.map(([a, z]) => [a, z - a + 1] as [number, number]), bs.length, el);
      void deletePicked(data, host, el, ns);
    },
    onClose: () => { if (host.state.menuClose === handle.close) host.state.menuClose = keep ?? null; },
  });
  host.state.menuClose = handle.close;
  // Ctrl+Shift+P: Move to, from the open menu too (as the grip's menu for one block)
  handle.el.addEventListener('keydown', ev => {
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === 'p') {
      ev.preventDefault();
      handle.close();
      moveToMenu(data, host, grip, async () => runs.map(([a, z]) => [a, z - a + 1] as [number, number]), bs.length, el);
    }
  });
}

function turnPickedMenu(data: Blocks, host: Host, bs: Blk[], grip: HTMLElement) {
  const keep = host.state.menuClose;
  const handle = openMenu({
    groups: [{ items: KINDS.map(k => ({ id: k.key, label: k.label })) }], label: 'Turn into', placeholder: 'Turn into', at: grip,
    onPick: it => void (async () => {
      const k = KINDS.find(x => x.key === it.id)!;
      try {
        for (const b of bs) {
          const md = k.key === 'toggle' ? wrapHead(turnedMd(b.text, ''), true) : turnedMd(b.text, k.shape, shapeProps(k.key));
          if (md !== b.text) await wb(['block', 'set', data.id, String(b.n), '-'], md);
        }
        host.changed();
      } catch (x) { toast(String(x)); }
    })(),
    onClose: () => { if (host.state.menuClose === handle.close) host.state.menuClose = keep ?? null; },
  });
  host.state.menuClose = handle.close;
}

/** Delete the picked run of blocks, with the page's Undo. */
async function deletePicked(data: Blocks, host: Host, el: HTMLElement, ns: number[]) {
  const root = el.closest<HTMLElement>('.nb-editor');
  clearPick(root);
  // each run of block numbers on its own, the last first, so the numbers of the ones still to go do not move
  let done = false;
  for (const [from, to] of runsOf(ns).reverse()) {
    if (await removeBlock(root, data, host, from, to - from + 1, done ? undefined : host.text)) done = true; else break;
  }
  if (done) blockUndoToast(root, data, host, 'Deleted');
}

/** Block numbers as runs of neighbours: [1,2,3,6] → [[1,3],[6,6]]. Blocks picked across columns are not a run of numbers. */
function runsOf(ns: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const n of [...ns].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n; else out.push([n, n]);
  }
  return out;
}

/** Color each run of the picked blocks (one call a run, in the page's order). */
async function colorRuns(data: Blocks, host: Host, el: HTMLElement, runs: [number, number][], name: string | null) {
  for (const [from, to] of runs) {
    const first = data.blocks.find(x => x.n === from);
    if (!first) continue;
    const at = el.closest<HTMLElement>('.nb-editor')?.querySelector<HTMLElement>(`.nb-block[data-n="${from}"]`) ?? el;
    await colorBlocks(data, host, at, first, to - from + 1, name);
  }
}

/** Turn into ▸: the kinds, in the one menu component, hung under the grip. */
function turnMenu(data: Blocks, host: Host, el: HTMLElement, b: Blk, grip: HTMLElement) {
  const glyph = (k: string) => (k === 'toggle' ? '›' : k.startsWith('h') ? 'H' : k === 'bullet' ? '•' : k === 'numbered' ? '1.' : k === 'todo' ? '✓' : k === 'quote' ? '”' : 'T');
  const keep = host.state.menuClose;
  const handle = openMenu({
    groups: [{ items: KINDS.map(k => ({ id: k.key, label: k.label, icon: glyph(k.key) })) }], label: 'Turn into', placeholder: 'Turn into', at: grip,
    onPick: it => void turnBlock(data, host, el, b, it.id),
    onClose: () => { if (host.state.menuClose === handle.close) host.state.menuClose = keep ?? null; el.classList.remove('nb-selected'); },
  });
  host.state.menuClose = handle.close;
}

/** A block as it reads: a to-do with its box, a numbered item with its number, a divider, a table, a fenced block. */
function drawn(b: Blk, host: Host, id: string): Node {
  const refs = shifted(host.refs, b.start, b.end), links = shifted(host.links, b.start, b.end);
  if (b.kind === 'todo') {
    const row = h('div', 'nb-todo');
    const cb = h('input') as HTMLInputElement;
    cb.type = 'checkbox';
    cb.checked = !!b.checked;
    cb.setAttribute('aria-label', b.checked ? 'Done: take the tick off' : 'Tick it done');
    cb.onclick = async ev => {
      ev.stopPropagation();
      try { await wb(['block', 'check', blocksId(cb), String(b.n), cb.checked ? '--on' : '--off']); host.changed(); }
      catch (x) { toast(String(x)); }
    };
    const m = /^\s*[-*+]\s+\[[ xX]\]\s?/.exec(b.text);
    const skip = m ? [...m[0]].length : 0;
    const t = h('div', `nb-todo-text${b.checked ? ' done' : ''}`);
    t.append(host.render([...b.text].slice(skip).join(''), shifted(refs, skip, 1e9), shifted(links, skip, 1e9)));
    row.append(cb, t);
    return row;
  }
  if (b.kind === 'divider') return h('hr', 'nb-hr');
  if (b.kind === 'table') return table(b.text);
  if (isScripture(b)) return scriptureBlock(b, id, host);
  if (isView(b)) return viewBlock(b, id, host);
  if (isThread(b)) return threadBlock(b, id, host);
  if (isWord(b)) return wordBlock(b, id, host);
  const tg = toggleHead(b.text);
  if (tg) {
    const line = h('div', 'nb-toggle-line');
    if (tg.inner.trim()) line.append(host.render(tg.inner, [], []));
    else line.append(h('span', 'muted', 'Toggle'));
    return line;
  }
  if (b.kind === 'quote' && b.question) return questionBlock(b, id, host);
  if (b.kind === 'fence') return fence(b);
  const f = host.render(b.text, refs, links);
  if (b.kind === 'numbered') {
    const k = /^\s*(\d+)/.exec(b.text);
    const ol = f.querySelector('ol');
    if (ol && k) ol.start = Number(k[1]);
  }
  if (b.indent) (f.firstElementChild as HTMLElement | null)?.style.setProperty('margin-left', `${Math.min(b.indent, 12) * 8}px`);
  return f;
}

const blocksId = (el: Element) => (el.closest('.nb-blocks') as HTMLElement | null)?.dataset.id || '';

/** Pipe separators may be escaped. Retain Markdown and alignment in cells outside the edit. */
function tableRows(text: string): string[][] {
  return text.split('\n').map(line => {
    const raw = line.trim().slice(1);
    const cells: string[] = [];
    let start = 0, escapes = 0;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '|' && escapes % 2 === 0) {
        cells.push(raw.slice(start, i).trim());
        start = i + 1;
      }
      escapes = raw[i] === '\\' ? escapes + 1 : 0;
    }
    if (start < raw.length || !cells.length) cells.push(raw.slice(start).trim());
    return cells;
  });
}

const tableRule = (cells?: string[]) => !!cells?.length && cells.every(cell => /^:?-+:?$/.test(cell));
const cellText = (cell: string) => cell.replace(/\\\|/g, '|');

function table(text: string): HTMLElement {
  const scroll = h('div', 'nb-table-scroll');
  const t = h('table', 'nb-table');
  tableRows(text).forEach((cells, row) => {
    if (row === 1 && tableRule(cells)) return;
    const tr = h('tr');
    for (const c of cells) tr.append(h(row === 0 ? 'th' : 'td', '', cellText(c)));
    t.append(tr);
  });
  scroll.append(t);
  return scroll;
}

function editTable(text: string, form: HTMLElement, changed: () => void): () => string {
  const rows = tableRows(text);
  const rule = tableRule(rows[1]) ? rows.splice(1, 1)[0] : [];
  const original = JSON.stringify({ rows, rule });
  const scroll = h('div', 'nb-table-scroll');
  const t = h('table', 'nb-table nb-table-edit');
  scroll.append(t);
  form.append(scroll);
  const tools = h('div', 'nb-structured-tools');
  const addRow = button('btn small', 'Add row', () => {
    rows.push(Array.from({ length: width() }, () => ''));
    draw(rows.length - 1, 0);
    changed();
  });
  const addCol = button('btn small', 'Add column', () => {
    const col = width();
    for (const row of rows) row[col] = '';
    if (rule.length) rule[col] = '---';
    draw(0, col);
    changed();
  });
  addRow.type = addCol.type = 'button';
  tools.append(addRow, addCol);
  form.append(tools);
  const width = () => Math.max(1, rule.length, ...rows.map(row => row.length));
  const draw = (focusRow?: number, focusCol?: number) => {
    t.replaceChildren();
    let focus: HTMLInputElement | undefined;
    const cols = width();
    rows.forEach((cells, row) => {
      const tr = h('tr');
      for (let col = 0; col < cols; col++) {
        const cell = h(row ? 'td' : 'th');
        const input = h('input', 'field small nb-table-cell') as HTMLInputElement;
        const label = row ? `Row ${row}, column ${col + 1}` : `Column ${col + 1} heading`;
        input.setAttribute('aria-label', label);
        input.value = cellText(cells[col] || '');
        input.oninput = () => { cells[col] = input.value.replace(/(?<!\\)\|/g, '\\|'); changed(); };
        if (focusRow === row && focusCol === col) focus = input;
        cell.append(input);
        if (!row && cols > 1) {
          const remove = button('link-btn small nb-table-remove', 'Remove column', () => {
            for (const r of rows) r.splice(col, 1);
            rule.splice(col, 1);
            draw(0, Math.min(col, width() - 1));
            changed();
          });
          remove.type = 'button';
          remove.setAttribute('aria-label', `Remove column ${col + 1}`);
          cell.append(remove);
        }
        tr.append(cell);
      }
      if (row) {
        const remove = button('link-btn small nb-table-remove', 'Remove row', () => {
          rows.splice(row, 1);
          draw(Math.min(row, rows.length - 1), 0);
          changed();
        });
        remove.type = 'button';
        remove.setAttribute('aria-label', `Remove row ${row}`);
        const td = h('td');
        td.append(remove);
        tr.append(td);
      }
      t.append(tr);
    });
    focus?.focus();
  };
  draw();
  return () => {
    if (JSON.stringify({ rows, rule }) === original) return text;
    const cols = width();
    const asLine = (cells: string[]) => `| ${Array.from({ length: cols }, (_, i) => cells[i] || '').join(' | ')} |`;
    return [asLine(rows[0]), ...(rule.length ? [asLine(Array.from({ length: cols }, (_, i) => rule[i] || '---'))] : []), ...rows.slice(1).map(asLine)].join('\n');
  };
}

function isStructured(b: Blk) {
  return b.kind === 'table' || !!b.question || ['scripture', 'view', 'thread', 'word'].includes(fenceLang(b));
}

function editBlock(data: Blocks, b: Blk, el: HTMLElement, host: Host) {
  // a scripture block is edited in the reference field (the book completes, the words under it are the database's); a template's blank still uses the form
  if (isScripture(b) && !/{[a-z]+}/i.test(heldIn(b))) editScripture(data, b, el, host);
  else if (isStructured(b)) editStructured(data, b, el, host);
  else startEdit(data, b, el, host, 'end');
}

/** Edit a scripture block's reference in the same field a new one is made with (notebook row 7, NB3). The fence's other lines (lines, ylt, marks) stay. */
function editScripture(data: Blocks, b: Blk, el: HTMLElement, host: Host) {
  if (el.classList.contains('editing')) return;
  const body = el.querySelector('.nb-block-body')!;
  el.classList.add('editing');
  const lines = b.text.split('\n');
  const closing = lines.findIndex((line, i) => i > 0 && /^\s*(`{3,}|~{3,})\s*$/.test(line));
  const limit = closing < 0 ? lines.length : closing;
  const at = lines.findIndex((line, i) => i > 0 && i < limit && !!line.trim());
  const original = at < 0 ? '' : lines[at].trim();
  const form = h('div', 'nb-structured-editor nb-scripture-edit');
  body.replaceChildren(form);
  const done = () => {
    const root = el.closest<HTMLElement>('.nb-editor');
    if (root) historyFor(root, data.id).focus = b.n;
    (document.activeElement as HTMLElement | null)?.blur();
  };
  const field = scriptureField(form, {
    start: original,
    onCancel: () => { done(); host.redraw(); },
    onPlace: async reference => {
      if (reference === original) { done(); host.redraw(); return; }
      const next = [...lines];
      if (at < 0) next.splice(limit, 0, reference); else next[at] = reference;
      if (closing < 0) next.push(lines[0].trimStart().slice(0, 3));
      try {
        await wb(['block', 'set', data.id, String(b.n), '--expect', host.text, '-'], next.join('\n'));
        done();
        host.changed();
      } catch (x) { toast(String(x)); }
    },
  });
  registerPageWriter(form, data.id, async () => {}, () => { form.querySelectorAll<HTMLInputElement>('input').forEach(x => x.disabled = true); });
  field.focus();
}

function editStructured(data: Blocks, b: Blk, el: HTMLElement, host: Host) {
  if (el.classList.contains('editing')) return;
  const body = el.querySelector('.nb-block-body')!;
  el.classList.add('editing');
  const form = h('form', 'nb-structured-editor');
  const table = b.kind === 'table';
  const lang = fenceLang(b);
  const labels: Record<string, string> = { scripture: 'Scripture reference', view: 'View command', thread: 'Thread', word: 'Strong’s number' };
  const title = table ? 'Edit table' : b.question ? 'Edit question' : labels[lang];
  const heading = h('div', 'nb-structured-title', title);
  form.append(heading);
  const error = h('p', 'small nbv-error');
  error.hidden = true;
  error.setAttribute('role', 'alert');
  const changed = () => { error.hidden = true; };
  const serialize = table ? editTable(b.text, form, changed) : editCard(b, form, labels[lang] || 'Question', changed);
  const tools = h('div', 'nb-structured-tools');
  const finish = () => {
    const root = el.closest<HTMLElement>('.nb-editor');
    if (root) historyFor(root, data.id).focus = b.n;
    (document.activeElement as HTMLElement | null)?.blur();
  };
  const cancel = button('btn small', 'Cancel', () => { finish(); host.redraw(); });
  cancel.type = 'button';
  const save = h('button', 'btn small primary', 'Save block');
  save.type = 'submit';
  tools.append(cancel, save);
  form.append(error, tools);
  form.onkeydown = ev => {
    if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); cancel.click(); }
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); form.requestSubmit(); }
  };
  form.onsubmit = async ev => {
    ev.preventDefault();
    save.disabled = true;
    cancel.disabled = true;
    try {
      const text = await serialize();
      if (text !== b.text) {
        if (lang === 'view' && !/\{[a-z]+\}/i.test(text)) await wb(['view', 'run', heldIn({ ...b, text })]);
        await wb(['block', 'set', data.id, String(b.n), '--expect', host.text, '-'], text);
        finish();
        host.changed();
      } else { finish(); host.redraw(); }
    } catch (x) { error.textContent = String(x); error.hidden = false; }
    finally { save.disabled = false; cancel.disabled = false; }
  };
  registerPageWriter(form, data.id, async () => {
    if (serialize() !== b.text) throw new Error('Save or cancel the open block form before deleting its page.');
  }, () => { form.querySelectorAll<HTMLInputElement>('input, textarea, select, button').forEach(x => x.disabled = true); });
  body.replaceChildren(form);
  form.querySelector<HTMLElement>('input, textarea, select')?.focus();
}

function editCard(b: Blk, form: HTMLElement, label: string, changed: () => void): () => string | Promise<string> {
  const lines = b.text.split('\n');
  const field = h('label', 'nb-card-field', label);
  form.append(field);
  if (b.question) {
    const first = /^\s*>\s?\[![a-z]+\][+-]?\s*/i.exec(lines[0]);
    const input = h('textarea', 'field nb-card-text');
    const original = [lines[0].slice(first?.[0].length || 0), ...lines.slice(1).map(line => line.replace(/^\s*>\s?/, ''))].join('\n');
    input.value = original;
    input.required = true;
    input.oninput = changed;
    field.append(input);
    return () => {
      if (input.value === original) return b.text;
      const [head, ...rest] = input.value.split('\n');
      return [`${first?.[0].trimEnd() || '> [!question]'} ${head}`, ...rest.map(line => `> ${line}`)].join('\n');
    };
  }
  const lang = fenceLang(b);
  const closing = lines.findIndex((line, i) => i > 0 && /^\s*(`{3,}|~{3,})\s*$/.test(line));
  const limit = closing < 0 ? lines.length : closing;
  const at = lines.findIndex((line, i) => i > 0 && i < limit && !!line.trim());
  const original = at < 0 ? '' : lines[at].trim();
  const input = h('input', 'field nb-card-input');
  input.value = original;
  input.required = true;
  input.oninput = changed;
  field.append(input);
  const example: Record<string, string> = { scripture: 'Example: John 1:1', view: 'Example: notebook questions', thread: 'Thread ID or name', word: 'Example: H7065' };
  field.append(h('span', 'muted small', example[lang]));
  return async () => {
    let value = input.value.trim();
    if (value === original) return b.text;
    if (!value || /^(`{3,}|~{3,})/.test(value)) throw new Error(`Enter a valid ${label.toLowerCase()}.`);
    if (!/^\{(?:place|date|title|reader)\}$/i.test(value)) {
      if (lang === 'word') {
        value = value.toUpperCase();
        if (!/^[HG]\d+$/.test(value)) throw new Error('Enter a Strong’s number beginning with H or G.');
        await wb(['strong', value]);
      } else if (lang === 'thread') {
        const threads: { id: string; name: string }[] = await wb(['thread', 'list']);
        const match = threads.find(t => t.id === value || t.name.toLowerCase() === value.toLowerCase());
        if (!match) throw new Error(`No thread called “${value}”.`);
        value = match.id;
      } else if (lang === 'scripture') await wb(['preview', value]);
    }
    const next = [...lines];
    if (at < 0) next.splice(limit, 0, value);
    else next[at] = value;
    if (closing < 0) next.push(lines[0].trimStart().slice(0, 3));
    return next.join('\n');
  };
}

/** A page's scripture blocks with their verses (`wb page scripture`), asked for once each time the page is drawn. */
const isScripture = (b: Blk) => b.kind === 'fence' && (b.lang || '').split(/\s/)[0].toLowerCase() === 'scripture';

/** A scripture block (W4, sheet W3): the file holds only the reference (and `lines`, `ylt` when chosen); the verses are
 * drawn from the Bible, verbatim, with the person's highlights. Its head: the reference · version, Paragraph | Lines,
 * YLT, Open ▾. A choice is kept in the block's fence (`wb block scripture`). */
function scriptureBlock(b: Blk, id: string, host: Host): HTMLElement {
  const lines = b.text.split('\n').slice(1).map(l => l.trim().toLowerCase());
  const ref = (b.text.split('\n')[1] || '').trim().replace(/^`+$/, '');
  // a template's scripture block holds a blank: the verses come when a page is made from it
  if (/\{[a-z]+\}/.test(ref)) {
    const ph = h('div', 'nb-scripture nb-blank-block');
    ph.append(icon('book', 14), h('span', '', `Scripture: ${ref}, from the Bible`), h('span', 'muted small', ' · filled when a page is made'));
    return ph;
  }
  const box = h('div', 'nb-scripture sv-block');
  const isLines = lines.includes('lines'), isYlt = lines.includes('ylt'), withMarks = lines.includes('marks');
  const head = h('div', 'sv-head');
  const label = h('span', 'sv-ref', ref || 'Scripture');
  head.append(icon('book', 14), label, h('span', 'sv-ver muted', ` · ${isYlt ? 'YLT' : 'KJV'}`), h('span', 'grow'));
  const choose = async (flag: string) => {
    try {
      const n = await blockNow(id, b);
      if (!n) return toast('The page changed; try again');
      await wb(['block', 'scripture', id, String(n), flag]);
      host.changed();
    } catch (x) { toast(String(x)); }
  };
  const seg = h('div', 'seg small sv-seg');
  const para = button(isLines ? '' : 'on', 'Paragraph', () => { if (isLines) void choose('--paragraph'); });
  const ln = button(isLines ? 'on' : '', 'Lines', () => { if (!isLines) void choose('--lines'); });
  para.title = 'The verses one after another';
  ln.title = 'A verse to a line';
  seg.append(para, ln);
  const ylt = button(`btn small sv-ylt${isYlt ? ' on' : ''}`, 'YLT', () => void choose(isYlt ? '--kjv' : '--ylt'));
  ylt.title = isYlt ? 'Back to the KJV' : 'Young’s Literal Translation';
  ylt.setAttribute('aria-pressed', String(isYlt));
  // Just the text · With my marks (marks M6): the fence keeps the reference and the switch only
  const mk = h('div', 'seg small sv-seg sv-marks');
  const plain = button(withMarks ? '' : 'on', 'Just the text', () => { if (withMarks) void choose('--no-marks'); });
  const mine = button(withMarks ? 'on' : '', 'With my marks', () => { if (!withMarks) void choose('--marks'); });
  mk.append(plain, mine);
  head.append(seg, mk, ylt);
  if (ref) head.append(openSplit('Open', ref, () => label.textContent || ref, () => (isYlt ? 'YLT' : undefined), 'sv-open'));
  const text = h('div', 'sv-body muted small', ref ? 'Reading the verses…' : 'No reference yet. Choose Edit card to enter one.');
  box.append(head, text);
  if (ref && host.state.scripture?.id === id) {
    void host.state.scripture.got.then(async d => {
      const mine = (d?.blocks || []).find((x: any) => x.n === b.n);
      if (!mine) return;
      if (mine.error) { text.textContent = mine.error; return; }
      label.textContent = mine.label;
      const onVerse = (v: MarkedVerse, el: HTMLElement, e: MouseEvent | KeyboardEvent) => void verseCard(v.ref, el, e as MouseEvent);
      const verses = mine.verses as PageVerse[];
      // KJV words are drawn one by one with the reader's marks on them (rows 39, 40: Mark ▾ and Margin note select from them); another version, as it was
      if (hasWords(verses)) {
        const marks = await chapterMarks(verses);
        if (text.isConnected) text.replaceWith(drawWords(verses, !!mine.lines, marks, onVerse));
      } else text.replaceWith(drawVerses(verses, !!mine.lines, onVerse));
    }).catch(x => { text.textContent = String(x); });
  }
  return box;
}

/** A page's views with what each finds (`wb page views`), asked for once each time the page is drawn. */
const isView = (b: Blk) => b.kind === 'fence' && (b.lang || '').split(/\s/)[0].toLowerCase() === 'view';

/** A view (W5, sheet W4): a list kept up to date. The file holds one line of the command language; the notes it finds
 * are listed each time the page is drawn (`wb page views`, the same rows as `wb view run`). Its head: the line (a click
 * writes it anew, `wb block view`) and how many it found; a row opens its note. A view reads; it never writes. */
function viewBlock(b: Blk, id: string, host: Host): HTMLElement {
  const box = h('div', 'nb-view');
  const line = (b.text.split('\n').slice(1).find(l => l.trim() && !/^(```|~~~)/.test(l.trim())) || '').trim();
  const head = h('div', 'nbv-head');
  const lineBtn = h('button', 'nbv-line', line || 'notebook …') as HTMLButtonElement;
  lineBtn.title = 'Click to change what this view lists';
  const count = h('span', 'nbv-count muted small', '');
  head.append(icon('filter', 14), lineBtn, h('span', 'grow'), count);
  const body = h('div', 'nbv-rows');
  body.append(h('p', 'muted small nbv-note', line ? 'Finding the notes…' : 'No line yet: click above and write one, like notebook @Num 25 questions.'));
  box.append(head, body);
  lineBtn.onclick = ev => {
    ev.stopPropagation();
    const block = lineBtn.closest<HTMLElement>('.nb-block');
    block?.querySelector<HTMLButtonElement>('.nb-edit-structured')?.click();
  };
  if (line && host.state.views?.id === id) {
    void host.state.views.got.then(d => {
      const mine = (d?.blocks || []).find((x: any) => x.n === b.n);
      if (!mine) return;
      body.replaceChildren();
      if (mine.error) { body.append(h('p', `small nbv-note${mine.blank ? ' muted' : ' nbv-error'}`, mine.error)); return; }
      count.textContent = `${mine.count} found`;
      const rows: any[] = mine.rows || [];
      for (const r of rows.slice(0, 60)) body.append(viewRow(r, host));
      if (rows.length > 60) body.append(h('p', 'muted small nbv-note', `and ${rows.length - 60} more: narrow the line to see them`));
      if (!rows.length) body.append(h('p', 'muted small nbv-note', 'Nothing found yet. It fills as you write.'));
    }).catch(x => { body.replaceChildren(h('p', 'small nbv-note nbv-error', String(x))); });
  }
  return box;
}

/** A page's thread blocks (`wb page threads`) and word blocks (`wb page words`), asked for once each time it is drawn. */
const fenceLang = (b: Blk) => (b.kind === 'fence' ? (b.lang || '').split(/\s/)[0].toLowerCase() : '');
const isThread = (b: Blk) => fenceLang(b) === 'thread';
const isWord = (b: Blk) => fenceLang(b) === 'word';
/** What a thread or word block holds: the first line inside its fence. */
const heldIn = (b: Blk) => (b.text.split('\n').slice(1).find(l => l.trim() && !/^(```|~~~)/.test(l.trim())) || '').trim();

/** A thread block (R1, sheet R1.3): a thread's places kept up to date, as a view's list is. The file holds the thread's id.
 * Its head: the thread's dot and name, how many places, Open the page; under it the first places' references. */
function threadBlock(b: Blk, id: string, host: Host): HTMLElement {
  const box = h('div', 'nb-threadblock');
  const head = h('div', 'nbt-head');
  const dot = h('i', 'dot nbt-dot');
  const name = h('span', 'nbt-name', heldIn(b) || 'A thread');
  const count = h('span', 'nbt-count muted small', '');
  head.append(dot, name, count, h('span', 'grow'));
  const refs = h('div', 'nbt-refs');
  box.append(head, refs);
  if (!heldIn(b)) refs.append(h('p', 'muted small nbv-note', 'No thread yet. Choose Edit card to pick a thread.'));
  if (host.state.threads?.id === id) {
    void host.state.threads.got.then(d => {
      const mine = (d?.blocks || []).find((x: any) => x.n === b.n);
      if (!mine) return;
      if (mine.error) { if (heldIn(b)) { refs.replaceChildren(h('p', 'small nbv-note nbv-error', mine.error)); } return; }
      dot.className = `dot nbt-dot c-${mine.color}`;
      name.textContent = mine.name;
      count.textContent = `· ${mine.count} place${mine.count === 1 ? '' : 's'}`;
      const open = button('btn small nbt-open', 'Open the page', ev => { ev.stopPropagation(); host.open(`thread:${mine.thread}`); }, 'notebook');
      head.append(open);
      refs.replaceChildren(...(mine.refs as string[]).map(r => h('span', 'pill nbt-ref', r)));
      if (mine.count > mine.refs.length) refs.append(h('span', 'pill unplaced', `+ ${mine.count - mine.refs.length} more`));
    }).catch(x => { refs.replaceChildren(h('p', 'small nbv-note nbv-error', String(x))); });
  }
  return box;
}

/** A word block (R1, sheet R1.5): the lexicon's entry for a Strong's number, drawn from the database each time; the file
 * holds only the number. */
function wordBlock(b: Blk, id: string, host: Host): HTMLElement {
  const box = h('div', 'nb-wordblock');
  const head = h('div', 'nbw-head');
  head.append(h('span', 'nbw-mark', 'A'), h('span', 'nbw-num', heldIn(b).toUpperCase() || 'A word'), h('span', 'muted small', '· Strong’s'));
  const body = h('div', 'nbw-body');
  box.append(head, body);
  if (!heldIn(b)) body.append(h('p', 'muted small nbv-note', 'No number yet. Choose Edit card to enter a Strong’s number.'));
  if (host.state.words?.id === id) {
    void host.state.words.got.then(d => {
      const mine = (d?.blocks || []).find((x: any) => x.n === b.n);
      if (!mine) return;
      if (mine.error) { if (heldIn(b)) body.replaceChildren(h('p', 'small nbv-note nbv-error', mine.error)); return; }
      const top = h('div', 'nbw-top');
      top.append(h('span', `nbw-lemma${/^H/.test(mine.strong) ? ' hebrew' : ' greek'}`, mine.lemma || ''), h('span', 'nbw-sound', mine.translit || ''));
      body.replaceChildren(top);
      if (mine.definition) body.append(h('p', 'nbw-def', mine.definition));
      const used = (mine.renderings || []).map((r: any) => `${r.w} (${r.n})`).join(', ');
      if (used) body.append(h('p', 'small muted nbw-used', `KJV: ${used}`));
      body.append(h('p', 'small muted', `${mine.occurrences} time${mine.occurrences === 1 ? '' : 's'} in the Bible`));
      // R5 holds this slot: the English definition waits for the source the person chooses
      body.append(h('p', 'small muted nbw-slot', 'English definition: waits for the source you choose'));
    }).catch(x => { body.replaceChildren(h('p', 'small nbv-note nbv-error', String(x))); });
  }
  return box;
}

/** A question block (R1, sheet R1.3): the question, open until it is answered (the tick a to-do has). In the file it is a
 * callout line, > [!question] …, and > [!done] … when answered (`wb question answer`). */
function questionBlock(b: Blk, id: string, host: Host): HTMLElement {
  const done = !!b.question?.done;
  const box = h('div', `nb-questionblock${done ? ' done' : ''}`);
  box.append(h('span', 'nbq-mark', done ? '✓' : '?'));
  const refs = shifted(host.refs, b.start, b.end), links = shifted(host.links, b.start, b.end);
  const lines = b.text.split('\n');
  const first = /^\s*>\s?\[![a-z]+\][+-]?\s*/i.exec(lines[0]);
  const text = [lines[0].slice(first ? first[0].length : 0), ...lines.slice(1).map(l => l.replace(/^\s*>\s?/, ''))].join('\n');
  const t = h('div', 'nbq-text');
  t.append(host.render(text, [], []));
  void refs; void links;
  box.append(t);
  const ans = button(`btn small nbq-answer${done ? ' on' : ''}`, done ? 'Answered' : 'Mark answered', async ev => {
    ev.stopPropagation();
    try {
      const n = await blockNow(id, b);
      if (!n) return toast('The page changed; try again');
      await wb(['question', 'answer', `${id}#${n}`, ...(done ? ['--open'] : [])]);
      host.changed();
    } catch (x) { toast(String(x)); }
  });
  ans.title = done ? 'Open it again' : 'Mark it answered';
  const actions = h('div', 'nbq-actions');
  actions.append(ans);
  const places = host.questionPlaces || [];
  if (places.length) {
    const move = async (anchor: string) => {
      try {
        const n = await blockNow(id, b);
        if (!n) return toast('The page changed; try again');
        const r = await wb(['question', 'unfold', `${id}#${n}`, '--at', anchor]);
        host.open(r.trail);
        host.changed();
        toast('Question moved to its own page');
      } catch (x) { toast(String(x)); }
    };
    const give = button('btn small nbq-unfold', places.length === 1 ? 'Give it its own page' : 'Give it its own page…', ev => {
      ev.stopPropagation();
      if (places.length === 1) return void move(places[0].anchor);
      const menu = h('div', 'menu-list');
      menu.append(h('p', 'muted small nb-menu-note', 'Which place should the question stay at?'));
      for (const p of places) menu.append(button('menu-item', p.label, () => { close(); void move(p.anchor); }, 'pin'));
      const close = popMenu(give, menu, { width: 270 });
      menu.querySelector('button')?.focus();
    });
    actions.append(give);
  }
  box.append(actions);
  return box;
}

/** A view's row, as the Notebook's entries read: a question's ?, the title, its place. */
export function viewRow(r: any, host: Pick<Host, 'open'>): HTMLElement {
  const row = h('button', `nbv-row${r.kind === 'question' ? ' is-question' : ''}${r.status === 'done' ? ' done' : ''}`) as HTMLButtonElement;
  row.dataset.id = r.id || '';
  if (r.kind === 'question') row.append(h('span', 'nbv-q', '?'));
  row.append(h('span', 'nbv-title', r.title || (r.kind === 'day' ? 'A day’s page' : 'Untitled')));
  if (r.kind === 'day') row.append(h('span', 'pill unplaced', r.today ? 'Today’s page' : 'Day’s page'));
  else if (r.placed && r.anchor) row.append(placePill(r.label));
  else if (r.placed) row.append(h('span', 'pill unplaced', r.label));
  else row.append(h('span', 'pill unplaced', 'A page'));
  row.onclick = ev => { ev.stopPropagation(); if (r.id) host.open(r.id); };
  return row;
}

/** A block's number now (the page may have changed since it was drawn): found again by its text, nearest where it was. */
async function blockNow(id: string, b: Blk): Promise<number> {
  const now: Blk[] = (await wb(['page', 'blocks', id])).blocks;
  const at = now.filter(x => x.text === b.text).sort((p, q) => Math.abs(p.n - b.n) - Math.abs(q.n - b.n))[0];
  return at ? at.n : 0;
}

/** A fenced block: ```scripture holds only a reference (drawn from the Bible, above); ```view a line of the command
 * language (listed in W5); any other is shown as it is written. */
function fence(b: Blk): HTMLElement {
  const lines = b.text.split('\n');
  const inner = lines.slice(1, lines[lines.length - 1].trim().startsWith(lines[0].trim().slice(0, 3)) && lines.length > 1 ? -1 : undefined);
  const lang = (b.lang || '').split(/\s/)[0].toLowerCase();
  const box = h('div', `nb-fence${lang ? ` nb-fence-${lang}` : ''}`);
  if (lang) box.append(h('span', 'nb-fence-label', lang === 'view' ? 'View' : lang));
  box.append(h('pre', '', inner.join('\n')));
  return box;
}

// ---- writing in a block -------------------------------------------------------------------------------------------------

/** The block menu (sheet W2), in its order: what each writes. */
const MENU: { key: string; label: string; what: string; ico: string; write: string; caret?: number; alias?: string[]; group: 'Basic' | 'Study'; hint?: string; glyph: string }[] = [
  { key: 'text', label: 'Text', what: 'Plain writing', ico: 'prompt', write: '', group: 'Basic', glyph: 'T' },
  { key: 'h1', label: 'Heading 1', what: '# A heading', ico: 'prompt', write: '# ', group: 'Basic', hint: '#', glyph: 'T', alias: ['heading'] },
  { key: 'h2', label: 'Heading 2', what: '## A heading', ico: 'prompt', write: '## ', group: 'Basic', hint: '##', glyph: 'T', alias: ['heading'] },
  { key: 'h3', label: 'Heading 3', what: '### A heading', ico: 'prompt', write: '### ', group: 'Basic', hint: '###', glyph: 'T', alias: ['heading'] },
  { key: 'bullet', label: 'Bullet list', what: '- an item', ico: 'shelf', write: '- ', group: 'Basic', hint: '-', glyph: '•', alias: ['list'] },
  { key: 'numbered', label: 'Numbered list', what: '1. an item', ico: 'shelf', write: '1. ', group: 'Basic', hint: '1.', glyph: '1.', alias: ['list'] },
  { key: 'todo', label: 'To-do', what: '- [ ] something to do', ico: 'check', write: '- [ ] ', group: 'Basic', hint: '[]', glyph: '✓', alias: ['task', 'checkbox'] },
  { key: 'toggle', label: 'Toggle list', what: 'Folds what is inside', ico: 'copy', write: '<details><summary></summary></details>', caret: 18, group: 'Basic', glyph: '›', alias: ['details', 'fold'] },
  { key: 'quote', label: 'Quote', what: '> quoted words', ico: 'copy', write: '> ', group: 'Basic', hint: '>', glyph: '”' },
  { key: 'divider', label: 'Divider', what: 'A line across the page', ico: 'minus', write: '---', group: 'Basic', hint: '---', glyph: '—' },
  { key: 'table', label: 'Table', what: 'Rows and columns', ico: 'filter', write: '| Column | Column |\n| --- | --- |\n|  |  |', caret: 2, group: 'Basic', glyph: '▦' },
  { key: 'inside', label: 'Page', what: 'A new page, with a link to it here', ico: 'notebook', write: '', alias: ['note', 'page inside this one'], group: 'Basic', glyph: '▯' },
  { key: 'link', label: 'Link to a page', what: '[[a page’s title]]', ico: 'notebook', write: '[[', group: 'Basic', glyph: '↗' },
  { key: 'scripture', label: 'Scripture', what: 'A passage, drawn from the Bible', ico: 'book', write: '', group: 'Study', glyph: 'S' },
  { key: 'word', label: 'Word', what: 'A Strong’s entry from the lexicon', ico: 'search', write: '', group: 'Study', glyph: 'W' },
  { key: 'question', label: 'Callout', what: 'A question, open until you answer it', ico: 'prompt', write: '> [!question] ', alias: ['question', '?'], group: 'Study', glyph: '?' },
  { key: 'thread', label: 'Saved thing', what: 'A folder’s places, kept up to date', ico: 'threads', write: '', alias: ['thread', 'folder', '~'], group: 'Study', glyph: '~' },
  { key: 'view', label: 'List in a page', what: 'A list kept up to date (a line of the command language)', ico: 'filter', write: '```view\nnotebook \n```', caret: 17, alias: ['view'], group: 'Study', glyph: '☰' },
];


/** Write in a new block after block `after` (0: first, right under the title). */
function startNew(data: Blocks, host: Host, beforeEl: HTMLElement, after: number, text: string, at: 'start' | 'end' = 'end', pick?: string, menu = false) {
  const el = h('div', 'nb-block nb-new-block');
  // a block written under a toggle's line is inside the toggle
  const prev = beforeEl.parentElement?.querySelector<HTMLElement>(`.nb-block[data-n="${after}"]`);
  if (prev) el.style.setProperty('--td', String(Number(prev.style.getPropertyValue('--td') || 0) + (prev.classList.contains('nb-toggle') ? 1 : 0)));
  beforeEl.before(el);
  startEdit(data, { n: 0, kind: 'paragraph', text, start: 0, end: 0 }, el, host, at, after, pick, menu);
}

/** Write in a block (NB2b): the block is its own contenteditable element, drawn as the block it is and styled as it is
 *  typed; its Markdown is what is saved as it is typed (`wb block set`; a new block, `wb block add`). */
function startEdit(data: Blocks, b: Blk, el: HTMLElement, host: Host, at: 'start' | 'end' | number, newAfter?: number, pick?: string, menu = false) {
  if (el.querySelector('.nb-block-input')) return;
  // a toggle's head is edited as its own line (with the heading shape it may have); the block saved is the head written around it
  const head0 = toggleHead(b.text);
  const ta = createEditor(head0 ? head0.inner : b.text);
  if (head0) toggleOf.set(ta, { closed: head0.closed });
  const wrapped = () => { const t = toggleOf.get(ta); return t ? wrapHead(ta.value, t.closed) : ta.value; };
  ta.placeholder = head0 ? 'Toggle' : 'Write, or type / for a block';
  el.classList.add('editing');
  const body = el.querySelector('.nb-block-body') || el;
  body.replaceChildren(ta);
  // where this writing is in the page: blocks n .. n+count-1 (from 1), or not written yet (after block `after`)
  const cur = { n: newAfter === undefined ? b.n : 0, count: 1, after: newAfter ?? 0 };
  let last = newAfter === undefined ? b.text : '';
  let timer = 0;
  let saving: Promise<void> = Promise.resolve();
  let gone = false;
  // nothing is written back until something is typed: opening and leaving a block never touches its file
  let dirty = newAfter !== undefined && !blank(b.text);
  // The page may have changed since it was drawn (another block's writing ending, a terminal): before the first
  // save, the block is found again by its text, so a change never lands on the wrong block.
  let found = false;
  const findAgain = async () => {
    if (found) return true;
    const now: Blk[] = (await wb(['page', 'blocks', data.id])).blocks;
    const near = (want: string, n: number) => now.filter(x => x.text === want).sort((p, q) => Math.abs(p.n - n) - Math.abs(q.n - n))[0];
    if (cur.n) {
      const at = near(b.text, cur.n);
      if (!at) { cur.n = 0; cur.after = now.length; } // gone from the page: what was written goes at its end
      else cur.n = at.n;
    } else if (cur.after) {
      const was = data.blocks.find(x => x.n === cur.after);
      const at = was && near(was.text, cur.after);
      cur.after = at ? at.n : Math.min(cur.after, now.length);
    }
    found = true;
    return true;
  };
  const save = () => {
    clearTimeout(timer);
    saving = saving.then(async () => {
      const text = wrapped().replace(/\n+$/, '');
      // not while the / menu is open or a new page's name is asked for in the box
      if (!dirty || text === last || blank(text) || text.startsWith('/') || ta.classList.contains('asking')) return;
      try {
        await findAgain();
        const r = cur.n
          ? await wb(['block', 'set', data.id, String(cur.n), '--count', String(cur.count), '-'], text)
          : await wb(['block', 'add', data.id, ...(cur.after ? ['--after', String(cur.after)] : ['--first']), '-'], text);
        cur.n = r.n;
        cur.count = Math.max(1, r.count);
        last = text;
        host.changed();
      } catch (x) { toast(String(x)); }
    });
    return saving;
  };
  /** Something was changed without a key being typed (a shape, an indent): saved soon, like typing. */
  const touched = () => { dirty = true; clearTimeout(timer); timer = window.setTimeout(save, 600); };
  /** The writing ends: saved, an emptied block removed, the page drawn again (and `then` started, if given). */
  const finish = async (then?: BlockFocus) => {
    if (gone) return;
    gone = true;
    if (liveEdit?.el === el) liveEdit = null;
    host.state.menuClose?.();
    await save();
    const tg = toggleOf.get(ta);
    // an emptied block goes; so does an emptied toggle that has nothing inside it
    if (cur.n && (blank(ta.value) || !ta.value.trim()) && (!tg || (tg.closed && dirty))) {
      try {
        await findAgain();
        const wrap = el.closest<HTMLElement>('.nb-blocks');
        if (cur.n && wrap) await removeBlock(wrap.closest<HTMLElement>('.nb-editor'), data, host, cur.n, cur.count, last === b.text ? host.text : undefined);
      } catch (x) { toast(String(x)); }
    }
    host.state.focus = then ?? null;
    // the box lets go of the cursor, so the page is drawn again (the Notebook leaves an editor being typed in alone)
    if (document.activeElement === ta) ta.blur();
    host.redraw();
  };
  /** Backspace at the start of a plain block: its words join the end of the block before, which keeps its shape. */
  const mergeUp = async () => {
    const mine = ta.value;
    if (/^(```|~~~|\|)/.test(mine) || toggleOf.get(ta)) return;
    await save();
    await findAgain();
    if (cur.n < 2) return;
    const now: Blk[] = (await wb(['page', 'blocks', data.id])).blocks;
    const prev = now.find(x => x.n === cur.n - 1);
    if (!prev || !['paragraph', 'heading', 'item', 'numbered', 'todo', 'quote'].includes(prev.kind) || isStructured(prev) || toggleHead(prev.text) || isToggleEnd(prev.text)) return;
    if (gone) return;
    gone = true;
    if (liveEdit?.el === el) liveEdit = null;
    clearTimeout(timer);
    // the join is the page's Undo too (a token from `wb block set --undo`): Undo gives back the two blocks as they were
    const root = el.closest<HTMLElement>('.nb-editor');
    try {
      const r = await wb(['block', 'set', data.id, String(prev.n), '--count', String(1 + cur.count), '--undo', '-'], prev.text + mine.replace(/\n+$/, ''));
      if (root && r.undo) { historyFor(root, data.id).undo.push({ token: JSON.stringify(r.undo), n: prev.n + 1 }); blockUndoToast(root, data, host, 'Joined'); }
    } catch (x) { gone = false; toast(String(x)); return; }
    host.state.menuClose?.();
    host.state.focus = { n: prev.n, at: prev.text.length };
    host.changed();
    if (document.activeElement === ta) ta.blur();
    host.redraw();
  };
  const live: Live = { el, cur, save: () => save(), finish, text: () => last };
  liveEdit = live;
  // references drawn as chips while the block is written (row 12): the ones the block opens with now, and again a moment after typing
  // stops (wb-core's finder, the same as when the block is left). A chip adds nothing to the Markdown.
  let chipTimer = 0, chipSeq = 0;
  const chipNow = async () => {
    const text = ta.value, mine = ++chipSeq;
    if (!/\d/.test(text)) { chipRefs(ta, []); return; }
    let found: Found[] = [];
    try { found = await wb(['refs', '--plain', text]); } catch { return; }
    if (mine !== chipSeq || gone || !ta.isConnected || ta.value !== text) return;
    const at = (n: number) => [...text].slice(0, n).join('').length;
    chipRefs(ta, found.map(f => ({ start: at(f.start), end: at(f.end), ref: f.ref })));
  };
  const chipSoon = () => { clearTimeout(chipTimer); chipTimer = window.setTimeout(() => void chipNow(), 250); };
  if (newAfter === undefined) chipRefs(ta, shifted(host.refs, b.start, b.end).filter(r => !toggleHead(b.text)).map(r => ({ start: [...b.text].slice(0, r.start).join('').length, end: [...b.text].slice(0, r.end).join('').length, ref: r.ref })));
  registerPageWriter(ta, data.id, async () => {
    await save();
    if (wrapped().replace(/\n+$/, '') !== last && dirty && ta.value.trim() && !blank(ta.value)) throw new Error('Save or cancel the current block before deleting its page.');
    await finish();
  }, () => { gone = true; if (liveEdit === live) liveEdit = null; clearTimeout(timer); clearTimeout(chipTimer); ta.disabled = true; });
  // a shortcut that turned the typed characters into another form, kept so Ctrl+Z gives the typed characters back
  let turned: Turn = null;
  ta.oninput = ev => {
    dirty = true;
    turned = null;
    tidy(ta);
    const data1 = (ev as InputEvent).data ?? null;
    const isTyped = (ev as InputEvent).inputType === 'insertText';
    if (isTyped) turned = lineStartShortcut(ta) ?? inlineShortcut(ta, data1);
    if (isTyped && !turned && ta.value === '---') {
      // a divider at once: the line is kept as it is and a new line opens under it
      void finish().then(() => {});
      host.state.focus = null;
      host.state.pending = { id: data.id, after: () => cur.n + cur.count - 1, text: '', at: 'end' };
      return;
    }
    if (isTyped && data1 === '/') slashMenu(ta, data, host, cur, finish, true);
    if (isTyped && data1 === '@') atMenu(ta, host, data.id);
    if (host.template) blankMenu(ta, host);
    clearTimeout(timer);
    timer = window.setTimeout(save, 600);
    chipSoon();
    host.maybeSuggest(ta);
  };
  // Ctrl+click on a chip opens its chapter panel; a plain click only places the caret (the words inside are text being written)
  ta.addEventListener('click', ev => {
    const chip = (ev.target as HTMLElement).closest<HTMLElement>('[data-ref]');
    if (!chip || !(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    void openChapterPanel(chip.dataset.ref!, ta);
  });
  ta.onpaste = ev => {
    ev.preventDefault();
    const text = ev.clipboardData?.getData('text/plain') || '';
    if (text) { insertPlain(ta, text); ta.dispatchEvent(new Event('input')); }
  };
  ta.onkeydown = ev => {
    if (host.state.menuKey?.(ev) || host.suggestKey(ev)) return;
    if (ev.isComposing) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const plainKey = !mod && !ev.altKey;
    if (ev.key === 'Escape') {
      ev.preventDefault(); ev.stopPropagation();
      // Esc ends the writing and picks the block the caret was in (row 21)
      const wrap = el.closest<HTMLElement>('.nb-blocks');
      if (wrap && cur.n && !isEmpty(ta)) pickBlocks(wrap, cur.n, cur.n + cur.count - 1, true);
      ta.blur();
      return;
    }
    if (mod && !ev.shiftKey && !ev.altKey) {
      const k = ev.key.toLowerCase();
      if (k === 'z' && turned && undoTurn(ta, turned)) {
        ev.preventDefault();
        turned = null;
        touched();
        return;
      }
      if (k === 'b' || k === 'i' || k === 'u') { ev.preventDefault(); toggleMark(ta, k); return; }
      if (k === 'd' && !toggleOf.get(ta) && !/^(```|~~~|\|)/.test(ta.value)) {
        // Duplicate (row 42): the block is saved, copied right below, and the caret goes into the copy
        ev.preventDefault();
        void duplicateBlock(data, host, el, { n: cur.n || cur.after + 1, kind: 'paragraph', text: last, start: 0, end: 0 });
        return;
      }
      if (k === 'z' && !dirty) {
        // nothing typed in this block: Ctrl+Z is the page's Undo (a join of two blocks, a deletion, a copy)
        const root = el.closest<HTMLElement>('.nb-editor');
        if (root && historyFor(root, data.id).undo.length) { ev.preventDefault(); void undoRemoval(root, data, host); return; }
      }
    }
    if (mod && ev.key === 'Enter' && !ev.shiftKey && !ev.altKey && toggleOf.get(ta)) {
      // Ctrl+Enter folds or unfolds the toggle this line heads
      ev.preventDefault();
      const wrap = el.closest<HTMLElement>('.nb-blocks');
      void (async () => {
        await save();
        await findAgain();
        if (cur.n) await setFold(data, host, wrap, cur.n, last, !(data.folds ?? []).includes(last));
      })();
      return;
    }
    const c = caretAt(ta);
    if (ev.key === 'Tab' && plainKey && indentList(ta, ev.shiftKey)) { ev.preventDefault(); touched(); return; }
    if (ev.key === 'Enter' && ev.shiftKey && !mod && !ev.altKey) {
      ev.preventDefault();
      insertBreak(ta);
      ta.dispatchEvent(new Event('input'));
      return;
    }
    if (ev.key === 'Enter' && plainKey && !ev.shiftKey) {
      ev.preventDefault();
      const fenced = shapeOf(ta) === '' && /^(```|~~~|\|)/.test(ta.value);
      if (fenced) { insertBreak(ta); ta.dispatchEvent(new Event('input')); return; }
      // Enter in a list item with nothing in it ends the list; else the block is split at the caret
      if (isEmpty(ta)) { if (shapeOf(ta)) { clearShape(ta); touched(); } return; }
      if (c.start && c.collapsed) {
        // Enter at the start of a block with words: an empty block opens above, the caret stays with the words (decided 2026-11-21).
        // An empty block is not a thing the file can hold, so it is a line above that becomes a new block when it is clicked.
        const gap = h('div', 'nb-block nb-new-block nb-gap');
        gap.setAttribute('aria-label', 'An empty block above');
        gap.append(h('div', 'nb-gap-line'));
        gap.onmousedown = e2 => {
          e2.preventDefault();
          void finish();
          host.state.focus = null;
          host.state.pending = { id: data.id, after: () => (cur.n || cur.after + 1) - 1, text: '', at: 'end' };
        };
        el.before(gap);
        return;
      }
      const tgh = toggleOf.get(ta);
      if (tgh) {
        // Enter in a toggle's line: what follows the caret is the first thing inside it, and the toggle is open. A toggle written
        // as one block becomes the head, the blocks inside it and the `</details>` that ends it.
        const sp0 = splitAtCaret(ta);
        if (!sp0) return;
        if (sp0.rest) ta.value = sp0.first;
        dirty = true;
        const wasClosed = tgh.closed;
        const wrap = el.closest<HTMLElement>('.nb-blocks');
        void (async () => {
          if (cur.n && (data.folds ?? []).includes(last)) await setFold(data, host, wrap, cur.n, last, false);
          tgh.closed = false;
          await save();
          await findAgain();
          try { if (wasClosed && cur.n) await wb(['block', 'add', data.id, '--after', String(cur.n + cur.count - 1), '</details>']); } catch (x) { toast(String(x)); }
          host.state.focus = null;
          host.state.pending = { id: data.id, after: () => cur.n + cur.count - 1, text: sp0.rest, at: sp0.rest ? 'start' : 'end' };
          await finish();
        })();
        return;
      }
      const next = continuation(ta);
      const sp = splitAtCaret(ta);
      if (!sp) return;
      if (sp.rest) ta.value = sp.first;
      dirty = true;
      void finish().then(() => {}); // the writing is saved and the page drawn again; the new block opens after it
      host.state.focus = null;
      host.state.pending = { id: data.id, after: () => cur.n + cur.count - 1, text: next + sp.rest, at: sp.rest ? 'start' : 'end' };
      return;
    }
    if (ev.key === 'Backspace' && plainKey && c.start && c.collapsed) {
      ev.preventDefault();
      if (shapeOf(ta)) { clearShape(ta); touched(); return; }
      if (isEmpty(ta)) {
        const prev = (cur.n || cur.after + 1) - 1;
        void finish(prev >= 1 ? { n: prev, at: 'end' } : null);
        return;
      }
      void mergeUp();
      return;
    }
    if (ev.key === 'ArrowUp' && plainKey && !ev.shiftKey && c.collapsed && caretLine(ta).first && (cur.n || cur.after + 1) > 1) {
      ev.preventDefault();
      void finish({ n: shownFrom(el.closest<HTMLElement>('.nb-blocks'), (cur.n || cur.after + 1) - 1, -1, data.blocks.length), at: 'end' });
      return;
    }
    if (ev.key === 'ArrowDown' && plainKey && !ev.shiftKey && c.collapsed && caretLine(ta).last) {
      const nextN = shownFrom(el.closest<HTMLElement>('.nb-blocks'), cur.n ? cur.n + cur.count : cur.after + 1, 1, data.blocks.length);
      if (nextN <= data.blocks.length + (cur.n ? 0 : 1)) { ev.preventDefault(); void finish({ n: nextN, at: 'start' }); }
    }
  };
  ta.onblur = () => {
    // a click on the format bar, the block menu or a [[link]] list keeps the box
    setTimeout(() => { if (document.activeElement === ta || !ta.isConnected || gone || ta.classList.contains('asking')) return; if (host.state.menuClose || selectionBarBusy()) return; void finish(); }, 150);
  };
  ta.focus();
  const pos = at === 'start' ? contentStart(ta) : at === 'end' ? ta.value.length : Math.min(at, ta.value.length);
  ta.setSelectionRange(pos, pos);
  if (ta.value) slashMenu(ta, data, host, cur, finish);
  else if (menu) slashMenu(ta, data, host, cur, finish, false, true);
  // a command picked from the / menu after a space: it runs in this new block, no second Enter
  const picked = pick ? MENU.find(x => x.key === pick) : undefined;
  if (picked) void makeChoose(ta, data, host, cur, finish)(picked);
  if (dirty) touched();
}

/** After the page is drawn: start writing where Enter, Backspace or an arrow key asked. */
export function afterDrawn(root: HTMLElement, state: BlockEditorState, host: Host | null, data: Blocks | null) {
  if (!data || !host) { state.pending = null; state.focus = null; blockHistory.delete(root); return; }
  const wrap = root.querySelector<HTMLElement>('.nb-blocks');
  if (!wrap) return;
  installPicking(root);
  applyPicks(wrap, data.blocks.length);
  const history = historyFor(root, data.id);
  if (history.undo.length) {
    const undo = button('link-btn small nb-undo-block', 'Undo block change', () => void undoRemoval(root, data, host));
    wrap.prepend(undo);
    wrap.onkeydown = ev => {
      if ((!ev.ctrlKey && !ev.metaKey) || ev.shiftKey || ev.altKey || ev.key.toLowerCase() !== 'z') return;
      if ((ev.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
      ev.preventDefault();
      ev.stopPropagation();
      void undoRemoval(root, data, host);
    };
  }
  if (host.state.pending && host.state.pending.id === data.id) {
    const p = host.state.pending;
    host.state.pending = null;
    const after = p.after();
    const next = wrap.querySelector<HTMLElement>(`.nb-block[data-n="${after + 1}"]`) || wrap.querySelector<HTMLElement>('.nb-block-add')!;
    startNew(data, host, next, after, p.text, p.at, p.pick, p.menu);
    return;
  }
  const f = host.state.focus;
  host.state.focus = null;
  const action = history.focus;
  const visual = history.visual;
  delete history.focus;
  delete history.visual;
  if (visual !== undefined) {
    const b = data.blocks.find(x => x.n === visual);
    const el = wrap.querySelector<HTMLElement>(`.nb-block[data-n="${visual}"]`);
    if (b && el) editBlock(data, b, el, host);
    return;
  }
  if (!f) {
    if (action !== undefined) (wrap.querySelector<HTMLElement>(`.nb-block[data-n="${action}"] .nb-grip`) || wrap.querySelector<HTMLElement>('.nb-block-add'))?.focus();
    return;
  }
  if ('after' in f) {
    const next = wrap.querySelector<HTMLElement>(`.nb-block[data-n="${f.after + 1}"]`) || wrap.querySelector<HTMLElement>('.nb-block-add')!;
    startNew(data, host, next, f.after, f.text);
    return;
  }
  const b = data.blocks.find(x => x.n === f.n);
  const el = wrap.querySelector<HTMLElement>(`.nb-block[data-n="${f.n}"]`);
  if (b && el) startEdit(data, b, el, host, f.at);
  else if (f.n > data.blocks.length) startNew(data, host, wrap.querySelector<HTMLElement>('.nb-block-add')!, data.blocks.length, '');
}

/** What picking a command from the / menu does in the block being written (in the line itself; after a space, in a new block). */
function makeChoose(ta: Writer, data: Blocks, host: Host, cur: { n: number; count: number; after: number }, finish: (then?: BlockFocus) => Promise<void>) {
  return async (m: typeof MENU[number]) => {
    if (m.key === 'inside') return askInside(ta, host, cur, finish);
    if (m.key === 'thread' || m.key === 'word') {
      const before = ta.value;
      ta.classList.add('asking');
      const cancel = () => {
        ta.classList.remove('asking');
        if (ta.value !== before || !ta.isConnected) return;
        ta.value = data.blocks.find(b => b.n === cur.n)?.text || '';
        ta.focus();
        ta.dispatchEvent(new Event('input'));
      };
      const pick = (id: string) => {
        if (!ta.isConnected) return;
        ta.value = `\`\`\`${m.key}\n${id}\n\`\`\``;
        ta.dispatchEvent(new Event('input'));
        void finish();
      };
      if (m.key === 'thread') threadChooser(ta, (_name, id) => { if (id) pick(id); }, { existing: true, onClose: cancel });
      else wordChooser(ta, pick, cancel);
      return;
    }
    if (m.key === 'scripture') {
      // a field in the block's place: the book completes as it is typed, the words under it are the database's (row 7)
      const before = ta.value;
      ta.classList.add('asking');
      ta.style.display = 'none';
      const field = scriptureField(ta.parentElement!, {
        onPlace: reference => {
          if (!ta.isConnected) return;
          field.remove();
          ta.value = `\`\`\`scripture\n${reference}\n\`\`\``;
          ta.dispatchEvent(new Event('input'));
          void finish();
        },
        onCancel: () => {
          field.remove();
          ta.style.display = '';
          ta.classList.remove('asking');
          if (ta.value !== before || !ta.isConnected) return;
          ta.value = data.blocks.find(b => b.n === cur.n)?.text || '';
          ta.focus();
          ta.dispatchEvent(new Event('input'));
        },
      });
      field.focus();
      return;
    }
    if (m.key === 'toggle') {
      // the line becomes a toggle's line: what is typed in it is the summary, written as <details><summary> (row 9)
      toggleOf.set(ta, { closed: true });
      ta.placeholder = 'Toggle';
      ta.value = '';
      ta.focus();
      ta.dispatchEvent(new Event('input'));
      return;
    }
    ta.value = m.write;
    const c = m.caret ?? m.write.length;
    ta.setSelectionRange(c, c);
    ta.focus();
    ta.dispatchEvent(new Event('input'));
    if (m.key === 'link') host.linkSuggest(ta);
    if (m.key === 'table') {
      const root = ta.closest<HTMLElement>('.nb-editor');
      await finish();
      if (root && cur.n) {
        historyFor(root, data.id).visual = cur.n;
        host.redraw();
      }
    }
    if (m.key === 'divider') {
      // a divider is whole as it is: saved, and the writing goes on in a new block under it
      await finish();
      host.state.pending = { id: data.id, after: () => cur.n + cur.count - 1, text: '', at: 'end' };
      host.redraw();
    }
  };
}

/** `/` on an empty line, or after a space, opens the one list at the caret (notebook row 6): Basic blocks, then Study folded
 *  at its end; typing in the list finds any command by name, folded or not. On an empty line a command writes its form in the
 *  line; after a space the line's words stay and the command is inserted as a new block below (NB3, the lead 2026-11-21). The "/"
 *  typed is taken out of the line when a command is picked or the list is closed without one. */
function slashMenu(ta: Writer, data: Blocks, host: Host, cur: { n: number; count: number; after: number }, finish: (then?: BlockFocus) => Promise<void>, typedSlash = false, fromPlus = false) {
  const v = ta.value;
  const afterSpace = typedSlash && v.length > 1 && /\s\/$/.test(v) && !v.includes('\n');
  const wholeLine = v.startsWith('/') && !v.includes('\n') && v.length <= 30;
  if (!fromPlus && (typedSlash ? !(v === '/' || afterSpace) : !wholeLine)) return;
  const query = typedSlash ? '' : v.slice(1).trim();
  host.state.menuClose?.();
  const choose = makeChoose(ta, data, host, cur, finish);
  let picked = false;
  const takeSlashOut = () => {
    if (!ta.isConnected || !ta.value.endsWith('/')) return;
    ta.value = ta.value.slice(0, -1).trimEnd();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.dispatchEvent(new Event('input'));
  };
  const item = (m: typeof MENU[number]): MenuItem => ({ id: m.key, label: m.label, icon: m.glyph, hint: m.hint, keywords: [m.key, ...(m.alias || [])] });
  const groups: MenuGroup[] = [
    { title: 'Basic', items: MENU.filter(m => m.group === 'Basic').map(item) },
    { title: 'Study', folded: true, items: MENU.filter(m => m.group === 'Study').map(item) },
  ];
  const sel = window.getSelection();
  const r = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
  const box = r && (r.width || r.height) ? r : ta.getBoundingClientRect();
  const handle = openMenu({
    groups, query, label: 'Add a block', placeholder: 'Type to filter',
    at: { x: box.left, y: box.bottom + 6 },
    onPick: it => {
      const m = MENU.find(x => x.key === it.id);
      if (!m) return;
      picked = true;
      if (afterSpace) {
        // the words before the slash stay as they are; the command is inserted as a block under them
        takeSlashOut();
        void finish();
        host.state.focus = null;
        host.state.pending = { id: data.id, after: () => cur.n + cur.count - 1, text: '', at: 'end', pick: m.key };
        return;
      }
      void choose(m);
    },
    onClose: () => {
      if (host.state.menuClose === handle.close) { host.state.menuClose = null; host.state.menuKey = null; }
      // closed with nothing picked (Esc, a click outside, Backspace in the empty filter): the slash typed goes out of the line.
      // A pick runs just after the close, so this waits for it.
      if (typedSlash) queueMicrotask(() => { if (!picked) takeSlashOut(); });
    },
  });
  host.state.menuClose = handle.close;
  // Backspace in the empty filter takes the slash back out and closes the list
  handle.el.addEventListener('keydown', ev => {
    if (ev.key !== 'Backspace' || (handle.el.querySelector('.wbm-input') as HTMLInputElement).value) return;
    ev.preventDefault();
    handle.close();
  });
}

/** The blanks a template can hold (W5, sheet W6.2): `{` typed in a template's block offers them. */
export const BLANKS: { key: string; what: string; ico: string }[] = [
  { key: '{place}', what: 'The place picked', ico: 'pin' },
  { key: '{date}', what: 'The day it is made', ico: 'pen' },
  { key: '{title}', what: 'The new page’s name', ico: 'prompt' },
  { key: '{reader}', what: 'The chapter in the reader then', ico: 'book' },
];

function blankMenu(ta: Writer, host: Host) {
  const at = ta.selectionStart;
  if (ta.selectionEnd !== at || ta.value[at - 1] !== '{' || ta.value.startsWith('/')) return;
  host.state.menuClose?.();
  const d = app.drawn;
  const here = d ? `${d.chapter.name} ${d.chapter.chapter}` : '';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const box = h('div', 'nb-blockmenu nb-blankmenu');
  box.append(h('div', 'nb-blockmenu-head', 'A blank · filled when a page is made'));
  const rows: HTMLButtonElement[] = [];
  let on = 0;
  const mark = (i: number) => { rows[on]?.classList.remove('on'); on = Math.max(0, Math.min(rows.length - 1, i)); rows[on]?.classList.add('on'); };
  const choose = (k: string) => {
    close();
    const p = ta.selectionStart;
    ta.setRangeText(k, p - 1, p, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  };
  for (const b of BLANKS) {
    const r = h('button', 'nb-blockmenu-row') as HTMLButtonElement;
    r.dataset.key = b.key;
    r.append(icon(b.ico));
    const t = h('div');
    const eg = (b.key === '{place}' || b.key === '{reader}') && here ? `: ${here}` : b.key === '{date}' ? `: ${today}` : '';
    t.append(h('div', 'nb-blockmenu-label', b.key), h('div', 'nb-blockmenu-what', b.what + eg));
    r.append(t);
    r.onmousedown = ev => ev.preventDefault();
    r.onmousemove = () => { if (rows[on] !== r) mark(rows.indexOf(r)); };
    r.onclick = () => choose(b.key);
    rows.push(r);
    box.append(r);
  }
  mark(0);
  const close = popMenu(ta, box, { width: 300, onClose: () => {
    if (host.state.menuClose === close) { host.state.menuClose = null; host.state.menuKey = null; }
  } });
  host.state.menuClose = close;
  host.state.menuKey = ev => {
    if (!box.isConnected) return false;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); mark(on + (ev.key === 'ArrowDown' ? 1 : -1)); return true; }
    if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); choose(BLANKS[on].key); return true; }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); return true; }
    if (ev.key.length === 1) { close(); return false; }
    return false;
  };
}

/** "Page inside this one": its name is asked for in the block; the new page's link takes the block's place. */
/** The picker validates a Strong's number before putting only that number into the block. */
function wordChooser(from: HTMLElement, pick: (id: string) => void, cancel: () => void) {
  const form = h('form', 'chooser') as HTMLFormElement;
  const input = h('input', 'field') as HTMLInputElement;
  input.placeholder = 'Strong’s number (H7065 or G26)';
  input.setAttribute('aria-label', 'Strong’s number');
  const go = h('button', 'btn small primary', 'Insert word') as HTMLButtonElement;
  go.type = 'submit';
  const error = h('p', 'muted small');
  error.setAttribute('role', 'status');
  form.append(input, go, error);
  const close = popMenu(from, form, { width: 285, onClose: cancel });
  form.onsubmit = async ev => {
    ev.preventDefault();
    const id = input.value.trim().toUpperCase();
    if (!/^[HG]\d+$/.test(id)) {
      error.textContent = 'Enter a Strong’s number beginning with H or G.';
      return;
    }
    go.disabled = true;
    try {
      const result = await wb(['strong', id]);
      if (!form.isConnected) return;
      close();
      pick(result.strong);
    } catch (x) {
      error.textContent = String(x);
      go.disabled = false;
    }
  };
  input.focus();
}

function askInside(ta: Writer, host: Host, cur: { n: number; count: number; after: number }, finish: (then?: BlockFocus) => Promise<void>) {
  ta.value = '';
  ta.placeholder = 'The new page’s name, then Enter';
  ta.classList.add('asking');
  ta.focus();
  const keys = ta.onkeydown, typed = ta.oninput;
  ta.onkeydown = async ev => {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); ta.onkeydown = keys; ta.oninput = typed; ta.placeholder = 'Write, or type / for a block'; ta.classList.remove('asking'); return; }
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    const title = ta.value.trim();
    if (!title) return;
    // the block that held the / goes; the link is written where it was
    const after = cur.n ? cur.n - 1 : cur.after;
    ta.value = '';
    ta.onkeydown = keys; ta.oninput = typed;
    ta.classList.remove('asking');
    await finish();
    // the box that asked is gone at once, not left on the page empty if a redraw passes it by
    if (ta.isConnected) { const blk = ta.closest('.nb-new-block'); if (blk) blk.remove(); else ta.remove(); }
    try { await host.pageInside(title, after); } catch (x) { toast(String(x)); }
  };
  ta.oninput = () => {};
}

/** The format bar writes into the block being written; with none, a new block at the page's end. */
export function startWritingAtEnd(root: HTMLElement, data: Blocks | null, host: Host) {
  const add = root.querySelector<HTMLElement>('.nb-blocks .nb-block-add');
  if (!add || !data) return;
  startNew(data, host, add, data.blocks.length ? data.blocks[data.blocks.length - 1].n : 0, '');
}

export const blockButton = button;
