// The Notebook, docked on the right (docs/PLAN-design.md section 3): Journal (every note by day), Inbox (notes with no
// place yet, each with Place it…), All notes (placed notes in Bible order) and Trash (deleted notes, erased after 7 days
// unless put back). Questions are notes marked "?": trails once placed. A note may have more places than its first, and
// may be on threads (or on a thread alone, with no place in the text). A writing box sits at the bottom of the Journal; Enter adds, Shift+Enter is a new line. Writing here never
// moves the reader.
import { wb } from './api';
import { app, goTo, here, type At } from './app';
import { dock, refHover, openThread, threadChooser } from './panes';
import type { Pane } from './dock';
import { toast } from './sheets';
import { button, h, icon, linkedText, placePill, popMenu, type Found } from './ui';

type View = 'journal' | 'inbox' | 'all' | 'trash';
let view: View = 'journal';
let onlyQuestions = false;
let filter = '';
let pane: Pane | null = null;
let inboxCount = 0;
export const notebookBadge = { set: (_n: number) => {} };

interface Entry {
  id: string; kind: 'note' | 'question'; placed: boolean; anchor: string; label: string; text: string; time: string; created: string;
  status?: string; refs?: Found[]; offer?: At | null;
  also?: At[]; threads?: { id: string; name: string }[];
}

export function openNotebook(v?: View, opts: { questions?: boolean } = {}) {
  if (v) view = v;
  if (opts.questions !== undefined) onlyQuestions = opts.questions;
  const was = dock.find('notebook');
  pane = dock.open('notebook', 'Notebook', 'notebook', 'right', el => draw(el));
  pane.onClose = () => { pane = null; };
  if (was && (v || opts.questions !== undefined)) void pane.refresh?.();
  return pane;
}

export async function countInbox() {
  try {
    const d = await wb(['inbox']);
    inboxCount = d.notes.length;
  } catch { inboxCount = 0; }
  notebookBadge.set(inboxCount);
  return inboxCount;
}

// Draws can overlap (a write refreshes every pane while another draw is waiting on wb); each is built apart and only the
// newest is put in the pane, so the Notebook never shows two writing boxes.
let drawing = 0;

async function draw(el: HTMLElement) {
  const gen = ++drawing;
  const seg = h('div', 'seg nb-seg');
  const tab = (v: View, label: string, badge?: number) => {
    const b = h('button', view === v ? 'on' : '', label);
    if (badge) b.append(h('span', 'badge', String(badge)));
    b.onclick = () => { view = v; draw(el); };
    seg.append(b);
  };
  await countInbox();
  tab('journal', 'Journal');
  tab('inbox', 'Inbox', inboxCount);
  tab('all', 'All notes');
  tab('trash', 'Trash');
  const scroll = h('div', 'nb-scroll');
  if (view === 'journal') await journal(scroll);
  else if (view === 'inbox') await inbox(scroll);
  else if (view === 'trash') await trash(scroll);
  else await allNotes(scroll);
  if (gen !== drawing) return;
  const keep = el.querySelector<HTMLElement>('.nb-scroll')?.scrollTop ?? 0;
  const old = el.querySelector<HTMLTextAreaElement>('.nb-write textarea');
  const draft = old?.value ?? '';
  const typing = !!old && document.activeElement === old;
  el.replaceChildren(seg, scroll);
  if (view === 'journal') {
    const w = writer(draft);
    el.append(w);
    if (typing) w.querySelector('textarea')?.focus();
  }
  scroll.scrollTop = keep;
}

async function journal(into: HTMLElement) {
  const d = await wb(['journal']);
  const bar = h('div', 'nb-filter');
  const qs = h('button', `chip question-chip${onlyQuestions ? ' on' : ''}`, '? Questions only');
  qs.onclick = () => { onlyQuestions = !onlyQuestions; void pane?.refresh?.(); };
  bar.append(qs);
  into.append(bar);
  let any = false;
  for (const day of d.days) {
    const entries: Entry[] = day.entries.filter((e: Entry) => !onlyQuestions || e.kind === 'question');
    if (!entries.length) continue;
    any = true;
    const dh = h('div', 'nb-day');
    dh.append(h('span', '', day.today ? `Today · ${day.label}` : day.label));
    into.append(dh, ...entries.map(e => entryCard(e)));
  }
  if (!any) into.append(h('p', 'muted nb-empty', onlyQuestions ? 'No questions yet. Mark a thought with ? to ask it.' : 'Nothing written yet. Write a thought below: it waits in the Inbox until you give it a place.'));
}

async function inbox(into: HTMLElement) {
  const d = await wb(['inbox']);
  for (const e of d.notes as Entry[]) into.append(entryCard(e, true));
  if (!d.notes.length) into.append(h('p', 'muted nb-empty', 'Every note has its place.'));
}

async function allNotes(into: HTMLElement) {
  const f = h('div', 'nb-search');
  f.append(icon('filter'));
  const input = h('input', 'field') as HTMLInputElement;
  input.placeholder = 'Filter your notes';
  input.value = filter;
  let t = 0;
  input.oninput = () => { clearTimeout(t); t = window.setTimeout(() => { filter = input.value; void pane?.refresh?.(); }, 200); };
  f.append(input);
  into.append(f);
  const d = await wb(filter.trim() ? ['note', 'all', ...filter.trim().split(/\s+/)] : ['note', 'all']);
  for (const b of d.books) {
    into.append(h('div', 'label', b.name), ...b.notes.map((e: Entry) => entryCard(e)));
  }
  if (!d.books.length) into.append(h('p', 'muted nb-empty', filter ? 'No note has all of these words.' : 'No placed notes yet.'));
  if (filter) requestAnimationFrame(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); });
}

// Deleted notes and questions: each waits 7 days, then the window erases it when it opens (wb trash empty).
async function trash(into: HTMLElement) {
  const d = await wb(['trash']);
  into.append(h('p', 'muted small nb-trash-about', `Deleted notes wait here ${d.days} days, then are erased. Put one back to keep it.`));
  for (const t of d.notes) {
    const c = h('div', 'note-card nb-entry trashed');
    const top = h('div', 'nb-top');
    if (t.question) top.append(h('span', 'pill question-pill', '? Question'));
    top.append(h('span', 'pill unplaced', t.anchor || (t.kind === 'thread' ? 'On a thread' : 'No place')), h('span', 'grow'));
    const left = t.days_left === 0 ? 'erased next time the app opens' : `erased in ${t.days_left} day${t.days_left === 1 ? '' : 's'}`;
    top.append(h('span', 'nb-time', left));
    c.append(top, h('p', 'nb-text', t.text));
    const acts = h('div', 'nb-acts');
    acts.append(button('btn soft small', 'Put it back', async () => {
      try { await wb(['trash', 'restore', t.name]); toast('Put back'); changed(); } catch (x) { toast(String(x)); }
    }));
    c.append(acts);
    into.append(c);
  }
  if (!d.notes.length) into.append(h('p', 'muted nb-empty', 'Nothing deleted.'));
}

/** A note's threads, as chips: a click opens the thread, × takes the note off it. */
function threadChips(e: Entry): HTMLElement[] {
  return (e.threads || []).map(t => {
    const chip = h('span', 'chip thread nb-thread-chip');
    chip.append(icon('threads', 12), button('link-btn', t.name, () => openThread(t.name)));
    const x = button('member-x shown', '', async () => { await wb(['note', 'thread', e.id, t.id, '--remove']); changed(); }, 'x');
    x.title = `Take it off ${t.name}`;
    chip.append(x);
    return chip;
  });
}

function entryCard(e: Entry, inInbox = false): HTMLElement {
  const c = h('div', `note-card nb-entry${e.kind === 'question' ? ' is-question' : ''}${e.status === 'done' ? ' done' : ''}`);
  c.dataset.id = e.id;
  const top = h('div', 'nb-top');
  // the tag is a switch: a click makes a question a plain note (and a note can be asked as a question from its acts)
  if (e.kind === 'question') {
    const tag = button('pill question-pill', e.status === 'done' ? '? Answered' : '? Question', async () => { await wb(['note', 'question', e.id, '--plain']); changed(); });
    tag.title = 'Click: make it a plain note';
    top.append(tag);
  }
  const onThreadOnly = e.placed && !e.anchor;
  if (onThreadOnly) top.append(h('span', 'pill unplaced', e.label));
  else if (e.placed) top.append(placePill(e.label, () => goTo(e.anchor)));
  else top.append(h('span', 'pill unplaced', 'No place yet'));
  for (const a of e.also || []) top.append(placePill(a.label, () => goTo(a.anchor)));
  top.append(h('span', 'grow'));
  const time = h('span', 'nb-time', inInbox ? `${e.created.slice(0, 10) === new Date().toISOString().slice(0, 10) ? 'Today ' : ''}${e.time}` : e.time);
  const more = h('button', 'icon-btn small');
  more.append(icon('more', 14));
  more.setAttribute('aria-label', 'Change this note');
  more.onclick = () => entryMenu(more, e, c);
  top.append(time, more);
  const p = h('p', 'nb-text');
  p.append(linkedText(e.text, e.refs, ref => goTo(ref), refHover));
  c.append(top, p);
  const chips = threadChips(e);
  if (chips.length) { const row = h('div', 'nb-threads'); row.append(...chips); c.append(row); }
  const acts = h('div', 'nb-acts');
  if (!e.placed) {
    // drag it onto a verse in the reader to give it that place
    c.draggable = true;
    c.title = 'Drag onto a verse to place it there';
    c.ondragstart = ev => { ev.dataTransfer!.setData('text/wb-jot', e.id); ev.dataTransfer!.effectAllowed = 'move'; c.classList.add('dragging'); };
    c.ondragend = () => c.classList.remove('dragging');
    acts.append(button('btn soft small', 'Place it…', ev => placeMenu(ev.currentTarget as HTMLElement, e), 'pin'));
  } else if (!onThreadOnly) {
    acts.append(button('link-btn', 'Move…', ev => placeMenu(ev.currentTarget as HTMLElement, e)));
    if (e.kind === 'note') acts.append(button('link-btn', '+ Place', ev => placeMenu(ev.currentTarget as HTMLElement, e, 'also')));
  }
  acts.append(button('link-btn', '+ Thread', ev => threadChooser(ev.currentTarget as HTMLElement, name => putOnThread(e.id, name))));
  if (e.kind === 'question') {
    const done = e.status === 'done';
    acts.append(button(`link-btn${done ? '' : ' answered'}`, done ? 'Open it again' : '✓ Answered', async () => { await wb(['note', 'answered', e.id, ...(done ? ['--open'] : [])]); changed(); }));
  } else if (!onThreadOnly) {
    acts.append(button('link-btn', 'Ask as a question', async () => { await wb(['note', 'question', e.id]); changed(); }));
  }
  acts.append(h('span', 'grow'), button('link-btn danger', 'Delete', () => remove(e), 'trash'));
  c.append(acts);
  return c;
}

/** Put a note on a thread by name; a name no thread has starts a new thread. */
export async function putOnThread(id: string, name: string) {
  try {
    const ts: any[] = await wb(['thread', 'list']);
    if (!ts.some(t => t.name.toLowerCase() === name.toLowerCase())) await wb(['thread', 'new', name]);
    await wb(['note', 'thread', id, name]);
    toast(`On ${name}`);
    changed();
  } catch (x) { toast(String(x)); }
}

export async function remove(e: Pick<Entry, 'id' | 'placed' | 'kind'>) {
  if (!confirm('Delete this note? It waits in the Trash for 7 days, then is erased.')) return;
  if (!e.placed) await wb(['inbox', 'rm', e.id]);
  else if (e.kind === 'question') await wb(['trail', 'rm', e.id]);
  else await wb(['note', 'rm', e.id]);
  changed();
}

function changed() {
  app.changed();
}

// "Place this note on" (or, for a placed note, "Move this note to", or "Also on" for one more place): the place picked in
// the reader, the place the note names, or another typed.
export function placeMenu(from: HTMLElement, e: Pick<Entry, 'id' | 'placed' | 'label' | 'offer'>, mode?: 'also') {
  const box = h('div', 'place-menu');
  box.append(h('div', 'muted small', mode === 'also' ? `Put this note on another place too (it stays on ${e.label})` : e.placed ? `Move this note from ${e.label} to` : 'Place this note on'));
  const go = async (anchor: string) => {
    close();
    try {
      const argv = mode === 'also' ? ['note', 'also', e.id, anchor] : e.placed ? ['note', 'move', e.id, anchor] : ['note', 'place', e.id, anchor];
      const r = await wb(argv);
      toast(mode === 'also' ? `Also on ${r.also?.[r.also.length - 1]?.label ?? anchor}` : `${e.placed ? 'Moved' : 'Placed'} on ${r.label}`);
      changed();
    } catch (x) { toast(String(x)); }
  };
  const opt = (at: At, why: string, first: boolean) => {
    const b = h('button', `place-opt${first ? ' first' : ''}`);
    const t = h('div');
    t.append(h('div', 'place-opt-label', at.label), h('div', 'muted small', why));
    b.append(icon('pin'), t);
    b.onclick = () => go(at.anchor);
    box.append(b);
  };
  const picked = app.picked;
  if (picked) opt(picked, 'selected in the reader', true);
  const offer = e.placed ? null : e.offer ?? null;
  if (offer && offer.anchor !== picked?.anchor) opt(offer, 'named in the note', !picked);
  if (!picked && !offer) opt(here(), 'at the top of the reader', true);
  const f = h('form', 'place-other');
  f.append(icon('pin'));
  const i = h('input', 'field') as HTMLInputElement;
  i.placeholder = 'Another place…';
  f.append(i);
  f.onsubmit = ev => { ev.preventDefault(); if (i.value.trim()) go(i.value.trim()); };
  box.append(f);
  const close = popMenu(from, box, { width: 300 });
  // the first offer (and the menu) answer to Enter at once
  if (!picked && !offer) i.focus();
}

function entryMenu(from: HTMLElement, e: Entry, cardEl: HTMLElement) {
  const box = h('div', 'menu-list');
  const item = (label: string, fn: () => void) => box.append(button('menu-item', label, () => { close(); fn(); }));
  const onThreadOnly = e.placed && !e.anchor;
  item('Edit', () => editInPlace(e, cardEl));
  if (e.placed && !onThreadOnly) item('Move to another place…', () => placeMenu(from, e));
  if (e.placed && !onThreadOnly && e.kind === 'note') item('Put it on another place too…', () => placeMenu(from, e, 'also'));
  for (const a of e.also || []) item(`Take it off ${a.label}`, async () => { await wb(['note', 'also', e.id, a.anchor, '--remove']); changed(); });
  if (e.kind === 'question') item(e.status === 'done' ? 'Open it again' : 'Answered: mark it done', async () => { await wb(['note', 'answered', e.id, ...(e.status === 'done' ? ['--open'] : [])]); changed(); });
  if (!onThreadOnly) item(e.kind === 'question' ? 'Make it a plain note' : 'Make it a question', async () => { await wb(['note', 'question', e.id, ...(e.kind === 'question' ? ['--plain'] : [])]); changed(); });
  item('Delete (to the Trash)', () => remove(e));
  const close = popMenu(from, box, { align: 'right', width: 220 });
}

function editInPlace(e: Entry, cardEl: HTMLElement) {
  const p = cardEl.querySelector('.nb-text')!;
  const ta = h('textarea', 'field nb-edit') as HTMLTextAreaElement;
  ta.value = e.text;
  p.replaceWith(ta);
  ta.focus();
  const save = async () => {
    const text = ta.value.trim();
    if (!text || text === e.text) return changed();
    await wb(['note', 'text', e.id, '-'], text);
    changed();
  };
  ta.onkeydown = ev => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); save(); }
    if (ev.key === 'Escape') { ev.stopPropagation(); changed(); }
  };
  ta.onblur = () => save();
}

// The writing box: no place unless one is chosen (the place picked in the reader is offered); ? makes a question.
let writeAt: At | null = null;
let writeQuestion = false;
let lastPicked: string | null = null;
let focusWriter = false;

function writer(draft: string): HTMLElement {
  const box = h('div', 'nb-write');
  const ta = h('textarea', 'nb-input') as HTMLTextAreaElement;
  ta.placeholder = 'Write a thought...';
  ta.rows = 2;
  ta.value = draft;
  // a place picked in the reader since the last entry is offered, already on
  if (app.picked && app.picked.anchor !== lastPicked) { writeAt = app.picked; lastPicked = app.picked.anchor; }
  const row = h('div', 'nb-write-row');
  const placeChip = h('button', `chip place-chip${writeAt ? ' on' : ''}`);
  const drawPlace = () => {
    placeChip.replaceChildren(icon('pin', 13), document.createTextNode(writeAt ? ` ${writeAt.label}` : ' No place'));
    placeChip.classList.toggle('on', !!writeAt);
    placeChip.title = writeAt ? 'Click: no place (it waits in the Inbox)' : `Click: put it on ${here().label}`;
  };
  placeChip.onclick = () => { writeAt = writeAt ? null : here(); drawPlace(); ta.focus(); };
  drawPlace();
  const qChip = h('button', `chip question-chip${writeQuestion ? ' on' : ''}`, '? Question');
  qChip.onclick = () => { writeQuestion = !writeQuestion; qChip.classList.toggle('on', writeQuestion); ta.focus(); };
  row.append(placeChip, qChip, h('span', 'muted small nb-hint', 'Enter adds · Shift+Enter: new line'));
  box.append(ta, row);
  // asked for from a verse (Note, Question): ready to type, saying where it goes
  if (focusWriter && writeAt) {
    focusWriter = false;
    ta.placeholder = writeQuestion ? `Your question on ${writeAt.label}…` : `Your note on ${writeAt.label}…`;
    requestAnimationFrame(() => ta.focus());
  }
  ta.onkeydown = async e => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const text = ta.value.trim();
    if (!text) return;
    try {
      if (writeAt && writeQuestion) await wb(['trail', 'add', writeAt.anchor, text]);
      else if (writeAt) await wb(['note', 'add', writeAt.anchor, '-'], text);
      else await wb(writeQuestion ? ['note', 'jot', '-', '--question'] : ['note', 'jot', '-'], text);
      ta.value = '';
      writeQuestion = false;
      toast(writeAt ? `Written on ${writeAt.label}` : 'In the Inbox');
      writeAt = null;
      changed();
    } catch (x) { toast(String(x)); }
  };
  return box;
}

/** Write a note (or a question) on a place in the Notebook's box: the Journal comes forward with the place chosen and
 * the box ready to type in. */
export async function writeInNotebook(at: At, question: boolean) {
  writeAt = at;
  lastPicked = at.anchor;
  writeQuestion = question;
  view = 'journal';
  focusWriter = true;
  const p = openNotebook();
  await p.refresh?.();
}

/** After a write elsewhere: draw the Notebook again if it is open. */
export function refreshNotebook() {
  void pane?.refresh?.();
  void countInbox();
}
