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
  // every kind of mark and a legend (design/features/marks T5); the places are anchors, no scripture is typed
  wb('legend', 'add', '--kind', 'underline', '--color', 'blue', '--lines', '2', '--name', 'Fixture double');
  wb('legend', 'add', '--kind', 'box', '--color', '#cc3322', '--name', 'Fixture box');
  // six more entries, so the mark bar's drop-downs and the Legend are tried with eight (marks T6); none is a style a mark above uses
  for (const [kind, color, name, lines] of [['highlight', 'pink', 'Fixture promise'], ['highlight', 'blue', 'Fixture later'], ['underline', '#7a1f1f', 'Fixture repeated', '1'], ['circle', 'green', 'Fixture person'], ['circle', 'blue', 'Fixture place'], ['box', 'orange', 'Fixture orange box']]) {
    wb('legend', 'add', '--kind', kind, '--color', color, '--name', name, ...(lines ? ['--lines', lines] : []));
  }
  wb('legend', 'set', 'Fixture promise', '--quick', 'on');
  wb('legend', 'set', 'Fixture repeated', '--quick', 'on');
  for (const args of [
    ['NUM.25:7', '--kind', 'highlight', '--color', 'yellow'],
    ['NUM.25:6.1-25:6.4', '--kind', 'underline', '--color', '#cc3322', '--lines', '1'],
    ['NUM.25:8.1-25:8.5', '--style', 'Fixture double'],
    ['NUM.25:9.1-25:9.5', '--kind', 'underline', '--color', 'green', '--lines', '3'],
    ['NUM.25:11.2-25:11.5', '--kind', 'circle', '--color', 'orange'],
    ['NUM.25:12.1-25:12.4', '--style', 'Fixture box'],
    ['NUM.25:6', '--kind', 'arrow', '--color', 'blue', '--to', 'NUM.25:11'],
  ]) wb('mark', 'add', ...args);
  // two margin notes (marks T4, T12): one on a verse, one on a span of verses; their words are the person's, never scripture
  wb('mark', 'note', 'NUM.25:11', 'A margin note written for the fixture.');
  wb('mark', 'note', 'NUM.25:10-12', 'A span note written for the fixture.');
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
  // one page that shows what marks adds to a page: scripture named in a paragraph and in a block, and the numbers the Notebook
  // asks for when it draws it (design/features/marks)
  const marksPage = JSON.parse(wb('page', 'new', ['Marks page', '', 'See Numbers 25:11 and Psalm 119:105.', '', '```scripture', 'Numbers 25:10-12', 'marks', '```', '', 'Also Romans 10:2 and Exodus 20:3.'].join('\n'), '--json')).id;
  mkdirSync(new URL('wb/', out), { recursive: true });
  writeFileSync(new URL('wb/marks-page.json', out), JSON.stringify({ id: marksPage }));
  const named = argv => argv.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  for (const argv of [
    ['page', 'overview', marksPage], ['page', 'blocks', marksPage], ['page', 'scripture', marksPage], ['note', 'show', marksPage],
    ['page', 'tree'], ['notebook', 'sidebar', '--at', 'NUM 25'], ['parse', 'go Psalms 119:105'], ['find', '--sort', 'edited'], ['find', '--kind', 'page'],
    // finding marks and margin notes, and what is on a verse (marks T12, rows 51 to 53)
    ['find', '--kind', 'mark'], ['find', '--kind', 'mark', '--style', 'underline:blue:2'], ['find', '--kind', 'mark', '--mark-kind', 'underline'],
    ['find', '--kind', 'mark', '--book', 'Numbers'], ['find', '--kind', 'mark', '--book', 'Psalms'], ['find', '--kind', 'mark', '--since', '2020-01-01'],
    ['find', '--kind', 'mark', '--until', '2020-01-01'], ['find', '--kind', 'margin'], ['mark', 'at', 'NUM.25:11'], ['mark', 'notes', 'Numbers 25'], ['mark', 'at', 'NUM.25:13'],
    // Colors across the Bible (marks T14, rows 57 and 58): the whole map, one style, one folder
    ['marks', 'map'], ['marks', 'map', '--style', 'underline:blue:2'], ['marks', 'map', '--style', 'highlight:yellow'], ['marks', 'map', '--folder', 'thread:fixture-thread'],
    ['legend'], ['settings', 'marks'], ['legend', 'uses', 'underline:blue:2'], ['legend', 'uses', 'box:#cc3322'], ['legend', 'uses', 'highlight:yellow'],
    ['concordance', 'letters'], ['settings', 'concordance'],
    ['concordance', 'zeal', '--forms', 'all'], ['concordance', 'zeal', '--forms', 'one'], ['concordance', 'zealous', '--forms', 'one'],
    ['concordance', 'heart', '--forms', 'one'], ['concordance', 'heart', '--forms', 'one', '--book', 'PSA'], ['concordance', 'and', '--forms', 'all'], ['concordance', 'and', '--forms', 'one'],
    ['concordance', 'box', 'zea'], ['concordance', 'box', 'zealous'], ['concordance', 'box', 'H7068'], ['concordance', 'box', 'kanna'],
    ['strong', 'H7068'], ['strong', 'H7068', '--next'], ['strong', 'H7068', '--prev'], ['strong', '--list', 'hebrew'], ['strong', '--list', 'greek'],
    ['uses', 'H7068', '--by', 'word'], ['uses', 'H7068', '--by', 'book'], ['uses', 'H7068', '--by', 'word', '--group', 'jealousy'],
    ['forms', 'j'], ['forms', 'x'],
    ['interlinear', 'Numbers 25:11'], ['interlinear', 'Numbers 25:11-12'], ['interlinear', 'Numbers 25'],
    // the Scripture block's field previews what it names (notebook row 7)
    ['scripture', 'Joshua 1:9'], ['scripture', 'Numbers 25:11-13'], ['scripture', 'Numbers 25:18-26:1'],
    ['scripture', '2SA 21:2'], ['scripture', 'NUM 5:14'], ['text', 'Numbers 25:11', '--json'], ['text', '2SA 21:2', '--json'],
  ]) writeFileSync(new URL(`${named(argv)}.json`, help), wb(...argv, '--json'));
} finally {
  const resolved = realpathSync(study);
  if (dirname(resolved) === fixtureRoot) rmSync(resolved, { recursive: true, force: true });
}
