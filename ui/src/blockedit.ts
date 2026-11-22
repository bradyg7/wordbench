// The in-place block editor (Notebook NB2b, decided 2026-11-21). One block is one contenteditable element. What the
// block is (heading, bullet, numbered, to-do, quote) is the element's shape, drawn by CSS as the block it makes; **bold**,
// *italic* and <u>underline</u> are real <strong>, <em> and <u> elements, so text is styled as it is typed. The file form
// is still the Markdown wb-core reads and writes: `value` is that Markdown, built from the elements, and loading a
// block's Markdown builds the elements back. A block whose Markdown would not come back identical is drawn as plain
// characters (a fence, a ####, anything unusual) so that opening and leaving a block never changes its file.
//
// The element also answers like a text box (`value`, `selectionStart`, `selectionEnd`, `setSelectionRange`,
// `setRangeText`, `placeholder`, `disabled`), in Markdown offsets, so the /, [[ link and format-bar code that was written
// for a text box keeps working on it.

import { COLORS, attrOf, isColor, type ColorKind } from './palette';

export type Writer = HTMLElement & Pick<HTMLTextAreaElement, 'value' | 'selectionStart' | 'selectionEnd' | 'setSelectionRange' | 'setRangeText' | 'placeholder' | 'disabled'>;

interface St { shape: string; lead: string; mark: string; num: number; delim: string; box: string; rel: string }
const states = new WeakMap<HTMLElement, St>();
const NL = String.fromCharCode(10);
const ZW = '\u200b';
const LISTY = new Set(['bullet', 'todo', 'numbered']);
const blankState = (): St => ({ shape: '', lead: '', mark: '-', num: 1, delim: '.', box: ' ', rel: '' });
const clean = (s: string) => s.replace(/\u200b/g, '').replace(/\u00a0/g, ' ');

export const shapeOf = (ed: HTMLElement) => (states.get(ed) ?? blankState()).shape;

function prefixOf(s: St): string {
  switch (s.shape) {
    case 'h1': return '# ';
    case 'h2': return '## ';
    case 'h3': return '### ';
    case 'bullet': return `${s.lead}${s.mark} `;
    case 'todo': return `${s.lead}${s.mark} [${s.box}] `;
    case 'numbered': return `${s.lead}${s.num}${s.delim} `;
    case 'quote': return '> ';
    case 'callout': return `> ${s.mark} `;
    default: return '';
  }
}
const contOf = (s: St) => (s.shape === 'quote' || s.shape === 'callout' ? '> ' : LISTY.has(s.shape) ? s.lead + s.rel : '');

/** A callout's marker as written (`[!question]`, `[!done]`, `[!key]`, `[!note]`, with Obsidian's + or - after it) → its kind's word. */
const CALLOUT_WORDS = ['question', 'done', 'key', 'note'];
export const calloutWord = (mark: string) => /^\[!([A-Za-z]+)\]/.exec(mark)?.[1].toLowerCase() ?? '';

function marksOf(el: Element): [string, string] {
  // a mark with nothing inside (the caret's place after Ctrl+B in an empty box) writes nothing
  if (clean(el.textContent || '') === '') return ['', ''];
  switch (el.tagName) {
    case 'STRONG': case 'B': return ['**', '**'];
    case 'EM': case 'I': { const d = (el as HTMLElement).dataset.d || '*'; return [d, d]; }
    case 'U': return ['<u>', '</u>'];
    case 'S': case 'STRIKE': case 'DEL': return ['~~', '~~'];
    case 'SPAN': {
      const d = (el as HTMLElement).dataset;
      if (d.c && isColor(d.c)) return [`<span data-c="${d.c}">`, '</span>'];
      if (d.bg && isColor(d.bg)) return [`<span data-bg="${d.bg}">`, '</span>'];
      return ['', ''];
    }
    default: return ['', ''];
  }
}

// ---- Markdown to elements -------------------------------------------------------------------------------------------

function parseMd(md: string): { st: St; lines: string[] } {
  const lines = md.split(NL);
  const st = blankState();
  const plain = { st: blankState(), lines };
  const l0 = lines[0];
  const rest = (lead: string): string[] | null => {
    const more = lines.slice(1);
    if (!more.length) return [];
    const ws = /^[ \t]*/.exec(more[0])![0];
    if (!ws.startsWith(lead) || !more.every(l => /^[ \t]*/.exec(l)![0] === ws)) return null;
    st.rel = ws.slice(lead.length);
    return more.map(l => l.slice(ws.length));
  };
  let m: RegExpExecArray | null;
  if ((m = /^(#{1,3}) (.*)$/.exec(l0))) {
    if (lines.length > 1) return plain;
    st.shape = `h${m[1].length}`;
    return { st, lines: [m[2]] };
  }
  if ((m = /^(\s*)([-*+]) \[([ xX])\] (.*)$/.exec(l0))) {
    st.shape = 'todo'; st.lead = m[1]; st.mark = m[2]; st.box = m[3];
    const more = rest(st.lead);
    return more ? { st, lines: [m[4], ...more] } : plain;
  }
  if ((m = /^(\s*)([-*+]) (.*)$/.exec(l0))) {
    st.shape = 'bullet'; st.lead = m[1]; st.mark = m[2];
    const more = rest(st.lead);
    return more ? { st, lines: [m[3], ...more] } : plain;
  }
  if ((m = /^(\s*)(\d+)([.)]) (.*)$/.exec(l0))) {
    st.shape = 'numbered'; st.lead = m[1]; st.num = Number(m[2]); st.delim = m[3];
    const more = rest(st.lead);
    return more ? { st, lines: [m[4], ...more] } : plain;
  }
  // a callout (rows 22-24, 46): `> [!kind] first line`, more lines `> …`, a nested list `>   - …`
  if ((m = /^> (\[![A-Za-z]+\][+-]?)(?: (.*))?$/.exec(l0)) && CALLOUT_WORDS.includes(calloutWord(m[1])) && lines.slice(1).every(l => /^> /.test(l))) {
    st.shape = 'callout'; st.mark = m[1];
    return { st, lines: [m[2] ?? '', ...lines.slice(1).map(l => l.slice(2))] };
  }
  if (/^> /.test(l0) && lines.every(l => /^> /.test(l))) { st.shape = 'quote'; return { st, lines: lines.map(l => l.slice(2)) }; }
  return plain;
}

/** **bold**, *italic*, _italic_, <u>underline</u>, ~~strike~~ and a color's <span data-c="red"> as elements, each holding
 *  what is inside it the same way; the rest stays text (the same marks the page draws). */
function inlineNodes(s: string, marks: boolean): Node[] {
  if (!marks) return s ? [document.createTextNode(s)] : [];
  const out: Node[] = [];
  const names = COLORS.join('|');
  const re = new RegExp(`\\*\\*([^*]+)\\*\\*|\\*([^*\\s][^*]*)\\*|_([^_\\s][^_]*)_|<u>((?:(?!</u>)[^])+)</u>|~~([^~]+)~~|<span data-(c|bg)="(${names})">`, 'g');
  let at = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    let end = m.index + m[0].length;
    let el: HTMLElement;
    let inner: string;
    if (m[6]) {
      // a color span: its end is the </span> that balances it
      const tags = /<span\b[^>]*>|<\/span>/g;
      tags.lastIndex = end;
      let depth = 1, t: RegExpExecArray | null, close = -1;
      while ((t = tags.exec(s))) { depth += t[0] === '</span>' ? -1 : 1; if (!depth) { close = t.index; break; } }
      if (close < 0) continue;
      inner = s.slice(end, close);
      el = document.createElement('span');
      el.dataset[m[6] === 'c' ? 'c' : 'bg'] = m[7];
      end = close + '</span>'.length;
      re.lastIndex = end;
    } else {
      el = document.createElement(m[1] ? 'strong' : m[4] ? 'u' : m[5] ? 's' : 'em');
      inner = (m[1] ?? m[4] ?? m[5] ?? m[2] ?? m[3])!;
      if (m[2] !== undefined || m[3] !== undefined) el.dataset.d = m[2] !== undefined ? '*' : '_';
    }
    if (m.index > at) out.push(document.createTextNode(s.slice(at, m.index)));
    // a color holds marks of its own; a mark holds plain text unless a color is inside it
    el.append(...(m[6] || inner.includes('<span data-') ? inlineNodes(inner, true) : [document.createTextNode(inner)]));
    out.push(el);
    at = end;
  }
  if (at < s.length) out.push(document.createTextNode(s.slice(at)));
  return out;
}

function fill(ed: HTMLElement, lines: string[], marks: boolean) {
  ed.replaceChildren();
  lines.forEach((l, i) => {
    if (i) ed.append(document.createElement('br'));
    ed.append(...inlineNodes(l, marks));
  });
  // a last empty line needs its own mark: one break at the very end is only the box's placeholder
  if (lines.length > 1 && lines[lines.length - 1] === '') ed.append(document.createElement('br'));
}

function sync(ed: HTMLElement) {
  const st = states.get(ed) ?? blankState();
  ed.dataset.shape = st.shape;
  ed.dataset.num = String(st.num);
  ed.dataset.checked = st.shape === 'todo' && st.box !== ' ' ? 'true' : 'false';
  if (st.shape === 'callout') ed.dataset.kind = calloutWord(st.mark); else delete ed.dataset.kind;
  ed.style.setProperty('--lead', String(Math.min(st.lead.length, 24)));
}

/** Show a block's Markdown: its shape and marks as elements; plain characters when that would not read back the same. */
function load(ed: HTMLElement, md: string) {
  const { st, lines } = parseMd(md);
  states.set(ed, st);
  fill(ed, lines, true);
  if (layout(ed).md !== md) {
    states.set(ed, blankState());
    fill(ed, md.split(NL), false);
  }
  sync(ed);
}

// ---- elements to Markdown, with where each piece is -----------------------------------------------------------------

interface Layout { md: string; start: Map<Node, number>; end: Map<Element, number>; texts: Text[]; at: number }

function layout(ed: HTMLElement): Layout {
  const st = states.get(ed) ?? blankState();
  const cont = contOf(st);
  let out = prefixOf(st);
  const L: Layout = { md: '', start: new Map(), end: new Map(), texts: [], at: out.length };
  const walk = (n: Node, root: boolean) => {
    for (const c of Array.from(n.childNodes)) {
      L.start.set(c, out.length);
      if (c.nodeType === 3) { L.texts.push(c as Text); out += clean((c as Text).data); continue; }
      if (!(c instanceof HTMLElement)) continue;
      if (c.tagName === 'BR') { if (!(root && c === n.lastChild)) out += NL + cont; continue; }
      const [open, close] = marksOf(c);
      out += open;
      walk(c, false);
      L.end.set(c, out.length);
      out += close;
    }
  };
  walk(ed, true);
  L.end.set(ed, out.length);
  L.md = out;
  return L;
}

/** The Markdown of what is inside `node` alone (a half of a split block), with the continuation lines of this shape. */
function inlineMd(node: Node, cont: string): string {
  let out = '';
  const walk = (n: Node, root: boolean) => {
    for (const c of Array.from(n.childNodes)) {
      if (c.nodeType === 3) { out += clean((c as Text).data); continue; }
      if (!(c instanceof HTMLElement)) continue;
      if (c.tagName === 'BR') { if (!(root && c === n.lastChild)) out += NL + cont; continue; }
      const [open, close] = marksOf(c);
      out += open; walk(c, false); out += close;
    }
  };
  walk(node, true);
  return out;
}

const selectionRange = (ed: HTMLElement): Range | null => {
  const s = ed.ownerDocument.getSelection();
  if (!s || !s.rangeCount) return null;
  const r = s.getRangeAt(0);
  return ed.contains(r.startContainer) && ed.contains(r.endContainer) ? r : null;
};

function mdAt(L: Layout, ed: HTMLElement, node: Node, off: number): number {
  if (node.nodeType === 3) return (L.start.get(node) ?? L.md.length) + clean((node as Text).data.slice(0, off)).length;
  const kids = node.childNodes;
  if (off < kids.length) return L.start.get(kids[off]) ?? L.md.length;
  return node === ed ? L.md.length : L.end.get(node as Element) ?? L.md.length;
}

function domAt(L: Layout, ed: HTMLElement, i: number): [Node, number] {
  const into = (t: Text, k: number): [Node, number] => {
    let seen = 0, d = 0;
    const s = t.data;
    while (d < s.length && seen < k) { if (clean(s[d]) !== '') seen++; d++; }
    if (k === 0) while (d < s.length && s[d] === ZW) d++;
    return [t, d];
  };
  for (const t of L.texts) {
    const s = L.start.get(t)!, len = clean(t.data).length;
    if (i >= s && i <= s + len) return into(t, i - s);
  }
  const next = L.texts.find(t => L.start.get(t)! >= i);
  if (next) return into(next, 0);
  const last = L.texts[L.texts.length - 1];
  return last ? into(last, clean(last.data).length) : [ed, 0];
}

// ---- the element ---------------------------------------------------------------------------------------------------

export function createEditor(md: string): Writer {
  const ed = document.createElement('div') as unknown as Writer;
  ed.className = 'nb-input nb-block-input';
  ed.contentEditable = 'true';
  ed.spellcheck = true;
  ed.setAttribute('role', 'textbox');
  ed.setAttribute('aria-multiline', 'true');
  ed.setAttribute('aria-label', 'The block’s text');
  Object.defineProperties(ed, {
    value: { configurable: true, get: () => layout(ed).md, set: (v: string) => load(ed, v) },
    selectionStart: { configurable: true, get: () => { const r = selectionRange(ed); const L = layout(ed); return r ? mdAt(L, ed, r.startContainer, r.startOffset) : L.md.length; } },
    selectionEnd: { configurable: true, get: () => { const r = selectionRange(ed); const L = layout(ed); return r ? mdAt(L, ed, r.endContainer, r.endOffset) : L.md.length; } },
    placeholder: { configurable: true, get: () => ed.dataset.placeholder || '', set: (v: string) => { ed.dataset.placeholder = v; } },
    disabled: { configurable: true, get: () => ed.contentEditable !== 'true', set: (v: boolean) => { ed.contentEditable = v ? 'false' : 'true'; } },
    setSelectionRange: {
      configurable: true,
      value: (a: number, b: number) => {
        const L = layout(ed);
        const s = ed.ownerDocument.getSelection();
        if (!s) return;
        if (ed.ownerDocument.activeElement !== ed) ed.focus({ preventScroll: true });
        const r = ed.ownerDocument.createRange();
        const [n1, o1] = domAt(L, ed, a);
        const [n2, o2] = domAt(L, ed, b);
        r.setStart(n1, o1);
        r.setEnd(n2, o2);
        s.removeAllRanges();
        s.addRange(r);
      },
    },
    setRangeText: {
      configurable: true,
      value: (text: string, s: number, e: number, mode?: string) => {
        const v = ed.value;
        ed.value = v.slice(0, s) + text + v.slice(e);
        const at = mode === 'select' ? s : s + text.length;
        ed.setSelectionRange(at, mode === 'select' ? s + text.length : at);
      },
    },
  });
  load(ed, md);
  return ed;
}

/** Where the writing starts (after the shape's mark) and ends, in Markdown offsets. */
export const contentStart = (ed: HTMLElement) => prefixOf(states.get(ed) ?? blankState()).length;
/** Nothing typed in the block besides its shape. */
export const isEmpty = (ed: HTMLElement) => layout(ed).md.length === contentStart(ed);
/** Is the caret (collapsed) at the start of what is written, or at its end? */
export function caretAt(ed: Writer): { start: boolean; end: boolean; collapsed: boolean } {
  const a = ed.selectionStart, b = ed.selectionEnd;
  return { start: a === b && a <= contentStart(ed), end: a === b && b >= ed.value.length, collapsed: a === b };
}

/** After an edit: a box with nothing in it is truly empty (so its hint shows), and elements the browser added are unwrapped. */
export function tidy(ed: HTMLElement) {
  const foreign = ed.querySelector('span:not([data-c]):not([data-bg]):not([data-ref]), font, div, p, a, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, code, pre, table, img');
  if (foreign) {
    const w = ed as Writer;
    const r = selectionRange(ed);
    const L = layout(ed);
    const a = r ? mdAt(L, ed, r.startContainer, r.startOffset) : -1, b = r ? mdAt(L, ed, r.endContainer, r.endOffset) : -1;
    const blocky = /^(DIV|P|H[1-6]|LI|BLOCKQUOTE|PRE|TABLE)$/;
    for (const el of Array.from(ed.querySelectorAll('span:not([data-c]):not([data-bg]):not([data-ref]), font, div, p, a, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, code, pre, table, img'))) {
      if (!el.isConnected) continue;
      if (blocky.test(el.tagName) && el.previousSibling) el.before(document.createElement('br'));
      el.replaceWith(...Array.from(el.childNodes));
    }
    for (const el of Array.from(ed.querySelectorAll('*'))) {
      if (el instanceof HTMLElement && el.tagName !== 'BR') { el.removeAttribute('style'); el.removeAttribute('class'); }
    }
    ed.normalize();
    if (r) w.setSelectionRange(a, b);
  }
  // nothing typed (the browser may leave an empty <strong> or a break behind): the box is truly empty, so its hint shows and
  // the next words are not caught in a mark that held nothing
  if (clean(ed.textContent || '') === '' && ed.querySelectorAll('br').length <= 1) {
    if (ed.firstChild) ed.replaceChildren();
    letGoOfStyle(ed);
  }
}

/** The browser keeps the bold, italic or underline of text that was deleted for what is typed next (WebKit and Chromium
 *  both do, after select-all and delete). An empty box starts plain; Ctrl+B in it afterwards turns it on again. */
function letGoOfStyle(ed: HTMLElement) {
  const doc = ed.ownerDocument;
  if (doc.activeElement !== ed) return;
  for (const cmd of ['bold', 'italic', 'underline']) {
    try { if (doc.queryCommandState(cmd)) doc.execCommand(cmd); } catch { /* a browser without the query */ }
  }
}

// ---- what typing does ------------------------------------------------------------------------------------------------

/** What was typed, and what it was turned into: Ctrl+Z gives the typed characters back. */
export type Turn = { kind: 'line'; typed: string; to: string } | { kind: 'inline'; typed: string; el: HTMLElement } | null;

export function setShape(ed: HTMLElement, shape: string, over: Partial<St> = {}) {
  const st = { ...(states.get(ed) ?? blankState()), ...over, shape };
  if (!LISTY.has(shape)) { st.lead = ''; st.rel = ''; }
  if (shape === 'callout' && !CALLOUT_WORDS.includes(calloutWord(st.mark))) st.mark = '[!question]';
  states.set(ed, st);
  sync(ed);
}

/** `# `, `- `, `1. `, `> `, `[] ` typed at the start of a block turn it into that block at once. */
export function lineStartShortcut(ed: Writer): Turn {
  const st = states.get(ed) ?? blankState();
  if (st.shape !== '' && st.shape !== 'bullet') return null;
  const r = selectionRange(ed);
  if (!r || !r.collapsed) return null;
  const L = layout(ed);
  const caret = mdAt(L, ed, r.startContainer, r.startOffset);
  const pl = prefixOf(st).length;
  const before = L.md.slice(pl, caret);
  let m: RegExpExecArray | null;
  let to: [string, Partial<St>] | null = null;
  if ((m = /^\[( ?)\] $/.exec(before))) to = ['todo', { mark: st.shape === 'bullet' ? st.mark : '-', box: ' ' }];
  else if (st.shape === '') {
    if ((m = /^(#{1,3}) $/.exec(before))) to = [`h${m[1].length}`, {}];
    else if ((m = /^([-*+]) $/.exec(before))) to = ['bullet', { mark: m[1] }];
    else if ((m = /^(\d{1,9})([.)]) $/.exec(before))) to = ['numbered', { num: Number(m[1]), delim: m[2] }];
    else if (/^> $/.test(before)) to = ['quote', {}];
  }
  if (!to) return null;
  // the characters typed go out of the text, the block takes their shape
  const [n1, o1] = domAt(L, ed, pl);
  const cut = document.createRange();
  cut.setStart(n1, o1);
  cut.setEnd(r.startContainer, r.startOffset);
  cut.deleteContents();
  setShape(ed, to[0], to[1]);
  ed.setSelectionRange(contentStart(ed), contentStart(ed));
  return { kind: 'line', typed: before, to: layout(ed).md };
}

/** `**word**`, `*word*`, `_word_` and `<u>word</u>`: when the closing mark is typed, the words are styled in place. */
export function inlineShortcut(ed: Writer, data: string | null): Turn {
  if (!data || !/[*_>~]/.test(data)) return null;
  const r = selectionRange(ed);
  if (!r || !r.collapsed || r.startContainer.nodeType !== 3) return null;
  const t = r.startContainer as Text, off = r.startOffset;
  const before = t.data.slice(0, off);
  const tries: [RegExp, string, string | null][] = [
    [/\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, 'strong', null],
    [/(?<!\*)\*([^*\s](?:[^*]*[^*\s])?)\*$/, 'em', '*'],
    [/(?<![\w_])_([^_\s](?:[^_]*[^_\s])?)_$/, 'em', '_'],
    [/<u>([^<]+)<\/u>$/, 'u', null],
    [/~~([^~\s](?:[^~]*[^~\s])?)~~$/, 's', null],
  ];
  for (const [re, tag, d] of tries) {
    const m = re.exec(before);
    if (!m) continue;
    const el = document.createElement(tag);
    el.textContent = m[1];
    if (d) el.dataset.d = d;
    const after = document.createTextNode(ZW + t.data.slice(off));
    t.data = before.slice(0, m.index);
    t.after(el, after);
    const s = ed.ownerDocument.getSelection()!;
    const nr = ed.ownerDocument.createRange();
    nr.setStart(after, 1);
    nr.collapse(true);
    s.removeAllRanges();
    s.addRange(nr);
    return { kind: 'inline', typed: m[0], el };
  }
  return null;
}

/** Ctrl+Z straight after a shortcut: the typed characters come back. */
export function undoTurn(ed: Writer, turn: NonNullable<Turn>): boolean {
  if (turn.kind === 'line') {
    if (layout(ed).md !== turn.to) return false;
    const body = layout(ed).md.slice(contentStart(ed));
    setShape(ed, '');
    ed.value = turn.typed + body;
    ed.setSelectionRange(turn.typed.length, turn.typed.length);
    return true;
  }
  if (!turn.el.isConnected) return false;
  const t = document.createTextNode(turn.typed);
  turn.el.replaceWith(t);
  const nr = document.createRange();
  nr.setStart(t, t.data.length);
  nr.collapse(true);
  const s = ed.ownerDocument.getSelection()!;
  s.removeAllRanges();
  s.addRange(nr);
  return true;
}

/** Ctrl+B, Ctrl+I, Ctrl+U: on the words selected, or on the words typed next. */
export function toggleMark(ed: HTMLElement, key: 'b' | 'i' | 'u' | 's') {
  const doc = ed.ownerDocument;
  const cmd = key === 'b' ? 'bold' : key === 'i' ? 'italic' : key === 's' ? 'strikeThrough' : 'underline';
  const was = doc.queryCommandState(cmd);
  doc.execCommand(cmd);
  // WebKit does not turn a style on in a box with no text: the mark is put in by hand, and the words typed go inside it
  if (doc.queryCommandState(cmd) !== was || clean(ed.textContent || '') !== '') return;
  const sel = doc.getSelection();
  if (!sel || !sel.rangeCount || !ed.contains(sel.anchorNode)) return;
  const el = doc.createElement(key === 'b' ? 'strong' : key === 'i' ? 'em' : key === 's' ? 's' : 'u');
  const t = doc.createTextNode(ZW);
  el.append(t);
  ed.replaceChildren(el);
  const r = doc.createRange();
  r.setStart(t, 1);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** The color the words at the start of `range` carry, of one kind (null: Default). */
export function colorAt(ed: HTMLElement, range: Range, kind: ColorKind): string | null {
  let n: Node | null = range.startContainer;
  const attr = attrOf(kind).replace('data-', '');
  while (n && n !== ed) {
    if (n instanceof HTMLElement && n.tagName === 'SPAN' && n.dataset[attr] && isColor(n.dataset[attr]!)) return n.dataset[attr]!;
    n = n.parentNode;
  }
  return null;
}

/** Put a color (`null`: Default) of one kind on the words of `range`, inside the block `ed`; returns the range of those words.
 *  The words keep their other marks; an earlier color of the same kind on them (or around them) is replaced. */
export function applyColor(ed: HTMLElement, range: Range, kind: ColorKind, name: string | null): Range | null {
  if (range.collapsed || !ed.contains(range.startContainer) || !ed.contains(range.endContainer)) return null;
  const attr = attrOf(kind).replace('data-', '');
  const same = (el: Element) => el instanceof HTMLElement && el.tagName === 'SPAN' && !!el.dataset[attr];
  const doc = ed.ownerDocument;
  const frag = range.extractContents();
  for (const sp of Array.from(frag.querySelectorAll('span')).filter(same)) sp.replaceWith(...Array.from(sp.childNodes));
  // the words were inside a span of this color: it is split around the place they leave, so what is put back is not inside it
  let host: HTMLElement | null = null;
  for (let n: Node | null = range.startContainer; n && n !== ed; n = n.parentNode) if (same(n as Element)) host = n as HTMLElement;
  if (host) {
    const tail = doc.createRange();
    tail.setStart(range.startContainer, range.startOffset);
    tail.setEnd(host, host.childNodes.length);
    const rest = host.cloneNode(false) as HTMLElement;
    rest.append(tail.extractContents());
    host.after(rest);
    range.setStartAfter(host);
    range.collapse(true);
  }
  let first: Node | null, last: Node | null;
  if (name) {
    const sp = doc.createElement('span');
    sp.dataset[attr] = name;
    sp.append(frag);
    first = last = sp;
    range.insertNode(sp);
  } else {
    first = frag.firstChild; last = frag.lastChild;
    range.insertNode(frag);
  }
  for (const el of Array.from(ed.querySelectorAll('span'))) if (same(el) && clean(el.textContent || '') === '') el.remove();
  const out = doc.createRange();
  if (first && last && first.isConnected && last.isConnected) { out.setStartBefore(first); out.setEndAfter(last); } else out.collapse(true);
  return out;
}

/** Tab and Shift+Tab on a list item: its indent, two spaces in or out. False when the block is not a list item. */
export function indentList(ed: Writer, out: boolean): boolean {
  const st = states.get(ed);
  if (st?.shape === 'callout') return indentCalloutLine(ed, out);
  if (!st || !LISTY.has(st.shape)) return false;
  const a = ed.selectionStart, b = ed.selectionEnd;
  const was = st.lead.length;
  const lead = out ? st.lead.slice(Math.min(2, st.lead.length)) : '  ' + st.lead;
  states.set(ed, { ...st, lead });
  sync(ed);
  const shift = lead.length - was;
  ed.setSelectionRange(Math.max(contentStart(ed), a + shift), Math.max(contentStart(ed), b + shift));
  return true;
}

/** Where the line holding Markdown offset `at` starts and ends in a callout, and where its words start (after the `> ` of a later line,
 *  after the marker of the first). */
function calloutLine(ed: Writer, at: number) {
  const v = ed.value;
  const from = v.lastIndexOf(NL, at - 1) + 1;
  const to = v.indexOf(NL, at) < 0 ? v.length : v.indexOf(NL, at);
  const body = from === 0 ? contentStart(ed) : from + 2;
  return { v, from, to, body: Math.min(body, to) };
}

const LIST_LINE = /^(\s*)([-*+]|\d+[.)]) ?(.*)$/;

/** Tab and Shift+Tab on a list line inside a callout: the line goes two spaces in or out (a nested list). False on any other line. */
function indentCalloutLine(ed: Writer, out: boolean): boolean {
  const a = ed.selectionStart, b = ed.selectionEnd;
  const { v, to, body } = calloutLine(ed, a);
  const line = v.slice(body, to);
  if (!/^\s*([-*+]|\d+[.)]) /.test(line)) return false;
  if (out && !line.startsWith(' ')) return true;
  const shift = out ? -Math.min(2, /^ */.exec(line)![0].length) : 2;
  ed.value = out ? v.slice(0, body) + line.slice(-shift) + v.slice(to) : v.slice(0, body) + '  ' + line + v.slice(to);
  ed.setSelectionRange(Math.max(body, a + shift), Math.max(body, b + shift));
  return true;
}

/** Enter inside a callout (rows 22, 46): a new line in the same callout, and a list line goes on as a list (a nested one at its indent);
 *  Enter on a list line with nothing in it steps the list out one level, then leaves it. 'exit': Enter on an empty last line, which is
 *  taken out so the block can end (the next block opens below). False when the block is not a callout. */
export function calloutEnter(ed: Writer): boolean | 'exit' {
  if (shapeOf(ed) !== 'callout') return false;
  const a = ed.selectionStart, b = ed.selectionEnd;
  const { v, from, to, body } = calloutLine(ed, a);
  const line = v.slice(body, to);
  const m = LIST_LINE.exec(line);
  if (a === b && line === '' && to === v.length && from > 0) {
    ed.value = v.slice(0, from - 1);
    ed.setSelectionRange(ed.value.length, ed.value.length);
    return 'exit';
  }
  if (a === b && m && /^\s*([-*+]|\d+[.)])\s*$/.test(line) && a === to) {
    // an empty item: one level out, or the list is left (the line is empty)
    const nl = m[1].length >= 2 ? m[1].slice(2) + m[2] + ' ' : '';
    ed.value = v.slice(0, body) + nl + v.slice(to);
    ed.setSelectionRange(body + nl.length, body + nl.length);
    return true;
  }
  let next = NL + '> ';
  if (m && m[3] !== '') {
    const n = /^\d+/.exec(m![2]);
    next += m![1] + (n ? `${Number(n[0]) + 1}${m![2].slice(-1)}` : m![2]) + ' ';
  }
  ed.setRangeText(next, a, b);
  return true;
}

/** The block's shape goes (a list is left, a heading is a plain line again); its words stay. */
export function clearShape(ed: Writer) {
  const body = ed.value.slice(contentStart(ed));
  const at = Math.max(0, ed.selectionStart - contentStart(ed));
  setShape(ed, '');
  ed.value = body;
  ed.setSelectionRange(at, at);
}

/** A line break inside the block (Shift+Enter): in a quote the next line is quoted too. */
export function insertBreak(ed: HTMLElement) {
  const r = selectionRange(ed);
  if (!r) return;
  // the browser's own line break keeps its caret and its placeholder break right
  if (ed.ownerDocument.execCommand('insertLineBreak')) return;
  r.deleteContents();
  const br = document.createElement('br');
  r.insertNode(br);
  if (br === ed.lastChild || (br.parentNode !== ed && br.parentNode?.lastChild === br && br.parentNode.parentNode === ed)) br.after(document.createElement('br'));
  const nr = document.createRange();
  nr.setStartAfter(br);
  nr.collapse(true);
  const s = ed.ownerDocument.getSelection()!;
  s.removeAllRanges();
  s.addRange(nr);
}

/** Text pasted or dropped in is plain text, never someone else's styling. */
export function insertPlain(ed: HTMLElement, text: string) {
  const r = selectionRange(ed);
  if (!r) return;
  r.deleteContents();
  const lines = text.replace(/\r\n?/g, NL).split(NL);
  let last: Node | null = null;
  lines.forEach((l, i) => {
    if (i) { const br = document.createElement('br'); r.insertNode(br); r.setStartAfter(br); last = br; }
    if (l) { const t = document.createTextNode(l); r.insertNode(t); r.setStartAfter(t); last = t; }
  });
  if (last) {
    r.setStartAfter(last);
    r.collapse(true);
    const s = ed.ownerDocument.getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
  }
}

/** Enter in the middle of a block: what is before the caret stays, what follows goes to a new block (with the list's
 *  mark, if this is a list). Null when there is nothing to split off. */
export function splitAtCaret(ed: Writer): { first: string; rest: string } | null {
  const r = selectionRange(ed);
  if (!r) return null;
  if (!r.collapsed) r.deleteContents();
  const st = states.get(ed) ?? blankState();
  const cont = contOf(st);
  const before = ed.ownerDocument.createRange();
  before.setStart(ed, 0);
  before.setEnd(r.startContainer, r.startOffset);
  const after = ed.ownerDocument.createRange();
  after.setStart(r.startContainer, r.startOffset);
  after.setEnd(ed, ed.childNodes.length);
  const tmp = (rg: Range) => { const d = document.createElement('div'); d.append(rg.cloneContents()); return inlineMd(d, cont); };
  const first = prefixOf(st) + tmp(before);
  const rest = tmp(after);
  return { first, rest };
}

/** The markers a new block after this one starts with, from this block's Markdown (a list goes on as a list). */
export function continuation(ed: HTMLElement): string {
  const st = states.get(ed) ?? blankState();
  if (st.shape === 'bullet') return `${st.lead}${st.mark} `;
  if (st.shape === 'todo') return `${st.lead}${st.mark} [ ] `;
  if (st.shape === 'numbered') return `${st.lead}${st.num + 1}${st.delim} `;
  return '';
}

/** Is the caret on the block's first line, or its last? (↑ and ↓ cross to the next block from there.) */
export function caretLine(ed: Writer): { first: boolean; last: boolean } {
  const r = selectionRange(ed);
  const c = caretAt(ed);
  if (!r) return { first: c.start, last: c.end };
  const probe = r.cloneRange();
  probe.collapse(true);
  let rect: DOMRect | undefined = probe.getClientRects()[0];
  if (!rect || !rect.height) {
    // after a line break the browser may give no box for the caret; the offsets decide
    return { first: !ed.value.slice(0, ed.selectionStart).includes(NL), last: !ed.value.slice(ed.selectionEnd).includes(NL) };
  }
  const box = ed.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(ed).lineHeight) || rect.height;
  return { first: rect.top - box.top < lh * 0.75, last: box.bottom - rect.bottom < lh * 0.75 };
}

/** A block's Markdown as another kind (Turn into): the words and their marks stay, only the shape changes. */
export function turnedMd(md: string, shape: string, over: Partial<{ mark: string; box: string; num: number; delim: string }> = {}): string {
  const ed = createEditor(md);
  setShape(ed, shape, over);
  return ed.value;
}

// ---- references drawn as chips while the block is written (notebook row 12, NB5) ------------------------------------------
// A reference in the text is wrapped in <span class="nb-chip" data-ref="…">: the words inside are ordinary, editable text (the caret
// moves through them, typing and Backspace work as anywhere), so the chip is only how they are drawn. It adds nothing to the
// Markdown (`marksOf` writes nothing for it): the file keeps the plain reference. `refs` come from wb-core (`wb refs --plain`), the
// same finder the page uses when the block is left, in the Markdown's offsets.

export interface ChipRef { start: number; end: number; ref: string }

/** Draw exactly `refs` as chips: a chip that no longer matches one is unwrapped, a reference with none is wrapped (when it sits in one
 *  piece of text, not across a bold or a color). The caret stays where it was, in Markdown offsets. */
export function chipRefs(ed: Writer, refs: ChipRef[]) {
  const doc = ed.ownerDocument;
  const L0 = layout(ed);
  const want = new Map(refs.map(r => [`${r.start}:${r.end}`, r]));
  const chips = Array.from(ed.querySelectorAll<HTMLElement>('span[data-ref]'));
  const keep = new Set<string>();
  let todo = false;
  for (const c of chips) {
    const key = `${L0.start.get(c)}:${L0.end.get(c)}`;
    if (want.has(key) && c.dataset.ref === want.get(key)!.ref && !keep.has(key)) keep.add(key); else { todo = true; }
  }
  for (const k of want.keys()) if (!keep.has(k)) todo = true;
  if (!todo) return;
  const focused = doc.activeElement === ed;
  const r0 = focused ? selectionRange(ed) : null;
  const a = r0 ? mdAt(L0, ed, r0.startContainer, r0.startOffset) : -1, b = r0 ? mdAt(L0, ed, r0.endContainer, r0.endOffset) : -1;
  const seen = new Set<string>();
  for (const c of chips) {
    const key = `${L0.start.get(c)}:${L0.end.get(c)}`;
    if (keep.has(key) && !seen.has(key) && c.dataset.ref === want.get(key)!.ref) { seen.add(key); continue; }
    c.replaceWith(...Array.from(c.childNodes));
  }
  ed.normalize();
  for (const r of [...refs].sort((x, y) => y.start - x.start)) {
    if (keep.has(`${r.start}:${r.end}`)) continue;
    const L = layout(ed);
    const t = L.texts.find(x => { const s0 = L.start.get(x)!; return r.start >= s0 && r.end <= s0 + clean(x.data).length && !x.parentElement?.closest('[data-ref]'); });
    if (!t) continue;
    const into = (k: number) => { let seen = 0, d = 0; while (d < t.data.length && seen < k) { if (clean(t.data[d]) !== '') seen++; d++; } return d; };
    const o1 = into(r.start - L.start.get(t)!), o2 = into(r.end - L.start.get(t)!);
    const mid = o1 > 0 ? t.splitText(o1) : t;
    mid.splitText(o2 - o1);
    const chip = doc.createElement('span');
    chip.className = 'nb-chip nb-chip-live';
    chip.dataset.ref = r.ref;
    chip.title = `${r.ref} (Ctrl+click opens it)`;
    mid.replaceWith(chip);
    chip.append(mid);
  }
  if (r0) ed.setSelectionRange(a, b);
}

/** For a test and for the round trip: the Markdown a block gives back when it is opened and nothing is typed. */
export function roundTrip(md: string): string {
  const ed = createEditor(md);
  return ed.value;
}
