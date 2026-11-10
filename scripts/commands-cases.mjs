// Makes the cases for wb-core's command language from the Python app's own parser (web/commands.js), so the Rust port
// is checked against what the Python app does, not against answers written by hand. Also copies the Python app's manual
// for the capture box (web/help-docs.js) into wb-core, so the window and `wb` share one manual.
//
//   node scripts/commands-cases.mjs [path to the Python repository]
//
// Writes crates/wb-core/tests/commands-cases.json and crates/wb-core/src/manual.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const py = process.argv[2] || path.join(process.env.USERPROFILE || process.env.HOME, 'github', 'bible-workbench');
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

const core = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'crates', 'wb-core');
writeFileSync(path.join(core, 'tests', 'commands-cases.json'), JSON.stringify({ made_by: "scripts/commands-cases.mjs from the Python app's web/commands.js", parse, refs }, null, 1) + '\n');
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
writeFileSync(path.join(core, 'src', 'manual.json'), JSON.stringify({ made_by: "scripts/commands-cases.mjs from the Python app's web/help-docs.js and web/commands.js", commands: COMMANDS, sections: SECTIONS, docs, shortcuts: SHORTCUTS }, null, 1) + '\n');
console.log(`${parse.length} lines, ${refs.length} texts`);
