// scripts/scripture-check.mjs on a verse fetched with `wb text`: the copy passes, the same verse with one word changed
// (or one comma dropped, or one capital) fails and says where and what the database has. The verse is never typed here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { endsQuotation, opensQuotation } from './scripture-check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = join(root, 'scripts', 'scripture-check.mjs');

// "Numbers 25:11 (KJV)" then "11 Phinehas, ..." : the verse without its number
const lines = execFileSync('cargo', ['run', '-q', '-p', 'wb-cli', '--', 'text', 'Num 25:11'], { cwd: root }).toString().trim().split(/\r?\n/);
const verse = lines[1].replace(/^\d+\s+/, '');
const words = verse.split(' ');

function run(body, flags = []) {
  const dir = mkdtempSync(join(tmpdir(), 'scripture-check-'));
  try {
    const file = join(dir, 'a-test.txt');
    writeFileSync(file, body);
    const r = spawnSync(process.execPath, ['--no-warnings', check, '--file', file, ...flags], { encoding: 'utf8' });
    return { code: r.status, out: r.stdout + r.stderr, file };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a verse copied from the database passes', () => {
  assert.ok(words.length > 20, 'the verse used is long enough');
  const r = run(`before\nconst v = ${JSON.stringify(verse)};\nafter\n`);
  assert.equal(r.code, 0, r.out);
});

test('a verse with one word changed fails, naming the line, the reference and the database text', () => {
  const at = Math.floor(words.length / 2);
  const typed = [...words.slice(0, at), 'XCHANGEDX', ...words.slice(at + 1)].join(' ');
  const r = run(`line one\nconst v = ${JSON.stringify(typed)};\n`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /a-test\.txt:2: this looks like Numbers 25:11 \(KJV\)/);
  assert.ok(r.out.includes(`the database has: ${verse}`), r.out);
});

test('a verse with one comma dropped fails', () => {
  const r = run(`${verse.replace('Eleazar,', 'Eleazar')}\n`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /:1: this looks like Numbers 25:11/);
});

test('a verse with one capital lowered fails', () => {
  const r = run(`${verse.replace('Aaron', 'aaron')}\n`);
  assert.equal(r.code, 1, r.out);
});

test('a quoted part of a verse, ends cut and a closing full stop, passes', () => {
  const part = words.slice(6, 16).join(' ').replace(/[,;:.]$/, '');
  const r = run(`it says "${part}". Then more of its own words follow.\n`);
  assert.equal(r.code, 0, r.out);
});

test('an apostrophe inside a word does not end a quotation; a quote mark after the last word does', () => {
  assert.equal(endsQuotation("Lord's"), false);
  assert.equal(endsQuotation("Israel's,"), false);
  assert.equal(endsQuotation('congregation".'), true);
  assert.equal(endsQuotation("congregation'"), true);
  assert.equal(opensQuotation('"at'), true);
  assert.equal(opensQuotation("father's"), false);
});

test('--inventory lists a file that holds an exact copy, and not one that holds none', () => {
  const copy = run(`before\n${verse}\n`, ['--inventory']);
  assert.equal(copy.code, 0, copy.out);
  assert.match(copy.out, /a-test\.txt: 1 exact run\(s\), e\.g\. line 2 Numbers 25:11 \(KJV\)/);
  const none = run('words that are nobody\'s verse at all, in a file of its own\n', ['--inventory']);
  assert.equal(none.code, 0, none.out);
  assert.doesNotMatch(none.out, /exact run/);
});
