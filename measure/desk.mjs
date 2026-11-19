// Checks the desktop (phase 2) in the real app: its own instance, on its own copy of the scratch study folder, with its
// own cache folder (so `wb do` reaches this instance) and web view profile, driven over the DevTools protocol. Screenshots
// go to docs/phase2/. The watch window and the scratch folder it uses are not touched.
//
//   node measure/desk.mjs            the debug app (its UI comes from `npm run dev` on :1420, which must be running)
//   node measure/desk.mjs --release  the release app (npx tauri build --no-bundle first)
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { shelfChecks, shelfFixtures } from './shelf-checks.mjs';
import { acquire, freePort } from './instance.mjs';
import { threadChecks } from './threads-checks.mjs';
import { readingPlansChecks } from './reading-plans-checks.mjs';

const root = new URL('..', import.meta.url);
const file = u => new URL(u, root).pathname.slice(1);
const release = process.argv.includes('--release');
const exe = file(`target/${release ? 'release' : 'debug'}/bible-workbench.exe`);
const wbExe = file(`target/${release ? 'release' : 'debug'}/wb.exe`);
const shots = file('docs/phase2/');
mkdirSync(shots, { recursive: true });
// (two sessions checking at once need a folder and a port each: WB_DESK_WORK and WB_DESK_PORT)
await acquire('desk');
const work = process.env.WB_DESK_WORK || path.join(os.tmpdir(), 'bible-workbench-rs', 'desk-check');
const cdpPort = process.env.WB_DESK_PORT || String(await freePort());
const study = path.join(work, 'study'), cache = path.join(work, 'cache'), profile = path.join(work, 'webview');
const sleep = ms => new Promise(r => setTimeout(r, ms));

rmSync(work, { recursive: true, force: true });
cpSync(path.join(os.tmpdir(), 'bible-workbench-rs', 'study-scratch'), study, { recursive: true });
// The checks were written against a folder with no pages of the Notebook's own: the person's real folder now has many
// (52 with no place, notes on threads, a template that makes the pen ask what to start from, documents). The copy starts
// without them; what the checks need they make.
for (const d of ['notes/_inbox', 'notes/_threads', 'notes/_days', 'documents', 'findings', '.trash']) rmSync(path.join(study, d), { recursive: true, force: true });
rmSync(path.join(study, 'settings', 'notebook.json'), { force: true });
// the hover checks start from the default (off); the person's folder may have chosen otherwise
rmSync(path.join(study, 'settings', 'hover.json'), { force: true });
// the Shelf's checks open two sets by name; the person's folder is not trusted to hold them, so this copy gets its own
shelfFixtures(study);
mkdirSync(cache, { recursive: true });
const env = { ...process.env, WB_STUDY_DIR: study, WB_DOCS_DIR: '', WB_CACHE_DIR: cache, WEBVIEW2_USER_DATA_FOLDER: profile, WB_WINDOW: 'laptop-large', WB_CDP_PORT: cdpPort, WB_NO_OPEN: '1' };
const proc = spawn(exe, [], { env, stdio: 'ignore' });
const kill = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* gone */ } };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

// R4 (More cut down, Settings, a person's own theme). `node measure/desk.mjs --release --settings` runs only this.
async function settingsChecks(page) {
  // R4: More is cut down; Settings holds the settings, saved per key; a theme of the person's own
  await page.locator('#more').click();
  const moreText = (await page.locator('.more-menu').innerText()).replace(/\s+/g, ' ');
  check('More holds the window: Settings, Help, Full screen, Layout, Theme, Text size (the panes are on the rail)', /Settings/.test(moreText) && /Help/.test(moreText) && /Full screen/.test(moreText) && /Layout/.test(moreText) && !/Hover cards|Window size|Go to/.test(moreText), moreText);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+,');
  await page.waitForSelector('.pane-settings .set-body', { timeout: 10000 });
  check('Ctrl+, opens Settings', await page.locator('.pane-settings .set-nav button').count() === 8);
  await page.locator('.pane-settings .size-row button', { hasText: 'A+' }).click();
  await sleep(600);
  const rs = JSON.parse(execFileSync(wbExe, ['settings', 'reading'], { env }).toString());
  check('a change in Settings is saved at once in settings/reading.json', rs.size === 110, JSON.stringify(rs));
  await page.locator('.pane-settings .size-row button', { hasText: '100%' }).click();
  await page.locator('.pane-settings .set-nav button', { hasText: 'Theme' }).click();
  await page.locator('.pane-settings .theme-chips button', { hasText: 'New theme' }).click();
  await page.waitForSelector('.pane-settings .theme-name', { timeout: 5000 });
  const hex = page.locator('.pane-settings .color-row', { hasText: 'Page behind the text' }).locator('.hex');
  await hex.fill('#102030');
  await hex.press('Enter');
  await sleep(600);
  const bgNow = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toLowerCase());
  const th = JSON.parse(execFileSync(wbExe, ['settings', 'theme'], { env }).toString());
  check('a theme of your own changes only the colors set, and is kept in settings/theme.json', bgNow === '#102030' && th.themes?.[0]?.colors?.bg === '#102030' && Object.keys(th.themes[0].colors).length === 1 && th.active === th.themes[0].name, JSON.stringify(th));
  await page.screenshot({ path: shots + '1440-settings-theme.png' });
  await page.locator('.pane-settings .theme-chips button', { hasText: /^System$/ }).click();
  await sleep(300);
  check('choosing System puts the base colors back', await page.evaluate(() => document.documentElement.style.getPropertyValue('--bg') === ''));
  execFileSync(wbExe, ['settings', 'theme', 'themes', 'default'], { env });
  execFileSync(wbExe, ['settings', 'theme', 'active', 'default'], { env });
  await page.evaluate(() => { const d = window.__wb.dock(); d.panes.filter(p => p.title === 'Settings').forEach(p => d.close(p)); });

  // The toolbar is gone (design/features/command round 2, 2026-11-13): the rail, the box and the trail are checked by
  // measure/rail.mjs. Here: More holds the window's things and no toolbar editor.
  check('there is no toolbar, and More has no Customize toolbar', await page.locator('nav.tools').count() === 0 && !/Customize toolbar/.test(moreText), moreText);
  // R4 step 4: my commands
  await page.keyboard.press('Control+,');
  await page.waitForSelector('.pane-settings .set-nav', { timeout: 10000 });
  await page.locator('.pane-settings .set-nav button', { hasText: 'Commands' }).click();
  await page.locator('.pane-settings button', { hasText: 'A command of your own' }).click();
  const inputs = page.locator('.pane-settings .cmd-form input');
  await inputs.nth(0).fill('Uses of a word');
  await inputs.nth(1).fill('uses {word}');
  await inputs.nth(2).fill('ctrl+u');
  check('the form tests the line with what is selected now, writing nothing', /Select a selected word first/.test(await page.locator('.pane-settings .cmd-test').innerText()));
  await page.locator('.pane-settings .cmd-buttons button', { hasText: /^Keep$/ }).click();
  await sleep(700);
  const kept = JSON.parse(execFileSync(wbExe, ['commands'], { env }).toString());
  check('a command of your own is kept in settings/commands.json, with its key', kept.length === 1 && kept[0].line === 'uses {word}' && kept[0].key === 'Ctrl+U', JSON.stringify(kept));
  execFileSync(wbExe, ['commands', 'rm', 'Uses of a word'], { env });
  // R4 step 5: layouts
  await page.locator('.pane-settings .set-nav button', { hasText: 'Layouts' }).click();
  await page.locator('.pane-settings .go input').fill('Desk check');
  await page.locator('.pane-settings .go button', { hasText: 'Save this layout' }).click();
  await sleep(700);
  const lays = JSON.parse(execFileSync(wbExe, ['layout', 'list'], { env }).toString());
  check('Save this layout keeps the panes open now under a name', lays.some(l => l.name === 'Desk check'), JSON.stringify(lays));
  await page.evaluate(() => window.__wb.run('keys'));
  await page.waitForSelector('.pane-keys', { timeout: 5000 });
  const loaded = await page.evaluate(() => window.__wb.run('layout load Desk check'));
  await sleep(800);
  await page.evaluate(() => { const d = window.__wb.dock(); const p = d.panes.find(x => x.title === 'Settings'); if (p) d.open('settings', 'Settings', 'settings', 'right', () => {}); });
  await page.waitForSelector('.pane-settings .set-row', { timeout: 5000 });
  check('opening a layout brings back its panes and closes the others', await page.locator('.pane-keys').count() === 0 && await page.locator('.pane-notebook').count() === 1, `${JSON.stringify(loaded)} keys ${await page.locator('.pane-keys').count()}, notebook ${await page.locator('.pane-notebook').count()}, ${await page.evaluate(() => window.__wb.dock().panes.map(p => p.key).join(' '))}`);
  await page.locator('.pane-settings .set-row', { hasText: 'Desk check' }).locator('button', { hasText: 'Remove' }).click();
  await sleep(500);
  check('Remove takes the layout away', JSON.parse(execFileSync(wbExe, ['layout', 'list'], { env }).toString()).length === 0);

}

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
  await page.waitForSelector('.pane-notebook .nb-sections', { timeout: 15000 });
  const size = await page.evaluate(() => [innerWidth, innerHeight, document.documentElement.dataset.size]);
  if (process.argv.includes('--reading-plans')) {
    await readingPlansChecks({ page, check, env, wbExe, sleep });
    await browser.close().catch(() => {});
    kill();
    const bad = results.filter(r => !r.ok);
    console.log(`
${results.length - bad.length} of ${results.length} checks passed`);
    process.exit(bad.length ? 1 : 0);
  }
  if (process.argv.includes('--settings')) {
    await settingsChecks(page);
    await browser.close().catch(() => {});
    kill();
    const bad = results.filter(r => !r.ok);
    console.log(`
${results.length - bad.length} of ${results.length} checks passed`);
    process.exit(bad.length ? 1 : 0);
  }
  check('the laptop-large window is the Large size class', size[2] === 'large', size.join('×'));
  check('the Notebook is docked on the right', await page.locator('.dock-right.open .pane-notebook').count() === 1);
  check('the top bar has the command field with the reader\'s tools, and the rail the panes', await page.locator('#cmd').isVisible() && await page.locator('#rail [data-rail="notebook"]').isVisible() && await page.locator('#hl-menu').isVisible());
  await page.screenshot({ path: shots + '1440-reader-with-the-notebook.png' });

  // scrollbars (note cd59): no arrows; the thumb is clear at rest and shows while scrolling, then fades
  await page.mouse.move(8, 8);
  const thumb = () => page.evaluate(() => { const e = document.getElementById('scroller'); return getComputedStyle(e, '::-webkit-scrollbar-thumb').backgroundColor; });
  const clear = c => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  const bar0 = await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('scroller'), '::-webkit-scrollbar-button'); return cs.display; });
  const thumbRest = await thumb();
  await page.evaluate(() => { document.getElementById('scroller').scrollTop += 120; });
  await sleep(450);
  const thumbScrolling = await thumb();
  await sleep(1500);
  const thumbAfter = await thumb();
  check('scrollbars have no arrows, are clear at rest, show while scrolling and fade after', bar0 === 'none' && clear(thumbRest) && !clear(thumbScrolling) && clear(thumbAfter), [bar0, thumbRest, thumbScrolling, thumbAfter].join(' | '));
  await page.evaluate(() => { document.getElementById('scroller').scrollTop = 0; });

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
  const unplacedFiles = () => existsSync(path.join(study, 'notes', '_inbox')) ? readdirSync(path.join(study, 'notes', '_inbox')) : [];
  const waitUnplaced = async n => { for (let i = 0; i < 100 && unplacedFiles().length !== n; i++) await sleep(100); };
  await waitUnplaced(1);
  const inbox = unplacedFiles();
  check('a note with no place is a file in notes/_inbox', inbox.length === 1, inbox[0]);
  check('no count on the Notebook’s button: a note with no place is a page, nothing waits to be sorted (finding c7ab)', await page.evaluate(() => { const b = document.querySelector('#tb-notebook .badge'); return !b || b.hidden; }));
  check('the editor shows it as a page, its first line its title', (await ed.locator('.nb-title').textContent()).startsWith('Check where else'));
  await page.screenshot({ path: shots + '1440-notebook-a-new-note.png' });
  await nbBack();
  check('the list shows it with no place yet', await nbItem('Check where else').locator('.unplaced', { hasText: 'No place yet' }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await nbItem('Check where else').click();
  // a reference in a note: hover cards are off by default; a click shows its verse, verbatim, and opens it as a tab
  const cor = JSON.parse(execFileSync(wbExe, ['text', '1 Cor 10:8', '--json'], { env }).toString()).verses[0].text;
  await ed.locator('a.ref').first().hover();
  await sleep(700);
  check('hover cards are off by default', await page.locator('.hovercard').count() === 0 && await page.evaluate(() => document.documentElement.dataset.hover) === 'off');
  const placeAtRef = await page.locator('#place .place-label').textContent();
  await ed.locator('a.ref').first().click();
  check('clicking a reference in a note shows the verse', await page.locator('.popover', { hasText: cor }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  check('the click does not move the reader', (await page.locator('#place .place-label').textContent()) === placeAtRef);
  // W4: the reference opens the verse card; Ctrl+click on its Open the chapter opens a new reader (the reader stays)
  await page.locator('.verse-card .open-split-go').click({ modifiers: ['Control'] });
  check('Ctrl+click on the card’s Open the chapter opens the verse in a second reader, marked',await page.locator('.pane-reader2 .vn-asked[data-v="8"]').waitFor({ timeout: 5000 }).then(() => true, () => false) && (await page.locator('.pane-reader2 .reader2-title').first().textContent()) === '1 Corinthians 10');
  check('a verse opened from a note opens in the Notebook’s column', await page.locator('.dock-right .pane-reader2', { hasText: cor }).count() === 1);
  await page.evaluate(() => window.__wb.run('notebook'));
  await page.evaluate(() => window.__wb.run('hover on'));
  await ed.locator('a.ref').first().hover();
  check('with hover on, hovering a reference shows the verse', await page.locator('.hovercard', { hasText: cor }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.mouse.move(700, 300);
  await page.evaluate(() => window.__wb.run('hover off'));
  await ed.locator('.nb-add', { hasText: '+ Place' }).click();
  await page.waitForSelector('.place-menu .place-opt');
  const offered = await page.locator('.place-menu .place-opt-label').allTextContents();
  check('+ Place offers the place the note names, and the chapter and book being read', offered.includes('1 Corinthians 10:8') && offered.includes('Numbers 25') && offered.includes('Numbers'), offered.join(', '));
  await page.screenshot({ path: shots + '1440-placing-a-note.png' });
  await page.locator('.place-menu .place-opt', { hasText: '1 Corinthians 10:8' }).click();
  await waitUnplaced(0);
  check('placing moves the file to notes/1CO', existsSync(path.join(study, 'notes', '1CO', inbox[0])) && !existsSync(path.join(study, 'notes', '_inbox', inbox[0])));
  await nbBack();

  // a page (a note with no place) dragged onto a verse in the reader is placed there
  await page.locator('.pane-notebook .nb-new').click();
  await typing();
  await page.keyboard.type('Dragged onto its verse');
  await done();
  await waitUnplaced(1);
  await nbBack();
  const dragged = readdirSync(path.join(study, 'notes', '_inbox'))[0];
  await page.locator('.pane-notebook .nb-item[draggable="true"]').first().dragTo(page.locator('#reader .vn[data-v="3"]'));
  for (let i = 0; i < 50 && !existsSync(path.join(study, 'notes', 'NUM', dragged)); i++) await sleep(100);
  check('a page dropped on a verse is placed there', existsSync(path.join(study, 'notes', 'NUM', dragged)) && /anchor: "NUM.25:3"/.test(readFileSync(path.join(study, 'notes', 'NUM', dragged), 'utf8')));

  // a verse picked by its number can be a tab (a second reader); so can a word
  await page.locator('#reader .vn[data-v="6"]').click();
  await page.locator('.markbar .mb-tab').click();
  check('Open as a tab on a verse opens it in a second reader', await page.locator('.pane-reader2 .vn-asked[data-v="6"]').waitFor({ timeout: 5000 }).then(() => true, () => false));
  const zeal = await page.evaluate(() => {   // "zealous" in Num 25:11, a word with a Strong's number
    const d = window.__wb.drawn, k = d.v.findIndex((v, k) => v === 11 && String(d.strong[k]).includes('7065'));
    d.el[k].scrollIntoView({ block: 'center' });
    const r = d.el[k].getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  });
  await page.mouse.click(zeal[0], zeal[1]);
  await page.waitForSelector('.word-card .lemma', { timeout: 5000 });
  const strongNum = (await page.locator('.word-card .lemma-row .small').textContent()).split(' ')[0];
  check('the word card has no Strong’s or Every use button (words W-8)', await page.locator('.word-card .btn', { hasText: /^(Strong|Every use)/ }).count() === 0 && (await page.locator('.word-card .wc-door').textContent()).includes('In the Concordance'));
  await page.locator('.word-card .wc-door').click();
  check('In the Concordance on a word opens its entry (until the Concordance is built)', await page.locator('.tab-name', { hasText: strongNum }).first().waitFor({ timeout: 5000 }).then(() => true, () => false), strongNum);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => ['passage', 'reader2', 'strong'].includes(p.kind))) d.close(p); });

  // a question on a verse: Question left the selection (MK7-33); a question is written in the Notebook or with wb, and found by itself
  execFileSync(wbExe, ['trail', 'add', 'NUM.25:9', 'How do the two numbers relate?'], { env });
  await page.evaluate(() => window.__wb.changed());
  await page.waitForSelector('#reader .vn[data-v="9"].vq', { timeout: 10000 });
  check('a question puts a ? on its verse number', true);

  // the mark bar: select words with the mouse; a Highlight style makes a mark (wb mark at lists it); a click away closes the bar
  const w1 = await boxOf(16, 2), w2 = await boxOf(16, 5);
  const dragWords = async () => {
    await page.mouse.move(w1.x, w1.y); await page.mouse.down();
    for (let k = 1; k <= 6; k++) await page.mouse.move(w1.x + (w2.x - w1.x) * k / 6, w1.y + (w2.y - w1.y) * k / 6);
    await page.mouse.up();
    await page.waitForSelector('.markbar', { timeout: 5000 });
  };
  await dragWords();
  const sel = await anchorOf();
  check('the mark bar has the six kinds, the Legend, Add to…, Copy and Open as a tab', (await page.locator('.markbar button').evaluateAll(els => els.map(e => e.title.replace(/ \(.\)$/, '')))).join(',') === 'Highlight,Underline,Circle,Box,Arrow,Margin note,Legend,Add to…,Copy,Open as a tab');
  check('no round handles after a mouse drag', await page.locator('#reader .handle:not([hidden])').count() === 0);
  await page.screenshot({ path: shots + '1440-mark-bar.png' });
  await page.locator('.markbar .mb-highlight').click();
  await page.locator('.markbar .mb-menu .mb-row').first().click();
  await sleep(800);
  const marksAt = () => JSON.parse(execFileSync(wbExe, ['mark', 'at', sel.split('-')[0]], { env }).toString()).marks;
  check('a style from the Highlight drop-down makes a highlight mark on the selection', marksAt().some(m => m.kind === 'highlight' && m.at === sel), sel);
  // a click away from the bar closes it and clears the selection (note c35b)
  await dragWords();
  await page.locator('.dock-right .pane:visible').first().click({ position: { x: 60, y: 8 } });
  await sleep(200);
  check('a click away from the mark bar closes it and clears the selection', await page.locator('.markbar').count() === 0 && await page.evaluate(() => !window.__wb.selector.sel && !document.querySelector('.w.sel')));
  // right-click the selection: the same actions as a menu
  await dragWords();
  await page.mouse.click(w1.x + 8, w1.y, { button: 'right' });
  check('right-click on a selection opens the mark menu', await page.locator('.mb-ctx').waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Notes & lookup for a verse: color it, write a note there, and take the color off again
  await page.locator('#reader .vn[data-v="4"]').click({ button: 'right' });
  await page.locator('.verse-menu .menu-item', { hasText: 'Notes & lookup' }).click();
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

  // threads and layers (R1: a thread is a page in the Notebook, not a pane of its own)
  await page.evaluate(() => window.__wb.run('+Plague stayed @Num 25:8'));
  await page.evaluate(() => window.__wb.run('thread Plague stayed'));
  await page.waitForSelector('.pane-notebook .nb-thread-places .member', { timeout: 10000 });
  check('+name adds the place to a new thread, whose page opens in the Notebook', await page.locator('.pane-notebook .nb-thread-places .member').count() === 1);
  // a thread with a color draws its underline; its eye hides it
  await page.evaluate(() => window.__wb.run('thread Phinehas'));
  await page.locator('.pane-notebook .nb-editor .nb-title', { hasText: /^\s*Phinehas$/ }).waitFor({ timeout: 10000 });
  await page.waitForSelector('.pane-notebook .nb-thread-eye', { timeout: 10000 });
  const lines = () => page.locator('.w[style*="linear-gradient"]').count();
  const before = await lines();
  await page.locator('.pane-notebook .nb-thread-eye').click();
  await sleep(600);
  const hidden = await lines();
  await page.locator('.pane-notebook .nb-thread-eye').click();
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
  // R1: the Threads window is gone; `threads` opens the Notebook at its pages, and a thread is a page there
  await page.evaluate(() => window.__wb.run('threads'));
  await sleep(500);
  check('there is no Threads button or pane: threads opens the Notebook, where each is a page', await page.locator('#tb-threads').count() === 0 && await page.locator('.pane-threads').count() === 0 && await page.locator('.pane-notebook').count() >= 1);
  await nbBack();
  await page.locator('.pane-notebook .nb-section[data-section="day"]').click();

  // many tabs in one column: they keep their size and scroll; ‹ › and the ▾ list reach every one
  // (the panes of the checks so far are closed: place panes open beside the pane last used, and that is on the left)
  await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.side === 'left')) d.close(p); });
  for (let v = 1; v <= 10; v++) await page.evaluate(v => window.__wb.run(`notes @Num 25:${v}`), v);
  await page.waitForSelector('.dock-right .tabstrip.overflowing', { timeout: 10000 });
  const strip = await page.evaluate(() => {
    const t = document.querySelector('.dock-right .tab-row'), on = t.querySelector('.tab.on');
    const widths = [...t.querySelectorAll('.tab')].map(x => x.getBoundingClientRect().width);
    const sr = t.getBoundingClientRect(), r = on.getBoundingClientRect();
    return { n: widths.length, narrowest: Math.min(...widths), onVisible: r.left >= sr.left - 1 && r.right <= sr.right + 1, scroll: t.scrollLeft };
  });
  check('many tabs keep a usable width and the front one stays in view', strip.n >= 9 && strip.narrowest >= 84 && strip.onVisible, `${strip.n} tabs, narrowest ${Math.round(strip.narrowest)} px, front in view ${strip.onVisible}`);
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
  // (Keys is in the Settings dialog now, not a pane: the check uses a search's pane)
  await page.evaluate(() => window.__wb.run('search plague'));
  await page.locator('.pane-search:visible').click({ position: { x: 40, y: 10 } });
  await page.keyboard.press('Control+f');
  await page.keyboard.type('plague');
  await sleep(200);
  const pf = await page.evaluate(() => { const b = document.querySelector('.pane-search .pane-find'); return b && { found: +b.dataset.found, focus: document.activeElement?.closest('.pane-find') === b, reader: !document.getElementById('findbar').hidden }; });
  check('Ctrl+F in a pane opens its own find bar and finds there (note 5c4a)', !!pf && pf.found > 0 && pf.focus && !pf.reader, JSON.stringify(pf));
  await page.screenshot({ path: shots + '1440-find-in-a-pane.png' });
  await page.keyboard.press('Escape');
  check('Esc closes the pane’s find bar', await page.locator('.pane-find').count() === 0);
  await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'search')) d.close(p); });
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
  await page.waitForSelector('.markbar', { timeout: 5000 });
  await page.keyboard.press('Escape');
  await sleep(300);
  check('Esc clears the verse picked and its bar', await page.locator('.markbar').count() === 0 && await page.locator('#reader .w.sel').count() === 0, await page.evaluate(() => document.getElementById('overlay').innerHTML.slice(0, 300)));
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
  // W3: it opens as a page, what was captured its title, writing on in a new block under it
  check('Ctrl+Enter opens it in the Notebook to keep writing, in a new block under it', await typing() && (await ed.locator('.nb-title').textContent()) === 'captured, then more' && await ed.locator('.nb-blocks textarea.nb-block-input').count() === 1, await ed.locator('.nb-title').textContent());
  await done();
  check('nothing is left open over the window after quick capture', await page.locator('#overlay .scrim').count() === 0, await page.evaluate(() => [...document.getElementById('overlay').children].map(c => c.className).join(', ')));
  check('with its place taken off, it waits in the Inbox', JSON.parse(execFileSync(wbExe, ['inbox'], { env }).toString()).notes.some(n => n.text === 'captured, then more'));
  await nbBack();
  await page.evaluate(() => window.__wb.run('keys'));
  check('Keys lists Ctrl+J', await page.locator('.set-modal kbd', { hasText: 'Ctrl+J' }).first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.keyboard.press('Escape');
  await page.locator('#reader').click({ position: { x: 5, y: 5 } });
  await page.locator('#reader').click({ position: { x: 5, y: 5 } });

  // the phase 2 check's first findings (docs/phase2-results.md section 10)
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
  // Note left the selection's bar (MK7-33): a new note on the verse is asked of the command language
  await page.evaluate(() => window.__wb.run('note @Num 25:11'));
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
  await page.waitForSelector('.pane-notebook .nb-inside .nb-linked-row', { timeout: 10000 });
  await page.locator('.pane-notebook .nb-on-thread-new input').fill('a note on the thread itself');
  await page.locator('.pane-notebook .nb-on-thread-new input').press('Enter');
  await ed.locator('.nb-title', { hasText: 'a note on the thread itself' }).waitFor({ timeout: 10000 });
  const tn = JSON.parse(execFileSync(wbExe, ['thread', 'notes', 'Zeal notes'], { env }).toString()).notes;
  check('a thread holds pages: one put on it, one written on its page', tn.length === 2 && tn.some(n => n.text === 'a note on the thread itself' && n.anchor === ''));
  await page.screenshot({ path: shots + '1440-notes-on-a-thread.png' });
  await ed.locator('.nb-ed-head .icon-btn').last().click();
  await page.locator('.menu .menu-item', { hasText: /^Delete$/ }).click();
  const undoPage = page.getByRole('button', { name: 'Undo deletion of 1 page', exact: true });
  await undoPage.waitFor();
  const deletions = () => JSON.parse(execFileSync(wbExe, ['page', 'deletions'], { env }).toString()).operations;
  check('a deleted note has a pending timed Undo', deletions().some(op => op.state === 'pending' && op.count === 1));
  await undoPage.click();
  await undoPage.waitFor({ state: 'hidden' });
  check('Undo restores the note to its thread', JSON.parse(execFileSync(wbExe, ['thread', 'notes', 'Zeal notes'], { env }).toString()).notes.length === 2);
  await nbBack();

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

  // Expiry removes the operation snapshot when Undo is left unused.
  await ed.locator('.nb-ed-head .icon-btn').click();
  await page.locator('.menu .menu-item', { hasText: /^Delete$/ }).click();
  await undoPage.waitFor();
  const pending = deletions().find(op => op.deleted.includes(inInbox.id));
  await undoPage.waitFor({ state: 'hidden', timeout: 15000 });
  check('expired deletion removes the page and its operation snapshot', !!pending && !existsSync(path.join(study, 'notes', '_inbox', `${inInbox.id}.md`)) && !existsSync(path.join(study, '.trash', 'page-operations', pending.operation)));
  await nbBack();

  // phase 2b tier 2: the Notebook grouped (N2, N3), places on chapters and books (N1), links (N1), today's page (N2),
  // the format bar (B1), its settings (N4), the list and the editor side by side
  const group = async g => { await page.locator(`.pane-notebook .nb-section[data-section="${{ Day: 'day', Chapter: 'chapter', Thread: 'thread', None: 'none', Pages: 'pages', Questions: 'questions' }[g]}"]`).click(); await sleep(500); };
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
  // (the new note saved before + Place is used on it)
  for (let i = 0; i < 100 && !unplacedFiles().some(f => { try { return f.endsWith('.md') && readFileSync(path.join(study, 'notes', '_inbox', f), 'utf8').includes('Numbers 25, read again'); } catch { return false; } }); i++) await sleep(100);
  await sleep(800);
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
  // W1: the sections replace Group and the ⋯ filters; Pages are the notes with no place (once the Inbox); Places has
  // its own Follow switch; ⋯ is the settings, cut down to what acts on the whole Notebook (findings c7ab, e09e)
  const sections = await page.locator('.pane-notebook .nb-sections .nb-section').allTextContents();
  check('the Notebook’s sections: Days, Pages, Places, Threads, Questions, All, on one line', sections.join(', ') === 'Days, Pages, Places, Threads, Questions, All' && await page.locator('.pane-notebook .nb-sections').evaluate(r => r.clientHeight < 40) && await page.locator('.pane-notebook .nb-head .nb-trash-btn').count() === 0, sections.join(', '));
  check('no Group control and no Inbox in the Notebook', await page.locator('.pane-notebook .nb-group').count() === 0 && !(await page.locator('.pane-notebook').textContent()).includes('Inbox'));
  await group('Pages');
  // W3: Pages is the tree of pages, in wb page tree's order (every note with no place is in it)
  const pageIds = JSON.parse(execFileSync(wbExe, ['notebook', '--group', 'pages'], { env }).toString()).groups.flatMap(g => g.entries).map(e => e.id);
  const treeIds = rows => rows.flatMap(r => [r.id, ...treeIds(r.children || [])]);
  const treeNow = () => JSON.parse(execFileSync(wbExe, ['page', 'tree'], { env }).toString());
  const inTree = treeIds(treeNow().pages);
  const shownIds = await page.locator('.pane-notebook .nb-tree .nb-tree-row').evaluateAll(els => els.map(e => e.dataset.id));
  check('Pages draws the tree, as wb page tree does, with every note that has no place', pageIds.length > 0 && shownIds.join() === inTree.join() && pageIds.every(id => inTree.includes(id)), `${shownIds.length} of ${inTree.length}`);
  await page.screenshot({ path: shots + '1440-notebook-pages.png' });
  await group('Questions');
  const qIds = JSON.parse(execFileSync(wbExe, ['notebook', '--group', 'questions'], { env }).toString()).groups.flatMap(g => g.entries).map(e => e.id);
  check('Questions lists every question', qIds.length > 0 && await page.locator('.pane-notebook .nb-scroll .nb-item.is-question').count() === qIds.length && await page.locator('.pane-notebook .nb-scroll .nb-item:not(.is-question)').count() === 0, `${qIds.length}`);
  await group('Chapter');
  const follow = page.locator('.pane-notebook .nb-follow input.switch');
  check('Places has its own Follow the reader switch, on', await follow.isChecked() && /following the reader/i.test(await ghead()));
  await follow.click();
  await page.waitForFunction(() => !/following the reader/i.test(document.querySelector('.pane-notebook .nb-ghead')?.textContent || 'following the reader'), null, { timeout: 10000 }).catch(() => {});
  check('Follow off lists every chapter, and is kept in settings/notebook.json', !/following the reader/i.test(await ghead()) && JSON.parse(readFileSync(path.join(study, 'settings', 'notebook.json'), 'utf8')).follow === false, await ghead());
  // debug-spec S2 (notes 23f1, 4c02): Places lists the chapters under a heading for their book (with its count), and one
  // Fold all / Open all folds every group at once; kept the way each fold is
  const allCh = JSON.parse(execFileSync(wbExe, ['notebook', '--group', 'chapter'], { env }).toString()).groups.filter(g => g.entries.length);
  const chGroups = allCh.filter(g => /^\d+\.\d+$/.test(g.key)), looseN = allCh.length - chGroups.length;   // (Original words: a group with no book)
  const bookIds = [...new Set(chGroups.map(g => g.key.split('.')[0]))];
  const ghs = (cls = '') => page.locator(`.pane-notebook .nb-scroll .nb-ghead${cls}`);
  const firstBook = chGroups.filter(g => g.key.startsWith(bookIds[0] + '.'));
  const bookCount = new Set(firstBook.flatMap(g => g.entries.map(e => e.id))).size;
  check(`Places with every chapter: ${bookIds.length} book headings in Bible order, each with its notes' count, ${chGroups.length} chapter headings under them`, bookIds.length > 1 && await ghs('.book').count() === bookIds.length && await ghs('.chapter-head').count() === chGroups.length && +(await ghs('.book').first().locator('.nb-count').textContent()) === bookCount, `${bookIds.length} books, ${chGroups.length} chapters`);
  await page.screenshot({ path: shots + '1440-notebook-places-by-book.png' });
  await page.locator('.pane-notebook .nb-foldall').click();
  await page.waitForFunction(n => document.querySelectorAll('.pane-notebook .nb-scroll .nb-ghead').length === n && !document.querySelector('.pane-notebook .nb-scroll .nb-item'), bookIds.length + looseN, { timeout: 10000 }).catch(() => {});
  const shutLines = await ghs().count(), foldLabel = (await page.locator('.pane-notebook .nb-foldall').textContent()).trim();
  await group('Day');
  await group('Chapter');
  await page.locator('.pane-notebook .nb-follow input.switch').waitFor();
  const keptShut = await ghs().count() === bookIds.length + looseN && (await page.locator('.pane-notebook .nb-foldall').textContent()).trim() === 'Open all';
  await page.locator('.pane-notebook .nb-foldall').click();
  await page.waitForFunction(n => document.querySelectorAll('.pane-notebook .nb-scroll .nb-ghead.chapter-head').length === n, chGroups.length, { timeout: 10000 }).catch(() => {});
  check('Fold all leaves one line per book and becomes Open all; it is kept; Open all lists every chapter again', shutLines === bookIds.length + looseN && foldLabel === 'Open all' && keptShut && await ghs('.chapter-head').count() === chGroups.length && await page.locator('.pane-notebook .nb-scroll .nb-item').count() > 0, `${shutLines} lines folded; ${await ghs().count()} open`);
  await group('Day');
  const dayGroups = await ghs().count();
  if (dayGroups > 1) {
    await page.locator('.pane-notebook .nb-foldall').click();
    await page.waitForFunction(() => !document.querySelector('.pane-notebook .nb-scroll .nb-item'), null, { timeout: 10000 }).catch(() => {});
    const dayShut = await page.locator('.pane-notebook .nb-scroll .nb-item').count() === 0 && await ghs().count() === dayGroups;
    await page.locator('.pane-notebook .nb-foldall').click();
    await page.waitForFunction(() => document.querySelector('.pane-notebook .nb-scroll .nb-item'), null, { timeout: 10000 }).catch(() => {});
    check('Days has Fold all / Open all too', dayShut && await page.locator('.pane-notebook .nb-scroll .nb-item').count() > 0, `${dayGroups} days`);
  } else check('Days has Fold all / Open all too (one day: the control is not offered)', await page.locator('.pane-notebook .nb-foldall').count() === 0);
  await group('Chapter');
  await page.locator('.pane-notebook .nb-follow input.switch').click();
  await sleep(600);
  await page.locator('.pane-notebook .nb-more').click();
  const setRows = await page.locator('.nb-settings .nb-set-label').allTextContents();
  check('⋯ is the Notebook’s settings: Today’s page, Links, Opens with, Places open in… (W4), Quick capture (finding e09e)', setRows.join(', ') === 'Today’s page, Links between notes, Opens with, Places open in…, Quick capture', setRows.join(', '));
  await page.locator('.nb-settings select.nb-set-group').selectOption('pages');
  await sleep(600);
  check('Opens with: Pages, kept in settings/notebook.json', JSON.parse(readFileSync(path.join(study, 'settings', 'notebook.json'), 'utf8')).group === 'pages');
  await page.screenshot({ path: shots + '1440-notebook-settings.png' });
  await page.locator('.nb-settings select.nb-set-group').selectOption('day');
  await sleep(400);
  await page.keyboard.press('Escape');
  await sleep(500);
  // the column expanded to half the window: the list and the editor side by side (B1)
  await nbItem('Numbers 25, read again').click();
  await page.evaluate(() => { const d = window.__wb.dock(); d.wide.right = true; d.layout(); });
  await sleep(600);
  check('a wide Notebook shows the list and the editor side by side', await page.locator('.pane-notebook .nb.two').count() === 1 && await page.locator('.pane-notebook .nb-list').isVisible() && await ed.isVisible());
  await page.screenshot({ path: shots + '1440-notebook-list-and-editor.png' });

  // W3, pages and blocks (sheets W1.1 and W2): wide, the sidebar replaces the row of sections
  const sideParts = await page.locator('.pane-notebook .nb-side .nb-side-head .nb-glabel').allTextContents();
  // (W4: with a second reader open, At the readers)
  const atReaders = await page.evaluate(() => window.__wb.dock().panes.some(p => p.kind === 'reader2')) ? 'At the readers' : 'At the reader';
  check('wide, the sidebar replaces the sections: Today, Pinned, Pages, At the reader, Questions (a thread is a page in Pages)', sideParts.join(', ') === `Today, Pinned, Pages, ${atReaders}, Questions` &&await page.locator('.pane-notebook .nb-sections').count() === 0 && await page.locator('.pane-notebook .nb-side-foot .nb-side-trash').count() === 0, sideParts.join(', '));
  const fileOf = id => { for (const d of readdirSync(path.join(study, 'notes'))) { const f = path.join(study, 'notes', d, `${id}.md`); if (existsSync(f)) return f; } return null; };
  const bodyOf = id => readFileSync(fileOf(id), 'utf8').replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '').trim();
  const waitFile = async (id, test) => { for (let i = 0; i < 60; i++) { const f = fileOf(id); if (f && test(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'))) return true; await sleep(100); } return false; };
  const sideAdd = page.locator('.pane-notebook .nb-side-head[data-part="pages"] .nb-side-add');
  await sideAdd.click();
  await typing();
  await page.keyboard.type('W3 parent page\nThe aim: read the chapter.\n\n- [ ] first to-do\n- [ ] second to-do');
  await done();
  await ed.locator('.nb-blocks .nb-block').nth(2).waitFor({ timeout: 10000 });
  const parentId = treeNow().pages.find(r => r.title === 'W3 parent page')?.id;
  const kinds = () => ed.locator('.nb-blocks .nb-block').evaluateAll(els => els.map(e => /nb-b-(\w+)/.exec(e.className)[1]).join());
  check('a page written in is drawn block by block: its title apart, each to-do its own block', !!parentId && (await ed.locator('.nb-title').textContent()) === 'W3 parent page' && (await kinds()) === 'paragraph,todo,todo', await kinds());
  await sideAdd.click();
  await typing();
  await page.keyboard.type('W3 child page');
  await done();
  await page.locator('.pane-notebook .nb-tree-row', { hasText: 'W3 child page' }).waitFor({ timeout: 10000 });
  const childId = treeNow().pages.find(r => r.title === 'W3 child page')?.id;
  const rowOf = id => page.locator(`.pane-notebook .nb-tree .nb-tree-row[data-id="${id}"]`);
  const pb = await rowOf(parentId).boundingBox();
  await rowOf(childId).dragTo(rowOf(parentId), { targetPosition: { x: pb.width / 2, y: pb.height / 2 } });
  await waitFile(childId, t => t.includes(parentId));
  const depthOf = id => rowOf(id).evaluate(e => e.style.getPropertyValue('--depth')).catch(() => '');
  await page.waitForFunction(id => document.querySelector(`.pane-notebook .nb-tree .nb-tree-row[data-id="${id}"]`)?.style.getPropertyValue('--depth') === '1', childId, { timeout: 10000 }).catch(() => {});
  const childFm = readFileSync(fileOf(childId), 'utf8').split('---')[1] || '';
  check('a page dragged onto the middle of another goes inside it: parent and order in its file, one level in in the tree', new RegExp(`parent: "?${parentId}"?`).test(childFm) && /order: 1\b/.test(childFm) && treeNow().pages.find(r => r.id === parentId)?.children.some(c => c.id === childId) && await depthOf(childId) === '1', childFm.trim().replace(/\n/g, ' · '));
  await rowOf(parentId).locator('.nb-tree-open').click();
  await ed.locator('.nb-inside').waitFor({ timeout: 10000 });
  check('a page shows the pages inside it at its foot: Pages inside · 1', (await ed.locator('.nb-inside .nb-linked-head').textContent()) === 'Pages inside · 1');
  await ed.locator('.nb-inside .nb-linked-row', { hasText: 'W3 child page' }).click();
  await ed.locator('.nb-crumbs', { hasText: 'W3 child page' }).waitFor({ timeout: 10000 });
  const crumbs = await ed.locator('.nb-crumbs').evaluate(n => [...n.children].map(c => c.textContent).join(' '));
  check('a page inside a page shows the path above it', crumbs === 'Pages / W3 parent page / W3 child page', crumbs);
  await ed.locator('.nb-crumbs .nb-crumb', { hasText: 'W3 parent page' }).click();
  await ed.locator('.nb-title', { hasText: 'W3 parent page' }).waitFor({ timeout: 10000 });
  await ed.locator('.nb-blocks .nb-block').nth(2).waitFor({ timeout: 10000 });
  await sleep(600);
  // debug-spec S2: Fold all / Open all on the Pages heading folds every page that holds pages
  const treeFold = page.locator('.pane-notebook .nb-side-head[data-part="pages"] .nb-side-foldall');
  const treeRowsNow = () => page.locator('.pane-notebook .nb-tree .nb-tree-row').count();
  const treeTotal = treeIds(treeNow().pages).length, treeTop = treeNow().pages.length;
  check('the Pages heading has a Fold all while some page holds pages', treeTotal > treeTop && await treeFold.getAttribute('aria-label') === 'Fold all' && await treeRowsNow() === treeTotal, `${treeTotal} pages, ${treeTop} at the top`);
  await treeFold.click();
  await page.waitForFunction(n => document.querySelectorAll('.pane-notebook .nb-tree .nb-tree-row').length === n, treeTop, { timeout: 10000 }).catch(() => {});
  const foldedRows = await treeRowsNow(), foldedLabel = await treeFold.getAttribute('aria-label');
  await treeFold.click();
  await page.waitForFunction(n => document.querySelectorAll('.pane-notebook .nb-tree .nb-tree-row').length === n, treeTotal, { timeout: 10000 }).catch(() => {});
  check('Fold all leaves only the top pages and becomes Open all; Open all lists every page again', foldedRows === treeTop && foldedLabel === 'Open all' && await treeRowsNow() === treeTotal && await treeFold.getAttribute('aria-label') === 'Fold all', `${treeTotal} → ${foldedRows} → ${await treeRowsNow()}`);
  // debug-spec S3 (note b737): a right-click on a page row opens that page's menu where the pointer is: the same list as its ⋯
  const menuItems = () => page.locator('.menu .menu-item').allTextContents();
  await ed.locator('.nb-ed-head .icon-btn').click();
  const dotsItems = await menuItems();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.menu'), null, { timeout: 5000 }).catch(() => {});
  const parentRow = rowOf(parentId).locator('.nb-tree-open');
  const prBox = await parentRow.boundingBox();
  await parentRow.click({ button: 'right', position: { x: 30, y: 6 } });
  await page.locator('.menu .menu-item').first().waitFor({ timeout: 5000 });
  const ctxItems = await menuItems();
  const ctxBox = await page.locator('.menu').boundingBox();
  check('right-click on a page in the tree opens that page’s menu at the pointer: the same items as its ⋯', ctxItems.length > 3 && ctxItems.join('|') === dotsItems.join('|') && Math.abs(ctxBox.x - (prBox.x + 30)) < 40 && Math.abs(ctxBox.y - (prBox.y + 6)) < 40, `${ctxItems.join(', ')} at ${Math.round(ctxBox.x)},${Math.round(ctxBox.y)}`);
  await page.keyboard.press('Escape');
  check('Esc closes the right-click menu', await page.waitForFunction(() => !document.querySelector('.menu'), null, { timeout: 5000 }).then(() => true, () => false));
  const qHead = page.locator('.pane-notebook .nb-side-head[data-part="questions"] .nb-ghead');
  const qWasShut = await qHead.getAttribute('aria-expanded') === 'false';
  if (qWasShut) await qHead.click();
  await page.locator('.pane-notebook .nb-side .nb-question-row').first().waitFor({ timeout: 5000 }).catch(() => {});
  await page.locator('.pane-notebook .nb-side .nb-question-row').first().click({ button: 'right', timeout: 5000 }).catch(() => {});
  check('right-click on a question in the sidebar opens a menu too, with “Open it again” or “Answered”', await page.locator('.menu .menu-item', { hasText: /Answered|Open it again/ }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.keyboard.press('Escape');
  if (qWasShut) await page.locator('.pane-notebook .nb-side-head[data-part="questions"] .nb-ghead').click();
  await ed.locator('.nb-blocks .nb-block').first().locator('.nb-block-body').click({ button: 'right' }).catch(() => {});
  check('right-click on a block opens no page menu', await page.locator('.menu .menu-item', { hasText: /Pin|Move inside/ }).count() === 0);
  await page.keyboard.press('Escape');
  // debug-spec S1 (note c301): the side panel folds to a rail, by its control and by Ctrl+\, and stays so
  const listWidth = () => page.locator('.pane-notebook .nb-list').evaluate(e => e.getBoundingClientRect().width);
  const edWidth = () => page.locator('.pane-notebook .nb-editor').evaluate(e => e.getBoundingClientRect().width);
  const [listOpenW, edOpenW] = [await listWidth(), await edWidth()];
  await page.locator('.pane-notebook .nb-side-fold').click();
  await page.waitForSelector('.pane-notebook .nb.side-folded', { timeout: 10000 });
  await sleep(300);
  const [listRailW, edRailW] = [await listWidth(), await edWidth()];
  check('the side panel folds to a thin rail: the editor takes the room, no page is listed, the opener and the pen remain', listRailW < 60 && listOpenW > 250 && edRailW > edOpenW + 150 && await page.locator('.pane-notebook .nb-side').count() === 0 && await page.locator('.pane-notebook .nb-rail .nb-side-fold').getAttribute('aria-label') === 'Show the side panel' && await page.locator('.pane-notebook .nb-rail .nb-new').count() === 1 && await page.evaluate(() => localStorage.getItem('wb.notebook.sideFolded')) === '1', `${Math.round(listOpenW)} → ${Math.round(listRailW)}; editor ${Math.round(edOpenW)} → ${Math.round(edRailW)}`);
  await page.screenshot({ path: shots + '1440-notebook-side-panel-folded.png' });
  await page.keyboard.press('Control+Backslash');
  await page.waitForFunction(() => !document.querySelector('.pane-notebook .nb.side-folded') && document.querySelector('.pane-notebook .nb-side'), null, { timeout: 10000 }).catch(() => {});
  check('Ctrl+\\ opens it again, the pages listed as before; the state is kept', await page.locator('.pane-notebook .nb-side').count() === 1 && Math.abs(await listWidth() - listOpenW) < 2 && await page.evaluate(() => localStorage.getItem('wb.notebook.sideFolded')) === '0' && await treeRowsNow() === treeTotal);
  await page.keyboard.press('Control+Backslash');
  await page.waitForSelector('.pane-notebook .nb.side-folded', { timeout: 10000 }).catch(() => {});
  const keyFolded = await page.locator('.pane-notebook .nb.side-folded').count() === 1;
  await page.locator('.pane-notebook .nb-rail .nb-side-fold').click();
  await page.waitForFunction(() => !document.querySelector('.pane-notebook .nb.side-folded'), null, { timeout: 10000 }).catch(() => {});
  check('Ctrl+\\ folds it too, and the opener opens it', keyFolded && await page.locator('.pane-notebook .nb-side').count() === 1);
  // a block moved by its grip: the second to-do dropped on the upper half of the first
  const blockAt = i => ed.locator('.nb-blocks .nb-block').nth(i);
  await blockAt(2).hover();
  await blockAt(2).locator('.nb-grip').dragTo(blockAt(1), { targetPosition: { x: 80, y: 3 } });
  const blockMoved = await waitFile(parentId, t => t.includes('- [ ] second to-do\n- [ ] first to-do'));
  check('a block dragged by its grip onto the top of another moves there in the file, the rest as they were', blockMoved && bodyOf(parentId) === 'W3 parent page\nThe aim: read the chapter.\n\n- [ ] second to-do\n- [ ] first to-do', JSON.stringify(bodyOf(parentId)));
  await page.waitForFunction(() => /second to-do/.test(document.querySelectorAll('.pane-notebook .nb-blocks .nb-block')[1]?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  // one block written at a time, as its Markdown
  const shiftBefore = await page.evaluate(() => { const bl = [...document.querySelectorAll('.pane-notebook .nb-blocks .nb-block')]; const r = e => e.getBoundingClientRect(); return { left: r(bl[0].querySelector('.nb-block-body > *')).left, top: r(bl[0].querySelector('.nb-block-body > *')).top, next: r(bl[1]).top }; });
  await blockAt(0).locator('.nb-block-body').click();
  await typing();
  const shiftAfter = await page.evaluate(() => { const ta = document.querySelector('.pane-notebook textarea.nb-block-input'); const cs = getComputedStyle(ta); const r = ta.getBoundingClientRect(); const next = document.querySelectorAll('.pane-notebook .nb-blocks .nb-block')[1].getBoundingClientRect().top; return { left: r.left + parseFloat(cs.paddingLeft), top: r.top + parseFloat(cs.paddingTop), next, border: cs.borderTopWidth + ' ' + cs.borderLeftWidth, bg: cs.backgroundColor, shadow: cs.boxShadow }; });
  check('a block being written has no border or box, and no text moves by a pixel (note 6ed1)', shiftAfter.border === '0px 0px' && shiftAfter.bg === 'rgba(0, 0, 0, 0)' && shiftAfter.shadow === 'none' && Math.abs(shiftAfter.left - shiftBefore.left) <= 1 && Math.abs(shiftAfter.top - shiftBefore.top) <= 1 && Math.abs(shiftAfter.next - shiftBefore.next) <= 1, JSON.stringify({ shiftBefore, shiftAfter }));
  await page.screenshot({ path: shots + '1440-notebook-a-block-being-written.png' });
  check('a click writes in that block alone, as its Markdown', (await ed.locator('textarea.nb-block-input').inputValue()) === 'The aim: read the chapter.' && await ed.locator('textarea').count() === 1);
  await page.keyboard.type(' Then the psalm.');
  await done();
  check('what is written in a block is saved in its place in the file', await waitFile(parentId, t => t.includes('W3 parent page\nThe aim: read the chapter. Then the psalm.\n\n- [ ] second to-do')), JSON.stringify(bodyOf(parentId)));
  // Enter at a to-do's end: the next to-do, its own block; its box ticks it in the file
  await blockAt(2).locator('.nb-todo-text').click();
  await typing();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.pane-notebook textarea.nb-block-input')?.value === '- [ ] ', null, { timeout: 10000 }).catch(() => {});
  const goesOn = await ed.locator('textarea.nb-block-input').inputValue().catch(() => '');
  await page.keyboard.type('third to-do');
  await done();
  check('Enter at a to-do’s end starts the next to-do, a block of its own', goesOn === '- [ ] ' && await waitFile(parentId, t => t.includes('- [ ] first to-do\n- [ ] third to-do')), JSON.stringify(goesOn));
  await page.waitForFunction(() => document.querySelectorAll('.pane-notebook .nb-blocks .nb-block').length === 4, null, { timeout: 10000 }).catch(() => {});
  await blockAt(3).locator('.nb-todo input').click();
  check('a to-do’s box ticks it in the file', await waitFile(parentId, t => t.includes('- [x] third to-do')));
  // the / menu: the ten blocks of sheet W2; Page inside this one makes the page and writes [[its title]] there
  await sleep(500);
  await ed.locator('.nb-block-add').click();
  await typing();
  await page.keyboard.type('/');
  await page.locator('.nb-blockmenu .nb-blockmenu-row').first().waitFor({ timeout: 5000 });
  const menuRows = await page.locator('.nb-blockmenu .nb-blockmenu-label').allTextContents();
  check('/ in an empty block opens the block menu, as on sheet W2', menuRows.join(', ') === 'Question, Thread, Word, Scripture, Heading, List, To-do, Quote, Divider, Table, Link to a page, Page inside this one, View', menuRows.join(', '));
  await page.screenshot({ path: shots + '1440-notebook-block-menu.png' });
  await page.keyboard.type('inside');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.pane-notebook textarea.nb-block-input.asking'), null, { timeout: 5000 }).catch(() => {});
  await page.keyboard.type('W3 inside by slash');
  await page.keyboard.press('Enter');
  const linked = await waitFile(parentId, t => t.includes('[[W3 inside by slash]]'));
  const slashId = treeNow().pages.find(r => r.id === parentId)?.children.find(c => c.title === 'W3 inside by slash')?.id;
  check('Page inside this one makes the page inside, and writes [[its title]] where the menu was opened', linked && !!slashId, JSON.stringify(bodyOf(parentId)));
  // C2: a Quote added from / and left empty is not written; clicking away leaves the file as it was
  const beforeQuote = bodyOf(parentId);
  await page.waitForFunction(() => document.querySelectorAll('.pane-notebook .nb-blocks .nb-block').length === 5, null, { timeout: 10000 }).catch(() => {});
  await ed.locator('.nb-block-add').click();
  await typing();
  await page.keyboard.type('/quote');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.pane-notebook textarea.nb-block-input')?.value === '> ', null, { timeout: 5000 }).catch(() => {});
  const quoteBox = await ed.locator('textarea.nb-block-input').inputValue().catch(() => '');
  await sleep(900); // past the autosave
  await ed.locator('.nb-ed-head').click({ position: { x: 4, y: 4 } });
  await page.waitForFunction(() => !document.querySelector('.pane-notebook textarea.nb-block-input'), null, { timeout: 5000 }).catch(() => {});
  await sleep(500);
  check('a Quote added from / and left empty writes nothing: clicking away leaves the file as it was', quoteBox === '> ' && bodyOf(parentId) === beforeQuote, `${JSON.stringify(quoteBox)}; ${JSON.stringify(bodyOf(parentId))}`);
  // the files read back: the page's text is what was written, block by block; the pages inside name it
  const parentText = 'W3 parent page\nThe aim: read the chapter. Then the psalm.\n\n- [ ] second to-do\n- [ ] first to-do\n- [x] third to-do\n\n[[W3 inside by slash]]';
  const pageBlocks = JSON.parse(execFileSync(wbExe, ['page', 'blocks', parentId], { env }).toString()).blocks.map(b => b.kind).join();
  check('the page’s file reads back as written, and wb page blocks reads it as the window drew it', bodyOf(parentId) === parentText && pageBlocks === 'paragraph,todo,todo,todo,paragraph', `${JSON.stringify(bodyOf(parentId))}; ${pageBlocks}`);
  // Pin from the page's ⋯: its place in Pinned, in the page itself
  await page.waitForFunction(() => document.querySelectorAll('.pane-notebook .nb-blocks .nb-block').length === 5, null, { timeout: 10000 }).catch(() => {});
  await ed.locator('.nb-ed-head .icon-btn').click();
  await page.locator('.menu .menu-item', { hasText: /^Pin$/ }).click();
  const pinnedNow = await waitFile(parentId, t => /\npinned: 1\n/.test(t));
  await page.locator('.pane-notebook .nb-pinned .nb-tree-row', { hasText: 'W3 parent page' }).waitFor({ timeout: 10000 }).catch(() => {});
  check('Pin in a page’s ⋯ puts it in Pinned: pinned: 1 in its file', pinnedNow && await page.locator('.pane-notebook .nb-pinned .nb-tree-row', { hasText: 'W3 parent page' }).count() === 1);
  await page.screenshot({ path: shots + '1440-notebook-sidebar-pages.png' });
  // the Python app: a page inside a page, given a place, is a note it reads; it keeps parent when it writes the note
  execFileSync(wbExe, ['note', 'place', childId, 'Num 25:11'], { env });
  const OLD = path.join(os.homedir(), 'github', 'bible-workbench');
  const py = code => execFileSync('python', ['-c', `import json, sys\nfrom workbench.study import Study\ns = Study(sys.argv[1])\nn = ([x for x in s.notes() if x['id'] == sys.argv[2]] or [None])[0]\n${code}`, study, childId], { cwd: OLD, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString();
  const pyNote = JSON.parse(py('print(json.dumps(n))'));
  check('the Python app reads a placed page that carries parent: a note on its verse, parent and order with it', pyNote?.anchor === 'NUM.25:11' && pyNote?.parent === parentId && String(pyNote?.order) === '1', JSON.stringify(pyNote && { anchor: pyNote.anchor, parent: pyNote.parent, order: pyNote.order }));
  py(`s.update_note(n['id'], n['text'] + '\\n\\nWritten by the Python app.')`);
  const afterPy = readFileSync(fileOf(childId), 'utf8');
  check('a page the Python app writes keeps its parent, and stays inside its page', afterPy.includes('Written by the Python app.') && afterPy.includes(parentId) && treeNow().pages.find(r => r.id === parentId)?.children.some(c => c.id === childId));

  // W4, scripture blocks and the verse card (sheets W3, W5.1, W5.2, W1.2). Every verse expected here comes from the
  // database (wb text, wb interlinear); a page's file holds only the references.
  const wbj = (...a) => JSON.parse(execFileSync(wbExe, a, { env }).toString());
  // (a debug build can take longer than waitFile's 6 s to write and draw)
  const waitLong = async (id, test) => { for (let i = 0; i < 200; i++) { const f = fileOf(id); if (f && test(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'))) return true; await sleep(100); } return false; };
  const textOf = (ref, ver = 'KJV') => wbj('text', ref, '--version', ver, '--json').verses.map(v => v.text);
  const w4 = wbj('page', 'new', 'W4 the passage').id;
  execFileSync(wbExe, ['block', 'add', w4, '-'], { env, input: '```scripture\nNum 25:10-13\n```' });
  execFileSync(wbExe, ['block', 'add', w4, 'Then the psalm, a verse to a line:'], { env });
  execFileSync(wbExe, ['block', 'add', w4, '-'], { env, input: '```scripture\nPs 106:28-31\nlines\n```' });
  execFileSync(wbExe, ['block', 'add', w4, 'Phinehas is named at Num 25:11; then Ps 106:30.'], { env });
  // the tree redraws on changed(); one made while another redraw is reading can be passed over, so ask again until it shows
  for (let i = 0; i < 20 && !(await rowOf(w4).count()); i++) { await page.evaluate(() => window.__wb.changed()); await sleep(500); }
  await rowOf(w4).locator('.nb-tree-open').click();
  await ed.locator('.nb-title', { hasText: 'W4 the passage' }).waitFor({ timeout: 10000 });
  const sblock = i => ed.locator('.nb-blocks .sv-block').nth(i);
  const drawnVerses = i => sblock(i).locator('.sv-verse .sv-t').allTextContents();
  const waitVerses = (i, want) => page.waitForFunction(([i, want]) => { const b = document.querySelectorAll('.pane-notebook .nb-blocks .sv-block')[i]; return !!b && JSON.stringify([...b.querySelectorAll('.sv-verse .sv-t')].map(e => e.textContent)) === JSON.stringify(want); }, [i, want], { timeout: 10000 }).then(() => true, () => false);
  const num = textOf('Num 25:10-13'), ps = textOf('Ps 106:28-31');
  const okPara = await waitVerses(0, num);
  check('a scripture block draws its verses from the Bible, each equal to wb text (KJV, as a paragraph)', okPara && await sblock(0).locator('.sv-para .sv-p').count() === 1 && (await sblock(0).locator('.sv-ref').textContent()) === 'Numbers 25:10–13', JSON.stringify(await drawnVerses(0)).slice(0, 120));
  check('a block with lines draws a verse to a line, each equal to wb text', await waitVerses(1, ps) && await sblock(1).locator('.sv-lines .sv-p').count() === ps.length);
  const marked = wbj('scripture', 'Num 25:10-13').verses.flatMap(v => v.runs.filter(r => r.hl).map(r => `${r.hl}:${r.t}`));
  const drawnMarks = await sblock(0).locator('.sv-hl').evaluateAll(els => els.map(e => e.textContent));
  check('the person’s highlights are on the words, as wb scripture gives them', JSON.stringify(drawnMarks) === JSON.stringify(marked.map(m => m.slice(m.indexOf(':') + 1))), `${drawnMarks.length} marked runs`);
  const noVerse = body => ![...num, ...ps].some(t => body.includes(t.slice(0, 30)));
  check('the page’s file holds the fenced references and no verse text', bodyOf(w4).includes('```scripture\nNum 25:10-13\n```') && bodyOf(w4).includes('```scripture\nPs 106:28-31\nlines\n```') && noVerse(bodyOf(w4)), JSON.stringify(bodyOf(w4)));
  await page.screenshot({ path: shots + '1440-notebook-scripture-blocks.png' });
  // Paragraph | Lines and YLT: kept in the block's fence, the verses drawn again
  // (the page drawn again once its new blocks are read: the click waits for that drawing)
  await sleep(1200);
  await sblock(0).locator('.sv-seg button', { hasText: 'Lines' }).click();
  const linesKept = await waitLong(w4, t => t.includes('```scripture\nNum 25:10-13\nlines\n```'));
  await page.waitForFunction(() => document.querySelector('.pane-notebook .nb-blocks .sv-block')?.querySelector('.sv-lines'), null, { timeout: 10000 }).catch(() => {});
  check('Lines puts each verse on its own line, and the choice is kept in the fence', linesKept && await sblock(0).locator('.sv-lines .sv-p').count() === num.length);
  await sblock(0).locator('.sv-ylt').click();
  const yltKept = await waitLong(w4, t => t.includes('```scripture\nNum 25:10-13\nlines\nylt\n```'));
  const numYlt = textOf('Num 25:10-13', 'YLT');
  check('YLT switches the version: the verses equal wb text --version ylt, kept in the fence', yltKept && await waitVerses(0, numYlt) && (await sblock(0).locator('.sv-ver').textContent()).includes('YLT'));
  await sblock(0).locator('.sv-seg button', { hasText: 'Paragraph' }).click();
  await waitLong(w4, t => t.includes('```scripture\nNum 25:10-13\nylt\n```'));
  await page.waitForFunction(() => document.querySelector('.pane-notebook .nb-blocks .sv-block')?.querySelector('.sv-para'), null, { timeout: 10000 }).catch(() => {});
  await sblock(0).locator('.sv-ylt').click();
  check('Paragraph and KJV again: the fence holds only the reference, the verses as wb text', await waitLong(w4, t => t.includes('```scripture\nNum 25:10-13\n```')) && await waitVerses(0, num) && noVerse(bodyOf(w4)));
  // Open ▾: one menu, In the reader (the ticked one, a plain click) or In a new reader (Ctrl+click)
  await page.evaluate(() => window.__wb.run('go John 3'));
  await page.waitForFunction(() => document.querySelector('#place .place-label')?.textContent === 'John 3', null, { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('.pane-notebook .nb-blocks .sv-block .sv-open'), null, { timeout: 10000 }).catch(() => {});
  await sblock(0).locator('.sv-open .open-split-more').click();
  await page.locator('.open-menu .open-row').first().waitFor({ timeout: 5000 });
  const rowsTxt = await page.locator('.open-menu .open-row-label').allTextContents();
  const ticked = await page.locator('.open-menu .open-row.on').getAttribute('data-where');
  const keys = await page.locator('.open-menu .open-row-key').allTextContents();
  check('Open ▾ asks where: In the reader (ticked: a plain click) or In a new reader (Ctrl+click)', rowsTxt.join() === 'In the reader,In a new reader' && ticked === 'reader' && keys.join() === 'Click,Ctrl+click', `${rowsTxt} · ${ticked} · ${keys}`);
  await page.screenshot({ path: shots + '1440-notebook-open-menu.png' });
  await page.locator('.open-menu .open-row', { hasText: 'In the reader' }).click();
  const wentThere = await page.waitForFunction(() => document.querySelector('#place .place-label')?.textContent === 'Numbers 25', null, { timeout: 10000 }).then(() => true, () => false);
  await page.locator('#reader').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Alt+ArrowLeft');
  const backAgain = await page.waitForFunction(() => document.querySelector('#place .place-label')?.textContent === 'John 3', null, { timeout: 10000 }).then(() => true, () => false);
  check('In the reader moves the reader there, and Back returns it', wentThere && backAgain);
  const r2Before = await page.locator('.pane-reader2').count();
  await sblock(0).locator('.sv-open .open-split-go').click({ modifiers: ['Control'] });
  const newReader = await page.waitForFunction(n => document.querySelectorAll('.pane-reader2').length > n, r2Before, { timeout: 10000 }).then(() => true, () => false);
  check('Ctrl+click on Open opens a new reader, and the reader stays', newReader && (await page.locator('#place .place-label').textContent()) === 'John 3');
  // (a reader opened from the Notebook opens in its column, in front: the Notebook is brought back)
  await page.evaluate(() => window.__wb.run('notebook'));
  await sleep(400);
  // the setting: Places open in… a new reader; a plain click then opens a new reader
  await page.locator('.pane-notebook .nb-head .nb-more').first().click();
  await page.locator('.nb-settings select.nb-set-open').selectOption('new');
  const keptNew = await (async () => { for (let i = 0; i < 50; i++) { try { if (JSON.parse(readFileSync(path.join(study, 'settings', 'notebook.json'), 'utf8')).places === 'new') return true; } catch { /* not yet */ } await sleep(100); } return false; })();
  await page.keyboard.press('Escape');
  await sleep(500);
  const r2Mid = await page.locator('.pane-reader2').count();
  await page.waitForFunction(() => document.querySelector('.pane-notebook .nb-blocks .sv-block .sv-open'), null, { timeout: 10000 }).catch(() => {});
  await sblock(1).locator('.sv-open .open-split-go').click();
  const plainNew = await page.waitForFunction(n => document.querySelectorAll('.pane-reader2').length > n, r2Mid, { timeout: 10000 }).then(() => true, () => false);
  check('Places open in… a new reader is kept in settings/notebook.json, and a plain click then opens a new reader; the reader stays', keptNew && plainNew && (await page.locator('#place .place-label').textContent()) === 'John 3' && wbj('settings', 'notebook').places === 'new');
  await page.evaluate(() => window.__wb.run('notebook'));
  await sleep(400);
  await page.locator('.pane-notebook .nb-head .nb-more').first().click();
  await page.locator('.nb-settings select.nb-set-open').selectOption('reader');
  await sleep(400);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__wb.run('go Num 25'));
  await page.waitForFunction(() => document.querySelector('#place .place-label')?.textContent === 'Numbers 25', null, { timeout: 10000 }).catch(() => {});
  // At the readers: the reader first, then a row for each second reader, each that chapter's notes
  await page.evaluate(() => window.__wb.changed());
  const seconds = await page.evaluate(() => window.__wb.dock().panes.filter(p => p.kind === 'reader2').length);
  await page.waitForFunction(n => document.querySelectorAll('.pane-notebook .nb-reader-row').length === n && document.querySelector('.pane-notebook .nb-reader-row .nb-tree-title')?.textContent === 'Numbers 25', 1 + seconds, { timeout: 10000 }).catch(() => {});
  const readerRows = await page.locator('.pane-notebook .nb-reader-row .nb-tree-title').allTextContents();
  const notesFor = ch => wbj('notebook', '--group', 'chapter', '--at', ch).groups[0]?.count ?? 0;
  const psRow = page.locator('.pane-notebook .nb-reader-row.second', { hasText: 'Psalms 106' }).first();
  check('At the readers: a row for the reader, then one for each second reader', readerRows.length === 1 + seconds && readerRows[0] === 'Numbers 25' && await psRow.count() === 1 && (await page.locator('.pane-notebook .nb-side-head[data-part="reader"] .nb-glabel').textContent()) === 'At the readers', readerRows.join(', '));
  await psRow.click();
  await ed.locator('.nb-title', { hasText: 'Psalms 106' }).waitFor({ timeout: 10000 }).catch(() => {});
  check('a second reader’s row lists that chapter’s notes in the main column, and moves no reader', (await ed.locator('.nb-list-which').textContent()).startsWith('in the new reader') && await ed.locator('.nb-main-list .nb-item').count() === notesFor('Ps 106') && (await page.locator('#place .place-label').textContent()) === 'Numbers 25');
  await page.screenshot({ path: shots + '1440-notebook-at-the-readers.png' });
  // R1 (findings 38c2, 7d00, d84d): a thread is a page; its places are blocks on it, read from the Bible, under its note
  const s5Refs = ['Num 25:11', 'Rom 10:2', 'Psa 69:9'];
  execFileSync(wbExe, ['thread', 'add-many', 'S5 trial', ...s5Refs], { env });
  execFileSync(wbExe, ['thread', 'write', 'S5 trial', 'S5 a note on the trial thread'], { env });
  execFileSync(wbExe, ['block', 'add', 'thread:s5-trial', 'Where I start reading.'], { env });
  await sleep(1300); // the window reads the folder again at most once a second
  await page.evaluate(() => window.__wb.changed());
  await page.locator('.pane-notebook .nb-tree-row', { hasText: 'S5 trial' }).first().locator('.nb-tree-open').click();
  await ed.locator('.nb-title', { hasText: 'S5 trial' }).waitFor({ timeout: 10000 });
  await ed.locator('.nb-thread-places .member').nth(2).waitFor({ timeout: 10000 }).catch(() => {});
  const placeRows = await ed.locator('.nb-thread-places .member').evaluateAll(els => els.map(e => ({ ref: e.querySelector('.ref-link')?.textContent, quote: e.querySelector('.scripture-row')?.textContent })));
  const squash5 = s => s.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  const fromWb = s5Refs.map(r => wbj('text', r, '--json').verses[0]);
  check('a thread with 3 places, a note and 1 page on it: its note as a block, 3 places, 1 page', await ed.locator('.nb-body .nb-block').count() === 1 && placeRows.length === 3 && await ed.locator('.nb-places-row .label').textContent() === 'Places · 3' && await ed.locator('.nb-inside .nb-linked-row').count() === 1, JSON.stringify(placeRows.map(r => r.ref)));
  check('each place is the Bible’s verse word for word with its reference (wb text); the thread’s file is the Python app’s', placeRows.every((r, i) => r.ref === fromWb[i].ref && squash5(r.quote) === squash5(fromWb[i].text)) && JSON.stringify(wbj('thread', 'show', 'S5 trial').members.map(m => m.anchor)) === JSON.stringify(['NUM.25:11', 'ROM.10:2', 'PSA.69:9']) && !/pinned|parent|order|kind/.test(readFileSync(path.join(study, 'threads', 's5-trial.md'), 'utf8').split('---')[1]));
  await page.screenshot({ path: shots + '1440-a-thread-as-a-page.png' });
  await ed.locator('.nb-thread-places .member .ref-link').first().click();
  check('a click on a place opens the verse card', await page.locator('.verse-card').first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.keyboard.press('Escape');
  // its places are put in order by the grip: one write, the thread's file
  const dnd = async (from, to) => {
    const a = await from.boundingBox(), b = await to.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(a.x + (b.x - a.x) * k / 8, a.y + (b.y - a.y) * k / 8 + 4);
    await page.mouse.up();
  };
  execFileSync(wbExe, ['thread', 'pin', 'S5 trial'], { env });
  await sleep(1300); // the window reads the folder again at most once a second
  await page.evaluate(() => window.__wb.changed());
  await page.locator('.pane-notebook .nb-pinned .nb-tree-row', { hasText: 'S5 trial' }).waitFor({ timeout: 10000 }).catch(() => {});
  check('a thread can be pinned: it is in Pinned, kept in settings/pages.json and not in its file', await page.locator('.pane-notebook .nb-pinned .nb-tree-row', { hasText: 'S5 trial' }).count() === 1 && JSON.parse(readFileSync(path.join(study, 'settings', 'pages.json'), 'utf8')).pinned['s5-trial'] >= 1, JSON.stringify({ row: await page.locator('.pane-notebook .nb-pinned .nb-tree-row').count(), file: readFileSync(path.join(study, 'settings', 'pages.json'), 'utf8') }));
  execFileSync(wbExe, ['thread', 'unpin', 'S5 trial'], { env });

  // R1: the three new blocks, a question answered, and the Questions list (sheets R1.3 to R1.5)
  const r1 = wbj('page', 'new', 'R1 lesson page');
  execFileSync(wbExe, ['thread', 'add-many', 'R1 zeal', 'Num 25:11', 'Rom 10:2'], { env });
  execFileSync(wbExe, ['note', 'place', r1.id, 'Num 25:9'], { env });
  await page.evaluate(() => window.__wb.changed());
  execFileSync(wbExe, ['block', 'add', r1.id, '```thread\nr1-zeal\n```'], { env });
  execFileSync(wbExe, ['block', 'add', r1.id, '```word\nH7065\n```'], { env });
  execFileSync(wbExe, ['question', 'add', r1.id, 'How do the two numbers relate?'], { env });
  await sleep(1300);
  await page.evaluate(() => window.__wb.changed());
  await sleep(1200);
  await page.evaluate(id => window.__wb.note(id), r1.id);
  await ed.locator('.nb-threadblock').waitFor({ timeout: 10000 }).catch(() => {});
  const tb = await ed.locator('.nb-threadblock').first().textContent().catch(() => '');
  check('a thread block shows the thread (name, places, references) and holds only its id', /R1 zeal/.test(tb) && /2 places/.test(tb) && /Numbers 25:11/.test(tb), tb);
  await ed.locator('.nb-wordblock .nbw-lemma').waitFor({ timeout: 10000 }).catch(() => {});
  const lex = wbj('strong', 'H7065');
  check('a word block shows the lexicon’s entry for its number (the file holds only H7065)', (await ed.locator('.nb-wordblock .nbw-def').textContent().catch(() => '')) === lex.definition.replace(/\[\[([HG]\d+)\]\]/g, '$1') || (await ed.locator('.nb-wordblock .nbw-def').count()) === 1, lex.definition);
  const qb = ed.locator('.nb-questionblock').first();
  await qb.waitFor({ timeout: 10000 });
  check('a question block shows ? and Mark answered', (await qb.locator('.nbq-mark').textContent()) === '?' && /Mark answered/.test(await qb.textContent()));
  await ed.getByRole('button', { name: 'Mark answered' }).click();
  await ed.locator('.nb-questionblock.done').waitFor({ timeout: 10000 }).catch(() => {});
  check('Mark answered turns the callout’s mark: > [!done] in the page’s file', /> \[!done\] How do the two numbers relate\?/.test(wbj('note', 'show', r1.id).text) && await ed.locator('.nb-questionblock.done').count() === 1);
  await ed.getByRole('button', { name: 'Answered' }).click();
  await sleep(900);
  await page.screenshot({ path: shots + '1440-three-new-blocks.png' });
  check('the Questions list holds it, with the reader’s ? on its verse', wbj('questions').questions.some(q => q.id === `${r1.id}#3` && q.status === 'open') && wbj('reader', 'NUM', '25').questions.some(q => q.v === 9));
  // / then ? writes a question block: the menu narrows to it
  await ed.locator('.nb-block-add').click();
  await page.keyboard.type('/?');
  const menuRow = page.locator('.nb-blockmenu .nb-blockmenu-row[data-key="question"]');
  check('/? in a new block offers Question first', await menuRow.waitFor({ timeout: 5000 }).then(() => true, () => false) && await page.locator('.nb-blockmenu .nb-blockmenu-row').count() === 1);
  await page.keyboard.press('Enter');
  await page.keyboard.type('Is a second question kept?');
  await done();
  check('and the question is a callout line in the page', /> \[!question\] Is a second question kept\?/.test(wbj('note', 'show', r1.id).text), wbj('note', 'show', r1.id).text.split('\n').slice(-2).join(' | '));
  execFileSync(wbExe, ['thread', 'delete', 'R1 zeal'], { env });
  execFileSync(wbExe, ['thread', 'delete', 'S5 trial'], { env });
  await page.evaluate(() => window.__wb.changed());
  await sleep(500);
  // the verse card: a reference in a note opens the verse at the link
  await rowOf(w4).locator('.nb-tree-open').click();
  await ed.locator('.nb-title', { hasText: 'W4 the passage' }).waitFor({ timeout: 10000 });
  const v11 = textOf('Num 25:11');
  await ed.locator('a.ref', { hasText: 'Num 25:11' }).click();
  await page.locator('.verse-card .sv-t').first().waitFor({ timeout: 10000 });
  check('a reference in a note opens the card: the verse equal to wb text, with its reference and version', JSON.stringify(await page.locator('.verse-card .sv-t').allTextContents()) === JSON.stringify(v11) && (await page.locator('.verse-card .vc-ref').textContent()) === 'Numbers 25:11' && (await page.locator('.verse-card .vc-ver').textContent()).includes('KJV') && (await page.locator('#place .place-label').textContent()) === 'Numbers 25');
  await page.screenshot({ path: shots + '1440-verse-card.png' });
  const il = wbj('interlinear', 'Num 25:11').verses[0].words;
  await page.locator('.verse-card .vc-tab-interlinear').click();
  await page.locator('.verse-card .vc-word').first().waitFor({ timeout: 10000 });
  const glosses = await page.locator('.verse-card .vc-word .inter-gloss').allTextContents();
  check('Interlinear shows the verse word by word, as wb interlinear', JSON.stringify(glosses) === JSON.stringify(il.map(w => w.gloss || '')) && (await page.locator('.verse-card .vc-shown').textContent()) === `${il.length} of ${il.length} words shown`, `${glosses.length} of ${il.length}`);
  await page.locator('.verse-card .vc-word').nth(1).locator('.vc-away').click();
  await page.locator('.verse-card .vc-word').nth(1).locator('.vc-away').click();
  const shownNow = await page.locator('.verse-card .vc-word').count();
  const awayNames = await page.locator('.verse-card .vc-back').allTextContents();
  check('− puts a word away: it waits in the put-away row, in its order', shownNow === il.length - 2 && JSON.stringify(awayNames) === JSON.stringify([il[1], il[2]].map(w => `${w.gloss} +`)) && (await page.locator('.verse-card .vc-shown').textContent()) === `${il.length - 2} of ${il.length} words shown`, awayNames.join(' · '));
  await page.screenshot({ path: shots + '1440-verse-card-interlinear.png' });
  await page.locator('.verse-card .vc-back').first().click();
  check('a click on a word put away brings it back', await page.locator('.verse-card .vc-word').count() === il.length - 1 && await page.locator('.verse-card .vc-back').count() === 1);
  await page.locator('.verse-card .vc-close').click();
  await ed.locator('a.ref', { hasText: 'Num 25:11' }).click();
  await page.locator('.verse-card .vc-tab-interlinear').click();
  await page.locator('.verse-card .vc-word').first().waitFor({ timeout: 10000 });
  check('the words put away stay put away when the card opens again (this computer only)', await page.locator('.verse-card .vc-word').count() === il.length - 1 && JSON.stringify(await page.locator('.verse-card .vc-back').allTextContents()) === JSON.stringify([`${il[2].gloss} +`]));
  await page.locator('.verse-card .vc-show-all').click();
  check('Show all brings every word back', await page.locator('.verse-card .vc-word').count() === il.length && await page.locator('.verse-card .vc-back').count() === 0);
  await page.locator('.verse-card .vc-put-all').click();
  check('Put all away puts every word away', await page.locator('.verse-card .vc-word').count() === 0 && await page.locator('.verse-card .vc-back').count() === il.length);
  await page.locator('.verse-card .vc-show-all').click();
  const strongNums = [...new Set(il.map(w => w.strong).filter(Boolean))];
  await page.locator('.verse-card .vc-tab-concordance').click();
  await page.locator('.verse-card .vc-strong').first().waitFor({ timeout: 10000 }).catch(() => {});
  const shownStrongs = await page.locator('.verse-card .vc-strong').evaluateAll(els => els.map(e => e.dataset.strong));
  check('In the Concordance lists the verse’s entries, in the order their words come', JSON.stringify(shownStrongs) === JSON.stringify(strongNums), shownStrongs.join(' '));
  await page.locator('.verse-card .vc-tab-definitions').click();
  check('Definitions no longer says it waits for tier 7', !/tier 7/.test(await page.locator('.verse-card .vc-defs').first().textContent()));
  await page.locator('.verse-card .vc-open .open-split-more').click();
  check('the card’s Open the chapter ▾ is the same menu', (await page.locator('.open-menu .open-row-label').allTextContents()).join() === 'In the reader,In a new reader' && /Numbers 25, at verse 11/.test(await page.locator('.open-menu-head').textContent()));
  await page.keyboard.press('Escape');
  await page.locator('.verse-card .vc-float').click();
  await page.locator('.pane-versecard .sv-t').first().waitFor({ timeout: 10000 }).catch(() => {});
  check('Float keeps the card as a floating pane of its own', await page.locator('.verse-card').count() === 0 && JSON.stringify(await page.locator('.pane-versecard .sv-t').allTextContents()) === JSON.stringify(v11));
  const vcPane = await page.evaluate(() => window.__wb.dock().panes.find(p => p.kind === 'versecard')?.id);
  if (vcPane) await page.evaluate(id => { const d = window.__wb.dock(); d.close(d.panes.find(p => p.id === id)); }, vcPane);
  for (const p of await page.evaluate(() => window.__wb.dock().panes.filter(p => p.kind === 'reader2').map(p => p.id))) await page.evaluate(id => { const d = window.__wb.dock(); d.close(d.panes.find(p => p.id === id)); }, p);
  check('no file holds scripture text: the page’s file has only its references', noVerse(bodyOf(w4)) && !noVerse(num.join(' ')));
  await page.evaluate(() => window.__wb.run('notebook'));
  await sleep(400);

  // W5, views and templates (sheets W4, W6.1, W6.2, W6.3). A view's rows are wb view run's for the same line, in a page
  // and in the command field; views never write. The Notebook starts with no templates (the person's choice,
  // 2026-11-07). Verses expected here come from the database (wb text).
  const ids = rows => rows.map(r => r.id).join();
  const filesNow = () => { const out = {}; const walk = d => { for (const n of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, n.name); if (n.isDirectory()) { if (n.name !== 'sessions') walk(p); } else out[p] = readFileSync(p, 'utf8'); } }; walk(study); return JSON.stringify(out); };
  const viewRowsIn = sel => page.locator(`${sel} .nbv-row`).evaluateAll(els => els.map(e => e.dataset.id).join());
  const waitRows = (sel, want) => page.waitForFunction(([sel, want]) => [...document.querySelectorAll(`${sel} .nbv-row`)].map(e => e.dataset.id).join() === want, [sel, want], { timeout: 20000 }).then(() => true, () => false);
  await page.locator('.pane-notebook .nb-side-templates').waitFor({ timeout: 10000 }).catch(() => {});
  check('the Notebook starts with no templates: wb template list is empty, and Pages has no Templates section', wbj('template', 'list').templates.length === 0 && await page.locator('.pane-notebook .nb-side-head[data-part="templates"]').count() === 0 && await page.locator('.pane-notebook .nb-side-templates').count() === 1);
  // a view in a page: the same rows as wb view run, and nothing written by drawing it
  const vLine = 'notebook @Num 25 questions';
  const w5 = wbj('page', 'new', 'W5 questions for the group').id;
  execFileSync(wbExe, ['block', 'add', w5, 'The group’s questions, then mine at Numbers 25:'], { env });
  execFileSync(wbExe, ['block', 'add', w5, '-'], { env, input: '```view\n' + vLine + '\n```' });
  execFileSync(wbExe, ['block', 'add', w5, '# From the group'], { env });
  const vRun = wbj('view', 'run', vLine);
  // (a page written from outside the window: the Notebook is drawn again until its row is in the tree)
  for (let i = 0; i < 6 && !(await rowOf(w5).count()); i++) {
    await page.evaluate(() => window.__wb.run('notebook'));
    await page.evaluate(() => window.__wb.changed());
    await rowOf(w5).waitFor({ timeout: 5000 }).catch(() => {});
  }
  if (!(await rowOf(w5).count())) await page.screenshot({ path: shots + 'debug-w5-tree.png' });
  await rowOf(w5).locator('.nb-tree-open').click();
  await ed.locator('.nb-title', { hasText: 'W5 questions for the group' }).waitFor({ timeout: 10000 });
  const viewBefore = filesNow();
  const inPage = await waitRows('.pane-notebook .nb-blocks .nb-view', ids(vRun.rows));
  check('a view lists what its line finds: the same rows, in the same order, as wb view run', inPage && vRun.count > 0 && (await ed.locator('.nb-view .nbv-count').textContent()) === `${vRun.count} found` && (await ed.locator('.nb-view .nbv-line').textContent()) === vLine, `${vRun.count} rows`);
  const qRows = await ed.locator('.nb-view .nbv-row.is-question .nbv-q').count();
  const pills = await ed.locator('.nb-view .nbv-row .pill').allTextContents();
  check('its rows read as the Notebook’s: a question’s ?, the title, its place', qRows === vRun.rows.filter(r => r.kind === 'question').length && JSON.stringify(pills) === JSON.stringify(vRun.rows.map(r => r.label)), pills.join(' · '));
  await page.screenshot({ path: shots + '1440-notebook-a-view.png' });
  await sleep(800);
  check('a view writes nothing: the study folder is the same after it is drawn', filesNow() === viewBefore);
  // the command field: the same line lists the same rows
  await page.evaluate(l => window.__wb.run(l), vLine);
  const inField = await waitRows('.pane-notebook .nb-viewlist', ids(vRun.rows));
  check('the command field: notebook @Num 25 questions lists the same rows as the view and wb view run', inField && (await page.locator('.pane-notebook .nb-viewlist .nbv-count').textContent()) === `${vRun.count} found`);
  await page.screenshot({ path: shots + '1440-notebook-a-view-from-the-command-field.png' });
  // a row opens its note; Back returns to the list
  const vFirst = vRun.rows[0];
  await page.locator('.pane-notebook .nb-viewlist .nbv-row').first().click();
  await ed.locator('.nb-title', { hasText: vFirst.title.slice(0, 20) }).waitFor({ timeout: 10000 }).catch(() => {});
  const opened = (await ed.locator('.nb-title').textContent()).startsWith(vFirst.title.slice(0, 20));
  await ed.locator('.nb-back', { hasText: 'The view' }).click();
  check('a view’s row opens its note, and Back returns to the view', opened && await waitRows('.pane-notebook .nb-viewlist', ids(vRun.rows)));
  // the line edited in place: the fence in the file and the rows change
  await rowOf(w5).locator('.nb-tree-open').click();
  await ed.locator('.nb-title', { hasText: 'W5 questions for the group' }).waitFor({ timeout: 10000 });
  await waitRows('.pane-notebook .nb-blocks .nb-view', ids(vRun.rows));
  await ed.locator('.nb-view .nbv-line').click();
  // (the line opens the block's card: View command, then Save block)
  await ed.locator('.nb-structured-editor .nb-card-input').fill('notebook @Num 25:1-9 open');
  await ed.locator('.nb-structured-editor button', { hasText: 'Save block' }).click();
  const lineKept = await waitLong(w5, t => t.includes('```view\nnotebook @Num 25:1-9 open\n```'));
  const vOpen = wbj('view', 'run', 'notebook @Num 25:1-9 open');
  check('the line edited in place is written in the fence, and the rows are what the new line finds', lineKept && await waitRows('.pane-notebook .nb-blocks .nb-view', ids(vOpen.rows)) && vOpen.rows.every(r => r.kind === 'question' && r.status !== 'done'), `${vOpen.count} rows`);
  await sleep(800);
  await ed.locator('.nb-view .nbv-line').click();
  await ed.locator('.nb-structured-editor .nb-card-input').fill('notebook @Nowhere 9');
  await ed.locator('.nb-structured-editor button', { hasText: 'Save block' }).click();
  await sleep(1500);
  await page.keyboard.press('Escape');
  check('a line that cannot be read is not written', bodyOf(w5).includes('```view\nnotebook @Num 25:1-9 open\n```') && !bodyOf(w5).includes('Nowhere'));
  await page.evaluate(() => window.__wb.changed());
  await sleep(600);

  // templates: the Templates page (empty), a new template, its settings and blanks
  await page.locator('.pane-notebook .nb-side-templates').click();
  await ed.locator('.nb-title', { hasText: 'Templates' }).waitFor({ timeout: 10000 });
  check('Templates (from the sidebar’s foot): none yet, and how to make one', (await ed.locator('.nb-tpl-count').textContent()) === '0 templates' && await ed.locator('.nb-tpl-new').count() === 1 && /Save as a template/.test(await ed.locator('.nb-tpl-list').textContent()));
  await ed.locator('.nb-tpl-new').click();
  await ed.locator('.nb-crumbs', { hasText: 'Templates' }).waitFor({ timeout: 10000 });
  const tpl = wbj('template', 'list').templates[0]?.id;
  const tplFile = () => readFileSync(fileOf(tpl), 'utf8').replace(/\r\n/g, '\n');
  check('A new template makes an empty one, a note with template: true, and opens it with its settings', !!tpl && /\ntemplate: true\n/.test(tplFile()) && await ed.locator('.nb-tpl-settings').count() === 1 && await ed.locator('.nb-tpl-about').count() === 1 && (await ed.locator('.nb-crumbs > *').allTextContents()).join(' ') === 'Templates / New template', (await ed.locator('.nb-crumbs > *').allTextContents()).join(' '));
  await ed.locator('.nb-title').click();
  await ed.locator('.nb-title-input').fill('W5 Chapter study');
  await page.keyboard.press('Enter');
  await waitLong(tpl, t => /\n---\nW5 Chapter study/.test(t));
  for (const b of ['# Read', '```scripture\n{place}\n```', '# What I noticed', '- …', '# Questions', '```view\nnotebook @{place} questions\n```', 'Made on {date}, the reader at {reader}: {title}']) execFileSync(wbExe, ['block', 'add', tpl, '-'], { env, input: b });
  await page.evaluate(() => window.__wb.changed());
  await ed.locator('.nb-blocks .nb-blank-block').waitFor({ timeout: 10000 }).catch(() => {});
  check('a template’s scripture block and view hold {place}: shown as blanks, filled when a page is made', /Scripture: \{place\}, from the Bible/.test(await ed.locator('.nb-blocks .nb-blank-block').textContent().catch(() => '')) && /filled when a page is made/.test(await ed.locator('.nb-blocks .nb-view').textContent().catch(() => '')));
  // { in a template's block offers the blanks
  await sleep(800);
  await ed.locator('.nb-blocks .nb-block-add').click();
  await page.keyboard.type('Read again {');
  await page.locator('.nb-blankmenu .nb-blockmenu-row').first().waitFor({ timeout: 5000 }).catch(() => {});
  const blanks = await page.locator('.nb-blankmenu .nb-blockmenu-row').evaluateAll(els => els.map(e => e.dataset.key).join(' '));
  await page.screenshot({ path: shots + '1440-notebook-a-template-blanks.png' });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  check('{ in a template offers the blanks {place} {date} {title} {reader}; one picked is written', blanks === '{place} {date} {title} {reader}' && await waitLong(tpl, t => t.includes('\n\nRead again {place}')), blanks);
  // its settings: asks for a place, the name new pages get
  await sleep(900);
  await ed.locator('.nb-tpl-asks').selectOption('place');
  const asksKept = await waitLong(tpl, t => /\nasks: "?place"?\n/.test(t));
  await ed.locator('.nb-tpl-settings .nb-tpl-names').waitFor({ timeout: 10000 });
  await sleep(600);
  await ed.locator('.nb-tpl-settings .nb-tpl-names').click();
  await ed.locator('.nb-tpl-names-input').fill('W5 Chapter study: {place}');
  await page.keyboard.press('Enter');
  const nameKept = await waitLong(tpl, t => /\nnew_name: "?W5 Chapter study: \{place\}"?\n/.test(t));
  check('its settings are front-matter fields: asks: place, and the name new pages get', asksKept && nameKept, tplFile().split('---')[1]);
  await page.screenshot({ path: shots + '1440-notebook-editing-a-template.png' });
  const flat = rows => rows.flatMap(r => [r.id, ...flat(r.children || [])]);
  const searchHits = wbj('notebook', '--group', 'none', '--search', 'W5 Chapter study').groups.flatMap(g => g.entries).map(e => e.id);
  await page.locator('.pane-notebook .nb-template-row').first().waitFor({ timeout: 10000 }).catch(() => {});
  check('a template is left out of Pages, the lists and search, and listed under Templates', !flat(treeNow().pages).includes(tpl) && !searchHits.includes(tpl) && !wbj('notebook', '--group', 'pages').groups.flatMap(g => g.entries).some(e => e.id === tpl) && (await page.locator('.pane-notebook .nb-template-row .nb-tree-title').allTextContents()).join() === 'W5 Chapter study');
  // A new page from the template (sheet W6.1): the pen asks Blank page or a template
  await page.evaluate(() => window.__wb.run('go Num 25'));
  await page.waitForFunction(() => document.querySelector('#place .place-label')?.textContent === 'Numbers 25', null, { timeout: 10000 }).catch(() => {});
  await page.locator('.pane-notebook .nb-new').click();
  await page.locator('.np-modal').waitFor({ timeout: 10000 });
  const optsTxt = await page.locator('.np-modal .np-opt .np-opt-name').allTextContents();
  await page.locator('.np-modal .np-opt', { hasText: 'W5 Chapter study' }).click();
  await page.waitForFunction(() => document.querySelector('.np-modal .np-name')?.value === 'W5 Chapter study: Numbers 25', null, { timeout: 10000 }).catch(() => {});
  const forVal = await page.locator('.np-modal .np-for').inputValue();
  const nameVal = await page.locator('.np-modal .np-name').inputValue();
  const pv = await page.locator('.np-modal .np-preview').textContent();
  check('the pen offers Blank page or a template; the template’s form: For (the reader’s chapter), the new page’s name, a preview', optsTxt.join() === 'Blank page,W5 Chapter study' && forVal === 'Numbers 25' && nameVal === 'W5 Chapter study: Numbers 25' && pv.includes('Scripture: Numbers 25, from the Bible') && pv.includes('View: notebook @Numbers 25 questions'), `${optsTxt} · ${forVal} · ${nameVal}`);
  await page.screenshot({ path: shots + '1440-notebook-a-new-page-from-a-template.png' });
  await page.locator('.np-modal .np-make').click();
  await ed.locator('.nb-title', { hasText: 'W5 Chapter study: Numbers 25' }).waitFor({ timeout: 20000 }).catch(() => {});
  const made = treeNow().pages.find(r => r.title === 'W5 Chapter study: Numbers 25')?.id;
  const madeDay = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const tBody = bodyOf(tpl);
  const expected = 'W5 Chapter study: Numbers 25' + tBody.slice(tBody.indexOf('\n')).replaceAll('{place}', 'Numbers 25').replaceAll('{date}', madeDay).replaceAll('{reader}', 'Numbers 25').replaceAll('{title}', 'W5 Chapter study: Numbers 25');
  const madeFile = made ? readFileSync(fileOf(made), 'utf8').replace(/\r\n/g, '\n') : '';
  check('Make the page: the template’s blocks, the blanks filled ({place}, {date}, {title}, {reader}), from_template in it, in Pages', !!made && bodyOf(made) === expected && madeFile.includes(`\nfrom_template: "${tpl}"\n`) &&!/\ntemplate: true\n/.test(madeFile), JSON.stringify(made && bodyOf(made)).slice(0, 200));
  const chapter = textOf('Num 25');
  check('the new page’s scripture block draws Numbers 25 from the Bible, and its view lists what wb view run finds', await waitVerses(0, chapter) && await waitRows('.pane-notebook .nb-blocks .nb-view', ids(wbj('view', 'run', 'notebook @Numbers 25 questions').rows)));
  await page.screenshot({ path: shots + '1440-notebook-a-page-made-from-a-template.png' });
  // from a terminal: wb page new --template, its place askedPlace for, a page inside another, used N times
  let askedPlace = '';
  try { execFileSync(wbExe, ['page', 'new', '--template', 'W5 Chapter study'], { env, stdio: 'pipe' }); } catch (x) { askedPlace = String(x.stderr); }
  const made2 = wbj('page', 'new', '--template', 'W5 Chapter study', '--place', 'Ps 106', '--parent', w5);
  const tl = wbj('template', 'list').templates.find(t => t.id === tpl);
  check('wb page new --template: it asks for the place, names the page from the template, goes where it is told; wb template list counts the uses', /asks for a place/.test(askedPlace) && made2.title === 'W5 Chapter study: Psalms 106' && made2.parent === w5 && tl?.used === 2 && tl?.asks === 'place' && wbj('template', 'show', 'w5 chapter').id === tpl, `${made2.title} · used ${tl?.used}`);
  await rowOf(made).locator('.nb-tree-open').click().catch(() => {});
  await page.locator('.pane-notebook .nb-template-row').first().click();
  await ed.locator('.nb-tpl-used').waitFor({ timeout: 10000 }).catch(() => {});
  check('the template’s head says how often it was used', (await ed.locator('.nb-tpl-used').textContent().catch(() => '')) === 'a template · used 2 times');
  // Save as a template (any page's ⋯): a copy, its places taken out
  const w4Before = readFileSync(fileOf(w4), 'utf8');
  await rowOf(w4).locator('.nb-tree-open').click();
  await ed.locator('.nb-title', { hasText: 'W4 the passage' }).waitFor({ timeout: 10000 });
  await ed.locator('.nb-ed-head .icon-btn').click();
  await page.locator('.menu .menu-item', { hasText: 'Save as a template' }).click();
  await ed.locator('.nb-crumbs', { hasText: 'Templates' }).waitFor({ timeout: 10000 }).catch(() => {});
  const saved = wbj('template', 'list').templates.find(t => t.title === 'W4 the passage');
  const savedText = saved ? readFileSync(fileOf(saved.id), 'utf8').replace(/\r\n/g, '\n') : '';
  check('Save as a template copies the page with its places taken out: {place} in its scripture blocks, no place of its own; the page as it was', !!saved && /\ntemplate: true\n/.test(savedText) && /\nasks: "?place"?\n/.test(savedText) && savedText.includes('```scripture\n{place}\n```') && savedText.includes('```scripture\n{place}\nlines\n```') && !savedText.includes('Num 25:10-13') && /\nanchor: ""\n|\nanchor: \n|\nanchor: ''\n/.test(savedText) && readFileSync(fileOf(w4), 'utf8') === w4Before, saved?.title);
  // Help (in the Settings dialog since feature/help): help templates opens it at the templates entry
  await page.evaluate(() => window.__wb.run('help templates'));
  check('help templates opens Help in the Settings dialog at its templates entry', await page.waitForFunction(() => [...document.querySelectorAll('.set-modal .guide-card.focus, .set-modal details.doc[open]')].some(e => /template/i.test(e.textContent)), null, { timeout: 10000 }).then(() => true, () => false));
  await page.screenshot({ path: shots + '1440-help-guide-templates.png' });
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__wb.run('notebook'));
  await sleep(400);
  await page.locator('.pane-notebook .nb-side-templates').click();
  await ed.locator('.tp-card').first().waitFor({ timeout: 10000 });
  const cards = await ed.locator('.tp-card').evaluateAll(els => els.map(e => [e.querySelector('.tp-name').textContent, e.querySelector('.tp-used').textContent].join(': ')));
  const tplListed = wbj('template', 'list').templates.map(t => `${t.title}: ${t.used === 0 ? 'not used yet' : t.used === 1 ? 'used once' : `used ${t.used} times`}`);
  check('the Templates page lists each template with how often it was used, as wb template list', JSON.stringify(cards) === JSON.stringify(tplListed), cards.join(' · '));
  await page.screenshot({ path: shots + '1440-notebook-templates.png' });
  const tplFit = await page.evaluate(() => {
    const list = document.querySelector('.pane-notebook .nb-tpl-list');
    const out = {};
    const scroller = (() => { let e = list.parentElement; while (e && !/(auto|scroll)/.test(getComputedStyle(e).overflowX)) e = e.parentElement; return e; })();
    for (const w of [null, 320, 240]) {
      list.style.width = w ? w + 'px' : ''; list.style.maxWidth = w ? w + 'px' : '';
      out[w || 'pane'] = [...list.querySelectorAll('.tp-card')].every(c => c.scrollWidth <= c.clientWidth + 1) && list.scrollWidth <= list.clientWidth + 1 && (!scroller || scroller.scrollWidth <= scroller.clientWidth + 1);
    }
    list.style.width = ''; list.style.maxWidth = '';
    return out;
  });
  check('the Templates page wraps its cards: no sideways scroll at the pane’s width, 320 or 240 px (note bd54)', Object.values(tplFit).every(Boolean), JSON.stringify(tplFit));
  await ed.locator('.nb-tpl-how').click();
  check('How templates work opens Help at its templates entry', await page.waitForFunction(() => [...document.querySelectorAll('.set-modal .guide-card.focus, .set-modal details.doc[open]')].some(e => /template/i.test(e.textContent)), null, { timeout: 10000 }).then(() => true, () => false));
  await page.keyboard.press('Escape');
  // the Python app: it passes over a template (a page with no place, as every page), and reads a page made from one,
  // once placed, keeping from_template when it writes it
  execFileSync(wbExe, ['note', 'place', made, 'Num 25:11'], { env });
  const OLD5 = path.join(os.homedir(), 'github', 'bible-workbench');
  const py5 = (code, id) => execFileSync('python', ['-c', `import json, sys\nfrom workbench.study import Study\ns = Study(sys.argv[1])\nn = ([x for x in s.notes() if x['id'] == sys.argv[2]] or [None])[0]\n${code}`, study, id], { cwd: OLD5, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString();
  const pyTpl = JSON.parse(py5('print(json.dumps(n))', tpl));
  const pyMade = JSON.parse(py5('print(json.dumps(n))', made));
  check('the Python app reads the study folder with templates in it: it passes over a template, and reads a page made from one with from_template', pyTpl === null && pyMade?.anchor === 'NUM.25:11' && pyMade?.from_template === tpl, JSON.stringify(pyMade && { anchor: pyMade.anchor, from_template: pyMade.from_template }));
  py5(`s.update_note(n['id'], n['text'] + '\\n\\nWritten by the Python app.')`, made);
  check('a page made from a template, written by the Python app, keeps from_template: still counted as used', readFileSync(fileOf(made), 'utf8').includes('Written by the Python app.') && wbj('template', 'list').templates.find(t => t.id === tpl)?.used === 2);
  // the templates deleted (to .trash), so the checks after these see the pen as before: a blank page at once
  for (const t of wbj('template', 'list').templates) execFileSync(wbExe, ['template', 'rm', t.id], { env });
  await sleep(1300); // the window reads the folder again at most once a second
  await page.evaluate(() => window.__wb.changed());
  await page.evaluate(() => window.__wb.run('notebook'));
  await page.waitForFunction(() => !document.querySelector('.pane-notebook .nb-side-head[data-part="templates"]'), null, { timeout: 10000 }).catch(() => {});
  check('wb template rm deletes a template (to .trash); the pages made from it stay, and with none left the Templates section goes', wbj('template', 'list').templates.length === 0 && !!fileOf(made) && await page.locator('.pane-notebook .nb-side-head[data-part="templates"]').count() === 0 && readdirSync(path.join(study, '.trash'), { recursive: true }).some(f => String(f).includes(tpl)), JSON.stringify({ n: wbj('template', 'list').templates.length, made: !!fileOf(made), side: await page.locator('.pane-notebook .nb-side-head[data-part="templates"]').count(), trash: readdirSync(path.join(study, '.trash'), { recursive: true }).length }));
  await sleep(400);

  // W6, a document from a page (sheets W7.1–W7.4): a page with headings, scripture blocks, to-dos, and two pages inside
  // it (one with scripture, one with a view) made into a Speaker Script and Verse by Verse. Every verse expected here
  // comes from the database (wb text); the view's rows are wb view run's.
  const w6Docs = path.join(study, 'exports');
  const w6 = wbj('page', 'new', 'W6 Lesson: Phinehas').id;
  for (const b of ['# Aim', 'Read Numbers 25 with the group, then Psalm 106 beside it.', '# Before Tuesday', '- [x] W6 read Numbers 25 twice\n- [ ] W6 print the verse deck', '```scripture\nNum 25:10-13\n```']) execFileSync(wbExe, ['block', 'add', w6, '-'], { env, input: b });
  const w6a = wbj('page', 'new', 'W6 The passage', '--parent', w6).id;
  for (const b of ['```scripture\nPs 106:28-31\n```', '- [ ] W6 a to-do inside']) execFileSync(wbExe, ['block', 'add', w6a, '-'], { env, input: b });
  const w6Line = 'notebook @Num 25 questions';
  const w6b = wbj('page', 'new', 'W6 Questions for the group', '--parent', w6).id;
  execFileSync(wbExe, ['block', 'add', w6b, '-'], { env, input: '```view\n' + w6Line + '\n```' });
  for (let i = 0; i < 6 && !(await rowOf(w6).count()); i++) {
    await page.evaluate(() => window.__wb.run('notebook'));
    await page.evaluate(() => window.__wb.changed());
    await rowOf(w6).waitFor({ timeout: 5000 }).catch(() => {});
  }
  await rowOf(w6).locator('.nb-tree-open').click();
  await ed.locator('.nb-title', { hasText: 'W6 Lesson: Phinehas' }).waitFor({ timeout: 10000 });
  check('a page with no documents has no Documents box at its foot', await ed.locator('.nb-docs .pd-doc').count() === 0);
  // W7.1: Make a document, from the page's ⋯
  await ed.locator('.nb-ed-head .icon-btn').click();
  await page.locator('.menu .menu-item', { hasText: 'Make a document…' }).click();
  await page.locator('.pd-modal .pd-opt').first().waitFor({ timeout: 10000 });
  const w6Sub = await page.locator('.pd-modal .pd-sub').textContent();
  const w6Opts = await page.locator('.pd-modal .pd-opt').evaluateAll(els => els.map(e => [e.querySelector('.pd-opt-name').textContent, e.querySelector('input').checked, e.querySelector('input').disabled]));
  const w6Made = w6Opts.filter(o => !o[2]).map(o => o[0]).join();
  check('Make a document (a page’s ⋯): from the page and the pages inside it; the Speaker Script and Verse by Verse on, the rest greyed for phase 5', w6Sub === 'From the page W6 Lesson: Phinehas and the 2 pages inside it' && w6Made === 'Speaker Script,Verse by Verse' && w6Opts.filter(o => !o[2]).every(o => o[1]) && w6Opts.filter(o => o[2]).length === 6 && w6Opts.filter(o => o[2]).every(o => / · phase 5$/.test(o[0]) && !o[1]), `${w6Sub} · ${w6Opts.map(o => o[0]).join(', ')}`);
  const designs6 = wbj('craft', 'designs');
  const aboutShown = await page.locator('.pd-modal .pd-opt').evaluateAll(els => els.map(e => e.querySelector('.muted').textContent));
  check('each structure with the Python app’s own description (wb craft designs)', aboutShown.includes(designs6.docs.script.about) && aboutShown.includes(`${designs6.decks.verse.about} As PDF pages.`) && aboutShown.includes(designs6.docs.share.about) && aboutShown.includes(designs6.decks.table.about));
  await page.locator('.pd-modal .pd-theme').selectOption('olivet');
  check('a theme, with what it is best for, and the version (each block’s own unless one is picked)', (await page.locator('.pd-modal .pd-best').textContent()) === designs6.themes.olivet.best_for && (await page.locator('.pd-modal .pd-version').inputValue()) === 'page');
  await page.screenshot({ path: shots + '1440-w6-make-a-document.png' });
  // W7.2: what goes in, a switch for each row, as wb craft parts gives them
  await page.locator('.pd-modal .pd-next').click();
  await page.locator('.pd-modal .pd-row').first().waitFor({ timeout: 10000 });
  const parts6 = wbj('craft', 'parts', '--page', w6);
  const rows6 = await page.locator('.pd-modal .pd-row').evaluateAll(els => els.map(e => ({ key: e.dataset.key, kind: e.dataset.kind, on: e.querySelector('input').checked, becomes: e.querySelector('.pd-becomes').textContent, text: e.querySelector('.pd-text').textContent })));
  check('What goes in: each block and each page inside, in order, with its switch and what it becomes, as wb craft parts', JSON.stringify(rows6) === JSON.stringify(parts6.rows.map(r => ({ key: r.key, kind: r.kind, on: r.on, becomes: r.becomes, text: r.text }))) && rows6.map(r => r.kind).join() === 'heading,paragraph,heading,todo,scripture,page,page', rows6.map(r => `${r.kind}${r.on ? '' : ' (off)'}`).join(', '));
  const todo6 = rows6.find(r => r.kind === 'todo');
  check('to-dos are left out unless switched on; a page inside says what it holds', !!todo6 && !todo6.on && todo6.becomes === 'Left out: to-dos are for you' && todo6.text === '2 to-dos: W6 read Numbers 25 twice' && rows6[5].text === 'W6 The passage · 1 scripture block' && rows6[6].text === 'W6 Questions for the group · a view', `${todo6?.becomes} · ${rows6[5].text} · ${rows6[6].text}`);
  // a switch moved: the row says what it becomes now, and back
  await page.locator(`.pd-modal .pd-row[data-key="${todo6.key}"] input`).click();
  await page.waitForFunction(k => document.querySelector(`.pd-modal .pd-row[data-key="${k}"] .pd-becomes`)?.textContent === 'Your words: each to-do as a line', todo6.key, { timeout: 10000 }).catch(() => {});
  const todoOn = await page.locator(`.pd-modal .pd-row[data-key="${todo6.key}"] .pd-becomes`).textContent();
  await page.locator(`.pd-modal .pd-row[data-key="${todo6.key}"] input`).click();
  await page.waitForFunction(k => document.querySelector(`.pd-modal .pd-row[data-key="${k}"] .pd-becomes`)?.textContent === 'Left out: to-dos are for you', todo6.key, { timeout: 10000 }).catch(() => {});
  check('switched on, the to-dos become your words; off again, left out', todoOn === 'Your words: each to-do as a line' && (await page.locator(`.pd-modal .pd-row[data-key="${todo6.key}"] .pd-becomes`).textContent()) === 'Left out: to-dos are for you');
  check('the note: planned from the page each time, nothing copied in, scripture from the database only', /planned from the page each time it is made/.test(await page.locator('.pd-modal .pd-note').textContent()) && (await page.locator('.pd-modal .pd-sub').textContent()) === 'Speaker Script and Verse by Verse · Olivet · each block’s version');
  await page.screenshot({ path: shots + '1440-w6-what-goes-in.png' });
  // W7.3: made, and every verse checked
  await page.locator('.pd-modal .pd-make').click();
  await page.locator('.pd-modal.pd-made .pd-file').nth(1).waitFor({ timeout: 60000 }).catch(() => {});
  const scriptPath = path.join(w6Docs, 'Speaker Script - W6 Lesson Phinehas.docx'), deckPath = path.join(w6Docs, 'Verse by Verse - W6 Lesson Phinehas.pdf');
  const w6Verses = [...wbj('text', 'Num 25:10-13', '--json').verses, ...wbj('text', 'Ps 106:28-31', '--json').verses];
  const madeRows = await page.locator('.pd-modal .pd-verse').evaluateAll(els => els.map(e => [e.querySelector('.pd-verse-ref').textContent, e.querySelector('.muted').textContent]));
  const files6 = await page.locator('.pd-modal .pd-file').evaluateAll(els => els.map(e => [e.querySelector('.pd-file-name').textContent, e.querySelector('.pd-file-meta')?.textContent]));
  const pdfPages = JSON.parse(execFileSync(wbExe, ['docs', 'show', `page-${w6}-verse`], { env }).toString()).pages;
  check('Made: the two files, Word with its size and the PDF with its slides, each with Open', files6.length === 2 && files6[0][0] === 'Speaker Script - W6 Lesson Phinehas.docx' && /^Word · \d+ KB$/.test(files6[0][1]) && files6[1][0] === 'Verse by Verse - W6 Lesson Phinehas.pdf' && files6[1][1] === `PDF · ${pdfPages} slides` && await page.locator('.pd-modal .pd-file .pd-open').count() === 2 && existsSync(scriptPath) && existsSync(deckPath), files6.map(f => f.join(': ')).join(' · '));
  check(`${w6Verses.length} of ${w6Verses.length} verses match the Bible (KJV), in both files, each listed with where it is`, (await page.locator('.pd-modal .pd-checked-head').textContent()) === `${w6Verses.length} of ${w6Verses.length} verses match the Bible (KJV), in both files` && JSON.stringify(madeRows) === JSON.stringify(w6Verses.map(v => [v.ref ?? `${v.book} ${v.c}:${v.v}`, 'Script and slides'])), madeRows.map(r => r[0]).join(', '));
  check('kept in documents/ as page-<id>-script.json and page-<id>-verse.json, with the plan and file fingerprints', ['script', 'verse'].every(st => { const f = path.join(study, 'documents', `page-${w6}-${st}.json`); if (!existsSync(f)) return false; const r = JSON.parse(readFileSync(f, 'utf8')); return r.source.kind === 'page' && r.source.id === w6 && /^[0-9a-f]{64}$/.test(r.plan) && /^[0-9a-f]{64}$/.test(r.file) && r.theme === 'olivet'; }));
  await page.screenshot({ path: shots + '1440-w6-made.png' });
  // the files themselves: every verse word for word (Word read from the file; the PDF's text read by pypdf)
  const squash6 = t => t.normalize('NFKC').replace(/\s+/g, '');
  const docText = JSON.parse(execFileSync(wbExe, ['docs', 'preview', `page-${w6}-script`], { env }).toString()).paras.map(p => p.runs.map(r => r.t).join('')).join('\n');
  const pdfText = execFileSync('python', ['-c', 'import pypdf, sys\nprint("".join(p.extract_text() for p in pypdf.PdfReader(sys.argv[1]).pages))', deckPath], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString();
  check('every verse in the Speaker Script and on the slides is wb text’s, word for word', w6Verses.every(v => squash6(docText).includes(squash6(v.text)) && squash6(pdfText).includes(squash6(v.text))), `${w6Verses.length} verses`);
  const vRows6 = wbj('view', 'run', w6Line).rows;
  check('the Speaker Script: the page’s headings and the pages inside as sections with their SLIDE cues, the to-dos left out, the view’s rows as wb view run gives them', /\nAim\nSLIDE 2\n/.test(docText) && /\nW6 The passage\nSLIDE \d+\n/.test(docText) && /\nW6 Questions for the group\nSLIDE \d+\n/.test(docText) && !docText.includes('W6 read Numbers 25 twice') && !docText.includes('W6 a to-do inside') && vRows6.length > 0 && docText.split('W6 Questions for the group\n')[1].split('\n').filter(l => l.startsWith('• ')).length === vRows6.length && vRows6.every(r => docText.includes(`• ${r.title}`)), `${vRows6.length} view rows`);
  // the Python app reads the study folder with page records in it: it passes over them and breaks on none
  const OLD6 = path.join(os.homedir(), 'github', 'bible-workbench');
  const pyDocs = execFileSync('python', ['-c', 'import json, sys\nfrom workbench.study import Study\nfrom workbench import documents\ns = Study(sys.argv[1])\nr = documents.records(s)\ntry:\n  documents.find(s, sys.argv[2])\n  f = "found"\nexcept Exception as e:\n  f = type(e).__name__\nprint(json.dumps({"ids": [x["id"] for x in r], "find": f}))', study, `page-${w6}-script`], { cwd: OLD6, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString();
  const py6 = JSON.parse(pyDocs);
  check('the Python app reads the study folder with page records in it: it lists none of them and breaks on none', !py6.ids.some(i => i.startsWith('page-')) && py6.find === 'Missing', pyDocs.trim());
  await page.locator('.pd-modal .pd-done').click();
  // W7.4: the page keeps its documents
  await page.waitForFunction(() => document.querySelectorAll('.pane-notebook .nb-docs .pd-doc').length === 2, null, { timeout: 15000 }).catch(() => {});
  const foot6 = async () => page.locator('.pane-notebook .nb-docs .pd-doc').evaluateAll(els => els.map(e => [e.querySelector('.pd-doc-name').textContent, e.querySelector('.pd-doc-when').textContent, e.querySelector('.pd-doc-state')?.textContent || '', !!e.querySelector('.pd-again')]));
  const footNow = await foot6();
  check('the page keeps its documents at its foot: Documents · 2, each made today and Up to date', (await page.locator('.pane-notebook .nb-docs .nb-linked-head').textContent()) === 'Documents · 2' && footNow.length === 2 && footNow.every(f => /^today /.test(f[1]) && f[2] === 'Up to date' && !f[3]), JSON.stringify(footNow));
  // the page changed since: Make again
  execFileSync(wbExe, ['block', 'add', w6, '-'], { env, input: '```scripture\nNum 25:9\n```' });
  await page.evaluate(() => window.__wb.changed());
  await page.waitForFunction(() => [...document.querySelectorAll('.pane-notebook .nb-docs .pd-doc')].filter(e => e.querySelector('.pd-again')).length === 2, null, { timeout: 20000 }).catch(() => {});
  const footBehind = await foot6();
  check('the page changed since: each says so, with Make again', footBehind.length === 2 && footBehind.every(f => / · changed since$/.test(f[1]) && f[3]), JSON.stringify(footBehind));
  await page.locator('.pane-notebook .nb-docs').scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: shots + '1440-w6-the-page-keeps-its-documents.png' });
  await page.locator('.pane-notebook .nb-docs .pd-doc', { hasText: 'Speaker Script' }).locator('.pd-again').click();
  await page.waitForFunction(() => /Up to date/.test(document.querySelector('.pane-notebook .nb-docs .pd-doc')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const again6 = JSON.parse(execFileSync(wbExe, ['docs', 'show', `page-${w6}-script`], { env }).toString());
  const docText2 = JSON.parse(execFileSync(wbExe, ['docs', 'preview', `page-${w6}-script`], { env }).toString()).paras.map(p => p.runs.map(r => r.t).join('')).join('\n');
  check('Make again brings it up to date in the same file, the new verse in it from the Bible, the to-dos still left out', again6.state === 'current' && again6.name === 'Speaker Script - W6 Lesson Phinehas.docx' && textOf('Num 25:9').every(t => squash6(docText2).includes(squash6(t))) && !docText2.includes('W6 print the verse deck'));
  // from a terminal: the to-dos switched on, kept for Make again; wb docs list --page
  execFileSync(wbExe, ['craft', 'word', '--page', w6, '--on', todo6.key], { env });
  const docText3 = JSON.parse(execFileSync(wbExe, ['docs', 'preview', `page-${w6}-script`], { env }).toString()).paras.map(p => p.runs.map(r => r.t).join('')).join('\n');
  const listed6 = wbj('docs', 'list', '--page', w6);
  execFileSync(wbExe, ['docs', 'update', `page-${w6}-script`, '--force'], { env });
  const docText4 = JSON.parse(execFileSync(wbExe, ['docs', 'preview', `page-${w6}-script`], { env }).toString()).paras.map(p => p.runs.map(r => r.t).join('')).join('\n');
  check('wb craft word --page --on: the to-dos go in as your words, and the switch is kept for Make again (wb docs list --page)', docText3.includes('Done: W6 read Numbers 25 twice') && docText3.includes('To do: W6 print the verse deck') && !docText3.includes('W6 a to-do inside') && docText4.includes('To do: W6 print the verse deck') && listed6.length === 2 && listed6.find(d => d.structure === 'script')?.switched?.[todo6.key] === true);
  execFileSync(wbExe, ['craft', 'word', '--page', w6, '--off', todo6.key], { env });
  execFileSync(wbExe, ['docs', 'update', `page-${w6}-verse`], { env });
  // a click on a document previews the file in a pane
  await page.evaluate(() => window.__wb.changed());
  await sleep(800);
  await page.locator('.pane-notebook .nb-docs .pd-doc-name', { hasText: 'Speaker Script' }).click();
  await page.locator('.pane-docpreview .pd-pv-sheet .pd-pv-p').first().waitFor({ timeout: 15000 }).catch(() => {});
  const pvText = await page.locator('.pane-docpreview .pd-pv-sheet').textContent().catch(() => '');
  check('a click on the Speaker Script previews the file in a pane: its paragraphs, read from the file', squash6(pvText).includes(squash6(w6Verses[1].text)) && await page.locator('.pane-docpreview .dp-SlideCue').count() > 0 && await page.locator('.pane-docpreview .dp-ScriptureReference').count() > 0 && !pvText.includes('W6 print the verse deck'));
  await page.screenshot({ path: shots + '1440-w6-preview-the-speaker-script.png' });
  await page.locator('.pane-notebook .nb-docs .pd-doc-name', { hasText: 'Verse by Verse' }).click();
  await page.locator('.pane-docpreview .pd-pv-slide').first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => [...document.querySelectorAll('.pane-docpreview .pd-pv-slide')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
  const deckNow = JSON.parse(execFileSync(wbExe, ['docs', 'show', `page-${w6}-verse`], { env }).toString());
  // S4: a deck opens a slide at a time: "1 of N" (N the PDF's slide count), ‹ › and the keys ← → step through all and stop
  // at the ends, none of them turning the reader's chapter; Show all is the column of every slide
  const pvCount = () => page.locator('.pane-docpreview .pd-pv-bar .pd-pv-count').textContent();
  const readerAt = () => page.evaluate(() => { const d = window.__wb.drawn; return `${d.chapter.code} ${d.chapter.chapter}`; });
  const readerBefore = await readerAt();
  check('a deck opens a slide at a time: “1 of N”, N the PDF’s slide count, one slide drawn, ‹ unavailable at the start', deckNow.state === 'current' && deckNow.pages > 1 && await pvCount() === `1 of ${deckNow.pages}` && await page.locator('.pane-docpreview .pd-pv-slide').count() === 1 && await page.locator('.pane-docpreview .pd-pv-prev').isDisabled(), `${await pvCount()} / ${deckNow.pages}`);
  await page.locator('.pane-docpreview .pd-pv-body[data-deck]').focus();
  const seen = [await pvCount()];
  for (let i = 1; i < deckNow.pages; i++) { await page.keyboard.press('ArrowRight'); seen.push(await pvCount()); }
  await page.keyboard.press('ArrowRight');
  const pastEnd = await pvCount();
  const lastDrawn = await page.waitForFunction(() => { const i = document.querySelector('.pane-docpreview .pd-pv-slide'); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 }).then(() => true).catch(() => false);
  check('→ steps through every slide and stops at the last; the slide is drawn; › is unavailable there', seen.join() === Array.from({ length: deckNow.pages }, (_, i) => `${i + 1} of ${deckNow.pages}`).join() && pastEnd === `${deckNow.pages} of ${deckNow.pages}` && lastDrawn && await page.locator('.pane-docpreview .pd-pv-next').isDisabled(), seen.join(', '));
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Home');
  const atHome = await pvCount();
  await page.keyboard.press('ArrowLeft');
  await page.locator('.pane-docpreview .pd-pv-next').click();
  check('← and Home go back and stop at the first; the buttons step too; the reader’s chapter did not move', atHome === `1 of ${deckNow.pages}` && await pvCount() === `2 of ${deckNow.pages}` && await readerAt() === readerBefore, `${atHome}; reader ${readerBefore} → ${await readerAt()}`);
  await page.locator('.pane-docpreview .pd-pv-mode').click();
  await page.locator('.pane-docpreview .pd-pv-slide').nth(deckNow.pages - 1).waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => [...document.querySelectorAll('.pane-docpreview .pd-pv-slide')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
  const slidesShown = await page.locator('.pane-docpreview .pd-pv-slide').evaluateAll(els => els.map(i => i.naturalWidth > 0));
  check('Verse by Verse previews as its slides, drawn by the layout that made the PDF: Show all lists as many as the PDF has, each drawn', slidesShown.length === deckNow.pages && slidesShown.every(Boolean) && (await pvCount()) === `${deckNow.pages} slides`, `${slidesShown.length} of ${deckNow.pages}`);
  await page.locator('.pane-docpreview .pd-pv-mode').click();
  await page.waitForFunction(() => document.querySelectorAll('.pane-docpreview .pd-pv-slide').length === 1, null, { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => localStorage.removeItem('wb.deck.preview'));
  await page.locator('.pane-docpreview .pd-pv-slide').first().scrollIntoViewIfNeeded().catch(() => {});
  await sleep(1500);
  await page.screenshot({ path: shots + '1440-w6-preview-the-verse-deck.png' });
  for (const pid of await page.evaluate(() => window.__wb.dock().panes.filter(p => p.kind === 'docpreview').map(p => p.id))) await page.evaluate(id => { const d = window.__wb.dock(); d.close(d.panes.find(p => p.id === id)); }, pid);
  // the Documents pane lists them made here, and makes one from a page too
  await page.evaluate(() => window.__wb.run('docs'));
  await page.waitForSelector('.pane-documents .doc-page-make select.doc-page', { timeout: 15000 }).catch(() => {});
  const pageRow = page.locator(`.pane-documents .doc-row[data-id="page-${w6}-script"]`);
  check('the Documents pane lists a page’s documents as made here, and has Make one from a page', await pageRow.count() === 1 && /Up to date/.test(await pageRow.innerText()) && !/Python app/.test(await pageRow.innerText()) && await page.locator('.pane-documents .doc-page-make select.doc-page option').evaluateAll((els, id) => els.some(e => e.value === id), w6));
  const docsPane6 = await page.evaluate(() => window.__wb.dock().panes.find(p => p.kind === 'documents')?.id);
  if (docsPane6) await page.evaluate(id => { const d = window.__wb.dock(); d.close(d.panes.find(p => p.id === id)); }, docsPane6);
  await page.evaluate(() => window.__wb.run('notebook'));
  await sleep(400);

  await page.evaluate(() => { const d = window.__wb.dock(); d.wide.right = false; d.layout(); });
  await sleep(300);
  await nbBack();
  await group('Pages');
  check('narrow, the row of sections stays, and Pages draws the tree with the page inside one level in', await page.locator('.pane-notebook .nb-sections').count() === 1 && await depthOf(childId) === '1');
  await page.screenshot({ path: shots + '1440-notebook-pages.png' });

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
  // the day off is Sunday, unless today is Sunday: then Saturday, so there is a reading for today to check
  const offDay = new Date().getDay() === 0 ? ['Sat', 'sat', 'Saturday'] : ['Sun', 'sun', 'Sunday'];
  await dlg.getByRole('button', { name: offDay[0], exact: true }).click();
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
  check(`Start writes the plan: 30 days, Romans in it, ${offDay[2]} off`, existsSync(planFile) && planJson.days.length === 30 && JSON.stringify(planJson.days).includes('"ROM.16"') && JSON.stringify(planJson.days_off) === `["${offDay[1]}"]`, `${planJson.days.length} days, off ${planJson.days_off}`);
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
  check('words cannot be selected in the YLT (no mark bar)', await page.locator('.markbar').count() === 0);
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
    // minimize round 7: a minimized tab is a link in the rail's Minimized menu, not a hidden pane
    check('minimizing one part of a split column minimizes only that part (note 1b2d)', await page.locator('.dock-left.open .dock-group').count() === 1 && await page.locator('.dock-left .pane-interlinear:visible').count() === 1 && await page.locator('.pane-strong').count() === 0 && await page.locator('.dock-right.open').count() === 1);
    check('it waits as a link under Minimized on the rail, no bar or chip', await page.locator('#rail [data-rail="minimized"].has').isVisible() && await page.locator('.dock-restore-bar, .dock-chip').count() === 0);
    await page.locator('#rail [data-rail="minimized"]').click();
    await sleep(200);
    await page.screenshot({ path: shots + '1440-dock-a-part-minimized.png' });
    await page.locator('.rail-menu .rail-link', { hasText: 'H7065' }).locator('.rail-link-go').click();
    await page.waitForSelector('.dock-left .pane-strong', { timeout: 10000 });
    check('its link opens it again in its column', await page.locator('.dock-left .pane-strong').count() === 1);
    await page.evaluate(() => { const d = window.__wb.dock(); const s = d.panes.find(x => x.kind === 'strong'), i = d.panes.find(x => x.kind === 'interlinear'); d.drop(s, { to: 'split', group: d.groupOf(i), after: true }); });
    await sleep(300);
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
    check('a float minimized becomes a link; the other stays open', await page.locator('.pane-strong').count() === 0 && await page.locator('.dock-chip').count() === 0 && await fA.isVisible());
    await page.locator('#rail [data-rail="minimized"]').click();
    await page.locator('.rail-menu .rail-link', { hasText: 'H7065' }).locator('.rail-link-go').click();
    await page.waitForSelector('.dock-float .pane-strong', { timeout: 10000 });
    await sleep(200);
    const b2 = await fB.boundingBox();
    check('its link opens it again where it was', !!b2 && b2.x === b0.x && b2.y === b0.y);
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
    check('the dock never moved the reader', (await top()) === v0, `verse ${v0} → ${await top()}`);
  }

  // ---- the findings of 2026-11-04 and 11-05 (docs/phase2-results.md section 16) ----
  {
    const label = () => page.locator('#place .place-label').textContent();
    const wordAt = v => page.evaluate(v => { const d = window.__wb.drawn, k = d.v.indexOf(v); d.el[k].scrollIntoView({ block: 'center' }); const r = d.el[k].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, v);
    await page.evaluate(() => window.__wb.open('NUM', 25, 10));
    await sleep(500);
    // 4b90: a click on a verse number selects the whole verse with the mark bar; a style marks the verse; a click away clears
    await page.locator('#reader .vn[data-v="12"]').click();
    await page.waitForSelector('.markbar.verse-bar', { timeout: 5000 });
    const v12 = await page.evaluate(() => { const d = window.__wb.drawn; return { words: d.v.filter(v => v === 12).length, sel: document.querySelectorAll('#reader .w.sel').length, vsel: !!document.querySelector('#reader .vn.vsel[data-v="12"]') }; });
    check('a click on a verse number selects the whole verse, with the mark bar (note 4b90)', v12.sel === v12.words && v12.vsel, `${v12.sel} of ${v12.words} words`);
    check('the verse’s bar is the words’ bar', (await page.locator('.markbar button').count()) === 10);
    await page.screenshot({ path: shots + '1440-a-verse-picked.png' });
    await page.locator('.markbar .mb-highlight').click();
    await page.locator('.markbar .mb-menu .mb-row').first().click();
    await sleep(800);
    check('a style on the verse’s bar marks the whole verse', JSON.parse(execFileSync(wbExe, ['mark', 'at', 'Num 25:12'], { env }).toString()).marks.some(m => m.kind === 'highlight'));
    await page.locator('#reader .vn[data-v="13"]').click();
    await page.waitForSelector('.markbar.verse-bar', { timeout: 5000 });
    await page.locator('.dock-right .pane:visible').first().click({ position: { x: 60, y: 8 } });
    await sleep(200);
    check('a click away clears the verse picked and its bar', await page.locator('.markbar').count() === 0 && await page.locator('#reader .w.sel, #reader .vn.vsel').count() === 0);
    // a span: the first verse number, then shift-click the last
    await page.locator('#reader .vn[data-v="13"]').click();
    await page.locator('#reader .vn[data-v="15"]').click({ modifiers: ['Shift'] });
    await page.waitForSelector('.markbar', { timeout: 5000 });
    check('shift-click on a second verse number selects the span between', JSON.stringify(await page.evaluate(() => { const d = window.__wb.drawn, s = window.__wb.selector.sel; return [...new Set(d.v.slice(s.a, s.b + 1))]; })) === '[13,14,15]');
    await page.keyboard.press('Escape');
    await sleep(200);

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
    await page.waitForSelector('.markbar.verse-bar', { timeout: 5000 });
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
    const head2 = await r2.locator('.reader2-head').evaluate(h => ({ sub: h.querySelectorAll('.pane-sub').length, text: h.textContent.replace(/KJV|YLT/g, '').trim(), go: h.querySelector('.reader2-go')?.getAttribute('aria-label'), goText: h.querySelector('.reader2-go')?.textContent.trim(), goIcon: !!h.querySelector('.reader2-go svg') }));
    check('the second reader’s head is the title (the picker), ‹ ›, KJV | YLT and an arrow “Send to the reader”: no label under it that goes stale (note b59b)', head2.sub === 0 && head2.text === 'Numbers 26' && head2.go === 'Send to the reader' && head2.goText === '' && head2.goIcon, JSON.stringify(head2));
    // S6 (note b59b): the pane's own book and chapter picker and KJV | YLT; the reader and the other readers stay as they are
    const norm2 = s => s.toLowerCase().replace(/[^\p{L}]/gu, '');
    const verseText = (ref, v) => norm2(JSON.parse(execFileSync(wbExe, ['text', ref, '--version', v, '--json'], { env }).toString()).verses[0].text);
    const paneText = async () => norm2(await r2.locator('.reader2').evaluate(e => e.textContent));
    const mainText = () => page.evaluate(() => document.getElementById('reader').textContent.length);
    const mainLen = await mainText();
    await r2.locator('.reader2-pick').click();
    await page.locator('.picker .ch-btn', { hasText: /^30$/ }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.pane-reader2 .reader2-title')].some(e => e.offsetWidth && e.textContent === 'Numbers 30'), null, { timeout: 10000 }).catch(() => {});
    check('the second reader has the book and chapter picker: it goes to another chapter and the reader stays', (await r2.locator('.reader2-title').textContent()) === 'Numbers 30' && (await paneText()).includes(verseText('Num 30:3', 'KJV')) && (await label()) === 'Numbers 25' && (await top()) === at0 && await mainText() === mainLen);
    await r2.locator('.reader2-ver button', { hasText: 'YLT' }).click();
    const yltShown = await page.waitForFunction(t => { const e = document.querySelector('.pane-reader2 .reader2'); return !!e && e.textContent.toLowerCase().replace(/[^\p{L}]/gu, '').includes(t); }, verseText('Num 30:3', 'YLT'), { timeout: 10000 }).then(() => true, () => false);
    check('its KJV | YLT switch redraws it in place: the pane’s words are the Bible’s YLT; the reader is still the KJV', yltShown && !(await paneText()).includes(verseText('Num 30:3', 'KJV')) && (await page.locator('#tb-version').textContent()) === 'KJV' && await mainText() === mainLen && (await r2.locator('.reader2-title').textContent()) === 'Numbers 30');
    await r2.locator('.reader2-ver button', { hasText: 'KJV' }).click();
    await page.waitForFunction(t => document.querySelector('.pane-reader2 .reader2').textContent.toLowerCase().replace(/[^\p{L}]/gu, '').includes(t), verseText('Num 30:3', 'KJV'), { timeout: 10000 }).catch(() => {});
    await r2.locator('.reader2-pick').click();
    await page.locator('.picker .ch-btn', { hasText: /^26$/ }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.pane-reader2 .reader2-title')].some(e => e.offsetWidth && e.textContent === 'Numbers 26'), null, { timeout: 10000 }).catch(() => {});
    // the keyboard works in it: a click in the text, then ↑ ↓ scroll that pane and ← → turn its chapter, never the reader's
    const sc2 = () => page.evaluate(() => { const e = [...document.querySelectorAll('.reader2-pane')].find(x => x.offsetParent); return e.scrollTop; });
    const mainScroll = () => page.evaluate(() => document.getElementById('scroller').scrollTop);
    const sc2Before = await sc2(), mainBefore = await mainScroll();
    await r2.locator('.vn[data-v="2"]').click();
    await page.keyboard.press('Escape');
    for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowDown');
    await sleep(500);
    const sc2Down = await sc2();
    await page.keyboard.press('PageDown');
    await sleep(500);
    const sc2Page = await sc2();
    for (let k = 0; k < 2; k++) await page.keyboard.press('ArrowUp');
    await sleep(400);
    check('after a click in a second reader, ↓ PgDn ↑ scroll that pane and not the reader (note b59b)', sc2Down > sc2Before && sc2Page > sc2Down && (await sc2()) < sc2Page && (await mainScroll()) === mainBefore, [sc2Before, sc2Down, sc2Page, await sc2(), mainBefore, await mainScroll()].join(' → '));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => [...document.querySelectorAll('.pane-reader2 .reader2-title')].some(e => e.offsetWidth && e.textContent === 'Numbers 27'), null, { timeout: 10000 }).catch(() => {});
    const afterRight = [await r2.locator('.reader2-title').textContent(), await label()];
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => [...document.querySelectorAll('.pane-reader2 .reader2-title')].some(e => e.offsetWidth && e.textContent === 'Numbers 26'), null, { timeout: 10000 }).catch(() => {});
    check('→ and ← pressed in a second reader turn its own chapter; the reader stays', afterRight[0] === 'Numbers 27' && afterRight[1] === 'Numbers 25' && (await r2.locator('.reader2-title').textContent()) === 'Numbers 26' && (await label()) === 'Numbers 25' && (await top()) === at0, afterRight.join(' / '));
    await page.evaluate(() => { const e = [...document.querySelectorAll('.reader2-pane')].find(x => x.offsetParent); e.scrollTop = 0; });
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
    await page.waitForSelector('.markbar', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__wb.run('?Why these words here?'));
    const asked = JSON.parse(execFileSync(wbExe, ['trail', 'list', '--status', 'all', '--at', 'Num 25:13'], { env }).toString()).trails.find(t => t.text === 'Why these words here?');
    check('a question on words of a verse is at those words; wb trail list --at lists it at the verse', !!asked && asked.anchor.startsWith('NUM.25:13.') && asked.here === false, asked?.anchor);
    await page.evaluate(() => window.__wb.run('notes @Num 25:13'));
    check('Notes & lookup shows a question on part of the verse (note c39a)', await page.locator('.pane-place:visible .question-card', { hasText: 'Why these words here?' }).waitFor({ timeout: 10000 }).then(() => true, () => false));
    await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'place')) d.close(p); });

    // 797d: the command field keeps the lines run, failed ones too; ↑ ↓ go through them, newest first. The box holds
    // its place (command C14), so ↑ starts from the place shown and ↓ past the newest gives the place back
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
    check('the empty command field lists recent lines; ↑ ↓ go through them, the failed one too (note 797d)', recent && ['', 'Numbers 25'].some(end => steps.join(' | ') === 'go Nowhere 99 | go Num 25:20 | go Nowhere 99 | ' + end), steps.join(' | '));
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
    const fmd = () => (existsSync(fdir) ? readdirSync(fdir).filter(f => f.endsWith('.md')) : []);  // (not the .tmp it is written through)
    for (let i = 0; i < 30 && !fmd().length; i++) await sleep(100);
    const ftext = fmd().length ? readFileSync(path.join(fdir, fmd()[0]), 'utf8') : '';
    const inNotebook = JSON.stringify(JSON.parse(execFileSync(wbExe, ['notebook', '--group', 'none'], { env }).toString())).includes('The verse bar could say');
    check('the finding is a file in findings/, with the size, panes and place, and not in the Notebook', /kind: "finding"/.test(ftext) && /"size": "large"/.test(ftext) && /"panes": \[/.test(ftext) && /"place": "Numbers 25/.test(ftext) && !inNotebook, ftext.split('\n').find(l => l.startsWith('context')) || 'no file');
    // S7: the build in a finding says when the tree it was built from had uncommitted changes (and when it was built)
    const builtAs = /"build": "([^"]*)"/.exec(ftext)?.[1] || '';
    const treeDirty = execFileSync('git', ['status', '--porcelain', '--', '.', ':!docs', ':!measure/out'], { cwd: file('.') }).toString().trim() !== '';
    check('a finding records the build: the commit, “+dirty” when the tree had changes, the day and (then) the time', /^[0-9a-f]{7,}(\+dirty \d{4}-\d{2}-\d{2} \d{2}:\d{2}| \d{4}-\d{2}-\d{2})$/.test(builtAs) && builtAs.includes('+dirty') === treeDirty, `${builtAs}; tree ${treeDirty ? 'dirty' : 'clean'}`);
    await page.evaluate(() => window.__wb.run('findings'));
    const fcard = page.locator('.pane-findings .note-card.finding', { hasText: 'The verse bar could say' });
    check('Findings lists it', await fcard.waitFor({ timeout: 10000 }).then(() => true, () => false));
    await page.screenshot({ path: shots + '1440-findings.png' });
    await fcard.getByRole('button', { name: '✓ Handled' }).click();
    await page.waitForFunction(() => !document.querySelector('.pane-findings .note-card.finding'), null, { timeout: 10000 }).catch(() => {});
    check('✓ Handled marks it handled (wb findings --all)', JSON.parse(execFileSync(wbExe, ['findings', '--all'], { env }).toString()).counts.handled === 1);
    await page.evaluate(() => { const d = window.__wb.dock(); for (const p of d.panes.filter(p => p.kind === 'findings')) d.close(p); });

    // C1 (finding b737): files attached to a finding: dropped on the box, a picture pasted, one picked with Browse;
    // copied into findings/<id>/ and nowhere else. (Synthetic events here; measure/real-drag.mjs drops a file with the
    // operating system's own drag.)
    const srcDir = path.join(work, 'attach-src');
    mkdirSync(srcDir, { recursive: true });
    const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    writeFileSync(path.join(srcDir, 'example.pdf'), pdfBytes);
    writeFileSync(path.join(srcDir, 'too big.bin'), Buffer.alloc(10 * 1024 * 1024 + 1));
    const snapshot = dir => { const out = new Map(); const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.set(path.relative(dir, p).replace(/\\/g, '/'), readFileSync(p).toString('base64')); } }; walk(dir); return out; };
    const studyBefore = snapshot(study);
    await page.locator('#reader').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+Shift+KeyJ');
    await page.waitForFunction(() => document.activeElement?.classList.contains('finding-field'), null, { timeout: 5000 }).catch(() => {});
    await page.keyboard.type('The box could take a screenshot and an example');
    // a PNG dropped on the box
    await page.evaluate(b64 => {
      const box = document.querySelector('.finding-box');
      const dt = new DataTransfer();
      dt.items.add(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'dropped.png', { type: 'image/png' }));
      for (const type of ['dragenter', 'dragover', 'drop']) box.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    }, pngBytes.toString('base64'));
    // a picture pasted into the words (the clipboard calls it image.png)
    await page.evaluate(b64 => {
      const dt = new DataTransfer();
      dt.items.add(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'image.png', { type: 'image/png' }));
      document.querySelector('.finding-field').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
    }, pngBytes.toString('base64'));
    // a PDF picked with Browse…, and one over the cap, which is refused with a word
    await page.locator('.finding-box .file-pick').setInputFiles([path.join(srcDir, 'example.pdf')]);
    await page.locator('.finding-box .file-pick').setInputFiles([path.join(srcDir, 'too big.bin')]);
    const capSaid = await page.locator('.toast', { hasText: '10 MB at most' }).waitFor({ timeout: 3000 }).then(() => true, () => false);
    const boxChips = await page.locator('.finding-box .file-chip-name').allTextContents();
    check('the findings box takes a dropped PNG, a pasted picture and a PDF from Browse…, and says no to one over 10 MB', boxChips.length === 3 && boxChips[0] === 'dropped.png' && /^pasted \d{4}-\d\d-\d\d \d{6}\.png$/.test(boxChips[1]) && boxChips[2] === 'example.pdf' && capSaid, boxChips.join(', '));
    await page.screenshot({ path: shots + '1440-finding-files.png' });
    // a file let go outside a drop zone is not opened by the web view in place of the app
    const strayKept = await page.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'stray.txt')); const e = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }); document.querySelector('#reader').dispatchEvent(e); return e.defaultPrevented; });
    check('a file dropped on the reader is not opened in place of the app', strayKept);
    await page.locator('.finding-field').press('Enter');
    let attached = null;
    for (let i = 0; i < 40 && !attached; i++) {
      const all = JSON.parse(execFileSync(wbExe, ['findings'], { env }).toString()).findings;
      attached = all.find(f => f.text.startsWith('The box could take') && f.files.length === 3) || null;
      if (!attached) await sleep(150);
    }
    const studyAfter = snapshot(study);
    const written = [...studyAfter.keys()].filter(k => studyBefore.get(k) !== studyAfter.get(k));
    const fid = attached?.id || '';
    const onlyFindings = written.length === 4 && written.every(k => k === `findings/${fid}.md` || k.startsWith(`findings/${fid}/`)) && [...studyBefore.keys()].every(k => studyAfter.has(k));
    const filesDir = path.join(study, 'findings', fid);
    const sameBytes = !!fid && readFileSync(path.join(filesDir, 'dropped.png')).equals(pngBytes) && readFileSync(path.join(filesDir, 'example.pdf')).equals(pdfBytes) && readFileSync(path.join(srcDir, 'example.pdf')).equals(pdfBytes);
    check('Enter keeps it with its 3 files in findings/<id>/, byte for byte; nothing else in the study folder is written', !!attached && onlyFindings && sameBytes, written.join(', '));
    const fmdText = fid ? readFileSync(path.join(study, 'findings', `${fid}.md`), 'utf8') : '';
    const mdKeys = fmdText.split('---')[1]?.trim().split('\n').filter(l => /^[a-z]+:/.test(l)).map(l => l.split(':')[0]).join(',');
    check('a finding’s .md is the same with files as without: they are listed from the folder, not in the file', mdKeys === 'id,kind,status,created,updated,context', mdKeys);
    const shown = fid ? JSON.parse(execFileSync(wbExe, ['finding', 'show', fid.slice(-4)], { env }).toString()) : {};
    check('wb finding show lists them with their paths', (shown.files || []).map(f => f.name).join(', ') === `dropped.png, example.pdf, ${boxChips[1]}` && shown.files.every(f => existsSync(f.path)), (shown.files || []).map(f => f.name).join(', '));
    // the Findings pane lists them on the card; a click opens one (WB_NO_OPEN: nothing is put on the screen)
    await page.evaluate(() => window.__wb.run('findings'));
    const acard = page.locator(`.pane-findings .note-card.finding[data-id="${fid}"]`);
    await acard.waitFor({ timeout: 10000 }).catch(() => {});
    const cardChips = await acard.locator('.file-chip-name').allTextContents();
    await acard.locator('.file-chip-open', { hasText: 'example.pdf' }).click();
    const opened = await page.locator('.toast', { hasText: 'Opening example.pdf' }).waitFor({ timeout: 3000 }).then(() => true, () => false);
    check('the Findings pane shows the files on the card, and a click opens one (wb finding open answers for it)', cardChips.length === 3 && opened, cardChips.join(', '));
    await page.screenshot({ path: shots + '1440-findings-files.png' });
    // × takes one off, to .trash
    page.once('dialog', d => void d.accept());
    await acard.locator('.file-chip', { hasText: 'dropped.png' }).locator('.file-chip-x').click();
    await page.waitForFunction(id => document.querySelectorAll(`.pane-findings .note-card.finding[data-id="${id}"] .file-chip`).length === 2, fid, { timeout: 5000 }).catch(() => {});
    const offToTrash = readdirSync(path.join(study, '.trash')).some(n => n.endsWith(`finding-${fid}-dropped.png`)) && !existsSync(path.join(filesDir, 'dropped.png'));
    check('× takes a file off the finding: it goes to .trash', offToTrash && await acard.locator('.file-chip').count() === 2);
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
    await page.waitForSelector('.sheet .acts, .popover .acts', { timeout: 5000 }).catch(() => {});
    // on touch a verse's number opens its card (Note, Question, Thread, Copy); Note is measured where it settles
    await sleep(600);
    const nb = await page.locator('.sheet .act, .popover .act', { hasText: /^Note$/ }).first().boundingBox();
    await watchBlur();
    if (nb) await tap(nb.x + nb.width / 2, nb.y + nb.height / 2);
    const s2 = await keptWriting();
    check('on touch, Note on a verse keeps the cursor in the new note through typing and saving', !!nb && s2.got && s2.focus && !s2.blurs.length, JSON.stringify(s2));
    await page.keyboard.press('Escape');
    await sleep(900);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await nbBack();
  }

  // tier 4: documents from a thread. The Documents pane makes the Speaker Script (Word); the command field makes Verse by
  // Verse (PDF pages); each is checked verse by verse before it is kept, listed with how it stands, and in its thread's pane
  const docsDir = path.join(study, 'exports');
  // a lesson's PowerPoint, as the Python app records one (its file not made here): written into this run's own copy, so the
  // check below does not depend on what the scratch folder holds
  mkdirSync(path.join(study, 'documents'), { recursive: true });
  writeFileSync(path.join(study, 'documents', 'lesson-phinehas-pulpit.json'), JSON.stringify({ id: 'lesson-phinehas-pulpit', source: { kind: 'lesson', name: 'phinehas' }, to: 'deck', structure: 'pulpit', name: 'Pulpit - Phinehas.pptx', stem: 'Pulpit - Phinehas', title: 'Phinehas', theme: 'vellum', plan: '0'.repeat(64), file: '0'.repeat(64), built: '2026-11-02T12:00:00Z' }, null, 1) + '\n');
  await page.evaluate(() => window.__wb.run('docs'));
  await page.waitForSelector('.pane-documents .doc-make', { timeout: 15000 });
  check('docs opens the Documents pane, with Make and the list (six kinds: R3)', await page.locator('.pane-documents .doc-make select.doc-kind option').count() === 6);
  await page.locator('.pane-documents select.doc-thread').selectOption({ label: 'Phinehas' });
  await page.locator('.pane-documents select.doc-theme').selectOption('olivet');
  await page.locator('.pane-documents .doc-make button', { hasText: 'Make' }).click();
  const scriptRow = page.locator('.pane-documents .doc-row', { hasText: 'Speaker Script - Phinehas.docx' });
  await scriptRow.waitFor({ timeout: 20000 });
  const scriptRec = JSON.parse(execFileSync(wbExe, ['docs', 'show', 'thread-phinehas-script'], { env }).toString());
  check('Make writes the Speaker Script, checked, inside the scratch folder', existsSync(path.join(docsDir, 'Speaker Script - Phinehas.docx')) && scriptRec.state === 'current' && scriptRec.theme === 'olivet', scriptRec.state);
  check('the Speaker Script is listed Up to date', (await scriptRow.locator('.doc-state').innerText()) === 'Up to date');
  // R3: Adjust… opens the dials beside a live page drawn from the thread's own plan; a Look, Ink and See it in grey
  // change the page at once; Use these carries the dials back to the Make row (nothing is made until Make)
  await page.locator('.pane-documents .doc-make .doc-adjust').click();
  await page.waitForSelector('.lk-modal .lk-page', { timeout: 15000 }).catch(() => {});
  const plan = JSON.parse(execFileSync(wbExe, ['docs', 'plan', '--thread', 'phinehas', '--to', 'word', '--structure', 'script'], { env }).toString());
  const firstVerse = plan.plan.find(op => op[1] === 'Scripture End' || op[1] === 'Scripture')[2].filter(r => r[1] !== 'num').map(r => r[0]).join('').trim().slice(0, 40);
  const livePage = page.locator('.lk-modal .lk-page');
  check('Adjust shows the thread’s own first page, its scripture verbatim from the plan', await livePage.count() === 1 && (await livePage.innerText()).replace(/\s+/g, ' ').includes(firstVerse.replace(/\s+/g, ' ')), firstVerse);
  await page.locator('.lk-modal .lk-opt', { hasText: 'Classic' }).click();
  await page.locator('.lk-modal .lk-opt[data-dial="ink"][data-value="saver"]').click();
  const look = await livePage.evaluate(el => ({ center: el.classList.contains('center'), font: getComputedStyle(el.querySelector('.dp-Title')).fontFamily, ref: getComputedStyle(el.querySelector('.dp-ScriptureReference')).color }));
  check('Classic centres a Literata title, and Ink saver turns the accent grey', look.center && /Literata/.test(look.font) && look.ref === 'rgb(68, 68, 68)', JSON.stringify(look));
  await page.locator('.lk-modal .lk-grey-toggle input').check();
  check('See it in grey greys the page', await page.locator('.lk-modal .lk-page.lk-grey').count() === 1);
  await page.screenshot({ path: shots + '1440-adjust.png' });
  await page.locator('.lk-modal .lk-use').click();
  await page.waitForSelector('.lk-modal', { state: 'detached', timeout: 5000 }).catch(() => {});
  check('Use these closes Adjust and sets Look and Ink on the Make row', await page.locator('.lk-modal').count() === 0
    && await page.locator('.pane-documents .doc-make select.doc-look').inputValue() === 'classic' && await page.locator('.pane-documents .doc-make select.doc-ink').inputValue() === 'saver');
  const deckSaid = await page.evaluate(() => window.__wb.run('deck thread phinehas verse'));
  const deckFile = path.join(docsDir, 'Verse by Verse - Phinehas.pdf');
  for (let i = 0; i < 50 && !existsSync(deckFile); i++) await sleep(100);
  check('deck thread phinehas verse makes the slides as PDF pages, every verse checked', existsSync(deckFile) && readFileSync(deckFile).subarray(0, 5).toString() === '%PDF-' && /every verse checked/.test(JSON.stringify(deckSaid)), JSON.stringify(deckSaid));
  await page.locator('.pane-documents .doc-row', { hasText: 'Verse by Verse - Phinehas.pdf' }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: shots + '1440-documents.png' });
  const pyRow = page.locator('.pane-documents .doc-row', { hasText: 'Pulpit - Phinehas' });
  check('a document the Python app makes (a lesson’s PowerPoint) offers no Update here, and says who makes it', await pyRow.count() === 1 && await pyRow.locator('.doc-update').count() === 0 && /Python app until phase 5/.test(await pyRow.innerText()));
  // a new note at a verse in the thread puts both behind; Update brings one up to date in the same file
  execFileSync(wbExe, ['note', 'add', 'Num 25:11', 'checked from the desk'], { env });
  await sleep(1200); // the window reads the folder again at most once a second
  await page.evaluate(() => window.__wb.run('docs'));
  await page.waitForFunction(() => /Out of date/.test(document.querySelector('.pane-documents .doc-row[data-id="thread-phinehas-script"]')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  check('a new note in the thread marks the document Out of date', /Out of date/.test(await scriptRow.innerText()), await scriptRow.locator('.doc-state').innerText());
  await scriptRow.locator('.doc-update').click();
  await page.waitForFunction(() => /Up to date/.test(document.querySelector('.pane-documents .doc-row[data-id="thread-phinehas-script"]')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
  check('Update brings it up to date in the same file', /Up to date/.test(await scriptRow.innerText()) && JSON.parse(execFileSync(wbExe, ['docs', 'show', 'thread-phinehas-script'], { env }).toString()).name === 'Speaker Script - Phinehas.docx');
  await page.evaluate(() => window.__wb.run('thread Phinehas'));
  await page.waitForSelector('.pane-notebook .nb-docs .doc-row', { timeout: 15000 }).catch(() => {});
  check('the thread’s page lists its documents, with Make for it', await page.locator('.pane-notebook .nb-docs .doc-row').count() >= 2 && await page.locator('.pane-notebook .nb-docs .doc-make').count() === 1, String(await page.locator('.pane-notebook .nb-docs .doc-row').count()));
  // Optional predecessor comparison when its checkout is explicitly selected.
  if (env.WB_LEGACY_APP) {
    let pyOpens = '';
    try { pyOpens = execFileSync('python', ['-I', path.join(file('scripts/'), 'py-opens.py')], { env: { ...env, WB_STUDY_DIR: study }, cwd: file('') }).toString(); } catch (e) { pyOpens = String(e.stdout || e); }
    check('the Python app still opens the study folder: what it reads is what this app counts (scripts/py-opens.py)', /^ok .*notes/m.test(pyOpens) && !/^DIFF/m.test(pyOpens), pyOpens.replace(/\n/g, ' | '));
  }

  // the Shelf as a tree (R2)
  await shelfChecks({ page, check, env, wbExe, study, shots, sleep });

  await settingsChecks(page);
  await threadChecks({ page, check, env, wbExe, sleep });
  await readingPlansChecks({ page, check, env, wbExe, sleep });

  // wb do from a terminal reaches this window
  const said = execFileSync(wbExe, ['do', 'open John 3:16-18'], { env }).toString().trim();
  await page.waitForSelector('.pane-reader2 .vn-asked', { timeout: 10000 });
  const john = JSON.parse(execFileSync(wbExe, ['text', 'John 3:16-18', '--json'], { env }).toString());
  const shown = await page.evaluate(() => { const r = [...document.querySelectorAll('.pane-reader2 .reader2')].find(x => x.offsetWidth); return { asked: [...r.querySelectorAll('.vn-asked')].map(v => +v.dataset.v), text: r.textContent.replace(/\s+/g, ' ') }; });
  check('wb do opens the passage in a second reader, verbatim, its verses marked', shown.asked.join() === '16,17,18' && john.verses.every(v => shown.text.includes(v.text.replace(/\s+/g, ' '))), said);

  // marks (design/features/marks): a margin note at a verse shows its mark beside the verse and opens the verse in the margin;
  // the longer years-of-study and reader's-place checks are measure/marks.mjs
  execFileSync(wbExe, ['margin', 'add', 'Num 25:11', 'checked from the desk'], { env });
  await page.evaluate(() => window.__wb.open('NUM', 25, 11));
  await page.waitForSelector('.mg-mark[data-v="11"], .mg-dot[data-v="11"]', { timeout: 10000 }).catch(() => {});
  check('a margin note at Numbers 25:11 shows its mark beside the verse', await page.locator('.mg-mark[data-v="11"], .mg-dot[data-v="11"]').count() === 1);
  await page.locator('.mg-mark[data-v="11"], .mg-dot[data-v="11"]').first().click().catch(() => {});
  check('a click opens the verse in the margin: the verse, its note, the field', await page.locator('.mg-panel .mg-verse').waitFor({ timeout: 5000 }).then(() => true, () => false) && await page.locator('.mg-panel .mg-field').count() === 1);
  await page.locator('.mg-close').click().catch(() => {});

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
  try { await browser?.contexts()[0].pages()[0].screenshot({ path: path.join(work, 'failed.png') }); } catch { /* none */ }
} finally {
  await browser?.close().catch(() => {});
  kill();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
