// Draws a chapter: one span per word (with its punctuation), one gap span per space between words, verse numbers, and
// the marks over them (highlight fills, thread underlines, note marks). The text itself is never changed.
import type { Chapter, Marks, Mark } from './api';
import { computeMarks, key } from './marks';

export interface Drawn {
  chapter: Chapter;
  marks: Marks;
  // Per drawn word k: its verse and word index, and its element.
  v: number[];
  i: number[];
  el: HTMLElement[];
  gap: (HTMLElement | null)[];   // the space after word k (null at the end of a verse)
  strong: (string | undefined)[];
}

const COLORS = new Set(['yellow', 'green', 'blue', 'pink', 'orange']);
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function draw(root: HTMLElement, chapter: Chapter, marks: Marks): Drawn {
  const out: string[] = [`<h1 class="ch-title">${esc(chapter.name)} ${chapter.chapter}</h1>`];
  if (chapter.title) out.push(`<p class="ch-sub">${esc(chapter.title)}</p>`);
  const v: number[] = [], i: number[] = [], strong: (string | undefined)[] = [];
  let k = 0;
  out.push('<p class="para">');
  for (const verse of chapter.verses) {
    verse.words.forEach((w, n) => {
      if (w.para && (w.para === 'p' || w.para === 'b') && k > 0) out.push('</p><p class="para">');
      else if (w.para && w.para.startsWith('q')) out.push(`<span class="q ${w.para}"></span>`);
      if (n === 0) out.push(`<span class="vn" data-v="${verse.v}">${verse.v}</span>`);
      const m = /^(\S*)(\s*)$/.exec(w.trail || '') || ['', w.trail || '', ''];
      const cls = 'w' + (w.italic ? ' it' : '') + (w.nd ? ' nd' : '') + (w.wj ? ' wj' : '');
      out.push(`<span class="${cls}" data-k="${k}">${esc((w.lead || '') + w.text + m[1])}</span>`);
      const last = n === verse.words.length - 1;
      out.push(last ? ' ' : `<span class="g" data-k="${k}">${esc(m[2] || ' ')}</span>`);
      v.push(verse.v); i.push(w.i); strong.push(w.strong); k++;
    });
  }
  out.push('</p>');
  root.innerHTML = out.join('');
  const el: HTMLElement[] = new Array(k), gap: (HTMLElement | null)[] = new Array(k).fill(null);
  root.querySelectorAll<HTMLElement>('.w').forEach(e => { el[+e.dataset.k!] = e; });
  root.querySelectorAll<HTMLElement>('.g').forEach(e => { gap[+e.dataset.k!] = e; });
  const d: Drawn = { chapter, marks, v, i, el, gap, strong };
  paint(root, d);
  return d;
}

const threadColor = (t: Mark) => (COLORS.has(t.color || '') ? `var(--thread-${t.color})` : t.color || 'var(--thread-a)');

// Puts the marks on the drawn words (again after a change, without redrawing the text).
export function paint(root: HTMLElement, d: Drawn) {
  const keys = d.v.map((v, n) => key(v, d.i[n]));
  const c = computeMarks(keys, d.marks, d.chapter.chapter, () => true);
  const n = keys.length;
  const look = (k: number) => {
    const hl = c.hl[k];
    const th = c.threads[k];
    return { hl, th: th ? th.map(threadColor) : [], note: c.noted[k] === 1 };
  };
  const apply = (e: HTMLElement, hl: string | undefined, th: string[], note: boolean) => {
    e.classList.toggle('hl', !!hl);
    e.style.backgroundColor = hl ? (COLORS.has(hl) ? `var(--hl-${hl})` : hl) : '';
    // Stacked thread underlines, one per shown thread, drawn as background lines in the span's bottom padding (padding on
    // an inline box widens its background without moving the text).
    e.style.backgroundImage = th.map(col => `linear-gradient(${col}, ${col})`).join(', ');
    e.style.backgroundPosition = th.map((_, j) => `0 calc(100% - ${j * 4}px)`).join(', ');
    e.style.paddingBottom = th.length ? `${th.length * 4}px` : '';
    e.classList.toggle('noted', note);
  };
  for (let k = 0; k < n; k++) {
    const a = look(k);
    apply(d.el[k], a.hl, a.th, a.note);
    const g = d.gap[k];
    if (g) {
      // A space takes a mark only when the words on both sides have it, so a fill or line runs unbroken through a phrase.
      const b = look(k + 1);
      const th = a.th.filter(x => b.th.includes(x));
      apply(g, a.hl && a.hl === b.hl ? a.hl : undefined, th, false);
    }
  }
  root.querySelectorAll<HTMLElement>('.vn').forEach(e => e.classList.toggle('vnote', c.verses.has(+e.dataset.v!)));
}

// The words of keys a..b, verbatim as the database has them, for copying.
export function textOf(d: Drawn, a: number, b: number): string {
  let s = '';
  for (let k = a; k <= b; k++) s += d.el[k].textContent + (k < b ? (d.gap[k]?.textContent ?? ' ') : '');
  return s.replace(/\s+/g, ' ').trim();
}

export function labelOf(d: Drawn, a: number, b: number): string {
  const name = `${d.chapter.name} ${d.chapter.chapter}`;
  return d.v[a] === d.v[b] ? `${name}:${d.v[a]}` : `${name}:${d.v[a]}–${d.v[b]}`;
}
