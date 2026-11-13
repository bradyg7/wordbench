// Layouts (R4 step 5, docs/archive/2026-11-10/docs/redesign-R4.md): a layout is which panes are open, kept under a name (`wb layout save|show|list|rm`,
// sessions/layouts/*.json). Applying one opens its panes and closes the others. (Called "view" on the first sheets; "view" is
// the Notebook's lists now, so these are Layouts.) Menu on the toolbar, and Settings ▸ Layouts.
import { wb } from './api';
import { runLine } from './actions';
import { toast } from './sheets';
import { h, popMenu } from './ui';
import { kept, loadKept, save as saveCommand } from './mycommands';

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

/** Settings ▸ Layouts: the saved ones (Open, Remove) and Save this layout. */
export async function section(redraw: () => void): Promise<HTMLElement[]> {
  await loadKept();
  const out: HTMLElement[] = [];
  for (const l of await list()) {
    const r = h('div', 'set-row');
    const t = h('div', 'set-text');
    t.append(h('div', 'set-name', l.name), h('div', 'muted small', l.saved ? `Saved ${String(l.saved).slice(0, 10)}` : ''));
    const ctl = h('div', 'wrap');
    const go = h('button', 'btn', 'Open'); go.onclick = () => void apply(l.name);
    const rm = h('button', 'link-btn danger', 'Remove'); rm.onclick = () => void remove(l.name).then(redraw);
    ctl.append(go, rm);
    const line = `layout load ${l.name}`;
    const binding = kept.find(c => c.line === line);
    const key = h('input', 'field') as HTMLInputElement;
    key.value = binding?.key ?? '';
    key.placeholder = 'Shortcut (optional)'; key.setAttribute('aria-label', `Shortcut for ${l.name}`);
    const assign = h('button', 'btn', 'Save shortcut');
    assign.onclick = async () => {
      if (!key.value.trim()) { if (binding) await saveCommand({ ...binding, key: '' }); }
      else await saveCommand({ name: binding?.name ?? `Layout: ${l.id}`, line, icon: 'sidebar', key: key.value.trim() });
      redraw();
    };
    ctl.append(key, assign);
    r.append(t, ctl);
    r.dataset.find = `${l.name} layout arrangement panes`;
    out.push(r);
  }
  if (!out.length) out.push(h('p', 'muted', 'No layouts yet. Open the panes the way you want them, name it, and Save.'));
  const f = h('form', 'go') as HTMLFormElement;
  const i = h('input', 'field') as HTMLInputElement;
  i.placeholder = 'Name for the panes open now';
  f.append(i, h('button', 'btn soft', 'Save this layout'));
  f.onsubmit = async e => { e.preventDefault(); if (await saveAs(i.value)) redraw(); };
  out.push(f);
  return out;
}
