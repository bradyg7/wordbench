// The one search's kinds (design/features/marks, MK-4, MK-12, M21).
// - The kinds are one menu at the start of the search field, with counts; choosing one narrows the results and shows as one
//   line of text. No chips, no side list of kinds.
import { wb } from './api';
import { goTo } from './app';
import { button, h, popMenu } from './ui';

export const KINDS: [string, string][] = [['', 'Everything'], ['page', 'Pages'], ['save', 'Saves'], ['question', 'Questions'], ['highlight', 'Highlights']];
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

/** What a kind's search finds, as plain rows: each opens where it lives. */
export async function kindResults(kind: string, words: string, host: { openPage: (id: string) => void }): Promise<HTMLElement> {
  const r = await wb(['find', ...(words.trim() ? [words.trim()] : []), '--kind', kind]);
  const scroll = h('div', 'nb-scroll nb-kind-results');
  scroll.append(h('p', 'muted small nb-kind-line', `${kindName(kind)} · ${r.count}${r.total !== r.count ? ` of ${r.total}` : ''}`));
  for (const g of r.groups) {
    for (const row of g.results) {
      const it = h('button', 'nb-item');
      it.dataset.id = String(row.id);
      it.append(h('div', 'nb-item-title', row.title || 'Untitled'));
      if (row.snippet) it.append(h('div', 'nb-item-preview', String(row.snippet).split('\n')[0]));
      it.onclick = () => {
        if (g.kind === 'highlight') void goTo(row.title);
        else if (g.kind === 'save') void goTo(row.ref || row.title);
        else host.openPage(row.id);
      };
      scroll.append(it);
    }
  }
  if (!r.count) scroll.append(h('p', 'muted nb-empty', `No ${kindName(kind).toLowerCase()} found.`));
  return scroll;
}
