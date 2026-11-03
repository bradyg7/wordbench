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
  // a reference in a note shows its verse on hover, verbatim
  await page.locator('.nb-entry a.ref').first().hover();
  const cor = JSON.parse(execFileSync(wbExe, ['text', '1 Cor 10:8', '--json'], { env }).toString()).verses[0].text;
  check('hovering a reference in a note shows the verse', await page.locator('.hovercard', { hasText: cor }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.mouse.move(700, 300);
  await page.locator('.nb-entry .btn', { hasText: 'Place it' }).first().click();
  await page.waitForSelector('.place-menu .place-opt');
  const offered = await page.locator('.place-menu .place-opt-label').allTextContents();
  check('Place it offers the place the note names', offered.includes('1 Corinthians 10:8'), offered.join(', '));
  await page.screenshot({ path: shots + '1440-placing-a-note.png' });
  await page.locator('.place-menu .place-opt', { hasText: '1 Corinthians 10:8' }).click();
  await page.waitForFunction(() => !document.querySelector('#tb-notebook .badge') || document.querySelector('#tb-notebook .badge').hidden, null, { timeout: 10000 });
  check('placing moves the file to notes/1CO', existsSync(path.join(study, 'notes', '1CO', inbox[0])) && !existsSync(path.join(study, 'notes', '_inbox', inbox[0])));

  // an Inbox note dragged onto a verse in the reader is placed there
  await page.locator('.nb-seg button', { hasText: 'Journal' }).click();
  await ta.click();
  await ta.fill('Dragged onto its verse');
  await ta.press('Enter');
  await page.waitForFunction(() => document.querySelector('#tb-notebook .badge')?.textContent === '1', null, { timeout: 10000 });
  await page.locator('.nb-seg button', { hasText: 'Inbox' }).click();
  const dragged = readdirSync(path.join(study, 'notes', '_inbox'))[0];
  await page.locator('.nb-entry[draggable="true"]').first().dragTo(page.locator('.vn[data-v="3"]'));
  for (let i = 0; i < 50 && !existsSync(path.join(study, 'notes', 'NUM', dragged)); i++) await sleep(100);
  check('an Inbox note dropped on a verse is placed there', existsSync(path.join(study, 'notes', 'NUM', dragged)) && /anchor: "NUM.25:3"/.test(readFileSync(path.join(study, 'notes', 'NUM', dragged), 'utf8')));

  // a note and a question from the verse popover
  await page.locator('.vn[data-v="9"]').click();
  await page.locator('.popover .act', { hasText: 'Question' }).click();
  await page.locator('.note-form textarea').fill('How do the two numbers relate?');
  await page.locator('.note-form textarea').press('Enter');
  await page.waitForSelector('.vn[data-v="9"].vq', { timeout: 10000 });
  check('a question puts a ? on its verse number', true);

  // the color bar: select words with the mouse, 2 colors them green, the recent threads are chips, 0 removes the color
  const anchorOf = () => page.evaluate(() => {
    const d = window.__wb.drawn, s = window.__wb.selector.sel;
    return `NUM.25:${d.v[s.a]}.${d.i[s.a]}-25:${d.v[s.b]}.${d.i[s.b]}`;
  });
  const boxOf = async (v, i) => page.evaluate(([v, i]) => {
    const d = window.__wb.drawn, k = d.v.findIndex((x, n) => x === v && d.i[n] === i);
    const e = d.el[k]; e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [v, i]);
  const w1 = await boxOf(16, 2), w2 = await boxOf(16, 5);
  await page.mouse.move(w1.x, w1.y); await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(w1.x + (w2.x - w1.x) * k / 6, w1.y + (w2.y - w1.y) * k / 6);
  await page.mouse.up();
  await page.waitForSelector('.colorbar', { timeout: 5000 });
  const sel = await anchorOf();
  await page.waitForSelector('.colorbar .cb-chip', { timeout: 5000 }).catch(() => {});
  check('the color bar has ×, and chips for recent threads', await page.locator('.colorbar .swatch.clear').count() === 1 && await page.locator('.colorbar .cb-chip').count() > 0);
  await page.screenshot({ path: shots + '1440-color-bar.png' });
  await page.keyboard.press('2');
  await sleep(800);
  const hl = () => JSON.parse(execFileSync(wbExe, ['anchor', sel], { env }).toString()).highlight;
  check('2 colors the selection green', hl() === 'green', sel);
  // the same words again, then 0
  await page.mouse.move(w1.x, w1.y); await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(w1.x + (w2.x - w1.x) * k / 6, w1.y + (w2.y - w1.y) * k / 6);
  await page.mouse.up();
  await page.waitForSelector('.colorbar', { timeout: 5000 });
  await page.keyboard.press('0');
  await sleep(800);
  check('0 removes the highlight', hl() === null);

  // Notes & lookup for a verse: color it, write a note there, and take the color off again
  await page.locator('.vn[data-v="4"]').click();
  await page.locator('.popover .act', { hasText: 'Notes & lookup' }).click();
  await page.waitForSelector('.pane-place:visible .place-quote', { timeout: 10000 });
  const v4 = JSON.parse(execFileSync(wbExe, ['text', 'Num 25:4', '--json'], { env }).toString()).verses[0].text;
  check('Notes & lookup shows the verse verbatim', (await page.locator('.pane-place:visible .place-quote').textContent()) === v4);
  await page.locator('.pane-place:visible .swatch.c-blue').click();
  await page.waitForSelector('.pane-place:visible .swatch.c-blue.on', { timeout: 10000 });
  await page.locator('.pane-place:visible .place-write textarea').fill('A note written in the place pane');
  await page.locator('.pane-place:visible .place-write textarea').press('Enter');
  await page.waitForSelector('.pane-place:visible .note-card .nb-text', { timeout: 10000 });
  const at4 = JSON.parse(execFileSync(wbExe, ['anchor', 'Num 25:4'], { env }).toString());
  check('the place pane colors the verse and writes a note there', at4.highlight === 'blue' && at4.notes.some(n => n.text === 'A note written in the place pane'));
  await page.screenshot({ path: shots + '1440-notes-and-lookup.png' });
  await page.locator('.pane-place:visible .swatch.clear').click();
  await sleep(800);
  check('× in the place pane removes the highlight', JSON.parse(execFileSync(wbExe, ['anchor', 'Num 25:4'], { env }).toString()).highlight === null);

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

  // a tab dragged over the reader floats its pane; dragged to the left edge, it docks there again
  const tabAt = async title => (await page.locator('.dock-col.open .tab-name', { hasText: title }).first().boundingBox());
  const drag = async (from, x, y) => {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let k = 1; k <= 10; k++) await page.mouse.move(from.x + (x - from.x) * k / 10, from.y + (y - from.y) * k / 10);
    await page.mouse.up();
    await sleep(300);
  };
  await drag(await tabAt('Interlinear'), 720, 400);
  check('a tab dropped over the reader floats', await page.locator('.dock-float.open .tab-name', { hasText: 'Interlinear' }).count() === 1);
  await page.screenshot({ path: shots + '1440-a-floating-pane.png' });
  await drag(await tabAt('Interlinear'), 60, 400);
  check('dropped at the left edge, it docks there', await page.locator('.dock-left.open .tab-name', { hasText: 'Interlinear' }).count() === 1);

  // many tabs in one column: they keep their size and scroll; ‹ › and the ▾ list reach every one
  for (let v = 1; v <= 8; v++) await page.evaluate(v => window.__wb.run(`notes @Num 25:${v}`), v);
  await page.waitForSelector('.dock-right .tabstrip.overflowing', { timeout: 10000 });
  const strip = await page.evaluate(() => {
    const t = document.querySelector('.dock-right .tab-row'), on = t.querySelector('.tab.on');
    const widths = [...t.querySelectorAll('.tab')].map(x => x.getBoundingClientRect().width);
    const sr = t.getBoundingClientRect(), r = on.getBoundingClientRect();
    return { n: widths.length, narrowest: Math.min(...widths), onVisible: r.left >= sr.left - 1 && r.right <= sr.right + 1, scroll: t.scrollLeft };
  });
  check('many tabs keep a usable width and the front one stays in view', strip.n >= 9 && strip.narrowest >= 84 && strip.onVisible, `${strip.n} tabs, narrowest ${Math.round(strip.narrowest)} px`);
  await page.locator('.dock-right .tab-scroll.back').click();
  await sleep(500);
  const after = await page.evaluate(() => document.querySelector('.dock-right .tab-row').scrollLeft);
  check('‹ scrolls the tabs back', after < strip.scroll, `${Math.round(strip.scroll)} → ${Math.round(after)}`);
  await page.locator('.dock-right .tab-row').hover();
  await page.mouse.wheel(0, 400);
  await sleep(300);
  check('the mouse wheel scrolls the tabs sideways', (await page.evaluate(() => document.querySelector('.dock-right .tab-row').scrollLeft)) > after);
  await page.locator('.dock-right .tab-list').click();
  const listed = await page.locator('.menu .menu-item').count();
  check('▾ lists every tab in the column', listed === strip.n, `${listed}`);
  await page.locator('.menu .menu-item', { hasText: 'Notebook' }).click();
  check('choosing one from the list brings it to the front', await page.locator('.dock-right .pane-notebook:visible').count() === 1);
  await page.screenshot({ path: shots + '1440-many-tabs.png' });
  // the column's width: drag its edge, expand to half the window, double-click the edge to put it back
  const colW = () => page.evaluate(() => document.querySelector('.dock-right').getBoundingClientRect().width);
  const cw0 = await colW();
  const g = await page.locator('.dock-right .dock-grip').boundingBox();
  await page.mouse.move(g.x + g.width / 2, 400); await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(g.x + g.width / 2 - 20 * k, 400);
  await page.mouse.up();
  await sleep(300);
  const cw1 = await colW();
  check('dragging the column’s edge makes it wider', Math.abs(cw1 - (cw0 + 160)) <= 6, `${Math.round(cw0)} → ${Math.round(cw1)} px`);
  await page.locator('.dock-right .strip-btn[aria-label="Expand to half the window"]').click();
  await sleep(300);
  const cw2 = await colW();
  check('expand gives the column half the window, the reader keeping room', cw2 > cw1 && (await page.evaluate(() => document.getElementById('scroller').getBoundingClientRect().width)) >= 460, `${Math.round(cw2)} px`);
  await page.screenshot({ path: shots + '1440-expanded-column.png' });
  await page.locator('.dock-right .strip-btn[aria-label="Back to its width"]').click();
  await page.locator('.dock-right .dock-grip').dblclick();
  await sleep(300);
  check('double-clicking the edge puts the usual width back', Math.abs((await colW()) - cw0) <= 2);
  for (const p of await page.evaluate(() => window.__wb.dock().panes.filter(p => p.kind === 'place').map(p => p.id))) await page.evaluate(id => { const d = window.__wb.dock(); d.close(d.panes.find(p => p.id === id)); }, p);

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
