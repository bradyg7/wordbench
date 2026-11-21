// The link chip and the compact chapter panel (notebook design row 12, NB5; margin notes, row 40, reuse both).
// A reference the app recognises in a page is drawn as a chip; clicking it opens the chapter in a small panel: a header
// (a grip, the reference, ← → chapter, Open in reader, close), the chapter's verses read from the database, the verse
// the chip names marked. The panel is sized to its text, snaps to a corner and can be dragged to another; Esc closes it.
// The file keeps only the reference's plain text (decided 2026-11-21): nothing here writes anything.
import { wb } from './api';
import { app, goTo } from './app';
import { h, icon } from './ui';

interface Where { code: string; name: string; chapters: number; chapter: number; from: number; to: number; toChapter: number }

/** "Numbers 25:11", "Num 25:11-13", "Psalm 106", "Num 25:18-26:1" → the book, the chapter and the verses it names. */
export function whereIs(ref: string): Where | null {
  const m = /^\s*(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–—]\s*(?:(\d+):)?(\d+))?)?\s*$/.exec(ref);
  if (!m) return null;
  const typed = m[1].toLowerCase().replace(/\./g, '');
  const b = app.books.find(x => x.name.toLowerCase() === typed || x.code.toLowerCase() === typed);
  if (!b) return null;
  const chapter = Number(m[2]);
  const from = m[3] ? Number(m[3]) : 0;
  const toChapter = m[4] ? Number(m[4]) : chapter;
  const to = m[5] ? Number(m[5]) : from;
  return { code: b.code, name: b.name, chapters: b.chapters, chapter, from, to, toChapter };
}

/** A reference drawn as a chip: its words stay the reference; a click opens the chapter panel. */
export function refChip(text: string, ref: string, extra?: (a: HTMLAnchorElement) => void): HTMLAnchorElement {
  const a = h('a', 'ref nb-chip') as HTMLAnchorElement;
  a.href = '#';
  a.dataset.ref = ref;
  a.title = `Open ${ref}`;
  a.append(icon('book', 12), h('span', 'nb-chip-text', text));
  a.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); void openChapterPanel(ref, a); };
  extra?.(a);
  return a;
}

type Corner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
let panel: HTMLElement | null = null;
let corner: Corner = 'top-right';
let opener: HTMLElement | null = null;

export const chapterPanelOpen = () => !!panel;
export function closeChapterPanel(refocus = true) {
  if (!panel) return;
  panel.remove();
  panel = null;
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', snap);
  if (refocus && opener?.isConnected) opener.focus({ preventScroll: true });
  opener = null;
}
function onKey(ev: KeyboardEvent) { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeChapterPanel(); } }

const EDGE = 12;
function place(c: Corner) {
  const p = panel;
  if (!p) return;
  const w = p.offsetWidth, hgt = p.offsetHeight;
  const bottom = Math.max(EDGE, innerHeight - hgt - EDGE);
  const top = c.startsWith('top') ? Math.min(56, bottom) : bottom;
  const left = c.endsWith('left') ? EDGE : Math.max(EDGE, innerWidth - w - EDGE);
  p.style.left = `${left}px`;
  p.style.top = `${top}px`;
  p.dataset.corner = c;
}
function snap() { if (panel) place(corner); }

/** Open the chapter that `ref` names in the panel (one panel at a time; a second chip replaces the first). */
export async function openChapterPanel(ref: string, from?: HTMLElement | null): Promise<HTMLElement | null> {
  const at = whereIs(ref);
  if (!at) { goTo(ref); return null; }
  closeChapterPanel(false);
  opener = from ?? null;
  const el = h('section', 'cp');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Chapter');
  const grip = h('span', 'cp-grip');
  grip.title = 'Drag to move';
  grip.setAttribute('aria-hidden', 'true');
  const title = h('strong', 'cp-title');
  const prev = h('button', 'cp-btn cp-prev') as HTMLButtonElement;
  const next = h('button', 'cp-btn cp-next') as HTMLButtonElement;
  prev.type = next.type = 'button';
  prev.setAttribute('aria-label', 'Previous chapter'); prev.title = 'Previous chapter'; prev.append(icon('left', 14));
  next.setAttribute('aria-label', 'Next chapter'); next.title = 'Next chapter'; next.append(icon('right', 14));
  const open = h('button', 'cp-open', 'Open in reader') as HTMLButtonElement;
  open.type = 'button';
  const beside = h('button', 'cp-open cp-beside', 'Open beside') as HTMLButtonElement;
  beside.type = 'button';
  beside.title = 'Send this passage to the side reader; the page and the reader stay where they are';
  const close = h('button', 'cp-btn cp-close') as HTMLButtonElement;
  close.type = 'button';
  close.setAttribute('aria-label', 'Close'); close.title = 'Close (Esc)'; close.textContent = '×';
  const head = h('header', 'cp-head');
  head.append(grip, title, h('span', 'cp-fill'), prev, next, beside, open, close);
  const body = h('div', 'cp-body');
  body.setAttribute('aria-live', 'polite');
  el.append(head, body);
  document.body.append(el);
  panel = el;

  let chapter = at.chapter;
  const mark = (): [number, number] | null => {
    if (!at.from || chapter < at.chapter || chapter > at.toChapter) return null;
    return [chapter === at.chapter ? at.from : 1, chapter === at.toChapter ? at.to : 9999];
  };
  let turn = 0;
  const show = async (n: number) => {
    const mine = ++turn;
    chapter = n;
    title.textContent = `${at.name} ${n}`;
    prev.disabled = n <= 1;
    next.disabled = n >= at.chapters;
    let d: any = null;
    try { d = await wb(['scripture', `${at.name} ${n}`]); } catch { /* shown below */ }
    if (mine !== turn || panel !== el) return;
    body.textContent = '';
    const verses: { c: number; v: number; text: string }[] = d?.verses || [];
    if (!verses.length) body.append(h('p', 'muted small', `Nothing found at ${at.name} ${n}.`));
    const hit = mark();
    let first: HTMLElement | null = null;
    for (const v of verses) {
      const p = h('p', 'cp-verse');
      p.dataset.v = String(v.v);
      p.append(h('span', 'cp-vnum', String(v.v)), document.createTextNode(` ${v.text}`));
      if (hit && v.v >= hit[0] && v.v <= hit[1]) { p.classList.add('cp-on'); first ??= p; }
      body.append(p);
    }
    place(corner);
    first?.scrollIntoView({ block: 'center' });
  };
  prev.onclick = () => void show(chapter - 1);
  next.onclick = () => void show(chapter + 1);
  close.onclick = () => closeChapterPanel();
  // Open in reader: the reader goes to the verse (Back returns to the place it left); the panel has done its work
  open.onclick = () => {
    const verse = at.from && chapter === at.chapter ? at.from : 1;
    closeChapterPanel(false);
    app.go(at.code, chapter, verse);
  };

  // Open beside (12d): the passage goes to a second reader in a pane at the verse the chip names; the reader and the page keep their
  // places (nothing here moves the main reader), and Back returns as it does from any pane
  beside.onclick = () => {
    const where = at.from && chapter === at.chapter ? ref : `${at.name} ${chapter}`;
    const from = opener;
    closeChapterPanel(false);
    app.secondReader(where, undefined, from);
  };

  // drag by the header; let go and it snaps to the nearest corner
  head.addEventListener('pointerdown', ev => {
    if ((ev.target as HTMLElement).closest('button')) return;
    ev.preventDefault();
    const r = el.getBoundingClientRect();
    const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    el.classList.add('moving');
    head.setPointerCapture(ev.pointerId);
    const move = (e: PointerEvent) => {
      el.style.left = `${Math.max(0, Math.min(innerWidth - el.offsetWidth, e.clientX - dx))}px`;
      el.style.top = `${Math.max(0, Math.min(innerHeight - el.offsetHeight, e.clientY - dy))}px`;
    };
    const up = (e: PointerEvent) => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
      head.removeEventListener('pointercancel', up);
      el.classList.remove('moving');
      // the corner is the one the pointer let go nearest to (a panel as wide as the window has no other side to judge by)
      const right = e.clientX > innerWidth / 2, bottom = e.clientY > innerHeight / 2;
      corner = `${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}` as Corner;
      place(corner);
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', up);
  });
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', snap);
  place(corner);
  await show(at.chapter);
  return el;
}
