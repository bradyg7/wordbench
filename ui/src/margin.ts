// The reader's margin (design/features/marks, MK-3, M25 to M28, M32 to M35). A view of margin notes, pages and saves, never a
// store of its own: each verse that has something gets one mark beside it, "2 notes · 3 pages" (a ring at the verse number
// when the pane is narrow); hovering shows their first lines; a click opens the verse in the margin. The marks are placed
// absolutely, so the reading column's width and line breaks are the same with the margin on and off.
import { wb } from './api';
import { h, popMenu } from './ui';
import { toast } from './sheets';
import { layers } from './layers';

interface Line { kind: 'note' | 'page'; id: string; text: string }
interface VerseCounts { v: number; notes: number; around: number; pages: number; saves: number; marks: number; lines: Line[] }
interface MNote {
  id: string; at: string; label: string; kind: string; text: string; first_line: string; question: boolean; done: boolean;
  written: string; year: string; words: string; grew: { id: string; title: string }[]; v1: number; v2: number; verse_start?: string; legacy?: boolean; page?: string;
}
interface Chapter { code: string; chapter: number; label: string; notes: MNote[]; top: MNote[]; verses: VerseCounts[] }

let current: { code: string; chapter: number; data: Chapter | null } = { code: '', chapter: 0, data: null };
let host: { reader: HTMLElement; scroller: HTMLElement } | null = null;
/** How a margin note opens a page (the Notebook's own opener, given by main.ts). */
let openPage: (id: string) => void = () => {};
let panel: HTMLElement | null = null;

export function initMargin(opts: { openPage: (id: string) => void }) { openPage = opts.openPage; }

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
export function summary(c: VerseCounts): string {
  const parts: string[] = [];
  const notes = c.notes;
  if (notes) parts.push(plural(notes, 'note'));
  if (c.pages) parts.push(plural(c.pages, 'page'));
  if (c.saves) parts.push(plural(c.saves, 'save'));
  if (!parts.length && c.around) parts.push(`${plural(c.around, 'note')} on the passage`);
  return parts.join(' · ');
}

const close = () => { panel?.remove(); panel = null; document.querySelectorAll('.mg-pop').forEach(e => e.remove()); };

/** Draw the margin for the chapter just drawn. Called again when more of a long chapter is drawn and when the width changes. */
export async function drawMargin(reader: HTMLElement, scroller: HTMLElement, code: string, chapter: number) {
  host = { reader, scroller };
  if (current.code !== code || current.chapter !== chapter || !current.data) {
    current = { code, chapter, data: null };
    close();
    try { current.data = await wb(['margin', `${code} ${chapter}`]); } catch { current.data = null; }
  }
  place();
}

export function placeMargin() { place(); }

function place() {
  if (!host) return;
  const { reader, scroller } = host;
  reader.querySelector('.mg-rail')?.remove();
  reader.classList.toggle('mg-off', !layers.margin);
  const data = current.data;
  if (!data || !Array.isArray(data.verses) || !layers.margin) return;
  const rail = h('div', 'mg-rail');
  const wide = scroller.clientWidth >= reader.offsetWidth + 2 * 170 && window.innerWidth > 700;
  rail.classList.toggle('mg-wide', wide);
  for (const c of data.verses) {
    const vn = reader.querySelector<HTMLElement>(`.vn[data-v="${c.v}"]`);
    if (!vn) continue;
    const text = summary(c);
    if (!text) continue;
    const b = h('button', wide ? 'mg-mark' : 'mg-dot');
    b.dataset.v = String(c.v);
    b.setAttribute('aria-label', `${data.label}:${c.v}: ${text}`);
    if (wide) { b.textContent = text; b.style.left = `${reader.offsetWidth + 6}px`; b.style.top = `${vn.offsetTop - 2}px`; }
    else { b.style.left = `${vn.offsetLeft - 15}px`; b.style.top = `${vn.offsetTop - 4}px`; }
    b.onmouseenter = () => hover(b, c);
    b.onmouseleave = () => document.querySelectorAll('.mg-pop').forEach(e => e.remove());
    b.onclick = () => { document.querySelectorAll('.mg-pop').forEach(e => e.remove()); void openVerse(code(), data.chapter, c.v); };
    rail.append(b);
  }
  // a chapter's own notes sit at its top
  if (data.top.length) {
    const t = reader.querySelector<HTMLElement>('.ch-title');
    if (t) {
      const b = h('button', wide ? 'mg-mark mg-top' : 'mg-dot mg-top-dot');
      b.dataset.chapter = '1';
      b.textContent = wide ? plural(data.top.length, 'note on the chapter') : '';
      b.style.top = `${t.offsetTop + 6}px`;
      b.style.left = wide ? `${reader.offsetWidth + 6}px` : `${t.offsetWidth - 4}px`;
      b.onclick = () => void openVerse(code(), data.chapter, 0);
      rail.append(b);
    }
  }
  // a passage's note shows a bracket beside its verses (M28)
  for (const n of data.notes.filter(n => n.kind === 'passage')) {
    const a = reader.querySelector<HTMLElement>(`.vn[data-v="${n.v1}"]`), z = reader.querySelector<HTMLElement>(`.vn[data-v="${n.v2}"]`);
    if (!a || !z) continue;
    const br = h('i', 'mg-bracket');
    br.dataset.note = n.id;
    br.style.left = `${reader.offsetWidth - 4}px`;
    br.style.top = `${a.offsetTop}px`;
    br.style.height = `${Math.max(14, z.offsetTop - a.offsetTop + 22)}px`;
    br.title = `${n.label}: ${n.first_line}`;
    rail.append(br);
  }
  reader.append(rail);
  function code() { return data!.code; }
}

function hover(from: HTMLElement, c: VerseCounts) {
  document.querySelectorAll('.mg-pop').forEach(e => e.remove());
  const pop = h('div', 'mg-pop');
  for (const l of c.lines) pop.append(h('div', `mg-line ${l.kind}`, l.text));
  if (!c.lines.length) pop.append(h('div', 'mg-line', summary(c)));
  document.body.append(pop);
  const r = from.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
  pop.style.top = `${Math.min(r.bottom + 4, window.innerHeight - pop.offsetHeight - 8)}px`;
}

/** The verse opened in the margin: its words, its notes, the notes on the passage around it, then one line of counts. A chapter
 *  (`v` 0) opens its own notes. Where the panel sits never covers the verse it is about. */
export async function openVerse(code: string, chapter: number, v: number) {
  close();
  const place = v ? `${code} ${chapter}:${v}` : `${code} ${chapter}`;
  let data: any;
  try { data = await wb(['margin', place]); } catch (e) { toast(String(e)); return; }
  const box = h('aside', 'mg-panel');
  box.setAttribute('role', 'complementary');
  box.setAttribute('aria-label', `${data.place || data.label} in the margin`);
  panel = box;
  const head = h('div', 'mg-head');
  head.append(h('b', '', data.place || data.label));
  const x = h('button', 'mg-close', '×');
  x.setAttribute('aria-label', 'Close the margin');
  x.onclick = close;
  head.append(x);
  box.append(head);
  if (v) {
    box.append(h('p', 'mg-verse', data.text));
    const notes = h('div', 'mg-notes');
    box.append(notes);
    const draw = (d: any) => {
      notes.replaceChildren();
      const years = new Set((d.notes as MNote[]).map(n => n.year));
      let lastYear = '';
      for (const n of d.notes as MNote[]) {
        if (years.size > 1 && n.year !== lastYear) { notes.append(h('div', 'mg-year', n.year)); lastYear = n.year; }
        notes.append(noteRow(n, () => refresh()));
      }
      for (const n of d.legacy || []) {
        const r = h('div', 'mg-note legacy');
        const a = h('button', 'mg-open', n.first_line);
        a.onclick = () => openPage(n.page);
        r.append(a);
        notes.append(r);
      }
      for (const n of d.around as MNote[]) {
        const r = h('div', 'mg-note around');
        r.append(h('span', 'mg-where', n.label), document.createTextNode(` ${n.first_line}`));
        notes.append(r);
      }
    };
    draw(data);
    box.append(countsLine(data, () => refresh()));
    const lists = h('div', 'mg-lists');
    box.append(lists);
    (box as any)._lists = lists;
    const refresh = async () => {
      const d = await wb(['margin', place]);
      draw(d);
      box.querySelector('.mg-counts')?.replaceWith(countsLine(d, () => refresh()));
      await redraw();
    };
    box.append(writer(place, async () => { await refresh(); }));
  } else {
    const notes = h('div', 'mg-notes');
    for (const n of data.notes as MNote[]) notes.append(noteRow(n, async () => { current.data = null; await redraw(); await openVerse(code, chapter, 0); }));
    box.append(notes, writer(place, async () => { current.data = null; await redraw(); await openVerse(code, chapter, 0); }));
  }
  document.getElementById('overlay')!.append(box);
  position(box, v);
}

/** Beside the reader when there is room; otherwise over the half of the window the verse is not in. */
function position(box: HTMLElement, v: number) {
  const vn = host?.reader.querySelector<HTMLElement>(`.vn[data-v="${v}"]`);
  const r = vn?.getBoundingClientRect();
  const narrow = window.innerWidth < 600;
  box.classList.toggle('mg-sheet', narrow);
  if (narrow || !r) return;
  const mid = (window.innerHeight + 60) / 2;
  const onTop = r.top < mid;
  box.style.top = onTop ? '' : '64px';
  box.style.bottom = onTop ? '12px' : '';
  const free = box.getBoundingClientRect();
  if (r.top < free.bottom + 4 && r.bottom > free.top - 4) {
    // still touching the verse: bring the verse into the other half
    host!.scroller.scrollTop += onTop ? r.top - 120 : r.top - (window.innerHeight - 220);
  }
}

async function redraw() {
  if (!host || !current.code) return;
  try { current.data = await wb(['margin', `${current.code} ${current.chapter}`]); } catch { /* keeps what it had */ }
  place();
}

function noteRow(n: MNote, done: () => void): HTMLElement {
  const row = h('div', `mg-note${n.question ? ' question' : ''}${n.done ? ' answered' : ''}`);
  row.dataset.id = n.id;
  const text = h('div', 'mg-text', n.question ? n.first_line : n.text);
  text.contentEditable = 'true';
  text.spellcheck = true;
  text.onblur = async () => {
    const t = text.innerText.trim();
    if (!t || t === (n.question ? n.first_line : n.text)) return;
    try { await wb(['margin', 'edit', n.id, t]); n.text = t; } catch (e) { toast(String(e)); }
  };
  const meta = h('div', 'mg-meta');
  meta.append(h('span', 'mg-date', n.written));
  const more = h('button', 'mg-more', '⋯');
  more.setAttribute('aria-label', 'This margin note');
  more.onclick = () => menu(more, n, done);
  meta.append(more);
  row.append(text, meta);
  for (const g of n.grew) {
    const a = h('button', 'mg-grew', `grew into ${g.title}`);
    a.onclick = () => openPage(g.id);
    row.append(a);
  }
  return row;
}

/** The note's menu: these four and nothing else (M32). */
function menu(from: HTMLElement, n: MNote, done: () => void) {
  const box = h('div', 'menu-list');
  const item = (label: string, run: () => Promise<void>) => {
    const b = h('button', 'menu-item', label);
    b.onclick = async () => { closeMenuNow(); try { await run(); } catch (e) { toast(String(e)); } };
    box.append(b);
  };
  item('Grow into a page', async () => {
    const r = await wb(['margin', 'grow', n.id]);
    toast(`Grew into ${r.title}`);
    openPage(r.page);
    done();
  });
  item('Add to a page…', async () => { addTo(from, n, done); });
  item(n.question ? 'Make it a note' : 'Make it a question', async () => { await wb(['margin', 'question', n.id, ...(n.question ? ['--off'] : [])]); done(); });
  item('Delete', async () => { await wb(['margin', 'rm', n.id]); toast('Margin note deleted'); done(); });
  const closeMenuNow = popMenu(from, box, { align: 'right', width: 220 });
}

/** Add to a page…: pages that already name the verse first, then the pages written in last, then a search. */
async function addTo(from: HTMLElement, n: MNote, done: () => void) {
  const box = h('div', 'menu-list mg-targets');
  const search = h('input', 'mg-search') as HTMLInputElement;
  search.placeholder = 'Search pages';
  box.append(search);
  const list = h('div', 'mg-target-list');
  box.append(list);
  const show = async (words: string) => {
    const t = await wb(['margin', 'targets', n.id, ...(words ? [words] : [])]);
    list.replaceChildren();
    const group = (label: string, rows: any[]) => {
      if (!rows.length) return;
      list.append(h('div', 'label', label));
      for (const p of rows) {
        const b = h('button', 'menu-item', p.title);
        b.dataset.id = p.id;
        b.onclick = async () => { closeIt(); try { await wb(['margin', 'grow', n.id, '--into', p.id]); toast(`Added to ${p.title}`); done(); } catch (e) { toast(String(e)); } };
        list.append(b);
      }
    };
    group('Pages that name this verse', t.naming);
    group('Written in last', t.recent);
    group('Search', t.search);
  };
  search.oninput = () => void show(search.value.trim());
  const closeIt = popMenu(from, box, { align: 'right', width: 280 });
  await show('');
  search.focus();
}

/** The one line of counts: pages that name the verse, saves, marks, notes on the passage around it. Each opens its list in place. */
function countsLine(d: any, refresh: () => void): HTMLElement {
  const line = h('div', 'mg-counts');
  const c = d.counts;
  const mk = (n: number, word: string, plural_: string, open: () => void) => {
    if (!n) return;
    const b = h('button', 'mg-count', `${n} ${n === 1 ? word : plural_}`);
    b.onclick = open;
    line.append(b);
  };
  const lists = () => document.querySelector<HTMLElement>('.mg-panel .mg-lists')!;
  mk(c.pages, 'page', 'pages', () => pagesList(d, lists(), refresh));
  mk(c.saves, 'save', 'saves', () => lists().replaceChildren(h('div', 'mg-list-note', `${plural(c.saves, 'save')} at this verse. Open the Library to see them.`)));
  mk(c.marks, 'mark', 'marks', () => lists().replaceChildren(h('div', 'mg-list-note', `${plural(c.marks, 'mark')} on these words: highlights, the pencil, threads.`)));
  mk(c.around, 'note on the passage', 'notes on the passage', () => {
    const l = lists();
    l.replaceChildren(...(d.around as MNote[]).map(n => { const r = h('div', 'mg-note around'); r.append(h('span', 'mg-where', n.label), document.createTextNode(` ${n.first_line}`)); return r; }));
  });
  return line;
}

function pagesList(d: any, into: HTMLElement, refresh: () => void) {
  into.replaceChildren();
  const row = (p: any) => {
    const b = h('button', 'mg-page', p.title);
    b.dataset.id = p.id;
    b.onclick = () => openPage(p.id);
    return b;
  };
  if (d.groups?.length) {
    // past 20, grouped by folder (M37)
    for (const g of d.groups) {
      const det = h('details', 'mg-group');
      det.append(h('summary', '', `${g.folder || 'No folder'} · ${g.count}`));
      for (const p of g.pages) det.append(row(p));
      into.append(det);
    }
  } else {
    for (const p of d.pages) into.append(row(p));
  }
  if (d.pages_total > d.pages.length) {
    const all = h('button', 'mg-showall', `Show all ${d.pages_total}`);
    all.onclick = async () => { const full = await wb(['margin', d.anchor.replace(/^(\w+)\.(\d+):(\d+)$/, '$1 $2:$3'), '--all']); pagesList(full, into, refresh); };
    into.append(all);
  }
  void refresh;
}

/** Writing in the margin asks where (M27): Leave in the margin, or Add to a new page; Remember my choice. */
function writer(place: string, done: () => Promise<void>): HTMLElement {
  const box = h('div', 'mg-write');
  const field = h('input', 'mg-field') as HTMLInputElement;
  field.placeholder = 'Write in the margin';
  field.setAttribute('aria-label', 'Write in the margin');
  const ask = h('div', 'mg-ask');
  ask.hidden = true;
  const leave = h('button', 'mg-leave', 'Leave in the margin');
  const page = h('button', 'mg-page-new', 'Add to a new page');
  const remember = h('label', 'mg-remember');
  const tick = h('input') as HTMLInputElement;
  tick.type = 'checkbox';
  remember.append(tick, document.createTextNode(' Remember my choice'));
  ask.append(leave, page, remember);
  const write = async (where: 'margin' | 'page') => {
    const text = field.value.trim();
    if (!text) return;
    try {
      if (tick.checked) await wb(['settings', 'margin', 'write_choice', where]);
      if (where === 'page') {
        const p = await wb(['margin', 'add', place, text, '--page']);
        field.value = '';
        ask.hidden = true;
        openPage(p.id);
      } else {
        await wb(['margin', 'add', place, text]);
        field.value = '';
        ask.hidden = true;
        toast('Left in the margin');
      }
      await done();
    } catch (e) { toast(String(e)); }
  };
  leave.onclick = () => void write('margin');
  page.onclick = () => void write('page');
  field.onkeydown = async e => {
    if (e.key !== 'Enter' || !field.value.trim()) return;
    e.preventDefault();
    let choice = '';
    try { choice = (await wb(['settings', 'margin'])).write_choice || ''; } catch { /* asks */ }
    if (choice === 'margin' || choice === 'page') void write(choice);
    else { ask.hidden = false; leave.focus(); }
  };
  box.append(field, ask);
  return box;
}
