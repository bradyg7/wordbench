// A List in a page (notebook rows 36, 47 and 46d, NB14): a folder acts as the database. The block is a ```view fence: the first line is
// the command line that names the pages (`notebook thread phinehas`), then one option a line (`view: board`, `group: folder`,
// `columns: Status, Book`, `sort: title`). The window asks `wb page views` for the rows (each page with its properties, folder and
// edited time) and draws them as a Table, List, Gallery or Board, gathered under foldable headings when it is grouped. A property is
// kept in the page's front matter (`wb page prop`); a column with no values yet is a name in `columns`. Reads; the writes are `wb`'s.

import { wb } from './api';
import { toast } from './sheets';
import { button, h, icon } from './ui';
import { openMenu, type MenuGroup } from './menu';
import type { Blk, Host } from './blocks';

const VIEWS: [string, string, string][] = [['table', 'Table', '▦'], ['list', 'List', '☰'], ['gallery', 'Gallery', '▣'], ['board', 'Board', '◫']];
const SORTS: [string, string][] = [['edited', 'Edited'], ['created', 'Created'], ['title', 'Title']];

/** The groups folded by the person, while the window is open (a heading is named by its page, block and key). */
const folded = new Set<string>();

export interface ViewOpts { line: string; view: string; group: string; columns: string[]; sort: string }

/** A view fence's text → its line and options (the same reading as wb-core's). */
export function viewOptions(text: string): ViewOpts {
  const o: ViewOpts = { line: '', view: '', group: '', columns: [], sort: '' };
  let got = false;
  for (const raw of text.split('\n').slice(1)) {
    const l = raw.trim();
    if (!l || /^(```|~~~)/.test(l)) continue;
    if (!got) { o.line = l; got = true; continue; }
    const m = /^(view|group|columns|sort)\s*:\s*(.*)$/i.exec(l);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === 'columns') o.columns = m[2].split(',').map(x => x.trim()).filter(Boolean);
    else (o as unknown as Record<string, string>)[k] = m[2].trim();
  }
  return o;
}

const shortDate = (s: string | undefined) => {
  const d = s ? new Date(s.length === 10 ? `${s}T00:00:00` : s) : null;
  return d && !Number.isNaN(+d) ? `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}` : '';
};

/** A folder's color as a small round dot: a named color, or the hex it was given. */
function dot(color: string | null | undefined): HTMLElement {
  const named = !!color && /^[a-z]+$/.test(color);
  const d = h('i', `dot${named ? ` c-${color}` : ' c-'}`);
  if (color && !named) d.style.background = color;
  return d;
}

export function listBlock(b: Blk, id: string, host: Host, editLine: () => void): HTMLElement {
  const o = viewOptions(b.text);
  const view = VIEWS.some(v => v[0] === o.view) ? o.view : 'table';
  const group = o.group || (view === 'board' ? 'folder' : '');
  const box = h('div', 'nb-view nb-listview');
  box.dataset.view = view;
  const head = h('div', 'nbv-head nbv-listhead');
  const viewBtn = h('button', 'nbv-viewbtn') as HTMLButtonElement;
  viewBtn.type = 'button';
  viewBtn.setAttribute('aria-label', 'View');
  viewBtn.append(h('span', 'nbv-viewglyph', VIEWS.find(v => v[0] === view)![2]), h('span', '', VIEWS.find(v => v[0] === view)![1]), h('span', 'nbv-chev', '▾'));
  const summary = h('span', 'nbv-summary muted small', o.line ? 'Finding the pages…' : '');
  const filters = h('button', 'nbv-filters') as HTMLButtonElement;
  filters.type = 'button';
  filters.title = 'What this list shows: its line of the command language';
  filters.append(icon('filter', 14), document.createTextNode('Filters'));
  filters.onclick = ev => { ev.stopPropagation(); editLine(); };
  head.append(viewBtn, summary, h('span', 'grow'), filters);
  const body = h('div', 'nbv-body');
  if (!o.line) body.append(h('p', 'muted small nbv-note', 'No line yet: click Filters and write one, like notebook thread phinehas.'));
  else body.append(h('p', 'muted small nbv-note', 'Finding the pages…'));
  box.append(head, body);

  const write = async (args: string[], what?: string) => {
    try { await wb(['block', 'view', id, String(b.n), ...args]); host.changed(); }
    catch (x) { toast(what ? `${what}: ${x}` : String(x)); }
  };
  let known: string[] = o.columns;
  viewBtn.onclick = ev => {
    ev.stopPropagation();
    if (host.locked) return;
    const label = (k: string) => SORTS.find(s => s[0] === k)?.[1] ?? '';
    const groups: MenuGroup[] = [
      { title: 'View', items: [
        ...VIEWS.map(([k, name, glyph]) => ({ id: `view:${k}`, label: name, icon: glyph, hint: k === view ? '✓' : undefined })),
        { id: 'later:calendar', label: 'Calendar', icon: '◷', description: 'later' },
        { id: 'later:timeline', label: 'Timeline', icon: '≡', description: 'later' },
      ] },
      { items: [
        { id: 'group', label: 'Group by', icon: '▭', hint: group === 'callout' ? 'Callout kind' : group === 'folder' ? 'Folder' : group || 'None' },
        { id: 'sort', label: 'Sort', icon: '↕', hint: label(o.sort) || 'Edited' },
      ] },
    ];
    openMenu({
      groups, label: 'View', placeholder: 'View', at: viewBtn,
      onPick: it => {
        if (it.id.startsWith('view:')) void write(['--view', it.id.slice(5)]);
        else if (it.id.startsWith('later:')) toast(`${it.label} comes later.`);
        else if (it.id === 'group') setTimeout(() => groupMenu(), 0);
        else if (it.id === 'sort') setTimeout(() => sortMenu(), 0);
      },
    });
  };
  const groupMenu = () => openMenu({
    groups: [{ title: 'Group by', items: [
      { id: 'g:none', label: 'None', hint: !group ? '✓' : undefined },
      { id: 'g:folder', label: 'Folder', hint: group === 'folder' ? '✓' : undefined },
      { id: 'g:callout', label: 'Callout kind', hint: group === 'callout' ? '✓' : undefined },
      ...known.map(p => ({ id: `g:${p}`, label: p, hint: group.toLowerCase() === p.toLowerCase() ? '✓' : undefined })),
    ] }],
    label: 'Group by', placeholder: 'Group by', at: viewBtn,
    onPick: it => void write(['--group', it.id.slice(2)]),
  });
  const sortMenu = () => openMenu({
    groups: [{ title: 'Sort', items: SORTS.map(([k, name]) => ({ id: `s:${k}`, label: name, hint: (o.sort || 'edited') === k ? '✓' : undefined })) }],
    label: 'Sort', placeholder: 'Sort', at: viewBtn,
    onPick: it => void write(['--sort', it.id.slice(2)]),
  });

  if (o.line && host.state.views?.id === id) {
    void host.state.views.got.then(d => {
      const mine = (d?.blocks || []).find((x: any) => x.n === b.n);
      if (!mine) return;
      body.replaceChildren();
      if (mine.error) { body.append(h('p', `small nbv-note${mine.blank ? ' muted' : ' nbv-error'}`, mine.error)); return; }
      const shown: string[] = o.columns.length ? o.columns : (mine.properties || []);
      known = mine.properties || o.columns;
      const rows: any[] = mine.rows || [];
      summary.replaceChildren();
      if (mine.folder && mine.rows_are !== 'callouts') summary.append(dot(mine.folder.color), document.createTextNode(`Folder: ${mine.folder.name} · ${rows.length} page${rows.length === 1 ? '' : 's'}`));
      else summary.textContent = `${mine.rows_are === 'callouts' ? 'Callouts' : 'Pages'} · ${rows.length} found`;
      const ctx: Ctx = { id, n: b.n, host, view, group: mine.group || group, shown, mine, write };
      const groups: any[] | null = mine.groups || null;
      if (view === 'board') body.append(board(groups || [{ key: '', label: 'Pages', color: null, count: rows.length, rows }], ctx));
      else if (!groups) body.append(plain(rows, ctx));
      else for (const g of groups) body.append(section(g, ctx));
      if (!rows.length && !groups) body.append(h('p', 'muted small nbv-note', 'Nothing found yet. It fills as you write.'));
      if (mine.folder && !host.locked) {
        const add = h('button', 'nbv-new') as HTMLButtonElement;
        add.type = 'button';
        add.append(icon('plus', 14), document.createTextNode('New page'));
        add.onclick = async ev => {
          ev.stopPropagation();
          add.disabled = true;
          try { await wb(['page', 'new', 'Untitled', '--parent', `thread:${mine.folder.id}`]); host.changed(); }
          catch (x) { toast(String(x)); add.disabled = false; }
        };
        body.append(add);
      }
    }).catch(x => { body.replaceChildren(h('p', 'small nbv-note nbv-error', String(x))); });
  }
  return box;
}

interface Ctx { id: string; n: number; host: Host; view: string; group: string; shown: string[]; mine: any; write: (args: string[], what?: string) => Promise<void> }

/** One row's title as a button that opens the page (or, for a callout, the page it is written in). */
function titleBtn(r: any, ctx: Ctx, cls = 'nbv-title'): HTMLElement {
  const callout = ctx.mine.rows_are === 'callouts';
  const t = h('button', `${cls} nbv-open`) as HTMLButtonElement;
  t.type = 'button';
  t.dataset.id = callout ? r.page : r.id;
  if (!callout && r.folder?.color) t.append(dot(r.folder.color));
  t.append(h('span', 'nbv-text', callout ? r.first || r.text : r.title || 'Untitled'));
  t.onclick = ev => { ev.stopPropagation(); ctx.host.open(callout ? r.page : r.id); };
  return t;
}

function plain(rows: any[], ctx: Ctx): HTMLElement {
  if (ctx.mine.rows_are === 'callouts') return listRows(rows, ctx);
  if (ctx.view === 'list') return listRows(rows, ctx);
  if (ctx.view === 'gallery') return gallery(rows, ctx);
  return tableOf(rows, ctx);
}

function listRows(rows: any[], ctx: Ctx): HTMLElement {
  const list = h('div', 'nbv-lines');
  const callout = ctx.mine.rows_are === 'callouts';
  for (const r of rows) {
    const line = h('div', 'nbv-line-row');
    line.append(titleBtn(r, ctx), h('span', 'nbv-when muted small', callout ? r.page_title : shortDate(r.edited)));
    list.append(line);
  }
  return list;
}

function gallery(rows: any[], ctx: Ctx): HTMLElement {
  const g = h('div', 'nbv-gallery');
  for (const r of rows) {
    const card = h('div', 'nbv-card');
    card.dataset.id = r.id;
    card.append(h('div', 'nbv-card-preview', String(r.preview || '').slice(0, 140)), titleBtn(r, ctx, 'nbv-card-title'),
      h('div', 'nbv-card-sub muted small', [r.folder?.name, shortDate(r.edited)].filter(Boolean).join(' · ')));
    g.append(card);
  }
  return g;
}

function tableOf(rows: any[], ctx: Ctx): HTMLElement {
  const scroll = h('div', 'nbv-table-scroll');
  const t = h('table', 'nbv-table');
  const tr = h('tr');
  tr.append(h('th', '', 'Title'));
  for (const c of ctx.shown) tr.append(h('th', '', c));
  tr.append(h('th', '', 'Edited'));
  const plus = h('th', 'nbv-plus');
  if (!ctx.host.locked) {
    const add = h('button', 'nbv-addprop', '+ Property') as HTMLButtonElement;
    add.type = 'button';
    add.onclick = ev => {
      ev.stopPropagation();
      const input = h('input', 'field small nbv-propname') as HTMLInputElement;
      input.placeholder = 'Property name';
      input.setAttribute('aria-label', 'Property name');
      plus.replaceChildren(input);
      input.focus();
      let done = false;
      input.onkeydown = e => {
        e.stopPropagation();
        if (e.key === 'Escape') { done = true; plus.replaceChildren(add); }
        else if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      };
      input.onblur = () => {
        if (done) return;
        done = true;
        const name = input.value.trim();
        if (!name) { plus.replaceChildren(add); return; }
        void ctx.write(['--columns', [...ctx.shown, name].join(', ')], 'Not added');
      };
    };
    plus.append(add);
  }
  tr.append(plus);
  const thead = h('thead');
  thead.append(tr);
  t.append(thead);
  const tbody = h('tbody');
  for (const r of rows) {
    const row = h('tr');
    row.dataset.id = r.id;
    const first = h('td', 'nbv-titlecell');
    first.append(titleBtn(r, ctx));
    row.append(first);
    for (const c of ctx.shown) {
      const cell = h('td');
      const input = h('input', 'nbv-cell') as HTMLInputElement;
      input.value = r.props?.[c] ?? '';
      input.setAttribute('aria-label', `${c} of ${r.title}`);
      input.readOnly = !!ctx.host.locked;
      input.onclick = ev => ev.stopPropagation();
      input.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); } else if (ev.key === 'Escape') { input.value = r.props?.[c] ?? ''; input.blur(); } };
      input.onchange = async () => {
        try { await wb(['page', 'prop', r.id, c, ...(input.value.trim() ? [input.value.trim()] : ['--remove'])]); ctx.host.changed(); }
        catch (x) { toast(String(x)); input.value = r.props?.[c] ?? ''; }
      };
      cell.append(input);
      row.append(cell);
    }
    row.append(h('td', 'nbv-when muted small', shortDate(r.edited)), h('td'));
    tbody.append(row);
  }
  t.append(tbody);
  scroll.append(t);
  return scroll;
}

/** A group: its heading (fold, dot, name, count) over its rows. */
function section(g: any, ctx: Ctx): HTMLElement {
  const key = `${ctx.id}:${ctx.n}:${g.key}`;
  const sec = h('section', 'nbv-group');
  sec.dataset.key = g.key;
  const head = h('button', 'nbv-group-head') as HTMLButtonElement;
  head.type = 'button';
  const caret = h('span', 'nbv-caret');
  head.append(caret);
  if (ctx.mine.rows_are !== 'callouts' && ctx.group === 'folder' && g.color) head.append(dot(g.color));
  head.append(h('span', 'nbv-group-name', g.label), h('span', 'nbv-group-count muted small', String(g.count)));
  const inner = h('div', 'nbv-group-body');
  inner.append(plain(g.rows, ctx));
  const apply = () => {
    const f = folded.has(key);
    head.setAttribute('aria-expanded', String(!f));
    caret.textContent = f ? '▸' : '▾';
    inner.hidden = f;
  };
  head.onclick = ev => { ev.stopPropagation(); if (folded.has(key)) folded.delete(key); else folded.add(key); apply(); };
  apply();
  sec.append(head, inner);
  return sec;
}

/** A board: a column for each group; a card dragged to another column moves the page there (its folder, or the property's value). */
function board(groups: any[], ctx: Ctx): HTMLElement {
  const wrap = h('div', 'nbv-board');
  const movable = ctx.mine.rows_are !== 'callouts' && !ctx.host.locked;
  for (const g of groups) {
    const col = h('div', 'nbv-col');
    col.dataset.key = g.key;
    const head = h('div', 'nbv-col-head');
    if (ctx.mine.rows_are !== 'callouts' && ctx.group === 'folder' && g.color) head.append(dot(g.color));
    head.append(h('span', 'nbv-group-name', g.label), h('span', 'nbv-group-count muted small', String(g.count)));
    col.append(head);
    for (const r of g.rows) {
      const card = h('div', 'nbv-bcard');
      card.dataset.id = r.id;
      card.append(titleBtn(r, ctx, 'nbv-bcard-title'));
      if (ctx.mine.rows_are === 'callouts') card.append(h('div', 'muted small', r.page_title));
      else if (r.folder?.name && ctx.group !== 'folder') card.append(h('div', 'muted small', r.folder.name));
      if (movable) {
        card.draggable = true;
        card.ondragstart = ev => { ev.dataTransfer!.setData('text/wb-card', JSON.stringify({ id: r.id, from: g.key })); ev.dataTransfer!.effectAllowed = 'move'; card.classList.add('dragging'); };
        card.ondragend = () => card.classList.remove('dragging');
      }
      col.append(card);
    }
    if (movable) {
      col.ondragover = ev => { if (ev.dataTransfer?.types.includes('text/wb-card')) { ev.preventDefault(); col.classList.add('drop'); } };
      col.ondragleave = () => col.classList.remove('drop');
      col.ondrop = async ev => {
        ev.preventDefault();
        col.classList.remove('drop');
        const raw = ev.dataTransfer?.getData('text/wb-card');
        if (!raw) return;
        const { id, from } = JSON.parse(raw) as { id: string; from: string };
        if (from === g.key) return;
        try {
          if (ctx.group === 'folder') {
            if (g.key) await wb(['note', 'thread', id, g.key]);
            if (from) await wb(['note', 'thread', id, from, '--remove']);
          } else {
            await wb(['page', 'prop', id, ctx.group, ...(g.key ? [g.key] : ['--remove'])]);
          }
          ctx.host.changed();
        } catch (x) { toast(String(x)); }
      };
    }
    wrap.append(col);
  }
  return wrap;
}
