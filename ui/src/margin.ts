// The margin in the reader (design/features/marks T10, MK7-18, MK7-27, MK7-28, MK7-31; rows 17 to 19, 29, 30, 43, 50).
// A column always beside the text, behind a thin line, like a Bible's. Open, each note sits level with its verse (the chapter's
// own at the top); minimized, only signs: a small notepad beside each verse with a note. A click in the margin level with a
// verse opens an empty note there with the cursor in it; away from every verse it is a note for the chapter. Nothing is written
// until text is typed: Esc or a click away keeps what was typed (`wb mark note <place> "text"`); clicking a note's text edits it
// (`wb mark note <id> --text`; empty text deletes, with Undo). A note's ⋯ menu: Grow into a page (`wb mark grow`) and Delete
// (`wb mark rm`, Undo). In a narrow window, and always on a phone, the margin is signs; a sign opens its note in a popover
// beside the verse (a bottom sheet on a phone). Open or signs is kept in settings/marks.json (`wb settings marks margin`).
// The margin only shows what was written: it never suggests anything (MK-10). References in a note are plain text here.
import { wb } from './api';
import type { Drawn } from './reader';
import { h } from './ui';
import { openSheet, closeSheet, toast, toastUndo, compact } from './sheets';
import { panel } from './markpanel';

export interface MarginNote {
  id: string; at: string; label: string; kind: 'chapter' | 'verse' | 'span'; v1: number; v2: number; text: string;
  question?: boolean; done?: boolean; created?: string; changed?: string; grew: { id: string; title: string; gone?: boolean }[];
}
/** A note being written: nothing is kept until it has text. */
interface Draft { draft: true; place: string; v1: number; v2: number; label: string; kind: MarginNote['kind'] }
type Item = MarginNote | Draft;
const isDraft = (i: Item): i is Draft => (i as Draft).draft === true;

/** A width under which the margin is signs only (row 50). */
export const NARROW = 900;
const PAD_OPEN = 292, PAD_SIGNS = 44;

const NOTEPAD = 'M3.5 2h9v12h-9zM6 5.5h4M6 8h4M6 10.5h2';
function svg(path: string, size = 16): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('width', String(size));
  s.setAttribute('height', String(size));
  s.setAttribute('aria-hidden', 'true');
  s.classList.add('ico');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  s.append(p);
  return s;
}

export interface MarginEnv {
  scroller: HTMLElement;
  reader: HTMLElement;
  /** A page opened from a note's "grew into" link, or after Grow into a page. */
  openPage(id: string): void;
  /** The reader's ? markers or notes changed: read them again. */
  questionsChanged(v: number, open: boolean): void;
}

export interface Margin {
  /** A chapter was drawn: read its notes (one file, no page). */
  load(d: Drawn): Promise<void>;
  /** The text moved or changed size: put each note level with its verse again. */
  layout(): void;
  /** Settings or width changed: choose open or signs again. */
  refresh(): void;
  /** The bar's notepad (or N, or the right-click menu): an empty note at verses `v1` to `v2` of this chapter, the cursor in it. */
  startNote(v1: number, v2: number): void;
  /** Show one note (Library search, a verse card): in the open column its card is scrolled to and outlined; as signs, its popover opens.
   *  Waits for the chapter's notes when they are not read yet. */
  show(id: string): void;
  mode(): 'open' | 'signs';
}

export function createMargin(env: MarginEnv): Margin {
  const { scroller, reader } = env;
  const col = h('aside', 'margin-col');
  col.setAttribute('aria-label', 'Margin');
  col.hidden = true;
  const toggle = h('button', 'mg-toggle');
  toggle.type = 'button';
  const list = h('div', 'mg-list');
  col.append(toggle, list);
  scroller.append(col);

  let d: Drawn | null = null;
  let notes: Item[] = [];
  let seq = 0;
  let editing = 0;   // cards with a text box open: the column is not rebuilt under the cursor

  const placeName = () => (d ? `${d.chapter.name} ${d.chapter.chapter}` : '');
  const code = () => d!.chapter.code;
  const mode = (): 'open' | 'signs' => (compact() || scroller.clientWidth < NARROW || panel.margin === 'signs' ? 'signs' : 'open');

  // ---- what is written ---------------------------------------------------------------------------------------------
  async function load(draw: Drawn) {
    d = draw;
    const mine = ++seq;
    notes = [];
    closeSheet();
    let got: MarginNote[] = [];
    try {
      const r = await wb(['mark', 'notes', placeName()]);
      got = Array.isArray(r?.notes) ? r.notes : [];
    } catch { /* outside the app, no notes unless a test answers */ }
    if (mine !== seq) return;
    notes = got.map(n => ({ ...n, grew: n.grew || [] }));
    build();
    reveal();
  }

  /** The note to show once the chapter's notes are here (`show`). */
  let want = '';
  function reveal() {
    if (!want || !d) return;
    const n = notes.find(x => !isDraft(x) && x.id === want) as MarginNote | undefined;
    if (!n) return;
    want = '';
    if (mode() === 'open') {
      const el = list.querySelector<HTMLElement>(`.mg-card[data-note="${n.id}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      el.classList.add('mg-flash');
      setTimeout(() => el.classList.remove('mg-flash'), 2400);
    } else {
      const sign = list.querySelector<HTMLElement>(`.mg-sign[data-v="${n.v1}"]`);
      if (sign) openSign(n.v1, sign);
    }
  }

  const placeOf = (v1: number, v2: number) => (v1 === 0 ? `${code()}.${d!.chapter.chapter}` : v2 > v1 ? `${code()}.${d!.chapter.chapter}:${v1}-${v2}` : `${code()}.${d!.chapter.chapter}:${v1}`);
  const labelOf = (v1: number, v2: number) => (v1 === 0 ? 'Chapter' : v2 > v1 ? `${d!.chapter.chapter}:${v1}–${v2}` : `${d!.chapter.chapter}:${v1}`);
  const mkDraft = (v1: number, v2: number): Draft => ({ draft: true, place: placeOf(v1, v2), v1, v2: Math.max(v1, v2), label: labelOf(v1, v2), kind: v1 === 0 ? 'chapter' : v2 > v1 ? 'span' : 'verse' });

  function sorted(): Item[] {
    return notes.map((n, i) => ({ n, i })).sort((a, b) => a.n.v1 - b.n.v1 || a.i - b.i).map(x => x.n);
  }

  // ---- a note card -----------------------------------------------------------------------------------------------------
  const questionLine = /^>\s*\[!(question|done)\]\s*(.*)$/i;
  function body(text: string): HTMLElement {
    const box = h('div', 'mg-text');
    let q: HTMLElement | null = null;
    for (const line of text.split('\n')) {
      const m = questionLine.exec(line);
      if (m) {
        q = h('div', `mg-q${m[1].toLowerCase() === 'done' ? ' done' : ''}`);
        q.append(h('span', 'mg-qpill', m[1].toLowerCase()), document.createTextNode(` ${m[2]}`));
        box.append(q);
      } else if (q && /^>/.test(line)) {
        q.append(document.createTextNode(` ${line.replace(/^>\s?/, '')}`));
      } else {
        q = null;
        box.append(h('p', 'mg-line', line));
      }
    }
    return box;
  }

  /** `after`: called when a card changed what is held (so the column and its signs are drawn again). `inSheet`: the card is in a popover. */
  function card(item: Item, inSheet: boolean, closeIt?: () => void): HTMLElement {
    const el = h('div', 'mg-card');
    el.dataset.v = String(item.v1);
    if (!isDraft(item)) el.dataset.note = item.id; else el.dataset.draft = '';
    const head = h('div', 'mg-head');
    head.append(svg(NOTEPAD, 12), h('span', 'mg-label', isDraft(item) ? item.label : item.kind === 'chapter' ? 'Chapter' : item.label.replace(/^.* (\d+:)/, '$1')));
    let state: Item = item;
    const textBox = h('div', 'mg-body');
    const grew = h('div', 'mg-grew-row');
    el.append(head, textBox, grew);

    const paintGrew = () => {
      grew.replaceChildren();
      if (isDraft(state)) return;
      for (const g of state.grew) {
        if (g.gone) { grew.append(h('span', 'mg-grew muted small', 'grew into a page that is gone')); continue; }
        const a = h('button', 'mg-grew-link');
        a.type = 'button';
        a.append(document.createTextNode('grew into '), h('b', '', g.title || 'a page'));
        a.onclick = () => env.openPage(g.id);
        grew.append(a);
      }
    };

    // the small menu
    const more = h('button', 'mg-more');
    more.type = 'button';
    more.title = 'Note menu';
    more.setAttribute('aria-label', 'Note menu');
    more.append(svg('M3 8h.01M8 8h.01M13 8h.01', 16));
    more.hidden = isDraft(state);
    let menu: HTMLElement | null = null;
    const shutMenu = () => { menu?.remove(); menu = null; document.removeEventListener('pointerdown', away, true); };
    const away = (e: PointerEvent) => { if (menu && !menu.contains(e.target as Node) && e.target !== more) shutMenu(); };
    more.onclick = e => {
      e.stopPropagation();
      if (menu) return shutMenu();
      menu = h('div', 'mg-menu');
      menu.setAttribute('role', 'menu');
      const mk = (label: string, run: () => void) => {
        const b = h('button', 'mg-mi', label);
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.onclick = () => { shutMenu(); run(); };
        menu!.append(b);
      };
      mk('Grow into a page', () => void grow());
      mk('Delete', () => void remove());
      el.append(menu);
      setTimeout(() => document.addEventListener('pointerdown', away, true));
    };
    head.append(more);

    function view() {
      if (isDraft(state)) return;
      textBox.replaceChildren(body(state.text));
      more.hidden = false;
      paintGrew();
    }

    // writing: a new note (nothing is kept until it has text) or an existing note's text
    function write(focusEnd = true) {
      if (el.dataset.editing) return;
      el.dataset.editing = '1';
      editing++;
      const ta = h('textarea', 'mg-edit');
      ta.rows = 2;
      ta.setAttribute('aria-label', isDraft(state) ? `Write a margin note at ${state.label}` : 'Edit the margin note');
      ta.value = isDraft(state) ? '' : state.text;
      const start = ta.value;
      let done = false;
      const size = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; relayout(); };
      ta.oninput = size;
      const finish = async (andClose: boolean) => {
        if (done) return;
        done = true;
        const text = ta.value.replace(/\s+$/, '');
        el.removeAttribute('data-editing');
        editing = Math.max(0, editing - 1);
        if (isDraft(state)) {
          if (!text.trim()) { drop(state); if (andClose) closeIt?.(); return; }
          await create(state, text, el, card2 => { if (andClose) closeIt?.(); return card2; });
          return;
        }
        if (text.trim() === '') { await removeNote(state as MarginNote, true); if (andClose) closeIt?.(); return; }
        if (text !== start) await edit(state as MarginNote, text);
        if (el.isConnected) view();
        if (andClose) closeIt?.();
      };
      ta.onkeydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); void finish(true); }
        else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); void finish(false); }
        else e.stopPropagation();
      };
      ta.onblur = () => void finish(false);
      for (const t of ['pointerdown', 'click']) ta.addEventListener(t, e => e.stopPropagation());
      textBox.replaceChildren(ta);
      more.hidden = true;
      ta.focus({ preventScroll: true });
      if (focusEnd) ta.setSelectionRange(ta.value.length, ta.value.length);
      size();
      (el as any).__finish = finish;
    }

    async function grow() {
      if (isDraft(state)) return;
      try {
        const r = await wb(['mark', 'grow', state.id]);
        const mine = state as MarginNote;
        const got: MarginNote | undefined = r?.note;
        mine.grew = got?.grew?.length ? got.grew : [...mine.grew, { id: r.page, title: r.title }];
        paintGrew();
        env.openPage(r.page);
      } catch (x) { toast(String((x as Error)?.message ?? x)); }
    }
    async function remove() { if (!isDraft(state)) { await removeNote(state, false); closeIt?.(); } }

    textBox.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('a, button')) return;
      write();
    });
    textBox.tabIndex = 0;
    textBox.onkeydown = e => { if (e.key === 'Enter' && e.target === textBox) { e.preventDefault(); write(); } };
    textBox.setAttribute('role', 'button');
    textBox.setAttribute('aria-label', 'Edit the margin note');
    if (isDraft(state)) { textBox.removeAttribute('role'); write(); } else view();
    (el as any).__commit = () => (el as any).__finish?.(false);
    (el as any).__reset = (n: Item) => { state = n; };
    void inSheet;
    return el;
  }

  // ---- changing notes --------------------------------------------------------------------------------------------------
  function drop(item: Item) {
    notes = notes.filter(n => n !== item);
    build();
  }

  async function create(dr: Draft, text: string, el: HTMLElement, after: (c: HTMLElement) => unknown) {
    try {
      const made: MarginNote = await wb(['mark', 'note', dr.place, text]);
      const n: MarginNote = { ...made, grew: made?.grew || [], text: made?.text ?? text, v1: made?.v1 ?? dr.v1, v2: made?.v2 ?? dr.v2, kind: made?.kind ?? dr.kind, label: made?.label ?? dr.label };
      notes = notes.map(x => (x === dr ? n : x));
      env.questionsChanged(n.v1, !!n.question && !n.done);
    } catch (x) {
      notes = notes.filter(n => n !== dr);
      toast(String((x as Error)?.message ?? x));
    }
    after(el);
    if (!sheetNote) build();
    else refreshSheet();
  }

  async function edit(n: MarginNote, text: string) {
    try {
      const r = await wb(['mark', 'note', n.id, '--text', text]);
      Object.assign(n, { text: r?.text ?? text, question: r?.question, done: r?.done, changed: r?.changed });
      env.questionsChanged(n.v1, !!n.question && !n.done);
    } catch (x) { toast(String((x as Error)?.message ?? x)); }
  }

  async function removeNote(n: MarginNote, emptied: boolean) {
    try { await wb(['mark', 'rm', n.id]); } catch (x) { toast(String((x as Error)?.message ?? x)); build(); return; }
    notes = notes.filter(x => x !== n);
    env.questionsChanged(n.v1, false);
    if (sheetNote) refreshSheet(); else build();
    toastUndo(emptied ? 'Empty note deleted ·' : 'Note deleted ·', async () => {
      try {
        await wb(['mark', 'restore', n.id]);
        notes.push(n);
        env.questionsChanged(n.v1, !!n.question && !n.done);
        build();
      } catch (x) { toast(String((x as Error)?.message ?? x)); }
    });
  }

  // ---- drawing the column ------------------------------------------------------------------------------------------
  function build() {
    if (!d) return;
    const m = mode();
    col.hidden = false;
    col.dataset.mode = m;
    col.classList.toggle('phone', compact());
    scroller.classList.toggle('margin-open', m === 'open');
    scroller.classList.toggle('margin-signs', m === 'signs');
    scroller.style.paddingRight = compact() ? '' : `${m === 'open' ? PAD_OPEN : PAD_SIGNS}px`;
    toggle.hidden = compact() || scroller.clientWidth < NARROW;
    toggle.title = m === 'open' ? 'Minimize the margin to signs' : 'Open the margin';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-pressed', String(m === 'open'));
    toggle.dataset.state = m;
    toggle.replaceChildren(svg(m === 'open' ? 'M6 3.5L10.5 8 6 12.5' : 'M10 3.5L5.5 8 10 12.5', 14));
    list.replaceChildren();
    list.dataset.mode = m;
    const live = sorted();
    if (m === 'open') {
      for (const n of live) list.append(card(n, false));
    } else {
      const seen = new Set<number>();
      for (const n of live) {
        if (seen.has(n.v1)) continue;
        seen.add(n.v1);
        const s = h('button', 'mg-sign');
        s.type = 'button';
        s.dataset.v = String(n.v1);
        s.title = n.v1 === 0 ? 'Margin note for the chapter' : `Margin note at ${d.chapter.chapter}:${n.v1}`;
        s.setAttribute('aria-label', s.title);
        const q = live.some(x => x.v1 === n.v1 && !isDraft(x) && x.question && !x.done);
        s.classList.toggle('q', q);
        s.append(svg(NOTEPAD, 16));
        s.onclick = e => { e.stopPropagation(); openSign(n.v1, s); };
        list.append(s);
      }
    }
    layout();
  }

  /** The top of a verse inside the column (the column starts where the text starts). */
  const verseTop = (v: number): number | null => {
    const vn = reader.querySelector<HTMLElement>(`.vn[data-v="${v}"]`);
    return vn ? vn.offsetTop : null;
  };

  function layout() {
    if (!d) return;
    col.style.top = `${reader.offsetTop}px`;
    col.style.height = `${Math.max(reader.offsetHeight, 200)}px`;
    const m = col.dataset.mode;
    let floor = 30;   // below the toggle
    for (const el of [...list.children] as HTMLElement[]) {
      const v = +(el.dataset.v || 0);
      const want = v === 0 ? 0 : verseTop(v);
      if (want === null) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = '';
      const y = Math.max(want - (m === 'open' ? 2 : 0), floor);
      el.style.top = `${y}px`;
      floor = m === 'open' ? y + el.offsetHeight + 8 : y + 24;
    }
  }
  const relayout = () => layout();

  // ---- a click in the margin -----------------------------------------------------------------------------------------
  /** The verse level with a place in the column (y from the column's top), or 0 for the chapter's own (away from every verse). */
  function verseAtY(y: number): number {
    const vns = [...reader.querySelectorAll<HTMLElement>('.vn')];
    if (!vns.length) return 0;
    if (y < vns[0].offsetTop - 6) return 0;
    const lastEnd = [...reader.querySelectorAll<HTMLElement>('.para, .line')].reduce((m, p) => Math.max(m, p.offsetTop + p.offsetHeight), 0);
    if (y > lastEnd + 6) return 0;
    let best = 0;
    for (const e of vns) { if (e.offsetTop <= y + 4) best = +e.dataset.v!; else break; }
    return best;
  }

  col.addEventListener('click', e => {
    if (!d || (e.target !== col && e.target !== list)) return;
    const y = e.clientY - col.getBoundingClientRect().top;
    const v = verseAtY(y);
    void start(v, v);
  });
  for (const t of ['pointerdown', 'mousedown', 'touchstart']) col.addEventListener(t, e => e.stopPropagation());
  col.addEventListener('contextmenu', e => e.stopPropagation());

  toggle.onclick = e => {
    e.stopPropagation();
    const next = mode() === 'open' ? 'signs' : 'open';
    panel.margin = next;
    void panel.keepMargin(next).catch(x => toast(String((x as Error)?.message ?? x)));
    build();
  };

  /** Start an empty note at verses v1..v2 (0: the chapter). In the column when it is open; else in a popover beside the verse. */
  async function commitAll() {
    await Promise.all([...list.querySelectorAll<HTMLElement>('.mg-card'), ...document.querySelectorAll<HTMLElement>('.mg-pop .mg-card')].map(c => (c as any).__commit?.()));
  }
  async function start(v1: number, v2: number) {
    if (!d) return;
    await commitAll();
    const dr = mkDraft(v1, v2);
    notes.push(dr);
    build();
    if (mode() === 'open') {
      const ta = list.querySelector<HTMLTextAreaElement>('.mg-card[data-draft] textarea');
      ta?.focus();
      ta?.dispatchEvent(new Event('input'));
    } else {
      const from = list.querySelector<HTMLElement>(`.mg-sign[data-v="${v1}"]`) ?? reader.querySelector<HTMLElement>(`.vn[data-v="${v1}"]`) ?? col;
      openSign(v1, from);
    }
  }

  // ---- the popover (signs): a sign opens its note beside the verse; a phone's bottom sheet ----------------------------------
  let sheetNote: { v: number; body: HTMLElement } | null = null;
  function fillSheet(box: HTMLElement, v: number) {
    box.dataset.v = String(v);
    box.replaceChildren(...sorted().filter(n => n.v1 === v).map(n => card(n, true, () => closeSheet())));
  }
  function openSign(v: number, from: Element) {
    closeSheet();
    const target = v === 0 ? from : reader.querySelector<HTMLElement>(`.vn[data-v="${v}"]`) ?? from;
    const bodyEl = h('div', 'mg-pop');
    fillSheet(bodyEl, v);
    sheetNote = { v, body: bodyEl };
    const was = scroller.scrollTop;
    let moved = false;
    const panelEl = openSheet(bodyEl, target, {
      closed: () => {
        if (moved) scroller.scrollTop = was;   // the reader goes back to where it was (T13: it only moved to keep the verse above the sheet)
        // a note being written is kept when the popover closes (the scrim swallows the click, so no blur is heard)
        const cards = [...bodyEl.querySelectorAll<HTMLElement>('.mg-card')];
        sheetNote = null;
        void Promise.all(cards.map(c => (c as any).__commit?.())).then(() => { notes = notes.filter(n => !isDraft(n)); build(); });
      },
    });
    panelEl.classList.add('mg-popover');
    // a phone (sheet G5): the note's sheet is as tall as the note, and the verse stays visible above it
    if (compact()) {
      panelEl.classList.remove('half');
      panelEl.style.height = 'auto';
      panelEl.style.maxHeight = '62vh';
      const keep = () => {
        const t = target as HTMLElement, top = panelEl.getBoundingClientRect().top, r = t.getBoundingClientRect();
        if (v === 0 || !t.isConnected || r.bottom <= top - 8) return;
        scroller.scrollTop += r.bottom - (top - 12);
        moved = true;
      };
      keep();
      panelEl.addEventListener('focusin', () => setTimeout(keep));
    }
    // the popover sits beside the verse: left of the margin's signs, level with the verse, when there is room
    if (!compact()) {
      const r = (target as HTMLElement).getBoundingClientRect();
      const w = panelEl.offsetWidth || 340;
      panelEl.style.left = `${Math.max(16, Math.min(r.left - w - 12, window.innerWidth - w - 16))}px`;
      const hgt = panelEl.offsetHeight;
      panelEl.style.top = `${Math.max(8, Math.min(r.top - 10, window.innerHeight - hgt - 16))}px`;
    }
    const ta = bodyEl.querySelector<HTMLTextAreaElement>('textarea');
    ta?.focus();
    ta?.dispatchEvent(new Event('input'));
  }
  /** A note in the popover was kept or deleted: the popover shows what is left, or goes. */
  function refreshSheet() {
    const s = sheetNote;
    if (!s) return;
    if (!sorted().some(n => n.v1 === s.v)) return closeSheet();
    fillSheet(s.body, s.v);
    build();
  }

  window.addEventListener('resize', () => { if (d && !editing) build(); else layout(); });
  new ResizeObserver(() => layout()).observe(reader);

  return {
    load, layout,
    refresh: () => { if (d && !editing) build(); },
    startNote(v1, v2) { if (d) void start(v1, v2); },
    show(id) { want = id; reveal(); },
    mode,
  };
}
