// Where a test or measure script saves a picture (docs/turnaround.md step 2, ticket 8). Tests never change committed
// files: a committed screenshot is written only when WB_SHOTS=1, which `npm run shots` sets on purpose. Any other run
// saves it under test-results/shots/ (ignored), keeping its committed path below that folder.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** `rel` is the committed path from the repo root (forward slashes); returns the absolute path to save to. */
export function shotPath(rel) {
  const target = process.env.WB_SHOTS === '1' ? path.join(root, rel) : path.join(root, 'test-results', 'shots', rel);
  mkdirSync(path.dirname(target), { recursive: true });
  return target;
}

/** A folder (with a trailing slash) a script saves its pictures in, for scripts that name each picture themselves. */
export function shotsDir(rel) {
  return shotPath(rel.replace(/\/?$/, '/') + '.keep').slice(0, -'.keep'.length);
}
