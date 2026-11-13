// My commands (R4 step 4, docs/archive/2026-11-10/docs/redesign-R4.md): command lines the person keeps, in settings/commands.json (`wb commands`).
// A line is written as typed in the command field; {word}, {place} and {chapter} take what is selected or being read.
// A kept command can be a toolbar button (the catalog lists them) and have its own key.
import { wb } from './api';
import { runLine } from './actions';
import { toast } from './sheets';
import { h } from './ui';

export interface Kept { id: string; name: string; line: string; icon: string; key: string }

/** What main.ts lends: the selected word, the place being read. */
export const fills = { get: (): { word: string; place: string; chapter: string } => ({ word: '', place: '', chapter: '' }) };

export let kept: Kept[] = [];
export const onChange: (() => void)[] = [];
const changed = () => onChange.forEach(f => f());

export async function loadKept() {
  try { kept = await wb(['commands']); } catch { kept = []; }
  changed();
}

export const ICONS = ['search', 'book', 'notebook', 'threads', 'pen', 'lines', 'file', 'prompt', 'eye', 'heading', 'quote', 'pin'];

/** The line with the fill-ins given, or why not (the same rule as `wb commands fill`). */
export function filled(line: string): { ok: true; line: string } | { ok: false; why: string } {
  const f = fills.get();
  let out = line;
  for (const [tok, v, what] of [['{word}', f.word, 'a selected word'], ['{place}', f.place, 'a place'], ['{chapter}', f.chapter, 'a chapter']] as const) {
    if (!out.includes(tok)) continue;
    if (!v.trim()) return { ok: false, why: `Select ${what} first: this command uses ${tok}.` };
    out = out.split(tok).join(v.trim());
  }
  return { ok: true, line: out };
}

export async function run(c: Kept) {
  const r = filled(c.line);
  if (!r.ok) { toast(r.why); return; }
  const done = await runLine(r.line).catch(e => ({ ok: false, error: String(e) } as { ok: boolean; said?: string; error?: string }));
  if (!done.ok) toast(done.error || 'That did not work');
}

/** A key like "Ctrl+U" the event matches. */
export function matches(e: KeyboardEvent, key: string) {
  const m = /^(Ctrl|Alt)\+(.+)$/i.exec(key);
  if (!m) return false;
  const want = m[2].toLowerCase();
  return (m[1].toLowerCase() === 'ctrl' ? e.ctrlKey || e.metaKey : e.altKey) && !e.shiftKey && e.key.toLowerCase() === want;
}
/** A kept command whose key this is (not while typing in a field). */
export function byKey(e: KeyboardEvent): Kept | undefined {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return undefined;
  return kept.find(c => c.key && matches(e, c.key));
}

export async function save(c: { name: string; line: string; icon: string; key: string }): Promise<Kept | null> {
  const args = ['commands', 'add', c.name, c.line];
  if (c.key) args.push('--key', c.key);
  if (c.icon) args.push('--icon', c.icon);
  try {
    const r = await wb(args);
    await loadKept();
    return r;
  } catch (e) { toast(String(e)); return null; }
}
export async function remove(c: Kept) {
  try { await wb(['commands', 'rm', c.name]); await loadKept(); } catch (e) { toast(String(e)); }
}

/** The form: a name, the line, an icon, a key; Test shows the line as it would run now. `done` gets the kept command. */
export function form(existing: Kept | null, done: (k: Kept | null) => void, extra?: { addToToolbar: (k: Kept) => void }): HTMLElement {
  const box = h('div', 'cmd-form');
  const field = (label: string, value: string, ph = '') => {
    const r = h('label', 'cmd-field');
    r.append(h('span', 'set-name', label));
    const i = h('input', 'field') as HTMLInputElement;
    i.value = value; i.placeholder = ph;
    r.append(i);
    box.append(r);
    return i;
  };
  const name = field('Name on the button', existing?.name ?? '', 'uses of a word');
  const line = field('The line', existing?.line ?? '', 'uses {word}');
  box.append(h('div', 'muted small', 'Written as you would type it in the command field. {word} is the selected word, {place} the verse picked or at the top, {chapter} the chapter being read.'));
  const icon = h('select', 'field') as HTMLSelectElement;
  for (const n of ['', ...ICONS]) { const o = h('option', '', n || 'No icon') as HTMLOptionElement; o.value = n; o.selected = n === (existing?.icon ?? ''); icon.append(o); }
  const ir = h('label', 'cmd-field');
  ir.append(h('span', 'set-name', 'Icon'), icon);
  box.append(ir);
  const key = field('Key (optional)', existing?.key ?? '', 'Ctrl+U');
  const test = h('div', 'cmd-test');
  const drawTest = () => {
    const l = line.value.trim();
    test.replaceChildren(h('div', 'label', 'Test, with what is selected now'));
    if (!l) { test.append(h('span', 'muted small', 'Nothing to run yet.')); return; }
    const r = filled(l);
    test.append(h('div', 'set-name', r.ok ? `${l}  →  ${r.line}` : l), h('div', `small ${r.ok ? 'muted' : 'warn'}`, r.ok ? 'This is what it would run. Nothing is run or written by testing.' : r.why));
  };
  line.oninput = drawTest;
  drawTest();
  box.append(test);
  const row = h('div', 'cmd-buttons');
  const keep = h('button', 'btn', 'Keep');
  const add = h('button', 'btn primary', 'Keep and add to toolbar');
  const cancel = h('button', 'link-btn', 'Cancel');
  const go = async (toolbar: boolean) => {
    if (existing && existing.name !== name.value.trim()) await remove(existing);
    const k = await save({ name: name.value, line: line.value, icon: icon.value, key: key.value });
    if (!k) return;
    if (toolbar) extra?.addToToolbar(k);
    done(k);
  };
  keep.onclick = () => void go(false);
  add.onclick = () => void go(true);
  cancel.onclick = () => done(null);
  row.append(cancel, keep);
  if (extra) row.append(add);
  box.append(row);
  return box;
}

/** The lines run most often (from the logs), without the ones already kept. */
export async function topUsed(): Promise<{ line: string; times: number }[]> {
  try { return await wb(['commands', '--top']); } catch { return []; }
}
