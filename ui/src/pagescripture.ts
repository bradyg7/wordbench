// Scripture in a page, drawn word by word with the person's marks on the words (notebook design rows 11, 39, 40; NB8).
// A scripture block's verses come from `wb page scripture` with their `parts` (the words, each with its index in the chapter, and what
// lies between them). Each chapter's marks are the reader's (`wb marks`): the same list, drawn by the same code (reader.ts `compute`,
// markdraw.ts layers), so a mark made here is the mark the reader shows, and the other way round. Words are spans (`.w`, with the
// book, chapter, verse and index) so a selection in the page can be turned into the place a mark or a margin note is made on.
// Nothing is written here.
import { wb, type Marks } from './api';
import type { Drawn } from './reader';
import { compute } from './reader';
import { layout } from './markdraw';
import { hlStyle } from './hlink';
import { h } from './ui';
import type { MarkedVerse } from './verses';

export interface Part { t: string; i?: number }
export type PageVerse = MarkedVerse & { parts?: Part[] };

/** Every verse of the block can be drawn word by word (a version without KJV word positions has no parts). */
export const hasWords = (verses: PageVerse[]) => verses.length > 0 && verses.every(v => Array.isArray(v.parts) && v.parts.some(p => p.i !== undefined));

interface Chapter { code: string; c: number; root: HTMLElement; marks: Marks; words: HTMLElement[]; v: number[]; i: number[]; gaps: { el: HTMLElement; before: number }[] }

const chapters = new WeakMap<HTMLElement, Chapter[]>();   // by the block's `.sv-text`

const emptyMarks = (): Marks => ({ highlights: [], notes: [], threads: [], thread_names: {}, marks: [] });

/** The marks of each chapter a block names (`wb marks <book> <chapter>`), each asked for once. */
export async function chapterMarks(verses: { code: string; c: number }[]): Promise<Map<string, Marks>> {
  const out = new Map<string, Marks>();
  const keys = [...new Set(verses.map(v => `${v.code} ${v.c}`))];
  await Promise.all(keys.map(async k => { try { out.set(k, (await wb(['marks', k])) as Marks); } catch { out.set(k, emptyMarks()); } }));
  return out;
}

/** The verses as words: a paragraph (or a line a verse) of verses, every word a span, the marks of each chapter on them. */
export function drawWords(verses: PageVerse[], lines: boolean, marks: Map<string, Marks>, onVerse?: (v: PageVerse, el: HTMLElement, e: MouseEvent | KeyboardEvent) => void): HTMLElement {
  const box = h('div', `sv-text sv-words ${lines ? 'sv-lines' : 'sv-para'}`);
  const several = new Set(verses.map(v => `${v.code}.${v.c}`)).size > 1;
  const made: Chapter[] = [];
  let p: HTMLElement | null = null;
  let chap: Chapter | null = null;
  let root: HTMLElement = box;
  let lastKey = '';
  for (const v of verses) {
    const k = `${v.code}.${v.c}`;
    if (k !== lastKey) {
      lastKey = k;
      p = null;
      // one chapter keeps its paragraphs in the box; with several each has a part of its own (its marks are placed within it)
      if (several) { root = h('div', 'sv-chap'); box.append(root); } else root = box;
      chap = { code: v.code, c: v.c, root, marks: marks.get(`${v.code} ${v.c}`) ?? emptyMarks(), words: [], v: [], i: [], gaps: [] };
      made.push(chap);
    }
    if (lines || !p) { p = h('p', 'scripture sv-p'); root.append(p); } else p.append(' ');
    const verse = h('span', 'sv-verse');
    verse.dataset.ref = v.ref;
    const vn = h('span', 'sv-vn', several ? `${v.c}:${v.v}` : String(v.v));
    if (onVerse) {
      vn.setAttribute('role', 'button');
      vn.tabIndex = 0;
      vn.title = `The card for ${v.ref}`;
      vn.style.cursor = 'pointer';
      vn.onclick = e => { e.stopPropagation(); onVerse(v, vn, e); };
      vn.onkeydown = e => { if (e.key === 'Enter' || e.key === 'Space' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onVerse(v, vn, e); } };
    }
    verse.append(vn);
    const t = h('span', 'sv-t');
    for (const part of v.parts ?? []) {
      if (part.i === undefined) {
        const g = h('span', 'g', part.t);
        chap!.gaps.push({ el: g, before: chap!.words.length });
        t.append(g);
      } else {
        const w = h('span', 'w', part.t);
        w.dataset.code = v.code; w.dataset.c = String(v.c); w.dataset.v = String(v.v); w.dataset.i = String(part.i);
        chap!.words.push(w); chap!.v.push(v.v); chap!.i.push(part.i);
        t.append(w);
      }
    }
    verse.append(t);
    p.append(verse);
  }
  chapters.set(box, made);
  for (const c of made) paint(c);
  return box;
}

/** Put a chapter's marks on its words: highlights as the words' own background, the other kinds in the layers over them. */
function paint(c: Chapter) {
  const keys = c.v.map((v, k) => v * 65536 + c.i[k]);
  const comp = compute(keys, c.marks, c.c);
  comp.arrows = [];                       // an arrow is drawn in the reader's gutter
  const hl = (k: number) => comp.hl[k];
  c.words.forEach((w, k) => {
    const color = hl(k);
    w.classList.toggle('hl', !!color);
    w.style.cssText = color ? hlStyle(color) : '';
    const names = comp.said[k];
    if (names?.length) w.title = names.join(', '); else w.removeAttribute('title');
  });
  for (const g of c.gaps) {
    // the space between two words of one verse keeps a highlight both have, so it runs on unbroken
    const a = g.before - 1, b = g.before;
    const same = a >= 0 && b < c.words.length && c.v[a] === c.v[b] && hl(a) && hl(a) === hl(b);
    g.el.classList.toggle('hl', !!same);
    g.el.style.cssText = same ? hlStyle(hl(a)!, true) : '';
  }
  const d = { c: comp, el: c.words, v: c.v, i: c.i } as unknown as Drawn;
  layout(c.root, d);
}

/** Draw one more mark (as `wb mark add` answered it) on the block's words, and the chapter's list keeps it. */
export function addMark(box: HTMLElement, made: any) {
  const m = /^[A-Z0-9]+\.(\d+):/.exec(made?.at || '');
  if (!m) return;
  for (const c of chapters.get(box) ?? []) {
    if (c.c !== Number(m[1])) continue;
    const style = made.style || (made.kind === 'underline' ? `underline:${made.color}:${made.lines ?? 1}` : `${made.kind}:${made.color}`);
    (c.marks.marks ||= []).push({ ...made, legend: made.legend || `Unnamed ${made.color} ${made.kind}`, style });
    paint(c);
  }
}

/** Every scripture block of the page that draws this chapter, drawn again with a mark that was just made. */
export function addMarkEverywhere(made: any) {
  document.querySelectorAll<HTMLElement>('.sv-words').forEach(box => addMark(box, made));
}

/** What a selection inside a scripture block stands for: the words' first and last place, and the verses they lie in. */
export interface Picked { code: string; from: { c: number; v: number; i: number }; to: { c: number; v: number; i: number }; box: HTMLElement; text: string }

export function pickedWords(range: Range): Picked | null {
  const node = range.commonAncestorContainer;
  const el = node instanceof HTMLElement ? node : node.parentElement;
  const box = el?.closest<HTMLElement>('.sv-words') ?? null;
  if (!box) return null;
  const hit = Array.from(box.querySelectorAll<HTMLElement>('.w')).filter(w => {
    const r = document.createRange();
    r.selectNodeContents(w);
    return range.compareBoundaryPoints(Range.END_TO_START, r) < 0 && range.compareBoundaryPoints(Range.START_TO_END, r) > 0;
  });
  if (!hit.length) return null;
  const at = (w: HTMLElement) => ({ c: Number(w.dataset.c), v: Number(w.dataset.v), i: Number(w.dataset.i) });
  const first = hit[0], last = hit[hit.length - 1];
  if (first.dataset.code !== last.dataset.code) return null;
  return { code: first.dataset.code!, from: at(first), to: at(last), box, text: hit.map(w => w.textContent).join(' ') };
}

/** The anchor `wb mark add` takes for picked words (NUM.25:11.3-25:11.9, or one word NUM.25:11.3). */
export function anchorOf(p: Picked): string {
  const a = `${p.code}.${p.from.c}:${p.from.v}.${p.from.i}`;
  return p.from.c === p.to.c && p.from.v === p.to.v && p.from.i === p.to.i ? a : `${a}-${p.to.c}:${p.to.v}.${p.to.i}`;
}
