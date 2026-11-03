// The Notebook, docked on the right (docs/PLAN-design.md section 3): Journal (every note by day), Inbox (notes with no
// place yet, each with Place it…) and All notes (placed notes in Bible order). Questions are notes marked "?": trails
// once placed. A writing box sits at the bottom of the Journal; Enter adds, Shift+Enter is a new line. Writing here never
// moves the reader.
import { wb } from './api';
import { app, goTo, here, type At } from './app';
import { dock } from './panes';
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

async function draw(el: HTMLElement) {
  const keep = el.querySelector<HTMLElement>('.nb-scroll')?.scrollTop ?? 0;
  const draft = el.querySelector<HTMLTextAreaElement>('.nb-write textarea')?.value ?? '';
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
  el.replaceChildren(seg, scroll);
  if (view === 'journal') await journal(scroll);
  else if (view === 'inbox') await inbox(scroll);
  else await allNotes(scroll);
  if (view === 'journal') el.append(writer(draft));
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
  if (e.kind === 'question') top.append(h('span', 'pill question-pill', e.status === 'done' ? '? Answered' : '? Question'));
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
  p.append(linkedText(e.text, e.refs, ref => goTo(ref)));
  c.append(top, p);
  if (!e.placed) {
    const acts = h('div', 'nb-acts');
    const place = button('btn soft small', 'Place it…', ev => placeMenu(ev.currentTarget as HTMLElement, e), 'pin');
    acts.append(place);
    if (e.kind === 'note') acts.append(button('link-btn', 'Ask it as a question', async () => { await wb(['inbox', 'edit', e.id, '--question']); changed(); }));
    c.append(acts);
  }
  return c;
}

function changed() {
  app.changed();
}

// "Place this note on": the place picked in the reader, the place the note names, or another typed.
function placeMenu(from: HTMLElement, e: Entry) {
  const box = h('div', 'place-menu');
  box.append(h('div', 'muted small', 'Place this note on'));
  const go = async (anchor: string) => {
    close();
    try {
      const r = await wb(['note', 'place', e.id, anchor]);
      toast(`Placed on ${r.label}`);
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
  const offer = e.offer ?? null;
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
  if (e.kind === 'question' && e.placed) {
    item(e.status === 'done' ? 'Open it again' : 'Answered: mark it done', async () => { await wb(['trail', e.status === 'done' ? 'reopen' : 'done', e.id]); changed(); });
  }
  if (!e.placed) item(e.kind === 'question' ? 'Make it a plain note' : 'Make it a question', async () => { await wb(['inbox', 'edit', e.id, e.kind === 'question' ? '--plain' : '--question']); changed(); });
  item('Delete (to .trash)', async () => {
    if (!confirm('Delete this note? It goes to .trash in the study folder.')) return;
    if (!e.placed) await wb(['inbox', 'rm', e.id]);
    else if (e.kind === 'question') await wb(['trail', 'rm', e.id]);
    else await wb(['note', 'rm', e.id]);
    changed();
  });
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

/** After a write elsewhere: draw the Notebook again if it is open. */
export function refreshNotebook() {
  void pane?.refresh?.();
  void countInbox();
}
