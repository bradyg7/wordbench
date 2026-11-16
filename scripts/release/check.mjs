import { readFile, stat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRelease } from '../../distribution/release.mjs';

export async function digest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function containedFile(root, name) {
  if (typeof name !== 'string' || !name || isAbsolute(name)) throw new Error('Artifact path must be relative.');
  const base = await realpath(root);
  const path = await realpath(resolve(base, name));
  const rel = relative(base, path);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Artifact escapes staging directory: ${name}`);
  if (!(await stat(path)).isFile()) throw new Error(`Not a file: ${name}`);
  return path;
}

// Read-only check. The manifest is supplied by the release operator, never inferred from personal files.
export async function checkStaging(directory, expectedVersion) {
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.version !== expectedVersion || manifest.target !== 'windows-x86_64') throw new Error('Staging version or target does not match the app.');
  if (!Array.isArray(manifest.files)) throw new Error('Missing staging file inventory.');
  const required = new Set(['app', 'cli', 'bible', 'dictionary', 'application-terms', 'third-party-notices']);
  const names = new Set();
  for (const item of manifest.files) {
    if (!required.has(item.role) || names.has(item.role)) throw new Error(`Unknown or duplicate role: ${item.role}`);
    names.add(item.role);
    const file = await containedFile(directory, item.path);
    if (!/^[a-f0-9]{64}$/.test(item.sha256) || await digest(file) !== item.sha256) throw new Error(`Hash mismatch: ${item.role}`);
    if (!Number.isSafeInteger(item.bytes) || item.bytes <= 0 || (await stat(file)).size !== item.bytes) throw new Error(`Size mismatch: ${item.role}`);
    if (['bible', 'dictionary'].includes(item.role)) {
      if (item.redistribution !== 'approved' || typeof item.source !== 'string' || !item.source.trim() || typeof item.resourceVersion !== 'string' || !item.resourceVersion.trim() || !Number.isSafeInteger(item.schemaVersion) || item.schemaVersion < 1) throw new Error(`Resource provenance not approved: ${item.role}`);
      const evidence = await containedFile(directory, item.evidence);
      if (!(await readFile(evidence, 'utf8')).trim()) throw new Error(`Empty redistribution evidence: ${item.role}`);
    }
  }
  for (const role of required) if (!names.has(role)) throw new Error(`Missing packaged component: ${role}`);
  return manifest;
}

async function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const tauri = JSON.parse(await readFile(resolve(root, 'app/src-tauri/tauri.conf.json'), 'utf8'));
  const cargo = await readFile(resolve(root, 'Cargo.toml'), 'utf8');
  const workspaceSection = cargo.split('[workspace.package]')[1]?.split('\n[')[0];
  const version = workspaceSection?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!version || version !== tauri.version) throw new Error('Cargo and Tauri versions differ.');
  const publicRelease = parseRelease(JSON.parse(await readFile(resolve(root, 'site/public/release.json'), 'utf8')));
  if (publicRelease.status === 'published' && publicRelease.version !== version) throw new Error('Website and app versions differ.');
  console.log(`Version ${version}: Cargo, Tauri, and website metadata agree.`);
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--staging') throw new Error('Packaging is not ready: supply --staging <directory> containing manifest.json and approved artifacts. See docs/SPEC.md.');
  await checkStaging(resolve(args[1]), version);
  console.log('Staged components and recorded provenance passed integrity checks. This does not verify legal rights, code signing, activation, or clean-machine behavior.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
