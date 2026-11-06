// Ctrl+F in a pane (note 5c4a): a find bar at the top of the pane last clicked or typed in, finding its words as they
// are shown (case ignored), each found marked and the one in view marked more strongly; Enter / Shift+Enter, ↑ ↓ step,
// Esc closes. In the reader Ctrl+F still finds in the chapter (main.ts). Marks are drawn with the CSS Custom Highlight
// API, so the pane's own markup is never changed.
import { h, icon } from './ui';

interface Finder { el: HTMLElement; bar: HTMLElement; input: HTMLInputElement; count: HTMLElement; hits: Range[]; at: number }
let open: Finder | null = null;

const highlights = (globalThis as any).CSS?.highlights as Map<string, unknown> | undefined;
const Hl = (globalThis as any).Highlight as (new (...r: Range[]) => unknown) | undefined;

/** The pane Ctrl+F belongs to: the one with the focus, else the one last pressed in (null: the reader). */
let pressed: HTMLElement | null = null;
document.addEventListener('pointerdown', e => {
  const t = e.target as Element;
  if (t.closest?.('.menu, .popover, .hovercard, .pane-find')) return;
  pressed = t.closest?.('.dock-group, .pane-sheet, #scroller, #bar') as HTMLElement | null;
}, true);

export function paneForFind(): HTMLElement | null {
  const a = document.activeElement as HTMLElement | null;
  const inPane = a?.closest<HTMLElement>('.pane');
  if (inPane && !a!.closest('.pane-find')) return inPane;
  if (a?.closest('.pane-find') && open) return open.el;
  if (!pressed || !pressed.isConnected || !pressed.matches('.dock-group, .pane-sheet')) return null;
  return pressed.querySelector<HTMLElement>(':scope > .pane:not([hidden])');
}

function textNodes(root: HTMLElement): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => ((n.parentElement?.closest('.pane-find, .handle, [hidden]') || !(n as Text).data.trim()) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  while (w.nextNode()) out.push(w.currentNode as Text);
  return out;
}

function search(f: Finder) {
  const q = f.input.value.trim().toLowerCase();
  f.hits = [];
  if (q) {
    for (const t of textNodes(f.el)) {
      const low = t.data.toLowerCase();
      for (let i = low.indexOf(q); i >= 0; i = low.indexOf(q, i + q.length)) {
        const r = document.createRange();
        r.setStart(t, i);
        r.setEnd(t, i + q.length);
        f.hits.push(r);
      }
    }
  }
  f.at = 0;
  draw(f, true);
}

function draw(f: Finder, scroll: boolean) {
  const q = f.input.value.trim();
  f.count.textContent = q ? (f.hits.length ? `${f.at + 1} of ${f.hits.length}` : 'none') : '';
  f.bar.dataset.found = String(f.hits.length);
  if (highlights && Hl) {
    highlights.set('pane-found', new Hl(...f.hits));
    highlights.set('pane-found-now', new Hl(...(f.hits[f.at] ? [f.hits[f.at]] : [])));
  }
  const r = f.hits[f.at];
  if (scroll && r) {
    const box = r.getBoundingClientRect(), pane = f.el.getBoundingClientRect();
    if (box.top < pane.top + f.bar.offsetHeight + 8 || box.bottom > pane.bottom - 8) f.el.scrollTop += box.top - pane.top - f.el.clientHeight / 2;
  }
}

function step(n: number) {
  if (!open || !open.hits.length) return;
  open.at = (open.at + n + open.hits.length) % open.hits.length;
  draw(open, true);
}

export function closePaneFind() {
  if (!open) return;
  open.bar.remove();
  highlights?.delete('pane-found');
  highlights?.delete('pane-found-now');
  open = null;
}

/** Opens (or focuses) the find bar at the top of a pane. */
export function findInPane(el: HTMLElement) {
  if (open && open.el !== el) closePaneFind();
  if (open && open.bar.isConnected) { open.input.focus(); open.input.select(); return; }
  const bar = h('div', 'pane-find');
  const input = h('input', 'field') as HTMLInputElement;
  input.placeholder = 'Find in this pane';
  input.setAttribute('aria-label', 'Find in this pane');
  const count = h('span', 'muted small find-count');
  const prev = h('button', 'icon-btn', '↑'), next = h('button', 'icon-btn', '↓'), x = h('button', 'icon-btn');
  prev.title = 'The one before (Shift+Enter)';
  next.title = 'The next (Enter)';
  x.append(icon('x'));
  x.setAttribute('aria-label', 'Close find');
  bar.append(input, count, prev, next, x);
  el.prepend(bar);
  const f: Finder = { el, bar, input, count, hits: [], at: 0 };
  open = f;
  input.oninput = () => search(f);
  input.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePaneFind(); }
  };
  prev.onclick = () => step(-1);
  next.onclick = () => step(1);
  x.onclick = () => closePaneFind();
  input.focus();
}
