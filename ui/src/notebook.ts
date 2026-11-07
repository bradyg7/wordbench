// The Notebook (phase 2b, design B: docs/phase2b-design.md section 7): a list and an editor, as in Apple Notes or
// Obsidian. The list has a search and its sections (W1 of "The Notebook as a workspace", 2026-11-07: they replace the
// Group control and the ⋯ menu's filters): Days (today's page first: one note per day, made the first time it is
// written in), Pages (the notes with no place yet: once the Inbox), Places (the chapter being read, following the
// reader), Threads, Questions, All, and the Trash. The open note is an editor:
// its title is its first line, places and threads are chips (+ Place, + Thread), and the format bar writes Markdown as
// plain text in the file. A place can be a verse, words, a run, a chapter or a book. `[[title]]` and `[[title#heading]]`
// link to another note; Linked from is under the note. Deleted notes wait in the Trash 7 days (or Erase now). Writing
// here never moves the reader. Quick capture (Ctrl+J): a small box at the verse last clicked.
import { wb } from './api';
import { app, book, goTo, here, type At } from './app';
import { dock, refCard, refHover, openThread, threadChooser } from './panes';
import type { Change, Pane } from './dock';
import { toast } from './sheets';
import { button, h, icon, placeGo, placePill, popMenu, type Found } from './ui';

/** What the list shows: a grouping (day, chapter, thread, none) or a section that is a filter (pages, questions). */
type Group = 'day' | 'chapter' | 'thread' | 'none' | 'pages' | 'questions';
/** The sections, in order: what each is called and the grouping it shows (the Trash is apart). */
const SECTIONS: [Group, string, string][] = [
  ['day', 'Days', 'Today’s page and every note by the day it was written'],
  ['pages', 'Pages', 'Notes with no place yet: pages of their own'],
  ['chapter', 'Places', 'Notes by place: the chapter you are reading, or every chapter'],
  ['thread', 'Threads', 'Notes by thread'],
  ['questions', 'Questions', 'Your questions, open and answered'],
  ['none', 'All', 'Every note, the most recently changed first'],
];

interface Link { start: number; end: number; title: string; heading: string; shown: string; to: string | null; kind: string | null; heading_ok: boolean }
interface Entry {
  id: string; kind: 'note' | 'question' | 'day'; placed: boolean; anchor: string; label: string; text: string; time: string; created: string; updated: string;
  title: string; preview: string; whole?: string; day?: string; today?: boolean; exists?: boolean;
  status?: string; refs?: Found[]; offer?: At | null;
  also?: At[]; threads?: { id: string; name: string }[];
  links?: Link[]; headings?: string[]; linked_from?: { id: string; title: string; kind: string; label: string; day: string; today: boolean }[];
}
interface GroupOf { key: string; label: string; count: number; today?: boolean; following?: boolean; entries: Entry[] }

export interface NotebookSettings { today: boolean; follow: boolean; links: boolean; chapters: boolean; group: Group; capture: string }
export const nbSettings: NotebookSettings = { today: true, follow: true, links: true, chapters: true, group: 'day', capture: 'Ctrl+J' };
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
function fold(key: string, shut: boolean) {
  if (shut) folded.add(key); else folded.delete(key);
  try { localStorage.setItem(FOLDED, JSON.stringify([...folded].slice(-300))); } catch { /* not kept: it still folds now */ }
}

/** The note open in the editor: its id, or a draft not saved yet (a place, a question, a day's page). */
let openId: string | null = null;
interface Draft { at: At | null; question: boolean; day?: string; text?: string; hint?: string }
let draft: Draft | null = null;
/** On a narrow pane the list and the editor take turns; true while the editor is shown. */
let editorShown = false;
/** Where to put the cursor once the editor is drawn: the end of the text, or a heading. */
let focusEditor: 'end' | { heading: string } | null = null;

export async function readSettings() {
  try { Object.assign(nbSettings, await wb(['settings', 'notebook'])); } catch { /* the defaults */ }
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

async function draw(el: HTMLElement) {
  const gen = ++drawing;
  if (!settingsRead) await readSettings();
  if (!group) group = nbSettings.group;
  let root = el.querySelector<HTMLElement>(':scope > .nb');
  if (!root) {
    root = h('div', 'nb');
    root.append(h('div', 'nb-list'), h('div', 'nb-editor'));
    el.replaceChildren(root);
    sized?.disconnect();
    sized = new ResizeObserver(() => root!.classList.toggle('two', root!.clientWidth >= 640));
    sized.observe(root);
    root.classList.toggle('two', el.clientWidth >= 640);
  }
  const listEl = root.querySelector<HTMLElement>('.nb-list')!, edEl = root.querySelector<HTMLElement>('.nb-editor')!;
  const [list, ed] = await Promise.all([showTrash ? trashList() : drawList(), drawEditor(edEl)]);
  if (gen !== drawing) return;
  const keep = listEl.querySelector<HTMLElement>('.nb-scroll')?.scrollTop ?? 0;
  const typing = listEl.contains(document.activeElement) && document.activeElement?.classList.contains('nb-find');
  listEl.replaceChildren(...list);
  const sc = listEl.querySelector<HTMLElement>('.nb-scroll');
  if (sc) sc.scrollTop = keep;
  if (typing) { const f = listEl.querySelector<HTMLInputElement>('.nb-find'); f?.focus(); f?.setSelectionRange(f.value.length, f.value.length); }
  if (ed) edEl.replaceChildren(...ed);
  root.classList.toggle('editing', editorShown && (!!openId || !!draft));
  if (ed) afterEditorDrawn(edEl);
}

/** The reader turned to another chapter: the list follows it when grouped by chapter. */
export function readerMoved() {
  if (pane && group === 'chapter' && nbSettings.follow && !showTrash) void pane.refresh?.();
}

function listArgs(): string[] {
  const a = ['notebook', '--group', group || 'day'];
  if (search.trim()) a.push('--search', search.trim());
  if (!nbSettings.today) a.push('--no-days');
  const d = app.drawn;
  if (group === 'chapter' && nbSettings.follow && d) a.push('--at', `${d.chapter.code} ${d.chapter.chapter}`);
  return a;
}

async function drawList(): Promise<HTMLElement[]> {
  const d = await wb(listArgs());
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
  const add = button('icon-btn nb-new', '', () => newNote(), 'pen');
  add.title = 'A new note';
  add.setAttribute('aria-label', 'A new note');
  const bin = button('icon-btn nb-trash-btn', '', () => { showTrash = true; editorShown = false; void pane?.refresh?.(); }, 'trash');
  bin.dataset.section = 'trash';
  bin.title = 'Trash: deleted notes wait here 7 days';
  bin.setAttribute('aria-label', 'Trash');
  const more = button('icon-btn nb-more', '', () => settingsMenu(more), 'more');
  more.title = 'Notebook settings';
  more.setAttribute('aria-label', 'Notebook settings');
  top.append(f, add, bin, more);
  const out: HTMLElement[] = [top, sectionsRow()];
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
  for (const g of d.groups as GroupOf[]) {
    const entries = g.entries;
    if (!entries.length && !(g.following)) continue;
    any = true;
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
  if (!any) scroll.append(h('p', 'muted nb-empty', search ? 'No note has all of these words.' : group === 'questions' ? 'No questions yet. Mark a note with ? to ask it.' : group === 'pages' ? 'No pages yet. The pen starts one; a note with no place is a page of its own.' : 'Nothing written yet. Ctrl+J writes a thought at the verse you clicked; the pen starts a note.'));
  out.push(scroll);
  return out;
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
  it.append(chips);
  it.onclick = () => openEntry(e);
  if (!e.placed && e.kind !== 'day') {
    // drag it onto a verse in the reader to give it that place
    it.draggable = true;
    it.title = 'Drag onto a verse to place it there';
    it.ondragstart = ev => { ev.dataTransfer!.setData('text/wb-jot', e.id); ev.dataTransfer!.effectAllowed = 'move'; it.classList.add('dragging'); };
    it.ondragend = () => it.classList.remove('dragging');
  }
  return it;
}

const sameAsOpen = (e: Entry) => (openId ? e.id === openId : !!draft?.day && e.kind === 'day' && e.day === draft.day && !e.exists);

/** Open a line of the list in the editor (today's page not written in yet opens as a blank page). */
function openEntry(e: Entry, at: typeof focusEditor = null) {
  if (e.kind === 'day' && !e.exists) { openId = null; draft = { at: null, question: false, day: e.day }; }
  else { openId = e.id; draft = null; }
  editorShown = true;
  focusEditor = at;
  showTrash = false;
  void pane?.refresh?.();
}

/** Open a note by its id (a link, Linked from, a search result elsewhere). */
export async function openNote(id: string, heading?: string) {
  openId = id;
  draft = null;
  editorShown = true;
  focusEditor = heading ? { heading } : null;
  showTrash = false;
  const p = openNotebook();
  await p.refresh?.();
}

function newNote(d: Draft = { at: null, question: false }) {
  openId = null;
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

// ---- the editor ---------------------------------------------------------------------------------------------------------

let shown: Entry | null = null;

async function drawEditor(edEl: HTMLElement): Promise<HTMLElement[] | null> {
  // while the person types, the editor is left as it is (the list still redraws beside it)
  if (edEl.contains(document.activeElement) && document.activeElement?.classList.contains('nb-input')) return null;
  if (!openId && !draft) {
    shown = null;
    return [h('p', 'muted nb-empty nb-pick', 'Pick a note in the list, or start one with the pen.')];
  }
  let e: Entry;
  if (openId) {
    try { e = await wb(['note', 'show', openId]); }
    catch { openId = null; shown = null; return [h('p', 'muted nb-empty nb-pick', 'That note is gone (deleted, or moved by another app).')]; }
  } else if (draft!.day) {
    e = await wb(['day', draft!.day]);
    if (e.exists) { openId = e.id; draft = null; }
  } else {
    e = { id: '', kind: draft!.question ? 'question' : 'note', placed: !!draft!.at, anchor: draft!.at?.anchor || '', label: draft!.at?.label || '', text: draft!.text || '', time: '', created: '', updated: '', title: '', preview: '', also: [], threads: [], links: [], headings: [], linked_from: [] };
  }
  shown = e;
  const out: HTMLElement[] = [];
  const back = button('link-btn nb-back', 'Notes', () => { editorShown = false; void pane?.refresh?.(); }, 'left');
  const head = h('div', 'nb-ed-head');
  head.append(back, h('span', 'grow'));
  if (e.kind === 'day') head.append(h('span', 'muted small', e.today ? 'today’s page' : 'a day’s page'));
  if (e.id) {
    const more = button('icon-btn small', '', () => editorMenu(more, e), 'more');
    more.setAttribute('aria-label', 'Change this note');
    head.append(more);
  }
  out.push(head);
  const title = h('h2', 'nb-title', e.kind === 'day' ? e.title : e.title || (draft?.question ? 'A new question' : 'A new note'));
  out.push(title);
  out.push(chipsRow(e));
  out.push(formatBar(e));
  out.push(page(e));
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
    chip.append(placeGo(draft.at.label, draft.at.anchor), x);
    row.append(chip);
  } else if (onThreadOnly) row.append(h('span', 'pill unplaced', e.label));
  else row.append(h('span', 'pill unplaced', 'No place yet'));
  for (const a of e.also || []) row.append(placeOff(e, a));
  for (const t of e.threads || []) {
    const chip = h('span', 'chip thread nb-thread-chip');
    chip.append(icon('threads', 12), button('link-btn', t.name, () => openThread(t.name)));
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
  if (e.kind !== 'day') {
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

const editText = () => pane?.el.querySelector<HTMLTextAreaElement>('.nb-editor textarea.nb-input') ?? (() => {
  const w = pane?.el.querySelector<HTMLElement>('.nb-editor .nb-body');
  if (w && shown) startEditing(w, shown);
  return pane?.el.querySelector<HTMLTextAreaElement>('.nb-editor textarea.nb-input') ?? null;
})();

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
    if (titleEl && e.kind !== 'day') titleEl.textContent = titleOf(ta.value) || (e.kind === 'question' ? 'A new question' : 'A new note');
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
    if (w && shown && !w.querySelector('textarea')) startEditing(w, shown);
  }
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
      a.onclick = ev => { ev.preventDefault(); void refCard(mk.r.ref, a, ev); };
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
    if (open < 0) return;
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

function editorMenu(from: HTMLElement, e: Entry) {
  const box = h('div', 'menu-list');
  const item = (label: string, fn: () => void) => box.append(button('menu-item', label, () => { close(); fn(); }));
  const onThreadOnly = e.placed && !e.anchor;
  if (e.kind !== 'day') {
    if (e.placed && !onThreadOnly) item('Move to another place…', () => placeMenu(from, e));
    if (!e.placed) item('Place it…', () => placeMenu(from, e));
    if (e.placed && !onThreadOnly) for (const a of [{ anchor: e.anchor, label: e.label }, ...(e.also || [])]) item(`Take it off ${a.label}`, () => takeOff(e.id, a));
    if (e.kind === 'question') item(e.status === 'done' ? 'Open it again' : 'Answered: mark it done', async () => { await wb(['note', 'answered', e.id, ...(e.status === 'done' ? ['--open'] : [])]); changed(); });
    if (!onThreadOnly) item(e.kind === 'question' ? 'Make it a plain note' : 'Make it a question', async () => { await wb(['note', 'question', e.id, ...(e.kind === 'question' ? ['--plain'] : [])]); changed(); });
  }
  item(e.kind === 'day' ? 'Delete this page (to the Trash)' : 'Delete (to the Trash)', () => remove(e));
  const close = popMenu(from, box, { align: 'right', width: 230 });
}

/** A note's place as a pill (a click goes there) with × to take it off: its first place too, the next then being its
 * place; its last place taken off makes it a page of its own (no place). */
function placeOff(e: Pick<Entry, 'id'>, at: At): HTMLElement {
  const chip = h('span', 'place-off');
  const x = button('member-x shown', '', () => takeOff(e.id, at), 'x');
  x.title = `Take it off ${at.label}`;
  x.setAttribute('aria-label', x.title);
  chip.append(placeGo(at.label, at.anchor), x);
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
  const what = e.kind === 'day' ? 'this page' : 'this note';
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
async function trashList(): Promise<HTMLElement[]> {
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
    const acts = h('div', 'nb-acts');
    acts.append(button('btn soft small', 'Put it back', async () => {
      try { await wb(['trash', 'restore', t.name]); toast('Put back'); changed(); } catch (x) { toast(String(x)); }
    }));
    // the only erase besides the 7 days (the person's decision, 2026-11-04), asked first
    acts.append(h('span', 'grow'), button('link-btn danger', 'Erase now', async () => {
      if (!confirm(`Erase this ${t.question ? 'question' : t.kind === 'day' ? 'page' : 'note'} now? It cannot be put back.`)) return;
      try { await wb(['trash', 'erase', t.name]); toast('Erased'); changed(); } catch (x) { toast(String(x)); }
    }, 'trash'));
    c.append(acts);
    scroll.append(c);
  }
  if (!d.notes.length) scroll.append(h('p', 'muted nb-empty', 'Nothing deleted.'));
  return [top, sectionsRow(), scroll];
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
  const k = h('form', 'nb-set-row');
  k.append(h('div', 'nb-set-label', 'Quick capture'));
  const key = h('input', 'field nb-set-key') as HTMLInputElement;
  key.value = nbSettings.capture;
  key.onchange = () => void save('capture', key.value);
  k.onsubmit = ev => { ev.preventDefault(); void save('capture', key.value); };
  k.append(key);
  box.append(k);
  popMenu(from, box, { align: 'right', width: 340 });
}

async function saveSetting(key: string, value: string) {
  try { Object.assign(nbSettings, await wb(['settings', 'notebook', key, value])); void pane?.refresh?.(); }
  catch (x) { toast(String(x)); }
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
      if (keep) await openNote(r.id).then(() => { focusEditor = 'end'; const w2 = pane?.el.querySelector<HTMLElement>('.nb-editor .nb-body'); if (w2 && shown) startEditing(w2, shown); });
      else toast(at ? `Written on ${at.label}` : 'Written as a page of its own (no place yet)');
    } catch (x) { toast(String(x)); }
  };
  input.focus();
}

/** Ctrl+J from before quick capture: kept for `wb do` and older callers. */
export const writeInNotebookNow = () => quickCapture();
