// Several blocks at once (notebook design rows 21 and 43, NB7). The blocks picked are a run of blocks, kept as numbers: a pale
// wash on each (`nb-picked`), and the grip menu acts on all of them. A run is made by dragging across blocks, by Shift+click, by
// dragging from the page's margin (a pale band follows the pointer; every block it touches is picked), or by Esc in a block being
// written (that block). Nothing is written to the page by picking, and the numbers survive the page being drawn again
// (the writing in a block ends when the pointer leaves it, and the page is drawn again then).

export interface Picked { id: string; from: number; to: number }

let saved: Picked | null = null;
let focusNext = false;
let dragging = false;
let lastN = 0;

/** The run picked in this page, if any. */
export const pickedRun = (id: string): Picked | null => (saved && saved.id === id ? saved : null);

const blocksOf = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>('.nb-block[data-n]'));
const shown = (el: HTMLElement) => !el.classList.contains('nb-col-marker');

/** Pick blocks `a` to `b` (either order) of the page drawn in `wrap`. `focus`: the first one's grip takes the focus, so Del and Esc act on them. */
export function pick(wrap: HTMLElement, a: number, b: number, focus = false) {
  saved = { id: wrap.dataset.id || '', from: Math.min(a, b), to: Math.max(a, b) };
  if (focus) focusNext = true;
  paint(wrap);
}

function paint(wrap: HTMLElement) {
  for (const el of blocksOf(wrap)) {
    const n = Number(el.dataset.n);
    el.classList.toggle('nb-picked', !!saved && n >= saved.from && n <= saved.to && shown(el));
  }
}

/** Let go of the run. */
export function clearPick(wrap?: ParentNode | null) {
  saved = null;
  focusNext = false;
  for (const el of blocksOf(wrap ?? document)) el.classList.remove('nb-picked');
}

/** After the page is drawn again: the run is shown as it was (when its blocks are still there). */
export function applyPicks(wrap: HTMLElement, blockCount: number) {
  if (!saved || saved.id !== (wrap.dataset.id || '')) return;
  if (saved.to > blockCount) { clearPick(wrap); return; }
  paint(wrap);
  if (focusNext && !dragging) {
    focusNext = false;
    wrap.querySelector<HTMLElement>('.nb-block.nb-picked > .nb-grip')?.focus({ preventScroll: true });
  }
}

const blockAt = (x: number, y: number): HTMLElement | null => document.elementFromPoint(x, y)?.closest<HTMLElement>('.nb-block[data-n]') ?? null;
const interactive = 'a, input, button, textarea, select, label, .nb-structured-editor';

const installed = new WeakSet<HTMLElement>();

/** The mouse's ways of picking, on the page's editor (once). */
export function installPicking(root: HTMLElement) {
  if (installed.has(root)) return;
  installed.add(root);
  root.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && saved && !ev.defaultPrevented) { clearPick(root); (ev.target as HTMLElement).blur?.(); }
  });
  root.addEventListener('mousedown', ev => {
    if (ev.button !== 0) return;
    const wrap = root.querySelector<HTMLElement>('.nb-blocks');
    if (!wrap) return;
    const t = ev.target as HTMLElement;
    if (t.closest('.nb-selbar')) return;
    const blockEl = t.closest<HTMLElement>('.nb-block[data-n]');
    const onHandle = !!t.closest('.nb-grip, .nb-plus');
    const here = (): number => Number((document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.nb-block[data-n]')?.dataset.n) || saved?.from || lastN;
    // Shift+click: from the block the caret or the run is in, to this one
    if (ev.shiftKey && blockEl && wrap.contains(blockEl) && !onHandle && !t.closest(interactive)) {
      ev.preventDefault();
      const from = here();
      if (from) { getSelection()?.removeAllRanges(); pick(wrap, from, Number(blockEl.dataset.n), true); (document.activeElement as HTMLElement | null)?.blur?.(); }
      return;
    }
    // a press anywhere else lets the run go (a press on a picked block's grip keeps it for the menu)
    if (saved && !(onHandle && blockEl?.classList.contains('nb-picked'))) clearPick(wrap);
    if (onHandle) return;
    const body = t.closest('.nb-block-body');
    const margin = t === root || t === wrap || t.classList.contains('nb-columns') || t.classList.contains('nb-column') || (!!blockEl && t === blockEl);
    if (!margin && !(body && blockEl && wrap.contains(blockEl) && !t.closest(interactive))) return;
    if (blockEl && body) lastN = Number(blockEl.dataset.n);
    if (margin) ev.preventDefault();
    start(root, ev, margin ? null : Number(blockEl!.dataset.n));
  }, true);
}

/** One drag from the margin (`startN` null: a band) or across blocks (from block `startN`). */
function start(root: HTMLElement, down: MouseEvent, startN: number | null) {
  let active = false;
  let band: HTMLElement | null = null;
  const wrapNow = () => root.querySelector<HTMLElement>('.nb-blocks');
  const move = (ev: MouseEvent) => {
    const wrap = wrapNow();
    if (!wrap) return;
    if (!active) {
      if (Math.hypot(ev.clientX - down.clientX, ev.clientY - down.clientY) < 4) return;
      // inside the block it began in this is ordinary text selection
      if (startN !== null && Number(blockAt(ev.clientX, ev.clientY)?.dataset.n) === startN) return;
      active = true;
      dragging = true;
      (document.activeElement as HTMLElement | null)?.blur?.();
      getSelection()?.removeAllRanges();
      root.classList.add('nb-picking');
      if (startN === null) { band = document.createElement('div'); band.className = 'nb-band'; document.body.append(band); }
    }
    getSelection()?.removeAllRanges();
    if (startN === null) {
      const x1 = Math.min(down.clientX, ev.clientX), x2 = Math.max(down.clientX, ev.clientX);
      const y1 = Math.min(down.clientY, ev.clientY), y2 = Math.max(down.clientY, ev.clientY);
      Object.assign(band!.style, { left: `${x1}px`, top: `${y1}px`, width: `${x2 - x1}px`, height: `${y2 - y1}px` });
      const touched = blocksOf(wrap).filter(el => shown(el) && !el.classList.contains('nb-folded')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right >= x1 && r.left <= x2 && r.bottom >= y1 && r.top <= y2;
      }).map(el => Number(el.dataset.n));
      if (touched.length) pick(wrap, Math.min(...touched), Math.max(...touched));
      else { saved = null; paint(wrap); }
      return;
    }
    const cur = blockAt(ev.clientX, ev.clientY);
    if (cur && wrap.contains(cur)) pick(wrap, startN, Number(cur.dataset.n));
  };
  const up = () => {
    document.removeEventListener('mousemove', move, true);
    document.removeEventListener('mouseup', up, true);
    band?.remove();
    root.classList.remove('nb-picking');
    if (!active) return;
    dragging = false;
    // the press began on a block's text: the click that ends the drag must not start writing in it
    const swallow = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
    root.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => root.removeEventListener('click', swallow, true), 0);
    const wrap = wrapNow();
    if (wrap && saved) { focusNext = true; paint(wrap); wrap.querySelector<HTMLElement>('.nb-block.nb-picked > .nb-grip')?.focus({ preventScroll: true }); }
  };
  document.addEventListener('mousemove', move, true);
  document.addEventListener('mouseup', up, true);
}
