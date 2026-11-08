// The panes beside the reader. Each draws what a `wb` command returns (the same answers as in a terminal), and nothing
// here interprets the text: scripture is shown verbatim from the database, with its reference.
import { wb } from './api';
import { app, book, goTo, here, type At } from './app';
import { Dock, type Pane, type Side } from './dock';
import { layers } from './layers';
import { closeSheet, compact, hideCard, openSheet, sheetOpen, showCard, toast } from './sheets';
import { button, h, hoverMode, icon, linkedText, placeGo, placePill, popMenu, refChoice } from './ui';
import { placeMenu, remove as removeNote, takeOff } from './notebook';
import { threadDocuments } from './documents';

export let dock: Dock;

// A pane drawn again while an earlier draw still waits on wb: only the newest draw fills it (two at once each added their
// own content, so a writing box showed twice). `newest(el)` → whether this draw is still the newest.
const draws = new WeakMap<HTMLElement, number>();
function newest(el: HTMLElement): () => boolean {
  const n = (draws.get(el) ?? 0) + 1;
  draws.set(el, n);
  return () => draws.get(el) === n;
}
export function initPanes(host: HTMLElement) {
  dock = new Dock(host);
  dock.backLabel = () => here().label;
}

const STUDY: Side = 'left';
const MINE: Side = 'right';
const q = (s: string) => `“${s}”`;
const bookName = (id: number | string) => app.books.find(b => String(b.id) === String(id))?.name ?? String(id);

function head(el: HTMLElement, title: string, sub?: string) {
  const hd = h('header', 'pane-head');
  hd.append(h('h2', 'pane-title', title));
  if (sub !== undefined) hd.append(h('div', 'pane-sub', sub));
  el.append(hd);
  return hd;
}

function scopeLabel(scope: string) {
  if (!scope || scope === 'all') return 'the whole Bible';
  if (scope === 'OT' || scope === 'NT') return scope === 'OT' ? 'the Old Testament' : 'the New Testament';
  const ids = scope.split(',');
  return ids.length === 1 ? bookName(ids[0]) : `${bookName(ids[0])}–${bookName(ids[ids.length - 1])}`;
}

function refLink(r: { code: string; name: string; c: number; v: number }) {
  const a = h('button', 'ref-link', `${r.name} ${r.c}:${r.v}`);
  a.onclick = e => refChoice(a, `${r.code} ${r.c}:${r.v}`, e);
  return a;
}

// Long lists: the first screenful at once, the rest a part at a time between frames (as the reader draws a chapter), so
// results are on screen without waiting for every row.
let fillSeq = 0;
function fill(body: HTMLElement, rows: any[], row: (r: any) => HTMLElement, first = 30, step = 60) {
  const seq = ++fillSeq;
  (body as any).fillSeq = seq;
  body.replaceChildren(...rows.slice(0, first).map(row));
  let at = first;
  const more = () => {
    if ((body as any).fillSeq !== seq || at >= rows.length) return;
    body.append(...rows.slice(at, at + step).map(row));
    at += step;
    setTimeout(more, 0);
  };
  setTimeout(more, 0);
}

// ---- lists of verses that can be ticked and put into a thread (search, every use, near) ------------------------------

export interface ResultList { pane: Pane; anchors: () => string[]; ticked: Set<string>; redraw: () => void; words?: () => string[]; shape: 'words' | 'verses' }
export let frontResults: ResultList | null = null;

function tickable(list: ResultList, row: HTMLElement, anchor: string) {
  const t = h('input', 'tick') as HTMLInputElement;
  t.type = 'checkbox';
  t.checked = list.ticked.has(anchor);
  t.setAttribute('aria-label', 'Tick to add to a thread');
  t.onchange = () => { if (t.checked) list.ticked.add(anchor); else list.ticked.delete(anchor); frontResults = list; };
  row.prepend(t);
}

function resultsBar(el: HTMLElement, list: ResultList) {
  const bar = h('div', 'results-bar');
  const all = button('btn small', 'Tick all', () => { list.anchors().forEach(a => list.ticked.add(a)); list.redraw(); frontResults = list; });
  const none = button('btn small', 'None', () => { list.ticked.clear(); list.redraw(); });
  const add = button('btn small primary', 'Add to a thread…', e => threadChooser(e.currentTarget as HTMLElement, async name => {
    const places = list.ticked.size ? [...list.ticked] : list.anchors();
    if (!places.length) return toast('Nothing to add');
    const r = await wb(['thread', 'add-many', name, ...expand(list, places)]);
    toast(`${r.added?.length ?? places.length} added to ${name}`);
    app.changed('threads');
  }));
  bar.append(all, none, add);
  el.append(bar);
}

// Ticked verses as whole verses, or (for every use, shaped as words) the marked words in them.
function expand(list: ResultList, places: string[]) {
  if (list.shape === 'verses' || !list.words) return places;
  const words = list.words();
  return places.flatMap(p => words.filter(w => w.startsWith(p + '.') || w === p).length ? words.filter(w => w.startsWith(p + '.')) : [p]);
}

export function threadChooser(from: HTMLElement, pick: (name: string) => void) {
  const box = h('div', 'chooser');
  const input = h('input', 'field') as HTMLInputElement;
  input.placeholder = 'A thread, or a new name';
  box.append(input);
  const list = h('div', 'chooser-list');
  box.append(list);
  const close = popMenu(from, box, { width: 280 });
  const choose = (n: string) => { close(); pick(n); };
  input.onkeydown = e => { if (e.key === 'Enter' && input.value.trim()) choose(input.value.trim()); };
  wb(['thread', 'list']).then((ts: any[]) => {
    const draw = () => {
      const f = input.value.trim().toLowerCase();
      list.replaceChildren(...ts.filter(t => t.name.toLowerCase().includes(f)).slice(0, 12).map(t => {
        const b = h('button', 'chooser-row');
        b.append(h('i', `dot c-${t.color}`), document.createTextNode(` ${t.name}`), h('span', 'muted small', ` ${t.count}`));
        b.onclick = () => choose(t.name);
        return b;
      }));
    };
    input.oninput = draw;
    draw();
  }).catch(() => {});
  input.focus();
}

// ---- references written in notes: a click opens the verse as a card; hover cards only when turned on ------------------
function refBody(d: any): HTMLElement {
  const body = h('div', 'verse-view');
  body.append(h('div', 'card-head', `${d.label} · ${d.version}`));
  for (const v of d.verses || []) {
    const p = h('p', 'scripture');
    if ((d.verses || []).length > 1) p.append(h('span', 'vref', `${v.ref.split(':').pop()} `));
    p.append(v.text);
    body.append(p);
  }
  if (d.more) body.append(h('p', 'muted small', `and ${d.more} more verses`));
  return body;
}

// The verse, verbatim, beside the reference, with Go to and Open as a tab. Ctrl+click goes straight there.
export async function refCard(ref: string, a: HTMLElement, e?: MouseEvent) {
  if (e?.ctrlKey || e?.metaKey) return goTo(ref);
  hideCard();
  const d = await wb(['preview', ref, '--json']).catch(() => null);
  if (!d) return goTo(ref);
  const body = refBody(d);
  const acts = h('div', 'acts');
  acts.append(button('act', `Go to ${d.label}`, () => { closeSheet(); goTo(ref); }));
  if (!compact()) acts.append(button('act', 'Open as a tab', () => { closeSheet(); app.secondReader(ref); }));
  body.append(acts);
  openSheet(body, a);
}

export function refHover(a: HTMLElement, ref: string) {
  let timer = 0, seq = 0;
  a.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse' || hoverMode() === 'off' || sheetOpen()) return;
    const my = ++seq;
    timer = window.setTimeout(async () => {
      const d = await wb(['preview', ref, '--json']).catch(() => null);
      if (!d || my !== seq || !a.isConnected || !a.matches(':hover') || sheetOpen()) return;
      showCard(refBody(d), a.getBoundingClientRect());
    }, 280);
  });
  a.addEventListener('pointerleave', () => { seq++; clearTimeout(timer); setTimeout(() => { if (!document.querySelector('.hovercard:hover')) hideCard(); }, 150); });
}

// ---- search ------------------------------------------------------------------------------------------------------------

export function openSearch(query: string, scope = 'all') {
  return dock.open('search', `Search: ${query}`, `search|${query}|${scope}`, STUDY, async (el, pane) => {
    el.replaceChildren();
    const list: ResultList = { pane, ticked: new Set(), anchors: () => rows.map(r => `${r.ref.code}.${r.ref.c}:${r.ref.v}`), redraw: () => draw(), shape: 'verses' };
    let rows: any[] = [], d: any;
    const hd = head(el, q(query), '');
    resultsBar(el, list);
    const body = h('div', 'rows');
    const more = button('btn wide', 'More', async () => { await page(rows.length); });
    el.append(body, more);
    const page = async (offset: number) => {
      d = await wb(['search', query, '--scope', scope, '--offset', String(offset)]);
      rows = offset ? rows.concat(d.rows) : d.rows;
      (hd.querySelector('.pane-sub') as HTMLElement).textContent = `${d.verses} verse${d.verses === 1 ? '' : 's'} in ${scopeLabel(scope)}`;
      more.hidden = !d.more;
      draw();
    };
    const draw = () => {
      fill(body, rows, r => {
        const row = h('div', 'row');
        const t = h('p', 'scripture-row');
        let at = 0;
        const chars = [...r.text];
        for (const [a, b] of r.spans) {
          t.append(chars.slice(at, a).join(''), h('mark', 'found', chars.slice(a, b).join('')));
          at = b;
        }
        t.append(chars.slice(at).join(''));
        const main = h('div', 'row-main');
        main.append(refLink(r.ref), t);
        row.append(main);
        tickable(list, row, `${r.ref.code}.${r.ref.c}:${r.ref.v}`);
        return row;
      });
      if (!rows.length) body.append(h('p', 'muted', 'No verse has all of these words.'));
    };
    frontResults = list;
    await page(0);
  });
}

// ---- every use, first and last --------------------------------------------------------------------------------------

const MARK_NAMES: Record<string, string> = { both: 'both', s: 'only the original', e: 'only the English' };

/** A rendering (`rendering`) narrows a Strong's number to the verses where the KJV translates it with those words;
 * `cat` narrows to one kind of mark (both, s: only the original, e: only the English). */
export interface UsesOpts { rendering?: string; cat?: string }

export async function usesArgs(strong: string, word: string, scope: string, offset = 0, o: UsesOpts = {}) {
  const argv = ['uses', strong || word];
  if (strong && o.rendering) argv.push('--rendering', o.rendering);
  else if (strong && word) argv.push('--word', word);
  if (o.cat && o.cat !== 'all') argv.push('--cat', o.cat);
  argv.push('--scope', scope || 'all', '--offset', String(offset));
  return wb(argv);
}

export function openUses(strong: string, word: string, scope = 'all', o: UsesOpts = {}) {
  const label = o.rendering ? `${strong} rendered “${o.rendering}”` : [strong, word].filter(Boolean).join(' ');
  return dock.open('uses', `Every use: ${label}`, `uses|${strong}|${word}|${scope}|${o.rendering ?? ''}`, STUDY, async (el, pane) => {
    el.replaceChildren();
    let rows: any[] = [];
    let cat = o.cat || 'all';
    const list: ResultList = {
      pane, ticked: new Set(), shape: 'words', redraw: () => draw(),
      anchors: () => rows.map(r => `${r.ref.code}.${r.ref.c}:${r.ref.v}`),
      words: () => rows.flatMap(r => r.runs.map((x: any) => x.anchor)),
    };
    const hd = head(el, label, '');
    const chips = h('div', 'chips');
    el.append(chips);
    resultsBar(el, list);
    const body = h('div', 'rows');
    const more = button('btn wide', 'More', () => page(rows.length));
    el.append(body, more);
    const page = async (offset: number) => {
      const d = await usesArgs(strong, word, scope, offset, { ...o, cat });
      rows = offset ? rows.concat(d.rows) : d.rows;
      (hd.querySelector('.pane-sub') as HTMLElement).textContent = `${d.occurrences} time${d.occurrences === 1 ? '' : 's'} in ${d.verses} verse${d.verses === 1 ? '' : 's'}, ${scopeLabel(scope)}`;
      // each kind of mark is a filter: a click shows only those verses, a second click all of them again
      const kinds = Object.entries(d.totals || {}).filter(([, n]) => (n as number) > 0);
      chips.replaceChildren(...kinds.map(([k, n]) => {
        const c = button(`chip link m-${k}${cat === k ? ' on' : ''}`, `${MARK_NAMES[k] || k}: ${n}`, () => { cat = cat === k ? 'all' : k; page(0); });
        c.title = cat === k ? 'Show every verse again' : `Show only these verses`;
        return c;
      }));
      if (strong && word && !o.rendering) chips.append(h('span', 'muted small', 'both: the verse’s word translates it'));
      more.hidden = !d.more;
      draw();
    };
    const draw = () => {
      fill(body, rows, r => {
        const row = h('div', 'row');
        const t = h('p', 'scripture-row');
        for (const w of r.words) {
          t.append(w.lead || '');
          t.append(w.m ? h('mark', `found m-${w.m}`, w.t) : document.createTextNode(w.t));
          t.append(w.trail || '');
        }
        const main = h('div', 'row-main');
        main.append(refLink(r.ref), t);
        row.append(main);
        tickable(list, row, `${r.ref.code}.${r.ref.c}:${r.ref.v}`);
        return row;
      });
      if (!rows.length) body.append(h('p', 'muted', 'It does not occur here.'));
    };
    frontResults = list;
    await page(0);
  });
}

/** first / last: the reader goes to the first or last occurrence. */
export async function jumpTo(which: 'first' | 'last', strong: string, word: string, scope: string): Promise<string> {
  const d0 = await usesArgs(strong, word, scope, 0);
  if (!d0.verses) return 'It does not occur there.';
  const d = which === 'first' ? d0 : await usesArgs(strong, word, scope, d0.verses - 1);
  const r = which === 'first' ? d.rows[0] : d.rows[d.rows.length - 1];
  await app.go(r.ref.code, r.ref.c, r.ref.v);
  return `${which === 'first' ? 'First' : 'Last'} of ${d0.verses} verses: ${r.ref.name} ${r.ref.c}:${r.ref.v}`;
}

// ---- word study --------------------------------------------------------------------------------------------------------

function lemma(text: string, lang: string) {
  const l = h('span', 'lemma', text);
  l.lang = lang === 'grk' ? 'grc' : 'he';
  l.dir = lang === 'grk' ? 'ltr' : 'rtl';
  return l;
}

function entryRow(e: any, extra?: string) {
  const b = h('button', 'entry-row');
  const top = h('div', 'entry-top');
  top.append(lemma(e.lemma, e.lang), h('span', 'translit', e.translit || ''), h('span', 'muted small', ` ${e.strong}`));
  if (e.n !== undefined) top.append(h('span', 'chip', `${e.n}×`));
  b.append(top);
  if (e.definition) b.append(h('p', 'small', e.definition));
  if (extra) b.append(h('p', 'muted small', extra));
  b.onclick = () => openStrong(e.strong);
  return b;
}

export function openDefine(word: string) {
  return dock.open('def', `def ${word}`, `def|${word}`, STUDY, async el => {
    el.replaceChildren();
    const d = await wb(['define', word]);
    const all = [...(d.english || []), ...(d.original || [])];
    if (all.length === 1) {
      openStrong(all[0].strong);
    }
    head(el, word, d.english?.length ? `The original words the KJV renders “${word}”, most used first` : 'Original words spelled this way');
    el.append(...all.map((e: any) => entryRow(e, e.usage ? `KJV: ${e.usage}` : undefined)));
    if (!all.length) el.append(h('p', 'muted', `No original word is rendered “${word}” in the KJV. Try forms ${word}.`));
  });
}

export function openStrong(num: string) {
  num = num.toUpperCase();
  return dock.open('strong', num, `strong|${num}`, STUDY, async el => {
    el.replaceChildren();
    const [d, c] = await Promise.all([wb(['strong', num]), wb(['count', num])]);
    const hd = head(el, '');
    const row = h('div', 'lemma-row');
    const tr = h('div');
    tr.append(h('div', 'translit', d.translit || ''), h('div', 'muted small', `${d.strong} · Strong's${d.pron ? ` · ${d.pron}` : ''}`));
    row.append(lemma(d.lemma, d.lang), tr);
    hd.replaceChildren(row);
    if (d.definition) el.append(h('p', 'def', d.definition));
    if (d.derivation) {
      const p = h('p', 'small muted');
      for (const part of d.derivation.split(/(\[\[[HG]\d+\]\])/)) {
        const m = /^\[\[([HG]\d+)\]\]$/.exec(part);
        if (m) p.append(button('ref-link', m[1], () => openStrong(m[1])));
        else p.append(part);
      }
      el.append(p);
    }
    if (d.usage) el.append(h('p', 'usage', `KJV: ${d.usage}`));
    const chips = h('div', 'chips');
    chips.append(h('span', 'chip', `${c.occurrences} times in ${c.verses} verses`), h('span', 'chip', `${Object.keys(c.by_book).length} books`));
    el.append(chips);
    if (d.renderings?.length) {
      el.append(h('div', 'label', 'Rendered'));
      const r = h('div', 'chips');
      for (const x of d.renderings) r.append(button('chip link', `${x.w} ${x.n}`, () => openUses(num, '', 'all', { rendering: x.w })));
      el.append(r);
    }
    const acts = h('div', 'acts two');
    acts.append(button('btn primary', 'Every use', () => openUses(num, '')));
    if (num.startsWith('H')) acts.append(button('btn', 'BDB', () => openBdb(num)));
    else acts.append(button('btn', 'Count by book', () => openCount(num)));
    el.append(acts);
    el.append(h('div', 'label', 'By book'));
    el.append(bars(c.by_book));
  });
}

function bars(byBook: Record<string, number>) {
  const box = h('div', 'bars');
  const max = Math.max(1, ...Object.values(byBook));
  for (const [name, n] of Object.entries(byBook)) {
    const r = h('div', 'bar-row');
    const fill = h('i', 'bar-fill');
    fill.style.width = `${(n / max) * 100}%`;
    const track = h('span', 'bar-track');
    track.append(fill);
    r.append(h('span', 'bar-name', name), track, h('span', 'bar-n', String(n)));
    box.append(r);
  }
  return box;
}

export function openBdb(num: string) {
  return dock.open('bdb', `BDB ${num}`, `bdb|${num}`, STUDY, async el => {
    el.replaceChildren();
    const d = await wb(['bdb', num]);
    const hd = head(el, '');
    const row = h('div', 'lemma-row');
    row.append(lemma(d.lemma || '', 'heb'), h('div', 'translit', `${d.translit || ''} · ${num} · Brown-Driver-Briggs`));
    hd.replaceChildren(row);
    for (const e of d.entries || []) el.append(h('pre', 'bdb-text', e.text));
    if (!d.entries?.length) el.append(h('p', 'muted', 'BDB has no entry for this number.'));
  });
}

export function openCount(term: string) {
  return dock.open('count', `Count: ${term}`, `count|${term}`, STUDY, async el => {
    el.replaceChildren();
    const d = await wb(['count', term]);
    head(el, term, `${d.occurrences} times in ${d.verses} verses`);
    el.append(bars(d.by_book));
  });
}

export function openForms(word: string) {
  return dock.open('forms', `Forms: ${word}`, `forms|${word}`, STUDY, async el => {
    el.replaceChildren();
    const d = await wb(['forms', word]);
    head(el, `${word}…`, `${d.total} times in all`);
    for (const f of d.forms) el.append(button('entry-row', `${f.form}  ${f.n}`, () => openUses('', f.form)));
  });
}

export function openLexiconc(word: string) {
  return dock.open('lexiconc', `Defined by: ${word}`, `lexiconc|${word}`, STUDY, async el => {
    el.replaceChildren();
    const d = await wb(['lexiconc', word]);
    head(el, word, `${d.total} original word${d.total === 1 ? '' : 's'} whose lexicon entry has it`);
    el.append(...d.entries.map((e: any) => entryRow(e, [e.in_def ? 'in the definition' : '', e.in_usage ? 'in the KJV usage' : ''].filter(Boolean).join(', '))));
  });
}

export function openNear(a: string, b: string, within: number, scope: string) {
  return dock.open('near', `Near: ${a} ${b}`, `near|${a}|${b}|${within}|${scope}`, STUDY, async (el, pane) => {
    el.replaceChildren();
    let rows: any[] = [];
    const list: ResultList = { pane, ticked: new Set(), shape: 'verses', redraw: () => draw(), anchors: () => rows.map(r => `${r.ref.code}.${r.ref.c}:${r.ref.v}`) };
    const hd = head(el, `${a} · ${b}`, '');
    resultsBar(el, list);
    const body = h('div', 'rows');
    const more = button('btn wide', 'More', () => page(rows.length));
    el.append(body, more);
    const page = async (offset: number) => {
      const d = await wb(['near', a, b, '--within', String(within), '--scope', scope, '--offset', String(offset)]);
      rows = offset ? rows.concat(d.rows) : d.rows;
      (hd.querySelector('.pane-sub') as HTMLElement).textContent = `${d.verses} verses where they come within ${within} words, ${scopeLabel(scope)}`;
      more.hidden = !d.more;
      draw();
    };
    const draw = () => {
      body.replaceChildren(...rows.map(r => {
        const row = h('div', 'row');
        const t = h('p', 'scripture-row');
        if (r.words) for (const w of r.words) { t.append(w.lead || ''); t.append(w.m ? h('mark', 'found', w.t) : document.createTextNode(w.t)); t.append(w.trail || ''); }
        else t.textContent = r.text || '';
        const main = h('div', 'row-main');
        main.append(refLink(r.ref), t);
        row.append(main);
        tickable(list, row, `${r.ref.code}.${r.ref.c}:${r.ref.v}`);
        return row;
      }));
      if (!rows.length) body.append(h('p', 'muted', 'They do not come that close anywhere here.'));
    };
    await page(0);
  });
}

// ---- interlinear and passages ---------------------------------------------------------------------------------------

export function openInterlinear(place: string, label: string) {
  return dock.open('interlinear', 'Interlinear', `interlinear|${place}`, STUDY, async el => {
    el.replaceChildren();
    const d = await wb(['interlinear', place]);
    const rtl = d.lang === 'heb';
    head(el, label, `${rtl ? 'Hebrew, right to left' : 'Greek'} · word by word`);
    for (const v of d.verses) {
      el.append(h('div', 'label', `${d.book.name} ${v.c}:${v.v}`));
      const grid = h('div', 'inter-grid');
      grid.dir = rtl ? 'rtl' : 'ltr';
      for (const w of v.words) {
        const c = h('div', 'inter-card');
        const o = h('div', 'inter-orig', w.original);
        o.lang = rtl ? 'he' : 'grc';
        const s = button('inter-strong', w.strong || '', () => w.strong && openStrong(w.strong));
        c.append(o, h('div', 'inter-translit', w.translit || ''), s, h('div', 'inter-gloss', w.gloss || ''));
        c.title = (w.parse || []).map((p: any) => p.text).join('; ');
        grid.append(c);
      }
      el.append(grid);
    }
    if (d.more) el.append(h('p', 'muted small', `${d.total} verses; the first ${d.verses.length} are shown.`));
  });
}

/** open / compare / excerpt: one place in the KJV or the YLT is a second reader (note 9587); several places, or the KJV
 * with the YLT under each verse, are listed here, each verse asking whether to go there or open it as a tab (note 21bd). */
export function openPassage(places: string[], version: string, title: string) {
  if (places.length === 1 && version !== 'PAR') return void app.secondReader(places[0], version);
  return dock.open('passage', title, `passage|${places.join(';')}|${version}`, STUDY, async el => {
    el.replaceChildren();
    head(el, title, version === 'PAR' ? 'KJV, with the YLT under each verse' : version);
    for (const place of places) {
      const kjv = await wb(['text', place, '--version', version === 'YLT' ? 'YLT' : 'KJV', '--json']);
      const ylt = version === 'PAR' ? await wb(['text', place, '--version', 'YLT', '--json']) : null;
      if (places.length > 1) el.append(h('div', 'label', kjv.label));
      kjv.verses.forEach((v: any, k: number) => {
        const row = h('div', 'passage-verse');
        const ref = button('vref', `${v.c}:${v.v}`, e => refChoice(ref, v.ref, e));
        const p = h('p', 'scripture-row');
        p.append(ref, document.createTextNode(` ${v.text}`));
        row.append(p);
        if (ylt?.verses[k]) row.append(h('p', 'scripture-row ylt', ylt.verses[k].text));
        el.append(row);
      });
    }
  });
}

// ---- threads -----------------------------------------------------------------------------------------------------------

export function openThreads() {
  return dock.open('threads', 'Threads', 'threads', MINE, async el => {
    el.replaceChildren();
    head(el, 'Threads', 'Named, ordered places, each with your note. The eye draws a thread’s underline in the reader.');
    const form = h('form', 'inline-form');
    const name = h('input', 'field') as HTMLInputElement;
    name.placeholder = 'A new thread';
    form.append(name, h('button', 'btn', 'Start'));
    form.onsubmit = async e => {
      e.preventDefault();
      if (!name.value.trim()) return;
      await wb(['thread', 'new', name.value.trim()]);
      app.changed('threads');
    };
    el.append(form);
    const ts: any[] = await wb(['thread', 'list']);
    for (const t of ts) {
      const row = h('div', 'thread-row');
      const open = h('button', 'thread-open');
      open.append(h('i', `dot c-${t.color}`), h('span', 'thread-name', t.name), h('span', 'muted small', ` ${t.count} place${t.count === 1 ? '' : 's'}`));
      if (t.preview) open.append(h('div', 'muted small thread-preview', t.preview));
      open.onclick = () => openThread(t.name);
      row.append(open, eye(t.id, t.name));
      el.append(row);
    }
    if (!ts.length) el.append(h('p', 'muted', 'No threads yet. Start one here, or type +name in the command field to add the place you are at.'));
  });
}

function eye(id: string, name: string) {
  const shown = () => layers.shown(id);
  const b = h('button', 'eye');
  const draw = () => { b.replaceChildren(icon(shown() ? 'eye' : 'eyeoff')); b.title = `${shown() ? 'Hide' : 'Draw'} ${name} in the reader`; b.classList.toggle('off', !shown()); };
  b.onclick = () => {
    if (layers.hidden.has(id)) layers.hidden.delete(id); else layers.hidden.add(id);
    layers.save();
    draw();
    app.refreshMarks();
  };
  draw();
  return b;
}

export function openThread(name: string) {
  return dock.open('thread', name, `thread|${name.toLowerCase()}`, MINE, async (el, pane) => {
    const current = newest(el);
    const t = await wb(['thread', 'show', name]);
    if (!current()) return;
    el.replaceChildren();
    dock.rename(pane, t.name);
    const hd = h('header', 'pane-head thread-head');
    const title = h('h2', 'pane-title');
    title.append(h('i', `dot big c-${t.color}`), document.createTextNode(` ${t.name}`));
    const drawn = h('button', 'btn small drawn');
    const drawState = () => { drawn.replaceChildren(icon(layers.shown(t.id) ? 'eye' : 'eyeoff', 14), document.createTextNode(layers.shown(t.id) ? ' Drawn' : ' Hidden')); };
    drawn.onclick = () => { if (layers.hidden.has(t.id)) layers.hidden.delete(t.id); else layers.hidden.add(t.id); layers.save(); drawState(); app.refreshMarks(); };
    drawState();
    const menu = h('button', 'icon-btn');
    menu.append(icon('more'));
    menu.setAttribute('aria-label', 'Change this thread');
    menu.onclick = () => threadMenu(menu, t);
    hd.append(title, drawn, menu);
    el.append(hd);
    el.append(threadNote(t));
    const notes = h('div', 'thread-notes');
    el.append(notes, h('div', 'label', `Places · ${t.members.length}`));
    void threadNotes(t, notes);
    const list = h('div', 'members');
    t.members.forEach((m: any, k: number) => {
      const card = h('div', 'member');
      card.draggable = true;
      card.dataset.k = String(k);
      const grip = h('span', 'grip');
      grip.append(icon('grip', 14));
      const body = h('div', 'member-body');
      const lab = button('ref-link', m.label, e => (m.anchor.startsWith('H') || m.anchor.startsWith('G') ? openStrong(m.anchor) : refChoice(lab, m.anchor, e)));
      body.append(lab, h('p', 'scripture-row clamp', m.quote || ''));
      // an original word everywhere: its English renderings and Strong's definition, not only the original
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
      x.onclick = async () => { await wb(['thread', 'rm', t.name, m.anchor]); app.changed('threads'); };
      card.append(grip, body, x);
      // drag to reorder: the whole order is written in one change, as wb thread order does
      card.ondragstart = e => { e.dataTransfer!.setData('text/plain', String(k)); card.classList.add('dragging'); };
      card.ondragend = () => card.classList.remove('dragging');
      card.ondragover = e => { e.preventDefault(); card.classList.add('drop'); };
      card.ondragleave = () => card.classList.remove('drop');
      card.ondrop = async e => {
        e.preventDefault();
        card.classList.remove('drop');
        const from = +e.dataTransfer!.getData('text/plain');
        if (from === k) return;
        const order = t.members.map((x: any) => x.anchor);
        const [moved] = order.splice(from, 1);
        order.splice(k, 0, moved);
        await wb(['thread', 'order', t.name, ...order]);
        app.changed('threads');
      };
      list.append(card);
    });
    el.append(list);
    if (!t.members.length) el.append(h('p', 'muted', 'No places yet: type +' + t.name + ' in the command field to add the place you are at.'));
    // its documents (tier 4): each with how it stands, and Make for this thread
    const docs = h('div', 'thread-docs');
    el.append(docs);
    void threadDocuments(t, docs);
  });
}

// The notes on a thread: written on it (no place in the text), or placed notes and questions put on it. Each opens its
// place, is edited in place, taken off the thread, or deleted; the box below writes a new one on the thread.
async function threadNotes(t: any, into: HTMLElement) {
  const d = await wb(['thread', 'notes', t.name]);
  into.append(h('div', 'label', `Notes · ${d.notes.length}`));
  for (const n of d.notes) {
    const c = h('div', `note-card${n.kind === 'question' ? ' is-question' : ''}`);
    const top = h('div', 'nb-top');
    if (n.kind === 'question') top.append(h('span', 'pill question-pill', n.status === 'done' ? '? Answered' : '? Question'));
    if (n.anchor) top.append(placeGo(n.label, n.anchor));
    for (const a of n.also || []) top.append(placeGo(a.label, a.anchor));
    top.append(h('span', 'grow'), h('span', 'nb-time', n.time));
    const p = h('p', 'nb-text');
    p.append(linkedText(n.text, n.refs, refCard, refHover));
    const acts = h('div', 'nb-acts');
    acts.append(button('link-btn', 'Edit', () => {
      const ta = h('textarea', 'field nb-edit') as HTMLTextAreaElement;
      ta.value = n.text;
      p.replaceWith(ta);
      ta.focus();
      let done = false;
      const save = async () => {
        if (done) return;
        done = true;
        const v = ta.value.trim();
        if (v && v !== n.text) await wb(['note', 'text', n.id, '-'], v);
        app.changed('notes');
      };
      ta.onkeydown = e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
        if (e.key === 'Escape') { e.stopPropagation(); done = true; app.changed('notes'); }
      };
      ta.onblur = () => save();
    }));
    acts.append(button('link-btn', 'Take off the thread', async () => { await wb(['note', 'thread', n.id, t.id, '--remove']); app.changed('notes'); }));
    acts.append(h('span', 'grow'), button('link-btn danger', 'Delete', () => removeNote(n), 'trash'));
    c.append(top, p, acts);
    into.append(c);
  }
  const box = h('div', 'nb-write place-write');
  const ta = h('textarea', 'nb-input') as HTMLTextAreaElement;
  ta.placeholder = `Write a note on ${t.name}…`;
  ta.rows = 2;
  box.append(ta, h('div', 'muted small', 'Enter saves · Shift+Enter: a new line'));
  ta.onkeydown = async e => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const text = ta.value.trim();
    if (!text) return;
    try { await wb(['thread', 'write', t.name, '-'], text); ta.value = ''; app.changed('notes'); } catch (x) { toast(String(x)); }
  };
  into.append(box);
}

// The thread's own note, at its top: a click edits it in place (Enter saves, Shift+Enter: a new line, Esc: as it was).
function threadNote(t: any): HTMLElement {
  const box = h('div', 'thread-note-box');
  const show = () => {
    const p = button(`thread-note${t.note ? '' : ' empty'}`, t.note || 'Add a note to this thread…', edit);
    p.title = 'Click to edit the thread’s note';
    box.replaceChildren(p);
  };
  const edit = () => {
    const ta = h('textarea', 'field nb-edit') as HTMLTextAreaElement;
    ta.value = t.note || '';
    ta.rows = Math.min(8, Math.max(2, Math.ceil(ta.value.length / 50)));
    box.replaceChildren(ta, h('div', 'muted small', 'Enter saves · Shift+Enter: a new line · Esc: as it was'));
    ta.focus();
    let done = false;
    const save = async () => {
      if (done) return;
      done = true;
      const v = ta.value.trim();
      if (v === (t.note || '')) return show();
      await wb(['thread', 'edit', t.name, '--note', v]);
      app.changed('threads');
    };
    ta.onkeydown = e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.stopPropagation(); done = true; show(); }
    };
    ta.onblur = () => save();
  };
  show();
  return box;
}

function threadMenu(from: HTMLElement, t: any) {
  const box = h('div', 'menu-list');
  const item = (label: string, fn: () => void) => box.append(button('menu-item', label, () => { close(); fn(); }));
  const ask = (label: string, value: string, done: (v: string) => void) => {
    const f = h('form', 'menu-form');
    const i = h('input', 'field') as HTMLInputElement;
    i.value = value;
    f.append(h('div', 'label', label), i);
    f.onsubmit = e => { e.preventDefault(); close2(); done(i.value); };
    const close2 = popMenu(from, f, { align: 'right', width: 300 });
    i.focus();
    i.select();
  };
  item('Add the place you are at', async () => { await wb(['thread', 'add', t.name, here().anchor]); app.changed('threads'); toast(`${here().label} added`); });
  item('Rename…', () => ask('New name', t.name, async v => { await wb(['thread', 'edit', t.name, '--rename', v]); app.changed('threads', 'notes'); }));
  item('Note…', () => ask('The thread’s note', t.note || '', async v => { await wb(['thread', 'edit', t.name, '--note', v]); app.changed('threads'); }));
  const colors = h('div', 'colors');
  for (const c of ['yellow', 'green', 'blue', 'pink', 'orange']) {
    const s = h('button', `swatch c-${c}${t.color === c ? ' on' : ''}`);
    s.setAttribute('aria-label', c);
    s.onclick = async () => { close(); await wb(['thread', 'edit', t.name, '--color', c]); app.changed('threads'); };
    colors.append(s);
  }
  box.append(h('div', 'label', 'Color'), colors);
  item('Put it in Bible order', async () => { await wb(['thread', 'sort', t.name]); app.changed('threads'); });
  item('Delete the thread', async () => { if (confirm(`Delete the thread “${t.name}”? It goes to .trash in the study folder.`)) { await wb(['thread', 'delete', t.name]); app.changed('threads', 'notes'); } });
  const close = popMenu(from, box, { align: 'right', width: 240 });
}

// ---- your own work: find, marked, my notes, the log, the shelf, lessons ------------------------------------------------

export function openFind(words: string) {
  return dock.open('find', `Find: ${words}`, `find|${words}`, MINE, async el => {
    el.replaceChildren();
    const d = await wb(['find', words]);
    head(el, q(words), 'In your notes, threads and questions');
    const sec = (title: string, items: any[], row: (x: any) => HTMLElement) => {
      if (!items.length) return;
      el.append(h('div', 'label', title), ...items.map(row));
    };
    sec('Notes', d.notes, n => card(n.label, n.snippet, e => refChoice(e.currentTarget as HTMLElement, n.anchor, e)));
    sec('Threads', d.threads, t => card(t.name, t.snippet || `${t.count} places`, () => openThread(t.name)));
    sec('Questions', d.trails, t => card(t.label, t.snippet, e => refChoice(e.currentTarget as HTMLElement, t.anchor, e)));
    if (!d.notes.length && !d.threads.length && !d.trails.length) el.append(h('p', 'muted', 'Nothing of yours has all of these words.'));
  });
}

function card(place: string, text: string, go: (e: MouseEvent) => void) {
  const c = h('div', 'note-card');
  c.append(placePill(place, go), h('p', '', text));
  return c;
}

export function openMarked(color: string, scope: string, thread?: string) {
  const key = `marked|${color}|${scope}|${thread || ''}`;
  return dock.open('marked', 'Marked', key, STUDY, async el => {
    el.replaceChildren();
    const argv = ['hl', 'list'];
    if (color) argv.push('--color', color);
    if (thread) argv.push('--thread', thread);
    let rows: any[] = await wb(argv);
    if (scope && scope !== 'all') rows = rows.filter(r => scope === 'OT' ? r.book <= 39 : scope === 'NT' ? r.book >= 40 : scope.split(',').includes(String(r.book)));
    head(el, color ? `Marked ${color}` : 'Marked', `${rows.length} highlight${rows.length === 1 ? '' : 's'}${thread ? ` in ${thread}` : ''}, ${scopeLabel(scope)}`);
    for (const r of rows) {
      const c = h('div', 'note-card');
      const p = h('p', 'scripture-row');
      const sw = h('i', `swatch-dot c-${r.color}`);
      if (r.color.startsWith('#')) sw.style.background = r.color;
      p.append(sw, document.createTextNode(` ${r.quote}`));
      c.append(placeGo(r.label, r.anchor), p);
      el.append(c);
    }
  });
}

/**
 * Notes & lookup for a place (the Python app's My notes pane): the words verbatim, their highlight, your notes there (edit,
 * delete, add), questions there, notes nearby, notes on the original word everywhere, the threads holding it, and its
 * Strong's numbers. Everything through `wb anchor` and the note, trail, highlight and thread commands.
 */
export function openPlace(anchor: string, label: string) {
  return dock.open('place', label, `place|${anchor}`, MINE, async el => {
    const current = newest(el);
    // the questions on this place and on any part of it: a question on words of a verse shows at the verse (note c39a)
    const [d, qs] = await Promise.all([wb(['anchor', anchor]), wb(['trail', 'list', '--status', 'all', '--at', anchor]).catch(() => ({ trails: [] }))]);
    if (!current()) return;
    el.replaceChildren();
    const hd = head(el, d.label || label, '');
    if (d.kind !== 'verse' && d.kind !== 'lemma') (hd.querySelector('.pane-sub') as HTMLElement).textContent = d.kind === 'word' ? 'A word' : 'Words';
    if (d.quote) el.append(h('p', 'scripture place-quote', d.kind === 'verse' || d.kind === 'verses' ? d.quote : `“${d.quote}”`));
    if (d.ok && d.kind !== 'lemma') {
      el.append(h('div', 'label', 'Highlight'));
      const row = h('div', 'colors');
      for (const c of ['yellow', 'green', 'blue', 'pink', 'orange']) {
        const sw = h('button', `swatch c-${c}${d.highlight === c ? ' on' : ''}`);
        sw.setAttribute('aria-label', c);
        sw.onclick = async () => { await wb(['hl', 'set', anchor, c]); app.changed('highlights'); };
        row.append(sw);
      }
      if (d.highlight && !['yellow', 'green', 'blue', 'pink', 'orange'].includes(d.highlight)) {
        const sw = h('button', 'swatch on');
        sw.style.background = d.highlight;
        sw.setAttribute('aria-label', d.highlight);
        row.append(sw);
      }
      if (d.highlight || d.highlighted) {
        const x = h('button', 'swatch clear', '×');
        x.setAttribute('aria-label', 'Remove the highlight');
        x.title = 'Remove the highlight here';
        x.onclick = async () => { await wb(['hl', 'clear', anchor]); app.changed('highlights'); };
        row.append(x);
      }
      el.append(row);
    }
    el.append(h('div', 'label', 'Your notes here'));
    for (const n of d.notes || []) el.append(noteCardEditable(n, { anchor, label: d.label || label }));
    if (!(d.notes || []).length) el.append(h('p', 'muted small', 'None yet.'));
    el.append(addNoteBox(anchor));
    const here = [...(qs.trails || [])].sort((a: any, b: any) => Number(b.here) - Number(a.here));
    if (here.length) {
      el.append(h('div', 'label', 'Questions here'));
      for (const t of here) {
        const c = h('div', `note-card question-card${t.status === 'done' ? ' done' : ''}`);
        // a question on part of this place (or around it) says where it is
        if (!t.here) c.append(placePill(t.quote ? `${t.label} · “${short(t.quote)}”` : t.label, () => openPlace(t.anchor, t.label)));
        const top = h('div', 'nb-top');
        const tag = button('pill question-pill', t.status === 'done' ? '? Answered' : '? Question', async () => { await wb(['note', 'question', t.id, '--plain']); app.changed('notes'); });
        tag.title = 'Click: make it a plain note';
        top.append(tag, h('span', 'grow'));
        top.append(button(`link-btn${t.status === 'done' ? '' : ' answered'}`, t.status === 'done' ? 'Open again' : '✓ Answered', async () => { await wb(['note', 'answered', t.id, ...(t.status === 'done' ? ['--open'] : [])]); app.changed('notes'); }));
        top.append(button('link-btn', 'Move…', e => placeMenu(e.currentTarget as HTMLElement, { id: t.id, placed: true, label: d.label || label })));
        top.append(button('link-btn', 'Take off', () => takeOff(t.id, { anchor, label: d.label || label })));
        c.append(top, h('p', 'nb-text', t.text));
        el.append(c);
      }
    }
    const near = d.nearby || [];
    if (near.length) {
      el.append(h('div', 'label', 'Nearby'));
      for (const n of near) el.append(card(n.quote ? `${placeLabel(n)} · “${short(n.quote)}”` : placeLabel(n), n.text, () => openPlace(n.anchor, placeLabel(n))));
    }
    const ev = d.everywhere;
    if (ev?.word_notes?.length) {
      el.append(h('div', 'label', `${ev.strong} everywhere`));
      for (const n of ev.word_notes) el.append(card(`${ev.strong} ${ev.translit || ''}`.trim(), n.text, () => openStrong(ev.strong)));
    }
    if ((d.threads || []).length) {
      el.append(h('div', 'label', 'In threads'));
      const row = h('div', 'in-threads');
      for (const t of d.threads) {
        const chip = h('span', 'chip thread');
        chip.append(h('i', `dot c-${t.color}`), button('link-btn', t.name, () => openThread(t.name)));
        const x = h('button', 'member-x shown');
        x.append(icon('x', 12));
        x.title = `Take it out of ${t.name}`;
        x.onclick = async () => { await wb(['thread', 'rm', t.name, anchor]); app.changed('threads'); };
        chip.append(x);
        row.append(chip);
      }
      el.append(row);
    }
    const acts = h('div', 'acts two');
    acts.append(button('btn', 'Add to a thread…', e => threadChooser(e.currentTarget as HTMLElement, async name => { await wb(['thread', 'add', name, anchor]); app.changed('threads'); })));
    if (d.ref) acts.append(button('btn', 'Interlinear', () => openInterlinear(`${d.ref.code} ${d.ref.c}:${d.ref.v}`, `${d.ref.name} ${d.ref.c}:${d.ref.v}`)));
    el.append(acts);
    if ((d.strongs || []).length) {
      el.append(h('div', 'label', 'Original words'));
      const row = h('div', 'chips');
      for (const sn of d.strongs) row.append(button('chip link', sn, () => openStrong(sn)));
      el.append(row);
    }
  });
}

const short = (q: string) => (q.length > 40 ? q.slice(0, 38) + '…' : q);
const placeLabel = (n: any) => n.label || n.anchor;

function noteCardEditable(n: any, at: At): HTMLElement {
  const label = at.label;
  const c = h('div', 'note-card');
  const top = h('div', 'nb-top');
  top.append(placePill(n.kind === 'verse' ? label : `${label} · “${short(n.quote || '')}”`), h('span', 'grow'));
  const edit = button('link-btn', 'Edit', () => {
    const ta = h('textarea', 'field nb-edit') as HTMLTextAreaElement;
    ta.value = n.text;
    p.replaceWith(ta);
    ta.focus();
    const save = async () => {
      const text = ta.value.trim();
      if (text && text !== n.text) await wb(['note', 'text', n.id, '-'], text);
      app.changed('notes');
    };
    ta.onkeydown = e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.stopPropagation(); app.changed('notes'); }
    };
    ta.onblur = () => save();
  });
  const move = button('link-btn', 'Move…', e => placeMenu(e.currentTarget as HTMLElement, { id: n.id, placed: true, label }));
  // this place off the note (it stays on its others; on none, it waits in the Inbox)
  const off = button('link-btn', 'Take off', () => takeOff(n.id, at));
  off.title = `Take this note off ${label}`;
  const del = button('link-btn danger', 'Delete', async () => {
    if (!confirm('Delete this note? It goes to .trash in the study folder.')) return;
    await wb(['note', 'rm', n.id]);
    app.changed('notes');
  }, 'trash');
  top.append(edit, move, off, del);
  const p = h('p', 'nb-text', n.text);
  c.append(top, p);
  return c;
}

function addNoteBox(anchor: string): HTMLElement {
  const box = h('div', 'nb-write place-write');
  const ta = h('textarea', 'nb-input') as HTMLTextAreaElement;
  ta.placeholder = 'Write a note here…';
  ta.rows = 2;
  box.append(ta, h('div', 'muted small', 'Enter saves · Shift+Enter: a new line'));
  ta.onkeydown = async e => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const text = ta.value.trim();
    if (!text) return;
    try { await wb(['note', 'add', anchor, '-'], text); ta.value = ''; app.changed('notes'); } catch (x) { toast(String(x)); }
  };
  return box;
}

export function openToday(day: string) {
  return dock.open('today', day ? `Log ${day}` : 'Today', `today|${day}`, MINE, async el => {
    el.replaceChildren();
    const d = await wb(day ? ['log', day] : ['log']);
    head(el, day || 'Today', 'What was typed into the command field');
    for (const ev of d.entries || []) {
      const row = h('div', 'log-row');
      const line = button('log-line', ev.text || '', () => app.run(ev.text));
      line.title = 'Run it again';
      row.append(h('span', 'muted small', (ev.t || '').slice(0, 5)), line, h('span', 'muted small', ev.result || ''));
      el.append(row);
    }
    if (!d.entries?.length) el.append(h('p', 'muted', 'Nothing typed that day.'));
  });
}

// Reading plans live in plans.ts (the plan, its form, Past plans).
export { openPlans } from './plans';

export function openShelf() {
  return dock.open('shelf', 'Shelf', 'shelf', MINE, async el => {
    el.replaceChildren();
    const sets: any[] = await wb(['set', 'list']);
    head(el, 'Shelf', 'Your sets: named groups of threads, places, notes, lessons and panes');
    for (const s of sets) {
      el.append(h('div', 'label', s.name));
      for (const it of s.items) {
        const row = h('button', 'entry-row', `${it.kind}: ${it.label}`);
        row.onclick = () => {
          if (it.kind === 'thread') openThread(it.label);
          else if (it.kind === 'place') goTo(it.ref);
          else if (it.kind === 'lesson') openLesson(it.label);
          else toast(`${it.kind} items open in a later phase`);
        };
        el.append(row);
      }
    }
  });
}

export function openLesson(name: string) {
  return dock.open('lesson', name, `lesson|${name}`, MINE, async el => {
    el.replaceChildren();
    const text = await wb(['lesson', 'show', name]);
    head(el, name, 'lessons/ in the study folder');
    el.append(h('pre', 'lesson-text', String(text)));
  });
}

// ---- the manual and the keys ---------------------------------------------------------------------------------------

let manualCache: any = null;
export async function manual() {
  manualCache ??= await wb(['manual']);
  return manualCache;
}

/** The keys, as Keys and Help's Keys list them. */
const KEYS: [string, string][] = [
  ['`', 'Open the command field (search, go to a place, or a command)'],
  ['← →', 'The previous and next chapter'],
  ['Ctrl+F', 'Find: in the pane you last clicked or typed in, else in this chapter (Enter: the next, Shift+Enter: the one before)'],
  ['↑ ↓ in the command field', 'The lines run before, newest first, the ones that did not work too (as PowerShell keeps them)'],
  ['Right-click a verse', 'Open it in a new tab (a second reader), Notes & lookup, Copy'],
  ['Ctrl+click a reference', 'Straight to the reader (a click asks: the reader, or a tab)'],
  ['Ctrl+= / Ctrl+-', 'Text size'],
  ['Esc', 'Close a card, a menu or the field'],
  ['Alt+click a word', 'The interlinear for its verse'],
  ['Ctrl+J', 'Quick capture: a small box at the verse you clicked, from anywhere (Enter saves, Ctrl+Enter keeps writing in the Notebook; the key is in Notebook settings)'],
  ['Ctrl+Shift+J', 'A finding about the app: kept apart from your study, with what is on screen (Findings, under More)'],
  ['In a note', 'Ctrl+B bold, Ctrl+I italics, [[ a link to another note; Esc or Ctrl+Enter: done'],
];

let guideCache: any = null;
async function guideEntries(): Promise<any[]> {
  guideCache ??= await wb(['guide', '--json']);
  return guideCache.entries;
}

/** Help (W5, sheet W6.3): Guide (how the parts of the Notebook work: `wb guide`), Commands (everything the command
 * field understands: the manual) and Keys. A topic that names a Guide entry opens the Guide at it. */
export function openHelp(topic = '') {
  return dock.open('help', 'Help', 'help', MINE, async (el, pane) => {
    el.replaceChildren();
    const [m, guide] = await Promise.all([manual(), guideEntries().catch(() => [])]);
    const t0 = topic.trim().toLowerCase();
    let tab: 'guide' | 'commands' | 'keys' = t0 && guide.some((g: any) => g.name.startsWith(t0) || g.title.toLowerCase().startsWith(t0)) ? 'guide' : t0 ? 'commands' : 'guide';
    const tabs = h('div', 'seg small help-tabs');
    tabs.setAttribute('role', 'tablist');
    const filter = h('input', 'field help-filter') as HTMLInputElement;
    filter.value = topic;
    const body = h('div', 'help-body');
    el.append(tabs, filter, body);
    const tabBtn = (k: typeof tab, label: string) => {
      const b = button(`help-tab-${k}${tab === k ? ' on' : ''}`, label, () => { tab = k; for (const x of tabs.children) x.classList.toggle('on', x === b); draw(); });
      b.setAttribute('role', 'tab');
      tabs.append(b);
    };
    tabBtn('guide', 'Guide');
    tabBtn('commands', 'Commands');
    tabBtn('keys', 'Keys');
    const has = (o: any, f: string) => JSON.stringify(o).toLowerCase().includes(f);
    const draw = () => {
      const f = filter.value.trim().toLowerCase();
      filter.placeholder = tab === 'guide' ? 'A part of the Notebook, or a word' : tab === 'commands' ? 'A command or a word' : 'A key or a word';
      body.replaceChildren();
      if (tab === 'guide') {
        const hits = guide.filter((g: any) => !f || g.name.startsWith(f) || has(g, f));
        for (const g of hits) {
          const sec = h('section', 'guide-entry');
          sec.dataset.name = g.name;
          sec.append(h('h3', 'guide-title', g.title));
          for (const p of g.parts) sec.append(h('div', 'guide-head', p.head), h('p', 'small guide-text', p.text));
          body.append(sec);
        }
        if (!hits.length) body.append(h('p', 'muted', 'No part of the Guide has that word. Commands lists everything the command field understands.'));
        return;
      }
      if (tab === 'keys') {
        for (const [k, what] of KEYS.filter(([k, w]) => !f || (k + ' ' + w).toLowerCase().includes(f))) {
          const r = h('div', 'key-row');
          r.append(h('kbd', '', k), h('span', '', what));
          body.append(r);
        }
        return;
      }
      body.append(h('p', 'muted small', 'Everything the command field understands. Backtick (`) opens it.'));
      for (const [sec, title] of m.sections) {
        const docs = m.docs.filter((d: any) => d.section === sec && (!f || d.name.startsWith(f) || has(d, f)));
        if (!docs.length) continue;
        body.append(h('div', 'label', title));
        for (const d of docs) {
          const det = h('details', 'doc');
          det.open = !!f && (d.name === f || docs.length === 1);
          const sum = h('summary');
          sum.append(h('code', '', d.name), document.createTextNode(` ${d.what}`));
          det.append(sum);
          for (const u of d.usage) det.append(h('code', 'doc-usage', u));
          for (const x of d.details) det.append(h('p', 'small', x));
          for (const [typed, what] of d.examples || []) {
            const ex = h('div', 'doc-example');
            ex.append(button('btn small', typed, () => app.run(typed)), h('span', 'muted small', ` ${what}`));
            det.append(ex);
          }
          body.append(det);
        }
      }
    };
    filter.oninput = draw;
    draw();
    void pane;
  });
}

export function openKeys() {
  return dock.open('keys', 'Keys', 'keys', MINE, async el => {
    el.replaceChildren();
    head(el, 'Keys', 'The keyboard in this window');
    for (const [k, what] of KEYS) {
      const r = h('div', 'key-row');
      r.append(h('kbd', '', k), h('span', '', what));
      el.append(r);
    }
  });
}
