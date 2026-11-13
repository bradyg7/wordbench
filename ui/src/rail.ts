// The rail on the left (design/features/minimize, build go-ahead 2026-11-13; drawn with the top bar in
// design/features/command round 2, C13-C17). Icons only, the name on hover; Show names opens it out with labels, and is
// remembered in the window's storage. No count badges. An icon opens its pane or brings it to the front, and shows as on
// while that pane is in front. The Concordance, BDB and Webster's join when their own folders are built.
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
  b.onclick = () => s.run(b);
  return b;
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
