// Checks the desktop (phase 2) in the real app: its own instance, on its own copy of the scratch study folder, with its
// own cache folder (so `wb do` reaches this instance) and web view profile, driven over the DevTools protocol. Screenshots
// go to docs/phase2/. The watch window and the scratch folder it uses are not touched.
//
//   node measure/desk.mjs            the debug app (its UI comes from `npm run dev` on :1420, which must be running)
//   node measure/desk.mjs --release  the release app (npx tauri build --no-bundle first)
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const root = new URL('..', import.meta.url);
const file = u => new URL(u, root).pathname.slice(1);
const release = process.argv.includes('--release');
const exe = file(`target/${release ? 'release' : 'debug'}/bible-workbench.exe`);
const wbExe = file(`target/${release ? 'release' : 'debug'}/wb.exe`);
const shots = file('docs/phase2/');
mkdirSync(shots, { recursive: true });
const work = path.join(os.tmpdir(), 'bible-workbench-rs', 'desk-check');
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
const sleep = ms => new Promise(r => setTimeout(r, ms));

rmSync(work, { recursive: true, force: true });
cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
mkdirSync(cache, { recursive: true });
const env = { ...process.env, WB_STUDY_DIR: study, WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: '9334' };
const proc = spawn(exe, [], { env, stdio: 'ignore' });
const kill = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ } };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

let browser;
try {
  for (let i = 0; i < 100 && !browser; i++) {
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:9334'); } catch { await sleep(300); }
  }
  const page = browser.contexts()[0].pages()[0];
  page.on('pageerror', e => check('no page errors', false, String(e)));
  for (let i = 0; i < 100 && !/^(https?|tauri):/.test(page.url()); i++) await sleep(200);
  await page.waitForLoadState('load');
  await page.goto(page.url().replace(/\?.*$/, '') + '?at=NUM.25');
  await page.waitForFunction(() => window.__wbReady, null, { timeout: 30000 });
  await page.waitForSelector('.pane-notebook .nb-seg', { timeout: 15000 });
  const size = await page.evaluate(() => [innerWidth, innerHeight, document.documentElement.dataset.size]);
  check('the laptop-large window is the Large size class', size[2] === 'large', size.join('×'));
  check('the Notebook is docked on the right', await page.locator('.dock-right.open .pane-notebook').count() === 1);
  check('the toolbar has the command field and the pane buttons', await page.locator('#cmd').isVisible() && await page.locator('#tb-notebook').isVisible() && await page.locator('#hl-menu').isVisible());
  await page.screenshot({ path: shots + '1440-reader-with-the-notebook.png' });

  // the command field: backtick, suggestions, Enter
  await page.locator('#reader').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Backquote');
  check('backtick opens the command field', await page.evaluate(() => document.activeElement?.id === 'cmd'));
  await page.keyboard.type('uses zeal gospels');
  await page.waitForSelector('.suggest-row', { timeout: 5000 });
  check('suggestions come grouped', (await page.locator('.suggest-group').allTextContents()).includes('Commands'));
  await page.screenshot({ path: shots + '1440-command-field-open.png' });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.dock-left.open .pane-uses .row', { timeout: 10000 });
  const uses = JSON.parse(execFileSync(wbExe, ['uses', 'zeal', '--scope', 'gospels'], { env }).toString());
  check('uses opens on the left with the same rows as wb uses', await page.locator('.pane-uses .row').count() === uses.rows.length, `${uses.rows.length} rows`);
  const placeBefore = await page.locator('#place .place-label').textContent();

  // word study, interlinear, search
  await page.evaluate(() => window.__wb.run('def H7065'));
  await page.waitForSelector('.pane-strong .lemma', { timeout: 10000 });
  check('def H7065 opens the lexicon entry', (await page.locator('.pane-strong .translit').first().textContent()).length > 0);
  await page.evaluate(() => window.__wb.run('interlinear Num 25:11'));
  await page.waitForSelector('.pane-interlinear .inter-card', { timeout: 10000 });
  const inter = JSON.parse(execFileSync(wbExe, ['interlinear', 'Num 25:11'], { env }).toString());
  check('the interlinear shows every original word', await page.locator('.pane-interlinear .inter-card').count() === inter.verses[0].words.length);
  check('panes never move the reader', (await page.locator('#place .place-label').textContent()) === placeBefore);
  await page.screenshot({ path: shots + '1440-word-study-and-interlinear.png' });

  // the Notebook: a jot, the Inbox, Place it
  const ta = page.locator('.nb-write textarea');
  await ta.click();
  await ta.fill('Check where else this phrase is used; compare 1 Cor 10:8');
  await ta.press('Enter');
  await page.waitForFunction(() => document.querySelector('#tb-notebook .badge')?.textContent === '1', null, { timeout: 10000 });
  const inbox = readdirSync(path.join(study, 'notes', '_inbox'));
  check('a jot is a file in notes/_inbox', inbox.length === 1, inbox[0]);
  check('the jot shows in the Journal with no place', await page.locator('.nb-entry .unplaced').first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.locator('.nb-seg button', { hasText: 'Inbox' }).click();
  await page.locator('.nb-entry .btn', { hasText: 'Place it' }).first().click();
  await page.waitForSelector('.place-menu .place-opt');
  const offered = await page.locator('.place-menu .place-opt-label').allTextContents();
  check('Place it offers the place the note names', offered.includes('1 Corinthians 10:8'), offered.join(', '));
  await page.screenshot({ path: shots + '1440-placing-a-note.png' });
  await page.locator('.place-menu .place-opt', { hasText: '1 Corinthians 10:8' }).click();
  await page.waitForFunction(() => !document.querySelector('#tb-notebook .badge') || document.querySelector('#tb-notebook .badge').hidden, null, { timeout: 10000 });
  check('placing moves the file to notes/1CO', existsSync(path.join(study, 'notes', '1CO', inbox[0])) && !existsSync(path.join(study, 'notes', '_inbox', inbox[0])));

  // a note and a question from the verse popover
  await page.locator('.vn[data-v="9"]').click();
  await page.locator('.popover .act', { hasText: 'Question' }).click();
  await page.locator('.note-form textarea').fill('How do the two numbers relate?');
  await page.locator('.note-form textarea').press('Enter');
  await page.waitForSelector('.vn[data-v="9"].vq', { timeout: 10000 });
  check('a question puts a ? on its verse number', true);

  // threads and layers
  await page.evaluate(() => window.__wb.run('+Plague stayed @Num 25:8'));
  await page.evaluate(() => window.__wb.run('thread Plague stayed'));
  await page.waitForSelector('.pane-thread .member', { timeout: 10000 });
  check('+name adds the place to a new thread, which opens', await page.locator('.pane-thread .member').count() === 1);
  // a thread with a color draws its underline; its eye hides it
  await page.evaluate(() => window.__wb.run('thread Phinehas'));
  await page.waitForSelector('.pane-thread .drawn:visible', { timeout: 10000 });
  const lines = () => page.locator('.w[style*="linear-gradient"]').count();
  const before = await lines();
  await page.locator('.pane-thread:visible .drawn').click();
  await sleep(600);
  const hidden = await lines();
  await page.locator('.pane-thread:visible .drawn').click();
  await sleep(600);
  check('the thread’s eye hides and draws its underline', hidden < before && (await lines()) === before, `${before} → ${hidden}`);
  await page.screenshot({ path: shots + '1440-a-thread.png' });

  // keyboard: arrows turn chapters, find, text size
  await page.locator('#reader').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('#place .place-label')?.textContent === 'Numbers 26');
  check('→ turns to the next chapter', true);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => document.querySelector('#place .place-label')?.textContent === 'Numbers 25');
  await page.keyboard.press('Control+f');
  await page.keyboard.type('plague');
  await sleep(300);
  check('find in the chapter marks the words', await page.locator('.w.found').count() > 0, await page.locator('.find-count').textContent());
  await page.keyboard.press('Escape');
  const px = () => page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('reader')).fontSize));
  const f0 = await px();
  await page.keyboard.press('Control+=');
  check('Ctrl+= makes the text larger', (await px()) > f0);
  await page.keyboard.press('Control+0');

  // wb do from a terminal reaches this window
  const said = execFileSync(wbExe, ['do', 'open John 3:16-18'], { env }).toString().trim();
  await page.waitForSelector('.pane-passage .passage-verse', { timeout: 10000 });
  const john = JSON.parse(execFileSync(wbExe, ['text', 'John 3:16-18', '--json'], { env }).toString());
  const shown = await page.locator('.pane-passage .passage-verse').allTextContents();
  check('wb do opens the passage in the window, verbatim', shown.length === 3 && shown[0].includes(john.verses[0].text), said);

  // size classes; the verse at the top stays at the top through each
  const top = () => page.evaluate(() => {
    const sc = document.getElementById('scroller'), r = document.getElementById('reader');
    let v = 1;
    for (const e of r.querySelectorAll('.vn')) { if (r.offsetTop + e.offsetTop - 12 > sc.scrollTop + 2) break; v = +e.dataset.v; }
    return v;
  });
  await page.evaluate(() => window.__wb.open('PSA', 119, 50));
  await sleep(500);
  await page.evaluate(() => window.__wb.run('interlinear Ps 119:50'));
  await sleep(500);
  check('opening a dock column keeps the verse at the top', (await top()) === 50, `verse ${await top()}`);
  for (const [preset, cls] of [['laptop', 'expanded'], ['ipad', 'medium'], ['phone', 'compact']]) {
    await page.evaluate(p => window.__wb.run(`window ${p}`), preset);
    await sleep(900);
    check(`window ${preset}: still at verse 50`, (await top()) === 50, `verse ${await top()}`);
    const got = await page.evaluate(() => document.documentElement.dataset.size);
    const left = await page.locator('.dock-left.open').count();
    check(`window ${preset}: ${cls}${cls === 'compact' ? ', no columns' : ', one column'}`, got === cls && left === 0, got);
    await page.screenshot({ path: shots + `${preset}-${cls}.png` });
  }
  await page.evaluate(() => window.__wb.run('window laptop-large'));
} catch (e) {
  check('the run finished', false, String(e?.stack || e));
} finally {
  await browser?.close().catch(() => {});
  kill();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
