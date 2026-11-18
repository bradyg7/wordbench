// Reading plans (wb plan …, wb read …), phase 2b tier 3: the plan in its pane (P1: today's card, the days, days that were
// missed and the four things to do about them, P2), the form that makes one (R1, A2: what to read, order, pace, days off,
// a summary before starting), the builder for arranging the days by hand (R2), the importers for published plans, and Past
// plans (a stopped plan waits there to be used again or deleted, note 2885).
// Nothing here reminds, nags or counts streaks: it says where the person is, and what each choice does to the dates.
import { wb } from './api';
import { app, goTo } from './app';
import { openNote } from './notebook';
import { openReading } from './reading';
import { readingsOf, refreshStrip, startDay } from './planreading';
import type { Side } from './dock';
import { dock } from './panes';
import { toast } from './sheets';
import { button, h, icon, popMenu } from './ui';

const MINE: Side = 'right';

export function head(el: HTMLElement, title: string, sub?: string) {
  const hd = h('header', 'pane-head');
  hd.append(h('h2', 'pane-title', title));
  if (sub !== undefined) hd.append(h('div', 'pane-sub', sub));
  el.append(hd);
  return hd;
}

// A small form beside a button: one field (or a text box); OK runs `ok` with what was typed, and an error stays in the form.
export function ask(from: HTMLElement, label: string, value: string, ok: (v: string) => Promise<unknown>, opts: { area?: boolean; type?: string } = {}) {
  const f = h('form', 'ask');
  f.append(h('div', 'label', label));
  const field = (opts.area ? h('textarea', 'ask-area') : h('input', 'ask-input')) as HTMLInputElement;
  if (!opts.area) field.type = opts.type || 'text';
  field.value = value;
  const err = h('p', 'muted small');
  f.append(field, err, h('button', 'btn primary', 'OK'));
  let close = () => {};
  f.onsubmit = async e => {
    e.preventDefault();
    try { await ok(field.value); close(); } catch (x) { err.textContent = String(x); }
  };
  close = popMenu(from, f, { width: opts.area ? 440 : 280 });
  field.focus();
}

const entryGo = (entries: string[]) => () => { if (entries[0]) goTo(entries[0]); };
export const dayName = (d: string, long = false) => new Date(`${d}T12:00`).toLocaleDateString(undefined, long ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
const shortDay = (d: string) => new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const todayStr = () => new Date().toLocaleDateString('en-CA');
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// What is open stays open when the pane is drawn again (after a change to a plan).
const daysOpen = new Set<string>();
const seen = new Set<string>();

export function openPlans() {
  return dock.open('plans', 'Reading plans', 'plans', MINE, async (into, pane) => {
    // drawn apart and put in the pane only if no newer draw started meanwhile (two at once would show each plan twice)
    const my = ++plansDraw, el = h('div');
    const redraw = () => { void pane.refresh?.(); };
    head(el, 'Reading plans', 'Where you are in each plan');
    const [list, today]: any[] = await Promise.all([wb(['plan', 'list']), wb(['plan', 'today'])]);

    const bar = h('div', 'wrap plan-bar-row');
    bar.append(button('btn primary', 'New plan', () => openPlanForm(redraw), 'pen'));
    el.append(bar);

    for (const p of list) el.append(planCard(p, (today.plans || []).find((x: any) => x.id === p.id), redraw));
    if (!list.length) el.append(h('p', 'muted', 'No reading plans going.'));

    // the chapter you are in: how often it was read, when last, and what refers to it (R8)
    el.append(await chapterHere());

    // the foot: one row, Reading, that opens the Library's Reading place (R15; a placeholder until the Library is a directory)
    const row = button('plan-reading-row', 'Reading', () => void openReading(), 'right');
    row.dataset.act = 'reading';
    row.append(h('span', 'muted small', 'Past plans, and what you have read'));
    el.append(row);
    if (my === plansDraw) into.replaceChildren(...el.childNodes);
  });
}
let plansDraw = 0;

/** The chapter the reader is in: read times, when last, and what refers to it in the person's own work, as links. */
async function chapterHere(): Promise<HTMLElement> {
  const box = h('section', 'plan-here');
  const d = app.drawn;
  if (!d) return box;
  const place = `${d.chapter.name} ${d.chapter.chapter}`;
  box.append(h('div', 'label', place));
  try {
    const t = Object.values((await wb(['read', 'times', place])) ?? {})[0] as any;
    const when = t ? new Date(t.last).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    box.append(h('div', 'small plan-here-times', t ? `${t.times === 0 ? 'Read in part' : t.times === 1 ? 'Read once' : `Read ${t.times} times`} · last ${when}` : 'Not read yet'));
    const about: any[] = await wb(['read', 'about', place]);
    if (about.length) {
      box.append(h('div', 'muted small', 'What refers to it'));
      for (const x of about.slice(0, 12)) {
        const a = button('ref-link plan-about', `${x.title || x.kind} · ${x.kind}`, () => { if (x.kind === 'highlight' || x.kind === 'folder') goTo(x.anchor); else openNote(x.id); });
        box.append(a);
      }
    }
  } catch { /* the chapter's line stays empty */ }
  return box;
}

// ---- one plan -------------------------------------------------------------------------------------------------------------

/** The ten-part bar of a reading (R8): it fills as the reading is read. */
const tenbar = (fraction: number) => {
  const bar = h('span', 'tenbar');
  const on = Math.round(fraction * 10);
  for (let k = 0; k < 10; k++) bar.append(h('i', k < on ? 'on' : ''));
  bar.setAttribute('aria-hidden', 'true');
  return bar;
};

function planCard(p: any, t: any, redraw: () => void): HTMLElement {
  const card = h('section', 'plan-card');
  card.dataset.plan = p.id;
  if (!seen.has(p.id)) { seen.add(p.id); daysOpen.add(p.id); }
  const change = async (args: string[], input?: string) => { await wb(['plan', 'edit', p.id, ...args], input); redraw(); };
  const days = h('div', 'plan-days');
  days.hidden = !daysOpen.has(p.id);
  const titleRow = h('div', 'plan-title-row');
  titleRow.append(h('h3', 'plan-title', p.name));
  const more = button('icon-btn plan-menu-btn', '', e => planMenu(e.currentTarget as HTMLElement, p, change, days, () => fillDays(), redraw), 'more');
  more.setAttribute('aria-label', `More for ${p.name}`);
  more.dataset.act = 'more';
  titleRow.append(more);
  card.append(titleRow);
  const bar = h('div', 'plan-bar');
  const fill = h('span');
  fill.style.width = `${p.days ? Math.round((p.done * 100) / p.days) : 0}%`;
  bar.append(fill);
  card.append(bar);

  // where you are; the counter is a count in the quiet line, never red, never a prompt (R17)
  const rest = (p.days_off?.length ? ` · rests ${p.days_off.map((d: string) => d[0].toUpperCase() + d.slice(1)).join(', ')}` : '') + (p.source ? ` · from ${p.source}` : '');
  const of = p.cycle ? '' : ` of ${p.days}`;
  const behind = p.dated && !p.finished && p.behind > 0 ? ` · ${plural(p.behind, 'day')} behind` : '';
  const where = p.finished ? `Finished · ${plural(p.days, 'day')}`
    : !p.dated ? `${p.done} of ${p.days} read · no dates`
    : p.today == null && p.start > todayStr() ? `Starts ${dayName(p.start)}${p.cycle ? ' · no end date' : ` · ${plural(p.days, 'day')}`}`
    : p.today == null ? `A day off${p.next ? ` · next ${dayName(p.next.date)}` : ''}`
    : `Day ${p.today}${of}${behind}` + (p.ahead ? ` · ${p.ahead} ahead` : '') + (p.cycle ? ' · no end date' : '');
  const line = h('div', 'muted small plan-where', where + rest);
  card.append(line);

  // the day as a checklist: one row per reading, a box, the ten-part bar, where a part stopped
  const now = t?.today && !t.today.done ? t.today : null;
  const shown = now || (p.finished ? null : p.next);
  if (shown) {
    const box = h('div', 'plan-today');
    box.append(h('div', 'plan-today-label', now ? 'Today' : 'Next'));
    if (!now && shown.date) box.append(h('div', 'muted small', dayName(shown.date)));
    const checks = h('div', 'plan-checks');
    box.append(checks);
    const acts = h('div', 'plan-foot-acts');
    box.append(acts);
    card.append(box);
    void (async () => {
      let full: any;
      try { full = await wb(['plan', 'show', p.id]); } catch { return; }
      const row = full.schedule[shown.day - 1];
      if (!row) return;
      const readings = readingsOf(row);
      for (const r of readings) {
        const one = h('div', `plan-check${r.read ? ' done' : ''}`);
        one.dataset.entry = r.entry;
        one.append(h('span', 'box', r.read ? '✓' : ''), button('ref-link plan-check-label', r.label, () => void startDay(p.id, shown.day, r.entry)), tenbar(r.fraction));
        if (!r.read && (r.readTo || r.parts)) one.append(h('span', 'muted small stopped', r.readTo ? `read to v. ${r.readTo}${r.parts ? ` · vv. ${r.parts}` : ''}` : `read vv. ${r.verses}`));
        checks.append(one);
      }
      const next = readings.find(r => !r.read);
      const started = readings.some(r => r.read || r.fraction > 0);
      if (next) {
        const go = button('btn primary', started ? `Go on: ${next.label}` : 'Read', () => void startDay(p.id, shown.day, next.entry), 'book');
        go.dataset.act = 'read';
        acts.append(go);
      }
      const mark = button('btn', 'Mark the day read', async () => { try { await wb(['plan', 'done', p.id, '--day', String(shown.day)]); await refreshStrip(); redraw(); } catch (x) { toast(String(x)); } }, 'check');
      mark.dataset.act = 'mark-day';
      acts.append(mark);
      if (!next) box.append(h('p', 'muted small', 'The day is read.'));
    })();
  } else if (!p.finished && now == null && t?.today?.done) {
    card.append(h('p', 'muted small', 'Today’s reading is read.'));
  }

  // the days: drag one to move it; a ✓ is read
  const fillDays = async () => {
    const full = await wb(['plan', 'show', p.id]);
    const rows: HTMLElement[] = [];
    for (const d of full.schedule) {
      const row = h('div', `plan-row${d.done ? ' done' : ''}${d.skipped ? ' skipped' : ''}`);
      row.dataset.day = String(d.day);
      row.draggable = true;
      const grip = h('span', 'grip');
      grip.append(icon('grip', 14));
      const tag = d.done ? '✓' : d.skipped ? 'skipped' : d.day === full.today ? 'today' : d.date ? shortDay(d.date) : '';
      const tagEl = h('span', `plan-tag${d.done ? ' tick' : ''}`, tag);
      row.append(grip, h('span', 'muted small plan-n', String(d.day)), button('ref-link', d.label || 'No reading', entryGo(d.entries)), tagEl);
      row.ondragstart = e => { e.dataTransfer!.setData('text/plain', String(d.day)); e.dataTransfer!.effectAllowed = 'move'; row.classList.add('dragging'); };
      row.ondragend = () => row.classList.remove('dragging');
      row.ondragover = e => { e.preventDefault(); row.classList.add('drop'); };
      row.ondragleave = () => row.classList.remove('drop');
      row.ondrop = async e => {
        e.preventDefault();
        row.classList.remove('drop');
        const from = +e.dataTransfer!.getData('text/plain');
        if (!from || from === d.day) return;
        try { await wb(['plan', 'move-day', p.id, '--day', String(from), '--to', String(d.day)]); redraw(); } catch (x) { toast(String(x)); }
      };
      rows.push(row);
    }
    days.replaceChildren(...rows);
    days.querySelector('.plan-row:not(.done):not(.skipped)')?.scrollIntoView?.({ block: 'nearest' });
  };
  if (!days.hidden) void fillDays();
  card.append(days);
  return card;
}

// Rename, Start day, Edit as text, Days and Stop go under ⋯ (R8).
function planMenu(from: HTMLElement, p: any, change: (args: string[], input?: string) => Promise<void>, days: HTMLElement, fillDays: () => Promise<void>, redraw: () => void) {
  const box = h('div', 'menu-list plan-menu');
  let close = () => {};
  const item = (label: string, fn: (e: MouseEvent) => void) => {
    const b = h('button', 'menu-item', label);
    b.onclick = e => { close(); fn(e); };
    box.append(b);
    return b;
  };
  item('Days', async () => {
    days.hidden = !days.hidden;
    if (days.hidden) daysOpen.delete(p.id); else daysOpen.add(p.id);
    if (days.hidden || days.childElementCount) return;
    await fillDays();
  });
  item('Rename…', () => ask(from, 'Name', p.name, v => change(['--rename', v])));
  item('Start day…', () => ask(from, 'The plan’s first day', p.start, v => change(['--start', v]), { type: 'date' }));
  item('Edit as text…', async () => {
    const text = await wb(['plan', 'text', p.id]);
    ask(from, 'One day to a line, places joined by ; (what you have read stays read)', String(text), v => change(['--text', '-'], v), { area: true });
  });
  item('Stop', async () => {
    await wb(['plan', 'stop', p.id]);
    daysOpen.delete(p.id);
    toast(`“${p.name}” is stopped; it waits in Past plans`);
    redraw();
  }).classList.add('danger');
  close = popMenu(from, box, { align: 'right', width: 200 });
}

// A past plan: stopped or finished, with how far it got (drawn in Reading, R16).
export function pastRow(p: any, redraw: () => void): HTMLElement {
  const row = h('div', 'plan-past-row');
  row.dataset.plan = p.id;
  const info = h('div');
  info.append(h('div', 'plan-past-name', p.name),
    h('div', 'muted small', `${p.stopped ? `Stopped ${dayName(p.stopped)}` : 'Finished'} · ${p.done} of ${plural(p.days, 'day')} read`));
  const acts = h('div', 'wrap');
  acts.append(button('btn small', 'Use again…', e => ask(e.currentTarget as HTMLElement, 'The new plan’s first day', todayStr(), async v => { await wb(['plan', 'reuse', p.id, '--start', v]); redraw(); }, { type: 'date' })),
    button('link-btn danger', 'Delete', async e => {
      const from = e.currentTarget as HTMLElement;
      const f = h('div', 'ask');
      f.append(h('p', 'small', `Delete “${p.name}”? Its file goes to .trash; what you read stays in the log.`));
      const yes = button('btn primary', 'Delete', async () => { await wb(['plan', 'rm', p.id]); close(); redraw(); });
      const close = popMenu(from, f, { width: 280 });
      f.append(yes);
    }));
  row.append(info, acts);
  return row;
}

// ---- the form (R1, A2) ----------------------------------------------------------------------------------------------------

interface Chip { label: string; codes: string[] }
// One day in the builder: each chapter a chip, and whether the person set the day by hand (a new pace leaves it alone).
interface BChip { entry: string; label: string }
interface BRow { chips: BChip[]; kept: boolean }
interface Draft {
  name: string; chips: Chip[]; passages: string[];
  order: 'bible' | 'listed' | 'side-by-side';
  pace: 'days' | 'by' | 'chapters' | 'own'; n: string; by: string;
  start: 'today' | 'day'; day: string; off: Set<string>;
  arr: BRow[] | null; // the days as the builder holds them, when the person has arranged them
}
const freshDraft = (): Draft => ({ name: '', chips: [], passages: [], order: 'bible', pace: 'days', n: '30', by: '', start: 'today', day: todayStr(), off: new Set(), arr: null });
const payload = (rows: BRow[]) => JSON.stringify({ days: rows.map(r => r.chips.map(c => c.entry)), kept: rows.flatMap((r, k) => (r.kept ? [k + 1] : [])) });
const rowsOf = (l: any): BRow[] => l.rows.map((r: any) => ({ chips: r.chips, kept: !!r.kept }));
let draft = freshDraft();

const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// The usual groupings of the books (the same ranges the command language knows as law, history, poetry, prophets, …)
const GROUPS: [string, number, number][] = [
  ['Law', 1, 5], ['History', 6, 17], ['Poetry', 18, 22], ['Prophets', 23, 39], ['Gospels', 40, 43], ['Letters of Paul', 45, 57], ['Other letters', 58, 65],
];
const booksIn = (a: number, b: number) => app.books.filter(x => x.id >= a && x.id <= b);
const chaptersOf = (codes: string[]) => app.books.filter(b => codes.includes(b.code)).reduce((n, b) => n + b.chapters, 0);

// Start from: each fills the boxes of the form.
const PRESETS: { label: string; name: string; codes: () => Chip[]; order?: Draft['order']; n: string }[] = [
  { label: 'Blank', name: '', codes: () => [], n: '30' },
  { label: 'Bible in a year', name: 'Bible in a year', codes: () => [{ label: 'The whole Bible · 66 books', codes: app.books.map(b => b.code) }], n: '365' },
  { label: 'Old and New together', name: 'Old and New together', codes: () => [{ label: 'The whole Bible · 66 books', codes: app.books.map(b => b.code) }], order: 'side-by-side', n: '365' },
  { label: 'New Testament in 90 days', name: 'New Testament in 90 days', codes: () => [{ label: 'New Testament · 27 books', codes: booksIn(40, 66).map(b => b.code) }], n: '90' },
  { label: 'Psalms and Proverbs', name: 'Psalms and Proverbs', codes: () => [{ label: 'Psalms and Proverbs', codes: ['PSA', 'PRO'] }], n: '31' },
];

// What `wb` is asked for the form: 'start' (or 'dry' for what it would make), 'layout' (the days, each chapter apart). With
// days arranged by hand, 'start' and 'dry' take exactly those days, and 'layout' lays the rest out around the kept ones.
const argv = (d: Draft, mode: 'start' | 'dry' | 'layout'): { args: string[]; input?: string } => {
  const a = ['plan', mode === 'layout' ? 'layout' : 'start'];
  if (mode !== 'layout') a.push(d.name.trim() || 'My plan');
  if (d.chips.length) a.push('--books', d.chips.flatMap(c => c.codes).join(','));
  if (d.passages.length) a.push('--passages', d.passages.join('; '));
  a.push('--order', d.order);
  a.push('--pace', d.pace === 'own' ? 'own' : d.pace === 'by' ? `by:${d.by}` : `${d.pace}:${d.n}`);
  if (d.off.size) a.push('--days-off', [...d.off].join(','));
  a.push('--start', d.start === 'day' ? d.day : todayStr());
  if (mode === 'dry') a.push('--dry-run');
  if (d.arr) a.push('--arranged', '-');
  return { args: a, input: d.arr ? payload(d.arr) : undefined };
};

export function openPlanForm(done: () => void) {
  const overlay = document.getElementById('overlay')!;
  overlay.querySelectorAll('.plan-modal-wrap').forEach(x => x.remove());
  const wrap = h('div', 'plan-modal-wrap');
  const box = h('section', 'plan-modal');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'New reading plan');
  wrap.append(box);
  overlay.append(wrap);
  // the builder opens in the reader's place: from the bottom of the bar down, not over the whole window
  const barEl = document.getElementById('bar');
  if (barEl && window.innerWidth >= 600) wrap.style.top = `${Math.round(barEl.getBoundingClientRect().bottom)}px`;
  wrap.classList.add('in-reader');
  const close = () => { wrap.remove(); document.removeEventListener('keydown', key, true); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', key, true);
  // A new pace lays the days out again; the days the person set by hand stay as they are.
  const relay = async () => {
    if (!draft.arr) return;
    const q = argv(draft, 'layout');
    try { draft.arr = rowsOf(await wb(q.args, q.input)); } catch { /* the summary says what is wrong */ }
  };
  const x = (title: string, sub: string) => {
    const top = h('header', 'plan-modal-head');
    const t = h('div');
    t.append(h('h2', 'plan-modal-title', title), h('div', 'muted small', sub));
    const c = h('button', 'icon-btn');
    c.setAttribute('aria-label', 'Close');
    c.append(icon('x', 14));
    c.onclick = close;
    top.append(t, c);
    return top;
  };
  const form = () => {
    box.className = 'plan-modal';
    box.replaceChildren(x('New reading plan', 'Only a name and what to read are needed.'));
    const body = h('div', 'plan-modal-body');
    const label = (t: string, req?: boolean) => { const l = h('div', 'plan-field-label', t); l.append(h('span', req ? 'req' : 'opt', req ? ' required' : ' optional')); return l; };

    // Start from a kind (R14): each card says what it reads and for how long
    const cards = h('div', 'plan-kinds');
    const kindCard = (id: string, name: string, what: string, on: boolean, run: () => void) => {
      const c = h('button', `plan-kind${on ? ' on' : ''}`);
      c.dataset.kind = id;
      c.type = 'button';
      c.append(h('span', 'plan-kind-name', name), h('span', 'muted small', what));
      c.onclick = run;
      cards.append(c);
    };
    const wholeBible = () => ({ ...freshDraft(), name: 'Bible in a year', chips: PRESETS[1].codes(), n: '365' });
    kindCard('canonical', 'The Bible in its order', 'Genesis to Revelation · 365 days, balanced by words', draft.chips.length === 1 && draft.chips[0].codes.length === 66 && draft.order === 'bible', () => { draft = wholeBible(); form(); });
    kindCard('books', 'Some books', 'Choose books (the Gospels, Romans…) · you set the days', false, () => booksView());
    kindCard('horner', 'Horner’s ten lists', 'A chapter of each of ten lists a day · no end date', false, () => void hornerView());
    kindCard('published', 'A published plan', 'Paste it, one day to a line', false, () => importView());
    body.append(cards);
    const from = h('div', 'plan-presets');
    from.append(h('span', 'muted small', 'Or'));
    for (const p of PRESETS.slice(2)) {
      from.append(button('chip link', p.label, () => { draft = { ...freshDraft(), name: p.name, chips: p.codes(), order: p.order || 'bible', n: p.n }; form(); }));
    }
    body.append(from);

    // Name, what to read
    const name = h('input', 'ask-input') as HTMLInputElement;
    name.value = draft.name; name.placeholder = 'Name, like Bible in a year'; name.setAttribute('aria-label', 'Name');
    name.oninput = () => { draft.name = name.value; refresh(); };
    body.append(label('Name', true), name, label('What to read', true));
    const what = h('div', 'plan-what');
    draft.chips.forEach((c, k) => {
      const chip = h('span', 'chip plan-chip', c.label);
      const rm = h('button', 'chip-x');
      rm.setAttribute('aria-label', `Take out ${c.label}`);
      rm.append(icon('x', 10));
      rm.onclick = () => { draft.chips.splice(k, 1); draft.arr = null; form(); };
      chip.append(rm);
      what.append(chip);
    });
    draft.passages.forEach((p, k) => {
      const chip = h('span', 'chip plan-chip', p);
      const rm = h('button', 'chip-x');
      rm.setAttribute('aria-label', `Take out ${p}`);
      rm.append(icon('x', 10));
      rm.onclick = () => { draft.passages.splice(k, 1); draft.arr = null; form(); };
      chip.append(rm);
      what.append(chip);
    });
    what.append(button('chip nb-add', '+ Books…', () => booksView()),
      button('chip nb-add', '+ A passage…', e => ask(e.currentTarget as HTMLElement, 'A passage, like Psalm 23 or Isaiah 53:1-12', '', async v => {
        const t = v.trim();
        if (!t) return;
        await wb(['plan', 'start', 'X', '--passages', t, '--days', '1', '--dry-run']); // says what is wrong with it
        draft.passages.push(t); draft.arr = null; form();
      })));
    body.append(what);

    // Order, Pace, Start
    const row = h('div', 'plan-three');
    const sel = (opts: [string, string][], value: string, on: (v: string) => void, aria: string) => {
      const s = h('select', 'ask-input') as HTMLSelectElement;
      s.setAttribute('aria-label', aria);
      for (const [v, t] of opts) { const o = h('option', '', t) as HTMLOptionElement; o.value = v; s.append(o); }
      s.value = value; s.onchange = () => on(s.value);
      return s;
    };
    const o = h('div'); o.append(label('Order'), sel([['bible', 'Bible order'], ['listed', 'As listed'], ['side-by-side', 'Old and New side by side']], draft.order, v => { draft.order = v as Draft['order']; draft.arr = null; refresh(); }, 'Order'));
    const pace = h('div'); pace.append(label('Pace'), sel([['days', 'Finish in N days'], ['by', 'Finish by a day'], ['chapters', 'N chapters a day'], ['own', 'My own pace, no dates']], draft.pace, async v => { draft.pace = v as Draft['pace']; await relay(); form(); }, 'Pace'));
    const num = h('input', 'ask-input') as HTMLInputElement;
    num.setAttribute('aria-label', 'Number');
    if (draft.pace === 'by') { num.type = 'date'; num.value = draft.by; num.oninput = async () => { draft.by = num.value; await relay(); refresh(); }; }
    else { num.type = 'number'; num.min = '1'; num.value = draft.n; num.oninput = async () => { draft.n = num.value; await relay(); refresh(); }; }
    if (draft.pace !== 'own') pace.append(num);
    const st = h('div'); st.append(label('Start'), sel([['today', 'Today'], ['day', 'On a day…']], draft.start, v => { draft.start = v as Draft['start']; form(); }, 'Start'));
    if (draft.start === 'day') {
      const dd = h('input', 'ask-input') as HTMLInputElement;
      dd.type = 'date'; dd.value = draft.day; dd.setAttribute('aria-label', 'First day'); dd.oninput = () => { draft.day = dd.value; refresh(); };
      st.append(dd);
    }
    row.append(o, pace, st);
    body.append(row);

    // Days off
    const off = h('div', 'plan-off');
    off.append(h('span', 'plan-field-label', 'Days off'), h('span', 'opt', ' optional'));
    const days = h('span', 'plan-off-days');
    for (const d of WEEK) {
      const b = h('button', `chip link${draft.off.has(d) ? ' on' : ''}`, d[0].toUpperCase() + d.slice(1));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(draft.off.has(d)));
      b.onclick = () => { if (draft.off.has(d)) draft.off.delete(d); else draft.off.add(d); b.classList.toggle('on'); b.setAttribute('aria-pressed', String(draft.off.has(d))); refresh(); };
      days.append(b);
    }
    off.append(days);
    body.append(off);

    // The days by hand (R2): opens the builder with what the form holds; coming back keeps it
    const arrange = h('div', 'plan-arrange');
    const arrangeBtn = button('btn', draft.arr ? 'Edit the days…' : 'Arrange the days myself…', () => void builderView()) as HTMLButtonElement;
    if (draft.arr) {
      const kept = draft.arr.filter(r => r.kept).length;
      arrange.append(h('span', 'small', `The days are arranged by hand${kept ? ` · ${kept} kept as you set ${kept === 1 ? 'it' : 'them'}` : ''}. A new pace lays out the rest again.`),
        arrangeBtn, button('link-btn', 'Start over', () => { draft.arr = null; form(); }));
    } else {
      arrange.append(arrangeBtn, h('span', 'muted small', 'Move chapters between days, and days up or down.'));
    }
    body.append(arrange);

    // The summary, and Start
    const summary = h('div', 'plan-summary');
    const l1 = h('div', 'plan-summary-line'), l2 = h('div', 'muted small'), first = h('div', 'muted small plan-first');
    summary.append(l1, l2, first);
    body.append(summary);
    const foot = h('div', 'plan-modal-foot');
    const go = h('button', 'btn primary', 'Start the plan') as HTMLButtonElement;
    foot.append(h('span'), button('btn', 'Cancel', close), go);
    body.append(foot);
    box.append(body);

    let seq = 0;
    const refresh = async () => {
      const my = ++seq;
      const ready = !!draft.name.trim() && (draft.chips.length > 0 || draft.passages.length > 0);
      go.disabled = !ready;
      arrangeBtn.disabled = !(draft.chips.length > 0 || draft.passages.length > 0);
      if (!draft.chips.length && !draft.passages.length) { l1.textContent = 'Choose what to read.'; l2.textContent = ''; return; }
      try {
        const q = argv(draft, 'dry'); const d = await wb(q.args, q.input);
        if (my !== seq) return;
        const books = new Set(draft.chips.flatMap(c => c.codes)).size;
        l1.textContent = [books ? plural(books, 'book') : '', `${d.readings} readings`, d.dated ? plural(d.days, 'day') : 'no dates'].filter(Boolean).join(' · ');
        l2.textContent = d.dated
          ? `About ${(d.readings / d.days).toFixed(d.readings / d.days >= 10 ? 0 : 1).replace(/\.0$/, '')} a day, ${shortDay(d.start)} to ${shortDay(d.finish)}`
          : 'Read at your own pace; each reading waits as a day';
        l2.classList.remove('bad');
        first.textContent = d.first?.length ? `First days: ${d.first.slice(0, 3).join(' · ')}` : '';
      } catch (e) { if (my === seq) { l1.textContent = ''; first.textContent = ''; l2.textContent = String(e); l2.classList.add('bad'); go.disabled = true; } }
    };
    go.onclick = async () => {
      go.disabled = true;
      try {
        const q = argv(draft, 'start'); const p = await wb(q.args, q.input);
        draft = freshDraft();
        close();
        seen.add(p.id); daysOpen.add(p.id);
        toast(`“${p.name}” started`);
        done();
      } catch (e) { l2.textContent = String(e); l2.classList.add('bad'); go.disabled = false; }
    };
    void refresh();
    name.focus();
  };

  // Horner's ten lists (R12, R14): the lists side by side as columns, a chapter of each a day, no end date. Nothing is typed.
  const hornerView = async () => {
    box.className = 'plan-modal wide';
    let lay: any;
    try { lay = await wb(['plan', 'layout', '--kind', 'horner', '--start', draft.start === 'day' ? draft.day : todayStr()]); } catch (e) { toast(String(e)); return; }
    box.replaceChildren();
    const top = h('header', 'plan-build-head');
    const title = h('input', 'plan-build-title') as HTMLInputElement;
    title.value = draft.name || 'Horner’s Reading System'; title.setAttribute('aria-label', 'Name');
    const closeBtn = h('button', 'icon-btn');
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.append(icon('x', 14));
    closeBtn.onclick = close;
    top.append(button('btn', 'Back to the form', () => form()), title, h('div', 'muted small plan-build-stat', 'No end date'), closeBtn);
    box.append(top);
    const cols = h('div', 'plan-lists');
    for (const l of lay.lists) {
      const col = h('div', 'plan-list');
      col.dataset.list = l.books;
      col.append(h('div', 'plan-list-books', l.books), h('div', 'muted small', plural(l.chapters, 'chapter')));
      for (const c of l.first.slice(0, 4)) col.append(h('div', 'small plan-list-ch', c));
      cols.append(col);
    }
    box.append(cols);
    const days = h('div', 'plan-summary');
    days.append(h('div', 'plan-summary-line', `A chapter of each of the ${lay.lists.length} lists a day`), h('div', 'muted small', `First days: ${lay.rows.slice(0, 2).map((r: any) => r.label).join(' · ')}`));
    box.append(days);
    // days off, as in the form
    const off = h('div', 'plan-off');
    off.append(h('span', 'plan-field-label', 'Days off'), h('span', 'opt', ' optional'));
    const offDays = h('span', 'plan-off-days');
    for (const d of WEEK) {
      const b = h('button', `chip link${draft.off.has(d) ? ' on' : ''}`, d[0].toUpperCase() + d.slice(1));
      b.type = 'button';
      b.onclick = () => { if (draft.off.has(d)) draft.off.delete(d); else draft.off.add(d); b.classList.toggle('on'); };
      offDays.append(b);
    }
    off.append(offDays);
    box.append(off);
    const err = h('p', 'muted small bad');
    const go = h('button', 'btn primary', 'Start the plan') as HTMLButtonElement;
    go.onclick = async () => {
      go.disabled = true;
      try {
        const a = ['plan', 'start', title.value.trim() || 'Horner’s Reading System', '--kind', 'horner', '--start', draft.start === 'day' ? draft.day : todayStr()];
        if (draft.off.size) a.push('--days-off', [...draft.off].join(','));
        const p = await wb(a);
        draft = freshDraft();
        close();
        seen.add(p.id); daysOpen.add(p.id);
        toast(`“${p.name}” started`);
        done();
      } catch (e) { err.textContent = String(e); go.disabled = false; }
    };
    const foot = h('div', 'plan-modal-foot');
    foot.append(err, h('span'), button('btn', 'Cancel', close), go);
    box.append(foot);
  };

  // A2: choose books, several at once
  const booksView = () => {
    box.className = 'plan-modal';
    const ticked = new Set<string>();
    box.replaceChildren();
    const sub = h('div', 'muted small');
    box.append(x('Choose books', ''));
    box.querySelector('.plan-modal-head .muted')!.replaceWith(sub);
    const body = h('div', 'plan-modal-body');
    const count = () => { sub.textContent = `${ticked.size} ticked · ${plural(chaptersOf([...ticked]), 'chapter')}`; };
    const buttons = new Map<string, HTMLButtonElement>();
    const paint = () => { for (const [c, b] of buttons) { b.classList.toggle('on', ticked.has(c)); b.setAttribute('aria-pressed', String(ticked.has(c))); } count(); };
    const groups = h('div', 'plan-groups');
    for (const [name, a, b] of GROUPS) {
      groups.append(button('chip link', name, () => {
        const codes = booksIn(a, b).map(k => k.code);
        if (codes.every(c => ticked.has(c))) codes.forEach(c => ticked.delete(c)); else codes.forEach(c => ticked.add(c));
        paint();
      }));
    }
    body.append(groups);
    for (const [title, a, b] of [['Old Testament', 1, 39], ['New Testament', 40, 66]] as [string, number, number][]) {
      body.append(h('div', 'label', title));
      const grid = h('div', 'plan-books');
      for (const k of booksIn(a, b)) {
        const t = h('button', 'chip link', k.name);
        t.type = 'button';
        t.dataset.code = k.code;
        t.onclick = () => { if (ticked.has(k.code)) ticked.delete(k.code); else ticked.add(k.code); paint(); };
        buttons.set(k.code, t);
        grid.append(t);
      }
      body.append(grid);
    }
    const foot = h('div', 'plan-modal-foot');
    foot.append(button('link-btn', 'Clear', () => { ticked.clear(); paint(); }), h('span'), button('btn', 'Back', () => form()),
      button('btn primary', 'Done', () => {
        const codes = app.books.filter(k => ticked.has(k.code)).map(k => k.code);
        if (codes.length) {
          const all = (a: number, b: number) => booksIn(a, b).every(k => ticked.has(k.code)) && codes.length === b - a + 1;
          const named = all(1, 39) ? 'Old Testament · 39 books' : all(40, 66) ? 'New Testament · 27 books' : all(1, 66) ? 'The whole Bible · 66 books'
            : GROUPS.find(([, a, b]) => all(a, b))?.[0] ? `${GROUPS.find(([, a, b]) => all(a, b))![0]} · ${plural(codes.length, 'book')}`
            : codes.length <= 3 ? codes.map(c => app.books.find(k => k.code === c)!.name).join(', ') : plural(codes.length, 'book');
          draft.chips.push({ label: named, codes });
          draft.arr = null;
        }
        form();
      }));
    body.append(foot);
    box.append(body);
    count();
  };

  // R2: the builder. The days as rows of chapters: a chapter dragged to another day, a day dragged up or down. A day set by
  // hand is kept: a new pace lays out the others again and leaves it. What the form holds comes along, and goes back.
  const builderView = async () => {
    if (!draft.arr) {
      try { const q = argv(draft, 'layout'); draft.arr = rowsOf(await wb(q.args, q.input)); } catch (e) { toast(String(e)); return; }
    }
    let rows = draft.arr!;
    let query = '';
    let drag: { day: number; i?: number } | null = null;
    const bookName = (code: string) => app.books.find(b => b.code === code)?.name || code;
    const hit = (c: BChip) => !!query && (c.label.toLowerCase().includes(query.toLowerCase()) || bookName(c.entry.split('.')[0]).toLowerCase() === query.toLowerCase());
    const touch = (...days: number[]) => days.forEach(d => { if (rows[d]) rows[d].kept = true; });
    const moveChip = (from: { day: number; i?: number }, toDay: number, toIdx: number) => {
      if (from.i === undefined) return;
      if (from.day === toDay && (toIdx === from.i || toIdx === from.i + 1)) return;
      const [c] = rows[from.day].chips.splice(from.i, 1);
      if (from.day === toDay && toIdx > from.i) toIdx -= 1;
      rows[toDay].chips.splice(toIdx, 0, c);
      touch(from.day, toDay);
      draw(); void total();
    };
    const moveDay = (from: number, to: number) => {
      if (from === to) return;
      const [r] = rows.splice(from, 1);
      rows.splice(to, 0, r);
      r.kept = true;
      draw(); void total();
    };

    let stat: HTMLElement, err: HTMLElement, go: HTMLButtonElement;
    // how many days, and when it ends, for what the rows hold now
    const total = async () => {
      go.disabled = !draft.name.trim();
      try {
        const q = argv(draft, 'dry');
        const d = await wb(q.args, q.input);
        stat.textContent = `${plural(d.days, 'day')} · ${d.readings} readings${d.dated ? ` · ends ${dayName(d.finish)}` : ' · no dates'}`;
        err.textContent = '';
      } catch (e) { stat.textContent = ''; err.textContent = String(e); go.disabled = true; }
    };
    const relayed = async () => { await relay(); rows = draft.arr || rows; draw(); void total(); };

    const draw = () => {
      box.className = 'plan-modal wide';
      box.replaceChildren();
      const top = h('header', 'plan-build-head');
      const title = h('input', 'plan-build-title') as HTMLInputElement;
      title.value = draft.name; title.placeholder = 'Name the plan'; title.setAttribute('aria-label', 'Name');
      title.oninput = () => { draft.name = title.value; go.disabled = !title.value.trim(); };
      stat = h('div', 'muted small plan-build-stat');
      const closeBtn = h('button', 'icon-btn');
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.append(icon('x', 14));
      closeBtn.onclick = close;
      top.append(button('btn', 'Back to the form', () => form()), title, stat, closeBtn);
      box.append(top);

      // the pace: a new one lays out the days that are not kept
      const pace = h('div', 'plan-build-pace');
      const sel = h('select', 'ask-input') as HTMLSelectElement;
      sel.setAttribute('aria-label', 'Pace');
      for (const [v, t] of [['days', 'Finish in N days'], ['by', 'Finish by a day'], ['chapters', 'N chapters a day'], ['own', 'My own pace, no dates']]) { const o = h('option', '', t) as HTMLOptionElement; o.value = v; sel.append(o); }
      sel.value = draft.pace;
      sel.onchange = () => { draft.pace = sel.value as Draft['pace']; void relayed(); };
      pace.append(sel);
      if (draft.pace !== 'own') {
        const num = h('input', 'ask-input') as HTMLInputElement;
        num.setAttribute('aria-label', 'Number');
        if (draft.pace === 'by') { num.type = 'date'; num.value = draft.by; num.onchange = () => { draft.by = num.value; void relayed(); }; }
        else { num.type = 'number'; num.min = '1'; num.value = draft.n; num.onchange = () => { draft.n = num.value; void relayed(); }; }
        pace.append(num);
      }
      pace.append(h('span', 'muted small', 'Days you set by hand stay as they are when the pace changes.'));
      box.append(pace);

      const grid = h('div', 'plan-build');
      // the books in the plan, with a way to find a chapter
      const side = h('aside', 'plan-build-side');
      const find = h('input', 'ask-input') as HTMLInputElement;
      find.placeholder = 'Find a book or chapter'; find.value = query; find.setAttribute('aria-label', 'Find a book or chapter');
      side.append(find, h('div', 'label', 'In this plan'));
      const list = h('div', 'plan-build-books');
      const counts = new Map<string, number>();
      for (const r of rows) for (const c of r.chips) { const b = c.entry.split('.')[0]; counts.set(b, (counts.get(b) || 0) + 1); }
      for (const [code, n] of counts) {
        const b = button('plan-build-book', '', () => { find.value = bookName(code); find.dispatchEvent(new Event('input')); });
        b.dataset.code = code;
        b.append(h('span', '', bookName(code)), h('span', 'muted small', `${n} ch`));
        list.append(b);
      }
      side.append(list);
      const paint = () => {
        query = find.value.trim();
        main.querySelectorAll<HTMLElement>('.plan-bchip').forEach(el => el.classList.toggle('hit', !!query && el.dataset.hit === '1' && (el.dataset.label!.toLowerCase().includes(query.toLowerCase()) || el.dataset.book!.toLowerCase() === query.toLowerCase())));
        list.querySelectorAll<HTMLElement>('.plan-build-book').forEach(el => { el.hidden = !!query && !el.textContent!.toLowerCase().includes(query.toLowerCase()) && !bookName(el.dataset.code!).toLowerCase().includes(query.toLowerCase()); });
        main.querySelector('.plan-bchip.hit')?.scrollIntoView?.({ block: 'nearest' });
      };
      find.addEventListener('input', paint);

      // the days
      const main = h('div', 'plan-build-days');
      rows.forEach((r, k) => {
        const row = h('div', `plan-bday${r.kept ? ' kept' : ''}`);
        row.dataset.day = String(k + 1);
        const grip = h('span', 'grip');
        grip.append(icon('grip', 14));
        grip.draggable = true;
        grip.setAttribute('aria-label', `Move day ${k + 1}`);
        grip.ondragstart = e => { drag = { day: k }; e.dataTransfer!.setData('text/plain', `day ${k + 1}`); e.dataTransfer!.effectAllowed = 'move'; row.classList.add('dragging'); };
        grip.ondragend = () => { drag = null; row.classList.remove('dragging'); };
        const chips = h('div', 'plan-bchips');
        r.chips.forEach((c, i) => {
          const chip = h('span', 'chip plan-bchip', c.label);
          chip.draggable = true;
          chip.dataset.entry = c.entry; chip.dataset.label = c.label; chip.dataset.book = bookName(c.entry.split('.')[0]); chip.dataset.hit = '1';
          chip.ondragstart = e => { e.stopPropagation(); drag = { day: k, i }; e.dataTransfer!.setData('text/plain', c.label); e.dataTransfer!.effectAllowed = 'move'; chip.classList.add('dragging'); };
          chip.ondragend = () => { drag = null; chip.classList.remove('dragging'); };
          chip.ondragover = e => { if (drag?.i !== undefined) { e.preventDefault(); e.stopPropagation(); chip.classList.add('drop'); } };
          chip.ondragleave = () => chip.classList.remove('drop');
          chip.ondrop = e => { if (drag?.i === undefined) return; /* a day dropped here goes to the row */ e.preventDefault(); e.stopPropagation(); chip.classList.remove('drop'); moveChip(drag, k, i); };
          const x = h('button', 'chip-x');
          x.setAttribute('aria-label', `Take out ${c.label}`);
          x.append(icon('x', 10));
          x.onclick = () => { r.chips.splice(i, 1); touch(k); draw(); void total(); };
          chip.append(x);
          chips.append(chip);
        });
        if (!r.chips.length) chips.append(h('span', 'muted small', 'Drop chapters here'));
        chips.append(button('chip nb-add', '+', e => ask(e.currentTarget as HTMLElement, `Add to day ${k + 1}: a place, like Psalm 23`, '', async v => {
          const found: BChip[] = await wb(['plan', 'entries', v]);
          for (const c of found) rows.forEach((o, j) => { if (o.chips.some(z => z.entry === c.entry)) { o.chips = o.chips.filter(z => z.entry !== c.entry); touch(j); } });
          r.chips.push(...found);
          touch(k);
          draw(); void total();
        })));
        (chips.lastElementChild as HTMLElement).setAttribute('aria-label', `Add a place to day ${k + 1}`);
        const tail = h('div', 'plan-bkept');
        if (r.kept) tail.append(button('link-btn small', 'kept as you set it', () => { r.kept = false; draw(); }));
        if (!r.chips.length) tail.append(button('link-btn small', 'Remove', () => { rows.splice(k, 1); draw(); void total(); }));
        row.append(grip, h('span', 'plan-bn', `Day ${k + 1}`), chips, tail);
        row.ondragover = e => { if (drag) { e.preventDefault(); row.classList.add('drop'); } };
        row.ondragleave = e => { if (e.target === row) row.classList.remove('drop'); };
        row.ondrop = e => {
          e.preventDefault();
          row.classList.remove('drop');
          if (!drag) return;
          if (drag.i !== undefined) moveChip(drag, k, r.chips.length); else moveDay(drag.day, k);
        };
        main.append(row);
      });
      main.append(button('btn', 'Add a day', () => { rows.push({ chips: [], kept: true }); draw(); }));
      grid.append(side, main);
      box.append(grid);

      err = h('p', 'muted small bad');
      go = h('button', 'btn primary', 'Start the plan') as HTMLButtonElement;
      go.onclick = async () => {
        go.disabled = true;
        try {
          const q = argv(draft, 'start');
          const p = await wb(q.args, q.input);
          draft = freshDraft();
          close();
          seen.add(p.id); daysOpen.add(p.id);
          toast(`“${p.name}” started`);
          done();
        } catch (e) { err.textContent = String(e); go.disabled = false; }
      };
      const foot = h('div', 'plan-modal-foot');
      foot.append(err, h('span'), button('btn', 'Cancel', close), go);
      box.append(foot);
      paint();
    };
    draw();
    void total();
  };

  // A published plan: Guthrie's, Blue Letter Bible's, Horner's ten lists, or any list one day to a line. None comes with the app;
  // the copy the person has is pasted, and what was found is said before the plan starts.
  const importView = () => {
    box.className = 'plan-modal';
    const FORMS: { id: string; label: string; hint: string; sample: string }[] = [
      { id: 'auto', label: 'Find out from what I paste', hint: 'Week and Day lines are Guthrie’s; a / between places is Blue Letter Bible’s; List 1, List 2 are Horner’s; anything else is one day to a line.', sample: '' },
      { id: 'guthrie', label: 'Guthrie’s: Week N, Day N', hint: 'Lines like “Week 1” and “Day 1: Genesis 1-2; Matthew 1”. Six days a week; the seventh is a day off.', sample: 'Week 1\nDay 1: Genesis 1-2; Matthew 1\nDay 2: …' },
      { id: 'blue-letter', label: 'Blue Letter Bible’s list', hint: 'One day to a line, places joined by /, like “Gen 1 / Mat 1 / Phl 2”. Its short names (Jhn, 1Co, Jde) are read.', sample: 'Gen 1 / Mat 1 / Phl 2\nGen 2 / Mat 2 / Phl 3' },
      { id: 'horner', label: 'Horner’s ten lists', hint: 'One list to a line: “List 1: Matthew, Mark, Luke, John”. A chapter from each list is read each day, each list starting again when it is done. No end date.', sample: 'List 1: Matthew, Mark, Luke, John\nList 2: Genesis, Exodus, Leviticus, Numbers, Deuteronomy\n…' },
      { id: 'plain', label: 'One day to a line', hint: 'Places joined by ;, like “Job 1-5; Ps 1”. # starts a comment. Any list will do: Tyndale’s One Year Chronological, say.', sample: 'Gen 1-3\nJob 1-5; Ps 1' },
    ];
    box.replaceChildren(x('A published plan', 'None comes with the app: paste the copy you have.'));
    const body = h('div', 'plan-modal-body');
    const name = h('input', 'ask-input') as HTMLInputElement;
    name.placeholder = 'Name'; name.value = draft.name; name.setAttribute('aria-label', 'Name');
    const which = h('select', 'ask-input') as HTMLSelectElement;
    which.setAttribute('aria-label', 'Which plan is it');
    for (const f of FORMS) { const o = h('option', '', f.label) as HTMLOptionElement; o.value = f.id; which.append(o); }
    which.value = imp.format;
    const hint = h('p', 'muted small');
    const source = h('input', 'ask-input') as HTMLInputElement;
    source.placeholder = 'Where it came from, like Tyndale One Year Chronological'; source.value = imp.source; source.setAttribute('aria-label', 'Where it came from');
    const text = h('textarea', 'ask-area plan-paste') as HTMLTextAreaElement;
    text.value = imp.text; text.setAttribute('aria-label', 'The plan, as you have it');
    const dayRow = h('div', 'plan-off');
    dayRow.append(h('span', 'plan-field-label', 'Days off'), h('span', 'opt', ' optional'));
    const dayChips = h('span', 'plan-off-days');
    const offButtons = new Map<string, HTMLButtonElement>();
    for (const d of WEEK) {
      const b = h('button', 'chip link', d[0].toUpperCase() + d.slice(1)) as HTMLButtonElement;
      b.type = 'button';
      b.onclick = () => {
        const cur = new Set(imp.off ?? [...offButtons].filter(([, v]) => v.classList.contains('on')).map(([k]) => k));
        if (cur.has(d)) cur.delete(d); else cur.add(d);
        imp.off = cur;
        paintOff([...cur]);
        void check();
      };
      offButtons.set(d, b);
      dayChips.append(b);
    }
    dayRow.append(dayChips);
    const paintOff = (on: string[]) => offButtons.forEach((b, d) => { b.classList.toggle('on', on.includes(d)); b.setAttribute('aria-pressed', String(on.includes(d))); });
    const summary = h('div', 'plan-summary');
    const l1 = h('div', 'plan-summary-line'), l2 = h('div', 'muted small'), l3 = h('div', 'muted small');
    summary.append(l1, l2, l3);
    const st = h('div'); // the start day, as in the form
    const stSel = h('select', 'ask-input') as HTMLSelectElement;
    stSel.setAttribute('aria-label', 'Start');
    for (const [v, t] of [['today', 'Starts today'], ['day', 'Starts on a day…']]) { const o = h('option', '', t) as HTMLOptionElement; o.value = v; stSel.append(o); }
    stSel.value = draft.start;
    const stDay = h('input', 'ask-input') as HTMLInputElement;
    stDay.type = 'date'; stDay.value = draft.day; stDay.setAttribute('aria-label', 'First day'); stDay.hidden = draft.start !== 'day';
    stSel.onchange = () => { draft.start = stSel.value as Draft['start']; stDay.hidden = draft.start !== 'day'; void check(); };
    stDay.oninput = () => { draft.day = stDay.value; void check(); };
    st.append(stSel, stDay);

    const go = h('button', 'btn primary', 'Start the plan') as HTMLButtonElement;
    const args = (dry: boolean) => ['plan', 'import', name.value.trim() || 'My plan', '--start', draft.start === 'day' ? draft.day : todayStr(), '--format', imp.format,
      ...(imp.source.trim() ? ['--source', imp.source.trim()] : []), ...(imp.off ? ['--days-off', [...imp.off].join(',') || 'none'] : []), ...(dry ? ['--dry-run'] : [])];
    let seq = 0;
    const check = async () => {
      const my = ++seq;
      hint.textContent = FORMS.find(f => f.id === imp.format)!.hint;
      text.placeholder = FORMS.find(f => f.id === imp.format)!.sample;
      go.disabled = true;
      if (!text.value.trim()) { l1.textContent = 'Paste the plan.'; l2.textContent = ''; l3.textContent = ''; l2.classList.remove('bad'); return; }
      try {
        const d = await wb(args(true), text.value);
        if (my !== seq) return;
        const found = d.format === 'guthrie' ? `Guthrie’s plan · ${plural(d.weeks, 'week')}` : d.format === 'horner' ? `Horner’s lists · ${plural(d.lists, 'list')}`
          : d.format === 'blue-letter' ? 'Blue Letter Bible’s list' : 'One day to a line';
        l1.textContent = `${found} · ${d.cycle ? `${plural(d.days, 'day')} in a round` : plural(d.days, 'day')} · ${plural(d.readings, 'reading')}`;
        l2.textContent = d.cycle ? `No end date. Each list starts again when it is done. Starts ${shortDay(d.start)}.` : `${shortDay(d.start)} to ${shortDay(d.finish)}`;
        l2.classList.remove('bad');
        l3.textContent = `Starts with ${d.first.slice(0, 2).join(' · ')}`;
        if (imp.off === null) paintOff(d.days_off || []);
        go.disabled = !name.value.trim();
      } catch (e) { if (my === seq) { l1.textContent = ''; l3.textContent = ''; l2.textContent = String(e); l2.classList.add('bad'); } }
    };
    which.onchange = () => { imp.format = which.value; void check(); };
    source.oninput = () => { imp.source = source.value; void check(); };
    text.oninput = () => { imp.text = text.value; void check(); };
    name.oninput = () => { draft.name = name.value; go.disabled = !name.value.trim() || !text.value.trim(); };
    go.onclick = async () => {
      go.disabled = true;
      try {
        const p = await wb(args(false), text.value);
        imp = freshImport();
        close(); seen.add(p.id); daysOpen.add(p.id); toast(`“${p.name}” started`); done();
      } catch (e) { l2.textContent = String(e); l2.classList.add('bad'); go.disabled = false; }
    };
    const foot = h('div', 'plan-modal-foot');
    foot.append(button('link-btn', 'Back to the form', () => { draft.name = name.value; form(); }), h('span'), button('btn', 'Cancel', close), go);
    body.append(h('div', 'plan-field-label', 'Name'), name, h('div', 'plan-field-label', 'Which plan is it'), which, hint, h('div', 'plan-field-label', 'The plan, as you have it'), text,
      h('div', 'plan-field-label', 'Where it came from'), source, dayRow, st, summary, foot);
    box.append(body);
    paintOff(imp.off ? [...imp.off] : []);
    void check();
    text.focus();
  };

  form();
}

// What the published-plan view holds, kept when the person goes back to the form and returns.
interface Import { format: string; source: string; text: string; off: Set<string> | null }
const freshImport = (): Import => ({ format: 'auto', source: '', text: '', off: null });
let imp = freshImport();
