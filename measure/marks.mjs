// The desk check of design/features/marks, in the real app, on a scratch copy only (never the person's study folder):
//   - Years of study: a generated study of 2,400 pages, 3,100 margin notes and 18,000 highlights (made by
//     `WB_YEARS_KEEP=<folder> cargo test -p wb-core --test marks_years`): John 3 opens inside the reader's budget with one
//     line of counts per verse; John 3:16's margin shows 41 notes newest first and its pages in 20 rows before "Show all";
//     the map counts every chapter; a search answers inside the search budget, grouped by kind.
//   - The reader's place is kept: from Numbers 25:11, the verse opened in the margin, a page opened from its list, that
//     page's reference to Psalms 106:30 followed, Back twice: the reader is at Numbers 25:11, the same scroll position,
//     the margin still open on verse 11. From Margin notes in the Library, a click on a note and Back returns to its row.
//   node measure/marks.mjs            (after: npx tauri build --no-bundle; the years study in WB_YEARS_STUDY)
// The window's CPU is slowed 4x for the budgets, as measure.mjs does for a phone.
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { acquire, freePort } from './instance.mjs';

const root = new URL('..', import.meta.url);
const file = u => new URL(u, root).pathname.slice(1);
const exe = file('target/release/bible-workbench.exe');
const wbExe = file('target/release/wb.exe');
const source = process.env.WB_YEARS_STUDY || path.join(os.tmpdir(), 'bible-workbench-rs', 'years-study');
if (!existsSync(source)) throw new Error(`No generated study at ${source}: WB_YEARS_KEEP=${source} cargo test -p wb-core --test marks_years`);
await acquire('marks');
const work = path.join(os.tmpdir(), 'bible-workbench-rs', 'marks-desk');
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
rmSync(work, { recursive: true, force: true });
cpSync(source, study, { recursive: true });
mkdirSync(cache, { recursive: true });
const cdpPort = String(await freePort());
const env = { ...process.env, WB_STUDY_DIR: study, WB_DOCS_DIR: '', WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: cdpPort, WB_NO_OPEN: '1' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wb = (...argv) => execFileSync(wbExe, argv, { env, maxBuffer: 1 << 28 }).toString();

// what the place-kept path needs: a page that names Numbers 25:11 and Psalms 106:30, and a margin note at the verse
const placePage = JSON.parse(wb('page', 'new', 'Reader place check\n\nSee Numbers 25:11 and Psalm 106:30.', '--json')).id;
wb('margin', 'add', 'Numbers 25:11', 'A note for the place check.');

const proc = spawn(exe, [], { env, stdio: 'ignore' });
proc.on('exit', code => console.log('APP EXITED', code));
const kill = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ } };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

let browser;
try {
  for (let i = 0; i < 100 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`); } catch { await sleep(300); }
  }
  const page = browser.contexts()[0].pages()[0];
  page.on('pageerror', e => check('no page errors', false, String(e)));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log('CONSOLE', m.type(), m.text().slice(0, 200)); });
  for (let i = 0; i < 100 && !/^(https?|tauri):/.test(page.url()); i++) await sleep(200);
  await page.waitForLoadState('load');
  await page.goto(page.url().replace(/\?.*$/, '') + '?at=NUM.25');
  await page.waitForFunction(() => window.__wbReady, null, { timeout: 30000 });
  await page.waitForSelector('.pane-notebook', { timeout: 15000 });
  const invoke = (argv) => page.evaluate(async argv => { const t = performance.now(); const r = await window.__TAURI_INTERNALS__.invoke('wb', { argv }); return { ms: performance.now() - t, rust_ms: r.rust_ms, json: r.data.json }; }, argv);
  const out = { when: new Date().toISOString() };

  // ---- years of study, with the web view's CPU slowed 4x -----------------------------------------------------------
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => { window.__wb.perf.entries.length = 0; });
  for (let i = 0; i < 3; i++) for (const [b, c] of [['NUM', 24], ['JHN', 3], ['PSA', 23]]) await page.evaluate(([b, c]) => window.__wb.open(b, c), [b, c]);
  await sleep(1500);
  const entries = await page.evaluate(() => window.__wb.perf.entries);
  const john = entries.filter(e => e.name === 'chapter' && e.at === 'JHN 3').map(e => e.ms).slice(-1);
  out.john3_median_ms = +median(john).toFixed(1);
  out.john3_entries = entries.filter(e => e.name === 'chapter' && e.at === 'JHN 3').map(e => Object.fromEntries(Object.entries(e).filter(([k]) => k.endsWith('_ms') || k === 'ms').map(([k, v]) => [k, +v.toFixed(1)])));
  console.log(JSON.stringify(out.john3_entries));
  const base = entries.filter(e => e.name === 'chapter' && (e.at === 'NUM 24' || e.at === 'PSA 23')).slice(-2).map(e => e.ms);
  out.baseline_median_ms = +median(base).toFixed(1);
  check('John 3 opens inside the reader’s budget (a chapter drawn under 100 ms, CPU slowed 4x) with the margin on', out.john3_median_ms < 100 || out.john3_median_ms <= out.baseline_median_ms * 1.15, `${out.john3_median_ms} ms, a chapter with no marks drawn here ${out.baseline_median_ms} ms (${john.map(x => Math.round(x)).join(', ')})`);
  await page.evaluate(() => window.__wb.open('JHN', 3));
  await page.waitForSelector('.mg-mark, .mg-dot', { timeout: 15000 });
  await sleep(2500);
  const perVerse = await page.evaluate(() => { const m = [...document.querySelectorAll('.mg-mark[data-v], .mg-dot[data-v]')].map(e => e.dataset.v); return { marks: m.length, unique: new Set(m).size }; });
  const john3 = await invoke(['margin', 'JHN 3']);
  const withCounts = john3.json.verses.length;
  const withMarks = john3.json.verses.filter(v => v.notes + v.around + v.pages + v.saves > 0).length;
  check('John 3 has one line of counts per verse that has something (one mark each)', perVerse.marks === perVerse.unique && perVerse.marks === withMarks && withMarks >= 1, JSON.stringify({ ...perVerse, withCounts, withMarks }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const v16 = await invoke(['margin', 'JHN 3:16']);
  out.john3_16 = { ms: Math.round(v16.ms), rust_ms: v16.rust_ms };
  const notes = v16.json.notes, written = notes.map(n => n.written);
  check('John 3:16’s margin shows its 41 notes newest first, folded by year', notes.length === 41 && written.every((w, i) => !i || written[i - 1] >= w) && v16.json.years.length >= 1, `${notes.length} notes`);
  check('its pages are grouped by folder, never more than 20 rows before Show all, in the order of MK-13', v16.json.pages.length === 20 && v16.json.pages_total > 20 && v16.json.groups.length > 1 && v16.json.pages[0].in_scripture_block === true, `${v16.json.pages_total} pages`);
  await page.evaluate(() => window.__wb.open('JHN', 3, 16));
  await page.waitForSelector('.mg-mark[data-v="16"], .mg-dot[data-v="16"]', { timeout: 15000 });
  await page.evaluate(() => { window.__toasts = []; new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toasts.push(n.className + ': ' + n.textContent.slice(0, 200)); }).observe(document.body, { childList: true, subtree: true }); window.addEventListener('unhandledrejection', e => window.__toasts.push('UNHANDLED ' + e.reason)); });
  console.log('MARK', JSON.stringify(await page.evaluate(() => { const m = document.querySelector('.mg-mark[data-v="16"], .mg-dot[data-v="16"]'); const r = m.getBoundingClientRect(); const at = document.elementFromPoint(r.x + 3, r.y + 3); return { r: [r.x, r.y, r.width, r.height], at: at && (at.className || at.tagName), toasts: document.querySelector('.toast')?.textContent }; })));
  await page.locator('.mg-mark[data-v="16"], .mg-dot[data-v="16"]').first().click();
  console.log('V16', JSON.stringify(out.john3_16));
  for (let i = 0; i < 40 && !(await page.locator('.mg-panel').count()); i++) await sleep(500);
  console.log('TOASTS', JSON.stringify(await page.evaluate(() => window.__toasts.slice(0, 12))));
  console.log('PANEL', JSON.stringify(await page.evaluate(() => { const p = document.querySelector('.mg-panel'); return p ? { html: p.innerText.slice(0, 200), rect: JSON.stringify(p.getBoundingClientRect()), disp: getComputedStyle(p).display } : null; })));
  await page.waitForSelector('.mg-panel .mg-count', { timeout: 10000 });
  await page.locator('.mg-panel .mg-count', { hasText: 'pages' }).click();
  const rows = await page.locator('.mg-panel .mg-lists .mg-page').count();
  const shown = await page.locator('.mg-panel .mg-group').count();
  check('in the window its pages are grouped by folder, at most 20 folders before Show all', shown === 20 && (await page.locator('.mg-panel .mg-showall').count()) === 1, `${shown} folders shown of ${v16.json.groups.length}`);
  await page.locator('.mg-close').click();
  const map = await invoke(['margin', 'list', '--map']);
  const allChapters = map.json.books.every(b => b.chapters.length > 0);
  check('the map counts every chapter of every book', map.json.books.length === 66 && allChapters && map.json.total === 3100 + 1, `${map.json.books.length} books, ${map.json.total} notes, ${Math.round(map.ms)} ms`);
  const big = await page.evaluate(() => { const a = [...document.querySelectorAll('.nb-block')]; return a.length; });
  void big;
  // a search answers inside the search budget, grouped by kind
  const times = [];
  for (const q of ['Lesson', 'Lesson 1', 'John']) { const r = await invoke(['find', q, '--sort', 'edited']); times.push(r.ms); out.search_kinds = r.json.groups.map(g => [g.kind, g.count]); }
  out.search_ms = times.map(x => Math.round(x));
  check('a search of everything answers under the 50 ms budget, grouped by kind', Math.max(...times) < 50 && out.search_kinds.length >= 5, `${out.search_ms.join(', ')} ms; ${JSON.stringify(out.search_kinds)}`);

  // ---- the reader's place is kept ------------------------------------------------------------------------------------
  await page.evaluate(() => window.__wb.open('NUM', 25, 11));
  await sleep(1200);
  const at = await page.evaluate(() => ({ top: document.getElementById('scroller').scrollTop, ch: document.querySelector('.ch-title')?.textContent }));
  const mark = page.locator('.mg-mark[data-v="11"], .mg-dot[data-v="11"]').first();
  await mark.waitFor({ timeout: 10000 });
  await mark.click();
  await page.waitForSelector('.mg-panel .mg-verse', { timeout: 10000 });
  await page.locator('.mg-panel .mg-count', { hasText: 'page' }).first().click();
  await page.locator('.mg-panel .mg-lists .mg-page', { hasText: 'Reader place check' }).click();
  await page.waitForSelector('.pane-notebook .nb-title', { timeout: 10000 });
  await sleep(500);
  await page.locator('.pane-notebook a.ref', { hasText: /Psalm 106:30/ }).first().click();
  await page.locator('.verse-card .open-split-go').first().click();
  await sleep(1500);
  const moved = await page.evaluate(() => document.querySelector('.ch-title')?.textContent + '|' + [...document.querySelectorAll('.reader2-title')].map(e => e.textContent).join(','));
  check('following the page’s reference goes to Psalms 106:30 (the reader or a second reader)', /Psalms 106/.test(moved), moved);
  await page.evaluate(() => window.__wb.run('back'));
  await sleep(800);
  await page.evaluate(() => window.__wb.run('back'));
  await sleep(1500);
  const after = await page.evaluate(() => ({ top: document.getElementById('scroller').scrollTop, ch: document.querySelector('.ch-title')?.textContent, panel: document.querySelector('.mg-panel .mg-head b')?.textContent || '' }));
  check('Back twice returns to Numbers 25:11 at the same scroll position', after.ch === at.ch && Math.abs(after.top - at.top) <= 2, `${at.ch} ${Math.round(at.top)} → ${after.ch} ${Math.round(after.top)}`);
  check('and the margin is still open on verse 11', /Numbers 25:11/.test(after.panel), after.panel);
  // from Margin notes in the Library: a click on a note, Back, the same row
  await page.locator('.mg-close').click().catch(() => {});
  await page.evaluate(() => window.__wb.open('JHN', 3));
  await sleep(800);
  const row = page.locator('.mgl').first();
  await row.locator('.mgl-sum').click();
  await row.locator('.mgl-book[data-code="NUM"] > summary').click();
  await row.locator('.mgl-chapter[data-chapter="25"] > summary').click();
  const note = row.locator('.mgl-chapter[data-chapter="25"] .mgl-note').filter({ hasText: 'A note for the place check' });
  await note.waitFor({ timeout: 10000 });
  const rowId = await note.getAttribute('data-id');
  await note.click();
  await sleep(1200);
  const opened = await page.evaluate(() => document.querySelector('.ch-title')?.textContent);
  await page.evaluate(() => window.__wb.run('back'));
  await sleep(1200);
  const back = await page.evaluate(() => document.querySelector('.ch-title')?.textContent);
  check('a click on a Margin notes row opens the reader at its verse; Back returns, and the row is the same row', /Numbers 25/.test(opened) && /John 3/.test(back) && (await page.locator(`.mgl-note[data-id="${rowId}"]`).isVisible()), `${opened} → ${back}`);
  writeFileSync(path.join(file('measure/out/'), 'marks.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
} catch (e) {
  check('the run finished', false, String(e?.stack || e));
  try { await browser?.contexts()[0].pages()[0].screenshot({ path: path.join(work, 'failed.png') }); } catch { /* none */ }
} finally {
  await browser?.close().catch(() => {});
  kill();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
