// The one filter-chip component (design/features/filters-v2, NB16): a chip is a button with a border and a fill, ▾ to open its picker and a
// separate × to take it away; "Add filter" is a labelled button; chips wrap onto more lines (nothing squeezed, no sideways scroll). Every
// picker is the one menu component (a bottom sheet with Done on a phone). Ticking a value applies at once. No filter value is typed; the
// words of a filter are the file's `filter:` line and `wb`'s `--filter`: `Status is Open, Done`, `Status is not set`, `Edited last 7 days`.
//
// A list gives this the properties it can be narrowed by (with the values its rows hold and how many hold each) and what to do when a
// filter is put, removed or cleared; the component draws the chips and the pickers. A list in a page, the Library's lists and Ctrl+K use it.

import { openMenu, type MenuGroup, type MenuHandle, type MenuItem } from './menu';
import { h } from './ui';

export interface PropValue { value: string; label?: string; count?: number; chapters?: PropValue[] }
export interface FilterProp { name: string; group?: string; hint?: string; type?: string; values: PropValue[] }
export interface Chip { property: string; way: string; values: string[]; text?: string; date?: boolean; gone?: boolean; gone_values?: string[] }
export interface ChipHost {
  props: FilterProp[];
  chips: Chip[];
  /** Put one filter, in its words (`Status is Open, Done`); the same property again replaces it. Applies at once. */
  apply(text: string): void | Promise<void>;
  remove(property: string): void | Promise<void>;
  clear(): void | Promise<void>;
  /** Titles of the groups in the Add filter menu, by `group` (default: page → About the page, own → Your own properties). */
  groupTitles?: Record<string, string>;
  /** The pickers open over another menu (Ctrl+K) without closing it. */
  nested?: boolean;
}

export const WAYS = ['is', 'is not', 'is not set', 'is set'] as const;
const DATE_ANY = 'any time';
const esc = (v: string) => v.replace(/,/g, '\\,');
const isDate = (p: FilterProp | undefined, c?: Chip) => !!(c?.date || p?.type === 'date' && /^(edited|written)$/i.test(p.name));

/** A filter's words: `Status is Open, Done`, `Status is not set`, `Edited last 7 days`. */
export function filterText(property: string, way: string, values: string[]): string {
  if (/^(edited|written)$/i.test(property)) return `${property} ${values[0] ?? DATE_ANY}`;
  return way === 'is not set' || way === 'is set' ? `${property} ${way}` : `${property} ${way} ${values.map(esc).join(', ')}`;
}

/** A filter's words → a chip (`Status is Open, Done`); null when they do not read. */
export function parseFilterText(text: string): Chip | null {
  const d = /^(Edited|Written) (.+)$/i.exec(text);
  if (d) return { property: d[1][0].toUpperCase() + d[1].slice(1).toLowerCase(), way: 'is', values: [d[2]], date: true };
  const m = /^(.+?) (is not set|is set|is not|is) ?(.*)$/.exec(text);
  if (!m) return null;
  const values = m[3] ? m[3].split(/(?<!\\), ?/).map(v => v.replace(/\\,/g, ',')) : [];
  return { property: m[1], way: m[2], values };
}

/** A chip's words, as `filterText` writes them. */
export const chipWords = (c: Chip) => filterText(c.property, c.way, c.values);

const labelOf =(p: FilterProp | undefined, v: string) => {
  const hit = p?.values.flatMap(x => [x, ...(x.chapters ?? [])]).find(x => x.value.toLowerCase() === v.toLowerCase());
  return hit?.label && !/^\d+$/.test(hit.label) ? hit.label : v;
};

/** What a chip says: `Status: Open`, `Status is not: Open`, `Status: not set`, `Edited: last 7 days`. */
export function chipLabel(c: Chip, p?: FilterProp): string {
  if (c.date) return `${c.property}: ${c.values[0] ?? 'any time'}`;
  if (c.way === 'is not set') return `${c.property}: not set`;
  if (c.way === 'is set') return `${c.property}: set`;
  return `${c.property}${c.way === 'is not' ? ' is not' : ''}: ${c.values.map(v => labelOf(p, v)).join(', ')}`;
}

/** Where focus goes after a chip is removed with its × or Backspace (the next chip, else Add filter). */
let refocus: number | null = null;

/** The row of chips: each with its picker and ×, then Add filter, then Clear (when there is any chip). */
export function chipRow(host: ChipHost, opts: { addLabel?: string } = {}): HTMLElement {
  const row = h('div', 'wb-chips');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Filters');
  const phone = window.innerWidth <= 520;
  const chips: HTMLButtonElement[] = [];
  host.chips.forEach((c, k) => {
    const p = host.props.find(x => x.name.toLowerCase() === c.property.toLowerCase());
    const box = h('span', `wb-chip${c.gone ? ' gone' : ''}`);
    box.dataset.property = c.property;
    const main = h('button', 'wb-chip-main') as HTMLButtonElement;
    main.type = 'button';
    const text = h('span', 'wb-chip-text');
    if (c.gone) {
      text.append(h('s', '', chipLabel(c, p)), h('span', 'wb-chip-gone', ' gone'));
    } else if (c.gone_values?.length && c.values.length) {
      text.append(document.createTextNode(`${c.property}${c.way === 'is not' ? ' is not' : ''}: `));
      c.values.forEach((v, i) => {
        if (i) text.append(document.createTextNode(', '));
        text.append(c.gone_values!.includes(v) ? h('s', '', v) : document.createTextNode(labelOf(p, v)));
      });
      text.append(h('span', 'wb-chip-gone', ' gone'));
    } else text.textContent = chipLabel(c, p);
    main.append(text, h('span', 'wb-chip-caret', '▾'));
    main.setAttribute('aria-label', `${chipLabel(c, p)}${c.gone ? ' (gone)' : ''}. Change this filter`);
    main.setAttribute('aria-haspopup', 'dialog');
    main.onclick = ev => { ev.stopPropagation(); openPicker(host, p ?? { name: c.property, values: [] }, main, c); };
    main.onkeydown = ev => {
      if (ev.key === 'Backspace' || ev.key === 'Delete') { ev.preventDefault(); ev.stopPropagation(); refocus = k; void host.remove(c.property); }
    };
    const x = h('button', 'wb-chip-x', '×') as HTMLButtonElement;
    x.type = 'button';
    x.setAttribute('aria-label', `Remove filter ${c.property}`);
    x.title = 'Remove this filter';
    x.onclick = ev => { ev.stopPropagation(); refocus = k; void host.remove(c.property); };
    box.append(main, x);
    row.append(box);
    chips.push(main);
  });
  const add = h('button', 'wb-chip-add', phone && host.chips.length ? `Filter · ${host.chips.length}` : opts.addLabel ?? 'Add filter') as HTMLButtonElement;
  add.type = 'button';
  add.setAttribute('aria-haspopup', 'dialog');
  add.onclick = ev => { ev.stopPropagation(); openFilterMenu(host, add); };
  row.append(add);
  if (host.chips.length) {
    const clear = h('button', 'wb-chip-clear', 'Clear') as HTMLButtonElement;
    clear.type = 'button';
    clear.title = 'Take every filter away';
    clear.onclick = ev => { ev.stopPropagation(); void host.clear(); };
    row.append(clear);
  }
  if (refocus !== null) {
    const to = chips[Math.min(refocus, chips.length - 1)] ?? add;
    refocus = null;
    setTimeout(() => to.focus({ preventScroll: true }), 0);
  }
  return row;
}

/** The Filter menu: what the list can be narrowed by, each with a line saying what it is (About the page, then Your own properties). */
export function openFilterMenu(host: ChipHost, at: HTMLElement): MenuHandle {
  const titles: Record<string, string> = { page: 'About the page', own: 'Your own properties', ...host.groupTitles };
  const order = [...new Set(host.props.map(p => p.group ?? 'page'))];
  const groups: MenuGroup[] = order.map(g => ({
    title: titles[g] ?? g,
    items: host.props.filter(p => (p.group ?? 'page') === g).map(p => {
      const on = host.chips.some(c => c.property.toLowerCase() === p.name.toLowerCase());
      return { id: `p:${p.name}`, label: p.name, description: p.hint, hint: on ? '✓' : undefined, keywords: [p.hint ?? ''] } as MenuItem;
    }),
  }));
  return openMenu({
    groups, at, label: 'Filter', placeholder: 'Filter by…', nested: host.nested, done: window.innerWidth <= 520 ? 'Done' : undefined,
    onPick: it => {
      const p = host.props.find(x => `p:${x.name}` === it.id);
      if (p) setTimeout(() => openPicker(host, p, at, host.chips.find(c => c.property.toLowerCase() === p.name.toLowerCase())), 0);
    },
  });
}

/** One property's picker: the four ways, then its values as a checklist with counts (or the fixed choices of a date). Ticking applies at once. */
function openPicker(host: ChipHost, p: FilterProp, at: HTMLElement, chip?: Chip): MenuHandle {
  const date = isDate(p, chip);
  let way: string = chip?.way ?? 'is';
  const picked = new Set<string>((chip?.values ?? []).map(v => v.toLowerCase()));
  const cur = () => host.chips.find(c => c.property.toLowerCase() === p.name.toLowerCase());
  let handle: MenuHandle;
  const put = () => {
    const values = [...p.values.flatMap(v => [v, ...(v.chapters ?? [])]).map(v => v.value), ...(chip?.values ?? [])].filter((v, i, a) => picked.has(v.toLowerCase()) && a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);
    if (!values.length) void host.remove(p.name);
    else void host.apply(filterText(p.name, way, values));
  };
  const build = (): MenuGroup[] => {
    const out: MenuGroup[] = [];
    if (date) {
      const now = cur()?.values[0] ?? DATE_ANY;
      out.push({ title: p.name, items: [...p.values.map(v => ({ id: `d:${v.value}`, label: v.label ?? v.value, hint: v.count !== undefined ? `${v.value === now ? '✓ ' : ''}${v.count}` : v.value === now ? '✓' : undefined })),
        { id: `d:${DATE_ANY}`, label: 'Any time', hint: now === DATE_ANY ? '✓' : undefined }] });
    } else {
      out.push({ title: 'Show pages where it', items: WAYS.map(w => ({ id: `w:${w}`, label: w, hint: w === way ? '✓' : undefined, stay: w === 'is' || w === 'is not' })) });
      if (way === 'is' || way === 'is not') {
        const items: MenuItem[] = [];
        const mark = (v: string) => (picked.has(v.toLowerCase()) ? '☑' : '☐');
        for (const v of p.values) {
          items.push({ id: `v:${v.value}`, label: v.label ?? v.value, icon: mark(v.value), hint: v.count !== undefined ? String(v.count) : undefined, stay: true });
          for (const c of v.chapters ?? []) items.push({ id: `v:${c.value}`, label: `${v.label ?? v.value} › ${c.label ?? c.value}`, icon: mark(c.value), hint: c.count !== undefined ? String(c.count) : undefined, stay: true });
        }
        // a value the filter holds that no row holds now (it still shows, and can be unticked)
        for (const v of chip?.values ?? []) if (!items.some(i => i.id.toLowerCase() === `v:${v}`.toLowerCase())) items.push({ id: `v:${v}`, label: `${v} (none now)`, icon: mark(v), stay: true });
        out.push({ title: p.name, items });
      }
    }
    if (chip || cur()) out.push({ items: [{ id: 'remove', label: 'Remove this filter', icon: '×', danger: true }] });
    return out;
  };
  handle = openMenu({
    groups: [], groupsFor: build, at, label: `Filter by ${p.name}`, placeholder: `Find a ${p.name.toLowerCase()}`, nested: host.nested, done: 'Done',
    onPick: it => {
      if (it.id === 'remove') return void host.remove(p.name);
      if (it.id.startsWith('d:')) {
        const v = it.id.slice(2);
        return void (v === DATE_ANY ? host.remove(p.name) : host.apply(filterText(p.name, 'is', [v])));
      }
      if (it.id.startsWith('w:')) {
        way = it.id.slice(2);
        if (way === 'is not set' || way === 'is set') { handle.close(); return void host.apply(filterText(p.name, way, [])); }
        if (picked.size) put();
        handle.refresh();
        return;
      }
      if (it.id.startsWith('v:')) {
        const v = it.id.slice(2).toLowerCase();
        if (picked.has(v)) picked.delete(v); else picked.add(v);
        put();
        handle.refresh();
      }
    },
  });
  return handle;
}

// ---- the other lists (filters-v2 rows 26-33, NB17) -------------------------------------------------------------------------------
// A list that is not a list in a page keeps its chips for the life of the window (not on disk) and asks its `wb` command with the same
// words: `--filter "Book is Numbers"`, repeatable. The command's answer holds `properties` (what the list can be narrowed by, with counts)
// and the list shows only those.

const kept = new Map<string, Chip[]>();

export interface ListChips {
  chips: Chip[];
  props: FilterProp[];
  /** `--filter "…"` for each chip, for the command's argv. */
  argv(): string[];
  /** Read the answer's `properties`. */
  absorb(answer: { properties?: FilterProp[] } | null | undefined): void;
  /** The chip row; `redo` draws the list again after any change. */
  row(redo: () => void, opts?: { nested?: boolean }): HTMLElement;
}

export function listChips(key: string): ListChips {
  const state: ListChips = {
    get chips() { return kept.get(key) ?? []; },
    props: [],
    argv: () => (kept.get(key) ?? []).flatMap(c => ['--filter', chipWords(c)]),
    absorb(answer) { state.props = (answer?.properties ?? []).map(p => ({ ...p, group: p.group ?? 'page' })); },
    row(redo, opts) {
      const set = (v: Chip[]) => { if (v.length) kept.set(key, v); else kept.delete(key); redo(); };
      return chipRow({
        props: state.props, chips: state.chips, nested: opts?.nested,
        apply: text => { const c = parseFilterText(text); if (c) set([...state.chips.filter(x => x.property.toLowerCase() !== c.property.toLowerCase()), c]); },
        remove: property => set(state.chips.filter(x => x.property.toLowerCase() !== property.toLowerCase())),
        clear: () => set([]),
      });
    },
  } as ListChips;
  return state;
}

/** Drop a list's chips (a new search starts with none). */
export function forgetChips(key: string) { kept.delete(key); }
