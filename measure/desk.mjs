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
  // a reference in a note: hover cards are off by default; a click shows its verse, verbatim, and opens it as a tab
  const cor = JSON.parse(execFileSync(wbExe, ['text', '1 Cor 10:8', '--json'], { env }).toString()).verses[0].text;
  await page.locator('.nb-entry a.ref').first().hover();
  await sleep(700);
  check('hover cards are off by default', await page.locator('.hovercard').count() === 0 && await page.evaluate(() => document.documentElement.dataset.hover) === 'off');
  const placeAtRef = await page.locator('#place .place-label').textContent();
  await page.locator('.nb-entry a.ref').first().click();
  check('clicking a reference in a note shows the verse', await page.locator('.popover', { hasText: cor }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  check('the click does not move the reader', (await page.locator('#place .place-label').textContent()) === placeAtRef);
  await page.locator('.popover .act', { hasText: 'Open as a tab' }).click();
  check('Open as a tab opens the verse as a pane', await page.locator('.pane-passage', { hasText: cor }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.evaluate(() => window.__wb.run('hover on'));
  await page.locator('.nb-entry a.ref').first().hover();
  check('with hover on, hovering a reference shows the verse', await page.locator('.hovercard', { hasText: cor }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.mouse.move(700, 300);
  await page.evaluate(() => window.__wb.run('hover off'));
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

  // a verse opened by a click can be a tab; so can a word
  const v6 = JSON.parse(execFileSync(wbExe, ['text', 'Num 25:6', '--json'], { env }).toString()).verses[0].text;
  await page.locator('.vn[data-v="6"]').click();
  await page.locator('.popover .act', { hasText: 'Open as a tab' }).click();
  check('Open as a tab on a verse opens it as a pane', await page.locator('.pane-passage', { hasText: v6 }).waitFor({ timeout: 5000 }).then(() => true, () => false));
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
  await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'passage' || p.kind === 'strong')) d.close(p); });

  // a question from the verse popover: written in the Notebook's box (one writing box), with the place chosen
  await page.locator('.vn[data-v="9"]').click();
  await page.locator('.popover .act', { hasText: 'Question' }).click();
  await page.waitForFunction(() => document.activeElement?.classList.contains('nb-input'), null, { timeout: 10000 });
  const boxes = await page.evaluate(() => [...document.querySelectorAll('textarea')].filter(t => t.offsetWidth).map(t => t.placeholder));
  check('Question on a verse writes in the Notebook’s box, the only one shown', boxes.length === 1 && boxes[0] === 'Your question on Numbers 25:9…', boxes.join(' | '));
  await page.keyboard.type('How do the two numbers relate?');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.vn[data-v="9"].vq', { timeout: 10000 });
  check('a question puts a ? on its verse number', true);
  check('the Notebook has one writing box after the write', await page.locator('.pane-notebook .nb-write').count() === 1);

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

  // the phase 2 check's first findings (docs/phase2-results.md section 10)
  await page.evaluate(() => window.__wb.run('threads'));
  await sleep(700);
  check('the threads list wraps instead of scrolling sideways', await page.evaluate(() => { const p = [...document.querySelectorAll('.pane-threads')].find(x => x.offsetWidth); return !!p && p.scrollWidth <= p.clientWidth + 1; }));
  await page.evaluate(() => window.__wb.run('def H7065'));
  await page.locator('.pane-strong:visible button.chip.link', { hasText: /^zealous / }).first().click();
  await page.waitForSelector('.pane-uses:visible .row', { timeout: 10000 });
  const zealous = JSON.parse(execFileSync(wbExe, ['uses', 'H7065', '--rendering', 'zealous'], { env }).toString());
  check('a rendering in word study opens only the verses rendered that way', await page.locator('.pane-uses:visible .row').count() === zealous.verses, `${zealous.verses} verses`);
  await page.evaluate(() => window.__wb.run('notebook'));
  const q9 = page.locator('.pane-notebook .nb-entry', { hasText: 'two numbers relate' }).first();
  await q9.getByRole('button', { name: '✓ Answered' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.pane-notebook .nb-entry.done')].some(e => e.textContent.includes('two numbers relate')), null, { timeout: 10000 });
  await page.locator('.pane-notebook .nb-entry', { hasText: 'two numbers relate' }).first().locator('.question-pill').click();
  await page.waitForFunction(() => { const e = [...document.querySelectorAll('.pane-notebook .nb-entry')].find(e => e.textContent.includes('two numbers relate')); return e && !e.querySelector('.question-pill'); }, null, { timeout: 10000 });
  check('a question is answered, then made a plain note by clicking its tag', true);
  const plain = page.locator('.pane-notebook .nb-entry', { hasText: 'two numbers relate' }).first();
  check('a placed note shows Move… and Delete', await plain.getByRole('button', { name: 'Move…' }).isVisible() && await plain.getByRole('button', { name: 'Delete' }).isVisible());
  await plain.getByRole('button', { name: 'Move…' }).click();
  await page.locator('.place-other input').fill('Num 25:18');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.pane-notebook .nb-entry')].some(e => e.textContent.includes('two numbers relate') && e.textContent.includes('25:18')), null, { timeout: 10000 });
  check('Move… gives a placed note another verse', JSON.parse(execFileSync(wbExe, ['note', 'list', 'Num 25:18'], { env }).toString()).some(n => n.text.includes('two numbers relate')));
  await page.evaluate(() => window.__wb.open('NUM', 25, 18));
  await page.locator('.chapter-end button').click();
  await page.waitForFunction(() => /read /.test(document.querySelector('.chapter-read')?.textContent || ''), null, { timeout: 10000 });
  await page.evaluate(() => window.__wb.open('NUM', 26, 1));
  await sleep(400);
  await page.evaluate(() => window.__wb.open('NUM', 25, 18));
  await page.waitForFunction(() => /read /.test(document.querySelector('.chapter-read')?.textContent || ''), null, { timeout: 10000 });
  check('a chapter marked read says so when it is opened again', true, await page.locator('.chapter-read').textContent());
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  check('the light theme keeps light scrollbars under a dark system', await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme) === 'light');
  await page.evaluate(() => { delete document.documentElement.dataset.theme; });
  await page.emulateMedia({ colorScheme: null });

  // the person's decisions of 2026-11-03: the pen, more places, notes on a thread, the Trash
  await page.evaluate(() => window.__wb.open('NUM', 25, 11));
  await sleep(400);
  check('the pen is at the reader’s bottom right at desktop sizes', await page.locator('#pen').isVisible());
  await page.locator('#pen').click();
  await page.waitForFunction(() => document.activeElement?.classList.contains('nb-input'), null, { timeout: 10000 });
  await page.keyboard.type('zeal in more than one place');
  await page.keyboard.press('Enter');
  const many = page.locator('.pane-notebook .nb-entry', { hasText: 'zeal in more than one place' }).first();
  await many.waitFor({ timeout: 10000 });
  const penAt = await many.locator('.pill').first().textContent();
  check('the pen writes a note on the place picked or the verse at the top', /Numbers 25/.test(penAt), penAt);
  await many.getByRole('button', { name: '+ Place' }).click();
  await page.locator('.place-other input').fill('Ps 106:30');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.pane-notebook .nb-entry')].some(e => e.textContent.includes('zeal in more than one place') && e.textContent.includes('Psalms 106:30')), null, { timeout: 10000 });
  const ps106 = JSON.parse(execFileSync(wbExe, ['note', 'list', 'Psalms 106'], { env }).toString());
  check('+ Place puts a note on a far place too', ps106.some(n => n.text === 'zeal in more than one place'));
  await page.locator('.pane-notebook .nb-entry', { hasText: 'zeal in more than one place' }).first().getByRole('button', { name: '+ Thread' }).click();
  await page.locator('.chooser input').fill('Zeal notes');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.pane-notebook .nb-thread-chip', { timeout: 10000 });
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
  await page.locator('.nb-seg button', { hasText: 'Trash' }).click();
  const gone = page.locator('.pane-notebook .nb-entry.trashed', { hasText: 'a note on the thread itself' }).first();
  await gone.waitFor({ timeout: 10000 });
  check('a deleted note is in the Trash with its days left', /erased in 7 days/.test(await gone.textContent()));
  await gone.getByRole('button', { name: 'Put it back' }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll('.pane-notebook .nb-entry.trashed')].some(e => e.textContent.includes('a note on the thread itself')), null, { timeout: 10000 });
  check('Put it back restores it to its thread', JSON.parse(execFileSync(wbExe, ['thread', 'notes', 'Zeal notes'], { env }).toString()).notes.length === 2);
  await page.locator('.nb-seg button', { hasText: 'Journal' }).click();

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

  // wb do from a terminal reaches this window
  const said = execFileSync(wbExe, ['do', 'open John 3:16-18'], { env }).toString().trim();
  await page.waitForSelector('.pane-passage .passage-verse', { timeout: 10000 });
  const john = JSON.parse(execFileSync(wbExe, ['text', 'John 3:16-18', '--json'], { env }).toString());
  const shown = await page.locator('.pane-passage .passage-verse').allTextContents();
  check('wb do opens the passage in the window, verbatim', shown.length === 3 && shown[0].includes(john.verses[0].text), said);

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
