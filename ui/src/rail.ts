// The rail on the left (design/features/minimize, build go-ahead 2026-11-13; drawn with the top bar in
// design/features/command round 2, C13-C17). Icons only, the name on hover; Show names opens it out with labels, and is
// remembered in the window's storage. No count badges. An icon opens its pane in the left column, beside the rail (the
// person, 2026-11-13; floating if it was last left floating), or brings it to the front, and shows as on while that pane is in
// front; clicked again while on, it closes that pane. The Concordance, BDB and Webster's join when their own folders are built.
//
// Minimized tabs (round 7, accepted 2026-11-16) are links, not loaded panes: an icon that holds some has a short bar at its
// left edge, and a click opens its menu (R1a); tabs of a kind with no icon wait under Minimized, grouped by kind (R2a);
// past eight, a find field, Show all and Close all (R3a).
import { dock } from './panes';
import type { MinLink } from './dock';
import { openDocuments } from './documents';
import { openFindings } from './findings';
import { openNotebook } from './notebook';
import { openHelp, openPlans, openShelf } from './panes';
import { openSettings } from './settings';
import { keepTab } from './shelf';
import { hooks } from './toolbar';
import { h, icon, popMenu, sizeClass } from './ui';
import { iconOf, openTrail, trailGoing } from './trail';

const NAMES = 'wb.rail.names';

interface Spot { id: string; label: string; ico: string; kind?: string; run: (from: HTMLElement) => void }

const TOP: Spot[] = [
  { id: 'notebook', label: 'Notebook', ico: 'notebook', kind: 'notebook', run: () => void openNotebook() },
  { id: 'shelf', label: 'Shelf', ico: 'shelf', kind: 'shelf', run: () => void openShelf() },
  { id: 'highlights', label: 'Highlights', ico: 'pen', run: from => hooks.highlights(from) },
];
const UNDER: Spot[] = [
  { id: 'trail', label: 'Trail', ico: 'trail', run: () => openTrail() },
  { id: 'plans', label: 'Reading plans', ico: 'lines', kind: 'plans', run: () => void openPlans() },
  { id: 'findings', label: 'Findings', ico: 'prompt', kind: 'findings', run: () => void openFindings() },
  { id: 'documents', label: 'Documents', ico: 'file', kind: 'documents', run: () => void openDocuments() },
];
const MINIMIZED: Spot = { id: 'minimized', label: 'Minimized', ico: 'float', run: () => {} };
const FOOT: Spot[] = [
  { id: 'help', label: 'Help', ico: 'help', run: () => void openHelp() },
  { id: 'settings', label: 'Settings', ico: 'sliders', run: () => void openSettings() },
];

let rail: HTMLElement | null = null;

function named(): boolean {
  try { return localStorage.getItem(NAMES) === '1'; } catch { return false; }
}

// ---- minimized tabs -------------------------------------------------------------------------------------------------

/** Which rail icon holds a minimized tab of this kind; the rest wait under Minimized (R2a). */
const HOLDS: Record<string, string> = {
  notebook: 'notebook', note: 'notebook', thread: 'notebook', threads: 'notebook', today: 'notebook',
  shelf: 'shelf', plans: 'plans', findings: 'findings', documents: 'documents', docpreview: 'documents', lesson: 'documents', doc: 'documents',
};
const holder = (l: MinLink) => HOLDS[l.kind] ?? 'minimized';
/** Inside Minimized, grouped by kind (R2a). */
const GROUP: Record<string, string> = {
  strong: 'Word studies', bdb: 'Word studies', def: 'Word studies', lexiconc: 'Word studies', uses: 'Word studies', count: 'Word studies', forms: 'Word studies',
  search: 'Search', find: 'Search', near: 'Search', marked: 'Search',
  verse: 'Verses', reader2: 'Verses', place: 'Verses', passage: 'Verses', versecard: 'Verses', interlinear: 'Verses',
};
const SHOWN = 8;

function linksOf(id: string) {
  return (dock?.links ?? []).filter(l => holder(l) === id).sort((a, b) => b.at - a.at);
}

function ago(at: number) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m} min`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

let menuClose: (() => void) | null = null;
let menuFor = '';

/** The menu beside a rail icon: Open <pane> at the top, then what waits there, newest first (R1a, R3a). */
function linkMenu(s: Spot, b: HTMLElement, all = false) {
  menuClose?.();
  const body = h('div', 'rail-menu');
  const head = h('div', 'rail-menu-head');
  head.append(h('span', '', s.label));
  if (s.kind) {
    const open = h('button', 'link-btn', `Open ${s.label}`);
    open.onclick = () => { menuClose?.(); openSpot(s, b); };
    head.append(open);
  }
  body.append(head);
  const links = linksOf(s.id);
  const list = h('div', 'rail-menu-list');
  const q = h('input', 'field rail-menu-find') as HTMLInputElement;
  q.placeholder = 'Find in minimized…';
  const row = (l: MinLink) => {
    const r = h('div', 'rail-link');
    const go = h('button', 'rail-link-go');
    go.title = `Open ${l.title} again`;
    go.append(icon(iconOf(l.kind), 14), h('span', 'rail-link-t', l.title), h('span', 'rail-link-w', ago(l.at)));
    go.onclick = () => { menuClose?.(); void dock.restoreLink(l.key); };
    const keep = h('button', 'icon-btn small rail-link-act');
    keep.title = 'Keep on the Shelf';
    keep.setAttribute('aria-label', `Keep ${l.title} on the Shelf`);
    keep.append(icon('pin', 13));
    keep.onclick = () => void keepTab(keep, l.key, l.title);
    const x = h('button', 'icon-btn small rail-link-act');
    x.title = 'Close';
    x.setAttribute('aria-label', `Close ${l.title}`);
    x.append(icon('x', 13));
    x.onclick = () => { dock.dropLink(l.key); if (linksOf(s.id).length) linkMenu(s, b, all); else menuClose?.(); };
    r.append(go, keep, x);
    return r;
  };
  const fill = () => {
    const w = q.value.trim().toLowerCase();
    const hits = w ? links.filter(l => l.title.toLowerCase().includes(w) || l.kind.includes(w)) : all ? links : links.slice(0, SHOWN);
    list.replaceChildren();
    if (s.id === 'minimized' && !w) {
      const by = new Map<string, MinLink[]>();
      for (const l of hits) { const g = GROUP[l.kind] ?? 'Other'; by.set(g, [...(by.get(g) ?? []), l]); }
      for (const [g, ls] of by) list.append(h('div', 'rail-menu-label', g), ...ls.map(row));
    } else list.append(...hits.map(row));
    if (!hits.length) list.append(h('p', 'muted small rail-menu-none', 'Nothing by that name.'));
  };
  q.oninput = fill;
  if (links.length > SHOWN) body.append(q);
  fill();
  body.append(list);
  if (links.length > SHOWN) {
    const foot = h('div', 'rail-menu-foot');
    if (!all) {
      const more = h('button', 'link-btn', `Show all ${links.length}`);
      more.onclick = () => linkMenu(s, b, true);
      foot.append(more);
    }
    const closeAll = h('button', 'link-btn', 'Close all');
    closeAll.onclick = () => {
      if (!confirm(`Close all ${links.length} minimized here? They stay on the trail.`)) return;
      for (const l of links) dock.dropLink(l.key);
      menuClose?.();
    };
    foot.append(h('span', 'grow'), closeAll);
    body.append(foot);
  }
  const r = b.getBoundingClientRect();
  menuFor = s.id;
  menuClose = popMenu(b, body, { width: 280, at: { x: r.right + 6, y: r.top - 2 }, onClose: () => { menuClose = null; menuFor = ''; } });
}

function onClick(s: Spot, b: HTMLElement) {
  if (menuFor === s.id) { menuClose?.(); return; }
  if (linksOf(s.id).length) { linkMenu(s, b); return; }
  openSpot(s, b);
}

function openSpot(s: Spot, b: HTMLElement) {
  if (s.kind) toggle(s, b);
  else s.run(b);
}

function button(s: Spot): HTMLButtonElement {
  const b = h('button', 'rail-item') as HTMLButtonElement;
  b.dataset.rail = s.id;
  if (s.kind) b.dataset.kind = s.kind;
  b.title = s.label;
  b.setAttribute('aria-label', s.label);
  b.append(icon(s.ico, 18), h('span', 'rail-name', s.label));
  b.onclick = () => onClick(s, b);
  return b;
}

/** The front pane of a kind (the one its icon is on for), or any open pane of it. */
function paneOf(kind: string) {
  const fronts = new Set([...document.querySelectorAll<HTMLElement>('.dock-group[data-front]')].map(g => g.dataset.front));
  const all = dock?.panes.filter(p => p.kind === kind) ?? [];
  return { front: all.find(p => fronts.has(p.id)), any: all[0] };
}

/** A pane's icon: open it (on the left, beside the rail), bring it to the front, or, when it is in front, close it. */
function toggle(s: Spot, b: HTMLElement) {
  const { front, any } = paneOf(s.kind!);
  if (front && b.classList.contains('on')) { void dock.close(front); return; }
  if (any) { dock.show(any); return; }
  s.run(b);
  const p = dock?.panes.find(x => x.kind === s.kind);
  // beside the rail, where the button is; a pane last left floating opens floating again
  if (p && p.side !== 'left' && p.side !== 'float') dock.move(p, 'left');
}

/** Marks the icons whose pane is in front of its group, and the Trail's dot while a sitting is going. */
export function railOn() {
  if (!rail) return;
  const fronts = new Set<string>();
  document.querySelectorAll<HTMLElement>('.dock-group[data-front]').forEach(g => {
    const p = dock?.panes.find(x => x.id === g.dataset.front);
    if (p) fronts.add(p.kind);
  });
  rail.querySelectorAll<HTMLElement>('.rail-item[data-kind]').forEach(b => b.classList.toggle('on', fronts.has(b.dataset.kind!)));
  rail.querySelector('[data-rail="trail"]')?.classList.toggle('going', trailGoing());
  railLinks();
}

/** A short bar at the left edge of each icon that holds minimized tabs (no count); Minimized shows only while it holds some. */
function railLinks() {
  if (!rail) return;
  rail.querySelectorAll<HTMLElement>('.rail-item[data-rail]').forEach(b => b.classList.toggle('has', linksOf(b.dataset.rail!).length > 0));
  const any = linksOf('minimized').length > 0;
  const m = rail.querySelector<HTMLElement>('[data-rail="minimized"]'), rule = rail.querySelector<HTMLElement>('.rail-rule.for-min');
  if (m) m.hidden = !any;
  if (rule) rule.hidden = !any;
  if (menuFor && !linksOf(menuFor).length) menuClose?.();
}

function setNamed(on: boolean) {
  const keep = dock?.keepPlace();
  document.documentElement.classList.toggle('rail-named', on);
  try { localStorage.setItem(NAMES, on ? '1' : '0'); } catch { /* the window's storage may be off */ }
  const t = rail?.querySelector<HTMLElement>('[data-rail="names"]');
  if (t) { t.title = on ? 'Hide names' : 'Show names'; t.querySelector('.rail-name')!.textContent = on ? 'Hide names' : 'Show names'; }
  dock?.layout();
  keep?.();
}

/** Called once the dock exists: the rail listens for minimized links. */
export function railLinksInit() {
  dock.onLinks = railLinks;
  railLinks();
}

export function initRail() {
  rail = h('aside', 'rail');
  rail.id = 'rail';
  rail.setAttribute('aria-label', 'Rail');
  const minRule = h('div', 'rail-rule for-min');
  rail.append(...TOP.map(button), h('div', 'rail-rule'), ...UNDER.map(button), minRule, button(MINIMIZED), h('div', 'grow'));
  const names = button({ id: 'names', label: named() ? 'Hide names' : 'Show names', ico: 'sidebar', run: () => setNamed(!document.documentElement.classList.contains('rail-named')) });
  rail.append(names, ...FOOT.map(button));
  document.body.append(rail);
  document.documentElement.classList.toggle('rail-named', named());
  void sizeClass;
  railOn();
}
