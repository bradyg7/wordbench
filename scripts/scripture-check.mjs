// AGENTS.md: "Scripture is verbatim, never typed from memory." This is the check (CODING_STANDARDS.md, step 2 ticket 9).
//
// Every committed text file outside datasets/ (and outside the folders in SKIPPED_FOLDERS) is read for runs of 6 or
// more words that match a verse of the database (the KJV and every other version it holds), ignoring capitals and
// punctuation. A run that matches a verse only that way, and is not the database's text letter for letter, is a verse
// typed from memory (or damaged), and the check fails with file:line, the reference and the database's own words. A
// run that is an exact copy passes: it came from the database.
//
//   node scripts/scripture-check.mjs                 every tracked file
//   node scripts/scripture-check.mjs --file a.txt    only these files (the test uses this)
//   node scripts/scripture-check.mjs --inventory     the files that hold an exact copy of a verse
//   node scripts/scripture-check.mjs --everywhere    also the folders in SKIPPED_FOLDERS
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
// datasets/ is data, never scanned; the lockfile is generated
const NEVER = [/^datasets\//, /package-lock\.json$/];
// docs/ and design/ hold near misses (listed in docs/turnaround.md, ticket 9 review); they are scanned only with
// --everywhere until each is fixed or shown to be a quotation of a changed kind: a follow-up, not this ticket
const SKIPPED_FOLDERS = ['docs/', 'design/'];

const words = (s) => s.split(/\s+/).filter(Boolean);
// the comparison key of a word: letters and digits, lower case ("Lord's," and "lords" are the same word)
const key = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// the database's verses hold no ASCII quote marks, so one on a word of the file is the file's own; an apostrophe
// inside a word (Lord's) is not a quotation's end, only one followed by nothing but punctuation is
export const opensQuotation = (word) => /^["'`]/.test(word);
export const endsQuotation = (word) => /["'`][^\p{L}\p{N}]*$/u.test(word);
// a full stop ends the file's sentence; prose after it only happens to share words with the verse's next clause
const endsSentence = (word) => /[.!?]["'`]*$/.test(word);
const withoutQuoteMarks = (w) => w.replace(/^["'`]+|["'`]+$/g, '');
const trimOuterPunctuation = (w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

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
      let seeds = index.get(k);
      if (!seeds) index.set(k, (seeds = []));
      seeds.push([vi, j]);
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
 * memory is the verse with a word or two off. → the pairs [file word, verse word] that agree, and the edits made.
 * `fileAt` and `verseAt` are where the next word to compare stands in each.
 */
function layAlong({ fileKeys, verseKeys, fileWords, fileAt, verseAt, step }) {
  const pairs = [];
  let edits = 0;
  const keyAt = (keys, i) => (i >= 0 && i < keys.length ? keys[i] : null);
  const agreeAt = (fileOffset, verseOffset) => {
    const f = keyAt(fileKeys, fileAt + fileOffset * step);
    return f !== null && f === keyAt(verseKeys, verseAt + verseOffset * step);
  };
  for (;;) {
    if (fileAt < 0 || verseAt < 0 || fileAt >= fileKeys.length || verseAt >= verseKeys.length) break;
    // a quotation begun (going right) or closed (going left) inside the walk is a boundary: what lies beyond it is
    // the file's own prose, which only happens to share words with the verse
    if (step === 1 ? opensQuotation(fileWords[fileAt]) : endsQuotation(fileWords[fileAt]) || endsSentence(fileWords[fileAt])) break;
    if (fileKeys[fileAt] === verseKeys[verseAt]) {
      pairs.push([fileAt, verseAt]);
      // a quotation's own quote marks end it: prose beyond them is not the verse
      if (step === 1 ? endsQuotation(fileWords[fileAt]) || endsSentence(fileWords[fileAt]) : opensQuotation(fileWords[fileAt])) break;
      fileAt += step;
      verseAt += step;
      continue;
    }
    if (edits >= MAX_EDITS) break;
    // one word changed, one dropped from the file, one added to it; each must be followed by two that agree
    if (agreeAt(1, 1) && agreeAt(2, 2)) { fileAt += step; verseAt += step; edits++; continue; }
    if (agreeAt(0, 1) && agreeAt(1, 2)) { verseAt += step; edits++; continue; }
    if (agreeAt(1, 0) && agreeAt(2, 1)) { fileAt += step; edits++; continue; }
    break;
  }
  return { pairs, edits };
}

/** A laying is a copy when every word in a row is the verse's own letters, capitals and punctuation; its two ends may
 *  differ in both (a quotation opens with a capital or closes on a full stop). */
function isExactCopy(pairs, edits, fileWords, verse) {
  if (edits > 0) return false;
  return pairs.every(([f, v], k) => {
    const isEnd = k === 0 || k === pairs.length - 1;
    return isEnd
      ? trimOuterPunctuation(fileWords[f]).toLowerCase() === trimOuterPunctuation(verse.raw[v]).toLowerCase()
      : withoutQuoteMarks(fileWords[f]) === verse.raw[v];
  });
}

/** The longest laying of the file's words along any verse that has the seed at word `i`; a shorter one by chance is
 *  not the quotation. null when none is long enough to be one. */
function bestLaying(i, hits, verses, fileKeys, fileWords) {
  let best = null;
  // four words with a quotation's mark between them are two stretches of the file, not one run
  const seedWords = fileWords.slice(i, i + SEED);
  if (seedWords.some((w, k) => (k > 0 && opensQuotation(w)) || (k < SEED - 1 && (endsQuotation(w) || endsSentence(w))))) return null;
  for (const [vi, j] of hits) {
    const verse = verses[vi];
    const none = { pairs: [], edits: 0 };
    const right = endsQuotation(fileWords[i + SEED - 1]) || endsSentence(fileWords[i + SEED - 1])
      ? none
      : layAlong({ fileKeys, verseKeys: verse.keys, fileWords, fileAt: i + SEED, verseAt: j + SEED, step: 1 });
    const left = opensQuotation(fileWords[i])
      ? none
      : layAlong({ fileKeys, verseKeys: verse.keys, fileWords, fileAt: i - 1, verseAt: j - 1, step: -1 });
    const seed = Array.from({ length: SEED }, (_, k) => [i + k, j + k]);
    const pairs = [...left.pairs.reverse(), ...seed, ...right.pairs];
    if (pairs.length < RUN) continue;
    const edits = left.edits + right.edits;
    // prose shares a few words with a verse by chance; a changed word counts only against a long run of agreeing ones
    if (edits > 0 && (edits > 2 || pairs.length < 4 * edits + 5)) continue;
    const exact = isExactCopy(pairs, edits, fileWords, verse);
    if (!best || pairs.length > best.n || (pairs.length === best.n && exact && !best.exact)) {
      best = { n: pairs.length, exact, verse, first: pairs[0][0], last: pairs.at(-1)[0] };
    }
  }
  return best;
}

/** The near misses in one text: [{ line, ref, found, expected }]. `runs`, when given, collects the exact copies. */
export function findMisses(text, { verses, index }, runs = null) {
  const misses = [];
  unescape(text).split(/\r?\n/).forEach((line, lineIndex) => {
    const fileWords = words(line);
    const fileKeys = fileWords.map(key);
    const covered = new Set();
    for (let i = 0; i + SEED <= fileKeys.length; i++) {
      if (covered.has(i)) continue;
      const hits = index.get(fileKeys.slice(i, i + SEED).join(' '));
      const best = hits && bestLaying(i, hits, verses, fileKeys, fileWords);
      if (!best) continue;
      for (let t = best.first; t <= best.last; t++) covered.add(t);
      if (best.exact) runs?.push({ line: lineIndex + 1, ref: best.verse.ref, n: best.n });
      else misses.push({ line: lineIndex + 1, ref: best.verse.ref, found: fileWords.slice(best.first, best.last + 1).join(' '), expected: best.verse.text });
    }
  });
  return misses;
}

function trackedFiles(everywhere) {
  const skipped = everywhere ? [] : SKIPPED_FOLDERS;
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 1 << 26 })
    .toString().split('\0').filter(Boolean)
    .filter((f) => !NEVER.some((re) => re.test(f)) && !skipped.some((d) => f.startsWith(d)) && TEXT.has(f.split('.').pop()));
}

function main() {
  const argv = process.argv.slice(2);
  const extra = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--file') extra.push(resolve(argv[++i]));
  const files = extra.length ? extra : trackedFiles(argv.includes('--everywhere')).map((f) => join(root, f));
  const bible = loadVerses(openBible());
  const inventory = argv.includes('--inventory');
  const nameOf = (f) => (extra.length ? f : relative(root, f).replace(/\\/g, '/'));
  let bad = 0;
  for (const f of files) {
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    if (inventory) {
      const runs = [];
      findMisses(text, bible, runs);
      if (runs.length) console.log(`${nameOf(f)}: ${runs.length} exact run(s), e.g. line ${runs[0].line} ${runs[0].ref} (${runs[0].n} words)`);
      continue;
    }
    for (const m of findMisses(text, bible)) {
      bad++;
      console.error(`${nameOf(f)}:${m.line}: this looks like ${m.ref} but is not its text letter for letter.\n  the file has:     ${m.found}\n  the database has: ${m.expected}`);
    }
  }
  if (inventory) return;
  if (bad) {
    console.error(`\nscripture-check: ${bad} verse(s) differ from the database. Scripture is fetched (wb text "<ref>") or generated, never typed.`);
    process.exit(1);
  }
  console.log(`scripture-check: ${files.length} files, no verse differs from the database.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
