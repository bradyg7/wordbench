// AGENTS.md: "Scripture is verbatim, never typed from memory." This is the check (CODING_STANDARDS.md, step 2 ticket 9).
//
// Every committed text file outside docs/, design/ and datasets/ is read for runs of 6 or more words that match a verse
// of the database (the KJV and every other version it holds), ignoring capitals and punctuation. A run that matches a
// verse only that way, and is not the database's text letter for letter, is a verse typed from memory (or damaged),
// and the check fails with file:line, the reference and the database's own words. A run that is an exact copy passes:
// it came from the database.
//
//   node scripts/scripture-check.mjs                 every tracked file
//   node scripts/scripture-check.mjs --file a.txt    only these files (the test uses this)
//
// The Bible database is opened read-only (WB_BIBLE_DB, else datasets/workbench.db). A missing database fails the check.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUN = 6; // words in a row that make a quotation
const SEED = 4; // a run is found from four words that agree, then laid along the verse
const MAX_EDITS = 2;
const TEXT = new Set(['rs', 'ts', 'mts', 'mjs', 'js', 'json', 'md', 'txt', 'py', 'html', 'css', 'toml', 'yml', 'ps1', 'sh', 'sql']);
const SKIP = [/^docs\//, /^design\//, /^datasets\//, /package-lock\.json$/];

const words = (s) => s.split(/\s+/).filter(Boolean);
// the comparison key of a word: letters and digits, lower case ("Lord's," and "lords" are the same word)
const key = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// the database's verses hold no ASCII quote marks, so one on a word of the file is the file's own
const QUOTE_START = /^["'`]/;
const QUOTE_END = /["'`][^p{L}p{N}]*$/u;
const bare = (w) => w.replace(/^["'`]+|["'`]+$/g, '');
const ends = (w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

function openBible() {
  const path = process.env.WB_BIBLE_DB || join(root, 'datasets', 'workbench.db');
  if (!existsSync(path)) {
    console.error(`scripture-check: no Bible database at ${path} (set WB_BIBLE_DB). The check fails rather than skips.`);
    process.exit(2);
  }
  return new DatabaseSync(path, { readOnly: true });
}

/** Every verse of every version: { ref, text, raw: [words], keys: [keys] }, and an index of its 4-word seeds. */
function loadVerses(db) {
  const books = new Map(db.prepare('select id, name from books').all().map((b) => [b.id, b.name]));
  const verses = [];
  const add = (version, r) => {
    const raw = words(r.text);
    verses.push({ ref: `${books.get(r.book)} ${r.chapter}:${r.verse} (${version})`, text: r.text, raw, keys: raw.map(key) });
  };
  for (const r of db.prepare('select book, chapter, verse, text from verses').all()) add('KJV', r);
  for (const r of db.prepare('select version, book, chapter, verse, text from verse_texts').all()) add(r.version, r);
  const index = new Map();
  verses.forEach((v, vi) => {
    for (let j = 0; j + SEED <= v.keys.length; j++) {
      const k = v.keys.slice(j, j + SEED).join(' ');
      let at = index.get(k);
      if (!at) index.set(k, (at = []));
      at.push([vi, j]);
    }
  });
  return { verses, index };
}

// a source file writes quotes and non-ASCII letters as escapes; the verse is what they stand for
const unescape = (s) =>
  s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(["'`])/g, '$1');

/**
 * Lays the file's words along a verse from a seed, going one way (step 1 right, -1 left), and lets a single word be
 * changed, dropped or added (each followed by two words that agree again) up to MAX_EDITS times: a verse typed from
 * memory is the verse with a word or two off. → the pairs [file index, verse index] that agree, and the edits made.
 */
function walk(fk, vk, p, q, step, toks) {
  const pairs = [];
  let edits = 0;
  const at = (k, i) => (i >= 0 && i < k.length ? k[i] : null);
  const agree = (x, y) => x !== null && x === y;
  for (;;) {
    if (p < 0 || q < 0 || p >= fk.length || q >= vk.length) break;
    if (fk[p] === vk[q]) {
      pairs.push([p, q]);
      // a quotation's own quote marks end it: prose beyond them is not the verse
      if (step === 1 ? QUOTE_END.test(toks[p]) : QUOTE_START.test(toks[p])) break;
      p += step; q += step; continue;
    }
    if (edits >= MAX_EDITS) break;
    if (agree(at(fk, p + step), at(vk, q + step)) && agree(at(fk, p + 2 * step), at(vk, q + 2 * step))) { p += step; q += step; edits++; continue; }
    if (agree(at(fk, p), at(vk, q + step)) && agree(at(fk, p + step), at(vk, q + 2 * step))) { q += step; edits++; continue; }
    if (agree(at(fk, p + step), at(vk, q)) && agree(at(fk, p + 2 * step), at(vk, q + step))) { p += step; edits++; continue; }
    break;
  }
  return { pairs, edits };
}

/** The near misses in one text: [{ line, ref, found, expected }]. */
export function findMisses(text, { verses, index }, runs = null) {
  const misses = [];
  const used = new Set();
  unescape(text).split(/\r?\n/).forEach((line, ln) => {
    const toks = words(line);
    const fk = toks.map(key);
    for (let i = 0; i + SEED <= fk.length; i++) {
      if (used.has(i)) continue;
      const hits = index.get(fk.slice(i, i + SEED).join(' '));
      if (!hits) continue;
      let best = null; // the longest laying of the file's words along any verse; a shorter one by chance is not the quote
      for (const [vi, j] of hits) {
        const v = verses[vi];
        const right = QUOTE_END.test(toks[i + SEED - 1]) ? { pairs: [], edits: 0 } : walk(fk, v.keys, i + SEED, j + SEED, 1, toks);
        const left = QUOTE_START.test(toks[i]) ? { pairs: [], edits: 0 } : walk(fk, v.keys, i - 1, j - 1, -1, toks);
        const seed = Array.from({ length: SEED }, (_, k) => [i + k, j + k]);
        const pairs = [...left.pairs.reverse(), ...seed, ...right.pairs];
        if (pairs.length < RUN) continue;
        const edits = left.edits + right.edits;
        // prose shares a few words with a verse by chance; a changed word counts only against a long run of agreeing ones
        if (edits > 0 && (edits > 2 || pairs.length < 4 * edits + 5)) continue;
        // the words in a row must be the verse's own letters, capitals and punctuation; the two ends may differ in
        // both (a quote opens with a capital or closes on a full stop)
        const lo = pairs[0][0], hi = pairs.at(-1)[0];
        let exact = edits === 0;
        pairs.forEach(([t, w], k) => {
          const end = k === 0 || k === pairs.length - 1;
          const same = end ? ends(toks[t]).toLowerCase() === ends(v.raw[w]).toLowerCase() : bare(toks[t]) === v.raw[w];
          if (!same) exact = false;
        });
        if (!best || pairs.length > best.n || (pairs.length === best.n && exact && !best.exact)) best = { n: pairs.length, exact, v, lo, hi };
      }
      if (!best) continue;
      for (let t = best.lo; t <= best.hi; t++) used.add(t);
      if (best.exact) runs?.push({ line: ln + 1, ref: best.v.ref, n: best.n });
      else misses.push({ line: ln + 1, ref: best.v.ref, found: toks.slice(best.lo, best.hi + 1).join(' '), expected: best.v.text });
    }
  });
  return misses;
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 1 << 26 })
    .toString().split('\0').filter(Boolean)
    .filter((f) => !SKIP.some((re) => re.test(f)) && TEXT.has(f.split('.').pop()));
}

function main() {
  const argv = process.argv.slice(2);
  const extra = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--file') extra.push(resolve(argv[++i]));
  const files = extra.length ? extra : trackedFiles().map((f) => join(root, f));
  const bible = loadVerses(openBible());
  let bad = 0;
  const inventory = argv.includes('--inventory');
  for (const f of files) {
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    const runs = inventory ? [] : null;
    if (runs && !findMisses(text, bible, runs).length && runs.length) {
      console.log(`${relative(root, f).replace(/\\/g, '/')}: ${runs.length} exact run(s), e.g. line ${runs[0].line} ${runs[0].ref} (${runs[0].n} words)`);
    }
    for (const m of inventory ? [] : findMisses(text, bible)) {
      bad++;
      const where = extra.length ? f : relative(root, f).replace(/\\/g, '/');
      console.error(`${where}:${m.line}: this looks like ${m.ref} but is not its text letter for letter.\n  the file has:     ${m.found}\n  the database has: ${m.expected}`);
    }
  }
  if (bad) {
    console.error(`\nscripture-check: ${bad} verse(s) differ from the database. Scripture is fetched (wb text "<ref>") or generated, never typed.`);
    process.exit(1);
  }
  console.log(`scripture-check: ${files.length} files, no verse differs from the database.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
