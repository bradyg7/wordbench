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
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
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
      const regex = prev === '' || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(prev)
        || /^(return|typeof|case|in|of|void|delete|throw|new)$/.test(prev);
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
    allow: countMatches(code, /#\s*!?\s*\[\s*allow\s*\(/g),
    expectAttr: countMatches(code, /#\s*!?\s*\[\s*expect\s*\(/g),
  };
}

// Counts are { category: { file: n } }. A rise is any category total above the baseline's.
const total = (m = {}) => Object.values(m).reduce((a, b) => a + b, 0);

export function compare(base, now) {
  const rose = [];
  const fell = [];
  for (const cat of new Set([...Object.keys(base), ...Object.keys(now)])) {
    const b = base[cat] ?? {};
    const c = now[cat] ?? {};
    const d = total(c) - total(b);
    if (d > 0) {
      const files = Object.keys(c)
        .map((f) => [f, c[f] - (b[f] ?? 0)])
        .filter(([, x]) => x > 0)
        .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
        .slice(0, 5)
        .map(([f, x]) => `${f} (+${x})`);
      rose.push(`${cat} rose by ${d} (${total(b)} to ${total(c)}); most in ${files.join(', ')}`);
    } else if (d < 0) fell.push(`${cat} fell by ${-d} (${total(b)} to ${total(c)})`);
  }
  if (rose.length) {
    return {
      ok: false,
      message: rose.join('\n') + '\nRemove the new ones (a real type, or a handled error); the counts only go down.',
    };
  }
  if (fell.length) {
    return { ok: true, message: fell.join('\n') + '\nlower the baseline: node scripts/ratchet.mjs --write' };
  }
  return { ok: true, message: 'ratchets hold: no count rose.' };
}

function walk(dir, ok, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'target') continue;
      walk(p, ok, out);
    } else if (ok(p)) out.push(p);
  }
  return out;
}

export function collect(rootDir = root) {
  const rel = (p) => relative(rootDir, p).replaceAll('\\', '/');
  const now = {};
  const add = (cat, file, n) => {
    if (n > 0) (now[cat] ??= {})[file] = n;
  };
  for (const p of walk(join(rootDir, 'ui', 'src'), (f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))) {
    for (const [k, v] of Object.entries(countTs(readFileSync(p, 'utf8')))) add(k, rel(p), v);
  }
  // Checker switches count in all Rust code (tests too); unwrap and expect only in non-test files.
  const rsDirs = [join(rootDir, 'app', 'src-tauri', 'src')];
  const crates = join(rootDir, 'crates');
  for (const c of existsSync(crates) ? readdirSync(crates) : []) rsDirs.push(join(crates, c));
  // a file named tests.rs, or inside a tests/ folder, is test code
  const isTestFile = (f) => /(^|\/)tests?(\.rs|\/)/.test(rel(f));
  for (const d of rsDirs) {
    for (const p of walk(d, (f) => f.endsWith('.rs'))) {
      const c = countRust(readFileSync(p, 'utf8'));
      const inSrc = /(^|\/)src\//.test(rel(p));
      for (const [k, v] of Object.entries(c)) {
        if ((k === 'unwrap' || k === 'expect') && (isTestFile(p) || !inSrc)) continue;
        add(k, rel(p), v);
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
