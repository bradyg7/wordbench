// Draws a chapter: one span per word (with its punctuation), verse numbers, and the marks over them (highlight fills,
// then boxes and circles, underlines and arrows in their own layers, folder tabs by the verse numbers), put straight into the markup. A space gets its own span only when it carries a mark,
// so a fill or a line runs unbroken through a phrase. The text itself is never changed.
//
// Long chapters are drawn in parts: the blocks up to the place being opened plus about a screen more at once, the rest
// added in small steps after the first frame (appending below never moves what is on screen).
import type { Chapter, Marks, Mark } from './api';
import { computeMarks, key, parseAt, span, type Computed } from './marks';
import type { DrawnMark } from './api';
import { layers } from './layers';

export interface Drawn {
  chapter: Chapter;
  marks: Marks;
  // Per word k of the chapter: verse, word index, Strong's number, the text shown, the space after it, its element.
  v: number[];
  i: number[];
  strong: (string | undefined)[];
  text: string[];
  gapText: string[];
  el: HTMLElement[];             // filled as parts are drawn
  gap: (HTMLElement | null)[];   // the space after word k, when it has a span
  c: Computed;
  /** Puts the box, circle, underline and arrow layers where the words are now (after a part is drawn or the width changes). */
  layout: () => void;
  /** Verses with an open question: a ? on the verse number. */
  questions: Set<number>;
  more: () => boolean;           // draws the next part; false when the chapter is complete
}

import { hlStyle } from './hlink';
import { panel } from './markpanel';
import { layout as layOut } from './markdraw';
const COLORS = new Set(['yellow', 'green', 'blue', 'pink', 'orange']);
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const threadColor = (t: Mark) => (COLORS.has(t.color || '') ? `var(--thread-${t.color})` : t.color || 'var(--thread-a)');
const AHEAD = 350;   // words drawn past the place before the first frame
const STEP = 500;    // words per later part

// Where drawing time goes (read by open() for the budgets).
export const drawTimes = { html_ms: 0, refs_ms: 0, first_words: 0 };

interface Look { hl?: string; names: string[]; note: boolean }

function look(c: Computed, k: number): Look {
  // the hover names the legend entry of every mark over the word (row 47)
  return { hl: c.hl[k], names: c.said[k] || [], note: c.noted[k] === 1 };
}

function gapLook(c: Computed, k: number, n: number): Look {
  if (k + 1 >= n) return { names: [], note: false };
  const a = look(c, k), b = look(c, k + 1);
  return { hl: a.hl && a.hl === b.hl ? a.hl : undefined, names: a.names, note: false };
}

const marked = (m: Look) => !!m.hl || m.note;

// A highlight is the span's background color (the layer beneath the words); the other kinds are drawn over it by
// markdraw.ts, in their own layers, and never change the words.
function styleOf(m: Look, gap = false): string {
  return m.hl ? hlStyle(m.hl, gap) : '';
}

function apply(e: HTMLElement, m: Look, gap = false) {
  e.classList.toggle('hl', !!m.hl);
  e.classList.toggle('noted', m.note);
  e.style.cssText = styleOf(m, gap);
  if (!gap) { if (m.names.length) e.title = m.names.join(', '); else e.removeAttribute('title'); }
}

// A whole verse saved in a shown folder with a color: its color in the verse number's margin mark, the words untouched.
function marginStyle(c: Computed, v: number): string {
  const at = c.margin.get(v);
  if (!at) return '';
  return at.slice(0, 2).map((t, j) => `${threadColor(t)} ${-3 - j * 4}px 0 0 0`).join(',');
}
const marginTitle = (c: Computed, v: number) => (c.margin.get(v) || []).map(t => c.names[t.id] || '').join(', ');

// The marks the layers let through: no highlights when they are hidden, and only the threads shown.
function compute(keys: number[], m: Marks, ch: number): Computed {
  const off = m.hidden || [];
  // Reading mode shows only the text: no mark and no folder tab. A kind or an entry switched off hides its marks only.
  return computeMarks(keys, m, ch, id => layers.all && !panel.reading && !off.includes(id),
    x => panel.shows(x) && (x.kind !== 'highlight' || layers.highlightsShown()));
}

/** The marks drawn on word k (a highlight, underline, circle or box that is shown), in the order the reader holds them (oldest first). Arrows are in the gutter and never on a word. */
export function marksOnWord(d: Drawn, k: number): DrawnMark[] {
  if (!layers.all || panel.reading) return [];
  const off = d.marks.hidden || [], at = key(d.v[k], d.i[k]);
  return (d.marks.marks || []).filter(x => {
    if (x.kind === 'arrow' || off.includes(x.id) || !panel.shows(x) || (x.kind === 'highlight' && !layers.highlightsShown())) return false;
    const a = parseAt(x.at), s = a && span(a, d.chapter.chapter);
    return !!s && at >= s[0] && at <= s[1];
  });
}

export function draw(root: HTMLElement, chapter: Chapter, marks: Marks, untilVerse = 1, questions = new Set<number>()): Drawn {
  const t0 = performance.now();
  const v: number[] = [], i: number[] = [], strong: (string | undefined)[] = [], text: string[] = [], gapText: string[] = [];
  const wordsAt: { para?: string; first: boolean; last: boolean; cls: string }[] = [];
  for (const verse of chapter.verses) {
    verse.words.forEach((w, n) => {
      const m = /^(\S*)(\s*)$/.exec(w.trail || '') || ['', w.trail || '', ''];
      const last = n === verse.words.length - 1;
      v.push(verse.v); i.push(w.i); strong.push(w.strong);
      text.push((w.lead || '') + w.text + m[1]);
      gapText.push(last ? ' ' : m[2] || ' ');
      wordsAt.push({ para: w.para, first: n === 0, last, cls: 'w' + (w.italic ? ' it' : '') + (w.nd ? ' nd' : '') + (w.wj ? ' wj' : '') });
    });
  }
  const n = v.length;
  // Marks are read through `now`, so parts drawn after a change (paint) use the new marks.
  const now = { c: compute(v.map((vv, k) => key(vv, i[k])), marks, chapter.chapter) };
  const el: HTMLElement[] = new Array(n), gap: (HTMLElement | null)[] = new Array(n).fill(null);

  // The markup of words from..to-1, ending at a block boundary at or after `want` words.
  let next = 0;
  const part = (want: number): string => {
    const out: string[] = [];
    if (next === 0) {
      out.push(`<h1 class="ch-title${now.c.wide ? ' wide-note' : ''}" title="${now.c.wide ? 'A note on this chapter or its book (the Notebook, grouped by chapter)' : ''}">${esc(chapter.name)} ${chapter.chapter}</h1>`);
      if (chapter.title) out.push(`<p class="ch-sub">${esc(chapter.title)}</p>`);
      if (chapter.version) out.push(`<p class="ch-version">${esc(chapter.version)} · marks on whole verses are shown here; words are selected in the KJV</p>`);
    }
    let open = false;
    for (let k = next; k < n; k++) {
      const w = wordsAt[k], p = w.para || '';
      const starts = p === 'p' || p === 'b' || p.startsWith('q') || k === 0;
      if (starts) {
        if (open && k - next >= want) { next = k; out.push('</p>'); return out.join(''); }
        if (open) out.push('</p>');
        out.push(p.startsWith('q') ? `<p class="line ${p}">` : '<p class="para">');
        open = true;
      } else if (!open) {
        out.push('<p class="para">');   // a part that starts mid-paragraph cannot happen (parts end at blocks), but be safe
        open = true;
      }
      const c = now.c;
      if (w.first) out.push(`<span class="vn${c.verses.has(v[k]) ? ' vnote' : ''}${questions.has(v[k]) ? ' vq' : ''}${c.margin.has(v[k]) ? ' vth' : ''}" data-v="${v[k]}"${c.margin.has(v[k]) ? ` style="box-shadow:${marginStyle(c, v[k])}" title="${esc(marginTitle(c, v[k]))}"` : ''}>${v[k]}</span>`);
      const m = look(c, k);
      out.push(`<span class="${w.cls}${m.hl ? ' hl' : ''}${m.note ? ' noted' : ''}" data-k="${k}"${m.names.length ? ` title="${esc(m.names.join(', '))}"` : ''}${marked(m) ? ` style="${styleOf(m)}"` : ''}>${esc(text[k])}</span>`);
      const g = gapLook(c, k, n);
      out.push(!w.last && marked(g) ? `<span class="g" data-k="${k}" style="${styleOf(g, true)}">${esc(gapText[k])}</span>` : esc(gapText[k]));
    }
    next = n;
    if (open) out.push('</p>');
    return out.join('');
  };
  const refs = (scope: ParentNode) => {
    scope.querySelectorAll<HTMLElement>('.w').forEach(e => { el[+e.dataset.k!] = e; });
    scope.querySelectorAll<HTMLElement>('.g').forEach(e => { gap[+e.dataset.k!] = e; });
  };

  const target = Math.max(0, v.indexOf(untilVerse));
  root.innerHTML = part(target + AHEAD);
  const t1 = performance.now();
  refs(root);
  Object.assign(drawTimes, { html_ms: t1 - t0, refs_ms: performance.now() - t1, first_words: next });

  const d: Drawn = {
    chapter, marks, v, i, strong, text, gapText, el, gap, questions,
    layout: () => layOut(root, d),
    get c() { return now.c; },
    set c(x) { now.c = x; },
    more: () => {
      if (next >= n) return false;
      const t = document.createElement('template');
      t.innerHTML = part(STEP);
      refs(t.content);
      root.append(t.content);
      d.layout();
      return next < n;
    },
  };
  d.layout();
  return d;
}

// Puts the marks on the drawn words again after a change (a new highlight), without redrawing the text.
export function paint(root: HTMLElement, d: Drawn) {
  const n = d.v.length;
  d.c = compute(d.v.map((vv, k) => key(vv, d.i[k])), d.marks, d.chapter.chapter);
  for (let k = 0; k < n; k++) {
    const e = d.el[k];
    if (!e) continue;
    apply(e, look(d.c, k));
    const g = gapLook(d.c, k, n);
    let ge = d.gap[k];
    if (!ge && marked(g) && e.nextSibling?.nodeType === Node.TEXT_NODE && !(e.nextSibling as Text).data.trim() && d.v[k + 1] === d.v[k]) {
      // A space that now carries a mark gets its span.
      ge = document.createElement('span');
      ge.className = 'g';
      ge.dataset.k = String(k);
      e.nextSibling.replaceWith(ge);
      ge.textContent = d.gapText[k];
      d.gap[k] = ge;
    }
    if (ge) apply(ge, g, true);
  }
  root.querySelector('.ch-title')?.classList.toggle('wide-note', d.c.wide > 0);
  root.querySelectorAll<HTMLElement>('.vn').forEach(e => {
    e.classList.toggle('vnote', d.c.verses.has(+e.dataset.v!));
    e.classList.toggle('vq', d.questions.has(+e.dataset.v!));
    const v = +e.dataset.v!;
    e.classList.toggle('vth', d.c.margin.has(v));
    e.style.boxShadow = marginStyle(d.c, v);
    if (d.c.margin.has(v)) e.title = marginTitle(d.c, v); else e.removeAttribute('title');
  });
  d.layout();
}

// The words of keys a..b, verbatim as the database has them, for copying.
export function textOf(d: Drawn, a: number, b: number): string {
  let s = '';
  for (let k = a; k <= b; k++) s += d.text[k] + (k < b ? d.gapText[k] : '');
  return s.replace(/\s+/g, ' ').trim();
}

export function labelOf(d: Drawn, a: number, b: number): string {
  const name = `${d.chapter.name} ${d.chapter.chapter}`;
  return d.v[a] === d.v[b] ? `${name}:${d.v[a]}` : `${name}:${d.v[a]}–${d.v[b]}`;
}
