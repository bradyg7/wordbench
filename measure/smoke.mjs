// The release smoke run (docs/turnaround.md step 2, ticket 6): starts the built app (target/release, not installed) on a
// fresh scratch study folder, writes a page, presses Enter, closes the app, opens it again and checks the page's file on disk
// and in the Notebook. release.yml runs it on GitHub's Windows machine before anything is published.
//   node measure/smoke.mjs       (after npx tauri build; WB_BIBLE_DB names the Bible database)
// Every wait is for the thing itself (a selector, a file, a closed window), never a fixed sleep. Exits 1 with a plain
// message on the first thing that does not happen. Never touches a real study folder: it makes its own under the temp folder.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { acquire, freePort } from './instance.mjs';

const root = new URL('..', import.meta.url);
const exe = decodeURIComponent(new URL('target/release/bible-workbench.exe', root).pathname).replace(/^\/(\w:)/, '$1');
const TITLE = 'Smoke run page';
const LINE = 'Written by the smoke run';

const fail = message => { console.error(`SMOKE FAILED: ${message}`); process.exitCode = 1; throw new Error(message); };
if (!existsSync(exe)) fail(`No release build at ${exe}. Build it first (npx tauri build).`);
if (!process.env.WB_BIBLE_DB || !existsSync(process.env.WB_BIBLE_DB)) fail('WB_BIBLE_DB must name the Bible database.');

await acquire('smoke');
const work = mkdtempSync(path.join(os.tmpdir(), 'wb-smoke-'));
const study = path.join(work, 'study');
mkdirSync(study, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (what, fn, ms = 30000) => {
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

// One run of the app: start it, hand its window to `drive`, then close it and wait until its process is gone.
async function run(profile, drive) {
  const port = String(await freePort());
  const env = { ...process.env, WB_STUDY_DIR: study, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: port };
  const proc = spawn(exe, [], { env, stdio: 'ignore' });
  let exited = false;
  proc.on('exit', () => { exited = true; });
  let browser;
  try {
    browser = await until('the window to open', async () => {
      if (exited) fail('The app closed by itself on start.');
      try { return await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch { return null; }
    }, 60000);
    const page = await until('the app’s page', () => browser.contexts()[0]?.pages()[0]);
    page.on('pageerror', e => fail(`The window reported an error: ${e}`));
    await page.waitForFunction(() => window.__wbReady, null, { timeout: 60000 });
    if (!(await page.locator('.pane-notebook').count())) {
      await page.getByRole('button', { name: 'Notebook', exact: true }).first().click({ force: true });
    }
    await page.waitForSelector('.pane-notebook', { timeout: 30000 });
    await drive(page);
  } finally {
    await browser?.close().catch(() => {});
    try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* already gone */ }
    await until('the app to close', () => exited || proc.exitCode !== null, 15000).catch(() => {});
  }
}

try {
  // 1. a fresh folder: write a page (title, Enter, first line, Enter) and see its file appear
  await run(path.join(work, 'webview'), async page => {
    await page.getByRole('button', { name: 'A new page' }).first().click();
    const title = page.locator('.nb-new-title');
    await title.waitFor({ timeout: 15000 });
    await title.fill(TITLE);
    await page.keyboard.press('Enter');
    const line = page.locator('.nb-new-line');
    await until('the first line to take the caret', () => line.evaluate(e => e === document.activeElement));
    await page.keyboard.type(LINE);
    await page.keyboard.press('Enter');
    await until('the page’s file in the study folder', pageFile);
  });
  const file = pageFile();
  if (!file) fail('The page’s file is not in the study folder after the app was closed.');
  const before = readFileSync(file, 'utf8');

  // 2. a second start on the same folder: the page is in the Notebook and its file is as it was
  await run(path.join(work, 'webview'), async page => {
    await page.locator('.pane-notebook').getByText(TITLE).first().waitFor({ timeout: 30000 });
  });
  if (readFileSync(file, 'utf8') !== before) fail('The page’s file changed when the app was only opened and closed.');
  if (statSync(file).size === 0) fail('The page’s file is empty.');
  console.log(`SMOKE OK: the page was written, kept in ${path.relative(study, file)}, and shown again after a restart.`);
} catch (e) {
  if (!process.exitCode) { console.error(`SMOKE FAILED: ${e.message}`); process.exitCode = 1; }
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exit(process.exitCode ?? 0);
