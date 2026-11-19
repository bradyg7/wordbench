// The one search's kinds (design/features/marks, MK-4, MK-12, M21; marks T12, rows 51 and 52).
// - The kinds are one menu at the start of the search field, with counts; choosing one narrows the results and shows as one
//   line of text. No chips, no side list of kinds.
// - Margin notes (row 52): a result opens the reader at that chapter with the margin showing that note; Back returns.
// - Marks (row 51): `wb find --kind mark` with its filters as simple controls (kind, legend entry, book, date); a result
//   opens the reader there; Back returns.
import { wb } from './api';
import { app, goTo } from './app';
import { sampleOf, type Kind } from './markbar';
import { toast } from './sheets';
import { button, h, popMenu } from './ui';

export const KINDS: [string, string][] = [['', 'Everything'], ['page', 'Pages'], ['save', 'Saves'], ['question', 'Questions'], ['margin', 'Margin notes'], ['highlight', 'Highlights'], ['mark', 'Marks']];
export const kindName = (k: string) => KINDS.find(x => x[0] === k)?.[1] || 'Everything';

/** The menu button at the start of the search field: "Everything ▾", or the kind chosen. */
export function kindButton(current: () => string, words: () => string, choose: (kind: string) => void): HTMLButtonElement {
  const b = h('button', 'nb-kind') as HTMLButtonElement;
  b.type = 'button';
  const label = () => { b.textContent = `${kindName(current())} ▾`; };
  label();
  b.setAttribute('aria-haspopup', 'menu');
  b.onclick = async () => {
    const box = h('div', 'menu-list nb-kinds');
    let counts: Record<string, number> = {};
    try {
      const w = words().trim();
      const r = await wb(['find', ...(w ? [w] : []), '--sort', 'edited']);
      for (const g of r.groups) counts[g.kind] = g.count;
    } catch { counts = {}; }
    const total = Object.entries(counts).filter(([k]) => k !== 'folder').reduce((a, [, n]) => a + n, 0);
    for (const [k, name] of KINDS) {
      const n = k ? counts[k] : total;
      const it = h('button', `menu-item${current() === k ? ' on' : ''}`, `${name}${n === undefined ? '' : ` · ${n}`}`);
      it.dataset.kind = k;
      it.onclick = () => { close(); choose(k); label(); };
      box.append(it);
    }
    const close = popMenu(b, box, { width: 240 });
  };
  return b;
}

/** Where the reader was before a result opened it: the line "Back to …" returns it (the reader's place is kept). */
let cameFrom: string | null = null;
const readerPlace = () => (app.drawn ? `${app.drawn.chapter.name} ${app.drawn.chapter.chapter}:${app.topVerse()}` : 'where you were');

/** Open the reader from a result; the line "Back to …" is put at the head of `host`. */
function openFromResult(host: HTMLElement, open: () => unknown) {
  cameFrom ||= readerPlace();
  void open();
  showReturn(host);
}
function showReturn(host: HTMLElement) {
  host.querySelector('.nb-return')?.remove();
  if (!cameFrom) return;
  const b = button('link-btn nb-return', `Back to ${cameFrom}`, () => {
    cameFrom = null;
    b.remove();
    if (!app.back()) toast('Nothing to go back to');
  });
  host.prepend(b);
}

/** What a kind's search finds, as plain rows: each opens where it lives. */
export async function kindResults(kind: string, words: string, host: { openPage: (id: string) => void }): Promise<HTMLElement> {
  if (kind === 'mark') return markResults(words);
  const r = await wb(['find', ...(words.trim() ? [words.trim()] : []), '--kind', kind]);
  const scroll = h('div', 'nb-scroll nb-kind-results');
  const list = h('div', 'nb-klist');
  scroll.append(h('p', 'muted small nb-kind-line', `${kindName(kind)} · ${r.count}${r.total !== r.count ? ` of ${r.total}` : ''}`), list);
  for (const g of r.groups) {
    for (const row of g.results) {
      const it = h('button', 'nb-item');
      it.dataset.id = String(row.id);
      it.append(h('div', 'nb-item-title', row.title || 'Untitled'));
      if (row.snippet) it.append(h('div', 'nb-item-preview', String(row.snippet).split('\n')[0]));
      it.onclick = () => {
        if (g.kind === 'highlight') void goTo(row.title);
        else if (g.kind === 'save') void goTo(row.ref || row.title);
        else if (g.kind === 'margin') openFromResult(list, () => app.showMarginNote(row.id, row.at));   // row 52
        else host.openPage(row.id);
      };
      list.append(it);
    }
  }
  if (!r.count) list.append(h('p', 'muted nb-empty', `No ${kindName(kind).toLowerCase()} found.`));
  if (kind === 'margin') showReturn(list);
  return scroll;
}

// ---- the Marks search (row 51) -------------------------------------------------------------------------------------------

/** What was chosen last, kept while the window is open. `style` is `kind:color[:lines]`, as the legend lists them. */
const markFilter = { kind: '', style: '', book: '', since: '', until: '' };
const MARK_KINDS: [string, string][] = [['', 'Any kind'], ['highlight', 'Highlight'], ['underline', 'Underline'], ['circle', 'Circle'], ['box', 'Box'], ['arrow', 'Arrow']];

async function markResults(words: string): Promise<HTMLElement> {
  const scroll = h('div', 'nb-scroll nb-kind-results nb-marks');
  const filters = h('div', 'nb-mfilters');
  const line = h('p', 'muted small nb-kind-line', '');
  const list = h('div', 'nb-mlist');
  let legend: { entries: any[]; unlisted: any[] } = { entries: [], unlisted: [] };
  try { legend = await wb(['legend']); } catch { /* no legend to choose from */ }
  const styles: [string, string][] = [['', 'Any style'], ...[...(legend.entries || []), ...(legend.unlisted || [])].map((e: any): [string, string] => [e.style, e.label])];

  const select = (label: string, options: [string, string][], value: string, set: (v: string) => void) => {
    const s = h('select', 'field nb-mfilter') as HTMLSelectElement;
    s.setAttribute('aria-label', label);
    for (const [v, text] of options) s.append(new Option(text, v));
    s.value = options.some(o => o[0] === value) ? value : '';
    s.onchange = () => { set(s.value); void load(); };
    return s;
  };
  const book = h('input', 'field nb-mfilter nb-mbook') as HTMLInputElement;
  book.setAttribute('aria-label', 'Book');
  book.placeholder = 'Any book';
  book.setAttribute('list', 'nb-mbooks');
  book.value = markFilter.book;
  const names = h('datalist') as HTMLDataListElement;
  names.id = 'nb-mbooks';
  for (const b of app.books) names.append(new Option(b.name));
  book.onchange = () => { markFilter.book = book.value.trim(); void load(); };
  const date = (label: string, key: 'since' | 'until') => {
    const wrap = h('label', '', `${label} `);
    const i = h('input', 'field nb-mfilter') as HTMLInputElement;
    i.type = 'date';
    i.setAttribute('aria-label', label);
    i.value = markFilter[key];
    i.onchange = i.oninput = () => { if (markFilter[key] === i.value) return; markFilter[key] = i.value; void load(); };
    wrap.append(i);
    return wrap;
  };
  filters.append(
    select('Kind of mark', MARK_KINDS, markFilter.kind, v => { markFilter.kind = v; }),
    select('Legend entry', styles, markFilter.style, v => { markFilter.style = v; }),
    book, names, date('Since', 'since'), date('Until', 'until'),
  );
  scroll.append(filters, line, list);

  async function load() {
    // the order is fixed, so the same filters are the same `wb` line: find [words] --kind mark [--style] [--mark-kind] [--book] [--since] [--until]
    const argv = ['find', ...(words.trim() ? [words.trim()] : []), '--kind', 'mark'];
    if (markFilter.style && styles.some(s => s[0] === markFilter.style)) argv.push('--style', markFilter.style);
    if (markFilter.kind) argv.push('--mark-kind', markFilter.kind);
    if (markFilter.book) argv.push('--book', markFilter.book);
    if (markFilter.since) argv.push('--since', markFilter.since);
    if (markFilter.until) argv.push('--until', markFilter.until);
    list.replaceChildren();
    let r: any;
    try { r = await wb(argv); } catch (x) { line.textContent = String((x as Error)?.message ?? x); return; }
    line.textContent = `Marks · ${r.count}${r.total !== r.count ? ` of ${r.total}` : ''}`;
    for (const row of r.groups?.[0]?.results ?? []) {
      const it = h('button', 'nb-item nb-mrow');
      it.dataset.id = String(row.id);
      const top = h('div', 'nb-mtop');
      top.append(sampleOf(row.mark_kind as Kind, row.color, row.lines), h('span', 'nb-item-title', row.title), h('span', 'nb-mlegend', row.legend || ''));
      it.append(top);
      if (row.snippet) it.append(h('div', 'nb-mwords', `“${row.snippet}”`));
      // the reader goes there; Back returns it to where it was
      it.onclick = () => openFromResult(list, () => goTo(row.at));
      list.append(it);
    }
    if (!r.count) list.append(h('p', 'muted nb-empty', 'No marks found.'));
    showReturn(list);
  }
  await load();
  return scroll;
}
