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

const base = { any: { 'a.ts': 3, 'b.ts': 1 }, unwrap: { 'x.rs': 2 }, tsIgnore: {} };

test('a rise fails, in plain words, naming the files', () => {
  const now = { ...base, any: { 'a.ts': 3, 'b.ts': 4 } };
  const r = compare(base, now);
  assert.equal(r.ok, false);
  assert.match(r.message, /3 more `any` in ui\/src than the baseline \(b\.ts \+3\)/);
  assert.doesNotMatch(r.message, /tsNocheck|expectAttr|tsIgnore/);
});

test('a new @ts-ignore is never allowed, and the message says so', () => {
  const r = compare(base, { ...base, tsIgnore: { 'ui/tests/a.spec.ts': 1 } });
  assert.equal(r.ok, false);
  assert.match(r.message, /1 new `@ts-ignore` \(ui\/tests\/a\.spec\.ts\): never allowed/);
});

test('a fall fails too: the baseline must be lowered', () => {
  const now = { ...base, unwrap: { 'x.rs': 1 } };
  const r = compare(base, now);
  assert.equal(r.ok, false);
  assert.match(r.message, /1 fewer `unwrap\(\)` than the baseline: lower it with `node scripts\/ratchet\.mjs --write` and commit scripts\/ratchet\.json/);
});

test('equal passes; a new file with hits is a rise', () => {
  assert.equal(compare(base, base).ok, true);
  const now = { ...base, unwrap: { 'x.rs': 2, 'new.rs': 1 } };
  const r = compare(base, now);
  assert.equal(r.ok, false);
  assert.match(r.message, /1 more `unwrap\(\)` in non-test Rust than the baseline \(new\.rs \+1\): return an error with a message instead/);
});

test('scanner: after ++, ), ] , an identifier or a non-null !, a slash is division', () => {
  assert.equal(countTs('i++ / 2; let q: any;').any, 1);
  assert.equal(countTs('let a = (b) / 2; let q: any; let c = d / 2;').any, 1);
  assert.equal(countTs('let a = x[0] / 2 / 3; let q: any;').any, 1);
  assert.equal(countTs('let a = x! / 2 / 3; let q: any;').any, 1);
  assert.equal(countTs('let a = f()! / 2 / 3; let q: any;').any, 1);
  assert.equal(countTs('let a = !/any/.test(s); let q: any;').any, 1);
});

test('eslint-disable block and -line forms are counted', () => {
  const src = '/* eslint-disable */\nx(); // eslint-disable-line no-x\n// eslint-disable-next-line no-y\n';
  assert.equal(countTs(src).eslintDisable, 3);
});

test('rust: cfg_attr switches count', () => {
  const src = '#[cfg_attr(test, allow(dead_code))]\n#![cfg_attr(not(test), expect(unused, reason = "r"))]\n';
  const c = countRust(src);
  assert.equal(c.allow, 1);
  assert.equal(c.expectAttr, 1);
});
