// Operator-only manual pilot issuance. Never bundle this file or the encrypted issuer key.
// JSON input comes from stdin so passphrases never enter command-line arguments.
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const product = 'app.bibleworkbench.desktop';
const max = 32768;
function identifier(value, name) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new Error(`Invalid ${name}.`);
  return value;
}
function envelope(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > max) throw new Error('Request is too large.');
  const result = JSON.parse(text);
  if (!result || Object.keys(result).sort().join(',') !== 'payload,signature') throw new Error('Invalid request envelope.');
  for (const key of ['payload','signature']) {
    if (typeof result[key] !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(result[key])) throw new Error('Invalid base64 encoding.');
    const decoded = Buffer.from(result[key], 'base64');
    if (decoded.toString('base64') !== result[key]) throw new Error('Noncanonical base64 encoding.');
    result[key] = decoded;
  }
  return result;
}
export function verifyRequest(text) {
  const { payload, signature } = envelope(text);
  const request = JSON.parse(payload.toString('utf8'));
  if (Object.keys(request).sort().join(',') !== 'device_public_key,product_id,purpose,schema_version' || request.schema_version !== 1 || request.product_id !== product || request.purpose !== 'pilot-activation' || !/^[a-f0-9]{64}$/.test(request.device_public_key)) throw new Error('Unsupported activation request.');
  const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(request.device_public_key,'hex').toString('base64url') }, format: 'jwk' });
  if (signature.length !== 64 || !verify(null, payload, key, signature)) throw new Error('Device proof did not verify.');
  return request;
}

export function issue(requestText, privateKey, { keyId, licenseId, activationId }) {
  const request = verifyRequest(requestText);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('The issuer must use Ed25519.');
  const certificate = {
    schema_version: 1, product_id: product, issuer_key_id: identifier(keyId, 'key id'),
    license_id: identifier(licenseId, 'license id'), activation_id: identifier(activationId, 'activation id'),
    device_public_key: request.device_public_key, issued_at: new Date().toISOString(),
    offline_use: 'permanent', features: ['pilot'],
  };
  const payload = Buffer.from(JSON.stringify(certificate));
  return { certificate, envelope: { payload: payload.toString('base64'), signature: sign(null,payload,privateKey).toString('base64') } };
}

export async function operate(input) {
  if (typeof input.passphrase !== 'string' || input.passphrase.length < 16) throw new Error('Supply an issuer-key passphrase of at least 16 characters through stdin.');
  if (input.action === 'keygen') {
    const keyId = identifier(input.keyId, 'key id');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const encrypted = privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: input.passphrase });
    await writeFile(input.privateKeyPath, encrypted, { flag: 'wx', mode: 0o600 });
    const publicHex = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('hex');
    await writeFile(input.publicKeyPath, JSON.stringify({ key_id: keyId, public_key: publicHex }, null, 2), { flag: 'wx' });
    return { created: true, key_id: keyId, public_key: publicHex };
  }
  if (input.action !== 'issue') throw new Error('Unknown issuer action.');
  const pem = await readFile(input.privateKeyPath, 'utf8');
  if (!pem.startsWith('-----BEGIN ENCRYPTED PRIVATE KEY-----')) throw new Error('Only encrypted issuer keys are accepted.');
  const key = createPrivateKey({ key: pem, passphrase: input.passphrase });
  const request = await readFile(input.requestPath, 'utf8');
  const result = issue(request, key, input);
  // One immutable audit record per manually approved activation. No seat policy is invented here.
  await writeFile(input.auditPath, JSON.stringify({ ...result.certificate, event: 'manual-pilot-authorized' }, null, 2), { flag: 'wx', mode: 0o600 });
  await writeFile(input.outputPath, JSON.stringify(result.envelope, null, 2), { flag: 'wx' });
  return { issued: true, license_id: result.certificate.license_id, activation_id: result.certificate.activation_id };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    if (process.stdin.isTTY) throw new Error('Provide issuer JSON through stdin from a secure operator tool. Never put passphrases in shell arguments.');
    let text = '';
    for await (const chunk of process.stdin) { text += chunk; if (Buffer.byteLength(text) > max) throw new Error('Issuer input too large.'); }
    const result = await operate(JSON.parse(text));
    process.stdout.write(JSON.stringify(result) + '\n');
  })().catch(() => { console.error('Issuance failed. Check inputs, encrypted key, request proof, and unused output/audit paths. No secret details were logged.'); process.exitCode = 1; });
}
