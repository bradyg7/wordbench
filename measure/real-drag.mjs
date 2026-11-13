// Drag checks with the operating system's own mouse (finding 64c7). measure/desk.mjs drags with Playwright, which sends the
// web view synthetic events over the DevTools protocol and so passes even when a real mouse cannot drag at all (Tauri's
// file-drop handler took the OS drag). This starts its own instance on its own scratch copy, as desk.mjs does, and moves
// the real cursor with measure/real-mouse.ps1. It takes over the mouse for a few seconds: leave it alone while it runs.
//
//   node measure/real-drag.mjs           the debug app (its UI comes from `npm run dev` on :1420)
//   node measure/real-drag.mjs --release the release app
//   node measure/real-drag.mjs --release --pages only Notebook checks, without findings attachments or screenshots
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const root = new URL('..', import.meta.url);
const file = u => new URL(u, root).pathname.slice(1);
const release = process.argv.includes('--release');
const pagesOnly = process.argv.includes('--pages');
const exe = file(`target/${release ? 'release' : 'debug'}/bible-workbench.exe`);
const wbExe = file(`target/${release ? 'release' : 'debug'}/wb.exe`);
const mouse = file('measure/real-mouse.ps1');
const work = path.join(os.tmpdir(), 'bible-workbench-rs', pagesOnly ? 'real-drag-pages' : 'real-drag');
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
const threadName = 'Real Drag Thread';
const slug = 'real-drag-thread';
const threadNote = 'A note on this thread about mulberries.';
const questionText = 'A question to move between a verse and a page';
const wbj = (...a) => JSON.parse(wb(...a));
let placed, question;
if (pagesOnly) {
  wb('thread', 'add-many', threadName, 'Num 25:9', 'Num 25:11');
  wb('thread', 'edit', threadName, '--note', threadNote);
  placed = wbj('note', 'new', 'A destination page', '--at', 'Num 25:9').id;
  question = wbj('note', 'new', questionText, '--at', 'Num 25:9', '--question').id;
}
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

  if (pagesOnly) {
    const nb = page.locator('.pane-notebook');
    const ed = nb.locator('.nb-editor');
    const search = nb.getByRole('textbox', { name: 'Search every page' });
    const findThread = () => nb.locator(`.nb-item[data-id="thread:${slug}"]`);
    await search.fill('mulberries');
    await findThread().click();
    const places = ed.locator('.nb-thread-places .member');
    await places.nth(1).waitFor();
    const threadFile = path.join(study, 'threads', slug + '.md');
    await realDrag(await centre(places.nth(1).locator('.grip')), await centre(places.first().locator('.member-body')));
    const members = wbj('thread', 'show', slug).members.map(m => m.anchor);
    check('a real mouse reorders the thread places by the grip', members.join(',') === 'NUM.25:11,NUM.25:9', members.join(', '));
    const header = readFileSync(threadFile, 'utf8').split('---')[1];
    check('thread front matter has no page-only fields', !/^\s*(parent|order|pinned):/m.test(header));
    check('a thread opens from a search for words in its note', (await ed.locator('.nb-body').innerText()).includes(threadNote));
    await search.fill('Real Drag Thread');
    await findThread().waitFor();
    check('a thread is found by its name', await findThread().isVisible());
    await search.press('Escape');

    const open = id => page.evaluate(id => window.__wb.note(id), id);
    await open(placed);
    await ed.locator('.nb-title', { hasText: 'A destination page' }).waitFor();
    const insert = async (line, kind) => {
      const add = ed.locator('.nb-block-add');
      if (await add.count()) await add.click();
      else await ed.locator('.nb-page').click();
      await ed.locator('textarea.nb-input').fill(line);
      await page.locator(`.nb-blockmenu-row[data-key="${kind}"]`).click();
    };
    await insert('/~', 'thread');
    await page.getByRole('textbox', { name: 'Find a thread' }).fill(threadName);
    await sleep(750);  // keeping the picker open must not commit an empty fence or close the editor
    await page.locator('.chooser-row', { hasText: threadName }).click();
    await ed.locator('.nb-threadblock', { hasText: threadName }).waitFor();
    check('the /~ picker writes only the chosen thread ID', textOf(placed).includes('```thread\n' + slug + '\n```'));

    await insert('/word', 'word');
    await page.getByRole('textbox', { name: 'Strong’s number' }).fill('h7065');
    await page.getByRole('button', { name: 'Insert word' }).click();
    await ed.locator('.nb-wordblock').waitFor();
    check('the /word picker writes only the validated Strong’s number', textOf(placed).includes('```word\nH7065\n```'));

    await open(question);
    await ed.getByRole('button', { name: 'Fold into a page…' }).click();
    await page.getByRole('button', { name: 'A destination page' }).click();
    await ed.locator('.nb-questionblock', { hasText: questionText }).waitFor();
    check('fold moves the trail into the chosen page', wbj('trail', 'list', '--status', 'all').trails.every(t => t.id !== question));
    await ed.getByRole('button', { name: 'Give it its own page' }).click();
    await ed.locator('.nb-title', { hasText: questionText }).waitFor();
    check('unfold moves the question back to the verse', wbj('trail', 'list').trails.some(t => t.anchor === 'NUM.25:9' && t.text === questionText));
  } else {
    // 3. C1: a file dragged from another program (the operating system's own file drag, as from Explorer) and let go on the
    // findings box; Tauri's drop handler is off (M1), so WebView2 gives the page an HTML5 drop with the files in it
    const src = path.join(work, 'src');
    mkdirSync(src, { recursive: true });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    writeFileSync(path.join(src, 'real-drop.png'), png);
    writeFileSync(path.join(src, 'real-drop.pdf'), pdf);
    writeFileSync(path.join(src, 'real-browse.pdf'), pdf);
    await page.locator('#reader').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+Shift+KeyJ');
    await page.locator('.finding-field').waitFor({ timeout: 5000 });
    await page.keyboard.type('A real file drop on the findings box');
    const [fromX, fromY] = toScreen(60, (await page.evaluate(() => innerHeight)) - 160);
    const source = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file('measure/file-drag-source.ps1'), String(fromX), String(fromY), `${path.join(src, 'real-drop.png')}|${path.join(src, 'real-drop.pdf')}`]);
    let said = '';
    source.stdout.on('data', d => { said += d; });
    for (let i = 0; i < 100 && !said.includes('ready'); i++) await sleep(100);
    if (!said.includes('ready')) throw new Error('the drag source window did not show');
    await sleep(300);
    const field = await centre(page.locator('.finding-field'));
    const [toX, toY] = toScreen(...field);
    ps('drag', fromX + 70, fromY + 45, toX, toY, 30);
    for (let i = 0; i < 30 && !said.includes('dropped'); i++) await sleep(100);
    await sleep(300);
    const dropped = await page.locator('.finding-box .file-chip-name').allTextContents();
    check('a real file drop (the OS drag from another program) puts a PNG and a PDF on the findings box', dropped.join(', ') === 'real-drop.png, real-drop.pdf', `${dropped.join(', ') || 'none'}; the source said “${said.trim().replace(/\s+/g, ' ')}”`);

    // 4. Browse… clicked with the real mouse opens the system's file dialog; the path is typed into it with the real keyboard
    const [bx, by] = toScreen(...await centre(page.locator('.finding-box .finding-browse')));
    ps('click', bx, by);
    let picked = true;
    try { ps('pick', proc.pid, path.join(src, 'real-browse.pdf')); } catch (x) { picked = false; console.log(`     (${String(x.stderr || x).split('\n')[0]})`); }
    await page.waitForFunction(() => document.querySelectorAll('.finding-box .file-chip').length === 3, null, { timeout: 5000 }).catch(() => {});
    const all = await page.locator('.finding-box .file-chip-name').allTextContents();
    check('Browse… opens the file dialog and the file picked there is added', picked && all.includes('real-browse.pdf'), all.join(', '));
    await page.locator('.finding-field').focus();
    await page.keyboard.press('Enter');
    const fdir = path.join(study, 'findings');
    let fid = '';
    for (let i = 0; i < 40 && !fid; i++) {
      const md = existsSync(fdir) ? readdirSync(fdir).find(n => n.endsWith('.md') && readFileSync(path.join(fdir, n), 'utf8').includes('A real file drop')) : null;
      if (md && existsSync(path.join(fdir, md.slice(0, -3))) && readdirSync(path.join(fdir, md.slice(0, -3))).length === 3) fid = md.slice(0, -3);
      else await sleep(150);
    }
    const kept = fid ? readdirSync(path.join(fdir, fid)).sort() : [];
    const same = kept.length === 3 && readFileSync(path.join(fdir, fid, 'real-drop.png')).equals(png) && readFileSync(path.join(fdir, fid, 'real-drop.pdf')).equals(pdf) && readFileSync(path.join(src, 'real-drop.png')).equals(png);
    check('kept: the three files are in findings/<id>/, byte for byte, and the dropped ones are still where they were', same, kept.join(', '));
  }
} catch (e) {
  console.log(`FAIL real-drag.mjs — ${e}`);
  if (!pagesOnly) await page?.screenshot({ path: path.join(work, 'failed.png') }).catch(() => {});
  results.push(false);
} finally {
  await browser?.close().catch(() => {});
  kill();
}
const ok = results.length >= (pagesOnly ? 10 : 5) && results.every(Boolean);
console.log(ok ? 'all passed' : 'FAILED');
process.exit(ok ? 0 : 1);
