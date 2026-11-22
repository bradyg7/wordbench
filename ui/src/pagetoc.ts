// The table of contents (notebook rows 31, 45; NB11): the page's headings as a bar in the page's right side, with a button that folds it to
// a thin rail of ticks and opens it again. It lives inside the page's own pane (a sticky column of the pane's page, never over another
// pane). A click on a heading scrolls the page to it. Whether it is on is `wb page look --toc` (settings/pages.json); folded or open is the
// window's, kept per page while the window is open.
import { button, h } from './ui';
import type { Blocks } from './blocks';

const folded = new Map<string, boolean>();

/** A heading's words without its Markdown. */
const plain = (md: string) => md.replace(/^\s*#{1,6}\s*/, '').replace(/<[^>]*>/g, '').replace(/\[\[([^\]|#]*)[^\]]*\]\]/g, '$1').replace(/[*_`~]/g, '').replace(/\s\^[a-z0-9]{6}$/, '').trim();

export interface Heading { n: number; level: number; text: string }
export const headingsOf = (bd: Blocks): Heading[] =>
  bd.blocks.filter(b => b.kind === 'heading' && plain(b.text)).map(b => ({ n: b.n, level: b.level ?? 1, text: plain(b.text) }));

const spy = new WeakMap<HTMLElement, () => void>();

/** The bar for `bd`'s headings. `scroller` is the pane's scrolling page (the editor): headings are found in it and the one in view is lit. */
export function pageToc(bd: Blocks, scroller: HTMLElement): HTMLElement {
  const heads = headingsOf(bd);
  const aside = h('aside', 'nb-toc');
  aside.setAttribute('aria-label', 'Contents');
  const top = heads.length ? Math.min(...heads.map(x => x.level)) : 1;
  let current = heads[0]?.n ?? 0;
  let hold = 0;   // a click lights its heading and the page's scrolling to it does not light another
  const el = (n: number) => scroller.querySelector<HTMLElement>(`.nb-blocks .nb-block[data-n="${n}"]`);
  const go = (n: number) => {
    const b = el(n);
    if (!b) return;
    // the page's own pane scrolls, and nothing else (scrollIntoView would move the panes around it too)
    scroller.scrollTo({ top: Math.max(0, b.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 8) });
    b.classList.add('flash');
    setTimeout(() => b.classList.remove('flash'), 1400);
    current = n;
    hold = Date.now() + 700;
    mark();
  };
  const mark = () => aside.querySelectorAll<HTMLElement>('[data-n]').forEach(x => x.classList.toggle('on', Number(x.dataset.n) === current));
  const draw = () => {
    const rail = folded.get(bd.id) === true;
    aside.dataset.state = rail ? 'rail' : 'open';
    aside.classList.toggle('nb-toc-folded', rail);
    aside.replaceChildren();
    if (rail) {
      const open = button('nb-toc-fold', '‹', () => { folded.set(bd.id, false); draw(); });
      open.setAttribute('aria-label', 'Open the contents');
      open.title = 'Open the contents';
      aside.append(open);
      const ticks = h('div', 'nb-toc-ticks');
      for (const x of heads) {
        const t = h('button', `nb-toc-tick l${Math.min(3, x.level - top + 1)}`);
        t.type = 'button';
        t.dataset.n = String(x.n);
        t.title = x.text;
        t.setAttribute('aria-label', x.text);
        t.onclick = () => go(x.n);
        ticks.append(t);
      }
      // a click on the rail itself (between the ticks) opens it again
      aside.onclick = ev => { if (ev.target === aside || ev.target === ticks) { folded.set(bd.id, false); draw(); } };
      aside.append(ticks);
    } else {
      aside.onclick = null;
      const head = h('div', 'nb-toc-head');
      head.append(h('span', 'nb-toc-title', 'Contents'));
      const fold = button('nb-toc-fold', '›', () => { folded.set(bd.id, true); draw(); });
      fold.setAttribute('aria-label', 'Fold the contents to a rail');
      fold.title = 'Fold the contents to a rail';
      head.append(fold);
      aside.append(head);
      if (!heads.length) aside.append(h('p', 'muted small nb-toc-none', 'No headings yet'));
      for (const x of heads) {
        const r = h('button', `nb-toc-row l${Math.min(3, x.level - top + 1)}`, x.text);
        r.type = 'button';
        r.dataset.n = String(x.n);
        r.onclick = () => go(x.n);
        aside.append(r);
      }
    }
    mark();
  };
  draw();
  // the heading in view is the one lit: the last whose block starts above the top of the page's pane
  const update = () => {
    if (!aside.isConnected || Date.now() < hold) return;
    const lim = scroller.getBoundingClientRect().top + 24;
    let now = heads[0]?.n ?? 0;
    for (const x of heads) { const b = el(x.n); if (b && b.getBoundingClientRect().top <= lim) now = x.n; }
    if (now !== current) { current = now; mark(); }
  };
  spy.set(scroller, update);
  if (!(scroller as any).__tocSpy) {
    (scroller as any).__tocSpy = true;
    let raf = 0;
    scroller.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; spy.get(scroller)?.(); }); }, { passive: true });
  }
  return aside;
}
