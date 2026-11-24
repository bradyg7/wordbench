// R3's documents checked in the real app, on their own: the same start as desk.mjs (its own instance, its own copy of the
// scratch study folder, its own cache and web view profile, documents beside that copy), then only the Documents pane, the
// six kinds, a Look and Ink, and the Adjust panel. For when the whole desk is out of step with the scratch folder.
//
//   node measure/desk-r3.mjs --release   (npx tauri build --no-bundle, and cargo build --release -p wb-cli, first)
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { acquire, freePort } from './instance.mjs';
import { shotsDir } from '../scripts/shots.mjs';

const root = new URL('..', import.meta.url);
const file = u => new URL(u, root).pathname.slice(1);
const release = process.argv.includes('--release');
const exe = file(`target/${release ? 'release' : 'debug'}/bible-workbench.exe`);
const wbExe = file(`target/${release ? 'release' : 'debug'}/wb.exe`);
const shots = shotsDir('docs/phase2/');
await acquire('desk-r3');
const cdpPort = String(await freePort());
const work = path.join(os.tmpdir(), 'bible-workbench-rs', 'desk-r3');
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
const docsDir = path.join(study, 'exports');
const sleep = ms => new Promise(r => setTimeout(r, ms));

rmSync(work, { recursive: true, force: true });
cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
rmSync(path.join(study, 'documents'), { recursive: true, force: true }); // this run's copy starts with no documents
mkdirSync(cache, { recursive: true });
const env = { ...process.env, WB_STUDY_DIR: study, WB_DOCS_DIR: '', WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: cdpPort };
const proc = spawn(exe, [], { env, stdio: 'ignore' });
const kill = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ } };
const wbj = args => JSON.parse(execFileSync(wbExe, args, { env }).toString());

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
  await page.waitForFunction(() => window.__wbReady, null, { timeout: 30000 });

  await page.evaluate(() => window.__wb.run('docs'));
  await page.waitForSelector('.pane-documents .doc-make', { timeout: 15000 });
  const kinds = await page.locator('.pane-documents .doc-make select.doc-kind option').allInnerTexts();
  check('the Make row offers the six kinds', kinds.join('|') === 'Speaker Script|Share Copy|Study Sheet|Reading Sheet|Verse by Verse|Reader', kinds.join('|'));
  check('the Make row has Look, Ink and Adjust', await page.locator('.pane-documents .doc-make select.doc-look option').count() >= 5
    && await page.locator('.pane-documents .doc-make select.doc-ink option').count() === 3 && await page.locator('.pane-documents .doc-make .doc-adjust').count() === 1);
  await page.locator('.pane-documents select.doc-thread').selectOption({ label: 'Phinehas' });

  // Adjust: the thread's own first page, live
  await page.locator('.pane-documents .doc-make .doc-adjust').click();
  await page.waitForSelector('.lk-modal .lk-page', { timeout: 15000 }).catch(() => {});
  const plan = wbj(['docs', 'plan', '--thread', 'phinehas', '--to', 'word', '--structure', 'script']);
  const firstVerse = plan.plan.find(op => op[1] === 'Scripture End' || op[1] === 'Scripture')[2].filter(r => r[1] !== 'num').map(r => r[0]).join('').trim().slice(0, 40);
  const livePage = page.locator('.lk-modal .lk-page');
  check('Adjust shows the thread’s own first page, its scripture verbatim from the plan', await livePage.count() === 1 && (await livePage.innerText()).replace(/\s+/g, ' ').includes(firstVerse.replace(/\s+/g, ' ')), firstVerse);
  await page.screenshot({ path: path.join(shots, '1440-adjust-preview.png') });
  await page.locator('.lk-modal .lk-opt', { hasText: 'Classic' }).click();
  await page.locator('.lk-modal .lk-opt[data-dial="ink"][data-value="saver"]').click();
  const look = await livePage.evaluate(el => ({ center: el.classList.contains('center'), font: getComputedStyle(el.querySelector('.dp-Title')).fontFamily, ref: getComputedStyle(el.querySelector('.dp-ScriptureReference')).color }));
  check('Classic centres a Literata title, and Ink saver turns the accent grey', look.center && /Literata/.test(look.font) && look.ref === 'rgb(68, 68, 68)', JSON.stringify(look));
  await page.locator('.lk-modal .lk-opt[data-dial="size"][data-value="large"]').click();
  await page.locator('.lk-modal .lk-grey-toggle input').check();
  check('See it in grey greys the page', await page.locator('.lk-modal .lk-page.lk-grey').count() === 1);
  await page.screenshot({ path: path.join(shots, '1440-adjust.png') });
  await page.locator('.lk-modal .lk-use').click();
  await page.waitForSelector('.lk-modal', { state: 'detached', timeout: 5000 }).catch(() => {});
  const row = { look: await page.locator('.pane-documents .doc-make select.doc-look').inputValue(), ink: await page.locator('.pane-documents .doc-make select.doc-ink').inputValue(), adj: await page.locator('.pane-documents .doc-make .doc-adjust').innerText() };
  check('Use these closes Adjust and sets Look, Ink and the changed dials on the Make row', await page.locator('.lk-modal').count() === 0 && row.look === 'classic' && row.ink === 'saver' && row.adj === 'Adjust… (1)', JSON.stringify(row));

  // Make: the Speaker Script in that Look, with the dials kept in its record
  await page.locator('.pane-documents .doc-make button', { hasText: /^Make$/ }).click();
  const scriptRow = page.locator('.pane-documents .doc-row', { hasText: 'Speaker Script - Phinehas.docx' });
  await scriptRow.waitFor({ timeout: 30000 }).catch(() => {});
  const rec = wbj(['docs', 'show', 'thread-phinehas-script']);
  const kept = JSON.parse(execFileSync('python', ['-c', 'import json,sys;print(json.dumps(json.load(open(sys.argv[1],encoding="utf-8")).get("look_values")))', path.join(study, 'documents', 'thread-phinehas-script.json')]).toString());
  check('Make writes it, checked, in Classic with Ink saver and Large kept in its record', existsSync(path.join(docsDir, 'Speaker Script - Phinehas.docx')) && rec.state === 'current' && rec.look === 'classic'
    && kept?.ink === 'saver' && kept?.size === 'large' && kept?.typeface === 'literata', JSON.stringify({ state: rec.state, look: rec.look, kept }));

  // the new kinds from the same row
  await page.locator('.pane-documents select.doc-kind').selectOption({ label: 'Study Sheet' });
  await page.locator('.pane-documents .doc-make button', { hasText: /^Make$/ }).click();
  await page.locator('.pane-documents .doc-row', { hasText: 'Study Sheet - Phinehas.docx' }).waitFor({ timeout: 30000 }).catch(() => {});
  check('Study Sheet is made from the Make row and listed Up to date', /Up to date/.test(await page.locator('.pane-documents .doc-row', { hasText: 'Study Sheet - Phinehas.docx' }).innerText().catch(() => '')));
  await page.locator('.pane-documents select.doc-kind').selectOption({ label: 'Reader' });
  await page.locator('.pane-documents .doc-make button', { hasText: /^Make$/ }).click();
  await page.locator('.pane-documents .doc-row', { hasText: 'Reader - Phinehas.pdf' }).waitFor({ timeout: 30000 }).catch(() => {});
  check('Reader is made as PDF pages and listed Up to date', existsSync(path.join(docsDir, 'Reader - Phinehas.pdf')) && /Up to date/.test(await page.locator('.pane-documents .doc-row', { hasText: 'Reader - Phinehas.pdf' }).innerText().catch(() => '')));
  await page.screenshot({ path: path.join(shots, '1440-documents-r3.png') });
} catch (e) {
  check('the run finished', false, String(e?.stack || e));
} finally {
  await browser?.close().catch(() => {});
  kill();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
