// Bible Workbench, phase 0 reader spike: Numbers 25 (or any chapter) with the marks from a scratch study folder, tap
// cards, touch selection, hover cards and the color bar. See docs/phase0-results.md.
import '@fontsource/literata/400.css';
import '@fontsource/literata/400-italic.css';
import '@fontsource/literata/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/noto-sans-hebrew/400.css';
import { api, inApp, type WordView, type VerseView, type Book, type Mark } from './api';
import { draw, paint, textOf, labelOf, type Drawn } from './reader';
import { Selector, type InputMode } from './select';
import { openSheet, closeSheet, showCard, hideCard, toast, compact } from './sheets';
import { perf, afterPaint, record } from './perf';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reader = $('reader'), scroller = $('scroller');
const COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'];
const STORE = 'wb.place.v1';

let drawn: Drawn | null = null;
let books: Book[] = [];
let place = { code: 'NUM', chapter: 25, scroll: 0 };

// ---- the place: never lose it ---------------------------------------------------------------------------------------
function loadPlace() {
  const q = new URLSearchParams(location.search).get('at');   // ?at=PSA.119 (tests, measuring)
  if (q) { const [code, ch] = q.split('.'); return { code, chapter: +ch, scroll: 0 }; }
  try { return { ...place, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return place; }
}
function savePlace() {
  place.scroll = scroller.scrollTop;
  try { localStorage.setItem(STORE, JSON.stringify(place)); } catch { /* private window: the place is kept for this run only */ }
}
let saveTimer = 0;
scroller.addEventListener('scroll', () => {
  clearTimeout(saveTimer); saveTimer = window.setTimeout(savePlace, 250);
  if (selector.sel) selector.placeHandles();
  hideCard();
}, { passive: true });

// ---- drawing ----------------------------------------------------------------------------------------------------------
async function open(code: string, chapter: number, scroll = 0) {
  const t0 = performance.now();
  const { data, rust_ms } = await api.reader(code, chapter);
  const t1 = performance.now();
  closeSheet(); hideCard(); bar?.remove(); bar = null;
  drawn = draw(reader, data.chapter, data.marks);
  selector.attach(drawn);
  place = { code, chapter, scroll };
  scroller.scrollTop = scroll;
  $('place').textContent = `${data.chapter.name} ${chapter}`;
  await afterPaint();
  record('chapter', performance.now() - t0, { rust_ms, ipc_ms: t1 - t0 - rust_ms, words: drawn.el.length, at: `${code} ${chapter}` });
  savePlace();
}

function step(n: number) {
  if (!drawn) return;
  const c = drawn.chapter;
  let i = books.findIndex(b => b.code === c.code), ch = c.chapter + n;
  if (ch < 1) { if (i <= 0) return; i--; ch = books[i].chapters; }
  else if (ch > c.chapters) { if (i < 0 || i >= books.length - 1) return; i++; ch = 1; }
  open(books[i]?.code ?? c.code, ch);
}

// ---- sheets and cards -----------------------------------------------------------------------------------------------
const h = (tag: string, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

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
    acts.append(h('button', 'btn primary', 'Every use'), h('button', 'btn', 'Interlinear'));
    acts.querySelectorAll('button').forEach(x => x.addEventListener('click', () => toast('Phase 2: not in the spike')));
    b.append(acts);
    for (const n of w.notes) b.append(noteCard(n.anchor === w.anchor ? w.reference : `${lx.strong} everywhere`, n.text));
    const note = h('button', 'btn soft wide', `Note on ${lx.strong} everywhere`);
    note.onclick = () => toast('Phase 1: writing notes');
    b.append(note);
  }
  return b;
}

function noteCard(placeLabel: string, text: string) {
  const c = h('div', 'note-card');
  c.append(h('span', 'pill', placeLabel), h('p', '', text));
  return c;
}

function verseBody(v: VerseView, card = false): HTMLElement {
  const b = h('div', 'verse-view');
  if (card) b.append(h('div', 'card-head', `${v.reference} · KJV`));
  else b.append(h('h2', 'sheet-title', v.reference), h('div', 'sheet-sub', 'KJV'));
  b.append(h('p', 'scripture', v.text));
  if (card) return b;
  b.append(colorRow(v.color, c => {
    const [, cv] = v.anchor.split('.');
    const [ch, vs] = cv.split(':').map(Number);
    addHighlight({ kind: 'verse', code: drawn!.chapter.code, c1: ch, v1: vs, i1: null, c2: null, v2: null, i2: null, id: `session_${Date.now()}`, color: c });
    closeSheet();
  }));
  for (const n of v.notes) b.append(noteCard(v.reference, n.text));
  if (v.threads.length) {
    const t = h('div', 'in-threads');
    t.append(h('span', 'muted', 'In'));
    for (const th of v.threads) {
      const chip = h('span', 'chip thread');
      chip.append(h('i', `dot c-${th.color}`), document.createTextNode(th.name));
      t.append(chip);
    }
    b.append(t);
  }
  b.append(actions(['Note', 'Question', 'Thread', 'Copy'], a => {
    if (a === 'Copy') copy(`${v.text} (${v.reference} KJV)`);
    else toast('Phase 1: writing study files');
  }));
  return b;
}

function colorRow(current: string | undefined, pick: (c: string) => void) {
  const row = h('div', 'colors');
  for (const c of COLORS) {
    const dot = h('button', `swatch c-${c}${c === current ? ' on' : ''}`);
    dot.setAttribute('aria-label', c);
    dot.onclick = () => pick(c);
    row.append(dot);
  }
  const plus = h('button', 'swatch plus', '+');
  plus.setAttribute('aria-label', 'Custom color');
  plus.onclick = () => toast('Phase 2: custom colors');
  row.append(plus);
  return row;
}

function actions(names: string[], run: (a: string) => void) {
  const row = h('div', 'acts');
  for (const n of names) { const b = h('button', 'act', n); b.onclick = () => run(n); row.append(b); }
  return row;
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast('Copied with its reference'); } catch { toast('Copy is not allowed here'); }
}

function addHighlight(m: Mark) {
  // Session only in the spike: the study files are not written until phase 1 brings the no-overlap rule.
  drawn!.marks.highlights.push(m);
  paint(reader, drawn!);
  toast('Highlighted (this session only)');
}

// ---- selection bar (touch) and color bar (mouse) --------------------------------------------------------------------
let bar: HTMLElement | null = null;

function showBar(a: number, b: number, touch: boolean) {
  bar?.remove();
  bar = h('div', touch ? 'selbar' : 'colorbar');
  bar.append(colorRow(undefined, c => {
    const d = drawn!;
    addHighlight({ kind: a === b ? 'word' : 'phrase', code: d.chapter.code, c1: d.chapter.chapter, v1: d.v[a], i1: d.i[a], c2: a === b ? null : d.chapter.chapter, v2: a === b ? null : d.v[b], i2: a === b ? null : d.i[b], id: `session_${Date.now()}`, color: c });
    selector.clear();
  }));
  bar.append(actions(touch ? ['Note', 'Thread', 'Look up', 'Copy'] : ['Note', 'Copy'], act => {
    const d = drawn!;
    if (act === 'Copy') copy(`${textOf(d, a, b)} (${labelOf(d, a, b)} KJV)`);
    else if (act === 'Look up') {
      const k = [...Array(b - a + 1).keys()].map(n => a + n).find(k => d.strong[k]);
      if (k !== undefined) openWord(k, d.el[k], performance.now());
    } else toast('Phase 1: writing study files');
  }));
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  document.getElementById('overlay')!.append(bar);
  placeBar();
}

function placeBar() {
  if (!bar || !selector.sel || !drawn) return;
  const first = drawn.el[selector.sel.a].getClientRects()[0], lastRects = drawn.el[selector.sel.b].getClientRects();
  const last = lastRects[lastRects.length - 1];
  const w = bar.offsetWidth, hgt = bar.offsetHeight;
  const top = first.top - hgt - 14 > 60 ? first.top - hgt - 14 : Math.min(last.bottom + 18, window.innerHeight - hgt - 8);
  bar.style.top = `${top}px`;
  bar.style.left = `${Math.max(8, Math.min((first.left + last.right) / 2 - w / 2, window.innerWidth - w - 8))}px`;
}

// ---- taps -----------------------------------------------------------------------------------------------------------
async function openWord(k: number, el: HTMLElement, at: number) {
  const d = drawn!;
  const { data } = await api.word(d.chapter.code, d.chapter.chapter, d.v[k], d.i[k]);
  el.classList.add('tapped');
  openSheet(lexiconBody(data), el, { closed: () => el.classList.remove('tapped') });
  await afterPaint();
  record('word-sheet', performance.now() - at, { word: data.text });
}

async function openVerse(v: number, el: HTMLElement, at: number) {
  const d = drawn!;
  const { data } = await api.verse(d.chapter.code, d.chapter.chapter, v);
  openSheet(verseBody(data), el);
  await afterPaint();
  record('verse-sheet', performance.now() - at, { verse: v });
}

let hoverSeq = 0;
const selector = new Selector(reader, scroller, {
  tapWord: (k, el, at) => openWord(k, el, at),
  tapVerse: (v, el, at) => openVerse(v, el, at),
  hoverWord: async (k, el) => {
    const seq = ++hoverSeq, t0 = performance.now(), d = drawn!;
    const { data } = await api.word(d.chapter.code, d.chapter.chapter, d.v[k], d.i[k]);
    if (seq !== hoverSeq) return;
    showCard(lexiconBody(data, true), el.getBoundingClientRect());
    await afterPaint();
    record('hover-card', performance.now() - t0, { word: data.text });
  },
  hoverVerse: async (v, el) => {
    const seq = ++hoverSeq, d = drawn!;
    const { data } = await api.verse(d.chapter.code, d.chapter.chapter, v);
    if (seq === hoverSeq) showCard(verseBody(data, true), el.getBoundingClientRect());
  },
  unhover: () => { hoverSeq++; hideCard(); },
  selected: (a, b, touch) => showBar(a, b, touch),
  cleared: () => { bar?.remove(); bar = null; },
});
document.getElementById('overlay')!.addEventListener('pointerleave', e => { if ((e.target as HTMLElement).classList?.contains('hovercard')) hideCard(); }, true);

// ---- the spike's settings (More) ------------------------------------------------------------------------------------
const PRESETS = [['phone', 'Phone 390×844'], ['phone-landscape', 'Phone landscape'], ['ipad', 'iPad portrait 820×1180'], ['ipad-landscape', 'iPad landscape'], ['laptop', 'Laptop 1280×800'], ['laptop-large', 'Laptop 1440×900'], ['desktop', 'Desktop 1920×1080']];

function settings() {
  const b = h('div', 'settings');
  b.append(h('h2', 'sheet-title', 'Spike settings'));
  if (inApp) {
    b.append(h('div', 'label', 'Window size'));
    const row = h('div', 'wrap');
    for (const [id, name] of PRESETS) {
      const x = h('button', 'btn', name);
      x.onclick = async () => { closeSheet(); const r = await api.setWindow(id); toast(`${r.got[0]}×${r.got[1]}`); };
      row.append(x);
    }
    b.append(row);
  }
  b.append(h('div', 'label', 'Input'));
  b.append(segmented(['auto', 'touch', 'pointer'], selector.mode, m => { selector.mode = m as InputMode; document.documentElement.dataset.input = m; }));
  b.append(h('div', 'label', 'Theme'));
  b.append(segmented(['system', 'light', 'dark', 'eink'], document.documentElement.dataset.theme || 'system', t => {
    if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  }));
  b.append(h('div', 'label', 'Go to'));
  const go = h('form', 'go') as HTMLFormElement;
  const input = h('input') as HTMLInputElement;
  input.placeholder = 'Psalm 119';
  go.append(input, h('button', 'btn', 'Open'));
  go.onsubmit = e => {
    e.preventDefault();
    const m = /^(.*?)\s*(\d+)$/.exec(input.value.trim());
    const key = (m?.[1] || '').toLowerCase().replace(/\s/g, '');
    const bk = books.find(x => x.code.toLowerCase() === key || x.name.toLowerCase().replace(/\s/g, '').startsWith(key));
    if (bk && m) { closeSheet(); open(bk.code, Math.min(+m[2], bk.chapters)); } else toast('Not a place');
  };
  b.append(go);
  b.append(h('div', 'label', 'Measured this run'));
  const pre = h('pre', 'perf', perf.summary());
  b.append(pre);
  openSheet(b, $('more'));
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

$('more').onclick = settings;
$('tab-more').onclick = settings;
$('prev').onclick = () => step(-1);
$('next').onclick = () => step(1);
$('place').onclick = settings;
$('pen').onclick = () => toast('Phase 3: the palette');
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeSheet(); selector.clear(); hideCard(); }
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
});
window.addEventListener('resize', () => { document.documentElement.dataset.size = sizeClass(); selector.placeHandles(); placeBar(); });

function sizeClass() {
  const w = window.innerWidth;
  return w < 600 ? 'compact' : w < 1024 ? 'medium' : w < 1440 ? 'expanded' : 'large';
}

// ---- start ------------------------------------------------------------------------------------------------------------
async function start() {
  document.documentElement.dataset.size = sizeClass();
  const p = loadPlace();
  const bookList = api.books().then(r => { books = r.data; });
  await open(p.code, p.chapter, p.scroll);
  await document.fonts.ready;
  await bookList;
  const report = { nav_to_ready_ms: performance.now(), size: [window.innerWidth, window.innerHeight], dpr: devicePixelRatio, compact: compact(), perf: perf.entries };
  (window as any).__wbReady = report;
  api.uiReady(report).catch(() => {});
}

(window as any).__wb = { open, perf, selector, repaint: () => drawn && paint(reader, drawn), get drawn() { return drawn; } };
start().catch(e => { reader.innerHTML = `<p class="error">${String(e)}</p>`; });
