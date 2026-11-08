#!/usr/bin/env node
// Builds the Windows installer the landing page offers, and the update file the app reads, for GitHub:
//
//   npm run release -- --db "C:\path\to\workbench.db"
//
// The landing page in site/ is published to GitHub Pages by .github/workflows/pages.yml. The installer is far too big
// for a Pages site (and larger than GitHub's 100 MB per-file limit for a repository), so it and the update file become
// assets of a GitHub release; the page and the app both read them from `releases/latest/download/`.
//
// The files are written to dist/release/, and the script prints the one `gh release create` line that publishes them.
// It uploads nothing itself. `npm run check:release` runs the checks without building. Signing happens with
// TAURI_SIGNING_PRIVATE_KEY set in the environment; see PACKAGING.md.
import { execFileSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || !args[i + 1] || args[i + 1].startsWith('--')) return fallback;
  return args[i + 1];
};
const checkOnly = flag('check');

const PLATFORM = 'windows-x86_64';
const STABLE = 'Bible-Workbench-setup.exe';
const releaseDir = join(repo, 'dist/release');
const manifestPath = join(releaseDir, 'latest.json');
const pagePath = join(repo, 'site/index.html');

const rows = [];
const add = (ok, what, detail = '') => rows.push({ ok, what, detail });
function report() {
  for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.what}${r.detail ? ` — ${r.detail}` : ''}`);
}
function die(message) {
  report();
  console.error(`\n${message}\n`);
  process.exit(1);
}
function say(message = '') {
  console.log(message);
}
function run(command, argv, options = {}) {
  say(`$ ${command} ${argv.join(' ')}`);
  const output = execFileSync(command, argv, {
    cwd: repo,
    shell: options.shell || false,
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    maxBuffer: 1 << 28,
  });
  return output ? output.toString() : '';
}

// ---- the configuration ---------------------------------------------------------------------------------------------
const conf = JSON.parse(readFileSync(join(repo, 'app/src-tauri/tauri.conf.json'), 'utf8'));
const version = conf.version;
const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
const cargo = readFileSync(join(repo, 'Cargo.toml'), 'utf8');
const cargoVersion = (cargo.match(/\[workspace\.package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/) || [])[1];
add(
  !!version && pkg.version === version && cargoVersion === version,
  'The versions agree (Cargo.toml, package.json, tauri.conf.json)',
  `Cargo.toml ${cargoVersion || '(none)'}, package.json ${pkg.version || '(none)'}, tauri.conf.json ${version || '(none)'}`
);

// The app's endpoint is the one place the host is written; the page's link and the update file's URL come from it.
const updater = conf.plugins?.updater || {};
const endpoints = Array.isArray(updater.endpoints) ? updater.endpoints : [];
const endpoint = endpoints[0] || '';
const github = String(endpoint).match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/releases\/latest\/download\/latest\.json$/i) || [];
const host = github.length ? `https://github.com/${github[1]}/${github[2]}` : '';
const releaseBase = github.length ? `${host}/releases/latest/download/` : '';
const downloadUrl = releaseBase ? `${releaseBase}${STABLE}` : '';

add(
  !!releaseBase,
  'The update endpoint is a GitHub release asset',
  releaseBase
    ? endpoint
    : `${endpoint || '(none)'} — plugins.updater.endpoints in tauri.conf.json must be https://github.com/<owner>/<repo>/releases/latest/download/latest.json`
);
add(
  !!String(updater.pubkey || '').trim(),
  'The updater public key is set',
  updater.pubkey ? '' : 'generate a key pair with `npm run tauri signer generate` and put the public key in plugins.updater.pubkey'
);
add(conf.bundle?.createUpdaterArtifacts === true, 'Updater artifacts are built', String(conf.bundle?.createUpdaterArtifacts));
add(conf.bundle?.active === true, 'Bundling is on', String(conf.bundle?.active));
add(Array.isArray(conf.bundle?.targets) && conf.bundle.targets.includes('nsis'), 'The NSIS installer is a bundle target', '');
const dbResource = conf.bundle?.resources?.['../../datasets/workbench.db'];
add(dbResource === 'datasets/workbench.db', 'The Bible database is bundled beside the program', dbResource || 'bundle.resources has no ../../datasets/workbench.db');

// ---- the landing page ----------------------------------------------------------------------------------------------
const page = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';
const count = pattern => (page.match(pattern) || []).length;
const links = [...page.matchAll(/<a\b[^>]*\bdata-release="link"[^>]*>/g)].map(m => (m[0].match(/href="([^"]*)"/) || [])[1]);
add(count(/data-release="version"/g) === 1, 'The page has one version marker', `${count(/data-release="version"/g)} found`);
add(count(/data-release="size"/g) === 1, 'The page has one size marker', `${count(/data-release="size"/g)} found`);
add(links.length > 0, 'The page has download links', `${links.length} found`);
add(
  !!downloadUrl && links.length > 0 && links.every(href => href === downloadUrl),
  'The page links to the release download',
  links.length ? `${links[0]}${links.every(href => href === downloadUrl) ? '' : ` (expected ${downloadUrl})`}` : 'no data-release="link" anchor'
);

// ---- the update file -----------------------------------------------------------------------------------------------
function notesFor(v) {
  if (!existsSync(join(repo, 'CHANGELOG.md'))) return '';
  const text = readFileSync(join(repo, 'CHANGELOG.md'), 'utf8');
  const sections = text.split(/^## /m).slice(1);
  const section = sections.find(s => s.split('\n')[0].includes(v));
  if (!section) return '';
  const body = section.split('\n').slice(1).join('\n');
  return body
    .split('\n')
    .map(line => line.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '').replace(/`/g, '').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000);
}

function manifestProblem(manifest, files) {
  if (!manifest.version) return 'no version';
  if (manifest.version !== version) return `version ${manifest.version} but the app is ${version}`;
  if (manifest.pub_date && Number.isNaN(Date.parse(manifest.pub_date))) return 'pub_date is not a date';
  const platform = manifest.platforms?.[PLATFORM];
  if (!platform) return `no platforms.${PLATFORM}`;
  if (!platform.signature || platform.signature.length < 40) return 'no signature';
  const expected = `${releaseBase}Bible-Workbench-${version}-x64-setup.exe`;
  if (platform.url !== expected) return `the download url should be ${expected}`;
  if (!files.includes(`Bible-Workbench-${version}-x64-setup.exe`)) return 'the installer the url names is not in dist/release';
  return null;
}

const artifactRows = () => {
  const files = existsSync(releaseDir) ? readdirSync(releaseDir) : [];
  const versioned = `Bible-Workbench-${version}-x64-setup.exe`;
  return { files, versioned };
};

// ---- build and write -----------------------------------------------------------------------------------------------
if (!checkOnly) {
  if (process.platform !== 'win32') {
    die('The installer is the Windows build: run `npm run release` on Windows, or `npm run check:release` to check the pieces.');
  }
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
    die('No signing key: set TAURI_SIGNING_PRIVATE_KEY (the path to, or the contents of, the updater private key). See PACKAGING.md.');
  }
  if (!releaseBase) die('The update endpoint is not a GitHub release asset, so there is nothing to publish against.');

  // The database is not in git: find it, then put it where bundle.resources expects it.
  const db = [
    value('db'),
    process.env.WB_BIBLE_DB,
    join(repo, 'datasets/workbench.db'),
    resolve(repo, '..', 'bible-workbench/datasets/workbench.db'),
    resolve(repo, '..', 'bible-workbench-rs/datasets/workbench.db'),
  ].filter(Boolean).find(p => existsSync(p) && statSync(p).isFile());
  if (!db) die('No Bible database found. Point at one with --db, or set WB_BIBLE_DB.');
  const fd = openSync(db, 'r');
  const magic = Buffer.alloc(16);
  readSync(fd, magic, 0, 16, 0);
  closeSync(fd);
  if (magic.toString('latin1') !== 'SQLite format 3\u0000') die(`${db} is not a SQLite database.`);
  if (statSync(db).size < 1024 * 1024) die(`${db} is only ${statSync(db).size} bytes; the Bible database is about 118 MB.`);
  say(`Bible database: ${db} (${(statSync(db).size / 1024 / 1024).toFixed(1)} MB)`);

  const staged = join(repo, 'datasets/workbench.db');
  if (resolve(db) !== resolve(staged)) {
    mkdirSync(dirname(staged), { recursive: true });
    copyFileSync(db, staged);
    say(`Copied the database to ${staged} for the bundler.`);
  }

  const npm = 'npm.cmd';
  run(npm, ['ci'], { shell: true });
  run(npm, ['run', 'build'], { shell: true });
  // wb.exe ships in the installer, so it is built before the bundle reads it.
  run('cargo', ['build', '--release', '-p', 'wb-cli']);
  const tauriCli = join(repo, 'node_modules/@tauri-apps/cli/tauri.js');
  if (!existsSync(tauriCli)) die('No Tauri CLI at node_modules/@tauri-apps/cli/tauri.js. Run npm ci first.');
  run(process.execPath, [tauriCli, 'build']);

  // ---- the installer and its signature -----------------------------------------------------------------------------
  const nsisDir = join(repo, 'target/release/bundle/nsis');
  if (!existsSync(nsisDir)) die(`No ${nsisDir}: the bundle did not run.`);
  const setups = readdirSync(nsisDir).filter(n => n.endsWith('-setup.exe'));
  const chosen = setups.find(n => n.includes(`_${version}_`));
  if (!chosen) die(`No ${version} installer in ${nsisDir}: found ${setups.join(', ') || 'nothing'}.`);
  const sigName = `${chosen}.sig`;
  if (!existsSync(join(nsisDir, sigName))) {
    die(`No ${sigName}: the build must sign with TAURI_SIGNING_PRIVATE_KEY (createUpdaterArtifacts is on).`);
  }
  const signature = readFileSync(join(nsisDir, sigName), 'utf8').trim();
  if (signature.length < 40) die(`The signature in ${sigName} looks empty.`);

  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(releaseDir, { recursive: true });
  const versioned = `Bible-Workbench-${version}-x64-setup.exe`;
  copyFileSync(join(nsisDir, chosen), join(releaseDir, versioned));
  copyFileSync(join(nsisDir, chosen), join(releaseDir, STABLE));
  writeFileSync(join(releaseDir, `${versioned}.sig`), `${signature}\n`);
  const size = statSync(join(releaseDir, versioned)).size;
  say(`\nInstaller: dist/release/${versioned} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  say(`Stable name: dist/release/${STABLE} — the page's link`);

  // ---- the update file ---------------------------------------------------------------------------------------------
  const notes = notesFor(version);
  const manifest = {
    version,
    notes,
    pub_date: new Date().toISOString(),
    platforms: {
      [PLATFORM]: { signature, url: `${releaseBase}${versioned}` },
    },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(releaseDir, 'notes.md'), `# Bible Workbench ${version}\n\n${notes || 'See CHANGELOG.md.'}\n`);

  // ---- the page ----------------------------------------------------------------------------------------------------
  // The version, the size and the links, so the page follows the endpoint it is built against.
  let html = page;
  html = html.replace(/(<span data-release="version">)[^<]*(<\/span>)/g, `$1${version}$2`);
  html = html.replace(/(<span data-release="size">)[^<]*(<\/span>)/g, `$1${(size / 1024 / 1024).toFixed(0)} MB$2`);
  html = html.replace(/<a\b[^>]*\bdata-release="link"[^>]*>/g, tag => tag.replace(/href="[^"]*"/, `href="${downloadUrl}"`));
  if (html !== page) writeFileSync(pagePath, html);
}

// ---- the checks ----------------------------------------------------------------------------------------------------
const { files, versioned } = artifactRows();
add(files.includes(versioned), 'The versioned installer is built', versioned);
add(files.includes(STABLE), 'The installer carries the page\'s stable name', STABLE);
add(files.includes(`${versioned}.sig`), 'The installer\'s signature is beside it', `${versioned}.sig`);

if (existsSync(manifestPath)) {
  let manifest = null;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    add(true, 'The update file is JSON', '');
  } catch (e) {
    add(false, 'The update file is JSON', String(e));
  }
  if (manifest) {
    const problem = manifestProblem(manifest, files);
    add(!problem, 'The update file is complete and matches this release', problem || `${manifest.version} · ${manifest.platforms[PLATFORM].url}`);
  }
}

if (checkOnly) {
  const ok = rows.every(r => r.ok);
  report();
  if (!existsSync(manifestPath)) say('\nNothing built yet: `npm run release` writes dist/release/ on Windows.');
  process.exit(ok ? 0 : 1);
}

if (!rows.every(r => r.ok)) die('The release is not ready (see the FAIL lines above).');
say('');
report();

const assets = [STABLE, versioned, `${versioned}.sig`, 'latest.json'].map(n => `dist/release/${n}`).join(' ');
say('\nPublish it (nothing was uploaded):');
say(`  gh release create v${version} --repo ${github[1]}/${github[2]} --title "Bible Workbench ${version}" --notes-file dist/release/notes.md --latest ${assets}`);
say('\nOr draft a release on GitHub, attach those four files, and publish it. Then commit the page (site/index.html)');
say('and let .github/workflows/pages.yml publish it to GitHub Pages.');
