#!/usr/bin/env node
// Checks a built ZIP against the package rules Kurodyne publishes (Publish Your First Product → Prepare Your Package,
// and Listing Review and Standards): no comment, 10,000 entries, names that work on Windows, no blocked file types,
// 250 MB compressed and 1 GB extracted with the compression ratios, a top-level README and notices, and usable product
// files. Prints every check and exits 1 if one fails. Also usable as a module: `checkZip(path)`.
import { readEntry, readZip } from './zip.mjs';
import { basename } from 'node:path';

const BLOCKED = new Set(['scr', 'vbs', 'vbe', 'wsf', 'wsh', 'jse', 'wsc', 'hta', 'cpl', 'sys', 'drv', 'ocx', 'lnk', 'pif', 'reg', 'inf', 'dmg', 'iso', 'img', 'vhd', 'vmdk']);
const DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const FORBIDDEN = /[<>:"|?*\\]/;
const CONTROL = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const SIZE_LIMIT = 250 * 1024 * 1024;
const EXTRACTED_LIMIT = 1024 * 1024 * 1024;

function extOf(name) {
  const file = name.split('/').pop() || '';
  const dot = file.lastIndexOf('.');
  return dot > 0 ? file.slice(dot + 1).toLowerCase() : '';
}

/** Every name rule, on one path. */
function nameProblem(name) {
  if (!name) return 'empty name';
  if (name.includes('\\')) return 'a backslash (ZIP names use /)';
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return 'an absolute path';
  if (name.split('/').some(part => part === '..')) return 'a path outside the package';
  if (CONTROL.test(name)) return 'a control or bidirectional character';
  if (FORBIDDEN.test(name)) return 'a character Windows cannot store';
  for (const part of name.split('/')) {
    if (!part) return 'an empty folder name';
    if (part.endsWith('.') || part.endsWith(' ')) return `a name ending in a ${part.endsWith('.') ? 'period' : 'space'}`;
    if (DEVICE.test(part)) return `a Windows device name (${part})`;
    if (Buffer.byteLength(part, 'utf8') > 255) return 'a name longer than 255 bytes';
  }
  if (Buffer.byteLength(name, 'utf8') > 1024) return 'a path longer than 1,024 bytes';
  return null;
}

export function checkZip(zipPath) {
  const rows = [];
  const add = (ok, what, detail = '') => rows.push({ ok, what, detail });
  let zip;
  try {
    zip = readZip(zipPath);
  } catch (e) {
    add(false, 'The ZIP file can be read', String(e));
    return { rows, ok: false, zip: null };
  }

  add(zip.comment.length === 0, 'No ZIP comment (Kurodyne refuses archives made by git archive or GitHub)', zip.comment ? `Comment: ${zip.comment.slice(0, 60)}` : '');
  add(zip.entries.length > 0, 'The package has files', `${zip.entries.length} entries`);

  const names = zip.entries.map(e => e.name);
  const bad = names.map(n => [n, nameProblem(n)]).filter(([, p]) => p);
  add(bad.length === 0, 'Portable file and folder names', bad.slice(0, 5).map(([n, p]) => `${n}: ${p}`).join('; '));

  const blocked = names.filter(n => BLOCKED.has(extOf(n)));
  add(blocked.length === 0, 'No blocked file types', blocked.slice(0, 5).join(', '));

  const folds = new Map();
  for (const n of names) {
    const key = n.toLowerCase();
    folds.set(key, (folds.get(key) || 0) + 1);
  }
  const twice = [...folds].filter(([, c]) => c > 1).map(([n]) => n);
  add(twice.length === 0, 'No names that differ only in letter case', twice.slice(0, 5).join(', '));

  add(zip.entries.length <= 10000, 'At most 10,000 files and folders', `${zip.entries.length}`);
  add(!zip.entries.some(e => (e.external >>> 16) === 0xA000), 'No symbolic links', '');

  const raw = zip.entries.reduce((n, e) => n + e.size, 0);
  const packed = zip.entries.reduce((n, e) => n + e.compressed, 0);
  add(packed <= SIZE_LIMIT, 'At most 250 MB compressed', `${(packed / 1024 / 1024).toFixed(1)} MB`);
  add(raw <= EXTRACTED_LIMIT, 'At most 1 GB extracted', `${(raw / 1024 / 1024).toFixed(1)} MB`);
  add(raw <= packed * 100 + 1024, 'Expands at most 100:1', `${(raw / Math.max(1, packed)).toFixed(1)}:1`);
  const tooCompressible = zip.entries.filter(e => e.compressed > 0 && e.size / e.compressed > 200);
  add(tooCompressible.length === 0, 'No file expands more than 200:1', tooCompressible.slice(0, 3).map(e => `${e.name} ${(e.size / e.compressed).toFixed(0)}:1`).join(', '));

  const has = name => zip.entries.some(e => e.name === name);
  const readme = zip.entries.find(e => e.name === 'README.md') || zip.entries.find(e => e.name === 'README.txt');
  add(!!readme, 'A README at the top level', readme ? readme.name : 'README.md or README.txt');
  add(has('THIRD_PARTY_NOTICES.md'), 'The third-party notices at the top level', '');
  add(!!zip.entries.find(e => e.name === 'DEPENDENCIES.md'), 'The dependency inventory', 'DEPENDENCIES.md');
  const licenseFiles = names.filter(n => n.startsWith('licenses/'));
  add(licenseFiles.length >= 10, 'The full license texts ship', `${licenseFiles.length} files`);

  const db = zip.entries.find(e => e.name === 'datasets/workbench.db');
  add(!!db, 'The Bible database ships with the app', db ? '' : 'datasets/workbench.db');
  if (db) {
    try {
      const magic = readEntry(zipPath, db).subarray(0, 16).toString('latin1');
      add(magic === 'SQLite format 3\u0000', 'The Bible database is a SQLite file', magic.replace(/\u0000/g, '\\0'));
    } catch (e) {
      add(false, 'The Bible database can be read', String(e));
    }
  }

  const exe = zip.entries.find(e => e.name.toLowerCase().endsWith('.exe'));
  add(!!exe, 'A program to run', exe ? exe.name : 'no .exe in the package');
  add(!!zip.entries.find(e => e.name.startsWith('source/')), 'Readable source is included', '');

  if (readme) {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(readEntry(zipPath, readme));
      add(!text.includes('\u0000'), 'The README is UTF-8 text', '');
      add(text.length <= 128 * 1024, 'The README will show in full on the listing', `${(text.length / 1024).toFixed(1)} KB`);
      add(!/C:\\Users\\/i.test(text), 'No personal paths in the README', '');
      add(!/\bpurchase key\b|\blicen[cs]e key\b|\bactivation code\b/i.test(text), 'No purchase keys or codes in the README', '');
    } catch (e) {
      add(false, 'The README is UTF-8 text', String(e));
    }
  }

  const junk = names.filter(n => /(^|\/)(\.git|node_modules|target|\.DS_Store|\.env|\.claude)(\/|$)/.test(n));
  add(junk.length === 0, 'No development or secret files', junk.slice(0, 5).join(', '));

  return { rows, ok: rows.every(r => r.ok), zip };
}

// Compare the file name exactly: `check-package.mjs` also ends with `package.mjs`, so a suffix test would run this
// command when `scripts/package.mjs` imports `checkZip`.
const isMain = process.argv[1] && basename(process.argv[1]) === 'check-package.mjs';
if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/check-package.mjs <package.zip>');
    process.exit(2);
  }
  const { rows, ok, zip } = checkZip(file);
  for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.what}${r.detail ? ` — ${r.detail}` : ''}`);
  if (zip) {
    const packed = zip.entries.reduce((n, e) => n + e.compressed, 0);
    const raw = zip.entries.reduce((n, e) => n + e.size, 0);
    console.log(`\n${zip.entries.length} entries · ${(packed / 1024 / 1024).toFixed(1)} MB compressed · ${(raw / 1024 / 1024).toFixed(1)} MB extracted`);
  }
  process.exit(ok ? 0 : 1);
}
