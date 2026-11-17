// Which words of a chapter each mark covers: the Python app's web/markrange.js, typed. A mark becomes a range of word
// keys once (binary search), so drawing costs about words + the words the marks cover.
import type { Mark, Marks } from './api';

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

export interface Computed {
  hl: (string | undefined)[];          // the color of the last highlight over each word
  threads: (Mark[] | undefined)[];     // shown threads over each word, a thread once
  noted: Uint8Array;                   // 1 when a note on words covers it
  pencil: Uint8Array;                  // 1 when the pencil's line runs under it (marks M14)
  verses: Set<number>;                 // verses a whole-verse note touches (a dot after the verse number)
  wide: number;                        // notes on the whole chapter or its book (a dot by the chapter's title, not on every verse)
}

// keys: the key of each drawn word, in reading order.
export function computeMarks(keys: number[], m: Marks, ch: number, shown: (id: string) => boolean): Computed {
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
  const hl: (string | undefined)[] = new Array(n), threads: (Mark[] | undefined)[] = new Array(n);
  const noted = new Uint8Array(n), pencil = new Uint8Array(n), verses = new Set<number>();
  const lastV = n ? Math.floor(keys[n - 1] / WIDE) : 0;
  let wide = 0;
  for (const h of m.highlights) each(h, k => { hl[k] = h.color; });
  for (const p of m.pencil || []) each(p, k => { pencil[k] = 1; });
  for (const t of m.threads) {
    if (!shown(t.id)) continue;
    each(t, k => { threads[k] = [...(threads[k] || []).filter(x => x.id !== t.id), t]; });
  }
  for (const nt of m.notes) {
    const s = nt.kind === 'verses' ? span(nt, ch) : null;
    if (s && s[0] <= key(1, 0) && s[1] >= key(lastV, WIDE - 1)) { wide++; continue; }
    const onWords = nt.kind === 'word' || nt.kind === 'phrase';
    each(nt, k => { if (onWords) noted[k] = 1; else verses.add(Math.floor(keys[k] / WIDE)); });
  }
  return { hl, threads, noted, pencil, verses, wide };
}
