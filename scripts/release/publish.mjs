// Publishes the built, signed installers to the public releases repository (run by the `publish` job of
// .github/workflows/release.yml). Usage: node scripts/release/publish.mjs <directory>  (or WB_ARTIFACTS=<directory>).
// The directory holds what the two build jobs uploaded: `windows/` (the NSIS setup exe and its .sig) and `mac/`
// (the .dmg, the .app.tar.gz and its .sig). It writes ONE latest.json, the file every installed app reads to learn of
// an update (design/features/updates U-17, design/features/mac M-5), listing windows-x86_64, darwin-aarch64 and
// darwin-x86_64 (a universal app serves both Macs), and creates one release with every file. The installer and the
// dmg are each uploaded twice, under their version and under a stable name, so the website's Download links
// (releases/latest/download/Bible-Workbench-setup.exe, .../Wordbench-mac.dmg) never need editing. The Mac files are
// named Wordbench from the start.
import { readFileSync, readdirSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO = 'bradyg7/wordbench-releases';

// The names of the published files for a version.
export function assetNames(version) {
  return {
    winSetup: `Bible-Workbench-${version}-setup.exe`,
    winSig: `Bible-Workbench-${version}-setup.exe.sig`,
    winStable: 'Bible-Workbench-setup.exe',
    macDmg: `Wordbench-${version}-mac.dmg`,
    macStable: 'Wordbench-mac.dmg',
    macUpdate: `Wordbench-${version}-mac.app.tar.gz`,
    macSig: `Wordbench-${version}-mac.app.tar.gz.sig`,
  };
}

// latest.json: a pure function of the version, notes, date and the two signatures.
export function buildLatest({ version, notes, pubDate, winSignature, macSignature, repo = REPO }) {
  const names = assetNames(version);
  const base = `https://github.com/${repo}/releases/download/v${version}`;
  const mac = { signature: macSignature, url: `${base}/${names.macUpdate}` };
  return {
    version,
    notes,
    pub_date: pubDate,
    platforms: {
      'windows-x86_64': { signature: winSignature, url: `${base}/${names.winSetup}` },
      'darwin-aarch64': { ...mac },
      'darwin-x86_64': { ...mac },
    },
  };
}

function only(dir, suffix) {
  const found = readdirSync(dir).filter(f => f.endsWith(suffix));
  if (found.length !== 1) throw new Error(`Expected one *${suffix} in ${dir}, found ${found.length}`);
  return join(dir, found[0]);
}

function main() {
  const root = resolve(process.argv[2] ?? process.env.WB_ARTIFACTS ?? '');
  if (!process.argv[2] && !process.env.WB_ARTIFACTS) throw new Error('Give the artifacts directory: publish.mjs <directory>');
  const version = JSON.parse(readFileSync('app/src-tauri/tauri.conf.json', 'utf8')).version;
  const tag = `v${version}`;
  const names = assetNames(version);
  const win = join(root, 'windows');
  const mac = join(root, 'mac');
  const exe = only(win, '-setup.exe');
  const dmg = only(mac, '.dmg');
  const update = only(mac, '.app.tar.gz');
  const winSignature = readFileSync(`${exe}.sig`, 'utf8').trim();
  const macSignature = readFileSync(`${update}.sig`, 'utf8').trim();

  const out = join(root, 'publish');
  mkdirSync(out, { recursive: true });
  copyFileSync(exe, join(out, names.winSetup));
  copyFileSync(exe, join(out, names.winStable));
  writeFileSync(join(out, names.winSig), winSignature);
  copyFileSync(dmg, join(out, names.macDmg));
  copyFileSync(dmg, join(out, names.macStable));
  copyFileSync(update, join(out, names.macUpdate));
  writeFileSync(join(out, names.macSig), macSignature);
  const notes = readFileSync(`docs/releases/${version}.md`, 'utf8');
  writeFileSync(join(out, 'latest.json'), JSON.stringify(buildLatest({
    version, notes, pubDate: new Date().toISOString(), winSignature, macSignature,
  }), null, 2));

  execFileSync('gh', [
    'release', 'create', tag, '-R', REPO, '--title', `Bible Workbench ${version}`, '--notes-file', `docs/releases/${version}.md`,
    ...[names.winSetup, names.winSig, names.winStable, names.macDmg, names.macStable, names.macUpdate, names.macSig, 'latest.json'].map(f => join(out, f)),
  ], { stdio: 'inherit' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
