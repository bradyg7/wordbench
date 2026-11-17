// W4 of "The Notebook as a workspace" (sheets W3, W5.1, W5.2; the person's acceptance, 2026-11-07): verses drawn in the
// Notebook from the Bible, the one Open menu for places, and the verse card.
//
// - Verses come from `wb scripture` (or `wb page scripture`): each verse verbatim with its reference, and its text again
//   as runs carrying the person's highlights. The runs joined are the verse's text as the database has it; nothing here
//   changes or rebuilds a word.
// - The Open menu (one for every place opened from the Notebook): In the reader (the reader goes there; Back returns it)
//   or In a new reader (a second reader in a pane; the reader stays). A plain click does the ticked one, Ctrl+click the
//   other; Notebook settings → Places open in… changes which (`places` in settings/notebook.json).
// - The verse card (finding 94a1, "W5c, the card"): a click on a reference in a note shows the verse at the link with
//   Interlinear, Strong's, Definitions and Open the chapter ▾; the pin keeps it as a pane. In the card's interlinear a
//   word is put away with −, and a click brings it back; which words are put away is kept per verse on this computer
//   (the window's storage), never in the study folder.
import { wb } from './api';
import { app, goTo } from './app';
import { layers } from './layers';
import { dock, openStrong } from './panes';
import { closeSheet, compact, hideCard, openSheet } from './sheets';
import { frameCard, grip } from './cardframe';
import { pagesLine } from './wordcard';
import { button, h, icon, placePill, popMenu } from './ui';

export interface Run { t: string; hl?: string }
export interface MarkedVerse { ref: string; book: string; code: string; c: number; v: number; text: string; runs: Run[] }
export interface Marked { label: string; version: string; verses: MarkedVerse[] }

import { hlStyle } from './hlink';

/** Verses drawn verbatim, each with its number: as a paragraph (one after another) or a verse to a line. The person's
 * highlights are on the words, as in the reader (none while the highlights layer is hidden). */
export function drawVerses(verses: MarkedVerse[], lines: boolean): HTMLElement {
  const box = h('div', `sv-text ${lines ? 'sv-lines' : 'sv-para'}`);
  const showHl = layers.highlightsShown();
  const several = new Set(verses.map(v => `${v.code}.${v.c}`)).size > 1;
  let p: HTMLElement | null = null;
  for (const v of verses) {
    if (lines || !p) { p = h('p', 'scripture sv-p'); box.append(p); } else p.append(' ');
    const verse = h('span', 'sv-verse');
    verse.dataset.ref = v.ref;
    verse.append(h('span', 'sv-vn', several ? `${v.c}:${v.v}` : String(v.v)));
    const t = h('span', 'sv-t');
    for (const r of v.runs) {
      if (r.hl && showHl) {
        const m = h('span', 'sv-hl', r.t);
        m.style.cssText = hlStyle(r.hl);
        t.append(m);
      } else t.append(r.t);
    }
    verse.append(t);
    p.append(verse);
  }
  return box;
}

// ---- the one Open menu ------------------------------------------------------------------------------------------------

export type Where = 'reader' | 'new';
/** What a plain click on a place does (Notebook settings → Places open in…); the Notebook sets it from its settings. */
export const opens = { where: 'reader' as Where };
const other = (w: Where): Where => (w === 'reader' ? 'new' : 'reader');

/** Open a place: the reader goes there (Back returns it), or a second reader opens in a pane (the reader stays). A phone
 * has no second readers: the reader goes there. */
export function openIn(where: Where, ref: string, version?: string) {
  if (where === 'new' && !compact()) app.secondReader(ref, version);
  else void goTo(ref);
}

/** A click on a place: a plain click does the ticked one, Ctrl+click the other. */
export function openByClick(ref: string, e?: MouseEvent, version?: string) {
  openIn(e && (e.ctrlKey || e.metaKey) ? other(opens.where) : opens.where, ref, version);
}

/** Where the reader is now (what Back returns it to). */
function readerAt(): string {
  const d = app.drawn;
  return d ? `${d.chapter.name} ${d.chapter.chapter}:${app.topVerse()}` : 'where it is';
}

/** The Open menu: In the reader, In a new reader; the ticked one is what a plain click does. */
export function openMenu(from: HTMLElement, ref: string, what: string, version?: string, opened?: () => void) {
  const box = h('div', 'menu-list open-menu');
  box.append(h('div', 'open-menu-head muted small', `Open ${what}`));
  const at = readerAt();
  const row = (where: Where, label: string, about: string, ico: string) => {
    const ticked = opens.where === where;
    const b = h('button', `open-row${ticked ? ' on' : ''}`);
    b.dataset.where = where;
    b.append(icon(ico, 16));
    const t = h('div', 'open-row-text');
    t.append(h('div', 'open-row-label', label), h('div', 'open-row-about muted small', about));
    b.append(t, h('span', 'open-row-key', ticked ? 'Click' : 'Ctrl+click'));
    const tick = h('span', 'open-row-tick');
    if (ticked) tick.append(icon('check', 14));
    b.append(tick);
    b.onclick = () => { close(); opened?.(); openIn(where, ref, version); };
    box.append(b);
  };
  row('reader', 'In the reader', `The reader goes there; Back returns it to ${at}`, 'book');
  if (!compact()) row('new', 'In a new reader', `A second reader in a pane; the reader stays at ${at}`, 'float');
  box.append(h('div', 'open-menu-foot muted small', 'A plain click does the ticked one; Notebook settings → Places open in… changes which.'));
  const close = popMenu(from, box, { width: 360, align: 'right' });
}

/** A place pill in the Notebook: a click opens it as Places open in… says, Ctrl+click the other way, and a right-click
 * (or the context-menu key) shows the Open menu. */
export function placeOpen(label: string, ref: string): HTMLElement {
  const p = placePill(label, e => openByClick(ref, e));
  p.classList.add('place-open');
  p.title = opens.where === 'reader' ? 'Click: in the reader · Ctrl+click: in a new reader · right-click: choose' : 'Click: in a new reader · Ctrl+click: in the reader · right-click: choose';
  p.oncontextmenu = e => { e.preventDefault(); openMenu(p, ref, label); };
  return p;
}

/** An Open button with its ▾: the button opens as Places open in… says (Ctrl+click the other way); ▾ shows the menu. */
export function openSplit(label: string, ref: string, what: () => string, version?: () => string | undefined, cls = '', opened?: () => void): HTMLElement {
  const wrap = h('span', `open-split ${cls}`);
  const go = button('open-split-go', label, e => { opened?.(); openByClick(ref, e, version?.()); }, 'book');
  go.title = opens.where === 'reader' ? `Click: in the reader · Ctrl+click: in a new reader` : `Click: in a new reader · Ctrl+click: in the reader`;
  const more = button('open-split-more', '', () => openMenu(wrap, ref, what(), version?.(), opened), 'down');
  more.setAttribute('aria-label', 'Where to open it');
  more.title = 'Where to open it';
  wrap.append(go, more);
  return wrap;
}

// ---- the verse card ---------------------------------------------------------------------------------------------------

/** Which interlinear words are put away, per verse (`NUM.25:11` → word positions), on this computer only. */
const PUT_AWAY = 'wb.interlinear.putaway';
function putAway(): Record<string, number[]> {
  try { return JSON.parse(localStorage.getItem(PUT_AWAY) || '{}'); } catch { return {}; }
}
export function putAwayOf(key: string): Set<number> { return new Set(putAway()[key] || []); }
function keepPutAway(key: string, s: Set<number>) {
  const all = putAway();
  if (s.size) all[key] = [...s].sort((a, b) => a - b); else delete all[key];
  try { localStorage.setItem(PUT_AWAY, JSON.stringify(all)); } catch { /* only for now */ }
}

type Tab = 'interlinear' | 'concordance' | 'definitions' | null;
const MOST = 12;

/** A click on a reference in a note: the card at the link. Ctrl+click opens the place at once, as the Open menu's
 * Ctrl+click row says. */
export async function verseCard(ref: string, a: HTMLElement, e?: MouseEvent) {
  if (e?.ctrlKey || e?.metaKey) return openByClick(ref, e);
  hideCard();
  const d: Marked | null = await wb(['scripture', ref]).catch(() => null);
  if (!d?.verses?.length) return void goTo(ref);
  const body = h('div', 'verse-card-body');
  const panel = openSheet(body, a, { stays: true });
  panel.classList.add('verse-card');
  const place = () => {
    if (compact() || panel.dataset.moved) return;   // once the card is moved or sized it stays where it was put (dfce, 149b)
    const r = a.getBoundingClientRect();
    const w = Math.min(560, innerWidth - 32);
    panel.style.width = `${w}px`;
    panel.style.left = `${Math.max(16, Math.min(r.left - 24, innerWidth - w - 16))}px`;
    const hgt = panel.offsetHeight;
    const below = r.bottom + 8;
    panel.style.top = `${below + hgt <= innerHeight - 16 ? below : Math.max(16, Math.min(r.top - 8 - hgt, innerHeight - hgt - 16))}px`;
  };
  fillCard(body, ref, d, { pinned: false, changed: place, source: a, panel });
  place();
}

/** A card kept as a pane of its own (the pin): drawn again when highlights change. */
/** A card as a pane: a tab in the study column (`tab`), or a floating pane (`float`). The `card` line reaches it. */
export function openCardPane(ref: string, label: string, tab: Tab = null, source?: HTMLElement, side: 'left' | 'float' = 'left') {
  let now: Tab = tab;
  const sourcePane = source && dock.panes.find(p => p.el.contains(source));
  return dock.open('versecard', label, `versecard|${ref}`, side, async (el, pane) => {
    const d: Marked | null = await wb(['scripture', ref]).catch(() => null);
    const body = h('div', 'verse-card-body in-pane');
    if (!d) body.append(h('p', 'muted', `Nothing found at ${ref}.`));
    else fillCard(body, ref, d, { pinned: true, tab: now, tabChanged: t => { now = t; } });
    el.replaceChildren(body);
    if (sourcePane) {
      const back = button('link-btn vc-back', `Back to ${sourcePane.title}`, () => {
        const original = dock.find(sourcePane.key);
        if (!original) return;
        dock.show(original);
        if (source?.isConnected) source.focus({ preventScroll: true });
        else { original.el.tabIndex = -1; original.el.focus({ preventScroll: true }); }
      }, 'left');
      el.prepend(back);
    }
    pane.captureView = () => ({ tab: now });
    pane.restoreView = async state => {
      const tab = state?.tab;
      if (tab === null || ['interlinear', 'concordance', 'strongs', 'definitions'].includes(tab)) {
        now = tab === 'strongs' ? 'concordance' : tab;   // 'strongs' is what a kept layout may hold from before the door
        if (d) fillCard(body, ref, d, { pinned: true, tab: now, tabChanged: t => { now = t; } });
      }
    };
  });
}

interface CardOpts { pinned: boolean; tab?: Tab; changed?: () => void; tabChanged?: (t: Tab) => void; source?: HTMLElement; panel?: HTMLElement }

function fillCard(body: HTMLElement, ref: string, d: Marked, o: CardOpts) {
  body.replaceChildren();
  // The handle (W4): the grip to drag by, the title, Float, Open as a tab and close. At phone width it is the sheet's own bar.
  const head = h('div', 'vc-head');
  const wide = !o.pinned && !!o.panel && !compact();
  if (wide) head.append(grip());
  head.append(h('span', 'vc-ref', d.label), h('span', 'vc-ver muted', ` · ${d.version}`), h('span', 'grow'));
  if (!o.pinned) {
    if (!compact()) {
      const fl = button('icon-btn vc-pin vc-float', '', () => { closeSheet(); openCardPane(ref, d.label, tab, o.source, 'float'); }, 'float');
      fl.title = 'Float: keep it as a floating pane';
      fl.setAttribute('aria-label', 'Float');
      const tb = button('icon-btn vc-as-tab', '', () => { closeSheet(); openCardPane(ref, d.label, tab, o.source); }, 'sendto');
      tb.title = 'Open as a tab';
      tb.setAttribute('aria-label', 'Open as a tab');
      head.append(fl, tb);
    }
    const x = button('icon-btn vc-close', '', () => closeSheet(), 'x');
    x.title = 'Close';
    x.setAttribute('aria-label', 'Close');
    head.append(x);
  }
  if (wide) frameCard(o.panel!, head, true);
  body.append(head);
  body.append(drawVerses(d.verses.slice(0, MOST), false));
  if (d.verses.length > MOST) body.append(h('p', 'muted small', `and ${d.verses.length - MOST} more verses: Open the chapter shows them all`));
  const tabs = h('div', 'vc-tabs vc-seg');
  const panel = h('div', 'vc-panel');
  let tab: Tab = null;
  let inter: Promise<any> | null = null;
  const interOf = () => (inter ??= wb(['interlinear', ref]));
  const tabBtn = (t: Exclude<Tab, null>, label: string) => {
    const b = button(`btn small vc-tab vc-tab-${t}`, label, () => show(tab === t ? null : t));
    b.dataset.tab = t;
    return b;
  };
  const show = (t: Tab) => {
    tab = t;
    o.tabChanged?.(t);
    tabs.querySelectorAll<HTMLElement>('.vc-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    panel.replaceChildren();
    if (t === 'interlinear') void interlinear(panel, interOf, o.changed);
    else if (t === 'concordance') void strongs(panel, interOf, o.changed);
    else if (t === 'definitions') void definitions(panel, ref, o.changed);
    o.changed?.();
  };
  const first = d.verses[0];
  const chRef = `${first.code} ${first.c}:${first.v}`;
  tabs.append(
    tabBtn('interlinear', 'Interlinear'),
    tabBtn('concordance', 'In the Concordance'),
    tabBtn('definitions', 'Definitions'),
  );
  const foot = h('div', 'vc-foot');
  foot.append(
    // reading the chapter closes the card (a kept card stays, as a pane does)
    openSplit('Read the chapter', chRef, () => `${first.book} ${first.c}, at verse ${first.v}`, () => (d.version === 'KJV' ? undefined : d.version), 'vc-open', o.pinned ? undefined : () => closeSheet()),
  );
  body.append(tabs, panel, foot);
  // the pages whose text names this verse: one count line, never their text (W-5, 2bc9)
  void pagesLine(ref, 'verse').then(l => { if (l) { foot.before(l); o.changed?.(); } });
  if (o.tab) show(o.tab);
}

/** The card's Definitions (R5): the verse's words that Webster's 1913 has an entry for, each a button; a click shows the
 * entry, verbatim, with the dictionary's name and licence under it. Which sense fits the verse is the reader's to say. */
async function definitions(panel: HTMLElement, ref: string, changed?: () => void) {
  panel.append(h('p', 'muted small vc-defs', 'Looking the words up…'));
  const d = await wb(['word-define', '--verse', ref]).catch((x: unknown) => String((x as Error)?.message ?? x));
  panel.replaceChildren();
  if (typeof d === 'string') { panel.append(h('p', 'muted small vc-defs', d)); changed?.(); return; }
  const src = d.source;
  const credit = `${src.name}, ${src.edition}. ${src.licence}.`;
  const words: any[] = d.words.filter((w: any) => w.text);
  const wrap = h('div', 'vc-defs');
  if (!words.length) wrap.append(h('p', 'muted small', 'No word here has an entry.'));
  const row = h('div', 'vc-def-row');
  const entry = h('div', 'vc-def-entry');
  let open = '';
  for (const w of words) {
    const b = button('vc-def-word', w.word, () => {
      open = open === w.word ? '' : w.word;
      row.querySelectorAll<HTMLElement>('.vc-def-word').forEach(x => x.classList.toggle('on', x.textContent === open));
      entry.replaceChildren();
      if (open) {
        entry.append(
          h('div', 'label', w.headword === w.word.toLowerCase() ? w.word : `${w.word} · ${w.headword}`),
          h('p', 'vc-def-text', w.text),
          h('p', 'muted small vc-def-credit', credit),
        );
      }
      changed?.();
    });
    row.append(b);
  }
  if (words.length) wrap.append(h('p', 'muted small', `${words.length} words with an entry · ${credit}`), row, entry);
  panel.append(wrap);
  changed?.();
}

/** The card's interlinear: the words shown, each with − to put it away; the words put away as a row, in their order,
 * a click bringing one back; Show all and Put all away. Kept per verse on this computer. */
async function interlinear(panel: HTMLElement, data: () => Promise<any>, changed?: () => void) {
  panel.append(h('p', 'muted small', 'Reading the original words…'));
  const d = await data().catch(() => null);
  panel.replaceChildren();
  if (!d?.verses?.length) { panel.append(h('p', 'muted small', 'No original words here.')); return; }
  const rtl = d.lang === 'heb';
  for (const v of d.verses) {
    const key = `${d.book.code}.${v.c}:${v.v}`;
    const sec = h('div', 'vc-inter');
    sec.dataset.verse = key;
    const draw = () => {
      const away = putAwayOf(key);
      const n = v.words.length;
      sec.replaceChildren();
      if (d.verses.length > 1) sec.append(h('div', 'label', `${d.book.name} ${v.c}:${v.v}`));
      const bar = h('div', 'vc-inter-bar');
      bar.append(h('span', 'muted small vc-shown', `${n - away.size} of ${n} words shown`), h('span', 'grow'));
      bar.append(button('link-btn vc-show-all', `Show all ${n}`, () => { keepPutAway(key, new Set()); draw(); }));
      bar.append(button('link-btn vc-put-all', 'Put all away', () => { keepPutAway(key, new Set(v.words.map((_: any, i: number) => i))); draw(); }));
      sec.append(bar);
      const grid = h('div', 'inter-grid vc-grid');
      grid.dir = rtl ? 'rtl' : 'ltr';
      v.words.forEach((w: any, i: number) => {
        if (away.has(i)) return;
        const c = h('div', 'inter-card vc-word');
        c.dataset.i = String(i);
        const o = h('div', 'inter-orig', w.original);
        o.lang = rtl ? 'he' : 'grc';
        const s = button('inter-strong', w.strong || '', () => w.strong && openStrong(w.strong));
        const minus = button('vc-away', '−', () => { const a = putAwayOf(key); a.add(i); keepPutAway(key, a); draw(); });
        minus.title = 'Put this word away';
        minus.setAttribute('aria-label', `Put away “${w.gloss || w.translit || w.original}”`);
        c.append(minus, o, h('div', 'inter-translit', w.translit || ''), s, h('div', 'inter-gloss', w.gloss || ''));
        c.title = (w.parse || []).map((p: any) => p.text).join('; ');
        grid.append(c);
      });
      sec.append(grid);
      if (away.size) {
        sec.append(h('div', 'muted small vc-away-head', 'Put away · a click brings one back'));
        const row = h('div', 'vc-away-row');
        v.words.forEach((w: any, i: number) => {
          if (!away.has(i)) return;
          const b = button('chip vc-back', `${w.gloss || w.translit || w.original} +`, () => { const a = putAwayOf(key); a.delete(i); keepPutAway(key, a); draw(); });
          b.dataset.i = String(i);
          row.append(b);
        });
        sec.append(row);
      }
      changed?.();
    };
    draw();
    panel.append(sec);
  }
  if (d.more) panel.append(h('p', 'muted small', `${d.total} verses; the first ${d.verses.length} are shown.`));
  changed?.();
}

/** The card's Strong's: the verse's entries, in the order their words come, each opening its entry. */
async function strongs(panel: HTMLElement, data: () => Promise<any>, changed?: () => void) {
  panel.append(h('p', 'muted small', 'Reading the entries…'));
  const d = await data().catch(() => null);
  const nums: string[] = [];
  for (const v of d?.verses || []) for (const w of v.words) if (w.strong && !nums.includes(w.strong)) nums.push(w.strong);
  const rows = await Promise.all(nums.map(n => wb(['preview', n, '--json']).catch(() => null)));
  panel.replaceChildren();
  if (!nums.length) panel.append(h('p', 'muted small', 'No Strong’s numbers here.'));
  for (const e of rows) {
    if (!e) continue;
    const b = h('button', 'entry-row vc-strong');
    b.dataset.strong = e.strong;
    const top = h('div', 'entry-top');
    const l = h('span', 'lemma', e.lemma || '');
    l.lang = e.lang === 'grk' ? 'grc' : 'he';
    l.dir = e.lang === 'grk' ? 'ltr' : 'rtl';
    top.append(l, h('span', 'translit', e.translit || ''), h('span', 'muted small', ` ${e.strong}`));
    b.append(top);
    if (e.definition) b.append(h('p', 'small', e.definition));
    b.onclick = () => openStrong(e.strong);
    panel.append(b);
  }
  changed?.();
}

/** The `card` line (wb do "card Num 25:11 float"): the verse card itself, or as a floating pane, or as a tab. */
export async function openCardLine(ref: string, how: 'open' | 'float' | 'tab'): Promise<string> {
  const d: Marked | null = await wb(['scripture', ref]).catch(() => null);
  if (!d?.verses?.length) throw new Error(`Nothing found at ${ref}`);
  if (how === 'open') { await verseCard(ref, document.getElementById('reader') ?? document.body); return `The card for ${d.label}`; }
  openCardPane(ref, d.label, null, undefined, how === 'float' ? 'float' : 'left');
  return `${d.label} as a ${how === 'float' ? 'floating pane' : 'tab'}`;
}
