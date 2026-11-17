// The one search's kinds and Margin notes in the Library (design/features/marks, MK-4, MK-12, M21, M30, M31, M38).
// - The kinds are one menu at the start of the search field, with counts; choosing one narrows the results and shows as one
//   line of text. No chips, no side list of kinds.
// - Margin notes are the Library's fifth piece: a folded row opening the Bible's order, books then chapters, each with its
//   count; a chapter lists each note under its verse's first words; a click opens the reader at that verse with its margin
//   open. A margin note is never dragged into a folder or pinned.
import { wb } from './api';
import { goTo } from './app';
import { button, h, popMenu } from './ui';
import { openVerse } from './margin';

export const KINDS: [string, string][] = [['', 'Everything'], ['page', 'Pages'], ['save', 'Saves'], ['question', 'Questions'], ['margin', 'Margin notes'], ['highlight', 'Highlights']];
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
        if (g.kind === 'margin') void openMargin(row.at);
        else if (g.kind === 'highlight') void goTo(row.title);
        else if (g.kind === 'save') void goTo(row.ref || row.title);
        else host.openPage(row.id);
      };
      scroll.append(it);
    }
  }
  if (!r.count) scroll.append(h('p', 'muted nb-empty', `No ${kindName(kind).toLowerCase()} found.`));
  return scroll;
}

/** The reader at that verse, with its margin open (the place the reader came from is kept by goTo, so Back returns). */
async function openMargin(at: string) {
  const m = /^(\w{3})\.(\d+)(?::(\d+))?/.exec(at);
  if (!m) return;
  await goTo(`${m[1]} ${m[2]}${m[3] ? `:${m[3]}` : ''}`);
  setTimeout(() => void openVerse(m[1], +m[2], m[3] ? +m[3] : 0), 250);
}

/** The Library's Margin notes row: folded; opens books with counts, then chapters, then a chapter's notes (M30, M31). */
export async function marginRow(): Promise<HTMLElement> {
  const box = h('details', 'mgl');
  let list: any = { total: 0, books: [] };
  try { list = await wb(['margin', 'list']); } catch { /* nothing yet */ }
  const sum = h('summary', 'mgl-sum');
  sum.append(h('span', '', 'Margin notes'), h('span', 'grow'), h('span', 'nb-count', String(list.total)));
  box.append(sum);
  const body = h('div', 'mgl-body');
  box.append(body);
  if (!list.total) body.append(h('p', 'muted small nb-side-hint', 'Nothing in the margin yet: click a verse number, then write.'));
  for (const b of list.books) {
    const bd = h('details', 'mgl-book');
    bd.dataset.code = b.code;
    bd.append(h('summary', '', `${b.name} · ${b.count}`));
    for (const c of b.chapters) {
      const cd = h('details', 'mgl-chapter');
      cd.dataset.chapter = String(c.chapter);
      cd.append(h('summary', '', `${b.name} ${c.chapter} · ${c.count}`));
      cd.addEventListener('toggle', async () => {
        if (!cd.open || cd.querySelector('.mgl-note')) return;
        const d = await wb(['margin', `${b.code} ${c.chapter}`]);
        for (const n of d.notes) {
          const row = button('mgl-note', '', () => void openMargin(n.at));
          const where = n.kind === 'chapter' ? 'The chapter' : n.verse_start || n.label;
          row.append(h('span', 'mgl-verse', where), h('span', 'mgl-first muted small', n.first_line));
          row.dataset.id = n.id;
          for (const g of n.grew || []) row.append(h('span', 'pill unplaced', `grew into ${g.title}`));
          cd.append(row);
        }
      });
      bd.append(cd);
    }
    body.append(bd);
  }
  return box;
}
