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
import { drawVerses, openSplit, type MarkedVerse } from './verses';
import { threadChooser } from './panes';

export interface Blk { n: number; kind: string; text: string; start: number; end: number; level?: number; checked?: boolean; lang?: string; indent?: number; question?: { done: boolean; text: string } }
export interface Blocks { id: string; title: { text: string; start: number; end: number } | null; blocks: Blk[] }
export interface LinkAt { start: number; end: number }

/** What the Notebook lends the blocks: drawing Markdown, the [[link]] list, and redrawing after a change. */
export interface Host {
  state: BlockEditorState;
  render(text: string, refs: Found[], links: any[]): DocumentFragment;
  text: string;
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
  questionPlaces?: { anchor: string; label: string }[];
}

/** Pending input belongs to one editor. Its data is refreshed separately on each draw. */
type BlockFocus = { n: number; at: 'start' | 'end' } | { after: number; text: string } | null;
type BlockData = { id: string; got: Promise<any> } | null;
export interface BlockEditorState {
  focus: BlockFocus;
  pending: { id: string; after: () => number; text: string } | null;
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
  undo: { token: string; n: number }[];
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

async function undoRemoval(wrap: HTMLElement, data: Blocks, host: Host) {
  const root = wrap.closest<HTMLElement>('.nb-editor');
  if (!root) return;
  const history = historyFor(root, data.id);
  const entry = history.undo.at(-1);
  if (!entry || history.busy) return;
  history.busy = true;
  try {
    await wb(['block', 'undo', data.id, '-'], entry.token);
    history.undo.pop();
    history.focus = entry.n;
    host.changed();
  } catch (x) { toast(String(x)); }
  finally { history.busy = false; }
}

async function removeBlock(wrap: HTMLElement, data: Blocks, host: Host, n: number, count = 1, expected?: string): Promise<boolean> {
  const root = wrap.closest<HTMLElement>('.nb-editor');
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

/** The Undo toast after a block is deleted (trash T9): 10 seconds, in the same rail as a page's. A block is part of
 *  its page, so it never goes to the Trash. */
function blockUndoToast(wrap: HTMLElement, data: Blocks, host: Host) {
  let rail = document.querySelector<HTMLElement>('.page-deletions');
  if (!rail) { rail = h('div', 'page-deletions'); rail.setAttribute('aria-label', 'Page deletion Undo'); document.body.append(rail); }
  rail.querySelectorAll('.block-deletion').forEach(x => x.remove());
  const row = h('div', 'page-deletion block-deletion');
  row.setAttribute('role', 'status');
  const undo = button('btn small', 'Undo', () => { row.remove(); void undoRemoval(wrap, data, host); });
  row.append(h('span', '', 'Block deleted. '), undo);
  rail.append(row);
  setTimeout(() => row.remove(), 10000);
}

/** Is this block's writing nothing but a list's mark ("- ", "- [ ] ", "2. ")? */
// A block with only its marker is empty: a list item or to-do, a quote (`>`), a heading (`#`). A divider (`---`) and a
// table are never empty; a lone `-` is an empty item, `---` is not.
const blank = (t: string) => !t.replace(/^\s*(([-*+]|\d+[.)])(\s+\[[ xX]\])?|(>\s*)+|#{1,6})(\s+|$)/, '').trim();

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
  host.state.scripture = data.blocks.some(isScripture) ? { id: data.id, got: wb(['page', 'scripture', data.id]) } : null;
  host.state.scripture?.got.catch(() => {});
  host.state.views = data.blocks.some(isView) ? { id: data.id, got: wb(['page', 'views', data.id]) } : null;
  host.state.views?.got.catch(() => {});
  host.state.threads = data.blocks.some(isThread) ? { id: data.id, got: wb(['page', 'threads', data.id]) } : null;
  host.state.threads?.got.catch(() => {});
  host.state.words = data.blocks.some(isWord) ? { id: data.id, got: wb(['page', 'words', data.id]) } : null;
  host.state.words?.got.catch(() => {});
  for (const b of data.blocks) wrap.append(blockEl(data, b, host));
  const add = h('button', 'link-btn nb-block-add muted', data.blocks.length ? 'Write here, or type / for a block' : 'Write the page here, or type / for a block');
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
  grip.title = 'Block actions · drag to move';
  grip.setAttribute('aria-label', `Actions for block ${b.n}`);
  grip.onclick = () => {
    const wrap = el.closest<HTMLElement>('.nb-blocks');
    if (!wrap || el.classList.contains('editing')) return;
    const menu = h('div', 'nb-block-actions');
    const item = (label: string, action: () => void) => menu.append(button('menu-item', label, () => { close(); action(); }));
    item('Edit block', () => editBlock(data, b, el, host));
    item('Add block below', () => startNew(data, host, el.nextElementSibling as HTMLElement, b.n, ''));
    const move = (to: number | null) => async () => {
      try { await wb(['block', 'move', data.id, String(b.n), ...(to === null ? ['--last'] : ['--to', String(to)])]); host.changed(); } catch (x) { toast(String(x)); }
    };
    if (b.n > 1) item('Move up', () => void move(b.n - 1)());
    if (b.n < data.blocks.length) item('Move down', () => void move(b.n + 1 >= data.blocks.length ? null : b.n + 2)());
    item('Delete block', () => void removeBlock(wrap, data, host, b.n, 1, host.text).then(ok => { if (ok) blockUndoToast(wrap, data, host); }));
    const close = popMenu(grip, menu);
    menu.querySelector('button')?.focus();
  };
  grip.draggable = true;
  grip.ondragstart = ev => { ev.dataTransfer!.setData('text/wb-block', `${data.id} ${b.n}`); ev.dataTransfer!.effectAllowed = 'move'; el.classList.add('dragging'); };
  grip.ondragend = () => el.classList.remove('dragging');
  const body = h('div', 'nb-block-body');
  body.append(drawn(b, host, data.id));
  if (isStructured(b)) body.append(button('link-btn small nb-edit-structured', b.kind === 'table' ? 'Edit table' : 'Edit card', () => editBlock(data, b, el, host), 'pen'));
  body.onclick = ev => {
    const t = ev.target as HTMLElement;
    if (t.closest('a, input, button, textarea, label, select, .nb-structured-editor')) return;
    editBlock(data, b, el, host);
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
  if (isThread(b)) return threadBlock(b, id, host);
  if (isWord(b)) return wordBlock(b, id, host);
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
  if (isStructured(b)) editStructured(data, b, el, host);
  else startEdit(data, b, el, host, 'end');
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
  const text = h('div', 'sv-body muted small', ref ? 'Reading the verses…' : 'No reference yet. Choose Edit card to enter one.');
  box.append(head, text);
  if (ref && host.state.scripture?.id === id) {
    void host.state.scripture.got.then(d => {
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
const MENU: { key: string; label: string; what: string; ico: string; write: string; caret?: number; alias?: string[] }[] = [
  { key: 'question', label: 'Question', what: 'Open until you answer it', ico: 'prompt', write: '> [!question] ', alias: ['?'] },
  { key: 'thread', label: 'Thread', what: 'A thread’s places, kept up to date', ico: 'threads', write: '', alias: ['~'] },
  { key: 'word', label: 'Word', what: 'A Strong’s entry from the lexicon', ico: 'search', write: '' },
  { key: 'scripture', label: 'Scripture', what: 'A passage, drawn from the Bible', ico: 'book', write: '' },
  { key: 'heading', label: 'Heading', what: '# A heading', ico: 'prompt', write: '# ' },
  { key: 'list', label: 'List', what: '- an item', ico: 'shelf', write: '- ' },
  { key: 'todo', label: 'To-do', what: '- [ ] something to do', ico: 'check', write: '- [ ] ' },
  { key: 'quote', label: 'Quote', what: '> quoted words', ico: 'copy', write: '> ' },
  { key: 'divider', label: 'Divider', what: 'A line across the page', ico: 'minus', write: '---' },
  { key: 'table', label: 'Table', what: 'Rows and columns', ico: 'filter', write: '| Column | Column |\n| --- | --- |\n|  |  |', caret: 2 },
  { key: 'link', label: 'Link to a page', what: '[[a page’s title]]', ico: 'notebook', write: '[[' },
  { key: 'inside', label: 'Page inside this one', what: 'A new page, with a link to it here', ico: 'notebook', write: '', alias: ['note', 'page'] },
  { key: 'view', label: 'View', what: 'A list kept up to date (a line of the command language)', ico: 'filter', write: '```view\nnotebook \n```', caret: 17 },
];


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
  // a line break inside the block: Shift+Enter (no button under the box, so no text moves: note 6ed1)
  const insertBreak = () => {
    const quoted = b.kind === 'quote' || ta.value.trimStart().startsWith('>');
    ta.setRangeText(quoted ? '\n> ' : '\n', ta.selectionStart, ta.selectionEnd, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  };
  body.replaceChildren(ta);
  const fit = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; };
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
  const finish = async (then?: BlockFocus) => {
    if (gone) return;
    gone = true;
    host.state.menuClose?.();
    await save();
    if (cur.n && (blank(ta.value) || !ta.value.trim())) {
      try {
        await findAgain();
        const wrap = el.closest<HTMLElement>('.nb-blocks');
        if (cur.n && wrap) await removeBlock(wrap, data, host, cur.n, cur.count, last === b.text ? host.text : undefined);
      } catch (x) { toast(String(x)); }
    }
    host.state.focus = then ?? null;
    // the box lets go of the cursor, so the page is drawn again (the Notebook leaves an editor being typed in alone)
    if (document.activeElement === ta) ta.blur();
    host.redraw();
  };
  registerPageWriter(ta, data.id, async () => {
    await save();
    if (ta.value !== last && ta.value.trim() && !blank(ta.value)) throw new Error('Save or cancel the current block before deleting its page.');
    await finish();
  }, () => { gone = true; clearTimeout(timer); ta.disabled = true; });
  ta.oninput = () => {
    fit();
    slashMenu(ta, data, host, cur, finish);
    if (host.template) blankMenu(ta, host);
    clearTimeout(timer);
    timer = window.setTimeout(save, 600);
    host.maybeSuggest(ta);
  };
  ta.onkeydown = ev => {
    if (host.state.menuKey?.(ev) || host.suggestKey(ev) || host.formatKey(ev, ta)) return;
    const atEnd = ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length;
    const atStart = ta.selectionStart === 0 && ta.selectionEnd === 0;
    const inFence = /^(```|~~~)/.test(ta.value) && ta.value.trim().split('\n').length < 2 + (/\n(```|~~~)\s*$/.test(ta.value) ? 1 : 0);
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); ta.blur(); return; }
    if (ev.key === 'Enter' && ev.shiftKey && !ev.isComposing) {
      ev.preventDefault();
      insertBreak();
      return;
    }
    if (ev.key === 'Enter' && !ev.isComposing && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey && atEnd && !inFence && !ta.value.trim().startsWith('|') && !/^(```|~~~)/.test(ta.value)) {
      ev.preventDefault();
      // Enter in a list item with nothing in it ends the list; else a new block after this one
      if (ta.value.trim() && blank(ta.value)) { ta.value = ''; fit(); return; }
      if (!ta.value.trim()) return;
      const next = goesOn(ta.value);
      void finish().then(() => {}); // the writing is saved and the page drawn again; the new block opens after it
      host.state.focus = null;
      host.state.pending = { id: data.id, after: () => cur.n + cur.count - 1, text: next };
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
    setTimeout(() => { if (document.activeElement === ta || !ta.isConnected || gone || ta.classList.contains('asking')) return; if (host.state.menuClose) return; void finish(); }, 150);
  };
  fit();
  ta.focus();
  const pos = at === 'start' ? 0 : ta.value.length;
  ta.setSelectionRange(pos, pos);
  if (ta.value) slashMenu(ta, data, host, cur, finish);
}

/** After the page is drawn: start writing where Enter, Backspace or an arrow key asked. */
export function afterDrawn(root: HTMLElement, state: BlockEditorState, host: Host | null, data: Blocks | null) {
  if (!data || !host) { state.pending = null; state.focus = null; blockHistory.delete(root); return; }
  const wrap = root.querySelector<HTMLElement>('.nb-blocks');
  if (!wrap) return;
  const history = historyFor(root, data.id);
  if (history.undo.length) {
    const undo = button('link-btn small nb-undo-block', 'Undo block deletion', () => void undoRemoval(wrap, data, host));
    wrap.prepend(undo);
    wrap.onkeydown = ev => {
      if ((!ev.ctrlKey && !ev.metaKey) || ev.shiftKey || ev.altKey || ev.key.toLowerCase() !== 'z') return;
      if ((ev.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
      ev.preventDefault();
      ev.stopPropagation();
      void undoRemoval(wrap, data, host);
    };
  }
  if (host.state.pending && host.state.pending.id === data.id) {
    const p = host.state.pending;
    host.state.pending = null;
    const after = p.after();
    const next = wrap.querySelector<HTMLElement>(`.nb-block[data-n="${after + 1}"]`) || wrap.querySelector<HTMLElement>('.nb-block-add')!;
    startNew(data, host, next, after, p.text);
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

/** `/` at the start of an empty block opens the block menu; what is typed after it narrows the menu. */
function slashMenu(ta: HTMLTextAreaElement, data: Blocks, host: Host, cur: { n: number; count: number; after: number }, finish: (then?: BlockFocus) => Promise<void>) {
  const v = ta.value;
  if (!v.startsWith('/') || v.includes('\n') || v.length > 30) { host.state.menuClose?.(); return; }
  const typed = v.slice(1).trim().toLowerCase();
  const hits = MENU.filter(m => !typed || m.label.toLowerCase().includes(typed) || m.key.startsWith(typed) || (m.alias || []).some(a => a.startsWith(typed)));
  host.state.menuClose?.();
  if (!hits.length) return;
  const box = h('div', 'nb-blockmenu');
  box.append(h('div', 'nb-blockmenu-head', 'Add a block · type to narrow it'));
  const rows: HTMLButtonElement[] = [];
  let on = 0;
  const mark = (i: number) => { rows[on]?.classList.remove('on'); on = Math.max(0, Math.min(rows.length - 1, i)); rows[on]?.classList.add('on'); rows[on]?.scrollIntoView({ block: 'nearest' }); };
  const choose = async (m: typeof MENU[number]) => {
    close();
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
    if (m.key === 'table' || m.key === 'scripture') {
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
      host.state.pending = { id: data.id, after: () => cur.n + cur.count - 1, text: '' };
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
  const close = popMenu(ta, box, { width: 300, onClose: () => {
    if (host.state.menuClose === close) { host.state.menuClose = null; host.state.menuKey = null; }
  } });
  host.state.menuClose = close;
  host.state.menuKey = ev => {
    if (!box.isConnected) return false;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); mark(on + (ev.key === 'ArrowDown' ? 1 : -1)); return true; }
    if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); void choose(hits[on]); return true; }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); return true; }
    return false;
  };
}

/** The blanks a template can hold (W5, sheet W6.2): `{` typed in a template's block offers them. */
export const BLANKS: { key: string; what: string; ico: string }[] = [
  { key: '{place}', what: 'The place picked', ico: 'pin' },
  { key: '{date}', what: 'The day it is made', ico: 'pen' },
  { key: '{title}', what: 'The new page’s name', ico: 'prompt' },
  { key: '{reader}', what: 'The chapter in the reader then', ico: 'book' },
];

function blankMenu(ta: HTMLTextAreaElement, host: Host) {
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

function askInside(ta: HTMLTextAreaElement, host: Host, cur: { n: number; count: number; after: number }, finish: (then?: BlockFocus) => Promise<void>) {
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
  ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; };
}

/** The format bar writes into the block being written; with none, a new block at the page's end. */
export function startWritingAtEnd(root: HTMLElement, data: Blocks | null, host: Host) {
  const add = root.querySelector<HTMLElement>('.nb-blocks .nb-block-add');
  if (!add || !data) return;
  startNew(data, host, add, data.blocks.length ? data.blocks[data.blocks.length - 1].n : 0, '');
}

export const blockButton = button;
