// Public interoperability fixture only. Fixed seeds are test data and must never be trusted by a release.
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { issue } from '../issuer.mjs';
function key(seed) { return createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,seed)]),format:'der',type:'pkcs8' }); }
function publicHex(key) { return Buffer.from(createPublicKey(key).export({format:'jwk'}).x,'base64url').toString('hex'); }
const issuer = key(7), device = key(9);
const payload = Buffer.from(JSON.stringify({schema_version:1,product_id:'app.bibleworkbench.desktop',purpose:'pilot-activation',device_public_key:publicHex(device)}));
const request = JSON.stringify({payload:payload.toString('base64'),signature:sign(null,payload,device).toString('base64')});
const result = issue(request,issuer,{keyId:'interop-test',licenseId:'interop-pilot',activationId:'interop-device'});
const folder = new URL('../../../crates/wb-license/tests/fixtures/',import.meta.url);
await mkdir(folder,{recursive:true});
await writeFile(new URL('node-certificate.json',folder),JSON.stringify({trusted_key:publicHex(issuer),device_key:publicHex(device),envelope:result.envelope},null,2));
