// `npm run shots`: run on purpose, it re-takes the committed screenshots by running every spec that imports
// scripts/shots.mjs with WB_SHOTS=1, so a new picture-taking spec is retaken without editing this file.
//   npm run shots            the WebKit specs (docs/phase2/webkit-*, design/features/marks/build/t*.png)
//   npm run shots -- --desk  also the desk scripts (measure/desk, desk-r3, rail, shelf, definitions) in the real app:
//                            they need the release build (npx tauri build --no-bundle) and take the instance lock
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, WB_SHOTS: '1' };
const run = (cmd, args) => spawnSync(process.platform === 'win32' && cmd === 'npx' ? 'npx.cmd' : cmd, args, { cwd: root, stdio: 'inherit', env }).status ?? 1;

const desk = process.argv.includes('--desk');
const rest = process.argv.slice(2).filter(a => a !== '--desk');
const uses = dir => readdirSync(path.join(root, dir)).filter(n => /\.(spec\.ts|mjs)$/.test(n) && readFileSync(path.join(root, dir, n), 'utf8').includes('shots.mjs')).map(n => `${dir}/${n}`);

let status = run('npx', ['playwright', 'test', ...uses('ui/tests'), '--project', 'webkit-phone', '--project', 'webkit-desktop', ...rest]);
if (desk) for (const script of uses('measure')) status ||= run('node', [script]);
process.exit(status);
