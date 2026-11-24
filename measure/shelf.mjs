// The Shelf's checks alone (measure/shelf-checks.mjs; desk.mjs runs them too), with desk.mjs's harness: the real app, its
// own instance, cache and web view profile, on its own copy of the scratch study folder.
//
//   node measure/shelf.mjs --release  the release app (npx tauri build --no-bundle first)
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { shelfChecks, shelfFixtures } from './shelf-checks.mjs';
import { acquire, freePort } from './instance.mjs';
import { shotsDir } from '../scripts/shots.mjs';

const root = new URL('..', import.meta.url);
const file = u => new URL(u, root).pathname.slice(1);
const release = process.argv.includes('--release');
const exe = file(`target/${release ? 'release' : 'debug'}/bible-workbench.exe`);
const wbExe = file(`target/${release ? 'release' : 'debug'}/wb.exe`);
const shots = shotsDir('docs/phase2/');
mkdirSync(shots, { recursive: true });
await acquire('shelf');
const cdpPort = String(await freePort());
const work = path.join(os.tmpdir(), 'bible-workbench-rs', 'shelf-check');
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
const sleep = ms => new Promise(r => setTimeout(r, ms));

rmSync(work, { recursive: true, force: true });
cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
shelfFixtures(study);
mkdirSync(cache, { recursive: true });
const env = { ...process.env, WB_STUDY_DIR: study, WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: cdpPort };
const proc = spawn(exe, [], { env, stdio: 'ignore' });
const kill = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ } };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

let browser;
try {
  for (let i = 0; i < 100 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`); } catch { await sleep(300); }
  }
  const page = browser.contexts()[0].pages()[0];
  page.on('pageerror', e => check('no page errors', false, String(e)));
  for (let i = 0; i < 100 && !/^(https?|tauri):/.test(page.url()); i++) await sleep(200);
  await page.waitForLoadState('load');
  await page.goto(page.url().replace(/\?.*$/, '') + '?at=NUM.25');
  await page.waitForFunction(() => window.__wbReady, null, { timeout: 30000 });
  await shelfChecks({ page, check, env, wbExe, study, shots, sleep });
} catch (e) {
  check('the run finished', false, String(e?.stack || e));
} finally {
  await browser?.close().catch(() => {});
  kill();
}
const failed = results.filter(r => !r.ok);
console.log(`
${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
