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
  await page.waitForSelector('.pane-notebook .nb-group', { timeout: 15000 });
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
  await page.waitForFunction(() => [...document.querySelectorAll('.suggest-group')].some(g => g.textContent === 'Commands'), null, { timeout: 5000 }).catch(() => {});
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

  // the Notebook (design B): a new note with no place, the list, the editor, + Place
  const nbItem = t => page.locator('.pane-notebook .nb-item', { hasText: t }).first();
  const ed = page.locator('.pane-notebook .nb-editor');
  const nbBack = async () => { if (await page.locator('.pane-notebook .nb.editing:not(.two) .nb-back').count()) await page.locator('.pane-notebook .nb-back').first().click(); };
  const typing = () => page.waitForFunction(() => document.activeElement?.classList.contains('nb-input') && !!document.activeElement.closest('.pane-notebook'), null, { timeout: 10000 }).then(() => true, () => false);
  const done = async () => { await page.keyboard.press('Escape'); await sleep(900); };
  await page.locator('.pane-notebook .nb-new').click();
  check('the pen in the Notebook starts a note, ready to type', await typing());
  await page.keyboard.type('Check where else this phrase is used; compare 1 Cor 10:8');
  await done();
  await page.waitForFunction(() => document.querySelector('#tb-notebook .badge')?.textContent === '1', null, { timeout: 10000 });
  const inbox = readdirSync(path.join(study, 'notes', '_inbox'));
  check('a note with no place is a file in notes/_inbox', inbox.length === 1, inbox[0]);
  check('the editor shows it as a page, its first line its title', (await ed.locator('.nb-title').textContent()).startsWith('Check where else'));
  await page.screenshot({ path: shots + '1440-notebook-a-new-note.png' });
  await nbBack();
  check('the list shows it with no place yet', await nbItem('Check where else').locator('.unplaced', { hasText: 'No place yet' }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await nbItem('Check where else').click();
  // a reference in a note: hover cards are off by default; a click shows its verse, verbatim, and opens it as a tab
  const cor = JSON.parse(execFileSync(wbExe, ['text', '1 Cor 10:8', '--json'], { env }).toString()).verses[0].text;
  await ed.locator('.nb-page a.ref').first().hover();
  await sleep(700);
  check('hover cards are off by default', await page.locator('.hovercard').count() === 0 && await page.evaluate(() => document.documentElement.dataset.hover) === 'off');
  const placeAtRef = await page.locator('#place .place-label').textContent();
  await ed.locator('.nb-page a.ref').first().click();
  check('clicking a reference in a note shows the verse', await page.locator('.popover', { hasText: cor }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  check('the click does not move the reader', (await page.locator('#place .place-label').textContent()) === placeAtRef);
  await page.locator('.popover .act', { hasText: 'Open as a tab' }).click();
  check('Open as a tab opens the verse in a second reader, marked', await page.locator('.pane-reader2 .vn-asked[data-v="8"]').waitFor({ timeout: 5000 }).then(() => true, () => false) && (await page.locator('.pane-reader2 .reader2-title').first().textContent()) === '1 Corinthians 10');
  check('a verse opened from a note opens in the Notebook’s column', await page.locator('.dock-right .pane-reader2', { hasText: cor }).count() === 1);
  await page.evaluate(() => window.__wb.run('notebook'));
  await page.evaluate(() => window.__wb.run('hover on'));
  await ed.locator('.nb-page a.ref').first().hover();
  check('with hover on, hovering a reference shows the verse', await page.locator('.hovercard', { hasText: cor }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.mouse.move(700, 300);
  await page.evaluate(() => window.__wb.run('hover off'));
  await ed.locator('.nb-add', { hasText: '+ Place' }).click();
  await page.waitForSelector('.place-menu .place-opt');
  const offered = await page.locator('.place-menu .place-opt-label').allTextContents();
  check('+ Place offers the place the note names, and the chapter and book being read', offered.includes('1 Corinthians 10:8') && offered.includes('Numbers 25') && offered.includes('Numbers'), offered.join(', '));
  await page.screenshot({ path: shots + '1440-placing-a-note.png' });
  await page.locator('.place-menu .place-opt', { hasText: '1 Corinthians 10:8' }).click();
  await page.waitForFunction(() => !document.querySelector('#tb-notebook .badge') || document.querySelector('#tb-notebook .badge').hidden, null, { timeout: 10000 });
  check('placing moves the file to notes/1CO', existsSync(path.join(study, 'notes', '1CO', inbox[0])) && !existsSync(path.join(study, 'notes', '_inbox', inbox[0])));
  await nbBack();

  // an Inbox note dragged onto a verse in the reader is placed there
  await page.locator('.pane-notebook .nb-new').click();
  await typing();
  await page.keyboard.type('Dragged onto its verse');
  await done();
  await page.waitForFunction(() => document.querySelector('#tb-notebook .badge')?.textContent === '1', null, { timeout: 10000 });
  await nbBack();
  const dragged = readdirSync(path.join(study, 'notes', '_inbox'))[0];
  await page.locator('.pane-notebook .nb-item[draggable="true"]').first().dragTo(page.locator('#reader .vn[data-v="3"]'));
  for (let i = 0; i < 50 && !existsSync(path.join(study, 'notes', 'NUM', dragged)); i++) await sleep(100);
  check('an Inbox note dropped on a verse is placed there', existsSync(path.join(study, 'notes', 'NUM', dragged)) && /anchor: "NUM.25:3"/.test(readFileSync(path.join(study, 'notes', 'NUM', dragged), 'utf8')));

  // a verse picked by its number can be a tab (a second reader); so can a word
  await page.locator('#reader .vn[data-v="6"]').click();
  await page.locator('.colorbar .act', { hasText: 'Open as a tab' }).click();
  check('Open as a tab on a verse opens it in a second reader', await page.locator('.pane-reader2 .vn-asked[data-v="6"]').waitFor({ timeout: 5000 }).then(() => true, () => false));
  const zeal = await page.evaluate(() => {   // "zealous" in Num 25:11, a word with a Strong's number
    const d = window.__wb.drawn, k = d.v.findIndex((v, k) => v === 11 && String(d.strong[k]).includes('7065'));
    d.el[k].scrollIntoView({ block: 'center' });
    const r = d.el[k].getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  });
  await page.mouse.click(zeal[0], zeal[1]);
  await page.waitForSelector('.popover .lemma', { timeout: 5000 });
  const strongNum = (await page.locator('.popover .lemma-row .small').textContent()).split(' ')[0];
  await page.locator('.popover .act', { hasText: 'Open as a tab' }).click();
  check('Open as a tab on a word opens its Strong’s entry', await page.locator('.tab-name', { hasText: strongNum }).first().waitFor({ timeout: 5000 }).then(() => true, () => false), strongNum);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => ['passage', 'reader2', 'strong'].includes(p.kind))) d.close(p); });

  // a question from the verse's bar: a new question in the Notebook's editor (one writing box), with the place chosen
  await page.locator('#reader .vn[data-v="9"]').click();
  await page.locator('.colorbar .act', { hasText: 'Question' }).click();
  await page.waitForFunction(() => document.activeElement?.classList.contains('nb-input'), null, { timeout: 10000 });
  const boxes = await page.evaluate(() => [...document.querySelectorAll('textarea')].filter(t => t.offsetWidth).map(t => t.placeholder));
  check('Question on a verse writes in the Notebook’s editor, the only box shown', boxes.length === 1 && boxes[0] === 'Your question on Numbers 25:9…', boxes.join(' | '));
  await page.keyboard.type('How do the two numbers relate?');
  await done();
  await page.waitForSelector('#reader .vn[data-v="9"].vq', { timeout: 10000 });
  check('a question puts a ? on its verse number', true);
  check('the Notebook has no second writing box', await page.locator('.pane-notebook textarea').count() <= 1);
  await nbBack();

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
  // a click away from the color bar closes it and clears the selection (note c35b)
  await page.mouse.move(w1.x, w1.y); await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(w1.x + (w2.x - w1.x) * k / 6, w1.y + (w2.y - w1.y) * k / 6);
  await page.mouse.up();
  await page.waitForSelector('.colorbar', { timeout: 5000 });
  await page.locator('.dock-right .pane:visible').first().click({ position: { x: 60, y: 8 } });
  await sleep(200);
  check('a click away from the color bar closes it and clears the selection', await page.locator('.colorbar').count() === 0 && await page.evaluate(() => !window.__wb.selector.sel && !document.querySelector('.w.sel')));

  // Notes & lookup for a verse: color it, write a note there, and take the color off again
  await page.locator('#reader .vn[data-v="4"]').click();
  await page.locator('.colorbar .act', { hasText: 'Notes & lookup' }).click();
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
  const tabAt = async title => (await page.locator('.dock-group .tab-name', { hasText: title }).first().boundingBox());
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
  // a new pane opens where a pane of its kind, or the pane it was opened from, is (note 8c69)
  await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'thread')) d.close(p); });
  await page.evaluate(() => window.__wb.run('threads'));
  await page.waitForSelector('.pane-threads .thread-open', { timeout: 10000 });
  await drag(await tabAt('Threads'), 60, 400);
  await page.locator('.dock-left .pane-threads .thread-open').first().click();
  check('with Threads moved left, a thread opened from it opens left', await page.locator('.dock-left .pane-thread').first().waitFor({ timeout: 10000 }).then(() => true, () => false) && await page.locator('.dock-right .pane-thread').count() === 0);
  await page.locator('#reader').click({ position: { x: 5, y: 5 } });
  await page.evaluate(() => window.__wb.run('thread Plague stayed'));
  check('a thread opened from the command field opens beside the other threads', await page.locator('.dock-left .tab-name', { hasText: 'Plague stayed' }).first().waitFor({ timeout: 10000 }).then(() => true, () => false));
  await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind.startsWith('thread'))) d.close(p); });

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
  // a trash on each tab in the list, red on hover, closes that tab and keeps the list open (note 5e36)
  check('each tab in the list has a trash (note 5e36)', await page.locator('.menu .tab-list-row .tab-list-close').count() === strip.n);
  const trash = page.locator('.menu .tab-list-row', { hasText: 'Numbers 25:2' }).locator('.tab-list-close');
  await trash.hover();
  const red = await page.evaluate(() => {
    const x = document.querySelector('.menu .tab-list-close:hover'), ref = document.createElement('i');
    ref.style.color = 'var(--jesus)'; document.body.append(ref);
    const want = getComputedStyle(ref).color; ref.remove();
    return [x ? getComputedStyle(x).color : 'none', want];
  });
  check('the trash turns red on hover', red[0] === red[1], red.join(' / '));
  await trash.click();
  await sleep(300);
  check('the trash closes that tab, and the list stays open', !(await page.evaluate(() => window.__wb.dock().panes.some(p => p.title === 'Numbers 25:2'))) && await page.locator('.menu .menu-item').count() === strip.n - 1);
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
  // Ctrl+F in a pane finds in that pane (note 5c4a); in the reader it still finds in the chapter
  await page.evaluate(() => window.__wb.run('keys'));
  await page.locator('.pane-keys:visible').click({ position: { x: 40, y: 10 } });
  await page.keyboard.press('Control+f');
  await page.keyboard.type('chapter');
  await sleep(200);
  const pf = await page.evaluate(() => { const b = document.querySelector('.pane-keys .pane-find'); return b && { found: +b.dataset.found, focus: document.activeElement?.closest('.pane-find') === b, reader: !document.getElementById('findbar').hidden }; });
  check('Ctrl+F in a pane opens its own find bar and finds there (note 5c4a)', !!pf && pf.found > 0 && pf.focus && !pf.reader, JSON.stringify(pf));
  await page.screenshot({ path: shots + '1440-find-in-a-pane.png' });
  await page.keyboard.press('Escape');
  check('Esc closes the pane’s find bar', await page.locator('.pane-find').count() === 0);
  await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'keys')) d.close(p); });
  await page.locator('#reader').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+f');
  check('Ctrl+F after a click in the reader finds in the chapter', await page.evaluate(() => !document.getElementById('findbar').hidden && document.activeElement?.closest('#findbar') !== null));
  await page.keyboard.press('Escape');
  const px = () => page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('reader')).fontSize));
  const f0 = await px();
  await page.keyboard.press('Control+=');
  check('Ctrl+= makes the text larger', (await px()) > f0);
  await page.keyboard.press('Control+0');
  // quick capture (B2): Ctrl+J from anywhere opens a small box at the verse last clicked; Enter saves a note there,
  // Ctrl+Enter saves it and opens it in the Notebook; listed in Keys (notes e998, 09ef)
  const notesOn = (place, at) => JSON.parse(execFileSync(wbExe, ['note', 'list', place], { env }).toString()).filter(n => !at || n.anchor === at);
  const capturing = () => page.waitForFunction(() => document.activeElement?.classList.contains('capture-field'), null, { timeout: 5000 }).then(() => true, () => false);
  await page.locator('#reader').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+j');
  check('Ctrl+J from the reader opens quick capture, ready to type', await capturing());
  await page.keyboard.press('Escape');
  check('Esc closes it', await page.locator('.capture').count() === 0);
  await page.locator('#cmd').focus();
  await page.keyboard.press('Control+j');
  check('Ctrl+J from the command field does too', await capturing());
  await page.keyboard.press('Escape');
  await page.locator('#reader .vn[data-v="7"]').click();
  await page.waitForSelector('.colorbar', { timeout: 5000 });
  await page.keyboard.press('Escape');
  await sleep(300);
  check('Esc clears the verse picked and its bar', await page.locator('.colorbar').count() === 0 && await page.locator('#reader .w.sel').count() === 0, await page.evaluate(() => document.getElementById('overlay').innerHTML.slice(0, 300)));
  await page.keyboard.press('Control+j');
  await capturing();
  check('quick capture is on the verse last clicked', (await page.locator('.capture .place-pill').textContent()).includes('Numbers 25:7'));
  await page.screenshot({ path: shots + '1440-quick-capture.png' });
  await page.keyboard.type('a captured thought');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 30 && !notesOn('Num 25', 'NUM.25:7').some(n => n.text === 'a captured thought'); i++) await sleep(100);
  check('Enter saves it as a note on that verse', notesOn('Num 25', 'NUM.25:7').some(n => n.text === 'a captured thought') && await page.locator('.capture').count() === 0);
  await page.keyboard.press('Control+j');
  await capturing();
  await page.locator('.capture .place-off .member-x').click();
  await page.locator('.capture-field').fill('captured, then more');
  await page.keyboard.press('Control+Enter');
  check('Ctrl+Enter opens it in the Notebook to keep writing', await typing() && (await ed.locator('textarea.nb-input').inputValue()) === 'captured, then more');
  await done();
  check('nothing is left open over the window after quick capture', await page.locator('#overlay .scrim').count() === 0, await page.evaluate(() => [...document.getElementById('overlay').children].map(c => c.className).join(', ')));
  check('with its place taken off, it waits in the Inbox', JSON.parse(execFileSync(wbExe, ['inbox'], { env }).toString()).notes.some(n => n.text === 'captured, then more'));
  await nbBack();
  await page.evaluate(() => window.__wb.run('keys'));
  check('Keys lists Ctrl+J', await page.locator('.pane-keys kbd', { hasText: 'Ctrl+J' }).first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'keys')) d.close(p); });
  await page.locator('#reader').click({ position: { x: 5, y: 5 } });
  await page.locator('#reader').click({ position: { x: 5, y: 5 } });

  // the phase 2 check's first findings (docs/phase2-results.md section 10)
  await page.evaluate(() => window.__wb.run('threads'));
  await sleep(700);
  check('the threads list wraps instead of scrolling sideways', await page.evaluate(() => { const p = [...document.querySelectorAll('.pane-threads')].find(x => x.offsetWidth); return !!p && p.scrollWidth <= p.clientWidth + 1; }));
  await page.evaluate(() => window.__wb.run('def H7065'));
  await page.locator('.pane-strong:visible button.chip.link', { hasText: /^zealous / }).first().click();
  await page.waitForSelector('.pane-uses:visible .row', { timeout: 10000 });
  const zealous = JSON.parse(execFileSync(wbExe, ['uses', 'H7065', '--rendering', 'zealous'], { env }).toString());
  // the uses pane just opened (a split column can show another one too)
  const usesRows = () => page.evaluate(() => window.__wb.dock().panes.filter(p => p.kind === 'uses').at(-1).el.querySelectorAll('.row').length);
  for (let i = 0; i < 30 && (await usesRows()) !== zealous.verses; i++) await sleep(100);
  check('a rendering in word study opens only the verses rendered that way', (await usesRows()) === zealous.verses, `${zealous.verses} verses`);
  await page.evaluate(() => window.__wb.run('notebook'));
  await nbBack();
  await nbItem('two numbers relate').click();
  await ed.getByRole('button', { name: '✓ Answered' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.pane-notebook .nb-item.done')].some(e => e.textContent.includes('two numbers relate')), null, { timeout: 10000 });
  await ed.locator('.nb-chips .question-pill').click();
  await page.waitForFunction(() => { const e = document.querySelector('.pane-notebook .nb-editor'); return e && e.textContent.includes('two numbers relate') && !e.querySelector('.nb-chips .question-pill'); }, null, { timeout: 10000 });
  check('a question is answered, then made a plain note by clicking its tag', true);
  await ed.locator('.nb-ed-head .icon-btn').click();
  check('a placed note’s menu has Move and Delete', await page.locator('.menu .menu-item', { hasText: 'Move to another place' }).isVisible() && await page.locator('.menu .menu-item', { hasText: 'Delete' }).isVisible());
  await page.locator('.menu .menu-item', { hasText: 'Move to another place' }).click();
  await page.locator('.place-other input').fill('Num 25:18');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.pane-notebook .nb-editor .nb-chips')?.textContent.includes('25:18'), null, { timeout: 10000 });
  check('Move gives a placed note another verse', JSON.parse(execFileSync(wbExe, ['note', 'list', 'Num 25:18'], { env }).toString()).some(n => n.text.includes('two numbers relate')));
  await nbBack();
  await page.evaluate(() => window.__wb.open('NUM', 25, 18));
  await page.locator('.chapter-end .btn').click();
  await page.waitForFunction(() => /read /.test(document.querySelector('.chapter-read')?.textContent || ''), null, { timeout: 10000 });
  await page.evaluate(() => window.__wb.open('NUM', 26, 1));
  await sleep(400);
  await page.evaluate(() => window.__wb.open('NUM', 25, 18));
  await page.waitForFunction(() => /read /.test(document.querySelector('.chapter-read')?.textContent || ''), null, { timeout: 10000 });
  check('a chapter marked read says so when it is opened again', true, await page.locator('.chapter-read').textContent());
  // how many times it was read, and Mark unread (note c419)
  const times = () => JSON.parse(execFileSync(wbExe, ['read', 'times', 'Num 25'], { env }).toString())['NUM.25']?.times ?? 0;
  const readSaid = n => (n === 1 ? 'read once' : `read ${n} times`);
  const t0 = times();
  await page.locator('.chapter-end .btn').click();
  await page.waitForFunction(s => document.querySelector('.chapter-read')?.textContent.includes(s), readSaid(t0 + 1), { timeout: 10000 }).catch(() => {});
  check('the chapter’s end counts the times read (note c419)', times() === t0 + 1 && (await page.locator('.chapter-read').textContent()).includes(readSaid(t0 + 1)), await page.locator('.chapter-read').textContent());
  await page.locator('.chapter-end .chapter-unread').click();
  await page.waitForFunction(s => document.querySelector('.chapter-read')?.textContent.includes(s), readSaid(t0), { timeout: 10000 }).catch(() => {});
  check('Mark unread takes the latest mark off; the line is kept in .trash', times() === t0 && (await page.locator('.chapter-read').textContent()).includes(readSaid(t0)) && existsSync(path.join(study, '.trash', 'reading-unmarked.jsonl')));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  check('the light theme keeps light scrollbars under a dark system', await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme) === 'light');
  await page.evaluate(() => { delete document.documentElement.dataset.theme; });
  await page.emulateMedia({ colorScheme: null });

  // the person's decisions of 2026-11-03: the pen, more places, notes on a thread, the Trash
  await page.evaluate(() => window.__wb.open('NUM', 25, 11));
  await sleep(400);
  check('no pen over the reader at desktop sizes (note e3fe)', !(await page.locator('#pen').isVisible()));
  await page.locator('#reader .vn[data-v="11"]').click();
  await page.locator('.colorbar .act', { hasText: /^Note$/ }).click();
  await page.waitForFunction(() => document.activeElement?.classList.contains('nb-input'), null, { timeout: 10000 });
  await page.keyboard.type('zeal in more than one place');
  await done();
  await ed.locator('.nb-title', { hasText: 'zeal in more than one place' }).waitFor({ timeout: 10000 });
  const penAt = await ed.locator('.nb-chips .place-pill').first().textContent();
  check('the pen writes a note on the place picked or the verse at the top', /Numbers 25/.test(penAt), penAt);
  await ed.locator('.nb-add', { hasText: '+ Place' }).click();
  await page.locator('.place-other input').fill('Ps 106:30');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.pane-notebook .nb-editor .nb-chips')?.textContent.includes('Psalms 106:30'), null, { timeout: 10000 });
  const ps106 = JSON.parse(execFileSync(wbExe, ['note', 'list', 'Psalms 106'], { env }).toString());
  check('+ Place puts a note on a far place too', ps106.some(n => n.text === 'zeal in more than one place'));
  await ed.locator('.nb-add', { hasText: '+ Thread' }).click();
  await page.locator('.chooser input').fill('Zeal notes');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.pane-notebook .nb-editor .nb-thread-chip', { timeout: 10000 });
  await page.evaluate(() => window.__wb.run('thread Zeal notes'));
  await page.waitForSelector('.pane-thread:visible .thread-notes .note-card', { timeout: 10000 });
  await page.locator('.pane-thread:visible .thread-notes textarea').fill('a note on the thread itself');
  await page.locator('.pane-thread:visible .thread-notes textarea').press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.pane-thread .thread-notes .note-card')].filter(e => e.offsetWidth).length === 2, null, { timeout: 10000 });
  const tn = JSON.parse(execFileSync(wbExe, ['thread', 'notes', 'Zeal notes'], { env }).toString()).notes;
  check('a thread holds notes: one put on it, one written on it', tn.length === 2 && tn.some(n => n.text === 'a note on the thread itself' && n.anchor === ''));
  await page.screenshot({ path: shots + '1440-notes-on-a-thread.png' });
  page.once('dialog', d => d.accept());
  await page.locator('.pane-thread:visible .thread-notes .note-card', { hasText: 'a note on the thread itself' }).getByRole('button', { name: 'Delete' }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll('.pane-thread .thread-notes .note-card')].some(e => e.offsetWidth && e.textContent.includes('a note on the thread itself')), null, { timeout: 10000 });
  await page.evaluate(() => window.__wb.run('notebook'));
  const openTrash = async () => { await page.locator('.pane-notebook .nb-more').click(); await page.locator('.menu .menu-item', { hasText: 'Trash' }).click(); };
  await nbBack();
  await openTrash();
  const gone = page.locator('.pane-notebook .nb-entry.trashed', { hasText: 'a note on the thread itself' }).first();
  await gone.waitFor({ timeout: 10000 });
  check('a deleted note is in the Trash with its days left', /erased in 7 days/.test(await gone.textContent()));
  await gone.getByRole('button', { name: 'Put it back' }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll('.pane-notebook .nb-entry.trashed')].some(e => e.textContent.includes('a note on the thread itself')), null, { timeout: 10000 });
  check('Put it back restores it to its thread', JSON.parse(execFileSync(wbExe, ['thread', 'notes', 'Zeal notes'], { env }).toString()).notes.length === 2);
  await page.locator('.pane-notebook .nb-back.shown').click();

  // Take off a note's place, its first too (note c8dc): the next of its places becomes its place; the last, the Inbox
  const notesAt = place => JSON.parse(execFileSync(wbExe, ['note', 'list', place], { env }).toString());
  await nbItem('zeal in more than one place').click();
  const firstAt = await ed.locator('.nb-chips .place-off .place-pill').first().textContent();
  await ed.locator('.nb-chips .place-off .member-x').first().click();
  await page.waitForFunction(() => { const e = document.querySelector('.pane-notebook .nb-editor .nb-chips'); return e && e.querySelectorAll('.place-off').length === 1 && e.querySelector('.place-off').textContent.includes('Psalms 106:30'); }, null, { timeout: 10000 });
  const nowAt = notesAt('Psalms 106').find(n => n.text === 'zeal in more than one place');
  check('Take off on a note’s first place: the next becomes its place', nowAt?.anchor === 'PSA.106:30' && !notesAt('Numbers 25').some(n => n.text === 'zeal in more than one place'), `${firstAt} → ${nowAt?.anchor}`);
  await nbBack();
  await page.evaluate(() => window.__wb.run('note a place to take off @Num 25:2'));
  await nbItem('a place to take off').click();
  await ed.locator('.nb-chips .place-off .member-x').click();
  await page.waitForFunction(() => document.querySelector('.pane-notebook .nb-editor .nb-chips')?.textContent.includes('No place yet'), null, { timeout: 10000 });
  const inInbox = JSON.parse(execFileSync(wbExe, ['inbox'], { env }).toString()).notes.find(n => n.text === 'a place to take off');
  check('Take off on a note’s last place sends it to the Inbox', !!inInbox && existsSync(path.join(study, 'notes', '_inbox', `${inInbox.id}.md`)));
  await page.screenshot({ path: shots + '1440-take-off-a-place.png' });

  // Erase now in the Trash, asked first (note e48c, the person's decision of 2026-11-04)
  page.once('dialog', d => d.accept());
  await ed.locator('.nb-ed-head .icon-btn').click();
  await page.locator('.menu .menu-item', { hasText: 'Delete' }).click();
  await sleep(500);
  await nbBack();
  await openTrash();
  const doomed = page.locator('.pane-notebook .nb-entry.trashed', { hasText: 'a place to take off' }).first();
  await doomed.waitFor({ timeout: 10000 });
  const inTrash = () => JSON.parse(execFileSync(wbExe, ['trash'], { env }).toString()).notes.filter(n => n.text === 'a place to take off');
  const trashName = inTrash()[0]?.name;
  page.once('dialog', d => d.dismiss());
  await doomed.getByRole('button', { name: 'Erase now' }).click();
  await sleep(600);
  check('Erase now asks first; Cancel keeps the note in the Trash', inTrash().length === 1);
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.accept(); });
  await doomed.getByRole('button', { name: 'Erase now' }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll('.pane-notebook .nb-entry.trashed')].some(e => e.textContent.includes('a place to take off')), null, { timeout: 10000 });
  check('Erase now, confirmed, erases it from .trash', inTrash().length === 0 && !!trashName && !existsSync(path.join(study, '.trash', trashName)), asked);
  await page.locator('.pane-notebook .nb-back.shown').click();

  // phase 2b tier 2: the Notebook grouped (N2, N3), places on chapters and books (N1), links (N1), today's page (N2),
  // the format bar (B1), its settings (N4), the list and the editor side by side
  const group = async g => { await page.locator('.pane-notebook .nb-group button', { hasText: g }).click(); await sleep(500); };
  await page.evaluate(() => window.__wb.open('NUM', 25, 1));
  await sleep(400);
  await group('Chapter');
  const ghead = () => page.locator('.pane-notebook .nb-ghead').first().textContent();
  check('grouped by chapter, the list shows the chapter being read', /Numbers 25 · following the reader/i.test(await ghead()), await ghead());
  await page.evaluate(() => window.__wb.open('NUM', 26, 1));
  await page.waitForFunction(() => /Numbers 26/i.test(document.querySelector('.pane-notebook .nb-ghead')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  check('it turns with the reader', /Numbers 26/i.test(await ghead()), await ghead());
  await page.evaluate(() => window.__wb.open('NUM', 25, 1));
  await page.waitForFunction(() => /Numbers 25/i.test(document.querySelector('.pane-notebook .nb-ghead')?.textContent || ''), null, { timeout: 10000 });
  await page.locator('.pane-notebook .nb-new').click();
  await typing();
  await page.keyboard.type('Numbers 25, read again\nRead the chapter twice. See [[zeal in more than one place]] and [[No such note]].');
  await done();
  await ed.locator('.nb-add', { hasText: '+ Place' }).click();
  await page.locator('.place-menu .place-opt', { hasText: 'the whole chapter' }).click();
  await page.waitForFunction(() => document.querySelector('.pane-notebook .nb-editor .nb-chips')?.textContent.includes('Numbers 25'), null, { timeout: 10000 });
  const chNote = notesAt('Numbers 25').find(n => n.text.startsWith('Numbers 25, read again'));
  check('+ Place puts a note on the whole chapter: the run of its verses', chNote?.anchor === 'NUM.25:1-25:18', chNote?.anchor);
  check('the reader marks a chapter’s note by its title, not on every verse', await page.locator('#reader .ch-title.wide-note').count() === 1 && await page.locator('#reader .vn.vnote[data-v="5"]').count() === 0);
  await nbBack();
  const firstItem = await page.locator('.pane-notebook .nb-scroll .nb-item').first().textContent();
  check('a chapter’s note comes first under its chapter', firstItem.startsWith('Numbers 25, read again'), firstItem);
  await nbItem('Numbers 25, read again').click();
  check('a [[link]] to a note with no such title is shown as missing', await ed.locator('.nb-page a.nb-link.missing', { hasText: 'No such note' }).count() === 1);
  await ed.locator('.nb-page a.nb-link', { hasText: 'zeal in more than one place' }).click();
  await ed.locator('.nb-title', { hasText: 'zeal in more than one place' }).waitFor({ timeout: 10000 });
  check('a [[link]] opens the note it names', true);
  check('the note shows Linked from', (await ed.locator('.nb-linked').textContent()).includes('Numbers 25, read again'));
  await page.screenshot({ path: shots + '1440-notebook-linked-from.png' });
  // today's page: first under Day, made when first written in
  await nbBack();
  await group('Day');
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const dayFile = path.join(study, 'notes', '_days', `${today}.md`);
  check('grouped by day, today’s page is first, not written yet', (await page.locator('.pane-notebook .nb-scroll .nb-item').first().textContent()).includes('Not written in yet') && !existsSync(dayFile));
  await page.locator('.pane-notebook .nb-scroll .nb-item').first().click();
  await typing();
  // W0, finding ad58: [[ lists every note (not 8), grouped and recent first, in a list that scrolls, beside the cursor;
  // the arrow keys move in it, Esc closes it and leaves the writing, Enter writes the link
  await page.keyboard.type('Read Numbers 25 twice. Wrote up [[');
  await page.locator('.nb-suggest .nb-suggest-row').first().waitFor({ timeout: 5000 });
  const linkable = JSON.parse(execFileSync(wbExe, ['notebook', '--group', 'none'], { env }).toString()).groups.flatMap(g => g.entries).filter(e => e.title && !(e.kind === 'day' && e.exists === false)).length;
  const pick = await page.evaluate(() => {
    const l = document.querySelector('.nb-suggest-list'), caret = document.querySelector('.pane-notebook textarea.nb-input').getBoundingClientRect(), m = document.querySelector('.menu:has(.nb-suggest)').getBoundingClientRect();
    return { rows: l.querySelectorAll('.nb-suggest-row').length, groups: [...l.querySelectorAll('.nb-suggest-group')].map(g => g.textContent), scrolls: l.scrollHeight > l.clientHeight, on: [...l.querySelectorAll('.nb-suggest-row')].findIndex(r => r.classList.contains('on')), inside: m.top >= caret.top - m.height - 12 };
  });
  check('[[ lists every note to link to, not 8, grouped with Recent first (finding ad58)', pick.rows === linkable && linkable > 8 && pick.groups[0] === 'Recent', `${pick.rows} of ${linkable}; ${pick.groups.join(', ')}`);
  check('the list scrolls, and its first row is picked', pick.scrolls && pick.on === 0, JSON.stringify(pick));
  await page.screenshot({ path: shots + '1440-notebook-link-picker.png' });
  await page.keyboard.press('ArrowDown');
  check('↓ picks the next row and leaves the writing alone', await page.evaluate(() => [...document.querySelectorAll('.nb-suggest-row')].findIndex(r => r.classList.contains('on'))) === 1 && (await page.locator('.pane-notebook textarea.nb-input').inputValue()).endsWith('[['));
  await page.keyboard.press('Escape');
  check('Esc closes the list and keeps on writing', await page.locator('.nb-suggest').count() === 0 && await typing());
  await page.keyboard.type('Numbers 25, read');
  await page.locator('.nb-suggest .nb-suggest-row.on', { hasText: 'Numbers 25, read again' }).waitFor({ timeout: 5000 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('.');
  check('Enter writes the picked note’s whole title and closes the link', (await page.locator('.pane-notebook textarea.nb-input').inputValue()).endsWith('Wrote up [[Numbers 25, read again]].'), await page.locator('.pane-notebook textarea.nb-input').inputValue());
  await page.keyboard.press('Control+a');
  await page.locator('.pane-notebook .nb-fmt', { hasText: '•' }).click();
  await done();
  check('writing in today’s page makes notes/_days/<today>.md, with no place', existsSync(dayFile) && !/anchor/.test(readFileSync(dayFile, 'utf8')));
  check('the format bar writes Markdown as plain text', /\n\n- Read Numbers 25 twice/.test(readFileSync(dayFile, 'utf8')) && await ed.locator('.nb-page li').count() === 1, readFileSync(dayFile, 'utf8').split('---').pop().trim());
  check('the Python app passes over it: no anchor, so no note list or Inbox shows it', !notesAt('Numbers 25').some(n => n.text.includes('Wrote up')) && !JSON.parse(execFileSync(wbExe, ['inbox'], { env }).toString()).notes.some(n => n.text.includes('Wrote up')));
  await page.screenshot({ path: shots + '1440-notebook-today-s-page.png' });
  await nbBack();
  // W0, findings 7bc8 and 929e: a day's heading says its date plainly with its count beside it; a heading folds its
  // notes away, and stays folded when the list is drawn again
  const dayHead = page.locator('.pane-notebook .nb-ghead').first();
  await dayHead.locator('.nb-count').waitFor({ state: 'visible', timeout: 10000 });
  await sleep(400);
  const dh = await dayHead.locator('.nb-glabel').textContent();
  const dayBox = await dayHead.locator('.nb-glabel').boundingBox(), countBox = await dayHead.locator('.nb-count').boundingBox();
  check('a day’s heading reads “Today · Saturday, November 7”, its count right beside it (finding 7bc8)', /^Today · [A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2}$/.test(dh) && countBox.x - (dayBox.x + dayBox.width) < 16, `${dh}; gap ${Math.round(countBox.x - (dayBox.x + dayBox.width))}px`);
  const nbListed = () => page.locator('.pane-notebook .nb-scroll .nb-item').count();
  const openN = await nbListed();
  await dayHead.click();
  await sleep(500);
  const shutN = await nbListed();
  await group('Chapter');
  await group('Day');
  const stillShut = await nbListed() === shutN && await page.locator('.pane-notebook .nb-ghead').first().getAttribute('aria-expanded') === 'false';
  await page.screenshot({ path: shots + '1440-notebook-folded.png' });
  await page.locator('.pane-notebook .nb-ghead').first().click();
  await sleep(500);
  check('a heading folds its notes away and stays folded; a click opens them again (finding 929e)', shutN < openN && stillShut && await nbListed() === openN, `${openN} → ${shutN} → ${await nbListed()}`);
  // settings: the Inbox as its own group, kept in settings/notebook.json
  await page.locator('.pane-notebook .nb-more').click();
  await page.locator('.menu .menu-item', { hasText: 'Notebook settings' }).click();
  await page.locator('.nb-set-row', { hasText: 'Show the Inbox as its own group' }).locator('input.switch').click();
  await sleep(700);
  check('Settings → the Inbox as its own group', (await ghead()).startsWith('Inbox') && JSON.parse(readFileSync(path.join(study, 'settings', 'notebook.json'), 'utf8')).inbox === true, await ghead());
  await page.screenshot({ path: shots + '1440-notebook-settings.png' });
  await page.locator('.nb-set-row', { hasText: 'Show the Inbox as its own group' }).locator('input.switch').click();
  await page.keyboard.press('Escape');
  await sleep(500);
  // the column expanded to half the window: the list and the editor side by side (B1)
  await nbItem('Numbers 25, read again').click();
  await page.evaluate(() => { const d = window.__wb.dock(); d.wide.right = true; d.layout(); });
  await sleep(600);
  check('a wide Notebook shows the list and the editor side by side', await page.locator('.pane-notebook .nb.two').count() === 1 && await page.locator('.pane-notebook .nb-list').isVisible() && await ed.isVisible());
  await page.screenshot({ path: shots + '1440-notebook-list-and-editor.png' });
  await page.evaluate(() => { const d = window.__wb.dock(); d.wide.right = false; d.layout(); });
  await sleep(300);
  await nbBack();

  // reading plans (tier 3): the form with presets and the books grid, the plan in its pane (today's card, days, a day moved),
  // days that were missed and what each choice does, stopped plans in Past plans, used again, deleted
  await page.evaluate(() => window.__wb.run('plans'));
  await page.waitForSelector('.pane-plans .plan-bar-row', { timeout: 10000 });
  check('plans opens the Reading plans pane', true);
  check('no terminal words in the plans pane', !/--\w/.test(await page.locator('.pane-plans').innerText()));
  await page.locator('.pane-plans').getByRole('button', { name: 'New plan' }).click();
  const dlg = page.locator('.plan-modal');
  await dlg.waitFor({ timeout: 5000 });
  check('the form says only a name and what to read are needed', (await dlg.innerText()).includes('Only a name and what to read are needed.') && !/--\w/.test(await dlg.innerText()));
  check('Start the plan waits for a name and what to read', await dlg.getByRole('button', { name: 'Start the plan' }).isDisabled());
  await page.screenshot({ path: shots + '1440-plan-form-blank.png' });
  // a preset fills the boxes, and the summary says what it is before it starts
  await dlg.getByRole('button', { name: 'New Testament in 90 days' }).click();
  await page.waitForFunction(() => /27 books/.test(document.querySelector('.plan-summary-line')?.textContent || ''), null, { timeout: 10000 });
  check('a preset fills the name, what to read and the pace', await dlg.getByLabel('Name').inputValue() === 'New Testament in 90 days' && (await dlg.locator('.plan-what').innerText()).includes('New Testament · 27 books') && await dlg.getByLabel('Number').inputValue() === '90');
  check('the summary says books, readings and days', /27 books · 260 readings · 90 days/.test(await dlg.locator('.plan-summary-line').innerText()), await dlg.locator('.plan-summary').innerText());
  await page.screenshot({ path: shots + '1440-plan-form-preset.png' });
  // Blank, then the books grid: Gospels and Romans, ticked together
  await dlg.getByRole('button', { name: 'Blank' }).click();
  await dlg.getByLabel('Name').fill('Gospels and Romans');
  await dlg.getByRole('button', { name: '+ Books…' }).click();
  await dlg.getByRole('button', { name: 'Gospels', exact: true }).click();
  await dlg.locator('button[data-code="ROM"]').click();
  check('the grid counts what is ticked', (await dlg.locator('.plan-modal-head').innerText()).includes('5 ticked · 105 chapters'), await dlg.locator('.plan-modal-head').innerText());
  await page.screenshot({ path: shots + '1440-plan-books-grid.png' });
  await dlg.getByRole('button', { name: 'Done' }).click();
  check('Done puts the books in the form as a chip', (await dlg.locator('.plan-what').innerText()).includes('5 books') || (await dlg.locator('.plan-what').innerText()).includes('Matthew'), await dlg.locator('.plan-what').innerText());
  await dlg.getByLabel('Number').fill('30');
  await dlg.getByRole('button', { name: 'Sun', exact: true }).click();
  await page.waitForFunction(() => /30 days/.test(document.querySelector('.plan-summary-line')?.textContent || ''), null, { timeout: 10000 });
  check('the summary follows the form: 5 books, 105 readings, 30 days', /5 books · 105 readings · 30 days/.test(await dlg.locator('.plan-summary-line').innerText()), await dlg.locator('.plan-summary-line').innerText());
  await dlg.getByLabel('Pace').selectOption('own');
  await page.waitForFunction(() => /no dates/.test(document.querySelector('.plan-summary-line')?.textContent || ''), null, { timeout: 10000 });
  check('my own pace has no dates', !(await dlg.getByLabel('Number').count()) && /no dates/.test(await dlg.locator('.plan-summary-line').innerText()));
  await dlg.getByLabel('Pace').selectOption('days');
  await dlg.getByLabel('Number').fill('30');
  await page.waitForFunction(() => /30 days/.test(document.querySelector('.plan-summary-line')?.textContent || ''), null, { timeout: 10000 });
  await dlg.getByRole('button', { name: 'Start the plan' }).click();
  const card = page.locator('.pane-plans .plan-card[data-plan="gospels-and-romans"]');
  await card.waitFor({ timeout: 10000 });
  const planFile = path.join(study, 'reading', 'plans', 'gospels-and-romans.json');
  const planJson = JSON.parse(readFileSync(planFile, 'utf8'));
  check('Start writes the plan: 30 days, Romans in it, Sunday off', existsSync(planFile) && planJson.days.length === 30 && JSON.stringify(planJson.days).includes('"ROM.16"') && JSON.stringify(planJson.days_off) === '["sun"]', `${planJson.days.length} days, off ${planJson.days_off}`);
  check('the form is closed', await page.locator('.plan-modal').count() === 0);
  // the plan in its pane: a progress bar, today's reading with Read and Mark read, the days with a grip
  check('the card has a progress bar and today’s reading', await card.locator('.plan-bar').isVisible() && (await card.locator('.plan-today-label').innerText()).toLowerCase() === 'today' && await card.getByRole('button', { name: 'Read', exact: true }).isVisible());
  check('the days are listed, 30 of them, each with a grip', await card.locator('.plan-days .plan-row').count() === 30 && await card.locator('.plan-days .plan-row .grip').count() === 30);
  await page.screenshot({ path: shots + '1440-plan-in-its-pane.png' });
  await card.getByRole('button', { name: 'Mark read' }).first().click();
  await page.waitForFunction(() => /1 read|ahead/.test(document.querySelector('.pane-plans .plan-card[data-plan="gospels-and-romans"] .plan-where')?.textContent || ''), null, { timeout: 10000 });
  const logged = readFileSync(path.join(study, 'reading', 'log.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(l => l.plan === 'gospels-and-romans');
  check('Mark read writes the day to the reading log', logged.length > 0 && logged[0].ch === 'MAT.1', logged.map(l => l.ch).join(' '));
  check('a change keeps the days open', await card.locator('.plan-days .plan-row').first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.evaluate(() => { document.querySelector('.pane-plans .plan-card').dataset.drawn = 'before'; });
  await page.evaluate(() => window.__wb.run('note Days stay open @Num 25:1'));
  await sleep(800);
  check('writing a note leaves the plans pane as it was', await page.evaluate(() => document.querySelector('.pane-plans .plan-card')?.dataset.drawn === 'before') && await card.locator('.plan-days .plan-row').first().isVisible());
  // a day is dragged to another place: its readings go with it, the dates stay
  const first = (n) => card.locator(`.plan-row[data-day="${n}"] .ref-link`).innerText();
  const [d4, d6] = [await first(4), await first(6)];
  const dates = await card.locator('.plan-row .plan-tag').allInnerTexts();
  await card.locator('.plan-row[data-day="4"]').dragTo(card.locator('.plan-row[data-day="6"]'));
  await page.waitForFunction(old => document.querySelector('.pane-plans .plan-card[data-plan="gospels-and-romans"] .plan-row[data-day="6"] .ref-link')?.textContent === old, d4, { timeout: 10000 });
  check('dragging a day moves its readings to the new place', await first(6) === d4 && await first(4) !== d4, `${d4} → day 6; day 4 is now ${await first(4)}`);
  const movedFile = JSON.parse(readFileSync(planFile, 'utf8'));
  check('the plan file keeps the days in the new order and the old file is in .trash', movedFile.days.length === 30 && readdirSync(path.join(study, '.trash')).some(f => f.includes('-plan-gospels-and-romans')));
  void d6; void dates;
  // days that were missed: start another plan on a day long past and ask
  execFileSync(wbExe, ['plan', 'start', 'Late', '--books', 'gospels', '--days', '10', '--start', new Date(Date.now() - 4 * 86400000).toLocaleDateString('en-CA')], { env });
  await page.evaluate(() => window.__wb.dock().panes.filter(p => p.kind === 'plans').forEach(p => p.refresh?.()));
  const late = page.locator('.pane-plans .plan-card[data-plan="late"]');
  await late.waitFor({ timeout: 10000 });
  check('days not read are said, with a way to choose', (await late.locator('.plan-missed').innerText()).includes('4 days were not read'), await late.locator('.plan-missed').innerText());
  await late.getByRole('button', { name: 'What should happen?' }).click();
  await late.locator('.plan-choices').waitFor({ timeout: 10000 });
  const choices = await late.locator('.plan-choice').allInnerTexts();
  check('four choices, each saying what it does to the dates', choices.length === 4 && choices.every(c => /\b20\d\d\b/.test(c) || /No date moves/.test(c)) && /Pick up where I left off/.test(choices[0]) && /Skip them/.test(choices[3]), choices.map(c => c.replace(/\n/g, ' ').slice(0, 90)).join(' | '));
  check('asking changes nothing', JSON.parse(readFileSync(path.join(study, 'reading', 'plans', 'late.json'), 'utf8')).days.length === 10 && !JSON.parse(readFileSync(path.join(study, 'reading', 'plans', 'late.json'), 'utf8')).skipped);
  await page.screenshot({ path: shots + '1440-plan-days-missed.png' });
  await late.locator('.plan-choice').nth(3).click(); // skip them
  await late.getByRole('button', { name: 'Do it' }).click();
  await page.waitForFunction(() => !document.querySelector('.pane-plans .plan-card[data-plan="late"] .plan-missed'), null, { timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll('.pane-plans .plan-card[data-plan="late"] .plan-row.skipped').length === 4, null, { timeout: 10000 }); // the days are drawn after the card
  check('Skip: marked skipped, not read; nothing is missed now', JSON.parse(readFileSync(path.join(study, 'reading', 'plans', 'late.json'), 'utf8')).skipped?.length === 4 && await late.locator('.plan-row.skipped').count() === 4);
  // stop: it leaves the list and waits in Past plans, to use again or delete
  await late.getByRole('button', { name: 'Stop' }).click();
  await page.waitForFunction(() => !document.querySelector('.pane-plans .plan-card[data-plan="late"]'), null, { timeout: 10000 });
  check('Stop keeps the plan’s file, stopped, and nothing goes to .trash', JSON.parse(readFileSync(path.join(study, 'reading', 'plans', 'late.json'), 'utf8')).stopped?.length === 10);
  await page.locator('.pane-plans [data-act="past"]').click();
  const pastRow = page.locator('.pane-plans .plan-past-row[data-plan="late"]');
  await pastRow.waitFor({ timeout: 5000 });
  check('Past plans lists it, stopped, with how far it got', (await pastRow.innerText()).includes('Stopped'), await pastRow.innerText());
  await page.screenshot({ path: shots + '1440-plan-past-plans.png' });
  await pastRow.getByRole('button', { name: 'Use again…' }).click();
  await page.locator('.menu .ask').getByRole('button', { name: 'OK' }).click();
  await page.locator('.pane-plans .plan-card[data-plan="late-again"]').waitFor({ timeout: 10000 });
  check('Use again makes a new plan from it, nothing read', JSON.parse(readFileSync(path.join(study, 'reading', 'plans', 'late-again.json'), 'utf8')).days.length === 10 && !JSON.parse(readFileSync(path.join(study, 'reading', 'plans', 'late-again.json'), 'utf8')).skipped);
  await pastRow.getByRole('button', { name: 'Delete' }).click();
  await page.locator('.menu .ask').getByRole('button', { name: 'Delete' }).click();
  await page.waitForFunction(() => !document.querySelector('.pane-plans .plan-past-row[data-plan="late"]'), null, { timeout: 10000 });
  check('Delete sends the plan to .trash; what was read stays in the log', !existsSync(path.join(study, 'reading', 'plans', 'late.json')) && readdirSync(path.join(study, '.trash')).some(f => f.endsWith('-plan-late.json')));
  // edit as text still works
  await card.getByRole('button', { name: 'Edit as text…' }).click();
  await page.locator('.menu .ask textarea').waitFor({ timeout: 5000 });
  const asText = execFileSync(wbExe, ['plan', 'text', 'gospels and romans'], { env }).toString().trim();
  check('Edit as text shows the plan one day to a line', (await page.locator('.menu .ask textarea').inputValue()).trim() === asText, asText.split('\n')[0]);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'plans')) d.close(p); });

  // the builder (R2): from the form, the days as rows of chapters; a chapter and a day dragged; a new pace keeps the days set by hand;
  // back to the form keeps what it holds. Then the published plans: Guthrie's, Blue Letter Bible's, Horner's lists.
  await page.evaluate(() => window.__wb.run('plans'));
  await page.waitForSelector('.pane-plans .plan-bar-row', { timeout: 10000 });
  await page.locator('.pane-plans').getByRole('button', { name: 'New plan' }).click();
  const f2 = page.locator('.plan-modal');
  await f2.waitFor({ timeout: 5000 });
  check('Arrange the days myself… waits for something to read', await f2.getByRole('button', { name: 'Arrange the days myself…' }).isDisabled());
  await f2.getByLabel('Name').fill('By hand');
  await f2.getByRole('button', { name: '+ Books…' }).click();
  await f2.getByRole('button', { name: 'Gospels', exact: true }).click();
  await f2.getByRole('button', { name: 'Done' }).click();
  await f2.getByLabel('Number').fill('20');
  await page.waitForFunction(() => /20 days/.test(document.querySelector('.plan-summary-line')?.textContent || ''), null, { timeout: 10000 });
  await f2.getByRole('button', { name: 'Arrange the days myself…' }).click();
  await page.waitForSelector('.plan-bday', { timeout: 10000 });
  check('the builder shows 20 days of chapters, each chapter a chip', await page.locator('.plan-bday').count() === 20 && await page.locator('.plan-bday .plan-bchip').count() === 89, `${await page.locator('.plan-bday').count()} days`);
  check('the builder carries the form’s name and pace', await f2.getByLabel('Name').inputValue() === 'By hand' && await f2.getByLabel('Pace').inputValue() === 'days' && await f2.getByLabel('Number').inputValue() === '20');
  check('the books in the plan are listed with their chapters', (await f2.locator('.plan-build-books').innerText()).includes('Matthew') && (await f2.locator('.plan-build-books').innerText()).includes('28 ch'));
  check('no day is kept yet', await f2.locator('.plan-bday.kept').count() === 0);
  await page.screenshot({ path: shots + '1440-plan-builder.png' });
  const chipTexts = (n) => page.locator(`.plan-bday[data-day="${n}"] .plan-bchip`).allInnerTexts();
  const d1 = await chipTexts(1), d2 = await chipTexts(2), d5 = await chipTexts(5);
  // a chapter dragged to another day: it leaves the first and joins the second; both are kept as set
  const moved = d1[d1.length - 1];
  await page.locator('.plan-bday[data-day="1"] .plan-bchip').last().dragTo(page.locator('.plan-bday[data-day="2"]'));
  await page.waitForFunction(n => document.querySelectorAll('.plan-bday.kept').length === n, 2, { timeout: 5000 });
  const n1 = await chipTexts(1), n2 = await chipTexts(2);
  check('a chapter dragged to another day moves there', n1.length === d1.length - 1 && n2.length === d2.length + 1 && n2[n2.length - 1] === moved, `${moved} → day 2`);
  check('both days are kept as set', (await page.locator('.plan-bday[data-day="1"] .plan-bkept').innerText()).includes('kept as you set it') && (await page.locator('.plan-bday[data-day="2"] .plan-bkept').innerText()).includes('kept as you set it'));
  // a day dragged up
  await page.locator('.plan-bday[data-day="5"] .grip').dragTo(page.locator('.plan-bday[data-day="3"]'));
  await page.waitForFunction(n => document.querySelectorAll('.plan-bday.kept').length === n, 3, { timeout: 5000 });
  check('a day dragged up takes the place of the one it is dropped on', (await chipTexts(3)).join() === d5.join(), `${d5[0]} is day 3`);
  check('the total is still 89 chapters', await page.locator('.plan-bday .plan-bchip').count() === 89);
  // a place added to a day
  await page.locator('.plan-bday[data-day="2"] .nb-add').click();
  await page.locator('.menu .ask input').fill('Psalm 23');
  await page.locator('.menu .ask').getByRole('button', { name: 'OK' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.plan-bday[data-day="2"] .plan-bchip')].some(c => c.textContent.includes('Psalms 23')), null, { timeout: 5000 });
  check('a place typed joins the day', await page.locator('.plan-bday .plan-bchip').count() === 90);
  // the first day is let go: it is laid out again with the rest by the next pace; the kept days are not
  await page.locator('.plan-bday[data-day="1"] .plan-bkept').getByRole('button', { name: 'kept as you set it' }).click();
  check('a day can be let go of', await page.locator('.plan-bday.kept').count() === 2);
  const keptBefore = [(await chipTexts(2)).join(), (await chipTexts(3)).join()];
  await f2.getByLabel('Pace').selectOption('chapters');
  await page.waitForFunction(() => document.querySelectorAll('.plan-bday').length !== 20, null, { timeout: 10000 });
  await f2.getByLabel('Number').fill('10');
  await f2.getByLabel('Number').press('Tab');
  await page.waitForFunction(() => document.querySelectorAll('.plan-bday').length > 7 && document.querySelectorAll('.plan-bday').length < 12, null, { timeout: 10000 });
  const rowsNow = await page.locator('.plan-bday').count();
  check('a new pace lays out the days again', rowsNow >= 8 && rowsNow <= 11, `${rowsNow} days at 10 a day`);
  const keptNow = await page.locator('.plan-bday.kept').evaluateAll(els => els.map(e => [e.dataset.day, [...e.querySelectorAll('.plan-bchip')].map(c => c.textContent).join()]));
  check('the days set by hand stay as they were', keptNow.length === 2 && keptBefore.every(t => keptNow.some(k => k[1] === t)), JSON.stringify(keptNow.map(k => k[0])));
  const every = await page.locator('.plan-bday .plan-bchip').evaluateAll(els => els.map(e => e.dataset.entry));
  check('every chapter is in exactly one day', every.length === 90 && new Set(every).size === 90);
  await page.screenshot({ path: shots + '1440-plan-builder-pace.png' });
  // back to the form: it still holds the name, the books and the pace, and says the days are arranged
  await f2.getByRole('button', { name: 'Back to the form' }).click();
  await f2.getByLabel('Name').waitFor({ timeout: 5000 });
  check('back to the form keeps what it holds', await f2.getByLabel('Name').inputValue() === 'By hand' && await f2.getByLabel('Pace').inputValue() === 'chapters' && await f2.getByLabel('Number').inputValue() === '10' && (await f2.locator('.plan-what').innerText()).includes('Gospels'));
  check('the form says the days are arranged by hand', (await f2.locator('.plan-arrange').innerText()).includes('arranged by hand') && (await f2.locator('.plan-arrange').innerText()).includes('2 kept'), await f2.locator('.plan-arrange').innerText());
  await page.screenshot({ path: shots + '1440-plan-form-arranged.png' });
  await f2.getByRole('button', { name: 'Edit the days…' }).click();
  await page.waitForSelector('.plan-bday', { timeout: 10000 });
  check('the builder comes back with the days as they were', await page.locator('.plan-bday').count() === rowsNow && await page.locator('.plan-bday.kept').count() === 2);
  await f2.getByRole('button', { name: 'Start the plan' }).click();
  const byHand = path.join(study, 'reading', 'plans', 'by-hand.json');
  await page.locator('.pane-plans .plan-card[data-plan="by-hand"]').waitFor({ timeout: 10000 });
  const bh = JSON.parse(readFileSync(byHand, 'utf8'));
  check('Start writes the days exactly as arranged, with which were kept', bh.days.length === rowsNow && bh.days.flat().length === 90 && bh.kept?.length === 2 && bh.pace === 'chapters:10', `${bh.days.length} days, kept ${bh.kept}`);
  check('the plan shows a place that was added', JSON.stringify(bh.days).includes('PSA.23'));

  // Guthrie's: Week N / Day N, pasted; what was found is said first, Sunday is the day off
  const publish = async (name, format, text) => {
    await page.locator('.pane-plans').getByRole('button', { name: 'New plan' }).click();
    const f = page.locator('.plan-modal');
    await f.waitFor({ timeout: 5000 });
    await f.getByRole('button', { name: 'A published plan…' }).click();
    await f.getByLabel('Name').fill(name);
    if (format) await f.getByLabel('Which plan is it').selectOption(format);
    await f.getByLabel('The plan, as you have it').fill(text);
    return f;
  };
  const found = (re) => page.waitForFunction(r => new RegExp(r).test(document.querySelector('.plan-modal .plan-summary-line')?.textContent || ''), re.source, { timeout: 10000 });
  const fg = await publish('Guthrie sample', '', 'Week 1\nDay 1: Genesis 1-2; Matthew 1\nDay 2: Genesis 3\nDay 3\nExodus 1\nDay 7: Rest\n\nWeek 2\nDay 1: Genesis 4\n');
  check('a published plan says none comes with the app', (await fg.innerText()).includes('None comes with the app'));
  await found(/Guthrie’s plan · 2 weeks · 4 days/);
  check('Guthrie’s is found from the text; Sunday is its day off', await fg.getByRole('button', { name: 'Sun', exact: true }).getAttribute('aria-pressed') === 'true', await fg.locator('.plan-summary').innerText());
  await page.screenshot({ path: shots + '1440-plan-published.png' });
  await fg.getByRole('button', { name: 'Start the plan' }).click();
  const gcard = page.locator('.pane-plans .plan-card[data-plan="guthrie-sample"]');
  await gcard.waitFor({ timeout: 10000 });
  const gf = JSON.parse(readFileSync(path.join(study, 'reading', 'plans', 'guthrie-sample.json'), 'utf8'));
  check('the plan file keeps the source’s name and the day off', gf.source === 'Guthrie' && JSON.stringify(gf.days_off) === '["sun"]' && gf.days.length === 4 && gf.kind === 'imported');
  check('the card says where it came from', (await gcard.locator('.plan-where').innerText()).includes('from Guthrie'), await gcard.locator('.plan-where').innerText());

  // Blue Letter Bible's: places joined by /, its short names
  const fb = await publish('Blb sample', 'blue-letter', 'Day 1: Gen 1 / Mat 1 / Phl 2\nJhn 3 / 1Co 13 / Jde 1\n');
  await found(/Blue Letter Bible’s list · 2 days/);
  check('Blue Letter Bible’s short names are read', (await fb.locator('.plan-summary').innerText()).includes('Genesis 1; Matthew 1; Philippians 2'), await fb.locator('.plan-summary').innerText());
  await fb.getByRole('button', { name: 'Back to the form' }).click();
  check('back from a published plan returns to the form', await f2.getByLabel('Pace').count() === 1);
  await page.keyboard.press('Escape');

  // Horner's lists: a plan with no end date
  const fh = await publish('Horner sample', 'auto', 'List 1: Matthew, Mark\nList 2: Genesis, Exodus\nList 3: Jude, 3 John\n');
  await found(/Horner’s lists · 3 lists/);
  check('Horner’s lists say there is no end date', (await fh.locator('.plan-summary').innerText()).includes('No end date'), await fh.locator('.plan-summary').innerText());
  await fh.getByRole('button', { name: 'Start the plan' }).click();
  const hcard = page.locator('.pane-plans .plan-card[data-plan="horner-sample"]');
  await hcard.waitFor({ timeout: 10000 });
  const hf = JSON.parse(readFileSync(path.join(study, 'reading', 'plans', 'horner-sample.json'), 'utf8'));
  check('the plan file keeps its lists, and that it has no end', hf.cycle === true && hf.lists.length === 3 && hf.source === 'Horner' && hf.kind === 'horner');
  check('the card says it has no end date, and reads a chapter from each list', (await hcard.locator('.plan-where').innerText()).includes('no end date') && (await hcard.locator('.plan-today-title').innerText()).includes('Matthew 1; Genesis 1; Jude 1'), await hcard.locator('.plan-where').innerText());
  await page.screenshot({ path: shots + '1440-plan-no-end.png' });
  // a paste that cannot be read says so, and starts nothing
  const fx = await publish('Broken', 'guthrie', 'Week 1\nDay 1: Genesis 1\nDay 2: Nowhere 4\n');
  await page.waitForFunction(() => /Line 3/.test(document.querySelector('.plan-modal .plan-summary .bad')?.textContent || ''), null, { timeout: 10000 });
  check('a line that cannot be read is named', (await fx.locator('.plan-summary').innerText()).includes('Day 2') && await fx.getByRole('button', { name: 'Start the plan' }).isDisabled());
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'plans')) d.close(p); });

  const top = () => page.evaluate(() => {
    const sc = document.getElementById('scroller'), r = document.getElementById('reader');
    let v = 1;
    for (const e of r.querySelectorAll('.vn')) { if (r.offsetTop + e.offsetTop - 12 > sc.scrollTop + 2) break; v = +e.dataset.v; }
    return v;
  });
  // the reader in the YLT: verbatim, the same verse at the top, marks on whole verses only, no word selection; and back
  await page.evaluate(() => window.__wb.open('NUM', 25, 6));
  await sleep(400);
  const kjvTop = await top();
  const ylt11 = JSON.parse(execFileSync(wbExe, ['text', 'Num 25:11', '--version', 'ylt', '--json'], { env }).toString()).verses[0].text;
  const said2 = await page.evaluate(() => window.__wb.run('version ylt'));
  await page.waitForFunction(() => window.__wb.drawn?.chapter.version === 'YLT', null, { timeout: 10000 });
  await sleep(300);
  const shown11 = await page.evaluate(() => { const d = window.__wb.drawn; return d.text.filter((_, k) => d.v[k] === 11).join(' '); });
  check('version ylt draws the YLT, verbatim', shown11 === ylt11, said2);
  check('the version switch keeps the verse at the top', kjvTop === 6 && (await top()) === 6, `verse ${kjvTop} → ${await top()}`);
  check('the toolbar and the chapter say YLT', (await page.locator('#tb-version').textContent()) === 'YLT' && await page.locator('.ch-version').isVisible());
  const yr = JSON.parse(execFileSync(wbExe, ['reader', 'NUM', '25', '--version', 'ylt'], { env }).toString());
  check('wb reader --version ylt: the YLT with marks on whole verses only', yr.chapter.version === 'YLT' && [...yr.marks.highlights, ...yr.marks.threads, ...yr.marks.notes].every(m => m.kind === 'verse' || m.kind === 'verses'));
  const w11 = await page.evaluate(() => { const d = window.__wb.drawn, k = d.v.indexOf(11) + 2; d.el[k].scrollIntoView({ block: 'center' }); const r = d.el[k].getBoundingClientRect(), e = d.el[k + 3].getBoundingClientRect(); return [r.x + 3, r.y + r.height / 2, e.right - 3, e.y + e.height / 2]; });
  await page.mouse.move(w11[0], w11[1]); await page.mouse.down(); await page.mouse.move(w11[2], w11[3], { steps: 6 }); await page.mouse.up();
  await sleep(300);
  check('words cannot be selected in the YLT (no color bar)', await page.locator('.colorbar').count() === 0);
  await page.mouse.click(w11[0], w11[1]);
  check('a word in the YLT opens its verse, in the YLT', await page.locator('.popover', { hasText: ylt11 }).waitFor({ timeout: 5000 }).then(async () => (await page.locator('.popover .sheet-sub').textContent()) === 'YLT', () => false));
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__wb.run('version kjv'));
  await page.waitForFunction(() => window.__wb.drawn && !window.__wb.drawn.chapter.version, null, { timeout: 10000 });
  check('version kjv: back in the KJV, the choice kept', (await page.locator('#tb-version').textContent()) === 'KJV' && await page.evaluate(() => localStorage.getItem('wb.version')) === 'KJV');

  // the dock (phase 2b tier 1): each drop zone, named while dragging; floats each on their own; a pane reopens where it
  // was; a pane opened from a pane opens beside it. Every move keeps the verse at the top.
  {
    const dragHold = async (from, x, y, shift = false) => {
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      if (shift) await page.keyboard.down('Shift');
      for (let k = 1; k <= 10; k++) await page.mouse.move(from.x + (x - from.x) * k / 10, from.y + (y - from.y) * k / 10);
      await sleep(100);
      const label = await page.locator('.drop-label').textContent().catch(() => '');
      await page.mouse.up();
      if (shift) await page.keyboard.up('Shift');
      await sleep(400);
      return label;
    };
    const closeKind = kinds => page.evaluate(ks => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => ks.includes(p.kind))) d.close(p); }, kinds);
    const box = sel => page.locator(sel).first().boundingBox();
    await page.evaluate(() => window.__wb.open('NUM', 25, 6));
    await sleep(500);
    await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.side === 'left')) d.close(p); });
    await page.evaluate(() => window.__wb.run('interlinear Num 25:11'));
    await page.waitForSelector('.pane-interlinear .inter-card', { timeout: 10000 });
    check('a pane closed in the left column reopens there', await page.locator('.dock-left.open .pane-interlinear').count() === 1);
    const v0 = await top();
    let rd = await box('#scroller');
    let said = await dragHold(await tabAt('Interlinear'), rd.x + rd.width / 2, rd.y + 40);
    check('a tab over the reader’s top shows “Top band”', said === 'Top band', said);
    check('dropped there, the pane is a band across the top of the reader', await page.locator('.dock-top.open .pane-interlinear').count() === 1 && (await box('#scroller')).y > rd.y + 100);
    check('the top band keeps the verse at the top', (await top()) === v0, `verse ${v0} → ${await top()}`);
    await page.screenshot({ path: shots + '1440-dock-top-band.png' });
    rd = await box('#scroller');
    said = await dragHold(await tabAt('Interlinear'), rd.x + rd.width / 2, rd.y + rd.height - 30);
    check('a tab over the reader’s foot shows “Bottom band”', said === 'Bottom band', said);
    check('dropped there, the pane is a band across the bottom, the top band gone', await page.locator('.dock-bottom.open .pane-interlinear').count() === 1 && await page.locator('.dock-top.open').count() === 0);
    check('the bottom band keeps the verse at the top', (await top()) === v0, `verse ${v0} → ${await top()}`);
    said = await dragHold(await tabAt('Interlinear'), 60, 400);
    check('a tab at the left edge shows “Left column”', said === 'Left column', said);
    check('dropped there, it docks in the left column, the band gone', await page.locator('.dock-left.open .pane-interlinear').count() === 1 && await page.locator('.dock-bottom.open').count() === 0);
    check('the left column keeps the verse at the top', (await top()) === v0, `verse ${v0} → ${await top()}`);
    await page.evaluate(() => window.__wb.run('def H7065'));
    await page.waitForSelector('.dock-left .tab-name:text("H7065")', { timeout: 10000 });
    const lg = await box('.dock-left .dock-group');
    said = await dragHold(await tabAt('H7065'), lg.x + lg.width / 2, lg.y + lg.height * 0.8);
    check('a tab over a pane’s lower half shows “Split beside …”', said === 'Split beside Interlinear', said);
    check('dropped there, the column splits: two groups, each with its tabs', await page.locator('.dock-left .dock-group').count() === 2 && await page.locator('.dock-left .dock-group').nth(1).locator('.tab-name', { hasText: 'H7065' }).count() === 1);
    await page.screenshot({ path: shots + '1440-dock-split-column.png' });
    // one part of a split column minimized on its own: the other part, the other column and the bands stay (note 1b2d)
    await page.locator('.dock-left .dock-group').nth(1).locator('.strip-btn[aria-label="Minimize"]').click();
    await sleep(300);
    check('minimizing one part of a split column minimizes only that part (note 1b2d)', await page.locator('.dock-left.open .dock-group').count() === 1 && await page.locator('.dock-left .pane-interlinear:visible').count() === 1 && await page.locator('.dock-left .dock-restore-bar', { hasText: 'H7065' }).count() === 1 && await page.locator('.dock-right.open').count() === 1);
    await page.screenshot({ path: shots + '1440-dock-a-part-minimized.png' });
    await page.locator('.dock-left .dock-restore-bar').click();
    await sleep(300);
    check('its bar at the column’s foot shows it again', await page.locator('.dock-left .dock-group').count() === 2);
    // the line between the two parts, dragged: one part taller (note 523e)
    const parts = () => page.evaluate(() => [...document.querySelectorAll('.dock-left > .dock-group')].map(e => Math.round(e.getBoundingClientRect().height)));
    const [h0] = await parts();
    const sg = await box('.dock-left .split-grip');
    await page.mouse.move(sg.x + sg.width / 2, sg.y + sg.height / 2); await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(sg.x + sg.width / 2, sg.y + sg.height / 2 - 15 * k);
    await page.mouse.up(); await sleep(200);
    const [h1, h2] = await parts();
    check('dragging the line between a split column’s parts sets their heights (note 523e)', Math.abs(h1 - (h0 - 120)) <= 6, `${h0} → ${h1} px (the other ${h2})`);
    await page.locator('.dock-left .split-grip').dblclick();
    await sleep(200);
    const [h3, h4] = await parts();
    check('double-clicking the line gives the parts the same height again', Math.abs(h3 - h4) <= 2, `${h3} / ${h4}`);
    const rs = await box('.dock-right .tab-row');
    said = await dragHold(await tabAt('H7065'), rs.x + 30, rs.y + rs.height / 2);
    check('a tab over another strip shows “Beside …”', said.startsWith('Beside '), said);
    check('dropped there, it joins those tabs; the split closes', await page.locator('.dock-right .tab-name', { hasText: 'H7065' }).count() === 1 && await page.locator('.dock-left .dock-group').count() === 1);
    said = await dragHold(await tabAt('H7065'), 640, 420, true);
    check('Shift over the reader: split beside the pane it came from', said.startsWith('Split beside ') && await page.locator('.dock-right .dock-group').count() === 2, said);
    said = await dragHold(await tabAt('Interlinear'), 640, 360);
    check('a tab over the reader shows “Float”', said === 'Float', said);
    await dragHold(await tabAt('H7065'), 980, 620);
    check('two panes floated are two windows', await page.locator('.dock-float').count() === 2, `${await page.locator('.dock-float').count()}`);
    check('floating keeps the verse at the top', (await top()) === v0, `verse ${v0} → ${await top()}`);
    const fA = page.locator('.dock-float', { has: page.locator('.pane-interlinear') }), fB = page.locator('.dock-float', { has: page.locator('.pane-strong') });
    const a0 = await fA.boundingBox(), b0 = await fB.boundingBox();
    const row = await fA.locator('.tab-row').boundingBox();
    await page.mouse.move(row.x + row.width - 12, row.y + row.height / 2);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(row.x + row.width - 12 - 15 * k, row.y + row.height / 2 + 10 * k);
    await page.mouse.up();
    await sleep(200);
    const a1 = await fA.boundingBox(), b1 = await fB.boundingBox();
    check('a float moves by its strip on its own; the other stays', Math.abs(a1.x - (a0.x - 120)) <= 2 && Math.abs(a1.y - (a0.y + 80)) <= 2 && b1.x === b0.x && b1.y === b0.y, `(${a0.x},${a0.y}) → (${a1.x},${a1.y})`);
    await page.screenshot({ path: shots + '1440-dock-two-floats.png' });
    await fB.locator('.strip-btn[aria-label="Minimize"]').click();
    await sleep(200);
    check('a float minimized waits as a chip; the other stays open', await page.locator('.dock-chip', { hasText: 'H7065 · minimized' }).count() === 1 && await fA.isVisible());
    await page.locator('.dock-chip', { hasText: 'H7065' }).click();
    await sleep(200);
    const b2 = await fB.boundingBox();
    check('its chip shows it again where it was', !!b2 && b2.x === b0.x && b2.y === b0.y);
    const as = await fA.locator('.tab-row').boundingBox();
    said = await dragHold(await tabAt('H7065'), as.x + as.width - 20, as.y + as.height / 2);
    check('two floats join only when a tab is dropped on the other’s strip', said === 'Beside Interlinear' && await page.locator('.dock-float').count() === 1 && await fA.locator('.tab').count() === 2, said);
    const at = await fA.boundingBox();
    await closeKind(['interlinear']);
    await page.evaluate(() => window.__wb.run('interlinear Num 25:11'));
    await page.waitForSelector('.dock-float .pane-interlinear', { timeout: 10000 }).catch(() => {});
    const back = await page.locator('.dock-float', { has: page.locator('.pane-interlinear') }).boundingBox();
    check('a float closed reopens where it was, with the tabs it was with', !!back && back.x === at.x && back.y === at.y && await page.locator('.dock-float').count() === 1, back ? `(${back.x},${back.y})` : 'not floating');
    await closeKind(['interlinear', 'strong']);
    check('closing a float’s last tab closes the window', await page.locator('.dock-float').count() === 0);
    // D4: a pane opened from a pane opens beside it, wherever that pane was put (a pane already open only comes forward)
    await closeKind(['thread']);
    await page.evaluate(() => window.__wb.run('threads'));
    await page.waitForSelector('.pane-threads .thread-open', { timeout: 10000 });
    await dragHold(await tabAt('Threads'), 640, 400);
    await page.locator('.dock-float .pane-threads .thread-open').first().click();
    check('a thread opened from Threads in a float opens beside it, in that float', await page.locator('.dock-float .pane-thread').first().waitFor({ timeout: 10000 }).then(() => true, () => false));
    check('it says where it opened', await page.locator('.toast', { hasText: 'Opened beside Threads' }).first().waitFor({ timeout: 3000 }).then(() => true, () => false));
    await page.screenshot({ path: shots + '1440-dock-opened-beside.png' });
    await closeKind(['threads', 'thread']);
    check('the dock never moved the reader', (await top()) === v0, `verse ${v0} → ${await top()}`);
  }

  // ---- the findings of 2026-11-04 and 11-05 (docs/phase2-results.md section 16) ----
  {
    const label = () => page.locator('#place .place-label').textContent();
    const wordAt = v => page.evaluate(v => { const d = window.__wb.drawn, k = d.v.indexOf(v); d.el[k].scrollIntoView({ block: 'center' }); const r = d.el[k].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, v);
    await page.evaluate(() => window.__wb.open('NUM', 25, 10));
    await sleep(500);
    // 4b90: a click on a verse number selects the whole verse with the color bar; a color colors the verse; a click away clears
    await page.locator('#reader .vn[data-v="12"]').click();
    await page.waitForSelector('.colorbar.verse-bar', { timeout: 5000 });
    const v12 = await page.evaluate(() => { const d = window.__wb.drawn; return { words: d.v.filter(v => v === 12).length, sel: document.querySelectorAll('#reader .w.sel').length, vsel: !!document.querySelector('#reader .vn.vsel[data-v="12"]') }; });
    check('a click on a verse number selects the whole verse, with the color bar (note 4b90)', v12.sel === v12.words && v12.vsel, `${v12.sel} of ${v12.words} words`);
    check('the verse’s bar has the verse’s actions', (await page.locator('.colorbar .act').allTextContents()).join(',') === 'Note,Question,Thread,Copy,Notes & lookup,Open as a tab');
    await page.screenshot({ path: shots + '1440-a-verse-picked.png' });
    await page.keyboard.press('3');
    await sleep(800);
    check('a color on the verse’s bar colors the whole verse', JSON.parse(execFileSync(wbExe, ['anchor', 'Num 25:12'], { env }).toString()).highlight === 'blue');
    await page.locator('#reader .vn[data-v="13"]').click();
    await page.waitForSelector('.colorbar.verse-bar', { timeout: 5000 });
    await page.locator('.dock-right .pane:visible').first().click({ position: { x: 60, y: 8 } });
    await sleep(200);
    check('a click away clears the verse picked and its bar', await page.locator('.colorbar').count() === 0 && await page.locator('#reader .w.sel, #reader .vn.vsel').count() === 0);

    // 0cf1: right-click a verse: Open in a new tab (a second reader at it)
    let [x, y] = await wordAt(14);
    const at0 = await top();
    await page.mouse.click(x, y, { button: 'right' });
    check('right-click on a verse offers to open it in a new tab (note 0cf1)', await page.locator('.verse-menu .menu-item', { hasText: 'Open in a new tab' }).waitFor({ timeout: 5000 }).then(() => true, () => false));
    await page.locator('.verse-menu .menu-item', { hasText: 'Open in a new tab' }).click();
    const r2 = page.locator('.pane-reader2:visible').first();
    check('it opens a second reader at that verse; the reader stays', await r2.locator('.vn-asked[data-v="14"]').waitFor({ timeout: 10000 }).then(() => true, () => false) && (await top()) === at0, `verse ${at0} → ${await top()}`);
    // 9587: the second reader draws what the reader draws, and nothing in it moves the reader
    check('the second reader draws the highlights (note 9587)', await page.evaluate(() => [...document.querySelectorAll('.pane-reader2 .vn[data-v="12"]')].some(v => v.nextElementSibling?.classList.contains('hl'))));
    await r2.locator('.vn[data-v="15"]').click();
    await page.waitForSelector('.colorbar.verse-bar', { timeout: 5000 });
    check('a verse picked in the second reader has its own bar; the reader’s selection and place stay', await r2.locator('.w.sel').count() > 0 && await page.evaluate(() => !window.__wb.selector.sel) && (await top()) === at0);
    await page.screenshot({ path: shots + '1440-a-second-reader.png' });
    await page.keyboard.press('1');
    await sleep(900);
    const both = await page.evaluate(() => { const d = window.__wb.drawn; return [d.el[d.v.indexOf(15)].classList.contains('hl'), !!document.querySelector('.pane-reader2 .vn[data-v="15"]')?.nextElementSibling?.classList.contains('hl')]; });
    check('its bar colors the verse in the study folder, and both readers draw it', JSON.parse(execFileSync(wbExe, ['anchor', 'Num 25:15'], { env }).toString()).highlight === 'yellow' && both.every(Boolean), both.join());
    const wk = await r2.locator('.vn[data-v="16"] + .w').boundingBox();
    await page.mouse.click(wk.x + wk.width / 2, wk.y + wk.height / 2);
    check('a word clicked in the second reader opens its card; the reader stays', await page.locator('.popover .lex, .popover .lemma-row').first().waitFor({ timeout: 5000 }).then(() => true, () => false) && (await top()) === at0);
    await page.keyboard.press('Escape');
    await r2.locator('.reader2-next').click();
    await page.waitForFunction(() => [...document.querySelectorAll('.pane-reader2 .reader2-title')].some(e => e.offsetWidth && e.textContent === 'Numbers 26'), null, { timeout: 10000 }).catch(() => {});
    check('› turns the second reader’s own chapter; the reader stays', (await r2.locator('.reader2-title').textContent()) === 'Numbers 26' && (await label()) === 'Numbers 25' && (await top()) === at0);
    const v3 = await r2.locator('.vn[data-v="3"]').boundingBox();
    await page.mouse.click(v3.x + v3.width / 2, v3.y + v3.height / 2, { button: 'right' });
    await page.locator('.verse-menu .menu-item', { hasText: 'Go to in the reader' }).click();
    await page.waitForFunction(() => document.querySelector('#place .place-label')?.textContent === 'Numbers 26', null, { timeout: 10000 }).catch(() => {});
    await sleep(300);
    check('“Go to in the reader” on a verse in it moves the reader there', (await label()) === 'Numbers 26' && (await top()) === 3, `${await label()} verse ${await top()}`);
    await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'reader2')) d.close(p); });

    // 21bd: a verse clicked outside the reader asks: the reader, or a tab; Ctrl+click goes straight there
    await page.evaluate(() => window.__wb.open('NUM', 25, 1));
    await sleep(400);
    await page.evaluate(() => window.__wb.run('search zealous'));
    const link = page.locator('.pane-search:visible .ref-link').first();
    await link.waitFor({ timeout: 10000 });
    const refShown = await link.textContent();
    await link.click();
    check('a verse clicked outside the reader asks: the reader, or a tab (note 21bd)', await page.locator('.ref-choice .menu-item').count() === 2 && (await label()) === 'Numbers 25');
    await page.locator('.ref-choice .menu-item', { hasText: 'Open in a tab' }).click();
    check('Open in a tab opens it in a second reader; the reader stays', await page.locator('.pane-reader2 .vn-asked').first().waitFor({ timeout: 10000 }).then(() => true, () => false) && (await label()) === 'Numbers 25', refShown);
    await page.evaluate(() => window.__wb.run('search zealous'));   // the search pane in front again
    await link.click({ modifiers: ['Control'] });
    await page.waitForFunction(() => document.querySelector('#place .place-label')?.textContent !== 'Numbers 25', null, { timeout: 10000 }).catch(() => {});
    check('Ctrl+click goes straight to the reader', refShown.startsWith(await label()), `${refShown} → ${await label()}`);
    await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => ['reader2', 'search'].includes(p.kind))) d.close(p); });
    await page.evaluate(() => window.__wb.open('NUM', 25, 1));
    await sleep(400);

    // c39a: a question on part of a verse shows in Notes & lookup for the verse
    // words 3–6 of verse 13 picked in the reader, then ? asks a question there (the window's own store writes it)
    const q1 = await boxOf(13, 3), q2 = await boxOf(13, 6);
    await page.mouse.move(q1.x, q1.y); await page.mouse.down();
    for (let k = 1; k <= 6; k++) await page.mouse.move(q1.x + (q2.x - q1.x) * k / 6, q1.y + (q2.y - q1.y) * k / 6);
    await page.mouse.up();
    await page.waitForSelector('.colorbar', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__wb.run('?Why these words here?'));
    const asked = JSON.parse(execFileSync(wbExe, ['trail', 'list', '--status', 'all', '--at', 'Num 25:13'], { env }).toString()).trails.find(t => t.text === 'Why these words here?');
    check('a question on words of a verse is at those words; wb trail list --at lists it at the verse', !!asked && asked.anchor.startsWith('NUM.25:13.') && asked.here === false, asked?.anchor);
    await page.evaluate(() => window.__wb.run('notes @Num 25:13'));
    check('Notes & lookup shows a question on part of the verse (note c39a)', await page.locator('.pane-place:visible .question-card', { hasText: 'Why these words here?' }).waitFor({ timeout: 10000 }).then(() => true, () => false));
    await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'place')) d.close(p); });

    // 797d: the command field keeps the lines run, failed ones too; ↑ ↓ go through them, newest first
    await page.locator('#reader').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Backquote');
    await page.keyboard.type('go Num 25:20');
    await page.keyboard.press('Enter');
    await sleep(500);
    await page.keyboard.press('Backquote');
    await page.keyboard.type('go Nowhere 99');
    await page.keyboard.press('Enter');
    await sleep(500);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Backquote');
    await sleep(200);
    const recent = (await page.locator('.suggest-group').allTextContents()).some(t => t.startsWith('Recent'));
    const steps = [];
    for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown']) { await page.keyboard.press(k); steps.push(await page.locator('#cmd').inputValue()); }
    check('the empty command field lists recent lines; ↑ ↓ go through them, the failed one too (note 797d)', recent && steps.join(' | ') === 'go Nowhere 99 | go Num 25:20 | go Nowhere 99 | ', steps.join(' | '));
    await page.keyboard.press('Escape');

    // 50c1: Ctrl+Shift+J writes a finding about the app, apart from the study, with what was on screen
    await page.locator('#reader').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+Shift+KeyJ');
    check('Ctrl+Shift+J opens a box for a finding (note 50c1)', await page.waitForFunction(() => document.activeElement?.classList.contains('finding-field'), null, { timeout: 5000 }).then(() => true, () => false));
    // W0, finding 707d: the box is moved by its head, and a click elsewhere does not lose what was written
    const fbox = page.locator('.finding-box');
    const b0 = await fbox.boundingBox(), hb = await fbox.locator('.capture-head .capture-title').boundingBox();
    await page.mouse.move(hb.x + 10, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 130, hb.y + hb.height / 2 + 200, { steps: 8 });
    await page.mouse.up();
    const b1 = await fbox.boundingBox();
    check('the findings box moves by its head (finding 707d)', Math.abs(b1.x - b0.x - 120) < 3 && Math.abs(b1.y - b0.y - 200) < 3, `${Math.round(b1.x - b0.x)}, ${Math.round(b1.y - b0.y)}`);
    await page.keyboard.type('The verse bar could say which verse it is on');
    await page.locator('#reader').click({ position: { x: 5, y: 5 } });
    await sleep(200);
    check('a click elsewhere keeps the box and what was written in it', await fbox.count() === 1 && (await page.locator('.finding-field').inputValue()).startsWith('The verse bar'));
    await page.locator('.finding-field').click();
    await page.keyboard.press('Enter');
    const fdir = path.join(study, 'findings');
    for (let i = 0; i < 30 && !(existsSync(fdir) && readdirSync(fdir).length); i++) await sleep(100);
    const ftext = existsSync(fdir) && readdirSync(fdir).length ? readFileSync(path.join(fdir, readdirSync(fdir)[0]), 'utf8') : '';
    const inNotebook = JSON.stringify(JSON.parse(execFileSync(wbExe, ['notebook', '--group', 'none'], { env }).toString())).includes('The verse bar could say');
    check('the finding is a file in findings/, with the size, panes and place, and not in the Notebook', /kind: "finding"/.test(ftext) && /"size": "large"/.test(ftext) && /"panes": \[/.test(ftext) && /"place": "Numbers 25/.test(ftext) && !inNotebook, ftext.split('\n').find(l => l.startsWith('context')) || 'no file');
    await page.evaluate(() => window.__wb.run('findings'));
    const fcard = page.locator('.pane-findings .note-card.finding', { hasText: 'The verse bar could say' });
    check('Findings lists it', await fcard.waitFor({ timeout: 10000 }).then(() => true, () => false));
    await page.screenshot({ path: shots + '1440-findings.png' });
    await fcard.getByRole('button', { name: '✓ Handled' }).click();
    await page.waitForFunction(() => !document.querySelector('.pane-findings .note-card.finding'), null, { timeout: 10000 }).catch(() => {});
    check('✓ Handled marks it handled (wb findings --all)', JSON.parse(execFileSync(wbExe, ['findings', '--all'], { env }).toString()).counts.handled === 1);
    await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'findings')) d.close(p); });

    // 28d3: on touch (a laptop flipped to a tablet), writing a note keeps the cursor, so the on-screen keyboard stays
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    const watchBlur = () => page.evaluate(() => { window.__blurs = []; if (!window.__blurWatch) { window.__blurWatch = true; document.addEventListener('focusout', e => { if (e.target.matches?.('.nb-input, .capture-field')) window.__blurs.push(e.relatedTarget?.className || 'nothing'); }, true); } });
    const keptWriting = async () => {
      const got = await page.waitForFunction(() => document.activeElement?.classList.contains('nb-input'), null, { timeout: 8000 }).then(() => true, () => false);
      await cdp.send('Input.insertText', { text: 'typed on a touch screen' });
      await sleep(2500);   // past the save after typing, and the Notebook drawn again
      return { got, ...(await page.evaluate(() => ({ focus: !!document.activeElement?.classList.contains('nb-input'), blurs: window.__blurs }))) };
    };
    await page.evaluate(() => window.__wb.run('notebook'));
    await nbBack();
    await watchBlur();
    const pen = await page.locator('.pane-notebook .nb-new').boundingBox();
    await tap(pen.x + pen.width / 2, pen.y + pen.height / 2);
    const s1 = await keptWriting();
    check('on touch, the Notebook’s pen keeps the cursor in the new note through typing and saving (note 28d3)', s1.got && s1.focus && !s1.blurs.length, JSON.stringify(s1));
    await page.keyboard.press('Escape');
    await sleep(900);
    await nbBack();
    await page.locator('#reader .vn[data-v="16"]').scrollIntoViewIfNeeded();
    const vt = await page.locator('#reader .vn[data-v="16"]').boundingBox();
    await tap(vt.x + vt.width / 2, vt.y + vt.height / 2);
    await page.waitForSelector('.colorbar', { timeout: 5000 }).catch(() => {});
    const nb = await page.locator('.colorbar .act', { hasText: /^Note$/ }).boundingBox();
    await watchBlur();
    if (nb) await tap(nb.x + nb.width / 2, nb.y + nb.height / 2);
    const s2 = await keptWriting();
    check('on touch, Note on a verse keeps the cursor in the new note through typing and saving', !!nb && s2.got && s2.focus && !s2.blurs.length, JSON.stringify(s2));
    await page.keyboard.press('Escape');
    await sleep(900);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await nbBack();
  }

  // wb do from a terminal reaches this window
  const said = execFileSync(wbExe, ['do', 'open John 3:16-18'], { env }).toString().trim();
  await page.waitForSelector('.pane-reader2 .vn-asked', { timeout: 10000 });
  const john = JSON.parse(execFileSync(wbExe, ['text', 'John 3:16-18', '--json'], { env }).toString());
  const shown = await page.evaluate(() => { const r = [...document.querySelectorAll('.pane-reader2 .reader2')].find(x => x.offsetWidth); return { asked: [...r.querySelectorAll('.vn-asked')].map(v => +v.dataset.v), text: r.textContent.replace(/\s+/g, ' ') }; });
  check('wb do opens the passage in a second reader, verbatim, its verses marked', shown.asked.join() === '16,17,18' && john.verses.every(v => shown.text.includes(v.text.replace(/\s+/g, ' '))), said);

  // size classes; the verse at the top stays at the top through each
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
    check(`window ${preset}: the pen ${cls === 'compact' ? 'is there on the phone' : 'is not over the reader'} (note e3fe)`, (await page.locator('#pen').isVisible()) === (cls === 'compact'));
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
