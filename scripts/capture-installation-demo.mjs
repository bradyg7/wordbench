// A real, isolated distribution bootstrap using an ephemeral DEMO-ONLY issuer.
// No private key is written; neither this adapter nor the certificate is published.
import { generateKeyPairSync, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, copyFile, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { issue } from './release/issuer.mjs';
import { recordScenarios } from './demo-recorder.mjs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const keyId='recording-demo-only';
const publicHex=Buffer.from(publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
const run=(exe,args,env,input)=>new Promise((ok,bad)=>{const c=spawn(exe,args,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';c.stdout.on('data',d=>stdout+=d);c.stderr.on('data',d=>stderr+=d);c.on('error',bad);c.on('close',code=>code===0?ok(stdout.trim()):bad(Error(stderr.slice(-4000))));c.stdin.end(input||'');});
console.log('Building isolated distribution recording adapter');
await run('cargo',['build','--offline','-p','wb-cli','--example','capture-installation','--features','distribution'],{...process.env,WB_LICENSE_PUBLIC_KEY:publicHex,WB_LICENSE_KEY_ID:keyId});
const base=resolve(`release-staging/installation-demo-${Date.now()}`);
const resources=resolve(base,'package/resources');
const profile=resolve(base,'profile');
await mkdir(resources,{recursive:true});await mkdir(profile,{recursive:true});
const files=[];
for(const name of ['workbench.db','dictionary.db']){await copyFile(resolve('release-staging/source-audit',name),resolve(resources,name));const data=await readFile(resolve(resources,name));files.push({name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
const version=JSON.parse(await readFile('package.json','utf8')).version;
await writeFile(resolve(resources,'resources-manifest.json'),JSON.stringify({schema_version:1,app_version:version,files}));
const env={...process.env,LOCALAPPDATA:profile,USERPROFILE:profile,WB_DEMO_RESOURCES:resources};delete env.WB_ALLOW_REAL_STUDY;
const exe=resolve('target/debug/examples/capture-installation.exe');
let certificate;
const backend=async page=>{
  const calls=[];
  const invoke=async(command,args={})=>{const value=JSON.parse(await run(exe,[],env,JSON.stringify({command,args})));calls.push({command,action:args.action});if(command==='pilot_license'&&args.action==='request')certificate=JSON.stringify(issue(value.request,privateKey,{keyId,licenseId:'demo-license',activationId:'demo-activation'}).envelope);return value;};
  await page.exposeFunction('__demoSetup',invoke);
  await page.addInitScript(()=>window.__TAURI_INTERNALS__={invoke:(cmd,args)=>window.__demoSetup(cmd,args)});
  return {calls,flush:async()=>{},run:invoke};
};
await recordScenarios({'pilot-setup':{backend,url:'http://127.0.0.1:4187/setup.html',ready:'#folder',run:async(p,u)=>{
  await u.caption('Test installation · demo-only license, not a public release');
  const folder=p.getByLabel('Full folder path');
  await u.click(folder);await p.keyboard.press('Control+a');await p.keyboard.press('Backspace');
  await u.type(folder,resolve(base,'Sample Study'));
  await u.click(p.getByRole('button',{name:'Save study folder',exact:true}));
  await p.getByText('Study folder saved.',{exact:true}).waitFor();await u.pause(1800);
  await u.caption('Create the request for manual pilot activation');
  await u.click(p.getByRole('button',{name:'Create activation request',exact:true}));
  await p.waitForFunction(()=>document.querySelector('#request-text').value.length>50);
  await u.pause(1600);await u.shot();
  await u.caption('Import the returned, signed demo certificate');
  const f=p.locator('#certificate');const chooser=p.waitForEvent('filechooser');await u.click(f);
  await (await chooser).setFiles({name:'DEMO-ONLY-license.json',mimeType:'application/json',buffer:Buffer.from(certificate)});
  await p.getByRole('button',{name:'Open my workbench',exact:true}).waitFor();await u.pause(2200);
  const active=await u.backend.run('pilot_license',{action:'status'});if(!active.active)throw Error('Real license verification failed');
  const config=await u.backend.run('installation_status');if(!config.ready)throw Error('Study folder did not persist');
}}});
console.log('Verified real isolated setup and DPAPI-backed demo activation. No production issuer was created.');
