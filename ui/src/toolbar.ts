// The toolbar (R4 step 3, docs/archive/2026-11-10/docs/redesign-R4.md): the buttons are the person's list in settings/toolbar.json (`wb settings
// toolbar buttons '["notebook",…]'`), drawn from a catalog of everything that can be a button. A button that does not fit
// waits in More ⋯ under "Hidden to fit" (from the right end), so the bar never clips. "Customize toolbar…" turns the bar
// into its own editor: a grip to drag, × to put away, Add opens the catalog beside the live window.
import { wb } from './api';
import { openDocuments } from './documents';
import { openFindings } from './findings';
import { openNotebook } from './notebook';
import { openHelp, openPlans, openShelf, openThreads, openToday } from './panes';
import { toast } from './sheets';
import { applyTheme, bridge, openSettings, themeState } from './settings';
import { h, icon, popMenu } from './ui';
import { menu as layoutMenu } from './layouts';
import { form, kept, onChange, run as runKept } from './mycommands';

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
export const DEFAULT = ['version', 'notebook', 'shelf', 'highlights'];  // no Threads: a thread is a page (R1)
/** The catalog and the commands the person keeps (R4 step 4). */
export const all = (): Item[] => [...CATALOG, ...kept.map(k => ({ id: `cmd:${k.id}`, label: k.name, icon: k.icon, group: 'Commands' as const, sub: k.line, run: () => void runKept(k), more: true }))];
const byId = (id: string) => all().find(c => c.id === id);
const DOMID: Record<string, string> = { version: 'tb-version', notebook: 'tb-notebook', threads: 'tb-threads', shelf: 'tb-shelf', highlights: 'hl-menu' };

function textSizeMenu(from: HTMLElement) {
  const box = h('div', 'size-row');
  let pct = bridge.size();
  const label = h('span', 'size-pct', `${pct}%`);
  const step = (n: number) => { bridge.setSize(n === 100 ? 100 : pct + n); pct = bridge.size(); label.textContent = `${pct}%`; void wb(['settings', 'reading', 'size', String(pct)]).catch(() => {}); };
  const minus = h('button', 'btn', 'A−'), plus = h('button', 'btn', 'A+'), r = h('button', 'btn', '100%');
  minus.onclick = () => step(-10); plus.onclick = () => step(10); r.onclick = () => step(100);
  box.append(minus, label, plus, r);
  popMenu(from, box, { align: 'right', width: 240 });
}

function flipTheme() {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  themeState.active = dark ? 'Light' : 'Dark';
  applyTheme();
  void wb(['settings', 'theme', 'active', JSON.stringify(themeState.active)]).catch(() => {});
}

// ---- state ----------------------------------------------------------------------------------------------------------------
let ids: string[] = [...DEFAULT];
let fit: string[] = [];          // on the list but waiting in More ⋯ because they do not fit
let editing = false;
let snapshot: string[] = [];
let badge = 0;
let versionLabel = 'KJV';

const tools = () => document.querySelector<HTMLElement>('nav.tools')!;
const bar = () => document.getElementById('bar')!;

export const onToolbar = () => ids.filter(i => byId(i));
export const hiddenToFit = () => fit.map(byId).filter(Boolean) as Item[];
export const absent = () => all().filter(c => c.more && !ids.includes(c.id));

export function setBadge(n: number) {
  badge = n;
  const b = document.querySelector<HTMLElement>('#tb-notebook .badge');
  if (b) { b.hidden = !n; b.textContent = String(n); }
}
export function setVersionLabel(v: string) {
  versionLabel = v;
  const b = document.getElementById('tb-version');
  if (b) b.textContent = v;
}

function button(it: Item): HTMLButtonElement {
  const b = h('button', 'tb') as HTMLButtonElement;
  if (DOMID[it.id]) b.id = DOMID[it.id];
  b.dataset.item = it.id;
  if (it.icon) b.append(icon(it.icon));
  b.append(document.createTextNode(it.id === 'version' ? versionLabel : it.label));
  if (it.id === 'notebook') { const bd = h('span', 'badge'); bd.hidden = !badge; bd.textContent = String(badge); b.append(bd); }
  if (it.caret) b.append(icon('down', 14));
  b.title = it.sub;
  b.onclick = () => it.run(b);
  return b;
}

export function render() {
  const nav = tools();
  nav.replaceChildren();
  bar().classList.toggle('tb-editing', editing);
  const list = onToolbar();
  for (const id of list) {
    const it = byId(id)!;
    if (!editing) { nav.append(button(it)); continue; }
    const cell = h('span', 'tb-edit');
    cell.draggable = true;
    cell.dataset.item = id;
    const b = button(it);
    b.onclick = null;
    b.disabled = true;
    const x = h('button', 'tb-x');
    x.append(icon('x', 12));
    x.title = `Put ${it.label} away (it waits in More ⋯)`;
    x.onclick = () => { ids = ids.filter(i => i !== id); render(); drawerRefresh(); };
    cell.append(icon('grip', 14), b, x);
    cell.ondragstart = e => { e.dataTransfer?.setData('text/plain', id); cell.classList.add('drag'); };
    cell.ondragend = () => cell.classList.remove('drag');
    cell.ondragover = e => { e.preventDefault(); };
    cell.ondrop = e => {
      e.preventDefault();
      const from = e.dataTransfer?.getData('text/plain');
      if (!from || from === id) return;
      const next = ids.filter(i => i !== from);
      const at = next.indexOf(id);
      const r = cell.getBoundingClientRect();
      next.splice(e.clientX > r.left + r.width / 2 ? at + 1 : at, 0, from);
      ids = next; render();
    };
    nav.append(cell);
  }
  if (editing) {
    const add = h('button', 'tb tb-add');
    add.append(icon('plus', 14), document.createTextNode('Add'));
    add.onclick = () => toggleDrawer();
    const done = h('button', 'btn primary tb-done', 'Done');
    done.onclick = () => finish(true);
    nav.append(add, done);
  }
  fitToBar();
}

/** Hide buttons from the right end until the rest fit (never while editing). */
export function fitToBar() {
  const nav = tools();
  fit = [];
  nav.querySelectorAll<HTMLElement>(':scope > .tb[data-item]').forEach(b => { b.hidden = false; });
  if (editing || getComputedStyle(nav).display === 'none') return;
  const b = bar();
  let others = 0;
  for (const c of Array.from(b.children) as HTMLElement[]) if (c !== nav && !c.classList.contains('grow') && c.id !== 'cmdbox') others += c.offsetWidth;
  const avail = b.clientWidth - 24 - others - 200 - 12 - 6 * (b.children.length + 1);
  const btns = Array.from(nav.querySelectorAll<HTMLElement>(':scope > .tb[data-item]'));
  let used = btns.reduce((n, x) => n + x.offsetWidth + 2, 0);
  for (let i = btns.length - 1; i >= 0 && used > avail; i--) {
    used -= btns[i].offsetWidth + 2;
    btns[i].hidden = true;
    fit.unshift(btns[i].dataset.item!);
  }
}

// ---- editing --------------------------------------------------------------------------------------------------------------
let drawer: HTMLElement | null = null;
export function customize() {
  if (editing) return;
  editing = true;
  snapshot = [...ids];
  render();
  toggleDrawer(true);
  document.addEventListener('keydown', onKey, true);
}
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && editing) { e.stopPropagation(); finish(false); } }
async function finish(keep: boolean) {
  editing = false;
  document.removeEventListener('keydown', onKey, true);
  drawer?.remove(); drawer = null;
  if (!keep) ids = snapshot;
  else await saveList();
  render();
}
const saveList = () => wb(['settings', 'toolbar', 'buttons', JSON.stringify(ids)]).catch(e => toast(String(e)));

function toggleDrawer(open?: boolean) {
  if (drawer && open !== true) { drawer.remove(); drawer = null; return; }
  if (drawer) return;
  drawer = h('aside', 'tb-drawer');
  document.body.append(drawer);
  drawerRefresh();
}
let query = '';
function drawerRefresh() {
  if (!drawer) return;
  drawer.replaceChildren();
  drawer.append(h('h2', 'pane-title', 'Add to the toolbar'), h('div', 'muted small', 'Click + to add. Drag the buttons above to reorder; × puts one away.'));
  const q = h('input', 'field') as HTMLInputElement;
  q.placeholder = 'Find a button';
  q.value = query;
  q.oninput = () => { query = q.value; drawerRefresh(); const n = drawer!.querySelector<HTMLInputElement>('input'); n?.focus(); n?.setSelectionRange(query.length, query.length); };
  drawer.append(q);
  for (const g of ['Panes', 'Reading controls', 'Commands'] as const) {
    const items = all().filter(c => c.group === g && `${c.label} ${c.sub}`.toLowerCase().includes(query.toLowerCase()));
    if (!items.length) continue;
    drawer.append(h('div', 'label', g));
    for (const it of items) {
      const on = ids.includes(it.id);
      const r = h('button', `tb-entry${on ? ' on' : ''}`);
      r.append(icon(on ? 'check' : 'plus', 14));
      const t = h('span', 'more-text');
      t.append(h('span', '', it.label), h('span', 'muted small', on ? 'on your toolbar' : it.sub));
      r.append(t);
      r.disabled = on;
      r.onclick = () => { ids = [...ids, it.id]; render(); drawerRefresh(); };
      drawer.append(r);
    }
  }
  const own = h('button', 'tb-entry');
  own.append(icon('plus', 14));
  const ot = h('span', 'more-text');
  ot.append(h('span', '', 'A command of your own…'), h('span', 'muted small', 'any line, like uses {word} or compare {place} ylt'));
  own.append(ot);
  own.onclick = () => {
    drawer!.replaceChildren(h('h2', 'pane-title', 'A command of your own'), form(null, () => drawerRefresh(), { addToToolbar: k => { ids = [...ids, `cmd:${k.id}`]; render(); } }));
  };
  drawer.append(own);
  const reset = h('button', 'link-btn', 'Reset to the standard toolbar');
  reset.onclick = () => { ids = [...DEFAULT]; render(); drawerRefresh(); };
  drawer.append(reset);
}

// ---- start ----------------------------------------------------------------------------------------------------------------
export async function loadToolbar() {
  onChange.push(() => { render(); drawerRefresh(); });
  try {
    const t: any = await wb(['settings', 'toolbar']);
    if (Array.isArray(t.buttons)) ids = t.buttons.filter((i: unknown) => typeof i === 'string' && byId(i as string));
  } catch { /* the standard toolbar */ }
  render();
}
export function initToolbar() {
  render();
  new ResizeObserver(() => { if (!editing) fitToBar(); }).observe(bar());
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
