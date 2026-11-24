// The release smoke run (docs/turnaround.md step 2, ticket 6): starts the built app (target/release, not installed) on a
// fresh scratch study folder, writes a page, presses Enter, closes the app, opens it again and checks the page's file on disk
// and in the Notebook. release.yml runs it on GitHub's Windows machine before anything is published.
//   node measure/smoke.mjs       (after npx tauri build; WB_BIBLE_DB names the Bible database)
// Every wait is for the thing itself (a selector, a file, a closed window), never a fixed sleep. Exits 1 with a plain
// message on the first thing that does not happen. Never touches a real study folder: it makes its own under the temp folder.
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { realpathSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { acquire, freePort } from './instance.mjs';

const exe = fileURLToPath(new URL('../target/release/bible-workbench.exe', import.meta.url));
const WINDOW_OPENS_MS = 60000; // the app's window, and its first paint
const WAIT_MS = 30000; // any one thing the app should do (a selector, a file)
const PANE_MS = 30000; // the Notebook pane
const EXIT_MS = 15000; // the app's process, after it is told to stop
const FIELD_MS = 15000; // the new page's title field
const TITLE = 'Smoke run page';
const LINE = 'Written by the smoke run';

if (process.env.WB_ALLOW_REAL_STUDY) {
  console.error('SMOKE FAILED: WB_ALLOW_REAL_STUDY is set. The smoke run writes a page and must never be able to reach the real study folder. Unset it and run again.');
  process.exit(1);
}
const fail = message => { console.error(`SMOKE FAILED: ${message}`); process.exitCode = 1; throw new Error(message); };
if (!existsSync(exe)) fail(`No release build at ${exe}. Build it first (npx tauri build).`);
if (!process.env.WB_BIBLE_DB || !existsSync(process.env.WB_BIBLE_DB)) fail('WB_BIBLE_DB must name the Bible database.');

await acquire('smoke');
const work = mkdtempSync(path.join(os.tmpdir(), 'wb-smoke-'));
const study = path.join(work, 'study');
mkdirSync(study, { recursive: true });
const cache = path.join(work, 'cache');
const docs = path.join(work, 'documents');
const profile = path.join(work, 'webview');
mkdirSync(cache, { recursive: true });
mkdirSync(docs, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (what, fn, ms = WAIT_MS) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) fail(`Waited ${ms / 1000} seconds for ${what}.`);
    await sleep(200);
  }
};

// every .md under the study folder whose text holds both of our words
const pageFile = () => {
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  return walk(study).find(f => f.endsWith('.md') && (t => t.includes(TITLE) && t.includes(LINE))(readFileSync(f, 'utf8')));
};

let windowError = null; // the first error the window reported; the main flow fails on it
let stuckApp = false;
const checkWindowError = () => { if (windowError) fail(`The window showed an error while the page was written: ${windowError}`); };

// The window's own answer to `wb study check` (through the app's bridge) names the folder it has open: it must be ours.
async function proveFolder(page) {
  const open = await page.evaluate(async () => {
    const r = await window.__TAURI_INTERNALS__.invoke('wb', { argv: ['study', 'check', '--json'] });
    return r?.data?.json?.folder;
  }).catch(() => null);
  if (!open) fail('The window did not say which study folder it has open, so nothing was written.');
  const same = p => realpathSync.native(path.resolve(p.replace(/^\\\\\?\\/, ''))).toLowerCase();
  if (same(open) !== same(study)) fail(`The app opened ${open}, not the scratch folder ${study}. Nothing was written.`);
}

// One run of the app: start it, hand its window to `drive`, then close it and wait until its process is gone.
async function runApp(drive) {
  const port = String(await freePort());
  const env = { ...process.env, WB_STUDY_DIR: study, WB_DOCS_DIR: docs, WB_CACHE_DIR: cache, WB_NO_OPEN: '1', WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: port };
  const proc = spawn(exe, [], { env, stdio: 'ignore' });
  let exited = false;
  proc.on('exit', () => { exited = true; });
  let browser;
  try {
    browser = await waitFor('the window to open', async () => {
      if (exited) fail('The app closed by itself on start.');
      try { return await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch { return null; }
    }, WINDOW_OPENS_MS);
    const page = await waitFor('the app’s page', () => browser.contexts()[0]?.pages()[0]);
    page.on('pageerror', e => { windowError ??= String(e.message ?? e).split(/\r?\n/)[0]; });
    await page.waitForFunction(() => window.__wbReady, null, { timeout: WINDOW_OPENS_MS });
    await proveFolder(page);
    if (!(await page.locator('.pane-notebook').count())) {
      await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
    }
    try {
      await page.waitForSelector('.pane-notebook', { timeout: PANE_MS });
    } catch {
      fail('The Notebook did not open within 30 seconds after the window was ready.');
    }
    await drive(page);
    checkWindowError();
  } finally {
    await browser?.close().catch(() => {});
    try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* already gone */ }
    await waitFor('the app to close', () => exited || proc.exitCode !== null, EXIT_MS).catch(() => {
      console.error(`SMOKE WARNING: the app (process ${proc.pid}) was still running ${EXIT_MS / 1000} seconds after it was told to stop.`);
      stuckApp = true;
    });
  }
}

try {
  // 1. a fresh folder: write a page (title, Enter, first line, Enter) and see its file appear
  await runApp(async page => {
    await page.getByRole('button', { name: 'A new page' }).first().click();
    const title = page.locator('.nb-new-title');
    await title.waitFor({ timeout: FIELD_MS });
    await title.fill(TITLE);
    await page.keyboard.press('Enter');
    const line = page.locator('.nb-new-line');
    await waitFor('the first line to take the caret', () => line.evaluate(e => e === document.activeElement));
    await page.keyboard.type(LINE);
    await page.keyboard.press('Enter');
    await waitFor('the page’s file in the study folder', pageFile);
  });
  const file = pageFile();
  if (!file) fail('The page’s file is not in the study folder after the app was closed.');
  const before = readFileSync(file, 'utf8');

  // 2. a second start on the same folder: the page is in the Notebook and its file is as it was
  await runApp(async page => {
    try {
      await page.locator('.pane-notebook').getByText(TITLE).first().waitFor({ timeout: WAIT_MS });
    } catch {
      fail('After the restart the page was not listed in the Notebook within 30 seconds.');
    }
  });
  if (readFileSync(file, 'utf8') !== before) fail('The page’s file changed when the app was only opened and closed.');
  if (statSync(file).size === 0) fail('The page’s file is empty.');
  console.log(`SMOKE OK: the page was written, kept in ${path.relative(study, file)}, and shown again after a restart.`);
} catch (e) {
  if (!process.exitCode) { console.error(`SMOKE FAILED: ${e.message}`); process.exitCode = 1; }
} finally {
  try {
    rmSync(work, { recursive: true, force: true });
  } catch (e) {
    console.error(`SMOKE WARNING: the scratch folder ${work} could not be removed${stuckApp ? ' (the app is still running)' : ''}: ${e.message}`);
  }
}
process.exit(process.exitCode ?? 0);
