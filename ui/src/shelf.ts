// The Shelf as a tree (R2, docs/redesign-R2.md, sheets B1 to B5; the person chose the tree on 2026-11-09).
//
// A folder IS a set: each folder is a set file in sets/, holding its own items; where it sits in the tree is wb-core's
// (settings/shelf.json, `wb shelf`). Every change here is a `wb` command, so a terminal can do the same. Open all (finding
// a484) opens each item where its kind goes, from the keys `wb set open` gives: kept panes as their tabs, places as second
// readers (the reader never moves), a document in its preview, pages in their own editable tabs. The tabs it opened carry
// the folder's mark, and Close all closes them.

import { wb } from './api';
import { reopen, written } from './actions';
import type { Pane } from './dock';
import { dock } from './panes';
import { toast } from './sheets';
import { button, h, icon, popMenu, sizeClass } from './ui';
import { canonicalKey } from './layout-state';

const FOLDED = 'wb.shelf.folded.v1';
const MARKS = ['var(--thread-b)', 'var(--thread-a)', 'var(--question)', 'var(--accent)'];
const KIND_ICON: Record<string, string> = { pane: 'sidebar', thread: 'threads', place: 'pin', note: 'notebook', lesson: 'book', document: 'file', pdf: 'file' };

interface Item { key: string; kind: string; label: string; ref?: string; open?: string; why?: string; gone?: boolean; type?: string }
interface Folder { id: string; name: string; parent: string; depth: number; items: Item[]; folders: Folder[] }
type Sel = { folder: string; key?: string } | null;

let tree: Folder[] = [];
let selected: Sel = null;
let filter = '';
let renaming: string | null = null;
let paneEl: HTMLElement | null = null;
/** A row was clicked: the tree keeps the keys (F2, Del, Enter) after it is drawn again. */
let keepKeys = false;

function folded(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FOLDED) || '[]')); } catch { return new Set(); }
}
function setFolded(id: string, on: boolean) {
  const f = folded();
  if (on) f.add(id); else f.delete(id);
  try { localStorage.setItem(FOLDED, JSON.stringify([...f])); } catch { /* the fold is only a convenience */ }
}

/** A folder's mark colour, the same each time for the same folder. */
export function markColor(id: string) {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return MARKS[n % MARKS.length];
}

function every(list = tree): Folder[] {
  return list.flatMap(f => [f, ...every(f.folders)]);
}
const folderById = (id: string) => every().find(f => f.id === id);

/** The dock's key for the pane an item's open key makes (they differ for a thread's name and a document). */
function paneKey(open: string) {
  const [kind, a] = open.split('|');
  if (kind === 'doc') return `doc:${a}`;
  if (kind === 'thread') return `thread|${a.toLowerCase()}`;
  return canonicalKey(open);
}
const isOpen = (it: Item) => !!it.open && !!dock.find(paneKey(it.open));
const markedFor = (id: string) => dock.panes.filter(p => p.owners?.some(m => m.set === id));

async function waitFor(key: string, ms = 4000): Promise<Pane | undefined> {
  const end = performance.now() + ms;
  for (;;) {
    const p = dock.find(key);
    if (p || performance.now() > end) return p;
    await new Promise(r => setTimeout(r, 50));
  }
}

async function load() {
  tree = (await wb(['shelf'])).folders;
}

// ---- Open all, Close all ---------------------------------------------------------------------------------------------

/** Open everything a folder holds (deep: the folders inside it too). → what it did, in a sentence. */
export async function openAll(name: string, deep = false): Promise<string> {
  if (sizeClass() === 'compact') return 'Open items individually on this screen. Open all is available in a wider window.';
  if (!tree.length) await load();
  const plan = await wb(['set', 'open', name]);
  const sets = [plan];
  if (deep) for (const f of every(folderById(plan.id)?.folders ?? [])) sets.push(await wb(['set', 'open', f.id]));
  const shelf = dock.find('shelf');
  let opened = 0;
  let already = 0;
  const counted = new Set<string>();
  const why: string[] = [];
  for (const s of sets) {
    for (const it of s.items as Item[]) {
      if (!it.open) { why.push(`${it.label}: ${it.why}`); continue; }
      if (shelf) dock.from(shelf);
      const before = new Set(dock.panes);
      let p: Pane | undefined;
      try { p = await reopen(it.open) ?? await waitFor(paneKey(it.open)); }
      catch (x) { why.push(`${it.label}: ${String(x)}`); continue; }
      if (p) {
        const mark = { set: s.id, name: s.name, color: markColor(s.id) };
        if (!before.has(p)) p.owners = [mark];
        else if (p.owners?.length && !p.owners.some(m => m.set === s.id)) p.owners.push(mark);
        p.mark = p.owners?.[0];
        if (!counted.has(p.key)) { counted.add(p.key); if (before.has(p)) already++; else opened++; }
      }
    }
  }
  dock.layout();
  void redraw();
  const said = [`${plan.name}: ${opened} opened`];
  if (already) said.push(`${already} already open`);
  if (why.length) said.push(`${why.length} could not open (${why.slice(0, 2).join('; ')}${why.length > 2 ? '…' : ''})`);
  return said.join('; ');
}

/** Close the tabs a folder's Open all opened (deep: and its folders' too). */
export async function closeAll(name: string, deep = false): Promise<string> {
  const s = await wb(['set', 'show', name]);
  if (!tree.length) await load();
  const ids = new Set([s.id, ...(deep ? every(folderById(s.id)?.folders ?? []).map(f => f.id) : [])]);
  const ps = dock.panes.filter(p => p.owners?.some(m => ids.has(m.set)));
  let closed = 0, shared = 0, kept = 0;
  for (const p of ps) {
    const otherOwners = p.owners!.filter(m => !ids.has(m.set));
    if (!otherOwners.length) {
      if (await dock.close(p)) closed++;
      else kept++;
      continue;
    }
    p.owners = otherOwners;
    p.mark = otherOwners[0];
    shared++;
  }
  dock.layout();
  void redraw();
  return `${s.name}: ${closed} closed${shared ? `; ${shared} still used by another folder` : ''}${kept ? `; ${kept} kept open to preserve edits` : ''}`;
}

const run = (p: Promise<string>) => void p.then(toast, e => toast(String((e as Error).message || e)));

// ---- the pane ----------------------------------------------------------------------------------------------------------

export function openShelf() {
  dock.externalDrop = (x, y, pane) => {
    const row = document.elementsFromPoint(x, y).map(el => el.closest<HTMLElement>('.shelf-folder')).find(Boolean);
    const folder = row?.dataset.folder && folderById(row.dataset.folder);
    if (!row || !folder || pane.kind === 'shelf') return null;
    const r = row.getBoundingClientRect();
    return { label: `Keep in ${folder.name}`, box: { x: r.x, y: r.y, w: r.width, h: r.height }, drop: () => void addTabs(folder, [`${pane.key}\t${pane.title}`]) };
  };
  const p = dock.open('shelf', 'Shelf', 'shelf', 'right', async el => {
    paneEl = el;
    await load();
    draw();
  });
  dock.onMark = (pane, e) => {
    const m = pane.mark!;
    const body = h('div', 'shelf-menu');
    body.append(h('div', 'label', `${m.name} · ${markedFor(m.set).length} tabs open`),
      menuItem('Close the folder’s tabs', 'x', () => run(closeAll(m.set))),
      menuItem('Show it in the Shelf', 'shelf', () => { selected = { folder: m.set }; unfoldTo(m.set); openShelf(); void redraw(); }));
    close = popMenu(e.target as Element, body, { at: { x: e.clientX, y: e.clientY } });
  };
  return p;
}

let close: () => void = () => {};

async function redraw() {
  if (!paneEl || !dock.find('shelf')) return;
  await load();
  draw();
}

function unfoldTo(id: string) {
  for (let f = folderById(id); f; f = f.parent ? folderById(f.parent) : undefined) setFolded(f.id, false);
}

function menuItem(label: string, ico: string, act: () => void, sub?: string) {
  const b = button('menu-item', '', () => { close(); act(); }, ico);
  b.append(h('span', 'shelf-mi-label', label));
  if (sub) b.append(h('span', 'muted small shelf-mi-sub', sub));
  return b;
}

function matches(f: Folder): boolean {
  if (!filter) return true;
  return f.name.toLowerCase().includes(filter) || f.items.some(i => i.label.toLowerCase().includes(filter)) || f.folders.some(matches);
}

function draw() {
  const el = paneEl!;
  const keepFind = el.querySelector<HTMLInputElement>('.shelf-find');
  const caret = keepFind && document.activeElement === keepFind ? keepFind.selectionStart : null;
  el.replaceChildren();
  const head = h('header', 'pane-head shelf-head');
  head.append(h('h2', 'pane-title', 'Shelf'), button('icon-btn shelf-new', '', e => newFolder('', e.currentTarget as Element), 'plus'));
  head.lastElementChild!.setAttribute('aria-label', 'New folder');
  (head.lastElementChild as HTMLElement).title = 'New folder';
  const find = h('input', 'field shelf-find') as HTMLInputElement;
  find.placeholder = 'Find in the Shelf';
  find.value = filter;
  find.oninput = () => { filter = find.value.trim().toLowerCase(); draw(); };
  const list = h('div', 'shelf-tree');
  list.setAttribute('role', 'tree');
  list.tabIndex = 0;
  list.addEventListener('keydown', key);
  // dropped below the rows: a folder goes to the top
  list.addEventListener('dragover', e => { if (e.target === list && dragging?.folder && !dragging.key) e.preventDefault(); });
  list.addEventListener('drop', e => {
    if (e.target !== list || !dragging?.folder || dragging.key) return;
    e.preventDefault();
    void act(['shelf', 'move', dragging.folder]);
  });
  const shut = folded();
  const rows = (fs: Folder[]) => {
    for (const f of fs) {
      if (!matches(f)) continue;
      list.append(folderRow(f, filter ? false : shut.has(f.id)));
      if (filter || !shut.has(f.id)) {
        rows(f.folders);
        for (const it of f.items) if (!filter || it.label.toLowerCase().includes(filter) || f.name.toLowerCase().includes(filter)) list.append(itemRow(f, it));
      }
    }
  };
  rows(tree);
  if (!tree.length) list.append(h('p', 'muted small shelf-empty', 'Nothing on the Shelf yet. + makes a folder; a folder holds tabs, pages, places, threads, lessons and documents, and Open all opens them together.'));
  el.append(head, find, list);
  const sel = selected && folderById(selected.folder);
  if (sel) el.append(footer(sel));
  if (caret !== null) { find.focus(); find.setSelectionRange(caret, caret); }
  else if (keepKeys && !renaming) list.focus({ preventScroll: true });
  keepKeys = false;
}

function footer(f: Folder) {
  const ft = h('div', 'shelf-bar');
  const open = f.items.filter(isOpen).length;
  const top = h('div', 'shelf-bar-head');
  top.append(icon('folder'), h('span', 'shelf-bar-name', f.name), h('span', 'muted small', `${f.items.length} item${f.items.length === 1 ? '' : 's'}${open ? ` · ${open} open` : ''}`));
  const acts = h('div', 'shelf-bar-acts');
  acts.append(button('btn primary small shelf-open-all', 'Open all', () => run(openAll(f.id)), 'sidebar'),
    button('btn small shelf-close-all', 'Close all', () => run(closeAll(f.id)), 'x'),
    button('btn small shelf-add', 'Add', e => addMenu(e.currentTarget as Element, f), 'plus'));
  ft.append(top, acts);
  return ft;
}

// ---- rows --------------------------------------------------------------------------------------------------------------

function folderRow(f: Folder, shut: boolean) {
  const r = h('div', `shelf-row shelf-folder${selected?.folder === f.id && !selected.key ? ' on' : ''}`);
  r.setAttribute('role', 'treeitem');
  r.setAttribute('aria-expanded', String(!shut));
  r.dataset.folder = f.id;
  r.style.setProperty('--depth', String(f.depth));
  const fold = button(`shelf-fold${shut ? ' shut' : ''}`, '', e => { e.stopPropagation(); setFolded(f.id, !shut); draw(); }, 'down');
  fold.setAttribute('aria-label', shut ? 'Unfold' : 'Fold');
  r.append(fold, icon('folder'));
  if (renaming === f.id) r.append(renameBox(f));
  else r.append(h('span', 'shelf-name', f.name));
  const marked = markedFor(f.id).length;
  if (marked) {
    const d = h('span', 'shelf-mark');
    d.style.background = markColor(f.id);
    d.title = `${marked} of its tabs open`;
    r.append(d);
  }
  r.append(h('span', 'shelf-count', String(f.items.length + f.folders.length)));
  r.append(button('icon-btn shelf-more', '', e => { e.stopPropagation(); folderMenu(e.currentTarget as Element, f); }, 'more'));
  r.onclick = () => { selected = { folder: f.id }; setFolded(f.id, !shut); keepKeys = true; draw(); };
  r.ondblclick = e => { e.preventDefault(); if (sizeClass() !== 'compact') run(openAll(f.id)); };
  r.oncontextmenu = e => { e.preventDefault(); selected = { folder: f.id }; folderMenu(r, f, { x: e.clientX, y: e.clientY }); };
  dragRow(r, { folder: f.id }, f);
  return r;
}

function itemRow(f: Folder, it: Item) {
  const on = selected?.folder === f.id && selected.key === it.key;
  const r = h('div', `shelf-row shelf-item${on ? ' on' : ''}${it.open ? '' : ' cannot'}`);
  r.setAttribute('role', 'treeitem');
  r.dataset.folder = f.id;
  r.dataset.key = it.key;
  r.style.setProperty('--depth', String(f.depth + 1));
  r.append(h('span', 'shelf-fold none'), icon(KIND_ICON[it.kind] ?? 'file'), h('span', 'shelf-name', it.label));
  if (it.kind === 'document') r.append(h('span', 'muted small shelf-tag', /\.pdf$/i.test(it.open?.split('|')[2] ?? '') ? 'PDF' : 'Word'));
  if (it.kind === 'note') r.append(h('span', 'muted small shelf-tag', 'page'));
  if (isOpen(it)) r.append(h('span', 'shelf-live'));
  if (!it.open) r.title = it.why || '';
  const x = button('icon-btn shelf-x', '', e => { e.stopPropagation(); void act(['set', 'rm', f.id, it.key]); }, 'x');
  x.setAttribute('aria-label', `Take ${it.label} out of ${f.name}`);
  x.title = 'Take it out of the folder (it is not deleted)';
  r.append(x);
  const more = button('icon-btn shelf-more', '', e => {
    e.stopPropagation(); const box = more.getBoundingClientRect();
    itemMenu(more, f, it, { x: box.left, y: box.bottom });
  }, 'more');
  more.setAttribute('aria-label', `More for ${it.label}`);
  r.append(more);
  r.onclick = () => {
    selected = { folder: f.id, key: it.key };
    keepKeys = true;
    if (!it.open) { toast(it.why || 'It cannot be opened here.'); draw(); return; }
    void reopen(it.open).then(() => setTimeout(() => void redraw(), 300));
  };
  r.oncontextmenu = e => { e.preventDefault(); selected = { folder: f.id, key: it.key }; itemMenu(r, f, it, { x: e.clientX, y: e.clientY }); };
  dragRow(r, { folder: f.id, key: it.key }, f);
  return r;
}

function renameBox(f: Folder) {
  const i = h('input', 'field shelf-rename') as HTMLInputElement;
  i.value = f.name;
  const done = (keep: boolean) => {
    if (renaming !== f.id) return;
    renaming = null;
    const v = i.value.trim();
    if (keep && v && v !== f.name) void act(['set', 'rename', f.id, v]);
    else draw();
  };
  i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
  i.onblur = () => done(true);
  i.onclick = e => e.stopPropagation();
  setTimeout(() => { i.focus(); i.select(); });
  return i;
}

// ---- menus -------------------------------------------------------------------------------------------------------------

function folderMenu(from: Element, f: Folder, at?: { x: number; y: number }) {
  const body = h('div', 'shelf-menu');
  const open = markedFor(f.id).length;
  body.append(h('div', 'label', f.name),
    ...(sizeClass() !== 'compact' ? [menuItem('Open all', 'sidebar', () => run(openAll(f.id)), `its ${f.items.length} items, as tabs`)] : []),
    ...(f.folders.length && sizeClass() !== 'compact' ? [menuItem('Open all, folders inside too', 'sidebar', () => run(openAll(f.id, true)))] : []),
    menuItem('Close all', 'x', () => run(closeAll(f.id, true)), open ? `the ${open} tabs it opened` : 'none open'),
    menuItem('Add…', 'plus', () => addMenu(from, f), 'a tab, a page, a place…'),
    menuItem('New folder inside', 'folder', () => newFolder(f.id, from)),
    menuItem('Rename', 'pen', () => { renaming = f.id; draw(); }, 'F2'),
    menuItem('Move to…', 'right', () => moveMenu(from, f)),
    menuItem('Remove the folder', 'trash', () => void removeFolder(f), 'its items are not touched'));
  close = popMenu(from, body, { at, width: 280 });
}

function itemMenu(from: Element, f: Folder, it: Item, at: { x: number; y: number }) {
  const body = h('div', 'shelf-menu');
  body.append(h('div', 'label', it.label));
  if (it.open) body.append(menuItem('Open', 'sidebar', () => void reopen(it.open!)));
  if (it.kind === 'document') body.append(menuItem('Open in Word or the PDF viewer', 'file', () => void wb(['docs', 'open', it.ref!]).catch(e => toast(String(e.message || e)))));
  body.append(menuItem('Move to…', 'right', () => moveMenu(from, f, it)),
    menuItem('Also keep it in…', 'copy', () => moveMenu(from, f, it, true)),
    menuItem('Take it out of the folder', 'x', () => void act(['set', 'rm', f.id, it.key]), 'it is not deleted'));
  close = popMenu(from, body, { at, width: 280 });
}

/** Where to: every folder (and, for a folder, the top), indented. */
function moveMenu(from: Element, f: Folder, it?: Item, copy = false) {
  const body = h('div', 'shelf-menu');
  body.append(h('div', 'label', it ? `${copy ? 'Also keep' : 'Move'} ${it.label} in…` : `Move ${f.name} into…`));
  if (!it && f.parent) body.append(menuItem('The top of the Shelf', 'shelf', () => void act(['shelf', 'move', f.id])));
  const inside = new Set(it ? [] : [f.id, ...every(f.folders).map(x => x.id)]);
  for (const t of every()) {
    if (inside.has(t.id) || (it && t.id === f.id) || (!it && t.id === f.parent)) continue;
    const b = menuItem(t.name, 'folder', () => void act(it ? ['shelf', 'item', f.id, it.key, '--to', t.id, ...(copy ? ['--copy'] : [])] : ['shelf', 'move', f.id, '--in', t.id]));
    b.style.paddingLeft = `${10 + t.depth * 14}px`;
    body.append(b);
  }
  close = popMenu(from, body, { width: 280 });
}

/** + Add (SH1, B4): a tab, all open tabs, a new page, or a page, place, thread, lesson or document found by name. */
function addMenu(from: Element, f: Folder) {
  const tabs = dock.panes.filter(p => p.kind !== 'shelf');
  const body = h('div', 'shelf-menu');
  body.append(h('div', 'label', `Add to ${f.name}`),
    menuItem('A tab…', 'sidebar', () => choose(from, 'Which tab?', tabs.map(p => ({ label: p.title, sub: p.kind, value: `${p.key}\t${p.title}` })), v => addTabs(f, [v])), `${tabs.length} open`),
    menuItem('All open tabs', 'sidebar', () => addTabs(f, tabs.map(p => `${p.key}\t${p.title}`)), `${tabs.length} tabs`),
    menuItem('A new page in this folder', 'pen', () => void newPage(f), 'written in the Notebook'),
    menuItem('A page…', 'notebook', () => void pickPage(from, f), 'by its title'),
    menuItem('A place…', 'pin', () => askPlace(from, f), 'a verse, chapter or book'),
    menuItem('A thread…', 'threads', () => void pick(from, f, ['thread', 'list'], 'thread', (t: any) => ({ label: t.name, value: t.name }))),
    menuItem('A lesson…', 'book', () => void pick(from, f, ['lesson', 'list'], 'lesson', (t: any) => ({ label: t.title, value: t.id }))),
    menuItem('A document…', 'file', () => void pick(from, f, ['docs', 'list'], 'document', (d: any) => ({ label: d.name, sub: d.title, value: d.id })), 'a Word file or slides made here'),
    menuItem('A folder inside', 'folder', () => newFolder(f.id, from)));
  close = popMenu(from, body, { width: 300 });
}

/** A short list to pick from, with a filter at its head. */
function choose(from: Element, title: string, rows: { label: string; sub?: string; value: string }[], picked: (v: string) => void) {
  const body = h('div', 'shelf-menu shelf-choose');
  const q = h('input', 'field') as HTMLInputElement;
  q.placeholder = title;
  const list = h('div', 'shelf-choose-list');
  const fill = () => {
    list.replaceChildren();
    const w = q.value.trim().toLowerCase();
    const hits = rows.filter(r => !w || r.label.toLowerCase().includes(w));
    for (const r of hits.slice(0, 60)) list.append(menuItem(r.label, 'plus', () => picked(r.value), r.sub));
    if (!hits.length) list.append(h('p', 'muted small', 'Nothing by that name.'));
  };
  q.oninput = fill;
  q.onkeydown = e => { if (e.key === 'Enter') (list.querySelector('button') as HTMLButtonElement | null)?.click(); };
  fill();
  body.append(q, list);
  close = popMenu(from, body, { width: 320 });
  setTimeout(() => q.focus());
}

async function pick(from: Element, f: Folder, argv: string[], flag: string, row: (x: any) => { label: string; sub?: string; value: string }) {
  const all: any[] = await wb(argv);
  choose(from, `Which ${flag}?`, all.map(row), v => void act(['set', 'add', f.id, `--${flag}`, v]));
}

async function pickPage(from: Element, f: Folder) {
  const t = await wb(['page', 'tree']);
  const rows: { label: string; value: string }[] = [];
  const walk = (ps: any[]) => { for (const p of ps) { rows.push({ label: p.title || 'Untitled', value: p.id }); walk(p.children || []); } };
  walk(t.pages || []);
  choose(from, 'Which page?', rows, v => void act(['set', 'add', f.id, '--note', v]));
}

function askPlace(from: Element, f: Folder) {
  const body = h('form', 'shelf-menu shelf-place');
  const q = h('input', 'field') as HTMLInputElement;
  q.placeholder = 'Num 25:10-13, Ps 106, Ruth';
  body.append(q, button('btn primary small', 'Add', () => {}));
  body.onsubmit = e => { e.preventDefault(); const v = q.value.trim(); if (v) { close(); void act(['set', 'add', f.id, '--place', v]); } };
  close = popMenu(from, body, { width: 300 });
  setTimeout(() => q.focus());
}

async function addTabs(f: Folder, tabs: string[]) {
  let added = 0;
  const failed: string[] = [];
  for (const t of tabs) {
    try { await wb(['set', 'add', f.id, '--tab', t]); added++; } catch { failed.push(t.split('\t')[1] || t); }
  }
  written('sets');
  toast(`${added} added to ${f.name}${failed.length ? `; ${failed.length} cannot be kept in a set (${failed.slice(0, 3).join(', ')})` : ''}`);
}

async function newPage(f: Folder) {
  const p = await wb(['page', 'new', 'New page', '--json']);
  await act(['set', 'add', f.id, '--note', p.id]);
  await reopen(`note|${p.id}`);
}

/** A new folder, named first (its set file takes its name: sets/<the name>.md). */
function newFolder(parent: string, from?: Element) {
  const at = from ?? paneEl?.querySelector('.shelf-new') ?? document.body;
  const body = h('form', 'shelf-menu shelf-place shelf-name-new');
  const q = h('input', 'field') as HTMLInputElement;
  q.placeholder = parent ? `A folder inside ${folderById(parent)?.name ?? ''}` : 'Name the new folder';
  body.append(q, button('btn primary small', 'Make', () => {}));
  body.onsubmit = async e => {
    e.preventDefault();
    const name = q.value.trim();
    if (!name) return;
    close();
    try {
      const t = await wb(['shelf', 'new', name, ...(parent ? ['--in', parent] : [])]);
      if (parent) setFolded(parent, false);
      selected = { folder: t.id };
      written('sets');
    } catch (x) { toast(String((x as Error).message || x)); }
  };
  close = popMenu(at, body, { width: 300 });
  setTimeout(() => q.focus());
}

async function removeFolder(f: Folder) {
  const what = f.folders.length ? ` The ${f.folders.length} folder${f.folders.length === 1 ? '' : 's'} inside it move up a level.` : '';
  if (!confirm(`Remove the folder “${f.name}”? It goes to the Trash; the things in it are not touched.${what}`)) return;
  if (selected?.folder === f.id) selected = null;
  await act(['shelf', 'rm', f.id]);
}

/** Run a change, then draw the Shelf (and anything else showing sets) again. */
async function act(argv: string[]) {
  try { await wb(argv); } catch (e) { toast(String((e as Error).message || e)); }
  written('sets');
}

// ---- the keys, and dragging ------------------------------------------------------------------------------------------

function key(e: KeyboardEvent) {
  if (!selected || (e.target as HTMLElement).tagName === 'INPUT') return;
  const f = folderById(selected.folder);
  if (!f) return;
  const it = selected.key ? f.items.find(i => i.key === selected!.key) : undefined;
  if (e.key === 'F2' && !it) { e.preventDefault(); renaming = f.id; draw(); }
  else if (e.key === 'Delete') { e.preventDefault(); if (it) void act(['set', 'rm', f.id, it.key]); else void removeFolder(f); }
  else if (e.key === 'Enter') { e.preventDefault(); if (it?.open) void reopen(it.open); else if (!it) run(openAll(f.id)); }
}

let dragging: { folder: string; key?: string } | null = null;

/** A row dragged: onto a folder (its middle) goes inside it; onto a row's top half, before it; an item onto an item's
 * lower half, after it. Ctrl keeps an item in both folders (an item is a pointer, not a file). */
function dragRow(r: HTMLElement, me: { folder: string; key?: string }, f: Folder) {
  r.draggable = true;
  r.addEventListener('dragstart', e => {
    dragging = me;
    e.dataTransfer!.effectAllowed = 'copyMove';
    e.dataTransfer!.setData('text/plain', me.key ? f.items.find(i => i.key === me.key)?.label ?? '' : f.name);
    r.classList.add('dragging');
  });
  r.addEventListener('dragend', () => { dragging = null; r.classList.remove('dragging'); clearDrop(); });
  const zone = (e: DragEvent): 'before' | 'inside' | 'after' | null => {
    if (!dragging) return null;
    const box = r.getBoundingClientRect(), y = (e.clientY - box.top) / box.height;
    const isFolder = !r.dataset.key;
    if (dragging.key) return isFolder ? 'inside' : y < 0.5 ? 'before' : 'after';
    // a folder: never onto itself or a folder inside it, never among items
    if (!isFolder) return null;
    const moving = folderById(dragging.folder)!;
    if (r.dataset.folder === moving.id || every(moving.folders).some(x => x.id === r.dataset.folder)) return null;
    return y < 0.25 ? 'before' : 'inside';
  };
  r.addEventListener('dragover', e => {
    const z = zone(e);
    if (!z) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = e.ctrlKey && dragging?.key ? 'copy' : 'move';
    clearDrop();
    r.classList.add(`drop-${z}`);
  });
  r.addEventListener('dragleave', () => r.classList.remove('drop-before', 'drop-inside', 'drop-after'));
  r.addEventListener('drop', e => {
    const z = zone(e);
    const d = dragging;
    clearDrop();
    if (!z || !d) return;
    e.preventDefault();
    e.stopPropagation();
    const target = r.dataset.folder!, tkey = r.dataset.key;
    if (d.key) {
      const copy = e.ctrlKey ? ['--copy'] : [];
      if (z === 'inside') return void act(['shelf', 'item', d.folder, d.key, '--to', target, ...copy]);
      const items = folderById(target)!.items;
      const at = items.findIndex(i => i.key === tkey);
      const before = z === 'before' ? tkey : items[at + 1]?.key;
      if (before === d.key) return;
      return void act(['shelf', 'item', d.folder, d.key, '--to', target, ...(before ? ['--before', before] : []), ...copy]);
    }
    if (z === 'inside') { setFolded(target, false); return void act(['shelf', 'move', d.folder, '--in', target]); }
    const t = folderById(target)!;
    void act(['shelf', 'move', d.folder, ...(t.parent ? ['--in', t.parent] : []), '--before', target]);
  });
}

function clearDrop() {
  paneEl?.querySelectorAll('.drop-before, .drop-inside, .drop-after').forEach(x => x.classList.remove('drop-before', 'drop-inside', 'drop-after'));
}
