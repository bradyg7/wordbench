// A page written block by block (W3 of "The Notebook as a workspace", sheet W2; the person's decisions of 2026-11-07:
// block by block, each list item its own block). Each block is drawn as it reads; a click edits that block's Markdown in
// place, and only that block. Enter at a block's end starts a new one (a list goes on as a list); Backspace in an empty
// block removes it; ↑ at a block's start and ↓ at its end go to the block before or after; Esc ends the writing. `/` in
// an empty block opens the block menu. A block is dragged by its grip. Every change is a `wb block …` command: the
// splitting into blocks and the lines around them are wb-core's (pages.rs), never this file's.
import { wb } from './api';
import { app, here } from './app';
import { toast } from './sheets';
import { button, h, icon, placePill, popMenu, type Found } from './ui';
import { drawVerses, openSplit, type MarkedVerse } from './verses';

export interface Blk { n: number; kind: string; text: string; start: number; end: number; level?: number; checked?: boolean; lang?: string; indent?: number }
export interface Blocks { id: string; title: { text: string; start: number; end: number } | null; blocks: Blk[] }
export interface LinkAt { start: number; end: number }

/** What the Notebook lends the blocks: drawing Markdown, the [[link]] list, and redrawing after a change. */
export interface Host {
  render(text: string, refs: Found[], links: any[]): DocumentFragment;
  refs: Found[];
  links: any[];
  linkSuggest(ta: HTMLTextAreaElement): void;
  maybeSuggest(ta: HTMLTextAreaElement): void;
  suggestKey(ev: KeyboardEvent): boolean;
  /** Ctrl+B, Ctrl+I and the like, as in the whole-text box; true when the key was used. */
  formatKey(ev: KeyboardEvent, ta: HTMLTextAreaElement): boolean;
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
}

/** Which block to start writing in once the page is drawn again: its number (from 1) and where the cursor goes. */
export let focusBlock: { n: number; at: 'start' | 'end' } | { after: number; text: string } | null = null;
export const setFocusBlock = (f: typeof focusBlock) => { focusBlock = f; };

/** Is this block's writing nothing but a list's mark ("- ", "- [ ] ", "2. ")? */
const blank = (t: string) => !t.replace(/^\s*([-*+]|\d+[.)])(\s+\[[ xX]\])?\s*/, '').trim();

/** What a new block after this one starts with: a list goes on as a list. */
function goesOn(text: string): string {
  const last = text.split('\n').filter(l => l.trim()).pop() || '';
  const m = /^(\s*)([-*+])\s+\[[ xX]\]\s/.exec(last) || /^(\s*)([-*+])\s/.exec(last);
  if (m) return `${m[1]}${m[2]} ${/\[[ xX]\]/.test(last.slice(0, m[0].length + 1)) ? '[ ] ' : ''}`;
  const k = /^(\s*)(\d+)([.)])\s/.exec(last);
  if (k) return `${k[1]}${Number(k[2]) + 1}${k[3]} `;
  return '';
}

// ---- drawing ------------------------------------------------------------------------------------------------------------

/** The page's blocks, each drawn as it reads, with a grip to drag it; and a line under them to write a new one. */
export function drawBlocks(data: Blocks, host: Host): HTMLElement {
  const wrap = h('div', 'nb-page nb-blocks');
  wrap.dataset.id = data.id;
  scriptureNow = data.blocks.some(isScripture) ? { id: data.id, got: wb(['page', 'scripture', data.id]) } : null;
  scriptureNow?.got.catch(() => {});
  viewsNow = data.blocks.some(isView) ? { id: data.id, got: wb(['page', 'views', data.id]) } : null;
  viewsNow?.got.catch(() => {});
  for (const b of data.blocks) wrap.append(blockEl(data, b, host));
  const add = h('div', 'nb-block-add muted', data.blocks.length ? 'Write here, or type / for a block' : 'Write the page here, or type / for a block');
  add.onclick = () => startNew(data, host, add, data.blocks.length ? data.blocks[data.blocks.length - 1].n : 0, '');
  wrap.append(add);
  return wrap;
}

function shifted<T extends { start: number; end: number }>(xs: T[], a: number, b: number): T[] {
  return xs.filter(x => x.start >= a && x.end <= b).map(x => ({ ...x, start: x.start - a, end: x.end - a }));
}

function blockEl(data: Blocks, b: Blk, host: Host): HTMLElement {
  const el = h('div', `nb-block nb-b-${b.kind}`);
  el.dataset.n = String(b.n);
  const grip = h('button', 'nb-grip');
  grip.append(icon('grip'));
  grip.title = 'Drag to move this block';
  grip.setAttribute('aria-label', `Move block ${b.n}`);
  grip.draggable = true;
  grip.ondragstart = ev => { ev.dataTransfer!.setData('text/wb-block', `${data.id} ${b.n}`); ev.dataTransfer!.effectAllowed = 'move'; el.classList.add('dragging'); };
  grip.ondragend = () => el.classList.remove('dragging');
  const body = h('div', 'nb-block-body');
  body.append(drawn(b, host, data.id));
  body.onclick = ev => {
    const t = ev.target as HTMLElement;
    if (t.closest('a, input, button')) return;
    startEdit(data, b, el, host, 'end');
  };
  el.append(grip, body);
  // a block dropped on another goes before it (the upper half) or after it (the lower half)
  el.ondragover = ev => {
    if (!ev.dataTransfer?.types.includes('text/wb-block')) return;
    ev.preventDefault();
    const r = el.getBoundingClientRect();
    const before = ev.clientY < r.top + r.height / 2;
    el.classList.toggle('drop-before', before);
    el.classList.toggle('drop-after', !before);
  };
  el.ondragleave = () => el.classList.remove('drop-before', 'drop-after');
  el.ondrop = async ev => {
    const got = ev.dataTransfer?.getData('text/wb-block');
    const before = el.classList.contains('drop-before');
    el.classList.remove('drop-before', 'drop-after');
    if (!got) return;
    ev.preventDefault();
    const [id, n] = got.split(' ');
    if (id !== data.id) return;
    const to = before ? b.n : b.n + 1;
    try {
      const last = to > data.blocks.length;
      await wb(['block', 'move', data.id, n, ...(last ? ['--last'] : ['--to', String(to)])]);
      host.changed();
    } catch (x) { toast(String(x)); }
  };
  return el;
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

/** A pipe table as a table (the first row its head; a row of dashes under it is the line between). */
function table(text: string): HTMLElement {
  const t = h('table', 'nb-table');
  const rows = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
  const cells = (l: string) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
  rows.forEach((l, i) => {
    if (i === 1 && /^\|?[\s:|-]+\|?$/.test(l)) return;
    const tr = h('tr');
    for (const c of cells(l)) tr.append(h(i === 0 ? 'th' : 'td', '', c));
    t.append(tr);
  });
  return t;
}

/** A page's scripture blocks with their verses (`wb page scripture`), asked for once each time the page is drawn. */
let scriptureNow: { id: string; got: Promise<any> } | null = null;
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
  const isLines = lines.includes('lines'), isYlt = lines.includes('ylt');
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
  head.append(seg, ylt);
  if (ref) head.append(openSplit('Open', ref, () => label.textContent || ref, () => (isYlt ? 'YLT' : undefined), 'sv-open'));
  const text = h('div', 'sv-body muted small', ref ? 'Reading the verses…' : 'No reference yet: click here and write one under ```scripture.');
  box.append(head, text);
  if (ref && scriptureNow?.id === id) {
    void scriptureNow.got.then(d => {
      const mine = (d?.blocks || []).find((x: any) => x.n === b.n);
      if (!mine) return;
      if (mine.error) { text.textContent = mine.error; return; }
      label.textContent = mine.label;
      text.replaceWith(drawVerses(mine.verses as MarkedVerse[], !!mine.lines));
    }).catch(x => { text.textContent = String(x); });
  }
  return box;
}

/** A page's views with what each finds (`wb page views`), asked for once each time the page is drawn. */
let viewsNow: { id: string; got: Promise<any> } | null = null;
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
    const i = h('input', 'field nbv-input') as HTMLInputElement;
    i.value = line || 'notebook ';
    i.setAttribute('aria-label', 'The view’s line');
    lineBtn.replaceWith(i);
    i.focus();
    i.setSelectionRange(i.value.length, i.value.length);
    let over = false;
    const end = async (keep: boolean) => {
      if (over) return;
      over = true;
      const v = i.value.trim();
      if (keep && v && v !== line) {
        try {
          const n = await blockNow(id, b);
          if (!n) { toast('The page changed; try again'); return host.redraw(); }
          await wb(['block', 'view', id, String(n), v]);
          host.changed();
          return;
        } catch (x) { toast(String(x)); }
      }
      host.redraw();
    };
    i.onkeydown = e2 => {
      if (e2.key === 'Enter') { e2.preventDefault(); void end(true); }
      else if (e2.key === 'Escape') { e2.preventDefault(); e2.stopPropagation(); void end(false); }
    };
    i.onblur = () => void end(true);
  };
  if (line && viewsNow?.id === id) {
    void viewsNow.got.then(d => {
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
const MENU: { key: string; label: string; what: string; ico: string; write: string; caret?: number }[] = [
  { key: 'scripture', label: 'Scripture', what: 'A passage, drawn from the Bible', ico: 'book', write: '' },
  { key: 'heading', label: 'Heading', what: '# A heading', ico: 'prompt', write: '# ' },
  { key: 'list', label: 'List', what: '- an item', ico: 'shelf', write: '- ' },
  { key: 'todo', label: 'To-do', what: '- [ ] something to do', ico: 'check', write: '- [ ] ' },
  { key: 'quote', label: 'Quote', what: '> quoted words', ico: 'copy', write: '> ' },
  { key: 'divider', label: 'Divider', what: 'A line across the page', ico: 'minus', write: '---' },
  { key: 'table', label: 'Table', what: 'Rows and columns', ico: 'filter', write: '| Column | Column |\n| --- | --- |\n|  |  |', caret: 2 },
  { key: 'link', label: 'Link to a page', what: '[[a page’s title]]', ico: 'notebook', write: '[[' },
  { key: 'inside', label: 'Page inside this one', what: 'A new page, with a link to it here', ico: 'notebook', write: '' },
  { key: 'view', label: 'View', what: 'A list kept up to date (a line of the command language)', ico: 'filter', write: '```view\nnotebook \n```', caret: 17 },
];

let menuKey: ((ev: KeyboardEvent) => boolean) | null = null;
let menuClose: (() => void) | null = null;

/** Write in a new block after block `after` (0: first, right under the title). */
function startNew(data: Blocks, host: Host, beforeEl: HTMLElement, after: number, text: string) {
  const el = h('div', 'nb-block nb-new-block');
  beforeEl.before(el);
  startEdit(data, { n: 0, kind: 'paragraph', text, start: 0, end: 0 }, el, host, 'end', after);
}

/** Write in a block: its Markdown in a box, saved as it is typed (`wb block set`; a new block, `wb block add`). */
function startEdit(data: Blocks, b: Blk, el: HTMLElement, host: Host, at: 'start' | 'end', newAfter?: number) {
  if (el.querySelector('textarea')) return;
  const ta = h('textarea', 'nb-input nb-block-input') as HTMLTextAreaElement;
  ta.value = b.text;
  ta.spellcheck = true;
  ta.rows = 1;
  ta.placeholder = 'Write, or type / for a block';
  el.classList.add('editing');
  const body = el.querySelector('.nb-block-body') || el;
  body.replaceChildren(ta);
  const fit = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; };
  // where this writing is in the page: blocks n .. n+count-1 (from 1), or not written yet (after block `after`)
  const cur = { n: newAfter === undefined ? b.n : 0, count: 1, after: newAfter ?? 0 };
  let last = newAfter === undefined ? b.text : '';
  let timer = 0;
  let saving: Promise<void> = Promise.resolve();
  let gone = false;
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
      const text = ta.value;
      // not while the / menu is open or a new page's name is asked for in the box
      if (text === last || blank(text) || text.startsWith('/') || ta.classList.contains('asking')) return;
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
  /** The writing ends: saved, an emptied block removed, the page drawn again (and `then` started, if given). */
  const finish = async (then?: typeof focusBlock) => {
    if (gone) return;
    gone = true;
    menuClose?.();
    await save();
    if (cur.n && (blank(ta.value) || !ta.value.trim())) {
      try { await findAgain(); if (cur.n) await wb(['block', 'rm', data.id, String(cur.n), '--count', String(cur.count)]); host.changed(); } catch (x) { toast(String(x)); }
    }
    focusBlock = then ?? null;
    // the box lets go of the cursor, so the page is drawn again (the Notebook leaves an editor being typed in alone)
    if (document.activeElement === ta) ta.blur();
    host.redraw();
  };
  ta.oninput = () => {
    fit();
    slashMenu(ta, data, host, cur, finish);
    if (host.template) blankMenu(ta);
    clearTimeout(timer);
    timer = window.setTimeout(save, 600);
    host.maybeSuggest(ta);
  };
  ta.onkeydown = ev => {
    if (menuKey?.(ev) || host.suggestKey(ev) || host.formatKey(ev, ta)) return;
    const atEnd = ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length;
    const atStart = ta.selectionStart === 0 && ta.selectionEnd === 0;
    const inFence = /^(```|~~~)/.test(ta.value) && ta.value.trim().split('\n').length < 2 + (/\n(```|~~~)\s*$/.test(ta.value) ? 1 : 0);
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); ta.blur(); return; }
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey && atEnd && !inFence && !ta.value.trim().startsWith('|') && !/^(```|~~~)/.test(ta.value)) {
      ev.preventDefault();
      // Enter in a list item with nothing in it ends the list; else a new block after this one
      if (ta.value.trim() && blank(ta.value)) { ta.value = ''; fit(); return; }
      if (!ta.value.trim()) return;
      const next = goesOn(ta.value);
      void finish().then(() => {}); // the writing is saved and the page drawn again; the new block opens after it
      focusBlock = null;
      pendingNew = { id: data.id, after: () => cur.n + cur.count - 1, text: next };
      return;
    }
    if (ev.key === 'Backspace' && !ta.value) {
      ev.preventDefault();
      const prev = (cur.n || cur.after + 1) - 1;
      void finish(prev >= 1 ? { n: prev, at: 'end' } : null);
      return;
    }
    if (ev.key === 'ArrowUp' && atStart && (cur.n || cur.after) > 1) {
      ev.preventDefault();
      void finish({ n: (cur.n || cur.after + 1) - 1, at: 'end' });
      return;
    }
    if (ev.key === 'ArrowDown' && atEnd) {
      const nextN = cur.n ? cur.n + cur.count : cur.after + 1;
      if (nextN <= data.blocks.length + (cur.n ? 0 : 1)) { ev.preventDefault(); void finish({ n: nextN, at: 'start' }); }
    }
  };
  ta.onblur = () => {
    // a click on the format bar, the block menu or a [[link]] list keeps the box
    setTimeout(() => { if (document.activeElement === ta || !ta.isConnected || gone) return; if (menuClose) return; void finish(); }, 150);
  };
  fit();
  ta.focus();
  const pos = at === 'start' ? 0 : ta.value.length;
  ta.setSelectionRange(pos, pos);
  if (ta.value) slashMenu(ta, data, host, cur, finish);
}

/** A new block waiting to be opened once the page is drawn again (after Enter at a block's end). */
let pendingNew: { id: string; after: () => number; text: string } | null = null;

/** After the page is drawn: start writing where Enter, Backspace or an arrow key asked. */
export function afterDrawn(root: HTMLElement, host: Host, data: Blocks | null) {
  if (!data) { pendingNew = null; focusBlock = null; return; }
  const wrap = root.querySelector<HTMLElement>('.nb-blocks');
  if (!wrap) return;
  if (pendingNew && pendingNew.id === data.id) {
    const p = pendingNew;
    pendingNew = null;
    const after = p.after();
    const next = wrap.querySelector<HTMLElement>(`.nb-block[data-n="${after + 1}"]`) || wrap.querySelector<HTMLElement>('.nb-block-add')!;
    startNew(data, host, next, after, p.text);
    return;
  }
  const f = focusBlock;
  focusBlock = null;
  if (!f) return;
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

/** `/` at the start of an empty block opens the block menu; what is typed after it narrows the menu. */
function slashMenu(ta: HTMLTextAreaElement, data: Blocks, host: Host, cur: { n: number; count: number; after: number }, finish: (then?: typeof focusBlock) => Promise<void>) {
  const v = ta.value;
  if (!v.startsWith('/') || v.includes('\n') || v.length > 30) { menuClose?.(); return; }
  const typed = v.slice(1).trim().toLowerCase();
  const hits = MENU.filter(m => !typed || m.label.toLowerCase().includes(typed) || m.key.startsWith(typed));
  menuClose?.();
  if (!hits.length) return;
  const box = h('div', 'nb-blockmenu');
  box.append(h('div', 'nb-blockmenu-head', 'Add a block · type to narrow it'));
  const rows: HTMLButtonElement[] = [];
  let on = 0;
  const mark = (i: number) => { rows[on]?.classList.remove('on'); on = Math.max(0, Math.min(rows.length - 1, i)); rows[on]?.classList.add('on'); rows[on]?.scrollIntoView({ block: 'nearest' }); };
  const choose = async (m: typeof MENU[number]) => {
    close();
    if (m.key === 'inside') return askInside(ta, host, cur, finish);
    if (m.key === 'scripture') {
      const at = app.picked ?? here();
      ta.value = `\`\`\`scripture\n${at.label}\n\`\`\``;
      ta.setSelectionRange(14, 14 + at.label.length);
    } else {
      ta.value = m.write;
      const c = m.caret ?? m.write.length;
      ta.setSelectionRange(c, c);
    }
    ta.focus();
    ta.dispatchEvent(new Event('input'));
    if (m.key === 'link') host.linkSuggest(ta);
    if (m.key === 'divider') {
      // a divider is whole as it is: saved, and the writing goes on in a new block under it
      await finish();
      pendingNew = { id: data.id, after: () => cur.n + cur.count - 1, text: '' };
      host.redraw();
    }
  };
  for (const m of hits) {
    const r = h('button', 'nb-blockmenu-row') as HTMLButtonElement;
    r.append(icon(m.ico));
    const t = h('div');
    t.append(h('div', 'nb-blockmenu-label', m.label), h('div', 'nb-blockmenu-what', m.what));
    r.append(t);
    r.dataset.key = m.key;
    r.onmousedown = ev => ev.preventDefault();
    r.onmousemove = () => { if (rows[on] !== r) mark(rows.indexOf(r)); };
    r.onclick = () => void choose(m);
    rows.push(r);
    box.append(r);
  }
  mark(0);
  const closeMenu = popMenu(ta, box, { width: 300 });
  const close = () => { closeMenu(); menuKey = null; if (menuClose === close) menuClose = null; };
  menuClose = close;
  menuKey = ev => {
    if (!box.isConnected) return false;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); mark(on + (ev.key === 'ArrowDown' ? 1 : -1)); return true; }
    if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); void choose(hits[on]); return true; }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); return true; }
    return false;
  };
}

/** The blanks a template can hold (W5, sheet W6.2): `{` typed in a template's block offers them. */
const BLANKS: { key: string; what: string; ico: string }[] = [
  { key: '{place}', what: 'The place picked', ico: 'pin' },
  { key: '{date}', what: 'The day it is made', ico: 'pen' },
  { key: '{title}', what: 'The new page’s name', ico: 'prompt' },
  { key: '{reader}', what: 'The chapter in the reader then', ico: 'book' },
];

function blankMenu(ta: HTMLTextAreaElement) {
  const at = ta.selectionStart;
  if (ta.selectionEnd !== at || ta.value[at - 1] !== '{' || ta.value.startsWith('/')) return;
  menuClose?.();
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
  const closeMenu = popMenu(ta, box, { width: 300 });
  const close = () => { closeMenu(); menuKey = null; if (menuClose === close) menuClose = null; };
  menuClose = close;
  menuKey = ev => {
    if (!box.isConnected) return false;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); mark(on + (ev.key === 'ArrowDown' ? 1 : -1)); return true; }
    if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); choose(BLANKS[on].key); return true; }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); return true; }
    if (ev.key.length === 1) { close(); return false; }
    return false;
  };
}

/** "Page inside this one": its name is asked for in the block; the new page's link takes the block's place. */
function askInside(ta: HTMLTextAreaElement, host: Host, cur: { n: number; count: number; after: number }, finish: (then?: typeof focusBlock) => Promise<void>) {
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
    await finish();
    try { await host.pageInside(title, after); } catch (x) { toast(String(x)); }
  };
  ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; };
}

/** The format bar writes into the block being written; with none, a new block at the page's end. */
export function startWritingAtEnd(root: HTMLElement, data: Blocks | null, host: Host) {
  const add = root.querySelector<HTMLElement>('.nb-blocks .nb-block-add');
  if (!add || !data) return;
  startNew(data, host, add, data.blocks.length ? data.blocks[data.blocks.length - 1].n : 0, '');
}

export const blockButton = button;
