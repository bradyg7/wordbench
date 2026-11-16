// The rail, the top bar and the trail checked in the real app (design/features/command round 2 and minimize's rail and
// trail, built 2026-11-13): its own instance on its own copy of the scratch study folder, driven over the DevTools
// protocol, as measure/desk.mjs does. Real lookups open real panes; the trail is written by `wb history` and read back.
//
//   node measure/rail.mjs            the debug app (its UI comes from `npm run dev` on :1420, which must be running)
//   node measure/rail.mjs --release  the release app (npx tauri build --no-bundle first)
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
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
const work = process.env.WB_DESK_WORK || path.join(os.tmpdir(), 'bible-workbench-rs', 'rail-check');
const cdpPort = process.env.WB_DESK_PORT || '9335';
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
const sleep = ms => new Promise(r => setTimeout(r, ms));

rmSync(work, { recursive: true, force: true });
cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
rmSync(path.join(study, 'history'), { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
const env = { ...process.env, WB_STUDY_DIR: study, WB_DOCS_DIR: '', WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: cdpPort, WB_NO_OPEN: '1' };
const proc = spawn(exe, [], { env, stdio: 'ignore' });
const kill = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ } };
const wb = (...a) => JSON.parse(execFileSync(wbExe, a, { env }).toString());

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
  await page.waitForSelector('.pane-notebook', { timeout: 15000 });
  await sleep(500);

  const line = () => page.evaluate(() => [...document.querySelectorAll('#trailline .trail-step')].map(b => b.innerText.trim()));
  const box = () => page.locator('#cmd').inputValue();
  const keys = () => page.evaluate(() => window.__wb.dock().panes.map(p => p.key));
  const type = async (text, mods = '') => {
    await page.locator('#cmd').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(text);
    await sleep(500);
    await page.keyboard.press(mods ? `${mods}+Enter` : 'Enter');
    await sleep(1500);
  };

  // C13: no toolbar; the rail; the reader's tools at the box's end
  check('there is no toolbar', await page.locator('nav.tools').count() === 0);
  check('the rail is on the left, and the Notebook docked shows as on', await page.locator('#rail').isVisible() && await page.locator('#rail [data-rail="notebook"].on').count() === 1);
  const railW = (await page.locator('#rail').boundingBox()).width;
  check('the bar and the reader start right of the rail', Math.round((await page.locator('#bar').boundingBox()).x) === Math.round(railW) && Math.round((await page.locator('#scroller').boundingBox()).x) === Math.round(railW));
  await page.locator('#reader .vn[data-v="1"]').click();
  await sleep(300);
  check('with the reader in front the box shows its place and the reader\'s tools', await box() === 'Numbers 25' && await page.locator('#hl-menu').isVisible() && await page.locator('#tb-version').isVisible(), await box());
  await page.screenshot({ path: shots + '1440-rail-top-bar.png' });

  // C14: a line run in the box opens its pane, joins the trail and stays in the box
  await type('lex strongs H7065');
  check('a line run in the box opens its pane', (await keys()).includes('strong|H7065'), (await keys()).join(' '));
  check('the box keeps the line of the pane in front', await box() === 'lex strongs H7065', await box());
  check('the pane is a step on the trail after the place it came from', (await line()).join(' > ') === 'Numbers 25 > H7065', (await line()).join(' > '));
  check('a pane in front hides the reader\'s tools', !(await page.locator('#hl-menu').isVisible()));
  await type('lex strongs H7068');
  const k1 = await keys();
  check('Enter on a changed line changes the tab in front (the old one closes)', k1.includes('strong|H7068') && !k1.includes('strong|H7065'), k1.join(' '));
  await type('lex strongs H7065', 'Alt');
  const k2 = await keys();
  check('Alt+Enter opens the line as a new tab and keeps the one in front', k2.includes('strong|H7068') && k2.includes('strong|H7065'), k2.join(' '));
  await type('search zeal');
  check('a search joins the trail too', (await line()).at(-1)?.startsWith('Search'), (await line()).join(' > '));

  // the trail in the study folder
  await sleep(800);
  const steps = wb('history', 'list').steps;
  check('every step is kept by wb history, in history/<day>.jsonl', steps.length >= 5 && readdirSync(path.join(study, 'history')).some(f => f.endsWith('.jsonl')), `${steps.length} steps`);
  const titles = steps.map(s => s.title);
  check('the steps keep their titles and lines', titles[0] === 'Numbers 25' && steps.some(s => s.line === 'lex strongs H7068') && steps.some(s => s.line === 'search zeal'), titles.join(' | '));
  const byId = Object.fromEntries(steps.map(s => [s.id, s]));
  // the window opened twice (the check's own ?at= reload), so two reader steps begin a trail; every pane keeps its step
  check('each pane opened keeps the step it was opened from', steps.filter(s => s.kind !== 'verse').every(s => byId[s.from]), steps.map(s => `${s.title}<-${byId[s.from]?.title ?? ''}`).join(' | '));
  const sit = wb('history', 'sittings');
  check('wb history sittings sees one sitting going', sit.sittings.length === 1 && sit.sittings[0].count === steps.length, JSON.stringify(sit.sittings[0]));

  // the drawer: a step brings its tab to the front; a closed tab opens again
  await page.locator('#rail [data-rail="trail"]').click();
  await page.waitForSelector('.trail-drawer .trail-step', { timeout: 5000 });
  await page.screenshot({ path: shots + '1440-trail-drawer.png' });
  await page.evaluate(() => { const d = window.__wb.dock(); const p = d.find('strong|H7068'); if (p) d.close(p); });
  await sleep(500);
  await page.locator('.trail-drawer .trail-step', { hasText: 'H7068' }).first().click();
  await sleep(1500);
  check('a closed tab on the trail opens again from its step', (await keys()).includes('strong|H7068') && await box() === 'lex strongs H7068', `${(await keys()).join(' ')} · ${await box()}`);
  await page.locator('.trail-drawer .trail-acts button', { hasText: 'Keep as a page' }).click();
  await sleep(1500);
  const inbox = path.join(study, 'notes', '_inbox');
  const kept = readdirSync(inbox).map(f => readFileSync(path.join(inbox, f), 'utf8')).filter(t => t.includes('# Trail:'));
  check('Keep as a page writes the sitting into a new page', kept.length === 1 && kept[0].includes('lex strongs H7068'), kept[0]?.slice(0, 200) ?? `none; said: ${await page.locator('.toast').allInnerTexts()}`);
  await page.locator('.trail-drawer .icon-btn').click();

  // C18: the box popped off and kept across a reload
  const grip = await page.locator('#cmdbox .cmd-handle').boundingBox();
  await page.mouse.move(grip.x + 3, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(600, 700, { steps: 8 });
  await page.mouse.up();
  await sleep(300);
  await page.reload();
  await page.waitForFunction(() => window.__wbReady, null, { timeout: 30000 });
  await sleep(500);
  check('the box popped off stays where it was put after the window opens again', /popped/.test(await page.locator('#cmdbox').getAttribute('class')) && (await page.locator('#cmdbox').boundingBox()).y > 500);
  await page.screenshot({ path: shots + '1440-box-popped.png' });
  await page.locator('#cmdbox .cmd-handle').dblclick();
  check('a double-click on the search icon puts it back', !/popped/.test(await page.locator('#cmdbox').getAttribute('class')));

  // a rail icon closes its pane when clicked again, and opens it on the left, beside the rail (2026-11-13)
  const nbIcon = page.locator('#rail [data-rail="notebook"]');
  if (!(await nbIcon.getAttribute('class')).includes('on')) await nbIcon.click();
  await sleep(400);
  await nbIcon.click();
  await sleep(600);
  check('the Notebook\'s icon clicked while on closes the Notebook', await page.locator('.pane-notebook').count() === 0);
  await nbIcon.click();
  await page.waitForSelector('.pane-notebook', { timeout: 10000 });
  await sleep(400);
  check('clicked again, it opens the Notebook on the left, beside the rail', await page.locator('.dock-left.open .pane-notebook').count() === 1);

  // Show names
  await page.locator('#rail [data-rail="names"]').click();
  await sleep(400);
  check('Show names opens the rail out, and the reader moves over', (await page.locator('#rail').boundingBox()).width > 150 && (await page.locator('#scroller').boundingBox()).x > 150);
  await page.screenshot({ path: shots + '1440-rail-names.png' });
  await page.locator('#rail [data-rail="names"]').click();

  // half a screen (C17)
  await page.evaluate(() => window.__wb.run('window ipad'));
  await sleep(1200);
  const w = await page.evaluate(() => innerWidth);
  if (w < 900) {
    check('half width: the place button and the reader\'s tools fold away', !(await page.locator('#place').isVisible()) && !(await page.locator('#hl-menu').isVisible()), `${w}px`);
    await page.locator('#more').click();
    check('half width: More holds the reader\'s tools', /Highlights/.test(await page.locator('.more-menu').innerText()));
    await page.keyboard.press('Escape');
  } else check('half width', true, `the ipad window is ${w}px wide, not under 900; not checked`);
  await page.screenshot({ path: shots + 'ipad-rail.png' });
  await page.evaluate(() => window.__wb.run('window laptop-large'));
} catch (e) {
  check('the check ran to the end', false, String(e?.stack || e));
} finally {
  await browser?.close().catch(() => {});
  kill();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
