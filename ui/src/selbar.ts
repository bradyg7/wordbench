// The selection bar (notebook design row 10, NB4): select words in a block being written and a bar appears above them with
// Turn into ▾, B, I, U, S, Link and Color ▾ (row 25). On the words of a scripture block (read-only, drawn word by word: pagescripture.ts)
// the bar is Mark ▾ (the Legend's styles) and Margin note (NB8, rows 11, 39, 40). The bar shows on intent: when a
// selection has been made (the pointer let go, or Shift with the arrows), not on every flicker of the selection while it is
// dragged. Its menus are the one menu component (ui/src/menu.ts). Nothing is written until a button is used.
import { applyColor, colorAt, setShape, shapeOf, toggleMark, type Writer } from './blockedit';
import { COLORS, label, type ColorKind } from './palette';
import { openMenu, type MenuGroup, type MenuItem } from './menu';
import { toggleOf } from './toggles';
import { addMarkEverywhere, anchorOf, pickedWords, type Picked } from './pagescripture';
import { startMarginNote } from './pagemargin';
import { wb, inApp } from './api';
import { app } from './app';
import { hlStyle } from './hlink';
import { inkOf } from './markdraw';
import { toast } from './sheets';

let installed = false;
let bar: HTMLElement | null = null;
let pointerDown = false;
let menuOpen = false;
let holding = false;
let timer = 0;

/** Is one of the bar's menus open? (The block being written keeps its place while it is.) */
export const selectionBarBusy = () => menuOpen || holding;

export const KINDS: { key: string; label: string; shape: string }[] = [
  { key: 'text', label: 'Text', shape: '' },
  { key: 'h1', label: 'Heading 1', shape: 'h1' },
  { key: 'h2', label: 'Heading 2', shape: 'h2' },
  { key: 'h3', label: 'Heading 3', shape: 'h3' },
  { key: 'bullet', label: 'Bullet list', shape: 'bullet' },
  { key: 'numbered', label: 'Numbered list', shape: 'numbered' },
  { key: 'todo', label: 'To-do', shape: 'todo' },
  { key: 'quote', label: 'Quote', shape: 'quote' },
  { key: 'callout', label: 'Callout', shape: 'callout' },
  { key: 'toggle', label: 'Toggle list', shape: '' },
];

/** What a kind's shape starts with (a bullet's mark, a to-do's empty box, a list's first number). */
export const shapeProps = (key: string) => (key === 'bullet' ? { mark: '-' } : key === 'todo' ? { mark: '-', box: ' ' } : key === 'numbered' ? { num: 1, delim: '.' } : {});

export function installSelectionBar() {
  if (installed) return;
  installed = true;
  document.addEventListener('pointerdown', ev => {
    if (!(ev.target as HTMLElement).closest?.('.nb-selbar')) { pointerDown = true; return; }
    // a press on the bar takes focus from the block for a moment: the block stays open until the press has been handled
    holding = true;
    window.setTimeout(() => { if (!menuOpen) holding = false; }, 1500);
  }, true);
  document.addEventListener('pointerup', () => { pointerDown = false; window.setTimeout(update, 0); }, true);
  document.addEventListener('keyup', ev => { if (ev.shiftKey || /^Arrow|^Home$|^End$/.test(ev.key) || (ev.key.toLowerCase() === 'a' && (ev.ctrlKey || ev.metaKey))) update(); }, true);
  document.addEventListener('selectionchange', () => {
    clearTimeout(timer);
    // a selection grown with the pointer waits for it to let go; one made another way (touch, keys) shows after a moment
    timer = window.setTimeout(() => { if (!pointerDown) update(); }, 220);
    if (!menuOpen && bar && collapsed()) hide();
  });
  document.addEventListener('scroll', () => { if (!menuOpen) hide(); }, true);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !menuOpen) hide(); }, true);
}

const collapsed = () => { const s = getSelection(); return !s || !s.rangeCount || s.isCollapsed; };

function hide() { bar?.remove(); bar = null; shown = null; }

/** The block being written that holds the whole selection. */
function targetOf(range: Range): { ed: Writer } | null {
  const node = range.commonAncestorContainer;
  const el = node instanceof HTMLElement ? node : node.parentElement;
  if (!el) return null;
  const ed = el.closest<HTMLElement>('.nb-block-input');
  if (ed && ed.isContentEditable && !ed.classList.contains('asking') && !ed.classList.contains('nb-whole') && ed.closest('.nb-blocks')) return { ed: ed as Writer };
  return null;
}

function update() {
  if (menuOpen) return;
  const sel = getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed || !sel.toString().trim()) return hide();
  const range = sel.getRangeAt(0);
  const words = pickedWords(range);
  if (words) {
    if (bar && bar.isConnected && shown && sameRange(shown, range)) { place(bar, range); return; }
    return showScripture(range, words);
  }
  const t = targetOf(range);
  if (!t) return hide();
  // the same words already have their bar: leave it (a late selection event must not swap the bar under a press on it)
  if (bar && bar.isConnected && shown && sameRange(shown, range)) { place(bar, range); return; }
  show(range, t);
}

let shown: Range | null = null;
const sameRange = (a: Range, b: Range) =>
  a.startContainer === b.startContainer && a.startOffset === b.startOffset && a.endContainer === b.endContainer && a.endOffset === b.endOffset;

function button(text: string, name: string, on: () => void, extra = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `nb-sb-btn ${extra}`.trim();
  b.textContent = text;
  b.setAttribute('aria-label', name);
  b.title = name;
  b.onmousedown = ev => ev.preventDefault();   // the selection stays where it is
  b.onclick = ev => { ev.preventDefault(); on(); };
  return b;
}

function show(range: Range, t: { ed: Writer }) {
  hide();
  const el = document.createElement('div');
  el.className = 'nb-selbar';
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Format the selection');
  {
    const ed = t.ed;
    const here = KINDS.find(k => k.shape === shapeOf(ed) && k.key !== 'toggle')?.label ?? 'Text';
    const turn = button(`${here} ▾`, 'Turn into', () => turnMenu(ed, turn), 'nb-sb-turn');
    const bold = button('B', 'Bold', () => format('b'), 'nb-sb-b');
    const italic = button('I', 'Italic', () => format('i'), 'nb-sb-i');
    const under = button('U', 'Underline', () => format('u'), 'nb-sb-u');
    const strike = button('S', 'Strikethrough', () => format('s'), 'nb-sb-s');
    const format = (key: 'b' | 'i' | 'u' | 's') => { toggleMark(ed, key); ed.dispatchEvent(new Event('input')); sync(); };
    const sync = () => {
      for (const [b, cmd] of [[bold, 'bold'], [italic, 'italic'], [under, 'underline'], [strike, 'strikeThrough']] as const) {
        let on = false;
        try { on = document.queryCommandState(cmd); } catch { /* a browser without the query */ }
        b.setAttribute('aria-pressed', String(on));
      }
    };
    sync();
    const link = button('Link', 'Link', () => {
      // a link to the page called what the words say (`[[words]]`); one that is not there yet offers to start it
      const a = ed.selectionStart, z = ed.selectionEnd;
      if (z <= a) return;
      ed.setRangeText(`[[${ed.value.slice(a, z)}]]`, a, z, 'end');
      ed.dispatchEvent(new Event('input'));
      hide();
    }, 'nb-sb-link');
    const color = button('Color ▾', 'Color', () => colorMenu(ed, color), 'nb-sb-color');
    el.append(turn, bold, italic, under, strike, link, color);
  }
  document.body.append(el);
  bar = el;
  shown = range.cloneRange();
  place(el, range);
}

/** The bar over words of scripture in a page: Mark ▾ and Margin note. */
function showScripture(range: Range, words: Picked) {
  hide();
  const el = document.createElement('div');
  el.className = 'nb-selbar nb-selbar-scripture';
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Mark the selection');
  const markBtn = button('Mark ▾', 'Mark', () => void markMenu(markBtn, words), 'nb-sb-mark');
  const noteBtn = button('Margin note', 'Margin note', () => {
    const rect = range.getBoundingClientRect();
    hide();
    getSelection()?.removeAllRanges();
    startMarginNote(words, rect);
  }, 'nb-sb-note');
  el.append(markBtn, noteBtn);
  document.body.append(el);
  bar = el;
  shown = range.cloneRange();
  place(el, range);
}

interface LegendEntry { kind: string; color: string; lines?: number; label: string; style: string }

/** Mark ▾: the Legend's styles under the bar; a pick makes the mark on those words (`wb mark add <place> --style <entry>`), the reader's mark. */
async function markMenu(anchor: HTMLElement, words: Picked) {
  let entries: LegendEntry[] = [];
  try { entries = ((await wb(['legend']))?.entries || []).filter((e: LegendEntry) => e.kind !== 'arrow'); } catch { /* no legend to choose from */ }
  const swatch = (e: LegendEntry) => {
    const ink = inkOf(e.color);
    if (e.kind === 'highlight') return `${hlStyle(e.color).split(';')[0]};border-radius:4px;`;
    if (e.kind === 'underline') return `border-bottom:${e.lines && e.lines > 1 ? 4 : 2}px ${e.lines && e.lines > 1 ? 'double' : 'solid'} ${ink};border-radius:0;`;
    return `border:2px solid ${ink};border-radius:${e.kind === 'circle' ? '9999px' : '3px'};`;
  };
  const items: MenuItem[] = entries.map(e => ({
    id: e.style, label: e.label, iconClass: 'nbc-mk', iconStyle: swatch(e), hint: e.kind === 'underline' && e.lines && e.lines > 1 ? `underline ×${e.lines}` : e.kind,
    keywords: [e.kind, e.color, e.style],
  }));
  menuOpen = true;
  const release = () => { menuOpen = false; holding = true; window.setTimeout(() => { holding = false; }, 400); };
  openMenu({
    groups: [{ title: 'Legend', items }], at: anchor, label: 'Mark', placeholder: 'Search the Legend',
    onPick: it => {
      release();
      hide();
      getSelection()?.removeAllRanges();
      void (async () => {
        try {
          const made = await wb(['mark', 'add', anchorOf(words), '--style', it.id]);
          addMarkEverywhere(made);
          if (inApp) void app.refreshMarks();
        } catch (x) { toast(String((x as Error)?.message ?? x)); }
      })();
    },
    onClose: () => { if (menuOpen) release(); },
  });
}

function place(el: HTMLElement, range: Range) {
  const r = range.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  let x = r.left + r.width / 2 - w / 2;
  x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
  let y = r.top - h - 8;
  if (y < 8) y = r.bottom + 8;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

/** Open one of the bar's menus under its button, with the selection kept to be put back. */
function withMenu(ed: Writer, anchor: HTMLElement, groups: MenuGroup[], name: string, pick: (id: string, saved: Range) => void) {
  const sel = getSelection();
  if (!sel || !sel.rangeCount) return;
  const saved = sel.getRangeAt(0).cloneRange();
  menuOpen = true;
  const release = () => { menuOpen = false; holding = true; window.setTimeout(() => { holding = false; }, 400); };
  const back = () => { ed.focus({ preventScroll: true }); const s = getSelection(); s?.removeAllRanges(); s?.addRange(saved); };
  openMenu({
    groups, at: anchor, label: name, placeholder: 'Type to filter',
    // the block keeps its place while focus moves back (its blur check waits a moment, so the bar is busy a little longer)
    onPick: it => { back(); pick(it.id, saved); release(); },
    onClose: () => { if (menuOpen) { back(); release(); } },
  });
}

function turnMenu(ed: Writer, anchor: HTMLElement) {
  const head = !!toggleOf.get(ed);
  // a toggle's line can be text or a heading; the other kinds are for a line that is not a toggle's
  const glyph = (k: string) => (k === 'toggle' ? '›' : k.startsWith('h') ? 'H' : k === 'bullet' ? '•' : k === 'numbered' ? '1.' : k === 'todo' ? '✓' : k === 'quote' ? '”' : 'T');
  const items = KINDS.filter(k => !head || /^(text|h[1-3])$/.test(k.key)).map(k => ({ id: k.key, label: k.label, icon: glyph(k.key) }));
  withMenu(ed, anchor, [{ items }], 'Turn into', id => {
    const k = KINDS.find(x => x.key === id)!;
    if (k.key === 'toggle') {
      if (!/^h[1-3]$/.test(shapeOf(ed))) setShape(ed, '');
      if (!toggleOf.get(ed)) toggleOf.set(ed, { closed: true });
    } else {
      setShape(ed, k.shape, shapeProps(k.key));
    }
    ed.dispatchEvent(new Event('input'));
    hide();
  });
}

function colorMenu(ed: Writer, anchor: HTMLElement) {
  const sel = getSelection();
  const now = (k: ColorKind) => (sel && sel.rangeCount ? colorAt(ed, sel.getRangeAt(0), k) : null);
  const group = (kind: ColorKind): MenuGroup => {
    const cur = now(kind) ?? 'default';
    const at = (name: string): MenuItem => ({
      id: `${kind}:${name}`, label: name === 'default' ? 'Default' : label(name),
      icon: kind === 'text' ? 'A' : '', hint: cur === name ? '✓' : undefined,
      iconClass: kind === 'text' ? 'nbc-a' : 'nbc-sw',
      iconData: name === 'default' ? undefined : { [kind === 'text' ? 'c' : 'bg']: name },
      keywords: [kind === 'text' ? 'text color' : 'background'],
    });
    return { title: kind === 'text' ? 'Text' : 'Background', items: ['default', ...COLORS].map(at) };
  };
  withMenu(ed, anchor, [group('text'), group('bg')], 'Color', (id, saved) => {
    const [kind, name] = id.split(':') as [ColorKind, string];
    const out = applyColor(ed, saved, kind, name === 'default' ? null : name);
    ed.dispatchEvent(new Event('input'));
    if (out) { const s = getSelection(); s?.removeAllRanges(); s?.addRange(out); }
    hide();
  });
}
