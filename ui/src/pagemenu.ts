// The page's own chrome (notebook rows 29-33, 45; ticket NB11): the quiet "Edited …" in the top bar, the searchable page ⋯ menu
// (the one menu component), its Appearance ▸ (Font, Small text, Full width, Table of contents) and Lock page. A page's view choices
// are `wb page look` / `wb page lock`, kept in settings/pages.json and not in the page; Copy contents is `wb page text`.
import { wb } from './api';
import { openMenu, type MenuItem } from './menu';
import { toast } from './sheets';
import { h, icon } from './ui';

export interface PageLook { full_width: boolean; small_text: boolean; font: 'default' | 'serif'; toc: boolean; locked: boolean }
export const defaultLook = (): PageLook => ({ full_width: false, small_text: false, font: 'default', toc: false, locked: false });

/** What `wb page look ID` says (outside the app, or for a page with no choices, the defaults). */
export async function readLook(id: string): Promise<PageLook> {
  try {
    const r = await wb(['page', 'look', id]);
    return { full_width: r.full_width === true, small_text: r.small_text === true, font: r.font === 'serif' ? 'serif' : 'default', toc: r.toc === true, locked: r.locked === true };
  } catch { return defaultLook(); }
}

/** The page's pane shows the choices at once: the column's width, the font, the size, a lock (data on the editor, styled in notebook.css). */
export function applyLook(ed: HTMLElement, look: PageLook) {
  const set = (k: string, on: boolean) => { if (on) ed.dataset[k] = '1'; else delete ed.dataset[k]; };
  set('full', look.full_width); set('small', look.small_text); set('locked', look.locked);
  if (look.font === 'serif') ed.dataset.font = 'serif'; else delete ed.dataset.font;
}

// ---- "Edited just now" (row 29) --------------------------------------------------------------------------------------------

/** "Edited just now", "Edited 2m ago", "Edited 3h ago", "Edited 2d ago"; a page last written long ago, or known by its day only, by the date. */
export function editedAgo(updated: string | undefined, now = Date.now(), wrote = 0): string {
  // a bare day (2026-11-20) is that day here, not the start of it in another zone
  const bare = updated && /^(\d{4})-(\d\d)-(\d\d)$/.exec(updated);
  const d = bare ? new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])) : updated ? new Date(updated) : null;
  const timed = !!updated && /T\d\d:\d\d/.test(updated);
  let t = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  if (!timed && !wrote) {
    if (!t) return 'Edited';
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = `${d!.getFullYear()}-${pad(d!.getMonth() + 1)}-${pad(d!.getDate())}`;
    const n = new Date(now);
    return `Edited ${day === `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}` ? 'today' : day}`;
  }
  t = Math.max(timed ? t : 0, wrote);
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return 'Edited just now';
  if (s < 3600) return `Edited ${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `Edited ${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `Edited ${Math.floor(s / 86400)}d ago`;
  const x = new Date(t), pad = (n: number) => String(n).padStart(2, '0');
  return `Edited ${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** The quiet status in the top bar. It follows every write to this page (the window tells: `wb-page-written`) and ticks on. No Save button. */
export function editedStatus(id: string, updated: string | undefined): HTMLElement {
  const el = h('span', 'nb-edited muted small');
  el.setAttribute('role', 'status');
  let wrote = 0;
  const draw = () => { el.textContent = editedAgo(updated, Date.now(), wrote); };
  const onWrote = (ev: Event) => { if ((ev as CustomEvent).detail?.id === id) { wrote = Date.now(); draw(); } };
  window.addEventListener('wb-page-written', onWrote);
  const timer = window.setInterval(() => {
    if (!el.isConnected) { window.clearInterval(timer); window.removeEventListener('wb-page-written', onWrote); return; }
    draw();
  }, 10_000);
  draw();
  return el;
}

/** The quiet lock in the top bar of a locked page (row 32). */
export function lockMark(): HTMLElement {
  const el = h('span', 'nb-lock muted');
  el.title = 'This page is locked: Page ⋯ › Unlock page lets you write in it again';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Locked');
  el.append(icon('lock', 14));
  return el;
}

// ---- the page ⋯ menu (row 30) ----------------------------------------------------------------------------------------------

export interface PageMenu {
  id: string;
  /** What the menu hangs under. */
  at: HTMLElement | { x: number; y: number };
  look: PageLook;
  /** The page's words, for the foot. */
  words: number;
  updated?: string;
  /** Duplicate, Move to, Move to Trash, and the older actions kept under More: the Notebook's own. */
  duplicate(): void;
  moveTo(): void;
  trash(): void;
  more: { id: string; label: string; run: () => void }[];
  /** A view choice or the lock changed: the pane shows it. */
  looked(look: PageLook, was: PageLook): void;
}

const words = (n: number) => `${n} word${n === 1 ? '' : 's'}`;

async function copy(text: string, said: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* no clipboard here: the toast still says what was copied */ }
  toast(said);
}

/** Apply a change to the page's choices through `wb` and tell the pane. Gives the choices as kept. */
async function change(m: PageMenu, args: string[]): Promise<PageLook> {
  const was = m.look;
  const r = args[0] === 'lock' ? await wb(['page', 'lock', m.id, args[1]]) : await wb(['page', 'look', m.id, ...args]);
  m.look = { full_width: r.full_width === true, small_text: r.small_text === true, font: r.font === 'serif' ? 'serif' : 'default', toc: r.toc === true, locked: r.locked === true };
  m.looked(m.look, was);
  return m.look;
}

/** Page ⋯ › Appearance ▸: Font (Default, Serif), Small text, Full width, Table of contents. A pick changes the page at once and the menu stays. */
export function openAppearance(m: PageMenu) {
  const on = (b: boolean) => (b ? '✓' : '');
  const handle = openMenu({
    label: 'Appearance', placeholder: 'Search appearance', at: m.at,
    foot: 'Kept for this page',
    groups: [
      { title: 'Font', items: [
        { id: 'font-default', label: 'Default', icon: 'T', hint: on(m.look.font === 'default'), keywords: ['font', 'sans', 'inter'] },
        { id: 'font-serif', label: 'Serif', icon: 'T', hint: on(m.look.font === 'serif'), keywords: ['font', 'literata', 'reading'] },
      ] },
      { items: [
        { id: 'small', label: 'Small text', icon: '▫', hint: on(m.look.small_text), keywords: ['size', 'smaller'] },
        { id: 'full', label: 'Full width', icon: '↔', hint: on(m.look.full_width), keywords: ['wide', 'column'] },
        { id: 'toc', label: 'Table of contents', icon: '☰', hint: on(m.look.toc), keywords: ['contents', 'headings', 'outline'] },
      ] },
    ],
    onPick: it => void (async () => {
      try {
        if (it.id === 'font-default') await change(m, ['--font', 'default']);
        else if (it.id === 'font-serif') await change(m, ['--font', 'serif']);
        else if (it.id === 'small') await change(m, ['--small-text', m.look.small_text ? 'off' : 'on']);
        else if (it.id === 'full') await change(m, ['--full-width', m.look.full_width ? 'off' : 'on']);
        else if (it.id === 'toc') await change(m, ['--toc', m.look.toc ? 'off' : 'on']);
      } catch (x) { toast(String(x)); return; }
      // the menu stays, with its ticks as they are now (the pane has changed behind it)
      const anchor = m.at instanceof HTMLElement && !m.at.isConnected ? document.querySelector<HTMLElement>(`.nb-ed-head[data-page="${m.id}"] .nb-more`) ?? m.at : m.at;
      openAppearance({ ...m, at: anchor });
    })(),
  });
  return handle;
}

export function openPageMenu(m: PageMenu) {
  const items: MenuItem[] = [
    { id: 'link', label: 'Copy link', icon: '🔗', keywords: ['url', 'reference', 'wiki'] },
    { id: 'contents', label: 'Copy contents', icon: '⧉', keywords: ['markdown', 'text', 'whole page', 'copy'] },
    { id: 'dup', label: 'Duplicate', icon: '⧉', keywords: ['copy', 'twin'] },
    { id: 'move', label: 'Move to', icon: '↗', keywords: ['inside', 'folder', 'page'] },
  ];
  const view: MenuItem[] = [
    { id: 'history', label: 'Page history', icon: '◷', keywords: ['versions', 'earlier'] },
    { id: 'appearance', label: 'Appearance', icon: 'T', hint: '▸', keywords: ['font', 'serif', 'small text', 'full width', 'table of contents', 'toc'] },
    { id: 'lock', label: m.look.locked ? 'Unlock page' : 'Lock page', icon: '🔒', keywords: ['read-only', 'protect', 'unlock'] },
  ];
  const danger: MenuItem[] = [{ id: 'trash', label: 'Move to Trash', icon: '✕', danger: true, keywords: ['delete', 'remove'] }];
  const more: MenuItem[] = m.more.map(x => ({ id: `more:${x.id}`, label: x.label, keywords: ['more'] }));
  const handle = openMenu({
    label: 'Page actions', placeholder: 'Search actions', at: m.at,
    groups: [{ items }, { items: view }, { items: danger }, ...(more.length ? [{ title: 'More', folded: true, items: more }] : [])],
    foot: `${editedAgo(m.updated)}\n${words(m.words)}`,
    onPick: it => {
      if (it.id.startsWith('more:')) return m.more.find(x => `more:${x.id}` === it.id)?.run();
      if (it.id === 'link') return void wb(['page', 'link', m.id]).then(r => copy(String(r).trim(), 'Link copied'), x => toast(String(x)));
      if (it.id === 'contents') return void wb(['page', 'text', m.id]).then(r => copy(typeof r === 'string' ? r : String(r?.text ?? ''), 'Contents copied'), x => toast(String(x)));
      if (it.id === 'dup') return m.duplicate();
      if (it.id === 'move') return m.moveTo();
      if (it.id === 'history') return toast('Earlier versions of a page are not kept yet; Undo gives back what was deleted');
      if (it.id === 'appearance') return void openAppearance(m);
      if (it.id === 'lock') return void change(m, ['lock', m.look.locked ? 'off' : 'on']).then(() => toast(m.look.locked ? 'Page locked' : 'Page unlocked'), x => toast(String(x)));
      if (it.id === 'trash') return m.trash();
    },
  });
  return handle;
}
