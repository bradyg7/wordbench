// Writes site/public/release.json from the newest release's latest.json.
// Usage: node scripts/site/fetch-release.mjs [latest.json path] [--out file] [--bytes N]
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseRelease, STABLE_DOWNLOAD } from '../../distribution/release.mjs';

const LATEST = 'https://github.com/bradyg7/wordbench-releases/releases/latest/download/latest.json';
const API = 'https://api.github.com/repos/bradyg7/wordbench-releases/releases/latest';

export async function buildRelease({ latest, bytes, macBytes }) {
  const version = String(latest.version ?? '').replace(/^v/, '');
  const date = new Date(latest.pub_date ?? '');
  if (Number.isNaN(date.getTime())) throw new Error('latest.json has no valid pub_date.');
  const publishedAt = date.toISOString().replace(/\.\d+Z$/, 'Z');
  const out = { schemaVersion: 2, status: 'published', version, publishedAt };
  if (Number.isSafeInteger(bytes) && bytes > 0) out.bytes = bytes;
  if (latest.platforms && 'darwin-aarch64' in latest.platforms) {
    out.mac = true;
    if (Number.isSafeInteger(macBytes) && macBytes > 0) out.macBytes = macBytes;
  }
  out.downloadUrl = STABLE_DOWNLOAD;
  out.minimumWindows = '10';
  return parseRelease(out);
}

async function main() {
  const args = process.argv.slice(2);
  const take = name => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
  const outPath = resolve(take('--out') ?? fileURLToPath(new URL('../../site/public/release.json', import.meta.url)));
  const bytesArg = take('--bytes');
  const source = args[0];
  let result = { schemaVersion: 2, status: 'unavailable' };
  try {
    let latest;
    if (source) latest = JSON.parse(await readFile(source, 'utf8'));
    else {
      const response = await fetch(LATEST, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`latest.json: HTTP ${response.status}`);
      latest = await response.json();
    }
    let bytes = bytesArg ? Number(bytesArg) : undefined;
    let macBytes;
    if (bytes === undefined && !source) {
      try {
        const r = await fetch(API, { headers: { accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20000) });
        if (r.ok) {
          const assets = (await r.json()).assets;
          bytes = assets?.find(a => a.name === 'Bible-Workbench-setup.exe')?.size;
          macBytes = assets?.find(a => a.name === 'Wordbench-mac.dmg')?.size;
        }
      } catch { /* size is optional */ }
    }
    result = await buildRelease({ latest, bytes, macBytes });
  } catch (error) {
    console.error(`Release not available: ${error.message}`);
  }
  await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${outPath}: ${result.status}${result.version ? ` ${result.version}` : ''}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
