// The panes beside the reader. Each draws what a `wb` command returns (the same answers as in a terminal), and nothing
// here interprets the text: scripture is shown verbatim from the database, with its reference.
import { wb } from './api';
import { app, book, goTo, here } from './app';
import { Dock, type Pane, type Side } from './dock';
import { layers } from './layers';
import { hideCard, showCard, toast } from './sheets';
import { button, h, icon, placePill, popMenu } from './ui';

export let dock: Dock;
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
  a.onclick = () => app.go(r.code, r.c, r.v);
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
    app.changed();
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

// ---- hover cards on references written in notes (a mouse only; `hover off` turns them off) --------------------------
export function refHover(a: HTMLElement, ref: string) {
  let timer = 0, seq = 0;
  a.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse' || document.documentElement.dataset.hover === 'off') return;
    const my = ++seq;
    timer = window.setTimeout(async () => {
      const d = await wb(['preview', ref, '--json']).catch(() => null);
      if (!d || my !== seq || !a.isConnected || !a.matches(':hover')) return;
      const body = h('div', 'verse-view');
      body.append(h('div', 'card-head', `${d.label} · ${d.version}`));
      for (const v of d.verses || []) {
        const p = h('p', 'scripture');
        if ((d.verses || []).length > 1) p.append(h('span', 'vref', `${v.ref.split(':').pop()} `));
        p.append(v.text);
        body.append(p);
      }
      if (d.more) body.append(h('p', 'muted small', `and ${d.more} more verses`));
      showCard(body, a.getBoundingClientRect());
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

export async function usesArgs(strong: string, word: string, scope: string, offset = 0) {
  const argv = ['uses', strong || word];
  if (strong && word) argv.push('--word', word);
  argv.push('--scope', scope || 'all', '--offset', String(offset));
  return wb(argv);
}

export function openUses(strong: string, word: string, scope = 'all') {
  const label = [strong, word].filter(Boolean).join(' ');
  return dock.open('uses', `Every use: ${label}`, `uses|${strong}|${word}|${scope}`, STUDY, async (el, pane) => {
    el.replaceChildren();
    let rows: any[] = [];
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
      const d = await usesArgs(strong, word, scope, offset);
      rows = offset ? rows.concat(d.rows) : d.rows;
      (hd.querySelector('.pane-sub') as HTMLElement).textContent = `${d.occurrences} time${d.occurrences === 1 ? '' : 's'} in ${d.verses} verse${d.verses === 1 ? '' : 's'}, ${scopeLabel(scope)}`;
      chips.replaceChildren(...Object.entries(d.totals || {}).filter(([, n]) => (n as number) > 0).map(([k, n]) => h('span', `chip m-${k}`, `${MARK_NAMES[k] || k}: ${n}`)));
      if (strong && word) chips.append(h('span', 'muted small', 'both: the verse’s word translates it'));
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
      for (const x of d.renderings) r.append(button('chip link', `${x.w} ${x.n}`, () => openUses(num, x.w)));
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

/** open / compare / excerpt: one place or several, in the KJV, the YLT, or both (the YLT under each KJV verse). */
export function openPassage(places: string[], version: string, title: string) {
  return dock.open('passage', title, `passage|${places.join(';')}|${version}`, STUDY, async el => {
    el.replaceChildren();
    head(el, title, version === 'PAR' ? 'KJV, with the YLT under each verse' : version);
    for (const place of places) {
      const kjv = await wb(['text', place, '--version', version === 'YLT' ? 'YLT' : 'KJV', '--json']);
      const ylt = version === 'PAR' ? await wb(['text', place, '--version', 'YLT', '--json']) : null;
      if (places.length > 1) el.append(h('div', 'label', kjv.label));
      kjv.verses.forEach((v: any, k: number) => {
        const row = h('div', 'passage-verse');
        const ref = button('vref', `${v.c}:${v.v}`, () => goTo(v.ref));
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
      app.changed();
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
    el.replaceChildren();
    const t = await wb(['thread', 'show', name]);
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
    if (t.note) el.append(h('p', 'pane-sub thread-note', t.note));
    const list = h('div', 'members');
    t.members.forEach((m: any, k: number) => {
      const card = h('div', 'member');
      card.draggable = true;
      card.dataset.k = String(k);
      const grip = h('span', 'grip');
      grip.append(icon('grip', 14));
      const body = h('div', 'member-body');
      const lab = button('ref-link', m.label, () => (m.ref ? app.go(m.ref.code, m.ref.c, m.ref.v) : m.anchor.startsWith('H') || m.anchor.startsWith('G') ? openStrong(m.anchor) : goTo(m.anchor)));
      body.append(lab, h('p', 'scripture-row clamp', m.quote || ''));
      const x = h('button', 'member-x');
      x.append(icon('x', 12));
      x.title = 'Take it out of the thread';
      x.onclick = async () => { await wb(['thread', 'rm', t.name, m.anchor]); app.changed(); };
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
        app.changed();
      };
      list.append(card);
    });
    el.append(list);
    if (!t.members.length) el.append(h('p', 'muted', 'No places yet: type +' + t.name + ' in the command field to add the place you are at.'));
  });
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
  item('Add the place you are at', async () => { await wb(['thread', 'add', t.name, here().anchor]); app.changed(); toast(`${here().label} added`); });
  item('Rename…', () => ask('New name', t.name, async v => { await wb(['thread', 'edit', t.name, '--rename', v]); app.changed(); }));
  item('Note…', () => ask('The thread’s note', t.note || '', async v => { await wb(['thread', 'edit', t.name, '--note', v]); app.changed(); }));
  const colors = h('div', 'colors');
  for (const c of ['yellow', 'green', 'blue', 'pink', 'orange']) {
    const s = h('button', `swatch c-${c}${t.color === c ? ' on' : ''}`);
    s.setAttribute('aria-label', c);
    s.onclick = async () => { close(); await wb(['thread', 'edit', t.name, '--color', c]); app.changed(); };
    colors.append(s);
  }
  box.append(h('div', 'label', 'Color'), colors);
  item('Put it in Bible order', async () => { await wb(['thread', 'sort', t.name]); app.changed(); });
  item('Delete the thread', async () => { if (confirm(`Delete the thread “${t.name}”? It goes to .trash in the study folder.`)) { await wb(['thread', 'delete', t.name]); app.changed(); } });
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
    sec('Notes', d.notes, n => card(n.label, n.snippet, () => goTo(n.anchor)));
    sec('Threads', d.threads, t => card(t.name, t.snippet || `${t.count} places`, () => openThread(t.name)));
    sec('Questions', d.trails, t => card(t.label, t.snippet, () => goTo(t.anchor)));
    if (!d.notes.length && !d.threads.length && !d.trails.length) el.append(h('p', 'muted', 'Nothing of yours has all of these words.'));
  });
}

function card(place: string, text: string, go: () => void) {
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
      c.append(placePill(r.label, () => goTo(r.anchor)), p);
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
    el.replaceChildren();
    const [d, qs] = await Promise.all([wb(['anchor', anchor]), wb(['trail', 'list', '--status', 'all']).catch(() => ({ trails: [] }))]);
    const hd = head(el, d.label || label, '');
    if (d.kind !== 'verse' && d.kind !== 'lemma') (hd.querySelector('.pane-sub') as HTMLElement).textContent = d.kind === 'word' ? 'A word' : 'Words';
    if (d.quote) el.append(h('p', 'scripture place-quote', d.kind === 'verse' || d.kind === 'verses' ? d.quote : `“${d.quote}”`));
    if (d.ok && d.kind !== 'lemma') {
      el.append(h('div', 'label', 'Highlight'));
      const row = h('div', 'colors');
      for (const c of ['yellow', 'green', 'blue', 'pink', 'orange']) {
        const sw = h('button', `swatch c-${c}${d.highlight === c ? ' on' : ''}`);
        sw.setAttribute('aria-label', c);
        sw.onclick = async () => { await wb(['hl', 'set', anchor, c]); app.changed(); };
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
        x.onclick = async () => { await wb(['hl', 'clear', anchor]); app.changed(); };
        row.append(x);
      }
      el.append(row);
    }
    el.append(h('div', 'label', 'Your notes here'));
    for (const n of d.notes || []) el.append(noteCardEditable(n, d.label || label));
    if (!(d.notes || []).length) el.append(h('p', 'muted small', 'None yet.'));
    el.append(addNoteBox(anchor));
    const here = (qs.trails || []).filter((t: any) => t.anchor === anchor);
    if (here.length) {
      el.append(h('div', 'label', 'Questions here'));
      for (const t of here) {
        const c = h('div', `note-card${t.status === 'done' ? ' done' : ''}`);
        const top = h('div', 'nb-top');
        top.append(h('span', 'pill question-pill', t.status === 'done' ? '? Answered' : '? Question'), h('span', 'grow'));
        top.append(button('link-btn', t.status === 'done' ? 'Open again' : 'Answered', async () => { await wb(['trail', t.status === 'done' ? 'reopen' : 'done', t.id]); app.changed(); }));
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
        x.onclick = async () => { await wb(['thread', 'rm', t.name, anchor]); app.changed(); };
        chip.append(x);
        row.append(chip);
      }
      el.append(row);
    }
    const acts = h('div', 'acts two');
    acts.append(button('btn', 'Add to a thread…', e => threadChooser(e.currentTarget as HTMLElement, async name => { await wb(['thread', 'add', name, anchor]); app.changed(); })));
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

function noteCardEditable(n: any, label: string): HTMLElement {
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
      if (text && text !== n.text) await wb(['note', 'edit', n.id, n.anchor, '-'], text);
      app.changed();
    };
    ta.onkeydown = e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.stopPropagation(); app.changed(); }
    };
    ta.onblur = () => save();
  });
  const del = button('link-btn', 'Delete', async () => {
    if (!confirm('Delete this note? It goes to .trash in the study folder.')) return;
    await wb(['note', 'rm', n.id]);
    app.changed();
  });
  top.append(edit, del);
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
    try { await wb(['note', 'add', anchor, '-'], text); ta.value = ''; app.changed(); } catch (x) { toast(String(x)); }
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

export function openHelp(topic = '') {
  return dock.open('help', 'Help', 'help', MINE, async (el, pane) => {
    el.replaceChildren();
    const m = await manual();
    head(el, 'Help', 'Everything the command field understands. Backtick (`) opens it.');
    const filter = h('input', 'field') as HTMLInputElement;
    filter.placeholder = 'A command or a word';
    filter.value = topic;
    el.append(filter);
    const body = h('div');
    el.append(body);
    const draw = () => {
      const f = filter.value.trim().toLowerCase();
      body.replaceChildren();
      for (const [sec, title] of m.sections) {
        const docs = m.docs.filter((d: any) => d.section === sec && (!f || d.name.startsWith(f) || JSON.stringify(d).toLowerCase().includes(f)));
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
    const rows: [string, string][] = [
      ['`', 'Open the command field (search, go to a place, or a command)'],
      ['← →', 'The previous and next chapter'],
      ['Ctrl+F', 'Find in this chapter'],
      ['Ctrl+= / Ctrl+-', 'Text size'],
      ['Esc', 'Close a card, a menu or the field'],
      ['Alt+click a word', 'The interlinear for its verse'],
      ['Enter in the Notebook', 'Add the entry (Shift+Enter: a new line)'],
    ];
    for (const [k, what] of rows) {
      const r = h('div', 'key-row');
      r.append(h('kbd', '', k), h('span', '', what));
      el.append(r);
    }
  });
}
