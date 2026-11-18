// Publishes a built, signed installer to the public releases repository (run by .github/workflows/release.yml).
// It writes latest.json, the file every installed app reads to learn of an update (design/features/updates U-17), and
// uploads the installer twice: under its version, and as Bible-Workbench-setup.exe, so the website's Download link
// (releases/latest/download/Bible-Workbench-setup.exe) never needs editing.
import { readFileSync, readdirSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = 'bradyg7/wordbench-releases';
const version = JSON.parse(readFileSync('app/src-tauri/tauri.conf.json', 'utf8')).version;
const tag = `v${version}`;
const nsis = 'target/release/bundle/nsis';
const exe = readdirSync(nsis).find(f => f.endsWith('-setup.exe'));
if (!exe) throw new Error(`No installer in ${nsis}`);
const signature = readFileSync(join(nsis, `${exe}.sig`), 'utf8').trim();
const notes = readFileSync(`docs/releases/${version}.md`, 'utf8');

const out = 'target/release/publish';
mkdirSync(out, { recursive: true });
const versioned = join(out, `Bible-Workbench-${version}-setup.exe`);
const stable = join(out, 'Bible-Workbench-setup.exe');
copyFileSync(join(nsis, exe), versioned);
copyFileSync(join(nsis, exe), stable);
writeFileSync(join(out, `Bible-Workbench-${version}-setup.exe.sig`), signature);
writeFileSync(join(out, 'latest.json'), JSON.stringify({
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url: `https://github.com/${REPO}/releases/download/${tag}/Bible-Workbench-${version}-setup.exe`,
    },
  },
}, null, 2));

execFileSync('gh', [
  'release', 'create', tag, '-R', REPO, '--title', `Bible Workbench ${version}`, '--notes-file', `docs/releases/${version}.md`,
  versioned, `${versioned}.sig`, stable, join(out, 'latest.json'),
], { stdio: 'inherit' });
