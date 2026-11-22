// Columns in a page (notebook rows 15 and 44, library L-23): comment markers, each a block of its own like a toggle's
// `</details>`: `<!-- columns -->` opens, `<!-- column -->` starts the next column, `<!-- /columns -->` closes. The file reads
// top to bottom in any editor. Markers that do not balance (one deleted by hand) are read as plain blocks. wb-core writes
// and tidies them (`wb block move --beside`, crates/wb-core/src/blockops.rs); this file only finds them, to draw the columns.

export const OPEN = '<!-- columns -->', SEP = '<!-- column -->', CLOSE = '<!-- /columns -->';
export const MAX_COLUMNS = 4;
export const isMarker = (text: string) => [OPEN, SEP, CLOSE].includes(text.trim());

/** A balanced group, by block numbers (from 1). */
export interface Group { open: number; seps: number[]; close: number }

/** The balanced groups among the page's blocks. */
export function columnGroups(blocks: { n: number; text: string }[]): Group[] {
  const out: Group[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].text.trim() !== OPEN) continue;
    const seps: number[] = [];
    for (let j = i + 1; j < blocks.length; j++) {
      const t = blocks[j].text.trim();
      if (t === OPEN) break;
      if (t === SEP) seps.push(blocks[j].n);
      if (t === CLOSE) { out.push({ open: blocks[i].n, seps, close: blocks[j].n }); i = j; break; }
    }
  }
  return out;
}
