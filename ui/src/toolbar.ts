// What the old toolbar did, without a toolbar (design/features/command round 2, accepted 2026-11-13): the reader's tools
// sit at the command box's end while the reader is in front (KJV/YLT, Highlights, Listen, Find in chapter), the panes
// are on the rail (rail.ts), and window things are in More. The catalog stays as the list of panes Layouts can open.
// settings/toolbar.json is left as it is on disk; the window no longer reads it.
import { wb } from './api';
import { openDocuments } from './documents';
import { openFindings } from './findings';
import { openLegend } from './legendpane';
import { openNotebook } from './notebook';
import { openHelp, openPlans, openShelf, openThreads, openToday } from './panes';
import { toast } from './sheets';
import { applyTheme, bridge, openSettings, themeState } from './settings';
import { h, icon, popMenu } from './ui';
import { menu as layoutMenu } from './layouts';

/** What main.ts lends: things that live there (the Highlights menu, the version, searching a chapter). */
export const hooks = {
  highlights: (_from: HTMLElement) => {},
  toggleVersion: async (): Promise<string> => '',
  find: () => {},
  listen: () => {},
};

export interface Item {
  id: string; label: string; icon: string; group: 'Panes' | 'Reading controls' | 'Commands'; sub: string;
  run: (from: HTMLElement) => void;
  /** listed in More ⋯ when it is not on the toolbar */
  more?: boolean;
  caret?: boolean;
}

export const CATALOG: Item[] = [
  { id: 'notebook', label: 'Notebook', icon: 'notebook', group: 'Panes', sub: 'Your notes and pages', run: () => void openNotebook(), more: true },
  { id: 'threads', label: 'Threads', icon: 'threads', group: 'Panes', sub: 'Your threads', run: () => void openThreads(), more: true },
  { id: 'legend', label: 'Legend', icon: 'legend', group: 'Panes', sub: 'Your marks’ styles, and where each is used', run: () => void openLegend(), more: true },
  { id: 'shelf', label: 'Shelf', icon: 'shelf', group: 'Panes', sub: 'Your sets', run: () => void openShelf(), more: true },
  { id: 'plans', label: 'Reading plans', icon: 'lines', group: 'Panes', sub: 'Plans and today’s reading', run: () => void openPlans(), more: true },
  { id: 'log', label: 'Today’s log', icon: 'file', group: 'Panes', sub: 'What was typed today', run: () => void openToday(''), more: true },
  { id: 'findings', label: 'Findings', icon: 'prompt', group: 'Panes', sub: 'Your notes about the app', run: () => void openFindings(), more: true },
  { id: 'documents', label: 'Documents', icon: 'file', group: 'Panes', sub: 'Word files and slides made from your study', run: () => void openDocuments(), more: true },
  { id: 'help', label: 'Help', icon: 'help', group: 'Panes', sub: 'The guide, the commands, the keys', run: () => void openHelp() },
  { id: 'keys', label: 'Keys', icon: 'lines', group: 'Panes', sub: 'Every key the window understands', run: () => bridge.openKeys() },
  { id: 'settings', label: 'Settings', icon: 'sliders', group: 'Panes', sub: 'Reading, theme, notebook…', run: () => void openSettings() },
  { id: 'version', label: 'KJV', icon: '', group: 'Reading controls', sub: 'KJV ↔ YLT in one click', run: () => void hooks.toggleVersion().then(toast) },
  { id: 'highlights', label: 'Highlights', icon: 'pen', group: 'Reading controls', sub: 'What is drawn in the reader', run: from => hooks.highlights(from), caret: true },
  { id: 'layout', label: 'Layout', icon: 'sidebar', group: 'Reading controls', sub: 'Open or save an arrangement of panes', run: from => void layoutMenu(from, s => void openSettings(s)), caret: true },
  { id: 'find', label: 'Find in chapter', icon: 'search', group: 'Reading controls', sub: 'Ctrl+F', run: () => hooks.find() },
  { id: 'listen', label: 'Listen', icon: 'play', group: 'Reading controls', sub: 'Read this chapter aloud with a local English voice', run: () => hooks.listen(), more: true },
  { id: 'textsize', label: 'Text size', icon: 'heading', group: 'Reading controls', sub: 'A− 100% A+, one small menu', run: from => textSizeMenu(from), caret: true },
  { id: 'fullscreen', label: 'Full screen', icon: 'expand', group: 'Reading controls', sub: 'The whole window, F11', run: () => void toggleFullScreen(), more: true },
  { id: 'theme', label: 'Theme', icon: 'eye', group: 'Reading controls', sub: 'Light ↔ dark in one click', run: () => flipTheme() },
];
export const byId = (id: string) => CATALOG.find(c => c.id === id);

export function textSizeMenu(from: HTMLElement) {
  const box = h('div', 'size-row');
  let pct = bridge.size();
  const label = h('span', 'size-pct', `${pct}%`);
  const step = (n: number) => { bridge.setSize(n === 100 ? 100 : pct + n); pct = bridge.size(); label.textContent = `${pct}%`; void wb(['settings', 'reading', 'size', String(pct)]).catch(() => {}); };
  const minus = h('button', 'btn', 'A−'), plus = h('button', 'btn', 'A+'), r = h('button', 'btn', '100%');
  minus.onclick = () => step(-10); plus.onclick = () => step(10); r.onclick = () => step(100);
  box.append(minus, label, plus, r);
  popMenu(from, box, { align: 'right', width: 240 });
}

export function flipTheme() {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  themeState.active = dark ? 'Light' : 'Dark';
  applyTheme();
  void wb(['settings', 'theme', 'active', JSON.stringify(themeState.active)]).catch(() => {});
}

// ---- the reader's tools at the box's end ----------------------------------------------------------------------------
let versionLabel = 'KJV';

/** The notebook's count once sat on its toolbar button; the rail has no badges (minimize round 4), so it is not drawn. */
export function setBadge(_n: number) {}
export function setVersionLabel(v: string) {
  versionLabel = v;
  const b = document.getElementById('tb-version');
  if (b) b.textContent = v;
}

/** The reader's tools, in the order the design draws them (C13). */
export const READER_TOOLS = ['version', 'highlights', 'listen', 'find'];

export function initReaderTools() {
  const at = document.querySelector<HTMLElement>('#cmdbox .cmd-tools');
  if (!at) return;
  at.replaceChildren();
  for (const id of READER_TOOLS) {
    const it = byId(id)!;
    const b = h('button', id === 'version' ? 'cmd-tool cmd-version' : 'cmd-tool') as HTMLButtonElement;
    b.id = id === 'version' ? 'tb-version' : id === 'highlights' ? 'hl-menu' : `tb-${id}`;
    b.dataset.item = id;
    b.title = `${it.label} · ${it.sub}`;
    b.setAttribute('aria-label', it.label);
    if (id === 'version') b.textContent = versionLabel;
    else b.append(icon(it.icon, 15));
    b.onmousedown = e => e.preventDefault();
    b.onclick = () => it.run(b);
    at.append(b);
  }
}

/** Full screen for the whole app (design/features/settings: an action in the ⋯ menu and F11, not a setting; 0e94). */
export async function toggleFullScreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { toast('Full screen is not available in this window'); }
}
document.addEventListener('keydown', e => {
  if (e.key !== 'F11' || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  void toggleFullScreen();
});
