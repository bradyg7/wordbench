import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify, createPrivateKey } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { issue, verifyRequest, operate } from '../issuer.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function request() {
  const keys = generateKeyPairSync('ed25519');
  const payload = Buffer.from(JSON.stringify({schema_version:1, product_id:'app.bibleworkbench.desktop',purpose:'pilot-activation',device_public_key:Buffer.from(keys.publicKey.export({format:'jwk'}).x,'base64url').toString('hex')}));
  return JSON.stringify({payload:payload.toString('base64'),signature:sign(null,payload,keys.privateKey).toString('base64')});
}
test('customer packaging refuses an absent public issuer configuration', () => {
  const env = { ...process.env }; delete env.WB_LICENSE_PUBLIC_KEY; delete env.WB_LICENSE_KEY_ID;
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../prepare.mjs', import.meta.url)), '--staging', 'nonexistent-test-staging'], { env, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /public WB_LICENSE_PUBLIC_KEY/);
});
test('manual issuance requires device proof and signs permanent rights', () => {
  const keys = generateKeyPairSync('ed25519');
  const result = issue(request(), keys.privateKey, {keyId:'test',licenseId:'pilot-1',activationId:'device-1'});
  assert.equal(result.certificate.offline_use,'permanent');
  assert.equal(result.certificate.expires_at,undefined);
  assert(verify(null,Buffer.from(result.envelope.payload,'base64'),keys.publicKey,Buffer.from(result.envelope.signature,'base64')));
  const bad = JSON.parse(request()); bad.payload = Buffer.from('{}').toString('base64');
  assert.throws(()=>verifyRequest(JSON.stringify(bad)));
  const badSig = JSON.parse(request()); badSig.signature = Buffer.alloc(64).toString('base64');
  assert.throws(()=>verifyRequest(JSON.stringify(badSig)));
});
test('encrypted issuer workflow preserves keys and audit records on retries', async () => {
  const dir = await mkdtemp(join(tmpdir(),'wb-issuer-test-'));
  try {
    const input = {action:'keygen',keyId:'test',passphrase:'synthetic-test-only-passphrase',privateKeyPath:join(dir,'private.pem'),publicKeyPath:join(dir,'public.json')};
    const pub = await operate(input);
    const pem = await readFile(input.privateKeyPath,'utf8');
    assert(pem.startsWith('-----BEGIN ENCRYPTED PRIVATE KEY-----'));
    assert.throws(()=>createPrivateKey(pem));
    await assert.rejects(operate(input));
    assert.equal(await readFile(input.privateKeyPath,'utf8'),pem);
    const req = join(dir,'request.json'); await writeFile(req,request());
    const issuance = {...input,action:'issue',requestPath:req,licenseId:'pilot',activationId:'a1',outputPath:join(dir,'license.json'),auditPath:join(dir,'audit.json')};
    await operate(issuance);
    const cert = JSON.parse(await readFile(issuance.outputPath,'utf8'));
    const payload = JSON.parse(Buffer.from(cert.payload,'base64'));
    assert.equal(payload.issuer_key_id,pub.key_id);
    await assert.rejects(operate(issuance));
  } finally { await rm(dir,{recursive:true,force:true}); }
});
