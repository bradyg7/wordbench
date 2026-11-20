import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetNames, buildLatest, earlierReleases } from '../publish.mjs';

test('published file names: Windows as before, the Mac files named Wordbench', () => {
  assert.deepEqual(assetNames('1.2.3'), {
    winSetup: 'Bible-Workbench-1.2.3-setup.exe',
    winSig: 'Bible-Workbench-1.2.3-setup.exe.sig',
    winStable: 'Bible-Workbench-setup.exe',
    macDmg: 'Wordbench-1.2.3-mac.dmg',
    macStable: 'Wordbench-mac.dmg',
    macUpdate: 'Wordbench-1.2.3-mac.app.tar.gz',
    macSig: 'Wordbench-1.2.3-mac.app.tar.gz.sig',
  });
});

test('latest.json lists windows-x86_64, darwin-aarch64 and darwin-x86_64', () => {
  const latest = buildLatest({ version: '1.2.3', notes: 'n', pubDate: '2026-11-19T00:00:00Z', winSignature: 'WIN', macSignature: 'MAC' });
  assert.deepEqual(Object.keys(latest.platforms).sort(), ['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64']);
  const base = 'https://github.com/bradyg7/wordbench-releases/releases/download/v1.2.3';
  assert.deepEqual(latest.platforms['windows-x86_64'], { signature: 'WIN', url: `${base}/Bible-Workbench-1.2.3-setup.exe` });
  for (const p of ['darwin-aarch64', 'darwin-x86_64']) {
    assert.deepEqual(latest.platforms[p], { signature: 'MAC', url: `${base}/Wordbench-1.2.3-mac.app.tar.gz` });
  }
  assert.equal(latest.version, '1.2.3');
  assert.equal(latest.pub_date, '2026-11-19T00:00:00Z');
});

test('latest.json carries the installer size and the earlier notes, newest first, none newer than this one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'notes-'));
  for (const v of ['0.2.0', '0.10.0', '0.9.1', '1.2.3', '2.0.0']) writeFileSync(join(dir, `${v}.md`), `## New\n- ${v}\n`);
  writeFileSync(join(dir, 'README.md'), 'not a release');
  const releases = earlierReleases('1.2.3', dir, f => (f.endsWith('0.9.1.md') ? '2026-11-01T00:00:00Z' : ''));
  assert.deepEqual(releases.map(r => r.version), ['0.10.0', '0.9.1', '0.2.0']);
  assert.equal(releases[1].pub_date, '2026-11-01T00:00:00Z');
  assert.equal(releases[0].notes, '## New\n- 0.10.0\n');
  const latest = buildLatest({ version: '1.2.3', notes: 'n', pubDate: 'd', winSignature: 'W', macSignature: 'M', size: 84000000, releases });
  assert.equal(latest.size, 84000000);
  assert.equal(latest.releases.length, 3);
  assert.equal(buildLatest({ version: '1', notes: 'n', pubDate: 'd', winSignature: 'W', macSignature: 'M' }).releases, undefined);
});
