// Bible Workbench: the reader with its marks, tap cards, touch selection, hover cards and the color bar (phase 0), and
// the desktop around it (phase 2): the toolbar with the command field, the dock of panes, the Notebook, threads and
// layers, word study, find, text size and the keyboard. See docs/phase0-results.md and docs/archive/2026-11-10/docs/phase2-results.md.
import '@fontsource/literata/400.css';
import '@fontsource/literata/400-italic.css';
import '@fontsource/literata/500-italic.css';
import '@fontsource/literata/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/noto-sans-hebrew/400.css';
import { openMenu } from './menu';
import { api, inApp, onDo, wb, type WordView, type VerseView, type Book, type Mark } from './api';
import { draw, drawTimes, paint, textOf, labelOf, marksOnWord, type Drawn } from './reader';
import { openMarkCard } from './markcard';
import { Selector, type InputMode } from './select';
import { openSheet, closeSheet, showCard, hideCard, toast, toastUndo, compact } from './sheets';
import { perf, afterPaint, record } from './perf';
import { app, goTo, here, type At } from './app';
import { layers } from './layers';
import { h, hoverMode, icon, popMenu, setHover, sizeClass, closeMenu, wordClick } from './ui';
import { doors, openWordCard, wordHover } from './wordcard';
import type { Pane } from './dock';
import { openConcordance } from './concordance';
import { dock, initPanes, openPlans, openPlace, openInterlinear, openStrong, openKeys, openHelp, openMarked, openShelf, openThread, openThreads, openToday, openUses, threadChooser } from './panes';
import { bridge, loadWindowSettings, markName, openSettings } from './settings';
import { loadKept } from './mycommands';
import { fills as cmdFills, byKey as commandByKey, run as runKeptCommand } from './mycommands';
import { byId, CATALOG, flipTheme, hooks, initReaderTools, READER_TOOLS, setBadge, setVersionLabel, textSizeMenu, toggleFullScreen } from './toolbar';
import { initRail, railLinksInit, railOn } from './rail';
import { refreshUpdates, restartHooks, startUpdates, updateLine } from './updates';
import { captureRestart, restoreRestart } from './restart';
import { focusReader, frontStep, initTrail, onFront, paneStep, readerStep } from './trail';
import { menu as layoutMenu } from './layouts';
import { isCaptureKey, notebookBadge, openNote, openNotebook, quickCapture, readerMoved, readSettings, writeInNotebook } from './notebook';
import type { Change } from './dock';
import { attachCommandField, box as cmdBox, initPopOff, loadThreads } from './command';
import { findInPane, paneForFind } from './panefind';
import { toggleQuickSearch } from './ctrlk';
import { findingBox, openFindings } from './findings';
import { openDocuments } from './documents';
import { canReopen, parse, reopen, runLine, written } from './actions';
import { setupIfNeeded } from './setup';
import { createReadAloud } from './listen';
import { refreshInks } from './hlink';
import { KIND_NAMES, panel } from './markpanel';
import { inkOf } from './markdraw';
import { createBar, kindHooks, type MarkBar } from './markbar';
import { createMargin } from './margin';
import { marksOnVerse } from './versemarks';
import { createArrowBar, arrowColor, rememberArrowColor, STAY, type ArrowBar } from './arrowbar';
import { parseAt } from './marks';
import * as planReading from './planreading';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reader = $('reader'), scroller = $('scroller');
const COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'];
const STORE = 'wb.place.v1';
const SIZE_STORE = 'wb.size.v1';

// Reading mode (row 46): the marks are not drawn, and one line says so.
const readingNote = h('div', 'reading-note');
readingNote.hidden = true;
{
  const show = h('button', 'btn soft', 'Show');
  show.onclick = () => { void panel.setReading(false).catch(x => toast(String(x))); repaintLayers(); };
  readingNote.append(h('span', '', 'Marks are hidden (Reading mode).'), show);
  scroller.insertBefore(readingNote, reader);
}

let drawn: Drawn | null = null;

/** The margin beside the main reader's text (marks T10): notes, signs, the popover. */
const margin = createMargin({
  scroller, reader,
  openPage: id => void openNote(id),
  questionsChanged: (v, on) => {
    const d = drawn;
    if (!d || v < 1) return;
    if (on) { d.questions.add(v); paint(reader, d); } else if (inApp) void refreshMarks();
  },
});
let books: Book[] = [];

/** A reader on screen: the main one, or a second reader in a pane (notes 9587, 21bd). Each has what it draws, its own
 * selection and its scroller; the color bar, the cards and the verse menu work in whichever one they came from, and
 * nothing done in a second reader moves the main one. */
interface View { root: HTMLElement; scroller: HTMLElement; drawn: Drawn | null; selector: Selector; main: boolean; pane?: Pane }
let place = { code: 'NUM', chapter: 25, verse: 1, offset: 0 };
/** Where the reader was before each jump (go, a link, first/last), for `back`. */
const backStack: { code: string; chapter: number; verse: number; offset: number }[] = [];

// ---- the place: never lose it. Kept as the verse at the top of the screen and how far into it, not as pixels, so it
// holds when the window is a different size or the text size changes. ---------------------------------------------------
function loadPlace() {
  const q = new URLSearchParams(location.search).get('at');   // ?at=PSA.119 or ?at=PSA.119.40 (tests, measuring)
  if (q) { const [code, ch, v] = q.split('.'); return { code, chapter: +ch, verse: +(v || 1), offset: 0 }; }
  try { return { ...place, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return place; }
}
function topVerse(): { verse: number; offset: number } {
  const top = scroller.scrollTop, base = reader.offsetTop;
  let best = { verse: 1, offset: top };
  for (const e of reader.querySelectorAll<HTMLElement>('.vn')) {
    const y = base + e.offsetTop - 12;
    if (y > top) break;
    best = { verse: +e.dataset.v!, offset: top - y };
  }
  return best;
}
function savePlace() {
  if (!drawn) return;
  place = { code: drawn.chapter.code, chapter: drawn.chapter.chapter, ...topVerse() };
  try { localStorage.setItem(STORE, JSON.stringify(place)); } catch { /* private window: the place is kept for this run only */ }
}
let saveTimer = 0;
scroller.addEventListener('scroll', () => {
  clearTimeout(saveTimer); saveTimer = window.setTimeout(savePlace, 250);
  if (selector.sel) selector.placeHandles();
  hideCard();
}, { passive: true });

// ---- the version: the KJV, or another in the database (the YLT), kept between runs. Another version has no KJV word
// positions, so its words cannot be selected and only marks on whole verses are drawn (wb reader --version). ---------
let version = (() => { try { return localStorage.getItem('wb.version') || 'KJV'; } catch { return 'KJV'; } })();
const VERSIONS = ['KJV', 'YLT'];
async function setVersion(v: string): Promise<string> {
  v = v.toUpperCase();
  if (!VERSIONS.includes(v)) return `No version ${v} here: ${VERSIONS.join(', ')}`;
  if (v !== version) {
    readAloud.stopForNavigation();
    savePlace();
    version = v;
    try { localStorage.setItem('wb.version', v); } catch { /* this run only */ }
    if (drawn) await open(place.code, place.chapter, place.verse, 0);
  }
  return v === 'KJV' ? 'The reader is in the KJV' : `The reader is in the ${v}: marks on whole verses are drawn; select words in the KJV`;
}

// ---- drawing ----------------------------------------------------------------------------------------------------------
let drawSeq = 0;
async function open(code: string, chapter: number, verse = 1, offset = 0) {
  if (arrowStays(code, chapter)) return;
  const t0 = performance.now(), seq = ++drawSeq;
  const { data, rust_ms } = await api.reader(code, chapter, version);
  if (seq !== drawSeq) return;
  const t1 = performance.now();
  closeSheet(); hideCard();
  if (barView === mainView || !barView) { bar?.remove(); bar = null; barView = null; }
  scroller.scrollTop = 0;
  drawn = draw(reader, data.chapter, data.marks, verse, new Set((data.questions || []).map(q => q.v)));
  app.drawn = drawn;
  selector.attach(drawn);
  if (verse > 1 || offset) {
    const vn = reader.querySelector<HTMLElement>(`.vn[data-v="${verse}"]`);
    if (vn) scroller.scrollTop = reader.offsetTop + vn.offsetTop - 12 + offset;
  }
  void margin.load(drawn);
  placeButton(`${data.chapter.name} ${chapter}`);
  readerStep(`${data.chapter.name} ${chapter}`);
  readerMoved();
  planReading.moved();
  void planReading.paintRead(drawn, reader);
  setVersionLabel(data.chapter.version || 'KJV');
  const t2 = performance.now();
  await afterPaint();
  record('chapter', performance.now() - t0, { rust_ms, ipc_ms: t1 - t0 - rust_ms, ...drawTimes, frame_ms: performance.now() - t2, words: drawn.el.length, at: `${code} ${chapter}` });
  // The rest of a long chapter, a part at a time between frames.
  const d = drawn;
  const rest = () => {
    if (seq === drawSeq && d.more()) setTimeout(rest, 0);
    else if (seq === drawSeq) { record('chapter-complete', performance.now() - t0, { at: `${code} ${chapter}` }); chapterEnd(d); margin.layout(); void planReading.paintRead(d, reader); if (finding) findInChapter(finding); }
  };
  setTimeout(rest, 0);
  savePlace();
}

const readAloud = createReadAloud({
  books: () => books,
  drawn: () => drawn,
  topVerse: () => topVerse().verse,
  rememberPlace,
  show: async (code, chapter, verse) => { await open(code, chapter, verse); return drawn; },
  root: reader,
  scroller,
});

function placeButton(label: string) {
  const b = $('place');
  b.replaceChildren(icon('book'), h('span', 'place-label', label), icon('down', 14));
}

function rememberPlace() {
  if (drawn) { savePlace(); backStack.push({ ...place }); if (backStack.length > 50) backStack.shift(); }
}

/** A jump elsewhere: the place left is kept for back. */
async function jump(code: string, chapter: number, verse = 1) {
  if (arrowStays(code, chapter)) return;
  readAloud.stopForNavigation();
  rememberPlace();
  app.picked = verse > 1 ? { anchor: `${code}.${chapter}:${verse}`, label: `${books.find(b => b.code === code)?.name ?? code} ${chapter}:${verse}` } : null;
  await open(code, chapter, verse);
}

function back(): boolean {
  if (arrow && backStack.length && arrowStays(backStack[backStack.length - 1].code, backStack[backStack.length - 1].chapter)) return true;
  readAloud.stopForNavigation();
  const p = backStack.pop();
  if (!p) return false;
  open(p.code, p.chapter, p.verse, p.offset);
  return true;
}

function step(n: number) {
  if (arrow) { arrow.bar.say(STAY); arrow.place(); return; }   // a step is always another chapter (row 15)
  readAloud.stopForNavigation();
  if (!drawn) return;
  const c = drawn.chapter;
  let i = books.findIndex(b => b.code === c.code), ch = c.chapter + n;
  if (ch < 1) { if (i <= 0) return; i--; ch = books[i].chapters; }
  else if (ch > c.chapters) { if (i < 0 || i >= books.length - 1) return; i++; ch = 1; }
  app.picked = null;
  open(books[i]?.code ?? c.code, ch);
}

// Visibility changes use the marks already loaded in each reader.
function repaintLayers() {
  readingNote.hidden = !panel.reading;
  margin.refresh();
  if (drawn) paint(reader, drawn);
  for (const { view } of readers2.values()) {
    if (view.drawn) paint(view.root, view.drawn);
  }
}

/** The chapter's marks read again from the study folder and drawn, without moving the text. */
async function refreshMarks() {
  const d = drawn;
  if (!d || !inApp) { if (d) paint(reader, d); return; }
  const { data } = await api.reader(d.chapter.code, d.chapter.chapter, d.chapter.version || 'KJV');
  if (drawn !== d) return;
  d.marks = data.marks;
  d.questions.clear();
  for (const q of data.questions || []) d.questions.add(q.v);
  paint(reader, d);
}

// ---- sheets and cards -----------------------------------------------------------------------------------------------
function noteCard(placeLabel: string, text: string) {
  const c = h('div', 'note-card');
  c.append(h('span', 'pill', placeLabel), h('p', '', text));
  return c;
}

function verseBody(v: VerseView, card = false, ver = 'KJV'): HTMLElement {
  const b = h('div', 'verse-view');
  if (card) b.append(h('div', 'card-head', `${v.reference} · ${ver}`));
  else b.append(h('h2', 'sheet-title', v.reference), h('div', 'sheet-sub', ver));
  b.append(h('p', 'scripture', v.text));
  b.append(marksOnVerse(v.anchor));   // every mark on the verse and the margin notes covering it (marks T12, row 53)
  if (card) return b;
  b.append(colorRow(v.color, c => {
    const [code, cv] = v.anchor.split('.');
    const [ch, vs] = cv.split(':').map(Number);
    addHighlight({ kind: 'verse', code, c1: ch, v1: vs, i1: null, c2: null, v2: null, i2: null, id: `session_${Date.now()}`, color: c ?? undefined });
    closeSheet();
  }));
  for (const n of v.notes) b.append(noteCard(v.reference, n.text));
  if (v.threads.length) {
    const t = h('div', 'in-threads');
    t.append(h('span', 'muted', 'In'));
    for (const th of v.threads) {
      const chip = h('button', 'chip thread');
      chip.append(h('i', `dot c-${th.color}`), document.createTextNode(th.name));
      chip.onclick = () => { closeSheet(); openThread(th.name); };
      t.append(chip);
    }
    b.append(t);
  }
  const at: At = { anchor: v.anchor, label: v.reference };
  b.append(actions(compact() ? ['Note', 'Question', 'Thread', 'Copy'] : ['Note', 'Question', 'Thread', 'Copy', 'Notes & lookup', 'Open as a tab'], (a, el) => {
    if (a === 'Copy') copy(`${v.text} (${v.reference} ${ver})`);
    else if (a === 'Notes & lookup') { closeSheet(); openPlace(at.anchor, at.label); }
    else if (a === 'Open as a tab') { closeSheet(); openSecondReader(at.anchor, ver); }
    else if (a === 'Thread') addToThread(el, at);
    else writeNote(el, at, a === 'Note' ? 'note' : 'question');
  }));
  return b;
}

// Your saved custom colors (settings/palette.json, c1–c8), newest first; a custom color used once is saved by wb-core.
let palette: string[] = [];
async function loadPalette() {
  if (!inApp) return;
  try { palette = (await wb(['palette'])).colors; } catch { /* none */ }
}

// The five colors, your saved ones, any color, and × to remove (when there is something to remove, or `clear`).
function colorRow(current: string | undefined, pick: (c: string | null) => void, clear = false) {
  const row = h('div', 'colors');
  COLORS.forEach((c, n) => {
    const dot = h('button', `swatch c-${c}${c === current ? ' on' : ''}`);
    dot.setAttribute('aria-label', c);
    dot.title = `${markName(c)} (${n + 1})`;
    dot.onclick = () => pick(c);
    row.append(dot);
  });
  palette.forEach((c, n) => {
    const dot = h('button', `swatch saved${c === current ? ' on' : ''}`);
    dot.style.background = c;
    dot.setAttribute('aria-label', `Saved color c${n + 1}`);
    dot.title = `c${n + 1} ${c}`;
    dot.onclick = () => pick(c);
    row.append(dot);
  });
  const plus = h('button', 'swatch plus', '+');
  plus.setAttribute('aria-label', 'Custom color');
  plus.title = 'Any color (it is saved for next time)';
  plus.onclick = () => {
    const i = h('input') as HTMLInputElement;
    i.type = 'color';
    i.onchange = () => { pick(i.value); setTimeout(loadPalette, 500); };
    i.click();
  };
  row.append(plus);
  if (clear || current) {
    const x = h('button', 'swatch clear', '×');
    x.setAttribute('aria-label', 'Remove the highlight');
    x.title = 'Remove the highlight (0)';
    x.onclick = () => pick(null);
    row.append(x);
  }
  return row;
}

function actions(names: string[], run: (a: string, el: HTMLElement) => void) {
  const row = h('div', 'acts');
  for (const n of names) { const b = h('button', 'act', n); b.onclick = () => run(n, b); row.append(b); }
  return row;
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast('Copied with its reference'); } catch { toast('Copy is not allowed here'); }
}

// A note or a question on a place. At desktop sizes it is written in the Notebook's box, with the place already chosen
// (one writing box, not a second one over the verse); on a phone, a small box beside what was clicked. Enter saves
// (through wb note add / trail add).
function writeNote(from: HTMLElement, at: At, kind: 'note' | 'question') {
  if (!inApp) return toast('Notes are written in the app');
  if (!compact()) {
    closeSheet();
    clearSelection();
    void writeInNotebook(at, kind === 'question');
    return;
  }
  const box = h('form', 'note-form');
  box.append(h('div', 'label', `${kind === 'note' ? 'Note' : 'Question'} on ${at.label}`));
  const ta = h('textarea', 'field') as HTMLTextAreaElement;
  ta.rows = 3;
  ta.placeholder = kind === 'note' ? 'Your note' : 'Your question';
  box.append(ta, h('div', 'muted small', 'Enter saves · Shift+Enter: a new line'));
  const save = async () => {
    const text = ta.value.trim();
    if (!text) return;
    close();
    try {
      if (kind === 'note') await wb(['note', 'add', at.anchor, '-'], text);
      else await wb(['trail', 'add', at.anchor, text]);
      closeSheet();
      clearSelection();
      toast(kind === 'note' ? `Note on ${at.label}` : `Question on ${at.label}`);
      written('notes');
    } catch (e) { toast(String(e)); }
  };
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } };
  box.onsubmit = e => { e.preventDefault(); save(); };
  const close = popMenu(from, box, { width: 320 });
  ta.focus();
}

function addToThread(from: HTMLElement, at: At) {
  threadChooser(from, async name => {
    try {
      await wb(['thread', 'add', name, at.anchor]);
      closeSheet();
      clearSelection();
      toast(`${at.label} added to ${name}`);
      written('threads');
    } catch (e) { toast(String(e)); }
  });
}

/** Add to… (marks row 11): a page, a folder or a save, each by the commands the app already has. */
function addTo(from: HTMLElement, at: At) {
  const box = h('div', 'menu-list add-to');
  box.append(h('div', 'muted small nb-menu-note', at.label));
  const item = (act: string, label: string, ico: string, fn: () => void) => {
    const b = h('button', 'menu-item');
    b.dataset.act = act;
    b.append(icon(ico, 14), document.createTextNode(` ${label}`));
    b.onclick = () => { shut(); fn(); };
    box.append(b);
  };
  item('page', 'A page…', 'notebook', () => pageChooser(from, at));
  item('folder', 'A folder…', 'threads', () => addToThread(from, at));
  item('save', 'A save (the Shelf)', 'shelf', async () => {
    try { await wb(['save', at.anchor]); clearSelection(); toast(`${at.label} saved`); written('threads'); } catch (e) { toast(String(e)); }
  });
  const shut = popMenu(from, box, { width: 240 });
}

/** A page for the selection: its verses go in as a scripture block (the file holds only the reference), last in the page. */
function pageChooser(from: HTMLElement, at: At) {
  const box = h('div', 'chooser');
  const input = h('input', 'field') as HTMLInputElement;
  input.placeholder = 'Find a page';
  input.setAttribute('aria-label', 'Find a page');
  const list = h('div', 'chooser-list');
  box.append(input, list);
  const close = popMenu(from, box, { width: 280 });
  const flat = (ps: any[]): any[] => ps.flatMap(p => [p, ...flat(p.children || [])]);
  wb(['page', 'tree']).then((t: any) => {
    const pages = flat(t.pages || []);
    const draw = () => {
      const f = input.value.trim().toLowerCase();
      list.replaceChildren(...pages.filter(p => (p.title || '').toLowerCase().includes(f)).slice(0, 12).map(p => {
        const b = h('button', 'chooser-row');
        b.dataset.page = p.id;
        b.append(document.createTextNode(p.title || p.id));
        b.onclick = async () => {
          close();
          try {
            await wb(['block', 'add', p.id, '```scripture\n' + at.label.replace('–', '-') + '\n```']);
            clearSelection();
            toast(`${at.label} added to ${p.title}`);
            written('notes');
          } catch (e) { toast(String(e)); }
        };
        return b;
      }));
    };
    input.oninput = draw;
    draw();
  }).catch(() => {});
  input.focus();
}

/** Copy: the selected words with their reference, as the verse menu's Copy does (the words are the ones drawn; a span that reaches into another chapter is asked of `wb text`). */
async function copySelection(vw: View, at: At): Promise<boolean> {
  const d = vw.drawn, sel = vw.selector.sel;
  if (!d || !sel) return false;
  try {
    const [first, last] = at.anchor.split('-');
    const cross = !!last && /^\d+:\d+$/.test(last) && last.split(':')[0] !== first.split(':')[0].split('.').pop();
    const text = cross ? String(await wb(['text', at.anchor, ...(d.chapter.version ? ['--version', d.chapter.version] : [])])).trim()
      : `${textOf(d, sel.a, sel.b)} (${at.label} ${d.chapter.version || 'KJV'})`;
    await navigator.clipboard.writeText(text);
    return true;
  } catch { toast('Copy is not allowed here'); return false; }
}

const anchorOf = (m: Mark) => {
  const start = `${m.code}.${m.c1}:${m.v1}` + (m.i1 !== null ? `.${m.i1}` : '');
  return m.c2 === null ? start : `${start}-${m.c2}:${m.v2}` + (m.i2 !== null ? `.${m.i2}` : '');
};

async function addHighlight(m: Mark) {
  if (!inApp && !m.color) return toast('Removed (this session only)');
  if (!inApp) {
    // In the WebKit tests there is no Rust: the mark is drawn for this session only.
    (drawn!.marks.marks ||= []).push({ id: m.id, kind: 'highlight', color: m.color!, at: anchorOf(m), created: new Date().toISOString(), legend: `Unnamed ${m.color} highlight`, style: `highlight:${m.color}` });
    paint(reader, drawn!);
    toast('Highlighted (this session only)');
    return;
  }
  // Saved in the study folder by the no-overlap rule (as wb hl set does), then the marks are read back.
  try {
    await api.highlight(anchorOf(m), m.color ?? null);
    written('highlights');
    toast(m.color ? 'Highlighted' : 'Highlight removed');
  } catch (e) {
    toast(String(e));
  }
}

// ---- selection bar (touch) and color bar (mouse) --------------------------------------------------------------------
let bar: HTMLElement | null = null;
let markBar: MarkBar | null = null;
/** The reader the bar belongs to, and the verse when a whole verse was picked by its number (note 4b90). */
let barView: View | null = null;
let barVerse = 0;

/** Clears the selection and its bar, in whichever reader it is. */
function clearSelection() {
  if (barView) barView.selector.clear();
  else selector.clear();
}

function selectionAt(vw: View, a: number, b: number): At {
  const d = vw.drawn!, c = d.chapter.code, ch = d.chapter.chapter;
  const anchor = a === b ? `${c}.${ch}:${d.v[a]}.${d.i[a]}` : `${c}.${ch}:${d.v[a]}.${d.i[a]}-${ch}:${d.v[b]}.${d.i[b]}`;
  return { anchor, label: labelOf(d, a, b) };
}

const verseAt = (d: Drawn, v: number): At => ({ anchor: `${d.chapter.code}.${d.chapter.chapter}:${v}`, label: `${d.chapter.name} ${d.chapter.chapter}:${v}` });

/** A click on a verse number selects the whole verse and shows the color bar for it; a click away clears both (note
 * 4b90). On a phone, and in another version, the verse's card opens as before. */
function selectVerse(vw: View, v: number, el: HTMLElement, at: number, shift = false) {
  const d = vw.drawn;
  // On a phone, and in another version, a tap on a verse number still opens the verse's card (it holds Note, Question, Thread
  // and Copy there; the bar's More holds Copy and Open as a tab). On a desktop the click selects (marks rows 2 and 3).
  if (!d || compact() || d.chapter.version) { vw.selector.clear(); return void openVerse(vw, v, el, at); }
  const code = d.chapter.code, ch = d.chapter.chapter;
  const here = { code, chapter: ch, verse: v };
  // A verse span (MK7-13): the first verse number clicked is kept, also across a turned chapter of the same book; shift-click the last.
  const from = shift && spanFrom && spanFrom.code === code ? spanFrom : null;
  if (!from) spanFrom = here;
  const lo = from && (from.chapter < ch || (from.chapter === ch && from.verse <= v)) ? from : here;
  const hi = lo === here ? from ?? here : here;
  const a = lo.chapter === ch ? d.v.indexOf(lo.verse) : 0;
  let b = hi.chapter === ch ? d.v.lastIndexOf(hi.verse) : d.v.length - 1;
  if (a < 0 || b < 0) return;
  while (!d.el[b] && d.more()) { /* the rest of the verse drawn first */ }
  if (hi.chapter !== ch) b = d.v.length - 1;
  const one = lo.chapter === hi.chapter && lo.verse === hi.verse;
  barVerse = one ? v : 0;
  if (!one) {
    const ref = lo.chapter === hi.chapter ? `${d.chapter.name} ${lo.chapter}:${lo.verse}–${hi.verse}` : `${d.chapter.name} ${lo.chapter}:${lo.verse}–${hi.chapter}:${hi.verse}`;
    barAt = { anchor: `${code}.${lo.chapter}:${lo.verse}-${hi.chapter}:${hi.verse}`, label: ref };
  }
  vw.root.querySelectorAll('.vn.vsel').forEach(e => e.classList.remove('vsel'));
  vw.selector.set(a, b);
  for (let k = a; k <= b; k++) vw.root.querySelector(`.vn[data-v="${d.v[k]}"]`)?.classList.add('vsel');
  showBar(vw, a, b, false);
}
/** The first verse number clicked, kept for the shift-click that ends a span. */
let spanFrom: { code: string; chapter: number; verse: number } | null = null;
/** What a verse span's bar stands for (its anchor and name), when the words alone do not say it. */
let barAt: At | null = null;

function showBar(vw: View, a: number, b: number, touch: boolean) {
  bar?.remove();
  // one selection at a time: a selection in another reader clears the one before
  if (barView && barView !== vw && barView.selector.sel) { const old = barView; barView = null; old.selector.clear(); }
  const d = vw.drawn!;
  if (d.chapter.version) { vw.selector.clear(); toast(`Words are selected in the KJV (version kjv): highlights and notes on words belong to its words`); return; }
  const verse = barVerse && d.v[a] === barVerse && d.v[b] === barVerse && (a === 0 || d.v[a - 1] !== barVerse) && (b === d.v.length - 1 || d.v[b + 1] !== barVerse) ? barVerse : 0;
  barVerse = 0;
  barView = vw;
  const at = barAt ?? (verse ? verseAt(d, verse) : selectionAt(vw, a, b));
  barAt = null;
  if (arrow) {
    if (arrow.vw === vw) { void pickArrowTarget(vw, at, a, b); return; }
    endArrow();   // a selection in another reader: arrow mode is over
  }
  app.picked = at;
  markBar?.dispose();
  const mb = createBar({ anchor: at.anchor, label: at.label }, {
    chapterMarks: () => d.marks.marks || [],
    drawn: made => markDrawn(vw, made),
    finish: () => vw.selector.clear(),
    addTo: from => addTo(from, at),
    copy: () => copySelection(vw, at),
    openTab: () => { void openSecondReader(at.anchor, d.chapter.version || 'KJV'); vw.selector.clear(); },
  });
  markBar = mb;
  bar = mb.el;
  if (verse) bar.classList.add('verse-bar');
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  document.getElementById('overlay')!.append(bar);
  placeBar();
}

/** A mark was made from the bar: the core's reader read again in the app; outside it (the WebKit tests) the mark the command answered is drawn for the session. */
async function markDrawn(vw: View, made: any) {
  const d = vw.drawn;
  if (inApp) { written('highlights'); return; }
  if (!d || !made?.at || !made.kind) return;
  const style = made.style || (made.kind === 'underline' ? `underline:${made.color}:${made.lines ?? 1}` : `${made.kind}:${made.color}`);
  (d.marks.marks ||= []).push({ ...made, legend: made.legend || `Unnamed ${made.color} ${made.kind}`, style });
  paint(vw.root, d);
}

// ---- arrows (marks T9, rows 13 to 16 and 48; MK7-25) ------------------------------------------------------------------
// Arrow (its icon, A, or the right-click menu's row): the mark bar shrinks to "Select where it points" with Back and Cancel, the
// start words stay outlined, and the next selection in the same chapter (words, or a verse number) is the target. The arrow is
// then made with `wb mark add <from> --kind arrow --color <c> --to <ref>` and drawn in the gutter. A chapter change is refused
// while choosing (`arrowStays`, asked by open, jump, step and back).
interface ArrowMode { vw: View; start: At; a: number; b: number; code: string; chapter: number; bar: ArrowBar; busy: boolean; place: () => void }
let arrow: ArrowMode | null = null;

function startArrow(ctx: At) {
  const vw = barView, sel = vw?.selector.sel, d = vw?.drawn;
  if (!vw || !sel || !d) return;
  const { a, b } = sel;
  const start = { anchor: ctx.anchor, label: ctx.label };
  endArrow();
  const ab = createArrowBar({ back: () => arrowBack(), cancel: () => endArrow() });
  const mode: ArrowMode = { vw, start, a, b, code: d.chapter.code, chapter: d.chapter.chapter, bar: ab, busy: false, place: () => {} };
  mode.place = () => {
    const first = d.el[a]?.getClientRects()[0];
    if (!first) return;
    const w = ab.el.offsetWidth, hgt = ab.el.offsetHeight;
    const top = first.top - hgt - 14 > 60 ? first.top - hgt - 14 : Math.min(first.bottom + 18, window.innerHeight - hgt - 8);
    ab.el.style.top = `${top}px`;
    ab.el.style.left = `${Math.max(8, Math.min(first.left, window.innerWidth - w - 8))}px`;
  };
  // the mark bar goes; the start words keep an outline instead of the selection
  vw.selector.clear();
  for (let k = a; k <= b; k++) { d.el[k]?.classList.add('arrow-from'); d.gap[k]?.classList.add('arrow-from'); }
  arrow = mode;
  document.getElementById('overlay')!.append(ab.el);
  mode.place();
  vw.scroller.addEventListener('scroll', mode.place, { passive: true });
  window.addEventListener('resize', mode.place);
}
kindHooks.arrow = ctx => startArrow(ctx);
// Margin note (T10, rows 17 and 18; MK7-27): the selection's verse or span, within one chapter, opens an empty note in the margin.
kindHooks.note = ctx => {
  const vw = barView;
  if (!vw || !vw.drawn) return;
  if (vw !== mainView) { toast('Margin notes are written beside the main reader'); return; }
  const m = /^[A-Z0-9]+\.(\d+):(\d+)(?:\.\d+)?(?:-(\d+):(\d+)(?:\.\d+)?)?$/.exec(ctx.anchor);
  if (!m) return;
  const c1 = +m[1], c2 = m[3] ? +m[3] : c1, v1 = +m[2], v2 = m[4] ? +m[4] : v1;
  if (c1 !== c2) { toast('A margin note covers verses of one chapter'); return; }
  vw.selector.clear();
  margin.startNote(Math.min(v1, v2), Math.max(v1, v2));
};

/** Arrow mode is over: nothing is made. */
function endArrow() {
  const m = arrow;
  if (!m) return;
  arrow = null;
  m.bar.el.remove();
  m.vw.scroller.removeEventListener('scroll', m.place);
  window.removeEventListener('resize', m.place);
  m.vw.root.querySelectorAll('.arrow-from').forEach(e => e.classList.remove('arrow-from'));
}

/** Back (row 16): the start selection, with the bar open again. */
function arrowBack() {
  const m = arrow;
  if (!m) return;
  endArrow();
  const d = m.vw.drawn;
  if (!d) return;
  barAt = m.start;
  const verses = !/:\d+\.\d/.test(m.start.anchor);   // a whole verse (or span), picked by its number, keeps its number marked
  m.vw.selector.set(m.a, m.b);
  if (verses) for (let k = m.a; k <= m.b; k++) m.vw.root.querySelector(`.vn[data-v="${d.v[k]}"]`)?.classList.add('vsel');
  showBar(m.vw, m.a, m.b, false);
}

/** Row 15: the reader is asked to go to another chapter while an arrow's target is chosen: it stays, and the bar says why. */
function arrowStays(code: string, chapter: number): boolean {
  if (!arrow || (code === arrow.code && chapter === arrow.chapter)) return false;
  arrow.bar.say(STAY);
  arrow.place();
  return true;
}

/** The target was chosen (row 14). */
async function pickArrowTarget(vw: View, to: At, a: number, b: number) {
  const m = arrow;
  if (!m || m.busy) return;
  const d = vw.drawn!;
  const end = /-(\d+):\d+(?:\.\d+)?$/.exec(to.anchor);
  vw.selector.clear();
  if (end && +end[1] !== m.chapter) { m.bar.say(STAY); m.place(); return; }
  if (d.v[a] === d.v[m.a]) { toast('An arrow joins two different verses'); return; }
  m.busy = true;
  try {
    const pick = await arrowColor();
    const made = await wb(['mark', 'add', m.start.anchor, '--kind', 'arrow', '--color', pick.color, '--to', to.anchor]);
    rememberArrowColor(pick.color);
    endArrow();
    await markDrawn(vw, made);
    toast(`Arrow from ${m.start.label} to ${to.label.replace(/^.* (\d+:)/, '$1')} in ${pick.name ?? pick.color}: ${pick.why}`);
  } catch (e) {
    m.busy = false;
    toast(String((e as Error)?.message ?? e));
  }
}

/** A click on an arrow's end in the gutter (row 48): the arrow's card. */
function wireArrowEnds(vw: View) {
  vw.root.addEventListener('click', e => {
    const end = (e.target as Element).closest?.('.mk-end');
    const d = vw.drawn;
    if (!end || !d || arrow) return;
    const m = (d.marks.marks || []).find(x => x.id === (end as SVGElement).dataset.mark);
    if (!m) return;
    const book = d.chapter.name;
    const verseOf = (at: string | undefined) => { const p = at ? parseAt(at) : null; return p ? `${p.c1}:${p.v1}` : '?'; };
    const sync = (apply: () => void) => { apply(); paint(vw.root, d); if (inApp) written('highlights'); };
    void openMarkCard(end as unknown as HTMLElement, {
      place: m.at, local: [], arrows: [m],
      verses: x => `${book} ${verseOf(x.at)} to ${verseOf(x.to)}`,
      chapterMarks: () => d.marks.marks || [],
      restyled: n => sync(() => { d.marks.marks = (d.marks.marks || []).map(x => (x.id === n.id ? n : x)); }),
      removed: id => sync(() => { d.marks.marks = (d.marks.marks || []).filter(x => x.id !== id); }),
      restored: n => sync(() => { if (!(d.marks.marks || []).some(x => x.id === n.id)) (d.marks.marks ||= []).push(n); }),
      lookup: () => {},
    });
  });
}

function placeBar() {
  const vw = barView, d = vw?.drawn, sel = vw?.selector.sel;
  if (!bar || !vw || !sel || !d) return;
  const first = d.el[sel.a].getClientRects()[0], lastRects = d.el[sel.b].getClientRects();
  if (!first || !lastRects.length) return;
  const last = lastRects[lastRects.length - 1];
  const w = bar.offsetWidth, hgt = bar.offsetHeight;
  const top = first.top - hgt - 14 > 60 ? first.top - hgt - 14 : Math.min(last.bottom + 18, window.innerHeight - hgt - 8);
  bar.style.top = `${top}px`;
  bar.dataset.side = top < first.top ? 'above' : 'below';   // the drop-down opens away from the selection
  bar.style.left = `${Math.max(8, Math.min((first.left + last.right) / 2 - w / 2, window.innerWidth - w - 8))}px`;
}

// ---- taps -----------------------------------------------------------------------------------------------------------
async function openWord(vw: View, k: number, el: HTMLElement, at: number) {
  const d = vw.drawn!;
  if (d.chapter.version) return openVerse(vw, d.v[k], el, at);   // no KJV word here: the verse
  app.picked = selectionAt(vw, k, k);
  const { data, rust_ms } = await api.word(d.chapter.code, d.chapter.chapter, d.v[k], d.i[k]);
  const t1 = performance.now();
  el.classList.add('tapped');
  // A click on a word: its card, or (Reading: a click on a word opens) the Concordance at its entry
  if (wordClick() === 'concordance' && (data.lexicon?.strong ?? data.strong)) { doors.concordance((data.lexicon?.strong ?? data.strong)!); el.classList.remove('tapped'); }
  else openWordCard(data, el, () => el.classList.remove('tapped'));
  await afterPaint();
  record('word-sheet', performance.now() - at, { word: data.text, rust_ms, call_ms: t1 - at });
}

/** A click on a word (marks T8, rows 25 and 26): with a mark on it, the mark card (its Look up is the word's own card); with none, the word's card as always. */
async function tapWord(vw: View, k: number, el: HTMLElement, at: number) {
  const d = vw.drawn!;
  if (arrow && arrow.vw === vw && !d.chapter.version) { vw.selector.set(k, k); return void showBar(vw, k, k, false); }   // choosing a target: a click on a word is the target
  const local = d.chapter.version ? [] : marksOnWord(d, k);
  if (!local.length) return openWord(vw, k, el, at);
  app.picked = selectionAt(vw, k, k);
  const sync = (apply: () => void) => { apply(); paint(vw.root, d); if (inApp) written('highlights'); };
  await openMarkCard(el, {
    place: app.picked.anchor,
    local,
    chapterMarks: () => d.marks.marks || [],
    restyled: m => sync(() => { d.marks.marks = (d.marks.marks || []).map(x => (x.id === m.id ? m : x)); }),
    removed: id => sync(() => { d.marks.marks = (d.marks.marks || []).filter(x => x.id !== id); }),
    restored: m => sync(() => { if (!(d.marks.marks || []).some(x => x.id === m.id)) (d.marks.marks ||= []).push(m); }),
    lookup: () => void openWord(vw, k, el, performance.now()),
  });
}

async function openVerse(vw: View, v: number, el: HTMLElement, at: number) {
  const d = vw.drawn!;
  app.picked = verseAt(d, v);
  const { data, rust_ms } = await api.verse(d.chapter.code, d.chapter.chapter, v);
  const t1 = performance.now();
  // In another version the verse is its text there, verbatim (its words joined as stored); notes and colors are the verse's.
  const ver = d.chapter.version || 'KJV';
  if (d.chapter.version) data.text = d.chapter.verses.find(x => x.v === v)?.words.map(w => w.text).join(' ') ?? data.text;
  openSheet(verseBody(data, false, ver), el);
  await afterPaint();
  record('verse-sheet', performance.now() - at, { verse: v, rust_ms, call_ms: t1 - at });
}

let hoverSeq = 0;
/** What a reader does with clicks, hovers and selections. */
function handlersFor(vw: View) {
  return {
    tapWord: (k: number, el: HTMLElement, at: number) => tapWord(vw, k, el, at),
    tapVerse: (v: number, el: HTMLElement, at: number, shift?: boolean) => selectVerse(vw, v, el, at, shift),
    hoverWord: async (k: number, el: HTMLElement) => {
      if (hoverMode() !== 'on') return;
      const seq = ++hoverSeq, t0 = performance.now(), d = vw.drawn!;
      const { data } = await api.word(d.chapter.code, d.chapter.chapter, d.v[k], d.i[k]);
      if (seq !== hoverSeq) return;
      showCard(wordHover(data), el.getBoundingClientRect());
      await afterPaint();
      record('hover-card', performance.now() - t0, { word: data.text });
    },
    hoverVerse: async (v: number, el: HTMLElement) => {
      if (hoverMode() !== 'on') return;
      const seq = ++hoverSeq, d = vw.drawn!;
      const { data } = await api.verse(d.chapter.code, d.chapter.chapter, v);
      if (seq === hoverSeq) showCard(verseBody(data, true), el.getBoundingClientRect());
    },
    unhover: () => { hoverSeq++; hideCard(); },
    selected: (a: number, b: number, touch: boolean) => showBar(vw, a, b, touch),
    cleared: () => {
      vw.root.querySelectorAll('.vn.vsel').forEach(e => e.classList.remove('vsel'));
      if (barView !== vw && barView) return;
      markBar?.dispose(); markBar = null;
      bar?.remove(); bar = null; barView = null;
    },
  };
}
const mainView = { root: reader, scroller, main: true, get drawn() { return drawn; } } as View;
const selector = new Selector(reader, scroller, handlersFor(mainView));
mainView.selector = selector;
wireView(mainView);
wireArrowEnds(mainView);

// A click or tap away from the color bar closes it and clears the selection: anywhere but the bar itself (its presses
// stop at it) and the menus or cards opened from it. In a reader the selector does the same on a tap.
document.addEventListener('pointerdown', e => {
  if (!bar || !barView?.selector.sel) return;
  const t = e.target as HTMLElement;
  if (barView.root.contains(t) || t.closest('.menu, .wbm, .popover, .sheet, .hovercard, .mb-ctx')) return;
  barView.selector.clear();
});
document.getElementById('overlay')!.addEventListener('pointerleave', e => { if ((e.target as HTMLElement).classList?.contains('hovercard')) hideCard(); }, true);

/** What every reader has besides its selector: Alt+click a word for the interlinear, right-click a verse for its menu. */
function wireView(vw: View) {
  vw.root.addEventListener('click', e => {
    if (!e.altKey || !vw.drawn) return;
    const w = (e.target as HTMLElement).closest<HTMLElement>('.w');
    if (!w) return;
    const k = +w.dataset.k!, d = vw.drawn;
    closeSheet();
    openInterlinear(`${d.chapter.code} ${d.chapter.chapter}:${d.v[k]}`, `${d.chapter.name} ${d.chapter.chapter}:${d.v[k]}`);
  }, true);
  // right-click a verse (its number or any word in it): open it in a new tab, and more (note 0cf1). A long press on
  // touch is the selection, so only a mouse's right-click opens the menu.
  let lastPointer = 'mouse';
  vw.root.addEventListener('pointerdown', e => { lastPointer = e.pointerType; }, true);
  vw.root.addEventListener('contextmenu', e => {
    const d = vw.drawn;
    if (!d || lastPointer === 'touch' || compact()) return;
    // a right-click on the selected words: the same actions as the bar, as a menu at the pointer (MK7-34)
    if (markBar && barView === vw && vw.selector.sel && (e.target as HTMLElement).closest('.sel, .sj')) {
      e.preventDefault();
      markBar.openContext(e.clientX, e.clientY);
      return;
    }
    const t = (e.target as HTMLElement).closest<HTMLElement>('.w, .g, .vn');
    if (!t) return;
    const v = t.classList.contains('vn') ? +t.dataset.v! : d.v[+t.dataset.k!];
    e.preventDefault();
    verseMenu(vw, v, e.clientX, e.clientY);
  });
}

/** The menu on a verse: Open in a new tab (a second reader at the verse), Go to in the reader (from a second reader),
 * Select the verse, Notes & lookup, Copy. */
function verseMenu(vw: View, v: number, x: number, y: number) {
  const d = vw.drawn!, at = verseAt(d, v);
  const box = h('div', 'menu-list verse-menu');
  box.append(h('div', 'muted small nb-menu-note', at.label));
  const item = (label: string, ico: string, fn: () => void) => {
    const b = h('button', 'menu-item');
    b.append(icon(ico, 14), document.createTextNode(` ${label}`));
    b.onclick = () => { close(); fn(); };
    box.append(b);
    return b;
  };
  item('Open in a new tab', 'float', () => openSecondReader(at.anchor, d.chapter.version || 'KJV'));
  if (!vw.main) item('Go to in the reader', 'book', () => void jump(d.chapter.code, d.chapter.chapter, v));
  if (!d.chapter.version) item('Select the verse', 'pen', () => { const vn = vw.root.querySelector<HTMLElement>(`.vn[data-v="${v}"]`); if (vn) selectVerse(vw, v, vn, performance.now()); });
  item('Notes & lookup', 'notebook', () => openPlace(at.anchor, at.label));
  if (!d.chapter.version) {
    // Mark read to here (R18): the verses of the chapter up to this one, one log line; the margin line follows
    const first = item('Mark read to here', 'check', () => void planReading.readToHere(d, v, vw.root));
    first.dataset.act = 'read-to-here';
    item(`Mark ${d.chapter.name} ${d.chapter.chapter} read`, 'check', () => void planReading.readChapter(d, vw.root)).dataset.act = 'read-chapter';
  }
  item('Copy', 'copy', () => {
    const a = d.v.indexOf(v), b = d.v.lastIndexOf(v);
    copy(`${textOf(d, a, b)} (${at.label} ${d.chapter.version || 'KJV'})`);
  });
  // the menu opens at the pointer
  const spot = h('span', 'menu-spot');
  Object.assign(spot.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, width: '1px', height: '1px' });
  document.body.append(spot);
  const shut = popMenu(spot, box, { width: 230 });
  const close = () => { shut(); spot.remove(); };
  setTimeout(() => spot.remove(), 0);
}

// ---- second readers (notes 9587, 21bd, 0cf1) ---------------------------------------------------------------------------
/**
 * A passage opened in a pane is a second reader: its chapter drawn as the reader draws it (highlights, threads, note and
 * question marks), with its own selection, color bar and verse cards, and ‹ › to turn its own chapter. The verses asked
 * for are marked and scrolled to. Nothing in it moves the main reader; "Go to in the reader" does, when asked.
 */
async function openSecondReader(ref: string, version = 'KJV', beside?: HTMLElement | null) {
  const clean = ref.replace(/(:\d+)\.\d+/g, '$1');   // words of a verse: their verse
  // (S6) the pane's own version: its KJV | YLT switch changes this and no other reader
  let ver = version === 'YLT' ? 'YLT' : 'KJV';
  let t: any;
  try { t = await wb(['text', clean, '--version', ver, '--json']); } catch { return void goTo(ref); }
  const first = t?.verses?.[0];
  const bk = first && books.find(b => b.name === first.book);
  if (!bk) return void goTo(ref);
  const asked = new Set<string>((t.verses as any[]).map(v => `${v.c}:${v.v}`));
  const st = { code: bk.code, chapter: first.c as number, verse: first.v as number };
  let vw: View | null = null, drawnAt = '', head: HTMLElement | null = null;
  const draw2 = async (el: HTMLElement, p: Pane, toVerse: number) => {
    const { data } = await api.reader(st.code, st.chapter, ver);
    if (!dock.panes.includes(p)) return;
    const v2 = vw!;
    v2.drawn = draw(v2.root, data.chapter, data.marks, 999, new Set((data.questions || []).map(q => q.v)));
    while (v2.drawn.more()) { /* the whole chapter at once: a pane holds one */ }
    v2.selector.attach(v2.drawn);
    drawnAt = `${st.code}.${st.chapter}`;
    // At the reader in the Notebook has a row for each second reader, following it as it turns (W4, sheet W1.2)
    readers2.set(p.id, { pane: p.id, code: st.code, chapter: st.chapter, label: `${data.chapter.name} ${st.chapter}`, view: v2 });
    readerMoved();
    // the verses asked for, unless that is the whole chapter
    const all = data.chapter.verses.every(x => asked.has(`${st.chapter}:${x.v}`));
    if (!all) v2.root.querySelectorAll<HTMLElement>('.vn').forEach(e => e.classList.toggle('vn-asked', asked.has(`${st.chapter}:${e.dataset.v}`)));
    const title = `${data.chapter.name} ${st.chapter}`;
    // renaming draws the dock again, which takes the pane out of the page and so its keyboard focus: given back
    const hadFocus = el.contains(document.activeElement);
    dock.rename(p, title);
    if (hadFocus) el.focus({ preventScroll: true });
    head!.querySelector('.reader2-title')!.textContent = title;
    const vn = toVerse > 1 ? v2.root.querySelector<HTMLElement>(`.vn[data-v="${toVerse}"]`) : null;
    el.scrollTop = vn ? el.scrollTop + vn.getBoundingClientRect().top - el.getBoundingClientRect().top - head!.offsetHeight - 16 : 0;
  };
  const turn = async (el: HTMLElement, p: Pane, n: number) => {
    const i = books.findIndex(b => b.code === st.code);
    let ch = st.chapter + n, code = st.code;
    if (ch < 1) { if (i <= 0) return; code = books[i - 1].code; ch = books[i - 1].chapters; }
    else if (ch > books[i].chapters) { if (i >= books.length - 1) return; code = books[i + 1].code; ch = 1; }
    st.code = code; st.chapter = ch;
    clearSelection();
    await draw2(el, p, 1);
  };
  // sent from a pane's page (Open beside): the reader goes to the other column, not into the tab strip of the pane it came from
  const from = beside ? dock.panes.find(x => x.el.contains(beside)) : undefined;
  if (from) dock.apart();
  const pane2 = dock.open('reader2', `${bk.name} ${st.chapter}`, `reader2|${clean}|${ver}`, from ? (from.side === 'right' ? 'left' : 'right') : 'left', async (el, p) => {
    if (!vw) {
      el.replaceChildren();
      head = h('header', 'pane-head reader2-head');
      const prev = h('button', 'icon-btn reader2-prev'), next = h('button', 'icon-btn reader2-next'), go = h('button', 'icon-btn reader2-go');
      prev.append(icon('left', 14)); next.append(icon('right', 14)); go.append(icon('sendto', 14));
      prev.title = 'The chapter before (this pane only)'; next.title = 'The next chapter (this pane only)';
      prev.onclick = () => turn(el, p, -1);
      next.onclick = () => turn(el, p, 1);
      go.title = 'Send to the reader'; go.setAttribute('aria-label', 'Send to the reader');
      const topVerseOf = () => {
        const top = [...vw!.root.querySelectorAll<HTMLElement>('.vn')].find(e => e.getBoundingClientRect().top >= el.getBoundingClientRect().top + head!.offsetHeight);
        return top ? +top.dataset.v! : 1;
      };
      go.onclick = () => void jump(st.code, st.chapter, topVerseOf());
      // (S6) the book and chapter picker, scoped to this pane: a choice turns this pane and never the reader
      const pickBtn = h('button', 'reader2-pick');
      pickBtn.title = 'Another book or chapter (this pane only)';
      pickBtn.append(icon('book', 14), h('span', 'reader2-title', `${bk.name} ${st.chapter}`), icon('down', 12));
      pickBtn.onclick = () => picker(pickBtn, () => ({ code: st.code, chapter: st.chapter }), (b, c) => { st.code = b.code; st.chapter = c; clearSelection(); void draw2(el, p, 1); });
      const title = h('h2', 'pane-title reader2-heading');
      title.append(pickBtn);
      const vers = segmented(VERSIONS, ver, v => {
        if (v === ver) return;
        const at = vw?.drawn ? topVerseOf() : 1;
        ver = v;
        clearSelection();
        void draw2(el, p, at);
      });
      vers.classList.add('reader2-ver');
      vers.title = 'KJV or YLT in this pane only';
      const row = h('div', 'reader2-row');
      row.append(prev, title, next, h('span', 'grow'), vers, go);
      head.append(row);
      const root = h('div', 'reader reader2');
      el.append(head, root);
      el.classList.add('reader2-pane');
      // The keyboard works in this pane (note b59b): it takes the focus when pressed in, so ↑ ↓ PgUp PgDn Home End scroll it
      // (the browser's own keyboard scrolling) and ← → turn its chapter, never the reader's.
      el.tabIndex = -1;
      el.addEventListener('pointerdown', ev => { if (!(ev.target as HTMLElement).closest('input, textarea, [contenteditable]')) el.focus({ preventScroll: true }); });
      turners.set(el, n => void turn(el, p, n));
      vw = { root, scroller: el, drawn: null, selector: null as unknown as Selector, main: false, pane: p };
      vw.selector = new Selector(root, el, handlersFor(vw));
      wireView(vw);
      el.addEventListener('scroll', () => { if (vw!.selector.sel) vw!.selector.placeHandles(); if (barView === vw) placeBar(); hideCard(); }, { passive: true });
      return draw2(el, p, st.verse);
    }
    // a write in the study folder: the marks drawn again, the text and the place stay
    if (drawnAt !== `${st.code}.${st.chapter}` || !vw.drawn) return draw2(el, p, st.verse);
    const { data } = await api.reader(st.code, st.chapter, ver);
    vw.drawn.marks = data.marks;
    vw.drawn.questions.clear();
    for (const q of data.questions || []) vw.drawn.questions.add(q.v);
    paint(vw.root, vw.drawn);
  });
  if (!readers2Watched.has(pane2.id)) {
    pane2.captureView = () => ({ code: st.code, chapter: st.chapter, version: ver });
    pane2.restoreView = async state => {
      if (!state || !books.some(b => b.code === state.code && Number.isInteger(state.chapter) && state.chapter >= 1 && state.chapter <= b.chapters)) return;
      st.code = state.code; st.chapter = state.chapter;
      if (VERSIONS.includes(state.version)) ver = state.version;
      await draw2(pane2.el, pane2, 1);
    };
    readers2Watched.add(pane2.id);
    const was = pane2.onClose;
    pane2.onClose = () => { was?.(); readers2.delete(pane2.id); readers2Watched.delete(pane2.id); readerMoved(); };
  }
}

/** A second reader's own chapter turn, by its scroll element: ← → in a pane turn that pane (note b59b). */
const turners = new WeakMap<HTMLElement, (n: number) => void>();

/** The second readers open, by pane: the chapter each shows (app.readers). */
const readers2 = new Map<string, { pane: string; code: string; chapter: number; label: string; view: View }>();
const readers2Watched = new Set<string>();

// ---- an Inbox note dragged from the Notebook onto a verse: placed there (wb note place) -------------------------------
let dropVerse = 0;
function markDrop(v: number) {
  if (v === dropVerse || !drawn) return;
  dropVerse = v;
  drawn.el.forEach((e, k) => e?.classList.toggle('drop-verse', drawn!.v[k] === v));
}
function verseUnder(t: EventTarget | null): number {
  const e = (t as HTMLElement | null)?.closest?.<HTMLElement>('.w, .vn, .g');
  if (!e || !drawn) return 0;
  return e.classList.contains('vn') ? +e.dataset.v! : drawn.v[+e.dataset.k!];
}
reader.addEventListener('dragover', e => {
  if (!e.dataTransfer?.types.includes('text/wb-jot')) return;
  const v = verseUnder(e.target);
  if (!v) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  markDrop(v);
});
reader.addEventListener('dragleave', e => { if (!reader.contains(e.relatedTarget as Node)) markDrop(0); });
reader.addEventListener('drop', async e => {
  const id = e.dataTransfer?.getData('text/wb-jot');
  const v = verseUnder(e.target);
  markDrop(0);
  if (!id || !v || !drawn) return;
  e.preventDefault();
  const d = drawn;
  try {
    const r = await wb(['note', 'place', id, `${d.chapter.code}.${d.chapter.chapter}:${v}`]);
    toast(`Placed on ${r.label}`);
    written('notes');
  } catch (x) { toast(String(x)); }
});

// ---- the book and chapter picker --------------------------------------------------------------------------------------
function picker(from: HTMLElement, cur: () => { code: string; chapter: number } | undefined = () => drawn ? { code: drawn.chapter.code, chapter: drawn.chapter.chapter } : undefined, pick: (b: Book, c: number) => void = (b, c) => void jump(b.code, c)) {
  const box = h('div', 'picker');
  const draw = (bk?: Book) => {
    box.replaceChildren();
    if (!bk) {
      for (const [t, name] of [['OT', 'Old Testament'], ['NT', 'New Testament']]) {
        box.append(h('div', 'label', name));
        const grid = h('div', 'book-grid');
        for (const b of books.filter(x => (x.testament || (x.id <= 39 ? 'OT' : 'NT')) === t)) {
          const btn = h('button', `book-btn${cur()?.code === b.code ? ' on' : ''}`, b.name);
          btn.onclick = () => (b.chapters === 1 ? go(b, 1) : draw(b));
          grid.append(btn);
        }
        box.append(grid);
      }
      return;
    }
    const top = h('div', 'picker-top');
    const backBtn = h('button', 'link-btn', '‹ Books');
    backBtn.onclick = () => draw();
    top.append(backBtn, h('strong', '', bk.name));
    box.append(top);
    const grid = h('div', 'ch-grid');
    for (let c = 1; c <= bk.chapters; c++) {
      const btn = h('button', `ch-btn${cur()?.code === bk.code && cur()?.chapter === c ? ' on' : ''}`, String(c));
      btn.onclick = () => go(bk, c);
      grid.append(btn);
    }
    box.append(grid);
  };
  const go = (b: Book, c: number) => { close(); pick(b, c); };
  draw(cur() ? books.find(b => b.code === cur()!.code) : undefined);
  const close = popMenu(from, box, { width: compact() ? window.innerWidth - 16 : 520 });
}

// ---- text size --------------------------------------------------------------------------------------------------------
let sizePct = 100;
function setSize(p: number) {
  const at = drawn ? topVerse() : null;
  sizePct = Math.max(75, Math.min(183, Math.round(p)));
  document.documentElement.style.setProperty('--read-scale', String(sizePct / 100));
  try { localStorage.setItem(SIZE_STORE, String(sizePct)); } catch { /* this run only */ }
  if (at) backTo(at);
  if (selector.sel) selector.placeHandles();
}

// ---- find in the chapter ------------------------------------------------------------------------------------------------
let finding = '';
let found: number[][] = [];
let foundAt = 0;
function findInChapter(q: string) {
  const fb = $('findbar');
  fb.hidden = false;
  if (!fb.firstChild) {
    const input = h('input', 'field') as HTMLInputElement;
    input.placeholder = 'Find in this chapter';
    const count = h('span', 'muted small find-count');
    const prev = h('button', 'icon-btn', '↑'), next = h('button', 'icon-btn', '↓'), x = h('button', 'icon-btn');
    x.append(icon('x'));
    prev.onclick = () => showFound(foundAt - 1);
    next.onclick = () => showFound(foundAt + 1);
    x.onclick = () => closeFind();
    input.oninput = () => findInChapter(input.value);
    input.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); showFound(foundAt + (e.shiftKey ? -1 : 1)); }
      if (e.key === 'Escape') { e.stopPropagation(); closeFind(); }
    };
    fb.append(input, count, prev, next, x);
  }
  const input = fb.querySelector('input')!;
  if (input.value !== q) input.value = q;
  finding = q;
  const d = drawn;
  reader.querySelectorAll('.w.found').forEach(e => e.classList.remove('found', 'found-now'));
  found = [];
  if (d && q.trim()) {
    // the words' own text joined as drawn, so a phrase is found across words; case and punctuation ignored
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
    const parts = d.text.map(t => norm(t));
    const want = norm(q).trim().split(/\s+/);
    for (let k = 0; k + want.length <= parts.length; k++) {
      let ok = true;
      for (let j = 0; j < want.length && ok; j++) {
        const p = parts[k + j];
        ok = j === 0 && want.length === 1 ? p.includes(want[0]) : j === 0 ? p.endsWith(want[0]) : j === want.length - 1 ? p.startsWith(want[j]) : p === want[j];
      }
      if (ok) found.push([...Array(want.length).keys()].map(j => k + j));
    }
    for (const run of found) for (const k of run) d.el[k]?.classList.add('found');
  }
  fb.querySelector('.find-count')!.textContent = q.trim() ? `${found.length ? foundAt + 1 : 0} of ${found.length}` : '';
  input.focus();
  if (found.length) showFound(0, false);
}
function showFound(n: number, focusInput = true) {
  if (!found.length || !drawn) return;
  foundAt = (n + found.length) % found.length;
  reader.querySelectorAll('.found-now').forEach(e => e.classList.remove('found-now'));
  const els = found[foundAt].map(k => drawn!.el[k]).filter(Boolean);
  els.forEach(e => e.classList.add('found-now'));
  els[0]?.scrollIntoView({ block: 'center' });
  $('findbar').querySelector('.find-count')!.textContent = `${foundAt + 1} of ${found.length}`;
  if (focusInput) $('findbar').querySelector('input')?.focus();
}
function closeFind() {
  finding = '';
  found = [];
  reader.querySelectorAll('.w.found').forEach(e => e.classList.remove('found', 'found-now'));
  const fb = $('findbar');
  fb.hidden = true;
}

/** An eye turned in every drawn reader at once (the marks carry which folders are hidden), then the study's own answer. */
function setEyes(markIds: string[], hide: boolean) {
  const apply = (m: { hidden?: string[] }) => { const s = new Set(m.hidden || []); for (const id of markIds) { if (hide) s.add(id); else s.delete(id); } m.hidden = [...s]; };
  if (drawn) apply(drawn.marks);
  for (const { view } of readers2.values()) if (view.drawn) apply(view.drawn.marks);
  repaintLayers();
}

// ---- the marks panel (rows 44 to 46): what is drawn, by kind and by legend entry, and Reading mode ----------------------
async function marksPanel(box: HTMLElement, again: () => void) {
  const wrap = h('div', 'marks-panel');
  const row = (label: string, on: boolean, flip: () => Promise<void>, sample?: HTMLElement) => {
    const b = h('button', `menu-item check${on ? ' on' : ''}`);
    b.setAttribute('aria-pressed', String(on));
    b.append(icon(on ? 'eye' : 'eyeoff', 14));
    if (sample) b.append(sample);
    b.append(document.createTextNode(` ${label}`));
    b.onclick = async () => { try { await flip(); } catch (x) { toast(String(x)); } repaintLayers(); again(); };
    wrap.append(b);
  };
  wrap.append(h('div', 'label', 'Marks'));
  row('Reading mode (only the text)', panel.reading, () => panel.setReading(!panel.reading));
  wrap.append(h('div', 'label', 'Kinds'));
  for (const [k, name] of KIND_NAMES) row(name, !panel.kinds.has(k), () => panel.setKind(k, panel.kinds.has(k)));
  let legend: { entries: any[]; unlisted: any[] } = { entries: [], unlisted: [] };
  try { legend = await wb(['legend']); } catch { /* outside the app: no legend */ }
  const listed = [...(legend.entries || []), ...(legend.unlisted || [])];
  if (listed.length) {
    wrap.append(h('div', 'label', 'Legend'));
    for (const e of listed) {
      const sample = h('i', 'sample');
      const color = e.color as string;
      sample.style.background = e.kind === 'highlight' ? (['yellow', 'green', 'blue', 'pink', 'orange'].includes(color) ? `var(--hl-${color})` : color) : inkOf(color);
      sample.dataset.kind = e.kind;
      row(`${e.label} (${e.count})`, !panel.styles.has(e.style), () => panel.setStyle(e.style, panel.styles.has(e.style)), sample);
    }
  }
  box.append(wrap);
}

// ---- the Highlights menu: layers -------------------------------------------------------------------------------------
async function highlightsMenu(from: HTMLElement) {
  const box = h('div', 'menu-list layers-menu');
  const toggle = (label: string, on: boolean, flip: () => void, dot?: HTMLElement) => {
    const b = h('button', `menu-item check${on ? ' on' : ''}`);
    b.setAttribute('aria-pressed', String(on));
    b.append(icon(on ? 'eye' : 'eyeoff', 14));
    if (dot) b.append(dot);
    b.append(document.createTextNode(` ${label}`));
    b.onclick = () => { flip(); layers.save(); repaintLayers(); close(); void highlightsMenu(from); };
    box.append(b);
  };
  box.append(h('div', 'label', 'In all readers'));
  box.append(h('p', 'layers-hint', 'Controls highlight fills and the tabs of folders with a color. Notes, questions and verse markers stay visible.'));
  toggle('All highlights and folder lines', layers.all, () => { layers.all = !layers.all; });
  toggle('Your highlights', layers.mine, () => { layers.mine = !layers.mine; });
  // Shown on the text (T1, T10, T11): the folders with a color, the shown ones first, the rest folded under their parent
  let ts: any[] = [], where: any[] = [];
  try { [ts, where] = await Promise.all([wb(['folder', 'shown']), wb(['folder', 'list'])]); } catch { /* outside the app */ }
  if (ts.length) {
    box.append(h('div', 'label', 'Shown on the text'));
    const parentOf = (key: string) => { const f = where.find(x => x.id === key); const p = where.find(x => x.id === f?.parent); return p ? p.name : 'Other folders'; };
    const row = (t: any) => {
      const b = h('button', `menu-item check eye-row${t.shown ? ' on' : ''}`);
      b.setAttribute('aria-pressed', String(t.shown));
      b.append(icon(t.shown ? 'eye' : 'eyeoff', 14), h('i', `dot c-${t.color}`), h('span', 'eye-name', t.name));
      b.onclick = async () => { try { await wb(['folder', 'shown', t.key, t.shown ? 'off' : 'on']); setEyes([t.mark], t.shown); } catch (x) { toast(String(x)); } close(); void highlightsMenu(from); };
      return b;
    };
    const search = h('input', 'field small eye-search') as HTMLInputElement;
    search.placeholder = 'Find a folder';
    search.setAttribute('aria-label', 'Find a folder with a color');
    const list = h('div', 'eye-list');
    const paint = () => {
      const q = search.value.trim().toLowerCase();
      list.replaceChildren();
      const hit = ts.filter(t => !q || t.name.toLowerCase().includes(q));
      for (const t of hit.filter(t => t.shown)) list.append(row(t));
      const rest = hit.filter(t => !t.shown);
      const by = new Map<string, any[]>();
      for (const t of rest) by.set(parentOf(t.id), [...(by.get(parentOf(t.id)) || []), t]);
      for (const [p, rows] of by) {
        const d = h('details', 'eye-group') as HTMLDetailsElement;
        d.open = !!q;
        d.append(h('summary', '', `${p} (${rows.length})`), ...rows.map(row));
        list.append(d);
      }
    };
    search.oninput = paint;
    paint();
    const hideAll = h('button', 'menu-item eye-hide-all', 'Hide all');
    hideAll.onclick = async () => {
      try {
        const r = await wb(['folder', 'shown', '--none']);
        const was = ts.filter(t => t.shown).map(t => t.mark);
        setEyes(ts.map(t => t.mark), true);
        close();
        toastUndo('Every folder line is hidden', async () => { await wb(['folder', 'shown', ...((r?.was_shown || []) as string[]).flatMap(k => ['--restore', k])]); setEyes(was, false); });
      } catch (x) { toast(String(x)); }
    };
    box.append(search, hideAll, list);
  }
  await marksPanel(box, () => { close(); void highlightsMenu(from); });
  const list = h('button', 'menu-item', 'Your highlights, listed…');
  list.onclick = () => { close(); openMarked('', 'all'); };
  box.append(list);
  const close = popMenu(from, box, { align: 'right', width: 280 });
}

// ---- More ------------------------------------------------------------------------------------------------------------
const PRESETS = [['phone', 'Phone 390×844'], ['phone-landscape', 'Phone landscape'], ['ipad', 'iPad portrait 820×1180'], ['ipad-landscape', 'iPad landscape'], ['laptop', 'Laptop 1280×800'], ['laptop-large', 'Laptop 1440×900'], ['desktop', 'Desktop 1920×1080']];

// At the end of a chapter: a quiet way to record it as read (the reading log; wb read mark does the same). The log
// says how many times it was read and when last (wb read times), so coming back to the chapter shows it; Mark unread
// takes the latest mark off (wb read unmark; the line is kept in .trash). Note c419.
function chapterEnd(d: Drawn) {
  planReading.endCard(d, reader);   // the day's card (R3): a reading of the open plan day, one step, never marked by itself
  const place = `${d.chapter.name} ${d.chapter.chapter}`;
  const end = h('div', 'chapter-end');
  const said = h('span', 'chapter-read');
  const btn = h('button', 'btn soft', `Mark ${place} read`);
  const unread = h('button', 'link-btn chapter-unread', 'Mark unread');
  unread.title = 'Take the latest mark off the reading log';
  const show = (r: { times: number; last: string } | undefined) => {
    const when = r ? new Date(r.last).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    said.textContent = r ? `${place}: ${r.times === 0 ? 'read in part' : `read ${r.times === 1 ? 'once' : `${r.times} times`}`} · last ${when}` : '';
    btn.textContent = r && r.times > 0 ? 'Read again' : `Mark ${place} read`;
    unread.hidden = !r;
  };
  const times = async () => show(Object.values((await wb(['read', 'times', place])) ?? {})[0] as any);
  btn.onclick = async () => {
    try {
      await wb(['read', 'mark', place]);
      await times();
      app.changed('plans');
    } catch (e) { toast(String(e)); }
  };
  unread.onclick = async () => {
    try {
      const r = await wb(['read', 'unmark', place]);
      show(Object.values(r.now ?? {})[0] as any);
      toast(Object.keys(r.now ?? {}).length ? `One mark taken off ${place}` : `${place} is marked unread`);
      app.changed('plans');
    } catch (e) { toast(String(e)); }
  };
  show(undefined);
  end.append(said, btn, unread);
  reader.append(end);
  times().catch(() => { /* the button still works */ });
}

// Today's readings in each plan the person started (wb plan start / wb plan import); a day opens at its first place.
async function todaySection(into: HTMLElement) {
  if (!inApp) return;
  let today;
  try { today = (await api.planToday()).data; } catch { return; }
  if (!today.plans.length) return;
  into.append(h('div', 'label', "Today’s reading"));
  for (const p of today.plans) {
    const line = p.finished ? 'finished' : `day ${p.day ?? '–'} of ${p.of}` + (p.behind > 1 ? ` · ${p.behind} days to catch up` : '');
    into.append(h('div', 'plan-name', `${p.plan} — ${line}`));
    const row = h('div', 'wrap');
    for (const day of p.to_read.slice(-3)) {
      const go = h('button', 'btn', day.label);
      go.onclick = () => {
        const [code, rest] = day.entries[0].split('.');
        const [ch, v] = rest.split(':');
        closeSheet(); closeMenu();
        jump(code, +ch, v ? parseInt(v, 10) : 1);
      };
      row.append(go);
    }
    into.append(row);
  }
}

function settings(from: HTMLElement) {
  // More (design/features/command round 2, C5 and C13): what is about the window, not the study. The panes are on the
  // rail; under 900 px the reader's tools that sit at the box's end fold in here too (C17).
  const b = h('div', 'settings more-menu');
  const go = (label: string, ico: string, fn: (at: HTMLElement) => void, sub = '', key = '') => {
    const x = h('button', 'menu-item more-item');
    x.append(icon(ico, 16));
    const t = h('span', 'more-text');
    t.append(h('span', '', label));
    if (sub) t.append(h('span', 'muted small', sub));
    x.append(t);
    if (key) x.append(h('kbd', '', key));
    x.onclick = () => { closeSheet(); closeMenu(); fn(from); };
    b.append(x);
  };
  if (compact() || !inApp) {
    const reading = h('div');
    b.append(h('h2', 'sheet-title', 'More'), reading);
    todaySection(reading);
  }
  if (!compact() && window.innerWidth < 900) {
    b.append(h('div', 'label', 'The reader'));
    for (const id of READER_TOOLS) { const it = byId(id)!; go(id === 'version' ? `Version: ${version}` : it.label, it.icon || 'book', at => it.run(at), it.sub); }
    b.append(h('div', 'label', 'The window'));
  }
  // the phone has no rail: its panes stay in More, as they were
  if (compact()) {
    b.append(h('div', 'label', 'Panes'));
    for (const it of CATALOG.filter(i => i.group === 'Panes' && i.more)) go(it.label, it.icon || 'book', at => it.run(at));
    b.append(h('div', 'label', 'The window'));
  }
  go('Full screen', 'expand', () => void toggleFullScreen(), '', 'F11');
  go('Layout', 'sidebar', at => void layoutMenu(at, s => void openSettings(s)), 'Open or save an arrangement of panes');
  go('Theme', 'eye', () => flipTheme(), 'Light or dark');
  go('Text size', 'heading', at => textSizeMenu(at), `${sizePct}%`, 'Ctrl+=');
  go('Settings…', 'settings', () => openSettings(), '', 'Ctrl+,');
  go('Help', 'help', () => openHelp(), 'Guide · Keys · Manual', 'F1');
  go('Save chapter PDF', 'file', () => {
    void runLine('pdf').then(result => toast(result.said || result.error || 'Could not save the chapter PDF'))
      .catch(error => toast(String(error.message || error)));
  });
  if (compact() || !inApp) openSheet(b, from);
  else popMenu(from, b, { align: 'right', width: 300 });
}

function segmented(opts: string[], cur: string, pick: (o: string) => void) {
  const s = h('div', 'seg');
  for (const o of opts) {
    const x = h('button', o === cur ? 'on' : '', o);
    x.onclick = () => { s.querySelectorAll('button').forEach(y => y.classList.remove('on')); x.classList.add('on'); pick(o); };
    s.append(x);
  }
  return s;
}

$('more').onclick = () => settings($('more'));
$('tab-more').onclick = () => settings($('tab-more'));
$('prev').onclick = () => step(-1);
$('next').onclick = () => step(1);
$('place').onclick = () => (compact() ? settings($('place')) : picker($('place')));
// the pen: at desktop sizes, write in the Notebook's box on the place picked in the reader (or the verse at the top);
// on a phone it will open the palette (phase 3)
$('pen').onclick = () => (compact() ? toast('Phase 3: the palette') : void writeInNotebook(here(), false));
$('pen').title = 'Write a page (on the place you picked, or the verse at the top)';
$('tab-notebook').onclick = () => openNotebook();
$('tab-study').onclick = () => openHelp();
$('cmdbox').prepend(icon('search'));
initPopOff();
notebookBadge.set = n => setBadge(n);
hooks.highlights = from => void highlightsMenu(from);
hooks.toggleVersion = () => setVersion(version === 'KJV' ? 'YLT' : 'KJV');
hooks.find = () => findInChapter(finding);
hooks.listen = () => { void readAloud.execute({ action: 'start' }).then(toast).catch(e => toast(String(e))); };
cmdFills.get = () => {
  const d = drawn, sel = selector.sel;
  let word = '';
  if (d && sel) word = Array.from({ length: sel.b - sel.a + 1 }, (_, i) => d.el[sel.a + i]?.textContent ?? '').join(' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
  return { word, place: here().label, chapter: d ? `${d.chapter.name} ${d.chapter.chapter}` : '' };
};
initReaderTools();
initRail();
initTrail($('trailline'));
// The box shows the line of the tab in front (command C14): the reader's place, or the line that opened the pane.
const cmdInput = $<HTMLInputElement>('cmd');
cmdBox.shows = () => { const f = frontStep(); return f ? f.line || f.title : $('place').textContent?.trim() || ''; };
onFront(() => {
  const f = frontStep();
  // the reader's tools stay while a reader is in front: the main one or a second reader (both are drawn by them)
  $('cmdbox').classList.toggle('pane-front', !!f && !f.key.startsWith('reader|') && f.kind !== 'reader2');
  if (document.activeElement !== cmdInput) cmdInput.value = cmdBox.shows();
});
cmdBox.before = () => frontStep()?.key ?? '';
// Enter changes the tab in front (C14): when the line opened another pane of the same kind or in the same group, the old
// one closes; Alt+Enter keeps it (a new tab).
cmdBox.after = (was, newTab) => {
  const f = frontStep();
  if (newTab || !was || was.startsWith('reader|') || !f || f.key === was || f.key.startsWith('reader|')) return;
  const old = dock.find(was), now = dock.find(f.key);
  if (old && now && old !== now && (old.kind === now.kind || old.group === now.group)) void dock.close(old);
};

// A box that is being scrolled shows its scrollbar for a moment afterwards (style.css; note cd59). Scroll events do not
// bubble, so this listens in the capture phase.
const scrollTimers = new WeakMap<Element, number>();
document.addEventListener('scroll', e => {
  const el = e.target instanceof Element ? e.target : document.documentElement;
  el.classList.add('scrolling');
  clearTimeout(scrollTimers.get(el));
  scrollTimers.set(el, window.setTimeout(() => el.classList.remove('scrolling'), 800));
}, { capture: true, passive: true });

// The mark bar's keys (H U C B A N, 1 to 6, a kind's key twice): taken before anything else while the bar is open.
document.addEventListener('keydown', e => {
  if (arrow && e.key === 'Escape') { endArrow(); e.preventDefault(); e.stopPropagation(); return; }   // Cancel (row 16)
  if (markBar && barView?.selector.sel && markBar.onKey(e)) { e.preventDefault(); e.stopPropagation(); }
}, true);

document.addEventListener('keydown', e => {
  const typing = !!(e.target as HTMLElement).closest('input, textarea, [contenteditable]');
  if (e.key === 'Escape') { closeSheet(); clearSelection(); hideCard(); }
  // Ctrl+F finds in the pane last clicked or typed in, else in the chapter (note 5c4a)
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); const p = paneForFind(); if (p) findInPane(p); else findInChapter(finding); return; }
  // Ctrl+K, anywhere: the Library's one search with its live preview (notebook row 34)
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); toggleQuickSearch(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); setSize(sizePct + 10); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === '-') { e.preventDefault(); setSize(sizePct - 10); return; }
  { const kc = commandByKey(e); if (kc) { e.preventDefault(); void runKeptCommand(kc); return; } }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === ',') { e.preventDefault(); openSettings(); return; }
  if (e.key === 'F1' && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); openSettings('guide'); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === '0') { e.preventDefault(); setSize(100); return; }
  // a finding about the app, from anywhere (note 50c1)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') { e.preventDefault(); findingBox(); return; }
  // quick capture (Ctrl+J unless set otherwise in the Notebook's settings): a small box at the verse, from anywhere
  if (isCaptureKey(e)) { e.preventDefault(); quickCapture(); return; }
  if (typing) return;
  // ← → turn the chapter of the reader the key was pressed in: a second reader turns its own, never the main reader's
  const in2 = (e.target as HTMLElement).closest<HTMLElement>('.reader2-pane');
  const turn2 = in2 && turners.get(in2);
  if (e.key === 'ArrowRight' && !e.altKey) { if (turn2) { e.preventDefault(); turn2(1); } else step(1); }
  if (e.key === 'ArrowLeft' && !e.altKey) { if (turn2) { e.preventDefault(); turn2(-1); } else step(-1); }
  if (e.key === 'ArrowLeft' && e.altKey) back();
});
// Never lose the place when the text reflows (a narrower window, a dock column opening, a larger text size): the verse
// at the top stays at the top. A resize has already reflowed when it is heard, so it goes back to the place last saved.
function backTo(p: { verse: number; offset: number }) {
  const vn = reader.querySelector<HTMLElement>(`.vn[data-v="${p.verse}"]`);
  if (vn && (p.verse > 1 || p.offset)) scroller.scrollTop = reader.offsetTop + vn.offsetTop - 12 + p.offset;
}
let resizing = 0;
window.addEventListener('resize', () => {
  document.documentElement.dataset.size = sizeClass();
  const p = { ...place };
  cancelAnimationFrame(resizing);
  resizing = requestAnimationFrame(() => { if (drawn && p.code === drawn.chapter.code && p.chapter === drawn.chapter.chapter) backTo(p); selector.placeHandles(); placeBar(); });
});

// ---- the hub ----------------------------------------------------------------------------------------------------------
Object.assign(app, {
  go: jump,
  step,
  back,
  refreshMarks,
  repaintLayers,
  topVerse: () => topVerse().verse,
  setSize,
  size: () => sizePct,
  version: () => version,
  setVersion,
  findInChapter,
  listen: (command: Parameters<typeof readAloud.execute>[0]) => readAloud.execute(command),
  secondReader: (ref: string, version?: string, beside?: HTMLElement | null) => void openSecondReader(ref, version, beside),
  showMarginNote: async (id: string, at: string) => {
    const p = /^([1-3A-Z]{3})\.(\d+)(?::(\d+))?/.exec(at);
    if (!p) return;
    margin.show(id);   // before the chapter is drawn, so the note is shown when its chapter's notes arrive
    await jump(p[1], +p[2], p[3] ? +p[3] : 1);
    margin.show(id);   // the chapter was already drawn: its notes are here
  },
  readers: () => [...readers2.values()].filter(r => dock.panes.some(p => p.id === r.pane))
    .map(({ pane, code, chapter, label }) => ({ pane, code, chapter, label })),
  changed: (...what: Change[]) => { written(...what); if (!what.length || what.includes('threads')) loadThreads(); },
});

bridge.size = () => sizePct;
bridge.setSize = setSize;
bridge.version = () => version;
bridge.setVersion = setVersion;
bridge.openKeys = () => void openKeys();
bridge.inputMode = () => selector.mode;
bridge.setInputMode = m => { selector.mode = m as InputMode; document.documentElement.dataset.input = m; };

// ---- start ------------------------------------------------------------------------------------------------------------
async function start() {
  // A first run (or a moved folder) opens the setup screen, and the reader starts after it.
  if (await setupIfNeeded()) return;
  document.documentElement.dataset.size = sizeClass();
  try {
    const t = localStorage.getItem('wb.theme');
    if (t && t !== 'system') document.documentElement.dataset.theme = t;
    document.documentElement.dataset.hover = localStorage.getItem('wb.hover') || 'off';
    setSize(+(localStorage.getItem(SIZE_STORE) || 100));
  } catch { /* defaults */ }
  refreshInks();
  initPanes($('dock'));
  // a minimized tab is a link that opens again the way a layout does (design/features/minimize round 7)
  dock.canReopen = canReopen;
  dock.reopen = key => reopen(key);
  railLinksInit();
  dock.onOpen = (p, isNew) => paneStep(p, isNew);
  dock.onLayout = () => railOn();
  dock.keepPlace = () => {
    const at = drawn ? topVerse() : null;
    return () => { if (at) backTo(at); };
  };
  const p = loadPlace();
  const bookList = api.books().then(r => { books = r.data; app.books = books; });
  await open(p.code, p.chapter, p.verse, p.offset);
  await document.fonts.ready;
  await bookList;
  const report = { nav_to_ready_ms: performance.now(), size: [window.innerWidth, window.innerHeight], dpr: devicePixelRatio, compact: compact(), perf: perf.entries };
  (window as any).__wbReady = report;
  api.uiReady(report).catch(() => {});
  // the desktop after the first chapter is on screen: the command field, the Notebook docked, wb do
  attachCommandField();
  onDo(async line => (await updateLine(line)) ?? runLine(line));
  startUpdates();
  // Restart now keeps the place and what is half written; the start after it puts them back (updates U-8)
  restartHooks.capture = () => { savePlace(); captureRestart(); };
  if (inApp) {
    void readSettings();
    void loadWindowSettings();
    void panel.load().then(() => repaintLayers());
    void loadKept();
    loadPalette();
    if (sizeClass() !== 'compact' && new URLSearchParams(location.search).get('notebook') !== '0') { openNotebook(); focusReader(); }
  }
  void restoreRestart();
}

(window as any).__wb = { menu: openMenu, refreshUpdates, panel, open, plans: openPlans, concordance: openConcordance, note: (id: string) => openNote(id), perf, selector, dock: () => dock, run: (l: string) => runLine(l), parse, changed: () => app.changed(), repaint: () => drawn && paint(reader, drawn), get drawn() { return drawn; } };
start().catch(e => { reader.innerHTML = `<p class="error">${String(e)}</p>`; });
void here;
