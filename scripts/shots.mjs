// Where a test or measure script saves a picture (docs/turnaround.md step 2, ticket 8). Tests never change committed
// files: a committed screenshot is written only when WB_SHOTS=1, which `npm run shots` sets on purpose. Any other run
// saves it under test-results/shots/ (ignored), keeping its committed path below that folder. Playwright makes the
// folders when it saves a picture.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** `rel` is the committed path from the repo root (forward slashes); returns the absolute path to save to. */
export function shotPath(rel) {
  return process.env.WB_SHOTS === '1' ? path.join(root, rel) : path.join(root, 'test-results', 'shots', rel);
}

/** A folder a script saves its pictures in; the script joins each picture's name with path.join. */
export function shotsDir(rel) {
  return shotPath(rel);
}
