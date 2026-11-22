// A block's background (notebook design row 25b, decided 2026-11-21): `<span data-bg="yellow">` around the block's whole text,
// after its marker (`## `, `- `, `> [!key] `), the same form selected words use. It is for text blocks only. wb-core writes it
// (`wb block color`, crates/wb-core/src/blockops.rs); this file only reads it, to draw the block's wash and tick the menu.
import { COLORS } from './palette';

const KINDS = ['paragraph', 'heading', 'item', 'numbered', 'todo', 'quote'];

/** Can this block have a background? Text blocks: not scripture or another fenced block, a table, a divider, a toggle's line or a column marker. */
export const takesBackground = (b: { kind: string; text: string }) => {
  const t = b.text.trim();
  return KINDS.includes(b.kind) && !t.startsWith('<details') && !t.startsWith('</details>') && !t.startsWith('<!--');
};

/** What a line's marker takes before its text. */
function lead(line: string, kind: string, first: boolean): number {
  if (kind === 'heading') return first ? /^\s*#{1,6}\s*/.exec(line)![0].length : /^\s*/.exec(line)![0].length;
  if ((kind === 'item' || kind === 'numbered' || kind === 'todo') && first) return /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/.exec(line)?.[0].length ?? 0;
  if (kind === 'quote') {
    const m = /^\s*(?:>\s*)+/.exec(line)![0].length;
    const k = first ? /^\[![^\]]*\]\s*/.exec(line.slice(m))?.[0].length ?? 0 : 0;
    return m + k;
  }
  return /^\s*/.exec(line)![0].length;
}

const WRAP = new RegExp(String.raw`^<span data-bg="(${COLORS.join('|')})">([\s\S]*)</span>$`);
function wholeSpan(body: string): string | null {
  const m = WRAP.exec(body.trimEnd());
  if (!m) return null;
  const opens = (m[2].match(/<span/g) || []).length, closes = (m[2].match(/<\/span>/g) || []).length;
  return opens === closes ? m[1] : null;
}

/** The block's background color: its whole text is in one `data-bg` span (a quote or callout: every line is). */
export function bgOf(b: { kind: string; text: string }): string | null {
  if (!takesBackground(b)) return null;
  const lines = b.text.split('\n');
  if (b.kind === 'quote') {
    let found: string | null = null;
    for (const [i, l] of lines.entries()) {
      const body = l.slice(lead(l, 'quote', i === 0));
      if (!body.trim()) continue;
      const c = wholeSpan(body);
      if (!c || (found && found !== c)) return null;
      found = c;
    }
    return found;
  }
  return wholeSpan(b.text.slice(lead(lines[0], b.kind, true)));
}
