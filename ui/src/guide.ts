// The Guide as cards, Keys and the Manual: Help's half of the Settings menu (design/features/help, accepted
// 2026-11-13). One card per thing done, in four groups; the steps wait until the parts they guide are finished.
// No scripture, no interpretation: only how the app works.
import { wb } from './api';
import { app } from './app';
import { KEYS } from './panes';
import { button, h, icon } from './ui';

export interface Card { task: string; ico: string }

// The cards' steps come last (the person, 2026-11-13): Help is finished after the features it guides, so every step
// describes the window as it then is. Until then each card names what it will guide, and says the guide is coming.
export const GUIDE: [string, Card[]][] = [
  ['Reading', [
    { task: 'Read a chapter', ico: 'book' }, { task: 'Copy verses', ico: 'copy' },
    { task: 'Find on the page', ico: 'search' }, { task: 'Text size and full screen', ico: 'eye' }]],
  ['Looking up', [
    { task: 'Look up a word', ico: 'search' }, { task: 'The interlinear', ico: 'lines' },
    { task: 'Every use of a word', ico: 'search' }]],
  ['Keeping', [
    { task: 'Write on a verse', ico: 'pen' }, { task: 'Ask a question', ico: 'help' },
    { task: 'Keep places together', ico: 'threads' }, { task: 'The Shelf', ico: 'shelf' },
    { task: 'A list that keeps itself up to date', ico: 'filter' }]],
  ['Making', [
    { task: 'Start a page from a template', ico: 'notebook' }, { task: 'Make a template', ico: 'notebook' },
    { task: 'Make a document', ico: 'file' }]],
];

/** Does this computer have a keyboard? A touch device has none until a key is pressed (a keyboard attached). */
let keyed = false;
addEventListener('keydown', () => { keyed = true; }, { capture: true, once: true });
export function hasKeyboard(input: string): boolean {
  if (input === 'pointer') return true;
  if (input === 'touch') return keyed;
  return keyed || !matchMedia('(pointer: coarse)').matches;
}

/** The Guide: each group a heading and a grid of cards. `focus`: a group (or a card's words) to outline. */
export function guideRows(focus = ''): HTMLElement[] {
  const f = focus.toLowerCase();
  const out: HTMLElement[] = [h('p', 'muted small guide-soon-note', 'Guides coming soon: each card will show its steps once the part it guides is finished.')];
  for (const [group, cards] of GUIDE) {
    const g = h('div', 'guide-group');
    g.dataset.find = `${group} ${cards.map(c => c.task).join(' ')}`.toLowerCase();
    g.append(h('h4', 'guide-group-name', group));
    const grid = h('div', 'guide-cards');
    for (const c of cards) {
      const card = h('article', 'guide-card');
      card.dataset.find = c.task.toLowerCase();
      if (f && (group.toLowerCase() === f || c.task.toLowerCase().includes(f))) card.classList.add('focus');
      const head = h('div', 'guide-card-head');
      head.append(icon(c.ico, 16), h('h5', '', c.task));
      card.append(head, h('div', 'muted small guide-soon', 'Coming soon'));
      grid.append(card);
    }
    g.append(grid);
    out.push(g);
  }
  return out;
}

const ROWS = ['Esc F1 F11', '` 1 2 3 4 5 6 7 8 9 0 - =', 'Q W E R T Y U I O P [ ]', 'A S D F G H J K L ; \'',
  'Z X C V B N M , . /', 'Ctrl Shift Alt ← →'];

/** The keys of a shortcut, as drawn on the keyboard: "Ctrl+=" lights Ctrl and =. */
const capsOf = (k: string): string[] => k.replace(/ in the command field|Right-click a verse|Ctrl\+click a reference/g, '')
  .split(/[\s/+]+/).map(x => x === 'Alt' || x === 'Ctrl' || x === 'Shift' ? x : x.length <= 3 ? x.toUpperCase() : '').filter(Boolean);

/** Keys: the keyboard, then each key with what it does; a click on either lights both. */
export function keysRows(): HTMLElement[] {
  const kb = h('div', 'kb');
  kb.setAttribute('aria-hidden', 'true');
  const caps = new Map<string, HTMLElement>();
  const used = new Set(KEYS.flatMap(([k]) => capsOf(k)));
  for (const line of ROWS) {
    const r = h('div', 'kb-row');
    for (const k of line.split(' ')) {
      const c = h('span', `kb-key${k.length > 1 && !/^F\d+$/.test(k) && k !== 'Esc' ? ' wide' : ''}${used.has(k.toUpperCase()) || used.has(k) ? ' used' : ''}`, k);
      caps.set(k.toUpperCase(), c);
      r.append(c);
    }
    kb.append(r);
  }
  const holder = h('div', 'kb-wrap');
  holder.dataset.find = KEYS.map(([k, w]) => `${k} ${w}`).join(' ').toLowerCase();
  holder.append(kb);
  const out: HTMLElement[] = [holder];
  const rows: HTMLElement[] = [];
  for (const [k, what] of KEYS) {
    const r = h('button', 'key-line');
    r.dataset.find = `${k} ${what} key shortcut keyboard`.toLowerCase();
    r.append(h('kbd', 'set-kbd', k), h('span', 'small', what));
    r.onclick = () => {
      for (const x of rows) x.classList.toggle('on', x === r);
      for (const c of caps.values()) c.classList.remove('lit');
      for (const c of capsOf(k)) caps.get(c.toUpperCase())?.classList.add('lit');
    };
    rows.push(r);
    out.push(r);
  }
  const note = h('p', 'muted small key-note', 'Quick capture’s key is set under Notebook, a layout’s under Layouts, a kept command’s under Commands.');
  note.dataset.find = 'change set rebind key';
  out.push(note);
  return out;
}

/** The Manual: what the command field understands (`wb manual`), each command a row that opens. */
export async function manualRows(open = ''): Promise<HTMLElement[]> {
  const m = await wb(['manual']);
  const out: HTMLElement[] = [h('p', 'muted small', 'What the command field understands. Press ` to open it.')];
  for (const [sec, title] of m.sections) {
    const docs = m.docs.filter((d: any) => d.section === sec);
    if (!docs.length) continue;
    const label = h('div', 'label', title);
    label.dataset.find = docs.map((d: any) => `${d.name} ${d.what}`).join(' ').toLowerCase();
    out.push(label);
    for (const d of docs) {
      const det = h('details', 'doc');
      det.dataset.find = JSON.stringify(d).toLowerCase();
      det.dataset.name = d.name;
      det.open = !!open && d.name === open;
      const sum = h('summary');
      sum.append(h('code', '', d.name), document.createTextNode(` ${d.what}`));
      det.append(sum);
      for (const u of d.usage) det.append(h('code', 'doc-usage', u));
      for (const x of d.details) det.append(h('p', 'small', x));
      for (const [typed, what] of d.examples || []) {
        const ex = h('div', 'doc-example');
        ex.append(button('btn small', typed, () => app.run(typed)), h('span', 'muted small', ` ${what}`));
        det.append(ex);
      }
      out.push(det);
    }
  }
  return out;
}
