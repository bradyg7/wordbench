import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./commands-cases.mjs', import.meta.url));
const repo = fileURLToPath(new URL('../', import.meta.url));

function expectRefusal(args, message) {
  assert.throws(
    () => execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' }),
    error => error.status !== 0 && `${error.stdout}${error.stderr}`.includes(message),
  );
}

test('legacy export requires an explicit app and output directory', () => {
  expectRefusal([], 'Both --legacy-app and --out-dir are required');
});

test('legacy export refuses the Rust repository as output because it targets canonical fixtures', () => {
  expectRefusal(['--legacy-app', 'unused', '--out-dir', repo], 'Refusing to overwrite canonical Rust fixtures');
});
