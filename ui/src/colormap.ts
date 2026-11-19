// Colors across the Bible (design/features/marks, T14, rows 57 and 58; MK7-29, MK7-7). Every book a row of chapter cells.
// With no filter a cell shows the styles in it as small bars (a folder's color as a small tab at its foot, never a bar, so
// a folder and an underline never look alike); with one style or folder chosen, its chapters fill and the empty cells are
// its gaps. A click on a cell opens the reader at that chapter with the chosen style shown; Back returns. The view only
// shows where marks are: no count is ranked, and a cell's fill is the same whatever the count. Everything comes from
// `wb marks map`; nothing is kept here but what was chosen, on the pane.
import { app, goTo } from './app';
import { wb } from './api';
import { dock } from './panes';
import type { Pane } from './dock';
import { sampleOf, type Kind } from './markbar';
import { inkOf } from './markdraw';
import { panel } from './markpanel';
import { toast } from './sheets';
import { h } from './ui';

interface Sty { style: string; kind: Kind; color: string; lines?: number; label?: string; listed?: boolean }
interface Fol { key: string; name: string; color: string }
interface Cell { chapter: number; count?: number; styles?: (Sty & { count: number })[]; folders?: (Fol & { count: number })[] }
interface MapBook { code: string; name: string; chapters: number; cells: Cell[] }
interface Filter { style?: string; folder?: string; label: string; color?: string; kind?: Kind }
interface MapAnswer { books: MapBook[]; styles: Sty[]; folders: Fol[]; filter: Filter | null; total: number; chapters_with: number }

const said = (x: unknown) => String((x as any)?.message ?? x).replace(/^Error:\s*/, '');
const NAMED = ['yellow', 'green', 'blue', 'pink', 'orange'];
/** The color a style is drawn in: a highlight's own wash, the ink of any other kind. */
const wash = (kind: string, color: string) => (kind === 'highlight' ? (NAMED.includes(color) ? `var(--hl-${color})` : color) : inkOf(color));
const folderColor = (c: string) => (NAMED.includes(c) ? `var(--hl-${c})` : c);

export function openColormap(pick?: { style?: string; folder?: string }) {
  return dock.open('colormap', 'Colors across the Bible', 'colormap', 'left', (el, pane) => { new ColorMap(el, pane, pick).show(); });
}

class ColorMap {
  private view: { style?: string; folder?: string; back?: string };
  private labels = new Map<string, string>();

  constructor(private el: HTMLElement, pane: Pane, pick?: { style?: string; folder?: string }) {
    const p = pane as any;
    this.view = p.colorView ||= {};
    if (pick && (pick.style || pick.folder)) { this.view.style = pick.style; this.view.folder = pick.folder; }
    el.classList.add('colormap');
  }

  async show(): Promise<void> {
    const argv = ['marks', 'map', ...(this.view.style ? ['--style', this.view.style] : this.view.folder ? ['--folder', this.view.folder] : [])];
    let m: MapAnswer;
    try { m = await wb(argv); } catch (x) {
      // a style or folder that is gone: the whole map instead
      if (this.view.style || this.view.folder) { toast(said(x)); this.view.style = this.view.folder = undefined; return this.show(); }
      this.el.replaceChildren(h('p', 'muted small', said(x)));
      return;
    }
    this.draw(m);
  }

  private draw(m: MapAnswer) {
    const el = this.el;
    el.replaceChildren();
    this.labels = new Map(m.styles.map(s => [s.style, s.label || s.style]));
    el.append(h('header', 'cm-head', ''));
    el.firstElementChild!.append(h('h2', 'pane-title cm-title', 'Colors across the Bible'));
    const f = m.filter;
    const some = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    const sub = f
      ? `Filter: ${f.label} · ${some(m.total, f.folder ? 'place' : 'mark', f.folder ? 'places' : 'marks')} in ${some(m.chapters_with, 'chapter', 'chapters')}`
      : `Every style and folder color, chapter by chapter · ${some(m.chapters_with, 'chapter has', 'chapters have')} something`;
    el.append(h('p', 'muted small cm-sub', sub));
    el.append(this.chips(m));
    if (this.view.back) {
      const where = h('div', 'lg-where cm-where');
      const b = h('button', 'link-btn cm-return', `Back to ${this.view.back}`);
      b.type = 'button';
      b.onclick = () => { this.view.back = undefined; if (!app.back()) toast('Nothing to go back to'); this.draw(m); };
      where.append(h('span', 'muted small', 'In the reader. '), b);
      el.append(where);
    }
    if (!m.styles.length && !m.folders.length) el.append(h('p', 'muted small cm-empty', 'No mark is drawn and no folder has a color yet.'));
    const grid = h('div', 'cm-grid');
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', 'Chapters of every book');
    for (const b of m.books) {
      const row = h('div', 'cm-row');
      row.setAttribute('role', 'row');
      row.dataset.code = b.code;
      row.append(h('span', 'cm-book', b.name));
      const cells = h('span', 'cm-cells');
      for (const c of b.cells) cells.append(this.cell(b, c, f));
      row.append(cells);
      grid.append(row);
    }
    el.append(grid);
  }

  /** Style chips from the legend, then folder chips; a chip pressed again clears the filter. */
  private chips(m: MapAnswer): HTMLElement {
    const box = h('div', 'cm-chips');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Choose one style or folder');
    const pressed = (b: HTMLElement, on: boolean) => { b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); };
    for (const s of m.styles) {
      const b = h('button', 'cm-chip') as HTMLButtonElement;
      b.type = 'button';
      b.dataset.style = s.style;
      b.append(sampleOf(s.kind, s.color, s.lines), h('span', '', s.label || s.style));
      pressed(b, this.view.style === s.style);
      b.onclick = () => { this.view.style = this.view.style === s.style ? undefined : s.style; this.view.folder = undefined; void this.show(); };
      box.append(b);
    }
    for (const fo of m.folders) {
      const b = h('button', 'cm-chip cm-folder') as HTMLButtonElement;
      b.type = 'button';
      b.dataset.folder = fo.key;
      const dot = h('i', 'cm-dot');
      dot.style.background = folderColor(fo.color);
      b.append(dot, h('span', '', `Folder: ${fo.name}`));
      pressed(b, this.view.folder === fo.key);
      b.onclick = () => { this.view.folder = this.view.folder === fo.key ? undefined : fo.key; this.view.style = undefined; void this.show(); };
      box.append(b);
    }
    return box;
  }

  private cell(b: MapBook, c: Cell, f: Filter | null): HTMLElement {
    const x = h('button', 'cm-cell') as HTMLButtonElement;
    x.type = 'button';
    x.dataset.chapter = String(c.chapter);
    x.dataset.code = b.code;
    let text = `${b.name} ${c.chapter}`;
    if (f) {
      if (c.count) {
        x.classList.add('has');
        x.style.background = f.folder ? folderColor(f.color || '') : wash(f.kind || 'highlight', f.color || '');
        text += `: ${f.label}, ${c.count}`;
      }
    } else {
      const st = c.styles || [], fo = c.folders || [];
      if (st.length || fo.length) x.classList.add('has');
      for (const s of st) { const bar = h('i', 'cm-bar'); bar.style.background = wash(s.kind, s.color); x.append(bar); }
      if (fo.length) { const tab = h('i', 'cm-tab'); tab.style.background = folderColor(fo[0].color); x.append(tab); }
      const names = [...st.map(s => `${this.labels.get(s.style) || s.style} ${s.count}`), ...fo.map(o => `${o.name} ${o.count}`)];
      if (names.length) text += `: ${names.join(', ')}`;
    }
    x.title = text;
    x.setAttribute('aria-label', text);
    x.onclick = () => void this.open(b, c);
    return x;
  }

  /** Row 58: the reader goes to the chapter with the chosen style shown; Back returns. */
  private async open(b: MapBook, c: Cell) {
    const was = app.drawn ? `${app.drawn.chapter.name} ${app.drawn.chapter.chapter}:${app.topVerse()}` : 'where you were';
    this.view.back ||= was;
    await goTo(`${b.code} ${c.chapter}`);
    if (this.view.style) this.showStyle(this.view.style);
    this.el.querySelector('.cm-where')?.remove();
    const where = h('div', 'lg-where cm-where');
    const back = h('button', 'link-btn cm-return', `Back to ${this.view.back}`);
    back.type = 'button';
    back.onclick = () => { this.view.back = undefined; if (!app.back()) toast('Nothing to go back to'); where.remove(); };
    where.append(h('span', 'muted small', 'In the reader. '), back);
    this.el.querySelector('.cm-chips')?.after(where);
  }

  /** The marks panel may hide the chosen style (its kind, its entry, or Reading mode): it is shown for now, and said. */
  private showStyle(style: string) {
    const kind = style.split(':')[0];
    const hid: string[] = [];
    if (panel.styles.has(style)) { panel.styles.delete(style); hid.push('its legend entry'); }
    if (panel.kinds.has(kind)) { panel.kinds.delete(kind); hid.push(`${kind}s`); }
    if (panel.reading) { panel.reading = false; hid.push('Reading mode'); }
    if (!hid.length) return;
    app.repaintLayers();
    toast(`The marks panel had hidden this style (${hid.join(', ')}); it is shown while you look. The panel's setting is unchanged.`);
  }
}
