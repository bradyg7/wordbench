// Optional legacy export of the Python parser/manual snapshots. The checked-in Rust fixtures are canonical and are
// never written by this script. Routine tests use those repository-owned files and need no Python checkout.
//
//   node scripts/commands-cases.mjs --legacy-app PATH --out-dir EMPTY_DIR
//
// Exports under EMPTY_DIR/crates/wb-core/{tests/commands-cases.json,src/manual.json}.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

function options(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!['--legacy-app', '--out-dir'].includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new Error('Usage: node scripts/commands-cases.mjs --legacy-app PATH --out-dir EMPTY_DIR');
    }
    if (out[key]) throw new Error(`Option repeated: ${key}`);
    out[key] = argv[++i];
  }
  if (!out['--legacy-app'] || !out['--out-dir']) {
    throw new Error('Both --legacy-app and --out-dir are required; checked-in Rust fixtures are the maintained source.');
  }
  return out;
}

async function main() {
  const { ['--legacy-app']: legacyArg, ['--out-dir']: outArg } = options(process.argv.slice(2));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repo = realpathSync(path.resolve(scriptDir, '..'));
  const py = path.resolve(legacyArg);
  const requestedOutDir = path.resolve(outArg);
  if (!existsSync(requestedOutDir) || !statSync(requestedOutDir).isDirectory()) {
    throw new Error('--out-dir must be an existing empty directory.');
  }
  const outDir = realpathSync(requestedOutDir);
  const casesOut = path.join(outDir, 'crates', 'wb-core', 'tests', 'commands-cases.json');
  const manualOut = path.join(outDir, 'crates', 'wb-core', 'src', 'manual.json');
  const canonicalCases = path.resolve(repo, 'crates/wb-core/tests/commands-cases.json');
  const canonicalManual = path.resolve(repo, 'crates/wb-core/src/manual.json');
  if ([casesOut, manualOut].some(p => [canonicalCases, canonicalManual].includes(path.resolve(p)))) {
    throw new Error('Refusing to overwrite canonical Rust fixtures.');
  }
  if (readdirSync(outDir).length) throw new Error('--out-dir must be empty.');
  if (existsSync(casesOut) || existsSync(manualOut)) throw new Error('Export targets already exist; choose an empty --out-dir.');
  for (const rel of ['web/commands.js', 'web/help-docs.js', 'tests/books.json', 'tests/commands.test.mjs']) {
    if (!existsSync(path.join(py, rel))) throw new Error(`Missing legacy app input: ${path.join(py, rel)}`);
  }
  const web = f => pathToFileURL(path.join(py, 'web', f)).href;
  const { parseCommand, findRefs, COMMANDS } = await import(web('commands.js'));
  const { DOCS, SECTIONS, SHORTCUTS } = await import(web('help-docs.js'));
  const books = JSON.parse(readFileSync(path.join(py, 'tests', 'books.json'), 'utf8'));
  const testSrc = readFileSync(path.join(py, 'tests', 'commands.test.mjs'), 'utf8');

  // Every line the Python tests give the parser, as written (a quoted first argument), and the ones built in loops.
  const lines = new Set();
  for (const m of testSrc.matchAll(/parseCommand\(\s*'((?:[^'\\]|\\.)*)'/g)) lines.add(m[1].replace(/\\'/g, "'"));
  for (const m of testSrc.matchAll(/\bp\('((?:[^'\\]|\\.)*)'\)/g)) lines.add('thread ' + m[1]);
  const loops = [
    ['def', 'search', 'note', 'open', '?', '+', 'go', 'forms', 'find', 'thread', 'hl', 'first', 'last'],
    ['next', 'prev', 'back', 'undo', 'hl off', 'hl none', 'hl remove', 'hl x'],
    ['set open zeal', 'set close zeal', 'set minimize zeal', 'set restore zeal', 'set delete zeal'],
    ['listen pause', 'listen resume', 'listen stop', 'listen voices'],
    ['minimize threads', 'restore threads', 'dock threads', 'float threads', 'close threads'],
    ['hl #fff', 'hl #12345g', 'hl c0', 'hl c9', 'hl c12', 'hl #e07b39 #336699'],
  ];
  for (const l of loops.flat()) lines.add(l);
  for (const d of DOCS) {
    for (const [typed] of d.examples) lines.add(typed);
    for (const a of d.aka || []) lines.add(a);
  }

  // A book record becomes its code; the rest stays as the parser gave it.
  const norm = v => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      if ('code' in v && 'chapters' in v) return v.code;
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)]));
    }
    return v;
  };
  const parse = [...lines].map(input => {
    const r = parseCommand(input, books);
    return r.error ? { input, error: r.error } : { input, action: norm(r) };
  });

  // Offsets are counted in characters (code points), as Rust's chars().
  const chars = s => [...s].length;
  const texts = new Set();
  for (const m of testSrc.matchAll(/refsIn\('((?:[^'\\]|\\.)*)'\)/g)) texts.add(m[1]);
  for (const m of testSrc.matchAll(/for \(const t of \[([^\]]*)\]\) \{?\s*assert\.deepEqual\(refsIn/g)) for (const q of m[1].matchAll(/'([^']*)'/g)) texts.add(q[1]);
  for (const b of books) texts.add(`see ${b.name} 1:1 here`);
  const refs = [...texts].map(text => ({
    text,
    refs: findRefs(text, books).map(r => ({ start: chars(text.slice(0, r.start)), end: chars(text.slice(0, r.end)), ref: r.ref, hash: r.hash })),
  }));

  mkdirSync(path.dirname(casesOut), { recursive: true });
  mkdirSync(path.dirname(manualOut), { recursive: true });
  writeFileSync(casesOut, JSON.stringify({ made_by: "optional legacy export from web/commands.js", parse, refs }, null, 1) + '\n', { flag: 'wx' });
  // Add routes specific to the Rust window and its terminal before writing the shared manual.
  const docs = DOCS.map(doc => doc.name === 'layout' ? {
    ...doc,
    details: [
      ...doc.details,
      'Use Layout in the toolbar to save or restore an arrangement. Settings → Layouts also lets you remove saved layouts.',
      'Use Focus pane and Return to layout for a temporary focused view. In the command field, use focus <pane> or unfocus. From a terminal, use wb do to relay those commands to the window.',
      'In a terminal, use wb layout list to list arrangements, wb layout show <name> to inspect one, and wb layout rm <name> to remove one.',
      'For a live list of Notebook pages or questions, use a View. Type help views in the command field or wb guide views in a terminal.',
    ],
  } : doc);
  writeFileSync(manualOut, JSON.stringify({ made_by: "optional legacy export from web/help-docs.js and web/commands.js", commands: COMMANDS, sections: SECTIONS, docs, shortcuts: SHORTCUTS }, null, 1) + '\n', { flag: 'wx' });
  console.log(`exported ${parse.length} parser lines and ${refs.length} reference texts under ${outDir}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 2;
});
