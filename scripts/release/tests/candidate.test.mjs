import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest } from '../check.mjs';
import { verifyCandidate, requiredChecks } from '../verify-candidate.mjs';

test('candidate gate binds acceptance and approvals to exact signed artifact; remains read-only', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wb-candidate-'));
  try {
    await writeFile(join(dir, 'installer.exe'), 'synthetic fixture');
    const sha256 = await digest(join(dir, 'installer.exe'));
    const sourceCommit = 'a'.repeat(40);
    const evidence = { schemaVersion: 1, installerSha256: sha256, sourceCommit, version: '0.1.0', cleanMachine: true, windowsVersion: 'synthetic Windows fixture', tester: 'test fixture', testedAt: '2026-11-11T12:00:00Z', checks: Object.fromEntries(requiredChecks.map(key => [key, { status: 'passed', detail: 'Synthetic evidence only.' }])) };
    const saveEvidence = async () => { await writeFile(join(dir, 'acceptance.json'), JSON.stringify(evidence)); return digest(join(dir, 'acceptance.json')); };
    const candidate = { schemaVersion: 1, sourceCommit, installer: 'installer.exe', publisherThumbprint: 'b'.repeat(40), acceptance: 'acceptance.json', acceptanceSha256: await saveEvidence(), release: { schemaVersion: 1, status: 'published', version: '0.1.0', publishedAt: '2026-11-11T12:00:00Z', minimumWindows: '11', notes: 'Synthetic fixture', downloadPath: '/downloads/test', sha256, platform: 'windows', architecture: 'x86_64', channel: 'pilot', bytes: 17 }, reviews: {} };
    for (const name of ['redistribution', 'applicationTerms', 'privacyAndSupport']) {
      await writeFile(join(dir, name + '.txt'), 'Synthetic review only.');
      candidate.reviews[name] = { status: 'approved', reviewer: 'test fixture', path: name + '.txt', sha256: await digest(join(dir, name + '.txt')) };
    }
    const save = () => writeFile(join(dir, 'candidate.json'), JSON.stringify(candidate));
    await save();
    const validSignature = () => ({ status: 'Valid', thumbprint: 'b'.repeat(40) });
    assert.equal((await verifyCandidate(dir, validSignature)).verified, true);
    await assert.rejects(verifyCandidate(dir, () => ({ status: 'NotSigned' })), /signature/);
    await assert.rejects(verifyCandidate(dir, () => ({ status: 'Valid', thumbprint: 'c'.repeat(40) })), /publisher/);
    evidence.cleanMachine = false; candidate.acceptanceSha256 = await saveEvidence(); await save();
    await assert.rejects(verifyCandidate(dir, validSignature), /clean Windows/);
    evidence.cleanMachine = true; evidence.checks['upgrade-preserves-study'].status = 'not-run'; candidate.acceptanceSha256 = await saveEvidence(); await save();
    await assert.rejects(verifyCandidate(dir, validSignature), /upgrade-preserves-study/);
    evidence.checks['upgrade-preserves-study'].status = 'passed'; candidate.acceptanceSha256 = await saveEvidence(); await save();
    await writeFile(join(dir, 'redistribution.txt'), 'changed');
    await assert.rejects(verifyCandidate(dir, validSignature), /Review evidence/);
    await writeFile(join(dir, 'installer.exe'), 'modified fixture!');
    await assert.rejects(verifyCandidate(dir, validSignature), /Installer/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
