// Prepare an isolated installer overlay from an explicitly supplied, validated inventory.
// No database download, source-data copying, build, signing, publication, or study writes.
import { mkdir, mkdtemp, copyFile, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkStaging, digest } from './check.mjs';

export async function prepare(staging, outputParent, version) {
  const manifest = await checkStaging(staging, version);
  await mkdir(outputParent, { recursive: true });
  const output = await mkdtemp(join(outputParent, 'bundle-'));
  const mapping = { cli: 'wb.exe', bible: 'resources/workbench.db', dictionary: 'resources/dictionary.db', 'application-terms': 'notices/application-terms.txt', 'third-party-notices': 'notices/third-party-notices.txt' };
  const resources = {};
  const runtimeFiles = [];
  for (const [role, name] of Object.entries(mapping)) {
    const input = manifest.files.find(file => file.role === role);
    const dest = resolve(output, name);
    await mkdir(resolve(dest, '..'), { recursive: true });
    await copyFile(resolve(staging, input.path), dest);
    if (await digest(dest) !== input.sha256) throw new Error(`Staged file changed during preparation: ${role}`);
    resources[dest] = name;
    if (role === 'bible' || role === 'dictionary') runtimeFiles.push({ name: name.split('/').at(-1), bytes: input.bytes, sha256: input.sha256 });
  }
  const runtimeManifest = join(output, 'resources-manifest.json');
  await writeFile(runtimeManifest, JSON.stringify({ schema_version: 1, app_version: version, files: runtimeFiles }, null, 2));
  resources[runtimeManifest] = 'resources/resources-manifest.json';
  const config = {
    build: { features: ['distribution'] },
    bundle: { active: true, targets: ['nsis'], resources,
      windows: { nsis: { installMode: 'currentUser' }, webviewInstallMode: { type: 'offlineInstaller', silent: true } },
    },
  };
  const configPath = join(output, 'tauri.distribution.json');
  await writeFile(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    if (process.argv.length !== 4 || process.argv[2] !== '--staging') throw new Error('Usage: npm run release:prepare -- --staging <approved-staging-folder>');
    if (!/^[a-f0-9]{64}$/.test(process.env.WB_LICENSE_PUBLIC_KEY ?? '') || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(process.env.WB_LICENSE_KEY_ID ?? '')) throw new Error('Set the public WB_LICENSE_PUBLIC_KEY and WB_LICENSE_KEY_ID build variables before preparing a customer package. Never supply the private key here.');
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const { version } = JSON.parse(await readFile(join(root, 'app/src-tauri/tauri.conf.json'), 'utf8'));
    const config = await prepare(resolve(process.argv[3]), join(root, 'release-staging'), version);
    console.log(`Prepared installer overlay: ${config}`);
    console.log('Build with: npm run tauri -- build --config "' + config + '"');
    console.log('The supplied CLI must be built with --features distribution. This unsigned preparation is not a release; activation, signing, and clean-machine validation remain required.');
    console.log('Keep the same public issuer build variables set when building both CLI and GUI.');
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
