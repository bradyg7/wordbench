// Checks the verse card's Definitions tab (R5) in the real release app: its own instance on its own copy of the scratch
// study folder. A note is made on Numbers 25:11, its reference clicked, the Definitions tab opened, a word clicked.
//   node measure/definitions.mjs        (after npx tauri build --no-bundle and python scripts/build-dictionary.py)
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { acquire, freePort } from './instance.mjs';
import { shotsDir } from '../scripts/shots.mjs';

const root = new URL('..', import.meta.url);
const file = u => new URL(u, root).pathname.slice(1);
const exe = file('target/release/bible-workbench.exe'), wbExe = file('target/release/wb.exe');
const shots = shotsDir('docs/phase2/');
mkdirSync(shots, { recursive: true });
await acquire('definitions');
const cdpPort = String(await freePort());
const work = path.join(os.tmpdir(), 'bible-workbench-rs', 'defs-check');
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
rmSync(work, { recursive: true, force: true });
cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
mkdirSync(cache, { recursive: true });
const env = { ...process.env, WB_STUDY_DIR: study, WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: cdpPort };
execFileSync(wbExe, ['note', 'add', 'Num 25:11', 'Definitions try, on Num 25:11'], { env });
const proc = spawn(exe, [], { env, stdio: 'ignore' });
const kill = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ } };
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let browser;
try {
  for (let i = 0; i < 100 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`); } catch { await sleep(300); } }
  const page = browser.contexts()[0].pages()[0];
  page.on('pageerror', e => check('no page errors', false, String(e)));
  await page.locator('body').waitFor();
  await sleep(2500);
  await page.screenshot({ path: shots + 'defs-0-start.png' });
  // the Notebook, the note, its reference
  await page.evaluate(() => window.__wb.run('notebook')).catch(() => {});
  await sleep(1500);
  await page.screenshot({ path: shots + 'defs-1-notebook.png' });
  // open the note, then the reference in it: a click on a reference in a note opens the verse card
  await page.locator('.pane-notebook').getByText('Definitions try').first().click();
  await sleep(1000);
  await page.screenshot({ path: shots + 'defs-1b-note.png' });
  await page.locator('a.ref', { hasText: 'Num 25:11' }).first().click();
  await page.locator('.verse-card .sv-t').first().waitFor({ timeout: 10000 });
  await page.locator('.verse-card .vc-tab-definitions').click();
  await page.locator('.verse-card .vc-def-word').first().waitFor({ timeout: 10000 });
  const words = await page.locator('.verse-card .vc-def-word').allTextContents();
  check('Definitions lists the verse’s words that have an entry', words.length > 3, words.join(' '));
  await page.screenshot({ path: shots + 'defs-2-tab.png' });
  await page.locator('.verse-card .vc-def-word').first().click();
  const t = await page.locator('.verse-card .vc-def-text').textContent();
  const credit = await page.locator('.verse-card .vc-def-credit').textContent();
  check('a click shows the entry with its source and licence', t.length > 10 && /Webster.*1913.*Public domain/.test(credit), credit);
  await page.screenshot({ path: shots + 'defs-3-entry.png' });
} finally {
  await browser?.close().catch(() => {});
  kill();
}
process.exit(results.every(Boolean) && results.length ? 0 : 1);
