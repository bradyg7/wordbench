// The Legend on the rail (design/features/marks, T11, rows 32 to 41; MK7-17, MK7-21, MK7-26). A pane like the others: the
// person's entries in order (sample, name, meaning, key, Quick, count), the styles marks use that no entry names, and, from
// a count, where a style is used with the marks listed to open in the reader or to delete (recoverable, one Undo).
// Every change is a `wb legend …` or `wb mark rm` call; nothing is kept here. Scripture is never typed: the words a mark
// covers come from `wb legend uses`.
import { app, goTo } from './app';
import { wb } from './api';
import { dock } from './panes';
import type { Pane } from './dock';
import { sampleOf, type Kind } from './markbar';
import { toast, toastUndo } from './sheets';
import { h, icon, popMenu } from './ui';

interface Entry { kind: Kind; color: string; lines?: number; name?: string; meaning?: string; quick?: boolean; key?: string; label: string; style: string; count: number; listed: boolean }
interface Used { id: string; kind: string; color: string; lines?: number; at: string; code: string; book: string; chapter: number; verse: number; label: string; words: string; old: boolean }
interface Uses { entry: Entry; count: number; marks: Used[] }

const PEN_KINDS: [Kind, string][] = [['highlight', 'Highlight'], ['underline', 'Underline'], ['circle', 'Circle'], ['box', 'Box'], ['arrow', 'Arrow']];
const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `Ctrl+${n}`);
const said = (x: unknown) => String((x as any)?.message ?? x).replace(/^Error:\s*/, '');
const marksOf = (n: number) => `${n} mark${n === 1 ? '' : 's'}`;

/** The reader's drawn marks follow a change at once (and are read again from the core in the app). */
function patchDrawn(fn: (m: any) => any | null) {
  const list = app.drawn?.marks?.marks;
  if (!list) return;
  app.drawn!.marks.marks = list.map(fn).filter(Boolean);
}

async function readLegend(): Promise<{ entries: Entry[]; unlisted: Entry[] }> {
  try { const l = await wb(['legend']); return { entries: l?.entries || [], unlisted: l?.unlisted || [] }; } catch { return { entries: [], unlisted: [] }; }
}

/** After a change: every drawn mark shows its entry's present name, and the panes that show marks read again. */
async function changed() {
  const l = await readLegend();
  const by = new Map([...l.entries, ...l.unlisted].map(e => [e.style, e.label]));
  patchDrawn(m => (by.has(m.style) ? { ...m, legend: by.get(m.style) } : m));
  app.changed('highlights');
}

export function openLegend() {
  return dock.open('legend', 'Legend', 'legend', 'left', (el, pane) => { new LegendPane(el, pane).show(); });
}

class LegendPane {
  /** What the pane shows, kept on the pane so a redraw (a mark made in the reader) keeps it. */
  private view: { focus?: string; uses?: string; filter: string; picked: Set<string>; adding: boolean; back?: string };
  private entries: Entry[] = [];
  private unlisted: Entry[] = [];
  private ask: { style: string; node: HTMLElement } | null = null;

  constructor(private el: HTMLElement, private pane: Pane) {
    const p = pane as any;
    this.view = p.legendView ||= { filter: '', picked: new Set<string>(), adding: false };
    el.classList.add('legend-pane');
  }

  async show(): Promise<void> {
    if (this.view.uses) return this.showUses();
    const l = await readLegend();
    this.entries = l.entries;
    this.unlisted = l.unlisted;
    this.list();
  }

  // ---- the list (rows 32 to 39) ---------------------------------------------------------------------------------------
  private list() {
    const el = this.el;
    el.replaceChildren();
    const hd = h('header', 'lg-head');
    hd.append(h('h2', 'pane-title lg-title', 'Legend'));
    const add = h('button', 'btn small lg-new');
    add.type = 'button';
    add.append(icon('plus', 14), document.createTextNode(' New pen'));
    add.setAttribute('aria-expanded', String(this.view.adding));
    add.onclick = () => { this.view.adding = !this.view.adding; this.list(); };
    hd.append(add);
    el.append(hd);
    if (this.view.adding) el.append(this.newPen());
    const box = h('div', 'lg-list');
    box.setAttribute('role', 'list');
    if (!this.entries.length) box.append(h('p', 'muted small lg-empty', 'Marks made with a new pen appear here.'));
    this.entries.forEach((e, i) => box.append(this.row(e, i)));
    el.append(box);
    if (this.unlisted.length) {
      const g = h('div', 'lg-group');
      g.append(h('div', 'label lg-group-title', 'In use, not in the legend'));
      for (const e of this.unlisted) g.append(this.row(e, -1));
      el.append(g);
    }
    if (this.view.focus) {
      // a move by key keeps the grip in hand, through the redraw a change brings
      const f = el.querySelector<HTMLElement>(`.lg-entry[data-style="${CSS.escape(this.view.focus)}"] .lg-drag`);
      f?.focus();
    }
  }

  /** Row 33: kind, color (any color) and lines, then a name. */
  private newPen(): HTMLElement {
    const f = h('form', 'lg-newpen');
    let kind: Kind = 'highlight', lines = 1;
    const kinds = h('div', 'mb-kinds');
    kinds.setAttribute('role', 'group');
    kinds.setAttribute('aria-label', 'Kind');
    const linesBox = h('div', 'mb-lines');
    linesBox.setAttribute('role', 'group');
    linesBox.setAttribute('aria-label', 'Lines');
    linesBox.hidden = true;
    for (const [k, name] of PEN_KINDS) {
      const b = h('button', 'mb-kindpick', name);
      b.type = 'button';
      b.dataset.kind = k;
      b.setAttribute('aria-pressed', String(k === kind));
      b.onclick = () => { kind = k; kinds.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); linesBox.hidden = k !== 'underline'; };
      kinds.append(b);
    }
    [1, 2, 3].forEach(n => {
      const b = h('button', 'mb-line', n === 1 ? '1 line' : String(n));
      b.type = 'button';
      b.dataset.lines = String(n);
      b.setAttribute('aria-pressed', String(n === lines));
      b.onclick = () => { lines = n; linesBox.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
      linesBox.append(b);
    });
    const colorRow = h('label', 'lg-color-pick');
    const color = h('input') as HTMLInputElement;
    color.type = 'color';
    color.value = '#d9822b';
    color.setAttribute('aria-label', 'Color of the new pen');
    colorRow.append(color, h('span', '', 'Color (any color)'));
    const name = h('input', 'field small lg-name-new') as HTMLInputElement;
    name.placeholder = 'Name (you can leave it for later)';
    name.setAttribute('aria-label', 'Name of the new pen');
    const go = h('button', 'btn small primary', 'Add');
    go.type = 'submit';
    const cancel = h('button', 'btn small', 'Cancel');
    cancel.type = 'button';
    cancel.onclick = () => { this.view.adding = false; this.list(); };
    const acts = h('div', 'lg-ask-btns');
    acts.append(go, cancel);
    f.append(kinds, linesBox, colorRow, name, acts);
    f.onsubmit = async e => {
      e.preventDefault();
      try {
        await wb(['legend', 'add', '--kind', kind, '--color', color.value.toLowerCase(), ...(kind === 'underline' ? ['--lines', String(lines)] : []), ...(name.value.trim() ? ['--name', name.value.trim()] : [])]);
        this.view.adding = false;
        await changed();
        await this.show();
      } catch (x) { toast(said(x)); }
    };
    setTimeout(() => name.focus());
    return f;
  }

  private row(e: Entry, i: number): HTMLElement {
    const listed = i >= 0;
    const r = h('div', `lg-entry${listed ? '' : ' lg-unlisted'}`);
    r.dataset.style = e.style;
    r.setAttribute('role', 'listitem');
    if (listed) {
      const drag = h('button', 'lg-drag icon-btn small');
      drag.type = 'button';
      drag.title = 'Drag to reorder; Up and Down move it';
      drag.setAttribute('aria-label', `Move ${e.label}`);
      drag.append(icon('grip', 14));
      this.dragging(drag, r, i);
      r.append(drag);
    }
    r.append(sampleOf(e.kind, e.color, e.lines));
    const text = h('div', 'lg-text');
    if (listed) {
      text.append(this.editable(e, 'name', e.name ? e.name : e.label, !e.name), this.editable(e, 'meaning', e.meaning || 'No meaning yet', !e.meaning));
    } else {
      const n = h('span', 'lg-name muted', e.label);
      text.append(n);
    }
    r.append(text);
    if (listed) {
      const key = h('button', `lg-key${e.key ? '' : ' none'}`, e.key || 'Key');
      key.type = 'button';
      key.title = e.key ? `Held by this entry: ${e.key}. Change or clear it` : 'Give it a key, Ctrl+1 to Ctrl+9';
      key.setAttribute('aria-label', e.key ? `Key ${e.key}, change` : `Give ${e.label} a key`);
      key.onclick = () => this.keyMenu(e, key);
      const pin = h('button', `lg-quick${e.quick ? ' on' : ''}`, e.quick ? 'Quick' : 'Pin');
      pin.type = 'button';
      pin.title = e.quick ? 'A quick style on the bar: click to unpin' : 'Pin as a quick style on the bar';
      pin.setAttribute('aria-pressed', String(!!e.quick));
      pin.setAttribute('aria-label', e.quick ? `Unpin ${e.label} as a quick style` : `Pin ${e.label} as a quick style`);
      pin.onclick = () => this.pin(e);
      const color = h('label', 'lg-recolor icon-btn small');
      color.title = 'Change its color';
      const input = h('input') as HTMLInputElement;
      input.type = 'color';
      input.value = /^#[0-9a-f]{6}$/i.test(e.color) ? e.color : '#d9822b';
      input.setAttribute('aria-label', `Change the color of ${e.label}`);
      input.onchange = () => this.recolor(e, r, input.value.toLowerCase());
      color.append(icon('pen', 14), input);
      const rm = h('button', 'lg-remove icon-btn small');
      rm.type = 'button';
      rm.title = 'Remove from the legend (its marks stay)';
      rm.setAttribute('aria-label', `Remove ${e.label} from the legend`);
      rm.append(icon('x', 14));
      rm.onclick = () => this.remove(e, r);
      r.append(key, pin, color, rm);
    }
    const n = h('button', 'lg-count', marksOf(e.count));
    n.type = 'button';
    n.title = 'Where it is used';
    n.setAttribute('aria-label', `${marksOf(e.count)} in ${e.label}: where it is used`);
    n.onclick = () => { this.view = Object.assign(this.view, { uses: e.style, filter: '', picked: new Set(), back: undefined }); void this.showUses(); };
    r.append(n);
    return r;
  }

  /** Row 34: a name or a meaning, edited where it is; Enter or a click away keeps it, Esc leaves it. */
  private editable(e: Entry, field: 'name' | 'meaning', shown: string, muted: boolean): HTMLElement {
    const b = h('button', `lg-${field}${muted ? ' muted' : ''}`, shown);
    b.type = 'button';
    b.title = field === 'name' ? 'Rename' : 'Edit its meaning';
    b.setAttribute('aria-label', `${field === 'name' ? 'Name' : 'Meaning'} of ${e.label}: edit`);
    b.onclick = () => {
      const input = h('input', `field small lg-edit lg-edit-${field}`) as HTMLInputElement;
      input.value = (field === 'name' ? e.name : e.meaning) || '';
      input.placeholder = field === 'name' ? 'Name' : 'What it means to you';
      input.setAttribute('aria-label', `${field === 'name' ? 'Name' : 'Meaning'} of ${e.label}`);
      let done = false;
      const keep = async () => {
        if (done) return;
        done = true;
        if (input.value.trim() === ((field === 'name' ? e.name : e.meaning) || '')) { input.replaceWith(b); return; }
        try {
          await wb(['legend', 'set', e.style, `--${field}`, input.value.trim()]);
          await changed();
          await this.show();
        } catch (x) { toast(said(x)); done = false; input.focus(); }
      };
      input.onkeydown = ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); void keep(); }
        else if (ev.key === 'Escape') { ev.stopPropagation(); done = true; input.replaceWith(b); b.focus(); }
      };
      input.onblur = () => void keep();
      b.replaceWith(input);
      input.focus();
      input.select();
    };
    return b;
  }

  /** A line of words and buttons under a row: the question of rows 35, 37 and 39. */
  private asking(r: HTMLElement, text: string, buttons: [string, () => void][]) {
    this.ask?.node.remove();
    const q = h('div', 'lg-ask');
    q.setAttribute('role', 'group');
    q.append(h('span', 'lg-ask-text', text));
    const box = h('span', 'lg-ask-btns');
    for (const [label, run] of buttons) {
      const b = h('button', 'btn small', label);
      b.type = 'button';
      b.onclick = () => { q.remove(); this.ask = null; run(); };
      box.append(b);
    }
    q.append(box);
    r.after(q);
    this.ask = { style: r.dataset.style || '', node: q };
    (box.firstElementChild as HTMLElement | null)?.focus();
  }

  /** Row 35. */
  private recolor(e: Entry, r: HTMLElement, color: string) {
    if (color === e.color) return;
    const set = async (how: string[]) => {
      try {
        const res = await wb(['legend', 'set', e.style, '--color', color, ...how]);
        if (how[0] === '--restyle') patchDrawn(m => (m.style === e.style ? { ...m, color, style: res?.entry?.style || m.style } : m));
        await changed();
        await this.show();
      } catch (x) { toast(said(x)); await this.show(); }
    };
    if (e.count > 0) {
      this.asking(r, `Change the ${marksOf(e.count)} in this style too?`, [['Yes', () => void set(['--restyle'])], ['No', () => void set(['--no-restyle'])], ['Cancel', () => void this.show()]]);
    } else void set([]);
  }

  /** Row 36: the core refuses a sixth; its message is shown. */
  private async pin(e: Entry) {
    try { await wb(['legend', 'set', e.style, '--quick', e.quick ? 'off' : 'on']); await changed(); await this.show(); } catch (x) { toast(said(x)); }
  }

  /** Row 37: Ctrl+1 to 9, or none; a key held by another entry asks to move it. */
  private keyMenu(e: Entry, from: HTMLElement) {
    const body = h('div', 'menu-list lg-keys');
    const set = async (key: string, move: boolean) => {
      try { await wb(['legend', 'set', e.style, '--key', key, ...(move ? ['--move-key'] : [])]); await changed(); await this.show(); } catch (x) { toast(said(x)); }
    };
    for (const k of [...KEYS, 'none']) {
      const holder = this.entries.find(x => x.key === k && x.style !== e.style);
      const b = h('button', `menu-item${e.key === k ? ' on' : ''}`, k === 'none' ? 'None' : holder ? `${k} · ${holder.label}` : k);
      b.type = 'button';
      b.dataset.key = k;
      b.onclick = () => {
        close();
        const row = this.el.querySelector<HTMLElement>(`.lg-entry[data-style="${CSS.escape(e.style)}"]`);
        if (holder && row) this.asking(row, `${k} is already used by “${holder.label}”. Move it here?`, [['Yes', () => void set(k, true)], ['No', () => {}]]);
        else void set(k, false);
      };
      body.append(b);
    }
    const close = popMenu(from, body, { width: 200 });
  }

  /** Row 39. */
  private remove(e: Entry, r: HTMLElement) {
    this.asking(r, `Remove “${e.label}” from the legend? ${e.count ? `${e.count === 1 ? 'Its 1 mark stays' : `Its ${e.count} marks stay`}, as Unnamed.` : 'No mark uses it.'}`, [['Remove', async () => {
      try { await wb(['legend', 'rm', e.style]); await changed(); await this.show(); } catch (x) { toast(said(x)); }
    }], ['Cancel', () => {}]]);
  }

  /** Row 38: drag the grip, or press Up and Down on it. */
  private dragging(grip: HTMLElement, row: HTMLElement, from: number) {
    const move = async (to: number) => {
      if (to < 0 || to >= this.entries.length || to === from) return;
      try { await wb(['legend', 'move', this.entries[from].style, '--to', String(to + 1)]); await changed(); this.view.focus = this.entries[from].style; await this.show(); } catch (x) { toast(said(x)); }
    };
    grip.onblur = () => { setTimeout(() => { if (!this.el.contains(document.activeElement)) this.view.focus = undefined; }, 400); };
    grip.onkeydown = ev => {
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); void move(from + (ev.key === 'ArrowUp' ? -1 : 1)); }
    };
    grip.style.touchAction = 'none';
    grip.onpointerdown = ev => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      grip.setPointerCapture(ev.pointerId);
      const rows = [...this.el.querySelectorAll<HTMLElement>('.lg-list > .lg-entry')];
      let to = from;
      row.classList.add('dragging');
      const mid = (x: HTMLElement) => { const b = x.getBoundingClientRect(); return b.top + b.height / 2; };
      const onMove = (m: PointerEvent) => {
        to = rows.filter(x => x !== row).filter(x => mid(x) < m.clientY).length;
        rows.forEach(x => x.classList.remove('drop-before', 'drop-after'));
        const others = rows.filter(x => x !== row);
        if (to < others.length) others[to].classList.add('drop-before'); else others[others.length - 1]?.classList.add('drop-after');
      };
      const end = () => {
        grip.removeEventListener('pointermove', onMove);
        grip.removeEventListener('pointerup', end);
        grip.removeEventListener('pointercancel', end);
        row.classList.remove('dragging');
        rows.forEach(x => x.classList.remove('drop-before', 'drop-after'));
        void move(to);
      };
      grip.addEventListener('pointermove', onMove);
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    };
  }

  // ---- where a style is used (rows 40, 41) ----------------------------------------------------------------------------
  private async showUses(): Promise<void> {
    const style = this.view.uses!;
    let u: Uses;
    try { u = await wb(['legend', 'uses', style]); } catch (x) { toast(said(x)); this.view.uses = undefined; return this.show(); }
    const el = this.el;
    el.replaceChildren();
    const hd = h('header', 'lg-head lg-uses-head');
    const back = h('button', 'icon-btn lg-back');
    back.type = 'button';
    back.title = 'Back to the legend';
    back.setAttribute('aria-label', 'Back to the legend');
    back.append(icon('left', 16));
    back.onclick = () => { this.view.uses = undefined; this.view.picked.clear(); void this.show(); };
    hd.append(back, sampleOf(u.entry.kind, u.entry.color, u.entry.lines), h('h2', 'pane-title lg-title', `${u.entry.label} · ${marksOf(u.count)}`));
    el.append(hd);
    if (this.view.back) {
      const where = h('div', 'lg-where');
      const b = h('button', 'link-btn lg-return', `Back to ${this.view.back}`);
      b.type = 'button';
      b.onclick = () => { this.view.back = undefined; if (!app.back()) toast('Nothing to go back to'); void this.showUses(); };
      where.append(h('span', 'muted small', 'In the reader. '), b);
      el.append(where);
    }
    const filter = h('input', 'field small lg-filter') as HTMLInputElement;
    filter.placeholder = 'Filter by book';
    filter.setAttribute('aria-label', 'Filter by book');
    filter.value = this.view.filter;
    el.append(filter);
    const rows = h('div', 'lg-uses');
    rows.setAttribute('role', 'list');
    el.append(rows);
    const foot = h('div', 'lg-foot');
    const all = h('button', 'link-btn lg-all', 'Select all shown');
    all.type = 'button';
    const del = h('button', 'btn small lg-delete');
    del.type = 'button';
    del.append(icon('trash', 14), document.createTextNode(' Delete'));
    foot.append(all, h('span', 'grow'), del);
    el.append(foot);
    const shown = () => {
      const q = filter.value.trim().toLowerCase();
      return u.marks.filter(m => !q || m.book.toLowerCase().includes(q));
    };
    const paint = () => {
      this.view.filter = filter.value;
      const list = shown();
      rows.replaceChildren();
      if (!list.length) rows.append(h('p', 'muted small', u.marks.length ? 'No mark in a book by that name.' : 'No mark uses this style.'));
      for (const m of list) rows.append(this.useRow(m, paint, style));
      const n = [...this.view.picked].filter(id => u.marks.some(m => m.id === id)).length;
      del.hidden = n === 0;
      del.lastChild!.textContent = ` Delete ${n} mark${n === 1 ? '' : 's'}`;
      all.hidden = !list.length;
    };
    filter.oninput = paint;
    all.onclick = () => { const l = shown(); const every = l.every(m => this.view.picked.has(m.id)); l.forEach(m => (every ? this.view.picked.delete(m.id) : this.view.picked.add(m.id))); paint(); };
    del.onclick = () => void this.deleteMarks(u);
    paint();
  }

  private useRow(m: Used, paint: () => void, style: string): HTMLElement {
    const r = h('div', `lg-use${this.view.picked.has(m.id) ? ' picked' : ''}`);
    r.dataset.id = m.id;
    r.setAttribute('role', 'listitem');
    const box = h('input') as HTMLInputElement;
    box.type = 'checkbox';
    box.className = 'lg-pick';
    box.checked = this.view.picked.has(m.id);
    box.setAttribute('aria-label', `Select ${m.label}`);
    box.onchange = () => { if (box.checked) this.view.picked.add(m.id); else this.view.picked.delete(m.id); paint(); };
    const go = h('button', 'lg-use-go');
    go.type = 'button';
    go.title = `Open ${m.label} in the reader`;
    go.append(h('span', 'lg-ref', m.label), h('span', 'lg-words muted', m.words ? `“${m.words}”` : ''));
    go.onclick = () => {
      const was = app.drawn ? `${app.drawn.chapter.name} ${app.drawn.chapter.chapter}:${app.topVerse()}` : 'where you were';
      this.view.back ||= was;
      void goTo(m.at);
      this.view.uses = style;
      void this.showUses();
    };
    r.append(box, go);
    return r;
  }

  /** Row 41: the marks go to the trash together; one toast, one Undo. */
  private async deleteMarks(u: Uses) {
    const ids = [...this.view.picked].filter(id => u.marks.some(m => m.id === id));
    if (!ids.length) return;
    try { await wb(['mark', 'rm', ...ids]); } catch (x) { toast(said(x)); return; }
    this.view.picked.clear();
    const gone = new Set(ids);
    patchDrawn(m => (gone.has(m.id) ? null : m));
    app.changed('highlights');
    toastUndo(`${marksOf(ids.length)} deleted`, async () => {
      try { await wb(['mark', 'restore', ...ids]); } catch (x) { toast(said(x)); return; }
      app.changed('highlights');
      await this.showUses();
    });
    await this.showUses();
  }
}
