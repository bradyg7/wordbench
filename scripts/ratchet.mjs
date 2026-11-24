// The ratchets (docs/turnaround.md step 2, ticket 7): counts of things we want less of, compared with the
// committed baseline in scripts/ratchet.json. A count may fall; it may not rise. See GLOSSARY.md (Ratchet, Baseline).
//
//   node scripts/ratchet.mjs            compare with the baseline (exit 1 if a count rose)
//   node scripts/ratchet.mjs --detail   print per-file counts
//   node scripts/ratchet.mjs --write    rewrite the baseline (after a clean-up lowered a count)
//
// Why not the TypeScript compiler API for `any`: typescript 7 is the Go-native compiler; its npm package ships only
// the `tsc` launcher, no JS API. So both languages go through one small scanner that blanks comments, strings,
// template text and (TS) regex literals, keeping code (including `${...}` inside templates) in place. `any` is then
// the whole word in code that is not a property (`.any`) or a key/call (`any:`, `any(`). Directive comments
// (`@ts-ignore` and friends) are searched in the comment text the scanner collected.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'scripts', 'ratchet.json');

const isIdent = (ch) => ch !== undefined && /[A-Za-z0-9_$]/.test(ch);
const blank = (s) => s.replace(/[^\n]/g, ' ');

// Returns { code, comments }: code has the same length and line breaks as the source, with comments, strings and
// regex literals replaced by spaces.
export function scan(text, lang) {
  const ts = lang === 'ts';
  let code = '';
  let comments = '';
  const n = text.length;
  let i = 0;
  const braces = []; // TS template stack: the brace depth to come back to when a `${` closes
  let depth = 0;
  let lastSig = ''; // last significant code token, for the regex-or-divide decision
  const put = (s) => {
    code += s;
    const t = s.trim();
    if (t) lastSig = t.match(/[A-Za-z0-9_$]+$/)?.[0] ?? t.at(-1);
  };
  // Inside template text from i; ends at the closing backtick or at `${` (code resumes).
  const template = () => {
    let out = '';
    while (i < n) {
      const ch = text[i];
      if (ch === '\\') { out += blank(text.slice(i, i + 2)); i += 2; continue; }
      if (ch === '`') { out += ' '; i++; code += out; lastSig = '"'; return; }
      if (ch === '$' && text[i + 1] === '{') {
        out += '  '; i += 2; braces.push(depth); depth++; code += out; lastSig = '{'; return;
      }
      out += ch === '\n' ? '\n' : ' ';
      i++;
    }
    code += out;
  };
  while (i < n) {
    const ch = text[i];
    const nx = text[i + 1];
    if (ch === '/' && nx === '/') {
      const e = text.indexOf('\n', i);
      const end = e < 0 ? n : e;
      comments += text.slice(i, end) + '\n';
      code += ' '.repeat(end - i);
      i = end;
      continue;
    }
    if (ch === '/' && nx === '*') {
      let d = 1;
      let j = i + 2;
      while (j < n && d > 0) {
        if (!ts && text[j] === '/' && text[j + 1] === '*') { d++; j += 2; }
        else if (text[j] === '*' && text[j + 1] === '/') { d--; j += 2; }
        else j++;
      }
      comments += text.slice(i, j) + '\n';
      code += blank(text.slice(i, j));
      i = j;
      continue;
    }
    if (ch === '"' || (ts && ch === "'")) {
      let j = i + 1;
      while (j < n && text[j] !== ch && !(ts && text[j] === '\n')) j += text[j] === '\\' ? 2 : 1;
      j = Math.min(j + 1, n);
      code += blank(text.slice(i, j));
      lastSig = '"';
      i = j;
      continue;
    }
    if (ts && ch === '`') { code += ' '; i++; template(); continue; }
    if (ts && ch === '{') { depth++; put(ch); i++; continue; }
    if (ts && ch === '}') {
      depth--;
      if (braces.length && braces.at(-1) === depth) { braces.pop(); code += ' '; i++; template(); continue; }
      put(ch);
      i++;
      continue;
    }
    if (ts && ch === '/') {
      const prev = lastSig;
      // after postfix ++/--, or a non-null `!` that follows an identifier, `)` or `]`, a slash divides
      const before = code.trimEnd();
      const postfix = /(\+\+|--)$/.test(before) || /[\w$)\]]!$/.test(before);
      const regex = !postfix && (prev === '' || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(prev)
        || /^(return|typeof|case|in|of|void|delete|throw|new)$/.test(prev));
      if (regex) {
        let j = i + 1;
        let cls = false;
        while (j < n && text[j] !== '\n' && (cls || text[j] !== '/')) {
          if (text[j] === '\\') j++;
          else if (text[j] === '[') cls = true;
          else if (text[j] === ']') cls = false;
          j++;
        }
        j++;
        while (isIdent(text[j])) j++;
        code += blank(text.slice(i, j));
        lastSig = '"';
        i = j;
        continue;
      }
    }
    if (!ts) {
      // raw strings r"..", r#".."#, br#".."#
      if ((ch === 'r' || (ch === 'b' && nx === 'r')) && !isIdent(text[i - 1])) {
        let j = i + (ch === 'b' ? 2 : 1);
        let h = 0;
        while (text[j] === '#') { h++; j++; }
        if (text[j] === '"') {
          const close = '"' + '#'.repeat(h);
          const e = text.indexOf(close, j + 1);
          const end = e < 0 ? n : e + close.length;
          code += blank(text.slice(i, end));
          lastSig = '"';
          i = end;
          continue;
        }
      }
      if (ch === "'") {
        // a char literal ('x', '\n', '}') or a lifetime ('a)
        if (nx === '\\') {
          const e = text.indexOf("'", i + 3);
          const end = e < 0 ? n : e + 1;
          code += blank(text.slice(i, end));
          i = end;
          continue;
        }
        if (text[i + 2] === "'") { code += '   '; i += 3; continue; }
      }
    }
    if (isIdent(ch) && !isIdent(text[i - 1])) {
      let j = i;
      while (isIdent(text[j])) j++;
      put(text.slice(i, j));
      i = j;
      continue;
    }
    put(ch);
    i++;
  }
  return { code, comments };
}

const countMatches = (s, re) => (s.match(re) ?? []).length;

export function countTs(text) {
  const { code, comments } = scan(text, 'ts');
  return {
    any: countMatches(code, /(?<![.\w$])any(?![\w$])(?!\s*[:(])/g),
    tsExpectError: countMatches(comments, /@ts-expect-error/g),
    tsIgnore: countMatches(comments, /@ts-ignore/g),
    tsNocheck: countMatches(comments, /@ts-nocheck/g),
    eslintDisable: countMatches(comments, /eslint-disable/g),
  };
}

// Blank every item that follows #[cfg(test)]: up to the matching `}` of its body, or its `;`.
function dropCfgTest(code) {
  const re = /#\[\s*cfg\s*\(\s*test\s*\)\s*\]/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(code))) {
    if (m.index < last) continue;
    let j = m.index + m[0].length;
    while (j < code.length && code[j] !== '{' && code[j] !== ';') j++;
    if (code[j] === '{') {
      let d = 0;
      for (; j < code.length; j++) {
        if (code[j] === '{') d++;
        else if (code[j] === '}' && --d === 0) { j++; break; }
      }
    } else j++;
    out += code.slice(last, m.index) + blank(code.slice(m.index, j));
    last = j;
    re.lastIndex = j;
  }
  return out + code.slice(last);
}

export function countRust(text) {
  const { code } = scan(text, 'rust');
  const live = dropCfgTest(code);
  return {
    unwrap: countMatches(live, /\.\s*unwrap\s*\(\s*\)/g),
    expect: countMatches(live, /\.\s*expect\s*\(/g),
    // plain `#[allow(` and the `#[cfg_attr(cond, allow(` form
    allow: countMatches(code, /#\s*!?\s*\[\s*(?:allow\s*\(|cfg_attr\s*\([^\]]*?,\s*allow\s*\()/g),
    expectAttr: countMatches(code, /#\s*!?\s*\[\s*(?:expect\s*\(|cfg_attr\s*\([^\]]*?,\s*expect\s*\()/g),
  };
}

// Counts are { category: { file: n } }. Any difference from the baseline fails: a rise is a new one, a fall means the
// baseline must be lowered (slack would let the count climb back unnoticed).
const total = (m = {}) => Object.values(m).reduce((a, b) => a + b, 0);

// What each count is called in a message for the person, and what to do about a rise.
const WORDS = {
  any: ['`any` in ui/src', 'give it a real type, or `unknown` and check it'],
  unwrap: ['`unwrap()` in non-test Rust', 'return an error with a message instead'],
  expect: ['`expect(` in non-test Rust', 'return an error with a message instead'],
  allow: ['`#[allow(` in Rust', 'use `#[expect(lint, reason = "...")]` or fix the lint'],
  expectAttr: ['`#[expect(` in Rust', 'only the switches listed in CODING_STANDARDS.md are allowed'],
  tsExpectError: ['`@ts-expect-error`', 'fix the type, or give the reason after it and list it in CODING_STANDARDS.md'],
  tsIgnore: ['`@ts-ignore`', 'never allowed; fix the type or use `@ts-expect-error <reason>`'],
  tsNocheck: ['`@ts-nocheck`', 'never allowed; fix the types in the file'],
  eslintDisable: ['`eslint-disable`', 'fix what it hides, or use `eslint-disable-next-line <rule> -- <reason>`'],
};
const NEVER = new Set(['tsIgnore', 'tsNocheck']);

export function compare(base, now) {
  const rose = [];
  const fell = [];
  for (const cat of new Set([...Object.keys(base), ...Object.keys(now)])) {
    const b = base[cat] ?? {};
    const c = now[cat] ?? {};
    const d = total(c) - total(b);
    const [name, fix] = WORDS[cat] ?? [cat, 'remove it'];
    const files = Object.keys(c)
      .map((f) => [f, c[f] - (b[f] ?? 0)])
      .filter(([, x]) => x > 0)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, 5);
    if (d > 0) {
      if (NEVER.has(cat)) {
        rose.push(`${d} new ${name} (${files.map(([f]) => f).join(', ')}): ${fix}.`);
      } else {
        rose.push(`${d} more ${name} than the baseline (${files.map(([f, x]) => `${f} +${x}`).join(', ')}): ${fix}.`);
      }
    } else if (d < 0) {
      fell.push(`${-d} fewer ${name.split(" in ")[0]} than the baseline: lower it with \`node scripts/ratchet.mjs --write\` and commit scripts/ratchet.json.`);
    } else if (files.length) {
      // same total, but a count moved between files: the per-file baseline is stale
      fell.push(`${name} moved between files: update the baseline with \`node scripts/ratchet.mjs --write\` and commit scripts/ratchet.json.`);
    }
  }
  const all = [...rose, ...fell];
  if (all.length) return { ok: false, message: all.join('\n') };
  return { ok: true, message: 'ratchets hold: no count moved.' };
}

function gitFiles(rootDir) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: rootDir, maxBuffer: 1 << 28 }).toString('utf8');
  return out.split('\0').filter(Boolean).filter((f) => existsSync(join(rootDir, f)));
}

// Tracked files that are not ours to clean: vendored code, generated files, and this script (its comments name the
// directives it counts).
const NOT_OURS = [
  /(^|\/)vendor\//, // vendored third-party code
  /(^|\/)dist\//, // built output
  /^app\/src-tauri\/gen\//, // generated by Tauri
  /(^|\/)node_modules\//, // never ours
  /\.min\.[cm]?js$/, // minified bundles
  /^scripts\/ratchet\.mjs$/, // its comments name the directives
];

export function collect(rootDir = root) {
  const now = {};
  const add = (cat, file, n) => {
    if (n > 0) (now[cat] ??= {})[file] = n;
  };
  for (const f of gitFiles(rootDir).filter((p) => !NOT_OURS.some((re) => re.test(p)))) {
    const text = () => readFileSync(join(rootDir, f), 'utf8');
    if (/\.(m?ts|tsx|[cm]?js)$/.test(f) && !f.endsWith('.d.ts')) {
      const c = countTs(text());
      // `any` only in the UI's own source, as the ticket says; the switches everywhere
      if (/^ui\/src\/.*\.ts$/.test(f)) add('any', f, c.any);
      for (const k of ['tsExpectError', 'tsIgnore', 'tsNocheck', 'eslintDisable']) add(k, f, c[k]);
    } else if (f.endsWith('.rs')) {
      const c = countRust(text());
      add('allow', f, c.allow);
      add('expectAttr', f, c.expectAttr);
      // unwrap and expect: non-test code in the crates, the app's src and its build.rs
      const live = /^(crates\/[^/]+\/src\/|app\/src-tauri\/src\/)/.test(f) || f === 'app/src-tauri/build.rs';
      if (live && !/(^|\/)tests?(\.rs|\/)/.test(f)) {
        add('unwrap', f, c.unwrap);
        add('expect', f, c.expect);
      }
    }
  }
  // sorted, so the committed file is small and its diffs are readable
  const sorted = {};
  for (const cat of Object.keys(now).sort()) {
    sorted[cat] = Object.fromEntries(Object.entries(now[cat]).sort(([a], [b]) => a.localeCompare(b)));
  }
  return sorted;
}

function main() {
  const args = process.argv.slice(2);
  const now = collect();
  if (args.includes('--detail')) {
    for (const [cat, files] of Object.entries(now)) {
      console.log(`${cat}: ${total(files)}`);
      for (const [f, n] of Object.entries(files).sort((a, b) => b[1] - a[1])) console.log(`  ${n}  ${f}`);
    }
    return;
  }
  if (args.includes('--write')) {
    writeFileSync(baselinePath, JSON.stringify(now, null, 1) + '\n');
    console.log('baseline written: ' + Object.entries(now).map(([k, v]) => `${k} ${total(v)}`).join(', '));
    return;
  }
  const base = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const r = compare(base, now);
  console.log(r.message);
  process.exitCode = r.ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
