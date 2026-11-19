// Which words of a chapter each mark covers: the Python app's web/markrange.js, typed. A mark becomes a range of word
// keys once (binary search), so drawing costs about words + the words the marks cover.
import type { DrawnMark, Mark, Marks } from './api';

const WIDE = 65536;
export const key = (v: number, i: number) => v * WIDE + i;

function span(a: Mark, ch: number): [number, number] | null {
  switch (a.kind) {
    case 'word': return a.c1 === ch ? [key(a.v1, a.i1!), key(a.v1, a.i1!)] : null;
    case 'verse': return a.c1 === ch ? [key(a.v1, 0), key(a.v1, WIDE - 1)] : null;
    case 'phrase':
      if (ch < a.c1 || ch > a.c2!) return null;
      return [ch === a.c1 ? key(a.v1, a.i1!) : -1, ch === a.c2 ? key(a.v2!, a.i2!) : Infinity];
    case 'verses':
      if (ch < a.c1 || ch > a.c2!) return null;
      return [ch === a.c1 ? key(a.v1, 0) : -1, ch === a.c2 ? key(a.v2!, WIDE - 1) : Infinity];
    default: return null;
  }
}

/** An anchor as the core writes it (NUM.25:11, NUM.25:11.3, NUM.25:11-25:12, NUM.25:11.3-25:11.9) as the coordinates `span` reads. */
export function parseAt(at: string): Mark | null {
  const m = /^([A-Z0-9]{3})\.(\d+):(\d+)(?:\.(\d+))?(?:-(\d+):(\d+)(?:\.(\d+))?)?$/.exec(at.trim());
  if (!m) return null;
  const [c1, v1] = [+m[2], +m[3]], i1 = m[4] === undefined ? null : +m[4];
  const two = m[5] !== undefined;
  const [c2, v2] = two ? [+m[5], +m[6]] : [null, null], i2 = two && m[7] !== undefined ? +m[7] : null;
  const kind = two ? (i1 !== null ? 'phrase' : 'verses') : (i1 !== null ? 'word' : 'verse');
  return { kind, code: m[1], c1, v1, i1, c2, v2, i2, id: '' };
}

/** A mark's words as indexes into the chapter's words: a..b, both drawn words (or nothing). */
export interface Run { m: DrawnMark; a: number; b: number }
export interface ArrowRun { m: DrawnMark; from: number; to: number }   // the two verses

export interface Computed {
  hl: (string | undefined)[];          // the color of the last highlight over each word
  said: (string[] | undefined)[];      // the legend names of the shown marks over each word, topmost first (the hover)
  shapes: Run[];                       // boxes and circles, oldest first
  lines: Run[];                        // underlines, oldest first
  arrows: ArrowRun[];                  // arrows within this chapter
  margin: Map<number, Mark[]>;         // shown folders' places, by verse: a tab in the gutter beside the number, never on the words (MK7-7, TH-7)
  names: Record<string, string>;       // folder id -> name, for what a hover lists
  noted: Uint8Array;                   // 1 when a note on words covers it
  verses: Set<number>;                 // verses a whole-verse note touches (a dot after the verse number)
  wide: number;                        // notes on the whole chapter or its book (a dot by the chapter's title, not on every verse)
}

// keys: the key of each drawn word, in reading order.
export function computeMarks(keys: number[], m: Marks, ch: number, shown: (id: string) => boolean, drawn: (x: DrawnMark) => boolean = () => true): Computed {
  const n = keys.length;
  const bound = (x: number, strict: boolean) => {
    let lo = 0, hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (strict ? keys[mid] <= x : keys[mid] < x) lo = mid + 1; else hi = mid;
    }
    return lo;
  };
  const each = (a: Mark, fn: (k: number) => void) => {
    const s = span(a, ch);
    if (!s) return;
    for (let p = bound(s[0], false), end = bound(s[1], true); p < end; p++) fn(p);
  };
  const margin = new Map<number, Mark[]>();
  const hl: (string | undefined)[] = new Array(n), said: (string[] | undefined)[] = new Array(n);
  const shapes: Run[] = [], lines: Run[] = [], arrows: ArrowRun[] = [];
  const noted = new Uint8Array(n), verses = new Set<number>();
  const lastV = n ? Math.floor(keys[n - 1] / WIDE) : 0;
  let wide = 0;
  // The marks, oldest first (the core's order); a later mark's names come first in the hover, a later highlight wins the fill.
  for (const x of m.marks || []) {
    if (!drawn(x)) continue;
    const at = parseAt(x.at);
    if (!at) continue;
    if (x.kind === 'arrow') {
      const to = x.to ? parseAt(x.to) : null;
      if (to && at.c1 === ch && to.c1 === ch) arrows.push({ m: x, from: at.v1, to: to.v1 });
      continue;
    }
    const s = span(at, ch);
    if (!s) continue;
    const a = bound(s[0], false), b = bound(s[1], true) - 1;
    if (a > b) continue;
    for (let p = a; p <= b; p++) {
      if (x.kind === 'highlight') hl[p] = x.color;
      if (x.legend) said[p] = [x.legend, ...(said[p] || []).filter(l => l !== x.legend)];
    }
    if (x.kind === 'underline') lines.push({ m: x, a, b });
    else if (x.kind !== 'highlight') shapes.push({ m: x, a, b });
  }
  // A folder's color is never drawn on the words (MK7-7, MK7-15): a tab beside the verse number, once per folder and verse.
  for (const t of m.threads) {
    if (!shown(t.id)) continue;
    let last = -1;
    each(t, k => {
      const v = Math.floor(keys[k] / WIDE);
      if (v === last) return;
      last = v;
      const at = margin.get(v) || [];
      if (!at.some(x => x.id === t.id)) margin.set(v, [...at, t]);
    });
  }
  for (const nt of m.notes) {
    const s = nt.kind === 'verses' ? span(nt, ch) : null;
    if (s && s[0] <= key(1, 0) && s[1] >= key(lastV, WIDE - 1)) { wide++; continue; }
    const onWords = nt.kind === 'word' || nt.kind === 'phrase';
    each(nt, k => { if (onWords) noted[k] = 1; else verses.add(Math.floor(keys[k] / WIDE)); });
  }
  return { hl, said, shapes, lines, arrows, margin, names: m.thread_names || {}, noted, verses, wide };
}
