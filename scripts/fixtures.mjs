// Generates the UI's test data from the database with `wb fixture` (scripture is never typed into a fixture).
// Reads the scratch study folder (WB_STUDY_DIR, or the default scratch copy).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = new URL('../ui/public/fixtures/', import.meta.url);
mkdirSync(out, { recursive: true });
const wb = (...args) => execFileSync('cargo', ['run', '-q', '--release', '-p', 'wb-cli', '--', ...args], { maxBuffer: 1 << 28 }).toString();
for (const [book, ch] of [['NUM', 25], ['NUM', 24], ['NUM', 26], ['PSA', 119]]) {
  writeFileSync(new URL(`${book}.${ch}.json`, out), wb('fixture', book, String(ch)));
  console.log('fixture', book, ch);
}
writeFileSync(new URL('books.json', out), JSON.stringify({ data: JSON.parse(wb('books')) }.data));
