import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { downloadServer, secretHash } from './server.mjs';

test('pilot downloads require HTTPS, unexpired invitation, approved release and exact artifact bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wb-download-'));
  let server;
  try {
    const bytes = Buffer.from('synthetic unsigned test fixture');
    await writeFile(join(dir, 'fixture.exe'), bytes);
    const release = { schemaVersion: 1, status: 'published', version: '0.1.0', publishedAt: '2026-11-11T12:00:00Z', minimumWindows: '11', notes: 'test only', downloadPath: '/downloads/test', sha256: secretHash(bytes), platform: 'windows', architecture: 'x86_64', channel: 'pilot', bytes: bytes.length };
    const secret = 'A'.repeat(43);
    const config = { schemaVersion: 1, artifactRoot: dir, artifacts: [{ id: 'test', path: 'fixture.exe', release }], invitations: [{ id: 'test-user', secretSha256: secretHash(secret), expiresAt: '2099-01-01T00:00:00Z', releases: ['test'] }, { id: 'expired', secretSha256: secretHash(secret), expiresAt: '2000-01-01T00:00:00Z', releases: ['test'] }, { id: 'other', secretSha256: secretHash(secret), expiresAt: '2099-01-01T00:00:00Z', releases: [] }] };
    await assert.rejects(downloadServer({ ...config, artifacts: [{ ...config.artifacts[0], path: '../outside.exe' }] }));
    server = await downloadServer(config); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}`;
    const auth = (id = 'test-user', password = secret) => ({ 'x-forwarded-proto': 'https', authorization: 'Basic ' + Buffer.from(`${id}:${password}`).toString('base64') });
    assert.equal((await fetch(url + '/downloads/test')).status, 400);
    assert.equal((await fetch(url + '/downloads/test', { headers: { 'x-forwarded-proto': 'https' } })).status, 401);
    for (const id of ['expired', 'other', 'unknown']) assert.equal((await fetch(url + '/downloads/test', { headers: auth(id) })).status, 401);
    assert.equal((await fetch(url + '/downloads/test', { headers: auth('test-user', 'B'.repeat(43)) })).status, 401);
    for (const path of ['/downloads/%2e%2e/secret', '/downloads/test?token=secret', '/downloads/unknown']) assert.equal((await fetch(url + path, { headers: auth() })).status, 404);
    const response = await fetch(url + '/downloads/test', { headers: auth() });
    assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.equal((await fetch(url + '/downloads/test', { headers: auth(), method: 'HEAD' })).status, 200);
    await writeFile(join(dir, 'fixture.exe'), 'tampered');
    assert.equal((await fetch(url + '/downloads/test', { headers: auth() })).status, 503);
  } finally { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } await rm(dir, { recursive: true, force: true }); }
});
