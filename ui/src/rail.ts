// The rail on the left (design/features/minimize, build go-ahead 2026-11-13; drawn with the top bar in
// design/features/command round 2, C13-C17). Icons only, the name on hover; Show names opens it out with labels, and is
// remembered in the window's storage. No count badges. An icon opens its pane in the left column, beside the rail (the
// person, 2026-11-13; floating if it was last left floating), or brings it to the front, and shows as on while that pane is in
// front; clicked again while on, it closes that pane. The Concordance, BDB and Webster's join when their own folders are built.
import { dock } from './panes';
import { openDocuments } from './documents';
import { openFindings } from './findings';
import { openNotebook } from './notebook';
import { openHelp, openPlans, openShelf } from './panes';
import { openSettings } from './settings';
import { hooks } from './toolbar';
import { h, icon, sizeClass } from './ui';
import { openTrail, trailGoing } from './trail';

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
const FOOT: Spot[] = [
  { id: 'help', label: 'Help', ico: 'help', run: () => void openHelp() },
  { id: 'settings', label: 'Settings', ico: 'sliders', run: () => void openSettings() },
];

let rail: HTMLElement | null = null;

function named(): boolean {
  try { return localStorage.getItem(NAMES) === '1'; } catch { return false; }
}

function button(s: Spot): HTMLButtonElement {
  const b = h('button', 'rail-item') as HTMLButtonElement;
  b.dataset.rail = s.id;
  if (s.kind) b.dataset.kind = s.kind;
  b.title = s.label;
  b.setAttribute('aria-label', s.label);
  b.append(icon(s.ico, 18), h('span', 'rail-name', s.label));
  b.onclick = () => (s.kind ? toggle(s, b) : s.run(b));
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

export function initRail() {
  rail = h('aside', 'rail');
  rail.id = 'rail';
  rail.setAttribute('aria-label', 'Rail');
  rail.append(...TOP.map(button), h('div', 'rail-rule'), ...UNDER.map(button), h('div', 'grow'));
  const names = button({ id: 'names', label: named() ? 'Hide names' : 'Show names', ico: 'sidebar', run: () => setNamed(!document.documentElement.classList.contains('rail-named')) });
  rail.append(names, ...FOOT.map(button));
  document.body.append(rail);
  document.documentElement.classList.toggle('rail-named', named());
  void sizeClass;
  railOn();
}
