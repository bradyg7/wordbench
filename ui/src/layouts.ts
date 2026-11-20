// Layouts (R4 step 5, docs/archive/2026-11-10/docs/redesign-R4.md): a layout is which panes are open, kept under a name (`wb layout save|show|list|rm`,
// sessions/layouts/*.json). Applying one opens its panes and closes the others. (Called "view" on the first sheets; "view" is
// the Notebook's lists now, so these are Layouts.) Menu on the toolbar, and Settings ▸ Layouts.
import { wb } from './api';
import { runLine } from './actions';
import { toast } from './sheets';
import { h, popMenu } from './ui';
import { kept, loadKept, save as saveCommand } from './mycommands';
import { dock } from './panes';
import { CATALOG } from './toolbar';
import { readLayout, type LayoutState } from './layout-state';

export interface Saved { name: string; id: string; saved?: string }

export const list = async (): Promise<Saved[]> => { try { return await wb(['layout', 'list']); } catch { return []; } };
export async function apply(name: string) {
  const r = await runLine(`layout load ${name}`).catch(e => ({ ok: false, error: String(e) } as { ok: boolean; said?: string; error?: string }));
  toast(r.ok ? (r.said ?? `Layout ${name}`) : r.error || 'That layout could not be opened');
}
export async function saveAs(name: string) {
  const n = name.trim();
  if (!n) { toast('Give the layout a name'); return false; }
  const r = await runLine(`layout save ${n}`).catch(e => ({ ok: false, error: String(e) } as { ok: boolean; said?: string; error?: string }));
  toast(r.ok ? (r.said ?? `Saved ${n}`) : r.error || 'Not saved');
  return !!r.ok;
}
export const remove = (name: string) => wb(['layout', 'rm', name]).catch(e => toast(String(e)));

/** The toolbar's Layout menu. */
export async function menu(from: HTMLElement, openSettings: (s: string) => void) {
  const box = h('div', 'menu-list layers-menu');
  const items = await list();
  box.append(h('div', 'label', 'Layouts'));
  if (!items.length) box.append(h('div', 'muted small', 'None saved yet. Arrange the panes, then Save this layout.'));
  for (const l of items) {
    const b = h('button', 'menu-item', l.name);
    b.onclick = () => { close(); void apply(l.name); };
    box.append(b);
  }
  const f = h('form', 'go') as HTMLFormElement;
  const i = h('input', 'field') as HTMLInputElement;
  i.placeholder = 'Name for this layout';
  f.append(i, h('button', 'btn', 'Save'));
  f.onsubmit = async e => { e.preventDefault(); if (await saveAs(i.value)) close(); };
  box.append(h('div', 'label', 'Save this layout'), f);
  const all = h('button', 'menu-item', 'Layouts in Settings…');
  all.onclick = () => { close(); openSettings('Layouts'); };
  box.append(all);
  const close = popMenu(from, box, { align: 'right', width: 280 });
}

/** A small picture of a layout: the reader in the middle, each docked group on its side, floats as small boxes. */
export function picture(l: LayoutState | null, w = 168, hgt = 100): HTMLElement {
  const box = h('div', 'lay-pic');
  box.style.width = `${w}px`; box.style.height = `${hgt}px`;
  const groups = l?.groups ?? [];
  const has = (s: string) => groups.filter(g => g.side === s).length;
  const L = has('left') ? 30 : 0, R = has('right') ? 30 : 0, T = has('top') ? 28 : 0, B = has('bottom') ? 28 : 0;
  const part = (cls: string, x: number, y: number, ww: number, hh: number) => {
    const p = h('i', cls);
    Object.assign(p.style, { left: `${x}%`, top: `${y}%`, width: `${ww}%`, height: `${hh}%` });
    box.append(p);
  };
  part('lay-reader', L, T, 100 - L - R, 100 - T - B);
  const stack = (side: string, x: number, y: number, ww: number, hh: number, across: boolean) => {
    const gs = groups.filter(g => g.side === side);
    gs.forEach((_, i) => across
      ? part('lay-pane', x + (ww / gs.length) * i, y, ww / gs.length, hh)
      : part('lay-pane', x, y + (hh / gs.length) * i, ww, hh / gs.length));
  };
  stack('left', 0, 0, L, 100, false);
  stack('right', 100 - R, 0, R, 100, false);
  stack('top', L, 0, 100 - L - R, T, true);
  stack('bottom', L, 100 - B, 100 - L - R, B, true);
  groups.filter(g => g.side === 'float').forEach((_, i) => part('lay-pane lay-float', 40 + i * 8, 20 + i * 8, 34, 40));
  return box;
}

async function shown(name: string): Promise<LayoutState | null> {
  try { const s = await wb(['layout', 'show', name]); return readLayout(s.layout ?? s); } catch { return null; }
}

/** The window as it is, without Settings itself (it is where the layout is being made). */
export function current(): LayoutState {
  const s = dock.snapshot();
  const drop = new Set(s.panes.filter(p => p.kind === 'settings' || p.key === 'settings').map(p => p.key));
  return {
    ...s,
    panes: s.panes.filter(p => !drop.has(p.key)),
    groups: s.groups.map(g => ({ ...g, keys: g.keys.filter(k => !drop.has(k)) })).filter(g => g.keys.length),
    active: s.active && drop.has(s.active) ? undefined : s.active,
  };
}

async function keyFor(l: Saved, redraw: () => void) {
  const line = `layout load ${l.name}`;
  const binding = kept.find(c => c.line === line);
  const k = prompt(`A key for ${l.name} (e.g. Ctrl+2); empty for none`, binding?.key ?? '');
  if (k === null) return;
  if (!k.trim()) { if (binding) await saveCommand({ ...binding, key: '' }); }
  else await saveCommand({ name: binding?.name ?? `Layout: ${l.id}`, line, icon: 'sidebar', key: k.trim() });
  redraw();
}

async function rename(l: Saved, redraw: () => void) {
  const n = prompt(`Rename ${l.name}`, l.name)?.trim();
  if (!n || n === l.name) return;
  try {
    const s = await wb(['layout', 'show', l.name]);
    await wb(['layout', 'save', n], JSON.stringify(s.layout ?? s));
    await wb(['layout', 'rm', l.name]);
    toast(`Renamed to ${n}`);
  } catch (e) { toast(String(e)); }
  redraw();
}

/** Which layout the builder is making: null for none, '' for a new one, else the one being edited. */
let building: string | null = null;

/** The builder (L3): the window as it is now, its panes listed to close and more to add; the window changes as you go,
 *  and Save keeps it. Saving at once is saving the window; changing it first is creating. */
function builder(redraw: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const head = h('div', 'lay-build-head');
  head.append(h('div', 'set-name', building ? `Edit ${building}` : 'New layout'),
    h('div', 'muted small', 'The window as it is now. Close or add panes and the window changes with you; Save keeps it.'));
  out.push(head);
  out.push(picture(current(), 300, 180));
  const list = h('div', 'lay-build-panes');
  for (const p of dock.panes.filter(p => p.kind !== 'settings')) {
    const r = h('div', 'set-row');
    const close = h('button', 'link-btn danger', 'Close');
    close.onclick = async () => { await dock.close(p); redraw(); };
    r.append(h('div', 'set-text', `${p.title} · ${p.side ?? ''}`), close);
    list.append(r);
  }
  if (!list.childElementCount) list.append(h('p', 'muted small', 'Only the reader is open.'));
  out.push(list);
  const add = h('select', 'field') as HTMLSelectElement;
  add.setAttribute('aria-label', 'Add a pane');
  const first = h('option', '', 'Add a pane…') as HTMLOptionElement; first.value = ''; add.append(first);
  for (const it of CATALOG.filter(i => i.group === 'Panes' && i.id !== 'settings')) {
    const o = h('option', '', it.label) as HTMLOptionElement; o.value = it.id; add.append(o);
  }
  add.onchange = () => { const it = CATALOG.find(i => i.id === add.value); if (it) { it.run(add); setTimeout(redraw, 300); } };
  out.push(add);
  const f = h('form', 'go') as HTMLFormElement;
  const name = h('input', 'field') as HTMLInputElement;
  name.placeholder = 'Name'; name.value = building ?? ''; name.setAttribute('aria-label', 'Layout name');
  const cancel = h('button', 'btn', 'Cancel'); cancel.type = 'button';
  cancel.onclick = () => { building = null; redraw(); };
  f.append(name, h('button', 'btn soft', 'Save'), cancel);
  f.onsubmit = async e => {
    e.preventDefault();
    const n = name.value.trim();
    if (!n) { toast('Give the layout a name'); return; }
    try {
      await wb(['layout', 'save', n], JSON.stringify(current()));
      if (building && building !== n) await wb(['layout', 'rm', building]);
      toast(`Saved ${n}`);
      building = null; redraw();
    } catch (x) { toast(String(x)); }
  };
  out.push(f);
  return out;
}

/** Settings ▸ Layouts (design/features/settings L3): one grid, three across; New layout first. A click arranges the
 *  window; right-click (or ⋯) a layout to Edit, Rename, set its Key, or Delete. */
export async function section(redraw: () => void): Promise<HTMLElement[]> {
  await loadKept();
  if (building !== null) return builder(redraw);
  const grid = h('div', 'lay-grid');
  grid.dataset.find = 'layouts layout arrangement panes new';
  const nw = h('button', 'lay-card lay-new');
  nw.append(h('span', 'lay-plus', '+'), h('span', 'set-name', 'New layout'));
  nw.onclick = () => { building = ''; redraw(); };
  grid.append(nw);
  for (const l of await list()) {
    const card = h('div', 'lay-card');
    card.dataset.find = `${l.name} layout`.toLowerCase();
    const open = h('button', 'lay-open');
    open.title = `Arrange the window as ${l.name}`;
    open.append(picture(await shown(l.name)));
    open.onclick = () => void apply(l.name);
    const key = kept.find(c => c.line === `layout load ${l.name}`)?.key;
    const more = h('button', 'icon-btn lay-more', '⋯');
    more.setAttribute('aria-label', `More for ${l.name}`);
    const menuFor = (at?: { x: number; y: number }) => {
      const box = h('div', 'menu-list');
      let close = () => {};
      const item = (label: string, fn: () => void) => {
        const b = h('button', 'menu-item', label);
        b.onclick = () => { close(); fn(); };
        box.append(b);
      };
      item('Edit', async () => { await apply(l.name); building = l.name; redraw(); });
      item('Rename…', () => void rename(l, redraw));
      item('Key…', () => void keyFor(l, redraw));
      item('Delete', async () => { if (confirm(`Delete the layout ${l.name}?`)) { await remove(l.name); redraw(); } });
      close = popMenu(more, box, { width: 170, ...(at ? { at } : {}) });
    };
    more.onclick = () => menuFor();
    card.oncontextmenu = e => { e.preventDefault(); menuFor({ x: e.clientX, y: e.clientY }); };
    const foot = h('div', 'lay-foot');
    const words = h('div', 'lay-words');
    words.append(h('div', 'set-name', l.name), h('div', 'muted small', key || 'no key'));
    foot.append(words, more);
    card.append(open, foot);
    grid.append(card);
  }
  return [grid];
}
