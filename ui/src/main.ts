// Bible Workbench: the reader with its marks, tap cards, touch selection, hover cards and the color bar (phase 0), and
// the desktop around it (phase 2): the toolbar with the command field, the dock of panes, the Notebook, threads and
// layers, word study, find, text size and the keyboard. See docs/phase0-results.md and docs/phase2-results.md.
import '@fontsource/literata/400.css';
import '@fontsource/literata/400-italic.css';
import '@fontsource/literata/500-italic.css';
import '@fontsource/literata/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/noto-sans-hebrew/400.css';
import { api, inApp, onDo, wb, type WordView, type VerseView, type Book, type Mark } from './api';
import { draw, drawTimes, paint, textOf, labelOf, type Drawn } from './reader';
import { Selector, type InputMode } from './select';
import { openSheet, closeSheet, showCard, hideCard, toast, compact } from './sheets';
import { perf, afterPaint, record } from './perf';
import { app, goTo, here, type At } from './app';
import { layers } from './layers';
import { h, hoverMode, icon, popMenu, setHover, sizeClass, closeMenu } from './ui';
import type { Pane } from './dock';
import { dock, initPanes, openPlans, openPlace, openInterlinear, openStrong, openKeys, openHelp, openMarked, openShelf, openThread, openThreads, openToday, openUses, threadChooser } from './panes';
import { isCaptureKey, notebookBadge, openNotebook, quickCapture, readerMoved, readSettings, writeInNotebook } from './notebook';
import type { Change } from './dock';
import { attachCommandField, loadThreads } from './command';
import { findInPane, paneForFind } from './panefind';
import { findingBox, openFindings } from './findings';
import { openDocuments } from './documents';
import { parse, runLine, written } from './actions';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reader = $('reader'), scroller = $('scroller');
const COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'];
const STORE = 'wb.place.v1';
const SIZE_STORE = 'wb.size.v1';

let drawn: Drawn | null = null;
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
  placeButton(`${data.chapter.name} ${chapter}`);
  readerMoved();
  $('tb-version').textContent = data.chapter.version || 'KJV';
  const t2 = performance.now();
  await afterPaint();
  record('chapter', performance.now() - t0, { rust_ms, ipc_ms: t1 - t0 - rust_ms, ...drawTimes, frame_ms: performance.now() - t2, words: drawn.el.length, at: `${code} ${chapter}` });
  // The rest of a long chapter, a part at a time between frames.
  const d = drawn;
  const rest = () => {
    if (seq === drawSeq && d.more()) setTimeout(rest, 0);
    else if (seq === drawSeq) { record('chapter-complete', performance.now() - t0, { at: `${code} ${chapter}` }); chapterEnd(d); if (finding) findInChapter(finding); }
  };
  setTimeout(rest, 0);
  savePlace();
}

function placeButton(label: string) {
  const b = $('place');
  b.replaceChildren(icon('book'), h('span', 'place-label', label), icon('down', 14));
}

/** A jump elsewhere: the place left is kept for back. */
async function jump(code: string, chapter: number, verse = 1) {
  if (drawn) { savePlace(); backStack.push({ ...place }); if (backStack.length > 50) backStack.shift(); }
  app.picked = verse > 1 ? { anchor: `${code}.${chapter}:${verse}`, label: `${books.find(b => b.code === code)?.name ?? code} ${chapter}:${verse}` } : null;
  await open(code, chapter, verse);
}

function back(): boolean {
  const p = backStack.pop();
  if (!p) return false;
  open(p.code, p.chapter, p.verse, p.offset);
  return true;
}

function step(n: number) {
  if (!drawn) return;
  const c = drawn.chapter;
  let i = books.findIndex(b => b.code === c.code), ch = c.chapter + n;
  if (ch < 1) { if (i <= 0) return; i--; ch = books[i].chapters; }
  else if (ch > c.chapters) { if (i < 0 || i >= books.length - 1) return; i++; ch = 1; }
  app.picked = null;
  open(books[i]?.code ?? c.code, ch);
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
function lexiconBody(w: WordView, card = false): HTMLElement {
  const b = h('div', 'lex');
  if (card) b.append(h('div', 'card-head', `${w.text} · ${w.reference}`));
  else { b.append(h('h2', 'sheet-title', w.text), h('div', 'sheet-sub', w.reference)); }
  const lx = w.lexicon;
  if (!lx) { b.append(h('p', 'muted', 'No Strong’s number on this word.')); return b; }
  const row = h('div', 'lemma-row');
  const lemma = h('span', 'lemma', lx.lemma);
  lemma.lang = lx.lang === 'grk' ? 'grc' : 'he';
  lemma.dir = lx.lang === 'grk' ? 'ltr' : 'rtl';
  const tr = h('div');
  tr.append(h('div', 'translit', lx.translit || ''), h('div', 'muted small', `${lx.strong} · Strong's`));
  row.append(lemma, tr);
  b.append(row);
  if (lx.definition) b.append(h('p', 'def', lx.definition));
  if (lx.usage) b.append(h('p', 'usage', `KJV: ${lx.usage}`));
  if (w.count) {
    const chips = h('div', 'chips');
    chips.append(h('span', 'chip', `${w.count.times} times in ${w.count.verses} verses`), h('span', 'chip', `${w.count.books} books`));
    b.append(chips);
  }
  if (!card) {
    const acts = h('div', 'acts two');
    const uses = h('button', 'btn primary', 'Every use');
    uses.onclick = () => { closeSheet(); openUses(lx.strong, ''); };
    const inter = h('button', 'btn', 'Interlinear');
    inter.onclick = () => { closeSheet(); const [, cv] = w.anchor.split('.'); openInterlinear(`${w.anchor.slice(0, 3)} ${cv}`, w.reference); };
    acts.append(uses, inter);
    b.append(acts);
    if (!compact()) b.append(actions(['Open as a tab'], () => { closeSheet(); openStrong(lx.strong); }));
    for (const n of w.notes) b.append(noteCard(n.anchor === w.anchor ? w.reference : `${lx.strong} everywhere`, n.text));
    const note = h('button', 'btn soft wide', `Note on ${lx.strong} everywhere`);
    note.onclick = () => writeNote(note, { anchor: lx.strong, label: `${lx.strong} everywhere` }, 'note');
    b.append(note);
  }
  return b;
}

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
    dot.title = `${c[0].toUpperCase() + c.slice(1)} (${n + 1})`;
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
  if (!inApp) return toast('Threads are changed in the app');
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

const anchorOf = (m: Mark) => {
  const start = `${m.code}.${m.c1}:${m.v1}` + (m.i1 !== null ? `.${m.i1}` : '');
  return m.c2 === null ? start : `${start}-${m.c2}:${m.v2}` + (m.i2 !== null ? `.${m.i2}` : '');
};

async function addHighlight(m: Mark) {
  if (!inApp && !m.color) return toast('Removed (this session only)');
  if (!inApp) {
    // In the WebKit tests there is no Rust: the mark is drawn for this session only.
    drawn!.marks.highlights.push(m);
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
function selectVerse(vw: View, v: number, el: HTMLElement, at: number) {
  const d = vw.drawn;
  if (!d || compact() || d.chapter.version) return void openVerse(vw, v, el, at);
  const a = d.v.indexOf(v), b = d.v.lastIndexOf(v);
  if (a < 0) return;
  while (!d.el[b] && d.more()) { /* the rest of the verse drawn first */ }
  barVerse = v;
  vw.root.querySelectorAll('.vn.vsel').forEach(e => e.classList.remove('vsel'));
  vw.selector.set(a, b);
  vw.root.querySelector(`.vn[data-v="${v}"]`)?.classList.add('vsel');
  showBar(vw, a, b, false);
}

function showBar(vw: View, a: number, b: number, touch: boolean) {
  bar?.remove();
  // one selection at a time: a selection in another reader clears the one before
  if (barView && barView !== vw && barView.selector.sel) { const old = barView; barView = null; old.selector.clear(); }
  const d = vw.drawn!;
  if (d.chapter.version) { vw.selector.clear(); toast(`Words are selected in the KJV (version kjv): highlights and notes on words belong to its words`); return; }
  const verse = barVerse && d.v[a] === barVerse && d.v[b] === barVerse && (a === 0 || d.v[a - 1] !== barVerse) && (b === d.v.length - 1 || d.v[b + 1] !== barVerse) ? barVerse : 0;
  barVerse = 0;
  barView = vw;
  const at = verse ? verseAt(d, verse) : selectionAt(vw, a, b);
  app.picked = at;
  bar = h('div', touch ? 'selbar' : 'colorbar');
  if (verse) bar.classList.add('verse-bar');
  const pick = (c: string | null) => {
    if (verse) addHighlight({ kind: 'verse', code: d.chapter.code, c1: d.chapter.chapter, v1: verse, i1: null, c2: null, v2: null, i2: null, id: `session_${Date.now()}`, color: c ?? undefined });
    else addHighlight({ kind: a === b ? 'word' : 'phrase', code: d.chapter.code, c1: d.chapter.chapter, v1: d.v[a], i1: d.i[a], c2: a === b ? null : d.chapter.chapter, v2: a === b ? null : d.v[b], i2: a === b ? null : d.i[b], id: `session_${Date.now()}`, color: c ?? undefined });
    vw.selector.clear();
  };
  barPick = pick;
  // a whole verse: its own color shows on the bar
  const current = verse ? d.marks.highlights.find(m => m.kind === 'verse' && m.c1 === d.chapter.chapter && m.v1 === verse && m.c2 === null)?.color : undefined;
  bar.append(colorRow(current, pick, true));
  if (!touch) bar.append(threadChips(at));
  const names = touch ? ['Note', 'Thread', 'Look up', 'Copy'] : verse ? ['Note', 'Question', 'Thread', 'Copy', 'Notes & lookup', 'Open as a tab'] : ['Note', 'Thread', 'Copy', 'Notes & lookup'];
  bar.append(actions(names, (act, el) => {
    if (act === 'Copy') copy(`${textOf(d, a, b)} (${at.label} KJV)`);
    else if (act === 'Notes & lookup') { vw.selector.clear(); openPlace(at.anchor, at.label); }
    else if (act === 'Open as a tab') { vw.selector.clear(); openSecondReader(at.anchor, 'KJV'); }
    else if (act === 'Look up') {
      const k = [...Array(b - a + 1).keys()].map(n => a + n).find(k => d.strong[k]);
      if (k !== undefined) openWord(vw, k, d.el[k], performance.now());
    } else if (act === 'Thread') addToThread(el, at);
    else writeNote(el, at, act === 'Question' ? 'question' : 'note');
  }));
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  document.getElementById('overlay')!.append(bar);
  placeBar();
}

// On the color bar: your three most recently changed threads, one click to add the selection (again to take it out).
let barPick: ((c: string | null) => void) | null = null;
function threadChips(at: At): HTMLElement {
  const box = h('span', 'cb-chips');
  if (!inApp) return box;
  Promise.all([wb(['thread', 'list']), wb(['anchor', at.anchor]).catch(() => ({ threads: [] }))]).then(([ts, here]) => {
    const holding = new Set((here.threads || []).map((t: any) => t.id));
    for (const t of (ts as any[]).slice(0, 3)) {
      const chip = h('button', `cb-chip${holding.has(t.id) ? ' in' : ''}`);
      chip.append(h('i', `dot c-${t.color}`), document.createTextNode(` ${t.name}`));
      chip.title = holding.has(t.id) ? `In ${t.name}: click to take it out` : `Add to ${t.name}`;
      chip.onclick = async () => {
        const inIt = chip.classList.contains('in');
        try {
          await wb(['thread', inIt ? 'rm' : 'add', t.name, at.anchor]);
          chip.classList.toggle('in', !inIt);
          chip.title = !inIt ? `In ${t.name}: click to take it out` : `Add to ${t.name}`;
          toast(inIt ? `Taken out of ${t.name}` : `${at.label} added to ${t.name}`);
          written('threads');
        } catch (e) { toast(String(e)); }
      };
      box.append(chip);
    }
    placeBar();
  }).catch(() => {});
  return box;
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
  openSheet(lexiconBody(data), el, { closed: () => el.classList.remove('tapped') });
  await afterPaint();
  record('word-sheet', performance.now() - at, { word: data.text, rust_ms, call_ms: t1 - at });
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
    tapWord: (k: number, el: HTMLElement, at: number) => openWord(vw, k, el, at),
    tapVerse: (v: number, el: HTMLElement, at: number) => selectVerse(vw, v, el, at),
    hoverWord: async (k: number, el: HTMLElement) => {
      if (hoverMode() !== 'on') return;
      const seq = ++hoverSeq, t0 = performance.now(), d = vw.drawn!;
      const { data } = await api.word(d.chapter.code, d.chapter.chapter, d.v[k], d.i[k]);
      if (seq !== hoverSeq) return;
      showCard(lexiconBody(data, true), el.getBoundingClientRect());
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
      bar?.remove(); bar = null; barPick = null; barView = null;
    },
  };
}
const mainView = { root: reader, scroller, main: true, get drawn() { return drawn; } } as View;
const selector = new Selector(reader, scroller, handlersFor(mainView));
mainView.selector = selector;
wireView(mainView);

// A click or tap away from the color bar closes it and clears the selection: anywhere but the bar itself (its presses
// stop at it) and the menus or cards opened from it. In a reader the selector does the same on a tap.
document.addEventListener('pointerdown', e => {
  if (!bar || !barView?.selector.sel) return;
  const t = e.target as HTMLElement;
  if (barView.root.contains(t) || t.closest('.menu, .popover, .sheet, .hovercard')) return;
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
  };
  item('Open in a new tab', 'float', () => openSecondReader(at.anchor, d.chapter.version || 'KJV'));
  if (!vw.main) item('Go to in the reader', 'book', () => void jump(d.chapter.code, d.chapter.chapter, v));
  if (!d.chapter.version) item('Select the verse', 'pen', () => { const vn = vw.root.querySelector<HTMLElement>(`.vn[data-v="${v}"]`); if (vn) selectVerse(vw, v, vn, performance.now()); });
  item('Notes & lookup', 'notebook', () => openPlace(at.anchor, at.label));
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
async function openSecondReader(ref: string, version = 'KJV') {
  const clean = ref.replace(/(:\d+)\.\d+/g, '$1');   // words of a verse: their verse
  const ver = version === 'YLT' ? 'YLT' : 'KJV';
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
    const v2 = vw!;
    v2.drawn = draw(v2.root, data.chapter, data.marks, 999, new Set((data.questions || []).map(q => q.v)));
    while (v2.drawn.more()) { /* the whole chapter at once: a pane holds one */ }
    v2.selector.attach(v2.drawn);
    drawnAt = `${st.code}.${st.chapter}`;
    // At the reader in the Notebook has a row for each second reader, following it as it turns (W4, sheet W1.2)
    readers2.set(p.id, { pane: p.id, code: st.code, chapter: st.chapter, label: `${data.chapter.name} ${st.chapter}` });
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
  const pane2 = dock.open('reader2', `${bk.name} ${st.chapter}`, `reader2|${clean}|${ver}`, 'left', async (el, p) => {
    if (!vw) {
      el.replaceChildren();
      head = h('header', 'pane-head reader2-head');
      const prev = h('button', 'icon-btn reader2-prev'), next = h('button', 'icon-btn reader2-next'), go = h('button', 'icon-btn reader2-go');
      prev.append(icon('left', 14)); next.append(icon('right', 14)); go.append(icon('sendto', 14));
      prev.title = 'The chapter before (this pane only)'; next.title = 'The next chapter (this pane only)';
      prev.onclick = () => turn(el, p, -1);
      next.onclick = () => turn(el, p, 1);
      go.title = 'Send to the reader'; go.setAttribute('aria-label', 'Send to the reader');
      go.onclick = () => {
        const top = [...vw!.root.querySelectorAll<HTMLElement>('.vn')].find(e => e.getBoundingClientRect().top >= el.getBoundingClientRect().top + head!.offsetHeight);
        void jump(st.code, st.chapter, top ? +top.dataset.v! : 1);
      };
      const row = h('div', 'reader2-row');
      row.append(prev, h('h2', 'pane-title reader2-title', `${bk.name} ${st.chapter}`), next, h('span', 'grow'), go);
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
    readers2Watched.add(pane2.id);
    const was = pane2.onClose;
    pane2.onClose = () => { was?.(); readers2.delete(pane2.id); readers2Watched.delete(pane2.id); readerMoved(); };
  }
}

/** A second reader's own chapter turn, by its scroll element: ← → in a pane turn that pane (note b59b). */
const turners = new WeakMap<HTMLElement, (n: number) => void>();

/** The second readers open, by pane: the chapter each shows (app.readers). */
const readers2 = new Map<string, { pane: string; code: string; chapter: number; label: string }>();
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
function picker(from: HTMLElement) {
  const box = h('div', 'picker');
  const draw = (bk?: Book) => {
    box.replaceChildren();
    if (!bk) {
      for (const [t, name] of [['OT', 'Old Testament'], ['NT', 'New Testament']]) {
        box.append(h('div', 'label', name));
        const grid = h('div', 'book-grid');
        for (const b of books.filter(x => (x.testament || (x.id <= 39 ? 'OT' : 'NT')) === t)) {
          const btn = h('button', `book-btn${drawn?.chapter.code === b.code ? ' on' : ''}`, b.name);
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
      const btn = h('button', `ch-btn${drawn?.chapter.code === bk.code && drawn.chapter.chapter === c ? ' on' : ''}`, String(c));
      btn.onclick = () => go(bk, c);
      grid.append(btn);
    }
    box.append(grid);
  };
  const go = (b: Book, c: number) => { close(); jump(b.code, c); };
  draw(drawn ? books.find(b => b.code === drawn!.chapter.code) : undefined);
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

// ---- the Highlights menu: layers -------------------------------------------------------------------------------------
async function highlightsMenu(from: HTMLElement) {
  const box = h('div', 'menu-list layers-menu');
  const toggle = (label: string, on: boolean, flip: () => void, dot?: HTMLElement) => {
    const b = h('button', `menu-item check${on ? ' on' : ''}`);
    b.append(icon(on ? 'eye' : 'eyeoff', 14));
    if (dot) b.append(dot);
    b.append(document.createTextNode(` ${label}`));
    b.onclick = () => { flip(); layers.save(); refreshMarks(); close(); highlightsMenu(from); };
    box.append(b);
  };
  box.append(h('div', 'label', 'Drawn in the reader'));
  toggle('All highlights and threads', layers.all, () => { layers.all = !layers.all; });
  toggle('Your highlights', layers.mine, () => { layers.mine = !layers.mine; });
  let ts: any[] = [];
  try { ts = await wb(['thread', 'list']); } catch { /* outside the app */ }
  if (ts.length) box.append(h('div', 'label', 'Threads'));
  for (const t of ts) toggle(t.name, !layers.hidden.has(t.id), () => { if (layers.hidden.has(t.id)) layers.hidden.delete(t.id); else layers.hidden.add(t.id); }, h('i', `dot c-${t.color}`));
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
  if (!inApp) return;
  const place = `${d.chapter.name} ${d.chapter.chapter}`;
  const end = h('div', 'chapter-end');
  const said = h('span', 'chapter-read');
  const btn = h('button', 'btn soft', `Mark ${place} read`);
  const unread = h('button', 'link-btn chapter-unread', 'Mark unread');
  unread.title = 'Take the latest mark off the reading log';
  const show = (r: { times: number; last: string } | undefined) => {
    const when = r ? new Date(r.last).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    said.textContent = r ? `${place}: read ${r.times === 1 ? 'once' : `${r.times} times`} · last ${when}` : '';
    btn.textContent = r ? 'Read again' : `Mark ${place} read`;
    unread.hidden = !r;
  };
  const times = async () => show(Object.values((await wb(['read', 'times', place])) ?? {})[0] as any);
  btn.onclick = async () => {
    try {
      await api.readMark(place);
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
  const b = h('div', 'settings');
  b.append(h('h2', 'sheet-title', 'More'));
  const reading = h('div');
  b.append(reading);
  todaySection(reading);
  const quick = h('div', 'wrap');
  const item = (label: string, fn: () => void) => { const x = h('button', 'btn', label); x.onclick = () => { closeSheet(); closeMenu(); fn(); }; quick.append(x); };
  item('Find in chapter', () => findInChapter(finding));
  item('Help', () => openHelp());
  item('Keys', () => openKeys());
  item('Reading plans', () => openPlans());
  item('Today’s log', () => openToday(''));
  item('Shelf', () => openShelf());
  item('Findings', () => openFindings());
  item('Documents', () => openDocuments());
  b.append(quick);
  b.append(h('div', 'label', 'Text size'));
  const sz = h('div', 'size-row');
  const pct = h('span', 'size-pct', `${sizePct}%`);
  const step = (n: number) => { setSize(sizePct + n); pct.textContent = `${sizePct}%`; };
  const minus = h('button', 'btn', 'A−'), plus = h('button', 'btn', 'A+'), reset = h('button', 'btn', '100%');
  minus.onclick = () => step(-10); plus.onclick = () => step(10); reset.onclick = () => step(100 - sizePct);
  sz.append(minus, pct, plus, reset);
  b.append(sz);
  b.append(h('div', 'label', 'Version'));
  b.append(segmented(VERSIONS, version, v => { closeSheet(); closeMenu(); setVersion(v).then(toast); }));
  b.append(h('div', 'label', 'Hover cards'));
  b.append(segmented(['off', 'refs', 'on'], hoverMode(), setHover));
  b.append(h('div', 'label', 'Theme'));
  b.append(segmented(['system', 'light', 'dark', 'eink'], document.documentElement.dataset.theme || 'system', t => {
    if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { localStorage.setItem('wb.theme', t); } catch { /* this run only */ }
  }));
  if (inApp) {
    b.append(h('div', 'label', 'Window size'));
    const row = h('div', 'wrap');
    for (const [id, name] of PRESETS) {
      const x = h('button', 'btn', name);
      x.onclick = async () => { closeSheet(); closeMenu(); const r = await api.setWindow(id); toast(`${r.got[0]}×${r.got[1]}`); };
      row.append(x);
    }
    b.append(row);
  }
  b.append(h('div', 'label', 'Input'));
  b.append(segmented(['auto', 'touch', 'pointer'], selector.mode, m => { selector.mode = m as InputMode; document.documentElement.dataset.input = m; }));
  b.append(h('div', 'label', 'Later phases'));
  b.append(h('p', 'muted small', 'Documents: the Speaker Script and Verse by Verse from a thread are made here (Documents); PowerPoint, lessons and the other structures in phase 5. Read aloud and recordings: phase 6. The Python app still does them.'));
  b.append(h('div', 'label', 'Go to'));
  const go = h('form', 'go') as HTMLFormElement;
  const input = h('input') as HTMLInputElement;
  input.placeholder = 'Psalm 119';
  go.append(input, h('button', 'btn', 'Open'));
  go.onsubmit = async e => {
    e.preventDefault();
    closeSheet(); closeMenu();
    const r = await runLine(`go ${input.value}`).catch(x => ({ ok: false, error: String(x) }));
    if (!r.ok) toast(r.error || 'Not a place');
  };
  b.append(go);
  b.append(h('div', 'label', 'Measured this run'));
  b.append(h('pre', 'perf', perf.summary()));
  if (compact() || !inApp) openSheet(b, from);
  else popMenu(from, b, { align: 'right', width: 420 });
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
$('pen').title = 'Write a note (on the place you picked, or the verse at the top)';
$('tb-notebook').onclick = () => openNotebook();
$('tb-threads').onclick = () => openThreads();
$('tb-version').onclick = async () => toast(await setVersion(version === 'KJV' ? 'YLT' : 'KJV'));
$('tb-shelf').onclick = () => openShelf();
$('hl-menu').onclick = () => highlightsMenu($('hl-menu'));
$('tab-notebook').onclick = () => openNotebook();
$('tab-threads').onclick = () => openThreads();
$('tab-study').onclick = () => openHelp();
for (const [id, ico] of [['tb-notebook', 'notebook'], ['tb-threads', 'threads'], ['tb-shelf', 'shelf'], ['hl-menu', 'pen']] as const) $(id).prepend(icon(ico));
$('hl-menu').append(icon('down', 14));
$('cmdbox').prepend(icon('search'));
notebookBadge.set = n => {
  const badge = $('tb-notebook').querySelector<HTMLElement>('.badge')!;
  badge.hidden = !n;
  badge.textContent = String(n);
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

document.addEventListener('keydown', e => {
  const typing = !!(e.target as HTMLElement).closest('input, textarea, [contenteditable]');
  if (e.key === 'Escape') { closeSheet(); clearSelection(); hideCard(); }
  // Ctrl+F finds in the pane last clicked or typed in, else in the chapter (note 5c4a)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); const p = paneForFind(); if (p) findInPane(p); else findInChapter(finding); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setSize(sizePct + 10); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setSize(sizePct - 10); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setSize(100); return; }
  // a finding about the app, from anywhere (note 50c1)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') { e.preventDefault(); findingBox(); return; }
  // quick capture (Ctrl+J unless set otherwise in the Notebook's settings): a small box at the verse, from anywhere
  if (isCaptureKey(e)) { e.preventDefault(); quickCapture(); return; }
  if (typing) return;
  // a selection with its bar: 1–5 color it, 0 removes the highlight
  if (bar && barView?.selector.sel && barPick && /^[0-5]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    barPick(e.key === '0' ? null : COLORS[+e.key - 1]);
    return;
  }
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
  topVerse: () => topVerse().verse,
  setSize,
  size: () => sizePct,
  version: () => version,
  setVersion,
  findInChapter,
  secondReader: (ref: string, version?: string) => void openSecondReader(ref, version),
  readers: () => [...readers2.values()].filter(r => dock.panes.some(p => p.id === r.pane)),
  changed: (...what: Change[]) => { written(...what); if (!what.length || what.includes('threads')) loadThreads(); },
});

// ---- start ------------------------------------------------------------------------------------------------------------
async function start() {
  document.documentElement.dataset.size = sizeClass();
  try {
    const t = localStorage.getItem('wb.theme');
    if (t && t !== 'system') document.documentElement.dataset.theme = t;
    document.documentElement.dataset.hover = localStorage.getItem('wb.hover') || 'off';
    setSize(+(localStorage.getItem(SIZE_STORE) || 100));
  } catch { /* defaults */ }
  initPanes($('dock'));
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
  onDo(runLine);
  if (inApp) {
    void readSettings();
    loadPalette();
    if (sizeClass() !== 'compact' && new URLSearchParams(location.search).get('notebook') !== '0') openNotebook();
  }
}

(window as any).__wb = { open, perf, selector, dock: () => dock, run: (l: string) => runLine(l), parse, changed: () => app.changed(), repaint: () => drawn && paint(reader, drawn), get drawn() { return drawn; } };
start().catch(e => { reader.innerHTML = `<p class="error">${String(e)}</p>`; });
void here;
