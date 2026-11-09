// Drag checks with the operating system's own mouse (finding 64c7). measure/desk.mjs drags with Playwright, which sends the
// web view synthetic events over the DevTools protocol and so passes even when a real mouse cannot drag at all (Tauri's
// file-drop handler took the OS drag). This starts its own instance on its own scratch copy, as desk.mjs does, and moves
// the real cursor with measure/real-mouse.ps1. It takes over the mouse for a few seconds: leave it alone while it runs.
//
//   node measure/real-drag.mjs           the debug app (its UI comes from `npm run dev` on :1420)
//   node measure/real-drag.mjs --release the release app
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
const mouse = file('measure/real-mouse.ps1');
const work = path.join(os.tmpdir(), 'bible-workbench-rs', 'real-drag');
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
const sleep = ms => new Promise(r => setTimeout(r, ms));
rmSync(work, { recursive: true, force: true });
cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
mkdirSync(cache, { recursive: true });
const env = { ...process.env, WB_STUDY_DIR: study, WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: '9335' };
const wb = (...a) => execFileSync(wbExe, a, { env }).toString();
// two pages made by the CLI before the app starts (the folder is a scratch copy)
wb('page', 'new', ['Real drag A', 'The aim.', '', '- [ ] first to-do', '- [ ] second to-do'].join('\n'));
wb('page', 'new', 'Real drag B');
const tree = JSON.parse(wb('page', 'tree'));
const idA = tree.pages.find(r => r.title === 'Real drag A')?.id, idB = tree.pages.find(r => r.title === 'Real drag B')?.id;
const proc = spawn(exe, [], { env, stdio: 'ignore' });
const kill = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ } };
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
const fileOf = id => { for (const d of readdirSync(path.join(study, 'notes'))) { const f = path.join(study, 'notes', d, `${id}.md`); if (existsSync(f)) return f; } return null; };
const textOf = id => readFileSync(fileOf(id), 'utf8').replace(/\r\n/g, '\n');
const waitFile = async (id, test) => { for (let i = 0; i < 40; i++) { if (fileOf(id) && test(textOf(id))) return true; await sleep(100); } return false; };
const ps = (...a) => execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', mouse, ...a.map(String)]);

let browser, page;
try {
  for (let i = 0; i < 100 && !browser; i++) { try { browser = await chromium.connectOverCDP('http://127.0.0.1:9335'); } catch { await sleep(300); } }
  page = browser.contexts()[0].pages()[0];
  for (let i = 0; i < 100 && !/^(https?|tauri):/.test(page.url()); i++) await sleep(200);
  await page.waitForLoadState('load');
  await page.goto(page.url().replace(/\?.*$/, '') + '?at=NUM.25');
  await page.waitForFunction(() => window.__wbReady, null, { timeout: 30000 });
  await page.waitForSelector('.pane-notebook .nb-sections', { timeout: 15000 });

  // the column wide, as the desk check does: the sidebar with the page tree beside the editor
  await page.evaluate(() => { const d = window.__wb.dock(); d.wide.right = true; d.layout(); });
  await sleep(600);
  await page.locator(`.pane-notebook .nb-tree-row[data-id="${idA}"]`).waitFor({ timeout: 15000 });
  await page.locator(`.pane-notebook .nb-tree-row[data-id="${idA}"] .nb-tree-open`).click();
  await page.locator('.pane-notebook .nb-blocks .nb-block').nth(2).waitFor({ timeout: 10000 });
  await sleep(500);

  // page → screen: the real cursor is put on a guessed point and the page says where it is
  await page.evaluate(() => { window.__seen = null; addEventListener('mousemove', e => { window.__seen = { cx: e.clientX, cy: e.clientY, sx: e.screenX, sy: e.screenY, dpr: devicePixelRatio }; }, { capture: true }); });
  const guess = await page.evaluate(() => ({ x: Math.round(screenX * devicePixelRatio) + 300, y: Math.round(screenY * devicePixelRatio) + 300 }));
  ps('move', guess.x, guess.y);
  await sleep(200);
  ps('move', guess.x + 20, guess.y + 20);
  await sleep(300);
  const seen = await page.evaluate(() => window.__seen);
  if (!seen) throw new Error('the page saw no mouse move: the window is not under the cursor (or input is blocked)');
  const dpr = seen.dpr;
  const dx = Math.round(seen.sx * dpr - seen.cx * dpr), dy = Math.round(seen.sy * dpr - seen.cy * dpr);
  console.log(`page → screen: +${dx},${dy} at ${dpr}x`);
  const toScreen = (x, y) => [Math.round(x * dpr) + dx, Math.round(y * dpr) + dy];
  const realDrag = async (from, to) => {
    const [x1, y1] = toScreen(...from), [x2, y2] = toScreen(...to);
    ps('drag', x1, y1, x2, y2);
    await sleep(600);
  };
  const centre = async loc => { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

  // 1. a block moved by its grip: the second to-do onto the top of the first
  const blocks = page.locator('.pane-notebook .nb-blocks .nb-block');
  await blocks.nth(2).hover();
  const grip = await centre(blocks.nth(2).locator('.nb-grip'));
  const target = await blocks.nth(1).boundingBox();
  await realDrag(grip, [target.x + 80, target.y + 3]);
  check('a real mouse drags a block by its grip: the file reads the new order', await waitFile(idA, t => t.includes('- [ ] second to-do\n- [ ] first to-do')), JSON.stringify(textOf(idA).split('---').pop().trim()));

  // 2. a page dragged in the sidebar onto the middle of another goes inside it
  const rowA = page.locator(`.pane-notebook .nb-tree .nb-tree-row[data-id="${idA}"]`), rowB = page.locator(`.pane-notebook .nb-tree .nb-tree-row[data-id="${idB}"]`);
  await realDrag(await centre(rowB), await centre(rowA));
  check('a real mouse drags a sidebar page onto another: it goes inside it', await waitFile(idB, t => new RegExp(`parent: "?${idA}"?`).test(t)), textOf(idB).split('---')[1]?.trim().replace(/\n/g, ' · '));
} catch (e) {
  console.log(`FAIL real-drag.mjs — ${e}`);
  await page?.screenshot({ path: path.join(work, 'failed.png') }).catch(() => {});
  results.push(false);
} finally {
  await browser?.close().catch(() => {});
  kill();
}
const ok = results.length >= 2 && results.every(Boolean);
console.log(ok ? 'all passed' : 'FAILED');
process.exit(ok ? 0 : 1);
