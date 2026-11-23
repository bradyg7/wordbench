// Fetches the demo's scripture and lexicon from the read-only database through `wb` (never typed) into demo/data.json.
//   WB_BIBLE_DB=... node design/features/identity/demo/data.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const wb = join(here, '..', '..', '..', '..', 'target', 'release', 'wb.exe');
const run = (...a) => JSON.parse(execFileSync(wb, [...a, '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const CHAPTERS = [['John', 1], ['Genesis', 1], ['Numbers', 25], ['Psalms', 23], ['Romans', 5]];
const chapters = {}, strongs = new Set();
for (const [b, c] of CHAPTERS) {
  const d = run('chapter', b, String(c));
  const key = `${d.book.name} ${c}`;
  chapters[key] = d.verses.map(v => ({ v: v.v, w: v.words.map(w => [w.lead + w.t + w.trail, w.s]) }));
  for (const v of d.verses) for (const w of v.words) if (w.s) strongs.add(w.s);
}
const lex = {};
for (const s of strongs) {
  try { const e = run('strong', s); lex[s] = { lemma: e.lemma, translit: e.translit, def: e.definition, usage: e.usage }; } catch { /* a number without an entry */ }
}
writeFileSync(join(here, 'data.json'), JSON.stringify({ chapters, lex }));
console.log(Object.keys(chapters).length, 'chapters,', Object.keys(lex).length, 'entries');
