// Ctrl+K, anywhere (notebook design row 34, NB13): the Library's one search in the one menu component. Empty, it lists Recents (the last
// pages opened); with words it lists what `wb find` finds, grouped (Folders with their color and how many pages and saves they hold,
// Pages, Questions, Key points, Notes, Saves, Margin notes, Highlights). The highlighted result is previewed on the right as it is in
// the page: a list, a callout in its kind's color, a table's first rows. Enter opens, Esc returns.
import { wb } from './api';
import { app, goTo } from './app';
import { openMenu, type MenuGroup, type MenuHandle, type MenuItem } from './menu';
import { openNote } from './notebook';
import { openShelf } from './panes';
import { toast } from './sheets';
import { h } from './ui';
import { chipRow, chipWords, parseFilterText, type Chip, type FilterProp } from './chips';

type Row = Record<string, any>;
const TITLES: Record<string, string> = { folder: 'Folders', page: 'Pages', question: 'Questions', key: 'Key points', note: 'Notes', save: 'Saves', margin: 'Margin notes', highlight: 'Highlights' };
const ORDER = ['folder', 'page', 'question', 'key', 'note', 'save', 'margin', 'highlight'];
const PER_GROUP = 8;

const colorOf = (c: string) => (/^#|^rgb/.test(c) ? c : `var(--hl-${c})`);
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

let current: MenuHandle | null = null;

/** Open Ctrl+K (a second Ctrl+K closes it). */
export function toggleQuickSearch() {
  if (current?.open) { current.close(); return; }
  current = openQuickSearch();
}

export function openQuickSearch(): MenuHandle {
  const rows = new Map<string, Row>();
  let groups: MenuGroup[] = [];
  let ticket = 0;
  // + Filter under the search field (filters-v2 row 14): Kind and Folder chips narrow the one search; window state only
  let chips: Chip[] = [];
  let folderValues: { value: string }[] = [];
  const kinds = ['Pages', 'Questions', 'Key points', 'Notes', 'Folders'].map(value => ({ value }));

  const itemOf = (kind: string, r: Row): MenuItem => {
    const id = `${kind}:${r.id ?? r.ref ?? r.title}`;
    rows.set(id, { ...r, kind });
    if (kind === 'folder') {
      const n = Number(r.count ?? 0);
      return { id, label: r.title || 'Untitled', icon: '▢', dot: r.color ? colorOf(r.color) : undefined, hint: n === 1 ? '1 page or save' : `${n} pages and saves` };
    }
    if (kind === 'page') return { id, label: r.title || 'Untitled', icon: '▯', description: [r.folder || 'Pages', r.has].filter(Boolean).join(' · ') };
    if (kind === 'question' || kind === 'key' || kind === 'note') {
      return { id, label: r.title || r.snippet || 'Untitled', icon: kind === 'question' ? '?' : kind === 'key' ? '☆' : '✎', description: (kind === 'question' ? String(r.snippet || '').split('\n')[0] : r.snippet) || TITLES[kind] };
    }
    return { id, label: r.title || 'Untitled', icon: '▯', description: r.snippet ? String(r.snippet).split('\n')[0] : undefined };
  };

  const recents = async (): Promise<MenuGroup[]> => {
    try {
      const r = await wb(['page', 'recents']);
      const items = (r.recents as Row[]).map(x => itemOf('page', { ...x, folder: '', has: '' }));
      return items.length ? [{ title: 'Recents', items }] : [];
    } catch { return []; }
  };
  const search = async (q: string): Promise<MenuGroup[]> => {
    try {
      const r = await wb(['find', ...(q ? [q] : []), '--sort', 'edited', ...chips.flatMap(c => ['--filter', chipWords(c)])]);
      const by = new Map<string, Row[]>((r.groups as Row[]).map(g => [g.kind as string, g.results as Row[]]));
      const out: MenuGroup[] = [];
      for (const k of [...ORDER, ...[...by.keys()].filter(k => !ORDER.includes(k))]) {
        const list = by.get(k) ?? [];
        if (list.length) out.push({ title: TITLES[k] ?? k, items: list.slice(0, PER_GROUP).map(x => itemOf(k, x)) });
      }
      return out;
    } catch { return []; }
  };

  const reload = async (handle: MenuHandle | null, q: string) => {
    const mine = ++ticket;
    const got = q.trim() || chips.length ? await search(q.trim()) : await recents();
    if (mine !== ticket) return;
    groups = got;
    handle?.refresh();
  };

  const pages = new Map<string, Promise<any>>();
  let previewing = 0;
  const preview = (item: MenuItem | null, into: HTMLElement) => {
    const mine = ++previewing;
    into.replaceChildren();
    const r = item ? rows.get(item.id) : null;
    if (!r) return;
    into.append(h('div', 'wbm-pv-label', 'Preview'));
    if (r.kind === 'folder') {
      const head = h('h2', 'wbm-pv-title');
      if (r.color) { const d = h('i', 'wbm-dot big'); d.style.background = colorOf(r.color); head.append(d, document.createTextNode(' ')); }
      head.append(r.title || 'Untitled');
      into.append(head, h('p', 'muted', `${plural(Number(r.pages ?? 0), 'page')} and ${plural(Number(r.saves ?? 0), 'save')}`), h('p', 'muted small', 'Enter opens it.'));
      return;
    }
    const pageId = r.kind === 'page' ? r.id : r.page;
    if (!pageId) {
      into.append(h('h2', 'wbm-pv-title', r.title || 'Untitled'));
      if (r.snippet) into.append(h('p', '', String(r.snippet)));
      return;
    }
    let got = pages.get(pageId);
    if (!got) { got = wb(['page', 'blocks', pageId]); pages.set(pageId, got); }
    got.then(data => { if (mine === previewing) into.append(...previewOf(data, r.title)); }).catch(() => {
      if (mine === previewing) into.append(h('h2', 'wbm-pv-title', r.title || 'Untitled'));
    });
  };

  const open = async (item: MenuItem) => {
    const r = rows.get(item.id);
    if (!r) return;
    try {
      if (r.kind === 'folder') {
        if (String(r.id).startsWith('thread:')) await openNote(r.id); else openShelf();
      } else if (r.kind === 'page') await openNote(r.id);
      else if (r.kind === 'question' || r.kind === 'key' || r.kind === 'note') await openNote(r.page || r.id);
      else if (r.kind === 'highlight') await goTo(r.title);
      else if (r.kind === 'save') await goTo(r.ref || r.title);
      else if (r.kind === 'margin') await app.showMarginNote(r.id, r.at);
    } catch (x) { toast(String(x)); }
  };

  const handle = openMenu({
    groups: [], groupsFor: () => groups, center: true, preview, label: 'Search', placeholder: 'Search every page',
    foot: '↑↓ to move · Enter to open · Esc to close',
    onPick: it => void open(it),
  });
  const input = handle.el.querySelector<HTMLInputElement>('.wbm-input')!;
  const chipBox = h('div', 'wbm-chips');
  input.after(chipBox);
  const drawChips = () => {
    const props: FilterProp[] = [{ name: 'Kind', hint: 'Pages, Questions, Key points, Notes or Folders', type: 'choice', values: kinds }, { name: 'Folder', hint: 'The folder a page is in', type: 'choice', values: folderValues }];
    const redo = () => { drawChips(); void reload(handle, input.value); setTimeout(() => { if (!document.querySelector('.wbm[data-nested]')) input.focus(); }, 0); };
    chipBox.replaceChildren(chipRow({
      props, chips, nested: true,
      apply: text => { const c = parseFilterText(text); if (!c) return; chips = [...chips.filter(x => x.property !== c.property), c]; redo(); },
      remove: property => { chips = chips.filter(x => x.property !== property); redo(); },
      clear: () => { chips = []; redo(); },
    }, { addLabel: '+ Filter' }));
  };
  drawChips();
  void wb(['thread', 'list']).then((l: any[]) => { folderValues = l.map(t => ({ value: t.name })); drawChips(); }).catch(() => {});
  // Esc clears the words first, then closes
  const esc = (ev: KeyboardEvent) => {
    if (!handle.open) { document.removeEventListener('keydown', esc, true); return; }
    if (ev.key === 'Escape' && input.value && !document.querySelector('.wbm[data-nested]')) { ev.preventDefault(); ev.stopPropagation(); input.value = ''; input.focus(); void reload(handle, ''); }
  };
  document.addEventListener('keydown', esc, true);
  let t = 0;
  input.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(() => void reload(handle, input.value), 120); });
  void reload(handle, '');
  return handle;
}

// ---- the preview, as the page shows it -----------------------------------------------------------------------------------

type Blk = { n: number; kind: string; text: string; level?: number; checked?: boolean; lang?: string; indent?: number; callout?: { kind: string; label: string } };
const CALLOUT_ICON: Record<string, string> = { question: '?', done: '✓', key: '☆', note: '✎' };

/** A line's words: the marks, links and a trailing block id taken off. */
const plain = (s: string) => s
  .replace(/\s\^[a-z0-9]{6}$/, '')
  .replace(/<[^>]*>/g, '')
  .replace(/\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_m, a, b) => b || a)
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/(\*\*|__|~~|\*|`)/g, '');
const unmark = (s: string) => plain(s.replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, ''));

function cells(line: string): string[] {
  const raw = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return raw.split(/(?<!\\)\|/).map(c => plain(c.trim().replace(/\\\|/g, '|')));
}

export function previewOf(data: { title?: { text: string } | null; blocks: Blk[] }, fallback: string): Node[] {
  const out: Node[] = [h('h2', 'wbm-pv-title', data.title?.text || fallback || 'Untitled')];
  for (const b of data.blocks.slice(0, 60)) {
    if (b.kind === 'heading') out.push(h(`h${Math.min(3, Math.max(1, b.level || 2)) + 1}` as 'h2', 'wbm-pv-h', plain(b.text.replace(/^#+\s*/, ''))));
    else if (b.kind === 'bullet' || b.kind === 'numbered' || b.kind === 'todo') {
      const row = h('div', 'wbm-pv-li');
      row.style.marginLeft = `${Math.min(b.indent || 0, 8) * 16}px`;
      const mark = b.kind === 'bullet' ? '•' : b.kind === 'todo' ? (b.checked ? '☑' : '☐') : `${/^\s*(\d+)/.exec(b.text)?.[1] ?? '1'}.`;
      row.append(h('span', 'wbm-pv-mark', mark), h('span', '', unmark(b.text)));
      out.push(row);
    } else if (b.kind === 'quote' && b.callout) {
      const k = b.callout.kind;
      const box = h('div', `nb-callout nb-callout-${k}`);
      box.append(h('span', 'nb-callout-icon', CALLOUT_ICON[k] ?? '?'));
      const main = h('div', 'nb-callout-main');
      main.append(h('div', 'nb-callout-label', b.callout.label));
      const lines = b.text.split('\n').map(l => l.replace(/^>\s?/, ''));
      lines[0] = lines[0].replace(/^\[![A-Za-z]+\][+-]?\s*/, '');
      for (const l of lines.filter(x => x.trim())) {
        const li = /^(\s*)(?:[-*+]|\d+\.)\s+/.exec(l);
        const line = h('div', li ? 'wbm-pv-li' : 'wbm-pv-line');
        if (li) { line.style.marginLeft = `${Math.floor(li[1].length / 2) * 16}px`; line.append(h('span', 'wbm-pv-mark', '•'), h('span', '', unmark(l))); }
        else line.textContent = plain(l);
        main.append(line);
      }
      box.append(main);
      out.push(box);
    } else if (b.kind === 'table') {
      const t = h('table', 'nb-table');
      const lines = b.text.split('\n').filter(l => l.trim());
      lines.slice(0, 7).forEach((l, i) => {
        const cs = cells(l);
        if (i === 1 && cs.every(c => /^:?-+:?$/.test(c))) return;
        const tr = h('tr');
        for (const c of cs) tr.append(h(i === 0 ? 'th' : 'td', '', c));
        t.append(tr);
      });
      const wrap = h('div', 'nb-table-scroll');
      wrap.append(t);
      out.push(wrap);
    } else if (b.kind === 'divider') out.push(h('hr', 'nb-hr'));
    else if (b.kind === 'fence') {
      const inner = b.text.split('\n').slice(1, -1).join(' ').trim();
      out.push(h('p', 'wbm-pv-fence muted', [(b.lang || '').split(/\s/)[0], inner].filter(Boolean).join(' · ')));
    } else if (b.kind === 'quote') out.push(h('blockquote', 'wbm-pv-quote', plain(b.text.replace(/^>\s?/gm, ''))));
    else if (b.text.trim()) out.push(h('p', 'wbm-pv-p', plain(b.text)));
  }
  return out;
}
