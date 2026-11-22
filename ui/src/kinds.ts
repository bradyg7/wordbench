// The one search's kinds (design/features/marks, MK-4, MK-12, M21; marks T12, rows 51 and 52).
// - The kinds are one menu at the start of the search field, with counts; choosing one narrows the results and shows as one
//   line of text. No chips, no side list of kinds.
// - Margin notes (row 52): a result opens the reader at that chapter with the margin showing that note; Back returns.
// - Marks (row 51): `wb find --kind mark`; a result opens the reader there; Back returns. Its filters are the one chip component
//   (filters-v2 rows 26 and 27, NB17: the T12 controls are retired into a Kind chip and a Legend entry chip, with Book and Written).
//   Margin notes and Highlights take the same chips, each only the properties it has.
import { wb } from './api';
import { app, goTo } from './app';
import { sampleOf, type Kind } from './markbar';
import { toast } from './sheets';
import { openColormap } from './colormap';
import { button, h, popMenu } from './ui';
import { listChips } from './chips';

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

/** What a kind's search finds, as plain rows: each opens where it lives. Margin notes, Highlights and Marks take the one chip row. */
export async function kindResults(kind: string, words: string, host: { openPage: (id: string) => void }): Promise<HTMLElement> {
  const chipped = kind === 'margin' || kind === 'highlight' || kind === 'mark';
  const chips = chipped ? listChips(`find:${kind}`) : null;
  const scroll = h('div', `nb-scroll nb-kind-results${kind === 'mark' ? ' nb-marks' : ''}`);
  const chipBox = h('div', 'nb-kind-chips');
  const line = h('p', 'muted small nb-kind-line', '');
  const list = h('div', kind === 'mark' ? 'nb-mlist' : 'nb-klist');
  if (kind === 'mark') {
    const colors = h('button', 'btn small nb-colors', 'Colors across the Bible') as HTMLButtonElement;
    colors.type = 'button';
    colors.onclick = () => void openColormap();
    scroll.append(colors);
  }
  scroll.append(chipBox, line, list);

  async function load() {
    // the order is fixed, so the same chips are the same `wb` line: find [words] --kind K [--filter "…"]…
    const argv = ['find', ...(words.trim() ? [words.trim()] : []), '--kind', kind, ...(chips?.argv() ?? [])];
    list.replaceChildren();
    let r: any;
    try { r = await wb(argv); } catch (x) { line.textContent = String((x as Error)?.message ?? x); return; }
    if (chips) { chips.absorb(r); chipBox.replaceChildren(chips.row(() => void load())); }
    line.textContent = `${kindName(kind)} · ${r.count}${r.total !== r.count ? ` of ${r.total}` : ''}`;
    for (const g of r.groups) {
      for (const row of g.results) {
        if (g.kind === 'mark') {
          const it = h('button', 'nb-item nb-mrow');
          it.dataset.id = String(row.id);
          const top = h('div', 'nb-mtop');
          top.append(sampleOf(row.mark_kind as Kind, row.color, row.lines), h('span', 'nb-item-title', row.title), h('span', 'nb-mlegend', row.legend || ''));
          it.append(top);
          if (row.snippet) it.append(h('div', 'nb-mwords', `“${row.snippet}”`));
          // the reader goes there; Back returns it to where it was
          it.onclick = () => openFromResult(list, () => goTo(row.at));
          list.append(it);
          continue;
        }
        const it = h('button', 'nb-item');
        it.dataset.id = String(row.id);
        it.append(h('div', 'nb-item-title', row.title || 'Untitled'));
        if (row.snippet) it.append(h('div', 'nb-item-preview', String(row.snippet).split('\n')[0]));
        it.onclick = () => {
          if (g.kind === 'highlight') void goTo(row.title);
          else if (g.kind === 'save') void goTo(row.ref || row.title);
          else if (g.kind === 'margin') openFromResult(list, () => app.showMarginNote(row.id, row.at));   // row 52
          else host.openPage(row.page || row.id);   // a callout (row 46c) opens its page
        };
        list.append(it);
      }
    }
    if (!r.count) list.append(h('p', 'muted nb-empty', chips?.chips.length ? `No ${kindName(kind).toLowerCase()} match these filters.` : `No ${kindName(kind).toLowerCase()} found.`));
    if (kind === 'margin' || kind === 'mark') showReturn(list);
  }
  await load();
  return scroll;
}
