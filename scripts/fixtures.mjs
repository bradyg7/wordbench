// Generates the UI's test data from the database with `wb fixture` (scripture is never typed into a fixture).
// Uses a fresh synthetic study folder so fixture assertions do not depend on personal study data.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = new URL('../ui/public/fixtures/', import.meta.url);
mkdirSync(out, { recursive: true });
const target = fileURLToPath(new URL('../target/', import.meta.url));
mkdirSync(target, { recursive: true });
const fixtureRoot = realpathSync(target);
const study = mkdtempSync(join(fixtureRoot, 'browser-fixtures-'));
const env = { ...process.env, WB_STUDY_DIR: study };
const wb = (...args) => execFileSync('cargo', ['run', '-q', '--release', '-p', 'wb-cli', '--', ...args], { env, maxBuffer: 1 << 28 }).toString();
try {
  wb('hl', 'set', 'Numbers 25:11', 'green');
  wb('note', 'add', 'NUM.25:11.24', 'Synthetic reader fixture note.');
  // the margin (design/features/marks): margin notes and pages at Numbers 25:11, as generated text, no scripture
  for (const [at, text] of [['Numbers 25:11', 'First margin note (synthetic).'], ['Numbers 25:11', 'Second margin note (synthetic).'], ['Numbers 25:10-13', 'A note on the passage (synthetic).'], ['Numbers 25', 'A note on the chapter (synthetic).']]) wb('margin', 'add', at, text);
  wb('thread', 'new', 'Fixture thread', '--at', 'Numbers 25:12', '--color', '#654321');
  for (const [book, ch] of [['NUM', 25], ['NUM', 24], ['NUM', 26], ['PSA', 119]]) {
    writeFileSync(new URL(`${book}.${ch}.json`, out), wb('fixture', book, String(ch)));
    console.log('fixture', book, ch);
  }
  writeFileSync(new URL('books.json', out), wb('books'));

  const help = new URL('wb/', out);
  mkdirSync(help, { recursive: true });
  for (const args of [
    ['guide', '--json'], ['manual'],
    // the cards of design/features/words: the verse card and the word card's lookups
    ['scripture', 'Num 25:11'], ['interlinear', 'Num 25:11'], ['word-define', '--verse', 'Num 25:11'], ['word-define', 'zealous'],
    ['strong', 'H7065'], ['anchor', 'Num', '25:11', '--pages'], ['anchor', 'H7065', '--pages'],
    ...['help', 'help view', 'help threads', 'help The Shelf', 'help vie', 'help t', 'help layout',
      'listen Numbers 25:11-12', 'listen Numbers 26:1', 'listen pause', 'listen resume', 'listen stop', 'back',
      'packet John 3 ; document:Study Slides'].map(line => ['parse', line]),
  ]) {
    const name = args.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    writeFileSync(new URL(`${name}.json`, help), wb(...args));
  }

  // The Concordance (design/features/concordance): every `wb` answer its page asks for, named as ui/src/api.ts names them.
  // three pages that name Numbers 25:11, made after the cards' fixtures above (those say that no page names it yet)
  for (const k of [1, 2, 3]) wb('page', 'new', `Fixture page ${k}

Names Numbers 25:11 here.`);
  const named = argv => argv.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  for (const argv of [
    ['margin', 'NUM 25'], ['margin', 'NUM 25:11'], ['margin', 'list'], ['settings', 'margin'],
    ['concordance', 'letters'], ['settings', 'concordance'],
    ['concordance', 'zeal', '--forms', 'all'], ['concordance', 'zeal', '--forms', 'one'], ['concordance', 'zealous', '--forms', 'one'],
    ['concordance', 'heart', '--forms', 'one'], ['concordance', 'heart', '--forms', 'one', '--book', 'PSA'], ['concordance', 'and', '--forms', 'all'], ['concordance', 'and', '--forms', 'one'],
    ['concordance', 'box', 'zea'], ['concordance', 'box', 'zealous'], ['concordance', 'box', 'H7068'], ['concordance', 'box', 'kanna'],
    ['strong', 'H7068'], ['strong', 'H7068', '--next'], ['strong', 'H7068', '--prev'], ['strong', '--list', 'hebrew'], ['strong', '--list', 'greek'],
    ['uses', 'H7068', '--by', 'word'], ['uses', 'H7068', '--by', 'book'], ['uses', 'H7068', '--by', 'word', '--group', 'jealousy'],
    ['forms', 'j'], ['forms', 'x'],
    ['interlinear', 'Numbers 25:11'], ['interlinear', 'Numbers 25:11-12'], ['interlinear', 'Numbers 25'],
    ['scripture', '2SA 21:2'], ['scripture', 'NUM 5:14'], ['text', 'Numbers 25:11', '--json'], ['text', '2SA 21:2', '--json'],
  ]) writeFileSync(new URL(`${named(argv)}.json`, help), wb(...argv, '--json'));
} finally {
  const resolved = realpathSync(study);
  if (dirname(resolved) === fixtureRoot) rmSync(resolved, { recursive: true, force: true });
}
