// The layers over and around the words (design/features/marks, MK7-15, MK7-25, rows 42 and 49). A highlight is the words'
// own background (reader.ts), the layer beneath. Over it, in this order in the markup and so in the painting:
//   1. boxes and circles: a thin outline around the words, nothing inside it;
//   2. underlines: one line is the thickest, two and three are thinner, so a triple never looks heavy;
//   3. arrows: a curve in the left gutter, between the text and the window's edge, so it never crosses a word or the margin.
// The layers take no pointer: the words stay selectable and a click goes to the word. Nothing here fills a word. A layer
// is placed from where the words are, so it is placed again after a part is drawn and when the width changes.
import type { Drawn } from './reader';

/** The five names as a line's ink (a fill uses the highlight tokens; a thin line needs a stronger color to be seen). */
const INK: Record<string, string> = { yellow: '#c9a227', green: '#3f8f4a', blue: '#3b79c4', pink: '#cc4f8f', orange: '#d9822b' };
export const inkOf = (color: string) => INK[color] ?? color;

/** Line thickness in px by the number of lines: the more lines, the thinner each (MK7-15). */
export const THICKNESS: Record<number, number> = { 1: 2.5, 2: 1.5, 3: 1 };
const LINE_GAP = 1;
const MAX_BELOW = 5;   // px under the words a line may reach (the line height leaves 5 to 6 between two lines of words)
const SVG = 'http://www.w3.org/2000/svg';

interface Box { l: number; t: number; r: number; b: number }
const state = new WeakMap<HTMLElement, { d: Drawn; raf: number; ro?: ResizeObserver }>();

/** Asks for the layers to be placed (once per frame, however many parts and changes arrive). */
export function layout(root: HTMLElement, d: Drawn) {
  let st = state.get(root);
  if (!st) { st = { d, raf: 0 }; state.set(root, st); }
  st.d = d;
  const c = d.c;
  const any = c.shapes.length + c.lines.length + c.arrows.length > 0;
  if (!any && !root.querySelector(':scope > .mk-layers')) return;
  if (!st.ro && typeof ResizeObserver !== 'undefined') {
    let width = root.clientWidth;
    st.ro = new ResizeObserver(() => { if (root.clientWidth !== width) { width = root.clientWidth; layout(root, state.get(root)!.d); } });
    st.ro.observe(root);
  }
  if (!st.raf) st.raf = requestAnimationFrame(() => { st!.raf = 0; place(root, st!.d); });
}

function layers(root: HTMLElement): [HTMLElement, HTMLElement, SVGSVGElement] {
  let box = root.querySelector<HTMLElement>(':scope > .mk-layers');
  if (!box) {
    box = document.createElement('div');
    box.className = 'mk-layers';
    box.setAttribute('aria-hidden', 'true');
    const shapes = document.createElement('div'), lines = document.createElement('div');
    shapes.className = 'mk-layer mk-shapes'; shapes.dataset.layer = 'shapes';
    lines.className = 'mk-layer mk-lines'; lines.dataset.layer = 'underlines';
    const arrows = document.createElementNS(SVG, 'svg');
    arrows.setAttribute('class', 'mk-layer mk-arrows'); arrows.setAttribute('data-layer', 'arrows');
    box.append(shapes, lines, arrows);
    root.prepend(box);
  }
  return [box.children[0] as HTMLElement, box.children[1] as HTMLElement, box.children[2] as SVGSVGElement];
}

function place(root: HTMLElement, d: Drawn) {
  const c = d.c;
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  const base = root.getBoundingClientRect();
  // reads first, one pass; the layers are written after, so the page is laid out once
  const cache = new Map<number, Box[]>();
  const of = (k: number): Box[] => {
    let r = cache.get(k);
    if (!r) {
      r = [];
      const e = d.el[k];
      if (e) for (const x of Array.from(e.getClientRects())) if (x.width > 0) r.push({ l: x.left - base.left, t: x.top - base.top, r: x.right - base.left, b: x.bottom - base.top });
      cache.set(k, r);
    }
    return r;
  };
  // the words a..b as one box per line
  const lines = (a: number, b: number): Box[] => {
    const out: Box[] = [];
    for (let k = a; k <= b; k++) {
      for (const x of of(k)) {
        const last = out[out.length - 1];
        if (last && Math.abs(x.t - last.t) < (x.b - x.t) / 2) { last.l = Math.min(last.l, x.l); last.r = Math.max(last.r, x.r); last.t = Math.min(last.t, x.t); last.b = Math.max(last.b, x.b); }
        else out.push({ ...x });
      }
    }
    return out;
  };
  const depth = new Uint8Array(d.v.length), used = new Float32Array(d.v.length);
  const shapes = c.shapes.map(s => {
    let nest = 0;
    for (let k = s.a; k <= s.b; k++) nest = Math.max(nest, depth[k]);
    for (let k = s.a; k <= s.b; k++) depth[k] = nest + 1;
    return { s, rs: lines(s.a, s.b), nest: Math.min(nest, 2) };   // at most 5px out: the outline stays between the lines, off the next line's words
  });
  const under = c.lines.map(u => {
    const n = Math.min(3, Math.max(1, u.m.lines || 1));
    let off = 0.5;
    for (let k = u.a; k <= u.b; k++) off = Math.max(off, used[k]);
    const th = THICKNESS[n], high = n * th + (n - 1) * LINE_GAP;
    // stacked underlines go one below another but never lower than the gap between two lines of text: the rest share a place
    off = Math.max(0.5, Math.min(off, MAX_BELOW - high));
    for (let k = u.a; k <= u.b; k++) used[k] = off + high + LINE_GAP;
    return { u, n, th, off, rs: lines(u.a, u.b) };
  });
  const yOf = (v: number): number | null => {
    const vn = root.querySelector<HTMLElement>(`.vn[data-v="${v}"]`);
    const r = vn ? vn.getBoundingClientRect() : d.el[d.v.indexOf(v)]?.getBoundingClientRect();
    return r ? (r.top + r.bottom) / 2 - base.top : null;
  };
  const pad = parseFloat(getComputedStyle(root).paddingLeft) || 0;
  const x0 = Math.max(pad - 3, 6);
  const ends = c.arrows.map(a => ({ a, y1: yOf(a.from), y2: yOf(a.to) }));
  const arrows: { a: (typeof ends)[number]['a']; y1: number; y2: number }[] = [];
  for (const e of ends) if (e.y1 !== null && e.y2 !== null && Math.abs(e.y1 - e.y2) > 2) arrows.push({ a: e.a, y1: e.y1, y2: e.y2 });
  // lanes: an arrow beside another that covers some of the same height takes the next lane in
  const lanes: [number, number][][] = [];
  const laned = arrows.map(x => {
    const lo = Math.min(x.y1, x.y2), hi = Math.max(x.y1, x.y2);
    let j = 0;
    while (lanes[j]?.some(([p, q]) => lo < q && hi > p)) j++;
    (lanes[j] ||= []).push([lo, hi]);
    return { ...x, lane: Math.min(j, 3) };
  });

  const [sh, ul, ar] = layers(root);
  sh.replaceChildren(); ul.replaceChildren(); ar.replaceChildren();
  for (const { s, rs, nest } of shapes) {
    const grow = 2 + nest * 1.5;
    rs.forEach((r, i) => {
      const e = document.createElement('div');
      e.className = `mk-shape mk-${s.m.kind}`;
      e.dataset.mark = s.m.id; e.dataset.kind = s.m.kind;
      e.style.cssText = `left:${r.l - grow}px;top:${r.t - grow + 1}px;width:${r.r - r.l + grow * 2}px;height:${r.b - r.t + grow * 2 - 2}px;border-color:${inkOf(s.m.color)};`;
      if (s.m.kind === 'box') {
        if (i > 0) e.style.borderLeftWidth = '0';
        if (i < rs.length - 1) e.style.borderRightWidth = '0';
      }
      sh.append(e);
    });
  }
  for (const { u, n, th, off, rs } of under) {
    for (const r of rs) {
      for (let j = 0; j < n; j++) {
        const e = document.createElement('div');
        e.className = 'mk-line';
        e.dataset.mark = u.m.id; e.dataset.kind = 'underline'; e.dataset.lines = String(n);
        e.style.cssText = `left:${r.l}px;top:${r.b + off + j * (th + LINE_GAP)}px;width:${r.r - r.l}px;height:${th}px;background:${inkOf(u.m.color)};`;
        ul.append(e);
      }
    }
  }
  ar.setAttribute('width', '1'); ar.setAttribute('height', '1');
  for (const { a, y1, y2, lane } of laned) {
    const xb = Math.max(1.5, x0 - 5 - lane * 3.5), col = inkOf(a.m.color);
    const g = document.createElementNS(SVG, 'g');
    g.setAttribute('class', 'mk-arrow'); g.setAttribute('data-mark', a.m.id); g.setAttribute('data-kind', 'arrow');
    const curve = document.createElementNS(SVG, 'path');
    curve.setAttribute('d', `M ${x0} ${y1} C ${xb} ${y1}, ${xb} ${y2}, ${x0 - 5} ${y2}`);
    const head = document.createElementNS(SVG, 'path');
    head.setAttribute('d', `M ${x0} ${y2} L ${x0 - 5.5} ${y2 - 3} L ${x0 - 5.5} ${y2 + 3} Z`);
    const dot = document.createElementNS(SVG, 'circle');
    dot.setAttribute('cx', String(x0)); dot.setAttribute('cy', String(y1)); dot.setAttribute('r', '1.6');
    curve.setAttribute('fill', 'none'); curve.setAttribute('stroke', col); curve.setAttribute('stroke-width', '1.25');
    head.setAttribute('fill', col); dot.setAttribute('fill', col);
    const title = document.createElementNS(SVG, 'title');
    title.textContent = a.m.legend || '';
    g.append(title, curve, head, dot);
    ar.append(g);
  }
}
