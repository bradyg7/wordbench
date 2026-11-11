import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRelease } from '../../../distribution/release.mjs';
import { checkStaging, digest } from '../check.mjs';
import { prepare } from '../prepare.mjs';

const release = {
  schemaVersion: 1, status: 'published', version: '0.0.1', publishedAt: '2026-11-09T12:00:00Z',
  minimumWindows: '11', notes: '<script>untrusted notes</script>', downloadPath: '/downloads/pilot-0.0.1',
  sha256: 'a'.repeat(64), platform: 'windows', architecture: 'x86_64', channel: 'pilot', bytes: 1024,
};
test('public release accepts unavailable and strips non-public data', () => {
  assert.deepEqual(parseRelease({ schemaVersion: 1, status: 'unavailable', secret: 'hidden' }), { schemaVersion: 1, status: 'unavailable' });
  assert.equal(parseRelease({ ...release, secret: 'hidden' }).secret, undefined);
});
test('staged and withdrawn releases never become downloads', () => {
  for (const status of ['staged', 'withdrawn', 'pending', undefined]) assert.throws(() => parseRelease({ ...release, status }));
});
test('rejects external or executable download links and invalid metadata', () => {
  for (const downloadPath of ['javascript:alert(1)', '//evil.example/app', 'https://evil.example/app', '/downloads/../secret', '/downloads/app?key=secret', '/downloads/app#secret', '/downloads/%2fsecret']) assert.throws(() => parseRelease({ ...release, downloadPath }));
  for (const delta of [{ bytes: -1 }, { bytes: 1.2 }, { sha256: 'bad' }, { version: 'latest' }, { publishedAt: 'yesterday' }, { architecture: 'aarch64' }]) assert.throws(() => parseRelease({ ...release, ...delta }));
});

test('staging requires complete approved inventory and rejects tampering/traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wb-release-test-'));
  try {
    const files = [];
    await writeFile(join(root, 'evidence.txt'), 'Synthetic test evidence, not redistribution approval.');
    for (const role of ['app', 'cli', 'bible', 'dictionary', 'application-terms', 'third-party-notices']) {
      const path = `${role}.fixture`;
      await writeFile(join(root, path), role);
      files.push({ role, path, bytes: Buffer.byteLength(role), sha256: await digest(join(root, path)), redistribution: 'approved', source: 'synthetic-test', evidence: 'evidence.txt', schemaVersion: 1, resourceVersion: '1' });
    }
    const manifest = { schemaVersion: 1, version: '0.0.1', target: 'windows-x86_64', files };
    const save = value => writeFile(join(root, 'manifest.json'), JSON.stringify(value));
    await save(manifest);
    await checkStaging(root, '0.0.1');
    const trust = { key: 'a'.repeat(64), id: 'synthetic-test' };
    const info = { version: '0.0.1', distribution: true, issuer_key_id: trust.id, issuer_public_key: trust.key };
    for (const delta of [{ distribution: false }, { version: '0.0.2' }, { issuer_key_id: 'other' }, { issuer_public_key: 'b'.repeat(64) }]) {
      await assert.rejects(prepare(root, join(root, 'output'), '0.0.1', trust, async () => ({ ...info, ...delta })), /Staged CLI/);
    }
    const overlay = JSON.parse(await readFile(await prepare(root, join(root, 'output'), '0.0.1', trust, async () => info), 'utf8'));
    assert.deepEqual(overlay.build.features, ['distribution']);
    assert.equal(overlay.bundle.windows.nsis.installMode, 'currentUser');
    assert.equal(overlay.bundle.windows.webviewInstallMode.type, 'offlineInstaller');
    assert.equal(Object.values(overlay.bundle.resources).includes('wb.exe'), true);
    const manifestPath = Object.keys(overlay.bundle.resources).find(path => overlay.bundle.resources[path] === 'resources/resources-manifest.json');
    const runtime = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(runtime.files.length, 2);
    assert.equal(runtime.app_version, '0.0.1');
    await assert.rejects(checkStaging(root, '0.0.2'), /version/);
    await save({ ...manifest, files: files.slice(1) });
    await assert.rejects(checkStaging(root, '0.0.1'), /Missing packaged/);
    await save({ ...manifest, files: files.map(f => f.role === 'bible' ? { ...f, redistribution: 'unverified' } : f) });
    await assert.rejects(checkStaging(root, '0.0.1'), /provenance/);
    await save({ ...manifest, files: files.map(f => f.role === 'app' ? { ...f, path: '../' } : f) });
    await assert.rejects(checkStaging(root, '0.0.1'), /escapes/);
    await save(manifest);
    await writeFile(join(root, 'cli.fixture'), 'tampered');
    await assert.rejects(checkStaging(root, '0.0.1'), /Hash mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
