#!/usr/bin/env node
// Builds the package Kurodyne sells: the Windows app, the Bible database, the buyer README and notices, and readable
// source, in one ZIP with no comment. Run it on Windows in a checkout that can see the Bible database:
//
//   npm run package -- --db "C:\path\to\workbench.db"
//
// The database is not in git (it is 118 MB and belongs to a separate build), so the package copies it from --db,
// WB_BIBLE_DB, or `datasets/workbench.db` in this checkout. See data/README.md for local provisioning.
// Pass --skip-build to package existing binaries for testing, and --skip-deps to skip the dependency inventory.
import { execFileSync } from 'node:child_process';
import {
  cpSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, rmSync, statSync, writeFileSync, closeSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeZip } from './zip.mjs';
import { checkZip } from './check-package.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
if (!flag('development-only')) {
  console.error('Portable ZIP packaging is for internal development only. Use release:prepare for the licensed pilot. To make an internal ZIP, pass --development-only.');
  process.exit(1);
}
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || !args[i + 1] || args[i + 1].startsWith('--')) return fallback;
  return args[i + 1];
};

function die(message) {
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
    // Current Node refuses to launch a `.cmd` shim without a shell. Only the two npm commands ask for one, and neither
    // has a path or a space in its arguments; everything else runs directly.
    shell: options.shell || false,
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    maxBuffer: 1 << 28,
  });
  return output ? output.toString() : '';
}

// ---- versions agree -----------------------------------------------------------------------------------------------
const conf = JSON.parse(readFileSync(join(repo, 'app/src-tauri/tauri.conf.json'), 'utf8'));
const version = conf.version;
const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
const cargo = readFileSync(join(repo, 'Cargo.toml'), 'utf8');
const cargoVersion = (cargo.match(/\[workspace\.package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/) || [])[1];
if (!version || pkg.version !== version || cargoVersion !== version) {
  die(`The versions must agree: tauri.conf.json ${version || '(none)'}, package.json ${pkg.version || '(none)'}, Cargo.toml ${cargoVersion || '(none)'}.`);
}
say(`Bible Workbench ${version}`);

// ---- the Bible database -------------------------------------------------------------------------------------------
const dbCandidates = [
  value('db'),
  process.env.WB_BIBLE_DB,
  join(repo, 'datasets/workbench.db'),
].filter(Boolean);
const db = dbCandidates.find(p => existsSync(p) && statSync(p).isFile());
if (!db) {
  die(`No Bible database found. See data/README.md to provision one, or select one with --db or WB_BIBLE_DB.\nLooked in:\n  ${dbCandidates.join('\n  ')}`);
}
const fd = openSync(db, 'r');
const magic = Buffer.alloc(16);
readSync(fd, magic, 0, 16, 0);
closeSync(fd);
if (magic.toString('latin1') !== 'SQLite format 3\u0000') die(`${db} is not a SQLite database.`);
if (statSync(db).size < 1024 * 1024) die(`${db} is only ${statSync(db).size} bytes; the Bible database is about 118 MB.`);
say(`Bible database: ${db} (${(statSync(db).size / 1024 / 1024).toFixed(1)} MB)`);

// ---- build ---------------------------------------------------------------------------------------------------------
if (!flag('skip-build')) {
  if (process.platform !== 'win32') {
    die('The package is the Windows app: build it on Windows, or pass --skip-build with binaries already in target/release.');
  }
  const win = process.platform === 'win32';
  const npm = win ? 'npm.cmd' : 'npm';
  run(npm, ['ci'], { shell: win });
  run(npm, ['run', 'build'], { shell: win });
  // The installed Tauri CLI, called through Node: no npx download and no `.cmd` shim.
  const tauriCli = join(repo, 'node_modules/@tauri-apps/cli/tauri.js');
  if (!existsSync(tauriCli)) die('No Tauri CLI at node_modules/@tauri-apps/cli/tauri.js. Run npm ci first.');
  run(process.execPath, [tauriCli, 'build', '--no-bundle']);
  run('cargo', ['build', '--release', '-p', 'wb-cli']);
}
const exe = join(repo, 'target/release/bible-workbench.exe');
const cli = join(repo, 'target/release/wb.exe');
for (const file of [exe, cli]) {
  if (!existsSync(file)) die(`No ${file}. Run npm run package without --skip-build, or build both first.`);
}

// ---- stage ---------------------------------------------------------------------------------------------------------
const out = resolve(value('out', join(repo, 'dist')));
const stage = join(out, `Bible Workbench-${version}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'datasets'), { recursive: true });
mkdirSync(join(stage, 'source'), { recursive: true });

cpSync(exe, join(stage, 'Bible Workbench.exe'));
cpSync(cli, join(stage, 'wb.exe'));
cpSync(db, join(stage, 'datasets/workbench.db'));
for (const file of ['README.md', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md']) cpSync(join(repo, file), join(stage, file));
cpSync(join(repo, 'licenses'), join(stage, 'licenses'), { recursive: true });

// Readable source, without development-only and personal material (design sheets, phase notes with study screenshots,
// the landing page, tool caches) or anything that would leak local paths.
const skip = ['node_modules', 'target', 'dist', 'gen', 'fixtures', '.git', '.DS_Store', '.env', '.claude'];
const sourceFilter = src => {
  const parts = relative(repo, src).replaceAll('\\', '/').split('/');
  return !parts.some(part => skip.includes(part));
};
for (const item of ['crates', 'ui', 'app', 'spikes', 'tests', 'scripts', 'Cargo.toml', 'Cargo.lock', 'package.json', 'package-lock.json', 'playwright.config.ts']) {
  cpSync(join(repo, item), join(stage, 'source', item), { recursive: true, filter: sourceFilter });
}
mkdirSync(join(stage, 'source', 'data'));
for (const item of ['data/README.md', 'data/bible-sources.lock.json']) {
  cpSync(join(repo, item), join(stage, 'source', item));
}

// ---- the dependency inventory --------------------------------------------------------------------------------------
function licenseIds(expression) {
  // A crate may offer a choice (`MIT OR Apache-2.0`) or require several (`MIT AND Unicode-3.0`). Every id named in
  // either kind of expression gets its text in `licenses/`; the exception after WITH is noted in the notices.
  return String(expression || 'UNKNOWN')
    .replace(/[()]/g, ' ')
    .split(/\s+(?:OR|AND)\s+|\//i)
    .map(s => s.replace(/\s+WITH\s+.*$/i, '').trim())
    .filter(s => s && s !== 'UNKNOWN');
}
function inventory() {
  if (flag('skip-deps')) {
    writeFileSync(join(stage, 'DEPENDENCIES.md'), '# Third-Party Dependencies\n\nNot generated for this build (--skip-deps).\n');
    return;
  }
  // Only the app's own dependency graph ships (the workspace also holds development spikes, which must not appear in
  // the inventory). Resolve for Windows so target-specific crates are included.
  const meta = JSON.parse(run('cargo', ['metadata', '--format-version', '1', '--locked', '--filter-platform', 'x86_64-pc-windows-msvc'], { capture: true }));
  const root = meta.packages.find(p => p.name === 'bible-workbench' && p.source === null);
  if (!root) die('No bible-workbench package in cargo metadata.');
  const byId = new Map(meta.packages.map(p => [p.id, p]));
  const nodes = new Map((meta.resolve?.nodes || []).map(n => [n.id, n]));
  const shipped = new Set();
  const queue = [root.id];
  while (queue.length) {
    const id = queue.pop();
    if (shipped.has(id)) continue;
    shipped.add(id);
    for (const dep of nodes.get(id)?.deps || []) queue.push(dep.pkg);
  }
  const crates = [...shipped].map(id => byId.get(id)).filter(p => p && p.source !== null).sort((a, b) => a.name.localeCompare(b.name));
  const npm = Object.keys(pkg.dependencies || {}).map(name => {
    const manifest = join(repo, 'node_modules', name, 'package.json');
    const license = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).license || 'UNKNOWN' : 'UNKNOWN';
    return { name, version: pkg.dependencies[name], license };
  });
  const ids = new Set([...crates.map(p => p.license || 'UNKNOWN'), ...npm.map(p => p.license)].flatMap(licenseIds));
  const texts = existsSync(join(repo, 'licenses')) ? readdirSync(join(repo, 'licenses')) : [];
  const missing = [...ids].filter(id => !texts.includes(`${id}.txt`));
  if (missing.length) die(`No license text for: ${missing.join(', ')}. Add licenses/<SPDX>.txt before packaging.`);
  const lines = [
    '# Third-Party Dependencies',
    '',
    `Generated by \`scripts/package.mjs\` for Bible Workbench ${version}. These are the packages included in the built`,
    'application. Their license texts are in `licenses/`; the data and fonts that need attribution are identified in',
    '`THIRD_PARTY_NOTICES.md`.',
    '',
    '## Rust crates (statically linked into the app)',
    '',
    '| Crate | Version | License | Source |',
    '|---|---|---|---|',
    ...crates.map(p => `| ${p.name} | ${p.version} | ${p.license || 'UNKNOWN'} | ${p.repository || p.homepage || ''} |`),
    '',
    '## JavaScript packages (bundled into the interface)',
    '',
    '| Package | Version | License |',
    '|---|---|---|',
    ...npm.map(p => `| ${p.name} | ${p.version} | ${p.license} |`),
    '',
    '## License texts',
    '',
    ...[...ids].sort().map(id => `- ${id}: \`licenses/${id}.txt\``),
    '',
  ];
  writeFileSync(join(stage, 'DEPENDENCIES.md'), lines.join('\n'));
  say(`Dependencies: ${crates.length} Rust crates, ${npm.length} JavaScript packages`);
}
inventory();

// ---- zip -----------------------------------------------------------------------------------------------------------
function files(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) die(`The package cannot contain a symbolic link: ${full}`);
    if (entry.isDirectory()) out.push(...files(full, base));
    else if (entry.isFile()) out.push({ name: full.slice(base.length + 1).replaceAll('\\', '/'), path: full });
  }
  return out;
}

// The readable source must not name anyone's home folder (a development spike once did). Fail before zipping.
const personal = [];
for (const entry of files(stage)) {
  if (!entry.name.startsWith('source/') || !/\.(mjs|js|ts|rs|json|toml|md)$/i.test(entry.name)) continue;
  const text = readFileSync(entry.path, 'utf8');
  const found = text.match(/[A-Za-z]:[\\/]Users[\\/]+([^\\/\s"'`]+)/);
  if (found) personal.push(`${entry.name}: ${found[0]}`);
}
if (personal.length) die(`The source names a personal home folder:\n  ${personal.slice(0, 5).join('\n  ')}`);

const entries = files(stage).sort((a, b) => a.name.localeCompare(b.name));
const zip = join(out, `Bible-Workbench-${version}-windows-x64.zip`);
const figures = writeZip(zip, entries);
say(`\nStaged ${stage}`);
say(`Wrote ${zip}`);
say(`${figures.entries} files · ${(figures.packed / 1024 / 1024).toFixed(1)} MB compressed · ${(figures.raw / 1024 / 1024).toFixed(1)} MB extracted`);

// ---- check ---------------------------------------------------------------------------------------------------------
const result = checkZip(zip);
say('');
for (const row of result.rows) console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${row.what}${row.detail ? ` — ${row.detail}` : ''}`);
if (!result.ok) die('The package does not meet the Kurodyne package rules yet (see the FAIL lines above).');
say('\nThe package passes the package checks. Test it from the ZIP itself on a clean Windows install before uploading.');
