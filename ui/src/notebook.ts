// The Notebook, docked on the right (docs/PLAN-design.md section 3): Journal (every note by day), Inbox (notes with no
// place yet, each with Place it…) and All notes (placed notes in Bible order). Questions are notes marked "?": trails
// once placed. A writing box sits at the bottom of the Journal; Enter adds, Shift+Enter is a new line. Writing here never
// moves the reader.
import { wb } from './api';
import { app, goTo, here, type At } from './app';
import { dock, refHover } from './panes';
import type { Pane } from './dock';
import { toast } from './sheets';
import { button, h, icon, linkedText, placePill, popMenu, type Found } from './ui';

type View = 'journal' | 'inbox' | 'all';
let view: View = 'journal';
let onlyQuestions = false;
let filter = '';
let pane: Pane | null = null;
let inboxCount = 0;
export const notebookBadge = { set: (_n: number) => {} };

interface Entry {
  id: string; kind: 'note' | 'question'; placed: boolean; anchor: string; label: string; text: string; time: string; created: string;
  status?: string; refs?: Found[]; offer?: At | null;
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
  const scroll = h('div', 'nb-scroll');
  if (view === 'journal') await journal(scroll);
  else if (view === 'inbox') await inbox(scroll);
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
  if (e.placed) top.append(placePill(e.label, () => goTo(e.anchor)));
  else top.append(h('span', 'pill unplaced', 'No place yet'));
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
  const acts = h('div', 'nb-acts');
  if (!e.placed) {
    // drag it onto a verse in the reader to give it that place
    c.draggable = true;
    c.title = 'Drag onto a verse to place it there';
    c.ondragstart = ev => { ev.dataTransfer!.setData('text/wb-jot', e.id); ev.dataTransfer!.effectAllowed = 'move'; c.classList.add('dragging'); };
    c.ondragend = () => c.classList.remove('dragging');
    acts.append(button('btn soft small', 'Place it…', ev => placeMenu(ev.currentTarget as HTMLElement, e), 'pin'));
  } else {
    acts.append(button('link-btn', 'Move…', ev => placeMenu(ev.currentTarget as HTMLElement, e)));
  }
  if (e.kind === 'question') {
    const done = e.status === 'done';
    acts.append(button(`link-btn${done ? '' : ' answered'}`, done ? 'Open it again' : '✓ Answered', async () => { await wb(['note', 'answered', e.id, ...(done ? ['--open'] : [])]); changed(); }));
  } else {
    acts.append(button('link-btn', 'Ask it as a question', async () => { await wb(['note', 'question', e.id]); changed(); }));
  }
  acts.append(h('span', 'grow'), button('link-btn danger', 'Delete', () => remove(e), 'trash'));
  c.append(acts);
  return c;
}

async function remove(e: Entry) {
  if (!confirm('Delete this note? It goes to .trash in the study folder.')) return;
  if (!e.placed) await wb(['inbox', 'rm', e.id]);
  else if (e.kind === 'question') await wb(['trail', 'rm', e.id]);
  else await wb(['note', 'rm', e.id]);
  changed();
}

function changed() {
  app.changed();
}

// "Place this note on" (or, for a placed note, "Move this note to"): the place picked in the reader, the place the
// note names, or another typed.
export function placeMenu(from: HTMLElement, e: Pick<Entry, 'id' | 'placed' | 'label' | 'offer'>) {
  const box = h('div', 'place-menu');
  box.append(h('div', 'muted small', e.placed ? `Move this note from ${e.label} to` : 'Place this note on'));
  const go = async (anchor: string) => {
    close();
    try {
      const r = await wb(e.placed ? ['note', 'move', e.id, anchor] : ['note', 'place', e.id, anchor]);
      toast(`${e.placed ? 'Moved' : 'Placed'} on ${r.label}`);
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
  item('Edit', () => editInPlace(e, cardEl));
  if (e.placed) item('Move to another place…', () => placeMenu(from, e));
  if (e.kind === 'question') item(e.status === 'done' ? 'Open it again' : 'Answered: mark it done', async () => { await wb(['note', 'answered', e.id, ...(e.status === 'done' ? ['--open'] : [])]); changed(); });
  item(e.kind === 'question' ? 'Make it a plain note' : 'Make it a question', async () => { await wb(['note', 'question', e.id, ...(e.kind === 'question' ? ['--plain'] : [])]); changed(); });
  item('Delete (to .trash)', () => remove(e));
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
    if (!e.placed) await wb(['inbox', 'edit', e.id, '-'], text);
    else if (e.kind === 'question') await wb(['trail', 'edit', e.id, text]);
    else await wb(['note', 'edit', e.id, e.anchor, '-'], text);
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
