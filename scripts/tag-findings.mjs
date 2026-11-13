// Tags each finding with the design folders whose README lists it under "The person's findings that touch it"
// (the findings design, tags, 2026-11-12). Runs `wb finding tag` against WB_STUDY_DIR; prints what it would do with --dry.
// Try it on a scratch copy (scripts/scratch-study.ps1) before the real folder, and back the real folder up first.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const features = path.join(here, '..', 'design', 'features');
const wb = path.join(here, '..', 'target', 'debug', process.platform === 'win32' ? 'wb.exe' : 'wb');
const dry = process.argv.includes('--dry');

const byId = new Map();
for (const folder of fs.readdirSync(features)) {
  const p = path.join(features, folder, 'README.md');
  if (folder.startsWith('_') || !fs.existsSync(p)) continue;
  const text = fs.readFileSync(p, 'utf8');
  const at = text.indexOf("## The person's findings that touch it");
  if (at < 0) continue;
  const section = text.slice(at).split(/\r?\n## /)[0];
  // a row names one finding or several ("| 38c2, 7d00 |"), by the last four characters of the id
  for (const row of section.matchAll(/^\| ([0-9a-f]{4}(?:, [0-9a-f]{4})*)\b/gm)) {
    for (const id of row[1].split(', ')) {
      if (!byId.has(id)) byId.set(id, new Set());
      byId.get(id).add(folder);
    }
  }
}
let n = 0;
const skipped = [];
for (const [id, set] of [...byId].sort()) {
  const tags = [...set].sort();
  if (dry) { console.log(id, tags.join(' ')); continue; }
  try {
    execFileSync(wb, ['finding', 'tag', id, ...tags], { stdio: ['ignore', 'ignore', 'pipe'] });
    n++;
  } catch (e) {
    skipped.push(`${id} (${tags.join(', ')}): ${String(e.stderr ?? e).trim()}`);
  }
}
for (const s of skipped) console.log('skipped', s);
console.log(dry ? `${byId.size} findings would be tagged` : `${n} findings tagged`);
