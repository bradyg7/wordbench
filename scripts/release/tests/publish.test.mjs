import test from 'node:test';
import assert from 'node:assert/strict';
import { assetNames, buildLatest } from '../publish.mjs';

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
