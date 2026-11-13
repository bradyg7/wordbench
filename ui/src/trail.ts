// The trail (design/features/minimize, build go-ahead 2026-11-13; in the top bar: design/features/command round 2,
// C13-C16). Every tab opened is a step that remembers the step it was opened from; a 30-minute gap starts a new sitting.
// The line under the top bar shows the sitting, where it began and the way to the step in front, forks marked, the
// middle folded into "… N" when long. The drawer shows the sitting as a tree, side trips folded, and earlier sittings.
// Steps are kept in the study folder by `wb history add` (history/<day>.jsonl); outside the app they live only here.
import { wb } from './api';
import { app } from './app';
import type { Pane } from './dock';
import { dock, openBdb, openDefine, openSearch, openStrong, openUses } from './panes';
import { toast } from './sheets';
import { h, icon, popMenu } from './ui';

export interface Step { id: string; at: number; from: string; kind: string; title: string; line: string; key: string }

const GAP_MS = 30 * 60 * 1000;
const FOLD_OVER = 5;

let steps: Step[] = [];          // the sitting going now, oldest first
let front = '';                  // the step in front
let seq = 0;
const kept = new Map<string, string>();   // a step's id here → its id in history/ (once written)
let writing: Promise<unknown> = Promise.resolve();
let pendingLine: { line: string; at: number } | null = null;
let line: HTMLElement | null = null;
let drawer: HTMLElement | null = null;
let earlier: any[] | null = null;
let shown: () => void = () => {};

const ICON: Record<string, string> = {
  verse: 'book', reader2: 'book', place: 'book', passage: 'book', versecard: 'book', interlinear: 'book',
  strong: 'word', bdb: 'word', def: 'word', lexiconc: 'word',
  uses: 'lines', count: 'lines', forms: 'lines', marked: 'lines',
  search: 'search', find: 'search', near: 'search',
  notebook: 'notebook', shelf: 'shelf', plans: 'lines', findings: 'prompt', documents: 'file', docpreview: 'file', lesson: 'file', today: 'file',
};
export const iconOf = (kind: string) => ICON[kind] || 'file';

/** The line the command box ran, so the pane it opens can keep it (the box shows it again: command C14). */
export function noteLine(t: string) {
  pendingLine = { line: t, at: performance.now() };
}

/** The line that opens a pane again, from its key when no line was typed (a click opened it). */
function lineOf(p: Pane): string {
  if (pendingLine && performance.now() - pendingLine.at < 4000) { const l = pendingLine.line; pendingLine = null; return l; }
  const [k, a = '', b = ''] = p.key.split('|');
  switch (k) {
    case 'search': return `search ${a}`;
    case 'strong': return `strong ${a}`;
    case 'bdb': return `bdb ${a}`;
    case 'def': return `define ${a}`;
    case 'uses': return `uses ${b || a}`;
    case 'count': return `count ${a}`;
    case 'forms': return `forms ${a}`;
    case 'find': return `find ${a}`;
    case 'interlinear': return `interlinear ${a}`;
    default: return '';
  }
}

/** A step taken: added after the step in front (a 30-minute gap first starts a new sitting) and kept by wb history add. */
function take(kind: string, title: string, key: string, ln: string) {
  const now = Date.now();
  const last = steps[steps.length - 1];
  if (last && now - last.at >= GAP_MS) { steps = []; front = ''; earlier = null; }
  const cur = steps.find(s => s.id === front);
  if (cur && cur.key === key) return;            // the same tab again: not a new step
  const s: Step = { id: `t${++seq}`, at: now, from: cur?.id ?? '', kind, title, line: ln, key };
  steps.push(s);
  front = s.id;
  writing = writing.then(async () => {
    const from = s.from ? kept.get(s.from) : '';
    const argv = ['history', 'add', kind, title, '--line', ln];
    if (from) argv.push('--from', from);
    try { const r = await wb(argv); if (r?.id) kept.set(s.id, r.id); } catch { /* outside the app: the trail lives only here */ }
  });
  draw();
}

/** The reader went to a place. */
export function readerStep(label: string) {
  take('verse', label, `reader|${label}`, label);
}

/** A pane was opened (new) or brought to the front (not new: it becomes the step in front). */
export function paneStep(p: Pane, isNew: boolean) {
  if (!isNew) { focusKey(p.key); return; }
  take(p.kind, p.title, p.key, lineOf(p));
}

/** The tab with this key is in front now (pressed in): its newest step becomes the step in front. */
export function focusKey(key: string) {
  for (let i = steps.length - 1; i >= 0; i--) if (steps[i].key === key) { if (front !== steps[i].id) { front = steps[i].id; draw(); } return; }
}

export const frontStep = () => steps.find(s => s.id === front);
export const trailGoing = () => steps.length > 0;
/** Called when the step in front changes (the box shows its line). */
export function onFront(fn: () => void) { shown = fn; }

/** Brings a step's tab to the front: an open pane is shown; the reader goes to its place; a closed tab opens again. */
async function goStep(s: Step) {
  front = s.id;
  draw();
  if (s.key.startsWith('reader|')) { await app.run?.(`go ${s.line}`); return; }
  const open = dock.find(s.key);
  if (open) { dock.show(open); return; }
  const [k, a = '', b = '', c = ''] = s.key.split('|');
  if (k === 'search') openSearch(a, b || 'all');
  else if (k === 'strong') openStrong(a);
  else if (k === 'bdb') openBdb(a);
  else if (k === 'def') openDefine(a);
  else if (k === 'uses') openUses(a, b, c || 'all');
  else if (s.line) await app.run?.(s.line);
  else toast(`${s.title} was closed, and there is no line to open it again`);
}

function path(): Step[] {
  const out: Step[] = [];
  let at: Step | undefined = steps.find(s => s.id === front) ?? steps[steps.length - 1];
  while (at && out.length < 200) { const cur: Step = at; out.unshift(cur); at = steps.find(s => s.id === cur.from); }
  return out;
}
const forks = (s: Step) => steps.filter(x => x.from === s.id).length > 1;
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function stepButton(s: Step, last: boolean): HTMLElement {
  const b = h('button', `trail-step${last ? ' on' : ''}`);
  b.title = s.line ? `${s.title} · ${s.line}` : s.title;
  b.append(icon(iconOf(s.kind), 13), h('span', 'trail-title', s.title));
  b.onclick = () => void goStep(s);
  return b;
}

/** Draws the line under the top bar. */
export function draw() {
  shown();
  if (!line) return;
  line.replaceChildren();
  const chip = h('button', 'trail-chip');
  chip.append(icon('trail', 13), h('span', '', steps.length ? `Today ${clock(steps[0].at)}` : 'Trail'), icon('down', 11));
  chip.title = 'Sittings: this one and earlier ones';
  chip.onclick = () => void sittingsMenu(chip);
  line.append(chip);
  const p = path();
  if (!p.length) { line.append(h('span', 'muted small', 'Every tab you open joins the trail.')); }
  const fold = p.length > FOLD_OVER ? p.length - 4 : 0;
  p.forEach((s, i) => {
    if (fold && i >= 1 && i <= fold) {
      if (i === 1) {
        line!.append(icon('right', 12));
        const f = h('button', 'trail-fold', `… ${fold}`);
        f.title = 'Show the whole trail';
        f.onclick = () => openTrail();
        line!.append(f);
      }
      return;
    }
    if (i) line!.append(icon('right', 12));
    line!.append(stepButton(s, i === p.length - 1));
    if (forks(s)) line!.append(h('span', 'trail-fork'));
  });
  line.append(h('span', 'grow'));
  const nForks = steps.filter(forks).length;
  if (steps.length) line.append(h('span', 'muted small trail-count', `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}${nForks ? ` · ${nForks} ${nForks === 1 ? 'fork' : 'forks'}` : ''}`));
  if (drawer) drawDrawer();
}

async function loadEarlier(): Promise<any[]> {
  if (earlier) return earlier;
  try { earlier = (await wb(['history', 'sittings', '--days', '30'])).sittings || []; } catch { earlier = []; }
  return earlier!;
}

const isNow = (s: any) => steps.length > 0 && kept.get(steps[0].id) === s.start;

async function sittingsMenu(from: HTMLElement) {
  const box = h('div', 'trail-sittings');
  box.append(h('div', 'label', 'Today'));
  if (steps.length) {
    const r = h('button', 'menu-item more-item on');
    r.append(icon('trail', 15), h('span', 'more-text', `${clock(steps[0].at)} · ${steps[0].title}`), h('span', 'muted small', `${steps.length} steps · going`));
    r.onclick = () => openTrail();
    box.append(r);
  }
  const list = (await loadEarlier()).filter(s => !isNow(s));
  if (list.length) {
    box.append(h('div', 'label', 'Earlier'));
    for (const s of list.slice(0, 12)) {
      const r = h('button', 'menu-item more-item');
      const day = new Date(s.at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      r.append(icon('trail', 15), h('span', 'more-text', `${day} ${clock(Date.parse(s.at))} · ${s.title}`), h('span', 'muted small', `${s.count} steps`));
      r.onclick = () => void keepAsPage(s.start);
      r.title = 'Keep this sitting as a page';
      box.append(r);
    }
    if (list.length > 12) box.append(h('div', 'muted small', `${list.length - 12} more in the last 30 days (wb history sittings)`));
  }
  const all = h('button', 'menu-item more-item');
  all.append(icon('sidebar', 15), h('span', 'more-text', 'Show the whole trail'));
  all.onclick = () => openTrail();
  box.append(all);
  popMenu(from, box, { width: 340 });
}

async function keepAsPage(start: string) {
  try {
    await writing;
    const r = await wb(['history', 'keep', start]);
    app.changed?.('notes');
    toast(r?.id ? 'Kept as a page in the Inbox' : 'Kept as a page');
  } catch (e) { toast(String((e as Error).message || e)); }
}

/** The tree of the sitting, side trips folded (a step's children after the first start folded). */
function drawDrawer() {
  if (!drawer) return;
  const body = drawer.querySelector<HTMLElement>('.trail-tree')!;
  body.replaceChildren();
  const head = drawer.querySelector<HTMLElement>('.trail-head-sub')!;
  head.textContent = steps.length ? `Began at ${steps[0].title}, ${clock(steps[0].at)} · ${steps.length} steps` : 'Nothing yet: every tab you open joins the trail.';
  const kids = (id: string) => steps.filter(s => s.from === id);
  const onPath = new Set(path().map(s => s.id));
  const row = (s: Step, depth: number) => {
    const r = h('div', `trail-node${s.id === front ? ' on' : ''}`);
    r.style.paddingLeft = `${6 + depth * 16}px`;
    const b = stepButton(s, s.id === front);
    const open = s.key.startsWith('reader|') || !!dock.find(s.key);
    r.append(b, h('span', 'muted small', `${open ? '' : 'closed · '}${clock(s.at)}`));
    body.append(r);
    const ks = kids(s.id);
    ks.forEach((k, i) => {
      // a side trip off the way in front is folded to one line until opened
      if (i > 0 && !onPath.has(k.id) && !r.dataset.open) {
        const more = h('button', 'trail-more link-btn', `${countUnder(k)} on a side trip from ${s.title}`);
        more.style.paddingLeft = `${22 + (depth + 1) * 16}px`;
        more.onclick = () => { more.replaceWith(...subtree(k, depth + 1)); };
        body.append(more);
        return;
      }
      row(k, depth + (ks.length > 1 ? 1 : 0));
    });
  };
  const subtree = (s: Step, depth: number): HTMLElement[] => {
    const before = body.children.length;
    row(s, depth);
    return Array.from(body.children).slice(before).map(x => x as HTMLElement);
  };
  const countUnder = (s: Step): number => 1 + kids(s.id).reduce((n, k) => n + countUnder(k), 0);
  for (const r of steps.filter(s => !s.from)) row(r, 0);
}

/** The drawer: this sitting as a tree, Back to the start, Keep as a page. Opened by the rail's Trail, the chip and "… N". */
export function openTrail() {
  if (drawer) { drawer.remove(); drawer = null; return; }
  drawer = h('aside', 'trail-drawer');
  drawer.setAttribute('aria-label', 'The trail');
  const head = h('div', 'trail-head');
  const t = h('div', 'grow');
  t.append(h('h2', 'pane-title', 'This trail'), h('div', 'muted small trail-head-sub'));
  const x = h('button', 'icon-btn');
  x.append(icon('x', 14));
  x.title = 'Close';
  x.onclick = () => openTrail();
  head.append(t, x);
  const acts = h('div', 'trail-acts');
  const start = h('button', 'btn', 'Back to the start');
  start.onclick = () => { if (steps[0]) void goStep(steps[0]); };
  const keep = h('button', 'btn', 'Keep as a page');
  keep.onclick = async () => { await writing; const id = steps[0] && kept.get(steps[0].id); if (id) void keepAsPage(id); else toast('The trail is kept in the app only'); };
  acts.append(start, keep);
  drawer.append(head, acts, h('div', 'trail-tree'));
  document.body.append(drawer);
  drawDrawer();
}

export function initTrail(host: HTMLElement) {
  line = host;
  // a press in a pane or the reader puts its newest step in front
  document.addEventListener('pointerdown', e => {
    const t = e.target as Element;
    if (t.closest?.('#trailline, .trail-drawer, .menu, .popover')) return;
    const g = t.closest?.('.dock-group') as HTMLElement | null;
    const p = g?.dataset.front ? dock.panes.find(x => x.id === g.dataset.front) : undefined;
    if (p) focusKey(p.key);
    else if (t.closest?.('#scroller')) { const r = [...steps].reverse().find(s => s.key.startsWith('reader|')); if (r) focusKey(r.key); }
  }, true);
  draw();
}
