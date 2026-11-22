// The one menu component (notebook design N1, rows 1 and 2): every menu (/, block, page ⋯, @, Ctrl+K) is this.
// Typing filters the rows and highlights the first match; groups with no match hide; "No results" when none.
// ↑ ↓ move the highlight, Enter picks, Esc or a click outside closes and focus returns to where it was.
// The menu is fixed-position, so opening it never moves anything on the page.

export type MenuItem = { id: string; label: string; icon?: string; iconClass?: string; iconData?: Record<string, string>; /** inline style of the icon (a swatch's color) */ iconStyle?: string; hint?: string; keywords?: string[]; /** drawn in the warning color (Delete) */ danger?: boolean };
// `folded`: with nothing typed the group is one row (its title and what is in it); Enter or a click opens it. Typing finds its rows.
export type MenuGroup = { title?: string; items: MenuItem[]; folded?: boolean };
export type MenuOptions = {
  groups: MenuGroup[];
  /** The rows for what is typed, when they depend on it (the @ menu's verse); used instead of filtering `groups`. */
  groupsFor?: (query: string) => MenuGroup[];
  at?: { x: number; y: number } | HTMLElement;   // a point, or the element the menu hangs under
  placeholder?: string;
  query?: string;
  label?: string;                                // the menu's accessible name
  /** Words at the foot in place of the key hints (the block menu's "Edited …" and word count); a line break makes a second line. */
  foot?: string;
  onPick: (item: MenuItem) => void;
  onClose?: () => void;
};
export type MenuHandle = { el: HTMLElement; close: () => void; setQuery: (q: string) => void; /** Draw the rows again for what is typed (the rows' source changed). */ refresh: () => void; readonly open: boolean };

const norm = (s: string) => s.toLowerCase();

/** Rows that match the query (label or keywords contain it); groups with none are dropped. Empty query keeps all. */
export function filterGroups(groups: MenuGroup[], query: string): MenuGroup[] {
  const q = norm(query.trim());
  if (!q) return groups.map((g) => ({ ...g, items: [...g.items] })).filter((g) => g.items.length);
  const hit = (i: MenuItem) => [i.label, ...(i.keywords ?? [])].some((s) => norm(s).includes(q));
  return groups.map((g) => ({ ...g, items: g.items.filter(hit) })).filter((g) => g.items.length);
}

let current: MenuHandle | null = null;

export function openMenu(opts: MenuOptions): MenuHandle {
  current?.close();
  const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const el = document.createElement('div');
  el.className = 'wbm';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', opts.label ?? 'Menu');
  const input = document.createElement('input');
  input.className = 'wbm-input';
  input.type = 'text';
  input.placeholder = opts.placeholder ?? 'Type to filter';
  input.setAttribute('aria-label', opts.placeholder ?? 'Type to filter');
  input.autocomplete = 'off';
  input.spellcheck = false;
  const list = document.createElement('div');
  list.className = 'wbm-list';
  list.setAttribute('role', 'listbox');
  const foot = document.createElement('div');
  foot.className = 'wbm-foot';
  foot.textContent = opts.foot ?? '↑↓ to move · Enter to pick · Esc to close';
  if (opts.foot) foot.style.whiteSpace = 'pre-line';
  el.append(input, list, foot);

  let rows: { item: MenuItem; el: HTMLElement }[] = [];
  let hi = 0;
  let isOpen = true;
  const opened = new Set<string>();
  const starts = new Map<string, number>();

  const mark = () => {
    rows.forEach((r, n) => { r.el.classList.toggle('on', n === hi); r.el.setAttribute('aria-selected', String(n === hi)); });
    rows[hi]?.el.scrollIntoView({ block: 'nearest' });
  };
  const render = () => {
    list.textContent = '';
    rows = [];
    starts.clear();
    const shown = opts.groupsFor ? opts.groupsFor(input.value).filter(g => g.items.length) : filterGroups(opts.groups, input.value);
    if (!shown.length) {
      const none = document.createElement('div');
      none.className = 'wbm-none';
      none.textContent = 'No results';
      list.append(none);
    }
    for (const g of shown) {
      if (g.folded && !input.value.trim() && !opened.has(g.title ?? '')) {
        const fold: MenuItem = { id: `fold:${g.title ?? ''}`, label: g.title ?? '' };
        const row = document.createElement('div');
        row.className = 'wbm-row wbm-fold';
        row.setAttribute('role', 'option');
        row.dataset.id = fold.id;
        const icon = document.createElement('span'); icon.className = 'wbm-icon'; icon.textContent = '›';
        const label = document.createElement('span'); label.className = 'wbm-label';
        const t = document.createElement('strong'); t.textContent = g.title ?? '';
        const what = document.createElement('span'); what.className = 'wbm-hint'; what.textContent = ' ' + g.items.map((i) => i.label).join(', ');
        label.append(t, what);
        row.append(icon, label);
        row.addEventListener('mousedown', (e) => e.preventDefault());
        row.addEventListener('click', () => pick(fold));
        list.append(row);
        rows.push({ item: fold, el: row });
        continue;
      }
      starts.set(g.title ?? '', rows.length);
      if (g.title) { const h = document.createElement('div'); h.className = 'wbm-group'; h.textContent = g.title; list.append(h); }
      for (const item of g.items) {
        const row = document.createElement('div');
        row.className = item.danger ? 'wbm-row wbm-danger' : 'wbm-row';
        row.setAttribute('role', 'option');
        row.dataset.id = item.id;
        const icon = document.createElement('span'); icon.className = `wbm-icon${item.iconClass ? ` ${item.iconClass}` : ''}`; icon.textContent = item.icon ?? '';
        if (item.iconData) Object.assign(icon.dataset, item.iconData);
        if (item.iconStyle) icon.style.cssText = item.iconStyle;
        const label = document.createElement('span'); label.className = 'wbm-label'; label.textContent = item.label;
        row.append(icon, label);
        if (item.hint) { const k = document.createElement('span'); k.className = 'wbm-hint'; k.textContent = item.hint; row.append(k); }
        row.addEventListener('mousedown', (e) => e.preventDefault());   // keep the filter field focused
        row.addEventListener('click', () => pick(item));
        list.append(row);
        rows.push({ item, el: row });
      }
    }
    hi = 0;
    mark();
  };

  const place = () => {
    const at = opts.at;
    let x = 0, y = 0;
    if (at instanceof HTMLElement) { const r = at.getBoundingClientRect(); x = r.left; y = r.bottom + 4; }
    else if (at) { x = at.x; y = at.y; }
    const w = el.offsetWidth, h = el.offsetHeight;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    if (y + h > window.innerHeight - 8) y = Math.max(8, y - h - 8 - (at instanceof HTMLElement ? at.getBoundingClientRect().height : 0));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };

  const outside = (e: Event) => {
    if (el.contains(e.target as Node)) return;
    close(false);
    // The click's own focus change comes after this handler: when it lands on nothing focusable, focus goes back.
    setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) returnTo?.focus({ preventScroll: true }); }, 0);
  };
  function close(refocus = true) {
    if (!isOpen) return;
    isOpen = false;
    if (current === handle) current = null;
    document.removeEventListener('pointerdown', outside, true);
    el.remove();
    if (refocus) returnTo?.focus({ preventScroll: true });
    opts.onClose?.();
  }
  const pick = (item: MenuItem) => {
    if (item.id.startsWith('fold:')) { opened.add(item.id.slice(5)); render(); place(); hi = starts.get(item.id.slice(5)) ?? 0; mark(); return; }
    close();
    opts.onPick(item);
  };

  input.addEventListener('input', render);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (rows.length) { hi = (hi + 1) % rows.length; mark(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (rows.length) { hi = (hi - 1 + rows.length) % rows.length; mark(); } }
    else if (e.key === 'Enter') { e.preventDefault(); const r = rows[hi]; if (r) pick(r.item); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  });

  input.value = opts.query ?? '';
  el.style.visibility = 'hidden';
  document.body.append(el);
  render();
  place();
  el.style.visibility = '';
  input.focus({ preventScroll: true });
  document.addEventListener('pointerdown', outside, true);

  const handle: MenuHandle = {
    el, close: () => close(),
    setQuery: (q) => { input.value = q; render(); place(); },
    refresh: () => { const keep = hi; render(); place(); hi = Math.min(keep, Math.max(0, rows.length - 1)); mark(); },
    get open() { return isOpen; },
  };
  current = handle;
  return handle;
}
