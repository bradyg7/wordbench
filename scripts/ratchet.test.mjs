// Tests for scripts/ratchet.mjs, on small in-memory sources (the seams: countTs, countRust, compare).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countTs, countRust, compare } from './ratchet.mjs';

test('any: a type use counts, the word in a comment, string or template does not', () => {
  const src = [
    'const a: any = 1;',
    'const b = x as any;',
    'const c: Array<any> = [];',
    'const d: Record<string, any> = {};',
    'function f(p: any[]) {}',
    'const e = <any>y;',
    '// any here is a word',
    '/* any any */',
    'const s = "any";',
    "const t = 'any';",
    'const u = `any ${v as any} any`;',
    'const r = /any/.test(s);',
    'const o = { any: 1 }; o.any;',
  ].join('\n');
  assert.equal(countTs(src).any, 7);
});

test('ts checker switches are counted separately, only in comments', () => {
  const src = [
    '// @ts-expect-error because',
    '// @ts-ignore',
    '/* @ts-nocheck */',
    '// eslint-disable-next-line no-x -- why',
    'const s = "@ts-ignore";',
  ].join('\n');
  const c = countTs(src);
  assert.deepEqual([c.tsExpectError, c.tsIgnore, c.tsNocheck, c.eslintDisable], [1, 1, 1, 1]);
});

test('rust: unwrap and expect counted, unwrap_or and expect_err not', () => {
  const src = 'fn f() { a.unwrap(); b.expect("x"); c.unwrap_or(1); d.unwrap_or_else(|| 2); e.expect_err("y"); }';
  const c = countRust(src);
  assert.equal(c.unwrap, 1);
  assert.equal(c.expect, 1);
});

test('rust: cfg(test) modules, comments and strings are not counted', () => {
  const src = [
    'fn f() { a.unwrap(); } // b.unwrap()',
    'let s = "c.unwrap()"; let r = r#"d.unwrap() "quoted""#;',
    '#[cfg(test)]',
    'mod tests {',
    '    fn t() { x.unwrap(); if true { y.expect("z"); } }',
    '}',
    "fn g<'a>(c: char) { let q = '}'; h.expect(\"k\"); }",
  ].join('\n');
  const c = countRust(src);
  assert.equal(c.unwrap, 1);
  assert.equal(c.expect, 1);
});

test('rust: checker switches count everywhere, including tests', () => {
  const src = [
    '#![allow(dead_code)]',
    '#[allow(unused)]',
    '#[expect(clippy::x, reason = "r")]',
    '#[cfg(test)] mod tests { #[allow(unused)] fn t() {} }',
    'fn f() { a.expect("not a switch"); }',
    '// #[allow(nothing)]',
  ].join('\n');
  const c = countRust(src);
  assert.equal(c.allow, 3);
  assert.equal(c.expectAttr, 1);
});

const base = { any: { 'a.ts': 3, 'b.ts': 1 }, unwrap: { 'x.rs': 2 } };

test('a rise fails and names the count, the amount and the file', () => {
  const now = { any: { 'a.ts': 3, 'b.ts': 4 }, unwrap: { 'x.rs': 2 } };
  const r = compare(base, now);
  assert.equal(r.ok, false);
  assert.match(r.message, /any rose by 3/);
  assert.match(r.message, /b\.ts/);
});

test('a fall passes and says to lower the baseline', () => {
  const now = { any: { 'a.ts': 1, 'b.ts': 1 }, unwrap: { 'x.rs': 2 } };
  const r = compare(base, now);
  assert.equal(r.ok, true);
  assert.match(r.message, /lower the baseline: node scripts\/ratchet\.mjs --write/);
});

test('equal passes quietly; a new file with hits counts as a rise', () => {
  assert.equal(compare(base, base).ok, true);
  const now = { ...base, unwrap: { 'x.rs': 2, 'new.rs': 1 } };
  assert.equal(compare(base, now).ok, false);
});
