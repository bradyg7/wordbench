// Toggles (notebook design row 9, NB4). In the page a toggle is `<details><summary>Its line</summary>` as one block, the
// blocks inside it as blocks of their own, and a block `</details>` that ends it; a toggle with nothing inside is the one
// block `<details><summary>Its line</summary></details>` (what the / menu's Toggle list writes). A heading can be a toggle:
// its summary holds `<h2>…</h2>`. Whether a toggle is folded is not in the page: it is kept in settings/pages.json
// (`wb page fold`). The block editor edits the summary's own line (with its heading shape), and this file wraps and unwraps it.

export interface Head { inner: string; closed: boolean }

const HEAD = /^<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*(<\/details>)?\s*$/;
const NL = String.fromCharCode(10);

/** A toggle's head block: what its line holds (a heading's `<h2>x</h2>` as `## x`), and whether it is the one-block form. */
export function toggleHead(text: string): Head | null {
  const m = HEAD.exec(text.trim());
  if (!m) return null;
  const h = /^<h([1-3])>([\s\S]*)<\/h\1>$/.exec(m[1].trim());
  return { inner: h ? `${'#'.repeat(Number(h[1]))} ${h[2]}` : m[1], closed: !!m[2] };
}

/** The block's Markdown for a toggle's line (as the editor holds it) and the form (one block, or open for blocks inside). */
export function wrapHead(inner: string, closed: boolean): string {
  const h = /^(#{1,3}) ([^\n]*)$/.exec(inner);
  const body = h ? `<h${h[1].length}>${h[2]}</h${h[1].length}>` : inner;
  return `<details><summary>${body}</summary>${closed ? '</details>' : ''}`;
}

/** The block that ends a toggle. */
export const isToggleEnd = (text: string) => text.trim() === '</details>';

/** Which editors hold a toggle's line (set while it is written). */
export const toggleOf = new WeakMap<HTMLElement, { closed: boolean }>();

export interface Place { role: 'head' | 'child' | 'end' | 'plain'; /** the heads this block is inside, outermost first (block numbers) */ inside: number[] }

/** Where each block is among the toggles: heads open a group that a `</details>` block closes. An end with nothing open is a plain block. */
export function placeBlocks(blocks: { n: number; text: string }[]): Map<number, Place> {
  const out = new Map<number, Place>();
  const open: number[] = [];
  for (const b of blocks) {
    const head = toggleHead(b.text);
    if (head) {
      out.set(b.n, { role: 'head', inside: [...open] });
      if (!head.closed) open.push(b.n);
    } else if (isToggleEnd(b.text) && open.length) {
      const inside = [...open];
      open.pop();
      out.set(b.n, { role: 'end', inside });
    } else {
      out.set(b.n, { role: open.length ? 'child' : 'plain', inside: [...open] });
    }
  }
  return out;
}

