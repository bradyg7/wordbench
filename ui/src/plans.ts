// Reading plans (wb plan …, wb read …), phase 2b tier 3: the plan in its pane (P1: today's card, the days, days that were
// missed and the four things to do about them, P2), the form that makes one (R1, A2: what to read, order, pace, days off,
// a summary before starting) and Past plans (a stopped plan waits there to be used again or deleted, note 2885).
// Nothing here reminds, nags or counts streaks: it says where the person is, and what each choice does to the dates.
import { wb } from './api';
import { app, goTo } from './app';
import type { Side } from './dock';
import { dock } from './panes';
import { toast } from './sheets';
import { button, h, icon, popMenu } from './ui';

const MINE: Side = 'right';

function head(el: HTMLElement, title: string, sub?: string) {
  const hd = h('header', 'pane-head');
  hd.append(h('h2', 'pane-title', title));
  if (sub !== undefined) hd.append(h('div', 'pane-sub', sub));
  el.append(hd);
  return hd;
}

// A small form beside a button: one field (or a text box); OK runs `ok` with what was typed, and an error stays in the form.
function ask(from: HTMLElement, label: string, value: string, ok: (v: string) => Promise<unknown>, opts: { area?: boolean; type?: string } = {}) {
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
const dayName = (d: string, long = false) => new Date(`${d}T12:00`).toLocaleDateString(undefined, long ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
const shortDay = (d: string) => new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const todayStr = () => new Date().toLocaleDateString('en-CA');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// What is open stays open when the pane is drawn again (after a change to a plan).
const daysOpen = new Set<string>();
const seen = new Set<string>();
const choicesOpen = new Set<string>();
let pastOpen = false;

export function openPlans() {
  return dock.open('plans', 'Reading plans', 'plans', MINE, async (into, pane) => {
    // drawn apart and put in the pane only if no newer draw started meanwhile (two at once would show each plan twice)
    const my = ++plansDraw, el = h('div');
    const redraw = () => { void pane.refresh?.(); };
    head(el, 'Reading plans', 'Where you are in each plan, and what you have read');
    const [list, today, past, overall]: any[] = await Promise.all([wb(['plan', 'list']), wb(['plan', 'today']), wb(['plan', 'past']), wb(['read', 'progress'])]);

    const bar = h('div', 'wrap plan-bar-row');
    bar.append(button('btn primary', 'New plan', () => openPlanForm(redraw), 'pen'));
    el.append(bar);

    for (const p of list) el.append(planCard(p, (today.plans || []).find((x: any) => x.id === p.id), redraw));
    if (!list.length) el.append(h('p', 'muted', 'No reading plans going.'));

    // past plans: stopped or finished, to use again or delete
    const pastBox = h('div', 'plan-past');
    const toggle = button('link-btn', `Past plans (${past.length})`, () => { pastOpen = !pastOpen; pastList.hidden = !pastOpen; });
    toggle.dataset.act = 'past';
    const pastList = h('div', 'plan-past-list');
    pastList.hidden = !pastOpen;
    for (const p of past) pastList.append(pastRow(p, redraw));
    if (!past.length) pastList.append(h('p', 'muted small', 'A plan you stop, or finish, waits here to be used again.'));
    pastBox.append(toggle, pastList);
    el.append(pastBox);

    // what you have read, from the reading log
    el.append(h('div', 'label', 'What you have read'));
    el.append(h('p', 'small plan-overall', `${overall.chapters} of ${overall.of} chapters (${overall.percent}%)`));
    const chips = h('div', 'chips');
    for (const b of overall.books) chips.append(h('span', 'chip', `${b.book} ${b.read}/${b.of}`));
    el.append(chips);
    if (my === plansDraw) into.replaceChildren(...el.childNodes);
  });
}
let plansDraw = 0;

// ---- one plan -------------------------------------------------------------------------------------------------------------

function planCard(p: any, t: any, redraw: () => void): HTMLElement {
  const card = h('section', 'plan-card');
  card.dataset.plan = p.id;
  if (!seen.has(p.id)) { seen.add(p.id); daysOpen.add(p.id); }
  const change = async (args: string[], input?: string) => { await wb(['plan', 'edit', p.id, ...args], input); redraw(); };
  card.append(h('h3', 'plan-title', p.name));
  const bar = h('div', 'plan-bar');
  const fill = h('span');
  fill.style.width = `${p.days ? Math.round((p.done * 100) / p.days) : 0}%`;
  bar.append(fill);
  card.append(bar);

  // the days before today not read (today's own day is not missed yet)
  const missed: any[] = p.dated ? (t?.to_read || []).filter((d: any) => d.day !== p.today) : [];
  const rest = p.days_off?.length ? ` · rests ${p.days_off.map((d: string) => d[0].toUpperCase() + d.slice(1)).join(', ')}` : '';
  const where = p.finished ? `Finished · ${plural(p.days, 'day')}`
    : !p.dated ? `${p.done} of ${p.days} read · no dates`
    : p.today == null && p.start > todayStr() ? `Starts ${dayName(p.start)} · ${plural(p.days, 'day')}`
    : p.today == null ? `A day off${p.next ? ` · next ${dayName(p.next.date)}` : ''}`
    : `Day ${p.today} of ${p.days} · ${p.done} read` + (missed.length ? ` · ${missed.length} not read` : '') + (p.ahead ? ` · ${p.ahead} ahead` : '');
  card.append(h('div', 'muted small plan-where', where + rest));

  // days that were not read: what to do, each choice saying what it does to the dates (P2)
  if (missed.length) {
    const box = h('div', 'plan-missed');
    const open = choicesOpen.has(p.id);
    const line = h('div', 'plan-missed-line');
    line.append(h('span', '', `${plural(missed.length, 'day was', 'days were')} not read.`),
      button('btn small', open ? 'Not now' : 'What should happen?', () => { if (open) choicesOpen.delete(p.id); else choicesOpen.add(p.id); redraw(); }));
    box.append(line);
    if (open) void missedChoices(p, box, redraw);
    card.append(box);
  }

  // today's reading (or the next, on a day off, or in a plan with no dates)
  const now = t?.today && !t.today.done ? t.today : null;
  const shown = now || (p.finished ? null : p.next);
  if (shown) {
    const box = h('div', 'plan-today');
    box.append(h('div', 'plan-today-label', now ? 'Today' : 'Next'));
    const title = h('div', 'plan-today-title', shown.label);
    box.append(title);
    if (!now && shown.date) box.append(h('div', 'muted small', dayName(shown.date)));
    const acts = h('div', 'wrap');
    acts.append(button('btn primary', 'Read', entryGo(shown.entries), 'book'),
      button('btn', 'Mark read', async () => { try { await wb(['plan', 'done', p.id, '--day', String(shown.day)]); redraw(); } catch (x) { toast(String(x)); } }, 'check'));
    box.append(acts);
    card.append(box);
  } else if (!p.finished && now == null && t?.today?.done) {
    card.append(h('p', 'muted small', 'Today’s reading is read.'));
  }

  // the days: drag one to move it; a ✓ is read
  const days = h('div', 'plan-days');
  days.hidden = !daysOpen.has(p.id);
  const fillDays = async () => {
    const full = await wb(['plan', 'show', p.id]);
    const rows: HTMLElement[] = [];
    for (const d of full.schedule) {
      const late = full.dated && !d.done && !d.skipped && d.date < todayStr();
      const row = h('div', `plan-row${d.done ? ' done' : ''}${d.skipped ? ' skipped' : ''}`);
      row.dataset.day = String(d.day);
      row.draggable = true;
      const grip = h('span', 'grip');
      grip.append(icon('grip', 14));
      const tag = d.done ? '✓' : d.skipped ? 'skipped' : late ? 'missed' : d.day === full.today ? 'today' : d.date ? shortDay(d.date) : '';
      const tagEl = h('span', `plan-tag${late ? ' late' : ''}${d.done ? ' tick' : ''}`, tag);
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

  const acts = h('div', 'wrap plan-acts');
  acts.append(button('btn', 'Days', async () => {
    days.hidden = !days.hidden;
    if (days.hidden) daysOpen.delete(p.id); else daysOpen.add(p.id);
    if (days.hidden || days.childElementCount) return;
    await fillDays();
  }));
  acts.append(button('btn', 'Rename…', e => ask(e.currentTarget as HTMLElement, 'Name', p.name, v => change(['--rename', v]))));
  acts.append(button('btn', 'Start day…', e => ask(e.currentTarget as HTMLElement, 'The plan’s first day', p.start, v => change(['--start', v]), { type: 'date' })));
  acts.append(button('btn', 'Edit as text…', async e => {
    const from = e.currentTarget as HTMLElement;
    const text = await wb(['plan', 'text', p.id]);
    ask(from, 'One day to a line, places joined by ; (what you have read stays read)', String(text), v => change(['--text', '-'], v), { area: true });
  }));
  acts.append(button('link-btn danger', 'Stop', async () => {
    await wb(['plan', 'stop', p.id]);
    daysOpen.delete(p.id); choicesOpen.delete(p.id);
    toast(`“${p.name}” is stopped; it waits in Past plans`);
    redraw();
  }));
  card.append(acts, days);
  return card;
}

// The four choices for days that were not read; each says what it does to the dates before it is done.
async function missedChoices(p: any, into: HTMLElement, redraw: () => void) {
  let o: any;
  try { o = await wb(['plan', 'missed', p.id]); } catch (x) { into.append(h('p', 'muted small', String(x))); return; }
  const panel = h('div', 'plan-choices');
  panel.append(h('div', 'plan-choices-title', `${plural(o.missed, 'day was', 'days were')} not read. What should happen?`));
  const names: Record<string, string> = { shift: 'Pick up where I left off', fit: 'Fit them into the days left', later: 'Leave them for later', skip: 'Skip them' };
  let chosen = (o.options.find((x: any) => x.available) || {}).choice as string | undefined;
  const rows: HTMLElement[] = [];
  for (const x of o.options) {
    const row = h('label', `plan-choice${x.available ? '' : ' off'}`);
    const radio = h('input') as HTMLInputElement;
    radio.type = 'radio'; radio.name = `missed-${p.id}`; radio.value = x.choice; radio.disabled = !x.available; radio.checked = x.choice === chosen;
    radio.onchange = () => { chosen = x.choice; rows.forEach(r => r.classList.toggle('on', r === row)); };
    const text = h('div');
    text.append(h('div', 'plan-choice-name', names[x.choice]), h('div', 'muted small', x.text));
    row.classList.toggle('on', x.choice === chosen);
    row.append(radio, text);
    rows.push(row);
    panel.append(row);
  }
  const acts = h('div', 'wrap plan-choices-acts');
  acts.append(button('link-btn', 'Not now', () => { choicesOpen.delete(p.id); redraw(); }),
    button('btn primary', 'Do it', async () => {
      if (!chosen) return;
      try { await wb(['plan', 'missed', p.id, `--${chosen}`]); choicesOpen.delete(p.id); toast(`${names[chosen]}: done. The plan as it was is in .trash`); redraw(); } catch (x) { toast(String(x)); }
    }));
  panel.append(acts);
  into.append(panel);
}

// A past plan: stopped or finished, with how far it got.
function pastRow(p: any, redraw: () => void): HTMLElement {
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
interface Draft {
  name: string; chips: Chip[]; passages: string[];
  order: 'bible' | 'listed' | 'side-by-side';
  pace: 'days' | 'by' | 'chapters' | 'own'; n: string; by: string;
  start: 'today' | 'day'; day: string; off: Set<string>;
}
const freshDraft = (): Draft => ({ name: '', chips: [], passages: [], order: 'bible', pace: 'days', n: '30', by: '', start: 'today', day: todayStr(), off: new Set() });
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

const argv = (d: Draft, dry: boolean) => {
  const a = ['plan', 'start', d.name.trim() || 'My plan'];
  if (d.chips.length) a.push('--books', d.chips.flatMap(c => c.codes).join(','));
  if (d.passages.length) a.push('--passages', d.passages.join('; '));
  a.push('--order', d.order);
  a.push('--pace', d.pace === 'own' ? 'own' : d.pace === 'by' ? `by:${d.by}` : `${d.pace}:${d.n}`);
  if (d.off.size) a.push('--days-off', [...d.off].join(','));
  a.push('--start', d.start === 'day' ? d.day : todayStr());
  if (dry) a.push('--dry-run');
  return a;
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
  const close = () => { wrap.remove(); document.removeEventListener('keydown', key, true); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', key, true);
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
    box.replaceChildren(x('New reading plan', 'Only a name and what to read are needed.'));
    const body = h('div', 'plan-modal-body');
    const label = (t: string, req?: boolean) => { const l = h('div', 'plan-field-label', t); l.append(h('span', req ? 'req' : 'opt', req ? ' required' : ' optional')); return l; };

    // Start from
    const from = h('div', 'plan-presets');
    from.append(h('span', 'muted small', 'Start from'));
    for (const p of PRESETS) {
      from.append(button('chip link', p.label, () => { draft = { ...freshDraft(), name: p.name, chips: p.codes(), order: p.order || 'bible', n: p.n }; form(); }));
    }
    from.append(button('chip link', 'A published plan…', () => importView()));
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
      rm.onclick = () => { draft.chips.splice(k, 1); form(); };
      chip.append(rm);
      what.append(chip);
    });
    draft.passages.forEach((p, k) => {
      const chip = h('span', 'chip plan-chip', p);
      const rm = h('button', 'chip-x');
      rm.setAttribute('aria-label', `Take out ${p}`);
      rm.append(icon('x', 10));
      rm.onclick = () => { draft.passages.splice(k, 1); form(); };
      chip.append(rm);
      what.append(chip);
    });
    what.append(button('chip nb-add', '+ Books…', () => booksView()),
      button('chip nb-add', '+ A passage…', e => ask(e.currentTarget as HTMLElement, 'A passage, like Psalm 23 or Isaiah 53:1-12', '', async v => {
        const t = v.trim();
        if (!t) return;
        await wb(['plan', 'start', 'X', '--passages', t, '--days', '1', '--dry-run']); // says what is wrong with it
        draft.passages.push(t); form();
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
    const o = h('div'); o.append(label('Order'), sel([['bible', 'Bible order'], ['listed', 'As listed'], ['side-by-side', 'Old and New side by side']], draft.order, v => { draft.order = v as Draft['order']; refresh(); }, 'Order'));
    const pace = h('div'); pace.append(label('Pace'), sel([['days', 'Finish in N days'], ['by', 'Finish by a day'], ['chapters', 'N chapters a day'], ['own', 'My own pace, no dates']], draft.pace, v => { draft.pace = v as Draft['pace']; form(); }, 'Pace'));
    const num = h('input', 'ask-input') as HTMLInputElement;
    num.setAttribute('aria-label', 'Number');
    if (draft.pace === 'by') { num.type = 'date'; num.value = draft.by; num.oninput = () => { draft.by = num.value; refresh(); }; }
    else { num.type = 'number'; num.min = '1'; num.value = draft.n; num.oninput = () => { draft.n = num.value; refresh(); }; }
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

    // The summary, and Start
    const summary = h('div', 'plan-summary');
    const l1 = h('div', 'plan-summary-line'), l2 = h('div', 'muted small');
    summary.append(l1, l2);
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
      if (!draft.chips.length && !draft.passages.length) { l1.textContent = 'Choose what to read.'; l2.textContent = ''; return; }
      try {
        const d = await wb(argv(draft, true));
        if (my !== seq) return;
        const books = new Set(draft.chips.flatMap(c => c.codes)).size;
        l1.textContent = [books ? plural(books, 'book') : '', `${d.readings} readings`, d.dated ? plural(d.days, 'day') : 'no dates'].filter(Boolean).join(' · ');
        l2.textContent = d.dated
          ? `About ${(d.readings / d.days).toFixed(d.readings / d.days >= 10 ? 0 : 1).replace(/\.0$/, '')} a day, ${shortDay(d.start)} to ${shortDay(d.finish)}`
          : 'Read at your own pace; each reading waits as a day';
        l2.classList.remove('bad');
      } catch (e) { if (my === seq) { l1.textContent = ''; l2.textContent = String(e); l2.classList.add('bad'); go.disabled = true; } }
    };
    go.onclick = async () => {
      go.disabled = true;
      try {
        const p = await wb(argv(draft, false));
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

  // A2: choose books, several at once
  const booksView = () => {
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
        }
        form();
      }));
    body.append(foot);
    box.append(body);
    count();
  };

  // A published plan, or one of your own: one day to a line
  const importView = () => {
    box.replaceChildren(x('A plan from a list', 'One day to a line, places joined by ; (Gen 1-3; Ps 1). # starts a comment.'));
    const body = h('div', 'plan-modal-body');
    const name = h('input', 'ask-input') as HTMLInputElement;
    name.placeholder = 'Name'; name.value = draft.name; name.setAttribute('aria-label', 'Name');
    const text = h('textarea', 'ask-area') as HTMLTextAreaElement;
    text.placeholder = 'Gen 1-3\nJob 1-5; Ps 1'; text.setAttribute('aria-label', 'The plan, one day to a line');
    const err = h('p', 'muted small');
    const foot = h('div', 'plan-modal-foot');
    foot.append(button('link-btn', 'Back to the form', () => { draft.name = name.value; form(); }), h('span'), button('btn', 'Cancel', close),
      button('btn primary', 'Start the plan', async () => {
        try {
          const p = await wb(['plan', 'import', name.value.trim() || 'My plan', '--start', draft.start === 'day' ? draft.day : todayStr()], text.value);
          close(); seen.add(p.id); daysOpen.add(p.id); toast(`“${p.name}” started`); done();
        } catch (e) { err.textContent = String(e); }
      }));
    body.append(h('div', 'plan-field-label', 'Name'), name, h('div', 'plan-field-label', 'The plan'), text, err, foot);
    box.append(body);
  };

  form();
}
