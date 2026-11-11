// Private pilot downloads. Bind only to loopback behind an HTTPS reverse proxy.
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile, realpath, open } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { parseRelease } from '../../distribution/release.mjs';

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export const secretHash = value => createHash('sha256').update(value).digest('hex');
export async function downloadServer(config) {
  if (config.schemaVersion !== 1 || !Array.isArray(config.artifacts) || !Array.isArray(config.invitations)) throw new Error('Invalid private download configuration.');
  const root = await realpath(config.artifactRoot);
  const artifacts = new Map();
  for (const item of config.artifacts) {
    const release = parseRelease(item.release);
    if (!idPattern.test(item.id) || artifacts.has(item.id) || release.status !== 'published' || release.downloadPath !== `/downloads/${item.id}` || typeof item.path !== 'string' || isAbsolute(item.path)) throw new Error('Invalid artifact configuration.');
    const path = await realpath(resolve(root, item.path));
    const rel = relative(root, path);
    if (!rel || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) throw new Error('Artifact escapes private root.');
    artifacts.set(item.id, { path, release });
  }
  const invitations = new Map();
  for (const item of config.invitations) {
    if (!idPattern.test(item.id) || invitations.has(item.id) || !/^[a-f0-9]{64}$/.test(item.secretSha256 ?? '') || !Number.isFinite(Date.parse(item.expiresAt)) || !Array.isArray(item.releases) || item.releases.some(id => !artifacts.has(id))) throw new Error('Invalid invitation configuration.');
    invitations.set(item.id, item);
  }
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const end = (status, message) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(message); };
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return end(405, 'Method not allowed.'); }
    // Proxy must replace this header after terminating TLS, not pass client input through.
    if (req.headers['x-forwarded-proto'] !== 'https') return end(400, 'HTTPS is required.');
    const match = /^\/downloads\/([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/.exec(req.url ?? '');
    if (!match || !artifacts.has(match[1])) return end(404, 'Download not found.');
    const encoded = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(req.headers.authorization ?? '')?.[1];
    let allowed = false;
    if (encoded && encoded.length <= 1024) {
      const value = Buffer.from(encoded, 'base64').toString('utf8');
      const separator = value.indexOf(':');
      const invite = invitations.get(value.slice(0, separator));
      const secret = value.slice(separator + 1);
      const actual = Buffer.from(secretHash(secret), 'hex');
      const expected = Buffer.from(invite?.secretSha256 ?? '0'.repeat(64), 'hex');
      allowed = timingSafeEqual(actual, expected) && separator > 0 && /^[A-Za-z0-9_-]{43,128}$/.test(secret) && invite && Date.parse(invite.expiresAt) > Date.now() && invite.releases.includes(match[1]);
    }
    if (!allowed) { res.setHeader('WWW-Authenticate', 'Basic realm="Bible Workbench pilot", charset="UTF-8"'); return end(401, 'Use the download invitation supplied by the pilot owner.'); }
    let file;
    try {
      const artifact = artifacts.get(match[1]);
      // Re-resolve every request: reject a file replaced with an escaping symlink.
      if (await realpath(artifact.path) !== artifact.path) throw new Error('Artifact changed.');
      file = await open(artifact.path, 'r');
      const before = await file.stat();
      if (!before.isFile() || before.size !== artifact.release.bytes) throw new Error('Artifact size changed.');
      const hash = createHash('sha256');
      for await (const chunk of file.createReadStream({ autoClose: false, start: 0 })) hash.update(chunk);
      const after = await file.stat();
      if (hash.digest('hex') !== artifact.release.sha256 || before.mtimeMs !== after.mtimeMs || before.size !== after.size) throw new Error('Artifact bytes changed.');
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': before.size, 'Content-Disposition': `attachment; filename="Bible-Workbench-${artifact.release.version}-windows-x64.exe"` });
      if (req.method === 'HEAD') res.end();
      else await pipeline(file.createReadStream({ autoClose: false, start: 0, end: before.size - 1 }), res);
    } catch {
      if (!res.headersSent) end(503, 'The verified download is unavailable. Contact the pilot owner.');
      else res.destroy();
    } finally { await file?.close().catch(() => {}); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    if (process.argv.length !== 3) throw new Error('Supply a private configuration file path.');
    const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
    const port = Number(process.env.WB_DOWNLOAD_PORT || 4180);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid listener port.');
    const server = await downloadServer(config);
    server.listen(port, '127.0.0.1', () => console.log(`Pilot download listener on loopback port ${port}. HTTPS proxy required.`));
    server.on('error', () => { console.error('Download listener failed.'); process.exitCode = 1; });
  })().catch(() => { console.error('Cannot start download listener. Check private configuration and artifact inputs.'); process.exitCode = 1; });
}
