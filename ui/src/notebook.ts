// The Notebook (phase 2b, design B: docs/phase2b-design.md section 7): a list and an editor, as in Apple Notes or
// Obsidian. The list has a search and its sections (W1 of "The Notebook as a workspace", 2026-11-07: they replace the
// Group control and the ⋯ menu's filters): Days (today's page first: one note per day, made the first time it is
// written in), Pages (the notes with no place yet: once the Inbox), Places (the chapter being read, following the
// reader), Threads, Questions, All, and the Trash. The open note is an editor:
// its title is its first line, places and threads are chips (+ Place, + Thread), and the format bar writes Markdown as
// plain text in the file. A place can be a verse, words, a run, a chapter or a book. `[[title]]` and `[[title#heading]]`
// link to another note; Linked from is under the note. Deleted notes wait in the Trash 7 days (or Erase now). Writing
// here never moves the reader. Quick capture (Ctrl+J): a small box at the verse last clicked.
//
// W3 (pages and blocks, 2026-11-07): a note that is written in is drawn block by block (blocks.ts); its title is edited
// in place; pages sit inside pages (the path above the title, "Pages inside" under it). A wide Notebook has the sidebar
// (sheet W1.1): Today, Pinned, the Pages tree (drag a page before, after or inside another), At the reader, Threads,
// Questions, and the Trash at its foot. A narrow one keeps its row of sections, and its Pages section is the tree.
import { wb } from './api';
import { app, book, here, type At } from './app';
import { afterDrawn, drawBlocks, startWritingAtEnd, viewRow, type Blocks, type Host } from './blocks';
import { dock, refHover, openHelp, openStrong, threadChooser } from './panes';
import { layers } from './layers';
import { threadDocuments } from './documents';
import type { Change, Pane } from './dock';
import { toast } from './sheets';
import { button, h, icon, placePill, popMenu, type Found } from './ui';
import { opens, placeOpen, verseCard, type Where } from './verses';
import { makeFromPage, pageDocuments } from './pagedocs';

/** What the list shows: a grouping (day, chapter, thread, none) or a section that is a filter (pages, questions). */
type Group = 'day' | 'chapter' | 'thread' | 'none' | 'pages' | 'questions';
/** The sections, in order: what each is called and the grouping it shows (the Trash is apart). */
const SECTIONS: [Group, string, string][] = [
  ['day', 'Days', 'Today’s page and every page by the day it was written'],
  ['pages', 'Pages', 'Pages with no place yet'],
  ['chapter', 'Places', 'Pages by place: the chapter you are reading, or every chapter'],
  ['thread', 'Threads', 'Pages by thread'],
  ['questions', 'Questions', 'Your questions, open and answered'],
  ['none', 'All', 'Every page, the most recently changed first'],
];

interface Link { start: number; end: number; title: string; heading: string; shown: string; to: string | null; kind: string | null; heading_ok: boolean }
interface Entry {
  id: string; kind: 'note' | 'question' | 'day' | 'thread'; placed: boolean; anchor: string; label: string; text: string; time: string; created: string; updated: string;
  title: string; preview: string; whole?: string; day?: string; today?: boolean; exists?: boolean;
  status?: string; refs?: Found[]; offer?: At | null;
  also?: At[]; threads?: { id: string; name: string }[];
  links?: Link[]; headings?: string[]; linked_from?: { id: string; title: string; kind: string; label: string; day: string; today: boolean }[];
  pinned?: number | null; parent?: string | null; order?: number | null;
  /** W3: the pages above it, from the top, and the pages inside it (`wb note show`). */
  path?: { id: string; title: string }[]; inside?: Row[];
  /** W5: a template (`template: true`), and the template a page was made from. */
  template?: boolean; from_template?: string;
  /** R1: a thread's page (`thread:<slug>`): its slug, color and number of places; a question written in a page: the page and its block. */
  slug?: string; color?: string; places?: number; page?: string; page_title?: string; block?: number;
}
/** A template as Templates lists it (`wb template list`). */
interface Tpl {
  id: string; title: string; summary: string; headings: string[]; asks: string; new_name: string;
  goes_in: string | null; goes_in_title: string | null; used: number;
}
/** A page in the tree (`wb page tree`, `wb notebook sidebar`): any note with no place, inside a page or holding one. */
interface Row {
  id: string; title: string; kind: string; placed: boolean; anchor: string; label: string; status?: string | null;
  pinned?: number | null; order?: number | null; parent?: string | null; children?: Row[];
  /** R1: a thread's color (a thread is a page in the tree); a question written in a page: where. */
  color?: string | null; page?: string; block?: number;
}
interface GroupOf { key: string; label: string; count: number; today?: boolean; following?: boolean; entries: Entry[] }

export interface NotebookSettings { today: boolean; follow: boolean; links: boolean; chapters: boolean; group: Group; capture: string; places: Where }
export const nbSettings: NotebookSettings = { today: true, follow: true, links: true, chapters: true, group: 'day', capture: 'Ctrl+J', places: 'reader' };
let settingsRead = false;

let group: Group | null = null;
let search = '';
let showTrash = false;
let pane: Pane | null = null;
export const notebookBadge = { set: (_n: number) => {} };

/** The list's groups folded away (finding 929e), by group kind and key ("day:2026-11-07"); kept in the window's
 *  storage, as the command history is: it is how this window is set, not part of the study. */
const FOLDED = 'wb.notebook.folded';
const folded = new Set<string>((() => { try { return JSON.parse(localStorage.getItem(FOLDED) || '[]') as string[]; } catch { return []; } })());
function fold(key: string, shut: boolean) { foldMany([key], shut); }
function foldMany(keys: string[], shut: boolean) {
  for (const key of keys) { if (shut) folded.add(key); else folded.delete(key); }
  try { localStorage.setItem(FOLDED, JSON.stringify([...folded].slice(-2000))); } catch { /* not kept: it still folds now */ }
}

/** Fold all / Open all (debug-spec S2, findings 4c02 and 23f1): one control for a grouped list. It says what a click does:
 *  Open all when every group is folded, else Fold all. Kept the way each fold is. */
function foldAllBar(keys: string[]): HTMLElement | null {
  if (keys.length < 2) return null;
  const allShut = keys.every(k => folded.has(k));
  const bar = h('div', 'nb-foldbar');
  const b = button('link-btn nb-foldall', allShut ? 'Open all' : 'Fold all', () => { foldMany(keys, !allShut); void pane?.refresh?.(); }, allShut ? 'expand' : 'collapse');
  b.title = allShut ? 'Show every group’s notes' : 'Fold every group away';
  bar.append(b);
  return bar;
}

/** The wide Notebook's side panel folded to a rail (debug-spec S1, finding c301). Kept in the window's storage, like the
 *  section folds. It is the window's width that picks narrow or wide; this only says whether the wide one shows its panel. */
const SIDE_FOLDED = 'wb.notebook.sideFolded';
let sideFolded = (() => { try { return localStorage.getItem(SIDE_FOLDED) === '1'; } catch { return false; } })();
async function foldSide(shut: boolean) {
  sideFolded = shut;
  try { localStorage.setItem(SIDE_FOLDED, shut ? '1' : '0'); } catch { /* not kept: it still folds now */ }
  // the control that was pressed is drawn again, so the focus (and with it the key) is given back to its other self
  const had = !!pane?.el.contains(document.activeElement) && document.activeElement?.closest('.nb-list') !== null;
  await pane?.refresh?.();
  if (had) pane?.el.querySelector<HTMLElement>('.nb-side-fold')?.focus();
}
/** Ctrl+\ folds and opens the side panel while the Notebook has the focus. */
document.addEventListener('keydown', ev => {
  if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey || ev.key !== '\\') return;
  if (!pane?.el.contains(document.activeElement) || !wide()) return;
  ev.preventDefault();
  foldSide(!sideFolded);
});

/** The note open in the editor: its id, or a draft not saved yet (a place, a question, a day's page). */
let openId: string | null = null;
interface Draft { at: At | null; question: boolean; day?: string; text?: string; hint?: string; parent?: string }
let draft: Draft | null = null;
/** A wide Notebook's main column showing a list (At the reader, a thread) when no note is open; W5: a view's line
 * typed in the command field, or the Templates page (these two in a narrow Notebook too). */
let mainList: { kind: 'chapter'; reader?: string } | { kind: 'view'; line: string } | { kind: 'templates' } | null = null;
/** The open page's blocks, when it is drawn block by block. */
let blocksData: Blocks | null = null;
let blockHostNow: Host | null = null;
/** On a narrow pane the list and the editor take turns; true while the editor is shown. */
let editorShown = false;
/** Where to put the cursor once the editor is drawn: the end of the text, or a heading. */
let focusEditor: 'end' | { heading: string } | null = null;

export async function readSettings() {
  try { Object.assign(nbSettings, await wb(['settings', 'notebook'])); } catch { /* the defaults */ }
  opens.where = nbSettings.places === 'new' ? 'new' : 'reader';
  settingsRead = true;
  return nbSettings;
}

/** Opens the Notebook. The old names still open what they were: the Journal is Days, the Inbox is Pages (the notes
 * with no place yet), All notes is Places; questions open Questions. */
export function openNotebook(v?: 'journal' | 'inbox' | 'all' | 'trash' | Group, opts: { questions?: boolean } = {}) {
  if (v === 'journal') group = 'day';
  else if (v === 'inbox') group = 'pages';
  else if (v === 'all') group = 'chapter';
  else if (v === 'trash') showTrash = true;
  else if (v) group = v;
  if (opts.questions) group = 'questions';
  else if (opts.questions === false && group === 'questions') group = 'day';
  if (v && v !== 'trash') showTrash = false;
  const was = dock.find('notebook');
  pane = dock.open('notebook', 'Notebook', 'notebook', 'right', el => draw(el));
  pane.onClose = () => { pane = null; };
  if (was && (v || opts.questions !== undefined)) void pane.refresh?.();
  return pane;
}

/** How many notes have no place yet (the Pages section). No longer a count on the Notebook's button: nothing waits to
 * be sorted (finding c7ab). */
export async function countInbox() {
  try { return (await wb(['inbox'])).notes.length as number; } catch { return 0; }
}

// ---- drawing: the list and the editor -------------------------------------------------------------------------------

// Draws can overlap (a write refreshes the panes while another draw waits on wb): each is built apart and only the newest
// is put in the pane.
let drawing = 0;
let sized: ResizeObserver | null = null;

/** A draw asked for while a page or a block is being dragged waits for the drop (else what is dragged, or where it is
 * going, would be drawn anew under the mouse and the drag lost). */
let heldDraw: HTMLElement | null = null;
let dragInNotebook = false, dragSince = 0;
document.addEventListener('dragstart', ev => { dragInNotebook = !!(ev.target as Element | null)?.closest?.('.pane-notebook .nb'); dragSince = Date.now(); }, true);
const dragOver = () => {
  dragInNotebook = false;
  setTimeout(() => { const el = heldDraw; heldDraw = null; if (el?.isConnected) void draw(el); });
};
document.addEventListener('drop', dragOver, true);
document.addEventListener('dragend', dragOver, true);

async function draw(el: HTMLElement) {
  // (never longer than a drag can last, should a drag's end not be heard)
  if (dragInNotebook && Date.now() - dragSince < 20000) { heldDraw = el; return; }
  const gen = ++drawing;
  if (!settingsRead) await readSettings();
  if (!group) group = nbSettings.group;
  let root = el.querySelector<HTMLElement>(':scope > .nb');
  if (!root) {
    root = h('div', 'nb');
    root.append(h('div', 'nb-list'), h('div', 'nb-editor'));
    el.replaceChildren(root);
    sized?.disconnect();
    // wide: the sidebar; narrow: the row of sections. The list is drawn again when the width crosses over.
    sized = new ResizeObserver(() => {
      const two = root!.clientWidth >= 640;
      if (two === root!.classList.contains('two')) return;
      root!.classList.toggle('two', two);
      void pane?.refresh?.();
    });
    sized.observe(root);
    root.classList.toggle('two', el.clientWidth >= 640);
  }
  const listEl = root.querySelector<HTMLElement>('.nb-list')!, edEl = root.querySelector<HTMLElement>('.nb-editor')!;
  const two = root.classList.contains('two');
  if (!two && mainList?.kind === 'chapter') mainList = null;
  const [list, ed] = await Promise.all([showTrash ? trashList(two) : two ? drawSidebar() : drawList(), drawEditor(edEl)]);
  if (gen !== drawing) return;
  const keep = listEl.querySelector<HTMLElement>('.nb-scroll')?.scrollTop ?? 0;
  const typing = listEl.contains(document.activeElement) && document.activeElement?.classList.contains('nb-find');
  listEl.replaceChildren(...list);
  const sc = listEl.querySelector<HTMLElement>('.nb-scroll');
  if (sc) sc.scrollTop = keep;
  if (typing) { const f = listEl.querySelector<HTMLInputElement>('.nb-find'); f?.focus(); f?.setSelectionRange(f.value.length, f.value.length); }
  if (ed) edEl.replaceChildren(...ed);
  root.classList.toggle('editing', editorShown && (!!openId || !!draft || !!mainList));
  root.classList.toggle('side-folded', two && sideFolded && !showTrash);
  if (ed) afterEditorDrawn(edEl);
}

/** The reader turned to another chapter: the list follows it when grouped by chapter. */
export function readerMoved() {
  if (!pane || showTrash) return;
  // the sidebar's At the reader (and its list in the main column) follows the reader too
  if ((group === 'chapter' && nbSettings.follow) || wide()) void pane.refresh?.();
}

const wide = () => !!pane?.el.querySelector('.nb.two');

function listArgs(): string[] {
  const a = ['notebook', '--group', group || 'day'];
  if (search.trim()) a.push('--search', search.trim());
  if (!nbSettings.today) a.push('--no-days');
  const d = app.drawn;
  if (group === 'chapter' && nbSettings.follow && d) a.push('--at', `${d.chapter.code} ${d.chapter.chapter}`);
  return a;
}

/** The search, the pen, the Trash (narrow: wide has it at the sidebar's foot) and the settings. */
function listHead(two: boolean): HTMLElement {
  const top = h('div', 'nb-head');
  const f = h('div', 'nb-search');
  f.append(icon('search'));
  const input = h('input', 'field nb-find') as HTMLInputElement;
  input.placeholder = 'Search your notes';
  input.value = search;
  let t = 0;
  input.oninput = () => { clearTimeout(t); t = window.setTimeout(() => { search = input.value; void pane?.refresh?.(); }, 220); };
  input.onkeydown = e => { if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; search = ''; void pane?.refresh?.(); } };
  f.append(input);
  const add = button('icon-btn nb-new', '', () => void newPage(), 'pen');
  add.title = 'A new page';
  add.setAttribute('aria-label', 'A new page');
  const bin = button('icon-btn nb-trash-btn', '', () => { showTrash = true; editorShown = false; void pane?.refresh?.(); }, 'trash');
  bin.dataset.section = 'trash';
  bin.title = 'Trash: deleted notes wait here 7 days';
  bin.setAttribute('aria-label', 'Trash');
  const more = button('icon-btn nb-more', '', () => settingsMenu(more), 'more');
  more.title = 'Notebook settings';
  more.setAttribute('aria-label', 'Notebook settings');
  if (two) top.append(sideFoldButton(true));
  top.append(f, add);
  if (!two) top.append(bin);
  top.append(more);
  return top;
}

/** The control that folds the side panel (in its head) and opens it again (on the rail). */
function sideFoldButton(shut: boolean): HTMLButtonElement {
  const b = button('icon-btn nb-side-fold', '', () => foldSide(shut), 'sidebar');
  const what = shut ? 'Fold the side panel' : 'Show the side panel';
  b.title = `${what} (Ctrl+\\)`;
  b.setAttribute('aria-label', what);
  b.setAttribute('aria-expanded', String(shut));
  return b;
}

async function drawList(): Promise<HTMLElement[]> {
  const out: HTMLElement[] = [listHead(false), sectionsRow()];
  // Pages (W3): the tree, Pinned first; a search lists the pages with its words, as before
  if (group === 'pages' && !search.trim()) {
    const t = await wb(['page', 'tree']);
    const scroll = h('div', 'nb-scroll');
    if (t.pinned.length) scroll.append(sideHead('pinned', 'Pinned', t.pinned.length, false), ...(isShut('pinned', false) ? [] : [pinnedRows(t.pinned)]));
    scroll.append(sideHead('pages', 'Pages', countRows(t.pages), false, true, treeFoldKeys(t.pages)));
    if (!isShut('pages', false)) scroll.append(treeBox(t.pages));
    if (!t.pages.length) scroll.append(h('p', 'muted nb-empty', 'No pages yet. The pen starts one; a note with no place is a page of its own.'));
    out.push(scroll);
    return out;
  }
  const d = await wb(listArgs());
  if (group === 'chapter') {
    // Places follows the reader unless this is off (it was a setting; now it is where it acts)
    const row = h('label', 'nb-follow');
    const cb = h('input') as HTMLInputElement;
    cb.type = 'checkbox';
    cb.className = 'switch';
    cb.checked = nbSettings.follow;
    cb.onchange = () => void saveSetting('follow', cb.checked ? 'on' : 'off');
    row.append(h('span', '', 'Follow the reader'), h('span', 'muted small', cb.checked ? 'the chapter you are reading' : 'every chapter, in Bible order'), cb);
    out.push(row);
  }
  const scroll = h('div', 'nb-scroll');
  let any = false;
  const groups = (d.groups as GroupOf[]).filter(g => g.entries.length || g.following);
  // Places with every chapter listed: the chapters sit under their book (debug-spec S2, finding 23f1)
  const byBook = group === 'chapter' && !groups.some(g => g.following);
  const fkeys: string[] = [];
  if (byBook && groups.length) {
    const b = bookRows(groups);
    fkeys.push(...b.keys);
    scroll.append(...b.els);
    any = true;
  }
  for (const g of byBook ? [] : groups) {
    const entries = g.entries;
    any = true;
    fkeys.push(`${group}:${g.key}`);
    // A group's heading folds it (finding 929e); the count sits beside the name, not at the line's end, where it read
    // as the day's date (finding 7bc8).
    const fkey = `${group}:${g.key}`;
    const shut = folded.has(fkey);
    const label = g.today ? `Today · ${g.label}` : g.following ? `${g.label} · following the reader` : group === 'pages' || group === 'questions' ? SECTIONS.find(x => x[0] === group)![1] : g.label;
    const gh = button(`nb-ghead${shut ? ' shut' : ''}`, '', () => { fold(fkey, !folded.has(fkey)); void pane?.refresh?.(); }, 'down');
    gh.setAttribute('aria-expanded', String(!shut));
    gh.title = shut ? 'Show these notes' : 'Fold these notes away';
    gh.append(h('span', 'nb-glabel', label), h('span', 'nb-count', String(entries.length)));
    scroll.append(gh);
    if (shut) continue;
    scroll.append(...entries.map(item));
    if (g.following && !entries.length) scroll.append(h('p', 'muted small nb-empty', `No notes on ${g.label} yet. Write one with + on a verse, or a new note with + Place.`));
  }
  if (!any) scroll.append(h('p', 'muted nb-empty', search ? 'No page has all of these words.' : group === 'questions' ? 'No questions yet. Write one with /? in a page, or mark a page with ?.' : group === 'pages' ? 'No pages yet. The pen starts one; a note with no place is a page of its own.' : 'Nothing written yet. Ctrl+J writes a thought at the verse you clicked; the pen starts a note.'));
  const bar = group === 'day' || group === 'thread' || group === 'chapter' ? foldAllBar(fkeys) : null;
  if (bar) out.push(bar);
  out.push(scroll);
  return out;
}

/** Places with every chapter listed, by book (debug-spec S2, finding 23f1): a heading for each book, in the order the core
 *  gives (Bible order), with how many notes it holds; under it each chapter's own heading and its notes. Both fold; the
 *  keys are the ones Fold all uses. A note on two chapters of a book counts once in the book's heading. */
function bookRows(groups: GroupOf[]): { keys: string[]; els: HTMLElement[] } {
  const keys: string[] = [], els: HTMLElement[] = [];
  const books: { id: string; name: string; groups: GroupOf[] }[] = [];
  const loose: GroupOf[] = [];
  for (const g of groups) {
    const m = /^(\d+)\.(\d+)$/.exec(g.key);
    if (!m) { loose.push(g); continue; }
    // the label is "Book N" (the chapter) or "Book" (the book's whole)
    const name = m[2] === '0' ? g.label : g.label.slice(0, g.label.length - m[2].length - 1);
    let b = books[books.length - 1];
    if (!b || b.id !== m[1]) books.push(b = { id: m[1], name, groups: [] });
    b.groups.push(g);
  }
  const heading = (cls: string, fkey: string, label: string, count: number, tip: string) => {
    const shut = folded.has(fkey);
    const gh = button(`nb-ghead ${cls}${shut ? ' shut' : ''}`, '', () => { fold(fkey, !folded.has(fkey)); void pane?.refresh?.(); }, 'down');
    gh.setAttribute('aria-expanded', String(!shut));
    gh.title = shut ? `Show ${tip}` : `Fold ${tip} away`;
    gh.dataset.fold = fkey;
    gh.append(h('span', 'nb-glabel', label), h('span', 'nb-count', String(count)));
    els.push(gh);
    return shut;
  };
  for (const b of books) {
    const fkey = `chapter:book:${b.id}`;
    keys.push(fkey);
    const ids = new Set(b.groups.flatMap(g => g.entries.map(e => e.id || e.day || '')));
    if (heading('book', fkey, b.name, ids.size, `the notes in ${b.name}`)) { for (const g of b.groups) keys.push(`chapter:${g.key}`); continue; }
    for (const g of b.groups) {
      const ck = `chapter:${g.key}`;
      keys.push(ck);
      const ch = g.key.split('.')[1];
      if (!heading('chapter-head', ck, ch === '0' ? 'The whole book' : `Chapter ${ch}`, g.entries.length, `these notes`)) els.push(...g.entries.map(item));
    }
  }
  for (const g of loose) {
    const ck = `chapter:${g.key}`;
    keys.push(ck);
    if (!heading('', ck, g.label, g.entries.length, 'these notes')) els.push(...g.entries.map(item));
  }
  return { keys, els };
}

function item(e: Entry): HTMLElement {
  const it = h('button', `nb-item${e.kind === 'question' ? ' is-question' : ''}${e.status === 'done' ? ' done' : ''}${sameAsOpen(e) ? ' on' : ''}`);
  it.dataset.id = e.id || `day:${e.day}`;
  it.append(h('div', 'nb-item-title', e.title || (e.kind === 'day' ? 'Today’s page' : 'Untitled')));
  if (e.preview) it.append(h('div', 'nb-item-preview', e.preview));
  else if (e.kind === 'day' && !e.exists) it.append(h('div', 'nb-item-preview', 'Not written in yet'));
  const chips = h('div', 'nb-item-chips');
  if (e.kind === 'question') chips.append(h('span', 'pill question-pill', e.status === 'done' ? '? Answered' : '?'));
  if (e.kind === 'day') chips.append(h('span', 'pill unplaced', e.today ? 'Today’s page' : 'Day’s page'));
  else if (e.placed && e.anchor) chips.append(placePill(e.label));
  else if (e.placed) chips.append(h('span', 'pill unplaced', e.label));
  else chips.append(h('span', 'pill unplaced', 'No place yet'));
  if (e.also?.length) chips.append(h('span', 'nb-more-places', `+${e.also.length}`));
  for (const t of e.threads || []) chips.append(h('span', 'nb-item-thread', t.name));
  if (e.block) chips.append(h('span', 'pill unplaced', `in ${e.page_title || 'a page'}`));
  it.append(chips);
  it.onclick = () => openEntry(e);
  if (e.id && !e.block) pageContext(it, e.id);
  if (!e.placed && e.kind !== 'day') {
    // drag it onto a verse in the reader to give it that place
    it.draggable = true;
    it.title = 'Drag onto a verse to place it there';
    it.ondragstart = ev => { ev.dataTransfer!.setData('text/wb-jot', e.id); ev.dataTransfer!.effectAllowed = 'move'; it.classList.add('dragging'); };
    it.ondragend = () => it.classList.remove('dragging');
  }
  return it;
}

const sameAsOpen = (e: Entry) => (openId ? (e.block ? e.page === openId : e.id === openId) : !!draft?.day && e.kind === 'day' && e.day === draft.day && !e.exists);

/** Open a line of the list in the editor (today's page not written in yet opens as a blank page). */
function openEntry(e: Entry, at: typeof focusEditor = null) {
  if (e.kind === 'day' && !e.exists) { openId = null; draft = { at: null, question: false, day: e.day }; }
  else { openId = e.block ? e.page! : e.id; draft = null; }
  editorShown = true;
  focusEditor = at;
  showTrash = false;
  void pane?.refresh?.();
}

/** Open a note by its id (a link, Linked from, a search result elsewhere). */
export async function openNote(id: string, heading?: string, end = false) {
  openId = id;
  draft = null;
  editorShown = true;
  focusEditor = heading ? { heading } : end ? 'end' : null;
  showTrash = false;
  const p = openNotebook();
  await p.refresh?.();
}

/** Open a page from the sidebar or the tree (the main column's list, if any, is left). */
function openPage(id: string) {
  openId = id.includes('#') ? id.split('#')[0] : id;
  draft = null;
  mainList = null;
  editorShown = true;
  focusEditor = null;
  showTrash = false;
  void pane?.refresh?.();
}

function newNote(d: Draft = { at: null, question: false }) {
  openId = null;
  mainList = null;
  draft = d;
  editorShown = true;
  focusEditor = 'end';
  showTrash = false;
  void pane?.refresh?.();
}

/** The Notebook's sections, one click each (W1: they replace Group and the ⋯ menu's Questions only and Inbox only; the
 * Trash is the bin beside the pen). The Trash's list draws the same row, so every section is one click from it. */
function sectionsRow(): HTMLElement {
  const row = h('nav', 'nb-sections');
  row.setAttribute('aria-label', 'Notebook sections');
  for (const [g, label, what] of SECTIONS) {
    const on = !showTrash && group === g;
    const b = h('button', `nb-section${on ? ' on' : ''}`, label);
    b.dataset.section = g;
    b.title = what;
    if (on) b.setAttribute('aria-current', 'true');
    b.onclick = () => { group = g; showTrash = false; void pane?.refresh?.(); };
    row.append(b);
  }
  return row;
}

// ---- the sidebar and the tree of pages (W3; sheet W1.1) ----------------------------------------------------------------

/** Is a part of the sidebar (or a page's pages inside, in the tree) folded? `shut` is how it starts. */
const isShut = (key: string, shut: boolean) => folded.has(`side:${key}`) !== shut;
const flip = (key: string) => { fold(`side:${key}`, !folded.has(`side:${key}`)); void pane?.refresh?.(); };
const countRows = (rows: Row[]): number => rows.reduce((n, r) => n + 1 + countRows(r.children || []), 0);
/** The fold keys of every page in the tree that has pages inside it. */
const treeFoldKeys = (rows: Row[]): string[] => rows.flatMap(r => r.children?.length ? [`side:tree:${r.id}`, ...treeFoldKeys(r.children)] : []);

/** A part's heading: a click folds it; Pages has + (a new page); Pages and Pinned take a page dropped on them. */
function sideHead(key: string, label: string, count: number | null, shut: boolean, add: boolean | (() => void) = false, foldKeys: string[] = []): HTMLElement {
  const head = h('div', 'nb-side-head');
  head.dataset.part = key;
  const s = isShut(key, shut);
  const b = button(`nb-ghead${s ? ' shut' : ''}`, '', () => flip(key), 'down');
  b.setAttribute('aria-expanded', String(!s));
  b.append(h('span', 'nb-glabel', label));
  if (count !== null) b.append(h('span', 'nb-count', String(count)));
  head.append(b);
  // Fold all / Open all for the pages that hold pages (debug-spec S2)
  if (foldKeys.length) {
    const allShut = foldKeys.every(k => folded.has(k));
    const fa = button('icon-btn nb-side-foldall', '', () => { foldMany(foldKeys, !allShut); void pane?.refresh?.(); }, allShut ? 'expand' : 'collapse');
    fa.title = allShut ? 'Open all the pages inside pages' : 'Fold all the pages inside pages';
    fa.setAttribute('aria-label', allShut ? 'Open all' : 'Fold all');
    head.append(fa);
  }
  if (add) {
    const plus = button('icon-btn nb-side-add', '', () => (typeof add === 'function' ? add() : void newPage()), 'plus');
    plus.title = key === 'templates' ? 'A new template' : 'A new page';
    plus.setAttribute('aria-label', plus.title);
    head.append(plus);
  }
  if (key === 'pages' || key === 'pinned') {
    head.ondragover = ev => { if (!dragging) return; ev.preventDefault(); head.classList.add('drop-inside'); };
    head.ondragleave = () => head.classList.remove('drop-inside');
    head.ondrop = async ev => {
      head.classList.remove('drop-inside');
      const id = dragging;
      if (!id) return;
      ev.preventDefault();
      try {
        if (key === 'pinned') { await wb(['page', 'pin', id]); toast('Pinned'); }
        else { await wb(['page', 'move', id, '--top', '--first']); toast('Moved to the top of Pages'); }
        changed();
      } catch (x) { toast(String(x)); }
    };
  }
  return head;
}

/** The page being dragged in the tree or Pinned. */
let dragging: string | null = null;
type Zone = 'before' | 'after' | 'inside';
const zones = ['drop-before', 'drop-after', 'drop-inside'];

/** Where on a row a page is dropped: the top quarter puts it before, the bottom quarter after, the middle inside (in
 * Pinned, which has no inside: the upper half before, the lower after). */
function zoneOf(ev: DragEvent, el: HTMLElement, inside: boolean): Zone {
  const r = el.getBoundingClientRect(), y = ev.clientY - r.top;
  if (!inside) return y < r.height / 2 ? 'before' : 'after';
  return y < r.height / 4 ? 'before' : y > (r.height * 3) / 4 ? 'after' : 'inside';
}

async function dropPage(id: string, onto: Row, zone: Zone, where: 'tree' | 'pinned', siblings: Row[]) {
  if (onto.kind === 'thread' && zone === 'inside' && where === 'tree') {
    try { await wb(['note', 'thread', id, onto.id.slice(7)]); toast(`Put on “${onto.title}”`); changed('notes', 'threads'); } catch (x) { toast(String(x)); }
    return;
  }
  const rest = siblings.filter(x => x.id !== id);
  const after = zone === 'after' ? onto.id : rest[rest.findIndex(x => x.id === onto.id) - 1]?.id;
  const at = after ? ['--after', after] : ['--first'];
  try {
    if (where === 'pinned') { await wb(['page', 'pin', id, ...at]); toast('Pinned'); }
    else if (zone === 'inside') { await wb(['page', 'move', id, '--parent', onto.id]); toast(`Put inside “${onto.title}”`); }
    else { await wb(['page', 'move', id, ...(onto.parent ? ['--parent', onto.parent] : ['--top']), ...at]); toast('Moved'); }
    changed();
  } catch (x) { toast(String(x)); }
}

/** A page's row: ▾ folds the pages inside it, a click opens it, + starts a page inside it; it is dragged to move it
 * (and a page with no place onto a verse, to place it there). */
function pageRow(r: Row, depth: number, where: 'tree' | 'pinned', siblings: Row[]): HTMLElement {
  const row = h('div', `nb-tree-row${openId === r.id ? ' on' : ''}${r.status === 'done' ? ' done' : ''}`);
  row.dataset.id = r.id;
  row.style.setProperty('--depth', String(depth));
  const kids = where === 'tree' ? r.children || [] : [];
  if (kids.length) {
    const s = isShut(`tree:${r.id}`, false);
    const f = button(`nb-tree-fold${s ? ' shut' : ''}`, '', ev => { ev.stopPropagation(); flip(`tree:${r.id}`); }, 'down');
    f.setAttribute('aria-expanded', String(!s));
    f.setAttribute('aria-label', `${s ? 'Show' : 'Fold'} the pages inside ${r.title}`);
    row.append(f);
  } else row.append(h('span', 'nb-tree-fold none'));
  const isThread = r.kind === 'thread';
  const open = button('nb-tree-open', '', () => openPage(r.id), r.kind === 'question' || isThread ? undefined : r.placed ? 'pin' : 'notebook');
  if (r.kind === 'question') open.append(h('span', 'nb-tree-q', '?'));
  if (isThread) open.append(h('i', `dot c-${r.color || ''}`));
  open.append(h('span', 'nb-tree-title', r.title || 'Untitled'));
  open.title = r.placed && r.label ? `${r.title} · on ${r.label}` : r.title;
  row.append(open);
  if (where === 'tree' && !isThread) {
    const add = button('icon-btn nb-tree-add', '', ev => { ev.stopPropagation(); void newPage({ id: r.id, title: r.title }); }, 'plus');
    add.title = `A page inside “${r.title}”`;
    add.setAttribute('aria-label', add.title);
    row.append(add);
  }
  pageContext(row, r.id);
  row.draggable = !isThread;
  row.ondragstart = ev => {
    dragging = r.id;
    ev.dataTransfer!.setData('text/wb-page', r.id);
    if (!r.placed && r.kind !== 'question') ev.dataTransfer!.setData('text/wb-jot', r.id);
    ev.dataTransfer!.effectAllowed = 'move';
    row.classList.add('dragging');
  };
  row.ondragend = () => { dragging = null; row.classList.remove('dragging'); pane?.el.querySelectorAll('.drop-before, .drop-after, .drop-inside').forEach(x => x.classList.remove(...zones)); };
  row.ondragover = ev => {
    if (!dragging || dragging === r.id) return;
    ev.preventDefault();
    const z = zoneOf(ev, row, where === 'tree');
    row.classList.remove(...zones);
    row.classList.add(`drop-${z}`);
  };
  row.ondragleave = () => row.classList.remove(...zones);
  row.ondrop = ev => {
    const id = dragging;
    const z = zoneOf(ev, row, where === 'tree');
    row.classList.remove(...zones);
    if (!id || id === r.id) return;
    ev.preventDefault();
    void dropPage(id, r, z, where, siblings);
  };
  return row;
}

function treeRows(rows: Row[], depth: number, into: HTMLElement) {
  for (const r of rows) {
    into.append(pageRow(r, depth, 'tree', rows));
    if (r.children?.length && !isShut(`tree:${r.id}`, false)) treeRows(r.children, depth + 1, into);
  }
}

/** The tree of pages: each page, and the pages inside it under it. */
function treeBox(rows: Row[]): HTMLElement {
  const box = h('div', 'nb-tree');
  box.setAttribute('role', 'tree');
  treeRows(rows, 0, box);
  return box;
}

function pinnedRows(rows: Row[]): HTMLElement {
  const box = h('div', 'nb-pinned');
  for (const r of rows) box.append(pageRow(r, 0, 'pinned', rows));
  return box;
}

function sideRow(cls: string, ico: string | null, label: string, note: string, on: boolean, go: () => void): HTMLButtonElement {
  const b = button(`nb-side-row ${cls}${on ? ' on' : ''}`, '', go, ico ?? undefined);
  b.append(h('span', 'nb-tree-title', label));
  if (note) b.append(h('span', 'nb-side-note', note));
  return b;
}

/** A wide Notebook's sidebar (sheet W1.1): Today, Pinned, Pages, At the reader, Threads, Questions; the Trash at its
 * foot. A search lists every note with its words instead. */
async function drawSidebar(): Promise<HTMLElement[]> {
  if (sideFolded) {
    // the rail: the control that opens the panel again, and the pen
    const rail = h('div', 'nb-rail');
    const pen = button('icon-btn nb-new', '', () => void newPage(), 'pen');
    pen.title = 'A new page';
    pen.setAttribute('aria-label', 'A new page');
    rail.append(sideFoldButton(false), pen);
    return [rail];
  }
  const top = listHead(true);
  if (search.trim()) {
    const d = await wb(['notebook', '--group', 'none', '--search', search.trim(), ...(nbSettings.today ? [] : ['--no-days'])]);
    const entries = (d.groups as GroupOf[]).flatMap(g => g.entries);
    const scroll = h('div', 'nb-scroll');
    scroll.append(...entries.map(item));
    if (!entries.length) scroll.append(h('p', 'muted nb-empty', 'No page has all of these words.'));
    return [top, scroll];
  }
  // At the reader: the reader's chapter, then each second reader's (W4, sheet W1.2: a row per open reader)
  const at = app.drawn;
  const seconds = at ? app.readers() : [];
  const ats = at ? [`${at.chapter.code} ${at.chapter.chapter}`, ...seconds.map(r => `${r.code} ${r.chapter}`)] : [];
  const s = await wb(['notebook', 'sidebar', ...(ats.length ? ['--at', ats.join('; ')] : [])]);
  const side = h('nav', 'nb-scroll nb-side');
  side.setAttribute('aria-label', 'Notebook');
  if (s.today.length) {
    side.append(sideHead('today', 'Today', null, false));
    if (!isShut('today', false)) for (const d of s.today) {
      const on = d.exists ? openId === d.id : !openId && draft?.day === d.day;
      const dayRow = sideRow('nb-day-row', 'pen', d.title, d.today ? 'today' : '', on, () => {
        if (d.exists) return openPage(d.id);
        openId = null; mainList = null; draft = { at: null, question: false, day: d.day }; editorShown = true; showTrash = false;
        void pane?.refresh?.();
      });
      if (d.exists) pageContext(dayRow, d.id);
      side.append(dayRow);
    }
  }
  side.append(sideHead('pinned', 'Pinned', s.pinned.length, false));
  if (!isShut('pinned', false)) side.append(s.pinned.length ? pinnedRows(s.pinned) : h('p', 'muted small nb-side-hint', 'Drag a page here, or ⋯ → Pin on a page.'));
  side.append(sideHead('pages', 'Pages', countRows(s.pages), false, true, treeFoldKeys(s.pages)));
  if (!isShut('pages', false)) side.append(s.pages.length ? treeBox(s.pages) : h('p', 'muted small nb-side-hint', 'No pages yet: + starts one.'));
  const rows: any[] = s.at_readers || [];
  if (rows.length) {
    const total = rows.reduce((n, r) => n + (r.count || 0), 0);
    side.append(sideHead('reader', rows.length > 1 ? 'At the readers' : 'At the reader', total, false));
    if (!isShut('reader', false)) rows.forEach((r, k) => {
      const which = k === 0 ? undefined : seconds[k - 1]?.pane;
      const on = mainList?.kind === 'chapter' && mainList.reader === which && !openId;
      const row = sideRow(`nb-reader-row${k ? ' second' : ''}`, k ? 'book' : 'pin', r.label, `${k ? 'new reader' : 'the reader'} · ${r.count}`, on, () => {
        mainList = { kind: 'chapter', reader: which }; openId = null; draft = null; editorShown = true; showTrash = false;
        void pane?.refresh?.();
      });
      row.title = k ? `The notes on ${r.label}, the chapter a second reader shows` : `The notes on ${r.label}, the chapter the reader shows`;
      side.append(row);
    });
  }
  side.append(sideHead('questions', 'Questions', s.questions.length, true));
  if (!isShut('questions', true)) for (const q of s.questions as Row[]) {
    const b = sideRow(`nb-question-row${q.status === 'done' ? ' done' : ''}`, null, q.title, q.status === 'done' ? 'answered' : '', openId === (q.block ? q.page : q.id), () => openPage(q.block ? q.page! : q.id));
    b.prepend(h('span', 'nb-tree-q', '?'));
    if (q.block) b.title = `Written in ${(q as any).page_title || 'a page'}`; else pageContext(b, q.id);
    side.append(b);
  }
  // W5 (sheet W6.2): Templates, with + for an empty one; the Templates page from the foot
  const tps: Row[] = s.templates || [];
  if (tps.length) {
    side.append(sideHead('templates', 'Templates', tps.length, false, () => void newTemplate()));
    if (!isShut('templates', false)) for (const t of tps) {
      const tr = sideRow('nb-template-row', 'notebook', t.title, '', openId === t.id, () => openPage(t.id));
      pageContext(tr, t.id);
      side.append(tr);
    }
  }
  const foot = h('div', 'nb-side-foot');
  const tbtn = button('link-btn nb-side-link nb-side-templates', 'Templates', () => showTemplates(), 'notebook');
  tbtn.title = 'Your templates: pages that new pages start from';
  foot.append(tbtn);
  const bin = button('link-btn nb-trash-btn nb-side-trash', 'Trash', () => { showTrash = true; editorShown = false; void pane?.refresh?.(); }, 'trash');
  bin.dataset.section = 'trash';
  bin.title = 'Trash: deleted notes wait here 7 days';
  foot.append(bin);
  return [top, side, foot];
}

/** The main column's list, in a wide Notebook: the notes at the chapter the reader shows (it follows the reader), or a
 * thread's notes. */
async function mainListView(): Promise<HTMLElement[]> {
  if (mainList!.kind === 'view') return viewListView(mainList as { kind: 'view'; line: string });
  if (mainList!.kind === 'templates') return templatesView();
  const out: HTMLElement[] = [];
  let entries: Entry[] = [];
  const head = h('div', 'nb-ed-head');
  out.push(head);
  if (mainList!.kind === 'chapter') {
    const d = app.drawn;
    if (!d) return [h('p', 'muted nb-empty nb-pick', 'Open a chapter in the reader.')];
    // the reader, or a second reader (gone: the reader)
    const m = mainList as { kind: 'chapter'; reader?: string };
    const second = m.reader ? app.readers().find(r => r.pane === m.reader) : undefined;
    if (m.reader && !second) m.reader = undefined;
    const at = second ? `${second.code} ${second.chapter}` : `${d.chapter.code} ${d.chapter.chapter}`;
    const r = await wb(['notebook', '--group', 'chapter', '--at', at]);
    const g = (r.groups as GroupOf[])[0];
    entries = g?.entries || [];
    const crumbs = h('nav', 'nb-crumbs');
    crumbs.append(h('span', 'nb-crumb', app.readers().length ? 'At the readers' : 'At the reader'), h('span', 'nb-crumb-sep', '/'), h('span', 'nb-crumb here', g?.label || ''));
    head.append(crumbs, h('span', 'grow'), h('span', 'muted small nb-list-which', `${second ? 'in the new reader' : 'in the reader'} · ${entries.length} note${entries.length === 1 ? '' : 's'}`));
    out.push(h('h2', 'nb-title', g?.label || 'At the reader'), h('p', 'muted small nb-list-about', second
      ? 'The notes and pages placed in the chapter this second reader shows. It follows that reader as it turns; nothing here moves a reader.'
      : 'At the reader: the notes and pages placed in the chapter the reader shows. It follows the reader as it moves.'));
  }
  const list = h('div', 'nb-main-list');
  list.append(...entries.map(item));
  if (!entries.length) list.append(h('p', 'muted nb-empty', 'No notes here yet. Write one with + on a verse.'));
  out.push(list);
  return out;
}

// ---- the editor ---------------------------------------------------------------------------------------------------------

let shown: Entry | null = null;

async function drawEditor(edEl: HTMLElement): Promise<HTMLElement[] | null> {
  // while the person types, the editor is left as it is (the list still redraws beside it)
  const a = document.activeElement;
  if (edEl.contains(a) && (a?.classList.contains('nb-input') || a?.classList.contains('nb-title-input'))) return null;
  blocksData = null;
  blockHostNow = null;
  if (!openId && !draft) {
    shown = null;
    if (mainList) return mainListView();
    return [h('p', 'muted nb-empty nb-pick', 'Pick a page in the list, or start one with the pen.')];
  }
  let e: Entry;
  let bd: Blocks | null = null;
  if (openId) {
    try { [e, bd] = await Promise.all([wb(['note', 'show', openId]), wb(['page', 'blocks', openId]).catch(() => null)]); }
    catch { openId = null; shown = null; return [h('p', 'muted nb-empty nb-pick', 'That page is gone (deleted, or moved by another app).')]; }
  } else if (draft!.day) {
    e = await wb(['day', draft!.day]);
    if (e.exists) { openId = e.id; draft = null; bd = await wb(['page', 'blocks', e.id]).catch(() => null); }
  } else {
    e = { id: '', kind: draft!.question ? 'question' : 'note', placed: !!draft!.at, anchor: draft!.at?.anchor || '', label: draft!.at?.label || '', text: draft!.text || '', time: '', created: '', updated: '', title: '', preview: '', also: [], threads: [], links: [], headings: [], linked_from: [] };
  }
  shown = e;
  // W5: a template shows its settings above its blocks, and how often it was used
  const tpl: Tpl | null = e.template && e.id ? await wb(['template', 'show', e.id]).catch(() => null) : null;
  // W3: a note written in is drawn block by block; a draft and a blank day's page keep the one box for the whole text
  const isT = e.kind === 'thread';
  const byBlocks = !!(e.id && bd && (e.text.trim() || isT));
  const out: HTMLElement[] = [];
  const backTo = !mainList ? 'Pages' : mainList.kind === 'view' ? 'The view' : mainList.kind === 'templates' ? 'Templates' : 'At the reader';
  const back = button(`link-btn nb-back${mainList ? ' shown' : ''}`, backTo, () => {
    if (mainList) { openId = null; draft = null; } else editorShown = false;
    void pane?.refresh?.();
  }, 'left');
  const head = h('div', 'nb-ed-head');
  head.append(back, h('span', 'grow'));
  if (e.kind === 'day') head.append(h('span', 'muted small', e.today ? 'today’s page' : 'a day’s page'));
  if (tpl) head.append(h('span', 'muted small nb-tpl-used', `a template · ${usedText(tpl.used)}`));
  if (e.id) {
    const more = button('icon-btn small', '', () => editorMenu(more, e), 'more');
    more.setAttribute('aria-label', 'Change this page');
    head.append(more);
  }
  out.push(head);
  const crumbs = pathOf(e);
  if (crumbs) out.push(crumbs);
  const title = h('h2', 'nb-title');
  if (isT) { title.append(h('i', `dot big c-${e.color || ''}`), document.createTextNode(` ${e.title}`)); title.title = 'A thread: rename it from ⋯'; }
  else if (byBlocks && e.kind !== 'day' && bd!.title) editableTitle(title, e, bd!);
  else title.textContent = e.kind === 'day' ? e.title : e.title || (draft?.parent ? 'A new page' : draft?.question ? 'A new question' : 'A new page');
  out.push(title);
  if (tpl) out.push(templateAbout(), templateSettings(tpl));
  else if (isT) out.push(threadControls(e));
  else if (!e.template) out.push(chipsRow(e));
  out.push(formatBar(e));
  if (byBlocks) {
    blocksData = bd;
    blockHostNow = blockHost(e);
    const body = h('div', 'nb-body');
    body.append(drawBlocks(bd!, blockHostNow));
    out.push(body);
  } else out.push(page(e));
  if (isT) out.push(await threadPlaces(e));
  if (e.inside?.length || isT) {
    const box = h('div', 'nb-inside');
    box.append(h('div', 'nb-linked-head', `${isT ? 'Pages on this thread' : 'Pages inside'} · ${e.inside?.length || 0}`));
    for (const r of e.inside || []) box.append(button('nb-linked-row', r.title || 'Untitled', () => openNote(r.id), r.kind === 'question' ? undefined : r.placed ? 'pin' : 'notebook'));
    if (isT) box.append(pageOnThread(e));
    out.push(box);
  }
  // W6 (sheet W7.4): the documents made from this page, beside the pages inside it
  if (e.id && e.kind !== 'day' && !e.template) {
    const docsBox = h('div', 'nb-docs');
    if (isT) void threadDocuments({ id: e.slug, name: e.title }, docsBox);
    else { docsBox.hidden = true; void pageDocuments(e.id, docsBox); }
    out.push(docsBox);
  }
  if (nbSettings.links && e.linked_from?.length) {
    const lf = h('div', 'nb-linked');
    lf.append(h('div', 'nb-linked-head', `Linked from · ${e.linked_from.length}`));
    for (const l of e.linked_from) {
      const r = button('nb-linked-row', '', () => openNote(l.id), 'notebook');
      r.append(h('span', 'nb-linked-title', l.title), h('span', 'grow'), h('span', 'muted small', l.kind === 'day' ? (l.today ? 'today’s page' : 'a day’s page') : l.label ? `on ${l.label}` : ''));
      lf.append(r);
    }
    out.push(lf);
  }
  return out;
}

/** The note's places and threads as chips (a click goes there; × takes it off), with + Place and + Thread. */
function chipsRow(e: Entry): HTMLElement {
  const row = h('div', 'nb-chips');
  if (e.kind === 'question') {
    const tag = button('pill question-pill', e.status === 'done' ? '? Answered' : '? Question', async () => {
      if (!e.id) { draft!.question = false; return void pane?.refresh?.(); }
      await wb(['note', 'question', e.id, '--plain']); changed();
    });
    tag.title = 'Click: make it a plain note';
    row.append(tag);
  }
  if (e.kind === 'day') return row;
  const onThreadOnly = e.placed && !e.anchor && !!e.threads?.length;
  if (e.id && e.placed && e.anchor) row.append(placeOff(e, { anchor: e.anchor, label: e.label }));
  else if (!e.id && draft?.at) {
    const chip = h('span', 'place-off');
    const x = button('member-x shown', '', () => { draft!.at = null; void pane?.refresh?.(); }, 'x');
    x.title = 'No place: a page of its own';
    chip.append(placeOpen(draft.at.label, draft.at.anchor), x);
    row.append(chip);
  } else if (onThreadOnly) row.append(h('span', 'pill unplaced', e.label));
  else row.append(h('span', 'pill unplaced', 'No place yet'));
  for (const a of e.also || []) row.append(placeOff(e, a));
  for (const t of e.threads || []) {
    const chip = h('span', 'chip thread nb-thread-chip');
    chip.append(icon('threads', 12), button('link-btn', t.name, () => void openThreadPage(t.name)));
    const x = button('member-x shown', '', async () => { await wb(['note', 'thread', e.id, t.id, '--remove']); changed('notes', 'threads'); }, 'x');
    x.title = `Take it off ${t.name}`;
    chip.append(x);
    row.append(chip);
  }
  if (!onThreadOnly) {
    const addPlace = button('chip nb-add', '+ Place', ev => {
      const from = ev.currentTarget as HTMLElement;
      if (!e.id) return placeMenu(from, { id: '', placed: false, label: '', offer: null }, undefined, at => { draft!.at = at; void pane?.refresh?.(); });
      placeMenu(from, e, e.placed ? (e.kind === 'note' ? 'also' : undefined) : undefined);
    });
    row.append(addPlace);
  }
  if (e.id) row.append(button('chip nb-add', '+ Thread', ev => threadChooser(ev.currentTarget as HTMLElement, name => putOnThread(e.id, name))));
  if (e.kind === 'question' && e.id) {
    const done = e.status === 'done';
    row.append(button(`link-btn${done ? '' : ' answered'}`, done ? 'Open it again' : '✓ Answered', async () => { await wb(['note', 'answered', e.id, ...(done ? ['--open'] : [])]); changed(); }));
  }
  return row;
}

// The format bar writes Markdown into the text, as plain text: # a heading, **bold**, *italics*, - a list, 1. a numbered
// list, > a quote; then a reference to the place picked in the reader, a [[link]] to another note, and ? to ask it.
function formatBar(e: Entry): HTMLElement {
  const bar = h('div', 'nb-format');
  const act = (label: string, what: string, fn: (ta: HTMLTextAreaElement) => void, cls = '') => {
    const b = h('button', `nb-fmt ${cls}`, label);
    b.title = what;
    b.setAttribute('aria-label', what);
    b.onmousedown = ev => ev.preventDefault(); // keep the cursor in the text
    b.onclick = () => { const ta = editText(); if (ta) { fn(ta); ta.dispatchEvent(new Event('input')); } };
    bar.append(b);
  };
  act('H', 'A heading', ta => lines(ta, l => (l.startsWith('# ') ? l.slice(2) : `# ${l.replace(/^#+\s*/, '')}`)));
  act('B', 'Bold (Ctrl+B)', ta => wrap(ta, '**'), 'b');
  act('I', 'Italics (Ctrl+I)', ta => wrap(ta, '*'), 'i');
  act('•', 'A list', ta => lines(ta, l => (l.startsWith('- ') ? l.slice(2) : `- ${l}`)));
  act('1.', 'A numbered list', ta => { let n = 0; lines(ta, l => (/^\d+\. /.test(l) ? l.replace(/^\d+\. /, '') : `${++n}. ${l}`)); });
  act('“', 'A quote', ta => lines(ta, l => (l.startsWith('> ') ? l.slice(2) : `> ${l}`)));
  bar.append(h('span', 'nb-fmt-sep'));
  act('Place', 'Write the place picked in the reader into the text', ta => insert(ta, here().label));
  if (nbSettings.links) act('[[ ]]', 'A link to another note', ta => { insert(ta, '[['); linkSuggest(ta); });
  if (e.kind !== 'day' && e.kind !== 'thread' && !e.template) {
    const q = h('button', `nb-fmt${e.kind === 'question' ? ' on' : ''}`, '? Question');
    q.title = e.kind === 'question' ? 'Make it a plain note' : 'Ask it as a question';
    q.onclick = async () => {
      if (!e.id) { draft!.question = !draft!.question; return void pane?.refresh?.(); }
      if (!e.placed && !e.anchor && e.threads?.length) return toast('A note on a thread alone cannot be a question; give it a place first');
      await wb(['note', 'question', e.id, ...(e.kind === 'question' ? ['--plain'] : [])]);
      changed();
    };
    bar.append(q);
  }
  return bar;
}

/** The note's text: shown as a page (headings, lists, references and [[links]] working), and written as plain
 * Markdown in a box when clicked. It is saved as it is typed. */
function page(e: Entry): HTMLElement {
  const wrapEl = h('div', 'nb-body');
  const view = h('div', 'nb-page');
  if (e.text) view.append(render(e.text, e.refs || [], nbSettings.links ? e.links || [] : []));
  else view.append(h('p', 'muted nb-placeholder', placeholderFor(e)));
  view.onclick = ev => {
    if ((ev.target as HTMLElement).closest('a')) return;
    startEditing(wrapEl, e);
  };
  wrapEl.append(view);
  // a new note or a blank page opens ready to type
  if (!e.id || !e.text) requestAnimationFrame(() => { if (wrapEl.isConnected && !wrapEl.querySelector('textarea')) startEditing(wrapEl, e); });
  return wrapEl;
}

function placeholderFor(e: Entry) {
  if (draft?.hint) return draft.hint;
  if (e.kind === 'day') return 'Today’s dump: what you read, what to look up, what to come back to…';
  if (!e.id && draft?.at) return draft.question ? `Your question on ${draft.at.label}…` : `Your note on ${draft.at.label}…`;
  return 'The first line is its title…';
}

/** The box being written in; with none, one is started: a new block at the page's end, or the whole-text box. */
const editText = () => pane?.el.querySelector<HTMLTextAreaElement>('.nb-editor textarea.nb-input') ?? (() => {
  const w = pane?.el.querySelector<HTMLElement>('.nb-editor .nb-body');
  if (w && blocksData && blockHostNow) startWritingAtEnd(w, blocksData, blockHostNow);
  else if (w && shown) startEditing(w, shown);
  return pane?.el.querySelector<HTMLTextAreaElement>('.nb-editor textarea.nb-input') ?? null;
})();

/** What the Notebook lends a page drawn block by block (blocks.ts). */
function blockHost(e: Entry): Host {
  return {
    render: (text, refs, links) => render(text, refs, links as Link[]),
    refs: e.refs || [],
    links: nbSettings.links ? e.links || [] : [],
    linkSuggest,
    maybeSuggest: ta => { if (nbSettings.links) maybeSuggest(ta); },
    suggestKey: ev => !!suggestKey?.(ev),
    formatKey: (ev, ta) => {
      if (!(ev.ctrlKey || ev.metaKey)) return false;
      const k = ev.key.toLowerCase();
      if (k !== 'b' && k !== 'i') return false;
      ev.preventDefault();
      wrap(ta, k === 'b' ? '**' : '*');
      ta.dispatchEvent(new Event('input'));
      return true;
    },
    changed: () => changed(),
    redraw: () => void pane?.refresh?.(),
    open: id => openFromList(id),
    template: !!e.template,
    pageInside: async (title, after) => {
      await wb(['page', 'new', title, '--parent', e.id, '--link', ...(after ? ['--after', String(after)] : ['--first'])]);
      toast(`“${title}” is a page inside this one`);
      changed();
    },
  };
}

/** The pages above this one, from Pages down (each opens it); none for a note on a place that is inside no page. */
function pathOf(e: Entry): HTMLElement | null {
  if (e.template) {
    const nav = h('nav', 'nb-crumbs');
    nav.append(button('link-btn nb-crumb', 'Templates', () => showTemplates()), h('span', 'nb-crumb-sep', '/'), h('span', 'nb-crumb here', e.title || 'Untitled'));
    return nav;
  }
  const inTree = !!e.path?.length || (!!e.id && !e.placed && e.kind !== 'day') || (!e.id && !!draft?.parent);
  if (!inTree) return null;
  const nav = h('nav', 'nb-crumbs');
  nav.setAttribute('aria-label', 'The pages above this one');
  const pages = button('link-btn nb-crumb', 'Pages', () => { group = 'pages'; editorShown = false; mainList = null; void pane?.refresh?.(); });
  nav.append(pages);
  const above = e.path?.length ? e.path : !e.id && draft?.parent ? [{ id: draft.parent, title: '…' }] : [];
  for (const p of above) {
    nav.append(h('span', 'nb-crumb-sep', '/'), button('link-btn nb-crumb', p.title || 'Untitled', () => openNote(p.id)));
  }
  nav.append(h('span', 'nb-crumb-sep', '/'), h('span', 'nb-crumb here', e.title || (e.id ? 'Untitled' : 'A new page')));
  return nav;
}

/** The title, with its references and links working; a click elsewhere on it writes it anew (`wb page title`), and a
 * changed title offers to update the links to it. */
function editableTitle(el: HTMLElement, e: Entry, bd: Blocks) {
  const t = bd.title!;
  const raw = t.text.replace(/^\s*#+\s*/, '').trim();
  const skip = [...t.text].length - [...t.text.replace(/^\s*#+\s*/, '')].length;
  el.append(inlineOf([...e.text], t.start + skip, t.end, e.refs || [], nbSettings.links ? e.links || [] : []));
  el.classList.add('editable');
  el.title = 'Click to change the title';
  el.onclick = ev => {
    if ((ev.target as HTMLElement).closest('a')) return;
    const i = h('input', 'nb-title-input') as HTMLInputElement;
    i.value = raw;
    i.setAttribute('aria-label', 'The page’s title');
    el.replaceChildren(i);
    el.onclick = null;
    i.focus();
    i.select();
    let over = false;
    const finish = async (keep: boolean) => {
      if (over) return;
      over = true;
      const v = i.value.trim();
      if (keep && v && v !== raw) {
        try {
          await wb(['page', 'title', e.id, v]);
          if (nbSettings.links && (e.linked_from?.length ?? 0) > 0) offerRelink(e.id, raw, e.linked_from!.length);
          changed();
        } catch (x) { toast(String(x)); }
      }
      i.blur();
      void pane?.refresh?.();
    };
    i.onkeydown = ev2 => {
      if (ev2.key === 'Enter') { ev2.preventDefault(); void finish(true); }
      else if (ev2.key === 'Escape') { ev2.preventDefault(); ev2.stopPropagation(); void finish(false); }
    };
    i.onblur = () => void finish(true);
  };
}

let saving: Promise<void> = Promise.resolve();

function startEditing(wrapEl: HTMLElement, e: Entry) {
  if (wrapEl.querySelector('textarea')) return;
  const ta = h('textarea', 'nb-input') as HTMLTextAreaElement;
  ta.value = e.text;
  ta.placeholder = placeholderFor(e);
  ta.spellcheck = true;
  wrapEl.replaceChildren(ta);
  const fit = () => { ta.style.height = 'auto'; ta.style.height = `${Math.max(160, ta.scrollHeight + 2)}px`; };
  const titleEl = pane?.el.querySelector<HTMLElement>('.nb-editor .nb-title');
  const firstTitle = e.title;
  let id = e.id;
  let last = e.text;
  let timer = 0;
  const save = () => {
    clearTimeout(timer);
    const text = ta.value;
    if (text.trim() === last.trim()) return saving;
    saving = saving.then(async () => {
      if (text.trim() === last.trim()) return;
      try {
        if (!text.trim()) { if (id) toast('An empty note is not saved; delete it from ⋯ if it should go'); return; }
        let r: Entry;
        if (id) r = await wb(['note', 'text', id, '-'], text);
        else if (draft?.day) r = await wb(['day', 'text', '-', '--day', draft.day], text);
        else if (draft?.parent) r = await wb(['page', 'new', '-', '--parent', draft.parent], text);
        else r = await wb(['note', 'new', '-', ...(draft?.at ? ['--at', draft.at.anchor] : []), ...(draft?.question ? ['--question'] : [])], text);
        last = text;
        if (!id) { id = r.id; openId = r.id; draft = null; e.id = r.id; }
        changed();
      } catch (x) { toast(String(x)); }
    });
    return saving;
  };
  ta.oninput = () => {
    fit();
    if (titleEl && e.kind !== 'day') titleEl.textContent = titleOf(ta.value) || (e.kind === 'question' ? 'A new question' : 'A new page');
    clearTimeout(timer);
    timer = window.setTimeout(save, 700);
    if (nbSettings.links) maybeSuggest(ta);
  };
  ta.onkeydown = ev => {
    if (suggestKey?.(ev)) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'b') { ev.preventDefault(); wrap(ta, '**'); ta.dispatchEvent(new Event('input')); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'i') { ev.preventDefault(); wrap(ta, '*'); ta.dispatchEvent(new Event('input')); }
    else if (ev.key === 'Escape' || ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter')) { ev.preventDefault(); ev.stopPropagation(); ta.blur(); }
  };
  ta.onblur = () => {
    // a click on the format bar or a suggestion keeps the box
    setTimeout(async () => {
      if (document.activeElement === ta || !ta.isConnected) return;
      await save();
      const newTitle = titleOf(ta.value);
      if (id && nbSettings.links && firstTitle && newTitle && newTitle !== firstTitle && (e.linked_from?.length ?? 0) > 0) offerRelink(id, firstTitle, e.linked_from!.length);
      void pane?.refresh?.();
    }, 120);
  };
  fit();
  ta.focus();
  if (focusEditor === 'end' || !e.text) ta.setSelectionRange(ta.value.length, ta.value.length);
  else ta.setSelectionRange(ta.value.length, ta.value.length);
}

function titleOf(text: string) {
  const first = text.split('\n').map(l => l.trim()).find(l => l) || '';
  return first.replace(/^#+\s*/, '');
}

/** Renaming a note's title offers to update the links to it (wb note relink). */
function offerRelink(id: string, old: string, n: number) {
  const box = h('div', 'toast nb-relink');
  box.append(h('span', '', `The title changed. Update the ${n === 1 ? 'link' : `${n} notes’ links`} to it?`));
  const yes = button('btn soft small', 'Update', async () => {
    box.remove();
    try { const r = await wb(['note', 'relink', id, old]); toast(`Updated ${r.changed.length} note${r.changed.length === 1 ? '' : 's'}`); changed(); } catch (x) { toast(String(x)); }
  });
  const no = button('link-btn', 'Leave them', () => box.remove());
  box.append(yes, no);
  document.getElementById('overlay')!.append(box);
  setTimeout(() => box.remove(), 12000);
}

function afterEditorDrawn(edEl: HTMLElement) {
  const f = focusEditor;
  focusEditor = null;
  if (f && typeof f === 'object') {
    const hd = [...edEl.querySelectorAll<HTMLElement>('.nb-page [data-heading]')].find(x => x.dataset.heading!.toLowerCase() === f.heading.toLowerCase());
    if (hd) { hd.scrollIntoView({ block: 'start' }); hd.classList.add('flash'); setTimeout(() => hd.classList.remove('flash'), 1600); }
  } else if (f === 'end') {
    const w = edEl.querySelector<HTMLElement>('.nb-body');
    if (w && blocksData && blockHostNow) startWritingAtEnd(w, blocksData, blockHostNow);
    else if (w && shown && !w.querySelector('textarea')) startEditing(w, shown);
    return;
  }
  // a page drawn block by block: the writing Enter, Backspace or an arrow key asked for goes on in its block
  afterDrawn(edEl, blockHostNow as Host, blockHostNow ? blocksData : null);
}

// ---- Markdown as a page ------------------------------------------------------------------------------------------------

/** The text drawn as a page: # headings, - and 1. lists, > quotes, paragraphs; references and [[links]] as links;
 * **bold** and *italics*. Positions of references and links are in characters of the whole text (wb-core's). */
function render(text: string, refs: Found[], links: Link[]): DocumentFragment {
  const f = document.createDocumentFragment();
  const chars = [...text];
  let pos = 0;
  let list: HTMLElement | null = null;
  let para: HTMLElement | null = null;
  const lines = text.split('\n');
  for (const raw of lines) {
    const len = [...raw].length;
    const start = pos;
    pos += len + 1;
    const m = /^(#{1,6})\s+|^([-*])\s+|^(\d+)\.\s+|^>\s?/.exec(raw);
    const skip = m ? [...m[0]].length : 0;
    const inline = () => inlineOf(chars, start + skip, start + len, refs, links);
    if (!raw.trim()) { list = null; para = null; continue; }
    if (m?.[1]) {
      list = null; para = null;
      const hd = h(m[1].length === 1 ? 'h3' : 'h4', 'nb-h');
      hd.dataset.heading = raw.slice(m[0].length).trim();
      hd.append(inline());
      f.append(hd);
    } else if (m?.[2] || m?.[3]) {
      para = null;
      const tag = m[2] ? 'ul' : 'ol';
      if (!list || list.tagName.toLowerCase() !== tag) { list = h(tag); f.append(list); }
      const li = h('li');
      li.append(inline());
      list.append(li);
    } else if (m) {
      list = null; para = null;
      const q = h('blockquote');
      q.append(inline());
      f.append(q);
    } else {
      list = null;
      if (para) para.append(h('br'));
      else { para = h('p'); f.append(para); }
      para.append(inline());
    }
  }
  return f;
}

function inlineOf(chars: string[], from: number, to: number, refs: Found[], links: Link[]): DocumentFragment {
  const f = document.createDocumentFragment();
  const marks: ({ kind: 'link'; l: Link } | { kind: 'ref'; r: Found })[] = [];
  const ls = links.filter(l => l.start >= from && l.end <= to);
  for (const l of ls) marks.push({ kind: 'link', l });
  for (const r of refs) if (r.start >= from && r.end <= to && !ls.some(l => r.start < l.end && r.end > l.start)) marks.push({ kind: 'ref', r });
  marks.sort((a, b) => (a.kind === 'link' ? a.l.start : a.r.start) - (b.kind === 'link' ? b.l.start : b.r.start));
  let at = from;
  for (const mk of marks) {
    const s = mk.kind === 'link' ? mk.l.start : mk.r.start, e = mk.kind === 'link' ? mk.l.end : mk.r.end;
    if (s < at) continue;
    f.append(styled(chars.slice(at, s).join('')));
    if (mk.kind === 'ref') {
      const a = h('a', 'ref', chars.slice(s, e).join(''));
      a.href = mk.r.hash;
      a.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); void verseCard(mk.r.ref, a, ev); };
      refHover(a, mk.r.ref);
      f.append(a);
    } else {
      const l = mk.l;
      const a = h('a', `nb-link${l.to ? '' : ' missing'}`, l.shown || (l.heading ? `${l.title} › ${l.heading}` : l.title));
      a.href = '#';
      a.title = l.to ? (l.heading ? `${l.title}, at ${l.heading}` : l.title) : `No note is titled “${l.title}” yet`;
      a.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); followLink(l, a); };
      f.append(a);
    }
    at = e;
  }
  f.append(styled(chars.slice(at, to).join('')));
  return f;
}

/** **bold** and *italics* in plain text, as elements (never as HTML). */
function styled(s: string): DocumentFragment {
  const f = document.createDocumentFragment();
  const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/g;
  let at = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    f.append(s.slice(at, m.index));
    f.append(m[1] ? h('strong', '', m[1]) : h('em', '', m[2] ?? m[3]));
    at = m.index + m[0].length;
  }
  f.append(s.slice(at));
  return f;
}

function followLink(l: Link, a: HTMLElement) {
  if (l.to) return void openNote(l.to, l.heading || undefined);
  const box = h('div', 'menu-list');
  box.append(h('div', 'muted small nb-menu-note', `No note is titled “${l.title}” yet.`));
  box.append(button('menu-item', `Start “${l.title}”`, () => { close(); newNote({ at: null, question: false, text: `${l.title}\n` }); }));
  const close = popMenu(a, box, { width: 260 });
}

// ---- writing helpers for the format bar ------------------------------------------------------------------------------

function lines(ta: HTMLTextAreaElement, fn: (line: string) => string) {
  const v = ta.value;
  const s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  let e = v.indexOf('\n', ta.selectionEnd);
  if (e < 0) e = v.length;
  const out = v.slice(s, e).split('\n').map(fn).join('\n');
  ta.value = v.slice(0, s) + out + v.slice(e);
  ta.setSelectionRange(s, s + out.length);
  ta.focus();
}

function wrap(ta: HTMLTextAreaElement, mark: string) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const inside = v.slice(s, e) || 'text';
  ta.value = v.slice(0, s) + mark + inside + mark + v.slice(e);
  ta.setSelectionRange(s + mark.length, s + mark.length + inside.length);
  ta.focus();
}

function insert(ta: HTMLTextAreaElement, text: string) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const pad = s > 0 && !/\s/.test(v[s - 1]) && !text.startsWith('[[') ? ' ' : '';
  ta.value = v.slice(0, s) + pad + text + v.slice(e);
  const at = s + pad.length + text.length;
  ta.setSelectionRange(at, at);
  ta.focus();
}

// Typing [[ offers the notes' titles; a pick writes the title and ]] (finding ad58: every note, not 8; a list that
// scrolls, grouped, recent first; the arrow keys and Enter; beside the cursor, not under the whole page).
type Titled = { id: string; title: string; insert: string; kind: string; label: string; placed: boolean; updated: string };
let titlesCache: { at: number; list: Titled[] } | null = null;
let suggestClose: (() => void) | null = null;
/** While the list is open, the editor's keys go here first; true when the key was the list's. */
let suggestKey: ((ev: KeyboardEvent) => boolean) | null = null;

async function allTitles(): Promise<Titled[]> {
  if (titlesCache && performance.now() - titlesCache.at < 5000) return titlesCache.list;
  const d = await wb(['notebook', '--group', 'none']);
  const list: Titled[] = (d.groups as GroupOf[]).flatMap(g => g.entries).filter(e => e.title && (e.kind !== 'day' || e.exists !== false)).map(e => ({
    id: e.id, title: e.title, insert: e.kind === 'day' ? e.day! : e.title, kind: e.kind, placed: e.placed, updated: e.updated || e.created,
    label: e.kind === 'day' ? (e.today ? 'Today' : 'Day') : e.placed ? e.label : e.kind === 'question' ? 'Question' : '',
  }));
  list.sort((a, b) => b.updated.localeCompare(a.updated));
  titlesCache = { at: performance.now(), list };
  return list;
}

/** Where the cursor of a text box is on the screen, measured on a copy of the box laid out the same way. */
function caretRect(ta: HTMLTextAreaElement): DOMRect {
  const cs = getComputedStyle(ta);
  const m = document.createElement('div');
  for (const p of ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize'] as const) m.style[p] = cs[p];
  Object.assign(m.style, { position: 'fixed', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', left: '0', top: '0' });
  m.textContent = ta.value.slice(0, ta.selectionStart);
  const mark = document.createElement('span');
  mark.textContent = '​';
  m.append(mark);
  document.body.append(m);
  const r = ta.getBoundingClientRect(), k = mark.getBoundingClientRect();
  m.remove();
  return new DOMRect(r.left + k.left - ta.scrollLeft, r.top + k.top - ta.scrollTop, 1, k.height || parseFloat(cs.lineHeight) || 20);
}

function linkSuggest(ta: HTMLTextAreaElement) {
  void allTitles().then(all => {
    const before = ta.value.slice(0, ta.selectionStart);
    const open = before.lastIndexOf('[[');
    // (the titles came after the typing went on: a link already closed, or the box gone, opens no list)
    if (open < 0 || !ta.isConnected || before.slice(open).includes(']]') || before.slice(open).includes('\n')) return;
    const raw = before.slice(open + 2).trim();
    const typed = raw.toLowerCase();
    const list = all.filter(t => t.id !== shown?.id);
    const hits = typed ? list.filter(t => t.title.toLowerCase().includes(typed) || t.insert.toLowerCase().includes(typed)) : list;
    if (typed) hits.sort((a, b) => Number(!a.title.toLowerCase().startsWith(typed)) - Number(!b.title.toLowerCase().startsWith(typed)));
    suggestClose?.();
    const pick = (insert: string) => {
      close();
      const v = ta.value, end = ta.selectionStart;
      const after = v.slice(end).startsWith(']]') ? v.slice(end + 2) : v.slice(end);
      ta.value = v.slice(0, open) + `[[${insert}]]` + after;
      const at = open + insert.length + 4;
      ta.setSelectionRange(at, at);
      ta.focus();
      ta.dispatchEvent(new Event('input'));
    };
    const box = h('div', 'nb-suggest');
    box.append(h('div', 'nb-suggest-head', typed ? `Link to a note · ${hits.length} found` : 'Link to a note'));
    const scroll = h('div', 'nb-suggest-list');
    scroll.setAttribute('role', 'listbox');
    const rows: HTMLButtonElement[] = [];
    let on = -1;
    const mark = (i: number) => {
      rows[on]?.classList.remove('on');
      rows[on]?.removeAttribute('aria-selected');
      on = Math.max(0, Math.min(rows.length - 1, i));
      rows[on]?.classList.add('on');
      rows[on]?.setAttribute('aria-selected', 'true');
    };
    const row = (t: { title: string; label: string; insert: string }, cls = '') => {
      const b = button(`nb-suggest-row${cls}`, '', () => pick(t.insert));
      b.setAttribute('role', 'option');
      b.onmousedown = ev => ev.preventDefault();
      b.onmousemove = () => { if (rows[on] !== b) mark(rows.indexOf(b)); };
      b.append(h('span', 'nb-suggest-title', t.title));
      if (t.label) b.append(h('span', 'nb-suggest-label', t.label));
      rows.push(b);
      return b;
    };
    const section = (name: string, items: Titled[]) => {
      if (items.length) scroll.append(h('div', 'nb-suggest-group', name), ...items.map(t => row(t)));
    };
    if (typed) section('Notes', hits);
    else {
      const rest = hits.slice(5);
      section('Recent', hits.slice(0, 5));
      section('Days', rest.filter(t => t.kind === 'day'));
      section('At places', rest.filter(t => t.kind !== 'day' && t.placed));
      section('Not placed yet', rest.filter(t => t.kind !== 'day' && !t.placed));
    }
    if (raw && !all.some(t => t.title.toLowerCase() === typed || t.insert.toLowerCase() === typed)) {
      scroll.append(row({ title: `Link to “${raw}”`, label: 'no note yet', insert: raw }, ' new'));
    }
    if (!rows.length) box.append(h('p', 'muted small nb-suggest-empty', 'No notes yet to link to.'));
    box.append(scroll);
    if (rows.length) mark(0);
    // the list opens at the cursor: a 1-pixel mark there for the menu to sit beside
    const c = caretRect(ta);
    const at = h('div', 'nb-suggest-anchor');
    Object.assign(at.style, { position: 'fixed', left: `${c.left}px`, top: `${c.top}px`, width: '1px', height: `${c.height}px`, pointerEvents: 'none' });
    document.body.append(at);
    const closeMenu = popMenu(at, box, { width: 340 });
    at.remove(); // the menu is placed; the mark is not needed after
    const close = () => { closeMenu(); suggestKey = null; if (suggestClose === close) suggestClose = null; };
    suggestClose = close;
    suggestKey = ev => {
      if (!rows.length || !box.isConnected) return false;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        mark(on + (ev.key === 'ArrowDown' ? 1 : -1));
        rows[on].scrollIntoView({ block: 'nearest' });
        return true;
      }
      if ((ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey) || ev.key === 'Tab') {
        ev.preventDefault();
        rows[on]?.click();
        return true;
      }
      return false;
    };
  });
}

function maybeSuggest(ta: HTMLTextAreaElement) {
  const before = ta.value.slice(0, ta.selectionStart);
  const open = before.lastIndexOf('[[');
  if (open < 0 || before.slice(open).includes(']]') || before.slice(open).includes('\n')) { suggestClose?.(); return; }
  linkSuggest(ta);
}

// ---- the menus: a note's, the place picker, the Trash, settings ------------------------------------------------------

function editorMenu(from: HTMLElement, e: Entry, at?: { x: number; y: number }) {
  if (e.kind === 'thread') return threadMenu(from, e, at);
  const box = h('div', 'menu-list');
  let close = () => {};
  const item = (label: string, fn: () => void) => box.append(button('menu-item', label, () => { close(); fn(); }));
  // W5: a template's own: a page from it, or delete it
  if (e.template) {
    item('Make a page from it…', () => void newPage(undefined, e.id));
    box.append(h('div', 'menu-sep'));
    item('Delete this template (to the Trash)', () => remove(e));
    close = popMenu(from, box, { align: at ? 'left' : 'right', width: 250, at });
    return;
  }
  const onThreadOnly = e.placed && !e.anchor;
  if (e.kind !== 'day') {
    if (e.placed && !onThreadOnly) item('Move to another place…', () => placeMenu(from, e));
    if (!e.placed) item('Place it…', () => placeMenu(from, e));
    if (e.placed && !onThreadOnly) for (const a of [{ anchor: e.anchor, label: e.label }, ...(e.also || [])]) item(`Take it off ${a.label}`, () => takeOff(e.id, a));
    if (e.kind === 'question') item(e.status === 'done' ? 'Open it again' : 'Answered: mark it done', async () => { await wb(['note', 'answered', e.id, ...(e.status === 'done' ? ['--open'] : [])]); changed(); });
    if (!onThreadOnly) item(e.kind === 'question' ? 'Make it a plain note' : 'Make it a question', async () => { await wb(['note', 'question', e.id, ...(e.kind === 'question' ? ['--plain'] : [])]); changed(); });
    // W3: pages inside pages, and Pinned
    box.append(h('div', 'menu-sep'));
    const pinned = e.pinned !== null && e.pinned !== undefined;
    item(pinned ? 'Unpin' : 'Pin', async () => {
      try { await wb(['page', pinned ? 'unpin' : 'pin', e.id]); toast(pinned ? 'Taken out of Pinned' : 'Pinned'); changed(); } catch (x) { toast(String(x)); }
    });
    item('A page inside', () => newNote({ at: null, question: false, parent: e.id, hint: `A page inside “${e.title}”: the first line is its title…` }));
    item('Move inside…', () => void moveInside(from, e));
    // W6 (sheet W7.1): a Speaker Script and Verse by Verse from this page and the pages inside it
    item('Make a document…', () => void makeFromPage(e.id));
    item('Save as a template', async () => {
      try {
        const t = await wb(['template', 'save', e.id]);
        toast(`“${t.title}” is a template now, its places taken out`);
        changed();
        openPage(t.id);
      } catch (x) { toast(String(x)); }
    });
  }
  item(e.kind === 'day' ? 'Delete this page (to the Trash)' : 'Delete (to the Trash)', () => remove(e));
  close = popMenu(from, box, { align: at ? 'left' : 'right', width: 230, at });
}

// ---- right-click (debug-spec S3, finding b737): a page's menu at the pointer ------------------------------------------------

/** Opens the page's own menu (the one ⋯ opens: one builder, two ways to it) where the pointer is. `row` is what the
 *  menu is about, so Move inside… and Place it… open from it. A long press does the same on touch. */
function pageMenuAt(x: number, y: number, row: HTMLElement, id: string) {
  void (async () => {
    let e: Entry;
    try { e = await wb(['note', 'show', id]); } catch { return; }
    editorMenu(row, e, { x, y });
  })();
}

/** Makes a row open `menu` on a right-click, and on a long press (the touch devices that send no contextmenu). */
function onContext(row: HTMLElement, menu: (x: number, y: number) => void) {
  row.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    if (Date.now() - longAt < 700) return; // the long press opened it already
    menu(ev.clientX, ev.clientY);
  });
  let timer = 0, sx = 0, sy = 0, longAt = 0;
  const cancel = () => { clearTimeout(timer); timer = 0; };
  row.addEventListener('pointerdown', ev => {
    if (ev.pointerType !== 'touch') return;
    sx = ev.clientX; sy = ev.clientY;
    cancel();
    timer = window.setTimeout(() => { timer = 0; longAt = Date.now(); menu(sx, sy); }, 550);
  });
  row.addEventListener('pointermove', ev => { if (timer && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) cancel(); });
  for (const t of ['pointerup', 'pointercancel', 'dragstart'] as const) row.addEventListener(t, cancel);
}

/** A page's row (tree, Pinned, a list, a question, a template, a day) opens that page's menu on a right-click. */
const pageContext = (row: HTMLElement, id: string) => onContext(row, (x, y) => pageMenuAt(x, y, row, id));

/** Move inside…: every page it can go inside (not itself, nor a page inside it), as the tree; or the top of Pages. */
async function moveInside(from: HTMLElement, e: Entry) {
  const t = await wb(['page', 'tree']);
  const box = h('div', 'menu-list nb-move-menu');
  box.append(h('div', 'muted small nb-menu-note', `Put “${e.title}” inside`));
  const scroll = h('div', 'nb-move-list');
  const go = async (argv: string[], said: string) => {
    close();
    try { await wb(['page', 'move', e.id, ...argv]); toast(said); changed(); } catch (x) { toast(String(x)); }
  };
  if (e.parent) scroll.append(button('menu-item', 'Pages (inside no page)', () => go(['--top'], 'Moved to the top of Pages'), 'notebook'));
  const walk = (rows: Row[], depth: number) => {
    for (const r of rows) {
      if (r.id === e.id) continue; // itself, and the pages inside it, are not offered
      const b = button(`menu-item nb-move-row${r.id === e.parent ? ' on' : ''}`, r.title || 'Untitled', () => go(['--parent', r.id], `Put inside “${r.title}”`), r.placed ? 'pin' : 'notebook');
      b.style.paddingLeft = `${10 + depth * 16}px`;
      if (r.id === e.parent) b.disabled = true;
      scroll.append(b);
      walk(r.children || [], depth + 1);
    }
  };
  walk(t.pages, 0);
  if (!scroll.childElementCount) scroll.append(h('p', 'muted small nb-menu-note', 'No other pages yet.'));
  box.append(scroll);
  const close = popMenu(from, box, { align: 'right', width: 300 });
}

/** A note's place as a pill (a click goes there) with × to take it off: its first place too, the next then being its
 * place; its last place taken off makes it a page of its own (no place). */
function placeOff(e: Pick<Entry, 'id'>, at: At): HTMLElement {
  const chip = h('span', 'place-off');
  const x = button('member-x shown', '', () => takeOff(e.id, at), 'x');
  x.title = `Take it off ${at.label}`;
  x.setAttribute('aria-label', x.title);
  chip.append(placeOpen(at.label, at.anchor), x);
  return chip;
}

export async function takeOff(id: string, at: At) {
  try {
    const r = await wb(['note', 'unplace', id, at.anchor]);
    toast(!r.placed ? `Taken off ${at.label}: a page of its own now` : r.anchor ? `Taken off ${at.label}: now on ${r.label}` : `Taken off ${at.label}: ${r.label}`);
    changed();
  } catch (x) { toast(String(x)); }
}

/** Put a note on a thread by name; a name no thread has starts a new thread. */
export async function putOnThread(id: string, name: string) {
  try {
    const ts: any[] = await wb(['thread', 'list']);
    if (!ts.some(t => t.name.toLowerCase() === name.toLowerCase())) await wb(['thread', 'new', name]);
    await wb(['note', 'thread', id, name]);
    toast(`On ${name}`);
    changed('notes', 'threads');
  } catch (x) { toast(String(x)); }
}

export async function remove(e: Pick<Entry, 'id' | 'placed' | 'kind'> & { day?: string; anchor?: string }) {
  const what = e.kind === 'day' ? 'this page' : (e as Entry).template ? 'this template' : 'this note';
  if (!confirm(`Delete ${what}? It waits in the Trash for 7 days, then is erased.`)) return;
  if (e.kind === 'day') await wb(['day', 'rm', e.day!]);
  else if (!e.placed) await wb(['inbox', 'rm', e.id]);
  else if (e.kind === 'question') await wb(['trail', 'rm', e.id]);
  else await wb(['note', 'rm', e.id]);
  if (openId === e.id) { openId = null; editorShown = false; }
  changed();
}

function changed(...what: Change[]) {
  titlesCache = null;
  app.changed(...(what.length ? what : ['notes' as const]));
}

/** The chapter and the book around a verse picked in the reader, as places a note can have. */
function wider(at: At): { at: At; why: string }[] {
  const m = /^([1-3A-Z]{3})\.(\d+):/.exec(at.anchor);
  const b = m && book(m[1]);
  if (!m || !b || !nbSettings.chapters) return [];
  const out = [{ at: { anchor: `${b.name} ${m[2]}`, label: `${b.name} ${m[2]}` }, why: 'the whole chapter' }];
  if (b.chapters > 1) out.push({ at: { anchor: b.name, label: b.name }, why: 'the whole book' });
  return out;
}

// "Place this note on" (or, for a placed note, "Move this note to", or "Also on" for one more place): the place picked in
// the reader, its chapter and its book, the place the note names, or another typed. `pick` takes the place instead of
// writing it (a new note not saved yet).
export function placeMenu(from: HTMLElement, e: Pick<Entry, 'id' | 'placed' | 'label' | 'offer'>, mode?: 'also', pick?: (at: At) => void) {
  const box = h('div', 'place-menu');
  box.append(h('div', 'muted small', pick ? 'Put this note on' : mode === 'also' ? `Put this note on another place too (it stays on ${e.label})` : e.placed ? `Move this note from ${e.label} to` : 'Place this note on'));
  const go = async (at: At) => {
    close();
    if (pick) return pick(at);
    try {
      const argv = mode === 'also' ? ['note', 'also', e.id, at.anchor] : e.placed ? ['note', 'move', e.id, at.anchor] : ['note', 'place', e.id, at.anchor];
      const r = await wb(argv);
      toast(mode === 'also' ? `Also on ${r.also?.[r.also.length - 1]?.label ?? at.label}` : `${e.placed ? 'Moved' : 'Placed'} on ${r.label}`);
      changed();
    } catch (x) { toast(String(x)); }
  };
  const opt = (at: At, why: string, first: boolean) => {
    const b = h('button', `place-opt${first ? ' first' : ''}`);
    const t = h('div');
    t.append(h('div', 'place-opt-label', at.label), h('div', 'muted small', why));
    b.append(icon('pin'), t);
    b.onclick = () => go(at);
    box.append(b);
  };
  const picked = app.picked;
  const base = picked ?? here();
  opt(base, picked ? 'selected in the reader' : 'at the top of the reader', true);
  for (const w of wider(base)) opt(w.at, w.why, false);
  const offer = e.placed ? null : e.offer ?? null;
  if (offer && offer.anchor !== base.anchor) opt(offer, 'named in the note', false);
  const f = h('form', 'place-other');
  f.append(icon('pin'));
  const i = h('input', 'field') as HTMLInputElement;
  i.placeholder = 'Another place… (a verse, a chapter, a book)';
  f.append(i);
  f.onsubmit = ev => { ev.preventDefault(); if (i.value.trim()) go({ anchor: i.value.trim(), label: i.value.trim() }); };
  box.append(f);
  const close = popMenu(from, box, { width: 300 });
}

// Deleted notes, questions and pages: each waits 7 days, then the window erases it when it opens (wb trash empty).
async function trashList(two: boolean): Promise<HTMLElement[]> {
  const d = await wb(['trash']);
  const top = h('div', 'nb-head');
  top.append(button('link-btn nb-back shown', 'Notes', () => { showTrash = false; void pane?.refresh?.(); }, 'left'), h('span', 'nb-trash-title', 'Trash'));
  const scroll = h('div', 'nb-scroll');
  scroll.append(h('p', 'muted small nb-trash-about', `Deleted notes wait here ${d.days} days, then are erased. Put one back to keep it, or erase it now.`));
  for (const t of d.notes) {
    const c = h('div', 'note-card nb-entry trashed');
    const top2 = h('div', 'nb-top');
    if (t.question) top2.append(h('span', 'pill question-pill', '? Question'));
    top2.append(h('span', 'pill unplaced', t.kind === 'day' ? `The page for ${t.id.slice(2)}` : t.anchor || (t.kind === 'thread' ? 'On a thread' : 'No place')), h('span', 'grow'));
    const left = t.days_left === 0 ? 'erased next time the app opens' : `erased in ${t.days_left} day${t.days_left === 1 ? '' : 's'}`;
    top2.append(h('span', 'nb-time', left));
    c.append(top2, h('p', 'nb-text', t.text));
    const putBack = async () => { try { await wb(['trash', 'restore', t.name]); toast('Put back'); changed(); } catch (x) { toast(String(x)); } };
    // the only erase besides the 7 days (the person's decision, 2026-11-04), asked first
    const eraseNow = async () => {
      if (!confirm(`Erase this ${t.question ? 'question' : t.kind === 'day' ? 'page' : 'note'} now? It cannot be put back.`)) return;
      try { await wb(['trash', 'erase', t.name]); toast('Erased'); changed(); } catch (x) { toast(String(x)); }
    };
    const acts = h('div', 'nb-acts');
    acts.append(button('btn soft small', 'Put it back', putBack));
    acts.append(h('span', 'grow'), button('link-btn danger', 'Erase now', eraseNow, 'trash'));
    c.append(acts);
    // S3: a right-click on a deleted note offers the same two
    onContext(c, (x, y) => {
      const box = h('div', 'menu-list');
      let close = () => {};
      box.append(button('menu-item', 'Put it back', () => { close(); void putBack(); }), button('menu-item', 'Erase now', () => { close(); void eraseNow(); }));
      close = popMenu(c, box, { width: 190, at: { x, y } });
    });
    scroll.append(c);
  }
  if (!d.notes.length) scroll.append(h('p', 'muted nb-empty', 'Nothing deleted.'));
  return two ? [top, scroll] : [top, sectionsRow(), scroll];
}

// Settings → Notebook (N4). Until the Settings window (tier 5), in the Notebook's ⋯ menu; kept in settings/notebook.json.
function settingsMenu(from: HTMLElement) {
  const box = h('div', 'nb-settings');
  box.append(h('div', 'nb-settings-head', 'Notebook settings'));
  const toggle = (key: keyof NotebookSettings, label: string, what: string) => {
    const row = h('label', 'nb-set-row');
    const t = h('div');
    t.append(h('div', 'nb-set-label', label), h('div', 'muted small', what));
    const cb = h('input') as HTMLInputElement;
    cb.type = 'checkbox';
    cb.className = 'switch';
    cb.checked = !!nbSettings[key];
    cb.onchange = () => save(key, cb.checked ? 'on' : 'off');
    row.append(t, cb);
    box.append(row);
  };
  const save = saveSetting;
  // W1 (finding e09e): what is left is what acts on the whole Notebook. Follow the reader moved to Places itself; notes
  // on chapters and books are always offered; the Inbox is gone (a note with no place is a page). `wb settings notebook`
  // still sets every key.
  toggle('today', 'Today’s page', 'A note for each day, made when you first write in it');
  toggle('links', 'Links between notes', '[[title]] and [[title#heading]], as in Obsidian');
  const g = h('div', 'nb-set-row nb-set-opens');
  g.append(h('div', 'nb-set-label', 'Opens with'));
  const sel = h('select', 'field nb-set-group') as HTMLSelectElement;
  for (const [v, label] of SECTIONS) {
    const o = h('option', '', label) as HTMLOptionElement;
    o.value = v;
    o.selected = nbSettings.group === v;
    sel.append(o);
  }
  sel.onchange = () => void save('group', sel.value);
  g.append(sel);
  box.append(g);
  // W4: what a plain click on a place does (Ctrl+click does the other)
  const pl = h('div', 'nb-set-row nb-set-places');
  const plt = h('div');
  plt.append(h('div', 'nb-set-label', 'Places open in…'), h('div', 'muted small', 'What a click on a place does; Ctrl+click does the other'));
  const ps = h('select', 'field nb-set-open') as HTMLSelectElement;
  for (const [v, label] of [['reader', 'The reader'], ['new', 'A new reader']] as const) {
    const o = h('option', '', label) as HTMLOptionElement;
    o.value = v;
    o.selected = nbSettings.places === v;
    ps.append(o);
  }
  ps.onchange = () => void save('places', ps.value);
  pl.append(plt, ps);
  box.append(pl);
  const k = h('form', 'nb-set-row');
  k.append(h('div', 'nb-set-label', 'Quick capture'));
  const key = h('input', 'field nb-set-key') as HTMLInputElement;
  key.value = nbSettings.capture;
  key.onchange = () => void save('capture', key.value);
  k.onsubmit = ev => { ev.preventDefault(); void save('capture', key.value); };
  k.append(key);
  box.append(k);
  const tp = button('link-btn nb-set-templates', 'Templates…', () => { closeSet(); showTemplates(); }, 'notebook');
  tp.title = 'Your templates: pages that new pages start from';
  box.append(tp);
  const closeSet = popMenu(from, box, { align: 'right', width: 340 });
}

async function saveSetting(key: string, value: string) {
  try { Object.assign(nbSettings, await wb(['settings', 'notebook', key, value])); opens.where = nbSettings.places === 'new' ? 'new' : 'reader'; void pane?.refresh?.(); }
  catch (x) { toast(String(x)); }
}

// ---- views and templates (W5) ------------------------------------------------------------------------------------------

/** A view's line typed in the command field (`notebook @Num 25 questions`): the notes it finds, in the main column, the
 * same rows as a view block and `wb view run`. */
export function openNotebookView(line: string) {
  const l = line.trim();
  mainList = { kind: 'view', line: /^notebook\b/i.test(l) ? l : `notebook ${l}` };
  openId = null; draft = null; editorShown = true; showTrash = false;
  const was = dock.find('notebook');
  const p = openNotebook();
  if (was) void p.refresh?.();
  return p;
}

/** Open a note from a list in the main column (a view, Templates): Back returns to the list. */
function openFromList(id: string) {
  openId = id.includes('#') ? id.split('#')[0] : id; draft = null; editorShown = true; focusEditor = null; showTrash = false;
  if (!pane) { void openNote(id); return; }
  void pane.refresh?.();
}

/** The Templates page (sheet W6.3), in the main column. */
function showTemplates() {
  mainList = { kind: 'templates' };
  openId = null; draft = null; editorShown = true; showTrash = false;
  const p = openNotebook();
  void p.refresh?.();
}

const usedText = (n: number) => (n === 0 ? 'not used yet' : n === 1 ? 'used once' : `used ${n} times`);
const readerChapter = () => { const d = app.drawn; return d ? `${d.chapter.name} ${d.chapter.chapter}` : ''; };

async function viewListView(m: { kind: 'view'; line: string }): Promise<HTMLElement[]> {
  const head = h('div', 'nb-ed-head');
  if (!wide()) head.append(button('link-btn nb-back shown', 'Notes', () => { mainList = null; editorShown = false; void pane?.refresh?.(); }, 'left'));
  const crumbs = h('nav', 'nb-crumbs');
  crumbs.append(h('span', 'nb-crumb', 'A view'), h('span', 'nb-crumb-sep', '/'), h('span', 'nb-crumb here', m.line));
  head.append(crumbs, h('span', 'grow'));
  const box = h('div', 'nb-view nb-viewlist');
  const top = h('div', 'nbv-head');
  top.append(icon('filter', 14), h('span', 'nbv-line nbv-line-shown', m.line), h('span', 'grow'));
  const rows = h('div', 'nbv-rows');
  box.append(top, rows);
  try {
    const r = await wb(['view', 'run', m.line]);
    top.append(h('span', 'nbv-count muted small', `${r.count} found`));
    for (const x of r.rows) rows.append(viewRow(x, { open: openFromList }));
    if (!r.rows.length) rows.append(h('p', 'muted small nbv-note', 'Nothing found yet.'));
  } catch (x) { rows.append(h('p', 'small nbv-note nbv-error', String(x))); }
  const about = h('p', 'muted small nb-list-about', 'A view: the notes this line finds, kept up to date. In a page, / → View keeps it there. It reads; it never writes.');
  return [head, h('h2', 'nb-title', 'A view'), about, box];
}

async function templatesView(): Promise<HTMLElement[]> {
  const ts: Tpl[] = (await wb(['template', 'list'])).templates;
  const head = h('div', 'nb-ed-head');
  if (!wide()) head.append(button('link-btn nb-back shown', 'Notes', () => { mainList = null; editorShown = false; void pane?.refresh?.(); }, 'left'));
  head.append(h('span', 'grow'), h('span', 'muted small nb-tpl-count', `${ts.length} template${ts.length === 1 ? '' : 's'}`));
  const plus = button('btn soft small nb-tpl-new', 'A new template', () => void newTemplate(), 'plus');
  head.append(plus);
  const how = button('link-btn nb-tpl-how', 'How templates work', () => openHelp('templates'));
  how.prepend(h('span', 'nb-tpl-q', '?'));
  const list = h('div', 'nb-tpl-list');
  for (const t of ts) {
    const card = h('div', 'tp-card');
    card.dataset.id = t.id;
    const open = h('button', 'tp-open') as HTMLButtonElement;
    const txt = h('div', 'tp-text');
    const holds = t.headings.length ? t.headings.join(', ') : t.summary;
    txt.append(h('div', 'tp-name', t.title), h('div', 'muted small tp-holds', `${holds}${t.asks === 'place' ? ' · asks for a place' : ''}`));
    open.append(icon('notebook'), txt);
    open.onclick = () => openFromList(t.id);
    const more = button('icon-btn small tp-more', '', () => {
      const box = h('div', 'menu-list');
      const it = (label: string, fn: () => void) => box.append(button('menu-item', label, () => { close(); fn(); }));
      it('Open it', () => openFromList(t.id));
      it('Make a page from it…', () => void newPage(undefined, t.id));
      it('Delete (to the Trash)', () => void remove({ id: t.id, placed: false, kind: 'note', template: true } as Entry));
      const close = popMenu(more, box, { align: 'right', width: 220 });
    }, 'more');
    more.setAttribute('aria-label', `Change ${t.title}`);
    card.append(open, h('span', 'muted small tp-used', usedText(t.used)), more);
    list.append(card);
  }
  if (!ts.length) list.append(h('p', 'muted nb-empty', 'No templates yet. A new template starts an empty one; on any page, ⋯ → Save as a template copies it.'));
  const note = h('div', 'nb-tpl-note muted small');
  note.append(icon('notebook', 14), h('span', '', 'Templates are notes like any other (template: true), so the Python app and Obsidian open them; the Notebook leaves them out of Pages, Places and search unless asked.'));
  return [head, h('h2', 'nb-title', 'Templates'), how, list, note];
}

/** + beside Templates: an empty template, opened to be written. */
async function newTemplate() {
  try {
    const have: Tpl[] = (await wb(['template', 'list'])).templates;
    let name = 'New template';
    for (let i = 2; have.some(t => t.title.toLowerCase() === name.toLowerCase()); i++) name = `New template ${i}`;
    const t = await wb(['template', 'new', name]);
    toast('An empty template: click its title to name it, then write its blocks');
    changed();
    openFromList(t.id);
  } catch (x) { toast(String(x)); }
}

function templateAbout(): HTMLElement {
  const box = h('div', 'nb-tpl-about');
  box.append(icon('notebook', 14), h('span', '', 'A template. New page → From a template copies these blocks into a new page and fills the blanks in braces then: {place}, {date}, {title}, {reader}. Type { to add one.'));
  return box;
}

/** A template's settings (sheet W6.2): the name new pages get, what it asks for, where they go. */
function templateSettings(t: Tpl): HTMLElement {
  const box = h('div', 'nb-tpl-settings');
  const set = async (argv: string[]) => {
    try { await wb(['template', 'set', t.id, ...argv]); changed(); } catch (x) { toast(String(x)); void pane?.refresh?.(); }
  };
  const row = (label: string, value: HTMLElement) => { const r = h('div', 'nb-tpl-row'); r.append(h('span', 'muted', label), value); box.append(r); };
  const names = h('button', 'nb-tpl-names', t.new_name) as HTMLButtonElement;
  names.title = 'Click to change the name new pages get (blanks like {place} allowed)';
  names.onclick = () => {
    const i = h('input', 'field nb-tpl-names-input') as HTMLInputElement;
    i.value = t.new_name;
    i.setAttribute('aria-label', 'The name new pages get');
    names.replaceWith(i);
    i.focus();
    i.select();
    let over = false;
    const end = (keep: boolean) => { if (over) return; over = true; const v = i.value.trim(); if (keep && v && v !== t.new_name) void set(['--names', v]); else void pane?.refresh?.(); };
    i.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); end(true); } else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); end(false); } };
    i.onblur = () => end(true);
  };
  row('Names new pages', names);
  const asks = h('select', 'field small nb-tpl-asks') as HTMLSelectElement;
  for (const [v, label] of [['place', 'A place'], ['nothing', 'Nothing']]) {
    const o = h('option', '', label) as HTMLOptionElement;
    o.value = v;
    o.selected = (t.asks === 'place') === (v === 'place');
    asks.append(o);
  }
  asks.onchange = () => void set(['--asks', asks.value]);
  row('Asks for', asks);
  const goes = h('select', 'field small nb-tpl-goes') as HTMLSelectElement;
  const opt = (v: string, label: string) => { const o = h('option', '', label) as HTMLOptionElement; o.value = v; o.selected = (t.goes_in || '') === v; goes.append(o); };
  opt('', 'Pages');
  if (t.goes_in && t.goes_in_title) opt(t.goes_in, String(t.goes_in_title));
  void wb(['page', 'tree']).then(tree => {
    const walk = (rows: Row[], depth: number) => { for (const r of rows) { if (r.id !== t.goes_in) opt(r.id, `${'  '.repeat(depth)}${r.title || 'Untitled'}`); walk(r.children || [], depth + 1); } };
    walk(tree.pages, 1);
  }).catch(() => {});
  goes.onchange = () => void set(['--goes-in', goes.value || 'pages']);
  row('Puts them in', goes);
  return box;
}

/** The pen, or + beside Pages (sheet W6.1): with templates, A new page asks Blank page or one of them; with none, a
 * blank page at once. `pick`: the template to show first. */
async function newPage(parent?: { id: string; title: string }, pick?: string) {
  let ts: Tpl[] = [];
  try { ts = (await wb(['template', 'list'])).templates; } catch { /* none */ }
  const blank = () => newNote(parent ? { at: null, question: false, parent: parent.id, hint: `A page inside “${parent.title}”: the first line is its title…` } : undefined);
  if (!ts.length) return blank();
  const overlay = document.getElementById('overlay')!;
  overlay.querySelectorAll('.np-wrap').forEach(x => x.remove());
  const wrap = h('div', 'plan-modal-wrap np-wrap');
  const box = h('section', 'plan-modal np-modal');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'A new page');
  wrap.append(box);
  overlay.append(wrap);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', key, true); };
  const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
  document.addEventListener('keydown', key, true);
  wrap.onmousedown = ev => { if (ev.target === wrap) close(); };
  const top = h('header', 'plan-modal-head');
  const tt = h('div');
  tt.append(h('h2', 'plan-modal-title', 'A new page'), h('div', 'muted small', parent ? `Inside “${parent.title}”: blank, or from one of your templates` : 'Blank, or from one of your templates'));
  const x = button('icon-btn np-close', '', close, 'x');
  x.setAttribute('aria-label', 'Close');
  top.append(tt, x);
  const grid = h('div', 'np-grid');
  const left = h('div', 'np-left'), right = h('div', 'np-right');
  grid.append(left, right);
  const foot = h('div', 'plan-modal-foot');
  const make = button('btn primary np-make', 'Make the page', () => void go());
  foot.append(h('span'), button('btn np-cancel', 'Cancel', close), make);
  box.append(top, grid, foot);
  let chosen = pick && ts.some(t => t.id === pick) ? pick : '';
  // what the form holds for the template chosen
  let forIn: HTMLInputElement | null = null, nameIn: HTMLInputElement | null = null, goesIn: HTMLSelectElement | null = null;
  let nameTouched = false;
  const opts: HTMLButtonElement[] = [];
  const option = (id: string, label: string, sub: string) => {
    const b = h('button', `np-opt${id === chosen ? ' on' : ''}`) as HTMLButtonElement;
    b.dataset.id = id;
    b.append(icon(id ? 'notebook' : 'pen'));
    const t = h('div');
    t.append(h('div', 'np-opt-name', label));
    if (sub) t.append(h('div', 'muted small np-opt-sub', sub));
    b.append(t);
    b.onclick = () => { chosen = id; for (const o of opts) o.classList.toggle('on', o.dataset.id === id); nameTouched = false; drawRight(); };
    opts.push(b);
    left.append(b);
  };
  option('', 'Blank page', '');
  left.append(h('div', 'muted small np-group', 'Your templates'));
  for (const t of ts) option(t.id, t.title, t.headings.length ? t.headings.join(', ') : t.summary);
  const edit = button('link-btn np-edit', 'Edit your templates', () => { close(); showTemplates(); }, 'pen');
  left.append(edit);
  let seq = 0;
  const preview = h('div', 'np-preview');
  const refresh = async () => {
    const t = ts.find(x => x.id === chosen);
    if (!t) return;
    const n = ++seq;
    const place = forIn?.value.trim() || '';
    try {
      const r = await wb(['template', 'show', t.id, ...(place ? ['--place', place] : []), ...(readerChapter() ? ['--reader', readerChapter()] : [])]);
      if (n !== seq) return;
      if (r.made) {
        if (nameIn && !nameTouched) nameIn.value = r.made.title;
        preview.replaceChildren(...previewOf(r.made.text));
      } else preview.replaceChildren(h('p', 'muted small', 'Give the place it asks for to see the page.'));
    } catch (x2) { if (n === seq) preview.replaceChildren(h('p', 'small nbv-error', String(x2))); }
  };
  let timer = 0;
  const drawRight = () => {
    right.replaceChildren();
    const t = ts.find(x => x.id === chosen);
    if (!t) {
      forIn = nameIn = null; goesIn = null;
      right.append(h('div', 'np-name-head', 'Blank page'), h('p', 'muted small', parent ? `A page inside “${parent.title}”, ready to write: its first line is its title.` : 'A page of its own, ready to write: its first line is its title.'));
      return;
    }
    right.append(h('div', 'np-name-head', t.title));
    const lab = (text: string, req?: boolean) => { const l = h('div', 'np-label', text); if (req !== undefined) l.append(h('span', req ? 'req' : 'opt muted', req ? ' required' : ' optional')); return l; };
    right.append(lab('For', t.asks === 'place'));
    forIn = h('input', 'field np-for') as HTMLInputElement;
    forIn.value = readerChapter();
    forIn.placeholder = 'A place: Num 25, Num 25:10-13, Numbers';
    forIn.oninput = () => { clearTimeout(timer); timer = window.setTimeout(() => void refresh(), 250); };
    forIn.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); void go(); } };
    right.append(forIn, h('div', 'muted small np-fills', 'Fills {place} in the template'));
    const r1 = h('div', 'np-row');
    nameIn = h('input', 'field np-name') as HTMLInputElement;
    nameIn.setAttribute('aria-label', 'The new page’s name');
    nameIn.oninput = () => { nameTouched = true; };
    nameIn.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); void go(); } };
    r1.append(h('span', 'muted small', 'The new page’s name'), nameIn);
    const r2 = h('div', 'np-row');
    goesIn = h('select', 'field small np-goes') as HTMLSelectElement;
    const want = parent?.id || t.goes_in || '';
    const add = (v: string, label: string) => { const o = h('option', '', label) as HTMLOptionElement; o.value = v; o.selected = v === want; goesIn!.append(o); };
    add('', 'Pages');
    if (parent) add(parent.id, parent.title);
    else if (t.goes_in && t.goes_in_title) add(t.goes_in, String(t.goes_in_title));
    void wb(['page', 'tree']).then(tree => {
      const walk = (rows: Row[], depth: number) => { for (const r of rows) { if (r.id !== want) add(r.id, `${'  '.repeat(depth)}${r.title || 'Untitled'}`); walk(r.children || [], depth + 1); } };
      walk(tree.pages, 1);
    }).catch(() => {});
    r2.append(h('span', 'muted small', 'Goes in'), goesIn);
    right.append(r1, r2, preview);
    preview.replaceChildren(h('p', 'muted small', 'Reading the template…'));
    void refresh();
  };
  const go = async () => {
    const t = ts.find(x => x.id === chosen);
    if (!t) { close(); blank(); return; }
    const place = forIn?.value.trim() || '';
    if (t.asks === 'place' && !place) { toast(`“${t.title}” asks for a place`); forIn?.focus(); return; }
    const argv = ['page', 'new', '--template', t.id, ...(place ? ['--place', place] : []), ...(readerChapter() ? ['--reader', readerChapter()] : [])];
    const name = nameIn?.value.trim();
    if (name) argv.push('--title', name);
    if (goesIn?.value) argv.push('--parent', goesIn.value);
    make.disabled = true;
    try {
      const r = await wb(argv);
      close();
      toast(`“${r.title}” made from ${t.title}`);
      changed();
      openPage(r.id);
    } catch (x2) { toast(String(x2)); make.disabled = false; }
  };
  drawRight();
  (opts.find(o => o.dataset.id === chosen) || opts[0]).focus();
}

/** A page made from a template, as it will read (the preview in A new page): headings, its blocks in short, a
 * scripture block or a view as what it will show. */
function previewOf(text: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  const ls = text.split('\n').slice(1);
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    const fm = /^\s*(```|~~~)\s*(\w*)/.exec(l);
    if (fm) {
      const inner: string[] = [];
      for (i++; i < ls.length && !ls[i].trim().startsWith(fm[1]); i++) inner.push(ls[i]);
      const lang = fm[2].toLowerCase();
      const first = (inner.find(x => x.trim()) || '').trim();
      const d = h('div', 'np-pv-fence');
      if (lang === 'scripture') d.append(icon('book', 14), h('span', '', `Scripture: ${first || '…'}, from the Bible`));
      else if (lang === 'view') d.append(icon('filter', 14), h('span', '', `View: ${first || '…'}`));
      else d.append(h('span', '', inner.join(' ')));
      out.push(d);
      continue;
    }
    if (!l.trim()) continue;
    const hm = /^#{1,6}\s+(.*)/.exec(l);
    if (hm) { out.push(h('div', 'np-pv-h', hm[1])); continue; }
    const td = /^\s*[-*+]\s+\[[ xX]\]\s?(.*)/.exec(l);
    if (td) { out.push(h('div', 'np-pv-li', `☐ ${td[1]}`)); continue; }
    const li = /^\s*(?:[-*+]|\d+[.)])\s+(.*)/.exec(l);
    if (li) { out.push(h('div', 'np-pv-li', `• ${li[1]}`)); continue; }
    out.push(h('div', 'np-pv-p', l.trim()));
  }
  if (!out.length) out.push(h('p', 'muted small', 'The template is empty: the page will have its name only.'));
  return out;
}

// ---- writing on a place, and quick capture -----------------------------------------------------------------------------

/** Write a note (or a question) on a place: a new note in the editor, with the place chosen and the cursor in it. */
export async function writeInNotebook(at: At, question: boolean) {
  openId = null;
  draft = { at, question };
  editorShown = true;
  focusEditor = 'end';
  showTrash = false;
  const p = openNotebook();
  await p.refresh?.();
}

/** The quick capture key (Ctrl+J unless set otherwise) as pressed. */
export function isCaptureKey(e: KeyboardEvent) {
  const parts = nbSettings.capture.split('+');
  const k = parts[parts.length - 1].toLowerCase();
  return e.key.toLowerCase() === k && (e.ctrlKey || e.metaKey) === parts.includes('Ctrl') && e.altKey === parts.includes('Alt') && e.shiftKey === parts.includes('Shift');
}

let captureEl: HTMLElement | null = null;

/** Quick capture (B2): a small box at the verse last clicked (or at the top of the reader). Enter saves a short note
 * there; Ctrl+Enter saves it and opens it in the Notebook to keep writing. The place can be taken off (a page of its own), and ?
 * asks it as a question. */
export function quickCapture() {
  captureEl?.remove();
  let at: At | null = app.picked ?? here();
  let question = false;
  const box = h('div', 'capture');
  captureEl = box;
  const head = h('div', 'capture-head');
  head.append(h('span', 'capture-title', 'A thought'), h('kbd', '', nbSettings.capture));
  const row = h('div', 'capture-input');
  row.append(icon('pen'));
  const input = h('input', 'capture-field') as HTMLInputElement;
  input.placeholder = 'Write it down…';
  row.append(input);
  const foot = h('div', 'capture-foot');
  const place = h('span', 'capture-place');
  const drawPlace = () => {
    place.replaceChildren();
    if (at) {
      const chip = h('span', 'place-off');
      const x = button('member-x shown', '', () => { at = null; drawPlace(); input.focus(); }, 'x');
      x.title = 'No place: a page of its own';
      chip.append(placePill(at.label), x);
      place.append(chip);
    } else place.append(button('chip nb-add', '+ Place', () => { at = app.picked ?? here(); drawPlace(); input.focus(); }));
  };
  drawPlace();
  const q = button('chip question-chip', '? Question', () => { question = !question; q.classList.toggle('on', question); input.focus(); });
  foot.append(place, q, h('span', 'grow'), h('span', 'muted small', 'Enter saves · Ctrl+Enter: keep writing'));
  box.append(head, row, foot);
  document.getElementById('overlay')!.append(box);
  // beside the verse last clicked, else near the top of the reader
  const v = at && /\.(\d+):(\d+)/.exec(at.anchor);
  const vn = v ? document.querySelector<HTMLElement>(`#reader .vn[data-v="${v[2]}"]`) : null;
  const reader = document.getElementById('scroller') || document.body;
  const rr = reader.getBoundingClientRect();
  const w = Math.min(520, window.innerWidth - 24);
  box.style.width = `${w}px`;
  const anchorTop = vn ? vn.getBoundingClientRect().bottom + 10 : rr.top + 80;
  const left = vn ? vn.getBoundingClientRect().left : rr.left + (rr.width - w) / 2;
  box.style.left = `${Math.max(12, Math.min(left, window.innerWidth - w - 12))}px`;
  box.style.top = `${Math.max(12, Math.min(anchorTop, window.innerHeight - box.offsetHeight - 12))}px`;
  const close = () => { box.remove(); if (captureEl === box) captureEl = null; document.removeEventListener('pointerdown', outside, true); };
  const outside = (e: PointerEvent) => { if (!box.contains(e.target as Node)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
  input.onkeydown = async e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const keep = e.ctrlKey || e.metaKey;
    try {
      const r = await wb(['note', 'new', '-', ...(at ? ['--at', at.anchor] : []), ...(question ? ['--question'] : [])], text);
      close();
      changed();
      // to keep writing: a new block under what was captured
      if (keep) await openNote(r.id, undefined, true);
      else toast(at ? `Written on ${at.label}` : 'Written as a page of its own (no place yet)');
    } catch (x) { toast(String(x)); }
  };
  input.focus();
}

/** Ctrl+J from before quick capture: kept for `wb do` and older callers. */
export const writeInNotebookNow = () => quickCapture();

// ---- a thread as a page (R1, sheets R1.1 and R1.2) -----------------------------------------------------------------------
// A thread's page is the thread's file read as a page: its note is the page's text, written block by block (the page id is
// thread:<slug>, so every `wb page` and `wb block` command takes it), its places are the thread's own list in its own order
// (drag by the grip, × takes one out, + Place adds the place at the reader), and the pages written on it are under it.
// Rename, color, Bible order, Pin and Delete are in ⋯; Drawn in the reader is the eye the Threads window had.

/** Open a thread's page by its name or slug (a chip, a set's item, the command field's `thread`). */
export async function openThreadPage(name: string) {
  const t = await wb(['thread', 'show', name]);
  mainList = null;
  await openNote(`thread:${t.id}`);
}

const THREAD_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'];

function askText(from: HTMLElement, label: string, value: string, done: (v: string) => void) {
  const f = h('form', 'menu-form');
  const i = h('input', 'field') as HTMLInputElement;
  i.value = value;
  f.append(h('div', 'label', label), i);
  const close = popMenu(from, f, { align: 'right', width: 300 });
  f.onsubmit = ev => { ev.preventDefault(); close(); done(i.value); };
  i.focus();
  i.select();
}

/** The head of a thread's page: its color, the order of its places, whether it is drawn in the reader, Make a document. */
function threadControls(e: Entry): HTMLElement {
  const row = h('div', 'nb-chips nb-thread-controls');
  const color = button('chip nb-add nb-thread-color', e.color ? e.color[0].toUpperCase() + e.color.slice(1) : 'No color', ev => threadColorMenu(ev.currentTarget as HTMLElement, e));
  color.prepend(h('i', `dot c-${e.color || ''}`));
  color.title = 'The color of the underline this thread draws in the reader';
  row.append(color);
  row.append(button('chip nb-add', 'Put in Bible order', async () => { try { await wb(['thread', 'sort', e.slug!]); changed('threads'); } catch (x) { toast(String(x)); } }, 'lines'));
  const shown = () => layers.shown(e.slug!);
  const eye = button('chip nb-add nb-thread-eye', '', () => {
    if (layers.hidden.has(e.slug!)) layers.hidden.delete(e.slug!); else layers.hidden.add(e.slug!);
    layers.save();
    void app.refreshMarks();
    draw();
  });
  const draw = () => { eye.replaceChildren(icon(shown() ? 'eye' : 'eyeoff', 14), document.createTextNode(shown() ? ' Drawn in the reader' : ' Hidden in the reader')); };
  draw();
  row.append(eye, h('span', 'grow'));
  row.append(button('btn soft small', 'Make a document', () => pane?.el.querySelector('.nb-docs')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 'file'));
  return row;
}

function threadColorMenu(from: HTMLElement, e: Entry) {
  const box = h('div', 'menu-list');
  const colors = h('div', 'colors');
  let close = () => {};
  for (const c of [...THREAD_COLORS, 'none']) {
    const s = h('button', `swatch c-${c}${(e.color || 'none') === c ? ' on' : ''}`);
    s.setAttribute('aria-label', c);
    s.title = c === 'none' ? 'No color: not drawn in the reader' : c;
    s.onclick = async () => { close(); try { await wb(['thread', 'edit', e.slug!, '--color', c]); changed('threads'); } catch (x) { toast(String(x)); } };
    colors.append(s);
  }
  box.append(h('div', 'label', 'Color'), colors);
  close = popMenu(from, box, { width: 240 });
}

function threadMenu(from: HTMLElement, e: Entry, at?: { x: number; y: number }) {
  const box = h('div', 'menu-list');
  let close = () => {};
  const item = (label: string, fn: () => void) => box.append(button('menu-item', label, () => { close(); fn(); }));
  const slug = e.slug!;
  item('Add the place you are at', async () => { try { await wb(['thread', 'add', slug, here().anchor]); changed('threads'); toast(`${here().label} added`); } catch (x) { toast(String(x)); } });
  item('Rename…', () => askText(from, 'New name', e.title, async v => { try { await wb(['thread', 'edit', slug, '--rename', v]); changed('threads', 'notes'); } catch (x) { toast(String(x)); } }));
  item('Color…', () => threadColorMenu(from, e));
  item('Put it in Bible order', async () => { try { await wb(['thread', 'sort', slug]); changed('threads'); } catch (x) { toast(String(x)); } });
  box.append(h('div', 'menu-sep'));
  const pinned = e.pinned !== null && e.pinned !== undefined;
  item(pinned ? 'Unpin' : 'Pin', async () => { try { await wb(['thread', pinned ? 'unpin' : 'pin', slug]); toast(pinned ? 'Taken out of Pinned' : 'Pinned'); changed('threads'); } catch (x) { toast(String(x)); } });
  item('Make a document…', () => pane?.el.querySelector('.nb-docs')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  box.append(h('div', 'menu-sep'));
  item('Delete the thread', async () => {
    if (!confirm(`Delete the thread “${e.title}”? It goes to .trash in the study folder.`)) return;
    try { await wb(['thread', 'delete', slug]); openId = null; changed('threads', 'notes'); } catch (x) { toast(String(x)); }
  });
  close = popMenu(from, box, { align: at ? 'left' : 'right', width: 240, at });
}

/** A thread's places, each a block: its reference and the text from the database, in the thread's own order. */
async function threadPlaces(e: Entry): Promise<HTMLElement> {
  const slug = e.slug!;
  const t = await wb(['thread', 'show', slug]).catch(() => null);
  const members: any[] = t?.members || [];
  const box = h('section', 'nb-thread-places');
  const head = h('div', 'nb-places-row');
  head.append(h('span', 'label', `Places · ${members.length}`), h('span', 'grow'));
  const filter = h('input', 'field nb-places-filter') as HTMLInputElement;
  filter.placeholder = 'Filter places';
  filter.setAttribute('aria-label', 'Filter this thread’s places');
  if (members.length > 6) head.append(filter);
  head.append(button('chip nb-add', '+ Place', async () => {
    try { await wb(['thread', 'add', slug, here().anchor]); toast(`${here().label} added`); changed('threads'); } catch (x) { toast(String(x)); }
  }));
  box.append(head);
  if (!members.length) box.append(h('p', 'muted small', `No places yet: + Place adds the place you are at, or type +${e.title} in the command field.`));
  const list = h('div', 'members');
  members.forEach((m: any, k: number) => {
    const card = h('div', `member${m.ok === false ? ' off' : ''}`);
    card.draggable = true;
    card.dataset.k = String(k);
    const grip = h('span', 'grip');
    grip.append(icon('grip', 14));
    const body = h('div', 'member-body');
    const word = /^[HG]\d+$/i.test(m.anchor);
    const lab = button('ref-link', m.label, ev => (word ? openStrong(m.anchor.toUpperCase()) : void verseCard(m.anchor, lab, ev)));
    body.append(lab, h('p', 'scripture-row clamp', m.quote || ''));
    // an original word everywhere: its renderings and Strong's definition, not only the original
    if (m.kind === 'lemma') {
      const gloss = h('p', 'small thread-gloss');
      body.append(gloss);
      wb(['strong', m.anchor]).then(d => {
        const used = (d.renderings || []).map((r: any) => r.w).join(', ');
        gloss.textContent = [used && `KJV: ${used}`, d.definition, d.occurrences && `${d.occurrences} times`].filter(Boolean).join(' · ');
      }).catch(() => {});
    }
    const x = h('button', 'member-x');
    x.append(icon('x', 12));
    x.title = 'Take it out of the thread';
    x.setAttribute('aria-label', `Take ${m.label} out of the thread`);
    x.onclick = async () => { try { await wb(['thread', 'rm', slug, m.anchor]); changed('threads'); } catch (err) { toast(String(err)); } };
    card.append(grip, body, x);
    // drag to reorder: the whole order is written in one change, as wb thread order does
    card.ondragstart = ev => { ev.dataTransfer!.setData('text/plain', String(k)); card.classList.add('dragging'); };
    card.ondragend = () => card.classList.remove('dragging');
    card.ondragover = ev => { ev.preventDefault(); card.classList.add('drop'); };
    card.ondragleave = () => card.classList.remove('drop');
    card.ondrop = async ev => {
      ev.preventDefault();
      card.classList.remove('drop');
      const from = +ev.dataTransfer!.getData('text/plain');
      if (Number.isNaN(from) || from === k) return;
      const order = members.map((y: any) => y.anchor);
      const [moved] = order.splice(from, 1);
      order.splice(k, 0, moved);
      try { await wb(['thread', 'order', slug, ...order]); changed('threads'); } catch (err) { toast(String(err)); }
    };
    list.append(card);
  });
  filter.oninput = () => {
    const f = filter.value.trim().toLowerCase();
    list.querySelectorAll<HTMLElement>('.member').forEach(m => { m.hidden = !!f && !(m.textContent || '').toLowerCase().includes(f); });
  };
  box.append(list);
  return box;
}

/** A page written on this thread: its first line is its title (`wb thread write`). */
function pageOnThread(e: Entry): HTMLElement {
  const row = h('div', 'nb-on-thread-new');
  const input = h('input', 'field') as HTMLInputElement;
  input.placeholder = `A page on ${e.title}: its first line is its title…`;
  input.setAttribute('aria-label', 'A new page on this thread');
  input.onkeydown = async ev => {
    if (ev.key !== 'Enter' || !input.value.trim()) return;
    ev.preventDefault();
    try {
      const r = await wb(['thread', 'write', e.slug!, '-'], input.value.trim());
      input.value = '';
      changed('threads', 'notes');
      await openNote(r.id, undefined, true);
    } catch (x) { toast(String(x)); }
  };
  row.append(input);
  return row;
}
