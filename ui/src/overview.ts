// Scripture in this page (design/features/marks, MK-5, M22, M23, M39): every scripture a page names, in the Bible's order,
// each saying where it is named. In a pane at least 560 px wide it is open at the top of the page, at most 6 rows high and
// scrolling; narrower it is one wrapping line that opens the list. A page naming more than 30 folds to books with counts.
// It is found from the page's own text (`wb page overview`); nothing is kept.
import { wb } from './api';
import { h, icon } from './ui';
import { openByClick } from './verses';

interface Item { label: string; ref: string; book: string; where: { n: number; in: string }[]; first: number }
interface Overview { id: string; count: number; folded: boolean; items: Item[]; books: { code: string; name: string; count: number; items: string[] }[]; words: { number: string; n: number; in: string }[] }

const WIDE = 560;

export async function overviewBox(pageId: string): Promise<HTMLElement | null> {
  let d: Overview;
  try { d = await wb(['page', 'overview', pageId]); } catch { return null; }
  if (!d || !d.count) return null;
  const box = h('section', 'ov');
  box.setAttribute('aria-label', 'Scripture in this page');
  const head = h('div', 'ov-head');
  head.append(icon('book', 14), h('b', '', `Scripture in this page · ${d.count}`));
  const body = h('div', 'ov-body');
  box.append(head, body);

  const goTo = (n: number) => {
    if (!n) return;
    const block = box.closest('.nb-page, .nb-editor, body')?.querySelector<HTMLElement>(`.nb-block[data-n="${n}"]`) || document.querySelector<HTMLElement>(`.nb-block[data-n="${n}"]`);
    block?.scrollIntoView({ block: 'center' });
    block?.classList.add('ov-flash');
    setTimeout(() => block?.classList.remove('ov-flash'), 1200);
  };
  const row = (i: Item) => {
    const r = h('div', 'ov-row');
    const name = h('button', 'ov-name', i.label);
    name.onclick = () => goTo(i.first);
    const where = h('span', 'ov-where muted small', i.where.map(w => w.in).join(', '));
    const open = h('button', 'ov-open', '→');
    open.setAttribute('aria-label', `Open ${i.label}`);
    open.title = 'Open the text';
    open.onclick = e => openByClick(i.ref, e);
    r.append(name, where, h('span', 'grow'), open);
    return r;
  };
  const list = h('div', 'ov-list');
  if (d.folded) {
    // 86 scriptures: books with counts, a book opening to its references (M39)
    for (const b of d.books) {
      const det = h('details', 'ov-book');
      det.append(h('summary', '', `${b.name} · ${b.count}`));
      for (const label of b.items) det.append(row(d.items.find(i => i.label === label)!));
      list.append(det);
    }
  } else for (const i of d.items) list.append(row(i));
  // narrow: one wrapping line that opens the list (M23)
  const line = h('button', 'ov-line', d.items.map(i => i.label).join(' · '));
  line.setAttribute('aria-expanded', 'false');
  line.onclick = () => { const open = list.classList.toggle('open'); line.setAttribute('aria-expanded', String(open)); };
  body.append(line, list);
  const fit = () => {
    const wide = box.getBoundingClientRect().width >= WIDE;
    box.classList.toggle('wide', wide);
    box.classList.toggle('narrow', !wide);
  };
  new ResizeObserver(fit).observe(box);
  queueMicrotask(fit);
  return box;
}
