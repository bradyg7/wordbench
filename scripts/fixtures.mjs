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
    ...['help', 'help view', 'help threads', 'help The Shelf', 'help vie', 'help t', 'help layout',
      'listen Numbers 25:11-12', 'listen Numbers 26:1', 'listen pause', 'listen resume', 'listen stop', 'back',
      'packet John 3 ; document:Study Slides'].map(line => ['parse', line]),
  ]) {
    const name = args.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    writeFileSync(new URL(`${name}.json`, help), wb(...args));
  }
} finally {
  const resolved = realpathSync(study);
  if (dirname(resolved) === fixtureRoot) rmSync(resolved, { recursive: true, force: true });
}
