// Read-only release gate. Never signs, publishes, or changes site metadata.
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { digest } from './check.mjs';
import { parseRelease } from '../../distribution/release.mjs';

export const requiredChecks = [
  'fresh-install', 'cli-unrelated-directory', 'gui-and-cli-activation',
  'invalid-certificate-rejected', 'permanent-offline-use', 'resource-repair',
  'upgrade-preserves-study', 'uninstall-preserves-study', 'advertised-features',
  'download-matches-installer', 'signed-executables', 'failed-upgrade-recovery',
];
async function contained(root, name) {
  if (typeof name !== 'string' || !name || isAbsolute(name)) throw new Error('Candidate file path must be relative.');
  const path = await realpath(resolve(root, name));
  const rel = relative(root, path);
  if (!rel || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) throw new Error('Candidate file escapes directory.');
  if (!(await stat(path)).isFile()) throw new Error('Candidate input is not a file.');
  return path;
}
export function windowsSignature(path) {
  if (process.platform !== 'win32') throw new Error('Verify Authenticode on Windows.');
  const script = fileURLToPath(new URL('./verify-signature.ps1', import.meta.url));
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script, '-ArtifactPath', path], { encoding: 'utf8' }).replace(/^\uFEFF/, ''));
}
export async function verifyCandidate(directory, signatureVerifier = windowsSignature) {
  const root = await realpath(directory);
  const candidate = JSON.parse(await readFile(resolve(root, 'candidate.json'), 'utf8'));
  if (candidate.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(candidate.sourceCommit ?? '')) throw new Error('Candidate needs a full source commit.');
  const release = parseRelease(candidate.release);
  if (release.status !== 'published') throw new Error('Candidate must describe the intended published release (without publishing it).');
  const installer = await contained(root, candidate.installer);
  if (await digest(installer) !== release.sha256 || (await stat(installer)).size !== release.bytes) throw new Error('Installer does not match release hash/size.');
  const signature = await signatureVerifier(installer);
  if (signature.status !== 'Valid' || typeof candidate.publisherThumbprint !== 'string' || !/^[A-Fa-f0-9]{40,64}$/.test(candidate.publisherThumbprint) || signature.thumbprint?.toLowerCase() !== candidate.publisherThumbprint.toLowerCase()) throw new Error('Installer needs a valid signature from the selected publisher.');
  const evidencePath = await contained(root, candidate.acceptance);
  if (!/^[a-f0-9]{64}$/.test(candidate.acceptanceSha256 ?? '') || await digest(evidencePath) !== candidate.acceptanceSha256) throw new Error('Acceptance evidence hash mismatch.');
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  if (evidence.schemaVersion !== 1 || evidence.installerSha256 !== release.sha256 || evidence.sourceCommit !== candidate.sourceCommit || evidence.version !== release.version || evidence.cleanMachine !== true || typeof evidence.windowsVersion !== 'string' || !evidence.windowsVersion.trim() || typeof evidence.tester !== 'string' || !evidence.tester.trim() || !/^\d{4}-\d{2}-\d{2}T/.test(evidence.testedAt ?? '') || !Number.isFinite(Date.parse(evidence.testedAt))) throw new Error('Acceptance evidence must identify this exact build and clean Windows machine.');
  for (const check of requiredChecks) {
    const result = evidence.checks?.[check];
    if (result?.status !== 'passed' || typeof result.detail !== 'string' || !result.detail.trim()) throw new Error(`Missing passed acceptance evidence: ${check}`);
  }
  for (const name of ['redistribution', 'applicationTerms', 'privacyAndSupport']) {
    const review = candidate.reviews?.[name];
    if (review?.status !== 'approved' || typeof review.reviewer !== 'string' || !review.reviewer.trim()) throw new Error(`Missing approved review: ${name}`);
    const path = await contained(root, review.path);
    if (!/^[a-f0-9]{64}$/.test(review.sha256 ?? '') || await digest(path) !== review.sha256 || !(await readFile(path, 'utf8')).trim()) throw new Error(`Review evidence hash mismatch: ${name}`);
  }
  return { verified: true, scope: 'artifact signature and recorded evidence integrity; not independent execution or rights clearance', version: release.version, sourceCommit: candidate.sourceCommit, installerSha256: release.sha256, publisherThumbprint: signature.thumbprint, release };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) { console.error('Usage: node scripts/release/verify-candidate.mjs <candidate-directory>'); process.exitCode = 1; }
  else verifyCandidate(process.argv[2]).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
